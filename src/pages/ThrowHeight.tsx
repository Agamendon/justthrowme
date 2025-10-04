import { useMemo } from 'react'

// =============================================================
// ThrowHeight.tsx — offline height estimation of a tossed phone
// (short-throw–friendly)
// -------------------------------------------------------------
// Key upgrades vs previous version:
//  • Robust, adaptive thresholds (from data) instead of fixed values
//  • Time-align gyro → accel timestamps (index-matching was brittle)
//  • Morphological gap filling & tiny-run removal (captures very short TOF)
//  • Optional valley test on |a_total^w| (≈ 0 in free-fall) to help short throws
//  • Jerk-based (d/dt |a_lin|) assistance for release/catch boundaries
//  • Still NO assumption that catch height == throw height
// =============================================================

export type Sample = { t: number; x: number; y: number; z: number }

// ----------------------- small helpers -----------------------
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const hypot3 = (x: number, y: number, z: number) => Math.hypot(x, y, z)

const movingAvg = (arr: number[], win: number) => {
  if (win <= 1) return arr.slice()
  const out: number[] = new Array(arr.length)
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
    if (i - win >= 0) sum -= arr[i - win]
    const count = i < win - 1 ? i + 1 : win
    out[i] = sum / count
  }
  return out
}

const integrateTrap = (y: number[], t: number[], i0 = 0, i1 = y.length - 1, y0 = 0) => {
  const out: number[] = new Array(i1 - i0 + 1)
  out[0] = y0
  for (let i = i0 + 1; i <= i1; i++) {
    const dt = Math.max(0, t[i] - t[i - 1])
    out[i - i0] = out[i - i0 - 1] + 0.5 * (y[i - 1] + y[i]) * dt
  }
  return out
}

// Robust scale estimate
const MAD = (arr: number[]) => {
  if (!arr.length) return 0
  const med = quantile(arr, 0.5)
  const dev = arr.map(v => Math.abs(v - med))
  const mad = quantile(dev, 0.5)
  return 1.4826 * mad // Gaussian consistency
}

const quantile = (arr: number[], q: number) => {
  if (!arr.length) return 0
  const a = arr.slice().sort((x,y)=>x-y)
  const pos = clamp((a.length - 1) * q, 0, a.length - 1)
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  if (lo === hi) return a[lo]
  const w = pos - lo
  return a[lo] * (1 - w) + a[hi] * w
}

// Fill tiny 0-gaps inside a 1-mask and remove tiny 1-islands (in samples)
function morphCloseOpen(mask: boolean[], closeGapsN: number, openIslandsN: number) {
  const n = mask.length
  const out = mask.slice()
  // close (fill zeros between ones if gap ≤ N)
  let i = 0
  while (i < n) {
    while (i < n && !out[i]) i++
    const start = i
    while (i < n && out[i]) i++
    const end = i - 1
    // gap
    let g0 = i
    while (g0 < n && !out[g0]) g0++
    if (i < n) {
      const gapEnd = g0 - 1
      if ((g0 - i) > 0 && (g0 - i) <= closeGapsN) {
        for (let k = i; k <= gapEnd; k++) out[k] = true
      }
    }
  }
  // open (remove 1-islands shorter than N)
  i = 0
  while (i < n) {
    while (i < n && !out[i]) i++
    const s = i
    while (i < n && out[i]) i++
    const e = i - 1
    if (s <= e && (e - s + 1) <= openIslandsN) {
      for (let k = s; k <= e; k++) out[k] = false
    }
  }
  return out
}

// Align a sample list (by times) to a target time vector using nearest neighbor
const alignSeries = (src: Sample[], tTarget: number[]) => {
  if (!src || !src.length) return new Array(tTarget.length).fill(0)
  const ts = src.map(s => s.t)
  let j = 0
  const out: number[] = new Array(tTarget.length)
  for (let i = 0; i < tTarget.length; i++) {
    const tt = tTarget[i]
    while (j + 1 < ts.length && Math.abs(ts[j + 1] - tt) < Math.abs(ts[j] - tt)) j++
    const s = src[j]
    out[i] = s ? s.x !== undefined && s.y !== undefined && s.z !== undefined ? hypot3(s.x, s.y, s.z) : 0 : 0
  }
  return out
}

// Helper for finding stationary windows around a free-fall span
const findStationaryWindows = (
  t: number[], freeStart: number, freeEnd: number, statMask: boolean[], stationaryWindowMs: number
) => {
  const needStatS = stationaryWindowMs / 1000
  const n = t.length
  // Pre-throw stationary window before release
  let s0 = freeStart - 1
  let accT = 0
  let j = freeStart
  while (j > 0 && accT < needStatS) {
    if (statMask[j - 1]) accT += Math.max(0, t[j] - t[j - 1])
    else accT = 0
    j--
  }
  s0 = clamp(j, 0, freeStart - 1)
  // Post-catch stationary window after catch
  let s1 = freeEnd + 1
  accT = 0
  j = freeEnd
  while (j < n - 1 && accT < needStatS) {
    if (statMask[j + 1]) accT += Math.max(0, t[j + 1] - t[j])
    else accT = 0
    j++
  }
  s1 = clamp(j, freeEnd + 1, n - 1)
  return { i0: s0, i1: s1, t0: t[s0], t1: t[s1] }
}

// ------------------------- Props ----------------------------
export type ThrowHeightProps = {
  worldAccels: Sample[]                // total accel in world frame (includes gravity)
  accelerations?: Sample[]             // optional linear accel (excludes gravity); if absent, derived as a_lin^w = a_tot^w - g_world
  worldOmegas?: Sample[]               // optional world-frame gyro for detection help
  g?: number                           // default 9.80665 m/s^2
  smoothN?: number                     // smoothing for plots/integration (samples)
  // Tuning
  minFreeFallMs?: number               // minimum free-fall duration to accept
  stationaryWindowMs?: number          // ms length for ZUPT windows
  // Optional manual thresholds (if provided, override adaptive)
  freeFallALinThresh?: number          // m/s^2 for |a_lin|
  gyroThresh?: number                  // deg/s for |ω|
  totValleyFracG?: number              // fraction of g for |a_tot| valley (default ~0.35g)
  launchWindowMs?: number              // window before release for Method 2
}

export default function ThrowHeight({
  worldAccels,
  accelerations,
  worldOmegas,
  g = 9.80665,
  smoothN = 5,
  minFreeFallMs = 60,            // ↓ allow very short throws
  stationaryWindowMs = 250,
  freeFallALinThresh,            // adaptive by default
  gyroThresh,                    // adaptive by default
  totValleyFracG = 0.35,         // |a_tot| < 0.35 g counts as free-fall hint
  launchWindowMs = 200,
}: ThrowHeightProps) {
  if (!worldAccels || worldAccels.length < 8) {
    return (
      <div className="p-6 bg-gray-900 text-white rounded-xl">
        <h2 className="text-xl font-bold mb-1">Throw height</h2>
        <p>Not enough samples — record first, then open this analyzer.</p>
      </div>
    )
  }

  // ------------------ Prepare / derive series -----------------
  const { t, dtMean, aTotX, aTotY, aTotZ, aTotMag, aLinX, aLinY, aLinZ, aLinMag, aLinMagRaw, omegaMagAligned, jerkMag } = useMemo(() => {
    const t = worldAccels.map(p => p.t)
    const dt = t.map((v,i)=> i ? Math.max(0, v - t[i-1]) : 0)
    const dtMean = dt.reduce((s,v)=>s+v,0) / Math.max(1, dt.length-1)

    const aTotXraw = worldAccels.map(p => p.x)
    const aTotYraw = worldAccels.map(p => p.y)
    const aTotZraw = worldAccels.map(p => p.z)
    const aTotX = movingAvg(aTotXraw, smoothN)
    const aTotY = movingAvg(aTotYraw, smoothN)
    const aTotZ = movingAvg(aTotZraw, smoothN)
    const aTotMag = aTotXraw.map((_,i)=>hypot3(aTotXraw[i], aTotYraw[i], aTotZraw[i]))

    let aLinXraw: number[], aLinYraw: number[], aLinZraw: number[]
    if (accelerations && accelerations.length === worldAccels.length) {
      aLinXraw = accelerations.map(p => p.x)
      aLinYraw = accelerations.map(p => p.y)
      aLinZraw = accelerations.map(p => p.z)
    } else {
      // world linear accel by removing gravity from total world accel
      aLinXraw = aTotXraw.map(v => v)
      aLinYraw = aTotYraw.map(v => v)
      aLinZraw = aTotZraw.map(v => v + g)
    }
    const aLinMagRaw = aLinXraw.map((_,i)=>hypot3(aLinXraw[i], aLinYraw[i], aLinZraw[i]))
    const aLinX = movingAvg(aLinXraw, smoothN)
    const aLinY = movingAvg(aLinYraw, smoothN)
    const aLinZ = movingAvg(aLinZraw, smoothN)
    const aLinMag = aLinX.map((_,i)=>hypot3(aLinX[i], aLinY[i], aLinZ[i]))

    // jerk magnitude from raw |a_lin|
    const jerkMag = aLinMagRaw.map((v,i)=> i ? Math.abs((v - aLinMagRaw[i-1]) / Math.max(1e-6, dt[i])) : 0)

    // Align gyro magnitude to accel timestamps
    const omegaMagAligned = worldOmegas && worldOmegas.length ? alignSeries(worldOmegas, t) : new Array(t.length).fill(0)

    return { t, dtMean, aTotX, aTotY, aTotZ, aTotMag, aLinX, aLinY, aLinZ, aLinMag, aLinMagRaw, omegaMagAligned, jerkMag }
  }, [worldAccels, accelerations, worldOmegas, g, smoothN])

  // ---------------- Adaptive thresholds (from data) -----------
  const thr = useMemo(() => {
    // Use lower quartile region to estimate noise
    const lowALin = aLinMagRaw.slice().sort((a,b)=>a-b).slice(0, Math.max(5, Math.floor(0.3 * aLinMagRaw.length)))
    const sigALin = Math.max(0.05, MAD(lowALin))
    const thALin = freeFallALinThresh ?? clamp(3 * sigALin, 0.2, 1.0) // typical 0.3–0.8

    const lowOmega = omegaMagAligned.slice().sort((a,b)=>a-b).slice(0, Math.max(5, Math.floor(0.3 * omegaMagAligned.length)))
    const sigOmega = Math.max(1, MAD(lowOmega))
    const thOmega = gyroThresh ?? clamp(3 * sigOmega, 10, 60) // deg/s

    const thTot = totValleyFracG * g // |a_tot| valley threshold

    // jerk threshold for release/catch hints
    const lowJerk = jerkMag.slice().sort((a,b)=>a-b).slice(0, Math.max(5, Math.floor(0.3 * jerkMag.length)))
    const thJerk = clamp(6 * MAD(lowJerk), 10, 200) // m/s^3

    return { thALin, thOmega, thTot, thJerk }
  }, [aLinMagRaw, omegaMagAligned, jerkMag, g, freeFallALinThresh, gyroThresh, totValleyFracG])

  // --------------- Short-throw–friendly free-fall mask --------
  const detect = useMemo(() => {
    const n = t.length
    if (n < 3) return { ok: false as const, reason: 'Too few samples' }

    // base masks
    const maskALin = aLinMagRaw.map(v => v < thr.thALin)
    const maskOmega = omegaMagAligned.map(v => v < thr.thOmega)
    const maskTot = aTotMag.map(v => v < thr.thTot) // valley near 0 g in free-fall

    // combine (OR of valley with AND of others) — helps very short throws
    let free = new Array(n).fill(false).map((_,i)=> (maskALin[i] && maskOmega[i]) || maskTot[i])

    // Morphological smoothing in samples (derived from time)
    const minSamp = Math.max(2, Math.round((minFreeFallMs/1000) / Math.max(1e-3, (t[t.length-1]-t[0])/(n-1))))
    free = morphCloseOpen(free, /*fill gaps up to*/ 2, /*drop islands shorter than*/ 1)

    // Choose the run with best score (low mean |a_lin| + |ω|), not just longest
    let best = { i0: -1, i1: -1, score: Infinity }
    let i = 0
    while (i < n) {
      while (i < n && !free[i]) i++
      if (i >= n) break
      const s = i
      while (i < n && free[i]) i++
      const e = i - 1
      if (e - s + 1 >= minSamp) {
        let sum = 0, cnt = 0
        for (let k = s; k <= e; k++) { sum += aLinMagRaw[k] + 0.01 * omegaMagAligned[k]; cnt++ }
        const score = sum / Math.max(1, cnt)
        if (score < best.score) best = { i0: s, i1: e, score }
      }
    }

    if (best.i0 < 0) return { ok: false as const, reason: 'No convincing free-fall window found' }

    // Stationary masks (for ZUPT): small |a_lin|
    const statMask = aLinMagRaw.map(v => v < Math.max(0.25, 0.6 * thr.thALin))
    const stat = findStationaryWindows(t, best.i0, best.i1, statMask, stationaryWindowMs)

    // Jerk hints for release/catch (optional refinement)
    const snap = (idx: number, dir: -1 | 1) => {
      let bestI = idx, bestJ = -Infinity
      const span = Math.max(2, Math.round(0.04 / Math.max(1e-6, (t[t.length-1]-t[0])/(n-1)))) // ~40 ms
      for (let k = -span; k <= span; k++) {
        const j = clamp(idx + dir * k, 1, n - 1)
        if (jerkMag[j] > bestJ) { bestJ = jerkMag[j]; bestI = j }
      }
      return (bestJ > thr.thJerk) ? bestI : idx
    }
    const iRel = snap(best.i0, -1)
    const iCat = snap(best.i1, +1)

    return {
      ok: true as const,
      free: { i0: iRel, i1: iCat, t0: t[iRel], t1: t[iCat] },
      stat,
      masks: { free, stat: statMask },
      thr,
    }
  }, [t, aLinMagRaw, omegaMagAligned, aTotMag, thr, minFreeFallMs, stationaryWindowMs, jerkMag])

  // --------------- ZUPT-aided integration (vertical) ----------
  const integ = useMemo(() => {
    if (!detect.ok) return null
    const { stat } = detect
    const i0 = stat.i0, i1 = stat.i1
    const aZ = aTotZ
    const tAll = t
    const vRaw = integrateTrap(aZ, tAll, i0, i1, 0)
    const vEnd = vRaw[vRaw.length - 1]
    const T = Math.max(1e-6, tAll[i1] - tAll[i0])
    const bias = vEnd / T
    const aCorr: number[] = []
    for (let i = i0; i <= i1; i++) aCorr.push(aZ[i] - bias)
    const vCorr = integrateTrap(aCorr, tAll, 0, aCorr.length - 1, 0)
    const zCorr = integrateTrap(vCorr, tAll.slice(i0, i1 + 1), 0, vCorr.length - 1, 0)
    // Linear accel (gravity removed) with same bias correction
    const aLinZLocal = aCorr.map(v => v + g)
    return { i0, i1, t0: tAll[i0], t1: tAll[i1], aCorr, vCorr, zCorr, aLinZLocal }
  }, [detect, aTotZ, t, g])

  // ---------------------- Methods 1–3 -------------------------
  const method1 = useMemo(() => {
    if (!detect.ok || !integ) return null
    const { free } = detect
    const { i0: s0, zCorr } = integ
    const r0 = free.i0 - s0
    const r1 = free.i1 - s0
    if (r0 < 0 || r1 <= r0 || r1 >= zCorr.length) return null
    const T = (t[free.i1] - t[free.i0])
    const dH = zCorr[r1] - zCorr[r0]
    const v0 = 0.5 * g * T + (dH / T)
    const h = Math.max(0, (v0 * v0) / (2 * g))
    return { T, dH, v0, h, detection: 'adaptive mask (|a_lin| & |ω|, valley |a_tot|)' }
  }, [detect, integ, g, t])

  const method2 = useMemo(() => {
    if (!detect.ok || !integ) return null
    const { free } = detect
    const { aLinZLocal, i0: s0, i1: s1 } = integ
    const iRelLocal = free.i0 - s0
    if (iRelLocal <= 1) return null
    const Tpre = launchWindowMs / 1000
    const tLocal = t.slice(s0, s1 + 1)
    let iStart = iRelLocal
    while (iStart > 0 && (tLocal[iRelLocal] - tLocal[iStart]) < Tpre) iStart--
    const vWin = integrateTrap(aLinZLocal, tLocal, iStart, iRelLocal, 0)
    const v0 = vWin[vWin.length - 1]
    const h = Math.max(0, (v0 * v0) / (2 * g))
    return { v0, h, span: tLocal[iRelLocal] - tLocal[iStart], detection: 'pre-release impulse' }
  }, [detect, integ, t, g, launchWindowMs])

  const method3 = useMemo(() => {
    if (!detect.ok || !integ) return null
    const { free } = detect
    const { vCorr, zCorr, i0: s0 } = integ
    const r0 = free.i0 - s0
    const r1 = free.i1 - s0
    if (r0 < 1 || r1 <= r0) return null
    let iA = r0
    for (let i = r0 + 1; i <= r1; i++) {
      if (vCorr[i - 1] > 0 && vCorr[i] <= 0) { iA = i; break }
      if (zCorr[i] > zCorr[iA]) iA = i
    }
    const h = Math.max(0, zCorr[iA] - zCorr[r0])
    const dH = zCorr[r1] - zCorr[r0]
    return { h, apexIndex: iA, dH, detection: 'ZUPT trajectory' }
  }, [detect, integ])

  // ---------------------- Method 4 ----------------------------
  // Falling-phase (descending) duration from time-of-flight T and initial velocity v0.
  // t_up = v0/g,  t_fall = max(0, T - t_up). Optionally cross-check with Δh when available:
  // t_fall_alt = sqrt( 2 * (h_max - Δh) / g ),  h_max = v0^2/(2g).
  const method4 = useMemo(() => {
    if (!detect.ok) return null
    const T = detect.free.t1 - detect.free.t0

    // Prefer v0 from Method 2 (impulse), else Method 1 (TOF+Δh), else estimate via LS fit on v(t)
    let v0: number | null = null
    let src: string = ''
    if (method2 && Number.isFinite(method2.v0)) { v0 = method2.v0; src = 'impulse' }
    else if (method1 && Number.isFinite(method1.v0)) { v0 = method1.v0; src = 'tof+Δh' }
    else if (integ) {
      const s0 = integ.i0
      const r0 = detect.free.i0 - s0
      const r1 = detect.free.i1 - s0
      if (r0 >= 0 && r1 > r0) {
        const tLocal = t.slice(s0, s1Clamp(integ.i1, t.length-1) + 1)
        const vLocal = integ.vCorr
        const tFree = tLocal.slice(r0, r1 + 1)
        const vFree = vLocal.slice(r0, r1 + 1)
        const n = tFree.length
        if (n >= 3) {
          let Sx=0,Sy=0,Sxx=0,Sxy=0
          for (let i=0;i<n;i++){ const x=tFree[i]; const y=vFree[i]; Sx+=x; Sy+=y; Sxx+=x*x; Sxy+=x*y }
          const c1 = (n*Sxy - Sx*Sy)/(n*Sxx - Sx*Sx)
          const c0 = (Sy - c1*Sx)/n
          const tRelease = t[detect.free.i0]
          v0 = c0 + g*tRelease
          src = 'fit(v)'
        }
      }
    }
    if (v0 == null) return null

    const tUp = Math.max(0, v0 / g)
    let tFall = Math.max(0, T - tUp)

    // alt using Δh if available
    let tFallAlt: number | null = null
    if (method1 && Number.isFinite(method1.dH)) {
      const hMax = (v0*v0) / (2*g)
      const D = Math.max(0, hMax - (method1 as any).dH)
      tFallAlt = Math.sqrt(2*D/g)
      if (Number.isFinite(tFallAlt)) {
        // fuse conservatively: prefer the smaller (avoids catch contamination), or average if close
        const rel = Math.abs(tFallAlt - tFall)/Math.max(1e-6, tFall)
        tFall = rel > 0.25 ? Math.min(tFall, tFallAlt) : 0.5*(tFall + tFallAlt)
      }
    }

    const tRelease = t[detect.free.i0]
    const tApex = tRelease + tUp
    // find first index ≥ apex within free window
    let iFall0 = detect.free.i0
    for (let i = detect.free.i0; i <= detect.free.i1; i++) { if (t[i] >= tApex) { iFall0 = i; break } }

    // Calculate height using falling-phase duration: h = 0.5 * g * t_fall^2
    const h = Math.max(0, 0.5 * g * tFall * tFall)

    return { T, v0, src, tUp, tFall, tFallAlt, tApex, iFall0, iFall1: detect.free.i1, h }
  }, [detect, method1, method2, integ, t, g])

  function s1Clamp(i:number, max:number){ return i>max?max:i }

  // ------------------------ Diagnostics ----------------------
  const diag = useMemo(() => {
    if (!detect.ok) return { ok: false as const, reason: detect.reason }
    const { free, stat } = detect
    const T = free.t1 - free.t0
    const S = stat.t1 - stat.t0
    return { ok: true as const, T, S, free, stat, thr: detect.thr, dtMean }
  }, [detect, dtMean])

  // -------------------------- Plots --------------------------
  function Plot({ x, y, title, xlab, ylab, highlight, threshold, showDebug, metrics, highlight2 }: {
    x: number[]; y: number[]; title: string; xlab: string; ylab: string;
    highlight?: { i0: number; i1: number }; threshold?: number; showDebug?: boolean; metrics?: string[]; highlight2?: { i0: number; i1: number };
  }) {
    const width = 360, height = 200
    const m = { t: 20, r: 16, b: 36, l: 40 }
    const W = width - m.l - m.r, H = height - m.t - m.b
    const minX = x[0], maxX = x[x.length - 1]
    const minY = Math.min(...y, 0), maxY = Math.max(...y, 1)
    const dx = Math.max(1e-9, maxX - minX)
    const dy = Math.max(1e-9, maxY - minY)
    const sx = (v: number) => m.l + ((v - minX) / dx) * W
    const sy = (v: number) => m.t + (1 - (v - minY) / dy) * H
    const pts = y.map((v, i) => `${sx(x[i]).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')

    return (
      <svg width={width} height={height} className="bg-white rounded-md shadow border">
        <text x={width/2} y={14} textAnchor="middle" fontSize={12}>{title}</text>
        {[...Array(5)].map((_,i)=>{const vx=minX+i*(maxX-minX)/4;const X=sx(vx);return(<g key={i}><line x1={X} y1={m.t} x2={X} y2={m.t+H} stroke="#f0f0f0"/><text x={X} y={m.t+H+14} fontSize={10} textAnchor="middle">{vx.toFixed(2)}</text></g>)})}
        {[...Array(5)].map((_,i)=>{const vy=minY+i*(maxY-minY)/4;const Y=sy(vy);return(<g key={i}><line x1={m.l} y1={Y} x2={m.l+W} y2={Y} stroke="#f0f0f0"/><text x={m.l-6} y={Y+3} fontSize={10} textAnchor="end">{vy.toFixed(2)}</text></g>)})}
        <polyline fill="none" stroke="#0b84f3" strokeWidth={2} points={pts}/>
        {highlight && (
          <rect x={sx(x[highlight.i0])} y={m.t} width={sx(x[highlight.i1]) - sx(x[highlight.i0])} height={H} fill="#2ecc7044"/>
        )}
        {highlight2 && (
          <rect x={sx(x[highlight2.i0])} y={m.t} width={sx(x[highlight2.i1]) - sx(x[highlight2.i0])} height={H} fill="#f39c1244"/>
        )}
        {threshold !== undefined && threshold>=minY && threshold<=maxY && (
          <>
            <line x1={m.l} y1={sy(threshold)} x2={m.l+W} y2={sy(threshold)} stroke="#ff0000" strokeWidth={1} strokeDasharray="4,2"/>
            <text x={m.l+W-5} y={sy(threshold)-3} fontSize={10} fill="#ff0000" textAnchor="end">+{threshold.toFixed(2)}</text>
          </>
        )}
        {metrics && (
          <>
            <rect x={width-160} y={m.t+5} width={155} height={Math.min(84, 12 * metrics.length)} fill="rgba(255,255,255,0.9)" stroke="#333" strokeWidth={0.5}/>
            {metrics.map((metric, i) => (
              <text key={i} x={width-155} y={m.t+18+i*12} fontSize={9} fill="#333">{metric}</text>
            ))}
          </>
        )}
        <text x={m.l+W/2} y={height-4} textAnchor="middle" fontSize={11}>{xlab}</text>
        <text x={14} y={m.t+H/2} textAnchor="middle" fontSize={11} transform={`rotate(-90, 14, ${m.t+H/2})`}>{ylab}</text>
      </svg>
    )
  }

  // --------------------------- UI ----------------------------
  return (
    <div className="p-6 bg-gray-900 text-white rounded-2xl space-y-4">
      <h2 className="text-2xl font-bold">Throw height (offline analysis — short-throw–friendly)</h2>

      {!diag.ok && (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">{diag.reason}</div>
      )}

      {diag.ok && (
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="font-semibold mb-1">Method 1 — TOF + Δh</h3>
            {method1 ? (
              <ul className="text-sm text-gray-200 space-y-1">
                <li><span className="text-gray-400">T (free-fall):</span> {method1.T.toFixed(3)} s</li>
                <li><span className="text-gray-400">Δh (catch−release):</span> {method1.dH.toFixed(3)} m</li>
                <li><span className="text-gray-400">v₀ (inferred):</span> {method1.v0.toFixed(3)} m/s</li>
                <li className="text-lg"><span className="text-gray-400">Height h:</span> <b>{method1.h.toFixed(3)} m</b></li>
              </ul>
            ) : <p className="text-sm text-gray-300">Insufficient data.</p>}
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="font-semibold mb-1">Method 2 — Launch impulse</h3>
            {method2 ? (
              <ul className="text-sm text-gray-200 space-y-1">
                <li><span className="text-gray-400">Window:</span> {method2.span.toFixed(3)} s pre-release</li>
                <li><span className="text-gray-400">v₀ (from ∫a_lin):</span> {method2.v0.toFixed(3)} m/s</li>
                <li className="text-lg"><span className="text-gray-400">Height h:</span> <b>{method2.h.toFixed(3)} m</b></li>
              </ul>
            ) : <p className="text-sm text-gray-300">Insufficient data.</p>}
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="font-semibold mb-1">Method 3 — Full trajectory (ZUPT)</h3>
            {method3 ? (
              <ul className="text-sm text-gray-200 space-y-1">
                <li><span className="text-gray-400">Δh (catch−release):</span> {method3.dH.toFixed(3)} m</li>
                <li className="text-lg"><span className="text-gray-400">Height h:</span> <b>{method3.h.toFixed(3)} m</b></li>
              </ul>
            ) : <p className="text-sm text-gray-300">Insufficient data.</p>}
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="font-semibold mb-1">Method 4 — Falling-phase duration</h3>
            {method4 ? (
              <ul className="text-sm text-gray-200 space-y-1">
                <li><span className="text-gray-400">Source v₀:</span> {method4.src}</li>
                <li><span className="text-gray-400">v₀:</span> {method4.v0.toFixed(3)} m/s</li>
                <li><span className="text-gray-400">t↑ = v₀/g:</span> {method4.tUp.toFixed(3)} s</li>
                <li><span className="text-gray-400">T (free-fall):</span> {method4.T.toFixed(3)} s</li>
                <li><span className="text-gray-400">t_fall (descend):</span> {method4.tFall.toFixed(3)} s</li>
                <li className="text-lg"><span className="text-gray-400">Height h:</span> <b>{method4.h.toFixed(3)} m</b></li>
                {method4.tFallAlt!==null && <li><span className="text-gray-400">t_fall (Δh cross-check):</span> {(method4.tFallAlt as number).toFixed(3)} s</li>}
              </ul>
            ) : <p className="text-sm text-gray-300">Need a v₀ estimate (Method 1 or 2).</p>}
          </div>
        </div>
      )}

      {diag.ok && (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="font-semibold mb-2">Diagnostics</h3>
          <ul className="text-sm text-gray-300 grid md:grid-cols-2 gap-y-1">
            <li>Detected free-fall: {diag.free.t0.toFixed(3)}s → {diag.free.t1.toFixed(3)}s ({(diag.T).toFixed(3)} s)</li>
            <li>Stationary span used: {diag.stat.t0.toFixed(3)}s → {diag.stat.t1.toFixed(3)}s</li>
            <li>dt_mean: {diag.dtMean.toFixed(3)} s | |a_lin| thr: {diag.thr.thALin.toFixed(2)} m/s² | |ω| thr: {diag.thr.thOmega.toFixed(1)} deg/s</li>
            <li>|a_tot| valley thr: {(diag.thr.thTot).toFixed(2)} m/s² | jerk thr: {diag.thr.thJerk.toFixed(1)} m/s³</li>
          </ul>
        </div>
      )}

      <div className="grid xl:grid-cols-2 gap-4">
        {worldOmegas && worldOmegas.length > 0 && (
          <Plot 
            x={t} 
            y={omegaMagAligned} 
            title="Gyroscope magnitude (aligned)" 
            xlab="time (s)" 
            ylab="deg/s" 
            highlight={detect.ok ? detect.free : undefined} 
            threshold={thr.thOmega} 
            metrics={["Mask: |ω| < adaptive threshold"]}
            highlight2={method4 ? { i0: method4.iFall0, i1: method4.iFall1 } : undefined}
          />
        )}
        <Plot 
          x={t} 
          y={aLinMagRaw} 
          title="|a_lin^w|(raw)" 
          xlab="time (s)" 
          ylab="m/s²" 
          highlight={detect.ok ? detect.free : undefined} 
          threshold={thr.thALin}
          metrics={["Mask: |a_lin| < adaptive threshold"]}
          highlight2={method4 ? { i0: method4.iFall0, i1: method4.iFall1 } : undefined}
        />
        <Plot 
          x={t} 
          y={aTotMag} 
          title="|a_total^w| (valley near 0 in free-fall)" 
          xlab="time (s)" 
          ylab="m/s²" 
          highlight={detect.ok ? detect.free : undefined} 
          threshold={thr.thTot}
          metrics={[`Thr = ${totValleyFracG}·g`]}
          highlight2={method4 ? { i0: method4.iFall0, i1: method4.iFall1 } : undefined}
        />
        <Plot 
          x={t} 
          y={jerkMag} 
          title="jerk = d/dt |a_lin| (release/catch hints)" 
          xlab="time (s)" 
          ylab="m/s³" 
          highlight={detect.ok ? detect.free : undefined} 
          threshold={thr.thJerk}
          highlight2={method4 ? { i0: method4.iFall0, i1: method4.iFall1 } : undefined}
        />
        {integ && (
          <Plot x={t.slice(integ.i0, integ.i1 + 1)} y={integ.vCorr} title="v_z(t) after bias removal" xlab="time (s) in window" ylab="m/s" />
        )}
        {integ && (
          <Plot x={t.slice(integ.i0, integ.i1 + 1)} y={integ.zCorr} title="z(t) after bias removal" xlab="time (s) in window" ylab="m" />
        )}
      </div>

      <div className="text-xs text-gray-400">
        Tips: If signs are inverted, flip gravity direction or invert z before analysis. You can also override thresholds via props, but the adaptive defaults are tuned to handle very short throws.
      </div>
    </div>
  )
}

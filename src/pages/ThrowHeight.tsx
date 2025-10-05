import { useMemo } from 'react'

/// Unused helper function
// const integrateTrap = (y: number[], t: number[], i0 = 0, i1 = y.length - 1, y0 = 0) => {
//   const out: number[] = new Array(i1 - i0 + 1)
//   out[0] = y0
//   for (let i = i0 + 1; i <= i1; i++) {
//     const dt = t[i] - t[i - 1]
//     out[i - i0] = out[i - i0 - 1] + 0.5 * (y[i - 1] + y[i]) * dt
//   }
//   return out
// }======================================================
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

// Unused helper function
// const MAD = (arr: number[]) => {
//   if (!arr.length) return 0
//   const med = quantile(arr, 0.5)
//   const dev = arr.map(v => Math.abs(v - med))
//   const mad = quantile(dev, 0.5)
//   return 1.4826 * mad // Gaussian consistency
// }

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
function _morphCloseOpen(mask: boolean[], closeGapsN: number, openIslandsN: number) {
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
// Unused helper function
// const alignSeries = (src: Sample[], tTarget: number[]) => {
//   if (!src.length || !tTarget.length) return []
//   const out: Sample[] = new Array(tTarget.length)
//   let j = 0
//   for (let i = 0; i < tTarget.length; i++) {
//     const tNow = tTarget[i]
//     while (j < src.length - 1 && src[j + 1].t <= tNow) j++
//     if (j >= src.length - 1) {
//       out[i] = src[src.length - 1]
//     } else {
//       const a = src[j], b = src[j + 1]
//       const alpha = (tNow - a.t) / (b.t - a.t)
//       out[i] = { t: tNow, x: a.x + alpha * (b.x - a.x), y: a.y + alpha * (b.y - a.y), z: a.z + alpha * (b.z - a.z) }
//     }
//   }
//   return out
// }

// Helper for finding stationary windows around a free-fall span
const _findStationaryWindows = (
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
  // thresholds (may be auto-tuned)
  freeFallALinThresh = 0.6,   // fallback accel-only detector
  minFreeFallMs = 80,         // allow short throws
  // stationaryWindowMs = 250,  // unused parameter
  launchWindowMs = 200,
}: ThrowHeightProps) {
  // ---- early outs ----
  if (!worldAccels || worldAccels.length < 8) {
    return (
      <div className="p-6 bg-gray-900 text-white rounded-xl">
        <h2 className="text-xl font-bold mb-1">Throw height</h2>
        <p>Not enough samples — record first, then open this analyzer.</p>
      </div>
    )
  }

  // ================= helpers =================
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
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
  const hypot3 = (x:number,y:number,z:number)=> Math.hypot(x,y,z)
  const median = (a:number[]) => { const b=a.slice().sort((x,y)=>x-y); const m=b.length>>1; return b.length? (b.length%2? b[m] : 0.5*(b[m-1]+b[m])):0 }
  const MAD = (a:number[]) => { const m=median(a); return 1.4826*median(a.map(x=>Math.abs(x-m))) }
  const alignSeriesMag = (samples: Sample[], tRef: number[]) => {
    // nearest-neighbor align of |omega| to tRef
    if (!samples.length) return new Array(tRef.length).fill(0)
    const sT = samples.map(s=>s.t)
    const sMag = samples.map(s=>hypot3(s.x||0,s.y||0,s.z||0))
    const out:number[] = new Array(tRef.length)
    let j=0
    for (let i=0;i<tRef.length;i++){
      const ti = tRef[i]
      while(j+1<sT.length && Math.abs(sT[j+1]-ti) <= Math.abs(sT[j]-ti)) j++
      out[i] = sMag[j] || 0
    }
    return out
  }
  const morphCloseOpen = (mask: boolean[], gap=2, island=1) => {
    const n = mask.length
    const out = mask.slice()
    // close: fill small gaps of false between trues
    let i=0
    while(i<n){
      while(i<n && !out[i]) i++
      if(i>=n) break
      let j=i; while(j<n && out[j]) j++
      let k=j; while(k<n && !out[k] && (k-j)<gap) k++
      if(k<n && out[k] && (k-j)<gap) for(let z=j; z<k; z++) out[z]=true
      i=k
    }
    // open: remove tiny true islands
    i=0
    while(i<n){
      while(i<n && out[i]) i++
      let j=i; while(j<n && !out[j]) j++
      let s=j; while(s<n && out[s]) s++
      if((s-j) <= island) for(let z=j; z<s; z++) out[z]=false
      i=s
    }
    return out
  }

  // ================= derive series =================
  const { t, dt, aTotZ, aTotMag, aLinZ, omegaDeg, omegaRad2 } = useMemo(() => {
    const t = worldAccels.map(p => p.t)
    const dt = t.map((v,i)=> i? Math.max(1e-3, v - t[i-1]) : 1e-3)

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
    const aLinX = movingAvg(aLinXraw, smoothN)
    const aLinY = movingAvg(aLinYraw, smoothN)
    const aLinZ = movingAvg(aLinZraw, smoothN)
    const aLinMag = aLinX.map((_,i)=>hypot3(aLinX[i], aLinY[i], aLinZ[i]))

    const omegaDeg = worldOmegas && worldOmegas.length ? alignSeriesMag(worldOmegas, t) : new Array(t.length).fill(0)
    const omegaRad2 = omegaDeg.map(wd => { const w = wd * Math.PI/180; return w*w })

    return { t, dt, aTotX, aTotY, aTotZ, aTotMag, aLinX, aLinY, aLinZ, aLinMag, omegaDeg, omegaRad2 }
  }, [worldAccels, accelerations, worldOmegas, g, smoothN])

  // ================= spin-robust free-fall detector =================
  const detectSpin = useMemo(() => {
    const n = t.length
    if (n < 8) return { ok: false as const, reason: 'Too few samples' }

    // Estimate effective radius rEff via robust slope on the lowest-force tail
    const idx = aTotMag.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]).slice(0, Math.max(5, Math.floor(0.35*n))).map(([,i])=>i)
    let num=0, den=0
    for (const i of idx) { num += omegaRad2[i] * aTotMag[i]; den += omegaRad2[i] * omegaRad2[i] }
    let rEff = den>1e-9 ? num/den : 0
    rEff = clamp(rEff, 0, 0.08) // clamp to 0–8 cm

    // centripetal-compensated residual specific force
    const aFreeMag = aTotMag.map((v,i)=> Math.max(0, v - rEff * omegaRad2[i]))

    // adaptive threshold on residual (lower tail median + 3*MAD)
    const tail = aFreeMag.slice().sort((a,b)=>a-b).slice(0, Math.max(5, Math.floor(0.4*n)))
    const thFree = Math.max(0.15*g, median(tail) + 3*MAD(tail))

    let free = aFreeMag.map(v => v < thFree)
    free = morphCloseOpen(free, 2, 1)

    // choose best run (min mean residual)
    let best = { i0:-1, i1:-1, score: Infinity }
    let i=0
    while(i<n){
      while(i<n && !free[i]) i++
      if (i>=n) break
      const s=i; while(i<n && free[i]) i++; const e=i-1
      let sum=0,cnt=0
      for (let k=s;k<=e;k++){ sum+=aFreeMag[k]; cnt++ }
      const score = sum/Math.max(1,cnt)
      if (score < best.score) best = { i0:s, i1:e, score }
    }
    if (best.i0 < 0) return { ok:false as const, reason: 'No convincing free-fall window (spin-compensated)' }

    // jerk on residual for edge snapping (~40 ms)
    const jerk = aFreeMag.map((v,i)=> i? Math.abs((v - aFreeMag[i-1]) / dt[i]) : 0)
    const snapWin = Math.max(2, Math.round(0.04 / Math.max(1e-3, (t[n-1]-t[0])/(n-1))))
    const snap = (idx:number, dir:-1|1) => {
      let bestI = idx, bestJ = -Infinity
      for (let k=-snapWin; k<=snapWin; k++) {
        const j = clamp(idx + dir*k, 1, n-1)
        if (jerk[j] > bestJ) { bestJ = jerk[j]; bestI = j }
      }
      return bestI
    }
    const iRel = snap(best.i0, -1)
    const iCat = snap(best.i1, +1)

    return { ok: true as const, free: { i0:iRel, i1:iCat, t0: t[iRel], t1: t[iCat] }, aFreeMag, thFree, rEff }
  }, [t, dt, aTotMag, omegaRad2, g])

  // ================ fallback accel-only detector (simple) ================
  const detectAccelOnly = useMemo(() => {
    const n=t.length; const free = new Array(n)
    for (let i=0;i<n;i++) free[i] = (Math.abs(aLinZ[i]) < freeFallALinThresh)
    // longest run
    let best={i0:-1,i1:-1,dur:0}
    let i=0
    while(i<n){
      while(i<n && !free[i]) i++
      if(i>=n) break
      const s=i; while(i<n && free[i]) i++; const e=i-1
      const dur=t[e]-t[s]
      if (dur > best.dur) best={i0:s,i1:e,dur}
    }
    if (best.i0<0 || (best.dur*1000)<minFreeFallMs) return { ok:false as const, reason:'No free-fall (accel-only)'}
    return { ok:true as const, free: { i0:best.i0, i1:best.i1, t0:t[best.i0], t1:t[best.i1] } }
  }, [t, aLinZ, freeFallALinThresh, minFreeFallMs])

  // ================ choose detector =================
  const detect = detectSpin.ok ? detectSpin : (detectAccelOnly.ok ? detectAccelOnly : detectSpin)

  // ================ ZUPT-aided vertical integration =================
  const integ = useMemo(() => {
    if (!detect.ok) return null
    // Use stationary windows around free-fall to correct bias by forcing v_end≈0
    // Here we just use entire recording; you can refine by finding explicit stationary spans.
    const i0 = 0, i1 = t.length - 1
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
    const aLinZLocal = aCorr.map(v => v + g)
    return { i0, i1, t0: tAll[i0], t1: tAll[i1], aCorr, vCorr, zCorr, aLinZLocal }
  }, [detect, aTotZ, t, g])

  // ===================== Method 1 — TOF + Δh =====================
  const method1 = useMemo(() => {
    if (!detect.ok || !integ) return null
    const { i0: s0, zCorr } = integ
    const r0 = detect.free.i0 - s0
    const r1 = detect.free.i1 - s0
    if (r0 < 0 || r1 <= r0 || r1 >= zCorr.length) return null
    const T = (t[detect.free.i1] - t[detect.free.i0])
    const dH = zCorr[r1] - zCorr[r0]
    const v0 = 0.5 * g * T + (dH / T)
    const h = Math.max(0, (v0 * v0) / (2 * g))
    return { T, dH, v0, h, detection: 'spin-compensated residual' }
  }, [detect, integ, g, t])

  // ===================== Method 2 — Launch impulse =====================
  const method2 = useMemo(() => {
    if (!detect.ok || !integ) return null
    const { aLinZLocal, i0: s0, i1: s1 } = integ
    const iRelLocal = detect.free.i0 - s0
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

  // ===================== Method 3 — ZUPT apex =====================
  const method3 = useMemo(() => {
    if (!detect.ok || !integ) return null
    const { vCorr, zCorr, i0: s0 } = integ
    const r0 = detect.free.i0 - s0
    const r1 = detect.free.i1 - s0
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

  // ===================== Method 4 — falling-phase duration =====================
  const method4 = useMemo(() => {
    if (!detect.ok) return null
    const T = detect.free.t1 - detect.free.t0
    let v0: number | null = null
    let src = ''
    if (method2 && Number.isFinite(method2.v0)) { v0 = method2.v0; src='impulse' }
    else if (method1 && Number.isFinite(method1.v0)) { v0 = method1.v0; src='tof+Δh' }
    if (v0 == null) return null
    const tUp = Math.max(0, v0 / g)
    let tFall = Math.max(0, T - tUp)
    let tFallAlt: number | null = null
    if (method1 && Number.isFinite(method1.dH)) {
      const hMax = (v0*v0)/(2*g)
      const D = Math.max(0, hMax - (method1 as any).dH)
      tFallAlt = Math.sqrt(2*D/g)
      if (Number.isFinite(tFallAlt)) {
        const rel = Math.abs(tFallAlt - tFall)/Math.max(1e-6, tFall)
        tFall = rel > 0.25 ? Math.min(tFall, tFallAlt) : 0.5*(tFall + tFallAlt)
      }
    }
    // find index of start of fall (>= apex)
    const tApex = detect.free.t0 + tUp
    let iFall0 = detect.free.i0
    for (let i=detect.free.i0; i<=detect.free.i1; i++){ if (t[i] >= tApex) { iFall0 = i; break } }
    // calculate height from falling duration: h = 0.5 * g * t_fall^2
    const h = Math.max(0, 0.5 * g * tFall * tFall)
    return { T, v0, src, tUp, tFall, tFallAlt, tApex, iFall0, iFall1: detect.free.i1, h }
  }, [detect, method1, method2, t, g])

  // ===================== Diagnostics for UI =====================
  const diag = useMemo(() => {
    if (!detect.ok) return { ok:false as const, reason: (detect as any).reason }
    const T = detect.free.t1 - detect.free.t0
    return { ok:true as const, T, free: detect.free, rEff: (detect as any).rEff ?? null, thFree: (detect as any).thFree ?? null }
  }, [detect])

  // ===================== simple plots =====================
  function Plot({ x, y, title, xlab, ylab, highlight, threshold, metrics, highlight2 }: { 
    x: number[]; y: number[]; title: string; xlab: string; ylab: string; 
    highlight?: { i0: number; i1: number }; threshold?: number; metrics?: string[]; highlight2?: { i0:number; i1:number }
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
        {threshold!==undefined && threshold>=minY && threshold<=maxY && (
          <>
            <line x1={m.l} y1={sy(threshold)} x2={m.l+W} y2={sy(threshold)} stroke="#ff0000" strokeWidth={1} strokeDasharray="4,2"/>
            <text x={m.l+W-5} y={sy(threshold)-3} fontSize={10} fill="#ff0000" textAnchor="end">{threshold.toFixed(2)}</text>
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

  // ===================== UI =====================
  return (
    <div className="p-6 bg-gray-900 text-white rounded-2xl space-y-4">
      <h2 className="text-2xl font-bold">Throw height (spin‑robust offline analysis)</h2>

      {!diag.ok && (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">{(diag as any).reason || 'Detection failed'}</div>
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
                {method4.tFallAlt!==null && <li><span className="text-gray-400">t_fall (Δh check):</span> {(method4.tFallAlt as number).toFixed(3)} s</li>}
                <li className="text-lg"><span className="text-gray-400">Height h:</span> <b>{method4.h.toFixed(3)} m</b></li>
              </ul>
            ) : <p className="text-sm text-gray-300">Need a v₀ estimate.</p>}
          </div>
        </div>
      )}

      {diag.ok && (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="font-semibold mb-2">Diagnostics</h3>
          <ul className="text-sm text-gray-300 grid md:grid-cols-2 gap-y-1">
            <li>Detected free-fall: {diag.free.t0.toFixed(3)}s → {diag.free.t1.toFixed(3)}s ({diag.T.toFixed(3)} s)</li>
            {diag.rEff!==null && <li>Spin compensation: r_eff ≈ {(diag.rEff*100).toFixed(1)} cm</li>}
            {diag.thFree!==null && <li>Residual threshold: {(diag.thFree as number).toFixed(2)} m/s²</li>}
          </ul>
        </div>
      )}

      <div className="grid xl:grid-cols-2 gap-4">
        <Plot 
          x={t} 
          y={aTotMag} 
          title="|a_total^w|(t)" 
          xlab="time (s)" 
          ylab="m/s²" 
          highlight={detect.ok ? detect.free : undefined}
          metrics={["Includes gravity & spin (centripetal)"]}
        />
        {worldOmegas && worldOmegas.length > 0 && (
          <Plot 
            x={t} 
            y={omegaDeg} 
            title="|ω|(t) (deg/s) aligned" 
            xlab="time (s)" 
            ylab="deg/s" 
            highlight={detect.ok ? detect.free : undefined}
          />
        )}
        {detectSpin.ok && (
          <Plot 
            x={t} 
            y={(detectSpin as any).aFreeMag} 
            title="Residual |a| after spin compensation" 
            xlab="time (s)" 
            ylab="m/s²" 
            highlight={detect.free}
            threshold={(detectSpin as any).thFree}
            metrics={[`r_eff≈${((detectSpin as any).rEff*100).toFixed(1)} cm`, `thr≈${((detectSpin as any).thFree).toFixed(2)} m/s²`]}
            highlight2={method4 ? { i0: method4.iFall0, i1: method4.iFall1 } : undefined}
          />
        )}
        {integ && (
          <Plot x={t.slice(integ.i0, integ.i1 + 1)} y={integ.vCorr} title="v_z(t) after bias removal" xlab="time (s) in window" ylab="m/s" />
        )}
        {integ && (
          <Plot x={t.slice(integ.i0, integ.i1 + 1)} y={integ.zCorr} title="z(t) after bias removal" xlab="time (s) in window" ylab="m" />
        )}
      </div>

      <div className="text-xs text-gray-400">
        Notes: world-frame rotation does not remove spin; centripetal specific force grows like |ω|²·r. We estimate an effective radius per throw and detect free-fall on the spin‑compensated residual. Use the residual only for detection; keep raw vectors for integration.
      </div>
    </div>
  )
}

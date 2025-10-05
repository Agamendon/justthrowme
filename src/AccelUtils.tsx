// utils.tsx
import { useCallback, useEffect, useRef, useState } from "react"

/** ------------------------- Types ------------------------- */
export type Sample = { t: number; x: number; y: number; z: number }

export type RecordData = {
  worldAccels: Sample[]     // total accel in world frame (includes gravity)
  worldOmegas: Sample[]     // angular velocity in world frame (deg/s)
  orientations: Array<{ t: number; alpha: number; beta: number; gamma: number }>
  deviceAccels: Sample[]    // device-frame linear accel (excludes gravity) if present, else zeros
  deviceAccelG: Sample[]    // device-frame accel incl. gravity, if present
}

/** ------------------------- Math helpers ------------------------- */
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const deg2rad = (d: number) => d * Math.PI / 180
export const hypot3 = (x: number, y: number, z: number) => Math.hypot(x, y, z)
const median = (arr: number[]) => {
  const a = arr.slice().sort((x, y) => x - y)
  const m = a.length >> 1
  return a.length ? (a.length % 2 ? a[m] : 0.5 * (a[m - 1] + a[m])) : 0
}
const MAD = (arr: number[]) => { // robust stddev
  const m = median(arr)
  return 1.4826 * median(arr.map(x => Math.abs(x - m)))
}
const movingAvg = (arr: number[], win: number) => {
  if (win <= 1) return arr.slice()
  const out = new Array(arr.length)
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
    if (i - win >= 0) sum -= arr[i - win]
    const n = i < win - 1 ? i + 1 : win
    out[i] = sum / n
  }
  return out
}
const integrateTrap = (y: number[], t: number[], i0 = 0, i1 = y.length - 1, y0 = 0) => {
  const out = new Array(i1 - i0 + 1)
  out[0] = y0
  for (let i = i0 + 1; i <= i1; i++) {
    const dt = Math.max(0, t[i] - t[i - 1])
    out[i - i0] = out[i - i0 - 1] + 0.5 * (y[i - 1] + y[i]) * dt
  }
  return out
}

/** ------------------------- Orientation helpers ------------------------- */
// R = Rz(alpha) * Rx(beta) * Ry(gamma)  (alpha=z, beta=x, gamma=y) — same convention you used
export function eulerToR(alpha: number, beta: number, gamma: number) {
  const cA = Math.cos(alpha), sA = Math.sin(alpha)
  const cB = Math.cos(beta),  sB = Math.sin(beta)
  const cG = Math.cos(gamma), sG = Math.sin(gamma)
  const Rz = [[ cA, -sA, 0],[ sA,  cA, 0],[  0,   0, 1]]
  const Rx = [[1, 0, 0],[0, cB,-sB],[0, sB, cB]]
  const Ry = [[ cG, 0, sG],[  0, 1,  0],[-sG, 0, cG]]
  const RzRx = [
    [ Rz[0][0]*Rx[0][0] + Rz[0][1]*Rx[1][0] + Rz[0][2]*Rx[2][0],
      Rz[0][0]*Rx[0][1] + Rz[0][1]*Rx[1][1] + Rz[0][2]*Rx[2][1],
      Rz[0][0]*Rx[0][2] + Rz[0][1]*Rx[1][2] + Rz[0][2]*Rx[2][2] ],
    [ Rz[1][0]*Rx[0][0] + Rz[1][1]*Rx[1][0] + Rz[1][2]*Rx[2][0],
      Rz[1][0]*Rx[0][1] + Rz[1][1]*Rx[1][1] + Rz[1][2]*Rx[2][1],
      Rz[1][0]*Rx[0][2] + Rz[1][1]*Rx[1][2] + Rz[1][2]*Rx[2][2] ],
    [ Rz[2][0]*Rx[0][0] + Rz[2][1]*Rx[1][0] + Rz[2][2]*Rx[2][0],
      Rz[2][0]*Rx[0][1] + Rz[2][1]*Rx[1][1] + Rz[2][2]*Rx[2][1],
      Rz[2][0]*Rx[0][2] + Rz[2][1]*Rx[1][2] + Rz[2][2]*Rx[2][2] ],
  ] as number[][]
  return [
    [ RzRx[0][0]*Ry[0][0] + RzRx[0][1]*Ry[1][0] + RzRx[0][2]*Ry[2][0],
      RzRx[0][0]*Ry[0][1] + RzRx[0][1]*Ry[1][1] + RzRx[0][2]*Ry[2][1],
      RzRx[0][0]*Ry[0][2] + RzRx[0][1]*Ry[1][2] + RzRx[0][2]*Ry[2][2] ],
    [ RzRx[1][0]*Ry[0][0] + RzRx[1][1]*Ry[1][0] + RzRx[1][2]*Ry[2][0],
      RzRx[1][0]*Ry[0][1] + RzRx[1][1]*Ry[1][1] + RzRx[1][2]*Ry[2][1],
      RzRx[1][0]*Ry[0][2] + RzRx[1][1]*Ry[1][2] + RzRx[1][2]*Ry[2][2] ],
    [ RzRx[2][0]*Ry[0][0] + RzRx[2][1]*Ry[1][0] + RzRx[2][2]*Ry[2][0],
      RzRx[2][0]*Ry[0][1] + RzRx[2][1]*Ry[1][1] + RzRx[2][2]*Ry[2][1],
      RzRx[2][0]*Ry[0][2] + RzRx[2][1]*Ry[1][2] + RzRx[2][2]*Ry[2][2] ],
  ] as number[][]
}
export function mulMatVec(R: number[][], v: [number, number, number]) {
  return [
    R[0][0]*v[0] + R[0][1]*v[1] + R[0][2]*v[2],
    R[1][0]*v[0] + R[1][1]*v[1] + R[1][2]*v[2],
    R[2][0]*v[0] + R[2][1]*v[1] + R[2][2]*v[2],
  ] as [number, number, number]
}

/** ------------------------- Sensors hook ------------------------- */
/**
 * Hook to collect world-frame acceleration (including gravity) and world-frame gyro.
 * Keeps raw device-frame channels too. Call start(), then stop() to get arrays.
 */
export function useSensorRecorder(g = 9.80665) {
  const [listening, setListening] = useState(false)
  const [recording, setRecording] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [data, setData] = useState<RecordData | null>(null)

  const cleanupRef = useRef<null | (() => void)>(null)
  const orientationRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null)
  const startTsRef = useRef<number | null>(null)
  
  const buffersRef = useRef<RecordData>({
    worldAccels: [],
    worldOmegas: [],
    orientations: [],
    deviceAccels: [],
    deviceAccelG: [],
  })

  // expose a cheap snapshot (shallow copies are fine for read-only analysis)
  const snapshot = useCallback((): RecordData => {
    const B = buffersRef.current
    return {
      worldAccels: B.worldAccels.slice(),
      worldOmegas: B.worldOmegas.slice(),
      orientations: B.orientations.slice(),
      deviceAccels: B.deviceAccels.slice(),
      deviceAccelG: B.deviceAccelG.slice(),
    }
  }, [])
  
  const start = useCallback(async () => {
    setPermissionError(null)
    setData(null)

    try {
      const dm: any = (window as any).DeviceMotionEvent
      const dor: any = (window as any).DeviceOrientationEvent
      const needsPermission = (dm && typeof dm.requestPermission === "function") ||
                              (dor && typeof dor.requestPermission === "function")

      if (needsPermission) {
        const reqs: Promise<string>[] = []
        if (dm?.requestPermission) reqs.push(dm.requestPermission())
        if (dor?.requestPermission) reqs.push(dor.requestPermission())
        const results = await Promise.allSettled(reqs)
        const ok = results.some(r => r.status === "fulfilled" && r.value === "granted")
        if (!ok) throw new Error("Motion/Orientation permission was not granted")
      }

      // reset buffers
      buffersRef.current = { worldAccels: [], worldOmegas: [], orientations: [], deviceAccels: [], deviceAccelG: [] }
      startTsRef.current = null

      const onMotion = (e: DeviceMotionEvent) => {
        const now = performance.now()
        if (startTsRef.current == null) startTsRef.current = now
        const t = (now - startTsRef.current) / 1000

        const a = e.acceleration
        const ag = e.accelerationIncludingGravity
        const rr = e.rotationRate

        if (a) buffersRef.current.deviceAccels.push({ t, x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 })
        if (ag) buffersRef.current.deviceAccelG.push({ t, x: ag.x ?? 0, y: ag.y ?? 0, z: ag.z ?? 0 })

        // orientation → world transform
        if (orientationRef.current) {
          const { alpha, beta, gamma } = orientationRef.current
          const R = eulerToR(deg2rad(alpha), deg2rad(beta), deg2rad(gamma))

          // accel (prefer linear; else a_g)
          let aWorldTotal: [number, number, number] | null = null
          if (a && (a.x != null || a.y != null || a.z != null)) {
            const aDev: [number, number, number] = [a.x ?? 0, a.y ?? 0, a.z ?? 0]
            const aWorld = mulMatVec(R, aDev)
            const gWorld: [number, number, number] = [0, 0, -g]
            aWorldTotal = [aWorld[0] + gWorld[0], aWorld[1] + gWorld[1], aWorld[2] + gWorld[2]]
          } else if (ag && (ag.x != null || ag.y != null || ag.z != null)) {
            const aGDev: [number, number, number] = [ag.x ?? 0, ag.y ?? 0, ag.z ?? 0]
            aWorldTotal = mulMatVec(R, aGDev)
          }
          if (aWorldTotal) buffersRef.current.worldAccels.push({ t, x: aWorldTotal[0], y: aWorldTotal[1], z: aWorldTotal[2] })

          // gyro
          if (rr) {
            const wDev: [number, number, number] = [rr.beta ?? 0, rr.gamma ?? 0, rr.alpha ?? 0]
            const wWorld = mulMatVec(R, wDev)
            buffersRef.current.worldOmegas.push({ t, x: wWorld[0], y: wWorld[1], z: wWorld[2] })
          }
        }
      }

      const onOrientation = (e: DeviceOrientationEvent) => {
        const a = e.alpha ?? null, b = e.beta ?? null, c = e.gamma ?? null
        if (a != null && b != null && c != null) {
          orientationRef.current = { alpha: a, beta: b, gamma: c }
          if (startTsRef.current == null) startTsRef.current = performance.now()
          const t = (performance.now() - startTsRef.current) / 1000
          buffersRef.current.orientations.push({ t, alpha: a, beta: b, gamma: c })
        }
      }

      window.addEventListener("devicemotion", onMotion)
      window.addEventListener("deviceorientation", onOrientation)

      cleanupRef.current = () => {
        window.removeEventListener("devicemotion", onMotion)
        window.removeEventListener("deviceorientation", onOrientation)
      }

      setListening(true)
      setRecording(true)
    } catch (err: any) {
      setPermissionError(err?.message || String(err))
      setListening(false)
      setRecording(false)
    }
  }, [g])

  const stop = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    setListening(false)
    setRecording(false)
    setData(snapshot()) // capture final arrays
  }, [snapshot])

  const reset = useCallback(() => setData(null), [])

  useEffect(() => () => { cleanupRef.current?.() }, [])

  return { listening, recording, permissionError, data, start, stop, reset, snapshot }
}

/** ------------------------- Free-fall detection (spin-robust) ------------------------- */
/**
 * Detect free-fall window, robust to spin: estimates r_eff and thresholds residual |a|.
 * Returns indices/time of release & catch inside worldAccels timeline.
 */
export function detectFreeFallSpinRobust(
  worldAccels: Sample[],
  worldOmegas?: Sample[],
  g = 9.80665,
  smoothN = 5
): { ok: true, i0: number, i1: number, t0: number, t1: number, rEff: number, thFree: number, aFreeMag: number[], t: number[] }
 | { ok: false, reason: string } {

  if (!worldAccels.length) return { ok: false, reason: 'No acceleration samples' }
  const t = worldAccels.map(p => p.t)
  const n = t.length
  const aTotX = movingAvg(worldAccels.map(p => p.x), smoothN)
  const aTotY = movingAvg(worldAccels.map(p => p.y), smoothN)
  const aTotZ = movingAvg(worldAccels.map(p => p.z), smoothN)
  const aTotMag = aTotX.map((_, i) => hypot3(aTotX[i], aTotY[i], aTotZ[i]))

  // align |ω| to t (nearest-neighbor)
  let omegaDegMag: number[] = new Array(n).fill(0)
  if (worldOmegas && worldOmegas.length) {
    const ts = worldOmegas.map(s => s.t)
    const mags = worldOmegas.map(s => hypot3(s.x || 0, s.y || 0, s.z || 0))
    let j = 0
    for (let i = 0; i < n; i++) {
      const ti = t[i]
      while (j + 1 < ts.length && Math.abs(ts[j + 1] - ti) <= Math.abs(ts[j] - ti)) j++
      omegaDegMag[i] = mags[j]
    }
    omegaDegMag = movingAvg(omegaDegMag, smoothN)
  }
  const omegaRad2 = omegaDegMag.map(wd => { const w = deg2rad(wd); return w*w })

  // estimate r_eff from lowest-force tail: slope of y (~|a|) vs x (|ω|^2)
  const idx = aTotMag.map((v, i) => [v, i] as const)
                     .sort((a, b) => a[0] - b[0])
                     .slice(0, Math.max(5, Math.floor(0.35 * n)))
                     .map(([, i]) => i)
  let num = 0, den = 0
  for (const i of idx) { num += omegaRad2[i] * aTotMag[i]; den += omegaRad2[i] * omegaRad2[i] }
  let rEff = den > 1e-9 ? num / den : 0
  rEff = clamp(rEff, 0, 0.08) // meters (0–8 cm clamp)

  const aFreeMag = aTotMag.map((v, i) => Math.max(0, v - rEff * omegaRad2[i]))

  // adaptive threshold on residual (lower tail median + 3*MAD) with floor
  const tail = aFreeMag.slice().sort((a, b) => a - b).slice(0, Math.max(5, Math.floor(0.4 * n)))
  const thFree = Math.max(0.15 * g, median(tail) + 3 * MAD(tail)) // ~0.15–0.35 g typical

  // binary mask + small morphology
  let mask = aFreeMag.map(v => v < thFree)
  const morph = (m: boolean[], gap = 2, island = 1) => {
    const out = m.slice(), N = out.length
    // close: fill ≤gap false between trues
    let i = 0
    while (i < N) {
      while (i < N && !out[i]) i++
      if (i >= N) break
      let j = i; while (j < N && out[j]) j++
      let k = j; while (k < N && !out[k] && (k - j) < gap) k++
      if (k < N && out[k] && (k - j) < gap) for (let z = j; z < k; z++) out[z] = true
      i = k
    }
    // open: remove ≤island true runs
    i = 0
    while (i < N) {
      while (i < N && out[i]) i++
      let j = i; while (j < N && !out[j]) j++
      let s = j; while (s < N && out[s]) s++
      if ((s - j) <= island) for (let z = j; z < s; z++) out[z] = false
      i = s
    }
    return out
  }
  mask = morph(mask, 2, 1)

  // choose best run (min mean residual)
  let best = { i0: -1, i1: -1, score: Number.POSITIVE_INFINITY }
  let i = 0
  while (i < n) {
    while (i < n && !mask[i]) i++
    if (i >= n) break
    const s = i; while (i < n && mask[i]) i++; const e = i - 1
    let sum = 0, cnt = 0
    for (let k = s; k <= e; k++) { sum += aFreeMag[k]; cnt++ }
    const sc = sum / Math.max(1, cnt)
    if (sc < best.score) best = { i0: s, i1: e, score: sc }
  }
  if (best.i0 < 0) return { ok: false, reason: 'No convincing free-fall (spin-compensated)' }

  // jerk-based edge snap (~40 ms)
  const dtAvg = (t[n - 1] - t[0]) / Math.max(1, (n - 1))
  const snapWin = Math.max(2, Math.round(0.04 / Math.max(1e-3, dtAvg)))
  const jerk = aFreeMag.map((v, i) => i ? Math.abs((v - aFreeMag[i - 1]) / Math.max(1e-3, t[i] - t[i - 1])) : 0)
  const snap = (idx: number, dir: -1 | 1) => {
    let bestI = idx, bestJ = -Infinity
    for (let k = -snapWin; k <= snapWin; k++) {
      const j = clamp(idx + dir * k, 1, n - 1)
      if (jerk[j] > bestJ) { bestJ = jerk[j]; bestI = j }
    }
    return bestI
  }
  const i0 = snap(best.i0, -1)
  const i1 = snap(best.i1, +1)

  return { ok: true, i0, i1, t0: t[i0], t1: t[i1], rEff, thFree, aFreeMag, t }
}

/** ------------------------- Stationary windows (optional) ------------------------- */
export function findStationaryWindows(
  t: number[],
  freeI0: number,
  freeI1: number,
  statMask: boolean[],
  stationaryWindowMs = 250
) {
  const need = stationaryWindowMs / 1000
  let s0 = freeI0 - 1, acc = 0, j = freeI0
  while (j > 0 && acc < need) { if (statMask[j - 1]) acc += Math.max(0, t[j] - t[j - 1]); else acc = 0; j-- }
  s0 = clamp(j, 0, freeI0 - 1)

  let s1 = freeI1 + 1; acc = 0; j = freeI1
  while (j < t.length - 1 && acc < need) { if (statMask[j + 1]) acc += Math.max(0, t[j + 1] - t[j]); else acc = 0; j++ }
  s1 = clamp(j, freeI1 + 1, t.length - 1)

  return { i0: s0, i1: s1, t0: t[s0], t1: t[s1] }
}

/** ------------------------- Method 1 (TOF + Δh) ------------------------- */
/**
 * Height via Method 1:
 * 1) Detect free-fall window (spin-robust).
 * 2) ZUPT-style constant-bias removal on a_z^tot to get v_z(t), z(t).
 * 3) Compute T = t1 - t0, Δh = z[r1] - z[r0], then:
 *    v0 = 0.5*g*T + Δh/T,  h = v0^2/(2g).
 */
export function computeHeightMethod1(
  input: {
    worldAccels: Sample[]
    worldOmegas?: Sample[]
    g?: number
    smoothN?: number
    // tuning (optional)
    stationaryALinThresh?: number   // m/s²
    stationaryWindowMs?: number
  }
): {
  ok: true,
  h: number,
  v0: number,
  T: number,
  dH: number,
  indices: { release: number, catch: number },
  diag: { rEff: number, thFree: number, bias: number }
} | { ok: false, reason: string } {

  const g = input.g ?? 9.80665
  const smoothN = input.smoothN ?? 5
  // const stationaryALinThresh = input.stationaryALinThresh ?? 0.5
  // const stationaryWindowMs = input.stationaryWindowMs ?? 250

  const A = input.worldAccels
  if (!A || A.length < 8) return { ok: false, reason: 'Not enough acceleration samples' }

  // 1) detect free-fall
  const det = detectFreeFallSpinRobust(A, input.worldOmegas, g, smoothN)
  if (!det.ok) return { ok: false, reason: det.reason }
  const t = A.map(s => s.t)

  // 2) ZUPT-like bias removal using stationary windows around throw
  const aTotZ = movingAvg(A.map(s => s.z), smoothN) // includes gravity
  // linear accel in world z for stationary mask
  // const aLinZ = aTotZ.map(v => v + g)

  // const stat = findStationaryWindows(t, det.i0, det.i1, aLinZ.map(v => Math.abs(v) < stationaryALinThresh), stationaryWindowMs)
  const s0 = 0, s1 = t.length - 1 // (safe default: whole span)
  // integrate on whole span, then remove constant accel bias so v_end≈0
  const vRaw = integrateTrap(aTotZ, t, s0, s1, 0)
  const vEnd = vRaw[vRaw.length - 1]
  const Tspan = Math.max(1e-6, t[s1] - t[s0])
  const bias = vEnd / Tspan
  const aCorr: number[] = []
  for (let i = s0; i <= s1; i++) aCorr.push(aTotZ[i] - bias)
  const vCorr = integrateTrap(aCorr, t, 0, aCorr.length - 1, 0)
  const zCorr = integrateTrap(vCorr, t.slice(s0, s1 + 1), 0, vCorr.length - 1, 0)

  const r0 = det.i0 - s0
  const r1 = det.i1 - s0
  if (r0 < 0 || r1 <= r0 || r1 >= zCorr.length) return { ok: false, reason: 'Indices out of range after integration' }

  // 3) TOF + Δh
  const Tfree = t[det.i1] - t[det.i0]
  const dH = zCorr[r1] - zCorr[r0]
  const v0 = 0.5 * g * Tfree + (dH / Math.max(1e-9, Tfree))
  const h = Math.max(0, (v0 * v0) / (2 * g))

  return {
    ok: true,
    h, v0, T: Tfree, dH,
    indices: { release: det.i0, catch: det.i1 },
    diag: { rEff: det.rEff, thFree: det.thFree, bias }
  }
}

/** ------------------------- Convenience: compute from recorder data ------------------------- */
export function computeHeightMethod1FromRecord(
  data: RecordData,
  options?: Parameters<typeof computeHeightMethod1>[0]
) {
  return computeHeightMethod1({
    worldAccels: data.worldAccels,
    worldOmegas: data.worldOmegas,
    g: options?.g,
    smoothN: options?.smoothN,
    stationaryALinThresh: options?.stationaryALinThresh,
    stationaryWindowMs: options?.stationaryWindowMs,
  })
}

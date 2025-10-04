import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ThrowHeight from './ThrowHeight'

// ===== Helpers for orientation adjustment =====
function deg2rad(d: number) { return d * Math.PI / 180 }
function eulerToR(alpha: number, beta: number, gamma: number) {
  const cA = Math.cos(alpha), sA = Math.sin(alpha)
  const cB = Math.cos(beta),  sB = Math.sin(beta)
  const cG = Math.cos(gamma), sG = Math.sin(gamma)
  // R = Rz(alpha) * Rx(beta) * Ry(gamma)
  const Rz = [
    [ cA, -sA, 0],
    [ sA,  cA, 0],
    [  0,   0, 1],
  ]
  const Rx = [
    [1, 0, 0],
    [0, cB,-sB],
    [0, sB, cB],
  ]
  const Ry = [
    [ cG, 0, sG],
    [  0, 1,  0],
    [-sG, 0, cG],
  ]
  // Rz*Rx
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
  // (Rz*Rx)*Ry
  const R = [
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
  return R
}
function mulMatVec(R: number[][], v: [number, number, number]) {
  return [
    R[0][0]*v[0] + R[0][1]*v[1] + R[0][2]*v[2],
    R[1][0]*v[0] + R[1][1]*v[1] + R[1][2]*v[2],
    R[2][0]*v[0] + R[2][1]*v[1] + R[2][2]*v[2],
  ] as [number, number, number]
}

// ===== Original types =====
type Triplet = { x: number | null; y: number | null; z: number | null }
type Orientation = { alpha: number | null; beta: number | null; gamma: number | null; absolute?: boolean }

function formatNum(v: number | null | undefined, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '--'
  const n = Number(v)
  if (!Number.isFinite(n)) return '--'
  return n.toFixed(digits)
}

export function Main() {
  const [orientation, setOrientation] = useState<Orientation>({ alpha: null, beta: null, gamma: null })
  const [accel, setAccel] = useState<Triplet>({ x: null, y: null, z: null })
  const [accelG, setAccelG] = useState<Triplet>({ x: null, y: null, z: null })
  const [rotationRate, setRotationRate] = useState<{ alpha: number | null; beta: number | null; gamma: number | null }>({ alpha: null, beta: null, gamma: null })
  const [interval, setIntervalMs] = useState<number | null>(null)
  const [_samples, _setSamples] = useState<number>(0)
  const [listening, setListening] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  const [recording, setRecording] = useState(false)
  const [currentSpeed, setCurrentSpeed] = useState<number>(0)
  const [speedSeries, setSpeedSeries] = useState<Array<{ t: number; v: number }>>([])
  const [velocities, setVelocities] = useState<Array<{ t: number; x: number; y: number; z: number }>>([])
  const [accelerations, setAccelerations] = useState<Array<{ t: number; x: number; y: number; z: number }>>([])
  const [angles, setAngles] = useState<Array<{ alpha: number; beta: number; gamma: number }>>([])
  const [recordSummary, setRecordSummary] = useState<{ durationMs: number; points: number } | null>(null)

  // NEW: world-frame angular velocity series (orientation-adjusted rotation vectors)
  const [worldOmegas, setWorldOmegas] = useState<Array<{ t: number; x: number; y: number; z: number }>>([])
  const [omegaWorldLatest, setOmegaWorldLatest] = useState<Triplet>({ x: null, y: null, z: null })

  // NEW: world-frame total acceleration (orientation-adjusted acceleration including gravity)
  const [worldAccels, setWorldAccels] = useState<Array<{ t: number; x: number; y: number; z: number }>>([])
  const [accelWorldLatest, setAccelWorldLatest] = useState<Triplet>({ x: null, y: null, z: null })

  // NEW: world-frame velocity (integrated from world-frame acceleration)
  const [worldVelocities, setWorldVelocities] = useState<Array<{ t: number; x: number; y: number; z: number }>>([])
  const [worldVelLatest, setWorldVelLatest] = useState<Triplet>({ x: null, y: null, z: null })

  const velDomains = useMemo(() => {
    if (!velocities.length) return null as null | { t: [number, number]; v: [number, number] }
    const ts = velocities.map(p => p.t)
    const xs = velocities.map(p => p.x)
    const ys = velocities.map(p => p.y)
    const zs = velocities.map(p => p.z)
    const minT = Math.min(...ts, 0)
    const maxT = Math.max(...ts, 1)
    let minV = Math.min(Math.min(...xs), Math.min(...ys), Math.min(...zs))
    let maxV = Math.max(Math.max(...xs), Math.max(...ys), Math.max(...zs))
    if (!Number.isFinite(minV) || !Number.isFinite(maxV)) { minV = -1; maxV = 1 }
    if (minV === maxV) { const v = minV; minV = v - 1; maxV = v + 1 }
    const padV = (maxV - minV) * 0.05
    return { t: [minT, maxT] as [number, number], v: [minV - padV, maxV + padV] as [number, number] }
  }, [velocities])

  const accelDomains = useMemo(() => {
    if (!accelerations.length) return null as null | { t: [number, number]; a: [number, number] }
    const ts = accelerations.map(p => p.t)
    const xs = accelerations.map(p => p.x)
    const ys = accelerations.map(p => p.y)
    const zs = accelerations.map(p => p.z)
    const minT = Math.min(...ts, 0)
    const maxT = Math.max(...ts, 1)
    let minA = Math.min(Math.min(...xs), Math.min(...ys), Math.min(...zs))
    let maxA = Math.max(Math.max(...xs), Math.max(...ys), Math.max(...zs))
    if (!Number.isFinite(minA) || !Number.isFinite(maxA)) { minA = -1; maxA = 1 }
    if (minA === maxA) { const a = minA; minA = a - 1; maxA = a + 1 }
    const padA = (maxA - minA) * 0.05
    return { t: [minT, maxT] as [number, number], a: [minA - padA, maxA + padA] as [number, number] }
  }, [accelerations])

  // NEW: domains for world-frame angular velocity (deg/s)
  const omegaDomains = useMemo(() => {
    if (!worldOmegas.length) return null as null | { t: [number, number]; w: [number, number] }
    const ts = worldOmegas.map(p => p.t)
    const wxs = worldOmegas.map(p => p.x)
    const wys = worldOmegas.map(p => p.y)
    const wzs = worldOmegas.map(p => p.z)
    const minT = Math.min(...ts, 0)
    const maxT = Math.max(...ts, 1)
    let minW = Math.min(Math.min(...wxs), Math.min(...wys), Math.min(...wzs))
    let maxW = Math.max(Math.max(...wxs), Math.max(...wys), Math.max(...wzs))
    if (!Number.isFinite(minW) || !Number.isFinite(maxW)) { minW = -90; maxW = 90 }
    if (minW === maxW) { const w = minW; minW = w - 10; maxW = w + 10 }
    const padW = (maxW - minW) * 0.05
    return { t: [minT, maxT] as [number, number], w: [minW - padW, maxW + padW] as [number, number] }
  }, [worldOmegas])

  // NEW: domains for world-frame total acceleration (m/s^2)
  const accelWorldDomains = useMemo(() => {
    if (!worldAccels.length) return null as null | { t: [number, number]; a: [number, number] }
    const ts = worldAccels.map(p => p.t)
    const axs = worldAccels.map(p => p.x)
    const ays = worldAccels.map(p => p.y)
    const azs = worldAccels.map(p => p.z)
    const minT = Math.min(...ts, 0)
    const maxT = Math.max(...ts, 1)
    let minA = Math.min(Math.min(...axs), Math.min(...ays), Math.min(...azs))
    let maxA = Math.max(Math.max(...axs), Math.max(...ays), Math.max(...azs))
    if (!Number.isFinite(minA) || !Number.isFinite(maxA)) { minA = -5; maxA = 5 }
    if (minA === maxA) { const a = minA; minA = a - 1; maxA = a + 1 }
    const padA = (maxA - minA) * 0.05
    return { t: [minT, maxT] as [number, number], a: [minA - padA, maxA + padA] as [number, number] }
  }, [worldAccels])

  // NEW: domains for world-frame velocity (m/s)
  const worldVelDomains = useMemo(() => {
    if (!worldVelocities.length) return null as null | { t: [number, number]; v: [number, number] }
    const ts = worldVelocities.map(p => p.t)
    const vxs = worldVelocities.map(p => p.x)
    const vys = worldVelocities.map(p => p.y)
    const vzs = worldVelocities.map(p => p.z)
    const minT = Math.min(...ts, 0)
    const maxT = Math.max(...ts, 1)
    let minV = Math.min(Math.min(...vxs), Math.min(...vys), Math.min(...vzs))
    let maxV = Math.max(Math.max(...vxs), Math.max(...vys), Math.max(...vzs))
    if (!Number.isFinite(minV) || !Number.isFinite(maxV)) { minV = -1; maxV = 1 }
    if (minV === maxV) { const v = minV; minV = v - 1; maxV = v + 1 }
    const padV = (maxV - minV) * 0.05
    return { t: [minT, maxT] as [number, number], v: [minV - padV, maxV + padV] as [number, number] }
  }, [worldVelocities])

  const timeDomain = useMemo(() => {
    if (recordSummary) return [0, Math.max(0.01, recordSummary.durationMs / 1000)] as [number, number]
    return velDomains?.t
  }, [recordSummary, velDomains])

  const startTimeRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)
  const velRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 })
  const worldVelRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 })
  const recordingRef = useRef(false)

  // NEW: keep latest orientation in a ref for synchronous reads inside devicemotion
  const orientationRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null)

  const isSecureContext = useMemo(() => (globalThis.isSecureContext ?? false) || location.hostname === 'localhost' || location.hostname === '127.0.0.1', [])

  const addListeners = useCallback(() => {
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.acceleration
      const ag = e.accelerationIncludingGravity
      const rr = e.rotationRate
      if (a) setAccel({ x: a.x ?? null, y: a.y ?? null, z: a.z ?? null })
      if (ag) setAccelG({ x: ag.x ?? null, y: ag.y ?? null, z: ag.z ?? null })
      if (rr) setRotationRate({ alpha: rr.alpha ?? null, beta: rr.beta ?? null, gamma: rr.gamma ?? null })
      if (typeof e.interval === 'number') setIntervalMs(e.interval)
      _setSamples((s: number) => s + 1)

      // Compute world-frame angular velocity if we have both gyro and orientation
      if (rr && orientationRef.current) {
        const { alpha, beta, gamma } = orientationRef.current
        const R = eulerToR(deg2rad(alpha), deg2rad(beta), deg2rad(gamma))
        // rotationRate: alpha=z, beta=x, gamma=y (deg/s). Build device vector [x,y,z].
        const wDev: [number, number, number] = [ rr.beta ?? 0, rr.gamma ?? 0, rr.alpha ?? 0 ]
        const wWorld = mulMatVec(R, wDev) // still in deg/s
        setOmegaWorldLatest({ x: wWorld[0], y: wWorld[1], z: wWorld[2] })
      }

      // Compute world-frame acceleration (orientation adjusted, including gravity)
      if (orientationRef.current) {
        const { alpha, beta, gamma } = orientationRef.current
        const R = eulerToR(deg2rad(alpha), deg2rad(beta), deg2rad(gamma))
        let aWorldTotal: [number, number, number] | null = null
        if (a && (a.x != null || a.y != null || a.z != null)) {
          const aDev: [number, number, number] = [ a.x ?? 0, a.y ?? 0, a.z ?? 0 ] // linear accel (no gravity)
          const aWorld = mulMatVec(R, aDev)
          const gWorld: [number, number, number] = [0, 0, -9.80665]
          aWorldTotal = [ aWorld[0] + gWorld[0], aWorld[1] + gWorld[1], aWorld[2] + gWorld[2] ]
        } else if (ag && (ag.x != null || ag.y != null || ag.z != null)) {
          const aGDev: [number, number, number] = [ ag.x ?? 0, ag.y ?? 0, ag.z ?? 0 ] // includes gravity
          aWorldTotal = mulMatVec(R, aGDev)
        }
        if (aWorldTotal) setAccelWorldLatest({ x: aWorldTotal[0], y: aWorldTotal[1], z: aWorldTotal[2] })
      }

      if (recordingRef.current) {
        const tNow = performance.now()
        const last = lastTsRef.current
        lastTsRef.current = tNow
        if (last != null) {
          let dt = (tNow - last) / 1000
          if (!Number.isFinite(dt) || dt <= 0) dt = 0
          if (dt > 0.1) dt = 0.1
          const ax = a?.x ?? 0
          const ay = a?.y ?? 0
          const az = a?.z ?? 0
          const v = velRef.current
          v.x += ax * dt
          v.y += ay * dt
          v.z += az * dt
          const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
          setCurrentSpeed(speed)
          const t0 = startTimeRef.current ?? tNow
          const t = Math.max(0, (tNow - t0) / 1000)
          setSpeedSeries((prev) => {
            const next = prev.length > 5000 ? prev.slice(prev.length - 5000) : prev
            return [...next, { t, v: speed }]
          })
          setVelocities((prev) => {
            const next = prev.length > 5000 ? prev.slice(prev.length - 5000) : prev
            return [...next, { t, x: v.x, y: v.y, z: v.z }]
          })
          setAccelerations((prev) => {
            const next = prev.length > 5000 ? prev.slice(prev.length - 5000) : prev
            return [...next, { t, x: ax, y: ay, z: az }]
          })

          // Also record world-frame angular velocity time series
          if (rr && orientationRef.current) {
            const { alpha, beta, gamma } = orientationRef.current
            const R = eulerToR(deg2rad(alpha), deg2rad(beta), deg2rad(gamma))
            const wDev: [number, number, number] = [ rr.beta ?? 0, rr.gamma ?? 0, rr.alpha ?? 0 ]
            const wWorld = mulMatVec(R, wDev)
            setWorldOmegas((prev) => {
              const next = prev.length > 5000 ? prev.slice(prev.length - 5000) : prev
              return [...next, { t, x: wWorld[0], y: wWorld[1], z: wWorld[2] }]
            })
          }

          // Also record world-frame acceleration time series (including gravity)
          if (orientationRef.current) {
            const { alpha, beta, gamma } = orientationRef.current
            const R = eulerToR(deg2rad(alpha), deg2rad(beta), deg2rad(gamma))
            let aWorldTotal: [number, number, number] | null = null
            if (a && (a.x != null || a.y != null || a.z != null)) {
              const aDev: [number, number, number] = [ a.x ?? 0, a.y ?? 0, a.z ?? 0 ]
              const aWorld = mulMatVec(R, aDev)
              const gWorld: [number, number, number] = [0, 0, -9.80665]
              aWorldTotal = [ aWorld[0] + gWorld[0], aWorld[1] + gWorld[1], aWorld[2] + gWorld[2] ]
            } else if (ag && (ag.x != null || ag.y != null || ag.z != null)) {
              const aGDev: [number, number, number] = [ ag.x ?? 0, ag.y ?? 0, ag.z ?? 0 ]
              aWorldTotal = mulMatVec(R, aGDev)
            }
            if (aWorldTotal) {
              setWorldAccels((prev) => {
                const next = prev.length > 5000 ? prev.slice(prev.length - 5000) : prev
                return [...next, { t, x: aWorldTotal![0], y: aWorldTotal![1], z: aWorldTotal![2] }]
              })

              // Integrate world-frame acceleration to get world-frame velocity (excluding gravity)
              const worldVel = worldVelRef.current
              const gWorld: [number, number, number] = [0, 0, -9.80665]
              worldVel.x += (aWorldTotal[0] - gWorld[0]) * dt
              worldVel.y += (aWorldTotal[1] - gWorld[1]) * dt
              worldVel.z += (aWorldTotal[2] - gWorld[2]) * dt
              setWorldVelLatest({ x: worldVel.x, y: worldVel.y, z: worldVel.z })
              setWorldVelocities((prev) => {
                const next = prev.length > 5000 ? prev.slice(prev.length - 5000) : prev
                return [...next, { t, x: worldVel.x, y: worldVel.y, z: worldVel.z }]
              })
            }
          }
        }
      }
    }

    const onOrientation = (e: DeviceOrientationEvent) => {
      const a = e.alpha ?? null
      const b = e.beta ?? null
      const g = e.gamma ?? null
      setOrientation({ alpha: a, beta: b, gamma: g, absolute: (e as any).absolute })
      if (a != null && b != null && g != null) {
        orientationRef.current = { alpha: a, beta: b, gamma: g }
      }
      if (recordingRef.current && a != null && b != null && g != null) {
        setAngles((prev) => {
          const next = prev.length > 5000 ? prev.slice(prev.length - 5000) : prev
          return [...next, { alpha: a, beta: b, gamma: g }]
        })
      }
    }

    window.addEventListener('devicemotion', onMotion)
    window.addEventListener('deviceorientation', onOrientation)

    return () => {
      window.removeEventListener('devicemotion', onMotion)
      window.removeEventListener('deviceorientation', onOrientation)
    }
  }, [])

  const cleanupRef = useRef<null | (() => void)>(null)

  const start = useCallback(async () => {
    setPermissionError(null)
    try {
      const dm: any = (window as any).DeviceMotionEvent
      const dor: any = (window as any).DeviceOrientationEvent
      const needsPermission = (dm && typeof dm.requestPermission === 'function') || (dor && typeof dor.requestPermission === 'function')

      if (needsPermission) {
        const reqs: Promise<string>[] = []
        if (dm && typeof dm.requestPermission === 'function') reqs.push(dm.requestPermission())
        if (dor && typeof dor.requestPermission === 'function') reqs.push(dor.requestPermission())
        const results = await Promise.allSettled(reqs)
        const anyGranted = results.some(r => r.status === 'fulfilled' && r.value === 'granted')
        if (!anyGranted) {
          throw new Error('Motion/Orientation permission was not granted')
        }
      }

      if (cleanupRef.current) cleanupRef.current()
      cleanupRef.current = addListeners()
      setListening(true)
    } catch (err: any) {
      setPermissionError(err?.message || String(err))
      setListening(false)
    }
  }, [addListeners])

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current()
    }
  }, [])

  const startRecording = useCallback(() => {
    recordingRef.current = true
    setRecording(true)
    setSpeedSeries([{ t: 0, v: 0 }])
    setVelocities([{ t: 0, x: 0, y: 0, z: 0 }])
    setAccelerations([])
    setAngles([])
    setWorldOmegas([])
    setWorldAccels([])
    setWorldVelocities([{ t: 0, x: 0, y: 0, z: 0 }])
    setRecordSummary(null)
    velRef.current = { x: 0, y: 0, z: 0 }
    worldVelRef.current = { x: 0, y: 0, z: 0 }
    setCurrentSpeed(0)
    setWorldVelLatest({ x: 0, y: 0, z: 0 })
    startTimeRef.current = performance.now()
    lastTsRef.current = null
  }, [])

  const stopRecording = useCallback(() => {
    recordingRef.current = false
    setRecording(false)
    const end = performance.now()
    const start = startTimeRef.current ?? end
    setRecordSummary({ durationMs: end - start, points: Math.max(velocities.length, accelerations.length, angles.length, speedSeries.length, worldOmegas.length, worldAccels.length, worldVelocities.length) })
  }, [velocities.length, accelerations.length, angles.length, speedSeries.length, worldOmegas.length, worldAccels.length, worldVelocities.length])

  function Plot2D({
    points,
    width = 300,
    height = 300,
    xKey,
    yKey,
    title,
    xLabel,
    yLabel,
    color = '#0b84f3',
    xDomain,
    yDomain,
  }: {
    points: Array<Record<string, number>>
    width?: number
    height?: number
    xKey: string
    yKey: string
    title: string
    xLabel: string
    yLabel: string
    color?: string
    xDomain?: [number, number]
    yDomain?: [number, number]
  }) {
    const margin = { t: 28, r: 24, b: 40, l: 56 }
    const w = width - margin.l - margin.r
    const h = height - margin.t - margin.b
    const xs = points.map((p) => p[xKey])
    const ys = points.map((p) => p[yKey])
    let minX = xDomain ? xDomain[0] : Math.min(...xs, 0)
    let maxX = xDomain ? xDomain[1] : Math.max(...xs, 1)
    let minY = yDomain ? yDomain[0] : Math.min(...ys, 0)
    let maxY = yDomain ? yDomain[1] : Math.max(...ys, 1)
    if (minX === maxX) { minX -= 1; maxX += 1 }
    if (minY === maxY) { minY -= 1; maxY += 1 }
    const dx = maxX - minX || 1
    const dy = maxY - minY || 1
    const tickCount = 5
    const makeTicks = (min: number, max: number, count: number) => {
      if (!Number.isFinite(min) || !Number.isFinite(max)) return [] as number[]
      const step = (max - min) / (count - 1)
      return Array.from({ length: count }, (_, i) => min + i * step)
    }
    const xTicks = makeTicks(minX, maxX, tickCount)
    const yTicks = makeTicks(minY, maxY, tickCount)
    const toSvg = (x: number, y: number) => {
      const sx = margin.l + ((x - minX) / dx) * w
      const sy = margin.t + (1 - (y - minY) / dy) * h
      return `${sx.toFixed(1)},${sy.toFixed(1)}`
    }
    const poly = points.map((p) => toSvg(p[xKey], p[yKey])).join(' ')
    const formatTick = (v: number) => {
      const av = Math.abs(v)
      if (av >= 1000) return v.toFixed(0)
      if (av >= 10) return v.toFixed(1)
      if (av >= 1) return v.toFixed(2)
      return v.toFixed(3)
    }
    return (
      <svg width={width} height={height} style={{ border: '1px solid #ddd', background: '#fff' }}>
        <text x={width / 2} y={18} textAnchor="middle" fontSize={12} fill="#333">{title}</text>
        {xTicks.map((tx, i) => {
          const sx = margin.l + ((tx - minX) / dx) * w
          return <line key={`vx-${i}`} x1={sx} y1={margin.t} x2={sx} y2={margin.t + h} stroke="#f0f0f0" />
        })}
        {yTicks.map((ty, i) => {
          const sy = margin.t + (1 - (ty - minY) / dy) * h
          return <line key={`hy-${i}`} x1={margin.l} y1={sy} x2={margin.l + w} y2={sy} stroke="#f0f0f0" />
        })}
        <rect x={margin.l} y={margin.t} width={w} height={h} fill="none" stroke="#ddd" />
        <polyline points={poly} fill="none" stroke={color} strokeWidth={2} />
        {xTicks.map((tx, i) => {
          const sx = margin.l + ((tx - minX) / dx) * w
          return (
            <g key={`xt-${i}`}>
              <line x1={sx} y1={margin.t + h} x2={sx} y2={margin.t + h + 6} stroke="#999" />
              <text x={sx} y={margin.t + h + 18} textAnchor="middle" fontSize={10} fill="#555">{formatTick(tx)}</text>
            </g>
          )
        })}
        {yTicks.map((ty, i) => {
          const sy = margin.t + (1 - (ty - minY) / dy) * h
          return (
            <g key={`yt-${i}`}>
              <line x1={margin.l - 6} y1={sy} x2={margin.l} y2={sy} stroke="#999" />
              <text x={margin.l - 8} y={sy + 3} textAnchor="end" fontSize={10} fill="#555">{formatTick(ty)}</text>
            </g>
          )
        })}
        <text x={margin.l + w / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="#333">{xLabel}</text>
        <text x={16} y={margin.t + h / 2} textAnchor="middle" fontSize={11} fill="#333" transform={`rotate(-90, 16, ${margin.t + h / 2})`}>{yLabel}</text>
      </svg>
    )
  }

  return (
    <div className="h-screen bg-black text-white overflow-y-auto">
      <h1 className="text-4xl font-bold mb-8">Device Sensors</h1>

      {!isSecureContext && (
        <p style={{ color: 'orange' }} className="mb-4">
          Note: Some sensors require a secure context (HTTPS). If data stays empty, try serving over HTTPS or using a real device.
        </p>
      )}


      {!listening && (
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <button 
            onClick={start}
            className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-lg font-bold"
          >
            Enable sensors
          </button>
          {permissionError && <p style={{ color: 'crimson' }} className="mt-2">{permissionError}</p>}
          <p className="mt-2">Tap the button and then move/tilt your device to see live data.</p>
        </div>
      )}

      <section className="bg-gray-800 p-6 rounded-lg mb-6">
        <h2 className="text-2xl font-bold mb-4">Status</h2>
        {/* <div>
          <div>Num. of datapoints: {samples}</div>
          <div>
            Support: {('DeviceMotionEvent' in window || 'DeviceOrientationEvent' in window) ? 'available' : 'not detected'}
          </div>
        </div> */}
        {listening && (
          <div className="flex gap-4 mt-4 items-center flex-wrap">
            <button 
              onClick={startRecording} 
              disabled={recording}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-500 px-4 py-2 rounded"
            >
              Start recording
            </button>
            <button 
              onClick={stopRecording} 
              disabled={!recording}
              className="bg-red-500 hover:bg-red-600 disabled:bg-gray-500 px-4 py-2 rounded"
            >
              Stop recording
            </button>
            <span style={{ color: recording ? 'green' : '#555' }}>{recording ? 'Recording&' : 'Idle'}</span>
            {recordSummary && !recording && (
              <span>
                Recorded {recordSummary.points} pts in {Math.round(recordSummary.durationMs)} ms
              </span>
            )}
            <span>Current speed: {formatNum(currentSpeed, 4)} m/s</span>
          </div>
        )}
      </section>

      {!recording && worldAccels.length > 1 && (
        <section className="mt-6">
          <ThrowHeight 
            worldAccels={worldAccels.map(a => ({ ...a, z: -a.z }))} 
            worldOmegas={worldOmegas.length > 0 ? worldOmegas : undefined}
          />
        </section>
      )}

      <section className="bg-gray-800 p-6 rounded-lg mb-6">
        <h2 className="text-2xl font-bold mb-4">Orientation</h2>
        <div>
          <div>Z-axis (alpha): {formatNum(orientation.alpha)} deg</div>
          <div>X-axis (beta): {formatNum(orientation.beta)} deg</div>
          <div>Y-axis (gamma): {formatNum(orientation.gamma)} deg</div>
        </div>
      </section>

      <section className="bg-gray-800 p-6 rounded-lg mb-6">
        <h2 className="text-2xl font-bold mb-4">Accelerometer</h2>
        <div>
          <div>X-axis: {formatNum(accel.x)} m/s2</div>
          <div>Y-axis: {formatNum(accel.y)} m/s2</div>
          <div>Z-axis: {formatNum(accel.z)} m/s2</div>
          <div>Data Interval: {interval !== null ? `${formatNum(interval, 2)} ms` : '--'}</div>
        </div>
      </section>

      <section className="bg-gray-800 p-6 rounded-lg mb-6">
        <h2 className="text-2xl font-bold mb-4">Accelerometer including gravity</h2>
        <div>
          <div>X-axis: {formatNum(accelG.x)} m/s2</div>
          <div>Y-axis: {formatNum(accelG.y)} m/s2</div>
          <div>Z-axis: {formatNum(accelG.z)} m/s2</div>
        </div>
      </section>

      <section className="bg-gray-800 p-6 rounded-lg mb-6">
        <h2 className="text-2xl font-bold mb-4">Gyroscope</h2>
        <div>
          <div>X-axis: {formatNum(rotationRate.beta)} deg/s</div>
          <div>Y-axis: {formatNum(rotationRate.gamma)} deg/s</div>
          <div>Z-axis: {formatNum(rotationRate.alpha)} deg/s</div>
        </div>
      </section>

      {/* NEW: live world-frame gyro readout */}
      <section className="bg-gray-800 p-6 rounded-lg mb-2">
        <h2 className="text-2xl font-bold mb-1">Adjusted gyro (world frame)</h2>
        <p className="text-sm text-gray-300 mb-3">Rotation vectors transformed using current orientation. (If signs look flipped, swap to R^T in eulerToR.)</p>
        <div>
          <div>ω<sub>x</sub> (east+): {formatNum(omegaWorldLatest.x)} deg/s</div>
          <div>ω<sub>y</sub> (north+): {formatNum(omegaWorldLatest.y)} deg/s</div>
          <div>ω<sub>z</sub> (up+): {formatNum(omegaWorldLatest.z)} deg/s</div>
        </div>
      </section>

      {/* NEW: live world-frame total acceleration readout */}
      <section className="bg-gray-800 p-6 rounded-lg mb-6">
        <h2 className="text-2xl font-bold mb-1">Adjusted acceleration (world frame)</h2>
        <p className="text-sm text-gray-300 mb-3">Total acceleration rotated into a fixed world frame; gravity included. When device is stationary, should show ~9.8 m/s² downward.</p>
        <div>
          <div>a<sub>x</sub><sup>w</sup> (east+): {formatNum(accelWorldLatest.x)} m/s²</div>
          <div>a<sub>y</sub><sup>w</sup> (north+): {formatNum(accelWorldLatest.y)} m/s²</div>
          <div>a<sub>z</sub><sup>w</sup> (up+): {formatNum(accelWorldLatest.z)} m/s²</div>
        </div>
      </section>

      {/* NEW: live world-frame velocity readout */}
      <section className="bg-gray-800 p-6 rounded-lg mb-6">
        <h2 className="text-2xl font-bold mb-1">World-frame velocity</h2>
        <p className="text-sm text-gray-300 mb-3">Velocity integrated from world-frame acceleration (gravity excluded for linear motion).</p>
        <div>
          <div>v<sub>x</sub><sup>w</sup> (east+): {formatNum(worldVelLatest.x)} m/s</div>
          <div>v<sub>y</sub><sup>w</sup> (north+): {formatNum(worldVelLatest.y)} m/s</div>
          <div>v<sub>z</sub><sup>w</sup> (up+): {formatNum(worldVelLatest.z)} m/s</div>
        </div>
      </section>

      {!recording && (velocities.length > 1 || accelerations.length > 1 || angles.length > 1 || worldOmegas.length > 1 || worldAccels.length > 1 || worldVelocities.length > 1) && (
        <section className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-2xl font-bold mb-4">Recorded Plots</h2>
          {accelerations.length > 1 ? (
            <div>
              <h3 className="text-xl font-bold mb-4">Acceleration over time (device frame)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                <Plot2D
                  points={accelerations as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="x"
                  title="a_x(t)"
                  xLabel="t (s) - horizontal"
                  yLabel="a_x (m/s²) - vertical"
                  width={360}
                  height={240}
                  color="#e74c3c"
                  xDomain={timeDomain}
                  yDomain={accelDomains?.a}
                />
                <Plot2D
                  points={accelerations as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="y"
                  title="a_y(t)"
                  xLabel="t (s) - horizontal"
                  yLabel="a_y (m/s²) - vertical"
                  width={360}
                  height={240}
                  color="#9b59b6"
                  xDomain={timeDomain}
                  yDomain={accelDomains?.a}
                />
                <Plot2D
                  points={accelerations as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="z"
                  title="a_z(t)"
                  xLabel="t (s) - horizontal"
                  yLabel="a_z (m/s²) - vertical"
                  width={360}
                  height={240}
                  color="#34495e"
                  xDomain={timeDomain}
                  yDomain={accelDomains?.a}
                />
              </div>
            </div>
          ) : (
            <p>No acceleration data recorded.</p>
          )}

          {worldAccels.length > 1 ? (
            <div style={{ marginTop: 16 }}>
              <h3 className="text-xl font-bold mb-4">World-frame total acceleration over time</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                <Plot2D
                  points={worldAccels as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="x"
                  title="a_x^w(t) (m/s²)"
                  xLabel="t (s) - horizontal"
                  yLabel="a_x^w (m/s²) - vertical"
                  width={360}
                  height={240}
                  color="#8e44ad"
                  xDomain={timeDomain}
                  yDomain={accelWorldDomains?.a}
                />
                <Plot2D
                  points={worldAccels as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="y"
                  title="a_y^w(t) (m/s²)"
                  xLabel="t (s) - horizontal"
                  yLabel="a_y^w (m/s²) - vertical"
                  width={360}
                  height={240}
                  color="#d35400"
                  xDomain={timeDomain}
                  yDomain={accelWorldDomains?.a}
                />
                <Plot2D
                  points={worldAccels as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="z"
                  title="a_z^w(t) (m/s²)"
                  xLabel="t (s) - horizontal"
                  yLabel="a_z^w (m/s²) - vertical"
                  width={360}
                  height={240}
                  color="#2ecc71"
                  xDomain={timeDomain}
                  yDomain={accelWorldDomains?.a}
                />
              </div>
            </div>
          ) : (
            <p>No adjusted acceleration data recorded.</p>
          )}

          {velocities.length > 1 ? (
            <div>
              <h3 className="text-xl font-bold mb-4">Velocity over time</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                <Plot2D
                  points={velocities as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="x"
                  title="v_x(t)"
                  xLabel="t (s) - horizontal"
                  yLabel="v_x (m/s) - vertical"
                  width={360}
                  height={240}
                  color="#0b84f3"
                  xDomain={timeDomain}
                  yDomain={velDomains?.v}
                />
                <Plot2D
                  points={velocities as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="y"
                  title="v_y(t)"
                  xLabel="t (s) - horizontal"
                  yLabel="v_y (m/s) - vertical"
                  width={360}
                  height={240}
                  color="#f39c12"
                  xDomain={timeDomain}
                  yDomain={velDomains?.v}
                />
                <Plot2D
                  points={velocities as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="z"
                  title="v_z(t)"
                  xLabel="t (s) - horizontal"
                  yLabel="v_z (m/s) - vertical"
                  width={360}
                  height={240}
                  color="#27ae60"
                  xDomain={timeDomain}
                  yDomain={velDomains?.v}
                />
              </div>
            </div>
          ) : (
            <p>No velocity data recorded.</p>
          )}

          {angles.length > 1 ? (
            <div style={{ marginTop: 16 }}>
              <h3 className="text-xl font-bold mb-4">Rotation projections</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                <Plot2D
                  points={angles as unknown as Array<Record<string, number>>}
                  xKey="alpha"
                  yKey="beta"
                  title="alpha-beta"
                  xLabel="alpha (deg) - horizontal"
                  yLabel="beta (deg) - vertical"
                  width={320}
                  height={240}
                />
                <Plot2D
                  points={angles as unknown as Array<Record<string, number>>}
                  xKey="alpha"
                  yKey="gamma"
                  title="alpha-gamma"
                  xLabel="alpha (deg) - horizontal"
                  yLabel="gamma (deg) - vertical"
                  width={320}
                  height={240}
                  color="#f39c12"
                />
                <Plot2D
                  points={angles as unknown as Array<Record<string, number>>}
                  xKey="beta"
                  yKey="gamma"
                  title="beta-gamma"
                  xLabel="beta (deg) - horizontal"
                  yLabel="gamma (deg) - vertical"
                  width={320}
                  height={240}
                  color="#27ae60"
                />
              </div>
            </div>
          ) : (
            <p>No rotation data recorded.</p>
          )}

          {/* NEW: world-frame angular velocity plots */}
          {worldOmegas.length > 1 ? (
            <div style={{ marginTop: 16 }}>
              <h3 className="text-xl font-bold mb-4">World-frame angular velocity over time</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                <Plot2D
                  points={worldOmegas as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="x"
                  title="ω_x(t) (deg/s)"
                  xLabel="t (s) - horizontal"
                  yLabel="ω_x (deg/s) - vertical"
                  width={360}
                  height={240}
                  color="#16a085"
                  xDomain={timeDomain}
                  yDomain={omegaDomains?.w}
                />
                <Plot2D
                  points={worldOmegas as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="y"
                  title="ω_y(t) (deg/s)"
                  xLabel="t (s) - horizontal"
                  yLabel="ω_y (deg/s) - vertical"
                  width={360}
                  height={240}
                  color="#c0392b"
                  xDomain={timeDomain}
                  yDomain={omegaDomains?.w}
                />
                <Plot2D
                  points={worldOmegas as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="z"
                  title="ω_z(t) (deg/s)"
                  xLabel="t (s) - horizontal"
                  yLabel="ω_z (deg/s) - vertical"
                  width={360}
                  height={240}
                  color="#2980b9"
                  xDomain={timeDomain}
                  yDomain={omegaDomains?.w}
                />
              </div>
            </div>
          ) : (
            <p>No adjusted gyro data recorded.</p>
          )}

          {/* NEW: world-frame velocity plots */}
          {worldVelocities.length > 1 ? (
            <div style={{ marginTop: 16 }}>
              <h3 className="text-xl font-bold mb-4">World-frame velocity over time</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                <Plot2D
                  points={worldVelocities as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="x"
                  title="v_x^w(t) (m/s)"
                  xLabel="t (s) - horizontal"
                  yLabel="v_x^w (m/s) - vertical"
                  width={360}
                  height={240}
                  color="#e67e22"
                  xDomain={timeDomain}
                  yDomain={worldVelDomains?.v}
                />
                <Plot2D
                  points={worldVelocities as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="y"
                  title="v_y^w(t) (m/s)"
                  xLabel="t (s) - horizontal"
                  yLabel="v_y^w (m/s) - vertical"
                  width={360}
                  height={240}
                  color="#9b59b6"
                  xDomain={timeDomain}
                  yDomain={worldVelDomains?.v}
                />
                <Plot2D
                  points={worldVelocities as unknown as Array<Record<string, number>>}
                  xKey="t"
                  yKey="z"
                  title="v_z^w(t) (m/s)"
                  xLabel="t (s) - horizontal"
                  yLabel="v_z^w (m/s) - vertical"
                  width={360}
                  height={240}
                  color="#1abc9c"
                  xDomain={timeDomain}
                  yDomain={worldVelDomains?.v}
                />
              </div>
            </div>
          ) : (
            <p>No world-frame velocity data recorded.</p>
          )}
        </section>
      )}

      <p className="text-gray-400">If values are blank, your device or browser may not support these sensors.</p>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from "react"
import {
  useSensorRecorder,
  detectFreeFallSpinRobust,
  computeHeightMethod1FromRecord,
  type Sample,
} from "../AccelUtils"

const G = 9.80665
const SMOOTH_N = 5
const STATIONARY_THRESH = 0.6   // m/s^2
const STATIONARY_MS = 200       // ms of calm after catch to consider it finished

function hasPostCatchStationary(
  worldAccels: Sample[],
  catchIndex: number,
  g = G,
  thresh = STATIONARY_THRESH,
  needMs = STATIONARY_MS
) {
  if (!worldAccels.length || catchIndex >= worldAccels.length - 2) return false
  const t = worldAccels.map(s => s.t)
  const aLinZ = worldAccels.map(s => s.z + g) // total_z + g = linear_z

  let acc = 0
  for (let i = catchIndex; i < aLinZ.length - 1; i++) {
    const dt = Math.max(0, t[i + 1] - t[i])
    if (Math.abs(aLinZ[i]) < thresh) acc += dt
    else acc = 0
    if (acc * 1000 >= needMs) return true
  }
  return false
}

interface ThrowPageProps {
  permissionsEnabled?: boolean;
}

export function ThrowPage({ permissionsEnabled = false }: ThrowPageProps) {
  const { listening, recording, permissionError, data, start, stop, snapshot } = useSensorRecorder(G)
  const [result, setResult] = useState<ReturnType<typeof computeHeightMethod1FromRecord> | null>(null)
  const rafRef = useRef<number | null>(null)
  const [hasStarted, setHasStarted] = useState(false)

  // Auto-start recording when permissions are enabled
  useEffect(() => {
    if (permissionsEnabled && !hasStarted && !recording) {
      setHasStarted(true);
      start().catch(() => {});
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsEnabled, hasStarted])

  // Live detection loop → auto-stop when fall completed
  useEffect(() => {
    if (!recording) return
    const tick = () => {
      const snap = snapshot()
      const N = snap.worldAccels.length
      if (N > 24) {
        const det = detectFreeFallSpinRobust(snap.worldAccels, snap.worldOmegas, G, SMOOTH_N)
        if (det.ok) {
          const ended = hasPostCatchStationary(snap.worldAccels, det.i1, G, STATIONARY_THRESH, STATIONARY_MS)
          if (ended) {
            stop()
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            return
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [recording, snapshot, stop])

  // Once stop() finalizes buffers, compute Method 1 height
  useEffect(() => {
    if (!data) return
    const res = computeHeightMethod1FromRecord(data, {
      worldAccels: data.worldAccels,
      worldOmegas: data.worldOmegas,
      smoothN: SMOOTH_N,
      stationaryALinThresh: STATIONARY_THRESH,
      stationaryWindowMs: STATIONARY_MS,
      g: G,
    })
    setResult(res)
  }, [data])

  const handleRestart = () => {
    setResult(null);
    setHasStarted(false);
    start().catch(() => {});
  };

  const status = useMemo(() => {
    if (permissionError) return `Permission error: ${permissionError}`
    if (recording) return "Recording… toss the phone now"
    if (listening) return "Listening…"
    if (result?.ok) return "Done"
    if (result && !result.ok) return `Ended, but analysis failed: ${result.reason}`
    if (!permissionsEnabled) return "Permissions not yet enabled"
    return "Initializing…"
  }, [permissionError, listening, recording, result, permissionsEnabled])

  return (
    <div className="p-4 bg-gray-900 text-white rounded-xl space-y-3">
      <h2 className="text-xl font-semibold">Auto Measure (Method 1)</h2>
      <div className="text-sm text-gray-300">{status}</div>

      {/* Restart button after throw is complete */}
      {result && !recording && (
        <button
          onClick={handleRestart}
          className="mt-1 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 font-semibold"
        >
          Restart
        </button>
      )}

      {result?.ok && (
        <div className="mt-2 bg-gray-800 rounded-lg p-3 border border-gray-700">
          <div className="text-lg">
            Height: <b>{result.h.toFixed(3)} m</b>
          </div>
          <div className="text-sm text-gray-300 mt-1">
            v₀ = {result.v0.toFixed(3)} m/s · T = {result.T.toFixed(3)} s · Δh = {result.dH.toFixed(3)} m
          </div>
        </div>
      )}

      {!result?.ok && !recording && !permissionsEnabled && (
        <div className="text-xs text-gray-400">
          Please enable sensor permissions from the disclaimer page first.
        </div>
      )}
    </div>
  )
}

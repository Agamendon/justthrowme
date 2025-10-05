import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { 
    useSensorRecorder, 
    computeHeightMethod1FromRecord, 
    detectFreeFallSpinRobust,
    type Sample
} from '../AccelUtils';

interface PlayProps {
    throwData: any;
    setThrowData: (data: any) => void;
}

export function Play({ setThrowData }: PlayProps) {
    const navigate = useNavigate();
    const posthog = usePostHog();
    const [hasStarted, setHasStarted] = useState(false);
    const rafRef = useRef<number | null>(null);
    
    // Sensor recording setup
    const G = 9.80665;
    const SMOOTH_N = 5;
    const STATIONARY_THRESH = 0.6;   // m/s^2
    const STATIONARY_MS = 200;       // ms of calm after catch
    
    const { recording, permissionError, data, start, stop, snapshot } = useSensorRecorder(G);

    // Helper function to check if stationary after catch
    const hasPostCatchStationary = (
        worldAccels: Sample[],
        catchIndex: number,
        g = G,
        thresh = STATIONARY_THRESH,
        needMs = STATIONARY_MS
    ) => {
        if (!worldAccels.length || catchIndex >= worldAccels.length - 2) return false;
        const t = worldAccels.map((s) => s.t);
        const aLinZ = worldAccels.map((s) => s.z + g); // total_z + g = linear_z
        
        let acc = 0;
        for (let i = catchIndex; i < aLinZ.length - 1; i++) {
            const dt = Math.max(0, t[i + 1] - t[i]);
            if (Math.abs(aLinZ[i]) < thresh) acc += dt;
            else acc = 0;
            if (acc * 1000 >= needMs) return true;
        }
        return false;
    };
    
    // Helper function to count flips from gyroscope data
    const countFlips = (worldOmegas: Sample[], i0: number, i1: number) => {
        if (!worldOmegas || worldOmegas.length === 0 || i0 >= i1) return 0;
        
        // Integrate angular velocity to get total rotation
        let totalRotation = 0;
        for (let i = Math.max(0, i0); i < Math.min(worldOmegas.length - 1, i1); i++) {
            const dt = worldOmegas[i + 1].t - worldOmegas[i].t;
            // Use magnitude of angular velocity
            const omega = Math.sqrt(
                worldOmegas[i].x * worldOmegas[i].x +
                worldOmegas[i].y * worldOmegas[i].y +
                worldOmegas[i].z * worldOmegas[i].z
            );
            totalRotation += omega * dt;
        }
        
        // Convert from degrees to flips (360 degrees = 1 flip)
        return Math.floor(totalRotation / 360);
    };
    
    // Auto-start recording when component mounts
    useEffect(() => {
        if (!hasStarted && !recording) {
            setHasStarted(true);
            start().catch((err) => {
                console.error('Failed to start sensor recording:', err);
            });
        }
        
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [hasStarted, recording, start]);
    
    // Live detection loop → auto-stop when fall completed
    useEffect(() => {
        if (!recording) return;
        
        const tick = () => {
            const snap = snapshot();
            const N = snap.worldAccels.length;
            
            if (N > 24) {
                const det = detectFreeFallSpinRobust(snap.worldAccels, snap.worldOmegas, G, SMOOTH_N);
                if (det.ok) {
                    const ended = hasPostCatchStationary(snap.worldAccels, det.i1, G, STATIONARY_THRESH, STATIONARY_MS);
                    if (ended) {
                        stop();
                        if (rafRef.current) cancelAnimationFrame(rafRef.current);
                        return;
                    }
                }
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        
        rafRef.current = requestAnimationFrame(tick);
        return () => { 
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [recording, snapshot, stop]);
    
    // Once stop() finalizes buffers, compute height and process data
    useEffect(() => {
        if (!data) return;
        
        const processThrowData = async () => {
            // Compute height using Method 1
            const result = computeHeightMethod1FromRecord(data, {
                worldAccels: data.worldAccels,
                worldOmegas: data.worldOmegas,
                smoothN: SMOOTH_N,
                stationaryALinThresh: STATIONARY_THRESH,
                stationaryWindowMs: STATIONARY_MS,
                g: G,
            });
            
            let height = 0;
            let flips = 0;
            let duration = 0;
            
            if (result.ok) {
                height = result.h;
                duration = result.T;
                
                // Count flips during free-fall period
                flips = countFlips(data.worldOmegas, result.indices.release, result.indices.catch);
                
                console.log('Throw analysis complete:', {
                    height: height.toFixed(3),
                    flips,
                    duration: duration.toFixed(3),
                    v0: result.v0.toFixed(3)
                });
                
                // Log throw data to Posthog
                posthog.capture('throw_completed', {
                    height: parseFloat(height.toFixed(3)),
                    flips: flips,
                    duration: parseFloat(duration.toFixed(3)),
                    initial_velocity: parseFloat(result.v0.toFixed(3)),
                    release_index: result.indices.release,
                    catch_index: result.indices.catch,
                    max_acceleration: Math.max(...data.worldAccels.map(s => 
                        Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z)
                    )),
                    sample_count: data.worldAccels.length,
                    analysis_method: 'method1',
                    stationary_threshold: STATIONARY_THRESH,
                    stationary_window_ms: STATIONARY_MS,
                    smooth_n: SMOOTH_N,
                    world_accels: data.worldAccels
                });
            } else {
                console.error('Failed to analyze throw:', result.reason);
                // Use fallback values if analysis failed
                height = 0;
                flips = 0;
                duration = 1.0;
                
                // Log failed analysis to Posthog
                posthog.capture('throw_analysis_failed', {
                    reason: result.reason,
                    sample_count: data.worldAccels.length,
                    has_accel_data: data.worldAccels.length > 0,
                    has_gyro_data: data.worldOmegas.length > 0
                });
            }
            
            // Create trajectory coords (simplified)
            const coords: [number, number, number][] = [
                [0, 0, 0],
                [0.5, height / 2, 0.5],
                [1.0, 0, 1.0]
            ];
            
            setThrowData({ height, flips, duration, coords });
            
            // Save attempt to database
            console.log('Saving attempt to database:', { height, flips });
            const { insertAttempt } = await import('../supabaseClient');
            const { success, error } = await insertAttempt(height, flips);
            
            if (success) {
                console.log('Attempt saved successfully to database');
            } else {
                console.error('Failed to save attempt:', error);
            }
            
            // Navigate immediately to PostThrow
            navigate('/postthrow');
        };
        
        processThrowData();
    }, [data, setThrowData, navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <div className="text-center">
                {permissionError ? (
                    <>
                        <h1 className="text-red-500 text-3xl font-bold mb-4">Permission Error</h1>
                        <p className="text-red-400">{permissionError}</p>
                    </>
                ) : recording ? (
                    <>
                        <h1 className="text-white text-5xl font-bold mb-4">Toss the phone!</h1>
                        <p className="text-gray-400 text-xl">Recording sensor data...</p>
                    </>
                ) : data ? (
                    <>
                        <h1 className="text-white text-4xl font-bold mb-4">Processing throw...</h1>
                        <p className="text-gray-400 text-lg">Analyzing sensor data</p>
                    </>
                ) : (
                    <>
                        <h1 className="text-white text-4xl font-bold mb-4">Initializing sensors...</h1>
                        <p className="text-gray-400 text-lg">Please wait</p>
                    </>
                )}
            </div>
        </div>
    );
}
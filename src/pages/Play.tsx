import { useEffect, useState } from 'react'

interface PlayProps {
    onClose: () => void;
    onFinish: (height: number, flips: number, duration: number, coords: [number, number, number][]) => void;
}

export function Play({ onClose: _onClose, onFinish }: PlayProps) {
    const [showContinue, setShowContinue] = useState(false);

    useEffect(() => {
        const timer = setTimeout(()=>{
            setShowContinue(true);
            
            // TODO: replace these placeholder values with actual sensor data
            const height = 1.5; // meters
            const flips = 2;
            const duration = 1.0; // seconds
            const coords: [number, number, number][] = [
                [0, 0, 0],
                [0.5, 1.0, 0.5],
                [1.0, 0, 1.0]
            ];
            
            onFinish(height, flips, duration, coords);
        }, 1000);

        // clean timer on unmount
        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <h1 className="text-white text-center text-6xl font-bold">{showContinue ? "PROCEED" : "WAIT"}</h1>
        </div>
    );
}
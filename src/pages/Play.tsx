import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom';

interface PlayProps {
    throwData: any;
    setThrowData: (data: any) => void;
}

export function Play({ setThrowData }: PlayProps) {
    const navigate = useNavigate();
    const [showContinue, setShowContinue] = useState(false);

    useEffect(() => {
        const timer = setTimeout(()=>{
            setShowContinue(true);
            
            // TODO: replace these placeholder values with actual sensor data
            const height = Math.random() * 5; // random number between 0 and 5 meters
            const flips = Math.floor(Math.random() * 21); // random integer between 0 and 20
            const duration = 1.0; // seconds
            const coords: [number, number, number][] = [
                [0, 0, 0],
                [0.5, 1.0, 0.5],
                [1.0, 0, 1.0]
            ];
            
            // Save throw data and navigate
            const handleFinish = async () => {
                setThrowData({ height, flips, duration, coords });
                
                // Save attempt to database immediately when throw finishes
                console.log('Saving attempt to database:', { height, flips });
                const { insertAttempt } = await import('../supabaseClient');
                const { success, error } = await insertAttempt(height, flips);
                
                if (success) {
                    console.log('Attempt saved successfully to database');
                } else {
                    console.error('Failed to save attempt:', error);
                }
                
                navigate('/postthrow');
            };
            
            handleFinish();
        }, 1000);

        // clean timer on unmount
        return () => clearTimeout(timer);
    }, [setThrowData, navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <h1 className="text-white text-center text-6xl font-bold">{showContinue ? "PROCEED" : "WAIT"}</h1>
        </div>
    );
}
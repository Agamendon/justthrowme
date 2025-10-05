import { useNavigate } from 'react-router-dom';

interface PostThrowProps {
    height: number,
    flips: number,
    duration: number,
    coords: [number, number, number][]
}

export function PostThrow({ height, flips }: PostThrowProps) {
    const navigate = useNavigate();

    const handleShare = () => {
        console.log('Sharing throw...')
    }

    const handleReplay = () => {
        console.log('Replaying...')
    }

    return (
        <div className="flex flex-col bg-slate-800 text-white" style={{ height: '100dvh' }}>
            {/* Centered Numbers and All Buttons */}
            <div className="flex-1 flex items-center justify-center px-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                <div className="w-full max-w-md bg-gray-800 p-5">
                    {/* Numbers Display */}
                    <div className="flex justify-center gap-12 mb-8">
                        {/* Height */}
                        <div className="text-center">
                            <div className="text-8xl font-bold text-green-500 mb-2 alfa-slab-one-regular">{height.toFixed(2)}</div>
                            <div className="text-xl text-gray-400 alfa-slab-one-regular">METERS</div>
                        </div>
                        
                        {/* Flips */}
                        <div className="text-center">
                            <div className="text-8xl font-bold text-green-500 mb-2 alfa-slab-one-regular">{flips}</div>
                            <div className="text-xl text-gray-400 alfa-slab-one-regular">FLIPS</div>
                        </div>
                    </div>

                    {/* Share and Replay Buttons */}
                    <div className="flex items-stretch gap-4 mb-4">
                        <button
                            onClick={handleShare}
                            className="flex-1 py-3 bg-amber-300 hover:bg-blue-700 text-black font-bold text-lg transition-colors alfa-slab-one-regular border-t-4 border-l-4 border-b-2 border-r-2 border-t-amber-100 border-l-amber-100 border-b-amber-600 border-r-amber-600">
                            SHARE
                        </button>
                        <button
                            onClick={handleReplay}
                            className="px-3 py-3 bg-rose-600 text-white transition-colors outline-none focus:outline-none flex items-center justify-center border-t-4 border-l-4 border-b-2 border-r-2 border-t-rose-400 border-l-rose-400 border-b-rose-900 border-r-rose-900"
                            title="Replay">
                            <img 
                                src="https://api.iconify.design/material-symbols/replay.svg?color=white" 
                                alt="Replay"
                                width="32" 
                                height="32"
                            />
                        </button>
                    </div>

                    {/* View Leaderboard Button */}
                    <button
                        onClick={() => navigate('/leaderboard')}
                        className="w-full text-xl bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 transition-colors alfa-slab-one-regular border-t-4 border-l-4 border-b-2 border-r-2 border-t-green-400 border-l-green-400 border-b-green-900 border-r-green-900">
                        LEADERBOARD
                    </button>
                </div>
            </div>
        </div>
    );
};
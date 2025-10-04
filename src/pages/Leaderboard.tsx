import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom';
import { updateUsername, getTopHeightPRs, getTopFlipsPRs } from '../supabaseClient'

interface LeaderboardProps {
    username: string,
    onUsernameChange: (username: string) => void
}

interface HeightPREntry {
    id: string
    username: string | null
    height_pr: number
}

interface FlipsPREntry {
    id: string
    username: string | null
    flips_pr: number
}

type LeaderboardTab = 'height' | 'flips'

export function Leaderboard({ username: initialUsername, onUsernameChange }: LeaderboardProps) {
    const navigate = useNavigate();
    const [username, setUsername] = useState(initialUsername)
    const [isPublishing, setIsPublishing] = useState(false)
    const [heightData, setHeightData] = useState<HeightPREntry[]>([])
    const [flipsData, setFlipsData] = useState<FlipsPREntry[]>([])
    const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true)
    const [activeTab, setActiveTab] = useState<LeaderboardTab>('height')

    // Fetch leaderboard data when component mounts
    useEffect(() => {
        const fetchLeaderboard = async () => {
            setIsLoadingLeaderboard(true)
            
            const [heightResult, flipsResult] = await Promise.all([
                getTopHeightPRs(100),
                getTopFlipsPRs(100)
            ])
            
            if (heightResult.error) {
                console.error('Failed to fetch height leaderboard:', heightResult.error)
            } else if (heightResult.data) {
                setHeightData(heightResult.data)
            }
            
            if (flipsResult.error) {
                console.error('Failed to fetch flips leaderboard:', flipsResult.error)
            } else if (flipsResult.data) {
                setFlipsData(flipsResult.data)
            }
            
            setIsLoadingLeaderboard(false)
        }
        
        fetchLeaderboard()
    }, [])

    const handlePublish = async () => {
        setIsPublishing(true)
        console.log('Updating username to:', username)
        
        // Update username in Supabase
        const { success, error } = await updateUsername(username)
        if (success) {
            console.log('Username updated successfully in Supabase')
            onUsernameChange(username)
            
            // Refresh leaderboard to show updated username
            const [heightResult, flipsResult] = await Promise.all([
                getTopHeightPRs(100),
                getTopFlipsPRs(100)
            ])
            
            if (heightResult.data) {
                setHeightData(heightResult.data)
            }
            if (flipsResult.data) {
                setFlipsData(flipsResult.data)
            }
        } else {
            console.error('Failed to update username:', error)
        }
        
        setIsPublishing(false)
    }

    return (
        <div className="flex flex-col items-center min-h-screen bg-slate-800 text-white p-1">
            {/* Back button */}
            <div className="w-full max-w-2xl mb-4">
                <button
                    onClick={() => navigate('/postthrow')}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors alfa-slab-one-regular border-t-4 border-l-4 border-b-2 border-r-2 border-t-gray-500 border-l-gray-500 border-b-gray-900 border-r-gray-900">
                    ← BACK
                </button>
            </div>

            {/* Username Input and Change Button */}
            <div className="w-full max-w-2xl mb-6">
                <div className="bg-gray-800 p-1">
                    <div className="flex items-center gap-2">
                        <span className="text-white text-lg whitespace-nowrap flex-shrink-0 alfa-slab-one-regular">I am</span>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value)
                                onUsernameChange(e.target.value)
                            }}
                            placeholder="..."
                            className="flex-1 min-w-0 px-2 py-2 text-lg bg-green-600 text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-blue-500 alfa-slab-one-regular border-t-2 border-l-2 border-b border-r border-t-green-400 border-l-green-400 border-b-green-900 border-r-green-900"
                        />
                        <button
                            onClick={handlePublish}
                            disabled={!username.trim() || isPublishing}
                            className="w-12 h-12 bg-rose-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold transition-colors flex items-center justify-center border-t-4 border-l-4 border-b-2 border-r-2 border-t-rose-400 border-l-rose-400 border-b-rose-900 border-r-rose-900 disabled:border-t-blue-200 disabled:border-l-blue-200 disabled:border-b-blue-400 disabled:border-r-blue-400"
                            title="Change username">
                            {isPublishing ? (
                                <span className="text-sm">...</span>
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Leaderboard */}
            <div className="w-full max-w-2xl">
                <div className="bg-gray-800 p-1">
                    <h2 className="text-2xl font-bold mb-4 text-center alfa-slab-one-regular">LEADERBOARD</h2>
                    
                    {/* Tabs */}
                    <div className="flex gap-2 mb-2">
                        <button
                            onClick={() => setActiveTab('height')}
                            className={`flex-1 py-2 px-4 font-bold transition-colors alfa-slab-one-regular border-t-4 border-l-4 border-b-2 border-r-2 ${
                                activeTab === 'height'
                                    ? 'bg-green-600 text-white border-t-green-400 border-l-green-400 border-b-green-900 border-r-green-900'
                                    : 'bg-gray-700 text-gray-400 border-t-gray-600 border-l-gray-600 border-b-gray-900 border-r-gray-900 hover:bg-gray-600'
                            }`}>
                            HEIGHT
                        </button>
                        <button
                            onClick={() => setActiveTab('flips')}
                            className={`flex-1 py-2 px-4 font-bold transition-colors alfa-slab-one-regular border-t-4 border-l-4 border-b-2 border-r-2 ${
                                activeTab === 'flips'
                                    ? 'bg-blue-600 text-white border-t-blue-400 border-l-blue-400 border-b-blue-900 border-r-blue-900'
                                    : 'bg-gray-700 text-gray-400 border-t-gray-600 border-l-gray-600 border-b-gray-900 border-r-gray-900 hover:bg-gray-600'
                            }`}>
                            FLIPS
                        </button>
                    </div>
                    
                    {isLoadingLeaderboard ? (
                        <div className="text-center text-gray-400 py-8">
                            Loading leaderboard...
                        </div>
                    ) : activeTab === 'height' ? (
                        heightData.length === 0 ? (
                            <div className="text-center text-gray-400 py-8">
                                No height records yet. Be the first!
                            </div>
                        ) : (
                            <div>
                                {/* Header */}
                                {/* <div className="grid grid-cols-[50px_1fr_120px] gap-2 px-3 py-2 text-sm font-bold text-gray-400 border-b border-gray-700">
                                    <div className="text-center">#</div>
                                    <div>Player</div>
                                    <div className="text-right">Height PR</div>
                                </div> */}
                                
                                {/* Height Leaderboard Entries */}
                                {heightData.map((entry, index) => (
                                    <div 
                                        key={entry.id}
                                        className="grid grid-cols-[50px_1fr_120px] gap-2 px-3 py-3 bg-gray-700 hover:bg-gray-600 transition-colors border-t-4 border-l-4 border-b-2 border-r-2 border-t-gray-600 border-l-gray-600 border-b-gray-900 border-r-gray-900"
                                    >
                                        <div className="text-center text-yellow-400 ibm-plex-sans-condensed-semibold text-xl">
                                            {index + 1}
                                        </div>
                                        <div className="truncate alfa-slab-one-regular">
                                            {entry.username || 'Anonymous'}
                                        </div>
                                        <div className="text-right text-green-400 ibm-plex-sans-condensed-semibold text-xl">
                                            {entry.height_pr.toFixed(2)}m
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        flipsData.length === 0 ? (
                            <div className="text-center text-gray-400 py-8">
                                No flips records yet. Be the first!
                            </div>
                        ) : (
                            <div>
                                {/* Header */}
                                {/* <div className="grid grid-cols-[50px_1fr_120px] gap-2 px-3 py-2 text-sm font-bold text-gray-400 border-b border-gray-700">
                                    <div className="text-center">#</div>
                                    <div>Player</div>
                                    <div className="text-right">Flips PR</div>
                                </div> */}
                                
                                {/* Flips Leaderboard Entries */}
                                {flipsData.map((entry, index) => (
                                    <div 
                                        key={entry.id}
                                        className="grid grid-cols-[50px_1fr_120px] gap-2 px-3 py-3 bg-gray-700 hover:bg-gray-600 transition-colors border-t-4 border-l-4 border-b-2 border-r-2 border-t-gray-600 border-l-gray-600 border-b-gray-900 border-r-gray-900"
                                    >
                                        <div className="text-center text-yellow-400 ibm-plex-sans-condensed-semibold text-xl">
                                            {index + 1}
                                        </div>
                                        <div className="truncate alfa-slab-one-regular">
                                            {entry.username || 'Anonymous'}
                                        </div>
                                        <div className="text-right text-blue-400 ibm-plex-sans-condensed-semibold text-xl">
                                            {entry.flips_pr}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

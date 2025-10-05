import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom';
import { updateUsername, getTopHeightPRs, getTopFlipsPRs } from '../supabaseClient'

interface LeaderboardProps {
    username: string,
    onUsernameChange: (username: string) => void
}

interface LeaderboardEntry {
    id: string
    username: string | null
    height_pr?: number
    flips_pr?: number
}

type LeaderboardTab = 'height' | 'flips'

type LeaderboardEntryWithType = LeaderboardEntry & {
    type: LeaderboardTab
    value: number
    unit: string
    color: string
}

function transformToLeaderboardEntry(entry: LeaderboardEntry, type: LeaderboardTab): LeaderboardEntryWithType {
    if (type === 'height') {
        return {
            ...entry,
            type,
            value: entry.height_pr || 0,
            unit: 'm',
            color: 'text-green-400'
        }
    } else {
        return {
            ...entry,
            type,
            value: entry.flips_pr || 0,
            unit: '',
            color: 'text-blue-400'
        }
    }
}

interface LeaderboardEntryComponentProps {
    entry: LeaderboardEntryWithType
    index: number
    currentUsername: string
    isEditing: boolean
    editingUsername: string
    onStartEdit: (entryId: string, currentUsername: string) => void
    onSaveEdit: () => void
    onEditUsernameChange: (username: string) => void
    onCancelEdit: () => void
    hasDuplicateError?: boolean
    onClearError?: () => void
}

function LeaderboardEntryComponent({ 
    entry, 
    index, 
    currentUsername, 
    isEditing, 
    editingUsername, 
    onStartEdit, 
    onSaveEdit, 
    onEditUsernameChange, 
    onCancelEdit,
    hasDuplicateError,
    onClearError
}: LeaderboardEntryComponentProps) {
    const isCurrentUser = entry.username === currentUsername && currentUsername.trim() !== ''
    
    const bgColorClass = entry.type === 'height' 
        ? (isCurrentUser 
            ? 'bg-green-700 hover:bg-green-600 border-t-green-500 border-l-green-500 border-b-green-500 border-r-green-500 ring-2 ring-green-400 py-2'
            : 'bg-gray-700 hover:bg-gray-600 border-t-gray-600 border-l-gray-600 border-b-gray-900 border-r-gray-900 py-3')
        : (isCurrentUser 
            ? 'bg-blue-700 hover:bg-blue-600 border-t-blue-500 border-l-blue-500 border-b-blue-900 border-r-blue-900 ring-2 ring-blue-400 py-2'
            : 'bg-gray-700 hover:bg-gray-600 border-t-gray-600 border-l-gray-600 border-b-gray-900 border-r-gray-900 py-3')
    
    const usernameFieldBgClass = isCurrentUser && !isEditing 
        ? (entry.type === 'height' ? 'bg-green-800' : 'bg-blue-800')
        : ''
        
    return (
        <div 
            className={`grid grid-cols-[50px_1fr_80px] gap-2 px-3 transition-colors border-t-4 border-l-4 border-b-2 border-r-2 ${bgColorClass} items-center`}
            data-user-entry={isCurrentUser}
        >
            <div className="text-center text-yellow-400 ibm-plex-sans-condensed-semibold text-xl">
                {index + 1}
            </div>
            {isEditing ? (
                <input
                    type="text"
                    value={editingUsername}
                    maxLength={20}
                    onChange={(e) => {
                        onEditUsernameChange(e.target.value)
                        if (hasDuplicateError && onClearError) {
                            onClearError()
                        }
                    }}
                    className={`w-full px-2 py-2 bg-gray-800 text-white border rounded alfa-slab-one-regular min-w-0 ${
                        hasDuplicateError ? 'border-red-500' : 'border-gray-600'
                    }`}
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onSaveEdit()
                        if (e.key === 'Escape') onCancelEdit()
                    }}
                />
            ) : (
                <div 
                    className={`alfa-slab-one-regular px-2 py-2 rounded cursor-pointer transition-colors truncate ${
                        isCurrentUser ? 'text-white font-bold' : ''
                    } ${usernameFieldBgClass}`}
                    onClick={() => isCurrentUser ? onStartEdit(entry.id, entry.username || '') : undefined}
                    title={entry.username || 'Anonymous'}
                >
                    {entry.username || 'Anonymous'}
                </div>
            )}
            <div className={`text-right ibm-plex-sans-condensed-semibold text-xl ${entry.color}`}>
                {entry.type === 'height' ? entry.value.toFixed(2) : entry.value}{entry.unit}
            </div>
        </div>
    )
}

export function Leaderboard({ username: initialUsername, onUsernameChange }: LeaderboardProps) {
    const navigate = useNavigate();
    const [username, setUsername] = useState(initialUsername)
    const [isPublishing, setIsPublishing] = useState(false)
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntryWithType[]>([])
    const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true)
    const [activeTab, setActiveTab] = useState<LeaderboardTab>('height')
    const [editingEntry, setEditingEntry] = useState<string | null>(null)
    const [editingUsername, setEditingUsername] = useState('')
    const [hasDuplicateError, setHasDuplicateError] = useState(false)

    // Fetch leaderboard data when component mounts
    useEffect(() => {
        const fetchLeaderboard = async () => {
            setIsLoadingLeaderboard(true)
            
            const [heightResult, flipsResult] = await Promise.all([
                getTopHeightPRs(100),
                getTopFlipsPRs(100)
            ])
            
            const combinedData: LeaderboardEntryWithType[] = []
            
            if (heightResult.error) {
                console.error('Failed to fetch height leaderboard:', heightResult.error)
            } else if (heightResult.data) {
                combinedData.push(...heightResult.data.map(entry => transformToLeaderboardEntry(entry, 'height')))
            }
            
            if (flipsResult.error) {
                console.error('Failed to fetch flips leaderboard:', flipsResult.error)
            } else if (flipsResult.data) {
                combinedData.push(...flipsResult.data.map(entry => transformToLeaderboardEntry(entry, 'flips')))
            }
            
            setLeaderboardData(combinedData)
            setIsLoadingLeaderboard(false)
        }
        
        fetchLeaderboard()
    }, [])

    const refreshLeaderboard = async () => {
        const [heightResult, flipsResult] = await Promise.all([
            getTopHeightPRs(100),
            getTopFlipsPRs(100)
        ])
        
        const combinedData: LeaderboardEntryWithType[] = []
        if (heightResult.data) {
            combinedData.push(...heightResult.data.map(entry => transformToLeaderboardEntry(entry, 'height')))
        }
        if (flipsResult.data) {
            combinedData.push(...flipsResult.data.map(entry => transformToLeaderboardEntry(entry, 'flips')))
        }
        setLeaderboardData(combinedData)
    }

    const handlePublish = async () => {
        setIsPublishing(true)
        setHasDuplicateError(false)
        console.log('Updating username to:', username)
        
        const { success, error } = await updateUsername(username)
        if (success) {
            console.log('Username updated successfully in Supabase')
            onUsernameChange(username)
            await refreshLeaderboard()
        } else {
            console.error('Failed to update username:', error)
            if (error?.code === '23505' || error?.message?.includes('duplicate key value')) {
                setHasDuplicateError(true)
            }
        }
        
        setIsPublishing(false)
    }

    const handleStartEdit = (entryId: string, currentUsername: string) => {
        setEditingEntry(entryId)
        setEditingUsername(currentUsername)
    }

    const handleSaveEdit = async () => {
        if (!editingUsername.trim()) return
        
        setHasDuplicateError(false)
        const { success, error } = await updateUsername(editingUsername)
        if (success) {
            console.log('Username updated successfully in Supabase')
            onUsernameChange(editingUsername)
            setUsername(editingUsername)
            await refreshLeaderboard()
            setEditingEntry(null)
            setEditingUsername('')
        } else {
            console.error('Failed to update username:', error)
            if (error?.code === '23505' || error?.message?.includes('duplicate key value')) {
                setHasDuplicateError(true)
            }
        }
    }

    const handleCancelEdit = () => {
        setEditingEntry(null)
        setEditingUsername('')
        setHasDuplicateError(false)
    }

    const handleClearError = () => {
        setHasDuplicateError(false)
    }

    return (
        <div className="flex flex-col h-screen bg-slate-800 text-white px-1 py-4">
            <div className="w-full max-w-2xl mx-auto flex-1 min-h-0 flex flex-col">
                <div className="bg-gray-800 p-1 rounded-md flex-1 min-h-0 flex flex-col">
                    {/* Header with back button and centered title */}
                    <div className="relative flex justify-center items-center mb-4">
                        <button
                            onClick={() => navigate('/postthrow')}
                            className="absolute left-0 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors alfa-slab-one-regular border-t-4 border-l-4 border-b-2 border-r-2 border-t-gray-500 border-l-gray-500 border-b-gray-900 border-r-gray-900">
                            ←
                        </button>
                        <h2 className="text-2xl font-bold alfa-slab-one-regular">LEADERBOARD</h2>
                    </div>
                    
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
                    
                    {/* Content area grows, and the list itself scrolls */}
                    {isLoadingLeaderboard ? (
                        <div className="flex-1 min-h-0 flex items-center justify-center text-gray-400 py-8">
                            Loading leaderboard...
                        </div>
                    ) : (() => {
                        const filteredData = leaderboardData.filter(entry => entry.type === activeTab)
                        const currentIndex = filteredData.findIndex(entry => entry.username === username && username.trim() !== '')
                        const currentUserEntry = currentIndex !== -1 ? filteredData[currentIndex] : null

                        return filteredData.length === 0 ? (
                            <div className="flex-1 min-h-0 flex items-center justify-center text-gray-400 py-8">
                                No {activeTab} records yet. Be the first!
                            </div>
                        ) : (
                            <div className="flex-1 min-h-0 flex flex-col">
                                {/* Scrollable list */}
                                <div className="flex-1 overflow-y-auto">
                                    {/* Add bottom padding so content doesn't get hidden */}
                                    <div className="pb-4">
                                        {filteredData.map((entry, index) => {
                                            const isCurrent = index === currentIndex
                                            return (
                                                <div key={entry.id} className={isCurrent ? '' : ''}>
                                                    <LeaderboardEntryComponent
                                                        entry={entry}
                                                        index={index}
                                                        currentUsername={username}
                                                        isEditing={editingEntry === entry.id}
                                                        editingUsername={editingUsername}
                                                        onStartEdit={handleStartEdit}
                                                        onSaveEdit={handleSaveEdit}
                                                        onEditUsernameChange={setEditingUsername}
                                                        onCancelEdit={handleCancelEdit}
                                                        hasDuplicateError={hasDuplicateError && editingEntry === entry.id}
                                                        onClearError={handleClearError}
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Fixed current user row at bottom */}
                                {currentUserEntry && (
                                    <div className="flex-shrink-0 border-t border-white/10 bg-slate-900/95 backdrop-blur pb-safe-area-inset-bottom">
                                        <LeaderboardEntryComponent
                                            key={`fixed-${currentUserEntry.id}`}
                                            entry={currentUserEntry}
                                            index={currentIndex}
                                            currentUsername={username}
                                            isEditing={editingEntry === currentUserEntry.id}
                                            editingUsername={editingUsername}
                                            onStartEdit={handleStartEdit}
                                            onSaveEdit={handleSaveEdit}
                                            onEditUsernameChange={setEditingUsername}
                                            onCancelEdit={handleCancelEdit}
                                            hasDuplicateError={hasDuplicateError && editingEntry === currentUserEntry.id}
                                            onClearError={handleClearError}
                                        />
                                    </div>
                                )}
                            </div>
                        )
                    })()}
                </div>
            </div>
        </div>
    );
}

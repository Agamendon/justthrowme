import { useState, useEffect } from 'react'
import { Instructions } from './pages/Instructions'
import { Disclaimer } from './pages/Disclaimer'
import { Start } from './pages/Start'
import { Play } from './pages/Play'
import { PostThrow } from './pages/PostThrow'
import { Leaderboard } from './pages/Leaderboard'
import { FallingBlocks } from './components/FallingBlocks'
import { useEnsureSignedIn } from './useSupabaseAuth'
import { generateRandomUsername } from './utils/usernameGenerator'
import { updateUsername, getUsername } from './supabaseClient'

type PageState = 'home' | 'instructions' | 'disclaimer' | 'start' | 'play' | 'postthrow' | 'leaderboard'

function App() {
  const [currentPage, setCurrentPage] = useState<PageState>('home')
  const [throwData, setThrowData] = useState<{
    height: number,
    flips: number,
    duration: number,
    coords: [number, number, number][]
  } | null>(null)
  const [username, setUsername] = useState<string>('')
  const [isNewUser, setIsNewUser] = useState<boolean>(false)

  // supabase auth
  const { session, loading } = useEnsureSignedIn()

  // Fetch existing username or generate new one on mount
  useEffect(() => {
    const initUsername = async () => {
      // First, try to fetch existing username from Supabase
      const { username: existingUsername } = await getUsername();
      
      if (existingUsername) {
        // User already has a username, use it (returning user)
        console.log('Using existing username:', existingUsername);
        setUsername(existingUsername);
        setIsNewUser(false);
      } else {
        // No existing username, generate a new one (new user)
        const newUsername = generateRandomUsername();
        console.log('Generated new username:', newUsername);
        setUsername(newUsername);
        setIsNewUser(true);
        await updateUsername(newUsername);
      }
    };
    
    if (!loading && session && !username) {
      initUsername();
    }
  }, [loading, session, username])

  const handleGo = () => {
    // New users see instructions, returning users skip directly to start
    if (isNewUser) {
      setCurrentPage('instructions')
    } else {
      setCurrentPage('start')
    }
  }

  const handleClose = () => {
    setCurrentPage('home')
  }

  const handleStart = () => {
    setCurrentPage('play')
  }

  const handleNext = () => {
    if (currentPage === 'instructions') {
      setCurrentPage('disclaimer')
    } else if (currentPage === 'disclaimer') {
      setCurrentPage('start')
    }
  }

  const handleSkip = () => {
    setCurrentPage('start')
  }

  const handleFinish = async (height: number, flips: number, duration: number, coords: [number, number, number][]) => {
    setThrowData({ height, flips, duration, coords })
    
    // Save attempt to database immediately when throw finishes
    console.log('Saving attempt to database:', { height, flips })
    const { insertAttempt } = await import('./supabaseClient')
    const { success, error } = await insertAttempt(height, flips)
    
    if (success) {
      console.log('Attempt saved successfully to database')
    } else {
      console.error('Failed to save attempt:', error)
    }
    
    setCurrentPage('postthrow')
  }

  const handleViewLeaderboard = () => {
    setCurrentPage('leaderboard')
  }

  const handleBackFromLeaderboard = () => {
    setCurrentPage('postthrow')
  }

  return (
    <div className="bg-slate-800">
      {/* Header */}
      {/* <header className="">
        <div className="container mx-auto px-4 py-4">
          <h1 className="rubik-spray-paint-regular text-3xl text-white text-center">
            JustThrowMe<sub> (pls)</sub>
          </h1>
        </div>
      </header> */}
      
      {currentPage === 'home' && (
        <>
          <FallingBlocks />
          <div className="flex flex-col items-center justify-center min-h-screen text-white relative">
            {/* Session info/debug widget */}
            <div className="absolute top-4 right-4 text-xs text-gray-300 bg-white/5 border border-white/10 rounded px-3 py-2 max-w-[50vw] overflow-auto z-10">
            {loading ? (
              <span>Loading session…</span>
            ) : session ? (
              <div>
                <div className="mb-1">Signed in as:</div>
                <div className="font-mono text-[10px] break-all mb-2">{session.user.id}</div>
                {username && (
                  <div>
                    <div className="mb-1">Username:</div>
                    <div className="font-mono text-[10px] break-all">{username}</div>
                  </div>
                )}
              </div>
            ) : (
              <span>No session</span>
            )}
          </div>
            <button
              onClick={handleGo}
              className="relative w-64 h-64 bg-red-600 rounded-full hover:bg-red-700 transition-all transform hover:scale-105 z-10 border-t-[12px] border-l-[12px] border-b-[6px] border-r-[6px] border-t-red-400 border-l-red-400 border-b-red-900 border-r-red-900"
              style={{ marginTop: '15rem' }}
            >
              <span className="text-5xl font-bold text-white alfa-slab-one-regular">GO</span>
            </button>
          </div>
        </>
      )}
      {currentPage === 'instructions' && (
        <Instructions onNext={handleNext} onSkip={handleSkip} />
      )}
      {currentPage === 'disclaimer' && (
        <Disclaimer onNext={handleNext} onSkip={handleSkip} />
      )}
      {currentPage === 'start' && (
        <Start onStart={handleStart}/>
      )}
      {currentPage == 'play' && (
        <Play onClose={handleClose} onFinish={handleFinish}/>
      )}
      {currentPage === 'postthrow' && throwData && (
        <PostThrow 
          height={throwData.height}
          flips={throwData.flips}
          duration={throwData.duration}
          coords={throwData.coords}
          onViewLeaderboard={handleViewLeaderboard}
        />
      )}
      {currentPage === 'leaderboard' && (
        <Leaderboard 
          username={username}
          onUsernameChange={setUsername}
          onBack={handleBackFromLeaderboard}
        />
      )}
    </div>
  )
}

export default App
import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Instructions } from './pages/Instructions'
import { Disclaimer } from './pages/Disclaimer'
import { Start } from './pages/Start'
import { Play } from './pages/Play'
import { PostThrow } from './pages/PostThrow'
import { Leaderboard } from './pages/Leaderboard'
import { useEnsureSignedIn } from './useSupabaseAuth'
import { generateRandomUsername } from './utils/usernameGenerator'
import { updateUsername, getUsername } from './supabaseClient'

function App() {
  const [throwData, setThrowData] = useState<{
    height: number,
    flips: number,
    duration: number,
    coords: [number, number, number][]
  } | null>(null)
  const [username, setUsername] = useState<string>('')

  // supabase auth
  const { session, loading } = useEnsureSignedIn()

  // Fetch existing username or generate new one on mount
  useEffect(() => {
    const initUsername = async () => {
      // First, try to fetch existing username from Supabase
      const { username: existingUsername } = await getUsername();
      
      if (existingUsername) {
        // User already has a username, use it
        console.log('Using existing username:', existingUsername);
        setUsername(existingUsername);
      } else {
        // No existing username, generate a new one
        const newUsername = generateRandomUsername();
        console.log('Generated new username:', newUsername);
        setUsername(newUsername);
        await updateUsername(newUsername);
      }
    };
    
    if (!loading && session && !username) {
      initUsername();
    }
  }, [loading, session, username])


  const HomePage = () => {
    const navigate = useNavigate();
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white relative">
        {/* Session info/debug widget */}
        <div className="absolute top-4 right-4 text-xs text-gray-300 bg-white/5 border border-white/10 rounded px-3 py-2 max-w-[50vw] overflow-auto">
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
          onClick={() => navigate('/instructions')}
          className="relative w-48 h-48 bg-red-600 rounded-full hover:bg-red-700 transition-all transform hover:scale-105 shadow-2xl"
        >
          <span className="text-4xl font-bold text-white">GO</span>
        </button>
      </div>
    )
  }

  return (
    <div className="bg-slate-800">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="/start" element={<Start />} />
        <Route path="/play" element={<Play throwData={throwData} setThrowData={setThrowData} />} />
        <Route 
          path="/postthrow" 
          element={
            throwData ? (
              <PostThrow 
                height={throwData.height}
                flips={throwData.flips}
                duration={throwData.duration}
                coords={throwData.coords}
              />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/leaderboard" 
          element={
            <Leaderboard 
              username={username}
              onUsernameChange={setUsername}
            />
          } 
        />
      </Routes>
    </div>
  )
}

export default App;

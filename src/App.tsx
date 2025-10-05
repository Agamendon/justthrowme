import { useState } from 'react'
import { Routes, Route, Navigate } from "react-router-dom";
import { Instructions } from './pages/Instructions'
import { Disclaimer } from './pages/Disclaimer'
import { Start } from './pages/Start'
import { Play } from './pages/Play'
import { PostThrow } from './pages/PostThrow'
import { Leaderboard } from './pages/Leaderboard'
import { Home as HomePage } from './pages/Home'
import { Analytics } from "@vercel/analytics/react"

function App() {
  const [throwData, setThrowData] = useState<{
    height: number,
    flips: number,
    duration: number,
    coords: [number, number, number][]
  } | null>(null)
  const [username, setUsername] = useState<string>('')

  return (
    <div className="bg-slate-800">
      <Analytics/>
      <Routes>
        <Route path="/" element={<HomePage username={username} setUsername={setUsername} />} />
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


import { Routes, Route, useNavigate } from 'react-router-dom'
import { Home } from './pages/Home'
import { Instructions } from './pages/Instructions'
import { Disclaimer } from './pages/Disclaimer'
import { Start } from './pages/Start'

function App() {
  const navigate = useNavigate()
  const handleNextFromInstructions = () => {
    navigate('/disclaimer')
  }

  const handleNextFromDisclaimer = () => {
    navigate('/start')
  }

  const handleSkip = () => {
    navigate('/start')
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route 
        path="/instructions" 
        element={
          <div className="min-h-screen bg-black">
            <Instructions onNext={handleNextFromInstructions} onSkip={handleSkip} />
          </div>
        } 
      />
      <Route 
        path="/disclaimer" 
        element={
          <div className="min-h-screen bg-black">
            <Disclaimer onNext={handleNextFromDisclaimer} onSkip={handleSkip} />
          </div>
        } 
      />
      <Route 
        path="/start" 
        element={
          <div className="min-h-screen bg-black">
            <Start />
          </div>
        } 
      />
    </Routes>
  )
}

export default App
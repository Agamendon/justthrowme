import { useState } from 'react'
import { Instructions } from './pages/Instructions'
import { Disclaimer } from './pages/Disclaimer'
import { Start } from './pages/Start'

type PageState = 'home' | 'instructions' | 'disclaimer' | 'start'

function App() {
  const [currentPage, setCurrentPage] = useState<PageState>('home')

  const handleStart = () => {
    setCurrentPage('instructions')
  }

  const handleClose = () => {
    setCurrentPage('home')
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

  if (currentPage === 'home') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
        <h1 className="text-6xl font-bold mb-12">JustThrowMe</h1>
        <button
          onClick={handleStart}
          className="relative w-48 h-48 bg-red-600 rounded-full hover:bg-red-700 transition-all transform hover:scale-105 shadow-2xl"
        >
          <span className="text-4xl font-bold text-white">GO</span>
        </button>
        <p className="mt-8 text-gray-400">Click GO to begin</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      {currentPage === 'instructions' && (
        <Instructions onNext={handleNext} onSkip={handleSkip} />
      )}
      {currentPage === 'disclaimer' && (
        <Disclaimer onNext={handleNext} onSkip={handleSkip} />
      )}
      {currentPage === 'start' && (
        <Start onClose={handleClose} />
      )}
    </div>
  )
}

export default App

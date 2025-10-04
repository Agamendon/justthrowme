import { useNavigate } from 'react-router-dom'

export function Home() {
  const navigate = useNavigate()

  const handleStart = () => {
    navigate('/instructions')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <h1 className="text-6xl font-bold mb-12 text-white">JustThrowMe</h1>
      <button
        onClick={handleStart}
        className="relative w-48 h-48 bg-green-300 rounded-full hover:bg-green-400 transition-all transform hover:scale-105 shadow-2xl border-4 border-green-300"
      >
        <span className="text-4xl font-bold text-black">GO</span>
      </button>
      <p className="mt-8 text-white">Click GO to begin</p>
    </div>
  )
}
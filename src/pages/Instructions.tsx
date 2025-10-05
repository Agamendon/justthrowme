import { useNavigate } from 'react-router-dom';

export function Instructions() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col bg-slate-800 text-white" style={{ height: '100dvh' }}>
      <div className="flex-1 flex items-center justify-center px-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="w-full max-w-md bg-gray-800 p-5">
          <h1 className="text-4xl font-bold mb-8 text-center text-white alfa-slab-one-regular">INSTRUCTIONS</h1>
          <div className="text-center space-y-4 mb-8">
            <p className="text-lg text-white alfa-slab-one-regular">
              Here's how to play:
            </p>
            <ul className="text-left space-y-2 text-lg alfa-slab-one-regular">
              <li>1. Throw your phone</li>
              <li>2. Catch it</li>
              <li>3. Share your results</li>
            </ul>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/disclaimer')}
              className="flex-1 py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-bold transition-colors alfa-slab-one-regular border-t-4 border-l-4 border-b-2 border-r-2 border-t-green-400 border-l-green-400 border-b-green-900 border-r-green-900"
            >
              CONTINUE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

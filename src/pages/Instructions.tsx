interface InstructionsProps {
  onNext: () => void;
  onSkip: () => void;
}

export function Instructions({ onNext, onSkip }: InstructionsProps) {
  return (
    <div className="flex flex-col bg-slate-800 text-white" style={{ height: '100dvh' }}>
      <div className="flex-1 flex items-center justify-center px-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="w-full max-w-md bg-gray-800 p-5">
          <h1 className="text-4xl font-bold mb-8 text-center text-white alfa-slab-one-regular">INSTRUCTIONS</h1>
          <div className="text-center space-y-4 mb-8">
            <p className="text-lg text-white alfa-slab-one-regular">
              Welcome to JustThrowMe! Here's how to play:
            </p>
            <ul className="text-left space-y-2 text-lg alfa-slab-one-regular">
              <li>Step 1: Get ready for the experience</li>
              <li>Step 2: Follow the on-screen prompts</li>
              <li>Step 3: Have fun and stay safe</li>
            </ul>
          </div>
          <div className="flex gap-4">
            <button
              onClick={onSkip}
              className="flex-1 py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors alfa-slab-one-regular border-t-4 border-l-4 border-b-2 border-r-2 border-t-gray-500 border-l-gray-500 border-b-gray-900 border-r-gray-900"
            >
              SKIP
            </button>
            <button
              onClick={onNext}
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
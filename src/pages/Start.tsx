interface StartProps {
  onStart: () => void;
}

export function Start({ onStart }: StartProps) {
  return (
    <div className="flex flex-col bg-slate-800 text-white" style={{ height: '100dvh' }}>
      <div className="flex-1 flex items-center justify-center px-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="w-full max-w-md bg-gray-800 p-5">
          <h1 className="text-6xl font-bold mb-8 text-white text-center alfa-slab-one-regular">LET'S GO!</h1>
          <div className="text-center space-y-6">
            <div className="flex flex-col items-center">
              <button
                onClick={onStart}
                className="w-full py-6 bg-green-600 hover:bg-green-700 text-white text-2xl font-bold transition-colors alfa-slab-one-regular border-t-4 border-l-4 border-b-2 border-r-2 border-t-green-400 border-l-green-400 border-b-green-900 border-r-green-900"
              >
                THROW
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
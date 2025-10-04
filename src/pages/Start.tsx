interface StartProps {
  onStart: () => void;
}

export function Start({ onStart }: StartProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white">
      <h1 className="text-6xl font-bold mb-8 text-white">Let's Go!</h1>
      <div className="text-center space-y-6">
        <p className="text-2xl text-white">
          You're all set and ready to begin.
        </p>
        <div className="flex flex-col items-center space-y-4">
          <button
            onClick={onStart}
            className="px-12 py-6 bg-green-500 text-white text-2xl font-bold rounded-full hover:bg-green-600 transition-colors animate-pulse"
          >
            START NOW
          </button>
        </div>
      </div>
    </div>
  );
}
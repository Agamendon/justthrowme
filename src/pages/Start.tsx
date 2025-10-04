interface StartProps {
  onClose: () => void;
}

export function Start({ onClose }: StartProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white">
      <h1 className="text-6xl font-bold mb-8">Let's Go!</h1>
      <div className="text-center space-y-6">
        <p className="text-2xl">
          You're all set and ready to begin.
        </p>
        <div className="flex flex-col items-center space-y-4">
          <button
            className="px-12 py-6 bg-green-500 text-white text-2xl font-bold rounded-full hover:bg-green-600 transition-colors animate-pulse"
          >
            START NOW
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-white rounded-lg hover:bg-white hover:text-black transition-colors"
          >
            Exit Fullscreen
          </button>
        </div>
      </div>
    </div>
  );
}
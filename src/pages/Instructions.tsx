interface InstructionsProps {
  onNext: () => void;
  onSkip: () => void;
}

export function Instructions({ onNext, onSkip }: InstructionsProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white">
      <h1 className="text-4xl font-bold mb-8 text-white">Instructions</h1>
      <div className="max-w-2xl text-center space-y-4 mb-8">
        <p className="text-lg text-white">
          Welcome to JustThrowMe! Here's how to play:
        </p>
        <ul className="text-left space-y-2 text-lg">
          <li>Step 1: Get ready for the experience</li>
          <li>Step 2: Follow the on-screen prompts</li>
          <li>Step 3: Have fun and stay safe</li>
        </ul>
      </div>
      <div className="flex gap-4">
        <button
          onClick={onSkip}
          className="px-6 py-3 border-2 border-white text-white rounded-lg hover:bg-white hover:text-black transition-colors"
        >
          Skip to Start
        </button>
        <button
          onClick={onNext}
          className="px-6 py-3 bg-green-300 text-black rounded-lg hover:bg-green-400 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
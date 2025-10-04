interface DisclaimerProps {
  onNext: () => void;
  onSkip: () => void;
}

export function Disclaimer({ onNext, onSkip }: DisclaimerProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white">
      <h1 className="text-4xl font-bold mb-8">Disclaimer</h1>
      <div className="max-w-2xl text-center space-y-4 mb-8">
        <p className="text-lg font-semibold">
          Please read and acknowledge before continuing:
        </p>
        <div className="bg-white/10 p-6 rounded-lg text-left space-y-3">
          <p>
            By proceeding, you acknowledge that:
          </p>
          <ul className="space-y-2 ml-4">
            <li>" This is for entertainment purposes only</li>
            <li>" You participate at your own risk</li>
            <li>" You are responsible for your own safety</li>
            <li>" You agree to all terms and conditions</li>
          </ul>
        </div>
      </div>
      <div className="flex gap-4">
        <button
          onClick={onSkip}
          className="px-6 py-3 border-2 border-white rounded-lg hover:bg-white hover:text-black transition-colors"
        >
          Skip to Start
        </button>
        <button
          onClick={onNext}
          className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors"
        >
          I Agree & Continue
        </button>
      </div>
    </div>
  );
}
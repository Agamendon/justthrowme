interface DisclaimerProps {
  onNext: () => void;
  onSkip: () => void;
  onPermissionsEnabled?: () => void;
}

export function Disclaimer({ onNext, onSkip, onPermissionsEnabled }: DisclaimerProps) {
  const requestPermissions = async () => {
    try {
      const dm: any = (window as any).DeviceMotionEvent;
      const dor: any = (window as any).DeviceOrientationEvent;
      const needsPermission =
        (dm && typeof dm.requestPermission === "function") ||
        (dor && typeof dor.requestPermission === "function");

      if (needsPermission) {
        const reqs: Promise<string>[] = [];
        if (dm?.requestPermission) reqs.push(dm.requestPermission());
        if (dor?.requestPermission) reqs.push(dor.requestPermission());
        const results = await Promise.allSettled(reqs);
        const ok = results.some(
          (r) => r.status === "fulfilled" && r.value === "granted"
        );
        if (!ok) throw new Error("Motion/Orientation permission was not granted");
      }
      
      onPermissionsEnabled?.();
      onNext();
    } catch (err) {
      alert("Could not enable sensor permissions. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-black overflow-hidden">
      <div className="flex flex-col items-center justify-center h-full p-8 text-white">
        <h1 className="text-4xl font-bold mb-8 text-white">Disclaimer</h1>
        <div className="max-w-2xl text-center space-y-4 mb-8">
          <p className="text-lg font-semibold text-white">
            Please read and acknowledge before continuing:
          </p>
          <div className="bg-black border border-white/30 p-6 rounded-lg text-left space-y-3">
            <p className="text-white">By proceeding, you acknowledge that:</p>
            <ul className="space-y-2 ml-4 text-white">
              <li className="flex items-start">
                <span className="text-green-300 mr-2">⚠</span> This is for
                entertainment purposes only
              </li>
              <li className="flex items-start">
                <span className="text-green-300 mr-2">⚠</span> You participate
                at your own risk
              </li>
              <li className="flex items-start">
                <span className="text-green-300 mr-2">⚠</span> You are
                responsible for your own safety
              </li>
              <li className="flex items-start">
                <span className="text-green-300 mr-2">⚠</span> You agree to all
                terms and conditions
              </li>
            </ul>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={onSkip}
            className="px-6 py-3 border-2 border-white text-white rounded-lg hover:bg-white hover:text-black transition-colors"
          >
            Skip to Start
          </button>
          <button
            onClick={requestPermissions}
            className="px-6 py-3 bg-green-300 text-black rounded-lg hover:bg-green-400 transition-colors"
          >
            I Agree
          </button>
        </div>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';

export function Disclaimer() {
  const navigate = useNavigate();
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
      
      navigate('/start');
    } catch (err) {
      alert("Could not enable sensor permissions. Please try again.");
    }
  };

  return (
    <div className="flex flex-col bg-slate-800 text-white" style={{ height: '100dvh' }}>
      <div className="flex-1 flex items-center justify-center px-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="w-full max-w-md bg-gray-800 p-5">
          <h1 className="text-4xl font-bold mb-8 text-center text-white alfa-slab-one-regular">DISCLAIMER</h1>
          <div className="text-center space-y-4 mb-8">
            <p className="text-lg font-semibold text-white alfa-slab-one-regular">
              Please read and acknowledge before continuing:
            </p>
            <div className="bg-gray-900 p-6 text-left space-y-3 border-t-2 border-l-2 border-b border-r border-t-gray-700 border-l-gray-700 border-b-black border-r-black">
              <p className="text-white alfa-slab-one-regular">
                By proceeding, you acknowledge that:
              </p>
              <ul className="space-y-2 ml-4 alfa-slab-one-regular">
                <li>This is for entertainment purposes only</li>
                <li>You participate at your own risk</li>
                <li>You are responsible for your own safety</li>
                <li>You agree to all terms and conditions</li>
              </ul>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/start')}
              className="flex-1 py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors alfa-slab-one-regular border-t-4 border-l-4 border-b-2 border-r-2 border-t-gray-500 border-l-gray-500 border-b-gray-900 border-r-gray-900"
            >
              SKIP
            </button>
            <button
              onClick={requestPermissions}
              className="flex-1 py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-bold transition-colors alfa-slab-one-regular border-t-4 border-l-4 border-b-2 border-r-2 border-t-green-400 border-l-green-400 border-b-green-900 border-r-green-900"
            >
              I AGREE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="flex flex-col text-white" style={{ height: '100dvh' }}>
      <div className="flex-1 flex items-center justify-center px-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="w-full max-w-md bg-white p-5 border-t-4 border-l-4 border-b-2 border-r-2 border-t-gray-300 border-l-gray-300 border-b-gray-600 border-r-gray-600">
          <h1 className="text-4xl font-bold mb-8 text-center text-black alfa-slab-one-regular">!! DISCLAIMER !!</h1>
          <div className="text-center space-y-4 mb-8">
            <div className="bg-red-500 p-6 text-left space-y-3 border-t-4 border-l-4 border-b-2 border-r-2 border-t-red-300 border-l-red-300 border-b-red-900 border-r-red-900">
              <ul className="space-y-2 ml-4 alfa-slab-one-regular">
                <li>Don't break your phone.</li>
                <li>If you do, don't blame us.</li>
                <li>Better have screen protector on.</li>
                <li>Give motion permission.</li>
              </ul>
            </div>
            {/* {permissionError && (
              <div className="bg-red-600 p-3 text-white text-sm alfa-slab-one-regular border-t-2 border-l-2 border-b border-r border-t-red-400 border-l-red-400 border-b-red-900 border-r-red-900">
                {permissionError}
              </div>
            )} */}
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
              'I AGREE'
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

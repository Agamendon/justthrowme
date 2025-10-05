import { useState } from 'react'

interface DisclaimerProps {
  onNext: () => void;
  onSkip: () => void;
}

export function Disclaimer({ onNext, onSkip }: DisclaimerProps) {
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)

  const handleAgree = async () => {
    setIsRequesting(true)
    setPermissionError(null)

    // Check if device motion permission is needed (iOS 13+)
    if (typeof DeviceMotionEvent !== 'undefined' && 
        typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission()
        
        if (permission === 'granted') {
          console.log('Motion sensor permission granted')
          onNext()
        } else {
          console.log('Motion sensor permission denied')
          setPermissionError('Motion sensor access is required to use this app. Please grant permission to continue.')
        }
      } catch (error) {
        console.error('Error requesting motion permission:', error)
        setPermissionError('Failed to request motion sensor permission. Please try again.')
      } finally {
        setIsRequesting(false)
      }
    } else {
      // Not iOS or permission not required, continue normally
      console.log('Motion sensor permission not required on this device')
      onNext()
    }
  }

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
            {permissionError && (
              <div className="bg-red-600 p-3 text-white text-sm alfa-slab-one-regular border-t-2 border-l-2 border-b border-r border-t-red-400 border-l-red-400 border-b-red-900 border-r-red-900">
                {permissionError}
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleAgree}
              disabled={isRequesting}
              className="flex-1 py-3 px-6 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-bold transition-colors alfa-slab-one-regular border-t-4 border-l-4 border-b-2 border-r-2 border-t-green-400 border-l-green-400 border-b-green-900 border-r-green-900 disabled:border-t-green-300 disabled:border-l-green-300"
            >
              {isRequesting ? 'REQUESTING...' : 'I AGREE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
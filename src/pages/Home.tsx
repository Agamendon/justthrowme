import { useState, useEffect } from 'react'
import { useNavigate } from "react-router-dom";
import { FallingBlocks } from '../components/FallingBlocks'
import { useEnsureSignedIn } from '../useSupabaseAuth'
import { generateRandomUsername } from '../utils/usernameGenerator'
import { updateUsername, getUsername } from '../supabaseClient'

interface HomeProps {
  username: string;
  setUsername: (username: string) => void;
}

export function Home({ username, setUsername }: HomeProps) {
  const navigate = useNavigate();
  const [isNewUser, setIsNewUser] = useState<boolean>(false)

  // supabase auth
  const { session, loading } = useEnsureSignedIn()

  // Fetch existing username or generate new one on mount
  useEffect(() => {
    const initUsername = async () => {
      // First, try to fetch existing username from Supabase
      const { username: existingUsername } = await getUsername();

      if (existingUsername) {
        // User already has a username, use it (returning user)
        console.log('Using existing username:', existingUsername);
        setUsername(existingUsername);
        setIsNewUser(false);
      } else {
        // No existing username, generate a new one (new user)
        const newUsername = generateRandomUsername();
        console.log('Generated new username:', newUsername);
        setUsername(newUsername);
        setIsNewUser(true);
        await updateUsername(newUsername);
      }
    };

    if (!loading && session && !username) {
      initUsername();
    }
  }, [loading, session, username])

  return (
    <>
      <FallingBlocks />
      <div className="flex flex-col items-center justify-center min-h-screen text-white relative">
        {/* Session info/debug widget */}
        <div className="absolute top-4 right-4 text-xs text-gray-300 bg-white/5 border border-white/10 rounded px-3 py-2 max-w-[50vw] overflow-auto z-10">
          {loading ? (
            <span>Loading session…</span>
          ) : session ? (
            <div>
              <div className="mb-1">Signed in as:</div>
              <div className="font-mono text-[10px] break-all mb-2">
                {session.user.id}
              </div>
              {username && (
                <div>
                  <div className="mb-1">Username:</div>
                  <div className="font-mono text-[10px] break-all">
                    {username}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span>No session</span>
          )}
        </div>
        <button
          onClick={() => navigate(isNewUser ? "/instructions" : "/play")}
          className="relative w-64 h-64 bg-red-600 rounded-full hover:bg-red-700 transition-all transform hover:scale-105 z-10 border-t-[12px] border-l-[12px] border-b-[6px] border-r-[6px] border-t-red-400 border-l-red-400 border-b-red-900 border-r-red-900"
          style={{ marginTop: "15rem" }}
        >
          <span className="text-5xl font-bold text-white alfa-slab-one-regular">
            GO
          </span>
        </button>
      </div>
    </>
  );
}

import { useEffect, useRef, useState } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient.ts'

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    // 1) Load existing session on first mount (from localStorage)
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!isMounted) return
      setSession(data.session ?? null)
      setLoading(false)
    })

    // 2) Subscribe to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, newSession: Session | null) => {
        setSession(newSession)
      }
    )

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}

/**
 * Ensures the user is signed in. If no session is present after the initial load,
 * it performs an anonymous sign-in exactly once.
 */
export function useEnsureSignedIn(options?: { anonymous?: boolean }) {
  const { anonymous = true } = options ?? {}
  const { session, loading } = useSupabaseAuth()
  const attempted = useRef(false)

  useEffect(() => {
    if (loading) return
    if (attempted.current) return
    if (session) return

    attempted.current = true

    const go = async () => {
      if (anonymous) {
        const { error } = await supabase.auth.signInAnonymously()
        if (error) {
          console.error('Anonymous sign-in failed:', error)
          attempted.current = false // allow retry if you want
        }
      }
      // else: plug in your own sign-in flow here
    }

    void go()
  }, [anonymous, loading, session])

  return { session, loading }
}
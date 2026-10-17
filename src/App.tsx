import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import SignInPage from './components/SignInPage'
import CaseList from './components/CaseList'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load the current session, then keep it in sync as the user signs in or out.
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message)
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession))
    return () => data.subscription.unsubscribe()
  }, [])

  async function signOut() {
    setError(null)
    const { error } = await supabase.auth.signOut()
    if (error) setError(error.message)
  }

  if (loading) {
    return (
      <main className="landing">
        <p className="muted" role="status">Loading…</p>
      </main>
    )
  }

  if (!session) return <SignInPage />

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="logo">MoMo Trail</span>
          <div className="account">
            <span className="email">{session.user.email}</span>
            <button className="btn btn-on-red" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </header>
      <main>
        {error && <p className="error" role="alert">{error}</p>}
        <CaseList />
      </main>
    </>
  )
}

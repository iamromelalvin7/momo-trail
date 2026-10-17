import { useState } from 'react'
import { supabase } from '../supabase'

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // prompt=select_account makes Google show its account chooser instead of reusing the last account.
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
    })
    if (error) setError(error.message)
  }

  return (
    <main className="landing">
      <div className="hero">
        <span className="brand-mark" aria-hidden="true" />
        <h1>MoMo Trail</h1>
        <p>Log your mobile money problems in one private place and follow each case until it is resolved.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-large" onClick={signIn}>Continue with Google</button>
      </div>
    </main>
  )
}

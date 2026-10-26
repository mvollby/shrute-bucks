import { useState } from 'react'
import { supabase } from '../supabaseClient'

type Mode = 'login' | 'signup'

// Gates the whole app behind Supabase Auth (email/password). Supabase
// handles the actual hashing/session/token mechanics -- this is just the
// form. Deliberately two explicit actions (Log In / Create Account)
// rather than one smart button: Supabase's API doesn't expose "does this
// email already have an account" (by design, to avoid email enumeration),
// so there's no way to silently pick the right one for the user.
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) setError(signInError.message)
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) {
          setError(signUpError.message)
        } else if (!data.session) {
          // Email confirmation is on for this project -- there's no
          // session yet until the user clicks the link Supabase just
          // emailed them.
          setInfo('Account created. Check your email to confirm it before logging in.')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  if (!supabase) {
    return (
      <div id="app-shell">
        <main>
          <h2>Shrute Bucks needs Supabase configured</h2>
          <p>
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (project
            Settings → API) as environment variables, then rebuild.
          </p>
        </main>
      </div>
    )
  }

  return (
    <div id="app-shell">
      <main id="auth-card">
        <h2>{mode === 'login' ? 'Log In' : 'Create Account'}</h2>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <p>
            <label>
              Email
              <br />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
          </p>
          <p>
            <label>
              Password
              <br />
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
          </p>
          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
          {info && <p style={{ color: 'var(--success)' }}>{info}</p>}
          <button type="submit" disabled={busy}>
            {mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>
        <p>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError('')
              setInfo('')
            }}
          >
            {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
          </button>
        </p>
      </main>
    </div>
  )
}

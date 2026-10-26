import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { AuthScreen } from './ui/AuthScreen'
import { DwightAnimator } from './ui/DwightAnimator'
import { PlanScreen } from './ui/PlanScreen'
import { ReviewScreen } from './ui/ReviewScreen'
import { TransactionsScreen } from './ui/TransactionsScreen'
import { activateUserDatabase } from './db/db'
import { startCloudSync, type CloudSyncHandle, type CloudSyncStatus } from './db/cloudSync'
import { supabase } from './supabaseClient'

const TABS = ['Plan', 'Reflect', 'All Accounts'] as const
type Tab = (typeof TABS)[number]

function App() {
  const [tab, setTab] = useState<Tab>('Plan')
  // undefined = still checking for an existing session; null = signed out.
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [budgetReady, setBudgetReady] = useState(false)
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('syncing')
  const [cloudMessage, setCloudMessage] = useState('Preparing your budget…')
  const [syncHandle, setSyncHandle] = useState<CloudSyncHandle | null>(null)
  const userId = session?.user.id

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      return
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) {
      setBudgetReady(false)
      setSyncHandle(null)
      return
    }

    let cancelled = false
    let handle: CloudSyncHandle | null = null
    setBudgetReady(false)
    setCloudStatus('syncing')
    setCloudMessage('Preparing your budget…')

    void (async () => {
      try {
        await activateUserDatabase(userId)
        if (cancelled || !supabase) return
        handle = await startCloudSync(supabase, userId, (status, message) => {
          if (cancelled) return
          setCloudStatus(status)
          setCloudMessage(message ?? '')
        })
        if (cancelled) {
          handle.stop()
          return
        }
        setSyncHandle(handle)
        setBudgetReady(true)
      } catch (error) {
        if (cancelled) return
        setCloudStatus('error')
        setCloudMessage(error instanceof Error ? error.message : 'Could not open your budget.')
        setBudgetReady(true)
      }
    })()

    return () => {
      cancelled = true
      handle?.stop()
    }
  }, [userId])

  if (session === undefined) return <p>Loading...</p>
  if (!session) return <AuthScreen />
  if (!budgetReady) return <p>Loading your budget…</p>

  return (
    <div id="app-shell">
      <header className="app-header">
        <div className="brand-lockup"><img src="/brand/logo.png" alt="Shrute Bucks" id="corner-logo" />
          <span>Schrute Farms Budget Book</span></div>
        <DwightAnimator />
        <div className="header-actions">
          <p id="cloud-status" aria-live="polite">
          {cloudMessage}{' '}
          {cloudStatus === 'error' && (
            <button type="button" onClick={() => syncHandle?.syncNow()}>Retry sync</button>
          )}
          </p>
          <button id="logout-button" type="button" onClick={() => void supabase?.auth.signOut()}>Log Out</button>
        </div>
      </header>
      <div id="app-layout">
        <aside className="sidebar">
          <p className="sidebar-label">BUDGET</p>
          <nav aria-label="Main sections">
            {TABS.map((t) => <button className={`nav-item ${t === tab ? 'active' : ''}`} key={t} type="button"
              onClick={() => setTab(t)} aria-current={t === tab ? 'page' : undefined}>
              <span className="nav-icon" aria-hidden="true">{t === 'Plan' ? '▤' : t === 'Reflect' ? '▥' : '▦'}</span>{t}
            </button>)}
          </nav>
          <p className="sidebar-footnote">Plan ahead.<br />Spend on purpose.</p>
        </aside>
        <main>
          {tab === 'Plan' && <PlanScreen />}
          {tab === 'Reflect' && <ReviewScreen />}
          {tab === 'All Accounts' && <TransactionsScreen />}
        </main>
      </div>
    </div>
  )
}

export default App

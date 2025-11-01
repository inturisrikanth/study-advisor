// app/app/visa/page.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import VisaLivePanel from './LiveInterview'
import { VISA_QA } from './qna'
import { supabaseClient as supabase } from '../../../lib/supabaseClient'
import { getMyCredits } from '../../../lib/credits'
import type { VisaFeedback } from './hooks/useVisaLive'

// ----- tabs -----
type VisaTab = 'intro' | 'phase1' | 'phase2'
const TAB_HASHES: Record<VisaTab, `#${VisaTab}`> = {
  intro: '#intro',
  phase1: '#phase1',
  phase2: '#phase2',
}
const TAB_STORAGE_KEY = 'visa_active_tab_v1'
const PRACTICE_KEY = 'visa_practiced_ids_v1'
const INTERVIEW_PRICE_CREDITS = 2
const FEEDBACK_STORAGE_KEY = 'visa_live_last_feedback'

export default function VisaGuidancePage() {
  // 1) auth gate
  useEffect(() => {
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = `${location.origin}/auth`
      }
    })()
  }, [])

  // 2) tab state
  const [tab, setTab] = useState<VisaTab>('intro')
  useEffect(() => {
    const initial =
      (location.hash?.replace('#', '') as VisaTab) ||
      (localStorage.getItem(TAB_STORAGE_KEY) as VisaTab) ||
      'intro'
    const normalized: VisaTab = (['intro', 'phase1', 'phase2'] as VisaTab[]).includes(initial) ? initial : 'intro'
    setTab(normalized)
    if (!location.hash || location.hash !== TAB_HASHES[normalized]) {
      history.replaceState(null, '', TAB_HASHES[normalized])
    }
  }, [])
  useEffect(() => {
    if (!tab) return
    localStorage.setItem(TAB_STORAGE_KEY, tab)
    const targetHash = TAB_HASHES[tab]
    if (location.hash !== targetHash) {
      history.replaceState(null, '', targetHash)
    }
  }, [tab])

  // 3) Phase 1 state (RESTORED)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [practiced, setPracticed] = useState<Set<string>>(new Set())
  const [showOnlyUnpracticed, setShowOnlyUnpracticed] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  const copyAnswer = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1200)
    } catch {
      /* ignore */
    }
  }

  const expandAll = () => {
    listRef.current?.querySelectorAll('details').forEach((d) => {
      ;(d as HTMLDetailsElement).open = true
    })
  }
  const collapseAll = () => {
    listRef.current?.querySelectorAll('details').forEach((d) => {
      ;(d as HTMLDetailsElement).open = false
    })
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRACTICE_KEY)
      if (raw) {
        const ids: string[] = JSON.parse(raw)
        setPracticed(new Set(ids))
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(PRACTICE_KEY, JSON.stringify(Array.from(practiced)))
    } catch {
      /* ignore */
    }
  }, [practiced])

  const togglePracticed = (id: string) => {
    setPracticed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const markAll = () => setPracticed(new Set(VISA_QA.map((q) => q.id)))
  const clearAll = () => setPracticed(new Set())

  // 4) top credits (header)
  const [credits, setCredits] = useState<number | null>(null)
  useEffect(() => {
    ;(async () => {
      try {
        const c = await getMyCredits()
        setCredits(c)
      } catch {
        setCredits(0)
      }
    })()
  }, [])

  // 5) buy credits modal
  const [showBuyModal, setShowBuyModal] = useState(false)
  const handleBuyCredits = async (which: 'single' | 'bundle') => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const body: any = { which }
      if (user?.id) body.userId = user.id
      if (user?.email) body.email = user.email

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok || !data?.url) {
        alert(data?.error || 'Could not start checkout.')
        return
      }
      localStorage.setItem('last_credit_source', 'visa')
      window.location.href = data.url
    } catch (err) {
      console.error('Buy credits failed:', err)
      alert('Could not start checkout. Please try again.')
    }
  }

  // 6) persistent feedback (SEPARATE)
  const [lastFeedback, setLastFeedback] = useState<VisaFeedback>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY)
    if (raw) {
      try {
        setLastFeedback(JSON.parse(raw))
      } catch {
        /* ignore */
      }
    }
  }, [])

  // ================== Phase 1 content (restored) ==================
  const PhaseOneContent = (
    <div className="card">
      {/* top row: progress + show-only */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <span className="progress-pill">
          ✅ Practiced: <strong>{practiced.size}</strong> / {VISA_QA.length}
        </span>
        <label className="switch" style={{ marginLeft: 'auto' }}>
          <input
            type="checkbox"
            checked={showOnlyUnpracticed}
            onChange={(e) => setShowOnlyUnpracticed(e.target.checked)}
          />
          <span className="muted">Show only unpracticed</span>
        </label>
      </div>

      {/* second row: expand/collapse + mark/clear */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={expandAll}>
            Expand all
          </button>
          <button className="btn secondary" onClick={collapseAll}>
            Collapse all
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={markAll}>
            Mark all
          </button>
          <button className="btn secondary" onClick={clearAll}>
            Clear all
          </button>
        </div>
      </div>

      {/* done-all banner */}
      {practiced.size === VISA_QA.length && VISA_QA.length > 0 ? (
        <div
          className="banner-ok"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}
        >
          <span>
            🎉 You’ve practiced all questions in Phase 1. Review anytime or proceed to{' '}
            <strong>Phase 2 — Live Interview</strong>.
          </span>
          <button className="btn primary" onClick={() => setTab('phase2')}>
            Go to Phase 2
          </button>
        </div>
      ) : null}

      <h2 style={{ margin: '8px 0' }}>Phase 1 — Learning Mode</h2>
      <p className="muted" style={{ lineHeight: 1.5, marginBottom: 12 }}>
        Learn how to answer common F-1 visa interview questions. Each item includes a sample answer and quick preparation
        tips.
      </p>

      <div ref={listRef} style={{ display: 'grid', gap: 10 }}>
        {(showOnlyUnpracticed ? VISA_QA.filter((q) => !practiced.has(q.id)) : VISA_QA).map((item) => (
          <details
            key={item.id}
            style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: 10 }}
          >
            <summary
              style={{
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {practiced.has(item.id) ? <span title="Practiced">✅</span> : <span title="Not practiced">⬜️</span>}
                <span>{item.question}</span>
              </span>
              <span className="chip">{item.category}</span>
            </summary>

            <div style={{ marginTop: 8 }}>
              <div className="check" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={practiced.has(item.id)}
                    onChange={() => togglePracticed(item.id)}
                  />
                  <span className="muted">Mark as practiced</span>
                </label>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <strong>Sample answer:</strong>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {copiedId === item.id ? <span className="muted">✅ Copied!</span> : null}
                  <button
                    className="copy-btn"
                    onClick={() => copyAnswer(item.id, item.answer)}
                    aria-label={`Copy sample answer for ${item.question}`}
                  >
                    ⧉ Copy
                  </button>
                </div>
              </div>

              <div className="muted" style={{ marginBottom: 6 }}>
                {item.answer}
              </div>

              {item.tips?.length ? (
                <ul className="muted" style={{ margin: '6px 0 0 18px' }}>
                  {item.tips.map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </details>
        ))}
      </div>

      {/* back to top (RESTORED) */}
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <a href="#top" className="top-link">
          ↑ Back to top
        </a>
      </div>
    </div>
  )

  // ================== Phase 2 content (live) ==================
  const PhaseTwoContent = (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>Phase 2 — Live Interview</h2>
      <p className="muted" style={{ lineHeight: 1.5, marginBottom: 12 }}>
        Practice a realistic F-1 visa interview with an AI officer. Your last feedback (if any) will stay below.
      </p>

      {/* the actual chat / start / finish */}
      <VisaLivePanel
        onFeedback={(fb) => {
          setLastFeedback(fb)
          if (typeof window !== 'undefined') {
            localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(fb))
          }
        }}
        onCreditsChange={(n) => setCredits(n)}
        onBuyCredits={() => setShowBuyModal(true)}
      />

      {/* persistent FEEDBACK block */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h4 style={{ margin: '0 0 6px' }}>Feedback</h4>
        {lastFeedback ? <FeedbackView feedback={lastFeedback} /> : <p className="muted">No feedback yet.</p>}
      </div>
    </div>
  )

  return (
    <main
      id="top"
      style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px', fontFamily: 'system-ui, Arial, sans-serif' }}
    >
      <style>{styles}</style>

      <header className="vtop">
        <div>
          <strong>Visa Guidance</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/app" className="btn btn-outline">
            🏠 Home
          </Link>
          {/* top-right credits pill (keep this, it's the main one) */}
          <CreditsPill credits={credits} onClick={() => setShowBuyModal(true)} />
        </div>
      </header>

      <div className="layout">
        <aside className="local-rail" role="navigation" aria-label="Visa Guidance sections">
          <div className="rail-title">Sections</div>
          <div className="rail-nav">
            <button
              className={`rail-btn ${tab === 'intro' ? 'active' : ''}`}
              onClick={() => setTab('intro')}
              aria-current={tab === 'intro' ? 'page' : undefined}
            >
              📘 Introduction
            </button>
            <button
              className={`rail-btn ${tab === 'phase1' ? 'active' : ''}`}
              onClick={() => setTab('phase1')}
              aria-current={tab === 'phase1' ? 'page' : undefined}
            >
              🧠 Phase 1 — Learning
            </button>
            <button
              className={`rail-btn ${tab === 'phase2' ? 'active' : ''}`}
              onClick={() => setTab('phase2')}
              aria-current={tab === 'phase2' ? 'page' : undefined}
            >
              🤖 Phase 2 — Live Interview
            </button>
          </div>
        </aside>

        <section style={{ flex: 1 }}>
          {tab === 'intro' && (
            <div className="card">
              <h2 style={{ margin: '0 0 8px' }}>Introduction</h2>
              <p className="muted" style={{ lineHeight: 1.6 }}>
                Welcome to the Visa Guidance section. This space helps you get ready for your F-1 visa interview.
                First review questions in Phase 1, then practice in Phase 2.
              </p>
            </div>
          )}

          {tab === 'phase1' && PhaseOneContent}

          {tab === 'phase2' && PhaseTwoContent}
        </section>
      </div>

      {/* BUY CREDITS MODAL */}
      {showBuyModal && (
        <div className="overlay" onClick={() => setShowBuyModal(false)}>
          <div className="buy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="buy-head">
              <div>
                <strong>Buy credits</strong>
                <p className="muted" style={{ marginTop: 2 }}>
                  Visa live interview needs <strong>{INTERVIEW_PRICE_CREDITS}</strong> credits.
                </p>
                <p className="muted" style={{ marginTop: 2 }}>
                  Your balance: <strong>{credits ?? '—'}</strong>
                </p>
              </div>
              <button className="win-btn danger" onClick={() => setShowBuyModal(false)}>
                ×
              </button>
            </div>
            <div className="buy-body">
              <button className="btn primary" onClick={() => handleBuyCredits('single')}>
                Buy 1 credit — $10
              </button>
              <button className="btn" onClick={() => handleBuyCredits('bundle')}>
                Buy 4 credits — $30
              </button>
              <p className="muted" style={{ fontSize: 12 }}>
                You can use credits anywhere in the dashboard (SOP, Visa, future features).
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

/* ------------- small UI bits ------------- */
function CreditsPill({ credits, onClick }: { credits: number | null; onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn"
      onClick={onClick}
      style={{ background: '#e9f8ef', borderColor: '#b7e3c8', color: '#155e36' }}
      title="Buy / manage credits"
    >
      Credits: <strong>{credits ?? '—'}</strong>
    </button>
  )
}

function FeedbackView({ feedback }: { feedback: VisaFeedback }) {
  if (!feedback) return null

  const hasStructured =
    feedback.overall ||
    (feedback.strengths && feedback.strengths.length > 0) ||
    (feedback.improvements && feedback.improvements.length > 0) ||
    feedback.example_rewrite

  if (hasStructured) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {feedback.overall ? <p className="muted">{feedback.overall}</p> : null}
        {feedback.strengths?.length ? (
          <div>
            <p style={{ fontWeight: 600, marginBottom: 2 }}>Strengths</p>
            <ul className="muted" style={{ marginLeft: 16 }}>
              {feedback.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {feedback.improvements?.length ? (
          <div>
            <p style={{ fontWeight: 600, marginBottom: 2 }}>Improvements</p>
            <ul className="muted" style={{ marginLeft: 16 }}>
              {feedback.improvements.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {feedback.example_rewrite ? (
          <div>
            <p style={{ fontWeight: 600, marginBottom: 2 }}>Example rewrite</p>
            <pre className="muted" style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 6, borderRadius: 6 }}>
              {feedback.example_rewrite}
            </pre>
          </div>
        ) : null}
        {(feedback.total_turns || feedback.ended_at) && (
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            {feedback.total_turns ? `Interview length: ${feedback.total_turns} turns. ` : null}
            {feedback.ended_at ? `Finished at: ${new Date(feedback.ended_at).toLocaleString()}` : null}
          </p>
        )}
      </div>
    )
  }

  if (feedback.text) {
    return (
      <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>
        {feedback.text}
      </pre>
    )
  }

  return <p className="muted">No feedback data.</p>
}

const styles = `
.muted { color:#666; font-size: 13px; }
.card { border:1px solid #ddd; border-radius: 10px; padding: 12px; margin: 10px 0; background:#fff; }
.btn, a.btn { padding:8px 10px; border:1px solid #ccc; background:#f8f8f8; border-radius:6px; cursor:pointer; text-decoration:none; }
.btn.primary { background:#1e40af; color:#fff; border-color:#1e40af; }
.btn.secondary { background:#eef2ff; border-color:#d4d8ff; }
.btn-outline { background:#fff; border-color:#ccc; }
header.vtop { display:flex; justify-content:space-between; align-items:center; margin:12px 0; padding:8px 0; border-bottom:1px solid #eee; }

.layout { display:flex; gap:16px; min-height: calc(100vh - 120px); }
aside.local-rail { width: 240px; border-right: 1px solid #eee; padding-right: 12px; }
.rail-title { font-weight: 600; margin: 6px 0 10px; }
.rail-nav { display:flex; flex-direction:column; gap:6px; }
.rail-btn { text-align:left; padding:8px 10px; border:none; background:transparent; border-radius:8px; cursor:pointer; }
.rail-btn.active { background:#e9ecef; }

@media (max-width: 800px) {
  .layout { flex-direction: column; }
  aside.local-rail { width: 100%; border-right: none; border-bottom: 1px solid #eee; padding-bottom: 12px; }
  .rail-nav { flex-direction: row; flex-wrap: wrap; gap:8px; }
}

.progress-pill { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; background:#eef9f2; color:#0f5132; border:1px solid #cfe7da; font-size:13px; }
.chip { display:inline-block; padding:2px 8px; border-radius:999px; border:1px solid #ddd; font-size:12px; margin-left:8px; background:#f9fafb; }
.copy-btn { padding:6px 8px; border:1px solid #ccc; background:#fff; border-radius:6px; cursor:pointer; }
.check { display:inline-flex; align-items:center; gap:6px; }
.banner-ok { background:#eaf7ef; border:1px solid #cfe7da; color:#0f5132; border-radius:10px; padding:10px 12px; margin:10px 0; }
.top-link { text-decoration:none; }
.panel { border:1px solid #eee; border-radius:10px; padding:10px; background:#fff; }

.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; z-index: 999; }
.buy-modal { width: min(460px, 96vw); background:#fff; border:1px solid #e5e7eb; border-radius: 14px; overflow:hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.25); display:flex; flex-direction:column; }
.buy-head { padding:12px 14px; border-bottom:1px solid #eee; display:flex; align-items:center; justify-content:space-between; }
.buy-body { padding:14px; display:flex; flex-direction:column; gap:10px; }
.win-btn.danger { background:#ffeaea; border:1px solid #f5b5b5; color:#8a1f1f; }
`

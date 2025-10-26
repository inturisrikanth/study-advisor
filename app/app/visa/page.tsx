'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { VISA_QA } from './qna'
import { supabaseClient as supabase } from '../../../lib/supabaseClient'

type VisaTab = 'intro' | 'phase1' | 'phase2'
const TAB_HASHES: Record<VisaTab, `#${VisaTab}`> = {
  intro: '#intro',
  phase1: '#phase1',
  phase2: '#phase2',
}
const TAB_STORAGE_KEY = 'visa_active_tab_v1'
const PRACTICE_KEY = 'visa_practiced_ids_v1'

export default function VisaGuidancePage() {
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = `${location.origin}/auth`
      }
    })()
  }, [])
  const [tab, setTab] = useState<VisaTab>('intro')

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copyAnswer = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1200)
    } catch {}
  }

  const [practiced, setPracticed] = useState<Set<string>>(new Set())

  const [showOnlyUnpracticed, setShowOnlyUnpracticed] = useState(false)

  const listRef = useRef<HTMLDivElement | null>(null)

  const expandAll = () => {
    listRef.current?.querySelectorAll('details').forEach(d => {
      (d as HTMLDetailsElement).open = true
    })
  }
  const collapseAll = () => {
    listRef.current?.querySelectorAll('details').forEach(d => {
      (d as HTMLDetailsElement).open = false
    })
  }


  // init from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRACTICE_KEY)
      if (raw) {
        const ids: string[] = JSON.parse(raw)
        setPracticed(new Set(ids))
      }
    } catch {}
  }, [])

  // persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PRACTICE_KEY, JSON.stringify(Array.from(practiced)))
    } catch {}
  }, [practiced])

  const togglePracticed = (id: string) => {
    setPracticed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const markAll = () => setPracticed(new Set(VISA_QA.map(q => q.id)))
  const clearAll = () => setPracticed(new Set())


  // Initialize active tab from hash or localStorage
  useEffect(() => {
    const initial =
      (location.hash?.replace('#', '') as VisaTab) ||
      (localStorage.getItem(TAB_STORAGE_KEY) as VisaTab) ||
      'intro'
    const normalized: VisaTab = (['intro','phase1','phase2'] as VisaTab[]).includes(initial) ? initial : 'intro'
    setTab(normalized)
    if (!location.hash || location.hash !== TAB_HASHES[normalized]) {
      history.replaceState(null, '', TAB_HASHES[normalized])
    }
  }, [])

  // Keep hash + localStorage in sync when tab changes
  useEffect(() => {
    if (!tab) return
    localStorage.setItem(TAB_STORAGE_KEY, tab)
    const targetHash = TAB_HASHES[tab]
    if (location.hash !== targetHash) {
      history.replaceState(null, '', targetHash)
    }
  }, [tab])

  // Small helper to render the Phase 1 Q&A list
  const PhaseOneContent = (
    <div className="card">
      {/* Row 1 — progress (left) + filter (right) */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:8, flexWrap:'wrap' }}>
        <span className="progress-pill">
          ✅ Practiced: <strong>{practiced.size}</strong> / {VISA_QA.length}
        </span>
        <label className="switch" style={{ marginLeft:'auto' }}>
          <input
            type="checkbox"
            checked={showOnlyUnpracticed}
            onChange={(e) => setShowOnlyUnpracticed(e.target.checked)}
          />
          <span className="muted">Show only unpracticed</span>
        </label>
      </div>

      {/* Row 2 — view actions (left) + completion actions (right) */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:8, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={expandAll}>Expand all</button>
          <button className="btn" onClick={collapseAll}>Collapse all</button>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={markAll}>Mark all</button>
          <button className="btn" onClick={clearAll}>Clear all</button>
        </div>
      </div>

      {/* Completion banner */}
      {practiced.size === VISA_QA.length && VISA_QA.length > 0 ? (
        <div className="banner-ok" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <span>🎉 You’ve practiced all questions in Phase 1. Review anytime or proceed to <strong>Phase 2 — Mock Interview</strong>.</span>
          <button className="btn" onClick={() => setTab('phase2')}>Go to Phase 2</button>
        </div>
      ) : null}

      <h2 style={{ margin: '8px 0' }}>Phase 1 — Learning Mode</h2>
      <p className="muted" style={{ lineHeight: 1.5, marginBottom: 12 }}>
        Learn how to answer common F-1 visa interview questions. Each item includes a sample answer and quick preparation tips.
      </p>

      {/* List wrapper with ref (for expand/collapse all) */}
      <div ref={listRef} style={{ display:'grid', gap: 10 }}>
        {(showOnlyUnpracticed ? VISA_QA.filter(q => !practiced.has(q.id)) : VISA_QA).map(item => (
          <details key={item.id} style={{ background:'#fafafa', border:'1px solid #eee', borderRadius:8, padding:10 }}>
            <summary style={{ fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                {practiced.has(item.id) ? <span title="Practiced">✅</span> : <span title="Not practiced">⬜️</span>}
                <span>{item.question}</span>
              </span>
              <span className="chip">{item.category}</span>
            </summary>

            <div style={{ marginTop:8 }}>
              {/* Mark as practiced */}
              <div className="check" style={{ justifyContent:'space-between', marginBottom:6 }}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={practiced.has(item.id)}
                    onChange={() => togglePracticed(item.id)}
                  />
                  <span className="muted">Mark as practiced</span>
                </label>
              </div>

              {/* Copy sample answer */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:6 }}>
                <strong>Sample answer:</strong>
                <div style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
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

              <div className="muted" style={{ marginBottom:6 }}>{item.answer}</div>

              {item.tips?.length ? (
                <ul className="muted" style={{ margin:'6px 0 0 18px' }}>
                  {item.tips.map((t,idx)=><li key={idx}>{t}</li>)}
                </ul>
              ) : null}
            </div>
          </details>
        ))}
      </div>

      <div className="muted" style={{ marginTop: 16 }}>
        ⚙️ Phase 2 (Coming Soon): Practice these questions in a live AI mock interview.
      </div>

      <div style={{ marginTop: 16, textAlign:'right' }}>
        <a href="#top" className="top-link">↑ Back to top</a>
      </div>
    </div>
  )




  return (
    <main id="top" style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px', fontFamily: 'system-ui, Arial, sans-serif' }}>
      {/* Minimal local styles to match your dashboard look */}
      <style>{`
        .muted { color:#666; font-size: 13px; }
        .card { border:1px solid #ddd; border-radius: 10px; padding: 12px; margin: 10px 0; background:#fff; }
        .btn { padding:8px 10px; border:1px solid #ccc; background:#f8f8f8; border-radius:6px; cursor:pointer; }
        .btn:hover { background:#f0f0f0; }
        .btn-outline { background:#fff; border-color:#ccc; color:#333; text-decoration:none; display:inline-block; }
        header.vtop { display:flex; justify-content:space-between; align-items:center; margin:12px 0; padding:8px 0; border-bottom:1px solid #eee; }

        .layout { display:flex; gap:16px; min-height: calc(100vh - 120px); }
        aside.local-rail { width: 240px; border-right: 1px solid #eee; padding-right: 12px; }
        .rail-title { font-weight: 600; margin: 6px 0 10px; }
        .rail-nav { display:flex; flex-direction:column; gap:6px; }
        .rail-btn { text-align:left; padding:8px 10px; border:none; background:transparent; border-radius:8px; cursor:pointer; }
        .rail-btn.active { background:#e9ecef; }
        .rail-btn:focus { outline: 2px solid #cfe7da; }

        @media (max-width: 800px) {
          .layout { flex-direction: column; }
          aside.local-rail { width: 100%; border-right: none; border-bottom: 1px solid #eee; padding-bottom: 12px; }
          .rail-nav { flex-direction: row; flex-wrap: wrap; gap:8px; }
        }
        .chip { display:inline-block; padding:2px 8px; border-radius:999px; border:1px solid #ddd; font-size:12px; margin-left:8px; background:#f9fafb; }
        .copy-btn { padding:6px 8px; border:1px solid #ccc; background:#fff; border-radius:6px; cursor:pointer; }
        .copy-btn:hover { background:#f8f8f8; }
        .top-link { text-decoration:none; }
        .progress-pill { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; background:#eef9f2; color:#0f5132; border:1px solid #cfe7da; font-size:13px; }
        .check { display:inline-flex; align-items:center; gap:6px; }
        .banner-ok { background:#eaf7ef; border:1px solid #cfe7da; color:#0f5132; border-radius:10px; padding:10px 12px; margin:10px 0; }
        .switch { display:inline-flex; align-items:center; gap:8px; }
      `}</style>

      {/* ===== Top bar with Home button ===== */}
      <header className="vtop">
        <div><strong>Visa Guidance</strong></div>
        <div>
          <Link href="/app" className="btn btn-outline">🏠 Home</Link>
        </div>
      </header>

      {/* ===== Page layout with local left rail tabs ===== */}
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
              🤖 Phase 2 — Mock Interview
            </button>
          </div>
        </aside>

        <section style={{ flex: 1 }}>
          {tab === 'intro' && (
            <div className="card">
              <h2 style={{ margin: '0 0 8px' }}>Introduction</h2>
              <p className="muted" style={{ lineHeight: 1.6 }}>
                Welcome to the Visa Guidance section. This space is designed to help you prepare for your F-1 visa interview.
                We’re rolling it out in two phases:
              </p>
              <ul className="muted" style={{ margin: '8px 0 0 18px', lineHeight: 1.5 }}>
                <li><strong>Phase 1 — Learning:</strong> Review common interview questions with sample answers and quick tips.</li>
                <li><strong>Phase 2 — Mock Interview (coming soon):</strong> Practice live with an AI interviewer and get instant feedback.</li>
              </ul>
              <p className="muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
                Tip: Read each sample answer, then personalize it with your own program, university, and plans. Keep your responses
                concise, confident, and truthful.
              </p>
            </div>
          )}

          {tab === 'phase1' && PhaseOneContent}

          {tab === 'phase2' && (
            <div className="card">
              <h2 style={{ margin: '0 0 8px' }}>Phase 2 — Mock Interview</h2>
              <p className="muted" style={{ lineHeight: 1.6 }}>
                Coming soon: simulate a visa interview with an AI interviewer, answer questions by text or voice,
                and receive structured feedback on clarity, confidence, and content.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

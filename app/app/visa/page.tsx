'use client'

import Link from 'next/link'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { VISA_QA } from './qna'
import { supabaseClient as supabase } from '../../../lib/supabaseClient'
import { getMyCredits, useOneCreditOrThrow, addMyCredits } from '../../../lib/credits'

type VisaTab = 'intro' | 'phase1' | 'phase2'
const TAB_HASHES: Record<VisaTab, `#${VisaTab}`> = {
  intro: '#intro',
  phase1: '#phase1',
  phase2: '#phase2',
}
const TAB_STORAGE_KEY = 'visa_active_tab_v1'
const PRACTICE_KEY = 'visa_practiced_ids_v1'

// ====== Phase 2 config ======
const INTERVIEW_PRICE_CREDITS = 2 // $20
const QUESTIONS_COUNT = 10
const EST_MINUTES = '6–8'

// ----------- Phase 2 types -----------
type Role = 'ai' | 'user' | 'system'
type Message = { role: Role; content: string; ts: number }
type Phase2Step = 'idle' | 'interview' | 'wrapup'
type Feedback = {
  bulletsGood: string[]
  bulletsImprove: string[]
  rewrite?: string
}

export default function VisaGuidancePage() {
  // ------------ Auth gate ------------
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = `${location.origin}/auth`
      }
    })()
  }, [])

  // ------------ Tabs ------------
  const [tab, setTab] = useState<VisaTab>('intro')

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

  // ------------ Phase 1 helpers (UNCHANGED) ------------
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

  // ================== Phase 2 state (embedded) ==================
  const [p2Step, setP2Step] = useState<Phase2Step>('idle')
  const [p2Messages, setP2Messages] = useState<Message[]>([])
  const [p2Loading, setP2Loading] = useState(false)
  const [p2Error, setP2Error] = useState<string | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [showInterviewWindow, setShowInterviewWindow] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  // Mic (voice-only)
  const [micSupported, setMicSupported] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const recognitionRef = useRef<any>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Credits via existing lib
  useEffect(() => {
    (async () => {
      try {
        const c = await getMyCredits()
        setCredits(c)
      } catch {
        setCredits(0)
      }
    })()
  }, [])

  // Web Speech API detect
  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition ||
      (window as any).msSpeechRecognition
    if (SR) {
      setMicSupported(true)
      const rec = new SR()
      rec.continuous = false
      rec.interimResults = false
      rec.lang = 'en-US'
      rec.onresult = (e: any) => {
        const transcript: string = e.results?.[0]?.[0]?.transcript ?? ''
        submitTranscript(transcript)
        setRecognizing(false)
      }
      rec.onerror = () => setRecognizing(false)
      rec.onend = () => setRecognizing(false)
      recognitionRef.current = rec
    } else {
      setMicSupported(false)
    }
  }, [])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [p2Messages, p2Loading, p2Step])

  // Simple server-free officer logic
  const mockOfficer = useCallback((history: Message[]): { ai: string; done?: boolean } => {
    const asked = history.filter(m => m.role === 'ai').map(m => m.content).join(' | ')
    const lastUser = [...history].reverse().find(m => m.role === 'user')?.content ?? ''
    if (!asked) return { ai: 'Good morning. Which university are you going to, and what program have you been admitted to?' }
    if (!/finance|fund|loan|scholar|sponsor|bank/i.test(asked)) return { ai: 'How will you finance your tuition and living expenses? Please specify sources and amounts.' }
    if (!/plan|job|return|home|back|career/i.test(asked)) return { ai: 'What are your plans after graduation? Where do you intend to work and how does this program help you?' }
    if (!/ties|family|property|commitment/i.test(asked)) return { ai: 'Tell me about your ties to your home country—family, property, or obligations that ensure your return.' }
    if (lastUser && lastUser.split(' ').length < 15) return { ai: 'Please add more specifics—names, figures, or documents that support your answer.' }
    const turnsApprox = history.filter(m => m.role !== 'system').length / 2
    if (turnsApprox >= QUESTIONS_COUNT) return { ai: 'Thank you. I have no further questions. Please wait while I prepare your feedback.', done: true }
    return { ai: 'Understood. Could you also share your intended start date and how you selected this university over others?' }
  }, [])

  // Start interview => deduct 2 credits, open window, seed first Q
  const startInterview = useCallback(async () => {
    setP2Error(null); setP2Loading(true)
    try {
      if ((credits ?? 0) < INTERVIEW_PRICE_CREDITS) {
        setP2Error('You need 2 credits ($20) to start this mock interview.')
        return
      }
      // Deduct 2 credits (rollback if second fails)
      let afterFirst = 0
      try { afterFirst = await useOneCreditOrThrow() } catch (e: any) { setP2Error(e?.message || 'Could not deduct credits.'); return }
      try {
        const afterSecond = await useOneCreditOrThrow()
        setCredits(afterSecond)
      } catch (e: any) {
        try { await addMyCredits(1) } catch {}
        setCredits(afterFirst)
        setP2Error(e?.message || 'Could not deduct credits.')
        return
      }

      // Seed & open
      const sys = 'You are a U.S. consular officer conducting a concise F-1 visa interview. Ask one question at a time.'
      setP2Messages([{ role: 'system', content: sys, ts: Date.now() }])
      const first = mockOfficer([])
      pushMsg('ai', first.ai)
      setP2Step('interview')
      setShowInterviewWindow(true)
      setFeedback(null)
    } finally {
      setP2Loading(false)
    }
  }, [credits, mockOfficer])

  const pushMsg = (role: Role, content: string) =>
    setP2Messages(m => [...m, { role, content, ts: Date.now() }])

  const submitTranscript = async (text: string) => {
    if (!text || p2Loading || p2Step !== 'interview') return
    setP2Loading(true)
    const nextHistory = [...p2Messages, { role: 'user' as Role, content: text.trim(), ts: Date.now() }]
    setP2Messages(nextHistory)

    try {
      const turn = mockOfficer(nextHistory)
      pushMsg('ai', turn.ai)
      if (turn.done) {
        setP2Step('wrapup')
        setShowInterviewWindow(false)
        setFeedback({
          bulletsGood: [
            'Good structure in several answers.',
            'Professional and calm tone.',
          ],
          bulletsImprove: [
            'Be specific with amounts, names, and dates.',
            'State clear return plans to strengthen home ties.',
            'Keep funding explanation consistent across answers.',
          ],
          rewrite:
            'Example (Finances): “My father, Mr. Rao, will sponsor me with ₹28L liquid funds and a ₹10L SBI education loan. First-year tuition is $24k and living ~$12k; we have bank statements ready.”',
        })
      }
    } catch {
      setP2Error('Something went wrong. Please try again.')
    } finally {
      setP2Loading(false)
    }
  }

  const endInterview = () => { setP2Step('wrapup'); setShowInterviewWindow(false) }

  // ================== Phase 1 content (EXACTLY YOURS) ==================
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

  // ================== Phase 2 content (new UX, voice-only) ==================
  const PhaseTwoContent = (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>Phase 2 — Mock Interview</h2>

      {/* Bulleted intro (replacing chips) */}
      <ul className="muted" style={{ margin:'8px 0 12px 18px', lineHeight:1.6 }}>
        <li><strong>What it is:</strong> a realistic one-on-one interview with an AI consular officer.</li>
        <li><strong>How it works:</strong> you’ll answer by <em>voice only</em>. We’ll cover university, finances, plans, and home ties.</li>
        <li><strong>Format:</strong> about {QUESTIONS_COUNT} questions (~{EST_MINUTES} minutes).</li>
        <li><strong>Price:</strong> {INTERVIEW_PRICE_CREDITS} credits ($20).</li>
        <li><strong>After you finish:</strong> feedback appears below with strengths, improvements, and a sample rewrite.</li>
      </ul>

      {/* CTA row */}
      {p2Error && <div className="banner-err" style={{ marginTop: 8 }}>{p2Error}</div>}
      {(credits ?? 0) < INTERVIEW_PRICE_CREDITS && (
        <div className="banner-warn" style={{ marginTop: 8 }}>
          You need <strong>{INTERVIEW_PRICE_CREDITS} credits</strong> to start. Please top up first.
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:12 }}>
        <button className="btn primary" onClick={startInterview} disabled={p2Loading || (credits ?? 0) < INTERVIEW_PRICE_CREDITS}>
          {p2Loading ? 'Starting…' : 'Start Interview'}
        </button>
        <Link href="/app" className="btn">Buy Credits</Link>
      </div>

      {/* Feedback box always visible below */}
      <div className="card soft" style={{ marginTop:12 }}>
        <h3 style={{ margin:'0 0 6px' }}>Feedback</h3>
        {p2Step !== 'wrapup' || !feedback ? (
          <div className="muted">
            No feedback yet — finish an interview to see your strengths, improvements, and an example rewrite here.
          </div>
        ) : (
          <>
            <div className="panel">
              <strong>What you did well</strong>
              <ul className="muted" style={{ margin:'6px 0 0 16px' }}>
                {feedback.bulletsGood.map((b,i)=><li key={i}>{b}</li>)}
              </ul>
            </div>
            <div className="panel" style={{ marginTop:10 }}>
              <strong>What to improve</strong>
              <ul className="muted" style={{ margin:'6px 0 0 16px' }}>
                {feedback.bulletsImprove.map((b,i)=><li key={i}>{b}</li>)}
              </ul>
            </div>
            {feedback.rewrite && (
              <div className="panel" style={{ marginTop:10 }}>
                <strong>Suggested rewrite (example)</strong>
                <p className="muted" style={{ marginTop:6 }}>{feedback.rewrite}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ======== Interview "window" (overlay) ======== */}
      {showInterviewWindow && (
        <div className="overlay">
          <div className="window">
            <div className="window-bar">
              <div className="win-title">Visa Mock Interview</div>
              <div className="win-actions">
                <button className="win-btn" onClick={() => setShowInterviewWindow(false)} title="Minimize">—</button>
                <button className="win-btn danger" onClick={endInterview} title="End interview">×</button>
              </div>
            </div>

            <div className="window-body">
              <div className="chat-box">
                {p2Messages.filter(m => m.role !== 'system').length === 0 ? (
                  <div className="muted" style={{ textAlign:'center', padding:'24px 0' }}>
                    Interview hasn’t started yet.
                  </div>
                ) : (
                  <div className="spacey">
                    {p2Messages.filter(m => m.role !== 'system').map((m, idx) => (
                      <ChatBubble key={m.ts + '_' + idx} role={m.role} content={m.content} />
                    ))}
                  </div>
                )}
                {p2Loading && <TypingDots />}
                <div ref={chatBottomRef} />
              </div>

              {/* Voice-only controls */}
              {micSupported ? (
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:12, justifyContent:'center' }}>
                  <button
                    className={`btn ${recognizing ? 'danger' : 'primary'}`}
                    onClick={() => {
                      if (!recognitionRef.current) return
                      try {
                        if (recognizing) { recognitionRef.current.stop() } else { recognitionRef.current.start() }
                        setRecognizing(!recognizing)
                      } catch {}
                    }}
                    style={{ fontSize:16, padding:'10px 16px' }}
                  >
                    {recognizing ? '⏹ Stop & Submit' : '🎤 Speak Answer'}
                  </button>
                </div>
              ) : (
                <div className="banner-err" style={{ marginTop:12, textAlign:'center' }}>
                  Microphone not available in this browser/device.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <main id="top" style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px', fontFamily: 'system-ui, Arial, sans-serif' }}>
      {/* Minimal local styles to match your dashboard look */}
      <style>{`
        .muted { color:#666; font-size: 13px; }
        .card { border:1px solid #ddd; border-radius: 10px; padding: 12px; margin: 10px 0; background:#fff; }
        .card.soft { background:#fbfbff; border-color:#e7e7fb; }
        .btn { padding:8px 10px; border:1px solid #ccc; background:#f8f8f8; border-radius:6px; cursor:pointer; }
        .btn:hover { background:#f0f0f0; }
        .btn.primary { background:#1e40af; color:#fff; border-color:#1e40af; }
        .btn.primary:hover { background:#19358f; }
        .btn.danger { background:#ffecec; border-color:#e7b0b0; color:#7a2020; }
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
        .banner-warn { background:#fff7e6; border:1px solid #ffe8b0; color:#7a4d00; border-radius:10px; padding:10px 12px; }
        .banner-err { background:#ffeaea; border:1px solid #f5b5b5; color:#8a1f1f; border-radius:10px; padding:10px 12px; }

        .panel { border:1px solid #eee; border-radius:10px; padding:10px; background:#fff; }
        .spacey { display:flex; flex-direction:column; gap:6px; }

        .chat-box { max-height: 58vh; overflow-y: auto; border:1px solid #eee; background:#f7f7f7; border-radius:12px; padding:10px; }
        .bubble { max-width: 80%; white-space: pre-wrap; border-radius: 14px; padding: 8px 12px; font-size: 14px; box-shadow: 0 1px 0 rgba(0,0,0,0.02); }
        .bubble.ai { background:#fff; border:1px solid #e5e5e5; color:#222; }
        .bubble.user { background:#1e40af; color:#fff; }
        .row { display:flex; margin:6px 0; }
        .row.ai { justify-content: flex-start; }
        .row.user { justify-content: flex-end; }

        /* Overlay window */
        .overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); backdrop-filter: blur(2px); display:flex; align-items:center; justify-content:center; padding: 20px; z-index: 50; }
        .window { width: min(920px, 96vw); background:#fff; border:1px solid #e5e7eb; border-radius: 14px; overflow:hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.2); display:flex; flex-direction:column; }
        .window-bar { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:linear-gradient(180deg, #f8fafc, #eef2f7); border-bottom:1px solid #e5e7eb; }
        .win-title { font-weight:600; }
        .win-actions { display:flex; gap:6px; }
        .win-btn { border:1px solid #dcdcdc; background:#fff; border-radius:6px; padding:4px 10px; cursor:pointer; }
        .win-btn:hover { background:#f6f6f6; }
      `}</style>

      {/* ===== Top bar with Home + Credits pill (top-right) ===== */}
      <header className="vtop">
        <div><strong>Visa Guidance</strong></div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Link href="/app" className="btn btn-outline">🏠 Home</Link>
          <CreditsPill credits={credits} />
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
                <li><strong>Phase 2 — Mock Interview:</strong> Practice live with an AI interviewer and get instant feedback.</li>
              </ul>
            </div>
          )}

          {tab === 'phase1' && PhaseOneContent}
          {tab === 'phase2' && PhaseTwoContent}
        </section>
      </div>
    </main>
  )
}

/* ----------------------------- Small UI bits ----------------------------- */
function ChatBubble({ role, content }: { role: Role; content: string }) {
  const isUser = role === 'user'
  return (
    <div className={`row ${isUser ? 'user' : 'ai'}`}>
      <div className={`bubble ${isUser ? 'user' : 'ai'}`}>{content}</div>
    </div>
  )
}
function TypingDots() {
  return (
    <div className="muted" style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
      <span className="inline-block" style={{ width:6, height:6, borderRadius:999, background:'#999', animation:'bdots 1s infinite' }} />
      <span className="inline-block" style={{ width:6, height:6, borderRadius:999, background:'#999', animation:'bdots 1s infinite 0.2s' }} />
      <span className="inline-block" style={{ width:6, height:6, borderRadius:999, background:'#999', animation:'bdots 1s infinite 0.4s' }} />
      <style>{`@keyframes bdots { 0%{opacity:.2; transform:translateY(0)} 50%{opacity:1; transform:translateY(-2px)} 100%{opacity:.2; transform:translateY(0)} }`}</style>
    </div>
  )
}

function CreditsPill({ credits }: { credits: number | null }) {
  return (
    <a href="/app" className="btn" style={{ background:'#e9f8ef', borderColor:'#b7e3c8', color:'#155e36' }} title="Buy / manage credits">
      Credits: <strong>{credits ?? '—'}</strong>
    </a>
  )
}

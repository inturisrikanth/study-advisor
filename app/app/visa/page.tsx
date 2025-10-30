'use client'

import Link from 'next/link'
import { useEffect, useState, useRef, useCallback } from 'react'
import { VISA_QA } from './qna'
import { supabaseClient as supabase } from '../../../lib/supabaseClient'
import { getMyCredits } from '../../../lib/credits'

// ===== Small client helpers for API calls & tokens (with Bearer) =====
function newClientTurnToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function authHeaders(): Promise<Record<string, string>> {
  try {
    // always try to refresh first
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
    const active = refreshed?.session ?? (await supabase.auth.getSession()).data?.session
    const token = active?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

async function postJSON<T>(url: string, body?: any): Promise<T> {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data?.error || 'Request failed'), { status: res.status, data })
  return data as T
}

async function getJSON<T>(url: string): Promise<T> {
  const headers = { ...(await authHeaders()) }
  const res = await fetch(url, { headers })
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data?.error || 'Request failed'), { status: res.status, data })
  return data as T
}

// ====== Tabs ======
type VisaTab = 'intro' | 'phase1' | 'phase2'
const TAB_HASHES: Record<VisaTab, `#${VisaTab}`> = {
  intro: '#intro',
  phase1: '#phase1',
  phase2: '#phase2',
}
const TAB_STORAGE_KEY = 'visa_active_tab_v1'
const PRACTICE_KEY = 'visa_practiced_ids_v1'
const SESSION_KEY = 'visaSessionId'

// ====== Phase 2 config ======
const INTERVIEW_PRICE_CREDITS = 2 // $20
const EST_MINUTES = '6–10'
const EST_QUESTIONS = '15–20'

// ----------- Phase 2 types -----------
type Role = 'ai' | 'user'
type Turn = { turn_no: number; user_text: string | null; ai_text: string | null; created_at?: string }

// ⭐ feedback is now structured, not only {text: string}
type VisaFeedback = {
  overall?: string
  strengths?: string[]
  improvements?: string[]
  example_rewrite?: string
  raw?: string
  total_turns?: number
  ended_at?: string
  text?: string // backward compat (old sessions)
} | null

// ====== helpers for auto-finish text detection ======
const END_MARKERS = [
  'have a good day',
  'this concludes your interview',
  'that concludes the interview',
  'thank you for your time',
  'this concludes the mock interview',
  'we are done for today',
]

function aiMessageEndsInterview(text: string | null | undefined) {
  if (!text) return false
  const lower = text.toLowerCase()
  return END_MARKERS.some((m) => lower.includes(m))
}

export default function VisaGuidancePage() {
  // ------------ Auth gate ------------
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

  // ------------ Tabs ------------
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

  // ------------ Phase 1 helpers ------------
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
    } catch {}
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(PRACTICE_KEY, JSON.stringify(Array.from(practiced)))
    } catch {}
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

  // ================== Phase 2 state ==================
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [lastSpokenTurnNo, setLastSpokenTurnNo] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const [feedback, setFeedback] = useState<VisaFeedback>(null)

  const [p2Loading, setP2Loading] = useState(false)
  const [p2Error, setP2Error] = useState<string | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [showInterviewWindow, setShowInterviewWindow] = useState(false)

  // ⭐ NEW: track “we are currently calling /finish”
  const [finishing, setFinishing] = useState(false)

  // ⭐ NEW: resume flags
  const [canResume, setCanResume] = useState(false)
  const [currentSessionStatus, setCurrentSessionStatus] = useState<'active' | 'completed' | 'other' | null>(null)

  // ⭐ NEW: keep max_turns from backend so we can display 7/20
  const [maxTurns, setMaxTurns] = useState<number | null>(null)

  // Mic / speech
  const [micSupported, setMicSupported] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const recognitionRef = useRef<any>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // text fallback
  const [answerBox, setAnswerBox] = useState('')

  // Credits (initial pill)
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

  // Web Speech API detect (with Safari fallback) — for MIC
  useEffect(() => {
    const w = window as any
    const SR =
      w.SpeechRecognition ||
      w.webkitSpeechRecognition ||
      w.mozSpeechRecognition ||
      w.msSpeechRecognition
    if (SR) {
      setMicSupported(true)
      const rec = new SR()
      rec.continuous = false
      rec.interimResults = false
      rec.lang = 'en-US'
      rec.onresult = (e: any) => {
        const transcript: string = e.results?.[0]?.[0]?.transcript ?? ''
        if (transcript) {
          setAnswerBox(transcript)
        }
        setRecognizing(false)
      }
      rec.onerror = () => setRecognizing(false)
      rec.onend = () => setRecognizing(false)
      recognitionRef.current = rec
    } else {
      setMicSupported(false)
    }

    // speech synthesis detect (for reading AI question)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSpeechSupported(true)
    } else {
      setSpeechSupported(false)
    }
  }, [])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, p2Loading, done])

  // ===== helper to speak AI question =====
  const speakText = useCallback(
    (text: string) => {
      if (!speechSupported) return
      if (typeof window === 'undefined') return
      const synth = window.speechSynthesis
      if (!synth) return
      if (!text) return

      if (synth.speaking) {
        synth.cancel()
      }
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'en-US'
      synth.speak(utter)
    },
    [speechSupported],
  )

  // ===== when turns change, speak the latest AI turn =====
  useEffect(() => {
    if (!speechSupported) return
    if (!turns || turns.length === 0) return

    const lastAi = [...turns].reverse().find((t) => t.ai_text)
    if (!lastAi) return

    if (lastSpokenTurnNo === lastAi.turn_no) return

    speakText(lastAi.ai_text!)
    setLastSpokenTurnNo(lastAi.turn_no)
  }, [turns, speechSupported, speakText, lastSpokenTurnNo])

  // ===== hydrate on reload =====
  const hydrate = useCallback(
    async (id: string) => {
      try {
        const data = await getJSON<{ session: any; turns: Turn[] }>(`/api/visa/mock/session?sessionId=${id}`)
        setSessionId(data.session.id)
        setTurns(data.turns ?? [])

        const isDone =
          data.session.status !== 'active' ||
          (data.session.total_turns ?? 0) >= (data.session.max_turns ?? 999)
        setDone(isDone)

        // NEW: use canResume from API
        const resumeFlag =
          typeof data.session.can_resume === 'boolean'
            ? data.session.can_resume
            : data.session.status === 'active' &&
              (data.session.total_turns ?? 0) < (data.session.max_turns ?? 999)

        setCanResume(resumeFlag)
        setCurrentSessionStatus(data.session.status ?? null)

        // NEW: store max_turns for counter
        setMaxTurns(typeof data.session.max_turns === 'number' ? data.session.max_turns : 20)

        // 👇 show/hide window based on status
        if (data.session.status === 'active') {
          setShowInterviewWindow(true)
        } else {
          setShowInterviewWindow(false)
        }

        // accept both old and new feedback shapes
        if (data.session.status === 'completed' && data.session.feedback_json) {
          const fb = data.session.feedback_json
          if (fb.overall || fb.raw || fb.strengths || fb.improvements) {
            setFeedback(fb)
          } else if (fb.text) {
            setFeedback({ text: fb.text })
          } else {
            setFeedback(null)
          }
        } else {
          // if completed but no feedback → show message
          if (data.session.status === 'completed') {
            setFeedback({ text: 'Interview finished — no feedback was stored.' })
          } else {
            setFeedback(null)
          }
        }

        localStorage.setItem(SESSION_KEY, data.session.id)

        const lastAiTurn = (data.turns ?? []).slice().reverse().find((t) => t.ai_text)
        if (lastAiTurn?.turn_no) {
          setLastSpokenTurnNo(lastAiTurn.turn_no)
        }
      } catch {
        localStorage.removeItem(SESSION_KEY)
        setCanResume(false)
        setCurrentSessionStatus(null)
        setMaxTurns(null)
      }
    },
    [setLastSpokenTurnNo],
  )

  // hydrate on first load from localStorage
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null
    if (stored) hydrate(stored)
  }, [hydrate])

  // ===== start interview =====
  const startInterview = useCallback(async () => {
    setP2Error(null)
    setP2Loading(true)
    try {
      // don't let them start a new one if there's an active one
      if (canResume && currentSessionStatus === 'active') {
        setP2Error('You already have an interview in progress. Please resume or finish that one.')
        return
      }

      const res = await postJSON<{ sessionId: string; remainingCredits: number }>(`/api/visa/mock/start`)
      setSessionId(res.sessionId)
      setCredits(res.remainingCredits)
      localStorage.setItem(SESSION_KEY, res.sessionId)
      await hydrate(res.sessionId)
      setShowInterviewWindow(true)
    } catch (e: any) {
      if (e?.status === 402) setP2Error('You need 2 credits ($20) to start this mock interview.')
      else if (e?.status === 401) setP2Error('Please sign in to start an interview.')
      else setP2Error(e?.message || 'Could not start the interview.')
    } finally {
      setP2Loading(false)
    }
  }, [hydrate, canResume, currentSessionStatus])

  // ===== submit answer (text or mic) =====
  const submitTranscript = async (text: string) => {
    if (!sessionId || done || finishing) return
    const userText = text?.trim()
    if (!userText) return

    setP2Loading(true)
    const clientTurnToken = newClientTurnToken()

    try {
      const data = await postJSON<{ aiText: string; done: boolean; turnNo: number }>(`/api/visa/mock/turn`, {
        sessionId,
        userText,
        clientTurnToken,
      })

      setTurns((prev) => {
        const withoutDup = prev.filter((t) => t.turn_no !== data.turnNo)
        return [
          ...withoutDup,
          {
            turn_no: data.turnNo,
            user_text: userText,
            ai_text: data.aiText,
            created_at: new Date().toISOString(),
          },
        ].sort((a, b) => a.turn_no - b.turn_no)
      })

      const aiSaidBye = aiMessageEndsInterview(data.aiText)

      if (data.done || aiSaidBye) {
        setDone(true)
        setFinishing(true)
        try {
          // try to get structured feedback first
          const finishRes = await postJSON<{ feedback?: VisaFeedback; warning?: string }>(
            `/api/visa/mock/finish`,
            { sessionId },
          )

          // 👇 defensive: even if backend couldn’t save, we still show whatever we got
          const fb =
            finishRes?.feedback &&
            (finishRes.feedback.overall ||
              finishRes.feedback.raw ||
              finishRes.feedback.text ||
              (finishRes.feedback.strengths && finishRes.feedback.strengths.length) ||
              (finishRes.feedback.improvements && finishRes.feedback.improvements.length))
              ? finishRes.feedback
              : {
                  text:
                    finishRes?.feedback?.raw ||
                    'Interview completed — feedback is being processed or could not be saved.',
                }

          setFeedback(fb)
          setShowInterviewWindow(false)
          setCanResume(false)
          setCurrentSessionStatus('completed')
        } catch (err) {
          console.warn('Finish feedback fetch failed, trying session fallback:', err)
          // Fallback: fetch session to see if feedback already saved
          let fb: VisaFeedback | null = null
          try {
            const sess = await getJSON<{ session: any; turns: any[] }>(
              `/api/visa/mock/session?sessionId=${sessionId}`,
            )
            const sfb = sess?.session?.feedback_json
            if (sfb) {
              if (sfb.overall || sfb.raw || sfb.strengths || sfb.improvements) {
                fb = sfb
              } else if (sfb.text) {
                fb = { text: sfb.text }
              }
            }
          } catch (e2) {
            console.error('Session fallback also failed:', e2)
          }

          if (!fb) {
            fb = { text: 'Interview completed — feedback is not available right now.' }
          }

          setFeedback(fb)
          setShowInterviewWindow(false)
          setCanResume(false)
          setCurrentSessionStatus('completed')
        } finally {
          setFinishing(false)
        }
      } else {
        setDone(false)
        setAnswerBox('')
        setCanResume(true)
        setCurrentSessionStatus('active')
      }
    } catch (e: any) {
      if (e?.data?.error === 'MAX_TURNS_REACHED') {
        setDone(true)
        setFinishing(true)
        try {
          const finishRes = await postJSON<{ feedback?: VisaFeedback }>(`/api/visa/mock/finish`, {
            sessionId,
          })
          const fb =
            finishRes?.feedback &&
            (finishRes.feedback.overall ||
              finishRes.feedback.raw ||
              finishRes.feedback.text)
              ? finishRes.feedback
              : { text: 'Interview completed — feedback is being processed.' }
          setFeedback(fb)
        } catch {
          setFeedback({ text: 'Interview completed — feedback is not available right now.' })
        }
        setShowInterviewWindow(false)
        setFinishing(false)
        setCanResume(false)
        setCurrentSessionStatus('completed')
      } else {
        setP2Error(e?.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setP2Loading(false)
    }
  }

  // ===== finish manually (button) =====
  const finishInterview = useCallback(async () => {
    if (!sessionId) return
    setP2Loading(true)
    setFinishing(true)
    try {
      const res = await postJSON<{ feedback?: VisaFeedback; warning?: string }>(`/api/visa/mock/finish`, { sessionId })

      const fb =
        res?.feedback &&
        (res.feedback.overall ||
          res.feedback.raw ||
          res.feedback.text ||
          (res.feedback.strengths && res.feedback.strengths.length) ||
          (res.feedback.improvements && res.feedback.improvements.length))
          ? res.feedback
          : { text: 'Interview completed — feedback is being processed or could not be saved.' }

      setFeedback(fb)
      setDone(true)
      setShowInterviewWindow(false)
      setCanResume(false)
      setCurrentSessionStatus('completed')
    } catch (e: any) {
      console.warn('Manual finish failed:', e)
      // fallback to session
      let fb: VisaFeedback | null = null
      try {
        const sess = await getJSON<{ session: any; turns: any[] }>(
          `/api/visa/mock/session?sessionId=${sessionId}`,
        )
        const sfb = sess?.session?.feedback_json
        if (sfb) {
          fb = sfb
        }
      } catch (e2) {
        console.error('Manual finish -> session fallback failed:', e2)
      }

      if (!fb) {
        fb = { text: 'Interview completed — feedback is not available right now.' }
      }
      setFeedback(fb)
      setCanResume(false)
      setCurrentSessionStatus('completed')
    } finally {
      setP2Loading(false)
      setFinishing(false)
    }
  }, [sessionId])

  const endInterview = () => {
    // just hide the window; do NOT clear sessionId so user can resume
    setShowInterviewWindow(false)
  }

  // ================== Phase 1 content ==================
  const PhaseOneContent = (
    <div className="card">
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

      {practiced.size === VISA_QA.length && VISA_QA.length > 0 ? (
        <div
          className="banner-ok"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
        >
          <span>
            🎉 You’ve practiced all questions in Phase 1. Review anytime or proceed to{' '}
            <strong>Phase 2 — Mock Interview</strong>.
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

      <div className="muted" style={{ marginTop: 16 }}>
        ⚙️ Phase 2: Practice these questions in a live AI mock interview.
      </div>

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <a href="#top" className="top-link">
          ↑ Back to top
        </a>
      </div>
    </div>
  )

  // ================== Feedback UI (structured) ==================
  function FeedbackPanel({ feedback, finishing }: { feedback: VisaFeedback; finishing: boolean }) {
    if (finishing) {
      return <div className="muted">Interview completed. Generating feedback…</div>
    }

    if (!feedback) {
      return <div className="muted">No feedback yet — finish an interview to see your personalized summary here.</div>
    }

    // if we have new structured one
    const hasStructured =
      feedback.overall ||
      (feedback.strengths && feedback.strengths.length > 0) ||
      (feedback.improvements && feedback.improvements.length > 0) ||
      feedback.example_rewrite

    if (hasStructured) {
      return (
        <div className="panel space-y-4">
          {feedback.overall ? (
            <div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Overall Impression</p>
              <p className="muted" style={{ lineHeight: 1.5 }}>
                {feedback.overall}
              </p>
            </div>
          ) : null}

          {feedback.strengths && feedback.strengths.length ? (
            <div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Strengths</p>
              <ul className="muted" style={{ marginLeft: 18 }}>
                {feedback.strengths.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {feedback.improvements && feedback.improvements.length ? (
            <div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Improvements</p>
              <ul className="muted" style={{ marginLeft: 18 }}>
                {feedback.improvements.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {feedback.example_rewrite ? (
            <div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Example Rewrite for a Weak Answer</p>
              <pre className="muted" style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 8, borderRadius: 8 }}>
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

    // fallback to old text-based rendering
    if (feedback.text) {
      return (
        <div className="panel">
          {feedback.text.split(/\n+/).map((line, idx) => {
            const l = line.trim()
            if (!l) return null
            if (/^\*\*Quotes from User:\*\*/i.test(l)) return null
            if (/^["”“].+["”“]$/.test(l)) return null

            if (/^\*\*Strengths?:\*\*/i.test(l)) {
              return (
                <p key={idx} style={{ fontWeight: 600, marginTop: idx === 0 ? 0 : 10 }}>
                  {l.replace(/^\*\*|\*\*$/g, '')}
                </p>
              )
            }
            if (/^\*\*Improvements?:\*\*/i.test(l)) {
              return (
                <p key={idx} style={{ fontWeight: 600, marginTop: 10 }}>
                  {l.replace(/^\*\*|\*\*$/g, '')}
                </p>
              )
            }
            if (/^\*\*Example Rewrite/i.test(l)) {
              return (
                <p key={idx} style={{ fontWeight: 600, marginTop: 10 }}>
                  {l.replace(/^\*\*|\*\*$/g, '')}
                </p>
              )
            }
            if (/^[-•]/.test(l)) {
              return (
                <li key={idx} style={{ marginLeft: 16, marginBottom: 3 }}>
                  {l.replace(/^[-•]\s*/, '')}
                </li>
              )
            }
            return (
              <p key={idx} className="muted" style={{ marginBottom: 4, lineHeight: 1.5 }}>
                {l}
              </p>
            )
          })}
        </div>
      )
    }

    return <div className="muted">Interview finished, but no feedback was returned. Try refreshing.</div>
  }

  // ================== Phase 2 content ==================
  const PhaseTwoContent = (
    <div className="card">
      <h2 style={{ margin: '0 0 6px' }}>Phase 2 — Mock Interview</h2>

      <ul className="muted" style={{ margin: '8px 0 12px 18px', lineHeight: 1.6 }}>
        <li>
          <strong>What it is:</strong> a realistic one-on-one interview with an AI consular officer.
        </li>
        <li>
          <strong>How it works:</strong> answer by voice (if supported) or use the text input below.
        </li>
        <li>
          <strong>Format:</strong> about {EST_QUESTIONS} questions (~{EST_MINUTES} minutes).
        </li>
        <li>
          <strong>Price:</strong> {INTERVIEW_PRICE_CREDITS} credits ($20).
        </li>
        <li>
          <strong>After you finish:</strong> feedback appears below.
        </li>
      </ul>

      {/* NEW: show resume banner if we have an in-progress session */}
      {canResume && currentSessionStatus === 'active' ? (
        <div className="banner-ok" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>▶ You have an interview in progress. You can resume it.</span>
          <button className="btn primary" onClick={() => setShowInterviewWindow(true)}>
            Resume interview
          </button>
        </div>
      ) : null}

      {p2Error && <div className="banner-err" style={{ marginTop: 8 }}>{p2Error}</div>}
      {(credits ?? 0) < INTERVIEW_PRICE_CREDITS && (
        <div className="banner-warn" style={{ marginTop: 8 }}>
          You need <strong>{INTERVIEW_PRICE_CREDITS} credits</strong> to start. Please top up first.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <button
          className="btn primary"
          onClick={startInterview}
          disabled={
            p2Loading ||
            (credits ?? 0) < INTERVIEW_PRICE_CREDITS ||
            finishing ||
            (canResume && currentSessionStatus === 'active')
          }
        >
          {p2Loading ? 'Starting…' : 'Start Interview'}
        </button>
        <Link href="/app" className="btn">
          Buy Credits
        </Link>
      </div>

      <div className="card soft" style={{ marginTop: 12 }}>
        <h3 style={{ margin: '0 0 6px' }}>Feedback</h3>
        <FeedbackPanel feedback={feedback} finishing={finishing} />
      </div>

      {showInterviewWindow && (
        <div className="overlay">
          <div className="window">
            <div className="window-bar">
              <div className="win-title">
                Visa Mock Interview
                {turns.length > 0 ? (
                  <span style={{ marginLeft: 10, fontSize: 12, color: '#4b5563' }}>
                    Turns: {turns.length}
                    {maxTurns ? ` / ${maxTurns}` : null}
                  </span>
                ) : null}
              </div>
              <div className="win-actions">
                <button className="win-btn" onClick={() => setShowInterviewWindow(false)} title="Minimize">
                  —
                </button>
                <button className="win-btn danger" onClick={endInterview} title="Close window">
                  ×
                </button>
              </div>
            </div>

            <div className="window-body">
              <div className="chat-box">
                {turns.length === 0 ? (
                  <div className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                    Interview started — waiting for your first answer.
                  </div>
                ) : (
                  <div className="spacey">
                    {turns.map((t) => (
                      <div key={t.turn_no}>
                        {t.user_text ? <ChatBubble role="user" content={t.user_text} /> : null}
                        {t.ai_text ? <ChatBubble role="ai" content={t.ai_text} /> : null}
                      </div>
                    ))}
                  </div>
                )}
                {p2Loading && <TypingDots />}
                <div ref={chatBottomRef} />
              </div>

              {!micSupported ? (
                <div className="banner-warn" style={{ marginTop: 12, textAlign: 'center' }}>
                  Mic not available in this browser/device. Please type your answer below.
                </div>
              ) : null}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 12,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  className={`btn ${recognizing ? 'danger' : 'primary'}`}
                  onClick={() => {
                    if (!recognitionRef.current) return
                    try {
                      if (recognizing) {
                        recognitionRef.current.stop()
                      } else {
                        recognitionRef.current.start()
                      }
                      setRecognizing(!recognizing)
                    } catch {}
                  }}
                  style={{ fontSize: 16, padding: '10px 16px' }}
                  disabled={!micSupported || done || p2Loading || finishing}
                >
                  {recognizing ? '⏹ Stop' : '🎤 Speak Answer'}
                </button>

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const s = answerBox.trim()
                    if (s) {
                      submitTranscript(s)
                      setAnswerBox('')
                    }
                  }}
                  style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                >
                  <input
                    value={answerBox}
                    onChange={(e) => setAnswerBox(e.target.value)}
                    placeholder="Or type your answer…"
                    className="flex-1"
                    style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px', minWidth: 260 }}
                    disabled={p2Loading || done || finishing}
                  />
                  <button className="btn" disabled={p2Loading || done || !answerBox.trim() || finishing}>
                    Send
                  </button>
                </form>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                <button className="btn" onClick={finishInterview} disabled={p2Loading || finishing}>
                  {p2Loading || finishing ? 'Finishing…' : 'Finish & Get Feedback'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <main
      id="top"
      style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px', fontFamily: 'system-ui, Arial, sans-serif' }}
    >
      <style>{`
        .muted { color:#666; font-size: 13px; }
        .card { border:1px solid #ddd; border-radius: 10px; padding: 12px; margin: 10px 0; background:#fff; }
        .card.soft { background:#fbfbff; border-color:#e7e7fb; }
        .btn, a.btn { padding:8px 10px; border:1px solid #ccc; background:#f8f8f8; border-radius:6px; cursor:pointer; text-decoration:none; }
        .btn:hover, a.btn:hover { background:#f0f0f0; }
        .btn.primary { background:#1e40af; color:#fff; border-color:#1e40af; }
        .btn.primary:hover { background:#19358f; }
        .btn.secondary { background:#eef2ff; border-color:#d4d8ff; color:#1f2933; }
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

        .overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); backdrop-filter: blur(2px); display:flex; align-items:center; justify-content:center; padding: 20px; z-index: 50; }
        .window { width: min(920px, 96vw); background:#fff; border:1px solid #e5e7eb; border-radius: 14px; overflow:hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.2); display:flex; flex-direction:column; }
        .window-bar { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:linear-gradient(180deg, #f8fafc, #eef2f7); border-bottom:1px solid #e5e7eb; }
        .win-title { font-weight:600; display:flex; align-items:center; gap:6px; }
        .win-actions { display:flex; gap:6px; }
        .win-btn { border:1px solid #dcdcdc; background:#fff; border-radius:6px; padding:4px 10px; cursor:pointer; }
        .win-btn:hover { background:#f6f6f6; }
      `}</style>

      <header className="vtop">
        <div>
          <strong>Visa Guidance</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/app" className="btn btn-outline">
            🏠 Home
          </Link>
          <CreditsPill credits={credits} />
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
              🤖 Phase 2 — Mock Interview
            </button>
          </div>
        </aside>

        <section style={{ flex: 1 }}>
          {tab === 'intro' && (
            <div className="card">
              <h2 style={{ margin: '0 0 8px' }}>Introduction</h2>
              <p className="muted" style={{ lineHeight: 1.6 }}>
                Welcome to the Visa Guidance section. This space is designed to help you prepare for your F-1 visa
                interview. We’re rolling it out in two phases:
              </p>
              <ul className="muted" style={{ margin: '8px 0 0 18px', lineHeight: 1.5 }}>
                <li>
                  <strong>Phase 1 — Learning:</strong> Review common interview questions with sample answers and quick
                  tips.
                </li>
                <li>
                  <strong>Phase 2 — Mock Interview:</strong> Practice live with an AI interviewer and get instant
                  feedback.
                </li>
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
    <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
      <span
        className="inline-block"
        style={{ width: 6, height: 6, borderRadius: 999, background: '#999', animation: 'bdots 1s infinite' }}
      />
      <span
        className="inline-block"
        style={{ width: 6, height: 6, borderRadius: 999, background: '#999', animation: 'bdots 1s infinite 0.2s' }}
      />
      <span
        className="inline-block"
        style={{ width: 6, height: 6, borderRadius: 999, background: '#999', animation: 'bdots 1s infinite 0.4s' }}
      />
      <style>{`@keyframes bdots { 0%{opacity:.2; transform:translateY(0)} 50%{opacity:1; transform:translateY(-2px)} 100%{opacity:.2; transform:translateY(0)} }`}</style>
    </div>
  )
}
function CreditsPill({ credits }: { credits: number | null }) {
  return (
    <a
      href="/app"
      className="btn"
      style={{ background: '#e9f8ef', borderColor: '#b7e3c8', color: '#155e36', textDecoration: 'none' }}
      title="Buy / manage credits"
    >
      Credits: <strong>{credits ?? '—'}</strong>
    </a>
  )
}

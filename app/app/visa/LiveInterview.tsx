// app/app/visa/LiveInterview.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useVisaLive, VisaFeedback } from './hooks/useVisaLive'

type Props = {
  onFeedback?: (fb: VisaFeedback) => void
  onCreditsChange?: (n: number | null) => void
  onBuyCredits?: () => void
}

export default function LiveInterview({ onFeedback, onCreditsChange, onBuyCredits }: Props) {
  const {
    sessionId,
    turns,
    feedback,
    credits,
    error,
    loading,
    finishing,
    startInterview,
    sendAnswer,
    finishInterview,
  } = useVisaLive()

  const [answer, setAnswer] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, loading])

  // push credits up to page (so top-right pill updates)
  useEffect(() => {
    if (typeof onCreditsChange === 'function') {
      onCreditsChange(credits ?? null)
    }
  }, [credits, onCreditsChange])

  // when feedback arrives → save + lift to page
  useEffect(() => {
    if (!feedback) return
    if (typeof window !== 'undefined') {
      localStorage.setItem('visa_live_last_feedback', JSON.stringify(feedback))
    }
    onFeedback?.(feedback)
  }, [feedback, onFeedback])

  const hasSession = Boolean(sessionId)

  return (
    <div className="live-card">
      {/* header: ONLY title */}
      <div className="live-header">
        <h3 style={{ margin: 0 }}>🎙️ Live Visa Interview</h3>
      </div>

      {/* small text */}
      {!hasSession ? (
        <p className="muted" style={{ margin: '4px 0 8px' }}>
          Start an interview to talk to the AI officer.
        </p>
      ) : null}

      {/* actions row - when NO session */}
      {!hasSession ? (
        <div className="actions-row">
          <button className="btn primary" onClick={startInterview} disabled={loading}>
            {loading ? 'Starting…' : 'Start interview'}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => onBuyCredits?.()}
            style={{ marginLeft: 6 }}
          >
            Buy credits
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="banner-err" style={{ marginTop: 10 }}>
          {error}
        </div>
      ) : null}

      {/* when session is active → show chat + finish */}
      {hasSession ? (
        <>
          <div className="chat-box">
            {turns.length === 0 ? (
              <div className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>
                Interview started — waiting for your first answer.
              </div>
            ) : (
              turns.map((t) => (
                <div key={t.turn_no}>
                  {t.user_text ? <Bubble role="user" text={t.user_text} /> : null}
                  {t.ai_text ? <Bubble role="ai" text={t.ai_text} /> : null}
                </div>
              ))
            )}
            {loading && <div className="muted">AI is thinking…</div>}
            <div ref={chatEndRef} />
          </div>

          {/* input */}
          {!finishing && (
            <form
              className="input-row"
              onSubmit={(e) => {
                e.preventDefault()
                const trimmed = answer.trim()
                if (!trimmed) return
                sendAnswer(trimmed)
                setAnswer('')
              }}
            >
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer…"
                disabled={loading}
              />
              <button className="btn" disabled={loading || !answer.trim()}>
                Send
              </button>
            </form>
          )}

          {/* finish button when session is on */}
          <div style={{ marginTop: 8 }}>
            <button className="btn" onClick={finishInterview} disabled={loading || finishing}>
              {finishing ? 'Finishing…' : 'Finish & get feedback'}
            </button>
          </div>
        </>
      ) : null}

      <style>{`
        .live-card {
          border: 1px solid #ddd;
          border-radius: 10px;
          padding: 12px;
          background: #fff;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .live-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .actions-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .chat-box {
          border: 1px solid #eee;
          border-radius: 8px;
          background: #fafafa;
          max-height: 55vh;
          overflow-y: auto;
          padding: 10px;
        }
        .input-row {
          display: flex;
          gap: 8px;
        }
        .input-row input {
          flex: 1;
          border: 1px solid #ccc;
          border-radius: 8px;
          padding: 8px 10px;
        }
        .btn {
          padding: 7px 12px;
          border: 1px solid #ccc;
          border-radius: 6px;
          background: #f7f7f7;
          cursor: pointer;
        }
        .btn.primary {
          background: #1e40af;
          border-color: #1e40af;
          color: #fff;
        }
        .banner-err {
          background: #ffeaea;
          border: 1px solid #f5b5b5;
          color: #8a1f1f;
          border-radius: 8px;
          padding: 6px 10px;
        }
        .muted {
          color: #666;
          font-size: 13px;
        }
      `}</style>
    </div>
  )
}

function Bubble({ role, text }: { role: 'ai' | 'user'; text: string }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
      <div
        style={{
          background: isUser ? '#1e40af' : '#fff',
          color: isUser ? '#fff' : '#111',
          border: isUser ? 'none' : '1px solid #eee',
          borderRadius: 14,
          padding: '6px 10px',
          maxWidth: '78%',
          whiteSpace: 'pre-wrap',
        }}
      >
        {text}
      </div>
    </div>
  )
}

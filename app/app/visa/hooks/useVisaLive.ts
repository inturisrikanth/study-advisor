// app/app/visa/hooks/useVisaLive.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseClient as supabase } from '../../../../lib/supabaseClient'
import { getMyCredits } from '../../../../lib/credits'

export type VisaFeedback = {
  overall?: string
  strengths?: string[]
  improvements?: string[]
  example_rewrite?: string
  raw?: string
  total_turns?: number
  ended_at?: string
  text?: string
} | null

export type Turn = {
  turn_no: number
  user_text: string | null
  ai_text: string | null
  created_at?: string
}

const SESSION_KEY = 'visaSessionId'
const FEEDBACK_KEY = 'visaLastFeedback_v1'

function newClientTurnToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data: refreshed } = await supabase.auth.refreshSession()
    const active = refreshed?.session ?? (await supabase.auth.getSession()).data?.session
    const token = active?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

async function postJSON<T>(url: string, body?: any): Promise<T> {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  const res = await fetch(url, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined })
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

export function useVisaLive() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [feedback, setFeedback] = useState<VisaFeedback>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [finishing, setFinishing] = useState(false)

  // load credits + last feedback + maybe restore session
  useEffect(() => {
    ;(async () => {
      // credits
      try {
        const c = await getMyCredits()
        setCredits(c)
      } catch {
        setCredits(0)
      }

      // last feedback
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem(FEEDBACK_KEY)
        if (saved) {
          try {
            setFeedback(JSON.parse(saved))
          } catch {
            /* ignore */
          }
        }
      }

      // restore active session (if any)
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem(SESSION_KEY)
        if (stored) {
          try {
            const res = await getJSON<{ session: any; turns: Turn[] }>(`/api/visa/live/session?sessionId=${stored}`)
            if (res.session?.status === 'active') {
              setSessionId(res.session.id)
              setTurns(res.turns || [])
            } else {
              // session is done – clear key, but keep feedback from DB if present
              window.localStorage.removeItem(SESSION_KEY)
              if (res.session?.feedback_json) {
                setFeedback(res.session.feedback_json)
                window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(res.session.feedback_json))
              }
            }
          } catch {
            window.localStorage.removeItem(SESSION_KEY)
          }
        }
      }
    })()
  }, [])

  // start
  const startInterview = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
        const res = await postJSON<{ sessionId: string; remainingCredits: number }>('/api/visa/live/start')

        // remember active session
        if (typeof window !== 'undefined') {
        localStorage.setItem('visaSessionId', res.sessionId)
        }

        setSessionId(res.sessionId)
        setCredits(res.remainingCredits)
        setTurns([])
        setFeedback(null)
    } catch (e: any) {
        // 👇 nicer message for no credits
        if (e?.status === 402 || e?.data === 'INSUFFICIENT_CREDITS' || e?.message === 'INSUFFICIENT_CREDITS') {
        setError('You don’t have enough credits for this interview. Please buy enough credits and try again.')
        } else {
        setError(e?.message || 'Could not start interview.')
        }
    } finally {
        setLoading(false)
    }
    }, [])

  // finish
  const finishInterview = useCallback(async () => {
    if (!sessionId) return
    setFinishing(true)
    try {
      const res = await postJSON<{ feedback?: VisaFeedback }>('/api/visa/live/end', { sessionId })

      if (res.feedback) {
        setFeedback(res.feedback)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(res.feedback))
        }
      }

      // interview is done → clear active session
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(SESSION_KEY)
      }
      setSessionId(null)
      setTurns([])
    } catch (e: any) {
      setError(e?.message || 'Failed to finish interview.')
    } finally {
      setFinishing(false)
    }
  }, [sessionId])

  // send answer
  const sendAnswer = useCallback(
    async (text: string) => {
      if (!sessionId) return
      const trimmed = text.trim()
      if (!trimmed) return
      setLoading(true)
      const token = newClientTurnToken()
      try {
        const res = await postJSON<{ aiText: string; turnNo: number; done?: boolean }>(
          '/api/visa/live/turn',
          { sessionId, userText: trimmed, clientTurnToken: token },
        )

        setTurns((prev) => [
          ...prev,
          { turn_no: res.turnNo, user_text: trimmed, ai_text: res.aiText, created_at: new Date().toISOString() },
        ])

        if (res.done) {
          await finishInterview()
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to send answer.')
      } finally {
        setLoading(false)
      }
    },
    [sessionId, finishInterview],
  )

  return {
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
  }
}

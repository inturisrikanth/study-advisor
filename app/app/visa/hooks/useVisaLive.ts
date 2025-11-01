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

  // NEW: to show “resume vs start”
  const [hasStoredActiveSession, setHasStoredActiveSession] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // load credits once
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

  // start interview
  const startInterview = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await postJSON<{ sessionId: string; remainingCredits: number }>('/api/visa/live/start')
      if (typeof window !== 'undefined') {
        localStorage.setItem(SESSION_KEY, res.sessionId)
      }
      setSessionId(res.sessionId)
      setCredits(res.remainingCredits)
      setTurns([])
      setFeedback(null)
      setHasStoredActiveSession(false)
    } catch (e: any) {
      setError(e?.message || 'Could not start interview.')
    } finally {
      setLoading(false)
    }
  }, [])

  // finish interview
  const finishInterview = useCallback(async () => {
    if (!sessionId) return
    setFinishing(true)
    try {
      const res = await postJSON<{ feedback?: VisaFeedback }>('/api/visa/live/end', { sessionId })
      if (res.feedback) setFeedback(res.feedback)
      // clear from storage, but KEEP feedback in state
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SESSION_KEY)
      }
      setHasStoredActiveSession(false)
      // we keep sessionId so chat UI can still show old turns if needed
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

  // hydrate
  useEffect(() => {
    ;(async () => {
      if (typeof window === 'undefined') return
      const stored = localStorage.getItem(SESSION_KEY)
      if (!stored) {
        setHydrated(true)
        return
      }

      try {
        const res = await getJSON<{ session: any; turns: Turn[] }>(`/api/visa/live/session?sessionId=${stored}`)
        const status = res.session?.status
        if (!status || status === 'completed' || status === 'abandoned') {
          // old session, drop it
          localStorage.removeItem(SESSION_KEY)
          setSessionId(null)
          setTurns([])
          setFeedback(res.session?.feedback_json ?? null)
          setHasStoredActiveSession(false)
        } else {
          // active -> don't auto-start UI, just tell page there's something to resume
          setSessionId(res.session.id)
          setTurns(res.turns || [])
          setFeedback(res.session.feedback_json ?? null)
          setHasStoredActiveSession(true)
        }
      } catch {
        localStorage.removeItem(SESSION_KEY)
        setSessionId(null)
        setTurns([])
        setFeedback(null)
        setHasStoredActiveSession(false)
      } finally {
        setHydrated(true)
      }
    })()
  }, [])

  // allow page to drop the stored session (user chose "start new")
  const clearStoredSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY)
    }
    setHasStoredActiveSession(false)
    setSessionId(null)
    setTurns([])
  }, [])

  return {
    // data
    sessionId,
    turns,
    feedback,
    credits,
    error,
    loading,
    finishing,

    // actions
    startInterview,
    sendAnswer,
    finishInterview,
    clearStoredSession,

    // ui state
    hasStoredActiveSession,
    hydrated,
  }
}

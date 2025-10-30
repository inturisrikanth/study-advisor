"use client";

import { useEffect, useRef, useState } from "react";
import { getJSON, postJSON, newClientTurnToken } from "../lib/client";

type Turn = { turn_no: number; user_text: string | null; ai_text: string | null; created_at: string };
type Session = { id: string; status: "active" | "completed" | "abandoned"; max_turns: number; total_turns: number; feedback_json?: any };

export function useVisaMock() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const lastTokenRef = useRef<string | null>(null);

  // On mount: restore session
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("visaSessionId") : null;
    if (stored) {
      hydrate(stored).catch(() => {
        // If restore fails, clear stale id
        localStorage.removeItem("visaSessionId");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function hydrate(id: string) {
    const data = await getJSON<{ session: Session; turns: any[] }>(`/api/visa/mock/session?sessionId=${id}`);
    setSessionId(data.session.id);
    setTurns(data.turns);
    setDone(data.session.status !== "active" || (data.session.total_turns ?? 0) >= data.session.max_turns);
    if (data.session.status === "completed" && data.session.feedback_json?.text) {
      setFeedback(data.session.feedback_json.text);
    }
    localStorage.setItem("visaSessionId", data.session.id);
  }

  async function startInterview() {
    setLoading(true);
    try {
      const data = await postJSON<{ sessionId: string; remainingCredits: number }>(`/api/visa/mock/start`);
      setSessionId(data.sessionId);
      setRemainingCredits(data.remainingCredits);
      localStorage.setItem("visaSessionId", data.sessionId);
      // Fresh start may have zero turns; hydrate to be safe
      await hydrate(data.sessionId);
    } finally {
      setLoading(false);
    }
  }

  async function sendAnswer(userText: string) {
    if (!sessionId || done) return;
    setLoading(true);
    const token = newClientTurnToken();
    lastTokenRef.current = token;

    try {
      const data = await postJSON<{ aiText: string; done: boolean; turnNo: number }>(`/api/visa/mock/turn`, {
        sessionId,
        userText,
        clientTurnToken: token,
      });
      // Optimistically append the pair to the local state
      setTurns(prev => {
        const nextNo = data.turnNo;
        const withoutDup = prev.filter(t => t.turn_no !== nextNo);
        return [
          ...withoutDup,
          { turn_no: nextNo, user_text: userText, ai_text: data.aiText, created_at: new Date().toISOString() },
        ].sort((a, b) => a.turn_no - b.turn_no);
      });
      setDone(Boolean(data.done));
    } catch (e: any) {
      // Network/model retry: reuse the same clientTurnToken
      if (e?.status >= 500) {
        const retry = await postJSON<{ aiText: string; done: boolean; turnNo: number }>(`/api/visa/mock/turn`, {
          sessionId,
          userText,
          clientTurnToken: lastTokenRef.current,
        });
        setTurns(prev => {
          const nextNo = retry.turnNo;
          const withoutDup = prev.filter(t => t.turn_no !== nextNo);
          return [
            ...withoutDup,
            { turn_no: nextNo, user_text: userText, ai_text: retry.aiText, created_at: new Date().toISOString() },
          ].sort((a, b) => a.turn_no - b.turn_no);
        });
        setDone(Boolean(retry.done));
      } else {
        throw e;
      }
    } finally {
      setLoading(false);
    }
  }

  async function finishInterview() {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await postJSON<{ feedback: { text: string } }>(`/api/visa/mock/finish`, { sessionId });
      setFeedback(data.feedback.text);
      // Optionally refresh credits pill (start route already returns credits; finish doesn’t)
    } finally {
      setLoading(false);
      setDone(true);
    }
  }

  function resetInterview() {
    setSessionId(null);
    setTurns([]);
    setFeedback(null);
    setDone(false);
    setRemainingCredits(null);
    localStorage.removeItem("visaSessionId");
  }

  return {
    sessionId, turns, feedback, remainingCredits, loading, done,
    startInterview, sendAnswer, finishInterview, hydrate, resetInterview,
  };
}

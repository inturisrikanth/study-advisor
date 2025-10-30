// app/api/visa/mock/turn/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function getSupabaseFromReq(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
  }
  return createRouteHandlerClient({ cookies });
}

// standard closing
const CLOSING_TEXT =
  "Thank you for your answers. This concludes your mock visa interview. Have a good day.";

// end markers – same idea as frontend
const END_MARKERS = [
  "have a good day",
  "this concludes your interview",
  "that concludes the interview",
  "thank you for your time",
  "this concludes the mock interview",
  "we are done for today",
  "this concludes your mock visa interview",
];

// user-triggered early-stop phrases
const USER_STOP_MARKERS = [
  "finish",
  "end interview",
  "end the interview",
  "stop",
  "that's all",
  "that is all",
  "i'm done",
  "im done",
  "i am done",
  "no more",
  "we can stop",
];

// 1) MAIN / FIXED QUESTIONS — asked in this exact order
const FIXED_SEQUENCE = [
  {
    id: "which-university",
    text: "Which university are you going to in the U.S.?",
  },
  {
    id: "why-this-university",
    text: "Why did you choose this university?",
  },
  {
    id: "why-this-program",
    text: "Why this program?",
  },
  {
    id: "funding-source",
    text: "Who is funding your education?",
  },
  {
    id: "tuition-breakdown",
    text: "What is your estimated tuition and living cost?",
  },
];

// 2) RANDOM POOL — everything else from your qna.ts
const RANDOM_POOL = [
  // ---------- University & Program ----------
  { id: "how-did-you-choose", text: "How did you shortlist your universities?" },
  {
    id: "alternatives-admits",
    text: "Which other universities did you apply to or get admits from?",
  },
  {
    id: "fit-vs-other-admit",
    text: "Why did you choose this admit over your other admits?",
  },
  {
    id: "program-deliverables",
    text: "What are the key deliverables or outcomes from your program?",
  },
  {
    id: "faculty-alignment",
    text: "Which faculty or labs align with your interests?",
  },
  { id: "deferral-question", text: "If the start term is deferred, what will you do?" },
  {
    id: "online-vs-oncampus",
    text: "Why on-campus instead of an online program?",
  },

  // ---------- Background ----------
  { id: "why-usa", text: "Why do you want to study in the USA?" },
  { id: "why-now", text: "Why are you pursuing this degree now?" },
  { id: "family-in-usa", text: "Do you have relatives in the U.S.?" },
  {
    id: "work-experience-relevance",
    text: "How does your work experience relate to this program?",
  },
  {
    id: "field-switch",
    text: "You’re switching fields—why is this credible?",
  },
  { id: "break-between-studies", text: "What did you do during your gap/break?" },
  {
    id: "influenced-by-someone",
    text: "Who influenced your decision to pursue this degree?",
  },

  // ---------- Academics ----------
  { id: "academic-background", text: "Tell me about your academic background." },
  { id: "backlogs-gaps", text: "Why do you have backlogs or a gap?" },
  { id: "low-gpa", text: "Your GPA seems low. Why?" },
  { id: "english-prep", text: "How did you prepare for English proficiency?" },
  { id: "research-experience", text: "Do you have research experience?" },
  {
    id: "standardized-test-low",
    text: "Your standardized test score is low—how will you cope?",
  },
  { id: "waiver-awareness", text: "Was your GRE/English test waived? Why?" },
  {
    id: "project-highlight",
    text: "Describe a key academic project and your role.",
  },
  { id: "academic-honesty", text: "How do you ensure academic integrity?" },

  // ---------- Finances ----------
  {
    id: "living-expenses",
    text: "How will you manage your living expenses?",
  },
  {
    id: "scholarship-ga-ra",
    text: "Do you have any scholarship or assistantship?",
  },
  { id: "education-loan", text: "Are you taking an education loan?" },
  { id: "proof-of-funds-specifics", text: "Can you explain your proof of funds?" },
  {
    id: "sponsor-occupation",
    text: "What is your sponsor’s occupation and income source?",
  },
  { id: "multiple-sponsors", text: "You have multiple sponsors—why?" },
  {
    id: "recent-large-deposits",
    text: "Explain the recent large deposits in your account.",
  },
  {
    id: "part-time-dependence",
    text: "Are you relying on part-time work for tuition?",
  },
  {
    id: "currency-risk",
    text: "How will you handle exchange rate fluctuations?",
  },

  // ---------- Career Plans ----------
  {
    id: "career-plan-short",
    text: "What are your short-term career plans after graduation?",
  },
  { id: "career-plan-long", text: "What are your long-term plans?" },
  { id: "return-to-home", text: "Will you return to your home country?" },
  { id: "how-program-helps", text: "How will this program help your career?" },
  {
    id: "preferred-role",
    text: "Which exact roles are you targeting after graduation?",
  },
  { id: "internship-plan", text: "What’s your plan for internships?" },
  { id: "salary-expectation", text: "What salary do you expect after graduation?" },
  {
    id: "startup-vs-enterprise",
    text: "Startup or large company—what do you prefer?",
  },
  {
    id: "home-country-market",
    text: "How will you use these skills in your home country?",
  },

  // ---------- Home Ties ----------
  { id: "home-ties", text: "What ties do you have to your home country?" },
  {
    id: "property-family",
    text: "Do you or your family own property or businesses?",
  },
  { id: "marital-status", text: "What is your marital status?" },
  {
    id: "family-dependents",
    text: "Do your family members depend on you?",
  },
  {
    id: "community-connections",
    text: "What community connections do you have?",
  },
  {
    id: "long-term-location",
    text: "Where do you see yourself living long-term?",
  },

  // ---------- Compliance ----------
  { id: "visa-history", text: "Have you ever been refused a visa?" },
  { id: "travel-history", text: "What is your travel history?" },
  {
    id: "sevis-i20-awareness",
    text: "What do you understand about SEVIS and the I-20?",
  },
  { id: "cpt-awareness", text: "What is CPT and when can you use it?" },
  { id: "opt-awareness", text: "What is OPT and what are its limits?" },
  { id: "status-maintenance", text: "How will you maintain your F-1 status?" },
  { id: "transfer-schools", text: "Will you transfer to another school?" },
  { id: "dependent-visa", text: "Will any dependents accompany you?" },

  // ---------- Logistics ----------
  { id: "housing-logistics", text: "Where will you stay in the U.S.?" },
  {
    id: "start-date-readiness",
    text: "When does your program start and are you prepared?",
  },
  { id: "campus-location", text: "Where is your university located?" },
  { id: "part-time-work", text: "Do you plan to work part-time?" },
  { id: "flight-plan", text: "When do you plan to travel to the U.S.?" },
  { id: "packing-priorities", text: "What are your packing priorities?" },
  { id: "health-insurance", text: "What about health insurance?" },
  { id: "transport-commute", text: "How will you commute to campus?" },
  {
    id: "orientation-tasks",
    text: "Which initial tasks will you complete on arrival?",
  },
  { id: "weather-readiness", text: "Are you prepared for the local weather?" },
  { id: "emergency-plan", text: "What is your emergency plan in the U.S.?" },
];

const SENSITIVE_QUESTION_IDS = new Set([
  "low-gpa",
  "backlogs-gaps",
  "recent-large-deposits",
  "visa-history",
]);

function userHasSignalFor(prevUserTexts: string[], qid: string): boolean {
  const hay = prevUserTexts.join(" ").toLowerCase();

  if (qid === "low-gpa") {
    return (
      hay.includes("gpa") ||
      hay.includes("grade") ||
      hay.includes("cgpa") ||
      hay.includes("percentage")
    );
  }

  if (qid === "backlogs-gaps") {
    return (
      hay.includes("backlog") ||
      hay.includes("arrear") ||
      hay.includes("supple") ||
      hay.includes("gap")
    );
  }

  if (qid === "recent-large-deposits") {
    return (
      hay.includes("deposit") ||
      hay.includes("bank statement") ||
      hay.includes("fixed") ||
      hay.includes("loan")
    );
  }

  if (qid === "visa-history") {
    return (
      hay.includes("refused") ||
      hay.includes("rejected") ||
      hay.includes("221g") ||
      hay.includes("denied")
    );
  }

  return true;
}

function pickRandomQuestion(
  askedIds: string[],
  prevUserTexts: string[]
): { id: string; text: string } | null {
  const remaining = RANDOM_POOL.filter((q) => !askedIds.includes(q.id));
  if (remaining.length === 0) return null;

  for (let i = 0; i < remaining.length; i++) {
    const idx = Math.floor(Math.random() * remaining.length);
    const cand = remaining[idx];

    if (!SENSITIVE_QUESTION_IDS.has(cand.id)) {
      return cand;
    }

    if (userHasSignalFor(prevUserTexts, cand.id)) {
      return cand;
    }
  }

  return null;
}

function aiSaidBye(text: string | null | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return END_MARKERS.some((m) => lower.includes(m));
}

function userAskedToStop(userText: string | null | undefined): boolean {
  if (!userText) return false;
  const lower = userText.toLowerCase().trim();
  return USER_STOP_MARKERS.some((m) => lower.includes(m));
}

// strip "Officer:" / "Consular Officer:" prefixes that the model sometimes adds
function stripOfficerPrefix(text: string): string {
  const t = text.trim();
  return t
    .replace(/^(consular\s+officer|officer)\s*[:\-–—]\s*/i, "")
    .replace(/^(consular\s+officer|officer)\s+/i, "")
    .trim();
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseFromReq(req);
    const { sessionId, userText, clientTurnToken } = await req.json();

    if (!sessionId || !clientTurnToken) {
      return NextResponse.json(
        { error: "Missing sessionId/clientTurnToken" },
        { status: 400 }
      );
    }

    // auth
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // load session — scope to user
    const { data: session, error: sesErr } = await supabase
      .from("visa_mock_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sesErr || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // if already completed, just return closing
    if (session.status !== "active") {
      return NextResponse.json(
        {
          aiText: CLOSING_TEXT,
          turnNo: session.total_turns ?? 0,
          done: true,
        },
        { status: 200 }
      );
    }

    // idempotency: check if turn with this token already exists
    const { data: existing } = await supabase
      .from("visa_mock_turns")
      .select("*")
      .eq("session_id", sessionId)
      .eq("client_turn_token", clientTurnToken)
      .maybeSingle();

    if (existing) {
      const done = existing.turn_no >= (session.max_turns ?? 20);
      return NextResponse.json({
        aiText: done ? CLOSING_TEXT : existing.ai_text,
        turnNo: existing.turn_no,
        done,
      });
    }

    // count current turns
    const { count } = await supabase
      .from("visa_mock_turns")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId);

    const currentCount = count ?? 0;
    const nextTurnNo = currentCount + 1;
    const maxTurns = session.max_turns ?? 20;

    // if next would exceed max → stop
    if (nextTurnNo > maxTurns) {
      await supabase
        .from("visa_mock_sessions")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          total_turns: currentCount,
        })
        .eq("id", sessionId)
        .eq("user_id", user.id);

      return NextResponse.json(
        {
          error: "MAX_TURNS_REACHED",
          aiText: CLOSING_TEXT,
          turnNo: currentCount,
          done: true,
        },
        { status: 200 }
      );
    }

    // load previous turns (to know asked ids + for history + for signals)
    const { data: prevTurns } = await supabase
      .from("visa_mock_turns")
      .select("user_text, ai_text, turn_no, question_key")
      .eq("session_id", sessionId)
      .order("turn_no", { ascending: true });

    const askedIds = (prevTurns ?? [])
      .map((t) => t.question_key)
      .filter(Boolean) as string[];
    const prevUserTexts = (prevTurns ?? []).map((t) => t.user_text || "");

    // ===== manual early stop from user =====
    if (userAskedToStop(userText)) {
      // record user's final turn (with no new AI question)
      const { error: endInsertErr } = await supabase.from("visa_mock_turns").insert({
        session_id: sessionId,
        turn_no: nextTurnNo,
        user_text: userText ?? "",
        ai_text: CLOSING_TEXT,
        client_turn_token: clientTurnToken,
        question_key: "user-ended",
      });

      if (endInsertErr) {
        console.error("insertErr (user-ended)", endInsertErr);
      }

      await supabase
        .from("visa_mock_sessions")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          total_turns: nextTurnNo,
        })
        .eq("id", sessionId)
        .eq("user_id", user.id);

      return NextResponse.json(
        {
          aiText: CLOSING_TEXT,
          turnNo: nextTurnNo,
          done: true,
        },
        { status: 200 }
      );
    }

    // decide which question to ask
    let nextQuestion: { id: string; text: string } | null = null;

    if (nextTurnNo <= FIXED_SEQUENCE.length) {
      nextQuestion = FIXED_SEQUENCE[nextTurnNo - 1];
    } else {
      nextQuestion = pickRandomQuestion(askedIds, prevUserTexts);
    }

    // if random pool exhausted → close
    if (!nextQuestion) {
      await supabase
        .from("visa_mock_sessions")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          total_turns: currentCount,
        })
        .eq("id", sessionId)
        .eq("user_id", user.id);

      return NextResponse.json(
        {
          aiText: CLOSING_TEXT,
          turnNo: currentCount,
          done: true,
        },
        { status: 200 }
      );
    }

    // build convo history (short) so it sounds continuous
    const history = (prevTurns ?? [])
      .map((t) => `Officer: ${t.ai_text || ""}\nCandidate: ${t.user_text || ""}`)
      .join("\n\n");

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are a U.S. consular officer running an F-1 visa mock interview. Your job is to ask the NEXT QUESTION ONLY. Do NOT add prefixes like 'Officer:' or 'Consular Officer:'. Keep tone professional, neutral, and concise.",
      },
    ];

    if (history) {
      messages.push({
        role: "user",
        content: `Previous Q&A:\n${history}`,
      });
    }

    messages.push({
      role: "user",
      content: `Ask the candidate this question, without changing the meaning: "${nextQuestion.text}"`,
    });

    if (userText) {
      messages.push({
        role: "user",
        content: `Candidate's latest answer: "${userText}"`,
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.25,
      max_tokens: 120,
    });

    let aiText =
      completion.choices[0]?.message?.content?.trim() || nextQuestion.text;

    // strip "Officer:" etc so UI/speech won't read it
    aiText = stripOfficerPrefix(aiText);

    const aiEnded = aiSaidBye(aiText);

    // save turn
    const { error: insertErr } = await supabase.from("visa_mock_turns").insert({
      session_id: sessionId,
      turn_no: nextTurnNo,
      user_text: userText ?? "",
      ai_text: aiEnded ? CLOSING_TEXT : aiText,
      client_turn_token: clientTurnToken,
      question_key: nextQuestion.id,
    });

    if (insertErr) {
      console.error("insertErr", insertErr);
      return NextResponse.json({ error: "Turn insert failed" }, { status: 500 });
    }

    // update session total
    await supabase
      .from("visa_mock_sessions")
      .update({ total_turns: nextTurnNo })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    // if AI said bye OR we hit max → mark session completed here (server-side)
    if (aiEnded || nextTurnNo >= maxTurns) {
      await supabase
        .from("visa_mock_sessions")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          total_turns: nextTurnNo,
        })
        .eq("id", sessionId)
        .eq("user_id", user.id);

      return NextResponse.json(
        {
          aiText: CLOSING_TEXT,
          turnNo: nextTurnNo,
          done: true,
        },
        { status: 200 }
      );
    }

    // else continue
    return NextResponse.json(
      {
        aiText,
        turnNo: nextTurnNo,
        done: false,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("visa/mock/turn error:", err);
    return NextResponse.json(
      { error: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}

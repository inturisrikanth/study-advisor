'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

type Tab = 'in' | 'up';

export default function AuthPage() {
  // ===== Env & Supabase =====
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

  const supabase = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }, [SUPABASE_URL, SUPABASE_ANON_KEY]);

  // Redirect targets (Next routes)
  const APP_URL = typeof window !== 'undefined' ? `${location.origin}/app` : '/app';
  const RESET_URL = '/reset'; // keep if you have a page at app/reset/page.tsx

  // ===== UI State =====
  const [tab, setTab] = useState<Tab>('in');
  const [showSiPass, setShowSiPass] = useState(false);
  const [showSuPass, setShowSuPass] = useState(false);

  // Sign In fields
  const [siEmail, setSiEmail] = useState('');
  const [siPass, setSiPass] = useState('');
  const [signinBusy, setSigninBusy] = useState(false);
  const [signinMsg, setSigninMsg] = useState<string>('');

  // Sign Up fields
  const [suFirst, setSuFirst] = useState('');
  const [suLast, setSuLast] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPass, setSuPass] = useState('');
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupMsg, setSignupMsg] = useState<string>('');

  // Basic guard
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setSigninMsg('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }
  }, [SUPABASE_URL, SUPABASE_ANON_KEY]);

  // ===== Handle email-link / OAuth callback here (e.g., after confirm/reset) =====
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const hadCode =
          typeof window !== 'undefined'
            ? /\b(code|access_token|refresh_token|provider_token)=/.test(location.href)
            : false;

        // Exchange code in URL (if present) for a session
        await supabase.auth.exchangeCodeForSession(window.location.href);

        if (hadCode) {
          // Clean the URL and go to the dashboard
          history.replaceState(null, '', '/app');
          window.location.href = '/app';
        }
      } catch {
        // ignore – user may have just loaded /auth directly
      }
    })();
  }, [supabase]);

  // ===== If already signed in, send them to /app =====
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) window.location.href = '/app';
    })();
  }, [supabase]);

  // ===== Actions =====
  const onSignUp = async () => {
    setSignupMsg('');
    if (!supabase) {
      setSignupMsg('Supabase is not configured.');
      return;
    }
    if (!suFirst || !suLast || !suEmail || !suPass) {
      setSignupMsg('All fields are required.');
      return;
    }
    try {
      setSignupBusy(true);
      const { error } = await supabase.auth.signUp({
        email: suEmail.trim(),
        password: suPass.trim(),
        options: {
          data: { first_name: suFirst.trim(), last_name: suLast.trim() },
          emailRedirectTo: APP_URL, // send confirm email back to /app
        },
      });
      if (error) setSignupMsg('❌ ' + error.message);
      else {
        setSignupMsg('✅ Account created! Check your email to confirm before signing in.');
        setSuFirst(''); setSuLast(''); setSuEmail(''); setSuPass('');
        setTab('in');
      }
    } finally {
      setSignupBusy(false);
    }
  };

  const onSignIn = async () => {
    setSigninMsg('');
    if (!supabase) {
      setSigninMsg('Supabase is not configured.');
      return;
    }
    if (!siEmail || !siPass) {
      setSigninMsg('Email and password are required.');
      return;
    }
    try {
      setSigninBusy(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: siEmail.trim(),
        password: siPass.trim(),
      });
      if (error) setSigninMsg('❌ ' + error.message);
      else {
        setSigninMsg('✅ Login successful. Redirecting…');
        setTimeout(() => { window.location.href = APP_URL; }, 400);
      }
    } finally {
      setSigninBusy(false);
    }
  };

  const onForgot = async () => {
    const prefill = siEmail.trim();
    const email = typeof window !== 'undefined'
      ? window.prompt('Enter your account email:', prefill || '')
      : null;
    if (!email || !supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? `${location.origin}${RESET_URL}` : RESET_URL,
    });
    setSigninMsg(error ? '❌ ' + error.message : '📩 Password reset email sent. Please check your inbox.');
  };

  // ===== Render =====
  return (
    <div className="wrap">
      {/* LEFT: Info/Marketing with hero image */}
      <aside className="info">
        <div className="hero" aria-hidden="true" />
        <span className="kicker">Built for CS/IT MS applicants</span>
        <h1>Plan your applications in minutes — not weeks</h1>
        <p className="sub">
          Search Engineering & IT programs, save your shortlist, generate polished Statements of Purpose,
          and prepare for your F-1 visa interview with structured learning and mock interviews.
        </p>

        <table className="benefits" role="presentation">
          <tbody>
            <tr>
              <td style={{ width: 26 }} className="tick">✓</td>
              <td><strong>US programs for Engineering & IT</strong></td>
              <td>
                Focused on: Computer Science, Data Science, AI/ML, Cybersecurity, Information Systems,
                Software Engineering, Computer Engineering, Data Analytics, and Computer Networks.
              </td>
            </tr>
            <tr>
              <td className="tick">✓</td>
              <td><strong>Smart filters</strong></td>
              <td>Minimum scores, GRE-optional toggle, STEM-only filter, program keyword search.</td>
            </tr>
            <tr>
              <td className="tick">✓</td>
              <td><strong>Saved list</strong></td>
              <td>Keep favorites and start an SOP from any saved program in one click.</td>
            </tr>
            <tr>
              <td className="tick">✓</td>
              <td><strong>Fast SOP generator</strong></td>
              <td>Prefill university + program, add your details, and download a Word (.doc) file.</td>
            </tr>
            <tr>
              <td className="tick">✓</td>
              <td><strong>Visa Guidance — Phase 1</strong></td>
              <td>Learn with curated Q&A for common F-1 interview questions, plus concise prep tips.</td>
            </tr>
            <tr>
              <td className="tick">✓</td>
              <td><strong>Visa Guidance — Phase 2</strong></td>
              <td>Live AI mock visa interview sessions for realistic practice.</td>
            </tr>
            <tr>
              <td className="tick">✓</td>
              <td><strong>Credit-based billing</strong></td>
              <td>Pay only for SOPs and Visa Guidance — Phase 2 (mock interviews); the universities list and Visa Guidance — Phase 1 (learning) are free.</td>
            </tr>
            <tr>
              <td className="tick">✓</td>
              <td><strong>Private by default</strong></td>
              <td>Your data stays with your account.</td>
            </tr>
          </tbody>
        </table>

        <div className="microflow">
          <strong>How it works:</strong> Universities → Save → Generate SOP → Apply for Admission 🎓  
          Then → Visa Guidance (Phase 1 Learning) → Mock Interview (Phase 2 Practice) → Attend Visa Interview 🛂
        </div>
      </aside>

      {/* RIGHT: Auth */}
      <main className="card" role="form" aria-label="Authentication">
        <div className="tabs" role="tablist">
          <button
            className={`tab-btn ${tab === 'in' ? 'active' : ''}`}
            id="tab-signin"
            aria-controls="panel-signin"
            aria-selected={tab === 'in'}
            role="tab"
            onClick={() => setTab('in')}
          >
            Sign In
          </button>
          <button
            className={`tab-btn ${tab === 'up' ? 'active' : ''}`}
            id="tab-signup"
            aria-controls="panel-signup"
            aria-selected={tab === 'up'}
            role="tab"
            onClick={() => setTab('up')}
          >
            Create Account
          </button>
        </div>

        {/* Sign In panel */}
        <section className={`panel ${tab === 'in' ? 'active' : ''}`} id="panel-signin" role="tabpanel" aria-labelledby="tab-signin">
          <label htmlFor="si_email">Email</label>
          <input id="si_email" type="email" autoComplete="email" placeholder="you@example.com" required
                 value={siEmail} onChange={(e) => setSiEmail(e.target.value)} />

          <label htmlFor="si_pass">Password</label>
          <div className="input-row">
            <input id="si_pass" type={showSiPass ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" required
                   value={siPass} onChange={(e) => setSiPass(e.target.value)} />
            <button className="toggle-pass" type="button" onClick={() => setShowSiPass((s) => !s)}>
              {showSiPass ? 'Hide' : 'Show'}
            </button>
          </div>

          <button id="signinBtn" className="btn" disabled={signinBusy} onClick={onSignIn}>
            {signinBusy ? 'Please wait…' : 'Sign In'}
          </button>
          <div className="forgot"><a href="#" onClick={(e) => { e.preventDefault(); onForgot(); }}>Forgot password?</a></div>
          <span id="signinMsg" className="msg muted" aria-live="polite">{signinMsg}</span>
          <div className="footnote">
            By continuing, you agree to our
            {' '}<a href="/docs/terms.html" target="_blank" rel="noopener">Terms</a>{' '}
            and{' '}
            <a href="/docs/privacy.html" target="_blank" rel="noopener">Privacy</a>.
          </div>
        </section>

        {/* Sign Up panel */}
        <section className={`panel ${tab === 'up' ? 'active' : ''}`} id="panel-signup" role="tabpanel" aria-labelledby="tab-signup">
          <label htmlFor="su_first">First name</label>
          <input id="su_first" autoComplete="given-name" required value={suFirst} onChange={(e) => setSuFirst(e.target.value)} />

          <label htmlFor="su_last">Last name</label>
          <input id="su_last" autoComplete="family-name" required value={suLast} onChange={(e) => setSuLast(e.target.value)} />

          <label htmlFor="su_email">Email</label>
          <input id="su_email" type="email" autoComplete="email" placeholder="you@example.com" required
                 value={suEmail} onChange={(e) => setSuEmail(e.target.value)} />

          <label htmlFor="su_pass">Password</label>
          <div className="input-row">
            <input id="su_pass" type={showSuPass ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" required
                   value={suPass} onChange={(e) => setSuPass(e.target.value)} />
            <button className="toggle-pass" type="button" onClick={() => setShowSuPass((s) => !s)}>
              {showSuPass ? 'Hide' : 'Show'}
            </button>
          </div>

          <button id="signupBtn" className="btn" disabled={signupBusy} onClick={onSignUp}>
            {signupBusy ? 'Please wait…' : 'Create Account'}
          </button>
          <span id="signupMsg" className="msg muted" aria-live="polite">{signupMsg}</span>
          <div className="footnote">We’ll send a confirmation email. No spam.</div>
        </section>
      </main>

      {/* Styles */}
      <style jsx global>{`
        :root{
          --bg1:#f7f9ff;
          --bg2:#eef3ff;
          --bg3:#fdfcff;
          --card:#ffffffcc;
          --panel:#ffffff;
          --text:#141a27;
          --muted:#667085;
          --primary:#0a58ca;
          --primary-dark:#094daa;
          --success:#198754;
          --border:#e6e8f0;
          --shadow: 0 20px 50px rgba(24,39,75,.08);
          --radius:16px;
          --hero-url: url("https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?q=80&w=1400&auto=format&fit=crop");
        }
        html, body { height:100%; }
        body{
          color:var(--text);
          background:
            radial-gradient(1000px 600px at -10% -10%, #cfe0ff 0%, transparent 60%),
            radial-gradient(900px 500px at 110% 0%, #ffd7f7 0%, transparent 55%),
            linear-gradient(180deg, var(--bg1), var(--bg2) 50%, var(--bg3));
          position:relative;
          overflow-x:hidden;
        }
        body:after{
          content:"";
          position:fixed; inset:0;
          pointer-events:none;
          background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 100 100'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.65' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0 .04 .08'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
          opacity:.6;
          mix-blend-mode:multiply;
        }
        .wrap{
          max-width:1200px;
          margin:0 auto;
          padding:64px 20px;
          min-height:100vh;
          display:grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap:28px;
          align-items:center;
        }
        @media (max-width: 980px){
          .wrap{ grid-template-columns: 1fr; padding:32px 16px 48px; }
        }
        .info{
          background:var(--card);
          border:1px solid var(--border);
          border-radius:var(--radius);
          padding:26px;
          box-shadow:var(--shadow);
          backdrop-filter: blur(8px);
        }
        .hero{
          position:relative;
          height:220px;
          border-radius:14px;
          overflow:hidden;
          background: #cfe0ff;
          margin-bottom:18px;
          box-shadow:0 12px 30px rgba(10,88,202,.15);
        }
        .hero:before{
          content:"";
          position:absolute; inset:0;
          background-image: var(--hero-url);
          background-size: cover; background-position:center;
          transform: scale(1.02);
          filter: saturate(1.05) contrast(1.03);
        }
        .hero:after{
          content:"";
          position:absolute; inset:0;
          background: linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,0));
        }
        .kicker{
          display:inline-block;
          font-size:12px;
          letter-spacing:.08em;
          color:#3b82f6;
          background:#eef5ff;
          border:1px solid #dbe9ff;
          padding:4px 10px;
          border-radius:999px;
          margin:6px 0 12px;
        }
        h1{ font-size:32px; line-height:1.15; margin:0 0 8px; }
        .sub{ color:var(--muted); margin:0 0 14px; font-size:15px; }
        table.benefits{
          width:100%; border-collapse:collapse; background:#fff;
          border:1px solid var(--border); border-radius:12px; overflow:hidden;
        }
        table.benefits td{ padding:10px 12px; vertical-align:top; font-size:14px; }
        table.benefits tr+tr td{ border-top:1px dashed #eef0f4; }
        .tick{ color:#16a34a; font-weight:700; }
        .microflow{
          margin-top:14px; font-size:14px; color:#475467;
          background:#fcfdfd; border:1px solid var(--border);
          border-radius:10px; padding:10px 12px;
        }
        .card{
          background:var(--panel);
          border:1px solid var(--border);
          border-radius:var(--radius);
          box-shadow:var(--shadow);
          overflow:hidden;
        }
        .tabs{ display:flex; border-bottom:1px solid var(--border); background:#f9fafb; }
        .tab-btn{
          flex:1; padding:16px 16px; text-align:center; cursor:pointer; border:none;
          background:transparent; font-weight:600;
        }
        .tab-btn.active{ background:#fff; border-bottom:2px solid var(--primary); color:var(--primary); }
        .panel{ padding:24px; display:none; }
        .panel.active{ display:block; }
        label{ display:block; font-size:13px; color:#475467; margin:12px 0 6px; }
        input{
          width:100%; padding:12px 12px; font-size:15px;
          border:1px solid #d1d5db; border-radius:10px; outline:none; background:#fff;
        }
        input:focus{ border-color:#9ab8f7; box-shadow:0 0 0 3px rgba(10,88,202,.12); }
        .input-row{ position:relative; }
        .toggle-pass{
          position:absolute; right:10px; top:50%; transform:translateY(-50%);
          font-size:12px; color:var(--primary); background:transparent; border:none; cursor:pointer;
        }
        .btn{
          width:100%; padding:12px 14px; font-size:15px; border-radius:10px;
          border:1px solid var(--primary); background:var(--primary); color:#fff; cursor:pointer;
          transition:background .15s, border-color .15s, opacity .15s; margin-top:12px;
        }
        .btn:hover{ background:var(--primary-dark); border-color:var(--primary-dark); }
        .btn[disabled]{ opacity:.6; cursor:not-allowed; }
        .muted{ color:var(--muted); font-size:13px; }
        a{ color:var(--primary); text-decoration:none; }
        a:hover{ text-decoration:underline; }
        .forgot{ margin-top:8px; text-align:right; }
        .msg{ margin-top:8px; min-height:18px; }
        .footnote{ margin-top:10px; font-size:12px; color:#98a2b3; }
        @media (max-width:540px){
          h1{ font-size:26px; }
          .hero{ height:160px; }
        }
      `}</style>
    </div>
  );
}

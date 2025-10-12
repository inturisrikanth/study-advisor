'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '../../lib/supabaseClient';

if (process.env.NODE_ENV !== 'development') {
  throw new Error('Not available outside development');
}

export default function DevAuthCheck() {
  const [uid, setUid] = useState('checking...');
  const [proj, setProj] = useState<string>('');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setProj(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
    supabaseClient.auth.getUser().then(({ data }) => {
      setUid(data.user ? data.user.id : 'not signed in');
    });
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password: pwd,
    });
    if (error) {
      setMsg(`Sign-in failed: ${error.message}`);
      return;
    }
    const { data } = await supabaseClient.auth.getUser();
    setUid(data.user ? data.user.id : 'not signed in');
    setMsg('Signed in. UID updated above.');
  }

  async function signOut() {
    await supabaseClient.auth.signOut();
    setUid('not signed in');
    setMsg('Signed out.');
  }

  return (
    <main style={{ padding: 16, maxWidth: 480 }}>
      <h1>Dev Auth Check</h1>
      <div style={{ margin: '8px 0' }}>
        <div><strong>Project URL in use:</strong> {proj || '(missing)'}</div>
        <div><strong>UID:</strong> {uid}</div>
      </div>

      <form onSubmit={signIn} style={{ display: 'grid', gap: 8, marginTop: 16 }}>
        <label>
          Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: 8, marginTop: 4 }} />
        </label>
        <label>
          Password
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} required style={{ width: '100%', padding: 8, marginTop: 4 }} />
        </label>
        <button type="submit" style={{ padding: '8px 12px' }}>Sign in (dev)</button>
        {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
      </form>

      <button onClick={signOut} style={{ marginTop: 12, padding: '8px 12px' }}>
        Sign out
      </button>
    </main>
  );
}
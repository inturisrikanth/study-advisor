'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessInner() {
  const search = useSearchParams();

  const sessionId = search.get('session_id') || '';
  const [target, setTarget] = useState('/app#sopsPanel');
  const [label, setLabel] = useState('SOPs');

  useEffect(() => {
    let dest = '/app#sopsPanel';
    let lbl = 'SOPs';

    try {
      const src = localStorage.getItem('last_credit_source');
      if (src === 'visa') {
        dest = '/app/visa#phase2';
        lbl = 'Visa mock interview';
      } else if (src === 'sop') {
        dest = '/app#sopsPanel';
        lbl = 'SOPs';
      }
    } catch {
      // ignore, use defaults
    }

    setTarget(dest);
    setLabel(lbl);

    const t = setTimeout(() => {
      // use full navigation so the #phase2 hash is preserved
      window.location.href = dest;
    }, 2000);

    return () => clearTimeout(t);
  }, []);

  return (
    <main style={{maxWidth:720, margin:'64px auto', padding:'0 16px', fontFamily:'system-ui, Arial'}}>
      <div style={{border:'1px solid #e5e7eb', borderRadius:12, padding:20, background:'#f9fafb'}}>
        <h1 style={{margin:'0 0 6px'}}>Payment successful 🎉</h1>
        <p style={{color:'#475467', margin:'0 0 10px'}}>
          Your credits have been added to your account.
        </p>
        {sessionId ? (
          <p style={{color:'#667085', fontSize:13, margin:'0 0 12px'}}>
            <strong>Session:</strong> {sessionId}
          </p>
        ) : null}
        <p style={{color:'#475467', margin:'0 0 16px'}}>
          Redirecting you to the <strong>{label}</strong> page…
        </p>
        <Link
          href={target}
          className="btn"
          style={{
            display:'inline-block',
            padding:'10px 12px',
            borderRadius:8,
            border:'1px solid #0a58ca',
            background:'#0a58ca',
            color:'#fff',
            textDecoration:'none'
          }}
        >
          Go now
        </Link>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <main style={{maxWidth:720, margin:'64px auto', padding:'0 16px', fontFamily:'system-ui, Arial'}}>
        <div style={{border:'1px solid #e5e7eb', borderRadius:12, padding:20, background:'#f9fafb'}}>
          Completing checkout…
        </div>
      </main>
    }>
      <SuccessInner />
    </Suspense>
  );
}

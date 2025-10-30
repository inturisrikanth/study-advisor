'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function CancelInner() {
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
      // ignore
    }

    setTarget(dest);
    setLabel(lbl);

    const t = setTimeout(() => {
      // use full navigation to preserve #phase2
      window.location.href = dest;
    }, 2500);

    return () => clearTimeout(t);
  }, []);

  return (
    <main style={{maxWidth:720, margin:'64px auto', padding:'0 16px', fontFamily:'system-ui, Arial'}}>
      <div style={{border:'1px solid #fde2e1', borderRadius:12, padding:20, background:'#fff5f5'}}>
        <h1 style={{margin:'0 0 6px'}}>Checkout canceled</h1>
        <p style={{color:'#7f1d1d', margin:'0 0 10px'}}>
          No charge was made. You can try again any time.
        </p>
        {sessionId ? (
          <p style={{color:'#9b2c2c', fontSize:13, margin:'0 0 12px'}}>
            <strong>Session:</strong> {sessionId}
          </p>
        ) : null}
        <p style={{color:'#7f1d1d', margin:'0 0 16px'}}>
          Redirecting you back to the <strong>{label}</strong> page…
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
          Back now
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
          Loading…
        </div>
      </main>
    }>
      <CancelInner />
    </Suspense>
  );
}

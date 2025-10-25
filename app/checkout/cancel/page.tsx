'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function CancelInner() {
  const search = useSearchParams();
  const router = useRouter();

  // Optional: read anything Stripe sent back
  const sessionId = search.get('session_id') || '';

  useEffect(() => {
    // Optional auto-return to SOPs (or auth) after a short delay
    const t = setTimeout(() => {
      router.replace('/app#sopsPanel');
    }, 2500);
    return () => clearTimeout(t);
  }, [router]);

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
        <Link href="/app#sopsPanel" className="btn" style={{
          display:'inline-block', padding:'10px 12px', borderRadius:8,
          border:'1px solid #0a58ca', background:'#0a58ca', color:'#fff', textDecoration:'none'
        }}>
          Back to app
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

'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function SuccessInner() {
  const search = useSearchParams();
  const router = useRouter();

  // Optional: read Stripe session_id if you want to display it
  const sessionId = search.get('session_id') || '';

  useEffect(() => {
    // Gentle auto-redirect back to SOPs tab
    const t = setTimeout(() => {
      router.replace('/app#sopsPanel');
    }, 2000);
    return () => clearTimeout(t);
  }, [router]);

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
          Redirecting you to the <strong>SOPs</strong> tab…
        </p>
        <Link href="/app#sopsPanel" className="btn" style={{
          display:'inline-block', padding:'10px 12px', borderRadius:8,
          border:'1px solid #0a58ca', background:'#0a58ca', color:'#fff', textDecoration:'none'
        }}>
          Go now
        </Link>
      </div>
    </main>
  );
}

export default function Page() {
  // Wrap the client hook usage with Suspense to satisfy Next.js
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

'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function CheckoutSuccess() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Auto-redirect to Generate SOPs tab after a short pause
    const timer = setTimeout(() => {
      router.replace('/app#sopsPanel');
    }, 1800);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main style={{
      maxWidth: '640px',
      margin: '80px auto',
      padding: '20px',
      fontFamily: 'system-ui, Arial, sans-serif',
      textAlign: 'center',
    }}>
      <h1>🎉 Payment Successful!</h1>
      <p>Your credits have been added to your account.</p>
      {sessionId && <p style={{ fontSize: '0.9rem', color: '#666' }}>
        Session ID: {sessionId}
      </p>}
      <p>You’ll be redirected to the app in a moment...</p>

      <button
        onClick={() => router.replace('/app#sopsPanel')}
        style={{
          marginTop: '16px',
          padding: '10px 18px',
          borderRadius: '8px',
          backgroundColor: '#0a58ca',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Go to Generate SOPs Now
      </button>
    </main>
  );
}

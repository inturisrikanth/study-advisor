'use client';

import { useRouter } from 'next/navigation';

export default function CheckoutCancel() {
  const router = useRouter();

  return (
    <main style={{
      maxWidth: '640px',
      margin: '80px auto',
      padding: '20px',
      fontFamily: 'system-ui, Arial, sans-serif',
      textAlign: 'center',
    }}>
      <h1>❌ Payment Canceled</h1>
      <p>No charges were made. You can try again anytime.</p>

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
        Back to Generate SOPs
      </button>
    </main>
  );
}

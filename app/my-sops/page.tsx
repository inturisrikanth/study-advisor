'use client';

import { useEffect, useState } from 'react';
import { type SopRow, createSignedUrlFor } from '../../lib/storage';
import { getMyCredits, useOneCreditOrThrow } from '../../lib/credits';
import { addMyCredits } from '../../lib/credits';
import { uploadSopPdfAndGetLink, listSopsFromDb } from '../../lib/storage';
import { generateSopPdfBlob } from '../../lib/generator';

export default function MySopsPage() {
  const [rows, setRows] = useState<SopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [credits, setCredits] = useState<number>(0);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [regenBusy, setRegenBusy] = useState(false);

  // Load SOPs
  useEffect(() => {
    (async () => {
      try {
        const list = await listSopsFromDb();
        setRows(list);
      } catch (e: any) {
        setMsg(e?.message || 'Failed to load SOPs');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load credits
  useEffect(() => {
    (async () => {
      try {
        const c = await getMyCredits();
        setCredits(c);
      } catch (e: any) {
        setMsg(e?.message || 'Failed to load credits');
      } finally {
        setCreditsLoading(false);
      }
    })();
  }, []);

  // Replace your onDownload with this:
async function onDownload(storagePath: string) {
  if (regenBusy) return; // block while regenerating
  try {
    const url = await createSignedUrlFor(storagePath);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (e: any) {
    setMsg(e?.message || 'Failed to create download link');
  }
}

// Replace your onRegenerate with this:
async function onRegenerate() {
  if (regenBusy) return; // block double clicks
  setMsg(null);
  setRegenBusy(true);
  try {
    const remaining = await useOneCreditOrThrow();
    setCredits(remaining);

    // Clear, explicit progress message
    setMsg('Generating your new SOP…');

    const pdfBlob = await generateSopPdfBlob();
    await uploadSopPdfAndGetLink(pdfBlob, {
      title: 'SOP (regenerated)',
      sessionId: `regen_${Date.now()}`,
      lock: true,
    });

    const updated = await listSopsFromDb();
    setRows(updated);

    setMsg('✅ New SOP generated and saved. You can download it below.');
  } catch (e: any) {
    setMsg(e?.message || 'Failed to regenerate');
  } finally {
    setRegenBusy(false);
  }
}

  async function onPay() {
  setMsg(null);
  try {
    // DEV ONLY: simulate a successful payment that grants 1 credit.
    // In production, call this inside your payment success handler.
    const newBalance = await addMyCredits(1);
    setCredits(newBalance);
    setMsg('Payment received. 1 credit added.');
  } catch (e: any) {
    setMsg(e?.message || 'Failed to add credits');
  }
}

  return (
    <main style={{ padding: 24, maxWidth: 820 }}>
      <h1>My SOPs</h1>
      {msg && (
  <div
    style={{
      marginTop: 12,
      padding: '10px 12px',
      borderRadius: 8,
      background: msg.startsWith('✅')
        ? '#e8f5e9'          // green (success)
        : msg.includes('Failed')
        ? '#ffebee'          // red (error)
        : '#e3f2fd',         // blue (info)
      color: '#111'
    }}
  >
    {msg}
  </div>
)}

      {/* Credits header */}
      <section style={{ marginTop: 8, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600 }}>Regeneration Credits</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Use a credit to regenerate a new SOP version.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
              {creditsLoading ? '…' : credits}
            </div>
            {creditsLoading ? (
  <button disabled style={{ padding: '8px 12px' }}>
    Loading…
  </button>
) : credits > 0 ? (
  <button
    onClick={onRegenerate}
    disabled={regenBusy || creditsLoading || credits <= 0}
    style={{
      padding: '8px 12px',
      cursor: regenBusy ? 'not-allowed' : 'pointer',
      opacity: regenBusy ? 0.6 : 1,
    }}
  >
    {regenBusy ? 'Working…' : 'Regenerate'}
  </button>
) : (
  <button
    onClick={onPay}
    disabled={regenBusy}
    style={{
      padding: '8px 12px',
      cursor: regenBusy ? 'not-allowed' : 'pointer',
      opacity: regenBusy ? 0.6 : 1,
    }}
  >
    Pay
  </button>
)}
          </div>
        </div>
      </section>

      {/* SOP list */}
      {loading && <div style={{ marginTop: 12 }}>Loading your SOPs…</div>}
      {!loading && rows.length === 0 && (
        <div style={{ marginTop: 12 }}>No SOPs found yet.</div>
      )}

      <ul style={{ marginTop: 16, padding: 0, listStyle: 'none' }}>
        {rows.map((r) => (
          <li
            key={r.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 12,
              padding: '10px 0',
              borderBottom: '1px solid #eee',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>
                {r.title?.trim() || r.storage_path.split('/').slice(-1)[0]}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Created: {new Date(r.created_at).toLocaleString()}
                {r.session_id ? ` · Session: ${r.session_id}` : ''}
                {` · ${r.locked ? 'Locked' : 'Unlocked'}`}
              </div>
            </div>
            <button
              onClick={() => onDownload(r.storage_path)}
              style={{ padding: '8px 12px', cursor: 'pointer' }}
            >
              Download
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
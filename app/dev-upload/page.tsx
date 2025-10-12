'use client';

import { useState } from 'react';
import { uploadSopPdfAndGetLink } from '../../lib/storage';

export default function DevUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [signedUrl, setSignedUrl] = useState<string>('');

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    setStatus('');
    setSignedUrl('');
    if (!file) {
      setStatus('Choose a PDF first.');
      return;
    }
    try {
      setStatus('Uploading…');
      const { signedUrl } = await uploadSopPdfAndGetLink(file);
      setSignedUrl(signedUrl);
      setStatus('Uploaded! Signed URL generated below.');
    } catch (err: any) {
      setStatus(`Error: ${err?.message || String(err)}`);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 520 }}>
      <h1>Dev Upload SOP (Test)</h1>
      <form onSubmit={onUpload} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <input
          type="file"
          accept="application/pdf"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" style={{ padding: '8px 12px', cursor: 'pointer' }}>
          Upload & Get Signed URL
        </button>
      </form>
      {status && <div style={{ marginTop: 12 }}>{status}</div>}
      {signedUrl && (
        <div style={{ marginTop: 12 }}>
          <a href={signedUrl} target="_blank" rel="noreferrer">Open Signed URL</a>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            (Link expires ~15 minutes; refresh this page to regenerate.)
          </div>
        </div>
      )}
    </main>
  );
}
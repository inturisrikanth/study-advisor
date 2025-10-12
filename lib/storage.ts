// Study Advisor/lib/storage.ts
import { supabaseClient } from './supabaseClient';
import { getCurrentUserId } from './auth';

function makeSopPath(uid: string) {
  const ts = new Date().toISOString().replace(/:/g, '-');
  return `${uid}/sop_${ts}.pdf`; // stored inside sop_pdfs bucket
}

/**
 * Uploads a PDF Blob/File to storage at sop_pdfs/<uid>/sop_<timestamp>.pdf
 * Returns the storage path and a 15-minute signed URL.
 *
 * IMPORTANT: Requires the user to be signed in (RLS).
 */
// replace the whole function with this enhanced version
export async function uploadSopPdfAndGetLink(
  file: Blob,
  opts?: { title?: string; sessionId?: string; lock?: boolean }
): Promise<{
  path: string;
  signedUrl: string;
}> {
  const uid = await getCurrentUserId();
  const ts = new Date().toISOString().replace(/:/g, '-');
  const path = `${uid}/sop_${ts}.pdf`;

  // 1) Upload to Storage
  const { error: upErr } = await supabaseClient.storage
    .from('sop_pdfs')
    .upload(path, file, {
      contentType: 'application/pdf',
      upsert: false,
    });
  if (upErr) throw upErr;

  // 2) Insert DB record (sop_files)
  const { error: dbErr } = await supabaseClient
    .from('sop_files')
    .insert({
      user_id: uid,
      storage_path: path,
      title: opts?.title ?? null,
      session_id: opts?.sessionId ?? null,
      locked: opts?.lock ?? true, // default lock ON per your rule
    });
  if (dbErr) {
    // Optional: decide whether to delete the uploaded file if DB insert fails.
    // For now we just report the error.
    throw dbErr;
  }

  // 3) Create a signed URL (15 min)
  const { data: signed, error: urlErr } = await supabaseClient.storage
    .from('sop_pdfs')
    .createSignedUrl(path, 60 * 15);
  if (urlErr || !signed?.signedUrl) {
    throw urlErr ?? new Error('Could not create signed URL');
  }

  return { path, signedUrl: signed.signedUrl };
}

export async function listMySopFiles(): Promise<{ name: string; path: string; createdAt?: string }[]> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabaseClient.storage
    .from('sop_pdfs')
    .list(uid, {
      limit: 100,
      sortBy: { column: 'name', order: 'desc' },
    });

  if (error) throw error;

  return (data ?? []).map((obj) => ({
    name: obj.name,
    path: `${uid}/${obj.name}`,
    createdAt: (obj as any)?.created_at || undefined,
  }));
}

export async function createSignedUrlFor(path: string): Promise<string> {
  const { data, error } = await supabaseClient.storage
    .from('sop_pdfs')
    .createSignedUrl(path, 60 * 15);
  if (error || !data?.signedUrl) throw error ?? new Error('Could not create signed URL');
  return data.signedUrl;
}

// DB -> list user's SOPs from sop_files
export type SopRow = {
  id: string;
  user_id: string;
  storage_path: string;
  title: string | null;
  session_id: string | null;
  locked: boolean;
  created_at: string;
};

export async function listSopsFromDb(): Promise<SopRow[]> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabaseClient
    .from('sop_files')
    .select('id,user_id,storage_path,title,session_id,locked,created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as SopRow[];
}
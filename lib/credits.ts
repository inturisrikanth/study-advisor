// Study Advisor/lib/credits.ts
import { supabaseClient } from './supabaseClient';
import { getCurrentUserId } from './auth';

/**
 * Returns the user's current credits.
 * If a row does not exist yet, it creates one with credits=0 and returns 0.
 */
export async function getMyCredits(): Promise<number> {
  const uid = await getCurrentUserId();

  // Try read
  let { data, error } = await supabaseClient
    .from('sop_credits')
    .select('credits')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) throw error;

  // If missing, create row with credits=0
  if (!data) {
    const { data: inserted, error: insErr } = await supabaseClient
      .from('sop_credits')
      .insert({ user_id: uid, credits: 0 })
      .select('credits')
      .single();
    if (insErr) throw insErr;
    return inserted.credits ?? 0;
  }

  return data.credits ?? 0;
}

/**
 * Atomically consumes 1 credit. Throws if none available.
 * Uses a single UPDATE with filter credits > 0 to prevent race conditions.
 * Returns the remaining credits after decrement.
 */
export async function useOneCreditOrThrow(): Promise<number> {
  const uid = await getCurrentUserId();

  // Ensure a row exists; creates {credits: 0} if missing
  await getMyCredits();

  // Atomic decrement on the server
  const { data, error } = await supabaseClient.rpc('sop_decrement_one', {
    p_user_id: uid,
  });

  if (error) {
    if (error.message?.includes('no_credits')) {
      throw new Error('You have 0 credits.');
    }
    throw error;
  }

  // RPC returns remaining credits (integer)
  return data as number;
}

export async function addMyCredits(n: number): Promise<number> {
  if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid credit amount');
  const uid = await getCurrentUserId();

  // Ensure row exists (0 credits) so RLS checks pass cleanly
  await getMyCredits();

  const { data, error } = await supabaseClient.rpc('sop_add_credits', {
    p_user_id: uid,
    p_n: n,
  });

  if (error) throw error;
  return data as number; // remaining credits after add
}
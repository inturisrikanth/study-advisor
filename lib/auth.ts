// StudyAdvisor/lib/auth.ts
import { supabaseClient } from './supabaseClient';

export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not signed in');
  return data.user.id; // <- We’ll use this in the storage path
}
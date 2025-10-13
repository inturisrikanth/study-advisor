import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

// Disable caching and force dynamic evaluation
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  // Build a Supabase client that reads session cookies in a Server Component
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }
  redirect('/dashboard');
}
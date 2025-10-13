import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/auth-helpers-nextjs';

// Disable caching and force dynamic evaluation
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const cookieStore = cookies();

  // Create a Supabase client that can read cookies (for user session)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Get the current user
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect based on login status
  if (!user) {
    redirect('/login');
  } else {
    redirect('/dashboard');
  }
}
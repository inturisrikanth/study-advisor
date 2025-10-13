// app/dev-auth-check/page.tsx
import { notFound } from 'next/navigation';
import DevAuthClient from './DevAuthClient';

// Server-only flags (valid here)
export const dynamic = 'force-dynamic';
export const revalidate = false; // or 0

export default function DevAuthCheckPage() {
  const enabled =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_ROUTES === 'true';

  if (!enabled) {
    // In prod (or when flag is off), make the route 404 to avoid any prerender/build work
    notFound();
  }

  // Render the client component only when enabled
  return <DevAuthClient />;
}
'use client'

import { useEffect } from 'react'
import { supabaseClient as supabase } from '../../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Not signed in → go to /auth
        window.location.href = `${location.origin}/auth`
      } else {
        // Signed in → redirect to dashboard contact section
        router.replace('/app#contactPanel')
      }
    })()
  }, [router])

  return (
    <main
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'system-ui, Arial, sans-serif',
        color: '#555',
      }}
    >
      <div>Loading Contact page…</div>
    </main>
  )
}

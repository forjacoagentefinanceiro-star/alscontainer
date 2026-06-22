'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Atualiza a rota periodicamente (server components re-executam) para alertas "ao vivo".
export function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])
  return null
}

'use client'

import { useRouter } from 'next/navigation'
import { ImportTab } from '@/components/tabs/ImportTab'

export default function ImportarPage() {
  const router = useRouter()
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Importar Containers</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Migre dados do als_containers.html via arquivo XML</p>
      </div>
      <ImportTab onImported={() => router.push('/inventario')} />
    </div>
  )
}

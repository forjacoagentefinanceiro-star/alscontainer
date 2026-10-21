'use client'

import { useState } from 'react'
import { btnLeve } from './ui'

const FONTE: Record<string, string> = { instagram: 'instagram', tiktok: 'tiktok', facebook: 'facebook', marketplace: 'facebook', whatsapp: 'whatsapp', olx: 'olx' }
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Link da página de containers com a campanha já marcada (utm). Use como destino do anúncio. */
export default function CopiarLink({ nome, canal, utm }: { nome: string; canal: string; utm: string | null }) {
  const [ok, setOk] = useState(false)
  function copiar() {
    const base = (process.env.NEXT_PUBLIC_LANDING_URL || window.location.origin).replace(/\/$/, '')
    const url = `${base}/containers?utm_source=${FONTE[canal] ?? 'outro'}&utm_medium=cpc&utm_campaign=${encodeURIComponent(slug(utm || nome))}`
    navigator.clipboard?.writeText(url).then(() => { setOk(true); setTimeout(() => setOk(false), 2500) }).catch(() => window.prompt('Copie o link:', url))
  }
  return <button className={btnLeve} onClick={copiar} title="Copia o link da página de containers com esta campanha">{ok ? 'Link copiado ✓' : 'Copiar link'}</button>
}

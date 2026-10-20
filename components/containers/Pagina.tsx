'use client'

import Image from 'next/image'
import Script from 'next/script'
import { useEffect, useState } from 'react'

const WHATS = process.env.NEXT_PUBLIC_WHATSAPP_VENDAS || '5547989173801'
const META = process.env.NEXT_PUBLIC_META_PIXEL_ID
const TIKTOK = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID

type W = Window & { fbq?: (...a: unknown[]) => void; ttq?: { track: (...a: unknown[]) => void } }

const NAVY = '#061834'
const LIME = '#8cd62e'

function gerarRef() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => c[Math.floor(Math.random() * c.length)]).join('')
}

export default function Pagina({ precoMin, precoMax, unidades }: { precoMin: number; precoMax: number | null; unidades: number | null }) {
  const [ref] = useState(gerarRef)
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  useEffect(() => {
    // lembra a origem (anúncio) mesmo que a pessoa navegue antes de clicar
    try {
      const q = new URLSearchParams(window.location.search)
      if ([...q.keys()].some(k => k.startsWith('utm_') || k === 'fbclid' || k === 'ttclid')) sessionStorage.setItem('als-origem', q.toString())
    } catch { /* modo privado */ }
  }, [])

  function chamar(onde: string) {
    const w = window as W
    let q = new URLSearchParams(window.location.search)
    try { const g = sessionStorage.getItem('als-origem'); if (g && ![...q.keys()].length) q = new URLSearchParams(g) } catch { /* */ }

    // pixels: evento de lead
    try { w.fbq?.('track', 'Lead', { content_name: "Container 40' High Cube usado", content_category: onde }) } catch { /* */ }
    try { w.ttq?.track('Contact', { content_name: "Container 40' High Cube usado" }) } catch { /* */ }

    // cria o lead no CRM (o servidor ignora cliques repetidos do mesmo ref)
    {
      const corpo = JSON.stringify({
        ref, utm_source: q.get('utm_source'), utm_medium: q.get('utm_medium'), utm_campaign: q.get('utm_campaign'),
        utm_content: q.get('utm_content'), fbclid: q.get('fbclid'), ttclid: q.get('ttclid'),
      })
      try { fetch('/api/containers/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo, keepalive: true }).catch(() => {}) } catch { /* */ }
    }

    const texto = `Olá! Vi o container 40' High Cube usado no anúncio e quero saber mais. (ref. ${ref})`
    const url = `https://wa.me/${WHATS}?text=${encodeURIComponent(texto)}`
    const novo = window.open(url, '_blank')
    if (!novo) window.location.assign(url)
  }

  const fotos = [
    ['lateral', 'Container 40 pés High Cube Evergreen, lateral'],
    ['interior-2', 'Interior do container: limpo e amplo'],
    ['interior-porta', 'Interior do container visto da porta'],
    ['traseira', 'Traseira do container'],
    ['lateral-aberta', 'Container no pátio'],
    ['interior-1', 'Piso de madeira do container'],
  ]

  const botao = (onde: string, grande = false) => (
    <button key={onde} onClick={() => chamar(onde)}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[.98] ${grande ? 'px-8 py-4 text-lg' : 'px-5 py-2.5 text-sm'}`}
      style={{ background: '#25D366' }}>
      <svg width={grande ? 22 : 18} height={grande ? 22 : 18} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.97L2 22l5.19-1.5A9.93 9.93 0 1 0 12.04 2Zm5.8 14.2c-.25.7-1.45 1.34-2 1.4-.52.06-1.17.09-1.9-.12a11 11 0 0 1-3.2-1.7 12.5 12.5 0 0 1-3.15-3.9c-.36-.67-.64-1.5-.64-2.27 0-.77.4-1.15.55-1.3.14-.17.3-.2.4-.2l.3.01c.1 0 .24-.04.37.28.14.34.48 1.18.52 1.27.04.08.07.19.01.3-.05.1-.08.17-.16.27l-.24.28c-.08.08-.16.17-.07.34.1.17.42.7.9 1.13.62.55 1.14.73 1.3.8.17.08.27.07.37-.04.1-.12.43-.5.55-.68.11-.17.23-.14.38-.08.15.06.97.46 1.14.54.17.09.28.13.32.2.04.07.04.4-.2 1.1Z" /></svg>
      Chamar no WhatsApp
    </button>
  )

  return (
    <div style={{ background: NAVY, color: '#fff', fontFamily: 'Segoe UI, Arial, sans-serif' }} className="min-h-screen">
      {META && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META}');fbq('track','PageView');`}</Script>
      )}
      {TIKTOK && (
        <Script id="tiktok-pixel" strategy="afterInteractive">{`
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${TIKTOK}');ttq.page();}(window,document,'ttq');`}</Script>
      )}

      {/* topo */}
      <header className="sticky top-0 z-30 backdrop-blur" style={{ background: 'rgba(6,24,52,.92)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="ALS Logística" width={92} height={48} className="rounded-lg" style={{ height: 40, width: 'auto' }} priority />
            <span className="hidden sm:block text-xs tracking-[.2em] uppercase text-white/70">Logística que move o seu negócio</span>
          </div>
          {botao('topo')}
        </div>
      </header>

      {/* hero */}
      <section className="relative">
        <div className="relative h-[420px] sm:h-[520px]">
          <Image src="/containers/lateral.jpg" alt="Container 40 pés High Cube usado" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(6,24,52,.25) 0%, rgba(6,24,52,.55) 55%, ${NAVY} 100%)` }} />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-4 pb-8">
            <p className="text-xs tracking-[.25em] uppercase text-white/80 mb-2">ALS Logística · Itajaí/SC</p>
            <h1 className="font-black italic leading-[1.02] text-4xl sm:text-6xl">
              Container <span style={{ color: LIME }}>40&apos; High Cube</span><br />usado em ótimo estado
            </h1>
            <p className="mt-3 text-white/85 text-lg max-w-xl">Pronta entrega. Veja pessoalmente no pátio antes de comprar.</p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <span className="rounded-2xl px-5 py-3 font-black italic text-2xl sm:text-3xl" style={{ background: LIME, color: NAVY }}>
                {precoMax && precoMax !== precoMin ? `${brl(precoMin)} a ${brl(precoMax)}` : `A partir de ${brl(precoMin)}`}
              </span>
              {botao('hero', true)}
            </div>
            <p className="mt-3 text-sm text-white/70">
              {unidades != null && unidades > 0 ? `${unidades} unidade${unidades > 1 ? 's' : ''} disponíve${unidades > 1 ? 'is' : 'l'} · ` : ''}
              Valor conforme o tipo e o ano do container · retirada em Itajaí/SC · frete sob consulta
            </p>
          </div>
        </div>
      </section>

      {/* vantagens */}
      <section className="mx-auto max-w-5xl px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Interior limpo e amplo', 'Paredes e teto íntegros'],
          ['Piso de madeira inteiro', 'Pronto para usar'],
          ['High Cube', 'Altura extra: mais espaço'],
          ['Visita liberada', 'Confira antes de comprar'],
        ].map(([t, s]) => (
          <div key={t} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>
            <p className="font-bold" style={{ color: LIME }}>✓ {t}</p>
            <p className="text-sm text-white/70 mt-1">{s}</p>
          </div>
        ))}
      </section>

      {/* fotos */}
      <section className="mx-auto max-w-5xl px-4 pb-10">
        <h2 className="font-black italic text-2xl sm:text-3xl mb-4">Veja o container <span style={{ color: LIME }}>por dentro e por fora</span></h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {fotos.map(([f, alt], i) => (
            <div key={f} className={`relative overflow-hidden rounded-2xl ${i === 0 ? 'col-span-2 md:col-span-2 md:row-span-1' : ''}`} style={{ aspectRatio: i === 0 ? '16/9' : '4/5' }}>
              <Image src={`/containers/${f}.jpg`} alt={alt} fill sizes="(max-width:768px) 50vw, 33vw" className="object-cover" />
            </div>
          ))}
        </div>
      </section>

      {/* usos */}
      <section className="mx-auto max-w-5xl px-4 pb-10">
        <h2 className="font-black italic text-2xl sm:text-3xl mb-4">Serve para <span style={{ color: LIME }}>muita coisa</span></h2>
        <div className="flex flex-wrap gap-2">
          {['Obra e canteiro', 'Depósito', 'Loja ou quiosque', 'Ateliê e escritório', 'Casa container', 'Sítio e fazenda'].map(u => (
            <span key={u} className="rounded-full px-4 py-2 text-sm font-semibold" style={{ background: 'rgba(140,214,46,.14)', color: LIME, border: '1px solid rgba(140,214,46,.35)' }}>{u}</span>
          ))}
        </div>
      </section>

      {/* como comprar */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <h2 className="font-black italic text-2xl sm:text-3xl mb-4">Como <span style={{ color: LIME }}>comprar</span></h2>
        <div className="grid md:grid-cols-3 gap-3">
          {[['1', 'Chame no WhatsApp', 'Conte para que vai usar e em qual cidade.'], ['2', 'Veja no pátio', 'Agende a visita e confira a unidade pessoalmente.'], ['3', 'Feche e retire', 'Combine o pagamento e a retirada ou o frete.']].map(([n, t, s]) => (
            <div key={n} className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full font-black" style={{ background: LIME, color: NAVY }}>{n}</span>
              <p className="font-bold mt-3">{t}</p><p className="text-sm text-white/70 mt-1">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* chamada final */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-5xl rounded-3xl p-8 sm:p-10 text-center" style={{ background: `linear-gradient(135deg, #0a2a58, ${NAVY})`, border: '1px solid rgba(140,214,46,.35)' }}>
          <h2 className="font-black italic text-3xl sm:text-4xl">Garanta o <span style={{ color: LIME }}>seu</span></h2>
          <p className="mt-2 text-white/80">Fale agora com a ALS Logística e agende a sua visita.</p>
          <div className="mt-6">{botao('final', true)}</div>
        </div>
      </section>

      <footer className="text-center text-xs text-white/50 pb-10 px-4">
        ALS Logística · Itajaí/SC · <a href="https://alslog.com.br" className="underline">alslog.com.br</a>
      </footer>

      {/* botão fixo no celular */}
      <div className="fixed bottom-4 inset-x-4 z-40 sm:hidden"><div className="flex justify-center">{botao('fixo', true)}</div></div>
    </div>
  )
}

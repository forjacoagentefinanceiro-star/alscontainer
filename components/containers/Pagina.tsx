'use client'

import Image from 'next/image'
import Script from 'next/script'
import { useEffect, useState } from 'react'

const MARCA = 'ALM Containers'
const WHATS = process.env.NEXT_PUBLIC_WHATSAPP_VENDAS || '5547989173801'
const WHATS_EXIBIDO = '(47) 98917-3801'
const META = process.env.NEXT_PUBLIC_META_PIXEL_ID
const TIKTOK = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID

type W = Window & { fbq?: (...a: unknown[]) => void; ttq?: { track: (...a: unknown[]) => void } }

const BG = '#101217'
const PAINEL = '#1a1d25'
const ACENTO = '#2f7df6'

// fila: as chamadas ao CRM saem uma de cada vez (evita lead duplicado por requisições simultâneas)
let fila: Promise<unknown> = Promise.resolve()

function gerarRef() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => c[Math.floor(Math.random() * c.length)]).join('')
}
function mascara(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
const soDigitos = (v: string) => v.replace(/\D/g, '')

function origemDaVisita(): Record<string, string | null> {
  let q = new URLSearchParams(window.location.search)
  try {
    if ([...q.keys()].some(k => k.startsWith('utm_') || k === 'fbclid' || k === 'ttclid')) sessionStorage.setItem('alm-origem', q.toString())
    else { const g = sessionStorage.getItem('alm-origem'); if (g) q = new URLSearchParams(g) }
  } catch { /* modo privado */ }
  return {
    utm_source: q.get('utm_source'), utm_medium: q.get('utm_medium'), utm_campaign: q.get('utm_campaign'),
    utm_content: q.get('utm_content'), fbclid: q.get('fbclid'), ttclid: q.get('ttclid'),
  }
}

function Logo({ tamanho = 34 }: { tamanho?: number }) {
  // logomarca original da ALM Containers (recorte do logotipo, com bordas esfumadas para fundir ao fundo escuro)
  const h = Math.round(tamanho * 1.7)
  return <Image src="/containers/alm-logo.png" alt={MARCA} width={Math.round(h * 900 / 512)} height={h} priority style={{ height: h, width: 'auto' }} />
}

export default function Pagina({ precoMin }: { precoMin: number }) {
  const [ref] = useState(gerarRef)
  const [nome, setNome] = useState('')
  const [tel, setTel] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')
  const [salvoParcial, setSalvoParcial] = useState('')
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  function enviar(corpo: Record<string, unknown>, beacon = false) {
    const dados = JSON.stringify({ ref, ...origemDaVisita(), ...corpo })
    try {
      if (beacon && navigator.sendBeacon) { navigator.sendBeacon('/api/containers/lead', new Blob([dados], { type: 'application/json' })); return }
      fila = fila.then(() => fetch('/api/containers/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: dados, keepalive: true })).catch(() => {})
    } catch { /* sem rede: o formulário final tenta de novo no envio */ }
  }

  // Captura quando o telefone fica válido (mesmo que a pessoa não clique em enviar)
  useEffect(() => {
    if (enviado) return
    const d = soDigitos(tel)
    if (d.length < 10) return
    const chave = `${nome.trim()}|${d}`
    if (chave === salvoParcial) return
    const t = setTimeout(() => { enviar({ nome: nome.trim(), telefone: d }); setSalvoParcial(chave) }, 1200)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome, tel, enviado, salvoParcial])

  // Se a pessoa fechar a página/aba com o telefone preenchido, garante o envio
  useEffect(() => {
    if (enviado) return
    function sair() {
      const d = soDigitos(tel)
      if (d.length >= 10 && `${nome.trim()}|${d}` !== salvoParcial) enviar({ nome: nome.trim(), telefone: d }, true)
    }
    const vis = () => { if (document.visibilityState === 'hidden') sair() }
    document.addEventListener('visibilitychange', vis)
    window.addEventListener('pagehide', sair)
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', sair) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome, tel, enviado, salvoParcial])

  function rastrear(evento: 'form' | 'whats') {
    const w = window as W
    try { if (evento === 'form') w.fbq?.('track', 'Lead', { content_name: "Container 40' High Cube usado" }); else w.fbq?.('track', 'Contact') } catch { /* */ }
    try { w.ttq?.track(evento === 'form' ? 'SubmitForm' : 'Contact', { content_name: "Container 40' High Cube usado" }) } catch { /* */ }
  }

  function submeter(e: React.FormEvent) {
    e.preventDefault()
    const d = soDigitos(tel)
    if (nome.trim().length < 2) { setErro('Digite o seu nome.'); return }
    if (d.length < 10 || d.length > 11) { setErro('Digite o telefone com DDD, ex.: (47) 99999-9999.'); return }
    setErro('')
    enviar({ nome: nome.trim(), telefone: d, final: true })
    rastrear('form')
    setEnviado(true)
    // leva a pessoa direto para a conversa no seu WhatsApp (dá tempo de registrar o lead e os pixels)
    Promise.race([fila, new Promise(r => setTimeout(r, 2500))]).then(() => setTimeout(() => chamarWhats('formulário', true), 300))
  }

  function chamarWhats(origem: string, auto = false) {
    rastrear('whats')
    if (soDigitos(tel).length < 10) enviar({ nome: nome.trim() })   // cria o lead mesmo sem telefone (clique no WhatsApp)
    const texto = `Olá! Sou ${nome.trim() || 'interessado'} e vi o container 40' High Cube usado (${origem}). Quero saber o preço e ver as fotos. (ref. ${ref})`
    const url = `https://wa.me/${WHATS}?text=${encodeURIComponent(texto)}`
    if (auto) { window.location.assign(url); return }
    const novo = window.open(url, '_blank')
    if (!novo) window.location.assign(url)
  }

  const preco = `a partir de ${brl(precoMin)}`

  const formulario = enviado ? (
    <div className="rounded-3xl p-6 text-center" style={{ background: PAINEL, border: `2px solid ${ACENTO}` }} id="form">
      <p className="text-4xl">✅</p>
      <h2 className="mt-2 text-2xl font-black italic text-white">Recebemos o seu pedido{nome.trim() ? `, ${nome.trim().split(' ')[0]}` : ''}!</h2>
      <p className="mt-2 text-white/75">Estamos abrindo o WhatsApp para você falar direto com a gente e receber o preço e as fotos. Se não abrir, toque no botão:</p>
      <button onClick={() => chamarWhats('formulário')} className="mt-4 w-full rounded-2xl py-4 text-lg font-black text-white transition hover:brightness-110" style={{ background: '#25D366' }}>
        Abrir o WhatsApp
      </button>
    </div>
  ) : (
    <form onSubmit={submeter} className="rounded-3xl p-5 sm:p-6" style={{ background: PAINEL, border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 20px 60px rgba(0,0,0,.45)' }} id="form" noValidate>
      <p className="text-xs font-bold uppercase tracking-[.2em]" style={{ color: ACENTO }}>Resposta pelo WhatsApp</p>
      <h2 className="mt-1 text-2xl font-black italic leading-tight text-white">Receba o preço e as fotos agora</h2>
      <label className="mt-4 block text-sm font-semibold text-white/80">Seu nome
        <input value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" placeholder="Como podemos te chamar?"
          className="mt-1 w-full rounded-xl border-0 px-4 py-3.5 text-base text-slate-900 outline-none focus:ring-2" style={{ background: '#fff', ['--tw-ring-color' as string]: ACENTO }} />
      </label>
      <label className="mt-3 block text-sm font-semibold text-white/80">Seu WhatsApp
        <input value={tel} onChange={e => setTel(mascara(e.target.value))} inputMode="tel" autoComplete="tel-national" placeholder="(47) 99999-9999"
          className="mt-1 w-full rounded-xl border-0 px-4 py-3.5 text-base text-slate-900 outline-none focus:ring-2" style={{ background: '#fff', ['--tw-ring-color' as string]: ACENTO }} />
      </label>
      {/* campo escondido contra robôs */}
      <input type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" onChange={() => {}} />
      {erro && <p className="mt-2 text-sm font-semibold text-red-400">{erro}</p>}
      <button type="submit" className="mt-4 w-full rounded-2xl py-4 text-lg font-black uppercase tracking-wide text-white transition hover:brightness-110 active:scale-[.99]" style={{ background: ACENTO }}>
        Quero o preço agora
      </button>
      <p className="mt-3 text-center text-xs leading-snug text-white/50">
        Ao preencher, você autoriza a {MARCA} a entrar em contato por telefone ou WhatsApp. Seus dados são usados só para este atendimento.
      </p>
    </form>
  )

  const fotos: [string, string][] = [
    ['lateral', 'Container 40 pés High Cube usado, lateral'],
    ['interior-2', 'Interior limpo e amplo do container'],
    ['interior-porta', 'Container visto de dentro, da porta'],
    ['traseira', 'Traseira do container'],
    ['lateral-aberta', 'Container no pátio, Itajaí/SC'],
    ['interior-1', 'Piso de madeira do container'],
  ]

  return (
    <div style={{ background: BG, color: '#fff', fontFamily: '"Segoe UI", Arial, sans-serif' }} className="min-h-screen pb-24 sm:pb-0">
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
      <header className="sticky top-0 z-30" style={{ background: 'rgba(16,18,23,.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <button onClick={() => chamarWhats('topo')} className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: '#25D366' }}>WhatsApp</button>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/containers/lateral.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(16,18,23,.93) 0%, rgba(16,18,23,.62) 42%, rgba(16,18,23,.12) 100%)' }} />
          <div className="absolute inset-x-0 bottom-0 h-40" style={{ background: `linear-gradient(180deg, transparent, ${BG})` }} />
        </div>
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pb-14 pt-10 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:pt-16">
          <div>
            <span className="inline-block rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white" style={{ background: ACENTO }}>Pronta entrega · Itajaí/SC</span>
            <h1 className="mt-4 text-4xl font-black italic leading-[1.02] sm:text-6xl">
              Container <span style={{ color: ACENTO }}>40&apos; High Cube</span><br />usado, em ótimo estado
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/85">Obra, loja, depósito ou casa container: a estrutura que você precisa, pronta para usar. <strong>Veja pessoalmente antes de comprar.</strong></p>
            <ul className="mt-5 space-y-2 text-base text-white/90">
              {['Interior limpo e amplo, piso de madeira inteiro', 'High Cube: altura extra para mais espaço', 'Visita liberada no pátio, em Itajaí/SC'].map(t => (
                <li key={t} className="flex gap-2"><span style={{ color: ACENTO }}>✔</span>{t}</li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="rounded-2xl px-5 py-3 text-2xl font-black italic text-white sm:text-3xl" style={{ background: ACENTO }}>Containers {preco}</span>
            </div>
            <p className="mt-2 text-sm text-white/60">Valor conforme o tipo e o ano do container · frete sob consulta.</p>
          </div>
          <div>{formulario}</div>
        </div>
      </section>

      {/* marca */}
      <section className="mx-auto max-w-6xl px-4 pt-2 pb-8">
        <div className="relative overflow-hidden rounded-3xl" style={{ aspectRatio: '16/8', border: '1px solid rgba(255,255,255,.1)' }}>
          <Image src="/containers/alm-banner.jpg" alt="ALM Containers — venda e locação de containers" fill sizes="(max-width:1152px) 100vw, 1152px" className="object-cover" />
        </div>
        <p className="mt-3 text-center text-sm tracking-[.2em] text-white/60 uppercase">Venda e locação de containers · Itajaí/SC</p>
      </section>

      {/* confiança */}
      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 py-10 md:grid-cols-4">
        {[['👀', 'Veja antes de comprar', 'Visita liberada no pátio'], ['📦', 'Pronta entrega', 'Unidade real, como nas fotos'], ['💬', 'Atendimento direto', 'Tire dúvidas pelo WhatsApp'], ['🚚', 'Frete sob consulta', 'Cotamos para a sua cidade']].map(([i, t, s]) => (
          <div key={t} className="rounded-2xl p-4" style={{ background: PAINEL, border: '1px solid rgba(255,255,255,.08)' }}>
            <p className="text-2xl">{i}</p><p className="mt-2 font-bold">{t}</p><p className="text-sm text-white/60">{s}</p>
          </div>
        ))}
      </section>

      {/* fotos reais */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="text-3xl font-black italic sm:text-4xl">É este container. <span style={{ color: ACENTO }}>Fotos reais.</span></h2>
        <p className="mt-2 text-white/70">Sem imagem de banco: a unidade que está no nosso pátio, por fora e por dentro.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {fotos.map(([f, alt], i) => (
            <div key={f} className={`relative overflow-hidden rounded-2xl ${i === 0 ? 'col-span-2' : ''}`} style={{ aspectRatio: i === 0 ? '16/9' : '4/5' }}>
              <Image src={`/containers/${f}.jpg`} alt={alt} fill sizes="(max-width:768px) 50vw, 33vw" className="object-cover" />
            </div>
          ))}
        </div>
        <div className="mt-6 text-center"><a href="#form" className="inline-block rounded-2xl px-8 py-4 text-lg font-black uppercase text-white" style={{ background: ACENTO }}>Quero o preço agora</a></div>
      </section>

      {/* usos */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="text-3xl font-black italic sm:text-4xl">Um container, <span style={{ color: ACENTO }}>vários negócios</span></h2>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {[['🏗️', 'Obra e canteiro', 'Depósito e escritório de obra, seguros e rápidos de instalar.'], ['🏪', 'Loja e quiosque', 'Abra o seu ponto de venda por muito menos que uma construção.'], ['📦', 'Depósito', 'Guarde estoque, ferramentas e equipamentos com segurança.'], ['🏠', 'Casa container', 'Moradia, ateliê ou escritório com projeto moderno e econômico.'], ['🌾', 'Sítio e fazenda', 'Paiol, galpão e armazenagem resistentes ao tempo.'], ['🎨', 'Ateliê e estúdio', 'Um espaço próprio, do tamanho do seu projeto.']].map(([i, t, s]) => (
            <div key={t} className="rounded-2xl p-4" style={{ background: PAINEL, border: '1px solid rgba(255,255,255,.08)' }}>
              <p className="text-3xl">{i}</p><p className="mt-2 font-bold">{t}</p><p className="mt-1 text-sm text-white/65">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* como comprar */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="text-3xl font-black italic sm:text-4xl">Como <span style={{ color: ACENTO }}>comprar</span></h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[['1', 'Peça o preço', 'Preencha seu nome e WhatsApp. Respondemos com o valor e as fotos.'], ['2', 'Veja no pátio', 'Agende a visita em Itajaí/SC e confira a unidade pessoalmente.'], ['3', 'Feche e retire', 'Combine o pagamento e a retirada, ou peça a cotação do frete.']].map(([n, t, s]) => (
            <div key={n} className="rounded-2xl p-5" style={{ background: PAINEL, border: '1px solid rgba(255,255,255,.08)' }}>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full text-lg font-black text-white" style={{ background: ACENTO }}>{n}</span>
              <p className="mt-3 text-lg font-bold">{t}</p><p className="mt-1 text-sm text-white/65">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* perguntas */}
      <section className="mx-auto max-w-3xl px-4 pb-12">
        <h2 className="text-3xl font-black italic sm:text-4xl">Perguntas <span style={{ color: ACENTO }}>frequentes</span></h2>
        <div className="mt-5 space-y-3">
          {[
            ['Posso ver o container antes de comprar?', 'Sim. Agende uma visita ao pátio em Itajaí/SC e confira a unidade pessoalmente.'],
            ['Quais são as medidas?', "É um container de 40 pés High Cube: cerca de 12,19 m de comprimento, 2,44 m de largura e 2,90 m de altura (medidas externas padrão)."],
            ['Vocês entregam?', 'A retirada é no pátio em Itajaí/SC. Para entrega, cotamos o frete para a sua cidade.'],
            ['Quanto custa?', `Os containers saem ${preco}, conforme o tipo e o ano. Preencha o formulário e enviamos o preço da unidade e as fotos.`],
            ['Como é o pagamento?', 'As condições são combinadas no atendimento, pelo WhatsApp.'],
          ].map(([q, a]) => (
            <details key={q} className="group rounded-2xl p-4" style={{ background: PAINEL, border: '1px solid rgba(255,255,255,.08)' }}>
              <summary className="cursor-pointer list-none font-bold marker:hidden">{q}<span className="float-right" style={{ color: ACENTO }}>＋</span></summary>
              <p className="mt-2 text-white/70">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* chamada final */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-4xl rounded-3xl p-8 text-center sm:p-12" style={{ background: `linear-gradient(135deg, #2a2f3a, ${PAINEL})`, border: `1px solid ${ACENTO}` }}>
          <h2 className="text-3xl font-black italic sm:text-5xl">Garanta o <span style={{ color: ACENTO }}>seu container</span></h2>
          <p className="mx-auto mt-3 max-w-xl text-white/75">Pronta entrega em Itajaí/SC. Peça o preço agora e veja a unidade antes de decidir.</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#form" className="rounded-2xl px-8 py-4 text-lg font-black uppercase text-white" style={{ background: ACENTO }}>Quero o preço agora</a>
            <button onClick={() => chamarWhats('final')} className="rounded-2xl px-8 py-4 text-lg font-black text-white" style={{ background: '#25D366' }}>Falar no WhatsApp</button>
          </div>
        </div>
      </section>

      <footer className="px-4 pb-10 text-center text-xs text-white/45">
        <div className="flex justify-center"><Logo tamanho={48} /></div>
        <p className="mt-3">{MARCA} · Itajaí/SC · WhatsApp {WHATS_EXIBIDO}</p>
        <p className="mt-1">Seus dados são usados somente para o atendimento desta solicitação.</p>
      </footer>

      {/* barra fixa no celular */}
      {!enviado && (
        <div className="fixed inset-x-3 bottom-3 z-40 sm:hidden">
          <a href="#form" className="block rounded-2xl py-4 text-center text-lg font-black uppercase text-white shadow-2xl" style={{ background: ACENTO }}>Quero o preço agora</a>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ENDERECO_LINHA1, ENDERECO_LINHA2, MENU, WHATS, WHATS_EXIBIDO } from '@/lib/site/dados'
import { enviarLead, gerarRef, mascara, rastrear, soDigitos, urlWhats } from './lead'
import ModalContato, { contatoSalvo } from './ModalContato'

/* ---------- revelação ao rolar ---------- */
export function Rev({ children, className = '', d = 0, tipo = '', zoom = false }: { children: React.ReactNode; className?: string; d?: number; tipo?: '' | 'esq' | 'dir' | 'zoom'; zoom?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  if (zoom && !tipo) tipo = 'zoom'
  useEffect(() => {
    const el = ref.current; if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('in'); io.disconnect() } }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' })
    io.observe(el); return () => io.disconnect()
  }, [])
  return <div ref={ref} className={`rev ${tipo} ${className}`} style={{ ['--d' as string]: `${d}s` }}>{children}</div>
}

/* ---------- barra de progresso de leitura ---------- */
export function Progresso() {
  const [p, setP] = useState(0)
  useEffect(() => {
    const f = () => { const h = document.documentElement; setP(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) }
    f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f)
  }, [])
  return <div className="fixed left-0 top-0 z-[60] h-[3px] origin-left" style={{ width: '100%', transform: `scaleX(${p})`, background: 'linear-gradient(90deg,#ff9f1a,#ff6a00)' }} />
}

/* ---------- palavras que trocam no título ---------- */
export function Palavras({ lista }: { lista: string[] }) {
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % lista.length), 2200); return () => clearInterval(t) }, [lista.length])
  return <span key={i} className="palavra laranja-texto">{lista[i]}</span>
}

/* ---------- cabeçalho (transparente no topo, vidro ao rolar) ---------- */
export function Cabecalho({ atual }: { atual: string }) {
  const [rolou, setRolou] = useState(false)
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    const f = () => setRolou(window.scrollY > 40); f()
    window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f)
  }, [])
  useEffect(() => { document.body.style.overflow = aberto ? 'hidden' : '' ; return () => { document.body.style.overflow = '' } }, [aberto])
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${rolou || aberto ? 'vidro' : ''}`} style={{ borderLeft: 0, borderRight: 0, borderTop: 0, background: rolou || aberto ? 'rgba(13,15,20,.92)' : 'transparent' }}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" aria-label="MLA Containers — início" className="shrink-0">
          <Image src="/containers/mla-logo.png" alt="MLA Containers" width={170} height={62} unoptimized style={{ height: rolou ? 46 : 58, width: 'auto', transition: 'height .4s' }} priority />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {MENU.map(([h, t]) => (
            <a key={h} href={h} className="rounded-full px-4 py-2 text-sm font-semibold tracking-wide transition hover:text-[var(--acento)]" style={{ color: atual === h ? 'var(--acento)' : 'rgba(255,255,255,.85)' }}>{t}</a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <BotaoWhats origem="cabeçalho" className="btn btn-zap hidden !px-5 !py-2.5 !text-sm sm:inline-flex">WhatsApp</BotaoWhats>
          <button aria-label="Menu" onClick={() => setAberto(v => !v)} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 lg:hidden">
            <span className="block h-0.5 w-5 bg-white transition" style={{ transform: aberto ? 'translateY(3px) rotate(45deg)' : 'translateY(-3px)' }} />
            <span className="-mt-0.5 block h-0.5 w-5 bg-white transition" style={{ transform: aberto ? 'translateY(-3px) rotate(-45deg)' : 'translateY(3px)' }} />
          </button>
        </div>
      </div>
      {aberto && (
        <nav className="vidro mx-3 mb-3 grid gap-1 rounded-3xl p-4 lg:hidden" style={{ background: 'rgba(13,15,20,.96)' }}>
          {MENU.map(([h, t]) => (
            <a key={h} href={h} onClick={() => setAberto(false)} className="display rounded-2xl px-4 py-3 text-2xl" style={{ color: atual === h ? 'var(--acento)' : '#fff' }}>{t}</a>
          ))}
          <BotaoWhats origem="menu" className="btn btn-zap mt-2">Chamar no WhatsApp</BotaoWhats>
        </nav>
      )}
    </header>
  )
}

/* ---------- botão de WhatsApp (cria o lead no CRM e abre a conversa) ---------- */
export function BotaoWhats({ origem, texto, className, children }: { origem: string; texto?: string; className?: string; children: React.ReactNode }) {
  const [ref] = useState(gerarRef)
  const [pedir, setPedir] = useState(false)
  function ir(nome: string, tel: string) {
    setPedir(false)
    rastrear('whats', 'Site MLA Containers')
    enviarLead(ref, origem, { nome, telefone: tel })
    const base = texto ?? `Olá! Vim pelo site da MLA Containers (${origem}) e quero informações.`
    const msg = `${base.replace(/^Olá!/, `Olá! Sou ${nome}.`)} (ref. ${ref})`
    const w = window.open(urlWhats(WHATS, msg), '_blank'); if (!w) window.location.assign(urlWhats(WHATS, msg))
  }
  function clicar() {
    const g = contatoSalvo()
    if (g) ir(g.nome, g.tel); else setPedir(true)
  }
  return (
    <>
      <button type="button" onClick={clicar} className={className}>{children}</button>
      {pedir && <ModalContato onConfirmar={ir} onFechar={() => setPedir(false)} />}
    </>
  )
}

/* ---------- botão flutuante + barra no celular ---------- */
export function WhatsFlutuante() {
  const [ver, setVer] = useState(false)
  useEffect(() => { const f = () => setVer(window.scrollY > 500); f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f) }, [])
  return (
    <div className={`fixed bottom-5 right-5 z-50 transition-all duration-500 ${ver ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}>
      <BotaoWhats origem="flutuante" className="btn btn-zap pulso !rounded-full !px-6 !py-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.8 14.2c-.2.7-1.4 1.3-1.9 1.3-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-5-4.4-5.1-4.6-.1-.2-1.2-1.6-1.2-3s.8-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.2c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.7 1.2 1.5 1.9 1 .9 1.9 1.2 2.2 1.3.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 .9c.3.1.5.2.5.3.1.1.1.7-.1 1.4Z"/></svg>
        <span className="hidden sm:inline">Falar no WhatsApp</span>
      </BotaoWhats>
    </div>
  )
}

/* ---------- formulário de captação (nome + WhatsApp, salva mesmo se abandonar) ---------- */
export function Captar({ pagina, titulo, subtitulo, assunto, botao = 'Quero receber agora' }: { pagina: string; titulo: string; subtitulo: string; assunto: string; botao?: string }) {
  const [ref] = useState(gerarRef)
  const [nome, setNome] = useState(''); const [tel, setTel] = useState('')
  const [enviado, setEnviado] = useState(false); const [erro, setErro] = useState(''); const [salvo, setSalvo] = useState('')

  useEffect(() => {
    if (enviado) return
    const d = soDigitos(tel); if (d.length < 10) return
    const chave = `${nome.trim()}|${d}`; if (chave === salvo) return
    const t = setTimeout(() => { enviarLead(ref, pagina, { nome: nome.trim(), telefone: d }); setSalvo(chave) }, 1200)
    return () => clearTimeout(t)
  }, [nome, tel, enviado, salvo, ref, pagina])

  function abrir() {
    const msg = `Olá! Sou ${nome.trim() || 'interessado'} e vim pelo site da MLA Containers. Quero ${assunto}. (ref. ${ref})`
    window.location.assign(urlWhats(WHATS, msg))
  }
  function enviar(e: React.FormEvent) {
    e.preventDefault()
    const d = soDigitos(tel)
    if (nome.trim().length < 2) { setErro('Digite o seu nome.'); return }
    if (d.length < 10 || d.length > 11) { setErro('Digite o telefone com DDD, ex.: (47) 99999-9999.'); return }
    setErro(''); rastrear('form', 'Site MLA Containers'); setEnviado(true)
    const p = enviarLead(ref, pagina, { nome: nome.trim(), telefone: d, final: true })
    Promise.race([p, new Promise(r => setTimeout(r, 2500))]).then(() => setTimeout(abrir, 300))
  }

  if (enviado) return (
    <div className="cartao p-7 text-center" style={{ borderColor: 'var(--acento)' }}>
      <p className="text-4xl">✅</p>
      <h3 className="display mt-2 text-3xl">Recebemos, {nome.trim().split(' ')[0] || 'tudo certo'}!</h3>
      <p className="mt-2 text-white/70">Abrindo o WhatsApp para você falar direto com a gente. Se não abrir, toque abaixo.</p>
      <button onClick={abrir} className="btn btn-zap mt-4 w-full">Abrir o WhatsApp</button>
    </div>
  )
  const campo = 'mt-1 w-full rounded-xl border-0 bg-white px-4 py-3.5 text-base text-slate-900 outline-none focus:ring-2 focus:ring-[var(--acento)]'
  return (
    <form onSubmit={enviar} noValidate className="vidro rounded-3xl p-6" id="contato-form" style={{ boxShadow: '0 30px 80px -20px rgba(0,0,0,.6)' }}>
      <p className="tag">Resposta pelo WhatsApp</p>
      <h3 className="display mt-1 text-3xl">{titulo}</h3>
      <p className="mt-1 text-sm text-white/65">{subtitulo}</p>
      <label className="mt-4 block text-sm font-semibold text-white/80">Seu nome
        <input value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" placeholder="Como podemos te chamar?" className={campo} /></label>
      <label className="mt-3 block text-sm font-semibold text-white/80">Seu WhatsApp
        <input value={tel} onChange={e => setTel(mascara(e.target.value))} inputMode="tel" autoComplete="tel-national" placeholder="(47) 99999-9999" className={campo} /></label>
      <input type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" onChange={() => {}} />
      {erro && <p className="mt-2 text-sm font-semibold text-red-400">{erro}</p>}
      <button type="submit" className="btn btn-laranja mt-4 w-full">{botao}</button>
      <p className="mt-3 text-center text-xs leading-snug text-white/45">Ao preencher, você autoriza a MLA Containers a falar com você por telefone ou WhatsApp. Usamos seus dados só para este atendimento.</p>
    </form>
  )
}

/* ---------- escolha o uso: seletor interativo que vira mensagem pronta no WhatsApp ---------- */
const USOS_IMG: { id: string; nome: string; emoji: string; titulo: string; texto: string; ideias: string[] }[] = [
  { id: 'obra', nome: 'Obra', emoji: '🏗️', titulo: 'Canteiro de obras organizado', texto: 'Almoxarifado, escritório e depósito de ferramentas que ficam no terreno, trancados e protegidos da chuva e de furtos.', ideias: ['Almoxarifado', 'Escritório de obra', 'Depósito de ferramentas'] },
  { id: 'loja', nome: 'Loja', emoji: '🏪', titulo: 'Seu ponto de venda, pronto rápido', texto: 'Um espaço com identidade própria para loja, quiosque, lanchonete ou showroom, instalado em muito menos tempo que uma construção.', ideias: ['Loja e quiosque', 'Lanchonete', 'Showroom'] },
  { id: 'casa', nome: 'Casa', emoji: '🏠', titulo: 'Casa container moderna', texto: 'Estrutura de aço resistente para moradia, escritório ou espaço gourmet, com projeto sob medida e custo enxuto.', ideias: ['Moradia', 'Home office', 'Espaço gourmet'] },
  { id: 'deposito', nome: 'Depósito', emoji: '📦', titulo: 'Armazenagem segura', texto: 'Estoque, móveis e equipamentos guardados em aço, com porta com trava e proteção contra o tempo.', ideias: ['Estoque da loja', 'Guarda-móveis', 'Equipamentos'] },
  { id: 'sitio', nome: 'Sítio', emoji: '🌾', titulo: 'Paiol e galpão no campo', texto: 'Insumos, ferramentas e implementos protegidos, com uma estrutura que aguenta sol, chuva e o uso pesado do dia a dia.', ideias: ['Paiol', 'Galpão', 'Insumos'] },
  { id: 'atelie', nome: 'Ateliê', emoji: '🎨', titulo: 'Espaço próprio para criar', texto: 'Ateliê, estúdio ou oficina pequena com a medida certa do seu projeto e a personalidade do container.', ideias: ['Ateliê', 'Estúdio', 'Oficina'] },
]

export function EscolhaUso() {
  const [i, setI] = useState(0)
  const u = USOS_IMG[i]
  const imgs = USOS_IMG.map(x => `/containers/usos/${x.id}.jpg`)   // imagens ilustrativas dos usos (as mesmas do Reel)
  const msg = `Olá! Vim pelo site da MLA Containers e quero um container para ${u.nome.toLowerCase()} (${u.titulo.toLowerCase()}). Podem me passar o preço e as fotos?`
  return (
    <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-2 lg:content-start">
        {USOS_IMG.map((x, k) => (
          <button key={x.id} onClick={() => setI(k)} className="cartao px-3 py-4 text-center transition hover:-translate-y-1" style={k === i ? { borderColor: 'var(--acento)', background: 'rgba(255,159,26,.12)', boxShadow: '0 12px 40px -12px rgba(255,159,26,.5)' } : undefined}>
            <span className="block text-3xl">{x.emoji}</span><span className="display mt-1 block text-lg">{x.nome}</span>
          </button>
        ))}
      </div>
      <div className="cartao overflow-hidden sm:grid sm:grid-cols-[.85fr_1.15fr]" key={u.id}>
        <div className="relative aspect-[4/5] max-h-[34rem] w-full sm:aspect-auto sm:min-h-[30rem]">
          <Image src={imgs[i]} alt={u.titulo} fill quality={90} sizes="(max-width:640px) 100vw, 28vw" className="palavra object-cover object-center" />
          <span className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white/90">Imagem ilustrativa</span>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(13,15,20,.85))' }} />
        </div>
        <div className="flex flex-col justify-center p-5 sm:p-8">
          <h3 className="display text-4xl sm:text-5xl">{u.titulo}</h3>
          <p className="mt-3 text-white/75">{u.texto}</p>
          <div className="mt-4 flex flex-wrap gap-2">{u.ideias.map(t => <span key={t} className="rounded-full border border-white/15 px-3 py-1 text-sm text-white/80">{t}</span>)}</div>
          <BotaoWhats origem={`uso-${u.id}`} texto={msg} className="btn btn-laranja mt-5 w-full sm:w-auto">Quero um para {u.nome.toLowerCase()}</BotaoWhats>
        </div>
      </div>
    </div>
  )
}

/* ---------- rodapé ---------- */
export function Rodape() {
  return (
    <footer className="mt-10 border-t border-white/10" style={{ background: 'var(--bg2)' }}>
      <div className="fita h-2" />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Image src="/containers/mla-logo.png" alt="MLA Containers" width={240} height={87} unoptimized style={{ height: 78, width: 'auto' }} />
          <p className="mt-4 max-w-sm text-sm text-white/60">Venda e locação de containers 20 pés, 40 HC e Dry, com transparência e tranquilidade para a sua operação. Itajaí/SC, em localização estratégica.</p>
        </div>
        <div>
          <p className="tag">Navegue</p>
          <ul className="mt-3 space-y-2 text-white/75">{MENU.map(([h, t]) => <li key={h}><a href={h} className="transition hover:text-[var(--acento)]">{t}</a></li>)}</ul>
        </div>
        <div>
          <p className="tag">Onde estamos</p>
          <p className="mt-3 text-white/75">{ENDERECO_LINHA1}<br />{ENDERECO_LINHA2}</p>
          <p className="mt-3 text-white/75">WhatsApp <strong className="text-white">{WHATS_EXIBIDO}</strong></p>
          <p className="mt-1 text-sm text-white/50">Atendimento com visita agendada.</p>
        </div>
      </div>
      <p className="border-t border-white/10 px-5 py-5 text-center text-xs text-white/40">© {new Date().getFullYear()} MLA Containers · Itajaí/SC · Valores conforme tipo e ano do container; frete sob consulta.</p>
    </footer>
  )
}

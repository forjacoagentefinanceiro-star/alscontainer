import Image from 'next/image'
import { ENDERECO_LINHA1, ENDERECO_LINHA2, MAPA_EMBED, MAPA_LINK } from '@/lib/site/dados'
import { BotaoWhats, Captar, Cabecalho, Rev } from './Interativos'

export const PRECO = 'a partir de R$ 8.500,00'

export function Titulo({ tag, children, sub, centro = false }: { tag: string; children: React.ReactNode; sub?: string; centro?: boolean }) {
  return (
    <Rev className={centro ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <p className="tag">{tag}</p>
      <h2 className="display mt-2 text-5xl sm:text-6xl lg:text-7xl">{children}</h2>
      {sub && <p className="mt-4 text-lg text-white/70">{sub}</p>}
    </Rev>
  )
}

/** Cabeçalho de página interna: foto de fundo escurecida + título grande */
export function TopoInterno({ atual, tag, titulo, sub, foto = '/containers/lateral-aberta.jpg' }: { atual: string; tag: string; titulo: React.ReactNode; sub: string; foto?: string }) {
  return (
    <>
      <Cabecalho atual={atual} />
      <section className="relative isolate overflow-hidden pt-36 pb-20 sm:pt-44 sm:pb-28">
        <div className="absolute inset-0 -z-10">
          <Image src={foto} alt="" fill priority quality={90} sizes="100vw" className="kenburns object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(13,15,20,.95), rgba(13,15,20,.65) 55%, rgba(13,15,20,.35))' }} />
          <div className="absolute inset-x-0 bottom-0 h-40" style={{ background: 'linear-gradient(180deg, transparent, var(--bg))' }} />
          <div className="grao" />
        </div>
        <div className="mx-auto max-w-7xl px-5">
          <Rev><p className="tag">{tag}</p></Rev>
          <Rev d={0.1}><h1 className="display mt-3 max-w-4xl text-6xl sm:text-7xl lg:text-8xl">{titulo}</h1></Rev>
          <Rev d={0.2}><p className="mt-5 max-w-2xl text-lg text-white/80 sm:text-xl">{sub}</p></Rev>
        </div>
      </section>
    </>
  )
}

export function ComoFunciona({ itens }: { itens: [string, string][] }) {
  return (
    <div className="relative mx-auto max-w-3xl pl-10 sm:pl-14">
      <div className="linha-tempo absolute bottom-2 left-[15px] top-2 w-[3px] rounded sm:left-[21px]" />
      {itens.map(([t, s], i) => (
        <Rev key={t} d={i * 0.08} className="relative pb-10 last:pb-0">
          <span className="display absolute -left-10 top-0 grid h-8 w-8 place-items-center rounded-full text-lg text-[#14110c] sm:-left-14 sm:h-11 sm:w-11 sm:text-2xl" style={{ background: 'linear-gradient(135deg,#ffb73d,#ff8a00)', boxShadow: '0 0 0 6px rgba(255,159,26,.15)' }}>{i + 1}</span>
          <h3 className="display text-3xl sm:text-4xl">{t}</h3>
          <p className="mt-2 text-white/70">{s}</p>
        </Rev>
      ))}
    </div>
  )
}

export function Faq({ itens }: { itens: [string, string][] }) {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {itens.map(([q, a], i) => (
        <Rev key={q} d={i * 0.05}>
          <details className="cartao group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">{q}<span className="mais text-2xl" style={{ color: 'var(--acento)' }}>＋</span></summary>
            <p className="mt-3 text-white/70">{a}</p>
          </details>
        </Rev>
      ))}
    </div>
  )
}

export function Mapa() {
  return (
    <Rev zoom>
      <div className="cartao overflow-hidden">
        <iframe title="Localização da MLA Containers em Itajaí/SC" src={MAPA_EMBED} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-72 w-full border-0 sm:h-96" style={{ filter: 'grayscale(.35) contrast(1.05) brightness(.9)' }} />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-white/80"><strong className="text-white">{ENDERECO_LINHA1}</strong><br />{ENDERECO_LINHA2}</p>
          <a href={MAPA_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-borda !py-3">Abrir no Google Maps</a>
        </div>
      </div>
    </Rev>
  )
}

export function CtaFinal({ pagina, assunto, titulo = 'Vamos conversar?' }: { pagina: string; assunto: string; titulo?: string }) {
  return (
    <section className="relative isolate overflow-hidden px-5 py-24">
      <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse at 20% 0%, rgba(255,159,26,.22), transparent 60%), radial-gradient(ellipse at 90% 100%, rgba(255,106,0,.16), transparent 55%)' }} />
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
        <Rev tipo="esq">
          <p className="tag">Fale com a MLA</p>
          <h2 className="display mt-2 text-6xl sm:text-7xl"><span className="aco-texto">{titulo}</span></h2>
          <p className="mt-5 max-w-lg text-lg text-white/75">Deixe seu nome e WhatsApp. Respondemos com valores e fotos, e combinamos a visita ao pátio em Itajaí/SC.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <BotaoWhats origem={`${pagina}-cta`} className="btn btn-zap">Chamar no WhatsApp</BotaoWhats>
            <a href="/contato" className="btn btn-borda">Ver endereço</a>
          </div>
        </Rev>
        <Rev tipo="dir"><Captar pagina={pagina} titulo="Receba valores e fotos" subtitulo="Resposta direto no seu WhatsApp." assunto={assunto} /></Rev>
      </div>
    </section>
  )
}

export const FAQ_GERAL: [string, string][] = [
  ['Posso ver o container antes de comprar?', 'Sim. As visitas são agendadas: chame no WhatsApp e combinamos o dia e o horário no pátio, em Itajaí/SC.'],
  ['Quais são as medidas?', "Container de 40 pés High Cube: cerca de 12,19 m de comprimento, 2,44 m de largura e 2,90 m de altura (medidas externas padrão)."],
  ['Vocês entregam?', 'A retirada é no pátio, em Itajaí/SC. Para entrega, cotamos o frete para a sua cidade.'],
  ['Quanto custa?', `Os containers saem ${PRECO}, conforme o tipo e o ano. Peça pelo WhatsApp e enviamos o valor da unidade e as fotos.`],
  ['Como é o pagamento?', 'As condições são combinadas no atendimento, direto pelo WhatsApp.'],
  ['Vocês também alugam containers?', 'Sim. A MLA trabalha com venda e locação. Fale com a gente para saber disponibilidade e condições.'],
]

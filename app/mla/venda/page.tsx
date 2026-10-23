import type { Metadata } from 'next'
import Image from 'next/image'
import { BotaoWhats, Rev } from '@/components/site/Interativos'
import { Faixa } from '@/components/site/Pecas'
import Planta from '@/components/site/Planta'
import { CtaFinal, Faq, FAQ_GERAL, PRECO, PRECO20, PRECO40, Titulo, TopoInterno } from '@/components/site/Secoes'

export const metadata: Metadata = {
  title: 'Containers 20 pés, 40 HC e Dry usados à venda em Itajaí/SC',
  description: `Containers marítimos 20 pés, 40 HC e Dry usados, em ótimo estado: ${PRECO}. Fotos reais, visita agendada no pátio em Itajaí/SC e atendimento pelo WhatsApp.`,
}

export default function Venda() {
  return (
    <>
      <TopoInterno atual="/venda" tag="Pronta entrega · Itajaí/SC" titulo={<><span className="aco-texto">Containers</span><br /><span className="laranja-texto">à venda</span></>} sub={`Containers de 20 pés, 40 HC e Dry, usados e em ótimo estado. Containers ${PRECO}, conforme o tipo, o tamanho e o ano.`} foto="/containers/lateral.jpg" />
      <Faixa itens={['20 PÉS', '40 HC', 'DRY', 'ÓTIMO ESTADO', 'FOTOS REAIS', 'VISITA AGENDADA', 'PRONTA ENTREGA']} />

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-24 lg:grid-cols-2">
        <Rev tipo="esq">
          <p className="tag">O que você leva</p>
          <h2 className="display mt-2 text-5xl sm:text-6xl">Container pronto <span className="laranja-texto">pra usar</span></h2>
          <ul className="mt-6 space-y-3 text-lg text-white/85">
            {['Interior limpo e amplo', 'Opções de 20 pés, 40 HC e 40 Dry', 'Estrutura em aço, resistente ao tempo', 'Porta com fechamento seguro', 'Visita agendada: você confere pessoalmente antes de decidir'].map(t => (
              <li key={t} className="flex gap-3"><span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm font-black text-[#14110c]" style={{ background: 'var(--acento)' }}>✓</span>{t}</li>
            ))}
          </ul>
          <div className="mt-8 inline-block rounded-3xl p-6" style={{ background: 'linear-gradient(135deg,#ffb73d,#ff8a00)', color: '#14110c' }}>
            <p className="tag !text-[#14110c]/70">Valores</p>
            <p className="display text-4xl sm:text-5xl">20 pés {PRECO20}</p>
            <p className="display text-4xl sm:text-5xl">40 HC {PRECO40}</p>
            <p className="display text-3xl sm:text-4xl">40 Dry: consulte o valor</p>
            <p className="mt-1 text-sm font-semibold">Conforme o tipo e o ano · frete sob consulta</p>
          </div>
          <div className="mt-6"><BotaoWhats origem="venda" texto="Olá! Vim pelo site da MLA Containers e quero o preço e as fotos de um container à venda." className="btn btn-zap">Pedir preço no WhatsApp</BotaoWhats></div>
        </Rev>
        <Rev tipo="dir" zoom>
          <div className="foto aspect-[4/5]"><Image src="/containers/interior-porta.jpg" alt="Interior do container visto da porta" fill quality={90} sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" /></div>
        </Rev>
      </section>

      <section className="py-20" style={{ background: 'var(--bg2)' }}>
        <div className="mx-auto max-w-7xl px-5">
          <Titulo tag="Veja por fora e por dentro">Galeria <span className="laranja-texto">real</span></Titulo>
          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
            {['lateral', 'lateral-aberta', 'traseira', 'interior-1', 'interior-porta'].map((f, i) => (
              <Rev key={f} d={i * 0.06} zoom className={i === 0 ? 'col-span-2' : ''}>
                <div className="foto" style={{ aspectRatio: i === 0 ? '16/9' : '4/5' }}><Image src={`/containers/${f}.jpg`} alt="Container 40 pés HC usado" fill quality={90} sizes="(max-width:768px) 50vw, 33vw" className="object-cover" /></div>
              </Rev>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24">
        <Titulo tag="Compare as medidas" sub="Os três tipos na mesma escala: 20 pés (azul), 40 Dry (verde) e 40 HC (laranja). Toque nas legendas para mostrar ou ocultar.">Planta <span className="laranja-texto">técnica</span></Titulo>
        <Rev className="cartao mt-10 p-3 sm:p-8"><Planta /></Rev>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24"><Titulo centro tag="Dúvidas">Perguntas <span className="laranja-texto">frequentes</span></Titulo><div className="mt-12"><Faq itens={FAQ_GERAL} /></div></section>
      <CtaFinal pagina="venda" assunto="o preço e as fotos de um container à venda" titulo="Garanta o seu" />
    </>
  )
}

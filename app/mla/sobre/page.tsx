import type { Metadata } from 'next'
import Image from 'next/image'
import { Rev } from '@/components/site/Interativos'
import { Faixa } from '@/components/site/Pecas'
import { CtaFinal, Titulo, TopoInterno } from '@/components/site/Secoes'

export const metadata: Metadata = {
  title: 'Sobre a MLA Containers',
  description: 'A MLA Containers vende e aluga containers em Itajaí/SC, com fotos reais, visita agendada no pátio e atendimento direto.',
}

export default function Sobre() {
  const valores: [string, string][] = [
    ['Transparência', 'Fotos reais da unidade e valores claros, sem surpresa na hora da visita.'],
    ['Tranquilidade', 'Processo simples e atendimento direto: você sabe cada passo e confere pessoalmente antes de decidir.'],
    ['Localização estratégica', 'Sediados em Itajaí/SC, num ponto estratégico para facilitar a retirada e a logística da sua operação.'],
  ]
  return (
    <>
      <TopoInterno atual="/sobre" tag="Quem somos" titulo={<><span className="aco-texto">MLA</span><br /><span className="laranja-texto">Containers</span></>} sub="Uma empresa criada para trazer um diferencial ao mercado: transparência e tranquilidade na operação dos nossos clientes." foto="/containers/lateral.jpg" />
      <Faixa itens={['VENDA', 'LOCAÇÃO', 'ITAJAÍ/SC', 'ATENDIMENTO DIRETO']} />
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-24 lg:grid-cols-2">
        <Rev tipo="esq">
          <p className="tag">Nosso propósito</p>
          <h2 className="display mt-2 text-5xl sm:text-6xl">Um diferencial <span className="laranja-texto">para o mercado</span></h2>
          <p className="mt-5 text-lg text-white/75">A MLA Containers foi criada para trazer um diferencial ao mercado de containers: <strong className="text-white">transparência e tranquilidade</strong> na operação dos nossos clientes, do primeiro contato à retirada.</p>
          <p className="mt-4 text-lg text-white/75">Trabalhamos com containers marítimos de 20 e 40 pés, usados e em ótimo estado, para venda e locação. Você vê as fotos reais, agenda a visita no nosso pátio e escolhe a unidade com calma.</p>
          <p className="mt-4 text-lg text-white/75">Estamos em Itajaí/SC, em uma localização estratégica para a logística da sua operação.</p>
        </Rev>
        <Rev tipo="dir" zoom><div className="foto aspect-[4/3]"><Image src="/containers/lateral-aberta.jpg" alt="Pátio da MLA Containers em Itajaí/SC" fill quality={90} sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" /></div></Rev>
      </section>
      <section className="py-24" style={{ background: 'var(--bg2)' }}>
        <div className="mx-auto max-w-7xl px-5">
          <Titulo tag="No que acreditamos">O que <span className="laranja-texto">nos guia</span></Titulo>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {valores.map(([t, s], i) => <Rev key={t} d={i * 0.1} zoom><div className="cartao h-full p-7"><p className="display text-4xl"><span className="laranja-texto">{t}</span></p><p className="mt-3 text-white/70">{s}</p></div></Rev>)}
          </div>
        </div>
      </section>
      <CtaFinal pagina="sobre" assunto="conhecer a MLA Containers e agendar uma visita" />
    </>
  )
}

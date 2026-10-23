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
    ['Atendimento direto', 'Você fala com a nossa equipe pelo WhatsApp, sem formulário que some.'],
    ['Confiança', 'Visita agendada no pátio: você confere pessoalmente antes de decidir.'],
  ]
  return (
    <>
      <TopoInterno atual="/sobre" tag="Quem somos" titulo={<><span className="aco-texto">MLA</span><br /><span className="laranja-texto">Containers</span></>} sub="Venda e locação de containers em Itajaí/SC, com atendimento próximo e o container à vista para você conferir." foto="/containers/lateral.jpg" />
      <Faixa itens={['VENDA', 'LOCAÇÃO', 'ITAJAÍ/SC', 'ATENDIMENTO DIRETO']} />
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-24 lg:grid-cols-2">
        <Rev tipo="esq">
          <p className="tag">Nossa proposta</p>
          <h2 className="display mt-2 text-5xl sm:text-6xl">Container bom <span className="laranja-texto">se vê de perto</span></h2>
          <p className="mt-5 text-lg text-white/75">A MLA Containers nasceu para facilitar a vida de quem precisa de espaço: obra, loja, depósito, ateliê ou até uma casa container. Trabalhamos com containers marítimos de 20 e 40 pés, usados e em ótimo estado, para venda e locação.</p>
          <p className="mt-4 text-lg text-white/75">Você vê as fotos reais, agenda a visita no nosso pátio, em Itajaí/SC, e escolhe a unidade com calma.</p>
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

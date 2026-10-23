import type { Metadata } from 'next'
import { BotaoWhats, Rev } from '@/components/site/Interativos'
import { Faixa } from '@/components/site/Pecas'
import { ComoFunciona, CtaFinal, Faq, Titulo, TopoInterno } from '@/components/site/Secoes'

export const metadata: Metadata = {
  title: 'Locação de containers em Itajaí/SC',
  description: 'Aluguel de containers em Itajaí/SC para obra, estoque, evento e uso temporário. Consulte disponibilidade e condições com a MLA Containers.',
}

export default function Locacao() {
  const casos: [string, string, string][] = [
    ['🏗️', 'Obras e canteiros', 'Almoxarifado e escritório no terreno durante a obra.'],
    ['📦', 'Estoque temporário', 'Espaço extra para períodos de maior movimento.'],
    ['🎪', 'Eventos e feiras', 'Apoio, depósito e estrutura para o evento.'],
    ['🏪', 'Ponto de venda', 'Teste um ponto comercial antes de investir em definitivo.'],
  ]
  return (
    <>
      <TopoInterno atual="/locacao" tag="Venda e locação" titulo={<><span className="aco-texto">Locação de</span><br /><span className="laranja-texto">containers</span></>} sub="Precisa do container por um período? Consulte disponibilidade e condições com a nossa equipe." foto="/containers/lateral-aberta.jpg" />
      <Faixa itens={['LOCAÇÃO', 'OBRAS', 'ESTOQUE', 'EVENTOS', 'ITAJAÍ/SC']} />

      <section className="mx-auto max-w-7xl px-5 py-24">
        <Titulo tag="Para quem é" sub="Se você precisa de espaço seguro por um tempo, a locação é a saída mais prática.">Alugue <span className="laranja-texto">sem imobilizar</span></Titulo>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {casos.map(([i, t, s], k) => (
            <Rev key={t} d={k * 0.08} zoom><div className="cartao h-full p-6"><p className="text-4xl">{i}</p><p className="display mt-3 text-3xl">{t}</p><p className="mt-2 text-sm text-white/65">{s}</p></div></Rev>
          ))}
        </div>
        <Rev className="mt-8"><BotaoWhats origem="locacao" texto="Olá! Vim pelo site da MLA Containers e quero informações sobre locação de containers." className="btn btn-zap">Consultar disponibilidade</BotaoWhats></Rev>
      </section>

      <section className="py-24" style={{ background: 'var(--bg2)' }}>
        <div className="mx-auto max-w-7xl px-5">
          <Titulo centro tag="Passo a passo">Como alugar</Titulo>
          <div className="mt-14"><ComoFunciona itens={[['Conte o que você precisa', 'Para que vai usar, por quanto tempo e em qual cidade. Assim indicamos a melhor opção.'], ['Receba as condições', 'Informamos disponibilidade, prazo e valores pelo WhatsApp, sem compromisso.'], ['Combine a entrega', 'Fechamos o contrato e combinamos o transporte até o seu endereço.']]} /></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24"><Titulo centro tag="Dúvidas">Locação: <span className="laranja-texto">perguntas</span></Titulo>
        <div className="mt-12"><Faq itens={[['Qual o prazo mínimo?', 'Os prazos e valores dependem do tipo de container e do período. Informamos tudo no atendimento, pelo WhatsApp.'], ['Vocês entregam no meu endereço?', 'Cotamos o transporte para a sua cidade. Conte onde o container vai ficar.'], ['Posso comprar depois de alugar?', 'Podemos conversar sobre isso. Fale com a nossa equipe.']]} /></div>
      </section>
      <CtaFinal pagina="locacao" assunto="informações sobre locação de containers" titulo="Vamos alugar?" />
    </>
  )
}

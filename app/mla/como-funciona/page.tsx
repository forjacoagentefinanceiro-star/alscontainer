import type { Metadata } from 'next'
import { Faixa } from '@/components/site/Pecas'
import { ComoFunciona, CtaFinal, Faq, FAQ_GERAL, Titulo, TopoInterno } from '@/components/site/Secoes'

export const metadata: Metadata = {
  title: 'Como comprar ou alugar um container',
  description: 'Veja o passo a passo para comprar ou alugar um container na MLA Containers, em Itajaí/SC: contato, visita ao pátio e retirada ou entrega.',
}

export default function Como() {
  return (
    <>
      <TopoInterno atual="/como-funciona" tag="Simples e sem enrolação" titulo={<><span className="aco-texto">Como</span><br /><span className="laranja-texto">funciona</span></>} sub="Do primeiro contato à retirada do container, em passos claros." foto="/containers/traseira.jpg" />
      <Faixa itens={['FALE COM A GENTE', 'VEJA NO PÁTIO', 'FECHE E RETIRE']} />
      <section className="mx-auto max-w-7xl px-5 py-24">
        <Titulo centro tag="Para comprar">Passo a passo da <span className="laranja-texto">compra</span></Titulo>
        <div className="mt-14"><ComoFunciona itens={[['Fale com a gente', 'Chame no WhatsApp ou deixe nome e telefone. Respondemos com o valor e enviamos fotos e vídeos reais da unidade que você vai negociar.'], ['Agende a visita', 'Escolha o dia e o horário. Você vem ao pátio, em Itajaí/SC, e confere o container por fora e por dentro.'], ['Escolha o seu', 'Cada unidade é única. Veja pessoalmente e decida com tranquilidade.'], ['Feche e retire', 'Combinamos o pagamento e a retirada no pátio, ou cotamos o frete para a sua cidade.']]} /></div>
      </section>
      <section className="py-24" style={{ background: 'var(--bg2)' }}><div className="mx-auto max-w-7xl px-5"><Titulo centro tag="Dúvidas">Perguntas <span className="laranja-texto">frequentes</span></Titulo><div className="mt-12"><Faq itens={FAQ_GERAL} /></div></div></section>
      <CtaFinal pagina="como-funciona" assunto="informações sobre como comprar ou alugar um container" />
    </>
  )
}

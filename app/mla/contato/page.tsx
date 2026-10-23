import type { Metadata } from 'next'
import { BotaoWhats, Captar, Rev } from '@/components/site/Interativos'
import { Mapa, TopoInterno } from '@/components/site/Secoes'
import { ENDERECO_LINHA1, ENDERECO_LINHA2, WHATS_EXIBIDO } from '@/lib/site/dados'

export const metadata: Metadata = {
  title: 'Contato e localização',
  description: 'Fale com a MLA Containers pelo WhatsApp e veja como chegar ao pátio em Itajaí/SC: Av. Gov. Adolfo Konder, 2600, São Vicente.',
}

export default function Contato() {
  return (
    <>
      <TopoInterno atual="/contato" tag="Fale com a gente" titulo={<><span className="aco-texto">Contato e</span><br /><span className="laranja-texto">localização</span></>} sub="Chame no WhatsApp ou deixe seu telefone. A visita ao pátio é agendada." foto="/containers/traseira.jpg" />
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Rev tipo="esq"><div className="cartao p-7"><p className="tag">WhatsApp</p><p className="display mt-1 text-5xl">{WHATS_EXIBIDO}</p><BotaoWhats origem="contato" className="btn btn-zap mt-4">Chamar agora</BotaoWhats></div></Rev>
          <Rev tipo="esq" d={0.1}><div className="cartao p-7"><p className="tag">Endereço do pátio</p><p className="mt-2 text-xl font-semibold">{ENDERECO_LINHA1}</p><p className="text-white/70">{ENDERECO_LINHA2}</p><p className="mt-3 text-sm text-white/55">Atendimento com visita agendada: avise antes pelo WhatsApp.</p></div></Rev>
          <Rev tipo="esq" d={0.2}><Captar pagina="contato" titulo="Prefere que a gente chame você?" subtitulo="Deixe nome e WhatsApp e retornamos." assunto="falar com a equipe da MLA Containers" botao="Quero ser chamado" /></Rev>
        </div>
        <Mapa />
      </section>
    </>
  )
}

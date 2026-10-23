import Image from 'next/image'
import { Cabecalho, EscolhaUso, BotaoWhats, Palavras, Rev } from '@/components/site/Interativos'
import { Faixa } from '@/components/site/Pecas'
import Planta from '@/components/site/Planta'
import { ComoFunciona, CtaFinal, Faq, FAQ_GERAL, Mapa, PRECO, PRECO20, PRECO40, PRECODRY, Titulo } from '@/components/site/Secoes'

export default function Inicio() {
  const numeros: [string, string, string][] = [
    ['20 e 40', 'pés', 'HC e Dry'],
    ['2,90', 'm', 'de altura no 40 HC'],
    ['≈ 28', 'm²', 'úteis no 40 pés*'],
    ['Itajaí', '/SC', 'pronta entrega'],
  ]
  return (
    <>
      <Cabecalho atual="/" />

      {/* HERO */}
      <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24">
        <div className="absolute inset-0 -z-10">
          <Image src="/containers/lateral.jpg" alt="" fill priority quality={90} sizes="100vw" className="kenburns object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(95deg, rgba(13,15,20,.96) 0%, rgba(13,15,20,.78) 38%, rgba(13,15,20,.25) 100%)' }} />
          <div className="absolute inset-x-0 bottom-0 h-56" style={{ background: 'linear-gradient(180deg, transparent, var(--bg))' }} />
          <div className="grao" />
        </div>
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 pb-24 lg:grid-cols-[1.25fr_.75fr] lg:items-center">
          <div>
            <Rev><span className="tag inline-flex items-center gap-3 rounded-full border border-[var(--acento)]/40 bg-black/30 px-4 py-2"><i className="h-2 w-2 animate-pulse rounded-full bg-[var(--acento)]" />Venda e locação · Itajaí/SC</span></Rev>
            <Rev d={0.1}>
              <h1 className="display mt-6 text-[3.6rem] leading-[.9] sm:text-8xl lg:text-[6.4rem] xl:text-[7.6rem]">
                <span className="aco-texto">O container</span><br />
                <span className="aco-texto">certo pra sua</span><br />
                <Palavras lista={['obra', 'loja', 'casa', 'empresa', 'ideia', 'oficina']} />
              </h1>
            </Rev>
            <Rev d={0.2}><p className="mt-7 max-w-xl text-lg text-white/80 sm:text-xl">Containers marítimos de 20 pés e 40 HC, e também Dry: usados e em ótimo estado. <strong className="text-white">Fotos reais, visita agendada no pátio</strong> e atendimento direto no WhatsApp.</p></Rev>
            <Rev d={0.3}>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/venda" className="btn btn-laranja">Ver containers à venda</a>
                <BotaoWhats origem="hero" className="btn btn-zap">Falar no WhatsApp</BotaoWhats>
              </div>
              <p className="mt-4 text-sm text-white/55">Containers {PRECO} · conforme tipo e ano · frete sob consulta</p>
            </Rev>
          </div>
          <div className="hidden lg:block">
            <div className="relative h-[28rem]">
              <div className="vidro flutua absolute right-0 top-0 w-64 rounded-3xl p-5"><p className="tag">Pronta entrega</p><p className="display mt-1 text-4xl">20 · 40 HC · Dry</p><p className="mt-1 text-sm text-white/65">O tipo certo para o seu projeto.</p></div>
              <div className="vidro flutua b absolute left-0 top-40 w-64 rounded-3xl p-5"><p className="tag">Sem surpresa</p><p className="display mt-1 text-4xl">Fotos reais</p><p className="mt-1 text-sm text-white/65">Imagens do nosso pátio.</p></div>
              <div className="vidro flutua absolute bottom-0 right-6 w-64 rounded-3xl p-5"><p className="tag">Confira pessoalmente</p><p className="display mt-1 text-4xl">Visita agendada</p><p className="mt-1 text-sm text-white/65">Venha ao pátio e escolha.</p></div>
            </div>
          </div>
        </div>
        <a href="#numeros" aria-label="Rolar" className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 sm:block"><span className="flutua block h-12 w-7 rounded-full border-2 border-white/40 p-1.5"><i className="block h-2 w-1.5 rounded bg-[var(--acento)] mx-auto" /></span></a>
      </section>

      <Faixa itens={['VENDA', 'LOCAÇÃO', 'PRONTA ENTREGA', 'ITAJAÍ/SC', '20 PÉS', '40 HC', 'DRY', 'FOTOS REAIS', 'VISITA AGENDADA']} />

      {/* NÚMEROS */}
      <section id="numeros" className="mx-auto max-w-7xl px-5 py-24">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {numeros.map(([n, u, l], i) => (
            <Rev key={l} d={i * 0.1} zoom>
              <div className="cartao p-6 text-center sm:p-8">
                <p className="display text-6xl sm:text-7xl"><span className="laranja-texto">{n}</span><span className="text-3xl text-white/70 sm:text-4xl"> {u}</span></p>
                <p className="mt-2 text-sm uppercase tracking-widest text-white/55">{l}</p>
              </div>
            </Rev>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-white/40">*Medidas padrão do 40 HC (High Cube). Podem variar de acordo com a unidade.</p>
      </section>

      {/* DIFERENCIAL */}
      <section className="relative isolate overflow-hidden py-24" style={{ background: 'var(--bg2)' }}>
        <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse at 85% 0%, rgba(255,159,26,.14), transparent 55%)' }} />
        <div className="mx-auto max-w-7xl px-5">
          <Titulo tag="O nosso diferencial" sub="A MLA Containers foi criada para trazer ao mercado mais clareza e menos dor de cabeça na operação de quem compra ou aluga.">Transparência e <span className="laranja-texto">tranquilidade</span></Titulo>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[['01', 'Transparência', 'Fotos reais do nosso estoque, valores claros e visita ao pátio. Sem surpresa na hora de decidir.'], ['02', 'Tranquilidade', 'Atendimento direto e passo a passo simples, do primeiro contato à retirada ou entrega.'], ['03', 'Localização estratégica', 'Em Itajaí/SC, num ponto estratégico para facilitar a retirada e a logística da sua operação.']].map(([n, t, s], i) => (
              <Rev key={n} d={i * 0.1} zoom>
                <div className="cartao h-full p-7">
                  <p className="display text-7xl"><span className="laranja-texto">{n}</span></p>
                  <p className="display mt-2 text-3xl">{t}</p><p className="mt-2 text-white/70">{s}</p>
                </div>
              </Rev>
            ))}
          </div>
          <Rev className="mt-8"><a href="/sobre" className="btn btn-borda">Conheça a MLA</a></Rev>
        </div>
      </section>

      {/* ESCOLHA O USO */}
      <section className="mx-auto max-w-7xl px-5 pb-24">
        <Titulo tag="Um container, mil usos" sub="Escolha para que você quer o container e veja como ele resolve. Ao final, a mensagem já vai pronta para o nosso WhatsApp.">Para que você <span className="laranja-texto">precisa?</span></Titulo>
        <div className="mt-10"><Rev><EscolhaUso /></Rev></div>
      </section>

      {/* TAMANHOS */}
      <section className="mx-auto max-w-7xl px-5 pb-24">
        <Titulo tag="Três opções" sub="Escolha pelo espaço e pela altura que o seu projeto pede. Se tiver dúvida, a gente indica.">20 pés, 40 HC <span className="laranja-texto">ou Dry?</span></Titulo>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {([
            { id: '20', cor: '#4da3ff', nome: '20 pés', t: 'Compacto e versátil', m: '≈ 6,06 × 2,44 × 2,59 m', l: ['Depósito e almoxarifado', 'Canteiro e escritório de obra', 'Quiosque e ateliê', 'Cabe em terrenos menores'], preco: PRECO20, img: '/containers/20pes-ilustrativa.jpg', ilus: true },
            { id: 'hc', cor: '#ff9f1a', nome: '40 HC', t: 'Mais espaço e pé-direito', m: '≈ 12,19 × 2,44 × 2,90 m', l: ['Loja, lanchonete e showroom', 'Casa container e escritório', 'Altura extra: divisórias e mezanino', 'Maior volume de armazenagem'], preco: PRECO40, img: '/containers/lateral-aberta.jpg', ilus: false },
            { id: 'dry', cor: '#2dd4bf', nome: '40 Dry', t: 'Espaço de 40 pés, altura padrão', m: '≈ 12,19 × 2,44 × 2,59 m', l: ['Armazenagem de grande volume', 'Obras e canteiros', 'Projetos com altura padrão', 'Disponível em unidades selecionadas'], preco: PRECODRY, img: '', ilus: false },
          ]).map((x, i) => (
            <Rev key={x.id} d={i * 0.1} zoom>
              <div className="cartao h-full overflow-hidden" style={{ borderColor: `${x.cor}66` }}>
                <div className="relative h-52" style={x.img ? undefined : { background: `radial-gradient(ellipse at 50% 120%, ${x.cor}40, transparent 70%), #12151b` }}>
                  {x.img ? <Image src={x.img} alt={`Container de ${x.nome}`} fill quality={90} sizes="(max-width:1024px) 100vw, 33vw" className="object-cover" /> : <p className="display absolute inset-0 grid place-items-center text-8xl" style={{ color: x.cor }}>DRY</p>}
                  {x.ilus && <span className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white/90">Imagem ilustrativa</span>}
                  <div className="absolute inset-x-0 bottom-0 h-20" style={{ background: 'linear-gradient(180deg, transparent, #1a1d25)' }} />
                  <span className="absolute left-0 top-0 h-full w-1.5" style={{ background: x.cor }} />
                </div>
                <div className="p-6">
                  <p className="display text-6xl" style={{ color: x.cor }}>{x.nome}</p>
                  <p className="display mt-1 text-2xl">{x.t}</p>
                  <p className="mt-1 text-sm text-white/50">Medidas externas padrão: {x.m}</p>
                  <p className="mt-3 inline-block rounded-full px-4 py-1.5 text-sm font-black text-[#14110c]" style={{ background: x.cor }}>{x.preco}</p>
                  <ul className="mt-4 space-y-2 text-white/80">{x.l.map(y => <li key={y} className="flex gap-2"><span style={{ color: x.cor }}>✓</span>{y}</li>)}</ul>
                  <BotaoWhats origem={`tamanho-${x.id}`} texto={`Olá! Vim pelo site da MLA Containers e quero saber preço e disponibilidade do container ${x.nome}.`} className="btn btn-laranja mt-6 w-full">Quero o {x.nome}</BotaoWhats>
                </div>
              </div>
            </Rev>
          ))}
        </div>
      </section>

      {/* PLANTA */}
      <section className="relative isolate overflow-hidden py-24" style={{ background: 'var(--bg2)' }}>
        <div className="mx-auto max-w-7xl px-5">
          <Titulo tag="Compare as medidas" sub="Os três tipos desenhados na mesma escala: o 20 pés (azul) e o 40 Dry (verde) cabem dentro do contorno do 40 HC (laranja). Toque nas legendas para mostrar ou ocultar cada um.">Medidas <span className="laranja-texto">sem mistério</span></Titulo>
          <Rev className="cartao mt-10 p-3 sm:p-8"><Planta /></Rev>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[['Aço corten resistente', 'Estrutura pensada para o mar: aguenta chuva, sol e uso pesado.'], ['Porta com trava', 'Fechamento seguro para guardar ferramentas, estoque e equipamentos.'], ['Pé-direito generoso', 'A altura extra do HC facilita instalações, divisórias e mezanino.']].map(([t, s], i) => (
              <Rev key={t} d={i * 0.1}><div className="cartao h-full p-5"><p className="display text-2xl">{t}</p><p className="mt-1 text-sm text-white/65">{s}</p></div></Rev>
            ))}
          </div>
        </div>
      </section>

      {/* FOTOS */}
      <section className="mx-auto max-w-7xl px-5 py-24">
        <Titulo tag="Sem imagem de banco" sub="Fotos reais de unidades do nosso estoque. Cada container é único: tipo, ano e detalhes podem variar, e você confere o seu pessoalmente na visita ao pátio.">Do nosso pátio. <span className="laranja-texto">Fotos reais.</span></Titulo>
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:grid-rows-2">
          {([['lateral', 'Lateral do container 40 pés HC', 'col-span-2 row-span-1 md:row-span-2 aspect-[4/3] md:aspect-auto'], ['interior-porta', 'Container visto de dentro, da porta', 'aspect-[4/5]'], ['traseira', 'Traseira do container', 'aspect-[4/5]'], ['lateral-aberta', 'Container no pátio em Itajaí/SC', 'col-span-2 aspect-[16/9]']] as const).map(([f, alt, cl], i) => (
            <Rev key={f} d={i * 0.08} zoom className={cl}>
              <div className="foto h-full w-full"><Image src={`/containers/${f}.jpg`} alt={alt} fill quality={90} sizes="(max-width:768px) 50vw, 33vw" className="object-cover" /></div>
            </Rev>
          ))}
        </div>
      </section>

      {/* CAMILA */}
      <section className="mx-auto max-w-7xl px-5 pb-24">
        <div className="cartao grid items-center gap-10 overflow-hidden p-6 sm:p-12 lg:grid-cols-[.8fr_1.2fr]" style={{ background: 'linear-gradient(135deg, rgba(255,159,26,.12), rgba(255,255,255,.02))' }}>
          <Rev tipo="esq" className="mx-auto w-full max-w-[290px]">
            <div className="rounded-[2.4rem] border-[7px] border-[#2a2f3a] bg-black p-1 shadow-2xl" style={{ boxShadow: '0 40px 100px -20px rgba(255,159,26,.35)' }}>
              <video className="aspect-[9/16] w-full rounded-[1.9rem] object-cover" controls playsInline preload="none" poster="/site/camila-poster.jpg">
                <source src="/site/camila.mp4" type="video/mp4" />
              </video>
            </div>
          </Rev>
          <Rev tipo="dir">
            <p className="tag">Conheça a Camila</p>
            <h2 className="display mt-2 text-5xl sm:text-6xl">Um tour <span className="laranja-texto">pelo pátio</span></h2>
            <p className="mt-4 max-w-lg text-lg text-white/75">A Camila é a personagem virtual da MLA Containers. Ela apresenta os containers, os usos e como agendar a sua visita, em menos de um minuto.</p>
            <BotaoWhats origem="camila" className="btn btn-laranja mt-6">Quero agendar a minha visita</BotaoWhats>
          </Rev>
        </div>
      </section>

      {/* VENDA x LOCAÇÃO */}
      <section className="mx-auto max-w-7xl px-5 pb-24">
        <div className="grid gap-4 md:grid-cols-2">
          {[['/venda', 'Comprar', 'Containers à venda', `Containers ${PRECO}, conforme tipo e ano. Fotos reais e visita no pátio.`, '/containers/lateral.jpg'], ['/locacao', 'Alugar', 'Locação de containers', 'Precisa por um período? Consulte disponibilidade e condições.', '/containers/lateral-aberta.jpg']].map(([h, tag, t, s, img], i) => (
            <Rev key={h} d={i * 0.1} zoom>
              <a href={h} className="foto group block h-80">
                <Image src={img} alt="" fill quality={85} sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
                <div className="absolute inset-0 z-10 flex flex-col justify-end p-7" style={{ background: 'linear-gradient(180deg, transparent 20%, rgba(13,15,20,.92))' }}>
                  <p className="tag">{tag}</p><p className="display mt-1 text-5xl">{t}</p><p className="mt-2 max-w-sm text-white/75">{s}</p>
                  <p className="mt-3 font-bold text-[var(--acento)] transition group-hover:translate-x-2">Saiba mais →</p>
                </div>
              </a>
            </Rev>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-24" style={{ background: 'var(--bg2)' }}>
        <div className="mx-auto max-w-7xl px-5">
          <Titulo centro tag="Simples e sem enrolação">Como <span className="laranja-texto">funciona</span></Titulo>
          <div className="mt-14"><ComoFunciona itens={[['Fale com a gente', 'Chame no WhatsApp ou deixe nome e telefone. Respondemos com o valor e as fotos das unidades disponíveis.'], ['Veja no pátio', 'Agende a visita em Itajaí/SC, confira o container por fora e por dentro e escolha o seu.'], ['Feche e retire', 'Combine o pagamento e a retirada, ou peça a cotação do frete para a sua cidade.']]} /></div>
        </div>
      </section>

      {/* FAQ + MAPA */}
      <section className="mx-auto max-w-7xl px-5 py-24">
        <Titulo centro tag="Tire suas dúvidas">Perguntas <span className="laranja-texto">frequentes</span></Titulo>
        <div className="mt-12"><Faq itens={FAQ_GERAL} /></div>
      </section>
      <section className="mx-auto max-w-5xl px-5 pb-8"><Titulo tag="Venha conhecer">Nosso <span className="laranja-texto">pátio</span></Titulo><div className="mt-8"><Mapa /></div></section>

      <CtaFinal pagina="inicio" assunto="informações sobre containers (venda ou locação)" />
    </>
  )
}

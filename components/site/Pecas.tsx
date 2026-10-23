import Script from 'next/script'

const META = process.env.NEXT_PUBLIC_META_PIXEL_ID
const TIKTOK = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID

export function Pixels() {
  return (
    <>
      {META && (
        <Script id="meta-pixel-site" strategy="afterInteractive">{`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META}');fbq('track','PageView');`}</Script>
      )}
      {TIKTOK && (
        <Script id="tiktok-pixel-site" strategy="afterInteractive">{`
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${TIKTOK}');ttq.page();}(window,document,'ttq');`}</Script>
      )}
    </>
  )
}

/** Faixa de segurança com texto rolando */
export function Faixa({ itens }: { itens: string[] }) {
  const linha = [...itens, ...itens]
  return (
    <div className="overflow-hidden border-y border-black/40" style={{ background: 'var(--acento)' }}>
      <div className="marquee py-3">
        {[...linha, ...linha].map((t, i) => (
          <span key={i} className="display flex items-center whitespace-nowrap px-6 text-xl text-[#14110c] sm:text-2xl">{t}<span className="ml-12 text-base">✦</span></span>
        ))}
      </div>
    </div>
  )
}

/** Planta técnica animada do container 40' High Cube (vista lateral + frontal) */
export function Planta() {
  const ondas = Array.from({ length: 46 }, (_, i) => 78 + i * 15.6)
  return (
    <svg viewBox="0 0 900 330" className="w-full" role="img" aria-label="Planta técnica do container de 40 pés High Cube, com 12,19 metros de comprimento e 2,90 metros de altura">
      <defs>
        <pattern id="malha" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="rgba(255,255,255,.05)" /></pattern>
      </defs>
      <rect width="900" height="330" fill="url(#malha)" />
      {/* vista lateral */}
      <g fill="none" stroke="#ff9f1a" strokeWidth="2.2" strokeLinejoin="round">
        <rect className="traco" x="70" y="60" width="720" height="172" rx="3" />
        <path className="traco" d="M70 84H790M70 208H790" strokeWidth="1.2" stroke="rgba(255,159,26,.55)" />
        <path className="traco" d="M70 60v-12h26v12M764 60v-12h26v12M70 232v12h26v-12M764 232v12h26v-12" strokeWidth="1.6" />
      </g>
      <g stroke="rgba(255,159,26,.35)" strokeWidth="1">
        {ondas.map(x => <path key={x} className="traco" d={`M${x} 90V202`} />)}
      </g>
      {/* cotas */}
      <g className="cota" fill="none" stroke="#c9d0da" strokeWidth="1.2">
        <path d="M70 282H790M70 274v16M790 274v16" />
        <path d="M840 60V232M832 60h16M832 232h16" />
      </g>
      <g className="cota" fill="#fff" fontFamily="var(--font-titulo), sans-serif" fontWeight="700" textAnchor="middle">
        <text x="430" y="272" fontSize="22" letterSpacing="2">12,19 m · 40 PÉS</text>
        <text x="866" y="150" fontSize="20" letterSpacing="2" transform="rotate(90 866 150)">2,90 m · HIGH CUBE</text>
        <text x="430" y="150" fontSize="38" fill="rgba(255,159,26,.9)" fontStyle="italic" fontWeight="800" letterSpacing="3">MLA CONTAINERS</text>
      </g>
    </svg>
  )
}

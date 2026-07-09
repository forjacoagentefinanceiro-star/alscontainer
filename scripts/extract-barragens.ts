/**
 * Monitoramento de barragens — Defesa Civil SC
 *
 * Extrai dados de https://monitoramento.defesacivil.sc.gov.br/barragens
 *
 * Estratégia:
 *  1. Intercepção de rede: captura qualquer resposta JSON com dados de barragens
 *  2. Fallback DOM: lê tabela HTML se não encontrou via API
 *
 * Salva em `barragens_monitoramento` e notifica via Telegram quando muda.
 */
import { chromium, type Response, type Browser } from "playwright";
import { createClient } from "@supabase/supabase-js";

const DASHBOARD_URL = "https://monitoramento.defesacivil.sc.gov.br/barragens";
const RIO_URL       = "https://defesacivil.blumenau.sc.gov.br/d/nivel-do-rio";
const TG_TOKEN    = process.env.TELEGRAM_TOKEN ?? "";
const TG_CHAT_FAIL = process.env.TELEGRAM_CHAT_ID ?? "";

// chat_ids carregados do Supabase (tabela telegram_subscriptions) + fallback env
let TG_CHATS: string[] = [];

const DELTA_RIO_M   = 0.20;
const DELTA_CAP_PCT = 0.50;

type Ponto = {
  id: string;
  nome: string;
  nivel_m: string | null;
  capacidade_pct: string | null;
  comportas_abertas: string | null;
  comportas_fechadas: string | null;
  hora_leitura: string | null;
  tipo: "barragem" | "rio";
};

// ── helpers ───────────────────────────────────────────────────────────────────

async function sendTelegram(msg: string) {
  if (!TG_TOKEN || TG_CHATS.length === 0) { console.log("[telegram] não configurado"); return; }
  for (const chat of TG_CHATS) {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: msg, parse_mode: "HTML" }),
    }).catch(e => console.warn(`[telegram] erro ${chat}:`, e));
  }
}

// Converte "DD/MM/YYYY HH:MM:SS" ou "DD/MM/YYYY HH:MM" (UTC) → ISO 8601
function parseHoraDefesaCivil(raw: string | null): string | null {
  if (!raw) return null;
  const m1 = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m1) {
    const [, dd, mo, yyyy, hh, min, ss] = m1;
    return new Date(`${yyyy}-${mo}-${dd}T${hh}:${min}:${ss}Z`).toISOString();
  }
  const m2 = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (m2) {
    const [, dd, mo, yyyy, hh, min] = m2;
    return new Date(`${yyyy}-${mo}-${dd}T${hh}:${min}:00Z`).toISOString();
  }
  return raw;
}

function num(s: string | null): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(",", ".").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

function statusRio(nivelM: number | null): string {
  if (nivelM === null) return "desconhecido";
  if (nivelM >= 9.0) return "emergencia";
  if (nivelM >= 7.0) return "alerta";
  if (nivelM >= 5.5) return "atencao";
  return "normal";
}

function statusBarragem(pct: number | null): string {
  if (pct === null) return "desconhecido";
  if (pct >= 90) return "emergencia";
  if (pct >= 70) return "atencao";
  return "normal";
}

function emojiStatus(s: string): string {
  if (s === "emergencia") return "🔴";
  if (s === "alerta")     return "🟠";
  if (s === "atencao")    return "🟡";
  if (s === "normal")     return "🟢";
  return "⚪";
}

function labelStatus(s: string): string {
  if (s === "emergencia") return "CRÍTICA";
  if (s === "alerta")     return "ALERTA";
  if (s === "atencao")    return "ATENÇÃO";
  if (s === "normal")     return "Normal";
  return s;
}

function mudancaSignificativa(ant: Record<string, string | null>, atual: Ponto): { mudou: boolean; detalhes: string[] } {
  const detalhes: string[] = [];

  if (atual.tipo === "rio") {
    const a = num(ant.nivel_m), b = num(atual.nivel_m);
    if (a !== null && b !== null && Math.abs(b - a) >= DELTA_RIO_M)
      detalhes.push(`nível: ${ant.nivel_m} → ${atual.nivel_m} m`);
    if (ant.status !== statusRio(b))
      detalhes.push(`status: ${labelStatus(ant.status ?? "")} → ${labelStatus(statusRio(b))}`);
  } else {
    const a = num(ant.capacidade_pct), b = num(atual.capacidade_pct);
    if (a !== null && b !== null && Math.abs(b - a) >= DELTA_CAP_PCT)
      detalhes.push(`capacidade: ${ant.capacidade_pct} → ${atual.capacidade_pct} %`);

    const ca = num(ant.comportas_abertas), cb = num(atual.comportas_abertas);
    if (ca !== cb)
      detalhes.push(`comportas abertas: ${ant.comportas_abertas ?? "?"} → ${atual.comportas_abertas ?? "?"}`);

    const cf_ant = num(ant.comportas_fechadas), cf_at = num(atual.comportas_fechadas);
    if (cf_ant !== cf_at)
      detalhes.push(`comportas fechadas: ${ant.comportas_fechadas ?? "?"} → ${atual.comportas_fechadas ?? "?"}`);

    const stAnt = ant.status ?? "desconhecido";
    const stAt  = statusBarragem(num(atual.capacidade_pct));
    if (stAnt !== stAt) detalhes.push(`status: ${labelStatus(stAnt)} → ${labelStatus(stAt)}`);
  }

  return { mudou: detalhes.length > 0, detalhes };
}

// ── parsers da resposta JSON da API ───────────────────────────────────────────

// Campos possíveis para nível (vários nomes usados pelo governo)
const CAMPOS_NIVEL    = ["nivel", "nivel_m", "nivel_atual", "cota", "cota_atual", "height", "level"];
const CAMPOS_CAP      = ["capacidade", "capacidade_pct", "volume_pct", "volume_percentual", "percent", "enchimento"];
const CAMPOS_ABERTAS  = ["comportas_abertas", "comportas_abertas_qtd", "gates_open", "abertas"];
const CAMPOS_FECHADAS = ["comportas_fechadas", "comportas_fechadas_qtd", "gates_closed", "fechadas"];
const CAMPOS_NOME     = ["nome", "name", "estacao", "barragem", "identificacao", "descricao", "municipio"];
const CAMPOS_HORA     = ["hora", "data_hora", "datetime", "timestamp", "hora_leitura", "data_medicao", "data_coleta"];

function getField(obj: Record<string, unknown>, campos: string[]): string | null {
  for (const c of campos) {
    const v = obj[c];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function looksLikeBarragem(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj).map(k => k.toLowerCase());
  const hasName  = CAMPOS_NOME.some(c => keys.includes(c));
  const hasData  = [...CAMPOS_NIVEL, ...CAMPOS_CAP].some(c => keys.includes(c));
  return hasName && hasData;
}

function parseApiItem(item: Record<string, unknown>, idx: number): Ponto | null {
  const nome = getField(item, CAMPOS_NOME);
  if (!nome) return null;

  const nivel       = getField(item, CAMPOS_NIVEL);
  const capacidade  = getField(item, CAMPOS_CAP);
  const abertas     = getField(item, CAMPOS_ABERTAS);
  const fechadas    = getField(item, CAMPOS_FECHADAS);
  const hora        = getField(item, CAMPOS_HORA);

  const id = "barr_" + nome.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");

  return { id, nome, nivel_m: nivel, capacidade_pct: capacidade, comportas_abertas: abertas, comportas_fechadas: fechadas, hora_leitura: hora, tipo: "barragem" };
}

function tryParseApiResponse(data: unknown, url: string): Ponto[] {
  if (!data || typeof data !== "object") return [];

  // Array direto
  if (Array.isArray(data)) {
    const pontos: Ponto[] = [];
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (typeof item === "object" && item !== null && looksLikeBarragem(item as Record<string, unknown>)) {
        const p = parseApiItem(item as Record<string, unknown>, i);
        if (p) pontos.push(p);
      }
    }
    if (pontos.length > 0) {
      console.log(`[api] ✅ ${pontos.length} barragens extraídas de array em ${url}`);
      return pontos;
    }
  }

  // Objeto com propriedade que contém array
  const obj = data as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (Array.isArray(val) && val.length > 0) {
      const sample = val[0];
      if (typeof sample === "object" && sample !== null && looksLikeBarragem(sample as Record<string, unknown>)) {
        const pontos: Ponto[] = [];
        for (let i = 0; i < val.length; i++) {
          const p = parseApiItem(val[i] as Record<string, unknown>, i);
          if (p) pontos.push(p);
        }
        if (pontos.length > 0) {
          console.log(`[api] ✅ ${pontos.length} barragens extraídas de obj.${key} em ${url}`);
          return pontos;
        }
      }
    }
  }

  return [];
}

// ── extração Playwright ───────────────────────────────────────────────────────

// Extrai as 3 barragens do site Defesa Civil SC
async function extrairBarragensDCSC(browser: Browser): Promise<Ponto[]> {
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);

  const apiCaptures: { url: string; data: unknown }[] = [];
  page.on("response", async (res: Response) => {
    try {
      const ct = res.headers()["content-type"] ?? "";
      if (!ct.includes("json")) return;
      const url  = res.url();
      const data = await res.json().catch(() => null);
      if (!data) return;
      console.log(`[network] JSON ${res.status()} ${url} → ${JSON.stringify(data).slice(0, 200)}`);
      apiCaptures.push({ url, data });
    } catch { /* silencioso */ }
  });

  try {
    console.log("[barragens] acessando", DASHBOARD_URL);
    await page.goto(DASHBOARD_URL, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(8000);

    // Tentativa 1: API JSON interceptada
    for (const { url, data } of apiCaptures) {
      const pontos = tryParseApiResponse(data, url);
      if (pontos.length > 0) return pontos;
    }

    console.log("[barragens] nenhuma API JSON — tentando DOM...");

    // Tentativa 2: DOM text (formato Defesa Civil SC)
    const resultado = await page.evaluate((): Ponto[] => {
      const pontos: Ponto[] = [];
      const rawLines = (document.body.innerText ?? "").replace(/\r/g, "").split("\n").map(l => l.trim());

      const sections: string[][] = [];
      let cur: string[] = [];
      for (const line of rawLines) {
        if (/^Barragem\s+\S+/.test(line) && line !== "Barragem") {
          if (cur.length > 2) sections.push(cur);
          cur = [line];
        } else if (cur.length > 0) {
          cur.push(line);
        }
      }
      if (cur.length > 2) sections.push(cur);

      for (const lines of sections) {
        const nome = lines[0];
        if (!nome || !nome.toLowerCase().startsWith("barragem")) continue;

        let hora: string | null = null;
        for (const l of lines) {
          const m = l.match(/Atualiza[çc][aã]o:\s*(.+)/i);
          if (m) { hora = m[1].trim(); break; }
        }

        let nivel: string | null = null;
        const iMont = lines.findIndex(l => l === "Montante");
        if (iMont >= 0) {
          for (let j = iMont + 1; j < Math.min(iMont + 4, lines.length); j++) {
            const m = lines[j].match(/^(\d+[,.]\d+)\s*m$/);
            if (m) { nivel = m[1]; break; }
          }
        }

        let pct: string | null = null;
        const iUtil = lines.findIndex(l => /utiliza[çc][aã]o/i.test(l));
        if (iUtil >= 0) {
          for (let j = iUtil + 1; j < Math.min(iUtil + 4, lines.length); j++) {
            const m = lines[j].match(/^(\d+[,.]\d+)\s*%$/);
            if (m) { pct = m[1]; break; }
          }
        }

        let abertas = 0, fechadas = 0;
        const iComp   = lines.findIndex(l => l === "Comportas");
        const iReserv = lines.findIndex(l => l === "Reservação");
        if (iComp >= 0) {
          const end = iReserv > iComp ? iReserv : lines.length;
          for (let j = iComp + 1; j < end; j++) {
            if (lines[j] === "Aberta")  abertas++;
            else if (lines[j] === "Fechada") fechadas++;
          }
        }

        const id = "barr_" + nome.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
        pontos.push({ id, nome, nivel_m: nivel, capacidade_pct: pct,
          comportas_abertas: String(abertas), comportas_fechadas: String(fechadas),
          hora_leitura: hora, tipo: "barragem" });
      }
      return pontos;
    });

    if (resultado.length > 0) {
      console.log(`[barragens] DOM: ${resultado.length} barragens`);
    } else {
      const txt = await page.evaluate(() => document.body.innerText.slice(0, 2000));
      console.warn("[barragens] ⚠️ nenhum dado. Texto:\n", txt);
    }
    return resultado;
  } finally {
    await page.close();
  }
}

// Extrai o nível do Rio Itajaí em Blumenau (Grafana Defesa Civil Blumenau)
async function extrairRioBlumenau(browser: Browser): Promise<Ponto[]> {
  // Blumenau usa certificado autoassinado — ignora SSL
  const ctx  = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);

  try {
    console.log("[rio] acessando", RIO_URL);
    await page.goto(RIO_URL, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(8000);

    const dados = await page.evaluate((): { nivel: string | null; hora: string | null } => {
      const txt = document.body.innerText ?? "";

      // Grafana stat: o nível é o número mais proeminente na página (< 20 m)
      let nivel: string | null = null;
      const pats = [
        /(\d{1,2}[,.]\d{2})\s*m\b/i,
        /nível[^\d]{0,30}(\d{1,2}[,.]\d+)/i,
        /rio[^\d]{0,30}(\d{1,2}[,.]\d+)/i,
        /(\d{1,2}[,.]\d+)/,
      ];
      for (const pat of pats) {
        const m = txt.match(pat);
        if (m) {
          const n = parseFloat(m[1].replace(",", "."));
          if (n > 0 && n < 20) { nivel = m[1]; break; }
        }
      }

      // Timestamp: "DD/MM/YYYY HH:MM" ou "DD/MM/YYYY HH:MM:SS"
      let hora: string | null = null;
      const mH = txt.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?)/);
      if (mH) hora = mH[1];

      return { nivel, hora };
    });

    if (!dados.nivel) {
      const txt = await page.evaluate(() => document.body.innerText.slice(0, 1000));
      console.warn("[rio] ⚠️ nenhum nível. Texto:\n", txt);
      return [];
    }

    console.log(`[rio] nivel=${dados.nivel}m @ ${dados.hora}`);
    return [{
      id:                 "rio_blumenau",
      nome:               "Rio Itajaí em Blumenau",
      nivel_m:            dados.nivel,
      capacidade_pct:     null,
      comportas_abertas:  null,
      comportas_fechadas: null,
      hora_leitura:       parseHoraDefesaCivil(dados.hora),
      tipo:               "rio",
    }];
  } catch (err) {
    console.error("[rio] erro:", err);
    return [];
  } finally {
    await ctx.close();
  }
}

// Orquestra as duas extrações no mesmo browser
async function extrair(): Promise<Ponto[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const barragens = await extrairBarragensDCSC(browser);
    const rio       = await extrairRioBlumenau(browser);
    return [...barragens, ...rio];
  } finally {
    await browser.close();
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Carrega assinantes do Supabase; fallback para env vars
  const { data: subs } = await supabase
    .from("telegram_subscriptions")
    .select("chat_id")
    .eq("ativo", true);
  if (subs && subs.length > 0) {
    TG_CHATS = subs.map((s: { chat_id: string }) => s.chat_id);
    console.log(`[telegram] ${TG_CHATS.length} assinante(s) do Supabase`);
  } else {
    // fallback: variáveis de ambiente
    TG_CHATS = (process.env.TELEGRAM_BARRAGENS_CHAT_IDS || process.env.TELEGRAM_BARRA_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "")
      .split(",").map((s: string) => s.trim()).filter(Boolean);
    console.log(`[telegram] ${TG_CHATS.length} chat(s) via env (sem assinantes no banco)`);
  }

  let pontos: Ponto[] = [];
  try {
    pontos = await extrair();
  } catch (err) {
    console.error("[barragens] erro:", err);
    if (TG_TOKEN && TG_CHAT_FAIL) {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TG_CHAT_FAIL, text: `⚠️ Barragens SC — falha na extração: ${String(err).slice(0, 200)}` }),
      }).catch(() => {});
    }
    process.exit(1);
  }

  if (pontos.length === 0) {
    console.warn("[barragens] nenhum ponto extraído — abortando");
    return;
  }

  // Converte hora_leitura de "DD/MM/YYYY HH:MM:SS" (UTC) → ISO
  pontos.forEach(p => { p.hora_leitura = parseHoraDefesaCivil(p.hora_leitura); });

  console.log(`[barragens] extraídos ${pontos.length} pontos:`);
  pontos.forEach(p => {
    if (p.tipo === "rio")
      console.log(`  [rio] ${p.nome}: ${p.nivel_m} m @ ${p.hora_leitura}`);
    else
      console.log(`  [barr] ${p.nome}: ${p.nivel_m} m | ${p.capacidade_pct}% | ab=${p.comportas_abertas} fe=${p.comportas_fechadas} | ${p.hora_leitura}`);
  });

  const { data: existentes } = await supabase.from("barragens_monitoramento").select("*");
  const mapa = Object.fromEntries((existentes ?? []).map((r: Record<string, unknown>) => [r.id as string, r]));

  const now = new Date().toISOString();
  const alterados: { ponto: Ponto; detalhes: string[]; statusAtual: string }[] = [];
  const primeiraLeitura = Object.keys(mapa).length === 0;

  for (const p of pontos) {
    const ant = mapa[p.id] as Record<string, string | null> | undefined;
    const statusAtual = p.tipo === "rio"
      ? statusRio(num(p.nivel_m))
      : statusBarragem(num(p.capacidade_pct));

    const { mudou, detalhes } = ant
      ? mudancaSignificativa(ant, p)
      : { mudou: true, detalhes: ["primeira leitura"] };

    const { error: upsertErr } = await supabase.from("barragens_monitoramento").upsert({
      id: p.id,
      nome: p.nome,
      nivel_m: p.nivel_m,
      capacidade_pct: p.capacidade_pct,
      comportas_abertas: p.comportas_abertas,
      comportas_fechadas: p.comportas_fechadas,
      hora_leitura: p.hora_leitura,
      tipo: p.tipo,
      status: statusAtual,
      atualizado_em: now,
      changed_em: mudou ? now : (ant?.changed_em ?? null),
      anterior_nivel_m: mudou ? (ant?.nivel_m ?? null) : (ant?.anterior_nivel_m ?? null),
      anterior_status:  mudou ? (ant?.status  ?? null) : (ant?.anterior_status  ?? null),
    }, { onConflict: "id" });

    if (upsertErr) console.error(`[barragens] erro upsert ${p.id}:`, upsertErr.message);

    // Notifica sempre que houve mudança (inclui novos pontos e primeira execução)
    if (mudou) {
      alterados.push({ ponto: p, detalhes, statusAtual });
    }
  }

  if (alterados.length === 0) {
    console.log("[barragens] sem mudanças significativas");
    return;
  }

  const horaBR = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const temAlerta = alterados.some(a => a.statusAtual === "alerta" || a.statusAtual === "emergencia");

  let msg = temAlerta
    ? `🚨 <b>BARRAGENS SC — ALERTA</b>\n\n`
    : primeiraLeitura
      ? `🆕 <b>Barragens SC — monitoramento iniciado</b>\n\n`
      : `🌊 <b>Barragens SC — atualização</b>\n\n`;

  for (const { ponto: p, detalhes, statusAtual } of alterados) {
    msg += `${emojiStatus(statusAtual)} <b>${p.nome}</b> — ${labelStatus(statusAtual)}\n`;
    if (p.tipo === "barragem") {
      if (p.nivel_m)        msg += `  Nível: ${p.nivel_m} m\n`;
      if (p.capacidade_pct) msg += `  Capacidade: ${p.capacidade_pct}%\n`;
      const ca = p.comportas_abertas ?? "—";
      const cf = p.comportas_fechadas ?? "—";
      msg += `  Comportas: ${ca} abertas / ${cf} fechadas\n`;
    } else {
      if (p.nivel_m) msg += `  Nível: ${p.nivel_m} m\n`;
    }
    if (p.hora_leitura) msg += `  Leitura: ${p.hora_leitura}\n`;
    msg += `  <i>${detalhes.join(" | ")}</i>\n\n`;
  }

  msg += `📅 ${horaBR} BRT\n🔗 ${DASHBOARD_URL}`;

  await sendTelegram(msg);
  console.log(`[barragens] 📣 ${alterados.length} mudança(s) — Telegram enviado`);
}

main().catch(e => { console.error(e); process.exit(1); });

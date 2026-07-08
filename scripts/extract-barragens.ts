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
import { chromium, type Response } from "playwright";
import { createClient } from "@supabase/supabase-js";

const DASHBOARD_URL = "https://monitoramento.defesacivil.sc.gov.br/barragens";
const TG_TOKEN = process.env.TELEGRAM_TOKEN ?? "";
const TG_CHATS = (process.env.TELEGRAM_BARRAGENS_CHAT_IDS || process.env.TELEGRAM_BARRA_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "")
  .split(",").map(s => s.trim()).filter(Boolean);
const TG_CHAT_FAIL = process.env.TELEGRAM_CHAT_ID ?? "";

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

async function extrair(): Promise<Ponto[]> {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  page.setDefaultTimeout(45000);

  // Coleta respostas JSON em paralelo com o carregamento da página
  const apiCaptures: { url: string; data: unknown }[] = [];

  page.on("response", async (res: Response) => {
    try {
      const ct = res.headers()["content-type"] ?? "";
      if (!ct.includes("json")) return;
      const url  = res.url();
      const data = await res.json().catch(() => null);
      if (!data) return;
      const raw = JSON.stringify(data).slice(0, 300);
      console.log(`[network] JSON ${res.status()} ${url} → ${raw}`);
      apiCaptures.push({ url, data });
    } catch { /* silencioso */ }
  });

  try {
    console.log("[barragens] acessando", DASHBOARD_URL);
    await page.goto(DASHBOARD_URL, { waitUntil: "load", timeout: 60000 });
    // Aguarda renderização JS (site faz polling contínuo, nunca atinge networkidle)
    await page.waitForTimeout(8000);

    // ── Tentativa 1: parse das respostas de API capturadas ────────────────────
    for (const { url, data } of apiCaptures) {
      const pontos = tryParseApiResponse(data, url);
      if (pontos.length > 0) {
        await browser.close();
        return pontos;
      }
    }

    console.log("[barragens] nenhuma API JSON reconhecida — tentando extração DOM...");

    // ── Tentativa 2: DOM → text extraction (formato Defesa Civil SC) ─────────
    // Estrutura dos cards: "Barragem [Nome]\nAtualização: ...\nMontante\nNNN,NNm\n...\nde Utilização Atual\nN,N%\nComportas\nC1\nAberta\nC2\nFechada\n..."
    const resultado = await page.evaluate((): Ponto[] => {
      const pontos: Ponto[] = [];
      const bodyText = (document.body.innerText ?? "").replace(/\r/g, "");
      const rawLines = bodyText.split("\n").map(l => l.trim());

      // Divide o texto em seções por barragem
      // Header: linha "Barragem [NomeComEspaço]" (pelo menos 2 palavras)
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
        if (!nome) continue;

        // Timestamp: "Atualização: DD/MM/YYYY HH:MM:SS"
        let hora: string | null = null;
        for (const l of lines) {
          const m = l.match(/Atualiza[çc][aã]o:\s*(.+)/i);
          if (m) { hora = m[1].trim(); break; }
        }

        // Nível: linha "Montante" → próxima linha "NNN,NNm"
        let nivel: string | null = null;
        const iMont = lines.findIndex(l => l === "Montante");
        if (iMont >= 0) {
          for (let j = iMont + 1; j < Math.min(iMont + 4, lines.length); j++) {
            const m = lines[j].match(/^(\d+[,.]\d+)\s*m$/);
            if (m) { nivel = m[1]; break; }
          }
        }

        // Capacidade: linha "de Utilização Atual" → próxima linha "N,N%"
        let pct: string | null = null;
        const iUtil = lines.findIndex(l => /utiliza[çc][aã]o/i.test(l));
        if (iUtil >= 0) {
          for (let j = iUtil + 1; j < Math.min(iUtil + 4, lines.length); j++) {
            const m = lines[j].match(/^(\d+[,.]\d+)\s*%$/);
            if (m) { pct = m[1]; break; }
          }
        }

        // Comportas: tudo entre "Comportas" e "Reservação"
        let abertas = 0, fechadas = 0;
        const iComp  = lines.findIndex(l => l === "Comportas");
        const iReserv = lines.findIndex(l => l === "Reservação");
        if (iComp >= 0) {
          const end = iReserv > iComp ? iReserv : lines.length;
          for (let j = iComp + 1; j < end; j++) {
            if (lines[j] === "Aberta")  abertas++;
            else if (lines[j] === "Fechada") fechadas++;
          }
        }

        const id = "barr_" + nome.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
        pontos.push({
          id, nome,
          nivel_m:            nivel,
          capacidade_pct:     pct,
          comportas_abertas:  String(abertas),
          comportas_fechadas: String(fechadas),
          hora_leitura:       hora,
          tipo:               "barragem",
        });
      }

      return pontos;
    });

    if (resultado.length > 0) {
      console.log(`[barragens] DOM: ${resultado.length} pontos extraídos`);
    } else {
      // Diagnóstico: mostra o texto da página para análise manual
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
      console.warn("[barragens] ⚠️  nenhum dado extraído. Texto da página:");
      console.warn(bodyText);
    }

    return resultado;
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

    if (mudou && (ant || primeiraLeitura)) {
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

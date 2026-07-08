/**
 * Monitoramento de barragens e nível do rio — Defesa Civil Blumenau
 *
 * Extrai:
 *  - Tabela "Informações das Barragens" (Nível m, % capacidade, comportas)
 *  - Nível do Rio Itajaí em Blumenau (painel de texto/stat)
 *
 * Salva em `barragens_monitoramento` e notifica via Telegram quando muda.
 *
 * Secrets necessários:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TELEGRAM_TOKEN, TELEGRAM_CHAT_ID
 *   TELEGRAM_BARRAGENS_CHAT_IDS  (opcional — fallback para TELEGRAM_CHAT_ID)
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const DASHBOARD_URL = "https://defesacivil.blumenau.sc.gov.br/d/barragens";
const TG_TOKEN = process.env.TELEGRAM_TOKEN ?? "";
const TG_CHATS = (process.env.TELEGRAM_BARRAGENS_CHAT_IDS || process.env.TELEGRAM_BARRA_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "")
  .split(",").map(s => s.trim()).filter(Boolean);
const TG_CHAT_FAIL = process.env.TELEGRAM_CHAT_ID ?? "";

// Limiares mínimos para disparar notificação
const DELTA_RIO_M   = 0.20;   // 20 cm
const DELTA_CAP_PCT = 0.50;   // 0.5 pp na % de capacidade

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

// Determina status pelo nível do rio Blumenau (cotas conhecidas)
function statusRio(nivelM: number | null): string {
  if (nivelM === null) return "desconhecido";
  if (nivelM >= 9.0) return "emergencia";
  if (nivelM >= 7.0) return "alerta";
  if (nivelM >= 5.5) return "atencao";
  return "normal";
}

// Determina status da barragem pelo % capacidade e comportas
function statusBarragem(pct: number | null, comportasAbertas: number | null): string {
  if (pct === null) return "desconhecido";
  // Comportas abertas = liberando água = atenção
  if (comportasAbertas !== null && comportasAbertas > 0 && pct > 50) return "alerta";
  if (comportasAbertas !== null && comportasAbertas > 0)              return "atencao";
  if (pct >= 90) return "emergencia";
  if (pct >= 75) return "alerta";
  if (pct >= 60) return "atencao";
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
  if (s === "emergencia") return "EMERGÊNCIA";
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
    const stAt  = statusBarragem(num(atual.capacidade_pct), num(atual.comportas_abertas));
    if (stAnt !== stAt) detalhes.push(`status: ${labelStatus(stAnt)} → ${labelStatus(stAt)}`);
  }

  return { mudou: detalhes.length > 0, detalhes };
}

// ── extração Playwright ───────────────────────────────────────────────────────

async function extrair(): Promise<Ponto[]> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);

  try {
    console.log("[barragens] acessando", DASHBOARD_URL);
    await page.goto(DASHBOARD_URL, { waitUntil: "networkidle", timeout: 55000 });

    // Aguardar a tabela das barragens carregar
    await page.waitForSelector("table", { timeout: 25000 });
    await page.waitForTimeout(2000);

    const resultado = await page.evaluate((): Ponto[] => {
      const pontos: Ponto[] = [];

      // ── 1. Tabela "Informações das Barragens" ──────────────────────────────
      // Procura o cabeçalho que contenha "Nível" e "Capacidade"
      const tabelas = Array.from(document.querySelectorAll("table"));
      const tabelaBarragens = tabelas.find(t => {
        const header = t.querySelector("thead, tr")?.textContent ?? "";
        return /nível|nivel|capacidade/i.test(header);
      });

      if (tabelaBarragens) {
        // Descobre índices das colunas pelo cabeçalho
        const ths = Array.from(tabelaBarragens.querySelectorAll("th")).map(th => th.textContent?.trim().toLowerCase() ?? "");
        const iEstacao   = ths.findIndex(h => /esta[çc][aã]o|nome/i.test(h));
        const iHora      = ths.findIndex(h => /hora|leitura/i.test(h));
        const iNivel     = ths.findIndex(h => /n[íi]vel/i.test(h));
        const iCap       = ths.findIndex(h => /capacidade|%/i.test(h));
        const iAbertas   = ths.findIndex(h => /abertas/i.test(h));
        const iFechadas  = ths.findIndex(h => /fechadas/i.test(h));

        const rows = Array.from(tabelaBarragens.querySelectorAll("tbody tr, tr:not(:first-child)"));
        rows.forEach(row => {
          const cells = Array.from(row.querySelectorAll("td")).map(td => td.textContent?.trim() ?? "");
          if (cells.length < 3) return;

          const nome = iEstacao >= 0 ? cells[iEstacao] : cells[0];
          if (!nome) return;

          pontos.push({
            id: "barr_" + nome.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_"),
            nome,
            nivel_m:           iNivel    >= 0 ? cells[iNivel]    : null,
            capacidade_pct:    iCap      >= 0 ? cells[iCap]      : null,
            comportas_abertas: iAbertas  >= 0 ? cells[iAbertas]  : null,
            comportas_fechadas:iFechadas >= 0 ? cells[iFechadas] : null,
            hora_leitura:      iHora     >= 0 ? cells[iHora]     : null,
            tipo: "barragem",
          });
        });
      }

      // ── 2. Nível do Rio Itajaí em Blumenau ────────────────────────────────
      // Busca em painéis stat, gauge ou tabela com "blumenau" / "rio"
      const bodyText = document.body.innerText;

      // Padrão direto no texto: "Blumenau ... X.XX m" ou "Rio Itajaí ... X.XX"
      const rioPatterns = [
        /blumenau[^\d]{0,60}?(\d+[,.]\d+)\s*m/i,
        /rio[^\d]{0,40}?(\d+[,.]\d+)\s*m/i,
        /n[íi]vel[^\d]{0,40}?blumenau[^\d]{0,20}?(\d+[,.]\d+)/i,
        /blumenau[^\d]{0,20}?(\d+[,.]\d+)/i,
      ];

      let nivelRio: string | null = null;
      let horaRio: string | null = null;

      for (const pat of rioPatterns) {
        const m = bodyText.match(pat);
        if (m) {
          nivelRio = m[1];
          // Tenta capturar hora próxima
          const horaM = bodyText.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
          horaRio = horaM ? horaM[1] : null;
          break;
        }
      }

      // Também tenta achar um painel de stat com "rio" ou "blumenau" no título
      if (!nivelRio) {
        const allEls = Array.from(document.querySelectorAll("*"));
        for (const el of allEls) {
          if (el.children.length > 4) continue;
          const txt = el.textContent?.trim() ?? "";
          if (/blumenau/i.test(txt) && /\d+[,.]\d+/.test(txt) && txt.length < 150) {
            const m = txt.match(/(\d+[,.]\d+)/);
            if (m) { nivelRio = m[1]; break; }
          }
        }
      }

      if (nivelRio) {
        pontos.push({
          id: "rio_blumenau",
          nome: "Rio Itajaí em Blumenau",
          nivel_m: nivelRio,
          capacidade_pct: null,
          comportas_abertas: null,
          comportas_fechadas: null,
          hora_leitura: horaRio,
          tipo: "rio",
        });
      }

      return pontos;
    });

    console.log(`[barragens] extraídos ${resultado.length} pontos:`);
    resultado.forEach(p => {
      if (p.tipo === "rio")
        console.log(`  [rio] ${p.nome}: ${p.nivel_m} m @ ${p.hora_leitura}`);
      else
        console.log(`  [barr] ${p.nome}: ${p.nivel_m} m | ${p.capacidade_pct}% | abertas=${p.comportas_abertas} | ${p.hora_leitura}`);
    });

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
        body: JSON.stringify({ chat_id: TG_CHAT_FAIL, text: `⚠️ Barragens Blumenau — falha na extração: ${String(err).slice(0, 200)}` }),
      }).catch(() => {});
    }
    process.exit(1);
  }

  if (pontos.length === 0) {
    console.warn("[barragens] nenhum ponto extraído — abortando");
    return;
  }

  // Ler registros atuais do banco
  const { data: existentes } = await supabase.from("barragens_monitoramento").select("*");
  const mapa = Object.fromEntries((existentes ?? []).map((r: Record<string, unknown>) => [r.id as string, r]));

  const now = new Date().toISOString();
  const alterados: { ponto: Ponto; detalhes: string[]; statusAtual: string }[] = [];
  const primeiraLeitura = Object.keys(mapa).length === 0;

  for (const p of pontos) {
    const ant = mapa[p.id] as Record<string, string | null> | undefined;
    const statusAtual = p.tipo === "rio"
      ? statusRio(num(p.nivel_m))
      : statusBarragem(num(p.capacidade_pct), num(p.comportas_abertas));

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

    // Notifica em mudanças reais OU na primeira leitura de cada ponto
    if (mudou && (ant || primeiraLeitura)) {
      alterados.push({ ponto: p, detalhes, statusAtual });
    }
  }

  if (alterados.length === 0) {
    console.log("[barragens] sem mudanças significativas");
    return;
  }

  // ── Montar mensagem Telegram ───────────────────────────────────────────────
  const horaBR = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const temAlerta = alterados.some(a => a.statusAtual === "alerta" || a.statusAtual === "emergencia");

  let msg = temAlerta
    ? `🚨 <b>BARRAGENS / RIO BLUMENAU — ALERTA</b>\n\n`
    : primeiraLeitura
      ? `🆕 <b>Barragens / Rio Blumenau — monitoramento iniciado</b>\n\n`
      : `🌊 <b>Barragens / Rio Blumenau — atualização</b>\n\n`;

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
  console.log(`[barragens] 📣 ${alterados.length} mudança(s) detectada(s) — Telegram enviado`);
}

main().catch(e => { console.error(e); process.exit(1); });

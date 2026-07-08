/**
 * Monitoramento de barragens e nível do rio — Defesa Civil Blumenau
 *
 * Acessa o dashboard Grafana da Defesa Civil de Blumenau, extrai os valores
 * de nível/volume dos pontos monitorados e salva em `barragens_monitoramento`.
 * Envia Telegram quando qualquer métrica muda significativamente.
 *
 * Variáveis de ambiente (GitHub Secrets):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TELEGRAM_TOKEN
 *   TELEGRAM_CHAT_ID
 *   TELEGRAM_BARRAGENS_CHAT_IDS  (vírgula separados; fallback para TELEGRAM_CHAT_ID)
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const DASHBOARD_URL = "https://defesacivil.blumenau.sc.gov.br/d/barragens";
const TG_TOKEN = process.env.TELEGRAM_TOKEN ?? "";
const TG_CHATS = (process.env.TELEGRAM_BARRAGENS_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "")
  .split(",").map(s => s.trim()).filter(Boolean);
const TG_CHAT_FAIL = process.env.TELEGRAM_CHAT_ID ?? "";

// Limiar mínimo de mudança para disparar alerta (evita ruído de pequenas oscilações)
const DELTA_RIO_M = 0.20;   // 20 cm para rio
const DELTA_BAR_PCT = 0.5;   // 0.5 pp para barragens em %

type PontoMonitorado = {
  id: string;
  nome: string;
  valor: string;
  unidade: string;
  status: string;
  raw_data: string;
};

// ── helpers ──────────────────────────────────────────────────────────────────

function emojiStatus(s: string): string {
  switch (s) {
    case "emergencia": return "🔴";
    case "alerta":     return "🟠";
    case "atencao":    return "🟡";
    default:           return "🟢";
  }
}

function labelStatus(s: string): string {
  switch (s) {
    case "emergencia": return "EMERGÊNCIA";
    case "alerta":     return "ALERTA";
    case "atencao":    return "ATENÇÃO";
    default:           return "Normal";
  }
}

function detectarStatus(cor: string, titulo: string, valorNum: number | null): string {
  // Inferir status pela cor de fundo/texto do painel no Grafana
  const c = cor.toLowerCase();
  if (c.includes("red") || c.includes("#d44") || c.includes("dark-red") || c.includes("f2495c") || c.includes("e02f44"))
    return "emergencia";
  if (c.includes("orange") || c.includes("#f8") || c.includes("ff780a") || c.includes("fa6400"))
    return "alerta";
  if (c.includes("yellow") || c.includes("#ff") || c.includes("fade2a") || c.includes("f2cc0c"))
    return "atencao";

  // Fallback: limites conhecidos para o Rio Itajaí em Blumenau
  if (titulo.toLowerCase().includes("blumenau") && valorNum !== null) {
    if (valorNum >= 9.0) return "emergencia";
    if (valorNum >= 7.0) return "alerta";
    if (valorNum >= 5.5) return "atencao";
  }
  return "normal";
}

function mudancaSignificativa(
  anterior: string, atual: string,
  unidade: string, statusAnt: string, statusAtual: string
): boolean {
  if (statusAnt !== statusAtual) return true;

  const a = parseFloat(anterior.replace(",", "."));
  const b = parseFloat(atual.replace(",", "."));
  if (isNaN(a) || isNaN(b)) return anterior !== atual;

  const delta = Math.abs(b - a);
  if (unidade === "m")  return delta >= DELTA_RIO_M;
  if (unidade === "%")  return delta >= DELTA_BAR_PCT;
  return delta > 0;
}

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

// ── extração do Grafana ───────────────────────────────────────────────────────

async function extrairPaineis(): Promise<PontoMonitorado[]> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);

  try {
    console.log("[barragens] acessando", DASHBOARD_URL);
    await page.goto(DASHBOARD_URL, { waitUntil: "networkidle", timeout: 50000 });
    // Aguarda os painéis Grafana renderizarem (dados assíncronos)
    await page.waitForTimeout(4000);

    // Tentar aguardar pelo menos um valor numérico aparecer na página
    try {
      await page.waitForFunction(() => {
        const body = document.body.innerText;
        return /\d+[,.]?\d*\s*(m|%|Mm)/.test(body);
      }, { timeout: 15000 });
    } catch { /* segue mesmo sem confirmar */ }

    const pontos = await page.evaluate((): PontoMonitorado[] => {
      const resultados: PontoMonitorado[] = [];

      // ── Estratégia 1: Grafana 9+ data-testid ──
      const testIdPanels = document.querySelectorAll('[data-testid*="Panel header"], [aria-label*="Panel header"]');
      testIdPanels.forEach(headerEl => {
        const nomeEl = headerEl.querySelector('h6, [class*="title"]') ?? headerEl;
        const nome = nomeEl.textContent?.trim() ?? "";
        if (!nome) return;

        // Valor: maior número encontrado dentro do painel (sobe até o container do painel)
        const panelContainer = headerEl.closest('[class*="panel-container"], [data-panelid], section, article') ?? headerEl.parentElement?.parentElement;
        if (!panelContainer) return;

        const textos = Array.from(panelContainer.querySelectorAll("*"))
          .map(el => el.textContent?.trim() ?? "")
          .filter(t => /^\d+([,.]\d+)?$/.test(t));

        if (textos.length === 0) return;

        // Cor do elemento de valor (indica status)
        const mainEl = panelContainer.querySelector('[class*="stat-value"], [class*="value-container"], [class*="BigValue"], [class*="singlestat"]');
        const corEl = mainEl ?? panelContainer;
        const cor = window.getComputedStyle(corEl).color + " " + window.getComputedStyle(corEl).backgroundColor;

        // Unidade: texto que segue o número
        const fullText = panelContainer.textContent?.replace(/\s+/g, " ") ?? "";
        const unidadeMatch = fullText.match(/\d+[,.]?\d*\s*(m³|Mm³|m|%)/);
        const unidade = unidadeMatch ? unidadeMatch[1] : "";

        resultados.push({
          id: nome.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_"),
          nome,
          valor: textos[0],
          unidade,
          status: "normal",
          raw_data: fullText.slice(0, 400) + " | cor: " + cor.slice(0, 100),
        });
      });

      // ── Estratégia 2: painéis pelo seletor legado ──
      if (resultados.length === 0) {
        const legacyPanels = document.querySelectorAll(
          '.panel-container, [class*="grafana-panel"], [class*="panel-wrapper"]'
        );
        legacyPanels.forEach(panel => {
          const tituloEl = panel.querySelector('.panel-title-text, .panel-title h2, h6');
          const nome = tituloEl?.textContent?.trim() ?? "";
          if (!nome) return;

          const fullText = panel.textContent?.replace(/\s+/g, " ") ?? "";
          const numMatch = fullText.match(/(\d+[,.]?\d*)\s*(m³|Mm³|m|%)/);
          if (!numMatch) return;

          const cor = window.getComputedStyle(panel).backgroundColor;
          resultados.push({
            id: nome.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_"),
            nome,
            valor: numMatch[1],
            unidade: numMatch[2],
            status: "normal",
            raw_data: fullText.slice(0, 400) + " | cor: " + cor.slice(0, 60),
          });
        });
      }

      // ── Estratégia 3: varredura de texto — encontra todos pares "label: valor unidade" ──
      if (resultados.length === 0) {
        const fullText = document.body.innerText;
        // Procura padrões como "Rio Itajaí em Blumenau 7.2 m" ou "Barragem Taió 45.3 %"
        const linhas = fullText.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 3);
        let i = 0;
        while (i < linhas.length) {
          const l = linhas[i];
          const numMatch = l.match(/^(.*?)(\d+[,.]?\d+)\s*(m³|Mm³|m|%)\s*$/);
          if (numMatch) {
            const nome = numMatch[1].trim() || (linhas[i - 1] ?? "desconhecido");
            resultados.push({
              id: nome.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_"),
              nome,
              valor: numMatch[2],
              unidade: numMatch[3],
              status: "normal",
              raw_data: l.slice(0, 300),
            });
          }
          i++;
        }
      }

      return resultados;
    });

    // Pós-processamento: determinar status real por cor + limites conhecidos
    for (const p of pontos) {
      const raw = p.raw_data;
      const corMatch = raw.match(/cor: (.+)$/);
      const cor = corMatch ? corMatch[1] : "";
      const valorNum = parseFloat(p.valor.replace(",", "."));
      p.status = detectarStatus(cor, p.nome, isNaN(valorNum) ? null : valorNum);
    }

    console.log(`[barragens] extraídos ${pontos.length} pontos`);
    pontos.forEach(p => console.log(`  ${p.nome}: ${p.valor} ${p.unidade} (${p.status})`));

    return pontos;
  } finally {
    await browser.close();
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  let pontos: PontoMonitorado[] = [];
  try {
    pontos = await extrairPaineis();
  } catch (err) {
    console.error("[barragens] erro na extração:", err);
    if (TG_TOKEN && TG_CHAT_FAIL) {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TG_CHAT_FAIL, text: `⚠️ Barragens Blumenau — falha na extração: ${String(err).slice(0, 200)}` }),
      }).catch(() => {});
    }
    return;
  }

  if (pontos.length === 0) {
    console.warn("[barragens] nenhum ponto extraído — abortando");
    return;
  }

  // Ler registros atuais do banco
  const { data: existentes } = await supabase
    .from("barragens_monitoramento")
    .select("*");
  const mapaExist = Object.fromEntries((existentes ?? []).map(r => [r.id, r]));

  const alterados: { ponto: PontoMonitorado; anterior: { valor: string; status: string } | null }[] = [];
  const now = new Date().toISOString();

  for (const p of pontos) {
    const ant = mapaExist[p.id];
    const houve_mudanca = ant
      ? mudancaSignificativa(ant.valor ?? "", p.valor, p.unidade, ant.status ?? "normal", p.status)
      : true;

    await supabase.from("barragens_monitoramento").upsert({
      id: p.id,
      nome: p.nome,
      valor: p.valor,
      unidade: p.unidade,
      status: p.status,
      raw_data: p.raw_data.slice(0, 800),
      atualizado_em: now,
      changed_em: houve_mudanca ? now : (ant?.changed_em ?? null),
      anterior_valor: houve_mudanca ? (ant?.valor ?? null) : (ant?.anterior_valor ?? null),
      anterior_status: houve_mudanca ? (ant?.status ?? null) : (ant?.anterior_status ?? null),
    }, { onConflict: "id" });

    if (houve_mudanca && ant) {
      alterados.push({ ponto: p, anterior: { valor: ant.valor ?? "", status: ant.status ?? "normal" } });
    }
  }

  if (alterados.length === 0) {
    console.log("[barragens] sem mudanças significativas");
    return;
  }

  // Montar mensagem Telegram
  const horaBrasilia = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const haAlerta = pontos.some(p => p.status === "alerta" || p.status === "emergencia");

  let msg = haAlerta
    ? `🚨 <b>BARRAGENS BLUMENAU — ALERTA ATIVO</b>\n\n`
    : `🌊 <b>Barragens Blumenau — atualização</b>\n\n`;

  for (const { ponto: p, anterior: ant } of alterados) {
    const mudouStatus = ant && ant.status !== p.status;
    msg += `📍 <b>${p.nome}</b>\n`;
    if (ant) msg += `  Anterior: ${emojiStatus(ant.status)} ${ant.valor} ${p.unidade} (${labelStatus(ant.status)})\n`;
    msg += `  Atual: ${emojiStatus(p.status)} <b>${p.valor} ${p.unidade}</b> (${labelStatus(p.status)})`;
    if (mudouStatus) msg += ` ← MUDOU STATUS`;
    msg += "\n\n";
  }

  msg += `📅 ${horaBrasilia} BRT\n🔗 ${DASHBOARD_URL}`;

  await sendTelegram(msg);
  console.log(`[barragens] 📣 ${alterados.length} mudança(s) — Telegram enviado`);
}

main().catch(e => { console.error(e); process.exit(1); });

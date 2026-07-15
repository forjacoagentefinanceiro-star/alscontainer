/**
 * Extrator da condição da barra — praticoszp21.com.br
 *
 * Acessa a página, aguarda renderização JS completa, extrai a profundidade /
 * condição da barra do Rio Itajaí e salva na tabela `barra_status` do Supabase.
 * Envia Telegram APENAS quando o valor muda.
 *
 * Variáveis de ambiente (GitHub Secrets):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TELEGRAM_TOKEN
 *   TELEGRAM_CHAT_ID
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SITE = "https://praticoszp21.com.br/";
const TG_TOKEN = process.env.TELEGRAM_TOKEN ?? "";
// TELEGRAM_BARRA_CHAT_IDS: destinatários da notificação de mudança da barra (vírgula separados).
// Fallback para TELEGRAM_CHAT_ID se não configurado.
const TG_CHATS_BARRA = (process.env.TELEGRAM_BARRA_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "")
  .split(",").map(s => s.trim()).filter(Boolean);
// TELEGRAM_CHAT_ID continua sendo usado apenas para notificação de falha no workflow
const TG_CHAT = process.env.TELEGRAM_CHAT_ID ?? "";

type CondBarra = {
  condicao_barra?: string;    // código ou texto curto: "P", "R", "I", "F", "C", "Praticável" etc.
  desc_condicao_barra?: string;
  semaforo?: string;          // ex: "verde", "amarelo", "vermelho" — se existir no payload
  restricao?: string;
  menor_profundidade?: string;
  mare_atual?: string;
};

function formatarStatus(item: CondBarra): string {
  const desc = (item.desc_condicao_barra ?? item.condicao_barra ?? "").trim();
  const prof = (item.menor_profundidade ?? "").trim();
  const mare = (item.mare_atual ?? "").trim();
  return [desc, prof ? `Prof: ${prof}` : "", mare ? `Maré: ${mare}m` : ""].filter(Boolean).join(" · ");
}

/**
 * Determina emoji usando o objeto raw (campos semaforo/condicao_barra) quando disponível,
 * com fallback no texto livre. "impraticáv" DEVE vir antes de "praticáv" na busca de texto.
 */
function emojiStatus(status: string, item?: CondBarra): string {
  // 1) campo semaforo direto (cor CSS: "vermelho", "amarelo", "verde", "laranja")
  if (item?.semaforo) {
    const sem = item.semaforo.toLowerCase().trim();
    if (sem.includes("verm")) return "🔴";
    if (sem.includes("amar")) return "🟡";
    if (sem.includes("laran")) return "🟠";
    if (sem.includes("verd")) return "🟢";
  }
  // 2) campo condicao_barra (código: "I"/"F" → vermelho, "R" → amarelo, "C" → laranja, "P" → verde)
  if (item?.condicao_barra) {
    const c = item.condicao_barra.toUpperCase().trim();
    if (c === "F" || c === "I" || /^(FECHA|IMPRAT)/i.test(c)) return "🔴";
    if (c === "R" || /^RESTRI/i.test(c)) return "🟡";
    if (c === "C" || /^CONDIC/i.test(c)) return "🟠";
    if (c === "P" || /^PRATIC/i.test(c)) return "🟢";
  }
  // 3) fallback: texto livre — impraticáv ANTES de praticáv para não dar match errado
  const s = status.toLowerCase();
  if (s.includes("fechad") || s.includes("impraticáv") || s.includes("impraticav")) return "🔴";
  if (s.includes("restri")) return "🟡";
  if (s.includes("condicion")) return "🟠";
  if (s.includes("praticáv") || s.includes("praticav")) return "🟢";
  return "⚓";
}

async function sendTelegram(msg: string) {
  if (!TG_TOKEN || TG_CHATS_BARRA.length === 0) { console.log("[telegram] não configurado"); return; }
  for (const chat of TG_CHATS_BARRA) {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: msg }),
    }).catch(e => console.warn(`[telegram] erro ao enviar para ${chat}:`, e));
  }
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  let profundidade = "";
  let rawText = "";
  let rawItem: CondBarra | undefined;

  try {
    console.log("[barra] acessando", SITE);
    await page.goto(SITE, { waitUntil: "networkidle", timeout: 40000 });
    await page.waitForTimeout(2000); // JS tardio

    // ── Estratégia 1 (principal): variável global window.cond_barra ──
    // O site carrega cond_barra como global JS: var/let cond_barra = [{...}]
    // Após networkidle ela já existe no window context.
    const globalVar = await page.evaluate(() =>
      (window as unknown as { cond_barra?: CondBarra[] }).cond_barra ?? null
    );
    if (globalVar && globalVar[0]) {
      rawItem = globalVar[0];
      rawText = JSON.stringify(globalVar[0]).slice(0, 500);
      profundidade = formatarStatus(globalVar[0]);
      console.log("[barra] estratégia 1 (window.cond_barra) OK");
      console.log("[barra] semaforo:", globalVar[0].semaforo, "| condicao_barra:", globalVar[0].condicao_barra);
    }

    // ── Estratégia 2: regex no HTML fonte (cobre scripts inline) ──
    if (!profundidade) {
      const html = await page.content();
      const m = html.match(/cond_barra\s*=\s*(\[[\s\S]*?\]);/);
      if (m) {
        rawText = m[1].slice(0, 500);
        try {
          const data = JSON.parse(m[1]) as CondBarra[];
          if (data[0]) {
            rawItem = data[0];
            profundidade = formatarStatus(data[0]);
            console.log("[barra] estratégia 2 (HTML regex) OK");
            console.log("[barra] semaforo:", data[0].semaforo, "| condicao_barra:", data[0].condicao_barra);
          }
        } catch (e) { console.warn("[barra] erro parse JSON:", e); }
      }
    }

    // ── Estratégia 3: banner DOM "Condições da Barra" ──
    if (!profundidade) {
      profundidade = await page.evaluate(() => {
        const labelEl = Array.from(document.querySelectorAll("*")).find(el =>
          el.children.length < 6 && (el.textContent ?? "").includes("Condições da Barra")
        );
        if (labelEl) {
          const container = labelEl.closest("div, section, aside, article") ?? labelEl.parentElement;
          const txt = container?.textContent?.trim().replace(/\s+/g, " ") ?? "";
          const m = txt.match(/Condi[çc][õo]es da Barra[:\s]*([\s\S]{3,120}?)(?:Declarado|$)/i);
          return m ? m[1].trim().replace(/\s+/g, " ") : txt.slice(0, 200);
        }
        return "";
      });
      if (profundidade) console.log("[barra] estratégia 3 (DOM banner) OK");
    }

    // ── Estratégia 4: texto bruto ──
    if (!profundidade) {
      const bodyText = await page.evaluate(() => (document.body as HTMLElement).innerText);
      rawText = rawText || bodyText.slice(0, 3000);
      const relevantes = bodyText.split(/\n/).map(l => l.trim())
        .filter(l => /praticável|condicionad[ao]|fechad[ao]/i.test(l) && l.length < 200 && !l.includes("{"));
      profundidade = relevantes.slice(0, 3).join(" | ").slice(0, 300);
      if (profundidade) console.log("[barra] estratégia 4 (texto bruto) OK");
    }

    profundidade = profundidade.trim().slice(0, 300);
    console.log("[barra] extraído:", profundidade || "(vazio)");

  } catch (err) {
    console.error("[barra] erro ao extrair:", err);
  } finally {
    await browser.close();
  }

  if (!profundidade) {
    console.warn("[barra] nada extraído — pulando atualização");
    return;
  }

  // ── Ler último valor do banco ──
  const { data: atual } = await supabase
    .from("barra_status")
    .select("profundidade, changed_em, anterior")
    .eq("id", 1)
    .single();

  const anteriorDB = (atual?.profundidade ?? "") as string;
  // Ignora mudança de formato (ex.: migração do texto cru para limpo)
  // compara apenas se a extração é limpa (sem "cond_barra")
  const changed = profundidade !== anteriorDB && !anteriorDB.includes("cond_barra")
    ? true
    : profundidade !== anteriorDB;

  // ── Upsert no Supabase ──
  const now = new Date().toISOString();
  await supabase.from("barra_status").upsert({
    id: 1,
    profundidade,
    raw_text: rawText.slice(0, 2000),
    atualizado_em: now,
    anterior: changed ? anteriorDB : ((atual as Record<string, unknown> | null)?.anterior ?? ""),
    changed_em: changed ? now : ((atual as Record<string, unknown> | null)?.changed_em ?? null),
  }, { onConflict: "id" });

  if (changed) {
    const horaBrasilia = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const anterior = anteriorDB.includes("cond_barra") ? "(formato anterior)" : anteriorDB || "(sem registro)";
    const emoji = emojiStatus(profundidade, rawItem);
    const emojiAnterior = anteriorDB && !anteriorDB.includes("cond_barra") ? emojiStatus(anteriorDB) : "⚓";
    const msg =
      `🚢 BARRA ITAJAÍ — condição atualizada\n\n` +
      `${emojiAnterior} Anterior: ${anterior}\n` +
      `${emoji} Atual: ${profundidade}\n\n` +
      `📅 ${horaBrasilia} BRT\n` +
      `🔗 ${SITE}`;
    await sendTelegram(msg);
    console.log("[barra] 📣 mudança detectada — Telegram enviado");
    console.log("  anterior:", anteriorDB);
    console.log("  atual:   ", profundidade);
  } else {
    console.log("[barra] sem mudança — status mantido:", profundidade);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

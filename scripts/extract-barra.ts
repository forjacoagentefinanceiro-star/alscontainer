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
const TG_CHAT = process.env.TELEGRAM_CHAT_ID ?? "";

async function sendTelegram(msg: string) {
  if (!TG_TOKEN || !TG_CHAT) { console.log("[telegram] não configurado"); return; }
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text: msg }),
  }).catch(e => console.warn("[telegram] erro:", e));
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

  try {
    console.log("[barra] acessando", SITE);
    await page.goto(SITE, { waitUntil: "networkidle", timeout: 40000 });
    await page.waitForTimeout(2000); // JS tardio

    // ── Estratégia 1: elementos com classe ou texto "barra/profundidade/canal" ──
    profundidade = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll("*")).filter(el => {
        if (el.children.length > 5) return false; // só folhas / containers pequenos
        const txt = (el.textContent ?? "").trim().toLowerCase();
        return (
          txt.includes("profundidade") ||
          txt.includes("praticável") ||
          txt.includes("condicionada") ||
          txt.includes("fechada") ||
          txt.includes("barra praticável")
        ) && txt.length < 300;
      });
      // Preferir elementos que contenham um número (metro)
      const comNumero = candidates.find(el => /\d+[.,]\d+/.test(el.textContent ?? ""));
      return (comNumero ?? candidates[0])?.textContent?.trim().replace(/\s+/g, " ") ?? "";
    });

    // ── Estratégia 2: regex de profundidade no texto completo da página ──
    if (!profundidade) {
      const bodyText = await page.evaluate(() => (document.body as HTMLElement).innerText);
      rawText = bodyText.slice(0, 3000);
      const linhas = bodyText.split(/\n/).map(l => l.trim()).filter(Boolean);
      const relevantes = linhas.filter(l => {
        const lower = l.toLowerCase();
        return lower.includes("profundidade") || lower.includes("praticável") ||
          lower.includes("condicionada") || lower.includes("fechada") ||
          lower.includes("barra") && /\d/.test(l);
      });
      profundidade = relevantes.slice(0, 4).join(" | ").slice(0, 300);
    }

    // ── Estratégia 3: captura tudo em volta da imagem barra-praticavel ──
    if (!profundidade) {
      profundidade = await page.evaluate(() => {
        const img = document.querySelector("img[src*='barra']");
        if (!img) return "";
        const section = img.closest("section, div, article") ?? img.parentElement;
        return section?.textContent?.trim().replace(/\s+/g, " ").slice(0, 300) ?? "";
      });
    }

    profundidade = profundidade.trim().slice(0, 300);
    console.log("[barra] extraído:", profundidade || "(vazio)");

    // ── Salvar screenshot para debug (só log, não persiste no CI) ──
    // await page.screenshot({ path: "barra-debug.png" });

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
    .select("profundidade, changed_em")
    .eq("id", 1)
    .single();

  const anterior = (atual?.profundidade ?? "") as string;
  const changed = profundidade !== anterior;

  // ── Upsert no Supabase ──
  const now = new Date().toISOString();
  await supabase.from("barra_status").upsert({
    id: 1,
    profundidade,
    raw_text: rawText.slice(0, 2000),
    atualizado_em: now,
    anterior: changed ? anterior : ((atual as Record<string, unknown> | null)?.anterior ?? ""),
    changed_em: changed ? now : ((atual as Record<string, unknown> | null)?.changed_em ?? null),
  }, { onConflict: "id" });

  if (changed) {
    const horaBrasilia = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const msg =
      `🚢 BARRA ITAJAÍ — condição atualizada\n\n` +
      `Anterior: ${anterior || "(sem dado anterior)"}\n` +
      `Atual: ${profundidade}\n\n` +
      `📅 ${horaBrasilia} BRT\n` +
      `🔗 ${SITE}`;
    await sendTelegram(msg);
    console.log("[barra] 📣 mudança detectada — Telegram enviado");
    console.log("  anterior:", anterior);
    console.log("  atual:   ", profundidade);
  } else {
    console.log("[barra] sem mudança — status mantido:", profundidade);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

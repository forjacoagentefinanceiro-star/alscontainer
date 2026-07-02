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

    // ── Estratégia 1 (principal): variável JS `cond_barra` no código da página ──
    // O site injeta os dados via: let cond_barra = [{"condicao_barra":"3",
    //   "desc_condicao_barra":"Praticável com Restrições","menor_profundidade":"13,50m","mare_atual":"+0,25"}]
    const { texto: textoJS, raw: rawJS } = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script"));
      for (const s of scripts) {
        const src = s.textContent ?? "";
        if (!src.includes("cond_barra")) continue;
        const match = src.match(/(?:let|var|const)\s+cond_barra\s*=\s*(\[[\s\S]*?\]);/);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            const item = data[0];
            if (!item) return { texto: "", raw: match[1] };
            const desc = (item.desc_condicao_barra ?? "").trim();
            const prof = (item.menor_profundidade ?? "").trim();
            const mare = (item.mare_atual ?? "").trim();
            const partes = [desc, prof ? `Prof: ${prof}` : "", mare ? `Maré: ${mare}m` : ""].filter(Boolean);
            return { texto: partes.join(" · "), raw: match[1].slice(0, 500) };
          } catch { return { texto: "", raw: src.slice(0, 500) }; }
        }
      }
      return { texto: "", raw: "" };
    });
    profundidade = textoJS;
    rawText = rawJS;

    // ── Estratégia 2: banner DOM "Condições da Barra" ──
    if (!profundidade) {
      profundidade = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll("*"));
        const labelEl = all.find(el =>
          el.children.length < 6 &&
          (el.textContent ?? "").includes("Condições da Barra")
        );
        if (labelEl) {
          const container = labelEl.closest("div, section, aside, article") ?? labelEl.parentElement;
          const txt = container?.textContent?.trim().replace(/\s+/g, " ") ?? "";
          const match = txt.match(/Condi[çc][õo]es da Barra[:\s]*([\s\S]{3,120}?)(?:Declarado|$)/i);
          return match ? match[1].trim().replace(/\s+/g, " ") : txt.slice(0, 200);
        }
        return "";
      });
    }

    // ── Estratégia 3: texto bruto ──
    if (!profundidade) {
      const bodyText = await page.evaluate(() => (document.body as HTMLElement).innerText);
      rawText = rawText || bodyText.slice(0, 3000);
      const linhas = bodyText.split(/\n/).map(l => l.trim()).filter(Boolean);
      const relevantes = linhas.filter(l => /praticável|condicionad[ao]|fechad[ao]|barra/i.test(l) && l.length < 200);
      profundidade = relevantes.slice(0, 3).join(" | ").slice(0, 300);
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

/**
 * Relatório diário — Barragens SC + Rio Blumenau + Barra do Itajaí
 *
 * Lê os dados mais recentes do Supabase e envia um resumo completo
 * para o grupo Telegram. Sem Playwright — apenas leitura do banco.
 *
 * Roda via GitHub Actions todo dia às 10h BRT (13:00 UTC).
 */
import { createClient } from "@supabase/supabase-js";

const TG_TOKEN = process.env.TELEGRAM_TOKEN ?? "";
const TG_GRUPO = (process.env.TELEGRAM_BARRAGENS_CHAT_IDS || process.env.TELEGRAM_BARRA_CHAT_IDS || "")
  .split(",").map((s: string) => s.trim()).filter(Boolean);

function emojiStatus(s: string): string {
  const sl = s.toLowerCase();
  if (sl === "emergencia" || sl.includes("fechad")) return "🔴";
  if (sl === "alerta")                               return "🟠";
  if (sl === "atencao" || sl.includes("restri"))     return "🟡";
  if (sl === "normal"  || sl.includes("praticáv") || sl.includes("praticav")) return "🟢";
  return "⚪";
}

function labelStatus(s: string): string {
  if (s === "emergencia") return "CRÍTICA";
  if (s === "alerta")     return "ALERTA";
  if (s === "atencao")    return "ATENÇÃO";
  if (s === "normal")     return "Normal";
  return s;
}

function fmtHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

async function sendTelegram(msg: string) {
  if (!TG_TOKEN || TG_GRUPO.length === 0) {
    console.warn("[telegram] grupo não configurado — nenhum chat_id encontrado");
    return;
  }
  for (const chat of TG_GRUPO) {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: msg, parse_mode: "HTML" }),
    }).catch(e => console.warn(`[telegram] erro ${chat}:`, e));
  }
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const [{ data: pontos }, { data: barra }] = await Promise.all([
    supabase.from("barragens_monitoramento").select("*").order("tipo").order("nome"),
    supabase.from("barra_status").select("profundidade, atualizado_em").eq("id", 1).single(),
  ]);

  const horaBR = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

  let msg = `📊 <b>Relatório diário — Monitoramento</b>\n`;
  msg += `📅 ${horaBR} BRT\n`;

  // ── Barragens SC ──────────────────────────────────────────────────────────
  const barragens = (pontos ?? []).filter(r => r.tipo === "barragem");
  if (barragens.length > 0) {
    msg += `\n🏔️ <b>BARRAGENS SC</b>\n`;
    for (const b of barragens) {
      msg += `${emojiStatus(b.status)} <b>${b.nome}</b> — ${labelStatus(b.status)}\n`;
      if (b.nivel_m)        msg += `  Nível: ${b.nivel_m} m\n`;
      if (b.capacidade_pct) msg += `  Capacidade: ${b.capacidade_pct}%\n`;
      msg += `  Comportas: ${b.comportas_abertas ?? "—"} abertas / ${b.comportas_fechadas ?? "—"} fechadas\n`;
      msg += `  Leitura: ${fmtHora(b.hora_leitura)}\n`;
    }
  }

  // ── Rio Itajaí em Blumenau ────────────────────────────────────────────────
  const rios = (pontos ?? []).filter(r => r.tipo === "rio");
  if (rios.length > 0) {
    msg += `\n🌊 <b>RIO ITAJAÍ</b>\n`;
    for (const r of rios) {
      msg += `${emojiStatus(r.status)} <b>${r.nome}</b> — ${labelStatus(r.status)}\n`;
      if (r.nivel_m) msg += `  Nível: ${r.nivel_m} m\n`;
      msg += `  Leitura: ${fmtHora(r.hora_leitura)}\n`;
    }
  }

  // ── Barra do Itajaí ───────────────────────────────────────────────────────
  if (barra?.profundidade) {
    const e = emojiStatus(barra.profundidade);
    msg += `\n⚓ <b>BARRA DO ITAJAÍ</b>\n`;
    msg += `${e} ${barra.profundidade}\n`;
    msg += `  Atualizado: ${fmtHora(barra.atualizado_em)}\n`;
  }

  msg += `\n🔗 monitoramento.defesacivil.sc.gov.br/barragens`;

  await sendTelegram(msg);
  console.log(`[report-diario] enviado para ${TG_GRUPO.length} chat(s)`);
}

main().catch(e => { console.error(e); process.exit(1); });

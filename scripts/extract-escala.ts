/**
 * Extrator de FATURAMENTO do EscalaSoft (painel de inteligência de negócio, painel 236).
 *
 * Faz login headless e lê os totais do painel:
 *   - Faturamento anual Terminal / Depot (ano corrente)
 *   - Mês corrente Terminal / Depot
 *   - Serviço de terminal pendente de faturamento (a faturar)
 *
 * As somas (total terminal+depot) são calculadas na exibição.
 *
 * Variáveis de ambiente:
 *   ESCALA_LOGIN_URL   (default login.php do escala)
 *   ESCALA_PAINEL_URL  (default visualizarpainel.php?236)
 *   ESCALA_LOGIN / ESCALA_SENHA
 *   ANO                (default ano atual)
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const LOGIN_URL = process.env.ESCALA_LOGIN_URL || "https://escala.alslog.com.br:9000/view/estrutura/login.php";
const PAINEL_URL = process.env.ESCALA_PAINEL_URL || "https://escala.alslog.com.br:9000/view/inteligencianegocio/visualizarpainel.php?236";
const ANO = parseInt(process.env.ANO || String(new Date().getFullYear()), 10);

type Row = { fonte: string; code: string; titulo: string | null; serie: string; eixo: string; ano: number; valor: number | null };
type Tabela = { h: string; rows: string[][] };

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

/** "2.603.281,54" -> 2603281.54 */
function num(s: string | undefined): number | null {
  if (!s) return null;
  const v = parseFloat(String(s).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(v) ? v : null;
}

async function main() {
  const login = requireEnv("ESCALA_LOGIN");
  const senha = requireEnv("ESCALA_SENHA");
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  // shim p/ o helper __name que o tsx/esbuild injeta em funções nomeadas dentro de page.evaluate
  await page.addInitScript({ content: 'globalThis.__name = globalThis.__name || (function (f) { return f; });' });
  try {
    // 1) Login (genérico: primeiro input de texto + input de senha + enter)
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    await page.locator("input[type=password]").first().fill(senha);
    await page.locator("input[type=text], input[type=email], input:not([type])").first().fill(login);
    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }).catch(() => {}),
      (async () => {
        const btn = page.locator('button[type=submit], input[type=submit], button:has-text("Entrar"), button:has-text("Acessar"), button:has-text("Login")');
        if (await btn.count()) await btn.first().click();
        else await page.keyboard.press("Enter");
      })(),
    ]);
    await page.waitForTimeout(1500);
    if (/login\.php/i.test(page.url())) {
      throw new Error("Login no escala falhou — verifique ESCALA_LOGIN / ESCALA_SENHA.");
    }
    console.log("Login escala OK:", page.url());

    // 2) Painel 236
    await page.goto(PAINEL_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("table", { timeout: 25000 }).catch(() => {});

    // coleta tabelas de TODOS os frames (cada bloco do painel pode ser um iframe)
    const dumpFrames = async (): Promise<Tabela[]> => {
      const acc: Tabela[] = [];
      for (const f of page.frames()) {
        try {
          const ts: Tabela[] = await f.evaluate(() => {
            function heading(t: Element): string {
              let el: Element | null = t;
              let hops = 0;
              while (el && hops < 6) {
                let p = el.previousElementSibling;
                while (p) {
                  const tx = (p.textContent || "").replace(/\s+/g, " ").trim();
                  if (tx && tx.length < 90) return tx.slice(0, 90);
                  p = p.previousElementSibling;
                }
                el = el.parentElement;
                hops++;
              }
              return "";
            }
            return [...document.querySelectorAll("table")].map((t) => ({
              h: heading(t),
              rows: [...t.querySelectorAll("tr")].slice(0, 30).map((tr) =>
                [...tr.querySelectorAll("th,td")].map((c) => (c.textContent || "").replace(/\s+/g, " ").trim())
              ),
            }));
          });
          acc.push(...ts);
        } catch { /* frame sem acesso */ }
      }
      return acc;
    };

    // as tabelas preenchem via AJAX — faz polling até a de "anual depot" ter a linha Total
    let tabelas: Tabela[] = [];
    for (let i = 0; i < 14; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
      tabelas = await dumpFrames();
      const ad = tabelas.find((t) => /anual.*depot/.test((t.h || "").toLowerCase()));
      if (ad && ad.rows.some((r) => /total/i.test(r[0] || ""))) break;
      await page.waitForTimeout(2500);
    }
    console.log(`[debug] frames (${page.frames().length})`);
    console.log("[debug] resumo tabelas:", JSON.stringify(tabelas.map((t) => ({ h: t.h, n: t.rows.length, head: t.rows[0] }))).slice(0, 3500));

    // 4) Extração por heurística
    const acha = (re: RegExp) => tabelas.find((t) => re.test((t.h || "").toLowerCase()));
    const totalUltimaCol = (t?: Tabela) => {
      const r = t?.rows.find((row) => /total/i.test(row[0] || ""));
      return r ? num(r[r.length - 1]) : null;
    };

    const anualTerminal = totalUltimaCol(acha(/anual.*terminal/));
    const anualDepot = totalUltimaCol(acha(/anual.*depot/));

    const mesTab = acha(/terminal e depot/);
    const mesTotalRow = mesTab?.rows.find((row) => /total/i.test(row[0] || ""));
    const mesTerminal = mesTotalRow ? num(mesTotalRow[1]) : null;
    const mesDepot = mesTotalRow ? num(mesTotalRow[2]) : null;

    const aFatTab = acha(/pendente de faturamento/);
    let aFaturar: number | null = null;
    if (aFatTab) {
      const head = aFatTab.rows[0] || [];
      const vtIdx = head.findIndex((c) => /valor.*total/i.test(c));
      const totalsRow = aFatTab.rows[1] || [];
      aFaturar = vtIdx >= 0 ? num(totalsRow[vtIdx]) : null;
    }

    const mk = (code: string, titulo: string, valor: number | null): Row =>
      ({ fonte: "escala", code, titulo, serie: "Total", eixo: "Atual", ano: ANO, valor });

    const rows = [
      mk("FATURAMENTO_ANUAL_TERMINAL", "Faturamento anual Terminal", anualTerminal),
      mk("FATURAMENTO_ANUAL_DEPOT", "Faturamento anual Depot", anualDepot),
      mk("FATURAMENTO_MES_TERMINAL", "Faturamento do mês Terminal", mesTerminal),
      mk("FATURAMENTO_MES_DEPOT", "Faturamento do mês Depot", mesDepot),
      mk("FATURAMENTO_TERMINAL_AFATURAR", "Terminal a faturar", aFaturar),
    ];
    console.log("[debug] valores extraídos:", JSON.stringify(rows));

    const validas = rows.filter((r) => r.valor != null);
    if (!validas.length) throw new Error("Nenhum valor de faturamento extraído — ver dump acima para ajustar seletores.");

    const { error } = await supabase.from("bi_indicadores").upsert(rows, { onConflict: "code,serie,eixo,ano" });
    if (error) throw new Error(`Erro no upsert: ${error.message}`);
    console.log(`Concluído: ${validas.length}/${rows.length} valores de faturamento gravados (ano ${ANO}).`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("FALHA:", (e as Error).message);
  process.exit(1);
});

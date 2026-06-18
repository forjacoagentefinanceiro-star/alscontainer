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

  // captura requisições (ajuda a achar o endpoint que traz os dados de faturamento)
  const pedidos = new Set<string>();
  page.on("response", (r) => {
    const u = r.url();
    if (/(\.php|ajax|json|dados|consult|fatur)/i.test(u) && !/\.(css|js|png|jpe?g|svg|woff2?|ico)/i.test(u)) {
      pedidos.add(`${r.status()} ${r.request().method()} ${u}`.slice(0, 160));
    }
  });
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
    console.log(`[debug] frames (${page.frames().length}) | tabelas: ${tabelas.length}`);
    tabelas.forEach((t, i) => {
      const totalRow = t.rows.find((r) => /total/i.test(r[0] || ""));
      console.log(`[tab ${i}] n=${t.rows.length} h=${JSON.stringify((t.h || "").slice(0, 60))} head=${JSON.stringify(t.rows[0])} total=${JSON.stringify(totalRow || null)}`);
    });
    console.log("[debug] requests:", JSON.stringify([...pedidos].slice(0, 40)));

    // 4) Extração: cada widget tem [cabeçalho | corpo | total] em tabelas separadas.
    // Acha a tabela do título e pega a linha "Total" nas tabelas seguintes.
    const idx = (re: RegExp) => tabelas.findIndex((t) => re.test((t.h || "").toLowerCase()));
    const totalRowApos = (i: number, minCells: number): string[] | null => {
      if (i < 0) return null;
      for (let j = i; j < Math.min(tabelas.length, i + 3); j++) {
        const r = tabelas[j].rows.find((row) => /^total$/i.test((row[0] || "").trim()) && row.length >= minCells);
        if (r) return r;
      }
      return null;
    };

    const rDepot = totalRowApos(idx(/faturamento anual depot/), 5);
    const rTerminal = totalRowApos(idx(/faturamento anual terminal/), 5);
    const anualDepot = rDepot ? num(rDepot[rDepot.length - 1]) : null; // última coluna = ano corrente
    const anualTerminal = rTerminal ? num(rTerminal[rTerminal.length - 1]) : null;

    const rMes = totalRowApos(idx(/terminal e depot/), 3);
    const mesTerminal = rMes ? num(rMes[1]) : null;
    const mesDepot = rMes ? num(rMes[2]) : null;

    // "Serviço de terminal pendente de faturamento": pega o total da coluna Valortotalcobrar
    let aFaturar: number | null = null;
    const pi = idx(/pendente de faturamento/);
    if (pi >= 0) {
      const header = tabelas[pi].rows[0] || [];
      const vtIdx = header.findIndex((c) => /valor.*total/i.test(c));
      if (vtIdx >= 0) {
        for (let j = pi; j < Math.min(tabelas.length, pi + 4); j++) {
          const tr = tabelas[j].rows.find((row) => (row[0] || "").trim() === "" && num(row[vtIdx]) != null);
          if (tr) { aFaturar = num(tr[vtIdx]); break; }
        }
      }
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

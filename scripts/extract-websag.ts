/**
 * Extrator do BI web da eProfessional (websag.../bi).
 *
 * Faz login headless (credenciais via variáveis de ambiente — NUNCA hardcode),
 * chama os endpoints Dashboard/Get... que devolvem JSON agregado, transforma os
 * "charts" em linhas (série × mês × ano) e faz upsert na tabela bi_indicadores.
 *
 * Rodar local:  npm i -D playwright tsx && npx playwright install chromium
 *               npx tsx scripts/extract-websag.ts
 * Agendado:     .github/workflows/extract-websag.yml (instala as deps no CI)
 *
 * Variáveis de ambiente:
 *   WEBSAG_URL                 (opcional, default http://websag.transportesals.com.br/bi)
 *   WEBSAG_LOGIN / WEBSAG_SENHA / WEBSAG_CHAVE
 *   ANO                        (opcional, default = ano atual)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (escrita na tabela; pegue em Supabase → Settings → API)
 */
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = (process.env.WEBSAG_URL || "http://websag.transportesals.com.br/bi").replace(/\/$/, "");
const ANO = parseInt(process.env.ANO || String(new Date().getFullYear()), 10);

// Endpoints que retornam JSON agregado sem precisar de parâmetro.
// (os "...CNTR" foram omitidos: exigem informar um nº de container)
const ENDPOINTS = [
  "GetMovimentacoesEntrada",
  "GetMovimentacoesEntradaTeus",
  "GetMovimentacoesEntradaArmadorTeus",
  "GetMovimentacoesSaida",
  "GetMovimentacoesSaidaTeus",
  "GetMovimentacoesSaidaArmadorTeus",
  "GetOcupacaoPatio",
  "GetOcupacaoPatioArmadorTeus",
  "GetVistoriasPatioTeus",
  "GetVistoriasPatioPeriodo",
  "GetVistoriasPatioArmadorTeus",
  "GetReparosPatioTeus",
  "GetReparosPatioPeriodo",
  "GetReparosPatioArmadorTeus",
  "GetPermanenciasVeiculoExpTeus",
  "GetPermanenciasVeiculoExpArmadorTeus",
  "GetPermanenciasVeiculoExpPeriodo",
  "GetPermanenciasVeiculoExpArmadorPeriodo",
  "GetPermanenciasVeiculoImpTeus",
  "GetPermanenciasVeiculoImpArmadorTeus",
  "GetPermanenciasVeiculoImpPeriodo",
  "GetPermanenciasVeiculoImpArmadorPeriodo",
];

type Chart = { label?: string | number; code?: string | number; xAxisData?: number[]; data?: number[] };
type Content = { code?: string; title?: string; xAxisColumns?: string[]; charts?: Chart[] };
type ApiResp = { Success?: boolean; Error?: string | null; Content?: Content };
type Row = { fonte: string; code: string; titulo: string | null; serie: string; eixo: string; ano: number; valor: number | null };

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

function flatten(name: string, resp: ApiResp): Row[] {
  const c = resp?.Content;
  if (!c || !Array.isArray(c.charts)) return [];
  const eixos = c.xAxisColumns ?? [];
  const rows: Row[] = [];
  for (const chart of c.charts) {
    const serie = String(chart.label ?? chart.code ?? "série").trim();
    const data = chart.xAxisData ?? chart.data ?? [];
    eixos.forEach((eixo, i) => {
      rows.push({
        fonte: "websag",
        code: c.code || name,
        titulo: c.title ?? null,
        serie,
        eixo,
        ano: ANO,
        valor: typeof data[i] === "number" ? data[i] : null,
      });
    });
  }
  return rows;
}

/**
 * Captura os tiles "Estimativas" (Pendentes/Finalizadas) da Televisão.
 * O número alterna entre contexto de vistoria e de reparo reusando o mesmo span;
 * observamos a rotação e logamos a estrutura (o log do CI não tem filtro), para
 * identificar/validar qual valor é de vistoria.
 */
async function coletaEstimativas(page: Page): Promise<Row[]> {
  const rows: Row[] = [];
  const mk = (code: string, titulo: string, serie: string, valor: number | null): Row => ({
    fonte: "websag",
    code,
    titulo,
    serie,
    eixo: "Atual",
    ano: ANO,
    valor,
  });
  try {
    await page.goto(`${BASE}/Dashboard/Television`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[name="estimativa-quantidade-pendente"]', { timeout: 20000 });

    // debug: estrutura do bloco (vai pro log do Actions, sem filtro de privacidade)
    const box = await page.evaluate(() => {
      let b: Element | null = document.querySelector('[name="estimativa-quantidade-pendente"]');
      for (let i = 0; i < 6 && b?.parentElement; i++) b = b.parentElement;
      return b ? b.outerHTML.replace(/\s+/g, " ").slice(0, 1500) : null;
    });
    console.log("  [debug] bloco Estimativas:", box);

    // observa a rotação por ~90s, registrando snapshots quando o valor muda
    const snaps: { pend: number | null; fin: number | null; ctxHtml: string }[] = [];
    let prev = "";
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const s = await page.evaluate(() => {
        const toNum = (el: Element | null) => {
          const t = (el?.textContent || "").replace(/[^\d]/g, "");
          return t ? parseInt(t, 10) : null;
        };
        const pendEl = document.querySelector('[name="estimativa-quantidade-pendente"]');
        const carregando = (pendEl?.textContent || "").toLowerCase().includes("carreg");
        let b: Element | null = pendEl;
        for (let i = 0; i < 6 && b?.parentElement; i++) b = b.parentElement;
        return {
          pend: toNum(pendEl),
          fin: toNum(document.querySelector('[name="estimativa-quantidade-finalizada"]')),
          carregando,
          ctxHtml: (b?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
        };
      });
      if (!s.carregando) {
        const key = `${s.pend}|${s.fin}|${s.ctxHtml}`;
        if (key !== prev) {
          snaps.push({ pend: s.pend, fin: s.fin, ctxHtml: s.ctxHtml });
          prev = key;
        }
      }
      if (snaps.length >= 4) break;
      await page.waitForTimeout(1500);
    }
    console.log("  [debug] snapshots Estimativas:", JSON.stringify(snaps));

    // melhor esforço: tenta rotular pelo texto do contexto; senão guarda os valores vistos
    const vist = snaps.find((s) => /vistoria/i.test(s.ctxHtml));
    const rep = snaps.find((s) => /reparo/i.test(s.ctxHtml));
    if (vist) {
      rows.push(mk("ESTIMATIVA_PENDENTE_VISTORIA", "Aguardando vistoria", "Pendentes", vist.pend));
      rows.push(mk("ESTIMATIVA_FINALIZADA_VISTORIA", "Vistorias finalizadas", "Finalizadas", vist.fin));
    }
    if (rep) {
      rows.push(mk("ESTIMATIVA_PENDENTE_REPARO", "Aguardando reparo", "Pendentes", rep.pend));
      rows.push(mk("ESTIMATIVA_FINALIZADA_REPARO", "Reparos finalizados", "Finalizadas", rep.fin));
    }
    if (!vist && snaps.length) {
      // fallback enquanto o rótulo de contexto não é identificado
      rows.push(mk("ESTIMATIVA_PENDENTE", "Aguardando vistoria (estimativa)", "Pendentes", snaps[0].pend));
    }
    console.log(`  ✓ Estimativas TV: ${rows.length} valores (snaps: ${snaps.length})`);
  } catch (e) {
    console.warn("  ! Estimativas TV não capturadas:", (e as Error).message);
  }
  return rows;
}

async function main() {
  const login = requireEnv("WEBSAG_LOGIN");
  const senha = requireEnv("WEBSAG_SENHA");
  const chave = process.env.WEBSAG_CHAVE || "";
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

  const browser = await chromium.launch();
  const page = await browser.newPage();
  // shim p/ o helper __name que o tsx/esbuild injeta em funções nomeadas dentro de page.evaluate
  await page.addInitScript({ content: 'globalThis.__name = globalThis.__name || (function (f) { return f; });' });
  try {
    // 1) Login
    await page.goto(`${BASE}/Authentication/Login`, { waitUntil: "domcontentloaded" });
    await page.fill("#login-input", login);
    await page.fill("#senha-input", senha);
    if (chave) await page.fill("#chave-acesso-input", chave);
    await Promise.all([
      page
        .waitForURL((u) => !/Authentication\/Login/i.test(u.toString()), { timeout: 30000 })
        .catch(() => {}),
      page.click('button:has-text("ENTRAR"), input[value="ENTRAR"], [type=submit]'),
    ]);
    await page.waitForTimeout(1500);
    if (/Authentication\/Login/i.test(page.url())) {
      throw new Error("Login falhou — verifique WEBSAG_LOGIN / WEBSAG_SENHA / WEBSAG_CHAVE.");
    }
    console.log("Login OK:", page.url());

    // 2) Coleta os endpoints já autenticado (usa os cookies da sessão)
    const all: Row[] = [];
    for (const name of ENDPOINTS) {
      const resp = (await page.evaluate(async (url) => {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "X-Requested-With": "XMLHttpRequest",
            },
            body: "",
          });
          const txt = await r.text();
          try {
            return JSON.parse(txt);
          } catch {
            return null;
          }
        } catch {
          return null;
        }
      }, `${BASE}/Dashboard/${name}`)) as ApiResp | null;

      if (!resp || resp.Success === false || !resp.Content) {
        console.warn(`  ! ${name}: sem dados (pode exigir parâmetro ou estar vazio)`);
        continue;
      }
      const rows = flatten(name, resp);
      all.push(...rows);
      console.log(`  ✓ ${name}: ${rows.length} pontos`);
    }

    // tiles "Estimativas" da Televisão (aguardando vistoria / reparo)
    all.push(...(await coletaEstimativas(page)));

    if (!all.length) throw new Error("Nenhum indicador coletado.");

    // 3) Upsert (idempotente por code+serie+eixo+ano) — captured_at = agora (senão não atualiza no update)
    const agora = new Date().toISOString();
    for (let i = 0; i < all.length; i += 500) {
      const lote = all.slice(i, i + 500).map((r) => ({ ...r, captured_at: agora }));
      const { error } = await supabase
        .from("bi_indicadores")
        .upsert(lote, { onConflict: "code,serie,eixo,ano" });
      if (error) throw new Error(`Erro no upsert: ${error.message}`);
    }
    console.log(`\nConcluído: ${all.length} indicadores gravados (ano ${ANO}).`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("FALHA:", (e as Error).message);
  process.exit(1);
});

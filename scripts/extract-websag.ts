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
import { chromium } from "playwright";
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

type Chart = { label?: string; code?: string; xAxisData?: number[]; data?: number[] };
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
    const serie = (chart.label || chart.code || "série").trim();
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

    if (!all.length) throw new Error("Nenhum indicador coletado.");

    // 3) Upsert (idempotente por code+serie+eixo+ano)
    for (let i = 0; i < all.length; i += 500) {
      const { error } = await supabase
        .from("bi_indicadores")
        .upsert(all.slice(i, i + 500), { onConflict: "code,serie,eixo,ano" });
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

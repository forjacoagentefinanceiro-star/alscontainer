-- Tabela de setores — lista mestre cadastrada pelo admin.
-- Usada como fonte de dados para dropdowns em equipamentos e usuários.
CREATE TABLE IF NOT EXISTS setores (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  created_at timestamptz default now(),
  unique (nome)
);

ALTER TABLE setores ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário logado (necessário para os dropdowns)
CREATE POLICY "setores: leitura por autenticados"
  ON setores FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Escrita: apenas via service_role (server actions com createClient usam o token do usuário;
--          admin é verificado na action, não via RLS de write)
-- Nota: as actions de insert/delete verificam role='admin' antes de executar.

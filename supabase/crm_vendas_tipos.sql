-- Classificação dos containers à venda (tipo A/B/C) com preço automático.
-- Rodar UMA vez no SQL Editor do Supabase (depois de crm_vendas.sql e crm_vendas_estoque.sql). Idempotente.
-- Só ADMIN altera os tipos e preços; ninguém digita preço por unidade.

create table if not exists cv_tipos (
  codigo    text primary key,            -- A, B, C...
  nome      text not null,
  descricao text,
  preco     numeric(12,2) not null,
  ordem     int not null default 0
);

alter table containers add column if not exists tipo_venda text references cv_tipos(codigo) on update cascade on delete set null;

-- Valores iniciais (SUGESTÃO dentro da faixa R$ 10.300 a R$ 11.400): ajuste em Vendas > Tipos e preços
insert into cv_tipos (codigo, nome, descricao, preco, ordem) values
  ('A', 'Tipo A', 'Melhor estado / mais novo', 11400, 1),
  ('B', 'Tipo B', 'Estado intermediário', 10850, 2),
  ('C', 'Tipo C', 'Mais antigo / mais marcas de uso', 10300, 3)
on conflict (codigo) do nothing;

alter table cv_tipos enable row level security;
drop policy if exists cv_tipos_leitura on cv_tipos;
create policy cv_tipos_leitura on cv_tipos for select to authenticated using (true);
drop policy if exists cv_tipos_admin on cv_tipos;
create policy cv_tipos_admin on cv_tipos for all to authenticated
  using (exists (select 1 from user_profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from user_profiles p where p.id = auth.uid() and p.role = 'admin'));

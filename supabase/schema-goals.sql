-- Tabela de metas de compra
create table if not exists purchase_goals (
  id         uuid primary key default gen_random_uuid(),
  quantidade integer not null,
  orcamento  numeric(14,2) not null,
  prazo      date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table purchase_goals enable row level security;

-- Qualquer aprovado lê a meta
create policy "approved read goals"
  on purchase_goals for select
  using (
    exists (select 1 from user_profiles where id = auth.uid() and approved = true)
  );

-- Só admin insere
create policy "admin insert goals"
  on purchase_goals for insert
  with check (
    exists (select 1 from user_profiles where id = auth.uid() and approved = true and role = 'admin')
  );

-- Só admin atualiza
create policy "admin update goals"
  on purchase_goals for update
  using (
    exists (select 1 from user_profiles where id = auth.uid() and approved = true and role = 'admin')
  );

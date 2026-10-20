-- Liga o estoque (containers) ao CRM de vendas.
-- Rodar UMA vez no SQL Editor do Supabase (depois de crm_vendas.sql). Idempotente.

alter table containers add column if not exists para_venda boolean not null default false;
alter table containers add column if not exists preco_anuncio numeric(12,2);

alter table cv_leads add column if not exists container_id uuid references containers(id) on delete set null;
create index if not exists cv_leads_container_idx on cv_leads(container_id);

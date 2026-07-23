-- Inscrições no bot Telegram — controle por tópico
create table if not exists telegram_subscriptions (
  chat_id           text primary key,
  username          text,
  nome              text,
  ativo             boolean default true,
  recebe_barragens  boolean default true,
  recebe_rio        boolean default true,
  recebe_barra      boolean default true,
  eh_grupo          boolean default false,
  criado_em         timestamptz default now()
);

-- Adiciona colunas novas se a tabela já existia sem elas
alter table telegram_subscriptions
  add column if not exists recebe_barragens  boolean default true,
  add column if not exists recebe_rio         boolean default true,
  add column if not exists recebe_barra       boolean default true,
  add column if not exists eh_grupo           boolean default false;

-- Sem RLS — gerenciado via service_role pelo webhook e pelos extratores
-- Para inserir um grupo Telegram manualmente (chat_id começa com -):
-- INSERT INTO telegram_subscriptions (chat_id, nome, eh_grupo, recebe_barragens, recebe_rio, recebe_barra)
-- VALUES ('-1009999999999', 'Grupo Barragens SC', true, true, true, false)
-- ON CONFLICT (chat_id) DO UPDATE SET ativo = true, eh_grupo = true;

NOTIFY pgrst, 'reload schema';

-- Inscrições no bot Telegram para alertas de barragens
create table if not exists telegram_subscriptions (
  chat_id    text primary key,
  username   text,
  nome       text,
  ativo      boolean default true,
  criado_em  timestamptz default now()
);

-- Sem RLS — gerenciado via service_role pelo webhook
NOTIFY pgrst, 'reload schema';

-- Adiciona campo nacionalizado à tabela containers
alter table containers add column if not exists nacionalizado boolean not null default false;

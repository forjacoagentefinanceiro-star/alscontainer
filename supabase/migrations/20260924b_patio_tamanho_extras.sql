-- Mapa do Pátio: pilhas de 20'/40' (lados A e B) e pilhas novas desenhadas no mapa
-- Execute no SQL Editor do Supabase (depois de 20260924_patio_posicoes.sql)

alter table patio_posicoes
  add column if not exists tamanho text not null default '40' check (tamanho in ('20','40')),
  add column if not exists x   real,   -- pilha nova: posição na foto (pixels 1024×628); null = pilha do levantamento
  add column if not exists y   real,
  add column if not exists ang real;   -- rotação em graus

alter table patio_historico
  add column if not exists tamanho text,
  add column if not exists acao    text;  -- 'alterou' | 'removeu'

-- remover pilha nova / juntar 20' de volta em 40'
drop policy if exists "patio remove posicoes" on patio_posicoes;
create policy "patio remove posicoes" on patio_posicoes for delete using (public.tem_modulo_patio());

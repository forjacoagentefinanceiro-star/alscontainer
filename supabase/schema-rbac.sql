-- ============================================================
-- 1. Tabela de perfis de usuário
-- ============================================================
create table if not exists user_profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  email     text not null,
  name      text not null default '',
  role      text not null default 'viewer' check (role in ('admin','editor','viewer')),
  approved  boolean not null default false,
  created_at timestamptz default now()
);

alter table user_profiles enable row level security;

-- Qualquer autenticado lê perfis (admin precisa ver a lista)
create policy "authenticated read profiles"
  on user_profiles for select
  using (auth.role() = 'authenticated');

-- Usuário insere o próprio perfil no signup
create policy "insert own profile"
  on user_profiles for insert
  with check (auth.uid() = id);

-- Só admin aprovado pode atualizar perfis
create policy "admin update profiles"
  on user_profiles for update
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin' and approved = true
    )
  );

-- ============================================================
-- 2. Trigger: cria perfil automaticamente no signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, approved, role)
  values (new.id, new.email, false, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 3. Política de containers: qualquer usuário aprovado
-- ============================================================
drop policy if exists "user owns containers" on containers;
drop policy if exists "authenticated users access containers" on containers;

create policy "approved users read containers"
  on containers for select
  using (
    exists (select 1 from user_profiles where id = auth.uid() and approved = true)
  );

create policy "editor or admin write containers"
  on containers for insert
  with check (
    exists (select 1 from user_profiles where id = auth.uid() and approved = true and role in ('admin','editor'))
  );

create policy "editor or admin update containers"
  on containers for update
  using (
    exists (select 1 from user_profiles where id = auth.uid() and approved = true and role in ('admin','editor'))
  );

create policy "editor or admin delete containers"
  on containers for delete
  using (
    exists (select 1 from user_profiles where id = auth.uid() and approved = true and role in ('admin','editor'))
  );

-- ============================================================
-- 4. Aprovar manualmente o primeiro admin (SEU usuário)
--    Substitua o email abaixo pelo seu
-- ============================================================
insert into user_profiles (id, email, role, approved)
select id, email, 'admin', true
from auth.users
where email = 'anderson.melies@alslog.com.br'
on conflict (id) do update set role = 'admin', approved = true;

-- Telemetria J1939 das máquinas (Kone Crane, Ferrari Loader, Linde Reach Stacker)
create table if not exists telemetria_maquinas (
  id               uuid primary key default gen_random_uuid(),
  maquina          text not null,              -- 'kone' | 'ferrari' | 'linde'
  dispositivo      text not null,              -- nome BLE do ESP32, ex: 'ALS-Kone-01'
  rpm              numeric(8,1),
  carga_pct        numeric(5,1),
  horimetro_h      numeric(10,2),
  temp_c           numeric(5,1),
  pressao_kpa      numeric(6,1),
  combustivel_pct  numeric(5,1),
  dtc              text,
  latitude         numeric(10,7),
  longitude        numeric(10,7),
  created_at       timestamptz default now()
);

create index if not exists telemetria_maquinas_maquina_idx
  on telemetria_maquinas (maquina, created_at desc);

alter table telemetria_maquinas enable row level security;

-- Tablet da máquina insere sem login (anon key) — só grava, não pode ler/alterar outras linhas
create policy "anon insert telemetria"
  on telemetria_maquinas for insert
  to anon
  with check (true);

-- Qualquer usuário aprovado do ALS Containers lê a telemetria
create policy "approved read telemetria"
  on telemetria_maquinas for select
  using (
    exists (select 1 from user_profiles where id = auth.uid() and approved = true)
  );

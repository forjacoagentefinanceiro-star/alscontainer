-- Configuração de ciclo independente por setor.
-- Quando um setor tem linha aqui, usa os valores desta tabela.
-- Setores sem linha usam o global em config_equipamentos.
CREATE TABLE IF NOT EXISTS config_ciclo_setor (
  setor              text    PRIMARY KEY,
  horas_meta_ciclo   numeric NOT NULL DEFAULT 0,
  dia_inicio_ciclo   integer NOT NULL DEFAULT 23
);

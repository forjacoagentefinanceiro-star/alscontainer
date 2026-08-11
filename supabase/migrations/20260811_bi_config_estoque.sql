CREATE TABLE IF NOT EXISTS bi_config_estoque (
  id               integer PRIMARY KEY DEFAULT 1,
  estoque_inicial  integer NOT NULL DEFAULT 0,
  data_referencia  date    NOT NULL DEFAULT CURRENT_DATE,
  capacidade       integer NOT NULL DEFAULT 0   -- 0 = sem capacidade configurada
);
-- Garante que sempre há uma linha
INSERT INTO bi_config_estoque (id) VALUES (1) ON CONFLICT DO NOTHING;

-- RLS
CREATE POLICY "leitura_bi_config_estoque" ON bi_config_estoque
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "escrita_bi_config_estoque" ON bi_config_estoque
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','editor') AND approved = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','editor') AND approved = true)
  );

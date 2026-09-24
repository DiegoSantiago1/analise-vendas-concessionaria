-- =====================================================================
-- Migração 001: integridade no banco + índices para filtro por faixa.
--
-- Para quem já tem o banco criado com a versão anterior do schema.sql
-- (o docker-entrypoint só roda o schema.sql em volume vazio). Quem sobe
-- o projeto do zero não precisa disto: o schema.sql já vem atualizado.
--
-- Uso:
--   docker exec -i honda-vendas-db psql -U honda -d vendas_honda -v ON_ERROR_STOP=1 \
--       < db/migracoes/001_integridade_e_indices.sql
--
-- Roda numa transação: se qualquer passo falhar (por exemplo, dado antigo
-- que viola a nova regra), nada é aplicado.
-- =====================================================================
BEGIN;

-- Alvos das chaves estrangeiras compostas.
ALTER TABLE gerentes   ADD CONSTRAINT uq_gerentes_id_loja   UNIQUE (id, loja_id);
ALTER TABLE vendedores ADD CONSTRAINT uq_vendedores_id_loja UNIQUE (id, loja_id);

-- Gerente do vendedor precisa ser da mesma loja.
ALTER TABLE vendedores DROP CONSTRAINT vendedores_gerente_id_fkey;
ALTER TABLE vendedores ADD CONSTRAINT fk_vendedores_gerente_loja
    FOREIGN KEY (gerente_id, loja_id) REFERENCES gerentes (id, loja_id)
    ON DELETE SET NULL (gerente_id);

-- Sem vendedor duplicado (mesmo nome, sem diferenciar caixa) na mesma loja.
CREATE UNIQUE INDEX uq_vendedores_loja_nome ON vendedores (loja_id, lower(nome));

-- Venda: vendedor e gerente precisam ser da loja da venda.
ALTER TABLE vendas DROP CONSTRAINT vendas_vendedor_id_fkey;
ALTER TABLE vendas DROP CONSTRAINT vendas_gerente_id_fkey;
ALTER TABLE vendas ADD CONSTRAINT fk_vendas_vendedor_loja
    FOREIGN KEY (vendedor_id, loja_id) REFERENCES vendedores (id, loja_id);
ALTER TABLE vendas ADD CONSTRAINT fk_vendas_gerente_loja
    FOREIGN KEY (gerente_id, loja_id) REFERENCES gerentes (id, loja_id);

-- Índice composto no lugar do índice só por loja (é prefixo dele).
CREATE INDEX idx_vendas_loja_criado_em ON vendas (loja_id, criado_em);
DROP INDEX idx_vendas_loja_id;

-- View com filtro de mês por faixa, que aproveita o índice.
CREATE OR REPLACE VIEW vw_metas_mes_atual AS
SELECT
    l.id   AS loja_id,
    l.nome AS loja_nome,
    l.equipe_apelido,
    l.meta_mensal,
    COALESCE(SUM(v.quantidade), 0) AS acumulado,
    ROUND(
        COALESCE(SUM(v.quantidade), 0)::NUMERIC
        / NULLIF(l.meta_mensal, 0) * 100,
        1
    ) AS percentual_meta
FROM lojas l
LEFT JOIN vendas v
    ON v.loja_id = l.id
    AND v.criado_em >= date_trunc('month', now())
    AND v.criado_em <  date_trunc('month', now()) + interval '1 month'
GROUP BY l.id, l.nome, l.equipe_apelido, l.meta_mensal
ORDER BY acumulado DESC;

COMMIT;

-- =====================================================================
-- Fuso horário: por padrão, o Postgres roda em UTC no container. Sem
-- isso, perto da virada do dia (21h-24h em Recife = 00h-03h UTC), uma
-- venda lançada "à noite de ontem" apareceria como se fosse de amanhã
-- em qualquer consulta que use CURRENT_DATE ou now() - errado para um
-- negócio que opera em horário do Brasil.
-- =====================================================================
ALTER DATABASE vendas_honda SET timezone TO 'America/Recife';

-- =====================================================================
-- Schema: Painel de Vendas - Grupo Horizonte Honda (dados fictícios)
--
-- Modelo relacional para o feirão de vendas: lojas, equipe comercial,
-- modelos de veículo e o registro de cada venda. Desenhado para
-- responder às perguntas de negócio do projeto:
--   - Quanto foi vendido hoje / na semana / no mês, por loja e por
--     vendedor?
--   - Cada loja está batendo a meta?
--   - Qual o faturamento e o ticket médio por modelo / loja / vendedor?
--   - Qual a forma de pagamento mais usada?
-- =====================================================================

-- ---------------------------------------------------------------------
-- lojas: cada unidade da rede, com a meta de veículos do mês.
-- ---------------------------------------------------------------------
CREATE TABLE lojas (
    id              SERIAL PRIMARY KEY,
    nome            TEXT NOT NULL UNIQUE,
    cidade          TEXT NOT NULL,
    equipe_apelido  TEXT,                       -- nome da equipe pro painel (ex.: "Equipe Águia")
    meta_mensal     INT NOT NULL CHECK (meta_mensal >= 0)
);

-- ---------------------------------------------------------------------
-- gerentes: um gerente responde por uma loja.
-- ---------------------------------------------------------------------
CREATE TABLE gerentes (
    id       SERIAL PRIMARY KEY,
    nome     TEXT NOT NULL,
    loja_id  INT NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
    -- (id, loja_id) é único de propósito: serve de alvo para as chaves
    -- estrangeiras compostas abaixo, que amarram gerente e loja.
    CONSTRAINT uq_gerentes_id_loja UNIQUE (id, loja_id)
);

-- ---------------------------------------------------------------------
-- vendedores: pertence a uma loja; o gerente é opcional (nem toda loja
-- tem um gerente cadastrado ainda, no dia a dia real isso acontece).
--
-- Integridade garantida pelo banco, não só pela API:
--   - o gerente precisa ser da MESMA loja do vendedor (FK composta);
--   - não existem dois vendedores com o mesmo nome na mesma loja
--     (índice único sem diferenciar maiúscula/minúscula).
-- ON DELETE SET NULL (gerente_id) zera só o gerente: sem a lista de
-- colunas o Postgres tentaria zerar também loja_id, que é NOT NULL.
-- ---------------------------------------------------------------------
CREATE TABLE vendedores (
    id          SERIAL PRIMARY KEY,
    nome        TEXT NOT NULL,
    loja_id     INT NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
    gerente_id  INT,
    CONSTRAINT uq_vendedores_id_loja UNIQUE (id, loja_id),
    CONSTRAINT fk_vendedores_gerente_loja
        FOREIGN KEY (gerente_id, loja_id) REFERENCES gerentes (id, loja_id)
        ON DELETE SET NULL (gerente_id)
);
CREATE UNIQUE INDEX uq_vendedores_loja_nome ON vendedores (loja_id, lower(nome));

-- ---------------------------------------------------------------------
-- modelos: catálogo de veículos Honda vendidos, com preço de tabela
-- (valor aproximado e ilustrativo, usado só para calcular faturamento
-- estimado nas análises - não é uma tabela de preços oficial).
-- ---------------------------------------------------------------------
CREATE TABLE modelos (
    id             SERIAL PRIMARY KEY,
    nome           TEXT NOT NULL UNIQUE,
    categoria      TEXT NOT NULL,                -- Sedan, Hatch, SUV
    preco_tabela   NUMERIC(12,2) NOT NULL CHECK (preco_tabela > 0)
);

-- ---------------------------------------------------------------------
-- vendas: uma linha por venda registrada. valor_unitario é copiado do
-- preço do modelo no momento da venda (histórico não muda se o preço
-- do modelo for atualizado depois - é assim que funciona em sistemas
-- de vendas reais).
--
-- As FKs compostas impedem, no próprio banco, uma venda cujo vendedor
-- (ou gerente) pertença a outra loja. Com MATCH SIMPLE (o padrão), a FK
-- do gerente é ignorada quando gerente_id é NULL, que é permitido.
-- ---------------------------------------------------------------------
CREATE TABLE vendas (
    id               SERIAL PRIMARY KEY,
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
    loja_id          INT NOT NULL REFERENCES lojas(id),
    vendedor_id      INT NOT NULL,
    gerente_id       INT,
    modelo_id        INT NOT NULL REFERENCES modelos(id),
    quantidade       INT NOT NULL CHECK (quantidade > 0),
    valor_unitario   NUMERIC(12,2) NOT NULL CHECK (valor_unitario > 0),
    forma_pagamento  TEXT NOT NULL CHECK (forma_pagamento IN ('A vista', 'Financiado', 'Consorcio')),
    cliente_nome     TEXT,
    CONSTRAINT fk_vendas_vendedor_loja FOREIGN KEY (vendedor_id, loja_id) REFERENCES vendedores (id, loja_id),
    CONSTRAINT fk_vendas_gerente_loja  FOREIGN KEY (gerente_id, loja_id)  REFERENCES gerentes (id, loja_id)
);

-- Índices para as consultas mais comuns do painel: filtrar por período
-- e agrupar por loja/vendedor são operações que rodam a cada poucos
-- segundos no painel ao vivo, então merecem índice.
-- (loja_id, criado_em) atende "vendas da loja X no mês Y" e, por ser
-- prefixo, também qualquer filtro só por loja_id.
-- As consultas filtram o mês com uma FAIXA (criado_em >= início AND
-- criado_em < início do mês seguinte). Aplicar date_trunc() na coluna
-- esconderia criado_em do índice e forçaria ler a tabela inteira.
CREATE INDEX idx_vendas_criado_em ON vendas (criado_em);
CREATE INDEX idx_vendas_loja_criado_em ON vendas (loja_id, criado_em);
CREATE INDEX idx_vendas_vendedor_id ON vendas (vendedor_id);

-- ---------------------------------------------------------------------
-- Coluna calculada (view, não armazenada) para não duplicar
-- quantidade * valor_unitario em toda consulta.
-- ---------------------------------------------------------------------
CREATE VIEW vw_vendas AS
SELECT
    v.id,
    v.criado_em,
    v.quantidade,
    v.valor_unitario,
    (v.quantidade * v.valor_unitario)  AS valor_total,
    v.forma_pagamento,
    v.cliente_nome,
    l.id    AS loja_id,
    l.nome  AS loja_nome,
    l.cidade,
    l.equipe_apelido,
    ve.id   AS vendedor_id,
    ve.nome AS vendedor_nome,
    g.nome  AS gerente_nome,
    m.id    AS modelo_id,
    m.nome  AS modelo_nome,
    m.categoria
FROM vendas v
JOIN lojas l       ON l.id = v.loja_id
JOIN vendedores ve ON ve.id = v.vendedor_id
JOIN modelos m     ON m.id = v.modelo_id
LEFT JOIN gerentes g ON g.id = v.gerente_id;

-- ---------------------------------------------------------------------
-- Ranking e acompanhamento de meta do mês corrente, por loja.
-- Usa LEFT JOIN para lojas ainda sem venda no mês aparecerem com 0,
-- não sumirem do ranking.
-- ---------------------------------------------------------------------
CREATE VIEW vw_metas_mes_atual AS
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

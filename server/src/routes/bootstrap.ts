import { Router } from "express";
import { pool } from "../db.js";

export const bootstrapRouter = Router();

/**
 * Devolve tudo que o painel precisa pra montar a tela de uma vez só:
 * cadastro (lojas/gerentes/vendedores/modelos), vendas de hoje, metas
 * do mês corrente, vendas da semana e os últimos lançamentos.
 *
 * Equivalente ao getBootstrapData() do backend original em Apps
 * Script - a ideia de "um pedido só, tudo que a tela precisa" foi
 * mantida de propósito: evita a tela fazer 6 requisições em cascata
 * toda vez que abre ou atualiza.
 */
bootstrapRouter.get("/", async (_req, res) => {
  const [lojas, gerentes, vendedores, modelos, vendasHoje, metas, vendasSemana, ultimosLancamentos] =
    await Promise.all([
      pool.query("SELECT id, nome, cidade, equipe_apelido, meta_mensal FROM lojas ORDER BY nome"),
      pool.query("SELECT id, nome, loja_id FROM gerentes ORDER BY nome"),
      pool.query("SELECT id, nome, loja_id, gerente_id FROM vendedores ORDER BY nome"),
      pool.query("SELECT id, nome, categoria, preco_tabela FROM modelos ORDER BY nome"),
      pool.query(
        `SELECT id, criado_em, loja_id, loja_nome, vendedor_id, vendedor_nome, gerente_nome,
                modelo_id, modelo_nome, quantidade, valor_total, forma_pagamento, cliente_nome
         FROM vw_vendas
         WHERE criado_em::date = CURRENT_DATE
         ORDER BY criado_em DESC`
      ),
      pool.query(
        "SELECT loja_id, loja_nome, equipe_apelido, meta_mensal, acumulado, percentual_meta FROM vw_metas_mes_atual"
      ),
      // date_trunc('week', ...) no Postgres considera segunda-feira o
      // início da semana - o mesmo critério que o painel original usava.
      pool.query(
        `SELECT loja_nome, vendedor_nome, modelo_nome, quantidade
         FROM vw_vendas
         WHERE criado_em >= date_trunc('week', now())`
      ),
      pool.query(
        `SELECT id, criado_em, loja_nome, vendedor_nome, modelo_nome, quantidade, cliente_nome
         FROM vw_vendas
         ORDER BY criado_em DESC
         LIMIT 40`
      ),
    ]);

  res.json({
    lojas: lojas.rows,
    gerentes: gerentes.rows,
    vendedores: vendedores.rows,
    modelos: modelos.rows,
    vendasHoje: vendasHoje.rows,
    metas: metas.rows,
    vendasSemana: vendasSemana.rows,
    ultimosLancamentos: ultimosLancamentos.rows,
  });
});

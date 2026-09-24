import { Router } from "express";
import { pool } from "../db.js";

export const bootstrapRouter = Router();

/**
 * Devolve o que a tela de lançamento e a barra lateral precisam de uma
 * vez só: cadastro (lojas, vendedores, modelos) e os últimos lançamentos.
 * A ideia de "um pedido só, tudo que a tela precisa" veio do backend
 * original em Apps Script e evita a tela fazer várias requisições em
 * cascata toda vez que abre ou atualiza.
 *
 * Os números do painel (KPIs, metas, ranking) vêm de /api/analytics. Uma
 * versão anterior também devolvia aqui vendas de hoje, metas e vendas da
 * semana inteira, mas o front nunca usou: eram consultas rodando a cada 30
 * segundos por nada, e "vendas da semana" trazia todas as linhas.
 */
bootstrapRouter.get("/", async (_req, res) => {
  const [lojas, vendedores, modelos, ultimosLancamentos] = await Promise.all([
    pool.query("SELECT id, nome, cidade, equipe_apelido, meta_mensal FROM lojas ORDER BY nome"),
    pool.query("SELECT id, nome, loja_id, gerente_id FROM vendedores ORDER BY nome"),
    pool.query("SELECT id, nome, categoria, preco_tabela FROM modelos ORDER BY nome"),
    pool.query(
      `SELECT id, criado_em, loja_nome, vendedor_nome, modelo_nome, quantidade, cliente_nome
       FROM vw_vendas
       ORDER BY criado_em DESC
       LIMIT 40`
    ),
  ]);

  res.json({
    lojas: lojas.rows,
    vendedores: vendedores.rows,
    modelos: modelos.rows,
    ultimosLancamentos: ultimosLancamentos.rows,
  });
});

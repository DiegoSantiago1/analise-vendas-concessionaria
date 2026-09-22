import { Router } from "express";
import { pool } from "../db.js";

export const analyticsRouter = Router();

/**
 * Dados analíticos de um mês, opcionalmente filtrados por uma loja.
 *
 * Query params:
 *   lojaId (opcional) - filtra tudo por uma loja específica
 *   mes    (opcional) - 'YYYY-MM'; padrão = mês corrente
 *
 * Tudo aqui é agregado no banco (SUM/GROUP BY), não no JavaScript: o
 * Postgres faz isso muito melhor do que trazer milhares de linhas pela
 * rede pro navegador somar.
 */
analyticsRouter.get("/", async (req, res) => {
  const lojaId = req.query.lojaId ? Number(req.query.lojaId) : null;
  if (req.query.lojaId && !Number.isInteger(lojaId)) {
    res.status(400).json({ erro: "lojaId inválido." });
    return;
  }

  const mesParam = typeof req.query.mes === "string" ? req.query.mes : null;
  if (mesParam && !/^\d{4}-\d{2}$/.test(mesParam)) {
    res.status(400).json({ erro: "Parâmetro 'mes' deve estar no formato YYYY-MM." });
    return;
  }
  // Primeiro dia do mês pedido (ou do mês corrente, no fuso da base).
  const referencia = mesParam ? `${mesParam}-01` : null;

  const filtroMes = "date_trunc('month', v.criado_em) = date_trunc('month', COALESCE($1::timestamptz, now()))";
  const filtroLoja = "($2::int IS NULL OR v.loja_id = $2)";
  const params = [referencia, lojaId];

  const [kpis, porDia, porModelo, porCategoria, porFormaPagamento, rankingVendedores, rankingLojas, metas, periodo] =
    await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(v.quantidade), 0)::int AS vendas,
                COALESCE(SUM(v.quantidade * v.valor_unitario), 0) AS faturamento,
                COUNT(DISTINCT v.criado_em::date)::int AS dias_com_venda
         FROM vendas v WHERE ${filtroMes} AND ${filtroLoja}`,
        params
      ),
      pool.query(
        `SELECT to_char(v.criado_em::date, 'YYYY-MM-DD') AS dia,
                SUM(v.quantidade)::int AS quantidade,
                SUM(v.quantidade * v.valor_unitario) AS faturamento
         FROM vendas v WHERE ${filtroMes} AND ${filtroLoja}
         GROUP BY 1 ORDER BY 1`,
        params
      ),
      pool.query(
        `SELECT m.nome AS modelo, m.categoria,
                SUM(v.quantidade)::int AS quantidade,
                SUM(v.quantidade * v.valor_unitario) AS faturamento
         FROM vendas v JOIN modelos m ON m.id = v.modelo_id
         WHERE ${filtroMes} AND ${filtroLoja}
         GROUP BY 1, 2 ORDER BY quantidade DESC`,
        params
      ),
      pool.query(
        `SELECT m.categoria, SUM(v.quantidade)::int AS quantidade
         FROM vendas v JOIN modelos m ON m.id = v.modelo_id
         WHERE ${filtroMes} AND ${filtroLoja}
         GROUP BY 1 ORDER BY quantidade DESC`,
        params
      ),
      pool.query(
        `SELECT v.forma_pagamento, SUM(v.quantidade)::int AS quantidade
         FROM vendas v WHERE ${filtroMes} AND ${filtroLoja}
         GROUP BY 1 ORDER BY quantidade DESC`,
        params
      ),
      pool.query(
        `SELECT ve.nome AS vendedor, l.nome AS loja,
                SUM(v.quantidade)::int AS quantidade,
                SUM(v.quantidade * v.valor_unitario) AS faturamento
         FROM vendas v
         JOIN vendedores ve ON ve.id = v.vendedor_id
         JOIN lojas l ON l.id = v.loja_id
         WHERE ${filtroMes} AND ${filtroLoja}
         GROUP BY 1, 2 ORDER BY quantidade DESC LIMIT 10`,
        params
      ),
      pool.query(
        `SELECT l.nome AS loja, l.equipe_apelido,
                SUM(v.quantidade)::int AS quantidade,
                SUM(v.quantidade * v.valor_unitario) AS faturamento
         FROM vendas v JOIN lojas l ON l.id = v.loja_id
         WHERE ${filtroMes} AND ${filtroLoja}
         GROUP BY 1, 2 ORDER BY quantidade DESC`,
        params
      ),
      // Metas do mês escolhido. LEFT JOIN pra loja sem venda no mês
      // ainda aparecer com 0, em vez de sumir do acompanhamento.
      pool.query(
        `SELECT l.id AS loja_id, l.nome AS loja, l.equipe_apelido, l.meta_mensal,
                COALESCE(SUM(v.quantidade), 0)::int AS acumulado
         FROM lojas l
         LEFT JOIN vendas v
           ON v.loja_id = l.id
          AND date_trunc('month', v.criado_em) = date_trunc('month', COALESCE($1::timestamptz, now()))
         WHERE ($2::int IS NULL OR l.id = $2)
         GROUP BY l.id, l.nome, l.equipe_apelido, l.meta_mensal
         ORDER BY acumulado DESC`,
        params
      ),
      pool.query(
        `SELECT to_char(date_trunc('month', COALESCE($1::timestamptz, now())), 'YYYY-MM') AS mes,
                to_char(date_trunc('month', COALESCE($1::timestamptz, now())), 'YYYY-MM-DD') AS primeiro_dia,
                to_char(date_trunc('month', COALESCE($1::timestamptz, now())) + interval '1 month - 1 day', 'YYYY-MM-DD') AS ultimo_dia,
                to_char(now(), 'YYYY-MM-DD') AS hoje`,
        [referencia]
      ),
    ]);

  const totalVendas = kpis.rows[0].vendas;
  const faturamento = Number(kpis.rows[0].faturamento);

  res.json({
    periodo: periodo.rows[0],
    kpis: {
      vendas: totalVendas,
      faturamento,
      ticketMedio: totalVendas > 0 ? faturamento / totalVendas : 0,
      diasComVenda: kpis.rows[0].dias_com_venda,
    },
    porDia: porDia.rows,
    porModelo: porModelo.rows,
    porCategoria: porCategoria.rows,
    porFormaPagamento: porFormaPagamento.rows,
    rankingVendedores: rankingVendedores.rows,
    rankingLojas: rankingLojas.rows,
    metas: metas.rows,
  });
});

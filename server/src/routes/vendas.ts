import { Router } from "express";
import { pool } from "../db.js";

export const vendasRouter = Router();

const FORMAS_PAGAMENTO_VALIDAS = new Set(["A vista", "Financiado", "Consorcio"]);

interface CorpoVenda {
  lojaId?: number;
  vendedorId?: number;
  modeloId?: number;
  quantidade?: number;
  clienteNome?: string;
  formaPagamento?: string;
}

/**
 * Registra uma venda. Diferença importante em relação ao script
 * original: lá o gerente era escolhido à mão num select separado do
 * vendedor (dava pra selecionar um vendedor de uma loja e um gerente
 * de outra, por engano). Aqui o gerente é derivado automaticamente a
 * partir do vendedor (vendedores.gerente_id) - menos campo pro
 * usuário preencher, e elimina essa classe inteira de erro de
 * digitação/seleção.
 */
vendasRouter.post("/", async (req, res) => {
  const corpo = req.body as CorpoVenda;

  if (!corpo.lojaId || !corpo.vendedorId || !corpo.modeloId) {
    res.status(400).json({ erro: "Informe loja, vendedor e modelo." });
    return;
  }
  const quantidade = Number(corpo.quantidade ?? 1);
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    res.status(400).json({ erro: "Quantidade precisa ser um número inteiro maior que zero." });
    return;
  }
  const formaPagamento = corpo.formaPagamento ?? "A vista";
  if (!FORMAS_PAGAMENTO_VALIDAS.has(formaPagamento)) {
    res.status(400).json({ erro: `Forma de pagamento inválida. Use uma de: ${[...FORMAS_PAGAMENTO_VALIDAS].join(", ")}.` });
    return;
  }

  const modelo = await pool.query("SELECT preco_tabela FROM modelos WHERE id = $1", [corpo.modeloId]);
  if (modelo.rowCount === 0) {
    res.status(400).json({ erro: "Modelo não encontrado." });
    return;
  }

  const vendedor = await pool.query("SELECT gerente_id, loja_id FROM vendedores WHERE id = $1", [corpo.vendedorId]);
  if (vendedor.rowCount === 0) {
    res.status(400).json({ erro: "Vendedor não encontrado." });
    return;
  }
  if (vendedor.rows[0].loja_id !== corpo.lojaId) {
    res.status(400).json({ erro: "Esse vendedor não pertence à loja informada." });
    return;
  }

  const resultado = await pool.query(
    `INSERT INTO vendas (loja_id, vendedor_id, gerente_id, modelo_id, quantidade, valor_unitario, forma_pagamento, cliente_nome)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, criado_em`,
    [
      corpo.lojaId,
      corpo.vendedorId,
      vendedor.rows[0].gerente_id,
      corpo.modeloId,
      quantidade,
      modelo.rows[0].preco_tabela,
      formaPagamento,
      corpo.clienteNome?.trim() || null,
    ]
  );

  res.status(201).json({ ok: true, id: resultado.rows[0].id, criadoEm: resultado.rows[0].criado_em });
});

/** Remove a venda lançada mais recentemente ("desfazer última venda"). */
vendasRouter.delete("/ultima", async (_req, res) => {
  const resultado = await pool.query(
    "DELETE FROM vendas WHERE id = (SELECT id FROM vendas ORDER BY criado_em DESC LIMIT 1) RETURNING id"
  );
  if (resultado.rowCount === 0) {
    res.status(404).json({ erro: "Não há nenhuma venda para remover." });
    return;
  }
  res.json({ ok: true, idRemovido: resultado.rows[0].id });
});

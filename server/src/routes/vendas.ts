import { Router } from "express";
import { pool } from "../db.js";
import { corpoJson, idDeTexto, idValido } from "../validacao.js";

export const vendasRouter = Router();

const FORMAS_PAGAMENTO_VALIDAS = new Set(["A vista", "Financiado", "Consorcio"]);
const QUANTIDADE_MAXIMA = 50; // teto de sanidade por lançamento; também evita estourar o INT do banco
const CLIENTE_TAMANHO_MAXIMO = 120;

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
  const corpo = corpoJson(req);
  if (!corpo) {
    res.status(400).json({ erro: "Envie o corpo da requisição em JSON (Content-Type: application/json)." });
    return;
  }

  const lojaId = idValido(corpo.lojaId);
  const vendedorId = idValido(corpo.vendedorId);
  const modeloId = idValido(corpo.modeloId);
  if (!lojaId || !vendedorId || !modeloId) {
    res.status(400).json({ erro: "Informe loja, vendedor e modelo." });
    return;
  }

  const quantidade = corpo.quantidade ?? 1;
  if (typeof quantidade !== "number" || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > QUANTIDADE_MAXIMA) {
    res.status(400).json({ erro: `Quantidade precisa ser um número inteiro entre 1 e ${QUANTIDADE_MAXIMA}.` });
    return;
  }

  const formaPagamento = corpo.formaPagamento ?? "A vista";
  if (typeof formaPagamento !== "string" || !FORMAS_PAGAMENTO_VALIDAS.has(formaPagamento)) {
    res.status(400).json({ erro: `Forma de pagamento inválida. Use uma de: ${[...FORMAS_PAGAMENTO_VALIDAS].join(", ")}.` });
    return;
  }

  const clienteBruto = corpo.clienteNome ?? "";
  if (typeof clienteBruto !== "string") {
    res.status(400).json({ erro: "Nome do cliente inválido." });
    return;
  }
  const clienteNome = clienteBruto.trim() || null;
  if (clienteNome && clienteNome.length > CLIENTE_TAMANHO_MAXIMO) {
    res.status(400).json({ erro: `Nome do cliente pode ter no máximo ${CLIENTE_TAMANHO_MAXIMO} caracteres.` });
    return;
  }

  const modelo = await pool.query("SELECT preco_tabela FROM modelos WHERE id = $1", [modeloId]);
  if (modelo.rowCount === 0) {
    res.status(400).json({ erro: "Modelo não encontrado." });
    return;
  }

  const vendedor = await pool.query("SELECT gerente_id, loja_id FROM vendedores WHERE id = $1", [vendedorId]);
  if (vendedor.rowCount === 0) {
    res.status(400).json({ erro: "Vendedor não encontrado." });
    return;
  }
  if (vendedor.rows[0].loja_id !== lojaId) {
    res.status(400).json({ erro: "Esse vendedor não pertence à loja informada." });
    return;
  }

  const resultado = await pool.query(
    `INSERT INTO vendas (loja_id, vendedor_id, gerente_id, modelo_id, quantidade, valor_unitario, forma_pagamento, cliente_nome)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, criado_em`,
    [lojaId, vendedorId, vendedor.rows[0].gerente_id, modeloId, quantidade, modelo.rows[0].preco_tabela, formaPagamento, clienteNome]
  );

  res.status(201).json({ ok: true, id: resultado.rows[0].id, criadoEm: resultado.rows[0].criado_em });
});

/**
 * Remove uma venda pelo id ("desfazer"). O painel só oferece desfazer a
 * venda que ELE MESMO acabou de lançar: antes a rota apagava "a última venda
 * do banco", que com mais de um usuário podia ser a de outra pessoa.
 * Continua sem autenticação (é um protótipo), então isto evita o acidente,
 * não impede alguém mal-intencionado; autenticação fica para um projeto futuro.
 */
vendasRouter.delete("/:id", async (req, res) => {
  const id = idDeTexto(req.params.id);
  if (!id) {
    res.status(400).json({ erro: "Id de venda inválido." });
    return;
  }
  const resultado = await pool.query("DELETE FROM vendas WHERE id = $1 RETURNING id", [id]);
  if (resultado.rowCount === 0) {
    res.status(404).json({ erro: "Venda não encontrada (talvez já tenha sido removida)." });
    return;
  }
  res.json({ ok: true, idRemovido: resultado.rows[0].id });
});

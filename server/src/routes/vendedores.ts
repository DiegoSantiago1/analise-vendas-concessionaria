import { Router } from "express";
import { pool } from "../db.js";
import { codigoPg, corpoJson, idValido } from "../validacao.js";

export const vendedoresRouter = Router();

const NOME_TAMANHO_MAXIMO = 80;

/**
 * Cadastro rápido de vendedor numa loja já existente.
 *
 * Escopo deliberadamente menor que o formulário original: lá dava pra
 * digitar loja/gerente/vendedor livremente, criando qualquer um dos
 * três na hora. Aqui o schema é normalizado (loja e gerente são
 * tabelas próprias, com FK), então criar uma loja nova é uma decisão
 * de negócio maior - por enquanto isso é feito pelo script de seed.
 * Este endpoint cobre o caso mais comum no dia a dia: a loja já
 * existe, só entrou um vendedor novo na equipe.
 */
vendedoresRouter.post("/", async (req, res) => {
  const corpo = corpoJson(req);
  if (!corpo) {
    res.status(400).json({ erro: "Envie o corpo da requisição em JSON (Content-Type: application/json)." });
    return;
  }

  const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
  const lojaId = idValido(corpo.lojaId);
  if (!nome || !lojaId) {
    res.status(400).json({ erro: "Informe nome do vendedor e a loja." });
    return;
  }
  if (nome.length > NOME_TAMANHO_MAXIMO) {
    res.status(400).json({ erro: `Nome do vendedor pode ter no máximo ${NOME_TAMANHO_MAXIMO} caracteres.` });
    return;
  }

  const loja = await pool.query("SELECT id FROM lojas WHERE id = $1", [lojaId]);
  if (loja.rowCount === 0) {
    res.status(400).json({ erro: "Loja não encontrada." });
    return;
  }

  let gerenteId: number | null = null;
  if (corpo.gerenteId != null) {
    gerenteId = idValido(corpo.gerenteId);
    const gerente = gerenteId
      ? await pool.query("SELECT id FROM gerentes WHERE id = $1 AND loja_id = $2", [gerenteId, lojaId])
      : null;
    if (!gerente || gerente.rowCount === 0) {
      res.status(400).json({ erro: "Esse gerente não pertence à loja informada." });
      return;
    }
  }

  try {
    const resultado = await pool.query(
      "INSERT INTO vendedores (nome, loja_id, gerente_id) VALUES ($1, $2, $3) RETURNING id",
      [nome, lojaId, gerenteId]
    );
    res.status(201).json({ ok: true, id: resultado.rows[0].id });
  } catch (erro) {
    // 23505 = unique_violation: a regra "sem nome repetido na mesma loja" é
    // garantida pelo índice do banco; aqui só traduzimos o erro para o usuário.
    if (codigoPg(erro) === "23505") {
      res.status(409).json({ erro: "Já existe um vendedor com esse nome nessa loja." });
      return;
    }
    throw erro;
  }
});

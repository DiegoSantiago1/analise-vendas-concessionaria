import { Router } from "express";
import { pool } from "../db.js";

export const vendedoresRouter = Router();

interface CorpoVendedor {
  nome?: string;
  lojaId?: number;
  gerenteId?: number;
}

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
  const corpo = req.body as CorpoVendedor;
  const nome = corpo.nome?.trim();

  if (!nome || !corpo.lojaId) {
    res.status(400).json({ erro: "Informe nome do vendedor e a loja." });
    return;
  }

  const loja = await pool.query("SELECT id FROM lojas WHERE id = $1", [corpo.lojaId]);
  if (loja.rowCount === 0) {
    res.status(400).json({ erro: "Loja não encontrada." });
    return;
  }

  let gerenteId: number | null = null;
  if (corpo.gerenteId) {
    const gerente = await pool.query("SELECT id FROM gerentes WHERE id = $1 AND loja_id = $2", [corpo.gerenteId, corpo.lojaId]);
    if (gerente.rowCount === 0) {
      res.status(400).json({ erro: "Esse gerente não pertence à loja informada." });
      return;
    }
    gerenteId = corpo.gerenteId;
  }

  const resultado = await pool.query(
    "INSERT INTO vendedores (nome, loja_id, gerente_id) VALUES ($1, $2, $3) RETURNING id",
    [nome, corpo.lojaId, gerenteId]
  );

  res.status(201).json({ ok: true, id: resultado.rows[0].id });
});

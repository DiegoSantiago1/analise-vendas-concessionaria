// Testes de integração da API. Rodam contra o PostgreSQL de desenvolvimento
// (docker compose up -d, com os dados fictícios carregados) e usam só o
// runner nativo do Node (node:test), sem dependência nova.
//
// Não deixam resíduo: a única venda criada é removida no próprio teste, e
// os testes de integridade do banco rodam dentro de uma transação que
// sofre ROLLBACK.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { app } from "../src/app.js";
import { pool } from "../src/db.js";

let servidor: Server;
let base: string;
let lojaId: number;
let vendedorId: number;
let vendedorNome: string;
let outraLojaId: number;
let modeloId: number;

const json = { "Content-Type": "application/json" };
const post = (rota: string, corpo: unknown, headers: Record<string, string> = json) =>
  fetch(base + rota, { method: "POST", headers, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });

before(async () => {
  servidor = app.listen(0);
  await new Promise((ok) => servidor.once("listening", ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

  const boot = await (await fetch(`${base}/api/bootstrap`)).json();
  const vendedor = boot.vendedores[0];
  vendedorId = vendedor.id;
  vendedorNome = vendedor.nome;
  lojaId = vendedor.loja_id;
  outraLojaId = boot.lojas.find((l: { id: number }) => l.id !== lojaId).id;
  modeloId = boot.modelos[0].id;
});

after(async () => {
  servidor.close();
  await pool.end();
});

describe("health e rotas", () => {
  it("/api/health confirma que o banco responde", async () => {
    const r = await fetch(`${base}/api/health`);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true, banco: "ok" });
  });

  it("rota de API inexistente devolve 404 em JSON", async () => {
    const r = await fetch(`${base}/api/nada`);
    assert.equal(r.status, 404);
    assert.ok((await r.json()).erro);
  });

  it("bootstrap traz só o que o painel usa", async () => {
    const dados = await (await fetch(`${base}/api/bootstrap`)).json();
    assert.deepEqual(Object.keys(dados).sort(), ["lojas", "modelos", "ultimosLancamentos", "vendedores"]);
  });
});

describe("POST /api/vendas: validação (tudo 400, nunca 500)", () => {
  const valido = () => ({ lojaId, vendedorId, modeloId });

  it("corpo que não é JSON (text/plain)", async () => {
    assert.equal((await post("/api/vendas", "qualquer coisa", { "Content-Type": "text/plain" })).status, 400);
  });
  it("sem Content-Type e sem corpo", async () => {
    assert.equal((await fetch(`${base}/api/vendas`, { method: "POST" })).status, 400);
  });
  it("JSON malformado", async () => {
    assert.equal((await post("/api/vendas", "{quebrado")).status, 400);
  });
  it("corpo JSON que não é objeto", async () => {
    assert.equal((await post("/api/vendas", [1, 2])).status, 400);
  });
  it("campos obrigatórios ausentes", async () => {
    const r = await post("/api/vendas", {});
    assert.equal(r.status, 400);
    assert.equal((await r.json()).erro, "Informe loja, vendedor e modelo.");
  });
  for (const [nome, quantidade] of [["zero", 0], ["negativa", -1], ["decimal", 1.5], ["acima do teto", 51], ["texto", "2"], ["gigante", 1e12]] as const) {
    it(`quantidade ${nome}`, async () => {
      assert.equal((await post("/api/vendas", { ...valido(), quantidade })).status, 400);
    });
  }
  it("forma de pagamento inválida", async () => {
    assert.equal((await post("/api/vendas", { ...valido(), formaPagamento: "Pix" })).status, 400);
  });
  it("nome de cliente que não é texto", async () => {
    assert.equal((await post("/api/vendas", { ...valido(), clienteNome: 5 })).status, 400);
  });
  it("nome de cliente longo demais", async () => {
    assert.equal((await post("/api/vendas", { ...valido(), clienteNome: "x".repeat(121) })).status, 400);
  });
  it("id maior que o INT do banco", async () => {
    assert.equal((await post("/api/vendas", { ...valido(), modeloId: 99_999_999_999 })).status, 400);
  });
  it("vendedor de outra loja", async () => {
    assert.equal((await post("/api/vendas", { ...valido(), lojaId: outraLojaId })).status, 400);
  });
});

describe("ciclo lançar e desfazer", () => {
  it("lança, aparece no feed, desfaz por id e não desfaz duas vezes", async () => {
    const criada = await post("/api/vendas", { lojaId, vendedorId, modeloId, quantidade: 1, clienteNome: "  Cliente de Teste  " });
    assert.equal(criada.status, 201);
    const { id } = await criada.json();
    assert.ok(Number.isInteger(id));

    const feed = (await (await fetch(`${base}/api/bootstrap`)).json()).ultimosLancamentos;
    const naLista = feed.find((v: { id: number }) => v.id === id);
    assert.equal(naLista?.cliente_nome, "Cliente de Teste", "o nome deve ser salvo sem espaços nas pontas");

    assert.equal((await fetch(`${base}/api/vendas/${id}`, { method: "DELETE" })).status, 200);
    assert.equal((await fetch(`${base}/api/vendas/${id}`, { method: "DELETE" })).status, 404);
  });

  it("id inválido no DELETE", async () => {
    assert.equal((await fetch(`${base}/api/vendas/abc`, { method: "DELETE" })).status, 400);
    assert.equal((await fetch(`${base}/api/vendas/ultima`, { method: "DELETE" })).status, 400, "a antiga rota 'ultima' não apaga mais nada");
  });
});

describe("POST /api/vendedores", () => {
  it("corpo que não é JSON", async () => {
    assert.equal((await post("/api/vendedores", "x", { "Content-Type": "text/plain" })).status, 400);
  });
  it("nome que não é texto", async () => {
    assert.equal((await post("/api/vendedores", { nome: 123, lojaId })).status, 400);
  });
  it("nome repetido na mesma loja (sem diferenciar caixa) devolve 409", async () => {
    const r = await post("/api/vendedores", { nome: vendedorNome.toUpperCase(), lojaId });
    assert.equal(r.status, 409);
  });
});

describe("GET /api/analytics: parâmetros", () => {
  for (const consulta of ["lojaId=abc", "lojaId=99999999999", "lojaId=-1", "mes=2026-13", "mes=2026-9", "mes=0000-01", "mes=2026-01&mes=2026-02", "lojaId=1&lojaId=2"]) {
    it(`rejeita ${consulta}`, async () => {
      assert.equal((await fetch(`${base}/api/analytics?${consulta}`)).status, 400);
    });
  }
  it("aceita mês e loja válidos e devolve a estrutura esperada", async () => {
    const r = await fetch(`${base}/api/analytics?lojaId=${lojaId}&mes=2026-01`);
    assert.equal(r.status, 200);
    const dados = await r.json();
    assert.equal(dados.periodo.mes, "2026-01");
    assert.equal(dados.kpis.vendas, 0, "mês sem histórico devolve zero, não erro");
    assert.equal(dados.metas.length, 1);
  });
});

describe("integridade garantida pelo próprio banco", () => {
  async function rejeita(sql: string, params: unknown[], restricao: string) {
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      await assert.rejects(cliente.query(sql, params), (erro: { constraint?: string }) => erro.constraint === restricao);
    } finally {
      await cliente.query("ROLLBACK");
      cliente.release();
    }
  }

  it("venda com vendedor de outra loja", async () => {
    await rejeita(
      "INSERT INTO vendas (loja_id, vendedor_id, modelo_id, quantidade, valor_unitario, forma_pagamento) VALUES ($1, $2, $3, 1, 100, 'A vista')",
      [outraLojaId, vendedorId, modeloId],
      "fk_vendas_vendedor_loja"
    );
  });
  it("vendedor duplicado na mesma loja", async () => {
    await rejeita("INSERT INTO vendedores (nome, loja_id) VALUES ($1, $2)", [vendedorNome.toLowerCase(), lojaId], "uq_vendedores_loja_nome");
  });
  it("vendedor com gerente de outra loja", async () => {
    const gerente = await pool.query("SELECT id FROM gerentes WHERE loja_id = $1 LIMIT 1", [outraLojaId]);
    await rejeita("INSERT INTO vendedores (nome, loja_id, gerente_id) VALUES ('Nome Novo Teste', $1, $2)", [lojaId, gerente.rows[0].id], "fk_vendedores_gerente_loja");
  });
});

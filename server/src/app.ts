import express, { type ErrorRequestHandler } from "express";
import path from "node:path";
import { pool } from "./db.js";
import { bootstrapRouter } from "./routes/bootstrap.js";
import { vendasRouter } from "./routes/vendas.js";
import { vendedoresRouter } from "./routes/vendedores.js";
import { analyticsRouter } from "./routes/analytics.js";

// A montagem do app fica separada do index.ts (que sobe o servidor) para os
// testes conseguirem importar o app sem abrir a porta 3333.
export const app = express();

// Sem cors(): o front-end é servido por este mesmo servidor (mesma origem),
// então nenhum outro site precisa chamar a API. Deixar CORS aberto permitiria
// que qualquer página aberta no navegador lançasse ou apagasse vendas aqui.
app.use(express.json({ limit: "10kb" }));

// Health check de verdade: confirma que o banco responde, não só que o
// processo Node está vivo. 503 sinaliza "serviço indisponível" a quem monitora.
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, banco: "ok" });
  } catch {
    res.status(503).json({ ok: false, banco: "indisponivel" });
  }
});

app.use("/api/bootstrap", bootstrapRouter);
app.use("/api/vendas", vendasRouter);
app.use("/api/vendedores", vendedoresRouter);
app.use("/api/analytics", analyticsRouter);

// Rota de API inexistente responde JSON 404, em vez de cair no servidor de
// arquivos estáticos e devolver uma página HTML de erro.
app.use("/api", (_req, res) => {
  res.status(404).json({ erro: "Rota não encontrada." });
});

// Serve o front-end (web/) direto por este mesmo servidor, pra rodar
// tudo com um único comando em desenvolvimento.
const pastaWeb = path.resolve(import.meta.dirname, "../../web");
app.use(express.static(pastaWeb));

// Handler de erro central: qualquer exceção não tratada numa rota (o
// Express 5 encaminha automaticamente até rejeições de Promise em
// handlers async) cai aqui, em vez de derrubar o processo ou vazar o
// stack trace pro cliente.
const tratadorDeErros: ErrorRequestHandler = (err, _req, res, _next) => {
  // Erros do próprio Express/body-parser (JSON malformado, corpo grande
  // demais) trazem status 4xx: são culpa do cliente, não do servidor.
  const status = err?.status ?? err?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    const mensagem = status === 413 ? "Corpo da requisição grande demais." : "Requisição inválida: envie um JSON válido.";
    res.status(status).json({ erro: mensagem });
    return;
  }
  console.error("Erro não tratado:", err);
  res.status(500).json({ erro: "Erro interno no servidor." });
};
app.use(tratadorDeErros);

import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import path from "node:path";
import { verificarConexao } from "./db.js";
import { bootstrapRouter } from "./routes/bootstrap.js";
import { vendasRouter } from "./routes/vendas.js";
import { vendedoresRouter } from "./routes/vendedores.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/bootstrap", bootstrapRouter);
app.use("/api/vendas", vendasRouter);
app.use("/api/vendedores", vendedoresRouter);

// Serve o front-end (web/) direto por este mesmo servidor, pra rodar
// tudo com um único comando em desenvolvimento.
const pastaWeb = path.resolve(import.meta.dirname, "../../web");
app.use(express.static(pastaWeb));

// Handler de erro central: qualquer exceção não tratada numa rota (o
// Express 5 encaminha automaticamente até rejeições de Promise em
// handlers async) cai aqui, em vez de derrubar o processo ou vazar o
// stack trace pro cliente.
const tratadorDeErros: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("Erro não tratado:", err);
  res.status(500).json({ erro: "Erro interno no servidor." });
};
app.use(tratadorDeErros);

const PORTA = Number(process.env.PORT ?? 3333);

async function iniciar() {
  try {
    await verificarConexao();
  } catch (err) {
    console.error("Não foi possível conectar ao PostgreSQL. O Docker está rodando? (docker compose up -d)");
    console.error(err);
    process.exit(1);
  }

  app.listen(PORTA, () => {
    console.log(`API rodando em http://localhost:${PORTA}`);
  });
}

iniciar();

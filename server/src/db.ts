import { Pool } from "pg";
import dotenv from "dotenv";
import path from "node:path";

// O .env fica na raiz do projeto (é compartilhado com o docker-compose e
// com os scripts Python), não dentro de server/.
dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

export const pool = new Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? "honda",
  password: process.env.DB_PASSWORD ?? "honda_dev_pw",
  database: process.env.DB_NAME ?? "vendas_honda",
});

// Falha cedo e com mensagem clara se o Postgres não estiver de pé,
// em vez de deixar a primeira requisição do usuário estourar um erro
// genérico de conexão.
export async function verificarConexao(): Promise<void> {
  await pool.query("SELECT 1");
}

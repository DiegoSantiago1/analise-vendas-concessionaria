import { app } from "./app.js";
import { pool, verificarConexao } from "./db.js";

const PORTA = Number(process.env.PORT ?? 3333);

async function iniciar() {
  try {
    await verificarConexao();
  } catch (err) {
    console.error("Não foi possível conectar ao PostgreSQL. O Docker está rodando? (docker compose up -d)");
    console.error(err);
    process.exit(1);
  }

  const servidor = app.listen(PORTA, () => {
    console.log(`API rodando em http://localhost:${PORTA}`);
  });

  servidor.on("error", (err) => {
    console.error(`Não foi possível abrir a porta ${PORTA} (já tem outro processo usando?):`, err.message);
    process.exit(1);
  });

  // Desligamento limpo: para de aceitar conexões e devolve as do pool ao
  // Postgres, em vez de deixá-las penduradas até o banco derrubar por timeout.
  for (const sinal of ["SIGINT", "SIGTERM"] as const) {
    process.once(sinal, () => {
      servidor.close(() => {
        pool.end().finally(() => process.exit(0));
      });
      servidor.closeIdleConnections(); // conexões keep-alive paradas atrasariam o close()
    });
  }
}

iniciar();

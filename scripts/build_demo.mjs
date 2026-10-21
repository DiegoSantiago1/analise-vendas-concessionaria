// Monta a versão de demonstração do painel (estática, sem servidor).
//
// Reaproveita o front-end de web/ sem alterá-lo: copia css/ e js/app.js,
// injeta demo/demo-api.js (que responde às chamadas /api/ no navegador) e o
// aviso de que é uma demo, e coloca os dados fictícios ao lado do script.
//
// Uso:
//   node scripts/build_demo.mjs [pasta-de-destino]     (padrão: demo/dist)

import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const destino = path.resolve(process.argv[2] ?? path.join(raiz, "demo", "dist"));

const REPOSITORIO = "https://github.com/DiegoSantiago1/analise-vendas-concessionaria";

// O aviso entra no lugar do marcador <!--AVISO_DEMO--> do web/index.html, como
// uma faixa no topo do conteúdo: não flutua por cima dos gráficos.
const aviso = `<div class="aviso-demo" role="note">
      <span><b>Demo com dados fictícios.</b> O que você lançar aqui fica só no seu navegador.</span>
      <a href="${REPOSITORIO}" target="_blank" rel="noopener noreferrer">Ver código no GitHub</a>
    </div>`;

function exigir(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

function copiar(origem, alvo) {
  fs.mkdirSync(path.dirname(alvo), { recursive: true });
  fs.copyFileSync(origem, alvo);
}

exigir(fs.existsSync(path.join(raiz, "demo", "demo-data.json")), "Falta demo/demo-data.json. Rode: python scripts/exportar_demo.py");

fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino, { recursive: true });

copiar(path.join(raiz, "web", "css", "styles.css"), path.join(destino, "css", "styles.css"));
copiar(path.join(raiz, "web", "js", "app.js"), path.join(destino, "js", "app.js"));
copiar(path.join(raiz, "demo", "demo-api.js"), path.join(destino, "js", "demo-api.js"));
copiar(path.join(raiz, "demo", "demo-data.json"), path.join(destino, "js", "demo-data.json"));

let html = fs.readFileSync(path.join(raiz, "web", "index.html"), "utf-8");
const marcadorScript = '<script src="js/app.js"></script>';
exigir(html.includes(marcadorScript), "web/index.html mudou: não achei o <script> do app.js");
exigir(html.includes("<!--AVISO_DEMO-->"), "web/index.html sem o marcador <!--AVISO_DEMO-->");
// demo-api.js precisa vir ANTES do app.js: é ele que troca o fetch.
html = html.replace(marcadorScript, `<script src="js/demo-api.js"></script>\n${marcadorScript}`);
html = html.replace("<!--AVISO_DEMO-->", aviso);
fs.writeFileSync(path.join(destino, "index.html"), html, "utf-8");

console.log(`Demo gerada em ${destino}`);

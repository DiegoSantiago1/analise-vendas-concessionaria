// Monta a versão de demonstração do painel (estática, sem servidor).
//
// Reaproveita o front-end de web/ sem alterá-lo: copia css/ e js/app.js,
// injeta demo/demo-api.js (que responde às chamadas /api/ no navegador) e um
// aviso de que é uma demo, e coloca os dados fictícios ao lado do script.
//
// Uso:
//   node scripts/build_demo.mjs [pasta-de-destino]     (padrão: demo/dist)

import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const destino = path.resolve(process.argv[2] ?? path.join(raiz, "demo", "dist"));

const REPOSITORIO = "https://github.com/DiegoSantiago1/analise-vendas-concessionaria";

const aviso = `
<aside id="avisoDemo" style="position:fixed;right:16px;bottom:16px;z-index:60;max-width:330px;display:flex;gap:10px;align-items:flex-start;padding:11px 12px 11px 14px;border-radius:12px;background:rgba(10,4,5,.94);border:1px solid rgba(255,99,99,.35);color:#f7eeee;font:12.5px/1.45 'Outfit','Segoe UI',Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5)">
  <span><b>Demo com dados fictícios.</b> O que você lançar aqui fica só no seu navegador.
    <a href="${REPOSITORIO}" target="_blank" rel="noopener noreferrer" style="color:#ffd166">Ver código no GitHub ↗</a></span>
  <button type="button" aria-label="Fechar aviso" onclick="this.parentElement.remove()" style="all:unset;cursor:pointer;color:#cc9a9c;font-size:18px;line-height:1;padding:0 2px">×</button>
</aside>
`;

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
exigir(html.includes("</body>"), "web/index.html sem </body>");
// demo-api.js precisa vir ANTES do app.js: é ele que troca o fetch.
html = html.replace(marcadorScript, `<script src="js/demo-api.js"></script>\n${marcadorScript}`);
html = html.replace("</body>", `${aviso}</body>`);
fs.writeFileSync(path.join(destino, "index.html"), html, "utf-8");

console.log(`Demo gerada em ${destino}`);

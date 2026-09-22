// Painel de Vendas — Grupo Horizonte Honda (dados fictícios)
// Fala com a API REST em server/ via fetch(). Sem framework: JS puro
// é suficiente pro tamanho desta tela, e evita dependência que não
// agrega nada aqui (ver CLAUDE.md do projeto: nada de tecnologia só
// pra usar tecnologia).

const API_BASE = "http://localhost:3333/api";

let state = { lojas: [], gerentes: [], vendedores: [], modelos: [], vendasHoje: [], metas: [], vendasSemana: [], ultimosLancamentos: [] };
let chartLoja = null;
let chartVendedor = null;
let chartLojaSemana = null;
let chartVendedorSemana = null;
let ultimoTotalHoje = 0;
let primeiraCarga = true; // evita comemorar vendas que já existiam antes da página abrir

document.getElementById("dataHoje").textContent = new Date().toLocaleDateString("pt-BR");

// ===================== TABS =====================
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`view-${btn.dataset.tab}`).classList.add("active");
  });
});

// ===================== CARREGAR DADOS =====================
async function carregar() {
  try {
    const resposta = await fetch(`${API_BASE}/bootstrap`);
    if (!resposta.ok) throw new Error(`API respondeu ${resposta.status}`);
    state = await resposta.json();
    popularSelects();
    renderTudo();
  } catch (erro) {
    console.error("Falha ao carregar dados do painel:", erro);
    document.getElementById("tickerTrack").textContent =
      "Não foi possível falar com a API. Ela está rodando? (npm run dev dentro de server/)";
  }
}

function agrupar(lista, campo) {
  const mapa = new Map();
  for (const item of lista) {
    const chave = item[campo] || `(sem ${campo})`;
    mapa.set(chave, (mapa.get(chave) || 0) + item.quantidade);
  }
  return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
}

// ===================== SELECTS DO FORMULÁRIO =====================
function popularSelects() {
  const selLoja = document.getElementById("selLoja");
  const cadLoja = document.getElementById("cadLoja");
  const opcoesLoja = state.lojas.map((l) => `<option value="${l.id}">${l.nome}</option>`).join("");
  selLoja.innerHTML = opcoesLoja;
  cadLoja.innerHTML = opcoesLoja;

  const selModelo = document.getElementById("selModelo");
  if (!selModelo.options.length) {
    selModelo.innerHTML = state.modelos.map((m) => `<option value="${m.id}">${m.nome}</option>`).join("");
  }

  atualizarVendedoresDoSelect();
  selLoja.addEventListener("change", atualizarVendedoresDoSelect);
}

function atualizarVendedoresDoSelect() {
  const lojaId = Number(document.getElementById("selLoja").value);
  const selVendedor = document.getElementById("selVendedor");
  const vendedoresDaLoja = state.vendedores.filter((v) => v.loja_id === lojaId);
  selVendedor.innerHTML = vendedoresDaLoja.length
    ? vendedoresDaLoja.map((v) => `<option value="${v.id}">${v.nome}</option>`).join("")
    : `<option value="">(sem vendedor cadastrado nessa loja)</option>`;
}

// ===================== RENDERIZAÇÃO =====================
function renderTudo() {
  renderKpi();
  renderMetas();
  renderRankingHoje();
  renderRankingSemana();
  renderFeed();
  renderTicker();
}

function animarNumero(el, valorFinal) {
  const inicio = Number(el.textContent) || 0;
  const duracao = 450;
  const t0 = performance.now();
  function passo(agora) {
    const p = Math.min(1, (agora - t0) / duracao);
    el.textContent = Math.round(inicio + (valorFinal - inicio) * p);
    if (p < 1) requestAnimationFrame(passo);
  }
  requestAnimationFrame(passo);
}

function renderKpi() {
  const totalHoje = state.vendasHoje.reduce((soma, v) => soma + v.quantidade, 0);
  animarNumero(document.getElementById("kpiVendidoHoje"), totalHoje);

  // Só comemora a partir da segunda carga em diante - na primeira vez
  // que a página abre, o total do dia já existente não é "notícia".
  if (!primeiraCarga && totalHoje > ultimoTotalHoje) {
    const card = document.getElementById("kpiHero");
    card.classList.remove("flash");
    void card.offsetWidth; // força reiniciar a animação
    card.classList.add("flash");
    dispararConfete();
  }
  ultimoTotalHoje = totalHoje;
  primeiraCarga = false;
}

function renderMetas() {
  const grid = document.getElementById("metasGrid");
  if (!state.metas.length) {
    grid.innerHTML = '<div class="empty-state">Metas ainda não configuradas.</div>';
    return;
  }
  grid.innerHTML = state.metas
    .map((m) => {
      const pct = Math.min(100, Number(m.percentual_meta) || 0);
      const bateu = m.acumulado >= m.meta_mensal;
      return `
        <div class="meta-card ${bateu ? "bateu" : ""}">
          <div class="meta-equipe">${m.equipe_apelido || ""}</div>
          <div class="meta-loja">${m.loja_nome}</div>
          <div class="meta-numeros"><b>${m.acumulado}</b> / ${m.meta_mensal} carros</div>
          <div class="meta-barra-fundo"><div class="meta-barra-preenchida" style="width:${pct}%"></div></div>
          <div class="meta-pct">${pct}%${bateu ? " 🏆" : ""}</div>
        </div>`;
    })
    .join("");
}

function renderPodio(containerId, ranking) {
  const el = document.getElementById(containerId);
  if (!ranking.length) {
    el.innerHTML = '<div class="empty-state">Sem vendas no período.</div>';
    return;
  }
  const medalhas = ["🥇", "🥈", "🥉"];
  const classes = ["p1", "p2", "p3"];
  el.innerHTML = ranking
    .slice(0, 3)
    .map(([nome, valor], i) => `
      <div class="podium-card ${classes[i]}">
        <div class="podium-medal">${medalhas[i]}</div>
        <div class="podium-nome">${nome}</div>
        <div class="podium-valor">${valor} vendido(s)</div>
      </div>`)
    .join("");
}

function corBarras(n) {
  return Array.from({ length: n }, (_, i) => (i === 0 ? "#ffd166" : i === 1 ? "#ff5c6a" : "#e6162b"));
}

function desenharBarraHorizontal(canvasId, ranking, chartAnterior) {
  if (chartAnterior) chartAnterior.destroy();
  const canvas = document.getElementById(canvasId);
  // Sem dado nenhum, não faz sentido desenhar eixos vazios embaixo da
  // mensagem "Sem vendas no período" do pódio - só teria dois avisos
  // dizendo a mesma coisa de jeitos diferentes.
  if (!ranking.length) {
    canvas.style.display = "none";
    return null;
  }
  canvas.style.display = "";
  const maior = Math.max(...ranking.map((r) => r[1]));
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: ranking.map((r) => r[0]),
      datasets: [{ data: ranking.map((r) => r[1]), backgroundColor: corBarras(ranking.length), borderRadius: 6, barThickness: 22 }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: { legend: { display: false } },
      scales: {
        x: { suggestedMax: Math.ceil(maior * 1.3) || 1, ticks: { color: "#a0a2ad" }, grid: { color: "#22232a" } },
        y: { ticks: { color: "#f5f5f7", font: { weight: "700" } }, grid: { display: false } },
      },
    },
  });
}

function renderRankingHoje() {
  const porLoja = agrupar(state.vendasHoje, "loja_nome");
  const porVendedor = agrupar(state.vendasHoje, "vendedor_nome");
  renderPodio("podioLoja", porLoja);
  renderPodio("podioVendedor", porVendedor);
  chartLoja = desenharBarraHorizontal("chartLoja", porLoja, chartLoja);
  chartVendedor = desenharBarraHorizontal("chartVendedor", porVendedor, chartVendedor);
}

function renderRankingSemana() {
  const porLoja = agrupar(state.vendasSemana, "loja_nome");
  const porVendedor = agrupar(state.vendasSemana, "vendedor_nome");
  renderPodio("podioLojaSemana", porLoja);
  renderPodio("podioVendedorSemana", porVendedor);
  chartLojaSemana = desenharBarraHorizontal("chartLojaSemana", porLoja, chartLojaSemana);
  chartVendedorSemana = desenharBarraHorizontal("chartVendedorSemana", porVendedor, chartVendedorSemana);
}

function renderFeed() {
  const el = document.getElementById("feedUltimos");
  if (!state.ultimosLancamentos.length) {
    el.innerHTML = '<div class="empty-state">Nenhuma venda lançada ainda.</div>';
    return;
  }
  el.innerHTML = state.ultimosLancamentos
    .map((v) => {
      const dt = new Date(v.criado_em);
      const quando = dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const cliente = v.cliente_nome ? ` para <b>${v.cliente_nome}</b>` : "";
      return `<div class="feed-item"><span class="feed-time">${quando}</span><span class="tag-loja">${v.loja_nome}</span> <b>${v.vendedor_nome}</b> vendeu ${v.quantidade}x ${v.modelo_nome}${cliente}</div>`;
    })
    .join("");
}

function renderTicker() {
  const track = document.getElementById("tickerTrack");
  if (!state.ultimosLancamentos.length) {
    track.textContent = "Aguardando o primeiro lançamento...";
    return;
  }
  track.textContent = state.ultimosLancamentos
    .slice(0, 10)
    .map((v) => `🎉 ${v.vendedor_nome} (${v.loja_nome}) vendeu ${v.quantidade}x ${v.modelo_nome}`)
    .join("   •   ");
}

// ===================== CONFETE (efeito visual, sem dependência externa) =====================
function dispararConfete() {
  const cores = ["#e6162b", "#ffd166", "#ff6b6b", "#ffffff", "#6ee787"];
  for (let i = 0; i < 60; i++) {
    const peca = document.createElement("div");
    const cor = cores[Math.floor(Math.random() * cores.length)];
    const esquerda = Math.random() * 100;
    const atraso = Math.random() * 0.4;
    const duracao = 1.8 + Math.random() * 1.2;
    const tamanho = 6 + Math.random() * 6;
    peca.style.cssText = `
      position:fixed; top:-16px; left:${esquerda}vw; width:${tamanho}px; height:${tamanho}px;
      background:${cor}; opacity:0.95; z-index:999; pointer-events:none; border-radius:50%;
      animation: cair-confete ${duracao}s ease-in ${atraso}s forwards;`;
    document.body.appendChild(peca);
    setTimeout(() => peca.remove(), (duracao + atraso) * 1000 + 100);
  }
}
const estiloConfete = document.createElement("style");
estiloConfete.textContent = `@keyframes cair-confete { to { transform: translateY(100vh) rotate(360deg); opacity: 0; } }`;
document.head.appendChild(estiloConfete);

// ===================== FORMULÁRIO: REGISTRAR VENDA =====================
document.getElementById("formVenda").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const status = document.getElementById("statusVenda");
  status.textContent = "Registrando...";
  status.className = "status-msg";

  const corpo = {
    lojaId: Number(document.getElementById("selLoja").value),
    vendedorId: Number(document.getElementById("selVendedor").value),
    modeloId: Number(document.getElementById("selModelo").value),
    quantidade: Number(document.getElementById("numQtd").value),
    formaPagamento: document.getElementById("selFormaPagamento").value,
    clienteNome: document.getElementById("txtCliente").value.trim(),
  };

  try {
    const resposta = await fetch(`${API_BASE}/vendas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || "Erro ao registrar venda.");

    status.textContent = "Venda registrada!";
    status.className = "status-msg ok";
    document.getElementById("txtCliente").value = "";
    document.getElementById("numQtd").value = 1;
    await carregar();
  } catch (erro) {
    status.textContent = erro.message;
    status.className = "status-msg err";
  }
});

document.getElementById("btnDesfazer").addEventListener("click", async () => {
  const status = document.getElementById("statusVenda");
  status.textContent = "Removendo...";
  status.className = "status-msg";
  try {
    const resposta = await fetch(`${API_BASE}/vendas/ultima`, { method: "DELETE" });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || "Erro ao desfazer.");
    status.textContent = "Último lançamento removido.";
    status.className = "status-msg ok";
    await carregar();
  } catch (erro) {
    status.textContent = erro.message;
    status.className = "status-msg err";
  }
});

// ===================== FORMULÁRIO: CADASTRO RÁPIDO DE VENDEDOR =====================
document.getElementById("formVendedor").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const status = document.getElementById("statusVendedor");
  status.textContent = "Salvando...";
  status.className = "status-msg";

  const corpo = {
    lojaId: Number(document.getElementById("cadLoja").value),
    nome: document.getElementById("cadNome").value.trim(),
  };

  try {
    const resposta = await fetch(`${API_BASE}/vendedores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || "Erro ao cadastrar.");

    status.textContent = "Vendedor cadastrado.";
    status.className = "status-msg ok";
    document.getElementById("cadNome").value = "";
    await carregar();
  } catch (erro) {
    status.textContent = erro.message;
    status.className = "status-msg err";
  }
});

// ===================== INICIALIZAÇÃO =====================
carregar();
setInterval(carregar, 15000);

// Painel de Vendas — Grupo Horizonte Honda (dados fictícios)
// JS puro, consumindo a API REST em server/. Sem framework: o tamanho
// desta tela não justifica React aqui, e a dependência não agregaria
// nada que já não seja resolvido com fetch + Chart.js.

const API = "/api";

const PALETA = {
  vermelho: "#ff2d43",
  bordo: "#b0132a",
  laranja: "#ff8a3d",
  ambar: "#ffd166",
  prata: "#c9ccd6",
  lima: "#7dff8a", // reservado pra sinal de sucesso (meta batida) — não entra no ciclo decorativo
};
const SEQUENCIA = [PALETA.vermelho, PALETA.ambar, PALETA.prata, PALETA.laranja, PALETA.bordo];

const estado = {
  lojaSelecionada: null, // null = todas as lojas
  mes: null,             // 'YYYY-MM'; null = mês corrente (definido pela API)
  bootstrap: null,
  analytics: null,
  totalHojeConhecido: 0,
  primeiraCarga: true,
};

const graficos = { diario: null, lojas: null, donutMeta: null, donutCategoria: null, donutPagamento: null, aneis: [] };

// ==================== FORMATAÇÃO ====================
const fmtInt = new Intl.NumberFormat("pt-BR");

function moedaCurta(valor) {
  const n = Number(valor) || 0;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${fmtInt.format(Math.round(n))}`;
}

function moedaCheia(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** Converte 'YYYY-MM-DD' em Date local, sem passar por UTC (evita o
 *  clássico bug do dia que "anda" um para trás dependendo do fuso). */
function dataLocal(iso) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function rotuloMes(mesIso) {
  const d = dataLocal(`${mesIso}-01`);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

// ==================== CARREGAMENTO ====================
async function carregarTudo() {
  const params = new URLSearchParams();
  if (estado.lojaSelecionada) params.set("lojaId", estado.lojaSelecionada);
  if (estado.mes) params.set("mes", estado.mes);

  try {
    const [bootstrap, analytics] = await Promise.all([
      fetch(`${API}/bootstrap`).then((r) => r.json()),
      fetch(`${API}/analytics?${params}`).then((r) => r.json()),
    ]);
    estado.bootstrap = bootstrap;
    estado.analytics = analytics;
    estado.mes = analytics.periodo.mes;

    renderSidebar();
    renderTopbar();
    renderPainel();
    renderFeed();
    popularFormularios();
  } catch (erro) {
    console.error("Falha ao carregar dados:", erro);
    document.getElementById("rotuloMes").textContent = "erro ao carregar";
  }
}

// ==================== SIDEBAR / TOPBAR ====================
function renderSidebar() {
  const lista = document.getElementById("listaLojas");
  const vendasPorLoja = new Map(
    (estado.analytics.rankingLojas || []).map((l) => [l.loja, l.quantidade])
  );

  const itens = [{ id: null, nome: "Todas as lojas" }, ...estado.bootstrap.lojas];
  lista.innerHTML = itens
    .map((loja, i) => {
      const ativo = estado.lojaSelecionada === loja.id ? "active" : "";
      const cor = loja.id ? SEQUENCIA[(i - 1) % SEQUENCIA.length] : PALETA.vermelho;
      const qtd = loja.id
        ? vendasPorLoja.get(loja.nome) ?? 0
        : (estado.analytics.rankingLojas || []).reduce((s, l) => s + l.quantidade, 0);
      return `
        <button class="loja-item ${ativo}" data-loja="${loja.id ?? ""}">
          <span class="ponto" style="background:${cor}"></span>
          <span style="flex:1">${loja.nome}</span>
          <span class="qtd">${qtd}</span>
        </button>`;
    })
    .join("");

  lista.querySelectorAll(".loja-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const valor = btn.dataset.loja;
      estado.lojaSelecionada = valor ? Number(valor) : null;
      carregarTudo();
    });
  });
}

function renderTopbar() {
  const loja = estado.bootstrap.lojas.find((l) => l.id === estado.lojaSelecionada);
  document.getElementById("bcEscopo").textContent = loja ? loja.nome : "Todas as lojas";
  document.getElementById("rotuloMes").textContent = rotuloMes(estado.analytics.periodo.mes);
  document.getElementById("dataHoje").textContent = dataLocal(estado.analytics.periodo.hoje).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  // Não deixa navegar para meses no futuro: não existe venda lá.
  const hojeMes = estado.analytics.periodo.hoje.slice(0, 7);
  document.getElementById("mesProximo").disabled = estado.analytics.periodo.mes >= hojeMes;
}

function mudarMes(passo) {
  const [ano, mes] = estado.mes.split("-").map(Number);
  const d = new Date(ano, mes - 1 + passo, 1);
  estado.mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  carregarTudo();
}

document.getElementById("mesAnterior").addEventListener("click", () => mudarMes(-1));
document.getElementById("mesProximo").addEventListener("click", () => mudarMes(1));

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`view-${btn.dataset.view}`).classList.add("active");
  });
});

// ==================== GRÁFICOS ====================
function gradienteVertical(ctx, area, corTopo, corBase) {
  const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, corTopo);
  g.addColorStop(1, corBase);
  return g;
}

function criarDonut(canvasId, valores, cores, anterior) {
  if (anterior) anterior.destroy();
  return new Chart(document.getElementById(canvasId), {
    type: "doughnut",
    data: { datasets: [{ data: valores, backgroundColor: cores, borderWidth: 0, cutout: "76%", borderRadius: 6, spacing: 2 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 650 },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    },
  });
}

function renderPainel() {
  const { kpis, porDia, porModelo, porCategoria, porFormaPagamento, rankingLojas, rankingVendedores, metas } = estado.analytics;

  // ---------- KPIs em texto ----------
  document.getElementById("kpiFaturamento").textContent = moedaCurta(kpis.faturamento);
  document.getElementById("kpiVendas").textContent = fmtInt.format(kpis.vendas);
  document.getElementById("kpiTicket").textContent = moedaCurta(kpis.ticketMedio);
  document.getElementById("kpiDias").textContent = kpis.diasComVenda;

  // ---------- Donut: meta ----------
  const metaTotal = metas.reduce((s, m) => s + m.meta_mensal, 0);
  const acumuladoTotal = metas.reduce((s, m) => s + m.acumulado, 0);
  const pctMeta = metaTotal > 0 ? Math.round((acumuladoTotal / metaTotal) * 100) : 0;
  document.getElementById("donutMetaPct").textContent = `${pctMeta}%`;
  document.getElementById("legendaMeta").innerHTML = `<b>${acumuladoTotal}</b> de ${metaTotal} carros`;
  graficos.donutMeta = criarDonut(
    "donutMeta",
    [Math.min(acumuladoTotal, metaTotal), Math.max(0, metaTotal - acumuladoTotal)],
    [pctMeta >= 100 ? PALETA.lima : PALETA.vermelho, "rgba(255,255,255,0.06)"],
    graficos.donutMeta
  );

  // ---------- Donut: categoria ----------
  const totalCategoria = porCategoria.reduce((s, c) => s + c.quantidade, 0);
  document.getElementById("donutCategoriaTotal").textContent = fmtInt.format(totalCategoria);
  document.getElementById("legendaCategoria").innerHTML = porCategoria
    .map((c, i) => `<span style="color:${SEQUENCIA[i % SEQUENCIA.length]}">●</span> ${c.categoria} ${c.quantidade}`)
    .join(" &nbsp; ") || "sem vendas no mês";
  graficos.donutCategoria = criarDonut(
    "donutCategoria",
    porCategoria.map((c) => c.quantidade),
    porCategoria.map((_, i) => SEQUENCIA[i % SEQUENCIA.length]),
    graficos.donutCategoria
  );

  // ---------- Donut: forma de pagamento ----------
  const totalPgto = porFormaPagamento.reduce((s, f) => s + f.quantidade, 0);
  const financiado = porFormaPagamento.find((f) => f.forma_pagamento === "Financiado")?.quantidade ?? 0;
  document.getElementById("donutPagamentoPct").textContent = totalPgto ? `${Math.round((financiado / totalPgto) * 100)}%` : "0%";
  document.getElementById("legendaPagamento").innerHTML = porFormaPagamento
    .map((f, i) => `<span style="color:${SEQUENCIA[(i + 2) % SEQUENCIA.length]}">●</span> ${f.forma_pagamento} ${f.quantidade}`)
    .join(" &nbsp; ") || "sem vendas no mês";
  graficos.donutPagamento = criarDonut(
    "donutPagamento",
    porFormaPagamento.map((f) => f.quantidade),
    porFormaPagamento.map((_, i) => SEQUENCIA[(i + 2) % SEQUENCIA.length]),
    graficos.donutPagamento
  );

  // ---------- Barras: modelos ----------
  const topModelos = porModelo.slice(0, 5);
  const maiorModelo = topModelos[0]?.quantidade || 1;
  document.getElementById("barrasModelos").innerHTML = topModelos.length
    ? topModelos
        .map((m, i) => {
          const cor = SEQUENCIA[i % SEQUENCIA.length];
          const largura = Math.round((m.quantidade / maiorModelo) * 100);
          return `
            <div class="barra-item">
              <div class="barra-topo"><span>${m.modelo}</span><b>${m.quantidade}</b></div>
              <div class="barra-trilho">
                <div class="barra-preenchida" style="width:${largura}%;background:linear-gradient(90deg, ${cor}, ${cor}55)"></div>
              </div>
            </div>`;
        })
        .join("")
    : '<p class="vazio-msg">Sem vendas no mês.</p>';

  renderGraficoDiario(porDia);
  renderGraficoLojas(rankingLojas);
  renderCalendario(porDia);
  renderVendedores(rankingVendedores);
  renderAneisMetas(metas);
}

function renderGraficoDiario(porDia) {
  const nota = document.getElementById("notaVendasDia");
  if (graficos.diario) graficos.diario.destroy();

  if (!porDia.length) {
    nota.textContent = "sem vendas no mês";
    graficos.diario = null;
    return;
  }
  const melhor = porDia.reduce((a, b) => (b.quantidade > a.quantidade ? b : a));
  nota.textContent = `melhor dia: ${dataLocal(melhor.dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} (${melhor.quantidade})`;

  graficos.diario = new Chart(document.getElementById("chartDiario"), {
    type: "line",
    data: {
      labels: porDia.map((d) => dataLocal(d.dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })),
      datasets: [
        {
          label: "Carros vendidos",
          data: porDia.map((d) => d.quantidade),
          borderColor: PALETA.ambar,
          borderWidth: 2.5,
          tension: 0.38,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: PALETA.ambar,
          fill: true,
          backgroundColor: (ctx) => {
            const { ctx: c, chartArea } = ctx.chart;
            if (!chartArea) return "transparent";
            return gradienteVertical(c, chartArea, "rgba(255,209,102,0.35)", "rgba(255,209,102,0)");
          },
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700 },
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(10,4,5,0.95)",
          borderColor: "rgba(255,70,70,0.35)",
          borderWidth: 1,
          padding: 11,
          callbacks: {
            label: (item) => {
              const linha = porDia[item.dataIndex];
              return `  ${linha.quantidade} carro(s) · ${moedaCurta(linha.faturamento)}`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { color: "#8f6567", maxRotation: 0, autoSkipPadding: 18, font: { size: 11 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: "#8f6567", precision: 0, font: { size: 11 } }, grid: { color: "rgba(255,255,255,0.05)" } },
      },
    },
  });
}

function renderGraficoLojas(ranking) {
  if (graficos.lojas) graficos.lojas.destroy();
  const canvas = document.getElementById("chartLojas");
  if (!ranking.length) {
    canvas.style.display = "none";
    graficos.lojas = null;
    return;
  }
  canvas.style.display = "";
  graficos.lojas = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ranking.map((l) => l.loja),
      datasets: [
        {
          data: ranking.map((l) => l.quantidade),
          backgroundColor: (ctx) => {
            const { ctx: c, chartArea } = ctx.chart;
            if (!chartArea) return PALETA.vermelho;
            const cor = SEQUENCIA[ctx.dataIndex % SEQUENCIA.length];
            const g = c.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
            g.addColorStop(0, `${cor}33`);
            g.addColorStop(1, cor);
            return g;
          },
          borderRadius: 7,
          barThickness: 20,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 650 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(10,4,5,0.95)",
          padding: 10,
          callbacks: { label: (item) => `  ${item.raw} carro(s) · ${moedaCurta(ranking[item.dataIndex].faturamento)}` },
        },
      },
      scales: {
        x: { beginAtZero: true, ticks: { color: "#8f6567", precision: 0, font: { size: 11 } }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#f4eeff", font: { size: 12, weight: "600" } }, grid: { display: false } },
      },
    },
  });
}

// ==================== CALENDÁRIO ====================
function renderCalendario(porDia) {
  const { primeiro_dia, ultimo_dia, hoje } = estado.analytics.periodo;
  const porDiaMapa = new Map(porDia.map((d) => [d.dia, d.quantidade]));
  const maior = Math.max(1, ...porDia.map((d) => d.quantidade));

  const inicio = dataLocal(primeiro_dia);
  const fim = dataLocal(ultimo_dia);
  const diasNoMes = fim.getDate();
  const primeiroDiaSemana = inicio.getDay(); // 0 = domingo

  const cabecalhos = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    .map((d) => `<div class="cal-cabecalho">${d}</div>`)
    .join("");

  const vazios = Array.from({ length: primeiroDiaSemana }, () => '<div class="cal-dia vazio"></div>').join("");

  const dias = Array.from({ length: diasNoMes }, (_, i) => {
    const numero = i + 1;
    const iso = `${primeiro_dia.slice(0, 7)}-${String(numero).padStart(2, "0")}`;
    const qtd = porDiaMapa.get(iso) ?? 0;
    // 5 faixas de intensidade, proporcionais ao melhor dia do mês.
    const nivel = qtd === 0 ? 0 : Math.min(4, Math.ceil((qtd / maior) * 4));
    const ehHoje = iso === hoje ? "hoje" : "";
    return `
      <div class="cal-dia n${nivel} ${ehHoje}" title="${dataLocal(iso).toLocaleDateString("pt-BR")}: ${qtd} carro(s) vendido(s)">
        <span class="cal-data">${numero}</span>
        <span class="cal-total">${qtd}</span>
        <span class="cal-rotulo">${qtd === 1 ? "venda" : "vendas"}</span>
      </div>`;
  }).join("");

  document.getElementById("calendario").innerHTML = cabecalhos + vazios + dias;
}

// ==================== LISTAS ====================
function renderVendedores(ranking) {
  const el = document.getElementById("listaVendedores");
  if (!ranking.length) {
    el.innerHTML = '<p class="vazio-msg">Sem vendas no mês.</p>';
    return;
  }
  el.innerHTML = ranking
    .map(
      (v, i) => `
      <div class="ranking-item">
        <div class="ranking-pos">${i + 1}</div>
        <div class="ranking-info"><b>${v.vendedor}</b><small>${v.loja} · ${moedaCurta(v.faturamento)}</small></div>
        <div class="ranking-valor">${v.quantidade}</div>
      </div>`
    )
    .join("");
}

function renderAneisMetas(metas) {
  graficos.aneis.forEach((g) => g.destroy());
  graficos.aneis = [];

  const grid = document.getElementById("aneisMetas");
  grid.innerHTML = metas
    .map((m, i) => {
      const pct = m.meta_mensal > 0 ? Math.round((m.acumulado / m.meta_mensal) * 100) : 0;
      return `
        <div class="anel">
          <div class="anel-wrap">
            <canvas id="anel-${m.loja_id}"></canvas>
            <div class="anel-centro"><b style="color:${pct >= 100 ? PALETA.lima : SEQUENCIA[i % SEQUENCIA.length]}">${pct}%</b></div>
          </div>
          <div class="anel-nome">${m.loja}</div>
          <div class="anel-sub">${m.acumulado} / ${m.meta_mensal} carros</div>
        </div>`;
    })
    .join("");

  metas.forEach((m, i) => {
    const pct = m.meta_mensal > 0 ? Math.min(100, (m.acumulado / m.meta_mensal) * 100) : 0;
    const cor = pct >= 100 ? PALETA.lima : SEQUENCIA[i % SEQUENCIA.length];
    graficos.aneis.push(
      new Chart(document.getElementById(`anel-${m.loja_id}`), {
        type: "doughnut",
        data: { datasets: [{ data: [pct, 100 - pct], backgroundColor: [cor, "rgba(255,255,255,0.06)"], borderWidth: 0, cutout: "74%", borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: { duration: 650 }, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
      })
    );
  });
}

function renderFeed() {
  const el = document.getElementById("feedUltimos");
  const lancamentos = estado.bootstrap.ultimosLancamentos;
  if (!lancamentos.length) {
    el.innerHTML = '<p class="vazio-msg">Nenhuma venda lançada ainda.</p>';
    return;
  }
  el.innerHTML = lancamentos
    .map((v) => {
      const dt = new Date(v.criado_em);
      const quando = `${dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      const cliente = v.cliente_nome ? ` para <b>${v.cliente_nome}</b>` : "";
      return `<div class="feed-item">
          <span class="feed-hora">${quando}</span>
          <span class="tag-loja">${v.loja_nome}</span>
          <span><b>${v.vendedor_nome}</b> vendeu ${v.quantidade}x ${v.modelo_nome}${cliente}</span>
        </div>`;
    })
    .join("");
}

// ==================== CELEBRAÇÃO DE VENDA ====================
const CORES_CONFETE = [PALETA.vermelho, PALETA.laranja, PALETA.ambar, PALETA.prata, PALETA.bordo];
let timerCelebracao = null;

function celebrarVenda({ vendedor, modelo, loja, quantidade }) {
  const el = document.getElementById("celebracaoVenda");
  el.innerHTML = `
    <div class="celebracao-cartao">
      <span class="celebracao-icone">🚗</span>
      <div class="celebracao-texto">
        <b>${vendedor} vendeu!</b>
        <small>${quantidade}x ${modelo} · ${loja}</small>
      </div>
    </div>`;
  el.classList.add("mostrar");

  for (let i = 0; i < 28; i++) {
    const peca = document.createElement("span");
    peca.className = "confete";
    peca.style.left = `${Math.random() * 100}vw`;
    peca.style.background = CORES_CONFETE[i % CORES_CONFETE.length];
    peca.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    peca.style.animationDuration = `${1.5 + Math.random() * 1.3}s`;
    peca.style.animationDelay = `${Math.random() * 0.25}s`;
    document.body.appendChild(peca);
    setTimeout(() => peca.remove(), 3200);
  }

  clearTimeout(timerCelebracao);
  timerCelebracao = setTimeout(() => el.classList.remove("mostrar"), 3400);
}

// ==================== FORMULÁRIOS ====================
function popularFormularios() {
  const selLoja = document.getElementById("selLoja");
  const cadLoja = document.getElementById("cadLoja");
  const opcoes = estado.bootstrap.lojas.map((l) => `<option value="${l.id}">${l.nome}</option>`).join("");
  if (selLoja.options.length !== estado.bootstrap.lojas.length) {
    selLoja.innerHTML = opcoes;
    cadLoja.innerHTML = opcoes;
  }
  const selModelo = document.getElementById("selModelo");
  if (!selModelo.options.length) {
    selModelo.innerHTML = estado.bootstrap.modelos.map((m) => `<option value="${m.id}">${m.nome}</option>`).join("");
  }
  atualizarVendedores();
}

function atualizarVendedores() {
  const lojaId = Number(document.getElementById("selLoja").value);
  const sel = document.getElementById("selVendedor");
  const daLoja = estado.bootstrap.vendedores.filter((v) => v.loja_id === lojaId);
  sel.innerHTML = daLoja.length
    ? daLoja.map((v) => `<option value="${v.id}">${v.nome}</option>`).join("")
    : '<option value="">(sem vendedor nessa loja)</option>';
}
document.getElementById("selLoja").addEventListener("change", atualizarVendedores);

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
    const resposta = await fetch(`${API}/vendas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || "Erro ao registrar venda.");
    status.textContent = "Venda registrada!";
    status.className = "status-msg ok";
    celebrarVenda({
      vendedor: document.getElementById("selVendedor").selectedOptions[0]?.textContent || "Vendedor",
      modelo: document.getElementById("selModelo").selectedOptions[0]?.textContent || "carro",
      loja: document.getElementById("selLoja").selectedOptions[0]?.textContent || "",
      quantidade: corpo.quantidade,
    });
    document.getElementById("txtCliente").value = "";
    document.getElementById("numQtd").value = 1;
    await carregarTudo();
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
    const resposta = await fetch(`${API}/vendas/ultima`, { method: "DELETE" });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || "Erro ao desfazer.");
    status.textContent = "Último lançamento removido.";
    status.className = "status-msg ok";
    await carregarTudo();
  } catch (erro) {
    status.textContent = erro.message;
    status.className = "status-msg err";
  }
});

document.getElementById("formVendedor").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const status = document.getElementById("statusVendedor");
  status.textContent = "Salvando...";
  status.className = "status-msg";
  try {
    const resposta = await fetch(`${API}/vendedores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lojaId: Number(document.getElementById("cadLoja").value),
        nome: document.getElementById("cadNome").value.trim(),
      }),
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || "Erro ao cadastrar.");
    status.textContent = "Vendedor cadastrado.";
    status.className = "status-msg ok";
    document.getElementById("cadNome").value = "";
    await carregarTudo();
  } catch (erro) {
    status.textContent = erro.message;
    status.className = "status-msg err";
  }
});

// ==================== INÍCIO ====================
carregarTudo();
setInterval(carregarTudo, 30000);

/* Depois de vários ciclos de destroy()+new Chart() no mesmo canvas
 * (troca de loja, de mês, nova venda), o ResizeObserver interno do
 * Chart.js às vezes não recalcula a largura do canvas quando a janela
 * muda de tamanho depois disso — o canvas fica "preso" na largura de
 * quando foi criado e empurra o card para fora da tela. Forçar
 * resize() em todo gráfico vivo corrige isso de forma explícita. */
window.addEventListener("resize", () => {
  Object.values(graficos).forEach((g) => {
    if (Array.isArray(g)) g.forEach((c) => c?.resize());
    else g?.resize();
  });
});

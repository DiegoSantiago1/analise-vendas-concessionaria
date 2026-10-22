// Painel de Vendas — Grupo Horizonte Honda (dados fictícios)
// JS puro, consumindo a API REST em server/. Sem framework: o tamanho
// desta tela não justifica React aqui, e a dependência não agregaria
// nada que já não seja resolvido com fetch + Chart.js.
//
// A tela responde uma pergunta primeiro: a rede vai bater a meta do mês?
// Por isso o maior bloco é o acumulado do mês contra o ritmo da meta, e a
// frase embaixo do título diz quanto falta e qual loja está mais longe.

const API = "/api";

// Cores da marca: vermelho Honda na linha do mês (com a área embaixo), cinza para
// o ritmo da meta, grade discreta sobre o card grafite.
const COR = {
  dado: "#ff2433",
  area: "rgba(230, 0, 18, 0.22)",
  cinza: "#8b8b93",
  grade: "#26262b",
  rotulo: "#a1a1aa",
};

const estado = {
  lojaSelecionada: null, // null = todas as lojas
  mes: null,             // 'YYYY-MM'; null = mês corrente (definido pela API)
  bootstrap: null,
  analytics: null,
  serie: "carros",       // série do gráfico principal: "carros" ou "faturamento"
  todosVendedores: false,
  ultimaVendaId: null,   // id da última venda lançada NESTA sessão (só ela pode ser desfeita)
  contagemRede: null,    // vendas por loja da rede inteira no mês (para a lateral)
};

const graficos = { ritmo: null };

// ==================== FORMATAÇÃO ====================
const fmtInt = new Intl.NumberFormat("pt-BR");

function moedaCurta(valor) {
  const n = Number(valor) || 0;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${fmtInt.format(Math.round(n))}`;
}

/** Escapa texto antes de entrar em innerHTML. Nome de cliente, de vendedor,
 *  de loja e de modelo vêm do banco e, em última instância, de quem digita:
 *  sem escapar, um "<img onerror=...>" digitado num campo executaria como
 *  código no navegador de todo mundo que abrir o painel (XSS armazenado). */
function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Converte 'YYYY-MM-DD' em Date local, sem passar por UTC (evita o
 *  clássico bug do dia que "anda" um para trás dependendo do fuso). */
function dataLocal(iso) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

/** O banco guarda a forma de pagamento sem acento (valor estável, igual ao
 *  CHECK do schema); a tela mostra o nome com acento. */
const ROTULOS_PAGAMENTO = { "A vista": "À vista", Consorcio: "Consórcio" };
const rotuloPagamento = (valor) => ROTULOS_PAGAMENTO[valor] ?? valor;

function rotuloMes(mesIso) {
  const texto = dataLocal(`${mesIso}-01`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const pct = (parte, todo) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);

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

    renderLateral();
    renderTitulo();
    renderPainel();
    renderFeed();
    popularFormularios();
  } catch (erro) {
    console.error("Falha ao carregar dados:", erro);
    document.getElementById("achado").textContent =
      "Não foi possível carregar os dados. Confira se a API está no ar e recarregue a página.";
  }
}

// ==================== LATERAL / TÍTULO ====================
function renderLateral() {
  const lista = document.getElementById("listaLojas");
  // As contagens da lateral são da rede inteira. Com uma loja filtrada, a
  // consulta só traz aquela loja: usa as contagens guardadas da última vez em
  // que a rede inteira deste mês foi carregada, ou não mostra número nenhum
  // (mostrar 0 nas outras lojas seria mentira).
  const { mes } = estado.analytics.periodo;
  if (estado.lojaSelecionada === null) {
    const ranking = estado.analytics.rankingLojas || [];
    estado.contagemRede = {
      mes,
      porLoja: new Map(ranking.map((l) => [l.loja, l.quantidade])),
      total: ranking.reduce((s, l) => s + l.quantidade, 0),
    };
  }
  const contagem = estado.contagemRede?.mes === mes ? estado.contagemRede : null;

  const itens = [{ id: null, nome: "Todas as lojas" }, ...estado.bootstrap.lojas];
  lista.innerHTML = itens
    .map((loja) => {
      const ativo = estado.lojaSelecionada === loja.id ? "ativo" : "";
      const qtd = !contagem ? "" : loja.id ? contagem.porLoja.get(loja.nome) ?? 0 : contagem.total;
      return `
        <button class="loja-item ${ativo}" data-loja="${loja.id ?? ""}" type="button" aria-pressed="${ativo ? "true" : "false"}">
          <span>${esc(loja.nome)}</span>
          <span class="qtd">${qtd}</span>
        </button>`;
    })
    .join("");

  lista.querySelectorAll(".loja-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const valor = btn.dataset.loja;
      estado.lojaSelecionada = valor ? Number(valor) : null;
      fecharMenu();
      carregarTudo();
    });
  });
}

function renderTitulo() {
  const loja = estado.bootstrap.lojas.find((l) => l.id === estado.lojaSelecionada);
  document.getElementById("bcEscopo").textContent = loja ? loja.nome : "Todas as lojas";
  document.getElementById("rotuloMes").textContent = rotuloMes(estado.analytics.periodo.mes);
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

// ==================== NAVEGAÇÃO ====================
const TITULOS_VIEW = { painel: "Painel", lancamento: "Lançar venda" };

function irPara(view) {
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("ativo", b.dataset.view === view));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("ativa", v.id === `view-${view}`));
  document.getElementById("tituloCelular").textContent = TITULOS_VIEW[view];
  fecharMenu();
  window.scrollTo({ top: 0 });
}

document.querySelectorAll(".nav-item").forEach((btn) => btn.addEventListener("click", () => irPara(btn.dataset.view)));
document.querySelectorAll("[data-ir]").forEach((btn) => btn.addEventListener("click", () => irPara(btn.dataset.ir)));

const botaoMenu = document.getElementById("botaoMenu");
function fecharMenu() {
  document.getElementById("lateral").classList.remove("aberta");
  botaoMenu.setAttribute("aria-expanded", "false");
  botaoMenu.textContent = "Menu";
}
botaoMenu.addEventListener("click", () => {
  const aberta = document.getElementById("lateral").classList.toggle("aberta");
  botaoMenu.setAttribute("aria-expanded", String(aberta));
  botaoMenu.textContent = aberta ? "Fechar" : "Menu";
});

// ==================== PAINEL ====================
function totaisDaMeta(metas) {
  const meta = metas.reduce((s, m) => s + m.meta_mensal, 0);
  const vendidos = metas.reduce((s, m) => s + m.acumulado, 0);
  return { meta, vendidos, falta: Math.max(0, meta - vendidos) };
}

function renderPainel() {
  const { kpis, porDia, porModelo, porCategoria, porFormaPagamento, rankingLojas, rankingVendedores, metas } = estado.analytics;
  const total = totaisDaMeta(metas);

  document.getElementById("kpiCarros").textContent = fmtInt.format(total.vendidos);
  document.getElementById("kpiMeta").textContent = `de ${fmtInt.format(total.meta)}`;
  document.getElementById("kpiFaturamento").textContent = moedaCurta(kpis.faturamento);
  document.getElementById("kpiTicket").textContent = kpis.vendas ? moedaCurta(kpis.ticketMedio) : "—";
  document.getElementById("kpiDias").textContent = kpis.diasComVenda;

  renderAchado(total, metas);
  renderRitmo(porDia, total);
  renderTabelaLojas(metas, rankingLojas);
  renderTabelaVendedores(rankingVendedores);
  renderBarras("barrasModelos", porModelo.slice(0, 7).map((m) => ({ nome: m.modelo, valor: m.quantidade })));
  renderBarras(
    "barrasPagamento",
    porFormaPagamento.map((f) => ({ nome: rotuloPagamento(f.forma_pagamento), valor: f.quantidade })),
    true
  );
  renderBarras("barrasCategoria", porCategoria.map((c) => ({ nome: c.categoria, valor: c.quantidade })), true);
  renderCalendario(porDia);
}

/** A frase sob o título: o achado do mês, perto do botão que age sobre ele. */
function renderAchado(total, metas) {
  const el = document.getElementById("achado");
  const { ultimo_dia, hoje } = estado.analytics.periodo;
  const fechado = hoje > ultimo_dia;
  const p = pct(total.vendidos, total.meta);

  if (!total.meta) {
    el.textContent = "Sem meta cadastrada para este mês.";
    return;
  }
  let frase;
  if (total.vendidos >= total.meta) {
    frase = `Meta batida: ${total.vendidos} de ${total.meta} carros (${p}%).`;
  } else if (fechado) {
    frase = `Fechou com ${total.vendidos} de ${total.meta} carros (${p}%): <span class="falta">faltaram ${total.falta}</span>.`;
  } else {
    const dia = dataLocal(hoje).getDate();
    const diasNoMes = dataLocal(ultimo_dia).getDate();
    const noRitmo = Math.round((total.meta * dia) / diasNoMes);
    frase = `${total.vendidos} de ${total.meta} carros até o dia ${dia} de ${diasNoMes}; no ritmo da meta seriam ${noRitmo}. <span class="falta">Faltam ${total.falta}</span>.`;
  }
  // Com todas as lojas na tela, diz qual está mais longe da própria meta.
  if (metas.length > 1) {
    const pior = metas
      .filter((m) => m.meta_mensal > 0)
      .reduce((a, b) => (b.acumulado / b.meta_mensal < a.acumulado / a.meta_mensal ? b : a));
    const pPior = pct(pior.acumulado, pior.meta_mensal);
    if (pPior < 100) frase += ` ${esc(pior.loja)} está mais longe da meta, com ${pPior}%.`;
  }
  el.innerHTML = frase;
}

// ---------- gráfico principal: acumulado do mês contra o ritmo da meta ----------
function serieAcumulada(porDia, campo, ultimoDiaComDado) {
  const porData = new Map(porDia.map((d) => [Number(d.dia.slice(8, 10)), Number(d[campo]) || 0]));
  const valores = [];
  let soma = 0;
  for (let dia = 1; dia <= ultimoDiaComDado; dia++) {
    soma += porData.get(dia) ?? 0;
    valores.push(soma);
  }
  return valores;
}

function renderRitmo(porDia, total) {
  const { ultimo_dia, hoje } = estado.analytics.periodo;
  const diasNoMes = dataLocal(ultimo_dia).getDate();
  // Mês corrente: a linha para no dia de hoje; mês fechado: vai até o fim.
  const ateDia = hoje > ultimo_dia ? diasNoMes : Math.min(diasNoMes, dataLocal(hoje).getDate());
  const labels = Array.from({ length: diasNoMes }, (_, i) => i + 1);
  const ehCarros = estado.serie === "carros";

  const acumulado = serieAcumulada(porDia, ehCarros ? "quantidade" : "faturamento", ateDia);
  const datasets = [
    {
      label: ehCarros ? "Carros vendidos (acumulado)" : "Faturamento (acumulado)",
      data: acumulado,
      borderColor: COR.dado,
      borderWidth: 2.5,
      tension: 0,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: COR.dado,
      fill: "origin",
      backgroundColor: COR.area,
    },
  ];
  if (ehCarros && total.meta) {
    datasets.push({
      label: "Ritmo da meta",
      data: labels.map((d) => Math.round((total.meta * d * 10) / diasNoMes) / 10),
      borderColor: COR.cinza,
      borderWidth: 1.5,
      borderDash: [5, 4],
      tension: 0,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
    });
  }

  document.getElementById("legendaRitmo").innerHTML = ehCarros
    ? '<span><i></i>Carros vendidos no mês</span><span><i class="meta"></i>Ritmo para bater a meta</span>'
    : "<span><i></i>Faturamento acumulado no mês</span>";
  const ultimo = acumulado.at(-1) ?? 0;
  document.getElementById("notaRitmo").textContent = porDia.length
    ? ehCarros
      ? `${fmtInt.format(ultimo)} carros até o dia ${ateDia}`
      : `${moedaCurta(ultimo)} até o dia ${ateDia}`
    : "Sem vendas neste mês";

  if (graficos.ritmo) graficos.ritmo.destroy();
  graficos.ritmo = new Chart(document.getElementById("chartRitmo"), {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#000000",
          borderColor: "#e60012",
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          titleFont: { family: "Geist", weight: "500" },
          bodyFont: { family: "Geist" },
          callbacks: {
            title: (itens) => `Dia ${itens[0].label}`,
            label: (item) => {
              const v = item.raw;
              if (item.datasetIndex === 1) return `Ritmo da meta: ${fmtInt.format(Math.round(v))}`;
              return ehCarros ? `Vendidos até aqui: ${fmtInt.format(v)}` : `Faturado até aqui: ${moedaCurta(v)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: COR.grade },
          ticks: { color: COR.rotulo, maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { family: "Geist", size: 12 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: COR.grade },
          border: { display: false },
          ticks: {
            color: COR.rotulo,
            maxTicksLimit: 5,
            precision: 0,
            font: { family: "Geist", size: 12 },
            callback: (v) => (ehCarros ? fmtInt.format(v) : moedaCurta(v)),
          },
        },
      },
    },
  });
}

document.querySelectorAll("button.kpi").forEach((btn) => {
  btn.addEventListener("click", () => {
    estado.serie = btn.dataset.serie;
    document.querySelectorAll("button.kpi").forEach((b) => {
      const ativo = b === btn;
      b.classList.toggle("ativo", ativo);
      b.setAttribute("aria-selected", String(ativo));
    });
    if (estado.analytics) renderRitmo(estado.analytics.porDia, totaisDaMeta(estado.analytics.metas));
  });
});

// ---------- tabelas ----------
function renderTabelaLojas(metas, rankingLojas) {
  const corpo = document.getElementById("tabelaLojas");
  if (!metas.length) {
    corpo.innerHTML = '<tr><td colspan="4" class="vazio">Sem meta cadastrada para este mês.</td></tr>';
    return;
  }
  const faturamento = new Map((rankingLojas || []).map((l) => [l.loja, l.faturamento]));
  const ordenadas = [...metas].sort((a, b) => b.acumulado / (b.meta_mensal || 1) - a.acumulado / (a.meta_mensal || 1));
  corpo.innerHTML = ordenadas
    .map((m) => {
      const p = pct(m.acumulado, m.meta_mensal);
      const largura = Math.min(100, p);
      const marca = p >= 100 ? '<span class="pilula">meta batida</span>' : `<span class="meta-pct abaixo">${p}%</span>`;
      return `
        <tr>
          <td>${esc(m.loja)}</td>
          <td class="num">${m.acumulado} <span class="traco">/ ${m.meta_mensal}</span></td>
          <td class="meta-celula">
            <div class="meta-barra">
              <div class="meta-trilho" role="img" aria-label="${p}% da meta"><div class="meta-preenchido" style="width:${largura}%"></div></div>
              ${marca}
            </div>
          </td>
          <td class="num">${faturamento.has(m.loja) ? moedaCurta(faturamento.get(m.loja)) : '<span class="traco">—</span>'}</td>
        </tr>`;
    })
    .join("");
}

function renderTabelaVendedores(ranking) {
  const corpo = document.getElementById("tabelaVendedores");
  const botao = document.getElementById("verTodosVendedores");
  if (!ranking.length) {
    corpo.innerHTML = '<tr><td colspan="4" class="vazio">Nenhuma venda neste mês.</td></tr>';
    botao.hidden = true;
    return;
  }
  const limite = estado.todosVendedores ? ranking.length : 5;
  botao.hidden = ranking.length <= 5;
  botao.textContent = estado.todosVendedores ? "Ver só os 5 primeiros" : `Ver todos (${ranking.length})`;
  corpo.innerHTML = ranking
    .slice(0, limite)
    .map(
      (v, i) => `
      <tr>
        <td class="num pos">${i + 1}</td>
        <td><span class="nome">${esc(v.vendedor)}</span><span class="sub">${esc(v.loja)}</span></td>
        <td class="num">${v.quantidade}</td>
        <td class="num">${moedaCurta(v.faturamento)}</td>
      </tr>`
    )
    .join("");
}

document.getElementById("verTodosVendedores").addEventListener("click", () => {
  estado.todosVendedores = !estado.todosVendedores;
  if (estado.analytics) renderTabelaVendedores(estado.analytics.rankingVendedores);
});

// ---------- barras em tinta ----------
function renderBarras(id, itens, comPercentual = false) {
  const el = document.getElementById(id);
  if (!itens.length) {
    el.innerHTML = '<p class="vazio">Nenhuma venda neste mês.</p>';
    return;
  }
  const maior = Math.max(...itens.map((i) => i.valor), 1);
  const soma = itens.reduce((s, i) => s + i.valor, 0);
  el.innerHTML = itens
    .map((item) => {
      const largura = Math.round((item.valor / maior) * 100);
      const parte = comPercentual ? `<small>${pct(item.valor, soma)}%</small>` : "";
      return `
        <div class="barra">
          <div class="barra-topo"><span class="barra-nome">${esc(item.nome)}</span><span class="barra-valor">${item.valor}${parte}</span></div>
          <div class="barra-trilho"><div class="barra-preenchida" style="width:${largura}%"></div></div>
        </div>`;
    })
    .join("");
}

// ---------- calendário ----------
function renderCalendario(porDia) {
  const { primeiro_dia, ultimo_dia, hoje } = estado.analytics.periodo;
  const porDiaMapa = new Map(porDia.map((d) => [d.dia, d.quantidade]));
  const maior = Math.max(0, ...porDia.map((d) => d.quantidade));
  const melhor = porDia.length ? porDia.reduce((a, b) => (b.quantidade > a.quantidade ? b : a)) : null;

  const inicio = dataLocal(primeiro_dia);
  const diasNoMes = dataLocal(ultimo_dia).getDate();
  const primeiroDiaSemana = inicio.getDay(); // 0 = domingo

  const cabecalhos = ["D", "S", "T", "Q", "Q", "S", "S"]
    .map((d, i) => `<div class="cal-cabecalho" title="${["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][i]}">${d}</div>`)
    .join("");
  const vazios = Array.from({ length: primeiroDiaSemana }, () => '<div class="cal-dia vazio"></div>').join("");

  const dias = Array.from({ length: diasNoMes }, (_, i) => {
    const numero = i + 1;
    const iso = `${primeiro_dia.slice(0, 7)}-${String(numero).padStart(2, "0")}`;
    const qtd = porDiaMapa.get(iso) ?? 0;
    // 5 faixas de intensidade, proporcionais ao melhor dia do mês.
    const nivel = qtd === 0 || maior === 0 ? 0 : Math.min(4, Math.ceil((qtd / maior) * 4));
    const classes = ["cal-dia", `n${nivel}`, iso === hoje ? "hoje" : "", melhor && iso === melhor.dia ? "melhor" : ""].join(" ");
    const titulo = `${dataLocal(iso).toLocaleDateString("pt-BR")}: ${qtd} carro(s)`;
    return `<div class="${classes}" title="${titulo}"><span class="cal-data">${numero}</span><span class="cal-total">${qtd}</span></div>`;
  }).join("");

  document.getElementById("calendario").innerHTML = cabecalhos + vazios + dias;
  document.getElementById("escalaMaximo").textContent = maior;
  document.getElementById("notaCalendario").textContent = melhor
    ? `melhor dia: ${dataLocal(melhor.dia).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}, ${melhor.quantidade} carros`
    : "sem vendas";
}

// ==================== ÚLTIMOS LANÇAMENTOS ====================
function renderFeed() {
  const el = document.getElementById("feedUltimos");
  const lancamentos = estado.bootstrap.ultimosLancamentos;
  if (!lancamentos.length) {
    el.innerHTML = '<p class="vazio">Nenhuma venda lançada ainda.</p>';
    return;
  }
  el.innerHTML = lancamentos
    .map((v) => {
      const dt = new Date(v.criado_em);
      const quando = `${dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      const cliente = v.cliente_nome ? ` para ${esc(v.cliente_nome)}` : "";
      return `<div class="feed-item">
          <span class="feed-hora">${quando}</span>
          <span>${esc(v.vendedor_nome)} vendeu ${v.quantidade}x ${esc(v.modelo_nome)}${cliente}</span>
          <span class="feed-loja">${esc(v.loja_nome)}</span>
        </div>`;
    })
    .join("");
}

// ==================== AVISO DE VENDA LANÇADA ====================
let timerAviso = null;

function avisarVenda({ vendedor, modelo, loja, quantidade }) {
  const el = document.getElementById("avisoVenda");
  el.innerHTML = `<b>${esc(vendedor)} vendeu ${quantidade}x ${esc(modelo)}</b><small>${esc(loja)} · já está no painel</small>`;
  el.classList.add("mostrar");
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove("mostrar"), 3600);
}

// ==================== FORMULÁRIOS ====================
function popularFormularios() {
  const selLoja = document.getElementById("selLoja");
  const cadLoja = document.getElementById("cadLoja");
  const opcoes = estado.bootstrap.lojas.map((l) => `<option value="${l.id}">${esc(l.nome)}</option>`).join("");
  if (selLoja.options.length !== estado.bootstrap.lojas.length) {
    selLoja.innerHTML = opcoes;
    cadLoja.innerHTML = opcoes;
  }
  const selModelo = document.getElementById("selModelo");
  if (!selModelo.options.length) {
    selModelo.innerHTML = estado.bootstrap.modelos.map((m) => `<option value="${m.id}">${esc(m.nome)}</option>`).join("");
  }
  atualizarVendedores();
}

function atualizarVendedores() {
  const lojaId = Number(document.getElementById("selLoja").value);
  const sel = document.getElementById("selVendedor");
  const atual = sel.value;
  const daLoja = estado.bootstrap.vendedores.filter((v) => v.loja_id === lojaId);
  sel.innerHTML = daLoja.length
    ? daLoja.map((v) => `<option value="${v.id}">${esc(v.nome)}</option>`).join("")
    : '<option value="">(sem vendedor nessa loja)</option>';
  // A atualização a cada 30 s não pode trocar o vendedor que a pessoa escolheu.
  if (daLoja.some((v) => String(v.id) === atual)) sel.value = atual;
}
document.getElementById("selLoja").addEventListener("change", atualizarVendedores);

function mostrarStatus(id, texto, tipo = "") {
  const el = document.getElementById(id);
  el.textContent = texto;
  el.className = `status ${tipo}`.trim();
}

document.getElementById("formVenda").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarStatus("statusVenda", "Registrando…");

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
    mostrarStatus("statusVenda", "Venda registrada.", "ok");
    estado.ultimaVendaId = dados.id;
    atualizarBotaoDesfazer();
    avisarVenda({
      vendedor: document.getElementById("selVendedor").selectedOptions[0]?.textContent || "Vendedor",
      modelo: document.getElementById("selModelo").selectedOptions[0]?.textContent || "carro",
      loja: document.getElementById("selLoja").selectedOptions[0]?.textContent || "",
      quantidade: corpo.quantidade,
    });
    document.getElementById("txtCliente").value = "";
    document.getElementById("numQtd").value = 1;
    // Vai para o mês da venda lançada, para ela aparecer nos gráficos mesmo
    // se o painel estava mostrando um mês anterior.
    const lancada = new Date(dados.criadoEm);
    if (!Number.isNaN(lancada.getTime())) {
      estado.mes = `${lancada.getFullYear()}-${String(lancada.getMonth() + 1).padStart(2, "0")}`;
    }
    await carregarTudo();
  } catch (erro) {
    mostrarStatus("statusVenda", erro.message, "erro");
  }
});

// "Desfazer" só vale para a venda lançada por esta própria sessão: apagar "a
// última venda do banco" podia remover o lançamento de outra pessoa.
function atualizarBotaoDesfazer() {
  const botao = document.getElementById("btnDesfazer");
  botao.disabled = estado.ultimaVendaId === null;
  botao.title = botao.disabled ? "Disponível depois que você lançar uma venda" : "Remove a venda que você acabou de lançar";
}
atualizarBotaoDesfazer();

document.getElementById("btnDesfazer").addEventListener("click", async () => {
  if (estado.ultimaVendaId === null) return;
  mostrarStatus("statusVenda", "Removendo…");
  try {
    const resposta = await fetch(`${API}/vendas/${estado.ultimaVendaId}`, { method: "DELETE" });
    const dados = await resposta.json();
    // 404 = já não existe (alguém removeu antes): o estado local também deve limpar.
    if (!resposta.ok && resposta.status !== 404) throw new Error(dados.erro || "Erro ao desfazer.");
    mostrarStatus("statusVenda", resposta.ok ? "Seu último lançamento foi removido." : dados.erro, resposta.ok ? "ok" : "erro");
    estado.ultimaVendaId = null;
    atualizarBotaoDesfazer();
    await carregarTudo();
  } catch (erro) {
    mostrarStatus("statusVenda", erro.message, "erro");
  }
});

document.getElementById("formVendedor").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarStatus("statusVendedor", "Salvando…");
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
    mostrarStatus("statusVendedor", "Vendedor cadastrado.", "ok");
    document.getElementById("cadNome").value = "";
    await carregarTudo();
  } catch (erro) {
    mostrarStatus("statusVendedor", erro.message, "erro");
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
  Object.values(graficos).forEach((g) => g?.resize());
});

// Versão de demonstração do painel: substitui a API REST (Node + PostgreSQL)
// por uma que roda inteira no navegador, para o painel poder ser publicado
// no GitHub Pages, que só serve arquivos estáticos.
//
// Funciona interceptando fetch("/api/..."): app.js continua exatamente o mesmo
// da versão com servidor e recebe as mesmas respostas. Os dados vêm de
// demo-data.json (exportado do banco, todo fictício) e as agregações que na
// versão real são SQL (SUM/GROUP BY) são refeitas aqui em JavaScript.
// Lançamentos feitos na demo ficam só na memória da página.
(function () {
  "use strict";

  const urlDados = new URL("demo-data.json", document.currentScript.src);
  const fetchOriginal = window.fetch.bind(window);
  const FORMAS_PAGAMENTO = new Set(["A vista", "Financiado", "Consorcio"]);

  const pad = (n) => String(n).padStart(2, "0");
  const chaveDia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const chaveMes = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

  let estadoPromise = null;
  function carregar() {
    if (!estadoPromise) {
      estadoPromise = fetchOriginal(urlDados).then((r) => r.json()).then(montarEstado);
    }
    return estadoPromise;
  }

  // Reancora o histórico no dia de hoje: a venda mais recente cai hoje, ou
  // ontem se o horário dela ainda não chegou (evita "venda no futuro").
  function montarEstado(dados) {
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const criar = (v, deslocamento) =>
      new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - v.dias_atras - deslocamento, v.hora, v.minuto);

    const ultimoDia = dados.vendas.filter((v) => v.dias_atras === 0);
    const deslocamento = ultimoDia.some((v) => criar(v, 0) > agora) ? 1 : 0;

    const vendas = dados.vendas.map((v) => ({ ...v, criado_em: criar(v, deslocamento) }));
    // A API real devolve os cadastros com ORDER BY nome (ordem por código de
    // caractere, sem acento/caixa); mantém a mesma ordem para a tela não mudar.
    const porNome = (a, b) => (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0);
    return {
      lojas: [...dados.lojas].sort(porNome),
      gerentes: [...dados.gerentes].sort(porNome),
      vendedores: [...dados.vendedores].sort(porNome),
      modelos: [...dados.modelos].sort(porNome),
      vendas,
      proximoId: Math.max(0, ...vendas.map((v) => v.id)) + 1,
      proximoVendedorId: Math.max(0, ...dados.vendedores.map((v) => v.id)) + 1,
    };
  }

  const resposta = (status, corpo) =>
    new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
  const erro = (status, mensagem) => resposta(status, { erro: mensagem });

  const receita = (v) => v.quantidade * v.valor_unitario;
  const porQuantidadeDesc = (a, b) => b.quantidade - a.quantidade || String(a.nome ?? "").localeCompare(String(b.nome ?? ""));

  function agrupar(vendas, chave) {
    const mapa = new Map();
    for (const v of vendas) {
      const k = chave(v);
      const g = mapa.get(k) ?? { quantidade: 0, faturamento: 0 };
      g.quantidade += v.quantidade;
      g.faturamento += receita(v);
      mapa.set(k, g);
    }
    return mapa;
  }

  // ---------- GET /api/bootstrap ----------
  function bootstrap(estado) {
    const lojaPor = new Map(estado.lojas.map((l) => [l.id, l]));
    const vendedorPor = new Map(estado.vendedores.map((v) => [v.id, v]));
    const modeloPor = new Map(estado.modelos.map((m) => [m.id, m]));
    const ultimosLancamentos = [...estado.vendas]
      .sort((a, b) => b.criado_em - a.criado_em || b.id - a.id)
      .slice(0, 40)
      .map((v) => ({
        id: v.id,
        criado_em: v.criado_em.toISOString(),
        loja_nome: lojaPor.get(v.loja_id).nome,
        vendedor_nome: vendedorPor.get(v.vendedor_id).nome,
        modelo_nome: modeloPor.get(v.modelo_id).nome,
        quantidade: v.quantidade,
        cliente_nome: v.cliente_nome,
      }));
    return resposta(200, {
      lojas: estado.lojas,
      gerentes: estado.gerentes,
      vendedores: estado.vendedores,
      modelos: estado.modelos,
      ultimosLancamentos,
    });
  }

  // ---------- GET /api/analytics?lojaId=&mes=YYYY-MM ----------
  function analytics(estado, params) {
    const lojaParam = params.get("lojaId");
    const lojaId = lojaParam ? Number(lojaParam) : null;
    if (lojaParam && !Number.isInteger(lojaId)) return erro(400, "lojaId inválido.");

    const mesParam = params.get("mes");
    if (mesParam && !/^\d{4}-\d{2}$/.test(mesParam)) {
      return erro(400, "Parâmetro 'mes' deve estar no formato YYYY-MM.");
    }

    const agora = new Date();
    const mes = mesParam ?? chaveMes(agora);
    const [ano, numMes] = mes.split("-").map(Number);
    const ultimoDiaMes = new Date(ano, numMes, 0);

    const doMes = estado.vendas.filter((v) => chaveMes(v.criado_em) === mes);
    const escopo = lojaId ? doMes.filter((v) => v.loja_id === lojaId) : doMes;

    const lojaPor = new Map(estado.lojas.map((l) => [l.id, l]));
    const vendedorPor = new Map(estado.vendedores.map((v) => [v.id, v]));
    const modeloPor = new Map(estado.modelos.map((m) => [m.id, m]));

    const totalVendas = escopo.reduce((s, v) => s + v.quantidade, 0);
    const faturamento = escopo.reduce((s, v) => s + receita(v), 0);

    const porDia = [...agrupar(escopo, (v) => chaveDia(v.criado_em))]
      .map(([dia, g]) => ({ dia, quantidade: g.quantidade, faturamento: g.faturamento }))
      .sort((a, b) => a.dia.localeCompare(b.dia));

    const porModelo = [...agrupar(escopo, (v) => v.modelo_id)]
      .map(([id, g]) => ({ nome: modeloPor.get(id).nome, modelo: modeloPor.get(id).nome, categoria: modeloPor.get(id).categoria, ...g }))
      .sort(porQuantidadeDesc)
      .map(({ nome, ...resto }) => resto);

    const porCategoria = [...agrupar(escopo, (v) => modeloPor.get(v.modelo_id).categoria)]
      .map(([categoria, g]) => ({ categoria, nome: categoria, quantidade: g.quantidade }))
      .sort(porQuantidadeDesc)
      .map(({ nome, ...resto }) => resto);

    const porFormaPagamento = [...agrupar(escopo, (v) => v.forma_pagamento)]
      .map(([forma, g]) => ({ forma_pagamento: forma, nome: forma, quantidade: g.quantidade }))
      .sort(porQuantidadeDesc)
      .map(({ nome, ...resto }) => resto);

    const rankingVendedores = [...agrupar(escopo, (v) => v.vendedor_id)]
      .map(([id, g]) => ({
        nome: vendedorPor.get(id).nome,
        vendedor: vendedorPor.get(id).nome,
        loja: lojaPor.get(vendedorPor.get(id).loja_id).nome,
        ...g,
      }))
      .sort(porQuantidadeDesc)
      .slice(0, 10)
      .map(({ nome, ...resto }) => resto);

    const rankingLojas = [...agrupar(escopo, (v) => v.loja_id)]
      .map(([id, g]) => ({ nome: lojaPor.get(id).nome, loja: lojaPor.get(id).nome, equipe_apelido: lojaPor.get(id).equipe_apelido, ...g }))
      .sort(porQuantidadeDesc)
      .map(({ nome, ...resto }) => resto);

    const acumuladoPorLoja = agrupar(doMes, (v) => v.loja_id);
    const metas = estado.lojas
      .filter((l) => !lojaId || l.id === lojaId)
      .map((l) => ({
        loja_id: l.id,
        loja: l.nome,
        equipe_apelido: l.equipe_apelido,
        meta_mensal: l.meta_mensal,
        acumulado: acumuladoPorLoja.get(l.id)?.quantidade ?? 0,
      }))
      .sort((a, b) => b.acumulado - a.acumulado);

    return resposta(200, {
      periodo: {
        mes,
        primeiro_dia: `${mes}-01`,
        ultimo_dia: chaveDia(ultimoDiaMes),
        hoje: chaveDia(agora),
      },
      kpis: {
        vendas: totalVendas,
        faturamento,
        ticketMedio: totalVendas > 0 ? faturamento / totalVendas : 0,
        diasComVenda: new Set(escopo.map((v) => chaveDia(v.criado_em))).size,
      },
      porDia,
      porModelo,
      porCategoria,
      porFormaPagamento,
      rankingVendedores,
      rankingLojas,
      metas,
    });
  }

  // ---------- POST /api/vendas ----------
  function registrarVenda(estado, corpo) {
    if (!corpo.lojaId || !corpo.vendedorId || !corpo.modeloId) {
      return erro(400, "Informe loja, vendedor e modelo.");
    }
    const quantidade = Number(corpo.quantidade ?? 1);
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      return erro(400, "Quantidade precisa ser um número inteiro maior que zero.");
    }
    const formaPagamento = corpo.formaPagamento ?? "A vista";
    if (!FORMAS_PAGAMENTO.has(formaPagamento)) {
      return erro(400, `Forma de pagamento inválida. Use uma de: ${[...FORMAS_PAGAMENTO].join(", ")}.`);
    }
    const modelo = estado.modelos.find((m) => m.id === corpo.modeloId);
    if (!modelo) return erro(400, "Modelo não encontrado.");
    const vendedor = estado.vendedores.find((v) => v.id === corpo.vendedorId);
    if (!vendedor) return erro(400, "Vendedor não encontrado.");
    if (vendedor.loja_id !== corpo.lojaId) return erro(400, "Esse vendedor não pertence à loja informada.");

    const venda = {
      id: estado.proximoId++,
      criado_em: new Date(),
      loja_id: corpo.lojaId,
      vendedor_id: vendedor.id,
      gerente_id: vendedor.gerente_id,
      modelo_id: modelo.id,
      quantidade,
      valor_unitario: modelo.preco_tabela,
      forma_pagamento: formaPagamento,
      cliente_nome: corpo.clienteNome?.trim() || null,
    };
    estado.vendas.push(venda);
    return resposta(201, { ok: true, id: venda.id, criadoEm: venda.criado_em.toISOString() });
  }

  // ---------- DELETE /api/vendas/ultima ----------
  function desfazerUltima(estado) {
    if (estado.vendas.length === 0) return erro(404, "Não há nenhuma venda para remover.");
    let indice = 0;
    estado.vendas.forEach((v, i) => {
      const atual = estado.vendas[indice];
      if (v.criado_em > atual.criado_em || (+v.criado_em === +atual.criado_em && v.id > atual.id)) indice = i;
    });
    const [removida] = estado.vendas.splice(indice, 1);
    return resposta(200, { ok: true, idRemovido: removida.id });
  }

  // ---------- POST /api/vendedores ----------
  function cadastrarVendedor(estado, corpo) {
    const nome = corpo.nome?.trim();
    if (!nome || !corpo.lojaId) return erro(400, "Informe nome do vendedor e a loja.");
    if (!estado.lojas.some((l) => l.id === corpo.lojaId)) return erro(400, "Loja não encontrada.");

    let gerenteId = null;
    if (corpo.gerenteId) {
      const gerente = estado.gerentes.find((g) => g.id === corpo.gerenteId && g.loja_id === corpo.lojaId);
      if (!gerente) return erro(400, "Esse gerente não pertence à loja informada.");
      gerenteId = gerente.id;
    }
    const vendedor = { id: estado.proximoVendedorId++, nome, loja_id: corpo.lojaId, gerente_id: gerenteId };
    estado.vendedores.push(vendedor);
    return resposta(201, { ok: true, id: vendedor.id });
  }

  async function tratar(url, init) {
    const estado = await carregar();
    const metodo = (init?.method ?? "GET").toUpperCase();
    const rota = url.pathname.replace(/\/+$/, "");
    const corpo = init?.body ? JSON.parse(init.body) : {};

    if (metodo === "GET" && rota === "/api/bootstrap") return bootstrap(estado);
    if (metodo === "GET" && rota === "/api/analytics") return analytics(estado, url.searchParams);
    if (metodo === "GET" && rota === "/api/health") return resposta(200, { ok: true });
    if (metodo === "POST" && rota === "/api/vendas") return registrarVenda(estado, corpo);
    if (metodo === "DELETE" && rota === "/api/vendas/ultima") return desfazerUltima(estado);
    if (metodo === "POST" && rota === "/api/vendedores") return cadastrarVendedor(estado, corpo);
    return erro(404, "Rota não existe na demo.");
  }

  window.fetch = function (entrada, init) {
    const url = new URL(typeof entrada === "string" ? entrada : entrada.url, window.location.href);
    if (url.pathname.startsWith("/api/")) return tratar(url, init);
    return fetchOriginal(entrada, init);
  };
})();

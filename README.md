# Painel de Vendas — Grupo Horizonte Honda (dados fictícios)

Painel analítico de vendas para uma rede fictícia de concessionárias Honda: metas por loja, ranking de vendedores, mix de modelos, forma de pagamento e um calendário de vendas por dia — com lançamento de venda em tempo real.

![Painel de vendas](docs/screenshots/painel.png)

## Contexto

Este projeto nasceu de um sistema real que uso no meu trabalho como Analista Administrativo de Vendas numa concessionária Honda: uma planilha com Google Apps Script que a equipe usava para acompanhar vendas do dia e meta do mês. Ele fazia o trabalho, mas tinha limitações que valia a pena resolver como projeto de estudo — e eu não podia simplesmente publicar o original, porque continha nomes reais de funcionários e metas comerciais confidenciais da empresa.

Por isso, reconstruí o problema do zero: mesma necessidade de negócio (acompanhar vendas, metas e desempenho por loja e por vendedor), arquitetura nova, tecnologias que estou estudando para migrar de TI administrativo para Dados, e **dado 100% fictício** — nenhuma informação real da empresa entra neste repositório (veja [Dados fictícios, de propósito](#dados-fictícios-de-propósito)).

## O problema que o painel resolve

Uma rede com várias lojas precisa responder, todo dia, perguntas como:

- Quanto vendemos hoje, essa semana, esse mês — no total e por loja?
- Cada loja está batendo a própria meta mensal?
- Quem são os vendedores que mais venderam, e em qual loja?
- Que modelo e que categoria (Sedan/Hatch/SUV) estão vendendo mais?
- Financiamento, à vista ou consórcio — o que os clientes estão escolhendo?
- Teve dia fraco ou dia forte esse mês? Qual foi o melhor dia?

O sistema original respondia isso numa única tela, mas sem histórico consultável (só "hoje" e "semana"), sem filtro por loja individual e com o cálculo de meta rodando dentro do próprio Apps Script, sem banco de dados de verdade por trás.

## O que mudou em relação ao sistema original

| | Original (Apps Script) | Este projeto |
|---|---|---|
| Armazenamento | Planilha Google Sheets | PostgreSQL, modelado em tabelas normalizadas |
| Backend | Google Apps Script (`doGet`/`doPost`) | API REST em Node.js + TypeScript + Express |
| Consultas analíticas | Calculadas em JavaScript, na planilha | Agregadas em SQL (`SUM`/`GROUP BY`/views), no banco |
| Gerente da venda | Selecionado à mão, podia divergir do vendedor | Derivado automaticamente do vendedor (`vendedores.gerente_id`) |
| Filtro por loja | Não existia | Cada loja pode ser vista isoladamente, com os mesmos KPIs, gráficos e calendário |
| Histórico | Só "hoje" e semana corrente | Qualquer mês, navegável |
| Fuso horário | Implícito, sem tratamento | `TIMESTAMPTZ` + `ALTER DATABASE ... SET timezone` (ver [Decisões técnicas](#decisões-técnicas)) |
| Execução | Amarrado à conta Google/planilha | `docker compose up` + `npm run dev`, roda em qualquer máquina |

## Arquitetura

```
Python (gera dados fictícios)
        │
        ▼
PostgreSQL 16 (Docker)  ──►  API REST (Node.js + TypeScript + Express)  ──►  Front-end (HTML/CSS/JS + Chart.js)
   tabelas + views              agregações em SQL, sem ORM                    consome só a API, sem lib de UI
```

- **Banco de dados**: PostgreSQL 16 rodando em container Docker, com o schema (`db/schema.sql`) aplicado automaticamente na primeira subida via `docker-entrypoint-initdb.d`.
- **Geração de dados**: script Python (`scripts/gerar_dados_ficticios.py`) que povoa o banco com lojas, equipe comercial, catálogo de modelos e ~60 dias de histórico de vendas fictício, mas estatisticamente plausível (mais vendas em dias úteis e perto do fechamento do mês).
- **API**: Node.js + TypeScript + Express 5, com SQL escrito à mão via `pg` (sem ORM — decisão deliberada, ver abaixo). Sobe também os arquivos estáticos do front-end, então em desenvolvimento é um único processo (`npm run dev`).
- **Front-end**: HTML/CSS/JavaScript puro consumindo a API via `fetch`, com Chart.js para os gráficos. Sem framework — o tamanho da tela não justificava React/Vue aqui, e evitar essa dependência manteve o foco do projeto em backend, SQL e modelagem de dados.

## Modelo de dados

```
lojas ──┬── gerentes ──┬── vendedores ──── vendas ──── modelos
        │              │
        └──────────────┴── (uma loja tem 1+ gerentes e 1+ vendedores)
```

- `lojas`, `gerentes`, `vendedores`, `modelos`, `vendas` — tabelas normalizadas, com chaves estrangeiras e `CHECK` constraints (ex.: `quantidade > 0`, `forma_pagamento IN (...)`).
- `vendas.valor_unitario` é copiado do preço do modelo **no momento da venda** — histórico não muda se o preço do modelo for atualizado depois, igual a um sistema de vendas de verdade.
- Duas views (`vw_vendas`, `vw_metas_mes_atual`) fazem os `JOIN`s mais comuns uma vez só, em vez de repeti-los em cada rota.
- Índices em `criado_em`, `loja_id` e `vendedor_id` — as três colunas mais filtradas/agrupadas pelo painel.

Schema completo: [`db/schema.sql`](db/schema.sql).

## Decisões técnicas

**Sem ORM.** A API usa `pg` com SQL escrito à mão em vez de Prisma/TypeORM. É uma escolha deliberada de aprendizado: o objetivo deste projeto era treinar SQL de verdade (`JOIN`, `GROUP BY`, `date_trunc`, views, subqueries com `COALESCE`/`NULLIF`), não abstraí-lo atrás de um ORM.

**Fuso horário do banco.** O Postgres roda em UTC por padrão dentro do container. Sem corrigir isso, uma venda lançada às 21h em Recife (horário local) cairia depois da meia-noite em UTC — e qualquer relatório por dia ("vendas de hoje", calendário) classificaria essa venda no dia seguinte. A correção é uma linha no schema: `ALTER DATABASE vendas_honda SET timezone TO 'America/Recife'`. Encontrei esse bug testando manualmente (uma venda lançada à noite aparecia no dia errado no calendário) e corrigi na fonte, no banco — não maquiando no front-end.

**Gerente derivado do vendedor, não escolhido à mão.** No sistema original, era possível selecionar um vendedor de uma loja e um gerente de outra por engano, porque eram dois campos independentes. Aqui, `vendedores.gerente_id` já amarra vendedor ao gerente certo, e a API deriva o gerente automaticamente a partir do vendedor escolhido — elimina essa classe inteira de erro de digitação, e é um campo a menos para preencher no formulário.

**Agregação no banco, não no navegador.** Toda métrica do painel (KPIs, ranking, série por dia, mix por categoria) é um `SUM`/`GROUP BY` em SQL, na rota `/api/analytics`. Nenhum cálculo de agregação acontece em JavaScript no cliente. Isso importa porque não escala trazer todas as linhas de venda pela rede para o navegador somar — o Postgres faz isso ordens de magnitude mais rápido, e a resposta da API já vem pronta pra desenhar o gráfico.

**Um endpoint "bootstrap".** `GET /api/bootstrap` devolve de uma vez só tudo que a tela de lançamento precisa (lojas, vendedores, modelos, últimos lançamentos), em vez da tela disparar várias requisições em cascata toda vez que abre. Mantive essa ideia do sistema original porque ela resolvia bem um problema real de latência percebida.

**minmax(0, 1fr) nas grids CSS.** Bug real encontrado testando com navegador automatizado (Playwright): depois de vários ciclos de trocar de loja/mês e o Chart.js recriar um gráfico no mesmo `<canvas>`, uma tela de 1366px (resolução comum de notebook) passava a ter rolagem horizontal. Causa: uma track de CSS Grid definida como `1fr` nunca encolhe abaixo do conteúdo mínimo de dentro dela — e um canvas tem largura fixa em pixel. A correção (`minmax(0, 1fr)` nas três grids do painel) é o fix padrão desse problema clássico do CSS Grid.

## Dados fictícios, de propósito

Todo o histórico de vendas é gerado por [`scripts/gerar_dados_ficticios.py`](scripts/gerar_dados_ficticios.py): 5 lojas, 5 gerentes, 18 vendedores, 17 modelos Honda (nomes públicos, preços ilustrativos) e ~60 dias de vendas com sazonalidade plausível (mais movimento em dias úteis e perto do fim do mês). Nomes de pessoas, cidades e metas são inventados — nenhum dado real da concessionária onde trabalho está neste repositório. `random.seed(42)` deixa a geração reprodutível, e o script é idempotente (`TRUNCATE ... RESTART IDENTITY CASCADE`), então pode ser rodado quantas vezes precisar.

## Como rodar localmente

Pré-requisitos: Docker Desktop, Node.js 24+, Python 3.13+.

```bash
# 1. Banco de dados (Postgres em container, schema aplicado automaticamente)
docker compose up -d

# 2. Variáveis de ambiente
cp .env.example .env

# 3. Gerar os dados fictícios
python -m venv .venv
.venv/Scripts/activate            # Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
python scripts/gerar_dados_ficticios.py

# 4. API + front-end (um único processo, com hot-reload)
cd server
npm install
npm run dev
```

Acesse **http://localhost:3333**.

## Funcionalidades

- **Painel geral e por loja**: clicar numa loja na barra lateral filtra KPIs, gráficos, calendário e ranking só para ela.
- **Navegação por mês**: setas no topo percorrem o histórico; não é possível avançar além do mês atual.
- **Calendário de vendas**: intensidade de cor proporcional ao volume do dia, com o dia de hoje destacado.
- **Lançamento de venda**: formulário com validação de loja/vendedor/modelo e feedback animado mostrando quem vendeu e qual carro.
- **Cadastro rápido de vendedor** numa loja já existente.
- Atualização automática a cada 30 segundos.

![Filtro por loja](docs/screenshots/painel-loja.png)
![Lançamento de venda](docs/screenshots/lancamento.png)

## Tecnologias

`PostgreSQL 16` · `Docker` · `Python` (`SQLAlchemy`, `psycopg`) · `Node.js` · `TypeScript` · `Express 5` · `Chart.js` · `HTML/CSS/JavaScript`

## Próximos passos possíveis

- Testes automatizados na API (hoje a validação é só manual/Playwright).
- Exportar relatório mensal em PDF/Excel.
- Autenticação, caso o painel saia de um protótipo de portfólio para um uso multiusuário real.

---

Projeto de estudo, parte da minha transição de Administrativo/Logística para Dados. Mais contexto no [meu GitHub](https://github.com/DiegoSantiago1) e [portfólio](https://diegosantiago1.github.io/Portifolio/).

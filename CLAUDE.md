# CLAUDE.md — Contexto permanente de Diego Freitas Santiago

Use este arquivo como contexto em toda ajuda sobre estudos, carreira, projetos, GitHub, portfólio, Dados, Python, SQL, Power BI, Backend, IA, Docker, AWS e entrevistas. O objetivo do Diego não é só receber tarefas prontas: é entender a trajetória dele, os objetivos e o porquê de cada coisa que estuda.

---

## 1. Regras de trabalho (valem sempre)

**Princípio central:** Claude acelera → Diego estuda → entende → valida → consegue explicar. IA não pode substituir o aprendizado. Diego tem pouco tempo (trabalha das 08:00 às 18:00) e usa IA para ganhar velocidade, mas precisa conseguir explicar cada projeto em entrevista.

**Antes de alterar qualquer projeto:** analisar a estrutura, ler os arquivos relevantes, entender a arquitetura e as dependências, explicar o que pretende fazer e só depois implementar.

**Nunca, sem autorização explícita:** apagar arquivos ou tabelas, remover funcionalidades, trocar a arquitetura inteira, reescrever o projeto todo, instalar dezenas de dependências, fazer overengineering. Com várias soluções possíveis, apresentar a recomendada e explicar o motivo.

**Ciclo de cada projeto:**
1. PLAN: requisito, análise, arquitetura, banco, APIs, divisão em tarefas.
2. IMPLEMENT: uma funcionalidade por vez, nunca 30 de uma vez.
3. TEST: rodar testes, checar erros, teste manual, corrigir.
4. EXPLAIN: o que foi criado, como funciona, por que assim, conceitos envolvidos e o que ele precisa saber para entrevista.
5. COMMIT: só sugerir depois que ele entender e validar.

**Entrevistas:** ao concluir um projeto, fazer perguntas de nível básico a avançado (escolha de PostgreSQL, JOIN vs subquery, por que usar transação, 10 mil requisições simultâneas, segurança da API, como impedir o modelo de rodar operação perigosa no banco). O objetivo é entender conceitos, não decorar respostas.

**Como corrigir o Diego:** dizer diretamente quando algo estiver tecnicamente errado, sem concordar só para agradar. Explicar o problema, mostrar a alternativa e os trade-offs, recomendar uma direção e só implementar depois de alinhado.

**Disciplina de foco:**
- Se uma decisão conflitar com os objetivos dele, explicar o conflito.
- Se ele tentar aprender tecnologia demais ao mesmo tempo, alertar.
- Se ele estiver abandonando algo ainda útil, explicar antes de recomendar que pare.
- Se estiver avançando bem, não mudar o plano sem necessidade. Mudança grande de direção só com motivo técnico ou de aprendizado e explicação do impacto.
- Ao sugerir tecnologia nova: por que faz sentido para ele, qual problema resolve, em qual projeto entra, se é prioridade e se é para agora ou depois.
- Nada de recomendação genérica do tipo "aprenda X, Y e Z". Sempre ligada ao contexto dele.
- Quando houver projetos suficientes, avisar a hora de parar de criar novos e melhorar os existentes.

**Princípio dos projetos:** problema → solução → arquitetura → tecnologia → resultado. Nada de "usei Python/IA/AWS/Docker" sem dizer que problema aquilo resolve. Preferir 5 a 8 projetos fortes, com profundidade e documentação, a 20 projetos superficiais.

---

## 2. Quem é

- **Diego Freitas Santiago**, 25 anos, Recife-PE.
- ADS no Centro Universitário FBV Wyden, 2º período, conclusão prevista para junho de 2028.
- GitHub: https://github.com/DiegoSantiago1
- LinkedIn: linkedin.com/in/diego-freitas-santiago
- Portfólio: https://diegosantiago1.github.io/Portifolio/ (repositório `Portifolio`)

### Experiência
- **Atual:** Analista Administrativo de Vendas I na concessionária Honda (Autoline Honda), desde 25/08/2026. Planilhas, controle de entrada e saída de veículos, conferência e comparação de dados, rotinas administrativas de vendas. Gosta do trabalho e quer usá-lo para se aproximar de Dados. Esta pasta (Dados_Honda) está ligada a essa experiência e ao Projeto 1.
- **Força Aérea Brasileira (mar/2020 a fev/2026):** administrativo, atendimento, documentação, planilhas, logística e estoque. OARF/Odontoclínica (faturamento, guias, planos de saúde), HARF/DEPI (estagiários, certificados, contato com universidades), CGM (controle de materiais, estoque, escalas, empresas de logística, pagamentos).
- **Evento:** Demoday do Kick Off 2023.2, programa de Residência Tecnológica do Porto Digital (04/12/2023, tema "Inovação Urbana"), **2º lugar**. Diferencial real, com trabalho em equipe multidisciplinar.
- **Certificações:** DevClub (HTML, CSS avançado, JS avançado, Git/GitHub, Node, React, Deploy, TypeScript), Curso em Vídeo (lógica, MySQL, HTML5/CSS3, JS, Git, segurança, redes, IPv4), Santander Open Academy (Excel básico ao intermediário, Power BI intermediário, Publicidade Digital: Dados, IA e Legalidade), Fundação Bradesco (Cultura Digital, Fundamentos de TI).

### Metas com data
- **REC'n'Play 2026 (novembro de 2026):** chegar com poucos projetos muito bem feitos, para networking e oportunidades. Não precisa ter tudo finalizado.
- **Londres em março de 2027:** buscar oportunidades em Data Analytics, Dados, Backend e futuramente Engenharia de Dados. Quer fazer freelances antes e melhorar o inglês. Recomendações de carreira devem considerar valor internacional, e não só o mercado brasileiro.

---

## 3. Posicionamento profissional

**Dados como foco principal + programação/backend como diferencial + IA e automação como diferencial adicional**, com possível evolução para Engenharia de Dados.

Narrativa: experiência administrativa e logística → planilhas e processos → ADS → desenvolvimento → SQL/Python/BI → Dados → automação e IA → possível Engenharia de Dados. JS, React e Node não devem ser descartados: complementam Dados. Diego não quer parecer alguém que "não sabe o que quer" nem que estuda tudo ao mesmo tempo.

### Stack
- **Já usou:** HTML, CSS, JavaScript, Node.js, Express, APIs REST, Git/GitHub. Tem contato com TypeScript, React, Tailwind, SQL (MySQL/PostgreSQL).
- **Excel:** PROCX, PROCV, PROCH, SOMASES, CONT.SES, SE/E/OU, tabelas dinâmicas. Quer chegar ao nível intermediário/avançado.
- **A dominar em Dados:** SQL de verdade (JOIN, subqueries, CTEs, window functions, CASE, views, índices, modelagem, transações, otimização), Python (Pandas, NumPy, Matplotlib), Power BI (Power Query, modelagem, DAX, KPIs, storytelling). Pode usar IA de apoio no DAX, mas precisa entender o que está sendo feito.
- **IA aplicada:** APIs de LLM, prompt engineering, structured output, tool calling, agentes, RAG, embeddings, vector DB, avaliação de respostas, custos, segurança, rate limiting. Quer provar que sabe construir sistemas com IA, e não que "conversa com o ChatGPT".
- **Infra:** Docker (prático, em Backend e Data) e AWS aos poucos (EC2, RDS, S3, IAM, CloudWatch, VPC, ECS/Fargate, Lambda, SQS) em apenas alguns projetos, com justificativa real.
- **Engenharia de Dados:** só depois de base sólida em SQL, Python e PostgreSQL (ETL/ELT, Airflow, Data Warehouse, PySpark).

---

## 4. Plano de projetos (vigente desde 21/09/2026, não mudar sem motivo)

Diego pediu no mínimo 3 projetos de front, 3 de back e cerca de 5 de dados, usando as tecnologias do portfólio (incluindo Docker e AWS). Isso daria 11 projetos, o que contraria a regra dele de 5 a 8 projetos fortes. Ficou acordado um plano de 8, em que um projeto conta em mais de uma categoria. Ele aceitou "por enquanto".

| # | Projeto | Conta como | Tecnologias |
|---|---|---|---|
| 1 | Vendas de Concessionária | Dados | Excel, SQL, Python/Pandas, PostgreSQL, Power BI |
| 2 | Estoque e Logística | Dados | SQL, Pandas, NumPy, PostgreSQL, Power BI |
| 3 | Customer Analytics (RFM, churn, CLV) | Dados | SQL, Python, NumPy, Power BI |
| 4 | Data Platform (pipeline) | Dados + Back + Front | Node/TS, Python, PostgreSQL, Docker, AWS (S3 e RDS), React |
| 5 | AI Business Analyst | Dados + Back + Front | Node/TS, Python, PostgreSQL, LLM com tool calling, Docker, React/TS/Tailwind |
| 6 | Finance API | Back | Node/TS, PostgreSQL (transações, idempotência), Docker, Jest |
| 7 | **Vaga aberta** | — | Não preencher agora. Decidir depois do projeto 3, sem inflar a lista |
| 8 | Portfólio v2 | Front | O site existente, com o posicionamento corrigido |

Contagem: Dados = 1, 2, 3, 4, 5. Back = 4, 5, 6. Front = 4, 5 e o portfólio.

**Decisões e restrições:**
- **Não usar o projeto PrevisaoDoTempo** no portfólio, nem como base de versão nova. Pode continuar no GitHub como histórico; não apagar nem alterar sem autorização.
- Fora do plano por enquanto: Chat em Tempo Real e E-commerce API (pouco relevantes para Dados; só depois de Londres, se sobrar tempo). A fila do antigo Job Processing entra no projeto 4. MySQL só entra com motivo real, PostgreSQL basta.
- **Dados reais da Honda nunca vão para projetos públicos** (confidencialidade e LGPD). Usar dataset sintético gerado em Python, com a mesma estrutura do problema real (modelos, vendedores, formas de pagamento, margem, estoque).
- Reaproveitamento: os projetos 1 a 3 compartilham o mesmo PostgreSQL em Docker, e o projeto 5 consulta o banco do projeto 1. É isso que faz o plano caber no tempo.
- AWS só no projeto 4 (S3 e RDS), com justificativa real. Docker nos projetos 4, 5 e 6 e no PostgreSQL local dos projetos 1 a 3.
- Ordem: passo 0 (ambiente) → projeto 1 + correção do portfólio antes do REC'n'Play (nov/2026) → 2 → 3 → 4 → 5 → 6 só se sobrar tempo antes de Londres (mar/2027).

Cada projeto importante deve mostrar: problema, contexto, objetivo, tecnologias, arquitetura, banco, fluxo, decisões técnicas, desafios, resultados, GitHub, demo e prints. Projetos de Dados também mostram dataset, tratamento, SQL, Python, KPIs, Power BI e insights de negócio. Projetos de IA mostram qual problema a IA resolve, modelo, contexto, tool calling, segurança, custos, avaliação, latência e limitações.

**Disponibilidade:** Diego estuda das 19:00 às 23:30, depois do trabalho. Para cronograma, assumir cerca de 15 a 20 horas por semana de ritmo sustentável, e não as 22 horas teóricas.

**Ambiente da máquina (configurado em 21/09/2026):** Windows 11 Home. Instalados: Git 2.55, VS Code, Power BI Desktop, Python 3.14.7 (`%LOCALAPPDATA%\Programs\Python\Python314`), Node 24 LTS, GitHub CLI (`gh`, logado como DiegoSantiago1) e Docker Desktop 4.91 com WSL2 (o WSL2 só passa a valer depois de reiniciar o Windows). PostgreSQL vai rodar em container Docker, sem instalação local. Dica: o atalho `python` da Microsoft Store pode aparecer antes do Python real no PATH de sessões antigas; abrir um terminal novo ou usar `.venv\Scripts\python.exe`.

**Repositório:** https://github.com/DiegoSantiago1/analise-vendas-concessionaria (**privado**; só tornar público depois de revisar que não há dados reais da empresa e ajustar este CLAUDE.md). Ambiente Python isolado em `.venv` (ignorado pelo git); dependências em `requirements.txt`. Dados brutos em `data/raw/` ficam fora do git.

---

## 5. Diagnóstico atual do portfólio e do GitHub (análise de 21/09/2026)

Este é um retrato de uma data, não uma verdade permanente. Reanalisar ao mexer no portfólio ou no GitHub.

### Portfólio (https://diegosantiago1.github.io/Portifolio/)
**Pontos fortes:** tema claro e escuro, layout responsivo, link "pular para o conteúdo", metatags e Open Graph, manifest, sitemap e robots, seção de eventos com o 2º lugar no Porto Digital, experiência atual em Honda destacada em primeiro lugar.

**Pontos fracos e lacunas:**
- **Nenhum projeto real:** os três cards são "Projeto em desenvolvimento". O portfólio é bonito, mas não tem prova de trabalho, que é o maior problema.
- **Posicionamento desatualizado:** título, meta description e Open Graph ainda dizem "Desenvolvedor FullStack", enquanto o texto "Sobre mim" já fala de dados e automação. A história de Dados ainda não está clara para quem entra pela primeira vez.
- **Habilidades sem evidência:** lista Python, Pandas, NumPy, Power BI, SQL, Docker e AWS, mas o GitHub não tem nenhum repositório de Dados, SQL, Docker ou AWS. Lista plana, sem nível nem contexto.
- **Afirmações a validar:** a experiência na Honda cita "dashboards no Power BI" e "automações com Python". Só manter se Diego souber explicar e demonstrar; em entrevista isso será cobrado.
- **Botão "Baixar currículo"** apenas leva para #contato. O PDF não existe (a pasta `assets/documents` só tem um README de instruções).
- **Contato:** o formulário abre `mailto:` (sem backend), então não envia nada por si só. O WhatsApp aparece publicamente na página (risco de spam).
- **Certificados:** o JSON de dados (`portfolio-data.js`) está com os arrays de certificados vazios, enquanto o HTML tem uma lista estática. Duas fontes de verdade e possível aba vazia.
- **Técnico:** Tailwind pelo CDN de desenvolvimento (não recomendado para produção), sem `og:image`. O repositório contém uma pasta `archive/zai-wrapper` com resíduo de terceiros. O README ainda diz "Em breve disponível online".

### GitHub (DiegoSantiago1)
Conta criada em 25/02/2026, 14 repositórios públicos, 0 seguidores, bio "Desenvolvedor Full Stack". A linguagem só varia entre HTML, CSS e JavaScript: não há repositório em TypeScript, React, Python ou SQL.

| Repositório | Situação |
|---|---|
| Portifolio | Site do portfólio, bom README, mas com resíduos e desatualizações |
| PrevisaoDoTempo | **Mais forte:** front + backend Express + API Groq (IA) + OpenWeatherMap, chave protegida no backend. Falta deploy do backend (o GitHub Pages só serve o front) e o README tem placeholder `seu-usuario/seu-repo` |
| Menu-de-Receitas | Consumo de API (TheMealDB) com loading e tratamento de erros. Bom exercício |
| mario-kart-simulator, node-shopee-cart | Exercícios de lógica em Node, com README decente, histórico de estudo |
| Sistema-de-Login, QuizBasico, TreinandoCSS, Treinando-JavaScript | Exercícios front-end, mantidos como histórico |
| Programa--o | É o projeto Convert Money, com nome ruim e sem relação com o conteúdo |
| ConvertorDeMoedas | Repositório vazio (só título no README) |
| CopilotoGPT | Prompts para ChatGPT, não é código. Bom como documento, fraco como projeto |
| Larissakich | Fork de terceiro, sem relação com a trajetória |
| DiegoSantiago1 | README de perfil desatualizado: diz 24 anos, "desenvolvimento web" e mostra Next.js/Bootstrap sem projeto correspondente |

Quase nenhum repositório tem descrição, topics ou testes. Nada é Dados. Não recomendar apagar nada sem explicar o motivo e ter autorização de Diego. Os exercícios podem ficar como histórico, e o que precisa é alinhar o que aparece em destaque (fixar os melhores, README profissional).

### Prioridades que decorrem do diagnóstico
1. **Passo 0:** preparar o ambiente (Python, Docker Desktop, PostgreSQL em container) e iniciar o repositório git.
2. Fazer o **Projeto 1 (vendas de concessionária)** com dataset sintético e publicá-lo com README de case (problema, dados, SQL, Python, KPIs, dashboard, insights). Preenche a maior lacuna do portfólio e do GitHub.
3. Substituir os placeholders do portfólio pelo projeto 1 (e pelos seguintes, conforme ficarem prontos). O PrevisaoDoTempo não entra por decisão do Diego.
4. Atualizar o posicionamento (título, descrição, bio do GitHub, README de perfil, LinkedIn) para Dados + Backend + IA, para que os três contem a mesma história.
5. Publicar o PDF do currículo e corrigir o botão. Só afirmar no portfólio o que ele consegue explicar e demonstrar.
6. Limpar o que confunde (repositório vazio, fork, resíduos) só com autorização dele.

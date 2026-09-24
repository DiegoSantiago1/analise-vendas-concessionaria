"""
Gera dados FICTÍCIOS de lojas, equipe comercial e histórico de vendas para
o Grupo Horizonte Honda, e carrega tudo no PostgreSQL.

Por quê dados fictícios, e não os reais do trabalho: o projeto original
continha nomes reais de funcionários e metas de venda confidenciais da
concessionária onde trabalho. Este script recria a MESMA estrutura de
negócio (lojas, vendedores, gerentes, modelos, vendas), mas com nomes e
números inventados, para que o projeto possa ficar público no portfólio
sem expor dado nenhum de pessoa real.

Uso:
    python scripts/gerar_dados_ficticios.py                   # histórico até hoje
    python scripts/gerar_dados_ficticios.py --ate 2026-09-23  # histórico até uma data fixa

Reprodutibilidade: a semente (random.seed(42)) fixa o sorteio, mas o histórico
é montado para trás a partir de uma data-âncora. Sem --ate a âncora é o
momento em que o script roda, então rodar em dias diferentes dá vendas em
datas diferentes. Com --ate, a mesma data gera sempre exatamente os mesmos dados.
"""

from __future__ import annotations

import argparse
import os
import random
from datetime import date, datetime, time, timedelta
from pathlib import Path

from dotenv import load_dotenv
import sqlalchemy as sa

# Carrega DB_USER, DB_PASSWORD etc. do .env na raiz do projeto
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# ---------------------------------------------------------------------
# Dados de referência (fictícios)
# ---------------------------------------------------------------------

LOJAS = [
    {"nome": "Loja Centro", "cidade": "Recife", "equipe_apelido": "Equipe Águia", "meta_mensal": 40},
    {"nome": "Loja Norte", "cidade": "Recife", "equipe_apelido": "Equipe Falcão", "meta_mensal": 25},
    {"nome": "Loja Sul", "cidade": "Jaboatão", "equipe_apelido": "Equipe Tornado", "meta_mensal": 20},
    {"nome": "Loja Litoral", "cidade": "Cabo de Santo Agostinho", "equipe_apelido": "Equipe Maré", "meta_mensal": 18},
    {"nome": "Loja Serra", "cidade": "Caruaru", "equipe_apelido": "Equipe Pedra Forte", "meta_mensal": 15},
]

# nome do gerente por loja (índice = mesmo índice de LOJAS)
GERENTES = [
    "Fernando Albuquerque",
    "Patrícia Nogueira",
    "Rogério Vasconcelos",
    "Camila Andrade",
    "Thiago Ribeiro",
]

# vendedores por loja (índice = mesmo índice de LOJAS)
VENDEDORES_POR_LOJA = [
    ["Beatriz Cordeiro", "Gustavo Monteiro", "Larissa Pontes", "Rafael Duarte", "Vanessa Lira", "Eduardo Barros"],
    ["Camila Teixeira", "Igor Salgado", "Renata Farias", "Vinicius Godoy"],
    ["Aline Correia", "Bruno Salviano", "Priscila Amorim"],
    ["Daniel Vieira", "Michele Cavalcanti", "Otávio Peixoto"],
    ["Fabiana Rocha", "Leandro Siqueira"],
]

MODELOS = [
    {"nome": "City Sedan LX", "categoria": "Sedan", "preco_tabela": 104_900},
    {"nome": "City Sedan EX", "categoria": "Sedan", "preco_tabela": 114_900},
    {"nome": "City Sedan EXL", "categoria": "Sedan", "preco_tabela": 124_900},
    {"nome": "City Sedan Touring", "categoria": "Sedan", "preco_tabela": 134_900},
    {"nome": "City Hatch LX", "categoria": "Hatch", "preco_tabela": 99_900},
    {"nome": "City Hatch EXL", "categoria": "Hatch", "preco_tabela": 119_900},
    {"nome": "City Hatch Touring", "categoria": "Hatch", "preco_tabela": 129_900},
    {"nome": "WR-V EX", "categoria": "SUV", "preco_tabela": 134_900},
    {"nome": "WR-V EXL", "categoria": "SUV", "preco_tabela": 144_900},
    {"nome": "HR-V EXL", "categoria": "SUV", "preco_tabela": 159_900},
    {"nome": "HR-V Advance", "categoria": "SUV", "preco_tabela": 169_900},
    {"nome": "HR-V Touring", "categoria": "SUV", "preco_tabela": 179_900},
    {"nome": "ZR-V EXL", "categoria": "SUV", "preco_tabela": 194_900},
    {"nome": "ZR-V Touring", "categoria": "SUV", "preco_tabela": 214_900},
    {"nome": "CR-V EXL", "categoria": "SUV", "preco_tabela": 259_900},
    {"nome": "CR-V Touring", "categoria": "SUV", "preco_tabela": 279_900},
    {"nome": "Civic e:HEV Advanced", "categoria": "Sedan", "preco_tabela": 219_900},
]

FORMAS_PAGAMENTO = ["A vista", "Financiado", "Financiado", "Financiado", "Consorcio"]

CLIENTES_FICTICIOS = [
    "João Pedro", "Ana Clara", "Marcos Vinicius", "Sofia Almeida", "Luiz Fernando",
    "Isabela Martins", "Pedro Henrique", "Juliana Prado", "Rodrigo Nascimento",
    "Carolina Freire", "André Luiz", "Mariana Costa", None, None, None,  # None = sem nome informado
]

DIAS_DE_HISTORICO = 60  # dois meses de vendas, pra dar volume real pra análise


def gerar_vendas(ancora: datetime) -> list[dict]:
    """Gera um histórico de vendas plausível: mais movimento em dias de
    semana e no fim do mês (comportamento real de concessionária), com
    cada loja vendendo perto (não exatamente) da própria meta.
    O histórico termina em `ancora` e cobre os DIAS_DE_HISTORICO dias antes."""
    random.seed(42)  # dentro da função: chamar duas vezes com a mesma âncora dá o mesmo resultado
    vendas = []
    hoje = ancora
    inicio = hoje - timedelta(days=DIAS_DE_HISTORICO)

    for loja_idx, loja in enumerate(LOJAS):
        vendedores = VENDEDORES_POR_LOJA[loja_idx]
        # ritmo de vendas por dia calibrado pra chegar perto da meta mensal
        vendas_por_dia_media = loja["meta_mensal"] / 30 * 0.9

        dia = inicio
        while dia <= hoje:
            fim_de_semana = dia.weekday() >= 5
            fator_dia = 0.4 if fim_de_semana else 1.0
            # mais vendas perto do fim do mês (meta batendo)
            fator_fim_mes = 1.6 if dia.day >= 25 else 1.0

            lambda_dia = vendas_por_dia_media * fator_dia * fator_fim_mes
            n_vendas_no_dia = max(0, round(random.gauss(lambda_dia, lambda_dia * 0.5)))

            for _ in range(n_vendas_no_dia):
                vendedor = random.choice(vendedores)
                modelo = random.choice(MODELOS)
                hora = random.randint(8, 18)
                minuto = random.randint(0, 59)
                timestamp = dia.replace(hour=hora, minute=minuto, second=0, microsecond=0)
                quantidade = 1 if random.random() > 0.03 else 2  # raramente vende 2 no mesmo registro

                vendas.append({
                    "loja_nome": loja["nome"],
                    "vendedor_nome": vendedor,
                    "gerente_nome": GERENTES[loja_idx],
                    "modelo_nome": modelo["nome"],
                    "quantidade": quantidade,
                    "valor_unitario": modelo["preco_tabela"],
                    "forma_pagamento": random.choice(FORMAS_PAGAMENTO),
                    "cliente_nome": random.choice(CLIENTES_FICTICIOS),
                    "criado_em": timestamp,
                })

            dia += timedelta(days=1)

    return vendas


def montar_engine() -> sa.Engine:
    usuario = os.environ.get("DB_USER", "honda")
    senha = os.environ.get("DB_PASSWORD", "honda_dev_pw")
    host = os.environ.get("DB_HOST", "localhost")
    porta = os.environ.get("DB_PORT", "5432")
    nome_banco = os.environ.get("DB_NAME", "vendas_honda")
    url = f"postgresql+psycopg://{usuario}:{senha}@{host}:{porta}/{nome_banco}"
    return sa.create_engine(url)


def ler_ancora() -> datetime:
    parser = argparse.ArgumentParser(description="Gera dados fictícios de vendas no PostgreSQL.")
    parser.add_argument("--ate", type=date.fromisoformat, metavar="AAAA-MM-DD",
                        help="data final do histórico (padrão: agora). Com data fixa, a geração é 100%% reproduzível.")
    args = parser.parse_args()
    if args.ate is None:
        return datetime.now()
    return datetime.combine(args.ate, time(23, 59))


def main() -> None:
    ancora = ler_ancora()
    engine = montar_engine()

    with engine.begin() as conn:
        # Idempotente: limpa e recarrega, pra poder rodar o script quantas vezes precisar
        conn.execute(sa.text("TRUNCATE vendas, vendedores, gerentes, modelos, lojas RESTART IDENTITY CASCADE"))

        loja_id_por_nome: dict[str, int] = {}
        for loja in LOJAS:
            res = conn.execute(
                sa.text(
                    "INSERT INTO lojas (nome, cidade, equipe_apelido, meta_mensal) "
                    "VALUES (:nome, :cidade, :equipe_apelido, :meta_mensal) RETURNING id"
                ),
                loja,
            )
            loja_id_por_nome[loja["nome"]] = res.scalar_one()

        gerente_id_por_nome: dict[str, int] = {}
        for loja_idx, loja in enumerate(LOJAS):
            gerente_nome = GERENTES[loja_idx]
            res = conn.execute(
                sa.text("INSERT INTO gerentes (nome, loja_id) VALUES (:nome, :loja_id) RETURNING id"),
                {"nome": gerente_nome, "loja_id": loja_id_por_nome[loja["nome"]]},
            )
            gerente_id_por_nome[gerente_nome] = res.scalar_one()

        vendedor_id_por_nome: dict[str, int] = {}
        for loja_idx, loja in enumerate(LOJAS):
            gerente_id = gerente_id_por_nome[GERENTES[loja_idx]]
            for vendedor_nome in VENDEDORES_POR_LOJA[loja_idx]:
                res = conn.execute(
                    sa.text(
                        "INSERT INTO vendedores (nome, loja_id, gerente_id) "
                        "VALUES (:nome, :loja_id, :gerente_id) RETURNING id"
                    ),
                    {"nome": vendedor_nome, "loja_id": loja_id_por_nome[loja["nome"]], "gerente_id": gerente_id},
                )
                vendedor_id_por_nome[vendedor_nome] = res.scalar_one()

        modelo_id_por_nome: dict[str, int] = {}
        for modelo in MODELOS:
            res = conn.execute(
                sa.text(
                    "INSERT INTO modelos (nome, categoria, preco_tabela) "
                    "VALUES (:nome, :categoria, :preco_tabela) RETURNING id"
                ),
                modelo,
            )
            modelo_id_por_nome[modelo["nome"]] = res.scalar_one()

        vendas = gerar_vendas(ancora)
        conn.execute(
            sa.text(
                "INSERT INTO vendas "
                "(criado_em, loja_id, vendedor_id, gerente_id, modelo_id, quantidade, "
                " valor_unitario, forma_pagamento, cliente_nome) "
                "VALUES "
                "(:criado_em, :loja_id, :vendedor_id, :gerente_id, :modelo_id, :quantidade, "
                " :valor_unitario, :forma_pagamento, :cliente_nome)"
            ),
            [
                {
                    "criado_em": v["criado_em"],
                    "loja_id": loja_id_por_nome[v["loja_nome"]],
                    "vendedor_id": vendedor_id_por_nome[v["vendedor_nome"]],
                    "gerente_id": gerente_id_por_nome[v["gerente_nome"]],
                    "modelo_id": modelo_id_por_nome[v["modelo_nome"]],
                    "quantidade": v["quantidade"],
                    "valor_unitario": v["valor_unitario"],
                    "forma_pagamento": v["forma_pagamento"],
                    "cliente_nome": v["cliente_nome"],
                }
                for v in vendas
            ],
        )

        print(f"Lojas inseridas:      {len(LOJAS)}")
        print(f"Gerentes inseridos:   {len(GERENTES)}")
        print(f"Vendedores inseridos: {sum(len(v) for v in VENDEDORES_POR_LOJA)}")
        print(f"Modelos inseridos:    {len(MODELOS)}")
        print(f"Vendas inseridas:     {len(vendas)}")


if __name__ == "__main__":
    main()

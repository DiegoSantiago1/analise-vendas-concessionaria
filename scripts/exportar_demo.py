"""
Exporta o banco (dados FICTÍCIOS) para demo/demo-data.json, o conjunto de
dados da versão de demonstração do painel, que roda inteira no navegador
(sem servidor), para poder ser publicada no GitHub Pages.

As datas das vendas não são gravadas como datas absolutas: cada venda guarda
quantos dias antes do último dia de vendas ela aconteceu (dias_atras) e a hora
local. A demo reancora esse histórico no dia em que a pessoa abre a página,
então o painel sempre mostra "hoje" e o mês corrente com movimento.

Uso:
    python scripts/exportar_demo.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv
import sqlalchemy as sa

RAIZ = Path(__file__).resolve().parent.parent
load_dotenv(RAIZ / ".env")

DESTINO = RAIZ / "demo" / "demo-data.json"


def montar_engine() -> sa.Engine:
    usuario = os.environ.get("DB_USER", "honda")
    senha = os.environ.get("DB_PASSWORD", "honda_dev_pw")
    host = os.environ.get("DB_HOST", "localhost")
    porta = os.environ.get("DB_PORT", "5432")
    nome_banco = os.environ.get("DB_NAME", "vendas_honda")
    return sa.create_engine(f"postgresql+psycopg://{usuario}:{senha}@{host}:{porta}/{nome_banco}")


def linhas(conn: sa.Connection, sql: str) -> list[dict]:
    return [dict(r) for r in conn.execute(sa.text(sql)).mappings().all()]


def main() -> None:
    engine = montar_engine()
    with engine.connect() as conn:
        lojas = linhas(conn, "SELECT id, nome, cidade, equipe_apelido, meta_mensal FROM lojas ORDER BY id")
        gerentes = linhas(conn, "SELECT id, nome, loja_id FROM gerentes ORDER BY id")
        vendedores = linhas(conn, "SELECT id, nome, loja_id, gerente_id FROM vendedores ORDER BY id")
        modelos = linhas(conn, "SELECT id, nome, categoria, preco_tabela FROM modelos ORDER BY id")
        # AT TIME ZONE devolve o horário de parede de Recife (sem fuso), que é o
        # que interessa: o dia e a hora em que a venda aconteceu na loja.
        vendas = linhas(
            conn,
            """SELECT id, loja_id, vendedor_id, gerente_id, modelo_id, quantidade, valor_unitario,
                      forma_pagamento, cliente_nome,
                      (criado_em AT TIME ZONE 'America/Recife') AS local_ts
               FROM vendas ORDER BY criado_em, id""",
        )

    if not vendas:
        raise SystemExit("Banco sem vendas. Rode scripts/gerar_dados_ficticios.py antes.")

    ultimo_dia = max(v["local_ts"].date() for v in vendas)

    for m in modelos:
        m["preco_tabela"] = float(m["preco_tabela"])

    vendas_saida = []
    for v in vendas:
        ts = v.pop("local_ts")
        v["valor_unitario"] = float(v["valor_unitario"])
        v["dias_atras"] = (ultimo_dia - ts.date()).days
        v["hora"] = ts.hour
        v["minuto"] = ts.minute
        vendas_saida.append(v)

    conteudo = {
        "lojas": lojas,
        "gerentes": gerentes,
        "vendedores": vendedores,
        "modelos": modelos,
        "vendas": vendas_saida,
    }

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(json.dumps(conteudo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{DESTINO.relative_to(RAIZ)}: {len(vendas_saida)} vendas, {len(lojas)} lojas, {len(vendedores)} vendedores")


if __name__ == "__main__":
    main()


from collections import defaultdict

from carga import (
    ler_planilha,
    transformar,
)


def normalizar(valor):

    if valor is None:
        return ""

    return str(valor).strip()


def main():

    print("=" * 70)
    print("VERIFICAÇÃO DE CONSISTÊNCIA DAS VAGAS")
    print("=" * 70)

    linhas = ler_planilha()

    registros, erros = transformar(
        linhas
    )

    if erros:

        print(
            f"\nExistem {len(erros)} erros "
            "na transformação."
        )

        for erro in erros[:30]:
            print(f" - {erro}")

        return

    por_vaga = defaultdict(
        lambda: {
            "cargos": set(),
            "dseis": set(),
            "linhas": [],
        }
    )

    for registro in registros:

        chave = (
            registro["edital"],
            registro["codigo_vaga"],
        )

        cargo = normalizar(
            registro.get("cargo")
        )

        dsei = normalizar(
            registro.get("dsei")
        )

        if cargo:
            por_vaga[chave][
                "cargos"
            ].add(cargo)

        if dsei:
            por_vaga[chave][
                "dseis"
            ].add(dsei)

        por_vaga[chave][
            "linhas"
        ].append(
            {
                "linha":
                    registro[
                        "linha_origem"
                    ],

                "nome":
                    registro[
                        "nome"
                    ],

                "cargo":
                    cargo,

                "dsei":
                    dsei,
            }
        )

    problemas_cargo = {
        chave: dados
        for chave, dados
        in por_vaga.items()
        if len(
            dados["cargos"]
        ) > 1
    }

    problemas_dsei = {
        chave: dados
        for chave, dados
        in por_vaga.items()
        if len(
            dados["dseis"]
        ) > 1
    }

    print(
        f"\nVagas analisadas: "
        f"{len(por_vaga)}"
    )

    print(
        "Vagas com mais de um cargo: "
        f"{len(problemas_cargo)}"
    )

    print(
        "Vagas com mais de um DSEI: "
        f"{len(problemas_dsei)}"
    )

    if problemas_cargo:

        print(
            "\n"
            + "=" * 70
        )

        print(
            "VAGAS COM CARGOS DIVERGENTES"
        )

        print(
            "=" * 70
        )

        for (
            edital,
            vaga,
        ), dados in (
            problemas_cargo.items()
        ):

            print(
                f"\nEdital: {edital}"
            )

            print(
                f"Vaga: {vaga}"
            )

            print(
                "Cargos encontrados:"
            )

            for cargo in sorted(
                dados["cargos"]
            ):

                print(
                    f"  - {cargo}"
                )

            print(
                "\nLinhas:"
            )

            for item in (
                dados["linhas"]
            ):

                print(
                    f"  Linha "
                    f"{item['linha']} | "
                    f"{item['nome']} | "
                    f"{item['cargo']}"
                )

    if problemas_dsei:

        print(
            "\n"
            + "=" * 70
        )

        print(
            "VAGAS COM DSEIs DIVERGENTES"
        )

        print(
            "=" * 70
        )

        for (
            edital,
            vaga,
        ), dados in (
            problemas_dsei.items()
        ):

            print(
                f"\nEdital: {edital}"
            )

            print(
                f"Vaga: {vaga}"
            )

            print(
                "DSEIs encontrados:"
            )

            for dsei in sorted(
                dados["dseis"]
            ):

                print(
                    f"  - {dsei}"
                )

            print(
                "\nLinhas:"
            )

            for item in (
                dados["linhas"]
            ):

                print(
                    f"  Linha "
                    f"{item['linha']} | "
                    f"{item['nome']} | "
                    f"{item['dsei']}"
                )

    print(
        "\n"
        + "=" * 70
    )

    if (
        not problemas_cargo
        and
        not problemas_dsei
    ):

        print(
            "CONSISTÊNCIA OK"
        )

        print(
            "Cada Edital + Vaga possui "
            "um único cargo e um único DSEI."
        )

    else:

        print(
            "FORAM ENCONTRADAS "
            "INCONSISTÊNCIAS."
        )

        print(
            "Corrija ou avalie esses casos "
            "antes da primeira sincronização."
        )

    print(
        "=" * 70
    )


if __name__ == "__main__":
    main()
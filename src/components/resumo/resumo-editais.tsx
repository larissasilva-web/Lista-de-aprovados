"use client";

import {
  useMemo,
  useState,
} from "react";

import * as XLSX from "xlsx";

export type ResumoEdital = {
  edital_id: string;

  processo_seletivo: string;

  edital: string;

  status_edital: boolean;

  total_lista: number;

  total_sub_judice: number;

  total_status_aprovado: number;

  total_convocados: number;

  total_contratados: number;

  total_desistentes: number;

  total_documentacao_rejeitada: number;

  total_desligamento: number;

  total_migracao: number;
};

type Props = {
  dadosIniciais: ResumoEdital[];
};

function numero(
  valor: unknown
) {
  return Number(valor ?? 0);
}

export function ResumoEditais({
  dadosIniciais,
}: Props) {
  const [
    pesquisa,
    setPesquisa,
  ] = useState("");

  const [
    filtroStatus,
    setFiltroStatus,
  ] = useState<
    "todos" | "ativos" | "inativos"
  >("todos");


  // ==========================================================
  // FILTROS
  // ==========================================================

  const dadosFiltrados =
    useMemo(() => {
      const termo =
        pesquisa
          .trim()
          .toLocaleLowerCase(
            "pt-BR"
          );

      return dadosIniciais.filter(
        (item) => {
          const correspondePesquisa =
            !termo ||
            item.processo_seletivo
              .toLocaleLowerCase(
                "pt-BR"
              )
              .includes(
                termo
              ) ||
            item.edital
              .toLocaleLowerCase(
                "pt-BR"
              )
              .includes(
                termo
              );

          const correspondeStatus =
            filtroStatus ===
              "todos" ||
            (
              filtroStatus ===
                "ativos" &&
              item.status_edital
            ) ||
            (
              filtroStatus ===
                "inativos" &&
              !item.status_edital
            );

          return (
            correspondePesquisa &&
            correspondeStatus
          );
        }
      );
    }, [
      dadosIniciais,
      pesquisa,
      filtroStatus,
    ]);


  // ==========================================================
  // TOTAIS
  // ==========================================================

  const totais =
    useMemo(() => {
      return dadosFiltrados.reduce(
        (
          acumulado,
          item
        ) => {
          acumulado.editais +=
            1;

          acumulado.lista +=
            numero(
              item.total_lista
            );

          acumulado.contratados +=
            numero(
              item.total_contratados
            );

          acumulado.subJudice +=
            numero(
              item.total_sub_judice
            );

          return acumulado;
        },
        {
          editais: 0,
          lista: 0,
          contratados: 0,
          subJudice: 0,
        }
      );
    }, [
      dadosFiltrados,
    ]);


  const percentualContratados =
    totais.lista > 0
      ? (
          (
            totais.contratados /
            totais.lista
          ) *
          100
        ).toFixed(1)
      : "0,0";


  // ==========================================================
  // EXPORTAÇÃO XLSX
  // ==========================================================

  function exportarExcel() {
    const linhas =
      dadosFiltrados.map(
        (item) => ({
          "Processo Seletivo":
            item.processo_seletivo,

          "Edital":
            item.edital,

          "Status do Edital":
            item.status_edital
              ? "Ativo"
              : "Inativo",

          "Total da Lista":
            numero(
              item.total_lista
            ),

          "Sub judice":
            numero(
              item.total_sub_judice
            ),

          "Aprovados":
            numero(
              item.total_status_aprovado
            ),

          "Convocados":
            numero(
              item.total_convocados
            ),

          "Contratados":
            numero(
              item.total_contratados
            ),

          "Desistentes":
            numero(
              item.total_desistentes
            ),

          "Documentação Rejeitada":
            numero(
              item.total_documentacao_rejeitada
            ),

          "Desligamento":
  numero(
    item.total_desligamento
  ),

          "Migração":
            numero(
              item.total_migracao
            ),
        })
      );


    const planilha =
      XLSX.utils.json_to_sheet(
        linhas
      );


    // --------------------------------------------------------
    // Largura das colunas
    // --------------------------------------------------------

    planilha["!cols"] = [
      { wch: 36 },
      { wch: 25 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
    ];


    const workbook =
      XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
      workbook,
      planilha,
      "Resumo"
    );


    const hoje =
      new Date();

    const data =
      [
        hoje
          .getFullYear(),

        String(
          hoje.getMonth() +
            1
        ).padStart(
          2,
          "0"
        ),

        String(
          hoje.getDate()
        ).padStart(
          2,
          "0"
        ),
      ].join(
        ""
      );


    XLSX.writeFile(
      workbook,
      `resumo-editais-${data}.xlsx`
    );
  }


  return (
    <div className="space-y-6">

      {/* CARDS */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Editais
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {totais.editais.toLocaleString(
              "pt-BR"
            )}
          </p>
        </div>


        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Total da lista
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {totais.lista.toLocaleString(
              "pt-BR"
            )}
          </p>
        </div>


        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Contratados
          </p>

          <p className="mt-2 text-2xl font-semibold text-emerald-700">
            {totais.contratados.toLocaleString(
              "pt-BR"
            )}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {percentualContratados.replace(
              ".",
              ","
            )}
            % da lista
          </p>
        </div>


        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Sub judice
          </p>

          <p className="mt-2 text-2xl font-semibold text-violet-700">
            {totais.subJudice.toLocaleString(
              "pt-BR"
            )}
          </p>
        </div>

      </div>


      {/* FILTROS */}

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-[1fr_220px_auto]">

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pesquisar
          </label>

          <input
            type="search"
            value={
              pesquisa
            }
            onChange={(
              event
            ) =>
              setPesquisa(
                event.target.value
              )
            }
            placeholder="Processo seletivo ou edital..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>


        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
          </label>

          <select
            value={
              filtroStatus
            }
            onChange={(
              event
            ) =>
              setFiltroStatus(
                event.target
                  .value as
                  | "todos"
                  | "ativos"
                  | "inativos"
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="todos">
              Todos
            </option>

            <option value="ativos">
              Ativos
            </option>

            <option value="inativos">
              Inativos
            </option>
          </select>
        </div>


        <div className="flex items-end">
          <button
            type="button"
            onClick={
              exportarExcel
            }
            disabled={
              dadosFiltrados.length ===
              0
            }
            className="w-full rounded-lg bg-[#094780] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Exportar XLSX
          </button>
        </div>

      </div>


      {/* TOTAL DE RESULTADOS */}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {dadosFiltrados.length.toLocaleString(
            "pt-BR"
          )}{" "}
          edital
          {dadosFiltrados.length ===
          1
            ? ""
            : "is"}
        </p>
      </div>


      {/* TABELA */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1550px]">

            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Processo seletivo
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Edital
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Status
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Total
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Sub judice
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Aprovados
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Convocados
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Contratados
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Desistentes
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Doc. rejeitada
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Desligamento
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Migração
                </th>

              </tr>
            </thead>


            <tbody className="divide-y divide-slate-100">

              {dadosFiltrados.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={
                      12
                    }
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Nenhum resultado encontrado.
                  </td>
                </tr>
              ) : (
                dadosFiltrados.map(
                  (item) => (
                    <tr
                      key={
                        item.edital_id
                      }
                      className="hover:bg-slate-50/50"
                    >

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {
                          item.processo_seletivo
                        }
                      </td>

                      <td className="px-4 py-4 text-sm font-medium text-slate-900">
                        {
                          item.edital
                        }
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={
                            item.status_edital
                              ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                              : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                          }
                        >
                          {item.status_edital
                            ? "Ativo"
                            : "Inativo"}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right text-sm font-medium text-slate-700">
                        {numero(
                          item.total_lista
                        ).toLocaleString(
                          "pt-BR"
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-violet-700">
                        {numero(
                          item.total_sub_judice
                        ).toLocaleString(
                          "pt-BR"
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-slate-700">
                        {numero(
                          item.total_status_aprovado
                        ).toLocaleString(
                          "pt-BR"
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-blue-700">
                        {numero(
                          item.total_convocados
                        ).toLocaleString(
                          "pt-BR"
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-sm font-medium text-emerald-700">
                        {numero(
                          item.total_contratados
                        ).toLocaleString(
                          "pt-BR"
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-red-700">
                        {numero(
                          item.total_desistentes
                        ).toLocaleString(
                          "pt-BR"
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-purple-700">
                        {numero(
                          item.total_documentacao_rejeitada
                        ).toLocaleString(
                          "pt-BR"
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-orange-700">
                        {numero(
                          item.total_desligamento
                        ).toLocaleString(
                          "pt-BR"
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-cyan-700">
                        {numero(
                          item.total_migracao
                        ).toLocaleString(
                          "pt-BR"
                        )}
                      </td>

                    </tr>
                  )
                )
              )}

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";

type Edital = {
  id: string;

  processo_seletivo: string;

  edital: string;

  status_edital: boolean;

  data_inicio: string | null;

  data_fim: string | null;

  prazo_validade: string | null;

  prorrogavel: boolean | null;
};

type Props = {
  editaisIniciais: Edital[];

  podeExcluir: boolean;
};

const PROCESSOS_SELETIVOS = [
  "Saúde Indígena",
  "Sede",
  "CCE",
  "Saúde nas Fronteiras",
  "Escritórios Regionais/Distritais",
  "MFC",
  "Projeto Agora Tem Especialistas Caminhoneiros",
];

function formatarData(
  valor: string | null
) {
  if (!valor) {
    return "—";
  }

  const [
    ano,
    mes,
    dia,
  ] = valor.split("-");

  return `${dia}/${mes}/${ano}`;
}

function formatarPrazo(
  anos: number,
  meses: number
) {
  const partes:
    string[] = [];

  if (anos > 0) {
    partes.push(
      `${anos} ${
        anos === 1
          ? "ano"
          : "anos"
      }`
    );
  }

  if (meses > 0) {
    partes.push(
      `${meses} ${
        meses === 1
          ? "mês"
          : "meses"
      }`
    );
  }

  return partes.join(
    " e "
  );
}

function extrairPrazo(
  prazo:
    string | null
) {
  if (!prazo) {
    return {
      anos: 0,
      meses: 0,
    };
  }

  const anoMatch =
    prazo.match(
      /(\d+)\s*ano/i
    );

  const mesMatch =
    prazo.match(
      /(\d+)\s*m[eê]s/i
    );

  return {
    anos:
      anoMatch
        ? Number(
            anoMatch[1]
          )
        : 0,

    meses:
      mesMatch
        ? Number(
            mesMatch[1]
          )
        : 0,
  };
}

export function GerenciamentoEditais({
  editaisIniciais,
  podeExcluir,
}: Props) {
  const router =
    useRouter();

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

  const [
    processandoId,
    setProcessandoId,
  ] = useState<
    string | null
  >(null);

  const [
    editalEditando,
    setEditalEditando,
  ] = useState<
    Edital | null
  >(null);

  const [
    processo,
    setProcesso,
  ] = useState("");

  const [
    nomeEdital,
    setNomeEdital,
  ] = useState("");

  const [
    dataInicio,
    setDataInicio,
  ] = useState("");

  const [
    dataFim,
    setDataFim,
  ] = useState("");

  const [
    prazoAnos,
    setPrazoAnos,
  ] = useState(0);

  const [
    prazoMeses,
    setPrazoMeses,
  ] = useState(0);

  const [
    prorrogavel,
    setProrrogavel,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    sucesso,
    setSucesso,
  ] = useState("");

  const editais =
    useMemo(() => {
      const termo =
        pesquisa
          .trim()
          .toLocaleLowerCase(
            "pt-BR"
          );

      return editaisIniciais.filter(
        (item) => {
          const correspondePesquisa =
            !termo ||
            item.edital
              .toLocaleLowerCase(
                "pt-BR"
              )
              .includes(
                termo
              ) ||
            item.processo_seletivo
              .toLocaleLowerCase(
                "pt-BR"
              )
              .includes(
                termo
              );

          const correspondeStatus =
            filtroStatus ===
              "todos" ||
            (filtroStatus ===
              "ativos" &&
              item.status_edital) ||
            (filtroStatus ===
              "inativos" &&
              !item.status_edital);

          return (
            correspondePesquisa &&
            correspondeStatus
          );
        }
      );
    }, [
      editaisIniciais,
      pesquisa,
      filtroStatus,
    ]);

  function abrirEdicao(
    edital: Edital
  ) {
    setErro("");
    setSucesso("");

    const prazo =
      extrairPrazo(
        edital.prazo_validade
      );

    setEditalEditando(
      edital
    );

    setProcesso(
      edital.processo_seletivo
    );

    setNomeEdital(
      edital.edital
    );

    setDataInicio(
      edital.data_inicio ??
        ""
    );

    setDataFim(
      edital.data_fim ??
        ""
    );

    setPrazoAnos(
      prazo.anos
    );

    setPrazoMeses(
      prazo.meses
    );

    setProrrogavel(
      edital.prorrogavel ??
        false
    );
  }

  function fecharEdicao() {
    if (processandoId) {
      return;
    }

    setEditalEditando(
      null
    );

    setErro("");
  }

  async function salvarEdicao(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editalEditando) {
      return;
    }

    setErro("");
    setSucesso("");

    if (
      !processo ||
      !nomeEdital.trim()
    ) {
      setErro(
        "Preencha o processo seletivo e o edital."
      );

      return;
    }

    if (
      dataInicio &&
      dataFim &&
      dataFim < dataInicio
    ) {
      setErro(
        "A data final não pode ser anterior à data inicial."
      );

      return;
    }

    if (
      prazoAnos === 0 &&
      prazoMeses === 0
    ) {
      setErro(
        "Informe pelo menos 1 mês de prazo de validade."
      );

      return;
    }

    if (
      prazoAnos < 0 ||
      prazoAnos > 99 ||
      prazoMeses < 0 ||
      prazoMeses > 11
    ) {
      setErro(
        "Informe um prazo de validade válido."
      );

      return;
    }

    setProcessandoId(
      editalEditando.id
    );

    try {
      const supabase =
        createClient();

      const {
        error,
      } = await supabase
        .from("editais")
        .update({
          processo_seletivo:
            processo,

          edital:
            nomeEdital.trim(),

          data_inicio:
            dataInicio ||
            null,

          data_fim:
            dataFim ||
            null,

          prazo_validade:
            formatarPrazo(
              prazoAnos,
              prazoMeses
            ),

          prorrogavel,
        })
        .eq(
          "id",
          editalEditando.id
        );

      if (error) {
        throw error;
      }

      setEditalEditando(
        null
      );

      setSucesso(
        `Edital ${nomeEdital.trim()} atualizado com sucesso.`
      );

      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o edital."
      );
    } finally {
      setProcessandoId(
        null
      );
    }
  }

  async function alterarStatus(
    edital: Edital
  ) {
    const novoStatus =
      !edital.status_edital;

    const acao =
      novoStatus
        ? "ativar"
        : "inativar";

    const confirmou =
      window.confirm(
        `Deseja ${acao} o edital?\n\n${edital.edital}`
      );

    if (!confirmou) {
      return;
    }

    setErro("");
    setSucesso("");

    setProcessandoId(
      edital.id
    );

    try {
      const supabase =
        createClient();

      const {
        error,
      } = await supabase
        .from("editais")
        .update({
          status_edital:
            novoStatus,
        })
        .eq(
          "id",
          edital.id
        );

      if (error) {
        throw error;
      }

      setSucesso(
        novoStatus
          ? `Edital ${edital.edital} ativado com sucesso.`
          : `Edital ${edital.edital} inativado com sucesso.`
      );

      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o status do edital."
      );
    } finally {
      setProcessandoId(
        null
      );
    }
  }

  async function excluir(
    edital: Edital
  ) {
    const confirmou =
      window.confirm(
        `ATENÇÃO\n\nExcluir definitivamente o edital "${edital.edital}"?\n\nTodos os candidatos vinculados a ele também serão excluídos.\n\nEsta operação não pode ser desfeita.`
      );

    if (!confirmou) {
      return;
    }

    setErro("");
    setSucesso("");

    setProcessandoId(
      edital.id
    );

    try {
      const supabase =
        createClient();

      const {
        error,
      } = await supabase
        .from("editais")
        .delete()
        .eq(
          "id",
          edital.id
        );

      if (error) {
        throw error;
      }

      setSucesso(
        `Edital ${edital.edital} excluído com sucesso.`
      );

      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o edital."
      );
    } finally {
      setProcessandoId(
        null
      );
    }
  }

  return (
    <>
      {erro &&
        !editalEditando && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

      {sucesso && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {sucesso}
        </div>
      )}

      {/* PESQUISA */}

      <div className="mb-5 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-[1fr_220px]">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pesquisar edital
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
            placeholder="Digite o edital ou processo seletivo..."
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
      </div>

      {/* TABELA */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-medium text-slate-900">
            Editais cadastrados
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {editais.length} edital
            {editais.length ===
            1
              ? ""
              : "is"}{" "}
            encontrado
            {editais.length ===
            1
              ? ""
              : "s"}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Processo seletivo
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Edital
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Início
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Fim
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Validade
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Prorrogável
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Status
                </th>

                <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {editais.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={
                      8
                    }
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Nenhum edital encontrado.
                  </td>
                </tr>
              ) : (
                editais.map(
                  (edital) => {
                    const processando =
                      processandoId ===
                      edital.id;

                    return (
                      <tr
                        key={
                          edital.id
                        }
                        className="hover:bg-slate-50/50"
                      >
                        <td className="px-5 py-4 text-sm text-slate-700">
                          {
                            edital.processo_seletivo
                          }
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-slate-900">
                          {
                            edital.edital
                          }
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatarData(
                            edital.data_inicio
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatarData(
                            edital.data_fim
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {edital.prazo_validade ||
                            "—"}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {edital.prorrogavel
                            ? "Sim"
                            : "Não"}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={
                              edital.status_edital
                                ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                                : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                            }
                          >
                            {edital.status_edital
                              ? "Ativo"
                              : "Inativo"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={
                                processando
                              }
                              onClick={() =>
                                abrirEdicao(
                                  edital
                                )
                              }
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              disabled={
                                processando
                              }
                              onClick={() =>
                                alterarStatus(
                                  edital
                                )
                              }
                              className={
                                edital.status_edital
                                  ? "rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                  : "rounded-lg border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                              }
                            >
                              {edital.status_edital
                                ? "Inativar"
                                : "Ativar"}
                            </button>

                            {podeExcluir && (
                              <button
                                type="button"
                                disabled={
                                  processando
                                }
                                onClick={() =>
                                  excluir(
                                    edital
                                  )
                                }
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Excluir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE EDIÇÃO */}

      {editalEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Editar edital
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Altere as informações cadastrais do edital.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  fecharEdicao
                }
                disabled={
                  Boolean(
                    processandoId
                  )
                }
                className="text-2xl leading-none text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                salvarEdicao
              }
              className="p-6"
            >
              {erro && (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {erro}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Processo seletivo *
                  </label>

                  <select
                    required
                    value={
                      processo
                    }
                    onChange={(
                      event
                    ) =>
                      setProcesso(
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                  >
                    {PROCESSOS_SELETIVOS.map(
                      (item) => (
                        <option
                          key={
                            item
                          }
                          value={
                            item
                          }
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Edital *
                  </label>

                  <input
                    required
                    value={
                      nomeEdital
                    }
                    onChange={(
                      event
                    ) =>
                      setNomeEdital(
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Data de início
                    </label>

                    <input
                      type="date"
                      value={
                        dataInicio
                      }
                      onChange={(
                        event
                      ) =>
                        setDataInicio(
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Data final
                    </label>

                    <input
                      type="date"
                      value={
                        dataFim
                      }
                      onChange={(
                        event
                      ) =>
                        setDataFim(
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Prazo de validade *
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <span className="mb-1.5 block text-xs text-slate-500">
                        Anos
                      </span>

                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={
                          prazoAnos
                        }
                        onChange={(
                          event
                        ) =>
                          setPrazoAnos(
                            Number(
                              event.target.value
                            )
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                      />
                    </div>

                    <div>
                      <span className="mb-1.5 block text-xs text-slate-500">
                        Meses
                      </span>

                      <input
                        type="number"
                        min={0}
                        max={11}
                        value={
                          prazoMeses
                        }
                        onChange={(
                          event
                        ) =>
                          setPrazoMeses(
                            Number(
                              event.target.value
                            )
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Prorrogável?
                  </label>

                  <select
                    value={
                      prorrogavel
                        ? "sim"
                        : "nao"
                    }
                    onChange={(
                      event
                    ) =>
                      setProrrogavel(
                        event.target.value ===
                          "sim"
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                  >
                    <option value="nao">
                      Não
                    </option>

                    <option value="sim">
                      Sim
                    </option>
                  </select>
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  A edição altera somente os dados cadastrais do edital. A lista/anexo original de aprovados não é substituída.
                </div>
              </div>

              <div className="mt-7 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={
                    fecharEdicao
                  }
                  disabled={
                    Boolean(
                      processandoId
                    )
                  }
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    Boolean(
                      processandoId
                    )
                  }
                  className="rounded-lg bg-[#094780] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {processandoId
                    ? "Salvando..."
                    : "Salvar alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
import Link from "next/link";

import {
  AdicionarSubJudiceModal,
} from "@/components/lista/adicionar-sub-judice-modal";

import {
  AlterarStatusModal,
} from "@/components/lista/alterar-status-modal";

import {
  FiltrosLista,
} from "@/components/lista/filtros-lista";

import {
  RemoverSubJudiceButton,
} from "@/components/lista/remover-sub-judice-button";

import {
  exigirPermissao,
} from "@/lib/auth/usuario-atual";

import {
  createClient,
} from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    processo?: string;
    edital?: string;
    cargo?: string;
    pagina?: string;
  }>;
};

const POR_PAGINA = 50;

function classeStatus(
  status: string
) {
  switch (status) {
    case "Contratado":
      return "bg-emerald-50 text-emerald-700";

    case "Convocado":
      return "bg-blue-50 text-blue-700";

    case "Desistente":
      return "bg-red-50 text-red-700";

    case "Documentação Rejeitada":
      return "bg-purple-50 text-purple-700";

    case "Vacância":
      return "bg-orange-50 text-orange-700";

    case "Migração":
      return "bg-cyan-50 text-cyan-700";

    default:
      return "bg-amber-50 text-amber-700";
  }
}

function formatarNota(
  nota: number | null
) {
  if (
    nota === null ||
    nota === undefined
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "pt-BR",
    {
      minimumFractionDigits:
        0,

      maximumFractionDigits:
        2,
    }
  ).format(
    Number(nota)
  );
}

export default async function ListaPage({
  searchParams,
}: PageProps) {
  const parametros =
    await searchParams;

  const usuarioAtual =
    await exigirPermissao([
      "usuario",
      "contratador",
      "admin",
    ]);

  const supabase =
    await createClient();

  // ==========================================================
  // PERFIL ATUAL
  // ==========================================================

  const {
    data: permissaoAtual,
  } = await supabase
    .from("permissoes")
    .select(
      "tipo_permissao"
    )
    .ilike(
      "email",
      usuarioAtual.email
    )
    .maybeSingle();

  const tipoPermissao =
    permissaoAtual?.tipo_permissao ??
    "usuario";

  const podeAlterar =
    tipoPermissao ===
      "contratador" ||
    tipoPermissao ===
      "admin";

  // ==========================================================
  // EDITAIS
  //
  // IMPORTANTE:
  // não filtramos mais status_edital = true.
  // ==========================================================

  const {
    data: editaisData,
    error: erroEditais,
  } = await supabase
    .from("editais")
    .select(`
      id,
      processo_seletivo,
      edital,
      status_edital
    `)
    .order(
      "processo_seletivo",
      {
        ascending: true,
      }
    )
    .order(
      "edital",
      {
        ascending: true,
      }
    );

  if (erroEditais) {
    throw new Error(
      `Erro ao carregar editais: ${erroEditais.message}`
    );
  }

  const editais =
    editaisData ?? [];

  const mapaEditais =
    new Map(
      editais.map(
        (item) => [
          item.id,
          item,
        ]
      )
    );

  const editalId =
    parametros.edital ??
    "";

  const editalSelecionado =
    editalId
      ? mapaEditais.get(
          editalId
        )
      : undefined;

  // ==========================================================
  // CARGOS DO EDITAL SELECIONADO
  // ==========================================================

  let cargos:
    string[] = [];

  if (editalId) {
    const {
      data: cargosData,
      error:
        erroCargos,
    } =
      await supabase.rpc(
        "listar_cargos_edital",
        {
          p_edital_id:
            editalId,
        }
      );

    if (erroCargos) {
      throw new Error(
        `Erro ao carregar cargos: ${erroCargos.message}`
      );
    }

    const listaCargos =
  (cargosData ?? []) as {
    cargo: string | null;
  }[];

cargos = listaCargos
  .map(
    (item) =>
      item.cargo
  )
  .filter(
    (
      cargo: string | null
    ): cargo is string =>
      Boolean(cargo)
  );
  }

  // ==========================================================
  // PAGINAÇÃO
  // ==========================================================

  const paginaInformada =
    Number(
      parametros.pagina ??
        "1"
    );

  const pagina =
    Number.isFinite(
      paginaInformada
    ) &&
    paginaInformada > 0
      ? Math.floor(
          paginaInformada
        )
      : 1;

  const inicio =
    (pagina - 1) *
    POR_PAGINA;

  const fim =
    inicio +
    POR_PAGINA -
    1;

  // ==========================================================
  // CANDIDATOS
  // ==========================================================

  let consulta =
    supabase
      .from(
        "lista_aprovados"
      )
      .select(
        `
          id,
          edital_id,
          processo_seletivo,
          edital,
          cargo,
          classificacao,
          nota,
          nome,
          modalidade_candidatura,
          sub_judice,
          origem_cadastro,
          status,
          processo_sei,
          matricula
        `,
        {
          count: "exact",
        }
      );

  if (
    parametros.processo
  ) {
    consulta =
      consulta.eq(
        "processo_seletivo",
        parametros.processo
      );
  }

  if (editalId) {
    consulta =
      consulta.eq(
        "edital_id",
        editalId
      );
  }

  if (
    parametros.cargo
  ) {
    consulta =
      consulta.eq(
        "cargo",
        parametros.cargo
      );
  }

  const {
    data:
      candidatosData,
    error:
      erroCandidatos,
    count,
  } = await consulta
    .order(
      "cargo",
      {
        ascending: true,
      }
    )
    .order(
      "nota",
      {
        ascending: false,
        nullsFirst: false,
      }
    )
    .order(
      "nome",
      {
        ascending: true,
      }
    )
    .range(
      inicio,
      fim
    );

  if (
    erroCandidatos
  ) {
    throw new Error(
      `Erro ao carregar candidatos: ${erroCandidatos.message}`
    );
  }

  const candidatos =
    candidatosData ?? [];

  const total =
    count ?? 0;

  const totalPaginas =
    Math.max(
      1,
      Math.ceil(
        total /
          POR_PAGINA
      )
    );

  function urlPagina(
    novaPagina: number
  ) {
    const query =
      new URLSearchParams();

    if (
      parametros.processo
    ) {
      query.set(
        "processo",
        parametros.processo
      );
    }

    if (editalId) {
      query.set(
        "edital",
        editalId
      );
    }

    if (
      parametros.cargo
    ) {
      query.set(
        "cargo",
        parametros.cargo
      );
    }

    query.set(
      "pagina",
      String(
        novaPagina
      )
    );

    return `/lista?${query.toString()}`;
  }

  return (
    <section>
      {/* CABEÇALHO */}

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">
            Lista de Aprovados
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Consulte e gerencie os candidatos dos processos seletivos.
          </p>
        </div>

        {podeAlterar &&
          (editalSelecionado ? (
            <AdicionarSubJudiceModal
              editalId={
                editalSelecionado.id
              }
              editalNome={
                editalSelecionado.edital
              }
              cargos={
                cargos
              }
            />
          ) : (
            <button
              type="button"
              disabled
              title="Selecione um edital para adicionar um candidato Sub judice."
              className="cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-500"
            >
              + Sub judice
            </button>
          ))}
      </div>

      {/* FILTROS */}

      <FiltrosLista
        editais={
          editais
        }
        cargos={
          cargos
        }
      />

      {/* AVISO EDITAL INATIVO */}

      {editalSelecionado &&
        !editalSelecionado.status_edital && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <strong>
              Edital inativo.
            </strong>{" "}
            Os candidatos permanecem disponíveis para consulta, mas alterações de status estão bloqueadas. A inclusão ou remoção de candidatos Sub judice continua disponível.
          </div>
        )}

      {/* TOTAL */}

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {total.toLocaleString(
            "pt-BR"
          )}{" "}
          candidato
          {total === 1
            ? ""
            : "s"}
        </p>

        <p className="text-sm text-slate-500">
          Página {pagina} de{" "}
          {totalPaginas}
        </p>
      </div>

      {/* TABELA */}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">
                  Cargo
                </th>

                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">
                  Classificação
                </th>

                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">
                  Nome
                </th>

                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">
                  Modalidade
                </th>

                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">
                  Nota
                </th>

                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">
                  Status
                </th>

                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {candidatos.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={
                      7
                    }
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Nenhum candidato encontrado.
                  </td>
                </tr>
              ) : (
                candidatos.map(
                  (
                    candidato
                  ) => {
                    const edital =
                      mapaEditais.get(
                        candidato.edital_id
                      );

                    const editalAtivo =
                      edital?.status_edital ??
                      false;

                    return (
                      <tr
                        key={
                          candidato.id
                        }
                        className="hover:bg-slate-50/50"
                      >
                        {/* CARGO */}

                        <td className="px-4 py-4 text-sm text-slate-700">
                          {
                            candidato.cargo
                          }
                        </td>

                        {/* CLASSIFICAÇÃO */}

                        <td className="px-4 py-4 text-sm">
                          {candidato.sub_judice ? (
                            <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                              Sub judice
                            </span>
                          ) : (
                            <span className="text-slate-700">
                              {candidato.classificacao ??
                                "—"}
                            </span>
                          )}
                        </td>

                        {/* NOME */}

                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-slate-900">
                            {
                              candidato.nome
                            }
                          </div>

                          {!editalAtivo && (
                            <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                              Edital inativo
                            </span>
                          )}
                        </td>

                        {/* MODALIDADE */}

                        <td className="px-4 py-4 text-sm text-slate-600">
                          {candidato.modalidade_candidatura ||
                            "—"}
                        </td>

                        {/* NOTA */}

                        <td className="px-4 py-4 text-right text-sm font-medium text-slate-700">
                          {formatarNota(
                            candidato.nota
                          )}
                        </td>

                        {/* STATUS */}

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${classeStatus(
                              candidato.status
                            )}`}
                          >
                            {
                              candidato.status
                            }
                          </span>
                        </td>

                        {/* AÇÕES */}

                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-1.5">
                            {podeAlterar ? (
                              <>
                                <AlterarStatusModal
                                  candidatoId={
                                    candidato.id
                                  }
                                  nome={
                                    candidato.nome
                                  }
                                  statusAtual={
                                    candidato.status
                                  }
                                  processoSeiAtual={
                                    candidato.processo_sei
                                  }
                                  matriculaAtual={
                                    candidato.matricula
                                  }
                                  editalAtivo={
                                    editalAtivo
                                  }
                                />

                                {candidato.sub_judice && (
                                  <RemoverSubJudiceButton
                                    candidatoId={
                                      candidato.id
                                    }
                                    nome={
                                      candidato.nome
                                    }
                                  />
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Somente leitura
                              </span>
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

      {/* PAGINAÇÃO */}

      {totalPaginas >
        1 && (
        <div className="mt-5 flex items-center justify-between">
          {pagina >
          1 ? (
            <Link
              href={urlPagina(
                pagina -
                  1
              )}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              ← Anterior
            </Link>
          ) : (
            <span />
          )}

          {pagina <
          totalPaginas ? (
            <Link
              href={urlPagina(
                pagina +
                  1
              )}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Próxima →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </section>
  );
}
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { obterUsuarioAtual } from "@/lib/auth/usuario-atual";

import { FiltrosLista } from "@/components/lista/filtros-lista";
import { AlterarStatusModal } from "@/components/lista/alterar-status-modal";
import { AdicionarSubJudiceModal } from "@/components/lista/adicionar-sub-judice-modal";
import { RemoverSubJudiceButton } from "@/components/lista/remover-sub-judice-button";


// ============================================================
// CONFIGURAÇÕES
// ============================================================

const ITENS_POR_PAGINA = 50;


// ============================================================
// TIPOS
// ============================================================

type PageProps = {
  searchParams: Promise<{
    processo?: string;
    edital?: string;
    cargo?: string;
    pagina?: string;
  }>;
};


type Edital = {
  id: string;
  processo_seletivo: string;
  edital: string;
  status_edital: boolean;
};


type Candidato = {
  id: string;

  edital_id: string;

  processo_seletivo:
    string | null;

  edital:
    string | null;

  codigo_vaga:
    string;

  cargo:
    string;

  classificacao:
    number | null;

  nota:
    number | string | null;

  nome:
    string;

  modalidade_candidatura:
    string | null;

  status:
    string;

  processo_sei:
    string | null;

  matricula:
    string | null;

  sub_judice:
    boolean;

  origem_cadastro:
    string | null;
};


// ============================================================
// STATUS
// ============================================================

function obterClasseStatus(
  status: string
) {
  switch (status) {
    case "Aprovado":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "Convocado":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "Contratado":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "Desistente":
      return "border-slate-200 bg-slate-100 text-slate-700";

    case "Documentação Rejeitada":
      return "border-red-200 bg-red-50 text-red-700";

    case "Migração":
      return "border-purple-200 bg-purple-50 text-purple-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}


// ============================================================
// FORMATAR NOTA
// ============================================================

function formatarNota(
  valor:
    number |
    string |
    null
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "—";
  }


  const numero =
    Number(valor);


  if (
    !Number.isFinite(
      numero
    )
  ) {
    return String(
      valor
    );
  }


  return numero.toLocaleString(
    "pt-BR",
    {
      maximumFractionDigits:
        4,
    }
  );
}


// ============================================================
// URL DE PAGINAÇÃO
// ============================================================

function construirUrlPagina(
  pagina: number,
  filtros: {
    processo: string;
    edital: string;
    cargo: string;
  }
) {
  const parametros =
    new URLSearchParams();


  if (
    filtros.processo
  ) {
    parametros.set(
      "processo",
      filtros.processo
    );
  }


  if (
    filtros.edital
  ) {
    parametros.set(
      "edital",
      filtros.edital
    );
  }


  if (
    filtros.cargo
  ) {
    parametros.set(
      "cargo",
      filtros.cargo
    );
  }


  if (
    pagina > 1
  ) {
    parametros.set(
      "pagina",
      String(
        pagina
      )
    );
  }


  const query =
    parametros.toString();


  return query
    ? `/lista?${query}`
    : "/lista";
}


// ============================================================
// PÁGINA
// ============================================================

export default async function ListaPage({
  searchParams,
}: PageProps) {

  const parametros =
    await searchParams;


  // ==========================================================
  // FILTROS
  // ==========================================================

  const processo =
    parametros.processo ??
    "";

  const editalId =
    parametros.edital ??
    "";

  const cargo =
    parametros.cargo ??
    "";


  const paginaInformada =
    Number(
      parametros.pagina ??
        "1"
    );


  const paginaAtual =
    Number.isInteger(
      paginaInformada
    ) &&
    paginaInformada >
      0
      ? paginaInformada
      : 1;


  // ==========================================================
  // SUPABASE
  // ==========================================================

  const supabase =
    await createClient();


  // ==========================================================
  // USUÁRIO / PERMISSÃO
  // ==========================================================

  const usuarioAtual =
    (await obterUsuarioAtual()) as {
      tipoPermissao?:
        string;

      tipo_permissao?:
        string;
    } | null;


  const tipoPermissao =
    usuarioAtual
      ?.tipoPermissao ??
    usuarioAtual
      ?.tipo_permissao ??
    "usuario";


  const podeAlterar =
    tipoPermissao ===
      "contratador" ||
    tipoPermissao ===
      "admin";


  // ==========================================================
  // EDITAIS
  // ==========================================================

  const {
    data:
      editaisData,
    error:
      erroEditais,
  } =
    await supabase
      .from(
        "editais"
      )
      .select(
        `
          id,
          processo_seletivo,
          edital,
          status_edital
        `
      )
      .order(
        "processo_seletivo",
        {
          ascending:
            true,
        }
      )
      .order(
        "edital",
        {
          ascending:
            true,
        }
      );


  if (
    erroEditais
  ) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Erro ao carregar editais:{" "}
        {
          erroEditais.message
        }
      </div>
    );
  }


  const editais =
    (
      editaisData ??
      []
    ) as Edital[];


  // ==========================================================
  // EDITAL SELECIONADO
  // ==========================================================

  const editalSelecionado =
    editalId
      ? editais.find(
          (
            item
          ) =>
            item.id ===
            editalId
        )
      : undefined;


  const editalAtivo =
    editalSelecionado
      ?.status_edital ??
    true;


  // ==========================================================
  // CARGOS DO EDITAL
  // ==========================================================

  let cargos:
    string[] = [];


  if (
    editalId
  ) {
    const {
      data:
        cargosData,

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


    if (
      erroCargos
    ) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Erro ao carregar cargos:{" "}
          {
            erroCargos.message
          }
        </div>
      );
    }


    cargos =
      (
        (
          cargosData ??
          []
        ) as {
          cargo:
            string | null;
        }[]
      )
        .map(
          (
            item
          ) =>
            item.cargo
        )
        .filter(
          (
            valor
          ): valor is string =>
            Boolean(
              valor
            )
        );
  }


  // ==========================================================
  // CONSULTA DOS CANDIDATOS
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
          codigo_vaga,
          cargo,
          classificacao,
          nota,
          nome,
          modalidade_candidatura,
          status,
          processo_sei,
          matricula,
          sub_judice,
          origem_cadastro
        `,
        {
          count:
            "exact",
        }
      );


  // ==========================================================
  // APLICAR FILTROS
  // ==========================================================

  if (
    processo
  ) {
    consulta =
      consulta.eq(
        "processo_seletivo",
        processo
      );
  }


  if (
    editalId
  ) {
    consulta =
      consulta.eq(
        "edital_id",
        editalId
      );
  }


  if (
    cargo
  ) {
    consulta =
      consulta.eq(
        "cargo",
        cargo
      );
  }


  // ==========================================================
  // PAGINAÇÃO
  // ==========================================================

  const inicio =
    (
      paginaAtual -
      1
    ) *
    ITENS_POR_PAGINA;


  const fim =
    inicio +
    ITENS_POR_PAGINA -
    1;


  // ==========================================================
  // ORDENAÇÃO
  //
  // 1. Cargo
  // 2. Classificação
  // 3. Código da vaga
  // 4. Nome
  //
  // Sub judice possui classificação NULL e fica depois
  // dos classificados do mesmo cargo.
  // ==========================================================

  const {
    data:
      candidatosData,

    error:
      erroCandidatos,

    count,
  } =
    await consulta
      .order(
        "cargo",
        {
          ascending:
            true,
        }
      )
      .order(
        "classificacao",
        {
          ascending:
            true,

          nullsFirst:
            false,
        }
      )
      .order(
        "codigo_vaga",
        {
          ascending:
            true,
        }
      )
      .order(
        "nome",
        {
          ascending:
            true,
        }
      )
      .range(
        inicio,
        fim
      );


  if (
    erroCandidatos
  ) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Erro ao carregar candidatos:{" "}
        {
          erroCandidatos.message
        }
      </div>
    );
  }


  const candidatos =
    (
      candidatosData ??
      []
    ) as Candidato[];


  // ==========================================================
  // PAGINAÇÃO
  // ==========================================================

  const totalRegistros =
    count ?? 0;


  const totalPaginas =
    Math.max(
      1,
      Math.ceil(
        totalRegistros /
          ITENS_POR_PAGINA
      )
    );


  const filtrosUrl = {
    processo,
    edital:
      editalId,
    cargo,
  };


  // ==========================================================
  // INTERFACE
  // ==========================================================

  return (
    <div className="space-y-6">

      {/* ======================================================
          CABEÇALHO
      ====================================================== */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Lista de Aprovados
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Consulte e acompanhe os candidatos dos processos seletivos.
          </p>
        </div>


        {/* SUB JUDICE */}

        {podeAlterar &&
          editalSelecionado && (
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
        )}

      </div>


      {/* ======================================================
          FILTROS
      ====================================================== */}

      <FiltrosLista
        editais={
          editais
        }
        cargos={
          cargos
        }
      />


      {/* ======================================================
          AVISO EDITAL INATIVO
      ====================================================== */}

      {editalSelecionado &&
        !editalAtivo && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">

          <div className="mt-0.5 text-amber-600">
            🔒
          </div>


          <div>
            <p className="text-sm font-semibold text-amber-800">
              Edital inativo
            </p>

            <p className="mt-0.5 text-sm text-amber-700">
              A lista continua disponível para consulta, mas a alteração de status dos candidatos está bloqueada.
            </p>
          </div>

        </div>
      )}


      {/* ======================================================
          RESUMO DA TABELA
      ====================================================== */}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-700">
            {totalRegistros.toLocaleString(
              "pt-BR"
            )}
          </span>{" "}
          candidato
          {totalRegistros ===
          1
            ? ""
            : "s"}
        </p>


        {totalPaginas >
          1 && (
          <p className="text-xs text-slate-500">
            Página{" "}
            {paginaAtual} de{" "}
            {totalPaginas}
          </p>
        )}

      </div>


      {/* ======================================================
          TABELA
      ====================================================== */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1180px] text-sm">

            {/* =================================================
                CABEÇALHO
            ================================================= */}

            <thead className="border-b border-slate-200 bg-slate-50">

              <tr>

                <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cód. vaga
                </th>


                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cargo
                </th>


                <th className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Classificação
                </th>


                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nome
                </th>


                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Modalidade
                </th>


                <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nota
                </th>


                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>


                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ações
                </th>

              </tr>

            </thead>


            {/* =================================================
                CORPO
            ================================================= */}

            <tbody className="divide-y divide-slate-100">

              {candidatos.length ===
              0 ? (

                <tr>
                  <td
                    colSpan={
                      8
                    }
                    className="px-6 py-12 text-center"
                  >
                    <div className="mx-auto max-w-sm">

                      <p className="font-medium text-slate-700">
                        Nenhum candidato encontrado
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Altere os filtros para consultar outros registros.
                      </p>

                    </div>
                  </td>
                </tr>

              ) : (

                candidatos.map(
                  (
                    candidato
                  ) => (

                    <tr
                      key={
                        candidato.id
                      }
                      className="transition hover:bg-slate-50/70"
                    >

                      {/* =======================================
                          CÓDIGO DA VAGA
                      ======================================= */}

                      <td className="whitespace-nowrap px-3 py-2.5 align-middle">

                        <span className="font-mono text-xs font-medium text-slate-600">
                          {
                            candidato.codigo_vaga ||
                            "—"
                          }
                        </span>

                      </td>


                      {/* =======================================
                          CARGO
                      ======================================= */}

                      <td className="px-3 py-2.5 align-middle">

                        <span className="text-sm font-medium text-slate-700">
                          {
                            candidato.cargo ||
                            "—"
                          }
                        </span>

                      </td>


                      {/* =======================================
                          CLASSIFICAÇÃO
                      ======================================= */}

                      <td className="whitespace-nowrap px-3 py-2.5 text-center align-middle">

                        {candidato.sub_judice ? (

                          <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-700">
                            Sub judice
                          </span>

                        ) : (

                          <span className="font-medium text-slate-700">
                            {
                              candidato.classificacao ??
                              "—"
                            }
                          </span>

                        )}

                      </td>


                      {/* =======================================
                          NOME
                      ======================================= */}

                      <td className="px-3 py-2.5 align-middle">

                        <div className="min-w-[180px]">

                          <p className="font-medium text-slate-800">
                            {
                              candidato.nome
                            }
                          </p>

                        </div>

                      </td>


                      {/* =======================================
                          MODALIDADE
                      ======================================= */}

                      <td className="px-3 py-2.5 align-middle">

                        <span className="text-xs text-slate-600">
                          {
                            candidato.modalidade_candidatura ||
                            "—"
                          }
                        </span>

                      </td>


                      {/* =======================================
                          NOTA
                      ======================================= */}

                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle">

                        <span className="font-medium text-slate-700">
                          {
                            formatarNota(
                              candidato.nota
                            )
                          }
                        </span>

                      </td>


                      {/* =======================================
                          STATUS
                      ======================================= */}

                      <td className="px-3 py-2.5 align-middle">

                        <span
                          className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold ${obterClasseStatus(
                            candidato.status
                          )}`}
                        >
                          {
                            candidato.status
                          }
                        </span>

                      </td>


                      {/* =======================================
                          AÇÕES
                      ======================================= */}

                      <td className="px-3 py-2.5 text-right align-middle">

                        {podeAlterar ? (

                          <div className="flex items-center justify-end gap-2">

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

                          </div>

                        ) : (

                          <span className="text-xs text-slate-400">
                            —
                          </span>

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


      {/* ======================================================
          PAGINAÇÃO
      ====================================================== */}

      {totalPaginas >
        1 && (

        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">

          <p className="text-xs text-slate-500">
            Exibindo{" "}
            {(
              inicio +
              1
            ).toLocaleString(
              "pt-BR"
            )} a{" "}
            {Math.min(
              inicio +
                ITENS_POR_PAGINA,
              totalRegistros
            ).toLocaleString(
              "pt-BR"
            )}{" "}
            de{" "}
            {totalRegistros.toLocaleString(
              "pt-BR"
            )}
          </p>


          <div className="flex items-center gap-2">

            {/* ANTERIOR */}

            {paginaAtual >
            1 ? (

              <Link
                href={construirUrlPagina(
                  paginaAtual -
                    1,
                  filtrosUrl
                )}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                ← Anterior
              </Link>

            ) : (

              <span className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-300">
                ← Anterior
              </span>

            )}


            {/* PÁGINA */}

            <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
              {paginaAtual} /{" "}
              {totalPaginas}
            </span>


            {/* PRÓXIMA */}

            {paginaAtual <
            totalPaginas ? (

              <Link
                href={construirUrlPagina(
                  paginaAtual +
                    1,
                  filtrosUrl
                )}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Próxima →
              </Link>

            ) : (

              <span className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-300">
                Próxima →
              </span>

            )}

          </div>

        </div>

      )}

    </div>
  );
}
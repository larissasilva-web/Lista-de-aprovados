import Link from "next/link";

import { AlterarStatusModal } from "@/components/lista/alterar-status-modal";
import { FiltrosLista } from "@/components/lista/filtros-lista";
import { obterUsuarioAtual } from "@/lib/auth/usuario-atual";
import { createClient } from "@/lib/supabase/server";

type ListaPageProps = {
  searchParams: Promise<{
    processo?: string;
    edital?: string;
    cargo?: string;
    pagina?: string;
    erro?: string;
  }>;
};

const ITENS_POR_PAGINA = 50;

function classeStatus(status: string) {
  switch (status) {
    case "Contratado":
      return "bg-emerald-50 text-emerald-700";

    case "Convocado":
      return "bg-blue-50 text-blue-700";

    case "Desistente":
      return "bg-red-50 text-red-700";

    case "Documentação Rejeitada":
      return "bg-purple-50 text-purple-700";

    case "Aprovado":
    default:
      return "bg-amber-50 text-amber-700";
  }
}

export default async function ListaPage({
  searchParams,
}: ListaPageProps) {
  const params = await searchParams;

  const usuario = await obterUsuarioAtual();
  const supabase = await createClient();

  const processoSelecionado =
    params.processo?.trim() ?? "";

  const editalSelecionado =
    params.edital?.trim() ?? "";

  const cargoSelecionado =
    params.cargo?.trim() ?? "";

  const paginaInformada = Number(params.pagina ?? "1");

  const paginaAtual =
    Number.isInteger(paginaInformada) &&
    paginaInformada > 0
      ? paginaInformada
      : 1;

  const podeAlterarStatus =
    usuario.tipoPermissao === "contratador" ||
    usuario.tipoPermissao === "admin";

  // =========================================================
  // EDITAIS ATIVOS
  // =========================================================

  const {
    data: editaisData,
    error: editaisError,
  } = await supabase
    .from("editais")
    .select(`
      id,
      processo_seletivo,
      edital
    `)
    .eq("status_edital", true)
    .order("processo_seletivo")
    .order("edital");

  if (editaisError) {
    throw new Error(
      `Erro ao carregar editais: ${editaisError.message}`
    );
  }

  const editais = editaisData ?? [];

  // =========================================================
  // PROCESSOS SELETIVOS
  // =========================================================

  const processos = Array.from(
    new Set(
      editais.map(
        (item) => item.processo_seletivo
      )
    )
  );

  // =========================================================
  // CARGOS DO EDITAL SELECIONADO
  // =========================================================

  let cargos: string[] = [];

  if (editalSelecionado) {
    const {
      data: cargosData,
      error: cargosError,
    } = await supabase.rpc(
      "listar_cargos_edital",
      {
        p_edital_id: editalSelecionado,
      }
    );

    if (cargosError) {
      throw new Error(
        `Erro ao carregar cargos: ${cargosError.message}`
      );
    }

    cargos =
      cargosData?.map(
        (item: { cargo: string }) => item.cargo
      ) ?? [];
  }

  // =========================================================
  // LISTA DOS CANDIDATOS
  // =========================================================

  let aprovados: {
    id: string;
    cargo: string;
    classificacao: number;
    nome: string;
    status: string;
    processo_sei: string | null;
    matricula: string | null;
  }[] = [];

  let totalRegistros = 0;

  if (editalSelecionado) {
    const inicio =
      (paginaAtual - 1) * ITENS_POR_PAGINA;

    const fim =
      inicio + ITENS_POR_PAGINA - 1;

    let consulta = supabase
      .from("lista_aprovados")
      .select(
        `
          id,
          cargo,
          classificacao,
          nome,
          status,
          processo_sei,
          matricula
        `,
        {
          count: "exact",
        }
      )
      .eq("edital_id", editalSelecionado);

    if (cargoSelecionado) {
      consulta = consulta.eq(
        "cargo",
        cargoSelecionado
      );
    }

    const {
      data,
      error,
      count,
    } = await consulta
      .order("cargo")
      .order("classificacao")
      .range(inicio, fim);

    if (error) {
      throw new Error(
        `Erro ao carregar candidatos: ${error.message}`
      );
    }

    aprovados = data ?? [];
    totalRegistros = count ?? 0;
  }

  const totalPaginas = Math.max(
    1,
    Math.ceil(
      totalRegistros / ITENS_POR_PAGINA
    )
  );

  function montarUrlPagina(
    pagina: number
  ) {
    const query = new URLSearchParams();

    if (processoSelecionado) {
      query.set(
        "processo",
        processoSelecionado
      );
    }

    if (editalSelecionado) {
      query.set(
        "edital",
        editalSelecionado
      );
    }

    if (cargoSelecionado) {
      query.set(
        "cargo",
        cargoSelecionado
      );
    }

    query.set("pagina", String(pagina));

    return `/lista?${query.toString()}`;
  }

  return (
    <section>
      {params.erro === "sem-permissao" && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Você não possui permissão para acessar essa área.
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">
          Lista de Aprovados
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Consulte e acompanhe os candidatos dos
          processos seletivos.
        </p>
      </div>

      <FiltrosLista
        processos={processos}
        editais={editais}
        cargos={cargos}
        processoSelecionado={
          processoSelecionado
        }
        editalSelecionado={
          editalSelecionado
        }
        cargoSelecionado={
          cargoSelecionado
        }
      />

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {!editalSelecionado ? (
          <div className="px-6 py-16 text-center">
            <p className="font-medium text-slate-700">
              Selecione um processo seletivo e um edital
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Os candidatos serão exibidos aqui.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Candidatos
                </p>

                <p className="mt-0.5 text-xs text-slate-500">
                  {totalRegistros} registro
                  {totalRegistros === 1
                    ? ""
                    : "s"} encontrado
                  {totalRegistros === 1
                    ? ""
                    : "s"}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Cargo
                    </th>

                    <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Classificação
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Nome
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {aprovados.map(
                    (aprovado) => (
                      <tr
                        key={aprovado.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 text-sm text-slate-700">
                          {aprovado.cargo}
                        </td>

                        <td className="px-5 py-4 text-center text-sm font-medium text-slate-900">
                          {
                            aprovado.classificacao
                          }
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-slate-900">
                          {aprovado.nome}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classeStatus(
                              aprovado.status
                            )}`}
                          >
                            {aprovado.status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          {podeAlterarStatus ? (
  <AlterarStatusModal
    candidato={{
      id: aprovado.id,
      nome: aprovado.nome,
      status: aprovado.status,
      processo_sei:
        aprovado.processo_sei,
      matricula:
        aprovado.matricula,
    }}
  />
) : (
  <span className="text-xs text-slate-400">
    Somente leitura
  </span>
)}
                          
                        </td>
                      </tr>
                    )
                  )}

                  {aprovados.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-16 text-center text-sm text-slate-500"
                      >
                        Nenhum candidato encontrado
                        para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalRegistros > 0 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
                <p className="text-sm text-slate-500">
                  Página {paginaAtual} de{" "}
                  {totalPaginas}
                </p>

                <div className="flex gap-2">
                  {paginaAtual > 1 ? (
                    <Link
                      href={montarUrlPagina(
                        paginaAtual - 1
                      )}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Anterior
                    </Link>
                  ) : (
                    <span className="cursor-not-allowed rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-300">
                      Anterior
                    </span>
                  )}

                  {paginaAtual <
                  totalPaginas ? (
                    <Link
                      href={montarUrlPagina(
                        paginaAtual + 1
                      )}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Próxima
                    </Link>
                  ) : (
                    <span className="cursor-not-allowed rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-300">
                      Próxima
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
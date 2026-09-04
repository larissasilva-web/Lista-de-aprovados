"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Edital = {
  id: string;
  processo_seletivo: string;
  edital: string;
  status_edital: boolean;
  data_inicio: string;
  data_fim: string;
  prazo_validade: string;
  prorrogavel: boolean;
  created_at: string;
};

type GerenciamentoEditaisProps = {
  editais: Edital[];
  admin: boolean;
};

export function GerenciamentoEditais({
  editais,
  admin,
}: GerenciamentoEditaisProps) {
  const router = useRouter();

  const [processandoId, setProcessandoId] =
    useState<string | null>(null);

  const [erro, setErro] = useState("");

  async function alterarStatus(
    edital: Edital
  ) {
    setErro("");
    setProcessandoId(edital.id);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("editais")
        .update({
          status_edital:
            !edital.status_edital,
        })
        .eq("id", edital.id)
        .select("id");

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error(
          "O edital não foi atualizado. Verifique sua permissão."
        );
      }

      router.refresh();
    } catch (error) {
      console.error(error);

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o status do edital."
      );
    } finally {
      setProcessandoId(null);
    }
  }

  async function excluirEdital(
    edital: Edital
  ) {
    if (!admin) {
      return;
    }

    const confirmou = window.confirm(
      `Tem certeza que deseja excluir o edital "${edital.edital}"?\n\n` +
        "ATENÇÃO: todos os candidatos vinculados a esse edital também serão excluídos.\n\n" +
        "Essa ação não pode ser desfeita."
    );

    if (!confirmou) {
      return;
    }

    setErro("");
    setProcessandoId(edital.id);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("editais")
        .delete()
        .eq("id", edital.id)
        .select("id");

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error(
          "O edital não foi excluído. Verifique sua permissão."
        );
      }

      router.refresh();
    } catch (error) {
      console.error(error);

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o edital."
      );
    } finally {
      setProcessandoId(null);
    }
  }

  function formatarData(
    data: string
  ) {
    if (!data) {
      return "-";
    }

    const [ano, mes, dia] =
      data.split("-");

    if (!ano || !mes || !dia) {
      return data;
    }

    return `${dia}/${mes}/${ano}`;
  }

  return (
    <div>
      {erro && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-medium text-slate-900">
            Editais cadastrados
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {editais.length} edital
            {editais.length === 1
              ? ""
              : "is"}{" "}
            cadastrado
            {editais.length === 1
              ? ""
              : "s"}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Processo Seletivo
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Edital
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Início
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fim
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Validade
                </th>

                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Prorrogável
                </th>

                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>

                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {editais.map((edital) => {
                const processando =
                  processandoId ===
                  edital.id;

                return (
                  <tr
                    key={edital.id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {
                        edital.processo_seletivo
                      }
                    </td>

                    <td className="px-5 py-4 text-sm font-medium text-slate-900">
                      {edital.edital}
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
                      {
                        edital.prazo_validade
                      }
                    </td>

                    <td className="px-5 py-4 text-center text-sm text-slate-600">
                      {edital.prorrogavel
                        ? "Sim"
                        : "Não"}
                    </td>

                    <td className="px-5 py-4 text-center">
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
                            alterarStatus(
                              edital
                            )
                          }
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {processando
                            ? "Processando..."
                            : edital.status_edital
                              ? "Inativar"
                              : "Ativar"}
                        </button>

                        {admin && (
                          <button
                            type="button"
                            disabled={
                              processando
                            }
                            onClick={() =>
                              excluirEdital(
                                edital
                              )
                            }
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {editais.length ===
                0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-16 text-center text-sm text-slate-500"
                  >
                    Nenhum edital
                    cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
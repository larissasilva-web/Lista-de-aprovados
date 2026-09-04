"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Candidato = {
  id: string;
  nome: string;
  status: string;
  processo_sei: string | null;
  matricula: string | null;
};

type AlterarStatusModalProps = {
  candidato: Candidato;
};

const STATUS_DISPONIVEIS = [
  "Aprovado",
  "Convocado",
  "Contratado",
  "Desistente",
  "Documentação Rejeitada",
] as const;

export function AlterarStatusModal({
  candidato,
}: AlterarStatusModalProps) {
  const router = useRouter();

  const [aberto, setAberto] = useState(false);

  const [status, setStatus] = useState(
    candidato.status
  );

  const [processoSei, setProcessoSei] =
    useState(candidato.processo_sei ?? "");

  const [matricula, setMatricula] =
    useState(candidato.matricula ?? "");

  const [erro, setErro] = useState("");
  const [salvando, setSalvando] =
    useState(false);

  function fecharModal() {
    if (salvando) {
      return;
    }

    setAberto(false);
    setErro("");

    setStatus(candidato.status);
    setProcessoSei(
      candidato.processo_sei ?? ""
    );
    setMatricula(
      candidato.matricula ?? ""
    );
  }

  async function salvarAlteracao(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErro("");

    if (
      status === "Contratado" &&
      !matricula.trim()
    ) {
      setErro(
        "A matrícula é obrigatória quando o status for Contratado."
      );

      return;
    }

    try {
      setSalvando(true);

      const supabase = createClient();

      const { data, error } = await supabase
        .from("lista_aprovados")
        .update({
          status,
          processo_sei:
            processoSei.trim() || null,
          matricula:
            matricula.trim() || null,
        })
        .eq("id", candidato.id)
        .select("id");

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error(
          "A alteração não foi realizada. Verifique sua permissão."
        );
      }

      setAberto(false);

      router.refresh();
    } catch (error) {
      console.error(error);

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o candidato."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded-lg border border-[#094780] px-3 py-2 text-xs font-medium text-[#094780] transition hover:bg-[#094780] hover:text-white"
      >
        Alterar status
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Alterar status
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {candidato.nome}
                </p>
              </div>

              <button
                type="button"
                onClick={fecharModal}
                disabled={salvando}
                className="text-2xl leading-none text-slate-400 hover:text-slate-700"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={salvarAlteracao}
              className="p-6"
            >
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor={`status-${candidato.id}`}
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Status Atualizado
                  </label>

                  <select
                    id={`status-${candidato.id}`}
                    value={status}
                    onChange={(event) =>
                      setStatus(
                        event.target.value
                      )
                    }
                    disabled={salvando}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#094780]"
                  >
                    {STATUS_DISPONIVEIS.map(
                      (item) => (
                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`processo-sei-${candidato.id}`}
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Processo SEI
                  </label>

                  <input
                    id={`processo-sei-${candidato.id}`}
                    type="text"
                    value={processoSei}
                    onChange={(event) =>
                      setProcessoSei(
                        event.target.value
                      )
                    }
                    disabled={salvando}
                    placeholder="Ex.: 25000.123456/2026-00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#094780]"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`matricula-${candidato.id}`}
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Matrícula
                    {status ===
                      "Contratado" && (
                      <span className="ml-1 text-red-600">
                        *
                      </span>
                    )}
                  </label>

                  <input
                    id={`matricula-${candidato.id}`}
                    type="text"
                    value={matricula}
                    onChange={(event) =>
                      setMatricula(
                        event.target.value
                      )
                    }
                    required={
                      status === "Contratado"
                    }
                    disabled={salvando}
                    placeholder="Informe a matrícula"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#094780]"
                  />

                  {status ===
                    "Contratado" && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      Obrigatório para candidatos
                      contratados.
                    </p>
                  )}
                </div>

                {erro && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {erro}
                  </div>
                )}
              </div>

              <div className="mt-7 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={fecharModal}
                  disabled={salvando}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-lg bg-[#094780] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvando
                    ? "Salvando..."
                    : "Salvar alteração"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
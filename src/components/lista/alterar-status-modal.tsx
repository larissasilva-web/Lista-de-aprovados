"use client";

import {
  FormEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";

type Props = {
  candidatoId: string;

  nome: string;

  statusAtual: string;

  processoSeiAtual:
    string | null;

  matriculaAtual:
    string | null;

  dataContratacaoAtual:
    string | null;

  editalAtivo: boolean;
};

const STATUS = [
  "Aprovado",
  "Convocado",
  "Contratado",
  "Desistente",
  "Documentação Rejeitada",
  "Migração",
];

export function AlterarStatusModal({
  candidatoId,
  nome,
  statusAtual,
  processoSeiAtual,
  matriculaAtual,
  dataContratacaoAtual,
  editalAtivo,
}: Props) {
  const router =
    useRouter();

  const [
    aberto,
    setAberto,
  ] = useState(false);

  const [
    status,
    setStatus,
  ] = useState(
    statusAtual
  );

  const [
    processoSei,
    setProcessoSei,
  ] = useState(
    processoSeiAtual ??
      ""
  );

  const [
    matricula,
    setMatricula,
  ] = useState(
    matriculaAtual ??
      ""
  );

  const [
    dataContratacao,
    setDataContratacao,
  ] = useState(
    dataContratacaoAtual ??
      ""
  );

  const [
    salvando,
    setSalvando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  async function salvar(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErro("");

    if (!editalAtivo) {
      setErro(
        "O edital está inativo. Não é possível alterar o status."
      );

      return;
    }

    if (
      status ===
        "Contratado" &&
      !matricula.trim()
    ) {
      setErro(
        "A matrícula é obrigatória para candidatos contratados."
      );

      return;
    }

    if (
      status ===
        "Contratado" &&
      !dataContratacao
    ) {
      setErro(
        "A data de contratação é obrigatória para candidatos contratados."
      );

      return;
    }

    setSalvando(true);

    try {
      const supabase =
        createClient();

      const {
        error,
      } = await supabase
        .from(
          "lista_aprovados"
        )
        .update({
          status,

          processo_sei:
            processoSei.trim() ||
            null,

          matricula:
            matricula.trim() ||
            null,

          data_contratacao:
            status ===
            "Contratado"
              ? dataContratacao
              : null,
        })
        .eq(
          "id",
          candidatoId
        );

      if (error) {
        throw error;
      }

      setAberto(false);

      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o candidato."
      );
    } finally {
      setSalvando(
        false
      );
    }
  }

  if (!editalAtivo) {
    return (
      <button
        type="button"
        disabled
        title="O edital está inativo."
        className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-[11px] font-medium text-slate-400"
      >
        🔒 Alterar status
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErro("");

          setStatus(
            statusAtual
          );

          setProcessoSei(
            processoSeiAtual ??
              ""
          );

          setMatricula(
            matriculaAtual ??
              ""
          );

          setDataContratacao(
            dataContratacaoAtual ??
              ""
          );

          setAberto(true);
        }}
        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
                  {nome}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  salvando
                }
                onClick={() =>
                  setAberto(
                    false
                  )
                }
                className="text-2xl leading-none text-slate-400"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                salvar
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
                    Status
                  </label>

                  <select
                    value={
                      status
                    }
                    onChange={(
                      event
                    ) =>
                      setStatus(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      salvando
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                  >
                    {STATUS.map(
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
                    Processo SEI
                  </label>

                  <input
                    value={
                      processoSei
                    }
                    onChange={(
                      event
                    ) =>
                      setProcessoSei(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      salvando
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Matrícula
                    {status ===
                      "Contratado" &&
                      " *"}
                  </label>

                  <input
                    value={
                      matricula
                    }
                    onChange={(
                      event
                    ) =>
                      setMatricula(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      salvando
                    }
                    required={
                      status ===
                      "Contratado"
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />

                  {status ===
                    "Contratado" && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      A matrícula é obrigatória quando o status for Contratado.
                    </p>
                  )}
                </div>

                {status ===
                  "Contratado" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Data de contratação *
                    </label>

                    <input
                      type="date"
                      value={
                        dataContratacao
                      }
                      onChange={(
                        event
                      ) =>
                        setDataContratacao(
                          event
                            .target
                            .value
                        )
                      }
                      disabled={
                        salvando
                      }
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                    />

                    <p className="mt-1.5 text-xs text-slate-500">
                      Informe a data efetiva de contratação do candidato para este cargo.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-7 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={
                    salvando
                  }
                  onClick={() =>
                    setAberto(
                      false
                    )
                  }
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    salvando
                  }
                  className="rounded-lg bg-[#094780] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
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
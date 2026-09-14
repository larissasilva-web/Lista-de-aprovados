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

import {
  obterUnidadeCanonica,
  UNIDADES_SAUDE_INDIGENA,
  unidadeSaudeIndigenaValida,
} from "@/lib/editais/unidades";

const PROCESSOS_SELETIVOS = [
  "Saúde Indígena",
  "Sede",
  "CCE",
  "Saúde nas Fronteiras",
  "Escritórios Regionais/Distritais",
  "MFC",
  "Projeto Agora Tem Especialistas Caminhoneiros",
];

function formatarPrazoValidade(
  anos: number,
  meses: number
) {
  const partes: string[] = [];

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

  return partes.join(" e ");
}

export function NovoEditalModal() {
  const router = useRouter();

  const [
    aberto,
    setAberto,
  ] = useState(false);

  const [
    processoSeletivo,
    setProcessoSeletivo,
  ] = useState("");

  const [
    edital,
    setEdital,
  ] = useState("");

  const [
    unidade,
    setUnidade,
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
    salvando,
    setSalvando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    sucesso,
    setSucesso,
  ] = useState("");

  function limparFormulario() {
    setProcessoSeletivo("");
    setEdital("");
    setUnidade("");
    setDataInicio("");
    setDataFim("");
    setPrazoAnos(0);
    setPrazoMeses(0);
    setProrrogavel(false);
    setErro("");
  }

  function fechar() {
    if (salvando) {
      return;
    }

    setAberto(false);
    setSucesso("");
    limparFormulario();
  }

  async function cadastrar(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErro("");
    setSucesso("");

    if (!processoSeletivo) {
      setErro(
        "Selecione o processo seletivo."
      );
      return;
    }

    if (!edital.trim()) {
      setErro(
        "Informe o edital."
      );
      return;
    }

    if (!unidade.trim()) {
      setErro(
        "Informe a unidade."
      );
      return;
    }

    if (
      processoSeletivo ===
        "Saúde Indígena" &&
      !unidadeSaudeIndigenaValida(
        unidade
      )
    ) {
      setErro(
        "Selecione uma unidade válida da Saúde Indígena."
      );
      return;
    }

    if (!dataInicio || !dataFim) {
      setErro(
        "Informe a data de início e a data final do edital."
      );
      return;
    }

    if (dataFim < dataInicio) {
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

    const unidadeFinal =
      processoSeletivo ===
      "Saúde Indígena"
        ? obterUnidadeCanonica(
            unidade
          )
        : unidade.trim();

    setSalvando(true);

    try {
      const supabase =
        createClient();

      const {
        data,
        error,
      } = await supabase.rpc(
        "cadastrar_edital",
        {
          p_processo_seletivo:
            processoSeletivo,

          p_edital:
            edital.trim(),

          p_unidade:
            unidadeFinal,

          p_data_inicio:
            dataInicio,

          p_data_fim:
            dataFim,

          p_prazo_validade:
            formatarPrazoValidade(
              prazoAnos,
              prazoMeses
            ),

          p_prorrogavel:
            prorrogavel,
        }
      );

      if (error) {
        throw new Error(
          error.message
        );
      }

      if (!data) {
        throw new Error(
          "O edital foi processado, mas o identificador não foi retornado."
        );
      }

      setSucesso(
        `Edital ${edital.trim()} cadastrado com sucesso.`
      );

      router.refresh();

      setTimeout(() => {
        setAberto(false);
        setSucesso("");
        limparFormulario();
      }, 1000);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o edital."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErro("");
          setSucesso("");
          setAberto(true);
        }}
        className="rounded-lg bg-[#094780] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
      >
        + Novo edital
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Novo edital
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Cadastre o edital antes da publicação da lista final de aprovados.
                </p>
              </div>

              <button
                type="button"
                onClick={fechar}
                disabled={salvando}
                className="text-2xl leading-none text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={cadastrar}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                {erro && (
                  <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {erro}
                  </div>
                )}

                {sucesso && (
                  <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {sucesso}
                  </div>
                )}

                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Processo seletivo *
                    </label>

                    <select
                      required
                      value={processoSeletivo}
                      onChange={(event) => {
                        setProcessoSeletivo(
                          event.target.value
                        );
                        setUnidade("");
                      }}
                      disabled={salvando}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                    >
                      <option value="">
                        Selecione
                      </option>

                      {PROCESSOS_SELETIVOS.map(
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

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Edital *
                      </label>

                      <input
                        required
                        value={edital}
                        onChange={(event) =>
                          setEdital(
                            event.target.value
                          )
                        }
                        disabled={salvando}
                        placeholder="Ex.: 06/2026"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Unidade *
                      </label>

                      <input
                        required
                        list={
                          processoSeletivo ===
                          "Saúde Indígena"
                            ? "unidades-saude-indigena-novo-edital"
                            : undefined
                        }
                        value={unidade}
                        onChange={(event) =>
                          setUnidade(
                            event.target.value
                          )
                        }
                        disabled={salvando}
                        placeholder={
                          processoSeletivo ===
                          "Saúde Indígena"
                            ? "Ex.: DSEI Médio Rio Purus"
                            : "Informe a unidade"
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                      />

                      {processoSeletivo ===
                        "Saúde Indígena" && (
                        <datalist id="unidades-saude-indigena-novo-edital">
                          {UNIDADES_SAUDE_INDIGENA.map(
                            (item) => (
                              <option
                                key={item}
                                value={item}
                              />
                            )
                          )}
                        </datalist>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Data de início *
                      </label>

                      <input
                        required
                        type="date"
                        value={dataInicio}
                        onChange={(event) =>
                          setDataInicio(
                            event.target.value
                          )
                        }
                        disabled={salvando}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Data final *
                      </label>

                      <input
                        required
                        type="date"
                        value={dataFim}
                        onChange={(event) =>
                          setDataFim(
                            event.target.value
                          )
                        }
                        disabled={salvando}
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
                          value={prazoAnos}
                          onChange={(event) =>
                            setPrazoAnos(
                              Number(
                                event.target.value
                              )
                            )
                          }
                          disabled={salvando}
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
                          value={prazoMeses}
                          onChange={(event) =>
                            setPrazoMeses(
                              Number(
                                event.target.value
                              )
                            )
                          }
                          disabled={salvando}
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
                      onChange={(event) =>
                        setProrrogavel(
                          event.target.value ===
                          "sim"
                        )
                      }
                      disabled={salvando}
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
                    A lista de aprovados não é necessária neste momento. Ela poderá ser integrada posteriormente ao edital.
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={fechar}
                  disabled={salvando}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-lg bg-[#094780] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {salvando
                    ? "Salvando..."
                    : "Cadastrar edital"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

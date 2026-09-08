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
  editalId: string;
  editalNome: string;
  cargos: string[];
};

export function AdicionarSubJudiceModal({
  editalId,
  editalNome,
  cargos,
}: Props) {
  const router =
    useRouter();

  const [
    aberto,
    setAberto,
  ] = useState(false);

  const [
    cargo,
    setCargo,
  ] = useState("");

  const [
    nome,
    setNome,
  ] = useState("");

  const [
    modalidade,
    setModalidade,
  ] = useState("");

  const [
    nota,
    setNota,
  ] = useState("");

  const [
    salvando,
    setSalvando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  function limpar() {
    setCargo("");
    setNome("");
    setModalidade("");
    setNota("");
    setErro("");
  }

  function fechar() {
    if (salvando) {
      return;
    }

    setAberto(false);
    limpar();
  }

  async function salvar(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErro("");

    if (!cargo) {
      setErro(
        "Selecione o cargo."
      );
      return;
    }

    if (!nome.trim()) {
      setErro(
        "Informe o nome do candidato."
      );
      return;
    }

    if (
      !modalidade.trim()
    ) {
      setErro(
        "Informe a modalidade de candidatura."
      );
      return;
    }

    const notaNumerica =
      Number(
        nota.replace(
          ",",
          "."
        )
      );

    if (
      !Number.isFinite(
        notaNumerica
      ) ||
      notaNumerica < 0
    ) {
      setErro(
        "Informe uma nota válida."
      );
      return;
    }

    setSalvando(true);

    try {
      const supabase =
        createClient();

      const {
        error,
      } =
        await supabase.rpc(
          "adicionar_sub_judice",
          {
            p_edital_id:
              editalId,

            p_cargo:
              cargo,

            p_nome:
              nome.trim(),

            p_modalidade_candidatura:
              modalidade.trim(),

            p_nota:
              notaNumerica,
          }
        );

      if (error) {
        throw error;
      }

      setAberto(
        false
      );

      limpar();

      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar o candidato."
      );
    } finally {
      setSalvando(
        false
      );
    }
  }

  return (
  <>
    <button
      type="button"
      onClick={() =>
        setAberto(true)
      }
      className="rounded-lg bg-[#094780] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
    >
      + Sub judice
    </button>


    {aberto && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

        <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">

          {/* CABEÇALHO FIXO */}

          <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">

            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Adicionar Sub judice
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {editalNome}
              </p>
            </div>


            <button
              type="button"
              onClick={
                fechar
              }
              disabled={
                salvando
              }
              className="text-2xl leading-none text-slate-400 hover:text-slate-700"
            >
              ×
            </button>

          </div>


          {/* FORM */}

          <form
            onSubmit={
              salvar
            }
            className="flex min-h-0 flex-1 flex-col"
          >

            {/* ÁREA COM SCROLL */}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">

              {erro && (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {erro}
                </div>
              )}


              <div className="space-y-4">

                {/* CARGO */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Cargo *
                  </label>

                  <select
                    required
                    value={
                      cargo
                    }
                    onChange={(
                      event
                    ) =>
                      setCargo(
                        event.target.value
                      )
                    }
                    disabled={
                      salvando
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                  >
                    <option value="">
                      Selecione
                    </option>

                    {cargos.map(
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


                {/* NOME */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Nome *
                  </label>

                  <input
                    required
                    value={
                      nome
                    }
                    onChange={(
                      event
                    ) =>
                      setNome(
                        event.target.value
                      )
                    }
                    disabled={
                      salvando
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </div>


                {/* CLASSIFICAÇÃO */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Classificação
                  </label>

                  <input
                    value="Sub judice"
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-600"
                  />
                </div>


                {/* MODALIDADE */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Modalidade de candidatura *
                  </label>

                  <input
                    required
                    value={
                      modalidade
                    }
                    onChange={(
                      event
                    ) =>
                      setModalidade(
                        event.target.value
                      )
                    }
                    disabled={
                      salvando
                    }
                    placeholder="Ex.: Ampla concorrência"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </div>


                {/* NOTA */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Nota *
                  </label>

                  <input
                    required
                    type="text"
                    inputMode="decimal"
                    value={
                      nota
                    }
                    onChange={(
                      event
                    ) =>
                      setNota(
                        event.target.value
                      )
                    }
                    disabled={
                      salvando
                    }
                    placeholder="Ex.: 87,50"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </div>

              </div>
            </div>


            {/* RODAPÉ FIXO */}

            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">

              <button
                type="button"
                onClick={
                  fechar
                }
                disabled={
                  salvando
                }
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
              >
                Cancelar
              </button>


              <button
                type="submit"
                disabled={
                  salvando
                }
                className="rounded-lg bg-[#094780] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {salvando
                  ? "Adicionando..."
                  : "Adicionar Sub judice"}
              </button>

            </div>

          </form>
        </div>
      </div>
    )}
  </>
);
}
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";


type Edital = {
  id: string;
  processo_seletivo: string;
  edital: string;
  status_edital: boolean;
};


type Props = {
  editais: Edital[];
  cargos: string[];
};


export function FiltrosLista({
  editais,
  cargos,
}: Props) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const searchParams =
    useSearchParams();


  const processoAtual =
    searchParams.get(
      "processo"
    ) ?? "";

  const editalAtual =
    searchParams.get(
      "edital"
    ) ?? "";

  const cargoAtual =
    searchParams.get(
      "cargo"
    ) ?? "";


  const [
    buscaEdital,
    setBuscaEdital,
  ] = useState("");

  const [
    buscaCargo,
    setBuscaCargo,
  ] = useState("");

  const [
    mostrarEditais,
    setMostrarEditais,
  ] = useState(false);

  const [
    mostrarCargos,
    setMostrarCargos,
  ] = useState(false);


  // ==========================================================
  // PROCESSOS SELETIVOS
  // ==========================================================

  const processos =
    useMemo(
      () =>
        Array.from(
          new Set(
            editais
              .map(
                (item) =>
                  item.processo_seletivo
              )
              .filter(Boolean)
          )
        ).sort(
          (a, b) =>
            a.localeCompare(
              b,
              "pt-BR"
            )
        ),
      [editais]
    );


  // ==========================================================
  // EDITAL SELECIONADO
  // ==========================================================

  const editalSelecionado =
    useMemo(
      () =>
        editais.find(
          (item) =>
            item.id ===
            editalAtual
        ),
      [
        editais,
        editalAtual,
      ]
    );


  // ==========================================================
  // SINCRONIZAR CAMPOS
  // ==========================================================

  useEffect(() => {
    if (
      editalSelecionado
    ) {
      setBuscaEdital(
        editalSelecionado.edital
      );
    } else {
      setBuscaEdital("");
    }
  }, [
    editalSelecionado,
  ]);


  useEffect(() => {
    setBuscaCargo(
      cargoAtual
    );
  }, [
    cargoAtual,
  ]);


  // ==========================================================
  // EDITAIS DO PROCESSO
  // ==========================================================

  const editaisDoProcesso =
    useMemo(() => {
      if (
        !processoAtual
      ) {
        return editais;
      }

      return editais.filter(
        (item) =>
          item.processo_seletivo ===
          processoAtual
      );
    }, [
      editais,
      processoAtual,
    ]);


  // ==========================================================
  // PESQUISA DE EDITAL
  // ==========================================================

  const editaisPesquisados =
    useMemo(() => {
      const termo =
        buscaEdital
          .trim()
          .toLocaleLowerCase(
            "pt-BR"
          );

      if (!termo) {
        return editaisDoProcesso;
      }

      return editaisDoProcesso.filter(
        (item) =>
          item.edital
            .toLocaleLowerCase(
              "pt-BR"
            )
            .includes(
              termo
            )
      );
    }, [
      editaisDoProcesso,
      buscaEdital,
    ]);


  // ==========================================================
  // PESQUISA DE CARGO
  // ==========================================================

  const cargosPesquisados =
    useMemo(() => {
      const termo =
        buscaCargo
          .trim()
          .toLocaleLowerCase(
            "pt-BR"
          );

      if (!termo) {
        return cargos;
      }

      return cargos.filter(
        (cargo) =>
          cargo
            .toLocaleLowerCase(
              "pt-BR"
            )
            .includes(
              termo
            )
      );
    }, [
      cargos,
      buscaCargo,
    ]);


  // ==========================================================
  // ALTERAR URL
  // ==========================================================

  function navegar(
    alteracoes: Record<
      string,
      string | null
    >
  ) {
    const parametros =
      new URLSearchParams(
        searchParams.toString()
      );

    Object.entries(
      alteracoes
    ).forEach(
      ([chave, valor]) => {
        if (
          valor &&
          valor.trim()
        ) {
          parametros.set(
            chave,
            valor
          );
        } else {
          parametros.delete(
            chave
          );
        }
      }
    );

    parametros.delete(
      "pagina"
    );

    const query =
      parametros.toString();

    router.push(
      query
        ? `${pathname}?${query}`
        : pathname
    );
  }


  // ==========================================================
  // SELECIONAR EDITAL
  // ==========================================================

  function selecionarEdital(
    edital: Edital
  ) {
    setBuscaEdital(
      edital.edital
    );

    setBuscaCargo("");

    setMostrarEditais(
      false
    );

    navegar({
      edital:
        edital.id,

      cargo:
        null,
    });
  }


  // ==========================================================
  // SELECIONAR CARGO
  // ==========================================================

  function selecionarCargo(
    cargo: string
  ) {
    setBuscaCargo(
      cargo
    );

    setMostrarCargos(
      false
    );

    navegar({
      cargo,
    });
  }


  // ==========================================================
  // LIMPAR
  // ==========================================================

  function limpar() {
    setBuscaEdital("");
    setBuscaCargo("");

    setMostrarEditais(
      false
    );

    setMostrarCargos(
      false
    );

    router.push(
      pathname
    );
  }


  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

        {/* PROCESSO */}

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Processo seletivo
          </label>

          <select
            value={
              processoAtual
            }
            onChange={(
              event
            ) => {
              setBuscaEdital("");
              setBuscaCargo("");

              navegar({
                processo:
                  event.target
                    .value ||
                  null,

                edital:
                  null,

                cargo:
                  null,
              });
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">
              Todos
            </option>

            {processos.map(
              (processo) => (
                <option
                  key={
                    processo
                  }
                  value={
                    processo
                  }
                >
                  {processo}
                </option>
              )
            )}
          </select>
        </div>


        {/* EDITAL */}

        <div className="relative">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Edital
          </label>

          <div className="relative">

            <input
              type="text"
              value={
                buscaEdital
              }
              onFocus={() =>
                setMostrarEditais(
                  true
                )
              }
              onChange={(
                event
              ) => {
                setBuscaEdital(
                  event.target.value
                );

                setMostrarEditais(
                  true
                );
              }}
              placeholder="Pesquisar edital..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-9 text-sm"
            />

            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            >
              <circle
                cx="11"
                cy="11"
                r="7"
              />

              <path d="m20 20-3.5-3.5" />
            </svg>

          </div>


          {mostrarEditais && (
            <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">

              {editaisPesquisados.length ===
              0 ? (
                <div className="px-3 py-4 text-center text-sm text-slate-500">
                  Nenhum edital encontrado.
                </div>
              ) : (
                editaisPesquisados.map(
                  (edital) => (
                    <button
                      key={
                        edital.id
                      }
                      type="button"
                      onMouseDown={(
                        event
                      ) => {
                        event.preventDefault();

                        selecionarEdital(
                          edital
                        );
                      }}
                      className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-slate-50"
                    >
                      <span className="min-w-0 truncate">
                        {
                          edital.edital
                        }
                      </span>

                      {!edital.status_edital && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          Inativo
                        </span>
                      )}
                    </button>
                  )
                )
              )}

            </div>
          )}
        </div>


        {/* CARGO */}

        <div className="relative">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Cargo
          </label>

          <div className="relative">

            <input
              type="text"
              value={
                buscaCargo
              }
              disabled={
                !editalAtual
              }
              onFocus={() =>
                setMostrarCargos(
                  true
                )
              }
              onChange={(
                event
              ) => {
                setBuscaCargo(
                  event.target.value
                );

                setMostrarCargos(
                  true
                );
              }}
              placeholder={
                editalAtual
                  ? "Pesquisar cargo..."
                  : "Selecione um edital"
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-9 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
            />

            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            >
              <circle
                cx="11"
                cy="11"
                r="7"
              />

              <path d="m20 20-3.5-3.5" />
            </svg>

          </div>


          {mostrarCargos &&
            editalAtual && (
            <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">

              {cargosPesquisados.length ===
              0 ? (
                <div className="px-3 py-4 text-center text-sm text-slate-500">
                  Nenhum cargo encontrado.
                </div>
              ) : (
                cargosPesquisados.map(
                  (cargo) => (
                    <button
                      key={
                        cargo
                      }
                      type="button"
                      onMouseDown={(
                        event
                      ) => {
                        event.preventDefault();

                        selecionarCargo(
                          cargo
                        );
                      }}
                      className="block w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-slate-50"
                    >
                      {cargo}
                    </button>
                  )
                )
              )}

            </div>
          )}

        </div>

      </div>


      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={
            limpar
          }
          className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Limpar filtros
        </button>
      </div>

    </div>
  );
}
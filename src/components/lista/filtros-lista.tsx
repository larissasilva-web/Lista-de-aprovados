"use client";

import {
  useEffect,
  useMemo,
  useRef,
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


  // ==========================================================
  // FILTROS ATUAIS DA URL
  // ==========================================================

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


  // ==========================================================
  // CAMPOS DE PESQUISA
  // ==========================================================

  const [
    buscaEdital,
    setBuscaEdital,
  ] = useState("");

  const [
    buscaCargo,
    setBuscaCargo,
  ] = useState("");


  // ==========================================================
  // CONTROLE DOS DROPDOWNS
  // ==========================================================

  const [
    mostrarEditais,
    setMostrarEditais,
  ] = useState(false);

  const [
    mostrarCargos,
    setMostrarCargos,
  ] = useState(false);


  // ==========================================================
  // REFERÊNCIAS PARA DETECTAR CLIQUE FORA
  // ==========================================================

  const editalRef =
    useRef<HTMLDivElement>(
      null
    );

  const cargoRef =
    useRef<HTMLDivElement>(
      null
    );


  // ==========================================================
  // PROCESSOS SELETIVOS
  // ==========================================================

  const processos =
    useMemo(() => {
      return Array.from(
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
      );
    }, [editais]);


  // ==========================================================
  // EDITAL SELECIONADO
  // ==========================================================

  const editalSelecionado =
    useMemo(() => {
      return editais.find(
        (item) =>
          item.id ===
          editalAtual
      );
    }, [
      editais,
      editalAtual,
    ]);


  // ==========================================================
  // SINCRONIZAR EDITAL COM A URL
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


  // ==========================================================
  // SINCRONIZAR CARGO COM A URL
  // ==========================================================

  useEffect(() => {
    setBuscaCargo(
      cargoAtual
    );
  }, [
    cargoAtual,
  ]);


  // ==========================================================
  // FECHAR DROPDOWN AO CLICAR FORA
  // ==========================================================

  useEffect(() => {
    function clicarFora(
      event: MouseEvent
    ) {
      const alvo =
        event.target as Node;


      // ------------------------------------------------------
      // EDITAL
      // ------------------------------------------------------

      if (
        editalRef.current &&
        !editalRef.current.contains(
          alvo
        )
      ) {
        setMostrarEditais(
          false
        );

        // Se digitou alguma coisa,
        // mas não selecionou outro edital,
        // volta a mostrar o edital realmente aplicado.
        if (
          editalSelecionado
        ) {
          setBuscaEdital(
            editalSelecionado.edital
          );
        } else {
          setBuscaEdital("");
        }
      }


      // ------------------------------------------------------
      // CARGO
      // ------------------------------------------------------

      if (
        cargoRef.current &&
        !cargoRef.current.contains(
          alvo
        )
      ) {
        setMostrarCargos(
          false
        );

        // Mesma lógica para o cargo.
        setBuscaCargo(
          cargoAtual
        );
      }
    }


    function pressionarTecla(
      event: KeyboardEvent
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        setMostrarEditais(
          false
        );

        setMostrarCargos(
          false
        );


        if (
          editalSelecionado
        ) {
          setBuscaEdital(
            editalSelecionado.edital
          );
        } else {
          setBuscaEdital("");
        }


        setBuscaCargo(
          cargoAtual
        );
      }
    }


    document.addEventListener(
      "mousedown",
      clicarFora
    );

    document.addEventListener(
      "keydown",
      pressionarTecla
    );


    return () => {
      document.removeEventListener(
        "mousedown",
        clicarFora
      );

      document.removeEventListener(
        "keydown",
        pressionarTecla
      );
    };
  }, [
    editalSelecionado,
    cargoAtual,
  ]);


  // ==========================================================
  // EDITAIS DO PROCESSO SELECIONADO
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
  // PESQUISAR EDITAL
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
  // PESQUISAR CARGO
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
  // ALTERAR FILTROS NA URL
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


    // Sempre volta para página 1
    // quando um filtro muda.
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
  // PROCESSO SELETIVO
  // ==========================================================

  function alterarProcesso(
    processo: string
  ) {
    setBuscaEdital("");
    setBuscaCargo("");

    setMostrarEditais(
      false
    );

    setMostrarCargos(
      false
    );


    navegar({
      processo:
        processo || null,

      edital:
        null,

      cargo:
        null,
    });
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

    setMostrarCargos(
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
  // LIMPAR EDITAL
  // ==========================================================

  function limparEdital() {
    setBuscaEdital("");
    setBuscaCargo("");

    setMostrarEditais(
      false
    );

    setMostrarCargos(
      false
    );


    navegar({
      edital:
        null,

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
  // LIMPAR CARGO
  // ==========================================================

  function limparCargo() {
    setBuscaCargo("");

    setMostrarCargos(
      false
    );


    navegar({
      cargo:
        null,
    });
  }


  // ==========================================================
  // LIMPAR TODOS OS FILTROS
  // ==========================================================

  function limparTudo() {
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


  // ==========================================================
  // INTERFACE
  // ==========================================================

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

        {/* ====================================================
            PROCESSO SELETIVO
        ==================================================== */}

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
            ) =>
              alterarProcesso(
                event.target.value
              )
            }
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


        {/* ====================================================
            EDITAL PESQUISÁVEL
        ==================================================== */}

        <div
          ref={
            editalRef
          }
          className="relative"
        >
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Edital
          </label>


          <div className="relative">

            <input
              type="text"
              value={
                buscaEdital
              }
              onFocus={() => {
                setMostrarEditais(
                  true
                );

                setMostrarCargos(
                  false
                );
              }}
              onChange={(
                event
              ) => {
                setBuscaEdital(
                  event.target.value
                );

                setMostrarEditais(
                  true
                );

                setMostrarCargos(
                  false
                );
              }}
              placeholder="Pesquisar edital..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm"
            />


            {/* LUPA */}

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


          {/* LISTA DE EDITAIS */}

          {mostrarEditais && (
            <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">

              {/* TODOS */}

              <button
                type="button"
                onMouseDown={(
                  event
                ) => {
                  event.preventDefault();

                  limparEdital();
                }}
                className="block w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Todos os editais
              </button>


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


        {/* ====================================================
            CARGO PESQUISÁVEL
        ==================================================== */}

        <div
          ref={
            cargoRef
          }
          className="relative"
        >
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
              onFocus={() => {
                setMostrarCargos(
                  true
                );

                setMostrarEditais(
                  false
                );
              }}
              onChange={(
                event
              ) => {
                setBuscaCargo(
                  event.target.value
                );

                setMostrarCargos(
                  true
                );

                setMostrarEditais(
                  false
                );
              }}
              placeholder={
                editalAtual
                  ? "Pesquisar cargo..."
                  : "Selecione um edital"
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
            />


            {/* LUPA */}

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


          {/* LISTA DE CARGOS */}

          {mostrarCargos &&
            editalAtual && (
            <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">

              {/* TODOS */}

              <button
                type="button"
                onMouseDown={(
                  event
                ) => {
                  event.preventDefault();

                  limparCargo();
                }}
                className="block w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Todos os cargos
              </button>


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


      {/* ======================================================
          LIMPAR FILTROS
      ====================================================== */}

      <div className="mt-4 flex justify-end">

        <button
          type="button"
          onClick={
            limparTudo
          }
          className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Limpar filtros
        </button>

      </div>

    </div>
  );
}
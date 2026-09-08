"use client";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams =
    useSearchParams();

  const processoAtual =
    searchParams.get("processo") ??
    "";

  const editalAtual =
    searchParams.get("edital") ??
    "";

  const cargoAtual =
    searchParams.get("cargo") ??
    "";

  const processos = Array.from(
    new Set(
      editais
        .map(
          (item) =>
            item.processo_seletivo
        )
        .filter(Boolean)
    )
  ).sort((a, b) =>
    a.localeCompare(
      b,
      "pt-BR"
    )
  );

  const editaisFiltrados =
    processoAtual
      ? editais.filter(
          (item) =>
            item.processo_seletivo ===
            processoAtual
        )
      : editais;

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
        if (valor) {
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

  function limpar() {
    router.push(
      pathname
    );
  }

  return (
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto]">
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
          ) =>
            navegar({
              processo:
                event.target
                  .value ||
                null,

              edital:
                null,

              cargo:
                null,
            })
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

      {/* EDITAL */}

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Edital
        </label>

        <select
          value={
            editalAtual
          }
          onChange={(
            event
          ) =>
            navegar({
              edital:
                event.target
                  .value ||
                null,

              cargo:
                null,
            })
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
        >
          <option value="">
            Todos
          </option>

          {editaisFiltrados.map(
            (edital) => (
              <option
                key={
                  edital.id
                }
                value={
                  edital.id
                }
              >
                {edital.edital}
                {edital.status_edital
                  ? ""
                  : " — Inativo"}
              </option>
            )
          )}
        </select>
      </div>

      {/* CARGO */}

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cargo
        </label>

        <select
          value={
            cargoAtual
          }
          disabled={
            !editalAtual
          }
          onChange={(
            event
          ) =>
            navegar({
              cargo:
                event.target
                  .value ||
                null,
            })
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <option value="">
            {editalAtual
              ? "Todos"
              : "Selecione um edital"}
          </option>

          {cargos.map(
            (cargo) => (
              <option
                key={cargo}
                value={cargo}
              >
                {cargo}
              </option>
            )
          )}
        </select>
      </div>

      {/* LIMPAR */}

      <div className="flex items-end">
        <button
          type="button"
          onClick={limpar}
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 xl:w-auto"
        >
          Limpar filtros
        </button>
      </div>
    </div>
  );
}
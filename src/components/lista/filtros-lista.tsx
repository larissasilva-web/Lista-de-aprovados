"use client";

import { useRouter } from "next/navigation";

type Edital = {
  id: string;
  processo_seletivo: string;
  edital: string;
};

type FiltrosListaProps = {
  processos: string[];
  editais: Edital[];
  cargos: string[];

  processoSelecionado: string;
  editalSelecionado: string;
  cargoSelecionado: string;
};

export function FiltrosLista({
  processos,
  editais,
  cargos,
  processoSelecionado,
  editalSelecionado,
  cargoSelecionado,
}: FiltrosListaProps) {
  const router = useRouter();

  const editaisFiltrados = editais.filter(
    (edital) =>
      edital.processo_seletivo === processoSelecionado
  );

  function alterarProcesso(novoProcesso: string) {
    const params = new URLSearchParams();

    if (novoProcesso) {
      params.set("processo", novoProcesso);
    }

    router.push(`/lista?${params.toString()}`);
  }

  function alterarEdital(novoEdital: string) {
    const params = new URLSearchParams();

    if (processoSelecionado) {
      params.set("processo", processoSelecionado);
    }

    if (novoEdital) {
      params.set("edital", novoEdital);
    }

    router.push(`/lista?${params.toString()}`);
  }

  function alterarCargo(novoCargo: string) {
    const params = new URLSearchParams();

    if (processoSelecionado) {
      params.set("processo", processoSelecionado);
    }

    if (editalSelecionado) {
      params.set("edital", editalSelecionado);
    }

    if (novoCargo) {
      params.set("cargo", novoCargo);
    }

    router.push(`/lista?${params.toString()}`);
  }

  function limparFiltros() {
    router.push("/lista");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label
            htmlFor="processo"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Processo Seletivo
          </label>

          <select
            id="processo"
            value={processoSelecionado}
            onChange={(event) =>
              alterarProcesso(event.target.value)
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#094780]"
          >
            <option value="">
              Selecione o processo seletivo
            </option>

            {processos.map((processo) => (
              <option key={processo} value={processo}>
                {processo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="edital"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Edital
          </label>

          <select
            id="edital"
            value={editalSelecionado}
            onChange={(event) =>
              alterarEdital(event.target.value)
            }
            disabled={!processoSelecionado}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#094780] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">
              {processoSelecionado
                ? "Selecione o edital"
                : "Selecione primeiro o processo"}
            </option>

            {editaisFiltrados.map((edital) => (
              <option key={edital.id} value={edital.id}>
                {edital.edital}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="cargo"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Cargo
          </label>

          <select
            id="cargo"
            value={cargoSelecionado}
            onChange={(event) =>
              alterarCargo(event.target.value)
            }
            disabled={!editalSelecionado}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#094780] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">
              {editalSelecionado
                ? "Todos os cargos"
                : "Selecione primeiro o edital"}
            </option>

            {cargos.map((cargo) => (
              <option key={cargo} value={cargo}>
                {cargo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(processoSelecionado ||
        editalSelecionado ||
        cargoSelecionado) && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={limparFiltros}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}
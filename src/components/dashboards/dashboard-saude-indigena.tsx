"use client";

import {
  useMemo,
  useState,
} from "react";


export type DashboardSaudeIndigenaRegistro = {

  id: string;

  codigo_vaga: string;

  edital: string;

  nome_dsei: string | null;

  observacao: string | null;

  inscritos: number;

  aptos_para_analise: number;

  cancelados: number;

  reprovados_nao_finalizar_questionario: number;

  eliminados_por_nota: number;

  eliminados_antes_analise: number;

  reprovados_analise: number;

  triados: number;

  total_convocados_entrevista: number;

  total_aprovados: number;

  total_contratados: number;

  total_nao_contratados: number;

  taxa_contratacao: number | null;

  ano_edital: number | null;

  sincronizado_em: string;
};


type Props = {
  dadosIniciais:
    DashboardSaudeIndigenaRegistro[];
};


function numero(
  valor: number
) {
  return new Intl.NumberFormat(
    "pt-BR"
  ).format(valor);
}


function percentual(
  valor: number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(valor);
}


export function DashboardSaudeIndigena({
  dadosIniciais,
}: Props) {

  const [
    anoSelecionado,
    setAnoSelecionado,
  ] = useState("");


  const [
    editalSelecionado,
    setEditalSelecionado,
  ] = useState("");


  const [
    dseiSelecionado,
    setDseiSelecionado,
  ] = useState("");


  // =========================================================
  // OPÇÕES DOS FILTROS
  // =========================================================

  const anos = useMemo(
    () => {

      return Array
        .from(
          new Set(
            dadosIniciais
              .map(
                (item) =>
                  item.ano_edital
              )
              .filter(
                (
                  valor
                ): valor is number =>
                  valor !== null
              )
          )
        )
        .sort(
          (a, b) =>
            b - a
        );

    },
    [dadosIniciais]
  );


  const editais = useMemo(
    () => {

      const base =
        anoSelecionado
          ? dadosIniciais.filter(
              (item) =>
                item.ano_edital ===
                Number(
                  anoSelecionado
                )
            )
          : dadosIniciais;


      return Array
        .from(
          new Set(
            base.map(
              (item) =>
                item.edital
            )
          )
        )
        .sort(
          (a, b) =>
            a.localeCompare(
              b,
              "pt-BR",
              {
                numeric: true,
              }
            )
        );

    },
    [
      dadosIniciais,
      anoSelecionado,
    ]
  );


  const dseis = useMemo(
    () => {

      const base =
        dadosIniciais.filter(
          (item) => {

            if (
              anoSelecionado &&
              item.ano_edital !==
                Number(
                  anoSelecionado
                )
            ) {
              return false;
            }

            if (
              editalSelecionado &&
              item.edital !==
                editalSelecionado
            ) {
              return false;
            }

            return true;
          }
        );


      return Array
        .from(
          new Set(
            base
              .map(
                (item) =>
                  item.nome_dsei
              )
              .filter(
                (
                  valor
                ): valor is string =>
                  Boolean(valor)
              )
          )
        )
        .sort(
          (a, b) =>
            a.localeCompare(
              b,
              "pt-BR"
            )
        );

    },
    [
      dadosIniciais,
      anoSelecionado,
      editalSelecionado,
    ]
  );


  // =========================================================
  // DADOS FILTRADOS
  // =========================================================

  const dadosFiltrados =
    useMemo(
      () => {

        return dadosIniciais.filter(
          (item) => {

            if (
              anoSelecionado &&
              item.ano_edital !==
                Number(
                  anoSelecionado
                )
            ) {
              return false;
            }

            if (
              editalSelecionado &&
              item.edital !==
                editalSelecionado
            ) {
              return false;
            }

            if (
              dseiSelecionado &&
              item.nome_dsei !==
                dseiSelecionado
            ) {
              return false;
            }

            return true;
          }
        );

      },
      [
        dadosIniciais,
        anoSelecionado,
        editalSelecionado,
        dseiSelecionado,
      ]
    );


  // =========================================================
  // CARDS
  // =========================================================

  const indicadores =
    useMemo(
      () => {

        const inscritos =
          dadosFiltrados.reduce(
            (
              total,
              item
            ) =>
              total +
              item.inscritos,
            0
          );


        const aptos =
          dadosFiltrados.reduce(
            (
              total,
              item
            ) =>
              total +
              item.aptos_para_analise,
            0
          );


        const triados =
          dadosFiltrados.reduce(
            (
              total,
              item
            ) =>
              total +
              item.triados,
            0
          );


        const convocados =
          dadosFiltrados.reduce(
            (
              total,
              item
            ) =>
              total +
              item.total_convocados_entrevista,
            0
          );


        const aprovados =
          dadosFiltrados.reduce(
            (
              total,
              item
            ) =>
              total +
              item.total_aprovados,
            0
          );


        const contratados =
          dadosFiltrados.reduce(
            (
              total,
              item
            ) =>
              total +
              item.total_contratados,
            0
          );


        const taxaContratacao =
          aprovados > 0
            ? (
                contratados /
                aprovados
              ) * 100
            : 0;


        return {
          inscritos,
          aptos,
          triados,
          convocados,
          aprovados,
          contratados,
          taxaContratacao,
        };

      },
      [dadosFiltrados]
    );


  function limparFiltros() {

    setAnoSelecionado("");

    setEditalSelecionado("");

    setDseiSelecionado("");
  }


  return (
    <div className="space-y-6">

      {/* =====================================================
          FILTROS
      ===================================================== */}

      <div
        className="
          rounded-xl
          border
          border-slate-200
          bg-white
          p-4
          shadow-sm
          dark:border-slate-800
          dark:bg-slate-900
        "
      >

        <div
          className="
            grid
            gap-4
            md:grid-cols-2
            xl:grid-cols-4
          "
        >

          {/* Ano */}

          <div>

            <label
              className="
                mb-1.5
                block
                text-sm
                font-medium
              "
            >
              Ano
            </label>

            <select
              value={
                anoSelecionado
              }
              onChange={
                (event) => {

                  setAnoSelecionado(
                    event.target.value
                  );

                  setEditalSelecionado("");

                  setDseiSelecionado("");
                }
              }
              className="
                w-full
                rounded-lg
                border
                border-slate-300
                bg-white
                px-3
                py-2
                text-sm
                dark:border-slate-700
                dark:bg-slate-950
              "
            >

              <option value="">
                Todos
              </option>

              {anos.map(
                (ano) => (
                  <option
                    key={ano}
                    value={ano}
                  >
                    {ano}
                  </option>
                )
              )}

            </select>

          </div>


          {/* Edital */}

          <div>

            <label
              className="
                mb-1.5
                block
                text-sm
                font-medium
              "
            >
              Edital
            </label>

            <select
              value={
                editalSelecionado
              }
              onChange={
                (event) => {

                  setEditalSelecionado(
                    event.target.value
                  );

                  setDseiSelecionado("");
                }
              }
              className="
                w-full
                rounded-lg
                border
                border-slate-300
                bg-white
                px-3
                py-2
                text-sm
                dark:border-slate-700
                dark:bg-slate-950
              "
            >

              <option value="">
                Todos
              </option>

              {editais.map(
                (edital) => (
                  <option
                    key={edital}
                    value={edital}
                  >
                    {edital}
                  </option>
                )
              )}

            </select>

          </div>


          {/* DSEI */}

          <div>

            <label
              className="
                mb-1.5
                block
                text-sm
                font-medium
              "
            >
              DSEI
            </label>

            <select
              value={
                dseiSelecionado
              }
              onChange={
                (event) =>
                  setDseiSelecionado(
                    event.target.value
                  )
              }
              className="
                w-full
                rounded-lg
                border
                border-slate-300
                bg-white
                px-3
                py-2
                text-sm
                dark:border-slate-700
                dark:bg-slate-950
              "
            >

              <option value="">
                Todos
              </option>

              {dseis.map(
                (dsei) => (
                  <option
                    key={dsei}
                    value={dsei}
                  >
                    {dsei}
                  </option>
                )
              )}

            </select>

          </div>


          {/* Limpar */}

          <div
            className="
              flex
              items-end
            "
          >

            <button
              type="button"
              onClick={
                limparFiltros
              }
              className="
                w-full
                rounded-lg
                border
                border-slate-300
                px-4
                py-2
                text-sm
                font-medium
                transition
                hover:bg-slate-50
                dark:border-slate-700
                dark:hover:bg-slate-800
              "
            >
              Limpar filtros
            </button>

          </div>

        </div>

      </div>


      {/* =====================================================
          CARDS
      ===================================================== */}

      <div
        className="
          grid
          gap-4
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >

        <Card
          titulo="Inscritos"
          valor={
            numero(
              indicadores.inscritos
            )
          }
        />

        <Card
          titulo="Aptos para análise"
          valor={
            numero(
              indicadores.aptos
            )
          }
        />

        <Card
          titulo="Triados na análise"
          valor={
            numero(
              indicadores.triados
            )
          }
        />

        <Card
          titulo="Convocados para entrevista"
          valor={
            numero(
              indicadores.convocados
            )
          }
        />

        <Card
          titulo="Aprovados"
          valor={
            numero(
              indicadores.aprovados
            )
          }
        />

        <Card
          titulo="Contratados"
          valor={
            numero(
              indicadores.contratados
            )
          }
        />

        <Card
          titulo="Taxa de contratação"
          valor={
            `${percentual(
              indicadores.taxaContratacao
            )}%`
          }
        />

      </div>


      <div
        className="
          text-xs
          text-slate-500
        "
      >
        {numero(
          dadosFiltrados.length
        )} vagas consideradas nos filtros selecionados.
      </div>

    </div>
  );
}


// ============================================================
// CARD
// ============================================================

function Card({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {

  return (
    <div
      className="
        rounded-xl
        border
        border-slate-200
        bg-white
        p-5
        shadow-sm
        dark:border-slate-800
        dark:bg-slate-900
      "
    >

      <p
        className="
          text-sm
          font-medium
          text-slate-500
          dark:text-slate-400
        "
      >
        {titulo}
      </p>

      <p
        className="
          mt-2
          text-3xl
          font-semibold
          tracking-tight
        "
      >
        {valor}
      </p>

    </div>
  );
}
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";


export type DashboardSaudeIndigenaRegistro = {
  id: string;
  codigo_vaga: string;
  edital: string;
  nome_dsei: string | null;
  cargo: string | null;
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
  desistentes: number;

  taxa_contratacao: number | null;
  ano_edital: number | null;
  sincronizado_em: string;
};


type Props = {
  dadosIniciais: DashboardSaudeIndigenaRegistro[];
};


const PAGINA_TABELA = 25;


/**
 * Paleta validada para daltonismo (protan/deutan/tritan) sobre as duas
 * superfícies reais do app: branco no claro e #0f172a no escuro.
 * Verde x vermelho foi descartado: ΔE 4.1 em deuteranopia.
 */
const ESTILOS_VIZ = `
.viz {
  --serie-1: #2a78d6;
  --serie-2: #eb6834;
  --trilha: #e8eaee;
  --grade: #e6e8ec;
  --eixo: #c3c2b7;
}
.dark .viz {
  --serie-1: #3987e5;
  --serie-2: #d95926;
  --trilha: #1e293b;
  --grade: #24304a;
  --eixo: #383835;
}
.viz-marca {
  transition: opacity 120ms ease;
}
.viz-grupo:hover .viz-marca {
  opacity: 0.55;
}
.viz-grupo .viz-marca:hover {
  opacity: 1;
}
`;


function numero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}


function percentual(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}


function percentualCurto(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(valor);
}


/**
 * Escolhe um passo "redondo" mirando ~5 intervalos, sempre inteiro
 * porque todos os indicadores aqui são contagens.
 */
function escala(maximo: number) {
  if (!(maximo > 0)) {
    return { topo: 1, marcas: [0, 1] };
  }

  const magnitude = Math.pow(
    10,
    Math.floor(Math.log10(maximo / 5)),
  );

  const candidatos = [0.5, 1, 2, 2.5, 5, 10, 20]
    .map((fator) => fator * magnitude)
    .filter((candidato) => candidato >= 1);

  let passo = candidatos[candidatos.length - 1] ?? 1;
  let melhorDistancia = Infinity;

  for (const candidato of candidatos) {
    const intervalos = Math.ceil(maximo / candidato);

    if (intervalos < 3 || intervalos > 8) {
      continue;
    }

    const distancia = Math.abs(intervalos - 5);

    if (distancia < melhorDistancia) {
      melhorDistancia = distancia;
      passo = candidato;
    }
  }

  const topo = Math.ceil(maximo / passo) * passo;
  const marcas: number[] = [];

  for (let valor = 0; valor <= topo + 1e-6; valor += passo) {
    marcas.push(valor);
  }

  return { topo, marcas };
}


export function DashboardSaudeIndigena({ dadosIniciais }: Props) {

  const [anoSelecionado, setAnoSelecionado] = useState("");
  const [editalSelecionado, setEditalSelecionado] = useState("");
  const [dseiSelecionado, setDseiSelecionado] = useState("");
  const [busca, setBusca] = useState("");
  const [visiveis, setVisiveis] = useState(PAGINA_TABELA);

  // Trocar de recorte recomeça a paginação. Ajustar o estado durante a
  // renderização é o padrão recomendado para estado derivado.
  const recorte = [
    anoSelecionado,
    editalSelecionado,
    dseiSelecionado,
    busca,
  ].join("|");

  const [recorteAnterior, setRecorteAnterior] = useState(recorte);

  if (recorteAnterior !== recorte) {
    setRecorteAnterior(recorte);
    setVisiveis(PAGINA_TABELA);
  }


  // =========================================================
  // OPÇÕES DOS FILTROS
  // =========================================================

  const anos = useMemo(() => {
    return Array.from(
      new Set(
        dadosIniciais
          .map((item) => item.ano_edital)
          .filter((valor): valor is number => valor !== null),
      ),
    ).sort((a, b) => b - a);
  }, [dadosIniciais]);


  const editais = useMemo(() => {
    const base = anoSelecionado
      ? dadosIniciais.filter(
          (item) => item.ano_edital === Number(anoSelecionado),
        )
      : dadosIniciais;

    return Array.from(
      new Set(base.map((item) => item.edital)),
    ).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { numeric: true }),
    );
  }, [dadosIniciais, anoSelecionado]);


  const dseis = useMemo(() => {
    const base = dadosIniciais.filter((item) => {
      if (
        anoSelecionado &&
        item.ano_edital !== Number(anoSelecionado)
      ) {
        return false;
      }

      if (
        editalSelecionado &&
        item.edital !== editalSelecionado
      ) {
        return false;
      }

      return true;
    });

    return Array.from(
      new Set(
        base
          .map((item) => item.nome_dsei)
          .filter((valor): valor is string => Boolean(valor)),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [dadosIniciais, anoSelecionado, editalSelecionado]);


  // =========================================================
  // DADOS FILTRADOS
  // =========================================================

  const dadosFiltrados = useMemo(() => {
    return dadosIniciais.filter((item) => {
      if (
        anoSelecionado &&
        item.ano_edital !== Number(anoSelecionado)
      ) {
        return false;
      }

      if (
        editalSelecionado &&
        item.edital !== editalSelecionado
      ) {
        return false;
      }

      if (
        dseiSelecionado &&
        item.nome_dsei !== dseiSelecionado
      ) {
        return false;
      }

      return true;
    });
  }, [
    dadosIniciais,
    anoSelecionado,
    editalSelecionado,
    dseiSelecionado,
  ]);


  // =========================================================
  // INDICADORES
  // =========================================================

  const indicadores = useMemo(() => {
    const somar = (
      escolher: (
        item: DashboardSaudeIndigenaRegistro,
      ) => number,
    ) =>
      dadosFiltrados.reduce(
        (total, item) => total + escolher(item),
        0,
      );

    const inscritos = somar((item) => item.inscritos);
    const aptos = somar((item) => item.aptos_para_analise);
    const aprovados = somar((item) => item.total_aprovados);
    const contratados = somar((item) => item.total_contratados);

    return {
      inscritos,
      aptos,
      aprovados,
      contratados,
      triados: somar((item) => item.triados),
      convocados: somar(
        (item) => item.total_convocados_entrevista,
      ),
      desistentes: somar((item) => item.desistentes),
      cancelados: somar((item) => item.cancelados),
      questionario: somar(
        (item) => item.reprovados_nao_finalizar_questionario,
      ),
      eliminadosPorNota: somar(
        (item) => item.eliminados_por_nota,
      ),
      eliminadosAntesAnalise: somar(
        (item) => item.eliminados_antes_analise,
      ),
      reprovadosAnalise: somar(
        (item) => item.reprovados_analise,
      ),
      taxaContratacao:
        aprovados > 0 ? (contratados / aprovados) * 100 : 0,
    };
  }, [dadosFiltrados]);


  // =========================================================
  // SÉRIES DOS GRÁFICOS
  // =========================================================

  const eliminacoes = useMemo(
    () => [
      {
        rotulo: "Cancelados",
        valor: indicadores.cancelados,
      },
      {
        rotulo: "Questionário pendente",
        valor: indicadores.questionario,
      },
      {
        rotulo: "Eliminados por nota",
        valor: indicadores.eliminadosPorNota,
      },
    ],
    [indicadores],
  );


  const resultadoAnalise = useMemo(
    () => [
      { rotulo: "Triados", valor: indicadores.triados },
      {
        rotulo: "Reprovados",
        valor: indicadores.reprovadosAnalise,
      },
    ],
    [indicadores],
  );


  const topDseis = useMemo(() => {
    const acumulado = new Map<string, number>();

    for (const item of dadosFiltrados) {
      const chave = item.nome_dsei ?? "Sem DSEI informado";

      acumulado.set(
        chave,
        (acumulado.get(chave) ?? 0) + item.inscritos,
      );
    }

    return Array.from(acumulado.entries())
      .map(([rotulo, valor]) => ({ rotulo, valor }))
      .filter((item) => item.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 12);
  }, [dadosFiltrados]);


  const alertas = useMemo(() => {
    const vistos = new Set<string>();
    const lista: {
      chave: string;
      contexto: string;
      texto: string;
    }[] = [];

    for (const item of dadosFiltrados) {
      const observacao = item.observacao?.trim();

      if (!observacao) {
        continue;
      }

      const contexto = [item.nome_dsei, item.edital]
        .filter(Boolean)
        .join(" · ");

      const chave = `${contexto}||${observacao}`;

      if (vistos.has(chave)) {
        continue;
      }

      vistos.add(chave);
      lista.push({ chave, contexto, texto: observacao });
    }

    return lista;
  }, [dadosFiltrados]);


  // =========================================================
  // TABELA
  // =========================================================

  const linhasTabela = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) {
      return dadosFiltrados;
    }

    return dadosFiltrados.filter((item) =>
      [
        item.nome_dsei,
        item.edital,
        item.cargo,
        item.codigo_vaga,
        item.observacao,
      ]
        .filter(Boolean)
        .some((campo) =>
          String(campo).toLowerCase().includes(termo),
        ),
    );
  }, [dadosFiltrados, busca]);


  const sentinela = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const alvo = sentinela.current;

    if (!alvo || visiveis >= linhasTabela.length) {
      return;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) {
          setVisiveis(
            (atual) => atual + PAGINA_TABELA,
          );
        }
      },
      { rootMargin: "200px" },
    );

    observador.observe(alvo);

    return () => observador.disconnect();
  }, [visiveis, linhasTabela.length]);


  function limparFiltros() {
    setAnoSelecionado("");
    setEditalSelecionado("");
    setDseiSelecionado("");
    setBusca("");
  }


  const mostrando = Math.min(visiveis, linhasTabela.length);


  return (
    <div className="viz space-y-6">

      <style
        dangerouslySetInnerHTML={{ __html: ESTILOS_VIZ }}
      />

      {/* =====================================================
          FILTROS — uma linha única acima de tudo que eles afetam
      ===================================================== */}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <Campo rotulo="Ano">
            <select
              value={anoSelecionado}
              onChange={(event) => {
                setAnoSelecionado(event.target.value);
                setEditalSelecionado("");
                setDseiSelecionado("");
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">Todos</option>
              {anos.map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo="Edital">
            <select
              value={editalSelecionado}
              onChange={(event) => {
                setEditalSelecionado(event.target.value);
                setDseiSelecionado("");
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">Todos</option>
              {editais.map((edital) => (
                <option key={edital} value={edital}>
                  {edital}
                </option>
              ))}
            </select>
          </Campo>

          <Campo rotulo="DSEI">
            <select
              value={dseiSelecionado}
              onChange={(event) =>
                setDseiSelecionado(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">Todos</option>
              {dseis.map((dsei) => (
                <option key={dsei} value={dsei}>
                  {dsei}
                </option>
              ))}
            </select>
          </Campo>

          <div className="flex items-end">
            <button
              type="button"
              onClick={limparFiltros}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Limpar filtros
            </button>
          </div>

        </div>

      </div>


      {/* =====================================================
          CARDS
      ===================================================== */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <Card
          titulo="Inscritos"
          valor={numero(indicadores.inscritos)}
        />

        <Card
          titulo="Aptos para análise"
          valor={numero(indicadores.aptos)}
        />

        <Card
          titulo="Triados na análise"
          valor={numero(indicadores.triados)}
        />

        <Card
          titulo="Convocados para entrevista"
          valor={numero(indicadores.convocados)}
        />

        <Card
          titulo="Aprovados"
          valor={numero(indicadores.aprovados)}
        />

        <Card
          titulo="Contratados"
          valor={numero(indicadores.contratados)}
        />

        <Card
          titulo="Desistentes"
          valor={numero(indicadores.desistentes)}
          nota="Status “Desistente” na lista de aprovados."
        />

        <Card
          titulo="Taxa de contratação"
          valor={`${percentual(indicadores.taxaContratacao)}%`}
        />

      </div>


      {/* =====================================================
          GRÁFICOS
      ===================================================== */}

      <div className="grid gap-4 xl:grid-cols-2">

        <Painel
          etiqueta="Eliminações"
          titulo="Eliminados antes da análise"
          descricao="Cancelados, questionários não finalizados e eliminados por nota."
        >
          <BarrasHorizontais
            itens={eliminacoes}
            larguraRotulo="clamp(7rem, 22%, 11rem)"
          />
        </Painel>

        <Painel
          etiqueta="Análise curricular"
          titulo="Aptos na análise e eliminados"
          descricao="Composição entre aptos para análise e eliminados totais."
        >
          <Rosca
            segmentos={[
              {
                rotulo: "Aptos",
                valor: indicadores.aptos,
                cor: "var(--serie-1)",
              },
              {
                rotulo: "Eliminados",
                valor: indicadores.eliminadosAntesAnalise,
                cor: "var(--serie-2)",
              },
            ]}
          />
        </Painel>

        <Painel
          etiqueta="Contratação"
          titulo="Contratados"
          descricao="Percentual de contratados em relação ao total de aprovados."
        >
          <Medidor
            percentual={indicadores.taxaContratacao}
            legenda={`${numero(indicadores.contratados)} de ${numero(
              indicadores.aprovados,
            )} aprovados`}
          />
        </Painel>

        <Painel
          etiqueta="Resultado da análise"
          titulo="Triados e reprovados na análise"
          descricao="Comparativo operacional da etapa de análise."
        >
          <BarrasVerticais itens={resultadoAnalise} />
        </Painel>

      </div>


      {/* =====================================================
          RANKING DE DSEIs
      ===================================================== */}

      <Painel
        etiqueta="Distribuição"
        titulo="Top DSEIs por inscritos"
        descricao="Ranking do recorte ativo para identificar concentração de volume."
      >
        {topDseis.length === 0 ? (
          <Vazio texto="Nenhum inscrito no recorte selecionado." />
        ) : (
          <BarrasHorizontais
            itens={topDseis}
            larguraRotulo="clamp(8rem, 26%, 15rem)"
          />
        )}
      </Painel>


      {/* =====================================================
          ALERTAS
      ===================================================== */}

      <Painel
        etiqueta="Observações"
        titulo="Alertas identificados no recorte"
        descricao="Lista única de observações informadas na aba dashboard."
      >
        {alertas.length === 0 ? (
          <Vazio texto="Nenhuma observação registrada no recorte selecionado." />
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {alertas.map((alerta) => (
              <li
                key={alerta.chave}
                className="rounded-lg border border-slate-200 border-l-4 border-l-amber-500 bg-white px-4 py-3 dark:border-slate-800 dark:border-l-amber-500 dark:bg-slate-900"
              >
                <p className="text-sm font-semibold">
                  Alerta operacional
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {alerta.contexto
                    ? `${alerta.contexto} — ${alerta.texto}`
                    : alerta.texto}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Painel>


      {/* =====================================================
          TABELA — a visão tabular equivalente aos gráficos
      ===================================================== */}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Detalhes
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              Base operacional consolidada
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Consulta por DSEI, edital, cargo, vaga e indicadores principais.
            </p>
          </div>

          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar DSEI, edital, cargo ou observação"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm md:w-80 dark:border-slate-700 dark:bg-slate-950"
          />

        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-slate-200 bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          <span>
            Mostrando {numero(Math.min(1, mostrando))}
            {mostrando > 0 ? `-${numero(mostrando)}` : ""} de{" "}
            {numero(linhasTabela.length)} registros pesquisados
          </span>
          <span>
            Recorte atual: {numero(dadosFiltrados.length)} de{" "}
            {numero(dadosIniciais.length)} vagas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] border-collapse text-sm">

            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-5 py-3">DSEI</th>
                <th className="px-3 py-3">Edital</th>
                <th className="px-3 py-3">Cargo</th>
                <th className="px-3 py-3">Vaga</th>
                <th className="px-3 py-3 text-right">Inscritos</th>
                <th className="px-3 py-3 text-right">Aptos</th>
                <th className="px-3 py-3 text-right">Triados</th>
                <th className="px-3 py-3 text-right">Aprovados</th>
                <th className="px-3 py-3 text-right">Contratados</th>
                <th className="px-3 py-3 text-right">Desistentes</th>
                <th className="px-5 py-3">Observação</th>
              </tr>
            </thead>

            <tbody>
              {linhasTabela.slice(0, visiveis).map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-slate-200 align-top dark:border-slate-800"
                >
                  <td className="px-5 py-3 font-semibold">
                    {item.nome_dsei ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-slate-800">
                      {item.edital}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {item.cargo ?? "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {item.codigo_vaga || "—"}
                  </td>
                  <NumeroCelula valor={item.inscritos} />
                  <NumeroCelula valor={item.aptos_para_analise} />
                  <NumeroCelula valor={item.triados} />
                  <NumeroCelula valor={item.total_aprovados} />
                  <NumeroCelula valor={item.total_contratados} />
                  <NumeroCelula valor={item.desistentes} />
                  <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {item.observacao ?? "Sem observação"}
                  </td>
                </tr>
              ))}

              {linhasTabela.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    Nenhum registro encontrado para a busca atual.
                  </td>
                </tr>
              )}
            </tbody>

          </table>
        </div>

        <div
          ref={sentinela}
          className="px-5 py-4 text-center text-xs text-slate-500 dark:text-slate-400"
        >
          {visiveis < linhasTabela.length
            ? "Role para carregar mais registros"
            : linhasTabela.length > 0
              ? "Todos os registros do recorte foram carregados."
              : ""}
        </div>

      </div>

    </div>
  );
}


// ============================================================
// BLOCOS DE APOIO
// ============================================================

function Campo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {rotulo}
      </label>
      {children}
    </div>
  );
}


function Card({
  titulo,
  valor,
  nota,
}: {
  titulo: string;
  valor: string;
  nota?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {titulo}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">
        {valor}
      </p>
      {nota && (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          {nota}
        </p>
      )}
    </div>
  );
}


function Painel({
  etiqueta,
  titulo,
  descricao,
  children,
}: {
  etiqueta: string;
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {etiqueta}
      </p>
      <h3 className="mt-1 text-lg font-semibold">{titulo}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {descricao}
      </p>
      <div className="mt-5">{children}</div>
    </div>
  );
}


function Vazio({ texto }: { texto: string }) {
  return (
    <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
      {texto}
    </p>
  );
}


function NumeroCelula({ valor }: { valor: number }) {
  return (
    <td className="px-3 py-3 text-right tabular-nums">
      {numero(valor)}
    </td>
  );
}


// ============================================================
// GRÁFICOS
// ============================================================

type Item = { rotulo: string; valor: number };


/**
 * Uma série, uma cor. As categorias são nominais, então a cor não
 * repete a informação que o comprimento da barra já carrega.
 */
function BarrasHorizontais({
  itens,
  larguraRotulo,
}: {
  itens: Item[];
  larguraRotulo: string;
}) {
  const { topo, marcas } = escala(
    Math.max(...itens.map((item) => item.valor), 0),
  );

  return (
    <div className="viz-grupo">

      <div className="space-y-2.5">
        {itens.map((item) => (
          <div
            key={item.rotulo}
            className="flex items-center gap-3"
          >
            <span
              className="shrink-0 truncate text-right text-xs text-slate-500 dark:text-slate-400"
              style={{ width: larguraRotulo }}
              title={item.rotulo}
            >
              {item.rotulo}
            </span>

            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className="h-5 flex-1 rounded-sm"
                style={{ backgroundColor: "var(--trilha)" }}
              >
                <div
                  className="viz-marca h-5 rounded-r-[4px]"
                  style={{
                    width: `${(item.valor / topo) * 100}%`,
                    backgroundColor: "var(--serie-1)",
                  }}
                  title={`${item.rotulo}: ${numero(item.valor)}`}
                />
              </div>

              <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums">
                {numero(item.valor)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-3 flex items-center gap-3"
        aria-hidden="true"
      >
        <span
          className="shrink-0"
          style={{ width: larguraRotulo }}
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative flex-1">
            <div
              className="h-px w-full"
              style={{ backgroundColor: "var(--eixo)" }}
            />
            <div className="flex justify-between pt-1 text-[10px] tabular-nums text-slate-400">
              {marcas.map((marca) => (
                <span key={marca}>{numero(marca)}</span>
              ))}
            </div>
          </div>
          <span className="w-16 shrink-0" />
        </div>
      </div>

    </div>
  );
}


function BarrasVerticais({ itens }: { itens: Item[] }) {
  const { topo, marcas } = escala(
    Math.max(...itens.map((item) => item.valor), 0),
  );

  return (
    <div className="viz-grupo flex gap-3">

      <div className="flex h-56 w-14 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-slate-400">
        {[...marcas].reverse().map((marca) => (
          <span key={marca}>{numero(marca)}</span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative h-56">
          {marcas.map((marca) => (
            <div
              key={marca}
              className="absolute inset-x-0 h-px"
              style={{
                bottom: `${(marca / topo) * 100}%`,
                backgroundColor:
                  marca === 0 ? "var(--eixo)" : "var(--grade)",
              }}
              aria-hidden="true"
            />
          ))}

          <div className="absolute inset-0 flex items-end justify-around gap-6 px-6">
            {itens.map((item) => (
              <div
                key={item.rotulo}
                className="flex h-full w-full max-w-[5rem] flex-col justify-end"
              >
                <span className="mb-1 text-center text-xs font-semibold tabular-nums">
                  {numero(item.valor)}
                </span>
                <div
                  className="viz-marca w-full rounded-t-[4px]"
                  style={{
                    height: `${(item.valor / topo) * 100}%`,
                    backgroundColor: "var(--serie-1)",
                  }}
                  title={`${item.rotulo}: ${numero(item.valor)}`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-around gap-6 px-6 pt-2">
          {itens.map((item) => (
            <span
              key={item.rotulo}
              className="w-full max-w-[5rem] text-center text-xs text-slate-500 dark:text-slate-400"
            >
              {item.rotulo}
            </span>
          ))}
        </div>
      </div>

    </div>
  );
}


type Segmento = {
  rotulo: string;
  valor: number;
  cor: string;
};


function Rosca({ segmentos }: { segmentos: Segmento[] }) {
  const total = segmentos.reduce(
    (soma, item) => soma + item.valor,
    0,
  );

  const raio = 56;
  const circunferencia = 2 * Math.PI * raio;
  const folga = 3;

  const arcos = segmentos.map((segmento, indice) => {
    const anteriores = segmentos
      .slice(0, indice)
      .reduce((soma, outro) => soma + outro.valor, 0);

    const fracao = total > 0 ? segmento.valor / total : 0;
    const comprimento = fracao * circunferencia;

    const deslocamento =
      total > 0 ? (anteriores / total) * circunferencia : 0;

    return {
      ...segmento,
      fracao,
      deslocamento,
      visivel: Math.max(comprimento - folga, 0),
    };
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8">

      <svg
        viewBox="0 0 160 160"
        className="viz-grupo h-40 w-40 shrink-0"
        role="img"
        aria-label={segmentos
          .map(
            (item) =>
              `${item.rotulo}: ${numero(item.valor)}`,
          )
          .join("; ")}
      >
        <g transform="rotate(-90 80 80)">
          <circle
            cx="80"
            cy="80"
            r={raio}
            fill="none"
            stroke="var(--trilha)"
            strokeWidth="22"
          />
          {arcos.map((arco) => (
            <circle
              key={arco.rotulo}
              cx="80"
              cy="80"
              r={raio}
              fill="none"
              stroke={arco.cor}
              strokeWidth="22"
              strokeDasharray={`${arco.visivel} ${
                circunferencia - arco.visivel
              }`}
              strokeDashoffset={-arco.deslocamento}
              className="viz-marca"
            >
              <title>
                {`${arco.rotulo}: ${numero(arco.valor)} (${percentualCurto(
                  arco.fracao * 100,
                )}%)`}
              </title>
            </circle>
          ))}
        </g>

        <text
          x="80"
          y="76"
          textAnchor="middle"
          className="fill-slate-900 text-[19px] font-semibold dark:fill-slate-50"
        >
          {numero(total)}
        </text>
        <text
          x="80"
          y="94"
          textAnchor="middle"
          className="fill-slate-500 text-[10px] dark:fill-slate-400"
        >
          inscritos
        </text>
      </svg>

      <ul className="w-full max-w-xs space-y-3">
        {arcos.map((arco) => (
          <li
            key={arco.rotulo}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: arco.cor }}
                aria-hidden="true"
              />
              {arco.rotulo}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {numero(arco.valor)}
              <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                {percentualCurto(arco.fracao * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>

    </div>
  );
}


function Medidor({
  percentual: valor,
  legenda,
}: {
  percentual: number;
  legenda: string;
}) {
  const raio = 62;
  const comprimento = Math.PI * raio;
  const fracao = Math.min(Math.max(valor / 100, 0), 1);

  const caminho = `M 18 84 A ${raio} ${raio} 0 0 1 142 84`;

  return (
    <div className="flex flex-col items-center">

      <svg
        viewBox="0 0 160 100"
        className="h-32 w-full max-w-[16rem]"
        role="img"
        aria-label={`Taxa de contratação: ${percentual(valor)}%`}
      >
        <path
          d={caminho}
          fill="none"
          stroke="var(--trilha)"
          strokeWidth="18"
        />
        {/* Ponta reta: com strokeLinecap arredondado o cap de 9px
            infla visualmente percentuais pequenos. */}
        <path
          d={caminho}
          fill="none"
          stroke="var(--serie-1)"
          strokeWidth="18"
          strokeDasharray={`${fracao * comprimento} ${comprimento}`}
        />

        <text
          x="80"
          y="76"
          textAnchor="middle"
          className="fill-slate-900 text-[22px] font-semibold dark:fill-slate-50"
        >
          {percentual(valor)}%
        </text>
      </svg>

      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {legenda}
      </p>

    </div>
  );
}

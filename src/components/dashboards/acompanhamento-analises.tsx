"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

export type AcompanhamentoAnaliseRegistro = {
  registro_id: string;
  edital_id: string;
  vaga_id: string;
  processo_seletivo: string | null;
  edital: string;
  situacao_processo: "Ativo" | "Inativo" | string;
  status_edital: boolean;
  data_inicio: string | null;
  data_fim: string | null;
  unidade: string | null;
  codigo_vaga: string;
  nome_vaga: string | null;
  regime: string | null;
  carga_horaria: string | null;
  link_planilha_origem: string | null;
  ultima_sincronizacao: string | null;
  status_sync: string | null;
  candidato: string;
  codigo_candidato: string;
  data_nascimento: string | null;
  idade: number | null;
  nota_empregare: number | null;
  modalidade_concorrencia: string | null;
  nota_final_ajustada: number | null;
  somatorio: number | null;
  pontuacao_escolaridade: number | null;
  pontuacao_cursos_aperfeicoamento: number | null;
  pontuacao_experiencia_profissional: number | null;
  pontuacao_criterio_etnico: number | null;
  experiencia_profissional_anos: number | null;
  experiencia_profissional_meses: number | null;
  experiencia_profissional_dias: number | null;
  experiencia_profissional_total: number | null;
  experiencia_saude_indigena_anos: number | null;
  experiencia_saude_indigena_meses: number | null;
  experiencia_saude_indigena_dias: number | null;
  experiencia_saude_indigena_total: number | null;
  experiencia_atencao_basica_anos: number | null;
  experiencia_atencao_basica_meses: number | null;
  experiencia_atencao_basica_dias: number | null;
  experiencia_atencao_basica_total: number | null;
  etapa: string | null;
  data_analise: string | null;
  analise: string | null;
  pcd: string | null;
  responsavel_analise: string | null;
  coord_demandante: string | null;
  email_demandante: string | null;
  status_consolidado: string | null;
  status_analise: string;
  analise_concluida: boolean;
  validacao_janela: string;
};

type Props = {
  dadosIniciais: AcompanhamentoAnaliseRegistro[];
};

type StatusKpi =
  | "aptos"
  | "concluidas"
  | "pendentes"
  | "revisar"
  | "triados"
  | "reprovados"
  | "taxa";

const ITENS_POR_PAGINA = 20;

function numero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

function decimal(valor: number | null) {
  if (valor === null || Number.isNaN(valor)) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(valor);
}

function percentual(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(valor);
}

function normalizar(valor: string | null | undefined) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function ehTriado(item: AcompanhamentoAnaliseRegistro) {
  return normalizar(item.etapa).startsWith("triad");
}

function ehReprovado(item: AcompanhamentoAnaliseRegistro) {
  return normalizar(item.etapa).startsWith("reprov");
}

function formatarData(valor: string | null) {
  if (!valor) {
    return "-";
  }

  const data = valor.slice(0, 10);
  const partes = data.split("-");

  if (partes.length !== 3) {
    return valor;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarDataHora(valor: string | null) {
  if (!valor) {
    return "-";
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return valor;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

function formatarExperiencia(
  anos: number | null,
  meses: number | null,
  dias: number | null,
  total: number | null
) {
  const partes: string[] = [];

  if (anos) partes.push(`${anos}a`);
  if (meses) partes.push(`${meses}m`);
  if (dias) partes.push(`${dias}d`);

  if (partes.length > 0) {
    return partes.join(" ");
  }

  if (total !== null) {
    return `${numero(total)} dias`;
  }

  return "-";
}

function opcoesUnicas(
  dados: AcompanhamentoAnaliseRegistro[],
  obter: (item: AcompanhamentoAnaliseRegistro) => string | null
) {
  return Array.from(
    new Set(
      dados
        .map(obter)
        .filter((valor): valor is string => Boolean(valor?.trim()))
    )
  ).sort((a, b) =>
    a.localeCompare(b, "pt-BR", {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function classeStatus(status: string) {
  const valor = normalizar(status);

  if (valor === "triado") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300";
  }

  if (valor === "reprovado") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300";
  }

  if (valor === "revisar") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function classeJanela(status: string) {
  const valor = normalizar(status);

  if (valor === "dentro do periodo") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300";
  }

  if (valor === "sem analise") {
    return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }

  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300";
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function KpiCard({
  titulo,
  valor,
  subtitulo,
  tipo,
}: {
  titulo: string;
  valor: string;
  subtitulo: string;
  tipo: StatusKpi;
}) {
  const estilos: Record<StatusKpi, string> = {
    aptos: "border-t-[#094780]",
    concluidas: "border-t-[#1595ba]",
    pendentes: "border-t-[#E8871E]",
    revisar: "border-t-[#DB9300]",
    triados: "border-t-[#159669]",
    reprovados: "border-t-[#DC3545]",
    taxa: "border-t-[#2fb087]",
  };

  return (
    <article
      className={`rounded-xl border border-slate-200 border-t-4 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${estilos[tipo]}`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        {titulo}
      </p>

      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
        {valor}
      </p>

      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {subtitulo}
      </p>
    </article>
  );
}

function CampoFiltro({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {titulo}
      </span>
      {children}
    </label>
  );
}

const classeControle =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export function AcompanhamentoAnalises({
  dadosIniciais,
}: Props) {
  const [situacao, setSituacao] = useState("Ativo");
  const [unidade, setUnidade] = useState("");
  const [edital, setEdital] = useState("");
  const [vaga, setVaga] = useState("");
  const [statusAnalise, setStatusAnalise] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [validacaoJanela, setValidacaoJanela] = useState("");
  const [pesquisa, setPesquisa] = useState("");
  const [pagina, setPagina] = useState(1);
  const [selecionado, setSelecionado] =
    useState<AcompanhamentoAnaliseRegistro | null>(null);

  const situacoes = useMemo(
    () => opcoesUnicas(dadosIniciais, (item) => item.situacao_processo),
    [dadosIniciais]
  );

  const unidades = useMemo(
    () => opcoesUnicas(dadosIniciais, (item) => item.unidade),
    [dadosIniciais]
  );

  const editais = useMemo(
    () => opcoesUnicas(dadosIniciais, (item) => item.edital),
    [dadosIniciais]
  );

  const vagas = useMemo(
    () => opcoesUnicas(dadosIniciais, (item) => item.codigo_vaga),
    [dadosIniciais]
  );

  const status = useMemo(
    () => opcoesUnicas(dadosIniciais, (item) => item.status_analise),
    [dadosIniciais]
  );

  const responsaveis = useMemo(
    () => opcoesUnicas(dadosIniciais, (item) => item.responsavel_analise),
    [dadosIniciais]
  );

  const modalidades = useMemo(
    () => opcoesUnicas(dadosIniciais, (item) => item.modalidade_concorrencia),
    [dadosIniciais]
  );

  const validacoes = useMemo(
    () => opcoesUnicas(dadosIniciais, (item) => item.validacao_janela),
    [dadosIniciais]
  );

  const dadosFiltrados = useMemo(() => {
    const termo = normalizar(pesquisa);

    return dadosIniciais.filter((item) => {
      if (situacao && item.situacao_processo !== situacao) return false;
      if (unidade && item.unidade !== unidade) return false;
      if (edital && item.edital !== edital) return false;
      if (vaga && item.codigo_vaga !== vaga) return false;
      if (statusAnalise && item.status_analise !== statusAnalise) return false;
      if (responsavel && item.responsavel_analise !== responsavel) return false;
      if (modalidade && item.modalidade_concorrencia !== modalidade) return false;
      if (validacaoJanela && item.validacao_janela !== validacaoJanela) return false;

      if (termo) {
        const texto = normalizar(
          [
            item.candidato,
            item.codigo_candidato,
            item.nome_vaga,
            item.codigo_vaga,
            item.unidade,
            item.responsavel_analise,
            item.edital,
          ].join(" ")
        );

        if (!texto.includes(termo)) return false;
      }

      return true;
    });
  }, [
    dadosIniciais,
    situacao,
    unidade,
    edital,
    vaga,
    statusAnalise,
    responsavel,
    modalidade,
    validacaoJanela,
    pesquisa,
  ]);

  useEffect(() => {
    setPagina(1);
  }, [
    situacao,
    unidade,
    edital,
    vaga,
    statusAnalise,
    responsavel,
    modalidade,
    validacaoJanela,
    pesquisa,
  ]);

  const indicadores = useMemo(() => {
    const aptos = dadosFiltrados.length;
    const triados = dadosFiltrados.filter(ehTriado).length;
    const reprovados = dadosFiltrados.filter(ehReprovado).length;
    const concluidas = triados + reprovados;
    const pendentes = Math.max(aptos - concluidas, 0);
    const revisar = dadosFiltrados.filter(
      (item) => normalizar(item.status_consolidado) === "revisar"
    ).length;
    const taxa = aptos > 0 ? (concluidas / aptos) * 100 : 0;

    return {
      aptos,
      triados,
      reprovados,
      concluidas,
      pendentes,
      revisar,
      taxa,
    };
  }, [dadosFiltrados]);

  const analisesPorResponsavel = useMemo(() => {
    const mapa = new Map<
      string,
      {
        responsavel: string;
        triados: number;
        reprovados: number;
        revisar: number;
        pendentes: number;
        total: number;
      }
    >();

    dadosFiltrados.forEach((item) => {
      const nome = item.responsavel_analise?.trim() || "Sem responsável";
      const atual = mapa.get(nome) ?? {
        responsavel: nome,
        triados: 0,
        reprovados: 0,
        revisar: 0,
        pendentes: 0,
        total: 0,
      };

      if (item.status_analise === "Revisar") atual.revisar += 1;
      else if (ehTriado(item)) atual.triados += 1;
      else if (ehReprovado(item)) atual.reprovados += 1;
      else atual.pendentes += 1;

      atual.total += 1;
      mapa.set(nome, atual);
    });

    return Array.from(mapa.values())
      .sort((a, b) => b.total - a.total || a.responsavel.localeCompare(b.responsavel, "pt-BR"))
      .slice(0, 12);
  }, [dadosFiltrados]);

  const analisesPorData = useMemo(() => {
    const mapa = new Map<
      string,
      { data: string; total: number; foraJanela: number }
    >();

    dadosFiltrados.forEach((item) => {
      if (!item.data_analise || (!ehTriado(item) && !ehReprovado(item))) return;
      const chave = item.data_analise.slice(0, 10);
      const atual = mapa.get(chave) ?? {
        data: chave,
        total: 0,
        foraJanela: 0,
      };

      atual.total += 1;
      if (item.validacao_janela === "Fora do período") {
        atual.foraJanela += 1;
      }

      mapa.set(chave, atual);
    });

    return Array.from(mapa.values())
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(-24);
  }, [dadosFiltrados]);

  const pendencias = useMemo(() => {
    const pendentes = dadosFiltrados.filter(
      (item) => !ehTriado(item) && !ehReprovado(item)
    );

    const revisar = dadosFiltrados.filter(
      (item) => normalizar(item.status_consolidado) === "revisar"
    );

    const foraJanela = dadosFiltrados.filter(
      (item) => item.validacao_janela === "Fora do período"
    );

    const semResponsavel = dadosFiltrados.filter(
      (item) => !item.responsavel_analise?.trim()
    );

    const vagasPendentes = new Set(
      pendentes.map((item) => item.vaga_id)
    ).size;

    return {
      pendentes: pendentes.length,
      revisar: revisar.length,
      foraJanela: foraJanela.length,
      semResponsavel: semResponsavel.length,
      vagasPendentes,
    };
  }, [dadosFiltrados]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(dadosFiltrados.length / ITENS_POR_PAGINA)
  );

  const paginaSegura = Math.min(pagina, totalPaginas);

  const dadosPagina = useMemo(() => {
    const inicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
    return dadosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [dadosFiltrados, paginaSegura]);

  const maxResponsavel = Math.max(
    1,
    ...analisesPorResponsavel.map((item) => item.total)
  );

  const maxData = Math.max(
    1,
    ...analisesPorData.map((item) => item.total)
  );

  const ultimaAtualizacao = useMemo(() => {
    const valores = dadosIniciais
      .map((item) => item.ultima_sincronizacao)
      .filter((valor): valor is string => Boolean(valor))
      .sort();

    return valores.at(-1) ?? null;
  }, [dadosIniciais]);

  function limparFiltros() {
    setSituacao("");
    setUnidade("");
    setEdital("");
    setVaga("");
    setStatusAnalise("");
    setResponsavel("");
    setModalidade("");
    setValidacaoJanela("");
    setPesquisa("");
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Filtros operacionais
                </h3>
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                  {numero(dadosFiltrados.length)} candidato(s) no recorte
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Situação do processo usa o status Ativo/Inativo do edital. A janela oficial usa início e fim do processo seletivo.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Última sincronização: {formatarDataHora(ultimaAtualizacao)}
              </span>
              <button
                type="button"
                onClick={limparFiltros}
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <CampoFiltro titulo="Situação do processo">
            <select
              value={situacao}
              onChange={(event) => setSituacao(event.target.value)}
              className={classeControle}
            >
              <option value="">Todos</option>
              {situacoes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </CampoFiltro>

          <CampoFiltro titulo="Unidade">
            <select
              value={unidade}
              onChange={(event) => setUnidade(event.target.value)}
              className={classeControle}
            >
              <option value="">Todas</option>
              {unidades.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </CampoFiltro>

          <CampoFiltro titulo="Edital">
            <select
              value={edital}
              onChange={(event) => setEdital(event.target.value)}
              className={classeControle}
            >
              <option value="">Todos</option>
              {editais.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </CampoFiltro>

          <CampoFiltro titulo="Código da vaga">
            <select
              value={vaga}
              onChange={(event) => setVaga(event.target.value)}
              className={classeControle}
            >
              <option value="">Todas</option>
              {vagas.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </CampoFiltro>

          <CampoFiltro titulo="Status da análise">
            <select
              value={statusAnalise}
              onChange={(event) => setStatusAnalise(event.target.value)}
              className={classeControle}
            >
              <option value="">Todos</option>
              {status.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </CampoFiltro>

          <CampoFiltro titulo="Responsável">
            <select
              value={responsavel}
              onChange={(event) => setResponsavel(event.target.value)}
              className={classeControle}
            >
              <option value="">Todos</option>
              {responsaveis.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </CampoFiltro>

          <CampoFiltro titulo="Modalidade de concorrência">
            <select
              value={modalidade}
              onChange={(event) => setModalidade(event.target.value)}
              className={classeControle}
            >
              <option value="">Todas</option>
              {modalidades.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </CampoFiltro>

          <CampoFiltro titulo="Validação da janela">
            <select
              value={validacaoJanela}
              onChange={(event) => setValidacaoJanela(event.target.value)}
              className={classeControle}
            >
              <option value="">Todas</option>
              {validacoes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </CampoFiltro>

          <div className="md:col-span-2 xl:col-span-4">
            <CampoFiltro titulo="Busca">
              <input
                value={pesquisa}
                onChange={(event) => setPesquisa(event.target.value)}
                placeholder="Candidato, código, vaga, unidade, responsável ou edital..."
                className={classeControle}
              />
            </CampoFiltro>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <KpiCard
          titulo="Aptos para análise"
          valor={numero(indicadores.aptos)}
          subtitulo="Base da etapa curricular"
          tipo="aptos"
        />
        <KpiCard
          titulo="Análises concluídas"
          valor={numero(indicadores.concluidas)}
          subtitulo="Triados + reprovados"
          tipo="concluidas"
        />
        <KpiCard
          titulo="Pendentes"
          valor={numero(indicadores.pendentes)}
          subtitulo="Ainda sem etapa concluída"
          tipo="pendentes"
        />
        <KpiCard
          titulo="Revisar"
          valor={numero(indicadores.revisar)}
          subtitulo="Controle de qualidade"
          tipo="revisar"
        />
        <KpiCard
          titulo="Triados"
          valor={numero(indicadores.triados)}
          subtitulo="Etapa operacional Triado(s)"
          tipo="triados"
        />
        <KpiCard
          titulo="Reprovados"
          valor={numero(indicadores.reprovados)}
          subtitulo="Reprovados na análise"
          tipo="reprovados"
        />
        <KpiCard
          titulo="Taxa de conclusão"
          valor={`${percentual(indicadores.taxa)}%`}
          subtitulo="Concluídas / aptos"
          tipo="taxa"
        />
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.35fr_1fr_0.8fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                Análises por responsável
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Volume concluído por analista no recorte atual.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Pendentes
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Revisar
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Triados
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Reprovados
              </span>
            </div>
          </div>

          {analisesPorResponsavel.length === 0 ? (
            <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400 dark:border-slate-700">
              Nenhuma análise concluída no recorte.
            </div>
          ) : (
            <div className="space-y-4">
              {analisesPorResponsavel.map((item) => {
                const larguraTotal = (item.total / maxResponsavel) * 100;
                const pendentesPct = item.total > 0 ? (item.pendentes / item.total) * 100 : 0;
                const revisarPct = item.total > 0 ? (item.revisar / item.total) * 100 : 0;
                const triadosPct = item.total > 0 ? (item.triados / item.total) * 100 : 0;
                const reprovadosPct = item.total > 0 ? (item.reprovados / item.total) * 100 : 0;

                return (
                  <div key={item.responsavel}>
                    <div className="mb-1.5 flex items-center justify-between gap-4 text-xs">
                      <span className="truncate font-semibold text-slate-700 dark:text-slate-200">
                        {item.responsavel}
                      </span>
                      <span className="shrink-0 font-bold text-slate-900 dark:text-slate-100">
                        {numero(item.total)}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="flex h-full overflow-hidden rounded-full"
                        style={{ width: `${Math.max(larguraTotal, 2)}%` }}
                      >
                        <div className="h-full bg-slate-400" style={{ width: `${pendentesPct}%` }} />
                        <div className="h-full bg-amber-500" style={{ width: `${revisarPct}%` }} />
                        <div className="h-full bg-emerald-500" style={{ width: `${triadosPct}%` }} />
                        <div className="h-full bg-rose-500" style={{ width: `${reprovadosPct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5">
            <h3 className="font-bold text-slate-900 dark:text-slate-100">
              Análises por data
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Últimos dias com análises concluídas no recorte.
            </p>
          </div>

          {analisesPorData.length === 0 ? (
            <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400 dark:border-slate-700">
              Nenhuma data de análise encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-[560px] items-end gap-2" style={{ height: 260 }}>
                {analisesPorData.map((item) => {
                  const altura = Math.max((item.total / maxData) * 190, 8);

                  return (
                    <div key={item.data} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {numero(item.total)}
                      </span>
                      <div
                        className={`w-full max-w-8 rounded-t-md transition ${
                          item.foraJanela > 0
                            ? "bg-rose-500/85 hover:bg-rose-600"
                            : "bg-sky-500/85 hover:bg-sky-600"
                        }`}
                        style={{ height: altura }}
                        title={`${formatarData(item.data)}: ${item.total} análise(s)${
                          item.foraJanela > 0
                            ? ` · ${item.foraJanela} fora da janela`
                            : ""
                        }`}
                      />
                      <span className="-rotate-45 whitespace-nowrap text-[9px] text-slate-500">
                        {formatarData(item.data).slice(0, 5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4">
            <h3 className="font-bold text-slate-900 dark:text-slate-100">
              Pendências prioritárias
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Atalhos para os pontos que exigem atenção.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setStatusAnalise("Pendente")}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left transition hover:border-sky-300 hover:bg-sky-50/50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <span>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">Sem análise</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">Candidatos ainda pendentes</span>
              </span>
              <strong className="text-xl text-[#E8871E]">{numero(pendencias.pendentes)}</strong>
            </button>

            <button
              type="button"
              onClick={() => setStatusAnalise("Revisar")}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50/50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <span>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">Revisar</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">Inconsistências de qualidade</span>
              </span>
              <strong className="text-xl text-[#DB9300]">{numero(pendencias.revisar)}</strong>
            </button>

            <button
              type="button"
              onClick={() => setValidacaoJanela("Fora do período")}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left transition hover:border-rose-300 hover:bg-rose-50/50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <span>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">Fora da janela</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">Antes ou após o período</span>
              </span>
              <strong className="text-xl text-[#DC3545]">{numero(pendencias.foraJanela)}</strong>
            </button>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <span>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">Sem responsável</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">Registros sem responsável informado</span>
              </span>
              <strong className="text-xl text-slate-600 dark:text-slate-300">{numero(pendencias.semResponsavel)}</strong>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <span>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">Vagas com pendência</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">Ao menos um candidato pendente</span>
              </span>
              <strong className="text-xl text-[#094780] dark:text-sky-300">{numero(pendencias.vagasPendentes)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">
              Fila operacional
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Clique em um candidato para abrir o detalhamento completo da análise.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Página {paginaSegura} de {totalPaginas}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-950/40">
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3">Edital</th>
                <th className="px-4 py-3">Vaga</th>
                <th className="px-4 py-3">Candidato</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-right">Detalhes</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {dadosPagina.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-sm text-slate-500">
                    Nenhum candidato encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                dadosPagina.map((item) => (
                  <tr
                    key={item.registro_id}
                    onClick={() => setSelecionado(item)}
                    className="cursor-pointer transition hover:bg-sky-50/60 dark:hover:bg-slate-800/70"
                  >
                    <td className="max-w-48 px-4 py-3 text-xs font-medium text-slate-700 dark:text-slate-200">
                      <span className="line-clamp-2">{item.unidade || "-"}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                      {item.edital}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-bold text-slate-900 dark:text-slate-100">{item.codigo_vaga}</span>
                      <span className="mt-0.5 block max-w-64 truncate text-xs text-slate-500">{item.nome_vaga || "-"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block min-w-44 font-semibold text-slate-900 dark:text-slate-100">{item.candidato}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">Código {item.codigo_candidato}</span>
                    </td>
                    <td className="max-w-44 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      {item.responsavel_analise || "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge className={classeStatus(item.status_analise)}>{item.status_analise}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      {formatarData(item.data_analise)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#094780] transition hover:bg-slate-50 dark:border-slate-700 dark:text-sky-300 dark:hover:bg-slate-800"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelecionado(item);
                        }}
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Exibindo {dadosPagina.length} de {numero(dadosFiltrados.length)} registro(s).
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={paginaSegura <= 1}
              onClick={() => setPagina((valor) => Math.max(1, valor - 1))}
              className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={paginaSegura >= totalPaginas}
              onClick={() => setPagina((valor) => Math.min(totalPaginas, valor + 1))}
              className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
            >
              Próxima
            </button>
          </div>
        </div>
      </section>

      {selecionado && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/35 backdrop-blur-[1px]" onMouseDown={() => setSelecionado(null)}>
          <aside
            className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl dark:bg-slate-950"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={classeStatus(selecionado.status_analise)}>{selecionado.status_analise}</Badge>
                    <Badge className={classeJanela(selecionado.validacao_janela)}>{selecionado.validacao_janela}</Badge>
                  </div>
                  <h3 className="mt-3 text-xl font-bold text-slate-950 dark:text-slate-50">
                    {selecionado.candidato}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Código {selecionado.codigo_candidato} · Vaga {selecionado.codigo_vaga}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelecionado(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-xl text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  aria-label="Fechar detalhamento"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-5 p-6">
              <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Contexto da vaga
                </h4>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Detalhe titulo="Unidade" valor={selecionado.unidade || "-"} />
                  <Detalhe titulo="Edital" valor={selecionado.edital} />
                  <Detalhe titulo="Vaga" valor={`${selecionado.codigo_vaga} — ${selecionado.nome_vaga || "Sem descrição"}`} />
                  <Detalhe titulo="Modalidade" valor={selecionado.modalidade_concorrencia || "-"} />
                  <Detalhe titulo="Regime" valor={selecionado.regime || "-"} />
                  <Detalhe titulo="Carga horária" valor={selecionado.carga_horaria || "-"} />
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Situação da análise
                </h4>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Detalhe titulo="Etapa" valor={selecionado.etapa || "Pendente"} />
                  <Detalhe titulo="Responsável" valor={selecionado.responsavel_analise || "-"} />
                  <Detalhe titulo="Data da análise" valor={formatarData(selecionado.data_analise)} />
                  <Detalhe titulo="Validação" valor={selecionado.validacao_janela} />
                  <Detalhe
                    titulo="Janela oficial"
                    valor={`${formatarData(selecionado.data_inicio)} a ${formatarData(selecionado.data_fim)}`}
                  />
                  <Detalhe titulo="Situação do processo" valor={selecionado.situacao_processo} />
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Pontuação
                </h4>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <MiniMetrica titulo="Nota Empregare" valor={decimal(selecionado.nota_empregare)} />
                  <MiniMetrica titulo="Nota final" valor={decimal(selecionado.nota_final_ajustada)} />
                  <MiniMetrica titulo="Somatório" valor={decimal(selecionado.somatorio)} />
                  <MiniMetrica titulo="Escolaridade" valor={decimal(selecionado.pontuacao_escolaridade)} />
                  <MiniMetrica titulo="Cursos" valor={decimal(selecionado.pontuacao_cursos_aperfeicoamento)} />
                  <MiniMetrica titulo="Experiência" valor={decimal(selecionado.pontuacao_experiencia_profissional)} />
                  <MiniMetrica titulo="Critério étnico" valor={decimal(selecionado.pontuacao_criterio_etnico)} />
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Experiência registrada
                </h4>
                <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                  <Detalhe
                    titulo="Profissional"
                    valor={formatarExperiencia(
                      selecionado.experiencia_profissional_anos,
                      selecionado.experiencia_profissional_meses,
                      selecionado.experiencia_profissional_dias,
                      selecionado.experiencia_profissional_total
                    )}
                  />
                  <Detalhe
                    titulo="Saúde indígena"
                    valor={formatarExperiencia(
                      selecionado.experiencia_saude_indigena_anos,
                      selecionado.experiencia_saude_indigena_meses,
                      selecionado.experiencia_saude_indigena_dias,
                      selecionado.experiencia_saude_indigena_total
                    )}
                  />
                  <Detalhe
                    titulo="Atenção básica"
                    valor={formatarExperiencia(
                      selecionado.experiencia_atencao_basica_anos,
                      selecionado.experiencia_atencao_basica_meses,
                      selecionado.experiencia_atencao_basica_dias,
                      selecionado.experiencia_atencao_basica_total
                    )}
                  />
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Parecer da análise
                </h4>
                <div className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {selecionado.analise || "Nenhum parecer registrado."}
                </div>
              </section>

              <section className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Origem
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Última sincronização: {formatarDataHora(selecionado.ultima_sincronizacao)}
                  </p>
                </div>

                {selecionado.link_planilha_origem ? (
                  <a
                    href={selecionado.link_planilha_origem}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#094780] px-4 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Abrir planilha de origem
                  </a>
                ) : null}
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Detalhe({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {titulo}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
        {valor}
      </dd>
    </div>
  );
}

function MiniMetrica({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {titulo}
      </span>
      <strong className="mt-1 block text-lg text-slate-900 dark:text-slate-100">
        {valor}
      </strong>
    </div>
  );
}

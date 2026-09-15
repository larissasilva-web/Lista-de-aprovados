import {
  AcompanhamentoAnalises,
  AcompanhamentoAnaliseRegistro,
} from "@/components/dashboards/acompanhamento-analises";

import {
  exigirModulo,
} from "@/lib/auth/usuario-atual";

import {
  createClient,
} from "@/lib/supabase/server";

const TAMANHO_LOTE = 1000;

function numeroOuNulo(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export default async function AcompanhamentoAnalisesPage() {
  await exigirModulo("dashboards", [
    "usuario",
    "gestor_edital",
    "contratador",
    "admin",
  ]);

  const supabase = await createClient();
  const registros: Record<string, unknown>[] = [];

  let inicio = 0;
  let erroCarregamento: string | null = null;

  while (true) {
    const {
      data,
      error,
    } = await supabase
      .from("vw_acompanhamento_analises")
      .select(`
        registro_id,
        edital_id,
        vaga_id,
        processo_seletivo,
        edital,
        situacao_processo,
        status_edital,
        data_inicio,
        data_fim,
        unidade,
        codigo_vaga,
        nome_vaga,
        regime,
        carga_horaria,
        link_planilha_origem,
        ultima_sincronizacao,
        status_sync,
        candidato,
        codigo_candidato,
        data_nascimento,
        idade,
        nota_empregare,
        modalidade_concorrencia,
        nota_final_ajustada,
        somatorio,
        pontuacao_escolaridade,
        pontuacao_cursos_aperfeicoamento,
        pontuacao_experiencia_profissional,
        pontuacao_criterio_etnico,
        experiencia_profissional_anos,
        experiencia_profissional_meses,
        experiencia_profissional_dias,
        experiencia_profissional_total,
        experiencia_saude_indigena_anos,
        experiencia_saude_indigena_meses,
        experiencia_saude_indigena_dias,
        experiencia_saude_indigena_total,
        experiencia_atencao_basica_anos,
        experiencia_atencao_basica_meses,
        experiencia_atencao_basica_dias,
        experiencia_atencao_basica_total,
        etapa,
        data_analise,
        analise,
        pcd,
        responsavel_analise,
        coord_demandante,
        email_demandante,
        status_consolidado,
        status_analise,
        analise_concluida,
        validacao_janela
      `)
      .order("edital", { ascending: false })
      .order("codigo_vaga", { ascending: true })
      .order("candidato", { ascending: true })
      .range(inicio, inicio + TAMANHO_LOTE - 1);

    if (error) {
      erroCarregamento = error.message;
      break;
    }

    const lote = (data ?? []) as Record<string, unknown>[];
    registros.push(...lote);

    if (lote.length < TAMANHO_LOTE) {
      break;
    }

    inicio += TAMANHO_LOTE;
  }

  if (erroCarregamento) {
    return (
      <section>
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
            Saúde Indígena
          </p>
          <h2 className="mt-1 text-2xl font-semibold">
            Acompanhamento das Análises
          </h2>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-bold">A view do dashboard ainda não está disponível.</p>
          <p className="mt-2 leading-6">
            Execute o arquivo <code>sql/04_dashboard_acompanhamento_analises.sql</code> no Supabase e atualize esta página.
          </p>
          <p className="mt-2 text-xs opacity-80">
            Retorno do banco: {erroCarregamento}
          </p>
        </div>
      </section>
    );
  }

  const dados: AcompanhamentoAnaliseRegistro[] = registros.map((item) => ({
    registro_id: String(item.registro_id ?? ""),
    edital_id: String(item.edital_id ?? ""),
    vaga_id: String(item.vaga_id ?? ""),
    processo_seletivo: item.processo_seletivo ? String(item.processo_seletivo) : null,
    edital: String(item.edital ?? ""),
    situacao_processo: String(item.situacao_processo ?? ""),
    status_edital: Boolean(item.status_edital),
    data_inicio: item.data_inicio ? String(item.data_inicio) : null,
    data_fim: item.data_fim ? String(item.data_fim) : null,
    unidade: item.unidade ? String(item.unidade) : null,
    codigo_vaga: String(item.codigo_vaga ?? ""),
    nome_vaga: item.nome_vaga ? String(item.nome_vaga) : null,
    regime: item.regime ? String(item.regime) : null,
    carga_horaria: item.carga_horaria ? String(item.carga_horaria) : null,
    link_planilha_origem: item.link_planilha_origem ? String(item.link_planilha_origem) : null,
    ultima_sincronizacao: item.ultima_sincronizacao ? String(item.ultima_sincronizacao) : null,
    status_sync: item.status_sync ? String(item.status_sync) : null,
    candidato: String(item.candidato ?? ""),
    codigo_candidato: String(item.codigo_candidato ?? ""),
    data_nascimento: item.data_nascimento ? String(item.data_nascimento) : null,
    idade: numeroOuNulo(item.idade),
    nota_empregare: numeroOuNulo(item.nota_empregare),
    modalidade_concorrencia: item.modalidade_concorrencia ? String(item.modalidade_concorrencia) : null,
    nota_final_ajustada: numeroOuNulo(item.nota_final_ajustada),
    somatorio: numeroOuNulo(item.somatorio),
    pontuacao_escolaridade: numeroOuNulo(item.pontuacao_escolaridade),
    pontuacao_cursos_aperfeicoamento: numeroOuNulo(item.pontuacao_cursos_aperfeicoamento),
    pontuacao_experiencia_profissional: numeroOuNulo(item.pontuacao_experiencia_profissional),
    pontuacao_criterio_etnico: numeroOuNulo(item.pontuacao_criterio_etnico),
    experiencia_profissional_anos: numeroOuNulo(item.experiencia_profissional_anos),
    experiencia_profissional_meses: numeroOuNulo(item.experiencia_profissional_meses),
    experiencia_profissional_dias: numeroOuNulo(item.experiencia_profissional_dias),
    experiencia_profissional_total: numeroOuNulo(item.experiencia_profissional_total),
    experiencia_saude_indigena_anos: numeroOuNulo(item.experiencia_saude_indigena_anos),
    experiencia_saude_indigena_meses: numeroOuNulo(item.experiencia_saude_indigena_meses),
    experiencia_saude_indigena_dias: numeroOuNulo(item.experiencia_saude_indigena_dias),
    experiencia_saude_indigena_total: numeroOuNulo(item.experiencia_saude_indigena_total),
    experiencia_atencao_basica_anos: numeroOuNulo(item.experiencia_atencao_basica_anos),
    experiencia_atencao_basica_meses: numeroOuNulo(item.experiencia_atencao_basica_meses),
    experiencia_atencao_basica_dias: numeroOuNulo(item.experiencia_atencao_basica_dias),
    experiencia_atencao_basica_total: numeroOuNulo(item.experiencia_atencao_basica_total),
    etapa: item.etapa ? String(item.etapa) : null,
    data_analise: item.data_analise ? String(item.data_analise) : null,
    analise: item.analise ? String(item.analise) : null,
    pcd: item.pcd ? String(item.pcd) : null,
    responsavel_analise: item.responsavel_analise ? String(item.responsavel_analise) : null,
    coord_demandante: item.coord_demandante ? String(item.coord_demandante) : null,
    email_demandante: item.email_demandante ? String(item.email_demandante) : null,
    status_consolidado: item.status_consolidado ? String(item.status_consolidado) : null,
    status_analise: String(item.status_analise ?? "Pendente"),
    analise_concluida: Boolean(item.analise_concluida),
    validacao_janela: String(item.validacao_janela ?? "Sem análise"),
  }));

  return (
    <section>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
            Saúde Indígena
          </p>
          <h2 className="mt-1 text-2xl font-semibold">
            Acompanhamento das Análises
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Visão operacional da análise curricular: produtividade, pendências, qualidade e detalhamento por candidato.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Fonte: ETL análise curricular
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {dados.length.toLocaleString("pt-BR")} apto(s) carregado(s)
          </span>
        </div>
      </div>

      <AcompanhamentoAnalises dadosIniciais={dados} />
    </section>
  );
}

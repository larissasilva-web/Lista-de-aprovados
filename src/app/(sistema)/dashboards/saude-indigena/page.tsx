import {
  DashboardSaudeIndigena,
  DashboardSaudeIndigenaRegistro,
} from "@/components/dashboards/dashboard-saude-indigena";

import {
  exigirModulo,
} from "@/lib/auth/usuario-atual";

import {
  createClient,
} from "@/lib/supabase/server";


const TAMANHO_LOTE = 1000;


type Linha = Record<string, unknown>;

type Resposta = {
  data: unknown;
  error: { message: string } | null;
};


/**
 * O PostgREST devolve no máximo 1.000 linhas por requisição.
 * Sem paginar, os totais do dashboard ficam truncados.
 */
async function carregarTudo(
  rotulo: string,
  montarLote: (inicio: number, fim: number) => PromiseLike<Resposta>,
) {
  const linhas: Linha[] = [];
  let inicio = 0;

  while (true) {
    const { data, error } = await montarLote(
      inicio,
      inicio + TAMANHO_LOTE - 1,
    );

    if (error) {
      throw new Error(
        `Erro ao carregar ${rotulo}: ${error.message}`,
      );
    }

    const lote = (data ?? []) as Linha[];
    linhas.push(...lote);

    if (lote.length < TAMANHO_LOTE) {
      break;
    }

    inicio += TAMANHO_LOTE;
  }

  return linhas;
}


function chaveVaga(
  edital: unknown,
  codigoVaga: unknown,
) {
  return `${String(edital ?? "")}||${String(codigoVaga ?? "")}`;
}


function texto(valor: unknown) {
  return valor === null || valor === undefined
    ? null
    : String(valor).trim() || null;
}


export default async function SaudeIndigenaPage() {

  await exigirModulo("dashboards", [
    "usuario",
    "gestor_edital",
    "contratador",
    "admin",
  ]);

  const supabase = await createClient();

  const [
    registros,
    linhasCargo,
    linhasDesistentes,
  ] = await Promise.all([

    // Indicadores consolidados por vaga.
    carregarTudo(
      "vw_dashboard_saude_indigena",
      (de, ate) =>
        supabase
          .from("vw_dashboard_saude_indigena")
          .select(`
            id,
            codigo_vaga,
            edital,
            nome_dsei,
            observacao,
            inscritos,
            aptos_para_analise,
            cancelados,
            reprovados_nao_finalizar_questionario,
            eliminados_por_nota,
            eliminados_antes_analise,
            reprovados_analise,
            triados,
            total_convocados_entrevista,
            total_aprovados,
            total_contratados,
            total_nao_contratados,
            taxa_contratacao,
            ano_edital,
            sincronizado_em
          `)
          .order("ano_edital", { ascending: false })
          .order("edital", { ascending: true })
          .order("codigo_vaga", { ascending: true })
          .range(de, ate),
    ),

    // A view do dashboard não expõe o cargo; ele vem da tabela de origem.
    carregarTudo(
      "analise_curricular_saude_indigena",
      (de, ate) =>
        supabase
          .from("analise_curricular_saude_indigena")
          .select("edital, codigo_vaga, cargo")
          .eq("ativo_na_fonte", true)
          .range(de, ate),
    ),

    // Desistentes seguem o status registrado na lista de aprovados.
    carregarTudo(
      "lista_aprovados",
      (de, ate) =>
        supabase
          .from("lista_aprovados")
          .select("edital, codigo_vaga, status")
          .eq("status", "Desistente")
          .range(de, ate),
    ),
  ]);

  const cargosPorVaga = new Map<string, string>();

  for (const linha of linhasCargo) {
    const cargo = texto(linha.cargo);

    if (cargo) {
      cargosPorVaga.set(
        chaveVaga(linha.edital, linha.codigo_vaga),
        cargo,
      );
    }
  }

  const desistentesPorVaga = new Map<string, number>();

  for (const linha of linhasDesistentes) {
    const chave = chaveVaga(
      linha.edital,
      linha.codigo_vaga,
    );

    desistentesPorVaga.set(
      chave,
      (desistentesPorVaga.get(chave) ?? 0) + 1,
    );
  }

  const dados: DashboardSaudeIndigenaRegistro[] =
    registros.map((item) => {
      const chave = chaveVaga(
        item.edital,
        item.codigo_vaga,
      );

      return {
        id: String(item.id ?? ""),
        codigo_vaga: String(item.codigo_vaga ?? ""),
        edital: String(item.edital ?? ""),
        nome_dsei: texto(item.nome_dsei),
        cargo: cargosPorVaga.get(chave) ?? null,
        observacao: texto(item.observacao),

        inscritos: Number(item.inscritos ?? 0),
        aptos_para_analise: Number(item.aptos_para_analise ?? 0),
        cancelados: Number(item.cancelados ?? 0),
        reprovados_nao_finalizar_questionario: Number(
          item.reprovados_nao_finalizar_questionario ?? 0,
        ),
        eliminados_por_nota: Number(item.eliminados_por_nota ?? 0),
        eliminados_antes_analise: Number(
          item.eliminados_antes_analise ?? 0,
        ),
        reprovados_analise: Number(item.reprovados_analise ?? 0),
        triados: Number(item.triados ?? 0),
        total_convocados_entrevista: Number(
          item.total_convocados_entrevista ?? 0,
        ),
        total_aprovados: Number(item.total_aprovados ?? 0),
        total_contratados: Number(item.total_contratados ?? 0),
        total_nao_contratados: Number(item.total_nao_contratados ?? 0),
        desistentes: desistentesPorVaga.get(chave) ?? 0,

        taxa_contratacao:
          item.taxa_contratacao === null ||
          item.taxa_contratacao === undefined
            ? null
            : Number(item.taxa_contratacao),

        ano_edital:
          item.ano_edital === null || item.ano_edital === undefined
            ? null
            : Number(item.ano_edital),

        sincronizado_em: String(item.sincronizado_em ?? ""),
      };
    });

  return (
    <section>

      <div className="mb-6">

        <h2 className="text-2xl font-semibold">
          Saúde Indígena
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Acompanhe os principais indicadores dos processos
          seletivos da Saúde Indígena.
        </p>

      </div>


      <DashboardSaudeIndigena
        dadosIniciais={dados}
      />

    </section>
  );
}

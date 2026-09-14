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


export default async function SaudeIndigenaPage() {

  await exigirModulo("dashboards", [
    "usuario",
    "gestor_edital",
    "contratador",
    "admin",
  ]);

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "vw_dashboard_saude_indigena"
    )
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
    .order(
      "ano_edital",
      {
        ascending: false,
      }
    )
    .order(
      "edital",
      {
        ascending: true,
      }
    )
    .order(
      "codigo_vaga",
      {
        ascending: true,
      }
    );

  if (error) {
    throw new Error(
      `Erro ao carregar dashboard da Saúde Indígena: ${error.message}`
    );
  }


  const dados:
    DashboardSaudeIndigenaRegistro[] =
    (data ?? []).map(
      (item) => ({
        id:
          item.id,

        codigo_vaga:
          item.codigo_vaga,

        edital:
          item.edital,

        nome_dsei:
          item.nome_dsei,

        observacao:
          item.observacao,

        inscritos:
          Number(
            item.inscritos ?? 0
          ),

        aptos_para_analise:
          Number(
            item.aptos_para_analise ?? 0
          ),

        cancelados:
          Number(
            item.cancelados ?? 0
          ),

        reprovados_nao_finalizar_questionario:
          Number(
            item.reprovados_nao_finalizar_questionario ?? 0
          ),

        eliminados_por_nota:
          Number(
            item.eliminados_por_nota ?? 0
          ),

        eliminados_antes_analise:
          Number(
            item.eliminados_antes_analise ?? 0
          ),

        reprovados_analise:
          Number(
            item.reprovados_analise ?? 0
          ),

        triados:
          Number(
            item.triados ?? 0
          ),

        total_convocados_entrevista:
          Number(
            item.total_convocados_entrevista ?? 0
          ),

        total_aprovados:
          Number(
            item.total_aprovados ?? 0
          ),

        total_contratados:
          Number(
            item.total_contratados ?? 0
          ),

        total_nao_contratados:
          Number(
            item.total_nao_contratados ?? 0
          ),

        taxa_contratacao:
          item.taxa_contratacao === null
            ? null
            : Number(
                item.taxa_contratacao
              ),

        ano_edital:
          item.ano_edital === null
            ? null
            : Number(
                item.ano_edital
              ),

        sincronizado_em:
          item.sincronizado_em,
      })
    );


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
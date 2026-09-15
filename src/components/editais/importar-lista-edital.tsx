"use client";

import {
  ChangeEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Papa from "papaparse";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  COLUNAS_ESPERADAS,
  LinhaImportacao,
  normalizarCabecalho,
  normalizarLinha,
  validarCabecalhos,
  validarLinhas,
} from "@/lib/editais/importacao-lista";

type Props = {
  editalId: string;
  editalNome: string;
  planilhaCruzamentoInformada: boolean;
};

export function ImportarListaEdital({
  editalId,
  editalNome,
  planilhaCruzamentoInformada,
}: Props) {
  const router = useRouter();

  const [arquivo, setArquivo] =
    useState<File | null>(null);

  const [candidatos, setCandidatos] =
    useState<LinhaImportacao[]>([]);

  const [colunas, setColunas] =
    useState<string[]>([]);

  const [processandoArquivo, setProcessandoArquivo] =
    useState(false);

  const [salvando, setSalvando] =
    useState(false);

  const [baixandoModelo, setBaixandoModelo] =
    useState(false);

  const [carregandoStatus, setCarregandoStatus] =
    useState(true);

  const [totalExistente, setTotalExistente] =
    useState(0);

  const [erro, setErro] =
    useState("");

  const [sucesso, setSucesso] =
    useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarStatus() {
      setCarregandoStatus(true);

      const supabase = createClient();

      const {
        count,
        error,
      } = await supabase
        .from("lista_aprovados")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("edital_id", editalId);

      if (!ativo) {
        return;
      }

      if (error) {
        setErro(
          `Não foi possível consultar a lista atual: ${error.message}`
        );
        setTotalExistente(0);
      } else {
        setTotalExistente(count ?? 0);
      }

      setCarregandoStatus(false);
    }

    carregarStatus();

    return () => {
      ativo = false;
    };
  }, [editalId]);

  function limparArquivo() {
    setArquivo(null);
    setCandidatos([]);
    setColunas([]);
  }

  async function baixarModelo() {
    setErro("");
    setBaixandoModelo(true);

    try {
      const XLSX = await import("xlsx");

      const planilhaLista = XLSX.utils.aoa_to_sheet([
        [...COLUNAS_ESPERADAS],
      ]);

      planilhaLista["!cols"] = [
        { wch: 20 },
        { wch: 45 },
        { wch: 16 },
        { wch: 14 },
        { wch: 42 },
        { wch: 30 },
      ];

      const planilhaInstrucoes = XLSX.utils.aoa_to_sheet([
        ["Campo", "Obrigatório", "Exemplo", "Orientação"],
        [
          "codigo_vaga",
          "Sim",
          "152415",
          "Código que identifica a vaga. Pode se repetir para vários candidatos.",
        ],
        [
          "cargo",
          "Sim",
          "Assistente Administrativo",
          "Nome do cargo conforme o edital.",
        ],
        [
          "classificacao",
          "Sim",
          "1",
          "Informe somente número inteiro positivo.",
        ],
        [
          "nota",
          "Sim",
          "95,50",
          "Pode utilizar vírgula ou ponto como separador decimal.",
        ],
        [
          "nome",
          "Sim",
          "MARIA DA SILVA",
          "Nome completo do candidato.",
        ],
        [
          "modalidade",
          "Sim",
          "Ampla concorrência",
          "Modalidade de concorrência/candidatura.",
        ],
        [],
        [
          "IMPORTANTE",
          "",
          "",
          "Não altere os nomes nem a ordem das colunas da aba Lista de Aprovados.",
        ],
        [
          "IMPORTANTE",
          "",
          "",
          "A importação utiliza somente a primeira aba do arquivo.",
        ],
      ]);

      planilhaInstrucoes["!cols"] = [
        { wch: 20 },
        { wch: 14 },
        { wch: 30 },
        { wch: 80 },
      ];

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        planilhaLista,
        "Lista de Aprovados"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        planilhaInstrucoes,
        "Instruções"
      );

      XLSX.writeFile(
        workbook,
        `modelo-lista-aprovados-${editalNome.replaceAll("/", "-")}.xlsx`
      );
    } catch (error) {
      console.error(error);
      setErro("Não foi possível gerar o modelo XLSX.");
    } finally {
      setBaixandoModelo(false);
    }
  }

  function processarCSV(
    arquivoSelecionado: File
  ) {
    Papa.parse<Record<string, unknown>>(
      arquivoSelecionado,
      {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: normalizarCabecalho,

        complete: (resultado) => {
          try {
            if (resultado.errors.length > 0) {
              throw new Error(
                `Erro ao ler o CSV: ${resultado.errors[0].message}`
              );
            }

            const cabecalhos =
              (resultado.meta.fields ?? []).map(normalizarCabecalho);

            if (!validarCabecalhos(cabecalhos)) {
              throw new Error(
                "O arquivo deve possuir exatamente, nesta ordem: codigo_vaga, cargo, classificacao, nota, nome, modalidade."
              );
            }

            const linhas = resultado.data
              .map(normalizarLinha)
              .filter(
                (linha) =>
                  linha.codigo_vaga ||
                  linha.cargo ||
                  linha.classificacao ||
                  linha.nota ||
                  linha.nome ||
                  linha.modalidade
              );

            const erroLinhas = validarLinhas(linhas);

            if (erroLinhas) {
              throw new Error(erroLinhas);
            }

            setColunas(cabecalhos);
            setCandidatos(linhas);
            setArquivo(arquivoSelecionado);
          } catch (error) {
            limparArquivo();
            setErro(
              error instanceof Error
                ? error.message
                : "Não foi possível processar o CSV."
            );
          } finally {
            setProcessandoArquivo(false);
          }
        },

        error: (erroPapa) => {
          setProcessandoArquivo(false);
          limparArquivo();
          setErro(
            `Não foi possível ler o CSV: ${erroPapa.message}`
          );
        },
      }
    );
  }

  async function processarXLSX(
    arquivoSelecionado: File
  ) {
    const XLSX = await import("xlsx");
    const buffer = await arquivoSelecionado.arrayBuffer();

    const workbook = XLSX.read(buffer, {
      type: "array",
    });

    if (workbook.SheetNames.length === 0) {
      throw new Error(
        "O arquivo XLSX não possui nenhuma aba."
      );
    }

    const worksheet =
      workbook.Sheets[workbook.SheetNames[0]];

    const matriz = XLSX.utils.sheet_to_json<unknown[]>(
      worksheet,
      {
        header: 1,
        defval: "",
        raw: true,
      }
    ) as unknown[][];

    if (matriz.length === 0) {
      throw new Error(
        "A primeira aba está vazia."
      );
    }

    const cabecalhos = (matriz[0] ?? []).map(
      (valor) => normalizarCabecalho(String(valor ?? ""))
    );

    while (
      cabecalhos.length > 0 &&
      !cabecalhos[cabecalhos.length - 1]
    ) {
      cabecalhos.pop();
    }

    if (!validarCabecalhos(cabecalhos)) {
      throw new Error(
        "A primeira aba deve possuir exatamente, nesta ordem: codigo_vaga, cargo, classificacao, nota, nome, modalidade."
      );
    }

    const linhas = matriz
      .slice(1)
      .map((linha) => {
        const valores = Array.isArray(linha) ? linha : [];

        return normalizarLinha({
          codigo_vaga: valores[0],
          cargo: valores[1],
          classificacao: valores[2],
          nota: valores[3],
          nome: valores[4],
          modalidade: valores[5],
        });
      })
      .filter(
        (linha) =>
          linha.codigo_vaga ||
          linha.cargo ||
          linha.classificacao ||
          linha.nota ||
          linha.nome ||
          linha.modalidade
      );

    const erroLinhas = validarLinhas(linhas);

    if (erroLinhas) {
      throw new Error(erroLinhas);
    }

    setColunas(cabecalhos);
    setCandidatos(linhas);
    setArquivo(arquivoSelecionado);
  }

  async function selecionarArquivo(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setErro("");
    setSucesso("");
    limparArquivo();

    const arquivoSelecionado = event.target.files?.[0];

    if (!arquivoSelecionado) {
      return;
    }

    const limite = 10 * 1024 * 1024;

    if (arquivoSelecionado.size > limite) {
      setErro("O arquivo deve possuir no máximo 10 MB.");
      event.target.value = "";
      return;
    }

    const nomeArquivo = arquivoSelecionado.name.toLowerCase();
    const ehXlsx = nomeArquivo.endsWith(".xlsx");
    const ehCsv = nomeArquivo.endsWith(".csv");

    if (!ehXlsx && !ehCsv) {
      setErro("Formato não permitido. Utilize XLSX ou CSV.");
      event.target.value = "";
      return;
    }

    setProcessandoArquivo(true);

    try {
      if (ehXlsx) {
        await processarXLSX(arquivoSelecionado);
        setProcessandoArquivo(false);
        return;
      }

      processarCSV(arquivoSelecionado);
    } catch (error) {
      setProcessandoArquivo(false);
      limparArquivo();
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível processar o arquivo."
      );
    }
  }

  async function importar() {
    setErro("");
    setSucesso("");

    if (planilhaCruzamentoInformada) {
      setErro(
        "Este edital possui planilha de cruzamento informada. Remova essa fonte e salve o edital antes de utilizar a importação manual."
      );
      return;
    }

    if (totalExistente > 0) {
      setErro(
        `Este edital já possui ${totalExistente} candidato(s) na lista de aprovados. A importação manual não substitui listas existentes.`
      );
      return;
    }

    if (!arquivo || candidatos.length === 0) {
      setErro(
        "Selecione e valide uma planilha XLSX ou arquivo CSV."
      );
      return;
    }

    setSalvando(true);

    try {
      const supabase = createClient();

      const {
        data,
        error,
      } = await supabase.rpc(
        "importar_lista_aprovados_existente",
        {
          p_edital_id: editalId,
          p_colunas: colunas,
          p_candidatos: candidatos,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const resultado = Array.isArray(data) ? data[0] : data;
      const quantidade =
        resultado?.quantidade_importada ?? candidatos.length;

      setTotalExistente(quantidade);
      limparArquivo();
      setSucesso(
        `Lista importada com sucesso. ${quantidade} candidato${
          quantidade === 1 ? "" : "s"
        } importado${quantidade === 1 ? "" : "s"}.`
      );

      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível importar a lista."
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregandoStatus) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h4 className="text-sm font-semibold text-slate-900">
          Lista de aprovados
        </h4>
        <p className="mt-2 text-sm text-slate-500">
          Verificando a situação atual da lista...
        </p>
      </div>
    );
  }

  if (planilhaCruzamentoInformada) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h4 className="text-sm font-semibold text-blue-900">
          Lista de aprovados
        </h4>
        <p className="mt-2 text-sm leading-6 text-blue-700">
          Este edital possui uma planilha de cruzamento configurada. A lista final deve ser alimentada pelo fluxo automático, por isso o anexo manual fica bloqueado.
        </p>
      </div>
    );
  }

  if (totalExistente > 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <h4 className="text-sm font-semibold text-emerald-900">
          Lista de aprovados
        </h4>
        <p className="mt-2 text-sm leading-6 text-emerald-700">
          Este edital já possui {totalExistente} candidato{totalExistente === 1 ? "" : "s"} na lista de aprovados. Por segurança, a importação manual não substitui uma lista já existente.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            Lista de aprovados
          </h4>

          <p className="mt-1 text-xs leading-5 text-slate-600">
            Como não há planilha de cruzamento informada, você pode importar a lista final manualmente em XLSX ou CSV.
          </p>
        </div>

        <button
          type="button"
          onClick={baixarModelo}
          disabled={baixandoModelo || salvando}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {baixandoModelo ? "Gerando..." : "Baixar modelo"}
        </button>
      </div>

      {erro && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {sucesso}
        </div>
      )}

      <div className="mt-4">
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={selecionarArquivo}
          disabled={processandoArquivo || salvando}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
        />
      </div>

      {processandoArquivo && (
        <p className="mt-3 text-sm text-slate-500">
          Validando arquivo...
        </p>
      )}

      {arquivo && candidatos.length > 0 && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-white px-4 py-3">
          <p className="text-sm font-medium text-emerald-700">
            Arquivo validado
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {arquivo.name} · {candidatos.length} candidato{candidatos.length === 1 ? "" : "s"}
          </p>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={importar}
          disabled={
            salvando ||
            processandoArquivo ||
            !arquivo ||
            candidatos.length === 0
          }
          className="rounded-lg bg-[#094780] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {salvando ? "Importando..." : "Importar lista"}
        </button>
      </div>
    </div>
  );
}

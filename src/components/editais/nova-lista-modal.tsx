"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";

import { createClient } from "@/lib/supabase/client";


// ============================================================
// CONFIGURAÇÕES
// ============================================================

const COLUNAS_ESPERADAS = [
  "cargo",
  "classificacao",
  "nota",
  "nome",
] as const;


const PROCESSOS_SELETIVOS = [
  "Saúde Indígena",
  "Sede",
  "CCE",
  "Saúde nas Fronteiras",
  "Escritórios Regionais/Distritais",
  "MFC",
  "Projeto Agora Tem Especialistas Caminhoneiros",
] as const;


// ============================================================
// TIPOS
// ============================================================

type LinhaCsv = {
  cargo?: string;
  classificacao?: string;
  nota?: string;
  nome?: string;
  __parsed_extra?: string[];
};


type CandidatoImportacao = {
  cargo: string;
  classificacao: number;
  nota: number;
  nome: string;
};


// ============================================================
// FUNÇÃO PARA FORMATAR PRAZO
// ============================================================
function normalizarCabecalho(
  texto: string
) {
  return texto
    .replace(/^\uFEFF/, "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatarPrazoValidade(
  anos: number,
  meses: number
) {
  const partes: string[] = [];

  if (anos > 0) {
    partes.push(
      `${anos} ${anos === 1 ? "ano" : "anos"}`
    );
  }

  if (meses > 0) {
    partes.push(
      `${meses} ${meses === 1 ? "mês" : "meses"}`
    );
  }

  return partes.join(" e ");
}


// ============================================================
// COMPONENTE
// ============================================================

export function NovaListaModal() {
  const router = useRouter();

  // ==========================================================
  // CONTROLE DO MODAL
  // ==========================================================

  const [aberto, setAberto] = useState(false);

  const [importando, setImportando] =
    useState(false);

  const [erro, setErro] =
    useState("");


  // ==========================================================
  // DADOS DO EDITAL
  // ==========================================================

  const [
    processoSeletivo,
    setProcessoSeletivo,
  ] = useState("");

  const [edital, setEdital] =
    useState("");

  const [dataInicio, setDataInicio] =
    useState("");

  const [dataFim, setDataFim] =
    useState("");

  const [prazoAnos, setPrazoAnos] =
    useState(0);

  const [prazoMeses, setPrazoMeses] =
    useState(0);

  const [prorrogavel, setProrrogavel] =
    useState(false);

  const [arquivo, setArquivo] =
    useState<File | null>(null);


  // ==========================================================
  // LIMPAR FORMULÁRIO
  // ==========================================================

  function limparFormulario() {
    setProcessoSeletivo("");
    setEdital("");
    setDataInicio("");
    setDataFim("");

    setPrazoAnos(0);
    setPrazoMeses(0);

    setProrrogavel(false);

    setArquivo(null);

    setErro("");
  }


  // ==========================================================
  // FECHAR MODAL
  // ==========================================================

  function fechar() {
    if (importando) {
      return;
    }

    setAberto(false);

    limparFormulario();
  }


  // ==========================================================
  // LEITURA E VALIDAÇÃO DO CSV
  // ==========================================================

  function lerCsv(
    arquivoSelecionado: File
  ): Promise<{
    colunas: string[];
    candidatos: CandidatoImportacao[];
  }> {

    return new Promise(
      (resolve, reject) => {

        Papa.parse<LinhaCsv>(
          arquivoSelecionado,
          {
            header: true,

            skipEmptyLines: "greedy",

            transformHeader(header) {
              return normalizarCabecalho(header);
            },

            complete(resultado) {

              try {

                // =============================================
                // ERROS DE LEITURA
                // =============================================

                if (
                  resultado.errors.length > 0
                ) {

                  const primeiroErro =
                    resultado.errors[0];

                  throw new Error(
                    `Erro ao ler o CSV: ${primeiroErro.message}`
                  );
                }


                // =============================================
                // VALIDAR CABEÇALHO
                // =============================================

                const colunas =
                  resultado.meta.fields ?? [];


                const colunasCorretas =
                  colunas.length ===
                    COLUNAS_ESPERADAS.length &&

                  COLUNAS_ESPERADAS.every(
                    (coluna, indice) =>
                      colunas[indice] === coluna
                  );


                if (!colunasCorretas) {

                  throw new Error(
                    "As colunas do CSV devem estar exatamente nesta ordem: cargo, classificacao, nota, nome."
                  );
                }


                // =============================================
                // VALIDAR SE EXISTEM DADOS
                // =============================================

                if (
                  resultado.data.length === 0
                ) {

                  throw new Error(
                    "O arquivo CSV não possui candidatos."
                  );
                }


                // =============================================
                // VALIDAR LINHAS
                // =============================================

                const candidatos =
                  resultado.data.map(
                    (linha, indice) => {

                      // +2 porque:
                      // linha 1 = cabeçalho
                      // primeira pessoa = linha 2
                      const numeroLinha =
                        indice + 2;


                      // =======================================
                      // COLUNAS EXTRAS
                      // =======================================

                      if (
                        linha.__parsed_extra &&
                        linha.__parsed_extra.length > 0
                      ) {

                        throw new Error(
                          `Linha ${numeroLinha}: existem colunas adicionais no arquivo.`
                        );
                      }


                      // =======================================
                      // OBTER VALORES
                      // =======================================

                      const cargo =
                        String(
                          linha.cargo ?? ""
                        ).trim();


                      const classificacaoTexto =
                        String(
                          linha.classificacao ?? ""
                        ).trim();


                      const notaTexto =
                        String(
                          linha.nota ?? ""
                        ).trim();


                      const nome =
                        String(
                          linha.nome ?? ""
                        ).trim();


                      // =======================================
                      // VALIDAR CARGO
                      // =======================================

                      if (!cargo) {

                        throw new Error(
                          `Linha ${numeroLinha}: o cargo está vazio.`
                        );
                      }


                      // =======================================
                      // VALIDAR NOME
                      // =======================================

                      if (!nome) {

                        throw new Error(
                          `Linha ${numeroLinha}: o nome está vazio.`
                        );
                      }


                      // =======================================
                      // VALIDAR CLASSIFICAÇÃO
                      // =======================================

                      if (
                        !/^[1-9][0-9]*$/.test(
                          classificacaoTexto
                        )
                      ) {

                        throw new Error(
                          `Linha ${numeroLinha}: classificação inválida.`
                        );
                      }


                      // =======================================
                      // VALIDAR NOTA
                      // Aceita:
                      // 98
                      // 98.5
                      // 98.50
                      // 98,5
                      // 98,50
                      // =======================================

                      if (
                        !/^[0-9]+(?:[.,][0-9]+)?$/.test(
                          notaTexto
                        )
                      ) {

                        throw new Error(
                          `Linha ${numeroLinha}: nota inválida.`
                        );
                      }


                      // =======================================
                      // CONVERTER VALORES
                      // =======================================

                      const classificacao =
                        Number(
                          classificacaoTexto
                        );


                      const nota =
                        Number(
                          notaTexto.replace(
                            ",",
                            "."
                          )
                        );


                      // =======================================
                      // VALIDAÇÃO FINAL DA CLASSIFICAÇÃO
                      // =======================================

                      if (
                        !Number.isSafeInteger(
                          classificacao
                        ) ||
                        classificacao <= 0
                      ) {

                        throw new Error(
                          `Linha ${numeroLinha}: classificação inválida.`
                        );
                      }


                      // =======================================
                      // VALIDAÇÃO FINAL DA NOTA
                      // =======================================

                      if (
                        !Number.isFinite(nota) ||
                        nota < 0
                      ) {

                        throw new Error(
                          `Linha ${numeroLinha}: nota inválida.`
                        );
                      }


                      // =======================================
                      // LINHA VÁLIDA
                      // =======================================

                      return {
                        cargo,
                        classificacao,
                        nota,
                        nome,
                      };

                    }
                  );


                // =============================================
                // CSV VÁLIDO
                // =============================================

                resolve({
                  colunas: [
                    ...COLUNAS_ESPERADAS,
                  ],

                  candidatos,
                });

              } catch (error) {

                reject(error);

              }
            },


            error(error) {

              reject(error);

            },
          }
        );
      }
    );
  }


  // ==========================================================
  // IMPORTAR LISTA
  // ==========================================================

  async function importarLista(
    event: React.FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();

    setErro("");


    // ========================================================
    // VALIDAR PROCESSO SELETIVO
    // ========================================================

    if (!processoSeletivo) {

      setErro(
        "Selecione o processo seletivo."
      );

      return;
    }


    // ========================================================
    // VALIDAR EDITAL
    // ========================================================

    if (!edital.trim()) {

      setErro(
        "Informe o nome do edital."
      );

      return;
    }


    // ========================================================
    // VALIDAR DATAS
    // ========================================================

    if (!dataInicio || !dataFim) {

      setErro(
        "Informe a data de início e a data de fim."
      );

      return;
    }


    if (
      dataFim < dataInicio
    ) {

      setErro(
        "A data de fim não pode ser anterior à data de início."
      );

      return;
    }


    // ========================================================
    // VALIDAR PRAZO
    // ========================================================

    if (
      prazoAnos === 0 &&
      prazoMeses === 0
    ) {

      setErro(
        "Informe o prazo de validade do edital."
      );

      return;
    }


    const prazoValidade =
      formatarPrazoValidade(
        prazoAnos,
        prazoMeses
      );


    // ========================================================
    // VALIDAR ARQUIVO
    // ========================================================

    if (!arquivo) {

      setErro(
        "Selecione um arquivo CSV."
      );

      return;
    }


    if (
      !arquivo.name
        .toLowerCase()
        .endsWith(".csv")
    ) {

      setErro(
        "O arquivo selecionado precisa estar no formato CSV."
      );

      return;
    }


    // ========================================================
    // IMPORTAR
    // ========================================================

    try {

      setImportando(true);


      // ======================================================
      // LER CSV
      // ======================================================

      const {
        colunas,
        candidatos,
      } = await lerCsv(
        arquivo
      );


      // ======================================================
      // CONECTAR SUPABASE
      // ======================================================

      const supabase =
        createClient();


      // ======================================================
      // EXECUTAR RPC TRANSACIONAL
      // ======================================================

      const {
        data,
        error,
      } = await supabase.rpc(
        "importar_lista_csv",
        {

          p_processo_seletivo:
            processoSeletivo,

          p_edital:
            edital.trim(),

          p_data_inicio:
            dataInicio,

          p_data_fim:
            dataFim,

          p_prazo_validade:
            prazoValidade,

          p_prorrogavel:
            prorrogavel,

          p_colunas:
            colunas,

          p_candidatos:
            candidatos,
        }
      );


      // ======================================================
      // ERRO DO SUPABASE
      // ======================================================

      if (error) {

        throw new Error(
          error.message
        );
      }


      // ======================================================
      // RESULTADO
      // ======================================================

      const resultado =
        data?.[0];


      if (!resultado) {

        throw new Error(
          "O banco não retornou o resultado da importação."
        );
      }


      // ======================================================
      // SUCESSO
      // ======================================================

      setAberto(false);

      limparFormulario();


      window.alert(
        `Lista importada com sucesso!\n\n${resultado.candidatos_importados} candidato(s) importado(s).`
      );


      router.refresh();

    } catch (error) {

      console.error(error);


      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível importar a lista."
      );

    } finally {

      setImportando(false);

    }
  }


  // ==========================================================
  // INTERFACE
  // ==========================================================

  return (
    <>
      {/* =====================================================
          BOTÃO NOVA LISTA
      ====================================================== */}

      <button
        type="button"
        onClick={() =>
          setAberto(true)
        }
        className="rounded-lg bg-[#094780] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
      >
        Nova lista
      </button>


      {/* =====================================================
          MODAL
      ====================================================== */}

      {aberto && (

        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">

          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">


            {/* =================================================
                CABEÇALHO
            ================================================= */}

            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">

              <div>

                <h3 className="text-lg font-semibold text-slate-900">
                  Importar nova lista
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Cadastre o edital e importe os candidatos.
                </p>

              </div>


              <button
                type="button"
                onClick={fechar}
                disabled={importando}
                className="text-2xl leading-none text-slate-400 hover:text-slate-700 disabled:opacity-50"
                aria-label="Fechar"
              >
                ×
              </button>

            </div>


            {/* =================================================
                FORMULÁRIO
            ================================================= */}

            <form
              onSubmit={
                importarLista
              }
              className="p-6"
            >

              <div className="grid gap-5 md:grid-cols-2">


                {/* =============================================
                    PROCESSO SELETIVO
                ============================================= */}

                <div className="md:col-span-2">

                  <label
                    htmlFor="processo-seletivo"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Processo Seletivo *
                  </label>


                  <select
                    id="processo-seletivo"
                    required
                    value={
                      processoSeletivo
                    }
                    onChange={(event) =>
                      setProcessoSeletivo(
                        event.target.value
                      )
                    }
                    disabled={
                      importando
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#094780] disabled:bg-slate-100"
                  >

                    <option value="">
                      Selecione o processo seletivo
                    </option>


                    {PROCESSOS_SELETIVOS.map(
                      (processo) => (

                        <option
                          key={processo}
                          value={processo}
                        >
                          {processo}
                        </option>

                      )
                    )}

                  </select>

                </div>


                {/* =============================================
                    EDITAL
                ============================================= */}

                <div className="md:col-span-2">

                  <label
                    htmlFor="nome-edital"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Nome do Edital *
                  </label>


                  <input
                    id="nome-edital"
                    type="text"
                    required
                    value={edital}
                    onChange={(event) =>
                      setEdital(
                        event.target.value
                      )
                    }
                    disabled={
                      importando
                    }
                    placeholder="Ex.: Edital nº 01/2026"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#094780] disabled:bg-slate-100"
                  />

                </div>


                {/* =============================================
                    DATA INÍCIO
                ============================================= */}

                <div>

                  <label
                    htmlFor="data-inicio"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Data Início *
                  </label>


                  <input
                    id="data-inicio"
                    type="date"
                    required
                    value={
                      dataInicio
                    }
                    onChange={(event) =>
                      setDataInicio(
                        event.target.value
                      )
                    }
                    disabled={
                      importando
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#094780] disabled:bg-slate-100"
                  />

                </div>


                {/* =============================================
                    DATA FIM
                ============================================= */}

                <div>

                  <label
                    htmlFor="data-fim"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Data Fim *
                  </label>


                  <input
                    id="data-fim"
                    type="date"
                    required
                    value={
                      dataFim
                    }
                    onChange={(event) =>
                      setDataFim(
                        event.target.value
                      )
                    }
                    disabled={
                      importando
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#094780] disabled:bg-slate-100"
                  />

                </div>


                {/* =============================================
                    PRAZO DE VALIDADE
                ============================================= */}

                <div>

                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Prazo de Validade *
                  </label>


                  <div className="grid grid-cols-2 gap-3">


                    {/* ANOS */}

                    <div>

                      <label
                        htmlFor="prazo-anos"
                        className="mb-1 block text-xs text-slate-500"
                      >
                        Anos
                      </label>


                      <div className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-[#094780]">

                        <input
                          id="prazo-anos"
                          type="number"
                          min="0"
                          max="99"
                          step="1"
                          value={
                            prazoAnos
                          }
                          onChange={(event) => {

                            const valor =
                              Number(
                                event.target.value
                              );

                            setPrazoAnos(
                              Math.min(
                                99,
                                Math.max(
                                  0,
                                  valor
                                )
                              )
                            );

                          }}
                          disabled={
                            importando
                          }
                          className="min-w-0 flex-1 rounded-l-lg px-3 py-2.5 text-sm outline-none disabled:bg-slate-100"
                        />


                        <span className="pr-3 text-sm text-slate-500">
                          {prazoAnos === 1
                            ? "ano"
                            : "anos"}
                        </span>

                      </div>

                    </div>


                    {/* MESES */}

                    <div>

                      <label
                        htmlFor="prazo-meses"
                        className="mb-1 block text-xs text-slate-500"
                      >
                        Meses
                      </label>


                      <div className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-[#094780]">

                        <input
                          id="prazo-meses"
                          type="number"
                          min="0"
                          max="11"
                          step="1"
                          value={
                            prazoMeses
                          }
                          onChange={(event) => {

                            const valor =
                              Number(
                                event.target.value
                              );

                            setPrazoMeses(
                              Math.min(
                                11,
                                Math.max(
                                  0,
                                  valor
                                )
                              )
                            );

                          }}
                          disabled={
                            importando
                          }
                          className="min-w-0 flex-1 rounded-l-lg px-3 py-2.5 text-sm outline-none disabled:bg-slate-100"
                        />


                        <span className="pr-3 text-sm text-slate-500">
                          {prazoMeses === 1
                            ? "mês"
                            : "meses"}
                        </span>

                      </div>

                    </div>

                  </div>


                  {/* PREVIEW DO PRAZO */}

                  {(prazoAnos > 0 ||
                    prazoMeses > 0) && (

                    <p className="mt-2 text-xs text-slate-500">

                      Prazo informado:{" "}

                      <span className="font-medium text-slate-700">

                        {formatarPrazoValidade(
                          prazoAnos,
                          prazoMeses
                        )}

                      </span>

                    </p>

                  )}

                </div>


                {/* =============================================
                    PRORROGÁVEL
                ============================================= */}

                <div>

                  <label
                    htmlFor="prorrogavel"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Prorrogável *
                  </label>


                  <select
                    id="prorrogavel"
                    value={
                      prorrogavel
                        ? "sim"
                        : "nao"
                    }
                    onChange={(event) =>
                      setProrrogavel(
                        event.target.value ===
                          "sim"
                      )
                    }
                    disabled={
                      importando
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#094780] disabled:bg-slate-100"
                  >

                    <option value="nao">
                      Não
                    </option>

                    <option value="sim">
                      Sim
                    </option>

                  </select>

                </div>


                {/* =============================================
                    CSV
                ============================================= */}

                <div className="md:col-span-2">

                  <label
                    htmlFor="arquivo-csv"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Arquivo CSV *
                  </label>


                  <input
                    key={
                      arquivo
                        ? arquivo.name
                        : "sem-arquivo"
                    }
                    id="arquivo-csv"
                    type="file"
                    accept=".csv,text/csv"
                    required
                    disabled={
                      importando
                    }
                    onChange={(event) =>
                      setArquivo(
                        event.target.files?.[0] ??
                          null
                      )
                    }
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 disabled:bg-slate-100"
                  />


                  {/* FORMATO ESPERADO */}

                  <div className="mt-3 rounded-lg bg-slate-50 p-3">

                    <p className="text-xs font-medium text-slate-700">
                      Formato obrigatório:
                    </p>


                    <code className="mt-1 block text-xs text-slate-600">
                      cargo, classificacao, nota, nome
                    </code>


                    <p className="mt-2 text-xs text-slate-500">
                      Não altere o nome nem a ordem das colunas.
                    </p>

                  </div>

                </div>

              </div>


              {/* =================================================
                  ERRO
              ================================================= */}

              {erro && (

                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {erro}
                </div>

              )}


              {/* =================================================
                  BOTÕES
              ================================================= */}

              <div className="mt-7 flex justify-end gap-3">

                <button
                  type="button"
                  onClick={fechar}
                  disabled={
                    importando
                  }
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>


                <button
                  type="submit"
                  disabled={
                    importando
                  }
                  className="rounded-lg bg-[#094780] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >

                  {importando
                    ? "Importando..."
                    : "Importar lista"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </>
  );
}
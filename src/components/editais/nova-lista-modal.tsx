"use client";

import {
  ChangeEvent,
  FormEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Papa from "papaparse";

import {
  createClient,
} from "@/lib/supabase/client";


const PROCESSOS_SELETIVOS = [
  "Saúde Indígena",
  "Sede",
  "CCE",
  "Saúde nas Fronteiras",
  "Escritórios Regionais/Distritais",
  "MFC",
  "Projeto Agora Tem Especialistas Caminhoneiros",
];


const COLUNAS_ESPERADAS = [
  "codigo_vaga",
  "cargo",
  "classificacao",
  "nota",
  "nome",
  "modalidade",
];


type LinhaImportacao = {
  codigo_vaga: string;
  cargo: string;
  classificacao: string;
  nota: string;
  nome: string;
  modalidade: string;
};


// ============================================================
// TEXTO
// ============================================================

function limparTexto(
  valor: unknown
) {
  return String(
    valor ?? ""
  )
    .trim()
    .replace(
      /^["']+|["']+$/g,
      ""
    )
    .trim();
}


// ============================================================
// CABEÇALHO
// ============================================================

function normalizarCabecalho(
  texto: string
) {
  let resultado =
    String(
      texto ?? ""
    )
      .replace(
        /^\uFEFF/,
        ""
      )
      .trim()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "_"
      )
      .replace(
        /^_+|_+$/g,
        "" 
      );


  // ----------------------------------------------------------
  // ALGUNS NOMES ALTERNATIVOS ACEITOS
  // ----------------------------------------------------------

  if (
    resultado ===
      "codigo_da_vaga" ||
    resultado ===
      "cod_vaga" ||
    resultado ===
      "cod_da_vaga"
  ) {
    resultado =
      "codigo_vaga";
  }


  if (
    resultado ===
    "modalidade_de_candidatura"
  ) {
    resultado =
      "modalidade";
  }


  return resultado;
}


// ============================================================
// PRAZO
// ============================================================

function formatarPrazoValidade(
  anos: number,
  meses: number
) {
  const partes:
    string[] = [];


  if (anos > 0) {
    partes.push(
      `${anos} ${
        anos === 1
          ? "ano"
          : "anos"
      }`
    );
  }


  if (meses > 0) {
    partes.push(
      `${meses} ${
        meses === 1
          ? "mês"
          : "meses"
      }`
    );
  }


  return partes.join(
    " e "
  );
}


// ============================================================
// VALIDAÇÃO DE CABEÇALHOS
// ============================================================

function validarCabecalhos(
  cabecalhos: string[]
) {
  return (
    cabecalhos.length ===
      COLUNAS_ESPERADAS.length &&
    cabecalhos.every(
      (
        coluna,
        indice
      ) =>
        coluna ===
        COLUNAS_ESPERADAS[
          indice
        ]
    )
  );
}


// ============================================================
// NORMALIZAR LINHA
// ============================================================

function normalizarLinha(
  linha:
    Record<string, unknown>
): LinhaImportacao {
  return {
    codigo_vaga:
      limparTexto(
        linha.codigo_vaga
      ),

    cargo:
      limparTexto(
        linha.cargo
      ),

    classificacao:
      limparTexto(
        linha.classificacao
      ),

    nota:
      limparTexto(
        linha.nota
      ),

    nome:
      limparTexto(
        linha.nome
      ),

    modalidade:
      limparTexto(
        linha.modalidade
      ),
  };
}


// ============================================================
// VALIDAR CONTEÚDO
// ============================================================

function validarLinhas(
  linhas:
    LinhaImportacao[]
) {
  if (
    linhas.length === 0
  ) {
    return "O arquivo não possui candidatos.";
  }


  for (
    let indice = 0;
    indice <
    linhas.length;
    indice++
  ) {
    const linha =
      linhas[indice];

    // A linha 1 é o cabeçalho.
    const numeroLinha =
      indice + 2;


    if (
      !linha.codigo_vaga
    ) {
      return `Linha ${numeroLinha}: código da vaga não informado.`;
    }


    if (
      !linha.cargo
    ) {
      return `Linha ${numeroLinha}: cargo não informado.`;
    }


    if (
      !linha.classificacao
    ) {
      return `Linha ${numeroLinha}: classificação não informada.`;
    }


    if (
      !/^[0-9]+$/.test(
        linha.classificacao
      ) ||
      Number(
        linha.classificacao
      ) <= 0
    ) {
      return `Linha ${numeroLinha}: classificação inválida.`;
    }


    if (
      !linha.nota
    ) {
      return `Linha ${numeroLinha}: nota não informada.`;
    }


    const nota =
      Number(
        linha.nota.replace(
          ",",
          "."
        )
      );


    if (
      !Number.isFinite(
        nota
      ) ||
      nota < 0
    ) {
      return `Linha ${numeroLinha}: nota inválida.`;
    }


    if (
      !linha.nome
    ) {
      return `Linha ${numeroLinha}: nome não informado.`;
    }


    if (
      !linha.modalidade
    ) {
      return `Linha ${numeroLinha}: modalidade não informada.`;
    }
  }


  return null;
}


// ============================================================
// COMPONENTE
// ============================================================

export function NovaListaModal() {
  const router =
    useRouter();


  const [
    aberto,
    setAberto,
  ] = useState(false);


  const [
    processoSeletivo,
    setProcessoSeletivo,
  ] = useState("");


  const [
    edital,
    setEdital,
  ] = useState("");


  const [
    dataInicio,
    setDataInicio,
  ] = useState("");


  const [
    dataFim,
    setDataFim,
  ] = useState("");


  const [
    prazoAnos,
    setPrazoAnos,
  ] = useState(0);


  const [
    prazoMeses,
    setPrazoMeses,
  ] = useState(0);


  const [
    prorrogavel,
    setProrrogavel,
  ] = useState(false);


  const [
    arquivo,
    setArquivo,
  ] = useState<
    File | null
  >(null);


  const [
    candidatos,
    setCandidatos,
  ] = useState<
    LinhaImportacao[]
  >([]);


  const [
    colunas,
    setColunas,
  ] = useState<
    string[]
  >([]);


  const [
    processandoArquivo,
    setProcessandoArquivo,
  ] = useState(false);


  const [
    salvando,
    setSalvando,
  ] = useState(false);


  const [
    baixandoModelo,
    setBaixandoModelo,
  ] = useState(false);


  const [
    erro,
    setErro,
  ] = useState("");


  const [
    sucesso,
    setSucesso,
  ] = useState("");


  // ==========================================================
  // BAIXAR MODELO XLSX
  // ==========================================================

  async function baixarModelo() {
    setErro("");
    setBaixandoModelo(
      true
    );


    try {
      /*
       * XLSX é carregado somente quando necessário.
       * Isso evita aumentar o carregamento inicial da página.
       */
      const XLSX =
        await import(
          "xlsx"
        );


      const planilhaLista =
        XLSX.utils.aoa_to_sheet([
          [
            "codigo_vaga",
            "cargo",
            "classificacao",
            "nota",
            "nome",
            "modalidade",
          ],
        ]);


      planilhaLista[
        "!cols"
      ] = [
        {
          wch: 20,
        },
        {
          wch: 45,
        },
        {
          wch: 16,
        },
        {
          wch: 14,
        },
        {
          wch: 42,
        },
        {
          wch: 30,
        },
      ];


      const planilhaInstrucoes =
        XLSX.utils.aoa_to_sheet([
          [
            "Campo",
            "Obrigatório",
            "Exemplo",
            "Orientação",
          ],

          [
            "codigo_vaga",
            "Sim",
            "VG-001",
            "Código que identifica a vaga. Pode se repetir para vários candidatos.",
          ],

          [
            "cargo",
            "Sim",
            "ENFERMEIRO",
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
            "Ampla Concorrência",
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

          [
            "IMPORTANTE",
            "",
            "",
            "O código da vaga é tratado como texto. Se possuir zeros à esquerda, configure a célula como Texto no Excel.",
          ],
        ]);


      planilhaInstrucoes[
        "!cols"
      ] = [
        {
          wch: 20,
        },
        {
          wch: 14,
        },
        {
          wch: 30,
        },
        {
          wch: 80,
        },
      ];


      const workbook =
        XLSX.utils.book_new();


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
        "modelo-importacao-lista-aprovados.xlsx"
      );

    } catch (error) {
      console.error(
        error
      );

      setErro(
        "Não foi possível gerar o modelo XLSX."
      );
    } finally {
      setBaixandoModelo(
        false
      );
    }
  }


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
    setCandidatos([]);
    setColunas([]);

    setErro("");
  }


  function fechar() {
    if (
      salvando ||
      processandoArquivo
    ) {
      return;
    }


    setAberto(
      false
    );

    limparFormulario();
  }


  // ==========================================================
  // PROCESSAR CSV
  // ==========================================================

  function processarCSV(
    arquivoSelecionado:
      File
  ) {
    Papa.parse<
      Record<
        string,
        unknown
      >
    >(
      arquivoSelecionado,
      {
        header:
          true,

        skipEmptyLines:
          "greedy",

        transformHeader:
          normalizarCabecalho,


        complete:
          (
            resultado
          ) => {
            try {
              if (
                resultado.errors
                  .length >
                0
              ) {
                throw new Error(
                  `Erro ao ler o CSV: ${
                    resultado
                      .errors[0]
                      .message
                  }`
                );
              }


              const cabecalhos =
                (
                  resultado.meta
                    .fields ??
                  []
                ).map(
                  normalizarCabecalho
                );


              if (
                !validarCabecalhos(
                  cabecalhos
                )
              ) {
                throw new Error(
                  "O arquivo deve possuir exatamente, nesta ordem: codigo_vaga, cargo, classificacao, nota, nome, modalidade."
                );
              }


              const linhas =
                resultado.data
                  .map(
                    normalizarLinha
                  )
                  .filter(
                    (
                      linha
                    ) =>
                      linha.codigo_vaga ||
                      linha.cargo ||
                      linha.classificacao ||
                      linha.nota ||
                      linha.nome ||
                      linha.modalidade
                  );


              const erroLinhas =
                validarLinhas(
                  linhas
                );


              if (
                erroLinhas
              ) {
                throw new Error(
                  erroLinhas
                );
              }


              setColunas(
                cabecalhos
              );

              setCandidatos(
                linhas
              );

              setArquivo(
                arquivoSelecionado
              );

            } catch (error) {
              setArquivo(
                null
              );

              setCandidatos(
                []
              );

              setColunas(
                []
              );


              setErro(
                error instanceof
                Error
                  ? error.message
                  : "Não foi possível processar o CSV."
              );

            } finally {
              setProcessandoArquivo(
                false
              );
            }
          },


        error:
          (
            erroPapa
          ) => {
            setProcessandoArquivo(
              false
            );

            setErro(
              `Não foi possível ler o CSV: ${erroPapa.message}`
            );
          },
      }
    );
  }


  // ==========================================================
  // PROCESSAR XLSX
  // ==========================================================

  async function processarXLSX(
    arquivoSelecionado:
      File
  ) {
    const XLSX =
      await import(
        "xlsx"
      );


    const buffer =
      await arquivoSelecionado.arrayBuffer();


    const workbook =
      XLSX.read(
        buffer,
        {
          type:
            "array",
        }
      );


    if (
      workbook.SheetNames
        .length === 0
    ) {
      throw new Error(
        "O arquivo XLSX não possui nenhuma aba."
      );
    }


    const nomePrimeiraAba =
      workbook.SheetNames[
        0
      ];


    const worksheet =
      workbook.Sheets[
        nomePrimeiraAba
      ];


    const matriz =
      XLSX.utils.sheet_to_json<
        unknown[]
      >(
        worksheet,
        {
          header:
            1,

          defval:
            "",

          raw:
            true,
        }
      ) as unknown[][];


    if (
      matriz.length ===
      0
    ) {
      throw new Error(
        "A primeira aba está vazia."
      );
    }


    const primeiraLinha =
      matriz[0] ?? [];


    const cabecalhos =
      primeiraLinha.map(
        (
          valor
        ) =>
          normalizarCabecalho(
            String(
              valor ??
                ""
            )
          )
      );


    /*
     * Remove apenas colunas vazias que possam existir
     * depois do último cabeçalho real.
     */
    while (
      cabecalhos.length >
        0 &&
      !cabecalhos[
        cabecalhos.length -
          1
      ]
    ) {
      cabecalhos.pop();
    }


    if (
      !validarCabecalhos(
        cabecalhos
      )
    ) {
      throw new Error(
        "A primeira aba deve possuir exatamente, nesta ordem: codigo_vaga, cargo, classificacao, nota, nome, modalidade."
      );
    }


    const linhas =
      matriz
        .slice(1)
        .map(
          (
            linha
          ) => {
            const valores =
              Array.isArray(
                linha
              )
                ? linha
                : [];


            return normalizarLinha(
              {
                codigo_vaga:
                  valores[0],

                cargo:
                  valores[1],

                classificacao:
                  valores[2],

                nota:
                  valores[3],

                nome:
                  valores[4],

                modalidade:
                  valores[5],
              }
            );
          }
        )
        .filter(
          (
            linha
          ) =>
            linha.codigo_vaga ||
            linha.cargo ||
            linha.classificacao ||
            linha.nota ||
            linha.nome ||
            linha.modalidade
        );


    const erroLinhas =
      validarLinhas(
        linhas
      );


    if (
      erroLinhas
    ) {
      throw new Error(
        erroLinhas
      );
    }


    setColunas(
      cabecalhos
    );

    setCandidatos(
      linhas
    );

    setArquivo(
      arquivoSelecionado
    );
  }


  // ==========================================================
  // SELECIONAR ARQUIVO
  // ==========================================================

  async function selecionarArquivo(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    setErro("");
    setSucesso("");

    setArquivo(null);
    setCandidatos([]);
    setColunas([]);


    const arquivoSelecionado =
      event.target.files?.[
        0
      ];


    if (
      !arquivoSelecionado
    ) {
      return;
    }


    // 10 MB
    const limite =
      10 *
      1024 *
      1024;


    if (
      arquivoSelecionado.size >
      limite
    ) {
      setErro(
        "O arquivo deve possuir no máximo 10 MB."
      );

      event.target.value =
        "";

      return;
    }


    const nomeArquivo =
      arquivoSelecionado.name
        .toLowerCase();


    const ehXlsx =
      nomeArquivo.endsWith(
        ".xlsx"
      );


    const ehCsv =
      nomeArquivo.endsWith(
        ".csv"
      );


    if (
      !ehXlsx &&
      !ehCsv
    ) {
      setErro(
        "Formato não permitido. Utilize XLSX ou CSV."
      );

      event.target.value =
        "";

      return;
    }


    setProcessandoArquivo(
      true
    );


    try {
      if (ehXlsx) {
        await processarXLSX(
          arquivoSelecionado
        );

        setProcessandoArquivo(
          false
        );

        return;
      }


      processarCSV(
        arquivoSelecionado
      );

    } catch (error) {
      setProcessandoArquivo(
        false
      );

      setArquivo(
        null
      );

      setCandidatos(
        []
      );

      setColunas(
        []
      );


      setErro(
        error instanceof
        Error
          ? error.message
          : "Não foi possível processar o arquivo."
      );
    }
  }


  // ==========================================================
  // IMPORTAR
  // ==========================================================

  async function importar(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErro("");
    setSucesso("");


    if (
      !processoSeletivo
    ) {
      setErro(
        "Selecione o processo seletivo."
      );

      return;
    }


    if (
      !edital.trim()
    ) {
      setErro(
        "Informe o edital."
      );

      return;
    }


    if (
      dataInicio &&
      dataFim &&
      dataFim <
        dataInicio
    ) {
      setErro(
        "A data final não pode ser anterior à data inicial."
      );

      return;
    }


    if (
      prazoAnos === 0 &&
      prazoMeses === 0
    ) {
      setErro(
        "Informe pelo menos 1 mês de prazo de validade."
      );

      return;
    }


    if (
      prazoAnos < 0 ||
      prazoAnos > 99 ||
      prazoMeses < 0 ||
      prazoMeses > 11
    ) {
      setErro(
        "Informe um prazo de validade válido."
      );

      return;
    }


    if (
      !arquivo ||
      candidatos.length ===
        0
    ) {
      setErro(
        "Selecione e valide uma planilha XLSX ou arquivo CSV."
      );

      return;
    }


    setSalvando(
      true
    );


    try {
      const supabase =
        createClient();


      const prazoValidade =
        formatarPrazoValidade(
          prazoAnos,
          prazoMeses
        );


      const {
        data,
        error,
      } =
        await supabase.rpc(
          "importar_lista_aprovados",
          {
            p_processo_seletivo:
              processoSeletivo,

            p_edital:
              edital.trim(),

            p_data_inicio:
              dataInicio ||
              null,

            p_data_fim:
              dataFim ||
              null,

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


      if (error) {
        console.error(
          "Erro Supabase:",
          error
        );

        throw new Error(
          error.message
        );
      }


      const resultado =
        Array.isArray(
          data
        )
          ? data[0]
          : data;


      const quantidade =
        resultado
          ?.quantidade_importada ??
        candidatos.length;


      setSucesso(
        `Lista importada com sucesso. ${quantidade} candidato${
          quantidade === 1
            ? ""
            : "s"
        } importado${
          quantidade === 1
            ? ""
            : "s"
        }.`
      );


      limparFormulario();

      router.refresh();


      setTimeout(
        () => {
          setAberto(
            false
          );

          setSucesso(
            ""
          );
        },
        1200
      );

    } catch (error) {
      console.error(
        "Erro ao importar lista:",
        error
      );


      setErro(
        error instanceof
        Error
          ? error.message
          : "Não foi possível importar a lista."
      );

    } finally {
      setSalvando(
        false
      );
    }
  }


  // ==========================================================
  // INTERFACE
  // ==========================================================

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErro("");
          setSucesso("");

          setAberto(
            true
          );
        }}
        className="rounded-lg bg-[#094780] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
      >
        + Nova lista
      </button>


      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">

            {/* CABEÇALHO */}

            <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-5">

              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Nova lista de aprovados
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Cadastre o edital e importe a lista de candidatos.
                </p>
              </div>


              <button
                type="button"
                disabled={
                  salvando ||
                  processandoArquivo
                }
                onClick={
                  fechar
                }
                className="text-2xl leading-none text-slate-400 hover:text-slate-700"
              >
                ×
              </button>

            </div>


            <form
              onSubmit={
                importar
              }
              className="flex min-h-0 flex-1 flex-col"
            >

              {/* CONTEÚDO COM SCROLL */}

              <div className="min-h-0 flex-1 overflow-y-auto p-6">

                {erro && (
                  <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {erro}
                  </div>
                )}


                {sucesso && (
                  <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {sucesso}
                  </div>
                )}


                <div className="space-y-5">

                  {/* PROCESSO */}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Processo seletivo *
                    </label>

                    <select
                      required
                      value={
                        processoSeletivo
                      }
                      onChange={(
                        event
                      ) =>
                        setProcessoSeletivo(
                          event.target.value
                        )
                      }
                      disabled={
                        salvando
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                    >
                      <option value="">
                        Selecione
                      </option>

                      {PROCESSOS_SELETIVOS.map(
                        (
                          processo
                        ) => (
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
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Edital *
                    </label>

                    <input
                      required
                      value={
                        edital
                      }
                      onChange={(
                        event
                      ) =>
                        setEdital(
                          event.target.value
                        )
                      }
                      disabled={
                        salvando
                      }
                      placeholder="Ex.: 13/2025"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                    />
                  </div>


                  {/* DATAS */}

                  <div className="grid gap-5 sm:grid-cols-2">

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Data de início
                      </label>

                      <input
                        type="date"
                        value={
                          dataInicio
                        }
                        onChange={(
                          event
                        ) =>
                          setDataInicio(
                            event.target.value
                          )
                        }
                        disabled={
                          salvando
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                      />
                    </div>


                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Data final
                      </label>

                      <input
                        type="date"
                        value={
                          dataFim
                        }
                        onChange={(
                          event
                        ) =>
                          setDataFim(
                            event.target.value
                          )
                        }
                        disabled={
                          salvando
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                      />
                    </div>

                  </div>


                  {/* PRAZO */}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Prazo de validade *
                    </label>


                    <div className="grid gap-4 sm:grid-cols-2">

                      <div>
                        <span className="mb-1.5 block text-xs text-slate-500">
                          Anos
                        </span>

                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={
                            prazoAnos
                          }
                          onChange={(
                            event
                          ) =>
                            setPrazoAnos(
                              Number(
                                event.target.value
                              )
                            )
                          }
                          disabled={
                            salvando
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                        />
                      </div>


                      <div>
                        <span className="mb-1.5 block text-xs text-slate-500">
                          Meses
                        </span>

                        <input
                          type="number"
                          min={0}
                          max={11}
                          value={
                            prazoMeses
                          }
                          onChange={(
                            event
                          ) =>
                            setPrazoMeses(
                              Number(
                                event.target.value
                              )
                            )
                          }
                          disabled={
                            salvando
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                        />
                      </div>

                    </div>
                  </div>


                  {/* PRORROGÁVEL */}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Prorrogável?
                    </label>

                    <select
                      value={
                        prorrogavel
                          ? "sim"
                          : "nao"
                      }
                      onChange={(
                        event
                      ) =>
                        setProrrogavel(
                          event.target.value ===
                            "sim"
                        )
                      }
                      disabled={
                        salvando
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                    >
                      <option value="nao">
                        Não
                      </option>

                      <option value="sim">
                        Sim
                      </option>
                    </select>
                  </div>


                  {/* ARQUIVO */}

                  <div>

                    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">

                      <label className="block text-sm font-medium text-slate-700">
                        Lista de aprovados *
                      </label>


                      <button
                        type="button"
                        disabled={
                          baixandoModelo
                        }
                        onClick={() => {
                          void baixarModelo();
                        }}
                        className="rounded-lg border border-[#094780] px-3 py-2 text-xs font-medium text-[#094780] hover:bg-blue-50 disabled:opacity-50"
                      >
                        {baixandoModelo
                          ? "Gerando..."
                          : "Baixar modelo XLSX"}
                      </button>

                    </div>


                    <input
                      type="file"
                      accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      onChange={
                        selecionarArquivo
                      }
                      disabled={
                        salvando ||
                        processandoArquivo
                      }
                      className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />


                    <p className="mt-2 text-xs text-slate-500">
                      Recomendado: XLSX. CSV também é aceito.
                    </p>


                    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">

                      <strong>
                        Colunas obrigatórias:
                      </strong>

                      <div className="mt-2 overflow-x-auto font-mono text-xs">
                        codigo_vaga | cargo | classificacao | nota | nome | modalidade
                      </div>

                    </div>


                    {processandoArquivo && (
                      <p className="mt-3 text-sm text-slate-500">
                        Validando arquivo...
                      </p>
                    )}


                    {arquivo &&
                      candidatos.length >
                        0 && (
                      <div className="mt-4">

                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                          <strong>
                            Arquivo válido.
                          </strong>{" "}
                          {candidatos.length.toLocaleString(
                            "pt-BR"
                          )} candidato
                          {candidatos.length ===
                          1
                            ? ""
                            : "s"}{" "}
                          encontrado
                          {candidatos.length ===
                          1
                            ? ""
                            : "s"}.
                        </div>


                        {/* PRÉVIA */}

                        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">

                          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-sm font-medium text-slate-700">
                              Prévia das primeiras linhas
                            </p>
                          </div>


                          <div className="overflow-x-auto">

                            <table className="w-full min-w-[850px] text-xs">

                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-3 py-2 text-left">
                                    Código
                                  </th>

                                  <th className="px-3 py-2 text-left">
                                    Cargo
                                  </th>

                                  <th className="px-3 py-2 text-left">
                                    Class.
                                  </th>

                                  <th className="px-3 py-2 text-left">
                                    Nota
                                  </th>

                                  <th className="px-3 py-2 text-left">
                                    Nome
                                  </th>

                                  <th className="px-3 py-2 text-left">
                                    Modalidade
                                  </th>
                                </tr>
                              </thead>


                              <tbody className="divide-y divide-slate-100">

                                {candidatos
                                  .slice(
                                    0,
                                    5
                                  )
                                  .map(
                                    (
                                      candidato,
                                      indice
                                    ) => (
                                      <tr
                                        key={
                                          indice
                                        }
                                      >
                                        <td className="px-3 py-2">
                                          {
                                            candidato.codigo_vaga
                                          }
                                        </td>

                                        <td className="px-3 py-2">
                                          {
                                            candidato.cargo
                                          }
                                        </td>

                                        <td className="px-3 py-2">
                                          {
                                            candidato.classificacao
                                          }
                                        </td>

                                        <td className="px-3 py-2">
                                          {
                                            candidato.nota
                                          }
                                        </td>

                                        <td className="px-3 py-2">
                                          {
                                            candidato.nome
                                          }
                                        </td>

                                        <td className="px-3 py-2">
                                          {
                                            candidato.modalidade
                                          }
                                        </td>
                                      </tr>
                                    )
                                  )}

                              </tbody>
                            </table>

                          </div>
                        </div>

                      </div>
                    )}

                  </div>

                </div>

              </div>


              {/* RODAPÉ FIXO */}

              <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">

                <button
                  type="button"
                  onClick={
                    fechar
                  }
                  disabled={
                    salvando ||
                    processandoArquivo
                  }
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                >
                  Cancelar
                </button>


                <button
                  type="submit"
                  disabled={
                    salvando ||
                    processandoArquivo ||
                    !arquivo
                  }
                  className="rounded-lg bg-[#094780] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {salvando
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
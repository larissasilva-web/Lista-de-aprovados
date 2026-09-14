"use client";

import {
  ChangeEvent,
  FormEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  salvarConfiguracoes,
} from "@/app/actions/configuracoes";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  ConfiguracaoSistema,
  FONTES_SISTEMA,
  FonteSistema,
  obterFonteCss,
} from "@/lib/configuracoes/tema";

type Props = {
  configuracaoInicial:
    ConfiguracaoSistema;
};

type TipoImagem =
  | "logoLogin"
  | "imagemLogin"
  | "logoHeader";

type Arquivos = {
  logoLogin: File | null;
  imagemLogin: File | null;
  logoHeader: File | null;
};

function corParaInput(
  cor: string
) {
  return /^#[0-9A-Fa-f]{6}$/.test(
    cor
  )
    ? cor
    : "#000000";
}

export function FormularioConfiguracoes({
  configuracaoInicial,
}: Props) {
  const router =
    useRouter();

  const [config, setConfig] =
    useState(
      configuracaoInicial
    );

  const [
    arquivos,
    setArquivos,
  ] = useState<Arquivos>({
    logoLogin: null,
    imagemLogin: null,
    logoHeader: null,
  });

  const [
    previews,
    setPreviews,
  ] = useState({
    logoLogin:
      configuracaoInicial.logoLoginUrl,

    imagemLogin:
      configuracaoInicial.imagemLoginUrl,

    logoHeader:
      configuracaoInicial.logoHeaderUrl,
  });

  const [
    salvando,
    setSalvando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    sucesso,
    setSucesso,
  ] = useState("");

  function alterar(
    campo:
      keyof ConfiguracaoSistema,
    valor: string
  ) {
    setConfig(
      (atual) => ({
        ...atual,
        [campo]:
          valor,
      })
    );
  }

  function selecionarImagem(
    tipo: TipoImagem,
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    setErro("");
    setSucesso("");

    const arquivo =
      event.target.files?.[0];

    if (!arquivo) {
      return;
    }

    const permitidos = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
    ];

    if (
      !permitidos.includes(
        arquivo.type
      )
    ) {
      setErro(
        "Utilize PNG, JPG, WEBP ou SVG."
      );

      event.target.value =
        "";

      return;
    }

    const limite =
      tipo === "imagemLogin"
        ? 5 * 1024 * 1024
        : 2 * 1024 * 1024;

    if (
      arquivo.size >
      limite
    ) {
      setErro(
        tipo === "imagemLogin"
          ? "A imagem do login deve possuir no máximo 5 MB."
          : "O logo deve possuir no máximo 2 MB."
      );

      event.target.value =
        "";

      return;
    }

    setArquivos(
      (atual) => ({
        ...atual,
        [tipo]:
          arquivo,
      })
    );

    setPreviews(
      (atual) => ({
        ...atual,
        [tipo]:
          URL.createObjectURL(
            arquivo
          ),
      })
    );
  }

  async function upload(
    arquivo: File,
    pasta: string
  ) {
    const supabase =
      createClient();

    const extensao =
      arquivo.name
        .split(".")
        .pop()
        ?.toLowerCase() ||
      "png";

    const caminho =
      `${pasta}/${crypto.randomUUID()}.${extensao}`;

    const {
      error,
    } = await supabase.storage
      .from("logos-sistema")
      .upload(
        caminho,
        arquivo,
        {
          cacheControl:
            "3600",

          upsert:
            false,

          contentType:
            arquivo.type,
        }
      );

    if (error) {
      throw new Error(
        `Erro no upload: ${error.message}`
      );
    }

    const {
      data,
    } = supabase.storage
      .from("logos-sistema")
      .getPublicUrl(
        caminho
      );

    return data.publicUrl;
  }

  async function salvar(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErro("");
    setSucesso("");
    setSalvando(true);

    try {
      let logoLoginUrl =
        config.logoLoginUrl;

      let imagemLoginUrl =
        config.imagemLoginUrl;

      let logoHeaderUrl =
        config.logoHeaderUrl;

      if (
        arquivos.logoLogin
      ) {
        logoLoginUrl =
          await upload(
            arquivos.logoLogin,
            "login/logo"
          );
      }

      if (
        arquivos.imagemLogin
      ) {
        imagemLoginUrl =
          await upload(
            arquivos.imagemLogin,
            "login/fundo"
          );
      }

      if (
        arquivos.logoHeader
      ) {
        logoHeaderUrl =
          await upload(
            arquivos.logoHeader,
            "header/logo"
          );
      }

      const resultado =
        await salvarConfiguracoes({
          tituloSistema:
            config.tituloSistema,

          corPrimaria:
            config.corPrimaria,

          logoLoginUrl,

          imagemLoginUrl,

          logoHeaderUrl,

          corFundoLogin:
            config.corFundoLogin,

          corCardLogin:
            config.corCardLogin,

          corTextoCardLogin:
            config.corTextoCardLogin,

          corSidebar:
            config.corSidebar,

          corTextoSidebar:
            config.corTextoSidebar,

          corTextoPrincipal:
            config.corTextoPrincipal,

          fonteSistema:
            config.fonteSistema,
        });

      if (
        !resultado.sucesso
      ) {
        setErro(
          resultado.mensagem
        );

        return;
      }

      setConfig(
        (atual) => ({
          ...atual,

          logoLoginUrl,

          imagemLoginUrl,

          logoHeaderUrl,
        })
      );

      setArquivos({
        logoLogin: null,
        imagemLogin: null,
        logoHeader: null,
      });

      setSucesso(
        resultado.mensagem
      );

      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar."
      );
    } finally {
      setSalvando(false);
    }
  }

  function removerImagem(
    tipo: TipoImagem
  ) {
    setArquivos(
      (atual) => ({
        ...atual,
        [tipo]:
          null,
      })
    );

    setPreviews(
      (atual) => ({
        ...atual,
        [tipo]:
          null,
      })
    );

    if (
      tipo === "logoLogin"
    ) {
      setConfig(
        (atual) => ({
          ...atual,
          logoLoginUrl:
            null,
        })
      );
    }

    if (
      tipo === "imagemLogin"
    ) {
      setConfig(
        (atual) => ({
          ...atual,
          imagemLoginUrl:
            null,
        })
      );
    }

    if (
      tipo === "logoHeader"
    ) {
      setConfig(
        (atual) => ({
          ...atual,
          logoHeaderUrl:
            null,
        })
      );
    }
  }

  const camposCor = [
    {
      campo:
        "corPrimaria",
      titulo:
        "Cor principal",
    },
    {
      campo:
        "corFundoLogin",
      titulo:
        "Fundo da página de login",
    },
    {
      campo:
        "corCardLogin",
      titulo:
        "Fundo do card de login",
    },
    {
      campo:
        "corTextoCardLogin",
      titulo:
        "Texto do card de login",
    },
    {
      campo:
        "corSidebar",
      titulo:
        "Sidebar",
    },
    {
      campo:
        "corTextoSidebar",
      titulo:
        "Texto do sidebar",
    },
    {
      campo:
        "corTextoPrincipal",
      titulo:
        "Texto principal",
    },
  ] as const;

  return (
    <form
      onSubmit={salvar}
      className="space-y-6"
    >
      {erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {sucesso}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          {/* IDENTIDADE */}

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              Identidade do sistema
            </h3>

            <div className="mt-5 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Título do sistema
                </label>

                <input
                  required
                  maxLength={100}
                  value={
                    config.tituloSistema
                  }
                  onChange={(
                    event
                  ) =>
                    alterar(
                      "tituloSistema",
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Logo do header
                </label>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(
                    event
                  ) =>
                    selecionarImagem(
                      "logoHeader",
                      event
                    )
                  }
                />

                {previews.logoHeader && (
                  <div className="mt-3 flex items-center gap-4">
                    <img
                      src={
                        previews.logoHeader
                      }
                      alt="Logo do header"
                      className="max-h-16 max-w-48 object-contain"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        removerImagem(
                          "logoHeader"
                        )
                      }
                      className="text-sm text-red-600"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* LOGIN */}

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              Página de login
            </h3>

            <div className="mt-5 grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Logo do login
                </label>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(
                    event
                  ) =>
                    selecionarImagem(
                      "logoLogin",
                      event
                    )
                  }
                />

                {previews.logoLogin && (
                  <div className="mt-3">
                    <img
                      src={
                        previews.logoLogin
                      }
                      alt="Logo"
                      className="max-h-20 max-w-48 object-contain"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        removerImagem(
                          "logoLogin"
                        )
                      }
                      className="mt-2 block text-sm text-red-600"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Imagem da página de login
                </label>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(
                    event
                  ) =>
                    selecionarImagem(
                      "imagemLogin",
                      event
                    )
                  }
                />

                {previews.imagemLogin && (
                  <div className="mt-3">
                    <img
                      src={
                        previews.imagemLogin
                      }
                      alt="Fundo do login"
                      className="h-24 w-full rounded-lg object-cover"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        removerImagem(
                          "imagemLogin"
                        )
                      }
                      className="mt-2 text-sm text-red-600"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* CORES */}

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              Cores
            </h3>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {camposCor.map(
                ({
                  campo,
                  titulo,
                }) => (
                  <div
                    key={campo}
                  >
                    <label className="mb-2 block text-sm font-medium">
                      {titulo}
                    </label>

                    <div className="flex gap-3">
                      <input
                        type="color"
                        value={corParaInput(
                          config[
                            campo
                          ]
                        )}
                        onChange={(
                          event
                        ) =>
                          alterar(
                            campo,
                            event.target.value.toUpperCase()
                          )
                        }
                        className="h-11 w-14 rounded border border-slate-300 p-1"
                      />

                      <input
                        value={
                          config[
                            campo
                          ]
                        }
                        maxLength={7}
                        onChange={(
                          event
                        ) =>
                          alterar(
                            campo,
                            event.target.value.toUpperCase()
                          )
                        }
                        className="w-32 rounded-lg border border-slate-300 px-3 font-mono text-sm"
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          {/* TIPOGRAFIA */}

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              Tipografia
            </h3>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium">
                Fonte do sistema
              </label>

              <select
                value={
                  config.fonteSistema
                }
                onChange={(
                  event
                ) =>
                  alterar(
                    "fonteSistema",
                    event.target.value as FonteSistema
                  )
                }
                className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2.5"
              >
                {FONTES_SISTEMA.map(
                  (fonte) => (
                    <option
                      key={
                        fonte.valor
                      }
                      value={
                        fonte.valor
                      }
                    >
                      {
                        fonte.rotulo
                      }
                    </option>
                  )
                )}
              </select>
            </div>
          </section>
        </div>

        {/* PREVIEW */}

        <aside>
          <div className="sticky top-6 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="mb-4 text-xs font-semibold uppercase text-slate-400">
                Prévia do login
              </p>

              <div
                className="overflow-hidden rounded-xl"
                style={{
                  fontFamily:
                    obterFonteCss(
                      config.fonteSistema
                    ),
                  backgroundColor:
                    config.corFundoLogin,
                }}
              >
                {previews.imagemLogin && (
                  <div
                    className="h-32 bg-cover bg-center"
                    style={{
                      backgroundImage:
                        `url("${previews.imagemLogin}")`,
                    }}
                  />
                )}

                <div className="p-6">
                  <div
                    className="rounded-xl p-5 shadow"
                    style={{
                      backgroundColor:
                        config.corCardLogin,

                      color:
                        config.corTextoCardLogin,
                    }}
                  >
                    {previews.logoLogin && (
                      <img
                        src={
                          previews.logoLogin
                        }
                        alt=""
                        className="mx-auto mb-4 h-14 max-w-40 object-contain"
                      />
                    )}

                    <p className="text-center font-semibold">
                      {
                        config.tituloSistema
                      }
                    </p>

                    <button
                      type="button"
                      className="mt-5 w-full rounded-lg px-4 py-2 text-sm font-medium text-white"
                      style={{
                        backgroundColor:
                          config.corPrimaria,
                      }}
                    >
                      Entrar com Google
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="mb-4 text-xs font-semibold uppercase text-slate-400">
                Prévia do sistema
              </p>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex">
                  <div
                    className="w-32 p-4"
                    style={{
                      backgroundColor:
                        config.corSidebar,

                      color:
                        config.corTextoSidebar,
                    }}
                  >
                    <p className="text-xs font-semibold">
                      Menu
                    </p>

                    <p className="mt-5 text-xs">
                      Lista
                    </p>

                    <p className="mt-3 text-xs">
                      Editais
                    </p>
                  </div>

                  <div
                    className="flex-1 p-4"
                    style={{
                      color:
                        config.corTextoPrincipal,

                      fontFamily:
                        obterFonteCss(
                          config.fonteSistema
                        ),
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {previews.logoHeader && (
                        <img
                          src={
                            previews.logoHeader
                          }
                          alt=""
                          className="h-8 w-8 object-contain"
                        />
                      )}

                      <span className="text-sm font-semibold">
                        {
                          config.tituloSistema
                        }
                      </span>
                    </div>

                    <div
                      className="mt-6 h-8 rounded"
                      style={{
                        backgroundColor:
                          config.corPrimaria,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            salvando
          }
          style={{
            backgroundColor:
              config.corPrimaria,
          }}
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {salvando
            ? "Salvando..."
            : "Salvar configurações"}
        </button>
      </div>
    </form>
  );
}
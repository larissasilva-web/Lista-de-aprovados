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

type Props = {
  configuracaoInicial: {
    id: string | null;
    tituloSistema: string;
    corPrimaria: string;
    logoUrl: string | null;
  };
};

export function FormularioConfiguracoes({
  configuracaoInicial,
}: Props) {
  const router =
    useRouter();

  const [
    tituloSistema,
    setTituloSistema,
  ] = useState(
    configuracaoInicial.tituloSistema
  );

  const [
    corPrimaria,
    setCorPrimaria,
  ] = useState(
    configuracaoInicial.corPrimaria
  );

  const [
    logoUrl,
    setLogoUrl,
  ] = useState<string | null>(
    configuracaoInicial.logoUrl
  );

  const [
    arquivoLogo,
    setArquivoLogo,
  ] = useState<File | null>(
    null
  );

  const [
    previewLogo,
    setPreviewLogo,
  ] = useState<string | null>(
    configuracaoInicial.logoUrl
  );

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

  function alterarCor(
    valor: string
  ) {
    setCorPrimaria(
      valor.toUpperCase()
    );
  }

  function selecionarLogo(
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

    const tiposPermitidos = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
    ];

    if (
      !tiposPermitidos.includes(
        arquivo.type
      )
    ) {
      setErro(
        "Formato de imagem não permitido. Utilize PNG, JPG, WEBP ou SVG."
      );

      event.target.value =
        "";

      return;
    }

    const limite =
      2 * 1024 * 1024;

    if (
      arquivo.size > limite
    ) {
      setErro(
        "O logo deve possuir no máximo 2 MB."
      );

      event.target.value =
        "";

      return;
    }

    setArquivoLogo(
      arquivo
    );

    const preview =
      URL.createObjectURL(
        arquivo
      );

    setPreviewLogo(
      preview
    );
  }

  async function enviarLogo() {
    if (!arquivoLogo) {
      return logoUrl;
    }

    const supabase =
      createClient();

    const extensao =
      arquivoLogo.name
        .split(".")
        .pop()
        ?.toLowerCase() ||
      "png";

    const nomeArquivo =
      `logo-${crypto.randomUUID()}.${extensao}`;

    const {
      error: erroUpload,
    } =
      await supabase.storage
        .from(
          "logos-sistema"
        )
        .upload(
          nomeArquivo,
          arquivoLogo,
          {
            cacheControl:
              "3600",

            upsert:
              false,

            contentType:
              arquivoLogo.type,
          }
        );

    if (erroUpload) {
      throw new Error(
        `Erro ao enviar logo: ${erroUpload.message}`
      );
    }

    const {
      data,
    } =
      supabase.storage
        .from(
          "logos-sistema"
        )
        .getPublicUrl(
          nomeArquivo
        );

    return (
      data.publicUrl ||
      null
    );
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
      const novaLogoUrl =
        await enviarLogo();

      const resultado =
        await salvarConfiguracoes({
          id:
            configuracaoInicial.id,

          tituloSistema,

          corPrimaria,

          logoUrl:
            novaLogoUrl,
        });

      if (
        !resultado.sucesso
      ) {
        setErro(
          resultado.mensagem
        );

        return;
      }

      setLogoUrl(
        novaLogoUrl
      );

      setArquivoLogo(
        null
      );

      setSucesso(
        resultado.mensagem
      );

      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as configurações."
      );
    } finally {
      setSalvando(false);
    }
  }

  function removerLogo() {
    setArquivoLogo(
      null
    );

    setLogoUrl(
      null
    );

    setPreviewLogo(
      null
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* FORMULÁRIO */}

      <form
        onSubmit={salvar}
        className="rounded-xl border border-slate-200 bg-white p-6"
      >
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

        <div className="space-y-6">
          {/* TÍTULO */}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Título do sistema
            </label>

            <input
              type="text"
              maxLength={100}
              required
              value={
                tituloSistema
              }
              onChange={(
                event
              ) =>
                setTituloSistema(
                  event.target.value
                )
              }
              disabled={
                salvando
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />

            <p className="mt-1.5 text-xs text-slate-400">
              Nome exibido na identificação do sistema.
            </p>
          </div>

          {/* COR */}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Cor principal
            </label>

            <div className="flex items-center gap-3">
              <input
                type="color"
                value={
                  /^#[0-9A-Fa-f]{6}$/.test(
                    corPrimaria
                  )
                    ? corPrimaria
                    : "#094780"
                }
                onChange={(
                  event
                ) =>
                  alterarCor(
                    event.target.value
                  )
                }
                disabled={
                  salvando
                }
                className="h-11 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
              />

              <input
                type="text"
                value={
                  corPrimaria
                }
                maxLength={7}
                onChange={(
                  event
                ) =>
                  alterarCor(
                    event.target.value
                  )
                }
                disabled={
                  salvando
                }
                placeholder="#094780"
                className="w-40 rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm"
              />
            </div>

            <p className="mt-1.5 text-xs text-slate-400">
              Utilize o formato hexadecimal. Exemplo: #094780.
            </p>
          </div>

          {/* LOGO */}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Logo
            </label>

            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={
                selecionarLogo
              }
              disabled={
                salvando
              }
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
            />

            <p className="mt-1.5 text-xs text-slate-400">
              PNG, JPG, WEBP ou SVG. Máximo de 2 MB.
            </p>

            {previewLogo && (
              <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-200 p-4">
                <img
                  src={
                    previewLogo
                  }
                  alt="Logo atual"
                  className="max-h-16 max-w-48 object-contain"
                />

                <button
                  type="button"
                  onClick={
                    removerLogo
                  }
                  disabled={
                    salvando
                  }
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Remover logo
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={
              salvando
            }
            style={{
              backgroundColor:
                /^#[0-9A-Fa-f]{6}$/.test(
                  corPrimaria
                )
                  ? corPrimaria
                  : "#094780",
            }}
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando
              ? "Salvando..."
              : "Salvar configurações"}
          </button>
        </div>
      </form>

      {/* PRÉVIA */}

      <div>
        <div className="sticky top-6 rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Prévia
          </p>

          <div
            className="overflow-hidden rounded-xl border border-slate-200"
          >
            <div
              className="flex min-h-24 items-center gap-4 px-5 py-5"
              style={{
                borderTop:
                  `5px solid ${
                    /^#[0-9A-Fa-f]{6}$/.test(
                      corPrimaria
                    )
                      ? corPrimaria
                      : "#094780"
                  }`,
              }}
            >
              {previewLogo && (
                <img
                  src={
                    previewLogo
                  }
                  alt=""
                  className="h-12 w-12 object-contain"
                />
              )}

              <div>
                <p className="font-semibold text-slate-900">
                  {tituloSistema ||
                    "Lista de Aprovados"}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Sistema institucional
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 p-5">
              <button
                type="button"
                style={{
                  backgroundColor:
                    /^#[0-9A-Fa-f]{6}$/.test(
                      corPrimaria
                    )
                      ? corPrimaria
                      : "#094780",
                }}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white"
              >
                Exemplo de botão
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
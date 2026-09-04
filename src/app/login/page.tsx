"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [carregando, setCarregando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  useEffect(() => {
    const parametros =
      new URLSearchParams(
        window.location.search
      );

    const codigoErro =
      parametros.get("erro");

    if (
      codigoErro ===
      "sem-permissao"
    ) {
      setErro(
        "Sua conta Google foi autenticada, mas seu e-mail não possui permissão para acessar este sistema."
      );
    }

    if (
      codigoErro ===
      "sem-email"
    ) {
      setErro(
        "Não foi possível identificar o e-mail da sua conta Google."
      );
    }

    if (
      codigoErro ===
      "oauth"
    ) {
      setErro(
        "Não foi possível concluir a autenticação com o Google."
      );
    }
  }, []);

  async function entrarComGoogle() {
    setCarregando(true);
    setErro("");

    try {
      const supabase =
        createClient();

      const {
        error,
      } =
        await supabase.auth.signInWithOAuth(
          {
            provider: "google",

            options: {
              redirectTo:
                `${window.location.origin}/auth/callback`,

              queryParams: {
                prompt:
                  "select_account",
              },
            },
          }
        );

      if (error) {
        throw error;
      }
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar com o Google."
      );

      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Lista de Aprovados
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Acesse utilizando sua conta Google.
          </p>
        </div>

        {erro && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        <button
          type="button"
          onClick={
            entrarComGoogle
          }
          disabled={
            carregando
          }
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M21.35 12.19c0-.64-.06-1.25-.16-1.84H12v3.48h5.25a4.49 4.49 0 0 1-1.95 2.94v2.44h3.16c1.85-1.7 2.89-4.21 2.89-7.02Z"
            />

            <path
              fill="#34A853"
              d="M12 21.72c2.64 0 4.86-.87 6.48-2.37l-3.16-2.44c-.88.59-2 .94-3.32.94-2.55 0-4.71-1.72-5.49-4.04H3.25v2.52A9.78 9.78 0 0 0 12 21.72Z"
            />

            <path
              fill="#FBBC05"
              d="M6.51 13.81A5.87 5.87 0 0 1 6.2 12c0-.63.11-1.24.31-1.81V7.67H3.25A9.73 9.73 0 0 0 2.22 12c0 1.56.37 3.04 1.03 4.33l3.26-2.52Z"
            />

            <path
              fill="#EA4335"
              d="M12 6.15c1.44 0 2.73.5 3.75 1.46l2.81-2.81C16.85 3.21 14.64 2.28 12 2.28a9.78 9.78 0 0 0-8.75 5.39l3.26 2.52C7.29 7.87 9.45 6.15 12 6.15Z"
            />
          </svg>

          {carregando
            ? "Redirecionando..."
            : "Entrar com Google"}
        </button>

        <p className="mt-6 text-center text-xs text-slate-400">
          O acesso é permitido somente para usuários previamente cadastrados.
        </p>
      </div>
    </main>
  );
}
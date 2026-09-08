"use client";

import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  ConfiguracaoSistema,
  obterFonteCss,
} from "@/lib/configuracoes/tema";

import {
  NavegacaoSistema,
} from "@/components/sistema/navegacao-sistema";


type TipoPermissao =
  | "usuario"
  | "contratador"
  | "admin";


type Usuario = {
  nome: string;
  email: string;
  tipoPermissao:
    TipoPermissao;
};


type Props = {
  children: ReactNode;

  usuario: Usuario;

  configuracao:
    ConfiguracaoSistema;
};


export function SistemaShell({
  children,
  usuario,
  configuracao,
}: Props) {
  const [
    sidebarRecolhida,
    setSidebarRecolhida,
  ] = useState(false);

  const [
    menuMobileAberto,
    setMenuMobileAberto,
  ] = useState(false);

  const [
    temaEscuro,
    setTemaEscuro,
  ] = useState(false);

  const [
    saindo,
    setSaindo,
  ] = useState(false);


  // ==========================================================
  // CARREGAR PREFERÊNCIAS LOCAIS
  // ==========================================================

  useEffect(() => {
    const sidebarSalva =
      localStorage.getItem(
        "sidebar-recolhida"
      );

    if (
      sidebarSalva === "sim"
    ) {
      setSidebarRecolhida(
        true
      );
    }


    const temaSalvo =
      localStorage.getItem(
        "tema-interface"
      );


    let escuro =
      false;


    if (
      temaSalvo === "escuro"
    ) {
      escuro =
        true;
    } else if (
      temaSalvo === "claro"
    ) {
      escuro =
        false;
    } else {
      escuro =
        window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
    }


    setTemaEscuro(
      escuro
    );


    document
      .documentElement
      .classList
      .toggle(
        "dark",
        escuro
      );
  }, []);


  // ==========================================================
  // SIDEBAR
  // ==========================================================

  function alternarSidebar() {
    const novoEstado =
      !sidebarRecolhida;

    setSidebarRecolhida(
      novoEstado
    );

    localStorage.setItem(
      "sidebar-recolhida",
      novoEstado
        ? "sim"
        : "nao"
    );
  }


  // ==========================================================
  // TEMA
  // ==========================================================

  function alternarTema() {
    const novoTema =
      !temaEscuro;

    setTemaEscuro(
      novoTema
    );

    document
      .documentElement
      .classList
      .toggle(
        "dark",
        novoTema
      );

    localStorage.setItem(
      "tema-interface",
      novoTema
        ? "escuro"
        : "claro"
    );
  }


  // ==========================================================
  // LOGOUT
  // ==========================================================

  async function sair() {
    setSaindo(
      true
    );

    const supabase =
      createClient();

    await supabase.auth
      .signOut();

    window.location.href =
      "/login";
  }


  return (
    <div
      className="min-h-screen bg-slate-50 transition-colors dark:bg-slate-950"
      style={{
  color:
    temaEscuro
      ? "#E2E8F0"
      : configuracao.corTextoPrincipal,

  fontFamily:
    obterFonteCss(
      configuracao.fonteSistema
    ),
}}
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 sm:px-5 lg:px-6">

        {/* ESQUERDA */}

        <div className="flex min-w-0 items-center gap-3">

          {/* MENU MOBILE */}

          <button
            type="button"
            onClick={() =>
              setMenuMobileAberto(
                true
              )
            }
            title="Abrir menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>


          {/* RECOLHER DESKTOP */}

          <button
            type="button"
            onClick={
              alternarSidebar
            }
            title={
              sidebarRecolhida
                ? "Expandir menu"
                : "Recolher menu"
            }
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:flex"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>


          {/* IDENTIDADE */}

          <div className="flex min-w-0 items-center gap-3">

            {configuracao.logoHeaderUrl ? (
              <img
                src={
                  configuracao.logoHeaderUrl
                }
                alt="Logo"
                className="h-9 max-w-32 shrink-0 object-contain"
              />
            ) : (
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{
                  backgroundColor:
                    configuracao.corPrimaria,
                }}
              >
                LA
              </div>
            )}


            <h1 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
              {
                configuracao.tituloSistema
              }
            </h1>

          </div>
        </div>


        {/* DIREITA */}

        <div className="flex items-center gap-2">

          {/* TEMA */}

          <button
            type="button"
            onClick={
              alternarTema
            }
            title={
              temaEscuro
                ? "Usar modo claro"
                : "Usar modo escuro"
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {temaEscuro ? (
              /* SOL */
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="4"
                />

                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              /* LUA */
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
              </svg>
            )}
          </button>


          {/* USUÁRIO */}

          <div className="hidden min-w-0 text-right md:block">
            <p className="max-w-48 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
              {
                usuario.nome
              }
            </p>

            <p className="max-w-48 truncate text-xs text-slate-400">
              {
                usuario.email
              }
            </p>
          </div>


          {/* SAIR */}

          <button
            type="button"
            onClick={
              sair
            }
            disabled={
              saindo
            }
            className="flex h-9 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
              <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
            </svg>

            <span className="hidden sm:inline">
              {saindo
                ? "Saindo..."
                : "Sair"}
            </span>
          </button>

        </div>
      </header>


      {/* ======================================================
          CORPO
      ====================================================== */}

      <div className="flex">

        <NavegacaoSistema
          usuario={
            usuario
          }
          configuracao={
            configuracao
          }
          recolhida={
            sidebarRecolhida
          }
          mobileAberto={
            menuMobileAberto
          }
          onFecharMobile={() =>
            setMenuMobileAberto(
              false
            )
          }
        />


        <main className="min-w-0 flex-1 p-4 transition-colors sm:p-5 lg:p-6">
          {children}
        </main>

      </div>
    </div>
  );
}
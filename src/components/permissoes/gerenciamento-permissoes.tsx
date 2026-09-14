"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  acessoPadraoPorPerfil,
  modulosPermitidosPorPerfil,
  MODULOS_SISTEMA,
  ROTULO_MODULO,
  ROTULO_PERMISSAO,
  TipoPermissao,
} from "@/lib/acesso/modulos";

type Permissao = {
  id: string;
  auth_user_id: string | null;
  email: string;
  nome: string | null;
  tipo_permissao: TipoPermissao;
  ativo: boolean;
  acesso_lista: boolean;
  acesso_dashboards: boolean;
  acesso_editais: boolean;
  acesso_permissoes: boolean;
  acesso_configuracoes: boolean;
};

type Formulario = {
  id: string | null;
  email: string;
  nome: string;
  tipo_permissao: TipoPermissao;
  ativo: boolean;
  acesso_lista: boolean;
  acesso_dashboards: boolean;
  acesso_editais: boolean;
  acesso_permissoes: boolean;
  acesso_configuracoes: boolean;
};

const VAZIO: Formulario = {
  id: null,
  email: "",
  nome: "",
  tipo_permissao: "usuario",
  ativo: true,
  acesso_lista: true,
  acesso_dashboards: true,
  acesso_editais: false,
  acesso_permissoes: false,
  acesso_configuracoes: false,
};

function badgePerfil(tipo: TipoPermissao) {
  if (tipo === "admin") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (tipo === "contratador") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function Kpi({
  titulo,
  valor,
  destaque = "blue",
}: {
  titulo: string;
  valor: number;
  destaque?: "blue" | "green" | "violet" | "amber";
}) {
  const linha = {
    blue: "bg-blue-600",
    green: "bg-emerald-600",
    violet: "bg-violet-600",
    amber: "bg-amber-500",
  }[destaque];

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_4px_18px_rgba(15,23,42,0.045)]">
      <span className={`absolute inset-x-0 top-0 h-[3px] ${linha}`} />
      <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-slate-500">
        {titulo}
      </p>
      <strong className="mt-2 block text-3xl font-black tracking-tight text-slate-900">
        {valor.toLocaleString("pt-BR")}
      </strong>
    </article>
  );
}

function Switch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={[
        "relative h-6 w-11 rounded-full transition",
        checked ? "bg-blue-600" : "bg-slate-300",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
          checked ? "left-[22px]" : "left-0.5",
        ].join(" ")}
      />
    </button>
  );
}

export function GerenciamentoPermissoes() {
  const [usuarios, setUsuarios] = useState<Permissao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [pesquisa, setPesquisa] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState<"todos" | TipoPermissao>(
    "todos"
  );
  const [filtroSituacao, setFiltroSituacao] = useState<
    "todos" | "ativos" | "inativos"
  >("todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState<Formulario>(VAZIO);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");

    try {
      const supabase = createClient() as any;
      const { data, error } = await supabase
        .from("permissoes")
        .select(
          [
            "id",
            "auth_user_id",
            "email",
            "nome",
            "tipo_permissao",
            "ativo",
            "acesso_lista",
            "acesso_dashboards",
            "acesso_editais",
            "acesso_permissoes",
            "acesso_configuracoes",
          ].join(",")
        )
        .order("nome", { ascending: true, nullsFirst: false })
        .order("email", { ascending: true });

      if (error) throw error;

      setUsuarios((data ?? []) as Permissao[]);
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar as permissões."
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = pesquisa.trim().toLocaleLowerCase("pt-BR");

    return usuarios.filter((item) => {
      const batePesquisa =
        !termo ||
        item.email.toLocaleLowerCase("pt-BR").includes(termo) ||
        (item.nome ?? "").toLocaleLowerCase("pt-BR").includes(termo);

      const batePerfil =
        filtroPerfil === "todos" || item.tipo_permissao === filtroPerfil;

      const bateSituacao =
        filtroSituacao === "todos" ||
        (filtroSituacao === "ativos" && item.ativo) ||
        (filtroSituacao === "inativos" && !item.ativo);

      return batePesquisa && batePerfil && bateSituacao;
    });
  }, [usuarios, pesquisa, filtroPerfil, filtroSituacao]);

  const resumo = useMemo(
    () => ({
      total: usuarios.length,
      ativos: usuarios.filter((u) => u.ativo).length,
      contratadores: usuarios.filter(
        (u) => u.ativo && u.tipo_permissao === "contratador"
      ).length,
      admins: usuarios.filter(
        (u) => u.ativo && u.tipo_permissao === "admin"
      ).length,
    }),
    [usuarios]
  );

  function novoUsuario() {
    setErro("");
    setSucesso("");
    setForm(VAZIO);
    setModalAberto(true);
  }

  function editar(item: Permissao) {
    setErro("");
    setSucesso("");
    setForm({
      id: item.id,
      email: item.email,
      nome: item.nome ?? "",
      tipo_permissao: item.tipo_permissao,
      ativo: item.ativo,
      acesso_lista: item.acesso_lista,
      acesso_dashboards: item.acesso_dashboards,
      acesso_editais: item.acesso_editais,
      acesso_permissoes: item.acesso_permissoes,
      acesso_configuracoes: item.acesso_configuracoes,
    });
    setModalAberto(true);
  }

  function alterarPerfil(tipo: TipoPermissao) {
    const padrao = acessoPadraoPorPerfil(tipo);

    setForm((atual) => ({
      ...atual,
      tipo_permissao: tipo,
      ativo: tipo === "admin" ? true : atual.ativo,
      acesso_lista: padrao.lista,
      acesso_dashboards: padrao.dashboards,
      acesso_editais: padrao.editais,
      acesso_permissoes: padrao.permissoes,
      acesso_configuracoes: padrao.configuracoes,
    }));
  }

  function alterarModulo(
    modulo:
      | "lista"
      | "dashboards"
      | "editais"
      | "permissoes"
      | "configuracoes",
    valor: boolean
  ) {
    const permitidos = modulosPermitidosPorPerfil(form.tipo_permissao);

    if (form.tipo_permissao === "admin" || !permitidos[modulo]) return;

    const chave = `acesso_${modulo}` as keyof Formulario;

    setForm((atual) => ({
      ...atual,
      [chave]: valor,
    }));
  }

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setSucesso("");

    if (!form.email.trim()) {
      setErro("Informe o e-mail do usuário.");
      return;
    }

    const modulosPermitidos = modulosPermitidosPorPerfil(
      form.tipo_permissao
    );
    const possuiModuloAtivo = MODULOS_SISTEMA.some((modulo) => {
      const chave = `acesso_${modulo}` as keyof Formulario;
      return modulosPermitidos[modulo] && Boolean(form[chave]);
    });

    if (form.ativo && !possuiModuloAtivo) {
      setErro("Selecione pelo menos um módulo para o usuário ativo.");
      return;
    }

    setSalvando(true);

    try {
      const supabase = createClient() as any;
      const { error } = await supabase.rpc("salvar_permissao_usuario", {
        p_id: form.id,
        p_email: form.email.trim(),
        p_nome: form.nome.trim(),
        p_tipo_permissao: form.tipo_permissao,
        p_ativo: form.ativo,
        p_acesso_lista: form.acesso_lista,
        p_acesso_dashboards: form.acesso_dashboards,
        p_acesso_editais: form.acesso_editais,
        p_acesso_permissoes: form.acesso_permissoes,
        p_acesso_configuracoes: form.acesso_configuracoes,
      });

      if (error) throw error;

      setModalAberto(false);
      setSucesso(
        form.id
          ? "Permissão atualizada com sucesso."
          : "Usuário cadastrado com sucesso."
      );
      await carregar();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar a permissão."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
            Governança de acesso
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
            Permissões
          </h1>
          <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">
            Defina o perfil operacional e os módulos visíveis para cada
            usuário. O banco continua sendo a autoridade final por meio de RLS
            e RPCs.
          </p>
        </div>

        <button
          type="button"
          onClick={novoUsuario}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(37,99,235,0.18)] transition hover:-translate-y-0.5 hover:bg-blue-700"
        >
          + Novo usuário
        </button>
      </header>

      {erro && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {sucesso}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Usuários cadastrados" valor={resumo.total} />
        <Kpi titulo="Acessos ativos" valor={resumo.ativos} destaque="green" />
        <Kpi
          titulo="Contratadores"
          valor={resumo.contratadores}
          destaque="amber"
        />
        <Kpi titulo="Administradores" valor={resumo.admins} destaque="violet" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.045)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_220px_auto]">
          <label className="grid gap-1.5">
            <span className="text-xs font-extrabold text-slate-500">
              Buscar usuário
            </span>
            <input
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              placeholder="Nome ou e-mail"
              className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-extrabold text-slate-500">
              Perfil
            </span>
            <select
              value={filtroPerfil}
              onChange={(e) =>
                setFiltroPerfil(
                  e.target.value as "todos" | TipoPermissao
                )
              }
              className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800"
            >
              <option value="todos">Todos os perfis</option>
              <option value="usuario">Usuário</option>
              <option value="contratador">Contratador</option>
              <option value="admin">Administrador</option>
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-extrabold text-slate-500">
              Situação
            </span>
            <select
              value={filtroSituacao}
              onChange={(e) =>
                setFiltroSituacao(
                  e.target.value as "todos" | "ativos" | "inativos"
                )
              }
              className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800"
            >
              <option value="todos">Todos</option>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void carregar()}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
            >
              Atualizar
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.045)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-sm font-extrabold text-slate-900">
            {carregando
              ? "Carregando usuários..."
              : `${filtrados.length.toLocaleString(
                  "pt-BR"
                )} usuário(s) no recorte`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full border-collapse text-left">
            <thead className="bg-slate-50">
              <tr className="text-[11px] font-black uppercase tracking-[0.06em] text-slate-500">
                <th className="px-5 py-3">Usuário</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Módulos liberados</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {!carregando &&
                filtrados.map((item) => {
                  const modulos = [
                    item.acesso_lista && "Lista",
                    item.acesso_dashboards && "Dashboards",
                    item.acesso_editais && "Editais",
                    item.acesso_permissoes && "Permissões",
                    item.acesso_configuracoes && "Configurações",
                  ].filter((modulo): modulo is string => Boolean(modulo));

                  return (
                    <tr
                      key={item.id}
                      className="border-t border-slate-100 transition hover:bg-blue-50/60"
                    >
                      <td className="px-5 py-4">
                        <strong className="block text-sm text-slate-900">
                          {item.nome || "Sem nome informado"}
                        </strong>
                        <span className="mt-0.5 block text-xs font-medium text-slate-500">
                          {item.email}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={[
                            "inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold",
                            badgePerfil(item.tipo_permissao),
                          ].join(" ")}
                        >
                          {ROTULO_PERMISSAO[item.tipo_permissao]}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={[
                            "inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold",
                            item.ativo
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-100 text-slate-600",
                          ].join(" ")}
                        >
                          {item.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex max-w-xl flex-wrap gap-1.5">
                          {modulos.map((modulo) => (
                            <span
                              key={modulo}
                              className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700"
                            >
                              {modulo}
                            </span>
                          ))}
                          {modulos.length === 0 && (
                            <span className="text-xs font-semibold text-slate-400">
                              Nenhum módulo
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => editar(item)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {!carregando && filtrados.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-sm font-semibold text-slate-500"
                  >
                    Nenhum usuário encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAberto && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
          <form
            onSubmit={salvar}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-emerald-700">
                  Controle de acesso
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  {form.id ? "Editar usuário" : "Novo usuário"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => !salvando && setModalAberto(false)}
                className="grid h-9 w-9 place-items-center rounded-full text-xl font-bold text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </header>

            <div className="space-y-6 px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs font-extrabold text-slate-500">
                    Nome
                  </span>
                  <input
                    value={form.nome}
                    onChange={(e) =>
                      setForm((atual) => ({
                        ...atual,
                        nome: e.target.value,
                      }))
                    }
                    className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 font-semibold"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-extrabold text-slate-500">
                    E-mail *
                  </span>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm((atual) => ({
                        ...atual,
                        email: e.target.value,
                      }))
                    }
                    className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 font-semibold"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-extrabold text-slate-500">
                    Perfil operacional
                  </span>
                  <select
                    value={form.tipo_permissao}
                    onChange={(e) =>
                      alterarPerfil(e.target.value as TipoPermissao)
                    }
                    className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 font-semibold"
                  >
                    <option value="usuario">Usuário</option>
                    <option value="contratador">Contratador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </label>

                <div className="flex items-end">
                  <div className="flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3">
                    <div>
                      <p className="text-sm font-extrabold text-slate-800">
                        Acesso ativo
                      </p>
                      <p className="text-xs text-slate-500">
                        Usuário pode entrar no sistema.
                      </p>
                    </div>
                    <Switch
                      checked={form.ativo}
                      disabled={form.tipo_permissao === "admin"}
                      onChange={(ativo) =>
                        setForm((atual) => ({
                          ...atual,
                          ativo,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <section>
                <div className="mb-3">
                  <h3 className="text-sm font-black text-slate-900">
                    Módulos disponíveis
                  </h3>
                  <p className="text-xs font-medium text-slate-500">
                    O perfil define as operações permitidas. Os módulos
                    controlam o que aparece e pode ser acessado na aplicação.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {MODULOS_SISTEMA.map((modulo) => {
                    const chave =
                      `acesso_${modulo}` as keyof Formulario;
                    const checked = Boolean(form[chave]);
                    const permitidoNoPerfil =
                      modulosPermitidosPorPerfil(form.tipo_permissao)[modulo];

                    return (
                      <div
                        key={modulo}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-extrabold text-slate-800">
                            {ROTULO_MODULO[modulo]}
                          </p>
                          {!permitidoNoPerfil && (
                            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                              Não disponível para este perfil.
                            </p>
                          )}
                        </div>

                        <Switch
                          checked={checked}
                          disabled={
                            form.tipo_permissao === "admin" ||
                            !permitidoNoPerfil
                          }
                          onChange={(valor) =>
                            alterarModulo(modulo, valor)
                          }
                        />
                      </div>
                    );
                  })}
                </div>

                {form.tipo_permissao === "admin" && (
                  <p className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs font-semibold text-violet-700">
                    Administradores possuem acesso a todos os módulos por
                    definição.
                  </p>
                )}
              </section>
            </div>

            <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
              <button
                type="button"
                disabled={salvando}
                onClick={() => setModalAberto(false)}
                className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="min-h-10 rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar permissão"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

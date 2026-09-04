"use client";

import {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  adicionarUsuario,
  excluirUsuario,
} from "@/app/actions/usuarios";

import { createClient } from "@/lib/supabase/client";

type TipoPermissao =
  | "usuario"
  | "contratador"
  | "admin";

type UsuarioPermissao = {
  id: string;

  auth_user_id:
    string | null;

  email: string;

  nome: string;

  tipo_permissao:
    TipoPermissao;
};

type Props = {
  usuariosIniciais: UsuarioPermissao[];

  emailUsuarioAtual: string;
};

export function GerenciamentoPermissoes({
  usuariosIniciais,
  emailUsuarioAtual,
}: Props) {
  const router = useRouter();

  const [usuarios, setUsuarios] =
    useState<UsuarioPermissao[]>(
      usuariosIniciais
    );

  const [modalAberto, setModalAberto] =
    useState(false);

  const [novoNome, setNovoNome] =
    useState("");

  const [novoEmail, setNovoEmail] =
    useState("");

  const [
    novaPermissao,
    setNovaPermissao,
  ] = useState<TipoPermissao>(
    "usuario"
  );

  const [
    processandoId,
    setProcessandoId,
  ] = useState<string | null>(
    null
  );

  const [criando, setCriando] =
    useState(false);

  const [erro, setErro] =
    useState("");

  const [sucesso, setSucesso] =
    useState("");

  /*
   * Quando router.refresh() trouxer uma
   * lista nova do servidor, atualizamos
   * o estado local também.
   */
  useEffect(() => {
    setUsuarios(
      usuariosIniciais
    );
  }, [usuariosIniciais]);

  function alterarUsuario(
    id: string,
    campo:
      | "nome"
      | "tipo_permissao",
    valor: string
  ) {
    setUsuarios((atuais) =>
      atuais.map((usuario) => {
        if (
          usuario.id !== id
        ) {
          return usuario;
        }

        return {
          ...usuario,

          [campo]:
            campo ===
            "tipo_permissao"
              ? (
                  valor as TipoPermissao
                )
              : valor,
        };
      })
    );
  }

  async function salvarUsuario(
    usuario: UsuarioPermissao
  ) {
    setErro("");
    setSucesso("");

    if (
      !usuario.nome.trim()
    ) {
      setErro(
        "O nome não pode ficar vazio."
      );

      return;
    }

    setProcessandoId(
      usuario.id
    );

    try {
      const supabase =
        createClient();

      const {
        data,
        error,
      } = await supabase
        .from("permissoes")
        .update({
          nome:
            usuario.nome.trim(),

          tipo_permissao:
            usuario.tipo_permissao,
        })
        .eq(
          "id",
          usuario.id
        )
        .select(`
          id,
          auth_user_id,
          email,
          nome,
          tipo_permissao
        `)
        .single();

      if (error) {
        throw error;
      }

      setUsuarios(
        (atuais) =>
          atuais.map(
            (item) =>
              item.id ===
              data.id
                ? (
                    data as UsuarioPermissao
                  )
                : item
          )
      );

      setSucesso(
        `Usuário ${data.email} atualizado com sucesso.`
      );

      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o usuário."
      );

      router.refresh();
    } finally {
      setProcessandoId(
        null
      );
    }
  }

  async function criarUsuario(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErro("");
    setSucesso("");
    setCriando(true);

    try {
      const resultado =
        await adicionarUsuario({
          nome:
            novoNome,

          email:
            novoEmail,

          tipoPermissao:
            novaPermissao,
        });

      if (
        !resultado.sucesso
      ) {
        setErro(
          resultado.mensagem
        );

        return;
      }

      setSucesso(
        resultado.mensagem
      );

      setNovoNome("");
      setNovoEmail("");

      setNovaPermissao(
        "usuario"
      );

      setModalAberto(
        false
      );

      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível convidar o usuário."
      );
    } finally {
      setCriando(false);
    }
  }

  async function removerUsuario(
    usuario: UsuarioPermissao
  ) {
    const confirmou =
      window.confirm(
        `Excluir usuário?\n\n${usuario.nome}\n${usuario.email}\n\nO usuário perderá o acesso ao sistema.`
      );

    if (!confirmou) {
      return;
    }

    setErro("");
    setSucesso("");

    setProcessandoId(
      usuario.id
    );

    try {
      const resultado =
        await excluirUsuario(
          usuario.id
          );
      if (
        !resultado.sucesso
      ) {
        setErro(
          resultado.mensagem
        );

        return;
      }

      setUsuarios(
        (atuais) =>
          atuais.filter(
            (item) =>
              item.id !==
              usuario.id
          )
      );

      setSucesso(
        resultado.mensagem
      );

      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o usuário."
      );
    } finally {
      setProcessandoId(
        null
      );
    }
  }

  return (
    <>
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

      {/* BOTÃO NOVO USUÁRIO */}

      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setErro("");
            setSucesso("");

            setModalAberto(
              true
            );
          }}
          className="rounded-lg bg-[#094780] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          + Novo usuário
        </button>
      </div>

      {/* TABELA */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-medium text-slate-900">
            Usuários cadastrados
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {usuarios.length} usuário
            {usuarios.length === 1
              ? ""
              : "s"}{" "}
            cadastrado
            {usuarios.length === 1
              ? ""
              : "s"}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Nome
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  E-mail
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Permissão
                </th>

                <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {usuarios.map(
                (usuario) => {
                  const ehPropriaConta =
                    usuario.email
                      .toLowerCase() ===
                    emailUsuarioAtual
                      .toLowerCase();

                  const processando =
                    processandoId ===
                    usuario.id;

                  return (
                    <tr
                      key={
                        usuario.id
                      }
                    >
                      <td className="px-5 py-4">
                        <input
                          type="text"
                          value={
                            usuario.nome
                          }
                          disabled={
                            processando
                          }
                          onChange={(
                            event
                          ) =>
                            alterarUsuario(
                              usuario.id,
                              "nome",
                              event
                                .target
                                .value
                            )
                          }
                          className="w-full min-w-[180px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {
                          usuario.email
                        }

                        {ehPropriaConta && (
                          <span className="ml-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                            Sua conta
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <select
                          value={
                            usuario.tipo_permissao
                          }
                          disabled={
                            processando ||
                            ehPropriaConta
                          }
                          onChange={(
                            event
                          ) =>
                            alterarUsuario(
                              usuario.id,
                              "tipo_permissao",
                              event
                                .target
                                .value
                            )
                          }
                          className="w-full min-w-[170px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                        >
                          <option value="usuario">
                            Usuário
                          </option>

                          <option value="contratador">
                            Contratador
                          </option>

                          <option value="admin">
                            Administrador
                          </option>
                        </select>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={
                              processando
                            }
                            onClick={() =>
                              salvarUsuario(
                                usuario
                              )
                            }
                            className="rounded-lg bg-[#094780] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {processando
                              ? "Salvando..."
                              : "Salvar"}
                          </button>

                          {!ehPropriaConta && (
                            <button
                              type="button"
                              disabled={
                                processando
                              }
                              onClick={() =>
                                removerUsuario(
                                  usuario
                                )
                              }
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              Excluir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL NOVO USUÁRIO */}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Novo usuário
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Cadastre o e-mail que terá acesso ao sistema.
                </p>
              </div>

              <button
                type="button"
                disabled={criando}
                onClick={() =>
                  setModalAberto(
                    false
                  )
                }
                className="text-2xl leading-none text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                criarUsuario
              }
              className="p-6"
            >
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Nome *
                  </label>

                  <input
                    type="text"
                    required
                    value={
                      novoNome
                    }
                    onChange={(
                      event
                    ) =>
                      setNovoNome(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      criando
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    E-mail *
                  </label>

                  <input
                    type="email"
                    required
                    value={
                      novoEmail
                    }
                    onChange={(
                      event
                    ) =>
                      setNovoEmail(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      criando
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Permissão *
                  </label>

                  <select
                    value={
                      novaPermissao
                    }
                    onChange={(
                      event
                    ) =>
                      setNovaPermissao(
                        event
                          .target
                          .value as TipoPermissao
                      )
                    }
                    disabled={
                      criando
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                  >
                    <option value="usuario">
                      Usuário
                    </option>

                    <option value="contratador">
                      Contratador
                    </option>

                    <option value="admin">
                      Administrador
                    </option>
                  </select>
                </div>
              </div>

              <div className="mt-7 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={
                    criando
                  }
                  onClick={() =>
                    setModalAberto(
                      false
                    )
                  }
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    criando
                  }
                  className="rounded-lg bg-[#094780] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {criando
                    ? "Adicionando..."
                    : "Adicionar usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent, ReactNode } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ContextoAcesso } from "@/lib/acesso/modulos";
import { podeOperarLista } from "@/lib/acesso/modulos";

const PAGE_SIZE = 50;

const STATUS_PERMITIDOS = [
  "Aprovado",
  "Convocado",
  "Contratado",
  "Desistente",
  "Documentação Rejeitada",
  "Migração",
] as const;

type StatusLista = (typeof STATUS_PERMITIDOS)[number];

type Registro = {
  id: string;
  edital_id: string;
  processo_seletivo: string;
  edital: string;
  unidade: string | null;
  status_edital: boolean;
  edital_data_inicio: string | null;
  edital_data_fim: string | null;
  prazo_validade: string;
  codigo_vaga: string;
  cargo: string;
  classificacao: number | null;
  nota: number | string;
  nome: string;
  modalidade_candidatura: string | null;
  status: StatusLista;
  processo_sei: string | null;
  matricula: string | null;
  data_contratacao: string | null;
  sub_judice: boolean;
  origem_cadastro: "IMPORTACAO" | "SUB_JUDICE";
};

type EditalOpcao = {
  id: string;
  edital: string;
  processo_seletivo: string;
  unidade: string | null;
  status_edital: boolean;
};

type Opcoes = {
  unidades: string[];
  editais: EditalOpcao[];
  cargos: string[];
  codigos_vaga: string[];
  status: string[];
};

type Resumo = {
  total: number;
  aprovado: number;
  convocado: number;
  contratado: number;
  desistente: number;
  documentacao_rejeitada: number;
  migracao: number;
  sub_judice: number;
};

type Filtros = {
  busca: string;
  unidade: string;
  editalId: string;
  cargo: string;
  codigoVaga: string;
  status: string;
  subJudice: "" | "sim" | "nao";
};

const FILTROS_INICIAIS: Filtros = {
  busca: "",
  unidade: "",
  editalId: "",
  cargo: "",
  codigoVaga: "",
  status: "",
  subJudice: "",
};

const RESUMO_VAZIO: Resumo = {
  total: 0,
  aprovado: 0,
  convocado: 0,
  contratado: 0,
  desistente: 0,
  documentacao_rejeitada: 0,
  migracao: 0,
  sub_judice: 0,
};

function numero(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatarNota(value: number | string) {
  return numero(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatarData(value: string | null) {
  if (!value) return "—";

  const partes = value.slice(0, 10).split("-");
  if (partes.length !== 3) return value;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function classeStatus(status: string) {
  switch (status) {
    case "Aprovado":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Convocado":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "Contratado":
      return "border-teal-200 bg-teal-50 text-teal-700";
    case "Desistente":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Documentação Rejeitada":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "Migração":
      return "border-violet-200 bg-violet-50 text-violet-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function Kpi({
  titulo,
  valor,
  cor,
}: {
  titulo: string;
  valor: number;
  cor: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_4px_18px_rgba(15,23,42,0.045)]">
      <span className={`absolute inset-x-0 top-0 h-[3px] ${cor}`} />
      <p className="text-[11px] font-black uppercase tracking-[0.06em] text-slate-500">
        {titulo}
      </p>
      <strong className="mt-2 block text-2xl font-black tracking-tight text-slate-950">
        {valor.toLocaleString("pt-BR")}
      </strong>
    </article>
  );
}

export function ListaAprovadosV2() {
  const [contexto, setContexto] = useState<ContextoAcesso | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [opcoes, setOpcoes] = useState<Opcoes>({
    unidades: [],
    editais: [],
    cargos: [],
    codigos_vaga: [],
    status: [],
  });
  const [resumo, setResumo] = useState<Resumo>(RESUMO_VAZIO);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [detalhe, setDetalhe] = useState<Registro | null>(null);
  const [edicao, setEdicao] = useState<Registro | null>(null);

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const podeEditar = podeOperarLista(contexto);

  const carregarContexto = useCallback(async () => {
    try {
      const supabase = createClient() as any;
      const { data, error } = await supabase.rpc("obter_contexto_acesso");
      if (error) throw error;
      setContexto((data ?? null) as ContextoAcesso | null);
    } catch {
      setContexto(null);
    }
  }, []);

  const carregarOpcoes = useCallback(async () => {
    const supabase = createClient() as any;
    const { data, error } = await supabase.rpc(
      "obter_opcoes_lista_aprovados"
    );

    if (error) throw error;

    const valor = (data ?? {}) as Partial<Opcoes>;

    setOpcoes({
      unidades: valor.unidades ?? [],
      editais: valor.editais ?? [],
      cargos: valor.cargos ?? [],
      codigos_vaga: valor.codigos_vaga ?? [],
      status: valor.status ?? [],
    });
  }, []);

  const parametrosResumo = useCallback(() => {
    return {
      p_edital_id: filtros.editalId || null,
      p_unidade: filtros.unidade || null,
      p_cargo: filtros.cargo || null,
      p_codigo_vaga: filtros.codigoVaga || null,
      p_status: filtros.status || null,
      p_busca: filtros.busca.trim() || null,
      p_sub_judice:
        filtros.subJudice === ""
          ? null
          : filtros.subJudice === "sim",
    };
  }, [filtros]);

  const carregarResumo = useCallback(async () => {
    const supabase = createClient() as any;
    const { data, error } = await supabase.rpc(
      "resumo_lista_aprovados",
      parametrosResumo()
    );

    if (error) throw error;
    setResumo({ ...RESUMO_VAZIO, ...(data ?? {}) });
  }, [parametrosResumo]);

  const carregarRegistros = useCallback(async () => {
    setCarregando(true);
    setErro("");

    try {
      const supabase = createClient() as any;

      let query = supabase
        .from("vw_lista_aprovados_operacional")
        .select("*", { count: "exact" });

      if (filtros.editalId) {
        query = query.eq("edital_id", filtros.editalId);
      }

      if (filtros.unidade) {
        query = query.eq("unidade", filtros.unidade);
      }

      if (filtros.cargo) {
        query = query.eq("cargo", filtros.cargo);
      }

      if (filtros.codigoVaga) {
        query = query.eq("codigo_vaga", filtros.codigoVaga);
      }

      if (filtros.status) {
        query = query.eq("status", filtros.status);
      }

      if (filtros.subJudice) {
        query = query.eq(
          "sub_judice",
          filtros.subJudice === "sim"
        );
      }

      const termo = filtros.busca
        .trim()
        .replace(/[(),]/g, " ");

      if (termo) {
        query = query.or(
          [
            `nome.ilike.%${termo}%`,
            `matricula.ilike.%${termo}%`,
            `processo_sei.ilike.%${termo}%`,
          ].join(",")
        );
      }

      const inicio = (pagina - 1) * PAGE_SIZE;
      const fim = inicio + PAGE_SIZE - 1;

      const { data, error, count } = await query
        .order("edital", { ascending: true })
        .order("cargo", { ascending: true })
        .order("classificacao", { ascending: true })
        .range(inicio, fim);

      if (error) throw error;

      setRegistros((data ?? []) as Registro[]);
      setTotal(count ?? 0);
      await carregarResumo();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar a lista de aprovados."
      );
    } finally {
      setCarregando(false);
    }
  }, [filtros, pagina, carregarResumo]);

  useEffect(() => {
    void Promise.all([
      carregarContexto(),
      carregarOpcoes(),
    ]).catch((e) => {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar o módulo."
      );
    });
  }, [carregarContexto, carregarOpcoes]);

  useEffect(() => {
    void carregarRegistros();
  }, [carregarRegistros]);

  const editaisFiltrados = useMemo(() => {
    if (!filtros.unidade) return opcoes.editais;

    return opcoes.editais.filter(
      (item) => item.unidade === filtros.unidade
    );
  }, [opcoes.editais, filtros.unidade]);

  function alterarFiltro<K extends keyof Filtros>(
    chave: K,
    valor: Filtros[K]
  ) {
    setPagina(1);
    setFiltros((atual) => ({
      ...atual,
      [chave]: valor,
      ...(chave === "unidade" ? { editalId: "" } : {}),
    }));
  }

  function limparFiltros() {
    setPagina(1);
    setFiltros(FILTROS_INICIAIS);
  }

  async function aposAlteracao() {
    setEdicao(null);
    setDetalhe(null);
    setSucesso("Registro atualizado com sucesso.");
    await carregarRegistros();
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
          Recrutamento e seleção
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
          Lista de aprovados
        </h1>
        <p className="mt-1 max-w-4xl text-sm font-medium text-slate-500">
          Acompanhe convocação e contratação com recorte por unidade,
          edital, vaga, cargo e status. A unidade é herdada diretamente
          do cadastro do edital.
        </p>
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

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <Kpi titulo="Total na lista" valor={resumo.total} cor="bg-blue-600" />
        <Kpi
          titulo="Aprovados"
          valor={resumo.aprovado}
          cor="bg-emerald-600"
        />
        <Kpi
          titulo="Convocados"
          valor={resumo.convocado}
          cor="bg-cyan-600"
        />
        <Kpi
          titulo="Contratados"
          valor={resumo.contratado}
          cor="bg-teal-600"
        />
        <Kpi
          titulo="Desistentes"
          valor={resumo.desistente}
          cor="bg-amber-500"
        />
        <Kpi
          titulo="Doc. rejeitada"
          valor={resumo.documentacao_rejeitada}
          cor="bg-rose-500"
        />
        <Kpi
          titulo="Sub judice"
          valor={resumo.sub_judice}
          cor="bg-violet-600"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.045)]">
        <div className="grid gap-3 lg:grid-cols-3 2xl:grid-cols-7">
          <label className="grid gap-1.5 lg:col-span-2 2xl:col-span-2">
            <span className="text-xs font-extrabold text-slate-500">
              Buscar
            </span>
            <input
              value={filtros.busca}
              onChange={(e) => alterarFiltro("busca", e.target.value)}
              placeholder="Candidato, matrícula ou processo SEI"
              className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <CampoSelect
            label="Unidade"
            value={filtros.unidade}
            onChange={(v) => alterarFiltro("unidade", v)}
          >
            <option value="">Todas as unidades</option>
            {opcoes.unidades.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </CampoSelect>

          <CampoSelect
            label="Edital"
            value={filtros.editalId}
            onChange={(v) => alterarFiltro("editalId", v)}
          >
            <option value="">Todos os editais</option>
            {editaisFiltrados.map((item) => (
              <option key={item.id} value={item.id}>
                {item.edital}
                {item.unidade ? ` · ${item.unidade}` : ""}
              </option>
            ))}
          </CampoSelect>

          <CampoSelect
            label="Cargo"
            value={filtros.cargo}
            onChange={(v) => alterarFiltro("cargo", v)}
          >
            <option value="">Todos os cargos</option>
            {opcoes.cargos.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </CampoSelect>

          <CampoSelect
            label="Código da vaga"
            value={filtros.codigoVaga}
            onChange={(v) => alterarFiltro("codigoVaga", v)}
          >
            <option value="">Todas as vagas</option>
            {opcoes.codigos_vaga.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </CampoSelect>

          <CampoSelect
            label="Status"
            value={filtros.status}
            onChange={(v) => alterarFiltro("status", v)}
          >
            <option value="">Todos os status</option>
            {STATUS_PERMITIDOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </CampoSelect>

          <CampoSelect
            label="Sub judice"
            value={filtros.subJudice}
            onChange={(v) =>
              alterarFiltro(
                "subJudice",
                v as "" | "sim" | "nao"
              )
            }
          >
            <option value="">Todos</option>
            <option value="sim">Somente Sub judice</option>
            <option value="nao">Sem Sub judice</option>
          </CampoSelect>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-500">
            {total.toLocaleString("pt-BR")} registro(s) encontrados.
          </p>

          <button
            type="button"
            onClick={limparFiltros}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Limpar filtros
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.045)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-sm font-black text-slate-950">
              Fila operacional
            </p>
            <p className="text-xs font-medium text-slate-500">
              Página {pagina} de {totalPaginas}
            </p>
          </div>

          {contexto && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
              {podeEditar ? "Modo operacional" : "Somente leitura"}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1350px] w-full border-collapse text-left">
            <thead className="bg-slate-50">
              <tr className="text-[11px] font-black uppercase tracking-[0.06em] text-slate-500">
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3">Edital</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3 text-center">Class.</th>
                <th className="px-4 py-3">Candidato</th>
                <th className="px-4 py-3">Modalidade</th>
                <th className="px-4 py-3 text-right">Nota</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Matrícula</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {!carregando &&
                registros.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-slate-100 transition hover:bg-blue-50/60"
                  >
                    <td className="max-w-[210px] px-4 py-3 text-xs font-semibold text-slate-600">
                      {item.unidade || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm font-extrabold text-slate-800">
                      {item.edital}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-600">
                      {item.codigo_vaga}
                    </td>
                    <td className="max-w-[300px] px-4 py-3 text-sm font-semibold text-slate-700">
                      {item.cargo}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-black text-slate-700">
                      {item.sub_judice
                        ? "SJ"
                        : item.classificacao ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <strong className="block text-sm text-slate-950">
                        {item.nome}
                      </strong>
                      {item.sub_judice && (
                        <span className="mt-1 inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-black text-violet-700">
                          SUB JUDICE
                        </span>
                      )}
                    </td>
                    <td className="max-w-[200px] px-4 py-3 text-xs font-semibold text-slate-600">
                      {item.modalidade_candidatura || "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-black text-slate-800">
                      {formatarNota(item.nota)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-extrabold",
                          classeStatus(item.status),
                        ].join(" ")}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                      {item.matricula || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDetalhe(item)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                        >
                          Detalhes
                        </button>

                        {podeEditar && item.status_edital && (
                          <button
                            type="button"
                            onClick={() => setEdicao(item)}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-700 hover:bg-blue-100"
                          >
                            Alterar status
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

              {!carregando && registros.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-5 py-14 text-center text-sm font-semibold text-slate-500"
                  >
                    Nenhum candidato encontrado para o recorte selecionado.
                  </td>
                </tr>
              )}

              {carregando && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-5 py-14 text-center text-sm font-semibold text-slate-500"
                  >
                    Carregando lista...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <p className="text-xs font-semibold text-slate-500">
            Exibindo até {PAGE_SIZE} registros por página.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagina <= 1 || carregando}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-700 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={pagina >= totalPaginas || carregando}
              onClick={() =>
                setPagina((p) => Math.min(totalPaginas, p + 1))
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-700 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </footer>
      </section>

      {detalhe && (
        <DetalhesDrawer
          registro={detalhe}
          podeEditar={podeEditar && detalhe.status_edital}
          onClose={() => setDetalhe(null)}
          onEditar={() => {
            setEdicao(detalhe);
            setDetalhe(null);
          }}
        />
      )}

      {edicao && (
        <AlterarStatusModalV2
          registro={edicao}
          onClose={() => setEdicao(null)}
          onSuccess={() => void aposAlteracao()}
        />
      )}
    </div>
  );
}

function CampoSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-extrabold text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800"
      >
        {children}
      </select>
    </label>
  );
}

function DetalhesDrawer({
  registro,
  podeEditar,
  onClose,
  onEditar,
}: {
  registro: Registro;
  podeEditar: boolean;
  onClose: () => void;
  onEditar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/40 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <aside className="absolute inset-y-0 right-0 z-10 w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.1em] text-emerald-700">
              Detalhamento do candidato
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              {registro.nome}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={[
                  "rounded-full border px-2.5 py-1 text-xs font-extrabold",
                  classeStatus(registro.status),
                ].join(" ")}
              >
                {registro.status}
              </span>
              {registro.sub_judice && (
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-extrabold text-violet-700">
                  Sub judice
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-xl font-bold text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </header>

        <div className="space-y-4 p-6">
          <Bloco titulo="Seleção">
            <GradeDetalhes>
              <Dado label="Unidade" value={registro.unidade || "—"} />
              <Dado label="Edital" value={registro.edital} />
              <Dado label="Código da vaga" value={registro.codigo_vaga} />
              <Dado label="Cargo" value={registro.cargo} />
            </GradeDetalhes>
          </Bloco>

          <Bloco titulo="Resultado">
            <GradeDetalhes>
              <Dado
                label="Classificação"
                value={
                  registro.sub_judice
                    ? "Sub judice"
                    : String(registro.classificacao ?? "—")
                }
              />
              <Dado label="Nota" value={formatarNota(registro.nota)} />
              <Dado
                label="Modalidade"
                value={registro.modalidade_candidatura || "—"}
              />
              <Dado
                label="Origem"
                value={
                  registro.origem_cadastro === "SUB_JUDICE"
                    ? "Sub judice"
                    : "Importação"
                }
              />
            </GradeDetalhes>
          </Bloco>

          <Bloco titulo="Acompanhamento">
            <GradeDetalhes>
              <Dado label="Status atual" value={registro.status} />
              <Dado
                label="Processo SEI"
                value={registro.processo_sei || "—"}
              />
              <Dado label="Matrícula" value={registro.matricula || "—"} />
              <Dado
                label="Data da contratação"
                value={formatarData(registro.data_contratacao)}
              />
            </GradeDetalhes>
          </Bloco>

          <Bloco titulo="Edital">
            <GradeDetalhes>
              <Dado
                label="Situação"
                value={registro.status_edital ? "Ativo" : "Inativo"}
              />
              <Dado
                label="Início"
                value={formatarData(registro.edital_data_inicio)}
              />
              <Dado
                label="Fim"
                value={formatarData(registro.edital_data_fim)}
              />
              <Dado label="Prazo" value={registro.prazo_validade || "—"} />
            </GradeDetalhes>
          </Bloco>

          {podeEditar && (
            <button
              type="button"
              onClick={onEditar}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-blue-700"
            >
              Alterar status
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function Bloco({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-black text-slate-900">{titulo}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function GradeDetalhes({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Dado({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.06em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-extrabold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function AlterarStatusModalV2({
  registro,
  onClose,
  onSuccess,
}: {
  registro: Registro;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState<StatusLista>(registro.status);
  const [processoSei, setProcessoSei] = useState(
    registro.processo_sei ?? ""
  );
  const [matricula, setMatricula] = useState(registro.matricula ?? "");
  const [dataContratacao, setDataContratacao] = useState(
    registro.data_contratacao?.slice(0, 10) ?? ""
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setErro("");

    if (status === "Contratado" && !matricula.trim()) {
      setErro("Informe a matrícula para registrar a contratação.");
      return;
    }

    if (status === "Contratado" && !dataContratacao) {
      setErro("Informe a data da contratação.");
      return;
    }

    setSalvando(true);

    try {
      const supabase = createClient() as any;

      const payload: Record<string, unknown> = {
        status,
        processo_sei: processoSei.trim() || null,
      };

      if (status === "Contratado") {
        payload.matricula = matricula.trim();
        payload.data_contratacao = dataContratacao;
      }

      const { error } = await supabase
        .from("lista_aprovados")
        .update(payload)
        .eq("id", registro.id);

      if (error) throw error;

      onSuccess();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível alterar o status."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
      <form
        onSubmit={salvar}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.1em] text-blue-700">
              Acompanhamento
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Alterar status
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {registro.nome}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="grid h-9 w-9 place-items-center rounded-full text-xl font-bold text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </header>

        <div className="space-y-4 px-6 py-5">
          {erro && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {erro}
            </div>
          )}

          <label className="grid gap-1.5">
            <span className="text-xs font-extrabold text-slate-500">
              Status
            </span>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as StatusLista)
              }
              className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 font-semibold"
            >
              {STATUS_PERMITIDOS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-extrabold text-slate-500">
              Processo SEI
            </span>
            <input
              value={processoSei}
              onChange={(e) => setProcessoSei(e.target.value)}
              className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 font-semibold"
            />
          </label>

          {status === "Contratado" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-extrabold text-slate-500">
                  Matrícula *
                </span>
                <input
                  required
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 font-semibold"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-extrabold text-slate-500">
                  Data da contratação *
                </span>
                <input
                  type="date"
                  required
                  value={dataContratacao}
                  onChange={(e) => setDataContratacao(e.target.value)}
                  className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 font-semibold"
                />
              </label>
            </div>
          )}

          {!registro.status_edital && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
              Este edital está inativo. O banco bloqueará alterações de
              status.
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            disabled={salvando}
            onClick={onClose}
            className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando || !registro.status_edital}
            className="min-h-10 rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </footer>
      </form>
    </div>
  );
}

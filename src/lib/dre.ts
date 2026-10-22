/**
 * Utilitários compartilhados da DRE Gerencial do Grupo R3.
 *
 * Centraliza tipos, normalização de grupos, filtros de escopo e o cálculo
 * mês a mês das linhas gerenciais (faturamento, margem, despesas, lucro,
 * comissão de parceiro e distribuição), usados pela Visão Geral e pelos
 * gráficos de indicadores.
 */

// ─── Tipos das tabelas (Supabase) ────────────────────────────────────────────

export interface Servidor {
  servidor_id: number;
  nome: string;
  ativo: boolean;
  [key: string]: unknown;
}

export interface Subloja {
  cidade_id: number;
  servidor_id: number;
  nome: string;
  ativo: boolean;
  [key: string]: unknown;
}

export interface FaturamentoRow {
  mes_inicio: string | null;
  total_faturamento: number | string | null;
  cmv?: number | string | null;
  id_servidor?: number | string | null;
  id_cidade?: number | string | null;
  loja?: string | null;
  cidade?: string | null;
  [key: string]: unknown;
}

export interface DreRow {
  id?: number;
  mes_inicio: string | null;
  debito: number | string | null;
  credito?: number | string | null;
  grupo_dre?: string | null;
  conta_padronizada?: string | null;
  descricao_conta?: string | null;
  codigo_conta?: string | null;
  natureza?: string | null;
  id_servidor?: number | string | null;
  id_cidade?: number | string | null;
  loja?: string | null;
  cidade?: string | null;
  dados_extra?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface ReceberRow {
  id?: number;
  mes_inicio: string | null;
  mes_fim?: string | null;
  debito?: number | string | null;
  credito?: number | string | null;
  valor_liquido?: number | string | null;
  grupo_dre?: string | null;
  categoria?: string | null;
  conta_padronizada?: string | null;
  descricao_conta?: string | null;
  codigo_conta?: string | null;
  natureza?: string | null;
  id_servidor?: number | string | null;
  id_cidade?: number | string | null;
  loja?: string | null;
  cidade?: string | null;
  dados_extra?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface ParceiroRegra {
  id: number;
  parceiro_nome: string;
  servidor_id?: number | null;
  servidor_nome?: string | null;
  cidade_id?: number | null;
  cidade_nome?: string | null;
  percentual_comissao: number;
  observacao?: string | null;
  ativo: boolean;
}

// ─── Meses ───────────────────────────────────────────────────────────────────

export const MONTH_KEYS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;
export const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MONTH_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function extractMonthStr(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split("-");
  if (parts.length >= 2) {
    const m = parts[1].padStart(2, "0");
    if (Number(m) >= 1 && Number(m) <= 12) return m;
  }
  return null;
}

export function extractYearStr(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split("-");
  if (parts.length >= 1 && parts[0]) return parts[0];
  return null;
}

/** Chave "YYYY-MM" de uma data ISO; null se inválida. */
export function extractYearMonth(dateStr?: string | null): string | null {
  const y = extractYearStr(dateStr);
  const m = extractMonthStr(dateStr);
  if (!y || !m) return null;
  return `${y}-${m}`;
}

export function monthLabel(yearMonth: string, withYear = false): string {
  const [y, m] = yearMonth.split("-");
  const short = MONTH_SHORT[Number(m) - 1] ?? m;
  return withYear ? `${short}/${y.slice(2)}` : short;
}

// ─── Formatação ──────────────────────────────────────────────────────────────

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatCompactBRL(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}R$ ${Math.round(abs / 1000)}k`;
  return `${sign}R$ ${Math.round(abs)}`;
}

export function formatPercent(value: number): string {
  return (
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value || 0) + "%"
  );
}

// ─── Grupos gerenciais ───────────────────────────────────────────────────────

export type GroupId =
  | "avarias"
  | "desp_adm"
  | "desp_log"
  | "taxas_cartao"
  | "tributos"
  | "investimentos"
  | "nao_operacionais";

export interface GroupDef {
  id: GroupId;
  label: string;
  /** Cor do grupo nos gráficos (paleta Data Hub). */
  color: string;
}

export const GROUP_DEFS: GroupDef[] = [
  { id: "avarias", label: "Avarias", color: "#ca8a04" },
  { id: "desp_adm", label: "Despesas Administrativas", color: "#0d9488" },
  { id: "desp_log", label: "Despesa Logística", color: "#2563eb" },
  { id: "taxas_cartao", label: "Taxas de Cartão", color: "#7c3aed" },
  { id: "tributos", label: "Tributos", color: "#ea580c" },
  { id: "investimentos", label: "Investimentos", color: "#0891b2" },
  { id: "nao_operacionais", label: "Outras / Não Operacionais", color: "#64748b" },
];

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Normaliza o texto de `grupo_dre` (que chega com variações de acento e
 * plural) para o id gerencial. Sem grupo → Despesas Administrativas,
 * mesmo padrão da tela de DRE.
 */
export function normalizeGroupId(group?: string | null): GroupId {
  const g = stripAccents(String(group ?? "").trim().toLowerCase());
  if (!g) return "desp_adm";
  if (g.includes("avaria")) return "avarias";
  if (g.includes("logist")) return "desp_log";
  if (g.includes("cart")) return "taxas_cartao";
  if (g.includes("tribut")) return "tributos";
  if (g.includes("investimento")) return "investimentos";
  if (g.includes("nao operac") || g.includes("outras")) return "nao_operacionais";
  if (g.includes("administrativ")) return "desp_adm";
  return "desp_adm";
}

// ─── Regras de parceiro ──────────────────────────────────────────────────────

export interface StoreRef {
  id_servidor?: number | string | null;
  id_cidade?: number | string | null;
  loja?: string | null;
  cidade?: string | null;
}

export function getRuleForStore(store: StoreRef, rules: ParceiroRegra[]): ParceiroRegra | null {
  if (!rules || rules.length === 0) return null;

  if (store.id_cidade) {
    const match = rules.find((r) => r.cidade_id && String(r.cidade_id) === String(store.id_cidade));
    if (match) return match;
  }

  if (store.cidade && store.cidade.trim().toLowerCase() !== "matriz") {
    const cidNorm = store.cidade.trim().toLowerCase();
    const match = rules.find((r) => r.cidade_nome && r.cidade_nome.trim().toLowerCase() === cidNorm);
    if (match) return match;
  }

  if (store.id_servidor) {
    const match = rules.find((r) => !r.cidade_id && String(r.servidor_id) === String(store.id_servidor));
    if (match) return match;
  }

  if (store.loja) {
    const lojaNorm = store.loja.trim().toLowerCase();
    const match = rules.find(
      (r) => !r.cidade_id && r.servidor_nome && r.servidor_nome.trim().toLowerCase() === lojaNorm,
    );
    if (match) return match;
  }

  return null;
}

// ─── Filtros de escopo ───────────────────────────────────────────────────────

export interface ScopeFilters {
  /** Ano "YYYY" ou "todos". */
  year: string;
  /** Meses "MM"; lista vazia = todos. */
  months: string[];
  /** Ids de servidor (loja matriz); vazio = todas. */
  servidores: string[];
  /** Ids de cidade (filial); vazio = todas. */
  cidades: string[];
}

interface ScopeRow {
  mes_inicio: string | null;
  id_servidor?: number | string | null;
  id_cidade?: number | string | null;
}

export function filterByScope<T extends ScopeRow>(
  rows: T[],
  scope: ScopeFilters,
  activeServidorIds: Set<number>,
  activeSublojaIds: Set<number>,
  options: { ignoreMonths?: boolean } = {},
): T[] {
  const months = new Set(scope.months);
  const srv = new Set(scope.servidores);
  const cid = new Set(scope.cidades);

  return rows.filter((item) => {
    if (item.id_servidor && !activeServidorIds.has(Number(item.id_servidor))) return false;
    if (item.id_cidade && !activeSublojaIds.has(Number(item.id_cidade))) return false;
    if (scope.year !== "todos" && extractYearStr(item.mes_inicio) !== scope.year) return false;
    if (!options.ignoreMonths && months.size > 0 && !months.has(extractMonthStr(item.mes_inicio) ?? "")) return false;
    if (srv.size > 0 && !srv.has(String(item.id_servidor))) return false;
    if (cid.size > 0 && !cid.has(String(item.id_cidade))) return false;
    return true;
  });
}

// ─── Cálculo das linhas gerenciais ───────────────────────────────────────────

export interface DreValues {
  faturamento: number;
  receita: number;
  cmv: number;
  avarias: number;
  /** Faturamento - CMV - Avarias */
  margem: number;
  adm: number;
  log: number;
  cartao: number;
  tributos: number;
  /** Adm + Log + Cartão + Tributos */
  despesas: number;
  /** Margem - Despesas */
  lucro: number;
  comissao: number;
  /** Lucro - Comissão */
  distribuicao: number;
  investimentos: number;
  naoOper: number;
  /** Adm + Log */
  fixas: number;
  /** Avarias + Cartão + Tributos */
  variaveis: number;
}

export function emptyDreValues(): DreValues {
  return {
    faturamento: 0, receita: 0, cmv: 0, avarias: 0, margem: 0,
    adm: 0, log: 0, cartao: 0, tributos: 0, despesas: 0,
    lucro: 0, comissao: 0, distribuicao: 0,
    investimentos: 0, naoOper: 0, fixas: 0, variaveis: 0,
  };
}

function finalizeValues(v: DreValues): DreValues {
  v.margem = v.faturamento - v.cmv - v.avarias;
  v.despesas = v.adm + v.log + v.cartao + v.tributos;
  v.lucro = v.margem - v.despesas;
  v.distribuicao = v.lucro - v.comissao;
  v.fixas = v.adm + v.log;
  v.variaveis = v.avarias + v.cartao + v.tributos;
  return v;
}

export function sumDreValues(list: DreValues[]): DreValues {
  const acc = emptyDreValues();
  list.forEach((v) => {
    acc.faturamento += v.faturamento;
    acc.receita += v.receita;
    acc.cmv += v.cmv;
    acc.avarias += v.avarias;
    acc.adm += v.adm;
    acc.log += v.log;
    acc.cartao += v.cartao;
    acc.tributos += v.tributos;
    acc.comissao += v.comissao;
    acc.investimentos += v.investimentos;
    acc.naoOper += v.naoOper;
  });
  return finalizeValues(acc);
}

export interface DreSeriesPoint {
  /** "YYYY-MM" */
  key: string;
  /** "jan" ou "jan/26" */
  label: string;
  values: DreValues;
}

function storeKey(r: StoreRef): string {
  return `${r.id_servidor || 0}__${r.id_cidade || 0}__${r.loja || ""}__${r.cidade || ""}`;
}

/**
 * Calcula a DRE gerencial mês a mês (chave "YYYY-MM") a partir do faturamento
 * e dos lançamentos já filtrados. A comissão de parceiro é apurada loja a loja
 * sobre o lucro líquido positivo de cada mês, conforme as regras ativas.
 */
export function computeDreSeries(
  fat: FaturamentoRow[],
  dre: DreRow[],
  rules: ParceiroRegra[],
  options: { labelWithYear?: boolean; fillYear?: string | null } = {},
  receber?: ReceberRow[],
): DreSeriesPoint[] {
  // Agrupa por loja e mês para apurar comissão por loja
  const stores = new Map<string, { ref: StoreRef; months: Map<string, DreValues> }>();

  const getStoreMonth = (ref: StoreRef, ym: string): DreValues => {
    const k = storeKey(ref);
    let s = stores.get(k);
    if (!s) {
      s = { ref, months: new Map() };
      stores.set(k, s);
    }
    let v = s.months.get(ym);
    if (!v) {
      v = emptyDreValues();
      s.months.set(ym, v);
    }
    return v;
  };

  fat.forEach((item) => {
    const ym = extractYearMonth(item.mes_inicio);
    if (!ym) return;
    const v = getStoreMonth(item, ym);
    v.faturamento += Number(item.total_faturamento) || 0;
    v.cmv += Number(item.cmv) || 0;
  });

  (receber ?? []).forEach((item) => {
    const ym = extractYearMonth(item.mes_inicio);
    if (!ym) return;
    const v = getStoreMonth(item, ym);
    v.receita += Number(item.valor_liquido) || Number(item.credito) || 0;
  });

  dre.forEach((item) => {
    const ym = extractYearMonth(item.mes_inicio);
    if (!ym) return;
    const v = getStoreMonth(item, ym);
    const deb = Number(item.debito) || 0;
    switch (normalizeGroupId(item.grupo_dre)) {
      case "avarias": v.avarias += deb; break;
      case "desp_adm": v.adm += deb; break;
      case "desp_log": v.log += deb; break;
      case "taxas_cartao": v.cartao += deb; break;
      case "tributos": v.tributos += deb; break;
      case "investimentos": v.investimentos += deb; break;
      case "nao_operacionais": v.naoOper += deb; break;
    }
  });

  // Comissão por loja/mês e consolidação
  const consolidated = new Map<string, DreValues[]>();
  stores.forEach(({ ref, months }) => {
    const rule = getRuleForStore(ref, rules);
    const pct = rule && Number(rule.percentual_comissao) > 0 ? Number(rule.percentual_comissao) / 100 : 0;
    months.forEach((v, ym) => {
      finalizeValues(v);
      if (pct > 0 && v.lucro > 0) v.comissao = v.lucro * pct;
      finalizeValues(v);
      if (!consolidated.has(ym)) consolidated.set(ym, []);
      consolidated.get(ym)!.push(v);
    });
  });

  const keys = new Set(consolidated.keys());
  if (options.fillYear) {
    MONTH_KEYS.forEach((m) => keys.add(`${options.fillYear}-${m}`));
  }

  return Array.from(keys)
    .sort()
    .map((key) => ({
      key,
      label: monthLabel(key, options.labelWithYear ?? false),
      values: sumDreValues(consolidated.get(key) ?? []),
    }));
}

// ─── Agregações auxiliares para gráficos ─────────────────────────────────────

export interface NamedValue {
  name: string;
  value: number;
}

/** Total de débito por grupo gerencial (ordem da definição). */
export function groupTotals(dre: DreRow[]): (NamedValue & { id: GroupId; color: string })[] {
  const map = new Map<GroupId, number>();
  dre.forEach((item) => {
    const id = normalizeGroupId(item.grupo_dre);
    map.set(id, (map.get(id) ?? 0) + (Number(item.debito) || 0));
  });
  return GROUP_DEFS.map((g) => ({ id: g.id, name: g.label, color: g.color, value: map.get(g.id) ?? 0 }));
}

/** Top contas padronizadas por débito. */
export function topAccounts(dre: DreRow[], limit = 8): (NamedValue & { groupId: GroupId })[] {
  const map = new Map<string, { value: number; groupId: GroupId }>();
  dre.forEach((item) => {
    const name = item.conta_padronizada || item.descricao_conta || "Outras Contas";
    const cur = map.get(name) ?? { value: 0, groupId: normalizeGroupId(item.grupo_dre) };
    cur.value += Number(item.debito) || 0;
    map.set(name, cur);
  });
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, value: v.value, groupId: v.groupId }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export interface StoreResult {
  nome: string;
  faturamento: number;
  despesas: number;
  resultado: number;
}

export function storeName(item: { loja?: string | null; cidade?: string | null }): string {
  const loja = item.loja || "Loja";
  return item.cidade && item.cidade !== "Matriz" ? `${loja} - ${item.cidade}` : loja;
}

/** Faturamento, despesas e resultado por loja/filial, ordenado por faturamento. */
export function resultsByStore(fat: FaturamentoRow[], dre: DreRow[], limit = 8): StoreResult[] {
  const map = new Map<string, StoreResult>();
  const get = (name: string) => {
    if (!map.has(name)) map.set(name, { nome: name, faturamento: 0, despesas: 0, resultado: 0 });
    return map.get(name)!;
  };
  fat.forEach((item) => {
    get(storeName(item)).faturamento += Number(item.total_faturamento) || 0;
  });
  dre.forEach((item) => {
    const id = normalizeGroupId(item.grupo_dre);
    // Mesma composição do lucro líquido: avarias + despesas operacionais
    if (id === "investimentos" || id === "nao_operacionais") return;
    get(storeName(item)).despesas += Number(item.debito) || 0;
  });
  return Array.from(map.values())
    .map((s) => ({ ...s, resultado: s.faturamento - s.despesas }))
    .sort((a, b) => b.faturamento - a.faturamento)
    .slice(0, limit);
}

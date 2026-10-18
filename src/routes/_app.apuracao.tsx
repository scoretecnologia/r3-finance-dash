import { useState, useMemo, useEffect, Fragment } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external";
import * as XLSX from "xlsx";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Filter,
  RefreshCw,
  Building2,
  MapPin,
  Calendar,
  Layers,
  Search,
  FileSpreadsheet,
  FileText,
  Info,
  CheckCircle2,
  BarChart3,
  Receipt,
  Wallet,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Users,
  Settings,
  Percent,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/apuracao")({
  component: ApuracaoPage,
});

function formatMoney(value: number, showDashIfZero = false): string {
  if (showDashIfZero && (!value || Math.abs(value) < 0.01)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatPercent(value: number): string {
  return (
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value || 0) + "%"
  );
}

function extractMonthStr(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split("-");
  if (parts.length >= 2) {
    const m = parts[1].padStart(2, "0");
    if (Number(m) >= 1 && Number(m) <= 12) return m;
  }
  return null;
}

function extractYearStr(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split("-");
  if (parts.length >= 1) return parts[0];
  return null;
}

function exportToXLSX(data: Record<string, unknown>[], filename: string) {
  if (!data || data.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Apuracao");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const clean = dateStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  } catch {
    return dateStr;
  }
}

const MONTH_KEYS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MONTH_LABELS = [
  { key: "01", short: "JAN", full: "Janeiro" },
  { key: "02", short: "FEV", full: "Fevereiro" },
  { key: "03", short: "MAR", full: "Março" },
  { key: "04", short: "ABR", full: "Abril" },
  { key: "05", short: "MAI", full: "Maio" },
  { key: "06", short: "JUN", full: "Junho" },
  { key: "07", short: "JUL", full: "Julho" },
  { key: "08", short: "AGO", full: "Agosto" },
  { key: "09", short: "SET", full: "Setembro" },
  { key: "10", short: "OUT", full: "Outubro" },
  { key: "11", short: "NOV", full: "Novembro" },
  { key: "12", short: "DEZ", full: "Dezembro" },
];

interface ParceiroRegra {
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

function getRuleForStore(
  store: { id_servidor?: number | string | null; id_cidade?: number | string | null; loja?: string | null; cidade?: string | null },
  rules: ParceiroRegra[]
): ParceiroRegra | null {
  if (!rules || rules.length === 0) return null;

  // 1. Prioridade máxima: correspondência por cidade_id (Subloja / Filial específica)
  if (store.id_cidade) {
    const match = rules.find((r) => r.cidade_id && String(r.cidade_id) === String(store.id_cidade));
    if (match) return match;
  }

  // 2. Correspondência por nome da subloja/cidade (se informada e diferente de 'Matriz')
  if (store.cidade && store.cidade.trim().toLowerCase() !== "matriz") {
    const cidNorm = store.cidade.trim().toLowerCase();
    const match = rules.find(
      (r) => r.cidade_nome && r.cidade_nome.trim().toLowerCase() === cidNorm
    );
    if (match) return match;
  }

  // 3. Correspondência por servidor_id da Matriz (regra onde cidade_id é nulo)
  if (store.id_servidor) {
    const match = rules.find(
      (r) => !r.cidade_id && String(r.servidor_id) === String(store.id_servidor)
    );
    if (match) return match;
  }

  // 4. Correspondência por nome da Matriz/Loja (regra onde cidade_id é nulo)
  if (store.loja) {
    const lojaNorm = store.loja.trim().toLowerCase();
    const match = rules.find(
      (r) => !r.cidade_id && r.servidor_nome && r.servidor_nome.trim().toLowerCase() === lojaNorm
    );
    if (match) return match;
  }

  return null;
}

interface CellDetailState {
  accountCode: string;
  accountDesc: string;
  category: string;
  monthKey: string;
  monthLabel: string;
  year: string;
  records: any[];
}

export function ApuracaoPage() {
  // Queries Supabase
  const servidoresQ = useQuery({
    queryKey: ["servidores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupo_r3_servidores" as never).select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const sublojasQ = useQuery({
    queryKey: ["sublojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupo_r3_sublojas" as never).select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const faturamentoQ = useQuery({
    queryKey: ["faturamento-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupo_r3_faturamento_loja" as never).select("*");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const receberQ = useQuery({
    queryKey: ["receber-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupo_r3_receber_detalhado" as never).select("*");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const dreQ = useQuery({
    queryKey: ["dre-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupo_r3_dre_detalhado" as never).select("*");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const parceirosRegrasQ = useQuery({
    queryKey: ["parceiros-regras-dre"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupo_r3_parceiros_regras" as never)
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      return (data || []) as ParceiroRegra[];
    },
  });

  const isLoading =
    faturamentoQ.isLoading ||
    receberQ.isLoading ||
    dreQ.isLoading ||
    parceirosRegrasQ.isLoading ||
    servidoresQ.isLoading ||
    sublojasQ.isLoading;

  // Lojas Matrizes e Filiais Ativas
  const activeServidores = useMemo(
    () => (servidoresQ.data ?? []).filter((s) => s.ativo),
    [servidoresQ.data]
  );

  const activeServidorIds = useMemo(
    () => new Set(activeServidores.map((s) => Number(s.servidor_id))),
    [activeServidores]
  );

  const activeSublojas = useMemo(
    () =>
      (sublojasQ.data ?? []).filter(
        (s) => s.ativo && activeServidorIds.has(Number(s.servidor_id))
      ),
    [sublojasQ.data, activeServidorIds]
  );

  const activeSublojaIds = useMemo(
    () => new Set(activeSublojas.map((s) => Number(s.cidade_id))),
    [activeSublojas]
  );

  // Anos disponíveis
  const availableYears = useMemo(() => {
    const setY = new Set<string>();
    (faturamentoQ.data ?? []).forEach((item) => {
      if (item.id_servidor && !activeServidorIds.has(Number(item.id_servidor))) return;
      if (item.id_cidade && !activeSublojaIds.has(Number(item.id_cidade))) return;
      const y = extractYearStr(item.mes_inicio);
      if (y) setY.add(y);
    });
    (receberQ.data ?? []).forEach((item) => {
      if (item.id_servidor && !activeServidorIds.has(Number(item.id_servidor))) return;
      if (item.id_cidade && !activeSublojaIds.has(Number(item.id_cidade))) return;
      const y = extractYearStr(item.mes_inicio);
      if (y) setY.add(y);
    });
    (dreQ.data ?? []).forEach((item) => {
      if (item.id_servidor && !activeServidorIds.has(Number(item.id_servidor))) return;
      if (item.id_cidade && !activeSublojaIds.has(Number(item.id_cidade))) return;
      const y = extractYearStr(item.mes_inicio);
      if (y) setY.add(y);
    });
    const list = Array.from(setY).sort().reverse();
    return list.length > 0 ? list : ["2026", "2025"];
  }, [faturamentoQ.data, dreQ.data, activeServidorIds, activeSublojaIds]);

  // Filtros Globais
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedServidores, setSelectedServidores] = useState<string[]>([]);
  const [selectedCidades, setSelectedCidades] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["resumo"]));
  const [selectedCellDetail, setSelectedCellDetail] = useState<CellDetailState | null>(null);
  const [expandedRawRowId, setExpandedRawRowId] = useState<number | null>(null);

  // Limpeza de seleções caso desativadas
  useEffect(() => {
    if (selectedServidores.length > 0) {
      setSelectedServidores((prev) =>
        prev.filter((id) => activeServidorIds.has(Number(id)))
      );
    }
  }, [activeServidorIds]);

  useEffect(() => {
    if (selectedCidades.length > 0) {
      setSelectedCidades((prev) =>
        prev.filter((id) => activeSublojaIds.has(Number(id)))
      );
    }
  }, [activeSublojaIds]);

  // Sublojas filtradas por servidores selecionados
  const filteredSublojas = useMemo(() => {
    if (selectedServidores.length === 0) return activeSublojas;
    const set = new Set(selectedServidores.map(Number));
    return activeSublojas.filter((s) => set.has(Number(s.servidor_id)));
  }, [activeSublojas, selectedServidores]);

  const handleServidoresChange = (values: string[]) => {
    setSelectedServidores(values);
    if (values.length > 0) {
      const allowedSrv = new Set(values.map(Number));
      const allowedCidades = new Set(
        activeSublojas
          .filter((s) => allowedSrv.has(Number(s.servidor_id)))
          .map((s) => String(s.cidade_id))
      );
      setSelectedCidades((prev) => prev.filter((cid) => allowedCidades.has(cid)));
    }
  };

  const servidorOptions = useMemo(
    () => activeServidores.map((s) => ({ value: String(s.servidor_id), label: s.nome || `Loja ${s.servidor_id}` })),
    [activeServidores]
  );

  const sublojaOptions = useMemo(
    () => filteredSublojas.map((s) => ({ value: String(s.cidade_id), label: s.nome || `Cidade ${s.cidade_id}` })),
    [filteredSublojas]
  );

  const monthOptions = useMemo(() => MONTH_LABELS.map((m) => ({ value: m.key, label: m.full })), []);

  // Meses visíveis
  const visibleMonthLabels = useMemo(
    () => (selectedMonths.length === 0 ? MONTH_LABELS : MONTH_LABELS.filter((m) => selectedMonths.includes(m.key))),
    [selectedMonths]
  );
  const hasMonthFilter = selectedMonths.length > 0;

  // Nome do Escopo / Lojas Selecionadas
  const selectedScopeLabel = useMemo(() => {
    const srvNames = selectedServidores.map((id) => {
      const srv = activeServidores.find((s) => String(s.servidor_id) === id);
      return srv?.nome || `Servidor ${id}`;
    });
    const cidNames = selectedCidades.map((id) => {
      const sub = activeSublojas.find((s) => String(s.cidade_id) === id);
      return sub?.nome || `Cidade ${id}`;
    });
    if (srvNames.length === 0 && cidNames.length === 0) return "Todas as Lojas Ativas (Consolidado Grupo R3)";
    const parts: string[] = [];
    if (srvNames.length > 0) parts.push(srvNames.join(", "));
    if (cidNames.length > 0) parts.push(cidNames.join(", "));
    return parts.join(" — ");
  }, [selectedServidores, selectedCidades, activeServidores, activeSublojas]);

  // Label do Mês Ativo
  const activeMonthLabel = !hasMonthFilter
    ? "Acumulado Anual"
    : visibleMonthLabels.length === 1
      ? visibleMonthLabels[0].full
      : visibleMonthLabels.map((m) => m.short).join(", ");
  const yearLabel = selectedYear === "todos" ? "Todos os Anos" : selectedYear;

  // --- FILTRAGEM DOS DADOS ---
  const filteredFatData = useMemo(() => {
    let list = faturamentoQ.data ?? [];
    list = list.filter((item) => {
      if (item.id_servidor && !activeServidorIds.has(Number(item.id_servidor))) return false;
      if (item.id_cidade && !activeSublojaIds.has(Number(item.id_cidade))) return false;
      return true;
    });

    if (selectedYear !== "todos") {
      list = list.filter((item) => extractYearStr(item.mes_inicio) === selectedYear);
    }
    if (selectedMonths.length > 0) {
      const months = new Set(selectedMonths);
      list = list.filter((item) => months.has(extractMonthStr(item.mes_inicio) ?? ""));
    }
    if (selectedServidores.length > 0) {
      const set = new Set(selectedServidores);
      list = list.filter((item) => set.has(String(item.id_servidor)));
    }
    if (selectedCidades.length > 0) {
      const set = new Set(selectedCidades);
      list = list.filter((item) => set.has(String(item.id_cidade)));
    }
    return list;
  }, [faturamentoQ.data, activeServidorIds, activeSublojaIds, selectedYear, selectedMonths, selectedServidores, selectedCidades]);

  const filteredDreData = useMemo(() => {
    let list = dreQ.data ?? [];
    list = list.filter((item) => {
      if (item.id_servidor && !activeServidorIds.has(Number(item.id_servidor))) return false;
      if (item.id_cidade && !activeSublojaIds.has(Number(item.id_cidade))) return false;
      return true;
    });

    if (selectedYear !== "todos") {
      list = list.filter((item) => extractYearStr(item.mes_inicio) === selectedYear);
    }
    if (selectedMonths.length > 0) {
      const months = new Set(selectedMonths);
      list = list.filter((item) => months.has(extractMonthStr(item.mes_inicio) ?? ""));
    }
    if (selectedServidores.length > 0) {
      const set = new Set(selectedServidores);
      list = list.filter((item) => set.has(String(item.id_servidor)));
    }
    if (selectedCidades.length > 0) {
      const set = new Set(selectedCidades);
      list = list.filter((item) => set.has(String(item.id_cidade)));
    }
    return list;
  }, [dreQ.data, activeServidorIds, activeSublojaIds, selectedYear, selectedMonths, selectedServidores, selectedCidades]);

  const filteredReceberData = useMemo(() => {
    let list = receberQ.data ?? [];
    list = list.filter((item) => {
      if (item.id_servidor && !activeServidorIds.has(Number(item.id_servidor))) return false;
      if (item.id_cidade && !activeSublojaIds.has(Number(item.id_cidade))) return false;
      return true;
    });

    if (selectedYear !== "todos") {
      list = list.filter((item) => extractYearStr(item.mes_inicio) === selectedYear);
    }
    if (selectedMonths.length > 0) {
      const months = new Set(selectedMonths);
      list = list.filter((item) => months.has(extractMonthStr(item.mes_inicio) ?? ""));
    }
    if (selectedServidores.length > 0) {
      const set = new Set(selectedServidores);
      list = list.filter((item) => set.has(String(item.id_servidor)));
    }
    if (selectedCidades.length > 0) {
      const set = new Set(selectedCidades);
      list = list.filter((item) => set.has(String(item.id_cidade)));
    }
    return list;
  }, [receberQ.data, activeServidorIds, activeSublojaIds, selectedYear, selectedMonths, selectedServidores, selectedCidades]);

  // Faturamento
  const faturamentoMensal = useMemo(() => {
    const map: Record<string, number> = {};
    MONTH_KEYS.forEach((m) => (map[m] = 0));
    filteredFatData.forEach((item) => {
      const m = extractMonthStr(item.mes_inicio);
      if (m && map[m] !== undefined) {
        map[m] += Number(item.total_faturamento) || 0;
      }
    });
    return map;
  }, [filteredFatData]);

  const faturamentoTotal = useMemo(() => {
    return Object.values(faturamentoMensal).reduce((a, b) => a + b, 0);
  }, [faturamentoMensal]);

  // Receita Gerada (grupo_r3_receber_detalhado)
  const receitaTotal = useMemo(() => {
    return filteredReceberData.reduce(
      (acc, item) => acc + (Number(item.valor_liquido) || Number(item.credito) || 0),
      0
    );
  }, [filteredReceberData]);

  const receitaAccounts = useMemo(() => {
    const map = new Map<string, number>();
    filteredReceberData.forEach((item) => {
      const acc = item.conta_padronizada || item.descricao_conta || "Outras Receitas";
      const val = Number(item.valor_liquido) || Number(item.credito) || 0;
      map.set(acc, (map.get(acc) || 0) + val);
    });
    return Array.from(map.entries())
      .map(([conta, valor]) => ({ conta, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [filteredReceberData]);

  // Regras de Parceiros e Comissão
  const partnerInfo = useMemo(() => {
    const rules = parceirosRegrasQ.data ?? [];
    if (rules.length === 0) {
      return {
        hasRules: false,
        partners: [] as { nome: string; percentual: number; lojas: string[] }[],
        displayLabel: "Sem regra de parceiro cadastrada",
        badgeLabel: "Sem parceiro",
        isSingle: false,
        singlePartnerName: "",
        singlePercent: 0,
      };
    }

    const matchedMap = new Map<string, { nome: string; percentual: number; lojas: Set<string> }>();

    const checkStore = (idSrv: any, idCid: any, loja: string, cid: string) => {
      const rule = getRuleForStore({ id_servidor: idSrv, id_cidade: idCid, loja, cidade: cid }, rules);
      if (rule) {
        if (!matchedMap.has(rule.parceiro_nome)) {
          matchedMap.set(rule.parceiro_nome, {
            nome: rule.parceiro_nome,
            percentual: Number(rule.percentual_comissao),
            lojas: new Set(),
          });
        }
        const storeLabel = cid && cid !== "Matriz" ? `${loja} (${cid})` : loja || "Matriz";
        matchedMap.get(rule.parceiro_nome)!.lojas.add(storeLabel);
      }
    };

    filteredFatData.forEach((f) => checkStore(f.id_servidor, f.id_cidade, f.loja, f.cidade));
    filteredDreData.forEach((d) => checkStore(d.id_servidor, d.id_cidade, d.loja, d.cidade));

    const partners = Array.from(matchedMap.values()).map((p) => ({
      nome: p.nome,
      percentual: p.percentual,
      lojas: Array.from(p.lojas),
    }));

    if (partners.length === 1) {
      const p = partners[0];
      return {
        hasRules: true,
        partners,
        displayLabel: `${p.nome} (${p.percentual.toFixed(1)}%)`,
        badgeLabel: `${p.nome} · ${p.percentual.toFixed(1)}%`,
        isSingle: true,
        singlePartnerName: p.nome,
        singlePercent: p.percentual,
      };
    } else if (partners.length > 1) {
      return {
        hasRules: true,
        partners,
        displayLabel: `${partners.length} Parceiros (${partners.map((p) => p.nome).slice(0, 3).join(", ")}${partners.length > 3 ? "..." : ""})`,
        badgeLabel: `${partners.length} Parceiros`,
        isSingle: false,
        singlePartnerName: "",
        singlePercent: 0,
      };
    }

    return {
      hasRules: false,
      partners: [],
      displayLabel: "Sem parceiro vinculado",
      badgeLabel: "Sem parceiro",
      isSingle: false,
      singlePartnerName: "",
      singlePercent: 0,
    };
  }, [parceirosRegrasQ.data, filteredFatData, filteredDreData]);

  // Totais por Grupos DRE
  const groupTotals = useMemo(() => {
    let cmv = 0;
    let avarias = 0;
    let adm = 0;
    let log = 0;
    let cartao = 0;
    let trib = 0;

    // Subcontas detalhadas
    const admAccounts = new Map<string, number>();
    const logAccounts = new Map<string, number>();
    const cartaoAccounts = new Map<string, number>();
    const tribAccounts = new Map<string, number>();
    const avariasAccounts = new Map<string, number>();

    filteredDreData.forEach((item) => {
      const deb = Number(item.debito) || 0;
      const group = item.grupo_dre || "Despesas Administrativas";
      const acc = item.conta_padronizada || item.descricao || "Outros";

      if (group === "Avarias") {
        avarias += deb;
        avariasAccounts.set(acc, (avariasAccounts.get(acc) || 0) + deb);
      } else if (group === "Despesas Administrativas") {
        adm += deb;
        admAccounts.set(acc, (admAccounts.get(acc) || 0) + deb);
      } else if (group === "Despesa logistica" || group === "Despesas com Logística") {
        log += deb;
        logAccounts.set(acc, (logAccounts.get(acc) || 0) + deb);
      } else if (group === "Taxas de cartão" || group === "Taxas de Cartão") {
        cartao += deb;
        cartaoAccounts.set(acc, (cartaoAccounts.get(acc) || 0) + deb);
      } else if (group === "Tributos") {
        trib += deb;
        tribAccounts.set(acc, (tribAccounts.get(acc) || 0) + deb);
      }
    });

    const toSortedArray = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([conta, valor]) => ({ conta, valor }))
        .sort((a, b) => b.valor - a.valor);

    return {
      cmv,
      avarias,
      adm,
      log,
      cartao,
      trib,
      admAccounts: toSortedArray(admAccounts),
      logAccounts: toSortedArray(logAccounts),
      cartaoAccounts: toSortedArray(cartaoAccounts),
      tribAccounts: toSortedArray(tribAccounts),
      avariasAccounts: toSortedArray(avariasAccounts),
    };
  }, [filteredDreData]);

  // Comissão de parceiro mês a mês e consolidada
  const partnerCommissions = useMemo(() => {
    const rules = parceirosRegrasQ.data ?? [];
    const monthlyComissao: Record<string, number> = {};
    MONTH_KEYS.forEach((m) => (monthlyComissao[m] = 0));

    if (rules.length === 0) {
      return { monthly: monthlyComissao, total: 0 };
    }

    const storeMap = new Map<
      string,
      {
        storeInfo: { id_servidor: any; id_cidade: any; loja: string; cidade: string };
        fat: Record<string, number>;
        avarias: Record<string, number>;
        desp: Record<string, number>;
      }
    >();

    const getOrCreateStore = (idSrv: any, idCid: any, loja: string, cid: string) => {
      const key = `${idSrv || 0}__${idCid || 0}__${loja || ""}__${cid || ""}`;
      if (!storeMap.has(key)) {
        const fatInit: Record<string, number> = {};
        const avInit: Record<string, number> = {};
        const despInit: Record<string, number> = {};
        MONTH_KEYS.forEach((m) => {
          fatInit[m] = 0;
          avInit[m] = 0;
          despInit[m] = 0;
        });
        storeMap.set(key, {
          storeInfo: { id_servidor: idSrv, id_cidade: idCid, loja, cidade: cid },
          fat: fatInit,
          avarias: avInit,
          desp: despInit,
        });
      }
      return storeMap.get(key)!;
    };

    filteredFatData.forEach((item) => {
      const m = extractMonthStr(item.mes_inicio);
      if (m && monthlyComissao[m] !== undefined) {
        const s = getOrCreateStore(item.id_servidor, item.id_cidade, item.loja, item.cidade);
        s.fat[m] += Number(item.total_faturamento) || 0;
      }
    });

    filteredDreData.forEach((item) => {
      const m = extractMonthStr(item.mes_inicio);
      if (m && monthlyComissao[m] !== undefined) {
        const s = getOrCreateStore(item.id_servidor, item.id_cidade, item.loja, item.cidade);
        const deb = Number(item.debito) || 0;
        const group = item.grupo_dre || "Despesas Administrativas";
        if (group === "Avarias") {
          s.avarias[m] += deb;
        } else if (
          group === "Despesas Administrativas" ||
          group === "Despesa logistica" ||
          group === "Despesas com Logística" ||
          group === "Taxas de cartão" ||
          group === "Taxas de Cartão" ||
          group === "Tributos"
        ) {
          s.desp[m] += deb;
        }
      }
    });

    storeMap.forEach(({ storeInfo, fat, avarias, desp }) => {
      const rule = getRuleForStore(storeInfo, rules);
      if (rule && Number(rule.percentual_comissao) > 0) {
        const pct = Number(rule.percentual_comissao) / 100;
        MONTH_KEYS.forEach((m) => {
          const lucroLoja = fat[m] - avarias[m] - desp[m];
          if (lucroLoja > 0) {
            monthlyComissao[m] += lucroLoja * pct;
          }
        });
      }
    });

    const keysToSum = selectedMonths.length > 0 ? selectedMonths : MONTH_KEYS;
    const totalPeriodo = keysToSum.reduce((acc, k) => acc + (monthlyComissao[k] || 0), 0);

    return {
      monthly: monthlyComissao,
      total: totalPeriodo,
    };
  }, [parceirosRegrasQ.data, filteredFatData, filteredDreData, selectedMonths]);

  // Valores Consolidados da Apuração
  const apuracao = useMemo(() => {
    const fat = faturamentoTotal;
    const cmv = groupTotals.cmv;
    const avarias = groupTotals.avarias;
    const margem = fat - cmv - avarias;
    const adm = groupTotals.adm;
    const log = groupTotals.log;
    const cartao = groupTotals.cartao;
    const trib = groupTotals.trib;
    const fixas = adm + log;
    const variaveis = avarias + cartao + trib;
    const despTot = adm + log + cartao + trib;
    const lucro = margem - despTot;
    const comissao = partnerCommissions.total;
    const dist = lucro - comissao;

    return {
      fat,
      receita: receitaTotal,
      cmv,
      avarias,
      margem,
      adm,
      log,
      cartao,
      trib,
      fixas,
      variaveis,
      despTot,
      lucro,
      comissao,
      dist,
    };
  }, [faturamentoTotal, receitaTotal, groupTotals, partnerCommissions]);

  // Evolução Mensal da Apuração (Gráfico)
  const evolutionData = useMemo(() => {
    return visibleMonthLabels.map((m) => {
      const monthFat = faturamentoMensal[m.key] || 0;

      // Calcular despesas do mês
      let monthAdm = 0;
      let monthLog = 0;
      let monthCartao = 0;
      let monthTrib = 0;
      let monthAvarias = 0;

      filteredDreData.forEach((item) => {
        if (extractMonthStr(item.mes_inicio) === m.key) {
          const deb = Number(item.debito) || 0;
          const group = item.grupo_dre || "Despesas Administrativas";
          if (group === "Avarias") monthAvarias += deb;
          else if (group === "Despesas Administrativas") monthAdm += deb;
          else if (group === "Despesa logistica" || group === "Despesas com Logística") monthLog += deb;
          else if (group === "Taxas de cartão" || group === "Taxas de Cartão") monthCartao += deb;
          else if (group === "Tributos") monthTrib += deb;
        }
      });

      const monthMargem = monthFat - monthAvarias;
      const monthDesp = monthAdm + monthLog + monthCartao + monthTrib;
      const monthLucro = monthMargem - monthDesp;
      const monthComissao = partnerCommissions.monthly[m.key] || 0;
      const monthDist = monthLucro - monthComissao;

      return {
        label: m.short,
        fullLabel: m.full,
        faturamento: monthFat,
        margem: monthMargem,
        despesas: monthDesp,
        lucro: monthLucro,
        comissao: monthComissao,
        distribuicao: monthDist,
      };
    });
  }, [visibleMonthLabels, faturamentoMensal, filteredDreData, partnerCommissions]);

  // Toggle de Seções Analíticas
  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Exportação Excel da Apuração
  const handleExportXLSX = () => {
    const rows = [
      {
        Linha: "(=) Faturamento",
        "Valor (R$)": apuracao.fat,
        "% Faturamento": "100.0%",
        Classificação: "Faturamento Bruto",
      },
      {
        Linha: "(+) Receita Gerada",
        "Valor (R$)": apuracao.receita,
        "% Faturamento": apuracao.fat > 0 ? formatPercent((apuracao.receita / apuracao.fat) * 100) : "0.0%",
        Classificação: "Receita Realizada (Receber)",
      },
      {
        Linha: "(-) Custo da Mercadoria Vendida (CMV)",
        "Valor (R$)": apuracao.cmv,
        "% Faturamento": apuracao.fat > 0 ? formatPercent((apuracao.cmv / apuracao.fat) * 100) : "0.0%",
        Classificação: "Custo Direto",
      },
      {
        Linha: "(-) Avarias",
        "Valor (R$)": apuracao.avarias,
        "% Faturamento": apuracao.fat > 0 ? formatPercent((apuracao.avarias / apuracao.fat) * 100) : "0.0%",
        Classificação: "Dedução da Receita",
      },
      {
        Linha: "(=) Margem de Contribuição",
        "Valor (R$)": apuracao.margem,
        "% Faturamento": apuracao.fat > 0 ? formatPercent((apuracao.margem / apuracao.fat) * 100) : "0.0%",
        Classificação: "Margem Bruta Operacional",
      },
      {
        Linha: "(-) Despesas Administrativas",
        "Valor (R$)": apuracao.adm,
        "% Faturamento": apuracao.fat > 0 ? formatPercent((apuracao.adm / apuracao.fat) * 100) : "0.0%",
        Classificação: "Despesa Fixa",
      },
      {
        Linha: "(-) Despesa Logística",
        "Valor (R$)": apuracao.log,
        "% Faturamento": apuracao.fat > 0 ? formatPercent((apuracao.log / apuracao.fat) * 100) : "0.0%",
        Classificação: "Despesa Fixa",
      },
      {
        Linha: "(-) Taxas de Cartão",
        "Valor (R$)": apuracao.cartao,
        "% Faturamento": apuracao.fat > 0 ? formatPercent((apuracao.cartao / apuracao.fat) * 100) : "0.0%",
        Classificação: "Despesa Variável",
      },
      {
        Linha: "(-) Tributos",
        "Valor (R$)": apuracao.trib,
        "% Faturamento": apuracao.fat > 0 ? formatPercent((apuracao.trib / apuracao.fat) * 100) : "0.0%",
        Classificação: "Despesa Variável",
      },
      {
        Linha: "Total Despesas Operacionais",
        "Valor (R$)": apuracao.despTot,
        "% Faturamento": apuracao.fat > 0 ? formatPercent((apuracao.despTot / apuracao.fat) * 100) : "0.0%",
        Classificação: "Total de Despesas",
      },
      {
        Linha: "(=) Lucro Líquido",
        "Valor (R$)": apuracao.lucro,
        "% Faturamento": apuracao.fat > 0 ? formatPercent((apuracao.lucro / apuracao.fat) * 100) : "0.0%",
        Classificação: "Resultado do Exercício",
      },
      {
        Linha: "(-) Comissão Parceiro",
        "Valor (R$)": apuracao.comissao,
        "% Faturamento": apuracao.fat > 0 ? formatPercent((apuracao.comissao / apuracao.fat) * 100) : "0.0%",
        Classificação: "Participação / Comissão",
      },
      {
        Linha: "(=) Distribuição do Lucro",
        "Valor (R$)": apuracao.dist,
        "% Faturamento": apuracao.fat > 0 ? formatPercent((apuracao.dist / apuracao.fat) * 100) : "0.0%",
        Classificação: "Resultado Final Líquido",
      },
    ];

    exportToXLSX(
      rows,
      `Apuracao_Resultado_${selectedScopeLabel.replace(/[^a-zA-Z0-9]/g, "_")}_${selectedYear}${hasMonthFilter ? `_${selectedMonths.join("-")}` : ""}`
    );
  };

  // Auditoria de Lançamentos
  const handleOpenAccountDetail = (accountName: string, category: string) => {
    let records = filteredDreData.filter((item) => {
      const acc = item.conta_padronizada || item.descricao;
      return acc === accountName;
    });

    if (records.length === 0) {
      records = filteredReceberData.filter((item) => {
        const acc = item.conta_padronizada || item.descricao_conta;
        return acc === accountName;
      });
    }

    setSelectedCellDetail({
      accountCode: records[0]?.codigo_conta || "",
      accountDesc: accountName,
      category,
      monthKey: selectedMonths.length === 1 ? selectedMonths[0] : "all",
      monthLabel: activeMonthLabel,
      year: selectedYear,
      records,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* --- CABEÇALHO & NAVEGAÇÃO --- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mr-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Dashboard
            </Link>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px] gap-1 font-sans">
              <Sparkles className="h-3 w-3" /> Modelo Executivo de Fechamento
            </Badge>
          </div>
          <h1 className="text-lg font-extrabold tracking-tight text-foreground mt-1 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" /> Apuração de Resultado
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Demonstrativo financeiro mensal por loja: Margem de Contribuição, Despesas, Lucro Líquido e Repasse a Parceiros.
          </p>
        </div>

        {/* Barra de Filtros Corporativos */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-card p-2 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3.5 w-3.5 text-primary" /> Filtros:
          </div>

          {/* Filtro de Ano */}
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-8 w-[100px] text-xs rounded-lg border-border bg-background">
              <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={y} className="text-xs">
                  {y}
                </SelectItem>
              ))}
              <SelectItem value="todos" className="text-xs font-semibold text-primary">
                Todos os Anos
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro de Meses */}
          <MultiSelectFilter
            options={monthOptions}
            selected={selectedMonths}
            onChange={setSelectedMonths}
            placeholder="Meses"
            searchPlaceholder="Buscar mês..."
            className="w-[130px]"
          />

          {/* Filtro de Loja Matriz */}
          <MultiSelectFilter
            options={servidorOptions}
            selected={selectedServidores}
            onChange={handleServidoresChange}
            placeholder="Lojas"
            searchPlaceholder="Buscar loja..."
            emptyText="Nenhuma loja encontrada."
            icon={<Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            className="w-[170px]"
          />

          {/* Filtro de Subloja / Cidade */}
          <MultiSelectFilter
            options={sublojaOptions}
            selected={selectedCidades}
            onChange={setSelectedCidades}
            placeholder="Filiais"
            searchPlaceholder="Buscar filial..."
            emptyText="Nenhuma filial encontrada."
            icon={<MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            className="w-[160px]"
            disabled={sublojaOptions.length === 0}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              servidoresQ.refetch();
              sublojasQ.refetch();
              faturamentoQ.refetch();
              dreQ.refetch();
              parceirosRegrasQ.refetch();
            }}
            disabled={isLoading}
            className="h-8 px-2.5 text-xs rounded-lg border-border gap-1"
            title="Atualizar dados do Supabase"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportXLSX}
            disabled={isLoading || apuracao.fat === 0}
            className="h-8 px-2.5 text-xs rounded-lg border-border gap-1.5 text-foreground hover:bg-muted"
            title="Exportar Apuração em Planilha Excel (.xlsx)"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </Button>
        </div>
      </div>

      {/* --- SELETOR RÁPIDO DE MÊS (1-CLIQUE) --- */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
        <span className="text-muted-foreground font-semibold px-2 shrink-0 uppercase tracking-wider text-[10px]">
          Mês Rápido:
        </span>
        <button
          onClick={() => setSelectedMonths([])}
          className={cn(
            "px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 text-xs",
            selectedMonths.length === 0
              ? "bg-primary text-primary-foreground shadow-sm font-semibold"
              : "bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Ano Todo
        </button>
        {MONTH_LABELS.map((m) => {
          const isSelected = selectedMonths.length === 1 && selectedMonths[0] === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setSelectedMonths([m.key])}
              className={cn(
                "px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 text-xs",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {m.short}
            </button>
          );
        })}
      </div>

      {/* --- BANNER DE ESCOPO ATIVO & REGRAS --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary text-primary-foreground shrink-0 shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Período de Apuração: <strong className="text-foreground">{activeMonthLabel} de {yearLabel}</strong>
            </div>
            <div className="text-sm font-bold text-foreground flex items-center gap-1.5 mt-0.5">
              <span>Escopo:</span>
              <span className="text-primary tabular-nums">{selectedScopeLabel.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={cn(
              "text-xs py-1 px-2.5 font-medium flex items-center gap-1.5",
              partnerInfo.hasRules
                ? "bg-chart-line/10 border-chart-line/30 text-chart-line font-semibold"
                : "bg-muted border-border text-muted-foreground"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            <span>{partnerInfo.displayLabel}</span>
          </Badge>

          <Link
            to="/configuracoes"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-1 hover:underline"
          >
            <Settings className="h-3 w-3" /> Gerenciar Regras
          </Link>
        </div>
      </div>

      {/* --- CARDS DE INDICADORES EXECUTIVOS (KPIs) --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Faturamento */}
        <Card className="p-4 rounded-xl bg-card hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              (=) Faturamento
            </span>
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums text-primary mt-2">
            {formatMoney(apuracao.fat)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
            <span>Receita Gerada:</span>
            <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatMoney(apuracao.receita)}
            </strong>
          </div>
        </Card>

        {/* KPI 2: Margem de Contribuição */}
        <Card className="p-4 rounded-xl bg-card hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              (=) Margem Contrib.
            </span>
            <div className="p-1.5 rounded-lg bg-chart-blue/10 text-chart-blue">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums text-chart-blue mt-2">
            {formatMoney(apuracao.margem)}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
            Margem:{" "}
            <strong className="text-chart-blue tabular-nums">
              {apuracao.fat > 0 ? formatPercent((apuracao.margem / apuracao.fat) * 100) : "0.0%"}
            </strong>
          </div>
        </Card>

        {/* KPI 3: Despesas Totais */}
        <Card className="p-4 rounded-xl bg-card hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              (-) Total Despesas
            </span>
            <div className="p-1.5 rounded-lg bg-destructive/10 text-destructive">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums text-destructive mt-2">
            {formatMoney(apuracao.despTot)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
            <span>
              Fixas: <strong className="text-foreground tabular-nums">{formatMoney(apuracao.fixas)}</strong>
            </span>
            <span>
              Variáveis: <strong className="text-foreground tabular-nums">{formatMoney(apuracao.variaveis)}</strong>
            </span>
          </div>
        </Card>

        {/* KPI 4: Lucro Líquido */}
        <Card className="p-4 rounded-xl bg-card hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              (=) Lucro Líquido
            </span>
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div
            className={cn(
              "text-2xl font-bold tabular-nums mt-2",
              apuracao.lucro >= 0 ? "text-primary" : "text-destructive"
            )}
          >
            {formatMoney(apuracao.lucro)}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
            Margem Líquida:{" "}
            <strong className={cn("tabular-nums", apuracao.lucro >= 0 ? "text-primary" : "text-destructive")}>
              {apuracao.fat > 0 ? formatPercent((apuracao.lucro / apuracao.fat) * 100) : "0.0%"}
            </strong>
          </div>
        </Card>

        {/* KPI 5: Distribuição do Lucro */}
        <Card className="p-4 rounded-xl bg-card hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              (=) Distribuição Lucro
            </span>
            <div className="p-1.5 rounded-lg bg-chart-line/10 text-chart-line">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div
            className={cn(
              "text-2xl font-bold tabular-nums mt-2",
              apuracao.dist >= 0 ? "text-primary" : "text-destructive"
            )}
          >
            {formatMoney(apuracao.dist)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 gap-1">
            <span className="truncate">
              Comissão: <strong className="text-chart-line tabular-nums">{formatMoney(apuracao.comissao)}</strong>
            </span>
            <span className="tabular-nums font-semibold">
              {apuracao.fat > 0 ? formatPercent((apuracao.dist / apuracao.fat) * 100) : "0.0%"}
            </span>
          </div>
        </Card>
      </div>

      {/* --- SEÇÃO PRINCIPAL: CARD EXECUTIVO DA APURAÇÃO (MODELO PLANILHA) + DETALHAMENTO --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LADO ESQUERDO (7 Colunas): TABELA DE APURAÇÃO COMPLETA MODELO PLANILHA */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="rounded-xl border-2 border-primary/20 bg-card shadow-md overflow-hidden">
            {/* Header no estilo da planilha azul executiva */}
            <div className="bg-primary text-primary-foreground p-4 text-center font-bold tracking-wide">
              <div className="text-base uppercase flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4" /> Demonstrativo de Apuração — {activeMonthLabel}
              </div>
              <div className="text-xs opacity-90 font-medium mt-1 truncate">
                Loja / Cidade: <span className="font-bold underline">{selectedScopeLabel.toUpperCase()}</span>
              </div>
            </div>

            {/* Linhas da Apuração com Valores e Percentuais */}
            <div className="divide-y divide-border text-xs tabular-nums">
              {/* 1. Faturamento */}
              <div className="flex items-center justify-between p-3.5 bg-primary/10 font-bold hover:bg-primary/15 transition-colors">
                <div className="flex items-center gap-2 font-sans">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-primary text-sm">(=) Faturamento</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-primary text-sm">{formatMoney(apuracao.fat)}</span>
                  <span className="w-16 text-right text-primary font-bold">100,0%</span>
                </div>
              </div>

              {/* 1.1 Receita Gerada (grupo_r3_receber_detalhado) */}
              <div className="flex items-center justify-between p-3 bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors border-b border-border/50">
                <div className="flex items-center gap-2 font-sans pl-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">(+) Receita Gerada</span>
                  {receitaAccounts.length > 0 && (
                    <button
                      onClick={() => toggleSection("receita_gerada")}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-0.5 ml-1 font-semibold"
                    >
                      {expandedSections.has("receita_gerada") ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {receitaAccounts.length} contas
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">{formatMoney(apuracao.receita)}</span>
                  <span className="w-16 text-right text-emerald-700 dark:text-emerald-300 font-bold">
                    {apuracao.fat > 0 ? formatPercent((apuracao.receita / apuracao.fat) * 100) : "—"}
                  </span>
                </div>
              </div>

              {/* Subcontas de Receita Gerada */}
              {expandedSections.has("receita_gerada") && (
                <div className="bg-emerald-500/[0.03] pl-8 pr-4 py-2 space-y-1.5 text-[11px] border-l-2 border-emerald-500/40">
                  {receitaAccounts.map((a) => (
                    <div
                      key={a.conta}
                      onClick={() => handleOpenAccountDetail(a.conta, "Receitas")}
                      className="flex items-center justify-between text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer py-0.5"
                    >
                      <span className="font-sans truncate max-w-[280px]">{a.conta}</span>
                      <div className="flex items-center gap-6">
                        <span className="font-medium text-foreground">{formatMoney(a.valor)}</span>
                        <span className="w-16 text-right tabular-nums text-[10px]">
                          {apuracao.fat > 0 ? formatPercent((a.valor / apuracao.fat) * 100) : "0,0%"}
                        </span>
                      </div>
                    </div>
                  ))}
                  {receitaAccounts.length === 0 && (
                    <div className="text-muted-foreground/60 italic py-1 text-center">
                      Nenhuma receita registrada no período.
                    </div>
                  )}
                </div>
              )}

              {/* 2. CMV */}
              <div className="flex items-center justify-between p-3 text-muted-foreground hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2 font-sans pl-2">
                  <span>(-) Custo da mercadoria vendida (CMV)</span>
                </div>
                <div className="flex items-center gap-6">
                  <span>{formatMoney(apuracao.cmv, true)}</span>
                  <span className="w-16 text-right">0,0%</span>
                </div>
              </div>

              {/* 3. Avarias */}
              <div className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2 font-sans pl-2">
                  <span className="text-foreground">(-) Avarias</span>
                  {groupTotals.avariasAccounts.length > 0 && (
                    <button
                      onClick={() => toggleSection("avarias")}
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 ml-1"
                    >
                      {expandedSections.has("avarias") ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {groupTotals.avariasAccounts.length} contas
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-destructive font-medium">{formatMoney(apuracao.avarias, true)}</span>
                  <span className="w-16 text-right text-destructive font-medium">
                    {apuracao.fat > 0 ? formatPercent((apuracao.avarias / apuracao.fat) * 100) : "0,0%"}
                  </span>
                </div>
              </div>

              {/* Subcontas de Avarias */}
              {expandedSections.has("avarias") && (
                <div className="bg-muted/20 pl-8 pr-4 py-2 space-y-1.5 text-[11px] border-l-2 border-chart-amber/40">
                  {groupTotals.avariasAccounts.map((a) => (
                    <div
                      key={a.conta}
                      onClick={() => handleOpenAccountDetail(a.conta, "Avarias")}
                      className="flex items-center justify-between text-muted-foreground hover:text-foreground cursor-pointer py-0.5"
                    >
                      <span className="font-sans truncate max-w-[280px]">{a.conta}</span>
                      <div className="flex items-center gap-6">
                        <span>{formatMoney(a.valor)}</span>
                        <span className="w-16 text-right tabular-nums text-[10px]">
                          {apuracao.fat > 0 ? formatPercent((a.valor / apuracao.fat) * 100) : "0,0%"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 4. Margem de contribuição */}
              <div className="flex items-center justify-between p-3.5 bg-chart-blue/10 font-bold hover:bg-chart-blue/15 transition-colors">
                <div className="flex items-center gap-2 font-sans">
                  <div className="w-2 h-2 rounded-full bg-chart-blue" />
                  <span className="text-chart-blue text-sm">(=) Margem de contribuição</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-chart-blue text-sm">{formatMoney(apuracao.margem)}</span>
                  <span className="w-16 text-right text-chart-blue font-bold">
                    {apuracao.fat > 0 ? formatPercent((apuracao.margem / apuracao.fat) * 100) : "0,0%"}
                  </span>
                </div>
              </div>

              {/* 5. Despesas Administrativas */}
              <div className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2 font-sans pl-2">
                  <span className="text-foreground">(-) Despesas Administrativas</span>
                  {groupTotals.admAccounts.length > 0 && (
                    <button
                      onClick={() => toggleSection("adm")}
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 ml-1"
                    >
                      {expandedSections.has("adm") ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {groupTotals.admAccounts.length} contas
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-destructive font-medium">{formatMoney(apuracao.adm, true)}</span>
                  <span className="w-16 text-right text-destructive">
                    {apuracao.fat > 0 ? formatPercent((apuracao.adm / apuracao.fat) * 100) : "0,0%"}
                  </span>
                </div>
              </div>

              {/* Subcontas Administrativas */}
              {expandedSections.has("adm") && (
                <div className="bg-muted/20 pl-8 pr-4 py-2 space-y-1.5 text-[11px] border-l-2 border-destructive/40">
                  {groupTotals.admAccounts.map((a) => (
                    <div
                      key={a.conta}
                      onClick={() => handleOpenAccountDetail(a.conta, "Despesas Administrativas")}
                      className="flex items-center justify-between text-muted-foreground hover:text-foreground cursor-pointer py-0.5"
                    >
                      <span className="font-sans truncate max-w-[280px]">{a.conta}</span>
                      <div className="flex items-center gap-6">
                        <span>{formatMoney(a.valor)}</span>
                        <span className="w-16 text-right tabular-nums text-[10px]">
                          {apuracao.fat > 0 ? formatPercent((a.valor / apuracao.fat) * 100) : "0,0%"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 6. Despesa logística */}
              <div className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2 font-sans pl-2">
                  <span className="text-foreground">(-) Despesa logística</span>
                  {groupTotals.logAccounts.length > 0 && (
                    <button
                      onClick={() => toggleSection("log")}
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 ml-1"
                    >
                      {expandedSections.has("log") ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {groupTotals.logAccounts.length} contas
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-destructive font-medium">{formatMoney(apuracao.log, true)}</span>
                  <span className="w-16 text-right text-destructive">
                    {apuracao.fat > 0 ? formatPercent((apuracao.log / apuracao.fat) * 100) : "0,0%"}
                  </span>
                </div>
              </div>

              {/* Subcontas Logística */}
              {expandedSections.has("log") && (
                <div className="bg-muted/20 pl-8 pr-4 py-2 space-y-1.5 text-[11px] border-l-2 border-chart-line/40">
                  {groupTotals.logAccounts.map((a) => (
                    <div
                      key={a.conta}
                      onClick={() => handleOpenAccountDetail(a.conta, "Despesa logistica")}
                      className="flex items-center justify-between text-muted-foreground hover:text-foreground cursor-pointer py-0.5"
                    >
                      <span className="font-sans truncate max-w-[280px]">{a.conta}</span>
                      <div className="flex items-center gap-6">
                        <span>{formatMoney(a.valor)}</span>
                        <span className="w-16 text-right tabular-nums text-[10px]">
                          {apuracao.fat > 0 ? formatPercent((a.valor / apuracao.fat) * 100) : "0,0%"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 7. Taxas de cartão */}
              <div className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2 font-sans pl-2">
                  <span className="text-foreground">(-) Taxas de cartão</span>
                  {groupTotals.cartaoAccounts.length > 0 && (
                    <button
                      onClick={() => toggleSection("cartao")}
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 ml-1"
                    >
                      {expandedSections.has("cartao") ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {groupTotals.cartaoAccounts.length} contas
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-destructive font-medium">{formatMoney(apuracao.cartao, true)}</span>
                  <span className="w-16 text-right text-destructive">
                    {apuracao.fat > 0 ? formatPercent((apuracao.cartao / apuracao.fat) * 100) : "0,0%"}
                  </span>
                </div>
              </div>

              {/* Subcontas Cartão */}
              {expandedSections.has("cartao") && (
                <div className="bg-muted/20 pl-8 pr-4 py-2 space-y-1.5 text-[11px] border-l-2 border-chart-line/40">
                  {groupTotals.cartaoAccounts.map((a) => (
                    <div
                      key={a.conta}
                      onClick={() => handleOpenAccountDetail(a.conta, "Taxas de cartão")}
                      className="flex items-center justify-between text-muted-foreground hover:text-foreground cursor-pointer py-0.5"
                    >
                      <span className="font-sans truncate max-w-[280px]">{a.conta}</span>
                      <div className="flex items-center gap-6">
                        <span>{formatMoney(a.valor)}</span>
                        <span className="w-16 text-right tabular-nums text-[10px]">
                          {apuracao.fat > 0 ? formatPercent((a.valor / apuracao.fat) * 100) : "0,0%"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 8. Tributos */}
              <div className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2 font-sans pl-2">
                  <span className="text-foreground">(-) Tributos</span>
                  {groupTotals.tribAccounts.length > 0 && (
                    <button
                      onClick={() => toggleSection("trib")}
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 ml-1"
                    >
                      {expandedSections.has("trib") ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {groupTotals.tribAccounts.length} contas
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-destructive font-medium">{formatMoney(apuracao.trib, true)}</span>
                  <span className="w-16 text-right text-destructive">
                    {apuracao.fat > 0 ? formatPercent((apuracao.trib / apuracao.fat) * 100) : "0,0%"}
                  </span>
                </div>
              </div>

              {/* Subcontas Tributos */}
              {expandedSections.has("trib") && (
                <div className="bg-muted/20 pl-8 pr-4 py-2 space-y-1.5 text-[11px] border-l-2 border-chart-amber/40">
                  {groupTotals.tribAccounts.map((a) => (
                    <div
                      key={a.conta}
                      onClick={() => handleOpenAccountDetail(a.conta, "Tributos")}
                      className="flex items-center justify-between text-muted-foreground hover:text-foreground cursor-pointer py-0.5"
                    >
                      <span className="font-sans truncate max-w-[280px]">{a.conta}</span>
                      <div className="flex items-center gap-6">
                        <span>{formatMoney(a.valor)}</span>
                        <span className="w-16 text-right tabular-nums text-[10px]">
                          {apuracao.fat > 0 ? formatPercent((a.valor / apuracao.fat) * 100) : "0,0%"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 9. Total despesas */}
              <div className="flex items-center justify-between p-3.5 bg-destructive/10 font-bold hover:bg-destructive/15 transition-colors">
                <div className="flex items-center gap-2 font-sans">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  <span className="text-destructive uppercase text-xs tracking-wider">Total despesas operacionais</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-destructive text-sm">{formatMoney(apuracao.despTot)}</span>
                  <span className="w-16 text-right text-destructive font-bold">
                    {apuracao.fat > 0 ? formatPercent((apuracao.despTot / apuracao.fat) * 100) : "0,0%"}
                  </span>
                </div>
              </div>

              {/* 10. Lucro líquido */}
              <div className="flex items-center justify-between p-3.5 bg-muted/70 font-bold border-t-2 border-border hover:bg-muted/90 transition-colors">
                <div className="flex items-center gap-2 font-sans">
                  <div className={cn("w-2 h-2 rounded-full", apuracao.lucro >= 0 ? "bg-primary" : "bg-destructive")} />
                  <span className="text-foreground text-sm">(=) Lucro líquido</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className={cn("text-sm", apuracao.lucro >= 0 ? "text-primary" : "text-destructive")}>
                    {formatMoney(apuracao.lucro)}
                  </span>
                  <span className={cn("w-16 text-right font-bold", apuracao.lucro >= 0 ? "text-primary" : "text-destructive")}>
                    {apuracao.fat > 0 ? formatPercent((apuracao.lucro / apuracao.fat) * 100) : "0,0%"}
                  </span>
                </div>
              </div>

              {/* 11. Comissão parceiro */}
              <div className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2 font-sans pl-2">
                  <span className="text-foreground font-medium">(-) Comissão parceiro</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] py-0 px-1 tabular-nums",
                      partnerInfo.hasRules
                        ? "bg-chart-line/10 border-chart-line/30 text-chart-line font-semibold"
                        : "border-muted-foreground/30 text-muted-foreground font-normal"
                    )}
                  >
                    {partnerInfo.badgeLabel}
                  </Badge>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-chart-line tabular-nums font-semibold">
                    {formatMoney(apuracao.comissao)}
                  </span>
                  <span className="w-16 text-right text-chart-line tabular-nums">
                    {apuracao.fat > 0 ? formatPercent((apuracao.comissao / apuracao.fat) * 100) : "0,0%"}
                  </span>
                </div>
              </div>

              {/* 12. Distribuição do lucro */}
              <div className="flex items-center justify-between p-4 bg-primary/15 font-bold text-sm border-t-2 border-primary/30 hover:bg-primary/20 transition-colors">
                <div className="flex flex-col font-sans">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <span className="text-primary text-base">(=) Distribuição do lucro</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-normal pl-4.5">
                    Resultado final pós-comissão de parceiro
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-primary tabular-nums text-base">{formatMoney(apuracao.dist)}</span>
                  <span className="w-16 text-right text-primary tabular-nums text-base font-bold">
                    {apuracao.fat > 0 ? formatPercent((apuracao.dist / apuracao.fat) * 100) : "0,0%"}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* LADO DIREITO (5 Colunas): GRÁFICO DE EVOLUÇÃO + ANÁLISE DE COMISSÃO & PARCEIROS */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card de Evolução Mensal */}
          <Card className="p-5 rounded-xl bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-primary" /> Evolução Mensal da Apuração
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{yearLabel}</span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolutionData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradFatApuracao" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLucroApuracao" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-blue)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--chart-blue)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradDespApuracao" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-red)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--chart-red)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} vertical={false} />
                  <XAxis dataKey="label" stroke="currentColor" opacity={0.5} fontSize={10} tickLine={false} />
                  <YAxis stroke="currentColor" opacity={0.5} fontSize={10} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)", borderRadius: "8px", fontSize: "11px" }}
                    formatter={(val: number) => [formatMoney(val), ""]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "5px" }} />
                  <Area type="monotone" dataKey="faturamento" name="Faturamento" stroke="var(--primary)" fillOpacity={1} fill="url(#gradFatApuracao)" strokeWidth={2} />
                  <Area type="monotone" dataKey="margem" name="Margem Contrib." stroke="var(--chart-blue)" fillOpacity={1} fill="url(#gradLucroApuracao)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="despesas" name="Total Despesas" stroke="var(--chart-red)" fillOpacity={1} fill="url(#gradDespApuracao)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="distribuicao" name="Distribuição Lucro" stroke="var(--chart-line)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Card Detalhamento do Parceiro & Regras */}
          <Card className="p-5 rounded-xl bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4 text-chart-line" /> Cálculo da Comissão do Parceiro
              </span>
              <Link
                to="/configuracoes"
                className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
              >
                Ajustar regras
              </Link>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-chart-line/10 border border-chart-line/20 space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-chart-line">
                  <span>Regra Aplicada:</span>
                  <span>{partnerInfo.displayLabel}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  A comissão incide sobre o Lucro Líquido gerado individualmente em cada filial/loja configurada onde há lucro operacional positivo.
                </p>
              </div>

              <div className="divide-y divide-border pt-1 tabular-nums">
                <div className="flex items-center justify-between py-1.5">
                  <span className="font-sans text-muted-foreground">Base (Lucro Líquido):</span>
                  <span className="font-bold">{formatMoney(apuracao.lucro)}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="font-sans text-muted-foreground">Total Comissão Apurada:</span>
                  <span className="font-bold text-chart-line">{formatMoney(apuracao.comissao)}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 font-bold">
                  <span className="font-sans text-primary">Distribuição Líquida Matriz:</span>
                  <span className="text-primary">{formatMoney(apuracao.dist)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Dica / Info Box */}
          <div className="p-4 rounded-xl border border-border bg-muted/40 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Info className="h-4 w-4 text-primary" />
              <span>Dicas de Auditoria</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Você pode clicar no número de contas em cada grupo de despesa para expandir as contas padronizadas da planilha e auditar cada lançamento original.
            </p>
          </div>
        </div>
      </div>

      {/* --- MODAL DE AUDITORIA DE LANÇAMENTOS DO SUPABASE --- */}
      <Dialog open={!!selectedCellDetail} onOpenChange={(open) => !open && setSelectedCellDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-bold text-foreground">
                Auditoria de Lançamentos
              </DialogTitle>
              <Badge variant="outline" className="text-xs tabular-nums">
                {selectedCellDetail?.accountCode || "Conta Padronizada"}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedCellDetail?.accountDesc} • {selectedCellDetail?.category} • {selectedCellDetail?.monthLabel} de {selectedCellDetail?.year}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3 space-y-3">
            <div className="flex items-center justify-between text-xs bg-muted/50 p-2.5 rounded-lg border border-border">
              <span className="font-medium text-muted-foreground">
                Total de Registros: <strong className="text-foreground">{selectedCellDetail?.records.length || 0}</strong>
              </span>
              <span className="font-medium text-muted-foreground">
                Valor Total:{" "}
                <strong
                  className={cn(
                    "tabular-nums text-sm font-bold",
                    (selectedCellDetail?.records || []).some((r) => Number(r.debito) > 0)
                      ? "text-destructive"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {formatMoney(
                    (selectedCellDetail?.records || []).reduce((acc, r) => {
                      const deb = Number(r.debito) || 0;
                      const cred = Number(r.valor_liquido || r.credito) || 0;
                      return acc + (deb > 0 ? deb : cred);
                    }, 0)
                  )}
                </strong>
              </span>
            </div>

            <div className="border border-border rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-muted font-semibold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-2.5">Data</th>
                    <th className="p-2.5">Loja / Cidade</th>
                    <th className="p-2.5">Descrição Original</th>
                    <th className="p-2.5 text-right">
                      {(selectedCellDetail?.records || []).some((r) => Number(r.debito) > 0) ? "Débito" : "Valor Recebido"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(selectedCellDetail?.records || []).slice(0, 100).map((r, idx) => {
                    const isDeb = Number(r.debito) > 0;
                    const val = isDeb ? Number(r.debito) : Number(r.valor_liquido || r.credito || 0);
                    return (
                      <tr key={idx} className="hover:bg-muted/40 transition-colors">
                        <td className="p-2.5 text-muted-foreground whitespace-nowrap tabular-nums text-[11px]">
                          {formatDateDisplay(r.mes_inicio || r.data)}
                        </td>
                        <td className="p-2.5 font-medium whitespace-nowrap">
                          {r.loja} {r.cidade && r.cidade !== "Matriz" ? `(${r.cidade})` : ""}
                        </td>
                        <td className="p-2.5 text-muted-foreground max-w-xs truncate" title={r.descricao_conta || r.descricao}>
                          {r.descricao_conta || r.descricao || "—"}
                          {r.categoria && (
                            <Badge variant="outline" className="ml-1 text-[9px] py-0 px-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                              {r.categoria}
                            </Badge>
                          )}
                        </td>
                        <td
                          className={cn(
                            "p-2.5 text-right tabular-nums font-medium whitespace-nowrap",
                            isDeb ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {formatMoney(val)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(selectedCellDetail?.records || []).length > 100 && (
                <div className="p-2 text-center text-xs text-muted-foreground bg-muted/30">
                  Mostrando os primeiros 100 registros de {selectedCellDetail?.records.length}.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

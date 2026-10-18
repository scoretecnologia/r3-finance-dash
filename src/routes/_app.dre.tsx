import { useState, useMemo, useEffect, Fragment } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external";
import * as XLSX from "xlsx";
import {
  ChevronDown,
  ChevronRight,
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
import { cn } from "@/lib/utils";
import { GROUP_DEFS } from "@/lib/dre";

const groupColor = (id: string) => GROUP_DEFS.find((g) => g.id === id)?.color ?? "var(--muted-foreground)";

export const Route = createFileRoute("/_app/dre")({
  component: DashboardPage,
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
  XLSX.utils.book_append_sheet(workbook, worksheet, "Detalhamento");
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

interface CellDetailState {
  accountCode: string;
  accountDesc: string;
  category: string;
  monthKey: string;
  monthLabel: string;
  year: string;
  records: any[];
}

// Definição dos Grupos Gerenciais da DRE (Baseado no modelo gerencial do Grupo R3)
interface ManagerialGroupDef {
  id: string;
  label: string;
  dbGroup: string;
  tipo: "DEDUCAO" | "DESPESA" | "COMISSAO" | "INVESTIMENTO" | "NAO_OPERACIONAL";
  badgeClass: string;
  textClass: string;
}

const MANAGERIAL_GROUPS: ManagerialGroupDef[] = [
  {
    id: "avarias",
    label: "(-) Avarias",
    dbGroup: "Avarias",
    tipo: "DEDUCAO",
    badgeClass: "bg-muted text-muted-foreground border-border",
    textClass: "text-foreground",
  },
  {
    id: "desp_adm",
    label: "(-) Despesas Administrativas",
    dbGroup: "Despesas Administrativas",
    tipo: "DESPESA",
    badgeClass: "bg-muted text-muted-foreground border-border",
    textClass: "text-foreground",
  },
  {
    id: "desp_log",
    label: "(-) Despesa logística",
    dbGroup: "Despesa logistica",
    tipo: "DESPESA",
    badgeClass: "bg-muted text-muted-foreground border-border",
    textClass: "text-foreground",
  },
  {
    id: "taxas_cartao",
    label: "(-) Taxas de cartão",
    dbGroup: "Taxas de cartão",
    tipo: "DESPESA",
    badgeClass: "bg-muted text-muted-foreground border-border",
    textClass: "text-foreground",
  },
  {
    id: "tributos",
    label: "(-) Tributos",
    dbGroup: "Tributos",
    tipo: "DESPESA",
    badgeClass: "bg-muted text-muted-foreground border-border",
    textClass: "text-foreground",
  },
  {
    id: "investimentos",
    label: "(-) Investimentos",
    dbGroup: "Investimentos",
    tipo: "INVESTIMENTO",
    badgeClass: "bg-muted text-muted-foreground border-border",
    textClass: "text-foreground",
  },
  {
    id: "nao_operacionais",
    label: "(-) Outras / Não Operacionais",
    dbGroup: "Outras / Não Operacionais",
    tipo: "NAO_OPERACIONAL",
    badgeClass: "bg-muted text-muted-foreground border-border",
    textClass: "text-foreground",
  },
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

function DashboardPage() {
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
      return (data || []) as Array<{
        id: number;
        parceiro_nome: string;
        servidor_id?: number | null;
        servidor_nome?: string | null;
        cidade_id?: number | null;
        cidade_nome?: string | null;
        percentual_comissao: number;
        observacao?: string | null;
        ativo: boolean;
      }>;
    },
  });

  const isLoading =
    faturamentoQ.isLoading ||
    receberQ.isLoading ||
    dreQ.isLoading ||
    parceirosRegrasQ.isLoading ||
    servidoresQ.isLoading ||
    sublojasQ.isLoading;

  // Lojas Matrizes e Filiais Ativas (conforme módulo de Configurações)
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

  // Anos disponíveis nos dados (apenas considerando lojas e sublojas ativas)
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
  }, [faturamentoQ.data, receberQ.data, dreQ.data, activeServidorIds, activeSublojaIds]);

  // Filtros Globais
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  // Listas vazias significam "todos"
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedServidores, setSelectedServidores] = useState<string[]>([]);
  const [selectedCidades, setSelectedCidades] = useState<string[]>([]);
  const [dreSearch, setDreSearch] = useState<string>("");
  const [naturezaFilter, setNaturezaFilter] = useState<"todas" | "fixas" | "variaveis">("todas");

  // Limpeza de seleções caso a loja/filial tenha sido inativada nas configurações
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

  // Expansão de Grupos na DRE (recolhidos por padrão para visual enxuto)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Estado do Modal de Detalhamento da Célula DRE
  const [selectedCellDetail, setSelectedCellDetail] = useState<CellDetailState | null>(null);
  const [expandedRawRowId, setExpandedRawRowId] = useState<number | null>(null);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  };

  const expandAllGroups = () => {
    setExpandedGroups(new Set([...MANAGERIAL_GROUPS.map((g) => g.id), "receita_gerada"]));
  };

  const collapseAllGroups = () => {
    setExpandedGroups(new Set());
  };

  // Filiais ativas filtradas pelas matrizes selecionadas
  const filteredSublojas = useMemo(() => {
    if (selectedServidores.length === 0) return activeSublojas;
    const set = new Set(selectedServidores.map(Number));
    return activeSublojas.filter((s) => set.has(Number(s.servidor_id)));
  }, [activeSublojas, selectedServidores]);

  // Ao mudar as matrizes, mantém apenas as filiais ativas que ainda pertencem à seleção
  const handleServidoresChange = (values: string[]) => {
    setSelectedServidores(values);
    if (values.length === 0) return;
    const allowed = new Set(
      activeSublojas
        .filter((s) => values.includes(String(s.servidor_id)))
        .map((s) => String(s.cidade_id))
    );
    setSelectedCidades((prev) => prev.filter((c) => allowed.has(c)));
  };

  const servidorOptions = useMemo(
    () =>
      activeServidores.map((s) => ({
        value: String(s.servidor_id),
        label: s.nome || `Servidor ${s.servidor_id}`,
      })),
    [activeServidores]
  );
  const sublojaOptions = useMemo(
    () => filteredSublojas.map((s) => ({ value: String(s.cidade_id), label: s.nome || `Cidade ${s.cidade_id}` })),
    [filteredSublojas]
  );
  const monthOptions = useMemo(() => MONTH_LABELS.map((m) => ({ value: m.key, label: m.full })), []);

  // Meses visíveis na DRE (respeita o filtro de meses)
  const visibleMonthLabels = useMemo(
    () => (selectedMonths.length === 0 ? MONTH_LABELS : MONTH_LABELS.filter((m) => selectedMonths.includes(m.key))),
    [selectedMonths]
  );
  const visibleMonthKeys = useMemo(() => visibleMonthLabels.map((m) => m.key), [visibleMonthLabels]);
  const hasMonthFilter = selectedMonths.length > 0;
  const totalColumnLabel = hasMonthFilter ? "Total Período" : "Total Ano";

  // Nome das lojas / cidades selecionadas para exibição no card de Apuração
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

  // --- FILTRAGEM BASE DOS DADOS PELOS FILTROS SELECIONADOS ---
  const filteredFatData = useMemo(() => {
    let list = faturamentoQ.data ?? [];

    // Ignora dados de lojas/servidores ou sublojas inativas nas configurações
    list = list.filter((item) => {
      if (item.id_servidor && !activeServidorIds.has(Number(item.id_servidor))) {
        return false;
      }
      if (item.id_cidade && !activeSublojaIds.has(Number(item.id_cidade))) {
        return false;
      }
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

    // Ignora dados de lojas/servidores ou sublojas inativas nas configurações
    list = list.filter((item) => {
      if (item.id_servidor && !activeServidorIds.has(Number(item.id_servidor))) {
        return false;
      }
      if (item.id_cidade && !activeSublojaIds.has(Number(item.id_cidade))) {
        return false;
      }
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

    // Ignora dados de lojas/servidores ou sublojas inativas nas configurações
    list = list.filter((item) => {
      if (item.id_servidor && !activeServidorIds.has(Number(item.id_servidor))) {
        return false;
      }
      if (item.id_cidade && !activeSublojaIds.has(Number(item.id_cidade))) {
        return false;
      }
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

  // --- MAPEAMENTO MATRICIAL MENSAL (12 MESES: JAN a DEZ) ---
  // 1. Faturamento por Mês
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

  const faturamentoTotalAno = useMemo(() => {
    return Object.values(faturamentoMensal).reduce((a, b) => a + b, 0);
  }, [faturamentoMensal]);

  // 1.1 Receita Gerada (grupo_r3_receber_detalhado) - Total Mensal e Contas
  const receitaData = useMemo(() => {
    const monthly: Record<string, number> = {};
    MONTH_KEYS.forEach((m) => (monthly[m] = 0));
    let total = 0;

    const accountsMap = new Map<
      string,
      {
        name: string;
        sampleCode: string;
        categoria?: string;
        natureza: string;
        monthly: Record<string, number>;
        total: number;
      }
    >();

    filteredReceberData.forEach((item) => {
      const accName = item.conta_padronizada || item.descricao_conta || "Outras Receitas";
      const m = extractMonthStr(item.mes_inicio);
      const val = Number(item.valor_liquido) || Number(item.credito) || 0;

      if (m && monthly[m] !== undefined) {
        monthly[m] += val;
      }
      total += val;

      if (!accountsMap.has(accName)) {
        const accM: Record<string, number> = {};
        MONTH_KEYS.forEach((k) => (accM[k] = 0));
        accountsMap.set(accName, {
          name: accName,
          sampleCode: item.codigo_conta || "",
          categoria: item.categoria || "",
          natureza: item.natureza || "Receita",
          monthly: accM,
          total: 0,
        });
      }

      const accObj = accountsMap.get(accName)!;
      if (m && accObj.monthly[m] !== undefined) {
        accObj.monthly[m] += val;
      }
      accObj.total += val;
      if (!accObj.sampleCode && item.codigo_conta) accObj.sampleCode = item.codigo_conta;
      if (!accObj.categoria && item.categoria) accObj.categoria = item.categoria;
    });

    const allAccounts = Array.from(accountsMap.values()).sort((a, b) => b.total - a.total);

    const filteredAccounts = dreSearch.trim()
      ? allAccounts.filter(
          (acc) =>
            acc.name.toLowerCase().includes(dreSearch.toLowerCase()) ||
            acc.sampleCode.toLowerCase().includes(dreSearch.toLowerCase()) ||
            (acc.categoria && acc.categoria.toLowerCase().includes(dreSearch.toLowerCase()))
        )
      : allAccounts;

    return {
      monthly,
      total,
      accounts: filteredAccounts,
    };
  }, [filteredReceberData, dreSearch]);

  // 2. Agrupamento Gerencial da DRE por Grupo e Conta Padronizada
  const dreGroupsData = useMemo(() => {
    return MANAGERIAL_GROUPS.map((groupDef) => {
      // Filtrar lançamentos que pertencem a este grupo gerencial
      const itemsInGroup = filteredDreData.filter((item) => {
        const itemGroup = item.grupo_dre || "Despesas Administrativas";
        return itemGroup === groupDef.dbGroup;
      });

      // Mapear por Conta Padronizada
      const accountsMap = new Map<
        string,
        {
          name: string;
          sampleCode: string;
          natureza: string;
          monthly: Record<string, number>;
          total: number;
        }
      >();

      const groupMonthly: Record<string, number> = {};
      MONTH_KEYS.forEach((k) => (groupMonthly[k] = 0));
      let groupTotal = 0;

      itemsInGroup.forEach((item) => {
        const accName = item.conta_padronizada || item.descricao_conta || "Outras Contas";
        const m = extractMonthStr(item.mes_inicio);
        const debito = Number(item.debito) || 0;

        if (m && groupMonthly[m] !== undefined) {
          groupMonthly[m] += debito;
        }
        groupTotal += debito;

        if (!accountsMap.has(accName)) {
          const accM: Record<string, number> = {};
          MONTH_KEYS.forEach((k) => (accM[k] = 0));
          accountsMap.set(accName, {
            name: accName,
            sampleCode: item.codigo_conta || "",
            natureza: item.natureza || "Despesa Fixa",
            monthly: accM,
            total: 0,
          });
        }

        const accObj = accountsMap.get(accName)!;
        if (m && accObj.monthly[m] !== undefined) {
          accObj.monthly[m] += debito;
        }
        accObj.total += debito;
      });

      const allAccounts = Array.from(accountsMap.values())
        .filter((acc) => {
          if (naturezaFilter === "fixas") return (acc.natureza || "").includes("Fixa");
          if (naturezaFilter === "variaveis") return (acc.natureza || "").includes("Vari");
          return true;
        })
        .sort((a, b) => b.total - a.total);

      const filteredAccounts = dreSearch.trim()
        ? allAccounts.filter(
            (acc) =>
              acc.name.toLowerCase().includes(dreSearch.toLowerCase()) ||
              acc.sampleCode.toLowerCase().includes(dreSearch.toLowerCase())
          )
        : allAccounts;

      return {
        ...groupDef,
        monthly: groupMonthly,
        total: groupTotal,
        accounts: filteredAccounts,
      };
    });
  }, [filteredDreData, dreSearch, naturezaFilter]);

  // Lookup fácil dos totais de cada grupo por mês
  const groupTotalsMap = useMemo(() => {
    const map: Record<string, { monthly: Record<string, number>; total: number }> = {};
    dreGroupsData.forEach((g) => {
      map[g.id] = { monthly: g.monthly, total: g.total };
    });
    return map;
  }, [dreGroupsData]);

  // --- CÁLCULO DAS LINHAS GERENCIAIS DO DRE (MÊS A MÊS + TOTAL ANO) ---
  // Avarias
  const avariasMonthly = groupTotalsMap["avarias"]?.monthly || {};
  const avariasTotal = groupTotalsMap["avarias"]?.total || 0;

  // CMV (0,00 padrão)
  const cmvMonthly: Record<string, number> = useMemo(() => {
    const m: Record<string, number> = {};
    MONTH_KEYS.forEach((k) => (m[k] = 0));
    return m;
  }, []);
  const cmvTotal = 0;

  // (=) Margem de contribuição = Faturamento - CMV - Avarias
  const margemContribMonthly = useMemo(() => {
    const m: Record<string, number> = {};
    MONTH_KEYS.forEach((k) => {
      m[k] = (faturamentoMensal[k] || 0) - (cmvMonthly[k] || 0) - (avariasMonthly[k] || 0);
    });
    return m;
  }, [faturamentoMensal, cmvMonthly, avariasMonthly]);
  const margemContribTotal = faturamentoTotalAno - cmvTotal - avariasTotal;

  // Despesas Operacionais Totais = Desp Adm + Desp Logística + Taxas Cartão + Tributos
  const despesasOperacionaisMonthly = useMemo(() => {
    const m: Record<string, number> = {};
    const adm = groupTotalsMap["desp_adm"]?.monthly || {};
    const log = groupTotalsMap["desp_log"]?.monthly || {};
    const car = groupTotalsMap["taxas_cartao"]?.monthly || {};
    const tri = groupTotalsMap["tributos"]?.monthly || {};
    MONTH_KEYS.forEach((k) => {
      m[k] = (adm[k] || 0) + (log[k] || 0) + (car[k] || 0) + (tri[k] || 0);
    });
    return m;
  }, [groupTotalsMap]);

  const despesasOperacionaisTotal =
    (groupTotalsMap["desp_adm"]?.total || 0) +
    (groupTotalsMap["desp_log"]?.total || 0) +
    (groupTotalsMap["taxas_cartao"]?.total || 0) +
    (groupTotalsMap["tributos"]?.total || 0);

  // (=) Lucro Líquido = Margem de Contribuição - Total Despesas
  const lucroLiquidoMonthly = useMemo(() => {
    const m: Record<string, number> = {};
    MONTH_KEYS.forEach((k) => {
      m[k] = (margemContribMonthly[k] || 0) - (despesasOperacionaisMonthly[k] || 0);
    });
    return m;
  }, [margemContribMonthly, despesasOperacionaisMonthly]);
  const lucroLiquidoTotal = margemContribTotal - despesasOperacionaisTotal;

  // --- IDENTIFICAÇÃO E CÁLCULO DE COMISSÃO DE PARCEIROS ---
  // Identificação dos parceiros responsáveis pelo escopo filtrado
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

  // Cálculo Mês a Mês da Comissão de Parceiro (Loja por Loja conforme regras ativas)
  const partnerCommissions = useMemo(() => {
    const rules = parceirosRegrasQ.data ?? [];
    const monthlyComissao: Record<string, number> = {};
    MONTH_KEYS.forEach((m) => (monthlyComissao[m] = 0));

    if (rules.length === 0) {
      return {
        monthly: monthlyComissao,
        total: 0,
      };
    }

    // Agrupar faturamento, avarias e despesas operacionais por loja e por mês
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
          group === "Despesas com Logística" ||
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
          // Lucro Líquido da Loja naquele mês = Margem (Fat - Avarias) - Despesas
          const lucroLoja = (fat[m] - avarias[m]) - desp[m];
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

  const comissaoParceiroMonthly = partnerCommissions.monthly;
  const comissaoParceiroTotal = partnerCommissions.total;

  // (=) Distribuição do Lucro = Lucro Líquido - Comissão Parceiro
  const distribuicaoLucroMonthly = useMemo(() => {
    const m: Record<string, number> = {};
    MONTH_KEYS.forEach((k) => {
      m[k] = (lucroLiquidoMonthly[k] || 0) - (comissaoParceiroMonthly[k] || 0);
    });
    return m;
  }, [lucroLiquidoMonthly, comissaoParceiroMonthly]);
  const distribuicaoLucroTotal = lucroLiquidoTotal - comissaoParceiroTotal;

  // Investimentos e Não Operacionais
  // --- VALORES SELECIONADOS PARA O CARD DE APURAÇÃO EXECUTIVA ---
  // Como os dados base já respeitam o filtro de meses, os totais representam o período selecionado
  const activeMonthLabel = !hasMonthFilter
    ? "Acumulado Anual"
    : visibleMonthLabels.length === 1
      ? visibleMonthLabels[0].full
      : visibleMonthLabels.map((m) => m.short).join(", ");
  const yearLabel = selectedYear === "todos" ? "Todos os Anos" : selectedYear;

  // Handler para abrir modal com os lançamentos originais da conta padronizada
  const handleCellClick = (accName: string, sampleCode: string, groupName: string, monthKey: string) => {
    const monthLabel = MONTH_LABELS.find((m) => m.key === monthKey)?.full || monthKey;

    let records = filteredDreData.filter((item) => {
      const matchAcc = (item.conta_padronizada || item.descricao_conta) === accName;
      const matchMonth = extractMonthStr(item.mes_inicio) === monthKey;
      return matchAcc && matchMonth;
    });

    if (records.length === 0) {
      records = filteredReceberData.filter((item) => {
        const matchAcc = (item.conta_padronizada || item.descricao_conta) === accName;
        const matchMonth = extractMonthStr(item.mes_inicio) === monthKey;
        return matchAcc && matchMonth;
      });
    }

    setSelectedCellDetail({
      accountCode: sampleCode || records[0]?.codigo_conta || "—",
      accountDesc: accName,
      category: groupName,
      monthKey: monthKey,
      monthLabel: monthLabel,
      year: yearLabel,
      records: records,
    });
    setExpandedRawRowId(null);
  };

  // Exportação Excel da DRE Gerencial Completa
  const handleExportFullDRE = () => {
    const rows: Record<string, unknown>[] = [];

    // Faturamento
    const fatRow: Record<string, unknown> = {
      "Grupo DRE": "(=) Faturamento",
      "Conta Padronizada": "FATURAMENTO BRUTO",
    };
    visibleMonthLabels.forEach((ml) => (fatRow[ml.short] = faturamentoMensal[ml.key]));
    fatRow[totalColumnLabel] = faturamentoTotalAno;
    fatRow["% Faturamento"] = "100.0%";
    rows.push(fatRow);

    // Receita Gerada (grupo_r3_receber_detalhado)
    const recRow: Record<string, unknown> = {
      "Grupo DRE": "(+) Receita Gerada",
      "Conta Padronizada": "RECEITA GERADA (CONTAS A RECEBER)",
    };
    visibleMonthLabels.forEach((ml) => (recRow[ml.short] = receitaData.monthly[ml.key]));
    recRow[totalColumnLabel] = receitaData.total;
    recRow["% Faturamento"] = faturamentoTotalAno > 0 ? formatPercent((receitaData.total / faturamentoTotalAno) * 100) : "0.0%";
    rows.push(recRow);

    receitaData.accounts.forEach((acc) => {
      const accRow: Record<string, unknown> = {
        "Grupo DRE": "(+) Receita Gerada",
        "Conta Padronizada": `${acc.sampleCode ? `[${acc.sampleCode}] ` : ""}${acc.name}${acc.categoria ? ` (${acc.categoria})` : ""}`,
      };
      visibleMonthLabels.forEach((ml) => (accRow[ml.short] = acc.monthly[ml.key]));
      accRow[totalColumnLabel] = acc.total;
      accRow["% Faturamento"] = faturamentoTotalAno > 0 ? formatPercent((acc.total / faturamentoTotalAno) * 100) : "0.0%";
      rows.push(accRow);
    });

    // Grupos e Contas
    dreGroupsData.forEach((group) => {
      const gRow: Record<string, unknown> = {
        "Grupo DRE": group.label,
        "Conta Padronizada": `TOTAL ${group.label.toUpperCase()}`,
      };
      visibleMonthLabels.forEach((ml) => (gRow[ml.short] = group.monthly[ml.key]));
      gRow[totalColumnLabel] = group.total;
      gRow["% Faturamento"] = faturamentoTotalAno > 0 ? formatPercent((group.total / faturamentoTotalAno) * 100) : "0.0%";
      rows.push(gRow);

      group.accounts.forEach((acc) => {
        const accRow: Record<string, unknown> = {
          "Grupo DRE": group.label,
          "Conta Padronizada": `${acc.sampleCode ? `[${acc.sampleCode}] ` : ""}${acc.name}`,
        };
        visibleMonthLabels.forEach((ml) => (accRow[ml.short] = acc.monthly[ml.key]));
        accRow[totalColumnLabel] = acc.total;
        accRow["% Faturamento"] = faturamentoTotalAno > 0 ? formatPercent((acc.total / faturamentoTotalAno) * 100) : "0.0%";
        rows.push(accRow);
      });
    });

    // Totais Finais
    const lucroRow: Record<string, unknown> = {
      "Grupo DRE": "(=) Lucro Líquido",
      "Conta Padronizada": "LUCRO LÍQUIDO OPERACIONAL",
    };
    visibleMonthLabels.forEach((ml) => (lucroRow[ml.short] = lucroLiquidoMonthly[ml.key] || 0));
    lucroRow[totalColumnLabel] = lucroLiquidoTotal;
    lucroRow["% Faturamento"] = faturamentoTotalAno > 0 ? formatPercent((lucroLiquidoTotal / faturamentoTotalAno) * 100) : "0.0%";
    rows.push(lucroRow);

    const comissaoRow: Record<string, unknown> = {
      "Grupo DRE": "(-) Comissão Parceiro",
      "Conta Padronizada": `COMISSÃO PARCEIRO (${partnerInfo.displayLabel})`,
    };
    visibleMonthLabels.forEach((ml) => (comissaoRow[ml.short] = comissaoParceiroMonthly[ml.key] || 0));
    comissaoRow[totalColumnLabel] = comissaoParceiroTotal;
    comissaoRow["% Faturamento"] = faturamentoTotalAno > 0 ? formatPercent((comissaoParceiroTotal / faturamentoTotalAno) * 100) : "0.0%";
    rows.push(comissaoRow);

    const distRow: Record<string, unknown> = {
      "Grupo DRE": "(=) Distribuição do Lucro",
      "Conta Padronizada": "RESULTADO FINAL / DISTRIBUIÇÃO",
    };
    visibleMonthLabels.forEach((ml) => (distRow[ml.short] = distribuicaoLucroMonthly[ml.key] || 0));
    distRow[totalColumnLabel] = distribuicaoLucroTotal;
    distRow["% Faturamento"] = faturamentoTotalAno > 0 ? formatPercent((distribuicaoLucroTotal / faturamentoTotalAno) * 100) : "0.0%";
    rows.push(distRow);

    exportToXLSX(rows, `DRE_Gerencial_Grupo_R3_${selectedYear}${hasMonthFilter ? `_${visibleMonthKeys.join("-")}` : ""}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* --- CABEÇALHO & FILTROS GLOBAIS --- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-extrabold tracking-tight text-foreground">
              DRE Gerencial
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px] gap-1 font-sans">
              <CheckCircle2 className="h-3 w-3" /> Plano de Contas Padronizado
            </Badge>
            <Link
              to="/apuracao"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all ml-1 shadow-sm"
              title="Ir para a tela detalhada de Apuração de Resultado"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Ver Apuração de Resultado</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Estrutura gerencial unificada: Faturamento, Margem de Contribuição, Despesas por Grupo e Distribuição de Lucro.
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

          {/* Filtro de Meses (múltiplo) */}
          <MultiSelectFilter
            options={monthOptions}
            selected={selectedMonths}
            onChange={setSelectedMonths}
            placeholder="Meses"
            searchPlaceholder="Buscar mês..."
            className="w-[130px]"
          />

          {/* Filtro de Loja Matriz (múltiplo, com busca) */}
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

          {/* Filtro de Subloja / Cidade (múltiplo, com busca) */}
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
            }}
            disabled={isLoading}
            className="h-8 px-2.5 text-xs rounded-lg border-border gap-1"
            title="Atualizar dados do Supabase"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>


      {/* --- SEÇÃO PRINCIPAL: TABELA MATRICIAL COMPLETA DA DRE GERENCIAL (12 MESES) --- */}
      <Card className="p-6 rounded-xl bg-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Matriz DRE Gerencial Detalhada (Janeiro a Dezembro)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clique em qualquer grupo para expandir as contas padronizadas. Clique em qualquer valor mensal para auditar os lançamentos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={expandAllGroups}
              className="h-8 text-xs rounded-lg border-border"
            >
              Expandir Todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAllGroups}
              className="h-8 text-xs rounded-lg border-border"
            >
              Recolher Todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportFullDRE}
              className="h-8 text-xs gap-1.5 rounded-lg border-border font-medium"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-primary" /> Exportar DRE XLSX
            </Button>
          </div>
        </div>

        {/* Campo de Busca Rápida de Contas */}
        {/* Campo de Busca Rápida de Contas e Filtro de Natureza */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Filtrar contas padronizadas..."
                value={dreSearch}
                onChange={(e) => setDreSearch(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg bg-background border-border"
              />
            </div>

            {/* Segmented control para Natureza Fixas / Variáveis */}
            <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={() => setNaturezaFilter("todas")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                  naturezaFilter === "todas"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setNaturezaFilter("fixas")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                  naturezaFilter === "fixas"
                    ? "bg-card text-muted-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Fixas
              </button>
              <button
                type="button"
                onClick={() => setNaturezaFilter("variaveis")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                  naturezaFilter === "variaveis"
                    ? "bg-card text-chart-amber shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Variáveis
              </button>
            </div>
          </div>

          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Exibindo dados padronizados de <strong className="text-foreground">{filteredDreData.length}</strong> registros
          </span>
        </div>

        {/* Tabela Matricial com Scroll */}
        <div className="max-h-[600px] overflow-y-auto overflow-x-auto rounded-xl border border-border bg-background relative shadow-inner">
          <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
            <thead className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
              <tr className="text-muted-foreground font-semibold uppercase tracking-wider">
                <th className="py-3 px-4 min-w-[300px] max-w-[300px] sticky left-0 bg-card z-40 border-r border-border shadow-md text-left">
                  Estrutura Gerencial
                </th>
                {visibleMonthLabels.map((m) => (
                  <th key={m.key} className="py-3 px-3 text-right min-w-[110px]">
                    {m.short}
                  </th>
                ))}
                <th className="py-3 px-4 text-right min-w-[130px] font-bold text-foreground bg-muted/60 border-l border-border">
                  {totalColumnLabel}
                </th>
                <th className="py-3 px-3 text-right min-w-[85px] font-bold text-muted-foreground bg-muted/40 border-l border-border">
                  % Fat.
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border tabular-nums">
              {/* ═══════════════════════════════════════════════════════════════════ */}
              {/* 1. (=) FATURAMENTO BRUTO                                           */}
              {/* ═══════════════════════════════════════════════════════════════════ */}
              <tr className="bg-primary/10 font-bold text-xs hover:bg-primary/15 transition-colors">
                <td className="py-3 px-4 font-sans text-primary min-w-[300px] max-w-[300px] sticky left-0 bg-card z-20 border-r border-border shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                    <span>(=) FATURAMENTO</span>
                  </div>
                </td>
                {visibleMonthKeys.map((m) => (
                  <td key={m} className="py-3 px-3 text-right text-primary">
                    {formatMoney(faturamentoMensal[m], true)}
                  </td>
                ))}
                <td className="py-3 px-4 text-right text-primary text-sm font-bold bg-primary/10 border-l border-border">
                  {formatMoney(faturamentoTotalAno)}
                </td>
                <td className="py-3 px-3 text-right text-primary font-bold bg-muted/20 border-l border-border">
                  100,0%
                </td>
              </tr>

              {/* ═══════════════════════════════════════════════════════════════════ */}
              {/* 1.1 (+) RECEITA GERADA (RECEBER) - grupo_r3_receber_detalhado       */}
              {/* ═══════════════════════════════════════════════════════════════════ */}
              <tr
                onClick={() => toggleGroup("receita_gerada")}
                className="bg-emerald-500/10 hover:bg-emerald-500/15 cursor-pointer font-bold text-xs transition-colors border-b border-border"
              >
                <td className="py-3 px-4 font-sans text-emerald-600 dark:text-emerald-400 min-w-[300px] max-w-[300px] sticky left-0 bg-card z-20 border-r border-border shadow-md">
                  <div className="flex items-center gap-2">
                    {expandedGroups.has("receita_gerada") ? (
                      <ChevronDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">(+) RECEITA GERADA</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0 px-1.5 rounded-md tabular-nums shrink-0 ml-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-medium"
                    >
                      {receitaData.accounts.length} contas
                    </Badge>
                  </div>
                </td>
                {visibleMonthKeys.map((m) => (
                  <td key={m} className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                    {formatMoney(receitaData.monthly[m], true)}
                  </td>
                ))}
                <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 text-sm font-bold bg-emerald-500/10 border-l border-border">
                  {formatMoney(receitaData.total)}
                </td>
                <td className="py-3 px-3 text-right text-emerald-700 dark:text-emerald-300 font-bold bg-muted/20 border-l border-border">
                  {faturamentoTotalAno > 0 ? formatPercent((receitaData.total / faturamentoTotalAno) * 100) : "—"}
                </td>
              </tr>

              {/* Linhas das Contas Padronizadas da Receita Gerada quando expandido */}
              {expandedGroups.has("receita_gerada") && (
                <>
                  {receitaData.accounts.map((acc) => {
                    const accPct = faturamentoTotalAno > 0 ? (acc.total / faturamentoTotalAno) * 100 : 0;
                    return (
                      <tr
                        key={acc.name}
                        className="bg-emerald-500/[0.03] hover:bg-emerald-500/[0.08] text-[11px] text-muted-foreground border-b border-border/40"
                      >
                        <td
                          className="py-2 px-4 pl-9 font-sans truncate min-w-[300px] max-w-[300px] sticky left-0 bg-card z-20 border-r border-border shadow-md"
                          title={`${acc.name} (cód: ${acc.sampleCode || "—"})`}
                        >
                          <div className="flex items-center">
                            <span className="text-[9px] px-1 py-0.5 rounded tabular-nums font-medium mr-1.5 border shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                              Receita
                            </span>
                            {acc.sampleCode && (
                              <span className="tabular-nums text-muted-foreground/60 mr-1.5 text-[10px]">
                                [{acc.sampleCode}]
                              </span>
                            )}
                            <span className="text-foreground/90 font-medium truncate">{acc.name}</span>
                            {acc.categoria && (
                              <span className="ml-1.5 text-[10px] text-muted-foreground/70 italic truncate">
                                ({acc.categoria})
                              </span>
                            )}
                          </div>
                        </td>
                        {visibleMonthKeys.map((m) => {
                          const val = acc.monthly[m];
                          const hasVal = val && Math.abs(val) > 0.01;
                          return (
                            <td
                              key={m}
                              onClick={() => {
                                if (hasVal) handleCellClick(acc.name, acc.sampleCode, "Receitas", m);
                              }}
                              className={cn(
                                "py-2 px-3 text-right tabular-nums transition-colors",
                                hasVal
                                  ? "cursor-pointer hover:bg-emerald-500/20 hover:text-emerald-600 underline decoration-dotted font-semibold text-foreground/90"
                                  : "text-muted-foreground/40"
                              )}
                              title={hasVal ? "Clique para auditar as receitas no ERP" : undefined}
                            >
                              {formatMoney(val, true)}
                            </td>
                          );
                        })}
                        <td className="py-2 px-4 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400 bg-muted/20 border-l border-border">
                          {formatMoney(acc.total)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-muted-foreground/70 bg-muted/10 border-l border-border text-[10px]">
                          {formatPercent(accPct)}
                        </td>
                      </tr>
                    );
                  })}
                  {receitaData.accounts.length === 0 && (
                    <tr className="bg-muted/10 text-[11px] text-muted-foreground">
                      <td colSpan={visibleMonthKeys.length + 3} className="py-2 px-6 text-center italic">
                        Nenhum registro de receita encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </>
              )}

              {/* 2. (-) CUSTO DA MERCADORIA VENDIDA (CMV) */}
              <tr className="bg-muted/10 text-muted-foreground font-medium text-xs">
                <td className="py-2.5 px-4 font-sans min-w-[300px] max-w-[300px] sticky left-0 bg-card z-20 border-r border-border shadow-md pl-7">
                  (-) Custo da mercadoria vendida
                </td>
                {visibleMonthKeys.map((m) => (
                  <td key={m} className="py-2.5 px-3 text-right">
                    {formatMoney(cmvMonthly[m], true)}
                  </td>
                ))}
                <td className="py-2.5 px-4 text-right bg-muted/20 border-l border-border">
                  {formatMoney(cmvTotal, true)}
                </td>
                <td className="py-2.5 px-3 text-right text-muted-foreground/70 bg-muted/10 border-l border-border">
                  0,0%
                </td>
              </tr>

              {/* 3. (-) AVARIAS (Expansível) */}
              {renderGroupSection(
                dreGroupsData.find((g) => g.id === "avarias")!,
                expandedGroups.has("avarias"),
                toggleGroup,
                faturamentoTotalAno,
                handleCellClick,
                visibleMonthKeys
              )}

              {/* ═══════════════════════════════════════════════════════════════════ */}
              {/* 4. (=) MARGEM DE CONTRIBUIÇÃO                                      */}
              {/* ═══════════════════════════════════════════════════════════════════ */}
              <tr className="bg-chart-blue/10 font-bold text-xs hover:bg-chart-blue/15 transition-colors border-y-2 border-chart-blue/20">
                <td className="py-3 px-4 font-sans text-chart-blue min-w-[300px] max-w-[300px] sticky left-0 bg-card z-20 border-r border-border shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-chart-blue shrink-0" />
                    <span>(=) MARGEM DE CONTRIBUIÇÃO</span>
                  </div>
                </td>
                {visibleMonthKeys.map((m) => (
                  <td key={m} className="py-3 px-3 text-right text-chart-blue">
                    {formatMoney(margemContribMonthly[m], true)}
                  </td>
                ))}
                <td className="py-3 px-4 text-right text-chart-blue text-sm font-bold bg-chart-blue/10 border-l border-border">
                  {formatMoney(margemContribTotal)}
                </td>
                <td className="py-3 px-3 text-right text-chart-blue font-bold bg-muted/20 border-l border-border">
                  {faturamentoTotalAno > 0 ? formatPercent((margemContribTotal / faturamentoTotalAno) * 100) : "0,0%"}
                </td>
              </tr>

              {/* 5. (-) DESPESAS ADMINISTRATIVAS (Expansível) */}
              {renderGroupSection(
                dreGroupsData.find((g) => g.id === "desp_adm")!,
                expandedGroups.has("desp_adm"),
                toggleGroup,
                faturamentoTotalAno,
                handleCellClick,
                visibleMonthKeys
              )}

              {/* 6. (-) DESPESA LOGÍSTICA (Expansível) */}
              {renderGroupSection(
                dreGroupsData.find((g) => g.id === "desp_log")!,
                expandedGroups.has("desp_log"),
                toggleGroup,
                faturamentoTotalAno,
                handleCellClick,
                visibleMonthKeys
              )}

              {/* 7. (-) TAXAS DE CARTÃO (Expansível) */}
              {renderGroupSection(
                dreGroupsData.find((g) => g.id === "taxas_cartao")!,
                expandedGroups.has("taxas_cartao"),
                toggleGroup,
                faturamentoTotalAno,
                handleCellClick,
                visibleMonthKeys
              )}

              {/* 8. (-) TRIBUTOS (Expansível) */}
              {renderGroupSection(
                dreGroupsData.find((g) => g.id === "tributos")!,
                expandedGroups.has("tributos"),
                toggleGroup,
                faturamentoTotalAno,
                handleCellClick,
                visibleMonthKeys
              )}

              {/* ═══════════════════════════════════════════════════════════════════ */}
              {/* 9. TOTAL DE DESPESAS                                               */}
              {/* ═══════════════════════════════════════════════════════════════════ */}
              <tr className="bg-destructive/10 font-bold text-xs text-destructive hover:bg-destructive/15 transition-colors border-y-2 border-destructive/20">
                <td className="py-3 px-4 font-sans uppercase tracking-wider min-w-[300px] max-w-[300px] sticky left-0 bg-card z-20 border-r border-border shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-destructive shrink-0" />
                    <span>TOTAL DESPESAS</span>
                  </div>
                </td>
                {visibleMonthKeys.map((m) => (
                  <td key={m} className="py-3 px-3 text-right">
                    {formatMoney(despesasOperacionaisMonthly[m], true)}
                  </td>
                ))}
                <td className="py-3 px-4 text-right text-sm font-bold bg-destructive/10 border-l border-border">
                  {formatMoney(despesasOperacionaisTotal)}
                </td>
                <td className="py-3 px-3 text-right font-bold bg-muted/20 border-l border-border">
                  {faturamentoTotalAno > 0 ? formatPercent((despesasOperacionaisTotal / faturamentoTotalAno) * 100) : "0,0%"}
                </td>
              </tr>

              {/* ═══════════════════════════════════════════════════════════════════ */}
              {/* 10. (=) LUCRO LÍQUIDO                                              */}
              {/* ═══════════════════════════════════════════════════════════════════ */}
              <tr className={cn("font-bold text-xs border-y-2 border-border transition-colors", lucroLiquidoTotal >= 0 ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive")}>
                <td className="py-3 px-4 font-sans min-w-[300px] max-w-[300px] sticky left-0 bg-card z-20 border-r border-border shadow-md">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", lucroLiquidoTotal >= 0 ? "bg-primary" : "bg-destructive")} />
                    <span>(=) LUCRO LÍQUIDO</span>
                  </div>
                </td>
                {visibleMonthKeys.map((m) => {
                  const res = lucroLiquidoMonthly[m];
                  return (
                    <td key={m} className={cn("py-3 px-3 text-right", res >= 0 ? "text-primary" : "text-destructive")}>
                      {formatMoney(res, true)}
                    </td>
                  );
                })}
                <td className="py-3 px-4 text-right text-sm font-bold bg-muted/40 border-l border-border">
                  {formatMoney(lucroLiquidoTotal)}
                </td>
                <td className="py-3 px-3 text-right font-bold bg-muted/20 border-l border-border">
                  {faturamentoTotalAno > 0 ? formatPercent((lucroLiquidoTotal / faturamentoTotalAno) * 100) : "0,0%"}
                </td>
              </tr>

              {/* 11. (-) COMISSÃO PARCEIRO */}
              <tr className="bg-card/70 font-semibold text-muted-foreground hover:bg-muted/40 transition-colors">
                <td className="py-2.5 px-4 font-sans min-w-[300px] max-w-[300px] sticky left-0 bg-card z-20 border-r border-border shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-chart-line shrink-0" />
                    <span className="text-foreground">(-) COMISSÃO PARCEIRO</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] py-0 px-1.5 tabular-nums",
                        partnerInfo.hasRules
                          ? "bg-chart-line/10 border-chart-line/40 text-chart-line font-semibold"
                          : "border-dashed text-muted-foreground"
                      )}
                    >
                      {partnerInfo.badgeLabel}
                    </Badge>
                  </div>
                </td>
                {visibleMonthKeys.map((m) => {
                  const val = comissaoParceiroMonthly[m] || 0;
                  return (
                    <td
                      key={m}
                      className={cn(
                        "py-2.5 px-3 text-right tabular-nums",
                        val > 0 ? "text-chart-line font-semibold" : "text-muted-foreground/50"
                      )}
                    >
                      {val > 0 ? formatMoney(val, true) : "—"}
                    </td>
                  );
                })}
                <td className="py-2.5 px-4 text-right font-bold tabular-nums text-chart-line bg-muted/30 border-l border-border">
                  {comissaoParceiroTotal > 0 ? formatMoney(comissaoParceiroTotal) : "—"}
                </td>
                <td className="py-2.5 px-3 text-right font-medium text-chart-line/80 bg-muted/10 border-l border-border">
                  {faturamentoTotalAno > 0 && comissaoParceiroTotal > 0
                    ? formatPercent((comissaoParceiroTotal / faturamentoTotalAno) * 100)
                    : "0,0%"}
                </td>
              </tr>

              {/* ═══════════════════════════════════════════════════════════════════ */}
              {/* 12. (=) DISTRIBUIÇÃO DO LUCRO                                      */}
              {/* ═══════════════════════════════════════════════════════════════════ */}
              <tr className={cn("font-bold text-sm border-t-2 border-border shadow-sm", distribuicaoLucroTotal >= 0 ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive")}>
                <td className="py-3.5 px-4 font-sans min-w-[300px] max-w-[300px] sticky left-0 bg-card z-20 border-r border-border shadow-md">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-3 h-3 rounded-full shrink-0", distribuicaoLucroTotal >= 0 ? "bg-primary" : "bg-destructive")} />
                    <span>(=) DISTRIBUIÇÃO DO LUCRO</span>
                  </div>
                </td>
                {visibleMonthKeys.map((m) => {
                  const dist = distribuicaoLucroMonthly[m];
                  return (
                    <td key={m} className={cn("py-3.5 px-3 text-right", dist >= 0 ? "text-primary" : "text-destructive")}>
                      {formatMoney(dist, true)}
                    </td>
                  );
                })}
                <td className="py-3.5 px-4 text-right text-base font-bold bg-muted/50 border-l border-border">
                  {formatMoney(distribuicaoLucroTotal)}
                </td>
                <td className="py-3.5 px-3 text-right font-bold bg-muted/30 border-l border-border">
                  {faturamentoTotalAno > 0 ? formatPercent((distribuicaoLucroTotal / faturamentoTotalAno) * 100) : "0,0%"}
                </td>
              </tr>

              {/* 13. SEÇÕES COMPLEMENTARES: INVESTIMENTOS & NÃO OPERACIONAIS */}
              {renderGroupSection(
                dreGroupsData.find((g) => g.id === "investimentos")!,
                expandedGroups.has("investimentos"),
                toggleGroup,
                faturamentoTotalAno,
                handleCellClick,
                visibleMonthKeys
              )}

              {renderGroupSection(
                dreGroupsData.find((g) => g.id === "nao_operacionais")!,
                expandedGroups.has("nao_operacionais"),
                toggleGroup,
                faturamentoTotalAno,
                handleCellClick,
                visibleMonthKeys
              )}
            </tbody>
          </table>
        </div>
      </Card>


      {/* ============================================================================== */}
      {/* 🔍 MODAL DE DETALHAMENTO DA CÉLULA DA DRE COM AUDITORIA DO ERP               */}
      {/* ============================================================================== */}
      <Dialog
        open={!!selectedCellDetail}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCellDetail(null);
            setExpandedRawRowId(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6 rounded-xl border border-border bg-card shadow-2xl">
          <DialogHeader className="pb-4 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Detalhamento de Lançamentos
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  Conta Padronizada: <strong className="text-foreground">{selectedCellDetail?.accountDesc}</strong> | Grupo: <strong className="text-foreground">{selectedCellDetail?.category}</strong> | Mês: <strong className="text-foreground">{selectedCellDetail?.monthLabel} ({selectedCellDetail?.year})</strong>
                </DialogDescription>
              </div>
              {selectedCellDetail && selectedCellDetail.records.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const exportRows = selectedCellDetail.records.map((r) => ({
                      ID: r.id,
                      Loja: r.loja,
                      Cidade: r.cidade,
                      "Mês Referência": r.mes_inicio,
                      "Conta Padronizada": r.conta_padronizada || selectedCellDetail.accountDesc,
                      "Grupo DRE": r.grupo_dre || selectedCellDetail.category,
                      Categoria: r.categoria || "",
                      "Descrição Original (ERP)": r.descricao_conta,
                      "Código Original (ERP)": r.codigo_conta,
                      Débito: Number(r.debito) || 0,
                      Crédito: Number(r.credito) || 0,
                      "Valor Líquido": Number(r.valor_liquido) || Number(r.credito) || Number(r.debito) || 0,
                      Documento: r.dados_extra?.documento || r.dados_extra?.docto || "",
                      Histórico: r.dados_extra?.historico || "",
                      Empresa: r.dados_extra?.empresa || "",
                      Data: formatDateDisplay(r.dados_extra?.data),
                    }));
                    exportToXLSX(
                      exportRows,
                      `Auditoria_${selectedCellDetail.accountDesc.replace(/[^a-zA-Z0-9]/g, "_")}_${selectedCellDetail.monthLabel}`
                    );
                  }}
                  className="h-8 text-xs gap-1.5 rounded-lg border-border"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-primary" /> Exportar XLSX
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Resumo no topo do Modal */}
          {selectedCellDetail && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-2">
              <div className="bg-muted/40 p-3 rounded-xl border border-border">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Total de Registros</span>
                <div className="text-lg font-bold tabular-nums text-foreground">{selectedCellDetail.records.length} lançamentos</div>
              </div>
              <div className="bg-muted/40 p-3 rounded-xl border border-border">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                  {selectedCellDetail.records.some((r) => Number(r.debito) > 0) ? "Valor Total Débito" : "Valor Total Receita"}
                </span>
                <div
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    selectedCellDetail.records.some((r) => Number(r.debito) > 0)
                      ? "text-destructive"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {formatMoney(
                    selectedCellDetail.records.reduce((acc, curr) => {
                      const deb = Number(curr.debito) || 0;
                      const cred = Number(curr.valor_liquido || curr.credito) || 0;
                      return acc + (deb > 0 ? deb : cred);
                    }, 0)
                  )}
                </div>
              </div>
              <div className="bg-muted/40 p-3 rounded-xl border border-border">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Estrutura DRE</span>
                <div className="text-sm font-bold text-foreground truncate">{selectedCellDetail.category}</div>
              </div>
            </div>
          )}

          {/* Tabela de Lançamentos com Auditoria de Origem */}
          <div className="mt-2 rounded-xl border border-border bg-background overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Loja / Cidade</th>
                  <th className="py-2.5 px-3">Descrição Original (ERP)</th>
                  <th className="py-2.5 px-3 text-right">
                    {selectedCellDetail?.records.some((r) => Number(r.debito) > 0) ? "Valor Débito" : "Valor Recebido"}
                  </th>
                  <th className="py-2.5 px-3 text-center">Metadados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {selectedCellDetail?.records.map((r) => {
                  const isRowExpanded = expandedRawRowId === r.id;
                  const extra = r.dados_extra || {};

                  const ignoredKeys = new Set([
                    "tipoformatado",
                    "data",
                    "tipo",
                    "conta",
                    "sequencia",
                    "codcentrocusto",
                    "desccentrocusto",
                    "categoriaplanocontas",
                  ]);

                  const filteredExtraEntries = Object.entries(extra).filter(
                    ([k]) => !ignoredKeys.has(k.toLowerCase())
                  );

                  const isDebito = Number(r.debito) > 0;
                  const itemValue = isDebito ? Number(r.debito) : Number(r.valor_liquido || r.credito || 0);

                  return (
                    <Fragment key={r.id}>
                      <tr className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-sans text-foreground">
                          {formatDateDisplay(extra.data || r.mes_inicio)}
                        </td>
                        <td className="py-2.5 px-3 font-sans font-semibold text-foreground">
                          {r.loja} <span className="text-muted-foreground font-normal">({r.cidade})</span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-muted-foreground" title={`Código ERP: ${r.codigo_conta || "—"}`}>
                          <span className="tabular-nums text-muted-foreground/60 mr-1.5">[{r.codigo_conta || "—"}]</span>
                          {r.descricao_conta}
                          {r.categoria && (
                            <Badge
                              variant="outline"
                              className="ml-1.5 text-[10px] py-0 px-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                            >
                              {r.categoria}
                            </Badge>
                          )}
                        </td>
                        <td
                          className={cn(
                            "py-2.5 px-3 text-right font-bold tabular-nums",
                            isDebito ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {formatMoney(itemValue)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedRawRowId(isRowExpanded ? null : r.id)}
                            className="h-6 px-2 text-[10px] rounded-md gap-1"
                          >
                            <Info className="h-3 w-3 text-primary" />
                            {isRowExpanded ? "Ocultar" : "Ver Detalhes"}
                          </Button>
                        </td>
                      </tr>

                      {/* Linha expandida com metadados e documento/histórico */}
                      {isRowExpanded && (
                        <tr className="bg-muted/40 border-b border-border">
                          <td colSpan={5} className="p-4 font-sans text-xs">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                                  <Layers className="h-3.5 w-3.5 text-primary" /> Metadados Gravados (dados_extra)
                                </span>
                                <Badge variant="outline" className="tabular-nums text-[10px]">ID: {r.id}</Badge>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-background p-3 rounded-lg border border-border">
                                {filteredExtraEntries.map(([k, v]) => (
                                  <div key={k} className="p-2 rounded bg-card border border-border/50 text-[11px]">
                                    <span className="text-[10px] text-muted-foreground tabular-nums uppercase block">{k}</span>
                                    <span className="font-semibold text-foreground break-all">
                                      {v === null || v === undefined ? "—" : String(v)}
                                    </span>
                                  </div>
                                ))}
                                {filteredExtraEntries.length === 0 && (
                                  <div className="col-span-full text-xs text-muted-foreground text-center py-2">
                                    Nenhum metadado adicional gravado.
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {(!selectedCellDetail || selectedCellDetail.records.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground font-sans">
                      Nenhum lançamento individual encontrado para este mês.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE AUXILIAR PARA RENDERIZAR CADA GRUPO GERENCIAL NA TABELA MATRICIAL
// ─────────────────────────────────────────────────────────────────────────────
function renderGroupSection(
  group: {
    id: string;
    label: string;
    textClass: string;
    badgeClass: string;
    monthly: Record<string, number>;
    total: number;
    accounts: Array<{
      name: string;
      sampleCode: string;
      natureza?: string;
      monthly: Record<string, number>;
      total: number;
    }>;
  },
  isExpanded: boolean,
  toggleGroup: (id: string) => void,
  faturamentoTotalAno: number,
  handleCellClick: (accName: string, sampleCode: string, groupName: string, monthKey: string) => void,
  monthKeys: string[]
) {
  if (!group) return null;

  const pctOfFat = faturamentoTotalAno > 0 ? (group.total / faturamentoTotalAno) * 100 : 0;

  return (
    <Fragment key={group.id}>
      {/* Linha do Grupo Gerencial (Nível 1) */}
      <tr
        onClick={() => toggleGroup(group.id)}
        className="hover:bg-muted/60 cursor-pointer transition-colors font-semibold bg-card/70"
      >
        <td className="py-2.5 px-4 font-sans min-w-[300px] max-w-[300px] sticky left-0 bg-card z-20 border-r border-border shadow-md text-foreground">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: groupColor(group.id) }} />
            <span className={cn("font-bold truncate", group.textClass)}>{group.label}</span>
            <Badge
              variant="outline"
              className={cn("text-[10px] py-0 px-1.5 rounded-md tabular-nums shrink-0 ml-1", group.badgeClass)}
            >
              {group.accounts.length} contas
            </Badge>
          </div>
        </td>
        {monthKeys.map((m) => (
          <td key={m} className={cn("py-2.5 px-3 text-right tabular-nums", group.textClass)}>
            {formatMoney(group.monthly[m], true)}
          </td>
        ))}
        <td className={cn("py-2.5 px-4 text-right font-bold tabular-nums bg-muted/30 border-l border-border", group.textClass)}>
          {formatMoney(group.total)}
        </td>
        <td className="py-2.5 px-3 text-right font-medium text-muted-foreground bg-muted/10 border-l border-border">
          {formatPercent(pctOfFat)}
        </td>
      </tr>

      {/* Linhas das Contas Padronizadas (Nível 2 - Detalhamento) */}
      {isExpanded &&
        group.accounts.map((acc) => {
          const accPct = faturamentoTotalAno > 0 ? (acc.total / faturamentoTotalAno) * 100 : 0;
          return (
            <tr key={acc.name} className="bg-muted/20 hover:bg-muted/40 text-[11px] text-muted-foreground">
              <td
                className="py-2 px-4 pl-9 font-sans truncate min-w-[300px] max-w-[300px] sticky left-0 bg-card z-20 border-r border-border shadow-md"
                title={`${acc.name} (ex: cód ${acc.sampleCode || "—"})`}
              >
                <div className="flex items-center">
                  {acc.natureza && (
                    <span
                      className={cn(
                        "text-[9px] px-1 py-0.5 rounded tabular-nums font-medium mr-1.5 border shrink-0",
                        acc.natureza.includes("Fixa")
                          ? "bg-muted/10 text-muted-foreground border-border/20"
                          : acc.natureza.includes("Vari")
                          ? "bg-chart-amber/10 text-chart-amber border-chart-amber/20"
                          : "bg-chart-line/10 text-chart-line border-chart-line/20"
                      )}
                    >
                      {acc.natureza.replace("Despesa ", "").replace("Custo ", "")}
                    </span>
                  )}
                  {acc.sampleCode && (
                    <span className="tabular-nums text-muted-foreground/60 mr-1.5 text-[10px]">[{acc.sampleCode}]</span>
                  )}
                  <span className="text-foreground/90 font-medium truncate">{acc.name}</span>
                </div>
              </td>
              {monthKeys.map((m) => {
                const val = acc.monthly[m];
                const hasVal = val && Math.abs(val) > 0.01;
                return (
                  <td
                    key={m}
                    onClick={() => {
                      if (hasVal) handleCellClick(acc.name, acc.sampleCode, group.label, m);
                    }}
                    className={cn(
                      "py-2 px-3 text-right tabular-nums transition-colors",
                      hasVal
                        ? "cursor-pointer hover:bg-primary/20 hover:text-primary underline decoration-dotted font-semibold"
                        : "text-muted-foreground/40"
                    )}
                    title={hasVal ? "Clique para auditar os lançamentos no ERP" : undefined}
                  >
                    {formatMoney(val, true)}
                  </td>
                );
              })}
              <td className="py-2 px-4 text-right tabular-nums font-medium text-foreground bg-muted/20 border-l border-border">
                {formatMoney(acc.total)}
              </td>
              <td className="py-2 px-3 text-right tabular-nums text-muted-foreground/70 bg-muted/10 border-l border-border text-[10px]">
                {formatPercent(accPct)}
              </td>
            </tr>
          );
        })}
    </Fragment>
  );
}

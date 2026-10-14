import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, Building2, ChevronRight, MapPin, Receipt, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { MonthYearFilter } from "@/components/dashboard/month-year-filter";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { RevenueIndicatorsChart } from "@/components/dashboard/revenue-indicators-chart";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import { CompositionCharts } from "@/components/dashboard/composition-charts";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { useDreData } from "@/hooks/use-dre-data";
import {
  computeDreSeries,
  extractMonthStr,
  extractYearStr,
  filterByScope,
  sumDreValues,
  type ScopeFilters,
} from "@/lib/dre";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  component: VisaoGeralPage,
});

/**
 * Visão Geral: réplica da tela de indicadores do Score Data Hub com os
 * dados da DRE Gerencial do Grupo R3 (cards com evolução mensal, faturamento
 * x indicadores, detalhes mensais e composição).
 */
function VisaoGeralPage() {
  const data = useDreData();

  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [months, setMonths] = useState<string[]>([]);
  const [servidores, setServidores] = useState<string[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);

  // Anos disponíveis (somente lojas/filiais ativas), mais recente primeiro
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    const add = (item: { mes_inicio: string | null; id_servidor?: unknown; id_cidade?: unknown }) => {
      if (item.id_servidor && !data.activeServidorIds.has(Number(item.id_servidor))) return;
      if (item.id_cidade && !data.activeSublojaIds.has(Number(item.id_cidade))) return;
      const y = extractYearStr(item.mes_inicio);
      if (y) set.add(y);
    };
    data.faturamento.forEach(add);
    data.dre.forEach(add);
    return Array.from(set).sort().reverse();
  }, [data.faturamento, data.dre, data.activeServidorIds, data.activeSublojaIds]);

  // Se o ano atual não tem dados, cai para o mais recente disponível
  useEffect(() => {
    if (availableYears.length > 0 && year !== "todos" && !availableYears.includes(year)) {
      setYear(availableYears[0]);
    }
  }, [availableYears, year]);

  // Limpa seleções de lojas/filiais inativadas
  useEffect(() => {
    setServidores((prev) => prev.filter((id) => data.activeServidorIds.has(Number(id))));
  }, [data.activeServidorIds]);
  useEffect(() => {
    setCidades((prev) => prev.filter((id) => data.activeSublojaIds.has(Number(id))));
  }, [data.activeSublojaIds]);

  const filteredSublojas = useMemo(() => {
    if (servidores.length === 0) return data.activeSublojas;
    const set = new Set(servidores.map(Number));
    return data.activeSublojas.filter((s) => set.has(Number(s.servidor_id)));
  }, [data.activeSublojas, servidores]);

  const handleServidoresChange = (values: string[]) => {
    setServidores(values);
    if (values.length === 0) return;
    const allowed = new Set(
      data.activeSublojas.filter((s) => values.includes(String(s.servidor_id))).map((s) => String(s.cidade_id)),
    );
    setCidades((prev) => prev.filter((c) => allowed.has(c)));
  };

  const servidorOptions = useMemo(
    () => data.activeServidores.map((s) => ({ value: String(s.servidor_id), label: s.nome || `Loja ${s.servidor_id}` })),
    [data.activeServidores],
  );
  const sublojaOptions = useMemo(
    () => filteredSublojas.map((s) => ({ value: String(s.cidade_id), label: s.nome || `Filial ${s.cidade_id}` })),
    [filteredSublojas],
  );

  const scope: ScopeFilters = useMemo(
    () => ({ year, months, servidores, cidades }),
    [year, months, servidores, cidades],
  );

  // Ano inteiro (ignora filtro de meses) → sparklines e meses disponíveis
  const fatYear = useMemo(
    () => filterByScope(data.faturamento, scope, data.activeServidorIds, data.activeSublojaIds, { ignoreMonths: true }),
    [data.faturamento, scope, data.activeServidorIds, data.activeSublojaIds],
  );
  const dreYear = useMemo(
    () => filterByScope(data.dre, scope, data.activeServidorIds, data.activeSublojaIds, { ignoreMonths: true }),
    [data.dre, scope, data.activeServidorIds, data.activeSublojaIds],
  );

  // Período filtrado (respeita meses) → valores dos cards e gráficos
  const fatPeriod = useMemo(
    () => filterByScope(data.faturamento, scope, data.activeServidorIds, data.activeSublojaIds),
    [data.faturamento, scope, data.activeServidorIds, data.activeSublojaIds],
  );
  const drePeriod = useMemo(
    () => filterByScope(data.dre, scope, data.activeServidorIds, data.activeSublojaIds),
    [data.dre, scope, data.activeServidorIds, data.activeSublojaIds],
  );

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    fatYear.forEach((r) => { const m = extractMonthStr(r.mes_inicio); if (m) set.add(m); });
    dreYear.forEach((r) => { const m = extractMonthStr(r.mes_inicio); if (m) set.add(m); });
    return set;
  }, [fatYear, dreYear]);

  const labelWithYear = year === "todos";
  const seriesYear = useMemo(
    () => computeDreSeries(fatYear, dreYear, data.regras, { labelWithYear }),
    [fatYear, dreYear, data.regras, labelWithYear],
  );
  const seriesPeriod = useMemo(
    () => computeDreSeries(fatPeriod, drePeriod, data.regras, { labelWithYear }),
    [fatPeriod, drePeriod, data.regras, labelWithYear],
  );
  const totals = useMemo(() => sumDreValues(seriesPeriod.map((p) => p.values)), [seriesPeriod]);

  const scopeLabel = useMemo(() => {
    const srvNames = servidores.map(
      (id) => data.activeServidores.find((s) => String(s.servidor_id) === id)?.nome || `Loja ${id}`,
    );
    const cidNames = cidades.map(
      (id) => data.activeSublojas.find((s) => String(s.cidade_id) === id)?.nome || `Filial ${id}`,
    );
    if (srvNames.length === 0 && cidNames.length === 0) return "Todas as lojas ativas";
    return [srvNames.join(", "), cidNames.join(", ")].filter(Boolean).join(" — ");
  }, [servidores, cidades, data.activeServidores, data.activeSublojas]);

  const hasData = seriesPeriod.length > 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Filtros */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1">
          <MonthYearFilter
            years={availableYears}
            year={year}
            onYearChange={setYear}
            months={months}
            onMonthsChange={setMonths}
            availableMonths={availableMonths}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelectFilter
            options={servidorOptions}
            selected={servidores}
            onChange={handleServidoresChange}
            placeholder="Lojas"
            searchPlaceholder="Buscar loja..."
            emptyText="Nenhuma loja encontrada."
            icon={<Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            className="w-[170px]"
          />
          <MultiSelectFilter
            options={sublojaOptions}
            selected={cidades}
            onChange={setCidades}
            placeholder="Filiais"
            searchPlaceholder="Buscar filial..."
            emptyText="Nenhuma filial encontrada."
            icon={<MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            className="w-[160px]"
            disabled={sublojaOptions.length === 0}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={data.refetchAll}
            disabled={data.isFetching}
            className="h-8 px-2.5 text-xs"
            title="Atualizar dados"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", data.isFetching && "animate-spin")} />
          </Button>
          <Link
            to="/dre"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold text-primary transition-colors hover:bg-accent"
          >
            <Receipt className="h-3.5 w-3.5" />
            DRE completa
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {data.error && (
        <div className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">Erro ao carregar os dados financeiros.</p>
        </div>
      )}

      {data.isLoading ? (
        <DashboardSkeleton />
      ) : hasData ? (
        <div className="space-y-6">
          <KPICards totals={totals} series={seriesYear} />
          <RevenueIndicatorsChart series={seriesPeriod} scopeLabel={scopeLabel} />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[3fr_2fr]">
            <MonthlyChart series={seriesPeriod} />
            <CompositionCharts fat={fatPeriod} dre={drePeriod} />
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">Nenhum dado encontrado para o período selecionado.</div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import {
  GROUP_DEFS,
  formatBRL,
  groupTotals,
  resultsByStore,
  topAccounts,
  type DreRow,
  type FaturamentoRow,
} from "@/lib/dre";
import { cn } from "@/lib/utils";

interface CompositionChartsProps {
  fat: FaturamentoRow[];
  dre: DreRow[];
}

const TABS = [
  { id: "grupos", label: "Grupos" },
  { id: "contas", label: "Contas" },
  { id: "lojas", label: "Lojas" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function DonutTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as { name: string; value: number };
  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="space-y-0.5 rounded-lg border border-border bg-card p-2.5 text-xs shadow-xl">
      <p className="font-bold text-foreground">{item.name}</p>
      <p className="tabular-nums text-muted-foreground">{formatBRL(item.value)}</p>
      <p className="font-semibold text-primary">{pct}%</p>
    </div>
  );
}

/** Barra horizontal com valor sempre visível (dentro ou ao lado). */
function PerformanceBar({
  name,
  value,
  maxValue,
  color = "var(--primary)",
}: {
  name: string;
  value: number;
  maxValue: number;
  color?: string;
}) {
  const pct = maxValue > 0 ? Math.max((value / maxValue) * 100, 4) : 4;
  const showInside = pct > 45;

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span
        className="w-[120px] flex-shrink-0 truncate text-right text-[10px] leading-tight text-muted-foreground"
        title={name}
      >
        {name}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <div className="relative h-6 flex-1 overflow-hidden rounded bg-muted/30">
          <div
            className="flex h-full items-center rounded transition-all duration-500"
            style={{ width: `${pct}%`, background: color }}
          >
            {showInside && (
              <span className="overflow-hidden whitespace-nowrap px-1.5 text-[9px] font-bold tabular-nums text-white">
                {formatBRL(value)}
              </span>
            )}
          </div>
        </div>
        {!showInside && (
          <span className="flex-shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-foreground">
            {formatBRL(value)}
          </span>
        )}
      </div>
    </div>
  );
}

function DonutLegend({ items, total }: { items: { name: string; value: number; color: string }[]; total: number }) {
  return (
    <div className="mt-2 space-y-1">
      {items.map((item) => {
        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";
        return (
          <div key={item.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: item.color }} />
            <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground" title={item.name}>
              {item.name}
            </span>
            <span className="flex-shrink-0 text-[10px] font-semibold tabular-nums text-foreground">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function TabGrupos({ dre }: { dre: DreRow[] }) {
  const grupos = useMemo(() => groupTotals(dre).filter((g) => g.value > 0), [dre]);
  const total = grupos.reduce((s, g) => s + g.value, 0);
  const max = grupos.reduce((m, g) => Math.max(m, g.value), 0);

  if (grupos.length === 0) {
    return <p className="py-8 text-center text-xs text-muted-foreground">Sem lançamentos no período.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-foreground">Composição de Despesas</h4>
        <div className="flex items-start gap-4">
          <div className="h-[140px] w-[140px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={grupos}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={62}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {grupos.map((g) => (
                    <Cell key={g.id} fill={g.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-w-0 flex-1">
            <DonutLegend items={grupos} total={total} />
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-foreground">Performance por Grupo</h4>
        <div className="space-y-0.5">
          {[...grupos]
            .sort((a, b) => b.value - a.value)
            .map((g) => (
              <PerformanceBar key={g.id} name={g.name} value={g.value} maxValue={max} color={g.color} />
            ))}
        </div>
      </div>
    </div>
  );
}

function TabContas({ dre }: { dre: DreRow[] }) {
  const contas = useMemo(() => topAccounts(dre, 10), [dre]);
  const max = contas[0]?.value ?? 1;

  if (contas.length === 0) {
    return <p className="py-8 text-center text-xs text-muted-foreground">Sem lançamentos no período.</p>;
  }

  return (
    <div>
      <h4 className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-foreground">Maiores Contas Padronizadas</h4>
      <div className="space-y-0.5">
        {contas.map((c) => (
          <PerformanceBar
            key={c.name}
            name={c.name}
            value={c.value}
            maxValue={max}
            color={GROUP_DEFS.find((g) => g.id === c.groupId)?.color ?? "var(--chart-red)"}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-3 text-[9px] text-muted-foreground">
        {GROUP_DEFS.map((g) => (
          <span key={g.id} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: g.color }} /> {g.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function TabLojas({ fat, dre }: { fat: FaturamentoRow[]; dre: DreRow[] }) {
  const lojas = useMemo(() => resultsByStore(fat, dre, 8), [fat, dre]);
  const max = lojas.reduce((m, l) => Math.max(m, l.faturamento, l.despesas), 1);

  if (lojas.length === 0) {
    return <p className="py-8 text-center text-xs text-muted-foreground">Sem lojas no período.</p>;
  }

  return (
    <div>
      <h4 className="mb-3 text-[9px] font-bold uppercase tracking-[0.1em] text-foreground">Faturamento x Despesas por Loja</h4>
      <div className="space-y-2">
        {lojas.map((loja) => (
          <div key={loja.nome} className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="truncate text-[10px] font-medium text-muted-foreground" title={loja.nome}>
                {loja.nome}
              </span>
              <span
                className={cn(
                  "text-[9px] font-semibold tabular-nums",
                  loja.resultado >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {formatBRL(loja.resultado)}
              </span>
            </div>
            <div className="flex gap-1">
              <div className="flex flex-1 items-center gap-1.5">
                <div className="h-5 flex-1 overflow-hidden rounded bg-muted/30">
                  <div
                    className="h-full rounded"
                    style={{ width: `${Math.max((loja.faturamento / max) * 100, 4)}%`, background: "var(--primary)" }}
                  />
                </div>
                <span className="w-[80px] flex-shrink-0 text-[9px] tabular-nums text-foreground">{formatBRL(loja.faturamento)}</span>
              </div>
              <div className="flex flex-1 items-center gap-1.5">
                <div className="h-5 flex-1 overflow-hidden rounded bg-muted/30">
                  <div
                    className="h-full rounded"
                    style={{ width: `${Math.max((loja.despesas / max) * 100, 4)}%`, background: "var(--chart-red)" }}
                  />
                </div>
                <span className="w-[80px] flex-shrink-0 text-[9px] tabular-nums text-foreground">{formatBRL(loja.despesas)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 pt-3 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--primary)" }} /> Faturamento
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--chart-red)" }} /> Despesas
        </span>
        <span className="ml-auto">Valor à direita = resultado</span>
      </div>
    </div>
  );
}

/** Card lateral com abas Grupos / Contas / Lojas (equivalente ao "Categoria / Natureza / Contas" do Data Hub). */
export function CompositionCharts({ fat, dre }: CompositionChartsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("grupos");

  return (
    <Card className="h-fit p-5">
      <div className="mb-4 flex items-center gap-1.5">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all duration-200",
              activeTab === id
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-transparent text-muted-foreground hover:bg-accent",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "grupos" && <TabGrupos dre={dre} />}
      {activeTab === "contas" && <TabContas dre={dre} />}
      {activeTab === "lojas" && <TabLojas fat={fat} dre={dre} />}
    </Card>
  );
}

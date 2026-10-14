import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { formatBRL, formatCompactBRL, type DreSeriesPoint } from "@/lib/dre";
import { cn } from "@/lib/utils";

interface MonthlyChartProps {
  series: DreSeriesPoint[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload as { faturamento: number; lucro: number } | undefined;
  if (!entry) return null;
  return (
    <div className="space-y-1.5 rounded-xl border border-border bg-card p-3.5 text-xs shadow-xl">
      <p className="text-sm font-bold text-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted" />
        <span className="text-muted-foreground">Faturamento:</span>
        <span className="font-semibold tabular-nums text-foreground">{formatBRL(entry.faturamento)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--primary)" }} />
        <span className="text-muted-foreground">Lucro Líquido:</span>
        <span
          className="font-semibold tabular-nums"
          style={{ color: entry.lucro >= 0 ? "var(--success)" : "var(--destructive)" }}
        >
          {formatBRL(entry.lucro)}
        </span>
      </div>
    </div>
  );
}

/** "Detalhes Mensais": faturamento (cinza) x lucro líquido (primário) com médias. */
export function MonthlyChart({ series }: MonthlyChartProps) {
  const chartData = useMemo(
    () => series.map((p) => ({ month: p.label, faturamento: p.values.faturamento, lucro: p.values.lucro })),
    [series],
  );

  const { avgFat, avgLucro } = useMemo(() => {
    if (!chartData.length) return { avgFat: 0, avgLucro: 0 };
    const sumF = chartData.reduce((s, d) => s + d.faturamento, 0);
    const sumL = chartData.reduce((s, d) => s + d.lucro, 0);
    return { avgFat: sumF / chartData.length, avgLucro: sumL / chartData.length };
  }, [chartData]);

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground">Detalhes Mensais</h3>
          <div className="flex items-baseline gap-6">
            <div>
              <p className="text-xl font-extrabold tabular-nums text-foreground">{formatBRL(avgFat)}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Média Faturamento</p>
            </div>
            <div>
              <p className={cn("text-xl font-extrabold tabular-nums", avgLucro >= 0 ? "text-success" : "text-destructive")}>
                {formatBRL(avgLucro)}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Média Lucro</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-muted" /> Faturamento
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "var(--primary)" }} /> Lucro
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatCompactBRL(v)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <ReferenceLine
            y={avgFat}
            stroke="var(--muted-foreground)"
            strokeDasharray="6 4"
            strokeWidth={1}
            label={{ value: `Mé: ${formatCompactBRL(avgFat)}`, position: "insideLeft", fontSize: 10, fill: "var(--muted-foreground)" }}
          />
          <Bar dataKey="faturamento" name="Faturamento" fill="var(--muted)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="lucro" name="Lucro" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.lucro >= 0 ? "var(--primary)" : "var(--destructive)"} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

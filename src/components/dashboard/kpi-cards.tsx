import { Card } from "@/components/ui/card";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatBRL, formatPercent, type DreSeriesPoint, type DreValues } from "@/lib/dre";
import { cn } from "@/lib/utils";

interface KPICardsProps {
  /** Totais do período filtrado. */
  totals: DreValues;
  /** Série mensal (ano inteiro) para as barrinhas de evolução. */
  series: DreSeriesPoint[];
}

interface KPIDef {
  id: string;
  label: string;
  highlight?: boolean;
  /** Indicador calculado (subtotal) — sem comparação de sinal com faturamento. */
  calculated?: boolean;
  getValue: (v: DreValues) => number;
}

/**
 * Mesmos indicadores da Visão Geral do Data Hub, adaptados à DRE do Grupo R3:
 * Faturamento → CMV + Avarias → Margem → Despesas → Lucro → Comissão →
 * Distribuição → Investimentos.
 */
export const KPI_DEFS: KPIDef[] = [
  { id: "faturamento", label: "FATURAMENTO", highlight: true, getValue: (v) => v.faturamento },
  { id: "deducoes", label: "CMV + AVARIAS", getValue: (v) => v.cmv + v.avarias },
  { id: "margem", label: "MARGEM CONTRIBUIÇÃO", calculated: true, getValue: (v) => v.margem },
  { id: "despesas", label: "DESPESAS OPERACIONAIS", getValue: (v) => v.despesas },
  { id: "lucro", label: "LUCRO LÍQUIDO", calculated: true, getValue: (v) => v.lucro },
  { id: "comissao", label: "COMISSÃO PARCEIRO", getValue: (v) => v.comissao },
  { id: "distribuicao", label: "DISTRIBUIÇÃO DO LUCRO", calculated: true, getValue: (v) => v.distribuicao },
  { id: "investimentos", label: "INVESTIMENTOS", getValue: (v) => v.investimentos },
];

function SparkTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as { label: string; value: number };
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] shadow-xl">
      <span className="font-semibold text-foreground">{item.label}</span>{" "}
      <span className="tabular-nums text-muted-foreground">{formatBRL(item.value)}</span>
    </div>
  );
}

export function KPICards({ totals, series }: KPICardsProps) {
  const faturamento = totals.faturamento;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {KPI_DEFS.map((def) => {
        const value = def.getValue(totals);
        const sparkData = series.map((p) => ({ label: p.label, value: def.getValue(p.values) }));
        const pctFaturamento = faturamento !== 0 ? (value / faturamento) * 100 : 0;
        const isNegative = value < 0;
        const isHighlight = !!def.highlight;
        const barColor = isHighlight ? "var(--primary-foreground)" : "var(--primary)";

        return (
          <Card
            key={def.id}
            className={cn(
              "relative overflow-hidden rounded-xl border-0 transition-shadow hover:shadow-md",
              isHighlight ? "bg-primary text-primary-foreground shadow-lg" : "bg-card",
            )}
          >
            <div className="p-4 pb-2">
              <p
                className={cn(
                  "mb-1.5 text-[10px] font-bold tracking-[0.1em]",
                  isHighlight ? "text-primary-foreground/70" : "text-primary",
                )}
              >
                {def.label}
              </p>
              <div className="flex items-baseline gap-2">
                <p
                  className={cn(
                    "text-xl font-extrabold tabular-nums tracking-tight",
                    isHighlight ? "text-primary-foreground" : isNegative ? "text-destructive" : "text-foreground",
                  )}
                >
                  {formatBRL(value)}
                </p>
                {!isHighlight && (
                  <span
                    className={cn("text-[10px] font-semibold", isNegative ? "text-destructive" : "text-success")}
                  >
                    {isNegative ? "↓" : "↑"} {formatPercent(Math.abs(pctFaturamento))}
                  </span>
                )}
              </div>
              {!isHighlight && <p className="mt-0.5 text-[10px] text-muted-foreground">% do Faturamento</p>}
              {isHighlight && (
                <p className="mt-0.5 text-[10px] text-primary-foreground/70">
                  {series.length} {series.length === 1 ? "mês" : "meses"} no período
                </p>
              )}
            </div>
            {sparkData.length > 1 && (
              <div className="h-10 px-2 pb-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sparkData} barCategoryGap="20%" margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <Tooltip content={<SparkTooltip />} cursor={{ fill: "transparent" }} />
                    <Bar dataKey="value" radius={[2, 2, 0, 0]} opacity={isHighlight ? 0.45 : 0.3}>
                      {sparkData.map((d, i) => (
                        <Cell key={i} fill={d.value < 0 && !isHighlight ? "var(--destructive)" : barColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

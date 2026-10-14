import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GROUP_DEFS, formatBRL, formatCompactBRL, type DreSeriesPoint, type DreValues } from "@/lib/dre";
import { cn } from "@/lib/utils";

interface IndicatorOption {
  key: keyof DreValues;
  label: string;
  color: string;
}

const groupColor = (id: string) => GROUP_DEFS.find((g) => g.id === id)?.color ?? "var(--muted-foreground)";

const OPTIONS: IndicatorOption[] = [
  { key: "despesas", label: "Despesas Operacionais (total)", color: "var(--chart-red)" },
  { key: "avarias", label: "Avarias", color: groupColor("avarias") },
  { key: "adm", label: "Despesas Administrativas", color: groupColor("desp_adm") },
  { key: "log", label: "Despesa Logística", color: groupColor("desp_log") },
  { key: "cartao", label: "Taxas de Cartão", color: groupColor("taxas_cartao") },
  { key: "tributos", label: "Tributos", color: groupColor("tributos") },
  { key: "comissao", label: "Comissão Parceiro", color: "var(--chart-line)" },
  { key: "investimentos", label: "Investimentos", color: groupColor("investimentos") },
  { key: "naoOper", label: "Outras / Não Operacionais", color: groupColor("nao_operacionais") },
];

interface RevenueIndicatorsChartProps {
  series: DreSeriesPoint[];
  scopeLabel?: string;
}

/**
 * "Faturamento x Indicadores": linha de faturamento comparada com os grupos
 * de despesa selecionados (colunas empilhadas) e o Ponto de Equilíbrio
 * (despesas fixas ÷ margem de contribuição %).
 */
export function RevenueIndicatorsChart({ series, scopeLabel }: RevenueIndicatorsChartProps) {
  const [selected, setSelected] = useState<(keyof DreValues)[]>(["despesas"]);
  const [showPE, setShowPE] = useState(true);

  const rows = useMemo(
    () =>
      series.map((p) => {
        const v = p.values;
        const mcPct = v.faturamento > 0 ? (v.faturamento - v.variaveis) / v.faturamento : null;
        const pe = mcPct && mcPct > 0 ? v.fixas / mcPct : null;
        return { month: p.label, pe, ...v };
      }),
    [series],
  );

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedOptions = useMemo(() => OPTIONS.filter((o) => selectedSet.has(o.key)), [selectedSet]);

  function toggle(key: keyof DreValues) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload as (typeof rows)[number] | undefined;
    if (!row) return null;
    const abovePE = row.pe != null ? row.faturamento >= row.pe : null;

    return (
      <div className="min-w-[240px] space-y-2 rounded-xl border border-border bg-card p-3.5 text-xs shadow-xl">
        <p className="font-bold text-foreground">{label}</p>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--primary)" }} />
            <span className="text-muted-foreground">Faturamento</span>
          </div>
          <span className="font-semibold tabular-nums text-foreground">{formatBRL(row.faturamento)}</span>
        </div>

        {showPE && row.pe != null && (
          <div className="space-y-1.5 border-t border-border pt-2">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-2.5 border-t-2 border-dashed" style={{ borderColor: "var(--chart-amber)" }} />
                <span className="text-muted-foreground">Ponto de Equilíbrio</span>
              </div>
              <span className="font-semibold tabular-nums text-foreground">{formatBRL(row.pe)}</span>
            </div>
            <div
              className={cn(
                "w-fit rounded px-1.5 py-0.5 text-[10px] font-medium",
                abovePE ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {abovePE ? "▲ Acima do equilíbrio" : "▼ Abaixo do equilíbrio"}
            </div>
          </div>
        )}

        {selectedOptions.length > 0 && (
          <div className="space-y-1.5 border-t border-border pt-2">
            {selectedOptions.map((o) => (
              <div key={o.key} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: o.color }} />
                  <span className="text-muted-foreground">{o.label}</span>
                </div>
                <span className="font-semibold tabular-nums text-foreground">{formatBRL(row[o.key] as number)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 p-4 pb-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Faturamento x Indicadores</h3>
          <p className="text-xs text-muted-foreground">
            Faturamento (linha) comparado com os grupos de despesa selecionados (colunas)
            {scopeLabel ? ` · ${scopeLabel}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPE((v) => !v)}
            className={cn(
              "rounded border px-2 py-1 text-[10px] transition-colors",
              showPE
                ? "border-transparent bg-chart-amber text-white"
                : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
            title="Mostrar/ocultar Ponto de Equilíbrio"
          >
            PE
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                Indicadores ({selected.length})
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[300px]">
              <DropdownMenuLabel>Selecionar indicadores</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSelected([]); }}>
                Limpar seleção
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setSelected(["avarias", "adm", "log", "cartao", "tributos"]);
                }}
              >
                Selecionar principais
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {OPTIONS.map((opt) => (
                <DropdownMenuCheckboxItem
                  key={opt.key}
                  checked={selectedSet.has(opt.key)}
                  onCheckedChange={() => toggle(opt.key)}
                >
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: opt.color }} />
                  {opt.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-2 pb-4">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={rows} margin={{ top: 10, right: 14, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatCompactBRL(v)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />

            {selectedOptions.map((opt, idx) => (
              <Bar
                key={opt.key}
                dataKey={opt.key}
                stackId="sel"
                fill={opt.color}
                maxBarSize={34}
                radius={idx === selectedOptions.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}

            <Line type="monotone" dataKey="faturamento" stroke="var(--primary)" strokeWidth={2.5} dot={false} />

            {showPE && (
              <Line
                type="monotone"
                dataKey="pe"
                stroke="var(--chart-amber)"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                connectNulls
                name="Ponto de Equilíbrio"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

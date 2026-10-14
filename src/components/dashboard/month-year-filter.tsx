import { cn } from "@/lib/utils";
import { MONTH_KEYS, MONTH_SHORT } from "@/lib/dre";

interface MonthYearFilterProps {
  years: string[];
  year: string;
  onYearChange: (year: string) => void;
  /** Meses "MM" selecionados; lista vazia = todos. */
  months: string[];
  onMonthsChange: (months: string[]) => void;
  /** Meses "MM" que possuem dados no ano visível. */
  availableMonths: Set<string>;
}

/**
 * Seletor de ano + meses em abas (estilo Score Data Hub).
 * Clicar num mês com "todos" ativo seleciona só aquele mês; depois cada clique
 * inclui/remove o mês. Remover o último volta para "todos".
 */
export function MonthYearFilter({
  years,
  year,
  onYearChange,
  months,
  onMonthsChange,
  availableMonths,
}: MonthYearFilterProps) {
  const allSelected = months.length === 0;

  function toggleMonth(key: string) {
    if (allSelected) {
      onMonthsChange([key]);
      return;
    }
    const next = months.includes(key) ? months.filter((m) => m !== key) : [...months, key];
    if (next.length === 0 || next.length === MONTH_KEYS.length) {
      onMonthsChange([]);
      return;
    }
    onMonthsChange([...next].sort());
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {years.length > 0 && (
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-border">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => onYearChange(y)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold transition-colors",
                year === y
                  ? "bg-foreground text-background"
                  : "bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              {y}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onYearChange("todos")}
            className={cn(
              "px-3 py-1.5 text-xs font-bold transition-colors",
              year === "todos"
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            Todos
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 overflow-x-auto rounded-lg border border-border">
        <button
          type="button"
          onClick={() => onMonthsChange([])}
          className={cn(
            "whitespace-nowrap border-r border-border px-3 py-1.5 text-xs font-bold transition-colors",
            allSelected
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          Ano
        </button>
        {MONTH_KEYS.map((key, idx) => {
          const hasData = availableMonths.has(key);
          const selected = allSelected ? hasData : months.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => hasData && toggleMonth(key)}
              disabled={!hasData}
              title={!hasData ? "Sem dados" : selected ? "Clique para remover" : "Clique para incluir"}
              className={cn(
                "flex-1 whitespace-nowrap border-r border-border px-3 py-1.5 text-xs font-medium transition-colors last:border-r-0",
                !hasData && "cursor-default bg-card text-muted-foreground/40",
                hasData && selected && !allSelected && "bg-primary text-primary-foreground",
                hasData && selected && allSelected && "bg-accent text-accent-foreground",
                hasData && !selected && "cursor-pointer bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {MONTH_SHORT[idx]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

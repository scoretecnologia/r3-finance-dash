import { useState, useMemo, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { format, parse, setYear, setMonth, addYears, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Play,
  Loader2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Store,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Database,
  FileText,
  TrendingUp,
  Receipt,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { triggerKestraSync, type TipoExtracao } from "@/lib/api/kestra.functions";

export interface ServidorOption {
  servidor_id: number;
  nome: string;
  ativo: boolean;
}

export interface SublojaOption {
  cidade_id: number;
  servidor_id: number;
  nome: string;
  ativo: boolean;
}

interface TriggerSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servidores: ServidorOption[];
  sublojas: SublojaOption[];
  initialServidorId?: number | null;
  initialCidadeId?: number | null;
  initialCargaTipo?: "atual" | "mes" | "full";
  initialTipoExtracao?: TipoExtracao;
}

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function TriggerSyncDialog({
  open,
  onOpenChange,
  servidores,
  sublojas,
  initialServidorId,
  initialCidadeId,
  initialCargaTipo,
  initialTipoExtracao,
}: TriggerSyncDialogProps) {
  const [selectedServidor, setSelectedServidor] = useState<string>("TODOS");
  const [selectedCidade, setSelectedCidade] = useState<string>("TODAS");
  const [cargaTipo, setCargaTipo] = useState<"atual" | "mes" | "full">("atual");
  const [tipoExtracao, setTipoExtracao] = useState<TipoExtracao>("TODOS");
  const [mesReferencia, setMesReferencia] = useState<string>(() => getCurrentMonth());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sincroniza props iniciais quando o modal abre
  useEffect(() => {
    if (open) {
      setError(null);
      setSuccess(false);
      setCargaTipo(initialCargaTipo || "atual");
      setTipoExtracao(initialTipoExtracao || "TODOS");
      if (initialServidorId) {
        setSelectedServidor(String(initialServidorId));
        if (initialCidadeId) {
          setSelectedCidade(String(initialCidadeId));
        } else {
          setSelectedCidade("TODAS");
        }
      } else {
        setSelectedServidor("TODOS");
        setSelectedCidade("TODAS");
      }
    }
  }, [open, initialServidorId, initialCidadeId, initialCargaTipo, initialTipoExtracao]);

  // Sublojas filtradas pela Matriz selecionada
  const sublojasDisponiveis = useMemo(() => {
    if (selectedServidor === "TODOS") return [];
    const srvId = Number(selectedServidor);
    return sublojas.filter((s) => s.servidor_id === srvId);
  }, [selectedServidor, sublojas]);

  const handleServidorChange = (val: string) => {
    setSelectedServidor(val);
    setSelectedCidade("TODAS");
  };

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const isFull = cargaTipo === "full";
      // "Mês Atual" precisa ir explícito: se mes_referencia for vazio, o ETL usa a
      // configuração de cada loja no banco (carga_completa / mes_referencia), o que
      // fazia a opção "Mês Atual" rodar a carga full.
      const mes =
        cargaTipo === "mes" ? mesReferencia : cargaTipo === "atual" ? getCurrentMonth() : "";

      const res = await triggerKestraSync({
        data: {
          servidor_id: selectedServidor === "TODOS" ? "TODOS" : selectedServidor,
          cidade_id: selectedCidade === "TODAS" ? "" : selectedCidade,
          mes_referencia: mes,
          carga_completa: isFull,
          tipo_extracao: tipoExtracao,
        },
      });

      if (!res.success) {
        throw new Error(res.message || "Erro desconhecido ao acionar webhook.");
      }

      setSuccess(true);
      toast.success("Fluxo de sincronização disparado no Kestra!");

      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
      }, 2500);
    } catch (err: any) {
      console.error("Falha no disparo do Kestra:", err);
      const msg = err.message || "Erro de rede ao conectar com o Kestra.";
      setError(msg);
      toast.error("Erro ao disparar fluxo", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-xl border-border/40 shadow-2xl p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Play className="h-4 w-4 fill-current" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Executar Sincronização Manual
              </DialogTitle>
              <DialogDescription className="text-xs">
                Dispare a ingestão de DRE e Faturamento diretamente no Kestra.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 1. Seleção de Escopo */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5 text-primary" /> Loja Matriz
            </Label>
            <Select value={selectedServidor} onValueChange={handleServidorChange}>
              <SelectTrigger className="h-10 rounded-xl bg-card border-border/50 text-xs">
                <SelectValue placeholder="Selecione a loja..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="TODOS" className="font-semibold text-primary">
                  🌐 Todas as Lojas Ativas
                </SelectItem>
                {servidores.map((s) => (
                  <SelectItem key={s.servidor_id} value={String(s.servidor_id)}>
                    #{s.servidor_id} — {s.nome} {!s.ativo && "(Inativa)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subloja (apenas se selecionou uma matriz específica) */}
          {selectedServidor !== "TODOS" && sublojasDisponiveis.length > 0 && (
            <div className="space-y-2 animate-fade-in">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" /> Filial / Subloja (Opcional)
              </Label>
              <Select value={selectedCidade} onValueChange={setSelectedCidade}>
                <SelectTrigger className="h-10 rounded-xl bg-card border-border/50 text-xs">
                  <SelectValue placeholder="Matriz + Todas as Sublojas" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="TODAS">Todas as Filiais da Matriz</SelectItem>
                  {sublojasDisponiveis.map((sub) => (
                    <SelectItem key={sub.cidade_id} value={String(sub.cidade_id)}>
                      #{sub.cidade_id} — {sub.nome} {!sub.ativo && "(Inativa)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 2. Tipo de Extração / Carga */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-primary" /> Tipo de Extração
              </Label>
              <span className="text-[10px] text-muted-foreground font-medium">
                {tipoExtracao === "TODOS"
                  ? "Tudo (Completo)"
                  : tipoExtracao === "DRE_DESPESAS"
                    ? "Somente DRE Despesas"
                    : tipoExtracao === "FATURAMENTO"
                      ? "Somente Faturamento"
                      : "Somente Receitas"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoExtracao("TODOS")}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 transition-all text-left",
                  tipoExtracao === "TODOS"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <div
                  className={cn(
                    "p-1.5 rounded-lg shrink-0 transition-colors",
                    tipoExtracao === "TODOS"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Database className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-xs leading-none">Tudo (Completo)</div>
                  <div className="text-[10px] opacity-70 mt-1 truncate">DRE + Fat + Receitas</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTipoExtracao("DRE_DESPESAS")}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 transition-all text-left",
                  tipoExtracao === "DRE_DESPESAS"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <div
                  className={cn(
                    "p-1.5 rounded-lg shrink-0 transition-colors",
                    tipoExtracao === "DRE_DESPESAS"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-xs leading-none">Apenas DRE Despesas</div>
                  <div className="text-[10px] opacity-70 mt-1 truncate">Despesas e Deduções</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTipoExtracao("FATURAMENTO")}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 transition-all text-left",
                  tipoExtracao === "FATURAMENTO"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <div
                  className={cn(
                    "p-1.5 rounded-lg shrink-0 transition-colors",
                    tipoExtracao === "FATURAMENTO"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-xs leading-none">Apenas Faturamento</div>
                  <div className="text-[10px] opacity-70 mt-1 truncate">Vendas das Lojas</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTipoExtracao("RECEITAS")}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 transition-all text-left",
                  tipoExtracao === "RECEITAS"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <div
                  className={cn(
                    "p-1.5 rounded-lg shrink-0 transition-colors",
                    tipoExtracao === "RECEITAS"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Receipt className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-xs leading-none">Apenas Receitas</div>
                  <div className="text-[10px] opacity-70 mt-1 truncate">Contas a Receber</div>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Período da Carga */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-chart-amber" /> Período da Carga
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCargaTipo("atual")}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1 transition-all text-center",
                  cargaTipo === "atual"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span>Mês Atual</span>
                <span className="text-[10px] opacity-70">Mais Rápido</span>
              </button>

              <button
                type="button"
                onClick={() => setCargaTipo("mes")}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1 transition-all text-center",
                  cargaTipo === "mes"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span>Mês Específico</span>
                <span className="text-[10px] opacity-70">Retroativo</span>
              </button>

              <button
                type="button"
                onClick={() => setCargaTipo("full")}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1 transition-all text-center",
                  cargaTipo === "full"
                    ? "border-chart-amber bg-chart-amber/10 text-chart-amber shadow-sm"
                    : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span>Carga Full</span>
                <span className="text-[10px] opacity-70">Desde 2026</span>
              </button>
            </div>
          </div>

          {/* Seletor de mês quando 'mes' estiver ativo */}
          {cargaTipo === "mes" && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40 animate-fade-in">
              <span className="text-xs text-muted-foreground">Selecione o mês desejado:</span>
              <MonthPickerSelector
                value={mesReferencia}
                onChange={setMesReferencia}
              />
            </div>
          )}

          {/* Alerta de Carga Completa */}
          {cargaTipo === "full" && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-chart-amber/10 border border-chart-amber/20 text-xs text-chart-amber animate-fade-in">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                A <strong>Carga Completa</strong> processará todo o histórico mês a mês a partir de janeiro de 2026. Esse processo pode levar alguns minutos no Kestra.
              </span>
            </div>
          )}

          {/* Feedback de Erro */}
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium animate-fade-in">
              {error}
            </div>
          )}

          {/* Feedback de Sucesso */}
          {success && (
            <div className="space-y-2 p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-medium animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Fluxo disparado com sucesso! O Kestra já iniciou a extração.</span>
              </div>
              <div className="pt-1">
                <Link
                  to="/logs"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex items-center gap-1.5 font-bold text-primary underline underline-offset-4 hover:opacity-80"
                >
                  <Terminal className="h-3.5 w-3.5" />
                  Acompanhar Console na aba de Logs &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-xl h-10 text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleExecute}
            disabled={loading || success}
            className="rounded-xl h-10 text-xs font-semibold bg-primary hover:bg-primary/90 gap-1.5 shadow-md shadow-primary/20"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Disparando no Kestra...
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Enviado!
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                {cargaTipo === "full" ? "Confirmar Carga Full" : "Confirmar Execução"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MonthPickerSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [currentDate, setCurrentDate] = useState(() =>
    value ? parse(value, "yyyy-MM", new Date()) : new Date(),
  );
  const year = currentDate.getFullYear();
  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = setMonth(setYear(new Date(), year), monthIndex);
    onChange(format(newDate, "yyyy-MM"));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-8 w-[140px] justify-start text-left font-normal px-3 rounded-lg text-xs border-border/40"
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-50" />
          {value
            ? format(parse(value, "yyyy-MM", new Date()), "MMM/yyyy", {
                locale: ptBR,
              })
            : "Mês/Ano"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-3 rounded-xl" align="end">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={() => setCurrentDate(subYears(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-semibold text-sm">{year}</div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={() => setCurrentDate(addYears(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {months.map((m, i) => {
            const isSelected =
              value === format(setMonth(setYear(new Date(), year), i), "yyyy-MM");
            return (
              <Button
                key={m}
                variant={isSelected ? "default" : "ghost"}
                className="h-8 text-xs rounded-lg"
                onClick={() => handleMonthSelect(i)}
              >
                {m}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

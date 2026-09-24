import { useState, useMemo, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Terminal,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  Copy,
  Check,
  Activity,
  Calendar,
  Clock,
  Store,
  Play,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  getKestraExecutions,
  getKestraLogs,
  type KestraExecution,
  type KestraLog,
} from "@/lib/api/kestra.functions";
import { TriggerSyncDialog } from "@/components/trigger-sync-dialog";
import { supabase } from "@/integrations/supabase/external";

export const Route = createFileRoute("/_app/logs")({
  component: LogsPage,
});

function LogsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Modal de Logs (Console)
  const [selectedExec, setSelectedExec] = useState<KestraExecution | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [logs, setLogs] = useState<KestraLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<string>("ALL");
  const [logSearch, setLogSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Modal de Disparo Manual
  const [syncOpen, setSyncOpen] = useState(false);

  // Queries para o TriggerSyncDialog
  const servidoresQ = useQuery({
    queryKey: ["servidores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("grupo_r3_servidores" as never)
        .select("servidor_id, nome, ativo")
        .order("servidor_id");
      return (data ?? []) as any[];
    },
  });

  const sublojasQ = useQuery({
    queryKey: ["sublojas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("grupo_r3_sublojas" as never)
        .select("cidade_id, servidor_id, nome, ativo")
        .order("cidade_id");
      return (data ?? []) as any[];
    },
  });

  // Query das Execuções do Kestra
  const executionsQ = useQuery({
    queryKey: ["kestra-executions"],
    queryFn: async () => {
      return await getKestraExecutions();
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // Carregar logs de uma execução específica
  const handleOpenLogs = async (exec: KestraExecution) => {
    setSelectedExec(exec);
    setSheetOpen(true);
    setLoadingLogs(true);
    setLogFilter("ALL");
    setLogSearch("");
    try {
      const res = await getKestraLogs({ data: { executionId: exec.id } });
      setLogs(res);
    } catch (err: any) {
      toast.error("Erro ao carregar logs", { description: err.message });
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRefreshLogs = async () => {
    if (!selectedExec) return;
    setLoadingLogs(true);
    try {
      const res = await getKestraLogs({ data: { executionId: selectedExec.id } });
      setLogs(res);
      toast.success("Logs atualizados");
    } catch (err: any) {
      toast.error("Erro ao atualizar logs", { description: err.message });
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level}] ${l.taskId ? `[${l.taskId}] ` : ""}${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Logs copiados para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Scroll para o fim dos logs ao carregar
  useEffect(() => {
    if (sheetOpen && !loadingLogs && logs.length > 0) {
      setTimeout(() => {
        consoleBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [sheetOpen, loadingLogs, logs]);

  // Filtros de Execuções
  const allExecutions = executionsQ.data ?? [];
  const filteredExecutions = useMemo(() => {
    return allExecutions.filter((item) => {
      const matchesSearch =
        search === "" ||
        item.loja.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase()) ||
        item.fluxo.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "todos" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [allExecutions, search, statusFilter]);

  // Paginação
  const totalPages = Math.ceil(filteredExecutions.length / pageSize) || 1;
  const paginatedExecutions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredExecutions.slice(start, start + pageSize);
  }, [filteredExecutions, currentPage, pageSize]);

  // Filtros dentro dos Logs do Console
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesLevel =
        logFilter === "ALL" || log.level.toUpperCase() === logFilter;
      const matchesText =
        logSearch === "" ||
        log.message.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.taskId.toLowerCase().includes(logSearch.toLowerCase());
      return matchesLevel && matchesText;
    });
  }, [logs, logFilter, logSearch]);

  // Métricas
  const totalCount = allExecutions.length;
  const successCount = allExecutions.filter((e) => e.status === "Sucesso").length;
  const runningCount = allExecutions.filter((e) => e.status === "Em Execução").length;
  const failureCount = allExecutions.filter((e) => e.status === "Falha").length;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Terminal className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Logs de Execução (Kestra)</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[42px]">
            Monitore em tempo real o histórico e os registros de extração das lojas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/40 bg-card text-xs">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-xs cursor-pointer select-none">
              Auto-atualizar (10s)
            </Label>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => executionsQ.refetch()}
            disabled={executionsQ.isFetching}
            className="rounded-xl h-9 text-xs gap-1.5 border-border/50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", executionsQ.isFetching && "animate-spin")} />
            Recarregar
          </Button>

          <Button
            onClick={() => setSyncOpen(true)}
            className="rounded-xl h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 gap-1.5 transition-all"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Nova Execução
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 rounded-xl border-border/40 bg-card/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Total de Execuções
              </p>
              <p className="text-2xl font-bold mt-1 text-foreground">{totalCount}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Activity className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 rounded-xl border-border/40 bg-card/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Sucesso
              </p>
              <p className="text-2xl font-bold mt-1 text-foreground">{successCount}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 rounded-xl border-border/40 bg-card/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Em Execução
              </p>
              <p className="text-2xl font-bold mt-1 text-foreground">{runningCount}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Loader2 className={cn("h-5 w-5", runningCount > 0 && "animate-spin")} />
            </div>
          </div>
        </Card>

        <Card className="p-4 rounded-xl border-border/40 bg-card/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-destructive">
                Falhas
              </p>
              <p className="text-2xl font-bold mt-1 text-foreground">{failureCount}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
              <XCircle className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Buscar por loja, ID da execução ou fluxo..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-11 h-11 rounded-xl bg-card border-border/40 text-xs"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px] h-11 rounded-xl bg-card border-border/40 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="Sucesso">🟢 Sucesso</SelectItem>
            <SelectItem value="Em Execução">🔵 Em Execução</SelectItem>
            <SelectItem value="Falha">🔴 Falha</SelectItem>
            <SelectItem value="Pausado">🟡 Pausado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela de Execuções */}
      <Card className="rounded-xl border-border/40 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="w-[140px] text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Loja / Escopo</TableHead>
                <TableHead className="text-xs font-semibold">Fluxo / Carga</TableHead>
                <TableHead className="text-xs font-semibold">Início</TableHead>
                <TableHead className="text-xs font-semibold">Duração</TableHead>
                <TableHead className="text-right text-xs font-semibold pr-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executionsQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Carregando execuções do Kestra...
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedExecutions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5 py-4">
                      <Terminal className="h-8 w-8 text-muted-foreground/30 mb-1" />
                      <span className="font-medium text-xs">Nenhuma execução encontrada</span>
                      <span className="text-[11px] text-muted-foreground/70">
                        {allExecutions.length === 0
                          ? "Nenhum histórico registrado no Kestra ou verifique a conexão com o servidor."
                          : "Nenhum registro corresponde aos filtros aplicados."}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedExecutions.map((exec) => (
                  <TableRow
                    key={exec.id}
                    className="border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    {/* Status Badge */}
                    <TableCell>
                      {exec.status === "Sucesso" && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Sucesso
                        </Badge>
                      )}
                      {exec.status === "Em Execução" && (
                        <Badge
                          variant="outline"
                          className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium animate-pulse"
                        >
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Rodando
                        </Badge>
                      )}
                      {exec.status === "Falha" && (
                        <Badge
                          variant="outline"
                          className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                        >
                          <XCircle className="h-3 w-3" />
                          Falha
                        </Badge>
                      )}
                      {exec.status === "Pausado" && (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                        >
                          <AlertCircle className="h-3 w-3" />
                          Pausado
                        </Badge>
                      )}
                    </TableCell>

                    {/* Loja */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Store className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        <span className="font-semibold text-xs text-foreground truncate max-w-[240px]">
                          {exec.loja}
                        </span>
                      </div>
                    </TableCell>

                    {/* Fluxo */}
                    <TableCell>
                      <span className="text-xs text-muted-foreground font-mono">
                        {exec.fluxo}
                      </span>
                    </TableCell>

                    {/* Início */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 opacity-60" />
                        <span>{exec.data}</span>
                      </div>
                    </TableCell>

                    {/* Duração */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <Clock className="h-3 w-3 opacity-60" />
                        <span>{exec.tempo}</span>
                      </div>
                    </TableCell>

                    {/* Ações */}
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => handleOpenLogs(exec)}
                          className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-1.5 shadow-sm"
                        >
                          <Terminal className="h-3.5 w-3.5" />
                          Console
                        </Button>
                        <a
                          href={exec.kestraUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir no painel web do Kestra"
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon" }),
                            "h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/40 bg-muted/20 text-xs">
            <span className="text-muted-foreground">
              Mostrando página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> (
              {filteredExecutions.length} execuções)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="rounded-lg h-8 text-xs"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="rounded-lg h-8 text-xs"
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Sheet Lateral: Console de Logs Estilo Hacker/Terminal */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-3xl data-[side=right]:sm:max-w-3xl bg-zinc-950 text-zinc-100 border-zinc-800 p-0 flex flex-col h-full shadow-2xl">
          {/* Header do Sheet */}
          <div className="p-5 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
            <SheetHeader className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-wider font-semibold">
                  <Terminal className="h-4 w-4" />
                  Console de Logs da Execução
                </div>
                {selectedExec && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[10px] uppercase border",
                      selectedExec.status === "Sucesso" && "border-emerald-500/40 text-emerald-400 bg-emerald-950/30",
                      selectedExec.status === "Em Execução" && "border-blue-500/40 text-blue-400 bg-blue-950/30 animate-pulse",
                      selectedExec.status === "Falha" && "border-rose-500/40 text-rose-400 bg-rose-950/30",
                    )}
                  >
                    {selectedExec.status}
                  </Badge>
                )}
              </div>
              <SheetTitle className="text-base font-bold text-zinc-50 flex items-center justify-between gap-2">
                <span className="truncate">{selectedExec?.loja}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded shrink-0">
                  ID: {selectedExec?.id}
                </span>
              </SheetTitle>
              <SheetDescription className="text-zinc-400 text-xs font-mono">
                {selectedExec?.fluxo} • Duração: {selectedExec?.tempo} • Início: {selectedExec?.data}
              </SheetDescription>
            </SheetHeader>

            {/* Toolbar interna do Sheet */}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-zinc-800/80">
              <div className="relative flex-1 min-w-[140px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                <Input
                  placeholder="Filtrar mensagem do log..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="pl-8 h-8 rounded-lg bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                {(["ALL", "INFO", "WARN", "ERROR"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLogFilter(lvl)}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-mono uppercase transition-colors",
                      logFilter === lvl
                        ? "bg-zinc-800 text-zinc-100 font-bold"
                        : "text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshLogs}
                disabled={loadingLogs}
                className="h-8 px-2.5 rounded-lg border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 text-xs font-mono"
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loadingLogs && "animate-spin")} />
                Recarregar
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLogs}
                disabled={filteredLogs.length === 0}
                className="h-8 px-2.5 rounded-lg border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 text-xs font-mono"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>

          {/* Área de Logs Terminal */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed bg-zinc-950 selection:bg-zinc-800 space-y-1">
            {loadingLogs ? (
              <div className="flex flex-col items-center justify-center h-full gap-2.5 text-zinc-500 py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span>Carregando logs do Kestra...</span>
              </div>
            ) : filteredLogs.length > 0 ? (
              filteredLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="hover:bg-zinc-900/60 py-1 px-1.5 rounded transition-colors flex items-start gap-2 border-b border-zinc-900/40 last:border-0"
                >
                  <span className="text-zinc-600 select-none text-[10px] pt-0.5 shrink-0 w-[65px]">
                    {log.timestamp.includes(" ") ? log.timestamp.split(" ")[1] : log.timestamp}
                  </span>

                  <span
                    className={cn(
                      "select-none text-[9px] uppercase px-1.5 py-0.5 rounded font-bold shrink-0 text-center w-[46px]",
                      log.level === "ERROR" && "bg-rose-950/60 border border-rose-800 text-rose-400",
                      log.level === "WARN" && "bg-amber-950/60 border border-amber-800 text-amber-400",
                      log.level === "INFO" && "bg-zinc-900 border border-zinc-800 text-zinc-400",
                      log.level === "DEBUG" && "bg-zinc-900/50 border border-zinc-800/50 text-zinc-600",
                    )}
                  >
                    {log.level}
                  </span>

                  {log.taskId && (
                    <span className="text-primary/80 font-semibold shrink-0 max-w-[140px] truncate" title={log.taskId}>
                      [{log.taskId}]
                    </span>
                  )}

                  <span
                    className={cn(
                      "break-words whitespace-pre-wrap flex-1 min-w-0 font-mono",
                      log.level === "ERROR" && "text-rose-300 font-semibold",
                      log.level === "WARN" && "text-amber-200",
                      log.level === "INFO" && "text-zinc-300",
                      log.level === "DEBUG" && "text-zinc-500",
                    )}
                  >
                    {log.message}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-500 py-16">
                <AlertCircle className="h-6 w-6 text-zinc-600" />
                <span>Nenhum log encontrado para esta execução com os filtros aplicados.</span>
              </div>
            )}
            <div ref={consoleBottomRef} />
          </div>

          {/* Footer do Sheet */}
          <div className="p-3.5 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-zinc-500 font-mono">
              {filteredLogs.length} linha{filteredLogs.length === 1 ? "" : "s"} de log
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSheetOpen(false)}
                className="rounded-lg border-zinc-800 hover:bg-zinc-900 text-zinc-400 text-xs font-mono h-8"
              >
                Fechar Console
              </Button>
              {selectedExec && (
                <a
                  href={selectedExec.kestraUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "rounded-lg text-xs font-mono gap-1.5 h-8 bg-zinc-800 hover:bg-zinc-700 text-zinc-100",
                  )}
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir no Kestra
                </a>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog para Nova Execução Manual */}
      <TriggerSyncDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        servidores={servidoresQ.data ?? []}
        sublojas={sublojasQ.data ?? []}
      />
    </div>
  );
}

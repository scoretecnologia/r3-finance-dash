import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Layers,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface DeparaItem {
  id?: number;
  conta_origem: string;
  conta_padronizada: string;
  grupo_dre: string;
  subgrupo?: string | null;
  tipo: string;
  ordem_grupo: number;
  ordem_conta: number;
  created_at?: string;
  updated_at?: string;
}

export const DRE_GROUPS_CONFIG = [
  {
    group: "Avarias",
    label: "(-) Avarias",
    ordem: 3,
    tipo: "DEDUCAO",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  {
    group: "Despesas Administrativas",
    label: "(-) Despesas Administrativas",
    ordem: 4,
    tipo: "DESPESA",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
  {
    group: "Despesa logistica",
    label: "(-) Despesa logística",
    ordem: 5,
    tipo: "DESPESA",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    group: "Taxas de cartão",
    label: "(-) Taxas de cartão",
    ordem: 6,
    tipo: "DESPESA",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  {
    group: "Tributos",
    label: "(-) Tributos",
    ordem: 7,
    tipo: "DESPESA",
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  },
  {
    group: "Comissão parceiro",
    label: "Comissão parceiro",
    ordem: 8,
    tipo: "COMISSAO",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  },
  {
    group: "Investimentos",
    label: "(-) Investimentos",
    ordem: 9,
    tipo: "INVESTIMENTO",
    badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  },
  {
    group: "Outras / Não Operacionais",
    label: "(-) Outras / Não Operacionais",
    ordem: 10,
    tipo: "NAO_OPERACIONAL",
    badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  },
];

export function PlanoContasTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("todos");
  const [editItem, setEditItem] = useState<DeparaItem | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<DeparaItem | null>(null);

  // Form State
  const [formOrigem, setFormOrigem] = useState("");
  const [formPadrao, setFormPadrao] = useState("");
  const [formGrupo, setFormGrupo] = useState("Despesas Administrativas");
  const [formSubgrupo, setFormSubgrupo] = useState("");
  const [formUpdateHistorical, setFormUpdateHistorical] = useState(true);

  // Consulta da Tabela de De-Para
  const deparaQ = useQuery({
    queryKey: ["plano-contas-depara"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupo_r3_plano_contas_depara" as never)
        .select("*")
        .order("ordem_grupo", { ascending: true })
        .order("conta_padronizada", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DeparaItem[];
    },
  });

  // Mutação para Salvar / Atualizar Regra de De-Para
  const saveMutation = useMutation({
    mutationFn: async (payload: {
      origem: string;
      padrao: string;
      grupo: string;
      subgrupo?: string;
      updateHistorical: boolean;
      existingId?: number;
    }) => {
      const groupConfig =
        DRE_GROUPS_CONFIG.find((g) => g.group === payload.grupo) || DRE_GROUPS_CONFIG[1];

      const cleanOrigem = payload.origem.trim().toUpperCase();
      const cleanPadrao = payload.padrao.trim();
      const cleanSub = payload.subgrupo?.trim() || null;

      if (!cleanOrigem || !cleanPadrao) {
        throw new Error("Preencha a descrição original e o nome padronizado.");
      }

      // 1. Upsert na tabela de depara
      const { error: upsertErr } = await supabase
        .from("grupo_r3_plano_contas_depara" as never)
        .upsert(
          {
            conta_origem: cleanOrigem,
            conta_padronizada: cleanPadrao,
            grupo_dre: payload.grupo,
            subgrupo: cleanSub,
            tipo: groupConfig.tipo,
            ordem_grupo: groupConfig.ordem,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "conta_origem" }
        );

      if (upsertErr) throw upsertErr;

      // 2. Se solicitado, atualiza o histórico no banco de dados para refletir na hora
      if (payload.updateHistorical) {
        // Atualiza registros onde a descrição coincidir
        await supabase
          .from("grupo_r3_dre_detalhado" as never)
          .update({
            conta_padronizada: cleanPadrao,
            grupo_dre: payload.grupo,
          } as never)
          .ilike("descricao_conta", cleanOrigem);
      }

      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plano-contas-depara"] });
      qc.invalidateQueries({ queryKey: ["dre-all"] });
      toast.success("Plano de contas atualizado com sucesso!");
      setIsNewOpen(false);
      setEditItem(null);
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  // Mutação para Excluir Regra
  const deleteMutation = useMutation({
    mutationFn: async (origem: string) => {
      const { error } = await supabase
        .from("grupo_r3_plano_contas_depara" as never)
        .delete()
        .eq("conta_origem", origem);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plano-contas-depara"] });
      qc.invalidateQueries({ queryKey: ["dre-all"] });
      toast.success("Regra excluída com sucesso.");
      setDeleteConfirmItem(null);
    },
    onError: (err: any) => {
      toast.error(`Erro ao excluir: ${err.message}`);
    },
  });

  // Mutação para Sincronizar em Lote Todo o Histórico
  const syncAllHistoricalMutation = useMutation({
    mutationFn: async () => {
      const rules = deparaQ.data ?? [];
      if (rules.length === 0) return 0;

      // Executa updates em lotes para cada regra
      let updatedCount = 0;
      for (const rule of rules) {
        const { error } = await supabase
          .from("grupo_r3_dre_detalhado" as never)
          .update({
            conta_padronizada: rule.conta_padronizada,
            grupo_dre: rule.grupo_dre,
          } as never)
          .ilike("descricao_conta", rule.conta_origem);
        if (!error) updatedCount++;
      }
      return updatedCount;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dre-all"] });
      toast.success("Histórico DRE sincronizado com as regras do De-Para!");
    },
    onError: (err: any) => {
      toast.error(`Erro na sincronização: ${err.message}`);
    },
  });

  // Filtragem
  const filteredList = useMemo(() => {
    let list = deparaQ.data ?? [];

    if (selectedGroupFilter !== "todos") {
      list = list.filter((item) => item.grupo_dre === selectedGroupFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.conta_origem.toLowerCase().includes(q) ||
          item.conta_padronizada.toLowerCase().includes(q) ||
          (item.subgrupo && item.subgrupo.toLowerCase().includes(q))
      );
    }

    return list;
  }, [deparaQ.data, selectedGroupFilter, search]);

  // Contagem de Contas por Grupo
  const groupStats = useMemo(() => {
    const map = new Map<string, number>();
    (deparaQ.data ?? []).forEach((item) => {
      map.set(item.grupo_dre, (map.get(item.grupo_dre) || 0) + 1);
    });
    return map;
  }, [deparaQ.data]);

  const handleOpenEdit = (item: DeparaItem) => {
    setEditItem(item);
    setFormOrigem(item.conta_origem);
    setFormPadrao(item.conta_padronizada);
    setFormGrupo(item.grupo_dre);
    setFormSubgrupo(item.subgrupo || "");
    setFormUpdateHistorical(true);
  };

  const handleOpenNew = () => {
    setEditItem(null);
    setFormOrigem("");
    setFormPadrao("");
    setFormGrupo("Despesas Administrativas");
    setFormSubgrupo("");
    setFormUpdateHistorical(true);
    setIsNewOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── CARDS DE RESUMO DO PLANO DE CONTAS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 rounded-xl border border-border/50 bg-card shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Total de Regras De-Para
          </span>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">
            {deparaQ.data?.length || 0}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Mapeadas das lojas</p>
        </Card>

        <Card className="p-4 rounded-xl border border-border/50 bg-card shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Despesas Adm.
          </span>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {groupStats.get("Despesas Administrativas") || 0}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Pessoal e operação</p>
        </Card>

        <Card className="p-4 rounded-xl border border-border/50 bg-card shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Despesa Logística
          </span>
          <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
            {groupStats.get("Despesa logistica") || 0}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Frota, fretes e viagens</p>
        </Card>

        <Card className="p-4 rounded-xl border border-border/50 bg-card shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Taxas & Tributos
          </span>
          <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
            {(groupStats.get("Taxas de cartão") || 0) + (groupStats.get("Tributos") || 0)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Cartão, Pix e Impostos</p>
        </Card>
      </div>

      {/* ── BARRA DE FERRAMENTAS & FILTROS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          {/* Busca */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por termo original da loja ou nome padronizado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-xl bg-card border-border/50 text-xs"
            />
          </div>

          {/* Filtro por Grupo */}
          <Select value={selectedGroupFilter} onValueChange={setSelectedGroupFilter}>
            <SelectTrigger className="w-[200px] h-10 rounded-xl bg-card border-border/50 text-xs">
              <SelectValue placeholder="Grupo DRE" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos" className="text-xs font-semibold text-primary">
                Todos os Grupos
              </SelectItem>
              {DRE_GROUPS_CONFIG.map((g) => (
                <SelectItem key={g.group} value={g.group} className="text-xs">
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncAllHistoricalMutation.mutate()}
            disabled={syncAllHistoricalMutation.isPending}
            className="h-10 text-xs rounded-xl border-border/50 gap-1.5"
            title="Atualiza todas as 17 mil linhas de DRE no banco com as regras atuais"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", syncAllHistoricalMutation.isPending && "animate-spin")}
            />
            {syncAllHistoricalMutation.isPending ? "Sincronizando..." : "Sincronizar DRE"}
          </Button>

          <Button
            onClick={handleOpenNew}
            size="sm"
            className="h-10 text-xs font-semibold rounded-xl bg-primary text-primary-foreground gap-1.5 shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" /> Nova Regra De-Para
          </Button>
        </div>
      </div>

      {/* ── TABELA DE DE-PARA ── */}
      <Card className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border/50">
              <tr>
                <th className="py-3 px-4 min-w-[280px]">Termo no ERP (Nome Original)</th>
                <th className="py-3 px-4 min-w-[220px]">Conta Padronizada (No DRE)</th>
                <th className="py-3 px-4 min-w-[180px]">Grupo Gerencial DRE</th>
                <th className="py-3 px-3 min-w-[120px]">Subgrupo</th>
                <th className="py-3 px-3 text-right w-[100px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {deparaQ.isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    Carregando regras de De-Para...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    Nenhuma regra encontrada para este filtro.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const groupConfig =
                    DRE_GROUPS_CONFIG.find((g) => g.group === item.grupo_dre) || DRE_GROUPS_CONFIG[1];

                  return (
                    <tr
                      key={item.conta_origem}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Termo da Loja / ERP */}
                      <td className="py-2.5 px-4 font-mono font-medium text-foreground">
                        <span className="px-2 py-0.5 rounded bg-muted text-[11px] border border-border/40 inline-block max-w-[320px] truncate" title={item.conta_origem}>
                          {item.conta_origem}
                        </span>
                      </td>

                      {/* Nome Padronizado */}
                      <td className="py-2.5 px-4 font-sans font-semibold text-foreground">
                        {item.conta_padronizada}
                      </td>

                      {/* Grupo DRE */}
                      <td className="py-2.5 px-4">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-sans font-medium border", groupConfig.badgeClass)}
                        >
                          {groupConfig.label}
                        </Badge>
                      </td>

                      {/* Subgrupo */}
                      <td className="py-2.5 px-3 text-muted-foreground font-sans">
                        {item.subgrupo ? (
                          <span className="text-[11px]">{item.subgrupo}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(item)}
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Editar classificação"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmItem(item)}
                            className="h-7 w-7 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Excluir regra"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── MODAL DE CRIAÇÃO / EDIÇÃO DE REGRA DE-PARA ── */}
      <Dialog
        open={isNewOpen || !!editItem}
        onOpenChange={(open) => {
          if (!open) {
            setIsNewOpen(false);
            setEditItem(null);
          }
        }}
      >
        <DialogContent className="max-w-md w-full p-6 rounded-2xl border border-border bg-card shadow-2xl">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              {editItem ? "Editar Regra do Plano de Contas" : "Nova Regra do Plano de Contas"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Defina como os lançamentos das lojas no ERP devem ser agrupados no DRE gerencial.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate({
                origem: formOrigem,
                padrao: formPadrao,
                grupo: formGrupo,
                subgrupo: formSubgrupo,
                updateHistorical: formUpdateHistorical,
                existingId: editItem?.id,
              });
            }}
            className="space-y-4 pt-3"
          >
            {/* Campo 1: Descrição Original */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Nome Original no ERP da Loja</span>
                <span className="text-[10px] text-muted-foreground font-mono">conta_origem</span>
              </Label>
              <Input
                required
                disabled={!!editItem} // No update, a chave primária de origem é mantida
                placeholder="Ex: INTERNET, COMBUSTIVEL, ALUGUEL..."
                value={formOrigem}
                onChange={(e) => setFormOrigem(e.target.value.toUpperCase())}
                className="font-mono text-xs rounded-xl uppercase bg-background"
              />
              <p className="text-[10px] text-muted-foreground">
                O texto exato que aparece nos relatórios do sistema de origem.
              </p>
            </div>

            {/* Campo 2: Nome Padronizado */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Nome Padronizado no DRE</span>
                <span className="text-[10px] text-muted-foreground font-mono">conta_padronizada</span>
              </Label>
              <Input
                required
                placeholder="Ex: Internet e Conectividade, Combustíveis..."
                value={formPadrao}
                onChange={(e) => setFormPadrao(e.target.value)}
                className="text-xs rounded-xl bg-background"
              />
            </div>

            {/* Campo 3: Grupo Gerencial DRE */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Grupo Gerencial da DRE
              </Label>
              <Select value={formGrupo} onValueChange={setFormGrupo}>
                <SelectTrigger className="w-full h-10 rounded-xl text-xs bg-background">
                  <SelectValue placeholder="Selecione o grupo" />
                </SelectTrigger>
                <SelectContent>
                  {DRE_GROUPS_CONFIG.map((g) => (
                    <SelectItem key={g.group} value={g.group} className="text-xs font-medium">
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Campo 4: Subgrupo Opcional */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Subgrupo / Classificação Interna (Opcional)
              </Label>
              <Input
                placeholder="Ex: Pessoal, Ocupação, Frota, Adquirência..."
                value={formSubgrupo}
                onChange={(e) => setFormSubgrupo(e.target.value)}
                className="text-xs rounded-xl bg-background"
              />
            </div>

            {/* Opção: Atualizar Histórico */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-semibold text-foreground block">
                  Atualizar lançamentos históricos
                </span>
                <p className="text-[10px] text-muted-foreground">
                  Aplica essa nova padronização imediatamente a todos os registros passados no banco.
                </p>
              </div>
              <Switch
                checked={formUpdateHistorical}
                onCheckedChange={setFormUpdateHistorical}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsNewOpen(false);
                  setEditItem(null);
                }}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="rounded-xl text-xs font-semibold bg-primary text-primary-foreground gap-1.5"
              >
                {saveMutation.isPending ? "Salvando..." : "Salvar Classificação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ── */}
      <Dialog
        open={!!deleteConfirmItem}
        onOpenChange={(open) => !open && setDeleteConfirmItem(null)}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Excluir Regra de De-Para?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-2">
              Você tem certeza que deseja remover o mapeamento de:
              <br />
              <strong className="text-foreground font-mono block mt-1">
                {deleteConfirmItem?.conta_origem}
              </strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmItem(null)}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteConfirmItem && deleteMutation.mutate(deleteConfirmItem.conta_origem)
              }
              className="text-xs rounded-xl"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

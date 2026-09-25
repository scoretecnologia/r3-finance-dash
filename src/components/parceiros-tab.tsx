import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Users,
  Store,
  MapPin,
  Percent,
  CheckCircle2,
  Sparkles,
  Building2,
  HelpCircle,
  FileSpreadsheet,
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

export interface ParceiroRegra {
  id?: number;
  parceiro_nome: string;
  servidor_id: number | null;
  servidor_nome: string | null;
  cidade_id: number | null;
  cidade_nome: string | null;
  percentual_comissao: number;
  observacao?: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export function ParceirosTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ParceiroRegra | null>(null);

  // Form states
  const [formParceiroNome, setFormParceiroNome] = useState("");
  const [formServidorId, setFormServidorId] = useState<string>("none");
  const [formCidadeId, setFormCidadeId] = useState<string>("none");
  const [formPercentual, setFormPercentual] = useState("25.00");
  const [formObservacao, setFormObservacao] = useState("");
  const [formAtivo, setFormAtivo] = useState(true);

  // 1. Fetch regras
  const regrasQ = useQuery({
    queryKey: ["parceiros-regras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupo_r3_parceiros_regras" as never)
        .select("*")
        .order("parceiro_nome")
        .order("servidor_nome");
      if (error) throw error;
      return (data ?? []) as unknown as ParceiroRegra[];
    },
  });

  // 2. Fetch servidores e sublojas para dropdowns
  const servidoresQ = useQuery({
    queryKey: ["servidores-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupo_r3_servidores" as never)
        .select("servidor_id, nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Array<{ servidor_id: number; nome: string }>;
    },
  });

  const sublojasQ = useQuery({
    queryKey: ["sublojas-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupo_r3_sublojas" as never)
        .select("cidade_id, servidor_id, nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Array<{ cidade_id: number; servidor_id: number; nome: string }>;
    },
  });

  // Lista de parceiros únicos para filtro
  const uniquePartners = useMemo(() => {
    const set = new Set<string>();
    (regrasQ.data ?? []).forEach((r) => {
      if (r.parceiro_nome) set.add(r.parceiro_nome.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [regrasQ.data]);

  // Sublojas filtradas pelo servidor selecionado no modal
  const availableSublojasInForm = useMemo(() => {
    if (formServidorId === "none" || !formServidorId) return sublojasQ.data ?? [];
    return (sublojasQ.data ?? []).filter((s) => String(s.servidor_id) === formServidorId);
  }, [sublojasQ.data, formServidorId]);

  // Filtragem da lista
  const filteredRegras = useMemo(() => {
    let list = regrasQ.data ?? [];

    if (partnerFilter !== "todos") {
      list = list.filter((r) => r.parceiro_nome.trim().toUpperCase() === partnerFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.parceiro_nome.toLowerCase().includes(q) ||
          (r.servidor_nome && r.servidor_nome.toLowerCase().includes(q)) ||
          (r.cidade_nome && r.cidade_nome.toLowerCase().includes(q)) ||
          (r.observacao && r.observacao.toLowerCase().includes(q))
      );
    }

    return list;
  }, [regrasQ.data, partnerFilter, search]);

  // Mutation para Salvar / Editar
  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<ParceiroRegra>) => {
      if (editingItem?.id) {
        const { error } = await supabase
          .from("grupo_r3_parceiros_regras" as never)
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id" as never, editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("grupo_r3_parceiros_regras" as never)
          .insert([payload] as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingItem ? "Vínculo atualizado com sucesso!" : "Novo parceiro vinculado com sucesso!");
      qc.invalidateQueries({ queryKey: ["parceiros-regras"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  // Mutation para Deletar
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("grupo_r3_parceiros_regras" as never)
        .delete()
        .eq("id" as never, id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo removido com sucesso!");
      qc.invalidateQueries({ queryKey: ["parceiros-regras"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao excluir: ${err.message}`);
    },
  });

  // Mutation para Toggle Ativo
  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
      const { error } = await supabase
        .from("grupo_r3_parceiros_regras" as never)
        .update({ ativo, updated_at: new Date().toISOString() } as never)
        .eq("id" as never, id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parceiros-regras"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao alterar status: ${err.message}`);
    },
  });

  const resetForm = () => {
    setEditingItem(null);
    setFormParceiroNome("");
    setFormServidorId("none");
    setFormCidadeId("none");
    setFormPercentual("25.00");
    setFormObservacao("");
    setFormAtivo(true);
  };

  const handleOpenNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (item: ParceiroRegra) => {
    setEditingItem(item);
    setFormParceiroNome(item.parceiro_nome);
    setFormServidorId(item.servidor_id ? String(item.servidor_id) : "none");
    setFormCidadeId(item.cidade_id ? String(item.cidade_id) : "none");
    setFormPercentual(String(item.percentual_comissao || 25.0));
    setFormObservacao(item.observacao || "");
    setFormAtivo(item.ativo);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formParceiroNome.trim()) {
      toast.error("Informe o nome do parceiro.");
      return;
    }

    const srv = (servidoresQ.data ?? []).find((s) => String(s.servidor_id) === formServidorId);
    const sub = (sublojasQ.data ?? []).find((s) => String(s.cidade_id) === formCidadeId);

    const payload: Partial<ParceiroRegra> = {
      parceiro_nome: formParceiroNome.trim().toUpperCase(),
      servidor_id: formServidorId !== "none" ? Number(formServidorId) : null,
      servidor_nome: srv ? srv.nome : (editingItem?.servidor_nome || null),
      cidade_id: formCidadeId !== "none" ? Number(formCidadeId) : null,
      cidade_nome: sub ? sub.nome : (formCidadeId === "none" ? null : editingItem?.cidade_nome || null),
      percentual_comissao: Number(formPercentual) || 25.0,
      observacao: formObservacao.trim() || null,
      ativo: formAtivo,
    };

    saveMutation.mutate(payload);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner Explicativo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5 shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Gestão de Parceiros & Percentuais de Comissão
              <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30 text-primary">
                Base Planilha Maio/2026
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">
              Cadastre cada parceiro e vincule às suas respectivas lojas (Matriz ou Filial). O percentual definido aqui será utilizado
              na apuração da linha <strong>(-) Comissão parceiro</strong> e <strong>(=) Distribuição do lucro</strong> do DRE quando a loja for filtrada.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleOpenNew}
            className="rounded-xl h-9 text-xs font-semibold gap-1.5 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Vincular Parceiro
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Total Parceiros</span>
            <Users className="h-4 w-4 text-primary/70" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">
            {uniquePartners.length}
          </div>
          <span className="text-[10px] text-muted-foreground">Parceiros cadastrados</span>
        </Card>

        <Card className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Lojas Vinculadas</span>
            <Store className="h-4 w-4 text-blue-500/70" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
            {regrasQ.data?.length ?? 0}
          </div>
          <span className="text-[10px] text-muted-foreground">Regras ativas no sistema</span>
        </Card>

        <Card className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Comissão Padrão</span>
            <Percent className="h-4 w-4 text-emerald-500/70" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            25,0%
          </div>
          <span className="text-[10px] text-muted-foreground">Alíquota da maioria</span>
        </Card>

        <Card className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Diferenciados</span>
            <Sparkles className="h-4 w-4 text-amber-500/70" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {(regrasQ.data ?? []).filter((r) => Number(r.percentual_comissao) !== 25).length}
          </div>
          <span className="text-[10px] text-muted-foreground">Alíquotas especiais (ex: 30%)</span>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Buscar por parceiro ou loja..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-card border-border"
            />
          </div>

          <Select value={partnerFilter} onValueChange={setPartnerFilter}>
            <SelectTrigger className="h-9 w-full sm:w-[200px] text-xs rounded-xl border-border bg-card">
              <SelectValue placeholder="Filtrar por Parceiro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Parceiros ({uniquePartners.length})</SelectItem>
              {uniquePartners.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="text-xs text-muted-foreground whitespace-nowrap self-end sm:self-center">
          Exibindo <strong>{filteredRegras.length}</strong> de <strong>{regrasQ.data?.length ?? 0}</strong> vínculos
        </span>
      </div>

      {/* Tabela de Vínculos de Parceiros */}
      <Card className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Parceiro Responsável</th>
                <th className="py-3 px-4">Loja Matriz (Servidor)</th>
                <th className="py-3 px-4">Filial / Subloja (Cidade)</th>
                <th className="py-3 px-4 text-center">% Comissão</th>
                <th className="py-3 px-4">Observação / Origem</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRegras.map((regra) => (
                <tr key={regra.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {regra.parceiro_nome.slice(0, 2)}
                      </div>
                      <span className="font-semibold">{regra.parceiro_nome}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    {regra.servidor_nome ? (
                      <div className="flex items-center gap-1.5 text-foreground">
                        <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{regra.servidor_nome}</span>
                        {regra.servidor_id && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            (#{regra.servidor_id})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    {regra.cidade_nome ? (
                      <Badge variant="outline" className="gap-1 border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10">
                        <MapPin className="h-3 w-3" />
                        <span>{regra.cidade_nome}</span>
                        {regra.cidade_id && <span className="font-mono text-[9px] opacity-75">#{regra.cidade_id}</span>}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">Toda a Matriz</span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-center font-mono font-bold">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-md text-xs",
                        Number(regra.percentual_comissao) > 25
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-extrabold"
                          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      )}
                    >
                      {Number(regra.percentual_comissao).toFixed(2)}%
                    </span>
                  </td>

                  <td className="py-3 px-4 text-muted-foreground text-[11px] truncate max-w-xs" title={regra.observacao || ""}>
                    {regra.observacao || "—"}
                  </td>

                  <td className="py-3 px-4 text-center">
                    <Switch
                      checked={regra.ativo}
                      onCheckedChange={(val) => {
                        if (regra.id) toggleAtivoMutation.mutate({ id: regra.id, ativo: val });
                      }}
                    />
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(regra)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        title="Editar vínculo"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Remover o vínculo do parceiro ${regra.parceiro_nome} com esta loja?`)) {
                            if (regra.id) deleteMutation.mutate(regra.id);
                          }
                        }}
                        className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        title="Excluir regra"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredRegras.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    Nenhum vínculo encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de Criação / Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {editingItem ? "Editar Vínculo de Parceiro" : "Novo Vínculo de Parceiro"}
              </DialogTitle>
              <DialogDescription>
                Defina o nome do parceiro, a loja de responsabilidade e o percentual de comissão acordado.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-2">
              {/* Nome do Parceiro */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nome do Parceiro *</Label>
                <Input
                  placeholder="Ex: LEANDRO, JULIANA, DANIELE..."
                  value={formParceiroNome}
                  onChange={(e) => setFormParceiroNome(e.target.value)}
                  className="h-9 text-xs rounded-lg"
                  required
                />
              </div>

              {/* Loja Matriz (Servidor) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Loja Matriz (Servidor)</Label>
                <Select
                  value={formServidorId}
                  onValueChange={(val) => {
                    setFormServidorId(val);
                    setFormCidadeId("none");
                  }}
                >
                  <SelectTrigger className="h-9 text-xs rounded-lg">
                    <SelectValue placeholder="Selecione a Matriz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma Matriz (Definir apenas Filial)</SelectItem>
                    {(servidoresQ.data ?? []).map((s) => (
                      <SelectItem key={s.servidor_id} value={String(s.servidor_id)}>
                        {s.nome} (#{s.servidor_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subloja / Filial específica */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Filial / Subloja (Opcional)</Label>
                <Select value={formCidadeId} onValueChange={setFormCidadeId}>
                  <SelectTrigger className="h-9 text-xs rounded-lg">
                    <SelectValue placeholder="Selecione a Filial (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Toda a Matriz (Sem filial específica)</SelectItem>
                    {availableSublojasInForm.map((sl) => (
                      <SelectItem key={sl.cidade_id} value={String(sl.cidade_id)}>
                        {sl.nome} (#{sl.cidade_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Selecione uma filial caso o parceiro atue exclusivamente nela (ex: Ipueiras, Timonha, Carnaúbal).
                </p>
              </div>

              {/* Percentual de Comissão */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">% de Comissão sobre o Lucro Líquido *</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formPercentual}
                    onChange={(e) => setFormPercentual(e.target.value)}
                    className="h-9 text-xs rounded-lg pr-8 font-mono font-bold"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Geralmente <strong>25,00%</strong> (ou 30,00% para casos especiais).
                </p>
              </div>

              {/* Observação */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Observações</Label>
                <Input
                  placeholder="Ex: Acordo firmado em Maio/2026..."
                  value={formObservacao}
                  onChange={(e) => setFormObservacao(e.target.value)}
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              {/* Switch Ativo */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Regra Ativa</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Quando desativado, o cálculo deste parceiro não será aplicado no DRE.
                  </p>
                </div>
                <Switch checked={formAtivo} onCheckedChange={setFormAtivo} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-9 text-xs">
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="h-9 text-xs font-semibold">
                {saveMutation.isPending ? "Salvando..." : "Salvar Vínculo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

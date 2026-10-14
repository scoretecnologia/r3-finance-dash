import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external";
import type { DreRow, FaturamentoRow, ParceiroRegra, Servidor, Subloja } from "@/lib/dre";

/**
 * Consultas base da DRE Gerencial (lojas, filiais, faturamento, lançamentos e
 * regras de parceiro). As chaves de query são as mesmas usadas nas demais
 * telas, então o cache é compartilhado entre Visão Geral, DRE e Apuração.
 */
export function useDreData() {
  const servidoresQ = useQuery({
    queryKey: ["servidores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupo_r3_servidores" as never).select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Servidor[];
    },
  });

  const sublojasQ = useQuery({
    queryKey: ["sublojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupo_r3_sublojas" as never).select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Subloja[];
    },
  });

  const faturamentoQ = useQuery({
    queryKey: ["faturamento-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupo_r3_faturamento_loja" as never).select("*");
      if (error) throw error;
      return (data ?? []) as FaturamentoRow[];
    },
  });

  const dreQ = useQuery({
    queryKey: ["dre-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupo_r3_dre_detalhado" as never).select("*");
      if (error) throw error;
      return (data ?? []) as DreRow[];
    },
  });

  const regrasQ = useQuery({
    queryKey: ["parceiros-regras-dre"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupo_r3_parceiros_regras" as never)
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as ParceiroRegra[];
    },
  });

  const isLoading =
    servidoresQ.isLoading || sublojasQ.isLoading || faturamentoQ.isLoading || dreQ.isLoading || regrasQ.isLoading;
  const isFetching =
    servidoresQ.isFetching || sublojasQ.isFetching || faturamentoQ.isFetching || dreQ.isFetching || regrasQ.isFetching;
  const error = servidoresQ.error || sublojasQ.error || faturamentoQ.error || dreQ.error || regrasQ.error;

  // Lojas e filiais ativas (conforme Configurações)
  const activeServidores = useMemo(
    () => (servidoresQ.data ?? []).filter((s) => s.ativo),
    [servidoresQ.data],
  );
  const activeServidorIds = useMemo(
    () => new Set(activeServidores.map((s) => Number(s.servidor_id))),
    [activeServidores],
  );
  const activeSublojas = useMemo(
    () => (sublojasQ.data ?? []).filter((s) => s.ativo && activeServidorIds.has(Number(s.servidor_id))),
    [sublojasQ.data, activeServidorIds],
  );
  const activeSublojaIds = useMemo(
    () => new Set(activeSublojas.map((s) => Number(s.cidade_id))),
    [activeSublojas],
  );

  const refetchAll = () => {
    servidoresQ.refetch();
    sublojasQ.refetch();
    faturamentoQ.refetch();
    dreQ.refetch();
    regrasQ.refetch();
  };

  return {
    servidores: servidoresQ.data ?? [],
    sublojas: sublojasQ.data ?? [],
    faturamento: faturamentoQ.data ?? [],
    dre: dreQ.data ?? [],
    regras: regrasQ.data ?? [],
    activeServidores,
    activeServidorIds,
    activeSublojas,
    activeSublojaIds,
    isLoading,
    isFetching,
    error,
    refetchAll,
  };
}

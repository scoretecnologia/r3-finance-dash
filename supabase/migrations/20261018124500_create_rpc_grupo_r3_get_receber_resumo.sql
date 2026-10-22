-- ==============================================================================
-- 📊 RPC PARA RESUMO RÁPIDO DE RECEITAS GERADAS (CONTAS A RECEBER)
-- Agrega os dados da tabela grupo_r3_receber_detalhado no próprio Postgres,
-- reduzindo de 71.000+ linhas (38MB) para ~160 linhas agregadas (<25KB).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.grupo_r3_get_receber_resumo(
    p_ano text DEFAULT NULL,
    p_servidor_ids int[] DEFAULT NULL,
    p_cidade_ids int[] DEFAULT NULL
)
RETURNS TABLE (
    id_servidor integer,
    id_cidade integer,
    loja text,
    cidade text,
    mes_inicio date,
    mes_fim date,
    codigo_conta text,
    descricao_conta text,
    categoria text,
    conta_padronizada text,
    grupo_dre text,
    natureza text,
    debito numeric,
    credito numeric,
    valor_liquido numeric,
    total_lancamentos bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id_servidor,
        r.id_cidade,
        MIN(r.loja) as loja,
        MIN(r.cidade) as cidade,
        r.mes_inicio,
        MIN(r.mes_fim) as mes_fim,
        MIN(r.codigo_conta) as codigo_conta,
        MIN(r.descricao_conta) as descricao_conta,
        COALESCE(r.categoria, '') as categoria,
        COALESCE(r.conta_padronizada, r.descricao_conta, 'Outras Receitas') as conta_padronizada,
        MIN(r.grupo_dre) as grupo_dre,
        COALESCE(r.natureza, 'Receita') as natureza,
        COALESCE(SUM(r.debito), 0)::numeric as debito,
        COALESCE(SUM(r.credito), 0)::numeric as credito,
        COALESCE(SUM(r.valor_liquido), 0)::numeric as valor_liquido,
        COUNT(*)::bigint as total_lancamentos
    FROM public.grupo_r3_receber_detalhado r
    WHERE
        (p_ano IS NULL OR p_ano = 'todos' OR to_char(r.mes_inicio, 'YYYY') = p_ano)
        AND (p_servidor_ids IS NULL OR r.id_servidor = ANY(p_servidor_ids))
        AND (p_cidade_ids IS NULL OR r.id_cidade = ANY(p_cidade_ids))
    GROUP BY
        r.id_servidor,
        r.id_cidade,
        r.mes_inicio,
        COALESCE(r.categoria, ''),
        COALESCE(r.conta_padronizada, r.descricao_conta, 'Outras Receitas'),
        COALESCE(r.natureza, 'Receita');
END;
$$;

GRANT EXECUTE ON FUNCTION public.grupo_r3_get_receber_resumo(text, int[], int[]) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.grupo_r3_get_receber_resumo IS 'Retorna o resumo mensal agregado de receitas a receber para a DRE e Visão Geral com alta performance.';

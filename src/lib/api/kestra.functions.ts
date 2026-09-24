import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/external";

export interface TriggerSyncParams {
  servidor_id?: string;
  cidade_id?: string;
  mes_referencia?: string;
  carga_completa?: boolean;
}

export interface KestraExecution {
  id: string;
  loja: string;
  servidorId: string;
  cidadeId?: string;
  fluxo: string;
  status: "Sucesso" | "Em Execução" | "Falha" | "Pausado";
  tempo: string;
  data: string;
  kestraUrl: string;
  originalState: string;
  durationSeconds: number;
}

export interface KestraLog {
  timestamp: string;
  timestampRaw: string;
  level: string;
  message: string;
  taskId: string;
}

function getKestraConfig() {
  const webhookUrl =
    process.env.KESTRA_WEBHOOK_URL ||
    process.env.VITE_KESTRA_WEBHOOK_URL ||
    "https://kestra.ddinsights.com.br/api/v1/main/executions/webhook/continental.finance/dre_to_parquet/R3_FINANCE_EXTRACT_KEY";

  let baseUrl = "https://kestra.ddinsights.com.br/api/v1/main";
  let namespace = "continental.finance";
  let flowId = "dre_to_parquet";

  const match = webhookUrl.match(
    /^(https?:\/\/[^\/]+(?:\/[^\/]+)*)\/executions\/webhook\/([^\/]+)\/([^\/]+)/,
  );
  if (match) {
    baseUrl = match[1];
    namespace = match[2];
    flowId = match[3];
  }

  let origin = "https://kestra.ddinsights.com.br";
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    // fallback
  }

  const uiBaseUrl = `${origin}/ui`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const token = process.env.KESTRA_API_TOKEN;
  const basicAuth =
    process.env.KESTRA_BASIC_AUTH || "scorecontabilidade7@gmail.com:ScoreTech@2026#";

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (basicAuth) {
    const encoded = Buffer.from(basicAuth).toString("base64");
    headers["Authorization"] = `Basic ${encoded}`;
  }

  return { baseUrl, namespace, flowId, uiBaseUrl, webhookUrl, headers };
}

export const triggerKestraSync = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      servidor_id: z.string().optional(),
      cidade_id: z.string().optional(),
      mes_referencia: z.string().optional(),
      carga_completa: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { webhookUrl } = getKestraConfig();

    const payload = {
      servidor_id: data.servidor_id || "TODOS",
      cidade_id: data.cidade_id || "",
      mes_referencia: data.mes_referencia || "",
      carga_completa: Boolean(data.carga_completa),
    };

    console.log("Acionando Webhook do Kestra:", webhookUrl, payload);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Kestra retornou erro status ${response.status}: ${errorText || response.statusText}`,
        );
      }

      let resData: any = null;
      try {
        resData = await response.json();
      } catch {
        // payload pode não ser json
      }

      return {
        success: true,
        executionId: resData?.id,
        message: "Fluxo Kestra iniciado com sucesso!",
      };
    } catch (err: any) {
      console.error("Erro ao chamar Webhook do Kestra:", err);
      throw new Error(err.message || "Erro ao conectar com o Kestra");
    }
  });

export const getKestraExecutions = createServerFn({ method: "GET" }).handler(
  async (): Promise<KestraExecution[]> => {
    const { baseUrl, namespace, flowId, uiBaseUrl, headers } = getKestraConfig();

    // URLs para tentar (com ou sem /main)
    const baseCandidates = [
      baseUrl,
      baseUrl.includes("/main") ? baseUrl.replace("/main", "") : `${baseUrl}/main`,
    ];

    let rawExecutions: any[] = [];
    let fetchError: Error | null = null;

    for (const base of baseCandidates) {
      const pagedUrl = `${base}/executions/search?namespace=${namespace}&flowId=${flowId}&size=50&page=1`;
      try {
        const res = await fetch(pagedUrl, {
          headers,
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const data = await res.json();
          rawExecutions = Array.isArray(data) ? data : data.results || [];
          fetchError = null;
          break;
        } else {
          fetchError = new Error(`HTTP ${res.status}`);
        }
      } catch (err: any) {
        fetchError = err;
      }
    }

    if (fetchError && rawExecutions.length === 0) {
      console.warn("Aviso ao buscar execuções do Kestra:", fetchError.message);
    }

    // Buscar lojas e sublojas no Supabase para mapear nomes amigáveis
    let servidoresMap = new Map<number, string>();
    let sublojasMap = new Map<number, string>();
    try {
      const [srvRes, subRes] = await Promise.all([
        supabase.from("grupo_r3_servidores" as never).select("servidor_id, nome"),
        supabase.from("grupo_r3_sublojas" as never).select("cidade_id, nome"),
      ]);
      (srvRes.data as any[] | null)?.forEach((s) => servidoresMap.set(s.servidor_id, s.nome));
      (subRes.data as any[] | null)?.forEach((sl) => sublojasMap.set(sl.cidade_id, sl.nome));
    } catch (err) {
      console.warn("Erro ao buscar mapeamento de lojas no Supabase:", err);
    }

    // Ordena do mais recente para o mais antigo
    const sorted = [...rawExecutions].sort((a, b) => {
      const timeA = a.state?.startDate ? new Date(a.state.startDate).getTime() : 0;
      const timeB = b.state?.startDate ? new Date(b.state.startDate).getTime() : 0;
      return timeB - timeA;
    });

    return sorted.map((exec) => {
      const inputs = exec.inputs || {};
      const triggerBody = exec.trigger?.variables?.body || {};

      const servidorId = String(inputs.servidor_id ?? triggerBody.servidor_id ?? "");
      const cidadeId = String(inputs.cidade_id ?? triggerBody.cidade_id ?? "");
      const mesRef = String(inputs.mes_referencia ?? triggerBody.mes_referencia ?? "");
      const cargaCompleta = Boolean(inputs.carga_completa ?? triggerBody.carga_completa);

      // Nome da loja
      let lojaLabel = "Todas as Lojas Ativas";
      if (servidorId && servidorId !== "TODOS") {
        const sid = Number(servidorId);
        const srvNome = servidoresMap.get(sid) || `Loja #${servidorId}`;
        if (cidadeId) {
          const cid = Number(cidadeId);
          const subNome = sublojasMap.get(cid) || `Filial #${cidadeId}`;
          lojaLabel = `${srvNome} (${subNome})`;
        } else {
          lojaLabel = srvNome;
        }
      }

      // Nome do fluxo
      let fluxoLabel = "Sincronização Manual (Mês Atual)";
      if (cargaCompleta) {
        fluxoLabel = "Carga Completa (desde 2025)";
      } else if (mesRef) {
        fluxoLabel = `Retroativo (${mesRef})`;
      } else if (exec.trigger?.id === "schedule") {
        fluxoLabel = "Agendamento Diário (02:00)";
      }

      // Status amigável
      const rawState = exec.state?.current || "UNKNOWN";
      let statusFormat: "Sucesso" | "Em Execução" | "Falha" | "Pausado" = "Falha";
      if (rawState === "SUCCESS") {
        statusFormat = "Sucesso";
      } else if (["RUNNING", "CREATED", "RESTARTED", "EXECUTING"].includes(rawState)) {
        statusFormat = "Em Execução";
      } else if (rawState === "PAUSED") {
        statusFormat = "Pausado";
      }

      // Formatação de data
      let dataStr = "N/A";
      if (exec.state?.startDate) {
        const dt = new Date(exec.state.startDate);
        dataStr = dt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      }

      // Duração
      let durationSeconds = 0;
      let tempoStr = "-";
      if (exec.state?.startDate && exec.state?.endDate) {
        const diffMs =
          new Date(exec.state.endDate).getTime() - new Date(exec.state.startDate).getTime();
        durationSeconds = Math.max(0, Math.floor(diffMs / 1000));
      } else if (exec.state?.startDate) {
        const diffMs = Date.now() - new Date(exec.state.startDate).getTime();
        durationSeconds = Math.max(0, Math.floor(diffMs / 1000));
      }

      if (durationSeconds > 0) {
        const mins = Math.floor(durationSeconds / 60);
        const secs = durationSeconds % 60;
        tempoStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      }

      return {
        id: exec.id,
        loja: lojaLabel,
        servidorId,
        cidadeId: cidadeId || undefined,
        fluxo: fluxoLabel,
        status: statusFormat,
        tempo: tempoStr,
        data: dataStr,
        kestraUrl: `${uiBaseUrl}/executions/${namespace}/${flowId}/${exec.id}/logs`,
        originalState: rawState,
        durationSeconds,
      };
    });
  },
);

export const getKestraLogs = createServerFn({ method: "POST" })
  .inputValidator(z.object({ executionId: z.string().min(1) }))
  .handler(async ({ data }): Promise<KestraLog[]> => {
    const { baseUrl, headers } = getKestraConfig();

    const baseCandidates = [
      baseUrl,
      baseUrl.includes("/main") ? baseUrl.replace("/main", "") : `${baseUrl}/main`,
    ];

    let rawLogs: any[] = [];
    let lastError: Error | null = null;

    for (const base of baseCandidates) {
      const logsUrl = `${base}/logs/${data.executionId}`;
      try {
        const res = await fetch(logsUrl, {
          headers,
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const json = await res.json();
          rawLogs = Array.isArray(json) ? json : [];
          lastError = null;
          break;
        } else {
          lastError = new Error(`HTTP ${res.status}`);
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (lastError && rawLogs.length === 0) {
      console.warn("Aviso ao buscar logs do Kestra:", lastError.message);
    }

    const mapped = rawLogs.map((log: any) => {
      let timeStr = "";
      if (log.timestamp) {
        try {
          const dt = new Date(log.timestamp);
          timeStr = dt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        } catch {
          timeStr = String(log.timestamp);
        }
      }

      return {
        timestamp: timeStr,
        timestampRaw: log.timestamp || "",
        level: log.level || "INFO",
        message: log.message || "",
        taskId: log.taskId || "",
      };
    });

    // Ordenação cronológica (mais antigo primeiro para leitura sequencial do terminal)
    return mapped.sort((a, b) => {
      const timeA = a.timestampRaw ? new Date(a.timestampRaw).getTime() : 0;
      const timeB = b.timestampRaw ? new Date(b.timestampRaw).getTime() : 0;
      return timeA - timeB;
    });
  });

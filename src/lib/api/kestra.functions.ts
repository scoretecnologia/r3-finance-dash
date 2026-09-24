import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface TriggerSyncParams {
  servidor_id?: string;
  cidade_id?: string;
  mes_referencia?: string;
  carga_completa?: boolean;
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
    const webhookUrl =
      process.env.KESTRA_WEBHOOK_URL ||
      process.env.VITE_KESTRA_WEBHOOK_URL ||
      "https://kestra.ddinsights.com.br/api/v1/main/executions/webhook/continental.finance/dre_to_parquet/R3_FINANCE_EXTRACT_KEY";

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

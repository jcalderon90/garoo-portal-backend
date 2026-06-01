import { z } from 'zod';

export const facturasSatQuerySchema = z.object({
    query: z.object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        orgSlug: z.string().optional(),
        emisor: z.string().optional(),
        nit: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        serie: z.string().optional(),
        dte: z.string().optional(),
        monto: z.string().optional(),
        user: z.string().optional(),
    }),
});

export const getHistorySchema = z.object({
    params: z.object({
        serviceId: z.string().min(1, "Service ID is required"),
    })
});

// Nota: El proxyService (/:serviceId) pasa toda la carga al webhook de n8n.
// Se valida levemente el param para evitar exploits como strings vacíos.
export const proxyServiceSchema = z.object({
    params: z.object({
        serviceId: z.string().min(1, "Missing service ID in proxy request"),
    })
    // No validamos body de manera estricta aquí porque cada cliente en n8n
    // esperará un payload distinto (json files base64, PDFs, streams).
});

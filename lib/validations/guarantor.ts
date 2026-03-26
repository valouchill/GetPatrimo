import { z } from 'zod';

export const GuarantorCreateSessionSchema = z.object({
  invitationToken: z.string().optional(),
  applyToken: z.string().optional(),
  candidatureId: z.string().optional(),
  email: z.string().email('Email invalide').optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  slot: z.union([z.number(), z.string()]).optional(),
});

export const GuarantorAuditSchema = z.object({
  invitationToken: z.string().min(1, "Token d'invitation requis"),
  documents: z.array(z.object({
    fileName: z.string(),
    type: z.string(),
    analysisResult: z.object({
      document_metadata: z.object({ owner_name: z.string() }).optional(),
      trust_and_security: z.object({ digital_seal_authenticated: z.boolean().optional() }).optional(),
    }).optional(),
    mrzLines: z.array(z.string()).optional(),
  })).min(2, "Au moins 2 documents sont requis pour l'audit"),
});

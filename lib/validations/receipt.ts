import { z } from 'zod';

export const GenerateReceiptSchema = z.object({
  leaseId: z.string().min(1, { message: 'leaseId requis' }),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020),
  paidAmount: z.number().min(0).optional(),
});

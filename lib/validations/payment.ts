import { z } from 'zod';

export const PaymentListSchema = z.object({
  leaseId: z.string().min(1, { message: 'leaseId requis' }),
  year: z.coerce.number().int().min(2020).optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'PARTIAL', 'LATE', 'UNPAID']).optional(),
});

export const GeneratePaymentsSchema = z.object({
  leaseId: z.string().min(1, { message: 'leaseId requis' }).optional(),
});

export const ConfirmPaymentSchema = z.object({
  paidAmount: z.number().min(0, { message: 'Le montant doit être positif' }),
  notes: z.string().max(2000).optional(),
});

export const RegularizeSchema = z.object({
  leaseId: z.string().min(1, { message: 'leaseId requis' }),
  realCharges: z.number().min(0, { message: 'Les charges réelles doivent être positives' }),
  year: z.number().int().min(2020),
});

export const ReviseSchema = z.object({
  leaseId: z.string().min(1, { message: 'leaseId requis' }),
  newIRLIndex: z.number().positive({ message: 'L\'indice IRL doit être positif' }),
  oldIRLIndex: z.number().positive({ message: 'L\'ancien indice IRL doit être positif' }),
});

export const ExportSchema = z.object({
  format: z.enum(['pdf', 'csv'], { message: 'Format doit être pdf ou csv' }),
});

export const RemindSchema = z.object({
  type: z.enum(['EMAIL', 'SMS']).optional().default('EMAIL'),
});

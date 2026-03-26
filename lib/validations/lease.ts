import { z } from 'zod';

export const CompileLeaseSchema = z.object({
  propertyId: z.string().min(1, 'propertyId requis'),
  applicationId: z.string().optional(),
  candidatureId: z.string().optional(),
  formData: z.record(z.string(), z.unknown()).optional(),
});

export const SelectionSchema = z.object({
  applicationId: z.string().min(1, 'applicationId requis'),
});

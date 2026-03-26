import { z } from 'zod';

export const DiditSessionSchema = z.object({
  reference: z.string().optional(),
  token: z.string().optional(),
});

import { z } from 'zod';

export const CreateCheckoutSchema = z.object({
  propertyId: z.string().min(1, 'propertyId requis'),
});

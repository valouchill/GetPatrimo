import { z } from 'zod';

export const PricingSchema = z.object({
  zipcode: z.string().min(1, 'Code postal requis'),
  surface_m2: z.number().min(1, 'Surface requise'),
  atouts: z.array(z.string()).optional(),
});

export const GenerateAnnonceSchema = z.object({
  surface: z.number().optional(),
  dpe: z.string().optional(),
  atouts: z.array(z.string()).optional(),
  rent: z.number().optional(),
  address: z.string().optional(),
  rooms: z.number().optional(),
  description: z.string().optional(),
});

export const ScanVisionSchema = z.object({
  images: z.array(z.string()).min(1, 'Au moins une image requise'),
});

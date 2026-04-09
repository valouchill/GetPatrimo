import { z } from 'zod';

export const SignatureUploadSchema = z.object({
  signatureData: z
    .string()
    .min(1, { message: 'signatureData requis' })
    .refine(
      (val) => val.startsWith('data:image/png;base64,') || val.startsWith('data:image/jpeg;base64,'),
      { message: 'Format invalide — attendu data:image/png;base64,... ou data:image/jpeg;base64,...' }
    )
    .refine(
      (val) => {
        // ~2MB max en base64 (~2.7MB encoded)
        const base64Part = val.split(',')[1] || '';
        return base64Part.length <= 2_800_000;
      },
      { message: 'Image trop volumineuse (max 2 Mo)' }
    ),
});

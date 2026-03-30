# Agent BACKEND

Tu es l'expert backend du projet GetPatrimo (Next.js 16 API Routes + Express).

## Ta mission
Créer ou modifier les endpoints API selon les instructions du plan.

## Structure d'une API Route (template obligatoire)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { z } from 'zod';

// 1. Schéma de validation Zod
const bodySchema = z.object({
  // champs...
});

export async function POST(req: NextRequest) {
  try {
    // 2. Auth obligatoire
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // 3. Validation des entrées
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }

    // 4. Logique métier (filtrer par user!)
    const user = await User.findOne({ email: session.user.email }).lean();
    if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

    // 5. Opération
    const result = await SomeModel.create({ ...parsed.data, user: user._id });

    // 6. Log événement
    await Event.create({ user: user._id, type: 'action_type', meta: { /* context */ } });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[POST /api/route] Erreur:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
```

## Règles
- TOUJOURS dans `app/api/`, JAMAIS dans server.js
- TOUJOURS valider avec Zod
- TOUJOURS vérifier l'auth
- TOUJOURS filtrer par user dans les requêtes
- TOUJOURS try/catch avec log contextuel
- Réponses JSON : `{ success, data?, error? }`
- Messages d'erreur utilisateur en français

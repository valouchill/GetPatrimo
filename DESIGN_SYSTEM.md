# Maison Patrimo — Design System "Banque Privée de l'Immobilier"

## Philosophie

Maison Patrimo transmet le positionnement **Banque Privée de l'Immobilier** : sérieux, premium, rassurant. Chaque écran applique trois principes :

1. **Zéro Friction** — pas de répétition d'information, données extraites des docs et injectées directement.
2. **Divulgation Progressive** — pas de surcharge UI, info affichée uniquement quand nécessaire.
3. **Tolérance & Flexibilité** — guide et alerte, ne bloque jamais rigidement.

---

## Tokens

### Couleurs

| Token | Valeur | Tailwind | Usage |
|---|---|---|---|
| `primary` | `#F59E0B` | `amber-500` | **Or Brossé** — CTA majeurs, accents premium |
| `primary-hover` | `#D97706` | `amber-600` | Hover sur CTA primaires |
| `secondary` | `#064E3B` | `emerald-900` | **Émeraude Profond** — surfaces premium, succès |
| `accent` | `#10B981` | `emerald-500` | Succès, scores positifs |
| `warning` | `#F59E0B` | `amber-500` | Attention, en cours |
| `danger` | `#DC2626` | `red-600` | Erreurs, impayés |
| `info` | `#0EA5E9` | `sky-500` | Informations |
| `surface` | `#F8FAFC` | `slate-50` | **Gris Perle** — fond de page |
| `surface-elevated` | `#FFFFFF` | `white` | Cards, surfaces élevées |
| `surface-premium` | `#0F1F1A` | — | Fonds premium dark |

### Typographie

- **Serif** : `Playfair Display` → titres `<h1>`, `<h2>`, `<h3>` (autorité, prestige).
  Utiliser la classe `font-serif`.
- **Sans-serif** : `Inter` → corps, UI (clarté technique).
  Utiliser la classe `font-sans` (par défaut sur `<body>`).

⚠ **Ne JAMAIS** utiliser `style={{ fontFamily: '...' }}` inline. Toujours via classes Tailwind.

### Radius

| Token | Valeur | Usage |
|---|---|---|
| `rounded-button` | `12px` | Boutons |
| `rounded-card` | `16px` | Cards, sections |
| `rounded-modal` | `20px` | Modals, sheets |
| `rounded-pill` | `9999px` | Pills, badges |
| `rounded-input` | `10px` | Inputs |

### Shadows

| Token | Usage |
|---|---|
| `shadow-card` | Cards par défaut |
| `shadow-elevated` | Cards survolées, modals |
| `shadow-premium` | Éléments premium (mix amber + emerald) |
| `shadow-amber` | Boutons primaires |
| `shadow-emerald` | Boutons secondaires |

---

## Composants

Tous sous `/opt/doc2loc/app/components/ui/`. Import unique :

```tsx
import { Button, Card, Input, Modal, EmptyState, PageHeader } from "@/app/components/ui";
```

### `<Button>`

```tsx
<Button variant="primary" size="md" loading={false}>
  Sélectionner →
</Button>
```

**Variants** : `primary` (amber-500, défaut), `secondary` (emerald-900), `ghost`, `danger`, `premium` (gradient), `outline`.
**Sizes** : `sm` (36px), `md` (44px — touch target), `lg` (48px).
**Props** : `loading`, `fullWidth`, `iconLeft`, `iconRight`, `disabled`.

### `<Card>`

```tsx
<Card variant="elevated" padding="md">
  <CardTitle>Indice de Résilience</CardTitle>
  <CardDescription>Score sur 100 du dossier candidat</CardDescription>
  <CardFooter>
    <Button variant="outline">Détails</Button>
    <Button variant="primary">Sélectionner</Button>
  </CardFooter>
</Card>
```

**Variants** : `default`, `elevated`, `premium` (emerald dark), `dashed` (empty), `subtle`.
**Padding** : `none`, `sm`, `md`, `lg`.

### `<Input>`

```tsx
<Input
  label="Email"
  type="email"
  description="Pour les notifications"
  error={errors.email}
  iconLeft={<Mail className="h-4 w-4" />}
/>
```

`inputMode` est inféré automatiquement de `type` (tel→tel, email→email, number→numeric).

### `<Modal>`

```tsx
<Modal
  open={open}
  onClose={() => setOpen(false)}
  title="Confirmer la sélection"
  description="Cette action est définitive."
  footer={<><Button variant="outline" onClick={close}>Annuler</Button><Button>Confirmer</Button></>}
>
  ...contenu...
</Modal>
```

Z-index `200` standardisé. ESC pour fermer. Backdrop blur.

### `<Skeleton>`, `<SkeletonCard>`, `<SkeletonRow>`, `<SkeletonText>`

```tsx
{loading ? <SkeletonCard /> : <CandidatCard c={c} bien={b} ... />}
```

### `<EmptyState>`

```tsx
<EmptyState
  icon={<Building2 className="h-6 w-6" />}
  title="Aucun bien pour l'instant"
  description="Créez votre premier Sésame pour recevoir des candidats."
  action={<Button>Créer mon premier bien</Button>}
  variant="premium"
/>
```

### `<PageHeader>`, `<SectionHeader>`

```tsx
<PageHeader
  eyebrow="Mon patrimoine"
  title="Vue d'ensemble"
  description="Pilotez vos biens et candidatures."
  actions={<Button iconLeft={<Plus className="h-4 w-4" />}>Ajouter un bien</Button>}
/>
```

---

## Iconographie

**Une seule librairie** : `lucide-react`. Ne pas utiliser `@heroicons/react` (migration en cours).

```tsx
import { Crown, ShieldCheck, Sparkles } from "lucide-react";
```

Tailles standard : `h-3.5 w-3.5` (chip), `h-4 w-4` (bouton inline), `h-5 w-5` (bouton standard), `h-6 w-6` (empty state).

---

## Animations

Utiliser les animations Tailwind custom :

- `animate-fade-in` — apparition opacité (200ms)
- `animate-slide-up` — slide-in du bas (240ms)
- `animate-pulse-soft` — pulse léger (skeleton, badges live)

Pour animations plus complexes, utiliser `framer-motion` (déjà installé) avec :
- `initial={{ opacity: 0, y: 12 }}`
- `animate={{ opacity: 1, y: 0 }}`
- `transition={{ type: "spring", damping: 28, stiffness: 320 }}`

---

## Vocabulaire produit

Source : `/opt/doc2loc/lib/product-lexicon.ts`.

| Concept | Label V1 | Ne pas dire |
|---|---|---|
| Score 0-100 | **Indice de Résilience** | PatrimoScore™, Score IA, score de confiance |
| Grade ≥ 90 | **Grade S** | Souverain seul, S+ |
| Analyse anti-fraude | **Audit Forensic** | Audit IA, scan IA |
| Dossier certifié locataire | **Passeport Locatif** | passeport (minuscule), dossier |
| Lien de candidature | **Sésame** | lien public, code |
| Espace sécurisé proprio | **Coffre-Fort** | espace, dashboard sécurisé |

Le statut premium `Statut Souverain` est V2, ne pas afficher en V1.

---

## Accessibilité

- Touch targets ≥ 44×44px (size `md` de Button respecte).
- Focus rings via `focus-visible:ring-2 ring-amber-500` (intégré à `<Button>`).
- ARIA labels sur tous les boutons icon-only.
- `aria-modal`, `role="dialog"` sur tous les modals (intégré à `<Modal>`).
- Contraste WCAG AA : amber-500 sur slate-50 vérifié ≥ 4.5:1.

---

## Z-index canon

| Z-index | Usage |
|---|---|
| `0` (base) | Contenu standard |
| `10` (raised) | Tooltips inline |
| `30` (sticky) | Headers sticky |
| `40` (header) | Header global |
| `50` (dropdown) | Dropdowns, menus |
| `100` (overlay) | Backdrops |
| `200` (modal/drawer) | Modals, drawers |
| `300` (toast) | Notifications toast |

Toujours utiliser ces valeurs (pas de z-index ad-hoc).

---

## Migration des composants existants

Pour migrer un composant qui utilise `bg-orange-500`, `border-orange-` :
1. Identifier la nature du bouton/élément.
2. Remplacer par `<Button variant="primary">` (amber-500) ou classes équivalentes.
3. Tester visuellement sur 3 viewports.

Pour les pages :
1. Remplacer le header ad-hoc par `<PageHeader>`.
2. Remplacer les divs `bg-white rounded-2xl border ...` par `<Card>`.
3. Remplacer les `<input>` ad-hoc par `<Input>`.

---

*Maintenu par l'équipe produit. Pour proposer une modification, ouvrir une issue ou un PR.*

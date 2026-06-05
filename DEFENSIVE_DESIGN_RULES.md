# getpatrimo — Règles de Design Défensif (Tailwind + React)

Ces 4 règles sont **obligatoires** pour tout nouveau composant UI dans la
codebase. Elles évitent les bugs visuels classiques (explosions Safari,
chevauchements, débordements) qui ont causé les défauts de la modale
CandidateAiReport (cf. PR #40).

---

## Règle 1 — Icônes & SVG : taille fixe + flex-shrink-0

**Jamais** un composant `<Icon />` ou `<svg>` sans ces 3 classes :

```tsx
<Icon className="w-X h-X flex-shrink-0" />
```

### Pourquoi
- Safari et Webkit ont une tendance à laisser les SVG sans taille remplir
  leur conteneur (explosion visuelle).
- Dans un `<div className="flex">`, un SVG sans `flex-shrink-0` peut être
  écrasé à 0px ou s'étirer à 100% selon le contexte.

### Exemples corrects

```tsx
// ✅ Icône à taille définie + non-écrasable
<Quote className="h-8 w-8 flex-shrink-0 text-amber-500" />
<XCircle className="h-3.5 w-3.5 flex-shrink-0" />
<Sparkles className="h-4 w-4 flex-shrink-0" />

// ✅ Caractère typographique → utiliser une icône Lucide à la place
import { Quote } from 'lucide-react';
// Plutôt que <span className="text-7xl">«</span> qui chevauche le texte
```

### Exemple incorrect

```tsx
// ❌ Pas de taille fixe (peut exploser)
<Icon />
<Icon className="text-amber-500" />

// ❌ Caractère ASCII "«" en text-7xl absolutement positionné
<span className="absolute -left-2 -top-4 font-serif text-7xl">«</span>
```

---

## Règle 2 — Textes dynamiques : line-clamp ou truncate

Tous les **noms d'utilisateurs**, **adresses**, **textes générés par IA**
doivent être limités à un nombre de lignes prévisible.

### Patterns à utiliser

```tsx
// ✅ Une seule ligne — ellipsis automatique
<p className="truncate">{candidate.job}</p>

// ✅ N lignes max (h1 nom complet)
<h1 className="line-clamp-2" title={candidate.name}>
  {candidate.name}
</h1>

// ✅ Conteneur parent avec min-w-0 pour permettre le shrink
<div className="min-w-0 flex-1">
  <p className="truncate">{adresse}</p>
</div>
```

### Pourquoi

- Un nom de 40 caractères ("Valentin Jean Claud H Vettese") sans clamp
  pousse les éléments adjacents (badge score, bouton close) hors écran sur
  un laptop 13".
- Une synthèse IA de 800 caractères sans clamp explose la hauteur de la
  carte dans le stack.

### Toujours ajouter `title` quand on tronque

```tsx
<h1 className="line-clamp-2" title={candidate.name}>
  {candidate.name}
</h1>
```

Ainsi le nom complet apparaît au hover (accessibility + UX).

---

## Règle 3 — Z-Index local pour footers sticky

Les footers `sticky bottom-0` à l'intérieur d'une modale doivent utiliser
un **z-index très bas** (`z-10`, `z-20`) — JAMAIS `z-50` ou plus.

### Pourquoi

- La navigation globale de l'app est à `z-50`.
- Un footer interne à une modale (Valider/Refuser) qui aurait `z-50` ou
  plus pourrait passer **par-dessus** la nav sur certains layouts, créant
  des bugs visuels critiques.
- Le footer reste dans son contexte de stacking (la modale est déjà à
  `z-[200]` ou plus) — un z-10 local est largement suffisant.

### Exemples corrects

```tsx
// ✅ Footer sticky dans une modale (z-10 local)
<footer className="sticky bottom-0 z-10 border-t bg-white/95 backdrop-blur">
  <Button>Valider</Button>
</footer>

// ✅ Boutons d'action sticky bottom (z-20 si on a besoin de passer
//    par-dessus une barre d'historique interne, mais jamais au-delà)
<div className="sticky bottom-4 z-20 ...">
  <button>✗</button><button>✓</button>
</div>

// ✅ Modale parent (le z élevé est OK ici car c'est le wrapper global)
<motion.aside className="fixed inset-y-0 right-0 z-[201]">
  ...
</motion.aside>
```

### Exemple incorrect

```tsx
// ❌ Footer interne avec z-[100] ou z-50
<footer className="sticky bottom-0 z-50 ...">  // risque de passer par-dessus la nav
```

---

## Règle 4 — Flexbox wrap pour les cartes

Quand on aligne des cartes / stats / badges côte à côte, **toujours**
utiliser `flex-wrap` ou `grid` pour gérer les petits écrans.

### Patterns corrects

```tsx
// ✅ Grid responsive (toujours fonctionne)
<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
  {cards.map(...)}
</div>

// ✅ Flex avec wrap (pour des éléments de tailles variables)
<div className="flex flex-wrap items-center gap-2">
  <Badge />
  <Badge />
  <Badge />
</div>

// ✅ Combo flex-wrap + nowrap conditionnel
<div className="flex flex-wrap items-start gap-4 sm:flex-nowrap sm:gap-6">
  <h1 className="min-w-0 flex-1">{name}</h1>
  <div className="shrink-0">{badge}</div>
</div>
```

### Exemple incorrect

```tsx
// ❌ Flex sans wrap (sortira hors écran sur 13" laptop)
<div className="flex gap-4">
  <Card />
  <Card />
  <Card />
</div>
```

---

## Checklist avant chaque PR UI

- [ ] Toutes les icônes Lucide ont `w-X h-X flex-shrink-0`
- [ ] Aucun caractère typographique absolument positionné en text-Xxl
- [ ] Tous les noms / textes dynamiques ont `truncate` ou `line-clamp-X`
- [ ] Tous les `<h1>` / `<h2>` longs ont un `title={value}` pour le hover
- [ ] Aucun footer sticky interne n'a un z-index ≥ 50
- [ ] Toutes les rangées de cartes utilisent `grid` ou `flex-wrap`
- [ ] Min-width 0 sur les conteneurs flex qui doivent permettre le shrink
- [ ] Test sur viewport 1280×800 (laptop 13") — pas de scroll horizontal
- [ ] Test avec un nom très long ("Valentin Jean Claud H Vettese")
- [ ] Test avec une synthèse IA très longue (500+ caractères)

# Composant PatrimoTrustGauge

Composant React Luxe-Tech pour afficher le score PatrimoTrust™ avec une jauge semi-circulaire animée.

## Installation

Le composant utilise les dépendances suivantes (déjà installées dans le projet) :
- React 19.2.3
- Framer Motion 12.25.0
- Tailwind CSS 4.1.18

## Utilisation

```tsx
import PatrimoTrustGauge from "./components/PatrimoTrustGauge";

function MyComponent() {
  return (
    <PatrimoTrustGauge 
      score={85} 
      isLoading={false} 
    />
  );
}
```

## Props

| Prop | Type | Description | Défaut |
|------|------|-------------|--------|
| `score` | `number` | Score entre 0 et 100 | Requis |
| `isLoading` | `boolean` | Affiche l'état de chargement | `false` |

## Fonctionnalités

### 1. Jauge Semi-Circulaire SVG
- Arc de 180 degrés (demi-cercle)
- Piste de fond grise ardoise subtile
- Barre de progression animée avec `strokeDasharray` et `strokeDashoffset`

### 2. Couleurs Dynamiques
- **< 60** : Gradient Red/Rose (`from-red-500 to-rose-500`)
- **60-79** : Gradient Amber/Orange (`from-amber-500 to-orange-500`)
- **≥ 80** : Gradient Emerald (`from-emerald-500 to-emerald-400`)

### 3. Effet Glow
- Si score ≥ 80, ajoute une ombre portée émeraude (`drop-shadow`)
- Effet "néon luxe" pour les scores élevés

### 4. Animation
- Remplissage de la jauge en 1.5s avec courbe `easeOut`
- Compteur animé de 0 au score final en synchronisation
- Transitions fluides avec Framer Motion

### 5. Typographie
- **Score** : Police Serif (Playfair Display), très grande taille (text-7xl)
- **Label** : Police Inter, uppercase, petit texte

### 6. État de Chargement
- Animation de pulsation discrète sur la piste de fond
- Pas de chiffre affiché pendant le chargement

## Design System

- **Palette** : Navy (#0F172A), Emerald (#10B981), Slate (#F8FAFC)
- **Dimensions** : 280x280px (container)
- **Stroke Width** : 16px
- **Radius** : 132px

## Exemple

Voir `PatrimoTrustGauge.example.tsx` pour des exemples d'utilisation.

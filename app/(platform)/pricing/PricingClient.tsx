'use client';

/**
 * <PricingClient> — page publique /pricing. Mince enveloppe autour de <PricingTiers>
 * (variant "page" : plein écran + footer marketing). Le même composant <PricingTiers>
 * est réutilisé dans l'onglet « Tarifs & Offres » du dashboard (variant "embedded").
 */

import * as React from 'react';
import { PricingTiers, type PricingProperty } from './PricingTiers';

export type { PricingProperty };

export interface PricingClientProps {
  authenticated?: boolean;
  properties?: PricingProperty[];
}

export function PricingClient(props: PricingClientProps): React.ReactElement {
  return <PricingTiers variant="page" {...props} />;
}

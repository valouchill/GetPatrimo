import coreWebVitals from 'eslint-config-next/core-web-vitals';

/**
 * ESLint flat config (ESLint 9) basée sur la config officielle Next.js
 * `next/core-web-vitals`.
 *
 * Note sur `react-hooks/*` : eslint-config-next@16 embarque
 * eslint-plugin-react-hooks v6, qui inclut le *React Compiler rule set*. Ces
 * règles supposent le React Compiler activé et signalent de nombreux patterns
 * pourtant VALIDES (ex. appeler setState dans un effet de montage qui lit
 * `window`). Ce dépôt n'utilise pas le React Compiler : on désactive donc ces
 * règles spécifiques au compilateur et on conserve les règles de hooks stables
 * et utiles (`rules-of-hooks`, `exhaustive-deps`). À réévaluer si/quand on
 * adopte le React Compiler.
 */
const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'vendor/**',
      'public/**',
      'coverage/**',
      'uploads/**',
      'backups/**',
      '**/*.min.js',
    ],
  },
  ...coreWebVitals,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      // L'app rend des images dynamiques en data-URL / blob (signatures
      // manuscrites, QR codes 2FA, photos capturées, aperçus d'upload) pour
      // lesquelles next/Image est inadapté (pas d'optimisation possible sur une
      // data-URL). On désactive donc no-img-element au niveau projet.
      '@next/next/no-img-element': 'off',
    },
  },
];

export default eslintConfig;

const LOWERCASE_WORDS = new Set([
  'de', 'des', 'du', 'le', 'la', 'les', "l'", "d'", 'en', 'sur', 'sous', 'au', 'aux',
]);

export function formatAddress(address: string): string {
  if (!address) return '';
  return address
    .toLowerCase()
    .replace(/\b\w+/g, (word, index) => {
      if (index > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .replace(/^(\w)/, (c) => c.toUpperCase());
}

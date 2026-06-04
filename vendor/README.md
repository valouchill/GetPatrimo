# vendor/

## fr_2ddoc_parser (vendored)

Copie de [`betagouv/2ddoc-parser`](https://github.com/betagouv/2ddoc-parser) (v1.0.5, **MIT**).
Décode + vérifie les sceaux 2D-Doc de l'ANTS ; embarque la **TSL officielle** (liste de
confiance des certificats publics) dans `fr_2ddoc_parser/crypto/keys/tsl_signed.xml`.

**Pourquoi vendoré** : la lib épingle `python ^3.13` (l'image prod Alpine est en 3.12) ;
le vendoring évite la contrainte de version, embarque la TSL et supprime une dépendance
réseau au build. Utilisé par `scripts/verify_2ddoc.py` (Module C).

**Rafraîchir** : re-copier `src/fr_2ddoc_parser` depuis l'upstream (la TSL évolue quand
les certificats ANTS tournent).

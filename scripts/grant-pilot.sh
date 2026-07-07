#!/usr/bin/env bash
# grant-pilot.sh — Équipe un compte pilote B2B : pose managed=true, tier>=PREMIUM
# et AJOUTE des audits (défaut +10) sur les biens du compte.
#
# Usage (depuis le VPS, à la racine du repo) :
#   ./scripts/grant-pilot.sh proprietaire@agence.fr                # dry-run, tous ses biens
#   ./scripts/grant-pilot.sh proprietaire@agence.fr --audits 20    # dry-run, +20 audits
#   ./scripts/grant-pilot.sh proprietaire@agence.fr --property 66..abc --apply
#
# DRY-RUN PAR DÉFAUT : rien n'est écrit sans --apply.
# Lit MONGO_URI dans /opt/doc2loc/.env et exécute via `docker exec mongodb mongosh`
# (même canal que scripts/mongo-backup.sh — aucune dépendance node côté hôte).
set -euo pipefail

EMAIL="${1:-}"
AUDITS=10
PROPERTY_ID=""
APPLY=0
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --audits) AUDITS="${2:?}"; shift 2 ;;
    --property) PROPERTY_ID="${2:?}"; shift 2 ;;
    --apply) APPLY=1; shift ;;
    *) echo "option inconnue: $1" >&2; exit 1 ;;
  esac
done

# Garde-fous anti-injection (les valeurs sont interpolées dans du JS mongosh).
[[ "$EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || { echo "email invalide" >&2; exit 1; }
[[ "$AUDITS" =~ ^[0-9]{1,4}$ ]] || { echo "--audits doit être un entier" >&2; exit 1; }
[[ -z "$PROPERTY_ID" || "$PROPERTY_ID" =~ ^[a-f0-9]{24}$ ]] || { echo "--property doit être un ObjectId hex(24)" >&2; exit 1; }

URI=$(grep -E '^MONGO_URI=' /opt/doc2loc/.env | cut -d= -f2-)
[[ -n "$URI" ]] || { echo "MONGO_URI introuvable dans /opt/doc2loc/.env" >&2; exit 1; }

docker exec -i mongodb mongosh --quiet "$URI" <<EOF
const EMAIL = '$EMAIL';
const AUDITS = $AUDITS;
const PROPERTY_ID = '$PROPERTY_ID';
const APPLY = $APPLY === 1;
const ORDER = ['FREE', 'ESSENTIAL', 'PREMIUM', 'MAX'];
const higher = (a, b) => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);

const user = db.users.findOne({ email: EMAIL });
if (!user) { print('❌ Aucun compte: ' + EMAIL); quit(1); }
print((APPLY ? '🚀 APPLY' : '🔎 DRY-RUN') + ' — pilote B2B pour ' + EMAIL + ' (+' + AUDITS + ' audits/bien)');

const filter = { user: user._id, archived: { \$ne: true } };
if (PROPERTY_ID) filter._id = ObjectId(PROPERTY_ID);
const props = db.properties.find(filter).toArray();
if (!props.length) { print('❌ Aucun bien correspondant (vérifier --property / le compte).'); quit(1); }

props.forEach(function (p) {
  const before = { tier: p.tier || 'FREE', quota: p.dossiersQuota || 0, managed: !!p.managed };
  const after = {
    tier: higher(before.tier, 'PREMIUM'),
    quota: before.quota + AUDITS,
    managed: true,
  };
  print('• ' + p._id + ' (' + (p.address || p.name || 'sans nom') + ')');
  print('    avant: ' + JSON.stringify(before) + '  →  après: ' + JSON.stringify(after));
  if (APPLY) {
    db.properties.updateOne(
      { _id: p._id },
      { \$set: { tier: after.tier, managed: true }, \$inc: { dossiersQuota: AUDITS } },
    );
    print('    ✅ appliqué');
  }
});
if (!APPLY) print('ℹ️  Rien écrit. Relancer avec --apply pour exécuter.');
EOF

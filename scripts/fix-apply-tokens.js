/**
 * Script de diagnostic et réparation des applyTokens
 * 
 * Ce script identifie les biens avec des tokens invalides ou manquants
 * et les régénère si nécessaire.
 * 
 * Usage: node scripts/fix-apply-tokens.js [--fix]
 * 
 * Options:
 *   --fix    Régénère les tokens invalides (par défaut: mode diagnostic uniquement)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');

const MONGO_URI = process.env.MONGO_URI;
const FIX_MODE = process.argv.includes('--fix');

if (!MONGO_URI) {
  console.error('❌ MONGO_URI manquant dans .env');
  process.exit(1);
}

// Schéma simplifié pour le script
const PropertySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  address: String,
  applyToken: String,
  createdAt: Date
}, { collection: 'properties', strict: false });

const Property = mongoose.model('Property', PropertySchema);

async function main() {
  console.log('🔍 Connexion à MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connecté\n');

  // Token spécifique recherché (celui du user)
  const searchToken = '402e29eab687c7e5480c8b262b99c709';
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📋 DIAGNOSTIC DES APPLY TOKENS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Cherche le token exact
  console.log(`🔎 Recherche du token exact: ${searchToken}`);
  let exactMatch = await Property.findOne({ applyToken: searchToken });
  
  if (exactMatch) {
    console.log(`✅ Token trouvé ! Bien: "${exactMatch.name}" (ID: ${exactMatch._id})`);
  } else {
    console.log('❌ Token non trouvé en base');
    
    // 2. Cherche un token qui commence par ce préfixe (le token a peut-être été tronqué)
    console.log(`\n🔎 Recherche d'un token commençant par: ${searchToken}...`);
    const prefixMatch = await Property.findOne({ 
      applyToken: { $regex: `^${searchToken}` } 
    });
    
    if (prefixMatch) {
      console.log(`✅ Token avec préfixe trouvé !`);
      console.log(`   Bien: "${prefixMatch.name}" (ID: ${prefixMatch._id})`);
      console.log(`   Token complet: ${prefixMatch.applyToken}`);
      console.log(`   Longueur: ${prefixMatch.applyToken.length} caractères`);
    } else {
      console.log('❌ Aucun token avec ce préfixe');
    }
  }

  // 3. Liste tous les biens avec leur token
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 LISTE DES BIENS ET LEURS TOKENS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const allProps = await Property.find({}).select('name address applyToken createdAt').sort({ createdAt: -1 }).limit(20);
  
  let invalidTokens = 0;
  let missingTokens = 0;

  for (const p of allProps) {
    const token = p.applyToken || '';
    const tokenLen = token.length;
    let status = '✅';
    let issue = '';

    if (!token) {
      status = '🔴';
      issue = 'MANQUANT';
      missingTokens++;
    } else if (tokenLen !== 64) {
      status = '🟠';
      issue = `LONGUEUR INVALIDE (${tokenLen}/64)`;
      invalidTokens++;
    }

    console.log(`${status} ${p.name || 'Sans nom'}`);
    console.log(`   ID: ${p._id}`);
    console.log(`   Token: ${token ? token.slice(0, 16) + '...' + token.slice(-8) : 'AUCUN'} (${tokenLen} chars)`);
    if (issue) console.log(`   ⚠️  ${issue}`);
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📈 RÉSUMÉ: ${allProps.length} biens analysés`);
  console.log(`   - Tokens valides: ${allProps.length - invalidTokens - missingTokens}`);
  console.log(`   - Tokens invalides: ${invalidTokens}`);
  console.log(`   - Tokens manquants: ${missingTokens}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Mode réparation
  if (FIX_MODE && (invalidTokens > 0 || missingTokens > 0)) {
    console.log('🔧 MODE RÉPARATION ACTIVÉ\n');
    
    const propsToFix = await Property.find({
      $or: [
        { applyToken: { $exists: false } },
        { applyToken: '' },
        { applyToken: null },
        // Tokens avec longueur != 64 caractères
      ]
    });

    // Aussi récupérer ceux avec mauvaise longueur
    const allForCheck = await Property.find({});
    const badLengthProps = allForCheck.filter(p => p.applyToken && p.applyToken.length !== 64);

    const toFix = [...propsToFix, ...badLengthProps];

    for (const p of toFix) {
      const oldToken = p.applyToken || 'AUCUN';
      const newToken = crypto.randomBytes(32).toString('hex');
      
      console.log(`🔄 Réparation: ${p.name || 'Sans nom'} (${p._id})`);
      console.log(`   Ancien token: ${oldToken.slice(0, 16)}... (${oldToken.length} chars)`);
      console.log(`   Nouveau token: ${newToken.slice(0, 16)}... (64 chars)`);
      
      await Property.updateOne({ _id: p._id }, { $set: { applyToken: newToken } });
      console.log('   ✅ Corrigé\n');
    }

    console.log(`\n✅ ${toFix.length} bien(s) réparé(s)`);
  } else if (!FIX_MODE && (invalidTokens > 0 || missingTokens > 0)) {
    console.log('💡 Pour réparer les tokens, exécutez:');
    console.log('   node scripts/fix-apply-tokens.js --fix\n');
  }

  await mongoose.disconnect();
  console.log('🔌 Déconnexion MongoDB');
}

main().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});

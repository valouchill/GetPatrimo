/**
 * Backfill script: Re-analyze documents missing aiAnalysis data
 *
 * This script finds all Application documents where aiAnalysis is empty,
 * re-runs the AI extraction via the analyze-document-v2 endpoint,
 * and saves the results back to the database.
 *
 * Usage: node scripts/backfill-aiAnalysis.js
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('../models/Application');
const { deriveApplicationFinancialProfile } = require('../src/utils/financialExtraction');
const { getDocumentCertificationDecision } = require('../src/utils/documentCertificationRules');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:password123@mongodb:27017/doc2loc?authSource=admin';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const UPLOADS_DIR = '/opt/doc2loc';

async function analyzeFile(filePath, expectedCategory) {
  const fullPath = path.join(UPLOADS_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  [SKIP] File not found: ${fullPath}`);
    return null;
  }

  const formData = new FormData();
  const fileBuffer = fs.readFileSync(fullPath);
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const mimeType = ext === '.pdf' ? 'application/pdf' : `image/${ext.replace('.', '')}`;

  formData.append('file', new Blob([fileBuffer], { type: mimeType }), fileName);
  if (expectedCategory) {
    formData.append('expectedCategory', expectedCategory);
  }

  try {
    const response = await fetch(`${BASE_URL}/api/analyze-document-v2`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.log(`  [ERROR] API returned ${response.status}: ${await response.text().catch(() => '')}`);
      return null;
    }

    const result = await response.json();
    return result;
  } catch (err) {
    console.log(`  [ERROR] API call failed: ${err.message}`);
    return null;
  }
}

function buildAiAnalysis(analysis) {
  if (!analysis) return null;
  return {
    documentType: analysis.documentType || analysis.document_metadata?.type,
    ownerName: analysis.ownerName || analysis.document_metadata?.owner_name,
    recommendations: analysis.recommendations || [],
    fraudIndicators: analysis.fraudIndicators,
    fraudAudit: analysis.fraudAudit,
    document_metadata: analysis.document_metadata,
    financial_data: analysis.financial_data,
    trust_and_security: analysis.trust_and_security,
    extractedData: analysis.extractedData,
  };
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  const Application = mongoose.model('Application');

  const apps = await Application.find({ 'documents.0': { $exists: true } });
  console.log(`Found ${apps.length} applications with documents.\n`);

  let totalUpdated = 0;
  let totalDocs = 0;
  let totalAnalyzed = 0;

  for (const app of apps) {
    const docs = app.documents || [];
    const docsNeedingAnalysis = docs.filter(d => {
      const ai = d.aiAnalysis;
      const hasData = ai && (ai.financial_data || ai.financialData || ai.document_metadata || ai.documentMetadata);
      return !hasData && d.fileUrl;
    });

    if (docsNeedingAnalysis.length === 0) continue;

    console.log(`App ${app._id} (${app.profile?.firstName || ''} ${app.profile?.lastName || ''}):`);
    console.log(`  ${docs.length} docs total, ${docsNeedingAnalysis.length} need analysis`);

    let updated = false;

    for (const doc of docsNeedingAnalysis) {
      totalDocs++;
      console.log(`  Analyzing: ${doc.fileName} (${doc.type || 'unknown'}) [${doc.status}]`);

      const categoryMap = {
        'BULLETIN_SALAIRE': 'income',
        'AVIS_IMPOSITION': 'income',
        'CONTRAT_TRAVAIL': 'income',
        'ATTESTATION_BOURSE': 'income',
        'AIDE_LOGEMENT': 'income',
        'PENSION': 'income',
        'CARTE_IDENTITE': 'identity',
        'JUSTIFICATIF_DOMICILE': 'address',
      };
      const expectedCategory = categoryMap[doc.type] || doc.category || 'income';

      const analysis = await analyzeFile(doc.fileUrl, expectedCategory);
      if (analysis) {
        totalAnalyzed++;
        const aiAnalysis = buildAiAnalysis(analysis);

        // Update the document in the array
        const docIndex = app.documents.findIndex(d => d.id === doc.id || d._id?.toString() === doc._id?.toString());
        if (docIndex >= 0) {
          app.documents[docIndex].aiAnalysis = aiAnalysis;

          // Update status if needed based on certification rules
          if (analysis.document_metadata && doc.status === 'pending') {
            const decision = getDocumentCertificationDecision({
              fraudScore: analysis.trust_and_security?.fraud_score ?? 0,
              needsHumanReview: analysis.trust_and_security?.needs_human_review ?? false,
              partialExtraction: analysis.trust_and_security?.partial_extraction ?? false,
              isIllegible: false,
              aiDocumentType: analysis.document_metadata?.type,
              expectedCategory,
            });
            if (decision?.status) {
              app.documents[docIndex].status = decision.status;
              console.log(`    Status updated: ${doc.status} → ${decision.status}`);
            }
          }

          const income = analysis.financial_data?.monthly_net_income;
          console.log(`    ✓ Analysis saved. Income extracted: ${income || 'N/A'}`);
          updated = true;
        }
      }

      // Rate limit: wait 2 seconds between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (updated) {
      // Re-derive financial profile
      const derivedFinancial = deriveApplicationFinancialProfile({
        application: app.toObject(),
        fallbackIncome: app.financialSummary?.totalMonthlyIncome || 0,
      });

      app.financialSummary.totalMonthlyIncome = derivedFinancial.totalMonthlyIncome;
      app.financialSummary.certifiedIncome = derivedFinancial.certifiedIncome;
      app.financialSummary.incomeSource = derivedFinancial.incomeSource;

      app.markModified('documents');
      app.markModified('financialSummary');
      await app.save();
      totalUpdated++;
      console.log(`  ✓ Saved. Monthly income: ${derivedFinancial.totalMonthlyIncome}€ (${derivedFinancial.incomeSource})\n`);
    }
  }

  console.log('─── Summary ───');
  console.log(`Applications updated: ${totalUpdated}`);
  console.log(`Documents processed: ${totalDocs}`);
  console.log(`Successfully analyzed: ${totalAnalyzed}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

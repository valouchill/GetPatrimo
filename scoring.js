function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

function scoreGrade(total){
  if(total >= 85) return 'A';
  if(total >= 70) return 'B';
  if(total >= 55) return 'C';
  if(total >= 40) return 'D';
  return 'E';
}

function computeCandidatureScoreV1({ cand, property }){
  const breakdown = [];
  const flags = [];

  const rent = Number(property?.rentAmount || 0) || 0;
  const charges = Number(property?.chargesAmount || 0) || 0;
  const monthlyCost = Math.max(1, rent + charges);

  const income = Number(cand?.monthlyNetIncome || 0) || 0;
  const ratio = income > 0 ? (income / monthlyCost) : 0;

  let total = 30;
  breakdown.push({ key:'base', label:'Base', points: 30, detail:'Point de départ' });

  if(income <= 0){
    flags.push('income_missing');
    breakdown.push({ key:'ratio', label:'Revenus', points: -10, detail:'Revenus non renseignés' });
    total += -10;
  } else if(ratio >= 3.5){
    breakdown.push({ key:'ratio', label:'Ratio loyer/revenus', points: 40, detail:`Ratio ${ratio.toFixed(2)} (excellent)` });
    total += 40;
  } else if(ratio >= 3.0){
    breakdown.push({ key:'ratio', label:'Ratio loyer/revenus', points: 30, detail:`Ratio ${ratio.toFixed(2)} (bon)` });
    total += 30;
  } else if(ratio >= 2.5){
    breakdown.push({ key:'ratio', label:'Ratio loyer/revenus', points: 15, detail:`Ratio ${ratio.toFixed(2)} (ok)` });
    total += 15;
  } else if(ratio >= 2.0){
    breakdown.push({ key:'ratio', label:'Ratio loyer/revenus', points: 5, detail:`Ratio ${ratio.toFixed(2)} (fragile)` });
    total += 5;
    flags.push('ratio_low');
  } else {
    breakdown.push({ key:'ratio', label:'Ratio loyer/revenus', points: -20, detail:`Ratio ${ratio.toFixed(2)} (risque)` });
    total += -20;
    flags.push('ratio_very_low');
  }

  const ct = String(cand?.contractType || '').toUpperCase();
  if(ct === 'CDI'){ total += 25; breakdown.push({ key:'contract', label:'Contrat', points: 25, detail:'CDI' }); }
  else if(ct === 'CDD'){ total += 10; breakdown.push({ key:'contract', label:'Contrat', points: 10, detail:'CDD' }); }
  else if(ct === 'FREELANCE'){ total += 8; breakdown.push({ key:'contract', label:'Contrat', points: 8, detail:'Indépendant / Freelance' }); }
  else if(ct === 'ETUDIANT'){ total += 5; breakdown.push({ key:'contract', label:'Contrat', points: 5, detail:'Étudiant' }); flags.push('student'); }
  else if(ct === 'RETRAITE'){ total += 10; breakdown.push({ key:'contract', label:'Contrat', points: 10, detail:'Retraité' }); }
  else if(ct){ total += 5; breakdown.push({ key:'contract', label:'Contrat', points: 5, detail:'Autre' }); }
  else { flags.push('contract_missing'); breakdown.push({ key:'contract', label:'Contrat', points: 0, detail:'Non renseigné' }); }

  const hasG = !!cand?.hasGuarantor;
  const gt = String(cand?.guarantorType || '').toUpperCase();
  if(hasG && gt === 'VISALE'){ total += 15; breakdown.push({ key:'guarantor', label:'Garant', points: 15, detail:'Visale' }); }
  else if(hasG){ total += 10; breakdown.push({ key:'guarantor', label:'Garant', points: 10, detail:'Présent' }); }
  else {
    breakdown.push({ key:'guarantor', label:'Garant', points: 0, detail:'Aucun' });
    if(ratio > 0 && ratio < 3.0) flags.push('no_guarantor_low_ratio');
  }

  const docsCount = Array.isArray(cand?.docs) ? cand.docs.length : 0;
  if(docsCount >= 8){ total += 10; breakdown.push({ key:'docs', label:'Dossier', points: 10, detail:`${docsCount} documents` }); }
  else if(docsCount >= 5){ total += 5; breakdown.push({ key:'docs', label:'Dossier', points: 5, detail:`${docsCount} documents` }); }
  else { breakdown.push({ key:'docs', label:'Dossier', points: 0, detail:`${docsCount} document(s)` }); flags.push('docs_few'); }

  total = clamp(total, 0, 100);
  const grade = scoreGrade(total);

  return { version:'v1', total, grade, ratio: Number.isFinite(ratio)?Number(ratio.toFixed(4)):0, breakdown, flags };
}

function _normName(x){
  return String(x||"").toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function docsChecklistV1({ cand }){
  const docs = Array.isArray(cand?.docs) ? cand.docs : [];
  const names = docs.map(d => _normName(d.originalName || d.filename || ""));

  const has = (rxs) => names.some(n => rxs.some(rx => rx.test(n)));
  const count = (rxs) => names.filter(n => rxs.some(rx => rx.test(n))).length;

  const present = {
    id: has([/carte.*identite/, /cni/, /piece.*identite/, /passeport/]),
    payslips: count([/bulletin.*salaire/, /fiche.*paye/, /bulletin.*paye/, /payslip/]),
    tax: has([/avis.*impot/, /avis.*imposition/, /impot.*revenu/]),
    contract: has([/contrat.*travail/, /contrat.*cdi/, /contrat.*cdd/, /attestation.*employeur/]),
    rib: has([/\brib\b/, /releve.*identite.*bancaire/, /iban/]),
    guarantor: has([/garant/, /caution/, /visale/]),
    student: has([/carte.*etudiant/, /certificat.*scolarite/, /inscription.*universite/])
  };

  const ct = String(cand?.contractType || '').toUpperCase();
  const hasGuarantor = !!cand?.hasGuarantor;

  const required = [
    { key:'id', label:"Pièce d'identité" },
    { key:'rib', label:"RIB" },
    { key:'tax', label:"Avis d'imposition" },
  ];
  if(['CDI','CDD','FREELANCE','AUTRE'].includes(ct)) required.push({ key:'payslips', label:"Bulletins de salaire (≥2)" });
  if(['CDI','CDD'].includes(ct)) required.push({ key:'contract', label:"Contrat / attestation employeur" });
  if(ct === 'ETUDIANT') required.push({ key:'student', label:"Justificatif étudiant" });
  if(hasGuarantor) required.push({ key:'guarantor', label:"Documents garant / Visale" });

  const missing = required
    .filter(r => (r.key==='payslips' ? (present.payslips < 2) : !present[r.key]))
    .map(r => r.label);

  const flags = [];
  if(!present.id) flags.push('missing_id');
  if(!present.rib) flags.push('missing_rib');
  if(!present.tax) flags.push('missing_tax');
  if(['CDI','CDD','FREELANCE','AUTRE'].includes(ct) && (present.payslips < 2)) flags.push('missing_payslips');
  if(['CDI','CDD'].includes(ct) && !present.contract) flags.push('missing_contract');
  if(ct === 'ETUDIANT' && !present.student) flags.push('missing_student_proof');
  if(hasGuarantor && !present.guarantor) flags.push('missing_guarantor_docs');

  let pts = 0;
  pts += present.id ? 6 : -8;
  pts += present.rib ? 3 : -5;
  pts += present.tax ? 6 : -7;
  if(['CDI','CDD','FREELANCE','AUTRE'].includes(ct)) pts += (present.payslips >= 2) ? 8 : -10;
  if(['CDI','CDD'].includes(ct)) pts += present.contract ? 4 : -6;
  if(ct === 'ETUDIANT') pts += present.student ? 4 : -6;
  if(hasGuarantor) pts += present.guarantor ? 5 : -8;

  const detail = missing.length ? ("Manquants: " + missing.join(", ")) : "Dossier complet (règles V1)";
  return { present, missing, flags, points: pts, detail };
}

function computeCandidatureScoreV1PlusDocs({ cand, property }){
  const base = computeCandidatureScoreV1({ cand, property });
  const dc = docsChecklistV1({ cand });

  base.breakdown = Array.isArray(base.breakdown) ? base.breakdown : [];
  base.flags = Array.isArray(base.flags) ? base.flags : [];

  base.breakdown.push({ key:'docs_check', label:'Checklist documents', points: dc.points, detail: dc.detail });
  base.flags = Array.from(new Set([...base.flags, ...(dc.flags||[])]));
  base.total = clamp((Number(base.total)||0) + (Number(dc.points)||0), 0, 100);
  base.grade = scoreGrade(base.total);
  return base;
}

module.exports = { computeCandidatureScoreV1PlusDocs, docsChecklistV1 };

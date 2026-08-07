const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseStatement,
  parseCsvStatement,
  parseOfxStatement,
  matchTransactions,
  _internals,
} = require('../src/services/bankReconciliationService');

describe('parsing des relevés bancaires', () => {
  it('lit un CSV français à colonnes Débit/Crédit et ne garde que les encaissements', () => {
    const csv = [
      'Date;Libellé;Débit;Crédit',
      '05/03/2026;VIR SEPA M DUPONT LOYER MARS;;800,00',
      '06/03/2026;CB SUPERMARCHE;45,20;',
      '07/03/2026;VIR RECU MARTIN;;650,00',
    ].join('\n');
    const tx = parseCsvStatement(csv);
    assert.equal(tx.length, 2);
    assert.equal(tx[0].amount, 800);
    assert.match(tx[0].label, /DUPONT/);
  });

  it('lit un CSV à colonne Montant signée (séparateur virgule)', () => {
    const csv = 'date,description,montant\n2026-03-05,Virement Dupont,800.00\n2026-03-06,Achat,-20.00';
    const tx = parseCsvStatement(csv);
    assert.equal(tx.length, 1);
    assert.equal(tx[0].amount, 800);
  });

  it('lit un fichier OFX', () => {
    const ofx = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
      <STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260305<TRNAMT>800.00<NAME>VIR DUPONT<MEMO>LOYER</STMTTRN>
      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260306<TRNAMT>-45.20<NAME>CB</STMTTRN>
      </BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const tx = parseOfxStatement(ofx);
    assert.equal(tx.length, 1);
    assert.equal(tx[0].amount, 800);
    assert.match(tx[0].label, /DUPONT/);
  });

  it('détecte automatiquement le format', () => {
    assert.equal(parseStatement('<OFX><STMTTRN><DTPOSTED>20260305<TRNAMT>10.00</STMTTRN></OFX>', 'x.ofx').length, 1);
    assert.equal(parseStatement('Date;Libellé;Montant\n05/03/2026;Test;10,00', 'x.csv').length, 1);
  });

  it('ne casse pas sur un fichier vide ou illisible', () => {
    assert.deepEqual(parseStatement('', 'x.csv'), []);
    assert.deepEqual(parseStatement('n’importe quoi', 'x.csv'), []);
  });

  it('normalise les montants FR et EN', () => {
    const { parseAmount } = _internals;
    assert.equal(parseAmount('1 234,56'), 1234.56);
    assert.equal(parseAmount('1,234.56'), 1234.56);
    assert.equal(parseAmount('800,00 €'), 800);
    assert.ok(Number.isNaN(parseAmount('')));
  });
});

describe('moteur de rapprochement', () => {
  const expected = [
    { paymentId: 'p1', tenantName: 'Jean Dupont', amount: 800, dueDate: new Date(2026, 2, 5), period: 'mars 2026' },
    { paymentId: 'p2', tenantName: 'Sophie Martin', amount: 650, dueDate: new Date(2026, 2, 5), period: 'mars 2026' },
  ];

  it('associe un virement au bon loyer avec une confiance élevée', () => {
    const tx = [{ date: new Date(2026, 2, 5), amount: 800, label: 'VIR SEPA M DUPONT LOYER MARS' }];
    const { proposals } = matchTransactions(tx, expected);
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].paymentId, 'p1');
    assert.equal(proposals[0].confidence, 'HIGH');
  });

  it('ne propose JAMAIS un rapprochement si le montant ne correspond pas', () => {
    const tx = [{ date: new Date(2026, 2, 5), amount: 120, label: 'VIR DUPONT' }];
    const { proposals } = matchTransactions(tx, expected);
    assert.equal(proposals.length, 0);
  });

  it('n’associe jamais deux fois la même transaction ni le même loyer', () => {
    const tx = [
      { date: new Date(2026, 2, 5), amount: 800, label: 'VIR DUPONT' },
      { date: new Date(2026, 2, 6), amount: 800, label: 'VIR DUPONT BIS' },
    ];
    const { proposals } = matchTransactions(tx, expected);
    assert.equal(proposals.length, 1); // un seul loyer de 800 attendu
  });

  it('un montant SEUL ne suffit jamais : il faut un second signal', () => {
    // 795 € ≈ 800 € (dans la tolérance) mais libellé anonyme → pas de proposition :
    // on préfère ne rien proposer plutôt qu'un faux rapprochement.
    const anonymous = matchTransactions(
      [{ date: new Date(2026, 2, 5), amount: 795, label: 'VIREMENT' }],
      expected,
    );
    assert.equal(anonymous.proposals.length, 0);

    // Même montant approchant + nom du locataire → proposé, mais « à vérifier ».
    const named = matchTransactions(
      [{ date: new Date(2026, 2, 5), amount: 795, label: 'VIR DUPONT' }],
      expected,
    );
    assert.equal(named.proposals.length, 1);
    assert.equal(named.proposals[0].confidence, 'MEDIUM');
  });

  it('écarte un montant hors tolérance (> 2 %)', () => {
    const tx = [{ date: new Date(2026, 2, 5), amount: 780, label: 'VIR DUPONT LOYER' }];
    assert.equal(matchTransactions(tx, expected).proposals.length, 0);
  });

  it('compte les transactions non rapprochées', () => {
    const tx = [
      { date: new Date(2026, 2, 5), amount: 800, label: 'VIR DUPONT' },
      { date: new Date(2026, 2, 8), amount: 42, label: 'REMBOURSEMENT' },
    ];
    const r = matchTransactions(tx, expected);
    assert.equal(r.unmatchedCount, 1);
    assert.equal(r.parsedCount, 2);
  });

  it('gère les accents et la casse dans les noms', () => {
    const tx = [{ date: new Date(2026, 2, 5), amount: 650, label: 'vir sophie MARTIN loyer' }];
    const { proposals } = matchTransactions(tx, expected);
    assert.equal(proposals[0].paymentId, 'p2');
    assert.ok(proposals[0].reasons.includes('nom du locataire'));
  });
});

describe('politique de relance unifiée', () => {
  const { REMINDER_TEMPLATES, fillReminderTemplate } = require('../src/templates/rentReminders');

  it('expose les 4 niveaux d’escalade', () => {
    assert.deepEqual(Object.keys(REMINDER_TEMPLATES), [
      'friendly', 'formal', 'formal_notice', 'critical_alert',
    ]);
  });

  it('substitue toutes les variables du template', () => {
    const r = fillReminderTemplate('formal', {
      prenom: 'Bob', nom: 'L', adresse: '1 rue X', mois: 'mars',
      montant: '800 €', jours_retard: '16', date_rappel: '01/03/2026',
    });
    assert.ok(!/\{(prenom|montant|adresse|mois|jours_retard)\}/.test(r.body));
    assert.match(r.subject, /mars/);
  });

  it('le cron et l’API partagent la même source de templates', () => {
    const fs = require('fs');
    const path = require('path');
    const cron = fs.readFileSync(path.join(__dirname, '..', 'src', 'cron', 'monthlyPayments.js'), 'utf8');
    // le cron ne doit plus pousser 'EMAIL' (ce qui cassait l'escalade)
    assert.ok(!cron.includes("type: 'EMAIL'"));
    assert.match(cron, /require\('\.\.\/templates\/rentReminders'\)/);
    // seuils alignés sur l'API (5/15/30/45) + UNPAID désormais écrit
    assert.match(cron, /daysLate >= 45/);
    assert.match(cron, /'UNPAID'/);
  });
});

describe('correctifs de revue adversariale (lots 2-4)', () => {
  it('F1 — un relevé OFX hostile ne bloque plus l’event loop (DoS mesuré à 208 s)', () => {
    // 2 Mo de <STMTTRN> jamais fermés : l'ancienne regex lazy re-scannait la fin
    // du fichier depuis chaque occurrence.
    const hostile = '<OFX>' + '<STMTTRN><TRNAMT>1.00'.repeat(90000);
    const t0 = Date.now();
    const rows = parseStatement(hostile, 'hostile.ofx');
    const elapsed = Date.now() - t0;
    assert.equal(rows.length, 0);
    assert.ok(elapsed < 1000, `parsing trop lent : ${elapsed}ms`);
  });

  it('F1 — le nombre de transactions est borné', () => {
    const { MAX_TRANSACTIONS } = require('../src/services/bankReconciliationService');
    const huge =
      'Date;Libellé;Montant\n' +
      Array.from({ length: MAX_TRANSACTIONS + 5000 }, () => '05/03/2026;VIR;10,00').join('\n');
    assert.equal(parseStatement(huge, 'x.csv').length, MAX_TRANSACTIONS);
  });

  it('F2 — le montant de la quittance est borné au montant dû côté serveur', () => {
    const fs = require('fs');
    const path = require('path');
    const route = fs.readFileSync(
      path.join(__dirname, '..', 'app/api/payments/reconcile/route.ts'),
      'utf8',
    );
    // sans ce clamp, un client pouvait faire imprimer « reçu 999999 € » sur la quittance
    assert.match(route, /Math\.min\(claimed, due\)/);
  });

  it('F7 — une confirmation rejouée ne renvoie pas une seconde quittance', () => {
    const fs = require('fs');
    const path = require('path');
    const route = fs.readFileSync(
      path.join(__dirname, '..', 'app/api/payments/reconcile/route.ts'),
      'utf8',
    );
    assert.match(route, /alreadyConfirmed/);
    assert.match(route, /payment\.status === 'CONFIRMED' && payment\.receiptSentAt/);
  });

  it('F5/F6 — cron quotidien et paiements partiels préservés', () => {
    const fs = require('fs');
    const path = require('path');
    const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    // seuils J+5/15/30/45 → passage quotidien obligatoire
    assert.match(server, /cron\.schedule\('0 9 \* \* \*', safeCron\('late-reminders'/);

    const cron = fs.readFileSync(
      path.join(__dirname, '..', 'src/cron/monthlyPayments.js'),
      'utf8',
    );
    assert.match(cron, /status === 'PARTIAL'\s*\?\s*'PARTIAL'/s); // statut préservé
    assert.match(cron, /totalTTC \|\| 0\) - Number\(payment\.amounts\?\.paidAmount/); // solde réclamé
  });
});

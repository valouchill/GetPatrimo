/**
 * bankReconciliationService — rapprochement « assisté » des loyers.
 *
 * Le bailleur importe le relevé de son compte (CSV ou OFX exporté depuis sa
 * banque) ; le moteur propose « ce virement = loyer de mars de M. Dupont »,
 * il valide en 1 clic → quittance envoyée automatiquement.
 *
 * Architecture volontairement découplée de la SOURCE des transactions :
 * `matchTransactions()` ne connaît que des objets normalisés
 * {date, amount, label}. Brancher plus tard une agrégation DSP2
 * (Bridge/Powens) = écrire un nouvel adaptateur, sans toucher au matching.
 */

/** Bornes de sûreté : un relevé mensuel réaliste tient largement dedans. */
const MAX_TRANSACTIONS = 5000;
const MAX_LINES = 20000;

/** Normalise un montant FR/EN ("1 234,56", "-1,234.56", "1234.56") → Number. */
function parseAmount(raw) {
  if (typeof raw === 'number') return raw;
  let s = String(raw || '').trim().replace(/\s| |€|EUR/gi, '');
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Parse une date FR (JJ/MM/AAAA), ISO, ou OFX (AAAAMMJJ). */
function parseDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  let m = /^(\d{2})[/.-](\d{2})[/.-](\d{4})$/.exec(s);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Découpe une ligne CSV en respectant les guillemets. */
function splitCsvLine(line, sep) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i += 1; }
      else inQuotes = !inQuotes;
    } else if (c === sep && !inQuotes) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim().replace(/^"|"$/g, ''));
}

/**
 * Parse un relevé CSV (formats banques FR : colonnes libellées librement).
 * Détecte le séparateur, l'en-tête, et les colonnes date/libellé/montant
 * (y compris le cas « Débit » / « Crédit » en deux colonnes).
 * @returns {Array<{date: Date, amount: number, label: string}>} crédits uniquement
 */
function parseCsvStatement(content) {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_LINES); // borne anti-DoS
  if (!lines.length) return [];

  const sep = [';', ',', '\t']
    .map((c) => ({ c, n: (lines[0].match(new RegExp(`\\${c}`, 'g')) || []).length }))
    .sort((a, b) => b.n - a.n)[0].c;

  const header = splitCsvLine(lines[0], sep).map((h) => h.toLowerCase());
  const find = (...keys) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const iDate = find('date');
  const iLabel = find('libell', 'label', 'description', 'motif', 'nature');
  const iAmount = find('montant', 'amount');
  const iCredit = find('crédit', 'credit');
  const iDebit = find('débit', 'debit');
  const hasHeader = iDate !== -1 || iAmount !== -1 || iCredit !== -1;

  const rows = [];
  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const cols = splitCsvLine(line, sep);
    if (cols.length < 2) continue;

    const date = parseDate(hasHeader && iDate !== -1 ? cols[iDate] : cols[0]);
    const label = String(
      hasHeader && iLabel !== -1 ? cols[iLabel] : cols.slice(1, -1).join(' '),
    ).trim();

    let amount = NaN;
    if (hasHeader && iCredit !== -1) {
      const credit = parseAmount(cols[iCredit]);
      const debit = iDebit !== -1 ? parseAmount(cols[iDebit]) : NaN;
      amount = Number.isFinite(credit) && credit !== 0 ? Math.abs(credit)
        : Number.isFinite(debit) && debit !== 0 ? -Math.abs(debit) : NaN;
    } else {
      amount = parseAmount(hasHeader && iAmount !== -1 ? cols[iAmount] : cols[cols.length - 1]);
    }

    if (!date || !Number.isFinite(amount)) continue;
    // Seuls les ENCAISSEMENTS nous intéressent.
    if (amount > 0) rows.push({ date, amount, label });
    if (rows.length >= MAX_TRANSACTIONS) break;
  }
  return rows;
}

/**
 * Parse un fichier OFX/QFX (balises SGML <STMTTRN>).
 *
 * Sécurité : balayage par indexOf, JAMAIS de regex `([\s\S]*?)` sur le
 * document entier — sur un fichier hostile de 2 Mo rempli de <STMTTRN> non
 * fermés, le retour arrière bloquait l'event loop plusieurs minutes (Express et
 * Next partagent le process → site entier gelé). Nombre de blocs borné.
 */
function parseOfxStatement(content) {
  const text = String(content || '');
  const rows = [];
  let cursor = 0;
  let guard = 0;
  while (guard < MAX_TRANSACTIONS) {
    guard += 1;
    const start = text.indexOf('<STMTTRN>', cursor);
    if (start === -1) break;
    const end = text.indexOf('</STMTTRN>', start);
    // Balise non fermée → on s'arrête (fichier tronqué ou malveillant).
    if (end === -1) break;
    const block = text.slice(start + 9, end);
    cursor = end + 10;
    const get = (tag) => {
      const r = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block);
      return r ? r[1].trim() : '';
    };
    const amount = parseAmount(get('TRNAMT'));
    const date = parseDate(get('DTPOSTED'));
    const label = [get('NAME'), get('MEMO')].filter(Boolean).join(' ').trim();
    if (date && Number.isFinite(amount) && amount > 0) rows.push({ date, amount, label });
  }
  return rows;
}

/** Détecte le format et parse. */
function parseStatement(content, fileName = '') {
  const isOfx = /\.(ofx|qfx)$/i.test(fileName) || /<OFX>|<STMTTRN>/i.test(String(content).slice(0, 4000));
  return isOfx ? parseOfxStatement(content) : parseCsvStatement(content);
}

function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Moteur de rapprochement : associe des transactions à des loyers attendus.
 *
 * Score (0-100) :
 *   +55 montant exact (±0,01) · +35 montant proche (±2 %) — un virement de
 *        loyer est rarement arrondi différemment
 *   +25 nom du locataire présent dans le libellé
 *   +12 mot-clé loyer/rent/location
 *   +8  transaction dans la fenêtre d'échéance (±20 j)
 * Un rapprochement n'est proposé qu'au-delà de 55 (donc jamais sur le seul nom).
 *
 * @param {Array} transactions {date, amount, label}
 * @param {Array} expected {paymentId, tenantName, amount, dueDate, period}
 * @returns {Array} propositions triées par score décroissant
 */
function matchTransactions(transactions, expected) {
  const proposals = [];
  const usedTx = new Set();
  const usedPayment = new Set();

  // Pré-calcul : normalize() (NFD Unicode) était appelé dans la boucle interne
  // → jusqu'à plusieurs millions d'appels sur un gros relevé.
  const expectedPrepared = expected.map((exp) => ({
    exp,
    nameParts: normalize(exp.tenantName).split(/\s+/).filter((p) => p.length >= 3),
  }));

  const candidates = [];
  transactions.slice(0, MAX_TRANSACTIONS).forEach((tx, txIndex) => {
    const labelNorm = normalize(tx.label);
    const hasRentKeyword = /(loyer|rent|location|bail)/.test(labelNorm);
    expectedPrepared.forEach(({ exp, nameParts }) => {
      let score = 0;
      const reasons = [];

      const diff = Math.abs(tx.amount - exp.amount);
      if (diff <= 0.01) { score += 55; reasons.push('montant exact'); }
      else if (exp.amount > 0 && diff / exp.amount <= 0.02) { score += 35; reasons.push('montant proche'); }
      else return; // écart de montant trop important → jamais proposé

      if (nameParts.length && nameParts.some((p) => labelNorm.includes(p))) {
        score += 25;
        reasons.push('nom du locataire');
      }
      if (hasRentKeyword) { score += 12; reasons.push('libellé « loyer »'); }

      if (exp.dueDate) {
        const days = Math.abs((new Date(tx.date) - new Date(exp.dueDate)) / 86400000);
        if (days <= 20) { score += 8; reasons.push('date cohérente'); }
      }

      if (score >= 55) {
        candidates.push({ txIndex, tx, exp, score: Math.min(100, score), reasons });
      }
    });
  });

  // Appariement glouton : meilleur score d'abord, 1 transaction ↔ 1 loyer.
  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    if (usedTx.has(c.txIndex) || usedPayment.has(String(c.exp.paymentId))) continue;
    usedTx.add(c.txIndex);
    usedPayment.add(String(c.exp.paymentId));
    proposals.push({
      paymentId: String(c.exp.paymentId),
      period: c.exp.period,
      tenantName: c.exp.tenantName,
      expectedAmount: c.exp.amount,
      transaction: { date: c.tx.date, amount: c.tx.amount, label: c.tx.label },
      score: c.score,
      confidence: c.score >= 80 ? 'HIGH' : c.score >= 65 ? 'MEDIUM' : 'LOW',
      reasons: c.reasons,
    });
  }

  const unmatched = transactions.filter((_, i) => !usedTx.has(i));
  return { proposals, unmatchedCount: unmatched.length, parsedCount: transactions.length };
}

module.exports = {
  MAX_TRANSACTIONS,
  parseStatement,
  parseCsvStatement,
  parseOfxStatement,
  matchTransactions,
  _internals: { parseAmount, parseDate, normalize },
};

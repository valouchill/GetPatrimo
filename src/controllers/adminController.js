// Controller pour les routes administrateur
const Lead = require('../../models/Lead');
const { csvEscape } = require('../utils/csv');

/**
 * Liste les leads (avec pagination)
 */
async function getLeads(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit || 200), 5000);
    const total = await Lead.countDocuments({});
    const items = await Lead.find({})
      .sort({ createdAt: -1 })
      .limit(limit);
    
    return res.json({ total, items });
  } catch (error) {
    console.error('Erreur getLeads:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Exporte les leads en CSV
 */
async function exportLeadsCSV(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit || 20000), 50000);
    const items = await Lead.find({})
      .sort({ createdAt: -1 })
      .limit(limit);

    const header = ['createdAt', 'email', 'source', 'utm', 'ip', 'userAgent'];
    const lines = [header.join(',')];

    for (const x of items) {
      const row = [
        x.createdAt ? x.createdAt.toISOString() : '',
        x.email || '',
        x.source || '',
        x.utm ? JSON.stringify(x.utm) : '',
        x.ip || '',
        x.userAgent || ''
      ].map(csvEscape).join(',');
      lines.push(row);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="doc2loc-leads.csv"');
    return res.send(lines.join('\n'));
  } catch (error) {
    console.error('Erreur exportLeadsCSV:', error);
    return res.status(500).send('Erreur CSV');
  }
}

module.exports = {
  getLeads,
  exportLeadsCSV
};

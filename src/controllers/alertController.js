// Controller pour les alertes et aperçus
const Property = require('../../models/Property');
const Tenant = require('../../models/Tenant');

/**
 * Récupère un aperçu des alertes pour l'utilisateur
 */
async function getAlertsOverview(req, res) {
  try {
    const props = await Property.find({ user: req.user.id });
    const tenants = await Tenant.find({ user: req.user.id });

    const byProp = new Map();
    for (const t of tenants) {
      if (t.property) {
        byProp.set(String(t.property), t);
      }
    }

    const alerts = [];
    for (const p of props) {
      const t = byProp.get(String(p._id));
      if (!t) {
        alerts.push({
          severity: 'warning',
          title: 'Bien sans locataire',
          message: `"${p.name}" n'a pas de locataire lié.`,
          action: { label: 'Ouvrir', href: `/property.html?id=${p._id}` }
        });
      } else if (!t.email) {
        alerts.push({
          severity: 'critical',
          title: 'Email locataire manquant',
          message: `Ajoute l'email de ${t.firstName} ${t.lastName}.`,
          action: { label: 'Ouvrir', href: `/tenant.html?id=${t._id}` }
        });
      }
    }

    return res.json({
      computedAt: new Date().toISOString(),
      overview: { 
        properties: props.length, 
        tenants: tenants.length, 
        occupied: byProp.size 
      },
      alerts: alerts.slice(0, 50),
      top: alerts.slice(0, 5)
    });
  } catch (error) {
    console.error('Erreur getAlertsOverview:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

module.exports = {
  getAlertsOverview
};

// Controller pour les relances aux locataires
const Tenant = require('../../models/Tenant');
const Property = require('../../models/Property');
const User = require('../../models/User');
const { sendEmail, isEmailConfigured } = require('../services/emailService');
const { logEvent } = require('../services/eventService');

/**
 * Envoie une relance à un locataire
 */
async function sendReminder(req, res) {
  try {
    if (!isEmailConfigured()) {
      return res.status(400).json({ msg: "Email non configuré (BREVO_USER/BREVO_PASS)" });
    }

    const t = await Tenant.findOne({ _id: req.params.tenantId, user: req.user.id });
    if (!t) {
      return res.status(404).json({ msg: 'Locataire introuvable' });
    }

    const p = t.property ? await Property.findOne({ _id: t.property, user: req.user.id }) : null;
    const u = await User.findById(req.user.id);

    const to = t.email;
    if (!to) {
      return res.status(400).json({ msg: "Email locataire manquant" });
    }

    const subject = "Relance — Document / paiement";
    const text = `Bonjour ${t.firstName || ''},\n\nPetit rappel concernant votre location${p?.name ? " (" + p.name + ")" : ""}.\n\nCordialement,\n${u?.firstName || 'Votre bailleur'}`;

    await sendEmail({
      to,
      subject,
      text
    });

    await logEvent(req.user.id, { 
      property: p ? p._id : null, 
      tenant: t._id, 
      type: 'reminder_sent', 
      meta: { to } 
    });
    
    return res.json({ msg: 'Relance envoyée ✅' });
  } catch (error) {
    console.error('Erreur sendReminder:', error);
    return res.status(500).json({ msg: 'Erreur relance' });
  }
}

module.exports = {
  sendReminder
};

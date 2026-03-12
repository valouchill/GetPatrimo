// Controller pour l'authentification
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { JWT_SECRET } = require('../config/app');
const { logEvent } = require('../services/eventService');

/**
 * Inscription d'un nouvel utilisateur
 */
async function register(req, res) {
  try {
    const { email, password, firstName, lastName } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ msg: 'Email et mot de passe requis' });
    }

    const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (exists) {
      return res.status(400).json({ msg: 'Email déjà utilisé' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Ne pas inclure oauthProvider si ce n'est pas OAuth (évite la validation enum)
    const userData = { 
      email: String(email).toLowerCase().trim(), 
      password: hashedPassword,
      firstName: req.body.firstName || '',
      lastName: req.body.lastName || ''
    };
    
    const u = await User.create(userData);

    await logEvent(u._id, { type: 'user_registered' });
    
    // Génère un token pour connexion automatique
    const token = jwt.sign({ user: { id: u.id } }, JWT_SECRET, { expiresIn: '24h' });
    
    return res.json({ token, msg: 'Compte créé avec succès' });
  } catch (error) {
    console.error('Erreur register:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Connexion d'un utilisateur
 */
async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    
    const u = await User.findOne({ email: String(email || '').toLowerCase().trim() });
    if (!u) {
      return res.status(400).json({ msg: 'Identifiants invalides' });
    }

    const ok = await bcrypt.compare(password, u.password);
    if (!ok) {
      return res.status(400).json({ msg: 'Identifiants invalides' });
    }

    const token = jwt.sign({ user: { id: u.id } }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token });
  } catch (error) {
    console.error('Erreur login:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Récupération du profil utilisateur
 */
async function getProfile(req, res) {
  try {
    const u = await User.findById(req.user.id).select('-password');
    if (!u) {
      return res.status(404).json({ msg: 'Utilisateur introuvable' });
    }
    return res.json(u);
  } catch (error) {
    console.error('Erreur getProfile:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Mise à jour du profil utilisateur
 */
async function updateProfile(req, res) {
  try {
    const u = await User.findById(req.user.id);
    if (!u) {
      return res.status(404).json({ msg: 'Utilisateur introuvable' });
    }

    const body = req.body || {};
    const allowed = ['firstName', 'lastName', 'address', 'zipCode', 'city', 'phone'];
    
    for (const k of allowed) {
      if (k in body) {
        u[k] = String(body[k] ?? '');
      }
    }
    
    await u.save();
    const safe = await User.findById(req.user.id).select('-password');
    return res.json(safe);
  } catch (error) {
    console.error('Erreur updateProfile:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Modifie le mot de passe de l'utilisateur connecté
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ msg: 'Tous les champs sont requis' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ msg: 'La confirmation ne correspond pas' });
    }

    const u = await User.findById(req.user.id);
    if (!u) {
      return res.status(404).json({ msg: 'Utilisateur introuvable' });
    }

    const ok = await bcrypt.compare(currentPassword, u.password);
    if (!ok) {
      return res.status(400).json({ msg: 'Mot de passe actuel incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    u.password = hashedPassword;
    
    if (u.oauthProvider === null || u.oauthProvider === undefined) {
      u.oauthProvider = undefined;
    }
    
    await u.save();
    await logEvent(u._id, { type: 'password_changed' });

    return res.json({ msg: 'Mot de passe mis à jour' });
  } catch (error) {
    console.error('Erreur changePassword:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Envoie un lien de connexion par email (Magic Link)
 */
async function sendMagicLink(req, res) {
  try {
    const { email } = req.body || {};
    
    if (!email) {
      return res.status(400).json({ msg: 'Email requis' });
    }

    const u = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!u) {
      // Ne pas révéler si l'email existe ou non (sécurité)
      return res.json({ msg: 'Si cet email existe, un lien de connexion a été envoyé.' });
    }

    // Génère un token temporaire (valide 15 minutes)
    const token = jwt.sign({ user: { id: u.id }, type: 'magic_link' }, JWT_SECRET, { expiresIn: '15m' });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const magicLink = `${frontendUrl}/login-luxe.html?token=${token}`;

    // Envoie l'email avec le lien
    const { sendEmail, isEmailConfigured } = require('../services/emailService');
    
    if (!isEmailConfigured()) {
      console.error('⚠️ Service email non configuré (BREVO_USER/BREVO_PASS manquant)');
      return res.status(500).json({ msg: 'Service email non configuré. Contactez l\'administrateur.' });
    }

    try {
      await sendEmail({
        to: email,
        subject: '🔐 Lien de connexion GetPatrimo',
        html: `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.6; color: #0F172A; background: #F8FAFC; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; padding: 0; }
              .header { background: #0F172A; color: #FFFFFF; padding: 32px 40px; text-align: center; }
              .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
              .content { padding: 40px; }
              .button { display: inline-block; background: #0F172A; color: #FFFFFF; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; margin: 24px 0; transition: background 0.2s; }
              .button:hover { background: #1E293B; }
              .footer { padding: 24px 40px; background: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center; font-size: 14px; color: #64748B; }
              .link { color: #64748B; word-break: break-all; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>GetPatrimo</h1>
              </div>
              <div class="content">
                <h2 style="margin-top: 0; color: #0F172A; font-size: 20px; font-weight: 600;">Connexion sécurisée</h2>
                <p style="color: #64748B; margin-bottom: 24px;">Cliquez sur le bouton ci-dessous pour vous connecter à votre compte GetPatrimo. Ce lien est valide pendant 15 minutes.</p>
                <div style="text-align: center;">
                  <a href="${magicLink}" class="button">Se connecter</a>
                </div>
                <p style="color: #64748B; font-size: 14px; margin-top: 32px;">Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
                <p class="link" style="font-size: 12px;">${magicLink}</p>
                <p style="color: #64748B; font-size: 12px; margin-top: 24px;">Si vous n'avez pas demandé ce lien, ignorez cet email.</p>
              </div>
              <div class="footer">
                <p style="margin: 0;">© GetPatrimo - Gestion locative sécurisée par IA</p>
              </div>
            </div>
          </body>
          </html>
        `
      });
      
      console.log(`✅ Email Magic Link envoyé à ${email}`);
    } catch (emailError) {
      console.error('❌ Erreur envoi email Magic Link:', emailError);
      console.error('Détails:', emailError.message, emailError.stack);
      return res.status(500).json({ 
        msg: 'Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard ou contacter le support.',
        error: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }

    return res.json({ msg: 'Si cet email existe, un lien de connexion a été envoyé.' });
  } catch (error) {
    console.error('Erreur sendMagicLink:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Demande de réinitialisation de mot de passe
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body || {};
    
    if (!email) {
      return res.status(400).json({ msg: 'Email requis' });
    }

    const u = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!u) {
      // Ne pas révéler si l'email existe ou non (sécurité)
      return res.json({ msg: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
    }

    // Génère un token de réinitialisation (valide 1 heure)
    const resetToken = jwt.sign({ user: { id: u.id }, type: 'password_reset' }, JWT_SECRET, { expiresIn: '1h' });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/forgot-password-luxe.html?token=${resetToken}`;

    // Envoie l'email avec le lien
    const { sendEmail, isEmailConfigured } = require('../services/emailService');
    
    if (!isEmailConfigured()) {
      console.error('⚠️ Service email non configuré (BREVO_USER/BREVO_PASS manquant)');
      return res.status(500).json({ msg: 'Service email non configuré. Contactez l\'administrateur.' });
    }

    try {
      await sendEmail({
        to: email,
        subject: '🔒 Réinitialisation de votre mot de passe GetPatrimo',
        html: `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.6; color: #0F172A; background: #F8FAFC; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; padding: 0; }
              .header { background: #0F172A; color: #FFFFFF; padding: 32px 40px; text-align: center; }
              .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
              .content { padding: 40px; }
              .button { display: inline-block; background: #0F172A; color: #FFFFFF; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; margin: 24px 0; transition: background 0.2s; }
              .button:hover { background: #1E293B; }
              .footer { padding: 24px 40px; background: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center; font-size: 14px; color: #64748B; }
              .link { color: #64748B; word-break: break-all; }
              .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 24px 0; border-radius: 8px; }
              .warning p { margin: 0; color: #92400E; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>GetPatrimo</h1>
              </div>
              <div class="content">
                <h2 style="margin-top: 0; color: #0F172A; font-size: 20px; font-weight: 600;">Réinitialisation de mot de passe</h2>
                <p style="color: #64748B; margin-bottom: 24px;">Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe. Ce lien est valide pendant 1 heure.</p>
                <div style="text-align: center;">
                  <a href="${resetLink}" class="button">Réinitialiser mon mot de passe</a>
                </div>
                <div class="warning">
                  <p><strong>⚠️ Sécurité :</strong> Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe ne sera pas modifié.</p>
                </div>
                <p style="color: #64748B; font-size: 14px; margin-top: 32px;">Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
                <p class="link" style="font-size: 12px;">${resetLink}</p>
              </div>
              <div class="footer">
                <p style="margin: 0;">© GetPatrimo - Gestion locative sécurisée par IA</p>
              </div>
            </div>
          </body>
          </html>
        `
      });
      
      console.log(`✅ Email de réinitialisation envoyé à ${email}`);
    } catch (emailError) {
      console.error('❌ Erreur envoi email Reset Password:', emailError);
      console.error('Détails:', emailError.message, emailError.stack);
      return res.status(500).json({ 
        msg: 'Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard ou contacter le support.',
        error: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }

    return res.json({ msg: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
  } catch (error) {
    console.error('Erreur forgotPassword:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Vérifie et valide un token Magic Link
 */
async function verifyMagicLink(req, res) {
  try {
    const { token } = req.body || {};
    
    if (!token) {
      return res.status(400).json({ msg: 'Token requis' });
    }

    // Vérifie le token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.type !== 'magic_link') {
        return res.status(400).json({ msg: 'Token invalide' });
      }
    } catch (error) {
      return res.status(400).json({ msg: 'Token invalide ou expiré' });
    }

    const u = await User.findById(decoded.user.id);
    if (!u) {
      return res.status(404).json({ msg: 'Utilisateur introuvable' });
    }

    // Génère un token de session normal (24h)
    const sessionToken = jwt.sign({ user: { id: u.id } }, JWT_SECRET, { expiresIn: '24h' });
    
    await logEvent(u._id, { type: 'magic_link_login' });
    
    return res.json({ token: sessionToken, msg: 'Connexion réussie' });
  } catch (error) {
    console.error('Erreur verifyMagicLink:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Réinitialise le mot de passe avec un token
 */
async function resetPassword(req, res) {
  try {
    const { token, password } = req.body || {};
    
    if (!token || !password) {
      return res.status(400).json({ msg: 'Token et mot de passe requis' });
    }

    // Vérifie le token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.type !== 'password_reset') {
        return res.status(400).json({ msg: 'Token invalide' });
      }
    } catch (error) {
      return res.status(400).json({ msg: 'Token invalide ou expiré' });
    }

    const u = await User.findById(decoded.user.id);
    if (!u) {
      return res.status(404).json({ msg: 'Utilisateur introuvable' });
    }

    // Hash le nouveau mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    u.password = hashedPassword;
    
    // Nettoie oauthProvider si null (pour éviter l'erreur de validation enum)
    if (u.oauthProvider === null || u.oauthProvider === undefined) {
      u.oauthProvider = undefined;
    }
    
    await u.save();

    await logEvent(u._id, { type: 'password_reset' });
    
    return res.json({ msg: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('Erreur resetPassword:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  sendMagicLink,
  verifyMagicLink,
  forgotPassword,
  resetPassword
};

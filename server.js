try { require('dotenv').config(); } catch (e) {}

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const { logger } = require('./lib/logger');
// Next.js désactivé - utilisation de pages statiques uniquement
let nextApp = null;
let handle = null;
try {
  const next = require('next');
  const dev = process.env.NODE_ENV !== 'production';
  nextApp = next({ dev });
  handle = nextApp.getRequestHandler();
} catch (e) {
  logger.warn('Next.js non disponible, utilisation des pages statiques uniquement');
}
 
const User = require('./models/User');
const Property = require('./models/Property');
const Tenant = require('./models/Tenant');
const Document = require('./models/Document');
const Lead = require('./models/Lead');
const Event = require('./models/Event');
 
const app = express();

// --- Trust proxy (derrière nginx-proxy-manager) ---
app.set('trust proxy', 1);

// --- Securite : headers HTTP ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://apx.didit.me", "https://geo.api.gouv.fr", "https://api.openai.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://verify.didit.me"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// --- Securite : CORS ---
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://doc2loc.com,https://www.doc2loc.com').split(',').map(s => s.trim());
app.use(cors({
  origin: function (origin, callback) {
    // Autoriser les requetes sans origin (mobile, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    callback(new Error('CORS non autorise'));
  },
  credentials: true,
  maxAge: 3600,
}));

// --- Securite : protection injection NoSQL ---
app.use(mongoSanitize());

// --- Performance : compression gzip/brotli ---
app.use(compression());

// --- Securite : rate limiting global (20 req/min par IP) ---
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requetes par IP par minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requetes, reessayez plus tard.' },
});
app.use('/api/', globalLimiter);

// --- Securite : rate limiting strict sur login (5 req/min) ---
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 tentatives par IP par minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion, reessayez dans 1 minute.' },
});
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', loginLimiter);
app.use('/api/auth/send-otp', loginLimiter);
app.use('/api/auth/verify-otp', loginLimiter);

// --- Logging minimal ---
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Incoming request', { method: req.method, url: req.url });
  }
  next();
});

// Stripe webhook — migré vers app/api/webhooks/stripe/route.ts

// Ne pas parser le body JSON pour les routes Next.js API (elles le font elles-mêmes)
app.use((req, res, next) => {
  // Routes Next.js API qui gèrent leur propre body
  const nextApiRoutes = ['/api/didit/', '/api/webhooks/', '/api/analyze-document', '/api/guarantor/', '/api/owner-tunnel/', '/api/analyze-photos', '/api/passport/', '/api/properties/', '/api/scoring/', '/api/verify/', '/api/owner/', '/api/billing/', '/api/public/apply/'];
  const isNextApiRoute = nextApiRoutes.some(route => req.url.startsWith(route));
  const nextAuthPaths = ['/api/auth/callback', '/api/auth/csrf', '/api/auth/providers', '/api/auth/session', '/api/auth/signout', '/api/auth/signin/', '/api/auth/error', '/api/auth/send-otp', '/api/auth/verify-otp', '/api/auth/register'];
  if (nextAuthPaths.some(p => req.url.startsWith(p))) return next();
  
  if (isNextApiRoute) {
    return next(); // Skip express.json() pour les routes Next.js
  }
  
  express.json({ limit: '1mb' })(req, res, next);
});
app.use(express.urlencoded({ limit: '1mb', extended: true }));
// Route explicite pour la contractualisation plein écran (fallback statique)
app.get('/properties/:id/contract', (req, res) => {
  if (nextApp && handle) {
    return handle(req, res);
  }
  const propertyId = String(req.params.id || '');
  return res.redirect(`/contractualization-luxe.html?id=${encodeURIComponent(propertyId)}`);
});
// -------------------- PUBLIC: Favicon
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'app', 'icon.svg'));
});

// -------------------- PUBLIC: Redirection vers la nouvelle page Next.js (AVANT le middleware statique)
// Redirige /apply.html?token=... vers /apply/[token] pour la nouvelle expérience Luxe
app.get('/apply.html', (req, res) => {
  const token = req.query.token;
  if (token) {
    return res.redirect(302, `/apply/${encodeURIComponent(token)}`);
  }
  // Si pas de token, servir le fichier (désactiver le cache)
  logger.info('[APPLY.HTML] Route appelée, servage du fichier', { path: path.join(__dirname, 'public', 'apply.html') });
  const filePath = path.join(__dirname, 'public', 'apply.html');
  const fs = require('fs');
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    logger.info('[APPLY.HTML] Fichier trouvé', { size: stats.size, modified: stats.mtime });
  } else {
    logger.error('[APPLY.HTML] Fichier non trouvé', { path: filePath });
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(filePath);
});

// Middleware statique pour servir les fichiers publics (sauf les routes Next.js)
// Désactiver le cache pour éviter les problèmes de fichiers obsolètes
const staticMiddleware = express.static('public', {
  etag: false,
  lastModified: false,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
});
app.use((req, res, next) => {
  // Routes Next.js : ne pas servir de fichier statique, laisser Next.js handler gérer
  if (req.path.startsWith('/auth/') ||
      req.path.startsWith('/dashboard/owner') ||
      req.path.startsWith('/_next/') ||
      req.path.startsWith('/fast-track') ||
      req.path.startsWith('/p/') ||
      req.path.startsWith('/verify/') ||
      req.path.startsWith('/verify-guarantor/') ||
      (req.path.startsWith('/properties/') && req.path.includes('/contract')) ||
      req.path === '/apply.html' ||
      (req.path.startsWith('/apply/') && req.path !== '/apply/') ||
      req.path === '/concierge') {
    return next();
  }
  // Sinon, servir les fichiers statiques normalement
  return staticMiddleware(req, res, next);
});
 
// -------------------- Config
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || '';
const MONGO_URI = process.env.MONGO_URI || '';
const GEO_VALIDATION = process.env.GEO_VALIDATION !== '0';
 
if (!JWT_SECRET) {
  logger.error('JWT_SECRET manquant (dans .env)');
  process.exit(1);
}
if (!MONGO_URI) {
  logger.error('MONGO_URI manquant (dans .env)');
  process.exit(1);
}
 
// -------------------- Mongo
mongoose.connect(MONGO_URI)
  .then(()=>console.log("✅ MongoDB Connecté"))
  .catch((e)=>{ logger.error('MongoDB error', { error: e?.message || e }); process.exit(1); });
 
// -------------------- Logging
const { requestLoggerMiddleware } = require('./lib/logger');
app.use(requestLoggerMiddleware);

// -------------------- Health
app.get('/healthz', (req,res)=>res.json({ ok:true, ts: new Date().toISOString() }));
app.get('/health', async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const status = mongoStatus === 'connected' ? 'healthy' : 'degraded';
  const code = status === 'healthy' ? 200 : 503;
  res.status(code).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    mongo: mongoStatus,
    version: process.env.npm_package_version || '1.0.0',
  });
});
 
// -------------------- Auth middleware
function auth(req, res, next){
  const token = req.header('x-auth-token');
  if(!token) return res.status(401).json({ msg:'Pas de token, autorisation refusée' });
  try{
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.user;
    return next();
  }catch(e){
    return res.status(401).json({ msg:'Token non valide' });
  }
}
 
// -------------------- Admin middleware
async function adminOnly(req,res,next){
  try{
    const raw = String(process.env.ADMIN_EMAILS || '');
    const admins = raw.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    if(admins.length === 0) return res.status(403).json({ msg:'Admin non configuré' });
 
    const u = await User.findById(req.user.id);
    if(!u) return res.status(401).json({ msg:'Utilisateur introuvable' });
 
    if(!admins.includes(String(u.email||'').toLowerCase())) return res.status(403).json({ msg:'Accès refusé' });
    return next();
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
}
 
// -------------------- Event logging
async function logEvent(userId, { property=null, tenant=null, type, meta={} }){
  try{
    await Event.create({ user: userId, property, tenant, type, meta });
  }catch(e){
    logger.error('logEvent error', { error: e?.message || e });
  }
}
 
// -------------------- Brevo SMTP
const BREVO_USER = process.env.BREVO_USER;
const BREVO_PASS = process.env.BREVO_PASS;
 
let transporter = null;
if (BREVO_USER && BREVO_PASS) {
  transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user: BREVO_USER, pass: BREVO_PASS }
  });
  transporter.verify().then(
    ()=>logger.info('SMTP Brevo OK'),
    (e)=>logger.error('SMTP verify fail', { error: e?.message || e })
  );
} else {
  logger.warn('BREVO_USER/BREVO_PASS manquant: emails desactives');
}
 
// -------------------- Upload dirs
const uploadsDir = path.join(__dirname, 'uploads');
const propertyDocUploadDir = path.join(uploadsDir, 'property-documents');
const candidatsUploadDir = path.join(uploadsDir, 'candidats');
fs.mkdirSync(propertyDocUploadDir, { recursive: true });
fs.mkdirSync(candidatsUploadDir, { recursive: true });
 
// -------------------- Upload: docs bien
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, propertyDocUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = (ext && ext.length <= 8) ? ext : '';
    cb(null, 'doc-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + safeExt);
  }
});
const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimetype);
    if(!ok) return cb(new Error('Type de fichier non autorisé'));
    cb(null, true);
  }
});
 
// -------------------- Upload: candidature public (placeholder)
const candidatureStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, candidatsUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, 'candidat-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const candidatureUpload = multer({
  storage: candidatureStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimetype);
    if(!ok) return cb(new Error('Type de fichier non autorisé'));
    cb(null, true);
  }
});

// --- Securite : validation magic bytes des fichiers uploadés ---
const ALLOWED_MAGIC = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/png': [0x89, 0x50, 0x4E, 0x47],       // .PNG
  'image/jpeg': [0xFF, 0xD8, 0xFF],             // JPEG SOI
};

async function validateFileMagicBytes(filePath, declaredMime) {
  try {
    const { fromFile } = require('file-type');
    const detected = await fromFile(filePath);
    if (!detected) {
      // PDF files sometimes not detected by file-type; check magic bytes manually
      const buf = Buffer.alloc(4);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buf, 0, 4, 0);
      fs.closeSync(fd);
      if (declaredMime === 'application/pdf' && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
        return true;
      }
      return false;
    }
    // Check that detected MIME matches declared MIME
    const declaredBase = declaredMime.split(';')[0].trim();
    return detected.mime === declaredBase;
  } catch {
    return false;
  }
}
 
// -------------------- Geo validation (optionnelle)
async function validateFrenchCommune(zipCode, city){
  if(!GEO_VALIDATION) return true;
  const z = String(zipCode||'').trim();
  const c = String(city||'').trim();
  if(!/^\d{5}$/.test(z) || !c) return false;
 
  const url = "https://geo.api.gouv.fr/communes?nom=" + encodeURIComponent(c) +
              "&codePostal=" + encodeURIComponent(z) +
              "&fields=nom,codesPostaux&limit=5";
 
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 3500);
  try{
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if(!r.ok) return false;
    const arr = await r.json();
    return Array.isArray(arr) && arr.length > 0;
  }catch(e){
    return false;
  }finally{
    clearTimeout(t);
  }
}
 
// -------------------- Paywall: limite emails quittance
const LIMITS = { FREE: 3, PRO: 999999 };
 
function monthKey(){
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,'0');
}
 
async function enforceReceiptEmailLimit(userDoc){
  const plan = String(userDoc.plan || 'FREE').toUpperCase();
  const limit = LIMITS[plan] ?? LIMITS.FREE;
 
  const key = monthKey();
  const cur = userDoc.usage?.receipts?.month === key ? Number(userDoc.usage.receipts.sent || 0) : 0;
 
  if(cur >= limit){
    return { ok:false, status:402, msg:`Limite atteinte : ${limit} emails quittance/mois sur le plan ${plan}.` };
  }
  // incrément
  userDoc.usage = userDoc.usage || {};
  userDoc.usage.receipts = userDoc.usage.receipts || {};
  userDoc.usage.receipts.month = key;
  userDoc.usage.receipts.sent = cur + 1;
  await userDoc.save();
  return { ok:true, plan, sent: cur + 1, limit };
}
 
// -------------------- PDF quittance
function createPdfBuffer(property, tenant, owner){
  return new Promise((resolve, reject) => {
    try{
      const doc = new PDFDocument({ size:'A4', margin:40 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', ()=>resolve(Buffer.concat(buffers)));
 
      const now = new Date();
      const f = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('fr-FR');
      const l = new Date(now.getFullYear(), now.getMonth()+1, 0).toLocaleDateString('fr-FR');
      const today = now.toLocaleDateString('fr-FR');
 
      const ownerName = (owner?.firstName && owner?.lastName) ? (owner.firstName + " " + owner.lastName) : (owner?.email || 'Bailleur');
      const tenantName = tenant ? ((tenant.firstName||'') + " " + (tenant.lastName||'')).trim() : "Locataire";
      const propName = property?.name || "Logement";
      const addr = property?.address || [property?.addressLine, property?.zipCode, property?.city].filter(Boolean).join(", ");
 
      const rent = Number(property?.rentAmount || 0) || 0;
      const charges = Number(property?.chargesAmount || 0) || 0;
 
      doc.rect(0,0,600,120).fill('#f8f9fa');
      doc.fillColor('#333').font('Helvetica-Bold').fontSize(22).text("QUITTANCE DE LOYER", 40, 40);
      doc.font('Helvetica').fontSize(10).text(`Période du ${f} au ${l}`, 40, 70);
 
      doc.fillColor('#333').font('Helvetica-Bold').fontSize(12).text("Bailleur", 40, 140);
      doc.font('Helvetica').fontSize(10).text(ownerName, 40, 158);
 
      doc.font('Helvetica-Bold').fontSize(12).text("Locataire", 320, 140);
      doc.font('Helvetica').fontSize(10).text(tenantName, 320, 158);
 
      doc.font('Helvetica-Bold').fontSize(12).text("Logement", 40, 190);
      doc.font('Helvetica').fontSize(10).text(`${propName}\n${addr||''}`, 40, 208);
 
      doc.rect(40, 270, 515, 25).fill('#333');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(10).text("DÉSIGNATION", 50, 278);
      doc.text("MONTANT", 450, 278, { align:'right', width:90 });
 
      doc.fillColor('#333').font('Helvetica').fontSize(10);
      let y = 310;
      doc.text("Loyer mensuel", 50, y);
      doc.text(rent.toFixed(2)+" EUR", 450, y, { align:'right', width:90 });
      y += 22;
      doc.text("Provision charges", 50, y);
      doc.text(charges.toFixed(2)+" EUR", 450, y, { align:'right', width:90 });
      y += 30;
 
      doc.font('Helvetica-Bold').text("TOTAL PAYÉ", 50, y);
      doc.text((rent+charges).toFixed(2)+" EUR", 450, y, { align:'right', width:90 });
 
      doc.font('Helvetica').fontSize(10).text(
        `Je soussigné(e) ${ownerName}, certifie avoir reçu le montant total.`,
        40, 460, { width: 515, align:'justify' }
      );
      doc.text(`Fait le ${today}`, 40, 530);
      doc.rect(380, 520, 150, 60).strokeColor('#333').stroke();
      doc.fontSize(8).text("Signature", 390, 525);
 
      doc.end();
    }catch(e){
      reject(e);
    }
  });
}
 
// -------------------- AUTH routes
// POST /api/auth/register — migré vers app/api/auth/register/route.ts
 
app.post('/api/auth/login', async (req,res)=>{
  try{
    const { email, password } = req.body || {};
    const u = await User.findOne({ email: String(email||'').toLowerCase().trim() });
    if(!u) return res.status(400).json({ msg:'Identifiants invalides' });
 
    const ok = await bcrypt.compare(password, u.password);
    if(!ok) return res.status(400).json({ msg:'Identifiants invalides' });
 
    const token = jwt.sign({ user: { id: u.id } }, JWT_SECRET, { expiresIn:'24h' });
    return res.json({ token });
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.get('/api/auth/profile', auth, async (req,res)=>{
  try{
    const u = await User.findById(req.user.id).select('-password');
    if(!u) return res.status(404).json({ msg:'Utilisateur introuvable' });
    return res.json(u);
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.put('/api/auth/profile', auth, async (req,res)=>{
  try{
    const u = await User.findById(req.user.id);
    if(!u) return res.status(404).json({ msg:'Utilisateur introuvable' });
 
    const body = req.body || {};
    const allowed = ['firstName','lastName','address','zipCode','city','phone'];
    for(const k of allowed){
      if(k in body) u[k] = String(body[k] ?? '');
    }
    await u.save();
    const safe = await User.findById(req.user.id).select('-password');
    return res.json(safe);
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
// Billing status (UI)
app.get('/api/billing/status', auth, async (req,res)=>{
  try{
    const u = await User.findById(req.user.id).select('plan usage credits');
    const plan = (u?.plan || 'FREE');
    const sent = (u?.usage?.receipts?.sent ?? 0);
    return res.json({
      plan,
      usage: { receiptsSent: sent },
      limits: { receiptEmailPerMonth: { FREE: LIMITS.FREE, PRO: LIMITS.PRO } }
    });
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
// -------------------- PROPERTIES CRUD
app.post('/api/properties', auth, async (req,res)=>{
  try{
    const { name, rentAmount, chargesAmount, address, addressLine, zipCode, city, surfaceM2 } = req.body || {};
    if(!name || !String(name).trim()) return res.status(400).json({ msg:'Dénomination obligatoire' });
 
    const rent = Number(rentAmount);
    if(!Number.isFinite(rent) || rent <= 0) return res.status(400).json({ msg:'Loyer invalide' });
 
    const line = String(addressLine||'').trim();
    const zip = String(zipCode||'').trim();
    const cty = String(city||'').trim();
 
    let fullAddress = String(address||'').trim();
    if(line && zip && cty){
      if(!/^\d{5}$/.test(zip)) return res.status(400).json({ msg:'Code postal invalide (5 chiffres)' });
      const okCity = await validateFrenchCommune(zip, cty);
      if(!okCity) return res.status(400).json({ msg:"Code postal / commune invalide (geo.api.gouv.fr)" });
      fullAddress = `${line}, ${zip} ${cty}`;
    }else{
      if(!fullAddress) return res.status(400).json({ msg:'Adresse incomplète' });
    }
 
    const ch = Number(chargesAmount);
    const charges = Number.isFinite(ch) && ch >= 0 ? ch : 0;
 
    const s = Number(surfaceM2);
    const surface = Number.isFinite(s) && s > 0 ? s : undefined;
 
    const prop = await Property.create({
      user: req.user.id,
      name: String(name).trim(),
      address: fullAddress,
      addressLine: line,
      zipCode: zip,
      city: cty,
      rentAmount: rent,
      chargesAmount: charges,
      surfaceM2: surface
    });
 
    await logEvent(req.user.id, { property: prop._id, type:'property_created', meta:{ name: prop.name } });
    return res.json(prop);
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.get('/api/properties', auth, async (req,res)=>{
  try{
    const props = await Property.find({ user: req.user.id }).sort({ createdAt:-1 });
    return res.json(props);
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.get('/api/properties/:id', auth, async (req,res)=>{
  try{
    const p = await Property.findOne({ _id: req.params.id, user: req.user.id });
    if(!p) return res.status(404).json({ msg:'Bien introuvable' });
    return res.json(p);
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.put('/api/properties/:id', auth, async (req,res)=>{
  try{
    const p = await Property.findOne({ _id: req.params.id, user: req.user.id });
    if(!p) return res.status(404).json({ msg:'Bien introuvable' });
 
    const body = req.body || {};
    if('name' in body) p.name = String(body.name||'').trim() || p.name;
    if('rentAmount' in body){
      const rent = Number(body.rentAmount);
      if(!Number.isFinite(rent) || rent <= 0) return res.status(400).json({ msg:'Loyer invalide' });
      p.rentAmount = rent;
    }
    if('chargesAmount' in body){
      const ch = Number(body.chargesAmount);
      p.chargesAmount = Number.isFinite(ch) && ch >= 0 ? ch : 0;
    }
 
    const line = ('addressLine' in body) ? String(body.addressLine||'').trim() : p.addressLine;
    const zip = ('zipCode' in body) ? String(body.zipCode||'').trim() : p.zipCode;
    const cty = ('city' in body) ? String(body.city||'').trim() : p.city;
 
    p.addressLine = line;
    p.zipCode = zip;
    p.city = cty;
 
    if(line && zip && cty){
      if(!/^\d{5}$/.test(zip)) return res.status(400).json({ msg:'Code postal invalide (5 chiffres)' });
      const okCity = await validateFrenchCommune(zip, cty);
      if(!okCity) return res.status(400).json({ msg:"Code postal / commune invalide (geo.api.gouv.fr)" });
      p.address = `${line}, ${zip} ${cty}`;
    }else if('address' in body){
      p.address = String(body.address||'').trim() || p.address;
    }
 
    await p.save();
    await logEvent(req.user.id, { property: p._id, type:'property_updated' });
    return res.json(p);
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.delete('/api/properties/:id', auth, async (req,res)=>{
  try{
    const p = await Property.findOne({ _id: req.params.id, user: req.user.id });
    if(!p) return res.status(404).json({ msg:'Bien introuvable' });
 
    await Tenant.deleteMany({ user: req.user.id, property: p._id });
    await Document.deleteMany({ user: req.user.id, property: p._id });
    await Event.deleteMany({ user: req.user.id, property: p._id });
    await p.deleteOne();
 
    await logEvent(req.user.id, { type:'property_deleted', meta:{ propertyId: String(req.params.id) } });
    return res.json({ msg:'OK' });
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
// -------------------- TENANTS CRUD
app.post('/api/tenants', auth, async (req,res)=>{
  try{
    const { firstName, lastName, email, property } = req.body || {};
    if(!firstName || !lastName || !email) return res.status(400).json({ msg:'Champs manquants' });
 
    let prop = null;
    if(property){
      prop = await Property.findOne({ _id: property, user: req.user.id });
      if(!prop) return res.status(404).json({ msg:'Bien introuvable' });
    }
 
    const t = await Tenant.create({
      user: req.user.id,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: String(email).toLowerCase().trim(),
      property: prop ? prop._id : undefined
    });
 
    await logEvent(req.user.id, { property: (prop?prop._id:null), tenant: t._id, type:'tenant_created' });
    return res.json(t);
  }catch(e){
    if(String(e?.message||'').includes('duplicate key')) return res.status(400).json({ msg:'Un locataire est déjà lié à ce bien' });
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.get('/api/tenants', auth, async (req,res)=>{
  try{
    const items = await Tenant.find({ user: req.user.id }).sort({ createdAt:-1 });
    return res.json(items);
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.get('/api/tenants/by-property/:propertyId', auth, async (req,res)=>{
  try{
    const p = await Property.findOne({ _id: req.params.propertyId, user: req.user.id });
    if(!p) return res.status(404).json({ msg:'Bien introuvable' });
    const t = await Tenant.findOne({ user: req.user.id, property: p._id });
    return res.json(t || null);
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.get('/api/tenants/:id', auth, async (req,res)=>{
  try{
    const t = await Tenant.findOne({ _id: req.params.id, user: req.user.id });
    if(!t) return res.status(404).json({ msg:'Locataire introuvable' });
    return res.json(t);
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.put('/api/tenants/:id', auth, async (req,res)=>{
  try{
    const t = await Tenant.findOne({ _id: req.params.id, user: req.user.id });
    if(!t) return res.status(404).json({ msg:'Locataire introuvable' });
 
    const body = req.body || {};
    if('firstName' in body) t.firstName = String(body.firstName||'').trim() || t.firstName;
    if('lastName' in body) t.lastName = String(body.lastName||'').trim() || t.lastName;
    if('email' in body) t.email = String(body.email||'').toLowerCase().trim() || t.email;
 
    if('property' in body){
      if(!body.property){
        t.property = undefined;
      } else {
        const p = await Property.findOne({ _id: body.property, user: req.user.id });
        if(!p) return res.status(404).json({ msg:'Bien introuvable' });
        t.property = p._id;
      }
    }
 
    await t.save();
    await logEvent(req.user.id, { property: t.property || null, tenant: t._id, type:'tenant_updated' });
    return res.json(t);
  }catch(e){
    if(String(e?.message||'').includes('duplicate key')) return res.status(400).json({ msg:'Un locataire est déjà lié à ce bien' });
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.delete('/api/tenants/:id', auth, async (req,res)=>{
  try{
    const t = await Tenant.findOne({ _id: req.params.id, user: req.user.id });
    if(!t) return res.status(404).json({ msg:'Locataire introuvable' });
    await Event.deleteMany({ user: req.user.id, tenant: t._id });
    await t.deleteOne();
    await logEvent(req.user.id, { type:'tenant_deleted', meta:{ tenantId: String(req.params.id) } });
    return res.json({ msg:'OK' });
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
// -------------------- PDF + Email quittance
app.get('/api/documents/quittance/:id', auth, async (req,res)=>{
  try{
    const p = await Property.findOne({ _id: req.params.id, user: req.user.id });
    if(!p) return res.status(404).json({ msg:'Bien introuvable' });
 
    const t = await Tenant.findOne({ user: req.user.id, property: p._id });
    const u = await User.findById(req.user.id);
 
    const buffer = await createPdfBuffer(p, t, u);
    res.setHeader('Content-Type','application/pdf');
    await logEvent(req.user.id, { property: p._id, tenant: t? t._id : null, type:'pdf_quittance_generated' });
    return res.send(buffer);
  }catch(e){
    logger.error('Erreur PDF', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur PDF' });
  }
});
 
app.post('/api/documents/email/:id', auth, async (req,res)=>{
  try{
    if(!transporter) return res.status(400).json({ msg:"Email non configuré (BREVO_USER/BREVO_PASS)" });
 
    const p = await Property.findOne({ _id: req.params.id, user: req.user.id });
    if(!p) return res.status(404).json({ msg:'Bien introuvable' });
 
    const t = await Tenant.findOne({ user: req.user.id, property: p._id });
    if(!t) return res.status(400).json({ msg:'Aucun locataire lié à ce bien' });
    if(!t.email) return res.status(400).json({ msg:"Le locataire n'a pas d'email" });
 
    const u = await User.findById(req.user.id);
 
    // Paywall check
    const check = await enforceReceiptEmailLimit(u);
    if(!check.ok) return res.status(check.status).json({ msg: check.msg });
 
    const pdfBuffer = await createPdfBuffer(p, t, u);
 
    await transporter.sendMail({
      from: process.env.MAIL_FROM || '"Doc2Loc" <no-reply@doc2loc.com>',
      to: t.email,
      subject: 'Quittance de loyer - ' + (p.name || ''),
      text: `Bonjour ${t.firstName||''},\n\nVeuillez trouver ci-joint votre quittance de loyer.\n\nCordialement,\n${u?.firstName || 'Votre Bailleur'}`,
      attachments: [{ filename:'Quittance.pdf', content: pdfBuffer }]
    });
 
    await logEvent(req.user.id, { property: p._id, tenant: t._id, type:'email_quittance_sent', meta:{ to: t.email, plan: check.plan, sent: check.sent } });
    return res.json({ msg:'Email envoyé avec succès !' });
  }catch(e){
    logger.error('Erreur envoi email', { error: e?.message || e });
    return res.status(500).json({ msg:"Erreur envoi email" });
  }
});
 
// -------------------- Docs par bien
app.get('/api/property-documents/file/:docId', auth, async (req,res)=>{
  try{
    const d = await Document.findOne({ _id: req.params.docId, user: req.user.id });
    if(!d) return res.status(404).json({ msg:'Document introuvable' });
 
    const absPath = path.join(uploadsDir, d.relPath);
    if(!fs.existsSync(absPath)) return res.status(404).json({ msg:'Fichier introuvable' });
 
    return res.download(absPath, d.originalName || d.filename || 'document');
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.post('/api/property-documents/upload/:propertyId', auth, docUpload.single('file'), async (req,res)=>{
  try{
    const p = await Property.findOne({ _id: req.params.propertyId, user: req.user.id });
    if(!p) return res.status(404).json({ msg:'Bien introuvable' });
    if(!req.file) return res.status(400).json({ msg:'Fichier manquant' });

    // Valider les magic bytes du fichier
    const magicOk = await validateFileMagicBytes(req.file.path, req.file.mimetype);
    if (!magicOk) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ msg: 'Le contenu du fichier ne correspond pas au type déclaré' });
    }

    const type = String((req.body && req.body.type) || 'autre');
    const doc = await Document.create({
      user: req.user.id,
      property: p._id,
      type,
      originalName: req.file.originalname || '',
      filename: req.file.filename,
      mimeType: req.file.mimetype || '',
      size: req.file.size || 0,
      relPath: 'property-documents/' + req.file.filename
    });

    const tt = await Tenant.findOne({ user: req.user.id, property: p._id });
    await logEvent(req.user.id, { property: p._id, tenant: tt?tt._id:null, type:'document_uploaded', meta:{ docType: type, name: doc.originalName } });
    return res.json(doc);
  }catch(e){
    logger.error('Erreur upload', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur upload' });
  }
});
 
app.get('/api/property-documents/:propertyId', auth, async (req,res)=>{
  try{
    const p = await Property.findOne({ _id: req.params.propertyId, user: req.user.id });
    if(!p) return res.status(404).json({ msg:'Bien introuvable' });
 
    const docs = await Document.find({ user: req.user.id, property: p._id }).sort({ createdAt:-1 });
    return res.json(docs);
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.delete('/api/property-documents/:docId', auth, async (req,res)=>{
  try{
    const d = await Document.findOne({ _id: req.params.docId, user: req.user.id });
    if(!d) return res.status(404).json({ msg:'Document introuvable' });
 
    const absPath = path.join(uploadsDir, d.relPath);
    if(fs.existsSync(absPath)) fs.unlinkSync(absPath);
 
    await d.deleteOne();
    await logEvent(req.user.id, { property: d.property, type:'document_deleted', meta:{ name: d.originalName || d.filename } });
    return res.json({ msg:'OK' });
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
// -------------------- Events (historique)
app.get('/api/events/property/:propertyId', auth, async (req,res)=>{
  try{
    const p = await Property.findOne({ _id: req.params.propertyId, user: req.user.id });
    if(!p) return res.status(404).json({ msg:'Bien introuvable' });
 
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const items = await Event.find({ user: req.user.id, property: p._id }).sort({ createdAt:-1 }).limit(limit);
    return res.json(items);
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.get('/api/events/tenant/:tenantId', auth, async (req,res)=>{
  try{
    const t = await Tenant.findOne({ _id: req.params.tenantId, user: req.user.id });
    if(!t) return res.status(404).json({ msg:'Locataire introuvable' });
 
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const items = await Event.find({ user: req.user.id, tenant: t._id }).sort({ createdAt:-1 }).limit(limit);
    return res.json(items);
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
app.get('/api/events/summary', auth, async (req,res)=>{
  try{
    const since = new Date(Date.now() - 30*24*60*60*1000);
    const last = await Event.find({ user: req.user.id }).sort({ createdAt:-1 }).limit(15);
    const count30 = await Event.countDocuments({ user: req.user.id, createdAt: { $gte: since } });
    return res.json({ last, count30 });
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
// -------------------- Relance locataire
app.post('/api/reminders/tenant/:tenantId', auth, async (req,res)=>{
  try{
    if(!transporter) return res.status(400).json({ msg:"Email non configuré (BREVO_USER/BREVO_PASS)" });
 
    const t = await Tenant.findOne({ _id: req.params.tenantId, user: req.user.id });
    if(!t) return res.status(404).json({ msg:'Locataire introuvable' });
 
    const p = t.property ? await Property.findOne({ _id: t.property, user: req.user.id }) : null;
    const u = await User.findById(req.user.id);
 
    const to = t.email;
    if(!to) return res.status(400).json({ msg:"Email locataire manquant" });
 
    const subject = "Relance — Document / paiement";
    const text = `Bonjour ${t.firstName||''},\n\nPetit rappel concernant votre location${p?.name ? " (“"+p.name+"”)" : ""}.\n\nCordialement,\n${u?.firstName || 'Votre bailleur'}`;
 
    await transporter.sendMail({
      from: process.env.MAIL_FROM || '"Doc2Loc" <no-reply@doc2loc.com>',
      to, subject, text
    });
 
    await logEvent(req.user.id, { property: p? p._id : null, tenant: t._id, type:'reminder_sent', meta:{ to } });
    return res.json({ msg:'Relance envoyée ✅' });
  }catch(e){
    logger.error('Erreur relance', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur relance' });
  }
});
 
// -------------------- Alerts overview (simple)
app.get('/api/alerts/overview', auth, async (req,res)=>{
  try{
    const props = await Property.find({ user: req.user.id });
    const tenants = await Tenant.find({ user: req.user.id });
 
    const byProp = new Map();
    for(const t of tenants) if(t.property) byProp.set(String(t.property), t);
 
    const alerts = [];
    for(const p of props){
      const t = byProp.get(String(p._id));
      if(!t){
        alerts.push({ severity:'warning', title:'Bien sans locataire', message:`“${p.name}” n’a pas de locataire lié.`, action:{ label:'Ouvrir', href:`/property.html?id=${p._id}` } });
      }else if(!t.email){
        alerts.push({ severity:'critical', title:'Email locataire manquant', message:`Ajoute l’email de ${t.firstName} ${t.lastName}.`, action:{ label:'Ouvrir', href:`/tenant.html?id=${t._id}` } });
      }
    }
 
    return res.json({
      computedAt: new Date().toISOString(),
      overview: { properties: props.length, tenants: tenants.length, occupied: byProp.size },
      alerts: alerts.slice(0, 50),
      top: alerts.slice(0, 5)
    });
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
// -------------------- Routes pour pages Luxe (sans extension .html)
app.get('/dashboard-luxe', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard-luxe.html'));
});
app.get('/login-luxe', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login-luxe.html'));
});
app.get('/register-luxe', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register-luxe.html'));
});
app.get('/property-luxe', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'property-luxe.html'));
});
app.get('/contractualization-luxe', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contractualization-luxe.html'));
});
// Parcours propriétaire (Atelier de Valorisation)
app.get('/owner-journey', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('ETag', `"v3-${Date.now()}"`);
  res.sendFile(path.join(__dirname, 'public', 'owner-journey.html'));
});
app.get('/owner-journey.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('ETag', `"v3-${Date.now()}"`);
  res.sendFile(path.join(__dirname, 'public', 'owner-journey.html'));
});

// Route pour le ContractStudio (fallback si Next.js n'est pas disponible)
app.get('/properties/:id/contract', (req, res) => {
  // Si Next.js est disponible, laisser le handler Next.js gérer cette route
  if (nextApp && handle) {
    return handle(req, res);
  }
  // Sinon, servir la page statique de contractualisation
  res.sendFile(path.join(__dirname, 'public', 'contractualization-luxe.html'));
});

// Route pour /concierge - Mode Concierge (Next.js)
app.get('/concierge', (req, res, next) => {
  if (nextApp && handle) {
    return handle(req, res);
  }
  return next();
});

// Route pour /apply/:token - DÉLÉGUER EXPLICITEMENT À NEXT.JS (AVANT le middleware statique)
// Désactiver le cache pour forcer le chargement du dernier bundle (éviter "Louna Cogoni" en cache)
app.get('/apply/:token', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (nextApp && handle) {
    return handle(req, res);
  }
  return next();
});

// GET /api/public/apply/:token — migré vers app/api/public/apply/[token]/route.ts

// -------------------- DIAGNOSTIC: Vérifie si un token existe en base
app.get('/api/public/check-token/:token', async (req, res) => {
  try {
    const token = req.params.token || '';
    const prop = await Property.findOne({ applyToken: token });
    if (!prop) {
      // Liste quelques tokens existants pour diagnostic (masqués partiellement)
      const allProps = await Property.find({}, { applyToken: 1, name: 1, _id: 1 }).limit(10);
      const tokens = allProps.map(p => ({
        id: String(p._id),
        name: p.name || '—',
        tokenPreview: p.applyToken ? `${p.applyToken.slice(0, 8)}...${p.applyToken.slice(-4)}` : 'NONE'
      }));
      return res.status(404).json({ 
        found: false, 
        msg: 'Token introuvable',
        tokenLength: token.length,
        existingTokens: tokens
      });
    }
    return res.json({ 
      found: true, 
      propertyId: String(prop._id),
      propertyName: prop.name,
      tokenMatch: true 
    });
  } catch (error) {
    logger.error('Erreur check-token', { error: error?.message || error });
    return res.status(500).json({ msg: 'Erreur serveur', error: error.message });
  }
});

// -------------------- PUBLIC: Routes pour Pack Sérénité Location
// Récupère un bien par son ID (sans authentification)
app.get('/api/public/property/:propertyId', async (req, res) => {
  try {
    const prop = await Property.findById(req.params.propertyId);
    if (!prop) {
      return res.status(404).json({ msg: "Bien introuvable" });
    }
    // Retourne uniquement les informations publiques nécessaires
    return res.json({ 
      property: {
        _id: prop._id,
        name: prop.name,
        address: prop.address,
        addressLine: prop.addressLine,
        zipCode: prop.zipCode,
        city: prop.city,
        rentAmount: prop.rentAmount,
        chargesAmount: prop.chargesAmount,
        surfaceM2: prop.surfaceM2,
        requiredDocuments: prop.requiredDocuments || []
      }
    });
  } catch (error) {
    logger.error('Erreur getPropertyById', { error: error?.message || error });
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
});

// Soumet une candidature via propertyId (Pack Sérénité Location)
// Note: Cette route utilise la logique du contrôleur publicController
// Pour simplifier, on importe directement les fonctions nécessaires
app.post('/api/public/property/:propertyId/apply', candidatureUpload.array('documents', 10), async (req, res) => {
  try {
    // Valider les magic bytes de chaque fichier uploadé
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const ok = await validateFileMagicBytes(file.path, file.mimetype);
        if (!ok) {
          // Nettoyer tous les fichiers uploadés
          for (const f of req.files) fs.unlink(f.path, () => {});
          return res.status(400).json({ msg: 'Un fichier ne correspond pas au type déclaré' });
        }
      }
    }
    // Import dynamique pour éviter les erreurs de dépendances circulaires
    const { submitCandidatureByPropertyId } = require('./src/controllers/publicController');
    return await submitCandidatureByPropertyId(req, res);
  } catch (error) {
    logger.error('Erreur route POST /api/public/property/:propertyId/apply', { error: error?.message || error });
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
});

// -------------------- PUBLIC: candidature (placeholder upload)
app.post('/api/public/candidature', candidatureUpload.array('documents', 5), async (req,res)=>{
  try{
    return res.json({ msg:"Dossier bien reçu ! (Pipeline candidature à ajouter proprement ensuite)" });
  }catch(e){
    logger.error('Erreur lors du depot', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur lors du dépôt' });
  }
});

// -------------------- PUBLIC: lead
app.post('/api/public/lead', async (req,res)=>{
  try{
    const { email, source, utm } = req.body || {};
    if(!email || !String(email).includes('@')) return res.status(400).json({ msg:'Email invalide' });
 
    await Lead.create({
      email: String(email).trim().toLowerCase(),
      source: source ? String(source) : 'landing',
      utm: utm && typeof utm === 'object' ? utm : {},
      ip: req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : (req.ip || ''),
      userAgent: String(req.headers['user-agent'] || '')
    });
 
    return res.json({ msg:'OK' });
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});

// -------------------- WEBHOOKS: OpenSign
app.post('/api/webhooks/opensign', async (req, res) => {
  try {
    const { handleOpenSignWebhook } = require('./src/controllers/webhookController');
    return await handleOpenSignWebhook(req, res);
  } catch (error) {
    logger.error('Erreur webhook OpenSign', { error: error?.message || error });
    return res.status(200).json({ success: false, error: error.message }); // Répond 200 pour éviter les retries
  }
});

// -------------------- CRON: Vérification diagnostics périmés (quotidien)
// Vérifie tous les jours à 9h00 les diagnostics qui expirent ou sont périmés
if (process.env.NODE_ENV !== 'test') {
  // Calcule le délai jusqu'à 9h00 du matin
  function getMsUntil9AM() {
    const now = new Date();
    const next9AM = new Date();
    next9AM.setHours(9, 0, 0, 0);
    if (next9AM <= now) {
      next9AM.setDate(next9AM.getDate() + 1); // Demain si déjà passé
    }
    return next9AM.getTime() - now.getTime();
  }

  setTimeout(() => {
    const { checkAllDiagnosticsAndAlert } = require('./src/services/diagnosticAlertService');
    
    // Exécute immédiatement au démarrage (pour tests)
    checkAllDiagnosticsAndAlert()
      .then(result => {
        logger.info('Verification diagnostics', { result });
      })
      .catch(error => {
        logger.error('Erreur verification diagnostics', { error: error?.message || error });
      });

    // Puis exécute tous les jours à 9h00
    setInterval(() => {
      checkAllDiagnosticsAndAlert()
        .then(result => {
          logger.info('Verification diagnostics quotidienne', { result });
        })
        .catch(error => {
          logger.error('Erreur verification diagnostics quotidienne', { error: error?.message || error });
        });
    }, 24 * 60 * 60 * 1000); // 24 heures
  }, getMsUntil9AM());
}
 
// -------------------- ADMIN: leads
app.get('/api/admin/leads', auth, adminOnly, async (req,res)=>{
  try{
    const limit = Math.min(Number(req.query.limit || 200), 5000);
    const total = await Lead.countDocuments({});
    const items = await Lead.find({}).sort({ createdAt:-1 }).limit(limit);
    return res.json({ total, items });
  }catch(e){
    logger.error('Erreur serveur', { error: e?.message || e });
    return res.status(500).json({ msg:'Erreur serveur' });
  }
});
 
function csvEscape(v){
  const s = String(v ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
 
app.get('/api/admin/leads.csv', auth, adminOnly, async (req,res)=>{
  try{
    const limit = Math.min(Number(req.query.limit || 20000), 50000);
    const items = await Lead.find({}).sort({ createdAt:-1 }).limit(limit);
 
    const header = ['createdAt','email','source','utm','ip','userAgent'];
    const lines = [header.join(',')];
 
    for(const x of items){
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
 
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="doc2loc-leads.csv"');
    return res.send(lines.join('\n'));
  }catch(e){
    logger.error('Erreur CSV', { error: e?.message || e });
    return res.status(500).send('Erreur CSV');
  }
});
 
// -------------------- Routes modulaires (candidatures, documents, etc.)
try {
  const candidatureRoutes = require('./src/routes/candidatureRoutes');
  app.use('/api/candidatures', candidatureRoutes);
  logger.info('Routes candidatures montees');
} catch (e) {
  logger.error('Erreur chargement routes candidatures', { error: e?.message || e });
}

try {
  const documentRoutes = require('./src/routes/documentRoutes');
  app.use('/api/documents', documentRoutes);
  logger.info('Routes documents montees');
} catch (e) {
  logger.error('Erreur chargement routes documents', { error: e?.message || e });
}

try {
  const leaseRoutes = require('./src/routes/leaseRoutes');
  app.use('/api/leases', leaseRoutes);
  logger.info('Routes leases montees');
} catch (e) {
  logger.error('Erreur chargement routes leases', { error: e?.message || e });
}

try {
  const propertyRoutes = require('./src/routes/propertyRoutes');
  app.use('/api/properties', propertyRoutes);
  logger.info('Routes properties montees');
} catch (e) {
  logger.error('Erreur chargement routes properties', { error: e?.message || e });
}

// Note: Les routes Next.js seront gérées par le handler app.all('*', ...) après la préparation de Next.js
// Le middleware statique ci-dessus laisse passer les routes /properties/*/contract pour Next.js

// -------------------- Error handler centralisé (Express)
app.use((err, req, res, _next) => {
  // Multer errors
  if (err && err.message === 'Type de fichier non autorisé') {
    return res.status(400).json({ error: 'Type de fichier non autorisé (PDF/PNG/JPEG)' });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Fichier trop lourd : limite 10 Mo' });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode < 500 ? (err.message || 'Erreur de requête') : 'Erreur serveur';

  // Log structuré JSON
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl || req.url,
    statusCode,
    message: err.message || 'Unknown error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  };
  logger.error('Unhandled express error', logEntry);

  if (res.headersSent) return;
  return res.status(statusCode).json({ error: message });
});
 
// Démarrage du serveur avec ou sans Next.js
if (nextApp && handle) {
  nextApp.prepare().then(() => {
    // Gestionnaire Next.js pour toutes les autres routes (Page d'accueil, etc.)
    app.all('*', (req, res) => {
      return handle(req, res);
    });
 
    app.listen(PORT, () => logger.info('Serveur (Express + Next.js) demarre', { port: PORT }));
  }).catch((err) => {
    logger.error('Erreur au demarrage de Next.js', { error: err?.message || err });
    logger.info('Demarrage du serveur Express uniquement...');
    // Démarre Express même si Next.js échoue
    app.listen(PORT, () => logger.info('Serveur Express demarre', { port: PORT }));
  });
} else {
  // Serveur Express uniquement (pages statiques)
  app.listen(PORT, () => logger.info('Serveur Express demarre', { port: PORT }));
}

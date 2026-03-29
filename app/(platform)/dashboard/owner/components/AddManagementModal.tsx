'use client';

import { memo, useState, useCallback, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Home, User, FileText, Loader2 } from 'lucide-react';

interface AddManagementModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LEASE_TYPES = [
  { value: 'VIDE', label: 'Nu (vide)' },
  { value: 'MEUBLE', label: 'Meublé' },
  { value: 'MOBILITE', label: 'Mobilité' },
  { value: 'GARAGE_PARKING', label: 'Garage / Parking' },
] as const;

const AddManagementModal = memo(function AddManagementModal({
  open,
  onClose,
  onSuccess,
}: AddManagementModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Bien
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [surfaceM2, setSurfaceM2] = useState('');

  // Locataire
  const [tenantFirstName, setTenantFirstName] = useState('');
  const [tenantLastName, setTenantLastName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');

  // Bail
  const [rentAmount, setRentAmount] = useState('');
  const [chargesAmount, setChargesAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [leaseType, setLeaseType] = useState('VIDE');
  const [startDate, setStartDate] = useState('');
  const [paymentDay, setPaymentDay] = useState('5');

  const reset = useCallback(() => {
    setStep(1);
    setLoading(false);
    setError('');
    setName('');
    setAddress('');
    setZipCode('');
    setCity('');
    setSurfaceM2('');
    setTenantFirstName('');
    setTenantLastName('');
    setTenantEmail('');
    setTenantPhone('');
    setRentAmount('');
    setChargesAmount('');
    setDepositAmount('');
    setLeaseType('VIDE');
    setStartDate('');
    setPaymentDay('5');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/owner/management/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          address,
          zipCode,
          city,
          surfaceM2: surfaceM2 ? Number(surfaceM2) : null,
          tenantFirstName,
          tenantLastName,
          tenantEmail,
          tenantPhone,
          rentAmount: Number(rentAmount),
          chargesAmount: Number(chargesAmount || '0'),
          depositAmount: Number(depositAmount || '0'),
          leaseType,
          startDate,
          paymentDay: Number(paymentDay),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création');
        setLoading(false);
        return;
      }

      reset();
      onSuccess();
    } catch {
      setError('Erreur réseau, veuillez réessayer');
    } finally {
      setLoading(false);
    }
  }, [
    name, address, zipCode, city, surfaceM2,
    tenantFirstName, tenantLastName, tenantEmail, tenantPhone,
    rentAmount, chargesAmount, depositAmount, leaseType, startDate, paymentDay,
    reset, onSuccess,
  ]);

  const canGoStep2 = name.trim() && address.trim();
  const canGoStep3 = tenantFirstName.trim() && tenantLastName.trim() && tenantEmail.trim();
  const canSubmit = rentAmount && startDate;

  if (!open) return null;

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors';
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={handleClose}
        aria-modal="true"
        role="dialog"
        aria-label="Ajouter un bien en gestion"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="font-serif text-lg font-bold text-slate-900">
                Ajouter un bien en gestion
              </h2>
              <p className="text-xs text-slate-500">
                Étape {step}/3 — {step === 1 ? 'Le bien' : step === 2 ? 'Le locataire' : 'Le bail'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex gap-1.5 px-6 pt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5">
            {/* Step 1: Bien */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-emerald-600 mb-2">
                  <Home className="h-4 w-4" />
                  <span className="text-sm font-semibold">Informations du bien</span>
                </div>
                <div>
                  <label className={labelCls}>Nom du bien *</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Ex : Appartement Rue de la Paix"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className={labelCls}>Adresse complète *</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="12 rue de la Paix, 75002 Paris"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Code postal</label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="75002"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Ville</label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Paris"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Surface (m²)</label>
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="45"
                    value={surfaceM2}
                    onChange={(e) => setSurfaceM2(e.target.value)}
                    min="0"
                    step="0.1"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 2: Locataire */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <User className="h-4 w-4" />
                  <span className="text-sm font-semibold">Informations du locataire</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Prénom *</label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Jean"
                      value={tenantFirstName}
                      onChange={(e) => setTenantFirstName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Nom *</label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Dupont"
                      value={tenantLastName}
                      onChange={(e) => setTenantLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Email *</label>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="jean.dupont@email.com"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Téléphone</label>
                  <input
                    type="tel"
                    className={inputCls}
                    placeholder="06 12 34 56 78"
                    value={tenantPhone}
                    onChange={(e) => setTenantPhone(e.target.value)}
                  />
                </div>
              </motion.div>
            )}

            {/* Step 3: Bail */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-violet-600 mb-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-semibold">Conditions du bail</span>
                </div>
                <div>
                  <label className={labelCls}>Type de bail</label>
                  <select
                    className={inputCls}
                    value={leaseType}
                    onChange={(e) => setLeaseType(e.target.value)}
                  >
                    {LEASE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Date de début du bail *</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Loyer HC *</label>
                    <input
                      type="number"
                      className={inputCls}
                      placeholder="850"
                      value={rentAmount}
                      onChange={(e) => setRentAmount(e.target.value)}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Charges</label>
                    <input
                      type="number"
                      className={inputCls}
                      placeholder="50"
                      value={chargesAmount}
                      onChange={(e) => setChargesAmount(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Dépôt</label>
                    <input
                      type="number"
                      className={inputCls}
                      placeholder="850"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Jour de paiement</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={paymentDay}
                    onChange={(e) => setPaymentDay(e.target.value)}
                    min="1"
                    max="31"
                  />
                </div>
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex items-center justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Retour
                </button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                  disabled={step === 1 ? !canGoStep2 : !canGoStep3}
                  className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Suivant
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSubmit || loading}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Ajouter en gestion
                </button>
              )}
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

export { AddManagementModal };

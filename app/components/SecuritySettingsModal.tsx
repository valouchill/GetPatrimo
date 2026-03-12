"use client";

import { useEffect, useState } from "react";

type SecuritySettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function SecuritySettingsModal({
  open,
  onClose,
}: SecuritySettingsModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
    setErrorMessage("");
    setSuccessMessage("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/40 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-6">
          <h2 className="font-serif text-xl text-navy">
            Sécurité du compte
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Mettez à jour votre mot de passe en toute sécurité.
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setErrorMessage("");
            setSuccessMessage("");

            if (!currentPassword || !nextPassword || !confirmPassword) {
              setErrorMessage("Veuillez remplir tous les champs.");
              return;
            }
            if (nextPassword !== confirmPassword) {
              setErrorMessage("La confirmation ne correspond pas au nouveau mot de passe.");
              return;
            }

            const token = window.localStorage.getItem("token");
            if (!token) {
              setErrorMessage("Votre session a expiré. Veuillez vous reconnecter.");
              return;
            }

            setIsLoading(true);
            try {
              const response = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-auth-token": token,
                },
                body: JSON.stringify({
                  currentPassword,
                  newPassword: nextPassword,
                  confirmPassword,
                }),
              });

              const data = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(data.msg || "Impossible de modifier le mot de passe.");
              }

              setSuccessMessage("Mot de passe mis à jour avec succès.");
              setTimeout(() => onClose(), 900);
            } catch (error) {
              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : "Erreur lors de la modification du mot de passe."
              );
            } finally {
              setIsLoading(false);
            }
          }}
        >
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400">
              Ancien mot de passe
            </label>
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-navy outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-navy outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10"
              placeholder="••••••••"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400">
              Confirmation
            </label>
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-navy outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          {errorMessage ? (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}
          {successMessage ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-slate-300"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-xl bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

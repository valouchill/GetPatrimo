"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SecuritySettingsModal from "./SecuritySettingsModal";

type UserMenuProps = {
  name?: string;
  plan?: string;
};

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "GP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function UserMenu({
  name = "Utilisateur GetPatrimo",
  plan = "Plan Prestige",
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const initials = useMemo(() => getInitials(name), [name]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setSecurityOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald/60 bg-navy/5 text-[11px] font-semibold text-navy"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initials}
      </button>
      {open ? (
        <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl">
          <div className="px-3 py-3">
            <div className="text-sm font-semibold text-navy">{name}</div>
            <div className="text-xs uppercase tracking-widest text-slate-400">
              {plan}
            </div>
          </div>
          <div className="my-2 h-px bg-slate-100" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSecurityOpen(true);
            }}
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-navy transition hover:bg-slate-50"
          >
            Changer le mot de passe
          </button>
          <div className="my-2 h-px bg-slate-100" />
          <button
            type="button"
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-700/80 transition hover:bg-rose-50"
            onClick={() => {
              window.localStorage.removeItem("token");
              window.location.href = "/login-luxe.html";
            }}
          >
            Déconnexion
          </button>
        </div>
      ) : null}
      <SecuritySettingsModal
        open={securityOpen}
        onClose={() => setSecurityOpen(false)}
      />
    </div>
  );
}

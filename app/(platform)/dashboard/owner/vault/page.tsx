'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FolderLock, FileCheck2, FilePlus2, Upload,
  AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useOwner } from '../OwnerContext';

interface VaultDocument {
  key: string;
  label: string;
  description: string;
  required: boolean;
}

const PROPERTY_DOCS: VaultDocument[] = [
  { key: 'dpe', label: 'DPE', description: 'Diagnostic de Performance Énergétique', required: true },
  { key: 'erp', label: 'ERP', description: "État des Risques et Pollutions", required: true },
  { key: 'carrez', label: 'Loi Carrez', description: 'Attestation de superficie', required: false },
];

const OWNER_DOCS: VaultDocument[] = [
  { key: 'titre-propriete', label: 'Titre de propriété', description: 'Acte notarié ou attestation', required: true },
  { key: 'taxe-fonciere', label: 'Taxe foncière', description: 'Dernier avis de taxe foncière', required: false },
  { key: 'assurance-pno', label: 'Assurance PNO', description: 'Propriétaire Non-Occupant', required: false },
];

const LEASE_DOCS: VaultDocument[] = [
  { key: 'bail', label: 'Bail signé', description: 'Contrat de location généré', required: false },
  { key: 'edl-entree', label: 'État des lieux entrée', description: "Constat d'entrée du locataire", required: false },
  { key: 'caution', label: 'Dépôt de garantie', description: 'Reçu du dépôt de garantie', required: false },
];

interface FolderConfig {
  title: string;
  docs: VaultDocument[];
  icon: typeof FolderLock;
  color: string;
}

const FOLDERS: FolderConfig[] = [
  { title: 'Diagnostics obligatoires', docs: PROPERTY_DOCS, icon: FileCheck2, color: 'text-emerald-600 bg-emerald-50' },
  { title: 'Documents propriétaire', docs: OWNER_DOCS, icon: FolderLock, color: 'text-blue-600 bg-blue-50' },
  { title: 'Pièces du bail', docs: LEASE_DOCS, icon: FilePlus2, color: 'text-amber-600 bg-amber-50' },
];

function VaultFolderCard({ folder }: { folder: FolderConfig }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Set<string>>(new Set());
  const Icon = folder.icon;

  const handleDrop = useCallback((key: string) => {
    setUploaded((prev) => new Set(prev).add(key));
    setDragging(null);
  }, []);

  const doneCount = folder.docs.filter((d) => uploaded.has(d.key)).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${folder.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{folder.title}</h3>
          <p className="text-xs text-slate-400">
            {doneCount}/{folder.docs.length} document{folder.docs.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Documents list */}
      <div className="p-3 flex-1 space-y-2">
        {folder.docs.map((doc) => {
          const isDone = uploaded.has(doc.key);
          const isDraggingHere = dragging === doc.key;

          if (isDone) {
            return (
              <div
                key={doc.key}
                className="flex items-center gap-3 px-3 py-3 rounded-xl bg-emerald-50/70 border border-emerald-100"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{doc.label}</p>
                  <p className="text-xs text-slate-400">{doc.description}</p>
                </div>
              </div>
            );
          }

          return (
            <div
              key={doc.key}
              onDragOver={(e) => { e.preventDefault(); setDragging(doc.key); }}
              onDragLeave={() => setDragging(null)}
              onDrop={(e) => { e.preventDefault(); handleDrop(doc.key); }}
              onClick={() => handleDrop(doc.key)}
              className={`flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl cursor-pointer transition-all
                border-2 border-dashed ${
                  isDraggingHere
                    ? 'border-emerald-500 bg-emerald-50 scale-[1.02]'
                    : 'border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/30'
                }`}
            >
              <div className="flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">{doc.label}</span>
                {doc.required && (
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                )}
              </div>
              <p className="text-xs text-slate-400 text-center">{doc.description}</p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function VaultPage() {
  const { activeEntry, loading } = useOwner();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1
          className="text-3xl font-bold text-slate-900 mb-2"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Coffre-Fort Documentaire
        </h1>
        {activeEntry?.property && (
          <p className="text-slate-500 text-sm">
            Documents liés à{' '}
            <span className="font-medium text-slate-700">
              {activeEntry.property.address || activeEntry.property.title}
            </span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {FOLDERS.map((folder, i) => (
          <VaultFolderCard key={i} folder={folder} />
        ))}
      </div>

      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Bientôt disponible :</span> Upload sécurisé et stockage chiffré de vos documents.
          Les documents seront automatiquement vérifiés par notre IA.
        </p>
      </div>
    </div>
  );
}

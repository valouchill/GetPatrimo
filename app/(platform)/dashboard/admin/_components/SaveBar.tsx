'use client';

interface Props {
  dirty: boolean;
  saving: boolean;
  info: string | null;
  onSave: () => void;
  onReset?: () => void;
}

export default function SaveBar({ dirty, saving, info, onSave, onReset }: Props) {
  if (!dirty && !info) return null;
  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3 flex items-center justify-between z-10 -mx-6 lg:-mx-8 px-6 lg:px-8">
      <div className="text-sm">
        {info && <span className={info.startsWith('❌') ? 'text-red-600' : 'text-green-600'}>{info}</span>}
        {!info && dirty && <span className="text-amber-700">Modifications non enregistrées</span>}
      </div>
      <div className="flex gap-2">
        {onReset && dirty && (
          <button
            onClick={onReset}
            disabled={saving}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Annuler
          </button>
        )}
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

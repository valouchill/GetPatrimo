'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import ConditionPicker from '../components/ConditionPicker';
import PhotoCapture from '../components/PhotoCapture';
import EquipmentPicker from '../components/EquipmentPicker';

interface Equipment {
  name: string;
  condition: string;
  comment: string;
}

interface Photo {
  url: string;
  caption: string;
}

interface Room {
  name: string;
  order: number;
  wallCondition: string;
  floorCondition: string;
  ceilingCondition: string;
  equipment: Equipment[];
  photos: Photo[];
  comment: string;
}

export default function RoomStep({
  room,
  roomIndex,
  inspectionId,
  onUpdate,
}: {
  room: Room;
  roomIndex: number;
  inspectionId: string;
  onUpdate: (roomIndex: number, updatedRoom: Room) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  function update(changes: Partial<Room>) {
    onUpdate(roomIndex, { ...room, ...changes });
  }

  function updateEquipment(eqIdx: number, changes: Partial<Equipment>) {
    const newEq = room.equipment.map((e, i) => (i === eqIdx ? { ...e, ...changes } : e));
    update({ equipment: newEq });
  }

  function removeEquipment(eqIdx: number) {
    update({ equipment: room.equipment.filter((_, i) => i !== eqIdx) });
  }

  function addEquipments(names: string[]) {
    const newItems: Equipment[] = names.map((name) => ({ name, condition: 'BON', comment: '' }));
    update({ equipment: [...room.equipment, ...newItems] });
    setShowPicker(false);
  }

  return (
    <div className="space-y-6">
      {/* Room title */}
      <h2 className="text-xl font-bold text-slate-900">{room.name}</h2>

      {/* Surface conditions */}
      <div className="space-y-4">
        <ConditionPicker label="Murs" value={room.wallCondition} onChange={(v) => update({ wallCondition: v })} />
        <ConditionPicker label="Sol" value={room.floorCondition} onChange={(v) => update({ floorCondition: v })} />
        <ConditionPicker label="Plafond" value={room.ceilingCondition} onChange={(v) => update({ ceilingCondition: v })} />
      </div>

      {/* Equipment */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Équipements</h3>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 rounded-xl bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-100"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter
          </button>
        </div>

        {room.equipment.length === 0 && (
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="w-full rounded-xl border-2 border-dashed border-slate-200 py-6 text-center text-sm text-slate-400 transition-colors hover:border-orange-300 hover:text-orange-500"
          >
            Ajouter des équipements à cette pièce
          </button>
        )}

        {room.equipment.map((eq, i) => (
          <div key={eq.name + i} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{eq.name}</p>
              <button
                type="button"
                onClick={() => removeEquipment(i)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <ConditionPicker label="" value={eq.condition} onChange={(v) => updateEquipment(i, { condition: v })} compact />
            <input
              type="text"
              value={eq.comment}
              onChange={(e) => updateEquipment(i, { comment: e.target.value })}
              placeholder="Commentaire..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        ))}
      </div>

      {/* Photos */}
      <PhotoCapture
        inspectionId={inspectionId}
        roomIndex={roomIndex}
        photos={room.photos}
        onPhotoAdded={(photo) => update({ photos: [...room.photos, photo] })}
        onPhotoRemoved={(idx) => update({ photos: room.photos.filter((_, i) => i !== idx) })}
      />

      {/* Comment */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700">Observations</p>
        <textarea
          value={room.comment || ''}
          onChange={(e) => update({ comment: e.target.value })}
          placeholder="Observations pour cette pièce..."
          rows={3}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
        />
      </div>

      {/* Equipment picker bottom sheet */}
      {showPicker && (
        <EquipmentPicker
          roomName={room.name}
          existingNames={room.equipment.map((e) => e.name)}
          onConfirm={addEquipments}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

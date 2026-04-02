'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';

interface Photo {
  url: string;
  caption: string;
}

export default function PhotoCapture({
  inspectionId,
  roomIndex,
  photos,
  onPhotoAdded,
  onPhotoRemoved,
}: {
  inspectionId: string;
  roomIndex: number;
  photos: Photo[];
  onPhotoAdded: (photo: Photo) => void;
  onPhotoRemoved: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('roomIndex', String(roomIndex));
      const res = await fetch(`/api/inspections/${inspectionId}/photos`, { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        onPhotoAdded({ url: data.url, caption: '' });
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-700">Photos</p>
      <div className="flex flex-wrap gap-3">
        {photos.map((p, i) => (
          <div key={p.url + i} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200">
            <img src={p.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onPhotoRemoved(i)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-orange-400 hover:text-orange-500"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Camera className="h-6 w-6" />
              <span className="text-[10px] font-medium">Photo</span>
            </>
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

export default function ProfilePhotoField({ initialPhoto, disabled, onBusy }: {
  initialPhoto?: string | null; disabled: boolean; onBusy: (busy: boolean) => void;
}) {
  const [photo, setPhoto] = useState(initialPhoto ?? '');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function choose(file?: File) {
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a JPG, PNG or WebP image up to 5 MB.'); return;
    }
    setProcessing(true); onBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('This image could not be opened.')); img.src = url; });
      if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 40000000) throw new Error('Choose an image smaller than 40 megapixels.');
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 160;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Your browser could not prepare this image.');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 160, 160);
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 160, 160);
      const result = canvas.toDataURL('image/jpeg', 0.8);
      if (result.length > 60000) throw new Error('Please choose a simpler or smaller image.');
      if (mounted.current) setPhoto(result);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Could not open photo.'); }
    finally { URL.revokeObjectURL(url); if (mounted.current) { setProcessing(false); onBusy(false); } }
  }
  return <div className="profile-photo-field">
    <div className="profile-photo-preview">{photo ? <img src={photo} alt="Employee profile preview" /> : <span>No photo</span>}</div>
    <div className="profile-photo-controls">
      <label>Profile picture <span className="optional">optional</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || processing}
          onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void choose(file); }} />
      </label>
      <small>JPG, PNG or WebP · Up to 5 MB. A square crop is saved when you save changes.</small>
      {photo && <button type="button" className="text-button" disabled={disabled || processing} onClick={() => { setPhoto(''); setError(''); }}>Remove photo</button>}
      {processing && <p role="status">Preparing photo…</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
    <input type="hidden" name="profilePhoto" value={photo} />
  </div>;
}

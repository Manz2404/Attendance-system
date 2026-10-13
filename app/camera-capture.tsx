'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, LoaderCircle, ScanFace, X } from 'lucide-react';

export default function CameraCapture({ mode, punchKind = 'IN', disabled = false, beforeCapture, onCapture, onClose }: {
  mode: 'enroll' | 'scan'; disabled?: boolean; beforeCapture?: () => Promise<string>;
  punchKind?: 'IN' | 'OUT';
  onCapture: (images: string[], challenge?: string) => Promise<void>; onClose?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null), generation = useRef(0), mounted = useRef(true);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]), [deviceId, setDeviceId] = useState('');
  function stop() { generation.current++; stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; if (video.current) video.current.srcObject = null; if (mounted.current) setReady(false); }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; stream.current?.getTracks().forEach(t => t.stop()); }; }, []);
  async function start() {
    stop(); const current = generation.current; setBusy(true); setError(''); setStatus('Opening camera…');
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs localhost or HTTPS. Open the kiosk on this laptop, or use your HTTPS domain.');
      const camera = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }) } });
      if (!mounted.current || current !== generation.current) { camera.getTracks().forEach(t => t.stop()); return; }
      stream.current = camera;
      if (!video.current) { stop(); return; }
      video.current.srcObject = camera; await video.current.play();
      if (!mounted.current || current !== generation.current) return;
      const cameras = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      if (!mounted.current || current !== generation.current) return;
      setDevices(cameras); setReady(true); setStatus('Position one face inside the guide.');
    } catch (e) { if (!mounted.current || current !== generation.current) return; stop(); setBusy(false); setStatus(''); setError(e instanceof Error && e.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser, or use your PIN.' : e instanceof Error ? e.message : 'Could not open the camera.'); }
    finally { if (mounted.current && current === generation.current) setBusy(false); }
  }
  async function capture() {
    if (!ready || busy || disabled) return;
    const current = generation.current, images: string[] = []; setBusy(true); setError('');
    try {
      setStatus('Preparing your scan…'); const challenge = beforeCapture ? await beforeCapture() : undefined;
      if (current !== generation.current || !mounted.current) return;
      for (let i = 0; i < 3; i++) {
        setStatus(i === 1 ? (mode === 'scan' ? 'Turn your head gently to either side.' : 'Turn slightly to one side.') : 'Look straight at the camera.');
        await new Promise(resolve => setTimeout(resolve, i === 0 ? 1600 : 2400));
        if (current !== generation.current || !mounted.current) throw new Error('Scan cancelled.');
        const source = video.current;
        if (!source?.videoWidth || !source.videoHeight) throw new Error('The camera stopped. Start it again.');
        const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 300;
        const context = canvas.getContext('2d'); if (!context) throw new Error('Could not capture the camera.');
        const aspect = 4 / 3, width = Math.min(source.videoWidth, source.videoHeight * aspect), height = width / aspect;
        context.drawImage(source, (source.videoWidth - width) / 2, (source.videoHeight - height) / 2, width, height, 0, 0, 400, 300);
        images.push(canvas.toDataURL('image/jpeg', 0.85)); canvas.width = 0; canvas.height = 0;
      }
      setStatus(mode === 'scan' ? 'Comparing your face on the attendance server…' : 'Saving encrypted face enrollment…');
      await onCapture(images, challenge);
    } catch (e) { if (mounted.current && current === generation.current) setError(e instanceof Error ? e.message : 'Scan failed. Please retry.'); }
    finally { images.fill(''); if (mounted.current && current === generation.current) { stop(); setBusy(false); setStatus(''); } }
  }
  return <div className="face-capture">
    <div className="face-preview"><video ref={video} autoPlay playsInline muted aria-label="Camera preview" /><div className="face-guide" aria-hidden="true" />{!ready && <div className="face-camera-placeholder"><Camera size={30} /><span>Camera preview</span></div>}</div>
    {devices.length > 1 && <label>Camera<select value={deviceId} disabled={busy} onChange={e => { stop(); setDeviceId(e.target.value); }}><option value="">Default camera</option>{devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}</select></label>}
    <p className="face-instruction" role="status" aria-live="polite">{status || 'Use even lighting and keep one person in view.'}</p>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <div className="kiosk-admin-actions">{!ready ? <button type="button" className="button secondary" disabled={busy || disabled} onClick={start}>{busy ? <LoaderCircle className="spin" size={17} /> : <Camera size={17} />}Start camera</button> : <button type="button" className="button primary" disabled={busy || disabled} onClick={capture}>{busy ? <LoaderCircle className="spin" size={17} /> : <ScanFace size={17} />}{busy ? 'Processing…' : mode === 'scan' ? `Scan face & clock ${punchKind === 'OUT' ? 'out' : 'in'}` : 'Capture enrollment'}</button>}
      {(ready || busy) && <button type="button" className="button secondary" onClick={() => { stop(); setBusy(false); setStatus(''); }}>Stop camera</button>}
      {onClose && <button type="button" className="text-button" onClick={() => { stop(); onClose(); }}><X size={16} />Close</button>}
    </div><p className="kiosk-hint">Camera photos are processed on your attendance server and discarded. Only encrypted face templates are saved.</p>
  </div>;
}

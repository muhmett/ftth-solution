'use client';

import { useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Activation des notifications sur l'appareil courant (Android / navigateur).
export default function PushToggle() {
  const [state, setState] = useState('loading'); // loading | unsupported | off | on | denied
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('unsupported'));
  }, []);

  async function enable() {
    setBusy(true);
    setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState('denied'); return; }

      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch('/api/push/subscribe')).json();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) { setError((await res.json()).error || 'Erreur'); return; }
      setState('on');
    } catch (e) {
      setError("Impossible d'activer les notifications sur cet appareil.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading' || state === 'unsupported') return null;

  return (
    <div className="card p-3 flex items-center gap-3 text-sm">
      <span className="text-lg">{state === 'on' ? '🔔' : '🔕'}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">Notifications</div>
        <div className="text-xs text-gray-500">
          {state === 'on' && 'Activées sur cet appareil'}
          {state === 'off' && 'Être prévenu dès qu\'un ticket est affecté'}
          {state === 'denied' && 'Bloquées — autorisez-les dans les réglages du navigateur'}
          {error && <span className="text-red-600 block">{error}</span>}
        </div>
      </div>
      {state === 'off' && (
        <button className="btn-primary text-xs py-1.5" disabled={busy} onClick={enable}>
          Activer
        </button>
      )}
      {state === 'on' && (
        <button className="btn-secondary text-xs py-1.5" disabled={busy} onClick={disable}>
          Désactiver
        </button>
      )}
    </div>
  );
}

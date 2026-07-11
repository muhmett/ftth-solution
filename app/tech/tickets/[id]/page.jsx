'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PHOTO_TYPES, REQUIRED_PHOTOS, BLOCKAGE_REASONS } from '@/lib/constants';
import { TypeBadge, StatusBadge } from '@/components/Badges';

export default function TechTicketDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [powerDb, setPowerDb] = useState('');
  const [routerSn, setRouterSn] = useState('');
  const [comment, setComment] = useState('');
  const [showBlock, setShowBlock] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [uploadType, setUploadType] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tickets/${id}`);
    if (!res.ok) { router.replace('/tech'); return; }
    const d = await res.json();
    setData(d);
    if (d.ticket.power_db != null) setPowerDb(String(d.ticket.power_db));
    if (d.ticket.router_sn) setRouterSn(d.ticket.router_sn);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  async function act(action, extra = {}) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error); return false; }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  function pickPhoto(type) {
    setUploadType(type);
    // Laisse React mettre à jour avant d'ouvrir la caméra
    setTimeout(() => fileRef.current?.click(), 0);
  }

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadType) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('photo_type', uploadType);
      const res = await fetch(`/api/tickets/${id}/photos`, { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) { setError(d.error); return; }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto(photoId) {
    if (!confirm('Supprimer cette photo ?')) return;
    await fetch(`/api/tickets/${id}/photos?photo_id=${photoId}`, { method: 'DELETE' });
    load();
  }

  if (!data) return <p className="text-center text-gray-500 py-8">Chargement…</p>;
  const { ticket, photos, history } = data;
  const required = REQUIRED_PHOTOS[ticket.type] || [];
  const photoTypesDone = new Set(photos.map((p) => p.photo_type));
  const missing = required.filter((r) => !photoTypesDone.has(r));
  const isProd = ticket.type !== 'SAV';
  const editable = ['AFFECTE', 'EN_COURS'].includes(ticket.status);
  const canRealize = editable && missing.length === 0 && (!isProd || powerDb !== '');

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={uploadPhoto} />

      <div className="flex items-center gap-2">
        <Link href="/tech" className="text-gray-400 text-xl px-1">←</Link>
        <span className="font-mono font-bold text-lg">{ticket.reference}</span>
        <TypeBadge type={ticket.type} />
        <span className="ml-auto"><StatusBadge status={ticket.status} /></span>
      </div>

      {/* Infos client */}
      <div className="card p-4 space-y-1 text-sm">
        <div className="font-bold text-base">{ticket.client_name || 'Client non renseigné'}</div>
        <div className="text-gray-600">{ticket.address}{ticket.city ? `, ${ticket.city}` : ''}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-gray-700">
          {ticket.client_phone && (
            <a href={`tel:${ticket.client_phone}`} className="text-brand-600 font-semibold">📞 {ticket.client_phone}</a>
          )}
          {ticket.rdv_date && <span>📅 {ticket.rdv_date}</span>}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
          {ticket.nd && <div><span className="text-gray-400">ND:</span> <b>{ticket.nd}</b></div>}
          {ticket.pbo && <div><span className="text-gray-400">PBO:</span> <b>{ticket.pbo}</b></div>}
          {ticket.pto && <div><span className="text-gray-400">PTO:</span> <b>{ticket.pto}</b></div>}
          {ticket.operator && <div><span className="text-gray-400">Infra:</span> <b>{ticket.operator}</b></div>}
        </div>
        {ticket.notes && <p className="text-xs bg-gray-50 rounded-lg p-2 mt-2 whitespace-pre-wrap">{ticket.notes}</p>}
        {ticket.address && (
          <a className="btn-secondary w-full mt-2"
            href={`https://www.google.com/maps/search/${encodeURIComponent(ticket.address + ' ' + (ticket.city || ''))}`}
            target="_blank" rel="noreferrer">
            🗺️ Ouvrir dans Maps
          </a>
        )}
      </div>

      {error && <div className="card border-red-300 bg-red-50 p-3 text-sm text-red-800 font-medium">{error}</div>}

      {/* Démarrer */}
      {ticket.status === 'AFFECTE' && (
        <button className="btn-primary w-full py-3 text-base" disabled={busy} onClick={() => act('start')}>
          ▶️ Démarrer l&apos;intervention
        </button>
      )}

      {/* Blocage affiché */}
      {ticket.status === 'BLOQUE' && (
        <div className="card border-red-300 bg-red-50 p-4">
          <div className="font-bold text-red-800">🚫 Bloqué — {BLOCKAGE_REASONS[ticket.blockage_reason]}</div>
          {ticket.blockage_comment && <p className="text-sm text-red-700 mt-1">{ticket.blockage_comment}</p>}
          <p className="text-xs text-red-500 mt-2">Le coordinateur va replanifier ce ticket.</p>
        </div>
      )}

      {ticket.status === 'REALISE' && (
        <div className="card border-lime-300 bg-lime-50 p-4 text-sm text-lime-800 font-medium">
          ✓ Intervention clôturée — en attente de validation par la coordination.
        </div>
      )}
      {ticket.status === 'VALIDE' && (
        <div className="card border-green-300 bg-green-50 p-4 text-sm text-green-800 font-medium">
          ✅ Ticket validé. Bon travail !
        </div>
      )}

      {/* Photos de preuve */}
      <div className="card p-4">
        <h2 className="font-bold mb-1">Photos de preuve</h2>
        <p className="text-xs text-gray-500 mb-3">
          Obligatoires pour clôturer : {required.map((r) => PHOTO_TYPES[r]).join(', ')}
        </p>
        <div className="space-y-2">
          {required.map((type) => {
            const done = photoTypesDone.has(type);
            return (
              <div key={type} className={`flex items-center gap-3 rounded-lg border p-2 ${
                done ? 'border-green-300 bg-green-50' : 'border-gray-200'
              }`}>
                <span className="text-lg">{done ? '✅' : '📷'}</span>
                <span className="text-sm font-medium flex-1">{PHOTO_TYPES[type]}</span>
                {editable && (
                  <button className="btn-secondary text-xs py-1" disabled={busy} onClick={() => pickPhoto(type)}>
                    {done ? '+ Ajouter' : 'Prendre'}
                  </button>
                )}
              </div>
            );
          })}
          {editable && (
            <button className="btn-secondary w-full text-xs" disabled={busy} onClick={() => pickPhoto('AUTRE')}>
              + Autre photo (façade, PBO…)
            </button>
          )}
        </div>

        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {photos.map((p) => (
              <div key={p.id} className="relative border border-gray-200 rounded-lg overflow-hidden">
                <a href={`/api/photos/${p.file_path}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/photos/${p.file_path}`} alt={p.photo_type} className="w-full h-24 object-cover" />
                </a>
                <div className="text-[10px] font-semibold px-1 py-0.5 bg-gray-50 truncate">
                  {PHOTO_TYPES[p.photo_type] || p.photo_type}
                </div>
                {editable && (
                  <button onClick={() => deletePhoto(p.id)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 text-xs">✕</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clôture */}
      {editable && (
        <div className="card p-4 space-y-3">
          <h2 className="font-bold">Clôturer l&apos;intervention</h2>
          {isProd && (
            <>
              <div>
                <label className="label">Puissance mesurée au photomètre (dB) *</label>
                <input className="input" type="number" step="0.1" placeholder="-18.5"
                  value={powerDb} onChange={(e) => setPowerDb(e.target.value)} />
              </div>
              <div>
                <label className="label">S/N Routeur / ONT</label>
                <input className="input" placeholder="SN…" value={routerSn}
                  onChange={(e) => setRouterSn(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label className="label">Commentaire</label>
            <textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          {missing.length > 0 && (
            <p className="text-xs text-amber-600 font-semibold">
              ⚠️ Photos manquantes : {missing.map((m) => PHOTO_TYPES[m]).join(', ')}
            </p>
          )}
          <button className="btn-success w-full py-3 text-base" disabled={!canRealize || busy}
            onClick={() => act('realize', { power_db: powerDb, router_sn: routerSn, comment })}>
            ✓ Clôturer le ticket
          </button>

          {/* Blocage */}
          {!showBlock ? (
            <button className="btn-secondary w-full text-red-600" onClick={() => setShowBlock(true)}>
              🚫 Déclarer un blocage
            </button>
          ) : (
            <div className="border border-red-200 rounded-lg p-3 space-y-2 bg-red-50">
              <label className="label text-red-700">Motif du blocage *</label>
              <select className="input" value={blockReason} onChange={(e) => setBlockReason(e.target.value)}>
                <option value="">Choisir un motif…</option>
                {Object.entries(BLOCKAGE_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <textarea className="input" rows={2} placeholder="Détails (recommandé)"
                value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn-danger flex-1" disabled={!blockReason || busy}
                  onClick={async () => {
                    if (await act('block', { reason: blockReason, comment })) {
                      setShowBlock(false);
                      setComment('');
                    }
                  }}>
                  Confirmer le blocage
                </button>
                <button className="btn-secondary" onClick={() => setShowBlock(false)}>Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historique */}
      <details className="card p-4">
        <summary className="font-bold text-sm cursor-pointer">Historique ({history.length})</summary>
        <ol className="space-y-2 text-xs mt-3">
          {history.map((h, i) => (
            <li key={i}>
              <span className="text-gray-400">{h.created_at}</span>{' '}
              <b>{h.action}</b>
              {h.detail && <span className="text-gray-600"> — {h.detail}</span>}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

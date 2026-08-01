'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { TICKET_TYPES, BLOCKAGE_REASONS, PHOTO_TYPES } from '@/lib/constants';
import { TypeBadge, StatusBadge } from '@/components/Badges';
import { useIsPercer } from '@/components/UserContext';

export default function AdminTicketDetail() {
  const { id } = useParams();
  const router = useRouter();
  const percer = useIsPercer();
  const [data, setData] = useState(null);
  const [equipes, setEquipes] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [assignTo, setAssignTo] = useState('');
  const [dispatchTo, setDispatchTo] = useState('');
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/tickets/${id}`);
    if (!res.ok) { router.replace('/admin/tickets'); return; }
    setData(await res.json());
  }, [id, router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/users?role=EQUIPE').then((r) => r.json()).then((d) => setEquipes(d.users || []));
    if (percer) {
      fetch('/api/organisations?type=SOUS_TRAITANT').then((r) => r.json())
        .then((d) => setOrgs(d.organisations || []));
    }
  }, [percer]);

  async function act(action, extra = {}) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error); return; }
      setComment('');
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="text-gray-500">Chargement…</p>;
  const { ticket, photos, history } = data;
  const extra = JSON.parse(ticket.extra || '{}');
  const canDispatch = percer && ['NOUVEAU', 'DISPATCHE', 'BLOQUE'].includes(ticket.status);
  const canAssign = ticket.org_id && ['DISPATCHE', 'AFFECTE', 'BLOQUE'].includes(ticket.status);
  const teamsOfOrg = equipes.filter((e) => e.org_id === ticket.org_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/tickets" className="text-gray-400 hover:text-gray-600">← Tickets</Link>
        <h1 className="text-2xl font-black font-mono">{ticket.reference}</h1>
        <TypeBadge type={ticket.type} />
        <StatusBadge status={ticket.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5">
            <h2 className="font-bold mb-4">Informations client & réseau</h2>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Info label="Client" value={ticket.client_name} />
              <Info label="Téléphone" value={ticket.client_phone} link={ticket.client_phone ? `tel:${ticket.client_phone}` : null} />
              <Info label="Adresse" value={ticket.address} />
              <Info label="Ville / Zone" value={[ticket.city, ticket.zone].filter(Boolean).join(' / ')} />
              <Info label="ND / Login" value={ticket.nd} />
              <Info label="PBO" value={ticket.pbo} />
              <Info label="PTO" value={ticket.pto} />
              <Info label="Opérateur (infra)" value={ticket.operator} />
              <Info label="RDV" value={ticket.rdv_date} />
              <Info label="Activité" value={TICKET_TYPES[ticket.type]?.label} />
              {ticket.power_db != null && <Info label="Puissance mesurée" value={`${ticket.power_db} dB`} />}
              {ticket.router_sn && <Info label="S/N Routeur" value={ticket.router_sn} />}
            </dl>
            {ticket.notes && (
              <p className="mt-4 text-sm bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{ticket.notes}</p>
            )}
            {Object.keys(extra).length > 0 && (
              <details className="mt-4 text-xs text-gray-500">
                <summary className="cursor-pointer font-semibold">Autres colonnes importées</summary>
                <dl className="grid sm:grid-cols-2 gap-2 mt-2">
                  {Object.entries(extra).map(([k, val]) => <Info key={k} label={k} value={String(val)} />)}
                </dl>
              </details>
            )}
          </div>

          {ticket.status === 'BLOQUE' && (
            <div className="card border-red-300 bg-red-50 p-5">
              <h2 className="font-bold text-red-800 mb-1">🚫 Ticket bloqué</h2>
              <p className="text-sm text-red-900 font-semibold">
                {BLOCKAGE_REASONS[ticket.blockage_reason] || ticket.blockage_reason}
              </p>
              {ticket.blockage_comment && <p className="text-sm text-red-800 mt-1">{ticket.blockage_comment}</p>}
              <p className="text-xs text-red-600 mt-2">Depuis : {ticket.blocked_at}</p>
            </div>
          )}

          <div className="card p-5">
            <h2 className="font-bold mb-4">Photos de preuve ({photos.length})</h2>
            {photos.length === 0 && <p className="text-sm text-gray-500">Aucune photo pour le moment.</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((p) => (
                <a key={p.id} href={`/api/photos/${p.file_path}`} target="_blank" rel="noreferrer"
                  className="group border border-gray-200 rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/photos/${p.file_path}`} alt={p.photo_type}
                    className="w-full h-32 object-cover group-hover:opacity-90" />
                  <div className="px-2 py-1 text-xs font-semibold bg-gray-50">
                    {PHOTO_TYPES[p.photo_type] || p.photo_type}
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-bold mb-4">Historique</h2>
            <ol className="space-y-2 text-sm">
              {history.map((h, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-gray-400 whitespace-nowrap text-xs pt-0.5">{h.created_at}</span>
                  <div>
                    <span className="font-semibold">{h.action}</span>
                    {h.detail && <span className="text-gray-600"> — {h.detail}</span>}
                    {h.user_name && <span className="text-gray-400 text-xs"> · {h.user_name}</span>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h2 className="font-bold">Actions</h2>
            <dl className="text-sm space-y-1">
              {percer && (
                <div>Sous-traitant : <span className="font-semibold">{ticket.org_name || 'Non réparti'}</span></div>
              )}
              <div>
                Équipe : <span className="font-semibold">{ticket.equipe_name || 'Non affectée'}</span>
                {(ticket.member1 || ticket.member2) && (
                  <span className="text-gray-500 text-xs"> ({[ticket.member1, ticket.member2].filter(Boolean).join(' + ')})</span>
                )}
              </div>
            </dl>

            {canDispatch && (
              <div className="space-y-2 border-t pt-3">
                <label className="label">Répartition</label>
                <select className="input" value={dispatchTo} onChange={(e) => setDispatchTo(e.target.value)}>
                  <option value="">Choisir un sous-traitant…</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <button className="btn-primary w-full" disabled={!dispatchTo || busy}
                  onClick={() => act('dispatch', { org_id: Number(dispatchTo) })}>
                  🚚 {ticket.org_id ? 'Réattribuer' : 'Répartir'}
                </button>
              </div>
            )}

            {canAssign && (
              <div className="space-y-2 border-t pt-3">
                <label className="label">Affectation terrain</label>
                <select className="input" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                  <option value="">Choisir une équipe…</option>
                  {teamsOfOrg.map((e) => (
                    <option key={e.id} value={e.id}>{e.name} ({e.open_tickets} en cours)</option>
                  ))}
                </select>
                <button className="btn-secondary w-full" disabled={!assignTo || busy}
                  onClick={() => act('assign', { equipe_id: Number(assignTo) })}>
                  {ticket.assigned_to ? 'Réaffecter' : 'Affecter'}
                </button>
              </div>
            )}

            <textarea className="input" rows={2} placeholder="Commentaire (optionnel)"
              value={comment} onChange={(e) => setComment(e.target.value)} />

            {ticket.status === 'REALISE' && (
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-success" disabled={busy} onClick={() => act('validate')}>
                  ✓ Contrôler
                </button>
                <button className="btn-danger" disabled={busy}
                  onClick={() => { if (confirm('Renvoyer ce ticket à l\'équipe ?')) act('reject'); }}>
                  ✗ Rejeter
                </button>
              </div>
            )}

            {ticket.status === 'VALIDE_ST' && (percer ? (
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-success" disabled={busy} onClick={() => act('validate')}>
                  ✓ Prononcer la recette
                </button>
                <button className="btn-danger" disabled={busy}
                  onClick={() => { if (confirm('Rejeter la recette ?')) act('reject'); }}>
                  ✗ Rejeter
                </button>
              </div>
            ) : (
              <p className="text-sm text-teal-700 bg-teal-50 rounded-lg p-3">
                Contrôlé le {ticket.validated_st_at} — en attente de recette Percer.
              </p>
            ))}

            {ticket.status === 'BLOQUE' && (
              <button className="btn-primary w-full" disabled={busy} onClick={() => act('unblock')}>
                🔄 Replanifier (débloquer)
              </button>
            )}

            {percer && !['VALIDE', 'ANNULE'].includes(ticket.status) && (
              <button className="btn-secondary w-full text-red-600" disabled={busy}
                onClick={() => { if (confirm('Annuler définitivement ce ticket ?')) act('cancel'); }}>
                Annuler le ticket
              </button>
            )}

            {ticket.status === 'VALIDE' && (
              <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">
                ✓ Recette validée le {ticket.validated_at}
                {ticket.validated_by_name ? ` par ${ticket.validated_by_name}` : ''} — facturable.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, link }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-medium">
        {link && value ? <a className="text-brand-600 hover:underline" href={link}>{value}</a> : value || '—'}
      </dd>
    </div>
  );
}

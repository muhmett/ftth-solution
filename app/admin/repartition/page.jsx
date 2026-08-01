'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TICKET_TYPES } from '@/lib/constants';
import { TypeBadge } from '@/components/Badges';

// Écran Percer : distribuer le lot importé aux sous-traitants.
export default function RepartitionPage() {
  const [tickets, setTickets] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [target, setTarget] = useState('');
  const [zone, setZone] = useState('');
  const [type, setType] = useState('');
  const [result, setResult] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/tickets?undispatched=1&status=NOUVEAU');
    const data = await res.json();
    setTickets(data.tickets || []);
    setSelected(new Set());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/organisations?type=SOUS_TRAITANT').then((r) => r.json())
      .then((d) => setOrgs((d.organisations || []).filter((o) => o.active)));
  }, []);

  const zones = useMemo(
    () => [...new Set(tickets.map((t) => t.zone || t.city).filter(Boolean))].sort(),
    [tickets]
  );
  const visible = tickets.filter(
    (t) => (!zone || (t.zone || t.city) === zone) && (!type || t.type === type)
  );

  function toggle(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function dispatch() {
    const res = await fetch('/api/tickets/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_ids: [...selected], org_id: Number(target) }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    setResult(`${data.dispatched} ticket(s) envoyés à ${data.organisation}.`);
    setTarget('');
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Répartition</h1>
        <p className="text-sm text-gray-500">
          Tickets importés en attente d&apos;être confiés à un sous-traitant.
        </p>
      </div>

      {result && (
        <div className="card border-green-300 bg-green-50 p-4 text-sm text-green-800 font-medium">
          ✓ {result}
        </div>
      )}

      {!loading && tickets.length === 0 && (
        <div className="card p-8 text-center space-y-3">
          <p className="text-gray-500">Aucun ticket en attente de répartition.</p>
          <Link className="btn-primary" href="/admin/import">📥 Importer un fichier Excel</Link>
        </div>
      )}

      {tickets.length > 0 && (
        <>
          <div className="card p-3 flex flex-wrap gap-2 items-center">
            <select className="input max-w-[200px]" value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">Toutes zones</option>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <select className="input max-w-[200px]" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Toutes activités</option>
              {Object.entries(TICKET_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button className="btn-secondary"
              onClick={() => setSelected(new Set(visible.map((t) => t.id)))}>
              Tout sélectionner ({visible.length})
            </button>
            {selected.size > 0 && (
              <button className="btn-secondary" onClick={() => setSelected(new Set())}>Vider</button>
            )}
          </div>

          <div className="card p-3 flex flex-wrap items-center gap-3 sticky top-0 z-10 border-brand-500 bg-brand-50">
            <span className="font-semibold text-sm">{selected.size} sélectionné(s)</span>
            <select className="input max-w-[240px]" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Confier à…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} — {o.equipes} équipe(s), {o.tickets_actifs} en cours
                </option>
              ))}
            </select>
            <button className="btn-primary" disabled={!target || !selected.size} onClick={dispatch}>
              🚚 Envoyer le lot
            </button>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Référence</th>
                  <th className="p-3">Activité</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Adresse</th>
                  <th className="p-3">Zone</th>
                  <th className="p-3">RDV</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id}
                    className={`border-b border-gray-50 cursor-pointer ${selected.has(t.id) ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
                    onClick={() => toggle(t.id)}>
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(t.id)} readOnly />
                    </td>
                    <td className="p-3 font-mono font-semibold">{t.reference}</td>
                    <td className="p-3"><TypeBadge type={t.type} /></td>
                    <td className="p-3">{t.client_name || '—'}</td>
                    <td className="p-3 max-w-[220px] truncate" title={t.address}>{t.address || '—'}</td>
                    <td className="p-3">{t.zone || t.city || '—'}</td>
                    <td className="p-3 whitespace-nowrap">{t.rdv_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

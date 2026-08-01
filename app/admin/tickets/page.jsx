'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TICKET_STATUS, TICKET_TYPES, SLA_STATES } from '@/lib/constants';
import { TypeBadge, StatusBadge, SlaBadge } from '@/components/Badges';
import { useIsPercer } from '@/components/UserContext';

function TicketsInner() {
  const sp = useSearchParams();
  const percer = useIsPercer();
  const [tickets, setTickets] = useState([]);
  const [equipes, setEquipes] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [assignTo, setAssignTo] = useState('');
  const [dispatchTo, setDispatchTo] = useState('');
  const [filters, setFilters] = useState({
    status: sp.get('status') || '',
    type: sp.get('type') || '',
    org: sp.get('org') || '',
    sla: sp.get('sla') || '',
    q: '',
    equipe: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    const res = await fetch('/api/tickets?' + params);
    const data = await res.json();
    setTickets(data.tickets || []);
    setSelected(new Set());
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/users?role=EQUIPE').then((r) => r.json()).then((d) => setEquipes(d.users || []));
    if (percer) {
      fetch('/api/organisations?type=SOUS_TRAITANT').then((r) => r.json())
        .then((d) => setOrgs(d.organisations || []));
    }
  }, [percer]);

  function toggle(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  const selectable = tickets.filter((t) => !['VALIDE', 'ANNULE'].includes(t.status));
  // Une équipe ne peut recevoir que des tickets déjà chez son sous-traitant
  const eligibleEquipes = (() => {
    const orgIds = new Set(tickets.filter((t) => selected.has(t.id)).map((t) => t.org_id));
    if (orgIds.size !== 1) return equipes;
    const [only] = [...orgIds];
    return equipes.filter((e) => e.org_id === only);
  })();

  async function bulk(url, body, label) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_ids: [...selected], ...body }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    alert(label(data));
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black tracking-tight">Tickets</h1>
        <span className="text-sm text-gray-500">{tickets.length} résultat(s)</span>
      </div>

      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <input className="input max-w-xs" placeholder="🔍 Réf, client, téléphone, adresse…"
          value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <select className="input max-w-[190px]" value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Tous statuts</option>
          {Object.entries(TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="input max-w-[180px]" value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">Toutes activités</option>
          {Object.entries(TICKET_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {percer && (
          <select className="input max-w-[190px]" value={filters.org}
            onChange={(e) => setFilters({ ...filters, org: e.target.value })}>
            <option value="">Tous sous-traitants</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <select className="input max-w-[190px]" value={filters.equipe}
          onChange={(e) => setFilters({ ...filters, equipe: e.target.value })}>
          <option value="">Toutes équipes</option>
          {equipes.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select className="input max-w-[190px]" value={filters.sla}
          onChange={(e) => setFilters({ ...filters, sla: e.target.value })}>
          <option value="">Tous délais</option>
          {Object.entries(SLA_STATES).filter(([k]) => k !== 'SANS_DELAI')
            .map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="card p-3 flex flex-wrap items-center gap-3 bg-brand-50 border-brand-500">
          <span className="font-semibold text-sm">{selected.size} sélectionné(s)</span>
          {percer && (
            <>
              <select className="input max-w-[220px]" value={dispatchTo}
                onChange={(e) => setDispatchTo(e.target.value)}>
                <option value="">Répartir vers…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.tickets_actifs} actifs)</option>
                ))}
              </select>
              <button className="btn-primary" disabled={!dispatchTo}
                onClick={() => bulk('/api/tickets/dispatch', { org_id: Number(dispatchTo) },
                  (d) => `${d.dispatched} ticket(s) répartis vers ${d.organisation}`)}>
                🚚 Répartir
              </button>
              <span className="text-gray-300">|</span>
            </>
          )}
          <select className="input max-w-[220px]" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">Affecter à une équipe…</option>
            {eligibleEquipes.map((e) => (
              <option key={e.id} value={e.id}>{e.name} ({e.open_tickets} en cours)</option>
            ))}
          </select>
          <button className="btn-secondary" disabled={!assignTo}
            onClick={() => bulk('/api/tickets/assign', { equipe_id: Number(assignTo) },
              (d) => `${d.assigned} ticket(s) affectés à ${d.equipe}`)}>
            Affecter
          </button>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
              <th className="p-3 w-8">
                <input type="checkbox"
                  checked={selectable.length > 0 && selectable.every((t) => selected.has(t.id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(selectable.map((t) => t.id)) : new Set())} />
              </th>
              <th className="p-3">Référence</th>
              <th className="p-3">Activité</th>
              <th className="p-3">Client</th>
              <th className="p-3">Adresse</th>
              <th className="p-3">Échéance</th>
              {percer && <th className="p-3">Sous-traitant</th>}
              <th className="p-3">Équipe</th>
              <th className="p-3">Statut</th>
              <th className="p-3">📷</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="p-6 text-center text-gray-500">Chargement…</td></tr>}
            {!loading && tickets.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-gray-500">
                Aucun ticket. Importez un fichier Excel pour commencer.
              </td></tr>
            )}
            {tickets.map((t) => (
              <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-3">
                  {!['VALIDE', 'ANNULE'].includes(t.status) && (
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                  )}
                </td>
                <td className="p-3">
                  <Link href={`/admin/tickets/${t.id}`} className="font-mono font-semibold text-brand-600 hover:underline">
                    {t.reference}
                  </Link>
                </td>
                <td className="p-3"><TypeBadge type={t.type} /></td>
                <td className="p-3">
                  <div className="font-medium">{t.client_name || '—'}</div>
                  <div className="text-xs text-gray-500">{t.client_phone}</div>
                </td>
                <td className="p-3 max-w-[200px] truncate" title={t.address}>{t.address || '—'}</td>
                <td className="p-3 whitespace-nowrap">
                  <div>{t.rdv_date || t.deadline || '—'}</div>
                  <SlaBadge state={t.sla_state} deadline={t.deadline} />
                </td>
                {percer && (
                  <td className="p-3">{t.org_name || <span className="text-gray-400">Non réparti</span>}</td>
                )}
                <td className="p-3">{t.equipe_name || <span className="text-gray-400">—</span>}</td>
                <td className="p-3"><StatusBadge status={t.status} /></td>
                <td className="p-3 text-center">{t.photo_count > 0 ? t.photo_count : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Chargement…</p>}>
      <TicketsInner />
    </Suspense>
  );
}

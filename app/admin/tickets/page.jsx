'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TICKET_STATUS, TICKET_TYPES } from '@/lib/constants';
import { TypeBadge, StatusBadge } from '@/components/Badges';

function TicketsInner() {
  const sp = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [assignTo, setAssignTo] = useState('');
  const [filters, setFilters] = useState({
    status: sp.get('status') || '',
    type: sp.get('type') || '',
    q: '',
    technicien: '',
    unassigned: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.type) params.set('type', filters.type);
    if (filters.q) params.set('q', filters.q);
    if (filters.technicien) params.set('technicien', filters.technicien);
    if (filters.unassigned) params.set('unassigned', '1');
    const res = await fetch('/api/tickets?' + params);
    const data = await res.json();
    setTickets(data.tickets || []);
    setSelected(new Set());
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/users?role=TECHNICIEN').then((r) => r.json()).then((d) => setTechs(d.users || []));
  }, []);

  function toggle(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  const assignable = tickets.filter((t) => ['NOUVEAU', 'AFFECTE', 'BLOQUE'].includes(t.status));

  async function bulkAssign() {
    if (!assignTo || !selected.size) return;
    const res = await fetch('/api/tickets/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_ids: [...selected], technicien_id: Number(assignTo) }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    alert(`${data.assigned} ticket(s) affecté(s) à ${data.technicien}`);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black tracking-tight">Tickets</h1>
        <span className="text-sm text-gray-500">{tickets.length} résultat(s)</span>
      </div>

      {/* Filtres */}
      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <input
          className="input max-w-xs"
          placeholder="🔍 Réf, client, téléphone, adresse…"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
        <select className="input max-w-[180px]" value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Tous statuts</option>
          {Object.entries(TICKET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="input max-w-[180px]" value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">Toutes activités</option>
          {Object.entries(TICKET_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="input max-w-[180px]" value={filters.technicien}
          onChange={(e) => setFilters({ ...filters, technicien: e.target.value, unassigned: false })}>
          <option value="">Tous techniciens</option>
          {techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={filters.unassigned}
            onChange={(e) => setFilters({ ...filters, unassigned: e.target.checked, technicien: '' })} />
          Non affectés
        </label>
      </div>

      {/* Barre d'affectation en masse */}
      {selected.size > 0 && (
        <div className="card p-3 flex flex-wrap items-center gap-3 bg-brand-50 border-brand-500">
          <span className="font-semibold text-sm">{selected.size} sélectionné(s)</span>
          <select className="input max-w-[220px]" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">Choisir un technicien…</option>
            {techs.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.open_tickets} en cours)</option>
            ))}
          </select>
          <button className="btn-primary" onClick={bulkAssign} disabled={!assignTo}>Affecter</button>
        </div>
      )}

      {/* Tableau */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
              <th className="p-3 w-8">
                <input type="checkbox"
                  checked={assignable.length > 0 && assignable.every((t) => selected.has(t.id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(assignable.map((t) => t.id)) : new Set())} />
              </th>
              <th className="p-3">Référence</th>
              <th className="p-3">Activité</th>
              <th className="p-3">Client</th>
              <th className="p-3">Adresse</th>
              <th className="p-3">RDV</th>
              <th className="p-3">Technicien</th>
              <th className="p-3">Statut</th>
              <th className="p-3">📷</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="p-6 text-center text-gray-500">Chargement…</td></tr>}
            {!loading && tickets.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-gray-500">Aucun ticket. Importez un fichier Excel pour commencer.</td></tr>
            )}
            {tickets.map((t) => (
              <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-3">
                  {['NOUVEAU', 'AFFECTE', 'BLOQUE'].includes(t.status) && (
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
                <td className="p-3 max-w-[220px] truncate" title={t.address}>{t.address || '—'}</td>
                <td className="p-3 whitespace-nowrap">{t.rdv_date || '—'}</td>
                <td className="p-3">{t.technicien_name || <span className="text-gray-400">Non affecté</span>}</td>
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

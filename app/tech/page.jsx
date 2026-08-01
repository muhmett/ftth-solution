'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TypeBadge, StatusBadge } from '@/components/Badges';
import { BLOCKAGE_REASONS } from '@/lib/constants';

const TABS = [
  { key: 'todo', label: 'À faire', statuses: 'AFFECTE,EN_COURS' },
  { key: 'blocked', label: 'Bloqués', statuses: 'BLOQUE' },
  { key: 'done', label: 'Terminés', statuses: 'REALISE,VALIDE_ST,VALIDE' },
];

export default function TechHome() {
  const [tab, setTab] = useState('todo');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = TABS.find((t) => t.key === tab);
    setLoading(true);
    fetch(`/api/tickets?status=${t.statuses}`)
      .then((r) => r.json())
      .then((d) => setTickets(d.tickets || []))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="space-y-3">
      {/* Onglets */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
              tab === t.key ? 'bg-brand-500 text-white' : 'text-gray-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-gray-500 py-8">Chargement…</p>}
      {!loading && tickets.length === 0 && (
        <p className="text-center text-gray-500 py-8">
          {tab === 'todo' ? '🎉 Aucun ticket en attente' : 'Aucun ticket'}
        </p>
      )}

      {tickets.map((t) => (
        <Link key={t.id} href={`/tech/tickets/${t.id}`}
          className="card block p-4 active:bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono font-bold">{t.reference}</span>
            <TypeBadge type={t.type} />
            <span className="ml-auto"><StatusBadge status={t.status} /></span>
          </div>
          <div className="text-sm font-semibold">{t.client_name || 'Client non renseigné'}</div>
          <div className="text-sm text-gray-600">{t.address}{t.city ? `, ${t.city}` : ''}</div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {t.rdv_date && <span>📅 {t.rdv_date}</span>}
            {t.client_phone && <span>📞 {t.client_phone}</span>}
            {t.photo_count > 0 && <span>📷 {t.photo_count}</span>}
          </div>
          {t.status === 'BLOQUE' && t.blockage_reason && (
            <div className="mt-2 text-xs font-semibold text-red-600">
              🚫 {BLOCKAGE_REASONS[t.blockage_reason] || t.blockage_reason}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}

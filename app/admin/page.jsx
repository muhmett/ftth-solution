'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TICKET_STATUS, TICKET_TYPES, BLOCKAGE_REASONS } from '@/lib/constants';
import { TypeBadge } from '@/components/Badges';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then(setStats);
  }, []);

  if (!stats) return <p className="text-gray-500">Chargement…</p>;

  const statCards = [
    { key: 'NOUVEAU', href: '/admin/tickets?status=NOUVEAU' },
    { key: 'AFFECTE', href: '/admin/tickets?status=AFFECTE' },
    { key: 'EN_COURS', href: '/admin/tickets?status=EN_COURS' },
    { key: 'REALISE', href: '/admin/tickets?status=REALISE' },
    { key: 'VALIDE', href: '/admin/tickets?status=VALIDE' },
    { key: 'BLOQUE', href: '/admin/tickets?status=BLOQUE' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black tracking-tight">Tableau de bord</h1>

      {/* Compteurs par statut */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(({ key, href }) => (
          <Link key={key} href={href} className="card p-4 hover:border-brand-500 transition-colors">
            <div className="text-3xl font-black">{stats.byStatus[key] || 0}</div>
            <div className={`badge mt-1 ${TICKET_STATUS[key].color}`}>{TICKET_STATUS[key].label}</div>
          </Link>
        ))}
      </div>

      {/* Alertes blocage — ne pas laisser trainer */}
      {stats.blockedAlerts.length > 0 && (
        <div className="card border-red-300 bg-red-50 p-4">
          <h2 className="font-bold text-red-800 mb-2">
            ⚠️ {stats.blockedAlerts.length} ticket(s) bloqué(s) depuis plus de 24h — à replanifier
          </h2>
          <div className="space-y-1">
            {stats.blockedAlerts.map((t) => (
              <Link key={t.id} href={`/admin/tickets/${t.id}`}
                className="flex flex-wrap items-center gap-2 text-sm text-red-900 hover:underline">
                <span className="font-mono font-semibold">{t.reference}</span>
                <TypeBadge type={t.type} />
                <span>{t.client_name}</span>
                <span className="text-red-600">— {BLOCKAGE_REASONS[t.blockage_reason] || t.blockage_reason}</span>
                <span className="ml-auto font-semibold">{t.hours_blocked}h</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* À valider */}
        <div className="card p-4">
          <h2 className="font-bold mb-3">✅ Réalisés — en attente de validation ({stats.toValidate.length})</h2>
          {stats.toValidate.length === 0 && <p className="text-sm text-gray-500">Rien à valider.</p>}
          <div className="space-y-2">
            {stats.toValidate.map((t) => (
              <Link key={t.id} href={`/admin/tickets/${t.id}`}
                className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                <span className="font-mono font-semibold">{t.reference}</span>
                <TypeBadge type={t.type} />
                <span className="truncate">{t.client_name}</span>
                <span className="ml-auto text-gray-500 whitespace-nowrap">
                  {t.power_db != null ? `${t.power_db} dB · ` : ''}{t.technicien_name}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Charge par technicien */}
        <div className="card p-4">
          <h2 className="font-bold mb-3">👷 Équipe terrain</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2">Technicien</th>
                <th className="text-center">En cours</th>
                <th className="text-center">Réalisés</th>
                <th className="text-center">Validés 30j</th>
                <th className="text-center">Bloqués</th>
              </tr>
            </thead>
            <tbody>
              {stats.perTech.map((t) => (
                <tr key={t.id} className="border-b border-gray-50">
                  <td className="py-2 font-medium">
                    {t.name}
                    {t.zone && <span className="text-xs text-gray-400 ml-1">({t.zone})</span>}
                  </td>
                  <td className="text-center">{t.en_cours}</td>
                  <td className="text-center">{t.realises}</td>
                  <td className="text-center font-semibold text-green-700">{t.valides_30j}</td>
                  <td className={`text-center font-semibold ${t.bloques > 0 ? 'text-red-600' : ''}`}>{t.bloques}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* En cours par type */}
      <div className="card p-4">
        <h2 className="font-bold mb-3">Tickets actifs par activité</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(TICKET_TYPES).map(([key, t]) => (
            <Link key={key} href={`/admin/tickets?type=${key}`}
              className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-2 hover:border-brand-500">
              <span className={`badge ${t.color}`}>{t.label}</span>
              <span className="font-black text-lg">{stats.byType[key] || 0}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TICKET_STATUS, TICKET_TYPES, BLOCKAGE_REASONS, SLA_STATES } from '@/lib/constants';
import { TypeBadge, SlaBadge } from '@/components/Badges';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then(setStats);
  }, []);

  if (!stats) return <p className="text-gray-500">Chargement…</p>;
  const percer = stats.scope === 'PERCER';

  // Percer suit la répartition ; le sous-traitant part de ce qu'il a reçu
  const cards = percer
    ? ['NOUVEAU', 'DISPATCHE', 'EN_COURS', 'REALISE', 'VALIDE_ST', 'VALIDE', 'BLOQUE']
    : ['DISPATCHE', 'AFFECTE', 'EN_COURS', 'REALISE', 'VALIDE_ST', 'VALIDE', 'BLOQUE'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-gray-500">
          {percer ? 'Vue consolidée de tous les sous-traitants' : stats.orgName}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {cards.map((key) => (
          <Link key={key} href={`/admin/tickets?status=${key}`}
            className="card p-4 hover:border-brand-500 transition-colors">
            <div className="text-3xl font-black">{stats.byStatus[key] || 0}</div>
            <div className={`badge mt-1 ${TICKET_STATUS[key].color}`}>{TICKET_STATUS[key].label}</div>
          </Link>
        ))}
      </div>

      {/* Percer : ce qui n'est pas encore chez un sous-traitant */}
      {percer && (stats.byStatus.NOUVEAU || 0) > 0 && (
        <div className="card border-brand-500 bg-brand-50 p-4 flex flex-wrap items-center gap-3">
          <span className="font-bold text-brand-700">
            📦 {stats.byStatus.NOUVEAU} ticket(s) en attente de répartition
          </span>
          <Link className="btn-primary ml-auto" href="/admin/repartition">Répartir maintenant</Link>
        </div>
      )}

      {/* Respect des délais contractuels */}
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-xs text-gray-500">Délais respectés (30 derniers jours)</div>
          <div className="text-3xl font-black mt-1">
            {stats.slaRate.pct === null ? '—' : `${stats.slaRate.pct}%`}
          </div>
          <div className="text-xs text-gray-400">
            {stats.slaRate.respectes} sur {stats.slaRate.total} interventions
          </div>
        </div>
        <div className="lg:col-span-2 card p-4">
          <div className="text-xs text-gray-500 mb-2">Tickets ouverts par échéance</div>
          <div className="flex flex-wrap gap-2">
            {['EN_RETARD', 'A_RISQUE', 'A_LHEURE'].map((k) => (
              <Link key={k} href={`/admin/tickets?sla=${k}`}
                className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 hover:border-brand-500">
                <span className={`badge ${SLA_STATES[k].color}`}>{SLA_STATES[k].label}</span>
                <span className="font-black">{stats.bySla[k] || 0}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {stats.slaAlerts.length > 0 && (
        <div className="card border-amber-300 bg-amber-50 p-4">
          <h2 className="font-bold text-amber-900 mb-2">
            ⏱️ {stats.slaAlerts.length} ticket(s) en retard ou à échéance proche
          </h2>
          <div className="space-y-1">
            {stats.slaAlerts.map((t) => (
              <Link key={t.id} href={`/admin/tickets/${t.id}`}
                className="flex flex-wrap items-center gap-2 text-sm text-amber-900 hover:underline">
                <span className="font-mono font-semibold">{t.reference}</span>
                <TypeBadge type={t.type} />
                <span>{t.client_name}</span>
                {percer && t.org_name && <span className="text-amber-700 text-xs">({t.org_name})</span>}
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-xs">{t.deadline}</span>
                  <SlaBadge state={t.sla_state} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

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
                {percer && t.org_name && <span className="text-red-500 text-xs">({t.org_name})</span>}
                <span className="ml-auto font-semibold">{t.hours_blocked}h</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-4">
          <h2 className="font-bold mb-3">
            {percer
              ? `✅ Recette à prononcer (${stats.toValidate.length})`
              : `✅ À contrôler avant envoi à Percer (${stats.toValidate.length})`}
          </h2>
          {stats.toValidate.length === 0 && <p className="text-sm text-gray-500">Rien en attente.</p>}
          <div className="space-y-2">
            {stats.toValidate.map((t) => (
              <Link key={t.id} href={`/admin/tickets/${t.id}`}
                className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                <span className="font-mono font-semibold">{t.reference}</span>
                <TypeBadge type={t.type} />
                <span className="truncate">{t.client_name}</span>
                <span className="ml-auto text-gray-500 whitespace-nowrap text-xs">
                  {t.power_db != null ? `${t.power_db} dB · ` : ''}
                  {percer ? t.org_name : t.equipe_name}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="font-bold mb-3">{percer ? '🏢 Sous-traitants' : '👷 Équipes terrain'}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-2">{percer ? 'Société' : 'Équipe'}</th>
                  <th className="text-center">En cours</th>
                  <th className="text-center">À contrôler</th>
                  <th className="text-center">Validés 30j</th>
                  <th className="text-center">Bloqués</th>
                </tr>
              </thead>
              <tbody>
                {stats.breakdown.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="py-2 font-medium">
                      {r.name}
                      {r.detail && <span className="text-xs text-gray-400 ml-1">({r.detail})</span>}
                    </td>
                    <td className="text-center">{r.en_cours}</td>
                    <td className="text-center">{r.a_controler}</td>
                    <td className="text-center font-semibold text-green-700">{r.valides_30j}</td>
                    <td className={`text-center font-semibold ${r.bloques > 0 ? 'text-red-600' : ''}`}>{r.bloques}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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

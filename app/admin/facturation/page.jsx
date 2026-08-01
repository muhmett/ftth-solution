'use client';

import { useCallback, useEffect, useState } from 'react';
import { TICKET_TYPES, CURRENCY } from '@/lib/constants';
import { TypeBadge } from '@/components/Badges';
import { useIsPercer } from '@/components/UserContext';

const money = (n) => `${(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${CURRENCY}`;

export default function FacturationPage() {
  const percer = useIsPercer();
  const [data, setData] = useState(null);
  const [orgId, setOrgId] = useState('');
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (orgId) params.set('org', orgId);
    if (month) params.set('month', month);
    const res = await fetch('/api/facturation?' + params);
    const d = await res.json();
    setData(d);
    // Le serveur choisit le dernier mois facturé tant qu'aucun n'est sélectionné
    if (!month && d.month) setMonth(d.month);
    setLoading(false);
  }, [orgId, month]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <p className="text-gray-500">Chargement…</p>;

  const exportUrl = `/api/facturation/export?month=${month}${orgId ? `&org=${orgId}` : ''}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Attachement mensuel</h1>
        <p className="text-sm text-gray-500">
          Tickets dont la recette a été prononcée dans le mois, valorisés au tarif contractuel.
        </p>
      </div>

      <div className="card p-3 flex flex-wrap gap-2 items-center">
        {percer && (
          <select className="input max-w-[220px]" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            <option value="">Tous les sous-traitants</option>
            {(data?.organisations || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <select className="input max-w-[160px]" value={month} onChange={(e) => setMonth(e.target.value)}>
          {(data?.months || []).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        {(orgId || !percer) && (
          <a className="btn-primary ml-auto" href={exportUrl}>⬇️ Export Excel</a>
        )}
      </div>

      {/* Vue Percer sans sélection : une ligne par sous-traitant */}
      {data?.summary && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
                <th className="p-3">Sous-traitant</th>
                <th className="p-3 text-center">Interventions</th>
                <th className="p-3 text-center">Hors délai</th>
                <th className="p-3 text-right">Brut</th>
                <th className="p-3 text-right">Retenues</th>
                <th className="p-3 text-right">Net à payer</th>
              </tr>
            </thead>
            <tbody>
              {data.summary.map((s) => (
                <tr key={s.org.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setOrgId(String(s.org.id))}>
                  <td className="p-3 font-medium">{s.org.name}</td>
                  <td className="p-3 text-center">{s.totals.count}</td>
                  <td className={`p-3 text-center ${s.totals.late ? 'text-orange-600 font-semibold' : ''}`}>
                    {s.totals.late}
                  </td>
                  <td className="p-3 text-right">{money(s.totals.brut)}</td>
                  <td className={`p-3 text-right ${s.totals.penalites ? 'text-red-600' : ''}`}>
                    {s.totals.penalites ? `- ${money(s.totals.penalites)}` : '—'}
                  </td>
                  <td className="p-3 text-right font-bold">{money(s.totals.net)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-bold">
                <td className="p-3">TOTAL</td>
                <td className="p-3 text-center">{data.summary.reduce((s, x) => s + x.totals.count, 0)}</td>
                <td className="p-3 text-center">{data.summary.reduce((s, x) => s + x.totals.late, 0)}</td>
                <td className="p-3 text-right">{money(data.summary.reduce((s, x) => s + x.totals.brut, 0))}</td>
                <td className="p-3 text-right">{money(data.summary.reduce((s, x) => s + x.totals.penalites, 0))}</td>
                <td className="p-3 text-right">{money(data.summary.reduce((s, x) => s + x.totals.net, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Détail d'un sous-traitant */}
      {data?.totals && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Interventions validées" value={data.totals.count} />
            <Kpi label="Montant brut" value={money(data.totals.brut)} />
            <Kpi label="Retenues de retard" value={money(data.totals.penalites)}
              tone={data.totals.penalites ? 'red' : ''} />
            <Kpi label="Net à payer" value={money(data.totals.net)} tone="green" />
          </div>

          <div className="card p-4">
            <h2 className="font-bold mb-3">Récapitulatif par activité — {data.org?.name} · {data.month}</h2>
            {data.byType.length === 0 && (
              <p className="text-sm text-gray-500">Aucune recette prononcée sur ce mois.</p>
            )}
            {data.byType.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="py-2">Activité</th>
                      <th className="text-center">Quantité</th>
                      <th className="text-right">Prix unitaire</th>
                      <th className="text-right">Brut</th>
                      <th className="text-right">Retenues</th>
                      <th className="text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byType.map((r) => (
                      <tr key={r.type} className="border-b border-gray-50">
                        <td className="py-2"><TypeBadge type={r.type} /> <span className="ml-1">{TICKET_TYPES[r.type].label}</span></td>
                        <td className="text-center">{r.count}</td>
                        <td className="text-right">{money(r.unit_price)}</td>
                        <td className="text-right">{money(r.brut)}</td>
                        <td className="text-right">{r.penalites ? `- ${money(r.penalites)}` : '—'}</td>
                        <td className="text-right font-semibold">{money(r.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {data.lines.length > 0 && (
            <details className="card p-4">
              <summary className="font-bold cursor-pointer">
                Détail ticket par ticket ({data.lines.length})
              </summary>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="py-2">Référence</th>
                      <th>Activité</th>
                      <th>Client</th>
                      <th>Équipe</th>
                      <th>Recette</th>
                      <th className="text-right">Prix</th>
                      <th className="text-right">Retenue</th>
                      <th className="text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.map((l) => (
                      <tr key={l.id} className="border-b border-gray-50">
                        <td className="py-2 font-mono">{l.reference}</td>
                        <td><TypeBadge type={l.type} /></td>
                        <td className="max-w-[160px] truncate">{l.client_name}</td>
                        <td className="text-xs">{l.equipe_name}</td>
                        <td className="text-xs whitespace-nowrap">
                          {l.validated_at}
                          {l.late && <span className="badge bg-orange-100 text-orange-800 ml-1">retard</span>}
                        </td>
                        <td className="text-right">{money(l.unit_price)}</td>
                        <td className="text-right text-red-600">{l.penalty ? `- ${money(l.penalty)}` : '—'}</td>
                        <td className="text-right font-semibold">{money(l.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }) {
  const color = tone === 'green' ? 'text-green-700' : tone === 'red' ? 'text-red-600' : '';
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-black mt-1 ${color}`}>{value}</div>
    </div>
  );
}

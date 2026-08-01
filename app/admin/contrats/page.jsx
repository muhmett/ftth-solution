'use client';

import { useCallback, useEffect, useState } from 'react';
import { TICKET_TYPES, CURRENCY } from '@/lib/constants';
import { useIsPercer } from '@/components/UserContext';

// Conditions négociées avec chaque sous-traitant : prix de l'intervention,
// délai accordé et retenue en cas de dépassement.
export default function ContratsPage() {
  const percer = useIsPercer();
  const [orgs, setOrgs] = useState([]);
  const [orgId, setOrgId] = useState('');
  const [terms, setTerms] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (id) => {
    const res = await fetch('/api/contrats' + (id ? `?org=${id}` : ''));
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setOrgs(data.organisations || []);
    setTerms(data.terms || []);
    if (!id && data.organisations?.length && !percer) setOrgId(String(data.organisations[0].id));
    if (data.org_id) setOrgId(String(data.org_id));
  }, [percer]);

  useEffect(() => {
    // Un sous-traitant n'a qu'une société : ses conditions se chargent d'office
    load(percer ? '' : undefined);
  }, [load, percer]);

  useEffect(() => {
    if (orgId) load(orgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  function setField(type, field, value) {
    setTerms((prev) => prev.map((t) => (t.ticket_type === type ? { ...t, [field]: value } : t)));
  }

  async function save() {
    setBusy(true);
    setSaved('');
    setError('');
    try {
      const res = await fetch('/api/contrats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: Number(orgId), terms }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSaved('Conditions enregistrées. Les échéances des tickets en cours ont été recalculées.');
      load(orgId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Conditions contractuelles</h1>
        <p className="text-sm text-gray-500">
          {percer
            ? 'Prix et délais par sous-traitant. Ils servent au calcul de l\'attachement mensuel et au suivi des retards.'
            : 'Conditions appliquées par Percer à votre société.'}
        </p>
      </div>

      {percer && (
        <div className="card p-3">
          <label className="label">Sous-traitant</label>
          <select className="input max-w-sm" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            <option value="">Choisir…</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}

      {error && <div className="card border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {saved && <div className="card border-green-300 bg-green-50 p-4 text-sm text-green-800">✓ {saved}</div>}

      {orgId && terms.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
                <th className="p-3">Activité</th>
                <th className="p-3">Prix unitaire ({CURRENCY})</th>
                <th className="p-3">Délai accordé (h)</th>
                <th className="p-3">Retenue si retard (%)</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.ticket_type} className="border-b border-gray-50">
                  <td className="p-3">
                    <span className={`badge ${TICKET_TYPES[t.ticket_type].color}`}>
                      {TICKET_TYPES[t.ticket_type].label}
                    </span>
                    {!t.configured && <span className="text-xs text-gray-400 ml-2">non saisi</span>}
                  </td>
                  <td className="p-3">
                    <input className="input max-w-[130px]" type="number" min="0" step="10"
                      disabled={!percer} value={t.unit_price}
                      onChange={(e) => setField(t.ticket_type, 'unit_price', e.target.value)} />
                  </td>
                  <td className="p-3">
                    <input className="input max-w-[110px]" type="number" min="1" step="1"
                      disabled={!percer} value={t.sla_hours}
                      onChange={(e) => setField(t.ticket_type, 'sla_hours', e.target.value)} />
                  </td>
                  <td className="p-3">
                    <input className="input max-w-[110px]" type="number" min="0" max="100" step="5"
                      disabled={!percer} value={t.penalty_rate}
                      onChange={(e) => setField(t.ticket_type, 'penalty_rate', e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {percer && (
            <div className="p-3 border-t flex items-center gap-3">
              <button className="btn-primary" disabled={busy} onClick={save}>Enregistrer</button>
              <span className="text-xs text-gray-500">
                Le délai sert uniquement aux tickets sans rendez-vous client : sinon l&apos;échéance
                est la date du RDV.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

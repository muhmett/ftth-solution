'use client';

import { useCallback, useEffect, useState } from 'react';
import { MOVEMENT_KINDS } from '@/lib/constants';
import { useIsPercer } from '@/components/UserContext';

const EMPTY_MOVE = { kind: '', material_id: '', quantity: '', equipe_id: '', note: '' };

export default function StockPage() {
  const percer = useIsPercer();
  const [data, setData] = useState(null);
  const [orgId, setOrgId] = useState('');
  const [materials, setMaterials] = useState([]);
  const [equipes, setEquipes] = useState([]);
  const [movements, setMovements] = useState([]);
  const [move, setMove] = useState(EMPTY_MOVE);
  const [newMat, setNewMat] = useState({ reference: '', label: '', unit: 'unité', min_stock: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/stock' + (orgId ? `?org=${orgId}` : ''));
    const d = await res.json();
    if (!res.ok) { setError(d.error); return; }
    setData(d);
    const mv = await fetch('/api/stock/mouvements' + (orgId ? `?org=${orgId}` : ''));
    setMovements((await mv.json()).movements || []);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/materiel').then((r) => r.json()).then((d) => setMaterials(d.materials || []));
  }, []);
  useEffect(() => {
    // Percer n'attribue pas aux véhicules : il livre le dépôt de la société
    if (percer) return;
    fetch('/api/users?role=EQUIPE').then((r) => r.json()).then((d) => setEquipes(d.users || []));
  }, [percer]);

  // Percer livre le dépôt ; le sous-traitant pilote tout le reste
  const kinds = percer ? ['ENTREE', 'AJUSTEMENT'] : Object.keys(MOVEMENT_KINDS);
  const needsTeam = ['ATTRIBUTION', 'CONSOMMATION'].includes(move.kind);

  async function submitMove(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setDone('');
    try {
      const res = await fetch('/api/stock/mouvements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...move,
          material_id: Number(move.material_id),
          quantity: Number(move.quantity),
          equipe_id: move.equipe_id ? Number(move.equipe_id) : null,
          org_id: percer ? Number(orgId) : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error); return; }
      setDone('Mouvement enregistré.');
      setMove(EMPTY_MOVE);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function createMaterial(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/materiel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMat),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error); return; }
      setNewMat({ reference: '', label: '', unit: 'unité', min_stock: '' });
      const m = await fetch('/api/materiel');
      setMaterials((await m.json()).materials || []);
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="text-gray-500">Chargement…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Stock matériel</h1>
        <p className="text-sm text-gray-500">
          {percer
            ? 'Ce qui a été livré à chaque sous-traitant, et ce qu\'il en reste.'
            : 'Dépôt et véhicules des équipes. Le stock se recalcule à partir des mouvements.'}
        </p>
      </div>

      {percer && (
        <div className="card p-3">
          <label className="label">Sous-traitant</label>
          <select className="input max-w-sm" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            <option value="">Vue consolidée</option>
            {(data.organisations || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}

      {error && <div className="card border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {done && <div className="card border-green-300 bg-green-50 p-4 text-sm text-green-800">✓ {done}</div>}

      {/* Vue Percer consolidée : livré / consommé / restant */}
      {data.scope === 'PERCER' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
                <th className="p-3">Sous-traitant</th>
                <th className="p-3">Référence</th>
                <th className="p-3 text-center">Livré</th>
                <th className="p-3 text-center">Consommé</th>
                <th className="p-3 text-center">Perdu</th>
                <th className="p-3 text-center">Restant</th>
              </tr>
            </thead>
            <tbody>
              {data.consolidated.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-500">
                  Aucun mouvement. Enregistrez une livraison pour commencer.
                </td></tr>
              )}
              {data.consolidated.map((r) => (
                <tr key={`${r.org_id}-${r.material_id}`} className="border-b border-gray-50">
                  <td className="p-3 font-medium">{r.org_name}</td>
                  <td className="p-3">{r.label} <span className="text-xs text-gray-400">({r.reference})</span></td>
                  <td className="p-3 text-center">{r.livre}</td>
                  <td className="p-3 text-center">{r.consomme}</td>
                  <td className={`p-3 text-center ${r.perdu > 0 ? 'text-red-600 font-semibold' : ''}`}>{r.perdu}</td>
                  <td className="p-3 text-center font-bold">{r.restant} <span className="text-xs font-normal text-gray-400">{r.unit}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vue société : niveaux par référence */}
      {data.scope === 'ORG' && (
        <>
          {data.alerts.length > 0 && (
            <div className="card border-amber-300 bg-amber-50 p-4">
              <h2 className="font-bold text-amber-900 mb-1">⚠️ Références sous le seuil</h2>
              <ul className="text-sm text-amber-900 list-disc pl-5">
                {data.alerts.map((a) => (
                  <li key={a.id}>
                    {a.label} — {a.depot + a.equipes} {a.unit} restants (seuil : {a.min_stock})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
                  <th className="p-3">Référence</th>
                  <th className="p-3 text-center">Dépôt</th>
                  <th className="p-3 text-center">En véhicule</th>
                  <th className="p-3 text-center">Total</th>
                  <th className="p-3 text-center">Consommé</th>
                </tr>
              </thead>
              <tbody>
                {data.levels.map((s) => {
                  const total = s.depot + s.equipes;
                  return (
                    <tr key={s.id} className={`border-b border-gray-50 ${!s.active ? 'opacity-40' : ''}`}>
                      <td className="p-3">
                        <div className="font-medium">{s.label}</div>
                        <div className="text-xs text-gray-400">{s.reference}</div>
                      </td>
                      <td className={`p-3 text-center ${s.depot < 0 ? 'text-red-600 font-bold' : ''}`}>{s.depot}</td>
                      <td className={`p-3 text-center ${s.equipes < 0 ? 'text-red-600 font-bold' : ''}`}>{s.equipes}</td>
                      <td className="p-3 text-center font-bold">
                        {total} <span className="text-xs font-normal text-gray-400">{s.unit}</span>
                      </td>
                      <td className="p-3 text-center text-gray-500">{s.consomme}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data.byTeam.length > 0 && (
            <div className="card p-4">
              <h2 className="font-bold mb-3">Détail par équipe</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(
                  data.byTeam.reduce((acc, r) => {
                    (acc[r.equipe_name] ||= []).push(r);
                    return acc;
                  }, {})
                ).map(([name, items]) => (
                  <div key={name} className="border border-gray-200 rounded-lg p-3">
                    <div className="font-semibold text-sm mb-1">{name}</div>
                    <ul className="text-sm text-gray-600">
                      {items.map((i) => (
                        <li key={i.material_id} className="flex justify-between">
                          <span>{i.label}</span>
                          <span className={`font-semibold ${i.quantity < 0 ? 'text-red-600' : ''}`}>
                            {i.quantity} {i.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Saisie d'un mouvement */}
      {(!percer || orgId) && (
        <form onSubmit={submitMove} className="card p-5 space-y-3">
          <h2 className="font-bold">Enregistrer un mouvement</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <label className="label">Type</label>
              <select className="input" required value={move.kind}
                onChange={(e) => setMove({ ...move, kind: e.target.value, equipe_id: '' })}>
                <option value="">Choisir…</option>
                {kinds.map((k) => (
                  <option key={k} value={k}>{MOVEMENT_KINDS[k].label} — {MOVEMENT_KINDS[k].help}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="label">Référence</label>
              <select className="input" required value={move.material_id}
                onChange={(e) => setMove({ ...move, material_id: e.target.value })}>
                <option value="">Choisir…</option>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.reference})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Quantité</label>
              <input className="input" type="number" step="0.5" required value={move.quantity}
                onChange={(e) => setMove({ ...move, quantity: e.target.value })} />
            </div>
          </div>
          {(needsTeam || (!percer && ['RETOUR', 'PERTE', 'AJUSTEMENT'].includes(move.kind))) && (
            <div>
              <label className="label">Équipe {needsTeam ? '' : '(vide = dépôt)'}</label>
              <select className="input max-w-sm" required={needsTeam} value={move.equipe_id}
                onChange={(e) => setMove({ ...move, equipe_id: e.target.value })}>
                <option value="">{needsTeam ? 'Choisir…' : 'Dépôt'}</option>
                {equipes.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Note (bon de livraison, motif…)</label>
            <input className="input" value={move.note} onChange={(e) => setMove({ ...move, note: e.target.value })} />
          </div>
          <button className="btn-primary" disabled={busy}>Enregistrer</button>
        </form>
      )}

      {/* Catalogue, tenu par Percer */}
      {percer && (
        <form onSubmit={createMaterial} className="card p-5 space-y-3">
          <h2 className="font-bold">Ajouter une référence au catalogue</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="label">Référence</label>
              <input className="input" required placeholder="PTO-STD" value={newMat.reference}
                onChange={(e) => setNewMat({ ...newMat, reference: e.target.value })} />
            </div>
            <div>
              <label className="label">Libellé</label>
              <input className="input" required placeholder="PTO standard" value={newMat.label}
                onChange={(e) => setNewMat({ ...newMat, label: e.target.value })} />
            </div>
            <div>
              <label className="label">Unité</label>
              <input className="input" value={newMat.unit}
                onChange={(e) => setNewMat({ ...newMat, unit: e.target.value })} />
            </div>
            <div>
              <label className="label">Seuil d&apos;alerte</label>
              <input className="input" type="number" min="0" value={newMat.min_stock}
                onChange={(e) => setNewMat({ ...newMat, min_stock: e.target.value })} />
            </div>
          </div>
          <button className="btn-secondary" disabled={busy}>Ajouter</button>
        </form>
      )}

      {/* Journal */}
      <div className="card p-4">
        <h2 className="font-bold mb-3">Derniers mouvements</h2>
        {movements.length === 0 && <p className="text-sm text-gray-500">Aucun mouvement.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <tbody>
              {movements.slice(0, 40).map((m) => (
                <tr key={m.id} className="border-b border-gray-50">
                  <td className="py-2 text-xs text-gray-400 whitespace-nowrap">{m.created_at}</td>
                  <td className="py-2">
                    <span className={`badge ${MOVEMENT_KINDS[m.kind]?.color || ''}`}>
                      {MOVEMENT_KINDS[m.kind]?.label || m.kind}
                    </span>
                  </td>
                  <td className="py-2 font-medium">{m.label}</td>
                  <td className="py-2 text-right font-semibold whitespace-nowrap">{m.quantity} {m.unit}</td>
                  {percer
                    ? <td className="py-2 text-xs text-gray-500">{m.org_name}</td>
                    : <td className="py-2 text-xs text-gray-500">{m.equipe_name || 'Dépôt'}</td>}
                  <td className="py-2 text-xs text-gray-400">
                    {m.ticket_reference || m.note || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

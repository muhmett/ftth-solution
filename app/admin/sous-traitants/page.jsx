'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

export default function SousTraitantsPage() {
  const [orgs, setOrgs] = useState([]);
  const [form, setForm] = useState({ name: '', contact: '' });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/organisations');
    const data = await res.json();
    if (res.ok) setOrgs(data.organisations || []);
    else setError(data.error || 'Erreur');
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(editing ? `/api/organisations/${editing}` : '/api/organisations', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setForm({ name: '', contact: '' });
      setEditing(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(o) {
    await fetch(`/api/organisations/${o.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !o.active }),
    });
    load();
  }

  const sousTraitants = orgs.filter((o) => o.type === 'SOUS_TRAITANT');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Sous-traitants</h1>
        <p className="text-sm text-gray-500">
          Les sociétés à qui Percer confie des tickets. Chacune ne voit que les siens.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={save} className="card p-5 space-y-3 h-fit">
          <h2 className="font-bold">{editing ? 'Modifier' : 'Nouveau sous-traitant'}</h2>
          <div>
            <label className="label">Nom de la société</label>
            <input className="input" value={form.name} required placeholder="Ayline"
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Contact (responsable, téléphone)</label>
            <input className="input" value={form.contact} placeholder="M. Alami — 0600000000"
              onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={busy}>{editing ? 'Enregistrer' : 'Créer'}</button>
            {editing && (
              <button type="button" className="btn-secondary"
                onClick={() => { setEditing(null); setForm({ name: '', contact: '' }); }}>
                Annuler
              </button>
            )}
          </div>
        </form>

        <div className="lg:col-span-2 card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
                <th className="p-3">Société</th>
                <th className="p-3">Contact</th>
                <th className="p-3 text-center">Équipes</th>
                <th className="p-3 text-center">Tickets actifs</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {sousTraitants.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-500">
                  Aucun sous-traitant. Créez-en un pour commencer à répartir.
                </td></tr>
              )}
              {sousTraitants.map((o) => (
                <tr key={o.id} className={`border-b border-gray-50 ${!o.active ? 'opacity-40' : ''}`}>
                  <td className="p-3 font-medium">{o.name}</td>
                  <td className="p-3 text-gray-600">{o.contact || '—'}</td>
                  <td className="p-3 text-center">{o.equipes}</td>
                  <td className="p-3 text-center">
                    <Link className="text-brand-600 hover:underline font-semibold"
                      href={`/admin/tickets?org=${o.id}`}>
                      {o.tickets_actifs}
                    </Link>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <button className="text-brand-600 hover:underline text-xs font-semibold mr-3"
                      onClick={() => { setEditing(o.id); setForm({ name: o.name, contact: o.contact || '' }); }}>
                      Modifier
                    </button>
                    <button className="text-gray-500 hover:underline text-xs font-semibold"
                      onClick={() => toggleActive(o)}>
                      {o.active ? 'Désactiver' : 'Activer'}
                    </button>
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

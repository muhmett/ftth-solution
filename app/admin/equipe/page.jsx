'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROLES } from '@/lib/constants';

const EMPTY = { name: '', phone: '', password: '', role: 'TECHNICIEN', zone: '' };

export default function EquipePage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/users');
    const data = await res.json();
    if (res.ok) setUsers(data.users || []);
    else setError(data.error || 'Erreur');
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const url = editing ? `/api/users/${editing}` : '/api/users';
      const body = { ...form };
      if (editing && !body.password) delete body.password;
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setForm(EMPTY);
      setEditing(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u) {
    await fetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !u.active }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black tracking-tight">Équipe</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Formulaire */}
        <form onSubmit={save} className="card p-5 space-y-3 h-fit">
          <h2 className="font-bold">{editing ? 'Modifier' : 'Nouveau membre'}</h2>
          <div>
            <label className="label">Nom complet</label>
            <input className="input" value={form.name} required
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Téléphone (identifiant de connexion)</label>
            <input className="input" type="tel" value={form.phone} required
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Mot de passe {editing && '(laisser vide pour ne pas changer)'}</label>
            <input className="input" type="text" value={form.password} required={!editing}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label">Rôle</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Zone / Secteur</label>
            <input className="input" value={form.zone} placeholder="Casablanca — Maârif…"
              onChange={(e) => setForm({ ...form, zone: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={busy}>
              {editing ? 'Enregistrer' : 'Créer'}
            </button>
            {editing && (
              <button type="button" className="btn-secondary"
                onClick={() => { setEditing(null); setForm(EMPTY); }}>
                Annuler
              </button>
            )}
          </div>
        </form>

        {/* Liste */}
        <div className="lg:col-span-2 card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
                <th className="p-3">Nom</th>
                <th className="p-3">Téléphone</th>
                <th className="p-3">Rôle</th>
                <th className="p-3">Zone</th>
                <th className="p-3">Tickets en cours</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={`border-b border-gray-50 ${!u.active ? 'opacity-40' : ''}`}>
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3 font-mono">{u.phone}</td>
                  <td className="p-3">{ROLES[u.role]}</td>
                  <td className="p-3">{u.zone || '—'}</td>
                  <td className="p-3">{u.role === 'TECHNICIEN' ? u.open_tickets : '—'}</td>
                  <td className="p-3 whitespace-nowrap">
                    <button className="text-brand-600 hover:underline text-xs font-semibold mr-3"
                      onClick={() => {
                        setEditing(u.id);
                        setForm({ name: u.name, phone: u.phone, password: '', role: u.role, zone: u.zone || '' });
                      }}>
                      Modifier
                    </button>
                    <button className="text-gray-500 hover:underline text-xs font-semibold"
                      onClick={() => toggleActive(u)}>
                      {u.active ? 'Désactiver' : 'Activer'}
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

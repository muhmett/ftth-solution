'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROLES } from '@/lib/constants';
import { useUser, useIsPercer } from '@/components/UserContext';

const EMPTY_ST = { name: '', phone: '', password: '', role: 'EQUIPE', zone: '', member1: '', member2: '', org_id: '' };
const EMPTY_PERCER = { ...EMPTY_ST, role: 'ST_COORD' };

export default function EquipesPage() {
  const user = useUser();
  const percer = useIsPercer();
  const EMPTY = percer ? EMPTY_PERCER : EMPTY_ST;
  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
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
  useEffect(() => {
    if (percer) {
      fetch('/api/organisations').then((r) => r.json()).then((d) => setOrgs(d.organisations || []));
    }
  }, [percer]);

  // Percer gère ses comptes et les coordinateurs de ses sous-traitants ;
  // les équipes sont créées par la société qui les emploie.
  const availableRoles = percer
    ? ['PERCER_ADMIN', 'PERCER_COORD', 'ST_COORD']
    : ['ST_COORD', 'EQUIPE'];

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...form };
      if (editing && !body.password) delete body.password;
      if (!percer) delete body.org_id;
      const res = await fetch(editing ? `/api/users/${editing}` : '/api/users', {
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
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !u.active }),
    });
    if (!res.ok) setError((await res.json()).error);
    load();
  }

  const isEquipe = form.role === 'EQUIPE';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">
          {percer ? 'Comptes' : 'Équipes & comptes'}
        </h1>
        <p className="text-sm text-gray-500">
          {percer
            ? "Vos comptes et les coordinateurs de vos sous-traitants. Chaque sous-traitant gère lui-même ses équipes."
            : 'Une équipe = un compte partagé par le binôme qui intervient sur le terrain.'}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={save} className="card p-5 space-y-3 h-fit">
          <h2 className="font-bold">{editing ? 'Modifier le compte' : 'Nouveau compte'}</h2>

          <div>
            <label className="label">Rôle</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {availableRoles.map((k) => <option key={k} value={k}>{ROLES[k]}</option>)}
            </select>
          </div>

          {percer && !editing && (
            <div>
              <label className="label">Société</label>
              <select className="input" value={form.org_id}
                onChange={(e) => setForm({ ...form, org_id: e.target.value })}>
                <option value="">{user?.org_name} (Percer)</option>
                {orgs.filter((o) => o.type === 'SOUS_TRAITANT').map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">{isEquipe ? "Nom de l'équipe" : 'Nom complet'}</label>
            <input className="input" value={form.name} required
              placeholder={isEquipe ? 'Équipe 1 — Maârif' : 'Prénom Nom'}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          {isEquipe && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Intervenant 1</label>
                <input className="input" value={form.member1}
                  onChange={(e) => setForm({ ...form, member1: e.target.value })} />
              </div>
              <div>
                <label className="label">Intervenant 2</label>
                <input className="input" value={form.member2}
                  onChange={(e) => setForm({ ...form, member2: e.target.value })} />
              </div>
            </div>
          )}

          <div>
            <label className="label">Téléphone (identifiant de connexion)</label>
            <input className="input" type="tel" value={form.phone} required
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Mot de passe {editing && '(vide = inchangé)'}</label>
            <input className="input" type="text" value={form.password} required={!editing}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label">Zone / Secteur</label>
            <input className="input" value={form.zone} placeholder="Casablanca — Maârif"
              onChange={(e) => setForm({ ...form, zone: e.target.value })} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={busy}>{editing ? 'Enregistrer' : 'Créer'}</button>
            {editing && (
              <button type="button" className="btn-secondary"
                onClick={() => { setEditing(null); setForm(EMPTY); }}>Annuler</button>
            )}
          </div>
        </form>

        <div className="lg:col-span-2 card overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
                <th className="p-3">Nom</th>
                {percer && <th className="p-3">Société</th>}
                <th className="p-3">Rôle</th>
                <th className="p-3">Téléphone</th>
                <th className="p-3 text-center">En cours</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={`border-b border-gray-50 ${!u.active ? 'opacity-40' : ''}`}>
                  <td className="p-3">
                    <div className="font-medium">{u.name}</div>
                    {(u.member1 || u.member2) && (
                      <div className="text-xs text-gray-500">
                        {[u.member1, u.member2].filter(Boolean).join(' + ')}
                      </div>
                    )}
                    {u.zone && <div className="text-xs text-gray-400">{u.zone}</div>}
                  </td>
                  {percer && <td className="p-3">{u.org_name}</td>}
                  <td className="p-3 text-xs">{ROLES[u.role]}</td>
                  <td className="p-3 font-mono">{u.phone}</td>
                  <td className="p-3 text-center">{u.role === 'EQUIPE' ? u.open_tickets : '—'}</td>
                  <td className="p-3 whitespace-nowrap">
                    <button className="text-brand-600 hover:underline text-xs font-semibold mr-3"
                      onClick={() => {
                        setEditing(u.id);
                        setForm({
                          name: u.name, phone: u.phone, password: '', role: u.role,
                          zone: u.zone || '', member1: u.member1 || '', member2: u.member2 || '',
                          org_id: String(u.org_id),
                        });
                      }}>
                      Modifier
                    </button>
                    {u.id !== user?.id && (
                      <button className="text-gray-500 hover:underline text-xs font-semibold"
                        onClick={() => toggleActive(u)}>
                        {u.active ? 'Désactiver' : 'Activer'}
                      </button>
                    )}
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

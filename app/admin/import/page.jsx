'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TICKET_TYPES } from '@/lib/constants';
import { useIsPercer } from '@/components/UserContext';

const TARGET_FIELDS = {
  '': '— Ignorer —',
  reference: 'Référence *',
  type: 'Type / Activité',
  client_name: 'Nom client',
  client_phone: 'Téléphone client',
  address: 'Adresse',
  city: 'Ville',
  zone: 'Zone / Secteur',
  pbo: 'PBO',
  pto: 'PTO',
  nd: 'ND / Login',
  operator: 'Opérateur (infra)',
  rdv_date: 'Date RDV',
  notes: 'Commentaire',
};

export default function ImportPage() {
  const percer = useIsPercer();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState([]);
  const [defaultType, setDefaultType] = useState('FTTH');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function analyze(f) {
    setError('');
    setResult(null);
    setPreview(null);
    setFile(f);
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('mode', 'preview');
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setPreview(data);
      setMapping(data.mapping);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', 'commit');
      fd.append('mapping', JSON.stringify(mapping));
      fd.append('default_type', defaultType);
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data);
      setPreview(null);
      setFile(null);
    } finally {
      setBusy(false);
    }
  }

  const referenceMapped = mapping.some((m) => m.field === 'reference');

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-black tracking-tight">Import Excel</h1>
      <p className="text-sm text-gray-600">
        {percer
          ? "Importez le fichier des tickets reçu de l'opérateur. Les tickets créés partent en attente de répartition vers vos sous-traitants."
          : 'Importez le fichier des tickets reçu de Percer. Les tickets créés arrivent directement dans votre société, prêts à être affectés à une équipe.'}
        {' '}Les colonnes sont détectées automatiquement — vérifiez le mapping avant de confirmer.
      </p>

      {/* Étape 1 : fichier */}
      <div className="card p-5">
        <label className="label">Fichier (.xlsx, .xls ou .csv)</label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="block w-full text-sm file:mr-4 file:btn-primary file:border-0"
          onChange={(e) => analyze(e.target.files?.[0] || null)}
        />
      </div>

      {error && <div className="card border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {busy && <p className="text-gray-500">Traitement…</p>}

      {/* Étape 2 : mapping */}
      {preview && (
        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-bold">Mapping des colonnes</h2>
            <span className="badge bg-brand-100 text-brand-700">{preview.total} lignes détectées</span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mapping.map((m, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3">
                <div className="text-xs font-mono text-gray-500 truncate mb-1" title={m.header}>
                  {m.header || `Colonne ${i + 1}`}
                </div>
                <select
                  className="input"
                  value={m.field}
                  onChange={(e) => {
                    const next = [...mapping];
                    next[i] = { ...m, field: e.target.value };
                    setMapping(next);
                  }}
                >
                  {Object.entries(TARGET_FIELDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div>
            <label className="label">Type par défaut (si la colonne type est absente ou vide)</label>
            <select className="input max-w-xs" value={defaultType} onChange={(e) => setDefaultType(e.target.value)}>
              {Object.entries(TICKET_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          {/* Aperçu */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="text-xs min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  {preview.headers.map((h, i) => (
                    <th key={i} className="p-2 text-left font-semibold whitespace-nowrap">
                      {h}
                      {mapping[i]?.field && (
                        <div className="text-brand-600 font-normal">→ {TARGET_FIELDS[mapping[i].field]}</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((row, ri) => (
                  <tr key={ri} className="border-t border-gray-100">
                    {row.map((c, ci) => <td key={ci} className="p-2 whitespace-nowrap max-w-[160px] truncate">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!referenceMapped && (
            <p className="text-sm text-red-600 font-semibold">
              ⚠️ Vous devez mapper une colonne sur « Référence » pour importer.
            </p>
          )}
          <button className="btn-primary" disabled={!referenceMapped || busy} onClick={commit}>
            📥 Importer {preview.total} tickets
          </button>
        </div>
      )}

      {/* Résultat */}
      {result && (
        <div className="card border-green-300 bg-green-50 p-5 space-y-2">
          <h2 className="font-bold text-green-800">✓ Import terminé</h2>
          <p className="text-sm text-green-900">
            {result.created} ticket(s) créé(s), {result.skipped} ignoré(s).
          </p>
          {result.errors?.length > 0 && (
            <ul className="text-xs text-green-800 list-disc pl-5">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <div className="flex gap-3 pt-2">
            {percer ? (
              <Link className="btn-primary" href="/admin/repartition">
                Répartir ces tickets entre les sous-traitants →
              </Link>
            ) : (
              <Link className="btn-primary" href="/admin/tickets?status=DISPATCHE">
                Affecter ces tickets aux équipes →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

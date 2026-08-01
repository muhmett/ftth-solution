import { TICKET_TYPES, TICKET_STATUS, SLA_STATES } from '@/lib/constants';

export function TypeBadge({ type }) {
  const t = TICKET_TYPES[type] || { short: type, color: 'bg-gray-100 text-gray-800' };
  return <span className={`badge ${t.color}`}>{t.short}</span>;
}

export function StatusBadge({ status }) {
  const s = TICKET_STATUS[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
  return <span className={`badge ${s.color}`}>{s.label}</span>;
}

export function SlaBadge({ state, deadline, full = false }) {
  if (!state || state === 'SANS_DELAI') return null;
  const s = SLA_STATES[state];
  return (
    <span className={`badge ${s.color}`} title={deadline ? `Échéance : ${deadline}` : undefined}>
      {full ? s.label : s.short}
      {full && deadline ? ` · ${deadline}` : ''}
    </span>
  );
}

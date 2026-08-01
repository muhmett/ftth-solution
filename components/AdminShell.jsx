'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import FiberBackground from '@/components/FiberBackground';
import { UserProvider } from '@/components/UserContext';
import { ROLES, PERCER_ROLES } from '@/lib/constants';

export default function AdminShell({ user, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const percer = PERCER_ROLES.includes(user.role);

  const nav = [
    { href: '/admin', label: 'Tableau de bord', icon: '📊' },
    { href: '/admin/tickets', label: 'Tickets', icon: '🎫' },
    percer && { href: '/admin/repartition', label: 'Répartition', icon: '🚚' },
    { href: '/admin/import', label: 'Import Excel', icon: '📥' },
    { href: '/admin/stock', label: 'Stock', icon: '📦' },
    { href: '/admin/facturation', label: 'Facturation', icon: '💰' },
    { href: '/admin/contrats', label: 'Contrats', icon: '📋' },
    percer && { href: '/admin/sous-traitants', label: 'Sous-traitants', icon: '🏢' },
    { href: '/admin/equipes', label: 'Équipes', icon: '👷' },
  ].filter(Boolean);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-60 bg-gray-900 text-white md:min-h-screen flex md:flex-col items-center md:items-stretch justify-between md:justify-start px-4 py-3 md:py-6 sticky top-0 z-20">
        <div className="flex items-center gap-2 md:mb-8">
          <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center font-black text-lg">P</div>
          <div className="hidden md:block min-w-0">
            <div className="font-black tracking-tight leading-none truncate">{user.org_name}</div>
            <div className="text-[10px] text-gray-400">
              {percer ? "Donneur d'ordre" : 'Sous-traitant'} · FTTH
            </div>
          </div>
        </div>
        <nav className="flex md:flex-col gap-1 md:flex-1 overflow-x-auto">
          {nav.map((item) => {
            const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
                  active ? 'bg-brand-500 text-white' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="md:border-t md:border-gray-700 md:pt-4 flex items-center gap-2">
          <div className="hidden md:block flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{user.name}</div>
            <div className="text-xs text-gray-400 truncate">{ROLES[user.role]}</div>
          </div>
          <button onClick={logout} title="Déconnexion" className="text-gray-400 hover:text-white text-lg">⏻</button>
        </div>
      </aside>
      <div className="relative flex-1 overflow-hidden">
        <FiberBackground intensity="subtle" className="!fixed text-gray-500" />
        <main className="relative p-4 md:p-8 max-w-7xl w-full mx-auto">
          <UserProvider user={user}>{children}</UserProvider>
        </main>
      </div>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import FiberBackground from '@/components/FiberBackground';

export default function TechShell({ user, children }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="relative min-h-screen bg-gray-100 max-w-lg mx-auto flex flex-col overflow-hidden">
      <FiberBackground intensity="subtle" className="text-gray-500" />
      <header className="relative bg-gray-900 text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-20 overflow-hidden">
        <FiberBackground intensity="bright" className="text-gray-600" />
        <div className="relative w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center font-black">P</div>
        <div className="relative flex-1 min-w-0">
          <div className="font-bold text-sm leading-none truncate">{user.name}</div>
          <div className="text-[11px] text-gray-400">Technicien{user.zone ? ` · ${user.zone}` : ''}</div>
        </div>
        <button onClick={logout} className="relative text-gray-400 hover:text-white" title="Déconnexion">⏻</button>
      </header>
      <main className="relative flex-1 p-3 pb-8">{children}</main>
    </div>
  );
}

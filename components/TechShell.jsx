'use client';

import { useRouter } from 'next/navigation';

export default function TechShell({ user, children }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-100 max-w-lg mx-auto flex flex-col">
      <header className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center font-black">P</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm leading-none truncate">{user.name}</div>
          <div className="text-[11px] text-gray-400">Technicien{user.zone ? ` · ${user.zone}` : ''}</div>
        </div>
        <button onClick={logout} className="text-gray-400 hover:text-white" title="Déconnexion">⏻</button>
      </header>
      <main className="flex-1 p-3 pb-8">{children}</main>
    </div>
  );
}

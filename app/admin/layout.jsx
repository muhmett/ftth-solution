import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import AdminShell from '@/components/AdminShell';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }) {
  const user = getSessionUser();
  if (!user) redirect('/login');
  if (user.role === 'EQUIPE') redirect('/tech');
  return <AdminShell user={user}>{children}</AdminShell>;
}

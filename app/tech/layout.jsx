import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import TechShell from '@/components/TechShell';

export const dynamic = 'force-dynamic';

export default function TechLayout({ children }) {
  const user = getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'TECHNICIEN') redirect('/admin');
  return <TechShell user={user}>{children}</TechShell>;
}

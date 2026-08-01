import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import Landing from '@/components/Landing';

export const dynamic = 'force-dynamic';

// Page publique de présentation. Un utilisateur déjà connecté est renvoyé
// directement vers son espace.
export default function Home() {
  const user = getSessionUser();
  if (user) redirect(user.role === 'EQUIPE' ? '/tech' : '/admin');
  return <Landing />;
}

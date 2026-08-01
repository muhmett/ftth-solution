import { apiHandler } from '@/lib/auth';

// Version réellement déployée. Volontairement public et sans authentification :
// sert à vérifier qu'un serveur tourne bien le dernier build.
export const GET = apiHandler(async () => Response.json({
  commit: process.env.NEXT_PUBLIC_BUILD_COMMIT || 'inconnu',
  built_at: process.env.NEXT_PUBLIC_BUILD_DATE || 'inconnu',
  features: {
    multi_societe: true,
    // Le donneur d'ordre ne voit ni les équipes ni les intervenants
    cloisonnement_equipes: true,
    contrats_facturation: true,
    stock_materiel: true,
  },
}));

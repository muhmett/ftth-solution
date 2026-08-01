import Link from 'next/link';
import FiberBackground from '@/components/FiberBackground';
import { TICKET_TYPES } from '@/lib/constants';

const CHAINE = [
  { titre: 'Orange', role: 'Opérateur', detail: 'Émet les commandes de raccordement et de SAV.' },
  { titre: 'Percer', role: "Donneur d'ordre", detail: 'Importe, répartit entre ses sous-traitants, prononce la recette.' },
  { titre: 'Sous-traitants', role: 'Ayline, et les autres', detail: 'Affectent aux équipes et contrôlent la qualité.' },
  { titre: 'Équipes', role: 'Binômes terrain', detail: "Interviennent, photographient, mesurent, clôturent." },
];

const CYCLE = [
  { code: 'NOUVEAU', label: 'Importé', qui: 'Percer' },
  { code: 'DISPATCHE', label: 'Réparti', qui: 'Percer' },
  { code: 'AFFECTE', label: 'Affecté', qui: 'Sous-traitant' },
  { code: 'EN_COURS', label: 'En cours', qui: 'Équipe' },
  { code: 'REALISE', label: 'Réalisé', qui: 'Équipe' },
  { code: 'VALIDE_ST', label: 'Contrôlé', qui: 'Sous-traitant' },
  { code: 'VALIDE', label: 'Recette', qui: 'Percer' },
];

const PERCER_STEPS = [
  {
    titre: 'Importer le fichier de l\'opérateur',
    detail: "Le fichier Excel reçu d'Orange est déposé tel quel. Les colonnes sont reconnues automatiquement (référence, client, adresse, PBO, RDV) ainsi que le type d'activité. Les doublons déjà en cours sont ignorés.",
  },
  {
    titre: 'Répartir les lots',
    detail: "L'écran de répartition regroupe les tickets par zone ou par activité. Le coordinateur sélectionne un lot et le confie à un sous-traitant, en voyant la charge déjà en cours de chacun. Le sous-traitant les reçoit immédiatement : plus aucun fichier ne circule.",
  },
  {
    titre: 'Suivre sans relancer',
    detail: "Le tableau de bord affiche l'avancement de chaque sous-traitant, le taux de respect des délais, les tickets dont l'échéance approche et ceux bloqués depuis plus de 24 h. L'information remonte d'elle-même.",
  },
  {
    titre: 'Prononcer la recette',
    detail: "Les tickets déjà contrôlés par le sous-traitant arrivent avec leurs photos et leur mesure optique. Le coordinateur valide, ou rejette avec un motif — le ticket repart alors chez l'équipe. Seule la recette rend une intervention facturable.",
  },
  {
    titre: "Éditer l'attachement",
    detail: "En fin de mois, le décompte est déjà fait : interventions validées, valorisées au tarif du contrat, retenues de retard déduites. Export Excel en un clic, récapitulatif et détail ticket par ticket.",
  },
];

const ST_STEPS = [
  {
    titre: 'Recevoir son lot',
    detail: "Les tickets confiés par Percer apparaissent directement dans l'espace du sous-traitant. Il ne voit que les siens : les tickets des autres sous-traitants lui sont invisibles.",
  },
  {
    titre: 'Affecter aux équipes',
    detail: "Affectation en masse ou ticket par ticket, avec le nombre d'interventions déjà en cours pour chaque équipe. L'équipe est prévenue sur son téléphone.",
  },
  {
    titre: 'Gérer le matériel',
    detail: "Le dépôt reçoit les livraisons, le coordinateur dote chaque véhicule en PTO, ONT et câble. Les consommations remontent des interventions, et une alerte se déclenche sous le seuil.",
  },
  {
    titre: 'Contrôler avant de transmettre',
    detail: "Chaque intervention clôturée est vérifiée : photos lisibles, mesure cohérente, matériel déclaré. Ce qui ne va pas repart à l'équipe avant d'arriver chez Percer — les rejets coûteux sont évités en amont.",
  },
  {
    titre: 'Suivre sa facturation',
    detail: "Le sous-traitant consulte le même décompte que Percer, en temps réel. Un écart se constate en cours de mois, plus au moment de la facture.",
  },
];

const EQUIPE_STEPS = [
  {
    titre: 'Recevoir le ticket',
    detail: "Une notification arrive sur le téléphone. L'équipe voit le client, l'adresse, le ND, le PBO et l'heure du rendez-vous. Un geste pour appeler le client, un autre pour ouvrir l'itinéraire.",
  },
  {
    titre: "Démarrer l'intervention",
    detail: "Le ticket passe en cours dès l'arrivée sur place. La coordination le voit en temps réel, sans avoir à demander.",
  },
  {
    titre: 'Photographier les preuves',
    detail: "Les photos exigées sont listées à l'écran et se prennent directement avec l'appareil : PTO installée, mesure au photomètre, routeur en service. Pour un SAV, une photo avant et une après.",
  },
  {
    titre: 'Clôturer avec les mesures',
    detail: "La puissance optique est saisie et contrôlée : une valeur hors plage est refusée sur place, avant que le ticket ne parte. Le matériel posé est déclaré et sort du stock du véhicule. Sans les photos obligatoires, la clôture reste impossible.",
  },
  {
    titre: 'Déclarer un blocage',
    detail: "Client absent, PBO saturé, refus du syndic, pas de continuité optique : le motif est choisi dans une liste et le ticket remonte immédiatement à la coordination pour replanification. Rien ne reste en attente sans que personne ne le sache.",
  },
];

const ATOUTS = [
  {
    titre: 'Chaque société chez elle',
    detail: "Deux sous-traitants concurrents travaillent sur la même plateforme sans jamais voir les clients de l'autre. Le cloisonnement est appliqué à chaque lecture, y compris sur les photos.",
  },
  {
    titre: 'Des délais tenus',
    detail: "L'échéance est le rendez-vous client, ou le délai contractuel de l'activité. Les tickets en retard et ceux à échéance proche remontent avant qu'Orange ne les réclame.",
  },
  {
    titre: 'Une facturation sur pièces',
    detail: "Photos, mesures et horodatage de chaque étape sont conservés. Une ligne contestée se tranche sur pièces, pas sur la mémoire de chacun.",
  },
  {
    titre: 'Le matériel suivi',
    detail: "Livré, consommé, restant : pour chaque sous-traitant et chaque véhicule. Le stock se recalcule depuis le journal des mouvements, sans compteur à resynchroniser.",
  },
  {
    titre: 'Sur le téléphone',
    detail: "L'interface terrain s'installe sur Android depuis le navigateur et fonctionne comme une application, notifications comprises.",
  },
  {
    titre: 'Vos données restent les vôtres',
    detail: "L'export Excel des tickets et des attachements est disponible à tout moment, sans démarche particulière.",
  },
];

export default function Landing() {
  return (
    <div className="bg-white">
      {/* Bandeau */}
      <header className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden">
        <FiberBackground intensity="bright" className="text-gray-300" />
        <div className="relative max-w-6xl mx-auto px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center font-black text-xl">P</div>
          <div className="font-black tracking-tight text-lg">PERCER</div>
          <Link href="/login" className="btn-primary ml-auto">Se connecter</Link>
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-12 pb-24">
          <p className="text-brand-500 font-bold tracking-widest text-xs mb-4">
            FIBRE OPTIQUE · FTTH · MAROC
          </p>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05] max-w-4xl">
            La gestion des interventions fibre,
            <span className="text-brand-500"> de la commande à la facture.</span>
          </h1>
          <p className="mt-6 text-lg text-gray-300 max-w-2xl leading-relaxed">
            Percer répartit les commandes de l&apos;opérateur entre ses sous-traitants, qui les
            confient à leurs équipes. Chaque intervention est tracée, prouvée en photos et
            valorisée automatiquement — sans fichier Excel qui circule ni preuve perdue dans une
            conversation.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn-primary px-6 py-3 text-base">
              Accéder à la plateforme
            </Link>
            <a href="#coordinateur" className="btn-secondary px-6 py-3 text-base">
              Voir comment ça marche
            </a>
          </div>
          <div className="mt-10 flex flex-wrap gap-2">
            {Object.values(TICKET_TYPES).map((t) => (
              <span key={t.short} className="badge bg-white/10 text-gray-200 px-3 py-1">{t.label}</span>
            ))}
          </div>
        </div>
      </header>

      {/* Constat */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-black tracking-tight">Ce que la plateforme remplace</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {[
            ['Le fichier Excel qui circule', "Chaque envoi crée une version de plus. Personne ne sait laquelle fait foi, ni où en est un ticket sans passer un appel."],
            ['Les preuves dans WhatsApp', "Les photos d'intervention se perdent dans les conversations, compressées et sans référence. Au moment d'un litige, elles sont introuvables."],
            ['La facture qui se discute', "En fin de mois, le nombre d'interventions validées se négocie de mémoire, sans pièce pour trancher."],
          ].map(([titre, detail]) => (
            <div key={titre} className="card p-6">
              <h3 className="font-bold text-lg">{titre}</h3>
              <p className="text-gray-600 text-sm mt-2 leading-relaxed">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Chaîne */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-black tracking-tight">La chaîne, telle qu&apos;elle est</h2>
          <p className="text-gray-600 mt-2 max-w-2xl">
            Quatre niveaux, chacun avec sa responsabilité et sa vue. Personne ne voit plus que ce
            qui le concerne.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {CHAINE.map((c, i) => (
              <div key={c.titre} className="card p-5 relative">
                <div className="text-brand-500 font-black text-3xl leading-none">{i + 1}</div>
                <h3 className="font-bold text-lg mt-3">{c.titre}</h3>
                <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{c.role}</div>
                <p className="text-gray-600 text-sm mt-2 leading-relaxed">{c.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cycle de vie */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-black tracking-tight">Le parcours d&apos;un ticket</h2>
        <p className="text-gray-600 mt-2 max-w-2xl">
          Sept étapes, deux contrôles. Chaque transition est horodatée et attribuée à son auteur.
        </p>
        <div className="flex flex-wrap items-stretch gap-2 mt-8">
          {CYCLE.map((s, i) => (
            <div key={s.code} className="flex items-center gap-2">
              <div className="card px-4 py-3 min-w-[130px]">
                <div className="font-bold text-sm">{s.label}</div>
                <div className="text-[11px] text-gray-400">{s.qui}</div>
              </div>
              {i < CYCLE.length - 1 && <span className="text-gray-300 font-bold">→</span>}
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          <div className="card border-red-200 bg-red-50 p-5">
            <h3 className="font-bold text-red-800">En cas de blocage</h3>
            <p className="text-sm text-red-900 mt-1 leading-relaxed">
              L&apos;équipe déclare un motif normalisé. Le ticket remonte aussitôt à la
              coordination, qui le replanifie. Un blocage de plus de 24 h apparaît en alerte sur le
              tableau de bord.
            </p>
          </div>
          <div className="card border-amber-200 bg-amber-50 p-5">
            <h3 className="font-bold text-amber-900">En cas de rejet</h3>
            <p className="text-sm text-amber-900 mt-1 leading-relaxed">
              Photos illisibles ou mesure douteuse : le contrôleur rejette avec un motif et le
              ticket retourne à l&apos;équipe. Le rejet peut venir du sous-traitant comme de Percer.
            </p>
          </div>
        </div>
      </section>

      {/* Coordinateur Percer */}
      <section id="coordinateur" className="bg-gray-900 text-white relative overflow-hidden">
        <FiberBackground intensity="subtle" className="text-gray-500" />
        <div className="relative max-w-6xl mx-auto px-6 py-20">
          <span className="badge bg-brand-500 text-white">Donneur d&apos;ordre</span>
          <h2 className="text-3xl font-black tracking-tight mt-4">
            Le coordinateur Percer, au quotidien
          </h2>
          <p className="text-gray-300 mt-2 max-w-2xl">
            Il ne saisit rien deux fois et ne relance personne : il répartit, contrôle et facture.
          </p>
          <ol className="mt-8 space-y-4">
            {PERCER_STEPS.map((s, i) => (
              <li key={s.titre} className="flex gap-4">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center font-black">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-bold">{s.titre}</h3>
                  <p className="text-gray-300 text-sm mt-1 leading-relaxed max-w-3xl">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Coordinateur sous-traitant */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <span className="badge bg-sky-100 text-sky-800">Sous-traitant</span>
        <h2 className="text-3xl font-black tracking-tight mt-4">
          Le coordinateur du sous-traitant, au quotidien
        </h2>
        <p className="text-gray-600 mt-2 max-w-2xl">
          Il reçoit son travail sans échange de fichier et pilote ses équipes et son dépôt.
        </p>
        <ol className="mt-8 space-y-4">
          {ST_STEPS.map((s, i) => (
            <li key={s.titre} className="flex gap-4">
              <div className="shrink-0 w-9 h-9 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-black">
                {i + 1}
              </div>
              <div>
                <h3 className="font-bold">{s.titre}</h3>
                <p className="text-gray-600 text-sm mt-1 leading-relaxed max-w-3xl">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Équipe terrain */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <span className="badge bg-brand-100 text-brand-700">Terrain</span>
          <h2 className="text-3xl font-black tracking-tight mt-4">L&apos;équipe, sur le chantier</h2>
          <p className="text-gray-600 mt-2 max-w-3xl">
            Une équipe est un binôme et un seul compte, partagé par les deux intervenants qui sont
            nommés dans le dossier. Tout se fait au téléphone, d&apos;une seule main.
          </p>
          <ol className="mt-8 space-y-4">
            {EQUIPE_STEPS.map((s, i) => (
              <li key={s.titre} className="flex gap-4">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-brand-500 text-white flex items-center justify-center font-black">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-bold">{s.titre}</h3>
                  <p className="text-gray-600 text-sm mt-1 leading-relaxed max-w-3xl">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="card p-5 mt-8 border-brand-500">
            <h3 className="font-bold">La règle qui change tout</h3>
            <p className="text-gray-600 text-sm mt-1 leading-relaxed max-w-3xl">
              Un ticket ne peut pas être clôturé sans ses preuves. Les photos exigées dépendent de
              l&apos;activité — PTO, photomètre et routeur en production, avant/après en SAV — et la
              mesure optique est contrôlée à la saisie. La qualité n&apos;est plus vérifiée après
              coup : elle est exigée sur place.
            </p>
          </div>
        </div>
      </section>

      {/* Atouts */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-black tracking-tight">Ce que la plateforme garantit</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {ATOUTS.map((a) => (
            <div key={a.titre} className="card p-6">
              <h3 className="font-bold">{a.titre}</h3>
              <p className="text-gray-600 text-sm mt-2 leading-relaxed">{a.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Appel à l'action */}
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden">
        <FiberBackground intensity="bright" className="text-gray-300" />
        <div className="relative max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Chaque intervention, prouvée et valorisée.
          </h2>
          <p className="text-gray-300 mt-3 max-w-xl mx-auto">
            Connectez-vous avec le numéro de téléphone qui vous a été communiqué par votre
            coordinateur.
          </p>
          <Link href="/login" className="btn-primary px-8 py-3 text-base mt-8 inline-flex">
            Se connecter
          </Link>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-10 text-sm text-gray-500 flex flex-wrap items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center font-black text-white text-sm">P</div>
        <span className="font-bold text-gray-700">PERCER</span>
        <span>· Gestion des interventions FTTH</span>
        <span className="ml-auto">FTTH · Partage In · Partage Out · SAV</span>
      </footer>
    </div>
  );
}

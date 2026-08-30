import Link from "next/link";
import { ArrowLeft, Bot, Cookie, FileCheck2, Landmark, Scale, ShieldCheck } from "lucide-react";

export type LegalDocumentKey = "privacy" | "cookies" | "terms" | "dpa" | "legal-notice" | "ai-transparency";

interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

interface LegalDocumentDefinition {
  title: string;
  kicker: string;
  summary: string;
  icon: typeof ShieldCheck;
  sections: LegalSection[];
}

const company = {
  name: process.env.TABLENOW_LEGAL_NAME || "[DÉNOMINATION SOCIALE À COMPLÉTER]",
  form: process.env.TABLENOW_LEGAL_FORM || "[FORME JURIDIQUE À COMPLÉTER]",
  capital: process.env.TABLENOW_LEGAL_CAPITAL || "[CAPITAL À COMPLÉTER]",
  registration: process.env.TABLENOW_LEGAL_REGISTRATION || "[SIREN / RCS À COMPLÉTER]",
  address: process.env.TABLENOW_LEGAL_ADDRESS || "[SIÈGE SOCIAL À COMPLÉTER]",
  director: process.env.TABLENOW_LEGAL_DIRECTOR || "[DIRECTEUR DE PUBLICATION À COMPLÉTER]",
  host: process.env.TABLENOW_LEGAL_HOST || "Installation TableNow Node locale chez le client ; hébergeur cloud à compléter si activé",
};

const sharedController = `${company.name} est responsable des traitements liés aux comptes TableNow et à la sécurité de la plateforme. Le restaurant ou groupe reste responsable de traitement des données de ses propres clients et collaborateurs ; TableNow agit alors sur ses instructions documentées.`;

const documents: Record<LegalDocumentKey, LegalDocumentDefinition> = {
  privacy: {
    title: "Notice de confidentialité",
    kicker: "Données, droits et transparence",
    summary: "Ce que TableNow traite, pourquoi, pendant combien de temps et comment exercer vos droits.",
    icon: ShieldCheck,
    sections: [
      { title: "1. Qui traite les données ?", paragraphs: [sharedController, `Contact vie privée : privacy@tablenow.io. Identité juridique : ${company.name}, ${company.form}, ${company.address}. DPO : non désigné à ce stade pilote.`] },
      { title: "2. Données traitées", items: ["Compte professionnel, identité, rôle, établissement et coordonnées de travail.", "Réservations, demandes, communications, informations de service, équipe et stocks renseignés par le restaurant.", "Instructions, réponses, propositions et validations du copilote.", "Adresse IP pseudonymisée, sessions, événements d'audit et diagnostics strictement nécessaires à la sécurité."] },
      { title: "3. Finalités et bases légales", items: ["Fournir le pilote et exécuter les fonctionnalités demandées : contrat ou mesures précontractuelles.", "Sécuriser les accès, prévenir les abus et conserver une preuve des validations : intérêt légitime et obligations de sécurité.", "Traiter les données des clients du restaurant : instructions du restaurant dans le cadre du DPA.", "E-mails produit, mesure facultative et amélioration des modèles : consentement séparé, désactivé par défaut et révocable à tout moment."] },
      { title: "4. Destinataires et transferts", paragraphs: ["Accès limité aux utilisateurs autorisés du restaurant, aux personnes TableNow tenues à confidentialité et aux sous-traitants effectivement activés. Le mode local ne requiert aucun transfert cloud. Tout fournisseur cloud ou modèle externe doit être inscrit au registre des sous-traitants avec sa région, son DPA et le mécanisme de transfert applicable avant activation."] },
      { title: "5. Conservation", items: ["Code de connexion : 10 minutes ; session : 7 jours glissants.", "Export de droits : 7 jours puis suppression du fichier.", "Réservations et communications : 24 mois par défaut puis anonymisation, durée configurable selon les instructions du restaurant.", "Journaux de sécurité : 12 mois ; actions du copilote : durée du pilote puis 12 mois, sauf obligation ou litige.", "Après fin du pilote : réversibilité de 30 jours, puis suppression ou restitution selon le DPA."] },
      { title: "6. Vos droits", paragraphs: ["Vous pouvez demander accès, rectification, portabilité, effacement, limitation ou opposition depuis le Centre de confidentialité ou à privacy@tablenow.io. Les demandes concernant les clients du restaurant sont transmises au restaurant responsable. Vous pouvez saisir la CNIL (cnil.fr) si vous estimez que vos droits ne sont pas respectés."] },
      { title: "7. Sécurité et décisions automatisées", paragraphs: ["TableNow applique séparation des rôles, isolation par organisation, chiffrement en transit, secrets hors code, journal d'audit, sauvegardes et validation humaine des actions sensibles. Le pilote ne prend aucune décision produisant un effet juridique ou similaire de manière entièrement automatisée."] },
    ],
  },
  cookies: {
    title: "Politique des cookies",
    kicker: "Aucun suivi publicitaire",
    summary: "L'application pilote utilise uniquement deux cookies nécessaires à l'accès et à la sécurité.",
    icon: Cookie,
    sections: [
      { title: "Cookies utilisés", items: ["tn_session : cookie HttpOnly qui maintient la session authentifiée, au maximum 7 jours.", "tn_csrf : jeton de protection contre les requêtes frauduleuses, au maximum 7 jours."] },
      { title: "Pourquoi aucun bandeau ?", paragraphs: ["Ces cookies sont strictement nécessaires au service demandé et ne requièrent pas de consentement préalable. Aucun cookie publicitaire, outil de profilage ou analytics tiers n'est activé dans le pilote. Si cela change, TableNow ajoutera un mécanisme de choix avant tout dépôt facultatif."] },
      { title: "Contrôle", paragraphs: ["Vous pouvez supprimer ces cookies dans votre navigateur ; votre session sera alors fermée. Les préférences facultatives de produit se gèrent séparément dans le Centre de confidentialité."] },
    ],
  },
  terms: {
    title: "Conditions du pilote privé",
    kicker: "Version pilot-2026-08-23",
    summary: "Règles d'accès et d'utilisation de la bêta privée TableNow Copilot.",
    icon: Scale,
    sections: [
      { title: "1. Parties et objet", paragraphs: [`Le pilote est fourni par ${company.name}, ${company.form}, ${company.address}, au restaurant ou groupe ayant accepté une invitation privée. Il permet d'évaluer le cockpit TableNow sur des données de démonstration ou des données volontairement configurées.`] },
      { title: "2. Accès", items: ["Accès nominatif, limité aux adresses invitées ; le code reçu ne doit pas être partagé.", "Le client désigne ses utilisateurs, attribue les rôles et retire les accès devenus inutiles.", "TableNow peut suspendre un accès en cas de risque de sécurité, usage illicite ou compromission présumée."] },
      { title: "3. Périmètre pilote", paragraphs: ["Les fonctions signalées comme démonstration simulent des opérations et n'envoient rien aux clients réels. Une intégration, une synchronisation cloud ou un modèle externe n'est activé qu'après configuration explicite. Le pilote peut évoluer ; les changements substantiels sont communiqués."] },
      { title: "4. Obligations du client", items: ["Utiliser le service dans un cadre professionnel licite et fournir des données exactes.", "Informer son personnel et ses clients lorsque la réglementation ou le contexte l'exige.", "Ne pas introduire de données sensibles non nécessaires, de secrets, de contenu malveillant ou de données sans base légale.", "Conserver la décision humaine pour les actions sensibles proposées par le copilote."] },
      { title: "5. Données et confidentialité", paragraphs: ["Chaque partie protège les informations confidentielles reçues. Les traitements confiés à TableNow sont régis par le DPA. Les données du client restent exportables et ne sont pas vendues."] },
      { title: "6. Disponibilité, support et responsabilité", paragraphs: ["Le pilote est fourni à des fins d'évaluation, sans engagement de disponibilité garanti tant qu'un contrat de production n'est pas signé. TableNow corrige diligemment les incidents signalés. Les limitations financières et exclusions définitives devront être complétées dans le contrat signé ; aucune clause de cette version ne limite une responsabilité qu'il serait interdit de limiter par la loi."] },
      { title: "7. Durée et fin", paragraphs: ["Chaque partie peut mettre fin au pilote par écrit. Le client dispose alors d'une période de réversibilité de 30 jours pour exporter ses données, sauf instruction différente ou obligation légale. Les accès sont ensuite fermés et les données supprimées selon le DPA."] },
      { title: "8. Droit applicable", paragraphs: ["Droit français. Avant toute action, les parties cherchent une solution amiable. La juridiction compétente sera précisée dans le contrat définitif selon la qualité des parties et les règles impératives applicables."] },
    ],
  },
  dpa: {
    title: "Accord de traitement des données",
    kicker: "Article 28 RGPD · version pilote",
    summary: "Cadre dans lequel TableNow traite les données des clients et collaborateurs pour le compte du restaurant.",
    icon: FileCheck2,
    sections: [
      { title: "1. Rôles, objet et durée", paragraphs: [sharedController, "Le traitement couvre la durée du pilote et la réversibilité. Objet : fournir l'interface, les réservations, communications, opérations, automatisations, support et fonctions de copilote choisies par le client."] },
      { title: "2. Personnes et données", items: ["Personnes : clients/prospects du restaurant, collaborateurs, responsables et utilisateurs autorisés.", "Données : identité et contact, réservation, préférences de service, communications, notes opérationnelles, planning et journaux d'action.", "Données sensibles : non requises par défaut ; allergies ou besoins d'accessibilité ne doivent être saisis que si nécessaires et licites."] },
      { title: "3. Instructions et confidentialité", paragraphs: ["TableNow ne traite les données que sur instruction documentée du client, y compris pour les transferts. Si une instruction paraît illicite, TableNow en informe le client. Les personnes autorisées sont soumises à une obligation de confidentialité et à un accès selon leur rôle."] },
      { title: "4. Mesures techniques et organisationnelles", items: ["Isolation logique par organisation et RLS PostgreSQL forcée sur les données métier.", "Authentification sans mot de passe, codes courts, sessions HttpOnly, CSRF, limitation de débit et contrôle d'origine.", "Chiffrement TLS en cloud ; stockage local sous le contrôle du client ; secrets séparés du code.", "Journalisation des actions, validation humaine, idempotence des tâches, sauvegarde/restauration testable.", "Exports, durées de conservation, suppression et mode sans cloud ni modèle externe."] },
      { title: "5. Sous-traitants et transferts", paragraphs: ["Aucun sous-traitant optionnel n'est activé par défaut. TableNow tient une liste à jour, informe avant ajout et permet une objection motivée. Tout transfert hors EEE repose sur une décision d'adéquation, les clauses contractuelles types et, si nécessaire, des mesures complémentaires."] },
      { title: "6. Assistance", paragraphs: ["TableNow aide le client à répondre aux droits, analyses d'impact, consultations, audits et obligations de sécurité, compte tenu des informations disponibles. Une violation est notifiée sans délai indu après confirmation, avec nature, conséquences probables, données concernées et mesures prises, afin d'aider le client à respecter son délai réglementaire."] },
      { title: "7. Sort des données et audit", paragraphs: ["À la fin, TableNow restitue ou supprime les données selon le choix du client, puis supprime les copies restantes hors conservation légale documentée. Le client peut obtenir les informations nécessaires et réaliser un audit raisonnable, sous confidentialité, sans compromettre d'autres clients ni la sécurité."] },
      { title: "8. Hiérarchie", paragraphs: ["Le présent DPA complète les conditions du pilote. En cas de conflit concernant des données personnelles, le DPA prévaut. Les coordonnées complètes, la liste des sous-traitants effectivement choisis et les annexes de sécurité doivent être finalisées avant toute mise en production publique."] },
    ],
  },
  "legal-notice": {
    title: "Mentions légales",
    kicker: "Éditeur et hébergement",
    summary: "Informations obligatoires connues à ce stade du pilote privé.",
    icon: Landmark,
    sections: [
      { title: "Éditeur", items: [`Dénomination : ${company.name}`, `Forme : ${company.form}`, `Capital : ${company.capital}`, `Immatriculation : ${company.registration}`, `Siège : ${company.address}`, `Directeur de publication : ${company.director}`, "Contact : contact@tablenow.io · Vie privée : privacy@tablenow.io"] },
      { title: "Hébergement", paragraphs: [company.host, "En mode local, le restaurant contrôle la machine, le réseau, les sauvegardes et l'accès physique. En mode cloud, les coordonnées exactes de l'hébergeur et la région seront affichées avant activation."] },
      { title: "Propriété intellectuelle", paragraphs: ["TableNow, son interface, son code, ses textes et signes distinctifs sont protégés. Le pilote accorde uniquement un droit d'utilisation interne, personnel, non exclusif et révocable pendant sa durée."] },
    ],
  },
  "ai-transparency": {
    title: "Transparence du copilote IA",
    kicker: "Contrôle humain par conception",
    summary: "Ce que le copilote peut faire, ce qu'il ne fait jamais seul et comment ses actions sont tracées.",
    icon: Bot,
    sections: [
      { title: "Fonctionnement", paragraphs: ["Le copilote analyse uniquement les informations accessibles au rôle connecté, explique les signaux utilisés et peut proposer une action structurée. Le moteur de règles TableNow décide ensuite si une validation humaine est obligatoire."] },
      { title: "Garde-fous", items: ["Aucune modification directe de la base par un modèle ou un outil MCP.", "Actions à risque élevé réservées au propriétaire ou à l'administrateur.", "Idempotence, budget quotidien, journal d'audit, état d'exécution et reprise après erreur.", "Aucun appel, message réel, paiement, sanction RH ou décision juridique autonome dans le pilote."] },
      { title: "Choix du modèle", paragraphs: ["Le fournisseur est interchangeable. Le mode déterministe ou un modèle local peut fonctionner sans envoyer de contenu à un fournisseur externe. Si un modèle cloud est activé, son identité, sa région, ses conditions de conservation et son DPA doivent apparaître dans le registre des sous-traitants."] },
      { title: "Vos choix", paragraphs: ["Les conversations ne sont pas utilisées pour améliorer des modèles par défaut. Cette préférence est séparée, facultative et révocable. Vous pouvez contester une recommandation, refuser l'action proposée et demander une explication ou une revue humaine."] },
    ],
  },
};

export function isLegalDocumentKey(value: string): value is LegalDocumentKey {
  return value in documents;
}

export function legalDocumentTitle(key: LegalDocumentKey): string {
  return documents[key].title;
}

export function LegalDocument({ documentKey }: { documentKey: LegalDocumentKey }) {
  const document = documents[documentKey];
  const Icon = document.icon;
  const incomplete = Object.values(company).some((value) => value.includes("À COMPLÉTER"));
  return <main className="legal-layout"><header className="legal-topbar"><Link href="/login" className="logo-lockup"><span className="brand-mark brand-mark-small">T<span>N</span></span><span>TableNow<small>Confiance & conformité</small></span></Link><Link href="/login" className="back-link"><ArrowLeft size={15} /> Retour à l'application</Link></header><div className="legal-shell"><aside className="legal-index"><span className="eyebrow">Documents du pilote</span><nav>{legalLinks.map(([key, label]) => <Link key={key} href={`/legal/${key}`} className={documentKey === key ? "active" : ""}>{label}</Link>)}</nav><p>Version pilote<br />23 août 2026</p></aside><article className="legal-document"><div className="legal-hero"><span><Icon size={22} /></span><p>{document.kicker}</p><h1>{document.title}</h1><strong>{document.summary}</strong></div>{incomplete && <div className="legal-warning"><ShieldCheck size={18} /><p><strong>Document opérationnel avec identité à finaliser.</strong> Les protections, finalités et procédures sont définies ; les champs société entre crochets doivent être remplacés avant ouverture publique ou signature définitive.</p></div>}{document.sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}<footer><p>Questions ou exercice de droits : <a href="mailto:privacy@tablenow.io">privacy@tablenow.io</a></p><Link href="/legal/ai-transparency">Comprendre le copilote IA →</Link></footer></article></div></main>;
}

const legalLinks: Array<[LegalDocumentKey, string]> = [
  ["privacy", "Confidentialité"],
  ["cookies", "Cookies"],
  ["terms", "Conditions du pilote"],
  ["dpa", "DPA · traitement des données"],
  ["ai-transparency", "Transparence IA"],
  ["legal-notice", "Mentions légales"],
];

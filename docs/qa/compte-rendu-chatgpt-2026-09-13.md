# TableNow Copilot — compte rendu à transmettre à ChatGPT

Situation vérifiée le 13 septembre 2026 vers 22:40 UTC (23:40 en Algérie). Ce document décrit les preuves disponibles et les limites ; il ne certifie pas la livraison du produit complet.

## 1. Situation actuelle

La connexion réelle avec Google, suivie du TOTP Google Authenticator, a permis au propriétaire d'atteindre l'onboarding. Le compte Google est créé dans Copilot et lié à son identité Google. Le navigateur est sur `/onboarding` et reste à la disposition du propriétaire.

L'onboarding n'est pas terminé. Le propriétaire indique reconnaître une ancienne présentation alors qu'une expérience plus récente avait été travaillée. Il demande un état complet pour une revue dans ChatGPT, puis reviendra avec un rapport. Aucune refonte supplémentaire ne doit être déduite de ce signalement.

## 2. Référence exacte de travail

- Dossier : `/Users/radwan/TableNow-Copilot`.
- Dépôt : `tablenow101/tablenow-copilot`.
- Branche : `product/stitch-functional-owner`.
- Vercel : projet `tablenow-copilot-v2`, équipe `tablenow101`, Preview uniquement.
- Alias stable à utiliser : https://tablenow-copilot-v2-git-product-stitch-funct-786bbe-tablenow101.vercel.app/login
- Dernier commit déployé vérifié : `f0e98b9119f585b466ab639afceca8e2af59cc97`.
- Déploiement : `dpl_E9wYLpf1BhbkHSrE6KhX45NjJJJc`, READY ; URL immuable `tablenow-copilot-v2-gjy84rf7j-tablenow101.vercel.app`.
- Commit d'implémentation Google : `4f0512cc975af7de74dc793ae7d9f9fc000fb5a5` ; le commit suivant contient la documentation.
- PostgreSQL Copilot Preview : projet Neon `aged-haze-01205441`, branche `br-ancient-sun-za1ku4d2`, base `neondb`.
- La mémoire canonique est sur une autre branche Copilot : `br-orange-cherry-zadw6u1y`, registre `project_memory.current_records`. Les rapports de travail ne constituent pas automatiquement une mise à jour de cette mémoire.

Les URLs `qs35jybon`, `nlhtnepu8`, `96v84r74c` correspondent à des versions antérieures de la branche et ne doivent plus servir de point d'entrée courant. L'URL `8qufwgirl` a été explicitement exclue par le propriétaire. Ne pas confondre une ancienne Preview de Copilot et l'application historique.

## 3. Fonctionnement actuel de l'authentification

Deux entrées sont conservées :

1. **Inscription classique** : identité et mot de passe → code reçu par e-mail → configuration TOTP → codes de secours → onboarding.
2. **Google** : choix du compte Google et consentement → TOTP TableNow → onboarding pour un nouveau profil, cockpit pour un profil complet.

À la connexion classique suivante : mot de passe puis TOTP. Google remplace la saisie du mot de passe dans son propre parcours ; il ne supprime pas le TOTP. Un code Gmail et un code Google Authenticator sont deux choses différentes. Le parcours Google ne nécessite pas de code envoyé par e-mail.

Le propriétaire a explicitement demandé de conserver le TOTP. « Se souvenir de moi » signifie rester connecté dans la durée de session déjà prévue, sans allongement de cette durée. Apple reste indisponible et sera traité ultérieurement.

Les comptes `radwan.arbane@gmail.com` et `bryanduvalpro@gmail.com` sont distincts. Le premier est maintenant lié à Google ; le second existait déjà et conserve ses identifiants. Aucune fusion n'a été réalisée.

## 4. Configuration Google et autres ressources

Un projet Google dédié **TableNow Copilot Preview** (`tablenow-copilot-preview`) a été créé afin de ne pas modifier le consentement du projet historique `tablenow`.

- Application externe en mode **Testing**, pas publiée au public.
- Les deux adresses de recette ci-dessus sont autorisées comme utilisateurs de test.
- Client Web dédié à la Preview.
- Retour OAuth unique : `https://tablenow-copilot-v2-git-product-stitch-funct-786bbe-tablenow101.vercel.app/api/v1/oauth/google/callback`.
- Autorisations demandées : identité, e-mail et profil uniquement ; cela ne connecte ni la messagerie Gmail, ni les contacts, ni Google Calendar.
- Variables `GOOGLE_OAUTH_CLIENT_ID` et `GOOGLE_OAUTH_CLIENT_SECRET` enregistrées uniquement pour Preview et `product/stitch-functional-owner`.
- Flux serveur avec bibliothèque officielle Google, PKCE, état, nonce et validation du jeton. Le rattachement du compte et la session attendent la validation TOTP.

Resend avait été raccordé par SMTP avec l'expéditeur `info@tablenow.io`, dans le périmètre Preview de la branche. Une réception d'e-mail avait été rapportée auparavant, mais le présent essai Google ne teste pas SMTP. La fiabilité complète inscription/récupération par e-mail n'est donc pas certifiée par cet essai.

Incident de manipulation antérieur : la première clé Google avait été exposée dans une sortie d'inspection à cause d'un libellé accessible du bouton Google. Elle n'avait pas été utilisée par Copilot ; elle a été remplacée, désactivée et supprimée. Seule sa remplaçante a été configurée. Aucune valeur secrète n'est incluse dans ce rapport.

## 5. Ce qui est effectivement vérifié

| Élément | Preuve et limite |
|---|---|
| Version cloud | Alias de branche relu dans Vercel, commit `f0e98b9`, READY. |
| Google jusqu'au retour TableNow | Parcours réel joué dans le navigateur avec le fournisseur Google. |
| Validation du TOTP et création du compte | Après la saisie privée du propriétaire : compte actif, identifiants présents, liaison Google et session non expirée confirmés par lecture SQL ; le code ne crée cette liaison qu'après validation du TOTP. Aucun code secret lu. |
| Accès onboarding | Onglet authentifié constaté sur `/onboarding` ; contenu de l'écran lu sans clic ni modification. |
| Persistance initiale | Brouillon serveur `draft`, section `establishment`, révision 10, rôle `owner`, onboarding non finalisé. L'écran affiche « Enregistré ». Cela ne prouve pas encore une reprise après fermeture. |
| Tests automatisés du lot Google | Rapport précédent : 93 tests API et 40 tests console réussis ; quatre tests ignorés localement. CI qualité, PostgreSQL et Docker verte sur le commit de code. Pas de relance lors de ce compte rendu. |
| Build | Compilation réussie précédemment ; ce résultat ne vaut pas validation fonctionnelle de tout le produit. |

La conservation effective des codes de secours par le propriétaire n'a pas été vérifiée. Le parcours complet jusqu'au cockpit n'a pas encore été joué pour ce nouveau compte. La connexion d'un profil déjà complet, la reconnexion après fermeture, la récupération et la recette Google sur mobile restent à vérifier.

## 6. Problèmes rencontrés et correction du diagnostic

Au départ, les messages de l'assistant étaient trop techniques et présentaient le retour OAuth comme un avancement plus global. Le propriétaire a ensuite précisé qu'il n'avait pas eu le temps de terminer les essais. Une expiration de dix minutes n'est pas une preuve d'erreur de saisie de sa part.

Les onglets d'authentification n'avaient pas été marqués pour être conservés à la fin des interventions. Le propriétaire signalait donc leur fermeture pendant sa saisie. L'onglet a été rouvert, marqué pour rester à sa disposition, et la vérification encore active a été reprise. Le propriétaire a alors atteint l'onboarding. Ce problème d'accompagnement et de gestion du navigateur ne doit pas être présenté comme une panne de Google Authenticator.

Un ancien lien `/login?google=continue` dépend d'une vérification courte et n'est pas une URL durable d'entrée. Pour recommencer une connexion, utiliser `/login`, puis le bouton Google ; éviter de multiplier les relances et de changer le QR code pendant la saisie.

## 7. Point à examiner : onboarding attendu contre onboarding affiché

Écran réellement observé : « Bienvenue. », « Commençons par votre établissement. », recherche du restaurant et de la ville avec Google Places ou annuaire français, ajout manuel, confirmation des informations, compositeur texte/document/micro, bouton Continuer et état Enregistré. Le propriétaire avait commencé à renseigner son établissement ; l'assistant n'a pas modifié ces données.

Le code actuellement servi pour `/onboarding` importe `apps/console/components/OnboardingFlow.tsx`. Sa dernière modification enregistrée est `747d040` (« persist governed service advice and restore owner onboarding »). Les lots suivants ont modifié l'authentification et Google, sans remplacer ce composant d'onboarding.

Il existe un écart textuel concret à examiner : le document `docs/architecture/hybrid-foundations-2026-09-13.md` référence « Bonjour et bienvenue, comment puis-je vous aider ? », tandis que l'écran courant affiche « Bienvenue. » et « Commençons par votre établissement. ». Cela démontre une divergence entre cette référence documentaire et le rendu, mais ne suffit pas à identifier à lui seul la maquette finale attendue ou la correction à appliquer.

La branche et le commit déployés sont bien ceux de Copilot autorisé. Il n'est pas démontré que la nouvelle expérience attendue soit absente de toute autre branche ou de toute maquette. Il faut comparer la référence exacte approuvée, la mémoire canonique, les commits concernés et l'écran actuel avant de choisir une correction. Ne pas affirmer sans cette comparaison que l'ancien produit historique a été redéployé.

Les fondations de mémoire gouvernée, conseils de service persistants et autorisations sont décrites et implémentées dans le lot `747d040`. Leur présence dans le code ne certifie ni une expérience conversationnelle finale, ni tous les agents métier, ni des fournisseurs externes activés. Aucun scénario de service complet n'a été joué pendant cette session d'authentification.

## 8. Contraintes à conserver

- Preview uniquement ; aucune production ni application historique à modifier.
- Ne jamais exposer de secrets, modifier les facteurs existants ou fusionner des comptes sans demande explicite.
- Conserver les couleurs TableNow, le logo et les choix validés ; pas de fond blanc imposé.
- Le propriétaire veut être consulté avant une différence produit, y compris un changement d'onboarding. La demande présente est un compte rendu, pas une autorisation de refonte.
- PostgreSQL est la source de vérité : sauvegarde serveur, reprise, droits, questions conditionnelles et résultat métier conservé ; pas de résultat simulé présenté comme réel.
- Tester le parcours entier en navigateur, ordinateur et mobile, avant de le déclarer livré.

## 9. État local et prochaine reprise

Le code local est au commit déployé `f0e98b9`. Les compléments de diagnostic et ce rapport sont des modifications documentaires locales, non commités et non poussés au moment de leur rédaction. Aucun redéploiement ou changement fonctionnel n'a été lancé pour ce compte rendu.

À la reprise après l'avis de ChatGPT :

1. Identifier précisément l'expérience d'onboarding approuvée et la comparer au rendu actuel.
2. Présenter les différences au propriétaire ; demander son choix si une modification produit est nécessaire.
3. Appliquer uniquement les corrections autorisées et préserver le brouillon déjà enregistré.
4. Terminer le vrai parcours onboarding → premier résultat enregistré → cockpit, puis vérifier reprise et mobile.
5. Documenter séparément les réussites, limites, échecs et fonctionnalités non exécutées. Ne pas promouvoir en production.

## Demande à ChatGPT

À partir de ce compte rendu et des références produit que tu possèdes, aide-moi à distinguer ce qui est effectivement livré, ce qui fonctionne seulement en partie et ce qui ne correspond pas encore à l'expérience approuvée. Examine en priorité l'onboarding affiché face à notre nouvelle référence. Si cette référence manque, demande-la au lieu de l'inventer. Propose un rapport de différences et une séquence de corrections limitée, sans retirer le TOTP, changer les couleurs, réinitialiser les comptes ou autoriser une modification de production. Aucun build ou test automatisé ne doit être présenté comme preuve du parcours complet.

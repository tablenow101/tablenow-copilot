# Prochaine action — confirmer la réparation SMTP

Vérifier le déploiement réunissant la clé SMTP réparée et le retour d'erreur corrigé. Tester l'envoi applicatif vers une adresse autorisée puis demander confirmation de réception. Laisser la saisie privée au propriétaire pour confirmer le lien et la connexion. Une seule branche de travail : `product/onboarding-owner`. Aucune suppression avant recette et accord, aucune production.

# Prochaine action — authentification uniquement

Preview publiée et rendu public contrôlé au commit applicatif `e52ca14`. Faire vérifier la réception réelle et la connexion privée au propriétaire sans fermer son onglet. Aucun autre écran ni main/production à modifier. [Rapport](../../docs/qa/auth-split-2026-09-23.md).

## Historique — ne pas appliquer les anciennes consignes d’authentification contradictoires

# Parcours guidé — suite du 21 septembre 2026

## Authentification unifiée Preview — 23 septembre 2026

La présentation et les contrats déployés sont vérifiés sur `265d7595` : une seule entrée, Google puis e-mail, code à six chiffres et nom demandé seulement pour une nouvelle adresse vérifiée. Ne plus réintroduire mot de passe, TOTP, QR ou codes de secours dans ce parcours. La prochaine recette privée utile est unique : réception réelle du code, compte existant, nouvelle adresse puis Google. Elle nécessite les valeurs privées du propriétaire et ne doit pas être remplacée par une nouvelle refonte. Après validation, inventorier les branches distantes puis soumettre la liste exacte à supprimer ; conserver `main` et `product/onboarding-owner` jusque-là.

1. Laisser au propriétaire la saisie privée pour une nouvelle inscription sur `preview.tablenow.io/register`, sans partager codes ni QR.
2. Vérifier réception réelle du mail, configuration TOTP sur un seul téléphone, changement d’application et reprise.
3. Sur ce nouveau compte, poursuivre priorités → établissement → systèmes → connexions reportables → compléments → synthèse → premier résultat, puis déconnexion/reconnexion.
4. Compléter Google, Places et les essais clavier/micro sur appareils physiques. Les preuves actuelles couvrent la session existante et des viewports.
5. Présenter preuves et limites puis attendre la validation produit. Aucun lot 2 final, lot 3, main ni production.

# Prochaine vérification — pilote Aujourd’hui, 19 septembre 2026

Terminer la vérification déployée des deux finitions de barre sur `product/onboarding-owner`. Le parcours ciblé cockpit, message persistant, action et document est vérifié ; restent la recette globale, le micro réel et le service IA non configuré. Présenter les preuves et limites au propriétaire avant toute clôture du lot. Aucun passage vers main ni vers la production.

# Porte active — validation produit du lot 1

1. Présenter au propriétaire la recette Google + TOTP, sauvegarde/reprise et responsive enregistrée dans `docs/qa/lot-1-auth-responsive-2026-09-17.md`.
2. Obtenir sa validation produit explicite du lot 1 ; les contrôles automatiques et la recette technique ne la remplacent pas.
3. Conserver comme écart distinct la première arrivée d'un compte neuf sur Priorités, non prouvée avec ce compte historique déjà finalisé.
4. Ne pas finaliser le lot 2, ne pas ouvrir le lot 3 et ne toucher ni à `main` ni à la production avant cette validation.

## Historique de la porte TOTP

1. Publier sur `product/onboarding-owner` la correction d'expiration TOTP, sans toucher à `main` ni à la production.
2. Relancer Google pour créer un défi neuf, puis laisser le navigateur ouvert pour le TOTP, sans relancer ni fermer la page pendant la saisie.
3. Tester réellement priorités, sauvegarde, établissement, déconnexion/reconnexion et reprise sur ordinateur et mobile.
4. Présenter les preuves puis demander la validation explicite du lot 1.
5. Lot 2 : préparation indépendante autorisée ; aucun commit final avant les preuves de migration sans perte, le diff fonctionnel et la validation explicite.
6. Arrêt à chaque porte de validation produit. Aucune progression au lot 3 ni promotion main/production avant les validations requises.

Les séquences ci-dessous sont antérieures ; la porte ci-dessus prévaut.

# Séquence de publication TableNow OS — 16 septembre 2026

1. Exécuter les huit lots de `docs/superpowers/plans/2026-09-16-continuous-advisor.md` sur `product/onboarding-owner`, avec tests et commit par lot.
2. Déployer chaque état cohérent sur `preview.tablenow.io` et conserver un état honnête pour toute intégration indisponible.
3. Terminer le stockage privé des profils et photos avant la porte de production, sans bloquer les lots précédents.
4. Rejouer Google, e-mail, TOTP, Google Places, sauvegarde/reprise, onboarding, premier résultat et cockpit sur ordinateur et mobile.
5. Demander l’autorisation explicite du propriétaire avant toute fusion ou promotion vers `main` et `os.tablenow.io`.

# Recette de copilot.tablenow.io — 14 septembre 2026

Publier les corrections sur la branche autorisée, vérifier le commit réellement servi et jouer les parcours sur la nouvelle adresse. Laisser l'onglet ouvert pour les saisies privées ; préserver comptes, TOTP et brouillons. Contrôler textes/périmètre puis finalisation, résultat enregistré, cockpit et mobile. Réception e-mail à confirmer par le propriétaire ; trois logos officiels encore manquants. [Rapport du lot](../../docs/qa/stable-preview-2026-09-14.md). Les entrées suivantes sont historiques.

# Après connexion réussie — attente du retour produit du propriétaire

Google et TOTP ont permis d'atteindre l'onboarding ; ne pas relancer l'authentification. Laisser l'onglet et le brouillon à disposition du propriétaire. Il transmet [le compte rendu](../../docs/qa/compte-rendu-chatgpt-2026-09-13.md) à ChatGPT puis revient avec un rapport. Comparer ensuite l'expérience attendue au rendu avant toute correction produit ; finir onboarding/cockpit et recette mobile après clarification. Les séquences ci-dessous décrivent les états antérieurs.

# Google + TOTP — prochaine étape

Client Google isolé et variables Preview configurés, code publié et retour Google réel vérifié. Reprendre le propriétaire après sa saisie privée du TOTP sur l'alias Preview de `product/stitch-functional-owner` ; si la vérification a expiré, recommencer par le bouton Google. Conserver les codes de secours puis jouer onboarding complet et cockpit ; tester aussi le profil complet existant et le mobile. Le compte Google actuellement sélectionné est `radwan.arbane@gmail.com`, nouveau profil distinct du compte de recette `bryanduvalpro@gmail.com`. Ne pas fusionner les comptes ni modifier le profil existant pour simuler un succès. [Rapport](../../docs/qa/google-preview-2026-09-13/report.md).

# Authentification — lot visuel du 13 septembre 2026

Preview `qs35jybon` publiée et écrans publics contrôlés avec les couleurs conservées ; « Se souvenir de moi » raccordé et testé côté API. Terminer la connexion réelle avec le propriétaire pour vérifier la persistance après fermeture/réouverture. Google/Apple : attendre les précisions du propriétaire sur les applications et accès dédiés ; ne pas prétendre les avoir activés. Aucun changement d’onboarding ni de production. [Recette](../../docs/qa/auth-layout-2026-09-13/report.md).

# Prochaine action — parcours authentifié

Reprendre l'onglet `nlhtnepu8` après connexion du propriétaire. Vérifier onboarding automatique, sauvegarde/reprise et cockpit, puis scénario de service avec décision et résultat enregistrés sur desktop/mobile. Toute nouvelle réception e-mail doit être confirmée réellement. La production et le legacy restent exclus. [Rapport du lot](../../docs/qa/governed-2026-09-13/report.md).

## Historique de cette reprise

# Prochaine action — recette Resend, 13 septembre 2026

1. Terminer l'inscription normale sur la [Preview SMTP issue de 96v84r74c](https://tablenow-copilot-v2-jyp8smof5-tablenow101.vercel.app/register), avec saisie privée du mot de passe par le propriétaire.
2. Vérifier l'envoi applicatif vers `bryanduvalpro@gmail.com`, demander sa confirmation de réception réelle et lui laisser saisir le code dans l'interface.
3. Poursuivre TOTP, onboarding et cockpit sur ordinateur/mobile avec preuves distinctes. Si le compte pilote existe déjà, suivre la récupération normale et distinguer ce parcours de l'inscription d'un nouvel utilisateur.

Voir [l'état Resend](resend-preview-2026-09-13.md). La référence `8qufwgirl` est exclue. Aucune production ni application historique à modifier.

## Séquence avant autorisation Resend — 13 septembre 2026

La correction `OTP_PEPPER`, le déploiement READY et l'accès normal à la Preview sont vérifiés. Le blocage actuel est l'e-mail de compte absent, pas l'authentification Vercel. Voir [la recette et ses limites](../../docs/qa/deployment-2026-09-13/report.md).

1. Définir et autoriser le fournisseur d'e-mail, l'expéditeur, les secrets Preview et le destinataire de test avant toute nouvelle configuration SMTP ; ce chantier n'a pas été entrepris pendant cette passe.
2. Après raccordement autorisé, vérifier l'envoi et la réception réelle, puis terminer inscription, second facteur, reconnexion et récupération par les écrans normaux.
3. Rejouer l'onboarding jusqu'au premier résultat et au cockpit sur ordinateur/mobile, avec preuves de persistance, reprise et verdict produit. Ne promouvoir aucune version avant recette complète.

## Séquence antérieure — recette propriétaire

1. Reprendre [le bilan du 12 septembre](owner-build-2026-09-12.md) et [la recette détaillée](../../docs/product/OWNER_DELIVERY.fr.md).
2. Vérifier la Preview de `product/stitch-functional-owner`, sa branche Neon distincte, sa migration 007 et les contrôles GitHub. Ne pas promouvoir ni contourner les protections si une étape bloque.
3. Jouer le vrai parcours propriétaire depuis la connexion, sur ordinateur et mobile. Aucun verdict PASS ne peut venir du seul build ou des tests API.
4. Vérifier les services SMTP et IA réellement configurés dans Copilot ; la présence d'une variable n'est pas une preuve de fonctionnement. Tester les envois uniquement vers un destinataire autorisé.
5. Retrouver la connexion Google Places déclarée par le propriétaire, sans extraire de secrets d'un autre produit. L'annuaire français actuel ne couvre que l'identité et l'adresse ; téléphone, horaires, site et photos ne sont pas garantis.
6. Faire relire la migration additive et la PR par les responsables prévus avant toute fusion/promotion.

## Séquence antérieure — conservée pour continuité

1. Lire [la reprise factuelle](onboarding-handoff-2026-09-06.md) et [le contrat produit](../../docs/product/ONBOARDING_FINAL.fr.md).
2. Implémenter le parcours complet, son état serveur et son premier livrable sauvegardé sur la branche produit dédiée. Ne pas modifier la PR #12 ni ouvrir un chantier d'infrastructure.
3. Vérifier les branches conditionnelles, erreurs, autorisations, sauvegardes, reprise de session et finalisation idempotente.
4. Jouer le parcours complet comme un restaurateur dans un navigateur desktop/mobile, avec des données synthétiques isolées et sans effets extérieurs réels.
5. Tester la Preview Vercel uniquement après preuve d'isolation de sa base et de ses services tiers. Documenter séparément les capacités bloquées et les tests non exécutés.
6. Livrer le lien testable, les captures/traces et les verdicts métier ; obtenir la validation de l'expérience avant fusion dans main.

Une demande @codex envoyée ne constitue pas un lancement confirmé. Un build READY ne constitue pas une recette produit.

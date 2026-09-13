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

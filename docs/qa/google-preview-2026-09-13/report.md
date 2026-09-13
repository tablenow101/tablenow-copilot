# Google + TOTP — Copilot Preview

## Actualisation — 13 septembre 2026, 22:40 UTC

Le propriétaire a terminé la saisie privée du TOTP et atteint `/onboarding`, observé en lecture seule. SQL Preview confirme le compte actif Radwan, ses identifiants, sa liaison Google et une session non expirée ; le brouillon onboarding est en section `establishment`, révision 10, non finalisé. **VERIFIED** : Google → TOTP → compte/session → arrivée onboarding. **NOT_RUN** : onboarding complet/cockpit et Google mobile ; conservation privée des codes de secours non attestée. Le précédent blocage TOTP ci-dessous est historique. Le propriétaire précise qu'il n'avait pas le temps de tester ; les onglets doivent être conservés pour lui, ce qui a été corrigé par une remise explicite de l'onglet. Il demande désormais une revue de la présentation onboarding dans ChatGPT : [compte rendu complet](../compte-rendu-chatgpt-2026-09-13.md). Aucun changement fonctionnel pour ce compte rendu.

## Périmètre et décisions

Le propriétaire autorise Google en Preview sur `product/stitch-functional-owner`, avec les comptes et protections existants conservés. Il confirme ensuite le maintien du TOTP et délègue le choix du meilleur périmètre d'isolation. Apple reste hors de ce lot.

Le projet Google historique `tablenow` ne contient qu'un client Web `TableNow`, dont les origines sont `tablenow.io`, `app.tablenow.io` et `app.tablenow.creez.io`. Ses retours concernent ces applications, les calendriers et Supabase. Aucune valeur secrète n'a été lue dans ce client et aucun paramètre historique n'a été enregistré.

Google indique que la création d'un client ajoute automatiquement les domaines de retour au consentement du projet. Choix retenu après consultation : projet distinct **TableNow Copilot Preview**, ID `tablenow-copilot-preview`. Sa création et celle de son consentement sont confirmées dans Google Cloud. Audience externe initialisée en mode test, contact du propriétaire. Aucun rattachement de facturation demandé.

## Contrat technique

- Bibliothèque officielle `google-auth-library`, flux serveur Authorization Code avec PKCE S256.
- Retour défini par le code : `https://tablenow-copilot-v2-git-product-stitch-funct-786bbe-tablenow101.vercel.app/api/v1/oauth/google/callback`.
- Alias vérifié via Vercel sur `dpl_DJSJo2scmk7YRewh2Qa9RXqu7Ubz`, branche cible. Le début du parcours est ramené sur cet alias afin de conserver le cookie lors du retour Google.
- Variables serveur attendues : `GOOGLE_OAUTH_CLIENT_ID` et `GOOGLE_OAUTH_CLIENT_SECRET`, uniquement Preview et branche cible. Aucun secret dans le code ou le dépôt.
- Activation fermée en production et sur les autres branches Vercel. Le bouton reste indisponible si les variables manquent.
- Portées `openid email profile`, sans accès aux calendriers, contacts, documents ni rafraîchissement hors ligne.
- État à usage unique lié à un cookie HttpOnly/SameSite=Lax, vérificateur PKCE et nonce chiffrés en PostgreSQL, expiration dix minutes. Retour fixe, erreurs génériques sans réponse Google ni secret dans les logs applicatifs.
- Vérification de signature, émetteur, audience, expiration, nonce, adresse vérifiée et partie autorisée du jeton.
- Identité stable Google `sub`. Un compte existant doit vérifier son TOTP actuel avant la liaison ; son mot de passe, ses memberships et son restaurant sont conservés. Un autre compte Google ne peut pas remplacer silencieusement une liaison existante.
- Nouveau compte : Google, configuration TOTP, codes de secours, puis onboarding. Compte complet : Google, TOTP, puis cockpit. L'onboarding n'est pas modifié ; la destination reste dérivée de la session et du profil réellement terminé.
- Un nouveau compte Google n'a pas de mot de passe local tant qu'il n'en définit pas par la récupération existante, qui conserve le TOTP. Les comptes existants gardent leur mot de passe.
- Migration additive 011 : identités Google et tentatives OAuth privées ; autorise un mot de passe absent pour un compte Google, sans toucher aux valeurs des comptes existants.

## Vérifications locales

33 tests API ciblés passent : Google (13), authentification existante, origine et migrations. La suite API complète passe ensuite : 93 réussis, 4 ignorés (intégration PostgreSQL externe). 40 tests console passent. Typage API, compilation API et compilation Next réussis. Les tests Google utilisent des identités synthétiques et une clé RSA de test, jamais un compte Google réel. Le vérificateur JWT officiel est réellement exécuté sur ces jetons synthétiques.

Cas vérifiés : cookie/état manquants ou falsifiés, annulation, expiration, usage unique, signature altérée, mauvais émetteur/audience/nonce, adresse non vérifiée, mauvais `azp`, absence de session avant TOTP, liaison après TOTP uniquement, conservation du mot de passe et du tenant, distinction profil nouveau/complet, persistance de session selon le choix existant, absence de contournement par l'ancien code e-mail.

## État cloud et verdict produit

La première création du client Web a échoué côté Google : « The attempted action failed, please try again », suivi `c7093656697482854`. La cause n'est pas précisée. Après confirmation de l'absence de doublon, une nouvelle tentative a réussi : client `821975624190-inqv4e50mr2248a4mefpbg2e7rj786s8.apps.googleusercontent.com`, retour Preview unique conforme au code, aucune origine JavaScript requise par ce flux serveur.

Incident de manipulation : Google a inclus la première clé dans le libellé accessible de son bouton de copie ; une sortie d'inspection l'a exposée. Cette clé, jamais configurée ni utilisée par Copilot, a immédiatement été remplacée, puis désactivée et supprimée. La relecture de la fiche confirme qu'il ne reste que la clé de remplacement active. Celle-ci a été transférée en mémoire vers Vercel sans affichage ni fichier. La vérification CLI confirme les deux variables OAuth de type Secret, uniquement Preview et branche cible. Aucun secret n'est reproduit dans ce rapport.

Commit de code `4f0512cc975af7de74dc793ae7d9f9fc000fb5a5` poussé sur la branche cible. Preview `https://tablenow-copilot-v2-hepfd5jgo-tablenow101.vercel.app`, déploiement `dpl_7dYLEchAZ97gQEQXRWnbprWCmSXU`, **READY**, compilation 25 s. Alias de branche confirmé. Migration 011 relue sur Neon Preview `br-ancient-sun-za1ku4d2`. GitHub Quality Gate `34785982463` : qualité, PostgreSQL externe et Docker tous réussis. Aucune entrée dans le filtre 5xx du déploiement sur les quinze minutes contrôlées ; cela ne certifie pas toutes les routes.

Google Cloud confirme le mode Testing et les utilisateurs de recette `radwan.arbane@gmail.com` et `bryanduvalpro@gmail.com`.

### Parcours réellement joué

Persona : propriétaire découvrant la connexion Google. Environnement : alias Preview ci-dessus, vrais Google OAuth et PostgreSQL Preview, navigateur desktop 1280 × 720.

1. Ouvrir `/login` : bouton Google actif, Apple inactif, palette existante, aucun débordement horizontal.
2. Cliquer Google : arrivée sur le sélecteur de compte officiel.
3. Choisir le compte du propriétaire déjà connecté `radwan.arbane@gmail.com` : consentement limité au profil et à l'adresse e-mail.
4. Continuer : retour réel sur l'origine Preview, `/login`, titre **Configurer votre application**, sans alerte applicative.
5. La saisie privée du TOTP est confiée au propriétaire. Aucun code, QR ou clé TOTP lu ni enregistré dans les preuves. Le profil Google est nouveau dans Copilot ; il ne remplace pas le compte de test existant. La création du compte et du restaurant attend la vérification TOTP.
6. Écran public `/register` également vérifié : Google actif, champs vides, aucun débordement desktop ; capture `preview-desktop-register.png`.

Verdict du parcours complet : **BLOCKED** à la saisie privée du TOTP. **VERIFIED** : bouton → Google → consentement → retour TableNow. **NOT_RUN** : validation réelle du TOTP, conservation des codes de secours, onboarding complet, cockpit d'un profil complet et parcours mobile. Les tests automatisés de ces destinations ne remplacent pas cette recette réelle. Ne pas déclarer le parcours livré ou certifié avant sa fin.

## Diagnostic apres le retour du proprietaire

Le 13 septembre à 22:25 UTC, le propriétaire indique avoir utilisé « Continuer avec Google » et ne pas avoir pu terminer. Lecture seule de Neon Preview, sans lecture des secrets ou contenus scellés :

- Profil Radwan : challenge `enroll` créé à 22:13:34 UTC, zéro tentative TOTP enregistrée, non consommé, expiration 22:23:34 UTC. Aucun utilisateur créé pour cette adresse.
- Même adresse : autre challenge `email` à 22:17:42 UTC, deux essais, non consommé, toujours au stade e-mail. La cause précise n'est pas déductible de ces métadonnées : le code rejette également une récupération pour un utilisateur inexistant, même après un code correct.
- Profil Bryan : utilisateur actif avec identifiants existants, aucune liaison Google. Les deux adresses représentent des identités distinctes ; ne pas fusionner ni réinitialiser les facteurs implicitement.
- Vercel : alias stable de branche READY sur `f0e98b9119f585b466ab639afceca8e2af59cc97`, déploiement `dpl_E9wYLpf1BhbkHSrE6KhX45NjJJJc`. Navigateur : seul Google Cloud Audience reste ouvert au moment du contrôle.

Le précédent lien `/login?google=continue` dépendait d'une vérification de dix minutes : il ne constitue pas une entrée durable. Aucun nouveau parcours, e-mail ou changement de configuration lancé pendant ce diagnostic. Verdict complet **BLOCKED** ; problème de compréhension produit signalé par le propriétaire, aucune certification. Clarifier le compte souhaité puis accompagner une seule tentative depuis l'entrée stable, sans code partagé dans le chat.

## Références officielles

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Vérification serveur du jeton Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)

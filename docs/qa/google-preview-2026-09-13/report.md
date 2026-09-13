# Google + TOTP — Copilot Preview

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

Incident de manipulation : Google a inclus la première clé dans le libellé accessible de son bouton de copie ; une sortie d'inspection l'a exposée. Cette clé, jamais configurée ni utilisée par Copilot, a immédiatement été remplacée, puis désactivée et sa suppression demandée. La clé de remplacement a été transférée en mémoire vers Vercel sans affichage ni fichier. La vérification CLI confirme les deux variables OAuth de type Secret, uniquement Preview et branche cible. Aucun secret n'est reproduit dans ce rapport.

Aucun déploiement du lot Google n'est encore attesté ici. Le parcours navigateur Google → TOTP → onboarding/cockpit desktop/mobile est **NOT_RUN** ; verdict produit **BLOCKED**, en attente du déploiement et de la recette réelle. Les tests et la compilation ne valent pas authentification Google fonctionnelle.

## Références officielles

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Vérification serveur du jeton Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)

# Authentification simple — Preview, 23 septembre 2026

## Périmètre verrouillé

Seul le bloc authentification est ouvert. `main`, la production, l’onboarding, le cockpit, les intégrations et Cloudflare ne sont pas modifiés.

## Parcours implémenté localement

- création : nom, e-mail, code e-mail à six chiffres, session ;
- retour : e-mail, code e-mail à six chiffres, session ;
- Google : identité Google vérifiée puis session directe ;
- case « Rester connecté sur cet appareil » ;
- reprise d’un code e-mail encore valide après rechargement ;
- code incorrect, code expiré, renvoi et erreur réseau traités distinctement ;
- aucune demande visible de mot de passe, TOTP, QR ou code de secours ;
- les anciennes pages « mot de passe oublié » et « codes de secours » redirigent vers le parcours actif.

Les mécanismes historiques restent temporairement présents côté serveur pour permettre un retour arrière sans perte des comptes existants. Ils ne sont pas exposés dans la nouvelle interface.

## Protections conservées

- code limité dans le temps et stocké haché ;
- cinq tentatives et cinq envois au maximum dans la fenêtre existante ;
- verrou transactionnel contre les doubles créations ;
- cookies de session sécurisés, HttpOnly pour la session et protection CSRF ;
- contrôle d’origine ;
- Google OAuth avec `state`, PKCE, `nonce`, validation de signature, audience et e-mail vérifié ;
- aucune clé ni code sensible dans l’URL ou les journaux.

## Vérifications locales

`pnpm check` réussit entièrement : lint, typage, tests et build de production. Les tests ajoutés couvrent un compte neuf, un compte qui revient, une inscription répétée et un compte historique avec anciens identifiants. Les tests Google couvrent compte neuf, compte existant, cookies de session et protections OAuth.

## État de livraison

La modification n’est pas encore publiée au moment de cette note. La recette réelle sur `preview.tablenow.io` reste obligatoire sur ordinateur et mobile avant validation produit. Aucune branche ne sera supprimée avant cette validation et l’accord explicite du propriétaire sur une liste exacte.

La mise à jour de la mémoire PostgreSQL canonique est en attente : l’accès disponible retourne HTTP 401. Cette note de dépôt ne la remplace pas.

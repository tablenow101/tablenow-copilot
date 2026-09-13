# Adresse stable Copilot — 14 septembre 2026

## Périmètre

Adresse demandée : `https://copilot.tablenow.io`. Projet Vercel existant `tablenow-copilot-v2`, équipe `tablenow101`, branche `product/stitch-functional-owner`, environnement Preview. Aucun nouveau projet applicatif, aucune promotion production. Les comptes, facteurs et brouillons ne sont pas migrés ou réinitialisés.

## Affectation et DNS réellement exécutés

Avant intervention : réponse NXDOMAIN du serveur faisant autorité Gandi et de Cloudflare pour `copilot.tablenow.io`, aucun alias Vercel correspondant dans l'équipe et aucun domaine correspondant dans le projet. L'API d'ajout Vercel a accepté ce nouveau rattachement sans transfert depuis un autre projet.

Rattachement enregistré avec `gitBranch=product/stitch-functional-owner`. Gandi : ajout de `copilot CNAME e78958d5ab6ef167.vercel-dns-017.com.` (TTL 300) et d'un TXT de vérification Copilot dans `_vercel` (TTL 3600), en conservant les trois valeurs de vérification déjà présentes. Comparaison du tableau DNS : 26 lignes avant, 28 après, zéro ligne préexistante supprimée ou modifiée. Les A du site principal, CNAME `app`, MX, SPF, DKIM, autres sous-domaines et serveurs de noms sont inchangés.

Relecture DNS faisant autorité réussie. Vercel confirme `verified=true`, `misconfigured=false`, aucun conflit. À la vérification initiale, le domaine s'est attaché au déploiement Preview `dpl_E9wYLpf1BhbkHSrE6KhX45NjJJJc` (`f0e98b9`). Ce commit initial ne contient pas encore les corrections de ce lot ; le commit final servi doit être relu après publication.

## Serveur et Google

- `PUBLIC_ORIGIN=https://copilot.tablenow.io` ajouté comme Config, uniquement Preview et branche cible ; cette configuration alimente CORS, contrôles d'origine et cookies HTTPS existants.
- Client du seul projet Google `tablenow-copilot-preview` : ajout de `https://copilot.tablenow.io/api/v1/oauth/google/callback`, puis relecture des deux URI enregistrées. La première sauvegarde Google a retourné une erreur générique ; la seconde a été confirmée par « OAuth client saved » et relecture.
- L'ancien retour reste autorisé temporairement conformément à la consigne de transition. Les nouvelles connexions utilisent l'origine serveur stable. L'échange conserve l'origine scellée de la tentative : un retour sur une autre origine est refusé ; une tentative commencée avant la bascule sur l'ancien alias peut encore finir sur cet alias.
- Aucun secret modifié, affiché ou extrait pendant ce lot. Les cookies restent propres à chaque hôte ; la connexion à la nouvelle adresse nécessite une authentification normale, sans copier les sessions entre domaines.

## Modifications produit limitées

Deux textes corrigés selon la demande explicite : « Bonjour et bienvenue, comment puis-je vous aider ? » et « Manuscrit ». Aucun remplacement de logo : les trois pièces jointes annoncées ne sont pas disponibles dans le message ni dans les pièces jointes locales identifiées. L'asset existant n'est pas présenté comme ces trois nouvelles références.

Écarts repérés par lecture du code, à confirmer dans le vrai parcours : saisie d'un fuseau IANA et libellé de date ISO ; une branche fournisseurs/stock existe encore pour des brouillons ou inférences concernés, même si stocks et fournisseurs sont retirés de la sélection principale des priorités. L'absence universelle de questions techniques/modules hors périmètre n'est pas certifiée. Aucun effacement des données historiques pour masquer ces écarts.

## Vérifications locales

API : 95 tests réussis, 4 ignorés localement ; console : 40 tests réussis. Tests supplémentaires du changement d'origine et du refus d'un retour sur une origine différente. Typage API, compilation API et compilation Next.js réussis. Ces preuves ne certifient pas les parcours réels sur le nouveau domaine.

## Recette réelle à compléter après publication

| Parcours sur copilot.tablenow.io | État au lancement du déploiement |
|---|---|
| HTTPS, version et commit servi | À relire après publication |
| Google → TOTP → onboarding | NOT_RUN ; saisie privée du propriétaire |
| Inscription et récupération e-mail | NOT_RUN ; réception réelle à confirmer |
| Reconnexion compte existant | NOT_RUN |
| Onboarding, sauvegarde et reprise | NOT_RUN sur ce domaine |
| Textes et périmètre affichés | NOT_RUN sur ce domaine |
| Finalisation → premier résultat → cockpit | NOT_RUN |
| Ordinateur et mobile | NOT_RUN sur ce domaine |

La réussite Google/TOTP sur l'ancien alias le 13 septembre reste historique ; elle ne remplace pas cette recette. Pour une saisie privée, conserver l'onglet et le remettre explicitement au propriétaire, sans fermeture ni nouveau challenge pendant sa saisie.

## Références

- [Affecter un domaine à une branche Vercel](https://vercel.com/docs/domains/working-with-domains/assign-domain-to-a-git-branch).
- [Ajouter un domaine avec gitBranch](https://vercel.com/docs/rest-api/projects/add-a-domain-to-a-project).
- [Compte rendu précédent](compte-rendu-chatgpt-2026-09-13.md).

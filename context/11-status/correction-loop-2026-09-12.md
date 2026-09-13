# Boucle de corrections — 12 septembre 2026

## Périmètre et vérité du rapport

Le propriétaire a demandé une équipe de correction et un reporting du travail réellement accompli après la proposition des six lots. Cette passe porte sur le code local Copilot et les tests isolés. Aucun déploiement, envoi à un client ou changement du backend historique n'est inclus. Les résultats ci-dessous ne constituent pas une attestation de disponibilité du produit complet.

La mémoire canonique `project_memory.current_records` a été consultée sur la branche stable indiquée dans AGENTS.md. Les décisions plus récentes de la conversation restent applicables : TableNow répond par écrit, l'utilisateur décide, dashboard immédiat après onboarding. Les références antérieures à une exécution autonome ne valent pas autorisation d'envoi.

## Équipe de travail de cette session

| Responsable | Périmètre |
|---|---|
| Chief of Staff | Coordination, relecture des correctifs et consolidation des preuves |
| Onboarding | Cycle de vie du microphone, saisie dans la synthèse et documents |
| Backend | Régression du budget d'e-mails, authentification et tests de documents |
| Domaine | Contrôles des outils inconnus et classement des demandes groupées |
| Vérification | Tests frais sans cache, relecture indépendante, recette navigateur isolée |
| Recherche BCC | Lecture seule des dépôts historiques frontend et backend |

Ces agents ne sont pas des agents métier déployés dans TableNow.

## BCC retrouvé dans le code historique

La génération se trouve dans [provisioning.service.ts](https://github.com/tablenow101/tablenowbackend/blob/main/src/services/provisioning.service.ts) : `bcc+r-${restaurant.id}@${EMAIL_DOMAIN}`, stockée dans `restaurants.bcc_email`. L'affichage existe dans [GeneralSettings.tsx](https://github.com/tablenow101/tablenowfrontend/blob/main/src/pages/settings/GeneralSettings.tsx). La réception CloudMailin et le traitement sont dans [routes/email.ts](https://github.com/tablenow101/tablenowbackend/blob/main/src/routes/email.ts), exposés sous `/api/email/bcc`.

Ce parcours est du code Express/CloudMailin/Supabase, pas une preuve de dépendance n8n. Son existence en code est confirmée, pas sa livraison actuelle en production. Aucun de ces dépôts n'a été modifié.

Risques identifiés avant réutilisation : absence de numéro de confirmation dans le résultat du parseur, rapprochement de secours avec la dernière réservation d'une adresse e-mail, couverture linguistique limitée, métadonnées d'e-mail potentiellement perdues, erreurs de stockage non toutes contrôlées, déduplication non visible dans la route et génération BCC dépendante du provisioning vocal.

## Correctifs en cours de recette

- Domaine : refus prudent pour les noms hérités de l'objet JavaScript ; priorité du risque critique des demandes collectives sur des mots de risque inférieur. Huit nouveaux tests échouaient avant et passent après. Le classement par mots-clés ne remplace pas un contrôle d'autorisation.
- Compte : le budget d'envois ne doit pas être réduit par la validation du code. Régression reproduite ; vérification du correctif et du non-rejeu en cours.
- Interface : saisie texte/voix sur la synthèse, retour à la note finale pour confirmation ; suppression du code dormant de synthèse vocale, garde contre démarrage micro concurrent, verrou des mutations document et validation du type déclaré.

Les tests qui lisent le code des composants restent des contrôles structurels : ils ne prouvent pas un comportement exécuté dans le navigateur.

## Première exécution indépendante

Commande : `env -i PATH="$PATH" NODE_ENV=test CI=1 pnpm exec turbo run test lint typecheck --force --env-mode=strict --concurrency=2`.

Résultat initial : 38 tâches exécutées, aucune en cache ; 148 tests réussis et quatre tests d'isolation PostgreSQL ignorés faute d'INTEGRATION_DATABASE_URL. Worker, sync-gateway et MCP n'ont pas de suite de tests propre. Le script lint effectue un contrôle TypeScript, pas une analyse ESLint indépendante.

## Seconde exécution indépendante

Sur les huit fichiers de correctifs initiaux : même commande forcée, 38/38 tâches exécutées sans cache, aucun échec, 162 tests réussis et quatre ignorés. Détail : console 39, core-api 69, domaine 22, contrats 10, adaptateurs 13, computer-use 4, simulateur 3, agent-runtime 2. Durée annoncée par la commande : 37,15 secondes. Les quatorze tests supplémentaires comprennent deux contrôles structurels de composants, pas quatorze parcours utilisateur.

L'installation officielle de Chromium a échoué après deux timeouts réseau de trente secondes vers cdn.playwright.dev. Aucun navigateur n'a été installé, aucun parcours navigateur n'a été exécuté. Le test local existant utilisait encore l'ancien OTP ; adaptation de ce harness pour la nouvelle inscription en cours, messagerie capturée localement sans envoi réel.

Une relecture ultérieure du microphone a déclenché une dernière correction de nettoyage et d'événements tardifs. Après ce changement, console : 40 tests réussis, typage et diff vérifiés. Cette relance ciblée ne constitue pas une troisième relance globale. Les trois nouveaux tests de composants sont structurels.

Le harness a été adapté dans `services/core-api/src/testing/owner-local.ts` : nouvelle inscription possible en configuration de test, expéditeur injecté simulé, destinataires `.test` uniquement, refus en production/Preview/Vercel. Typage core-api et huit tests de configuration réussis après modification. Son lancement réel est bloqué avant démarrage du serveur : `listen EPERM` sur le canal IPC temporaire de tsx. Aucune tentative de contournement ; aucune réception simulée observée ni recette navigateur attestée.

## Bilan de cette passe

Neuf fichiers code/tests modifiés et trois fichiers de contexte ajoutés ou actualisés. Aucune migration, écriture de données métier distante, publication GitHub, déploiement ni communication réelle. Base de travail : commit `24373d7`, correctifs conservés localement non publiés. La précision de périmètre D-025 n'a pas été ajoutée à PostgreSQL pendant cette passe.

Les corrections ciblées sont testées aux niveaux indiqués ; le produit complet reste non attesté. Pour poursuivre la recette réelle, il faut un environnement de test autorisant le serveur local et disposant d'un navigateur, ou une Preview de test accessible avec ses services autorisés. Les services externes ne doivent pas être présentés comme fonctionnels sur la foi de ces suites locales.

## Conditions de clôture

- Rejouer les suites après tous les correctifs et conserver les nombres exacts.
- Distinguer navigateur avec données synthétiques, intégrations simulées et services réels.
- Ne jamais convertir un test bloqué ou ignoré en réussite.
- Ne pas annoncer un taux d'erreur à partir du nombre d'écarts du catalogue historique.
- Connexions externes, réception réelle des e-mails/SMS, transcription locale Whisper et analyse automatique des documents ne sont pas attestées par cette passe.

Point découvert hors correction immédiate : collision structurelle possible dans les composantes de `idempotencyKey` contenant U+001F. Modifier son format nécessite l'analyse des clés persistées ; aucun changement aveugle du format n'a été fait.

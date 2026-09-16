# TableNow Continuous Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer l’onboarding accompagné, les connexions vérifiables et l’Advisor continu sur Preview sans régression, puis préparer une recette complète avant toute promotion.

**Architecture:** Le travail avance par lots verticaux sur `product/onboarding-owner`. Les contrats et migrations sont additifs, PostgreSQL reste la source de vérité et chaque état visible provient d’une preuve persistée. Les composants volumineux sont découpés seulement aux frontières touchées.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, Fastify 5, PostgreSQL/Neon, Zod 4, Vitest, Vercel Preview.

**Spec:** `docs/product/CONTINUOUS_ADVISOR.fr.md` et `docs/superpowers/specs/2026-09-16-continuous-advisor-design.md`

## Global Constraints

- Référence canonique : PostgreSQL `project_memory.current_records`, enregistrement 94, version 3.
- Storyboard : priorités → établissement → systèmes utilisés → connexions réelles → compléments → synthèse → dashboard.
- Aucun connecteur n’est `connected` sans test technique réel réussi et persisté.
- Aucun faux connecteur ni conseil présenté comme fondé sur des données absentes.
- Logo officiel et couleurs validées ; aucune ancienne photo d’accueil.
- Une seule barre TableNow compacte, rétractable et non superposée au contenu.
- Préserver comptes, Google, e-mail, TOTP, Google Places, brouillons, données et dashboard.
- Migrations numérotées et additives ; ne jamais réécrire une migration appliquée.
- Un commit clair et des tests après chaque lot.
- `main` et `os.tablenow.io` restent intacts jusqu’à la recette complète et à l’autorisation explicite du propriétaire.

---

### Task 1: Verrouiller le storyboard et retirer l’ancien accueil photographique

**Files:**
- Create: `apps/console/lib/onboarding-storyboard.ts`
- Create: `apps/console/lib/onboarding-storyboard.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `services/core-api/src/onboarding.ts`
- Modify: `services/core-api/src/onboarding.test.ts`
- Modify: `apps/console/components/OnboardingFlow.tsx`
- Modify: `apps/console/onboarding-boundary.test.ts`
- Modify: `apps/console/app/stitch.css`
- Delete: `apps/console/public/brand/restaurant-stitch.jpg`
- Modify: `context/10-decisions/decision-log.md`
- Modify: `context/11-status/current-state.md`

**Interfaces:**
- Produces: `onboardingStoryboard`, ordre visible et serveur identique, commençant par `priorities`.
- Preserves: les clés de réponses et sections persistées existantes pendant ce premier lot.

- [ ] Écrire les tests qui exigent `priorities` en premier, `establishment` en second et interdisent toute ressource ou classe d’accueil photographique.
- [ ] Exécuter `pnpm --filter @tablenow/core-api test -- src/onboarding.test.ts` et `pnpm --filter @tablenow/console test -- onboarding-storyboard.test.ts onboarding-boundary.test.ts`; vérifier l’échec attendu.
- [ ] Ajouter le contrat partagé du storyboard et l’utiliser côté interface et serveur sans dupliquer l’ordre.
- [ ] Supprimer la ressource photo et les styles `.tn-welcome`, `.tn-welcome-photo`, `.tn-welcome-start` devenus sans appel.
- [ ] Mettre à jour la décision et l’état projet avec le périmètre exact du lot.
- [ ] Exécuter les tests ciblés, `pnpm typecheck`, `pnpm build`, `git diff --check` et le scan de secrets.
- [ ] Vérifier localement les largeurs 390 px et 1440 px : première étape priorités, aucune photo, navigation vers établissement.
- [ ] Commit : `feat(onboarding): lock priority-first storyboard`.

### Task 2: Persister l’inventaire des systèmes et la checklist personnalisée

**Files:**
- Create: `services/core-api/migrations/012_onboarding_system_inventory.sql`
- Create: `packages/contracts/src/onboarding-systems.ts`
- Create: `packages/contracts/src/onboarding-systems.test.ts`
- Create: `services/core-api/src/connection-checklist.ts`
- Create: `services/core-api/src/connection-checklist.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `services/core-api/src/onboarding.ts`
- Modify: `services/core-api/src/repository.ts`
- Modify: `services/core-api/src/owner-operations.ts`
- Create: `apps/console/components/onboarding/SystemsStep.tsx`
- Create: `apps/console/components/onboarding/ConnectionsStep.tsx`
- Create: `apps/console/components/onboarding/ComplementsStep.tsx`
- Create: `apps/console/components/onboarding/SynthesisStep.tsx`
- Modify: `apps/console/components/OnboardingFlow.tsx`

**Interfaces:**
- Produces: `SystemInventory`, `ConnectionChecklistItem`, `deriveConnectionChecklist(answers)`.
- Persists: réponses, provenance, checklist et progression par restaurant.

- [ ] Écrire des tests de normalisation pour réservation, POS, calendrier, communications, équipe, hybride, papier et aucun outil.
- [ ] Écrire des tests montrant qu’une réponse ajoutée ou retirée ajoute ou retire exactement l’élément correspondant de la checklist.
- [ ] Ajouter la migration 012 avec contraintes de tenant, index et données par défaut ; tester sa réapplication et la conservation des brouillons.
- [ ] Ajouter les étapes visibles et la synthèse modifiable ; `J’ai terminé` est la seule sortie des compléments.
- [ ] Vérifier retour arrière, rafraîchissement, conflit de révision et reprise sur un second viewport.
- [ ] Exécuter tests ciblés, migration PGlite, typecheck, build, diff et scan de secrets.
- [ ] Commit : `feat(onboarding): derive persistent connection checklist`.

### Task 3: Construire le registre d’intégrations et les connexions vérifiables

**Files:**
- Create: `services/core-api/migrations/013_connection_verifications.sql`
- Create: `packages/contracts/src/integrations.ts`
- Create: `packages/contracts/src/integrations.test.ts`
- Create: `services/core-api/src/integration-registry.ts`
- Create: `services/core-api/src/integration-registry.test.ts`
- Create: `services/core-api/src/connection-verification.ts`
- Create: `services/core-api/src/connection-verification.test.ts`
- Modify: `services/core-api/src/owner-operations.ts`
- Modify: `services/core-api/src/repository.ts`
- Modify: `apps/console/components/onboarding/ConnectionsStep.tsx`
- Modify: `apps/console/components/SystemsCenter.tsx`

**Interfaces:**
- Produces: `ConnectionState = to_connect | authorization_pending | to_test | connected | reconnect_required`.
- Enforces: seule `recordSuccessfulVerification()` peut produire `connected`.

- [ ] Tester l’interdiction de `connected` sans preuve réussie, la péremption et la reconnexion.
- [ ] Persister tentatives, résultats, portée, dernière synchronisation et erreur sans secret.
- [ ] Afficher les fournisseurs indisponibles avec état réel et prochaine action, sans bouton factice.
- [ ] Tester un connecteur réel disponible avec une lecture non destructive ; laisser les autres honnêtement indisponibles.
- [ ] Exécuter tests, migration, typecheck, build, vérification responsive et scan de secrets.
- [ ] Commit : `feat(integrations): require verified connection states`.

### Task 4: Unifier la barre TableNow

**Files:**
- Create: `apps/console/components/TableNowComposer.tsx`
- Create: `apps/console/components/TableNowComposer.test.tsx`
- Modify: `apps/console/components/ConversationInput.tsx`
- Modify: `apps/console/components/OnboardingFlow.tsx`
- Modify: `apps/console/components/OwnerShell.tsx`
- Modify: `apps/console/app/globals.css`

**Interfaces:**
- Produces: `TableNowComposer` avec document, texte, microphone, envoi, états voix et réduction.

- [ ] Tester clavier, zones tactiles, réduction, fichiers autorisés et états microphone.
- [ ] Remplacer les variantes existantes par le composant commun en préservant l’upload privé et la transcription.
- [ ] Réserver l’espace de mise en page afin que la barre ne masque aucun contenu à 390, 768 et 1440 px.
- [ ] Exécuter tests, typecheck, build et contrôle visuel.
- [ ] Commit : `feat(ui): unify compact TableNow composer`.

### Task 5: Implémenter l’Advisor à trois niveaux

**Files:**
- Create: `services/core-api/migrations/014_advisor_recommendations.sql`
- Create: `packages/contracts/src/advisor.ts`
- Create: `packages/contracts/src/advisor.test.ts`
- Create: `services/core-api/src/continuous-advisor.ts`
- Create: `services/core-api/src/continuous-advisor.test.ts`
- Modify: `services/core-api/src/governed-copilot.ts`
- Modify: `services/core-api/src/repository.ts`
- Modify: `services/core-api/src/owner-operations.ts`

**Interfaces:**
- Produces: `AdvisorRecommendation` avec `level`, `basis`, `sources`, `sourceDate`, `confidence`, `expectedImpact`, `horizon`, `decisionRequest`.

- [ ] Tester le niveau knowledge sans donnée propre et l’interdiction des affirmations non sourcées.
- [ ] Tester les seuils documentés pour premières données et historique suffisant.
- [ ] Persister les recommandations et leur provenance ; conserver le restaurateur comme décideur.
- [ ] Exécuter tests d’isolation tenant, budget, connaissances approuvées, typecheck et build.
- [ ] Commit : `feat(advisor): add evidence-based personalization levels`.

### Task 6: Intégrer l’Advisor et les notifications persistantes dans le produit

**Files:**
- Create: `services/core-api/src/notifications.ts`
- Create: `services/core-api/src/notifications.test.ts`
- Create: `apps/console/components/AdvisorPanel.tsx`
- Create: `apps/console/components/AdvisorPanel.test.tsx`
- Modify: `apps/console/components/ProductShell.tsx`
- Modify: `apps/console/components/AppChrome.tsx`
- Modify: `apps/console/components/OwnerShell.tsx`
- Modify: `services/core-api/src/owner-operations.ts`

**Interfaces:**
- Produces: conseils visibles dans cockpit/départements/états vides et historique de notifications lu/non lu.

- [ ] Tester les états sans données, incomplet, en cours, réussi, erreur, premières données, données suffisantes, anciennes, non autorisé et reprise.
- [ ] Remplacer les notifications calculées côté interface par les événements persistés.
- [ ] Montrer maintenant, ensuite, recommandation et décision attendue sur chaque surface.
- [ ] Exécuter tests, typecheck, build et contrôle desktop/mobile.
- [ ] Commit : `feat(advisor): surface guidance and notification history`.

### Task 7: Ajouter les profils internes et photos privées

**Files:**
- Create: `services/core-api/migrations/015_private_profiles.sql`
- Create: `services/core-api/src/private-media.ts`
- Create: `services/core-api/src/private-media.test.ts`
- Create: `services/core-api/src/team-profiles.ts`
- Create: `services/core-api/src/team-profiles.test.ts`
- Create: `apps/console/components/TeamProfileEditor.tsx`
- Modify: `services/core-api/src/environment.ts`
- Modify: `services/core-api/src/owner-operations.ts`
- Modify: `apps/console/components/OwnerShell.tsx`

**Interfaces:**
- Produces: `PrivateMediaStore`, profils internes, URL temporaire et initiales de repli.

- [ ] Tester l’isolation tenant, l’expiration d’URL, le refus public et la gestion des droits.
- [ ] Configurer un stockage privé réel uniquement après autorisation d’accès/coût ; aucun stockage public ou placeholder.
- [ ] Tester ajout, recadrage, remplacement et suppression de photo sur Preview.
- [ ] Exécuter tests de sécurité, typecheck, build et scan des sorties.
- [ ] Commit : `feat(team): add private internal profiles`.

### Task 8: Recette Preview et porte de promotion

**Files:**
- Create: `docs/qa/continuous-advisor-2026-09-16/report.md`
- Create: captures dans `docs/qa/continuous-advisor-2026-09-16/`
- Modify: `context/11-status/current-state.md`
- Modify: `context/11-status/blockers.md`
- Modify: `context/11-status/next-actions.md`

**Interfaces:**
- Produces: matrice de preuves et verdict par scénario ; aucune promotion automatique.

- [ ] Exécuter `pnpm check`, les migrations sur la ressource Preview dédiée et déployer `product/onboarding-owner`.
- [ ] Tester réellement Google, e-mail, TOTP, Google Places, sauvegarde/reprise, checklist, connexions, compléments, synthèse, premier résultat et dashboard.
- [ ] Rejouer le parcours sur ordinateur et mobile, y compris erreurs, retour arrière, interruption et absence de données.
- [ ] Vérifier logo/couleurs, disparition de la photo, barre non masquante, HTTPS, routes et absence de secrets.
- [ ] Marquer chaque scénario `PASS`, `FRICTION`, `WRONG_FLOW`, `BLOCKED` ou `UNSAFE`; tout verdict autre que `PASS` bloque la promotion.
- [ ] Commit : `docs(qa): certify continuous advisor preview`.
- [ ] Demander l’autorisation explicite du propriétaire avant toute fusion ou promotion vers `main`.

## Auto-revue du plan

- Couverture : les onze sections de la spécification sont reliées aux tâches 1 à 8.
- Données : migrations additives 012 à 015, conservation des brouillons et vérifications d’isolation.
- Vérité : connecteurs, conseils et notifications proviennent de preuves persistées.
- Livraison : aucun changement de `main`, recette réelle obligatoire, photos privées bloquantes uniquement à la porte de production.
- Aucun placeholder fonctionnel, connecteur simulé ou métrique inventée n’est prévu.

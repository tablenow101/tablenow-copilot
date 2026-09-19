# Aujourd’hui — plan d’intégration

**Goal:** Intégrer la composition validée dans le cockpit existant avec les données et actions réelles.
**Architecture:** Conserver OwnerShell comme contrôleur, isoler la synthèse visuelle en un composant de présentation et une fonction de calcul. Adapter la barre existante. Aucun nouveau service, fournisseur ou stockage.
**Tech Stack:** Next 16 / React 19 / TypeScript / CSS existant / Vitest.
**Spec:** `docs/product/pilote-visuel-2026-09-19.md`.

## Contraintes

Une branche, aucune dépendance nouvelle, pas de changement main/production, aucun secret. Pas de migration SQL dans ce lot. Aucun lot fonctionnel suivant clôturé implicitement.

## Séquence

- [x] Rétablir seulement les 300 fichiers suivis absents du worktree ; aucun fichier existant modifié. Vérifier clean et SHA distant.
- [ ] `lib/today-overview.ts` et test : métriques calculées sur les réservations réelles du jour/fuseau, exclusions annulations/absences, progression tâches réelle, états vides explicites.
- [ ] `components/TodayOverview.tsx`, `OwnerShell.tsx`, `app/stitch.css`, `app/components.css` : intégrer la composition, thème sauvegardé, navigation compacte accessible, données réelles, briefing via chat existant, détails métier conservés, barre dans le flux pour éviter le recouvrement.
- [ ] `ConversationInput.tsx`, `hooks/useDictation.ts` et tests : chargement/envoi, résultat provisoire séparé, arrêts et erreurs sans perte, édition sans doublons, aucune activation externe nouvelle.
- [ ] Typecheck/tests ciblés puis build. Revue unique du diff sur les risques réellement touchés.
- [ ] Commit clair, déploiement uniquement Preview autorisée, recette réelle avec compte utilisateur. Attendre saisie privée si nécessaire, sans contourner Google/TOTP. Captures et verdicts.
- [ ] Mettre à jour états, écarts restants et porte de validation propriétaire. Pas de promotion main.

## Périmètre conservé et travaux distincts

Google/e-mail/TOTP, Places, persistance onboarding, tâches/équipes/salle/décisions, communication et pièces jointes préservés. Passkeys, connexions fournisseurs, checklist d’onboarding, notifications persistantes complètes et photos privées nécessitent leurs propres lots et preuves ; une maquette approuvée ne les rend pas déjà disponibles. Cloudflare reste hors refonte UX.

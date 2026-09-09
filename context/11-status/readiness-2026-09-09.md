# Correction ciblée du contrôle de configuration — 9 septembre 2026

## Défaut confirmé

La route `apps/console/app/api/system/readiness/route.ts` inférait auparavant des services configurés à partir du seul contexte Vercel Preview. Avec une URL de base de données, elle pouvait déclarer des secrets, un administrateur et un e-mail disponibles ; toute Preview déclarait le stockage disponible. Le transport e-mail `log` pouvait contribuer à `readyForLogin`.

## Correction sur branche séparée

Chaque contrôle dépend désormais de paramètres explicitement présents et non vides. L'e-mail nécessite un transport SMTP sélectionné, un hôte et un expéditeur. Le stockage nécessite une configuration explicite. Les réponses précisent `verification: configuration-only` et `runtimeVerified: false`. Aucune valeur secrète n'est retournée. Aucun appel réseau, e-mail, migration, changement de domaine ou changement de production n'est effectué par ce correctif.

Les indicateurs `readyForMigrations` et `readyForLogin` décrivent uniquement les prérequis de configuration. Ils ne prouvent ni une connexion à la base, ni un envoi, ni une réception, ni un parcours utilisateur réussi. Le problème distinct du libellé de connexion est traité dans la PR #13 et n'est pas corrigé par cette route.

## Preuves et limites

16 scénarios de non-régression ont réussi localement sur Node 22.16.0 contre la route TypeScript réelle. Pour cette exécution sans dépendances du monorepo, seul l'import du moteur de tests a été adapté de `vitest` à `node:test`, ainsi que l'extension `.ts` de l'import de la route. Les mêmes assertions sont livrées pour Vitest dans `apps/console/readiness.test.ts`.

La suite Vitest du monorepo, le typage, le build, la CI distante et les parcours navigateur ne sont pas déclarés réussis par cette note. Ils restent à vérifier sur cette branche. Les paramètres synthétiques de test ne sont pas des identifiants réels. Aucune certification d'envoi SMTP, de stockage ou de fonctionnement en restaurant n'est délivrée.

## Livraison

Conserver la modification en PR brouillon jusqu'aux contrôles requis. Ne pas fusionner automatiquement. Les PR #12 (architecture événementielle) et #13 (onboarding) restent distinctes ; ce correctif ne prétend pas les achever. L'état du 31 août dans `current-state.md` est un historique, pas une preuve de disponibilité actuelle.

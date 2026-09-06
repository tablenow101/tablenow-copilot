# Reprise opérationnelle — 6 septembre 2026

## Priorité du fondateur

Finaliser l'UX de l'onboarding, l'implémenter dans une PR produit indépendante et livrer un premier résultat personnalisé à forte valeur, sauvegardé dans le cockpit. Ne pas rouvrir l'infrastructure et ne pas toucher à la PR #12.

## Sources effectivement relues

Dossier maître onboarding/produit du 4 septembre (23 pages, dont les références visuelles dark/clear et cockpit), règles AGENTS.md, context/CONTEXT.md, context/03-product/CONTEXT.md, onboarding actuel, contrats et commentaires de la PR #12.

Le dossier ancien contenait des zones encore ouvertes. La spécification produit les complète sous le mandat CTO/PO ; ne pas les décrire comme des écrans déjà approuvés ou testés. Le nom « Livre de maison » et les anciens replis ne sont pas réintroduits.

## Travail réalisé sur cette branche

- Contrat écran par écran dans docs/product/ONBOARDING_FINAL.fr.md : textes, composants, voix, branches, données, sauvegarde, erreurs, premier résultat et 28 scénarios de recette.
- Point d'entrée produit mis à jour.
- Aucun changement runtime, aucune fusion dans main, aucune action live demandée par ce lot documentaire.

## État d'exécution vérifié

Le dernier lancement @codex de la PR #12 a reçu « Codex couldn't complete this request. Try again later. » ; aucun nouveau code de cette PR n'est donc certifié. Créer un environnement cloud ou envoyer un commentaire ne prouve pas qu'un agent a démarré.

Le clone GitHub depuis le conteneur de travail de cette conversation a échoué sur la résolution DNS. L'accès aux fichiers du dépôt par le connecteur GitHub fonctionne. Ce blocage local n'autorise pas à inventer des tests exécutés.

## Prochain résultat attendu

Implémentation produit sur cette branche, puis preuve de parcours de bout en bout et lien Preview vérifié. Les préconditions de base isolée, secrets et sorties test doivent être contrôlées avant toute recette en écriture. L'absence de preuve = BLOCKED ou NOT_RUN, jamais PASS.

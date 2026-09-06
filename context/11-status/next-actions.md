# Prochaines actions — onboarding prioritaire

1. Lire [la reprise factuelle](onboarding-handoff-2026-09-06.md) et [le contrat produit](../../docs/product/ONBOARDING_FINAL.fr.md).
2. Implémenter le parcours complet, son état serveur et son premier livrable sauvegardé sur la branche produit dédiée. Ne pas modifier la PR #12 ni ouvrir un chantier d'infrastructure.
3. Vérifier les branches conditionnelles, erreurs, autorisations, sauvegardes, reprise de session et finalisation idempotente.
4. Jouer le parcours complet comme un restaurateur dans un navigateur desktop/mobile, avec des données synthétiques isolées et sans effets extérieurs réels.
5. Tester la Preview Vercel uniquement après preuve d'isolation de sa base et de ses services tiers. Documenter séparément les capacités bloquées et les tests non exécutés.
6. Livrer le lien testable, les captures/traces et les verdicts métier ; obtenir la validation de l'expérience avant fusion dans main.

Une demande @codex envoyée ne constitue pas un lancement confirmé. Un build READY ne constitue pas une recette produit.

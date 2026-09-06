# PR #13 — Correction ciblée de l'audit de dépendances

Date : 6 septembre 2026.
Périmètre : branche product/onboarding-final-experience uniquement ; aucune fusion dans main et aucune modification de la PR #12.

## Diagnostic vérifié

Le job Quality Gate 101401582382, run 34001693464, avait réussi lint, typage, tests unitaires et build puis échoué sur `pnpm audit --audit-level=high` : 8 entrées high pour fast-uri et 2 moderate pour qs. Les jobs PostgreSQL et Docker en dépendant n'avaient pas été exécutés.

Source : https://github.com/tablenow101/tablenow-copilot/actions/runs/34001693464/job/101401582382

Le commentaire Codex https://github.com/tablenow101/tablenow-copilot/pull/13#issuecomment-5555830385 indique seulement « Codex couldn't complete this request. Try again later. ». Aucun journal de tâche Codex consulté ne permet d'attribuer cet échec à l'audit GitHub. Ce sont deux constats à traiter séparément.

## Correction appliquée au verrouillage

Mise à jour ciblée dans les plages déjà admises par les dépendances parentes, sans changement de version majeure :

- fast-uri 3.1.5 → 3.1.7 ;
- fast-uri 4.1.2 → 4.1.4 ;
- qs 6.15.3 → 6.16.0.

Commande de résolution : `pnpm --recursive update fast-uri qs --depth 100 --lockfile-only --ignore-scripts`.

Aucun changement de package.json, des plages directes, de pnpm-workspace.yaml, des fournisseurs ou du code produit. Aucun override, aucune exclusion de vulnérabilité et aucun abaissement du contrôle. `.github/workflows/ci.yml` conserve `pnpm audit --audit-level=high` ; passer à moderate aurait rendu le seuil plus strict, pas résolu les vulnérabilités.

Le workflow temporaire de préparation est supprimé dans le même commit que le verrouillage corrigé. Il ne doit pas devenir une nouvelle infrastructure permanente. Il a utilisé un runner GitHub isolé, sans secret de production ni base de restaurant, et a seulement publié un blob Git à relire.

## Preuves de préparation

Run https://github.com/tablenow101/tablenow-copilot/actions/runs/34002932623/job/101404924001 : succès.

- Seul pnpm-lock.yaml modifié par la résolution ; importers et réglages inchangés.
- Seulement les trois versions de fast-uri/qs ci-dessus ont changé ; diff relu.
- Installation `--frozen-lockfile --ignore-scripts` réussie.
- `pnpm audit --audit-level=high` réussi.
- Audit JSON complet à 01:04 UTC : 0 info, 0 low, 0 moderate, 0 high, 0 critical, aucune advisory.
- Blob du verrouillage contrôlé : 7df38127d22bde1bf1207624d2eba5726be253ed ; SHA vérifié par comparaison avec git hash-object.

Un audit sans alerte signifie aucune vulnérabilité connue signalée par le registre à cet instant, pas une garantie générale de sécurité.

## Suite immédiate

Laisser la CI normale vérifier ce verrouillage avec les scripts usuels, le typage, les tests, le build, l'isolation PostgreSQL et les images Docker. La validation du runner de préparation ne remplace pas ces contrôles ni la recette navigateur.

Le chantier d'onboarding, ses 28 scénarios et le premier résultat métier restent inchangés. Le lancement Codex reste à confirmer séparément ; un commentaire de relance n'est pas une preuve d'exécution.

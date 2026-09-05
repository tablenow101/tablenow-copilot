# Statut — cutover événementiel

**Décision :** validée le 5 septembre 2026.  
**Branche de travail :** `codex-event-driven-preview-shadow-v1`.

## Validé

- état initial unique puis abonnement événementiel ;
- reprise par curseur ;
- absence de polling métier ;
- absence de fallback et de rétrocompatibilité ;
- base PostgreSQL éphémère et déterministe par Vercel Preview ;
- isolation stricte de Shadow Mode ;
- tous les effets externes via un Effect Gateway unique.

## En cours

1. inventaire du code existant ;
2. choix du transport temps réel compatible avec l’exploitation Vercel et les exigences de latence ;
3. cutover atomique et suppression de l’ancien chemin ;
4. automatisation du cycle Preview DB ;
5. centralisation des effets externes ;
6. tests grandeur nature et preuves.

## Gate

Aucune promotion Production avant preuve simultanée : temps réel, reconnexion, isolation tenant, reproductibilité Preview et absence totale d’effet externe en Shadow Mode.

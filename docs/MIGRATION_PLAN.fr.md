# Migration progressive depuis TableNow legacy

1. **Aucune écriture legacy** : V2 utilise une base distincte et ne reçoit aucun secret Supabase de production.
2. **Pilotes V2** : comptes et données de démonstration isolés ; ancien `app.tablenow.io` inchangé.
3. **Cartographie** : produire des exports documentés depuis les tables legacy, sans accès direct du nouveau runtime.
4. **Adaptateur d'import** : valider schémas, consentements, doublons, fuseaux, statuts et journal de provenance.
5. **Répétition à blanc** : importer une copie anonymisée, comparer les totaux et tester le rollback.
6. **Cohorte limitée** : migrer une organisation avec fenêtre, sauvegarde et accord explicite.
7. **Bascule** : changer le domaine seulement après critères d'acceptation, observation et plan de retour arrière.
8. **Décommissionnement** : conserver le legacy en lecture seule pendant la durée approuvée, puis supprimer secrets et données selon le calendrier.

Baselines protégées : frontend `fee6cbab747d95037a3859e9df61efc9a35473c6`, backend `e2b07131eb2fdc7fe103c8d05783cd9550610419`.

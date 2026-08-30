# Prévention des doublons

1. Chaque donnée importée conserve l'identifiant du système source.
2. Chaque action sortante possède une clé d'idempotence unique.
3. Les événements reçus sont dédupliqués avant traitement.
4. Une écriture ambiguë est bloquée et présentée pour validation.
5. Le résultat est relu dans la source avant d'être marqué réussi.
6. Aucune synchronisation bidirectionnelle n'est activée sans test de conflit.

Ces règles empêchent deux clics, deux reprises ou deux systèmes de créer silencieusement la même réservation.

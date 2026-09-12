# TableNow — livraison propriétaire du 12 septembre 2026

## Ce qui est construit

- Connexion réelle par code e-mail avec saisie six chiffres, gestion des erreurs et délai de renvoi. Accès invités conservés ; pas de fausse connexion Google.
- Onboarding avancé conservé : sauvegarde serveur, reprise, provenance des réponses, confirmations, conflits et premier plan persistant.
- Recherche d'établissement dans l'annuaire public français, résultats sourcés et sélection manuelle. Hors de France ou en cas d'indisponibilité, saisie manuelle.
- Accueil avant/pendant/après service, priorité mise en avant, chiffres et détails repliables.
- Décisions avec validation/refus/report et historique. L'arbitrage n'est pas présenté comme une exécution externe.
- Communications entrantes enregistrées, traitement des demandes, rédaction et sauvegarde des brouillons, envoi explicite via SMTP lorsqu'il est configuré.
- Tables, capacités, zones, états de salle, réservations, postes et pauses enregistrés en base.
- Conversation persistante et dictée après action explicite sur le micro. Le texte reste relisible avant envoi. Sans modèle configuré, le mode est clairement une synthèse factuelle, pas une IA simulée.

## Ce qui est prouvé

Typage, lint TypeScript, tests et builds du monorepo réussis localement. Migration 007 exécutée sur PostgreSQL embarqué avec les migrations précédentes. Tests des sessions, CSRF, permissions, conflits, brouillons idempotents, envoi incertain, historique et compteur OTP. Après mise à jour de Next.js, sharp, Hono et Nodemailer, `pnpm audit` ne signale plus de vulnérabilité connue.

Les tests d'e-mail utilisent un adaptateur de capture : aucun e-mail réel n'a été envoyé. Les tests PostgreSQL externe conditionnés par `TEST_DATABASE_URL` ne sont pas exécutés dans cette session.

## Ce qui n'est pas certifié

Le navigateur bloque l'aperçu local. Aucun écran nouveau n'est donc déclaré validé visuellement sur mobile ou desktop. Le branchement SMTP, l'IA réelle, Google Places et les canaux téléphonie/SMS/WhatsApp restent à vérifier ou raccorder. Pas d'import automatique d'outils de réservation/caisse et pas d'exécution autonome générale depuis une phrase vocale.

La version n'est pas un produit de production certifié fini. La branche de livraison préserve `main`, `app.tablenow.io` et les bases précédentes. La publication passe par une PR de recette, sans fusion forcée.

Voir [la matrice de recette](../../docs/product/OWNER_DELIVERY.fr.md).

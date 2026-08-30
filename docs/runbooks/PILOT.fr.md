# Lancer une cohorte pilote privée

## Avant la première invitation

1. Remplacer tous les champs juridiques `À COMPLÉTER`.
2. Faire valider les conditions et le DPA par un conseil juridique.
3. Choisir l'hébergement, la région, le SMTP et le registre réel des sous-traitants.
4. Tester sauvegarde, restauration, export, effacement et retrait d'accès.
5. Définir le canal d'incident et les personnes d'astreinte.
6. Vérifier qu'aucun connecteur réel n'est actif sur les espaces de démonstration.

## Inviter

Le compte `platform_admin` ouvre **Pilotes privés**, crée l'organisation et envoie l'invitation. L'adresse invitée reçoit un code à six chiffres, complète l'onboarding, accepte la version des conditions/DPA et entre dans un espace isolé avec données fictives.

## Ce qui est réellement fonctionnel dans la cohorte

- accès privé sans mot de passe ;
- rôles et révocation ;
- données persistantes par organisation ;
- réservations, décisions, communications, tâches et inventaire ;
- propositions du copilote, validation et exécution contrôlée ;
- exports RGPD automatisés et demandes supervisées ;
- audit, rétention, sauvegarde/restauration ;
- MCP en lecture/proposition via l'API ;
- mode local et synchronisation opt-in.

Les appels téléphoniques, SMS, WhatsApp, caisse, stocks fournisseurs ou logiciels de réservation réels nécessitent un adaptateur et une validation spécifiques. L'interface les présente comme données de démonstration tant qu'ils ne sont pas branchés.

## Sortie d'un pilote

Exporter les données à la demande, révoquer les invitations et comptes, conserver la période de réversibilité contractuelle, puis supprimer/anonymiser selon le DPA. Journaliser l'opération et confirmer sa clôture au client.

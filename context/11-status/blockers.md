# Blocages connus — 30 août 2026

## Immédiat

### Vérification PostgreSQL dans Preview

Le fondateur a confirmé Neon. L'API Vercel en lecture seule ne révèle pas les variables injectées : un déploiement Preview protégé doit maintenant prouver la connexion, appliquer les quatre migrations et exposer uniquement des indicateurs de disponibilité booléens.

## Avant partage aux pilotes

### Compte et dépôt source

Le dépôt local n'a pas encore de dépôt GitHub distant connecté ; une sauvegarde et un déploiement continu fiables exigent cette connexion.

### Offre d'hébergement

Le compte d'hébergement doit permettre un usage pilote professionnel et les services nécessaires ; toute évolution d'offre demandera une autorisation séparée.

### E-mail et identité légale

Le domaine d'envoi, l'adresse expéditrice et les informations juridiques réelles doivent être fournis avant les invitations externes.

### Runtime cloud

L'API est intégrée au runtime Vercel. Les tâches durables, le stockage privé et Computer Use doivent encore être raccordés puis testés ensemble.

Aucun de ces points ne sera masqué par une simulation dans la version destinée aux restaurateurs.

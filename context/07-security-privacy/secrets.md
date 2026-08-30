# Secrets

Les secrets comprennent mots de passe de base, clés e-mail, clés IA, cookies de session et identifiants de systèmes externes.

## Règles

- stocker les valeurs dans Vercel ou un coffre compatible ;
- committer uniquement les noms dans `.env.example` ;
- ne jamais utiliser le préfixe `NEXT_PUBLIC_` pour un secret ;
- séparer développement, preview et production ;
- référencer les identifiants externes par `credential_ref` ;
- faire tourner une clé compromise et invalider les sessions concernées ;
- ne jamais afficher les valeurs pendant un diagnostic.

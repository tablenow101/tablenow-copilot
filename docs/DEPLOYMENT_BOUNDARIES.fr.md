# Frontières de déploiement TableNow

Cette décision est un garde-fou permanent. Aucun projet ne partage son dépôt, son projet Vercel, sa base, ses secrets ou son domaine de production avec un autre.

| Surface | État | Dépôt | Hébergement | Domaine | Données |
|---|---|---|---|---|---|
| TableNow V1 | Production protégée | Dépôts historiques | Projet actuel, inchangé | `app.tablenow.io` | Base historique uniquement |
| TableNow V2 Copilot | Produit en développement | `tablenow-platform` | Control plane Vercel unique | `copilot.tablenow.io` | Nouvelle base PostgreSQL V2 |
| Site TableNow | Vitrine actuelle | Webflow pour le moment | Webflow, puis projet Vercel séparé | `tablenow.io` et `www.tablenow.io` | Aucune donnée métier |

## Règles non négociables

1. V1 ne reçoit aucun commit, aucune migration et aucune variable de V2.
2. V2 utilise un nouveau projet Vercel nommé `tablenow-copilot-v2` et une nouvelle base PostgreSQL.
3. Le site utilisera plus tard un dépôt `tablenow-site` et un projet Vercel `tablenow-site` distincts.
4. Chaque environnement possède ses propres secrets : production, prévisualisation et développement.
5. Aucun jeton Supabase, VPS ou Vercel historique n'est copié dans V2.
6. Une prévisualisation testée est promue ; le domaine de production n'est jamais construit directement à l'aveugle.

## Déploiement V2 recommandé

### Control plane Copilot

- Projet Vercel : `tablenow-copilot-v2`.
- Dépôt : `tablenow-platform` uniquement.
- Framework : Next.js avec API métier intégrée au même déploiement logique.
- Domaine production : `copilot.tablenow.io`.
- Domaine staging : `copilot-staging.tablenow.io` ou URL de prévisualisation Vercel.
- Variables minimales :
  - `TABLENOW_STACK_ID=tablenow-v2` ;
  - `NEXT_PUBLIC_API_BASE_URL=/api`.

Les secrets serveur de base, SMTP, stockage et modèles ne sont accessibles qu'aux fonctions serveur ; aucun n'utilise le préfixe `NEXT_PUBLIC_`.

Le build refuse automatiquement les domaines réservés à V1 et au site.

### Cœur V2

L'API métier, les tâches déclenchées et la console forment un seul control plane Vercel. Computer Use s'exécute dans un bac à sable temporaire et n'écrit qu'en passant par l'API.

Les conteneurs restent disponibles pour le développement, les tests de portabilité, la reprise et un futur nœud restaurant. Ils ne constituent pas un deuxième backend cloud actif pendant le pilote.

### Données V2

- PostgreSQL séparé ;
- nom logique `tablenow_v2` ;
- `DATABASE_SCOPE=tablenow-v2` obligatoire ;
- sauvegardes et clés de chiffrement séparées ;
- aucune connexion réseau autorisée vers la base V1 ;
- migrations exécutées avant la promotion de la console.

## Promotion d'une version

1. Une branche crée une prévisualisation Vercel.
2. La CI vérifie typage, tests, PostgreSQL, images Docker et dépendances.
3. Les parcours ordinateur et mobile sont testés sur la prévisualisation.
4. Le même artefact Vercel validé est promu vers `copilot.tablenow.io`.
5. Les erreurs et temps de réponse sont contrôlés après promotion.
6. Un retour instantané vers la version précédente reste disponible.

## Migration future du site Webflow

Le site ne doit pas être migré maintenant. La migration sera un chantier indépendant : inventaire des pages et formulaires, conservation SEO, reconstruction, prévisualisation, comparaison visuelle, redirections, puis changement DNS. `tablenow.io` ne basculera qu'après parité fonctionnelle et validation des formulaires.

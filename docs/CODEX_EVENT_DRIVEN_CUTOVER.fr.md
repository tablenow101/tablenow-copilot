# Mission Codex — cutover événementiel, Preview éphémère et Shadow Mode

## Résultat attendu

Livrer une seule architecture active : état initial canonique puis événements poussés, base Preview isolée et effets externes rendus impossibles en Shadow Mode.

Aucun polling, fallback, ancien chemin ou compatibilité transitoire ne doit rester dans le code fusionné.

## Lot A — inventaire obligatoire avant modification

Rechercher dans tous les workspaces :

- `setInterval`, `setTimeout` récursif, `poll`, `polling` ;
- `refreshInterval`, `refetchInterval`, `revalidate`, rafraîchissements périodiques ;
- appels récurrents à `/app-state` ou aux endpoints métier ;
- EventSource, WebSocket, subscriptions et bus existants ;
- outbox, worker, notifications, hooks et événements DB ;
- Twilio, Resend, Stripe, e-mail, SMS, WhatsApp, webhooks et autres effets ;
- seeds, fixtures, migrations, URLs de base et scripts Preview ;
- tout fallback ou chemin legacy.

Produire un tableau : chemin, comportement actuel, risque, cible, suppression nécessaire.

## Lot B — flux temps réel unique

### Contrat

1. Charger une fois l’état canonique avec son `stream_cursor`.
2. Ouvrir immédiatement l’abonnement authentifié et limité au tenant.
3. Publier les mutations validées depuis l’outbox durable.
4. Pousser les événements aux sessions concernées.
5. Appliquer uniquement les versions attendues.
6. À la reconnexion, reprendre depuis le dernier curseur et rejouer les événements manquants.
7. Si le curseur est trop ancien ou invalide, échouer explicitement et demander un nouveau snapshot canonique ; ne jamais relancer un polling silencieux.

### Exigences

- authentification et autorisation avant abonnement ;
- isolation par organisation/restaurant ;
- ordre explicite par aggregate ;
- idempotence ;
- backpressure et limites de payload ;
- heartbeat transport uniquement, sans lecture métier ;
- observabilité connexion/déconnexion/latence/retard/rejeu ;
- aucun secret au navigateur.

### Suppression

Après certification, supprimer dans la même PR :

- timers de polling ;
- endpoints ou hooks uniquement dédiés à l’ancien rafraîchissement ;
- flags de double fonctionnement ;
- normalisateurs et adaptateurs de payload legacy ;
- tests de compatibilité historique.

## Lot C — base éphémère par Preview

Créer un cycle automatisé :

- provisionnement d’une base/branche PostgreSQL unique par Preview ;
- credentials injectés uniquement dans cette Preview ;
- migrations ;
- seed déterministe ;
- vérification des invariants ;
- tests ;
- destruction à la fermeture de la PR/Preview.

Le script refuse de s’exécuter si :

- l’environnement n’est pas `preview` ou `test` ;
- l’URL correspond à la production ;
- l’identifiant Preview est absent ;
- le schéma cible n’est pas vide ou explicitement recréable.

Prévoir des scénarios nommés, notamment :

- `onboarding-empty` ;
- `restaurant-ready` ;
- `service-full` ;
- `rush-multichannel` ;
- `group-exception` ;
- `stock-risk` ;
- `permissions-conflict` ;
- `network-recovery`.

Chaque seed utilise des identifiants stables et une horloge contrôlée.

## Lot D — Effect Gateway et Shadow Mode

Toutes les sorties passent par une interface unique :

```ts
type ExecutionMode = "live" | "shadow" | "test";

type EffectRequest = {
  effectId: string;
  idempotencyKey: string;
  organizationId: string;
  restaurantId?: string;
  mode: ExecutionMode;
  provider: string;
  operation: string;
  destination?: string;
  payload: unknown;
};
```

Le gateway :

- valide l’autorisation ;
- refuse tout mélange de credentials ;
- bloque les destinations réelles en `shadow/test` ;
- écrit l’intention et le résultat ;
- envoie vers le vrai adaptateur uniquement en `live` ;
- envoie vers un Shadow Sink en `shadow/test` ;
- ne possède aucun fallback de Shadow vers Live ;
- garantit l’idempotence.

Les adaptateurs fournisseurs ne sont jamais appelés directement depuis une route, un agent, un workflow ou un service métier.

## Lot E — preuves grandeur nature

Sur Vercel Preview, avec deux navigateurs simultanés :

1. modifier une réservation dans la session A ;
2. constater l’événement dans la session B sans rechargement ;
3. couper puis rétablir la connexion B ;
4. vérifier le rejeu sans perte ni doublon ;
5. ouvrir deux organisations et prouver l’absence de fuite ;
6. lancer deux Previews avec le même seed et prouver leur indépendance ;
7. simuler e-mail, SMS et paiement en Shadow ;
8. prouver par les journaux et credentials qu’aucun fournisseur live n’a été appelé ;
9. tester desktop et mobile ;
10. joindre captures, traces, latences, événements et verdict produit.

## Definition of Done

- architecture unique active ;
- zéro polling métier ;
- zéro fallback et zéro compatibilité ancienne ;
- tests code verts ;
- tests navigateur réels verts ;
- Previews indépendantes et reproductibles ;
- effets Shadow entièrement captifs ;
- documentation, décision et état mis à jour ;
- aucune promotion Production tant que toutes les preuves ne sont pas jointes.

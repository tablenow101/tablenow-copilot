# D-014 — Temps réel événementiel, données Preview éphémères et Shadow Mode étanche

**Date :** 2026-09-05  
**Statut :** Validé par le fondateur  
**Portée :** architecture runtime, previews, Reality Lab et intégrations externes

## Décision

TableNow fonctionne en architecture événementielle. Le polling applicatif, les doubles chemins, les fallbacks fonctionnels et les couches de rétrocompatibilité sont interdits.

Le contrat runtime est :

1. le client reçoit un état initial canonique, versionné ;
2. il s’abonne immédiatement au flux d’événements ;
3. chaque mutation validée produit un événement durable ;
4. les clients concernés reçoivent cet événement dès sa publication ;
5. après une reconnexion, le client reprend depuis son dernier curseur et rejoue uniquement les événements manquants.

La reprise par curseur fait partie du protocole événementiel. Ce n’est ni du polling, ni un fallback vers une ancienne architecture.

## Interdictions

- `setInterval`, `refreshInterval`, `refetchInterval` ou boucle équivalente pour rafraîchir les données métier ;
- rafraîchissement périodique silencieux comme mécanisme principal de cohérence ;
- double lecture ou double écriture entre ancienne et nouvelle architecture ;
- maintien d’un endpoint historique « au cas où » ;
- bascule automatique vers un fournisseur réel lorsqu’un canal test ou Shadow échoue ;
- utilisation d’une base partagée pour les scénarios Codex ou les Previews Vercel.

Une exception technique ponctuelle ne peut être introduite que par une nouvelle décision explicite du fondateur.

## État initial et flux

L’état initial doit contenir un `stream_cursor` ou une version globale. L’abonnement commence à ce curseur afin qu’aucun événement ne soit perdu entre le chargement initial et l’ouverture du flux.

Chaque événement possède au minimum :

- `event_id` unique ;
- `organization_id` ;
- `restaurant_id` lorsque pertinent ;
- `aggregate_type` et `aggregate_id` ;
- `event_type` ;
- `aggregate_version` ;
- `occurred_at` ;
- `actor` et origine ;
- `correlation_id` et `causation_id` ;
- `payload_version` ;
- `payload` strictement validé.

Les consommateurs sont idempotents. Un événement dupliqué ne produit jamais un second effet métier.

## Base de données éphémère par Preview

Chaque Vercel Preview reçoit sa propre base ou branche PostgreSQL isolée.

Cycle obligatoire :

1. création automatique à partir d’un point de référence approuvé ;
2. application des migrations depuis zéro ou depuis ce point de référence ;
3. seed déterministe associé au scénario ;
4. exécution des tests grandeur nature ;
5. conservation temporaire des preuves nécessaires ;
6. destruction automatique à la fermeture de la Preview ou de la PR.

Le seed :

- est versionné dans le dépôt ;
- n’utilise aucune donnée personnelle réelle ;
- produit les mêmes identifiants fonctionnels et le même état pour une même version ;
- peut générer plusieurs scénarios nommés ;
- vérifie ses invariants après insertion ;
- échoue explicitement si la cible n’est pas une base Preview autorisée.

Aucun scénario Codex ne dépend d’une base de test partagée.

## Shadow Mode étanche

Le moteur métier peut rejouer des événements réels préalablement minimisés et autorisés, mais aucun effet externe réel ne peut sortir du Shadow Mode.

Toute action externe traverse un seul `Effect Gateway`. Avant l’appel fournisseur, il vérifie :

- environnement ;
- mode `live`, `shadow` ou `test` ;
- organisation et scénario ;
- type d’effet ;
- destination ;
- fournisseur ;
- autorisation et budget ;
- clé d’idempotence.

En `shadow` ou `test` :

- Twilio, Resend, Stripe et tout autre fournisseur réel sont bloqués par défaut ;
- les effets sont écrits dans un Shadow Sink auditable ;
- seules des destinations de test explicitement autorisées peuvent recevoir un message ;
- seules des clés sandbox/test séparées peuvent être chargées ;
- aucune erreur du sink ne déclenche une tentative vers la production ;
- aucun secret de production n’est disponible dans l’environnement.

La séparation repose sur plusieurs barrières indépendantes : variables d’environnement distinctes, credentials distincts, allowlist de destinations, contrôle du gateway et journal d’effets.

## Critères de livraison

Un parcours n’est livrable que si :

- aucune source de polling métier n’est présente ;
- la réception temps réel a été observée sur deux sessions simultanées ;
- la reconnexion reprend sans perte ni duplication ;
- la séparation entre deux restaurants est prouvée ;
- deux Previews concurrentes utilisent des données indépendantes ;
- le seed est reproductible ;
- le Shadow Mode démontre qu’aucun effet réel n’est émis ;
- les tests desktop et mobile sont passés sur la Preview ;
- les preuves navigateur, runtime, base et effets sont jointes au compte rendu.

## Conséquence

Cette décision remplace toute logique antérieure de polling, de fallback ou de compatibilité progressive pour les zones concernées. La migration se fait par cutover atomique : nouvelle voie certifiée, puis suppression immédiate de l’ancienne voie avant fusion.

# TableNow OS — architecture de l’onboarding accompagné et de l’Advisor continu

## Références

- Spécification produit : `docs/product/CONTINUOUS_ADVISOR.fr.md`
- Mémoire canonique PostgreSQL : enregistrement 94, version 3, qui complète les versions 93 et 92.
- Branche de livraison : `product/onboarding-owner`.
- Environnement de recette : `https://preview.tablenow.io`.

## Décision d’architecture

Le produit évolue par lots verticaux testables. Les contrats sont enrichis de façon additive, les migrations déjà appliquées ne sont jamais réécrites et chaque lot laisse la Preview dans un état cohérent. `main` reste inchangée jusqu’à la recette complète et à l’autorisation explicite du propriétaire.

Une réécriture globale de l’onboarding est exclue : elle mettrait en danger l’authentification, Google Places, la reprise des brouillons et le cockpit. Une façade seulement visuelle est également exclue : elle contredirait la source de vérité PostgreSQL et pourrait présenter de faux connecteurs ou de faux conseils.

## Frontières fonctionnelles

### Storyboard d’onboarding

Le parcours visible suit cet ordre unique :

1. priorités ;
2. établissement ;
3. systèmes utilisés ;
4. connexions réelles ;
5. compléments ;
6. synthèse ;
7. dashboard.

Chaque transition est validée par le serveur. Les réponses, la section courante, les confirmations et la checklist sont enregistrées par restaurant. Les anciens brouillons sont migrés sans suppression : leurs réponses restent présentes et leur section est ramenée vers la première étape encore incomplète.

### Inventaire et checklist

`SystemInventory` représente ce que le restaurant déclare utiliser : réservation, POS/caisse, calendrier, communications et organisation d’équipe. `deriveConnectionChecklist()` transforme cet inventaire en éléments utiles uniquement. Chaque élément conserve la réponse source qui l’a créé afin qu’une modification d’onboarding mette à jour la checklist de façon déterministe.

### Intégrations

`IntegrationRegistry` décrit les fournisseurs réellement pris en charge et les prochaines actions des fournisseurs indisponibles. `ConnectionVerification` est la seule frontière autorisée à produire l’état `connected`. Une redirection OAuth, un secret présent ou un bouton cliqué ne suffisent pas.

Le cycle persistant est : `to_connect`, `authorization_pending`, `to_test`, `connected`, `reconnect_required`. Chaque test réel enregistre sa date, son résultat, le périmètre vérifié et une référence technique non secrète.

### Advisor continu

`ContinuousAdvisor` assemble les connaissances approuvées, le contexte déclaré et les données propres disponibles. Une recommandation expose toujours : niveau de personnalisation, base, sources, date, confiance, impact attendu, horizon et décision éventuelle.

Les niveaux sont stricts :

- `shared_knowledge` : connaissance restauration et déclarations, aucune conclusion sur des données absentes ;
- `early_restaurant_data` : premières données propres, conseil explicitement préliminaire ;
- `sufficient_history` : historique propre suffisant et critères de suffisance visibles.

### Barre TableNow

Un composant `TableNowComposer` remplace les variantes actuelles. Il contient le bouton document à gauche, la saisie au centre, puis le microphone et l’envoi à droite. Son espace est réservé dans la mise en page ; il est compact et rétractable sans recouvrir le contenu.

### Notifications

Les réussites, échecs et actions requises sont des événements persistants dans PostgreSQL. Une notification lue reste dans l’historique. L’interface ne fabrique plus les notifications à partir d’autres objets du cockpit.

### Profils et photos privées

Les profils sont liés à l’appartenance au restaurant. Les photos passent par une abstraction `PrivateMediaStore`, une clé privée, une autorisation serveur par tenant et des URL temporaires. Le lot peut être développé après les autres, mais bloque la promotion tant qu’un stockage privé réel n’est pas configuré et testé.

## Préservation et compatibilité

- Les brouillons, comptes, facteurs TOTP et identités Google existants sont conservés.
- Les contrats évoluent avec des valeurs par défaut et une normalisation explicite des anciennes réponses.
- Les migrations sont numérotées, transactionnelles et accompagnées d’une stratégie de retour documentée.
- Aucun fournisseur indisponible n’est simulé.
- Le logo officiel est utilisé sans redessin ; les couleurs existantes validées sont conservées.
- L’image `restaurant-stitch.jpg` et les styles de l’ancien écran photographique sont supprimés.

## Validation

Chaque lot suit un cycle test en échec, implémentation minimale, tests verts, diff, contrôle des secrets, vérification responsive et commit dédié. La recette finale rejoue l’authentification Google, e-mail, TOTP, Google Places, la sauvegarde/reprise, l’onboarding, la finalisation, le premier résultat, le dashboard et les pages concernées sur ordinateur et mobile.

Un build réussi ne vaut pas validation produit. Seule une Preview déployée avec preuves et verdict `PASS` sur tous les scénarios autorise la demande de promotion vers `main`.

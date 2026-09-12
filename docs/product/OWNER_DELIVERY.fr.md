# Recette — TableNow propriétaire

## Contrat d'expérience

Le restaurateur parle ou écrit simplement ; TableNow expose une priorité et une suite compréhensible. Le dernier Stitch est la référence visuelle, mais les dernières consignes autorisent à simplifier les écrans pour garder la logique de l'onboarding. Les détails, chiffres secondaires et longues listes ne sont pas ouverts par défaut. Toute action externe reste confirmée et traçable.

Le premier périmètre est le propriétaire. Stock et module métier légal ne sont pas proposés dans cette navigation ; les contrôles d'accès, de confidentialité et les acceptations du pilote préexistants restent en place.

## Code et données

Branche : `product/stitch-functional-owner`, fondée sur `product/onboarding-final-experience` (`d537f103`). PostgreSQL reste l'unique source de vérité. La migration 007 ajoute les états de table, les pauses, l'idempotence des brouillons et l'historique de conversation avec RLS ; elle ne remplace ni ne réécrit une migration passée.

Le build Preview refuse les endpoints Neon de production et des previews précédentes identifiés le 12 septembre. Ce garde-fou est une liste de refus, pas une preuve suffisante que toute nouvelle base est vide : vérifier aussi le projet, la branche et ses données avant une recette qui écrit.

## Matrice de preuves

| Parcours / contrôle | Preuve technique | Verdict produit |
|---|---|---|
| Authentification, compteur OTP, révocation existante | Tests API / session | NOT_RUN dans le navigateur |
| Sauvegarde et finalisation onboarding | Tests domaine et migrations, logique avancée préservée | NOT_RUN dans le navigateur |
| Recherche d'établissement | Adaptateur HTTP officiel, validation des champs et tests de réponses contrôlées | NOT_RUN dans le navigateur |
| Cockpit, navigation, densité mobile | TypeScript et build | BLOCKED par ERR_BLOCKED_BY_CLIENT |
| Tables et conflits de révision | Tests API et PostgreSQL embarqué | NOT_RUN dans le navigateur |
| Rôles et CSRF | Tests de refus 401/403 | PASS technique, pas une recette UI |
| Brouillon et idempotence | Tests API, conflit si contenu différent | PASS technique |
| Confirmation d'envoi et absence de doublon | Adaptateur de capture, aucun réseau SMTP | PASS technique seulement |
| Livraison réelle d'un e-mail | Aucun envoi réel pendant cette session | NOT_RUN |
| Conversation et historique | Deux tours persistants testés, mode synthèse explicite | PASS technique |
| IA réelle, dictée, refus du micro | Fournisseur configurable ; navigateur non accessible | NOT_RUN |
| SMS, WhatsApp, appels, caisse, réservations externes | Aucun raccordement nouveau revendiqué | NON CONFIGURÉ / à vérifier |
| Google Places existant | Aucun adaptateur ni nom de variable trouvé dans ce code/config locale | À RETROUVER, ne pas extraire du legacy |

Le mode `summary` de conversation ne comprend ni n'exécute une demande libre : il expose les données du restaurant. Le mode `ai`, quand le fournisseur existant est configuré, répond sans outils d'exécution. Ne pas présenter ces modes comme l'automatisation vocale 360° définitive.

## Recherche gratuite et enrichissement

Endpoint officiel : `https://recherche-entreprises.api.gouv.fr/search` ; contrat consulté dans `https://recherche-entreprises.api.gouv.fr/openapi.json`. Seuls le nom, l'adresse, la commune et l'identifiant d'établissement sont retenus. Les fiches fermées ou partiellement diffusées sont ignorées. L'enseigne et la dénomination administrative peuvent différer : la confirmation du propriétaire est obligatoire. Aucune donnée sur les dirigeants, les finances ou le légal n'est reprise.

Horaires, téléphone, site web et photos ne sont pas fournis par cet adaptateur. Google Places pourra compléter ces informations après vérification de sa connexion et des champs facturables ; aucun nouveau service payant n'a été activé.

## Rejouer les contrôles

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit
```

Les tests `owner-operations`, `owner-email`, `business-search` et `preview-isolation` sont autonomes. Les tests SQL embarqués utilisent des identités synthétiques et aucun service externe. Le harnais optionnel `services/core-api/src/testing/owner-local.ts` est interdit sur Vercel/production et exclu de la compilation de production. Il ne constitue pas une preuve de connexion e-mail réelle.

## Recette réelle à terminer avant promotion

1. Vérifier l'isolation et l'accès normal de la Preview, sans contourner sa protection.
2. Inviter un propriétaire de test par le flux normal, recevoir réellement son code, se connecter et terminer l'onboarding.
3. Sur ordinateur puis mobile, dicter, corriger, confirmer, reprendre après rechargement et vérifier le premier plan.
4. Créer une réservation, une table, un poste et une tâche ; modifier puis recharger. Tester conflit et perte de connexion.
5. Préparer un message, contrôler le destinataire, confirmer l'envoi autorisé et vérifier la boîte destinataire. Garder l'état incertain si SMTP n'apporte pas de preuve.
6. Tester le micro accepté/refusé/indisponible, le clavier, le focus des dialogues, les longues réponses et l'absence de défilement horizontal.
7. Capturer chaque étape et prononcer PASS, FAIL, WRONG_FLOW ou BLOCKED. Pas de promotion avant résolution des étapes requises et revue de code/migration.

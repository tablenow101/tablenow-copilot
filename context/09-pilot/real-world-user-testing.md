# Tests grandeur nature — protocole restaurateur

## Principe

Une fonctionnalité n'est pas validée parce que le code passe ou que la page s'affiche. Elle est validée quand un utilisateur réaliste peut accomplir son objectif dans une version déployée, sans connaître l'architecture ni recevoir d'aide artificielle.

Un parcours techniquement correct mais incompréhensible, lent, stressant, non naturel ou contraire au fonctionnement réel d'un restaurant est un échec produit.

## Environnement obligatoire

- Tester sur une Preview Vercel ou un environnement équivalent relié aux vrais services de test.
- Utiliser le navigateur comme un humain : cliquer, saisir, naviguer, revenir en arrière, rafraîchir, attendre et changer d'appareil.
- Tester desktop et mobile dès que le parcours peut réellement être utilisé sur les deux.
- Utiliser des comptes et données de test persistants. Les identifiants restent dans les secrets ou états d'authentification prévus ; ils ne sont jamais demandés au propriétaire à chaque session ni commités.
- Les actions externes utilisent des destinations de test ou sandbox lorsque disponibles. Ne jamais toucher à un vrai client ou une vraie réservation sans scénario explicitement autorisé.

## Personas minimum

1. Propriétaire qui découvre TableNow et fait l'onboarding sans assistance.
2. General Manager qui prépare le service et doit comprendre les priorités.
3. Hôte/hôtesse pendant un rush qui traite appels, réservations, changements et exceptions.
4. Chef ou responsable stock qui doit déclencher une action fournisseur sans quitter son travail.
5. Responsable de poste qui reçoit une demande d'aide, décide et dispatche.
6. Employé qui reçoit une mission et doit comprendre immédiatement quoi faire.

## Scénarios de vérité

Chaque grande fonctionnalité doit être testée dans un contexte métier complet, pas comme une page isolée. Exemples :

- onboarding jusqu'à un premier résultat utile ;
- appel entrant → compréhension → réservation ou escalade → confirmation → trace ;
- réservation de groupe ou allergie complexe → bonne autorité → décision → suivi ;
- rush → demande d'aide → dispatch → accusé → exécution ;
- risque de rupture → recommandation → validation → commande fournisseur préparée ou envoyée selon autorisation ;
- message WhatsApp/e-mail → compréhension → action → réponse → mémoire ;
- erreur réseau, information manquante, double clic, retour arrière, téléphone interrompu ;
- reprise du parcours après plusieurs minutes ou depuis un autre appareil.

## Méthode de test

Pour chaque scénario :

1. Définir le personnage, son contexte, sa pression et son objectif réel.
2. Partir de l'écran où cette personne arriverait réellement.
3. Ne pas utiliser de raccourci développeur.
4. Effectuer le parcours avec agent-browser ou navigateur équivalent.
5. Capturer les écrans clés et les erreurs visibles.
6. Mesurer le temps, les clics inutiles, les hésitations et les impasses.
7. Vérifier le résultat final dans l'interface et, si nécessaire, dans le système de référence.
8. Refaire le parcours sur l'appareil secondaire pertinent.

## Questions produit obligatoires

À la fin, répondre explicitement :

- L'utilisateur comprend-il immédiatement où il est et quoi faire ?
- Le chemin correspond-il à la manière dont un restaurant fonctionne réellement ?
- TableNow réduit-il la charge mentale ou en ajoute-t-il ?
- Une information est-elle demandée trop tôt, trop tard ou inutilement ?
- L'utilisateur peut-il faire confiance à ce que TableNow affirme ?
- La bonne personne décide-t-elle au bon moment ?
- Y a-t-il une étape que l'utilisateur contournerait dans la vraie vie ?
- Le parcours doit-il être amélioré, simplifié, déplacé ou supprimé ?

## Verdict

Chaque test reçoit un seul verdict :

- `PASS` — naturel, clair, fiable et utile.
- `FRICTION` — objectif atteint mais expérience insuffisante.
- `WRONG_FLOW` — le modus operandi ne correspond pas au terrain ; revoir le produit, pas seulement le code.
- `BLOCKED` — l'utilisateur ne peut pas terminer.
- `UNSAFE` — résultat ou autonomie non suffisamment fiable.

`FRICTION`, `WRONG_FLOW`, `BLOCKED` et `UNSAFE` bloquent la livraison du parcours concerné.

## Preuves attendues

Le compte rendu doit contenir : scénario, persona, environnement, appareil, étapes réellement effectuées, résultat, captures utiles, erreurs console/runtime pertinentes, friction observée, verdict et recommandation produit.

Le but n'est pas de prouver que nous avons raison. Le but est de découvrir où TableNow ne fonctionne pas encore comme le meilleur partenaire opérationnel du restaurant.

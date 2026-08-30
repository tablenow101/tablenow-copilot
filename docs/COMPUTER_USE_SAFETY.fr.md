# Computer Use dans TableNow

Computer Use est un adaptateur d'exécution, pas le cerveau ni la base de vérité de TableNow. Il sert uniquement lorsqu'une action utile n'a pas de voie structurée plus fiable.

## Répartition des rôles

- La console ordinateur et mobile demande, explique, valide et suit.
- L'API TableNow vérifie l'identité, le rôle, le risque et le budget.
- Le nœud local ou cloud exécute dans un navigateur Chromium isolé.
- Le logiciel du restaurant reste limité aux domaines explicitement autorisés.
- Chaque étape produit un événement et, si utile, une preuve visuelle chiffrée.

Le téléphone ne réalise pas l'action : il la pilote. Une exécution continue sur le nœud même si l'écran mobile est fermé.

## Modes

| Mode | Lecture | Écriture faible risque | Action sensible |
|---|---:|---:|---:|
| Observer | Oui | Non | Non |
| Assister | Oui | Après validation | Après validation autorisée |
| Autonome | Oui | Oui si protocole certifié | Toujours validation humaine |
| Pause | Non | Non | Non |

Une action critique reste interdite. Une annulation, un paiement, un envoi ou une publication déclenche un point de contrôle explicite.

## Limite d'exactitude

Aucun pilotage visuel tiers ne peut être annoncé fiable à 100 % avant des tests sur la version réelle de l'interface et un compte autorisé. Les changements de page, fenêtres imprévues, protections anti-bot et contenus malveillants peuvent bloquer l'exécution. TableNow échoue alors fermé, conserve la preuve et propose la procédure humaine.

Le runner applique les mesures recommandées par la documentation Computer Use d'OpenAI : environnement isolé, liste blanche de domaines, contenu de page considéré comme non fiable et validation humaine aux actions à fort impact.

## Données et secrets

- Les identifiants restent sur le nœud et ne sont pas envoyés au modèle.
- L'objectif transmis au modèle est réduit à l'action autorisée.
- Les captures sont chiffrées en AES-256-GCM et soumises à rétention.
- Les téléchargements, extensions, accès au système de fichiers et service workers sont bloqués.
- Une demande d'arrêt reste effective même après une perte temporaire du nœud.


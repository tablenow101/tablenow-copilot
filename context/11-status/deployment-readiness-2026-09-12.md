# Vérification des raccordements — 12 septembre 2026

État relevé en lecture seule pendant la reprise de livraison. Aucun secret, configuration cloud ou compte utilisateur modifié par cette vérification.

## Déploiement et accès

- Projet Vercel confirmé : `tablenow-copilot-v2`, `prj_7FV38t7g0NtMZtsPYDyIGIezNbUa`, équipe `team_f2XMhpHzfzsNJxXDlqEAlSJZ`.
- Dernière Preview observée READY : `dpl_YRei5qPb6T8g61nacTMGSHHrZ4qb`, commit `de552a10a7a16ae452b591d4fe237fb72dbc6a9c`, branche `product/stitch-functional-owner`.
- Cette Preview contient le dernier registre de mémoire publié, pas encore les nouveaux changements locaux d'authentification et de composants.
- L'outil officiel `get_access_to_vercel_url` retourne un lien temporaire avec succès. Cependant, sa navigation réelle dans un onglet dédié aboutit encore à la page de connexion Vercel. L'accès effectif n'est donc pas établi. Les réponses de `web_fetch_vercel_url` restent en redirection SSO.
- Aucun jeton Vercel CLI/OIDC n'est présent dans l'environnement local ni aux emplacements habituels de configuration CLI. Le connecteur actuel donne accès aux métadonnées de déploiement mais n'expose pas une méthode de lecture des variables d'environnement.
- `copilot.tablenow.io` n'apparaît pas dans les domaines retournés par `get_project`. Le fetch Vercel ne crée pas de lien pour ce domaine. Cela demande une vérification d'affectation ; cela ne prouve pas que le domaine n'existe pas ailleurs.

## Base et identité

- Neon Copilot : projet `aged-haze-01205441`, Preview `br-ancient-sun-za1ku4d2`, base `neondb`.
- Lecture directe de `schema_migrations` : migrations `001` à `007` appliquées. Les tables `account_credentials` et `account_challenges` sont encore absentes. Les migrations des nouveaux comptes et documents doivent passer par la prochaine livraison isolée.
- Neon Auth existe sur la branche stable et la Preview : fournisseur Better Auth géré par Neon, inscription et e-mail/mot de passe activés, Google partagé disponible.
- L'envoi d'identité Neon utilise le fournisseur partagé `auth@mail.myneon.app`, nom `Neon Auth`. Il ne fournit pas de secret SMTP réutilisable par le service d'e-mail personnalisé de Copilot.
- La configuration observée n'exige pas de vérification d'e-mail à l'inscription ou à la connexion. Elle ne satisfait donc pas, seule, le parcours e-mail vérifié et second facteur approuvé pour TableNow.
- Les origines de Preview sont inscrites dans Neon Auth ; la liste des origines de la branche stable est vide. Ne pas confondre cette configuration distincte avec l'authentification personnalisée utilisée par le code.

## Preuves encore nécessaires

1. Publier les changements revus puis vérifier le nouveau commit réellement déployé et les migrations correspondantes.
2. Établir l'accès normal à la Preview protégée pour la recette navigateur. Un lien de partage généré n'est pas une preuve de réussite.
3. Lire les prérequis via `/api/system/readiness` une fois accessible. Cet endpoint ne certifie ni connexion vivante ni remise d'e-mail.
4. Vérifier le fournisseur réellement utilisé par Copilot : SMTP, expéditeur, origine et secrets serveur. Les valeurs restent privées ; seuls présence et résultat de vérification sont rapportés.
5. Exécuter un envoi autorisé et vérifier son résultat fournisseur, puis la réception dans la boîte concernée si le connecteur de messagerie y a accès. L'e-mail partagé Neon n'est pas la preuve d'un envoi de notre code.
6. Terminer le parcours propriétaire réel : inscription, vérification, second facteur, reconnexion, récupération et onboarding. Les secrets personnels restent saisis par leur titulaire via le mécanisme sécurisé.

La disponibilité technique READY et les tests locaux ne constituent pas une certification fonctionnelle de cette livraison.

## Analyse de la réutilisation de Neon Auth

La revue des sources officielles confirme que la migration vers Neon Auth géré ne résout pas les deux exigences simultanément : SMTP de production dédié et second facteur TOTP. La [checklist de production](https://neon.com/docs/auth/production-checklist) exige un fournisseur d'e-mail propre ; le [MFA figure encore dans la feuille de route](https://neon.com/docs/auth/roadmap), et les [plugins managés](https://neon.com/docs/auth/guides/plugins) ne permettent pas d'ajouter librement le plugin TOTP Better Auth. Le service e-mail partagé n'est pas utilisé comme relais détourné des codes de notre authentification.

Décision d'implémentation : conserver un seul responsable de la vérification de chaque preuve, et raccorder le transport transactionnel dédié. Aucun changement Neon Auth n'a été effectué par cette analyse.

## Revue finale locale après corrections

- Typage monorepo : 16 tâches réussies.
- Tests monorepo : 16 tâches réussies ; API 65 tests réussis, 4 tests d'isolation PostgreSQL réservés à CI ; console 37 tests réussis.
- Build Next.js réussi, avec inscription, connexion, récupération et onboarding.
- Resend est connecté au compte ChatGPT. À cette étape, aucune méthode Resend n'est toutefois exposée dans le registre d'outils de la session : aucun domaine, secret SMTP ou résultat d'envoi Resend n'a pu être vérifié. Ne pas confondre connexion du plugin et configuration serveur.
- Les secrets de Preview sont désormais explicitement requis. Les codes OTP fixes sont interdits sur tout déploiement. Le smoke test capture un code aléatoire dans un expéditeur de test et ne prouve pas la réception d'un e-mail.
- Conserver SESSION_SECRET stable : il chiffre aussi les secrets TOTP et pièces jointes ; toute rotation nécessite une migration de chiffrement.
- Limites produit vérifiées : conversation de conseil sans exécution d'outils, documents persistés sans analyse automatique, service du jour sans calendrier futur, canaux externes de la prochaine phase non raccordés.

## Résultat de publication

Commit `38f73117ec94e76d865f0821688a0987f4b0e66b` publié et relu via Git dans PR 17. Déploiement `dpl_BNFrayzdJHDtMGedBmJsWMFjC4re` : échec au seed après migration. Journaux Vercel : `SESSION_SECRET`, `OTP_PEPPER`, `PLATFORM_ADMIN_EMAIL` absents. Les migrations 008 et 009 sont appliquées, lecture SQL de la Preview confirmée. Aucun secret de remplacement public ou dérivé n'a été ajouté.

Le contrôle automatique a rejeté un appel générique de déploiement sans cible car il pouvait toucher une autre ressource ou la production. L'appel suivant a été limité explicitement au projet Copilot, équipe connue, environnement Preview et commit publié ; le fournisseur l'a rejeté pour schéma incomplet (`name`, `files`). Aucun déploiement supplémentaire n'a été créé par ces appels. Le déploiement observé provient uniquement de GitHub.

Le job GitHub « Qualité · TypeScript, tests et build » est réussi, audit des dépendances inclus. Les jobs PostgreSQL et Docker doivent être consultés dans le run 34689657887 avant de les annoncer réussis. L'accès aux paramètres Vercel et aux méthodes Resend est nécessaire pour poursuivre les vérifications réelles ; aucun code utilisateur ou OTP n'a été contourné.

Le job « Données · Isolation PostgreSQL » est maintenant réussi : migrations et tests d'isolation exécutés sur PostgreSQL par GitHub Actions. Le registre canonique contient le résultat de livraison (enregistrement 69), relu après écriture.

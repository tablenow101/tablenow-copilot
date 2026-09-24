# Remplacement ciblé du TOTP par un code e-mail — revue locale

**Statut : correctif et recette technique locale vérifiés ; publication non autorisée.**

Base : `a11834385e3e835e3842f1a24eccb32d3b43d764`, branche `product/onboarding-owner`. Cette base était celle du déploiement Preview `dpl_2xhq5tzDzRZ4BMAVRPNPJP2qCMWj`, READY, lors du contrôle en lecture seule précédant la recette. Aucun commit, push, déploiement ni changement de `main` ou de ressource distante effectué.

## Décision appliquée

Le propriétaire valide la Preview actuelle et demande de remplacer uniquement Authenticator par un code reçu par e-mail. Aucun nouveau déclenchement automatique, demande de nom, écran d’activation ou changement graphique. L’autorisation de recette couvre seulement Chrome local, des comptes fictifs et une boîte de test simulée.

| Situation | Résultat du correctif |
|---|---|
| Inscription e-mail et mot de passe | Confirmation par lien à usage unique → session → onboarding, sans nom personnel ni activation. |
| Connexion sans vérification supplémentaire configurée | Comportement existant conservé ; aucun code supplémentaire imposé. |
| Connexion qui exigeait Authenticator | Après le premier contrôle existant, envoi d’un code e-mail à six chiffres → vérification → session. |
| Google Connect | Bouton, configuration, échange OAuth, distinction connexion/inscription et routage conservés. Seule une demande TOTP déjà prévue devient une demande de code e-mail. |
| Google avec adresse tierce non garantie par Google | Vérification de la boîte conservée. Aucun assouplissement de l’association des comptes. |
| Session encore valide | Aucun nouvel OTP ajouté au rechargement ou à la visite suivante. |
| Code e-mail ou lien déjà validé | Pas de second code redondant ; ouverture de session selon l’opération existante. |
| Mot de passe oublié | Parcours séparé conservé ; lien e-mail, changement confirmé, anciennes sessions révoquées. |
| Ancienne vérification TOTP déjà en cours | Réponse explicite de transition ; recommencer la connexion pour obtenir un nouveau code e-mail. |

Un code e-mail n’est pas présenté comme un second facteur indépendant. Ce lot n’implémente ni détection de nouvel appareil, ni géolocalisation, ni nouvelle règle d’action sensible. Un compte sans ancien facteur activé n’en acquiert pas un automatiquement.

## Diff exact

[Diff applicatif et tests par rapport à la base](otp-replacement-2026-09-25/auth-changes.diff) · [Empreinte et inventaire](otp-replacement-2026-09-25/manifest.json)

Cinq fichiers applicatifs sont concernés :

- `AccountFlow.tsx` : conserve les écrans et remplace les états Authenticator par l’écran e-mail existant ; supprime la présentation des clés et codes de secours ; conserve le collage, le thème, la reprise et ajoute une garde contre deux soumissions simultanées.
- `account-continuation.ts` : reprise e-mail et compatibilité avec un ancien profil déjà vérifié ; aucun nouvel écran de nom.
- `account-feedback.ts` : message explicite pour les anciennes vérifications Authenticator.
- `account-routes.ts` : réutilise le transport e-mail existant aux points où un TOTP était exigé ; conserve les liens d’inscription, les sessions, les budgets d’envoi et l’identité Google ; sérialise les vérifications concurrentes avant de verrouiller leur ligne.
- `account-recovery-routes.ts` : retire les anciennes opérations de codes de secours TOTP avec une réponse 410 guidant vers la connexion e-mail ; ne supprime aucune donnée historique.

Les huit autres fichiers applicatifs du diff sont des tests d’authentification. Aucune migration, dépendance, feuille de style, route de page, invitation de cockpit, page Sécurité, modification d’onboarding ou de contenu légal n’est incluse. Les documents de statut et ce dossier de preuves accompagnent le correctif ; ils ne modifient pas le produit.

Les secrets historiques chiffrés et les empreintes des codes de secours sont conservés. Le champ historique `totp_secret` sert encore à identifier les comptes pour lesquels la vérification était déjà exigée ; il n’est plus utilisé pour valider un code Authenticator. Aucun drapeau `email_otp_enabled` ajouté.

## Résultats exécutés

| Vérification | Résultat | Portée |
|---|---|---|
| API : six suites | **PASS — 43 tests** | PGlite isolé, transport e-mail simulé, échange Google simulé à la frontière externe. |
| Console : trois suites | **PASS — 14 tests** | Reprise, erreurs, attente bornée, frontières des écrans. |
| Compilation API | **PASS** | `tsc -p tsconfig.build.json`. |
| TypeScript Console | **PASS** | `tsc --noEmit`. |
| Build Console | **PASS** | `next build`, Next.js 16.3.5 ; génération et vérification TypeScript réussies. |
| Chrome, 390 × 844 | **PASS technique local** | Parcours ci-dessous ; format mobile simulé. |
| Chrome, 1440 × 900 | **PASS technique local** | Parcours ci-dessous ; navigateur ordinateur. |
| Preview avec ce correctif, réception réelle, Google réel, téléphone physique | **NOT_RUN** | Hors autorisation de cette recette. |

[Résultats détaillés des tests](otp-replacement-2026-09-25/test-results.json) · [Résultats navigateur](otp-replacement-2026-09-25/browser-results.json)

Protections vérifiées : code à usage unique, expiration, cinq essais par challenge, budget destinataire persistant malgré des IP différentes, délai de renvoi, invalidation des anciens codes, refus d’origine étrangère, erreur d’envoi explicite et conservation des données historiques. Les échecs de preuve publics d’inscription, de récupération ou de connexion e-mail n’augmentent pas le compteur global du compte victime. La connexion légitime reste possible après ces échecs.

## Recette navigateur

Persona : propriétaire qui crée un compte, revient se connecter, puis propriétaire d’un compte précédemment protégé par Authenticator. Uniquement des adresses `@tablenow.test` ; aucune utilisation des comptes du propriétaire. Les comptes protégés représentent des données historiques préparées dans la base de recette.

Sur les deux dimensions :

1. Connexion existante affichée avec mot de passe et Google ; aucun champ de nom.
2. Inscription → écran de confirmation → ouverture du lien obtenu dans la boîte locale → onboarding.
3. Déconnexion via l’API authentifiée et protégée par CSRF ; nouvelle connexion du compte sans ancien facteur, comportement conservé.
4. Connexion du compte historiquement protégé → écran « Code reçu par e-mail ».
5. Rechargement → même étape ; affichage clair et sombre, six cases visuelles, champ unique avec clavier numérique et autocomplétion.
6. Code incorrect → erreur explicite et saisie conservée ; collage du code complet → session → onboarding.
7. Sur le format mobile uniquement, réponse JSON interrompue après réception des cookies → reprise par lectures, sans rejouer le code.

Aucun appel vers une route TOTP, d’activation ou de création de profil supplémentaire pendant ce parcours. La déconnexion via API vérifie la session/CSRF ; elle ne certifie pas l’ergonomie d’un bouton de déconnexion. Le test mobile ne certifie pas un clavier ou un changement d’application sur un téléphone physique. Le bouton Google est présent ; sa connexion réelle n’a pas été effectuée.

Le code est identifié clairement comme provenant de l’e-mail et aucune information supplémentaire n’est demandée. Verdict fonctionnel local : **PASS**. Validation produit avec services réels : **NOT_RUN**.

## Captures

| Étape | Téléphone simulé | Ordinateur |
|---|---|---|
| Connexion conservée | [390 × 844](otp-replacement-2026-09-25/mobile-01-login.png) | [1440 × 900](otp-replacement-2026-09-25/desktop-01-login.png) |
| Arrivée sur l’onboarding existant | [Mobile](otp-replacement-2026-09-25/mobile-02-onboarding.png) | [Ordinateur](otp-replacement-2026-09-25/desktop-02-onboarding.png) |
| Code e-mail sombre | [Mobile](otp-replacement-2026-09-25/mobile-03-otp-dark.png) | [Ordinateur](otp-replacement-2026-09-25/desktop-03-otp-dark.png) |
| Code e-mail clair | [Mobile](otp-replacement-2026-09-25/mobile-04-otp-clear.png) | [Ordinateur](otp-replacement-2026-09-25/desktop-04-otp-clear.png) |

Les captures ne contiennent aucun code de vérification ni secret. Le petit indicateur Next.js appartient au serveur de développement local.

## Porte de publication

Présenter ce diff et attendre l’autorisation explicite avant tout commit, push ou déploiement. La Preview n’a pas reçu ce correctif. La validation réelle de l’e-mail, de Google et du téléphone reste à réaliser ensuite dans un périmètre autorisé.

La mise à jour de la mémoire PostgreSQL reste en attente : le connecteur n’a pas fourni de lecture exploitable pendant la préparation et cette livraison est strictement locale. La décision est tracée dans le journal local sans prétendre à un enregistrement canonique distant.

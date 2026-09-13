# Recette de la Preview TableNow Copilot — 13 septembre 2026

## Résultat et périmètre

**Déploiement technique VERIFIED ; parcours complet nouveau propriétaire BLOCKED par la configuration d'e-mail.** L'accès normal à la Preview protégée est établi après authentification Vercel par le propriétaire. Les écrans d'authentification et deux refus de connexion ont été parcourus réellement dans le navigateur. Aucun parcours complet n'est déclaré `PASS`.

La reprise est limitée à la branche `product/stitch-functional-owner`, à son secret `OTP_PEPPER` Preview et à son redéploiement. Aucun code applicatif, SMTP, production ou application historique n'a été modifié. Aucun commit ni push n'a été effectué. Voir [le contexte de reprise](../../../context/11-status/deployment-resume-2026-09-12.md).

## Artefact et preuves techniques

| Élément | Preuve observée |
|---|---|
| Déploiement | `dpl_3bkD3gAw5LZH9MaLxpn9YvvPQA2M`, état final `READY` relu |
| URL | [Preview protégée](https://tablenow-copilot-v2-96v84r74c-tablenow101.vercel.app) |
| Projet / équipe | `tablenow-copilot-v2`, `prj_7FV38t7g0NtMZtsPYDyIGIezNbUa` / `tablenow101`, `team_f2XMhpHzfzsNJxXDlqEAlSJZ` |
| Branche / commit | `product/stitch-functional-owner` / `0d191dd34d4db2ef5078b414b7bacf408859d35d`, relus dans les métadonnées Vercel |
| Environnement | Preview ; aucune promotion |
| Fin technique | 12 septembre 2026 à 22:57:43 UTC, soit 23:57:43 à Alger |
| Durées | Build annoncé : 53 s ; phase build jusqu'à `READY` : environ 60 s |
| Base dédiée | Neon `br-ancient-sun-za1ku4d2`, `preview/product/stitch-functional-owner`, distincte de la branche stable ; migrations 001 à 009 confirmées en lecture seule |

Les logs du nouveau build indiquent migrations à jour, seed à jour, puis réussite du smoke database/login/session/workspace/CSRF/logout. Next.js termine compilation, TypeScript, pages et déploiement. Le smoke utilise un expéditeur injecté qui capture son code aléatoire : il prouve les opérations API couvertes, sans envoi ni réception réelle d'e-mail.

L'échec précédent `dpl_73qy4Vo8kNWjWpetxnucmYRgV8cA` concernait `OTP_PEPPER` trop court : `db:seed:preview`, sortie 1, minimum 32 caractères, après migrations à jour. Sa rotation cryptographique a réussi uniquement pour la Preview de cette branche. `SESSION_SECRET` et `PLATFORM_ADMIN_EMAIL` sont inchangés ; aucune valeur secrète n'est reproduite dans ce rapport.

## Scénario, persona et appareils

Persona : propriétaire de restaurant découvrant TableNow, qui veut créer son compte puis préparer son établissement sans connaissance de l'architecture. L'objectif métier complet est l'inscription avec adresse vérifiée et second facteur, puis l'onboarding jusqu'au premier résultat utile et au cockpit. La recette part de l'accueil réellement accessible.

La navigation a été effectuée le 13 septembre, heure locale d'Alger, dans un navigateur après l'authentification Vercel normale réalisée par le propriétaire. Aucune protection n'a été supprimée et aucune session TableNow synthétique n'a été injectée.

- Écrans connexion et inscription parcourus à 1440 × 1000, puis à 390 × 844 et au viewport par défaut 768 × 894.
- Captures desktop fiables conservées : 768 × 894. Elles ne sont pas des captures 1440 × 1000.
- Captures mobile : viewport 390 × 844 ; cette émulation ne certifie pas un iPhone ou Android physique.
- Sur mobile, `scrollWidth` mesuré à 390 px et formulaire à 314 px : aucun débordement horizontal observé sur les écrans contrôlés.
- Durée du parcours et nombre de clics inutiles non mesurés ; aucune estimation rétrospective n'est fournie.

## Étapes réellement effectuées

| Étape | Action et résultat | État de preuve |
|---|---|---|
| Accès | Authentification Vercel par le propriétaire, puis ouverture normale de la Preview | VERIFIED |
| Entrée | Accueil → « Commencer » → connexion | VERIFIED |
| Inscription | « Créer votre compte » ; affichage du nom, e-mail, mot de passe et règle de 15 caractères ; retour à la connexion | VERIFIED pour navigation et affichage ; création de compte NOT_RUN par cette recette |
| Récupération | Ouverture de « Mot de passe oublié » depuis la connexion | VERIFIED pour navigation ; récupération complète NOT_RUN |
| Refus desktop | Soumission d'une connexion avec le compte fictif `recette-deploiement-20260913@example.invalid` | VERIFIED : message générique « Vérifiez vos informations ou recommencez la connexion. » |
| Refus mobile | Même test négatif réellement soumis au viewport mobile | VERIFIED : même message générique visible |
| E-mail, TOTP, onboarding | Aucune réception ni saisie d'OTP/TOTP, aucune session ou création de compte par ces tests | NOT_RUN ; parcours nouveau propriétaire BLOCKED par le prérequis SMTP absent |

Les logs confirment les deux refus attendus sur `POST /api/v1/account/login` : statut 400 à 23:08:39 UTC le 12 septembre pour desktop (00:08:39 à Alger le 13), puis 23:10:23 UTC pour mobile (00:10:23 à Alger le 13). Il s'agit de refus d'authentification, pas de crash. Ces deux essais négatifs ne prouvent ni une connexion positive ni le fonctionnement d'un compte existant. Aucun mot de passe saisi n'est conservé dans la documentation.

## Captures conservées

| Écran | Capture |
|---|---|
| Connexion desktop, 768 × 894 | [desktop-login.png](desktop-login.png) |
| Inscription desktop, 768 × 894 | [desktop-register.png](desktop-register.png) |
| Connexion mobile, 390 × 844 | [mobile-login.png](mobile-login.png) |
| Inscription mobile, 390 × 844 | [mobile-register.png](mobile-register.png) |
| Refus de connexion mobile, 390 × 844 | [mobile-login-refusal.png](mobile-login-refusal.png) |

Le refus desktop est attesté par l'interaction navigateur ; aucune capture desktop de ce refus n'est retenue, sa capture initiale étant mal dimensionnée.

## Blocage d'e-mail et provenance des erreurs

La liste officielle `vercel env ls preview` ne contient pas `EMAIL_TRANSPORT`, `SMTP_HOST`, `EMAIL_FROM`, `SMTP_USER` ou `SMTP_PASSWORD`. Le code utilise par défaut le transport `log` et [la route compte](../../../services/core-api/src/account-routes.ts) refuse l'envoi d'inscription/récupération si le transport n'est pas `smtp`, avec une réponse 503. Cette concordance établit le blocage de configuration d'e-mail. Aucun raccordement ou secret SMTP n'a été ajouté pendant cette passe.

Les logs runtime montrent séparément les requêtes suivantes :

| Horodatage UTC le 12 septembre | Heure d'Alger le 13 septembre | Requête | Statut |
|---|---|---|---|
| 23:06:54 | 00:06:54 | `POST /api/v1/account/signup` | 503 |
| 23:07:00 | 00:07:00 | `POST /api/v1/account/signup` | 503 |
| 23:07:48 | 00:07:48 | `POST /api/v1/account/reset` | 503 |

**Ces trois requêtes sont des observations de logs distinctes ; elles ne sont pas attribuées aux actions navigateur décrites ci-dessus.** Aucun résultat d'envoi ou de réception d'e-mail n'est déduit de ces logs. Les réponses 503 apparaissent au niveau `info` ; aucune entrée `error` ou `fatal` n'a été observée dans les logs consultés. L'absence de ces niveaux ne signifie donc pas absence d'erreur fonctionnelle. Aucun bilan exhaustif de console navigateur n'est revendiqué.

La lecture de `/api/system/readiness` n'a pas fourni de preuve HTTP exploitable : `vercel curl` officiel a terminé avec un code de sortie 0 mais uniquement le texte `Redirecting`, puis la navigation navigateur vers cette route a été refusée avec `ERR_BLOCKED_BY_CLIENT`. Aucun contournement n'a été effectué. L'endpoint décrit de toute façon des prérequis de configuration, pas des connexions vivantes ou une remise d'e-mail.

## Questions produit obligatoires

| Question du protocole | Conclusion limitée aux observations |
|---|---|
| L'utilisateur comprend-il où il est et quoi faire ? | Les titres Connexion / Créer votre compte, libellés et liens de retour sont visibles et utilisables sur les écrans parcourus. La compréhension de la suite reste non testée. |
| Le chemin correspond-il au fonctionnement d'un restaurant ? | L'entrée et la navigation de compte sont cohérentes avec l'objectif observé ; le parcours métier n'a pas pu être évalué après l'inscription. |
| TableNow réduit-il la charge mentale ? | Non établi pour le travail du restaurateur : aucun onboarding ou résultat métier n'a été atteint. Le prérequis d'e-mail manquant bloque l'accès à cette valeur. |
| Une information est-elle demandée trop tôt, trop tard ou inutilement ? | Nom, e-mail et mot de passe sont présents à l'inscription, avec règle de longueur explicite. Aucune conclusion sur les questions d'onboarding, non parcourues. |
| L'utilisateur peut-il faire confiance aux affirmations ? | Les connexions invalides sont refusées avec un message générique, sans faux succès. La réussite d'inscription, la remise d'e-mail et la valeur métier ne sont pas attestées. |
| La bonne personne décide-t-elle au bon moment ? | Aucune action métier ni validation sensible n'a été atteinte ; non évalué. L'autorisation Vercel a été réalisée par le propriétaire. |
| Y a-t-il une étape qu'il contournerait dans la vraie vie ? | Aucun contournement utilisateur observé. La configuration d'e-mail absente empêche de terminer ; supprimer la vérification ou le second facteur ne serait pas une résolution acceptable. |
| Faut-il améliorer, simplifier, déplacer ou supprimer le parcours ? | Aucun changement de parcours conclu sur ces seuls écrans. Rendre le transport d'e-mail de test opérationnel dans un périmètre explicitement autorisé, puis rejouer le scénario complet avant de conclure sur le produit. |

## Verdict et suite autorisée

**Verdict produit du scénario nouveau propriétaire : `BLOCKED`.** Le déploiement et la navigation partielle sont vérifiés ; le parcours complet n'est pas livré.

| Capacité | Statut |
|---|---|
| Déploiement Preview et compilation | VERIFIED |
| Navigation compte desktop/mobile et refus de connexion | VERIFIED, périmètre partiel |
| Nouveau propriétaire jusqu'au cockpit | BLOCKED, transport d'e-mail absent |
| Remise réelle d'e-mail et vérification d'adresse | NOT_RUN |
| TOTP, codes de secours, reconnexion positive et récupération complète | NOT_RUN |
| Onboarding, persistance du premier résultat et cockpit | NOT_RUN |
| Appareils physiques, dictée, accessibilité complète et reprise réseau | NOT_RUN |
| Production et legacy | Non modifiés ; aucune promotion |

La prochaine opération de transport SMTP n'est pas incluse dans cette passe. Une fois son fournisseur, son expéditeur, ses secrets Preview et son destinataire de test autorisés et configurés, reprendre le parcours complet avec réception réelle, second facteur et onboarding, puis documenter les preuves desktop/mobile selon [le protocole restaurateur](../../../context/09-pilot/real-world-user-testing.md).

Dernier contrôle du SHA distant : toujours `0d191dd34d4db2ef5078b414b7bacf408859d35d`. Les cinq captures répertoriées sont conservées ; la capture desktop mal dimensionnée a été supprimée.

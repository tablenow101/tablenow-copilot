# Reprise du déploiement Preview — 12 et 13 septembre 2026

**Déploiement READY ; parcours complet nouveau propriétaire BLOCKED par l'e-mail non configuré.** L'accès normal à la Preview est établi et les écrans de compte ont été parcourus sur ordinateur et mobile. Voir [le rapport de recette et ses cinq captures](../../docs/qa/deployment-2026-09-13/report.md).

## Périmètre autorisé

Le propriétaire autorise la reprise de `product/stitch-functional-owner` sur le projet Vercel `tablenow-copilot-v2`, équipe `tablenow101` : authentification officielle, diagnostic, remplacement cryptographique de `OTP_PEPPER` si nécessaire uniquement pour la Preview de cette branche, redéploiement et recette en ligne. La production, l'application historique et les contrôles de sécurité restent préservés. Voir D-026 dans [le journal des décisions](../10-decisions/decision-log.md).

## Code sélectionné sans perte de travail

- État initial vérifié : `main` au commit `665ca205111c7937b1e7507137e0af2b3c161c54`, sans changement local.
- Récupération distante puis sélection de la branche cible sans écrasement.
- Commit local et distant concordants : `0d191dd34d4db2ef5078b414b7bacf408859d35d` dans `tablenow101/tablenow-copilot`.
- Aucun changement du code applicatif, commit ou push effectué pendant cette reprise ; seuls le contexte et les preuves de recette sont ajoutés localement.

## Blocage confirmé et correction effectuée

Le déploiement cible précédent, `dpl_73qy4Vo8kNWjWpetxnucmYRgV8cA`, échoue pendant `db:seed:preview`, code de sortie 1 : validation Zod de `OTP_PEPPER`, minimum 32 caractères. Les migrations sont déjà indiquées à jour. `SESSION_SECRET` et `PLATFORM_ADMIN_EMAIL` ne produisent plus d'erreur de validation dans ce journal.

La CLI Vercel officielle 59.16.0 est installée temporairement dans `/private/tmp/tablenow-vercel-cli`. L'authentification officielle a réussi pour le compte `tablenow101-42`.

Un nouveau `OTP_PEPPER` a été généré avec `crypto.randomBytes(48)`, encodé en base64url, puis transmis directement par l'entrée standard à la CLI. L'enregistrement sensible a réussi et sa portée a été relue : **Preview, uniquement `product/stitch-functional-owner`**, projet `prj_7FV38t7g0NtMZtsPYDyIGIezNbUa`, équipe `tablenow101`. Aucune valeur secrète n'a été affichée, enregistrée dans un fichier local ou commitée.

`SESSION_SECRET` et `PLATFORM_ADMIN_EMAIL` n'ont pas été modifiés. La stabilité de `SESSION_SECRET` protège notamment le chiffrement existant des secrets TOTP et des pièces jointes. Aucun OTP fixe, secret dérivé ou contrôle de sécurité désactivé n'a été introduit.

## Nouveau déploiement

Le redéploiement de l'artefact précédent a été demandé explicitement avec la cible `preview`, sans attente bloquante ni promotion.

| Élément | Résultat observé |
|---|---|
| Déploiement | `dpl_3bkD3gAw5LZH9MaLxpn9YvvPQA2M` |
| URL | [Preview de recette](https://tablenow-copilot-v2-96v84r74c-tablenow101.vercel.app) |
| Projet | `tablenow-copilot-v2`, `prj_7FV38t7g0NtMZtsPYDyIGIezNbUa` |
| Équipe | `tablenow101`, `team_f2XMhpHzfzsNJxXDlqEAlSJZ` |
| Branche et commit | `product/stitch-functional-owner`, `0d191dd34d4db2ef5078b414b7bacf408859d35d` |
| Environnement | Preview, relu dans les métadonnées Vercel |
| État final | `READY`, relu avec le projet, la branche et le commit attendus |
| Fin technique | 12 septembre, 22:57:43 UTC / 23:57:43 heure d'Alger |
| Durée | Build 53 s ; environ 60 s du build à READY |

Les logs confirment migrations et seed à jour, smoke API réussi puis compilation Next.js, TypeScript, pages et déploiement terminés. Le smoke vérifie database/login/session/workspace/CSRF/logout avec un expéditeur injecté : aucune remise réelle d'e-mail n'est prouvée par ce build.

## Isolation et mémoire

La lecture Neon confirme la branche `br-ancient-sun-za1ku4d2`, nommée `preview/product/stitch-functional-owner`, distincte de la branche stable, et les migrations 001 à 009. Aucune écriture manuelle sur Neon ni modification de production ou du legacy n'a été effectuée pendant cette vérification.

La mémoire canonique a été consultée en lecture seule, enregistrements 1, 68, 70 et 72. Cette reprise et D-026 sont documentées localement ; elles n'ont pas été inscrites dans la mémoire PostgreSQL stable, afin de respecter le périmètre de cette intervention.

## Recette réelle et blocage restant — 13 septembre

Après authentification Vercel par le propriétaire, l'accès normal est ouvert. Navigation effectuée : accueil → Commencer → connexion → inscription → retour connexion → récupération. Connexion et inscription ont été parcourues sur desktop et mobile ; aucun débordement horizontal observé à 390 px. Deux connexions négatives réellement soumises avec un compte fictif, une par format, affichent le refus générique attendu. Aucun compte, OTP/TOTP ou session synthétique n'a été créé par ces tests.

L'absence de `EMAIL_TRANSPORT`, `SMTP_HOST`, `EMAIL_FROM` et des identifiants SMTP est confirmée dans la liste Preview. La route compte refuse le transport non SMTP avec une réponse 503. Les logs montrent séparément deux inscriptions et une récupération en 503, sans attribution à nos actions navigateur. Le transport d'e-mail manquant constitue le blocage actuel ; aucun nouveau raccordement SMTP n'a été entrepris.

- **Compilation : VERIFIED.** Artefact READY sur le commit attendu.
- **Navigation compte et refus desktop/mobile : VERIFIED, partiels.** Cinq captures dans le rapport de recette.
- **Nouveau propriétaire jusqu'au cockpit : BLOCKED.** Configuration d'e-mail absente.
- **Remise réelle, TOTP, reconnexion positive, récupération complète, onboarding et premier résultat : NOT_RUN.**
- **Endpoint readiness : non vérifié en ligne.** La CLI n'a rendu que `Redirecting` et le navigateur a refusé la route ; aucun contournement.
- **Production et legacy : non modifiés.** Aucune promotion ni certification.

Le [rapport détaillé](../../docs/qa/deployment-2026-09-13/report.md) distingue les étapes jouées, les logs observés séparément et les fonctionnalités non testées, avec les réponses aux questions du [protocole restaurateur](../09-pilot/real-world-user-testing.md). Aucun parcours complet n'est déclaré PASS.

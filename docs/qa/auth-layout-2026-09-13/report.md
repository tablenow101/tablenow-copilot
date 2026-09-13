# Authentification — présentation du 13 septembre 2026

## Périmètre demandé

Reproduire la structure de la capture fournie (logo TableNow en haut, titres centrés, champs et boutons alignés, six cases de code). Dernière clarification du propriétaire : conserver impérativement les couleurs actuelles ; consulter le propriétaire pour toute autre différence. Onboarding et contrôles d’identité inchangés. Option de persistance des cookies ajoutée sur confirmation du propriétaire, à durée serveur constante.

Le fond blanc et les boutons noirs introduits dans un premier brouillon ont été retirés avant toute publication. Palette et préférence clair/sombre antérieures restaurées. Le commit de code `c01d192f0eac239628cdcb3f312923a7801c0c25` est publié sur `product/stitch-functional-owner`. Preview vérifiée READY : `dpl_DJSJo2scmk7YRewh2Qa9RXqu7Ubz`, projet `tablenow-copilot-v2`, équipe `tablenow101`. [Connexion de cette Preview](https://tablenow-copilot-v2-qs35jybon-tablenow101.vercel.app/login).

## Code local

- `apps/console/components/account/AccountFlow.tsx` : structure, libellés distinguant e-mail/application, six cellules visuelles avec un seul champ accessible (clavier et collage), retour, connexions sociales explicitement indisponibles.
- `apps/console/app/components.css` : styles ciblés sur l’authentification ; couleurs TableNow conservées.
- Choix explicite du propriétaire : « Rester connecté ». La case « Se souvenir de moi » transmet un booléen conservé dans le challenge chiffré ; cochée, les cookies session/CSRF gardent le Max-Age existant ; décochée, ils sont des cookies de session navigateur. La durée maximale en base reste identique. Aucun e-mail ni mot de passe mémorisé localement. Les anciennes requêtes/challenges conservent leur comportement.
- `services/core-api/src/account-routes.ts`, `auth.ts`, `account-routes.test.ts` : propagation du choix, durée des cookies et assertions après vérification MFA.
- Aucun endpoint OAuth Google/Apple trouvé. Aucun paramètre OAuth dans la liste des variables Preview de branche consultée. Applications dédiées et accès demandés au propriétaire ; aucune clé lue ni réutilisée.

## Vérifications

- Console : 40 tests existants réussis. API : 11 tests compte/cryptographie et 3 tests d’origine réussis. Les tests vérifient les cookies persistants/non persistants après MFA et la borne d’expiration en base. Builds API et Next.js réussis ; typages API et console réussis. Une assertion TypeScript du test a été corrigée (ligne SQL potentiellement absente), puis typage relancé avec succès.
- Navigateur local : vrai composant, API factice isolée sur 127.0.0.1:4108. Aucun compte, e-mail ou session réelle. Ne constitue pas un test d’authentification réelle.
- Mobile 390 × 844 : connexion → inscription → code e-mail simulé ; champs/boutons à x=24, largeur 342, hauteur 52 ; scrollWidth=390. Saisie de six chiffres puis effacement : cinq cellules remplies, dernière vide.
- Ordinateur 1280 × 900 : code d’application simulé, six cellules de 57 px, groupe centré, scrollWidth=1280. Passage au code de secours fonctionnel dans l’interface.
- Collage local de « 123 456 » : six cellules « 123456 », sans perte de chiffre ; auto-complétion e-mail désactivée sur l’étape application.
- [Connexion mobile](local-mobile-login.png).
- [Code e-mail mobile — simulation](local-mobile-email-fixture.png).
- [Code application ordinateur — simulation](local-desktop-mfa-fixture.png).

## Preview et CI

- Vercel : compilation complète en 24 s ; déploiement terminé le 13 septembre à 21:04:08 UTC. Projet, branche et SHA vérifiés ; cible Preview, sans promotion.
- GitHub Quality Gate `34782629622` : qualité TypeScript/tests/build, isolation PostgreSQL et images Docker tous réussis.
- Logs runtime de ce déploiement, filtre 5xx, fenêtre de 15 minutes pendant la recette : aucun résultat. Cela ne prouve pas les routes authentifiées non exercées.
- Navigateur réel sur cette Preview : connexion → inscription → récupération → connexion. Écrans visités en mobile 390 × 844 et ordinateur 1280 px. Champs à x=24 et largeur 342 px en mobile ; x=440 et largeur 400 px sur ordinateur. Pas de débordement horizontal dans les mesures.
- Couleurs mesurées en Preview : bouton `rgb(212,248,72)` et dégradés antérieurs bleu/violet. Logo TableNow affiché.
- Captures : [connexion ordinateur](preview-desktop-login.png), [connexion mobile](preview-mobile-login.png), [inscription ordinateur](preview-desktop-register.png), [inscription mobile](preview-mobile-register.png), [récupération ordinateur](preview-desktop-reset.png), [récupération mobile](preview-mobile-reset.png).
- L’outil de redimensionnement a expiré deux fois et sa réinitialisation finale a également expiré ; la réinitialisation par cet outil ne peut donc pas être attestée. Le dernier onglet livrable a été observé aux dimensions natives 412 × 808 après fermeture de l’onglet mobile de recette ; recette ordinateur terminée dans un nouvel onglet aux dimensions natives. L’ancien onglet localhost arrêté produit une page d’erreur interne que l’outil refuse d’opérer ; pas un échec de la Preview. Les onglets de recette temporaires ne sont pas conservés comme livrables. L’onglet final de connexion est marqué livrable.

## Verdict

**PASS limité à la présentation et à la navigation entre les trois écrans publics**, dans les dimensions observées. Les six cases, la saisie, l’effacement, le collage et le passage au code de secours ont été vérifiés avec le vrai composant en **simulation locale** uniquement.

**BLOCKED** pour Google/Apple : raccordement absent, accès du propriétaire attendus ; boutons explicitement indisponibles. **NOT_RUN** pour la connexion réelle complète, la réception d’un nouvel e-mail et la conservation réelle de session après fermeture/réouverture du navigateur. Le comportement des cookies est couvert par les tests d’intégration, pas par une connexion privée du propriétaire durant ce lot.

Aucun nouvel e-mail réel envoyé ; aucun mot de passe/TOTP/secret réel changé ou consulté. Onboarding et production/produit historique non modifiés. Le parcours d’authentification complet n’est pas certifié.

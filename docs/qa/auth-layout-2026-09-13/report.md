# Authentification — présentation du 13 septembre 2026

## Périmètre demandé

Reproduire la structure de la capture fournie (logo TableNow en haut, titres centrés, champs et boutons alignés, six cases de code). Dernière clarification du propriétaire : conserver impérativement les couleurs actuelles ; consulter le propriétaire pour toute autre différence. Onboarding et contrôles d’identité inchangés. Option de persistance des cookies ajoutée sur confirmation du propriétaire, à durée serveur constante.

Le fond blanc et les boutons noirs introduits dans un premier brouillon ont été retirés avant toute publication. Palette et préférence clair/sombre antérieures restaurées. Aucun commit/push/déploiement de ce lot à cette étape.

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

## Verdict

Présentation : contrôles locaux effectués, sans certification du parcours complet. Authentification réelle, nouvelle Preview, Google/Apple : **BLOCKED / NOT_RUN** selon le cas. Aucun envoi réel, changement de mot de passe, modification de TOTP, changement de production ou du produit historique.

Reste : accès Google/Apple du propriétaire ; compilation finale puis Preview et vérification réelle. Ne pas présenter le brouillon comme terminé ou comme un raccordement Google/Apple fonctionnel.

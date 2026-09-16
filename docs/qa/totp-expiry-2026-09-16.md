# Diagnostic TOTP Preview — 16 septembre 2026

## Verdict

`BLOCKED_AUTH` — le lot 1 reste ouvert jusqu'à une nouvelle vérification réelle par le propriétaire, puis la recette sauvegarde/reprise sur ordinateur et mobile.

L'écran « Code de votre application » attend un TOTP Google Authenticator. Il ne demande pas un OTP e-mail et ce parcours Google n'a créé aucun code e-mail.

## Cause observée

- Source des journaux : déploiement Preview `dpl_8R3R6jHUUUasRoTohDTmvunMvkZp`, commit `0215615c08eea23cf7a29c0b622e46fb85739d55`.
- Google OAuth a terminé son retour sur `preview.tablenow.io` et la continuation a répondu `200`.
- Le défi MFA a été créé à `19:36:45.677Z` et a expiré à `19:46:45.677Z`.
- La requête de validation est arrivée vers `19:52:19Z`, soit environ 5 min 34 s après l'expiration, et a répondu `400`.
- Le compteur de tentatives est resté à zéro : le serveur a rejeté le défi avant de déchiffrer et comparer le code TOTP. Le code saisi n'a donc pas été déclaré faux par l'algorithme.

## Contrôles sans lecture de secret

- La branche Neon Preview utilisée est `preview/product/onboarding-owner` (`br-twilight-fire-za44k15b`, base `neondb`).
- Le compte est actif, possède un enrôlement TOTP chiffré et une identité Google liée au même utilisateur.
- Un TOTP a été accepté sur ce même enrôlement le 16 septembre à `09:37Z`.
- La variable Preview `SESSION_SECRET` n'a pas été remplacée depuis cette réussite ; la continuation Google actuelle a aussi pu être ouverte par le déploiement. Aucun défaut de déchiffrement n'apparaît dans les journaux de l'échec.
- Le QR et le serveur utilisent tous deux HMAC-SHA1, six chiffres, une période de 30 secondes. Le serveur accepte le pas courant et un pas adjacent dans chaque direction, puis interdit la réutilisation d'un pas déjà accepté.
- Les horloges Vercel et PostgreSQL correspondaient à l'heure UTC locale à la latence de mesure près ; aucun décalage matériel n'a été constaté.
- Les journaux confirment le retour OAuth, la continuation et la vérification sur l'environnement Preview canonique. Aucun secret, code ou jeton n'a été enregistré dans ce rapport.

## Correction

- L'API renvoie désormais `ACCOUNT_CHALLENGE_EXPIRED` avec HTTP `410` quand le défi MFA a expiré, sans incrémenter les tentatives et sans tester le code.
- PostgreSQL fixe l'échéance et transmet sa durée restante au navigateur ; le cookie de défi est renouvelé lors du passage e-mail → TOTP.
- L'interface affiche le temps restant, désactive la saisie après expiration et propose de relancer la connexion Google.
- Un renvoi d'OTP e-mail remplace aussi l'ancienne durée affichée par celle du nouveau défi.
- Le texte distingue explicitement le TOTP du code e-mail. Aucun e-mail n'est annoncé ou envoyé dans le parcours Google + TOTP.

## Preuves techniques locales

- API : 18 fichiers réussis, 1 ignoré ; 98 tests réussis, 4 ignorés.
- Console : 14 fichiers réussis ; 55 tests réussis.
- TypeScript API et console : réussi.
- Tests dédiés : un défi MFA expiré répond `410`, retourne `ACCOUNT_CHALLENGE_EXPIRED` et conserve `attempts = 0`, y compris après Google sur un compte existant ; aucun e-mail n'est envoyé.

## Recette restante

Le déploiement Preview, la saisie privée d'un nouveau TOTP et le parcours priorités → sauvegarde → établissement → déconnexion/reconnexion → reprise restent à exécuter. Une réinitialisation TOTP n'est pas déclenchée : les preuves actuelles montrent un enrôlement actif et récemment fonctionnel. Si un nouveau défi valide refuse réellement un code frais, la récupération devra vérifier l'identité, révoquer explicitement l'ancien enrôlement, générer un nouveau QR, valider un premier code puis confirmer la réussite.

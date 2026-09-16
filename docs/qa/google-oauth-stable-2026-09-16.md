# Vérification Google OAuth stable — 16 septembre 2026

## Correction

- Commit : `aec792bd813d1de87c2b5c90b250aa17ed580288`.
- Déploiement Preview : `dpl_DxrVpDcz3vuJes76kFQbNWwREBUR`, statut READY.
- `preview.tablenow.io` et `copilot.tablenow.io` ciblent `product/onboarding-owner`.
- En Preview, l'ancien domaine redirige temporairement vers `preview.tablenow.io`. En production, le même code le redirigera définitivement vers `os.tablenow.io`.

## Preuves exécutées

- Build Vercel issu du commit exact : migrations courantes, seed Preview et smoke technique réussis, compilation Next.js réussie.
- Navigation réelle : `https://copilot.tablenow.io/login` ouvre `https://preview.tablenow.io/login`.
- Le bouton Google ouvre le sélecteur de compte avec le retour `https://preview.tablenow.io/api/v1/oauth/google/callback`.
- Le compte de test autorisé revient dans TableNow sur l'écran TOTP.
- L'erreur `redirect_uri_mismatch` n'a pas été reproduite après correction.

## Limites distinctes

- Google Auth Platform est encore en mode Testing : 2 testeurs inscrits, plafond de 100. Une adresse absente de la liste ne peut pas encore se connecter.
- La protection Vercel Standard reste active. Un testeur extérieur à l'équipe doit recevoir un accès ou un lien de partage Vercel.
- La saisie TOTP, l'onboarding, le cockpit et la recette mobile ne sont pas validés par ce test.
- La présence du transport e-mail dans la readiness ne prouve pas la réception réelle d'un message.

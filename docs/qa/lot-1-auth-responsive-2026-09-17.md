# Lot 1 — authentification, reprise et responsive — 17 septembre 2026

## Verdict

`VERIFIED_TECHNICALLY — AWAITING_OWNER_PRODUCT_APPROVAL`

Le lot 1 reste ouvert. Aucun passage au lot 2 final, au lot 3, à `main` ou à la production n'est autorisé avant la validation produit explicite du propriétaire.

## Version réellement servie

- Branche : `product/onboarding-owner`.
- Commit : `47bd3d7187518d4fc915cad0c1c12e106dd17ebc`.
- Déploiement Preview : `dpl_3d1FUGSrJBJxcDLhRLcftBroZtcj`.
- URL Vercel : `https://tablenow-copilot-v2-7vc3bjwa9-tablenow101.vercel.app`.
- Alias stable testé : `https://preview.tablenow.io`.
- Vercel : `READY`, cible `preview` ; le journal de build confirme la branche et le commit ci-dessus.
- `main` distante est restée sur `665ca205111c7937b1e7507137e0af2b3c161c54` pendant cette vérification.

## Parcours réel exécuté

Dans le navigateur Preview, avec saisie privée du propriétaire :

1. Google OAuth a rendu la main à TableNow.
2. Un TOTP Google Authenticator frais a été accepté.
3. Le cockpit `/dashboard` a été atteint avec une session authentifiée.
4. La section Priorités a affiché les réponses persistées : `L’équipe`, `Les réservations`, priorité principale `L’équipe`.
5. `Continuer` a sauvegardé les priorités et ouvert Établissement.
6. L'établissement déjà renseigné a été retrouvé.
7. La session a été déconnectée par l'interface.
8. Une seconde connexion Google puis un second TOTP frais ont réussi.
9. Priorités et Établissement ont été retrouvés à l'identique après reconnexion.

Limite : ce compte avait déjà terminé son onboarding. Son arrivée normale après authentification est donc `/dashboard`; la première arrivée automatique d'un compte neuf sur Priorités n'a pas été rejouée dans cette passe. Priorités a été ouverte depuis le cockpit par le parcours utilisateur « Ajuster mes priorités », sans réinitialiser les données.

## Responsive réellement mesuré

Treize dimensions ont été testées sur la Preview déployée :

| Famille | Dimensions |
|---|---|
| iPhone compact à grand | 320×568, 390×844, 430×932 |
| Android compact à grand | 360×800, 412×915 |
| iPad | 768×1024, 820×1180, 1024×1366 |
| Surface | 912×1368, 1368×912 |
| Ordinateur | 1280×720, 1440×900, 1920×1080 |

Résultats :

- onboarding : 13/13 sans débordement horizontal ni contrôle hors écran ; texte validé visible et sauvegarde indiquée ;
- cockpit : 13/13 sans débordement horizontal ni contrôle hors écran ; barre TableNow sur une seule ligne, 60 px de haut ; dernier contenu entièrement accessible au défilement à 320×568 ;
- connexion, inscription et récupération : 39/39 combinaisons route/dimension sans débordement ni contrôle hors écran ;
- Confidentialité, Conditions d'utilisation et DPA : 39/39 combinaisons route/dimension sans débordement ni contrôle hors écran, avec logo officiel visible.

Ces mesures utilisent des viewports réels du navigateur de recette. Elles prouvent le comportement responsive du rendu web ; elles ne remplacent pas un essai tactile sur chaque modèle physique du marché.

## Corrections du lot

- `4698fe7` : expiration du défi TOTP explicite et relance sûre.
- `f105c3d` : largeur intrinsèque de l'onboarding corrigée.
- `18b8459` : URL longue et actions adaptées aux écrans 320/360 px.
- `47bd3d7` : barre du cockpit compacte sur mobile.

## Contrôles techniques

- Console : 14 fichiers, 55 tests réussis.
- lint et typecheck : réussis.
- build Next.js de production : réussi.
- `git diff --check` : réussi.
- build Vercel : migrations à jour, smoke Preview réussi, compilation réussie, déploiement `READY`.

## Porte produit

La session authentifiée est conservée sur `/dashboard` pour la revue. Le propriétaire doit encore accepter explicitement le lot 1. Le scénario d'un compte entièrement neuf reste distinct et ne doit pas être déclaré vérifié par cette recette d'un compte historique.

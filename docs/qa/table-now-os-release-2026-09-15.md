# TableNow OS — préparation de la dernière Preview

## Périmètre

- Source : `product/onboarding-owner`, base publiée `787973170fe3cde6f1e0db84fdfa5b4d3a8ef515`.
- Preview stable : `https://preview.tablenow.io`.
- Production future : `main` sur `https://os.tablenow.io`, exclue tant que la Preview n'est pas certifiée.

## Cause Vercel établie

La première frontière défaillante était la limite de branches Neon atteinte. Après suppression autorisée de trois branches Dependabot orphelines, Vercel a créé la branche dédiée `br-twilight-fire-za44k15b` et l'endpoint `ep-rapid-leaf-zas11naf`. Le déploiement suivant a exposé trois variables Preview invalides ou absentes. `SESSION_SECRET` et `OTP_PEPPER` ont été remplacés par des valeurs cryptographiques dédiées à la branche ; `PLATFORM_ADMIN_EMAIL` est défini pour cette Preview. Aucune valeur secrète n'est consignée ici.

## Corrections contrôlées localement

- Une topologie partagée autorise uniquement le projet Vercel Copilot, `product/onboarding-owner` sur `preview.tablenow.io` et `main` sur `os.tablenow.io`.
- La migration Vercel vérifie cette topologie avant toute connexion, puis l'endpoint Neon et la base `neondb`. Preview et production ont chacune leur endpoint explicite.
- Le transport SMTP exige hôte, utilisateur et mot de passe ; le rapport readiness conserve ses champs historiques tout en indiquant `configuration-only` et `runtimeVerified: false`.
- OAuth Google et Google Places refusent tout autre projet, branche ou origine.
- `/dashboard` est le cockpit ; `/today` ne fait que rediriger.
- Les trois PNG officiels sont copiés sans transformation ; les références visibles restantes à « TableNow Copilot » ont été remplacées par « TableNow OS ».

## Preuves locales fraîches

- Tests ciblés après revue : 45/45 réussis.
- `pnpm check` : lint 16/16, typecheck 16/16, 207 tests réussis, 4 intégrations explicitement ignorées, build 11/11.
- `git diff --check` : à rejouer juste avant commit.
- Scanner du diff : uniquement trois chaînes PostgreSQL synthétiques dans un test ; aucune valeur secrète réelle détectée.

## État de recette

- Build local : **VERIFIED**.
- Nouveau commit et build Vercel : **NOT_RUN**.
- Google Places réel : **BLOCKED**, clé Preview dédiée absente.
- Inscription/e-mail/TOTP/Google/onboarding/cockpit et appareils : **NOT_RUN** sur ce lot.
- Fusion `main`, production, domaines finaux et suppression de branche : **NOT_RUN**.

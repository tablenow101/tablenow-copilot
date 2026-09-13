# Raccordement SMTP Resend — 13 septembre 2026

Projet Vercel `tablenow-copilot-v2` (`prj_7FV38t7g0NtMZtsPYDyIGIezNbUa`), équipe `tablenow101`, branche `product/stitch-functional-owner`, environnement `preview` uniquement. Code local `0d191dd34d4db2ef5078b414b7bacf408859d35d`, travaux de documentation précédents préservés.

## Sources et accès

Les appels officiels Resend `list_domains` et `get_domain` confirment `tablenow.io`, région `eu-west-1`, statut `verified`, capacité d'envoi activée, DNS SPF/DKIM vérifiés. La clé historique nommée `TableNow` est listée sans preuve de son affectation à Copilot ; aucune valeur n'a été extraite ou réutilisée.

Les [paramètres SMTP officiels Resend](https://resend.com/docs/send-with-smtp) permettent le port 465 avec TLS implicite, utilisateur `resend`, et une clé API comme mot de passe. La [création de clé Resend](https://resend.com/docs/api-reference/api-keys/create-api-key) permet de restreindre l'envoi à un domaine. Le code existant `SmtpEmailSender` utilise ces paramètres Nodemailer sans modification.

## Configuration sauvegardée

Chaque commande `vercel env add` est limitée explicitement au projet, à l'équipe, à `preview` et à `--git-branch product/stitch-functional-owner`. Les six commandes ont terminé avec sortie 0. Aucun `--force` ni cible production n'a été utilisé.

| Variable | Valeur non secrète | État |
|---|---|---|
| SMTP_HOST | smtp.resend.com | Enregistré |
| SMTP_PORT | 465 | Enregistré |
| SMTP_SECURE | true | Enregistré |
| SMTP_USER | resend | Enregistré |
| EMAIL_FROM | info@tablenow.io | Enregistré |
| EMAIL_TRANSPORT | smtp | Enregistré |
| SMTP_PASSWORD | Valeur privée, jamais documentée | Sensible, Preview et branche uniquement |

La clé `TableNow-Copilot-Preview` est visible dans la liste officielle Resend après confirmation du propriétaire. Cette liste ne prouve pas les permissions détaillées de la clé. Le secret Vercel `SMTP_PASSWORD`, initialement valable pour toutes les Previews, a été restreint par PATCH de ses seules métadonnées à `product/stitch-functional-owner`. Relecture confirmée : type `sensitive`, cible `[preview]`, branche exacte. Aucune valeur secrète n'a été lue ou copiée.

## Redéploiement vérifié

- Commande : `vercel redeploy dpl_3bkD3gAw5LZH9MaLxpn9YvvPQA2M --target preview --scope tablenow101 --no-wait`, sortie 0.
- Résultat : `dpl_GtBe5UTeyNrRuNSShayVVLLEUCu8`, URL `https://tablenow-copilot-v2-jyp8smof5-tablenow101.vercel.app`.
- API Vercel : READY, `originalDeploymentId` identique à la source demandée, `githubCommitRef=product/stitch-functional-owner`, `githubCommitSha=0d191dd34d4db2ef5078b414b7bacf408859d35d`, cible Preview (`target=null`), alias de branche uniquement.
- Logs : migrations courantes, seed pilote courant, smoke API réussi avec expéditeur injecté ; compilation Next.js en 5,8 s, TypeScript en 5,9 s, build total 53 s, déploiement terminé le 12 septembre à 23:58:33 UTC.
- La version `8qufwgirl` issue de `main` est explicitement exclue par le propriétaire ; ne pas sélectionner le dernier déploiement sans contrôle source/branche/SHA.

## Recette en cours

Écran `/register` réellement ouvert sur `jyp8smof5`. Nom de recette et e-mail autorisé préremplis ; mot de passe à saisir par le propriétaire directement dans la page. Aucun message de contrôle direct via le connecteur n'a été envoyé : il ne prouverait pas le transport de l'application.

Envoi SMTP applicatif, événement fournisseur, réception Gmail confirmée, code vérifié, TOTP, onboarding et résultat sauvegardé dans le cockpit restent NOT_RUN. Les captures de la passe précédente concernent `96v84r74c` avant SMTP et ne certifient pas cette passe. Aucun secret, production ou domaine historique modifié.

# Resend pour la Preview — 13 septembre 2026

## Retour du propriétaire lors de la reprise

Le 13 septembre, le propriétaire rapporte un dernier test réussi après raccordement e-mail ; le checkpoint canonique 73 rapporte également « ça a fonctionné ». Cette confirmation est conservée comme retour utilisateur. Elle ne détaille pas séparément vérification du code, TOTP, onboarding et cockpit ; ces étapes ne sont pas rétroactivement certifiées par les logs de build. Le contrôle Git de reprise retrouve `0d191dd` localement et à distance, sans modification locale du code SMTP/authentification : les changements opérationnels étaient les variables Vercel et le redéploiement documentés ci-dessous.

## Référence imposée par le propriétaire

La version de travail est `https://tablenow-copilot-v2-96v84r74c-tablenow101.vercel.app/register`, déploiement `dpl_3bkD3gAw5LZH9MaLxpn9YvvPQA2M`, branche `product/stitch-functional-owner`, commit `0d191dd34d4db2ef5078b414b7bacf408859d35d`. L'URL `https://tablenow-copilot-v2-8qufwgirl-tablenow101.vercel.app/login`, issue de `main`, est explicitement exclue par le propriétaire. Ne jamais sélectionner le dernier déploiement du projet sans vérifier sa branche et son commit. Un redéploiement autorisé peut produire une nouvelle URL, mais doit repartir de cette version produit.

## Ajout de la clé et correction de portée

Après confirmation du propriétaire, la clé Resend `TableNow-Copilot-Preview` est visible dans la liste officielle. `SMTP_PASSWORD` avait été enregistré comme secret pour toutes les Previews ; sa portée a été restreinte via PATCH de ses seules métadonnées à `product/stitch-functional-owner`, puis relue. La valeur n'a pas été lue, copiée ou affichée. Aucun paramètre de production n'a été modifié. Le redéploiement SMTP part explicitement du déploiement `96v84r74c` ; déploiement READY confirmé, parcours réel encore en attente.

## Résultat du redéploiement

Le déploiement `dpl_GtBe5UTeyNrRuNSShayVVLLEUCu8`, [Preview SMTP](https://tablenow-copilot-v2-jyp8smof5-tablenow101.vercel.app/register), est **READY**. Ses métadonnées confirment `originalDeploymentId=dpl_3bkD3gAw5LZH9MaLxpn9YvvPQA2M`, la branche cible et le commit `0d191dd`. Aucun alias de production n'a été ajouté. Compilation Next.js, TypeScript, migrations et smoke de build réussis ; le smoke emploie un expéditeur injecté et ne prouve pas un envoi réel.

L'écran d'inscription de cette nouvelle Preview est accessible dans le navigateur. Nom de recette et destinataire autorisé préparés ; saisie privée du mot de passe et soumission confiées au propriétaire. Envoi SMTP réel, réception Gmail confirmée, vérification, TOTP, onboarding et cockpit restent **NOT_RUN** à ce stade. Aucun parcours complet n'est certifié.

## Historique de préparation

Le propriétaire autorise Resend pour `product/stitch-functional-owner` uniquement en Preview : expéditeur `info@tablenow.io`, destinataire de test `bryanduvalpro@gmail.com`. Production, application historique et leurs secrets sont exclus. Cet accord complète D-026 ; voir D-027.

## Vérifié lors de la préparation

- Le connecteur Resend est accessible. Le domaine `tablenow.io` est `verified`, envoi activé, DKIM et SPF vérifiés ; aucun DNS ou paramètre de domaine modifié.
- Une clé nommée `TableNow` existe, mais son périmètre Copilot n'est pas établi par les métadonnées disponibles. Elle n'est pas réutilisée.
- Aucun `SMTP_PASSWORD` ou `RESEND_API_KEY` n'a été trouvé dans les variables Preview Copilot, le processus local ou les fichiers `.env*` locaux examinés ; seules présence et métadonnées ont été relevées.
- Six paramètres non secrets ont été enregistrés dans Vercel pour la Preview de cette seule branche. Détails : [configuration SMTP](../../docs/qa/deployment-2026-09-13/resend-smtp.md).

## Étape requise lors de la préparation — désormais effectuée

Ajouter une clé Resend dédiée `TableNow-Copilot-Preview`, permission `Sending access`, limitée au domaine `tablenow.io`, directement comme `SMTP_PASSWORD` sensible dans Vercel, Preview uniquement, branche `product/stitch-functional-owner`. L'utilisateur a reçu le chemin sécurisé ; aucune clé n'est demandée dans la conversation.

État historique avant ajout : **BLOCKED sur la clé SMTP.** Aucun nouveau déploiement ni envoi n'a été lancé pendant ce raccordement. Les paramètres sauvegardés ne sont pas encore chargés par la Preview existante. Réception, vérification de l'adresse, TOTP, onboarding et cockpit restent **NOT_RUN** pour cette passe.

Après ajout : relire la portée, redéployer la branche, tester l'inscription normale, vérifier la preuve fournisseur et demander au propriétaire de confirmer la réception réelle avant de valider cette étape. Poursuivre ensuite le parcours et documenter ordinateur/mobile.

La mémoire canonique stable a été consultée en lecture seule. Cette autorisation est consignée localement ; son inscription canonique reste en attente dans le périmètre Preview actuel.

# Authentification séparée — 23 septembre 2026

## Périmètre

Branche unique `product/onboarding-owner`, base publiée `eb7c51acd42205baf9bbf62329de496ef77b76db`. Main, production, onboarding, cockpit et pages juridiques non modifiés. Aucun fournisseur ni dépendance ajouté. La page DPA locale s’est ouverte lors d’un clic dans la recette ; ce n’était ni une restauration ni un déploiement d’une ancienne version. À la demande du propriétaire, la suite de la recette est limitée à l’authentification.

## Décision appliquée

- `/login` : e-mail + mot de passe, Google pour une identité déjà associée, lien S’inscrire en bas.
- `/register` : e-mail + création d’un mot de passe ou Google ; aucun nom demandé.
- Inscription e-mail : lien temporaire à usage unique, confirmation puis onboarding. Le lien peut être ouvert dans un autre navigateur.
- Google : intention login/signup scellée côté serveur ; aucune création depuis login. Adresse Gmail/Workspace garantie par Google : entrée directe, envoi d’un e-mail de bienvenue. Adresse non garantie : preuve de possession de la boîte nécessaire avant création/association.
- `/login/email` : code à six chiffres réservé à un compte existant, jamais création implicite.
- `/forgot-password` : nouveau mot de passe et confirmation par lien ; les anciennes sessions sont révoquées après validation. TOTP déjà actif conservé.
- Les comptes protégés exigent leur TOTP ou code de récupération après le premier facteur, y compris Google et code e-mail. Aucun nouveau TOTP obligatoire lors d’une inscription simple.
- Présentation commune : logo officiel, champs/boutons de 44 px, pictogramme de thème de 16 px sans cercle, clair/sombre. Apple visible et désactivé conformément à la décision antérieure.

## Conservation / nettoyage

Les trois fichiers frontend BackupRecovery/account-recovery n’avaient aucun import applicatif : supprimés. Les routes serveur de récupération et les facteurs existants sont conservés. Le traitement `complete-profile` ne reçoit plus de nouveaux challenges ; il permet uniquement de terminer les vérifications déjà engagées avant déploiement (durée limitée à 10 minutes), sans exiger un nom et sans contourner un TOTP.

Migration 017 : seule la contrainte NOT NULL de `totp_secret` est retirée, sans modification des valeurs existantes. La procédure de retour refuse toute perte de données ; voir `services/core-api/migrations/017_password_without_totp.rollback.md`.

Les autres travaux fonctionnels préexistants mis à l’abri dans le stash n’ont pas été supprimés : ils contiennent des modifications hors authentification, pas seulement des variantes visuelles. Ils ne sont pas incorporés à cette livraison limitée.

## Vérifications exécutées

Suite API : 150 tests réussis, 4 tests externes ignorés ; ajout final ciblé : 11 tests Google réussis, y compris erreur SMTP. Console : 127 tests réussis. Builds TypeScript API et Next.js réussis. Une exécution concurrente a dépassé le délai de test de 5 secondes sur les hachages de mots de passe ; relance séquentielle avec budget de 15 secondes réussie, aucune protection applicative modifiée.

- API sur PostgreSQL PGlite isolé : inscription, lien en autre navigateur, expiration et usage unique, connexion avec mot de passe, refus de compte inconnu, reset et révocation, TOTP après lien et après Google, conservation d’identité et d’établissement, limites d’essais, erreurs d’envoi.
- Google : échanges externes simulés aux frontières dans les tests ; ce n’est pas une connexion Google humaine réelle.
- Navigateur local à 390 × 844 : login → S’inscrire → e-mail + mot de passe → message de confirmation → clic du lien dans une boîte de recette locale → arrivée sur Priorités. Sélection Réservations, sauvegarde puis passage Établissement observés. Les écrans supplémentaires de la recette ont utilisé un établissement fictif local, jamais le compte propriétaire.
- Aucun e-mail réel envoyé pendant cette recette ; transport remplacé uniquement dans le banc de test hors dépôt. Aucune clé, aucun code ou lien secret dans les captures.
- Captures dans le dossier `auth-split-2026-09-23/` : première page claire, inscription, confirmation, arrivée sur onboarding. Les dimensions sont émulées ; aucun appareil physique certifié.

## Vérifications restant à effectuer après publication

Preview READY au commit exact, contrôles visuels déployés mobile/desktop ; réception du vrai e-mail et retour Google avec intervention privée du propriétaire. La recette globale du produit et les pages juridiques ne sont pas déclarées validées par ce lot.

Mémoire canonique : sauvegarde en attente, connecteur Neon bloqué par validation de schéma `project_id` malgré les paramètres fournis. Décision conservée dans le journal du dépôt, sans prétendre l’avoir enregistrée dans PostgreSQL.

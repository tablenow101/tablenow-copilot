# Blocages connus — 12 septembre 2026

- **Recette visuelle bloquée** : la nouvelle Preview READY mène à « Log in to Vercel ». L'aperçu local est aussi refusé (`ERR_BLOCKED_BY_CLIENT`). Aucun contournement par tunnel, navigateur alternatif ou session préauthentifiée. Reprendre avec l'accès normal autorisé à cette Preview.
- **Restriction manuelle Neon, livraison cloud désormais débloquée par le flux normal** : l'API manuelle répondait `modifying the suspend interval is not permitted on this account`. Aucun changement de plan effectué. L'intégration Vercel a ensuite créé une branche distincte et appliqué les sept migrations, vérifiées en lecture seule. Ce point ne bloque plus le déploiement technique.
- **Services externes non certifiés** : aucun SMTP, modèle IA, SMS, WhatsApp ou téléphonie testé de bout en bout dans cette livraison. Les brouillons sont distincts des envois. Pas de copie de secrets du legacy.
- **Google Places non retrouvé dans le code/configuration locale de Copilot** : cela ne prouve pas son absence dans le compte cloud ou un autre projet. Annuaire français limité à la fiche d'identification ; enrichissement Google à rétablir via sa configuration autorisée.
- **Production non autorisée par la recette** : le code n'est pas certifié fini tant que le parcours réel et les services requis ne sont pas PASS.

## Historique — 31 août 2026

## Immédiat

### Preuve de déploiement Preview

Le projet Vercel existe et Neon est confirmé, mais aucun déploiement issu du dépôt GitHub actuel n'a encore prouvé la chaîne complète : build, variables Preview, migrations et disponibilité de l'API.

## Avant partage aux pilotes

### Protection serveur GitHub

GitHub Actions contrôle chaque push, mais GitHub refuse la protection obligatoire de `main` pour ce dépôt privé sans offre Pro. Le dépôt reste privé ; aucun changement d'offre ne sera effectué sans autorisation.

### E-mail et identité légale

Le domaine d'envoi, l'adresse expéditrice et les informations juridiques réelles doivent être confirmés avant les invitations externes.

### Services cloud

Le stockage privé, les tâches durables, les sauvegardes et Computer Use isolé doivent être raccordés et testés ensemble.

### Certification produit

Le login, l'onboarding, les neuf espaces, les erreurs, les reprises et tous les boutons doivent être parcourus sur ordinateur et mobile avec des données fictives persistantes.

Aucun de ces points ne sera masqué par une simulation dans une version destinée aux restaurateurs.

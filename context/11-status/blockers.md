# Blocages connus — 12 septembre 2026

- **Recette visuelle bloquée** : le navigateur géré refuse `http://localhost:3000/login` avec `ERR_BLOCKED_BY_CLIENT`. Aucun contournement par tunnel, navigateur alternatif ou session préauthentifiée. Reprendre sur une Preview accessible par le parcours normal.
- **Création manuelle de branche Neon refusée** : l'API répond `modifying the suspend interval is not permitted on this account`. Aucun changement de plan ou contournement effectué. Tests SQL exécutés dans PostgreSQL embarqué isolé ; l'intégration GitHub/Vercel/Neon existante reste le chemin normal de Preview.
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

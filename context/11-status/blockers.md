# Blocage SMTP — 24 septembre 2026

Le serveur SMTP refusait l'identifiant (`535 EAUTH`). Nouvelle clé limitée à l'envoi pour le domaine autorisé : authentification SMTP réussie, variable Preview remplacée. Réception réelle, lien de confirmation et reconnexion privée restent non vérifiés. La correction du message d'erreur seule n'avait pas résolu l'envoi. [Preuves](../../docs/qa/auth-consolidation-2026-09-24.md).

# Authentification séparée — 23 septembre 2026

Preview READY et écrans publics vérifiés au commit applicatif `e52ca14`. Restent non exécutés : réception réelle du lien, nouveau retour Google, saisie TOTP privée et essais sur appareil physique. Aucun lot produit clôturé. Mémoire canonique : sauvegarde en attente, connecteur Neon refuse le schéma des paramètres ; décision conservée dans le journal du dépôt. [Preuves et limites](../../docs/qa/auth-split-2026-09-23.md).

Les entrées ci-dessous sont historiques et ne remplacent pas la décision d’authentification séparée.

# Porte de recette du 21 septembre 2026

- Dépôt restauré sans perte : le blocage des 60 fichiers absents est levé.
- Corrections déployées sur Preview et reprise Connexions/Compléments vérifiée réellement. Recette complète encore ouverte : nouvelle inscription et essai physique attendus.
- Parcours complet d’un nouveau compte, saisie TOTP et changement d’application sur un téléphone physique : non exécutés dans cette reprise. La saisie privée reste au propriétaire ; aucun contournement du MFA.
- Connecteurs externes non activés dans l’onboarding ; déclaration distincte de connexion. Documents stockés, analyse non disponible.
- Validation produit et promotion restent bloquées jusqu’aux preuves complètes et à l’accord explicite. Aucun lot clôturé.

Les éléments suivants sont des états historiques à lire avec leur date.

# Porte du pilote Aujourd’hui — 19 septembre 2026

La direction visuelle est approuvée ; le code local passe les contrôles techniques. La recette ciblée Preview est exécutée ; la recette globale et la validation produit restent ouvertes. Le chat est une synthèse métier sans modèle IA configuré ; les documents ne sont pas analysés automatiquement. Micro et appareils physiques ne sont pas certifiés. Les blocs ci-dessous sont historiques et ne constituent pas un diagnostic actualisé du pilote. [État vérifiable](../../docs/qa/pilote-aujourdhui-2026-09-19.md).

# Blocages avant promotion de TableNow OS — 16 septembre 2026

- La connexion Google est vérifiée depuis `copilot.tablenow.io` jusqu'au retour TableNow et à l'écran TOTP sur `preview.tablenow.io`. La panne `redirect_uri_mismatch` est levée.
- Google OAuth reste en mode Testing : les 2 adresses inscrites fonctionnent, et chaque nouveau bêta-testeur doit être ajouté à la liste, dans la limite actuelle de 100 utilisateurs.
- La protection Vercel Standard reste active ; les testeurs externes doivent disposer d'un accès Vercel autorisé ou d'un lien de partage Vercel avant d'atteindre TableNow.
- La vérification serveur indique Google Places et le transport e-mail prêts ; leurs parcours réels restent à exécuter.
- TOTP complet, inscription avec réception réelle de l'e-mail, sauvegarde/reprise d'onboarding, premier résultat, cockpit, reconnexion, ordinateur, téléphone et iPad restent à certifier sur le nouveau déploiement.
- `main`, `os.tablenow.io` et la production restent inchangés jusqu'à réussite complète de la Preview.
- Le stockage privé réel des photos internes n’est pas encore raccordé ; ce point ne bloque pas les lots précédents mais bloque la promotion finale.

# Blocage de recette — session propriétaire

La Preview du lot `747d040` est prête. La suite exige la connexion normale du propriétaire sur la nouvelle URL ; mot de passe et TOTP ne sont jamais demandés dans le chat. Onboarding/cockpit et conseil depuis les écrans non certifiés tant que cette étape reste ouverte. [Preuves et limites](../../docs/qa/governed-2026-09-13/report.md).

## Historique de cette reprise

# Recette en attente — 13 septembre 2026

Le blocage de clé SMTP est levé : secret sensible limité à la branche Preview et redéploiement `jyp8smof5` READY, issu de `96v84r74c`. L'inscription est ouverte pour la saisie privée du mot de passe par le propriétaire. La confirmation de réception réelle puis le parcours TOTP/onboarding/cockpit restent nécessaires. La clé historique `TableNow` n'a pas été réutilisée. Voir [les preuves et la suite](resend-preview-2026-09-13.md).

## État avant autorisation Resend — 13 septembre 2026

**E-mail de compte non configuré sur la Preview de `product/stitch-functional-owner`.** Le déploiement est READY et l'accès normal à Vercel est établi. Les variables de transport SMTP et d'expéditeur sont absentes ; inscription/récupération refusent l'envoi avec une réponse 503. Le parcours complet reste BLOCKED, réception réelle, TOTP et onboarding NOT_RUN. La configuration SMTP n'est pas incluse dans cette passe ; sa reprise exige le périmètre fournisseur, expéditeur, secrets Preview et destinataire de test autorisé. Voir [les preuves actuelles](../../docs/qa/deployment-2026-09-13/report.md).

Le blocage historique de connexion Vercel ci-dessous est levé pour la Preview actuelle. Aucun contrôle de sécurité n'a été désactivé ; production et legacy restent inchangés.

## Historique — 12 septembre 2026

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

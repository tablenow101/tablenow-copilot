# Référence et validations — 12 septembre 2026

Les consignes ci-dessous remplacent l'interprétation de D-015 : alléger visuellement ne donne pas l'autorisation de réduire les fonctions, masquer les informations ou inventer des formulations. Préserver le travail fonctionnel existant. Utiliser le dernier export Stitch exclusivement, avec l'inspiration IMG_4558 pour la présentation de l'entrée et de l'authentification.

## Textes explicitement validés

- Écran d'entrée : « Commencer ». « Get Started » seulement dans la future version anglaise, jamais les deux simultanément.
- Titre d'authentification : « Connexion à TableNow OS ».
- Sous-titre : « Entrez votre adresse e-mail professionnelle pour recevoir votre code ou lien d’accès. »

Le lien magique évoqué par le texte validé n'est pas implémenté à ce stade ; seule la connexion par code existe. Ne pas présenter ce parcours comme définitivement terminé.

## Validation à poursuivre

« Adresse e-mail du gestionnaire » a été proposé, sans réponse explicite. Poser les questions de formulation une à une et attendre chaque réponse. Les textes antérieurs non validés restent à revoir ; leur présence dans le code ne constitue pas une validation.

## Direction visuelle confirmée

- Précision suivante du propriétaire : appliquer un standard très élevé à tous les niveaux, authentification et onboarding compris, et prendre en charge les choix usuels sans questions élémentaires répétées. Parcours retenu : inscription, connexion e-mail et mot de passe personnel, récupération, session persistante ; code de vérification réservé aux étapes où nécessaire. Cette décision de conception n'est pas une déclaration d'implémentation. Les questions restantes doivent porter sur de vrais arbitrages produit ou les formulations propres à TableNow.

- Correction explicite du propriétaire : aucune image basse définition ni solution visuelle provisoire insérée sans consultation. Le standard élevé vaut dès la proposition, sur mobile et ordinateur. Générer une image soignée inspirée d'un restaurant étoilé ou de l'élégance du Petit Palais à Paris ; ne pas présenter la création comme une photographie d'un lieu réel. L'asset 512 × 279 précédemment choisi est rejeté.
- Correction du parcours : inscription et connexion récurrente doivent être distinguées. Ne pas imposer l'envoi d'un nouveau code à chaque retour. Le propriétaire demande des identifiants permanents ; préciser avec lui si « code » signifie mot de passe personnel avant de modifier le mécanisme d'authentification. La référence IMG_4558 reste applicable aux écrans d'inscription et de connexion.

- Premier écran : grande photographie de restaurant élégant et un seul bouton ; aucun logo ni slogan. Le bouton ouvre l'authentification.
- Logo TableNow sur l'authentification ; présentation épurée, lisible, cohérente avec la référence transmise.
- Modes clair et sombre, cohérence des composants dans toute l'application.
- Logos de marques officiels et proportions préservées ; pictogrammes de navigation conformes au dernier Stitch.
- Ne pas confondre afficher un logo et disposer d'une intégration fonctionnelle.

## Sources des premiers assets

- `public/brand/tablenow-os.png` : logo fourni dans le dernier export Stitch.
- `public/brand/restaurant-stitch.jpg` : image déjà intégrée à `accueil_op_rationnel_samedi_19h40/code.html`. Définition 512 × 279, provisoire pour le plein écran ; aucune identification d'un établissement réel n'est revendiquée.
- `public/brand/google-official.png` : https://developers.google.com/static/identity/images/g-logo.png ; règles https://developers.google.com/identity/branding-guidelines (consultées le 12 septembre 2026). Le bouton existant reste désactivé tant que Google OAuth n'est pas configuré.

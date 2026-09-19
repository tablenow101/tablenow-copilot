# Pilote visuel Aujourd’hui — direction validée

Autorisation : conversation du 19 septembre 2026, validation de la maquette mobile sombre/clair puis demande explicite d’implémenter. Mémoire canonique : design system version 4, enregistrement 96, succède à 95. Branche unique `product/onboarding-owner`, référence `7e8b2af`. `main` et production exclus.

## Résultat à livrer

Accueil personnel, logo officiel lisible, indicateur principal utile, surfaces indigo/bleu différenciées, citron sur les actions prioritaires, mode clair de la même composition. Toutes les quatre références contribuent. Animation limitée aux transitions, confirmation et profondeur du fond ; commandes stables et mouvement réduit respecté. Adapter la composition aux formats larges sans créer un second cockpit.

## Contrat fonctionnel

- Réservations, tâches, décisions et premier résultat proviennent des API existantes, dans le restaurant sélectionné. Aucun chiffre de la maquette dans le produit.
- La préparation du briefing préremplit une demande à relire puis envoyer via le chat persistant existant, sans écraser le brouillon. Aucun faux fichier ou faux succès.
- La progression visible mesure les tâches réellement enregistrées ; elle ne prétend pas mesurer des connexions ni la future checklist d’onboarding.
- Tous les liens, menus, formulaires, autorisations et validations serveur existants sont conservés.
- Une seule barre partagée, documents privés existants, texte conservé en erreur, prévention du double envoi, dictée progressive éditable sans envoi automatique. Utiliser le moteur navigateur existant avec indisponibilité honnête ; aucune sélection implicite OpenAI/Deepgram.
- Aucune intégration fournisseur simulée, aucun statut connecté déduit d’une configuration. Authentification/passkeys, migration historique d’onboarding, stockage photos et intégrations restent des lots distincts avec leurs preuves et portes de validation.

## Critères de recette

Diff ciblé ; tests de calcul des métriques (annulation, jour/fuseau, absence de données), transcription sans doublon et conservation du texte ; typecheck/build ; parcours avec API réelle et compte autorisé sur Preview ; mobile/desktop clair/sombre, clavier, détail, envoi/erreur/reprise et upload ; mouvement réduit. Un viewport simulé n’est pas un appareil physique. Livraison produit seulement après recette et validation propriétaire.

# Pilote Aujourd’hui — 19 septembre 2026

Statut : implémentation locale vérifiée, recette Preview en attente. Aucun lot clôturé.

## Changement fonctionnel

- Une composition sombre/claire, logo officiel intact, accueil contextualisé et menu mobile conservant toutes les destinations et le choix du restaurant.
- Indicateur du jour calculé sur les réservations réelles, hors annulations/absences ; regroupement par heure locale. Zéro donnée donne un état vide explicite.
- Progression des tâches existantes, avec accès à leur liste ; aucune connexion ni checklist future simulée.
- Briefing préparé dans la barre à relire et envoyer explicitement. Le brouillon existant est conservé. Réponse et décisions utilisent le chat persistant existant.
- Une barre rétractable conservant le brouillon et les documents privés existants ; double envoi bloqué ; dictée progressive, modifiable, aucun envoi automatique. Erreur vocale et arrêt conservent le provisoire ; édition annule les résultats tardifs sans doublon.
- Ligne de composition réservée dans la mise en page et hauteur adaptée au viewport visuel ; détail accessible sans masquer les actions.
- Aucune dépendance, migration, API ou configuration d’authentification ajoutée. Aucun changement de main/production.

## Preuves locales

- Console : 16 fichiers, 66 tests réussis (dont métriques, fuseau, absence de données, transcription cumulée, arrêt/erreur/édition/redémarrage).
- TypeScript réussi ; compilation Next.js de production réussie.
- Revue ciblée indépendante : perte de brouillon, doublons de dictée, focus sur barre repliée et contraste clair identifiés puis corrigés.
- Diff sans erreur d’espacement.

## À vérifier avant livraison produit

- Version déployée et commit exact sur preview.tablenow.io.
- Parcours authentifié : navigation, préparation, saisie/envoi/réponse persistante, repli, pièces jointes et reprise ; clair/sombre, mobile/tablette/ordinateur.
- Micro physique, clavier logiciel et appareils physiques ne sont pas remplacés par les tests automatisés.
- Google/e-mail/TOTP/Places inchangés dans ce diff ; leur non-régression de bout en bout n’est pas déduite de la compilation.
- Passkeys, récupération, photos privées, checklist canonique et nouvelles intégrations restent des lots distincts. Ce pilote ne certifie pas la spécification entière.

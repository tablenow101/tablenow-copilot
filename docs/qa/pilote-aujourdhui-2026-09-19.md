# Pilote Aujourd’hui — 19 septembre 2026

Statut : contrôles locaux et parcours ciblé Preview vérifiés. Recette globale et validation produit encore ouvertes. Aucun lot clôturé.

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

## Recette réelle Preview

Commit applicatif de première recette : `5f6cefd61d9057e568ada6858888b8fdc7e46381` ; déploiement `dpl_m7Dj8Dy5HFW7tsWeL8wyuTd6PsEk`, URL Vercel `tablenow-copilot-v2-jlp84l8ti-tablenow101.vercel.app`, cible Preview, état READY. `vercel inspect preview.tablenow.io` a confirmé cet alias et cette version. Session propriétaire existante préservée, aucune nouvelle authentification privée nécessaire.

Parcours réellement exécuté dans le navigateur, API Preview réelle :

1. Cockpit authentifié et état vide exact : aucune réservation enregistrée ce jour, aucun chiffre de maquette introduit.
2. Mode clair/sombre, logo officiel lisible ; thème conservé lors des navigations et du rechargement.
3. Brouillon saisi, barre repliée, clic Briefing : barre ouverte, focus dans le champ et brouillon initial conservé avant la demande préparée.
4. Envoi d’une demande de recette sans action externe : état Envoi en cours, bouton désactivé, réponse reçue dans Conversation. Rechargement : demande et réponse présentes à l’identique.
5. Action nommée `Recette TableNow — vérifier le cockpit clair et sombre` créée par le formulaire normal ; progression 0/1. Depuis Après, la progression ouvre Avant et sa liste. Marquage Fait réussi : progression 1/1.
6. Document texte sans donnée personnelle `tablenow-recette-ui-2026-09-19.txt` déposé par la barre ; son nom et son lien privé apparaissent dans les documents enregistrés. Aucun document utilisateur supprimé.
7. Menu mobile : toutes les destinations et choix de l’établissement accessibles.

Dimensions mesurées (viewports de navigateur, pas appareils physiques) :

| Dimensions | Débordement horizontal | Fin du contenu / début de la barre |
|---|---|---|
| 320×568 | absent | 483 / 483 px |
| 390×844 | absent | 759 / 759 px |
| 820×1180 | absent | 1093 / 1093 px |
| 912×1368 | absent | 1281 / 1281 px |
| 1368×912 | absent | 825 / 825 px |
| 1440×900 | absent | 813 / 813 px |

Captures de la version déployée présentées dans la conversation : mobile sombre/clair, tablette claire, ordinateur sombre. Les modules défilent dans une zone réservée au-dessus de la barre.

### Écarts établis et limites

- Le chat affiche réellement **Synthèse métier · IA non configurée**. La réponse est déterministe, conserve les données et indique les manques ; elle ne prouve pas un modèle IA opérationnel. Aucun fournisseur activé implicitement.
- Les documents sont réellement stockés, mais leur analyse automatique reste explicitement indisponible.
- Deux ajustements issus de cette recette : priorité CSS de la flèche bleue et agrandissement du champ à la saisie (maximum 140 px). Typecheck et 66 tests de nouveau réussis ; vérification visuelle à refaire sur le déploiement qui les inclut.
- Micro physique, clavier logiciel réel, panne réseau provoquée et nouvel utilisateur complet : NOT_RUN. Les tests unitaires de dictée ne les remplacent pas.
- Les données de recette restent présentes et identifiables en Preview ; aucune suppression autoritaire.

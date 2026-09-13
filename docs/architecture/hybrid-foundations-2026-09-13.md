# Fondations hybrides et parcours propriétaire

## Référence et périmètre

Lecture canonique le 13 septembre 2026 : `00-LIRE-DABORD.md` v2 (85), tous les dix chemins `Memoire-Gouvernee/*` (75–84), décisions historiques 5, 67, 68, 71–74 et orchestration 4. Les neuf dossiers et leurs sous-dossiers restent dans PostgreSQL, sans copie publique de la mémoire privée. Le rapport du propriétaire a été rapproché de ces versions ; les anciens textes contradictoires restent historiques. Aucun nouveau fournisseur, canal ou modèle n'est activé.

La sauvegarde précédente est `62648ee`, poussée sur `product/stitch-functional-owner`. SMTP a été configuré dans Vercel ; aucun diff de code SMTP/authentification local n'était absent du dépôt. Le succès e-mail est rapporté par le propriétaire, sans preuve détaillée de toutes les étapes. Production et application historique exclues.

## Contrats avant modification d'écran

| Écran | Objectif / entrée | Textes et source | Actions / données / droits | Erreurs et reprise / suite | Composants |
|---|---|---|---|---|---|
| Entrée `/` | Accéder au produit | « Commencer », décision 5 §04 | Lien vers `/login`, aucune donnée privée | Authentification | Image et CTA existants conservés, aucun logo |
| Compte | Inscription distincte du retour, e-mail + mot de passe + TOTP | Textes existants AccountFlow ; décision 67 pour le parcours, pas une validation rétroactive de tous les libellés | API account, cookies, secrets jamais dans le conseil ; pas de session avant second facteur | Erreurs existantes ; profil incomplet → onboarding, complet → aujourd'hui | Brand, champs, modes clair/sombre, disposition existante |
| Onboarding | Compléter le profil automatiquement, sauvegarder et reprendre | « Bonjour et bienvenue, comment puis-je vous aider ? », « Manuscrit », sélection globale : décisions 5 et 67 | Brouillon versionné, sources, pièces jointes privées, consentements ; propriétaire autorisé côté serveur | Conflit de révision, erreur sauvegarde, reprise au dernier écran ; finalisation → cockpit | OnboardingFlow et compositeur existants ; clavier/micro volontaire, aucune parole TableNow |
| Aujourd'hui | Situation actuelle, suite, priorités | Textes OwnerShell existants ; décision 78 | Données du restaurant sélectionné, domaines depuis menus | Session incomplète → onboarding ; erreurs API visibles | Shell, cartes et menus existants, desktop/mobile |
| Copilot | Conseil traçable et décision du propriétaire | Texte existant conservé ; champs techniques de preuve « Sources », « Incertitudes », « Décision », « Résultat observé » issus des concepts 81/84 ; aucune nouvelle accroche commerciale | Message → mission identifiée → calculs/sources → réponse ; décisions/résultats enregistrés séparément, aucune exécution externe | Délai, échec, nouvelle tentative avec même identifiant ; résultats consultables après rechargement | Bulles et compositeur existants ; détails de preuve repliables, contrôles accessibles |

## Implémentation prévue

- Mémoire privée de conception : aucun accès dans le chemin de récupération des agents ; rôle PostgreSQL dédié sans privilège sur `project_memory`.
- Connaissances communes : schéma propre, sources/version/validité/évaluation, lecture des seules versions approuvées et valides ; aucun transfert automatique d'informations restaurant.
- Mémoire restaurant : sessions et droits existants, requêtes tenant + restaurant + utilisateur, RLS et intégrité relationnelle ; recommandations, contexte probant, décision humaine et résultat observé persistants.
- Contexte temporaire : stockage borné avec expiration et nettoyage, indépendant du registre durable des recommandations.
- Orchestration : qualification et spécialistes de réservation/opérations/analyses selon les besoins ; calculs déterministes distincts de la rédaction par le fournisseur déjà configuré. Pas de chaîne obligatoire ni de nouveau fournisseur.
- Fiabilité : identifiant de demande stable, empreinte de contenu, bail borné, compteur de tentatives et contrôle de concurrence ; résultat et messages enregistrés atomiquement ; aucun rejeu d'action externe.
- Apprentissage : observations et décisions historisées. Une recommandation acceptée ne devient pas une autorisation externe ni une connaissance commune ; aucune adoption automatique.

## Scénario de service à exécuter

Fixture explicitement synthétique : service chargé, réservation modifiée, durée de séjour inconnue, retard client déclaré, absence d'équipe, informations de capacité contradictoires. Attendus : sommer les couverts sans appeler ce total une occupation simultanée, exposer les inconnues et conflits, recommander une vérification au patron, conserver sa décision et le résultat, refuser un accès depuis un autre restaurant/tenant. La fixture et les modèles simulés ne prouvent ni IA réelle ni envoi réel.

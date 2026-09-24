# Déconnexion et reprise de l’onboarding — recette locale du 25 septembre 2026

## Périmètre

Branche `product/onboarding-owner`, base inchangée `a11834385e3e835e3842f1a24eccb32d3b43d764`.
Le correctif OTP local précédent est conservé. Aucun commit, push, déploiement, appel à Preview ou e-mail réel dans cette recette. `main` reste `665ca205111c7937b1e7507137e0af2b3c161c54`.

[Diff incrémental exact : cette demande uniquement, sept fichiers](onboarding-signout-2026-09-25/onboarding-only.diff).
Il s’applique **après** le [correctif OTP local déjà présenté](otp-replacement-2026-09-25/auth-changes.diff), et non directement à la Preview.

## Comportement livré localement

- Menu du profil dès Priorités et sur les six étapes, bouton « Se déconnecter », fermeture du menu par Échap. Disponible aussi si le chargement du brouillon échoue après identification.
- Réponses validées sauvegardées côté serveur ; textes après 800 ms d’inactivité ou à la sortie du champ. Les sauvegardes conservent la protection par numéro de révision.
- Le texte non envoyé de la barre rejoint le brouillon JSON existant (`conversationDraft`, facultatif, 2 000 caractères maximum). Il n’est ni envoyé à l’assistant ni considéré comme une réponse métier confirmée. Aucun changement de table ni migration.
- Déconnexion : attend la requête en cours puis sauvegarde les dernières modifications, y compris celles saisies pendant la requête. Elle utilise ensuite la route existante de révocation de session, puis effectue une navigation complète vers la connexion.
- Pendant cette opération, les interactions sont suspendues. Les requêtes disposent de délais d’expiration ; une panne n’entraîne pas un chargement infini.
- Si la sauvegarde échoue ou rencontre un conflit, aucune déconnexion n’est demandée. Les réponses restent visibles et le mécanisme existant de comparaison des versions est conservé. Aucun écrasement forcé.
- Une réponse de déconnexion perdue est réconciliée par lecture de la session, sans rejouer la demande ni annoncer une fermeture non confirmée.
- À la connexion : « Votre progression a été enregistrée. » Puis reprise depuis les réponses et la position enregistrées sur le serveur. La saisie manuelle d’un établissement reste ouverte si elle avait commencé.
- Aucun nouveau déclenchement OTP. Google, mots de passe et protections existantes demeurent ceux du correctif précédent.
- Aucun bouton de réinitialisation ni effacement ajouté : « Se déconnecter » ne recommence jamais l’onboarding. Une éventuelle réinitialisation reste une opération distincte nécessitant une confirmation explicite.

## Fichiers applicatifs

| Fichier | Rôle |
|---|---|
| `apps/console/components/OnboardingFlow.tsx` | Profil, attente des sauvegardes, révocation, reprise et brouillon de texte |
| `apps/console/components/OnboardingProfile.module.css` | Menu compact, clair et sombre, sans refonte des écrans |
| `apps/console/components/account/AccountFlow.tsx` | Message discret après déconnexion avec progression conservée |
| `apps/console/lib/onboarding-copy.ts` | Message de sauvegarde demandé |
| `packages/contracts/src/index.ts` | Texte non envoyé facultatif dans le JSON existant |
| `services/core-api/src/repository.ts` | Exclut ce brouillon des réponses métier : ne dégrade pas un résultat déjà validé |
| `services/core-api/src/onboarding-session.test.ts` | Révocation effective et reprise par les API publiques |

## Vérifications réellement exécutées

| Vérification | Résultat | Preuve |
|---|---|---|
| Avant correction, menu et déconnexion depuis Priorités | FAIL confirmé | Aucun contrôle correspondant dans le navigateur |
| API : déconnexion, refus de l’ancienne session, même brouillon et réponses après nouvelle connexion | PASS | `onboarding-session.test.ts` |
| Persistance et non-perte des profils existants | PASS | 7 tests `onboarding-persistence.test.ts` |
| Console : logique onboarding, navigation et authentification ciblée | PASS | 33 tests dans cinq suites |
| Types Console, compilation TypeScript API et build Next optimisé | PASS | Commandes locales terminées avec code 0 ; 13 pages générées |
| Navigateur mobile 390 × 844 | PASS pour déconnexion/reprise | [Résultats](onboarding-signout-2026-09-25/browser-results.json) |
| Navigateur ordinateur 1440 × 900 | PASS pour déconnexion/reprise | Mêmes résultats |
| Téléphone physique, tablette physique, Google réel et e-mail réel | NOT_RUN | Hors autorisation de cette recette |
| Publication du correctif | NOT_RUN | Aucun commit, push ou déploiement |

Chaque format a exécuté : inscription fictive → lien dans la boîte simulée → Priorités → modification pendant sauvegarde retardée → déconnexion → refus de l’ancien cookie → nouveau contexte navigateur vide → reprise des priorités et du texte → déconnexion pendant le changement d’étape → établissement retrouvé → saisies conservées → échecs de sauvegarde et conflit → session conservée → nouvelle tentative → déconnexion en erreur puis réponse perdue → reprise → déconnexion/reconnexion aux étapes Systèmes, Connexions, Compléments et Synthèse.

Les erreurs réseau et conflits sont injectés par le script de recette ; les sauvegardes normales et la révocation passent par la vraie API locale et PGlite. La base est isolée et le transport e-mail ne fait aucun envoi externe. Chaque nouveau navigateur simule aussi une adresse réseau de test distincte pour ne pas épuiser en boucle le quota de cinq connexions par quinze minutes ; **les limites du produit ne sont pas modifiées**. Aucune tâche de recette n’est créée dans le compte propriétaire.

## Captures

| Étape | Mobile | Ordinateur |
|---|---|---|
| Menu dès Priorités | [Capture](onboarding-signout-2026-09-25/mobile-01-priorities-menu.png) | [Capture](onboarding-signout-2026-09-25/desktop-01-priorities-menu.png) |
| Priorités et texte repris | [Capture](onboarding-signout-2026-09-25/mobile-02-priorities-resumed.png) | [Capture](onboarding-signout-2026-09-25/desktop-02-priorities-resumed.png) |
| Établissement repris | [Capture](onboarding-signout-2026-09-25/mobile-03-establishment-resumed.png) | [Capture](onboarding-signout-2026-09-25/desktop-03-establishment-resumed.png) |
| Échec de sauvegarde explicite | [Capture](onboarding-signout-2026-09-25/mobile-04-save-error.png) | [Capture](onboarding-signout-2026-09-25/desktop-04-save-error.png) |
| Menu en Synthèse, mode clair | [Capture](onboarding-signout-2026-09-25/mobile-05-review-clear.png) | [Capture](onboarding-signout-2026-09-25/desktop-05-review-clear.png) |

Inspection visuelle : menu lisible dans les deux thèmes, pas de débordement horizontal. Le reste des écrans garde le rendu existant, y compris des contrastes insuffisants déjà présents dans la Synthèse claire : cette recette ne valide pas la direction graphique globale et ne la modifie pas. Le pictogramme de développement Next apparaît dans les captures locales.

## Limites précises

- Chrome macOS avec dimensions simulées : aucune prétention de recette sur téléphone physique ou Safari.
- Parcours d’un compte propriétaire fictif avec un établissement ; reprise multi-établissements et édition concurrente par deux utilisateurs non certifiées ici. Le conflit de révision est vérifié par les tests existants et une erreur 409 injectée dans le navigateur.
- La dictée ou l’envoi actif doit se terminer avant de pouvoir cliquer sur déconnexion. Aucun test de micro physique dans ce lot.
- Les cases d’acceptation juridique finale gardent leur comportement existant : nouvelle confirmation avant finalisation ; ce lot ne réutilise pas silencieusement un consentement non soumis.
- Aucun test réel d’une action destructive « Recommencer » : aucune réinitialisation n’est ajoutée.
- La mémoire canonique distante reste en attente : le connecteur Neon rejette la lecture avec `project_id` déclaré manquant malgré le paramètre fourni. La décision est documentée localement, pas annoncée enregistrée dans PostgreSQL.

## Reproduction locale

[Script navigateur](onboarding-signout-2026-09-25/browser-recipe.cjs) et [API/boîte fictive](onboarding-signout-2026-09-25/local-api.mts). Construire d’abord `@tablenow/contracts`. Démarrer l’API de recette via `tsx` sur 127.0.0.1:4105 et Next local sur 127.0.0.1:3101, puis lancer le script navigateur. Le script utilise Chrome macOS et le runtime Playwright local Codex, sans dépendance ajoutée au produit. Ne pas exposer les routes `__test` de cette fixture sur un environnement public.

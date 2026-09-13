# Import ciblé Google Places — 12 septembre 2026

Autorisation : « On garde que cette partie qui utilise Google Places, et on la copie et on la ramène sur TableNow Copilot. »

Source : tablenow101/tablenowfrontend, Register.tsx ; tablenow101/tablenowbackend, prefill.route.ts. Adaptation au backend Fastify Copilot ; aucun appel ni secret copié depuis le backend historique. Aucun autre parcours importé.

Routes authentifiées et limitées : /v1/onboarding/places/search et /details. Variable serveur requise : GOOGLE_PLACES_API_KEY. Session UUID transmise par paramètre à Details ; requêtes expirantes, erreurs fournisseurs explicites, aucune réponse Google brute journalisée. Reprise manuelle et annuaire français conservés.

Nom, adresse, ville/pays et téléphone préremplissent les champs existants avec confirmation du propriétaire. Site, catégorie et horaires sont affichés comme renseignements Google temporaires, non stockés automatiquement dans un nouveau schéma. Catégorie distincte d'un type de cuisine. Identifiant et coordonnées disponibles via l'adaptateur ; pas de nouvelle table ni copie de la base historique. Recherche déclenchée explicitement, comme dans Copilot, plutôt qu'à chaque frappe.

Vérifications : TypeScript API et console passent. 18 tests API ciblés et 40 tests console passent. Pas de recherche Google réelle attestée : clé absente du processus local. Pas de déploiement effectué. Le parcours navigateur grandeur nature reste une condition de livraison ; aucune réussite simulée ne le remplace.

Conservation Google et attribution : https://developers.google.com/maps/documentation/places/web-service/policies ; revue nécessaire avant activation publique, notamment conservation des champs préremplis dans le brouillon existant. Les données Google ne constituent pas une preuve de propriété du restaurant.

Tentative navigateur : Playwright disponible mais Chromium headless shell absent (exécutable attendu non installé). Verdict grandeur nature : BLOCKED, non exécuté. Aucun succès navigateur revendiqué.

# Hiérarchie de connexion

| Niveau | Méthode | Fiabilité attendue |
|---|---|---|
| 1 | Fonction native TableNow | Maximale et entièrement contrôlée. |
| 2 | API officielle du fournisseur | Forte, avec contrats et événements vérifiables. |
| 3 | Calendrier ou échange de fichiers | Bonne pour des flux délimités. |
| 4 | MCP contrôlé | Bonne si l'outil respecte les permissions TableNow. |
| 5 | Computer Use | Variable, donc surveillée et vérifiée. |
| 6 | Étape humaine guidée | Sûre lorsque l'automatisation ne l'est pas. |

Chaque capacité choisit un chemin principal et un chemin de secours dans `action_routes`.

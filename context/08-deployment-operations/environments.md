# Environnements

| Environnement | Domaine | But | Promotion |
|---|---|---|---|
| Local | `localhost` | Développement avec données fictives | Jamais exposé. |
| Preview | URL Vercel protégée | Validation fonctionnelle et visuelle | Après tests automatisés. |
| Production | Domaine Copilot dédié | Pilote autorisé | Après toutes les portes de sortie. |

Les secrets et données ne circulent pas d'un environnement à l'autre. Une version testée en preview est promue sans modification manuelle du code.

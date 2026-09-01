# Environnements

| Environnement | Domaine | But | Promotion |
|---|---|---|---|
| Local | `localhost` | Développement avec données fictives | Jamais exposé. |
| Preview | URL Vercel protégée | Validation fonctionnelle et visuelle | Après tests automatisés. |
| Production | `https://copilot.tablenow.io` | Pilote public officiel | Après toutes les portes de sortie. |

Les secrets et données ne circulent pas d'un environnement à l'autre. Une version testée en preview est promue sans modification manuelle du code.

Les previews restent protégées et ne sont jamais communiquées comme lien produit. Le pilote est partagé uniquement par le domaine public officiel `copilot.tablenow.io`. L'ancien `app.tablenow.io` reste inchangé jusqu'à la validation complète de la V2 et de son retour arrière.

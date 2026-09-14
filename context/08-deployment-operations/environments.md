# Environnements

| Environnement | Domaine | But | Promotion |
|---|---|---|---|
| Local | `localhost` | Développement avec données fictives | Jamais exposé. |
| Preview | URL Vercel protégée | Validation fonctionnelle et visuelle | Après tests automatisés. |
| Production | `https://os.tablenow.io` | Application officielle | Après toutes les portes de sortie. |
| Preview stable | `https://preview.tablenow.io` | Validation avant production | Jamais fusionnée sans recette. |

Les secrets et données ne circulent pas d'un environnement à l'autre. Une version testée en preview est promue sans modification manuelle du code.

Les previews techniques restent protégées. La validation produit utilise uniquement `preview.tablenow.io`, puis le même état vérifié est promu sur `os.tablenow.io`. L’ancienne adresse `copilot.tablenow.io` redirige vers `os.tablenow.io` et l’ancien projet de test `tablenow-copilot-v2` est archivé après bascule.

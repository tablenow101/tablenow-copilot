# Sécurité de TableNow Copilot

## Signaler une vulnérabilité

Utiliser exclusivement une [alerte de sécurité privée GitHub](https://github.com/tablenow101/tablenow-copilot/security/advisories/new). Ne jamais ouvrir de ticket public contenant un secret, une donnée personnelle, un identifiant de restaurant ou une méthode d'exploitation.

Le signalement doit décrire le risque, les étapes minimales de reproduction, la surface touchée et une proposition de correction si elle est connue. Toute donnée d'exemple doit être fictive.

## Principes appliqués

- Les codes d'accès sont courts, hachés, limités, temporaires et utilisables une seule fois.
- Les sessions utilisent des cookies serveur protégés et les écritures web sont défendues contre le CSRF.
- Chaque donnée métier appartient à une organisation ; l'API et PostgreSQL vérifient indépendamment cette frontière.
- Les outils Copilot, MCP et Computer Use passent toujours par l'API métier.
- Une action sensible exige une validation humaine et laisse une preuve d'audit.
- Les secrets sont injectés au runtime et ne sont jamais compilés dans le navigateur.
- La production refuse les secrets faibles, les codes fixes, les origines génériques et le mode démonstration.

## Version maintenue

La branche `main` reçoit les corrections de sécurité. Une version n'est promue qu'après réussite des contrôles obligatoires et vérification de l'environnement visé.

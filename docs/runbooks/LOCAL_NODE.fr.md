# Exploiter TableNow Node chez un restaurant

## Matériel pilote recommandé

- mini-PC x86_64, 4 cœurs, 16 Go de RAM, SSD 256 Go minimum ;
- Ubuntu Server LTS ou Debian stable ;
- Docker Engine avec le plugin Compose ;
- alimentation protégée et accès physique limité ;
- sauvegarde chiffrée sur un second support ou un coffre S3 compatible.

Le produit fonctionne sans Vercel, Supabase ou modèle IA externe. Le réseau cloud et la synchronisation sont désactivés par défaut.

## Première installation

```bash
./scripts/init-node.sh direction@restaurant.fr
```

Le script crée des secrets aléatoires avec des permissions `0600`, construit les conteneurs, applique les migrations, crée le compte administrateur et vérifie l'interface/API. Le premier code de connexion apparaît dans Mailpit sur `http://localhost:8025`.

Pour une installation sur le réseau du restaurant, modifier `PUBLIC_ORIGIN` dans `deploy/docker/node.env`, configurer le DNS local et placer un reverse proxy TLS de confiance devant le port 8080. Ne jamais exposer PostgreSQL ou Mailpit sur Internet.

## Exploitation

```bash
./scripts/verify-node.sh
./scripts/backup-node.sh
./scripts/update-node.sh
```

- sauvegarde quotidienne ;
- test de restauration mensuel sur une machine distincte ;
- mise à jour après sauvegarde automatique ;
- vérification des journaux `core-api`, `worker` et `proxy` ;
- rotation immédiate des secrets après suspicion de compromission.

## Restauration

```bash
./scripts/restore-node.sh backups/tablenow-AAAA.dump --yes
```

La commande crée d'abord une sauvegarde de sécurité, arrête les composants applicatifs, restaure PostgreSQL, réapplique les permissions du rôle non-superutilisateur, redémarre et vérifie le service.

## Passage au SMTP réel

Remplacer Mailpit par le SMTP transactionnel choisi dans `node.env`, puis retirer l'exposition locale du port 8025. Utiliser une adresse d'envoi vérifiée avec SPF, DKIM et DMARC. TableNow refuse de démarrer en production avec le transport `log` ou un code OTP fixe.

## Hors ligne

L'interface, l'API, les jobs, PostgreSQL, les exports RGPD et le moteur déterministe restent locaux. Une panne Internet ne bloque donc pas le cockpit. Les connecteurs externes doivent être conçus avec file d'attente, idempotence et reprise ; ils ne deviennent jamais la source de vérité locale.

# 017 — mot de passe sans enrôlement imposé

Extension nécessaire au parcours validé : les comptes nouveaux peuvent avoir un mot de passe vérifié sans TOTP obligatoire. Aucune ligne, clé ou facteur existant n’est changé. Les facteurs non nuls restent obligatoires à la connexion et à la récupération.

Retour applicatif : conserver la colonne nullable et revenir à un commit compatible avec les comptes sans facteur. Ne pas redéployer une version qui suppose que tout compte possède un TOTP.

Retour du schéma possible uniquement si `SELECT count(*) FROM account_credentials WHERE totp_secret IS NULL` vaut zéro : `ALTER TABLE account_credentials ALTER COLUMN totp_secret SET NOT NULL;`. Sinon arrêter : ne supprimer aucun compte et ne fabriquer aucun facteur pour permettre ce retour. Sauvegarder la base avant toute opération autorisée.

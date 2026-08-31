# Contribuer à TableNow Copilot

`main` doit rester déployable. Toute évolution passe par une branche courte, une proposition de changement vérifiable et les contrôles automatiques.

## Préparer l'environnement

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm check
```

N'utilise que des données fictives en développement et ne copie jamais un secret réel dans le dépôt.

## Travailler proprement

1. Créer une branche `feat/description`, `fix/description`, `docs/description` ou `chore/description`.
2. Limiter chaque changement à un objectif compréhensible et testable.
3. Ajouter ou adapter les tests en même temps que le comportement.
4. Vérifier ordinateur et mobile pour toute modification d'interface.
5. Mettre à jour `context/` et `docs/` lorsqu'une décision ou un parcours change.
6. Ouvrir une pull request et attendre tous les contrôles obligatoires.
7. Intégrer par squash afin de garder un historique lisible.

## Commandes obligatoires

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit --audit-level=high
```

Une migration de base exige aussi les tests PostgreSQL d'isolation. Une modification Docker exige la validation de Compose et la construction des images.

## Règles de sécurité

- Aucun secret, token, mot de passe ou donnée personnelle dans Git, les logs ou les captures.
- Aucune écriture directe dans PostgreSQL depuis le navigateur, MCP ou Computer Use.
- Toute action sensible conserve l'auteur, le périmètre, l'accord et le résultat.
- Toute migration doit être additive, versionnée, répétable et vérifiée en Preview avant promotion.
- Tout incident de sécurité suit [`SECURITY.md`](SECURITY.md), jamais un ticket public.

## Convention des commits

Utiliser un préfixe explicite : `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:` ou `security:`. Le message décrit le résultat, pas l'outil utilisé.


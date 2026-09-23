# Benchmark authentification TableNow — sources primaires

Date de consultation : 23 septembre 2026  
Périmètre : authentification uniquement ; aucune modification du code applicatif dans cette recherche.  
État local examiné : branche `fix/simple-auth-preview`, commit `7ff9286dc65499dd290346dbc4ad5018910211c3`.

## Verdict

La bonne cible pour TableNow est une **entrée unique “Se connecter ou créer un compte”**, et non deux parcours qui obligent la personne à savoir à l’avance si son adresse existe. L’écran demande l’e-mail (ou propose Google), explique avant l’action qu’un code va permettre **d’accéder au compte ou d’en créer un**, puis décide du parcours seulement après la preuve de contrôle de l’e-mail.

Cette approche est directement étayée par :

- la page actuelle de ChatGPT, qui affiche « Log in or sign up », un seul champ e-mail et un seul bouton « Continue » : [ChatGPT — page officielle d’accès](https://chatgpt.com/auth/login) ;
- Claude, qui demande aux nouveaux utilisateurs un e-mail ou Google, puis utilise le lien reçu pour accéder au **nouveau** compte : [Anthropic — inscription Claude Pro](https://support.anthropic.com/en/articles/8325609-how-do-i-sign-up-for-claude-pro) ;
- Google, dont « Sign in with Google » sert explicitement à créer un nouveau compte ou se connecter à un compte existant, sans nouveau mot de passe : [Google Account Help — Sign in with Google](https://support.google.com/accounts/answer/17304848?hl=en).

Le code e-mail avant la création définitive du compte n’est donc pas une anomalie. Il devient une anomalie lorsque l’interface ne l’explique pas ou lorsqu’un e-mail inconnu reçoit un code puis aboutit à un refus. Pour TableNow, **la création ne doit être finalisée qu’après validation du code**, puis le nom peut être demandé dans une étape courte si Google ne l’a pas fourni.

## Ce que fait réellement le marché

| Produit / autorité | Première visite | Retour | Enseignement applicable à TableNow |
|---|---|---|---|
| ChatGPT / OpenAI | Même porte d’entrée « Log in or sign up » ; e-mail ou fournisseurs sociaux, puis continuation | Même porte d’entrée | Réduire le choix cognitif : un seul accès, le système oriente ensuite. [Source officielle](https://chatgpt.com/auth/login) |
| Claude / Anthropic | E-mail + lien reçu, ou Google ; le lien ouvre le nouveau compte | Google ou nouveau lien e-mail | Un moyen passwordless peut à la fois prouver l’e-mail et créer le compte. [Source officielle](https://support.anthropic.com/en/articles/8325609-how-do-i-sign-up-for-claude-pro) |
| Notion | Code e-mail, mot de passe, Google, Apple, Microsoft ou passkey ; Apple peut créer un compte lors du premier usage | Mêmes méthodes selon le compte et la politique du workspace | Le fournisseur peut créer ou relier le compte, mais l’interface doit expliquer la conséquence. [Source officielle](https://www.notion.com/en-gb/help/log-in-and-out) |
| Slack | Connexion : e-mail, puis passkey, code e-mail ou SSO | Même séquence | Le code est demandé après l’identifiant et non comme configuration de sécurité permanente. [Source officielle](https://slack.com/help/articles/212681477-Sign-in-to-Slack) |
| Slack — nouveau workspace | E-mail ou Apple/Google, code e-mail, puis création du workspace | Sans objet | Quand le produit sépare la création, le CTA et la suite sont explicites. [Source officielle](https://slack.com/help/articles/206845317-Create-a-Slack-workspace) |
| Linear | « Continue with Email » envoie un lien et un code copiable | Même méthode à chaque retour | Offrir lien + code limite les blocages entre appareils sans TOTP obligatoire. [Source officielle](https://linear.app/docs/login-methods) |
| Figma | Écran d’inscription distinct : e-mail + mot de passe, puis vérification | Connexion distincte, Google ou mot de passe | Un parcours séparé reste valable seulement si « Sign up » est immédiatement visible et sans impasse. [Création](https://help.figma.com/hc/en-us/articles/360039811114-Create-a-Figma-account) · [Connexion](https://help.figma.com/hc/en-us/articles/360041064554-Log-in-or-add-accounts) |
| Shopify — marchand | Un nouveau marchand fournit e-mail + mot de passe ou utilise Google/Apple/Facebook | Méthodes du compte, dont passkey ou code selon configuration | La création séparée est annoncée comme telle ; les facteurs renforcés viennent après l’existence du compte. [Source officielle](https://help.shopify.com/en/manual/intro-to-shopify/initial-setup) |
| Shopify — comptes clients | E-mail, puis code à six chiffres | Même entrée | Un flux totalement unifié e-mail + OTP est un modèle reconnu. [Source officielle](https://help.shopify.com/en/manual/customers/customer-accounts/sign-in-options) |
| Google | « Sign in with Google » crée un compte partenaire ou connecte l’existant | Même bouton | Google doit rester une alternative de premier rang, sans demander ensuite un TOTP TableNow. [Source officielle](https://support.google.com/accounts/answer/17304848?hl=en) |
| Stripe | La passkey s’ajoute depuis les réglages après connexion | Passkey en un geste sur l’appareil enregistré | La passkey est une amélioration ultérieure ; elle ne doit pas compliquer la première inscription. [Source officielle](https://stripe.com/blog/passkeys-a-faster-more-secure-way-to-log-in-to-the-stripe-dashboard) |
| Zenchef | La mise en place autonome devient accessible dès la création du compte et guide les premières étapes | Compte utilisateur existant, mot de passe et récupération | Zenchef sépare historiquement comptes et accès, mais insiste sur une prise en main pas à pas après la première connexion. [Mise en place](https://help.zenchef.com/hc/fr/articles/27149421781405-Commencez-avec-Zenchef-la-mise-en-place-de-votre-compte) · [Utilisateurs](https://help.zenchef.com/hc/fr/articles/8594339766173-Gestion-des-utilisateurs) |
| Microsoft | Les méthodes passwordless incluent Authenticator, Windows Hello, clés, SMS ou codes e-mail | Méthode déjà enregistrée | Une méthode forte peut être ajoutée sans faire du QR/TOTP une obligation au premier accès. [Source officielle](https://support.microsoft.com/en-us/accounts-billing/security/how-to-go-passwordless-with-your-microsoft-account) |

## Diagnostic précis de la Preview actuelle

### 1. Le logo est structurellement hors du cadre

Dans `AccountFlow.tsx`, le composant `<Brand />` est rendu dans `<header className="tn-auth-header">`, puis la carte commence dans un élément frère `<section className="tn-auth-card">`. Le logo ne peut donc pas être « dans le cadre » sans changer cette hiérarchie. Le déplacer visuellement par marge ou positionnement ne corrigerait pas le problème de structure.

Décision cible : **la carte contient, dans cet ordre, le logo TableNow, le titre, l’explication, les méthodes d’accès, puis les liens juridiques**. Le fond plein écran reste décoratif ; tout le parcours d’authentification appartient à un seul panneau cohérent. Auth0 recommande qu’une page d’authentification conserve une expérience de marque cohérente et permet de personnaliser ensemble apparence, comportement et textes : [Auth0 Universal Login — personnalisation officielle](https://auth0.com/docs/customize/login-pages/universal-login).

### 2. La première connexion peut aboutir à une impasse

La Preview possède deux routes visibles : `/login` avec `mode="login"` et `/register` avec `mode="signup"`. Côté serveur, `/v1/account/login` envoie néanmoins un code même si l’adresse n’existe pas ; après saisie du bon code, l’absence de compte provoque ensuite un refus générique. La personne a donc prouvé qu’elle contrôle son adresse, mais TableNow ne crée pas son compte et ne l’oriente pas clairement vers la création.

C’est le défaut central relevé par le propriétaire. La correction robuste n’est pas un texte supplémentaire sur l’écran actuel : c’est la suppression de cette bifurcation dans le parcours visible.

### 3. Le système actuel sait déjà créer un compte simple

Le mode `signup` sait demander nom + e-mail, envoyer un code, créer l’utilisateur et sa session après validation, sans mot de passe ni TOTP. Cette base peut être conservée. Il faut unifier l’entrée et déplacer la collecte du nom après la validation du code pour un e-mail nouveau, au lieu de maintenir deux portes qui divergent.

## Parcours cible sans ambiguïté

### Écran 1 — accès unique

- Logo TableNow **dans la carte**, centré, avec sa zone de respiration.
- Titre : **« Se connecter ou créer un compte »**.
- Texte : **« Entrez votre adresse e-mail. Nous vous enverrons un code pour accéder à votre compte ou en créer un. »**
- Bouton prioritaire : **« Continuer avec Google »**.
- Séparateur « ou ».
- Champ visible et étiqueté « Adresse e-mail ».
- CTA unique : **« Continuer »**.
- Aucun mot de passe, QR, TOTP, clé de récupération ou choix préalable « nouveau / existant ».

### Écran 2 — preuve de l’e-mail

- Titre : **« Vérifiez votre e-mail »**.
- Texte : **« Nous avons envoyé un code à [adresse]. »**
- Six chiffres dans une saisie compatible collage et remplissage automatique (`autocomplete="one-time-code"`).
- Actions : **« Continuer »**, **« Renvoyer le code »**, **« Modifier l’adresse »**.
- États distincts : code incorrect, code expiré, délai avant renvoi, envoi indisponible.

Linear fournit à la fois un lien et un code dans l’e-mail ; c’est un bon second niveau d’amélioration pour passer facilement du téléphone à l’ordinateur : [Linear — méthodes de connexion](https://linear.app/docs/login-methods). Il n’est pas nécessaire à la première correction si l’e-mail TableNow ne contient actuellement qu’un code.

### Après validation du code

- **Compte existant** : création immédiate de la session et retour vers la destination attendue.
- **Adresse nouvelle** : court écran **« Comment devons-nous vous appeler ? »**, puis création du compte, confirmation professionnelle **« Votre compte TableNow est prêt »**, et lancement de l’onboarding.
- **Google** : si l’identité et l’e-mail vérifié sont nouveaux, création du compte puis onboarding ; s’ils existent, connexion. C’est le rôle explicitement décrit par Google pour son bouton : [Google Account Help](https://support.google.com/accounts/answer/17304848?hl=en).

Cette distinction intervient **après** la preuve de contrôle de l’e-mail. Elle ne révèle donc pas publiquement si une adresse possède déjà un compte.

## Sécurité et erreurs à conserver

- Avant validation de l’e-mail, ne jamais indiquer « ce compte existe » ou « ce compte n’existe pas ». OWASP recommande des réponses génériques pour la connexion, la récupération et même l’inscription afin d’éviter l’énumération des comptes : [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
- Conserver un code court à durée limitée, à usage unique, avec limitation des essais et des envois. NIST exige une limitation effective des tentatives lorsque le secret a une faible entropie et précise qu’un OTP n’est pas résistant au phishing : [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html).
- Ne pas présenter l’OTP e-mail comme la sécurité maximale. Les passkeys peuvent être proposées plus tard aux comptes établis ; Google et Stripe les présentent comme une méthode plus simple et plus résistante au phishing : [Google Passkeys](https://www.google.com/account/about/passkeys/) · [Stripe Passkeys](https://stripe.com/blog/passkeys-a-faster-more-secure-way-to-log-in-to-the-stripe-dashboard).
- Conserver les protections déjà présentes : cookie de challenge HttpOnly, expiration, consommation unique, contrôles d’origine, plafond de tentatives, plafond d’envoi par destinataire et session HttpOnly.
- Afficher des libellés persistants et des instructions reliées aux champs. W3C demande que les contrôles aient des labels décrivant leur fonction et que les formats ou exigences utiles soient expliqués : [W3C — labels](https://www.w3.org/WAI/tutorials/forms/labels/) · [W3C — instructions](https://www.w3.org/WAI/tutorials/forms/instructions/).
- Après un échec inattendu, montrer une action récupérable (« Réessayer », « Renvoyer », « Modifier l’adresse ») et conserver l’e-mail saisi. Les détails techniques restent dans les journaux, jamais dans l’interface : [OWASP REST Security — error handling](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).

## Décision d’implémentation recommandée

1. Remplacer les deux portes visibles `/login` et `/register` par la même expérience d’accès ; les deux URLs peuvent rediriger vers cette expérience pour préserver les liens existants.
2. Créer un seul dessein serveur `access` : envoyer le code sans révéler l’existence du compte, puis, après vérification, connecter l’utilisateur existant ou démarrer la création du nouveau compte.
3. Demander le nom uniquement après validation d’une adresse nouvelle ; ne jamais créer un compte avant la preuve de l’e-mail.
4. Déplacer `Brand` à l’intérieur de la carte et supprimer le header de marque séparé sur cet écran.
5. Garder Google comme alternative équivalente, sans TOTP TableNow obligatoire après Google.
6. Conserver les garde-fous existants et ajouter des tests explicites pour : nouvelle adresse, compte existant, Google nouveau/existant, code faux, code expiré, renvoi, actualisation et retour arrière.

## Critères d’acceptation bloquants

- Une personne qui ne connaît pas TableNow comprend avant le clic qu’elle peut se connecter **ou créer son compte**.
- Une adresse nouvelle ne termine jamais par « informations incorrectes » après saisie du bon code.
- Une adresse existante n’est pas révélée avant validation de l’e-mail.
- Le logo officiel est physiquement dans le même composant de carte que le formulaire sur téléphone, tablette et ordinateur.
- La création ne demande ni mot de passe, ni TOTP, ni QR, ni codes de secours.
- Le retour avec le même e-mail demande un nouveau code et ouvre le compte existant sans dupliquer utilisateur ou établissement.
- Google crée ou ouvre le même compte selon l’identité vérifiée, sans compte dupliqué.
- Chaque erreur propose une action claire, et aucun rechargement ne transforme silencieusement une inscription en connexion impossible.
- Le parcours est utilisable au clavier, avec lecteur d’écran, collage du code et remplissage automatique mobile.

## Sources primaires retenues

1. [OpenAI — page actuelle « Log in or sign up »](https://chatgpt.com/auth/login)
2. [OpenAI — vérification supplémentaire à la connexion](https://help.openai.com/en/articles/9889414)
3. [Anthropic — accès à un nouveau compte Claude par e-mail ou Google](https://support.anthropic.com/en/articles/8325609-how-do-i-sign-up-for-claude-pro)
4. [Zenchef — première mise en place du compte](https://help.zenchef.com/hc/fr/articles/27149421781405-Commencez-avec-Zenchef-la-mise-en-place-de-votre-compte)
5. [Zenchef — gestion des utilisateurs](https://help.zenchef.com/hc/fr/articles/8594339766173-Gestion-des-utilisateurs)
6. [Notion — méthodes de connexion](https://www.notion.com/en-gb/help/log-in-and-out)
7. [Slack — connexion](https://slack.com/help/articles/212681477-Sign-in-to-Slack)
8. [Slack — création d’un workspace](https://slack.com/help/articles/206845317-Create-a-Slack-workspace)
9. [Linear — méthodes de connexion](https://linear.app/docs/login-methods)
10. [Figma — création de compte](https://help.figma.com/hc/en-us/articles/360039811114-Create-a-Figma-account)
11. [Figma — connexion et ajout de comptes](https://help.figma.com/hc/en-us/articles/360041064554-Log-in-or-add-accounts)
12. [Shopify — première configuration marchand](https://help.shopify.com/en/manual/intro-to-shopify/initial-setup)
13. [Shopify — comptes clients avec code à six chiffres](https://help.shopify.com/en/manual/customers/customer-accounts/sign-in-options)
14. [Google — créer un compte partenaire ou se connecter avec Google](https://support.google.com/accounts/answer/17304848?hl=en)
15. [Stripe — passkeys après connexion](https://stripe.com/blog/passkeys-a-faster-more-secure-way-to-log-in-to-the-stripe-dashboard)
16. [Microsoft — méthodes passwordless](https://support.microsoft.com/en-us/accounts-billing/security/how-to-go-passwordless-with-your-microsoft-account)
17. [Auth0 — personnalisation cohérente de Universal Login](https://auth0.com/docs/customize/login-pages/universal-login)
18. [NIST SP 800-63B — OTP, durée et limitation des essais](https://pages.nist.gov/800-63-4/sp800-63b.html)
19. [OWASP — Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
20. [W3C WAI — labels de formulaires](https://www.w3.org/WAI/tutorials/forms/labels/)
21. [W3C WAI — instructions de formulaires](https://www.w3.org/WAI/tutorials/forms/instructions/)


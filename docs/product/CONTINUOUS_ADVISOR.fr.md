# TableNow — onboarding accompagné et Advisor continu

Statut : spécification produit validée, à relire avant plan d’implémentation.

Source : validations explicites du propriétaire du 16 septembre 2026.

## 1. Résultat attendu

TableNow accompagne le restaurateur avant, pendant et après chaque service. Le produit ne se contente jamais d’afficher des rubriques ou d’attendre une question : il explique la prochaine étape, propose des recommandations pertinentes et laisse toujours la décision au restaurateur.

Le restaurant ne part jamais de zéro. Avant de disposer de données propres à l’établissement, TableNow mobilise sa base de connaissances commune sur la restauration. Les informations du restaurant, ses connexions, son historique, ses décisions et leurs résultats rendent ensuite les recommandations progressivement plus personnelles.

## 2. Règles non négociables

- L’ancien écran d’accueil photographique est retiré du parcours actif.
- Sur le web, l’entrée mène à l’authentification. Sur téléphone et tablette, une apparition très courte du logo officiel peut précéder l’authentification.
- L’onboarding commence par les enjeux prioritaires, puis identifie l’établissement et son fonctionnement réel.
- L’onboarding ne se termine pas avant d’avoir demandé quels systèmes, logiciels et canaux le restaurant utilise.
- Le restaurateur peut terminer le socle indispensable en moins de cinq minutes, puis poursuivre une configuration progressive dans le cockpit.
- Toute information saisie est sauvegardée et reprise sans perte.
- TableNow conseille et prépare ; les décisions sensibles restent celles du restaurateur.
- Aucun état vide ne laisse l’utilisateur sans explication ni prochaine action.
- La même logique existe sur ordinateur, téléphone et tablette, avec une composition réellement adaptée à chaque format.

## 3. Parcours initial obligatoire

### 3.1 Authentification

- Connexion ou création de compte.
- Vérification de l’e-mail et second facteur selon les règles de sécurité actives.
- Confirmation claire de chaque réussite et explication actionnable de chaque erreur.

### 3.2 Enjeux prioritaires

- Présenter tous les enjeux validés.
- Permettre une sélection individuelle, « Tout sélectionner » et « Tout désélectionner ».
- Conserver la possibilité de parler, écrire ou joindre un document.

### 3.3 Établissement

- Recherche spécialisée Google Places uniquement à cette étape.
- Confirmation de l’établissement ou ajout manuel.
- Retour possible pour corriger un mauvais choix.

### 3.4 Fonctionnement et systèmes existants

TableNow demande ce que le restaurant utilise réellement :

- réservations : Zenchef, SevenRooms, TheFork, OpenTable, autre, aucun ou combinaison ;
- point de vente et caisse : fournisseur utilisé, autre, aucun ou fonctionnement hybride ;
- calendriers et organisation : Google Calendar, autre outil, papier ou aucun ;
- communications : e-mail, SMS, téléphone, WhatsApp, Instagram, Messenger et autres canaux approuvés ;
- équipe : rôles, services, horaires et personnes à inviter ;
- règles particulières : validations, horaires, périodes de fermeture et exceptions utiles.

Les réponses déterminent immédiatement la checklist de connexion. TableNow ne présente pas une liste générique d’intégrations inutiles.

### 3.5 Compléments libres

- Question : « Avons-nous oublié quelque chose ? »
- Plusieurs idées, besoins, notes vocales et documents peuvent être ajoutés.
- Aucun passage automatique à l’écran suivant.
- Le CTA « J’ai terminé » clôt explicitement cette étape.

### 3.6 Synthèse

- Afficher les priorités, l’établissement, le fonctionnement, les systèmes détectés, les informations confirmées et ce qui reste à compléter.
- Chaque ligne pertinente est modifiable.
- Le CTA final ouvre le cockpit et conserve les éléments non terminés dans la checklist accompagnée.

## 4. Connexions guidées en un clic

Chaque système pertinent suit le même cycle visible :

1. **À connecter** — TableNow explique brièvement la valeur et les informations qui seront partagées.
2. **Connecter** — OAuth ou parcours officiel lorsque disponible ; méthode alternative encadrée uniquement lorsqu’elle a été approuvée.
3. **Autoriser** — permissions demandées de manière compréhensible.
4. **Tester** — vérification réelle de l’accès et d’un échange non destructif.
5. **Connecté** — fournisseur, compte ou établissement relié, date de dernière synchronisation et périmètre visible.
6. **À reconnecter** — cause exacte, conséquences et action directe lorsqu’une autorisation expire ou qu’une synchronisation échoue.

Une redirection terminée ou un secret enregistré ne suffit jamais à afficher « Connecté ». Le succès exige une vérification réelle.

## 5. Confirmation et notifications

Après une réussite :

- animation courte et discrète ;
- message précis, par exemple « Zenchef est connecté avec succès » ;
- badge persistant « Connecté » ;
- date de dernière synchronisation ;
- action « Tester la connexion » ;
- inscription dans l’historique des notifications.

Le centre de notifications regroupe : connexions réussies, connexions interrompues, invitations acceptées, synchronisations, informations manquantes et événements nécessitant une décision. Une notification lue reste retrouvable dans l’historique.

## 6. Advisor permanent

### 6.1 Socle de connaissance commun

Avant toute donnée propre au restaurant, TableNow dispose de recommandations dans tous les domaines couverts : réservations, accueil, salle, communication, équipe, organisation, rentabilité, remplissage, clientèle, achats, incidents et obligations applicables validées dans la base de connaissances.

Ces recommandations sont présentées comme des pratiques générales adaptées au contexte déclaré, jamais comme des conclusions calculées sur des données absentes.

### 6.2 Personnalisation progressive

- **Knowledge seul** : conseils de référence fondés sur le type de restaurant, les priorités déclarées et les pratiques reconnues.
- **Premières données** : conseils contextualisés, clairement signalés comme préliminaires.
- **Historique suffisant** : recommandations fondées sur les tendances et résultats propres à l’établissement.

Le niveau de personnalisation et les sources mobilisées doivent être compréhensibles par le restaurateur.

### 6.3 Avant, pendant et après

- **Avant** : préparation, risques prévisibles, informations manquantes et actions à envisager.
- **Pendant** : situation actuelle, alertes réellement utiles et options de décision.
- **Après** : synthèse, écarts observés, résultats et apprentissages proposés.

Chaque recommandation indique au minimum : pourquoi elle apparaît, sur quoi elle repose, l’impact attendu, son horizon temporel et la décision éventuelle attendue du restaurateur.

### 6.4 Présence dans tout le produit

- Le cockpit donne la vision globale : maintenant, ensuite, recommandations et points à décider.
- Chaque département montre ses conseils contextuels et sa prochaine étape.
- Les états vides utilisent le knowledge commun et accompagnent la première configuration.
- La barre universelle permet de parler, écrire et joindre un document, mais ne remplace jamais les conseils visibles dans l’interface.

## 7. Barre universelle

- Une seule barre identique dans tout le produit.
- `+` à gauche pour les documents.
- Zone de texte centrale.
- Microphone et flèche d’envoi à droite.
- État d’écoute, transcription et traitement dans la même barre.
- Format compact par défaut, réductible et ne masquant jamais le contenu.
- Position et zones tactiles adaptées au téléphone, à la tablette et à l’ordinateur.

## 8. Profils internes

- Le propriétaire et chaque membre du personnel peuvent ajouter et recadrer une photo.
- Initiales affichées si aucune photo n’est fournie.
- Chaque profil peut contenir le nom, le poste, le rôle, la langue, les horaires utiles et les droits.
- Les photos et profils servent strictement à l’usage et à la communication internes.
- Aucune photo ni donnée de profil n’est publiée ou montrée aux clients.
- Le membre gère sa photo ; le propriétaire ou un administrateur gère les droits et l’appartenance au restaurant.

## 9. États obligatoires de chaque écran

Chaque domaine doit définir et tester :

- démarrage sans données propres ;
- configuration incomplète ;
- connexion en cours ;
- connexion réussie ;
- connexion ou synchronisation en erreur ;
- premières données ;
- données suffisantes ;
- données anciennes ou indisponibles ;
- accès non autorisé ;
- reprise après interruption.

## 10. Critères d’acceptation

- Un nouveau restaurateur comprend la prochaine action sans documentation externe.
- Le socle obligatoire peut être terminé en moins de cinq minutes hors autorisations de fournisseurs externes.
- Les outils déclarés génèrent une checklist personnalisée.
- Aucune connexion n’est déclarée réussie sans test réel.
- Le cockpit n’est jamais vide de conseil : le knowledge commun prend le relais des données absentes.
- Un conseil général n’est jamais présenté comme une analyse des données propres du restaurant.
- La barre universelle reste compacte et utilisable sur tous les écrans.
- Les photos restent strictement internes.
- Le retour arrière, la reprise, les erreurs et les expirations sont compréhensibles.
- Les parcours complets sont testés dans un navigateur sur ordinateur et mobile avec preuves.

## 11. Ordre d’implémentation

1. Figer les contrats d’écran et retirer les éléments contradictoires.
2. Recomposer l’onboarding autour des priorités, de l’établissement et des systèmes utilisés.
3. Construire le registre d’intégrations et leurs états vérifiables.
4. Remplacer la barre actuelle par le composant universel compact.
5. Mettre en place le moteur de conseils à trois niveaux de personnalisation.
6. Intégrer les conseils au cockpit et à chaque département.
7. Ajouter notifications, profils internes et photos.
8. Exécuter les scénarios complets desktop/mobile avant promotion.


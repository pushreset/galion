# Broadside: idées de mécaniques

Backlog d'idées pour la suite. Coût : **S** = quelques heures, **M** = une demi-journée, **L** = plus d'une journée.

## Recommandé en premier

1. **Vent réel** : le meilleur rapport profondeur/coût, toute la navigation devient intéressante.
2. **Prime sur ta tête + boss** : de la tension et des pics de rythme, au lieu d'un simple compteur de vagues.
3. **Boutique** : à combiner avec n'importe laquelle, pour que l'or serve enfin à quelque chose.

## Profondeur tactique

| Idée | Ce que ça apporte | Coût |
|---|---|---|
| **Vent réel** | La vitesse dépend de l'angle au vent : rapide vent de travers, lent face au vent. Flèche de vent sur la boussole. Se placer devient un vrai choix (poursuivre un marchand, fuir). | S |
| **Dégâts localisés** | Voiles touchées = plus lent, canons touchés = recharge plus lente, coque = points de vie. Les boulets ramés visent les voiles. | M |
| **Tirs télégraphiés** | Le fort et les gros navires tirent au mortier : un cercle rouge apparaît sur l'eau, puis l'impact. On les esquive en manœuvrant. | S |

## Fantasme pirate

| Idée | Ce que ça apporte | Coût |
|---|---|---|
| **Cartes au trésor** | Les marchands lâchent parfois un morceau de carte. 3 morceaux révèlent une croix sur une île ; tu accostes et tu récupères un coffre. Une raison d'explorer. | M |

## Progression et rythme

| Idée | Ce que ça apporte | Coût |
|---|---|---|
| **Prime sur ta tête** | Plus tu coules la marine, plus la prime monte (1 à 5 étoiles). Des chasseurs de primes d'élite arrivent, mais l'or est multiplié. Risque contre récompense. | S |
| **Boss toutes les 5 vagues** | Un vaisseau amiral avec plusieurs phases, des barrages de mortier, des renforts, et un butin énorme. | M |
| **Boutique au port** | Une île-port où accoster entre les vagues : réparer, acheter des améliorations ou des compétences. | M |
| **Progression entre parties** | Des doublons gardés d'une partie à l'autre débloquent bateaux, compétences et couleurs de voiles. Plus un meilleur score. | M |

## Événements et ambiance

| Idée | Ce que ça apporte | Coût |
|---|---|---|
| **Météo** | Tempête (houle, éclairs, mer qui bouge le bateau), brouillard (boussole réduite, ennemis qui surgissent), calme plat (vent nul). | M |

## Abordage

Aujourd'hui : `Espace` au contact, capture automatique sous 20 % de coque, sinon une barre de timing avec le monde en pause. En ligne il n'y a pas de pause, donc pas de barre : seuls les navires rendus sont abordables. Les pistes ci-dessous cherchent d'abord à supprimer cette pause, pour avoir la même règle en solo et en ligne.

| Idée | Ce que ça apporte | Talent testé | En ligne | Coût |
|---|---|---|---|---|
| **1. Mêlée en temps réel, navires liés** | Grappins posés, les deux coques dérivent ensemble. Les manches de `boardRound` tombent toutes les 0,6 s environ, sans figer le monde : les autres ennemis continuent de tirer. Le joueur choisit de tenir ou de couper les grappins (`Espace` à nouveau). | Gestion du risque | Oui | M |
| **2. La manœuvre fait la qualité** | Plus de barre : `q` se calcule à l'accroche. Flanc contre flanc à vitesses proches, `q` haut ; arrivée de travers ou trop vite, `q` bas (ou éperonnage). | Pilotage | Oui | S |
| **3. Grappin lancé** | `Espace` tire un grappin à 12 de portée environ. Touché : une corde, puis un treuil qui rapproche les navires pendant 3 s. La corde casse si la distance ou l'angle dérape, donc il faut tenir un cap parallèle. Les boulets ramés ralentissent la cible. En PvP, la victime casse la corde en virant. | Visée et tenue de cap | Oui | M |
| **4. Moral : l'abordage se gagne au canon** | Une jauge de moral par ennemi : coque, équipage, alliés proches. Nouvelle munition, la mitraille : peu de dégâts à la coque, beaucoup à l'équipage. Moral à zéro : pavillon blanc, capture sans mini-jeu. C'est la règle des 20 % généralisée. | Choix de munition | Oui | M |
| **5. Ordres en pierre-feuille-ciseaux** | Trois manches, trois ordres : la charge bat les mousquets, les mousquets battent le retranchement, le retranchement bat la charge. L'ennemi annonce son ordre selon son type (marine : mousquets, marchand : retranchement). | Lecture de l'adversaire | Avec un chrono | M |
| **6. Détachement d'abordage** | Maintenir `Espace` charge le nombre d'hommes envoyés. Plus d'hommes : mêlée plus sûre, mais recharge plus lente à bord (`crewMul` existe déjà). Prise gagnée : l'équipage de prise reste dessus, le navire devient une escorte (`guardSteer`) ou se ramène au port. | Répartition de l'équipage | Oui | M |

Recommandé : **2 et 1 ensemble**. `boardRound(b, q)` prend déjà un `q` entre 0 et 1 : il suffit de le calculer depuis l'angle et la vitesse relative, puis de faire tomber les manches en temps réel, navires liés. La barre et la pause disparaissent, et il reste moins de code qu'aujourd'hui. Ensuite la mitraille (4), si l'équipage doit devenir une vraie cible. L'idée 5 est la moins bonne : elle garde un écran à part et casse le rythme naval.

Liens avec la section suivante : l'éperonnage ouvre l'abordage (2), le sabordage presse le joueur une fois le pavillon blanc hissé (4), l'officier Grappins double la portée (3), le Mousquetaire tue de l'équipage avant le contact (4), le remorquage prolonge la prise (6).

## Inspiré de Pirates du Nouveau Monde

Le jeu de plateau qui a donné l'envie de Broadside : *Pirates of the Spanish Main* (WizKids, 2004), vendu en France par Asmodée. Navires à monter, un mât par point de vie, or à ramener à son île de départ. Sources lues : règles avancées en français, règles de *Davy Jones' Curse* (terrains, mots-clefs), récapitulatif des équipages et événements (30 pages), [fiche G-Fig](https://g-fig.fr/jeu-416-pirates_of_the_spanish_main_pirates_du_nouveau_monde.html). Pas lues : les règles des forts et la liste complète des mots-clefs.

On reprend les mécaniques, pas les noms de navires, de personnages ni les illustrations.

Ordre conseillé : mâts qui tombent, puis or en cale et dépôt au port, puis récif et sargasses, puis choix d'équipage, puis éperonnage et bout portant, puis remorquage.

### Dégâts et prises

| Idée | Dans l'original | Dans Broadside | Coût |
|---|---|---|---|
| **Mâts qui tombent** | Chaque touche retire un mât, et le canon qui va avec. Le pion montre son état. | Un mât tombe à chaque palier de coque, avec un canon par bord en moins. Remplace « Dégâts localisés ». | M |
| **Ponton** | À zéro mât, le navire ne coule pas : il dérive, et coule au tir suivant. | Déjà proche de « amène ses couleurs » sous 20 % de coque. | fait |
| **Sabordage** | Le propriétaire d'un ponton tente de le couler (5 ou 6 au dé) pour ne pas le laisser prendre. | Un ennemi rendu se saborde après quelques secondes : il faut l'aborder vite. | S |
| **Remorquage** | Toucher un ponton permet de le remorquer : il passe dans ta flotte, ta vitesse tombe au minimum. | Prise remorquée jusqu'au port contre beaucoup d'or, en étant lent. Ou la prise t'escorte (`guardSteer` existe déjà). | M |
| **Éperonnage** | Proue au contact : un dé contre les mâts restants, puis les deux navires sont bloqués. | Dégâts de proue selon la vitesse dans `collideShips`. Ouvre l'abordage. | S |
| **Butin d'abordage au choix** | Le gagnant choisit : tuer un équipage ou voler un trésor. | Après un abordage gagné : or, recrues ou garder le navire. | S |
| **Bordée à bout portant** | Portée réduite, un seul dé : tous les canons touchent, plus une touche en prime. | Bonus de dégâts quand la cible est tout près. | S |
| **Feu qui se propage** | Un mât en feu. À chaque tour, un dé par mât : 6 l'éteint, 1 à 3 en allume un autre. Tout en feu, le navire se saborde. | Le tir incendiaire s'étend au lieu de brûler à taux fixe ; s'éteint au port. | S |

### Or et trésors

| Idée | Dans l'original | Dans Broadside | Coût |
|---|---|---|---|
| **Or en cale** | L'or ne compte qu'une fois déposé sur l'île de départ. Un navire coulé partage sa cargaison : moitié pour le tireur, moitié pour le propriétaire. | L'or ramassé n'est acquis qu'au port. Coulé, tu en perds la moitié. Va avec « Boutique au port ». | M |
| **Course au trésor** | Le premier à ramener plus de la moitié de l'or en jeu gagne. | Mode PvP en plus des 10 coulés. | M |
| **Îles au trésor** | Trésors face cachée sur les îles sauvages, de valeur inconnue. Explorer coûte l'action du tour. | Mouiller quelques secondes près d'une île donne un coffre. On est vulnérable pendant ce temps. Plus simple que « Cartes au trésor ». | M |
| **Reliques** | Trésors uniques : valeur nulle, effet spécial, obligatoires pour le premier arrivé. | Bonus ou malédiction tirés au hasard dans un coffre. | S |
| **Épaves** | Un navire brisé sur un récif reste en obstacle et peut être exploré. | Un navire coulé près d'un haut-fond laisse une épave à piller. | S |

### Terrain

| Idée | Dans l'original | Dans Broadside | Coût |
|---|---|---|---|
| **Récif** | Un dé contre le nombre de mâts d'origine : les gros navires perdent des mâts, les petits passent. | Hauts-fonds : le sloop passe, le galion s'abîme. Une route de fuite. | S |
| **Sargasses** | L'inverse : les petits navires restent pris, les gros passent. | Algues qui freinent le sloop, pas le galion. | S |
| **Banc de brouillard** | Un navire dedans est « perdu » : il ne tire pas, on ne le vise pas, il ressort par un bord tiré au dé. | Banc de brume où se cacher. Recoupe « Météo ». | S |

### Ennemis

| Idée | Dans l'original | Dans Broadside | Coût |
|---|---|---|---|
| **Navire tortue** | Des plaques d'armure sautent avant les mâts. Inabordable tant qu'il en reste. | Ennemi blindé : casser l'armure avant de toucher la coque. | M |
| **Navire fantôme** | En forme spectrale, traverse îles et navires, mais ne peut pas accoster. | Ennemi qui passe à travers les îles par intermittence. | M |
| **Galère** | Rame encore une fois démâtée, ne peut pas être bloquée, pivote sur place. | Ennemi d'abordage qui avance encore une fois désemparé. | M |
| **Monstre qui plonge** | Immergé, le monstre marin ne fait que bouger et ne peut pas être visé. | Le kraken plonge entre deux frappes. | S |
| **Peur** | Un navire proche perd ses capacités (5 au dé) ou sa vitesse (6). | Aura du boss : compétences bloquées à courte distance. | S |

### Factions

Dans l'original, chaque navire et chaque équipage appartient à une nation, et porte son pavillon à la poupe. Trois nations dans la boîte de base (Angleterre, Espagne, Pirates), puis France, États-Unis, Barbaresques, Rébellion de Jade, Maudits, Vikings et Mercenaires au fil des extensions. Les règles qui en découlent :

- Une flotte peut mélanger les nations, mais un équipage n'utilise sa capacité que sur un navire de sa nation. Quelques personnages lèvent cette limite pour une nation donnée.
- Beaucoup d'équipages ont +1 au tir contre une nation précise, ou contre tout ce qui n'est pas de la leur.
- Un équipage à « marque noire » peut passer chez les Maudits pour 1 point de plus : son navire change de pavillon.
- Un mercenaire monte sur n'importe quel navire, qui ne peut alors plus accoster son île de départ.

Dans Broadside, deux usages :

| Idée | Ce que ça apporte | Coût |
|---|---|---|
| **Pavillon du joueur** | Sur l'écran de choix, un pavillon en plus du bateau : un bonus passif, une couleur à la poupe, et les officiers de ce pavillon à plein effet (les autres à effet réduit ou plus chers). Donne une raison de rejouer le même bateau autrement. | M |
| **Vagues par nation** | Chaque vague arrive sous un pavillon, avec son comportement. On lit le pavillon de loin et on sait à quoi s'attendre. | M |
| **Ennemi juré** | Un bonus de dégâts contre une nation, gagné en carte de refit ou avec l'officier « Chasseur ». | S |
| **Marque noire** | En cours de partie, une carte propose de passer sous pavillon maudit : nouveaux pouvoirs, mais la marine envoie plus de monde. Va avec « Prime sur ta tête ». | M |

Style de chaque faction. Ce que dit l'original est maigre : seuls les Barbaresques (abordage), les Maudits (fantômes, monstres, peur), les Vikings (chasseurs de monstres) et les Mercenaires ont un style net dans les sources lues. Le reste de la colonne de droite est une proposition.

| Faction | Dans l'original | Dans Broadside |
|---|---|---|
| **Pirates** | Nation du joueur type. Voleurs de trésor, capitaines qui sacrifient un équipage contre une action. | Pavillon par défaut : plus d'or, abordage plus facile. |
| **Angleterre** | Une des trois nations de base. | Marine de ligne : canons précis, formations serrées. |
| **Espagne** | Une des trois nations de base. Plusieurs équipages à cale agrandie ou à déchargement facilité. | Galions lourds et riches : lents, beaucoup d'or. |
| **France** | Ajoutée en extension. Un corsaire qui aborde à distance. | Corsaires rapides : frappent et repartent. |
| **États-Unis** | Ajoutés en extension. Infanterie de marine, bonus contre les Barbaresques. | Frégates solides : coque épaisse, mousquets de près. |
| **Barbaresques** | Leur marque : l'abordage. Galères, capture d'équipage contre rançon. | Galères qui foncent à l'éperon et abordent. |
| **Rébellion de Jade** | Jonques (les mâts ne gênent pas le tir), navire tortue. | Jonques qui tirent sous tous les angles, tortues blindées. |
| **Maudits** | Navires fantômes, monstres marins, peur, vaudou. | Vagues de nuit : fantômes qui traversent les îles, kraken à leurs côtés. |
| **Vikings** | Chasseurs de monstres, ennemis des Maudits. | Drakkars à l'éperon. Pavillon joueur : bonus contre le kraken. |
| **Mercenaires** | Vont sur tout navire, qui ne peut plus rentrer à son île. | Chasseurs de primes : les élites de « Prime sur ta tête ». |

Commencer par trois, comme la boîte de base : Pirates pour le joueur, Angleterre et Espagne en face.

### Choix d'équipage

Dans l'original, chaque équipage coûte des points, prend une place en cale, et le total des équipages ne dépasse pas le coût du navire. Il reste face cachée jusqu'à son premier usage. Deux équipages « liés » sur le même navire donnent une place de cale en plus.

Dans Broadside : après le choix du bateau, un écran « Équipage » avec un budget de points (6 pour commencer) et des emplacements selon la coque (Wasp 2, Corsair 3, Leviathan 4). Un officier s'écrit comme une ligne d'`UPGRADES` avec un coût (`{ id, label, cost, apply }`), appliqué dans `makePlayer`. En ligne, les ids partent dans le message `ship`. Coût : **M** pour l'écran et les officiers de base, **S** par officier ensuite.

Officiers de base (les communs de l'original, coût entre parenthèses) :

| Officier | Dans l'original | Dans Broadside |
|---|---|---|
| **Timonier** (2) | Déplacement de base allongé. | Plus de vitesse et de virage. |
| **Canonnier** (2) | Relance un tir raté par tour. | Boulets moins dispersés. |
| **Capitaine** (3) | Se déplacer et tirer dans la même action. | Recharge plus rapide. |
| **Mousquetaire** (3) | Un canon de courte portée en plus, indestructible. | Salve de mousquets automatique de près : tue de l'équipage avant l'abordage. |
| **Rameur** (1) | Un navire démâté bouge encore. Ne prend pas de place. | Vitesse plancher : les ralentissements sont plafonnés. |
| **Charpentier** (2) | Répare en mer ou sur n'importe quelle île. | Réparation hors combat sans attendre. |
| **Explorateur** (1) | Accoste et explore dans la même action. | Fouille d'île deux fois plus rapide. |
| **Boulets ramés** (2) | La cible touchée ne bouge plus au tour suivant. | Compétence Chain shot offerte ou plus vite rechargée. |
| **Pot à feu** (2) | Met le feu à un mât. | Compétence Fire shot offerte ou plus vite rechargée. |
| **Fumigène** (3) | Pose un banc de brouillard à courte portée. | Compétence Smoke screen offerte ou plus vite rechargée. |
| **Pot pourri** (2) | L'équipage visé perd sa capacité au tour suivant. | Nouveau tir : la cible ne peut plus lancer de compétence pendant quelques secondes. |

Officiers rares (les personnages nommés de l'original, ramenés à leur effet) :

| Officier | Dans l'original | Dans Broadside |
|---|---|---|
| **Chirurgien** (5) | Un équipage qui devait mourir survit. | Pertes d'équipage sous le feu divisées par deux. |
| **Maître d'abordage** (3-4) | +1 aux jets d'abordage. | Barre de QTE plus large, ou plus de pertes infligées par manche. |
| **Grappins** (5-7) | Aborde à courte portée sans éperonner. | Portée d'abordage doublée. |
| **Ravisseur** (10) | Capture l'équipage adverse au lieu de le tuer : il vaut son coût en or au port. | Les prisonniers d'un abordage rapportent une rançon. |
| **Maître canonnier** (5) | Tous les canons à longue portée. | Plus de portée. |
| **Chasseur** (3-4) | +1 au tir contre une nation, ou contre les forts. | Plus de dégâts contre un type d'ennemi : marine, marchands, fort, kraken. |
| **Amiral** (5-6) | Sur 5 ou 6, une action de plus. | Une chance qu'une bordée se recharge tout de suite. |
| **Négociant** (2-3) | Un trésor vaut 1 ou 2 de plus au déchargement. | Plus d'or au dépôt. |
| **Second** (3) | Une place de cale en plus. | Plus de cale. |
| **Voleur** (2-4) | Prend un trésor au hasard au navire touché. | Vole de l'or au contact. |
| **Perroquet** (1) | Regarde un trésor face cachée. | La boussole montre la cargaison des marchands et le contenu des îles. |
| **Pilote** (3) | Ignore les terrains. | Ignore récifs et sargasses. |
| **Vétéran** (4) | Ignore la première touche de chaque tour tant que tous les mâts sont debout. | Premier boulet de chaque salve ignoré tant que la coque est intacte. |
| **Tireur d'élite** (2) | Choisit le mât détruit. | Vise les voiles ou les canons (avec « Mâts qui tombent »). |
| **Écorcheur** (2) | Chaque touche tue aussi un équipage. | Les boulets tuent plus d'équipage. |
| **Capitaine sanguinaire** (5) | Sacrifie un équipage contre une action de plus. | Une touche : quelques marins en moins, recharge immédiate. |
| **Intendant** (2) | Les autres équipages coûtent 1 de moins. | Plus de budget. |
| **Notable à rançon** (0) | 5 points de flotte en plus. Ne quitte pas le navire. Capturé, il vaut 5 or pour l'adversaire. | Plus de budget, mais une prime sur la tête : coulé ou abordé, on perd gros. |
| **Porte-malheur** (0) | Les autres équipages sont gratuits. À chaque touche reçue, sur 5 ou 6, le plus cher est abandonné sur une île. | Officiers gratuits, avec une chance d'en perdre un à chaque gros coup. |
| **Contrebandier** (4-7) | Accoste l'île de départ adverse et y prend un trésor. | En course au trésor : vole au port adverse. |
| **Débardeurs** (3) | Décharge à courte distance de l'île de départ. | Dépôt sans accoster. |
| **Fondeur** (3) | Au port, change un trésor en canon indestructible. | Au port : de l'or contre un canon. |
| **Preneur d'épaves** (6) | Les pontons explorés deviennent à lui, amarrés à son île. | Prise sans remorquage. |
| **Paire liée** | Deux équipages liés : une place de cale en plus. | Bonus quand deux officiers précis sont à bord ensemble. |

### Événements

Dans l'original, des cartes à usage unique achetées avec la flotte. Dans Broadside : des consommables (un emplacement, gagnés en coffre ou en booster) ou des événements de carte tirés au hasard. Coût **S** chacun.

| Événement | Dans l'original | Dans Broadside |
|---|---|---|
| **Calme plat** | Aucun navire ne bouge dans un large rayon pendant un tour. | Zone sans vent : tout le monde à l'arrêt, on se canonne sur place. |
| **Vents contraires** | Les navires d'une zone sont poussés dans une direction ; qui touche une île perd un mât. | Rafale qui pousse tout le monde, dégâts contre les îles. |
| **Sirènes** | Un navire adverse n'agit plus pendant autant de tours qu'il a d'équipages. | Un ennemi dérive vers un point, sans tirer, pendant quelques secondes. |
| **Radeau** | L'équipage d'un navire coulé survit sur l'île la plus proche. | Coulé en co-op : retour tout de suite, avec une coque réduite. |
| **Plongeurs** | Tout l'or d'un navire coulé au lieu de la moitié. | Butin doublé sur le prochain navire coulé. |
| **Duel** | Un équipage de chaque camp, un dé plus son coût : le plus bas meurt. | Abordage réglé en une seule manche. |
| **Faux trésor** | Retire les trésors communs d'un navire adverse. | PvP : vide la cale d'un rival. |
| **Faveur des dieux** | Retire tous les événements en jeu. | Annule météo et effets en cours. |
| **Crique cachée** | Accoste gratuitement l'île inexplorée la plus proche. | Marque sur la boussole l'île qui cache un coffre. |
| **Zone maudite** | -2 à tous les dés dans un large rayon. | Zone où les tirs se dispersent. |
| **Brouillard roulant** | Un banc de brouillard se déplace chaque tour dans une direction tirée au dé. | Banc de brume qui dérive sur la carte. |

### Boosters numériques et sauvegarde

L'original se vendait en boosters : deux navires, une île, un équipage ou un trésor ou un événement, avec des raretés. Dans Broadside : les doublons gagnés en partie ouvrent un paquet (un bateau ou une voile, un officier, un événement). L'écran de choix devient une collection de cartes avec leurs points, comme la carte de pont de l'original. C'est la forme à donner à « Progression entre parties ». Coût : **M**.

Sauvegarder la collection ne demande pas de compte. Trois paliers, à monter seulement si le besoin se présente :

1. **`localStorage`** (S) : comme le top 10 et le pseudo aujourd'hui. Rien à déployer. Perdu si le navigateur est vidé, pas partagé entre appareils.
2. **Code de capitaine** (M) : le service `ice` garde la collection sous un code tiré au hasard (une route de plus, dans un fichier du volume comme les scores). On note le code, on le retape sur un autre appareil. Ni e-mail ni mot de passe. Le code est le seul secret : perdu, la collection l'est aussi, et qui le connaît peut la reprendre.
3. **Vrai compte** (L) : e-mail ou connexion tierce, base de données, données personnelles. À éviter tant que le jeu reste gratuit et sans achat.

Dans tous les cas la collection est falsifiable, comme le classement : le navigateur dit ce qu'il possède. Donc les boosters débloquent des variantes et de l'apparence, pas de la puissance brute, et le PvP garde un budget de points égal pour tous.

## Petits manques et finitions

- **Compétences pour les ennemis** : capitaines de la marine avec boulets ramés ou fumée dans les vagues avancées.
- **Équilibrage** à tester à la main : bateaux, compétences, vitesse des marchands.
- **Livraison** : README, entrée dans la galerie du sandbox, commit.

## Déjà fait

Trois bateaux au choix, vagues progressives, réparation entre les vagues et hors combat, effets sonores, barre de compétences (4 emplacements, apprentissage et niveaux), fort destructible, or ramassable avec aimant, navires marchands avec progression, abordage (auto sous 20 % de coque, sinon QTE barre de timing à Espace, jeu en pause) et équipage (pertes sous le feu, recharge plus lente en sous-effectif, recrues entre les vagues et prisonniers), pause (Échap), combos (multiplicateur d'or ×2 à ×5 si les navires coulent à moins de 6 s d'intervalle) et classement local (top 10, initiales, trié par vague puis or), musique procédurale (boucle en ré mineur, tambour pendant les combats), un sabord par canon (mis à jour avec l'amélioration) et des îles qui arrêtent les boulets. Kraken dans tous les modes : créature lente qui frappe tout bateau proche, joueur ou non (tentacule télégraphiée, à esquiver), tuable, sans butin.

# Broadside: idées de mécaniques

Backlog d'idées pour la suite. Coût : **S** = quelques heures, **M** = une demi-journée, **L** = plus d'une journée.

## Recommandé en premier

1. **Prime sur ta tête + boss** : de la tension et des pics de rythme, au lieu d'un simple compteur de vagues.
2. **Boutique** : à combiner avec n'importe laquelle, pour que l'or serve enfin à quelque chose.

## Profondeur tactique

| Idée | Ce que ça apporte | Coût |
|---|---|---|
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
| **Bordée à bout portant** | Portée réduite, un seul dé : tous les canons touchent, plus une touche en prime. | Un boulet qui touche à moins de 8 de sa bouche fait ×1,5 (`BALL.pb`, `BALL.pbMul`). Vaut aussi pour les ennemis. | fait |
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

L'original se vendait en boosters : deux navires, une île, un équipage ou un trésor ou un événement, avec des raretés. Dans Broadside : chaque partie donne un paquet (un bateau ou une voile, un officier, un événement), et les doublons en achètent d'autres. L'écran de choix devient une collection de cartes avec leurs points, comme la carte de pont de l'original. C'est la forme à donner à « Progression entre parties ». Coût : **M**.

Sauvegarder la collection ne demande pas de compte. Trois paliers, à monter seulement si le besoin se présente :

1. **`localStorage`** (S) : comme le top 10 et le pseudo aujourd'hui. Rien à déployer. Perdu si le navigateur est vidé, pas partagé entre appareils.
2. **Code de capitaine** (M) : le service `ice` garde la collection sous un code tiré au hasard (une route de plus, dans un fichier du volume comme les scores). On note le code, on le retape sur un autre appareil. Ni e-mail ni mot de passe. Le code est le seul secret : perdu, la collection l'est aussi, et qui le connaît peut la reprendre.
3. **Vrai compte** (L) : e-mail ou connexion tierce, base de données, données personnelles. À éviter tant que le jeu reste gratuit et sans achat.

Dans tous les cas la collection est falsifiable, comme le classement : le navigateur dit ce qu'il possède. Donc les boosters débloquent des variantes et de l'apparence, pas de la puissance brute, et le PvP garde un budget de points égal pour tous.

### Flotte : 26 navires

Trois navires aujourd'hui (Wasp, Corsair, Leviathan). Cette flotte en donne 26, répartis sur les dix factions et tirés dans les boosters. Règles communes :

- Un navire = une ligne de `PLAYER_SHIPS` : une coque, des caractéristiques, une **signature** (compétence que lui seul possède, en place dès le départ), une compétence du tronc commun au départ et deux à apprendre.
- Tronc commun : boulets ramés, boulets rouges, cuirasse, toutes voiles, fumée, réparation. Le baril de poudre et la bordée totale sortent du tronc : ce sont les signatures du Wasp et du Leviathan, dont le kit ne change pas.
- Seul navire existant modifié : le Corsair, qui gagne une signature à apprendre (Pavillon noir).
- La rareté mesure l'étrangeté, pas la puissance : un commun a un kit simple, un légendaire tord une règle. Un navire rapide reste fragile, un navire lourd reste lent.
- La faction du navire fixe son pavillon, donc son bonus passif (« Pavillon du joueur ») et ses officiers à plein effet.

#### Bonus de pavillon

| Faction | Bonus passif | Navires |
|---|---|---|
| **Pirates** | Abordage ouvert à 30 % de coque au lieu de 20 %, butin d'abordage +50 %. | 5 |
| **Angleterre** | Bordées deux fois plus serrées. | 3 |
| **Espagne** | Or ramassé +25 %. | 3 |
| **France** | +10 % de vitesse pendant 3 s après chaque bordée. | 2 |
| **États-Unis** | Pertes d'équipage sous le feu divisées par deux. | 2 |
| **Barbaresques** | Dégâts d'éperon doublés, prisonniers payés en rançon. | 2 |
| **Rébellion de Jade** | Les incendies allumés durent deux fois plus longtemps. | 2 |
| **Maudits** | L'équipage perdu revient hors combat. | 3 |
| **Vikings** | Dégâts doublés contre le kraken, +25 % en mêlée d'abordage. | 2 |
| **Mercenaires** | Aucun bonus, mais un emplacement d'officier en plus et tout officier à plein effet. | 2 |

#### Caractéristiques

Vit. = vitesse max, Vir. = virage, Can. = canons par bord, Rech. = recharge en secondes, Off. = emplacements d'officiers. Les trois premiers sont les valeurs actuelles.

| Navire | Faction | Rareté | Coque | Vit. | Vir. | PV | Can. | Portée | Rech. | Équip. | Off. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Wasp** | Pirates | Départ | Sloop | 13,5 | 1,35 | 70 | 3 | 28 | 2,4 | 24 | 2 |
| **Corsair** | Pirates | Départ | Brick | 11 | 0,95 | 100 | 4 | 32 | 2,9 | 34 | 3 |
| **Leviathan** | Pirates | Départ | Galion | 8,5 | 0,62 | 150 | 6 | 36 | 3,6 | 50 | 4 |
| **Mauvaise Fortune** | Pirates | Peu commun | Goélette | 12,5 | 1,15 | 80 | 3 | 30 | 2,6 | 26 | 3 |
| **Écumeur** | Pirates | Rare | Brick | 10,5 | 0,9 | 110 | 3 | 28 | 2,8 | 44 | 3 |
| **Bulldog** | Angleterre | Commun | Frégate | 10 | 0,8 | 120 | 5 | 34 | 3,2 | 40 | 3 |
| **Vigie** | Angleterre | Peu commun | Sloop | 13 | 1,3 | 60 | 2 | 34 | 2,2 | 18 | 2 |
| **Sovereign** | Angleterre | Rare | Vaisseau | 7,5 | 0,5 | 180 | 7 | 38 | 4,0 | 60 | 4 |
| **Tercio** | Espagne | Commun | Galion | 8,5 | 0,6 | 150 | 5 | 32 | 3,6 | 64 | 4 |
| **Santa Fortuna** | Espagne | Peu commun | Galion | 8 | 0,55 | 170 | 4 | 32 | 3,4 | 44 | 4 |
| **Invencible** | Espagne | Rare | Galère | 9,5 | 0,75 | 130 | 4 | 30 | 3,2 | 54 | 3 |
| **Hirondelle** | France | Commun | Brick | 12,5 | 1,1 | 85 | 4 | 30 | 3,0 | 28 | 3 |
| **Renard** | France | Peu commun | Sloop | 13 | 1,25 | 65 | 3 | 26 | 2,5 | 30 | 2 |
| **Minuteman** | États-Unis | Commun | Goélette | 12 | 1,1 | 80 | 3 | 24 | 2,3 | 26 | 3 |
| **Liberty** | États-Unis | Peu commun | Frégate | 9,5 | 0,7 | 145 | 5 | 32 | 3,4 | 42 | 3 |
| **Raïs** | Barbaresques | Commun | Galère | 11 | 1,4 | 90 | 2 | 24 | 2,8 | 56 | 3 |
| **Sirocco** | Barbaresques | Rare | Galère | 13 | 1,2 | 75 | 3 | 28 | 2,6 | 40 | 3 |
| **Dragon de Jade** | Jade | Peu commun | Jonque | 10 | 0,9 | 105 | 4 | 32 | 3,0 | 32 | 3 |
| **Carapace** | Jade | Rare | Tortue | 7,5 | 0,7 | 120 | 4 | 26 | 3,2 | 36 | 3 |
| **Banshee** | Maudits | Rare | Brick | 11 | 1,0 | 90 | 4 | 30 | 3,0 | 28 | 3 |
| **Revenant** | Maudits | Légendaire | Galion | 9 | 0,65 | 130 | 5 | 34 | 3,4 | 30 | 4 |
| **Abysse** | Maudits | Légendaire | Sloop | 12,5 | 1,25 | 65 | 2 | 28 | 2,6 | 20 | 2 |
| **Fenrir** | Vikings | Peu commun | Drakkar | 13,5 | 1,2 | 85 | 1 | 22 | 2,4 | 52 | 2 |
| **Valkyrie** | Vikings | Rare | Drakkar | 12 | 1,05 | 100 | 2 | 26 | 2,6 | 46 | 3 |
| **Sans-Pavillon** | Mercenaires | Rare | Frégate | 10,5 | 0,85 | 115 | 5 | 34 | 3,3 | 36 | 3 |
| **Caméléon** | Mercenaires | Légendaire | Brick | 11 | 0,95 | 95 | 4 | 32 | 3,0 | 32 | 4 |

#### Signatures

« Départ » et « À apprendre » puisent dans le tronc commun. « S'appuie sur » nomme ce qui existe déjà dans `sim.js` ou dans ce fichier.

| Navire | Signature | Effet | Départ | À apprendre | S'appuie sur |
|---|---|---|---|---|---|
| **Wasp** | Baril de poudre | Mine flottante larguée à la poupe. | Toutes voiles | Fumée, ramés | `keg`, inchangé |
| **Corsair** | Pavillon noir (à apprendre) | 6 s : les ennemis à portée rechargent 30 % plus lentement, ceux sous 35 % de coque amènent leurs couleurs. | Ramés, rouges | Toutes voiles, réparation | Seuil de `startBoarding` |
| **Leviathan** | Bordée totale | Tous les canons tirent tout autour. | Cuirasse | Rouges, réparation | `nova`, inchangé |
| **Mauvaise Fortune** | Faux pavillon | 5 s sans être pris pour cible tant qu'on ne tire pas. La bordée qui rompt le déguisement fait +50 %. | Fumée | Toutes voiles, ramés | `smokeT`, `dmgMul` |
| **Écumeur** | Grappins | Grappin à 14 de portée, treuil, abordage ouvert dès 40 % de coque. | Ramés | Cuirasse, réparation | Abordage, idée 3 |
| **Bulldog** | Feu roulant | Les canons d'un bord tirent un par un sur 2 s, sans dispersion. | Cuirasse | Ramés, réparation | `delay` de `makeBall` |
| **Vigie** | Longue-vue | Marque une cible 10 s : elle subit +30 % de dégâts de tous et reste visible dans la fumée et la brume. | Toutes voiles | Fumée, ramés | Un minuteur lu par `damage` |
| **Sovereign** | Ligne de bataille | 6 s barre bloquée : portée +30 %, recharge 40 % plus courte. | Cuirasse | Rouges, réparation | Minuteur, `stepShip` |
| **Tercio** | Mousqueterie | 5 s : tout navire à bout portant perd de l'équipage chaque seconde, coque intacte. | Cuirasse | Ramés, réparation | Abordage, idée 4 |
| **Santa Fortuna** | Leurre doré | Largue un coffre de 15 or : les ennemis proches virent dessus pendant 5 s. Le coffre se récupère. | Réparation | Cuirasse, fumée | Entité du baril, `steerTo` |
| **Invencible** | Canons de chasse | Trois boulets lourds droit devant. Seul navire qui tire vers l'avant. | Rouges | Toutes voiles, cuirasse | `makeBall` dans l'axe |
| **Hirondelle** | Lof pour lof | Demi-tour en 1 s sans perdre de vitesse, le bord opposé est rechargé. | Toutes voiles | Ramés, rouges | `stepShip`, `reload` |
| **Renard** | Coup de main | Une chaloupe part vers une cible à 20 de portée. Si elle arrive (5 s, elle peut être coulée), elle tue de l'équipage et vole de l'or. | Fumée | Toutes voiles, ramés | France : abordage à distance |
| **Minuteman** | Caronades | Munition : la prochaine bordée porte moitié moins loin et frappe deux fois plus fort. | Toutes voiles | Fumée, rouges | `kind: 'ammo'` |
| **Liberty** | Flancs de chêne | 3 s : les boulets ricochent sur les flancs, mais la proue et la poupe prennent ×1,5. | Réparation | Ramés, rouges | Angle d'impact dans `stepBall` |
| **Raïs** | Nage forcée | 4 s aux rames : pleine vitesse, pivot sur place, dégâts de proue doublés. | Fumée | Ramés, réparation | `boostT`, éperonnage |
| **Sirocco** | Razzia | Au contact, la mêlée se règle en une seule manche. Les prisonniers sont payés en rançon. | Toutes voiles | Fumée, rouges | « Duel », « Ravisseur » |
| **Dragon de Jade** | Flèches de feu | Éventail de six fusées vers l'avant : longue portée, peu précises, incendiaires. | Rouges | Fumée, réparation | `makeBall`, `burnT` |
| **Carapace** | Souffle du dragon | Cône court devant la proue : brûle et aveugle 3 s. La coque porte 40 points de plaques, inabordable tant qu'il en reste. | Cuirasse | Rouges, réparation | « Navire tortue », `burnT` |
| **Banshee** | Cri | Les ennemis à courte portée perdent leurs compétences et leur recharge se fige 4 s. | Fumée | Ramés, rouges | « Peur » |
| **Revenant** | Forme spectrale | 4 s : traverse îles et navires, intouchable, ne peut pas tirer. | Rouges | Fumée, cuirasse | Sauter `collide` et `stepBall` |
| **Abysse** | Appel des profondeurs | Un tentacule frappe l'ennemi le plus proche après 2,2 s. Annoncé sur l'eau, donc esquivable. | Fumée | Toutes voiles, ramés | `SLAM`, `stepSlam` |
| **Fenrir** | Harpon | Harpon droit devant : la cible est tenue et ralentie 5 s. Dégâts doublés contre le kraken. | Toutes voiles | Cuirasse, réparation | `slowT` |
| **Valkyrie** | Cor de guerre | Un drakkar allié vient escorter pendant 15 s. | Cuirasse | Toutes voiles, ramés | `guardSteer` |
| **Sans-Pavillon** | Contrat | Désigne une cible 20 s : or doublé si elle coule à temps, sinon le délai de la compétence double. | Ramés | Rouges, réparation | « Prime sur ta tête » |
| **Caméléon** | Copie | Lance la signature du dernier navire coulé ou pris. | Fumée | Ramés, toutes voiles | Demande « Vagues par nation » |

#### Coques

Sept coques nouvelles en plus des trois existantes. Une coque est une ligne de `SPECS` dans `ships.js` (longueur, largeur, mâts, châteaux), plus une livrée par faction dans `LIVERIES`.

| Coque | Navires | Silhouette | Particularité |
|---|---|---|---|
| **Sloop** (existe) | Wasp, Vigie, Renard, Abysse | Un mât. | |
| **Brick** (existe) | Corsair, Écumeur, Hirondelle, Banshee, Caméléon | Deux mâts. | |
| **Galion** (existe) | Leviathan, Tercio, Santa Fortuna, Revenant | Trois mâts, châteaux hauts. | |
| **Goélette** | Mauvaise Fortune, Minuteman | Deux mâts, voiles auriques, coque fine. | |
| **Frégate** | Bulldog, Liberty, Sans-Pavillon | Trois mâts, pont ras, entre le brick et le galion. | |
| **Vaisseau** | Sovereign | Le plus long, deux rangs de sabords. | |
| **Galère** | Raïs, Sirocco, Invencible | Longue et basse, voiles latines, rames. | Avance encore sans voiles. |
| **Jonque** | Dragon de Jade | Voiles lattées, poupe haute. | Canons orientables de 30° de chaque côté. |
| **Tortue** | Carapace | Pont couvert, tête de dragon à la proue. | Plaques d'armure avant la coque. |
| **Drakkar** | Fenrir, Valkyrie | Un mât, voile carrée, boucliers au bastingage. | Dégâts d'éperon à la proue. |

#### Tirage dans les boosters

- Au départ : les trois navires pirates. Les 23 autres se tirent.
- Un booster contient quatre cartes : un navire, un officier, une carte « monde », une apparence (voir « Contenu des boosters »).
- Carte navire : commun 55 %, peu commun 30 %, rare 12 %, légendaire 3 %. Un rare au moins tous les dix boosters.
- Quand une série n'a aucun navire de la rareté tirée (pas de légendaire dans Mer des Caraïbes ni Orient, pas de commun dans Abysses), on prend la rareté la plus proche en dessous, sinon au-dessus.
- Un navire tiré en double monte d'un rang : une voile, puis une livrée dorée, puis des doublons (voir « Doubles et écran de collection »).
- Quatre séries, comme les extensions de l'original. Chaque booster ne tire que dans sa série. Mer des Caraïbes est ouverte dès le départ ; les trois autres sont des extensions, à ouvrir avec une carte rare (voir « Extensions »).

| Série | Factions | Navires à tirer |
|---|---|---|
| **Mer des Caraïbes** | Pirates, Angleterre, Espagne | 8 |
| **Corsaires** | France, États-Unis, Mercenaires | 6 |
| **Orient** | Barbaresques, Rébellion de Jade | 4 |
| **Abysses** | Maudits, Vikings | 5 |

#### Coût et ordre

- Un navire sur une coque existante, signature simple (un minuteur ou une munition) : **S**.
- Une signature qui crée un objet nouveau (grappin, chaloupe, coffre, forme spectrale, copie) : **M**.
- Une coque : **S**, plus **S** pour chaque forme de voile nouvelle (latine, lattée, rames).
- L'écran de collection, le quai à trois emplacements, les boosters et la sauvegarde en `localStorage` : **M**.
- En ligne, le message `ship` porte déjà un index : rien à changer côté réseau.

Ordre conseillé : la série Mer des Caraïbes d'abord (8 navires, 3 coques nouvelles : goélette, frégate, vaisseau), avec l'écran de collection. Les trois autres séries ensuite, une par une. Le Caméléon en dernier, il dépend des vagues par nation.

### Contenu des boosters

Au-delà des navires, des officiers et des événements, ce qu'un booster peut donner, classé par effet sur le jeu. La règle reste celle posée plus haut : pas de puissance brute.

Apparence. Aucun effet en jeu, donc sans risque pour le PvP ni pour le classement.

| Carte | Exemple | Coût |
|---|---|---|
| **Voiles et emblèmes** | Couleur de voile, emblème en pixels (`emblemTex` dessine déjà le crâne et la croix). | S |
| **Pavillon, figure de proue, peinture de coque** | Sirène à la proue, coque noire et or. | S chacun |
| **Effets** | Fumée de canon colorée, sillage, lanternes de nuit. | S |
| **Mascotte** | Perroquet ou singe sur le pont. | S |
| **Chants de marins** | Thèmes de musique en plus (la musique est déjà procédurale). | M |
| **Titre de capitaine** | Affiché à côté du pseudo au classement. Demande de toucher le service `ice`. | M |

Variété. Ces cartes changent la partie, pas la puissance du joueur. Le détail de celles qui ajoutent du gameplay est dans « Cartes de monde ».

| Carte | Exemple | Coût |
|---|---|---|
| **Carte marine** | Nouvelle carte (une entrée de `MAPS`) ou variante : récifs, sargasses, archipel serré. | M |
| **Monstre** | Ajoute une créature au tirage des vagues : serpent de mer, navire fantôme errant. | M |
| **Lettre de marque** | Choisit la nation ennemie de la partie. Va avec « Vagues par nation ». | S |
| **Malédiction** | Handicap volontaire contre un multiplicateur d'or : pas de réparation, brume permanente. | S |
| **Contrat** | Défi à remplir : couler cinq galions espagnols, gagner sans abordage. Paie en doublons. | S |
| **Morceau de carte au trésor** | Trois morceaux révèlent une croix à la prochaine partie. Va avec « Cartes au trésor ». | M |

Variantes de kit, à puissance égale.

| Carte | Exemple | Coût |
|---|---|---|
| **Relique** | Un emplacement par navire, un passif avec sa contrepartie : boussole maudite (plus d'or, kraken plus fréquent). Ce sont les trésors uniques de l'original. | M |
| **Compétence de tronc commun** | Mitraille, brûlot, ancre flottante : remplace une compétence « à apprendre » d'un navire. | S par compétence |
| **Refit rare** | Ajoute une carte au tirage entre les vagues (`UPGRADES`). | S |

À éviter :

- **Consommables de départ** (rhum, poudre en plus) : de la puissance brute achetée, qui fausse le classement.
- **Pages de journal de bord** : elles remplissent le booster sans donner envie de l'ouvrir.

Composition conseillée : quatre cartes au lieu de trois. Un navire, un officier, une carte « monde » (événement, carte marine, monstre, contrat, lettre de marque, malédiction), une apparence. Commencer par les emblèmes de voile, les contrats et les malédictions : trois types à coût S, et les contrats donnent une raison d'ouvrir le booster suivant.

### Cartes de monde : débloquer du gameplay

Un booster peut aussi agrandir le jeu lui-même : boss, nations ennemies, cartes, modes, éléments de carte. Ce sont les cartes « monde » du booster.

#### Principes

- **Le jeu de base reste complet.** Sans rien ouvrir : deux cartes, les modes actuels, la marine, le fort, le kraken. Une carte de monde ajoute, elle ne rend jamais ce qui existait.
- **Le code est pour tout le monde, la carte débloque le contenu.** Le mécanisme (boss toutes les cinq vagues, vagues par nation, météo) est livré à tous avec un premier exemple. Chaque carte ajoute un exemple de plus au tirage.
- **Journal de bord.** L'onglet Monde de l'écran de collection liste les cartes de monde possédées, chacune avec un interrupteur, allumé par défaut. Chaque partie tire dans ce qui est allumé.
- **Budget constant.** Une nation ou un boss se paie sur le budget de la vague (`waveSpec`), une épave ou un coffre sur l'or de la vague. Le monde varie, la quantité d'or reste la même : le classement reste comparable.
- **En ligne, le monde de l'hôte s'applique**, puisqu'il porte la simulation. Les invités croisent des cartes qu'ils n'ont pas : c'est la vitrine des boosters.
- **Un double fait monter la carte d'un rang** (trois au plus) : le boss gagne une phase, la nation un capitaine d'élite, la tempête un éclair de plus.
- **Chaque carte amène son butin.** Un boss vaincu ou une nation battue dix fois donne une voile ou une relique qu'on n'a pas autrement.
- **Une carte, un interrupteur, un test.** Une carte est une ligne de données et un point d'accroche. Elle ne dépend d'aucune autre, sauf prérequis noté. `check.mjs` la joue seule.

#### Boss

Prérequis : « Boss toutes les 5 vagues ». Le kraken reste le boss de base. Un boss par carte, tiré parmi ceux allumés, sur le modèle de `krakenDue`. Coût **M** chacun.

| Carte | Ce que ça ajoute | S'appuie sur |
|---|---|---|
| **Vaisseau amiral** | Trois phases : bordées, barrage de mortier annoncé sur l'eau, renforts. | « Tirs télégraphiés », coque Vaisseau |
| **La Flotte de l'or** | Un galion géant qui fuit vers le bord de la carte avec son escorte. Butin énorme s'il est pris avant de sortir. | `guardSteer`, `merchantSteer` |
| **Hollandais volant** | Traverse les îles, disparaît, ressort ailleurs. Ne se touche qu'en forme solide. | « Navire fantôme » |
| **Galère amirale** | Fonce à l'éperon et aborde le joueur : il faut repousser la mêlée ou couper les grappins. | Abordage, idée 1 |
| **Serpent de mer** | Plonge, ressort sous le navire après une ombre sur l'eau. | `SLAM`, « Monstre qui plonge » |

#### Nations ennemies

Prérequis : « Vagues par nation ». L'Angleterre est la marine de base. Chaque carte ajoute un pavillon au tirage des vagues : une livrée, ses coques dans `waveSpec`, un comportement. Les coques sont celles de la flotte du joueur, donc le coût se partage. **S** si le comportement existe, **M** sinon.

| Carte | Comportement en vague | Coût |
|---|---|---|
| **Espagne** | Peu de navires, gros et riches. Lents, beaucoup d'or. | S |
| **France** | Corsaires qui tirent une bordée et rompent le combat. | M |
| **États-Unis** | Frégates à coque épaisse, mousquets de près. | S |
| **Barbaresques** | Galères qui foncent à l'éperon et abordent. | M |
| **Rébellion de Jade** | Jonques qui tirent sous tous les angles, une tortue blindée. | M |
| **Maudits** | Vague de nuit, fantômes qui traversent les îles. | M |
| **Vikings** | Drakkars en meute, sans canons, tout à l'éperon. | S |
| **Mercenaires** | Un seul chasseur de primes d'élite, avec des compétences. | M |

Variante à deux pavillons : deux nations arrivent ensemble et se battent aussi entre elles (`allied` décide déjà qui tire sur qui).

#### Cartes marines

Une carte marine est une entrée de `MAPS` : des données, huit îles au plus (limite du shader de l'eau). Coût **S** chacune une fois le terrain en place.

| Carte | Ce que ça ajoute | Prérequis |
|---|---|---|
| **Archipel** | Huit petites îles serrées : des passes étroites, peu de lignes de tir. | |
| **Détroit** | Deux grandes îles, un chenal, un fort de chaque côté. | |
| **Récifs du Diable** | Des hauts-fonds partout : le sloop coupe, le galion contourne. | « Récif » |
| **Mer des Sargasses** | L'inverse : les algues freinent les petits. | « Sargasses » |
| **Baie du Gouverneur** | Un grand fort au centre, qui couvre presque toute la carte. | |
| **Route des Indes** | Convoi : une carte plus longue, trois ports, deux convois qui se croisent. | |

#### Modes de jeu

Les cartes les plus rares. Chaque mode a son propre classement : une clé de plus dans `boards` du service `ice`, à déployer à la main. Coût **M** à **L**.

| Carte | Règle | Prérequis |
|---|---|---|
| **Contrebande** | Le convoi à l'envers : le joueur porte une cargaison de port en port à travers un blocus. | Carte du convoi |
| **Siège** | Faire tomber les forts d'un port avant la fin du temps, sous les renforts. | |
| **Chasse au monstre** | Les boss à la suite, sans vagues entre eux. Solo ou co-op. | Deux boss au moins |
| **Course au trésor** | PvP : le premier à ramener plus de la moitié de l'or au port. | « Or en cale » |
| **Régate** | Course de bouées. Les canons sont permis. | « Vent réel » |
| **Île au trésor** | PvP : tenir le mouillage d'une île pour marquer. | |

#### Variantes de mode

Une règle changée pour tout le monde, à poser sur un mode existant. La malédiction, elle, ne handicape que le joueur. Coût **S** chacune.

| Carte | Règle |
|---|---|
| **Nuit** | Vue réduite, les navires se repèrent à leurs lanternes et aux départs de feu. |
| **Deux pavillons** | Chaque vague mêle deux nations ennemies entre elles. |
| **Escadre** | Le joueur part avec une prise en escorte (`guardSteer`). |
| **Mort subite** | Tout le monde coule en une bordée, joueur compris. |
| **Marine en chasse** | La prime commence à trois étoiles. Va avec « Prime sur ta tête ». |
| **Miroir** | PvP : tout le monde sur le même navire, tiré au sort. |
| **Marée** | Les îles grossissent et rétrécissent pendant la partie (`shoreR`). |

#### Éléments de carte

Posés sur les cartes existantes, tirés à chaque partie. Coût **S** chacun, sauf mention.

Forts. `makeFort` et `makeTurret` existent : un type de fort est une tourelle réglée autrement.

| Carte | Ce que ça ajoute |
|---|---|
| **Tour à mortier** | Tirs en cloche annoncés par un cercle sur l'eau. |
| **Batterie côtière** | Très longue portée, peu de dégâts, tir lent. |
| **Fort à boulets rouges** | Ses tirs mettent le feu. |
| **Phare** | Tant qu'il tient, les ennemis savent toujours où est le joueur. Le détruire les aveugle. |
| **Chaîne de port** | Barre une passe jusqu'à la chute du fort qui la tient. |
| **Repaire** | Un fort ami : on s'y répare à l'abri de ses canons. |

Butin. L'or flottant et son aimant existent déjà.

| Carte | Ce que ça ajoute |
|---|---|
| **Épaves** | Un navire coulé laisse une épave à piller en y restant quelques secondes. |
| **Coffres à la dérive** | Un coffre rare qui dérive et coule si on tarde. |
| **Bouteille à la mer** | Un morceau de carte au trésor. |
| **Naufragés** | Des marins à repêcher : de l'équipage en plus. |
| **Caisse de munitions** | Recharge tout de suite une compétence de munition. |
| **Barils de rhum** | Recharge plus rapide pendant quelques secondes. |

Rencontres. Un événement au hasard par vague, au plus.

| Carte | Ce que ça ajoute | Coût |
|---|---|---|
| **Navire en détresse** | Un marchand démâté appelle à l'aide : une récompense, ou un piège de la marine. | S |
| **Marchand ambulant** | Un navire neutre qui vend une carte de refit contre de l'or. | M |
| **Duel d'honneur** | Un capitaine défie le joueur : les autres ennemis s'écartent le temps du combat. | S |
| **Maelström** | Un tourbillon qui attire tous les navires vers son centre. | S |
| **Trombe marine** | Une colonne d'eau qui erre et démâte ce qu'elle touche. | S |
| **Volcan** | Une île crache des bombes annoncées sur l'eau. | S |
| **Mutinerie** | Sous un tiers d'équipage : payer de l'or ou perdre encore des hommes. | S |
| **Baleines** | Un banc traverse la carte et bloque les tirs comme les navires. | S |

Météo. La carte « Météo » découpée en tirages séparés. Une météo par vague, au plus.

| Carte | Ce que ça ajoute | Prérequis |
|---|---|---|
| **Tempête** | Houle qui pousse les navires, bordées plus dispersées. | |
| **Brouillard** | Vue réduite, boussole muette, ennemis qui surgissent. | |
| **Calme plat** | Vent nul : tout le monde au ralenti, on se canonne sur place. | « Vent réel » |
| **Alizés** | Vent fort et constant : fuir ou poursuivre devient un choix de cap. | « Vent réel » |
| **Grains** | Rafales soudaines qui font virer le vent. | « Vent réel » |
| **Orage** | La foudre frappe des points annoncés, de préférence les plus hauts mâts. | |
| **Pluie** | Les incendies s'éteignent vite, les boulets rouges ne servent à rien. | |

#### Rareté et séries

Une soixantaine de cartes de monde en tout. Elles suivent les séries des navires : une nation et son boss sortent dans la série de leurs navires (la Galère amirale avec Orient, le Hollandais volant avec Abysses).

| Rareté | Cartes de monde |
|---|---|
| **Commun** | Butin, météo, variantes de mode |
| **Peu commun** | Forts, rencontres, cartes marines |
| **Rare** | Nations ennemies, boss |
| **Légendaire** | Modes de jeu |

#### Risques

- **Un jeu de base qui paraît vide.** Le premier booster doit contenir une carte de monde visible dès la partie suivante (une météo ou un fort).
- **Trop de combinaisons à tester.** D'où la règle : aucune carte ne dépend d'une autre.
- **Scores moins comparables.** Le budget constant limite l'écart, il ne l'annule pas. C'est accepté : le classement est déjà falsifiable.
- **Le service `ice`.** Seuls les nouveaux modes le touchent (un classement chacun). Tout le reste est local.

#### Ordre conseillé

1. Le journal de bord et le tirage, avec ce qui coûte le moins : trois météos, deux forts, trois butins.
2. La série Mer des Caraïbes : la nation Espagne et le Vaisseau amiral, en même temps que leurs navires.
3. Les cartes marines, une fois récif et sargasses en place.
4. Les modes en dernier : ce sont les plus chers, et ils demandent un déploiement.

### Doubles et écran de collection

Vocabulaire : un **double** est une carte tirée alors qu'on la possède déjà. Les **doublons** sont la monnaie.

#### Doubles

Une seule règle pour toutes les cartes, et rien à gérer à la main : le double est traité à l'ouverture du booster.

- **Rangs.** Chaque carte a trois rangs. Le premier exemplaire la débloque, le deuxième et le troisième la font monter d'un rang.
- **Au-delà du rang 3**, le double devient des doublons, tout de suite.
- **La collection ne garde donc jamais de pile de doubles** : un compteur de 1 à 3 par carte, rien d'autre.

Ce que donne un rang, selon le type. Jamais de puissance brute.

| Type | Rang 2 | Rang 3 |
|---|---|---|
| **Navire** | Une voile de plus pour ce navire. | Livrée dorée et figure de proue. |
| **Officier** | Carte brillante. | Une variante d'effet au même coût, au choix avant la partie. |
| **Monde** | Du contenu en plus : une phase de boss, un capitaine d'élite, un éclair de plus. | Encore un cran, et le butin propre à la carte. |
| **Apparence** | Pas de rang : le double devient des doublons. | |

Doublons. Un booster est offert en fin de partie (voir « Extensions ») ; un booster de plus coûte 100 doublons. Un double au-delà du rang 3 rend le quart du prix d'achat de la carte.

| Rareté | Double rendu | Achat direct |
|---|---|---|
| **Commun** | 10 | 40 |
| **Peu commun** | 25 | 100 |
| **Rare** | 100 | 400 |
| **Légendaire** | 400 | 1 600 |

- **Achat direct.** Une carte manquante s'achète en doublons depuis sa fiche. C'est le remède à la légendaire qui ne tombe pas.
- **Pas de légendaire en double** tant qu'il en manque une dans la série. Avec le rare garanti tous les dix boosters, ce sont les deux seules protections.
- **Don en salon** (option, **M**) : dans un salon en ligne, offrir à un autre pirate un exemplaire d'une carte qu'on a au rang 3, une fois par session. Le donneur garde la sienne : pas de serveur ni d'économie à protéger, la collection étant de toute façon falsifiable. C'est l'échange du jeu de cartes d'origine.

Écartés :

- **Tirage sans double** : plus simple, mais la collection se finit en une quarantaine de boosters et la rareté ne veut plus rien dire.
- **Recyclage à la main** (poussière, atelier) : un écran et des décisions en plus pour le même résultat que la conversion automatique.

#### Écran de collection

Un bouton COLLECTION sur l'écran de choix du navire, avec une pastille quand une carte est nouvelle. Même habillage que les cartes actuelles (`.card`, `statBars`), en HTML et CSS, sans bibliothèque.

```
COLLECTION                          412 doublons   [ BOOSTER 100 ]
[ NAVIRES 9/26 ] [ OFFICIERS 12/30 ] [ MONDE 14/59 ] [ APPARENCE 8/40 ]
Série : Toutes · Caraïbes 6/8 · Corsaires 1/6 · Orient · Abysses
Filtres : faction · rareté · possédées / manquantes

+--------+ +--------+ +--------+ +--------+   +----------------------+
| WASP   | | CORSAIR| |  ???   | | BULLDOG|   | BULLDOG   Angleterre |
| ***    | | *      | |        | | **     |   | [navire qui tourne]  |
| Départ | | Départ | | Rare   | | Commun |   | Vit. ====    PV ===== |
+--------+ +--------+ +--------+ +--------+   | Feu roulant : ...    |
+--------+ +--------+ +--------+ +--------+   | Rang 2/3 : voile     |
|  ...   | |  ...   | |  ...   | |  ...   |   | [ METTRE À QUAI 1-3 ]|
+--------+ +--------+ +--------+ +--------+   +----------------------+
```

- **Quatre onglets**, un par type de carte, chacun avec son compte possédées sur total.
- **Filtres** : série, faction, rareté, possédées ou manquantes. Une barre de progression par série ; une série complète donne un titre de capitaine.
- **Vignette** : nom, rareté (couleur du cadre et mot écrit, pas la couleur seule), pavillon, rang en étoiles, marque « nouveau ». Carte manquante : silhouette sombre, nom caché pour les légendaires, série où la trouver.
- **Fiche** (panneau de droite), selon le type :
  - Navire : le modèle qui tourne (les aperçus `PREVIEW` existent), les barres de caractéristiques, la signature, le bonus de pavillon, le choix de la voile, le prochain rang.
  - Officier : coût, effet, variante au rang 3.
  - Monde : description, interrupteur (c'est le journal de bord), contenu ajouté à chaque rang.
  - Apparence : aperçu sur le navire à quai.
  - Carte manquante : bouton d'achat direct avec son prix.
- **Quai.** L'écran de choix garde trois emplacements, touches `1` à `3` : on y met à quai trois navires depuis leur fiche. Les raccourcis ne changent pas, et l'écran de choix ne grossit pas avec la collection.
- **Clavier** : flèches pour parcourir, `Entrée` pour ouvrir la fiche, `Échap` pour sortir, comme le reste du jeu.

Ouverture d'un booster :

- Quatre cartes face cachée. `Espace` en retourne une, `Entrée` les retourne toutes.
- Le cadre annonce la rareté avant le retournement.
- Sous chaque carte, ce qu'elle a donné : NOUVEAU, RANG 2, ou +25 DOUBLONS.
- La fiche de la carte est à un clic.

Sauvegarde : une seule clé `localStorage`, `{ cartes: { id: rang }, doublons, quai, éteintes, boosters en cale, compteurs par série, premières fois }`. Un bouton « copier ma collection » donne ce contenu en texte, à coller sur un autre appareil : le transfert sans serveur, avant le « code de capitaine ».

Coût : écran de collection **M**, ouverture de booster **S**, quai **S**, achat direct **S**, don en salon **M**.

### Extensions

Mer des Caraïbes est la série de base. Corsaires, Orient et Abysses sont des **extensions** : chacune a son type de booster, fermé tant qu'on n'a pas trouvé sa carte.

#### Cartes d'extension

Une carte d'extension est une carte rare et unique : elle ouvre un type de booster, pour de bon.

| Carte | Ouvre | Se trouve dans |
|---|---|---|
| **Lettre de course** | Corsaires (France, États-Unis, Mercenaires) | Mer des Caraïbes |
| **Portulan du Levant** | Orient (Barbaresques, Rébellion de Jade) | Mer des Caraïbes |
| **Journal du naufragé** | Abysses (Maudits, Vikings) | Corsaires ou Orient |

- **Où elle tombe.** Dans l'emplacement « monde » du booster : 5 % par booster, garantie au dixième booster de la série qui la contient.
- **Unique.** Une fois trouvée, elle ne retombe plus : pas de rang, pas de double.
- **Achat direct** au prix d'une rare (400 doublons), comme toute carte manquante. Personne ne reste bloqué.
- **Deux chemins.** La série de base cache deux cartes d'extension, et la troisième se trouve dans l'une ou l'autre : le joueur choisit par où il passe.
- **Ce que contient une extension** : les navires et les officiers de ses factions, sa nation ennemie, son boss, ses cartes marines et sa météo, ses apparences. Tout ce qui est rangé par série plus haut.
- **Ajouter une extension plus tard** se fait de la même façon : une réserve de cartes, et une carte d'extension glissée dans une série existante. Par exemple « Compagnie des Indes » (marchands armés, comptoirs) ou « Mers du Sud » (volcans, pirogues).

#### Le booster de fin de partie

Le choix du booster se fait après le combat, sur l'écran de fin.

```
PARTIE TERMINÉE        vague 9        +35 doublons (contrat rempli)

Choisis ton booster :
[1] MER DES CARAÏBES   6/8
[2] CORSAIRES          1/6
[3] ORIENT             fermé : Portulan du Levant (Mer des Caraïbes)
[4] ???                fermé
```

- **Un booster par partie**, plus ceux du boss et du palier : le détail des gains est dans « Gagner des boosters ».
- **Le choix** : touches `1` à `4` parmi les extensions ouvertes. Chaque ligne montre où en est la série, pour viser celle qu'on veut finir.
- **Extension fermée** : grisée, avec le nom de sa carte et la série où la chercher. Une extension dont la carte est encore hors de portée reste un « ??? ».
- **En ligne**, chaque pirate choisit le sien.
- **Les doublons ne paient plus le booster de base** : ils viennent des doubles et des contrats, et servent à l'achat direct d'une carte ou à un booster de plus (100), depuis l'écran de collection.
- **Compteurs par série** : le rare garanti tous les dix boosters et la garantie de la carte d'extension se comptent série par série. Changer de série ne remet rien à zéro.

Coût : les cartes d'extension et le verrou des séries **S**, l'écran de fin de partie avec le choix **S**. Le contenu de chaque extension est compté dans la flotte et les cartes de monde.

### Gagner des boosters

Quand on en reçoit, comment, et combien.

#### Quand

| Source | Boosters | Condition |
|---|---|---|
| **Bienvenue** | 2 | Au premier lancement. Le premier est composé d'avance : un navire commun de Mer des Caraïbes, un officier, une météo ou un fort, un emblème. |
| **Fin de partie** | 1 | Avoir passé la vague 3, ou le deuxième convoi, ou fini le match en PvP. |
| **Boss vaincu** | +1 | Un seul par partie, même avec plusieurs boss. |
| **Palier** | +1 | Vague 10, sixième convoi, ou victoire en PvP. |
| **Première partie du jour** | +1 | Une fois par jour, à l'horloge de l'appareil. |
| **Premières fois** | 1 chacune | Une quinzaine d'exploits, payés une seule fois (liste plus bas). |
| **Doublons** | 1 pour 100 | Depuis l'écran de collection. Les doublons viennent des doubles et des contrats. |

Une partie donne donc de 0 à 3 boosters, 4 avec celui du jour. Rien ne s'achète avec de l'argent réel.

Premières fois, payées chacune d'un booster :

- Premier abordage gagné, premier fort détruit, premier kraken coulé.
- Vague 5, vague 10, vague 15 atteintes.
- Premier convoi entièrement pris.
- Première partie avec chacun des trois navires de départ.
- Première partie en co-op, première victoire en PvP.
- Première entrée au top 100 mondial.
- Puis une par carte de monde : premier boss de chaque sorte vaincu, première vague de chaque nation battue. La liste grandit avec la collection.

Les premières fois font un début généreux : une dizaine de boosters dans la première heure, puis le rythme de croisière.

#### Comment

- **Le booster est neutre jusqu'à l'ouverture.** On gagne « un booster », et c'est en l'ouvrant qu'on choisit sa série parmi les extensions ouvertes.
- **L'écran de fin** annonce les boosters gagnés et propose de les ouvrir tout de suite, un par un, avec le choix de la série à chaque fois.
- **En cale.** Un booster non ouvert reste en réserve : un simple compteur, affiché sur l'écran de choix et dans la collection. On l'ouvre plus tard, par exemple une fois une extension débloquée.
- **En co-op**, tout le monde reçoit les boosters de la partie, y compris un pirate coulé avant la fin. En PvP, tout le monde reçoit celui de fin de partie, le vainqueur celui du palier.
- **Hors ligne** : tout est local, rien ne passe par le service `ice`.
- **Pas d'autre garde-fou que le seuil de la vague 3.** La collection est falsifiable de toute façon : inutile de compliquer pour empêcher la triche.

#### Combien

Simulation du tirage des navires seuls, avec les taux et les garanties notés plus haut, sans achat direct :

| Série | Navires | Tous au rang 1 | Tous au rang 3 |
|---|---|---|---|
| **Mer des Caraïbes** | 8 | 33 boosters | 76 |
| **Corsaires** | 6 | 36 | 102 |
| **Orient** | 4 | 16 | 43 |
| **Abysses** | 5 | 67 | 253 |
| **Total** | 23 | 152 | 473 |

Rythme visé, à 1,5 booster par partie en moyenne :

| Étape | Boosters | Parties |
|---|---|---|
| Premier navire nouveau | 1 | Avant la première partie (bienvenue) |
| Première extension ouverte | 5 à 10 | 3 à 7 |
| Mer des Caraïbes complète | 33 | Une vingtaine |
| Tous les navires | 150 | Une centaine |
| Tout au rang 3 | 470 | Plus de 300 |

- L'achat direct raccourcit ces chiffres : les doubles des communs paient les rares qui manquent.
- **Abysses est deux fois plus longue que les autres** : deux légendaires à 3 %. Soit c'est voulu (la série de fin), soit son taux de légendaire monte à 6 %.
- Ces chiffres ne comptent que l'emplacement navire. Les trois autres emplacements (officier, monde, apparence) suivront le même calcul une fois leurs listes arrêtées.
- La durée d'une partie n'est pas mesurée : le nombre de parties est fiable, le nombre d'heures reste à établir.

Coût : compteur de boosters, sources et premières fois **S**. Tout le reste est déjà compté dans l'écran de fin et la collection.

## Petits manques et finitions

- **Compétences pour les ennemis** : capitaines de la marine avec boulets ramés ou fumée dans les vagues avancées.
- **Équilibrage** à tester à la main : bateaux, compétences, vitesse des marchands.
- **Livraison** : README, entrée dans la galerie du sandbox, commit.

## Déjà fait

Trois bateaux au choix, vagues progressives, réparation entre les vagues et hors combat, effets sonores, barre de compétences (4 emplacements, apprentissage et niveaux), fort destructible, or ramassable avec aimant, navires marchands avec progression, abordage (auto sous 20 % de coque, sinon QTE barre de timing à Espace, jeu en pause) et équipage (pertes sous le feu, recharge plus lente en sous-effectif, recrues entre les vagues et prisonniers), pause (Échap), combos (multiplicateur d'or ×2 à ×5 si les navires coulent à moins de 6 s d'intervalle) et classement local (top 10, initiales, trié par vague puis or), musique procédurale (boucle en ré mineur, tambour pendant les combats), un sabord par canon (mis à jour avec l'amélioration) et des îles qui arrêtent les boulets. Kraken dans tous les modes : créature lente qui frappe tout bateau proche, joueur ou non (tentacule télégraphiée, à esquiver), tuable, sans butin. Bordée à bout portant : ×1,5 de dégâts à portée d'abordage, pour tous les navires.

// French / English. The English text is the key: code reads t('PRESS ANY KEY'), and a missing entry falls back to English.
// No DOM here (check.mjs imports it from node). check.mjs fails when a t() / tn() / tk() key has no entry in FR.
// Proper names stay as they are: BROADSIDE, the ships (Wasp, Corsair, Leviathan: also the leaderboard's ids), PORT ROYAL, TORTUGA.
import { store } from './store.js';

export const FR = {
  // key names (ui.js)
  'SPACE': 'ESPACE', 'ESC': 'ÉCHAP', 'ENTER': 'ENTRÉE', 'TAB': 'TAB',
  'L SHIFT': 'MAJ G', 'R SHIFT': 'MAJ D', 'L CTRL': 'CTRL G', 'R CTRL': 'CTRL D', 'L ALT': 'ALT G', 'R ALT': 'ALT D',
  // key hint bars
  'TYPE': 'ÉCRIRE', 'CONFIRM': 'VALIDER', 'CHOOSE': 'CHOISIR', 'SOUND': 'SON', 'NEXT': 'SUIVANT', 'BACK': 'RETOUR', 'BROWSE': 'PARCOURIR',
  'SET SAIL': 'LEVER L\'ANCRE', 'MAIN MENU': 'MENU PRINCIPAL', 'SAIL AGAIN': 'REPARTIR', 'RESUME': 'REPRENDRE', 'ADJUST': 'RÉGLER',
  'NEXT SECTION': 'SECTION SUIVANTE', 'MODE': 'MODE', 'FILTERS': 'FILTRES', 'SCROLL · SELECTED ROW SHOWS THE CREW': 'DÉFILER · LA LIGNE CHOISIE MONTRE L\'ÉQUIPAGE',
  'JUMP TO YOU': 'ALLER À TOI', 'COLUMN': 'COLONNE', 'GO': 'Y ALLER', 'SHIP': 'NAVIRE', 'READY': 'PRÊT', 'COPY CODE': 'COPIER LE CODE', 'LEAVE': 'QUITTER',
  // title, name
  'PIRATE BATTLES ON THE HIGH SEAS': 'BATAILLES DE PIRATES EN HAUTE MER',
  'PRESS ANY KEY': 'APPUIE SUR UNE TOUCHE',
  'OR CLICK ANYWHERE': 'OU CLIQUE N\'IMPORTE OÙ',
  'WELCOME ABOARD': 'BIENVENUE À BORD',
  'WHAT DO THEY CALL YOU, CAPTAIN?': 'TON NOM, CAPITAINE ?',
  'CAPTAIN NAME': 'NOM DU CAPITAINE',
  'A TO Z ONLY. SHOWN ABOVE YOUR SHIP ONLINE AND ON THE LEADERBOARD. CHANGE IT LATER IN SETTINGS.': 'DE A À Z SEULEMENT. AFFICHÉ AU-DESSUS DE TON NAVIRE EN LIGNE ET AU CLASSEMENT. MODIFIABLE DANS LES RÉGLAGES.',
  'ROLL A NAME': 'NOM AU HASARD', 'AHOY': 'OHÉ',
  // menu
  'CAPTAIN': 'CAPITAINE', 'Change name': 'Changer de nom', 'EDIT': 'MODIFIER', '(YOUR LAST VOYAGE)': '(TON DERNIER VOYAGE)',
  'PICK A MODE AND A SHIP': 'CHOISIS UN MODE ET UN NAVIRE', 'ONLINE': 'EN LIGNE', 'CO-OP OR PVP · 2 TO 4 PIRATES': 'COOP OU PVP · 2 À 4 PIRATES',
  'LEADERBOARD': 'CLASSEMENT', 'WAVES · CONVOY · WORLD': 'VAGUES · CONVOI · MONDE', 'SETTINGS': 'RÉGLAGES', 'SOUND · CONTROLS · LANGUAGE': 'SON · TOUCHES · LANGUE',
  'YOUR BEST': 'TON RECORD', '{0} GOLD': '{0} OR', '#{0} WORLD': '#{0} MONDIAL',
  // modes
  'WAVES': 'VAGUES', 'WAVE': 'VAGUE', 'CONVOY': 'CONVOI',
  'SURVIVE WAVE AFTER WAVE OF THE NAVY. EACH ONE HITS HARDER.': 'SURVIS AUX VAGUES SUCCESSIVES DE LA MARINE. CHACUNE FRAPPE PLUS FORT.',
  'ENDS WHEN YOU SINK': 'FIN : NAUFRAGE',
  'A LONG CROSSING BETWEEN TWO PORTS. HUNT DOWN ESCORTED MERCHANT CONVOYS.': 'UNE LONGUE TRAVERSÉE ENTRE DEUX PORTS. TRAQUE LES CONVOIS MARCHANDS ESCORTÉS.',
  'GOLD OVER SURVIVAL': 'L\'OR D\'ABORD',
  'Your ship surrounded by rings of enemy ships': 'Ton navire encerclé par des navires ennemis',
  'A merchant convoy sailing between two ports': 'Un convoi marchand naviguant entre deux ports',
  'LAST PLAYED': 'DERNIER JOUÉ', 'NEW': 'NOUVEAU', 'SOLO OR CO-OP': 'SOLO OU COOP', 'BEST': 'RECORD', 'NOT PLAYED': 'JAMAIS JOUÉ',
  'CHOOSE YOUR WAR': 'CHOISIS TA GUERRE', 'STEP 1 OF 2': 'ÉTAPE 1 SUR 2', 'NEXT : SHIP': 'SUIVANT : NAVIRE',
  // ship
  'CHOOSE YOUR SHIP': 'CHOISIS TON NAVIRE', 'CHANGE': 'CHANGER', 'LAST SAILED': 'DERNIER CHOISI',
  'SPEED': 'VITESSE', 'HANDLING': 'MANŒUVRE', 'HULL': 'COQUE', 'GUNS': 'CANONS', 'RELOAD': 'RECHARGE', 'CREW': 'ÉQUIPAGE',
  'STARTING SKILLS': 'COMPÉTENCES DE DÉPART', 'SLOTS 3 AND 4 UNLOCK AT SEA': 'LES EMPLACEMENTS 3 ET 4 SE DÉBLOQUENT EN MER',
  'Previous ship': 'Navire précédent', 'Next ship': 'Navire suivant',
  'Fast and nimble, but fragile': 'Rapide et agile, mais fragile', 'A balanced raider': 'Un pillard équilibré', 'A slow floating fortress': 'Une lente forteresse flottante',
  // skills, refit cards (sim.js SKILLS, UPGRADES). Skill names: 12 letters at most, they sit under a 60 px slot
  'Chain shot': 'Tir ramé', 'next broadside slows what it hits': 'la prochaine bordée ralentit ce qu\'elle touche',
  'Fire shot': 'Tir ardent', 'next broadside sets ships ablaze': 'la prochaine bordée embrase les navires',
  'Full salvo': 'Salve totale', 'every gun fires all around': 'tous les canons tirent tout autour',
  'Brace': 'Tenir bon', 'take 60% less damage for a while': '60 % de dégâts en moins un moment',
  'Full sail': 'Plein vent', 'burst of speed and handling': 'regain de vitesse et de maniabilité',
  'Powder keg': 'Baril', 'drop a floating mine behind you': 'largue une mine flottante derrière toi',
  'Smoke screen': 'Fumigène', 'enemies lose sight of you': 'les ennemis te perdent de vue',
  'Patch hull': 'Colmatage', 'instant hull repair': 'réparation immédiate de la coque',
  '+1 cannon per side': '+1 canon par bord', 'Reload 15% faster': 'Recharge 15 % plus rapide', '+25 hull, patched': '+25 coque, réparée',
  '+10% speed': '+10 % vitesse', '+15% range': '+15 % portée', '+25% shot damage': '+25 % dégâts des tirs',
  'Recruit: +8 crew': 'Recrues : +8 équipage', 'Carpenters: faster repair out of combat': 'Charpentiers : réparation plus rapide hors combat',
  'Learn {0}: {1}': 'Apprendre {0} : {1}', '{0} {1}: stronger, faster cooldown': '{0} {1} : plus fort, recharge plus rapide',
  'Refit your ship: click or press {0}, {1} or {2}': 'Améliore ton navire : clique ou appuie sur {0}, {1} ou {2}',
  'locked': 'verrouillé',
  // end of a run
  'OFF THE WORLD TOP 100': 'HORS DU TOP 100 MONDIAL', '#{0} THIS BROWSER': '#{0} CE NAVIGATEUR', 'Run over': 'Partie terminée', 'SUNK': 'COULÉ',
  'CREW OF {0}': 'ÉQUIPAGE DE {0}', 'GOLD': 'OR', 'BEST COMBO': 'MEILLEUR COMBO', 'NEW PERSONAL BEST': 'NOUVEAU RECORD PERSONNEL', 'SIGNED AS': 'SIGNÉ',
  'FIND A NEW CREW': 'NOUVEL ÉQUIPAGE', 'CHANGE SHIP': 'CHANGER DE NAVIRE', 'RUN OVER': 'FIN DE PARTIE',
  'Match over': 'Match terminé', 'VICTORY': 'VICTOIRE', 'REMATCH': 'REVANCHE',
  '{0} WINS · {1} SINKING': '{0} GAGNE · {1} NAVIRE COULÉ', '{0} WINS · {1} SINKINGS': '{0} GAGNE · {1} NAVIRES COULÉS',
  'WAITING FOR {0} TO START A REMATCH…': '{0} DOIT LANCER LA REVANCHE…',
  // pause
  'ONLINE : THE SEA DOES NOT STOP. YOUR SHIP DRIFTS.': 'EN LIGNE : LA MER NE S\'ARRÊTE PAS. TON NAVIRE DÉRIVE.',
  'Paused': 'En pause', 'PAUSED': 'PAUSE', 'PAUSE': 'PAUSE', 'QUIT TO MENU': 'RETOUR AU MENU', 'Confirm quit': 'Confirmer l\'abandon',
  'ABANDON SHIP ? THIS RUN ENDS AND THE SCORE IS NOT SIGNED.': 'ABANDONNER LE NAVIRE ? LA PARTIE S\'ARRÊTE ET LE SCORE N\'EST PAS SIGNÉ.',
  'YOUR CREW SAILS ON WITHOUT YOU.': 'TON ÉQUIPAGE CONTINUE SANS TOI.', 'YES, QUIT': 'OUI, QUITTER', 'STAY ABOARD': 'RESTER À BORD',
  // settings
  'AUDIO': 'AUDIO', 'CONTROLS': 'TOUCHES', 'DISPLAY': 'AFFICHAGE', 'PROFILE': 'PROFIL', 'SAVED AUTOMATICALLY': 'ENREGISTRÉ AUTOMATIQUEMENT',
  'MASTER': 'GÉNÉRAL', 'MUSIC': 'MUSIQUE', 'EFFECTS': 'EFFETS', '{0} down': '{0} moins', '{0} up': '{0} plus', 'TEST': 'TEST',
  'MUTE ALL': 'TOUT COUPER', 'Mute all sound': 'Couper tout le son', 'SOUND IS OFF': 'SON COUPÉ', 'SOUND IS ON': 'SON ACTIF', 'ANYWHERE': 'PARTOUT',
  'MUSIC GAINS DRUMS IN COMBAT. SEA AMBIENCE FOLLOWS EFFECTS.': 'LA MUSIQUE GAGNE DES TAMBOURS AU COMBAT. L\'AMBIANCE MARINE SUIT LES EFFETS.',
  'Change key for {0}': 'Changer la touche pour {0}', 'PRESS A KEY…': 'APPUIE…', 'KEYS SHOWN FOR YOUR KEYBOARD': 'TOUCHES AFFICHÉES POUR TON CLAVIER',
  'RESET TO DEFAULTS': 'RÉINITIALISER', 'PRESS THE NEW KEY FOR': 'APPUIE SUR LA NOUVELLE TOUCHE POUR', 'CANCEL': 'ANNULER',
  'ALREADY SETS': 'SERT DÉJÀ À', 'SWAP THEM ?': 'LES ÉCHANGER ?', 'SWAP KEYS': 'ÉCHANGER', 'RESET KEYS ?': 'RÉINITIALISER LES TOUCHES ?',
  'EVERY KEY GOES BACK TO ITS DEFAULT.': 'CHAQUE TOUCHE REVIENT À SA VALEUR PAR DÉFAUT.', 'RESERVED KEY': 'TOUCHE RÉSERVÉE',
  'SAIL UP': 'HISSER LES VOILES', 'SAIL DOWN': 'AFFALER LES VOILES', 'TURN LEFT': 'VIRER À GAUCHE', 'TURN RIGHT': 'VIRER À DROITE',
  'FIRE PORT (LEFT)': 'FEU BÂBORD (GAUCHE)', 'FIRE STARBOARD (RIGHT)': 'FEU TRIBORD (DROITE)', 'SKILLS 1 TO 4': 'COMPÉT. 1 À 4', 'SKILL {0}': 'COMPÉTENCE {0}',
  'BOARD': 'ABORDER', 'OVERVIEW (ZOOM)': 'VUE D\'ENSEMBLE', 'MUTE': 'MUET',
  'FULLSCREEN': 'PLEIN ÉCRAN', 'Fullscreen': 'Plein écran', 'ALSO': 'AUSSI', 'KEY HINTS BAR': 'AIDE TOUCHES', 'Key hints bar': 'Barre des touches',
  'THE STRIP AT THE BOTTOM IN GAME': 'LA BANDE DU BAS EN JEU', 'LANGUAGE': 'LANGUE', 'Language': 'Langue',
  'ROLL': 'HASARD', 'SAVE': 'ENREGISTRER', 'NAME SAVED · {0}': 'NOM ENREGISTRÉ · {0}',
  'A TO Z, 12 LETTERS MAX. SCORES ALREADY ON THE BOARD KEEP THE NAME THEY WERE SIGNED WITH.': 'DE A À Z, 12 LETTRES MAX. LES SCORES DÉJÀ AU CLASSEMENT GARDENT LE NOM AVEC LEQUEL ILS ONT ÉTÉ SIGNÉS.',
  // leaderboard
  'YOUR CREW': 'TON ÉQUIPAGE', 'YOU': 'TOI', 'HALL OF INFAMY': 'PANTHÉON DE L\'INFAMIE', 'Crew size': 'Taille d\'équipage', 'Scope': 'Portée',
  'WORLD': 'MONDE', 'THIS BROWSER': 'CE NAVIGATEUR', 'SHIPS': 'NAVIRES',
  'WORLD BOARD UNREACHABLE. THIS BROWSER STILL HAS YOUR RUNS.': 'CLASSEMENT MONDIAL INJOIGNABLE. CE NAVIGATEUR GARDE TES PARTIES.',
  'READING THE WORLD BOARD…': 'LECTURE DU CLASSEMENT MONDIAL…',
  'NO CREW RUN SIGNED YET.': 'AUCUNE PARTIE EN ÉQUIPAGE SIGNÉE.', 'NO SOLO RUN SIGNED YET.': 'AUCUNE PARTIE SOLO SIGNÉE.',
  'THIS BROWSER · TOP 10': 'CE NAVIGATEUR · TOP 10', 'WORLD TOP 100': 'TOP 100 MONDIAL', 'CREW SCORES RANKED APART FROM SOLO': 'ÉQUIPAGES CLASSÉS À PART DES SOLOS',
  'WORLD BOARD UNREACHABLE · SAVED ON THIS BROWSER': 'CLASSEMENT MONDIAL INJOIGNABLE · ENREGISTRÉ SUR CE NAVIGATEUR',
  // online hub, lobby
  'CO-OP · WAVES': 'COOP · VAGUES', 'HOLD THE LINE TOGETHER': 'TENEZ LA LIGNE ENSEMBLE', 'CO-OP · CONVOY': 'COOP · CONVOI', 'RAID THE MERCHANTS': 'PILLEZ LES MARCHANDS',
  'FIRST TO 10 SINKINGS · 5 MIN': '10 NAVIRES COULÉS · 5 MIN', 'FIRST TO 10 SINKINGS OR BEST SCORE AFTER 5 MIN': '10 NAVIRES COULÉS OU MEILLEUR SCORE APRÈS 5 MIN',
  'GATHER A CREW': 'RÉUNIS UN ÉQUIPAGE', 'ONLINE UNAVAILABLE · SOLO STILL WORKS': 'EN LIGNE INDISPONIBLE · LE SOLO MARCHE', 'CONNECTED AS': 'CONNECTÉ :',
  'QUICK MATCH': 'PARTIE RAPIDE', 'SAIL WITH STRANGERS. THE SHIP LEAVES 15 S AFTER THE ROOM OPENS, FULL OR NOT.': 'NAVIGUE AVEC DES INCONNUS. LE NAVIRE PART 15 S APRÈS L\'OUVERTURE DU SALON, PLEIN OU NON.',
  'CREATE A ROOM': 'CRÉER UN SALON', 'PRIVATE. FRIENDS JOIN WITH A 4-LETTER CODE. YOU PICK THE MODE INSIDE AND SET SAIL WHEN READY.': 'PRIVÉ. TES AMIS REJOIGNENT AVEC UN CODE DE 4 LETTRES. TU CHOISIS LE MODE À L\'INTÉRIEUR ET LÈVES L\'ANCRE QUAND TU VEUX.',
  'CREATE ROOM': 'CRÉER', 'JOIN A ROOM': 'REJOINDRE UN SALON', 'TYPE THE CODE YOUR CAPTAIN GAVE YOU. PASTE WORKS TOO.': 'TAPE LE CODE DONNÉ PAR TON CAPITAINE. COLLER MARCHE AUSSI.',
  'ROOM CODE': 'CODE DU SALON', 'JOIN': 'REJOINDRE',
  'THE CAPTAIN': 'LE CAPITAINE', 'SEARCHING…': 'RECHERCHE…', 'ANYONE CAN STILL JOIN': 'ENCORE OUVERT À TOUS', 'WAITING FOR A PIRATE…': 'EN ATTENTE D\'UN PIRATE…',
  'SHARE THE CODE {0}': 'PARTAGE LE CODE {0}', 'OPEN SEAT': 'PLACE LIBRE', 'SEAT {0}': 'PLACE {0}', 'CAPTAIN · YOU': 'CAPITAINE · TOI',
  'NO SHIP YET': 'PAS ENCORE DE NAVIRE', 'PICKING A SHIP': 'CHOISIT UN NAVIRE', 'NOT READY': 'PAS PRÊT', 'PRIVATE ROOM': 'SALON PRIVÉ', 'ROOM {0}': 'SALON {0}',
  '{0}/4 PIRATES': '{0}/4 PIRATES', '{0}/4 PIRATES ABOARD': '{0}/4 PIRATES À BORD', 'RUN UNDER WAY': 'PARTIE EN COURS',
  'WAITING FOR PIRATES…': 'PIRATES ATTENDUS…', 'SETTING SAIL IN': 'DÉPART DANS', 'Copy room code': 'Copier le code du salon', 'COPIED': 'COPIÉ', 'COPY': 'COPIER',
  'ONLY YOU CAN CHANGE IT': 'TOI SEUL PEUX LE CHANGER', 'THE CAPTAIN CHOOSES': 'LE CAPITAINE CHOISIT', 'YOUR SHIP': 'TON NAVIRE', 'JOIN THE RUN': 'REJOINDRE LA PARTIE',
  'LEAVE ROOM': 'QUITTER LE SALON', 'SET SAIL ALONE · 1/4': 'PARTIR SEUL · 1/4', 'SET SAIL · ALL READY': 'LEVER L\'ANCRE · TOUS PRÊTS',
  'SET SAIL · {0}/{1} READY': 'LEVER L\'ANCRE · {0}/{1} PRÊTS', 'NOT PICKED AT 0 = YOUR LAST SHIP': 'PAS DE CHOIX À 0 = TON DERNIER NAVIRE',
  'READY PUTS YOUR SHIP TO SEA': 'PRÊT MET TON NAVIRE À L\'EAU', 'WAITING FOR {0} TO SET SAIL…': '{0} DOIT LEVER L\'ANCRE…',
  // network messages (game.js)
  'MATCHMAKING UNREACHABLE': 'MATCHMAKING INJOIGNABLE', 'NO MATCH FOUND · TRY AGAIN': 'AUCUNE PARTIE TROUVÉE · RÉESSAIE', '{0} LEFT': '{0} EST PARTI',
  'JOINED PVP · PICK YOUR SHIP': 'PVP REJOINT · CHOISIS TON NAVIRE', 'JOINED CO-OP · PICK YOUR SHIP': 'COOP REJOINTE · CHOISIS TON NAVIRE',
  'OPENING ROOM…': 'OUVERTURE DU SALON…', 'A PIRATE JOINED · COME BACK': 'UN PIRATE EST ARRIVÉ · REVIENS', 'COULD NOT OPEN A ROOM': 'IMPOSSIBLE D\'OUVRIR UN SALON',
  'ENTER THE 4-LETTER ROOM CODE.': 'ENTRE LE CODE DU SALON À 4 LETTRES.', 'CONNECTING…': 'CONNEXION…', 'ROOM FULL, CLOSED OR UNREACHABLE': 'SALON PLEIN, FERMÉ OU INJOIGNABLE',
  'HOST LEFT': 'L\'HÔTE EST PARTI', '{0} LEFT THE ROOM. THE CREW IS DISBANDED.': '{0} A QUITTÉ LE SALON. L\'ÉQUIPAGE EST DISSOUS.',
  'ROOM NOT FOUND. CHECK THE CODE WITH YOUR CAPTAIN.': 'SALON INTROUVABLE. VÉRIFIE LE CODE AVEC TON CAPITAINE.',
  'CONNECTION FAILED': 'CONNEXION ÉCHOUÉE', 'THE ROOM CAN NOT BE REACHED.': 'LE SALON EST INJOIGNABLE.', 'RETRY': 'RÉESSAYER',
  'WAITING FOR THE HOST…': 'EN ATTENTE DE L\'HÔTE…',
  // HUD
  'SAIL': 'VOILES', 'PORT': 'BÂBORD', 'STAR': 'TRIBORD', 'NAVY GOLD': 'OR DE LA MARINE', 'COMBO': 'COMBO', 'DEFENDERS': 'DÉFENSEURS', 'KN': 'ND',
  'when the cursor is on the gold mark': 'quand le curseur est sur la marque dorée',
  'sail up/down': 'voiles', 'turn': 'virer', 'fire left': 'bâbord', 'fire right': 'tribord', 'skills': 'compétences', 'board': 'aborder',
  'sound': 'son', 'zoom': 'zoom', 'pause': 'pause',
  'QUICK': 'RAPIDE', 'ROOM': 'SALON', 'ONLINE · {0} · {1} PIRATES': 'EN LIGNE · {0} · {1} PIRATES', 'CO-OP': 'COOP', 'BOARD (AUTO)': 'ABORDER (AUTO)',
  // banners, floating texts
  'FORT DESTROYED · +{0} GOLD': 'FORT DÉTRUIT · +{0} OR', 'FORT DESTROYED': 'FORT DÉTRUIT',
  'CONVOY SIGHTED': 'CONVOI EN VUE', 'ARMED MERCHANT SIGHTED': 'MARCHAND ARMÉ EN VUE', 'MERCHANT SIGHTED': 'MARCHAND EN VUE',
  'CONVOY {0} · {1} → {2}': 'CONVOI {0} · {1} → {2}', 'WAVE {0} · THE FORT IS REBUILT': 'VAGUE {0} · LE FORT EST REBÂTI',
  'WAVE {0} · THE FORT OPENS FIRE': 'VAGUE {0} · LE FORT OUVRE LE FEU', 'WAVE {0}': 'VAGUE {0}',
  '{0} SETS SAIL': '{0} LÈVE L\'ANCRE', 'THIS RUN IS OVER': 'CETTE PARTIE EST FINIE', '{0} JOINS · {1}': '{0} ARRIVE · {1}',
  'FIRST TO 10 SINKINGS': 'LE PREMIER À 10 NAVIRES COULÉS',
  '{0} TAKEN · {1} MADE PORT': '{0} PRIS · {1} ARRIVÉS AU PORT', '{0} TAKEN · {1} MADE PORT · ESCORT REINFORCED': '{0} PRIS · {1} ARRIVÉS AU PORT · ESCORTE RENFORCÉE',
  'WAVE CLEARED · REPAIRS': 'VAGUE NETTOYÉE · RÉPARATIONS', 'SUDDEN DEATH · NEXT SINKING WINS': 'MORT SUBITE · QUI COULE L\'AUTRE GAGNE',
  'ESCAPED · +{0} NAVY GOLD': 'ÉCHAPPÉ · +{0} OR DE LA MARINE', 'ESCAPED': 'ÉCHAPPÉ', 'THE KRAKEN RISES': 'LE KRAKEN SURGIT', 'THE KRAKEN IS SLAIN': 'LE KRAKEN EST TERRASSÉ',
  '+HULL': '+COQUE', 'POINT BLANK': 'BOUT PORTANT', '{0} IS SUNK': '{0} A COULÉ', '{0} SANK': '{0} A COULÉ', '{0} SANK {1}': '{0} A COULÉ {1}',
  '+{0} CREW': '+{0} ÉQUIPAGE', 'MERCHANT CAPTURED': 'MARCHAND CAPTURÉ', 'SHIP CAPTURED': 'NAVIRE CAPTURÉ',
  'MERCHANT CAPTURED · STRUCK HER COLOURS': 'MARCHAND CAPTURÉ · PAVILLON AMENÉ', 'SHIP CAPTURED · STRUCK HER COLOURS': 'NAVIRE CAPTURÉ · PAVILLON AMENÉ',
  // boarding
  'BOARDING!': 'À L\'ABORDAGE !', 'THEY SURRENDER!': 'ILS SE RENDENT !', 'REPELLED!': 'REPOUSSÉS !', 'REPELLED': 'REPOUSSÉS', 'GRAPPLES OUT!': 'GRAPPINS LANCÉS !',
  'PERFECT! -{0} DEFENDERS': 'PARFAIT ! -{0} DÉFENSEURS', 'HIT! -{0} DEFENDERS': 'TOUCHÉ ! -{0} DÉFENSEURS', 'MISSED! -{0} CREW': 'RATÉ ! -{0} ÉQUIPAGE',
};

export let lang = store.lang;
export function setLang(l) { store.lang = lang = l === 'fr' ? 'fr' : 'en'; }

// t('WAVE {0}', 3): the text in the player's language, {n} filled in
export const t = (s, ...p) => String(lang === 'fr' && Object.hasOwn(FR, s) ? FR[s] : s).replace(/\{(\d)\}/g, (_, i) => p[i]);
// one or many: English counts 1 as one, French 0 and 1
export const tn = (n, one, many, ...p) => t((lang === 'fr' ? n < 2 : n === 1) ? one : many, ...p);
// marks a key that is translated later, where it is shown (a table, a message sent to the other players)
export const tk = (s) => s;
// a message that travels as [key, ...params] (banners and floating texts: every player reads them in their own language), or plain text
export const say = (m) => (Array.isArray(m) ? t(String(m[0]), ...m.slice(1, 6).map(String)) : String(m ?? ''));

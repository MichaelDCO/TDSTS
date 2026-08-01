# Rachidus TD — Défends la Flèche

Tower defense **roguelite** dans un univers inspiré de Slay the Spire, mâtiné du mode
Blight de Path of Exile (portails qui s'ouvrent en plein combat) et de l'économie de
Teamfight Tactics (boutique aléatoire, reroll, intérêts, plateau limité).

Jeu navigateur, 100 % TypeScript + Canvas 2D, zéro framework de jeu.

**➡️ Jouer en ligne : https://michaeldco.github.io/TDSTS/**

## Lancer le jeu en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173

## La boucle de jeu

- **Une run = 10 combats** de difficulté croissante : 2 élites (Gremlin Nob, Lagavulin)
  et un boss final (le Roi des Slimes, qui se scinde à sa mort).
- **Portails dynamiques** : chaque carte a plusieurs portails reliés au Cœur par des
  fissures. De nouveaux portails s'activent en cours de combat — l'interface télégraphie
  (« ⚠️ un portail s'ouvrira après cette vague ») pour vous laisser redéployer.
- **Boutique à la TFT** : tirage aléatoire (rareté croissante avec l'avancement),
  reroll payant, rafraîchissement gratuit à chaque vague, **intérêts** (+1 or par
  tranche de 10, plafonné).
- **Plateau limité à la TFT** : nombre de tours déployées plafonné (7 + n° du combat),
  extensible en payant (⛺ +1 déploiement, prix croissant). Vos tours sont conservées
  de combat en combat et redéployées sur chaque nouvelle carte.
- **Augments à la Slay the Spire** : après chaque combat, choix de 1 augment parmi 3
  (mélange d'augments généraux et propres à la classe, avec raretés et 1 reroll gratuit).
- Le Cœur conserve ses PV d'un combat à l'autre (petit soin entre les combats) :
  chaque fuite compte, comme dans StS.

## Les classes

| | Style | Passif |
|---|---|---|
| 🛡️ **Ironclad** | Dégâts bruts, saignement, feu, zones | Sang Brûlant : +8 PV au Cœur après chaque combat |
| 🐍 **La Silencieuse** | Poison cumulable, dagues, ralentissements, crits | Anneau du Serpent : 6 tours en boutique au lieu de 5 |
| ⚡ **Le Defect** | Orbes : foudre en chaîne, givre, rayons hitscan, auras de cadence | Focalisation : +1 tour déployable en permanence |
| 👁️ **La Watcher** | Postures : ses tours alternent Calme (retenue) et Colère (dégâts ×2,2) | Divination : l'aperçu révèle aussi la vague suivante |

La Silencieuse est volontairement plus technique (comme dans StS) : ses poisons
demandent d'anticiper, ses ralentissements de bien placer. Le Defect récompense
les regroupements (les éclairs rebondissent) et la croissance longue (Recalibrage).
La Watcher joue le tempo : gardez vos vagues difficiles pour les fenêtres de Colère.

## Bande-son

Tout est **synthétisé en WebAudio, style 8 bits** : effets (pièces, éclairs, alarmes)
et musique chiptune générée par un séquenceur maison — 3 pistes (menu, combat, boss),
basse triangle, mélodie square, percussions bruit. Touche **M** pour couper le son.

## Contrôles

- **Clic** sur une carte de la réserve → mode placement → **clic** sur une case libre
  (hors fissures). On peut poser des tours **pendant une vague** (esprit Blight).
- **Clic** sur une tour posée : stats, reprendre en réserve, vendre (prix plein).
- **Clic droit / Échap** : annuler. **Espace** : pause. **1 / 2 / 3** : vitesse de jeu.
- **R** : relancer la boutique. **L** : verrouiller la boutique. **M** : couper le son.

## Architecture

```
src/
  const.ts        constantes & courbes (PV ennemis, plafonds, probabilités boutique)
  types.ts        tous les types partagés
  rng.ts          RNG seedé (mulberry32) par run
  data/           contenu : tours, ennemis, augments, cartes, plan des combats
  state.ts        état de la run, modificateurs, stats effectives, augments
  shop.ts         économie : boutique, achat/vente, placement, plafond de déploiement
  combat.ts       simulation : déplacements, ciblage anti-overkill, DoTs, scissions
  render.ts       rendu Canvas (cartes, portails, ennemis, projectiles, particules)
  ui.ts           DOM : HUD, boutique, réserve, modales (classe, augments, fin)
  devbot.ts       bot de playtest automatisé (mode dev uniquement)
  main.ts         boucle de jeu, entrées, câblage
```

## Bot de playtest (dev)

En mode dev, un bot headless est exposé dans la console du navigateur :

```js
__bot()                                   // run Ironclad, stratégie honnête
__bot({ classIdx: 1 })                    // La Silencieuse
__bot({ cheatGold: 900, deployAt: 0 })    // stress test riche
```

Il joue une run complète (achats, placements par couverture de chemin, augments
priorisés) et renvoie un rapport par combat — c'est l'outil d'équilibrage principal.

État d'équilibrage actuel : le bot honnête **gagne avec l'Ironclad** et meurt vers le
combat 8-9 avec la Silencieuse ; un humain qui exploite les synergies fait mieux.

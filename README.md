# 🏡 Gougou House

**A cozy little game for decorating your future home together.** Pick a space, lay real-looking floors, then drag in sofas, beds, rugs and plants at their real sizes. **Gougou the pup 🐶** explores every room you make.

**Play in 3D:** a dollhouse view with real walls (with cut-outs for the doors and windows), sunlight and soft shadows, glowing lamps and 3D furniture. Spin around the room and drag pieces across the floor. Switch to **2D** any time for the precise top-down plan.

Everything is drawn with real materials:
- **Floors:** wood planks with grain, tile, marble, concrete, carpet, decking and grass.
- **Furniture:** fabric weave and wood grain, with soft shadows.
- **Rugs:** Persian, Berber, striped, shag, round jute and a kilim runner. Each one moves like any other piece.

The textures are generated in the browser, so there are no image files to download.

No installs and no accounts. Open it and play.

## How to play

1. **Open `index.html`** in your browser (or host it, see below).
2. You start in an **empty 1-bedroom**. Pick a category on the shelf (🛋️ Living, 🛏️ Bedroom, 🍳 Kitchen, 🐶 Pets…) and **drag** a piece onto the plan. You can also tap it to drop it in the middle.
3. **Arrange things** (in 3D or 2D):
   - **3D camera:** drag the floor to spin around, right-drag (or use two fingers) to pan, scroll or pinch to zoom.
   - **🧱 Walls:** cycles between *Cutaway* (walls facing you are cut low, like a dollhouse), *Walls up* and *Walls down*.
   - **Move:** drag a piece. Rooms carry their furniture with them; hold <kbd>Alt</kbd> to move a room on its own.
   - **Resize:** drag the orange dot (in 2D), or type a width and depth in the panel.
   - **Rotate:** <kbd>R</kbd>.
   - **Recolor:** pick a fabric, wood finish or rug color in the little panel that pops up.
   - **Change a floor:** click a room and pick one of the 11 floors (light oak, walnut, gray oak, white tile, terracotta, checkerboard, marble, concrete, carpet, wood deck, grass).
   - **Delete / copy:** <kbd>Del</kbd> deletes, <kbd>Ctrl/⌘ D</kbd> makes a copy.
   - **Undo / redo:** <kbd>Ctrl/⌘ Z</kbd> undoes, <kbd>Ctrl/⌘ Shift Z</kbd> redoes.
   - **Zoom and pan:** scroll to zoom, drag empty space to pan.
4. **Build rooms** from the 🚪 **Rooms** shelf, or press **＋** for a new space:
   - studio loft
   - cozy 1-bedroom
   - 2-bedroom apartment
   - little house with a yard
   - blank canvas

   Each comes **empty** (you furnish it) or **already furnished**.
5. Pieces that overlap get a red outline, and the counter in the top-left shows them as "bumping".
6. **📸 Picture** saves a PNG: the 3D view as you see it, or the floor plan in 2D.

### Meet Gougou

Gougou (a top-down shiba) wanders from room to room, walks *around* your furniture (never through it), naps on the dog bed if you give one, and has opinions about what you add ("Is that… for ME?! 🥹"). Click Gougou for a pat. The **🐶 Gougou** button hides or shows the pup.

## Playing on two devices

- **⋯ → Copy a link to send** shares one design. Whoever opens the link can add it to their own designs.
- **⚙️ → Download backup** saves every design to a file, which you can open on another device.

Links work best when the game is online (below).

## Put it online for free (GitHub Pages)

1. On GitHub, open the repo's **Settings → Pages**.
2. Set *Source* to "Deploy from a branch", pick your branch and `/ (root)`, then save.
3. After a minute it's live at `https://<your-username>.github.io/<repo-name>/`. Add it to both phones' home screens.

To run it locally: `python3 -m http.server 8000`, then open http://localhost:8000.

## Project layout

Plain HTML/CSS/JS with no build step. The only library is [three.js](https://threejs.org) r170 (MIT, in `vendor/`), converted into an ordinary script so the game also works when you open `index.html` directly from a folder.

```
index.html       page shell
css/styles.css   all styling (desktop + phone)
js/util.js       helpers: units, modal, toast, share links, mascot
js/data.js       furniture catalog (real sizes, in inches), room types, starter spaces
js/store.js      saved designs (localStorage)
js/textures.js   procedural floor, fabric, wood-grain and stone textures
js/render.js     realistic top-down drawing for every piece of furniture and rug
js/models3d.js   3D models for every piece (and for Gougou)
js/view3d.js     the 3D view: walls, floors, lighting, camera, picking and dragging
vendor/          three.js + OrbitControls
js/dog.js        Gougou: pathfinding, wandering, napping, chatting
js/game.js       the editor: shelf, drag & drop, undo, inspector, export
js/app.js        boot, settings, backups, share links
```

Want more furniture or another starter space? Add it to `js/data.js` and the game picks it up automatically. Gougou's lines live at the top of `js/dog.js`.

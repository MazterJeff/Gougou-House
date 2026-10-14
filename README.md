# 🏡 Gougou House

**A cozy little game for decorating your future home together.** Pick a space, drag in sofas, beds, rugs and plants at their real sizes, and watch **Gougou the pup 🐶** explore every room you make.

No installs and no accounts. Open it and play.

## How to play

1. **Open `index.html`** in your browser (or host it, see below).
2. You start in an **empty 1-bedroom**. Pick a category on the shelf (🛋️ Living, 🛏️ Bedroom, 🍳 Kitchen, 🐶 Pets…) and **drag** a piece onto the plan. You can also tap it to drop it in the middle.
3. **Arrange things:**
   - **Move:** drag a piece. Rooms carry their furniture with them; hold <kbd>Alt</kbd> to move a room on its own.
   - **Resize:** drag the orange dot.
   - **Rotate:** <kbd>R</kbd>.
   - **Recolor:** pick a swatch in the little panel that pops up.
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
6. **📸 Picture** saves a PNG of your design.

### Meet Gougou

Gougou wanders from room to room, walks *around* your furniture (never through it), naps on the dog bed if you give one, and has opinions about what you add ("Is that… for ME?! 🥹"). Click Gougou for a pat. The **🐶 Gougou** button hides or shows the pup.

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

Plain HTML/CSS/JS with no build step and no dependencies.

```
index.html       page shell
css/styles.css   all styling (desktop + phone)
js/util.js       helpers: units, modal, toast, share links, mascot
js/data.js       furniture catalog (real sizes, in inches), room types, starter spaces
js/store.js      saved designs (localStorage)
js/dog.js        Gougou: pathfinding, wandering, napping, chatting
js/game.js       the editor: shelf, drag & drop, undo, inspector, export
js/app.js        boot, settings, backups, share links
```

Want more furniture or another starter space? Add it to `js/data.js` and the game picks it up automatically. Gougou's lines live at the top of `js/dog.js`.

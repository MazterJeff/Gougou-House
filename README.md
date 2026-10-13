# 🏡 Gougou House

**Design your future home, together.** A cozy little web app for two people planning a home: find your shared style, decide what really matters, sketch floor plans with real furniture sizes, and make the money add up. Gougou the pup 🐶 helps along the way.

No accounts and no server. Everything stays in your browser.

## How to use it (the short version)

1. **Open it.** Double-click `index.html`, or host it (see below) so you can both open it on your phones.
2. **Say who you are.** Gougou asks for both names on first launch.
3. **Each of you plays _This or That_ separately.** 18 quick picks. When you've both finished, you get your **home's style blend** (e.g. *Nordic Zen*, *Desert Modern*), a taste-match score, and a list of exactly where you differ.
4. **Each of you rates the _Wishlist_.** ❤️ must / 👍 nice / 🤷 don't care / 🙅 rather not, for ~50 features (add your own too). You only see your partner's answer after you've given yours. Gougou sorts out your **shared must-haves**, your **big talks** (one must-have vs. one "rather not") and your **easy skips**.
5. **Talk.** The home page deals out **conversation cards** ("Where does the dog sleep? Be honest.").
6. **Mood Board.** Heart palettes (💞 when you both do), pin photos (drag and drop or paste), image links, notes and colors, and tag them by room.
7. **Floor Plans.** Start from a template (1-bed, 2-bed, little house with a yard) or a blank canvas. Drag rooms and real-size furniture around, resize, rotate, and get warnings when pieces overlap. A **Wishlist check** confirms the plan has the things you both said you want. Make several options and each heart your favorite. Export as PNG or SVG.
8. **Budget.** Monthly cost for buying (mortgage, tax, insurance, HOA) or renting, how affordable it is against your take-home pay, a **50/50 vs. income-based split**, and a move-in shopping list you can fill straight from your floor plan with ballpark prices.

Use **"Who's here?"** in the top-right to switch between the two of you on a shared device.

## Using it on two phones

Open ⚙️ **Settings → Share with your partner**:

- **Copy share link**: sends your copy as a link. Your partner opens it and picks **Merge**, which brings in *your* quiz and wishlist answers plus any new plans, pins and budget items, and leaves theirs alone. (Uploaded photos are left out of links to keep them short.)
- **Download backup file**: everything, photos included. Open it on the other device with **Open a backup / partner file**.

Share links only work when the app is hosted at a URL you both can open. Backup files always work.

## Hosting it for free on GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**, set *Source* to "Deploy from a branch", pick your branch and `/ (root)`, then save.
3. After a minute it's live at `https://<your-username>.github.io/<repo-name>/`. Bookmark it on both phones (or use "Add to Home Screen").

To run it locally with a server (needed for share links to point anywhere useful):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Project layout

Plain HTML/CSS/JS with no build step and no dependencies.

```
index.html            app shell + nav
css/styles.css        all styling (responsive)
js/util.js            helpers: escaping, units, modal, toast, share-link encoding, mascot
js/data.js            content: styles, quiz, wishlist, furniture sizes, templates, palettes, conversation cards
js/store.js           state + localStorage persistence + merge logic
js/insights.js        derived results: style scores, agreement, blends, wishlist buckets
js/app.js             router, "who's here?", welcome, settings, sharing
js/views/*.js         one file per page (home, quiz, wishlist, planner, mood, budget)
docs/viewing-checklist.md   a printable checklist for apartment / house viewings
```

### Making it yours

Most of the fun is in `js/data.js`. Add quiz questions, wishlist items, furniture with real dimensions (in inches), new starter floor plans, palettes or conversation cards, and the app picks them up automatically.

## Privacy

Data lives in your browser's `localStorage` on each device. Nothing is sent anywhere. Clearing site data erases it, so download a backup now and then.

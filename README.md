# EmsNook

A cozy, low-light app for book readers. Keep a **To Read** list, and a **bookshelf** of what you're reading and have finished.

- **To Read**: front covers, hover a card to flip it and read a snippet of the back, fan ratings, sort by rating.
- **Book viewer**: pick a book and it slides out and turns to its front cover. Flip it over to read the back cover (blurb, fan score, barcode).
- **My Shelf**: a modern walnut-and-greenery bookshelf in warm low light. Zoom (slider, ctrl/trackpad pinch, or two fingers) to read the spines. A lamp follows your cursor.
- **Rearrange**: drag a book to a new spot on the shelf (on a phone, press and hold, then drag). Alt+arrow keys move a focused book. The order is saved to your account.
- **Customize**: wallpaper (11), wood finish (7), lighting (candlelit / evening / daylight) and decorations (plants & candles / plants only / bare). Saved to your account.
- **Real-looking books and plants**: the plants are real photographs (from Unsplash, cut out from their backgrounds; credits are in the account menu). Each spine takes its colours from the book's real cover. You can also add a photo of your own copy's real spine, and it replaces the generated one on your shelf.
- **Book size**: open any book you own and use "Size on the shelf" to make it thicker/thinner or taller/shorter; it applies on both the classic and 3D shelves, with a reset to normal.- **Build your own library (3D)**: shelves start empty. Hold a book (press-and-hold on a phone, drag with a mouse) and drop it on any shelf in the room, upstairs too; a glow shows where it will stand and where each book stands is saved to your account. The entrance wall is a fireplace (marble, stone or carved wood; roaring, embers or out) with a painting, clock and candlesticks, flanked by bookcases. Customize has tabs for Look, Room (floor, rug, ceiling, time of day, light rays), Shelves (style, back colour, shelf lighting, optional decorative books), Furniture (desk style and top, armchairs) and Fire & light (fireplace, fire, four chandelier styles in three finishes, brightness). Everything is touch-friendly: a walking stick and look-by-dragging on a phone, tap the floor to walk, bottom-sheet customizer.
- **Real surfaces and skies (3D)**: wood grain, herringbone parquet, oak planks, leather, marble, stone, plaster and the wool of the rug are photographs (Poly Haven, CC0, in `public/room`, loaded after the first frame and cached on the device), colourised to whichever finish you pick. Every window, including the glass over the doors, is a real opening onto a generated 3D landscape (not a picture): a fairy-tale castle of cream stone with teal and blue spired roofs, gilded finials, battlements, buttresses, waving flags, a gatehouse, a chapel and a long arched viaduct, standing on a terraced crag with a waterfall into a lake; a patchwork valley of fields with a village, meadows with swaying grass and wildflowers, lumpy shaded trees (pines, leafy, golden and blossom), layered misty mountains, all under a procedural sky with clouds, sun, moon and stars. It is the same place at every time of day; golden hour, day and night only change its light, sky and which windows glow. Flocks of birds cross it now and then and, very rarely, a black dragon silhouette (bat wings that sweep in a travelling wave, a lashing tail, a puff of fire) flies past. Light rays fall through the door transom and the side windows. The chandelier is a modelled two-tier brass piece with scrolled arms, candles, bead swags and crystal drops.
- **The desk, item by item**: pick the desk (writing, executive, modern), its top, and what stands on it: banker's or oil lamp, antique globe or armillary sphere, stacked or open book, inkwell and quill or a typewriter, tea for one, a succulent, a carriage clock.
- **Scan to add (barcode)**: the Scan button opens the camera (works on iPhone Safari over HTTPS or localhost). Hold the barcode on the back of a book in the frame; the ISBN is read, looked up in Open Library, and shown with its cover for you to confirm (Reading, Finished or To read) before it is added. It keeps scanning so a whole shelf can be added in one go. You can also type an ISBN or choose a photo of the barcode.
- **Series**: books are tagged with their series (from the catalog, or the title) and placed next to their series-mates in volume order when added. "Organize" in the 3D room arranges every book by author with each series kept together and in order. Publishers' imprints (Penguin Classics, SparkNotes guides and so on) are not treated as series.
- **Holding books and browsing shelves (3D)**: tap a book and it comes off the shelf into your hand with its real cover showing; keep walking, climbing or browsing with it, tap it to open the usual book page, or tap any empty shelf spot to put it down ("Put back" returns it). Tapping a bookcase, "My books" or "Top shelves" steps up to a straight-on view of one shelf at reading distance, at any height on either floor, with arrow buttons (or the arrow keys) to move along, up and down the shelves. The gallery meets the walls at both ends, you cannot walk through the railing or while the camera is on the ladder, and the windows (seven of them) look out on a countryside that follows the time of day.
- **The 3D library (default view)**: a walkable two-storey reading room in WebGL (three.js, code-split so it only downloads when opened), modelled on a grand library: arched door under a carved pediment, built-in bookcases, fluted columns, a gallery behind a turned balustrade, coffered ceiling, tall window with light shafts and drifting dust, a candle chandelier, Persian rug, writing desk with a spinnable globe, tufted chair, leather armchair, lamps and a rolling ladder. Everything is generated in code (no models or photos). Drag to look, W A S D / arrows / mouse wheel / on-screen stick to walk, tap the floor to walk there, click a bookcase to step up to it. Your books stand on the shelves by the door with real spines; click one to take it down (opens the usual book viewer), drag one onto another to rearrange (saved to your account), click lamps, globe, chandelier, and the ladder to climb to the gallery. Wood finish, wallpaper, lighting and "Just my books" from Customize apply here too. The flat shelf below is kept as "Classic view" (also the automatic fallback without WebGL).
- **A grand reading room (classic view)**: the shelf is the main floor of a library: tall arched windows with slanting light, a chandelier, an upper gallery behind a turned balustrade, built-in bays divided by pilasters and stocked with leather-bound volumes (your own books stay in the order you set, and "Just my books" in Customize removes the decorative ones), a library ladder that scales with the case, and a dark wooden floor in perspective. Scrolling stays smooth because pointer movement is batched per frame and the bookcase is rendered once as a layer; a service worker keeps the app files and photos on the device, and the shelf appears instantly from a local copy of your library.
- **Reading tracker**: a book you're reading gets a tracker in its viewer: set your page by slider, number or +10/+25/+50, see the percentage ring, pages left, today's pages, pace (from the last two weeks), reading streak, a 14-day chart and a "finish by" date. You can correct the page count of your edition, get a nudge at 25/50/75%, and finish the book from the last page. The spine of a book in progress shows a small gauge and its percentage on hover.
- **The bookcase**: modelled on a Victorian Gothic library case: a pierced tracery crest with pinnacles and finials, a stepped cornice (egg-and-dart, dentils, burr-walnut frieze with rosettes and inlay), fluted pilasters with carved capitals, scalloped aprons, and a plinth with arched book-matched panel doors, brass fittings and bracket feet. All of it takes its colour and grain from the wood you choose.
- **Depth**: books show their page edges, the boards recede, and the wall and plants slide against the books as you move the pointer (or scroll, on a phone).
- **On iPhone**: bottom tab bar, bottom sheets, safe-area aware, and it can be added to the Home Screen as a full-screen app.
- **Accounts**: sign up / log in; everything is stored per account.

## Run it

```bash
npm install
npm run dev        # web on :5173, API on :3001 (local SQLite file in ./data)
npm test           # backend tests (no network needed)
npm run build && npm start   # production build served by the API on :3001
```

## Where the book data comes from

- **Open Library** (free, no key): search, covers, blurbs, subjects and reader ratings.
- **Google Books** (optional): set `GOOGLE_BOOKS_API_KEY` and its ratings are combined with Open Library's, weighted by how many people rated.
- Ratings are shown with their source and count. A book with no ratings anywhere says so.
- Open Library has no scans of back covers, so the back cover is built from the book's blurb.

## Accounts and security

Same approach as EmsMeals: scrypt password hashes, hashed session tokens in an HttpOnly cookie, login lockout, rate limits, same-origin checks on writes, strict CSP.

## Deploying

Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (see `.env.example`). Without them, production refuses to start unless `DATA_DIR` points at a persistent disk.

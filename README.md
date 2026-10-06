# Fieldnotes Vegetable Garden Planner

A browser app for planning vegetable crops and tracking watering, feeding, harvest checks, and photos. It includes an editable four-crop season starter plan and a seasonal reference based on the Willamette Valley garden calendar.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. On Windows PowerShell with script execution disabled, use `npm.cmd` in place of `npm`.

Optional AI photo review: create a `.env.local` file with `OPENAI_API_KEY=...` (see `.env.example`) and restart the dev server. The key is read by Vite's local Node server and never bundled into browser code. A static-only deployment works without it; photo review is simply unavailable.

Run `node --test src/*.test.js server/*.test.js` for checks and `npm run build` for a production build.

## How it works

- Choose a crop, location and start date. The app fills four stage estimates (establish, grow, flower/fruit, finish) and generates dated water and feeding *checks* through the estimated harvest window.
- Adjust stage lengths and care intervals at any time. **Recalculate suggested schedule** replaces them with crop defaults; it never runs automatically while editing an existing crop. Zero disables a care reminder.
- **Plan a season** creates four example crops for a chosen year: peppers and tomatoes started indoors, spring lettuce and summer beans outdoors. Every date and stage length is editable.
- **Print weekly checklist** produces Monday-to-Sunday dated weeks with stage changes, water/feed checkboxes, the harvest inspection, and space for observations. Print it or save as PDF.
- Mark water/feed checks done to restart their interval. Record the actual harvest date to compare observed days with the planned date saved at harvest.
- Upload photos to a crop. They are resized and stored in this browser. Tomatoes and peppers get a rough warm-versus-green color readout, not a ripeness verdict. Optional AI review sends only the selected photo and crop name, and only when you tick the box.
- Back up the whole garden, including photos, as a JSON file and restore it later. Browser storage is limited, so export regularly.
- Browser notifications fire only while the page is open on localhost or HTTPS.

Dates and visual cues are prompts to go look. Weather, variety, soil and disease pressure always take precedence.

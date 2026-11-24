# Endless Mountains Pride — Festival Guide Web App

A mobile-first, installable Progressive Web App (PWA) for **Endless Mountains Pride** at Mountaineer Park, powered live by Google Sheets — with zero backend servers or API keys required.

## Features
- **Live Google Sheet Integration**: Reads directly from three tabs (`Vendors`, `Schedule`, and `Festival Info`) with automatic offline caching in `localStorage` for reliable use in rural park cell reception.
- **Vendors & Nonprofit Tables Directory**: Filter by table type (Vendors, Nonprofits, Food & Drink), category, or search by name/booth number, save Favorites, and jump straight to any booth on the map.
- **Schedule of Events**: Chronological timeline with categories, host/performer details, live "Happening Now / Starts Soon" badges on festival day, and 1-tap "+ My Schedule".
- **Interactive Mountaineer Park Grounds Map**: Zoomable/pannable vector SVG map based on last year's festival layout with individually clickable booths (`Booth 1` – `Booth 17`), Main Stage, Food Court, Quiet Corner Canopy, BBQ Pit, Parking, Restrooms, EMS/First Aid, ATM, and live heart badges on your favorited spots.
- **Personal Schedule & 10-Minute Reminders**:
  - Browser notifications + in-app alert banner + chime 10 minutes before saved events start.
  - 1-click **Add My Schedule to Phone Calendar (`.ics`)** download with built-in `VALARM` (`-PT10M`) reminders for reliable lock-screen notifications on iOS and Android even when the browser is closed.

## Connected Google Sheet
- **Spreadsheet**: [Endless Mountains Pride - Festival App Data](https://docs.google.com/spreadsheets/d/1u_kJb_LWM-QIZt-HL7N-EEt6_wzLPylPeCg14zezfm4/edit)
- **Sheet ID**: `1u_kJb_LWM-QIZt-HL7N-EEt6_wzLPylPeCg14zezfm4` (configured in `config.js`)

### Making Live Sheet Sync Work (1-Time Step)
1. Open the Google Sheet above.
2. Click **Share** (top-right) → under **General access**, choose **Anyone with the link** → **Viewer**.
3. Edit rows on the `Vendors`, `Schedule`, or `Festival Info` tabs anytime — attendees see updates automatically when they open or tap **Sync** in the app!

## Free Hosting Options (Static Files — No Backend Needed)
Deploy the contents of this folder to any free static host:
- **GitHub Pages**: Push this folder to a GitHub repo and enable Pages (`Settings → Pages → Deploy from branch`).
- **Netlify Drop**: Drag and drop this folder onto [app.netlify.com/drop](https://app.netlify.com/drop).
- **Cloudflare Pages / Vercel**: Connect the repo and deploy as a static site (no build command needed).

## Local Preview
```bash
python3 -m http.server 8080
```
Then open `http://localhost:8080` in a browser.

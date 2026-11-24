/* ==========================================================================
   Endless Mountains Pride — Festival Guide App Logic
   Zero-dependency vanilla JS · Live Google Sheets sync · Offline PWA ready
   ========================================================================== */

(function () {
  'use strict';

  const CFG = window.EMP_CONFIG;
  const STORAGE = {
    sheetId: 'emp_sheet_id_v1',
    cache: 'emp_sheet_cache_v1',
    savedEvents: 'emp_saved_events_v1',
    favVendors: 'emp_fav_vendors_v1',
    remindersGlobal: 'emp_reminders_global_v1',
    mutedEvents: 'emp_muted_events_v1',
    firedAlerts: 'emp_fired_alerts_v1'
  };

  // Application State
  const state = {
    sheetId: localStorage.getItem(STORAGE.sheetId) || CFG.DEFAULT_SHEET_ID,
    syncMode: 'loading', // 'live' | 'cached' | 'sample' | 'syncing'
    lastSyncedAt: null,
    syncError: '',
    info: { ...CFG.FALLBACK_DATA.info },
    vendors: [...CFG.FALLBACK_DATA.vendors],
    schedule: [...CFG.FALLBACK_DATA.schedule],

    activeTab: 'schedule',
    scheduleCategory: 'All',
    scheduleSearch: '',
    vendorType: 'All',
    vendorCategory: 'All',
    vendorSearch: '',

    mapLayer: 'all',
    selectedLocation: null,
    mapZoom: 1,
    mapPanX: 0,
    mapPanY: 0,

    savedEvents: new Set(loadJSON(STORAGE.savedEvents, [])),
    favVendors: new Set(loadJSON(STORAGE.favVendors, [])),
    remindersEnabled: loadJSON(STORAGE.remindersGlobal, false),
    mutedEvents: new Set(loadJSON(STORAGE.mutedEvents, [])),
    firedAlerts: new Set(loadJSON(STORAGE.firedAlerts, []))
  };

  let activeBannerLocation = null;
  let toastTimer = null;

  // =========================================================================
  // Utilities
  // =========================================================================
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable
    }
  }

  function slugId(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function eventKey(ev) {
    return slugId(`${ev.name}-${ev.startTime}`);
  }

  function vendorKey(v) {
    return slugId(`${v.name}-${v.location}`);
  }

  function escHTML(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
  }

  function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const match = String(timeStr).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) return 0;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2] || '0', 10);
    const ampm = (match[3] || '').toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return h * 60 + m;
  }

  function getFestivalDateParts() {
    const raw = (state.info['Festival Date'] || '2027-06-12').trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return { year: 2027, month: 6, day: 12 };
    return { year: +m[1], month: +m[2], day: +m[3] };
  }

  function formatDisplayDate() {
    const { year, month, day } = getFestivalDateParts();
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return state.info['Festival Date'] || '';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function getEventDateTime(timeStr) {
    const { year, month, day } = getFestivalDateParts();
    const mins = parseTimeToMinutes(timeStr);
    return new Date(year, month - 1, day, Math.floor(mins / 60), mins % 60, 0, 0);
  }

  function extractSheetId(input) {
    const trimmed = String(input || '').trim();
    if (!trimmed) return CFG.DEFAULT_SHEET_ID;
    const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return urlMatch ? urlMatch[1] : trimmed;
  }

  function normalizeSocialLink(raw) {
    const val = String(raw || '').trim();
    if (!val) return null;
    if (/^https?:\/\//i.test(val)) {
      return { href: val, label: val.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '') };
    }
    if (val.startsWith('@')) {
      return { href: `https://instagram.com/${val.slice(1)}`, label: val };
    }
    if (val.includes('.')) {
      return { href: `https://${val}`, label: val };
    }
    return { href: null, label: val };
  }

  function badgeClassForCategory(cat) {
    const c = String(cat || '').toLowerCase();
    if (c.includes('music')) return 'badge-music';
    if (c.includes('drag') || c.includes('perform')) return 'badge-drag';
    if (c.includes('speak') || c.includes('advocacy') || c.includes('community')) return 'badge-speakers';
    if (c.includes('family') || c.includes('youth')) return 'badge-family';
    if (c.includes('game') || c.includes('activit')) return 'badge-games';
    if (c.includes('food') || c.includes('beverage') || c.includes('drink')) return 'badge-food';
    return 'badge-vendor';
  }

  // =========================================================================
  // RFC 4180 CSV Parser & Live Google Sheets Fetcher
  // =========================================================================
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          row.push(field.trim());
          field = '';
        } else if (ch === '\r' && next === '\n') {
          row.push(field.trim());
          rows.push(row);
          row = [];
          field = '';
          i++;
        } else if (ch === '\n' || ch === '\r') {
          row.push(field.trim());
          rows.push(row);
          row = [];
          field = '';
        } else {
          field += ch;
        }
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field.trim());
      rows.push(row);
    }
    return rows.filter((r) => r.some((cell) => cell !== ''));
  }

  async function fetchSheetTab(sheetId, tabName) {
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    // If the sheet is private, Google redirects to an HTML sign-in page
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      throw new Error('Sheet is private — set sharing to "Anyone with the link can view"');
    }
    return parseCSV(text);
  }

  function mapRowsToObjects(rows) {
    if (!rows || rows.length < 2) return [];
    const headers = rows[0].map((h) => h.toLowerCase().trim());
    return rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] || '';
      });
      return obj;
    });
  }

  async function syncFromGoogleSheet(manual = false) {
    state.syncMode = 'syncing';
    updateSyncUI();

    try {
      const [vendorRows, scheduleRows, infoRows] = await Promise.all([
        fetchSheetTab(state.sheetId, CFG.TABS.vendors),
        fetchSheetTab(state.sheetId, CFG.TABS.schedule),
        fetchSheetTab(state.sheetId, CFG.TABS.info).catch(() => [])
      ]);

      const vendors = mapRowsToObjects(vendorRows)
        .filter((r) => r['name'])
        .map((r) => ({
          name: r['name'],
          type: r['type'] || 'Vendor',
          category: r['category'] || 'General',
          location: r['location'] || 'Festival Grounds',
          description: r['description'] || '',
          website: r['website / social'] || r['website'] || r['social'] || '',
          featured: /^(yes|true|1|★)$/i.test(r['featured'] || '')
        }));

      const schedule = mapRowsToObjects(scheduleRows)
        .filter((r) => r['event name'] || r['name'])
        .map((r) => ({
          name: r['event name'] || r['name'],
          startTime: r['start time'] || r['time'] || '',
          endTime: r['end time'] || '',
          location: r['location'] || 'Main Stage',
          category: r['category'] || 'Events',
          description: r['description'] || '',
          host: r['performer / host'] || r['host'] || r['performer'] || ''
        }));

      const info = { ...CFG.FALLBACK_DATA.info };
      if (infoRows && infoRows.length > 1) {
        infoRows.slice(1).forEach((r) => {
          if (r[0] && r[1] !== undefined) {
            info[r[0].trim()] = r[1].trim();
          }
        });
      }

      if (vendors.length > 0) state.vendors = vendors;
      if (schedule.length > 0) state.schedule = schedule;
      state.info = info;
      state.syncMode = 'live';
      state.lastSyncedAt = new Date().toISOString();
      state.syncError = '';

      saveJSON(STORAGE.cache, {
        sheetId: state.sheetId,
        lastSyncedAt: state.lastSyncedAt,
        info: state.info,
        vendors: state.vendors,
        schedule: state.schedule
      });

      if (manual) showToast('Synced latest data from Google Sheet!');
    } catch (err) {
      const cached = loadJSON(STORAGE.cache, null);
      if (cached && cached.sheetId === state.sheetId) {
        state.info = cached.info || state.info;
        state.vendors = cached.vendors || state.vendors;
        state.schedule = cached.schedule || state.schedule;
        state.lastSyncedAt = cached.lastSyncedAt;
        state.syncMode = 'cached';
      } else {
        state.syncMode = 'sample';
      }
      state.syncError = err.message || 'Unable to reach Google Sheet';
      if (manual) showToast('Using offline data — check sheet sharing in Info.');
    }

    renderAll();
  }

  function updateSyncUI() {
    const dot = document.getElementById('sync-status-dot');
    const label = document.getElementById('sync-status-label');
    const modalStatus = document.getElementById('modal-sync-status');

    dot.className = 'sync-dot';
    if (state.syncMode === 'syncing') {
      dot.classList.add('syncing');
      label.textContent = 'Syncing…';
      if (modalStatus) modalStatus.textContent = 'Syncing with Google Sheet…';
    } else if (state.syncMode === 'live') {
      dot.classList.add('live');
      label.textContent = 'Live';
      const timeStr = state.lastSyncedAt ? new Date(state.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
      if (modalStatus) modalStatus.textContent = `✅ Connected live to Google Sheet (synced at ${timeStr})`;
    } else if (state.syncMode === 'cached') {
      label.textContent = 'Cached';
      if (modalStatus) modalStatus.textContent = `📦 Offline cached data (${state.syncError})`;
    } else {
      label.textContent = 'Preview';
      if (modalStatus) {
        modalStatus.textContent = `📋 Preview data loaded — share the Google Sheet as "Anyone with the link (Viewer)" to enable live browser sync.`;
      }
    }
  }

  // =========================================================================
  // Header, Announcement & Festival Info
  // =========================================================================
  function renderHeaderAndInfo() {
    const name = state.info['Festival Name'] || 'Endless Mountains Pride';
    const venue = state.info['Venue'] || 'Mountaineer Park';
    const hours = state.info['Hours'] || '11:00 AM – 6:00 PM';
    const dateLabel = formatDisplayDate();

    document.title = `${name} — Festival Guide`;
    document.getElementById('header-festival-name').textContent = name;
    document.getElementById('header-festival-meta').textContent = `${venue} · ${dateLabel} · ${hours}`;

    const announcement = (state.info['Announcement'] || '').trim();
    const bar = document.getElementById('announcement-bar');
    if (announcement) {
      document.getElementById('announcement-text').textContent = announcement;
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }

    // Map subtitle
    if (state.info['Map Notice']) {
      document.getElementById('map-subtitle').textContent = state.info['Map Notice'];
    }

    // Modal Info DL
    const dl = document.getElementById('festival-info-dl');
    const keysToShow = ['Venue', 'Location Subtitle', 'Hours', 'Parking & Access', 'Smoking Area'];
    dl.innerHTML = keysToShow
      .filter((k) => state.info[k])
      .map((k) => `
        <div class="info-dl-row">
          <dt>${escHTML(k)}</dt>
          <dd>${escHTML(state.info[k])}</dd>
        </div>
      `)
      .join('');

    document.getElementById('sheet-id-input').value = state.sheetId;
    document.getElementById('link-open-sheet').href = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(state.sheetId)}/edit`;

    updateSavedCounts();
    updateSyncUI();
  }

  function updateSavedCounts() {
    const total = state.savedEvents.size + state.favVendors.size;
    ['desk-saved-count', 'mob-saved-count'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = total;
      el.classList.toggle('hidden', total === 0);
    });
  }

  // =========================================================================
  // Tab 1: Schedule
  // =========================================================================
  function getSortedSchedule() {
    return [...state.schedule].sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
  }

  function getEventLiveStatus(ev) {
    const now = new Date();
    const start = getEventDateTime(ev.startTime);
    const end = ev.endTime ? getEventDateTime(ev.endTime) : new Date(start.getTime() + 45 * 60000);
    if (now >= start && now <= end) return { label: 'Happening Now', cls: '' };
    const minsUntil = (start - now) / 60000;
    if (minsUntil > 0 && minsUntil <= 15) return { label: `In ${Math.ceil(minsUntil)} min`, cls: 'soon' };
    return null;
  }

  function renderScheduleCategories() {
    const cats = ['All', ...new Set(state.schedule.map((e) => e.category).filter(Boolean))];
    const container = document.getElementById('schedule-category-chips');
    container.innerHTML = cats
      .map(
        (cat) =>
          `<button class="chip ${state.scheduleCategory === cat ? 'active' : ''}" data-cat="${escHTML(cat)}" type="button">${escHTML(cat)}</button>`
      )
      .join('');
  }

  function renderScheduleList() {
    const q = state.scheduleSearch.toLowerCase();
    const items = getSortedSchedule().filter((ev) => {
      if (state.scheduleCategory !== 'All' && ev.category !== state.scheduleCategory) return false;
      if (q) {
        const hay = `${ev.name} ${ev.location} ${ev.category} ${ev.description} ${ev.host}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const container = document.getElementById('schedule-list');
    if (items.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No events match your filter.</p><button class="btn btn-outline btn-sm" id="btn-clear-sched-filter" type="button">Show All Events</button></div>`;
      const clearBtn = document.getElementById('btn-clear-sched-filter');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          state.scheduleCategory = 'All';
          state.scheduleSearch = '';
          document.getElementById('schedule-search').value = '';
          renderScheduleCategories();
          renderScheduleList();
        });
      }
      return;
    }

    container.innerHTML = items
      .map((ev) => {
        const key = eventKey(ev);
        const saved = state.savedEvents.has(key);
        const reminderOn = saved && state.remindersEnabled && !state.mutedEvents.has(key);
        const live = getEventLiveStatus(ev);

        return `
          <article class="event-card ${saved ? 'saved' : ''}">
            <div class="event-time-col">
              <span class="event-start">${escHTML(ev.startTime)}</span>
              ${ev.endTime ? `<span class="event-end">to ${escHTML(ev.endTime)}</span>` : ''}
              ${live ? `<span class="event-live-pill ${live.cls}">${escHTML(live.label)}</span>` : ''}
            </div>
            <div class="event-body-col">
              <div class="event-meta-row">
                <span class="badge ${badgeClassForCategory(ev.category)}">${escHTML(ev.category)}</span>
                <button class="loc-chip" data-jump-loc="${escHTML(ev.location)}" type="button" title="Show on Grounds Map">
                  📍 ${escHTML(ev.location)}
                </button>
              </div>
              <h3 class="event-title">${escHTML(ev.name)}</h3>
              ${ev.host ? `<p class="event-host">Featuring: ${escHTML(ev.host)}</p>` : ''}
              <p class="event-desc">${escHTML(ev.description)}</p>
            </div>
            <div class="event-actions-col">
              <button class="btn-save-event ${saved ? 'active' : ''}" data-toggle-event="${escHTML(key)}" type="button">
                ${saved ? '✓ In My Schedule' : '+ My Schedule'}
              </button>
              ${
                saved
                  ? `<button class="btn-bell ${reminderOn ? 'active' : ''}" data-toggle-bell="${escHTML(key)}" type="button" title="Toggle 10-minute alert for this event">
                      ${reminderOn ? '🔔 10m Alert On' : '🔕 Alert Muted'}
                    </button>`
                  : ''
              }
            </div>
          </article>
        `;
      })
      .join('');
  }

  // =========================================================================
  // Tab 2: Vendors & Nonprofits
  // =========================================================================
  function renderVendorCategories() {
    const cats = ['All', ...new Set(state.vendors.map((v) => v.category).filter(Boolean))];
    const container = document.getElementById('vendor-category-chips');
    container.innerHTML = cats
      .map(
        (cat) =>
          `<button class="chip ${state.vendorCategory === cat ? 'active' : ''}" data-vcat="${escHTML(cat)}" type="button">${escHTML(cat)}</button>`
      )
      .join('');
  }

  function renderVendorsGrid() {
    const q = state.vendorSearch.toLowerCase();
    const filtered = state.vendors.filter((v) => {
      if (state.vendorType !== 'All' && v.type !== state.vendorType) return false;
      if (state.vendorCategory !== 'All' && v.category !== state.vendorCategory) return false;
      if (q) {
        const hay = `${v.name} ${v.type} ${v.category} ${v.location} ${v.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    document.getElementById('vendor-count-chip').textContent = `${filtered.length} ${filtered.length === 1 ? 'table' : 'tables'}`;

    const container = document.getElementById('vendors-grid');
    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>No vendors or nonprofits match your search.</p><button class="btn btn-outline btn-sm" id="btn-clear-vendor-filter" type="button">Reset Filters</button></div>`;
      const btn = document.getElementById('btn-clear-vendor-filter');
      if (btn) {
        btn.addEventListener('click', () => {
          state.vendorType = 'All';
          state.vendorCategory = 'All';
          state.vendorSearch = '';
          document.getElementById('vendor-search').value = '';
          document.querySelectorAll('#vendor-type-segment .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.type === 'All'));
          renderVendorCategories();
          renderVendorsGrid();
        });
      }
      return;
    }

    container.innerHTML = filtered
      .map((v) => {
        const key = vendorKey(v);
        const fav = state.favVendors.has(key);
        const typeBadgeCls =
          v.type === 'Nonprofit' ? 'badge-nonprofit' : v.type === 'Food & Drink' ? 'badge-food' : 'badge-vendor';
        const social = normalizeSocialLink(v.website);

        return `
          <article class="vendor-card ${fav ? 'favorited' : ''}">
            <div class="vendor-card-top">
              <div class="vendor-badges">
                <span class="badge ${typeBadgeCls}">${escHTML(v.type)}</span>
                <span class="badge ${badgeClassForCategory(v.category)}">${escHTML(v.category)}</span>
                ${v.featured ? '<span class="badge badge-featured">★ Highlight</span>' : ''}
              </div>
              <button class="btn-heart ${fav ? 'active' : ''}" data-toggle-vendor="${escHTML(key)}" type="button" aria-label="${fav ? 'Remove from favorites' : 'Favorite vendor'}" title="${fav ? 'Favorited' : 'Save to Favorites'}">
                ${fav ? '❤️' : '🤍'}
              </button>
            </div>
            <h3 class="vendor-name">${escHTML(v.name)}</h3>
            <p class="vendor-desc">${escHTML(v.description)}</p>
            <div class="vendor-footer">
              <button class="loc-chip" data-jump-loc="${escHTML(v.location)}" type="button" title="Locate on Grounds Map">
                📍 ${escHTML(v.location)}
              </button>
              ${
                social
                  ? social.href
                    ? `<a class="vendor-social" href="${escHTML(social.href)}" target="_blank" rel="noopener noreferrer">${escHTML(social.label)} ↗</a>`
                    : `<span class="vendor-social">${escHTML(social.label)}</span>`
                  : ''
              }
            </div>
          </article>
        `;
      })
      .join('');
  }

  // =========================================================================
  // Tab 3: Interactive Festival Grounds Map (Mountaineer Park)
  // =========================================================================
  function locationMatchesFavorite(locName) {
    const locLower = locName.toLowerCase();
    const hasFavVendor = state.vendors.some((v) => v.location.toLowerCase() === locLower && state.favVendors.has(vendorKey(v)));
    const hasSavedEvent = state.schedule.some((e) => e.location.toLowerCase() === locLower && state.savedEvents.has(eventKey(e)));
    return hasFavVendor || hasSavedEvent;
  }

  function locationMatchesLayer(locName, zoneCat) {
    if (state.mapLayer === 'all') return true;
    if (state.mapLayer === 'favorites') return locationMatchesFavorite(locName);
    return zoneCat === state.mapLayer;
  }

  function renderInteractiveMap() {
    const canvas = document.getElementById('map-canvas');

    // Generate Booths 1–9 (West Column: 9 at top down to 1 at bottom)
    let boothsWestSVG = '';
    for (let i = 0; i < 9; i++) {
      const num = 9 - i;
      const loc = `Booth ${num}`;
      const y = 268 + i * 24;
      const isSelected = state.selectedLocation === loc;
      const isFav = locationMatchesFavorite(loc);
      const dimmed = !locationMatchesLayer(loc, 'vendors');
      const occupied = state.vendors.some((v) => v.location.toLowerCase() === loc.toLowerCase());
      boothsWestSVG += `
        <g class="map-hotspot ${isSelected ? 'selected' : ''} ${dimmed ? 'dimmed' : ''}" data-loc="${loc}" role="button" tabindex="0" aria-label="${loc}">
          <rect class="zone-shape" x="236" y="${y}" width="44" height="23" rx="2" fill="${occupied ? '#FFFFFF' : '#F3EFE6'}" stroke="#5B2C6F" stroke-width="1.6"/>
          <text x="258" y="${y + 15.5}" text-anchor="middle" font-size="12" font-weight="700" fill="#17322B">${num}</text>
          ${isFav ? `<circle cx="277" cy="${y + 5}" r="5.5" fill="#C62839" stroke="#FFFFFF" stroke-width="1.4"/>` : ''}
        </g>
      `;
    }

    // Generate Booths 10–17 (Center Column: 17 at top down to 10 at bottom)
    let boothsCenterSVG = '';
    for (let i = 0; i < 8; i++) {
      const num = 17 - i;
      const loc = `Booth ${num}`;
      const y = 268 + i * 27;
      const isSelected = state.selectedLocation === loc;
      const isFav = locationMatchesFavorite(loc);
      const dimmed = !locationMatchesLayer(loc, 'vendors');
      const occupied = state.vendors.some((v) => v.location.toLowerCase() === loc.toLowerCase());
      boothsCenterSVG += `
        <g class="map-hotspot ${isSelected ? 'selected' : ''} ${dimmed ? 'dimmed' : ''}" data-loc="${loc}" role="button" tabindex="0" aria-label="${loc}">
          <rect class="zone-shape" x="382" y="${y}" width="46" height="26" rx="2" fill="${occupied ? '#FFFFFF' : '#F3EFE6'}" stroke="#5B2C6F" stroke-width="1.6"/>
          <text x="405" y="${y + 17}" text-anchor="middle" font-size="12" font-weight="700" fill="#17322B">${num}</text>
          ${isFav ? `<circle cx="425" cy="${y + 5}" r="5.5" fill="#C62839" stroke="#FFFFFF" stroke-width="1.4"/>` : ''}
        </g>
      `;
    }

    function hotspotAttrs(loc, cat) {
      const sel = state.selectedLocation === loc ? 'selected' : '';
      const dim = !locationMatchesLayer(loc, cat) ? 'dimmed' : '';
      return `class="map-hotspot ${sel} ${dim}" data-loc="${escHTML(loc)}" role="button" tabindex="0" aria-label="${escHTML(loc)}"`;
    }

    function favPin(loc, x, y) {
      if (!locationMatchesFavorite(loc)) return '';
      return `<g transform="translate(${x}, ${y})"><circle r="8" fill="#C62839" stroke="#FFFFFF" stroke-width="2"/><text y="3.5" text-anchor="middle" font-size="9" fill="#FFFFFF">♥</text></g>`;
    }

    canvas.innerHTML = `
      <svg class="festival-svg" viewBox="0 0 920 760" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="stageRainbow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#8E44AD"/>
            <stop offset="20%" stop-color="#3E82F7"/>
            <stop offset="40%" stop-color="#2ECC71"/>
            <stop offset="60%" stop-color="#F7DC6F"/>
            <stop offset="80%" stop-color="#F39C12"/>
            <stop offset="100%" stop-color="#E74C3C"/>
          </linearGradient>
          <marker id="arrowPurple" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#5B2C6F"/>
          </marker>
        </defs>

        <!-- Park Lawn Background -->
        <rect x="0" y="0" width="920" height="760" fill="#F4F5F0"/>

        <!-- Traffic Exit & Entrance Arrows (North & West road) -->
        <g opacity="0.85">
          <path d="M 650 56 Q 635 28 602 24" fill="none" stroke="#5B2C6F" stroke-width="2.6" marker-end="url(#arrowPurple)"/>
          <path d="M 465 22 L 365 22" fill="none" stroke="#5B2C6F" stroke-width="2.6" marker-end="url(#arrowPurple)"/>
          <path d="M 218 26 Q 175 40 156 80" fill="none" stroke="#5B2C6F" stroke-width="2.6" marker-end="url(#arrowPurple)"/>
          <path d="M 145 275 L 145 370" fill="none" stroke="#5B2C6F" stroke-width="2.6" marker-end="url(#arrowPurple)"/>
          <text x="530" y="27" text-anchor="middle" font-size="14" font-weight="700" fill="#17322B">Cars Exit</text>
          <text x="698" y="96" text-anchor="middle" font-size="13" font-weight="700" fill="#17322B">Cars Exit</text>
          <text x="128" y="325" text-anchor="middle" font-size="13" font-weight="700" fill="#17322B" transform="rotate(-90 128 325)">Cars Exit</text>

          <!-- South Car Entrance Arrows -->
          <path d="M 380 688 L 460 688" fill="none" stroke="#5B2C6F" stroke-width="2.6" marker-end="url(#arrowPurple)"/>
          <path d="M 380 734 L 460 734" fill="none" stroke="#5B2C6F" stroke-width="2.6" marker-end="url(#arrowPurple)"/>
          <path d="M 600 715 Q 642 695 660 645" fill="none" stroke="#5B2C6F" stroke-width="2.6" marker-end="url(#arrowPurple)"/>
          <text x="498" y="693" text-anchor="middle" font-size="13" font-weight="700" fill="#17322B">Cars In</text>
          <text x="498" y="738" text-anchor="middle" font-size="13" font-weight="700" fill="#17322B">Cars In</text>
          <rect x="372" y="696" width="46" height="28" rx="4" fill="#7EE4EA" stroke="#1B3B48" stroke-width="1.6"/>
          <text x="395" y="714" text-anchor="middle" font-size="9.5" font-weight="700" fill="#17322B">Wristbands</text>
        </g>

        <!-- East Parking Field -->
        <g ${hotspotAttrs('Parking Field', 'amenities')}>
          <rect class="zone-shape" x="612" y="62" width="286" height="598" rx="14" fill="#46B872" stroke="#2D8A50" stroke-width="2"/>
          <text x="755" y="185" text-anchor="middle" font-size="22" font-weight="800" fill="#FFFFFF">Parking</text>
          <text x="755" y="210" text-anchor="middle" font-size="14" font-weight="600" fill="#EBF9F0">in Large East Field</text>
          <text x="755" y="242" text-anchor="middle" font-size="12" font-weight="600" fill="#EBF9F0">Guided by Parking Volunteers</text>
          <rect x="668" y="264" width="174" height="28" rx="14" fill="rgba(255,255,255,0.2)"/>
          <text x="755" y="282" text-anchor="middle" font-size="11.5" font-weight="800" fill="#FFFFFF">★ VERIFY WRISTBANDS</text>

          <!-- Accessible Parking Badges -->
          <circle cx="652" cy="368" r="21" fill="#38A8D8" stroke="#FFFFFF" stroke-width="2.5"/>
          <text x="652" y="375" text-anchor="middle" font-size="20" fill="#FFFFFF">♿</text>
          <circle cx="652" cy="495" r="21" fill="#38A8D8" stroke="#FFFFFF" stroke-width="2.5"/>
          <text x="652" y="502" text-anchor="middle" font-size="20" fill="#FFFFFF">♿</text>
          <text x="742" y="373" text-anchor="middle" font-size="11.5" font-weight="700" fill="#FFFFFF">Accessible Parking</text>
        </g>

        <!-- Festival Grounds Perimeter (Purple Fence) -->
        <rect x="200" y="62" width="388" height="598" rx="10" fill="#FFFDF8" stroke="#5B2C6F" stroke-width="4"/>
        <!-- North Caution Tape Line -->
        <line x1="204" y1="62" x2="584" y2="62" stroke="#E8871E" stroke-width="4" stroke-dasharray="10 6"/>
        <text x="394" y="52" text-anchor="middle" font-size="11" font-weight="700" fill="#4B6059">Board Member / Volunteer Vehicles · Caution Tape Boundary</text>

        <!-- =================== NORTH SECTION =================== -->
        <!-- Food Court Area -->
        <g ${hotspotAttrs('Food Court Area', 'food')}>
          <rect class="zone-shape" x="345" y="76" width="180" height="72" rx="10" fill="#FEF2E4" stroke="#E8871E" stroke-width="2"/>
          <text x="435" y="108" text-anchor="middle" font-size="15" font-weight="800" fill="#8A4A07">🍕 Food Court Area</text>
          <text x="435" y="128" text-anchor="middle" font-size="11.5" font-weight="600" fill="#9A5C1D">Food Trucks &amp; Dining</text>
          ${favPin('Food Court Area', 515, 86)}
        </g>

        <!-- Games & Cornhole -->
        <g ${hotspotAttrs('Games & Cornhole', 'events')}>
          <rect class="zone-shape" x="366" y="158" width="198" height="46" rx="10" fill="#EBF6EC" stroke="#2D8A50" stroke-width="1.8"/>
          <text x="465" y="186" text-anchor="middle" font-size="14" font-weight="800" fill="#145038">🎯 Games &amp; Cornhole</text>
          ${favPin('Games & Cornhole', 554, 168)}
        </g>

        <!-- =================== MIDDLE SECTION =================== -->
        <!-- Outdoor Vendors -->
        <g ${hotspotAttrs('Outdoor Vendors', 'vendors')}>
          <rect class="zone-shape" x="236" y="182" width="44" height="78" rx="6" fill="#7EE4EA" stroke="#1B3B48" stroke-width="1.8"/>
          <text x="258" y="222" text-anchor="middle" font-size="11" font-weight="800" fill="#17322B" transform="rotate(-90 258 222)">Outdoor Vendors</text>
          ${favPin('Outdoor Vendors', 277, 190)}
        </g>

        <!-- West Vendor Row Label + Booths 1-9 -->
        <text x="223" y="378" text-anchor="middle" font-size="12" font-weight="800" fill="#5B2C6F" transform="rotate(-90 223 378)">VENDORS 1–9</text>
        ${boothsWestSVG}

        <!-- emPRIDE & Drinks -->
        <g ${hotspotAttrs('emPRIDE & Drinks', 'food')}>
          <rect class="zone-shape" x="304" y="286" width="56" height="76" rx="7" fill="#F2ECFA" stroke="#6B3FA0" stroke-width="2"/>
          <text x="332" y="317" text-anchor="middle" font-size="11" font-weight="800" fill="#522882">emPRIDE</text>
          <text x="332" y="333" text-anchor="middle" font-size="10.5" font-weight="700" fill="#522882">&amp; Drinks</text>
          <text x="332" y="350" text-anchor="middle" font-size="9.5" fill="#6B3FA0">Merch · Info</text>
          ${favPin('emPRIDE & Drinks', 355, 294)}
        </g>

        <!-- Sponsor Banner Spotlights & Photo Booth -->
        <g ${hotspotAttrs('Photo Booth', 'events')}>
          <rect class="zone-shape" x="300" y="384" width="64" height="94" rx="8" fill="#FFF7DC" stroke="#C98A00" stroke-width="1.8"/>
          <text x="332" y="410" text-anchor="middle" font-size="18">🔔</text>
          <text x="332" y="428" text-anchor="middle" font-size="10" font-weight="800" fill="#7C5300">Sponsor</text>
          <text x="332" y="440" text-anchor="middle" font-size="10" font-weight="800" fill="#7C5300">Spotlights</text>
          <text x="332" y="462" text-anchor="middle" font-size="10.5" font-weight="700" fill="#17322B">📸 Photo Booth</text>
          ${favPin('Photo Booth', 358, 392)}
        </g>

        <!-- Center Vendor Row Label + Booths 10-17 -->
        <text x="441" y="378" text-anchor="middle" font-size="12" font-weight="800" fill="#5B2C6F" transform="rotate(90 441 378)">VENDORS 10–17</text>
        ${boothsCenterSVG}

        <!-- Main Stage & DJ -->
        <g ${hotspotAttrs('Main Stage', 'events')}>
          <rect class="zone-shape" x="462" y="216" width="76" height="148" rx="8" fill="url(#stageRainbow)" stroke="#17322B" stroke-width="2.2"/>
          <rect x="478" y="248" width="44" height="84" rx="6" fill="rgba(255,255,255,0.88)"/>
          <text x="500" y="294" text-anchor="middle" font-size="16" font-weight="800" fill="#17322B" transform="rotate(90 500 290)">STAGE</text>
          <!-- DJ Booth -->
          <rect x="542" y="266" width="32" height="52" rx="5" fill="#FFFFFF" stroke="#5B2C6F" stroke-width="1.8"/>
          <text x="558" y="296" text-anchor="middle" font-size="12" font-weight="800" fill="#17322B" transform="rotate(90 558 292)">DJ</text>
          ${favPin('Main Stage', 534, 224)}
        </g>

        <!-- Performer Canopy -->
        <g ${hotspotAttrs('Performer Canopy', 'events')}>
          <rect class="zone-shape" x="454" y="376" width="56" height="52" rx="6" fill="#7EE4EA" stroke="#1B3B48" stroke-width="1.8"/>
          <text x="482" y="399" text-anchor="middle" font-size="10.5" font-weight="800" fill="#17322B">Performer</text>
          <text x="482" y="413" text-anchor="middle" font-size="10" font-weight="700" fill="#17322B">Canopy</text>
        </g>

        <!-- Dunk Tank Area (Water & Electric Hookup) -->
        <g ${hotspotAttrs('Dunk Tank Area', 'events')}>
          <rect class="zone-shape" x="430" y="446" width="114" height="52" rx="8" fill="#E4F6FE" stroke="#2D8CE0" stroke-width="1.8" stroke-dasharray="5 3"/>
          <text x="487" y="468" text-anchor="middle" font-size="11.5" font-weight="800" fill="#0B5E82">💦 Dunk Tank Area</text>
          <text x="487" y="484" text-anchor="middle" font-size="9.5" font-weight="600" fill="#2B6C8F">Water &amp; Electric Hookup</text>
          ${favPin('Dunk Tank Area', 538, 454)}
        </g>

        <!-- =================== SOUTH SECTION =================== -->
        <!-- Vendors & Face Painting (Upper half of SW Pavilion) -->
        <g ${hotspotAttrs('Vendors & Face Painting', 'vendors')}>
          <rect class="zone-shape" x="302" y="498" width="84" height="58" rx="6" fill="#FDECEF" stroke="#C62839" stroke-width="1.8"/>
          <text x="344" y="523" text-anchor="middle" font-size="11" font-weight="800" fill="#8F2543">🎨 Vendors &amp;</text>
          <text x="344" y="538" text-anchor="middle" font-size="10.5" font-weight="700" fill="#8F2543">Face Painting</text>
          ${favPin('Vendors & Face Painting', 382, 504)}
        </g>

        <!-- Food Tables (Lower half of SW Pavilion) -->
        <g ${hotspotAttrs('Food Tables', 'food')}>
          <rect class="zone-shape" x="302" y="560" width="84" height="54" rx="6" fill="#FEF2E4" stroke="#E8871E" stroke-width="1.8"/>
          <text x="344" y="585" text-anchor="middle" font-size="11.5" font-weight="800" fill="#8A4A07">🍋 Food</text>
          <text x="344" y="600" text-anchor="middle" font-size="11" font-weight="700" fill="#8A4A07">Tables</text>
          ${favPin('Food Tables', 382, 566)}
        </g>

        <!-- BBQ Pit -->
        <g ${hotspotAttrs('BBQ Pit', 'food')}>
          <rect class="zone-shape" x="220" y="568" width="38" height="78" rx="6" fill="#FDEAEB" stroke="#C62839" stroke-width="1.8"/>
          <text x="239" y="608" text-anchor="middle" font-size="11.5" font-weight="800" fill="#8E1B28" transform="rotate(-90 239 608)">🔥 BBQ Pit</text>
          ${favPin('BBQ Pit', 254, 574)}
        </g>

        <!-- Quiet Corner Canopy -->
        <g ${hotspotAttrs('Quiet Corner Canopy', 'events')}>
          <rect class="zone-shape" x="438" y="546" width="134" height="100" rx="10" fill="#7EE4EA" stroke="#1B3B48" stroke-width="2"/>
          <text x="505" y="572" text-anchor="middle" font-size="12.5" font-weight="800" fill="#17322B">CANOPY</text>
          <text x="505" y="591" text-anchor="middle" font-size="12" font-weight="700" fill="#17322B">Quiet Corner</text>
          <text x="505" y="608" text-anchor="middle" font-size="11" font-weight="600" fill="#1B3B48">Labyrinth · Bubbles</text>
          <text x="505" y="625" text-anchor="middle" font-size="11" font-weight="600" fill="#1B3B48">Art Tables</text>
          ${favPin('Quiet Corner Canopy', 564, 554)}
        </g>

        <!-- =================== ENTRANCES & AMENITIES =================== -->
        <!-- Main Entrance (East Gate) -->
        <g ${hotspotAttrs('Main Entrance', 'amenities')}>
          <rect class="zone-shape" x="562" y="408" width="54" height="44" rx="7" fill="#7EE4EA" stroke="#17322B" stroke-width="2.2"/>
          <text x="589" y="427" text-anchor="middle" font-size="10" font-weight="800" fill="#17322B">MAIN</text>
          <text x="589" y="440" text-anchor="middle" font-size="9.5" font-weight="800" fill="#17322B">ENTRY</text>
          <path d="M 702 430 L 622 430" fill="none" stroke="#FFFFFF" stroke-width="3" marker-end="url(#arrowPurple)"/>
          <text x="756" y="426" text-anchor="middle" font-size="15" font-weight="800" fill="#FFFFFF">Main Entrance</text>
          <text x="756" y="444" text-anchor="middle" font-size="11" font-weight="600" fill="#EBF9F0">Canopy &amp; Wristbands</text>
        </g>

        <!-- Foot Entrance (SW Gate) -->
        <g ${hotspotAttrs('Foot Entrance', 'amenities')}>
          <rect class="zone-shape" x="268" y="638" width="56" height="36" rx="7" fill="#7EE4EA" stroke="#17322B" stroke-width="2"/>
          <text x="296" y="655" text-anchor="middle" font-size="9.5" font-weight="800" fill="#17322B">FOOT</text>
          <text x="296" y="667" text-anchor="middle" font-size="9.5" font-weight="800" fill="#17322B">ENTRY</text>
          <text x="210" y="692" text-anchor="middle" font-size="13" font-weight="800" fill="#17322B">Foot Entrance</text>
          <text x="210" y="707" text-anchor="middle" font-size="10.5" fill="#4B6059">2 Volunteers w/ Wristbands</text>
        </g>

        <!-- Closed West Gate Notice -->
        <text x="150" y="405" text-anchor="middle" font-size="10.5" font-weight="800" fill="#C62839">GATE CLOSED</text>
        <text x="150" y="418" text-anchor="middle" font-size="9.5" font-weight="600" fill="#C62839">Do Not Enter</text>

        <!-- EMS & First Aid (3 stations) -->
        <g ${hotspotAttrs('EMS & First Aid', 'amenities')}>
          <!-- NW EMS -->
          <rect class="zone-shape" x="212" y="76" width="44" height="44" rx="8" fill="#D93025" stroke="#FFFFFF" stroke-width="2"/>
          <text x="234" y="96" text-anchor="middle" font-size="10.5" font-weight="800" fill="#FFFFFF">EMS</text>
          <text x="234" y="113" text-anchor="middle" font-size="16" font-weight="800" fill="#FFFFFF">+</text>
          <!-- Main Entrance First Aid -->
          <rect class="zone-shape" x="540" y="458" width="30" height="30" rx="6" fill="#D93025" stroke="#FFFFFF" stroke-width="2"/>
          <text x="555" y="480" text-anchor="middle" font-size="20" font-weight="800" fill="#FFFFFF">+</text>
          <!-- SW First Aid -->
          <rect class="zone-shape" x="328" y="622" width="30" height="30" rx="6" fill="#D93025" stroke="#FFFFFF" stroke-width="2"/>
          <text x="343" y="644" text-anchor="middle" font-size="20" font-weight="800" fill="#FFFFFF">+</text>
        </g>

        <!-- Restrooms (3 stations) -->
        <g ${hotspotAttrs('Restrooms', 'amenities')}>
          <!-- North Restrooms -->
          <circle class="zone-shape" cx="305" cy="106" r="22" fill="#2D8CE0" stroke="#FFFFFF" stroke-width="2.4"/>
          <text x="305" y="112" text-anchor="middle" font-size="17" fill="#FFFFFF">🚻</text>
          <!-- Mid-West Restrooms -->
          <circle class="zone-shape" cx="238" cy="482" r="21" fill="#2D8CE0" stroke="#FFFFFF" stroke-width="2.4"/>
          <text x="238" y="488" text-anchor="middle" font-size="16" fill="#FFFFFF">🚻</text>
          <!-- Mid-East Restrooms -->
          <circle class="zone-shape" cx="552" cy="516" r="21" fill="#2D8CE0" stroke="#FFFFFF" stroke-width="2.4"/>
          <text x="552" y="522" text-anchor="middle" font-size="16" fill="#FFFFFF">🚻</text>
        </g>

        <!-- Outside West: ATM Bank next to Mountaineer Park -->
        <g ${hotspotAttrs('ATM (Bank)', 'amenities')}>
          <rect class="zone-shape" x="24" y="468" width="142" height="62" rx="10" fill="#F2ECFA" stroke="#6B3FA0" stroke-width="2"/>
          <text x="95" y="494" text-anchor="middle" font-size="14" font-weight="800" fill="#522882">🏧 ATM</text>
          <text x="95" y="511" text-anchor="middle" font-size="10.5" font-weight="600" fill="#522882">Bank next to</text>
          <text x="95" y="523" text-anchor="middle" font-size="10.5" font-weight="600" fill="#522882">Mountaineer Park</text>
        </g>

        <!-- Outside SE: Designated Smoking Area -->
        <g ${hotspotAttrs('Smoking Area', 'amenities')}>
          <rect class="zone-shape" x="688" y="676" width="210" height="64" rx="10" fill="#EBF6EC" stroke="#2D8A50" stroke-width="2"/>
          <text x="793" y="700" text-anchor="middle" font-size="12.5" font-weight="800" fill="#145038">🚬 Designated Smoking Area</text>
          <text x="793" y="720" text-anchor="middle" font-size="11.5" font-weight="600" fill="#4B6059">Near Brown Jug Bar</text>
        </g>

        <!-- Compass Rose -->
        <g transform="translate(64, 96)">
          <circle r="28" fill="#FFFFFF" stroke="#CFC5AE" stroke-width="1.5"/>
          <polygon points="0,-18 5,-3 0,-7 -5,-3" fill="#17322B"/>
          <polygon points="0,18 5,3 0,7 -5,3" fill="#CFC5AE"/>
          <text y="-20" text-anchor="middle" font-size="9" font-weight="800" fill="#17322B" dy="1">N</text>
        </g>
      </svg>
    `;

    applyMapTransform();
  }

  function applyMapTransform() {
    const canvas = document.getElementById('map-canvas');
    if (canvas) {
      canvas.style.transform = `translate(${state.mapPanX}px, ${state.mapPanY}px) scale(${state.mapZoom})`;
    }
  }

  function selectMapLocation(locName, switchToMapTab = false) {
    state.selectedLocation = locName;
    if (switchToMapTab) {
      switchTab('map');
    }
    renderInteractiveMap();
    renderMapInspector(locName);
  }

  function renderMapInspector(locName) {
    const panel = document.getElementById('inspector-content');
    if (!locName) return;

    const locLower = locName.toLowerCase();
    const zoneMeta = CFG.MAP_ZONES[locName] || (
      /^booth\s+\d+$/i.test(locName)
        ? {
            subtitle: parseInt(locName.replace(/\D/g, ''), 10) <= 9 ? 'West Vendor Row (Booths 1–9)' : 'Center Vendor Row (Booths 10–17)',
            note: 'Numbered vendor & nonprofit table inside Mountaineer Park.'
          }
        : { subtitle: 'Festival Grounds', note: '' }
    );

    const matchingVendors = state.vendors.filter((v) => v.location.toLowerCase() === locLower);
    const matchingEvents = getSortedSchedule().filter((e) => e.location.toLowerCase() === locLower);

    let bodyHTML = `
      <div class="inspector-header">
        <div>
          <h3>📍 ${escHTML(locName)}</h3>
          <p class="inspector-zone-tag">${escHTML(zoneMeta.subtitle || 'Mountaineer Park')}</p>
        </div>
        <button class="btn-icon-close" id="btn-clear-map-sel" type="button" aria-label="Clear selection">✕</button>
      </div>
    `;

    if (zoneMeta.note) {
      bodyHTML += `<p class="inspector-note">${escHTML(zoneMeta.note)}</p>`;
    }

    if (matchingVendors.length > 0) {
      bodyHTML += `<div class="inspector-subhead">Vendors &amp; Tables Here (${matchingVendors.length})</div>`;
      bodyHTML += matchingVendors
        .map((v) => {
          const key = vendorKey(v);
          const fav = state.favVendors.has(key);
          return `
            <div class="inspector-item">
              <div class="inspector-item-top">
                <div>
                  <h4>${escHTML(v.name)}</h4>
                  <span class="badge ${badgeClassForCategory(v.category)}">${escHTML(v.type)} · ${escHTML(v.category)}</span>
                </div>
                <button class="btn-heart ${fav ? 'active' : ''}" data-toggle-vendor="${escHTML(key)}" type="button" aria-label="Favorite vendor">
                  ${fav ? '❤️' : '🤍'}
                </button>
              </div>
              <p>${escHTML(v.description)}</p>
            </div>
          `;
        })
        .join('');
    }

    if (matchingEvents.length > 0) {
      bodyHTML += `<div class="inspector-subhead">Scheduled Events Here (${matchingEvents.length})</div>`;
      bodyHTML += matchingEvents
        .map((ev) => {
          const key = eventKey(ev);
          const saved = state.savedEvents.has(key);
          return `
            <div class="inspector-item">
              <h4>${escHTML(ev.name)}</h4>
              <p><strong>${escHTML(ev.startTime)}${ev.endTime ? ' – ' + escHTML(ev.endTime) : ''}</strong>${ev.host ? ' · ' + escHTML(ev.host) : ''}</p>
              <p>${escHTML(ev.description)}</p>
              <div class="inspector-item-actions">
                <button class="btn-save-event ${saved ? 'active' : ''}" data-toggle-event="${escHTML(key)}" type="button">
                  ${saved ? '✓ In My Schedule' : '+ My Schedule'}
                </button>
              </div>
            </div>
          `;
        })
        .join('');
    }

    if (matchingVendors.length === 0 && matchingEvents.length === 0 && /^booth\s+\d+$/i.test(locName)) {
      bodyHTML += `<p class="inspector-note">This booth is currently open in the Google Sheet. Assign a vendor to <strong>${escHTML(locName)}</strong> on the <code>Vendors</code> tab and refresh!</p>`;
    }

    panel.innerHTML = bodyHTML;
    const clearBtn = document.getElementById('btn-clear-map-sel');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        state.selectedLocation = null;
        renderInteractiveMap();
        panel.innerHTML = `
          <div class="inspector-empty">
            <span class="inspector-empty-icon" aria-hidden="true">📍</span>
            <h3>Select a Booth or Zone</h3>
            <p>Tap any numbered vendor booth (1–17), the Main Stage, Food Court, Quiet Corner Canopy, or an amenity icon on the map to view details.</p>
            <div class="quick-jump-list">
              <button class="chip" data-jump="Main Stage" type="button">🎭 Main Stage</button>
              <button class="chip" data-jump="emPRIDE & Drinks" type="button">🏳️‍🌈 emPRIDE &amp; Drinks</button>
              <button class="chip" data-jump="Quiet Corner Canopy" type="button">🫧 Quiet Corner</button>
              <button class="chip" data-jump="Food Court Area" type="button">🍕 Food Court</button>
              <button class="chip" data-jump="Main Entrance" type="button">🚪 Main Entrance</button>
            </div>
          </div>
        `;
      });
    }
  }

  // =========================================================================
  // Tab 4: My Personal Schedule, Favorites & 10-Min Reminders
  // =========================================================================
  function renderMyPride() {
    const myEvents = getSortedSchedule().filter((ev) => state.savedEvents.has(eventKey(ev)));
    const myVendors = state.vendors.filter((v) => state.favVendors.has(vendorKey(v)));

    document.getElementById('my-events-count').textContent = myEvents.length;
    document.getElementById('my-vendors-count').textContent = myVendors.length;

    // Sync reminder toggle UI
    const toggle = document.getElementById('toggle-global-reminders');
    const toggleLabel = document.getElementById('toggle-global-label');
    const statusCopy = document.getElementById('notify-status-copy');
    const quickBtnText = document.getElementById('quick-notify-text');
    const quickBtnIcon = document.getElementById('quick-notify-icon');

    toggle.checked = state.remindersEnabled;
    toggleLabel.textContent = state.remindersEnabled ? 'On' : 'Off';

    if (state.remindersEnabled) {
      const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
      if (perm === 'granted') {
        statusCopy.textContent = `Active! You'll get a browser notification + in-app alert 10 minutes before each of your ${myEvents.length} saved event${myEvents.length === 1 ? '' : 's'}.`;
      } else {
        statusCopy.textContent = `In-app alerts active! (Browser OS notifications are ${perm} — you'll still see on-screen banners and hear the reminder chime.)`;
      }
      quickBtnIcon.textContent = '🔔';
      quickBtnText.textContent = '10-Min Alerts On';
    } else {
      statusCopy.textContent = 'Opt in to receive an alert 10 minutes before each event on your personal schedule begins.';
      quickBtnIcon.textContent = '🔕';
      quickBtnText.textContent = 'Enable 10-Min Alerts';
    }

    // Render saved events
    const eventsEl = document.getElementById('my-schedule-list');
    if (myEvents.length === 0) {
      eventsEl.innerHTML = `
        <div class="empty-state">
          <strong>No events saved yet</strong>
          <p>Tap <em>+ My Schedule</em> on any performance, speaker, or activity to build your personal day.</p>
          <button class="btn btn-outline btn-sm" data-goto-tab="schedule" type="button">Explore Schedule</button>
        </div>
      `;
    } else {
      eventsEl.innerHTML = myEvents
        .map((ev) => {
          const key = eventKey(ev);
          const bellOn = state.remindersEnabled && !state.mutedEvents.has(key);
          return `
            <div class="inspector-item">
              <div class="inspector-item-top">
                <div>
                  <span class="badge ${badgeClassForCategory(ev.category)}">${escHTML(ev.startTime)}${ev.endTime ? ' – ' + escHTML(ev.endTime) : ''}</span>
                  <h4 style="margin-top:6px;">${escHTML(ev.name)}</h4>
                </div>
                <button class="btn-icon-close" data-toggle-event="${escHTML(key)}" type="button" title="Remove from my schedule" aria-label="Remove event">✕</button>
              </div>
              <p>${escHTML(ev.description)}</p>
              <div class="inspector-item-actions">
                <button class="loc-chip" data-jump-loc="${escHTML(ev.location)}" type="button">📍 ${escHTML(ev.location)}</button>
                <button class="btn-bell ${bellOn ? 'active' : ''}" data-toggle-bell="${escHTML(key)}" type="button">
                  ${bellOn ? '🔔 10m Alert On' : '🔕 Alert Off'}
                </button>
              </div>
            </div>
          `;
        })
        .join('');
    }

    // Render favorite vendors
    const vendorsEl = document.getElementById('my-vendors-list');
    if (myVendors.length === 0) {
      vendorsEl.innerHTML = `
        <div class="empty-state">
          <strong>No favorite tables yet</strong>
          <p>Tap the heart on vendors, nonprofits, or food trucks you want to visit so they highlight on your map!</p>
          <button class="btn btn-outline btn-sm" data-goto-tab="vendors" type="button">Explore Vendors</button>
        </div>
      `;
    } else {
      vendorsEl.innerHTML = myVendors
        .map((v) => {
          const key = vendorKey(v);
          return `
            <div class="inspector-item">
              <div class="inspector-item-top">
                <div>
                  <h4>${escHTML(v.name)}</h4>
                  <span class="badge ${badgeClassForCategory(v.category)}">${escHTML(v.type)} · ${escHTML(v.category)}</span>
                </div>
                <button class="btn-heart active" data-toggle-vendor="${escHTML(key)}" type="button" aria-label="Remove favorite">❤️</button>
              </div>
              <p>${escHTML(v.description)}</p>
              <div class="inspector-item-actions">
                <button class="loc-chip" data-jump-loc="${escHTML(v.location)}" type="button">📍 Find ${escHTML(v.location)} on Map</button>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  // =========================================================================
  // 10-Minute Event Notification Engine & .ics Calendar Export
  // =========================================================================
  async function setRemindersEnabled(wantEnabled) {
    if (wantEnabled) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch {
          // Ignore permission errors in restricted contexts
        }
      }
      state.remindersEnabled = true;
      saveJSON(STORAGE.remindersGlobal, true);
      showToast('10-minute event reminders enabled!');
    } else {
      state.remindersEnabled = false;
      saveJSON(STORAGE.remindersGlobal, false);
      showToast('10-minute reminders paused.');
    }
    renderScheduleList();
    renderMyPride();
  }

  function playGentleChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = ctx.currentTime + idx * 0.12;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.12, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.38);
      });
    } catch {
      // Audio blocked until gesture
    }
  }

  function fireEventReminder(ev, isTest = false) {
    const title = isTest
      ? `🔔 Test Alert: ${ev.name} starts in 10 min!`
      : `🔔 Starting in 10 minutes: ${ev.name}`;
    const body = `${ev.startTime} at ${ev.location}${ev.host ? ' · ' + ev.host : ''}`;

    // 1. Show in-app banner
    activeBannerLocation = ev.location;
    document.getElementById('reminder-banner-title').textContent = title;
    document.getElementById('reminder-banner-body').textContent = body;
    document.getElementById('reminder-banner').classList.remove('hidden');
    playGentleChime();

    // 2. Fire OS/Browser notification if permitted
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then((reg) =>
            reg.showNotification(title, {
              body,
              icon: './assets/icon-192.png',
              badge: './assets/icon-192.png',
              tag: `emp-${eventKey(ev)}`
            })
          )
          .catch(() => new Notification(title, { body, icon: './assets/icon-192.png' }));
      } else {
        try {
          new Notification(title, { body, icon: './assets/icon-192.png' });
        } catch {
          // Fallback already handled by in-app banner
        }
      }
    }
  }

  function checkUpcomingReminders() {
    if (!state.remindersEnabled || state.savedEvents.size === 0) return;
    const now = Date.now();
    const TEN_MIN_MS = 10 * 60 * 1000;

    state.schedule.forEach((ev) => {
      const key = eventKey(ev);
      if (!state.savedEvents.has(key) || state.mutedEvents.has(key)) return;

      const startMs = getEventDateTime(ev.startTime).getTime();
      const diff = startMs - now;
      const alertStamp = `${state.info['Festival Date'] || ''}_${key}`;

      // Trigger when within 10 minutes before start (and not already fired)
      if (diff > 0 && diff <= TEN_MIN_MS && !state.firedAlerts.has(alertStamp)) {
        state.firedAlerts.add(alertStamp);
        saveJSON(STORAGE.firedAlerts, [...state.firedAlerts]);
        fireEventReminder(ev, false);
      }
    });
  }

  function exportPersonalScheduleICS() {
    const myEvents = getSortedSchedule().filter((ev) => state.savedEvents.has(eventKey(ev)));
    if (myEvents.length === 0) {
      showToast('Add at least one event to My Schedule first!');
      return;
    }

    const pad = (n) => String(n).padStart(2, '0');
    const formatICSLocal = (d) =>
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const escICS = (s) =>
      String(s || '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');

    const venue = state.info['Venue'] || 'Mountaineer Park';
    const festName = state.info['Festival Name'] || 'Endless Mountains Pride';
    const stamp = formatICSLocal(new Date());

    const vevents = myEvents
      .map((ev) => {
        const start = getEventDateTime(ev.startTime);
        const end = ev.endTime ? getEventDateTime(ev.endTime) : new Date(start.getTime() + 45 * 60000);
        return [
          'BEGIN:VEVENT',
          `UID:${eventKey(ev)}@endlessmountainspride.org`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${formatICSLocal(start)}`,
          `DTEND:${formatICSLocal(end)}`,
          `SUMMARY:${escICS(ev.name)} (${escICS(festName)})`,
          `LOCATION:${escICS(ev.location)} - ${escICS(venue)}`,
          `DESCRIPTION:${escICS(ev.description)}${ev.host ? '\\nFeaturing: ' + escICS(ev.host) : ''}`,
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:${escICS(ev.name)} starts in 10 minutes at ${escICS(ev.location)}!`,
          'TRIGGER:-PT10M',
          'END:VALARM',
          'END:VEVENT'
        ].join('\r\n');
      })
      .join('\r\n');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Endless Mountains Pride//Festival Guide//EN',
      'CALSCALE:GREGORIAN',
      `X-WR-CALNAME:${escICS(festName)} - My Schedule`,
      vevents,
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'endless-mountains-pride-my-schedule.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Downloaded calendar file with 10-min reminders!');
  }

  // =========================================================================
  // State Toggles & Navigation
  // =========================================================================
  function toggleSavedEvent(key) {
    if (state.savedEvents.has(key)) {
      state.savedEvents.delete(key);
      showToast('Removed from My Schedule');
    } else {
      state.savedEvents.add(key);
      showToast(state.remindersEnabled ? 'Added to My Schedule (10-min alert on!)' : 'Added to My Schedule');
    }
    saveJSON(STORAGE.savedEvents, [...state.savedEvents]);
    updateSavedCounts();
    renderScheduleList();
    renderMyPride();
    renderInteractiveMap();
    if (state.selectedLocation) renderMapInspector(state.selectedLocation);
  }

  function toggleEventBell(key) {
    if (!state.remindersEnabled) {
      setRemindersEnabled(true);
      state.mutedEvents.delete(key);
    } else if (state.mutedEvents.has(key)) {
      state.mutedEvents.delete(key);
      showToast('10-minute alert enabled for this event');
    } else {
      state.mutedEvents.add(key);
      showToast('Muted alert for this event');
    }
    saveJSON(STORAGE.mutedEvents, [...state.mutedEvents]);
    renderScheduleList();
    renderMyPride();
  }

  function toggleFavVendor(key) {
    if (state.favVendors.has(key)) {
      state.favVendors.delete(key);
      showToast('Removed from favorites');
    } else {
      state.favVendors.add(key);
      showToast('Saved to Favorites — highlighted on Map!');
    }
    saveJSON(STORAGE.favVendors, [...state.favVendors]);
    updateSavedCounts();
    renderVendorsGrid();
    renderMyPride();
    renderInteractiveMap();
    if (state.selectedLocation) renderMapInspector(state.selectedLocation);
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${tabName}`));
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabName));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderAll() {
    renderHeaderAndInfo();
    renderScheduleCategories();
    renderScheduleList();
    renderVendorCategories();
    renderVendorsGrid();
    renderInteractiveMap();
    if (state.selectedLocation) renderMapInspector(state.selectedLocation);
    renderMyPride();
  }

  // =========================================================================
  // Map Pan & Zoom Gestures
  // =========================================================================
  function initMapInteractions() {
    const viewport = document.getElementById('map-viewport');
    const canvas = document.getElementById('map-canvas');
    let isPointerDown = false;
    let dragged = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;

    viewport.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      isPointerDown = true;
      dragged = false;
      startX = e.clientX;
      startY = e.clientY;
      originX = state.mapPanX;
      originY = state.mapPanY;
      canvas.classList.add('dragging');
    });

    window.addEventListener('pointermove', (e) => {
      if (!isPointerDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragged = true;
      state.mapPanX = originX + dx;
      state.mapPanY = originY + dy;
      applyMapTransform();
    });

    window.addEventListener('pointerup', () => {
      if (!isPointerDown) return;
      isPointerDown = false;
      canvas.classList.remove('dragging');
      setTimeout(() => {
        dragged = false;
      }, 40);
    });

    viewport.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.16 : -0.16;
        state.mapZoom = Math.min(2.6, Math.max(0.85, state.mapZoom + delta));
        applyMapTransform();
      },
      { passive: false }
    );

    canvas.addEventListener('click', (e) => {
      if (dragged) return;
      const hotspot = e.target.closest('.map-hotspot');
      if (hotspot && hotspot.dataset.loc) {
        selectMapLocation(hotspot.dataset.loc, false);
      }
    });

    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const hotspot = e.target.closest('.map-hotspot');
        if (hotspot && hotspot.dataset.loc) {
          e.preventDefault();
          selectMapLocation(hotspot.dataset.loc, false);
        }
      }
    });

    document.getElementById('map-zoom-in').addEventListener('click', () => {
      state.mapZoom = Math.min(2.6, state.mapZoom + 0.25);
      applyMapTransform();
    });
    document.getElementById('map-zoom-out').addEventListener('click', () => {
      state.mapZoom = Math.max(0.85, state.mapZoom - 0.25);
      applyMapTransform();
    });
    document.getElementById('map-zoom-reset').addEventListener('click', () => {
      state.mapZoom = 1;
      state.mapPanX = 0;
      state.mapPanY = 0;
      applyMapTransform();
    });
  }

  // =========================================================================
  // Event Listeners & Initialization
  // =========================================================================
  function bindEvents() {
    // Tab navigation
    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    document.getElementById('brand-home').addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('schedule');
    });

    // Global delegated clicks (save event, favorite vendor, bell, jump to map, quick tabs)
    document.body.addEventListener('click', (e) => {
      const saveBtn = e.target.closest('[data-toggle-event]');
      if (saveBtn) {
        toggleSavedEvent(saveBtn.dataset.toggleEvent);
        return;
      }
      const bellBtn = e.target.closest('[data-toggle-bell]');
      if (bellBtn) {
        toggleEventBell(bellBtn.dataset.toggleBell);
        return;
      }
      const favBtn = e.target.closest('[data-toggle-vendor]');
      if (favBtn) {
        toggleFavVendor(favBtn.dataset.toggleVendor);
        return;
      }
      const jumpBtn = e.target.closest('[data-jump-loc]');
      if (jumpBtn) {
        selectMapLocation(jumpBtn.dataset.jumpLoc, true);
        return;
      }
      const quickJump = e.target.closest('[data-jump]');
      if (quickJump) {
        selectMapLocation(quickJump.dataset.jump, false);
        return;
      }
      const gotoBtn = e.target.closest('[data-goto-tab]');
      if (gotoBtn) {
        switchTab(gotoBtn.dataset.gotoTab);
      }
    });

    // Schedule search & categories
    document.getElementById('schedule-search').addEventListener('input', (e) => {
      state.scheduleSearch = e.target.value;
      renderScheduleList();
    });
    document.getElementById('schedule-category-chips').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-cat]');
      if (!chip) return;
      state.scheduleCategory = chip.dataset.cat;
      renderScheduleCategories();
      renderScheduleList();
    });

    // Vendor filters
    document.getElementById('vendor-search').addEventListener('input', (e) => {
      state.vendorSearch = e.target.value;
      renderVendorsGrid();
    });
    document.getElementById('vendor-type-segment').addEventListener('click', (e) => {
      const btn = e.target.closest('.seg-btn');
      if (!btn) return;
      state.vendorType = btn.dataset.type;
      document.querySelectorAll('#vendor-type-segment .seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
      renderVendorsGrid();
    });
    document.getElementById('vendor-category-chips').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-vcat]');
      if (!chip) return;
      state.vendorCategory = chip.dataset.vcat;
      renderVendorCategories();
      renderVendorsGrid();
    });

    // Map layer filters
    document.getElementById('map-layer-filters').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-layer]');
      if (!chip) return;
      state.mapLayer = chip.dataset.layer;
      document.querySelectorAll('#map-layer-filters .chip').forEach((c) => c.classList.toggle('active', c === chip));
      renderInteractiveMap();
    });

    // Reminders controls
    document.getElementById('btn-quick-notify').addEventListener('click', () => {
      setRemindersEnabled(!state.remindersEnabled);
    });
    document.getElementById('toggle-global-reminders').addEventListener('change', (e) => {
      setRemindersEnabled(e.target.checked);
    });
    document.getElementById('btn-test-notification').addEventListener('click', async () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch {}
      }
      const myEvents = getSortedSchedule().filter((ev) => state.savedEvents.has(eventKey(ev)));
      const sample = myEvents[0] || state.schedule[0] || {
        name: 'Opening Ceremony',
        startTime: '11:30 AM',
        location: 'Main Stage',
        host: 'Endless Mountains Pride'
      };
      fireEventReminder(sample, true);
    });
    document.getElementById('btn-export-ics').addEventListener('click', exportPersonalScheduleICS);
    document.getElementById('btn-browse-schedule').addEventListener('click', () => switchTab('schedule'));
    document.getElementById('btn-browse-vendors').addEventListener('click', () => switchTab('vendors'));

    // Reminder banner controls
    document.getElementById('reminder-banner-close').addEventListener('click', () => {
      document.getElementById('reminder-banner').classList.add('hidden');
    });
    document.getElementById('reminder-banner-map').addEventListener('click', () => {
      document.getElementById('reminder-banner').classList.add('hidden');
      if (activeBannerLocation) selectMapLocation(activeBannerLocation, true);
    });

    // Header Sync & Info Modal
    document.getElementById('btn-sync-sheet').addEventListener('click', () => syncFromGoogleSheet(true));
    const infoModal = document.getElementById('info-modal');
    document.getElementById('btn-open-info').addEventListener('click', () => infoModal.classList.remove('hidden'));
    document.getElementById('btn-close-info').addEventListener('click', () => infoModal.classList.add('hidden'));
    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) infoModal.classList.add('hidden');
    });

    document.getElementById('btn-save-sheet').addEventListener('click', () => {
      const val = document.getElementById('sheet-id-input').value;
      state.sheetId = extractSheetId(val);
      localStorage.setItem(STORAGE.sheetId, state.sheetId);
      syncFromGoogleSheet(true);
    });

    document.getElementById('btn-reset-sheet').addEventListener('click', () => {
      state.sheetId = CFG.DEFAULT_SHEET_ID;
      localStorage.setItem(STORAGE.sheetId, state.sheetId);
      document.getElementById('sheet-id-input').value = state.sheetId;
      syncFromGoogleSheet(true);
    });

    // 2026 Reference Map Modal
    const refModal = document.getElementById('ref-map-modal');
    document.getElementById('btn-ref-map').addEventListener('click', () => refModal.classList.remove('hidden'));
    document.getElementById('btn-close-ref-map').addEventListener('click', () => refModal.classList.add('hidden'));
    refModal.addEventListener('click', (e) => {
      if (e.target === refModal) refModal.classList.add('hidden');
    });

    // Close modals with Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        infoModal.classList.add('hidden');
        refModal.classList.add('hidden');
      }
    });
  }

  function init() {
    // Load any cached sheet data immediately for instant paint
    const cached = loadJSON(STORAGE.cache, null);
    if (cached && cached.sheetId === state.sheetId) {
      state.info = cached.info || state.info;
      state.vendors = cached.vendors || state.vendors;
      state.schedule = cached.schedule || state.schedule;
      state.lastSyncedAt = cached.lastSyncedAt;
    }

    bindEvents();
    initMapInteractions();
    renderAll();

    // Register Service Worker for offline Mountaineer Park access
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // Fetch live Google Sheet data
    syncFromGoogleSheet(false);

    // Check for 10-minute event reminders every 15 seconds
    checkUpcomingReminders();
    setInterval(checkUpcomingReminders, 15000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

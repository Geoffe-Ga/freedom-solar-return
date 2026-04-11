'use strict';

const DATA_URL = 'data/venues.json';

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function safeUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^mailto:/i.test(s)) return s;
  return '';
}

function renderDetail(icon, label, value) {
  if (!value) return '';
  return `
    <div class="card__detail">
      <span class="card__detail-icon">${icon}</span>
      <div>
        <span class="card__detail-label">${esc(label)}</span>
        <span class="card__detail-value">${esc(value)}</span>
      </div>
    </div>`;
}

function renderList(title, items) {
  if (!items || items.length === 0) return '';
  return `
    <div class="card__highlights">
      <div class="card__highlights-title">${esc(title)}</div>
      <ul class="card__list">
        ${items.map(i => `<li>${esc(i)}</li>`).join('')}
      </ul>
    </div>`;
}

function renderNote(note) {
  if (!note) return '';
  return `<div class="card__note">${esc(note)}</div>`;
}

function renderBooking(booking) {
  if (!booking) return '';

  const isWalkIn = booking.type === 'walk_in';
  const status = booking.status || 'unknown';

  // Determine dot color
  let dotClass = 'gray';
  let statusLabel = 'Status unknown';
  if (isWalkIn || status === 'always_open') {
    dotClass = 'green';
    statusLabel = booking.note || 'Walk-in \u2014 no reservation needed';
  } else if (status === 'available') {
    dotClass = 'green';
    statusLabel = 'Availability confirmed';
  } else if (status === 'limited') {
    dotClass = 'yellow';
    statusLabel = 'Limited availability';
  } else if (status === 'unavailable') {
    dotClass = 'red';
    statusLabel = 'No availability found';
  } else {
    statusLabel = 'Check availability below';
  }

  const platform = booking.platform && booking.platform !== 'none'
    ? `<span class="booking-bar__platform">via ${esc(booking.platform)}</span>`
    : '';

  const lastChecked = booking.last_checked
    ? `<span class="booking-bar__checked">Last checked: ${esc(new Date(booking.last_checked).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'short' }))}</span>`
    : '';

  // Button
  let btnHtml = '';
  if (booking.book_url) {
    btnHtml = safeUrl(booking.book_url) ? `<a href="${esc(safeUrl(booking.book_url))}" target="_blank" rel="noopener noreferrer" class="booking-bar__btn">Check Availability</a>` : '';
  } else if (isWalkIn) {
    btnHtml = `<span class="booking-bar__btn booking-bar__btn--walkin">Walk-In</span>`;
  }

  // Slots (for Resy)
  let slotsHtml = '';
  if (booking.slots && booking.slots.length > 0) {
    slotsHtml = `<div class="booking-bar__slots">${booking.slots.map(s => `<span class="booking-bar__slot">${esc(s)}</span>`).join('')}</div>`;
  }

  return `
    <div class="booking-bar">
      <div class="booking-bar__status">
        <span class="booking-bar__dot booking-bar__dot--${dotClass}"></span>
        <div>
          <span class="booking-bar__label">${esc(statusLabel)}</span>
          ${platform}
          ${lastChecked}
        </div>
      </div>
      ${btnHtml}
    </div>
    ${slotsHtml}`;
}

function renderSource(url) {
  if (!url) return '';
  const short = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const display = short.length > 60 ? short.substring(0, 57) + '...' : short;
  const safe = safeUrl(url);
  if (!safe) return '';
  return `<div class="card__source">Source: <a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(display)}</a></div>`;
}

function renderHotel(hotel) {
  const hours = hotel.hours;
  const hoursStr = hours
    ? Object.entries(hours).map(([d, h]) => `<dt>${esc(d)}</dt><dd>${esc(h)}</dd>`).join('')
    : '';

  return `
  <section class="section" id="hotel">
    <div class="section__header">
      <div class="section__icon">\u{1F3E8}</div>
      <div>
        <h2 class="section__title">Lodging</h2>
        <p class="section__subtitle">Where we rest our coffins</p>
      </div>
    </div>

    <div class="card">
      <div class="card__header">
        <h3 class="card__name">
          <a href="${esc(safeUrl(hotel.url))}" target="_blank" rel="noopener noreferrer">${esc(hotel.name)}</a>
        </h3>
        <span class="card__badge">${esc(hotel.loyalty || 'Hotel')}</span>
      </div>

      <div class="card__price">${esc(hotel.price_range)}</div>

      <div class="card__grid">
        ${renderDetail('\u{1F4CD}', 'Address', hotel.address)}
        ${renderDetail('\u{1F4DE}', 'Phone', hotel.phone)}
        ${renderDetail('\u{1F511}', 'Check-in', hotel.check_in)}
        ${renderDetail('\u{1F6AA}', 'Check-out', hotel.check_out)}
        ${renderDetail('\u{1F4B0}', 'Resort Fee', hotel.resort_fee)}
        ${renderDetail('\u{1F697}', 'Parking', hotel.parking)}
        ${renderDetail('\u{1F3CA}', 'Pool', hotel.pool)}
        ${renderDetail('\u{1F37D}\uFE0F', 'On-Site Dining', hotel.dining_onsite)}
        ${renderDetail('\u{1F43E}', 'Pet Policy', hotel.pet_policy)}
        ${renderDetail('\u{1F4A1}', 'Tip', hotel.booking_tip)}
      </div>

      ${renderList('Room Types', hotel.room_types)}
      ${renderList('Included Perks', hotel.perks)}
      ${renderBooking(hotel.booking)}
      ${renderNote(hotel.notes)}
      ${renderSource(hotel.source)}
    </div>
  </section>`;
}

function renderActivities(activities) {
  return `
  <section class="section" id="activities">
    <div class="section__header">
      <div class="section__icon">\u{1F40A}</div>
      <div>
        <h2 class="section__title">Activities</h2>
        <p class="section__subtitle">Adventures for the daring</p>
      </div>
    </div>
    ${activities.map(a => `
      <div class="card">
        <div class="card__header">
          <h3 class="card__name">
            <a href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer">${esc(a.name)}</a>
          </h3>
          <span class="card__badge">${esc(a.category)}</span>
        </div>
        <div class="card__price">${esc(a.price)}</div>
        <div class="card__grid">
          ${renderDetail('\u{1F4CD}', 'Address', a.address)}
          ${renderDetail('\u{1F4DE}', 'Phone', a.phone)}
          ${renderDetail('\u{1F550}', 'Hours', a.hours)}
          ${renderDetail('\u23F1\uFE0F', 'Duration', a.duration)}
          ${renderDetail('\u{1F690}', 'Transport', a.includes)}
          ${renderDetail('\u{1F4B3}', 'Payment', a.payment)}
        </div>
        ${renderList('Boat Options', a.boat_options)}
        ${renderList('Exhibits', a.exhibits)}
        ${a.fun_fact ? renderNote(a.fun_fact) : ''}
        ${renderBooking(a.booking)}
        ${a.restrictions ? renderNote('\u26A0\uFE0F ' + a.restrictions) : ''}
        ${renderNote(a.notes)}
        ${renderSource(a.source)}
      </div>
    `).join('')}
  </section>`;
}

function renderShopping(shops) {
  return `
  <section class="section" id="shopping">
    <div class="section__header">
      <div class="section__icon">\u{1F987}</div>
      <div>
        <h2 class="section__title">Shopping</h2>
        <p class="section__subtitle">Oddities, voodoo &amp; vampyre relics</p>
      </div>
    </div>
    ${shops.map(s => {
      let hoursHtml = '';
      if (s.hours && typeof s.hours === 'object') {
        hoursHtml = `<div class="card__grid"><div class="card__detail"><span class="card__detail-icon">\u{1F550}</span><div><span class="card__detail-label">Hours</span><dl class="hours-grid">${Object.entries(s.hours).map(([d, h]) => `<dt>${esc(d)}</dt><dd>${esc(h)}</dd>`).join('')}</dl></div></div></div>`;
      } else if (s.hours && typeof s.hours === 'string') {
        hoursHtml = renderDetail('\u{1F550}', 'Hours', s.hours);
      }
      return `
      <div class="card">
        <div class="card__header">
          <h3 class="card__name">
            <a href="${esc(safeUrl(s.website || s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>
          </h3>
        </div>
        <div class="card__price">${esc(s.price)}</div>
        <div class="card__grid">
          ${renderDetail('\u{1F4CD}', 'Address', s.address)}
          ${renderDetail('\u{1F4DE}', 'Phone', s.phone)}
          ${renderDetail('\u2709\uFE0F', 'Email', s.email)}
          ${s.psychic_readings ? renderDetail('\u{1F52E}', 'Readings', s.psychic_readings) : ''}
        </div>
        ${hoursHtml}
        ${s.description ? `<p style="margin-top:12px;color:var(--text-secondary);font-size:0.95rem;">${esc(s.description)}</p>` : ''}
        ${renderBooking(s.booking)}
        ${s.extras ? renderNote(s.extras) : ''}
        ${renderNote(s.notes)}
        ${renderSource(s.source)}
      </div>`;
    }).join('')}
  </section>`;
}

function renderDining(restaurants) {
  return `
  <section class="section" id="dining">
    <div class="section__header">
      <div class="section__icon">\u{1F377}</div>
      <div>
        <h2 class="section__title">Dining</h2>
        <p class="section__subtitle">Feasts for creatures of the night</p>
      </div>
    </div>
    ${restaurants.map(r => `
      <div class="card">
        <div class="card__header">
          <h3 class="card__name">
            <a href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a>
          </h3>
          <span class="card__badge">${esc(r.category)}</span>
        </div>
        <div class="card__price">${esc(r.price || r.price_range || '')}</div>
        <div class="card__grid">
          ${renderDetail('\u{1F4CD}', 'Address', r.address)}
          ${renderDetail('\u{1F4DE}', 'Phone', r.phone)}
          ${renderDetail('\u{1F550}', 'Hours', r.hours)}
          ${renderDetail('\u{1F457}', 'Dress Code', r.dress_code)}
          ${renderDetail('\u{1F4CB}', 'Reservations', r.reservations)}
        </div>
        ${renderList('Menu Highlights', r.menu_highlights)}
        ${renderList('Drinks', r.drink_highlights)}
        ${renderList('Included', r.includes)}
        ${renderBooking(r.booking)}
        ${r.extras ? renderNote(r.extras) : ''}
        ${renderNote(r.notes)}
        ${renderSource(r.source)}
      </div>
    `).join('')}
  </section>`;
}

function renderNightlife(venues) {
  return `
  <section class="section" id="nightlife">
    <div class="section__header">
      <div class="section__icon">\u{1F319}</div>
      <div>
        <h2 class="section__title">Nightlife</h2>
        <p class="section__subtitle">After dark, the real magic begins</p>
      </div>
    </div>
    ${venues.map(v => `
      <div class="card">
        <div class="card__header">
          <h3 class="card__name">
            <a href="${esc(safeUrl(v.url))}" target="_blank" rel="noopener noreferrer">${esc(v.name)}</a>
          </h3>
          <span class="card__badge">${esc(v.category)}</span>
        </div>
        ${v.cover ? `<div class="card__price">Cover: ${esc(v.cover)}</div>` : '<div class="card__price">No Cover</div>'}
        <div class="card__grid">
          ${renderDetail('\u{1F4CD}', 'Address', v.address)}
          ${renderDetail('\u{1F4DE}', 'Phone', v.phone)}
          ${renderDetail('\u{1F550}', 'Hours', v.hours)}
          ${renderDetail('\u{1F457}', 'Dress Code', v.dress_code)}
          ${renderDetail('\u{1F3B5}', 'Live Music', v.live_music)}
          ${renderDetail('\u{1F3AB}', 'Reservations', v.reservations)}
          ${renderDetail('\u{1F378}', 'Specialties', v.specialties)}
          ${v.how_to_enter ? renderDetail('\u{1F5DD}\uFE0F', 'How to Enter', v.how_to_enter) : ''}
        </div>
        ${v.description ? `<p style="margin-top:12px;color:var(--text-secondary);font-size:0.95rem;">${esc(v.description)}</p>` : ''}
        ${renderBooking(v.booking)}
        ${v.vibe ? renderNote('Vibe: ' + v.vibe) : ''}
        ${renderNote(v.notes)}
        ${v.tip ? renderNote('\u{1F4A1} ' + v.tip) : ''}
        ${renderSource(v.source)}
      </div>
    `).join('')}
  </section>`;
}

function renderStatusBar(meta) {
  const updated = meta.last_updated
    ? new Date(meta.last_updated).toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        dateStyle: 'long',
        timeStyle: 'short'
      })
    : 'Unknown';

  const health = meta.health_check;
  let healthHtml = '';
  if (health) {
    const cls = health.all_ok ? 'status-bar__healthy' : 'status-bar__unhealthy';
    const label = health.all_ok ? 'All venues reachable' : 'Some venues unreachable';
    healthHtml = ` \u00B7 <span class="${cls}">${label}</span>`;
  }

  return `
  <div class="status-bar">
    <p class="status-bar__text">
      Last refreshed: <span class="status-bar__time">${esc(updated)}</span>${healthHtml}
    </p>
    <p class="status-bar__text" style="margin-top:4px;font-size:0.7rem;">
      Auto-refreshes daily at midnight PST via GitHub Actions
    </p>
  </div>`;
}

async function init() {
  const app = document.getElementById('app');
  try {
    const resp = await fetch(DATA_URL);
    const data = await resp.json();

    let html = '';
    if (data.hotel) html += renderHotel(data.hotel);
    if (data.activities) html += renderActivities(data.activities);
    if (data.shopping) html += renderShopping(data.shopping);
    if (data.dining) html += renderDining(data.dining);
    if (data.nightlife) html += renderNightlife(data.nightlife);
    html += renderStatusBar(data.meta);

    app.innerHTML = html;
  } catch (err) {
    app.innerHTML = `
      <div style="text-align:center;padding:80px 24px;color:var(--accent-rose);">
        <p style="font-family:'Cinzel',serif;font-size:1.2rem;">Failed to load venue data</p>
        <p style="margin-top:8px;color:var(--text-muted);font-size:0.9rem;">${esc(err.message)}</p>
      </div>`;
  }
}

init();

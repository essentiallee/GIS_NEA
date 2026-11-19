import * as maplibregl from 'https://unpkg.com/maplibre-gl@6/dist/maplibre-gl.mjs';

// This small file replaces the template's full-page story layout with two panels.
// Chapter data stays separate so that the writing can change without changing the map.
const green = '#73987b';
const rose = '#cf647e';
const paper = '#faf9f3';
const story = document.querySelector('#story');
const legend = document.querySelector('#legend');
const status = document.querySelector('#map-status');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let activeChapter = 0;
let ready = false;
let animation = 0;
let baseZoom = 9.5;
let popup;
let values = { growth: 0, year: 0, group: 0 };

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {},
    layers: [{ id: 'paper', type: 'background', paint: { 'background-color': paper } }]
  },
  center: [-73.98, 40.71], zoom: 9.5, maxPitch: 65,
  attributionControl: false
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new maplibregl.ScaleControl({ maxWidth: 70, unit: 'metric' }), 'bottom-right');
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
map.on('error', event => {
  console.error(event.error);
  status.hidden = false;
  status.textContent = 'The map could not load. Refresh the page to try again.';
});

function lighten(hex, fraction) {
  const channels = hex.slice(1).match(/../g);
  return '#' + channels.map(channel => {
    const value = parseInt(channel, 16);
    return Math.round(value + (255 - value) * fraction).toString(16).padStart(2, '0');
  }).join('');
}

function source(id, data) { map.addSource(id, { type: 'geojson', data }); }
function layer(id, type, sourceId, paint, extra = {}) {
  map.addLayer({ id, type, source: sourceId, paint, ...extra });
}
function visible(id, show) { map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none'); }

function addMapLayers(prepared, ntas, directory) {
  // Python has already joined, grouped, buffered, and exported these layers.
  // The browser only displays them and interpolates the funding heights.
  source('ntas', ntas);
  source('directory', directory);
  for (const [id, geojson] of Object.entries(prepared)) source(id, geojson);

  layer('nta-fill', 'fill', 'ntas', { 'fill-color': ['get', 'color'], 'fill-opacity': 0 });
  layer('nta-lines', 'line', 'ntas', { 'line-color': '#b9bcb4', 'line-width': .45, 'line-opacity': .7 });
  layer('directory-points', 'circle', 'directory', {
    'circle-radius': 1.7, 'circle-color': '#484a44', 'circle-opacity': .35,
    'circle-stroke-width': 0
  });
  layer('emphasis-rings', 'circle', 'anchors', {
    'circle-radius': 15, 'circle-color': ['get', 'color'], 'circle-opacity': .05,
    'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': .6, 'circle-stroke-opacity': .5
  });
  layer('buffers-fill', 'fill', 'buffers', { 'fill-color': ['get', 'color'], 'fill-opacity': .12 });
  layer('buffers-lines', 'line', 'buffers', { 'line-color': ['get', 'color'], 'line-width': .7, 'line-opacity': .65 });
  layer('proposal-links', 'line', 'proposal', { 'line-color': '#6b967e', 'line-width': 1, 'line-dasharray': [3, 4], 'line-opacity': .7 });
  layer('proposal-rings', 'circle', 'anchors', {
    'circle-radius': 25, 'circle-color': ['get', 'color'], 'circle-opacity': .1,
    'circle-stroke-width': .6, 'circle-stroke-color': ['get', 'color']
  });
  layer('recipient-ground', 'circle', 'recipients', { 'circle-color': rose, 'circle-radius': 2,
    'circle-opacity': .6, 'circle-stroke-width': 0 });
  layer('funding', 'fill-extrusion', 'funding-columns', {
    'fill-extrusion-color': green, 'fill-extrusion-height': 0,
    'fill-extrusion-base': 0, 'fill-extrusion-opacity': .92,
    'fill-extrusion-height-transition': { duration: 0 },
    'fill-extrusion-color-transition': { duration: 0 }
  });
  layer('nta-funding', 'fill-extrusion', 'nta-columns', {
    'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'],
    'fill-extrusion-base': 0, 'fill-extrusion-opacity': .92
  });
  layer('negative-markers', 'circle', 'negative-ntas', { 'circle-radius': 5, 'circle-opacity': 0,
    'circle-stroke-width': 1.2, 'circle-stroke-color': ['get', 'color'] });
  layer('anchor-points', 'circle', 'anchors', { 'circle-radius': 3.5, 'circle-color': '#484a44', 'circle-stroke-width': 0 });
  map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: .35, position: [1.5, 190, 55] });
}

function paintFunding() {
  // Interpolate amounts, not arbitrary pixel positions: the column's base never moves.
  const { growth, year, group } = values;
  map.setPaintProperty('funding', 'fill-extrusion-height', ['*', growth,
    ['+', ['*', 1-year, ['get', 'h24']], ['*', year, ['get', 'h25']]]]);
  const yearColor = ['interpolate', ['linear'], year, 0, green, 1, rose];
  map.setPaintProperty('funding', 'fill-extrusion-color',
    ['interpolate', ['linear'], group, 0, yearColor, 1, ['get', 'color']]);
}

function animateFunding(target) {
  cancelAnimationFrame(animation);
  const start = { ...values };
  const began = performance.now();
  const duration = reduceMotion ? 0 : 1600;
  function frame(now) {
    const t = duration ? Math.min(1, (now-began)/duration) : 1;
    const ease = t*t*(3-2*t);
    for (const key of Object.keys(start)) values[key] = start[key] + (target[key]-start[key])*ease;
    paintFunding();
    if (t < 1) animation = requestAnimationFrame(frame);
  }
  animation = requestAnimationFrame(frame);
}

function camera(index, duration = 1300) {
  const tilted = index >= 1 && index <= 4;
  map.easeTo({ center: [-73.98, 40.71], zoom: baseZoom - (tilted ? .3 : 0),
    pitch: tilted ? 52 : 0, bearing: tilted ? -10 : 0,
    duration: reduceMotion ? 0 : duration, essential: false });
}

function renderLegend(index, data) {
  const palette = data.palette;
  const key = palette.MN0502 || '#a998b6';
  const rows = [
    [['#484a44','Current DCLA directory records'], ['#db567f','Fine rings: visual emphasis','ring']],
    [[green,'FY2024 positive recipient funding'], ['#b9bcb4','NTA boundaries','line']],
    [[rose,'FY2025 positive recipient funding'], ['#b9bcb4','Ground mark remains when positive funding is zero','ring']],
    [[palette.MN0502,'Midtown–Times Square'], [palette.BK0203,'Fort Greene'], [palette.MN1001,'Harlem (South)']],
    [[lighten(key,.56),'Pale NTA hue: FY2024'], [key,'Saturated version of the same hue: FY2025'], ['#a998b6','Outlined ground mark: negative annual net amount','ring']],
    [['#484a44','Selected recipients with lower funding'], ['#e6c95f','Half-mile straight-line buffers','ring'], ['#b9bcb4','Directory records inside / outside the buffers']],
    [['#db567f','Theater'], ['#6b967e','Music'], ['#e6c95f','Dance'], ['#a998b6','Visual arts'], ['#b9bcb4','Other / unknown discipline']],
    [['#6b967e','Proposed relationships, not observed transfers','dashed'], ['#db567f','Hypothetical shared support','ring']]
  ];
  const notes = [
    '2026 directory context; this is not a verified closure inventory.',
    'Height = funding, not building height. Same recipient scale in Chapters 2–4.',
    'Same height scale as FY2024. No award does not establish closure.',
    'Example NTA hues. Each NTA has its own color; height = FY2025 recipient funding.',
    'Same NTA hues as Chapter 4. Both years share a separate neighborhood height scale.',
    '12 examples selected by dollar decline, one per coordinate. Counts include co-located records.',
    'DCLA directory categories; the discipline-to-NEA funding linkage remains pending.',
    'Illustrative network only. No reserve balances, transfer amounts, or survival results are calculated.'
  ];
  const titles = ['CULTURAL LANDSCAPE','FY2024 FUNDING','FY2025 FUNDING','RECIPIENTS BY NTA',
    'TWO YEARS WITHIN EACH NTA','HALF-MILE PROXIMITY','DIRECTORY DISCIPLINES','PROPOSED ALLIANCE'];
  legend.replaceChildren();
  const title = document.createElement('h2');
  title.className = 'legend-title';
  title.textContent = `${String(index+1).padStart(2,'0')} / ${titles[index]}`;
  legend.append(title);
  rows[index].forEach(([color, label, shape]) => {
    const row = document.createElement('div'); row.className = 'legend-row';
    const swatch = document.createElement('span'); swatch.className = `swatch ${shape || ''}`;
    swatch.style.setProperty('--color', color);
    const text = document.createElement('span'); text.textContent = label;
    row.append(swatch, text); legend.append(row);
  });
  const note = document.createElement('p'); note.className = 'legend-note'; note.textContent = notes[index];
  legend.append(note);
  document.querySelector('#map-label').textContent = title.textContent;
}

function activate(index, data) {
  activeChapter = index;
  document.querySelector('#chapter-position').textContent = `${String(index+1).padStart(2,'0')} / 08`;
  document.querySelectorAll('.chapter').forEach((section, i) => section.setAttribute('aria-current', i === index ? 'step' : 'false'));
  renderLegend(index, data);
  if (!ready) return;
  popup?.remove();
  camera(index);
  ['emphasis-rings','buffers-fill','buffers-lines','proposal-links','proposal-rings',
    'recipient-ground','funding','nta-funding','negative-markers','anchor-points'].forEach(id => visible(id, false));
  map.setPaintProperty('nta-fill', 'fill-opacity', index === 3 ? .1 : index === 4 ? .04 : 0);
  map.setPaintProperty('directory-points','circle-color', index === 6 ?
    ['match',['get','discipline'],'Theater','#db567f','Music','#6b967e','Dance','#e6c95f','Visual Arts','#a998b6','#b9bcb4'] : '#484a44');
  map.setPaintProperty('directory-points','circle-radius', index === 6 ? 2.7 : 1.7);
  map.setPaintProperty('directory-points','circle-opacity', index === 6 ? .75 : index === 0 ? .4 : .16);
  if (index === 0) visible('emphasis-rings', true);
  if (index >= 1 && index <= 3) {
    visible('funding', true); visible('recipient-ground', true);
    map.setPaintProperty('recipient-ground','circle-color', index === 1 ? green : index === 3 ? ['get','color'] : rose);
  }
  if (index === 4) { visible('nta-funding', true); visible('negative-markers', true); }
  if (index === 5) ['buffers-fill','buffers-lines','anchor-points'].forEach(id => visible(id,true));
  if (index === 7) ['proposal-links','proposal-rings','anchor-points'].forEach(id => visible(id,true));
  animateFunding({ growth: index === 0 ? 0 : 1, year: index >= 2 ? 1 : 0, group: index === 3 ? 1 : 0 });
}

function renderChapters(chapters) {
  story.replaceChildren();
  chapters.forEach((c, i) => {
    const section = document.createElement('article');
    section.className = 'chapter'; section.id = `chapter-${i+1}`;
    const parts = [['p','chapter-number',c.number],['p','chapter-status',c.status],
      ['h2','',c.title],['p','chapter-lead',c.lead],['p','chapter-metric',c.metric],
      ['p','chapter-caption',c.caption],['p','chapter-method',c.method],
      ['p','chapter-source',c.source],['p','chapter-next',c.next]];
    parts.forEach(([tag, className, text]) => {
      const el = document.createElement(tag); el.className = className; el.textContent = text; section.append(el);
    });
    story.append(section);
  });
}

function setupStoryScroll(data) {
  let scheduled = false;
  function update() {
    scheduled = false;
    const threshold = story.scrollTop + story.clientHeight * .3;
    let next = 0;
    [...story.children].forEach((section, i) => { if (section.offsetTop <= threshold) next = i; });
    if (next !== activeChapter) activate(next, data);
  }
  story.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }, { passive: true });
}

const money = number => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(number);
function setupClicks() {
  const layers = ['funding','nta-funding','recipient-ground','negative-markers','anchor-points','directory-points'];
  map.on('click', event => {
    const hits = map.queryRenderedFeatures(event.point, { layers });
    if (!hits.length) return;
    const p = hits[0].properties;
    const card = document.createElement('div');
    const title = document.createElement('h3'); title.textContent = p.name; card.append(title);
    const lines = [];
    if (p.fy2024 !== undefined) {
      lines.push(`FY2024 net: ${money(Number(p.fy2024))}`, `FY2025 net: ${money(Number(p.fy2025))}`,
        `Change: ${money(Number(p.change))}`);
      if (p.nta) lines.push(`NTA: ${p.nta}`);
      if (p.nearby_records !== undefined) lines.push(`Directory records within ½ mile: ${p.nearby_records}`);
      lines.push('Funding records do not verify operating status.');
    } else lines.push(`Discipline: ${p.discipline || 'Not recorded'}`, 'DCLA directory, Oct 2026. Operating status unverified.');
    lines.forEach(text => { const paragraph = document.createElement('p'); paragraph.textContent = text; card.append(paragraph); });
    popup?.remove();
    popup = new maplibregl.Popup({maxWidth:'320px'}).setLngLat(event.lngLat).setDOMContent(card).addTo(map);
  });
  map.on('mousemove', event => {
    map.getCanvas().style.cursor = map.queryRenderedFeatures(event.point,{layers}).length ? 'pointer' : '';
  });
}

async function start() {
  const paths = ['data/funding.json','data/story-ntas.geojson','data/dcla-organizations.geojson','data/chapters.json','data/map-sources.json'];
  const [data, ntas, directory, chapters, prepared] = await Promise.all(paths.map(async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return response.json();
  }));
  renderChapters(chapters);
  setupStoryScroll(data);
  renderLegend(0, data);
  if (!map.isStyleLoaded()) await new Promise(resolve => map.once('load', resolve));
  addMapLayers(prepared, ntas, directory);
  map.fitBounds([[-74.26,40.49],[-73.70,40.92]], {padding:{top:85,bottom:160,left:45,right:45},duration:0});
  baseZoom = map.getZoom();
  ready = true;
  status.hidden = true;
  setupClicks();
  activate(activeChapter, data);
  document.querySelector('#reset-view').addEventListener('click', () => camera(activeChapter, 700));
  new ResizeObserver(() => {
    map.resize();
    const small = map.getContainer().clientWidth < 600;
    const view = map.cameraForBounds([[-74.26,40.49],[-73.70,40.92]], {
      padding: small ? {top:40,bottom:140,left:25,right:25} : {top:85,bottom:160,left:45,right:45}
    });
    if (view) baseZoom = view.zoom;
    camera(activeChapter, 0);
  }).observe(document.querySelector('.map-panel'));
  // A read-only handle helps inspect the local prototype in browser developer tools.
  window.alliance = { map, data, get chapter() { return activeChapter + 1; }, get values() { return {...values}; } };
}
start().catch(error => {
  console.error(error);
  status.hidden = false;
  status.textContent = 'The map could not load. Refresh or check your internet connection.';
});

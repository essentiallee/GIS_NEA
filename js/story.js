import * as maplibregl from 'https://unpkg.com/maplibre-gl@6/dist/maplibre-gl.mjs';

// This small file replaces the template's full-page story layout with two panels.
// Chapter data stays separate so that the writing can change without changing the map.
const green = '#73987b';
const rose = '#cf647e';
const paper = '#ffffff';
const story = document.querySelector('#story');
const legend = document.querySelector('#legend');
const status = document.querySelector('#map-status');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let activeChapter = 0;
let ready = false;
let animation = 0;
let baseZoom = 9.5;
let popup;
let transitionProgress = 1;
const legendOpen = {3:false};
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
// Keep the north arrow directly above the scale as it changes with zoom.
const scaleElement=document.querySelector('.maplibregl-ctrl-scale');
const scaleGroup=document.createElement('div');
scaleGroup.className='maplibregl-ctrl scale-with-north';
scaleElement.before(scaleGroup);
const north=document.createElement('div');
north.className='north-indicator';
north.setAttribute('role','img');
north.setAttribute('aria-label','North');
north.innerHTML='<span>N</span><svg viewBox="0 0 24 30" aria-hidden="true"><path d="M12 27V3M6 10l6-7 6 7" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
scaleGroup.append(north,scaleElement);
function updateNorth(){
  // Project a short geographic northward line so the arrow respects tilt too.
  const center=map.getCenter();
  const origin=map.project(center);
  const target=map.project([center.lng,Math.min(85,center.lat+.01)]);
  const angle=Math.atan2(target.x-origin.x,origin.y-target.y)*180/Math.PI;
  north.querySelector('svg').style.transform='rotate('+angle+'deg)';
}
map.on('move',updateNorth);
updateNorth();
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
map.on('error', event => {
  console.error(event.error);
  status.hidden = false;
  status.textContent = 'The map could not load. Refresh the page to try again.';
});

function darken(hex) { return '#' + hex.slice(1).match(/../g).map(c=>Math.round(parseInt(c,16)*.7).toString(16).padStart(2,'0')).join(''); }
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
  layer('nta-change','fill','ntas',{'fill-color':['get','change_color'],'fill-opacity':.72},{layout:{visibility:'none'}});
  layer('nta-lines', 'line', 'ntas', { 'line-color': '#b9bcb4', 'line-width': .45, 'line-opacity': .7 });
  layer('directory-points', 'circle', 'directory', {
    'circle-radius': 1.7, 'circle-color': '#484a44', 'circle-opacity': .35,
    'circle-stroke-width': 0
  });
  layer('buffers-fill', 'fill', 'buffers', { 'fill-color': '#999999', 'fill-opacity': .025 });
  layer('buffers-lines', 'line', 'buffers', { 'line-color': '#888888', 'line-width': .85, 'line-opacity': .65 });
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
  layer('change-extremes','circle','change-extreme-points',{
    'circle-radius':6,'circle-color':'#ffffff','circle-opacity':0,
    'circle-stroke-width':2,'circle-stroke-color':['case',['==',['get','extreme'],'gain'],'#39785f','#c44d72']
  },{filter:['!=',['get','extreme'],'']});
  layer('nta-funding', 'fill-extrusion', 'nta-columns', {
    'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'],
    'fill-extrusion-base': 0, 'fill-extrusion-opacity': .92
  });
  layer('nta-change-stacks','fill-extrusion','nta-change-columns',{
    'fill-extrusion-color':['get','color'],
    'fill-extrusion-base':['get','base'],
    'fill-extrusion-height':['get','height'],
    'fill-extrusion-opacity':.94
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
  if(activeChapter===2){
    const direction=['case',['>',['get','change'],0],green,['<',['get','change'],0],rose,'#b9bcb4'];
    const finalColor=['case',['==',['get','extreme'],'gain'],'#39785f',['==',['get','extreme'],'loss'],'#c44d72','#c7c8c2'];
    map.setPaintProperty('funding','fill-extrusion-color',transitionProgress<1?direction:finalColor);
    return;
  }
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
    transitionProgress=t;
    paintFunding();
    if (t < 1) animation = requestAnimationFrame(frame);
  }
  animation = requestAnimationFrame(frame);
}

function camera(index, duration = 1300) {
  const tilted = index >= 1 && index <= 4;
  const introInset = index === 0 && map.getContainer().clientWidth >= 600 ? .5 : 0;
  const center = introInset ? [-73.94,40.687] : [-73.98,40.71];
  map.easeTo({ center, zoom: baseZoom - (tilted ? .3 : introInset),
    pitch: tilted ? 52 : 0, bearing: tilted ? -10 : 0,
    duration: reduceMotion ? 0 : duration, essential: false });
}

function renderLegend(index, data) {
  const palette = data.palette;
  const key = palette.MN0502 || '#a998b6';
  const directoryCount = data.stats.directory_records;
  const rows = [
    [[ '#b9bcb4',`${directoryCount.toLocaleString()} equal-size rings = geolocated DCLA directory records`,'ring'],
      ...data.venueTypes.slice(0,4).map(t=>[t.color,`${t.type} · ${t.count} records`,'ring']),
      ['#b9bcb4','2020 Neighborhood Tabulation Area (NTA) boundaries','line']],
    [[green,`${data.stats.mapped_positive2024} mapped NEA recipients with positive FY2024 net funding`,'column'],
      [green,'Hollow point: no positive FY2024 net amount in the FY2024–25 comparison cohort','ring'],
      ['#484a44','Faint dots: DCLA directory locations, for context','dot']],
    [[green,'During movement: green bars grow; rose bars shrink','column'],
      ['#39785f','After movement: largest increase +$150,000 each — Icahn School of Medicine; Urban Health Plan','column'],
      ['#c44d72','Largest drop −$220,000 — Lincoln Center; outlined ground marker remains','ring'],
      ['#c7c8c2','Other FY2025 bars fade to gray after the transition','column'],
      ['#b9bcb4','Hollow point: no positive FY2025 net amount; not proof of closure','ring'],
      ['#484a44','Faint dots: DCLA directory locations, for context','dot']],
    [[palette.MN0502,'Midtown–Times Square · MN0502'],
      [palette.BK0203,'Fort Greene · BK0203'],
      [palette.MN1001,'Harlem (South) · MN1001']],
    [[ '#766b7f','Darker NTA color · bottom: recipient decreases'],
      ['#d8d2dc','Lighter NTA color · top: recipient increases']],
    [...data.changeClasses.map(c=>[c.color,c.label]),
      ['#ffffff','White: no nonzero net funding in this NTA series'],
      ['#484a44','12 largest mapped recipient declines, one per coordinate','dot'],
      ['#999999','Half-mile radius (2,640 US survey feet)','ring']],
    data.venueTypes.slice(0,4).map(t=>[t.color,`${t.type} · ${t.count} directory records`,'ring']),
    [['#484a44','Nodes: the 12 selected NEA recipients with recorded funding declines','dot'],
      ['#6b967e','Links: each example connects to its nearest other selected example','dashed']]
  ];
  if (index === 0 || index === 6) rows[index] = data.venueTypes.map(t=>[t.color,`${t.type} · ${t.count}`,'ring']);
  legend.classList.toggle('venue-legend',index === 0 || index === 6);
  const notes = [
    `${directoryCount.toLocaleString()} mapped DCLA records · October 2026. Equal-size ring = one record; color = recorded discipline. Co-located records remain overlapped; operating status unverified.`,
    '',
    'Total funding fell 58.1%, unevenly: 112 mapped recipients increased; 351 decreased. Heights use the same scale as FY2024 and show positive net amounts only. Lincoln Center: $145,000 to −$75,000; its bar stops at zero, while the signed −$220,000 change remains in the records. Extremes are ranked by mapped recipient dollar change; tied increases are both highlighted.',
    'Example NTA hues are listed above; the full key is below. Color identifies neighborhood, not funding rank. Height = positive FY2025 recipient net obligations (USD).',
    'One bar = one NTA, using the same neighborhood hue as Chapter 4. All decrease magnitudes are stacked below all increase magnitudes. Height = total absolute recipient change, not net funding: net change = upper gains minus lower losses. $100,000 = 1,200 map meters; this is not building height. Select a slice to inspect its recipient.',
    'Shading = signed NTA net change, FY2025 minus FY2024 (USD). Points are selected by recipient-level dollar decline, not NTA rank. Buffers use projected straight-line distance; this does not map poverty or visitor journeys.',
    'Same ring colors as Chapter 1: recorded DCLA discipline, October 2026. Equal ring size does not encode funding. The discipline-to-NEA linkage remains pending.',
    'Nearest neighbors use projected distance among these 12 examples only. Links are illustrative proposals, not verified partnerships or transfers; line width encodes no amount.'
  ];
  if (index === 3) rows[index].push(['#999999','Hollow point: no positive FY2025 recipient net amount','ring']);
  if (index > 0) rows[index].push(['#b9bcb4','2020 NTA boundaries','line']);
  if ([3,4,7].includes(index)) rows[index].push(['#484a44','Faint dots: DCLA directory locations, for context','dot']);
  const titles = ['VENUE TYPES','FY2024 FUNDING','FY2025 FUNDING','RECIPIENTS BY NTA',
    'STACKED LOSSES AND GAINS','NTA CHANGE + SELECTED DECLINES','VENUE TYPES','PROPOSED ALLIANCE'];
  legend.replaceChildren();
  const title = document.createElement('h2');
  title.className = 'legend-title';
  title.textContent = `${String(index+1).padStart(2,'0')} / ${titles[index]}`;
  legend.append(title);
  const rowsContainer = document.createElement('div');
  rowsContainer.className = (index === 0 || index === 6) ? 'legend-types-grid' : 'legend-rows';
  legend.append(rowsContainer);
  rows[index].forEach(([color, label, shape]) => {
    const row = document.createElement('div'); row.className = 'legend-row';
    const swatch = document.createElement('span'); swatch.className = `swatch ${shape || ''}`;
    swatch.style.setProperty('--color', color);
    const text = document.createElement('span'); text.textContent = label;
    row.append(swatch, text); rowsContainer.append(row);
  });
  const note = document.createElement('p'); note.className = 'legend-note'; note.textContent = notes[index];
  if(notes[index]) legend.append(note);
  if (index === 2) {
    const scale = document.createElement('p'); scale.className = 'legend-note legend-scale';
    scale.textContent = index === 4 ?
      'Linear height reference: $1,000,000 is 4× the height of $250,000.' :
      'Linear height reference: $100,000 is 4× the height of $25,000.';
    legend.append(scale);
  }
  if (index === 3 || index === 4) {
    const details = document.createElement('details'); details.className = 'nta-key';
    const summary = document.createElement('summary');
    summary.textContent = `All ${data.ntaLegend.length} NTA colors — names and codes`;
    const list = document.createElement('div'); list.className = 'nta-key-list';
    for (const nta of data.ntaLegend) {
      const row = document.createElement('div'); row.className = 'legend-row';
      const swatch = document.createElement('span'); swatch.className = 'swatch';
      swatch.style.setProperty('--color', nta.color);
      const text = document.createElement('span'); text.textContent = `${nta.name} · ${nta.id}`;
      row.append(swatch,text); list.append(row);
    }
    details.append(summary,list); legend.append(details);
  }
  const badges = ['Landscape','FY2024','FY2025','NTA groups','Loss / gain','Selection','Venue types','Alliance'];
  document.querySelector('#map-label').textContent = `${String(index+1).padStart(2,'0')}|08 ${badges[index]}`;
  legend.classList.toggle('chart-legend',index===4);
  legend.classList.toggle('is-collapsed',index===3 && !legendOpen[3]);
  const content = document.createElement('div'); content.className='legend-content';
  for(const node of [...legend.children]) if(node!==title) content.append(node);
  const header=document.createElement('div');header.className='legend-header';
  header.append(title);legend.append(header,content);
  if(index===3){
    const toggle=document.createElement('button');toggle.type='button';toggle.className='legend-toggle';
    function sync(){const open=legendOpen[3];toggle.textContent=open?'×':'+';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close NTA legend':'Open NTA legend');content.hidden=!open;legend.classList.toggle('is-collapsed',!open);const details=content.querySelector('details');if(details)details.open=true;}
    toggle.addEventListener('click',()=>{legendOpen[3]=!legendOpen[3];sync();});header.append(toggle);sync();
  }

}

function activate(index, data) {
  activeChapter = index;
  document.querySelector('#next-chapter').disabled=index===7;
  document.querySelector('#next-chapter').setAttribute('aria-label',index===7?'Last chapter':'Go to chapter '+(index+2));
  for(const id of ['previous-chapter','previous-chapter-right']) document.querySelector('#'+id).disabled=index===0;
  document.querySelector('#next-chapter-right').disabled=index===7;
  document.querySelector('#fixed-chapter-number').textContent=String(index+1).padStart(2,'0')+'|08';
  document.querySelector('#chapter-position').textContent = `${String(index+1).padStart(2,'0')} / 08`;
  document.querySelectorAll('.chapter').forEach((section, i) => section.setAttribute('aria-current', i === index ? 'step' : 'false'));
  renderLegend(index, data);
  if (!ready) return;
  popup?.remove();
  camera(index);
  ['nta-change','buffers-fill','buffers-lines','proposal-links','proposal-rings',
    'recipient-ground','funding','change-extremes','nta-funding','nta-change-stacks','negative-markers','anchor-points'].forEach(id => visible(id, false));
  map.setPaintProperty('nta-fill', 'fill-opacity', ['case',['get','has_funding_records'], index === 3 ? .1 : index === 4 ? .04 : 0, 0]);
  map.setPaintProperty('nta-lines','line-width',index === 0 ? .3 : .45);
  map.setPaintProperty('nta-lines','line-opacity',index === 0 ? .4 : .7);
  const typedVenues = index === 0 || index === 6;
  map.setPaintProperty('directory-points','circle-color', typedVenues ? paper : '#484a44');
  map.setPaintProperty('directory-points','circle-stroke-color',typedVenues ? ['coalesce',['get','type_color'],'#b9bcb4'] : '#484a44');
  map.setPaintProperty('directory-points','circle-stroke-width',typedVenues ? 1 : 0);
  map.setPaintProperty('directory-points','circle-stroke-opacity',typedVenues ? .9 : 0);
  map.setPaintProperty('directory-points','circle-radius', typedVenues ? ['interpolate',['linear'],['zoom'],9,1.8,12,3,15,4] : 1.7);
  map.setPaintProperty('directory-points','circle-opacity', typedVenues ? .95 : .16);
  if (index >= 1 && index <= 3) {
    visible('funding', true); visible('recipient-ground', true);
    map.setPaintProperty('recipient-ground','circle-color', index === 1 ? green : index === 3 ? ['get','color'] : rose);
    const yearField = index === 1 ? 'fy2024' : 'fy2025';
    const zero = ['<=',['get',yearField],0];
    const pointColor = index === 1 ? green : index === 3 ? ['get','color'] : rose;
    map.setPaintProperty('recipient-ground','circle-opacity',['case',zero,0,.25]);
    map.setPaintProperty('recipient-ground','circle-stroke-color',pointColor);
    map.setPaintProperty('recipient-ground','circle-stroke-width',1);
    map.setPaintProperty('recipient-ground','circle-stroke-opacity',['case',zero,.8,0]);
  }

  if (index === 2) visible('change-extremes',true);
  if (index === 4) visible('nta-change-stacks',true);
  if (index === 5) ['nta-change','buffers-fill','buffers-lines','anchor-points'].forEach(id => visible(id,true));
  if (index === 7) ['proposal-links','proposal-rings','anchor-points'].forEach(id => visible(id,true));
  animateFunding({ growth: index === 0 ? 0 : 1, year: index >= 2 ? 1 : 0, group: index === 3 ? 1 : 0 });
}

function renderChapters(chapters) {
  story.replaceChildren();
  chapters.forEach((c, i) => {
    const section = document.createElement('article');
    section.className = 'chapter'; section.id = `chapter-${i+1}`;
    const parts = [['p','chapter-status',c.status],
      ['h2','',c.title],['p','chapter-lead',c.lead],['p','chapter-metric',c.metric],
      ['p','chapter-caption',c.caption],['p','chapter-method',c.method],
      ['p','chapter-source',c.source],['p','chapter-next',c.next]];
    parts.forEach(([tag, className, text]) => {
      const el = document.createElement(tag); el.className = className; el.textContent = text; section.append(el);

    });
    if(i===4) section.append(document.querySelector('#chapter-chart-template').content.cloneNode(true));
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
function setupChangeChart(data) {
  const chart=data.changeChart;
  const byId=new Map(chart.rows.map(row=>[row.id,row]));
  const select=document.querySelector('#chart-view');
  document.querySelector('#axis-loss').textContent='−'+money(chart.domain_usd);
  document.querySelector('#axis-gain').textContent='+'+money(chart.domain_usd);
  const ns='http://www.w3.org/2000/svg';
  function render(){
    const container=document.querySelector('#chart-rows');container.replaceChildren();
    for(const id of chart.views[select.value]){
      const row=byId.get(id), item=document.createElement('div');item.className='chart-row';
      const label=document.createElement('span');label.className='chart-label';label.textContent=row.name;label.title=row.id;
      const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','-1.05 0 2.1 1');svg.setAttribute('preserveAspectRatio','none');svg.classList.add('chart-bars');
      const zero=document.createElementNS(ns,'line');zero.setAttribute('x1',0);zero.setAttribute('x2',0);zero.setAttribute('y1',0);zero.setAttribute('y2',1);zero.setAttribute('stroke','#cccccc');zero.setAttribute('vector-effect','non-scaling-stroke');svg.append(zero);
      for(const segment of row.segments){
        const rect=document.createElementNS(ns,'rect');
        rect.setAttribute('x',segment.x);rect.setAttribute('width',segment.width);rect.setAttribute('y',.14);rect.setAttribute('height',.72);
        rect.setAttribute('fill',segment.side==='loss'?darken(row.color):lighten(row.color,.55));rect.setAttribute('stroke','#fff');rect.setAttribute('stroke-width','.5');rect.setAttribute('vector-effect','non-scaling-stroke');
        const description=`${segment.name}: ${money(segment.change_cents/100)} change · ${row.name}`;
        rect.setAttribute('tabindex','0');rect.setAttribute('role','button');rect.setAttribute('aria-label',description);
        const title=document.createElementNS(ns,'title');title.textContent=description;rect.append(title);
        const inspect=()=>{
          const detail=document.querySelector('#chart-detail');detail.replaceChildren();
          const name=document.createElement('strong');name.textContent=segment.name;
          const change=document.createElement('p');change.className=segment.change_cents<0?'change-negative':segment.change_cents>0?'change-positive':'';
          change.textContent='Change: '+money(segment.change_cents/100);
          const context=document.createElement('p');context.textContent=row.name+' · NTA net change: '+money(row.net_cents/100);
          detail.append(name,change,context);
        };
        rect.addEventListener('click',inspect);rect.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect();}});svg.append(rect);
      }
      const net=document.createElement('span');net.className='chart-net';net.textContent=money(row.net_cents/100);
      item.append(label,svg,net);container.append(item);
    }
    container.scrollTop=0;
  }
  select.addEventListener('change',render);render();
}
function setupClicks() {
  const layers = ['change-extremes','nta-change-stacks','funding','nta-funding','recipient-ground','negative-markers','anchor-points','directory-points','nta-change'];
  map.on('click', event => {
    const hits = map.queryRenderedFeatures(event.point, { layers });
    if (!hits.length) return;
    const p = hits[0].properties;
    if(p.ntaname){p.name=p.ntaname;p.nta=p.nta2020;}
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
    lines.forEach(text => { const paragraph = document.createElement('p'); paragraph.textContent = text; if(text.startsWith('Change:')) paragraph.className=Number(p.change)<0?'change-negative':Number(p.change)>0?'change-positive':''; card.append(paragraph); });
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
    const response = await fetch(path, {cache:'no-store'});
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return response.json();
  }));
  renderChapters(chapters);
  setupChangeChart(data);
  function goToChapter(index){
    const target=document.querySelector('#chapter-'+(index+1));
    story.scrollTo({top:target.offsetTop,behavior:reduceMotion?'instant':'smooth'});
  }
  for(const id of ['next-chapter','next-chapter-right']) document.querySelector('#'+id).addEventListener('click',()=>goToChapter(Math.min(7,activeChapter+1)));
  for(const id of ['previous-chapter','previous-chapter-right']) document.querySelector('#'+id).addEventListener('click',()=>goToChapter(Math.max(0,activeChapter-1)));
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

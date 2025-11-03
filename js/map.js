// js/map.js
import { BASE_LAYERS } from './map_layers.js';
import { initUI } from './ui.js';
import { initNavigation } from './navigation.js';

// 1) Create map (as requested — do not change)
const map = L.map('map').setView([55.14, 30.16], 12);

// 2) Add default base layer
let currentBase = BASE_LAYERS['OpenStreetMap'].addTo(map);

// 3) Init UI (FABs, panels)
const ui = initUI({
  onBaseMapChange: switchBase
});

// 4) Init navigation and link routeFab
const navApi = initNavigation(map, { routeFab: ui.routeFab });

// 5) Load KML layers from kml_layers/layers.json
const layerObjects = {}; // name -> featureGroup
async function loadLayers() {
  try {
    const res = await fetch('kml_layers/layers.json', { cache: 'no-store' });
    if (!res.ok) {
      console.warn('layers.json not found', res.status);
      return;
    }
    const list = await res.json();
    const container = ui.layersListEl || document.getElementById('layers-list') || (function(){
      const el = document.createElement('div'); el.id='layers-list'; document.getElementById('layers-panel').appendChild(el); return el;
    })();
    container.innerHTML = '';
    for (const meta of list) {
      const name = meta.name || meta.file;
      const file = meta.file;
      if (!file) continue;
      try {
        const kmlText = await fetch('kml_layers/' + file).then(r => r.text());
        const blob = new Blob([kmlText], { type: 'application/vnd.google-earth.kml+xml' });
        const url = URL.createObjectURL(blob);
        const kmlLayer = new L.KML(url);
        // create feature group to control visibility
        const fg = L.featureGroup();
        // when kml layer loaded, move inner layers to fg
        kmlLayer.on('loaded', () => {
          try {
            kmlLayer.eachLayer(l => {
              if (meta.color && l.setStyle) l.setStyle({ color: meta.color, weight: 3 });
              fg.addLayer(l);
            });
          } catch (e) {
            fg.addLayer(kmlLayer);
          }
        });
        // add to map for now (KML plugin triggers loaded)
        kmlLayer.addTo(map);
        layerObjects[name] = fg;
        addLayerItem(container, name, fg);
      } catch (e) {
        console.warn('Failed loading KML', file, e);
      }
    }
  } catch (e) {
    console.error('Error loadLayers', e);
  }
}

function addLayerItem(container, name, fg) {
  const item = document.createElement('div');
  item.className = 'layer-item';

  item.innerHTML = `
    <div class="layer-line">
      <span class="layer-color" style="background:${fg.color || '#999'}"></span>
      <span class="layer-name">${name}</span>
      <div class="layer-actions">
        <button class="layer-btn toggle" title="Показать/Скрыть">👁️</button>
        <button class="layer-btn start" title="К началу">↩️</button>
        <button class="layer-btn end" title="К концу">↪️</button>
        <button class="layer-btn route" title="Маршрут к точке">🧭</button>
      </div>
    </div>
  `;

  const toggle = item.querySelector('.toggle');
  const startBtn = item.querySelector('.start');
  const endBtn = item.querySelector('.end');
  const routeBtn = item.querySelector('.route');

  let visible = true;
  toggle.onclick = () => {
    if (visible) { map.removeLayer(fg); toggle.textContent = '🚫'; }
    else { fg.addTo(map); toggle.textContent = '👁️'; }
    visible = !visible;
  };

  startBtn.onclick = () => {
    const pts = extractCoords(fg);
    if (pts.length) map.flyTo([pts[0][1], pts[0][0]], 15);
  };
  endBtn.onclick = () => {
    const pts = extractCoords(fg);
    if (pts.length) {
      const p = pts[pts.length - 1];
      map.flyTo([p[1], p[0]], 15);
    }
  };
  routeBtn.onclick = async () => {
    const pts = extractCoords(fg);
    if (pts.length && window.routeUiApi) {
      await window.routeUiApi.setDest(L.latLng(pts[0][1], pts[0][0]));
      window.routeUiApi.buildRoute();
    }
  };

  container.appendChild(item);
}

function extractCoords(fg) {
  const out = [];
  try {
    fg.eachLayer(l => {
      if (l.getLatLng) {
        const ll = l.getLatLng(); out.push([ll.lng, ll.lat]);
      } else if (l.getLatLngs) {
        const all = l.getLatLngs();
        flattenLatLngs(all).forEach(pp => out.push([pp.lng, pp.lat]));
      }
    });
  } catch (e) {}
  return out;
}
function flattenLatLngs(arr, out=[]) {
  if (!arr) return out;
  for (const a of arr) {
    if (Array.isArray(a)) flattenLatLngs(a, out);
    else if (a && a.lat!==undefined) out.push(a);
  }
  return out;
}

function switchBase(name) {
  if (currentBase) map.removeLayer(currentBase);
  const b = BASE_LAYERS[name];
  if (b) currentBase = b.addTo(map);
  else console.warn('base not found', name);
}

// init sequence
(async function init() {
  try {
    await loadLayers();
  } catch (e) {
    console.warn('init loadLayers error', e);
  }
})();

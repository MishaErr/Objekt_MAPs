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
  item.style.display = 'flex';
  item.style.justifyContent = 'space-between';
  item.style.alignItems = 'center';
  item.style.padding = '6px';
  item.style.borderRadius = '8px';
  item.style.background = '#fff';
  item.style.marginBottom = '6px';

  const left = document.createElement('div');
  left.style.display='flex'; left.style.alignItems='center'; left.style.gap='8px';
  left.innerHTML = `<div style="width:28px;height:8px;background:#ccc;border-radius:6px"></div><div style="font-weight:600">${name}</div>`;
  left.onclick = () => {
    if (fg && fg.getBounds && fg.getBounds().isValid()) map.flyToBounds(fg.getBounds(), { maxZoom: 15 });
  };

  const actions = document.createElement('div');
  actions.style.display='flex'; actions.style.gap='6px';
  const eye = document.createElement('button'); eye.innerHTML='👁️'; eye.title='Показать/Скрыть';
  const startBtn = document.createElement('button'); startBtn.innerHTML='↩️'; startBtn.title='К началу';
  const endBtn = document.createElement('button'); endBtn.innerHTML='↪️'; endBtn.title='К концу';
  const routeBtn = document.createElement('button'); routeBtn.innerHTML='🧭'; routeBtn.title='Маршрут к первой точке';

  let visible = true;
  eye.onclick = () => {
    if (visible) { try{ map.removeLayer(fg); }catch(e){} eye.innerHTML='🚫'; visible=false; }
    else { try{ fg.addTo(map); }catch(e){} eye.innerHTML='👁️'; visible=true; }
  };

  startBtn.onclick = () => {
    const pts = extractCoords(fg);
    if (pts.length) map.flyTo([pts[0][1], pts[0][0]], 15);
    else alert('Нет точек в слое');
  };
  endBtn.onclick = () => {
    const pts = extractCoords(fg);
    if (pts.length) { const p = pts[pts.length-1]; map.flyTo([p[1], p[0]], 15); }
    else alert('Нет точек в слое');
  };
  routeBtn.onclick = async () => {
    const pts = extractCoords(fg);
    if (!pts.length) return alert('Нет точек в слое');
    const p = pts[0];
    if (window.routeUiApi && typeof window.routeUiApi.setDest==='function') {
      await window.routeUiApi.setDest(L.latLng(p[1], p[0]));
      if (window.routeUiApi && typeof window.routeUiApi.buildRoute === 'function') window.routeUiApi.buildRoute();
    } else {
      map.flyTo([p[1], p[0]], 15);
    }
  };

  actions.appendChild(eye); actions.appendChild(startBtn); actions.appendChild(endBtn); actions.appendChild(routeBtn);
  item.appendChild(left); item.appendChild(actions);
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

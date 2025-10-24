// js/map.js
import { BASE_LAYERS } from './map_layers.js';
import { initUI } from './ui.js';
import { initNavigation } from './navigation.js'; // navigation returns init function
// map must be initialized exactly as requested:
const map = L.map('map').setView([55.14, 30.16], 12);

// Первая базовая карта
let currentBase = BASE_LAYERS["OpenStreetMap"].addTo(map);

// Инициализация UI (панели базовых карт и слоёв)
const { basePanel, layersPanel } = initUI({
  onBaseMapChange: switchBase
});

// Инициализация панели навигации — получаем объект с экшенами
const navApi = initNavigation(map);

// Словари слоёв KML
const layerObjects = {};   // name -> L.FeatureGroup (или L.LayerGroup)
const layerVisible = {};   // name -> boolean

// helper: load layers.json and KMLs
async function loadLayers() {
  try {
    const res = await fetch('kml_layers/layers.json', { cache: 'no-store' });
    if (!res.ok) {
      console.warn('layers.json not found or error', res.status);
      return;
    }
    const list = await res.json();
    const container = document.getElementById('layers-list') || document.createElement('div');
    if (!document.getElementById('layers-list')) { // attach if missing
      container.id = 'layers-list';
      layersPanel.appendChild(container);
    }
    // clear
    container.innerHTML = '';

    for (const meta of list) {
      const name = meta.name || meta.file;
      const kmlPath = 'kml_layers/' + meta.file;
      try {
        const txt = await fetch(kmlPath).then(r => r.text());
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(txt, 'text/xml');
        const kmlLayer = new L.KML(kmlDoc);
        // wrap in feature group to allow add/remove easily
        const fg = L.featureGroup();
        // L.KML may produce a layer (with getLayers)
        kmlLayer.on('loaded', () => {
          // move child layers into fg
          try {
            kmlLayer.eachLayer(l => {
              // apply simple style for lines/polys if possible
              if (l.setStyle && meta.color) {
                l.setStyle({ color: meta.color, weight: 3, opacity: 0.9 });
              }
              fg.addLayer(l);
            });
          } catch (e) {
            // fallback: add whole kmlLayer
            fg.addLayer(kmlLayer);
          }
        });
        // Add original KML layer to map (it will fire 'loaded')
        kmlLayer.addTo(map);
        // store
        layerObjects[name] = fg;
        layerVisible[name] = true;
        // show in UI
        addLayerListItem(container, name, fg);
      } catch (e) {
        console.warn('Failed load KML', kmlPath, e);
      }
    }
  } catch (e) {
    console.error('Error loading layers.json', e);
  }
}

// add item to layers list with actions
function addLayerListItem(container, name, layerGroup) {
  const item = document.createElement('div');
  item.className = 'layer-item';
  item.style.display = 'flex';
  item.style.justifyContent = 'space-between';
  item.style.alignItems = 'center';

  const left = document.createElement('div');
  left.style.display = 'flex';
  left.style.alignItems = 'center';
  left.style.gap = '8px';
  left.style.cursor = 'pointer';
  left.title = 'Перейти к слою';
  left.innerHTML = `<div style="width:34px;height:6px;border-radius:4px;background:#ccc"></div><div style="font-weight:600">${name}</div>`;
  left.onclick = () => {
    // fly to bounds if available
    if (layerGroup && layerGroup.getBounds && layerGroup.getBounds().isValid()) {
      map.flyToBounds(layerGroup.getBounds(), { maxZoom: 15 });
    } else {
      alert('Нет границ у слоя');
    }
  };

  const actions = document.createElement('div');
  actions.className = 'layer-actions';

  // eye button
  const eyeBtn = document.createElement('button');
  eyeBtn.type = 'button';
  eyeBtn.title = 'Показать/скрыть';
  eyeBtn.innerHTML = '👁️';
  eyeBtn.onclick = () => {
    if (layerVisible[name]) {
      // hide
      try { map.removeLayer(layerGroup); } catch (e) {}
      eyeBtn.innerHTML = '🚫';
      layerVisible[name] = false;
    } else {
      // show
      try { layerGroup.addTo(map); } catch (e) {}
      eyeBtn.innerHTML = '👁️';
      layerVisible[name] = true;
    }
  };

  // to-start button
  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.title = 'К началу слоя';
  startBtn.innerHTML = '↩️';
  startBtn.onclick = () => {
    // try to find first coordinate in layer
    const coords = extractCoordinatesFromLayer(layerGroup);
    if (!coords || coords.length === 0) return alert('В слое нет точек');
    const first = coords[0];
    map.flyTo([first[1], first[0]], 15);
  };

  // to-end button
  const endBtn = document.createElement('button');
  endBtn.type = 'button';
  endBtn.title = 'К концу слоя';
  endBtn.innerHTML = '↪️';
  endBtn.onclick = () => {
    const coords = extractCoordinatesFromLayer(layerGroup);
    if (!coords || coords.length === 0) return alert('В слое нет точек');
    const last = coords[coords.length - 1];
    map.flyTo([last[1], last[0]], 15);
  };

  // route-to-first (use navApi if available)
  const routeFirstBtn = document.createElement('button');
  routeFirstBtn.type = 'button';
  routeFirstBtn.title = 'Построить маршрут к первой точке';
  routeFirstBtn.innerHTML = '🧭';
  routeFirstBtn.onclick = async () => {
    const coords = extractCoordinatesFromLayer(layerGroup);
    if (!coords || coords.length === 0) return alert('В слое нет точек');
    const first = coords[0];
    // try to use navApi.setDest / buildRoute
    if (window.navApi && typeof window.navApi.setDest === 'function') {
      window.navApi.setDest(L.latLng(first[1], first[0]));
      // if start set, build
      if (window.navApi && typeof window.navApi.buildRoute === 'function') {
        window.navApi.buildRoute();
      }
    } else {
      // fallback: just fly to
      map.flyTo([first[1], first[0]], 15);
    }
  };

  actions.appendChild(eyeBtn);
  actions.appendChild(startBtn);
  actions.appendChild(endBtn);
  actions.appendChild(routeFirstBtn);

  item.appendChild(left);
  item.appendChild(actions);
  container.appendChild(item);
}

// helper to extract coords from layer: returns array of [lon,lat]
function extractCoordinatesFromLayer(layer) {
  if (!layer) return [];
  const coords = [];
  // if layer is FeatureGroup with layers
  try {
    layer.eachLayer(l => {
      // marker
      if (l.getLatLng) {
        const p = l.getLatLng();
        coords.push([p.lng, p.lat]);
      } else if (l.getLatLngs) {
        const ll = l.getLatLngs();
        flattenLatLngs(ll).forEach(pt => coords.push([pt.lng, pt.lat]));
      }
    });
  } catch (e) {
    console.warn('extractCoordinatesFromLayer error', e);
  }
  return coords;
}
function flattenLatLngs(arr, out = []) {
  if (!arr) return out;
  for (const a of arr) {
    if (Array.isArray(a)) flattenLatLngs(a, out);
    else if (a && a.lat !== undefined) out.push(a);
  }
  return out;
}

// switch base map
function switchBase(name) {
  if (currentBase) map.removeLayer(currentBase);
  const candidate = BASE_LAYERS[name];
  if (candidate) {
    currentBase = candidate.addTo(map);
  } else {
    console.warn('Base layer not found', name);
  }
}

// init
(async function init() {
  // expose nav API globally so layer buttons can use it
  try {
    window.navApi = initNavigation(map);
  } catch (e) {
    console.warn('Navigation init failed', e);
  }
  await loadLayers();
})();

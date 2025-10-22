import { BASE_LAYERS } from './map_layers.js';
import { initUI } from './ui.js';
import { initNavigation } from './navigation.js';

const map = L.map('map').setView([55.14, 30.16], 12);
let currentBase = BASE_LAYERS["OpenStreetMap"].addTo(map);
initNavigation(map);

// UI
const { basePanel, layersPanel } = initUI({
  onBaseMapChange: switchBase,
});

// наполняем панель базовых карт
for (const name in BASE_LAYERS) {
  const btn = document.createElement('button');
  btn.textContent = name;
  btn.onclick = () => switchBase(name);
  basePanel.appendChild(btn);
}

function switchBase(name) {
  if (currentBase) map.removeLayer(currentBase);
  currentBase = BASE_LAYERS[name].addTo(map);
}

// Загрузка KML
fetch('kml_layers/layers.json')
  .then(r => r.json())
  .then(layers => {
    layers.forEach(layer => loadKMLLayer(layer));
  });

function loadKMLLayer(layer) {
  fetch(`kml_layers/${layer.file}`)
    .then(res => res.text())
    .then(kmlText => {
      const parser = new DOMParser();
      const kml = parser.parseFromString(kmlText, 'text/xml');
      const track = new L.KML(kml);
      map.addLayer(track);
      addLayerToList(layer.name, track);
    });
}

function addLayerToList(name, layer) {
  const div = document.createElement('div');
  div.className = 'layer-item';
  div.innerHTML = `
    <span>${name}</span>
    <div class="layer-actions">
      <button title="Показать/скрыть">👁️</button>
      <button title="К началу">↩️</button>
      <button title="К концу">↪️</button>
    </div>
  `;
  const [eye, start, end] = div.querySelectorAll('button');
  eye.onclick = () => {
    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
      eye.textContent = '🚫';
    } else {
      map.addLayer(layer);
      eye.textContent = '👁️';
    }
  };
  start.onclick = () => {
    const bounds = layer.getBounds();
    map.flyTo(bounds.getNorthWest(), 13);
  };
  end.onclick = () => {
    const bounds = layer.getBounds();
    map.flyTo(bounds.getSouthEast(), 13);
  };
  document.getElementById('layers-list').appendChild(div);
}

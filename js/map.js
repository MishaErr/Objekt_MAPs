import { BASE_LAYERS } from './map_layers.js';
import { initUI } from './ui.js';
import { initNavigation } from './navigation.js';
const map = L.map('map').setView([55.14, 30.16], 12);
let currentBase = BASE_LAYERS["OpenStreetMap"].addTo(map);
const { basePanel, layersPanel } = initUI({ onBaseMapChange: switchBase });
initNavigation(map);
function switchBase(name) {
  if (currentBase) map.removeLayer(currentBase);
  currentBase = BASE_LAYERS[name].addTo(map);
}
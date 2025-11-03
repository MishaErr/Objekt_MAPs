// js/navigation.js
import { ORS_API_KEY } from './config.js';

/**
 * initNavigation(map, controls)
 * controls: { routeFab } - элемент FAB для открытия панели
 */
export function initNavigation(map, controls = {}) {
  // state
  let startMarker = null;
  let destMarker = null;
  let routeLine = null;
  let travelMode = 'driving-car';

  // create panel if not exists
  let panel = document.getElementById('route-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'route-panel';
    panel.className = 'route-panel';
    panel.innerHTML = `
      <div class="rp-row">
        <input id="rp-start" placeholder="Откуда (адрес или тач на карте)" />
        <div class="rp-buttons"><button id="rp-find-start">🔎</button><button id="rp-map-start">📍</button></div>
      </div>
      <div class="rp-row">
        <input id="rp-dest" placeholder="Куда (адрес или тач на карте)" />
        <div class="rp-buttons"><button id="rp-find-dest">🔎</button><button id="rp-map-dest">📍</button></div>
      </div>
      <div class="rp-row rp-modes">
        <button data-mode="driving-car" class="rp-mode active">🚗</button>
        <button data-mode="foot-walking" class="rp-mode">🚶</button>
        <button data-mode="cycling-regular" class="rp-mode">🚴</button>
        <button data-mode="driving-hgv" class="rp-mode" title="Грузовой транспорт">
  <img src="./icons/truck.svg" alt="truck" style="width:20px;height:20px;vertical-align:middle;">
</button>
      </div>
      <div class="rp-row rp-actions">
        <button id="rp-build" class="rp-build">Построить</button>
        <button id="rp-clear" class="rp-clear">Очистить</button>
      </div>
      <div id="rp-info" class="rp-info"></div>
    `;
    document.body.appendChild(panel);
  }

  // wire to FAB if provided
  const fab = controls.routeFab || document.getElementById('route-fab');
  if (fab) fab.onclick = () => panel.classList.toggle('open');

  // elements
  const startInput = panel.querySelector('#rp-start');
  const destInput = panel.querySelector('#rp-dest');
  const findStartBtn = panel.querySelector('#rp-find-start');
  const findDestBtn = panel.querySelector('#rp-find-dest');
  const mapStartBtn = panel.querySelector('#rp-map-start');
  const mapDestBtn = panel.querySelector('#rp-map-dest');
  const buildBtn = panel.querySelector('#rp-build');
  const clearBtn = panel.querySelector('#rp-clear');
  const infoDiv = panel.querySelector('#rp-info');
  const modeButtons = Array.from(panel.querySelectorAll('.rp-mode'));

  function setInfo(text) { infoDiv.textContent = text || ''; }

  // ORS geocode (with bias to map center)
  async function geocode(text) {
    if (!text) return null;
    const c = map.getCenter();
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(text)}&size=5&focus.point.lat=${c.lat}&focus.point.lon=${c.lng}`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('geocode status ' + r.status);
      const j = await r.json();
      if (j.features && j.features.length) {
        const [lon, lat] = j.features[0].geometry.coordinates;
        return L.latLng(lat, lon);
      }
    } catch (e) {
      console.warn('geocode error', e);
    }
    return null;
  }

  // ORS reverse geocode (label)
  async function reverseGeocode(latlng) {
    try {
      const url = `https://api.openrouteservice.org/geocode/reverse?api_key=${ORS_API_KEY}&point.lat=${latlng.lat}&point.lon=${latlng.lng}&size=1`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('reverse status ' + r.status);
      const j = await r.json();
      if (j.features && j.features[0] && j.features[0].properties && j.features[0].properties.label) {
        return j.features[0].properties.label;
      }
    } catch (e) {
      console.warn('reverse error', e);
    }
    return `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
  }

  // marker with letter A/B
  function createLabelIcon(letter) {
    const html = `<div class="marker-divicon"><div class="marker-dot">${letter}</div></div>`;
    return L.divIcon({ className: 'marker-divicon-wrap', html, iconSize: [30, 30], iconAnchor: [15, 30] });
  }
  function placeMarker(which, latlng) {
    if (which === 'A') {
      if (startMarker) map.removeLayer(startMarker);
      startMarker = L.marker(latlng, { draggable: true, icon: createLabelIcon('A') }).addTo(map);
      startMarker.on('dragend', async () => {
        const ll = startMarker.getLatLng();
        startInput.value = await reverseGeocode(ll);
        if (startMarker && destMarker) buildRoute();
      });
      return startMarker;
    } else {
      if (destMarker) map.removeLayer(destMarker);
      destMarker = L.marker(latlng, { draggable: true, icon: createLabelIcon('B') }).addTo(map);
      destMarker.on('dragend', async () => {
        const ll = destMarker.getLatLng();
        destInput.value = await reverseGeocode(ll);
        if (startMarker && destMarker) buildRoute();
      });
      return destMarker;
    }
  }

  // set on map modes
  function enableSetOnMap(which) {
    setInfo(`Клик по карте, чтобы установить ${which === 'A' ? 'начало (A)' : 'конец (B)'}`);
    const handler = async (e) => {
      const ll = e.latlng;
      const m = placeMarker(which, ll);
      const label = await reverseGeocode(ll);
      if (which === 'A') startInput.value = label; else destInput.value = label;
      setInfo('');
      map.off('click', handler);
      if (startMarker && destMarker) buildRoute();
    };
    map.once('click', handler);
  }

  mapStartBtn.onclick = () => enableSetOnMap('A');
  mapDestBtn.onclick = () => enableSetOnMap('B');

  // find buttons
  findStartBtn.onclick = async () => {
    setInfo('Ищем...');
    const ll = await geocode(startInput.value);
    if (!ll) { setInfo('Не найдено'); return; }
    placeMarker('A', ll);
    startInput.value = await reverseGeocode(ll);
    map.panTo(ll);
    setInfo('');
    if (startMarker && destMarker) buildRoute();
  };
  findDestBtn.onclick = async () => {
    setInfo('Ищем...');
    const ll = await geocode(destInput.value);
    if (!ll) { setInfo('Не найдено'); return; }
    placeMarker('B', ll);
    destInput.value = await reverseGeocode(ll);
    map.panTo(ll);
    setInfo('');
    if (startMarker && destMarker) buildRoute();
  };

  // mode switch
  modeButtons.forEach(b => {
    b.onclick = () => {
      modeButtons.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      travelMode = b.dataset.mode;
      if (startMarker && destMarker) buildRoute();
    };
  });

  // build route via ORS (fallback not using L.Routing to keep simple)
  async function buildRoute() {
    if (!startMarker || !destMarker) { alert('Укажите старт и финиш'); return; }
    setInfo('Строим маршрут...');
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    const s = startMarker.getLatLng();
    const d = destMarker.getLatLng();

    // ORS call
    try {
      const body = { coordinates: [[s.lng, s.lat], [d.lng, d.lat]], format: 'geojson', instructions: false };
      const resp = await fetch(`https://api.openrouteservice.org/v2/directions/${travelMode}/geojson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': ORS_API_KEY },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error('ORS status ' + resp.status);
      const j = await resp.json();
      if (!j.features || !j.features[0]) throw new Error('no route');
      const coords = j.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
      routeLine = L.polyline(coords, { color: '#2b3a66', weight: 6, opacity: 0.95 }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
      const sum = j.features[0].properties && j.features[0].properties.summary;
      if (sum) setInfo(`📏 ${(sum.distance/1000).toFixed(1)} км · ⏱ ${(sum.duration/60).toFixed(0)} мин`);
      else setInfo('');
      return;
    } catch (e) {
      console.warn('ORS route failed', e);
      // simple fallback: draw straight line and inform user
      routeLine = L.polyline([s, d], { color: '#d9534f', dashArray: '6,6', weight: 4 }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
      setInfo('Маршрут не построен (ORS error). Показан прямой.');
      return;
    }
  }

  buildBtn.onclick = buildRoute;

  clearBtn.onclick = () => {
    if (startMarker) { map.removeLayer(startMarker); startMarker = null; startInput.value = ''; }
    if (destMarker) { map.removeLayer(destMarker); destMarker = null; destInput.value = ''; }
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    setInfo('');
  };

  // contextmenu quick actions
  map.on('contextmenu', e => {
    const existing = document.getElementById('route-context-menu');
    if (existing) existing.remove();
    const menu = document.createElement('div');
    menu.id = 'route-context-menu';
    menu.className = 'route-context';
    menu.style.left = `${e.originalEvent.clientX}px`;
    menu.style.top = `${e.originalEvent.clientY}px`;
    menu.innerHTML = `<button id="ctx-to">Маршрут сюда</button><button id="ctx-from">Маршрут отсюда</button>`;
    document.body.appendChild(menu);
    document.addEventListener('click', () => { try { menu.remove(); } catch (e) {} }, { once: true });
    menu.querySelector('#ctx-to').onclick = async () => {
      if (destMarker) map.removeLayer(destMarker);
      placeMarker('B', e.latlng);
      destInput.value = await reverseGeocode(e.latlng);
      menu.remove();
      if (startMarker && destMarker) buildRoute();
    };
    menu.querySelector('#ctx-from').onclick = async () => {
      if (startMarker) map.removeLayer(startMarker);
      placeMarker('A', e.latlng);
      startInput.value = await reverseGeocode(e.latlng);
      menu.remove();
      if (startMarker && destMarker) buildRoute();
    };
  });

  // expose API
  const api = {
    setStart: async (latlng) => {
      placeMarker('A', latlng);
      startInput.value = await reverseGeocode(latlng);
    },
    setDest: async (latlng) => {
      placeMarker('B', latlng);
      destInput.value = await reverseGeocode(latlng);
    },
    buildRoute
  };
  window.routeUiApi = api;
  return api;
}

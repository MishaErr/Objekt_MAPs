// js/navigation.js
import { ORS_API_KEY } from './config.js';

/**
 * Современная панель навигации
 * Геокодирование через OpenRouteService
 */
export function initNavigation(map) {
  let startMarker = null;
  let destMarker = null;
  let routeLine = null;
  let travelMode = 'driving-car';

  // === 1. Создаём панель ===
  const panel = document.createElement('div');
  panel.id = 'nav-panel';
  panel.innerHTML = `
    <div class="nav-header"><div></div></div>
    <div class="nav-inputs">
      <input id="start-input" placeholder="Откуда" />
      <input id="dest-input" placeholder="Куда" />
    </div>
    <div class="nav-modes">
      <button class="mode" data-mode="driving-car" title="Авто">🚗</button>
      <button class="mode" data-mode="foot-walking" title="Пешком">🚶</button>
      <button class="mode" data-mode="cycling-regular" title="Велосипед">🚴</button>
      <button class="mode" data-mode="driving-hgv" title="Грузовой">🛻</button>
    </div>
    <button id="nav-build">Построить маршрут</button>
    <button id="nav-clear">Очистить</button>
    <div id="route-info"></div>
  `;
  document.body.appendChild(panel);

  const startInput = panel.querySelector('#start-input');
  const destInput = panel.querySelector('#dest-input');
  const buildBtn = panel.querySelector('#nav-build');
  const clearBtn = panel.querySelector('#nav-clear');
  const infoDiv = panel.querySelector('#route-info');
  const header = panel.querySelector('.nav-header');

  // === 2. Переключение панели ===
  header.onclick = () => panel.classList.toggle('open');

  // === 3. Режимы транспорта ===
  const modeButtons = panel.querySelectorAll('.mode');
  modeButtons.forEach(btn => {
    btn.onclick = () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      travelMode = btn.dataset.mode;
      if (startMarker && destMarker) buildRoute();
    };
  });
  modeButtons[0].classList.add('active');

  // === 4. Геокодирование по вводу ===
  async function geocode(address) {
    if (!address) return null;
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(address)}&size=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.features && data.features[0]) {
      const [lon, lat] = data.features[0].geometry.coordinates;
      return L.latLng(lat, lon);
    }
    return null;
  }

  // === 5. Маршрут ===
  async function buildRoute() {
    const startText = startInput.value.trim();
    const destText = destInput.value.trim();

    if (!startText || !destText) {
      alert('Укажите начальную и конечную точки');
      return;
    }

    const startCoords = await geocode(startText);
    const destCoords = await geocode(destText);

    if (!startCoords || !destCoords) {
      alert('Не удалось определить координаты');
      return;
    }

    if (startMarker) map.removeLayer(startMarker);
    if (destMarker) map.removeLayer(destMarker);
    startMarker = L.marker(startCoords).addTo(map);
    destMarker = L.marker(destCoords).addTo(map);

    const body = {
      coordinates: [[startCoords.lng, startCoords.lat], [destCoords.lng, destCoords.lat]],
      format: 'geojson',
      instructions: false
    };

    try {
      const res = await fetch(`https://api.openrouteservice.org/v2/directions/${travelMode}/geojson`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': ORS_API_KEY
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!data.features || !data.features[0]) throw new Error('Нет маршрута');

      const coords = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
      const summary = data.features[0].properties.summary;

      if (routeLine) map.removeLayer(routeLine);
      routeLine = L.polyline(coords, { color: '#0078ff', weight: 5 }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

      infoDiv.innerHTML = `📏 ${(summary.distance / 1000).toFixed(1)} км, ⏱️ ${(summary.duration / 60).toFixed(0)} мин`;
      panel.classList.add('open');
    } catch (e) {
      console.error(e);
      alert('Не удалось построить маршрут');
    }
  }

  buildBtn.onclick = buildRoute;

  // === 6. Очистка ===
  clearBtn.onclick = () => {
    if (startMarker) map.removeLayer(startMarker);
    if (destMarker) map.removeLayer(destMarker);
    if (routeLine) map.removeLayer(routeLine);
    startMarker = destMarker = routeLine = null;
    infoDiv.textContent = '';
    startInput.value = '';
    destInput.value = '';
  };

  // === 7. Используем геолокацию для автостарт ===
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      startInput.value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)} (мое местоположение)`;
    });
  }
}

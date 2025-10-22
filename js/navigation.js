import { ORS_API_KEY } from './config.js';

export function initNavigation(map) {
  let startMarker = null;
  let destMarker = null;
  let routeLine = null;
  let travelMode = "driving-car";

  const navBtn = document.getElementById('nav-btn');

  // создаём всплывающую панель
  const navPanel = document.createElement('div');
  navPanel.className = 'fab-panel';
  navPanel.innerHTML = `
    <div class="mode-select">
      <button data-mode="driving-car" title="Авто">🚗</button>
      <button data-mode="foot-walking" title="Пешком">🚶</button>
      <button data-mode="driving-hgv" title="Грузовой">🚚</button>
    </div>
    <div class="nav-actions">
      <button id="set-start" class="big-btn">📍 Старт</button>
      <button id="set-dest" class="big-btn">🎯 Финиш</button>
      <button id="use-location" class="big-btn secondary">📡 Местоположение</button>
      <button id="clear-route" class="big-btn secondary">❌ Очистить</button>
    </div>
    <div id="route-info"></div>
  `;
  document.body.appendChild(navPanel);

  navBtn.onclick = () => togglePanel(navPanel);

  // режим транспорта
  const modeButtons = navPanel.querySelectorAll('.mode-select button');
  modeButtons.forEach(b => {
    b.onclick = () => {
      modeButtons.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      travelMode = b.dataset.mode;
      if (startMarker && destMarker) buildRoute();
    };
  });

  // кнопки
  navPanel.querySelector('#set-start').onclick = () => setMarker('start');
  navPanel.querySelector('#set-dest').onclick = () => setMarker('dest');
  navPanel.querySelector('#use-location').onclick = useCurrentLocation;
  navPanel.querySelector('#clear-route').onclick = clearRoute;

  // установка маркеров
  function setMarker(type) {
    alert(`Кликни по карте, чтобы выбрать ${type === 'start' ? 'начальную' : 'конечную'} точку`);
    map.once('click', e => {
      const { lat, lng } = e.latlng;
      if (type === 'start') {
        if (startMarker) map.removeLayer(startMarker);
        startMarker = L.marker([lat, lng], { title: "Старт" }).addTo(map);
      } else {
        if (destMarker) map.removeLayer(destMarker);
        destMarker = L.marker([lat, lng], { title: "Финиш" }).addTo(map);
      }
      if (startMarker && destMarker) buildRoute();
    });
  }

  // использовать текущее местоположение
  function useCurrentLocation() {
    if (!navigator.geolocation) {
      alert("Геолокация не поддерживается");
      return;
    }
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      if (startMarker) map.removeLayer(startMarker);
      startMarker = L.marker([latitude, longitude], { title: "Ты здесь" }).addTo(map);
      map.flyTo([latitude, longitude], 14);
    }, err => alert("Не удалось получить местоположение"));
  }

  // построить маршрут
  async function buildRoute() {
    const start = startMarker.getLatLng();
    const end = destMarker.getLatLng();
    const url = `https://api.openrouteservice.org/v2/directions/${travelMode}?api_key=${ORS_API_KEY}&start=${start.lng},${start.lat}&end=${end.lng},${end.lat}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Ошибка маршрутизации");
      const data = await res.json();
      const coords = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
      const distance = (data.features[0].properties.summary.distance / 1000).toFixed(1);
      const duration = Math.round(data.features[0].properties.summary.duration / 60);
      
      if (routeLine) map.removeLayer(routeLine);
      routeLine = L.polyline(coords, { color: "#0078ff", weight: 5 }).addTo(map);
      map.fitBounds(routeLine.getBounds());

      document.getElementById('route-info').innerHTML = `📏 ${distance} км, ⏱ ${duration} мин`;
    } catch (e) {
      console.error(e);
      alert("Не удалось построить маршрут");
    }
  }

  // очистить
  function clearRoute() {
    if (routeLine) map.removeLayer(routeLine);
    if (startMarker) map.removeLayer(startMarker);
    if (destMarker) map.removeLayer(destMarker);
    routeLine = startMarker = destMarker = null;
    document.getElementById('route-info').innerHTML = "";
  }

  function togglePanel(panel) {
    const visible = panel.classList.contains('visible');
    document.querySelectorAll('.fab-panel').forEach(p => p.classList.remove('visible'));
    if (!visible) panel.classList.add('visible');
  }

  return { buildRoute, clearRoute };
}

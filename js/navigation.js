// js/navigation.js
import { ORS_API_KEY } from './config.js'; // ожидается: export const ORS_API_KEY = "..." в js/config.js

/**
 * initNavigation(map)
 * - создаёт панель навигации (три иконки: пешком, легковой, грузовой)
 * - позволяет установить старт/финиш по клику, использовать текущее местоположение,
 * - строит маршрут через ORS (если ключ есть) или использует OSRM (fallback).
 */
export function initNavigation(map) {
  // создаём панель только один раз
  let navPanel = document.querySelector('.nav-fab-panel');
  if (!navPanel) {
    navPanel = document.createElement('div');
    navPanel.className = 'fab-panel nav-fab-panel';
    navPanel.style.right = '70px';
    navPanel.style.bottom = '140px';
    navPanel.style.width = '260px';
    navPanel.style.zIndex = '10009';
    navPanel.style.padding = '10px';
    navPanel.style.borderRadius = '10px';
    navPanel.style.background = 'rgba(255,255,255,0.98)';
    navPanel.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <button class="mode-btn" data-mode="foot-walking" title="Пешком">🚶</button>
        <button class="mode-btn active" data-mode="driving-car" title="Легковой">🚗</button>
        <button class="mode-btn" data-mode="driving-hgv" title="Грузовой">🚚</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button id="nav-set-start" class="big-btn">📍 Установить старт</button>
        <button id="nav-set-dest" class="big-btn">🎯 Установить финиш</button>
        <button id="nav-use-loc" class="big-btn secondary">📡 Моя позиция</button>
        <button id="nav-clear" class="big-btn secondary">❌ Очистить</button>
      </div>
      <div id="nav-route-info" style="margin-top:8px;font-weight:600"></div>
    `;
    document.body.appendChild(navPanel);
  }

  // Переменные маршрута
  let startMarker = null;
  let destMarker = null;
  let routeLine = null;
  let travelMode = 'driving-car';

  // элементы
  const modeButtons = Array.from(navPanel.querySelectorAll('.mode-btn'));
  const btnSetStart = navPanel.querySelector('#nav-set-start');
  const btnSetDest = navPanel.querySelector('#nav-set-dest');
  const btnUseLoc = navPanel.querySelector('#nav-use-loc');
  const btnClear = navPanel.querySelector('#nav-clear');
  const infoDiv = navPanel.querySelector('#nav-route-info');

  // переключатель режимов
  modeButtons.forEach(b => {
    b.onclick = () => {
      modeButtons.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      travelMode = b.dataset.mode;
      // если маршрут есть — пересчитать
      if (startMarker && destMarker) computeAndShowRoute(startMarker.getLatLng(), destMarker.getLatLng());
    };
  });

  // Установить маркер (один клик)
  function setMarker(type) {
    alert(`Клик по карте: установится ${type === 'start' ? 'старт' : 'финиш'}`);
    map.once('click', e => {
      const ll = e.latlng;
      if (type === 'start') {
        if (startMarker) map.removeLayer(startMarker);
        startMarker = L.marker(ll, { title: 'Старт' }).addTo(map);
      } else {
        if (destMarker) map.removeLayer(destMarker);
        destMarker = L.marker(ll, { title: 'Финиш' }).addTo(map);
      }
      if (startMarker && destMarker) computeAndShowRoute(startMarker.getLatLng(), destMarker.getLatLng());
    });
  }
  btnSetStart.onclick = () => setMarker('start');
  btnSetDest.onclick = () => setMarker('dest');

  // Использовать текущее местоположение как старт
  btnUseLoc.onclick = () => {
    if (!navigator.geolocation) return alert('Геолокация не поддерживается');
    navigator.geolocation.getCurrentPosition(pos => {
      const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
      if (startMarker) map.removeLayer(startMarker);
      startMarker = L.marker(ll, { title: 'Старт' }).addTo(map);
      map.flyTo(ll, 14);
      if (startMarker && destMarker) computeAndShowRoute(startMarker.getLatLng(), destMarker.getLatLng());
    }, () => alert('Не удалось получить местоположение'));
  };

  btnClear.onclick = () => {
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
    if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
    infoDiv.textContent = '';
  };

  // Основная функция: computeAndShowRoute
  async function computeAndShowRoute(startLatLng, destLatLng) {
    infoDiv.textContent = '... расчёт маршрута';
    // clear previous
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }

    // ORS preferred
    if (typeof ORS_API_KEY === 'string' && ORS_API_KEY.trim().length > 8) {
      try {
        const profile = travelMode; // driving-car, foot-walking, driving-hgv
        const body = {
          coordinates: [[startLatLng.lng, startLatLng.lat], [destLatLng.lng, destLatLng.lat]],
          format: 'geojson',
          instructions: false
        };
        const resp = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': ORS_API_KEY
          },
          body: JSON.stringify(body)
        });
        if (!resp.ok) throw new Error('ORS error ' + resp.status);
        const j = await resp.json();
        const feat = j.features && j.features[0];
        if (!feat) throw new Error('ORS no route');
        const coords = feat.geometry.coordinates.map(c => [c[1], c[0]]);
        const summary = feat.properties && feat.properties.summary;
        routeLine = L.polyline(coords, { color: '#0078ff', weight: 5, opacity: 0.95 }).addTo(map);
        map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
        if (summary) {
          const distKm = (summary.distance / 1000).toFixed(1);
          const mins = Math.round(summary.duration / 60);
          infoDiv.textContent = `📏 ${distKm} км · ⏱ ${mins} мин`;
        } else {
          infoDiv.textContent = '';
        }
        return;
      } catch (e) {
        console.warn('ORS failed, fallback to OSRM', e);
        infoDiv.textContent = 'ORS недоступен — пробуем fallback';
      }
    }

    // Fallback: OSRM via L.Routing.osrmv1
    try {
      // create router with profile (LRM will append profile segment)
      const router = L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', profile: travelMode.includes('foot') ? 'foot' : 'car' });
      const ctrl = L.Routing.control({
        waypoints: [startLatLng, destLatLng],
        router,
        createMarker: () => null,
        addWaypoints: false,
        fitSelectedRoutes: true,
        show: false,
        lineOptions: { styles: [{ color: '#0078ff', weight: 5 }] }
      }).addTo(map);

      ctrl.on('routesfound', e => {
        const route = e.routes[0];
        const coords = route.coordinates.map(c => [c.lat, c.lng]);
        if (routeLine) map.removeLayer(routeLine);
        routeLine = L.polyline(coords, { color: '#0078ff', weight: 5, opacity: 0.95 }).addTo(map);
        map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
        if (route.summary) {
          const distKm = (route.summary.totalDistance || route.summary.distance || 0) / 1000;
          const mins = Math.round((route.summary.totalTime || route.summary.duration || 0) / 60);
          infoDiv.textContent = `📏 ${distKm.toFixed(1)} км · ⏱ ${mins} min`;
        } else {
          infoDiv.textContent = '';
        }
        // remove control UI
        setTimeout(() => { try { map.removeControl(ctrl); } catch (e) {} }, 50);
      });

      ctrl.on('routingerror', err => {
        console.warn('OSRM routing error', err);
        infoDiv.textContent = 'Не удалось построить маршрут';
        try { map.removeControl(ctrl); } catch (e) {}
      });

    } catch (e) {
      console.error('Routing fallback error', e);
      infoDiv.textContent = 'Не удалось построить маршрут';
    }
  }

  // expose API: return functions if caller needs them
  return {
    setStart: ll => {
      if (startMarker) map.removeLayer(startMarker);
      startMarker = L.marker(ll).addTo(map);
      if (startMarker && destMarker) computeAndShowRoute(startMarker.getLatLng(), destMarker.getLatLng());
    },
    setDest: ll => {
      if (destMarker) map.removeLayer(destMarker);
      destMarker = L.marker(ll).addTo(map);
      if (startMarker && destMarker) computeAndShowRoute(startMarker.getLatLng(), destMarker.getLatLng());
    },
    buildRoute: () => {
      if (startMarker && destMarker) computeAndShowRoute(startMarker.getLatLng(), destMarker.getLatLng());
      else alert('Задайте старт и финиш (ПКМ/кнопки панели)');
    },
    clear: () => btnClear.onclick()
  };
}

/* map.js — основная логика карты, маршрутизация, слой-меню, геокодирование, трекинг */

// Конфиг (ORS ключ читается из config.js)
const ORS_KEY = typeof ORS_API_KEY !== "undefined" ? ORS_API_KEY : "";

// --- Инициализация карты ---
import { initUI } from './ui.js';
import { BASE_LAYERS } from './map_layers.js';

const map = L.map('map', { zoomControl: true }).setView([55.14, 30.16], 12);
let currentBase = BASE_LAYERS["OSM"].addTo(map);

initUI({
  onModeChange: mode => { travelMode = mode; rebuildRouteIfNeeded(); },
  onBuildRoute: () => buildCurrentRoute(),
  onClearRoute: clearRoute,
  onLayerPanelToggle: toggleLayerPanel,
  onBaseMapChange: name => {
    if (currentBase) map.removeLayer(currentBase);
    currentBase = BASE_LAYERS[name].addTo(map);
  }
});


// контейнеры слоёв
const layerObjects = {}; // name -> layer (featureGroup)
const layerVisible = {}; // name -> bool

// Маршрут и точки
let startMarker = null;
let destMarker = null;
let currentRoute = null; // polyline layer for ORS fallback
let routeInfo = null; // {distance, time, geometry}
let travelMode = "driving"; // "driving" or "foot"

// UI элементы
const driveBtn = document.getElementById('driveBtn');
const walkBtn = document.getElementById('walkBtn');
const useLocationBtn = document.getElementById('use-location');
const geocodeStartBtn = document.getElementById('geocode-start');
const geocodeDestBtn = document.getElementById('geocode-dest');
const startInput = document.getElementById('start-input');
const destInput = document.getElementById('dest-input');
const buildRouteBtn = document.getElementById('build-route');
const clearRouteBtn = document.getElementById('clear-route');
const legendItems = document.getElementById('legend-items');
const panelToggle = document.getElementById('panel-toggle');

// Панель инфо маршрута внизу
const infoDiv = L.DomUtil.create('div', 'route-info');
infoDiv.style.display = 'none';
document.body.appendChild(infoDiv);

function showRouteInfo(distance_m, time_s) {
  infoDiv.innerHTML = `📏 ${(distance_m/1000).toFixed(1)} км &nbsp; ⏱️ ${Math.round(time_s/60)} мин`;
  infoDiv.style.display = '';
}
function hideRouteInfo() {
  infoDiv.style.display = 'none';
}

// --- Утилиты: geocoding (Nominatim) ---
async function geocodeAddress(text) {
  const q = encodeURIComponent(text);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&addressdetails=0`;
  const r = await fetch(url, { headers: { 'Accept-Language': 'ru' } });
  if (!r.ok) throw new Error('Geocode failed');
  const j = await r.json();
  if (!j || !j[0]) return null;
  return { lat: parseFloat(j[0].lat), lon: parseFloat(j[0].lon) };
}

// --- Загрузка слоёв из layers.json ---
async function loadLayers() {
  try {
    const r = await fetch('layers.json');
    const layers = await r.json();
    for (const meta of layers) {
      const name = meta.name || meta.file;
      const color = meta.color || '#0078ff';
      const url = 'kml_layers/' + meta.file;
      // используем featureGroup, чтобы собрать все элементы слоя
      const fg = L.featureGroup();
      const kml = omnivore.kml(url);
      kml.on('ready', function() {
        // копируем содержимое в fg и применяем стили
        kml.eachLayer(l => {
          if (l.setStyle) {
            l.setStyle({ color: color, weight: 3, opacity: 0.9 });
          }
          fg.addLayer(l);
        });
        // добавляем bounds при первой загрузке
        if (fg.getBounds && fg.getBounds().isValid()) {
          // don't auto-zoom here to avoid jumps
        }
      });
      kml.addTo(map);
      layerObjects[name] = fg;
      layerVisible[name] = true;
      addLegendItem(name, color, fg);
    }
  } catch (e) {
    console.error('Ошибка загрузки layers.json', e);
  }
}

// --- Legend item creation with actions ---
function addLegendItem(name, color, fg) {
  const item = document.createElement('div');
  item.className = 'legend-item';

  const left = document.createElement('div');
  left.className = 'legend-left';
  left.innerHTML = `<div class="legend-line" style="background:${color}"></div><div class="legend-title">${name}</div>`;
  left.onclick = () => {
    // fly to layer bounds
    const layer = layerObjects[name];
    if (layer && layer.getBounds && layer.getBounds().isValid()) {
      map.flyToBounds(layer.getBounds(), { maxZoom: 15 });
    }
  };

  const actions = document.createElement('div');
  actions.className = 'legend-actions';

  // Hide / Show button
  const hideBtn = document.createElement('button');
  hideBtn.className = 'layer-btn';
  hideBtn.innerText = 'Скрыть';
  hideBtn.onclick = () => {
    const visible = layerVisible[name];
    if (visible) {
      // remove underlying feature layers from map
      const layer = layerObjects[name];
      if (layer) map.removeLayer(layer);
      hideBtn.innerText = 'Показать';
      layerVisible[name] = false;
    } else {
      const layer = layerObjects[name];
      if (layer) layer.addTo(map);
      hideBtn.innerText = 'Скрыть';
      layerVisible[name] = true;
    }
  };

  // Route to first/last point
  const routeFirstBtn = document.createElement('button');
  routeFirstBtn.className = 'layer-btn';
  routeFirstBtn.innerText = 'К первой';
  routeFirstBtn.onclick = async () => {
    // find first/last coordinate in layer
    const layer = layerObjects[name];
    const coords = extractLayerPoints(layer);
    if (!coords || coords.length === 0) { alert('В слое нет точек.'); return; }
    const target = coords[0];
    await routeToLatLng(L.latLng(target[1], target[0]));
  };

  const routeLastBtn = document.createElement('button');
  routeLastBtn.className = 'layer-btn warn';
  routeLastBtn.innerText = 'К последней';
  routeLastBtn.onclick = async () => {
    const layer = layerObjects[name];
    const coords = extractLayerPoints(layer);
    if (!coords || coords.length === 0) { alert('В слое нет точек.'); return; }
    const target = coords[coords.length-1];
    await routeToLatLng(L.latLng(target[1], target[0]));
  };

  actions.appendChild(hideBtn);
  actions.appendChild(routeFirstBtn);
  actions.appendChild(routeLastBtn);

  item.appendChild(left);
  item.appendChild(actions);
  legendItems.appendChild(item);
}

// Helper: extract array of [lon,lat] from a featureGroup (first found geometry)
function extractLayerPoints(featureGroup) {
  if (!featureGroup) return null;
  const pts = [];
  featureGroup.eachLayer(l => {
    if (l.getLatLng) {
      const p = l.getLatLng();
      pts.push([p.lng, p.lat]);
    } else if (l.getLatLngs) {
      // Polygon/Polyline: flatten
      const ll = l.getLatLngs();
      const flat = flattenLatLngs(ll);
      for (const p of flat) pts.push([p.lng, p.lat]);
    }
  });
  return pts;
}
function flattenLatLngs(arr) {
  const out = [];
  if (!arr) return out;
  for (const a of arr) {
    if (Array.isArray(a)) {
      out.push(...flattenLatLngs(a));
    } else if (a && a.lat !== undefined) {
      out.push(a);
    }
  }
  return out;
}

// --- Маршрутизация ---
// High-level: if ORS_KEY present -> use ORS REST API, else fallback to OSRM via L.Routing

async function routeToLatLng(destLatLng) {
  // If no start set -> try get current position
  if (!startMarker) {
    try {
      const p = await getCurrentPositionPromise();
      setStartMarker(L.latLng(p.coords.latitude, p.coords.longitude));
    } catch (e) {
      alert('Сначала установите старт (ПКМ) или разрешите геолокацию.');
      return;
    }
  }
  setDestMarker(destLatLng);
  await computeAndShowRoute(startMarker.getLatLng(), destLatLng);
}

function setStartMarker(latlng) {
  if (startMarker) map.removeLayer(startMarker);
  startMarker = L.marker(latlng, { draggable: true }).addTo(map).bindPopup('Старт').openPopup();
  startMarker.on('dragend', () => {
    // если есть маршрут — пересчитать
    if (destMarker) computeAndShowRoute(startMarker.getLatLng(), destMarker.getLatLng());
  });
}

function setDestMarker(latlng) {
  if (destMarker) map.removeLayer(destMarker);
  destMarker = L.marker(latlng, { draggable: true }).addTo(map).bindPopup('Назначение').openPopup();
  destMarker.on('dragend', () => {
    if (startMarker) computeAndShowRoute(startMarker.getLatLng(), destMarker.getLatLng());
  });
}

async function computeAndShowRoute(startLatLng, destLatLng) {
  // clear previous
  if (currentRoute) { map.removeLayer(currentRoute); currentRoute = null; }
  hideRouteInfo();

  // If ORS present - use it
  if (ORS_KEY && ORS_KEY.length > 8) {
    try {
      const mode = travelMode === 'foot' ? 'foot-walking' : 'driving-car';
      const body = {
        coordinates: [[startLatLng.lng, startLatLng.lat],[destLatLng.lng,destLatLng.lat]],
        format: 'geojson',
        instructions: false
      };
      const resp = await fetch(`https://api.openrouteservice.org/v2/directions/${mode}/geojson`, {
        method: 'POST',
        headers: {
          'Content-Type':'application/json',
          'Authorization': ORS_KEY
        },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error('ORS failed');
      const j = await resp.json();
      // geometry & summary
      const geom = j.features[0].geometry;
      const props = j.features[0].properties.summary;
      const coords = geom.coordinates.map(c=>[c[1],c[0]]); // lat,lng
      currentRoute = L.polyline(coords, { color: travelMode === 'foot' ? '#00b300' : '#0078ff', weight: 5, opacity:0.9 }).addTo(map);
      map.fitBounds(currentRoute.getBounds(), { padding:[40,40] });
      routeInfo = { distance: props.distance, time: props.duration };
      showRouteInfo(routeInfo.distance, routeInfo.time);
      // start tracking remaining distance
      startTrackingRoute(coords);
      return;
    } catch (e) {
      console.warn('ORS error, fallback to OSRM', e);
      // fallthrough to OSRM
    }
  }

  // Fallback via OSRM (public) using L.Routing.osrmv1
  // We'll use L.Routing.control but hide its UI and get summary from routesfound event.
  return new Promise((resolve, reject) => {
    const router = L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', profile: travelMode, timeout:10000 });
    const ctrl = L.Routing.control({
      waypoints: [startLatLng, destLatLng],
      router,
      createMarker: () => null,
      addWaypoints: false,
      fitSelectedRoutes: true,
      show: false,
      lineOptions: { styles:[{ color: travelMode === 'foot' ? '#00b300' : '#0078ff', weight:5 }] }
    }).addTo(map);

    ctrl.on('routesfound', e => {
      const route = e.routes[0];
      // draw polyline manually from route.coordinates (array of LatLng)
      const coords = route.coordinates.map(c => [c.lat, c.lng]);
      if (currentRoute) map.removeLayer(currentRoute);
      currentRoute = L.polyline(coords, { color: travelMode === 'foot' ? '#00b300' : '#0078ff', weight: 5, opacity:0.9 }).addTo(map);
      map.fitBounds(currentRoute.getBounds(), { padding:[40,40] });
      routeInfo = { distance: route.summary.totalDistance || route.summary.total_distance || 0, time: route.summary.totalTime || route.summary.total_time || route.summary.duration || 0 };
      showRouteInfo(routeInfo.distance, routeInfo.time);
      // remove the control (UI) but keep polyline
      setTimeout(()=>{ try{ map.removeControl(ctrl);}catch(e){} }, 10);
      startTrackingRoute(coords);
      resolve();
    });

    ctrl.on('routingerror', err => {
      try{ map.removeControl(ctrl);}catch(e){}
      console.warn('OSRM routing error', err);
      reject(err);
    });
  });
}

// Track user location and show remaining distance/time (approx)
let watchId = null;
let lastKnownPos = null;
function startTrackingRoute(routeCoordsLatLng) {
  // routeCoordsLatLng = array of [lat,lng] along the polyline
  // stop previous watcher
  if (watchId) navigator.geolocation.clearWatch(watchId);
  lastKnownPos = null;

  // create polyline and ingest as Leaflet polyline to use nearestPoint ops
  const routeLine = L.polyline(routeCoordsLatLng);
  // watch position
  if (!navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(pos => {
    const cur = L.latLng(pos.coords.latitude, pos.coords.longitude);
    lastKnownPos = cur;
    // find nearest point on line: naive approach - compute distances to each segment
    const nearest = nearestPointOnLine(routeLine, cur);
    // remaining distance: sum from nearest index to end using haversine
    const remaining = computeRemainingDistance(nearest.index, nearest.point, routeCoordsLatLng);
    // estimate remaining time using avg speed from routeInfo
    let remTime = 0;
    if (routeInfo && routeInfo.distance > 0 && routeInfo.time > 0) {
      const avgSpeed = routeInfo.distance / routeInfo.time; // meters per second
      remTime = remaining / (avgSpeed || 1);
    }
    showRouteInfo(remaining, remTime);
  }, err => {
    console.warn('watch error', err);
  }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 });
}

function stopTracking() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

// helper to compute nearest point on polyline and index
function nearestPointOnLine(polyline, point) {
  const latlngs = polyline.getLatLngs();
  let minDist = Infinity;
  let best = { index: 0, point: latlngs[0] };
  for (let i=0;i<latlngs.length-1;i++){
    const a = latlngs[i], b = latlngs[i+1];
    const p = nearestPointOnSegment(a, b, point);
    const d = p.distanceTo(point);
    if (d < minDist) { minDist = d; best = { index: i, point: p }; }
  }
  return best;
}
function nearestPointOnSegment(a,b,p) {
  // project p onto ab segment
  const A = toVec(a), B = toVec(b), P = toVec(p);
  const AB = [B[0]-A[0], B[1]-A[1]];
  const AP = [P[0]-A[0], P[1]-A[1]];
  const ab2 = AB[0]*AB[0]+AB[1]*AB[1];
  const t = Math.max(0, Math.min(1, (AP[0]*AB[0]+AP[1]*AB[1]) / ab2));
  const proj = [A[0]+AB[0]*t, A[1]+AB[1]*t];
  return L.latLng(proj[0], proj[1]);
}
function toVec(ll) { return [ll.lat, ll.lng]; }
function computeRemainingDistance(index, nearestPoint, coords) {
  // coords: array of [lat,lng]
  let d = 0;
  // from nearestpoint to coords[index+1]
  const p = [nearestPoint.lat, nearestPoint.lng];
  if (index < coords.length-1) {
    d += haversineMeters(p[0], p[1], coords[index+1][0], coords[index+1][1]);
    for (let i = index+1; i < coords.length-1; i++) {
      d += haversineMeters(coords[i][0], coords[i][1], coords[i+1][0], coords[i+1][1]);
    }
  }
  return d;
}
function haversineMeters(lat1, lon1, lat2, lon2){
  function toRad(x){return x*Math.PI/180;}
  const R=6371000;
  const dLat=toRad(lat2-lat1);
  const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return R*c;
}

// --- UI interactions ---

// panel toggle
panelToggle.onclick = () => {
  document.getElementById('left-panel').classList.toggle('collapsed');
};

// mode buttons
function setMode(mode){
  travelMode = mode;
  driveBtn.classList.toggle('active', mode === 'driving');
  walkBtn.classList.toggle('active', mode === 'foot');
  // if route exists, rebuild
  if (startMarker && destMarker) computeAndShowRoute(startMarker.getLatLng(), destMarker.getLatLng());
}
driveBtn.onclick = ()=> setMode('driving');
walkBtn.onclick = ()=> setMode('foot');

// use current location as start
useLocationBtn.onclick = async () => {
  try {
    const p = await getCurrentPositionPromise();
    setStartMarker(L.latLng(p.coords.latitude, p.coords.longitude));
    map.panTo(startMarker.getLatLng());
  } catch (e) {
    alert('Не удалось получить местоположение: разрешите геолокацию');
  }
};

// address -> geocode
geocodeStartBtn.onclick = async () => {
  const v = startInput.value.trim();
  if (!v) return alert('Введите адрес старта');
  const res = await geocodeAddress(v);
  if (!res) return alert('Адрес не найден');
  setStartMarker(L.latLng(res.lat,res.lon));
  map.panTo(startMarker.getLatLng());
};

geocodeDestBtn.onclick = async () => {
  const v = destInput.value.trim();
  if (!v) return alert('Введите адрес назначения');
  const res = await geocodeAddress(v);
  if (!res) return alert('Адрес не найден');
  setDestMarker(L.latLng(res.lat,res.lon));
  map.panTo(destMarker.getLatLng());
};

// build route button (use inputs/markers)
buildRouteBtn.onclick = async () => {
  // if inputs present, prefer them
  if (startInput.value && !startMarker) {
    const res = await geocodeAddress(startInput.value.trim());
    if (res) setStartMarker(L.latLng(res.lat,res.lon));
  }
  if (destInput.value && !destMarker) {
    const res = await geocodeAddress(destInput.value.trim());
    if (res) setDestMarker(L.latLng(res.lat,res.lon));
  }
  if (!startMarker || !destMarker) {
    alert('Укажите старт и финиш: ПКМ — старт, ЛКМ — финиш, либо используйте адреса/текущее местоположение.');
    return;
  }
  await computeAndShowRoute(startMarker.getLatLng(), destMarker.getLatLng());
};

// clear
clearRouteBtn.onclick = ()=> {
  if (currentRoute) { map.removeLayer(currentRoute); currentRoute = null; }
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
  hideRouteInfo();
  stopTracking();
};

// map clicks: right-click -> start; left-click -> dest
map.on('contextmenu', e => {
  setStartMarker(e.latlng);
});
map.on('click', e => {
  setDestMarker(e.latlng);
});

// helper to get current position as promise
function getCurrentPositionPromise() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('no geo'));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy:true, timeout:10000 });
  });
}

// initialize
loadLayers();

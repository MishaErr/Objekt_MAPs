const map = L.map('map').setView([55.15, 30.22], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let routeControl = null;
let destinationMarker = null;
let startMarker = null;
let selectedLayer = null;
let travelMode = "driving"; // driving | foot

const layerObjects = {};

// === Загрузка KML ===
fetch('layers.json')
  .then(r => r.json())
  .then(layers => {
    const boundsGroup = L.featureGroup();

    layers.forEach(layer => {
      const url = 'kml_layers/' + layer.file;
      const color = layer.color || '#000';
      const name = layer.name || layer.file;

      const kmlLayer = omnivore.kml(url);
      kmlLayer.on('ready', function() {
        kmlLayer.eachLayer(l => {
          if (l.setStyle) {
            l.setStyle({ color, weight: 3, opacity: 0.85 });
          }
        });
        layerObjects[name] = kmlLayer;
        boundsGroup.addLayer(kmlLayer);
        if (boundsGroup.getBounds().isValid()) map.fitBounds(boundsGroup.getBounds());
      });
      kmlLayer.addTo(map);

      // элемент легенды
      const legend = document.getElementById('legend-items');
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `<div class="legend-line" style="background:${color}"></div><div>${name}</div>`;
      item.onclick = () => {
        selectedLayer = name;
        const l = layerObjects[name];
        if (l && l.getBounds().isValid()) map.flyToBounds(l.getBounds(), { maxZoom: 14 });
      };
      legend.appendChild(item);
    });
  });

// === Панель информации о маршруте ===
const infoPanel = L.control({ position: 'bottomleft' });
infoPanel.onAdd = function() {
  this._div = L.DomUtil.create('div', 'route-info');
  this.update();
  return this._div;
};
infoPanel.update = function(info) {
  if (!info) {
    this._div.innerHTML = '';
  } else {
    this._div.innerHTML = `📏 ${(info.distance / 1000).toFixed(1)} км<br>⏱️ ${(info.time / 60).toFixed(0)} мин`;
  }
};
infoPanel.addTo(map);

// === Глобальные переменные для маршрута ===
let startMarker = null;
let destinationMarker = null;
let routeControl = null;
let travelMode = "driving"; // режим по умолчанию

// === Очистка маршрута ===
function clearRoute() {
  if (routeControl) {
    map.removeControl(routeControl);
    routeControl = null;
  }
  if (destinationMarker) {
    map.removeLayer(destinationMarker);
    destinationMarker = null;
  }
  if (startMarker) {
    map.removeLayer(startMarker);
    startMarker = null;
  }
  infoPanel.update();
}

// === Построение маршрута ===
function buildRoute(start, dest) {
  clearRoute();
  infoPanel.update();

  const servers = [
    "https://router.project-osrm.org/route/v1",
    "https://routing.openstreetmap.de/routed"
  ];

  function createRouter(serverIndex = 0) {
    return L.Routing.osrmv1({
      serviceUrl: servers[serverIndex],
      profile: travelMode,
      timeout: 10000
    });
  }

  function tryRoute(i = 0) {
    if (i >= servers.length) {
      alert("Не удалось построить маршрут. Попробуйте позже.");
      return;
    }

    routeControl = L.Routing.control({
      waypoints: [start, dest],
      lineOptions: {
        styles: [{ color: travelMode === "foot" ? "#00b300" : "#0078ff", weight: 5 }]
      },
      router: createRouter(i),
      createMarker: () => null,
      addWaypoints: false,
      fitSelectedRoutes: true,
      show: false
    })
      .on("routesfound", e => {
        const route = e.routes[0];
        infoPanel.update({ distance: route.summary.totalDistance, time: route.summary.totalTime });
      })
      .on("routingerror", () => {
        console.warn("Ошибка маршрута, пробуем другой сервер...");
        map.removeControl(routeControl);
        tryRoute(i + 1);
      })
      .addTo(map);
  }

  tryRoute();
}

// === Обработка кликов по карте ===
map.on("contextmenu", e => { // правая кнопка — старт
  if (startMarker) map.removeLayer(startMarker);
  startMarker = L.marker(e.latlng, { draggable: true }).addTo(map).bindPopup("Старт").openPopup();
});

map.on("click", e => { // левая кнопка — пункт назначения
  if (!startMarker) {
    alert("Сначала установите стартовую точку (правая кнопка мыши)");
    return;
  }
  if (destinationMarker) map.removeLayer(destinationMarker);
  destinationMarker = L.marker(e.latlng, { draggable: true }).addTo(map).bindPopup("Назначение").openPopup();
  buildRoute(startMarker.getLatLng(), destinationMarker.getLatLng());
});

// === Кнопки выбора режима ===
document.getElementById('driveBtn').onclick = () => {
  travelMode = "driving";
  document.getElementById('driveBtn').classList.add('active');
  document.getElementById('walkBtn').classList.remove('active');
  if (startMarker && destinationMarker) buildRoute(startMarker.getLatLng(), destinationMarker.getLatLng());
};

document.getElementById('walkBtn').onclick = () => {
  travelMode = "foot";
  document.getElementById('walkBtn').classList.add('active');
  document.getElementById('driveBtn').classList.remove('active');
  if (startMarker && destinationMarker) buildRoute(startMarker.getLatLng(), destinationMarker.getLatLng());
};

// === Кнопка очистки ===
document.getElementById('clearBtn').onclick = clearRoute;


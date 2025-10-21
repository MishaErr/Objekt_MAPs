const map = L.map('map').setView([55.15, 30.15], 11);

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

// === Маршрутизация ===
function clearRoute() {
  if (routeControl) {
    map.removeControl(routeControl);
    routeControl = null;
  }
  if (destinationMarker) {
    map.removeLayer(destinationMarker);
    destinationMarker = null;
  }
}

document.getElementById('clearRoute').onclick = clearRoute;

// Выбор режима
document.getElementById('driveBtn').onclick = () => {
  travelMode = "driving";
  document.getElementById('driveBtn').classList.add('active');
  document.getElementById('walkBtn').classList.remove('active');
};
document.getElementById('walkBtn').onclick = () => {
  travelMode = "foot";
  document.getElementById('walkBtn').classList.add('active');
  document.getElementById('driveBtn').classList.remove('active');
};

// ПКМ — выбрать стартовую точку
map.on('contextmenu', e => {
  if (startMarker) map.removeLayer(startMarker);
  startMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
  alert("Стартовая точка установлена. Теперь выберите точку назначения кликом на карте.");
});

// ЛКМ — выбрать пункт назначения и построить маршрут
map.on('click', e => {
  if (!startMarker) {
    alert("Сначала укажите стартовую точку (ПКМ на карте)");
    return;
  }

  const dest = e.latlng;
  if (destinationMarker) map.removeLayer(destinationMarker);
  destinationMarker = L.marker(dest).addTo(map);

  buildRoute(startMarker.getLatLng(), dest);
});

function buildRoute(start, dest) {
  clearRoute();

  const servers = [
    "https://router.project-osrm.org/route/v1",
    "https://routing.openstreetmap.de/routed"
  ];

  function createRouter(serverIndex = 0) {
    const base = servers[serverIndex];
    // ⚙️ не добавляем профиль сюда, LRM сам вставит "/{profile}/"
    const serviceUrl = base.includes("routed")
      ? `${base}` // -> https://routing.openstreetmap.de/routed
      : `${base}`; // -> https://router.project-osrm.org/route/v1

    return L.Routing.osrmv1({
      serviceUrl: serviceUrl,
      profile: travelMode, // LRM сам добавит /driving/ или /foot/
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
        styles: [
          { color: travelMode === "foot" ? "#00b300" : "#0078ff", weight: 5 }
        ]
      },
      router: createRouter(i),
      createMarker: () => null,
      addWaypoints: false,
      fitSelectedRoutes: true,
      show: false
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

// 🧭 Построить маршрут к выбранному объекту
document.getElementById('buildToLegend').onclick = () => {
  if (!selectedLayer) {
    alert("Сначала выберите объект в легенде.");
    return;
  }
  if (!startMarker) {
    alert("Сначала укажите стартовую точку (ПКМ на карте).");
    return;
  }
  const l = layerObjects[selectedLayer];
  if (l && l.getBounds().isValid()) {
    const dest = l.getBounds().getCenter();
    buildRoute(startMarker.getLatLng(), dest);
  }
};

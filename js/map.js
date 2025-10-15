// === Инициализация карты ===
const map = L.map('map').setView([55.75, 37.62], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// === Создание контрола легенды ===
const LegendControl = L.Control.extend({
  options: { position: 'bottomleft' },
  onAdd: function() {
    const container = L.DomUtil.create('div', 'leaflet-control legend');
    container.innerHTML = `
      <span class="legend-title">Легенда</span>
      <div id="legend-items"></div>
      <hr>
      <div style="margin-top:6px;">
        <label><input type="radio" name="travel" value="driving" checked> 🚗 Авто</label><br>
        <label><input type="radio" name="travel" value="foot"> 🚶 Пешком</label>
      </div>
      <small style="color:#555;">Кликни на карте для маршрута</small>
    `;
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    return container;
  }
});
const legendControl = new LegendControl();
map.addControl(legendControl);

// === Загрузка KML ===
const layerObjects = {};
fetch('layers.json')
  .then(r => r.json())
  .then(layers => {
    const boundsGroup = L.featureGroup();

    layers.forEach(layer => {
      const url = 'kml_layers/' + layer.file;
      const color = layer.color || '#000000';
      const name = layer.name || layer.file;

      const kmlLayer = omnivore.kml(url);

      kmlLayer.on('ready', function() {
        try {
          kmlLayer.eachLayer(l => {
            if (l.setStyle) {
              l.setStyle({ color: color, weight: 3, opacity: 0.85 });
            }
          });
        } catch(e) { console.warn(e); }

        layerObjects[name] = kmlLayer;
        boundsGroup.addLayer(kmlLayer);
        if (boundsGroup.getBounds().isValid()) {
          map.fitBounds(boundsGroup.getBounds());
        }
      });

      kmlLayer.addTo(map);

      // Добавляем элемент легенды
      const legend = document.getElementById('legend-items');
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <div class="legend-line" style="background:${color}"></div>
        <div>${name}</div>
      `;
      legend.appendChild(item);

      item.addEventListener('click', () => {
        const layerObj = layerObjects[name];
        if (layerObj && layerObj.getBounds && layerObj.getBounds().isValid()) {
          map.flyToBounds(layerObj.getBounds(), { maxZoom: 14 });
        }
      });
    });
  })
  .catch(err => console.error('Ошибка при загрузке layers.json:', err));

// === Маршрутизация ===
let routeControl = null;
let destinationMarker = null;

// Получаем выбранный тип маршрута
function getTravelMode() {
  const selected = document.querySelector('input[name="travel"]:checked');
  return selected ? selected.value : "driving";
}

// Обработчик клика по карте
map.on('click', e => {
  const dest = e.latlng;

  if (destinationMarker) map.removeLayer(destinationMarker);
  destinationMarker = L.marker(dest).addTo(map);

  // Удаляем старый маршрут
  if (routeControl) {
    map.removeControl(routeControl);
    routeControl = null;
  }

  // Получаем текущее местоположение пользователя
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const start = L.latLng(pos.coords.latitude, pos.coords.longitude);
      const profile = getTravelMode(); // "driving" или "foot"
      
      // 👇 Исправлено: правильное использование профиля в URL OSRM
      routeControl = L.Routing.control({
        waypoints: [start, dest],
        lineOptions: {
          styles: [{ color: profile === "foot" ? "#00b300" : "#0078ff", weight: 5 }]
        },
        router: L.Routing.osrmv1({
          serviceUrl: `https://router.project-osrm.org/route/v1/${profile}`
        }),
        createMarker: function() { return null; },
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        show: false
      }).addTo(map);
    }, () => {
      alert("Не удалось определить ваше местоположение");
    });
  } else {
    alert("Ваш браузер не поддерживает геолокацию");
  }
});

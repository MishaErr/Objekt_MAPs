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
    container.innerHTML = '<span class="legend-title">Легенда</span><div id="legend-items"></div>';
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    return container;
  }
});
const legendControl = new LegendControl();
map.addControl(legendControl);

// === Логика загрузки KML ===
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
          // Применяем цвет к геометрии
          kmlLayer.eachLayer(l => {
            if (l.setStyle) {
              l.setStyle({
                color: color,
                weight: 3,
                opacity: 0.85
              });
            }
          });
        } catch(e) { console.warn(e); }

        // Добавляем слой в коллекцию
        layerObjects[name] = kmlLayer;

        boundsGroup.addLayer(kmlLayer);
        if (boundsGroup.getBounds().isValid()) {
          map.fitBounds(boundsGroup.getBounds());
        }
      });

      kmlLayer.addTo(map);

      // Добавляем пункт легенды
      const legend = document.getElementById('legend-items');
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <div class="legend-line" style="background:${color}"></div>
        <div>${name}</div>
      `;
      legend.appendChild(item);

      // === 📍 При клике центрируем карту на слой ===
      item.addEventListener('click', () => {
        const layerObj = layerObjects[name];
        if (layerObj && layerObj.getBounds && layerObj.getBounds().isValid()) {
          map.flyToBounds(layerObj.getBounds(), { maxZoom: 14 });
        }
      });
    });
  })
  .catch(err => console.error('Ошибка при загрузке layers.json:', err));

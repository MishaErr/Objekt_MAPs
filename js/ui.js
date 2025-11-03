// js/ui.js
import { BASE_LAYERS } from './map_layers.js';

/**
 * Инициализация UI: плавающие кнопки и панели
 * onBaseMapChange(name) - переключить базовую карту
 */
export function initUI({ onBaseMapChange }) {
  // ensure fab container exists
  let fabContainer = document.getElementById('fab-container');
  if (!fabContainer) {
    fabContainer = document.createElement('div');
    fabContainer.id = 'fab-container';
    fabContainer.style.position = 'absolute';
    fabContainer.style.bottom = '18px';
    fabContainer.style.right = '12px';
    fabContainer.style.display = 'flex';
    fabContainer.style.flexDirection = 'column';
    fabContainer.style.gap = '10px';
    fabContainer.style.zIndex = '10030';
    document.body.appendChild(fabContainer);
  }

  // route FAB (bottom-left placed separately in CSS by id)
  let routeFab = document.getElementById('route-fab');
  if (!routeFab) {
    routeFab = document.createElement('button');
    routeFab.id = 'route-fab';
    routeFab.className = 'fab';
    routeFab.title = 'Маршрут';
    routeFab.innerHTML = '🧭';
    // style left bottom via CSS (#route-fab)
    document.body.appendChild(routeFab);
  }

  // base maps FAB (right-bottom)
  let baseFab = document.getElementById('fab-base');
  if (!baseFab) {
    baseFab = document.createElement('button');
    baseFab.id = 'fab-base';
    baseFab.className = 'fab';
    baseFab.title = 'Базовые карты';
    baseFab.innerHTML = '🗺️';
    fabContainer.appendChild(baseFab);
  }

  // layers panel container (right top)
  let layersPanel = document.getElementById('layers-panel');
  if (!layersPanel) {
    layersPanel = document.createElement('div');
    layersPanel.id = 'layers-panel';
    layersPanel.className = 'fab-panel';
    layersPanel.style.position = 'absolute';
    layersPanel.style.top = '12px';
    layersPanel.style.right = '12px';
    layersPanel.style.width = '280px';
    layersPanel.style.maxHeight = '70vh';
    layersPanel.style.overflow = 'auto';
    layersPanel.style.zIndex = '10025';
    layersPanel.style.display = 'none';
    layersPanel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <strong>Слои</strong>
      <button id="layers-close" style="border:none;background:transparent;cursor:pointer">✕</button>
    </div><div id="layers-list" style="display:flex;flex-direction:column;gap:6px"></div>`;
    document.body.appendChild(layersPanel);
    document.getElementById('layers-close').onclick = () => layersPanel.style.display = 'none';
  }

  // base panel (appears left of baseFab)
  let basePanel = document.getElementById('base-panel');
  if (!basePanel) {
    basePanel = document.createElement('div');
    basePanel.id = 'base-panel';
    basePanel.className = 'basemap-panel';
    basePanel.style.position = 'absolute';
    basePanel.style.bottom = '74px';
    basePanel.style.right = '12px';
    basePanel.style.width = '220px';
    basePanel.style.display = 'none';
    basePanel.style.zIndex = '10025';
    document.body.appendChild(basePanel);
  }

  // fill basePanel with options
  basePanel.innerHTML = '<strong style="display:block;margin-bottom:6px">Базовые карты</strong>';
  Object.keys(BASE_LAYERS).forEach(name => {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.style.width = '100%';
    btn.style.marginBottom = '6px';
    btn.onclick = () => {
      if (typeof onBaseMapChange === 'function') onBaseMapChange(name);
      basePanel.style.display = 'none';
    };
    basePanel.appendChild(btn);
  });

  // handlers
  baseFab.onclick = () => { basePanel.style.display = basePanel.style.display === 'none' ? 'block' : 'none'; layersPanel.style.display = 'none'; };
  const routeFabButton = routeFab; // exists
  // routeFab click handled by navigation.init (navigation listens for #route-fab)

  const layersBtn = document.getElementById('layers-btn');
  // If there is an external layers button, link it. If not - we rely on layersPanel created here.
  // create a small toggle for layers if not exist
  let layersToggle = document.getElementById('layers-toggle');
  if (!layersToggle) {
    layersToggle = document.createElement('button');
    layersToggle.id = 'layers-toggle';
    layersToggle.className = 'fab';
    layersToggle.title = 'Слои';
    layersToggle.innerHTML = '📋';
    layersToggle.style.position = 'absolute';
    layersToggle.style.top = '12px';
    layersToggle.style.right = '70px';
    layersToggle.style.zIndex = '10030';
    document.body.appendChild(layersToggle);
  }
  layersToggle.onclick = () => {
    layersPanel.style.display = layersPanel.style.display === 'none' ? 'block' : 'none';
    basePanel.style.display = 'none';
  };

  // Return panels/controls for map.js usage
  return {
    routeFab: routeFab,
    baseFab: baseFab,
    layersPanel,
    basePanel,
    layersListEl: document.getElementById('layers-list')
  };
}

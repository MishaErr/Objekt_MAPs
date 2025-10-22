// ui.js — отвечает за всплывающие панели и выбор режима
import { BASE_LAYERS } from './map_layers.js';

export function initUI({ onModeChange, onBuildRoute, onClearRoute, onLayerPanelToggle, onBaseMapChange }) {
  const navBtn = document.getElementById('nav-btn');
  const layersBtn = document.getElementById('layers-btn');
  const baseBtn = document.getElementById('basemap-btn');
  
  // создаём мини-панели
  const navPanel = createNavPanel();
  const layersPanel = document.getElementById('right-panel');
  const basePanel = createBaseMapPanel(onBaseMapChange);

  document.body.appendChild(navPanel);
  document.body.appendChild(basePanel);

  // кнопки открытия
  navBtn.onclick = () => togglePanel(navPanel);
  layersBtn.onclick = () => togglePanel(layersPanel);
  baseBtn.onclick = () => togglePanel(basePanel);

  function togglePanel(panel) {
    [navPanel, layersPanel, basePanel].forEach(p => {
      if (p !== panel) p.classList.remove('visible');
    });
    panel.classList.toggle('visible');
  }

  // транспортный режим
  function createNavPanel() {
    const p = document.createElement('div');
    p.className = 'fab-panel';
    p.innerHTML = `
      <div class="mode-select">
        <button data-mode="foot" title="Пешком">🚶</button>
        <button data-mode="driving" title="Легковой">🚗</button>
        <button data-mode="truck" title="Грузовой">🚚</button>
      </div>
      <button id="nav-build" class="big-btn">🧭 Проложить</button>
      <button id="nav-clear" class="big-btn secondary">❌ Очистить</button>
    `;
    const btns = p.querySelectorAll('.mode-select button');
    btns.forEach(b => {
      b.onclick = () => {
        btns.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        onModeChange(b.dataset.mode);
      };
    });
    p.querySelector('#nav-build').onclick = onBuildRoute;
    p.querySelector('#nav-clear').onclick = onClearRoute;
    return p;
  }

  function createBaseMapPanel(onSelect) {
    const p = document.createElement('div');
    p.className = 'fab-panel';
    p.innerHTML = `<div class="basemap-list"></div>`;
    const list = p.querySelector('.basemap-list');
    Object.keys(BASE_LAYERS).forEach(name => {
      const btn = document.createElement('button');
      btn.innerText = name;
      btn.onclick = () => {
        onSelect(name);
        p.classList.remove('visible');
      };
      list.appendChild(btn);
    });
    return p;
  }
}


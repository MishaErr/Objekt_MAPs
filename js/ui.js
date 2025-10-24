// js/ui.js
import { BASE_LAYERS } from './map_layers.js';

/**
 * initUI - инициализирует плавающие кнопки и панели (layers, basemaps).
 * onBaseMapChange(name) - колбек при выборе базовой карты
 */
export function initUI({ onBaseMapChange }) {
  // Убедимся, что кнопки присутствуют (index.html должен содержать fab-кнопки с этими id).
  // Если их нет — создадим простые кнопки в DOM.
  function ensureButton(id, text, parent = document.body) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('button');
      el.id = id;
      el.className = 'fab';
      el.textContent = text;
      const container = document.createElement('div');
      container.id = 'fab-container';
      container.style.position = 'absolute';
      container.style.bottom = '80px';
      container.style.right = '12px';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '10px';
      container.style.zIndex = '10010';
      container.appendChild(el);
      parent.appendChild(container);
    }
    return el;
  }

  const navBtn = ensureButton('nav-btn', '🧭');
  const layersBtn = ensureButton('layers-btn', '🗺️');
  const baseBtn = ensureButton('basemap-btn', '🧰');

  // Панель слоёв: если нет в DOM — создаём
  let layersPanel = document.getElementById('layers-panel');
  if (!layersPanel) {
    layersPanel = document.createElement('div');
    layersPanel.id = 'layers-panel';
    layersPanel.className = 'fab-panel';
    layersPanel.style.top = '70px';
    layersPanel.style.right = '12px';
    layersPanel.style.width = '260px';
    layersPanel.style.maxHeight = '70vh';
    layersPanel.style.overflow = 'auto';
    layersPanel.style.zIndex = '10009';
    layersPanel.innerHTML = `<h3 style="margin:6px 0 8px 0">Слои</h3><div id="layers-list" style="display:flex;flex-direction:column;gap:6px"></div>`;
    document.body.appendChild(layersPanel);
  }

  // Панель базовых карт
  let basePanel = document.querySelector('.basemap-panel');
  if (!basePanel) {
    basePanel = document.createElement('div');
    basePanel.className = 'basemap-panel';
    basePanel.style.display = 'none';
    basePanel.style.position = 'absolute';
    basePanel.style.bottom = '150px';
    basePanel.style.right = '70px';
    basePanel.style.width = '220px';
    basePanel.style.zIndex = '10009';
    basePanel.style.padding = '8px';
    basePanel.style.borderRadius = '10px';
    basePanel.style.background = 'rgba(255,255,255,0.95)';
    document.body.appendChild(basePanel);
  }

  // Наполняем базовую панель кнопками
  basePanel.innerHTML = '<strong style="display:block;margin-bottom:6px">Базовые карты</strong>';
  Object.keys(BASE_LAYERS).forEach(name => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'basemap-button';
    btn.textContent = name;
    btn.style.width = '100%';
    btn.style.marginBottom = '6px';
    btn.onclick = () => {
      if (typeof onBaseMapChange === 'function') onBaseMapChange(name);
      basePanel.classList.remove('visible');
    };
    basePanel.appendChild(btn);
  });

  // Toggle логика: закрыть все панели, открыть целевую
  function togglePanel(panelEl) {
    const opened = panelEl.classList && panelEl.classList.contains('visible');
    document.querySelectorAll('.fab-panel, .basemap-panel').forEach(p => p.classList.remove('visible'));
    if (!opened) panelEl.classList.add('visible');
  }

  navBtn.onclick = () => {
    // Для навигации — панель создаёт navigation.js (он будет добавлять .fab-panel)
    // Здесь просто закрываем прочие и оставляем nav panel место для nav
    const navPanel = document.querySelector('.nav-fab-panel');
    if (navPanel) togglePanel(navPanel);
  };

  layersBtn.onclick = () => togglePanel(layersPanel);
  baseBtn.onclick = () => togglePanel(basePanel);

  return { basePanel, layersPanel };
}

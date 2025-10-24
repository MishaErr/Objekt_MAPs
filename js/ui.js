import { BASE_LAYERS } from './map_layers.js';
export function initUI({ onBaseMapChange }) {
  const layersBtn = document.getElementById('layers-btn');
  const baseBtn = document.getElementById('basemap-btn');
  const layersPanel = document.getElementById('layers-panel');
  const basePanel = document.createElement('div');
  basePanel.className = 'basemap-panel';
  document.body.appendChild(basePanel);
  layersBtn.onclick = () => togglePanel(layersPanel);
  baseBtn.onclick = () => togglePanel(basePanel);
  Object.keys(BASE_LAYERS).forEach(name => {
    const btn = document.createElement('button');
    btn.innerText = name;
    btn.onclick = () => { onBaseMapChange(name); basePanel.classList.remove('visible'); };
    basePanel.appendChild(btn);
  });
  function togglePanel(panel) {
    const visible = panel.classList.contains('visible');
    document.querySelectorAll('.fab-panel, .basemap-panel').forEach(p => p.classList.remove('visible'));
    if (!visible) panel.classList.add('visible');
  }
  return { basePanel, layersPanel };
}
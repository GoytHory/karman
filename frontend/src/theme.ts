export type ThemeId = 'graphite' | 'phosphor' | 'olive' | 'glass' | 'amber';

export type Theme = {
  id: ThemeId;
  name: string;
  note: string;
  preview: { bg: string; panel: string; text: string; dim: string; accent: string };
};

export const THEMES: Theme[] = [
  {
    id: 'graphite',
    name: 'Графит',
    note: 'Строгий чёрный, лаймовый акцент',
    preview: { bg: '#09090a', panel: '#16161a', text: '#ececef', dim: '#63636c', accent: '#c9f24d' },
  },
  {
    id: 'phosphor',
    name: 'Фосфор',
    note: 'Терминал: моноширинный, зелёный',
    preview: { bg: '#040604', panel: '#101610', text: '#d9f6d0', dim: '#62805b', accent: '#7dff6a' },
  },
  {
    id: 'olive',
    name: 'Олива',
    note: 'Тихий зелёный, мягкие углы',
    preview: { bg: '#1b201a', panel: '#2b332a', text: '#e9efe2', dim: '#8b9680', accent: '#c6d9a9' },
  },
  {
    id: 'glass',
    name: 'Стекло',
    note: 'Полупрозрачные панели, холодный свет',
    preview: { bg: '#07080c', panel: '#1e212c', text: '#eef2f8', dim: '#76808f', accent: '#a8c6ff' },
  },
  {
    id: 'amber',
    name: 'Янтарь',
    note: 'Тёплый уголь, оранжевый сигнал',
    preview: { bg: '#0c0b09', panel: '#1e1b15', text: '#f1ead9', dim: '#8b8170', accent: '#ff6b35' },
  },
];

const KEY = 'karman.theme';

export function getTheme(): ThemeId {
  const saved = window.localStorage.getItem(KEY);
  return THEMES.some((theme) => theme.id === saved) ? (saved as ThemeId) : 'graphite';
}

export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  window.localStorage.setItem(KEY, id);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const theme = THEMES.find((item) => item.id === id);
    if (theme) meta.setAttribute('content', theme.preview.bg);
  }
}

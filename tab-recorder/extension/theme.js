(() => {
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem('tab-recorder-theme'); } catch {}
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    const button = document.getElementById('themeToggle');
    if (button) {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
      document.getElementById('themeLabel').textContent = theme === 'dark' ? 'Dark' : 'Light';
    }
  }
  function current() { return ['light', 'dark'].includes(preference) ? preference : system.matches ? 'dark' : 'light'; }
  apply(current());
  document.addEventListener('DOMContentLoaded', () => {
    apply(current());
    document.getElementById('themeToggle').addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('tab-recorder-theme', preference); } catch {}
      apply(preference);
    });
  });
  system.addEventListener('change', () => apply(current()));
  window.addEventListener('storage', event => {
    if (event.key === 'tab-recorder-theme') { preference = event.newValue; apply(current()); }
  });
})();

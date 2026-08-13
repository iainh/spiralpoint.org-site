// Sun and Moon icons: Lucide Icons, ISC/MIT licensed.
(() => {
  const storageKey = "color-scheme";
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  try {
    const savedTheme = localStorage.getItem(storageKey);
    if (savedTheme === "light" || savedTheme === "dark") {
      root.dataset.theme = savedTheme;
    }
  } catch {
    // The system preference remains the default when storage is unavailable.
  }

  const currentTheme = () => root.dataset.theme || (media.matches ? "dark" : "light");

  const mountSelector = () => {
    const selector = document.createElement("div");
    selector.className = "theme-selector";
    selector.setAttribute("role", "group");
    selector.setAttribute("aria-label", "Colour scheme");
    selector.innerHTML = `
      <button type="button" data-theme-value="light" aria-label="Use light colour scheme" title="Light">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2"></path>
          <path d="M12 20v2"></path>
          <path d="m4.93 4.93 1.41 1.41"></path>
          <path d="m17.66 17.66 1.41 1.41"></path>
          <path d="M2 12h2"></path>
          <path d="M20 12h2"></path>
          <path d="m6.34 17.66-1.41 1.41"></path>
          <path d="m19.07 4.93-1.41 1.41"></path>
        </svg>
      </button>
      <button type="button" data-theme-value="dark" aria-label="Use dark colour scheme" title="Dark">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"></path>
        </svg>
      </button>
    `;

    const updateSelector = () => {
      const theme = currentTheme();
      for (const button of selector.querySelectorAll("button")) {
        button.setAttribute("aria-pressed", String(button.dataset.themeValue === theme));
      }
    };

    selector.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;

      root.dataset.theme = button.dataset.themeValue;
      try {
        localStorage.setItem(storageKey, button.dataset.themeValue);
      } catch {
        // The selection still applies for the current page when storage is unavailable.
      }
      updateSelector();
    });

    media.addEventListener("change", updateSelector);
    document.body.append(selector);
    updateSelector();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountSelector);
  } else {
    mountSelector();
  }
})();

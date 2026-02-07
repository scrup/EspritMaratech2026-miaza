(() => {
  const STORAGE_KEY = "uc_a11y_full_v6";

  const state = {
    fontScale: 1,          // 1.0 -> 1.7
    lineHeight: 1.6,       // 1.3 -> 2.4
    letterSpacing: 0,      // 0 -> 0.14em
    wordSpacing: 0,        // 0 -> 0.3em

    contrast: false,
    invert: false,
    grayscale: false,
    saturation: 1,         // 0.2 -> 2.0

    highlightLinks: false,
    highlightHeadings: false,
    hideImages: false,
    bigCursor: false,

    readingGuide: false,
    dyslexiaFriendly: false
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const round2 = (n) => Math.round(n * 100) / 100;

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      Object.assign(state, saved);
    } catch {}
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function apply() {
    const root = document.documentElement;

    root.style.setProperty("--uc-font-scale", state.fontScale);
    root.style.setProperty("--uc-line-height", state.lineHeight);
    root.style.setProperty("--uc-letter-spacing", `${state.letterSpacing}em`);
    root.style.setProperty("--uc-word-spacing", `${state.wordSpacing}em`);
    root.style.setProperty("--uc-saturation", state.saturation);

    document.body.classList.toggle("uc-contrast", state.contrast);
    document.body.classList.toggle("uc-invert", state.invert);
    document.body.classList.toggle("uc-grayscale", state.grayscale);
    document.body.classList.toggle("uc-highlight-links", state.highlightLinks);
    document.body.classList.toggle("uc-highlight-headings", state.highlightHeadings);
    document.body.classList.toggle("uc-hide-images", state.hideImages);
    document.body.classList.toggle("uc-big-cursor", state.bigCursor);
    document.body.classList.toggle("uc-reading-guide", state.readingGuide);
    document.body.classList.toggle("uc-dyslexia", state.dyslexiaFriendly);

    // small helpful auto-tweaks when dyslexia mode is on
    if (state.dyslexiaFriendly) {
      // ensure comfortable line-height/spacing without being extreme
      root.style.setProperty("--uc-line-height", Math.max(state.lineHeight, 1.8));
      root.style.setProperty("--uc-letter-spacing", `${Math.max(state.letterSpacing, 0.03)}em`);
      root.style.setProperty("--uc-word-spacing", `${Math.max(state.wordSpacing, 0.08)}em`);
    }
  }

  function injectCSS() {
    const css = `
      :root{
        --uc-font-scale: 1;
        --uc-line-height: 1.6;
        --uc-letter-spacing: 0em;
        --uc-word-spacing: 0em;
        --uc-saturation: 1;
      }

      html{ font-size: calc(16px * var(--uc-font-scale)); }
      body{ line-height: var(--uc-line-height); letter-spacing: var(--uc-letter-spacing); word-spacing: var(--uc-word-spacing); }
      body{ filter: saturate(var(--uc-saturation)); }

      body.uc-grayscale{ filter: grayscale(1) saturate(var(--uc-saturation)); }
      body.uc-invert{ filter: invert(1) hue-rotate(180deg) saturate(var(--uc-saturation)); }

      body.uc-contrast{
        background:#000 !important;
        color:#fff !important;
      }
      body.uc-contrast .miaza-card,
      body.uc-contrast .navbar,
      body.uc-contrast .dropdown-menu,
      body.uc-contrast .uc-a11y__panel{
        background:#000 !important;
        color:#fff !important;
        border-color:#444 !important;
      }
      body.uc-contrast a{ color:#fff !important; }

      body.uc-highlight-links a{
        text-decoration: underline !important;
        font-weight: 800 !important;
      }

      body.uc-highlight-headings h1,
      body.uc-highlight-headings h2,
      body.uc-highlight-headings h3,
      body.uc-highlight-headings h4,
      body.uc-highlight-headings h5,
      body.uc-highlight-headings h6{
        outline: 3px solid rgba(255, 230, 0, 0.85);
        outline-offset: 4px;
        border-radius: 8px;
      }

      body.uc-hide-images img,
      body.uc-hide-images svg,
      body.uc-hide-images video{
        visibility: hidden !important;
      }

      body.uc-big-cursor, body.uc-big-cursor *{
        cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><path fill='black' d='M6 4l16 34 4-12 12-4z'/><path fill='white' d='M8 8l12 26 3-9 9-3z'/></svg>") 0 0, auto !important;
      }

      /* Dyslexia-friendly (system fonts, no downloads) */
      body.uc-dyslexia{
        font-family: Verdana, Arial, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif !important;
      }
      body.uc-dyslexia p,
      body.uc-dyslexia li{
        max-width: 70ch;
      }

      /* Reading guide line */
      .uc-reading-line{
        position: fixed; left: 0; width: 100%; height: 3px;
        background: rgba(255, 230, 0, 0.95);
        z-index: 9000;
        pointer-events:none;
        display:none;
      }
      body.uc-reading-guide .uc-reading-line{ display:block; }

      /* ✅ BUTTON POSITION IS HERE */
.uc-a11y{
  position: fixed;
  right: 16px;     /* right side */
  top: 50%;        /* middle vertically */
  transform: translateY(-50%);
  z-index: 9999;
}


      .uc-a11y__fab{
    background:#8a232e;color:#fff;border:none;border-radius:999px;
        padding:.7rem 1rem;box-shadow:0 10px 24px rgba(0,0,0,.18);
        display:flex;gap:.5rem;align-items:center;font-weight:900
      }
      .uc-a11y__fab:focus{outline:3px solid rgba(255,255,255,.7);outline-offset:3px}
      .uc-a11y__panel{
        width:min(380px,calc(100vw - 32px));
        margin-top:.6rem;background:#fff;border-radius:16px;
        box-shadow:0 16px 40px rgba(0,0,0,.22);overflow:hidden
      }
      .uc-a11y__header{
        display:flex;justify-content:space-between;align-items:center;
        padding:12px 14px;background:#F6FAFD
      }
      .uc-a11y__close{background:transparent;border:none;font-size:18px;cursor:pointer}
      .uc-a11y__section{padding:14px;display:grid;gap:12px}
      .uc-a11y__row{display:flex;justify-content:space-between;align-items:center;gap:12px}
      .uc-a11y__btnGroup{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .uc-a11y__btn{
        border:1px solid #D7E6F2;background:#fff;border-radius:10px;
        padding:.45rem .7rem;font-weight:900;cursor:pointer
      }
      .uc-a11y__btn--full{width:100%}
      .uc-a11y__toggle{display:flex;align-items:center;gap:10px}
      .uc-a11y__toggle input{width:18px;height:18px}
      .uc-a11y__footer{padding:14px;border-top:1px solid #EEF4FA}
      .uc-a11y__label{font-weight:900;color:#0B1F2D}
      .uc-a11y__hint{font-size:12px;color:#4B6A80}
      .uc-a11y__mini{font-size:12px;color:#4B6A80}
      .uc-a11y__divider{height:1px;background:#EEF4FA;margin:6px 0}
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function ensureOverlays() {
    if (!document.querySelector(".uc-reading-line")) {
      const line = document.createElement("div");
      line.className = "uc-reading-line";
      document.body.appendChild(line);
    }

    document.addEventListener("mousemove", (e) => {
      const line = document.querySelector(".uc-reading-line");
      if (line) line.style.top = `${e.clientY}px`;
    });
  }

  function createUI() {
    const wrap = document.createElement("div");
    wrap.className = "uc-a11y";

    wrap.innerHTML = `
      <button class="uc-a11y__fab" type="button" aria-haspopup="dialog" aria-controls="uc-a11y-panel" aria-expanded="false">
         🩵
      </button>

      <div class="uc-a11y__panel" id="uc-a11y-panel" role="dialog" aria-label="Menu d’accessibilité" aria-modal="false" hidden>
        <div class="uc-a11y__header">
          <div>
            <div class="uc-a11y__label">Accessibilité</div>
            <div class="uc-a11y__hint">Options</div>
          </div>
          <button class="uc-a11y__close" type="button" aria-label="Fermer">✕</button>
        </div>

        <div class="uc-a11y__section">
          <div class="uc-a11y__row">
            <span>Taille du texte</span>
            <div class="uc-a11y__btnGroup">
              <button class="uc-a11y__btn" type="button" data-btn="text-minus">A−</button>
              <button class="uc-a11y__btn" type="button" data-btn="text-plus">A+</button>
            </div>
          </div>

          <div class="uc-a11y__row">
            <span>Interligne</span>
            <div class="uc-a11y__btnGroup">
              <button class="uc-a11y__btn" type="button" data-btn="lh-minus">−</button>
              <button class="uc-a11y__btn" type="button" data-btn="lh-plus">+</button>
            </div>
          </div>

          <div class="uc-a11y__row">
            <span>Espacement lettres</span>
            <div class="uc-a11y__btnGroup">
              <button class="uc-a11y__btn" type="button" data-btn="ls-minus">−</button>
              <button class="uc-a11y__btn" type="button" data-btn="ls-plus">+</button>
            </div>
          </div>

          <div class="uc-a11y__row">
            <span>Espacement mots</span>
            <div class="uc-a11y__btnGroup">
              <button class="uc-a11y__btn" type="button" data-btn="ws-minus">−</button>
              <button class="uc-a11y__btn" type="button" data-btn="ws-plus">+</button>
            </div>
          </div>

          <div class="uc-a11y__divider"></div>

          <div class="uc-a11y__row">
            <span>Saturation</span>
            <div class="uc-a11y__btnGroup">
              <button class="uc-a11y__btn" type="button" data-btn="sat-minus">−</button>
              <button class="uc-a11y__btn" type="button" data-btn="sat-plus">+</button>
            </div>
          </div>

          <label class="uc-a11y__toggle"><input type="checkbox" data-toggle="bigCursor"><span>Curseur plus grand</span></label>
          <label class="uc-a11y__toggle"><input type="checkbox" data-toggle="readingGuide"><span>Guide de lecture</span></label>
          <label class="uc-a11y__toggle"><input type="checkbox" data-toggle="dyslexiaFriendly"><span>Police “dyslexie-friendly”</span></label>

          <label class="uc-a11y__toggle"><input type="checkbox" data-toggle="contrast"><span>Contraste élevé</span></label>
          <label class="uc-a11y__toggle"><input type="checkbox" data-toggle="invert"><span>Inverser les couleurs</span></label>
          <label class="uc-a11y__toggle"><input type="checkbox" data-toggle="grayscale"><span>Mode gris</span></label>

          <label class="uc-a11y__toggle"><input type="checkbox" data-toggle="links"><span>Surligner les liens</span></label>
          <label class="uc-a11y__toggle"><input type="checkbox" data-toggle="headings"><span>Surligner les titres</span></label>
          <label class="uc-a11y__toggle"><input type="checkbox" data-toggle="hideImages"><span>Masquer les images</span></label>

          <div class="uc-a11y__mini">Astuce : vos choix sont sauvegardés.</div>
        </div>

        <div class="uc-a11y__footer">
          <button class="uc-a11y__btn uc-a11y__btn--full" type="button" data-btn="reset">Réinitialiser</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const fab = wrap.querySelector(".uc-a11y__fab");
    const panel = wrap.querySelector(".uc-a11y__panel");
    const closeBtn = wrap.querySelector(".uc-a11y__close");

    // init checkboxes from state
    wrap.querySelector('[data-toggle="contrast"]').checked = state.contrast;
    wrap.querySelector('[data-toggle="invert"]').checked = state.invert;
    wrap.querySelector('[data-toggle="grayscale"]').checked = state.grayscale;
    wrap.querySelector('[data-toggle="links"]').checked = state.highlightLinks;
    wrap.querySelector('[data-toggle="headings"]').checked = state.highlightHeadings;
    wrap.querySelector('[data-toggle="hideImages"]').checked = state.hideImages;
    wrap.querySelector('[data-toggle="bigCursor"]').checked = state.bigCursor;
    wrap.querySelector('[data-toggle="readingGuide"]').checked = state.readingGuide;
    wrap.querySelector('[data-toggle="dyslexiaFriendly"]').checked = state.dyslexiaFriendly;

    function open() {
      panel.hidden = false;
      fab.setAttribute("aria-expanded", "true");
      closeBtn.focus();
    }
    function close() {
      panel.hidden = true;
      fab.setAttribute("aria-expanded", "false");
      fab.focus();
    }

    fab.addEventListener("click", () => (panel.hidden ? open() : close()));
    closeBtn.addEventListener("click", close);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) close();
    });

    // Buttons click
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-btn]");
      if (!btn) return;

      const action = btn.getAttribute("data-btn");

      if (action === "text-minus") state.fontScale = clamp(round2(state.fontScale - 0.1), 1, 1.7);
      if (action === "text-plus") state.fontScale = clamp(round2(state.fontScale + 0.1), 1, 1.7);

      if (action === "lh-minus") state.lineHeight = clamp(round2(state.lineHeight - 0.1), 1.3, 2.4);
      if (action === "lh-plus") state.lineHeight = clamp(round2(state.lineHeight + 0.1), 1.3, 2.4);

      if (action === "ls-minus") state.letterSpacing = clamp(round2(state.letterSpacing - 0.02), 0, 0.14);
      if (action === "ls-plus") state.letterSpacing = clamp(round2(state.letterSpacing + 0.02), 0, 0.14);

      if (action === "ws-minus") state.wordSpacing = clamp(round2(state.wordSpacing - 0.05), 0, 0.3);
      if (action === "ws-plus") state.wordSpacing = clamp(round2(state.wordSpacing + 0.05), 0, 0.3);

      if (action === "sat-minus") state.saturation = clamp(round2(state.saturation - 0.2), 0.2, 2.0);
      if (action === "sat-plus") state.saturation = clamp(round2(state.saturation + 0.2), 0.2, 2.0);

      if (action === "reset") {
        state.fontScale = 1;
        state.lineHeight = 1.6;
        state.letterSpacing = 0;
        state.wordSpacing = 0;
        state.contrast = false;
        state.invert = false;
        state.grayscale = false;
        state.saturation = 1;
        state.highlightLinks = false;
        state.highlightHeadings = false;
        state.hideImages = false;
        state.bigCursor = false;
        state.readingGuide = false;
        state.dyslexiaFriendly = false;

        wrap.querySelectorAll("[data-toggle]").forEach((i) => (i.checked = false));
      }

      save();
      apply();
    });

    // Checkboxes change
    wrap.addEventListener("change", (e) => {
      const input = e.target.closest("input[data-toggle]");
      if (!input) return;

      const t = input.getAttribute("data-toggle");
      const v = input.checked;

      if (t === "contrast") state.contrast = v;
      if (t === "invert") state.invert = v;
      if (t === "grayscale") state.grayscale = v;
      if (t === "links") state.highlightLinks = v;
      if (t === "headings") state.highlightHeadings = v;
      if (t === "hideImages") state.hideImages = v;
      if (t === "bigCursor") state.bigCursor = v;
      if (t === "readingGuide") state.readingGuide = v;
      if (t === "dyslexiaFriendly") state.dyslexiaFriendly = v;

      save();
      apply();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    injectCSS();
    ensureOverlays();
    apply();
    createUI();
  });
})();

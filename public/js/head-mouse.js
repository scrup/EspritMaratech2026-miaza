(() => {
  const STORAGE_KEY = "uc_headmouse_v3_4dir_invertLR";

  const defaults = {
    enabled: false,
    showPreview: true,

    speedX: 26, // 12..45
    speedY: 26, // 12..45

    yawDeadzone: 0.02,   // 0.01..0.08
    pitchDeadzone: 0.02, // 0.01..0.08

    blinkThreshold: 0.22,   // 0.16..0.30
    blinkCooldownMs: 900
  };

  let cfg = { ...defaults };

  let panelEl = null;
  let btnEl = null;
  let videoEl = null;

  let camera = null;
  let faceMesh = null;

  let cursorEl = null;
  let cursorX = 120;
  let cursorY = 140;

  let smoothedYaw = 0;
  let smoothedPitch = 0;
  const SMOOTHING = 0.7;

  let lastBlinkAt = 0;

  // ✅ prevents double start when toggling quickly
  let starting = false;

  const now = () => Date.now();
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function loadCfg() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      cfg = { ...defaults, ...saved };
    } catch {
      cfg = { ...defaults };
    }
  }
  function saveCfg() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  // Click element under cursor
  function clickAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return;

    if (panelEl && panelEl.contains(el)) return;
    if (btnEl && btnEl.contains(el)) return;

    const actionable =
      el.closest?.("a[href],button,input,select,textarea,[role='button'],[tabindex]") || el;

    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
    actionable.dispatchEvent(new MouseEvent("mousemove", opts));
    actionable.dispatchEvent(new MouseEvent("mouseover", opts));
    actionable.dispatchEvent(new MouseEvent("mousedown", opts));
    actionable.dispatchEvent(new MouseEvent("mouseup", opts));
    actionable.dispatchEvent(new MouseEvent("click", opts));
  }

  // ---- Face math helpers ----
  function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function ear(p1, p2, p3, p4, p5, p6) {
    const num = dist(p2, p6) + dist(p3, p5);
    const den = 2 * dist(p1, p4);
    return den ? num / den : 1;
  }

  function bothEyesBlinking(lm) {
    const L = { p1: lm[33],  p2: lm[160], p3: lm[158], p4: lm[133], p5: lm[153], p6: lm[144] };
    const R = { p1: lm[362], p2: lm[385], p3: lm[387], p4: lm[263], p5: lm[373], p6: lm[380] };
    if (!L.p1 || !R.p1) return false;

    const leftEAR  = ear(L.p1, L.p2, L.p3, L.p4, L.p5, L.p6);
    const rightEAR = ear(R.p1, R.p2, R.p3, R.p4, R.p5, R.p6);

    return leftEAR < cfg.blinkThreshold && rightEAR < cfg.blinkThreshold;
  }

  // yaw: head left/right
  function estimateYaw(lm) {
    const nose = lm[1];
    const left = lm[234];
    const right = lm[454];
    if (!nose || !left || !right) return 0;
    const centerX = (left.x + right.x) / 2;
    return nose.x - centerX; // + => head right, - => head left
  }

  // pitch: head up/down
  function estimatePitch(lm) {
    const nose = lm[1];
    const leftEye = lm[33];
    const rightEye = lm[263];
    if (!nose || !leftEye || !rightEye) return 0;
    const eyesY = (leftEye.y + rightEye.y) / 2;
    return nose.y - eyesY; // + => head down, - => head up
  }

  // ---- Cursor overlay ----
  function ensureCursor() {
    if (cursorEl) return;

    cursorEl = document.createElement("div");
    cursorEl.id = "uc-headmouse-cursor";
    Object.assign(cursorEl.style, {
      position: "fixed",
      left: "0px",
      top: "0px",
      width: "18px",
      height: "18px",
      borderRadius: "999px",
      background: "#FFD400",
      boxShadow: "0 6px 18px rgba(0,0,0,.25)",
      transform: "translate(-50%,-50%)",
      zIndex: "9999999",
      pointerEvents: "none",
      display: "none"
    });
    document.body.appendChild(cursorEl);

    cursorX = Math.round(window.innerWidth * 0.5);
    cursorY = Math.round(window.innerHeight * 0.35);
    renderCursor();
  }

  function renderCursor() {
    if (!cursorEl) return;
    cursorEl.style.left = `${cursorX}px`;
    cursorEl.style.top = `${cursorY}px`;
  }

  function setCursorVisible(v) {
    ensureCursor();
    cursorEl.style.display = v ? "block" : "none";
  }

  // ---- UI styles ----
  function injectStyles() {
    const css = `
      .uc-camBtn{
        position: fixed;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 999999;
        background: #8a232e;
        color: #fff;
        border: none;
        border-radius: 999px;
        padding: .75rem 1rem;
        font-weight: 900;
        box-shadow: 0 10px 24px rgba(0,0,0,.18);
        cursor: pointer;
      }

      .uc-camPanel{
        position: fixed;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 999999;
        width: min(460px, calc(100vw - 32px));
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 16px 40px rgba(0,0,0,.22);
        overflow: hidden;
        display: none;
      }
      .uc-camPanel[aria-hidden="false"]{ display:block; }

      .uc-camHeader{
        display:flex;align-items:center;justify-content:space-between;
        padding: 12px 14px;
        background: #F6FAFD;
        border-bottom: 1px solid #EEF4FA;
      }
      .uc-camTitle{ font-weight: 900; color:#0B1F2D; }
      .uc-camClose{ background:transparent;border:none;font-size:20px;cursor:pointer; }

      .uc-camBody{ padding: 14px; display:grid; gap: 12px; }
      .uc-camHint{ font-size: 12px; color:#4B6A80; line-height:1.35; }

      .uc-camVideo{
        width: 100%;
        height: 220px;
        background: #000;
        border-radius: 14px;
        object-fit: cover;
      }

      .uc-row{ display:flex; align-items:center; justify-content:space-between; gap: 12px; }
      .uc-row label{ font-weight: 800; color:#0B1F2D; }
      .uc-switch{ display:flex; align-items:center; gap: 10px; font-weight: 800; color:#0B1F2D; }
      .uc-switch input{ width: 18px; height: 18px; }
      .uc-slider{ width: 190px; }

      .uc-btn{
        background:#2172A8;color:#fff;border:none;border-radius:12px;
        padding:.6rem .9rem;font-weight:900;cursor:pointer;
      }
      .uc-btnRow{ display:flex; gap:10px; flex-wrap:wrap; }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function createUI() {
    btnEl = document.createElement("button");
    btnEl.className = "uc-camBtn";
    btnEl.type = "button";
    btnEl.textContent = "🎥 Caméra";
    btnEl.setAttribute("aria-expanded", "false");
    document.body.appendChild(btnEl);

    panelEl = document.createElement("div");
    panelEl.className = "uc-camPanel";
    panelEl.setAttribute("role", "dialog");
    panelEl.setAttribute("aria-label", "Navigation caméra");
    panelEl.setAttribute("aria-hidden", "true");

    panelEl.innerHTML = `
      <div class="uc-camHeader">
        <div>
          <div class="uc-camTitle">Navigation Caméra</div>
          <div class="uc-camHint">
            4 directions • Blink (2 yeux) = clic<br>
            ✅ Gauche/Droite inversés : tête gauche → curseur droite, tête droite → curseur gauche
          </div>
        </div>
        <button class="uc-camClose" type="button" aria-label="Fermer">✕</button>
      </div>

      <div class="uc-camBody">
        <video class="uc-camVideo" id="uc-video" autoplay playsinline muted></video>

        <div class="uc-row">
          <span class="uc-switch">
            <input id="uc-enabled" type="checkbox">
            <label for="uc-enabled">Activer</label>
          </span>

          <span class="uc-switch">
            <input id="uc-preview" type="checkbox">
            <label for="uc-preview">Aperçu</label>
          </span>
        </div>

        <div class="uc-row">
          <label for="uc-speedX">Vitesse X</label>
          <input class="uc-slider" id="uc-speedX" type="range" min="12" max="45" step="1">
        </div>

        <div class="uc-row">
          <label for="uc-speedY">Vitesse Y</label>
          <input class="uc-slider" id="uc-speedY" type="range" min="12" max="45" step="1">
        </div>

        <div class="uc-row">
          <label for="uc-deadX">Stabilité X</label>
          <input class="uc-slider" id="uc-deadX" type="range" min="0.01" max="0.08" step="0.01">
        </div>

        <div class="uc-row">
          <label for="uc-deadY">Stabilité Y</label>
          <input class="uc-slider" id="uc-deadY" type="range" min="0.01" max="0.08" step="0.01">
        </div>

        <div class="uc-row">
          <label for="uc-blink">Sensibilité blink</label>
          <input class="uc-slider" id="uc-blink" type="range" min="0.16" max="0.30" step="0.01">
        </div>

        <div class="uc-btnRow">
          <button class="uc-btn" type="button" id="uc-center">Centrer le curseur</button>
          <button class="uc-btn" type="button" id="uc-reset">Réinitialiser</button>
        </div>

        <div class="uc-camHint">
          Si le curseur bouge trop: augmente “Stabilité X/Y”.<br>
          Si ça clique trop: augmente “Blink”. Si ça ne clique pas: diminue “Blink”.
        </div>
      </div>
    `;

    document.body.appendChild(panelEl);

    videoEl = panelEl.querySelector("#uc-video");

    panelEl.querySelector("#uc-enabled").checked = !!cfg.enabled;
    panelEl.querySelector("#uc-preview").checked = !!cfg.showPreview;
    panelEl.querySelector("#uc-speedX").value = String(cfg.speedX);
    panelEl.querySelector("#uc-speedY").value = String(cfg.speedY);
    panelEl.querySelector("#uc-deadX").value = String(cfg.yawDeadzone);
    panelEl.querySelector("#uc-deadY").value = String(cfg.pitchDeadzone);
    panelEl.querySelector("#uc-blink").value = String(cfg.blinkThreshold);

    const closeBtn = panelEl.querySelector(".uc-camClose");

    function openPanel() {
      panelEl.setAttribute("aria-hidden", "false");
      btnEl.setAttribute("aria-expanded", "true");
      videoEl.style.display = cfg.showPreview ? "block" : "none";
      closeBtn.focus();
    }

    function closePanel() {
      panelEl.setAttribute("aria-hidden", "true");
      btnEl.setAttribute("aria-expanded", "false");
      btnEl.focus();
    }

    btnEl.addEventListener("click", () => {
      const hidden = panelEl.getAttribute("aria-hidden") === "true";
      hidden ? openPanel() : closePanel();
    });

    closeBtn.addEventListener("click", closePanel);

    panelEl.querySelector("#uc-enabled").addEventListener("change", async (e) => {
      await setEnabled(!!e.target.checked);
    });

    panelEl.querySelector("#uc-preview").addEventListener("change", (e) => {
      cfg.showPreview = !!e.target.checked;
      saveCfg();
      videoEl.style.display = cfg.showPreview ? "block" : "none";
    });

    panelEl.querySelector("#uc-speedX").addEventListener("input", (e) => {
      cfg.speedX = parseInt(e.target.value, 10);
      saveCfg();
    });
    panelEl.querySelector("#uc-speedY").addEventListener("input", (e) => {
      cfg.speedY = parseInt(e.target.value, 10);
      saveCfg();
    });
    panelEl.querySelector("#uc-deadX").addEventListener("input", (e) => {
      cfg.yawDeadzone = parseFloat(e.target.value);
      saveCfg();
    });
    panelEl.querySelector("#uc-deadY").addEventListener("input", (e) => {
      cfg.pitchDeadzone = parseFloat(e.target.value);
      saveCfg();
    });
    panelEl.querySelector("#uc-blink").addEventListener("input", (e) => {
      cfg.blinkThreshold = parseFloat(e.target.value);
      saveCfg();
    });

    panelEl.querySelector("#uc-center").addEventListener("click", () => {
      cursorX = Math.round(window.innerWidth * 0.5);
      cursorY = Math.round(window.innerHeight * 0.35);
      renderCursor();
    });

    panelEl.querySelector("#uc-reset").addEventListener("click", async () => {
      cfg = { ...defaults };
      saveCfg();

      panelEl.querySelector("#uc-enabled").checked = false;
      panelEl.querySelector("#uc-preview").checked = true;

      panelEl.querySelector("#uc-speedX").value = String(cfg.speedX);
      panelEl.querySelector("#uc-speedY").value = String(cfg.speedY);
      panelEl.querySelector("#uc-deadX").value = String(cfg.yawDeadzone);
      panelEl.querySelector("#uc-deadY").value = String(cfg.pitchDeadzone);
      panelEl.querySelector("#uc-blink").value = String(cfg.blinkThreshold);

      await setEnabled(false);
    });
  }

  function showCamError(e) {
    const name = String(e?.name || "");
    const msg = String(e?.message || "");

    if (
      /NotReadableError|TrackStartError/i.test(name) ||
      /CameraReservedByAnotherApp/i.test(msg)
    ) {
      alert("Caméra occupée par une autre application (Caméra Windows / Teams / Zoom). Ferme-la puis réessaie.");
      return;
    }

    if (/NotAllowedError|PermissionDeniedError/i.test(name)) {
      alert("Permission caméra refusée. Autorise la caméra dans le navigateur puis réessaie.");
      return;
    }

    alert("Camera not available.");
  }

  async function startCamera() {
    // ✅ prevent double start
    if (starting) return;
    if (camera && faceMesh) return;
    starting = true;

    ensureCursor();
    setCursorVisible(true);

    if (typeof FaceMesh === "undefined" || typeof Camera === "undefined") {
      alert("MediaPipe not loaded. Check scripts order in base.html.twig.");
      cfg.enabled = false;
      saveCfg();
      panelEl?.querySelector("#uc-enabled") && (panelEl.querySelector("#uc-enabled").checked = false);
      setCursorVisible(false);
      starting = false;
      return;
    }

    faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });

    faceMesh.onResults((results) => {
      if (!cfg.enabled) return;

      const lm = results.multiFaceLandmarks?.[0];
      if (!lm) return;

      const yaw = estimateYaw(lm);
      const pitch = estimatePitch(lm);

      smoothedYaw = SMOOTHING * smoothedYaw + (1 - SMOOTHING) * yaw;
      smoothedPitch = SMOOTHING * smoothedPitch + (1 - SMOOTHING) * pitch;

      // ✅ LEFT/RIGHT INVERTED
      const absYaw = Math.abs(smoothedYaw);
      if (absYaw > cfg.yawDeadzone) {
        const dirX = smoothedYaw > 0 ? -1 : 1; // inversion
        const magX = (absYaw - cfg.yawDeadzone);
        const dx = dirX * magX * cfg.speedX * 10;
        cursorX = clamp(cursorX + dx, 10, window.innerWidth - 10);
      }

      // ✅ UP/DOWN NORMAL
      const absPitch = Math.abs(smoothedPitch);
      if (absPitch > cfg.pitchDeadzone) {
        const dirY = smoothedPitch > 0 ? 1 : -1;
        const magY = (absPitch - cfg.pitchDeadzone);
        const dy = dirY * magY * cfg.speedY * 10;
        cursorY = clamp(cursorY + dy, 10, window.innerHeight - 10);
      }

      renderCursor();

      // ✅ Blink = Click
      const t = now();
      if (t - lastBlinkAt > cfg.blinkCooldownMs) {
        if (bothEyesBlinking(lm)) {
          clickAt(cursorX, cursorY);
          lastBlinkAt = t;
        }
      }
    });

    camera = new Camera(videoEl, {
      onFrame: async () => {
        if (cfg.enabled && faceMesh) {
          await faceMesh.send({ image: videoEl });
        }
      },
      width: 640,
      height: 480
    });

    try {
      await camera.start();
    } catch (e) {
      console.error(e);
      showCamError(e);
      cfg.enabled = false;
      saveCfg();
      panelEl?.querySelector("#uc-enabled") && (panelEl.querySelector("#uc-enabled").checked = false);
      await stopCamera();
    } finally {
      starting = false;
    }
  }

  async function stopCamera() {
    try { if (camera) camera.stop(); } catch {}

    // ✅ IMPORTANT (Windows): release real webcam tracks
    try {
      const stream = videoEl?.srcObject;
      if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
      if (videoEl) videoEl.srcObject = null;
    } catch {}

    camera = null;
    faceMesh = null;
    starting = false;
    setCursorVisible(false);
  }

  async function setEnabled(v) {
    cfg.enabled = v;
    saveCfg();

    if (cfg.enabled) {
      videoEl.style.display = cfg.showPreview ? "block" : "none";
      await startCamera();
    } else {
      await stopCamera();
    }
  }

  async function init() {
    loadCfg();
    injectStyles();
    createUI();
    ensureCursor();

    if (cfg.enabled) {
      await setEnabled(true);
      panelEl?.querySelector("#uc-enabled") && (panelEl.querySelector("#uc-enabled").checked = true);
    }

    document.addEventListener("keydown", async (e) => {
      if (e.key === "Escape" && cfg.enabled) {
        panelEl?.querySelector("#uc-enabled") && (panelEl.querySelector("#uc-enabled").checked = false);
        await setEnabled(false);
      }
    });

    window.addEventListener("resize", () => {
      cursorX = clamp(cursorX, 10, window.innerWidth - 10);
      cursorY = clamp(cursorY, 10, window.innerHeight - 10);
      renderCursor();
    });

    // ✅ cleanup on reload/close (prevents camera locked)
    const cleanup = () => {
      try {
        const stream = videoEl?.srcObject;
        if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
      } catch {}
    };
    window.addEventListener("beforeunload", cleanup);
    window.addEventListener("pagehide", cleanup);
  }

  // ✅ IMPORTANT: works even if script loads after DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

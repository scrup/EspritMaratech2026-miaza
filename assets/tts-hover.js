// assets/tts-hover.js
console.log("tts-hover.js loaded ✅");

const state = {
  enabled: JSON.parse(localStorage.getItem("tts_enabled") ?? "true"),
  armed: false,
  timer: null,
  lastSpoken: "",

  // Translation settings
  translateOn: JSON.parse(localStorage.getItem("tts_translate_on") ?? "false"),
  targetLang: localStorage.getItem("tts_target_lang") ?? "en", // "en" or "ar"
  cache: new Map(),
};

function getPageLang() {
  return (document.documentElement.getAttribute("lang") || navigator.language || "fr-FR").trim();
}

function primaryLang(tag) {
  return (tag || "fr").toLowerCase().split("-")[0]; // "fr-FR" -> "fr"
}

function armOnFirstInteraction() {
  if (state.armed) return;
  state.armed = true;
  try { window.speechSynthesis.cancel(); } catch (e) {}
  console.log("TTS armed ✅");
}
window.addEventListener("pointerdown", armOnFirstInteraction, { once: true });
window.addEventListener("keydown", armOnFirstInteraction, { once: true });

function speak(text) {
  if (!state.enabled) return;
  if (!state.armed) return;
  if (!text) return;
  if (!("speechSynthesis" in window)) return;

  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return;

  // Speak language depends on translation mode
  const lang = state.translateOn
    ? (state.targetLang === "ar" ? "ar" : "en-US")
    : getPageLang();

  const key = `${lang}::${cleaned}`;
  if (key === state.lastSpoken) return;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(cleaned);
  u.lang = lang;
  window.speechSynthesis.speak(u);

  state.lastSpoken = key;
}

async function translate(text) {
  if (!state.translateOn) return text;

  const trimmed = (text || "").trim();
  if (!trimmed) return trimmed;

  // avoid translating huge blocks (optional safety)
  const limited = trimmed.slice(0, 300);

  const cacheKey = `${state.targetLang}::${limited}`;
  if (state.cache.has(cacheKey)) return state.cache.get(cacheKey);

  const res = await fetch("/api/tts/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: limited,
      source: primaryLang(getPageLang()), // "fr"
      target: state.targetLang,           // "en" or "ar"
    }),
  });

  if (!res.ok) return limited;

  const data = await res.json();
  const translated = (data.translated || limited).toString();

  state.cache.set(cacheKey, translated);
  return translated;
}

function getTextUnderCursor(x, y) {
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (!range || !range.startContainer) return "";
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return "";
    return node.textContent?.trim().slice(0, 200) || "";
  }

  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos || !pos.offsetNode) return "";
    const node = pos.offsetNode;
    if (node.nodeType !== Node.TEXT_NODE) return "";
    return node.textContent?.trim().slice(0, 200) || "";
  }

  const el = document.elementFromPoint(x, y);
  if (!el) return "";

  const aria = el.getAttribute?.("aria-label");
  if (aria) return aria.trim();

  if (el.tagName === "IMG") return (el.getAttribute("alt") || "").trim();

  const txt = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  return txt.slice(0, 200);
}

document.addEventListener("mousemove", (e) => {
  clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    const text = getTextUnderCursor(e.clientX, e.clientY);
    const finalText = await translate(text);
    speak(finalText);
  }, 300);
});

window.addEventListener("blur", () => window.speechSynthesis?.cancel());

window.ttsHover = {
  enable() {
    state.enabled = true;
    localStorage.setItem("tts_enabled", "true");
  },
  disable() {
    state.enabled = false;
    localStorage.setItem("tts_enabled", "false");
    window.speechSynthesis?.cancel();
  },
  toggle() {
    state.enabled = !state.enabled;
    localStorage.setItem("tts_enabled", JSON.stringify(state.enabled));
    if (!state.enabled) window.speechSynthesis?.cancel();
    return state.enabled;
  },

  // ✅ these fix your error
  setTranslate(on) {
    state.translateOn = !!on;
    localStorage.setItem("tts_translate_on", JSON.stringify(state.translateOn));
  },
  setTargetLang(lang) {
    state.targetLang = (lang === "ar") ? "ar" : "en";
    localStorage.setItem("tts_target_lang", state.targetLang);
    state.cache.clear();
  },

  getState() {
    return {
      enabled: state.enabled,
      armed: state.armed,
      translateOn: state.translateOn,
      targetLang: state.targetLang,
      pageLang: getPageLang(),
    };
  },
};

console.log("tts-hover VERSION = translate-enabled ✅", window.ttsHover);


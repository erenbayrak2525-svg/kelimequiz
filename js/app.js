import { onAuthChange, login, logout, currentUid, currentEmail } from "./firebase-init.js";
import {
  listenLanguages,
  addLanguage,
  deleteLanguage,
  listenWords,
  addWord,
  updateWord,
  deleteWord,
  getWordsOnce,
  recordQuizResult
} from "./db.js";
import { aiTranslate, aiExample, hasGeminiKey, getGeminiKey, setGeminiKey } from "./ai.js";

// ---------------- Global state ----------------
const state = {
  languages: [],
  words: [], // words for the currently open language
  activeLangId: null,
  quiz: null // { langId, items, index, score, options }
};

const root = document.getElementById("app");
let unsubWords = null;

// ---------------- Helpers ----------------
function esc(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toast(msg, kind = "info") {
  const el = document.createElement("div");
  el.className = `toast toast--${kind}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

function closeModal() {
  const overlay = document.querySelector(".modal-overlay");
  if (overlay) overlay.remove();
}

function openModal(innerHtml, onMount) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">${innerHtml}</div>`;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.body.appendChild(overlay);
  if (onMount) onMount(overlay.querySelector(".modal"));
  return overlay.querySelector(".modal");
}

function langColor(name) {
  const palette = ["#1B7A6B", "#C1443C", "#8A5FBF", "#2E6FA3", "#B8862F", "#4D8B31"];
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return palette[sum % palette.length];
}

function currentRoute() {
  const hash = location.hash.slice(1) || "/";
  const parts = hash.split("/").filter(Boolean);
  return parts; // e.g. [] -> home, ['lang','abc123'] , ['quiz'], ['quiz','abc123'], ['settings']
}

// ---------------- Shell / sidebar ----------------
function renderShell() {
  root.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand__mark">V</span>
          <span class="brand__name">Kelime Defteri</span>
        </div>

        <nav class="nav-section">
          <div class="nav-section__head">
            <span>Diller</span>
            <button class="icon-btn" id="btn-add-lang" title="Dil ekle" aria-label="Dil ekle">+</button>
          </div>
          <ul class="lang-list" id="lang-list"></ul>
        </nav>

        <nav class="nav-section">
          <ul class="nav-simple">
            <li><a href="#/quiz" class="nav-link" data-route="quiz">Quiz</a></li>
            <li><a href="#/settings" class="nav-link" data-route="settings">Ayarlar</a></li>
          </ul>
        </nav>

        <div class="sidebar__footer">
          <button class="btn btn--ghost btn--sm" id="btn-sidebar-logout">Çıkış yap</button>
        </div>
      </aside>
      <main class="main" id="main"></main>
    </div>
  `;
  document.getElementById("btn-add-lang").addEventListener("click", showAddLanguageModal);
  document.getElementById("btn-sidebar-logout").addEventListener("click", () => {
    logout().catch((err) => toast("Çıkış yapılamadı: " + err.message, "error"));
  });
}

function renderSidebarLangs() {
  const list = document.getElementById("lang-list");
  if (!list) return;
  const route = currentRoute();
  const activeId = route[0] === "lang" ? route[1] : null;
  if (state.languages.length === 0) {
    list.innerHTML = `<li class="lang-list__empty">Henüz dil yok</li>`;
    return;
  }
  list.innerHTML = state.languages
    .map(
      (l) => `
      <li>
        <a href="#/lang/${l.id}" class="lang-item ${l.id === activeId ? "is-active" : ""}" data-id="${l.id}">
          <span class="lang-dot" style="background:${langColor(l.name)}"></span>
          <span class="lang-item__name">${esc(l.name)}</span>
        </a>
      </li>`
    )
    .join("");
}

function highlightNav() {
  const route = currentRoute();
  document.querySelectorAll(".nav-link").forEach((a) => {
    a.classList.toggle("is-active", a.dataset.route === route[0]);
  });
}

// ---------------- Add / delete language ----------------
function showAddLanguageModal() {
  const modal = openModal(
    `
    <h3 class="modal__title">Yeni dil ekle</h3>
    <form id="form-add-lang">
      <label class="field">
        <span>Dil adı</span>
        <input type="text" name="name" placeholder="Örn. İngilizce" required autofocus />
      </label>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" id="cancel-add-lang">Vazgeç</button>
        <button type="submit" class="btn btn--primary">Ekle</button>
      </div>
    </form>
  `,
    (m) => {
      m.querySelector("#cancel-add-lang").addEventListener("click", closeModal);
      m.querySelector("#form-add-lang").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = new FormData(e.target).get("name").toString().trim();
        if (!name) return;
        try {
          await addLanguage(name);
          closeModal();
          toast(`"${name}" eklendi.`, "success");
        } catch (err) {
          toast("Dil eklenemedi: " + err.message, "error");
        }
      });
    }
  );
}

function confirmDeleteLanguage(lang) {
  openModal(
    `
    <h3 class="modal__title">Dili sil</h3>
    <p class="modal__text">"${esc(lang.name)}" dilini ve içindeki tüm kelimeleri silmek istediğine emin misin? Bu işlem geri alınamaz.</p>
    <div class="modal__actions">
      <button type="button" class="btn btn--ghost" id="cancel-del">Vazgeç</button>
      <button type="button" class="btn btn--danger" id="confirm-del">Sil</button>
    </div>
  `,
    (m) => {
      m.querySelector("#cancel-del").addEventListener("click", closeModal);
      m.querySelector("#confirm-del").addEventListener("click", async () => {
        try {
          await deleteLanguage(lang.id);
          closeModal();
          toast("Dil silindi.", "success");
          location.hash = "#/";
        } catch (err) {
          toast("Silinemedi: " + err.message, "error");
        }
      });
    }
  );
}

// ---------------- Home view ----------------
function renderHome() {
  const main = document.getElementById("main");
  if (state.languages.length === 0) {
    main.innerHTML = `
      <div class="empty-hero">
        <div class="empty-hero__card">A</div>
        <h1>Kelime defterine hoş geldin</h1>
        <p>Başlamak için sol menüden bir dil ekle. Sonra o dile girip denk geldiğin kelimeleri, anlamlarını ve örnek cümlelerini kaydet.</p>
        <button class="btn btn--primary" id="hero-add-lang">+ İlk dilini ekle</button>
      </div>
    `;
    document.getElementById("hero-add-lang").addEventListener("click", showAddLanguageModal);
    return;
  }
  main.innerHTML = `
    <div class="page-head">
      <h1>Dillerin</h1>
      <p class="page-sub">Bir dile git, kelime eklemeye başla.</p>
    </div>
    <div class="lang-grid">
      ${state.languages
        .map(
          (l) => `
        <a href="#/lang/${l.id}" class="lang-card" style="--accent:${langColor(l.name)}">
          <span class="lang-card__dot"></span>
          <span class="lang-card__name">${esc(l.name)}</span>
          <span class="lang-card__go">Kelimelere git →</span>
        </a>`
        )
        .join("")}
    </div>
  `;
}

// ---------------- Language detail view ----------------
function renderLangDetail(langId) {
  const main = document.getElementById("main");
  const lang = state.languages.find((l) => l.id === langId);
  if (!lang) {
    main.innerHTML = `<div class="page-head"><h1>Dil bulunamadı</h1></div>`;
    return;
  }

  main.innerHTML = `
    <div class="page-head page-head--row">
      <div>
        <div class="eyebrow" style="color:${langColor(lang.name)}">${esc(lang.name)}</div>
        <h1>Kelimeler</h1>
      </div>
      <div class="page-head__actions">
        <button class="btn btn--ghost btn--danger-text" id="btn-del-lang">Dili sil</button>
        <button class="fab" id="btn-add-word" title="Kelime ekle" aria-label="Kelime ekle">+</button>
      </div>
    </div>
    <div id="word-list" class="word-list">
      <p class="muted">Yükleniyor…</p>
    </div>
  `;

  document.getElementById("btn-add-word").addEventListener("click", () => showWordModal(langId));
  document.getElementById("btn-del-lang").addEventListener("click", () => confirmDeleteLanguage(lang));

  if (unsubWords) unsubWords();
  unsubWords = listenWords(langId, (words) => {
    state.words = words;
    renderWordList(langId, words);
  });
}

function renderWordList(langId, words) {
  const container = document.getElementById("word-list");
  if (!container) return;
  if (words.length === 0) {
    container.innerHTML = `<p class="muted">Henüz kelime yok. Sağ üstteki + butonuyla ekle.</p>`;
    return;
  }
  container.innerHTML = words
    .map(
      (w) => `
    <article class="word-card" data-id="${w.id}">
      <div class="word-card__top">
        <h3>${esc(w.word)}</h3>
        <div class="word-card__actions">
          <button class="icon-btn" data-edit="${w.id}" title="Düzenle" aria-label="Düzenle">✎</button>
          <button class="icon-btn" data-del="${w.id}" title="Sil" aria-label="Sil">✕</button>
        </div>
      </div>
      <p class="word-card__meaning">${esc(w.meaning) || '<span class="muted">Anlam eklenmemiş</span>'}</p>
      ${w.example ? `<p class="word-card__example">${esc(w.example)}</p>` : ""}
    </article>
  `
    )
    .join("");

  container.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const w = words.find((x) => x.id === btn.dataset.edit);
      showWordModal(langId, w);
    })
  );
  container.querySelectorAll("[data-del]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const w = words.find((x) => x.id === btn.dataset.del);
      confirmDeleteWord(langId, w);
    })
  );
}

function confirmDeleteWord(langId, word) {
  openModal(
    `
    <h3 class="modal__title">Kelimeyi sil</h3>
    <p class="modal__text">"${esc(word.word)}" kelimesini silmek istediğine emin misin?</p>
    <div class="modal__actions">
      <button type="button" class="btn btn--ghost" id="cancel-del-w">Vazgeç</button>
      <button type="button" class="btn btn--danger" id="confirm-del-w">Sil</button>
    </div>
  `,
    (m) => {
      m.querySelector("#cancel-del-w").addEventListener("click", closeModal);
      m.querySelector("#confirm-del-w").addEventListener("click", async () => {
        try {
          await deleteWord(langId, word.id);
          closeModal();
        } catch (err) {
          toast("Silinemedi: " + err.message, "error");
        }
      });
    }
  );
}

// ---------------- Add / edit word modal ----------------
function showWordModal(langId, existing = null) {
  const lang = state.languages.find((l) => l.id === langId);
  const isEdit = !!existing;

  const modal = openModal(
    `
    <h3 class="modal__title">${isEdit ? "Kelimeyi düzenle" : "Yeni kelime ekle"}</h3>
    <form id="form-word">
      <label class="field">
        <span>Kelime / ifade</span>
        <input type="text" name="word" required autofocus value="${isEdit ? esc(existing.word) : ""}" />
      </label>

      <label class="field">
        <span>Anlamı (Türkçe)</span>
        <div class="field__row">
          <input type="text" name="meaning" value="${isEdit ? esc(existing.meaning) : ""}" placeholder="Manuel yaz…" />
          <button type="button" class="btn btn--ai" id="btn-ai-meaning">AI ile çevir</button>
        </div>
      </label>

      <label class="field">
        <span>Kullanım örneği</span>
        <div class="field__row field__row--textarea">
          <textarea name="example" rows="3" placeholder="Manuel yaz…">${isEdit ? esc(existing.example) : ""}</textarea>
          <button type="button" class="btn btn--ai" id="btn-ai-example">AI ile oluştur</button>
        </div>
      </label>

      <p class="modal__hint" id="word-modal-hint"></p>

      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" id="cancel-word">Vazgeç</button>
        <button type="submit" class="btn btn--primary">${isEdit ? "Kaydet" : "Ekle"}</button>
      </div>
    </form>
  `,
    (m) => {
      const wordInput = m.querySelector('[name="word"]');
      const meaningInput = m.querySelector('[name="meaning"]');
      const exampleInput = m.querySelector('[name="example"]');
      const hint = m.querySelector("#word-modal-hint");

      m.querySelector("#cancel-word").addEventListener("click", closeModal);

      m.querySelector("#btn-ai-meaning").addEventListener("click", async () => {
        const word = wordInput.value.trim();
        if (!word) return toast("Önce bir kelime yaz.", "error");
        if (!hasGeminiKey()) return toast("Önce Ayarlar'dan Gemini API anahtarını ekle.", "error");
        hint.textContent = "Çevriliyor…";
        try {
          const result = await aiTranslate(word, lang.name);
          meaningInput.value = result;
          hint.textContent = "";
        } catch (err) {
          hint.textContent = "";
          toast(err.message, "error");
        }
      });

      m.querySelector("#btn-ai-example").addEventListener("click", async () => {
        const word = wordInput.value.trim();
        if (!word) return toast("Önce bir kelime yaz.", "error");
        if (!hasGeminiKey()) return toast("Önce Ayarlar'dan Gemini API anahtarını ekle.", "error");
        hint.textContent = "Örnek cümle oluşturuluyor…";
        try {
          const result = await aiExample(word, meaningInput.value.trim(), lang.name);
          exampleInput.value = result;
          hint.textContent = "";
        } catch (err) {
          hint.textContent = "";
          toast(err.message, "error");
        }
      });

      m.querySelector("#form-word").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = {
          word: fd.get("word").toString(),
          meaning: fd.get("meaning").toString(),
          example: fd.get("example").toString()
        };
        try {
          if (isEdit) {
            await updateWord(langId, existing.id, payload);
          } else {
            await addWord(langId, payload);
          }
          closeModal();
        } catch (err) {
          toast("Kaydedilemedi: " + err.message, "error");
        }
      });
    }
  );
}

// ---------------- Quiz views ----------------
function renderQuizHome() {
  const main = document.getElementById("main");
  if (state.languages.length === 0) {
    main.innerHTML = `<div class="page-head"><h1>Quiz</h1><p class="page-sub">Quiz yapmak için önce bir dil ve birkaç kelime ekle.</p></div>`;
    return;
  }
  main.innerHTML = `
    <div class="page-head">
      <h1>Quiz</h1>
      <p class="page-sub">Hangi dilden quiz yapmak istersin?</p>
    </div>
    <div class="lang-grid">
      ${state.languages
        .map(
          (l) => `
        <a href="#/quiz/${l.id}" class="lang-card" style="--accent:${langColor(l.name)}">
          <span class="lang-card__dot"></span>
          <span class="lang-card__name">${esc(l.name)}</span>
          <span class="lang-card__go">Quize başla →</span>
        </a>`
        )
        .join("")}
    </div>
  `;
}

async function renderQuizStart(langId) {
  const main = document.getElementById("main");
  const lang = state.languages.find((l) => l.id === langId);
  main.innerHTML = `<div class="page-head"><h1>Quiz hazırlanıyor…</h1></div>`;

  let words;
  try {
    words = await getWordsOnce(langId);
  } catch (err) {
    main.innerHTML = `<div class="page-head"><h1>Bir hata oldu</h1><p class="page-sub">${esc(err.message)}</p></div>`;
    return;
  }

  const usable = words.filter((w) => w.meaning && w.meaning.trim());
  if (usable.length < 2) {
    main.innerHTML = `
      <div class="page-head"><h1>${esc(lang?.name || "")} için yeterli kelime yok</h1>
      <p class="page-sub">Quiz yapabilmek için en az 2 kelimenin anlamı dolu olmalı.</p></div>
    `;
    return;
  }

  const shuffled = [...usable].sort(() => Math.random() - 0.5);
  state.quiz = { langId, langName: lang?.name || "", items: shuffled, index: 0, score: 0, allMeanings: usable.map((w) => w.meaning) };
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const main = document.getElementById("main");
  const q = state.quiz;
  if (q.index >= q.items.length) return renderQuizResult();

  const current = q.items[q.index];
  const distractors = q.allMeanings.filter((m) => m !== current.meaning);
  const shuffledDistractors = distractors.sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [current.meaning, ...shuffledDistractors].sort(() => Math.random() - 0.5);

  main.innerHTML = `
    <div class="page-head">
      <div class="eyebrow" style="color:${langColor(q.langName)}">${esc(q.langName)}</div>
      <h1>Soru ${q.index + 1} / ${q.items.length}</h1>
    </div>
    <div class="quiz-card">
      <p class="quiz-card__label">Bu kelimenin anlamı nedir?</p>
      <h2 class="quiz-card__word">${esc(current.word)}</h2>
      <div class="quiz-options">
        ${options
          .map((opt) => `<button class="quiz-option" data-opt="${esc(opt)}">${esc(opt)}</button>`)
          .join("")}
      </div>
      <p class="quiz-score">Skor: ${q.score} / ${q.index}</p>
    </div>
  `;

  main.querySelectorAll(".quiz-option").forEach((btn) => {
    btn.addEventListener("click", () => handleQuizAnswer(btn, current, current.meaning));
  });
}

function handleQuizAnswer(btn, wordItem, correctMeaning) {
  const q = state.quiz;
  const chosen = btn.dataset.opt;
  const isCorrect = chosen === correctMeaning;
  document.querySelectorAll(".quiz-option").forEach((b) => {
    b.disabled = true;
    if (b.dataset.opt === correctMeaning) b.classList.add("is-correct");
    else if (b === btn) b.classList.add("is-wrong");
  });
  if (isCorrect) q.score++;
  recordQuizResult(q.langId, wordItem.id, isCorrect).catch(() => {});
  setTimeout(() => {
    q.index++;
    renderQuizQuestion();
  }, 800);
}

function renderQuizResult() {
  const main = document.getElementById("main");
  const q = state.quiz;
  const pct = Math.round((q.score / q.items.length) * 100);
  main.innerHTML = `
    <div class="page-head">
      <div class="eyebrow" style="color:${langColor(q.langName)}">${esc(q.langName)}</div>
      <h1>Quiz bitti</h1>
    </div>
    <div class="quiz-result">
      <p class="quiz-result__score">${q.score} / ${q.items.length}</p>
      <p class="quiz-result__pct">%${pct} doğru</p>
      <div class="modal__actions">
        <a href="#/quiz/${q.langId}" class="btn btn--primary">Tekrar dene</a>
        <a href="#/quiz" class="btn btn--ghost">Başka dil seç</a>
      </div>
    </div>
  `;
}

// ---------------- Settings view ----------------
function renderSettings() {
  const main = document.getElementById("main");
  const uid = currentUid();
  const email = currentEmail() || "";
  main.innerHTML = `
    <div class="page-head">
      <h1>Ayarlar</h1>
      <p class="page-sub">Gemini API anahtarını buraya ekle. Bu anahtar sadece bu tarayıcıda saklanır, hiçbir yere gönderilmez.</p>
    </div>
    <form id="form-settings" class="settings-form">
      <label class="field">
        <span>Google AI Studio (Gemini) API anahtarı</span>
        <input type="password" name="key" value="${esc(getGeminiKey())}" placeholder="AIza…" />
      </label>
      <p class="muted">Anahtarı buradan alabilirsin: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></p>
      <div class="modal__actions modal__actions--start">
        <button type="submit" class="btn btn--primary">Kaydet</button>
      </div>
    </form>

    <div class="settings-uid">
      <h3>Hesap</h3>
      <p class="muted">Giriş yapılan e-posta: <strong>${esc(email)}</strong></p>
      <code class="uid-box">${uid ? esc(uid) : ""}</code>
      <div class="modal__actions modal__actions--start" style="margin-top:14px">
        <button type="button" class="btn btn--ghost" id="btn-logout">Çıkış yap</button>
      </div>
    </div>
  `;

  document.getElementById("form-settings").addEventListener("submit", (e) => {
    e.preventDefault();
    const key = new FormData(e.target).get("key").toString();
    setGeminiKey(key);
    toast("Kaydedildi.", "success");
  });

  document.getElementById("btn-logout").addEventListener("click", () => {
    logout().catch((err) => toast("Çıkış yapılamadı: " + err.message, "error"));
  });
}

// ---------------- Login view ----------------
function renderLogin() {
  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="brand brand--center">
          <span class="brand__mark">V</span>
          <span class="brand__name">Kelime Defteri</span>
        </div>
        <p class="login-sub">Devam etmek için giriş yap.</p>
        <form id="form-login">
          <label class="field">
            <span>E-posta</span>
            <input type="email" name="email" required autofocus placeholder="ornek@eposta.com" />
          </label>
          <label class="field">
            <span>Şifre</span>
            <input type="password" name="password" required placeholder="••••••••" />
          </label>
          <p class="modal__hint" id="login-hint"></p>
          <button type="submit" class="btn btn--primary login-btn">Giriş yap</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById("form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const hint = document.getElementById("login-hint");
    hint.textContent = "Giriş yapılıyor…";
    try {
      await login(fd.get("email").toString(), fd.get("password").toString());
    } catch (err) {
      hint.textContent = "Giriş başarısız: e-posta veya şifre hatalı.";
    }
  });
}

// ---------------- Router ----------------
function render() {
  renderSidebarLangs();
  highlightNav();
  const route = currentRoute();

  if (unsubWords && route[0] !== "lang") {
    unsubWords();
    unsubWords = null;
  }

  if (route.length === 0) {
    renderHome();
  } else if (route[0] === "lang" && route[1]) {
    renderLangDetail(route[1]);
  } else if (route[0] === "quiz" && route[1]) {
    renderQuizStart(route[1]);
  } else if (route[0] === "quiz") {
    renderQuizHome();
  } else if (route[0] === "settings") {
    renderSettings();
  } else {
    renderHome();
  }
}

window.addEventListener("hashchange", render);

// ---------------- Boot ----------------
let unsubLanguages = null;
let appStarted = false;

function teardown() {
  if (unsubWords) { unsubWords(); unsubWords = null; }
  if (unsubLanguages) { unsubLanguages(); unsubLanguages = null; }
  state.languages = [];
  state.words = [];
  state.quiz = null;
  appStarted = false;
}

function startApp() {
  if (appStarted) return;
  appStarted = true;
  renderShell();
  document.getElementById("main").innerHTML = `<p class="muted" style="padding:32px">Yükleniyor…</p>`;

  unsubLanguages = listenLanguages((langs) => {
    state.languages = langs;
    renderSidebarLangs();
    if (!document.getElementById("main").dataset.booted) {
      document.getElementById("main").dataset.booted = "1";
      render();
    } else if (currentRoute().length === 0 || (currentRoute()[0] === "quiz" && !currentRoute()[1])) {
      if (currentRoute().length === 0) renderHome();
      else renderQuizHome();
    }
  });
}

function boot() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  onAuthChange((user) => {
    if (user) {
      startApp();
    } else {
      teardown();
      renderLogin();
    }
  });
}

boot();

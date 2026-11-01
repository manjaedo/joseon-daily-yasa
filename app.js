// 오늘의 조선 야사 — 미니멀 리더 버전 (v6)

const state = {
  currentDate: new Date(),
  category: 'all',
  theme: localStorage.getItem('joseon_theme') || 'light'
};

const elMonthDay = document.getElementById('displayMonthDay');
const elDatePicker = document.getElementById('datePicker');
const elContainer = document.getElementById('storiesContainer');

function init() {
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {});
  }

  applyTheme(state.theme);
  syncDateInput();
  render();
  bindEvents();
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('joseon_theme', theme);
  const btn = document.getElementById('btnToggleTheme');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function syncDateInput() {
  const y = state.currentDate.getFullYear();
  const m = String(state.currentDate.getMonth() + 1).padStart(2, '0');
  const d = String(state.currentDate.getDate()).padStart(2, '0');
  if (elDatePicker) elDatePicker.value = `${y}-${m}-${d}`;
}

function render() {
  const month = state.currentDate.getMonth() + 1;
  const day = state.currentDate.getDate();

  let stories = [];
  if (state.category === 'legends') {
    elMonthDay.textContent = '명장면 모음';
    stories = getAllLegendStories();
  } else {
    elMonthDay.textContent = `${month}월 ${day}일`;
    stories = getStoriesForDate(month, day);
    if (state.category !== 'all') {
      stories = stories.filter(s => s.category === state.category);
    }
  }

  if (!stories.length) {
    elContainer.innerHTML = `<p style="padding:40px 0; text-align:center; color:var(--sub);">해당 주제의 기록이 없습니다.</p>`;
    return;
  }

  elContainer.innerHTML = stories.map(s => {
    const cat = CATEGORIES[s.category] || CATEGORIES.mystery;
    return `
      <article class="story-item">
        <div class="story-meta">${s.month}월 ${s.day}일 · ${s.king} (${s.year}년) · ${cat.shortLabel}</div>
        <h2 class="story-title">${s.title}</h2>
        <div class="story-body">${s.yasaStory}</div>
        <div class="sillok-quote">
          <strong>실록 기록 (${s.source})</strong>
          "${s.officialRecord}"
        </div>
      </article>
    `;
  }).join('');
}

async function sendTodayBestAlert() {
  const month = state.currentDate.getMonth() + 1;
  const day = state.currentDate.getDate();
  const stories = getStoriesForDate(month, day);
  const best = stories[0];
  if (!best) return;

  showToast(`🔔 [${month}월 ${day}일 야사] 「${best.title}」 알림을 전송했습니다.`);

  try {
    const res = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month: best.month,
        day: best.day,
        king: best.king,
        year: best.year,
        interestScore: best.interestScore,
        title: best.title,
        summary: best.summary,
        officialRecord: best.officialRecord
      })
    });
    if (res.ok) return;
  } catch (e) {}

  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      new Notification(`[오늘의 조선 야사] ${month}월 ${day}일`, {
        body: `${best.title}\n(${best.king}, ${best.year}년)`
      });
    }
  }
}

function showToast(msg) {
  const toast = document.getElementById('simpleToast');
  const text = document.getElementById('toastMessage');
  if (!toast || !text) return;
  text.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

function bindEvents() {
  document.getElementById('btnHome').addEventListener('click', () => {
    state.currentDate = new Date();
    state.category = 'all';
    document.querySelectorAll('.cat-link').forEach(b => b.classList.toggle('active', b.dataset.cat === 'all'));
    syncDateInput();
    render();
  });

  document.getElementById('btnToggleTheme').addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  document.getElementById('btnSendTelegram').addEventListener('click', sendTodayBestAlert);

  document.getElementById('btnPrevDay').addEventListener('click', () => {
    if (state.category === 'legends') state.category = 'all';
    state.currentDate.setDate(state.currentDate.getDate() - 1);
    syncDateInput();
    render();
  });

  document.getElementById('btnNextDay').addEventListener('click', () => {
    if (state.category === 'legends') state.category = 'all';
    state.currentDate.setDate(state.currentDate.getDate() + 1);
    syncDateInput();
    render();
  });

  document.getElementById('btnToday').addEventListener('click', () => {
    state.category = 'all';
    document.querySelectorAll('.cat-link').forEach(b => b.classList.toggle('active', b.dataset.cat === 'all'));
    state.currentDate = new Date();
    syncDateInput();
    render();
  });

  document.getElementById('btnRandomDate').addEventListener('click', () => {
    const keys = Object.keys(CURATED_STORIES);
    const pick = keys[Math.floor(Math.random() * keys.length)];
    const [m, d] = pick.split('-').map(Number);
    state.category = 'all';
    document.querySelectorAll('.cat-link').forEach(b => b.classList.toggle('active', b.dataset.cat === 'all'));
    state.currentDate = new Date(2026, m - 1, d);
    syncDateInput();
    render();
  });

  document.getElementById('btnOpenDatePicker').addEventListener('click', () => {
    if (typeof elDatePicker.showPicker === 'function') {
      try { elDatePicker.showPicker(); return; } catch (e) {}
    }
    elDatePicker.click();
  });

  elDatePicker.addEventListener('change', (e) => {
    if (!e.target.value) return;
    const [y, m, d] = e.target.value.split('-').map(Number);
    if (state.category === 'legends') state.category = 'all';
    state.currentDate = new Date(y, m - 1, d);
    syncDateInput();
    render();
  });

  document.getElementById('categoryBar').addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-link');
    if (!btn) return;
    document.querySelectorAll('.cat-link').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.category = btn.dataset.cat;
    render();
  });

  document.getElementById('btnCloseToast').addEventListener('click', () => {
    document.getElementById('simpleToast').classList.remove('show');
  });
}

document.addEventListener('DOMContentLoaded', init);

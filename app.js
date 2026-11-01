// 오늘의 조선 야사록 (朝鮮野史錄) 메인 애플리케이션 로직 (초슬림 상단 & 본문 중심 UI)

const state = {
  currentDate: new Date(),
  selectedCategory: 'all',
  interestingOnly: false,
  searchQuery: '',
  theme: localStorage.getItem('joseon_theme') || 'light',
  bookmarks: JSON.parse(localStorage.getItem('joseon_bookmarks') || '[]'),
  alertConfig: JSON.parse(localStorage.getItem('joseon_alert_config') || JSON.stringify({
    minScore: 92,
    categories: ['mystery', 'scandal', 'folklore', 'episode']
  })),
  currentToastStoryId: null
};

// DOM 참조
const elMonthDay = document.getElementById('displayMonthDay');
const elSubEra = document.getElementById('displaySubEra');
const elHeroBrief = document.getElementById('heroBriefText');
const elDatePicker = document.getElementById('datePicker');
const elStoriesContainer = document.getElementById('storiesContainer');
const elCategoryTabs = document.getElementById('categoryTabs');
const elChkInteresting = document.getElementById('chkInterestingOnly');
const elThresholdLabel = document.getElementById('thresholdLabel');
const elSearchInput = document.getElementById('searchInput');
const elBookmarkCount = document.getElementById('bookmarkCount');
const elAlertBadgeCount = document.getElementById('alertBadgeCount');
const elLegendSelect = document.getElementById('legendQuickSelect');

function initApp() {
  registerServiceWorker();
  applyTheme(state.theme);
  updateAlertConfigUI();
  updateBookmarkBadge();
  syncDateToInput(state.currentDate);
  renderCurrentView();
  startSundialClock();
  bindEvents();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('joseon_theme', theme);
  const btn = document.getElementById('btnToggleTheme');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

function syncDateToInput(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  if (elDatePicker) {
    elDatePicker.value = `${yyyy}-${mm}-${dd}`;
  }
  if (elLegendSelect) {
    const mmdd = `${mm}-${dd}`;
    const hasOpt = Array.from(elLegendSelect.options).some(o => o.value === mmdd);
    elLegendSelect.value = hasOpt ? mmdd : '';
  }
}

function startSundialClock() {
  function tick() {
    const now = new Date();
    const h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    const hh = String(h).padStart(2, '0');
    const zodiac = getJoseonHour(h);
    const pill = document.getElementById('zodiacMiniPill');
    if (pill) {
      pill.textContent = `${zodiac.animal.split(' ')[0]} ${zodiac.name.split('(')[0]} (${hh}:${m})`;
      pill.title = `${zodiac.name}: ${zodiac.desc}`;
    }
  }
  tick();
  setInterval(tick, 10000);
}

function getJoseonHour(hour) {
  if (hour === 23 || hour === 0) return JOSEON_HOURS[0];
  if (hour >= 1 && hour < 3) return JOSEON_HOURS[1];
  if (hour >= 3 && hour < 5) return JOSEON_HOURS[2];
  if (hour >= 5 && hour < 7) return JOSEON_HOURS[3];
  if (hour >= 7 && hour < 9) return JOSEON_HOURS[4];
  if (hour >= 9 && hour < 11) return JOSEON_HOURS[5];
  if (hour >= 11 && hour < 13) return JOSEON_HOURS[6];
  if (hour >= 13 && hour < 15) return JOSEON_HOURS[7];
  if (hour >= 15 && hour < 17) return JOSEON_HOURS[8];
  if (hour >= 17 && hour < 19) return JOSEON_HOURS[9];
  if (hour >= 19 && hour < 21) return JOSEON_HOURS[10];
  return JOSEON_HOURS[11];
}

function renderCurrentView() {
  const month = state.currentDate.getMonth() + 1;
  const day = state.currentDate.getDate();

  let stories = [];
  if (state.selectedCategory === 'legends') {
    stories = getAllLegendStories();
    elMonthDay.textContent = `역대 레전드`;
    if (elSubEra) elSubEra.textContent = `500년 야사 TOP`;
    elHeroBrief.innerHTML = `🏆 <strong>역대 레전드 야사 모아보기</strong> — 실록과 야담집(《어우야담》·《대동야승》)에서 가장 흥미도가 높은 사건 순입니다.`;
  } else {
    stories = getStoriesForDate(month, day);
    elMonthDay.textContent = `${month}월 ${day}일`;
    const kings = [...new Set(stories.map(s => s.king.split(' ')[0]))].slice(0, 3).join('·');
    if (elSubEra) elSubEra.textContent = `(${kings} 대)`;

    if (month === 11 && day === 2) {
      elHeroBrief.innerHTML = `📜 <strong>양력 11월 2일(오늘)</strong> — 1434년 혜정교 '앙부일구' 최초 설치 비화 & 초겨울 밤하늘 비행체·창덕궁 괴수 소동 등 <strong>${stories.length}편</strong>`;
    } else {
      const topStory = stories[0];
      elHeroBrief.innerHTML = `📜 <strong>양력 ${month}월 ${day}일의 조선 야사</strong> — 대표작: 「${topStory ? topStory.title : ''}」 외 총 <strong>${stories.length}편</strong>`;
    }
  }

  if (state.selectedCategory !== 'all' && state.selectedCategory !== 'legends') {
    stories = stories.filter(s => s.category === state.selectedCategory);
  }

  if (state.interestingOnly) {
    stories = stories.filter(s => s.interestScore >= state.alertConfig.minScore);
  }

  if (state.searchQuery.trim() !== '') {
    const q = state.searchQuery.trim().toLowerCase();
    stories = stories.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.subtitle.toLowerCase().includes(q) ||
      s.king.toLowerCase().includes(q) ||
      s.yasaStory.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  updateMobileBottomNavState();
  renderStoryCards(stories);
}

function updateMobileBottomNavState() {
  const mToday = document.getElementById('mNavToday');
  const mLegends = document.getElementById('mNavLegends');
  const mHotOnly = document.getElementById('mNavHotOnly');
  if (mToday) mToday.classList.toggle('active', state.selectedCategory !== 'legends');
  if (mLegends) mLegends.classList.toggle('active', state.selectedCategory === 'legends');
  if (mHotOnly) mHotOnly.classList.toggle('active', state.interestingOnly);
}

function renderStoryCards(stories) {
  if (!stories || stories.length === 0) {
    elStoriesContainer.innerHTML = `
      <div class="empty-state">
        <h3 style="font-family:'Noto Serif KR',serif; margin-bottom:6px;">조건에 맞는 야사 기록이 없습니다</h3>
        <p style="font-size:0.86rem;">필터 기준을 낮추거나 다른 카테고리·검색어를 선택해 보세요.</p>
      </div>
    `;
    return;
  }

  elStoriesContainer.innerHTML = stories.map(story => {
    const catInfo = CATEGORIES[story.category] || CATEGORIES.mystery;
    const isBookmarked = state.bookmarks.some(b => b.id === story.id);
    const stars = story.interestScore >= 96 ? '★★★★★' : story.interestScore >= 92 ? '★★★★☆' : '★★★★';

    return `
      <article class="story-card ${story.interestScore >= 94 ? 'hot-story' : ''}" id="story-${story.id}">
        <div class="story-meta-top">
          <div class="meta-badges">
            <span class="badge ${catInfo.badgeClass}">${catInfo.icon} ${catInfo.label}</span>
            <span class="king-era-badge">📜 ${story.king} (${story.year}년) · ${story.lunarDate}</span>
            <span class="king-era-badge" style="color:var(--text-secondary); font-weight:500;">${story.source}</span>
          </div>
          <span class="interest-meter">
            🔥 흥미도 ${story.interestScore}점 (${stars})
          </span>
        </div>

        <h2 class="story-title">${story.title}</h2>
        <p class="story-subtitle">${story.subtitle}</p>

        <div class="story-summary-box">
          <strong>💡 핵심 요약:</strong> ${story.summary}
        </div>

        <div class="record-comparison">
          <div class="official-record-box">
            <div class="record-box-header">
              <span class="record-label" style="color:var(--indigo);">🏛️ 정사(正史) — 실록 원문 기록</span>
              <span style="font-size:0.72rem; color:var(--text-muted);">춘추관 사초</span>
            </div>
            <p class="record-text">"${story.officialRecord}"</p>
          </div>

          <div class="yasa-record-box">
            <div class="record-box-header">
              <span class="record-label" style="color:var(--crimson);">🦊 야사(野史) — 행간에 숨겨진 비화와 전말</span>
              <span style="font-size:0.72rem; color:var(--gold); font-weight:700;">야담·비기 완역</span>
            </div>
            <div class="record-text">${story.yasaStory}</div>
          </div>
        </div>

        <div class="historian-secret-note">
          <span>🖌️</span>
          <div>${story.historianNote}</div>
        </div>

        <div class="story-footer">
          <div class="story-tags">
            ${story.tags.map(t => `<span class="tag-item">#${t}</span>`).join('')}
          </div>
          <div class="story-actions" style="flex-wrap:wrap;">
            <button class="btn" onclick="toggleBookmark('${story.id}')">
              ${isBookmarked ? '🔖 갈피됨' : '☆ 갈피'}
            </button>
            <button class="btn" onclick="sendStoryToTelegram('${story.id}')">
              ✈️ 텔레그램 전송
            </button>
            <button class="btn" onclick="copyStorySummary('${story.id}')">
              📤 공유·복사
            </button>
            <a class="btn" href="${story.sillokUrl}" target="_blank" rel="noopener">
              🔍 실록 원문 ↗
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function triggerBestStoryAlert(withBrowserNotification = true) {
  const month = state.currentDate.getMonth() + 1;
  const day = state.currentDate.getDate();
  const stories = getStoriesForDate(month, day);

  const candidates = stories.filter(s =>
    s.interestScore >= state.alertConfig.minScore &&
    state.alertConfig.categories.includes(s.category)
  );

  const chosen = candidates.length > 0 ? candidates[0] : stories[0];
  if (!chosen) return;

  state.currentToastStoryId = chosen.id;
  const catInfo = CATEGORIES[chosen.category] || CATEGORIES.mystery;

  document.getElementById('toastBadge').textContent = `🐎 파발마 특급 야사! (${month}월 ${day}일 · 흥미도 ${chosen.interestScore}점)`;
  document.getElementById('toastTitle').textContent = `[${catInfo.shortLabel}] ${chosen.title}`;
  document.getElementById('toastDesc').textContent = `${chosen.king} (${chosen.year}년) — ${chosen.summary.slice(0, 68)}...`;

  const toastEl = document.getElementById('pabalmaToast');
  toastEl.classList.add('show');

  if (withBrowserNotification) {
    playPabalmaChime();
    sendBrowserNotification(chosen, month, day);
  }
}

function playPabalmaChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(528, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  } catch (e) {}
}

function sendBrowserNotification(story, month, day) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(`🐎 [오늘의 조선 야사록] ${month}월 ${day}일 특급 야사 (${story.interestScore}점)`, {
      body: `${story.title}\n— ${story.king} (${story.year}년): ${story.subtitle}`,
      tag: 'joseon-yasa-daily'
    });
  }
}

window.sendStoryToTelegram = async function(storyId) {
  const month = state.currentDate.getMonth() + 1;
  const day = state.currentDate.getDate();
  const pool = [...getStoriesForDate(month, day), ...getAllLegendStories()];
  const target = storyId ? pool.find(s => s.id === storyId) : pool[0];
  if (!target) return;

  const statusEl = document.getElementById('telegramSendStatus');
  if (statusEl) statusEl.textContent = '🐎 파발마가 텔레그램으로 달려가는 중...';

  try {
    const res = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month: target.month,
        day: target.day,
        king: target.king,
        year: target.year,
        interestScore: target.interestScore,
        title: target.title,
        summary: target.summary,
        officialRecord: target.officialRecord
      })
    });
    if (res.ok) {
      if (statusEl) statusEl.textContent = '✅ 스마트폰 텔레그램 방으로 발송 완료!';
      alert('✈️ 스마트폰 텔레그램 방으로 야사 카드가 전송되었습니다!');
      return;
    }
  } catch (err) {}

  const shareText = `📜 [오늘의 조선 야사록 - ${target.month}월 ${target.day}일]\n👑 ${target.king} (${target.year}년) | 🔥 흥미도 ${target.interestScore}점\n\n「${target.title}」\n${target.summary}`;
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent('https://manjaedo.github.io/joseon-daily-yasa/')}&text=${encodeURIComponent(shareText)}`;
  window.open(tgUrl, '_blank');
};

window.toggleBookmark = function(storyId) {
  const month = state.currentDate.getMonth() + 1;
  const day = state.currentDate.getDate();
  const pool = [...getStoriesForDate(month, day), ...getAllLegendStories()];
  const target = pool.find(s => s.id === storyId);
  if (!target) return;

  const idx = state.bookmarks.findIndex(b => b.id === storyId);
  if (idx >= 0) {
    state.bookmarks.splice(idx, 1);
  } else {
    state.bookmarks.unshift({
      id: target.id,
      title: target.title,
      king: target.king,
      year: target.year,
      month: target.month,
      day: target.day,
      interestScore: target.interestScore,
      summary: target.summary
    });
  }
  localStorage.setItem('joseon_bookmarks', JSON.stringify(state.bookmarks));
  updateBookmarkBadge();
  renderCurrentView();
  renderBookmarkModalList();
};

window.copyStorySummary = function(storyId) {
  const month = state.currentDate.getMonth() + 1;
  const day = state.currentDate.getDate();
  const pool = [...getStoriesForDate(month, day), ...getAllLegendStories()];
  const target = pool.find(s => s.id === storyId);
  if (!target) return;

  const text = `📜 [오늘의 조선 야사록 - ${target.month}월 ${target.day}일]\n👑 ${target.king} (${target.year}년) | 🔥 흥미도 ${target.interestScore}점\n\n「${target.title}」\n${target.summary}\n\n🏛️ 실록 기록: "${target.officialRecord}"\n🔗 모바일 열람: https://manjaedo.github.io/joseon-daily-yasa/`;

  if (navigator.share) {
    navigator.share({
      title: `[오늘의 조선 야사록] ${target.title}`,
      text,
      url: 'https://manjaedo.github.io/joseon-daily-yasa/'
    }).catch(() => {});
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    alert('📜 야사 요약 카드가 클립보드에 복사되었습니다!');
  });
};

function updateBookmarkBadge() {
  if (elBookmarkCount) {
    elBookmarkCount.textContent = state.bookmarks.length;
  }
}

function renderBookmarkModalList() {
  const container = document.getElementById('bookmarkListContainer');
  if (!container) return;

  if (state.bookmarks.length === 0) {
    container.innerHTML = `<p style="color:var(--text-secondary); text-align:center; padding:20px 0;">아직 갈피에 저장된 야사가 없습니다.</p>`;
    return;
  }

  container.innerHTML = state.bookmarks.map(b => `
    <div style="padding:12px; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-primary);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-size:0.75rem; font-weight:700; color:var(--crimson);">${b.month}월 ${b.day}일 · ${b.king} · 흥미도 ${b.interestScore}점</span>
        <button class="btn" style="padding:2px 7px; font-size:0.72rem;" onclick="toggleBookmark('${b.id}')">삭제</button>
      </div>
      <div style="font-family:'Noto Serif KR',serif; font-weight:700; margin-bottom:4px; cursor:pointer;" onclick="jumpToBookmarkDate(${b.month}, ${b.day})">
        ${b.title} ↗
      </div>
      <p style="font-size:0.8rem; color:var(--text-secondary);">${b.summary}</p>
    </div>
  `).join('');
}

window.jumpToBookmarkDate = function(month, day) {
  document.getElementById('bookmarkModal').classList.remove('open');
  state.selectedCategory = 'all';
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === 'all'));
  state.currentDate = new Date(2026, month - 1, day);
  syncDateToInput(state.currentDate);
  renderCurrentView();
};

function updateAlertConfigUI() {
  const minScore = state.alertConfig.minScore;
  if (elThresholdLabel) elThresholdLabel.textContent = minScore;
  if (elAlertBadgeCount) elAlertBadgeCount.textContent = `${minScore}+`;
  const rangeInput = document.getElementById('rangeMinScore');
  const modalScoreVal = document.getElementById('modalScoreVal');
  if (rangeInput) rangeInput.value = minScore;
  if (modalScoreVal) modalScoreVal.textContent = `${minScore}점 이상`;

  document.querySelectorAll('.cat-alert-chk').forEach(chk => {
    chk.checked = state.alertConfig.categories.includes(chk.value);
  });

  updateBrowserPermText();
}

function updateBrowserPermText() {
  const statusEl = document.getElementById('permStatusText');
  if (!statusEl) return;
  if (!('Notification' in window)) {
    statusEl.textContent = '브라우저 알림 미지원 (인앱 파발마 작동)';
    return;
  }
  if (Notification.permission === 'granted') {
    statusEl.textContent = '✅ 알림 허용됨';
    statusEl.style.color = 'var(--jade)';
  } else if (Notification.permission === 'denied') {
    statusEl.textContent = '⚠️ 브라우저 알림 차단됨';
  } else {
    statusEl.textContent = '권한 미요청';
  }
}

function bindEvents() {
  document.getElementById('btnToggleTheme').addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  document.getElementById('btnPrevDay').addEventListener('click', () => {
    state.selectedCategory = state.selectedCategory === 'legends' ? 'all' : state.selectedCategory;
    state.currentDate.setDate(state.currentDate.getDate() - 1);
    syncDateToInput(state.currentDate);
    renderCurrentView();
  });

  document.getElementById('btnToday').addEventListener('click', () => {
    state.selectedCategory = 'all';
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === 'all'));
    state.currentDate = new Date();
    syncDateToInput(state.currentDate);
    renderCurrentView();
  });

  document.getElementById('btnNextDay').addEventListener('click', () => {
    state.selectedCategory = state.selectedCategory === 'legends' ? 'all' : state.selectedCategory;
    state.currentDate.setDate(state.currentDate.getDate() + 1);
    syncDateToInput(state.currentDate);
    renderCurrentView();
  });

  elDatePicker.addEventListener('change', (e) => {
    if (!e.target.value) return;
    const [y, m, d] = e.target.value.split('-').map(Number);
    state.currentDate = new Date(y, m - 1, d);
    if (state.selectedCategory === 'legends') {
      state.selectedCategory = 'all';
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === 'all'));
    }
    syncDateToInput(state.currentDate);
    renderCurrentView();
  });

  document.getElementById('btnRandomLegend').addEventListener('click', () => {
    const keys = Object.keys(CURATED_STORIES);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const [mm, dd] = randomKey.split('-').map(Number);
    state.selectedCategory = 'all';
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === 'all'));
    state.currentDate = new Date(2026, mm - 1, dd);
    syncDateToInput(state.currentDate);
    renderCurrentView();
  });

  if (elLegendSelect) {
    elLegendSelect.addEventListener('change', (e) => {
      if (!e.target.value) return;
      const [mm, dd] = e.target.value.split('-').map(Number);
      state.selectedCategory = 'all';
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === 'all'));
      state.currentDate = new Date(2026, mm - 1, dd);
      syncDateToInput(state.currentDate);
      renderCurrentView();
    });
  }

  elCategoryTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-tab');
    if (!btn) return;
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    state.selectedCategory = btn.dataset.cat;
    renderCurrentView();
  });

  elChkInteresting.addEventListener('change', (e) => {
    state.interestingOnly = e.target.checked;
    renderCurrentView();
  });

  elSearchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderCurrentView();
  });

  document.getElementById('btnTestPabalma').addEventListener('click', () => {
    triggerBestStoryAlert(true);
  });

  document.getElementById('btnCloseToast').addEventListener('click', () => {
    document.getElementById('pabalmaToast').classList.remove('show');
  });

  document.getElementById('btnToastTelegram').addEventListener('click', () => {
    sendStoryToTelegram(state.currentToastStoryId);
  });

  document.getElementById('btnToastReadNow').addEventListener('click', () => {
    document.getElementById('pabalmaToast').classList.remove('show');
    if (state.currentToastStoryId) {
      const card = document.getElementById(`story-${state.currentToastStoryId}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.outline = '3px solid var(--crimson)';
        setTimeout(() => { card.style.outline = 'none'; }, 2200);
      }
    }
  });

  const mobileModal = document.getElementById('mobileModal');
  document.getElementById('btnOpenMobileModal').addEventListener('click', () => {
    mobileModal.classList.add('open');
  });
  document.getElementById('btnCloseMobileModal').addEventListener('click', () => {
    mobileModal.classList.remove('open');
  });
  document.getElementById('btnPushDailyTelegram').addEventListener('click', () => {
    sendStoryToTelegram(null);
  });

  document.getElementById('mNavToday').addEventListener('click', () => {
    state.selectedCategory = 'all';
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === 'all'));
    state.currentDate = new Date();
    syncDateToInput(state.currentDate);
    renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('mNavLegends').addEventListener('click', () => {
    state.selectedCategory = 'legends';
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === 'legends'));
    renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('mNavHotOnly').addEventListener('click', () => {
    state.interestingOnly = !state.interestingOnly;
    elChkInteresting.checked = state.interestingOnly;
    renderCurrentView();
  });

  document.getElementById('mNavBookmarks').addEventListener('click', () => {
    renderBookmarkModalList();
    document.getElementById('bookmarkModal').classList.add('open');
  });

  document.getElementById('mNavMobile').addEventListener('click', () => {
    mobileModal.classList.add('open');
  });

  const alertModal = document.getElementById('alertModal');
  document.getElementById('btnOpenAlertModal').addEventListener('click', () => {
    updateAlertConfigUI();
    alertModal.classList.add('open');
  });
  document.getElementById('btnCloseAlertModal').addEventListener('click', () => {
    alertModal.classList.remove('open');
  });

  document.getElementById('rangeMinScore').addEventListener('input', (e) => {
    document.getElementById('modalScoreVal').textContent = `${e.target.value}점 이상`;
  });

  document.getElementById('btnRequestBrowserPerm').addEventListener('click', async () => {
    if (!('Notification' in window)) return;
    await Notification.requestPermission();
    updateBrowserPermText();
  });

  document.getElementById('btnSendSampleAlert').addEventListener('click', () => {
    alertModal.classList.remove('open');
    triggerBestStoryAlert(true);
  });

  document.getElementById('btnSaveAlertSettings').addEventListener('click', () => {
    const newMinScore = Number(document.getElementById('rangeMinScore').value);
    const checkedCats = Array.from(document.querySelectorAll('.cat-alert-chk:checked')).map(c => c.value);
    state.alertConfig = {
      minScore: newMinScore,
      categories: checkedCats.length > 0 ? checkedCats : ['mystery', 'scandal', 'folklore', 'episode']
    };
    localStorage.setItem('joseon_alert_config', JSON.stringify(state.alertConfig));
    updateAlertConfigUI();
    renderCurrentView();
    alertModal.classList.remove('open');
    triggerBestStoryAlert(true);
  });

  const bookmarkModal = document.getElementById('bookmarkModal');
  document.getElementById('btnOpenBookmarks').addEventListener('click', () => {
    renderBookmarkModalList();
    bookmarkModal.classList.add('open');
  });
  document.getElementById('btnCloseBookmarkModal').addEventListener('click', () => {
    bookmarkModal.classList.remove('open');
  });
}

document.addEventListener('DOMContentLoaded', initApp);

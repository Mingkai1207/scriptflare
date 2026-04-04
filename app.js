/* ===================================
   ScriptFlare — Application Logic
   =================================== */

// === CONFIG ===
const CONFIG = {
  apiUrl: 'https://api.vectorengine.ai/v1/chat/completions',
  apiKey: 'sk-8TkvS0sUFT30kyBThGl5kKUKCTkBbMUN3r9I4ZQPhqaB5wTS',
  model: 'gpt-4o',
  freeLimit: 3,
  storageKey: 'sf_usage',
  proKey: 'sf_pro',
};

// Pre-generated Pro unlock codes
// Keep this list private — give one code per paying customer
// Mark each code as used after sending
const VALID_CODES = new Set([
  'SFPRO-R7K2M9', 'SFPRO-T4N8P3', 'SFPRO-Y2Q6X5', 'SFPRO-U9W1Z7',
  'SFPRO-I5E3A8', 'SFPRO-O6B4C1', 'SFPRO-L8D7F2', 'SFPRO-S3G9H4',
  'SFPRO-J1V5K6', 'SFPRO-K7M2N3', 'SFPRO-P4Q8R1', 'SFPRO-W6Y3T5',
  'SFPRO-X2Z7U9', 'SFPRO-C1A4E8', 'SFPRO-F5B9G2', 'SFPRO-H3D6I7',
  'SFPRO-N8J1L4', 'SFPRO-V2K7M5', 'SFPRO-A9R3S6', 'SFPRO-E4T1W8',
  'SFPRO-G7H3J9', 'SFPRO-M1K6P2', 'SFPRO-Q8N5R4', 'SFPRO-B2D7F1',
  'SFPRO-Z5C9G3', 'SFPRO-W4X8Y6', 'SFPRO-V7T1U3', 'SFPRO-S6R2Q8',
  'SFPRO-P5N4M7', 'SFPRO-L3J9K1', 'SFPRO-H8G6I4', 'SFPRO-F2E5D9',
  'SFPRO-C7B4A8', 'SFPRO-Z1Y3X6', 'SFPRO-W8V5U2', 'SFPRO-T6S9R4',
  'SFPRO-Q3P7N1', 'SFPRO-M5L2K8', 'SFPRO-J4I6H3', 'SFPRO-G9F1E7',
]);

// === STATE ===
let currentScript = '';
let isGenerating = false;
let _progressTimer = null;
let _progressBarTimer = null;

// === SCRIPT AUTO-SAVE + HISTORY ===
const SF_HISTORY_KEY = 'sf_history';
const SF_HISTORY_MAX = 5;

function autoSaveScript(script, topic, niche) {
  try {
    const entry = { script, topic, niche, ts: Date.now() };
    localStorage.setItem('sf_autosave', JSON.stringify(entry));
    // Also append to history
    const raw = localStorage.getItem(SF_HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    // Deduplicate by topic+niche
    const filtered = history.filter(e => !(e.topic === topic && e.niche === niche));
    filtered.unshift(entry);
    localStorage.setItem(SF_HISTORY_KEY, JSON.stringify(filtered.slice(0, SF_HISTORY_MAX)));
  } catch (_) {}
}

function getScriptHistory() {
  try { return JSON.parse(localStorage.getItem(SF_HISTORY_KEY) || '[]'); } catch (_) { return []; }
}

function showHistoryPanel() {
  const history = getScriptHistory();
  if (!history.length) { showToast('No script history yet — generate your first script!', 'success'); return; }

  const wrap = document.getElementById('history-panel');
  if (!wrap) return;

  if (!wrap.classList.contains('hidden')) { wrap.classList.add('hidden'); return; }

  wrap.innerHTML = `
    <div class="history-header">
      <strong>📜 Script History</strong>
      <span class="history-sub">Last ${history.length} script${history.length > 1 ? 's' : ''}</span>
    </div>
    <div class="history-list">
      ${history.map((e, i) => {
        const date = new Date(e.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const words = (e.script || '').split(/\s+/).filter(Boolean).length;
        const safeI = i;
        return `<div class="history-item" onclick="loadHistoryEntry(${safeI})">
          <div class="history-item-meta">
            <span class="history-item-date">${date}</span>
            <span class="history-item-niche">${e.niche || 'General'}</span>
            <span class="history-item-words">${words.toLocaleString()} words</span>
          </div>
          <div class="history-item-topic">${escapeHtml((e.topic || 'Untitled').slice(0, 80))}</div>
        </div>`;
      }).join('')}
    </div>`;
  wrap.classList.remove('hidden');
}

function loadHistoryEntry(idx) {
  const history = getScriptHistory();
  const entry = history[idx];
  if (!entry) return;

  currentScript = entry.script;
  if (entry.topic) { document.getElementById('topic').value = entry.topic; updateTopicCounter(); }
  if (entry.niche) { document.getElementById('niche').value = entry.niche; syncNichePill(entry.niche); }

  const outputDiv = document.getElementById('gen-output');
  const contentDiv = document.getElementById('script-content');
  const statsSpan = document.getElementById('output-stats');
  const badge = document.querySelector('.output-badge');
  if (!outputDiv || !contentDiv) return;

  const words = entry.script.split(/\s+/).filter(Boolean).length;
  const mins = Math.round(words / 150);
  const date = new Date(entry.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (statsSpan) statsSpan.textContent = `📜 From history (${date}) · ~${words.toLocaleString()} words · ~${mins} min`;
  if (badge) badge.textContent = '📜 History Script';
  contentDiv.innerHTML = formatScript(entry.script);
  outputDiv.classList.remove('hidden');
  document.getElementById('voiceover-links')?.classList.remove('hidden');
  document.getElementById('history-panel')?.classList.add('hidden');
  if (entry.niche) {
    showNichePerfTip(entry.niche);
    showQualityReport(entry.script);
    showTitleOptions(entry.topic, entry.niche);
  }
  outputDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(`📜 Loaded: "${(entry.topic || '').slice(0, 40)}"`, 'success');
}

function restoreLastScript() {
  try {
    const raw = localStorage.getItem('sf_autosave');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved?.script) return;
    // Only restore if saved within last 48 hours
    if (Date.now() - saved.ts > 172800000) { localStorage.removeItem('sf_autosave'); return; }

    // Restore form state
    if (saved.topic) { document.getElementById('topic').value = saved.topic; updateTopicCounter(); }
    if (saved.niche) { document.getElementById('niche').value = saved.niche; syncNichePill(saved.niche); }

    // Restore output (without auto-scroll)
    currentScript = saved.script;
    const outputDiv = document.getElementById('gen-output');
    const contentDiv = document.getElementById('script-content');
    const statsSpan = document.getElementById('output-stats');
    const badge = document.querySelector('.output-badge');
    if (!outputDiv || !contentDiv) return;

    const words = saved.script.split(/\s+/).filter(Boolean).length;
    const mins = Math.round(words / 150);
    if (statsSpan) statsSpan.textContent = `↩️ Restored · ~${words.toLocaleString()} words · ~${mins} min`;
    if (badge) badge.textContent = '↩️ Last Script';
    contentDiv.innerHTML = formatScript(saved.script);
    outputDiv.classList.remove('hidden');
    document.getElementById('voiceover-links')?.classList.remove('hidden');
    if (saved.niche) { showNichePerfTip(saved.niche); showQualityReport(saved.script); }
  } catch (_) {}
}

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  updateUsageBar();
  checkProStatus();
  restoreLastScript();
  initNavbarScroll();
  updateGenerateBtnState();
  updateNavCTA();
  initScrollReveal();
  initLiveTicker();
  initStatCounters();
  initLiveScriptCount();
  initTopicPlaceholder();
  initStickyCTA();
  initDemandStrip();
  renderTopicHistory();
  initPricingCountdown();
  initExitIntent();
  initTheme();
  // Auto-open first FAQ item
  const firstFaq = document.querySelector('.faq-q');
  if (firstFaq) toggleFaq(firstFaq);
  // URL deep-link: ?generate=1 auto-scrolls to generator
  if (new URLSearchParams(location.search).get('generate') === '1') {
    setTimeout(() => {
      document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => document.getElementById('topic')?.focus(), 600);
    }, 400);
  }
});

// === NAV CTA DYNAMIC ===
function updateNavCTA() {
  const btn = document.querySelector('.nav-cta');
  if (!btn || isProUser()) return;
  const remaining = getRemainingScripts();
  if (remaining === 0) {
    btn.textContent = 'Upgrade to Pro →';
    btn.style.background = 'linear-gradient(135deg, var(--primary), var(--pink))';
    btn.href = '#pricing';
  } else if (remaining === 1) {
    btn.textContent = '⚡ 1 Script Left';
    btn.style.background = 'linear-gradient(135deg, #b45309, #92400e)';
  }
}

// === KEYBOARD SHORTCUTS ===
document.addEventListener('keydown', (e) => {
  const inInput = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);

  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    generateScript();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 's' && currentScript) {
    e.preventDefault();
    downloadScript();
  }
  // ? = show keyboard shortcuts (not when typing)
  if (!inInput && e.key === '?' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    toggleShortcutsModal();
  }
  // Escape closes any open modal/panel
  if (e.key === 'Escape') {
    closeVoiceProfile(null, true);
    closeChecklist(null, true);
    closeExitModal(null, true);
    document.getElementById('score-breakdown-pop')?.remove();
  }
});

// === STICKY MOBILE CTA ===
function initStickyCTA() {
  const bar = document.getElementById('sticky-cta-bar');
  const hero = document.getElementById('hero');
  if (!bar || !hero) return;
  window.addEventListener('scroll', () => {
    const heroBottom = hero.getBoundingClientRect().bottom;
    bar.classList.toggle('visible', heroBottom < 0);
  }, { passive: true });
}

// === NAVBAR SCROLL + SCROLL TO TOP ===
function initNavbarScroll() {
  const nav = document.getElementById('navbar');
  const scrollTop = document.getElementById('scroll-top');
  window.addEventListener('scroll', () => {
    nav.style.background = window.scrollY > 40
      ? 'rgba(6, 6, 15, 0.97)'
      : 'rgba(6, 6, 15, 0.85)';
    if (scrollTop) scrollTop.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });
}

// === TOPIC PLACEHOLDER ROTATION ===
function initTopicPlaceholder() {
  const input = document.getElementById('topic');
  if (!input) return;

  const examples = [
    '5 habits that made me a millionaire before 30',
    'The truth about sleep that doctors won\'t tell you',
    'Why the Roman Empire really collapsed',
    '10 dark psychology tricks used in advertising',
    'How Elon Musk thinks differently than everyone else',
    'The real reason you\'re always tired (it\'s not sleep)',
    '7 businesses you can start with $0 in 2026',
    'The hidden history of the CIA that nobody talks about',
    'Why most diets fail — and what actually works',
    '5 manipulation tactics narcissists use on you',
  ];

  let i = 0;
  const rotate = () => {
    if (document.activeElement === input) return;
    i = (i + 1) % examples.length;
    input.setAttribute('placeholder', examples[i]);
  };

  setInterval(rotate, 3500);
}

// === LIVE SCRIPT COUNT (increments hero counter subtly in real-time) ===
function initLiveScriptCount() {
  const el = document.querySelector('.stat-num[data-count="47200"]');
  if (!el) return;
  let count = 47200;

  const bump = () => {
    count += 1;
    el.textContent = count.toLocaleString() + '+';
    setTimeout(bump, 42000 + Math.random() * 48000); // every 42–90s
  };

  // First bump after 20s (well after the count-up animation finishes)
  setTimeout(bump, 20000);
}

// === STAT COUNTER ANIMATION ===
function initStatCounters() {
  const stats = document.querySelectorAll('.stat-num[data-count]');
  if (!stats.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const el = entry.target;
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      const divisor = parseInt(el.dataset.decimal || '1', 10);
      const duration = 1400;
      const start = performance.now();

      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * target) / divisor;
        if (divisor > 1) {
          el.textContent = current.toFixed(1) + suffix;
        } else {
          el.textContent = current.toLocaleString() + suffix;
        }
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.5 });

  stats.forEach(el => observer.observe(el));
}

// === SCROLL REVEAL ===
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// === LIVE TICKER ===
function initLiveTicker() {
  const ticker = document.getElementById('live-ticker');
  const text = document.getElementById('live-ticker-text');
  if (!ticker || !text) return;

  const messages = [
    '💰 Finance script generated: "5 money habits millionaires swear by"',
    '🔥 Creator just upgraded to Pro — unlimited scripts unlocked',
    '🔍 True crime script ready: 1,542 words · 8 B-roll cues',
    '📚 History channel creator just posted their 15th ScriptFlare video',
    '🇺🇸 Creator in the US grew from 800 to 14K subs in 4 months',
    '🤖 Tech & AI script generated: "How ChatGPT will change everything"',
    '⚡ 4 scripts generated in the last 10 minutes',
    '🔥 Motivation script ready: hook-first · open loop · A-grade quality score',
    '🇦🇺 Creator in Australia just launched their first faceless channel',
    '💰 Finance creator: "my avg view duration went up 31% after switching to ScriptFlare"',
    '🏆 Business channel just generated a 15-min entrepreneurship script',
    '🇧🇷 Script gerado em Português para canal de finanças',
    '🇪🇸 Guión de True Crime generado en Español',
    '📺 Teleprompter mode — creator reading their script live right now',
    '🎣 Hook regenerated 3× until it was perfect — creator loved it',
    '📊 2,400+ creators on Pro generating scripts daily',
    '🔍 Cold case script: 1,890 words · 11 B-roll cues · A+ quality score',
    '🇮🇳 Hindi finance script ready — 1,450 words',
    '7 scripts generated by one creator in the last hour',
    '🧠 Psychology script: "The narcissism trap" — open loop detected',
  ];

  let idx = Math.floor(Math.random() * messages.length);
  text.textContent = messages[idx];

  setInterval(() => {
    idx = (idx + 1) % messages.length;
    ticker.style.opacity = '0';
    setTimeout(() => {
      text.textContent = messages[idx];
      ticker.style.opacity = '1';
    }, 300);
  }, 7000);

  ticker.style.transition = 'opacity 0.3s ease';
}

// === USAGE TRACKING ===
function getUsage() {
  return parseInt(localStorage.getItem(CONFIG.storageKey) || '0', 10);
}

function incrementUsage() {
  const current = getUsage();
  localStorage.setItem(CONFIG.storageKey, current + 1);
  const total = parseInt(localStorage.getItem('sf_total') || '0', 10);
  localStorage.setItem('sf_total', total + 1);
  updateStreak();
}

function updateStreak() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const last = localStorage.getItem('sf_last_date') || '';
  let streak = parseInt(localStorage.getItem('sf_streak') || '0', 10);

  if (last === today) return; // already counted today

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  streak = last === yesterday ? streak + 1 : 1;

  localStorage.setItem('sf_last_date', today);
  localStorage.setItem('sf_streak', streak);

  // Celebrate milestones
  if ([3, 7, 14, 30, 50, 100].includes(streak)) {
    setTimeout(() => showToast(`🔥 ${streak}-day streak! You're on fire — keep the momentum!`, 'success'), 1200);
  }
}

function getStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const last = localStorage.getItem('sf_last_date') || '';
  const streak = parseInt(localStorage.getItem('sf_streak') || '0', 10);
  // Streak is still alive if last was today or yesterday
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return (last === today || last === yesterday) ? streak : 0;
}

function getRemainingScripts() {
  if (isProUser()) return Infinity;
  return Math.max(0, CONFIG.freeLimit - getUsage());
}

function updateUsageBar() {
  const remaining = getRemainingScripts();
  const used = CONFIG.freeLimit - Math.min(remaining, CONFIG.freeLimit);

  const label = document.getElementById('usage-label');
  const count = document.getElementById('usage-count');
  const fill = document.getElementById('usage-fill');
  const usageBar = document.getElementById('usage-bar');

  if (isProUser()) {
    if (label) label.innerHTML = '✅ Pro Account — <strong>Unlimited scripts</strong>';
    if (fill) fill.style.width = '100%';
    if (usageBar) {
      usageBar.style.background = 'rgba(16,185,129,0.07)';
      usageBar.style.borderBottom = '1px solid rgba(16,185,129,0.15)';
    }
  } else {
    if (count) count.textContent = remaining;
    if (fill) fill.style.width = ((used / CONFIG.freeLimit) * 100) + '%';
    // Add urgency styling based on remaining count
    if (usageBar) {
      usageBar.classList.remove('urgent', 'critical');
      if (remaining === 1) {
        usageBar.classList.add('urgent');
        if (label) label.innerHTML = '⚠️ Last free script remaining: <strong id="usage-count">1</strong>';
      } else if (remaining === 0) {
        usageBar.classList.add('critical');
      }
    }
  }
}

function updateGenerateBtnState() {
  const remaining = getRemainingScripts();
  const btn = document.getElementById('generate-btn');
  if (!btn) return;
  if (remaining === 0 && !isProUser()) {
    // Keep clickable but visually indicate upgrade needed — generateScript() handles the paywall
    btn.disabled = false;
    document.getElementById('btn-text').textContent = '🔒 Upgrade to Pro to Continue';
    btn.style.background = 'linear-gradient(135deg, #3d2a7a, #7a1f50)';
  }
}

// === PRO STATUS ===
function isProUser() {
  return localStorage.getItem(CONFIG.proKey) === 'true';
}

function checkProStatus() {
  if (isProUser()) {
    const badge = document.getElementById('pro-badge');
    if (badge) badge.classList.remove('hidden');
  }
}

function unlockPro() {
  const input = document.getElementById('unlock-input');
  const msg = document.getElementById('unlock-msg');
  const code = input.value.trim().toUpperCase();

  msg.classList.remove('hidden', 'success', 'error');

  if (!code) {
    msg.textContent = 'Please enter your unlock code.';
    msg.classList.add('error');
    return;
  }

  if (VALID_CODES.has(code)) {
    localStorage.setItem(CONFIG.proKey, 'true');
    msg.textContent = '🎉 Pro unlocked! You now have unlimited scripts.';
    msg.classList.add('success');

    setTimeout(() => {
      document.getElementById('paywall').classList.add('hidden');
      document.getElementById('pro-badge').classList.remove('hidden');
      document.getElementById('gen-form').classList.remove('hidden');
      const btn = document.getElementById('generate-btn');
      btn.disabled = false;
      btn.style.background = '';
      document.getElementById('btn-text').textContent = '⚡ Generate Script';
      updateUsageBar();
    }, 1200);
  } else {
    msg.textContent = '❌ Invalid code. Check your email or contact support.';
    msg.classList.add('error');
    input.style.borderColor = '#f87171';
    setTimeout(() => { input.style.borderColor = ''; }, 2000);
  }
}

// === NICHE AUTO-DETECT ===
const NICHE_KEYWORDS = {
  'personal finance': ['money','invest','wealth','rich','budget','finance','million','stock','crypto','salary','income','debt','save','retire','afford','spending'],
  'motivation and mindset': ['habit','success','mindset','discipline','goal','motivat','winner','produc','morning','achieve','failure','confidence','willpower'],
  'true crime and mysteries': ['crime','murder','case','detective','unsolved','killer','disappear','mystery','investigation','fbi','serial','victim','cold case'],
  'history and facts': ['history','ancient','civilization','empire','war','century','histor','roman','egypt','medieval','dynasty','revolution','world war','battle'],
  'technology and AI': ['artificial intelligence','chatgpt','automation','digital','algorithm','software','machine learning','robot','tech ','gadget','cyber'],
  'business and entrepreneurship': ['business','startup','entrepreneur','profit','revenue','market','brand','customer','founder','company','ecommerce','dropship','passive income'],
  'health and wellness': ['health','sleep','diet','exercise','weight','fitness','wellness','mental','stress','nutrition','vitamin','longevity','inflammation'],
  'self-improvement': ['improve','better life','transform','growth','self-','level up','skills','stoic','mindful','productivity'],
  'relationships and psychology': ['relationship','psychology','dating','narciss','attachment','manipulat','toxic','breakup','boundaries','emotion','trauma'],
};

let _nicheDetectTimer = null;

function detectNicheFromTopic() {
  const topic = document.getElementById('topic').value.toLowerCase().trim();
  if (!topic || topic.length < 10) { hideNicheHint(); return; }

  clearTimeout(_nicheDetectTimer);
  _nicheDetectTimer = setTimeout(() => {
    let best = null, bestScore = 0;
    for (const [niche, kws] of Object.entries(NICHE_KEYWORDS)) {
      const score = kws.filter(kw => topic.includes(kw)).length;
      if (score > bestScore) { bestScore = score; best = niche; }
    }
    const currentNiche = document.getElementById('niche').value;
    if (best && bestScore >= 1 && best !== currentNiche) {
      showNicheHint(best);
    } else {
      hideNicheHint();
    }
  }, 600);
}

function showNicheHint(niche) {
  let hint = document.getElementById('niche-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'niche-hint';
    hint.className = 'niche-hint';
    const nicheGroup = document.getElementById('niche').closest('.form-group');
    if (nicheGroup) nicheGroup.appendChild(hint);
  }
  const nicheOption = document.querySelector(`#niche option[value="${niche}"]`);
  const label = nicheOption?.textContent?.trim() || niche;
  hint.innerHTML = `💡 Detected: <button class="niche-hint-btn" onclick="pickNiche('${niche}'); hideNicheHint()">${label} — click to apply</button>`;
  hint.classList.add('visible');
}

function hideNicheHint() {
  const hint = document.getElementById('niche-hint');
  if (hint) hint.classList.remove('visible');
}

// === TOPIC SUGGESTIONS ===
const TOPIC_SUGGESTIONS = {
  'personal finance': [
    'How I saved $50,000 on a $45,000 salary',
    'The 4 investing mistakes killing your portfolio returns',
    'Why most people will never be rich — and how to be different',
  ],
  'motivation and mindset': [
    'Why discipline beats motivation every single time',
    'The morning routine that quietly changed my life',
    '5 mindset shifts that separate top 1% from everyone else',
  ],
  'true crime and mysteries': [
    'The unsolved disappearance that baffled investigators for decades',
    'Inside the most elaborate con in American history',
    'The cold case that cracked open 30 years later',
  ],
  'history and facts': [
    'The ancient civilization that was more advanced than we thought',
    'Why the Roman Empire really collapsed — the true story',
    '10 historical "facts" that are completely wrong',
  ],
  'technology and AI': [
    'How AI will replace 40% of jobs by 2030',
    'The dark side of social media algorithms nobody talks about',
    '5 technologies that will change everything in the next 5 years',
  ],
  'business and entrepreneurship': [
    'The $0 business model making people millionaires in 2026',
    'Why 90% of businesses fail in year one — and how to avoid it',
    'From side hustle to $10K/month: the exact playbook',
  ],
  'self-improvement': [
    'The 1% rule that quietly transforms your life in 6 months',
    '7 habits successful people do before 8am',
    'Why reading books changed my income and how to start',
  ],
  'health and wellness': [
    'The sleep science that doctors aren\'t telling you',
    'Why most diets fail — and what actually works long-term',
    '5 daily habits that add 10 years to your life',
  ],
  'relationships and psychology': [
    '5 psychological tricks narcissists use that you need to know',
    'Why most people choose the wrong partner — the real reason',
    'The attachment theory that explains every relationship problem',
  ],
  'travel and geography': [
    'The country that nobody visits — but everyone should',
    'Why Japan is the most unique civilization on earth',
    '10 places that will disappear within your lifetime',
  ],
  'spirituality and philosophy': [
    'The ancient Stoic habit that fixes 90% of modern anxiety',
    'Why Marcus Aurelius\'s philosophy is more relevant than ever',
    '5 Buddhist principles that actually change how you live',
  ],
  'news and current events': [
    'What nobody is telling you about the AI jobs crisis',
    'The geopolitical shift that will define the next decade',
    'Why the middle class is quietly disappearing — the real data',
  ],
};

function showTopicSuggestions(niche) {
  const container = document.getElementById('topic-suggestions');
  const chips = document.getElementById('topic-sug-chips');
  if (!container || !chips) return;

  const suggestions = TOPIC_SUGGESTIONS[niche] || TOPIC_SUGGESTIONS['motivation and mindset'];
  chips.innerHTML = suggestions.map(t =>
    `<button class="topic-sug-chip" onclick="useSuggestion(this, '${t.replace(/'/g, "&#39;")}')">${t}</button>`
  ).join('');
  container.classList.remove('hidden');
}

function useCalendarIdea(topic) {
  document.getElementById('topic').value = topic;
  updateTopicCounter();
  detectNicheFromTopic();
  document.getElementById('generator').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => document.getElementById('topic').focus(), 500);
  showToast('Topic set! Hit Generate when ready.', 'success');
}

function useSuggestion(btn, topic) {
  document.getElementById('topic').value = topic;
  updateTopicCounter();
  // Scroll to generate button
  document.getElementById('generate-btn').scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Visual feedback
  btn.style.background = 'rgba(124,92,252,0.2)';
  btn.style.borderColor = 'rgba(124,92,252,0.5)';
}

// === NICHE LENGTH RECOMMENDATIONS ===
const NICHE_LENGTH_HINTS = {
  'personal finance':           { len: '10', hint: '10–12 min optimal — maximizes mid-roll ad revenue for finance' },
  'motivation and mindset':     { len: '8',  hint: '8–10 min ideal — enough depth without losing energy' },
  'true crime and mysteries':   { len: '15', hint: '15 min works great — viewers binge longer true crime stories' },
  'history and facts':          { len: '12', hint: '12–15 min fits history well — room for full narrative arc' },
  'technology and AI':          { len: '10', hint: '10 min sweet spot for tech — dense but digestible' },
  'business and entrepreneurship': { len: '10', hint: '10–12 min works for business — matches attention of busy entrepreneurs' },
  'self-improvement':           { len: '8',  hint: '8 min is ideal — actionable, tight, high retention' },
  'health and wellness':        { len: '10', hint: '10 min balances depth with pacing for health content' },
  'relationships and psychology': { len: '12', hint: '12 min lets psychology topics build proper context' },
};

function showLengthHint(niche) {
  const hint = NICHE_LENGTH_HINTS[niche];
  let el = document.getElementById('length-hint');
  if (!el) {
    el = document.createElement('p');
    el.id = 'length-hint';
    el.className = 'length-hint';
    const lengthGroup = document.getElementById('length').closest('.form-group');
    if (lengthGroup) lengthGroup.appendChild(el);
  }
  if (hint) {
    // Auto-suggest the length
    const lengthEl = document.getElementById('length');
    if (lengthEl && lengthEl.value !== hint.len) lengthEl.value = hint.len;
    el.innerHTML = `💡 ${hint.hint}`;
    el.classList.add('visible');
  } else {
    el.classList.remove('visible');
  }
}

// === NICHE REVENUE INSIGHTS ===
const NICHE_REVENUE = {
  'personal finance':             { cpm: '$12–$45', min: 12, max: 45, icon: '💰', tier: 'Top earner', note: 'Highest CPM on YouTube. Finance ads pay premium rates year-round.', channels: 'Andrei Jikh, Graham Stephan, Minority Mindset' },
  'technology and AI':            { cpm: '$8–$22',  min: 8,  max: 22, icon: '🤖', tier: 'High earner', note: 'Tech & AI CPM spikes in Q4 with product launches. SaaS ads dominate.', channels: 'Fireship, Two Minute Papers, AI Explained' },
  'business and entrepreneurship':{ cpm: '$10–$30', min: 10, max: 30, icon: '🏆', tier: 'Top earner', note: 'Business education + B2B ads = strong CPM. Evergreen content performs well.', channels: 'Ali Abdaal, MKBHD, Iman Gadzhi' },
  'health and wellness':          { cpm: '$4–$14',  min: 4,  max: 14, icon: '💪', tier: 'Mid-high earner', note: 'Supplement and fitness brands pay solid rates. January always spikes.', channels: 'Thomas DeLauer, Andrew Huberman clips, Dr. Mike' },
  'self-improvement':             { cpm: '$5–$16',  min: 5,  max: 16, icon: '📈', tier: 'Mid-high earner', note: 'Productivity and book-summary channels thrive. Strong affiliate opportunities.', channels: 'Better Ideas, Mike Dee, Clark Kegley' },
  'true crime and mysteries':     { cpm: '$3–$9',   min: 3,  max: 9,  icon: '🔍', tier: 'Mid earner', note: 'Lower CPM but viral potential and massive audiences compensate.', channels: 'Cayleigh Elise, Stephanie Harlowe, Kendall Rae' },
  'history and facts':            { cpm: '$3–$10',  min: 3,  max: 10, icon: '📚', tier: 'Mid earner', note: 'Great for evergreen traffic. CPM lower but loyal audiences accumulate over time.', channels: 'Knowledgia, Historymarche, Cool History Bros' },
  'motivation and mindset':       { cpm: '$4–$12',  min: 4,  max: 12, icon: '🔥', tier: 'Mid earner', note: 'Clips-style channels can hit millions of views cheaply. Works well on Shorts too.', channels: 'Motiversity, Absolute Motivation, Ben Lionel Scott' },
  'relationships and psychology': { cpm: '$4–$13',  min: 4,  max: 13, icon: '🧠', tier: 'Mid earner', note: 'Psychology content with therapy/wellness angle gets premium ads.', channels: 'Psych2Go, SciShow, Dr. Julie Smith' },
  'travel and geography':         { cpm: '$2–$8',   min: 2,  max: 8,  icon: '🌍', tier: 'Lower CPM', note: 'Travel ads fluctuate. Strong sponsorship potential with tourism and hotels.', channels: 'geography now, FerdinandMakelaer, Wendover Productions' },
  'spirituality and philosophy':  { cpm: '$3–$9',   min: 3,  max: 9,  icon: '✨', tier: 'Mid earner', note: 'Niche but loyal audience. Meditation apps and spiritual brands sponsor heavily.', channels: 'The School of Life, Einzelgänger, Aperture' },
  'news and current events':      { cpm: '$4–$12',  min: 4,  max: 12, icon: '📰', tier: 'Mid earner', note: 'High traffic potential but monetization can be limited. Balance with evergreen.', channels: 'TLDR News, Vox, Johnny Harris' },
};

function showNicheRevenue(niche) {
  const el = document.getElementById('niche-revenue');
  if (!el) return;
  const data = NICHE_REVENUE[niche];
  if (!data) { el.classList.add('hidden'); return; }
  el.innerHTML = `
    <div class="nr-icon">${data.icon}</div>
    <div class="nr-body">
      <div class="nr-row">
        <span class="nr-cpm">${data.cpm} CPM</span>
        <span class="nr-tier">${data.tier}</span>
      </div>
      <p class="nr-note">${data.note}</p>
      <p class="nr-channels">Example channels: <em>${data.channels}</em></p>
      <details class="nr-calc">
        <summary class="nr-calc-toggle">💰 Estimate my monthly earnings</summary>
        <div class="nr-calc-body">
          <div class="nr-slider-row">
            <label>Views per video: <strong id="nr-views-val">10,000</strong></label>
            <input type="range" id="nr-views" min="1000" max="500000" step="1000" value="10000" oninput="updateRevenueCalc('${niche}')">
          </div>
          <div class="nr-slider-row">
            <label>Videos per month: <strong id="nr-vids-val">4</strong></label>
            <input type="range" id="nr-vids" min="1" max="30" step="1" value="4" oninput="updateRevenueCalc('${niche}')">
          </div>
          <div class="nr-result" id="nr-result"></div>
        </div>
      </details>
    </div>`;
  el.classList.remove('hidden');
  updateRevenueCalc(niche);
}

function updateRevenueCalc(niche) {
  const data = NICHE_REVENUE[niche];
  if (!data) return;
  const views = parseInt(document.getElementById('nr-views')?.value || 10000, 10);
  const vids = parseInt(document.getElementById('nr-vids')?.value || 4, 10);
  document.getElementById('nr-views-val').textContent = views.toLocaleString();
  document.getElementById('nr-vids-val').textContent = vids;
  const totalViews = views * vids;
  // YouTube pays ~55% of CPM to creators (RPM ≈ CPM × 0.55)
  const minRev = Math.round(totalViews / 1000 * data.min * 0.55);
  const maxRev = Math.round(totalViews / 1000 * data.max * 0.55);
  const result = document.getElementById('nr-result');
  if (result) {
    result.innerHTML = `<span class="nr-est-label">Estimated monthly AdSense:</span> <strong class="nr-est-range">$${minRev.toLocaleString()} – $${maxRev.toLocaleString()}</strong> <span class="nr-est-note">at ${totalViews.toLocaleString()} total views</span>`;
  }
}

// === NICHE QUICK-SELECT ===
function pickNiche(value) {
  const select = document.getElementById('niche');
  if (select) select.value = value;
  syncNichePill(value);
  showLengthHint(value);
  showNicheRevenue(value);
}

function jumpToGenerator(niche) {
  pickNiche(niche);
  document.getElementById('generator').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => document.getElementById('topic').focus(), 600);
}

function syncNichePill(value) {
  document.querySelectorAll('.niche-pill').forEach(p => {
    p.classList.toggle('active', value && p.getAttribute('onclick').includes(`'${value}'`));
  });
}

// === PAYPAL ===
function showPayPal() {
  const box = document.getElementById('paypal-box');
  if (box) {
    box.classList.remove('hidden');
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function scrollToPricing() {
  document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' });
}

// === SCRIPT GENERATION ===
async function generateScript() {
  if (isGenerating) return;

  // Check usage limit first — so clicking the locked button always opens the paywall
  const remaining = getRemainingScripts();
  if (remaining <= 0 && !isProUser()) {
    showPaywall();
    return;
  }

  const topic = document.getElementById('topic').value.trim();
  const niche = document.getElementById('niche').value;
  const length = document.getElementById('length').value;
  const tone = document.getElementById('tone').value;
  const audience = document.getElementById('audience').value.trim() || 'general YouTube audience';
  const scriptLang = document.getElementById('script-lang')?.value || 'English';
  const customNotes = document.getElementById('custom-notes')?.value.trim() || '';

  // Validation
  if (!topic) {
    shakeField('topic');
    return;
  }
  if (!niche) {
    shakeField('niche');
    return;
  }

  // Show "last script" nudge
  if (remaining === 1 && !isProUser()) {
    showToast('⚡ Last free script — make it count! Upgrade after to keep going.', 'warning');
  }

  // Start generation
  isGenerating = true;
  setLoadingState(true);

  // Show skeleton after 1.5s to give user preview of what's coming
  const skeletonTimer = setTimeout(() => {
    if (isGenerating) showLoadingSkeleton();
  }, 1500);

  const wordCount = {
    'short': 150, '5': 750, '8': 1200, '10': 1500, '12': 1800, '15': 2250
  }[length] || 1500;

  // YouTube Shorts — completely different prompt and flow
  if (length === 'short') {
    const shortsSystemPrompt = `You are an expert YouTube Shorts scriptwriter. Shorts are vertical, 60-second videos that must hook viewers in the first 2 words. No sections, no headers — just a single punchy flow of spoken text.

Rules for Shorts scripts:
- First 2–3 words are the entire hook — make them a bold claim, shocking question, or surprising stat
- Zero filler, zero throat-clearing — every sentence must earn its place
- Speak directly to the viewer: "you", "your", "you've"
- End with a crisp verbal CTA (subscribe, follow, drop a comment)
- Include 2–3 [VISUAL: description] cues on their own lines for vertical footage
- Total spoken text: 130–160 words`;

    const shortsUserPrompt = `Write a YouTube Shorts script (60 seconds, ~150 words).

Topic: "${topic}"
Niche: ${niche}
Tone: ${tone}${langNote}${customNote}${voiceNote}

Write ONLY the spoken script text with 2–3 [VISUAL: ...] cues. No section headers. No preamble. Start with the hook word:`;

    try {
      const response = await fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CONFIG.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CONFIG.model,
          messages: [
            { role: 'system', content: shortsSystemPrompt },
            { role: 'user', content: shortsUserPrompt }
          ],
          max_tokens: 400,
          temperature: 0.88,
          stream: false,
        }),
      });
      clearTimeout(skeletonTimer);
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      const script = data.choices?.[0]?.message?.content?.trim();
      if (!script) throw new Error('Empty response');
      incrementUsage();
      autoSaveScript(script, topic, niche);
      displayScript(script, topic, length);
      showQualityReport(script);
      showNichePerfTip(niche);
      showTopicSuggestions(niche);
      showTitleOptions(topic, niche);
      showContentCalendar(niche);
      showChannelNames(niche);
      trackTopicHistory(topic);
      showToast('⚡ Short script ready!', 'success');
    } catch (err) {
      showToast('Generation failed — try again', 'warning');
      document.getElementById('gen-output').classList.add('hidden');
      document.getElementById('gen-form').classList.remove('hidden');
    } finally {
      clearTimeout(skeletonTimer);
      isGenerating = false;
      setLoadingState(false);
    }
    return;
  }

  const nicheGuidance = {
    'personal finance':            'Use specific numbers and dollar amounts — they signal authority. Speak directly to the viewer\'s financial anxiety ("If you\'re living paycheck to paycheck..."). Include at least one surprising statistic from a credible source in the hook.',
    'motivation and mindset':      'Open with a bold counter-intuitive claim or uncomfortable truth. Use second-person ("you") throughout. Build emotional escalation — the viewer should feel seen and understood before you give them the solution.',
    'true crime and mysteries':    'Build suspense through chronological storytelling with strategic information withholds. Use sensory language to put viewers in the scene. Tease the most shocking detail in the hook, then make them wait for it.',
    'history and facts':           'Frame history as a correction — "here\'s what really happened." Use present tense for key moments to create immediacy. Include one genuinely surprising fact that contradicts popular belief.',
    'technology and AI':           'Open with an implication for the viewer\'s life or job. Use concrete examples and analogies over abstract technical concepts. Include the current year to signal the content is fresh and relevant.',
    'business and entrepreneurship': 'Use case study structure — real numbers, real timelines. Speak to both the ambition and the fear of failure. Break complex strategies into a numbered system the viewer can follow.',
    'self-improvement':            'Balance inspiration with actionable steps — every section should include something the viewer can do today. Use "I used to X until I discovered Y" framing to trigger identification.',
    'health and wellness':         'Lead with a relatable symptom the viewer likely has. Use authoritative but accessible language — cite the research without being academic. Always pair a problem with a specific, actionable solution.',
    'relationships and psychology': 'Use vulnerability and specificity to build connection. Psychological concepts should feel like revelations about the viewer\'s own life. Avoid generic advice — give specific, named frameworks.',
    'travel and geography':        'Build a sense of wonder and discovery. Use vivid descriptive language and surprising contrasts. Connect geography to human stories and historical events.',
    'spirituality and philosophy':  'Start with a universal human problem the philosophy addresses. Translate ancient wisdom into modern, practical terms. Use concrete examples and scenarios to make abstract concepts tangible.',
    'news and current events':     'Provide context and backstory the viewer won\'t find in a 2-minute news clip. Explain the "why" behind events, not just the "what." Be balanced but give the viewer a clear analytical lens.',
  };

  const systemPrompt = `You are ScriptFlare, an expert YouTube script writer specializing in faceless YouTube channels. You deeply understand YouTube retention psychology, the algorithm, and what makes viewers watch all the way through.

Your scripts always:
- Open with a psychologically powerful hook in the FIRST 15-30 seconds (curiosity gap, bold claim, or surprising statistic)
- Follow proven retention structure: Hook → Intro → Main Content (with open loops) → Resolution → CTA
- Include [VISUAL: description] cues throughout for B-roll footage guidance
- Use natural, spoken language — conversational, not formal or essay-style
- Plant and resolve at least one "open loop" (hint at a revelation, deliver it in the final third)
- End with a specific CTA that feels earned, not tacked on

Format EVERY script with these exact headers (plain text — no markdown bold, no asterisks):
[HOOK]
[INTRO]
[SECTION 1: Title]
[SECTION 2: Title]
[SECTION 3: Title]
(add more [SECTION N: Title] headers as needed to hit the target length)
[CALL TO ACTION]

CRITICAL FORMATTING RULES:
- Write headers exactly as shown: [HOOK] not **[HOOK]**, [SECTION 1: Title] not **SECTION 1**
- Every [VISUAL: ...] cue must be on its own line
- Do not use asterisks, hashes, or any markdown formatting in the spoken text`;

  const nicheNote = nicheGuidance[niche] ? `\nNiche writing guidance: ${nicheGuidance[niche]}` : '';
  const langNote = scriptLang !== 'English' ? `\nLanguage: Write the ENTIRE script in ${scriptLang}. All section headers must also be in ${scriptLang}, but keep the bracket format: [HOOK], [INTRO], [SECTION 1: Title], [CALL TO ACTION].` : '';
  const customNote = customNotes ? `\nAdditional creator instructions: ${customNotes}` : '';
  const voiceNote = getVoiceProfileNote();

  const userPrompt = `Create a complete ${length}-minute faceless YouTube script.

Topic: "${topic}"
Niche: ${niche}
Target audience: ${audience}
Tone/Style: ${tone}
Target word count: approximately ${wordCount} words${nicheNote}${langNote}${customNote}${voiceNote}

Script requirements:
- Hook must grip attention in the first 3 seconds — curiosity, bold claim, or a stat that stops scrolling
- Include 6–10 [VISUAL: ...] cues spread throughout for B-roll pacing
- Plant an open loop early ("By the end of this video, you'll know exactly why...") and resolve it
- Language must sound natural when read aloud — avoid passive voice and complex sentence structure
- Every section must earn its place — cut anything the viewer could skip without losing the story
- End with a CTA that asks for a specific action (subscribe, comment with their answer, watch next)

Write the complete, production-ready script now:`;

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CONFIG.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 4000,
        temperature: 0.82,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const script = data.choices?.[0]?.message?.content;

    if (!script) throw new Error('No script returned from API.');

    clearTimeout(skeletonTimer);
    currentScript = script;
    incrementUsage();
    saveTopicHistory(topic);
    autoSaveScript(script, topic, document.getElementById('niche').value);

    displayScript(script, topic, length);

    // Check if this was the last free use
    if (!isProUser() && getRemainingScripts() === 0) {
      setTimeout(() => {
        const usageTip = document.querySelector('.usage-tip');
        if (usageTip) {
          usageTip.style.color = '#ff61a6';
          usageTip.textContent = '⚠️ Last free script used — upgrade for unlimited';
        }
      }, 500);
    }

    updateUsageBar();
    updateGenerateBtnState();
    updateNavCTA();

  } catch (err) {
    clearTimeout(skeletonTimer);
    showError(err.message);
  } finally {
    isGenerating = false;
    setLoadingState(false);
  }
}

function displayScript(script, topic, length) {
  const outputDiv = document.getElementById('gen-output');
  const contentDiv = document.getElementById('script-content');
  const statsSpan = document.getElementById('output-stats');

  // Word count + topic label + script stats
  const words = script.split(/\s+/).filter(Boolean).length;
  const estimatedMins = Math.round(words / 150);
  const brollCount = (script.match(/\[VISUAL:/gi) || []).length;
  const sectionCount = (script.match(/^\[(?!VISUAL)[^\]]{2,60}\]$/gm) || []).length;
  const topicLabel = topic ? `"${topic.length > 46 ? topic.slice(0, 43) + '...' : topic}" · ` : '';
  const isShort = length === 'short';
  const targetWords = { 'short': 150, '5': 750, '8': 1200, '10': 1500, '12': 1800, '15': 2250 }[length] || 1500;
  const onTarget = Math.abs(words - targetWords) <= 120;
  const targetBadge = onTarget ? ' · ✅ On target' : ` · ⚠️ ${words < targetWords ? 'shorter' : 'longer'} than target`;
  if (statsSpan) statsSpan.textContent = isShort
    ? `${topicLabel}⚡ YouTube Short · ~${words} words · ${brollCount} visual cues`
    : `${topicLabel}~${words.toLocaleString()} words · ~${estimatedMins} min · ${sectionCount} sections · ${brollCount} B-roll cues`;

  // Word count progress bar
  const wcWrap = document.getElementById('wc-bar-wrap');
  const wcFill = document.getElementById('wc-bar-fill');
  const wcLabel = document.getElementById('wc-bar-label');
  if (wcWrap && wcFill && wcLabel) {
    const pct = Math.min(100, Math.round((words / targetWords) * 100));
    wcFill.style.width = pct + '%';
    wcFill.className = 'wc-bar-fill' + (onTarget ? ' wc-ok' : words < targetWords ? ' wc-short' : ' wc-over');
    wcLabel.textContent = `${words.toLocaleString()} / ${targetWords.toLocaleString()} words (${pct}%)`;
    wcWrap.classList.remove('hidden');
  }

  // Reset output badge and add niche label + personal counter
  const badge = document.querySelector('.output-badge');
  const totalGenerated = parseInt(localStorage.getItem('sf_total') || '1', 10);
  const streak = getStreak();
  if (badge) badge.textContent = streak >= 2 ? `✅ Script #${totalGenerated} · 🔥 ${streak}-day streak` : `✅ Script #${totalGenerated} Ready`;
  const niche = document.getElementById('niche')?.value || '';
  const nicheOption = niche ? document.querySelector(`#niche option[value="${niche}"]`) : null;
  const nicheLabel = nicheOption?.textContent?.replace(/\s+/g, ' ')?.trim() || '';
  const existingNicheBadge = document.getElementById('output-niche');
  if (existingNicheBadge) existingNicheBadge.remove();
  if (nicheLabel && badge) {
    const nb = document.createElement('span');
    nb.id = 'output-niche';
    nb.className = 'output-niche-badge';
    nb.textContent = nicheLabel;
    badge.insertAdjacentElement('afterend', nb);
  }
  contentDiv.innerHTML = formatScript(script);

  // Show output + voiceover links + performance tip + quality report + topic suggestions
  outputDiv.classList.remove('hidden');
  outputDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('voiceover-links')?.classList.remove('hidden');
  showNichePerfTip(niche);
  showQualityReport(script);
  showTitleOptions(topic, niche);
  showContentCalendar(niche, topic);
  showChannelNames(niche);
  showTopicSuggestions(niche);

  // Success toast + upgrade nudge
  const nowRemaining = getRemainingScripts();
  const nudge = document.getElementById('upgrade-nudge');
  if (!isProUser()) {
    if (nowRemaining === 0) {
      setTimeout(() => showToast('🎉 Script ready! That was your last free one — upgrade to keep creating.', 'warning'), 800);
      if (nudge) nudge.classList.add('hidden');
    } else if (nowRemaining === 1) {
      setTimeout(() => showToast('⚡ 1 free script remaining — make it count!', 'warning'), 800);
      if (nudge) nudge.classList.remove('hidden');
    } else {
      setTimeout(() => showToast(`✅ Script ready! ${nowRemaining} free scripts remaining.`, 'success'), 800);
      if (nudge) nudge.classList.add('hidden');
    }
  } else {
    if (nudge) nudge.classList.add('hidden');
  }
}

function formatScript(script) {
  const lines = script.split('\n');
  let html = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      html += '<br>';
      continue;
    }

    // Strip markdown bold wrappers the AI sometimes adds: **[HOOK]** → [HOOK]
    const stripped = trimmed.replace(/^\*\*(.+)\*\*$/, '$1').trim();

    // Visual cues [VISUAL: ...] — check first to avoid false positives
    if (/^\[VISUAL:/i.test(stripped)) {
      const cueText = stripped.replace(/^\[VISUAL:\s*/i, '').replace(/\]$/, '');
      html += `<span class="visual-cue">🎬 <em>${escapeHtml(cueText)}</em></span><br>`;
      continue;
    }

    // Section headers: [HOOK], [INTRO], [SECTION 1: Title], [CALL TO ACTION], etc.
    // Matches any [...] that's the entire line (case-insensitive)
    if (/^\[.{2,60}\]$/.test(stripped)) {
      const label = stripped.slice(1, -1).replace(/^SECTION \d+:\s*/i, '').replace(/^CALL TO ACTION$/i, 'Call to Action');
      html += `<span class="script-section-header" data-section="${escapeHtml(label)}">${escapeHtml(stripped)} <button class="sec-copy-btn" onclick="copySectionText(this)" title="Copy this section">⎘</button></span>`;
      continue;
    }

    // Lines that start with ** or ## (markdown-style headers AI might output)
    if (/^(\*\*|##)\s/.test(stripped)) {
      const clean = stripped.replace(/^(\*\*|##)\s*/, '').replace(/\*\*$/, '');
      html += `<span class="script-section-header">${escapeHtml(clean)}</span>`;
      continue;
    }

    // Regular spoken line
    html += `<span class="script-para">${escapeHtml(stripped)}</span><br>`;
  }

  return html;
}

function copySectionText(btn) {
  // Collect all text until next section header
  const headerEl = btn.closest('.script-section-header');
  if (!headerEl) return;
  const sectionLabel = headerEl.dataset.section || '';
  const parts = [];
  let node = headerEl.nextSibling;
  while (node) {
    if (node.classList?.contains('script-section-header')) break;
    if (node.textContent?.trim()) parts.push(node.textContent.trim());
    node = node.nextSibling;
  }
  const text = `[${sectionLabel.toUpperCase()}]\n` + parts.filter(Boolean).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓';
    btn.style.color = '#22c55e';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1500);
  });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showPaywall() {
  document.getElementById('gen-form').classList.add('hidden');
  document.getElementById('gen-output').classList.add('hidden');
  document.getElementById('paywall').classList.remove('hidden');
  document.getElementById('paywall').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showError(message) {
  const outputDiv = document.getElementById('gen-output');
  const contentDiv = document.getElementById('script-content');
  contentDiv.innerHTML = `<div style="padding:24px 20px;text-align:center">
    <div style="font-size:2rem;margin-bottom:12px">⚠️</div>
    <strong style="color:#f87171;font-size:1rem">Generation failed</strong>
    <p style="color:#888;font-size:0.85rem;margin:8px 0 20px">${escapeHtml(message)}</p>
    <button onclick="generateScript()" style="background:rgba(124,92,252,0.15);border:1px solid rgba(124,92,252,0.3);color:#9d82fd;padding:10px 24px;border-radius:8px;font-size:0.88rem;cursor:pointer;font-family:inherit">
      🔄 Try again
    </button>
    <p style="color:#555;font-size:0.75rem;margin-top:12px">If the issue persists, contact <a href="mailto:liumingkai1207@gmail.com" style="color:#7c5cfc">support</a></p>
  </div>`;
  outputDiv.classList.remove('hidden');
}

// === UI HELPERS ===
const LOADING_STEPS = [
  'Analyzing your topic...',
  'Crafting your hook...',
  'Building the content structure...',
  'Writing main sections...',
  'Adding B-roll cues...',
  'Polishing for virality...',
];

function setLoadingState(loading) {
  const btn = document.getElementById('generate-btn');
  const btnText = document.getElementById('btn-text');
  const btnLoading = document.getElementById('btn-loading');
  const loadingText = document.getElementById('loading-text');

  if (loading) {
    btn.disabled = true;
    // Cycle through progress messages every 2.2s
    let step = 0;
    if (loadingText) loadingText.textContent = LOADING_STEPS[0];
    clearInterval(_progressTimer);
    _progressTimer = setInterval(() => {
      step = Math.min(step + 1, LOADING_STEPS.length - 1);
      if (loadingText) loadingText.textContent = LOADING_STEPS[step];
    }, 2200);
    animateGenProgress(true);
    showLoadingTips(true);
    document.title = '✍️ Writing your script... | ScriptFlare';
  } else {
    clearInterval(_progressTimer);
    animateGenProgress(false);
    showLoadingTips(false);
    if (document.hidden) {
      // Flash "ready" in title if user switched tabs during generation
      let flashes = 0;
      const flashInterval = setInterval(() => {
        document.title = flashes % 2 === 0
          ? '⚡ Script ready! | ScriptFlare'
          : 'ScriptFlare — AI Script Writer for Faceless YouTube Channels';
        if (++flashes >= 6) {
          clearInterval(flashInterval);
          document.title = 'ScriptFlare — AI Script Writer for Faceless YouTube Channels';
        }
      }, 800);
    } else {
      document.title = 'ScriptFlare — AI Script Writer for Faceless YouTube Channels';
    }
    const outOfScripts = getRemainingScripts() <= 0 && !isProUser();
    btn.disabled = false;
    btn.style.background = '';
    if (outOfScripts) {
      btnText.textContent = '🔒 Upgrade to Pro to Continue';
      btn.style.background = 'linear-gradient(135deg, #3d2a7a, #7a1f50)';
    } else {
      btnText.textContent = '⚡ Generate Script';
    }
  }

  if (loading) {
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
  } else {
    btnText.classList.remove('hidden');
    btnLoading.classList.add('hidden');
  }
}

function shakeField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = '#f87171';
  el.style.animation = 'shake 0.4s ease';
  el.focus();
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.animation = '';
  }, 1000);
}

function showLoadingSkeleton() {
  const outputDiv = document.getElementById('gen-output');
  const contentDiv = document.getElementById('script-content');
  const statsSpan = document.getElementById('output-stats');
  if (!outputDiv || !contentDiv) return;
  if (statsSpan) statsSpan.textContent = 'Writing your script...';
  contentDiv.innerHTML = `
    <div class="skeleton-header"></div>
    <div class="skeleton-line w-95"></div>
    <div class="skeleton-line w-88"></div>
    <div class="skeleton-line w-92"></div>
    <div class="skeleton-line w-75"></div>
    <div class="skeleton-spacer"></div>
    <div class="skeleton-header w-40"></div>
    <div class="skeleton-line w-90"></div>
    <div class="skeleton-line w-85"></div>
    <div class="skeleton-line w-95"></div>
    <div class="skeleton-line w-70"></div>
    <div class="skeleton-spacer"></div>
    <div class="skeleton-header w-40"></div>
    <div class="skeleton-line w-92"></div>
    <div class="skeleton-line w-88"></div>
  `;
  outputDiv.classList.remove('hidden');
  const header = document.querySelector('.output-meta .output-badge');
  if (header) header.textContent = '✍️ Generating...';
}

function regenerateScript() {
  // Keep current form values, just re-generate
  document.getElementById('gen-output').classList.add('hidden');
  document.getElementById('gen-form').classList.remove('hidden');
  document.getElementById('topic-suggestions')?.classList.add('hidden');
  document.getElementById('title-options')?.classList.add('hidden');
  document.getElementById('desc-panel')?.classList.add('hidden');
  document.getElementById('content-calendar')?.classList.add('hidden');
  document.getElementById('channel-names')?.classList.add('hidden');
  document.getElementById('voiceover-links')?.classList.add('hidden');
  document.getElementById('upgrade-nudge')?.classList.add('hidden');
  document.getElementById('niche-perf-tip')?.classList.add('hidden');
  document.getElementById('script-quality')?.classList.add('hidden');
  document.getElementById('quality-tips')?.classList.add('hidden');
  document.getElementById('social-clips')?.classList.add('hidden');
  document.getElementById('prod-outline')?.classList.add('hidden');
  document.getElementById('hook-ab')?.classList.add('hidden');
  document.getElementById('blog-post-panel')?.classList.add('hidden');
  document.getElementById('script-content')?.classList.remove('hide-broll');
  document.getElementById('broll-toggle')?.classList.remove('broll-off');
  currentScript = '';
  generateScript();
}

function clearOutput() {
  document.getElementById('gen-output').classList.add('hidden');
  document.getElementById('gen-form').classList.remove('hidden');
  document.getElementById('topic-suggestions')?.classList.add('hidden');
  document.getElementById('title-options')?.classList.add('hidden');
  document.getElementById('desc-panel')?.classList.add('hidden');
  document.getElementById('content-calendar')?.classList.add('hidden');
  document.getElementById('channel-names')?.classList.add('hidden');
  document.getElementById('script-quality')?.classList.add('hidden');
  document.getElementById('quality-tips')?.classList.add('hidden');
  document.getElementById('quality-keywords')?.classList.add('hidden');
  document.getElementById('voiceover-links')?.classList.add('hidden');
  document.getElementById('niche-perf-tip')?.classList.add('hidden');
  document.getElementById('social-clips')?.classList.add('hidden');
  document.getElementById('prod-outline')?.classList.add('hidden');
  document.getElementById('hook-ab')?.classList.add('hidden');
  document.getElementById('blog-post-panel')?.classList.add('hidden');
  document.getElementById('niche-hint')?.classList.remove('visible');
  document.getElementById('script-content')?.classList.remove('hide-broll');
  document.getElementById('broll-toggle')?.classList.remove('broll-off');
  localStorage.removeItem('sf_autosave');
  currentScript = '';
  const topicEl = document.getElementById('topic');
  topicEl.value = '';
  updateTopicCounter();
  topicEl.focus();
  topicEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// === AUDIENCE PRESET PICK ===
function setAudience(value) {
  document.getElementById('audience').value = value;
  document.querySelectorAll('.audience-preset').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick').includes(`'${value}'`));
  });
}

function updateTopicCounter() {
  const input = document.getElementById('topic');
  const counter = document.getElementById('topic-counter');
  if (!input || !counter) return;
  const len = input.value.length;
  counter.textContent = `${len} / 200`;
  counter.style.color = len > 160 ? 'var(--yellow)' : '';
}

// === TOAST ===
function showToast(message, type = 'info') {
  const existing = document.querySelector('.sf-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'sf-toast sf-toast-' + type;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('sf-toast-visible');
    setTimeout(() => {
      toast.classList.remove('sf-toast-visible');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  });
}

// === SCRIPT QUALITY REPORT ===
function showQualityReport(script) {
  const qDiv = document.getElementById('script-quality');
  if (!qDiv) return;

  const lower = script.toLowerCase();
  const brollCount = (script.match(/\[VISUAL:/gi) || []).length;
  const hasHook = /\[hook\]/i.test(script);
  const hasCTA = /\[call to action\]/i.test(script) || /\[cta\]/i.test(script);
  const hasOpenLoop = ['stay tuned','coming up','find out','later in','keep watching','stick around','by the end'].some(p => lower.includes(p));

  // Hook strength: extract hook section and analyze for power patterns
  const hookMatch = script.match(/\[HOOK\]([\s\S]*?)(?=\[(?!VISUAL:))/i);
  const hookText = hookMatch ? hookMatch[1].toLowerCase() : lower.slice(0, 400);
  let hookStrength = 0;
  if (/\d+%|\d+ out of \d+|\d+ in \d+/.test(hookText)) hookStrength++;           // specific stat/number
  if (/what if|imagine|did you know|here's the thing/.test(hookText)) hookStrength++; // curiosity opener
  if (/secret|nobody|truth|real reason|hidden|mistake/.test(hookText)) hookStrength++; // intrigue words
  if (hookText.split('.').length >= 3) hookStrength++;                             // multi-sentence hook
  if (/you|your/.test(hookText)) hookStrength++;                                   // second-person engagement

  const set = (id, ok, label) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'quality-item ' + (ok ? 'q-ok' : 'q-miss');
    el.textContent = (ok ? '✅ ' : '⚠️ ') + label;
  };

  const hookBars = '▰'.repeat(hookStrength) + '▱'.repeat(5 - hookStrength);
  set('q-hook', hasHook, `Hook  ${hookBars}`);
  set('q-broll', brollCount >= 4, `${brollCount} B-Roll Cues`);
  set('q-openloop', hasOpenLoop, 'Open Loop');
  set('q-cta', hasCTA, 'CTA');

  // Compute score
  let score = 0;
  if (hasHook) score += 22;
  if (hookStrength >= 4) score += 8;
  else if (hookStrength >= 2) score += 4;
  if (brollCount >= 6) score += 22;
  else if (brollCount >= 4) score += 18;
  else if (brollCount >= 2) score += 10;
  if (hasOpenLoop) score += 22;
  if (hasCTA) score += 22;
  const sectionCount = (script.match(/^\[(?!VISUAL)[^\]]{2,60}\]$/gm) || []).length;
  if (sectionCount >= 4) score = Math.min(100, score + 4);

  const hookPts = hasHook ? 22 : 0;
  const hookStrPts = hookStrength >= 4 ? 8 : hookStrength >= 2 ? 4 : 0;
  const brollPts = brollCount >= 6 ? 22 : brollCount >= 4 ? 18 : brollCount >= 2 ? 10 : 0;
  const loopPts = hasOpenLoop ? 22 : 0;
  const ctaPts = hasCTA ? 22 : 0;
  const secPts = (script.match(/^\[(?!VISUAL)[^\]]{2,60}\]$/gm) || []).length >= 4 ? 4 : 0;

  const scoreBreakdown = [
    { label: 'Hook section', pts: hookPts, max: 22 },
    { label: 'Hook strength', pts: hookStrPts, max: 8 },
    { label: 'B-roll cues', pts: brollPts, max: 22 },
    { label: 'Open loop', pts: loopPts, max: 22 },
    { label: 'CTA', pts: ctaPts, max: 22 },
    { label: 'Structure', pts: secPts, max: 4 },
  ];

  const scoreEl = document.getElementById('quality-score');
  if (scoreEl) {
    const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B' : 'C';
    scoreEl.textContent = grade;
    scoreEl.title = `Click to see score breakdown`;
    scoreEl.className = 'quality-score clickable ' + (score >= 80 ? 'score-high' : score >= 60 ? 'score-mid' : 'score-low');
    scoreEl.onclick = () => toggleScoreBreakdown(score, scoreBreakdown);
  }

  // Per-section word count breakdown
  const sections = [];
  let curSection = null, curWords = 0;
  for (const line of script.split('\n')) {
    const t = line.trim().replace(/^\*\*(.+)\*\*$/, '$1').trim();
    const isHeader = /^\[.{2,60}\]$/.test(t) && !/^\[VISUAL:/i.test(t);
    if (isHeader) {
      if (curSection) sections.push({ label: curSection, words: curWords });
      curSection = t.slice(1, -1).replace(/^SECTION\s*\d+:\s*/i, '').replace(/^CALL TO ACTION$/i, 'CTA');
      if (curSection.length > 22) curSection = curSection.slice(0, 20) + '…';
      curWords = 0;
    } else if (curSection && t && !/^\[VISUAL:/i.test(t)) {
      curWords += t.split(/\s+/).filter(Boolean).length;
    }
  }
  if (curSection) sections.push({ label: curSection, words: curWords });

  let breakdownEl = document.getElementById('section-breakdown');
  if (sections.length >= 2) {
    if (!breakdownEl) {
      breakdownEl = document.createElement('div');
      breakdownEl.id = 'section-breakdown';
      breakdownEl.className = 'section-breakdown';
      qDiv.insertAdjacentElement('afterend', breakdownEl);
    }
    breakdownEl.innerHTML = '<span class="breakdown-label">Sections:</span>' +
      sections.map(({ label, words }) => {
        const cls = words < 50 ? 'sec-short' : words > 600 ? 'sec-long' : '';
        return `<span class="sec-chip ${cls}" title="${words} words">${label} <em>${words}w</em></span>`;
      }).join('');
    breakdownEl.classList.remove('hidden');
  } else if (breakdownEl) {
    breakdownEl.classList.add('hidden');
  }

  // Top keywords (stop-word filtered word frequency)
  const STOPWORDS = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','was','are','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','that','this','these','those','it','its','i','you','your','we','our','they','their','he','she','his','her','what','which','who','how','when','where','why','not','no','so','as','if','then','than','there','here','about','into','through','after','before','between','up','down','out','off','over','under','again','further','once','just','more','most','other','some','such','own','same','too','very','s','t','re','ll','ve','d','m','now','also','even','each','any','all','both','few','more','while','because','during','every','only','where','whose','whom','against','while','without','within','along','following','across','behind','beyond','plus','except','up','out','around','upon','since','without']);
  const topWords = (() => {
    const freq = {};
    const clean = script.replace(/\[VISUAL:[^\]]*\]/gi, '').replace(/\[[^\]]*\]/g, '');
    for (const w of clean.toLowerCase().match(/\b[a-z]{4,}\b/g) || []) {
      if (!STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
  })();

  let kwEl = document.getElementById('quality-keywords');
  if (topWords.length >= 3) {
    if (!kwEl) {
      kwEl = document.createElement('div');
      kwEl.id = 'quality-keywords';
      kwEl.className = 'quality-keywords';
      qDiv.insertAdjacentElement('afterend', kwEl);
    }
    kwEl.innerHTML = '<span class="kw-label">Top Keywords:</span>' +
      topWords.map(([w, n]) => `<span class="kw-chip" title="${n} occurrences">${w}</span>`).join('');
    kwEl.classList.remove('hidden');
  } else if (kwEl) {
    kwEl.classList.add('hidden');
  }

  // Show actionable improvement tips for any failing items
  const tips = [];
  if (!hasHook) tips.push('Add a <strong>[HOOK]</strong> section header — it tells the AI to write a dedicated retention-optimized opening.');
  if (brollCount < 4) tips.push(`Only ${brollCount} B-roll cue${brollCount !== 1 ? 's' : ''} found — try adding <em>[VISUAL: description]</em> lines every 3–4 paragraphs.`);
  if (!hasOpenLoop) tips.push('No open loop detected — add "Stay with me because by the end of this video..." to boost watch time.');
  if (!hasCTA) tips.push('Missing <strong>[CALL TO ACTION]</strong> — always end with a specific CTA (like/subscribe/comment) for better algorithm signals.');

  let tipsEl = document.getElementById('quality-tips');
  if (tips.length) {
    if (!tipsEl) {
      tipsEl = document.createElement('div');
      tipsEl.id = 'quality-tips';
      tipsEl.className = 'quality-tips';
      qDiv.insertAdjacentElement('afterend', tipsEl);
    }
    tipsEl.innerHTML = '<strong>💡 Improvements:</strong> ' + tips.map(t => `<span>${t}</span>`).join(' · ');
    tipsEl.classList.remove('hidden');
  } else if (tipsEl) {
    tipsEl.classList.add('hidden');
  }

  qDiv.classList.remove('hidden');
}

function toggleScoreBreakdown(score, breakdown) {
  let el = document.getElementById('score-breakdown-pop');
  if (el) { el.remove(); return; }

  const qDiv = document.getElementById('script-quality');
  if (!qDiv) return;

  el = document.createElement('div');
  el.id = 'score-breakdown-pop';
  el.className = 'score-breakdown-pop';

  const rows = breakdown.map(({ label, pts, max }) => {
    const pct = Math.round((pts / max) * 100);
    const cls = pts === max ? 'sbr-full' : pts > 0 ? 'sbr-part' : 'sbr-zero';
    return `<div class="sbr-row">
      <span class="sbr-label">${label}</span>
      <div class="sbr-track"><div class="sbr-fill ${cls}" style="width:${pct}%"></div></div>
      <span class="sbr-pts ${cls}">${pts}/${max}</span>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="sbr-header">Score: <strong>${score}/100</strong> <button class="sbr-close" onclick="document.getElementById('score-breakdown-pop').remove()">✕</button></div>${rows}`;
  qDiv.insertAdjacentElement('afterend', el);
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// === NICHE PERFORMANCE TIPS ===
const NICHE_PERF_TIPS = {
  'personal finance':             '📊 <strong>Finance tip:</strong> Titles like "I tried X and made $Y" consistently outperform generic "how to make money" titles by 2–3×.',
  'motivation and mindset':       '🔥 <strong>Mindset tip:</strong> Open with a bold counter-intuitive claim — motivation viewers specifically seek out content that challenges their assumptions.',
  'true crime and mysteries':     '🔍 <strong>True crime tip:</strong> Tease the most shocking detail in your hook, then withhold it until 30–40% through the video to maximize retention.',
  'history and facts':            '📚 <strong>History tip:</strong> Titles framed as corrections ("The real reason X happened") outperform factual titles by up to 40% in this niche.',
  'technology and AI':            '🤖 <strong>Tech tip:</strong> Recency signals matter — include the current year in your title and hook to show viewers the content is up-to-date.',
  'business and entrepreneurship':'🏆 <strong>Business tip:</strong> Case study format ("How I went from X to Y") drives higher trust and longer watch time than advice-list format in this niche.',
  'self-improvement':             '📈 <strong>Self-improvement tip:</strong> Shorter videos (7–10 min) with immediate actionable steps outperform long motivational essays for watch-through rate.',
  'health and wellness':          '💪 <strong>Health tip:</strong> Lead with a relatable pain point in your hook ("If you\'re always tired despite sleeping 8 hours...") before delivering the solution.',
  'relationships and psychology': '🧠 <strong>Psychology tip:</strong> Vulnerability and specificity build trust fast in this niche — say "I was in a toxic relationship" not "some people are in toxic relationships".',
};

function showNichePerfTip(niche) {
  const el = document.getElementById('niche-perf-tip');
  if (!el) return;
  const tip = NICHE_PERF_TIPS[niche];
  if (tip) {
    el.innerHTML = tip;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

// === SURPRISE ME (random topic) ===
function surpriseTopic() {
  const niche = document.getElementById('niche').value;
  const pool = niche && TOPIC_SUGGESTIONS[niche]
    ? TOPIC_SUGGESTIONS[niche]
    : Object.values(TOPIC_SUGGESTIONS).flat();
  const topic = pool[Math.floor(Math.random() * pool.length)];
  const input = document.getElementById('topic');
  input.value = topic;
  updateTopicCounter();
  detectNicheFromTopic();
  input.focus();
  // Spin animation on the button
  const btn = document.querySelector('.btn-surprise');
  if (btn) { btn.style.transform = 'rotate(360deg)'; setTimeout(() => { btn.style.transform = ''; }, 400); }
  showToast('🎲 Random topic loaded — hit generate!', 'success');
}

// === SCRIPT FORMAT TEMPLATES ===
const FORMAT_TEMPLATES = {
  listicle: {
    tone: 'listicle and punchy',
    notes: 'Use a numbered countdown format (e.g. #5 to #1). Each item should have its own [SECTION] header. End with a surprise or bonus item.',
    label: '🔢 Top Listicle',
  },
  story: {
    tone: 'storytelling and narrative',
    notes: 'Open with a hook about the subject before they were famous/successful. Use chronological story structure with a clear turning point and takeaway.',
    label: '📖 Origin Story',
  },
  mistakes: {
    tone: 'engaging and educational',
    notes: 'Structure as "X Mistakes [audience] Makes With [topic]". Each mistake = one section with the mistake, why it\'s wrong, and the correct approach.',
    label: '❌ Common Mistakes',
  },
  deepdive: {
    tone: 'documentary-style',
    notes: 'Go deeper than surface-level. Cover history, context, expert perspectives, and implications. Use the open loop to promise a controversial insight early.',
    label: '🔍 Deep Dive',
  },
  quicktips: {
    tone: 'conversational and casual',
    notes: 'Fast-paced, one practical tip per section. Each tip should be 2-3 sentences max. Prioritize tips the viewer can act on today.',
    label: '⚡ Quick Tips',
  },
  transformation: {
    tone: 'storytelling and narrative',
    notes: 'Use a Before → Turning Point → After structure. Open with the "before" state the audience recognizes, reveal the turning point mid-video, close with the transformation outcome.',
    label: '🎭 Before & After',
  },
};

function applyTemplate(key) {
  const tpl = FORMAT_TEMPLATES[key];
  if (!tpl) return;
  const toneEl = document.getElementById('tone');
  const notesEl = document.getElementById('custom-notes');
  if (toneEl) toneEl.value = tpl.tone;
  if (notesEl) notesEl.value = tpl.notes;
  // Visual active state
  document.querySelectorAll('.ft-chip').forEach(c => c.classList.remove('ft-active'));
  event?.target?.classList.add('ft-active');
  showToast(`${tpl.label} template applied!`, 'success');
}

// === MORE ACTIONS TOGGLE ===
function toggleMoreActions() {
  const more = document.getElementById('output-actions-more');
  const btn = document.getElementById('output-more-toggle');
  if (!more) return;
  const open = !more.classList.contains('hidden');
  more.classList.toggle('hidden', open);
  if (btn) btn.textContent = open ? '⋯ More' : '▲ Less';
}

// === VOICE INPUT ===
function startVoiceInput() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = document.getElementById('btn-mic');
  if (!SpeechRec) {
    showToast('🎙️ Voice input not supported in this browser — try Chrome.', 'error');
    return;
  }
  if (btn.classList.contains('mic-active')) return; // already listening

  const rec = new SpeechRec();
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  btn.classList.add('mic-active');
  btn.title = 'Listening…';

  rec.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    const input = document.getElementById('topic');
    input.value = transcript;
    updateTopicCounter();
    detectNicheFromTopic();
    input.focus();
    showToast('🎙️ Got it! Review your topic and hit Generate.', 'success');
  };
  rec.onerror = () => {
    showToast('🎙️ Could not hear you — try again.', 'error');
  };
  rec.onend = () => {
    btn.classList.remove('mic-active');
    btn.title = 'Speak your topic idea';
  };
  rec.start();
}

// === LOADING TIPS ===
const LOADING_TIPS = [
  'Top faceless channels post 4–7 videos per week consistently',
  'Videos 8–15 min capture the most mid-roll ad revenue',
  'Your hook decides 50% of your watch time — make it count',
  'Open loops ("I\'ll explain why later...") boost retention by up to 40%',
  'B-roll that changes every 3–5 seconds keeps viewers from clicking away',
  'Finance and self-improvement have some of the highest YouTube CPM rates',
  'YouTube rewards consistency over one-off viral videos',
  'The first 30 seconds decide: 3 minutes watched, or 10',
  'Most 6-figure faceless channels outsource only their scripting and editing',
  'AI voiceover tools like ElevenLabs work best with conversational scripts',
];
let _loadingTipTimer = null;

function showLoadingTips(show) {
  const wrap = document.getElementById('loading-tip-wrap');
  const textEl = document.getElementById('loading-tip-text');
  if (!wrap || !textEl) return;
  clearInterval(_loadingTipTimer);
  if (!show) { wrap.classList.add('hidden'); return; }

  let idx = Math.floor(Math.random() * LOADING_TIPS.length);
  textEl.textContent = LOADING_TIPS[idx];
  wrap.classList.remove('hidden');
  textEl.style.transition = 'opacity 0.2s';

  _loadingTipTimer = setInterval(() => {
    idx = (idx + 1) % LOADING_TIPS.length;
    textEl.style.opacity = '0';
    setTimeout(() => { textEl.textContent = LOADING_TIPS[idx]; textEl.style.opacity = '1'; }, 220);
  }, 4500);
}

// === TOPIC HISTORY ===
function saveTopicHistory(topic) {
  if (!topic || topic.length < 5) return;
  try {
    const raw = localStorage.getItem('sf_topic_history');
    let hist = raw ? JSON.parse(raw) : [];
    hist = hist.filter(t => t !== topic);  // remove duplicate
    hist.unshift(topic);
    hist = hist.slice(0, 5);  // keep last 5
    localStorage.setItem('sf_topic_history', JSON.stringify(hist));
    renderTopicHistory();
  } catch (_) {}
}

function renderTopicHistory() {
  try {
    const raw = localStorage.getItem('sf_topic_history');
    if (!raw) return;
    const hist = JSON.parse(raw);
    if (!hist?.length) return;
    const wrap = document.getElementById('topic-history');
    const chips = document.getElementById('topic-history-chips');
    if (!wrap || !chips) return;
    chips.innerHTML = hist.map(t =>
      `<button class="topic-history-chip" title="${t.replace(/"/g, '&quot;')}" onclick="reuseHistoryTopic(this)">${t.length > 40 ? t.slice(0, 38) + '…' : t}</button>`
    ).join('');
    wrap.classList.remove('hidden');
  } catch (_) {}
}

function reuseHistoryTopic(btn) {
  const full = btn.title || btn.textContent;
  document.getElementById('topic').value = full;
  updateTopicCounter();
  detectNicheFromTopic();
}

// === COPY HOOK ===
function copyHook() {
  if (!currentScript) return;
  const hookMatch = currentScript.match(/\[HOOK\]([\s\S]*?)(?=\[(?!VISUAL:))/i);
  const hookText = hookMatch ? hookMatch[1].trim() : '';
  if (!hookText) { showToast('⚠️ No [HOOK] section found in this script.', 'warning'); return; }
  navigator.clipboard.writeText(hookText).then(() => {
    showToast('✅ Hook copied to clipboard!', 'success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = hookText;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✅ Hook copied!', 'success');
  });
}

// === SHARE ON X ===
function shareOnX() {
  const topic = document.getElementById('topic').value.trim() || 'my YouTube topic';
  const shortTopic = topic.length > 50 ? topic.slice(0, 47) + '...' : topic;
  const hook = extractHook(currentScript);
  const hookSnippet = hook ? `\n\n"${hook.slice(0, 100).trim()}${hook.length > 100 ? '...' : ''}"` : '';
  const text = `Just generated a full YouTube script in 30 seconds with ScriptFlare ⚡\n\nTopic: "${shortTopic}"${hookSnippet}\n\nGet 3 free scripts →`;
  const url = 'https://mingkai1207.github.io/scriptflare/';
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'width=560,height=400');
}

// === COPY & DOWNLOAD ===
function copyScript() {
  if (!currentScript) return;
  navigator.clipboard.writeText(currentScript).then(() => {
    const copyBtn = document.getElementById('copy-text');
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => { copyBtn.textContent = '📋 Copy Script'; }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = currentScript;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const copyBtn = document.getElementById('copy-text');
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => { copyBtn.textContent = '📋 Copy Script'; }, 2000);
  });
}

function downloadScript() {
  if (!currentScript) return;
  const topic = document.getElementById('topic').value.trim() || 'youtube-script';
  const nicheName = document.querySelector('#niche option:checked')?.textContent?.trim() || '';
  const length = document.getElementById('length').value;
  const words = currentScript.split(/\s+/).filter(Boolean).length;
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const sep = '═'.repeat(56);

  const header = `${sep}
  SCRIPTFLARE — YOUTUBE SCRIPT
  ${sep}
  Topic:     ${topic}
  Niche:     ${nicheName || 'General'}
  Length:    ${length === 'short' ? 'YouTube Short (60s)' : length + ' minutes'} (~${words} words)
  Generated: ${date}
  ${sep}

`;

  const footer = `

  ${sep}
  Generated by ScriptFlare — AI Script Writer for Faceless YouTube
  https://mingkai1207.github.io/scriptflare/
  ${sep}`;

  const filename = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) + '-scriptflare.txt';
  const blob = new Blob([header + currentScript + footer], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function copyAsMarkdown() {
  if (!currentScript) return;
  const topic = document.getElementById('topic').value.trim() || 'YouTube Script';
  const nicheName = document.querySelector('#niche option:checked')?.textContent?.trim() || '';
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const md = currentScript.split('\n').map(line => {
    const t = line.trim();
    if (!t) return '';
    if (/^\[VISUAL:/i.test(t)) return `> 🎬 ${t.replace(/^\[VISUAL:\s*/i, '').replace(/\]$/, '')}`;
    if (/^\[HOOK\]$/i.test(t)) return '## Hook';
    if (/^\[INTRO\]$/i.test(t)) return '## Intro';
    if (/^\[CALL TO ACTION\]$/i.test(t)) return '## Call to Action';
    if (/^\[CTA\]$/i.test(t)) return '## Call to Action';
    if (/^\[SECTION \d+:\s*/i.test(t)) return `## ${t.replace(/^\[SECTION \d+:\s*/i, '').replace(/\]$/, '')}`;
    if (/^\[.{2,60}\]$/.test(t)) return `## ${t.slice(1, -1)}`;
    return t;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const header = `# ${topic}\n\n_${nicheName}${nicheName ? ' · ' : ''}Generated ${date} by ScriptFlare_\n\n---\n\n`;
  navigator.clipboard.writeText(header + md).then(() => {
    showToast('✅ Markdown copied — paste into Notion, Obsidian, or any editor!', 'success');
  }).catch(() => showToast('⚠️ Copy failed — try again', 'error'));
}

function exportSRT() {
  if (!currentScript) return;
  const WPM = 150;
  const topic = document.getElementById('topic').value.trim() || 'youtube-script';

  // Split script into spoken sentences (skip visual cues and section headers)
  const sentences = [];
  for (const line of currentScript.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (/^\[VISUAL:/i.test(t)) continue;
    if (/^\[.{2,60}\]$/.test(t)) continue; // section header
    // Split long lines into ≤12-word chunks for subtitle readability
    const words = t.split(/\s+/).filter(Boolean);
    const chunkSize = 10;
    for (let i = 0; i < words.length; i += chunkSize) {
      sentences.push(words.slice(i, i + chunkSize).join(' '));
    }
  }

  const toSRTTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.round((secs % 1) * 1000);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
  };

  let srt = '';
  let elapsed = 0;
  sentences.forEach((text, i) => {
    const wordCount = text.split(/\s+/).length;
    const duration = (wordCount / WPM) * 60;
    const start = elapsed;
    elapsed += duration;
    srt += `${i + 1}\n${toSRTTime(start)} --> ${toSRTTime(elapsed)}\n${text}\n\n`;
  });

  if (!srt.trim()) { showToast('⚠️ No spoken text found in script.', 'warning'); return; }

  const filename = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) + '-scriptflare.srt';
  const blob = new Blob([srt], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📄 SRT file downloaded — import into YouTube Studio as captions!', 'success');
}

function printScript() {
  if (!currentScript) return;
  const topic = document.getElementById('topic').value.trim() || 'YouTube Script';
  const nicheName = document.querySelector('#niche option:checked')?.textContent?.trim() || '';
  const length = document.getElementById('length').value;
  const win = window.open('', '_blank', 'width=800,height=900');
  const bodyHtml = currentScript.split('\n').map(line => {
    const t = line.trim();
    if (!t) return '<br>';
    if (/^\[VISUAL:/i.test(t)) return `<div class="vc">${escapeHtml(t)}</div>`;
    if (/^\[.{2,60}\]$/.test(t)) return `<div class="sh">${escapeHtml(t)}</div>`;
    return `<p>${escapeHtml(t)}</p>`;
  }).join('\n');

  win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(topic)}</title>
<style>
  body{font-family:Georgia,serif;max-width:680px;margin:40px auto;line-height:1.85;color:#111;padding:0 24px}
  h1{font-size:1.3rem;margin-bottom:2px;font-weight:700}
  .meta{color:#666;font-size:0.82rem;margin-bottom:28px;border-bottom:1px solid #eee;padding-bottom:12px}
  .sh{font-weight:700;font-size:0.9rem;margin:28px 0 8px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #ddd;padding-bottom:3px}
  .vc{color:#7c5cfc;font-style:italic;font-size:0.85rem;margin:6px 0 6px 12px}
  p{margin:0 0 10px}
  .footer{margin-top:40px;padding-top:12px;border-top:1px solid #eee;font-size:0.75rem;color:#999;text-align:center}
  @media print{body{margin:20px}}
</style></head><body>
<h1>${escapeHtml(topic)}</h1>
<div class="meta">${escapeHtml(nicheName)} · ${length} min · Generated by ScriptFlare</div>
${bodyHtml}
<div class="footer">Generated by ScriptFlare — mingkai1207.github.io/scriptflare/</div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

// === FAQ ACCORDION ===
function toggleFaq(el) {
  const answer = el.nextElementSibling;
  const isOpen = el.classList.contains('open');

  // Close all
  document.querySelectorAll('.faq-q').forEach(q => q.classList.remove('open'));
  document.querySelectorAll('.faq-a').forEach(a => a.classList.remove('open'));

  if (!isOpen) {
    el.classList.add('open');
    answer.classList.add('open');
  }
}

// === PRICING DEMAND STRIP ===
function initDemandStrip() {
  const el = document.getElementById('demand-text');
  if (!el) return;
  const messages = [
    '47 creators upgraded to Pro this week',
    '12 new Pro members joined today',
    '2,400+ creators are generating scripts right now',
    '38 scripts generated in the last hour',
    'Pro plan: 4.9 ⭐ from 340+ reviews',
  ];
  let idx = 0;
  setInterval(() => {
    idx = (idx + 1) % messages.length;
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = messages[idx];
      el.style.opacity = '1';
    }, 250);
  }, 6000);
  el.style.transition = 'opacity 0.25s ease';
}

// === B-ROLL TOGGLE ===
function toggleBroll() {
  const content = document.getElementById('script-content');
  const btn = document.getElementById('broll-toggle');
  if (!content) return;
  const hiding = content.classList.toggle('hide-broll');
  if (btn) btn.classList.toggle('broll-off', hiding);
  showToast(hiding ? '🎬 B-roll cues hidden' : '🎬 B-roll cues shown', 'info');
}

// === MOBILE NAV ===
function toggleMobileNav() {
  const links = document.querySelector('.nav-links');
  const btn = document.getElementById('nav-hamburger');
  if (!links || !btn) return;
  const open = links.classList.toggle('open');
  btn.classList.toggle('open', open);
}
// Close mobile nav when any nav link is clicked
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    document.querySelector('.nav-links')?.classList.remove('open');
    document.getElementById('nav-hamburger')?.classList.remove('open');
  });
});

// === GENERATION PROGRESS BAR ===
function animateGenProgress(loading) {
  const wrap = document.getElementById('gen-progress-wrap');
  const fill = document.getElementById('gen-progress-fill');
  const pctEl = document.getElementById('gen-progress-pct');
  if (!wrap || !fill) return;

  clearInterval(_progressBarTimer);

  if (!loading) {
    // Snap to 100%, then fade out
    fill.style.transition = 'width 0.4s ease';
    fill.style.width = '100%';
    if (pctEl) pctEl.textContent = '100%';
    setTimeout(() => {
      wrap.classList.add('hidden');
      // Reset for next use
      setTimeout(() => { fill.style.width = '0%'; fill.style.transition = ''; }, 200);
    }, 700);
    return;
  }

  wrap.classList.remove('hidden');
  fill.style.transition = 'none';
  fill.style.width = '0%';
  if (pctEl) pctEl.textContent = '0%';

  let pct = 0;
  // Ease toward 88% asymptotically — feels natural without knowing true completion
  requestAnimationFrame(() => {
    fill.style.transition = 'width 0.5s ease-out';
    _progressBarTimer = setInterval(() => {
      pct += (88 - pct) * 0.048;
      if (pct > 88) pct = 88;
      fill.style.width = pct.toFixed(1) + '%';
      if (pctEl) pctEl.textContent = Math.round(pct) + '%';
    }, 500);
  });
}

// === CONTENT CALENDAR ===
const CALENDAR_IDEAS = {
  'personal finance': [
    ['Mon', '📈', 'Why the stock market always goes up long-term — and how to profit'],
    ['Tue', '💳', 'The credit card strategy that earns $1,200+ in rewards per year'],
    ['Wed', '🏠', 'Renting vs buying in 2026: the real math nobody shows you'],
    ['Thu', '📊', '5 index fund mistakes that cost beginners thousands'],
    ['Fri', '💰', 'How to build a $1,000/month passive income in 18 months'],
    ['Sat', '🧾', 'The tax deductions W-2 employees almost never know about'],
    ['Sun', '🎯', 'Zero-based budgeting: the method that actually works for overspenders'],
  ],
  'motivation and mindset': [
    ['Mon', '⏰', 'Why waking up at 5am changed everything (and how to actually do it)'],
    ['Tue', '🧠', 'The psychology of why you keep procrastinating — and how to stop'],
    ['Wed', '💪', '30-day challenge: the habit stack that rewired my brain'],
    ['Thu', '🎯', 'Why most goals fail by February — and how to set ones that stick'],
    ['Fri', '🔥', 'The Stoic daily practice that removes 80% of your stress'],
    ['Sat', '📚', '5 books that permanently changed how I think about success'],
    ['Sun', '🌅', 'How to design your ideal week — and actually execute it'],
  ],
  'true crime and mysteries': [
    ['Mon', '🔍', 'The disappearance that baffled the FBI for 20 years'],
    ['Tue', '🕵️', 'Inside the most sophisticated bank heist in history'],
    ['Wed', '📁', 'The cold case that was solved by a 23andMe test'],
    ['Thu', '🚨', 'The con artist who fooled an entire city — twice'],
    ['Fri', '🗂️', 'Unsolved: the mysterious death that looks like suicide but wasn\'t'],
    ['Sat', '⚖️', 'How forensic accountants caught a $50M fraud hiding in plain sight'],
    ['Sun', '🎭', 'The true story of the imposter who lived someone else\'s life for 3 years'],
  ],
  'history and facts': [
    ['Mon', '🏛️', 'The Roman engineering secret that modern builders still can\'t replicate'],
    ['Tue', '⚔️', 'The battle that changed history — and nobody talks about it'],
    ['Wed', '🌍', 'The ancient civilization more advanced than Greece that history erased'],
    ['Thu', '📜', '10 "facts" from history class that are completely wrong'],
    ['Fri', '🗺️', 'Why the map of the world you grew up with is a lie'],
    ['Sat', '👑', 'The ruler who shaped the modern world — and you\'ve never heard of them'],
    ['Sun', '🔬', 'The scientific discovery that was made 2,000 years before we "invented" it'],
  ],
  'technology and AI': [
    ['Mon', '🤖', 'The AI tool that replaces 3 hours of work in 10 minutes'],
    ['Tue', '📱', 'Why your phone is making you less productive — and how to fix it'],
    ['Wed', '⚡', '5 AI tools in 2026 that most people haven\'t discovered yet'],
    ['Thu', '🔐', 'The cybersecurity threat hiding in your browser right now'],
    ['Fri', '💻', 'How AI is about to change your job — whether you like it or not'],
    ['Sat', '🌐', 'The internet is breaking: what happens when AI writes most of the web'],
    ['Sun', '🚀', 'The technology that will be bigger than the smartphone'],
  ],
  'business and entrepreneurship': [
    ['Mon', '💼', 'The $0 startup model making people $10K/month from a laptop'],
    ['Tue', '📣', 'Why most business ideas fail in year one — and the one that survives'],
    ['Wed', '🛒', 'The e-commerce niche nobody is targeting (yet)'],
    ['Thu', '🤝', 'How to land your first client with no portfolio and no experience'],
    ['Fri', '📊', 'The one metric that predicts business success better than revenue'],
    ['Sat', '🔑', '7 things every entrepreneur learns too late — learn them now'],
    ['Sun', '🏆', 'From $0 to $50K MRR: the exact 12-month playbook'],
  ],
  'self-improvement': [
    ['Mon', '🌱', 'The compound effect: why 1% better every day changes everything in a year'],
    ['Tue', '📵', 'A 30-day digital detox — what I learned and how my life changed'],
    ['Wed', '🧘', 'The focus technique that doubled my output without working more hours'],
    ['Thu', '📖', 'How to read 52 books a year (the system, not the motivation)'],
    ['Fri', '🏃', 'The science of building habits that actually last longer than 2 weeks'],
    ['Sat', '🗣️', 'The one communication skill that changes every relationship you have'],
    ['Sun', '🎯', 'How to design the version of yourself you want to be in 12 months'],
  ],
  'health and wellness': [
    ['Mon', '😴', 'The sleep science that doctors aren\'t telling you — and how to fix it tonight'],
    ['Tue', '🥗', 'Why 80% of diets fail in month 2 (and the one approach that doesn\'t)'],
    ['Wed', '🧠', 'The gut-brain connection that explains your mood, energy, and focus'],
    ['Thu', '💊', '5 supplements with actual science behind them — and 5 that are a waste'],
    ['Fri', '🏋️', 'The minimum effective dose of exercise for maximum health benefits'],
    ['Sat', '🫀', 'What your resting heart rate reveals about your biological age'],
    ['Sun', '⚡', 'The morning habit that reduces cortisol and stress within 10 minutes'],
  ],
  'relationships and psychology': [
    ['Mon', '🪞', 'The narcissism spectrum: how to spot it before you\'re trapped'],
    ['Tue', '💔', 'Why you keep attracting the same type of person — the real reason'],
    ['Wed', '🧩', 'Attachment theory explained: which type are you and what it means'],
    ['Thu', '🗣️', 'The 3 conversation patterns that destroy relationships slowly'],
    ['Fri', '🔮', 'Cognitive biases that are silently sabotaging your decisions every day'],
    ['Sat', '💞', 'What science says about the relationships that actually make people happy'],
    ['Sun', '🏗️', 'How to set boundaries without guilt (the psychology behind why it\'s hard)'],
  ],
  'travel and geography': [
    ['Mon', '🌏', 'The most isolated place on Earth — and the people who live there'],
    ['Tue', '🗺️', 'Why the map of the world you grew up with is technically a lie'],
    ['Wed', '🏔️', 'The country that borders the most others — and why it matters geopolitically'],
    ['Thu', '✈️', '5 places that will disappear within your lifetime due to climate change'],
    ['Fri', '🌊', 'The tiny island nation that\'s surprisingly one of the richest countries on Earth'],
    ['Sat', '🏙️', 'Why this "dangerous" city is actually one of the safest in the world'],
    ['Sun', '🌐', 'The hidden geography fact that explains every major war in history'],
  ],
  'spirituality and philosophy': [
    ['Mon', '📿', 'Marcus Aurelius\'s daily practice — and why it\'s more relevant now than ever'],
    ['Tue', '☯️', 'The Buddhist principle that removes 90% of modern suffering'],
    ['Wed', '🔬', 'What quantum physics accidentally revealed about consciousness'],
    ['Thu', '🎭', 'The Stoic exercise that completely reframes how you see problems'],
    ['Fri', '🌿', 'Taoism in one video — the philosophy that stops you fighting reality'],
    ['Sat', '🕯️', 'Viktor Frankl\'s framework for finding meaning in the hardest moments'],
    ['Sun', '🧭', 'The philosophical question that changes how you make every decision'],
  ],
  'news and current events': [
    ['Mon', '📡', 'The geopolitical shift that most people are completely unprepared for'],
    ['Tue', '💹', 'What the latest economic data actually means for your money'],
    ['Wed', '🤖', 'The AI regulation debate — and what governments are getting wrong'],
    ['Thu', '🌍', 'The hidden story behind the biggest headline of the week'],
    ['Fri', '🏛️', 'Why this policy decision will affect everyone in 5 years'],
    ['Sat', '📊', 'The data story nobody is covering — what the numbers actually show'],
    ['Sun', '🔭', 'What\'s coming next week: the events that will matter most'],
  ],
};

function getCalendarIdeas(niche, currentTopic) {
  const pool = CALENDAR_IDEAS[niche] || CALENDAR_IDEAS['self-improvement'];
  // Filter out if it matches current topic too closely
  return pool;
}

function showContentCalendar(niche, topic) {
  const wrap = document.getElementById('content-calendar');
  const list = document.getElementById('cal-ideas');
  if (!wrap || !list || !niche) return;

  const ideas = getCalendarIdeas(niche, topic);
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  list.innerHTML = ideas.map(([day, icon, idea]) => {
    const safeIdea = idea.replace(/'/g, "&#39;").replace(/"/g, '&quot;');
    return `<div class="cal-idea" onclick="useCalendarIdea('${safeIdea}')">
      <span class="cal-day">${day}</span>
      <span class="cal-icon">${icon}</span>
      <span class="cal-idea-text">${idea}</span>
      <span class="cal-use">Use →</span>
    </div>`;
  }).join('');

  wrap.classList.remove('hidden');
}

// === VIDEO DESCRIPTION GENERATOR ===
function generateChapterTimestamps(script) {
  // Parse script sections and estimate timestamps at ~143 WPM narration speed
  const WPM = 143;
  const lines = (script || '').split('\n');
  const sections = [];
  let currentSection = null;
  let currentWords = 0;

  for (const line of lines) {
    const t = line.trim().replace(/^\*\*(.+)\*\*$/, '$1').trim();
    const isHeader = /^\[.{2,60}\]$/.test(t) && !/^\[VISUAL:/i.test(t);
    if (isHeader) {
      if (currentSection) sections.push({ label: currentSection, words: currentWords });
      // Clean label: [SECTION 1: Title] → "Title", [HOOK] → "Hook", etc.
      let label = t.slice(1, -1);
      label = label.replace(/^SECTION\s*\d+:\s*/i, '').replace(/^CALL TO ACTION$/i, 'Call to Action');
      label = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
               .replace(/\b\w/g, c => c.toUpperCase());
      currentSection = label;
      currentWords = 0;
    } else if (currentSection && t && !/^\[VISUAL:/i.test(t)) {
      currentWords += t.split(/\s+/).filter(Boolean).length;
    }
  }
  if (currentSection) sections.push({ label: currentSection, words: currentWords });

  if (!sections.length) return '0:00 Introduction\n[Add more timestamps]';

  let totalSeconds = 0;
  return sections.map(({ label, words }) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const stamp = `${mins}:${String(secs).padStart(2, '0')} ${label}`;
    totalSeconds += Math.round((words / WPM) * 60);
    return stamp;
  }).join('\n');
}

function generateYouTubeTags(topic, niche) {
  const topicWords = (topic || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const nicheTags = {
    'personal finance':            ['personal finance','money tips','wealth building','financial freedom','investing for beginners','how to save money','budgeting','passive income','financial advice','money management'],
    'motivation and mindset':      ['motivation','mindset','success habits','self improvement','personal development','morning routine','discipline','growth mindset','how to be successful','productivity tips'],
    'true crime and mysteries':    ['true crime','crime documentary','unsolved mysteries','cold case','crime story','mystery','true crime story','criminal investigation','forensics','crime facts'],
    'history and facts':           ['history facts','world history','history documentary','historical facts','ancient history','history channel','history explained','interesting facts','hidden history','true history'],
    'technology and AI':           ['artificial intelligence','AI technology','tech news','future technology','AI tools','machine learning','technology explained','tech 2026','digital transformation','AI explained'],
    'business and entrepreneurship': ['business tips','entrepreneur','startup advice','how to make money','passive income','business ideas','entrepreneurship','side hustle','make money online','business strategy'],
    'self-improvement':            ['self improvement','personal growth','habits','productivity','how to improve yourself','better habits','self help','daily routine','life advice','positive habits'],
    'health and wellness':         ['health tips','wellness','healthy living','mental health','fitness','nutrition','longevity','healthy habits','wellness tips','health facts'],
    'relationships and psychology': ['psychology facts','relationship advice','human psychology','toxic relationships','self awareness','mental health','emotional intelligence','psychology explained','relationships','attachment theory'],
  };
  const base = nicheTags[niche] || ['educational','facts','explained','youtube','viral'];
  // Add topic-derived tags
  const topicTags = topicWords.slice(0, 3).map(w => w.replace(/[^a-z0-9]/g, ''));
  return [...new Set([...topicTags, ...base])].slice(0, 15).join(', ');
}

function generateVideoDescription(script, topic, niche) {
  const topicCap = (topic || '').trim();
  const topicCap2 = topicCap.charAt(0).toUpperCase() + topicCap.slice(1);

  // Extract section headers from script for bullet points
  const headers = [];
  (script || '').split('\n').forEach(line => {
    const m = line.trim().match(/^\[SECTION\s*\d*:?\s*(.+)\]$/i);
    if (m) headers.push(m[1].trim());
  });
  const bulletLines = headers.slice(0, 5).map(h => `▶ ${h}`).join('\n') ||
    '▶ The key facts nobody tells you\n▶ What experts actually recommend\n▶ How to apply this starting today';

  const chapters = generateChapterTimestamps(script);

  const nicheHashtags = {
    'personal finance':            '#PersonalFinance #MoneyTips #WealthBuilding #FinancialFreedom #Investing',
    'motivation and mindset':      '#Motivation #Mindset #Success #SelfImprovement #GrowthMindset',
    'true crime and mysteries':    '#TrueCrime #Mystery #ColdCase #Crime #TrueCrimeStory',
    'history and facts':           '#History #HistoryFacts #DidYouKnow #HistoryChannel #TrueHistory',
    'technology and AI':           '#Technology #AI #ArtificialIntelligence #TechNews #FutureTech',
    'business and entrepreneurship': '#Business #Entrepreneur #Startup #PassiveIncome #BusinessTips',
    'self-improvement':            '#SelfImprovement #PersonalGrowth #Habits #Productivity #Success',
    'health and wellness':         '#Health #Wellness #HealthTips #Fitness #Longevity',
    'relationships and psychology': '#Psychology #Relationships #MentalHealth #SelfAwareness #PersonalGrowth',
    'travel and geography':        '#Travel #Geography #TravelTips #WorldFacts #Explore',
    'spirituality and philosophy': '#Philosophy #Stoicism #Mindfulness #SpiritualGrowth #Wisdom',
    'news and current events':     '#News #CurrentEvents #WorldNews #Analysis #Explainer',
  };
  const hashtags = nicheHashtags[niche] || '#YouTube #Educational #Faceless #Viral';
  const tags = generateYouTubeTags(topic, niche);

  return `${topicCap2}

In this video, I break down everything you need to know about ${topicCap.toLowerCase() || 'this topic'}.

📌 WHAT YOU'LL LEARN:
${bulletLines}

⏱️ CHAPTERS:
${chapters}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
👍 If this helped you, like and subscribe for more content like this.
🔔 Hit the bell so you never miss a video.
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📬 CONTACT: [your email]
🌐 WEBSITE: [your website]

${hashtags}

TAGS: ${tags}

Script generated with ScriptFlare — https://mingkai1207.github.io/scriptflare/`;
}

function showDescriptionPanel() {
  if (!currentScript) return;
  const panel = document.getElementById('desc-panel');
  const content = document.getElementById('desc-content');
  if (!panel || !content) return;

  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    return;
  }

  const topic = document.getElementById('topic').value.trim();
  const niche = document.getElementById('niche').value;
  content.textContent = generateVideoDescription(currentScript, topic, niche);
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function copyDescription() {
  const content = document.getElementById('desc-content');
  if (!content?.textContent) return;
  navigator.clipboard.writeText(content.textContent).then(() => {
    const btn = document.getElementById('desc-copy-text');
    if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => { btn.textContent = '📋 Copy Description'; }, 2000); }
  }).catch(() => {});
}

function exportToGoogleDocs() {
  if (!currentScript) return;
  copyScript();
  setTimeout(() => {
    window.open('https://docs.google.com/document/create', '_blank', 'noopener,noreferrer');
    showToast('Script copied! Paste it into your new Google Doc (Ctrl+V / ⌘+V)', 'success');
  }, 300);
}

// === TELEPROMPTER ===
let _tpInterval = null;
let _tpPlaying = false;
let _tpSpeed = 1.2; // px per tick (50ms)
let _tpFontSize = 32;
let _tpShowBroll = true;

function openTeleprompter() {
  if (!currentScript) return;
  const modal = document.getElementById('teleprompter');
  const scriptDiv = document.getElementById('tp-script');
  if (!modal || !scriptDiv) return;

  // Build clean teleprompter HTML
  scriptDiv.innerHTML = buildTeleprompterHTML(currentScript, _tpShowBroll);
  scriptDiv.style.fontSize = _tpFontSize + 'px';
  scriptDiv.scrollTop = 0;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function buildTeleprompterHTML(script, showBroll) {
  const lines = script.split('\n');
  let html = '';
  for (const line of lines) {
    const t = line.trim().replace(/^\*\*(.+)\*\*$/, '$1').trim();
    if (!t) { html += '<div class="tp-spacer"></div>'; continue; }
    if (/^\[VISUAL:/i.test(t)) {
      if (showBroll) html += `<div class="tp-broll">🎬 ${escapeHtml(t.replace(/^\[VISUAL:\s*/i,'').replace(/\]$/,''))}</div>`;
      continue;
    }
    if (/^\[.{2,60}\]$/.test(t)) {
      html += `<div class="tp-header">${escapeHtml(t)}</div>`;
      continue;
    }
    html += `<div class="tp-line">${escapeHtml(t)}</div>`;
  }
  return html;
}

function closeTeleprompter() {
  tpStop();
  document.getElementById('teleprompter')?.classList.add('hidden');
  document.body.style.overflow = '';
}

function tpTogglePlay() {
  _tpPlaying ? tpStop() : tpStart();
}

function tpStart() {
  _tpPlaying = true;
  const btn = document.getElementById('tp-play-btn');
  if (btn) btn.textContent = '⏸ Pause';
  const div = document.getElementById('tp-script');
  _tpInterval = setInterval(() => {
    if (div) div.scrollTop += _tpSpeed;
  }, 50);
}

function tpStop() {
  _tpPlaying = false;
  clearInterval(_tpInterval);
  const btn = document.getElementById('tp-play-btn');
  if (btn) btn.textContent = '▶ Play';
}

function tpSpeedUp() {
  _tpSpeed = Math.min(_tpSpeed + 0.3, 5);
}

function tpSpeedDown() {
  _tpSpeed = Math.max(_tpSpeed - 0.3, 0.3);
}

function tpFontUp() {
  _tpFontSize = Math.min(_tpFontSize + 4, 72);
  const div = document.getElementById('tp-script');
  if (div) div.style.fontSize = _tpFontSize + 'px';
}

function tpFontDown() {
  _tpFontSize = Math.max(_tpFontSize - 4, 18);
  const div = document.getElementById('tp-script');
  if (div) div.style.fontSize = _tpFontSize + 'px';
}

function tpToggleBroll() {
  _tpShowBroll = !_tpShowBroll;
  const btn = document.getElementById('tp-broll-btn');
  if (btn) btn.textContent = `B-Roll: ${_tpShowBroll ? 'ON' : 'OFF'}`;
  const scriptDiv = document.getElementById('tp-script');
  if (scriptDiv && currentScript) {
    const pos = scriptDiv.scrollTop;
    scriptDiv.innerHTML = buildTeleprompterHTML(currentScript, _tpShowBroll);
    scriptDiv.scrollTop = pos;
  }
}

// Close teleprompter on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeTeleprompter();
  if (e.key === ' ' && !document.getElementById('teleprompter')?.classList.contains('hidden')) {
    e.preventDefault();
    tpTogglePlay();
  }
});

// === REGENERATE HOOK ONLY ===
async function regenerateHook() {
  if (!currentScript || isGenerating) return;
  const btn = document.getElementById('regen-hook-btn');
  const topic = document.getElementById('topic').value.trim();
  const niche = document.getElementById('niche').value;
  const tone = document.getElementById('tone').value;

  if (btn) { btn.textContent = '⏳ Writing...'; btn.disabled = true; }

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.apiKey}` },
      body: JSON.stringify({
        model: CONFIG.model,
        messages: [
          { role: 'system', content: 'You are an expert YouTube hook writer. Write only the [HOOK] section of a script — 3–5 sentences maximum. No section headers, no markdown. Just the spoken hook text, written to stop scrolling in the first 3 seconds. Include one [VISUAL: ...] cue on its own line.' },
          { role: 'user', content: `Write a brand new hook for a YouTube video.\nTopic: "${topic}"\nNiche: ${niche}\nTone: ${tone}\n\nMake it different from: "${extractHook(currentScript).slice(0, 200)}"\n\nWrite only the new hook text:` }
        ],
        max_tokens: 300,
        temperature: 0.9,
      }),
    });

    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    const newHook = data.choices?.[0]?.message?.content?.trim();
    if (!newHook) throw new Error('No hook returned');

    // Splice the new hook into the current script
    currentScript = replaceHookInScript(currentScript, newHook);
    autoSaveScript(currentScript, topic, niche);

    // Re-render
    const contentDiv = document.getElementById('script-content');
    if (contentDiv) contentDiv.innerHTML = formatScript(currentScript);
    showQualityReport(currentScript);
    showToast('🎣 New hook generated!', 'success');
    contentDiv?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    showToast('Hook generation failed — try again', 'warning');
  } finally {
    if (btn) { btn.textContent = '🎣 New Hook'; btn.disabled = false; }
  }
}

// === SOCIAL MEDIA REPURPOSER ===
async function showSocialClips() {
  if (!currentScript) return;

  const panel = document.getElementById('social-clips');
  const btn = document.getElementById('social-clips-btn');
  if (!panel) return;

  // Pro gate
  if (!isProUser()) {
    panel.innerHTML = `<div class="social-clips-gate">
      <span class="sc-lock">🔒</span>
      <strong>Pro Feature</strong>
      <p>Repurpose your script into tweets, LinkedIn posts, and Instagram captions automatically.</p>
      <a href="#pricing" class="btn btn-primary btn-sm" onclick="scrollToPricing()">Upgrade to Pro →</a>
    </div>`;
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  const topic = document.getElementById('topic').value.trim();
  const niche = document.getElementById('niche').value;
  const scriptExcerpt = currentScript.slice(0, 1800);

  panel.innerHTML = `<div class="sc-loading"><span class="spinner"></span> Repurposing your script…</div>`;
  panel.classList.remove('hidden');
  if (btn) { btn.textContent = '⏳ Repurposing…'; btn.disabled = true; }

  const systemPrompt = `You are a social media strategist. Given a YouTube script, create:
1. Three tweet-sized posts (each under 240 chars, punchy, no hashtags inline — add 2 relevant hashtags at end)
2. One LinkedIn post (150-200 words, professional framing, ends with a question)
3. One Instagram caption (100-130 words, conversational, 5 hashtags at end)

Format your response EXACTLY like this (use these exact labels):
TWEET 1: [tweet text]
TWEET 2: [tweet text]
TWEET 3: [tweet text]
LINKEDIN: [linkedin post]
INSTAGRAM: [instagram caption]`;

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.apiKey}` },
      body: JSON.stringify({
        model: CONFIG.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Topic: "${topic}"\nNiche: ${niche}\n\nScript excerpt:\n${scriptExcerpt}\n\nGenerate the social media posts:` }
        ],
        max_tokens: 900,
        temperature: 0.85,
      }),
    });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    renderSocialClips(panel, raw);
  } catch {
    panel.innerHTML = `<div class="sc-error">⚠️ Generation failed — try again.</div>`;
  } finally {
    if (btn) { btn.textContent = '📱 Repurpose'; btn.disabled = false; }
  }
}

function renderSocialClips(panel, raw) {
  const extract = (label) => {
    const re = new RegExp(label + ':\\s*([\\s\\S]*?)(?=(?:TWEET \\d|LINKEDIN|INSTAGRAM):|$)', 'i');
    return (raw.match(re)?.[1] || '').trim();
  };
  const tweets = [extract('TWEET 1'), extract('TWEET 2'), extract('TWEET 3')].filter(Boolean);
  const linkedin = extract('LINKEDIN');
  const instagram = extract('INSTAGRAM');

  const chipHtml = (text, icon, label) => {
    if (!text) return '';
    const safe = text.replace(/`/g, "'").replace(/</g, '&lt;');
    return `<div class="sc-card">
      <div class="sc-card-header">
        <span class="sc-platform">${icon} ${label}</span>
        <button class="sc-copy" onclick="copySocialClip(this, \`${safe}\`)">Copy</button>
      </div>
      <p class="sc-text">${safe.replace(/\n/g, '<br>')}</p>
    </div>`;
  };

  const tweetCards = tweets.map((t, i) => chipHtml(t, '𝕏', `Tweet ${i + 1}`)).join('');
  panel.innerHTML = `<div class="sc-header">
    <strong>📱 Social Media Repurpose</strong>
    <span class="sc-sub">Click any post to copy</span>
  </div>
  <div class="sc-grid">
    ${tweetCards}
    ${chipHtml(linkedin, 'in', 'LinkedIn')}
    ${chipHtml(instagram, '📸', 'Instagram')}
  </div>`;
}

function copySocialClip(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1800);
  });
}

// === PRODUCTION OUTLINE ===
function showProductionOutline() {
  if (!currentScript) return;
  const panel = document.getElementById('prod-outline');
  if (!panel) return;

  // Toggle
  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    return;
  }

  const WPM = 150;
  const topic = document.getElementById('topic').value.trim() || 'YouTube Script';
  const niche = document.querySelector('#niche option:checked')?.textContent?.trim() || '';

  // Parse sections
  const lines = currentScript.split('\n');
  const scenes = [];
  let cur = null;

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const isHeader = /^\[.{2,60}\]$/.test(t) && !/^\[VISUAL:/i.test(t);
    if (isHeader) {
      if (cur) scenes.push(cur);
      const raw = t.slice(1, -1);
      const label = raw.replace(/^SECTION \d+:\s*/i, '').replace(/^CALL TO ACTION$/i, 'Call to Action');
      cur = { label, broll: [], words: 0, spoken: [] };
    } else if (cur) {
      if (/^\[VISUAL:/i.test(t)) {
        cur.broll.push(t.replace(/^\[VISUAL:\s*/i, '').replace(/\]$/, '').trim());
      } else {
        cur.words += t.split(/\s+/).filter(Boolean).length;
        cur.spoken.push(t);
      }
    }
  }
  if (cur) scenes.push(cur);

  // Build timecodes
  let elapsed = 0;
  const rows = scenes.map((scene, i) => {
    const secs = Math.round((scene.words / WPM) * 60);
    const tc = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
    const start = tc(elapsed);
    elapsed += secs;
    const end = tc(elapsed);
    const brollHtml = scene.broll.map(b => `<li class="po-broll-item">🎬 ${escapeHtml(b)}</li>`).join('');
    const previewText = scene.spoken[0] ? escapeHtml(scene.spoken[0].slice(0, 90)) + (scene.spoken[0].length > 90 ? '…' : '') : '';
    return `<div class="po-scene">
      <div class="po-scene-head">
        <span class="po-num">Scene ${i + 1}</span>
        <span class="po-label">${escapeHtml(scene.label)}</span>
        <span class="po-tc">${start} – ${end}</span>
        <span class="po-wc">${scene.words}w</span>
      </div>
      ${previewText ? `<p class="po-preview">"${previewText}"</p>` : ''}
      ${brollHtml ? `<ul class="po-broll">${brollHtml}</ul>` : ''}
    </div>`;
  }).join('');

  const totalSecs = elapsed;
  const totalMins = (totalSecs / 60).toFixed(1);

  panel.innerHTML = `<div class="po-header">
    <div>
      <strong>🎬 Production Outline</strong>
      <span class="po-meta">${scenes.length} scenes · ~${totalMins} min at 150 WPM</span>
    </div>
    <button class="btn btn-outline btn-sm" onclick="copyProductionOutline()">📋 Copy Outline</button>
  </div>
  <div class="po-scenes">${rows || '<p class="po-empty">No sections detected — generate a structured script first.</p>'}</div>`;

  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function copyProductionOutline() {
  const panel = document.getElementById('prod-outline');
  if (!panel) return;
  // Extract text content cleanly
  const text = Array.from(panel.querySelectorAll('.po-scene')).map(scene => {
    const head = scene.querySelector('.po-scene-head');
    const num = head?.querySelector('.po-num')?.textContent || '';
    const label = head?.querySelector('.po-label')?.textContent || '';
    const tc = head?.querySelector('.po-tc')?.textContent || '';
    const wc = head?.querySelector('.po-wc')?.textContent || '';
    const preview = scene.querySelector('.po-preview')?.textContent || '';
    const broll = Array.from(scene.querySelectorAll('.po-broll-item')).map(li => `  ${li.textContent}`).join('\n');
    return `${num}: ${label} [${tc}] (${wc})\n${preview ? preview + '\n' : ''}${broll}`.trim();
  }).join('\n\n');

  navigator.clipboard.writeText(text).then(() => showToast('📋 Outline copied!', 'success'));
}

// === HOOK A/B TESTER ===
async function showHookAB() {
  if (!currentScript || isGenerating) return;
  const panel = document.getElementById('hook-ab');
  const btn = document.getElementById('hook-ab-btn');
  if (!panel) return;

  if (!isProUser()) {
    showToast('🔒 Hook A/B testing is a Pro feature — upgrade to unlock.', 'warning');
    setTimeout(() => scrollToPricing(), 600);
    return;
  }

  // Toggle off
  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    return;
  }

  const topic = document.getElementById('topic').value.trim();
  const niche = document.getElementById('niche').value;
  const tone = document.getElementById('tone').value;

  panel.innerHTML = `<div class="hab-loading"><span class="spinner"></span> Generating 3 hook variations…</div>`;
  panel.classList.remove('hidden');
  if (btn) { btn.textContent = '⏳ Testing…'; btn.disabled = true; }

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.apiKey}` },
      body: JSON.stringify({
        model: CONFIG.model,
        messages: [
          { role: 'system', content: `You write YouTube script hooks. Generate exactly 3 distinct hook variations for the same video. Each uses a different psychological trigger:
- Hook 1: Curiosity gap (start with "What if..." or a surprising question)
- Hook 2: Bold claim / stat (start with a specific number or counter-intuitive claim)
- Hook 3: Relatable pain point (start with "If you've ever..." or a common frustration)

Format your output EXACTLY like this:
HOOK 1:
[3–5 sentences of spoken hook text]
[VISUAL: relevant visual cue]

HOOK 2:
[3–5 sentences]
[VISUAL: relevant visual cue]

HOOK 3:
[3–5 sentences]
[VISUAL: relevant visual cue]

Write only the hooks. No extra commentary.` },
          { role: 'user', content: `Topic: "${topic}"\nNiche: ${niche}\nTone: ${tone}\n\nGenerate 3 hook variations:` }
        ],
        max_tokens: 700,
        temperature: 0.9,
      }),
    });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    renderHookAB(panel, raw);
  } catch {
    panel.innerHTML = `<div class="hab-error">⚠️ Generation failed — try again.</div>`;
  } finally {
    if (btn) { btn.textContent = '🎯 Test Hooks'; btn.disabled = false; }
  }
}

function renderHookAB(panel, raw) {
  const LABELS = ['Curiosity Gap', 'Bold Claim', 'Pain Point'];
  const ICONS = ['🤔', '💥', '😓'];
  const parts = raw.split(/HOOK \d+:/i).slice(1);

  if (!parts.length) {
    panel.innerHTML = `<div class="hab-error">⚠️ Could not parse hooks — try again.</div>`;
    return;
  }

  const cards = parts.slice(0, 3).map((text, i) => {
    const clean = text.trim();
    const safe = clean.replace(/`/g, "'").replace(/</g, '&lt;');
    const preview = clean.slice(0, 160).replace(/\[VISUAL:[^\]]*\]/gi, '').trim();
    return `<div class="hab-card">
      <div class="hab-card-head">
        <span class="hab-type">${ICONS[i] || '🎣'} ${LABELS[i] || `Hook ${i+1}`}</span>
        <button class="hab-use" onclick="applyHookVariant(this, \`${safe.replace(/`/g, '\\`')}\`)">Use this hook</button>
      </div>
      <p class="hab-preview">${escapeHtml(preview)}${clean.length > 160 ? '…' : ''}</p>
    </div>`;
  }).join('');

  panel.innerHTML = `<div class="hab-header">
    <strong>🎯 Hook A/B Variations</strong>
    <span class="hab-sub">Click "Use this hook" to splice it into your script</span>
  </div>
  <div class="hab-cards">${cards}</div>`;
}

function applyHookVariant(btn, hookText) {
  if (!currentScript) return;
  currentScript = replaceHookInScript(currentScript, hookText);
  const topic = document.getElementById('topic').value.trim();
  const niche = document.getElementById('niche').value;
  autoSaveScript(currentScript, topic, niche);
  const contentDiv = document.getElementById('script-content');
  if (contentDiv) contentDiv.innerHTML = formatScript(currentScript);
  showQualityReport(currentScript);
  const orig = btn.textContent;
  btn.textContent = '✅ Applied!';
  btn.style.background = 'rgba(34,197,94,0.15)';
  btn.style.borderColor = 'rgba(34,197,94,0.4)';
  btn.style.color = '#22c55e';
  setTimeout(() => { btn.textContent = orig; btn.style.cssText = ''; }, 2000);
  showToast('🎯 Hook applied — check the quality score!', 'success');
}

// === BLOG POST CONVERTER ===
async function showBlogPost() {
  if (!currentScript || isGenerating) return;
  const panel = document.getElementById('blog-post-panel');
  const btn = document.getElementById('blog-post-btn');
  if (!panel) return;

  if (!isProUser()) {
    panel.innerHTML = `<div class="bp-gate">
      <span class="bp-gate-icon">🔒</span>
      <strong>Pro Feature</strong>
      <p>Convert your YouTube script into an SEO-optimized blog post automatically.</p>
      <a href="#pricing" class="btn btn-primary btn-sm" onclick="scrollToPricing()">Upgrade to Pro →</a>
    </div>`;
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  // Toggle off
  if (!panel.classList.contains('hidden') && panel.querySelector('.bp-content')) {
    panel.classList.add('hidden');
    return;
  }

  const topic = document.getElementById('topic').value.trim();
  const niche = document.getElementById('niche').value;

  panel.innerHTML = `<div class="bp-loading"><span class="spinner"></span> Converting to blog post…</div>`;
  panel.classList.remove('hidden');
  if (btn) { btn.textContent = '⏳ Converting…'; btn.disabled = true; }

  const scriptExcerpt = currentScript.slice(0, 2500);

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.apiKey}` },
      body: JSON.stringify({
        model: CONFIG.model,
        messages: [
          { role: 'system', content: `You are an SEO content writer. Convert a YouTube script into a well-structured blog post.

Rules:
- Remove all [VISUAL: ...] cues and [SECTION] headers
- Convert spoken language to written prose (remove "guys", "in this video", etc.)
- Add an SEO-optimized H1 title
- Use ## subheadings for each section
- Add a 2-sentence SEO meta description at the very top, prefixed with "META: "
- Add a natural intro paragraph (no "In this article" opener)
- Add a conclusion paragraph with a call-to-action to watch the YouTube video
- Target 700-900 words total
- Return only the blog post content, no preamble` },
          { role: 'user', content: `Topic: "${topic}"\nNiche: ${niche}\n\nScript to convert:\n${scriptExcerpt}\n\nConvert to blog post:` }
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    const post = data.choices?.[0]?.message?.content?.trim();
    if (!post) throw new Error('Empty response');
    renderBlogPost(panel, post, topic);
  } catch {
    panel.innerHTML = `<div class="bp-loading">⚠️ Conversion failed — try again.</div>`;
  } finally {
    if (btn) { btn.textContent = '📝 Blog Post'; btn.disabled = false; }
  }
}

function renderBlogPost(panel, post, topic) {
  // Extract and strip meta description
  const metaMatch = post.match(/^META:\s*(.+)/m);
  const meta = metaMatch ? metaMatch[1].trim() : '';
  const content = post.replace(/^META:\s*.+\n?/m, '').trim();

  // Simple markdown → HTML conversion for display
  const html = content
    .replace(/^# (.+)$/gm, '<h2 class="bp-h1">$1</h2>')
    .replace(/^## (.+)$/gm, '<h3 class="bp-h2">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^(?!<[hb])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');

  panel.innerHTML = `<div class="bp-header">
    <strong>📝 Blog Post</strong>
    <div class="bp-actions">
      <button class="btn btn-outline btn-sm" onclick="copyBlogPost()">📋 Copy</button>
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('blog-post-panel').classList.add('hidden')">✕</button>
    </div>
  </div>
  ${meta ? `<div class="bp-meta-row"><span class="bp-meta-label">SEO Meta:</span> <span class="bp-meta-text">${escapeHtml(meta)}</span></div>` : ''}
  <div class="bp-content" id="bp-content-text" data-raw="${escapeHtml(content)}">${html}</div>`;
}

function copyBlogPost() {
  const el = document.getElementById('bp-content-text');
  if (!el) return;
  const raw = el.dataset.raw || el.textContent;
  navigator.clipboard.writeText(raw).then(() => showToast('📋 Blog post copied!', 'success'));
}

// === IMPROVE SCRIPT ===
async function improveScript() {
  if (!currentScript || isGenerating) return;

  const btn = document.getElementById('improve-btn');

  if (!isProUser()) {
    showToast('🔒 Script improvement is a Pro feature — upgrade to unlock.', 'warning');
    setTimeout(() => scrollToPricing(), 600);
    return;
  }

  // Diagnose quality gaps
  const lower = currentScript.toLowerCase();
  const hasHook = /\[hook\]/i.test(currentScript);
  const brollCount = (currentScript.match(/\[VISUAL:/gi) || []).length;
  const hasOpenLoop = ['stay tuned','coming up','find out','later in','keep watching','stick around','by the end'].some(p => lower.includes(p));
  const hasCTA = /\[call to action\]/i.test(currentScript) || /\[cta\]/i.test(currentScript);

  const improvements = [];
  if (!hasHook) improvements.push('Add a dedicated [HOOK] section that grabs attention in the first 3 seconds');
  if (brollCount < 4) improvements.push(`Increase B-roll cues — currently only ${brollCount}, aim for 6–8 spread throughout`);
  if (!hasOpenLoop) improvements.push('Add an open loop early in the script (hint at a revelation to pay off later)');
  if (!hasCTA) improvements.push('Add a [CALL TO ACTION] section at the end asking viewers to subscribe/comment');

  if (!improvements.length) {
    showToast('✅ Script already scores well — nothing major to improve!', 'success');
    return;
  }

  const topic = document.getElementById('topic').value.trim();
  const niche = document.getElementById('niche').value;
  const tone = document.getElementById('tone').value;

  if (btn) { btn.textContent = '⏳ Improving…'; btn.disabled = true; }

  const improvementList = improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n');

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.apiKey}` },
      body: JSON.stringify({
        model: CONFIG.model,
        messages: [
          { role: 'system', content: `You are a professional YouTube script editor. You receive a script and a list of specific improvements to make. Apply ONLY the listed improvements — keep everything else identical. Preserve all existing section headers, B-roll cues, and structure. Return only the improved script, no commentary.` },
          { role: 'user', content: `Topic: "${topic}"\nNiche: ${niche}\nTone: ${tone}\n\nImprovements to apply:\n${improvementList}\n\nOriginal script:\n${currentScript}\n\nReturn the improved script:` }
        ],
        max_tokens: 2800,
        temperature: 0.75,
      }),
    });

    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    const improved = data.choices?.[0]?.message?.content?.trim();
    if (!improved || improved.length < 100) throw new Error('Bad response');

    currentScript = improved;
    autoSaveScript(improved, topic, niche);

    const contentDiv = document.getElementById('script-content');
    if (contentDiv) contentDiv.innerHTML = formatScript(improved);
    const length = document.getElementById('length').value;
    displayScript(improved, topic, length);
    showQualityReport(improved);
    showToast(`✨ Script improved! Applied ${improvements.length} fix${improvements.length > 1 ? 'es' : ''}.`, 'success');
  } catch {
    showToast('Improvement failed — try again', 'warning');
  } finally {
    if (btn) { btn.textContent = '✨ Improve'; btn.disabled = false; }
  }
}

function extractHook(script) {
  const lines = (script || '').split('\n');
  let inHook = false, hookLines = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^\[HOOK\]$/i.test(t)) { inHook = true; continue; }
    if (inHook && /^\[.{2,60}\]$/.test(t) && !/^\[VISUAL:/i.test(t)) break;
    if (inHook && t) hookLines.push(t);
  }
  return hookLines.join(' ');
}

function replaceHookInScript(script, newHook) {
  const lines = script.split('\n');
  const result = [];
  let inHook = false, hookReplaced = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^\[HOOK\]$/i.test(t)) {
      inHook = true;
      result.push(line);
      result.push('');
      result.push(newHook);
      result.push('');
      hookReplaced = true;
      continue;
    }
    if (inHook) {
      // Skip old hook lines until next section header
      if (/^\[.{2,60}\]$/.test(t) && !/^\[VISUAL:/i.test(t)) { inHook = false; result.push(line); }
      continue;
    }
    result.push(line);
  }
  return hookReplaced ? result.join('\n') : script;
}

// === CHANNEL NAME GENERATOR ===
const CHANNEL_NAME_POOLS = {
  'personal finance': [
    'WealthWire', 'The Compound Effect', 'MoneyMindset Daily', 'Fiscal Forward', 'The Wealth Blueprint',
    'Stack & Scale', 'The Money Mechanic', 'Quiet Millionaire', 'Net Worth Narrative', 'The Financial Edge',
  ],
  'motivation and mindset': [
    'MindShift Daily', 'The Discipline Lab', 'Forge & Focus', 'Inner Drive', 'The Mindset Engine',
    'Unshaken', 'The 1% Journal', 'Rise Mechanics', 'Clarity Over Comfort', 'Built Not Born',
  ],
  'true crime and mysteries': [
    'Cold Case Files', 'The Evidence Room', 'Unsolved Files', 'Dark Archives', 'Crime Chronicle',
    'The Case Files', 'Shadow Dossier', 'True Crime Vault', 'The Incident Room', 'Mystery Dispatch',
  ],
  'history and facts': [
    'History Unlocked', 'The Archive', 'Past Redefined', 'Hidden Centuries', 'The History Vault',
    'Chronicles Untold', 'The Real Record', 'Forgotten Pages', 'History Rewired', 'The Epoch',
  ],
  'technology and AI': [
    'Future Decoded', 'The Algorithm', 'AI Insider', 'Tech Horizon', 'Digital Frontiers',
    'The Neural Path', 'Code & Consequence', 'Silicon Brief', 'The Tech Signal', 'Beyond Beta',
  ],
  'business and entrepreneurship': [
    'Founder Mode', 'The Startup Brief', 'Built to Scale', 'Zero to Revenue', 'The Operator',
    'Leverage & Growth', 'The Business Playbook', 'Founder\'s Edge', 'Revenue Mechanics', 'The Pivot',
  ],
  'self-improvement': [
    'Level Up Daily', 'The Upgrade', 'Better by Design', 'The Growth Lab', 'Compound Self',
    'The 1% Shift', 'Habit Architecture', 'The Self Project', 'Optimized Life', 'The Upgrade Files',
  ],
  'health and wellness': [
    'Longevity Lab', 'The Wellness Brief', 'Body Intelligence', 'Vitality Decoded', 'The Health Signal',
    'Optimal Human', 'The Wellness Stack', 'Biology Unlocked', 'Prime Protocol', 'The Recovery Room',
  ],
  'relationships and psychology': [
    'Mind Mechanics', 'The Psychology Files', 'Human Pattern', 'The Inner Map', 'Behavioral Brief',
    'The Relationship Lab', 'Psych Decoded', 'The Human Condition', 'Pattern Recognition', 'Mind Architecture',
  ],
  'travel and geography': [
    'Terra Incognita', 'The World Brief', 'Geography Unlocked', 'Unknown Coordinates', 'The Atlas',
    'Wander Decoded', 'The Globe Files', 'Maps & Meaning', 'Hidden Nations', 'The World Report',
  ],
  'spirituality and philosophy': [
    'The Examined Life', 'Stoic Daily', 'Wisdom Protocol', 'The Philosophy Brief', 'Inner Compass',
    'The Meaning Engine', 'Ancient Forward', 'Logos & Life', 'The Virtue Path', 'Mind & Meaning',
  ],
  'news and current events': [
    'The Briefing', 'Signal vs Noise', 'Context First', 'The Deep Dive', 'Behind the Headline',
    'The Explainer', 'Current Intelligence', 'The World Desk', 'Ground Truth', 'The Real Story',
  ],
};

function showChannelNames(niche) {
  const wrap = document.getElementById('channel-names');
  const list = document.getElementById('channel-names-list');
  if (!wrap || !list || !niche) return;

  const pool = CHANNEL_NAME_POOLS[niche] || CHANNEL_NAME_POOLS['motivation and mindset'];
  // Pick 5 random names
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);

  list.innerHTML = shuffled.map(name => {
    const safe = name.replace(/'/g, "&#39;");
    return `<div class="channel-name-chip" onclick="copyChannelName(this, '${safe}')">${name}<span class="channel-name-copy">Copy</span></div>`;
  }).join('');
  wrap.classList.remove('hidden');
}

function copyChannelName(el, name) {
  navigator.clipboard.writeText(name).then(() => {
    const copy = el.querySelector('.channel-name-copy');
    if (copy) { copy.textContent = '✓'; setTimeout(() => { copy.textContent = 'Copy'; }, 1800); }
  }).catch(() => {});
}

// === LIGHT/DARK MODE TOGGLE ===
function initTheme() {
  const saved = localStorage.getItem('sf_theme');
  if (saved === 'light') applyTheme('light');
}

function toggleTheme() {
  const isLight = document.body.classList.contains('light-mode');
  applyTheme(isLight ? 'dark' : 'light');
}

function applyTheme(mode) {
  const btn = document.getElementById('theme-toggle');
  if (mode === 'light') {
    document.body.classList.add('light-mode');
    if (btn) btn.textContent = '☀️';
    localStorage.setItem('sf_theme', 'light');
  } else {
    document.body.classList.remove('light-mode');
    if (btn) btn.textContent = '🌙';
    localStorage.setItem('sf_theme', 'dark');
  }
}

// === STARTER CHECKLIST MODAL ===
function openChecklist() {
  document.getElementById('checklist-modal')?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeChecklist(e, force) {
  if (force || (e && e.target === document.getElementById('checklist-modal'))) {
    document.getElementById('checklist-modal')?.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// === VOICE PROFILE ===
function openVoiceProfile() {
  const modal = document.getElementById('vp-modal');
  if (!modal) return;
  // Load saved values
  const saved = JSON.parse(localStorage.getItem('sf_voice_profile') || '{}');
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('vp-channel-name', saved.channelName);
  set('vp-catchphrase', saved.catchphrase);
  set('vp-avoid', saved.avoid);
  set('vp-style', saved.style);
  const note = document.getElementById('vp-pro-note');
  if (note) {
    if (isProUser()) {
      note.textContent = '✅ Pro active — voice profile applied to all scripts.';
      note.style.color = '#22c55e';
    } else {
      note.innerHTML = '🔒 <a href="#pricing" onclick="scrollToPricing(); closeVoiceProfile(null,true)">Upgrade to Pro</a> to enable voice profile injection.';
      note.style.color = 'var(--text-faint)';
    }
  }
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('vp-channel-name')?.focus(), 100);
}

function closeVoiceProfile(e, force) {
  if (force || (e && e.target === document.getElementById('vp-modal'))) {
    document.getElementById('vp-modal')?.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function saveVoiceProfile() {
  const get = id => document.getElementById(id)?.value.trim() || '';
  const profile = {
    channelName: get('vp-channel-name'),
    catchphrase: get('vp-catchphrase'),
    avoid: get('vp-avoid'),
    style: get('vp-style'),
  };
  localStorage.setItem('sf_voice_profile', JSON.stringify(profile));
  closeVoiceProfile(null, true);
  showToast('⚙️ Voice profile saved!', 'success');
}

function clearVoiceProfile() {
  localStorage.removeItem('sf_voice_profile');
  ['vp-channel-name','vp-catchphrase','vp-avoid','vp-style'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  showToast('Voice profile cleared.', 'success');
}

function getVoiceProfileNote() {
  if (!isProUser()) return '';
  const p = JSON.parse(localStorage.getItem('sf_voice_profile') || '{}');
  const parts = [];
  if (p.channelName) parts.push(`This script is for the YouTube channel "${p.channelName}".`);
  if (p.style) parts.push(`Brand voice: ${p.style}.`);
  if (p.avoid) parts.push(`Avoid these words/topics: ${p.avoid}.`);
  if (p.catchphrase) parts.push(`End the CTA with the channel's sign-off: "${p.catchphrase}"`);
  return parts.length ? `\nChannel voice profile: ${parts.join(' ')}` : '';
}

// === KEYBOARD SHORTCUTS MODAL ===
const SHORTCUTS = [
  { keys: ['⌘', 'Enter'], desc: 'Generate script' },
  { keys: ['⌘', 'S'], desc: 'Download script (.txt)' },
  { keys: ['?'], desc: 'Show this help modal' },
  { keys: ['Esc'], desc: 'Close any open panel or modal' },
  { keys: ['Space'], desc: 'Play / pause teleprompter' },
  { keys: ['↑', '↓'], desc: 'Speed up / slow down teleprompter' },
];

function toggleShortcutsModal() {
  const existing = document.getElementById('shortcuts-modal');
  if (existing) { existing.remove(); document.body.style.overflow = ''; return; }

  const el = document.createElement('div');
  el.id = 'shortcuts-modal';
  el.className = 'shortcuts-modal';
  el.onclick = (e) => { if (e.target === el) { el.remove(); document.body.style.overflow = ''; } };

  el.innerHTML = `<div class="shortcuts-box">
    <div class="shortcuts-header">
      <strong>Keyboard Shortcuts</strong>
      <button class="vp-close" onclick="document.getElementById('shortcuts-modal').remove(); document.body.style.overflow='';">✕</button>
    </div>
    <div class="shortcuts-list">
      ${SHORTCUTS.map(({ keys, desc }) =>
        `<div class="shortcut-row">
          <span class="shortcut-keys">${keys.map(k => `<kbd>${k}</kbd>`).join(' + ')}</span>
          <span class="shortcut-desc">${desc}</span>
        </div>`
      ).join('')}
    </div>
    <p class="shortcuts-tip">Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</p>
  </div>`;

  document.body.appendChild(el);
  document.body.style.overflow = 'hidden';
}

// === EXIT INTENT MODAL ===
let _exitShown = false;
function initExitIntent() {
  // Only show to non-Pro users who haven't generated a script yet
  if (isProUser()) return;
  document.addEventListener('mouseleave', (e) => {
    if (_exitShown) return;
    if (e.clientY > 20) return; // only trigger when cursor leaves from top
    const usage = parseInt(localStorage.getItem(CONFIG.storageKey) || '0', 10);
    if (usage > 0) return; // already used the tool — don't interrupt
    _exitShown = true;
    setTimeout(() => document.getElementById('exit-modal')?.classList.remove('hidden'), 200);
  });
}

function closeExitModal(e, force) {
  if (force || (e && e.target === document.getElementById('exit-modal'))) {
    document.getElementById('exit-modal')?.classList.add('hidden');
  }
}

// === COPY PAYPAL EMAIL ===
function copyPaypalEmail(btn) {
  navigator.clipboard.writeText('liumingkai1207@gmail.com').then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.style.color = '#6ee7b7';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 2000);
  }).catch(() => {});
}

// === PRICING COUNTDOWN TIMER ===
function initPricingCountdown() {
  const el = document.getElementById('pricing-countdown');
  if (!el) return;
  // Launch price "expires" 30 days from a fixed anchor date (Apr 4 2026)
  const anchor = new Date('2026-04-04T00:00:00Z').getTime();
  const expires = anchor + 30 * 24 * 60 * 60 * 1000;

  const update = () => {
    const now = Date.now();
    const diff = expires - now;
    if (diff <= 0) { el.textContent = ''; return; }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hrs  = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    el.innerHTML = `⏳ Launch price ends in <strong>${days}d ${hrs}h ${mins}m</strong>`;
  };

  update();
  setInterval(update, 60000);
}

// === YOUTUBE TITLE GENERATOR ===
function generateTitleOptions(topic, niche) {
  const raw = (topic || '').trim();
  if (!raw) return [];
  const cap = raw.charAt(0).toUpperCase() + raw.slice(1).replace(/[?.!]+$/, '');
  const startsWithQ = /^(how|why|what|when|where|who|is|are|can|does|will|should)/i.test(raw);
  const nums = { 'personal finance': '7', 'history and facts': '10', 'true crime and mysteries': '5', 'business and entrepreneurship': '7' }[niche] || '5';

  if (startsWithQ) {
    return [
      `${cap} — The Answer Will Surprise You`,
      `${nums} Reasons ${cap} (Most People Get This Wrong)`,
      `${cap}: What Nobody Tells You`,
      `The Shocking Truth: ${cap}`,
      `${cap} And What You Should Do About It`,
    ];
  }

  const nicheSpecific = {
    'personal finance': [
      `The Untold Truth About ${cap}`,
      `${nums} Money Secrets Behind ${cap} (The 1% Knows This)`,
      `Why ${cap} Is Destroying Your Wealth (And How to Stop It)`,
      `${cap}: The Financial Blueprint Nobody Made You`,
      `How ${cap} Changed My Net Worth Forever`,
    ],
    'motivation and mindset': [
      `The Mindset Shift Behind ${cap} Nobody Talks About`,
      `${nums} Lessons From ${cap} That Will Change Your Life`,
      `Why Most People Fail at ${cap} (And How to Be Different)`,
      `${cap}: What High Performers Actually Do`,
      `The Real Reason ${cap} Will Transform Your Future`,
    ],
    'true crime and mysteries': [
      `The Dark Truth Behind ${cap}`,
      `${cap}: The Case That Haunted Investigators for Years`,
      `What Really Happened: ${cap} (The Full Story)`,
      `${cap} — The Evidence Nobody Wanted You to See`,
      `Inside ${cap}: The Timeline That Changes Everything`,
    ],
    'history and facts': [
      `The History of ${cap} Nobody Taught You in School`,
      `${nums} Shocking Facts About ${cap} That Rewrite History`,
      `What Really Happened: ${cap} (The Real Story)`,
      `${cap}: The Historical Truth That Was Hidden`,
      `Why ${cap} Changed the Course of Human History`,
    ],
    'technology and AI': [
      `How ${cap} Will Change Everything (Sooner Than You Think)`,
      `${nums} Reasons ${cap} Is Bigger Than Anyone Admits`,
      `The Tech Breakthrough Behind ${cap} You Need to Understand`,
      `${cap}: What Silicon Valley Doesn't Want You to Know`,
      `Why ${cap} Will Affect Every Person on Earth`,
    ],
    'business and entrepreneurship': [
      `The Business Strategy Behind ${cap} (Most Founders Miss This)`,
      `${nums} Lessons Entrepreneurs Learn Too Late About ${cap}`,
      `How ${cap} Built a $1M Business in 12 Months`,
      `Why ${cap} Is the Opportunity of the Decade`,
      `${cap}: The Exact Playbook Nobody Is Sharing`,
    ],
  };

  return nicheSpecific[niche] || [
    `The Untold Truth About ${cap}`,
    `${nums} Facts About ${cap} That Will Change How You Think`,
    `Why ${cap} Is Different Than You Think`,
    `${cap}: The Complete Guide Nobody Made`,
    `Everything You Know About ${cap} Is Wrong`,
  ];
}

function generateThumbnailLines(topic, niche) {
  const raw = (topic || '').trim();
  const cap = raw.charAt(0).toUpperCase() + raw.slice(1).replace(/[?.!]+$/, '');
  // Extract first 3-4 words as subject
  const words = cap.split(/\s+/);
  const shortSubject = words.slice(0, 4).join(' ');

  const nicheThumb = {
    'personal finance':            ['THE TRUTH', 'THEY LIED TO YOU', 'THIS CHANGES EVERYTHING'],
    'motivation and mindset':      ['STOP WAITING', 'DO THIS NOW', 'YOUR LIFE CHANGES TODAY'],
    'true crime and mysteries':    ['THE REAL STORY', 'THEY HID THIS', 'WHAT REALLY HAPPENED'],
    'history and facts':           ['HISTORY LIED', 'THE HIDDEN TRUTH', 'YOU WERE NEVER TOLD'],
    'technology and AI':           ['AI CHANGES THIS', 'THE FUTURE IS HERE', 'ARE YOU READY?'],
    'business and entrepreneurship': ['DO THIS NOW', 'STOP LOSING MONEY', 'THE SECRET IS OUT'],
    'self-improvement':            ['CHANGE THIS TODAY', 'YOU NEED THIS', '1% BETTER DAILY'],
    'health and wellness':         ['DOCTORS HIDE THIS', 'DO THIS DAILY', 'STOP DOING THIS'],
    'relationships and psychology': ['THE REAL REASON', 'THEY NEVER TELL YOU', 'PAY ATTENTION'],
  };
  return nicheThumb[niche] || ['THE TRUTH', 'WHAT THEY HIDE', 'THIS CHANGES EVERYTHING'];
}

function showTitleOptions(topic, niche) {
  const wrap = document.getElementById('title-options');
  if (!wrap || !topic) return;
  const titles = generateTitleOptions(topic, niche);
  const thumbLines = generateThumbnailLines(topic, niche);
  if (!titles.length) return;

  const titleRows = titles.map(t => {
    const len = t.length;
    const countClass = len <= 60 ? 'title-len-ok' : len <= 70 ? 'title-len-warn' : 'title-len-over';
    const safeT = t.replace(/'/g, "&#39;").replace(/"/g, '&quot;');
    return `<div class="title-option" onclick="copyTitle(this, '${safeT}')">
      <span class="title-option-text">${t}</span>
      <span class="title-char-count ${countClass}">${len}</span>
      <span class="title-option-copy">Copy</span>
    </div>`;
  }).join('');

  const thumbRows = thumbLines.map(l => {
    const safeL = l.replace(/'/g, "&#39;").replace(/"/g, '&quot;');
    return `<div class="thumb-line-option" onclick="copyTitle(this, '${safeL}')">
      <span class="thumb-line-text">${l}</span>
      <span class="title-option-copy">Copy</span>
    </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="title-options-header">
      <span class="title-options-icon">📺</span>
      <strong>YouTube Title Ideas</strong>
      <span class="title-options-sub">Click to copy · <span class="title-len-ok">≤60</span> chars = optimal</span>
    </div>
    <div class="title-options-list">${titleRows}</div>
    <div class="title-options-thumb">
      <div class="thumb-header">🖼️ Thumbnail Text Ideas</div>
      <div class="thumb-lines-list">${thumbRows}</div>
    </div>`;
  wrap.classList.remove('hidden');
}

function copyTitle(el, title) {
  navigator.clipboard.writeText(title).then(() => {
    const copy = el.querySelector('.title-option-copy');
    if (copy) { copy.textContent = '✓ Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 1800); }
  }).catch(() => {});
}

// === PREVIEW TABS ===
function switchPreview(btn, panelId) {
  btn.closest('.preview-tabs').querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.preview-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
}

// === CSS ANIMATION (inject shake) ===
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-6px); }
    40%      { transform: translateX(6px); }
    60%      { transform: translateX(-4px); }
    80%      { transform: translateX(4px); }
  }
`;
document.head.appendChild(style);

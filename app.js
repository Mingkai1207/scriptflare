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

// === SCRIPT AUTO-SAVE ===
function autoSaveScript(script, topic, niche) {
  try {
    localStorage.setItem('sf_autosave', JSON.stringify({
      script, topic, niche, ts: Date.now()
    }));
  } catch (_) {}
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
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    generateScript();
  }
  // Ctrl/Cmd+S downloads script when output is visible
  if ((e.metaKey || e.ctrlKey) && e.key === 's' && currentScript) {
    e.preventDefault();
    downloadScript();
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
    'Creator in the US grew from 800 to 14K subs in 4 months',
    '🤖 Tech & AI script generated: "How ChatGPT will change everything"',
    '4 scripts generated in the last 10 minutes',
    '🔥 Motivation script: hook-first structure · open loop detected',
    'Creator in Australia just started their faceless channel with ScriptFlare',
    '💰 Finance creator: "my avg view duration went up 31%"',
    '🏆 Business channel just generated a 15-min entrepreneurship script',
    '2,400+ creators are actively using ScriptFlare right now',
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

// === NICHE QUICK-SELECT ===
function pickNiche(value) {
  const select = document.getElementById('niche');
  if (select) select.value = value;
  syncNichePill(value);
  showLengthHint(value);
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
    '5': 750, '8': 1200, '10': 1500, '12': 1800, '15': 2250
  }[length] || 1500;

  const systemPrompt = `You are ScriptFlare, an expert YouTube script writer specializing in faceless YouTube channels. You deeply understand YouTube retention psychology, the algorithm, and what makes viewers watch videos all the way through.

Your scripts:
- Open with a psychologically powerful hook in the FIRST 15-30 seconds (curiosity gap, bold claim, or surprising fact)
- Follow proven retention structure: Hook → Intro → Main Content (with open loops) → Resolution → CTA
- Include [VISUAL: description] cues throughout for B-roll guidance
- Use natural, spoken language (not formal/essay style)
- Build tension and release it strategically
- End with a specific, compelling CTA that drives likes, comments, and subscriptions
- Are calibrated precisely to the target length

Format EVERY script with these exact section headers (plain text, no markdown bold or asterisks):
[HOOK]
[INTRO]
[SECTION 1: title]
[SECTION 2: title]
[SECTION 3: title]
(add more sections as needed for longer scripts)
[CALL TO ACTION]

CRITICAL: Write headers exactly as shown — [HOOK] not **[HOOK]**, [INTRO] not **[INTRO]**.
Keep all [VISUAL: ...] cues on their own line.`;

  const userPrompt = `Create a complete ${length}-minute faceless YouTube script.

Topic: "${topic}"
Niche: ${niche}
Target audience: ${audience}
Tone/Style: ${tone}
Target word count: approximately ${wordCount} words

Requirements:
- Hook must make someone STOP scrolling in the first 3 seconds
- Include at least 6-8 [VISUAL: ...] cues for B-roll footage suggestions
- Use the "open loop" technique (hint at something, then deliver it later)
- Language should sound natural when spoken aloud — no robotic sentences
- Naturally weave in the niche's key vocabulary without keyword stuffing
- Make the viewer feel they'd miss something important if they click away

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
  const targetWords = { '5': 750, '8': 1200, '10': 1500, '12': 1800, '15': 2250 }[length] || 1500;
  const onTarget = Math.abs(words - targetWords) <= 120;
  const targetBadge = onTarget ? ' · ✅ On target' : ` · ⚠️ ${words < targetWords ? 'shorter' : 'longer'} than target`;
  if (statsSpan) statsSpan.textContent = `${topicLabel}~${words.toLocaleString()} words · ~${estimatedMins} min · ${sectionCount} sections · ${brollCount} B-roll cues${targetBadge}`;

  // Reset output badge and add niche label + personal counter
  const badge = document.querySelector('.output-badge');
  const totalGenerated = parseInt(localStorage.getItem('sf_total') || '1', 10);
  if (badge) badge.textContent = `✅ Script #${totalGenerated} Ready`;
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
      html += `<span class="script-section-header">${escapeHtml(stripped)}</span>`;
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
  document.getElementById('voiceover-links')?.classList.add('hidden');
  document.getElementById('upgrade-nudge')?.classList.add('hidden');
  document.getElementById('niche-perf-tip')?.classList.add('hidden');
  document.getElementById('script-quality')?.classList.add('hidden');
  document.getElementById('quality-tips')?.classList.add('hidden');
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
  document.getElementById('script-quality')?.classList.add('hidden');
  document.getElementById('quality-tips')?.classList.add('hidden');
  document.getElementById('voiceover-links')?.classList.add('hidden');
  document.getElementById('niche-perf-tip')?.classList.add('hidden');
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

  const scoreEl = document.getElementById('quality-score');
  if (scoreEl) {
    const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B' : 'C';
    scoreEl.textContent = grade;
    scoreEl.title = `Script score: ${score}/100`;
    scoreEl.className = 'quality-score ' + (score >= 80 ? 'score-high' : score >= 60 ? 'score-mid' : 'score-low');
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
  const shortTopic = topic.length > 60 ? topic.slice(0, 57) + '...' : topic;
  const text = `Just generated a full YouTube script in 30 seconds with ScriptFlare ⚡\n\nTopic: "${shortTopic}"\n\nGet 3 free scripts →`;
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
  Length:    ${length} minutes (~${words} words)
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

function showTitleOptions(topic, niche) {
  const wrap = document.getElementById('title-options');
  if (!wrap || !topic) return;
  const titles = generateTitleOptions(topic, niche);
  if (!titles.length) return;
  wrap.innerHTML = `
    <div class="title-options-header">
      <span class="title-options-icon">📺</span>
      <strong>YouTube Title Ideas</strong>
      <span class="title-options-sub">Click any title to copy it</span>
    </div>
    <div class="title-options-list">
      ${titles.map(t => `
        <div class="title-option" onclick="copyTitle(this, '${t.replace(/'/g, "&#39;").replace(/"/g, '&quot;')}')">
          <span class="title-option-text">${t}</span>
          <span class="title-option-copy">Copy</span>
        </div>`).join('')}
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

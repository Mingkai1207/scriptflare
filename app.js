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

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  updateUsageBar();
  checkProStatus();
  initNavbarScroll();
  updateGenerateBtnState();
  updateNavCTA();
  initScrollReveal();
  initLiveTicker();
  initStatCounters();
  initTopicPlaceholder();
  initStickyCTA();
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

// === KEYBOARD SHORTCUT ===
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    generateScript();
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

// === NAVBAR SCROLL ===
function initNavbarScroll() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    nav.style.background = window.scrollY > 40
      ? 'rgba(6, 6, 15, 0.97)'
      : 'rgba(6, 6, 15, 0.85)';
  });
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
    'Someone in Canada just generated a finance script',
    'Sarah just generated a true crime script',
    'A creator in the US just generated a motivation script',
    'Marcus just generated a history channel script',
    'Someone just generated a self-improvement script',
    '3 scripts generated in the last 5 minutes',
    'A creator just upgraded to Pro',
    'Someone in Australia just generated a business script',
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

// === NICHE QUICK-SELECT ===
function pickNiche(value) {
  const select = document.getElementById('niche');
  if (select) {
    select.value = value;
    // Update active pill
    document.querySelectorAll('.niche-pill').forEach(p => {
      p.classList.toggle('active', p.getAttribute('onclick').includes(value));
    });
  }
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

    currentScript = script;
    incrementUsage();

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

  // Word count + topic label
  const words = script.split(/\s+/).filter(Boolean).length;
  const estimatedMins = Math.round(words / 150);
  const topicLabel = topic ? `"${topic.length > 50 ? topic.slice(0, 47) + '...' : topic}" · ` : '';
  if (statsSpan) statsSpan.textContent = `${topicLabel}~${words.toLocaleString()} words · ~${estimatedMins} min read aloud`;

  // Format the script with nice HTML
  contentDiv.innerHTML = formatScript(script);

  // Show output + topic suggestions
  outputDiv.classList.remove('hidden');
  outputDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const niche = document.getElementById('niche')?.value || '';
  showTopicSuggestions(niche);

  // Success toast with upgrade nudge if on last remaining (0 left now)
  const nowRemaining = getRemainingScripts();
  if (!isProUser()) {
    if (nowRemaining === 0) {
      setTimeout(() => showToast('🎉 Script ready! That was your last free one — upgrade to keep creating.', 'warning'), 800);
    } else {
      setTimeout(() => showToast(`✅ Script ready! ${nowRemaining} free script${nowRemaining > 1 ? 's' : ''} remaining.`, 'success'), 800);
    }
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
      html += `<span class="visual-cue">${escapeHtml(stripped)}</span><br>`;
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
  contentDiv.innerHTML = `<div style="color:#f87171;padding:20px;">
    <strong>⚠️ Generation failed</strong><br>
    ${escapeHtml(message)}<br><br>
    <small>Please check your connection and try again. If the issue persists, contact support.</small>
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
  } else {
    clearInterval(_progressTimer);
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

function clearOutput() {
  document.getElementById('gen-output').classList.add('hidden');
  document.getElementById('gen-form').classList.remove('hidden');
  document.getElementById('topic-suggestions')?.classList.add('hidden');
  currentScript = '';
  const topicEl = document.getElementById('topic');
  topicEl.value = '';
  updateTopicCounter();
  topicEl.focus();
  topicEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  const filename = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) + '.txt';
  const blob = new Blob([currentScript], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

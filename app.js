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

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  updateUsageBar();
  checkProStatus();
  initNavbarScroll();
  updateGenerateBtnState();
});

// === NAVBAR SCROLL ===
function initNavbarScroll() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    nav.style.background = window.scrollY > 40
      ? 'rgba(6, 6, 15, 0.97)'
      : 'rgba(6, 6, 15, 0.85)';
  });
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

  if (isProUser()) {
    if (label) label.innerHTML = '✅ Pro Account — <strong>Unlimited scripts</strong>';
    if (fill) fill.style.width = '100%';
    const usageBar = document.getElementById('usage-bar');
    if (usageBar) {
      usageBar.style.background = 'rgba(16,185,129,0.07)';
      usageBar.style.borderBottom = '1px solid rgba(16,185,129,0.15)';
    }
  } else {
    if (count) count.textContent = remaining;
    if (fill) fill.style.width = ((used / CONFIG.freeLimit) * 100) + '%';
  }
}

function updateGenerateBtnState() {
  const remaining = getRemainingScripts();
  const btn = document.getElementById('generate-btn');
  if (!btn) return;
  if (remaining === 0 && !isProUser()) {
    btn.disabled = true;
    document.getElementById('btn-text').textContent = '🔒 Upgrade to Pro to Continue';
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
      document.getElementById('generate-btn').disabled = false;
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

  // Check usage limit
  const remaining = getRemainingScripts();
  if (remaining <= 0 && !isProUser()) {
    showPaywall();
    return;
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

Format EVERY script with these exact section headers:
[HOOK]
[INTRO]
[SECTION 1: title]
[SECTION 2: title]
[SECTION 3: title]
(add more sections as needed for longer scripts)
[CALL TO ACTION]

Keep all [VISUAL: ...] cues on their own line, italicized by writing them as [VISUAL: description].`;

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

  // Word count
  const words = script.split(/\s+/).filter(Boolean).length;
  const estimatedMins = Math.round(words / 150);
  if (statsSpan) statsSpan.textContent = `~${words.toLocaleString()} words · ~${estimatedMins} min read aloud`;

  // Format the script with nice HTML
  contentDiv.innerHTML = formatScript(script);

  // Show output, scroll to it
  outputDiv.classList.remove('hidden');
  outputDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

    // Section headers like [HOOK], [INTRO], [SECTION 1: title]
    if (/^\[([A-Z][A-Z\s0-9:]+)\]$/.test(trimmed)) {
      html += `<span class="script-section-header">${trimmed}</span>`;
      continue;
    }

    // Visual cues [VISUAL: ...]
    if (/^\[VISUAL:/i.test(trimmed)) {
      html += `<span class="visual-cue">${escapeHtml(trimmed)}</span><br>`;
      continue;
    }

    // Regular paragraph
    html += `<span class="script-para">${escapeHtml(trimmed)}</span><br>`;
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
function setLoadingState(loading) {
  const btn = document.getElementById('generate-btn');
  const btnText = document.getElementById('btn-text');
  const btnLoading = document.getElementById('btn-loading');

  btn.disabled = loading;
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
  document.getElementById('topic').focus();
  currentScript = '';
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

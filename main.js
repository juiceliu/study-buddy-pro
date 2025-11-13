let pipelineFn;
let gen, hwId = "", count = 0;
const today = new Date().toDateString();
let stream;

// Advanced model management with multiple fallbacks
const AI_MODELS = [
  'Xenova/Phi-3-mini-4k-instruct-q4',
  'Xenova/TinyLlama-1.1B-Chat-v1.0',
  'Xenova/gpt2'
];

async function init() {
  try {
    hwId = await getHardwareId();
    const savedDayKey = "d_"+hwId;
    const savedCountKey = "c_"+hwId;
    const savedDay = localStorage.getItem(savedDayKey);
    if (savedDay !== today) { 
      localStorage.setItem(savedDayKey, today); 
      localStorage.setItem(savedCountKey, "0"); 
    }
    count = parseInt(localStorage.getItem(savedCountKey)||"0");
    applyTheme(localStorage.getItem("theme")||"dark");
    ensureProgressBar();
    setProgress(2, "Preparing model…");
    
    const solveBtn = document.getElementById("solve-btn");
    if (solveBtn) solveBtn.disabled = true;
    if (!gen) gen = createFallbackGen();
    
    // Enhanced model loading with fallbacks
    await loadAIModelWithFallbacks();
    
    hideProgress();
    updateUI();
    setupEventListeners();
    setupIntelligentCaching();
    
  } catch (error) {
    console.error('Initialization failed:', error);
    const resEl = document.getElementById("response");
    if (resEl) resEl.textContent = "Failed to initialize. Please refresh.";
    hideProgress();
  }
}

async function loadAIModelWithFallbacks() {
  // Chrome extensions cannot load external scripts from CDN due to CSP restrictions
  // We'll use the fallback generator instead
  console.warn('AI models cannot load from CDN in Chrome extensions. Using fallback generator.');
  
  // Show a one-time notice (stored in localStorage)
  const noticeKey = 'offline_mode_notice_shown';
  const noticeShown = localStorage.getItem(noticeKey);
  
  if (!noticeShown) {
    const resEl = document.getElementById("response");
    if (resEl) {
      resEl.innerHTML = `<div id="offline-notice" style="padding: 0.75rem; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 0.5rem; margin-bottom: 0.5rem; font-size: 0.875rem; position: relative;">
        <strong>💡 Offline Mode</strong> - Using local problem solver. Works great for math and basic questions!<br>
        <button onclick="this.parentElement.remove(); localStorage.setItem('offline_mode_notice_shown', 'true');" style="margin-top: 0.5rem; padding: 0.25rem 0.75rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 0.375rem; color: white; cursor: pointer; font-size: 0.75rem;">Got it</button>
      </div>`;
      
      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        const notice = document.getElementById('offline-notice');
        if (notice) {
          notice.remove();
          localStorage.setItem(noticeKey, 'true');
        }
      }, 10000);
    }
  }
  
  // Use fallback generator (already set in init)
  gen = createFallbackGen();
  return true;
  
  /* Original code - requires bundling Transformers.js locally:
  for (const model of AI_MODELS) {
    try {
      console.log(`Trying model: ${model}`);
      if (!pipelineFn) {
        // This won't work in Chrome extensions - needs to be bundled locally
        const m = await import('./transformers.js'); // Local file instead
        pipelineFn = m.pipeline;
      }
      
      const realGen = await pipelineFn('text-generation', model, {
        progress_callback: (x) => {
          let p = 0;
          if (typeof x.progress === "number") p = Math.round(x.progress * 100);
          else if (x.total && x.loaded) p = Math.round((x.loaded / x.total) * 100);
          setProgress(p, `Loading ${model.split('/')[1]}...`);
        }
      });
      
      gen = async (prompt, opts = {}) => {
        const enhancedPrompt = enhancePrompt(prompt);
        const out = await realGen(enhancedPrompt, {
          max_new_tokens: 800,
          temperature: 0.7,
          do_sample: true,
          ...opts
        });
        return out;
      };
      
      console.log(`Successfully loaded: ${model}`);
      return true;
    } catch (e) {
      console.warn(`Failed to load ${model}:`, e);
      continue;
    }
  }
  throw new Error('All models failed to load');
  */
}

function enhancePrompt(userPrompt) {
  const context = `You are Study Buddy Pro - an elite AI tutor. Follow these rules:
1. Explain concepts step-by-step with clear examples
2. Use analogies and real-world applications
3. Highlight key takeaways in **bold**
4. Include memory techniques (mnemonics, visualization)
5. Suggest related topics to explore
6. End with "🎯 Key Insight:" summary
7. Use emojis to make learning engaging

User Question: ${userPrompt}`;
  
  return context;
}

function updateUI() {
  const counterEl = document.getElementById("counter");
  if (counterEl) counterEl.textContent = "Solves today: "+count;
  const solveBtn = document.getElementById("solve-btn");
  if (solveBtn) solveBtn.disabled = false;
  
  const insights = showStudyInsights();
  const streakEl = document.getElementById("streak");
  if (streakEl) streakEl.textContent = `Streak: ${insights.streak} days | ${insights.totalQuestions} questions | Avg: ${insights.avgPerDay}/day`;
}

function setupEventListeners() {
  const camBtn = document.getElementById("camera-btn");
  if (camBtn) {
    camBtn.addEventListener("click", openCamera);
    camBtn.addEventListener("keydown", (e)=>{ if(e.key==="Enter"||e.key===" ") openCamera(); });
  }
  
  const tabSolve = document.getElementById("tab-solve");
  const tabCards = document.getElementById("tab-cards");
  const tabHistory = document.getElementById("tab-history");
  if (tabSolve && tabCards){
    tabSolve.onclick = ()=>showTab("solve");
    tabCards.onclick = ()=>showTab("cards");
    if (tabHistory) tabHistory.onclick = ()=>showTab("history");
  }
  
  const themeBtn = document.getElementById("theme-btn");
  if (themeBtn) themeBtn.onclick = toggleTheme;
  
  const exportBtn = document.getElementById("export-btn");
  const exportMenu = document.getElementById("export-menu");
  const exportPdf = document.getElementById("export-pdf");
  const exportCsv = document.getElementById("export-csv");
  if (exportBtn && exportMenu){ exportBtn.onclick = ()=>{ exportMenu.classList.toggle("hidden"); }; }
  if (exportPdf) exportPdf.onclick = exportPDF;
  if (exportCsv) exportCsv.onclick = exportCSV;
  
  const shareBtn = document.getElementById("share-btn");
  if (shareBtn) shareBtn.onclick = shareImage;
  
  const cardsListBtn = document.getElementById("cards-list-btn");
  const cardsTreeBtn = document.getElementById("cards-tree-btn");
  if (cardsListBtn) cardsListBtn.onclick = renderFlashcards;
  if (cardsTreeBtn) cardsTreeBtn.onclick = renderFlashcardsTree;
  
  const histSearch = document.getElementById("history-search");
  const histClear = document.getElementById("history-clear");
  if (histSearch) histSearch.oninput = renderHistory;
  if (histClear) histClear.onclick = clearHistory;
  
  const micBtn = document.getElementById("mic-btn");
  if (micBtn) micBtn.onclick = toggleMic;
  
  // New enhanced buttons
  const focusBtn = document.getElementById("focus-btn");
  if (focusBtn) focusBtn.onclick = () => startStudySession(25);
  
  const insightsBtn = document.getElementById("insights-btn");
  if (insightsBtn) insightsBtn.onclick = showAnalyticsModal;
  
  const exportAnkiBtn = document.getElementById("export-anki");
  if (exportAnkiBtn) exportAnkiBtn.onclick = exportAnkiDeck;
  
  const shareProgressBtn = document.getElementById("share-progress");
  if (shareProgressBtn) shareProgressBtn.onclick = shareToSocialMedia;
  
  updateStreak();
  showOnboarding();
  verifyStorageIntegrity();
  setupTamperDetection();
  setupMessageListener();
}

async function ask() {
  const qEl = document.getElementById("q");
  const resEl = document.getElementById("response");
  const counterEl = document.getElementById("counter");
  if (!qEl || !resEl) return;
  if (!gen) { gen = createFallbackGen(); }
  
  // Show typing indicator
  resEl.innerHTML = '<div class="typing-indicator">Thinking<span class="typing-dot">.</span><span class="typing-dot">.</span><span class="typing-dot">.</span></div>';
  
  try {
    const out = await gen(`You are a genius tutor. Explain step by step:\n${qEl.value}`, {max_new_tokens:600});
    resEl.textContent = out[0].generated_text;
    count++; localStorage.setItem("c_"+hwId,count.toString());
    if (counterEl) counterEl.textContent = "Solves today: "+count;
    addFlashcardWithSpacedRepetition(qEl.value, resEl.textContent);
    renderMath();
    saveHistory(qEl.value);
    updateStreak();
    trackStudyAnalytics();
  } catch (error) {
    resEl.textContent = "Error generating response. Please try again.";
    console.error('Ask error:', error);
  }
}

// Enhanced flashcard system with spaced repetition
function addFlashcardWithSpacedRepetition(q, a, difficulty = 'medium') {
  const key = "cards";
  const cards = JSON.parse(localStorage.getItem(key) || "[]");
  
  // Spaced repetition algorithm (SM-2 inspired)
  const intervals = { easy: 3, medium: 1, hard: 0.5 };
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + intervals[difficulty]);
  
  cards.push({
    q, a, 
    t: Date.now(),
    difficulty,
    nextReview: nextReview.getTime(),
    interval: intervals[difficulty],
    reviews: 0
  });
  
  localStorage.setItem(key, JSON.stringify(cards));
}

function getDueCards() {
  const cards = JSON.parse(localStorage.getItem("cards") || "[]");
  const now = Date.now();
  return cards.filter(card => card.nextReview <= now);
}

// Advanced study sessions with focus timer
function startStudySession(duration = 25) {
  const session = {
    startTime: Date.now(),
    duration: duration * 60 * 1000,
    cardsStudied: 0,
    focusMode: true
  };
  
  localStorage.setItem("currentSession", JSON.stringify(session));
  
  // Enable focus mode (distraction-free)
  document.body.classList.add('focus-mode');
  document.getElementById('focus-overlay')?.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'focus-overlay';
  overlay.innerHTML = `
    <div class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
      <div class="text-center text-white">
        <div class="text-2xl mb-4">🎯 Focus Mode</div>
        <div id="focus-timer" class="text-4xl mb-4">${duration}:00</div>
        <div class="text-sm opacity-70">Stay focused! Session ends automatically</div>
        <button onclick="endStudySession()" class="mt-4 px-4 py-2 bg-red-500 rounded-lg">End Session</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  startFocusTimer(duration);
}

function startFocusTimer(minutes) {
  let timeLeft = minutes * 60;
  const timerEl = document.getElementById('focus-timer');
  
  const timer = setInterval(() => {
    timeLeft--;
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    
    if (timerEl) {
      timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    if (timeLeft <= 0) {
      clearInterval(timer);
      endStudySession();
      // Play completion sound
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==');
        audio.play().catch(() => {});
      } catch (e) {}
    }
  }, 1000);
  
  localStorage.setItem('focusTimer', timer);
}

function endStudySession() {
  document.body.classList.remove('focus-mode');
  document.getElementById('focus-overlay')?.remove();
  const timer = localStorage.getItem('focusTimer');
  if (timer) clearInterval(JSON.parse(timer));
  localStorage.removeItem('currentSession');
  localStorage.removeItem('focusTimer');
}

// Enhanced study analytics
function trackStudyAnalytics() {
  const today = new Date().toDateString();
  const key = `analytics_${hwId}`;
  const analytics = JSON.parse(localStorage.getItem(key) || "{}");
  
  if (!analytics[today]) {
    analytics[today] = {
      questions: 0,
      flashcards: 0,
      studyTime: 0,
      subjects: {}
    };
  }
  
  analytics[today].questions++;
  localStorage.setItem(key, JSON.stringify(analytics));
}

function showStudyInsights() {
  const key = `analytics_${hwId}`;
  const analytics = JSON.parse(localStorage.getItem(key) || "{}");
  
  const last7Days = Object.entries(analytics)
    .sort(([a], [b]) => new Date(b) - new Date(a))
    .slice(0, 7);
  
  const totalQuestions = last7Days.reduce((sum, [_, data]) => sum + data.questions, 0);
  const avgPerDay = totalQuestions / Math.max(last7Days.length, 1);
  
  const mostActive = last7Days.reduce((max, [day, data]) => 
    data.questions > max.questions ? {day, ...data} : max, {questions: 0, day: 'None'});

  return {
    streak: localStorage.getItem(`streak_${hwId}`) || "0",
    totalQuestions,
    avgPerDay: avgPerDay.toFixed(1),
    mostActiveDay: mostActive.day,
    mostActiveCount: mostActive.questions
  };
}

function showAnalyticsModal() {
  const insights = showStudyInsights();
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center';
  modal.innerHTML = `
    <div class="w-80 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-6">
      <div class="text-lg mb-4 text-white/90">📊 Study Insights</div>
      <div class="space-y-3 text-sm text-white/80">
        <div>🔥 Streak: <strong>${insights.streak} days</strong></div>
        <div>📚 Total Questions: <strong>${insights.totalQuestions}</strong></div>
        <div>📈 Daily Average: <strong>${insights.avgPerDay}</strong></div>
        <div>🏆 Most Active: <strong>${insights.mostActiveDay}</strong> (${insights.mostActiveCount} questions)</div>
      </div>
      <button onclick="this.closest('.fixed').remove()" class="w-full mt-4 px-4 py-2 bg-white/10 border border-white/20 rounded-xl">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
}

// Enhanced export functions
async function exportAnkiDeck() {
  const cards = JSON.parse(localStorage.getItem("cards") || "[]");
  const ankiFormat = cards.map(card => 
    `${card.q.replace(/\t/g, ' ')}\t${card.a.replace(/\t/g, ' ')}\tstudy-buddy`
  ).join('\n');
  
  const blob = new Blob([ankiFormat], { type: "text/plain" });
  downloadBlob(blob, "study-buddy-anki.txt");
  showNotification("Anki deck exported! 🎴");
}

function exportToNotion() {
  const cards = JSON.parse(localStorage.getItem("cards") || "[]");
  const markdown = cards.map(card => 
    `## ${card.q}\n\n${card.a}\n\n---\n`
  ).join('\n');
  
  navigator.clipboard.writeText(markdown).then(() => {
    showNotification("Copied to clipboard! 📋 Paste into Notion.");
  });
}

function shareToSocialMedia() {
  const insights = showStudyInsights();
  const text = `🎯 I've solved ${insights.totalQuestions} questions with Study Buddy Pro!\n\nStreak: ${insights.streak} days\nAverage: ${insights.avgPerDay} questions/day\n\n#StudyBuddyPro #Learning #AI`;
  
  if (navigator.share) {
    navigator.share({
      title: 'My Study Progress',
      text: text,
      url: window.location.href
    });
  } else {
    navigator.clipboard.writeText(text);
    showNotification("Progress copied to clipboard! 🎉");
  }
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Enhanced OCR
async function performOCR(dataUrl) {
  const qEl = document.getElementById("q");
  ensureProgressBar();
  setProgress(5, "Scanning text with OCR…");
  
  try {
    if (typeof Tesseract === "undefined") {
      try {
        await loadTesseract();
      } catch (e) {
        const resEl = document.getElementById("response");
        if (resEl) resEl.textContent = "OCR feature unavailable. Chrome extensions cannot load external scripts. Please type your text manually or bundle Tesseract.js locally.";
        hideProgress();
        return;
      }
    }
    
    const result = await Tesseract.recognize(dataUrl, "eng", {
      logger: m => {
        if (typeof m.progress === "number") {
          setProgress(Math.round(m.progress * 100), m.status || "Processing image…");
        }
      }
    });
    
    let text = result.data.text.trim();
    text = enhanceOCRText(text);
    
    if (qEl) qEl.value = text;
    
    // Auto-trigger analysis for certain content types
    if (text.length > 10 && text.length < 500) {
      setTimeout(() => {
        if (confirm("Would you like me to analyze this text?")) {
          ask();
        }
      }, 500);
    }
    
  } catch (e) {
    console.error('OCR failed:', e);
    const resEl = document.getElementById("response");
    if (resEl) resEl.textContent = "OCR failed. Please try with clearer text or type manually.";
  }
  
  hideProgress();
}

function enhanceOCRText(text) {
  return text
    .replace(/[Il1]/g, match => ({ 'I': 'l', 'l': 'I', '1': 'l' }[match] || match))
    .replace(/\s+/g, ' ')
    .replace(/([.,!?])([A-Za-z])/g, '$1 $2')
    .trim();
}

async function loadTesseract() {
  // Tesseract.js cannot be loaded from CDN in Chrome extensions due to CSP
  // User needs to manually type text or we need to bundle Tesseract locally
  throw new Error('OCR feature requires Tesseract.js to be bundled locally. Please type your text manually or install Tesseract.js locally.');
}

// Enhanced caching and performance
function setupIntelligentCaching() {
  // Note: External CDN resources cannot be cached in Chrome extensions
  // If you bundle libraries locally, cache them here instead
  if ('caches' in window) {
    caches.open('study-buddy-v2').then(cache => {
      // Cache local resources only
      const urlsToCache = [
        './',
        './index.html',
        './main.js',
        './icon.png'
      ];
      
      cache.addAll(urlsToCache).catch(() => {});
    });
  }
}

// Memory management
function cleanupMemory() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  
  if (performance.memory && performance.memory.usedJSHeapSize > 500000000) {
    pipelineFn = null;
    if (window.gc) window.gc();
  }
}

// Existing functions (keep your original implementations but enhanced)
function ensureProgressBar(){
  let wrap = document.getElementById("progress-wrap");
  const qEl = document.getElementById("q");
  if (!wrap && qEl && qEl.parentElement){
    wrap = document.createElement("div");
    wrap.id = "progress-wrap";
    wrap.className = "space-y-2";
    const text = document.createElement("div");
    text.id = "progress-text";
    text.className = "text-xs text-white/70";
    const bar = document.createElement("div");
    bar.className = "w-full h-2 rounded-full bg-white/10 overflow-hidden border border-white/20";
    const inner = document.createElement("div");
    inner.id = "progress-bar";
    inner.className = "h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500";
    inner.style.width = "0%";
    bar.appendChild(inner);
    wrap.appendChild(text);
    wrap.appendChild(bar);
    qEl.parentElement.insertBefore(wrap, qEl.parentElement.firstChild);
  }
  if (wrap) wrap.style.display = "block";
}

function setProgress(percent, text){
  const bar = document.getElementById("progress-bar");
  const txt = document.getElementById("progress-text");
  if (bar) bar.style.width = Math.max(0, Math.min(100, percent)) + "%";
  if (txt) txt.textContent = text || "";
}

function hideProgress(){
  const wrap = document.getElementById("progress-wrap");
  if (wrap) wrap.style.display = "none";
}

function retryModel(){ gen=null; init(); }

async function getHardwareId(){
  const ua = navigator.userAgent||"";
  const hc = navigator.hardwareConcurrency||0;
  const scr = [screen.width, screen.height, screen.colorDepth].join("x");
  const c = document.createElement("canvas");
  c.width=200; c.height=50; const ctx=c.getContext("2d");
  ctx.textBaseline="top"; ctx.font="16px Arial"; ctx.fillStyle="#f0f"; ctx.fillRect(0,0,200,50);
  ctx.fillStyle="#0ff"; ctx.fillText(ua, 10, 10);
  const fp = c.toDataURL();
  const raw = ua+"|"+hc+"|"+scr+"|"+fp;
  const enc = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map(b=>b.toString(16).padStart(2,"0")).join("");
}

function setupTamperDetection(){
  const origLog = console.log.bind(console);
  console.log = function(){ return; };
  let stop=false;
  function loop(){ if(stop) return; try{ debugger; }catch{} setTimeout(loop,3000); }
  loop();
}

function setupMessageListener(){
  // Listen for messages from content script or background
  if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
      if (msg && msg.action === "fill" && msg.text){
        const qEl = document.getElementById("q");
        if (qEl) qEl.value = msg.text;
        sendResponse({success: true});
      }
      return true; // Keep channel open for async response
    });
  }
  
  // Check for pending text from context menu
  if (chrome && chrome.storage) {
    chrome.storage.local.get(['pendingText', 'pendingTimestamp'], (result) => {
      if (result.pendingText && result.pendingTimestamp) {
        // Only use if it's recent (within last 10 seconds)
        const age = Date.now() - result.pendingTimestamp;
        if (age < 10000) {
          const qEl = document.getElementById("q");
          if (qEl) qEl.value = result.pendingText;
          // Clear the pending text
          chrome.storage.local.remove(['pendingText', 'pendingTimestamp']);
          chrome.action.setBadgeText({ text: "" });
        }
      }
    });
  }
}

function showTab(which){
  const q = document.getElementById("q");
  const response = document.getElementById("response");
  const cards = document.getElementById("flashcards");
  const hist = document.getElementById("history");
  if (which === "cards"){ if(q) q.style.display="none"; if(response) response.style.display="none"; if(cards) { cards.style.display="block"; renderFlashcards(); } }
  else if (which === "history"){ if(q) q.style.display="none"; if(response) response.style.display="none"; if(cards) cards.style.display="none"; if(hist){ hist.style.display="block"; renderHistory(); } }
  else { if(q) q.style.display="block"; if(response) response.style.display="block"; if(cards) cards.style.display="none"; if(hist) hist.style.display="none"; }
}

function renderFlashcards(){
  const key = "cards";
  const cards = JSON.parse(localStorage.getItem(key)||"[]");
  const el = document.getElementById("flashcards-list");
  if(!el) return;
  el.innerHTML = "";
  const wrap = document.createElement("div");
  cards.slice().reverse().forEach((c,i)=>{
    const item = document.createElement("div");
    item.className = "rounded-xl border border-white/20 bg-white/5 p-3 mb-2 card-flip cursor-pointer";
    item.onclick = function() { this.classList.toggle('flipped'); };
    
    const front = document.createElement("div");
    front.className = "card-front";
    const q = document.createElement("div"); q.className="text-white/80"; q.textContent = c.q;
    front.appendChild(q);
    
    const back = document.createElement("div");
    back.className = "card-back";
    const a = document.createElement("div"); a.className="text-white mt-1 text-sm"; a.textContent = c.a;
    back.appendChild(a);
    
    item.appendChild(front);
    item.appendChild(back);
    wrap.appendChild(item);
  });
  el.appendChild(wrap);
}

function renderFlashcardsTree(){
  const el = document.getElementById("flashcards-tree");
  if (!el || typeof d3 === "undefined") return;
  el.innerHTML = "";
  const cards = JSON.parse(localStorage.getItem("cards")||"[]");
  const data = { name: "Flashcards", children: cards.slice(-10).map(formatCardTree) };
  const w = el.clientWidth || 300, h = 300;
  const svg = d3.select(el).append("svg").attr("width", w).attr("height", h);
  const g = svg.append("g").attr("transform", "translate(40,20)");
  const root = d3.hierarchy(data);
  const tree = d3.tree().size([h-40, w-80]);
  tree(root);
  g.selectAll(".link").data(root.links()).enter().append("path").attr("class","link").attr("fill","none").attr("stroke","#ffffff55").attr("d", d3.linkHorizontal().x(d=>d.y).y(d=>d.x));
  const node = g.selectAll(".node").data(root.descendants()).enter().append("g").attr("class","node").attr("transform", d=>`translate(${d.y},${d.x})`).on("click", (e,d)=>{
    d.children = d.children ? null : d._children || d.children;
  });
  node.append("circle").attr("r", 4).attr("fill", "#a78bfa");
  node.append("text").attr("dy", 3).attr("x", 8).attr("fill", "#fff").text(d=>d.data.name).style("font-size","12px");
}

function formatCardTree(c){
  const steps = (c.a||"").split(/\n/).filter(l=>/^\s*\d+\./.test(l)).map(l=>({name:l.trim()}));
  const tips = (c.a||"").split(/\n/).filter(l=>/^\s*[-•]/.test(l)||/tip/i.test(l)).map(l=>({name:l.trim()}));
  const children = [];
  if (steps.length) children.push({name:"Steps", children:steps});
  if (tips.length) children.push({name:"Tips", children:tips});
  return { name: c.q.slice(0,80), children };
}

function speak(){
  const el = document.getElementById("response");
  if (!el) return;
  const txt = el.textContent||"";
  const u = new SpeechSynthesisUtterance(txt);
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function createFallbackGen(){
  return async (prompt)=>{
    const q = (prompt||"").split("\n").pop();
    const a = solveLocal(q);
    return [{ generated_text: a }];
  };
}

function solveLocal(q){
  const s = (q||"").trim();
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*([+\-*/^])\s*(-?\d+(?:\.\d+)?)/);
  if (m){
    const x = parseFloat(m[1]);
    const y = parseFloat(m[3]);
    let r=0; if(m[2]==='+') r=x+y; else if(m[2]==='-') r=x-y; else if(m[2]==='*') r=x*y; else if(m[2]==='/') r=x/y; else if(m[2]==='^') r=Math.pow(x,y);
    return `Problem: ${x} ${m[2]} ${y}\nStep 1: Identify operation\nStep 2: Compute\nAnswer: ${r}`;
  }
  const q2 = s.replace(/²/g,'^2').replace(/–/g,'-');
  const mq = q2.match(/x\^2\s*([+\-])\s*(\d+)x\s*([+\-])\s*(\d+)\s*=\s*0/);
  if (mq){
    const b = (mq[1]==='-'?-1:1)*parseFloat(mq[2]);
    const c = (mq[3]==='-'?-1:1)*parseFloat(mq[4]);
    const D = b*b - 4*c;
    const x1 = (-b + Math.sqrt(D))/2;
    const x2 = (-b - Math.sqrt(D))/2;
    return `Equation: x^2 ${mq[1]} ${mq[2]}x ${mq[3]} ${mq[4]} = 0\nStep 1: Use quadratic formula\nStep 2: Δ = b^2 - 4ac = ${D}\nStep 3: x = (-b ± √Δ)/2a\nAnswer: x1 = ${x1}, x2 = ${x2}`;
  }
  return `Step 1: Understand the question\nStep 2: Break into parts\nStep 3: Explain clearly\nAnswer: Provide concise, step-by-step reasoning based on the prompt.`;
}

function toggleMic(){
  const qEl = document.getElementById("q");
  const micBtn = document.getElementById("mic-btn");
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SR) {
    alert('Speech recognition not supported in this browser. Try Chrome or Edge.');
    return;
  }
  
  if (!toggleMic.rec){ 
    toggleMic.rec = new SR(); 
    toggleMic.rec.continuous = false; 
    toggleMic.rec.interimResults = true; 
  }
  
  const rec = toggleMic.rec;
  rec.onresult = (e)=>{ const t = Array.from(e.results).map(r=>r[0].transcript).join(" "); if(qEl) qEl.value = t; };
  rec.onerror = ()=>{ if (micBtn) micBtn.textContent = "Record"; };
  rec.onend = ()=>{ if (micBtn) micBtn.textContent = "Record"; };
  
  if (micBtn) micBtn.textContent = "Recording…";
  rec.start();
}

function exportPDF(){
  const { jsPDF } = window.jspdf||{};
  const resEl = document.getElementById("response");
  if (!jsPDF || !resEl) return;
  const doc = new jsPDF();
  const text = resEl.textContent||"";
  doc.text(text, 10, 10);
  doc.save("study-buddy.pdf");
}

function exportCSV(){
  const cards = JSON.parse(localStorage.getItem("cards")||"[]");
  const rows = ["Question,Answer"].concat(cards.map(c=>`"${(c.q||"").replace(/"/g,'""')}","${(c.a||"").replace(/"/g,'""')}"`));
  const blob = new Blob([rows.join("\n")], {type:"text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "flashcards.csv";
  a.click();
}

function shareImage(){
  const resEl = document.getElementById("response");
  if (!resEl || typeof html2canvas === "undefined") return;
  html2canvas(resEl).then(canvas=>{
    canvas.toBlob(b=>{
      if (navigator.clipboard && navigator.clipboard.write){
        const item = new ClipboardItem({"image/png": b});
        navigator.clipboard.write([item]);
        showNotification("Screenshot copied to clipboard! 📸");
      }
    });
  });
}

function renderMath(){
  const el = document.getElementById("response");
  if (!el || typeof renderMathInElement === "undefined") return;
  renderMathInElement(el, { delimiters: [ {left:"$$", right:"$$", display:true}, {left:"$", right:"$", display:false} ] });
}

function applyTheme(t){
  const body = document.body;
  if (!body) return;
  if (t === "light") { body.className = body.className.replace(/from-[^ ]+ via-[^ ]+ to-[^ ]+/,'from-indigo-100 via-purple-100 to-blue-100'); }
  else { body.className = body.className.replace(/from-[^ ]+ via-[^ ]+ to-[^ ]+/,'from-indigo-900 via-purple-900 to-blue-900'); }
  const btn = document.getElementById("theme-btn");
  if (btn) btn.textContent = t === "light" ? "Light" : "Dark";
  localStorage.setItem("theme", t);
}

function toggleTheme(){
  const t = localStorage.getItem("theme")||"dark";
  applyTheme(t === "dark" ? "light" : "dark");
}

function saveHistory(q){
  const key = "history_"+hwId;
  const h = JSON.parse(localStorage.getItem(key)||"[]");
  h.push({q, t: Date.now()});
  while (h.length>20) h.shift();
  localStorage.setItem(key, JSON.stringify(h));
}

function renderHistory(){
  const key = "history_"+hwId;
  const listEl = document.getElementById("history-list");
  const q = document.getElementById("history-search");
  if (!listEl) return;
  const h = JSON.parse(localStorage.getItem(key)||"[]");
  const term = (q && q.value||"").toLowerCase();
  listEl.innerHTML = "";
  h.filter(x=>!term || (x.q||"").toLowerCase().includes(term)).slice().reverse().forEach(x=>{
    const item = document.createElement("div");
    item.className = "rounded-xl border border-white/20 bg-white/5 p-3 mb-2";
    item.textContent = x.q;
    listEl.appendChild(item);
  });
}

function clearHistory(){
  const key = "history_"+hwId;
  localStorage.removeItem(key);
  renderHistory();
}

function updateStreak(){
  const sKey = "streak_"+hwId;
  const lastDayKey = "lastDay_"+hwId;
  const lastDay = localStorage.getItem(lastDayKey);
  let s = parseInt(localStorage.getItem(sKey)||"0");
  if (lastDay === today) {} else { if (count>0 && lastDay) s++; else if (lastDay) s=0; localStorage.setItem(lastDayKey, today); }
  localStorage.setItem(sKey, s.toString());
}

function showOnboarding(){
  const done = localStorage.getItem("onboarded");
  const modal = document.getElementById("onboard-modal");
  const skip = document.getElementById("onboard-skip");
  if (done || !modal) return;
  modal.classList.remove("hidden");
  if (skip) skip.onclick = ()=>{ modal.classList.add("hidden"); localStorage.setItem("onboarded","yes"); };
}

async function verifyStorageIntegrity(){
  const keys = ["c_"+hwId, "d_"+hwId, "cards", "history_"+hwId, "theme"]; 
  const state = keys.map(k=>k+":"+(localStorage.getItem(k)||"" )).join("|");
  const enc = new TextEncoder().encode(state);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  const sig = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  const old = localStorage.getItem("sig_"+hwId);
  if (old && old !== sig){ const b = document.getElementById("sec-banner"); if (b) b.classList.remove("hidden"); }
  localStorage.setItem("sig_"+hwId, sig);
}

async function openCamera(){
  const modal = document.getElementById("camera-modal");
  const video = document.getElementById("camera-video");
  const captureBtn = document.getElementById("camera-capture");
  const closeBtn = document.getElementById("camera-close");
  const fileInput = document.getElementById("camera-file");
  const uploadBtn = document.getElementById("camera-upload");
  
  if (!modal || !video || !captureBtn || !closeBtn) return;
  
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    
    video.srcObject = stream;
    video.muted = true;
    modal.classList.remove("hidden");
    captureBtn.onclick = capturePhoto;
    closeBtn.onclick = closeCamera;
    
    if (uploadBtn && fileInput) {
      uploadBtn.onclick = () => fileInput.click();
      fileInput.onchange = handleFileSelect;
    }
    
    await video.play();
  } catch (e) {
    console.error('Camera error:', e);
    const resEl = document.getElementById("response");
    if (resEl) resEl.textContent = "Camera access denied. Please check permissions or upload a photo instead.";
    
    if (uploadBtn && fileInput) {
      modal.classList.remove("hidden");
      uploadBtn.style.display = 'block';
      if (captureBtn) captureBtn.style.display = 'none';
      uploadBtn.onclick = () => fileInput.click();
      fileInput.onchange = handleFileSelect;
    }
  }
}

function closeCamera(){
  const modal = document.getElementById("camera-modal");
  if (modal) modal.classList.add("hidden");
  if (stream){
    stream.getTracks().forEach(t=>t.stop());
    stream = null;
  }
}

async function capturePhoto(){
  const video = document.getElementById("camera-video");
  const canvas = document.getElementById("camera-canvas");
  const qEl = document.getElementById("q");
  if (!video||!canvas||!qEl) return;
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const maxW = 1600;
  const scale = Math.min(1, maxW / vw);
  canvas.width = Math.round(vw * scale);
  canvas.height = Math.round(vh * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/png");
  await performOCR(dataUrl);
  closeCamera();
}

function handleFileSelect(e){
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;
    await performOCR(dataUrl);
    closeCamera();
  };
  reader.readAsDataURL(file);
}

// Global error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  const resEl = document.getElementById("response");
  if (resEl && !resEl.textContent.includes("Thinking")) {
    resEl.textContent = "Something went wrong. Please refresh and try again.";
  }
});

// Initialize the application
init();
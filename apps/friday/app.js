// ==================== FRIDAY STATE ====================
const state = {
  conversations: [],
  activeConvId: null,
  isLoading: false,
  editingIndex: null,
  attachments: [], // {fileName, mimeType, fileSize, s3Key, uploadProgress, status, errorMessage, file, xhr}
  searchQuery: ''
};

const STORAGE = {
  CONVS: 'FRIDAY_CONVERSATIONS_V3',
  SETTINGS: 'FRIDAY_SETTINGS_V3',
  SIDEBAR: 'FRIDAY_SIDEBAR_COLLAPSED'
};

const MAX_FILE_SIZE = 104857600; // 100MB
const MAX_FILES = 5;

const SUPPORTED_MIME_TYPES = {
  'image/jpeg':['.jpg','.jpeg'],'image/png':['.png'],'image/gif':['.gif'],'image/webp':['.webp'],
  'application/pdf':['.pdf'],'text/plain':['.txt','.log','.out','.err'],'text/markdown':['.md'],
  'text/csv':['.csv'],'text/html':['.html','.htm'],'application/json':['.json'],
  'application/xml':['.xml'],'text/xml':['.xml'],'text/yaml':['.yaml','.yml'],
  'text/javascript':['.js'],'text/typescript':['.ts'],'text/x-python':['.py'],
  'text/x-java':['.java'],'text/x-c':['.c'],'text/x-c++':['.cpp'],
  'text/x-go':['.go'],'text/x-rust':['.rs'],'text/x-ruby':['.rb'],
  'text/x-php':['.php'],'text/x-sh':['.sh'],'text/x-sql':['.sql'],
  'application/msword':['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':['.docx'],
  'application/vnd.ms-excel':['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx'],
  'application/vnd.ms-powerpoint':['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':['.pptx']
};

// ==================== PRICING ====================
const BEDROCK_PRICING = {
  'claude-opus-4-5':    {in:15.00,out:75.00},
  'claude-sonnet-4-5':  {in:3.00,out:15.00},
  'claude-haiku-4-5':   {in:0.80,out:4.00},
  'claude-opus-4':      {in:15.00,out:75.00},
  'claude-sonnet-4':    {in:3.00,out:15.00},
  'claude-3-7-sonnet':  {in:3.00,out:15.00},
  'claude-3-5-sonnet':  {in:3.00,out:15.00},
  'claude-3-5-haiku':   {in:0.80,out:4.00},
  'claude-3-opus':      {in:15.00,out:75.00},
  'claude-3-sonnet':    {in:3.00,out:15.00},
  'claude-3-haiku':     {in:0.25,out:1.25},
  'nova-pro':           {in:0.80,out:3.20},
  'nova-lite':          {in:0.06,out:0.24},
  'nova-micro':         {in:0.035,out:0.14},
  'default':            {in:3.00,out:15.00}
};

// ==================== STYLE PARAMS ====================
const STYLE_PARAMS = {
  precise:  {temperature:0.1, top_p:0.15, top_k:0, maxTokens:4096},
  balanced: {temperature:0.5, top_p:0.50, top_k:0, maxTokens:4096},
  creative: {temperature:0.9, top_p:0.85, top_k:0, maxTokens:4096}
};
const STYLE_PARAMS_THINKING = {
  precise:  {temperature:0.1, top_p:0.95, top_k:0, maxTokens:4096},
  balanced: {temperature:0.5, top_p:0.99, top_k:0, maxTokens:4096},
  creative: {temperature:0.9, top_p:1.0,  top_k:0, maxTokens:4096}
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', init);

function init() {
  loadTheme();
  loadTextSize();
  loadSidebarState();
  loadSettings();
  loadConversations();
  renderConvList();
  renderEmptyState();
  checkServerStatus();
  setInterval(checkServerStatus, 30000);
  initParticleCanvas();
  initVoiceInput();
  // Set human avatar SVG in input area
  const inputAvatar = document.getElementById('inputAvatar');
  if (inputAvatar) inputAvatar.innerHTML = getHumanAvatarSVG();

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'n') { e.preventDefault(); newChat(); }
    if (e.key === 'Escape') { hideSettings(); cancelEdit(); }
  });

  focusInput();
  // Auto-show demo greeting on first load
  showDemoGreeting();
}

function showDemoGreeting() {
  if (state.conversations.length > 0) return;
  const conv = { id: generateId(), title: 'Welcome to FRIDAY', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
  const greeting = `Beep boop 🤖 I am **FRIDAY** — your cyberpunk AI assistant.

This is a **demo instance** showcasing the UI. The full version runs on AWS serverless with:

- 🧠 **20+ AI models** (Claude 4.x, 3.7, 3.5, Amazon Nova)
- 🔍 **Web search** with citations (DuckDuckGo + Brave)
- 🎤 **Voice input** via Web Speech API
- 📎 **File attachments** up to 100 MB (PDFs, Office docs, code, images)
- 💡 **Extended thinking** with visible reasoning chains
- 🌿 **Conversation branching**
- 💰 **Live session cost tracking**

**Want to deploy FRIDAY to your own AWS account?**

📧 Contact **i@whyshock.com** to get the deployment scripts and source code.

– FRIDAY out. 🔷`;

  conv.messages.push({
    role: 'assistant',
    content: greeting,
    timestamp: Date.now(),
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  });
  state.conversations.push(conv);
  state.activeConvId = conv.id;
  saveConversations();
  renderConvList();
  renderMessages(conv.messages, conv);
}

function focusInput() {
  setTimeout(() => {
    const el = document.getElementById('input');
    if (el) el.focus();
  }, 50);
}

// ==================== SETTINGS ====================
function getSettings() {
  return JSON.parse(localStorage.getItem(STORAGE.SETTINGS) || '{}');
}

function loadSettings() {
  const s = getSettings();
  if (s.systemContext) document.getElementById('systemContext').value = s.systemContext;
  if (s.customModelId) document.getElementById('customModelId').value = s.customModelId;
  if (s.braveApiKey) document.getElementById('braveApiKey').value = s.braveApiKey;
  if (s.enableThinking) {
    document.getElementById('thinkingToggle').checked = true;
    document.querySelector('.thinking-toggle').classList.add('active');
  }
  if (s.smartSummary) {
    document.getElementById('smartSummaryCheck').checked = true;
    document.getElementById('smartSummaryToggle').classList.add('active');
  }
  if (s.webSearch) {
    document.getElementById('webSearchCheck').checked = true;
    document.getElementById('webSearchToggle').classList.add('active');
  }
  selectStyle(s.responseStyle || 'precise');
  if (s.model) {
    const sel = document.getElementById('modelSelect');
    const exists = Array.from(sel.options).some(o => o.value === s.model);
    if (exists) sel.value = s.model;
  }
  updateCustomModelBadge();
}

function saveSettings() {
  const customModelId = document.getElementById('customModelId').value.trim();
  const advancedParams = getAdvancedParams();
  const existing = getSettings();
  const s = {
    ...existing,
    systemContext: document.getElementById('systemContext').value.trim(),
    model: document.getElementById('modelSelect').value,
    customModelId,
    braveApiKey: document.getElementById('braveApiKey').value.trim(),
    enableThinking: document.getElementById('thinkingToggle').checked,
    responseStyle: document.getElementById('responseStyle').value || 'precise',
    advancedParams
  };
  localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(s));
  updateCustomModelBadge();
  document.getElementById('settingsModal').style.display = 'none';
  focusInput();
}

function showSettings() {
  const s = getSettings();
  // Populate all fields from saved settings
  document.getElementById('systemContext').value = s.systemContext || '';
  document.getElementById('customModelId').value = s.customModelId || '';
  document.getElementById('braveApiKey').value = s.braveApiKey || '';
  selectStyle(s.responseStyle || 'precise');
  syncSlidersFromSettings();
  document.getElementById('settingsModal').style.display = 'flex';
}

function hideSettings(e) {
  if (!e || e.target.id === 'settingsModal') {
    document.getElementById('settingsModal').style.display = 'none';
    focusInput();
  }
}

function updateCustomModelBadge() {
  const s = getSettings();
  const sel = document.getElementById('modelSelect');
  if (s.customModelId) {
    const shortId = s.customModelId.length > 35 ? s.customModelId.slice(0, 32) + '...' : s.customModelId;
    let customOpt = sel.querySelector('option[value="__active_custom__"]');
    if (!customOpt) {
      customOpt = document.createElement('option');
      customOpt.value = '__active_custom__';
      sel.insertBefore(customOpt, sel.firstChild);
    }
    customOpt.textContent = '★ ' + shortId;
    sel.value = '__active_custom__';
  } else {
    const customOpt = sel.querySelector('option[value="__active_custom__"]');
    if (customOpt) customOpt.remove();
  }
}

function changeModel() {
  const val = document.getElementById('modelSelect').value;
  if (val === '__custom__') {
    showSettings();
    setTimeout(() => document.getElementById('customModelId').focus(), 100);
    return;
  }
  if (val === '__active_custom__') return;
  const s = getSettings();
  s.model = val;
  s.customModelId = '';
  document.getElementById('customModelId').value = '';
  localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(s));
  const customOpt = document.getElementById('modelSelect').querySelector('option[value="__active_custom__"]');
  if (customOpt) customOpt.remove();
}

function toggleThinking() {
  const s = getSettings();
  const checked = document.getElementById('thinkingToggle').checked;
  s.enableThinking = checked;
  document.querySelector('.thinking-toggle').classList.toggle('active', checked);
  localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(s));
}

function toggleSmartSummary() {
  const s = getSettings();
  const checked = document.getElementById('smartSummaryCheck').checked;
  s.smartSummary = checked;
  document.getElementById('smartSummaryToggle').classList.toggle('active', checked);
  localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(s));
}

function isThinkingModel(modelId) {
  if (!modelId) return false;
  const m = modelId.toLowerCase();
  return m.includes('claude-4') || m.includes('claude-opus-4') || m.includes('claude-sonnet-4') ||
         m.includes('claude-haiku-4') || m.includes('3-7-sonnet') || m.includes('3.7') ||
         m.includes('claude-opus-4-5') || m.includes('claude-sonnet-4-5') || m.includes('claude-haiku-4-5');
}

function getParamsForStyle(style) {
  const s = getSettings();
  const modelId = s.customModelId || s.model || '';
  const thinking = isThinkingModel(modelId) || s.enableThinking;
  return thinking ? (STYLE_PARAMS_THINKING[style] || STYLE_PARAMS_THINKING.precise)
                  : (STYLE_PARAMS[style] || STYLE_PARAMS.precise);
}

function selectStyle(style) {
  document.getElementById('responseStyle').value = style;
  document.querySelectorAll('#responseStyleGroup .style-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.style === style);
  });
  applyStyleToSliders(style);
}

function applyStyleToSliders(style) {
  const params = getParamsForStyle(style);
  const set = (id, valId, val, dec) => {
    const el = document.getElementById(id);
    const d = document.getElementById(valId);
    if (el) el.value = val;
    if (d) d.textContent = dec ? parseFloat(val).toFixed(dec) : parseInt(val).toLocaleString();
  };
  set('sliderTemp','valTemp',params.temperature,2);
  set('sliderTopP','valTopP',params.top_p,2);
  set('sliderTopK','valTopK',params.top_k,0);
  set('sliderMaxTokens','valMaxTokens',params.maxTokens,0);
}

function toggleAdvanced() {
  document.getElementById('advancedToggle').classList.toggle('open');
  document.getElementById('advancedPanel').classList.toggle('open');
}

function resetAdvancedToStyle() {
  applyStyleToSliders(document.getElementById('responseStyle').value || 'precise');
}

function getAdvancedParams() {
  return {
    temperature: parseFloat(document.getElementById('sliderTemp').value),
    top_p: parseFloat(document.getElementById('sliderTopP').value),
    top_k: parseInt(document.getElementById('sliderTopK').value) || undefined,
    maxTokens: parseInt(document.getElementById('sliderMaxTokens').value)
  };
}

function syncSlidersFromSettings() {
  const s = getSettings();
  if (s.advancedParams) {
    const p = s.advancedParams;
    const set = (id, valId, val, dec) => {
      const el = document.getElementById(id);
      const d = document.getElementById(valId);
      if (el) el.value = val;
      if (d) d.textContent = dec ? parseFloat(val).toFixed(dec) : parseInt(val).toLocaleString();
    };
    set('sliderTemp','valTemp',p.temperature??0.1,2);
    set('sliderTopP','valTopP',p.top_p??0.15,2);
    set('sliderTopK','valTopK',p.top_k??0,0);
    set('sliderMaxTokens','valMaxTokens',p.maxTokens??4096,0);
  } else {
    applyStyleToSliders(s.responseStyle || 'precise');
  }
}

// ==================== THEME ====================
function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('FRIDAY_THEME', isLight ? 'light' : 'dark');
  updateThemeIcon(isLight);
  // Re-render avatars with new theme colors
  const inputAvatar = document.getElementById('inputAvatar');
  if (inputAvatar) inputAvatar.innerHTML = getHumanAvatarSVG();
  const conv = state.conversations.find(c => c.id === state.activeConvId);
  if (conv) {
    renderMessages(getActiveBranchMessages(conv), conv);
  } else {
    renderEmptyState();
  }
}

function loadTheme() {
  const saved = localStorage.getItem('FRIDAY_THEME');
  const isLight = saved === 'light';
  if (isLight) document.body.classList.add('light-mode');
  updateThemeIcon(isLight);
}

function updateThemeIcon(isLight) {
  const sun = document.getElementById('themeSun');
  const moon = document.getElementById('themeMoon');
  if (sun) sun.style.display = isLight ? 'none' : 'block';
  if (moon) moon.style.display = isLight ? 'block' : 'none';
}

// ==================== SIDEBAR & SERVER ====================

// ==================== TEXT SIZE ====================
function setTextSize(size) {
  document.body.classList.remove('text-sm','text-lg','text-xl');
  if (size !== 'md') document.body.classList.add('text-' + size);
  localStorage.setItem('FRIDAY_TEXT_SIZE', size);
  const sel = document.getElementById('textSizeSelect');
  if (sel) sel.value = size;
}

function loadTextSize() {
  const saved = localStorage.getItem('FRIDAY_TEXT_SIZE') || 'md';
  setTextSize(saved);
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('collapsed');
  localStorage.setItem(STORAGE.SIDEBAR, sb.classList.contains('collapsed'));
  // On mobile, show/hide overlay
  const overlay = document.getElementById('sidebarOverlay');
  if (overlay) overlay.style.display = sb.classList.contains('collapsed') ? 'none' : '';
}

function loadSidebarState() {
  if (localStorage.getItem(STORAGE.SIDEBAR) === 'true') {
    document.getElementById('sidebar').classList.add('collapsed');
  }
}

async function checkServerStatus() {
  // Demo mode: always online
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  dot.className = 'status-dot online';
  txt.textContent = 'Demo Mode';
}

// ==================== CONVERSATIONS ====================
function loadConversations() {
  state.conversations = JSON.parse(localStorage.getItem(STORAGE.CONVS) || '[]');
}

function saveConversations() {
  if (state.conversations.length > 100) state.conversations = state.conversations.slice(-100);
  localStorage.setItem(STORAGE.CONVS, JSON.stringify(state.conversations));
  document.getElementById('convCount').textContent = state.conversations.length;
}

function newChat() {
  state.activeConvId = null;
  state.editingIndex = null;
  state.attachments = [];
  renderMessages([]);
  renderAttachments();
  const wrapper = document.getElementById('costBarWrapper');
  if (wrapper) wrapper.classList.remove('visible');
  focusInput();
  renderConvList();
}

function selectConv(id) {
  state.activeConvId = id;
  state.editingIndex = null;
  state.attachments = [];
  const conv = state.conversations.find(c => c.id === id);
  if (conv) {
    const messages = getActiveBranchMessages(conv);
    renderMessages(messages, conv);
  }
  renderAttachments();
  renderConvList();
  focusInput();
}

function deleteConv(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this conversation?')) return;
  state.conversations = state.conversations.filter(c => c.id !== id);
  saveConversations();
  if (state.activeConvId === id) newChat();
  renderConvList();
}

function renameConv(id, e) {
  e.stopPropagation();
  const conv = state.conversations.find(c => c.id === id);
  if (!conv) return;
  const t = prompt('Enter new title:', conv.title);
  if (t && t.trim()) {
    conv.title = t.trim();
    saveConversations();
    renderConvList();
  }
}

function searchConversations(query) {
  state.searchQuery = query.toLowerCase().trim();
  renderConvList();
}

function clearAllHistory() {
  if (!confirm('PURGE all conversation history? This cannot be undone.')) return;
  state.conversations = [];
  state.activeConvId = null;
  saveConversations();
  newChat();
  renderConvList();
}

function renderConvList() {
  const list = document.getElementById('convList');
  let filtered = [...state.conversations];
  if (state.searchQuery) {
    filtered = filtered.filter(c => {
      if (c.title.toLowerCase().includes(state.searchQuery)) return true;
      const msgs = c.branches ? getActiveBranchMessages(c) : c.messages;
      return msgs?.some(m => m.content?.toLowerCase().includes(state.searchQuery));
    });
  }
  const sorted = filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  if (sorted.length === 0) {
    list.innerHTML = `<div style="padding:20px;color:var(--t3);text-align:center;font-family:var(--fm);font-size:12px">${state.searchQuery ? 'No matches found' : 'No conversations yet'}</div>`;
  } else {
    list.innerHTML = sorted.map(c => {
      const isActive = c.id === state.activeConvId;
      const hasBranches = c.branches && c.branches.length > 1;
      const isExpanded = isActive && hasBranches;
      const branchBadge = hasBranches
        ? `<span class="branch-badge" title="${c.branches.length} branches">⑂${c.branches.length}</span>`
        : '';
      let html = `
      <div class="conv-group${isExpanded ? ' expanded' : ''}">
        <div class="conversation-item${isActive ? ' active' : ''}" onclick="selectConv('${c.id}')">
          ${hasBranches ? `<span class="conv-expand-icon">${isExpanded ? '▾' : '▸'}</span>` : ''}
          <span class="conversation-title">${escapeHtml(c.title)}${branchBadge}</span>
          <span class="conversation-actions">
            <button class="conv-btn" onclick="renameConv('${c.id}',event)" title="Rename">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            </button>
            <button class="conv-btn" onclick="deleteConv('${c.id}',event)" title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </span>
        </div>`;
      if (isExpanded) {
        html += `<div class="branch-sub-list">`;
        c.branches.forEach((branch, i) => {
          const branchActive = (c.activeBranch || 0) === i;
          const preview = branch.messages && branch.messages.length > 0
            ? escapeHtml(branch.messages[0].content || '').substring(0, 30)
            : 'Empty branch';
          html += `
          <div class="branch-sub-item${branchActive ? ' active' : ''}" onclick="switchBranch('${c.id}',${i})">
            <span class="branch-sub-icon">⑂</span>
            <span class="branch-sub-label">Branch ${i + 1}</span>
            <span class="branch-sub-preview">${preview}</span>
          </div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;
      return html;
    }).join('');
  }
  document.getElementById('convCount').textContent = state.conversations.length;
}

// ==================== BRANCHING ====================
function getActiveBranchMessages(conv) {
  if (!conv.branches) return conv.messages || [];
  const idx = conv.activeBranch || 0;
  const branch = conv.branches[idx];
  return branch ? branch.messages : conv.messages || [];
}

function switchBranch(convId, branchIndex) {
  const conv = state.conversations.find(c => c.id === convId);
  if (!conv || !conv.branches) return;
  conv.activeBranch = branchIndex;
  saveConversations();
  selectConv(convId);
}

function createBranch(conv, fromIndex) {
  if (!conv.branches) {
    conv.branches = [{ messages: [...conv.messages] }];
    conv.activeBranch = 0;
  }
  const currentMessages = getActiveBranchMessages(conv);
  const newBranchMessages = currentMessages.slice(0, fromIndex);
  conv.branches.push({ messages: newBranchMessages });
  conv.activeBranch = conv.branches.length - 1;
  return conv.activeBranch;
}

// ==================== FILE ATTACHMENTS ====================
function isValidFileType(file) {
  if (SUPPORTED_MIME_TYPES[file.type]) return true;
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  for (const exts of Object.values(SUPPORTED_MIME_TYPES)) {
    if (exts.includes(ext)) return true;
  }
  return false;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function getFileIcon(mimeType, fileName) {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || fileName.endsWith('.csv')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.startsWith('text/x-') || mimeType === 'text/javascript' || mimeType === 'text/typescript') return '💻';
  if (mimeType === 'application/json' || mimeType.includes('xml') || mimeType === 'text/yaml') return '⚙️';
  return '📎';
}

function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  let hasLargeFile = false;
  for (const file of files) {
    if (state.attachments.length >= MAX_FILES) {
      alert(`Maximum ${MAX_FILES} files allowed.`);
      break;
    }
    if (!isValidFileType(file)) {
      alert(`Unsupported file type: ${file.name}`);
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert(`File too large (max 100MB): ${file.name}`);
      continue;
    }
    if (file.size > 1 * 1024 * 1024) hasLargeFile = true;
    const attachment = {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      s3Key: null,
      uploadProgress: 0,
      status: 'uploading',
      errorMessage: null,
      file: file,
      xhr: null
    };
    state.attachments.push(attachment);
    uploadFile(attachment);
  }
  if (hasLargeFile) {
    const cb = document.getElementById('smartSummaryCheck');
    if (cb && !cb.checked) {
      cb.checked = true;
      toggleSmartSummary();
    }
  }
  renderAttachments();
  updateSendButton();
  event.target.value = '';
}

function handlePaste(event) {
  const items = event.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/') && state.attachments.length < MAX_FILES) {
      const file = item.getAsFile();
      if (!file) continue;
      event.preventDefault();
      const attachment = {
        fileName: 'pasted-image.png',
        mimeType: file.type,
        fileSize: file.size,
        s3Key: null,
        uploadProgress: 0,
        status: 'uploading',
        errorMessage: null,
        file: file,
        xhr: null
      };
      state.attachments.push(attachment);
      uploadFile(attachment);
      renderAttachments();
      updateSendButton();
    }
  }
}

async function uploadFile(attachment) {
  // Demo mode: uploads disabled
  showToast('File uploads are disabled in demo mode. Contact i@whyshock.com for the full version.');
  removeAttachment(state.attachments.indexOf(attachment));
}

function retryUpload(index) {
  const att = state.attachments[index];
  if (!att || att.status !== 'error') return;
  att.status = 'uploading';
  att.uploadProgress = 0;
  att.errorMessage = null;
  att.s3Key = null;
  renderAttachments();
  updateSendButton();
  uploadFile(att);
}

function removeAttachment(index) {
  const att = state.attachments[index];
  if (att && att.xhr) {
    try { att.xhr.abort(); } catch(e) {}
  }
  state.attachments.splice(index, 1);
  renderAttachments();
  updateSendButton();
}

function renderAttachments() {
  const area = document.getElementById('attachmentArea');
  if (state.attachments.length === 0) {
    area.innerHTML = '';
    return;
  }
  area.innerHTML = state.attachments.map((att, i) => {
    const icon = getFileIcon(att.mimeType, att.fileName);
    let statusIcon = '';
    let extra = '';
    if (att.status === 'uploaded') {
      statusIcon = '<span class="status-icon">✓</span>';
    } else if (att.status === 'error') {
      statusIcon = '<span class="status-icon">✗</span>';
      extra = `<button class="retry-btn" onclick="retryUpload(${i})">RETRY</button>`;
    }
    const progressBar = att.status === 'uploading'
      ? `<div class="attachment-progress" style="width:${att.uploadProgress}%"></div>`
      : '';
    return `<div class="attachment-chip ${att.status}">
      <span class="file-icon">${icon}</span>
      <span class="file-name">${escapeHtml(att.fileName)}</span>
      <span class="file-size">${formatFileSize(att.fileSize)}</span>
      ${statusIcon}${extra}
      <button class="remove-btn" onclick="removeAttachment(${i})">×</button>
      ${progressBar}
    </div>`;
  }).join('');
}

function updateSendButton() {
  const btn = document.getElementById('sendBtn');
  const uploading = state.attachments.some(a => a.status === 'uploading');
  btn.disabled = uploading;
  btn.classList.toggle('uploading', uploading);
}
// ==================== CYBERPUNK BOT AVATAR SVG ====================
function getHumanAvatarSVG() {
  const light = document.body.classList.contains('light-mode');
  const sh2 = light ? '#8090b8' : '#2a3458';
  const sh3 = light ? '#a0b0d4' : '#384870';
  const shHi = light ? '#c0cce8' : '#4a6090';
  const visor = light ? '#141e30' : '#0a0e1c';
  const visorEdge = light ? '#1e2840' : '#121828';
  const glow = light ? '#b050e0' : '#d48eff';
  const glowSoft = light ? 'rgba(176,80,224,' : 'rgba(212,142,255,';
  return `<svg class="human-avatar-svg" viewBox="0 0 80 60" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="hg"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="hhbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${sh3}"/><stop offset="100%" stop-color="${sh2}"/></linearGradient>
      <linearGradient id="hhvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${visorEdge}"/><stop offset="100%" stop-color="${visor}"/></linearGradient>
      <clipPath id="hvc"><rect x="8" y="10" width="64" height="38" rx="16"/></clipPath>
    </defs>
    <!-- Head shell -->
    <rect x="4" y="2" width="72" height="52" rx="22" fill="url(#hhbg)" stroke="${sh2}" stroke-width="0.5"/>
    <!-- Hair/top detail — spiky -->
    <path d="M26 6 L30 0 L34 5 L38 -1 L42 4 L46 0 L50 5 L54 1 L56 6" fill="${sh3}" stroke="${sh2}" stroke-width="0.4"/>
    <!-- Head highlight -->
    <path d="M16 12 Q24 5 42 5" fill="none" stroke="${shHi}" stroke-width="2.5" opacity="0.7" stroke-linecap="round"/>
    <!-- Headphone left -->
    <rect x="0" y="16" width="7" height="20" rx="3.5" fill="url(#hhbg)" stroke="${sh2}" stroke-width="0.4"/>
    <circle cx="3.5" cy="26" r="1.5" fill="${glow}" opacity="0.5"/>
    <!-- Headphone right -->
    <rect x="73" y="16" width="7" height="20" rx="3.5" fill="url(#hhbg)" stroke="${sh2}" stroke-width="0.4"/>
    <circle cx="76.5" cy="26" r="1.5" fill="${glow}" opacity="0.5"/>
    <!-- Visor / face screen -->
    <rect x="8" y="10" width="64" height="38" rx="16" fill="url(#hhvg)"/>
    <!-- All face features clipped inside visor -->
    <g clip-path="url(#hvc)">
      <!-- Left eye — round dot -->
      <circle class="human-eye-l" cx="28" cy="26" r="5" fill="${glow}" filter="url(#hg)"/>
      <circle cx="28" cy="26" r="3.5" fill="${glow}" opacity="0.5"/>
      <circle cx="26.5" cy="24.5" r="1" fill="#fff" opacity="0.7"/>
      <!-- Right eye — round dot -->
      <circle class="human-eye-r" cx="52" cy="26" r="5" fill="${glow}" filter="url(#hg)"/>
      <circle cx="52" cy="26" r="3.5" fill="${glow}" opacity="0.5"/>
      <circle cx="50.5" cy="24.5" r="1" fill="#fff" opacity="0.7"/>
      <!-- Smile — filled U-shape -->
      <path class="human-mouth" d="M33 36 Q34 34 40 34 Q46 34 47 36Z" fill="${glow}" filter="url(#hg)" opacity="0.8"/>
      <!-- Eye glow ambient -->
      <ellipse cx="28" cy="26" rx="8" ry="6" fill="${glowSoft}0.08)"/>
      <ellipse cx="52" cy="26" rx="8" ry="6" fill="${glowSoft}0.08)"/>
    </g>
  </svg>`;
}

function getFridayAvatarSVG(isProcessing) {
  const cls = isProcessing ? ' processing' : '';
  const light = document.body.classList.contains('light-mode');
  const sh2 = light ? '#8090b8' : '#2a3458';
  const sh3 = light ? '#a0b0d4' : '#384870';
  const shHi = light ? '#c0cce8' : '#4a6090';
  const visor = light ? '#141e30' : '#0a0e1c';
  const visorEdge = light ? '#1e2840' : '#121828';
  const glow = light ? '#2a8cdb' : '#5b8cff';
  const glowSoft = light ? 'rgba(42,140,219,' : 'rgba(91,140,255,';
  return `<svg class="friday-avatar-svg${cls}" viewBox="0 0 80 60" xmlns="http://www.w3.org/2000/svg" style="width:36px;height:36px">
    <defs>
      <filter id="fg"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="hbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${sh3}"/><stop offset="100%" stop-color="${sh2}"/></linearGradient>
      <linearGradient id="hvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${visorEdge}"/><stop offset="100%" stop-color="${visor}"/></linearGradient>
      <clipPath id="vc"><rect x="8" y="10" width="64" height="38" rx="16"/></clipPath>
    </defs>
    <!-- Head shell -->
    <rect x="4" y="2" width="72" height="52" rx="22" fill="url(#hbg)" stroke="${sh2}" stroke-width="0.5"/>
    <!-- Head top bump -->
    <ellipse cx="40" cy="4" rx="11" ry="5" fill="${sh3}" stroke="${sh2}" stroke-width="0.4"/>
    <!-- Head highlight -->
    <path d="M16 12 Q24 5 42 5" fill="none" stroke="${shHi}" stroke-width="2.5" opacity="0.7" stroke-linecap="round"/>
    <!-- Ear pad left -->
    <rect x="0" y="16" width="7" height="20" rx="3.5" fill="url(#hbg)" stroke="${sh2}" stroke-width="0.4"/>
    <!-- Ear pad right -->
    <rect x="73" y="16" width="7" height="20" rx="3.5" fill="url(#hbg)" stroke="${sh2}" stroke-width="0.4"/>
    <!-- Visor / face screen -->
    <rect x="8" y="10" width="64" height="38" rx="16" fill="url(#hvg)"/>
    <!-- All face features clipped inside visor -->
    <g clip-path="url(#vc)">
      <!-- Left eye -->
      <path class="bot-eye-l" d="M22 32 Q22 22 30 22 Q38 22 38 32Z" fill="${glow}" filter="url(#fg)"/>
      <path d="M23.5 32 Q23.5 23.5 30 23.5 Q36.5 23.5 36.5 32Z" fill="${glow}" opacity="0.5"/>
      <!-- Right eye -->
      <path class="bot-eye-r" d="M42 32 Q42 22 50 22 Q58 22 58 32Z" fill="${glow}" filter="url(#fg)"/>
      <path d="M43.5 32 Q43.5 23.5 50 23.5 Q56.5 23.5 56.5 32Z" fill="${glow}" opacity="0.5"/>
      <!-- Smile — filled U-shape -->
      <path class="bot-mouth" d="M33 38 Q34 36 40 36 Q46 36 47 38Z" fill="${glow}" filter="url(#fg)" opacity="0.9"/>
      <!-- Eye glow ambient -->
      <ellipse cx="30" cy="28" rx="10" ry="7" fill="${glowSoft}0.08)" class="bot-eye-glow"/>
      <ellipse cx="50" cy="28" rx="10" ry="7" fill="${glowSoft}0.08)" class="bot-eye-glow"/>
    </g>
  </svg>`;
}

// ==================== RENDER MESSAGES ====================
function renderEmptyState() {
  const el = document.getElementById('emptyState');
  if (!el) return;
  el.innerHTML = `
    <div style="position:relative;display:inline-flex;align-items:center;justify-content:center">
      <div style="position:absolute;inset:-20px;border-radius:50%;border:1px solid var(--cyan);opacity:.2;animation:ringPulse 3s ease-in-out infinite"></div>
      <div style="position:absolute;inset:-35px;border-radius:50%;border:1px solid var(--purple);opacity:.1;animation:ringPulse 3s ease-in-out infinite .5s"></div>
      <div style="position:absolute;inset:-50px;border-radius:50%;border:1px solid var(--mag);opacity:.06;animation:ringPulse 3s ease-in-out infinite 1s"></div>
      ${getFridayAvatarSVG(false).replace('width:36px;height:36px', 'width:80px;height:80px')}
    </div>
    <h2 class="glitch-text" data-text="FRIDAY">FRIDAY</h2>
    <p>Cyberpunk AI assistant. Ready for your commands.</p>`;
}

function renderMessages(messages, conv) {
  const container = document.getElementById('messages');
  if (!messages || messages.length === 0) {
    container.innerHTML = '<div class="empty-state" id="emptyState"></div>';
    renderEmptyState();
    return;
  }

  // Check if we can do a partial update (only last message changed during streaming)
  const lastMsg = messages[messages.length - 1];
  const existingMsgEls = container.querySelectorAll('.message');
  const isStreamingUpdate = lastMsg && lastMsg.loading && existingMsgEls.length === messages.length + (conv && conv.branches && conv.branches.length > 1 ? 0 : 0);

  // If streaming and message count matches, just update the last message content
  if (isStreamingUpdate && existingMsgEls.length > 0) {
    const lastEl = existingMsgEls[existingMsgEls.length - 1];
    if (lastEl && lastEl.dataset.idx == String(messages.length - 1)) {
      const contentEl = lastEl.querySelector('.message-content');
      if (contentEl) {
        const rendered = renderMarkdown(lastMsg.content || '');
        const thinkHtml = lastMsg.thinking ? `<div class="thinking-block"><div class="thinking-header" onclick="toggleThinkingDisplay(this)"><span class="thinking-toggle-icon">▼</span> THINKING</div><div class="thinking-content">${escapeHtml(lastMsg.thinking)}</div></div>` : '';
        const loadingHtml = lastMsg.loading ? '<div class="loading-dots"><span></span><span></span><span></span></div>' : '';
        contentEl.innerHTML = thinkHtml + rendered + loadingHtml;
        contentEl.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
        container.scrollTop = container.scrollHeight;
        // Update cost bar
        const settings = getSettings();
        const activeModelId = settings.customModelId || settings.model || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
        updateStickyCost(messages, activeModelId);
        return;
      }
    }
  }

  // Full render
  // Branch info
  let branchInfo = '';
  if (conv && conv.branches && conv.branches.length > 1) {
    const current = conv.activeBranch || 0;
    const total = conv.branches.length;
    branchInfo = `<div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:8px;font-size:11px;font-family:var(--fm);color:var(--t3)">
      <button class="action-btn" onclick="switchBranch('${conv.id}',${Math.max(0,current-1)})" ${current===0?'disabled':''}>◀</button>
      <span><span style="color:var(--purple)">BRANCH</span> ${current + 1}/${total}</span>
      <button class="action-btn" onclick="switchBranch('${conv.id}',${Math.min(total-1,current+1)})" ${current===total-1?'disabled':''}>▶</button>
    </div>`;
  }

  // Update cost bar
  const settings = getSettings();
  const activeModelId = settings.customModelId || settings.model || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
  updateStickyCost(messages, activeModelId);

  container.innerHTML = branchInfo + messages.map((m, i) => renderMessage(m, i, conv)).join('');
  container.scrollTop = container.scrollHeight;

  container.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
  if (typeof renderMathInElement === 'function') {
    try {
      renderMathInElement(container, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false}
        ]
      });
    } catch(e) {}
  }
}

function renderMessage(msg, index, conv) {
  const isHuman = msg.role === 'user';
  const isLoading = msg.loading;
  const isEditing = state.editingIndex === index;

  let thinkingHtml = '';
  if (!isHuman && msg.thinking) {
    thinkingHtml = `<div class="thinking-block">
      <div class="thinking-header" onclick="toggleThinkingDisplay(this)">
        <span class="thinking-toggle-icon">▼</span>
        <span>PROCESSING TRACE</span>
      </div>
      <div class="thinking-content">${escapeHtml(msg.thinking)}</div>
    </div>`;
  }

  let contentHtml;
  if (isEditing) {
    contentHtml = `<div>
      <textarea class="edit-textarea" id="editTextarea">${escapeHtml(msg.content)}</textarea>
      <div class="edit-btns">
        <button class="btn-primary" onclick="saveEdit(${index})">SAVE & RESEND</button>
        <button class="btn-secondary" onclick="cancelEdit()">CANCEL</button>
      </div>
    </div>`;
  } else if (isHuman) {
    let html = `<div style="white-space:pre-wrap">${escapeHtml(msg.content)}</div>`;
    if (msg.images && msg.images.length > 0) {
      html += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">';
      msg.images.forEach(img => { html += `<img src="${img}" style="max-width:100px;max-height:100px;border-radius:4px;border:1px solid var(--bdr)">`; });
      html += '</div>';
    }
    if (msg.attachments && msg.attachments.length > 0) {
      html += '<div class="msg-attachments">';
      msg.attachments.forEach(a => {
        html += `<span class="msg-attachment-chip">${getFileIcon(a.mimeType, a.fileName)} ${escapeHtml(a.fileName)} (${formatFileSize(a.fileSize)})</span>`;
      });
      html += '</div>';
    }
    contentHtml = html;
  } else {
    contentHtml = renderMarkdown(msg.content || '');
    // Apply citations and sources panel if sources are present
    if (msg.sources && msg.sources.length > 0) {
      contentHtml = renderCitations(contentHtml, msg.sources);
      contentHtml += buildSourcesPanel(msg.sources, msg.searchQuery);
    } else if (msg.searchQuery) {
      contentHtml += `<div class="search-query-indicator">🔍 Searched: <span class="search-query-text">${escapeHtml(msg.searchQuery)}</span> — no results found</div>`;
    }
  }

  let tokenHtml = '';
  if (!isHuman && msg.usage && !isLoading) {
    tokenHtml = `<div class="token-usage">
      <span>IN: ${msg.usage.inputTokens.toLocaleString()}</span>
      <span>OUT: ${msg.usage.outputTokens.toLocaleString()}</span>
      <span>Σ ${msg.usage.totalTokens.toLocaleString()}</span>
    </div>`;
  }

  let actionsHtml = '';
  if (!isLoading && !isEditing) {
    if (isHuman) {
      actionsHtml = `<div class="message-actions">
        <button class="action-btn" onclick="startEdit(${index})"><span class="action-icon">✎</span> Edit</button>
        <button class="action-btn" onclick="copyMessage(${index})"><span class="action-icon">⎘</span> Copy</button>
      </div>`;
    } else {
      actionsHtml = `<div class="message-actions">
        <button class="action-btn" onclick="copyMessage(${index})"><span class="action-icon">⎘</span> Copy</button>
        <button class="action-btn" onclick="retryMessage(${index})"><span class="action-icon">↻</span> Retry</button>
        <button class="action-btn" onclick="branchFrom(${index})"><span class="action-icon">⑂</span> Branch</button>
      </div>`;
    }
  }

  const avatarHtml = isHuman
    ? `<div class="human-avatar-wrap"><div class="message-avatar human">${getHumanAvatarSVG()}</div><span class="typing-dot"></span></div>`
    : `<div class="message-avatar assistant">${getFridayAvatarSVG(isLoading)}</div>`;

  return `<div class="message ${isHuman ? 'human' : 'assistant'}" data-idx="${index}">
    <div class="message-header">
      ${avatarHtml}
      <span class="message-author">${isHuman ? 'YOU' : 'FRIDAY'}</span>
      ${isLoading ? '<div class="loading-dots"><span></span><span></span><span></span></div>' : ''}
    </div>
    <div class="message-content">${thinkingHtml}${contentHtml}</div>
    ${tokenHtml}${actionsHtml}
  </div>`;
}

function toggleThinkingDisplay(el) {
  const content = el.nextElementSibling;
  const icon = el.querySelector('.thinking-toggle-icon');
  content.classList.toggle('collapsed');
  icon.classList.toggle('collapsed');
}
// ==================== EDIT / RETRY / BRANCH / COPY ====================
function startEdit(index) {
  state.editingIndex = index;
  const conv = state.conversations.find(c => c.id === state.activeConvId);
  if (conv) renderMessages(getActiveBranchMessages(conv), conv);
}

function cancelEdit() {
  if (state.editingIndex === null) return;
  state.editingIndex = null;
  const conv = state.conversations.find(c => c.id === state.activeConvId);
  if (conv) renderMessages(getActiveBranchMessages(conv), conv);
}

function saveEdit(index) {
  const textarea = document.getElementById('editTextarea');
  const newContent = textarea.value.trim();
  if (!newContent) return;
  const conv = state.conversations.find(c => c.id === state.activeConvId);
  if (!conv) return;
  createBranch(conv, index);
  saveConversations();
  state.editingIndex = null;
  document.getElementById('input').value = newContent;
  sendMessage();
}

function retryMessage(index) {
  const conv = state.conversations.find(c => c.id === state.activeConvId);
  if (!conv) return;
  const messages = getActiveBranchMessages(conv);
  if (!messages[index]) return;
  // If called from assistant message, find the preceding user message
  let userIndex = index;
  if (messages[index].role === 'assistant') {
    userIndex = index - 1;
    if (userIndex < 0 || !messages[userIndex] || messages[userIndex].role !== 'user') return;
  }
  const content = messages[userIndex].content;
  createBranch(conv, userIndex);
  saveConversations();
  renderConvList();
  document.getElementById('input').value = content;
  sendMessage();
}

function branchFrom(index) {
  const conv = state.conversations.find(c => c.id === state.activeConvId);
  if (!conv) return;
  // If called from assistant message, branch after the preceding user message
  const messages = getActiveBranchMessages(conv);
  let branchPoint = index + 1;
  if (messages[index] && messages[index].role === 'assistant') {
    branchPoint = index; // keep messages up to (not including) this response
  }
  createBranch(conv, branchPoint);
  saveConversations();
  selectConv(conv.id);
}

function copyMessage(index) {
  const conv = state.conversations.find(c => c.id === state.activeConvId);
  if (conv) {
    const messages = getActiveBranchMessages(conv);
    if (messages[index]) navigator.clipboard.writeText(messages[index].content);
  }
}

// ==================== MARKDOWN ====================
function renderMarkdown(text) {
  if (!text) return '';
  marked.setOptions({
    highlight: (code, lang) => lang && hljs.getLanguage(lang) ? hljs.highlight(code, {language:lang}).value : hljs.highlightAuto(code).value,
    breaks: true, gfm: true
  });
  let html = marked.parse(text);
  html = html.replace(/<pre><code/g, '<pre><button class="copy-code-btn" onclick="copyCodeBlock(this)">COPY</button><code');
  return html;
}

function copyCodeBlock(btn) {
  const code = btn.nextElementSibling.textContent;
  navigator.clipboard.writeText(code);
  btn.textContent = 'COPIED';
  btn.style.color = 'var(--green)';
  setTimeout(() => { btn.textContent = 'COPY'; btn.style.color = ''; }, 2000);
}

// ==================== COST CALCULATION ====================
function getPricingForModel(modelId) {
  if (!modelId) return BEDROCK_PRICING['default'];
  const m = modelId.toLowerCase();
  for (const [key, val] of Object.entries(BEDROCK_PRICING)) {
    if (key !== 'default' && m.includes(key)) return val;
  }
  return BEDROCK_PRICING['default'];
}

function calcConvCost(messages, modelId) {
  let totalIn = 0, totalOut = 0, totalTokens = 0;
  const pricing = getPricingForModel(modelId);
  for (const m of messages) {
    if (m.usage && m.role === 'assistant') {
      totalIn += m.usage.inputTokens || 0;
      totalOut += m.usage.outputTokens || 0;
      totalTokens += m.usage.totalTokens || 0;
    }
  }
  if (totalTokens === 0) return null;
  const costIn = (totalIn / 1_000_000) * pricing.in;
  const costOut = (totalOut / 1_000_000) * pricing.out;
  const costTotal = costIn + costOut;
  return { totalIn, totalOut, totalTokens, costIn, costOut, costTotal, pricing };
}

function formatCost(usd) {
  if (usd < 0.00001) return '$0.00';
  if (usd < 0.01) return '$' + usd.toFixed(5);
  if (usd < 1) return '$' + usd.toFixed(4);
  return '$' + usd.toFixed(3);
}
function updateStickyCost(messages, modelId) {
  const wrapper = document.getElementById('costBarWrapper');
  const bar = document.getElementById('costBar');
  if (!wrapper || !bar) return;
  const cost = calcConvCost(messages, modelId);
  if (!cost) { wrapper.classList.remove('visible'); return; }
  wrapper.classList.add('visible');
  bar.innerHTML = `
    <span class="cost-title">SESSION</span>
    <span class="cost-item"><span class="cost-label">Input</span> ${cost.totalIn.toLocaleString()}</span>
    <span class="cost-item"><span class="cost-label">Output</span> ${cost.totalOut.toLocaleString()}</span>
    <span class="cost-item"><span class="cost-label">Total</span> ${cost.totalTokens.toLocaleString()}</span>
    <span class="cost-total">${formatCost(cost.costTotal)}</span>
    <span class="cost-note">$${cost.pricing.in} / $${cost.pricing.out} per 1M tokens</span>`;
}

// ==================== UTILITIES ====================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function generateTitle(text) { const c = text.replace(/\n/g, ' ').trim(); return c.length <= 50 ? c : c.substring(0, 47) + '...'; }

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 300) + 'px';
}

function expandTextarea() {
  const el = document.getElementById('input');
  el.style.height = el.style.height === '200px' ? '48px' : '200px';
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendClick(); }
}

function handleSendClick() {
  if (state.isLoading) return;
  if (state.attachments.some(a => a.status === 'uploading')) return;
  sendMessage();
}

function stopProcessing() {
  state.isLoading = false;
  document.getElementById('sendBtn').style.display = 'inline-flex';
  document.getElementById('stopBtn').style.display = 'none';
  document.getElementById('input').disabled = false;
  document.getElementById('input').focus();
  setFridayProcessing(false);
  updateMicButtonState();
}

function setFridayProcessing(on) {
  document.querySelectorAll('.friday-avatar-svg').forEach(el => {
    if (on) el.classList.add('processing'); else el.classList.remove('processing');
  });
}

let typingTimer = null;
function onInputTyping() {
  document.querySelectorAll('.human-avatar-wrap').forEach(el => el.classList.add('is-typing'));
  const inputAvatar = document.getElementById('inputAvatar');
  if (inputAvatar) {
    inputAvatar.classList.remove('typing');
    void inputAvatar.offsetWidth;
    inputAvatar.classList.add('typing');
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    document.querySelectorAll('.human-avatar-wrap').forEach(el => el.classList.remove('is-typing'));
  }, 1200);
}
// ==================== WEB SEARCH TOGGLE ====================
function toggleWebSearch() {
  const s = getSettings();
  const checked = document.getElementById('webSearchCheck').checked;
  s.webSearch = checked;
  document.getElementById('webSearchToggle').classList.toggle('active', checked);
  localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(s));
}

// ==================== VOICE INPUT ====================
function initVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    state.voice = { supported: false, status: 'idle', interimTranscript: '', recognition: null };
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.onresult = handleVoiceResult;
  recognition.onerror = handleVoiceError;
  recognition.onend = handleVoiceEnd;
  state.voice = { supported: true, status: 'idle', interimTranscript: '', recognition };
  const micBtn = document.getElementById('micBtn');
  if (micBtn) micBtn.style.display = 'inline-flex';
}

function toggleVoiceInput() {
  if (!state.voice || !state.voice.supported) {
    showToast('Voice input not supported in this browser');
    return;
  }
  if (state.voice.status === 'idle') {
    try {
      state.voice.recognition.start();
      state.voice.status = 'listening';
    } catch (e) {
      state.voice.status = 'idle';
    }
  } else {
    state.voice.recognition.stop();
    state.voice.status = 'idle';
  }
  updateMicButtonState();
}

function handleVoiceResult(event) {
  let interimTranscript = '';
  let finalTranscript = '';
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcript = event.results[i][0].transcript;
    if (event.results[i].isFinal) {
      finalTranscript += transcript;
    } else {
      interimTranscript += transcript;
    }
  }
  const input = document.getElementById('input');
  if (finalTranscript) {
    input.value = (input.value + ' ' + finalTranscript).trim();
    state.voice.interimTranscript = '';
    autoResize(input);
    updateVoicePreview('');
  } else {
    state.voice.interimTranscript = interimTranscript;
    updateVoicePreview(interimTranscript);
  }
  state.voice.status = finalTranscript ? 'idle' : 'transcribing';
  updateMicButtonState();
}

function handleVoiceError(event) {
  if (event.error === 'not-allowed') {
    showToast('Microphone access denied. Check browser permissions.');
  } else if (event.error === 'no-speech') {
    showToast('No speech detected.');
  }
  state.voice.status = 'idle';
  state.voice.interimTranscript = '';
  updateMicButtonState();
  updateVoicePreview('');
}

function handleVoiceEnd() {
  state.voice.status = 'idle';
  updateMicButtonState();
  updateVoicePreview('');
}

function updateMicButtonState() {
  const btn = document.getElementById('micBtn');
  if (!btn) return;
  const active = state.voice.status === 'listening' || state.voice.status === 'transcribing';
  btn.classList.toggle('mic-active', active);
  // Hide mic button while FRIDAY is processing a response
  if (state.isLoading) {
    btn.style.display = 'none';
  } else if (state.voice && state.voice.supported) {
    btn.style.display = 'inline-flex';
  }
}

function updateVoicePreview(text) {
  const el = document.getElementById('voicePreview');
  if (!el) return;
  if (text) {
    el.textContent = text;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
    el.textContent = '';
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.classList.add('show'); }, 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// ==================== CITATION RENDERER ====================
function citationEscapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isValidHttpUrl(str) {
  try { const u = new URL(str); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

function renderCitations(responseText, sources) {
  if (!sources || sources.length === 0) return responseText;
  return responseText.replace(/\[(\d+)\]/g, (match, numStr) => {
    const index = parseInt(numStr, 10);
    const source = sources.find(s => s.index === index);
    if (!source) return match;
    const escapedTitle = citationEscapeHtml(source.title);
    const escapedUrl = citationEscapeHtml(source.url);
    if (!isValidHttpUrl(source.url)) return match;
    return `<sup class="citation-marker" data-source-index="${index}" title="${escapedTitle}"><a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${index}</a></sup>`;
  });
}

function buildSourcesPanel(sources, searchQuery) {
  if (!sources || sources.length === 0) return '';
  const queryHtml = searchQuery ? `<div class="search-query-indicator">🔍 Searched: <span class="search-query-text">${citationEscapeHtml(searchQuery)}</span></div>` : '';
  const items = sources.map(s => {
    const title = citationEscapeHtml(s.title);
    const url = citationEscapeHtml(s.url);
    const domain = citationEscapeHtml(s.domain);
    const snippet = citationEscapeHtml(s.snippet);
    const href = isValidHttpUrl(s.url) ? url : '#';
    const favicon = s.domain ? `https://www.google.com/s2/favicons?domain=${citationEscapeHtml(s.domain)}&sz=16` : '';
    return `<a class="source-chip" href="${href}" target="_blank" rel="noopener noreferrer">
      <span class="source-index">${s.index}</span>
      ${favicon ? `<img class="source-favicon" src="${favicon}" alt="" width="16" height="16">` : ''}
      <span class="source-title">${title}</span>
      <span class="source-domain">${domain}</span>
    </a>`;
  }).join('');
  return `${queryHtml}<div class="sources-panel">
    <div class="sources-header" onclick="toggleSourcesPanel(this)">
      <span>📡 Sources (${sources.length})</span>
      <span class="sources-toggle">▾</span>
    </div>
    <div class="sources-list">${items}</div>
  </div>`;
}

function toggleSourcesPanel(el) {
  const list = el.nextElementSibling;
  const toggle = el.querySelector('.sources-toggle');
  list.classList.toggle('collapsed');
  toggle.classList.toggle('collapsed');
}

// ==================== SEND MESSAGE ====================
async function sendMessage() {
  const input = document.getElementById('input');
  const text = input.value.trim();
  const settings = getSettings();

  // Gather uploaded attachments
  const uploadedAttachments = state.attachments.filter(a => a.status === 'uploaded');
  if (!text && uploadedAttachments.length === 0) return;
  if (state.isLoading) return;

  input.value = '';
  input.style.height = 'auto';

  let conv;
  if (state.activeConvId) {
    conv = state.conversations.find(c => c.id === state.activeConvId);
  }
  if (!conv) {
    conv = { id: generateId(), title: generateTitle(text || 'File conversation'), messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    state.conversations.push(conv);
    state.activeConvId = conv.id;
  }

  let messages;
  if (conv.branches) {
    const branchIndex = conv.activeBranch || 0;
    messages = conv.branches[branchIndex].messages;
  } else {
    messages = conv.messages;
  }

  const userMsg = { role: 'user', content: text, timestamp: Date.now() };
  state.attachments = [];
  renderAttachments();
  messages.push(userMsg);

  const assistantMsg = { role: 'assistant', content: '', thinking: '', loading: true, timestamp: Date.now() };
  messages.push(assistantMsg);
  renderMessages(messages, conv);
  renderConvList();

  state.isLoading = true;
  document.getElementById('sendBtn').style.display = 'none';
  document.getElementById('stopBtn').style.display = 'inline-flex';
  document.getElementById('input').disabled = true;
  const micBtn = document.getElementById('micBtn');
  if (micBtn) micBtn.style.display = 'none';
  if (state.voice && state.voice.status !== 'idle') {
    state.voice.recognition.stop();
    state.voice.status = 'idle';
    updateVoicePreview('');
  }
  setFridayProcessing(true);

  // === DEMO MODE: Fake streaming response ===
  const demoResponse = `Beep boop 🤖 I am **FRIDAY** — your cyberpunk AI assistant.

This is a **demo instance**. The full version runs on AWS serverless with 20+ AI models, web search, voice input, file attachments, and more.

**Want to deploy FRIDAY to your own AWS account?**

📧 Contact **i@whyshock.com** to get the deployment scripts and source code.

– FRIDAY out. 🔷`;

  const words = demoResponse.split(' ');
  for (let i = 0; i < words.length && state.isLoading; i++) {
    assistantMsg.content = words.slice(0, i + 1).join(' ');
    renderMessages(messages, conv);
    await new Promise(r => setTimeout(r, 40));
  }

  assistantMsg.content = demoResponse;
  assistantMsg.usage = { inputTokens: 12, outputTokens: 48, totalTokens: 60 };
  assistantMsg.loading = false;
  state.isLoading = false;
  document.getElementById('sendBtn').style.display = 'inline-flex';
  document.getElementById('stopBtn').style.display = 'none';
  document.getElementById('input').disabled = false;
  document.getElementById('input').focus();
  setFridayProcessing(false);
  updateMicButtonState();
  conv.updatedAt = Date.now();
  saveConversations();
  renderMessages(messages, conv);
  renderConvList();
}
// ==================== PARTICLE CANVAS ====================
function initParticleCanvas() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  const PARTICLE_COUNT = 120;
  const CONNECTION_DIST = 120;
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.r = Math.random() * 2 + 0.5;
      this.isMag = Math.random() > 0.7;
    }
    getColor(opacity) {
      const light = document.body.classList.contains('light-mode');
      if (this.isMag) return light ? `rgba(144,64,208,${opacity})` : `rgba(212,142,255,${opacity})`;
      return light ? `rgba(42,92,219,${opacity})` : `rgba(91,140,255,${opacity})`;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > w) this.vx *= -1;
      if (this.y < 0 || this.y > h) this.vy *= -1;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.getColor(0.6);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 3, 0, Math.PI * 2);
      ctx.fillStyle = this.getColor(0.08);
      ctx.fill();
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DIST) {
          const opacity = (1 - dist / CONNECTION_DIST) * 0.15;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          const light = document.body.classList.contains('light-mode');
          ctx.strokeStyle = light ? `rgba(42,92,219,${opacity})` : `rgba(91,140,255,${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  // Hex grid background
  function drawHexGrid() {
    const size = 30;
    const h_hex = size * Math.sqrt(3);
    const light = document.body.classList.contains('light-mode');
    ctx.strokeStyle = light ? 'rgba(180,185,210,0.18)' : 'rgba(20,20,40,0.2)';
    ctx.lineWidth = 0.3;
    for (let row = -1; row < canvas.height / h_hex + 1; row++) {
      for (let col = -1; col < canvas.width / (size * 1.5) + 1; col++) {
        const x = col * size * 1.5;
        const y = row * h_hex + (col % 2 ? h_hex / 2 : 0);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = Math.PI / 3 * i + Math.PI / 6;
          const hx = x + size * Math.cos(angle);
          const hy = y + size * Math.sin(angle);
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);
    drawHexGrid();
    particles.forEach(p => { p.update(); p.draw(); });
    drawConnections();
    requestAnimationFrame(animate);
  }
  animate();
}

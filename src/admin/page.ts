/**
 * 管理页面 HTML 模板
 * 使用 TailwindCSS CDN + 纯 Vanilla JS
 * 注意：模板字符串内部的 JS 代码中所有 ${...} 写为 \${...}，反引号写为 \`
 */
export function getAdminPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Elastic Proxy 管理控制台</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .modal-overlay { display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.5); z-index: 50;
      align-items: center; justify-content: center; padding: 1rem; }
    .modal-overlay.active { display: flex; }
    #toast {
      position: fixed; bottom: 1.5rem; right: 1.5rem;
      padding: 0.75rem 1.25rem; border-radius: 0.5rem;
      color: white; font-size: 0.875rem; z-index: 9999;
      opacity: 0; transition: opacity 0.3s; pointer-events: none;
    }
    #toast.show { opacity: 1; }
    #toast.success { background: #10b981; }
    #toast.error { background: #ef4444; }
    .toggle-btn { transition: background-color 0.2s; }
    .toggle-thumb { transition: transform 0.2s; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen font-sans">

<!-- ============ 登录页 ============ -->
<div id="loginPage" class="min-h-screen flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
    <div class="text-center mb-7">
      <div class="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-md">
        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
      </div>
      <h1 class="text-xl font-bold text-gray-900">Elastic Proxy</h1>
      <p class="text-sm text-gray-500 mt-1">管理控制台</p>
    </div>
    <div id="loginError"
      class="hidden mb-4 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
    </div>
    <div class="space-y-3">
      <input id="passwordInput" type="password" placeholder="管理员密码"
        class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
               bg-gray-50 hover:bg-white transition-colors"
        onkeydown="if(event.key==='Enter')login()">
      <button onclick="login()"
        class="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800
               text-white py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm">
        登录
      </button>
    </div>
  </div>
</div>

<!-- ============ 主控制台 ============ -->
<div id="mainPage" class="hidden min-h-screen">

  <!-- 顶部导航 -->
  <header class="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
    <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </div>
        <span class="font-semibold text-gray-800 text-sm">Elastic Proxy 管理</span>
        <span id="storageTag"
          class="hidden text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
          内存存储 (重启后数据丢失)
        </span>
      </div>
      <button onclick="logout()"
        class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3
               0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        登出
      </button>
    </div>
  </header>

  <!-- 主内容 -->
  <div class="max-w-4xl mx-auto px-4 pt-6 pb-16">

    <!-- Tab 导航 -->
    <div class="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
      <button id="tab-btn-endpoints" onclick="switchTab('endpoints')"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-white text-blue-600 shadow-sm">
        端点管理
      </button>
      <button id="tab-btn-proxyauth" onclick="switchTab('proxyauth')"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all text-gray-600 hover:text-gray-800">
        代理认证
      </button>
    </div>

    <!-- Tab 1: 端点管理 -->
    <div id="content-endpoints" class="tab-content active">
      <div class="flex items-start justify-between mb-5">
        <div>
          <h2 class="text-base font-semibold text-gray-900">端点配置</h2>
          <p class="text-sm text-gray-500 mt-0.5">
            配置 Elastic Inference 端点及对应的模型名，请求时自动路由
          </p>
        </div>
        <button onclick="openAddEndpointModal()"
          class="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700
                 text-white px-3.5 py-2 rounded-xl text-sm font-medium transition-colors shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          添加端点
        </button>
      </div>
      <div id="endpointsList" class="space-y-3">
        <div class="text-center py-8 text-gray-400 text-sm">加载中...</div>
      </div>
    </div>

    <!-- Tab 2: 代理认证 -->
    <div id="content-proxyauth" class="tab-content">
      <div class="mb-5">
        <h2 class="text-base font-semibold text-gray-900">代理 API Key 认证</h2>
        <p class="text-sm text-gray-500 mt-0.5">
          启用后，调用 /v1/* 接口需要携带 <code class="bg-gray-100 px-1 rounded text-xs">Authorization: Bearer &lt;key&gt;</code>
        </p>
      </div>

      <!-- 认证开关 -->
      <div class="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center justify-between">
        <div>
          <div class="text-sm font-medium text-gray-800">启用代理认证</div>
          <div class="text-xs text-gray-500 mt-0.5">开启后仅配置的 API Key 可访问代理接口</div>
        </div>
        <button id="proxyAuthToggleBtn" onclick="toggleProxyAuth()" role="switch"
          class="toggle-btn relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 focus:outline-none">
          <span id="proxyAuthToggleThumb"
            class="toggle-thumb inline-block h-4 w-4 transform rounded-full bg-white shadow translate-x-1">
          </span>
        </button>
      </div>

      <!-- API Key 列表 -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span class="text-sm font-medium text-gray-800">API Key 列表</span>
          <button onclick="openAddKeyModal()"
            class="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            添加
          </button>
        </div>
        <div id="proxyKeysList" class="px-4 py-3">
          <div class="text-sm text-gray-400 py-2">加载中...</div>
        </div>
      </div>
    </div>

  </div>
</div>

<!-- ============ 添加/编辑端点 Modal ============ -->
<div id="endpointModal" class="modal-overlay">
  <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
    <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
      <h3 id="epModalTitle" class="text-base font-semibold text-gray-900">添加端点</h3>
      <button onclick="closeEndpointModal()"
        class="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="px-6 py-5 space-y-4">
      <input type="hidden" id="epEditId">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          名称 <span class="text-red-500">*</span>
        </label>
        <input id="epName" type="text" placeholder="如：GPT-4o 生产端点"
          class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          Elastic API Key <span class="text-red-500">*</span>
        </label>
        <div class="relative">
          <input id="epApiKey" type="password" placeholder="你的 Elastic API Key"
            class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 pr-10">
          <button onclick="togglePasswordVisibility('epApiKey', this)"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg class="w-4 h-4 eye-closed" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97
                   9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242
                   4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0
                   0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025
                   10.025 0 01-4.132 5.411m0 0L21 21"/>
            </svg>
            <svg class="w-4 h-4 eye-open hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274
                   4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </button>
        </div>
        <p id="epApiKeyHint" class="hidden text-xs text-amber-600 mt-1">
          编辑时保留当前值则无需填写，留空或填写脱敏值将保留原 Key
        </p>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          Base URL <span class="text-red-500">*</span>
        </label>
        <input id="epBaseUrl" type="url" placeholder="https://xxxxxx.elastic.cloud"
          class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          Inference ID <span class="text-red-500">*</span>
        </label>
        <input id="epInferenceId" type="text" placeholder="my-gpt4o-endpoint"
          class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          支持的模型名称
          <span class="text-gray-400 font-normal text-xs">（用逗号分隔，留空则不自动路由）</span>
        </label>
        <input id="epModels" type="text" placeholder="gpt-4o, gpt-4o-mini, gpt-4-turbo"
          class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50">
        <p class="text-xs text-gray-400 mt-1">
          请求中的 <code class="bg-gray-100 px-1 rounded">model</code> 字段匹配这些名称时自动路由到此端点
        </p>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          默认 Max Tokens
          <span class="text-gray-400 font-normal text-xs">（请求未指定时使用，留空由模型自行决定）</span>
        </label>
        <input id="epDefaultMaxTokens" type="number" min="1" max="1000000"
          placeholder="如：8192"
          class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50">
      </div>
      <div class="flex items-center gap-2.5 pt-1">
        <input id="epEnabled" type="checkbox" checked
          class="w-4 h-4 text-blue-600 rounded accent-blue-600">
        <label class="text-sm text-gray-700">启用此端点</label>
      </div>
    </div>
    <div class="px-6 py-4 border-t border-gray-100 flex gap-2.5 justify-end">
      <button onclick="closeEndpointModal()"
        class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200
               rounded-xl transition-colors hover:bg-gray-50">
        取消
      </button>
      <button onclick="saveEndpoint()"
        class="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700
               text-white rounded-xl transition-colors">
        保存
      </button>
    </div>
  </div>
</div>

<!-- ============ 添加代理 API Key Modal ============ -->
<div id="keyModal" class="modal-overlay">
  <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
    <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
      <h3 class="text-base font-semibold text-gray-900">添加代理 API Key</h3>
      <button onclick="closeKeyModal()"
        class="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="px-6 py-5">
      <label class="block text-sm font-medium text-gray-700 mb-1.5">
        API Key <span class="text-red-500">*</span>
      </label>
      <input id="newProxyKey" type="text" placeholder="sk-proxy-..."
        class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50">
      <div class="flex items-center justify-between mt-2">
        <p class="text-xs text-gray-400">至少 8 个字符</p>
        <button onclick="generateRandomKey()"
          class="text-xs text-blue-600 hover:text-blue-700 font-medium">
          随机生成
        </button>
      </div>
    </div>
    <div class="px-6 py-4 border-t border-gray-100 flex gap-2.5 justify-end">
      <button onclick="closeKeyModal()"
        class="px-4 py-2 text-sm text-gray-600 border border-gray-200
               rounded-xl hover:bg-gray-50 transition-colors">
        取消
      </button>
      <button onclick="saveProxyKey()"
        class="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700
               text-white rounded-xl transition-colors">
        添加
      </button>
    </div>
  </div>
</div>

<!-- ============ Toast 通知 ============ -->
<div id="toast"></div>

<script>
// ─── 状态 ───
let proxyAuthEnabled = false;
// proxyKeysFull 存储原始 key（添加时暂存，用于删除时发送给服务端）
const proxyKeysFull = [];
// 用于在列表中用原始 key 匹配删除
const proxyKeysMasked = [];

// ─── Toast ───
let toastTimer = null;
function showToast(msg, type) {
  if (type === undefined) type = 'success';
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = \`show \${type}\`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = type; }, 3000);
}

// ─── 工具：XSS 转义 ───
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Tab 切换 ───
function switchTab(tab) {
  ['endpoints', 'proxyauth'].forEach(function(t) {
    document.getElementById(\`content-\${t}\`).classList.toggle('active', t === tab);
    const btn = document.getElementById(\`tab-btn-\${t}\`);
    if (t === tab) {
      btn.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
      btn.classList.remove('text-gray-600', 'hover:text-gray-800');
    } else {
      btn.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
      btn.classList.add('text-gray-600', 'hover:text-gray-800');
    }
  });
}

// ─── 登录 ───
async function login() {
  const pw = document.getElementById('passwordInput').value;
  const errEl = document.getElementById('loginError');
  try {
    const res = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (!res.ok) {
      const msg = '密码错误，请重试';
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
      document.getElementById('passwordInput').select();
      return;
    }
    errEl.classList.add('hidden');
    showMainPage();
  } catch(e) {
    errEl.textContent = '网络错误，请检查连接';
    errEl.classList.remove('hidden');
  }
}

// ─── 登出 ───
async function logout() {
  await fetch('/admin/logout', { method: 'POST' });
  document.getElementById('mainPage').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('passwordInput').value = '';
}

// ─── 显示主页 ───
function showMainPage() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('mainPage').classList.remove('hidden');
  loadAll();
}

// ─── 加载所有数据 ───
async function loadAll() {
  await Promise.all([loadEndpoints(), loadProxyKeys()]);
  // 检测存储类型（通过响应头或 URL 检测，这里用简单的标记）
  checkStorageType();
}

async function checkStorageType() {
  // 如果是本地开发环境或 vercel 环境，显示内存存储警告
  const host = window.location.hostname;
  const isVercel = host.endsWith('.vercel.app') || host.endsWith('.now.sh');
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (isVercel || isLocal) {
    // 通过健康检查接口判断
    try {
      const res = await fetch('/health');
      const data = await res.json();
      if (data.storage !== 'kv') {
        document.getElementById('storageTag').classList.remove('hidden');
      }
    } catch {}
  }
}

// ─── 端点管理 ───
async function loadEndpoints() {
  try {
    const res = await fetch('/admin/api/endpoints');
    if (!res.ok) {
      if (res.status === 401) { logout(); return; }
      return;
    }
    const endpoints = await res.json();
    renderEndpoints(endpoints);
  } catch(e) {
    document.getElementById('endpointsList').innerHTML =
      '<div class="text-sm text-red-500 py-4">加载失败，请刷新重试</div>';
  }
}

function renderEndpoints(endpoints) {
  const list = document.getElementById('endpointsList');
  if (!endpoints.length) {
    list.innerHTML = \`
      <div class="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
        <svg class="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
        <p class="text-sm text-gray-400">暂无端点配置</p>
        <p class="text-xs text-gray-400 mt-1">点击右上角「添加端点」开始配置</p>
      </div>\`;
    return;
  }
  list.innerHTML = endpoints.map(function(ep) {
    const modelTags = ep.models.length
      ? ep.models.map(function(m) {
          return \`<span class="bg-blue-50 text-blue-700 border border-blue-100 text-xs px-2 py-0.5 rounded-full font-mono">\${esc(m)}</span>\`;
        }).join('')
      : \`<span class="text-xs text-amber-500">未配置模型名</span>\`;

    return \`<div class="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors">
      <div class="flex items-start gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-2 flex-wrap">
            <span class="font-medium text-gray-800 text-sm">\${esc(ep.name)}</span>
            <span class="\${ep.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'} text-xs px-2 py-0.5 rounded-full font-medium border">
              \${ep.enabled ? '启用' : '禁用'}
            </span>
          </div>
          <div class="space-y-1 text-xs text-gray-500 mb-3">
            <div class="flex items-center gap-1.5">
              <span class="text-gray-400 shrink-0">URL</span>
              <span class="truncate font-mono text-gray-600">\${esc(ep.baseUrl)}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-gray-400 shrink-0">ID</span>
              <span class="truncate font-mono text-gray-600">\${esc(ep.inferenceId)}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-gray-400 shrink-0">Key</span>
              <span class="font-mono text-gray-600">\${esc(ep.apiKey)}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">\${modelTags}</div>
        </div>
        <div class="flex items-center gap-0.5 shrink-0">
          <button onclick="toggleEndpointEnabled('\${esc(ep.id)}', \${!ep.enabled})"
            title="\${ep.enabled ? '禁用' : '启用'}"
            class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            \${ep.enabled
              ? \`<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                     d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>\`
              : \`<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                     d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>\`
            }
          </button>
          <button onclick='editEndpoint(\${JSON.stringify(ep).replace(/\\\\/g, "\\\\\\\\").replace(/'/g, "\\\\'")})'
            title="编辑"
            class="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2
                   2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button onclick="deleteEndpoint('\${esc(ep.id)}')"
            title="删除"
            class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5
                   4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    </div>\`;
  }).join('');
}

// 打开添加端点 Modal
function openAddEndpointModal() {
  document.getElementById('epModalTitle').textContent = '添加端点';
  document.getElementById('epEditId').value = '';
  document.getElementById('epName').value = '';
  document.getElementById('epApiKey').value = '';
  document.getElementById('epApiKey').type = 'password';
  document.getElementById('epBaseUrl').value = '';
  document.getElementById('epInferenceId').value = '';
  document.getElementById('epModels').value = '';
  document.getElementById('epDefaultMaxTokens').value = '';
  document.getElementById('epEnabled').checked = true;
  document.getElementById('epApiKeyHint').classList.add('hidden');
  document.getElementById('endpointModal').classList.add('active');
  setTimeout(function() { document.getElementById('epName').focus(); }, 100);
}

// 打开编辑端点 Modal
function editEndpoint(ep) {
  document.getElementById('epModalTitle').textContent = '编辑端点';
  document.getElementById('epEditId').value = ep.id;
  document.getElementById('epName').value = ep.name;
  document.getElementById('epApiKey').value = ep.apiKey; // 脱敏值
  document.getElementById('epApiKey').type = 'text';
  document.getElementById('epBaseUrl').value = ep.baseUrl;
  document.getElementById('epInferenceId').value = ep.inferenceId;
  document.getElementById('epModels').value = ep.models.join(', ');
  document.getElementById('epDefaultMaxTokens').value = ep.defaultMaxTokens ? String(ep.defaultMaxTokens) : '';
  document.getElementById('epEnabled').checked = ep.enabled;
  document.getElementById('epApiKeyHint').classList.remove('hidden');
  document.getElementById('endpointModal').classList.add('active');
}

function closeEndpointModal() {
  document.getElementById('endpointModal').classList.remove('active');
}

async function saveEndpoint() {
  const id = document.getElementById('epEditId').value;
  const apiKey = document.getElementById('epApiKey').value.trim();
  const modelsStr = document.getElementById('epModels').value;

  const defaultMaxTokensStr = document.getElementById('epDefaultMaxTokens').value.trim();
  const defaultMaxTokens = defaultMaxTokensStr ? parseInt(defaultMaxTokensStr, 10) : undefined;

  const payload = {
    name: document.getElementById('epName').value.trim(),
    baseUrl: document.getElementById('epBaseUrl').value.trim(),
    inferenceId: document.getElementById('epInferenceId').value.trim(),
    models: modelsStr.split(',').map(function(s) { return s.trim(); }).filter(Boolean),
    ...(defaultMaxTokens && defaultMaxTokens > 0 && { defaultMaxTokens }),
    enabled: document.getElementById('epEnabled').checked,
  };

  if (!payload.name || !payload.baseUrl || !payload.inferenceId) {
    showToast('请填写名称、Base URL 和 Inference ID', 'error');
    return;
  }

  // 处理 API Key：
  // 新增时必须有值；编辑时如果是脱敏值则不传（服务端保留原值）
  if (!id) {
    if (!apiKey) { showToast('请填写 Elastic API Key', 'error'); return; }
    payload.apiKey = apiKey;
  } else {
    // 编辑时，如果用户填了新的（非脱敏）值，则更新
    if (apiKey && !apiKey.includes('****')) {
      payload.apiKey = apiKey;
    }
    // 否则不传 apiKey，服务端保留原值
  }

  const url = id ? \`/admin/api/endpoints/\${id}\` : '/admin/api/endpoints';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || '保存失败', 'error');
      return;
    }
    showToast(id ? '端点已更新' : '端点已添加');
    closeEndpointModal();
    loadEndpoints();
  } catch(e) {
    showToast('网络错误', 'error');
  }
}

async function toggleEndpointEnabled(id, enable) {
  try {
    const res = await fetch(\`/admin/api/endpoints/\${id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enable }),
    });
    if (!res.ok) { showToast('操作失败', 'error'); return; }
    showToast(enable ? '端点已启用' : '端点已禁用');
    loadEndpoints();
  } catch(e) {
    showToast('网络错误', 'error');
  }
}

async function deleteEndpoint(id) {
  if (!confirm('确定要删除此端点吗？此操作不可撤销。')) return;
  try {
    const res = await fetch(\`/admin/api/endpoints/\${id}\`, { method: 'DELETE' });
    if (!res.ok) { showToast('删除失败', 'error'); return; }
    showToast('端点已删除');
    loadEndpoints();
  } catch(e) {
    showToast('网络错误', 'error');
  }
}

// ─── 代理 API Key 管理 ───
async function loadProxyKeys() {
  try {
    const res = await fetch('/admin/api/proxy-keys');
    if (!res.ok) { if (res.status === 401) { logout(); return; } return; }
    const data = await res.json();
    proxyAuthEnabled = data.requireProxyAuth;
    // 清空并重建脱敏列表
    proxyKeysMasked.length = 0;
    data.keys.forEach(function(k) { proxyKeysMasked.push(k); });
    renderProxyAuthToggle();
    renderProxyKeys();
  } catch(e) {}
}

function renderProxyAuthToggle() {
  const btn = document.getElementById('proxyAuthToggleBtn');
  const thumb = document.getElementById('proxyAuthToggleThumb');
  if (proxyAuthEnabled) {
    btn.classList.replace('bg-gray-200', 'bg-blue-600');
    thumb.style.transform = 'translateX(1.25rem)';
  } else {
    btn.classList.replace('bg-blue-600', 'bg-gray-200');
    thumb.style.transform = 'translateX(0.25rem)';
  }
  btn.setAttribute('aria-checked', String(proxyAuthEnabled));
}

async function toggleProxyAuth() {
  const newVal = !proxyAuthEnabled;
  try {
    const res = await fetch('/admin/api/proxy-auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requireProxyAuth: newVal }),
    });
    if (!res.ok) { showToast('操作失败', 'error'); return; }
    proxyAuthEnabled = newVal;
    renderProxyAuthToggle();
    showToast(newVal ? '代理认证已启用' : '代理认证已禁用');
  } catch(e) {
    showToast('网络错误', 'error');
  }
}

function renderProxyKeys() {
  const list = document.getElementById('proxyKeysList');
  if (!proxyKeysMasked.length) {
    list.innerHTML = '<p class="text-sm text-gray-400 py-1">暂无 API Key</p>';
    return;
  }
  list.innerHTML = proxyKeysMasked.map(function(k, i) {
    return \`<div class="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <code class="text-sm font-mono text-gray-700">\${esc(k)}</code>
      <button onclick="deleteProxyKey(\${i})"
        class="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>\`;
  }).join('');
}

function openAddKeyModal() {
  document.getElementById('newProxyKey').value = '';
  document.getElementById('keyModal').classList.add('active');
  setTimeout(function() { document.getElementById('newProxyKey').focus(); }, 100);
}

function closeKeyModal() {
  document.getElementById('keyModal').classList.remove('active');
}

function generateRandomKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'sk-proxy-';
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  arr.forEach(function(b) { key += chars[b % chars.length]; });
  document.getElementById('newProxyKey').value = key;
}

async function saveProxyKey() {
  const key = document.getElementById('newProxyKey').value.trim();
  if (key.length < 8) { showToast('Key 至少需要 8 个字符', 'error'); return; }
  try {
    const res = await fetch('/admin/api/proxy-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || '添加失败', 'error');
      return;
    }
    // 保存原始 key 用于后续删除
    proxyKeysFull.push(key);
    showToast('API Key 已添加');
    closeKeyModal();
    loadProxyKeys();
  } catch(e) {
    showToast('网络错误', 'error');
  }
}

async function deleteProxyKey(idx) {
  if (!confirm('确定删除此 API Key 吗？')) return;

  // 优先使用 proxyKeysFull 中的原始值
  const rawKey = proxyKeysFull[idx];
  if (!rawKey) {
    showToast('无法删除：请在本次会话中添加 Key 后再删除，或重新登录后操作', 'error');
    return;
  }

  try {
    const res = await fetch('/admin/api/proxy-keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: rawKey }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || '删除失败', 'error');
      return;
    }
    proxyKeysFull.splice(idx, 1);
    showToast('API Key 已删除');
    loadProxyKeys();
  } catch(e) {
    showToast('网络错误', 'error');
  }
}

// ─── 密码框显示/隐藏 ───
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.querySelector('.eye-closed').classList.toggle('hidden', isPassword);
  btn.querySelector('.eye-open').classList.toggle('hidden', !isPassword);
}

// ─── Modal 点击背景关闭 ───
document.getElementById('endpointModal').addEventListener('click', function(e) {
  if (e.target === this) closeEndpointModal();
});
document.getElementById('keyModal').addEventListener('click', function(e) {
  if (e.target === this) closeKeyModal();
});

// ─── 初始化：检查登录状态 ───
(async function init() {
  try {
    const res = await fetch('/admin/api/endpoints');
    if (res.ok) {
      showMainPage();
    }
    // 401 = 未登录，显示登录页（默认已显示）
  } catch(e) {
    // 网络错误，保持登录页
  }
})();
</script>
</body>
</html>`;
}

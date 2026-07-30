/* ============================================
   打卡网站 - 主应用逻辑
   ============================================ */

// ==========================================
// 应用状态
// ==========================================
let currentUser = null;
let currentProfile = null;
let createMode = 'self';
let selectedColor = '#007aff';
let selectedFriends = [];
let uploadedMedia = [];

// ==========================================
// 初始化
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // 先初始化 Supabase
  if (window.initSupabase) {
    window.initSupabase();
  }

  // 底部导航
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      showPage(page);
    });
  });

  // 登录 tab 切换
  document.querySelectorAll('.login-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const form = tab.dataset.tab;
      document.getElementById('login-form').style.display = form === 'login' ? 'block' : 'none';
      document.getElementById('register-form').style.display = form === 'register' ? 'block' : 'none';
    });
  });

  // 登录表单
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      showToast('登录中...', 'info');
      await loginUser(username, password);
      await loadApp();
    } catch (err) {
      showToast('登录失败：' + (err.message || '密码错误'), 'error');
    }
  });

  // 注册表单
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    if (password.length < 6) { showToast('密码至少6位', 'error'); return; }
    try {
      showToast('注册中...', 'info');
      await registerUser(username, password);
      showToast('注册成功！请登录 🎉', 'success');
      document.querySelector('[data-tab="login"]').click();
      document.getElementById('login-username').value = username;
      document.getElementById('login-password').focus();
    } catch (err) {
      showToast('注册失败：' + (err.message || '用户名可能已存在'), 'error');
    }
  });

  // 颜色选择
  document.querySelectorAll('.color-option').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(o => {
        o.style.borderColor = 'transparent';
      });
      el.style.borderColor = '#007aff';
      el.style.borderWidth = '2px';
      selectedColor = el.dataset.color;
    });
  });

  // 恢复主题
  const savedTheme = localStorage.getItem('app-theme') || 'light';
  setTheme(savedTheme);
  document.getElementById('theme-select').value = savedTheme;

  // 检查是否已登录
  if (typeof window.dbClient === 'function') {
    const client = window.dbClient();
    if (client && client.auth) {
      try {
        const session = await client.auth.getSession();
        if (session.data.session) {
          await loadApp();
        }
      } catch (e) {
        console.warn('Session check failed:', e);
      }
    }
  }

  // Server酱 key 恢复
  const savedKey = localStorage.getItem('serverchan-key');
  if (savedKey) {
    document.getElementById('serverchan-key').value = savedKey;
  }
});

// ==========================================
// SPA 页面路由
// ==========================================
async function showPage(pageName, data) {
  // 隐藏所有页面
  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));

  const pageMap = {
    'calendar': 'page-calendar',
    'friends': 'page-friends',
    'chat': 'page-chat',
    'settings': 'page-settings',
    'admin': 'page-admin',
    'checkin-detail': 'page-checkin-detail',
    'login': 'page-login'
  };

  const pageId = pageMap[pageName] || 'page-calendar';
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');

  // 更新底部导航高亮
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${pageName}"]`)?.classList.add('active');

  // 页面加载逻辑
  if (pageName === 'calendar') {
    loadMonthData();
  } else if (pageName === 'friends') {
    renderFriendsPage();
  } else if (pageName === 'chat') {
    renderChatFriends();
  } else if (pageName === 'settings') {
    loadSettings();
  } else if (pageName === 'admin') {
    loadAdminPage();
  }
}

// ==========================================
// 应用加载（登录后）
// ==========================================
async function loadApp() {
  currentUser = await getCurrentUser();
  if (!currentUser) return;

  currentProfile = await getUserProfile(currentUser.id);
  showPage('calendar');
  loadMonthData();

  // Admin 入口可见
  if (currentProfile?.is_admin) {
    document.getElementById('admin-entry').style.display = 'block';
  }
}

// ==========================================
// 退出登录
// ==========================================
async function logout() {
  if (!confirm('确定退出登录？')) return;
  await logoutUser();
  currentUser = null;
  currentProfile = null;
  if (chatPolling) clearInterval(chatPolling);
  document.getElementById('page-login').classList.add('active');
  document.querySelectorAll('.page-view').forEach(p => {
    if (p.id !== 'page-login') p.classList.remove('active');
  });
}

// ==========================================
// 主题切换
// ==========================================
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('app-theme', theme);
}

// ==========================================
// 创建设置
// ==========================================
function loadSettings() {
  const savedKey = localStorage.getItem('serverchan-key');
  if (savedKey) {
    document.getElementById('serverchan-key').value = savedKey;
  }
}

// 保存 Server酱
function saveServerchanKey() {
  const key = document.getElementById('serverchan-key-guide').value.trim();
  if (key) {
    localStorage.setItem('serverchan-key', key);
    document.getElementById('serverchan-key').value = key;
    showToast('已保存 ✅', 'success');
    document.getElementById('serverchan-guide-modal').classList.remove('active');
  } else {
    showToast('请输入 SendKey', 'error');
  }
}

document.getElementById('serverchan-key').addEventListener('change', function() {
  if (this.value.trim()) {
    localStorage.setItem('serverchan-key', this.value.trim());
    showToast('已保存 ✅', 'success');
  }
});

function showServerchanGuide() {
  document.getElementById('serverchan-guide-modal').classList.add('active');
}

// ==========================================
// 创建打卡项目
// ==========================================

function showCreateModal() {
  createMode = 'self';
  selectedColor = '#007aff';
  selectedFriends = [];
  document.getElementById('create-mode-self').style.cssText = 'flex:1;background:var(--accent-blue);color:white;';
  document.getElementById('create-mode-other').style.cssText = 'flex:1;background:var(--bg-secondary);color:var(--text-tertiary);';
  document.getElementById('create-other-options').style.display = 'none';
  document.getElementById('project-name').value = '';
  document.getElementById('daily-count').value = '1';
  document.getElementById('daily-type').value = 'photo';
  document.getElementById('also-participate').checked = false;

  // 重绘颜色选择
  document.querySelectorAll('.color-option').forEach((o, i) => {
    o.style.borderColor = i === 0 ? '#007aff' : 'transparent';
  });

  document.getElementById('create-modal').classList.add('active');
  loadFriendsForCreate();
}

function closeCreateModal() {
  document.getElementById('create-modal').classList.remove('active');
}

function setCreateMode(mode) {
  createMode = mode;
  const selfBtn = document.getElementById('create-mode-self');
  const otherBtn = document.getElementById('create-mode-other');
  const otherOptions = document.getElementById('create-other-options');

  if (mode === 'self') {
    selfBtn.style.cssText = 'flex:1;background:var(--accent-blue);color:white;';
    otherBtn.style.cssText = 'flex:1;background:var(--bg-secondary);color:var(--text-tertiary);';
    otherOptions.style.display = 'none';
  } else {
    otherBtn.style.cssText = 'flex:1;background:var(--accent-blue);color:white;';
    selfBtn.style.cssText = 'flex:1;background:var(--bg-secondary);color:var(--text-tertiary);';
    otherOptions.style.display = 'block';
  }
}

async function loadFriendsForCreate() {
  const user = await getCurrentUser();
  if (!user) return;

  try {
    const friends = await getFriends(user.id);
    const container = document.getElementById('create-friend-select');
    container.innerHTML = '';

    if (friends.length === 0) {
      container.innerHTML = '<div style="color:var(--text-tertiary);font-size:13px;padding:12px;">暂无好友，先去添加好友吧</div>';
      return;
    }

    friends.forEach(f => {
      const item = document.createElement('div');
      item.className = 'select-item';
      const cb = document.createElement('div');
      cb.className = 'checkbox';
      cb.dataset.friendId = f.friendId;
      cb.dataset.username = f.username;
      cb.onclick = () => {
        cb.classList.toggle('checked');
      };
      item.appendChild(cb);
      const name = document.createElement('span');
      name.style.fontSize = '14px';
      name.textContent = f.username;
      item.appendChild(name);
      container.appendChild(item);
    });
  } catch (e) {
    document.getElementById('create-friend-select').innerHTML = '<div style="color:var(--text-tertiary);">加载好友失败</div>';
  }
}

async function createProject() {
  const user = await getCurrentUser();
  if (!user) return;

  const name = document.getElementById('project-name').value.trim();
  if (!name) { showToast('请输入项目名称', 'error'); return; }

  const dailyCount = parseInt(document.getElementById('daily-count').value) || 1;
  const dailyType = document.getElementById('daily-type').value;

  let members = [user.id];
  let creatorParticipates = true;

  if (createMode === 'other') {
    const checkedBoxes = document.querySelectorAll('#create-friend-select .checkbox.checked');
    if (checkedBoxes.length === 0) { showToast('请选择好友', 'error'); return; }
    members = Array.from(checkedBoxes).map(cb => cb.dataset.friendId);
    creatorParticipates = document.getElementById('also-participate').checked;
  }

  try {
    await createProject(name, selectedColor, user.id, dailyCount, dailyType, members, creatorParticipates);
    showToast('项目创建成功 🎉', 'success');
    closeCreateModal();
    loadMonthData();
  } catch (e) {
    showToast('创建失败：' + e.message, 'error');
  }
}

// ==========================================
// 今日打卡上传
// ==========================================

async function showCheckinModal() {
  const user = await getCurrentUser();
  if (!user) return;

  const projects = await getMyProjects(user.id);
  const select = document.getElementById('checkin-project-select');
  select.innerHTML = '';

  if (projects.length === 0) {
    select.innerHTML = '<option>请先创建打卡项目</option>';
    showToast('请先创建打卡项目', 'info');
    return;
  }

  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name}（每日${p.daily_count}${['张照片','段视频','条语音','条文字','签到'][['photo','video','audio','text','none'].indexOf(p.daily_type)]}）`;
    select.appendChild(opt);
  });

  uploadedMedia = [];
  document.getElementById('checkin-text').value = '';
  document.getElementById('checkin-modal-title').textContent = '📸 今日打卡 - ' + new Date().toLocaleDateString('zh-CN');
  document.getElementById('checkin-modal').classList.add('active');
}

function closeCheckinModal() {
  document.getElementById('checkin-modal').classList.remove('active');
}

function uploadCheckinMedia(type) {
  const input = document.getElementById('file-input');
  const extensions = {
    photo: 'image/*',
    video: 'video/*',
    audio: 'audio/*'
  };
  input.accept = extensions[type] || 'image/*';
  input.dataset.uploadType = type;
  input.click();
}

async function handleFileSelect(event) {
  const files = event.target.files;
  if (!files.length) return;

  const type = event.target.dataset.uploadType || 'photo';
  const grid = document.getElementById('checkin-media-grid');

  for (const file of files) {
    // 预览
    const preview = document.createElement('div');
    preview.className = 'upload-item preview';
    const reader = new FileReader();
    reader.onload = (e) => {
      if (type === 'photo') {
        const img = document.createElement('img');
        img.src = e.target.result;
        preview.appendChild(img);
      } else {
        preview.textContent = type === 'video' ? '🎬' : '🎤';
      }
    };
    reader.readAsDataURL(file);

    const removeBtn = document.createElement('div');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.onclick = () => preview.remove();
    preview.appendChild(removeBtn);

    // 插在最后的上传按钮前
    grid.insertBefore(preview, grid.lastElementChild);

    uploadedMedia.push({ file, type });
  }

  event.target.value = '';
}

async function submitCheckin() {
  const user = await getCurrentUser();
  if (!user) return;

  const projectId = document.getElementById('checkin-project-select').value;
  const text = document.getElementById('checkin-text').value.trim();

  showToast('上传中...', 'info');

  try {
    // 上传文件到 Supabase Storage
    const mediaUrls = [];
    for (const item of uploadedMedia) {
      const bucket = item.type === 'audio' ? 'checkin-audio' : 'checkin-media';
      const folder = `${projectId}/${user.id}`;
      const url = await uploadFile(bucket, folder, item.file);
      mediaUrls.push(url);
    }

    await submitCheckinData(projectId, user.id, text, mediaUrls);
    showToast('打卡成功 🔥', 'success');
    closeCheckinModal();
    loadMonthData();
  } catch (e) {
    showToast('提交失败：' + e.message, 'error');
  }
}

// ==========================================
// Admin 后台
// ==========================================

function showAdminPage() {
  showPage('admin');
  loadAdminPage();
}

async function loadAdminPage() {
  try {
    const users = await getAllUsers();

    // 统计
    const today = new Date().toISOString().split('T')[0];
    let todayCheckins = 0;
    let todayAbsent = 0;
    const activeProjects = new Set();

    for (const u of users) {
      const checkins = await getUserCheckinsForMonth(u.id, currentYear, currentMonth);
      const todayOnes = checkins.filter(c => c.checkin_date === today);
      if (todayOnes.length > 0) {
        todayCheckins++;
      } else {
        todayAbsent++;
      }
      checkins.forEach(c => activeProjects.add(c.project_id));
    }

    document.getElementById('admin-stats').innerHTML = `
      <div class="admin-stat-card">
        <div class="stat-label">总用户数</div>
        <div class="stat-number">${users.length}</div>
      </div>
      <div class="admin-stat-card">
        <div class="stat-label">今日打卡</div>
        <div class="stat-number" style="color:var(--accent-green);">${todayCheckins}</div>
      </div>
      <div class="admin-stat-card">
        <div class="stat-label">活跃项目</div>
        <div class="stat-number">${activeProjects.size}</div>
      </div>
      <div class="admin-stat-card">
        <div class="stat-label">今日缺勤</div>
        <div class="stat-number" style="color:var(--accent-red);">${todayAbsent}</div>
      </div>
    `;

    renderAdminUserList(users);
  } catch (e) {
    document.getElementById('admin-stats').innerHTML = '<div style="padding:20px;color:var(--text-tertiary);">加载失败</div>';
  }
}

function renderAdminUserList(users) {
  const container = document.getElementById('admin-user-list');
  container.innerHTML = '';

  users.forEach(u => {
    const row = document.createElement('div');
    row.className = 'user-row';
    row.dataset.username = u.username;

    const today = new Date().toISOString().split('T')[0];
    // 简化显示
    row.innerHTML = `
      <span class="username">${u.username}</span>
      <span style="color:var(--text-secondary);font-size:12px;">${u.is_admin ? '👑 管理员' : ''}</span>
      <span style="font-size:12px;">-</span>
      <span style="font-size:12px;">-</span>
      <button class="btn" style="padding:3px 8px;font-size:11px;background:var(--bg-warning);color:var(--accent-orange);border:0.5px solid var(--border-color);" onclick="resetAdminPassword('${u.id}','${u.username}')">重置密码</button>
    `;

    // 点击查看详情
    row.querySelector('.username').onclick = () => openAdminDetail(u);

    container.appendChild(row);
  });
}

function filterAdminUsers(query) {
  const rows = document.querySelectorAll('.user-row');
  rows.forEach(row => {
    const name = row.dataset.username || '';
    row.style.display = name.includes(query) ? 'grid' : 'none';
  });
}

async function openAdminDetail(user) {
  document.getElementById('admin-detail-title').textContent = `${user.username} 的打卡`;
  const container = document.getElementById('admin-detail-content');
  container.innerHTML = '<div class="loading-spinner"></div>';

  document.getElementById('admin-detail-panel').classList.add('active');

  try {
    const projects = await getMyProjects(user.id);
    const today = new Date().toISOString().split('T')[0];
    let html = '';

    for (const p of projects) {
      const checkins = await getCheckinsForDate(p.id, today);
      const memberCount = (await getProjectMembers(p.id)).length;
      html += `
        <div class="card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span class="project-dot" style="background:${p.color};width:12px;height:12px;border-radius:4px;"></span>
            <span style="font-size:15px;font-weight:500;">${p.name}</span>
            <span style="font-size:11px;color:var(--text-tertiary);margin-left:auto;">${memberCount}人 · 每日${p.daily_count}${['张照片','段视频','条语音','条文字','签到'][['photo','video','audio','text','none'].indexOf(p.daily_type)]}</span>
          </div>
          <div style="display:flex;gap:4px;overflow-x:auto;">
      `;

      // 最近7天缩略
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const dayCheckins = checkins.filter(c => c.checkin_date === ds) || [];
        const hasData = getThumbnailsForDate(ds).filter(t => t.project_id === p.id).length > 0;
        html += `
          <div style="text-align:center;min-width:40px;">
            <div style="font-size:10px;color:var(--text-tertiary);">${d.getDate()}</div>
            <div style="width:32px;height:32px;border-radius:6px;background:${hasData ? p.color : 'var(--bg-tertiary)'};opacity:${hasData ? 0.8 : 0.3};display:flex;align-items:center;justify-content:center;font-size:10px;color:white;"></div>
          </div>
        `;
      }

      html += '</div>';
      html += '</div>';
    }

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div style="padding:20px;color:var(--text-tertiary);">加载失败</div>';
  }
}

function closeAdminDetail() {
  document.getElementById('admin-detail-panel').classList.remove('active');
}

async function resetAdminPassword(userId, username) {
  const newPwd = prompt(`输入 ${username} 的新密码（至少6位）：`);
  if (!newPwd || newPwd.length < 6) { showToast('密码至少6位', 'error'); return; }
  try {
    await resetUserPassword(userId, newPwd);

    // 实际项目中需要用 Supabase Admin API 来重置密码
    // 简化方案：存储到 profiles.temp_password
    showToast(`${username} 的密码已重置为: ${newPwd}`, 'success');
  } catch (e) {
    showToast('重置失败', 'error');
  }
}

// ==========================================
// Toast 提示
// ==========================================
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 3000);
}

// 暴露全局函数
window.showPage = showPage;
window.showCreateModal = showCreateModal;
window.closeCreateModal = closeCreateModal;
window.setCreateMode = setCreateMode;
window.createProject = createProject;
window.showCheckinModal = showCheckinModal;
window.closeCheckinModal = closeCheckinModal;
window.uploadCheckinMedia = uploadCheckinMedia;
window.handleFileSelect = handleFileSelect;
window.submitCheckin = submitCheckin;
window.navigateMonth = navigateMonth;
window.openCheckinDetail = openCheckinDetail;
window.submitComment = submitComment;
window.closeDetail = closeDetail;
window.logout = logout;
window.setTheme = setTheme;
window.showAddFriendModal = showAddFriendModal;
window.closeAddFriendModal = closeAddFriendModal;
window.sendFriendRequest = sendFriendRequest;
window.acceptReq = acceptReq;
window.sendChatMessage = sendChatMessage;
window.sendChatPhoto = sendChatPhoto;
window.recordVoiceChat = recordVoiceChat;
window.showAdminPage = showAdminPage;
window.openAdminDetail = openAdminDetail;
window.closeAdminDetail = closeAdminDetail;
window.resetAdminPassword = resetAdminPassword;
window.showServerchanGuide = showServerchanGuide;
window.saveServerchanKey = saveServerchanKey;
window.filterAdminUsers = filterAdminUsers;

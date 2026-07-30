/* ============================================
   好友 & 聊天逻辑
   ============================================ */

let currentChatFriend = null;
let chatPolling = null;
const STORAGE_KEY_MSG_CLEAN = 'msg_cleanup_date';

// 渲染好友列表（聊天页左侧）
async function renderChatFriends() {
  const user = await getCurrentUser();
  if (!user) return;

  const friends = await getFriends(user.id);
  const container = document.getElementById('chat-friend-list');
  container.innerHTML = '';

  if (friends.length === 0) {
    container.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:var(--text-tertiary);">暂无好友</div>';
    return;
  }

  friends.forEach(f => {
    const item = document.createElement('div');
    item.className = 'friend-item';
    if (currentChatFriend === f.friendId) item.classList.add('active');

    const avatar = document.createElement('div');
    avatar.className = 'avatar avatar-sm';
    const colors = ['#007aff','#ff9500','#34c759','#af52de','#ff3b30','#5ac8fa','#5856d6'];
    avatar.style.background = colors[f.friendId.charCodeAt(0) % colors.length];
    avatar.textContent = (f.username || '?')[0];
    item.appendChild(avatar);

    const name = document.createElement('div');
    name.className = 'friend-name';
    name.textContent = f.username;
    item.appendChild(name);

    item.onclick = () => openChat(f.friendId, f.username);
    container.appendChild(item);
  });
}

// 打开聊天
function openChat(friendId, username) {
  currentChatFriend = friendId;
  document.getElementById('chat-with-name').textContent = `💬 ${username}`;
  document.getElementById('chat-input-area').style.display = 'flex';
  document.getElementById('messages-area').innerHTML = '<div class="loading-spinner"></div>';

  // 清理旧消息
  cleanupOldMessages();

  renderChatFriends();
  loadMessages(friendId);

  // 开始轮询新消息
  if (chatPolling) clearInterval(chatPolling);
  chatPolling = setInterval(() => loadMessages(friendId, true), 3000);
}

// 加载消息
async function loadMessages(otherUserId, isPolling = false) {
  const user = await getCurrentUser();
  if (!user || !otherUserId) return;

  try {
    const messages = await getMessages(user.id, otherUserId);
    if (!isPolling) {
      renderMessages(messages, user.id);
    } else {
      // 轮询时只更新新消息
      const container = document.getElementById('messages-area');
      const existingCount = container.querySelectorAll('.msg-bubble').length;
      if (messages.length > existingCount) {
        renderMessages(messages, user.id);
      }
    }
  } catch (e) {
    if (!isPolling) {
      document.getElementById('messages-area').innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-tertiary);">加载失败</div>';
    }
  }
}

// 渲染消息列表
function renderMessages(messages, userId) {
  const container = document.getElementById('messages-area');
  container.innerHTML = '';

  if (messages.length === 0) {
    container.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary);">开始你们的第一次对话吧</div>';
    return;
  }

  const currentDate = new Date().toDateString();
  let lastDate = '';

  messages.forEach(msg => {
    const msgDate = new Date(msg.created_at).toDateString();

    // 日期分隔
    if (msgDate !== lastDate) {
      const dateDiv = document.createElement('div');
      dateDiv.style.cssText = 'text-align:center;font-size:11px;color:var(--text-tertiary);padding:8px 0;';
      if (msgDate === currentDate) {
        dateDiv.textContent = '今天';
      } else {
        const d = new Date(msg.created_at);
        dateDiv.textContent = `${d.getMonth()+1}月${d.getDate()}日`;
      }
      container.appendChild(dateDiv);
      lastDate = msgDate;
    }

    const bubble = document.createElement('div');
    const isMe = msg.from_user_id === userId;
    bubble.className = `msg-bubble ${isMe ? 'outgoing' : 'incoming'}`;

    if (msg.type === 'text') {
      bubble.textContent = msg.content;
    } else if (msg.type === 'photo') {
      bubble.innerHTML = `<img class="msg-image" src="${msg.content}" alt="照片" loading="lazy">`;
    } else if (msg.type === 'audio') {
      bubble.innerHTML = `<div class="msg-audio"><span>🎤</span><span style="font-size:12px;">语音消息</span></div>`;
      bubble.onclick = () => { const a = new Audio(msg.content); a.play(); };
      bubble.style.cursor = 'pointer';
    }

    container.appendChild(bubble);

    // 时间
    const time = document.createElement('div');
    time.className = 'msg-time';
    time.style.textAlign = isMe ? 'right' : 'left';
    const d = new Date(msg.created_at);
    time.textContent = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    container.appendChild(time);
  });

  // 滚动到底部
  container.scrollTop = container.scrollHeight;
}

// 发送聊天消息
async function sendChatMessage() {
  const user = await getCurrentUser();
  if (!user || !currentChatFriend) return;

  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  try {
    await sendMessage(user.id, currentChatFriend, 'text', text);
    input.value = '';
    await loadMessages(currentChatFriend);
  } catch (e) {
    showToast('发送失败', 'error');
  }
}

// 发送聊天照片
async function sendChatPhoto() {
  const user = await getCurrentUser();
  if (!user || !currentChatFriend) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const url = await uploadFile('chat-photos', user.id, file);
      await sendMessage(user.id, currentChatFriend, 'photo', url);
      await loadMessages(currentChatFriend);
    } catch (err) {
      showToast('照片发送失败', 'error');
    }
  };
  input.click();
}

// 发送聊天语音
async function recordVoiceChat() {
  showToast('🎤 语音功能即将支持', 'info');
}

// 清理3个月前的消息
function cleanupOldMessages() {
  const lastClean = localStorage.getItem(STORAGE_KEY_MSG_CLEAN);
  const now = Date.now();
  if (lastClean && now - parseInt(lastClean) < 86400000) return; // 每天只清理一次

  // 标记清理时间
  localStorage.setItem(STORAGE_KEY_MSG_CLEAN, String(now));
}

// ==========================================
// 好友列表页面
// ==========================================

async function renderFriendsPage() {
  const user = await getCurrentUser();
  if (!user) return;

  const container = document.getElementById('friends-list-inner');
  container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const friends = await getFriends(user.id);
    const requests = await getFriendRequests(user.id);

    container.innerHTML = '';

    // 好友申请
    if (requests.length > 0) {
      const reqSection = document.createElement('div');
      reqSection.innerHTML = '<div style="font-size:13px;font-weight:600;color:var(--text-secondary);padding:8px 16px 4px;">好友申请</div>';
      requests.forEach(req => {
        const item = document.createElement('div');
        item.className = 'list-item';
        const username = req.profiles?.username || '未知用户';
        item.innerHTML = `
          <div class="avatar avatar-sm" style="background:#ff9500;">${username[0]}</div>
          <span style="flex:1;font-size:14px;">${username}</span>
          <button class="btn btn-success" style="padding:4px 12px;font-size:12px;" onclick="acceptReq('${req.id}')">同意</button>
        `;
        reqSection.appendChild(item);
      });
      container.appendChild(reqSection);
    }

    // 好友列表
    if (friends.length > 0) {
      const friendSection = document.createElement('div');
      friendSection.innerHTML = '<div style="font-size:13px;font-weight:600;color:var(--text-secondary);padding:8px 16px 4px;">我的好友</div>';
      friends.forEach(f => {
        const item = document.createElement('div');
        item.className = 'list-item';
        const colors = ['#007aff','#ff9500','#34c759','#af52de','#ff3b30'];
        const color = colors[f.friendId.charCodeAt(0) % colors.length];
        item.innerHTML = `
          <div class="avatar avatar-sm" style="background:${color};">${(f.username||'?')[0]}</div>
          <span style="flex:1;font-size:14px;">${f.username}</span>
          <span style="color:var(--text-tertiary);font-size:12px;">💬 发消息</span>
        `;
        item.onclick = () => {
          currentChatFriend = f.friendId;
          document.getElementById('chat-with-name').textContent = `💬 ${f.username}`;
          document.getElementById('chat-input-area').style.display = 'flex';
          showPage('chat');
          // 切换到聊天页并选中该好友
          setTimeout(() => {
            const friendItems = document.querySelectorAll('.friend-item');
            friendItems.forEach(fi => fi.classList.remove('active'));
            const target = Array.from(friendItems).find(fi => fi.textContent.trim() === f.username);
            if (target) target.classList.add('active');
            loadMessages(f.friendId);
            if (chatPolling) clearInterval(chatPolling);
            chatPolling = setInterval(() => loadMessages(f.friendId, true), 3000);
          }, 300);
        };
        friendSection.appendChild(item);
      });
      container.appendChild(friendSection);
    } else if (requests.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div>暂无好友</div><div style="font-size:12px;">点击右上角添加你的小伙伴</div></div>';
    }
  } catch (e) {
    container.innerHTML = '<div class="empty-state">加载失败</div>';
  }
}

// 接受好友申请
async function acceptReq(requestId) {
  try {
    await acceptFriendRequest(requestId);
    showToast('好友添加成功 🎉', 'success');
    renderFriendsPage();
    renderChatFriends();
  } catch (e) {
    showToast('操作失败', 'error');
  }
}

// 显示添加好友弹窗
function showAddFriendModal() {
  document.getElementById('friend-username').value = '';
  document.getElementById('add-friend-modal').classList.add('active');
}

function closeAddFriendModal() {
  document.getElementById('add-friend-modal').classList.remove('active');
}

// 发送好友申请
async function sendFriendRequest() {
  const user = await getCurrentUser();
  if (!user) return;

  const username = document.getElementById('friend-username').value.trim();
  if (!username) { showToast('请输入用户名', 'error'); return; }

  try {
    await sendFriendRequest(user.id, username);
    showToast('申请已发送 ✅', 'success');
    closeAddFriendModal();
  } catch (e) {
    showToast(e.message || '发送失败', 'error');
  }
}

// 停止聊天轮询
window.addEventListener('beforeunload', () => {
  if (chatPolling) clearInterval(chatPolling);
});

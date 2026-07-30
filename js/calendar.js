/* ============================================
   打卡日历 - 渲染逻辑
   ============================================ */

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let currentViewProject = null; // 当前查看的项目
let calendarCheckins = {}; // { 'YYYY-MM-DD': [...checkins] }

// 初始化日历
async function initCalendar(year, month) {
  currentYear = year;
  currentMonth = month;
  await renderCalendar();
  await renderProjectTags();
  await updateFireStreak();
}

// 渲染日历
async function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  document.getElementById('calendar-month').textContent = `${currentYear}年${currentMonth}月`;

  const firstDay = new Date(currentYear, currentMonth - 1, 1);
  const lastDay = new Date(currentYear, currentMonth, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay() || 7; // 1=周一 ... 7=周日
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // 上个月剩余
  const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();
  for (let i = startWeekday - 1; i > 0; i--) {
    grid.appendChild(createDayCell(prevMonthLastDay - i + 1, true));
  }

  // 本月
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell = createDayCell(d, false);
    cell.dataset.date = dateStr;

    // 标记今天
    if (dateStr === todayStr) {
      cell.classList.add('today');
    }

    // 获取该日期的打卡缩略图
    const thumbnails = getThumbnailsForDate(dateStr);
    if (thumbnails.length > 0) {
      cell.classList.add('has-checkin');
      const thumbContainer = document.createElement('div');
      thumbContainer.className = 'day-thumbnails';
      const maxShow = 3;
      const show = thumbnails.slice(0, maxShow);
      show.forEach(t => {
        const thumb = document.createElement('div');
        thumb.className = 'day-thumb';
        if (t.type === 'photo' && t.url) {
          thumb.style.backgroundImage = `url(${t.url})`;
        } else {
          const icons = { video: '🎬', audio: '🎤', text: '📝' };
          thumb.textContent = icons[t.type] || '📝';
          thumb.style.fontSize = '8px';
          thumb.style.background = 'var(--bg-tertiary)';
          thumb.style.display = 'flex';
          thumb.style.alignItems = 'center';
          thumb.style.justifyContent = 'center';
        }
        thumbContainer.appendChild(thumb);
      });
      if (thumbnails.length > maxShow) {
        const more = document.createElement('div');
        more.className = 'day-thumb more';
        more.textContent = `+${thumbnails.length - maxShow}`;
        thumbContainer.appendChild(more);
      }
      cell.appendChild(thumbContainer);

      // 点击查看详情
      cell.onclick = () => openCheckinDetail(dateStr);
    } else {
      // 没有打卡点击上传
      cell.onclick = () => {
        if (dateStr === todayStr) {
          showCheckinModal();
        }
      };
    }

    grid.appendChild(cell);
  }

  // 下个月开始
  const totalCells = startWeekday - 1 + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    grid.appendChild(createDayCell(d, true));
  }
}

function createDayCell(day, otherMonth) {
  const div = document.createElement('div');
  div.className = 'cal-day';
  if (otherMonth) div.classList.add('other-month');
  const num = document.createElement('div');
  num.className = 'day-number';
  num.textContent = day;
  div.appendChild(num);
  return div;
}

// 获取指定日期的缩略图
function getThumbnailsForDate(dateStr) {
  const result = [];
  const dayData = calendarCheckins[dateStr];
  if (!dayData) return result;

  dayData.forEach(checkin => {
    // 只有选中的项目或所有项目（如果没选择）
    if (currentViewProject && checkin.project_id !== currentViewProject) return;

    if (checkin.media_urls && checkin.media_urls.length > 0) {
      checkin.media_urls.forEach(url => {
        const type = url.match(/\.(mp4|mov|webm)$/i) ? 'video' :
                     url.match(/\.(mp3|wav|ogg|m4a)$/i) ? 'audio' : 'photo';
        result.push({ type, url });
      });
    }
    if (checkin.text) {
      result.push({ type: 'text', url: null });
    }
  });

  return result;
}

// 渲染项目颜色标签
async function renderProjectTags() {
  const user = await getCurrentUser();
  if (!user) return;

  const projects = await getMyProjects(user.id);
  const container = document.getElementById('project-tags');
  container.innerHTML = '';

  if (projects.length === 0) {
    container.innerHTML = '<div style="padding:4px 16px;font-size:12px;color:var(--text-tertiary);">暂无项目，点击 + 创建</div>';
    return;
  }

  // "全部" 标签
  const allTag = document.createElement('div');
  allTag.className = 'project-tag';
  if (!currentViewProject) allTag.style.fontWeight = '600';
  allTag.innerHTML = `<span>📋 全部</span>`;
  allTag.onclick = () => { currentViewProject = null; renderCalendar(); renderProjectTags(); };
  container.appendChild(allTag);

  projects.forEach(p => {
    const tag = document.createElement('div');
    tag.className = 'project-tag';
    if (currentViewProject === p.id) tag.style.fontWeight = '600';
    tag.innerHTML = `<span class="project-dot" style="background:${p.color}"></span><span>${p.name}</span>`;
    tag.onclick = () => { currentViewProject = p.id; renderCalendar(); renderProjectTags(); };
    container.appendChild(tag);
  });
}

// 更新火苗
async function updateFireStreak() {
  const user = await getCurrentUser();
  if (!user) return;

  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const checkins = await getUserCheckinsForMonth(user.id, year, month);
  const dates = checkins.map(c => c.checkin_date);
  const streak = calcStreak(dates, new Date().toISOString().split('T')[0]);

  const badge = document.getElementById('fire-streak');
  badge.textContent = `🔥 ${streak}天`;
}

// 月份导航
function navigateMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 12) { currentMonth = 1; currentYear++; }
  if (currentMonth < 1) { currentMonth = 12; currentYear--; }
  loadMonthData();
}

async function loadMonthData() {
  const user = await getCurrentUser();
  if (!user) return;

  const projects = await getMyProjects(user.id);

  // 收集所有项目当月的打卡数据
  calendarCheckins = {};
  for (const p of projects) {
    const checkins = await getCheckinsForMonth(p.id, currentYear, currentMonth);
    checkins.forEach(c => {
      if (!calendarCheckins[c.checkin_date]) calendarCheckins[c.checkin_date] = [];
      calendarCheckins[c.checkin_date].push({ ...c, project_id: p.id, project_name: p.name, project_color: p.color });
    });
  }

  await renderCalendar();
  await renderProjectTags();
  await updateFireStreak();
}

// 打开打卡详情
async function openCheckinDetail(dateStr) {
  const user = await getCurrentUser();
  if (!user) return;

  const parts = dateStr.split('-');
  const title = `${parseInt(parts[1])}月${parseInt(parts[2])}日`;
  document.getElementById('detail-date-title').textContent = title;

  // 获取该日期所有打卡
  const dayData = calendarCheckins[dateStr] || [];
  const mediaContainer = document.getElementById('detail-media');
  const textContainer = document.getElementById('detail-text');
  const commentsContainer = document.getElementById('detail-comments');

  mediaContainer.innerHTML = '';
  textContainer.innerHTML = '';
  commentsContainer.innerHTML = '';
  document.getElementById('detail-project-name').textContent = '';

  if (dayData.length === 0) {
    mediaContainer.innerHTML = '<div style="color:var(--text-tertiary);font-size:13px;text-align:center;padding:20px;">暂无打卡记录</div>';
  } else {
    dayData.forEach(async (checkin) => {
      // 项目名
      document.getElementById('detail-project-name').textContent = checkin.project_name || '';

      // 多媒体
      if (checkin.media_urls && checkin.media_urls.length > 0) {
        checkin.media_urls.forEach(url => {
          const item = document.createElement('div');
          item.className = 'checkin-media-item';
          if (url.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i)) {
            const img = document.createElement('img');
            img.src = url;
            img.loading = 'lazy';
            item.appendChild(img);
          } else if (url.match(/\.(mp4|mov|webm)$/i)) {
            item.innerHTML = '🎬 <span style="margin-left:4px;">视频</span>';
            item.onclick = () => window.open(url);
          } else if (url.match(/\.(mp3|wav|ogg|m4a)$/i)) {
            item.innerHTML = '🎤 <span style="margin-left:4px;">语音</span>';
            item.onclick = () => {
              const audio = new Audio(url);
              audio.play();
            };
          }
          mediaContainer.appendChild(item);
        });
      }

      // 文字
      if (checkin.text) {
        textContainer.textContent = checkin.text;
      }

      // 评论
      const comments = await getComments(checkin.id);
      if (comments.length > 0) {
        comments.forEach(cmt => {
          const div = document.createElement('div');
          div.className = 'comment-item';
          const avatar = document.createElement('div');
          avatar.className = 'avatar';
          avatar.style.width = '28px';
          avatar.style.height = '28px';
          avatar.style.fontSize = '12px';
          avatar.style.background = '#007aff';
          avatar.textContent = (cmt.profiles?.username || '?')[0];
          div.appendChild(avatar);
          const body = document.createElement('div');
          body.className = 'comment-body';
          body.innerHTML = `<div class="username">${cmt.profiles?.username || '用户'}</div><div class="text">${cmt.text}</div>`;
          div.appendChild(body);
          commentsContainer.appendChild(div);
        });
      }

      // 存当前checkin id供评论使用
      commentsContainer.dataset.checkinId = checkin.id;
    });
  }

  showPage('checkin-detail');
}

// 提交评论
async function submitComment() {
  const user = await getCurrentUser();
  if (!user) return;

  const checkinId = document.getElementById('detail-comments').dataset.checkinId;
  const input = document.getElementById('comment-input');
  const text = input.value.trim();
  if (!text || !checkinId) return;

  await addComment(checkinId, user.id, text);
  input.value = '';

  // 刷新评论
  const comments = await getComments(checkinId);
  const container = document.getElementById('detail-comments');
  container.innerHTML = '';
  comments.forEach(cmt => {
    const div = document.createElement('div');
    div.className = 'comment-item';
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.style.width = '28px';
    avatar.style.height = '28px';
    avatar.style.fontSize = '12px';
    avatar.style.background = '#007aff';
    avatar.textContent = (cmt.profiles?.username || '?')[0];
    div.appendChild(avatar);
    const body = document.createElement('div');
    body.className = 'comment-body';
    body.innerHTML = `<div class="username">${cmt.profiles?.username || '用户'}</div><div class="text">${cmt.text}</div>`;
    div.appendChild(body);
    container.appendChild(div);
  });

  showToast('评论已发送', 'success');
}

function closeDetail() {
  showPage('calendar');
  loadMonthData();
}

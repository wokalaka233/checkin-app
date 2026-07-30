/* ============================================
   鎵撳崱缃戠珯 - API 灞?   Supabase SDK 閫氳繃 Vercel 浠ｇ悊璁块棶
   ============================================ */

const SUPA_URL = '/api';
const SUPA_KEY = 'sb_publishable_xi-u5divr9AoQHLL_G9eaw_4dWotEY9';

const client = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

// ==========================================
// 璁よ瘉
// ==========================================

async function registerUser(username, password) {
  const { data, error } = await client.auth.signUp({
    email: `${username}@local.habit.app`,
    password: password,
    options: { data: { username, is_admin: false } }
  });
  if (error) throw error;
  return data;
}

async function loginUser(username, password) {
  const { data, error } = await client.auth.signInWithPassword({
    email: `${username}@local.habit.app`,
    password: password
  });
  if (error) throw error;
  return data;
}

async function getCurrentUser() {
  const { data: { user } } = await client.auth.getUser();
  return user;
}

async function getUserProfile(userId) {
  const { data, error } = await client
    .from('profiles').select('*').eq('id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function logoutUser() {
  await client.auth.signOut();
}

// ==========================================
// 椤圭洰
// ==========================================

async function getMyProjects(userId) {
  const { data, error } = await client
    .from('project_members')
    .select('project_id, projects(*)')
    .eq('user_id', userId);
  if (error) throw error;
  return data.map(d => d.projects).filter(Boolean);
}

async function createProject(name, color, creatorId, dailyCount, dailyType, members, creatorParticipates) {
  const { data: project, error } = await client
    .from('projects')
    .insert({ name, color, created_by: creatorId, daily_count: dailyCount, daily_type: dailyType })
    .select().single();
  if (error) throw error;

  const inserts = members.map(uid => ({ project_id: project.id, user_id: uid }));
  if (creatorParticipates) inserts.push({ project_id: project.id, user_id: creatorId });
  const { error: memErr } = await client.from('project_members').insert(inserts);
  if (memErr) throw memErr;

  return project;
}

async function getProjectMembers(projectId) {
  const { data } = await client.from('project_members')
    .select('user_id, profiles(username)').eq('project_id', projectId);
  return data || [];
}

async function removeProjectMember(projectId, userId) {
  await client.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);
}

async function updateProjectDaily(projectId, dailyCount, dailyType) {
  await client.from('projects').update({ daily_count: dailyCount, daily_type: dailyType }).eq('id', projectId);
}

// ==========================================
// 鎵撳崱
// ==========================================

async function submitCheckinData(projectId, userId, text, mediaUrls) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await client
    .from('checkins')
    .insert({ project_id: projectId, user_id: userId, checkin_date: today, text, media_urls: mediaUrls || [] })
    .select().single();
  if (error) throw error;
  return data;
}

async function getCheckinsForDate(projectId, date) {
  const { data, error } = await client
    .from('checkins').select('*, profiles(username)')
    .eq('project_id', projectId).eq('checkin_date', date);
  if (error) throw error;
  return data || [];
}

async function getCheckinsForMonth(projectId, year, month) {
  const start = `${year}-${String(month).padStart(2,'0')}-01`;
  const end = `${year}-${String(month).padStart(2,'0')}-31`;
  const { data, error } = await client
    .from('checkins').select('*')
    .eq('project_id', projectId).gte('checkin_date', start).lte('checkin_date', end);
  if (error) throw error;
  return data || [];
}

async function getUserCheckinsForMonth(userId, year, month) {
  const start = `${year}-${String(month).padStart(2,'0')}-01`;
  const end = `${year}-${String(month).padStart(2,'0')}-31`;
  const { data, error } = await client
    .from('checkins').select('*, projects(name, color)')
    .eq('user_id', userId).gte('checkin_date', start).lte('checkin_date', end);
  if (error) throw error;
  return data || [];
}

// ==========================================
// 璇勮
// ==========================================

async function addComment(checkinId, userId, text) {
  const { data, error } = await client
    .from('comments').insert({ checkin_id: checkinId, user_id: userId, text })
    .select('*, profiles(username)').single();
  if (error) throw error;
  return data;
}

async function getComments(checkinId) {
  const { data, error } = await client
    .from('comments').select('*, profiles(username)')
    .eq('checkin_id', checkinId).order('created_at');
  if (error) throw error;
  return data || [];
}

// ==========================================
// 濂藉弸
// ==========================================

async function sendFriendRequest(fromUserId, toUsername) {
  const { data: target } = await client.from('profiles').select('id').eq('username', toUsername).single();
  if (!target) throw new Error('鐢ㄦ埛涓嶅瓨鍦?);

  const { data: existing } = await client.from('friends').select('*')
    .or(`and(user_id.eq.${fromUserId},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${fromUserId})`).single();
  if (existing) throw new Error('宸茬粡鏄ソ鍙?);

  await client.from('friends').insert({ user_id: fromUserId, friend_id: target.id, status: 'pending' });
}

async function getFriendRequests(userId) {
  const { data, error } = await client
    .from('friends').select('*, profiles!friends_user_id_fkey(username)')
    .eq('friend_id', userId).eq('status', 'pending');
  if (error) throw error;
  return data || [];
}

async function acceptFriendRequest(requestId) {
  await client.from('friends').update({ status: 'accepted' }).eq('id', requestId);
}

async function getFriends(userId) {
  const { data, error } = await client
    .from('friends').select('id, user_id, friend_id, profiles!friends_user_id_fkey(username), friend:profiles!friends_friend_id_fkey(username)')
    .or(`and(user_id.eq.${userId},status.eq.accepted),and(friend_id.eq.${userId},status.eq.accepted)`);
  if (error) throw error;
  return (data || []).map(f => ({
    friendId: f.user_id === userId ? f.friend_id : f.user_id,
    username: f.user_id === userId ? f.friend.username : f.profiles.username
  }));
}

// ==========================================
// 鑱婂ぉ
// ==========================================

async function sendMessage(fromUserId, toUserId, type, content) {
  await client.from('messages').insert({ from_user_id: fromUserId, to_user_id: toUserId, type, content });
}

async function getMessages(userId, otherUserId) {
  const { data, error } = await client
    .from('messages').select('*')
    .or(`and(from_user_id.eq.${userId},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${userId})`)
    .order('created_at').limit(100);
  if (error) throw error;
  return data || [];
}

// ==========================================
// 鏂囦欢涓婁紶
// ==========================================

async function uploadFile(bucket, folder, file) {
  const ext = file.name.split('.').pop();
  const name = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await client.storage.from(bucket).upload(name, file);
  if (error) throw error;
  const { data: { publicUrl } } = client.storage.from(bucket).getPublicUrl(name);
  return publicUrl;
}

// ==========================================
// 绠＄悊鍛?// ==========================================

async function getAllUsers() {
  const { data } = await client.from('profiles').select('*').order('created_at');
  return data || [];
}

async function resetUserPassword(userId, newPassword) {
  await client.from('profiles').update({ temp_password: newPassword }).eq('id', userId);
}

async function getCheckinsByUser(userId, date) {
  const { data } = await client.from('checkins').select('*, projects(name, color)')
    .eq('user_id', userId).eq('checkin_date', date);
  return data || [];
}

// ==========================================
// 宸ュ叿
// ==========================================

function calcStreak(dates, currentDate) {
  const arr = [...new Set(dates.map(d => typeof d === 'string' ? d : d.checkin_date))].sort().reverse();
  let streak = 0;
  const today = new Date(currentDate);
  for (let i = 0; i < arr.length; i++) {
    const d = new Date(arr[i]);
    const e = new Date(today); e.setDate(e.getDate() - i);
    if (d.toDateString() === e.toDateString()) streak++;
    else break;
  }
  return streak;
}

// 鎸傝浇鍒?window
window.registerUser = registerUser;
window.loginUser = loginUser;
window.getCurrentUser = getCurrentUser;
window.getUserProfile = getUserProfile;
window.logoutUser = logoutUser;
window.getMyProjects = getMyProjects;
window.createProject = createProject;
window.getProjectMembers = getProjectMembers;
window.removeProjectMember = removeProjectMember;
window.updateProjectDaily = updateProjectDaily;
window.submitCheckinData = submitCheckinData;
window.getCheckinsForDate = getCheckinsForDate;
window.getCheckinsForMonth = getCheckinsForMonth;
window.getUserCheckinsForMonth = getUserCheckinsForMonth;
window.addComment = addComment;
window.getComments = getComments;
window.sendFriendRequest = sendFriendRequest;
window.getFriendRequests = getFriendRequests;
window.acceptFriendRequest = acceptFriendRequest;
window.getFriends = getFriends;
window.sendMessage = sendMessage;
window.getMessages = getMessages;
window.uploadFile = uploadFile;
window.getAllUsers = getAllUsers;
window.resetUserPassword = resetUserPassword;
window.getCheckinsByUser = getCheckinsByUser;
window.calcStreak = calcStreak;

/* Habit Tracker - API Layer
   Supabase SDK via Tencent Cloud SCF proxy */

const SUPA_URL = 'https://1461105845-iim8nclwca.ap-shanghai.tencentcs.com';
const SUPA_KEY = 'sb_publishable_xi-u5divr9AoQHLL_G9eaw_4dWotEY9';

var db = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

async function registerUser(username, password) {
  const { data, error } = await db.auth.signUp({
    email: username + '@local.habit.app',
    password: password,
    options: { data: { username, is_admin: false } }
  });
  if (error) throw error;
  return data;
}

async function loginUser(username, password) {
  const { data, error } = await db.auth.signInWithPassword({
    email: username + '@local.habit.app',
    password: password
  });
  if (error) throw error;
  return data;
}

async function getCurrentUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

async function getUserProfile(userId) {
  const { data, error } = await db
    .from('profiles').select('*').eq('id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function logoutUser() {
  await db.auth.signOut();
}

async function getMyProjects(userId) {
  const { data, error } = await db
    .from('project_members')
    .select('project_id, projects(*)')
    .eq('user_id', userId);
  if (error) throw error;
  return data.map(d => d.projects).filter(Boolean);
}

async function createProject(name, color, creatorId, dailyCount, dailyType, members, creatorParticipates) {
  const { data: project, error } = await db
    .from('projects')
    .insert({ name, color, created_by: creatorId, daily_count: dailyCount, daily_type: dailyType })
    .select().single();
  if (error) throw error;
  const inserts = members.map(uid => ({ project_id: project.id, user_id: uid }));
  if (creatorParticipates) inserts.push({ project_id: project.id, user_id: creatorId });
  const { error: memErr } = await db.from('project_members').insert(inserts);
  if (memErr) throw memErr;
  return project;
}

async function getProjectMembers(projectId) {
  const { data } = await db.from('project_members')
    .select('user_id, profiles(username)').eq('project_id', projectId);
  return data || [];
}

async function removeProjectMember(projectId, userId) {
  await db.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);
}

async function updateProjectDaily(projectId, dailyCount, dailyType) {
  await db.from('projects').update({ daily_count: dailyCount, daily_type: dailyType }).eq('id', projectId);
}

async function submitCheckinData(projectId, userId, text, mediaUrls) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await db
    .from('checkins')
    .insert({ project_id: projectId, user_id: userId, checkin_date: today, text, media_urls: mediaUrls || [] })
    .select().single();
  if (error) throw error;
  return data;
}

async function getCheckinsForDate(projectId, date) {
  const { data, error } = await db
    .from('checkins').select('*, profiles(username)')
    .eq('project_id', projectId).eq('checkin_date', date);
  if (error) throw error;
  return data || [];
}

async function getCheckinsForMonth(projectId, year, month) {
  const start = year + '-' + String(month).padStart(2,'0') + '-01';
  const end = year + '-' + String(month).padStart(2,'0') + '-31';
  const { data, error } = await db
    .from('checkins').select('*')
    .eq('project_id', projectId).gte('checkin_date', start).lte('checkin_date', end);
  if (error) throw error;
  return data || [];
}

async function getUserCheckinsForMonth(userId, year, month) {
  const start = year + '-' + String(month).padStart(2,'0') + '-01';
  const end = year + '-' + String(month).padStart(2,'0') + '-31';
  const { data, error } = await db
    .from('checkins').select('*, projects(name, color)')
    .eq('user_id', userId).gte('checkin_date', start).lte('checkin_date', end);
  if (error) throw error;
  return data || [];
}

async function addComment(checkinId, userId, text) {
  const { data, error } = await db
    .from('comments').insert({ checkin_id: checkinId, user_id: userId, text })
    .select('*, profiles(username)').single();
  if (error) throw error;
  return data;
}

async function getComments(checkinId) {
  const { data, error } = await db
    .from('comments').select('*, profiles(username)')
    .eq('checkin_id', checkinId).order('created_at');
  if (error) throw error;
  return data || [];
}

async function sendFriendRequest(fromUserId, toUsername) {
  const { data: target } = await db.from('profiles').select('id').eq('username', toUsername).single();
  if (!target) throw new Error('User not found');
  const { data: existing } = await db.from('friends').select('*')
    .or('and(user_id.eq.' + fromUserId + ',friend_id.eq.' + target.id + '),and(user_id.eq.' + target.id + ',friend_id.eq.' + fromUserId + ')').single();
  if (existing) throw new Error('Already friends');
  await db.from('friends').insert({ user_id: fromUserId, friend_id: target.id, status: 'pending' });
}

async function getFriendRequests(userId) {
  const { data, error } = await db
    .from('friends').select('*, profiles!friends_user_id_fkey(username)')
    .eq('friend_id', userId).eq('status', 'pending');
  if (error) throw error;
  return data || [];
}

async function acceptFriendRequest(requestId) {
  await db.from('friends').update({ status: 'accepted' }).eq('id', requestId);
}

async function getFriends(userId) {
  const { data, error } = await db
    .from('friends').select('id, user_id, friend_id, profiles!friends_user_id_fkey(username), friend:profiles!friends_friend_id_fkey(username)')
    .or('and(user_id.eq.' + userId + ',status.eq.accepted),and(friend_id.eq.' + userId + ',status.eq.accepted)');
  if (error) throw error;
  return (data || []).map(f => ({
    friendId: f.user_id === userId ? f.friend_id : f.user_id,
    username: f.user_id === userId ? f.friend.username : f.profiles.username
  }));
}

async function sendMessage(fromUserId, toUserId, type, content) {
  await db.from('messages').insert({ from_user_id: fromUserId, to_user_id: toUserId, type, content });
}

async function getMessages(userId, otherUserId) {
  const { data, error } = await db
    .from('messages').select('*')
    .or('and(from_user_id.eq.' + userId + ',to_user_id.eq.' + otherUserId + '),and(from_user_id.eq.' + otherUserId + ',to_user_id.eq.' + userId + ')')
    .order('created_at').limit(100);
  if (error) throw error;
  return data || [];
}

async function uploadFile(bucket, folder, file) {
  const ext = file.name.split('.').pop();
  const name = folder + '/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
  const { data, error } = await db.storage.from(bucket).upload(name, file);
  if (error) throw error;
  const { data: { publicUrl } } = db.storage.from(bucket).getPublicUrl(name);
  return publicUrl;
}

async function getAllUsers() {
  const { data } = await db.from('profiles').select('*').order('created_at');
  return data || [];
}

async function resetUserPassword(userId, newPassword) {
  await db.from('profiles').update({ temp_password: newPassword }).eq('id', userId);
}

async function getCheckinsByUser(userId, date) {
  const { data } = await db.from('checkins').select('*, projects(name, color)')
    .eq('user_id', userId).eq('checkin_date', date);
  return data || [];
}

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
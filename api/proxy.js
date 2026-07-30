// Vercel Serverless Function
// 代理所有 Supabase API 请求
// 前端请求 /api/rest/v1/xxx -> Vercel -> Supabase

const SUPABASE_URL = 'https://vqalxycphakttybffwz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xi-u5divr9AoQHLL_G9eaw_4dWotEY9';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,apikey,x-client-info,Prefer');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 从 URL 中提取 Supabase 路径
    // /api -> 去掉 /api 前缀，其余部分就是 Supabase 的路径
    let supabasePath = req.url;
    if (supabasePath.startsWith('/api')) {
      supabasePath = supabasePath.slice('/api'.length);
    }

    const url = `${SUPABASE_URL}${supabasePath}`;

    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    };

    // 透传前端发来的 Authorization header
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    // 透传 Prefer header (Supabase 用它做 upsert 等操作)
    if (req.headers.prefer) {
      headers['Prefer'] = req.headers.prefer;
    }

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = JSON.stringify(req.body || {});
    }

    const fetchRes = await fetch(url, {
      method: req.method,
      headers,
      body,
    });

    // 直接返回 Supabase 的响应
    const data = await fetchRes.text();
    try {
      const json = JSON.parse(data);
      return res.status(fetchRes.status).json(json);
    } catch {
      return res.status(fetchRes.status).send(data);
    }
  } catch (e) {
    return res.status(502).json({ error: '代理请求失败', detail: e.message });
  }
}

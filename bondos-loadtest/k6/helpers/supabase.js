// k6/helpers/supabase.js
// Thin k6 wrapper around the Supabase REST + Auth APIs.
import http from 'k6/http';
import { check } from 'k6';

const BASE  = __ENV.SUPABASE_URL;
const ANON  = __ENV.SUPABASE_ANON_KEY;

function headers(token) {
  return {
    'Content-Type':  'application/json',
    'apikey':        ANON,
    'Authorization': token ? `Bearer ${token}` : `Bearer ${ANON}`,
    'Prefer':        'return=representation',
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export function signUp(email, password)       { return http.post(`${BASE}/auth/v1/signup`,                          JSON.stringify({ email, password }),       { headers: headers() }); }
export function signIn(email, password)       { return http.post(`${BASE}/auth/v1/token?grant_type=password`,       JSON.stringify({ email, password }),       { headers: headers() }); }
export function signOut(token)                { return http.post(`${BASE}/auth/v1/logout`,                          null,                                     { headers: headers(token) }); }
export function getUser(token)                { return http.get(`${BASE}/auth/v1/user`,                             { headers: headers(token) }); }

// ── REST CRUD ─────────────────────────────────────────────────────────────────
export function get(token, table, qs = '', tags = {}) {
  return http.get(`${BASE}/rest/v1/${table}${qs ? '?' + qs : ''}`, { headers: headers(token), tags });
}

export function post(token, table, body, tags = {}) {
  return http.post(`${BASE}/rest/v1/${table}`, JSON.stringify(body), { headers: headers(token), tags });
}

export function patch(token, table, qs, body, tags = {}) {
  return http.patch(`${BASE}/rest/v1/${table}?${qs}`, JSON.stringify(body), { headers: headers(token), tags });
}

export function del(token, table, qs, tags = {}) {
  return http.del(`${BASE}/rest/v1/${table}?${qs}`, null, { headers: headers(token), tags });
}

// ── RPC ───────────────────────────────────────────────────────────────────────
export function rpc(token, fn, params = {}, tags = {}) {
  return http.post(`${BASE}/rest/v1/rpc/${fn}`, JSON.stringify(params), { headers: headers(token), tags });
}

// ── Edge functions ────────────────────────────────────────────────────────────
export function edge(token, fn, body, tags = {}) {
  return http.post(`${BASE}/functions/v1/${fn}`, JSON.stringify(body), { headers: headers(token), tags });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function ok(res, label) {
  return check(res, { [`${label} → 2xx`]: r => r.status >= 200 && r.status < 300 });
}

export function parseBody(res) {
  try { return JSON.parse(res.body); } catch { return null; }
}

export function randEl(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function randInt(lo, hi) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }
export function uuid() { return `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`; }

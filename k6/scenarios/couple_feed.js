// k6/scenarios/couple_feed.js
// Tests: CoupleFeed — load, paginate, filter by type, rank modes, search, realtime reactions

import { sleep, check } from 'k6';
import * as sb from '../helpers/supabase.js';

const COUPLE_TYPES = [
  'Romantic','Engaged','Married','Long Distance','Situationship','Friends to Lovers',
];

const RANK_MODES = ['bond_score', 'popular', 'rising'];

const SEARCH_TERMS = [
  'iit', 'mumbai', 'delhi', 'vjti', 'rvce', 'vit', 'srm', 'nmims',
  'romantic', 'long distance', 'pune', 'bangalore', 'college',
];

const PAGE_SIZE = 12;

export function coupleFeedScenario(token) {

  // ── 1. Initial feed load (bond_score rank, no filter) ─────────────────────
  let r = sb.get(
    token,
    'couples',
    `select=id,couple_name,partner_username,couple_type,bond_score,emotional_sync_score,stability_score,growth_index,avatar_url,institution,locality,declared_by,created_at,social_links,backstory` +
    `&order=bond_score.desc&limit=${PAGE_SIZE}&offset=0`,
    { tags: { feature: 'couple_feed_load' } }
  );
  check(r, { 'couple feed load: 200': res => res.status === 200 });
  const couples = sb.parseBody(r) || [];
  sleep(0.3);

  if (couples.length === 0) {
    sleep(0.5);
    return;
  }

  const ids = couples.map(c => c.id);

  // ── 2. Bulk fetch reactions for feed cards ─────────────────────────────────
  if (ids.length > 0) {
    r = sb.get(
      token,
      'reactions',
      `select=target_id,user_id,reaction_type&target_type=eq.couple&target_id=in.(${ids.join(',')})`,
      { tags: { feature: 'couple_feed_load' } }
    );
    check(r, { 'bulk reactions: 200': res => res.status === 200 });
    sleep(0.2);

    // Bulk fetch comment counts
    r = sb.get(
      token,
      'couple_comments',
      `select=couple_id&target_type=eq.couple&couple_id=in.(${ids.join(',')})`,
      { tags: { feature: 'couple_feed_load' } }
    );
    check(r, { 'bulk comment counts: 200': res => res.status === 200 });
    sleep(0.2);

    // Bulk fetch community photo counts
    r = sb.get(
      token,
      'couple_community_photos',
      `select=couple_id&couple_id=in.(${ids.join(',')})`,
      { tags: { feature: 'couple_feed_load' } }
    );
    check(r, { 'bulk photo counts: 200': res => res.status === 200 });
    sleep(0.1);

    // Active statuses
    r = sb.get(
      token,
      'couple_statuses',
      `select=couple_id&couple_id=in.(${ids.join(',')})&expires_at=gt.${new Date().toISOString()}`,
      { tags: { feature: 'couple_feed_load' } }
    );
    check(r, { 'active statuses: 200': res => res.status === 200 });
    sleep(0.2);
  }

  // ── 3. Filter by couple type ──────────────────────────────────────────────
  const coupleType = sb.randEl(COUPLE_TYPES);
  r = sb.get(
    token,
    'couples',
    `select=id,couple_name,partner_username,couple_type,bond_score,emotional_sync_score,stability_score,growth_index,avatar_url,institution,locality,declared_by,created_at,social_links,backstory` +
    `&couple_type=eq.${encodeURIComponent(coupleType)}` +
    `&order=bond_score.desc&limit=${PAGE_SIZE}`,
    { tags: { feature: 'couple_feed_filter' } }
  );
  check(r, { 'couple type filter: 200': res => res.status === 200 });
  sleep(0.3);

  // ── 4. Rank mode: hot (popular by reactions) ──────────────────────────────
  r = sb.get(
    token,
    'couples',
    `select=id,couple_name,partner_username,couple_type,bond_score,emotional_sync_score,stability_score,growth_index,avatar_url,institution,locality,declared_by,created_at` +
    `&order=bond_score.desc&limit=${PAGE_SIZE}`,
    { tags: { feature: 'couple_feed_load' } }
  );
  check(r, { 'popular rank mode: 200': res => res.status === 200 });
  sleep(0.2);

  // ── 5. Rank mode: rising (new, last 30 days) ──────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  r = sb.get(
    token,
    'couples',
    `select=id,couple_name,partner_username,couple_type,bond_score,emotional_sync_score,stability_score,growth_index,avatar_url,institution,locality,declared_by,created_at` +
    `&created_at=gte.${thirtyDaysAgo}&order=bond_score.desc&limit=${PAGE_SIZE}`,
    { tags: { feature: 'couple_feed_load' } }
  );
  check(r, { 'rising rank: 200': res => res.status === 200 });
  sleep(0.2);

  // ── 6. Search by keyword ──────────────────────────────────────────────────
  const searchTerm = sb.randEl(SEARCH_TERMS);
  r = sb.get(
    token,
    'couples',
    `select=id,couple_name,partner_username,couple_type,bond_score,emotional_sync_score,stability_score,growth_index,avatar_url,institution,locality,declared_by,created_at,social_links,backstory` +
    `&or=couple_name.ilike.%25${searchTerm}%25,institution.ilike.%25${searchTerm}%25,locality.ilike.%25${searchTerm}%25,couple_type.ilike.%25${searchTerm}%25` +
    `&order=bond_score.desc&limit=${PAGE_SIZE}`,
    { tags: { feature: 'couple_feed_search' } }
  );
  check(r, { 'couple search: 200': res => res.status === 200 });
  sleep(0.3);

  // ── 7. Paginate (load more) ───────────────────────────────────────────────
  r = sb.get(
    token,
    'couples',
    `select=id,couple_name,partner_username,couple_type,bond_score,emotional_sync_score,stability_score,growth_index,avatar_url,institution,locality,declared_by,created_at,social_links,backstory` +
    `&order=bond_score.desc&limit=${PAGE_SIZE}&offset=${PAGE_SIZE}`,
    { tags: { feature: 'couple_feed_paginate' } }
  );
  check(r, { 'couple feed page 2: 200': res => res.status === 200 });
  sleep(0.4);
}

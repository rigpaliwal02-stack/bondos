// k6/scenarios/people_feed.js
// Tests: People tab feed load, profile view, search, reviewer sheet, My Character Card

import { sleep, check } from 'k6';
import * as sb from '../helpers/supabase.js';

const SEARCH_TERMS = [
  'priya', 'arjun', 'mumbai', 'iit', 'delhi', 'riya', 'sneha',
  'bangalore', 'pune', 'nmims', 'vjti', 'rvce', 'vit', 'srm', 'bits',
];

const COLLEGE_FILTERS = [
  'IIT Bombay', 'VIT Vellore', 'NMIMS', 'RVCE', 'DTU', 'NIT Trichy',
  'Symbiosis', 'Christ University', 'Manipal', 'SRM Chennai',
];

export function peopleFeedScenario(token, username) {
  // ── 1. Load People feed (top 30 by reviews_count) ────────────────────────
  let r = sb.get(
    token,
    'profiles',
    'select=username,display_name,college,city,reviews_count,self_archetype,self_animal,one_word,bio,avg_rating' +
    '&username=not.is.null&display_name=not.is.null' +
    '&order=reviews_count.desc&limit=30',
    { tags: { feature: 'people_feed' } }
  );
  check(r, { 'people feed: 200': res => res.status === 200 });
  const profiles = sb.parseBody(r) || [];
  sleep(0.4);

  // ── 2. Pick a random profile and view it ─────────────────────────────────
  if (profiles.length > 0) {
    const target = profiles[Math.floor(Math.random() * profiles.length)];

    // Full profile row
    r = sb.get(
      token,
      'profiles',
      `select=*&username=eq.${target.username}`,
      { tags: { feature: 'people_profile_view' } }
    );
    check(r, { 'profile view: 200': res => res.status === 200 });
    sleep(0.2);

    // Character reviews for this profile
    r = sb.get(
      token,
      'character_reviews',
      `target_username=eq.${target.username}&order=created_at.desc`,
      { tags: { feature: 'char_reviewer_sheet' } }
    );
    check(r, { 'reviews fetch: 200': res => res.status === 200 });
    sleep(0.3);

    // Active 2FP sessions targeting this user
    r = sb.get(
      token,
      'fp_sessions',
      `target_username=eq.${target.username}&status=eq.active&limit=5`,
      { tags: { feature: 'fp_session_list' } }
    );
    check(r, { 'fp sessions for profile: 200': res => res.status === 200 });
    sleep(0.2);
  }

  // ── 3. Search by name / college ───────────────────────────────────────────
  const term = sb.randEl(SEARCH_TERMS);
  r = sb.get(
    token,
    'profiles',
    `select=username,display_name,college,city,reviews_count,self_archetype,self_animal,one_word,bio,avg_rating` +
    `&or=username.ilike.%25${term}%25,display_name.ilike.%25${term}%25,college.ilike.%25${term}%25` +
    `&username=not.is.null&limit=10`,
    { tags: { feature: 'people_search' } }
  );
  check(r, { 'people search: 200': res => res.status === 200 });
  sleep(0.3);

  // ── 4. My Character Card – fetch own profile metrics ─────────────────────
  if (username) {
    r = sb.get(
      token,
      'profiles',
      `select=id,username,display_name,bio,college,city,review_visibility,reviews_count,avg_rating&id=eq.${username}`,
      { tags: { feature: 'my_char_card' } }
    );
    check(r, { 'my char card: 200': res => res.status === 200 });

    // Active 2FP cases against me
    r = sb.get(
      token,
      'fp_sessions',
      `select=id&target_username=eq.${username}&status=eq.active`,
      { tags: { feature: 'my_char_card' } }
    );
    check(r, { 'fp cases against me: 200': res => res.status === 200 });
    sleep(0.3);
  }

  // ── 5. Paginated feed scroll (simulating scroll-to-next-page) ────────────
  r = sb.get(
    token,
    'profiles',
    'select=username,display_name,college,city,reviews_count,self_archetype,self_animal,one_word,bio,avg_rating' +
    '&username=not.is.null&display_name=not.is.null' +
    '&order=reviews_count.desc&limit=30&offset=30',
    { tags: { feature: 'people_feed' } }
  );
  check(r, { 'people feed page 2: 200': res => res.status === 200 });
  sleep(0.5);
}

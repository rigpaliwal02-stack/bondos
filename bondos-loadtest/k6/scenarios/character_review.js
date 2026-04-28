// k6/scenarios/character_review.js
// Tests: submit a full CharacterReviewForm (ratings + pills + archetype + animal + flags + quote)

import { sleep, check } from 'k6';
import * as sb from '../helpers/supabase.js';

const ARCHETYPES = [
  'The Fixer','Safe House','Chaos Agent','Hype Machine',
  'The Real One','Quiet Anchor','Wildcard','Main Character',
  'The Therapist','Social Glue',
];

const ANIMALS = [
  'Lion','Wolf','Fox','Bear','Butterfly','Dolphin',
  'Eagle','Turtle','Unicorn','Octopus','Hedgehog',
  'Peacock','Elephant','Raccoon','Leopard',
];

const GREEN_FLAGS = [
  'Remembers small things','Shows up without being asked','Low drama',
  'Keeps secrets','Checks in randomly','Defends you when you\'re not there',
  'Apologises first','Celebrates your wins','Respects boundaries',
];

const RED_FLAGS = [
  'Goes MIA','Flaky under pressure','Makes it about them',
  'Hot and cold energy','Disappears when things get real',
  'Competitive about wrong things','Overpromises',
];

const PILL_OPTIONS = {
  sorted:   ['Pure chaos 🌀','Pretty messy','Balanced','Very sorted','Eerily organised 📋'],
  open:     ['Tells everyone everything','Pretty open','Selectively open','Guarded','Hard to read 🌫️'],
  hype:     ['Full hype 📣','Mostly encouraging','Both equally','Leans honest','Always straight 🪞'],
  energy:   ['Drains you 🪫','Somewhat draining','Neutral','Gives energy','Endless energy ⚡'],
  showup:   ['Rarely 💨','Sometimes','Usually','Almost always','Every single time 📍'],
  conflict: ['Avoids it','Gets defensive','Fixes it fast','Calm & direct','Handles it maturely 🤝'],
  memory:   ['Forgets everything','Remembers some','Usually remembers','Remembers details','Remembers everything 🧠'],
};

const QUOTES = [
  'the person who fixes things before you even notice',
  'chaotic good in human form',
  'your safe place when the world gets loud',
  'shows up every single time without being asked',
  'says exactly what you need to hear not what you want',
  'the friend who remembers everything you forgot telling them',
  'chaos incarnate but somehow always has your back',
];

const SECRETS = [
  'way more sensitive than they let on',
  'funnier than they ever get credit for',
  'secretly the most reliable person in the group',
  'carries a lot more than they show',
  null, null, // some reviewers skip this
];

function randN(arr, n) {
  const shuffled = arr.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function characterReviewScenario(token, reviewerUserId, targetUsernames) {
  if (!targetUsernames || !targetUsernames.length) return;

  const targetUsername = sb.randEl(targetUsernames);

  // ── 1. Resolve target user id ─────────────────────────────────────────────
  let r = sb.get(
    token,
    'profiles',
    `select=id,username,display_name,reviews_count,avg_rating&username=eq.${targetUsername}`,
    { tags: { feature: 'people_profile_view' } }
  );
  check(r, { 'resolve target: 200': res => res.status === 200 });
  const profileData = sb.parseBody(r);
  const targetUserId = (Array.isArray(profileData) ? profileData[0] : profileData)?.id || null;
  sleep(0.2);

  // ── 2. Build review payload exactly as the app does ───────────────────────
  const ratings = {
    vibe:      sb.randInt(1, 5),
    real:      sb.randInt(1, 5),
    reliable:  sb.randInt(1, 7),
    emotional: sb.randInt(1, 5),
    fun:       sb.randInt(1, 5),
  };

  const pillAnswers = {};
  Object.entries(PILL_OPTIONS).forEach(([key, opts]) => {
    // ~70% chance to answer each pill question (mirrors real behaviour)
    if (Math.random() < 0.70) pillAnswers[key] = sb.randEl(opts);
  });

  const greenFlags = randN(GREEN_FLAGS, sb.randInt(1, 3));
  const redFlags   = randN(RED_FLAGS,   Math.random() < 0.4 ? sb.randInt(1, 2) : 0);

  const payload = {
    target_user_id:    targetUserId,
    target_username:   targetUsername,
    reviewer_id:       reviewerUserId,
    reviewer_username: Math.random() < 0.6 ? null : `loadtest_reviewer_${sb.randInt(1, 500)}`,
    is_anonymous:      Math.random() < 0.6,
    answers:           { ...ratings, ...pillAnswers },
    archetype:         sb.randEl(ARCHETYPES),
    animal:            sb.randEl(ANIMALS),
    green_flags:       greenFlags,
    red_flags:         redFlags,
    quote_line:        sb.randEl(QUOTES),
    secret_line:       sb.randEl(SECRETS),
    created_at:        new Date().toISOString(),
  };

  // ── 3. Submit via REST (same as app) ──────────────────────────────────────
  r = sb.post(
    token,
    'character_reviews',
    payload,
    { tags: { feature: 'char_review_submit' } }
  );
  check(r, {
    'char review submit: 201': res => res.status === 201,
  });
  sleep(0.4);

  // ── 4. Re-fetch reviews to confirm it landed ─────────────────────────────
  r = sb.get(
    token,
    'character_reviews',
    `target_username=eq.${targetUsername}&order=created_at.desc&limit=5`,
    { tags: { feature: 'char_reviewer_sheet' } }
  );
  check(r, {
    'review fetch after submit: 200': res => res.status === 200,
    'review list is array': res => {
      try { return Array.isArray(JSON.parse(res.body)); } catch { return false; }
    },
  });
  sleep(0.5);

  // ── 5. Fetch reviewer sheet (full modal) ──────────────────────────────────
  r = sb.get(
    token,
    'character_reviews',
    `target_username=eq.${targetUsername}&order=created_at.desc`,
    { tags: { feature: 'char_reviewer_sheet' } }
  );
  check(r, { 'reviewer sheet: 200': res => res.status === 200 });
  sleep(0.3);
}

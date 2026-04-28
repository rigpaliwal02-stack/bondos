// k6/main.js
// BondOS Load Test Orchestrator — Social Tab + People Tab ONLY
// Simulates 1000 concurrent real users across every action in both tabs.

import { sleep, check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import * as sb from './helpers/supabase.js';
import { thresholds }          from './config/thresholds.js';

// ── Scenario imports ──────────────────────────────────────────────────────────
import { peopleFeedScenario }       from './scenarios/people_feed.js';
import { characterReviewScenario }  from './scenarios/character_review.js';
import { fightForPeopleScenario }   from './scenarios/fight_for_people.js';
import { coupleFeedScenario }       from './scenarios/couple_feed.js';
import { coupleReactionsScenario }  from './scenarios/couple_reactions.js';
import { coupleDetailScenario }     from './scenarios/couple_detail.js';
import { shipItScenario }           from './scenarios/ship_it.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const scenarioErrors = new Counter('bondos_scenario_errors');
const scenarioRuns   = new Counter('bondos_scenario_runs');
const sessionDuration= new Trend('bondos_session_duration_ms');

// ── k6 options ────────────────────────────────────────────────────────────────
export const options = {
  vus:      parseInt(__ENV.K6_VUS || '1000'),
  duration: __ENV.K6_DURATION || '10m',
  thresholds,

  // Graceful ramp-up to avoid hammering cold connections
  stages: [
    { duration: '1m',  target: Math.floor(parseInt(__ENV.K6_VUS || '1000') * 0.25) }, // 0→25%
    { duration: '2m',  target: Math.floor(parseInt(__ENV.K6_VUS || '1000') * 0.75) }, // 25→75%
    { duration: '5m',  target: parseInt(__ENV.K6_VUS || '1000') },                    // 75→100%
    { duration: '1m',  target: Math.floor(parseInt(__ENV.K6_VUS || '1000') * 0.50) }, // ramp down
    { duration: '1m',  target: 0 },                                                   // drain
  ],
};

// ── Shared pool of real usernames (read from DB during first VU setup) ────────
// Each VU picks a random target username for People-tab tests.
// We seed 50 test usernames deterministically so no single VU owns a unique state.
const TARGET_USERNAMES = Array.from({ length: 50 }, (_, i) =>
  `loadtest_user_${(i + 1).toString().padStart(3, '0')}`
);

// ── Scenario weights (must sum to 100) ───────────────────────────────────────
// These reflect realistic traffic distribution in a Gen-Z app:
//   Social feed browsing   → heaviest traffic
//   Reactions & comments   → medium
//   People feed browsing   → medium
//   Character reviews      → lighter (form-heavy)
//   Ship It                → medium
//   Fight for People       → lighter (heavy writes)
//   Couple detail / status → light

const SCENARIOS = [
  { name: 'couple_feed',        weight: 28, fn: runCoupleFeed },
  { name: 'people_feed',        weight: 20, fn: runPeopleFeed },
  { name: 'couple_reactions',   weight: 16, fn: runCoupleReactions },
  { name: 'ship_it',            weight: 12, fn: runShipIt },
  { name: 'character_review',   weight:  8, fn: runCharacterReview },
  { name: 'couple_detail',      weight:  8, fn: runCoupleDetail },
  { name: 'fight_for_people',   weight:  8, fn: runFightForPeople },
];

// Build weighted selection table
const WEIGHTED = [];
SCENARIOS.forEach(s => {
  for (let i = 0; i < s.weight; i++) WEIGHTED.push(s);
});

// ── Auth: sign in once per VU ─────────────────────────────────────────────────
export function setup() {
  // Smoke-test: ensure Supabase is reachable
  const r = sb.get(null, 'profiles', 'select=id&limit=1&display_name=not.is.null');
  check(r, { 'supabase reachable': res => res.status === 200 });
  console.log('[setup] Supabase is reachable. Starting load test.');
}

// ── VU-level state ────────────────────────────────────────────────────────────
// Each VU uses an anonymous token (Supabase anon key works for public RLS tables)
// For write operations, the edge functions handle auth via anon key + guest UUID.
let _token   = null;
let _userId  = null;
let _username= null;

function ensureAuth() {
  if (_token) return;

  // Use the ANON key directly as the bearer — public tables allow this.
  // For RLS-protected tables, the edge functions sign requests server-side.
  _token    = __ENV.SUPABASE_ANON_KEY;
  _userId   = `loadtest_vu_${__VU}_${Date.now()}`;
  _username = `loadtest_user_${sb.randInt(1, 500)}`;
}

// ── Main VU loop ──────────────────────────────────────────────────────────────
export default function () {
  ensureAuth();

  const scenario    = __ENV.SCENARIO || 'all';
  const startMs     = Date.now();
  let   scenarioFn  = null;

  if (scenario === 'all') {
    // Pick a weighted random scenario
    const pick = WEIGHTED[Math.floor(Math.random() * WEIGHTED.length)];
    scenarioFn = pick.fn;
  } else {
    // Run specific scenario by name
    const match = SCENARIOS.find(s => s.name === scenario);
    if (match) scenarioFn = match.fn;
    else {
      console.warn(`[main] unknown scenario "${scenario}", defaulting to couple_feed`);
      scenarioFn = runCoupleFeed;
    }
  }

  try {
    scenarioFn(_token, _userId, _username);
    scenarioRuns.add(1);
  } catch (err) {
    console.error(`[main] scenario error: ${err}`);
    scenarioErrors.add(1);
  }

  sessionDuration.add(Date.now() - startMs);

  // Small think time between iterations (real users don't hammer continuously)
  sleep(sb.randInt(1, 3));
}

// ── Scenario runners ──────────────────────────────────────────────────────────

function runPeopleFeed(token, userId, username) {
  peopleFeedScenario(token, userId);
}

function runCharacterReview(token, userId, username) {
  characterReviewScenario(token, userId, TARGET_USERNAMES);
}

function runFightForPeople(token, userId, username) {
  fightForPeopleScenario(token, userId, TARGET_USERNAMES);
}

function runCoupleFeed(token, userId, username) {
  coupleFeedScenario(token);
}

function runCoupleReactions(token, userId, username) {
  coupleReactionsScenario(token, userId);
}

function runCoupleDetail(token, userId, username) {
  coupleDetailScenario(token, userId);
}

function runShipIt(token, userId, username) {
  shipItScenario(token, userId);
}

// ── Teardown ──────────────────────────────────────────────────────────────────
export function teardown() {
  console.log('[teardown] Load test complete.');
}

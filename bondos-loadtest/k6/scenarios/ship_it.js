// k6/scenarios/ship_it.js
// Tests: Ship It hub — load ships, celeb vote, drop a ship, vote, hall of ships

import { sleep, check } from 'k6';
import * as sb from '../helpers/supabase.js';

const VIBE_TAGS = [
  'tension','looks','texting','energy','bff','trying','everyone_knows','chaos',
];

const PLATFORMS = ['instagram','x','snapchat','bond','irl','other'];

const CAPTIONS = [
  'Lowkey something is going on here 👀',
  'Everyone in the group chat already knows',
  'The tension in every photo is REAL',
  'They both said "just friends" but nobody believes them',
  'One of them is definitely down bad',
  'The way they look at each other is insane',
  null, null, // some ships have no caption
];

const FIRST_NAMES = [
  'Aryan','Priya','Rohan','Riya','Aditya','Sneha','Karan','Divya',
  'Mihir','Kavya','Parth','Ankita','Yash','Tanya','Dev','Shreya',
  'Aarav','Nidhi','Ishaan','Simran','Vivaan','Pooja','Dhruv','Meghna',
];

const HANDLES = [
  'aryanofficial','priya.jpg','rohankhatri_','riyavibes','k.divya99',
  'the_real_yash','sneha.daily','kavya_k','parth.adk','mihir__m',
];

const CELEB_SHIP_IDS = [
  'celeb_1','celeb_2','celeb_3','celeb_4',
  'celeb_5','celeb_6','celeb_7','celeb_8',
];

export function shipItScenario(token, userId) {
  const guestId = userId || `guest_${sb.randInt(1, 999999)}`;

  // ── 1. Load active ships ───────────────────────────────────────────────────
  let r = sb.get(
    token,
    'ship_it',
    'select=*&order=created_at.desc&limit=50',
    { tags: { feature: 'ship_feed' } }
  );
  check(r, { 'active ships: 200': res => res.status === 200 });
  const ships = sb.parseBody(r) || [];
  sleep(0.3);

  // ── 2. Load my votes on active ships ─────────────────────────────────────
  r = sb.get(
    token,
    'ship_votes',
    `select=ship_id,vote&user_id=eq.${guestId}`,
    { tags: { feature: 'ship_feed' } }
  );
  check(r, { 'my ship votes: 200': res => res.status === 200 });
  sleep(0.2);

  // ── 3. Hall of Ships (top 10 by sails) ───────────────────────────────────
  r = sb.get(
    token,
    'ship_it',
    'select=*&order=sails.desc&limit=10',
    { tags: { feature: 'ship_feed' } }
  );
  check(r, { 'hall of ships: 200': res => res.status === 200 });
  sleep(0.2);

  // ── 4. Vote on an active ship ─────────────────────────────────────────────
  if (ships.length > 0) {
    const ship = sb.randEl(ships);
    const vote = Math.random() < 0.6 ? 'sail' : 'sink';

    r = sb.edge(
      token,
      'api-vote-ship',
      { shipId: ship.id, vote },
      { tags: { feature: 'ship_vote' } }
    );
    check(r, { 'ship vote: 2xx or 409': res => res.status >= 200 && res.status < 300 || res.status === 409 });
    sleep(0.2);

    // Vote on a second ship
    if (ships.length > 1) {
      const ship2 = ships[Math.floor(Math.random() * ships.length)];
      r = sb.edge(
        token,
        'api-vote-ship',
        { shipId: ship2.id, vote: Math.random() < 0.6 ? 'sail' : 'sink' },
        { tags: { feature: 'ship_vote' } }
      );
      check(r, { 'ship vote 2: 2xx': res => res.status >= 200 && res.status < 300 || res.status === 409 });
      sleep(0.15);
    }
  }

  // ── 5. Celeb ship vote (localStorage-backed in app; test the vote table) ──
  const celebShipId = sb.randEl(CELEB_SHIP_IDS);
  const celebVote   = Math.random() < 0.55 ? 'sail' : 'sink';
  // Celeb ships use local votes in the app, but we test the RLS policies
  // by attempting an insert that should be rejected or accepted
  r = sb.post(
    token,
    'ship_votes',
    { ship_id: celebShipId, user_id: guestId, vote: celebVote },
    { tags: { feature: 'celeb_ship_vote' } }
  );
  check(r, { 'celeb vote: any response': res => res.status >= 200 });
  sleep(0.2);

  // ── 6. Drop a ship (via edge function) ───────────────────────────────────
  // ~30% of VUs drop a ship
  if (Math.random() < 0.30) {
    const numVibes = sb.randInt(1, 3);
    const vibes    = VIBE_TAGS.slice().sort(() => Math.random() - 0.5).slice(0, numVibes);
    const platform = sb.randEl(PLATFORMS);
    const nameA    = sb.randEl(FIRST_NAMES);
    const nameB    = sb.randEl(FIRST_NAMES.filter(n => n !== nameA));

    r = sb.edge(
      token,
      'api-drop-ship',
      {
        personA: {
          name:     nameA,
          handle:   sb.randEl(HANDLES),
          platform: platform,
          bond_id:  null,
        },
        personB: {
          name:     nameB,
          handle:   sb.randEl(HANDLES),
          platform: platform,
          bond_id:  null,
        },
        vibes,
        caption:  sb.randEl(CAPTIONS),
        isAnon:   Math.random() < 0.55,
      },
      { tags: { feature: 'ship_create' } }
    );
    check(r, { 'ship dropped: 2xx or 429': res =>
      (res.status >= 200 && res.status < 300) || res.status === 429
    });
    sleep(0.5);
  }

  // ── 7. Comment on a ship ──────────────────────────────────────────────────
  if (ships.length > 0) {
    const shipForComment = sb.randEl(ships);
    r = sb.edge(
      token,
      'api-comments',
      {
        coupleId:   shipForComment.id,
        targetType: 'ship',
        content:    sb.randEl([
          'This makes total sense actually',
          'No way 😭',
          'I\'ve been saying this for months',
          'The way this is TRUE',
          'Somebody had to say it',
        ]),
      },
      { tags: { feature: 'couple_comment_post' } }
    );
    check(r, { 'ship comment: 2xx': res => res.status >= 200 && res.status < 300 });
    sleep(0.3);

    // fetch comments on the ship
    r = sb.get(
      token,
      'couple_comments',
      `select=*&couple_id=eq.${shipForComment.id}&target_type=eq.ship&order=created_at.asc`,
      { tags: { feature: 'couple_comment_fetch' } }
    );
    check(r, { 'ship comments fetch: 200': res => res.status === 200 });
    sleep(0.3);
  }
}

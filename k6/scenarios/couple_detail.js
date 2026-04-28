// k6/scenarios/couple_detail.js
// Tests: CoupleDetailModal load, story Q&A save, community photos, 24h status,
//        couple creation, challenge list, challenge complete

import { sleep, check } from 'k6';
import * as sb from '../helpers/supabase.js';

const COUPLE_TYPES = [
  'Romantic','Engaged','Married','Long Distance','Situationship','Friends to Lovers',
];

const INSTITUTIONS = [
  'IIT Bombay','VJTI Mumbai','DJ Sanghvi Mumbai','NMIMS Mumbai',
  'RVCE Bangalore','PES University','VIT Vellore','SRM Chennai',
  'DTU Delhi','NIT Trichy','BITS Pilani','Symbiosis Pune',
];

const LOCALITIES = [
  'Andheri, Mumbai','Vile Parle, Mumbai','Powai, Mumbai','Bandra, Mumbai',
  'Koramangala, Bangalore','Indiranagar, Bangalore','Gurugram, Delhi NCR',
  'Kothrud, Pune','T Nagar, Chennai','Salt Lake, Kolkata',
];

const BACKSTORIES = [
  'Met at the college canteen. They took the last samosa. It was fate.',
  'Bonded over hating the same professor in first year. Still going strong.',
  'Matched on Hinge, realised we\'d been in the same lecture hall for 2 semesters.',
  'She helped him survive backlog semester. He stuck around.',
  'Both stayed till library closing time every single day for a semester.',
  'Rivals in every placement mock. Started prepping together. Stopped competing.',
];

const STORY_ANSWERS = [
  'Honestly didn\'t plan to talk but ended up talking for 3 hours',
  'Their laugh — it\'s completely unhinged and I was obsessed immediately',
  'Technically I did but they don\'t remember it that way',
  'That one road trip where everything went wrong and somehow that was perfect',
  'We both have an irrational hatred of people who chew loudly',
  'When they showed up without being asked. That\'s when I knew.',
];

const CHALLENGE_KEYS = [
  'daily_checkin','daily_compliment','daily_meme',
  'weekly_deeptalk','weekly_new','once_note','once_goal',
  'rom_daily_gm','rom_weekly_date','rom_weekly_cook',
  'ld_daily_call','ld_daily_photo','sit_weekly_define',
  'ftl_weekly_roots','ftl_weekly_tell',
];

const STORY_QUESTION_KEYS = [
  'how_met','first_noticed','said_it_first','chaotic_moment',
  'weird_common','knew_different','friend_word',
];

export function coupleDetailScenario(token, userId) {

  // ── 1. Get a couple to open ────────────────────────────────────────────────
  let r = sb.get(
    token,
    'couples',
    'select=id,couple_name,couple_type,bond_score,creator_id,social_links,backstory&order=bond_score.desc&limit=20',
    { tags: { feature: 'couple_feed_load' } }
  );
  check(r, { 'get couples for detail: 200': res => res.status === 200 });
  const couples = sb.parseBody(r) || [];
  if (couples.length === 0) { sleep(1); return; }
  sleep(0.2);

  const couple   = sb.randEl(couples);
  const coupleId = couple.id;

  // ── 2. Open CoupleDetailModal — load all three in parallel ───────────────
  r = sb.get(
    token,
    'couple_challenges',
    `select=challenge_key,xp_awarded,proof_url,proof_note,completed_at&couple_id=eq.${coupleId}&order=completed_at.desc`,
    { tags: { feature: 'couple_detail_load' } }
  );
  check(r, { 'challenge history: 200': res => res.status === 200 });
  sleep(0.1);

  r = sb.get(
    token,
    'couple_stories',
    `select=question_key,answer&couple_id=eq.${coupleId}`,
    { tags: { feature: 'couple_detail_load' } }
  );
  check(r, { 'couple stories: 200': res => res.status === 200 });
  sleep(0.1);

  r = sb.get(
    token,
    'couple_community_photos',
    `select=*&couple_id=eq.${coupleId}&order=created_at.desc&limit=20`,
    { tags: { feature: 'couple_detail_load' } }
  );
  check(r, { 'community photos: 200': res => res.status === 200 });
  sleep(0.2);

  // ── 3. Save / upsert a story Q&A answer ──────────────────────────────────
  const questionKey = sb.randEl(STORY_QUESTION_KEYS);
  r = sb.post(
    token,
    'couple_stories',
    {
      couple_id:    coupleId,
      question_key: questionKey,
      answer:       sb.randEl(STORY_ANSWERS),
    },
    { tags: { feature: 'couple_story_save' } }
  );
  // app uses upsert — 201 or 200 both valid
  check(r, { 'story save: 2xx': res => res.status >= 200 && res.status < 300 });
  sleep(0.3);

  // ── 4. 24h Status — load active statuses ─────────────────────────────────
  r = sb.get(
    token,
    'couple_statuses',
    `select=*&couple_id=eq.${coupleId}&expires_at=gt.${new Date().toISOString()}&order=created_at.desc`,
    { tags: { feature: 'couple_status_load' } }
  );
  check(r, { 'status load: 200': res => res.status === 200 });
  sleep(0.2);

  // ── 5. Post a status (text-only, simulating pre-uploaded URL) ────────────
  // In the app this happens after image upload; we simulate with a placeholder URL
  const fakeCdnUrl = `https://nkujeixtehrkhqelqbpm.supabase.co/storage/v1/object/public/statuses/loadtest/${coupleId}_${Date.now()}.jpg`;
  const now    = new Date();
  const expiry = new Date(now.getTime() + 24 * 3600000).toISOString();
  r = sb.post(
    token,
    'couple_statuses',
    {
      couple_id:   coupleId,
      image_url:   fakeCdnUrl,
      caption:     `Load test status at ${now.toISOString()}`,
      created_by:  userId || null,
      created_at:  now.toISOString(),
      expires_at:  expiry,
    },
    { tags: { feature: 'couple_status_post' } }
  );
  check(r, { 'status post: 201': res => res.status === 201 });
  sleep(0.3);

  // ── 6. Complete a challenge ───────────────────────────────────────────────
  const challengeKey = sb.randEl(CHALLENGE_KEYS);
  r = sb.post(
    token,
    'couple_challenges',
    {
      couple_id:      coupleId,
      challenge_key:  challengeKey,
      completed_by:   userId || null,
      xp_awarded:     sb.randInt(2, 8),
      completed_at:   new Date().toISOString(),
    },
    { tags: { feature: 'challenge_complete' } }
  );
  check(r, { 'challenge complete: 201 or 409': res => [201, 409].includes(res.status) });
  sleep(0.2);

  // ── 7. Reload challenges after completion ─────────────────────────────────
  r = sb.get(
    token,
    'couple_challenges',
    `select=*&couple_id=eq.${coupleId}&order=completed_at.desc`,
    { tags: { feature: 'challenge_list' } }
  );
  check(r, { 'challenge reload: 200': res => res.status === 200 });
  sleep(0.3);

  // ── 8. Create a new couple profile (via edge function) ───────────────────
  // Only ~10% of VUs go through full creation to avoid spam
  if (Math.random() < 0.10) {
    r = sb.edge(
      token,
      'api-couples',
      {
        name1:        `LT_${sb.randInt(1000, 9999)}`,
        name2:        `LT_${sb.randInt(1000, 9999)}`,
        finalAvatarUrl: null,
        declaredBy:   Math.random() < 0.5 ? 'partner' : 'outsider',
        coupleType:   sb.randEl(COUPLE_TYPES),
        answers: {
          duration:  '1-6 months',
          comm:      sb.randInt(4, 9),
          emotional: sb.randInt(4, 9),
          stability: sb.randInt(4, 9),
          growth:    sb.randInt(4, 9),
        },
        institution:  sb.randEl(INSTITUTIONS),
        locality:     sb.randEl(LOCALITIES),
        socialLinks:  {},
        backstory:    sb.randEl(BACKSTORIES),
        scores: {
          bond_score:           sb.randInt(50, 95),
          emotional_sync_score: sb.randInt(45, 99),
          stability_score:      sb.randInt(45, 99),
          growth_index:         sb.randInt(45, 99),
        },
      },
      { tags: { feature: 'couple_create' } }
    );
    check(r, { 'couple create: 2xx': res => res.status >= 200 && res.status < 300 });
    sleep(0.5);
  }

  // ── 9. Load My Couple Profile (own couple) ────────────────────────────────
  if (userId) {
    r = sb.get(
      token,
      'couples',
      `select=*&creator_id=eq.${userId}`,
      { tags: { feature: 'couple_profile_load' } }
    );
    check(r, { 'my couple profile: 200': res => res.status === 200 });
    sleep(0.3);
  }
}

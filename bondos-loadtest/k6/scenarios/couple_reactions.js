// k6/scenarios/couple_reactions.js
// Tests: react on a couple card, remove reaction, post comment, fetch comments

import { sleep, check } from 'k6';
import * as sb from '../helpers/supabase.js';

const EMOJIS = ['❤️', '😍', '🔥', '💯', '🥹'];

const SAMPLE_COMMENTS = [
  'Omg they are so cute together 😭',
  'This is peak relationship goals fr',
  'How are they so perfect???',
  'The backstory is sending me 💀',
  'Best couple on here no contest',
  'Rooting for them so hard 🙏',
  'That IIT bond score is insane',
  'Long distance and still thriving respect',
  'This is the realest thing I\'ve seen on this app',
  'They deserve the top spot honestly',
];

export function coupleReactionsScenario(token, userId) {
  // ── 1. Get couple ids from feed ───────────────────────────────────────────
  let r = sb.get(
    token,
    'couples',
    'select=id,couple_name&order=bond_score.desc&limit=20',
    { tags: { feature: 'couple_feed_load' } }
  );
  check(r, { 'get couples for reactions: 200': res => res.status === 200 });
  const couples = sb.parseBody(r) || [];
  if (couples.length === 0) { sleep(1); return; }
  sleep(0.2);

  const couple    = sb.randEl(couples);
  const coupleId  = couple.id;
  const emoji     = sb.randEl(EMOJIS);
  const guestId   = userId || `guest_${sb.randInt(1, 999999)}`;

  // ── 2. Add reaction (via edge function, same as app) ─────────────────────
  r = sb.edge(
    token,
    'api-reactions',
    { targetId: coupleId, targetType: 'couple', emoji },
    { tags: { feature: 'couple_reaction_add' } }
  );
  check(r, { 'reaction add: 200-204': res => res.status >= 200 && res.status < 300 });
  sleep(0.2);

  // ── 3. Verify reaction is persisted ──────────────────────────────────────
  r = sb.get(
    token,
    'reactions',
    `select=id,reaction_type&target_type=eq.couple&target_id=eq.${coupleId}&user_id=eq.${guestId}`,
    { tags: { feature: 'couple_reaction_add' } }
  );
  check(r, { 'reaction verify: 200': res => res.status === 200 });
  const reactionId = sb.parseBody(r)?.[0]?.id;
  sleep(0.2);

  // ── 4. Toggle (remove) the same reaction ─────────────────────────────────
  if (reactionId) {
    r = sb.edge(
      token,
      'api-reactions',
      { targetId: coupleId, targetType: 'couple', emoji },
      { tags: { feature: 'couple_reaction_remove' } }
    );
    check(r, { 'reaction toggle: 200-204': res => res.status >= 200 && res.status < 300 });
    sleep(0.2);
  }

  // ── 5. React on a second couple ───────────────────────────────────────────
  const couple2   = sb.randEl(couples);
  const emoji2    = sb.randEl(EMOJIS);
  r = sb.edge(
    token,
    'api-reactions',
    { targetId: couple2.id, targetType: 'couple', emoji: emoji2 },
    { tags: { feature: 'couple_reaction_add' } }
  );
  check(r, { 'reaction add 2: 2xx': res => res.status >= 200 && res.status < 300 });
  sleep(0.3);

  // ── 6. Fetch comments for a couple ───────────────────────────────────────
  r = sb.get(
    token,
    'couple_comments',
    `select=*&couple_id=eq.${coupleId}&target_type=eq.couple&order=created_at.asc`,
    { tags: { feature: 'couple_comment_fetch' } }
  );
  check(r, { 'comments fetch: 200': res => res.status === 200 });
  sleep(0.2);

  // ── 7. Post a comment (via edge function, same as app) ───────────────────
  r = sb.edge(
    token,
    'api-comments',
    { coupleId, targetType: 'couple', content: sb.randEl(SAMPLE_COMMENTS) },
    { tags: { feature: 'couple_comment_post' } }
  );
  check(r, { 'comment post: 2xx': res => res.status >= 200 && res.status < 300 });
  sleep(0.3);

  // ── 8. Re-fetch comments to confirm ──────────────────────────────────────
  r = sb.get(
    token,
    'couple_comments',
    `select=*&couple_id=eq.${coupleId}&target_type=eq.couple&order=created_at.asc`,
    { tags: { feature: 'couple_comment_fetch' } }
  );
  check(r, { 'comments refetch: 200': res => res.status === 200 });
  sleep(0.4);
}

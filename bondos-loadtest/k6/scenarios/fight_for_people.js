// k6/scenarios/fight_for_people.js
// Tests: 2FP session list, start session, view, send messages, vote, invite, join side

import { sleep, check } from 'k6';
import * as sb from '../helpers/supabase.js';

const ALLEGATIONS = [
  'Literally the most unreliable person in the group. Cancels every single plan.',
  'Takes credit for other people\'s ideas in every group project.',
  'Has a completely different personality when certain people are around.',
  'Goes cold and starts ignoring people the moment they\'re not useful anymore.',
  'Makes everything about themselves in every conversation.',
  'Says one thing in public and the complete opposite in private.',
  'Flirts with everyone then acts surprised when feelings get involved.',
];

const CONTEXTS = [
  'Multiple people have confirmed this pattern over the past 6 months.',
  'This has happened at least 4 times I personally witnessed.',
  'Screenshots available if needed.',
  null, null, // some skip context
];

const MESSAGES = [
  'That\'s genuinely not accurate — here\'s what actually happened.',
  'The pattern is real, I\'ve seen it too.',
  'This seems like a misunderstanding more than anything intentional.',
  'There are two sides here and I think both have valid points.',
  'Speak for yourself, my experience was completely different.',
  'Facts: the allegation happened. Whether it was malicious is debatable.',
  'Hard disagree. The context matters a lot here.',
  'I\'ve known this person for years and this isn\'t who they are.',
];

export function fightForPeopleScenario(token, username, targetUsernames) {
  const target = targetUsernames && targetUsernames.length
    ? sb.randEl(targetUsernames)
    : `loadtest_target_${sb.randInt(1, 100)}`;

  // ── 1. Load 2FP session list (hub feed) ───────────────────────────────────
  let r = sb.get(
    token,
    'fp_sessions',
    'select=*&order=created_at.desc&limit=40',
    { tags: { feature: 'fp_session_list' } }
  );
  check(r, { 'fp hub load: 200': res => res.status === 200 });
  const sessions = sb.parseBody(r) || [];
  sleep(0.3);

  // ── 2. Filter: live sessions only ─────────────────────────────────────────
  r = sb.get(
    token,
    'fp_sessions',
    'select=*&status=eq.active&order=created_at.desc&limit=40',
    { tags: { feature: 'fp_session_list' } }
  );
  check(r, { 'fp live filter: 200': res => res.status === 200 });
  sleep(0.2);

  // ── 3. Start a new 2FP session ────────────────────────────────────────────
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + 72 * 3600000).toISOString();

  const sessionPayload = {
    allegation:          sb.randEl(ALLEGATIONS),
    context:             sb.randEl(CONTEXTS),
    challenger_id:       username || `guest_${sb.randInt(1, 9999)}`,
    challenger_username: `loadtest_user_${sb.randInt(1, 9999)}`,
    target_username:     target,
    status:              'active',
    expires_at:          expiresAt,
  };

  r = sb.post(
    token,
    'fp_sessions',
    sessionPayload,
    { tags: { feature: 'fp_session_start' } }
  );
  check(r, { 'fp session start: 201': res => res.status === 201 });

  let sessionId = null;
  try { sessionId = sb.parseBody(r)?.[0]?.id || null; } catch {}
  sleep(0.3);

  if (sessionId) {
    // ── 4. Add challenger as participant ──────────────────────────────────
    sb.post(
      token,
      'fp_participants',
      {
        session_id: sessionId,
        username:   sessionPayload.challenger_username,
        user_id:    username,
        side:       'challenger',
        role:       'starter',
      },
      { tags: { feature: 'fp_join_side' } }
    );
    sleep(0.2);

    // ── 5. Load session detail ────────────────────────────────────────────
    r = sb.get(
      token,
      'fp_sessions',
      `select=*&id=eq.${sessionId}`,
      { tags: { feature: 'fp_session_view' } }
    );
    check(r, { 'fp session view: 200': res => res.status === 200 });
    sleep(0.2);

    // ── 6. Load participants for this session ─────────────────────────────
    r = sb.get(
      token,
      'fp_participants',
      `select=*&session_id=eq.${sessionId}`,
      { tags: { feature: 'fp_session_view' } }
    );
    check(r, { 'fp participants: 200': res => res.status === 200 });
    sleep(0.1);

    // ── 7. Load messages ──────────────────────────────────────────────────
    r = sb.get(
      token,
      'fp_messages',
      `select=*&session_id=eq.${sessionId}&order=created_at.asc`,
      { tags: { feature: 'fp_session_view' } }
    );
    check(r, { 'fp messages load: 200': res => res.status === 200 });
    sleep(0.2);

    // ── 8. Send 1–3 messages ──────────────────────────────────────────────
    const msgCount = sb.randInt(1, 3);
    for (let i = 0; i < msgCount; i++) {
      r = sb.post(
        token,
        'fp_messages',
        {
          session_id:      sessionId,
          sender_username: sessionPayload.challenger_username,
          sender_id:       username,
          content:         sb.randEl(MESSAGES),
          side:            'challenger',
        },
        { tags: { feature: 'fp_message_send' } }
      );
      check(r, { 'fp message sent: 201': res => res.status === 201 });
      sleep(0.15);
    }

    // ── 9. Cast a vote ────────────────────────────────────────────────────
    const side = Math.random() < 0.5 ? 'challenger' : 'defender';
    r = sb.post(
      token,
      'fp_votes',
      {
        session_id: sessionId,
        voter_id:   username || `guest_${sb.randInt(1, 99999)}`,
        voted_for:  side,
      },
      { tags: { feature: 'fp_vote' } }
    );
    check(r, { 'fp vote: 201 or 409': res => [201, 409].includes(res.status) });
    sleep(0.2);

    // ── 10. Load all votes (vote bar render) ──────────────────────────────
    r = sb.get(
      token,
      'fp_votes',
      `select=voter_id,voted_for&session_id=eq.${sessionId}`,
      { tags: { feature: 'fp_vote' } }
    );
    check(r, { 'fp vote bar: 200': res => res.status === 200 });
    sleep(0.2);

    // ── 11. Invite an ally (search + insert participant) ──────────────────
    const invitee = `loadtest_ally_${sb.randInt(1, 200)}`;
    r = sb.get(
      token,
      'profiles',
      `select=username,display_name,college&username=ilike.%25loadtest%25&limit=6`,
      { tags: { feature: 'fp_invite' } }
    );
    check(r, { 'fp invite search: 200': res => res.status === 200 });
    sleep(0.15);

    r = sb.post(
      token,
      'fp_participants',
      { session_id: sessionId, username: invitee, side: 'challenger', role: 'invited' },
      { tags: { feature: 'fp_invite' } }
    );
    check(r, { 'fp invite insert: 201 or 409': res => [201, 409].includes(res.status) });
    sleep(0.3);
  }

  // ── 12. Browse an existing live session from the feed ────────────────────
  const liveSessions = sessions.filter(s => s.status === 'active');
  if (liveSessions.length > 0) {
    const existing = sb.randEl(liveSessions);

    r = sb.get(
      token,
      'fp_messages',
      `select=*&session_id=eq.${existing.id}&order=created_at.asc`,
      { tags: { feature: 'fp_session_view' } }
    );
    check(r, { 'existing fp msgs: 200': res => res.status === 200 });
    sleep(0.2);

    r = sb.get(
      token,
      'fp_votes',
      `select=voter_id,voted_for&session_id=eq.${existing.id}`,
      { tags: { feature: 'fp_vote' } }
    );
    check(r, { 'existing fp votes: 200': res => res.status === 200 });
    sleep(0.3);
  }
}

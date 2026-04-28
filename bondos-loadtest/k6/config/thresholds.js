// k6/config/thresholds.js
// SLA budgets for People tab + Social tab features ONLY.
// Any breach marks the CI run as FAILED.

export const thresholds = {
  // ── Global ────────────────────────────────────────────────────────────────
  'http_req_duration': ['p(95)<2500', 'p(99)<5000'],
  'http_req_failed':   ['rate<0.03'],          // <3 % errors allowed
  'checks':            ['rate>0.92'],           // 92 % of all checks pass

  // ════════════════════════════════════════════════════════════════════
  //  PEOPLE TAB
  // ════════════════════════════════════════════════════════════════════

  // People feed (profiles listing)
  'http_req_duration{feature:people_feed}':           ['p(95)<1200'],
  'http_req_duration{feature:people_search}':         ['p(95)<1500'],

  // Single profile view
  'http_req_duration{feature:people_profile_view}':   ['p(95)<1000'],

  // Character review form – submit
  'http_req_duration{feature:char_review_submit}':    ['p(95)<2500'],
  // Reviewer sheet (list of reviews received)
  'http_req_duration{feature:char_reviewer_sheet}':   ['p(95)<1200'],

  // My Character Card metrics
  'http_req_duration{feature:my_char_card}':          ['p(95)<800'],

  // Fight for People (2FP)
  'http_req_duration{feature:fp_session_list}':       ['p(95)<1500'],
  'http_req_duration{feature:fp_session_start}':      ['p(95)<2000'],
  'http_req_duration{feature:fp_session_view}':       ['p(95)<1000'],
  'http_req_duration{feature:fp_message_send}':       ['p(95)<1200'],
  'http_req_duration{feature:fp_vote}':               ['p(95)<800'],
  'http_req_duration{feature:fp_invite}':             ['p(95)<1000'],
  'http_req_duration{feature:fp_join_side}':          ['p(95)<1000'],

  // ════════════════════════════════════════════════════════════════════
  //  SOCIAL TAB
  // ════════════════════════════════════════════════════════════════════

  // Couple Feed (Discover)
  'http_req_duration{feature:couple_feed_load}':      ['p(95)<1500'],
  'http_req_duration{feature:couple_feed_paginate}':  ['p(95)<1500'],
  'http_req_duration{feature:couple_feed_search}':    ['p(95)<1500'],
  'http_req_duration{feature:couple_feed_filter}':    ['p(95)<1500'],

  // Reactions on couple cards
  'http_req_duration{feature:couple_reaction_add}':   ['p(95)<800'],
  'http_req_duration{feature:couple_reaction_remove}':['p(95)<800'],

  // Comments on couples
  'http_req_duration{feature:couple_comment_post}':   ['p(95)<1500'],
  'http_req_duration{feature:couple_comment_fetch}':  ['p(95)<800'],

  // Couple Detail Modal
  'http_req_duration{feature:couple_detail_load}':    ['p(95)<1200'],
  'http_req_duration{feature:couple_story_save}':     ['p(95)<1500'],
  'http_req_duration{feature:couple_community_photo}':['p(95)<2500'],

  // Couple 24h Status
  'http_req_duration{feature:couple_status_load}':    ['p(95)<1000'],
  'http_req_duration{feature:couple_status_post}':    ['p(95)<2500'],

  // Couple Creation + My Profile
  'http_req_duration{feature:couple_create}':         ['p(95)<2500'],
  'http_req_duration{feature:couple_profile_load}':   ['p(95)<1000'],

  // Challenges
  'http_req_duration{feature:challenge_list}':        ['p(95)<1000'],
  'http_req_duration{feature:challenge_complete}':    ['p(95)<1500'],

  // Ship It
  'http_req_duration{feature:ship_feed}':             ['p(95)<1500'],
  'http_req_duration{feature:ship_create}':           ['p(95)<2000'],
  'http_req_duration{feature:ship_vote}':             ['p(95)<800'],
  'http_req_duration{feature:celeb_ship_vote}':       ['p(95)<600'],
};

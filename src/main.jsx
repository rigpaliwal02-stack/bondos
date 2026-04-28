import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './lib/supabase';
import './bond-styles.css';
import * as Sentry from "@sentry/react";

// ── Instagram WebView Fix ──
// ── Instagram WebView Fix ──
(function redirectInstagramWebView() {
  const ua = navigator.userAgent;
  if (!/Instagram/.test(ua)) return;

  const isAndroid = /Android/.test(ua);
  const isIOS = /iPhone|iPad/.test(ua);

  // ✅ Android — silently opens Chrome
  if (isAndroid) {
    const url = window.location.href;
    window.location.href =
      "intent://" +
      url.replace(/https?:\/\//, "") +
      "#Intent;scheme=https;package=com.android.chrome;end";
    return;
  }

  // ✅ iOS — just load the app, hide OAuth buttons
  if (isIOS) {
    window.__IS_INSTAGRAM_IOS__ = true;
    return; // ← let the app load normally, no redirect, no page replacement
  }
})();
// ── Sentry ──
Sentry.init({
  dsn: "https://89c23362f4753d7f7d7688f8c6e60488@o4510980003332096.ingest.us.sentry.io/4510980007723008",
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.1,
  beforeSend(event) {
    if (window.location.hostname === "localhost") return null;
    // Filter out Instagram WebView Java bridge crash (not your bug)
    const msg = event.exception?.values?.[0]?.value || "";
    if (msg.includes("Java object is gone")) return null;
    return event;
  },
});
// Global error tracker — use anywhere in the app
window.trackError = (error, context = {}) => {
  Sentry.captureException(error, { extra: context });
  console.error("[tracked]", error, context);
};

window.trackEvent = (name, data = {}) => {
  Sentry.addBreadcrumb({ message: name, data, level: "info" });
};
// Make supabase available globally so your existing code works unchanged

window.supabaseClient = supabase;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
  // Global helper — ALWAYS use this
  window.traceAction = (name, payload = {}) => {
    if (window.BondTrace) {
      window.BondTrace.event(name, payload);
    }
  };
  const _SUPABASE_URL = SUPABASE_URL;
const _SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
// ── PASTE YOUR ENTIRE COPIED CODE HERE ──
// of what you paste — we handle that below


// GLOBAL CONTEXT HELPER FOR PARTNER CLONE
window.buildCoachContext = (extra = {}) => {
  try {
    const base = window.__BOND_STATE__ || {};
    return { ...base, ...extra };
  } catch (e) {
    console.error("[BondCoach] buildCoachContext error", e);
    return extra || {};
  }
};
/* ⬇️ Keep ALL your existing React code after this as-is ⬇️ */


// ── Supabase Storage upload helper ──
async function uploadToStorage(bucket, file, pathPrefix = "") {
try {
// Compress image before upload if possible
const ext = file.type === "image/png" ? "png" : "jpg";
const uid = window.currentUser?.id ||
localStorage.getItem("bond_guest_uuid") ||
Date.now().toString(36);
const path = `${pathPrefix}${uid}_${Date.now()}.${ext}`;
const { data, error } = await window.supabaseClient.storage
.from(bucket)
.upload(path, file, {
  cacheControl: "3600",
  upsert: true,
  contentType: file.type
});
if (error) {
console.warn(`[Storage] upload failed (${bucket}):`, error.message);
return null;
}
const { data: urlData } = window.supabaseClient.storage
.from(bucket)
.getPublicUrl(data.path);
return urlData.publicUrl;
} catch (err) {
console.warn("[Storage] upload crashed:", err);
return null;
}
}
// ── PROFILE + REVIEW DB HELPERS ──
async function getOrCreateUser() {
  try {
    const { data: { user } } = await window.supabaseClient.auth.getUser();

    if (user) return user.id;

    let guestId = localStorage.getItem("bond_guest_uuid");

    if (!guestId) {
      guestId = crypto.randomUUID();
      localStorage.setItem("bond_guest_uuid", guestId);

      const { error } = await window.supabaseClient
        .from("profiles")
        .insert({
          id: guestId,
          username: "guest_" + guestId.slice(0, 6),
          display_name: "Guest",
        });

      if (error) {
        console.error("Guest profile insert failed:", error);
      }
    }

    return guestId;
  } catch (e) {
    console.error("getOrCreateUser error:", e);
    return ensureGuestUUID(); // fallback
  }
}
/**
 * Single source of truth for guest UUID.
 * Call this anywhere you need a user ID and auth might not exist.
 */
function ensureGuestUUID() {
  let uid = localStorage.getItem("bond_guest_uuid");

  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem("bond_guest_uuid", uid);
  }

  return uid;
}
async function saveProfileToDB(profile) {
  try {
    const userId = await getOrCreateUser();

    const payload = {
      id: userId,
      username: profile.username,
      display_name: profile.display_name,
      updated_at: new Date().toISOString()
    };

    console.log("[PROFILE SAVING]", payload);

    const { error } = await window.supabaseClient
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (error) throw error;

    console.log("[PROFILE SAVED SUCCESS]");
    return true;

  } catch (err) {
    console.error("Profile save error:", err);
    return false;
  }
}
async function submitCharacterReview({
  target_user_id,
  target_username, // keep for now
  answers,
  archetype,
  animal,
  green_flags,
  red_flags,
  quote_line,
  secret_line,
  is_anonymous = true
}) {
  try {
    const userId = await getOrCreateUser();

    const { error } = await window.supabaseClient
      .from("character_reviews")
      .insert({
        target_user_id,
        target_username, // fallback
        reviewer_user_id: userId,
        is_anonymous,
        answers,
        archetype,
        animal,
        green_flags,
        red_flags,
        quote_line,
        secret_line
      });

    if (error) throw error;

    return true;
  } catch (err) {
    console.error("Review submit error:", err);
    return false;
  }
}
async function updateProfileMetrics(username) {
  try {
    // First resolve the user id from username
    const { data: profileData } = await window.supabaseClient
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    const resolvedUserId = profileData?.id;

    let orFilter = `target_username.eq.${username}`;
    if (resolvedUserId) {
      orFilter = `target_user_id.eq.${resolvedUserId},target_username.eq.${username}`;
    }

    const { data, error } = await window.supabaseClient
      .from("character_reviews")
      .select("answers")
      .or(orFilter);

    if (error || !data || !data.length) return;

    const count = data.length;

    const KEYS = {
      vibe:      5,
      real:      5,
      reliable:  7,
      emotional: 5,
      fun:       5,
    };

    let totalNorm = 0;
    let samples   = 0;

    data.forEach(r => {
      const ans = r.answers || {};
      Object.entries(KEYS).forEach(([k, max]) => {
        const val = Number(ans[k] || 0);
        if (val > 0) {
          totalNorm += (val / max) * 5;
          samples++;
        }
      });
    });

    const avg = samples > 0
      ? parseFloat((totalNorm / samples).toFixed(2))
      : 0;

    await window.supabaseClient
      .from("profiles")
      .update({ reviews_count: count, avg_rating: avg })
      .eq("username", username);

  } catch (e) {
    console.warn("[updateProfileMetrics] failed:", e);
  }
}
async function getProfile(username) {
  const { data, error } = await window.supabaseClient
    .from("profiles")
    .select(`
      username,
      display_name,
      bio,
      college,
      city,
      reviews_count,
      avg_rating,
      self_archetype,
      self_animal,
      one_word
    `)
    .eq("username", username)
    .single();

  if (error) throw error;

  return data;
}

async function getCharacterReviews(username) {
  const { data, error } = await window.supabaseClient
    .from("character_reviews")
    .select("*")
    .eq("target_username", username)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

// ── Compress image before upload (halves file size) ──
function compressImage(file, maxWidth = 400, quality = 0.75) {
return new Promise((resolve) => {
const reader = new FileReader();
reader.onload = (e) => {
const img = new Image();
img.onload = () => {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, maxWidth / img.width);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(
    (blob) => resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file),
    "image/jpeg",
    quality
  );
};
img.src = e.target.result;
};
reader.readAsDataURL(file);
});
}
const saveGuestProfile = (name) => {
  const guestId =
    localStorage.getItem("bond_guest_uuid") || crypto.randomUUID();

  localStorage.setItem("bond_guest_uuid", guestId);

  const profileData = {
    id: guestId,
    username: name,
    display_name: name,
    updated_at: new Date().toISOString(),
  };

  localStorage.setItem("bond_guest_profile", JSON.stringify(profileData));

  console.log("[GUEST PROFILE SAVED LOCALLY]", profileData);

  return profileData;
};


/* =====================================================
APP SHELL — SINGLE SOURCE OF UI TRUTH
===================================================== */
const AppShell = ({
title = "",
onBack = null,
headerVariant = "default",
children,
}) => {
return (
<div className="min-h-screen bg-bondBg text-bondText flex flex-col">

{/* HEADER */}
<div className="sticky top-0 z-30">
  {headerVariant === "home" ? (
    <HomeHeader />
  ) : (
    <div className="bg-bondBg/90 backdrop-blur border-b border-white/5">
      <div className="max-w-md mx-auto h-14 px-4 flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm opacity-70 hover:opacity-100 transition"
          >
            ←
          </button>
        )}
        <h1 className="text-sm font-medium truncate">{title}</h1>
      </div>
    </div>
  )}
</div>

{/* CONTENT */}
<div className="flex-1 min-h-0 max-w-md mx-auto w-full px-4 py-6 overflow-y-auto custom-scroll">
  {children}
</div>
</div>
);
};

/* =====================================================
HOME HEADER
===================================================== */
const HomeHeader = () => {
return (
<div className="bg-bondBg/95 backdrop-blur border-b border-white/5">
<div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">

  {/* LEFT: STREAK + STATUS */}
  <div className="flex items-center gap-3">
  <div
 className="
 relative w-10 h-10 rounded-full
 flex items-center justify-center
 text-blue-400 text-sm font-medium
 border border-blue-400/30
 shadow-sm
 animate-pulseSlow
 "
>
      1d
    </div>

    <div className="text-xs opacity-70">
      Bond active
    </div>
  </div>

  {/* RIGHT: ASK COACH */}
<button
onClick={() =>
openCoachFromReact(
"I want general relationship insight and guidance."
)
}
className="
px-3 py-1 rounded-full
text-xs font-medium
text-blue-600
bg-blue-50
border border-gray-200
shadow-sm
hover:bg-blue-100
transition
"
>
Ask Coach
</button>


</div>

{/* SOFT GLOW UNDERLINE */}
<div className="h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
</div>
);
};


/* =========================
SHARED FEATURE CARD
========================= */
const FeatureCard = ({
title,
subtitle,
meta,
cta = "›",
onClick,
tall = true,
}) => {
return (
<button
onClick={onClick}
className={`
  w-full
  ${tall ? "h-[96px] rounded-2xl" : "h-[72px] rounded-xl"}
  bg-bondSurface
 border border-white/15

  px-4 py-3
  flex items-start justify-between
  transition
  hover:border-white/25
  active:scale-[0.98]
`}
>
<div className="text-left">
  <div className="text-sm font-medium">{title}</div>

  {subtitle && (
    <div className="text-xs opacity-60 mt-1">
      {subtitle}
    </div>
  )}

  {meta && (
    <div className="text-xs opacity-40 mt-1">
      {meta}
    </div>
  )}
</div>

<div className="self-end text-xs text-blue-400">
  {cta}
</div>
</button>
);
};

const AssessmentIntro = () => {
return (
<div className="space-y-2 mb-6">
<h2 className="text-xl font-semibold tracking-tight">
  Assessment Mode
</h2>

<p className="text-sm opacity-70 leading-snug">
  Run structured checks on a connection or from your own perspective.
</p>

<p className="text-xs opacity-50">
  Most people begin with a Solo Check.
</p>
</div>
);
};

const LevelCard = ({
level,
label,
time,
note = null,
onClick,
}) => {
return (
<button
onClick={onClick}
className="
  w-full
  h-[88px]
  rounded-2xl
  bg-bondSurface
border border-white/15

  px-4 py-3
  flex justify-between items-center
  text-left
  transition
  hover:border-white/25
  active:scale-[0.98]
"
>
<div>
<div className="flex flex-col justify-center">
<div className="text-sm font-medium">
Level {level}
</div>

<div className="text-xs opacity-60 mt-1">
{label}
</div>

<div className="text-xs opacity-40 mt-1">
{time}
</div>

{note && (
<div className="text-xs opacity-40 mt-1">
{note}
</div>
)}
</div>
</div> 

<div className="self-end text-xs text-text-blue-500-400">
  Start →
</div>
</button>
);
};

const STORAGE_PREFIX = "bond_os_state_";

/* -------------------------------------------------------
   ARCHETYPES
-------------------------------------------------------- */
const ARCHETYPES = [
  {
    id: "secure-team",
    name: "Secure Team",
    description:
      "You repair, you joke, you plan. Not perfect, but there’s a felt sense of ‘we’re on the same side’.",
    color: "bg-green-500/10 border border-green-500/20",
  },
  {
    id: "growing-bond",
    name: "Growing Bond",
    description:
      "There’s real warmth here and a lot that works. Some patterns still need deliberate attention.",
    color: "bg-blue-500/10 border border-blue-500/20",
  },
  {
    id: "fragile-chemistry",
    name: "Fragile Chemistry",
    description:
      "The pull is strong, but so are the wobbles. Things easily tip from amazing to confusing.",
    color: "bg-amber-500/10 border border-amber-500/20",
  },
  {
    id: "situationship-loop",
    name: "Situationship Loop",
    description:
      "More ambiguity than clarity. High highs, low lows, lots of ‘what are we even doing’.",
    color: "bg-red-500/10 border border-red-500/20",
  },
  {
    id: "unclear-data",
    name: "Unclear / Heavy Zone",
    description:
      "The data is thin or intense but lopsided. Your body might be saying ‘slow down and observe’.",
    color: "bg-gray-500/10 border border-gray-500/20",
  },
];
/* -------------------------------------------------------
   QUIZ LEVELS (couple assessments)
-------------------------------------------------------- */
const QUIZ_LEVELS = {
  level1_v2: {
    name: "Level 1 – Vibe & Chemistry",
    icon: "heart",
    questions: [
      { id: 1, text: "I feel relaxed, not tense, when we hang out." },
      { id: 2, text: "Our humour and banter feel easy, not forced." },
      { id: 3, text: "We can sit in silence without it feeling awkward." },
      { id: 4, text: "I feel like myself, not a performance, around them." },
      { id: 5, text: "We genuinely enjoy the same kinds of ‘chill time’." },
      { id: 6, text: "I don’t feel the need to over-analyse every interaction." },
      { id: 7, text: "When something good happens, they are one of my first calls." },
      { id: 8, text: "When something bad happens, I feel safe turning to them." },
      { id: 9, text: "I feel they actually ‘get’ my personality." },
      {
        id: 10,
        text: "If a friend saw us together, it would look like it feels inside.",
      },
    ],
  },
  level2_v2: {
    name: "Level 2 – Daily Life & Rhythm",
    icon: "clock",
    questions: [
      {
        id: 11,
        text: "Our daily texting / calling pace feels good to both of us.",
      },
      { id: 12, text: "We respect each other’s work / study time." },
      {
        id: 13,
        text: "We both put in effort to plan time together, not just one person.",
      },
      { id: 14, text: "We can handle busy weeks without the bond collapsing." },
      {
        id: 15,
        text: "Our sleep / social / alone-time rhythms mostly work together.",
      },
      {
        id: 16,
        text: "We both make small practical efforts (reminders, chores, planning, rides).",
      },
      {
        id: 17,
        text: "We’ve started to find rituals that feel like ‘ours’ (shows, walks, calls).",
      },
      { id: 18, text: "We can talk logistics without immediately fighting." },
      {
        id: 19,
        text: "I don’t feel like my real life is constantly being disrupted by this bond.",
      },
      { id: 20, text: "They respect my need for alone time or friend time." },
    ],
  },
  level3_v2: {
    name: "Level 3 – Conflict & Triggers",
    icon: "alert-triangle",
    questions: [
      {
        id: 21,
        text: "When conflict happens, we eventually come back to the same team.",
      },
      { id: 22, text: "We can apologise without huge ego battles." },
      {
        id: 23,
        text: "We are both willing to hear how we hurt the other without instantly shutting down.",
      },
      {
        id: 24,
        text: "Fights don’t regularly end in silent treatment / blocking / threats.",
      },
      {
        id: 25,
        text: "We can disagree without name-calling or character assassination.",
      },
      {
        id: 26,
        text: "We’ve talked at least once about our conflict patterns and triggers.",
      },
      {
        id: 27,
        text: "When I set a boundary in conflict, it is eventually respected.",
      },
      { id: 28, text: "We don’t use jealousy or insecurity as a weapon in fights." },
      {
        id: 29,
        text: "After conflict, we usually repair instead of pretending it never happened.",
      },
      {
        id: 30,
        text: "My nervous system doesn’t live in constant fear of the ‘next blow up’.",
      },
    ],
  },
  level4_v2: {
    name: "Level 4 – Future, Money & Design",
    icon: "map",
    questions: [
      { id: 31, text: "We’ve talked about at least a rough 1–3 year future." },
      {
        id: 32,
        text: "Our views on commitment / labels are broadly in the same universe.",
      },
      {
        id: 33,
        text: "We’ve at least touched the topic of money and how we each think about it.",
      },
      {
        id: 34,
        text: "Big life goals (location, career, kids / no kids) feel potentially compatible.",
      },
      { id: 35, text: "We can talk about fears around the future, not just fantasies." },
      { id: 36, text: "They don’t mock or minimise my long-term goals." },
      { id: 37, text: "I don’t feel like I have to shrink my future to keep them." },
      {
        id: 38,
        text: "We can realistically imagine how a week of shared life would actually work.",
      },
      { id: 39, text: "We have some shared sense of what a ‘good life’ looks like." },
      {
        id: 40,
        text: "Even if details are fuzzy, it feels possible to design something long-term together.",
      },
    ],
  },
  level5_v2: {
    name: "Level 5 – Intimacy & Closeness",
    icon: "flame",
    questions: [
      { id: 41, text: "I feel desired and wanted, not just tolerated." },
      {
        id: 42,
        text: "We can talk about physical intimacy without it becoming instantly awkward or defensive.",
      },
      {
        id: 43,
        text: "They make some effort to understand what actually makes me feel close.",
      },
      { id: 44, text: "I can say no / not now without fear of punishment or withdrawal." },
      {
        id: 45,
        text: "We have affectionate moments that are not just sexual (touch, words, presence).",
      },
      {
        id: 46,
        text: "Emotional intimacy (sharing fears, dreams, memories) is present, not just vibes.",
      },
      {
        id: 47,
        text: "I feel like they see me as a whole person, not just a role or fantasy.",
      },
      {
        id: 48,
        text: "I don’t feel compared to exes / ideal images in a way that makes me small.",
      },
      {
        id: 49,
        text: "Our closeness feels like something we both protect, not something I’m chasing.",
      },
      {
        id: 50,
        text: "Overall, intimacy feels more nourishing than draining or confusing.",
      },
    ],
  },
};

/* -------------------------------------------------------
   JOINT GUESS GAME LEVELS
-------------------------------------------------------- */
const JOINT_LEVELS = {
  level1: {
    name: "Soft Favourites",
    icon: "heart",
    description: "Warm-up questions about everyday likes and comforts.",
    questions: [
      "My ideal lazy-day activity is…",
      "My current comfort show / movie is…",
      "My favourite chai / coffee order is…",
      "A song that feels like ‘us’ to me is…",
      "My favourite way to receive care when I’m sick is…",
    ],
  },
  level2: {
    name: "Inner World",
    icon: "brain",
    description: "Things that show how you think and feel.",
    questions: [
      "Something I’m secretly proud of in myself is…",
      "A fear I rarely say out loud is…",
      "A small thing that makes me feel deeply loved is…",
      "One boundary that really matters to me is…",
      "A dream I don’t talk about much is…",
    ],
  },
  level3: {
    name: "History & Stories",
    icon: "calendar",
    description: "Moments from your life that shaped you.",
    questions: [
      "A childhood memory that shaped my ideas about love is…",
      "A teacher / mentor who impacted me was…",
      "A turning point year in my life was…",
      "A place that feels like home to me is…",
      "An old version of me I’ve outgrown is…",
    ],
  },
  level4: {
    name: "Triggers & Repairs",
    icon: "alert-triangle",
    description: "What hurts, what soothes, and how you fight.",
    questions: [
      "One thing that instantly makes me shut down is…",
      "In conflict, what I need most from you is…",
      "A small gesture that quickly calms me is…",
      "Something I’m still learning to apologise for is…",
      "What repair feels like to me after a fight is…",
    ],
  },
  level5: {
    name: "Future & ‘Us’ Story",
    icon: "map",
    description: "Where you might be headed together.",
    questions: [
      "Something I genuinely want for our future is…",
      "A ritual I’d love us to build is…",
      "A big life dream I hope you’re in is…",
      "One thing that would make long-term feel safe is…",
      "If we look back 5 years from now, I hope we’re saying…",
    ],
  },
};

/* -------------------------------------------------------
   INITIAL DATA MODEL
-------------------------------------------------------- */
const INITIAL_DATA = {
  p1Name: "",
  p2Name: "",
  extraPartners: [],
profilePic: null, // base64 image or future Supabase URL

  quizState: "menu",
  testCount: 0,
  selectedLevel: "level1",
  p1Answers: [],
  p2Answers: [],
  results: null,

  soloState: "intro",
  soloAnswers: [],

  flagState: "intro",
  flagAnswers: [],
  flagResult: null,
// =====================================================
// IDEAL MATCH — INITIAL STATE
// =====================================================
idealState: "intro",        // intro | quiz | result
idealSessionId: null,       // uuid per run
idealAnswers: {},           // { [questionId]: 1–5 }
idealScore: null,           // 0–100
idealResult: null,          // optional interpreted output
idealGeo: null,             // optional geo/context input


  profileRadarProfiles: [],

  jointState: "rules",
  jointChallengeLevel: "level1",
  jointP1Answers: [],
  jointP2Guesses: [],
  jointResults: null,
  jointCurrentIndex: 0,

  goals: ["", ""],
  planConfig: {
    constraints: "",
    timePerWeek: "3–5",
    sessionLength: "30",
  },
  dynamicPlan: [],
  roadmap: [],
  objective: "",

  moodState: "feed",
selectedMoodProfile: null,
moodDraft: {
  mood: null,
  reason: "",
  tags: [],
  isAnonymous: true,
},

  partnerCloneState: "intro",
  partnerCloneAnswers: [],
  partnerCloneProfile: null,

  verseIdealAnswers: [],
  verseIdealState: "intro",

  streakDays: 0,
  lastActiveDate: null,
  quizSession: {
questions: [],
feature: null,
seed: null,
soloSessionId: null,
flagSessionId: null,
idealSessionId: null

}

};

/* -------------------------------------------------------
   SMALL UTIL HELPERS (UNIQUE, NO DUPLICATES)
-------------------------------------------------------- */
let isCoachMaximized = false;
window.addEventListener("keydown", (e) => {
if (e.key === "Escape" && isCoachMaximized) {
toggleCoachMaximize("escape_key");
let coachMaximizedAt = null;

function getActiveScreen() {
  try {
    // Try to determine current screen from URL or app state
    const path = window.location.pathname;
    if (path.includes("/people/")) return "people_profile";
    return "home";
  } catch { return "unknown"; }
}

function getSessionId() {
  try {
    return localStorage.getItem("bond_anon_id") || "no_session";
  } catch { return "no_session"; }
}
}

});

function toggleCoachMaximize(source = "manual") {
const coach = document.getElementById("bondCoach");
if (!coach) return;

isCoachMaximized = !isCoachMaximized;

coach.classList.toggle("coach-maximized", isCoachMaximized);

/* ✅ ADD THIS LINE HERE */
document.body.classList.toggle("coach-dim", isCoachMaximized);

if (isCoachMaximized) {
coachMaximizedAt = Date.now();
trace({
type: "ai_coach_expand",
source,
screen: getActiveScreen(),
sessionId: getSessionId()
});
} else {
trace({
type: "ai_coach_collapse",
durationMs: coachMaximizedAt
  ? Date.now() - coachMaximizedAt
  : null,
sessionId: getSessionId()
});
coachMaximizedAt = null;
}
}
const MOODS = [
  { key: "happy", label: "Happy", emoji: "😊", score: 2 },
  { key: "excited", label: "Excited", emoji: "🤩", score: 2 },
  { key: "calm", label: "Calm", emoji: "😌", score: 2 },
  { key: "chill", label: "Chill", emoji: "😎", score: 1 },
  { key: "normal", label: "Normal", emoji: "🙂", score: 1 },
  { key: "confused", label: "Confused", emoji: "😶‍🌫️", score: 0 },
  { key: "low_energy", label: "Low Energy", emoji: "🪫", score: 0 },
  { key: "sad", label: "Sad", emoji: "😔", score: -1 },
  { key: "stressed", label: "Stressed", emoji: "😵‍💫", score: -1 },
  { key: "angry", label: "Angry", emoji: "😤", score: -2 }
];

const REASON_TAGS = [
  "College",
  "Work",
  "Friends",
  "Family",
  "Relationship",
  "Exam",
  "Health",
  "Drama",
  "Win",
  "Unknown"
];
async function submitProfileMood({
  targetUserId,
  reviewerUserId,
  mood,
  reason,
  tags = [],
  isAnonymous = true,
}) {
  const moodObj = MOODS.find((m) => m.key === mood);
  if (!moodObj) throw new Error("Invalid mood");

  const { data, error } = await supabase
    .from("profile_moods")
    .insert({
      target_user_id: targetUserId,
      reviewer_user_id: reviewerUserId,
      mood,
      mood_score: moodObj.score,
      reason,
      reason_tags: tags,
      is_anonymous: isAnonymous,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function fetchProfileMoods(targetUserId) {
  const { data, error } = await supabase
    .from("profile_moods")
    .select("*")
    .eq("target_user_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return data;
}

async function fetchTodayMoodSummary(targetUserId) {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("profile_moods")
    .select("*")
    .eq("target_user_id", targetUserId)
    .eq("mood_date", today);

  if (error) throw error;

  const avg =
    data.length > 0
      ? data.reduce((s, m) => s + Number(m.mood_score), 0) / data.length
      : 0;

  const topMood = data[0]?.mood || "none";

  return {
    avgMoodScore: avg,
    totalEntries: data.length,
    topMood,
    entries: data,
  };
}

const MoodTab = ({ profile, currentUser }) => {
  const [selectedMood, setSelectedMood] = useState(null);
  const [reason, setReason] = useState("");
  const [tags, setTags] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [moods, setMoods] = useState([]);

  useEffect(() => {
    if (profile?.id) {
      fetchProfileMoods(profile.id).then(setMoods).catch(console.error);
    }
  }, [profile?.id]);

  const submitMood = async () => {
    if (!selectedMood || !profile?.id || !currentUser?.id) return;

    await submitProfileMood({
      targetUserId: profile.id,
      reviewerUserId: currentUser.id,
      mood: selectedMood,
      reason,
      tags,
      isAnonymous,
    });
await supabase.from("notifications").insert({
  user_id: profile.id,
  profile_id: currentUser.id,
  type: "mood_added",
  message: "Someone added a mood read for you today."
});
    const updated = await fetchProfileMoods(profile.id);
    setMoods(updated);

    setSelectedMood(null);
    setReason("");
    setTags([]);
  };

  return (
    <div className="space-y-4">
      <div className="bg-bondSurface border border-bondBorder rounded-2xl p-4">
        <h2 className="text-lg font-semibold mb-1">MOODS</h2>
        <p className="text-xs text-bondMuted mb-4">
          How did this person seem today?
        </p>

        <div className="grid grid-cols-2 gap-2">
          {MOODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedMood(m.key)}
              className={
                "rounded-xl border px-3 py-2 text-xs " +
                (selectedMood === m.key
                  ? "border-pink-400 bg-pink-500/20"
                  : "border-bondBorder bg-bondSurfaceSoft")
              }
            >
              <div className="text-lg">{m.emoji}</div>
              {m.label}
            </button>
          ))}
        </div>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why do you think so?"
          className="w-full mt-4 px-3 py-2 rounded-xl text-sm bg-bondSurfaceSoft border border-bondBorder"
        />

        <label className="flex items-center gap-2 mt-3 text-xs">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
          />
          Post anonymously
        </label>

        <Button primary className="w-full mt-4" onClick={submitMood}>
          Submit Mood
        </Button>
      </div>

      <div className="space-y-2">
        {moods.map((entry) => {
          const moodObj = MOODS.find((m) => m.key === entry.mood);

          return (
            <div
              key={entry.id}
              className="bg-bondSurfaceSoft border border-bondBorder rounded-xl p-3"
            >
              <div className="text-sm font-medium">
                {moodObj?.emoji} {moodObj?.label}
              </div>
              <p className="text-xs text-bondMuted mt-1">
                {entry.reason || "No reason added"}
              </p>
              <p className="text-[10px] text-bondMuted mt-2">
                {entry.is_anonymous ? "Anonymous" : "Visible"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
/* =====================================================
   MOOD HUB — full social perception layer
   Replaces direct MoodTab usage throughout the app
===================================================== */
function MoodHub({ currentUser }) {
  const [tab, setTab] = React.useState("mine");

  const TABS = [
    { id: "mine",      label: "My Reads" },
    { id: "drop",      label: "Drop Mood" },
    { id: "community", label: "Community" },
  ];

  return (
    <div style={{ padding: "0 16px 32px" }}>
      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 4, padding: "3px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        marginBottom: 16,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "8px 0", borderRadius: 11, fontSize: 12,
            fontWeight: tab === t.id ? 700 : 500,
            background: tab === t.id ? "rgba(248,113,113,0.18)" : "transparent",
            color: tab === t.id ? "#f87171" : "rgba(255,255,255,0.4)",
            border: tab === t.id ? "1px solid rgba(248,113,113,0.22)" : "1px solid transparent",
            cursor: "pointer", transition: "all 0.18s", fontFamily: "inherit",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "mine"      && <MyMoodReads   currentUser={currentUser} />}
      {tab === "drop"      && <DropMoodFlow  currentUser={currentUser} />}
      {tab === "community" && <CommunityMoodFeed />}
    </div>
  );
}

/* ── My Reads: what people sense about you today ── */
function MyMoodReads({ currentUser }) {
  const [moods, setMoods] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [summary, setSummary] = React.useState(null);

  React.useEffect(() => {
    if (!currentUser?.id) { setLoading(false); return; }
    let mounted = true;
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const [allRes, todayRes] = await Promise.all([
        window.supabaseClient
          .from("profile_moods")
          .select("*")
          .eq("target_user_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(30),
        window.supabaseClient
          .from("profile_moods")
          .select("*")
          .eq("target_user_id", currentUser.id)
          .gte("created_at", today + "T00:00:00"),
      ]);
      if (!mounted) return;
      const all = allRes.data || [];
      const todays = todayRes.data || [];
      setMoods(all);
      if (todays.length > 0) {
        const avg = todays.reduce((s, m) => s + Number(m.mood_score || 0), 0) / todays.length;
        const topMood = MOODS.find(m => m.key === todays[0]?.mood);
        setSummary({ avg: Math.round(avg * 10) / 10, count: todays.length, topMood });
      }
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [currentUser?.id]);

  const fmt = (ts) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(248,113,113,0.4)", fontSize: 13 }}>
      Loading your reads…
    </div>
  );

  return (
    <div>
      {/* Today's summary card */}
      {summary ? (
        <div style={{
          background: "rgba(248,113,113,0.07)",
          border: "1px solid rgba(248,113,113,0.18)",
          borderRadius: 18, padding: "16px 18px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Today · {summary.count} read{summary.count !== 1 ? "s" : ""}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 40 }}>{summary.topMood?.emoji || "🤔"}</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>
                {summary.topMood?.label || "Mixed vibes"}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
                avg mood score: {summary.avg > 0 ? "+" : ""}{summary.avg}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px dashed rgba(255,255,255,0.1)",
          borderRadius: 18, padding: "20px", textAlign: "center", marginBottom: 16,
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>👀</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            No mood reads today yet
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>
            Share your profile link to get reads from people
          </div>
        </div>
      )}

      {/* Feed */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
        Recent reads
      </div>

      {moods.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
          No reads yet — share your profile to get started
        </div>
      ) : moods.map(entry => {
        const moodObj = MOODS.find(m => m.key === entry.mood);
        return (
          <div key={entry.id} style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14, padding: "12px 14px", marginBottom: 8,
            display: "flex", gap: 12, alignItems: "flex-start",
          }}>
            <div style={{ fontSize: 24, flexShrink: 0 }}>{moodObj?.emoji || "🤔"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  {moodObj?.label || entry.mood}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                  {fmt(entry.created_at)}
                </div>
              </div>
              {entry.reason && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4, lineHeight: 1.5 }}>
                  "{entry.reason}"
                </div>
              )}
              {entry.reason_tags?.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  {entry.reason_tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 999,
                      background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}>{tag}</span>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>
                {entry.is_anonymous ? "👻 anonymous" : `@${entry.reviewer_username || "someone"}`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Drop Mood: search user → pick mood → submit ── */
function DropMoodFlow({ currentUser }) {
  const [search, setSearch]           = React.useState("");
  const [results, setResults]         = React.useState([]);
  const [searching, setSearching]     = React.useState(false);
  const [target, setTarget]           = React.useState(null);
  const [selectedMood, setSelectedMood] = React.useState(null);
  const [reason, setReason]           = React.useState("");
  const [tags, setTags]               = React.useState([]);
  const [isAnon, setIsAnon]           = React.useState(true);
  const [submitting, setSubmitting]   = React.useState(false);
  const [done, setDone]               = React.useState(false);

  React.useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await window.supabaseClient
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .ilike("username", `%${search}%`)
        .limit(6);
      setResults(data || []);
      setSearching(false);
    }, 320);
    return () => clearTimeout(t);
  }, [search]);

  const toggleTag = (tag) =>
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  async function submit() {
    if (!target || !selectedMood || !currentUser?.id) return;
    setSubmitting(true);
    try {
      const moodObj = MOODS.find(m => m.key === selectedMood);
      await window.supabaseClient.from("profile_moods").insert({
        target_user_id:   target.id,
        reviewer_user_id: currentUser.id,
        mood:             selectedMood,
        mood_score:       moodObj?.score ?? 0,
        reason:           reason.trim() || null,
        reason_tags:      tags,
        is_anonymous:     isAnon,
        reviewer_username: isAnon ? null : (currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "anon"),
      });
      await window.supabaseClient.from("notifications").insert({
        user_id:    target.id,
        profile_id: currentUser.id,
        type:       "mood_added",
        message:    isAnon
          ? "Someone dropped a mood read on you today."
          : `${currentUser.user_metadata?.username || "Someone"} dropped a mood read on you.`,
      });
      setDone(true);
    } catch (e) {
      console.error("[MoodHub] submit failed", e);
    }
    setSubmitting(false);
  }

  function reset() {
    setDone(false); setTarget(null); setSearch(""); setResults([]);
    setSelectedMood(null); setReason(""); setTags([]); setIsAnon(true);
  }

  /* ── Done state ── */
  if (done) return (
    <div style={{ textAlign: "center", padding: "48px 16px" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>✨</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
        Mood dropped on @{target?.username}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 24 }}>
        They'll feel it — {isAnon ? "anonymously" : "from you"}.
      </div>
      <button onClick={reset} style={{
        padding: "11px 28px", borderRadius: 14,
        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit",
      }}>
        Drop another
      </button>
    </div>
  );

  /* ── Target not yet selected ── */
  if (!target) return (
    <div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
        Who are you reading today?
      </div>
      <div style={{ position: "relative", marginBottom: 4 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by username…"
          style={{
            width: "100%", boxSizing: "border-box",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14, padding: "12px 16px", fontSize: 14, color: "#fff",
            outline: "none", fontFamily: "inherit",
          }}
        />
      </div>
      {searching && (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", padding: "8px 4px" }}>
          Searching…
        </div>
      )}
      {results.map(u => (
        <button key={u.id} onClick={() => { setTarget(u); setSearch(""); setResults([]); }}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", borderRadius: 12, marginBottom: 6,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "rgba(248,113,113,0.15)", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#f87171",
          }}>
            {(u.username || "?")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>@{u.username}</div>
            {u.display_name && u.display_name !== u.username && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{u.display_name}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  );

  /* ── Target selected — mood picker ── */
  return (
    <div>
      {/* Target header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14, padding: "12px 14px",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(248,113,113,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, color: "#f87171",
        }}>
          {(target.username || "?")[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>@{target.username}</div>
        </div>
        <button onClick={() => setTarget(null)} style={{
          background: "none", border: "none",
          color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18,
        }}>×</button>
      </div>

      {/* Mood grid */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
        How do they seem today?
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {MOODS.map(m => (
          <button key={m.key} onClick={() => setSelectedMood(m.key)} style={{
            padding: "10px 12px", borderRadius: 12, cursor: "pointer",
            background: selectedMood === m.key ? "rgba(248,113,113,0.18)" : "rgba(255,255,255,0.04)",
            border: selectedMood === m.key ? "1px solid rgba(248,113,113,0.4)" : "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit",
            transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 20 }}>{m.emoji}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: selectedMood === m.key ? "#fca5a5" : "rgba(255,255,255,0.6)" }}>
              {m.label}
            </span>
          </button>
        ))}
      </div>

      {/* Reason */}
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Why do you think so? (optional)"
        rows={2}
        style={{
          width: "100%", boxSizing: "border-box",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 12, padding: "10px 12px", fontSize: 13, color: "#fff",
          outline: "none", resize: "none", fontFamily: "inherit", marginBottom: 12,
        }}
      />

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {REASON_TAGS.map(tag => (
          <button key={tag} onClick={() => toggleTag(tag)} style={{
            padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            background: tags.includes(tag) ? "rgba(248,113,113,0.18)" : "rgba(255,255,255,0.05)",
            border: tags.includes(tag) ? "1px solid rgba(248,113,113,0.35)" : "1px solid rgba(255,255,255,0.09)",
            color: tags.includes(tag) ? "#fca5a5" : "rgba(255,255,255,0.45)",
          }}>
            {tag}
          </button>
        ))}
      </div>

      {/* Anon toggle */}
      <button onClick={() => setIsAnon(v => !v)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderRadius: 14, marginBottom: 16, cursor: "pointer",
        background: isAnon ? "rgba(251,191,36,0.06)" : "rgba(255,255,255,0.04)",
        border: isAnon ? "1px solid rgba(251,191,36,0.2)" : "1px solid rgba(255,255,255,0.09)",
        fontFamily: "inherit",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", textAlign: "left" }}>
            {isAnon ? "👻 Anonymous" : "🙋 Visible to them"}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "left", marginTop: 2 }}>
            {isAnon ? "They won't know it's you" : "Your username will show"}
          </div>
        </div>
        <div style={{
          width: 40, height: 22, borderRadius: 999,
          background: isAnon ? "#fbbf24" : "rgba(255,255,255,0.1)",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: 999, background: "#fff",
            position: "absolute", top: 2,
            left: isAnon ? 20 : 2, transition: "left 0.2s",
          }} />
        </div>
      </button>

      {/* Submit */}
      <button onClick={submit} disabled={!selectedMood || submitting} style={{
        width: "100%", padding: "14px", borderRadius: 16, border: "none",
        background: selectedMood ? "linear-gradient(135deg,#f87171,#fb923c)" : "rgba(255,255,255,0.07)",
        color: selectedMood ? "#fff" : "rgba(255,255,255,0.25)",
        fontSize: 14, fontWeight: 800, cursor: selectedMood ? "pointer" : "default",
        opacity: submitting ? 0.7 : 1, fontFamily: "inherit",
        boxShadow: selectedMood ? "0 8px 24px rgba(248,113,113,0.3)" : "none",
        transition: "all 0.2s",
      }}>
        {submitting ? "Dropping…" : "Drop Mood ✨"}
      </button>
    </div>
  );
}

/* ── Community: anonymized vibe pulse ── */
function CommunityMoodFeed() {
  const [entries, setEntries] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await window.supabaseClient
        .from("profile_moods")
        .select("id, mood, reason_tags, mood_score, created_at, is_anonymous")
        .order("created_at", { ascending: false })
        .limit(40);
      if (mounted) { setEntries(data || []); setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const fmt = (ts) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  // Mood score to bar color
  const scoreColor = (s) => {
    if (s >= 2) return "rgba(52,211,153,0.7)";
    if (s >= 1) return "rgba(96,165,250,0.7)";
    if (s === 0) return "rgba(251,191,36,0.7)";
    if (s >= -1) return "rgba(251,146,60,0.7)";
    return "rgba(248,113,113,0.7)";
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(248,113,113,0.4)", fontSize: 13 }}>
      Loading pulse…
    </div>
  );

  if (entries.length === 0) return (
    <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🌐</div>
      No mood drops yet — be the first
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 14, lineHeight: 1.6 }}>
        Anonymized pulse of how people are reading each other today.
      </div>
      {entries.map(entry => {
        const moodObj = MOODS.find(m => m.key === entry.mood);
        return (
          <div key={entry.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 14px", borderRadius: 12, marginBottom: 6,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{moodObj?.emoji || "🤔"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>
                {moodObj?.label || entry.mood}
              </div>
              {entry.reason_tags?.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  {entry.reason_tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: 10, padding: "1px 7px", borderRadius: 999,
                      background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)",
                    }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{
                width: 6, height: 6, borderRadius: 999,
                background: scoreColor(entry.mood_score),
              }} />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{fmt(entry.created_at)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getPartnerDP(role) {
try {
return localStorage.getItem(
role === "p1" ? "bond_dp_p1" : "bond_dp_p2"
);
} catch {
return null;
}
}

function setPartnerDP(role, base64) {
try {
localStorage.setItem(
role === "p1" ? "bond_dp_p1" : "bond_dp_p2",
base64
);
} catch {}
}


const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const remixQuestionText = (base, seedIndex = 0) => {
  const prefixes = [
    "",
    "Right now, ",
    "In the last few weeks, ",
    "If you’re honest, ",
    "From your gut, ",
  ];
  const suffixes = [
    "",
    " — most of the time.",
    " in this relationship.",
    " when you think about it calmly.",
    " compared to other connections.",
  ];
  const prefix = prefixes[seedIndex % prefixes.length];
  const suffix = suffixes[(seedIndex * 3) % suffixes.length];
  const trimmed = (base || "").trim().replace(/\s+/, " ");
  return `${prefix}${trimmed.replace(/[.?!]$/, "")}${suffix}`.trim();
};

const mapLevelKey = (key) => {
  switch (key) {
    case "level1":
      return "level1_v2";
    case "level2":
      return "level2_v2";
    case "level3":
      return "level3_v2";
    case "level4":
      return "level4_v2";
    case "level5":
      return "level5_v2";
    default:
      return "level1_v2";
  }
};

function getQuizVersion(levelKey, testCount = 0) {
  const key = mapLevelKey(levelKey || "level1");
  const base = QUIZ_LEVELS[key] || QUIZ_LEVELS.level1_v2;
  const seedOffset = (testCount || 0) * 17;

  const remixed = base.questions.map((q, idx) => ({
    ...q,
    text: remixQuestionText(q.text, seedOffset + idx),
  }));

  return {
    name: base.name,
    icon: base.icon,
    questions: shuffleArray(remixed),
  };
}

function startQuizSession(levelKey, testCount = 0) {
const base = QUIZ_LEVELS[mapLevelKey(levelKey)];

const questions = shuffleArray(
base.questions.map((q, idx) => ({
...q,
text: remixQuestionText(q.text, idx + testCount * 17),
}))
);

return {
id: crypto.randomUUID(),          // 🔑 force new session
feature: "couple_quiz",
levelKey,
questions,                        // ✅ shuffled per attempt
name: base.name,
icon: base.icon,
startedAt: Date.now(),
};
}


function getRelationshipTypeFromPercent(percent) {
  const p = percent || 0;
  if (p >= 80) {
    return {
      typeId: "secure-team",
      typeTitle: "Secure Team",
      typeDescription:
        "You’re not perfect, but the core is solid. There’s repair, shared humour, and a feeling of ‘we’re in this together’.",
    };
  }
  if (p >= 65) {
    return {
      typeId: "growing-bond",
      typeTitle: "Growing Bond",
      typeDescription:
        "There’s something real here and a lot that works. A few repeating patterns need attention.",
    };
  }
  if (p >= 50) {
    return {
      typeId: "fragile-chemistry",
      typeTitle: "Fragile Chemistry",
      typeDescription:
        "The pull is strong, but so are the wobbles. Boundaries and clearer conversations will matter a lot.",
    };
  }
  if (p >= 35) {
    return {
      typeId: "situationship-loop",
      typeTitle: "Situationship Loop",
      typeDescription:
        "More confusion than clarity right now. Unless behaviour changes, this may stay a ‘sometimes’ thing.",
    };
  }
  return {
    typeId: "unclear-data",
    typeTitle: "Unclear / Heavy Zone",
    typeDescription:
      "Something feels off or not built yet. You’re allowed to slow down and gather more data.",
  };
}

/* ---------- Solo health check scoring ---------- */
function calculateSoloScore(answers) {
  if (!answers || !answers.length) {
    return {
      score: 0,
      feedback:
        "No data yet. Run a Solo Health Check to see how your system is actually reading this bond.",
    };
  }
  const avg = answers.reduce((s, v) => s + v, 0) / answers.length; // 1–5
  const pct = Math.round(((avg - 1) / 4) * 100); // map 1–5 to 0–100

  let feedback;
  if (pct >= 80) {
    feedback =
      "Your body mostly reads this as stable, warm and good for you. Protect this softness with honest communication.";
  } else if (pct >= 65) {
    feedback =
      "Overall this feels more nourishing than heavy, with a few friction points that need attention instead of avoidance.";
  } else if (pct >= 50) {
    feedback =
      "There’s a real mix here — some warm moments, some tension. Your nervous system hasn’t fully decided if this is home or hazard.";
  } else if (pct >= 35) {
    feedback =
      "Your system feels tired or on guard quite often. Something about this bond may be demanding more than it’s giving.";
  } else {
    feedback =
      "Internally this feels pretty draining or unsafe. Take your own signals seriously, even if nothing dramatic has ‘happened’ yet.";
  }

  return { score: clamp(pct, 0, 100), feedback };
}

/* ---------- Couple quiz results + guess game ---------- */
function simulateResults(p1Answers, p2Answers) {
  const len = Math.min(p1Answers.length, p2Answers.length);
  if (!len) {
    return {
      bondScore: 0,
      compatibility: 0,
      emotionalSafety: 0,
      archetype: ARCHETYPES[4],
      prediction: "Not enough data yet.",
    };
  }

  let diffSum = 0;
  let safetySum = 0;
  for (let i = 0; i < len; i++) {
    const a = p1Answers[i].answer;
    const b = p2Answers[i].answer;
    diffSum += Math.abs(a - b);
    safetySum += Math.min(a, b);
  }

  const maxDiff = 4 * len;
  const compatibility = clamp(
    Math.round(100 - (diffSum / maxDiff) * 100),
    0,
    100
  );
  const emotionalSafety = clamp(
    Math.round(((safetySum / (5 * len)) || 0) * 100),
    0,
    100
  );
  const bondScore = Math.round((compatibility * 0.6 + emotionalSafety * 0.4) / 10) * 10;

  const relType = getRelationshipTypeFromPercent(compatibility);
  const archetype =
    ARCHETYPES.find((a) => a.id === relType.typeId) || ARCHETYPES[4];

  let prediction;
  if (bondScore >= 80) {
    prediction =
      "With care and honesty, this could be a long-term, very alive connection.";
  } else if (bondScore >= 60) {
    prediction =
      "There’s enough here to invest in, if both of you are willing to work on the friction points.";
  } else if (bondScore >= 45) {
    prediction =
      "This may be a meaningful chapter, but might not be your forever shape without major changes.";
  } else {
    prediction =
      "Treat this as important data about what does and doesn’t work for you, rather than a final verdict on love.";
  }

  return { bondScore, compatibility, emotionalSafety, archetype, prediction };
}

function computeJointResults(p1Answers, p2Guesses) {
  const total = Math.min(p1Answers.length, p2Guesses.length);
  if (!total) return { score: 0, correct: 0, total: 0 };
  let correct = 0;
  for (let i = 0; i < total; i++) {
    const a = (p1Answers[i] || "").trim().toLowerCase();
    const g = (p2Guesses[i] || "").trim().toLowerCase();
    if (a && g && a === g) correct++;
  }
  const score = Math.round((correct / total) * 100);
  return { score, correct, total };
}

/* -------------------------------------------------------
   UI PRIMITIVES: Icon, Button, Spinner, AnswerScale
-------------------------------------------------------- */
const Icon = ({ name, className = "" }) => {
  const base = "stroke-current";
  const cls = `${base} ${className || ""}`;
  switch (name) {
    case "heart":
      return React.createElement(
"svg",
{
viewBox: "0 0 24 24",
className: cls,
fill: "none"
},
React.createElement("path", {
d: "M12 21s-5-3.2-8-7C1.5 11.1 2 7.5 4.5 5.5 7 3.5 10 4.5 12 7c2-2.5 5-3.5 7.5-1.5C22 7.5 22.5 11.1 20 14c-3 3.8-8 7-8 7Z",
strokeWidth: "1.6"
})
);

    case "clock":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <circle cx="12" cy="12" r="8" strokeWidth="1.6" />
          <path d="M12 8v4l2 2" strokeWidth="1.6" />
        </svg>
      );
    case "alert-triangle":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M10.3 4.3 2.9 17.1A1.7 1.7 0 0 0 4.4 19.7h15.2a1.7 1.7 0 0 0 1.5-2.6L13.7 4.3a1.7 1.7 0 0 0-3.4 0Z"
            strokeWidth="1.6"
          />
          <path d="M12 9v4" strokeWidth="1.6" />
          <circle cx="12" cy="15.5" r="0.8" fill="currentColor" />
        </svg>
      );
    case "map":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z"
            strokeWidth="1.6"
          />
          <path d="M9 4v13M15 6.5v13" strokeWidth="1.6" />
        </svg>
      );
    case "flame":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M12 3s2.5 3 2.5 6.5S12 13 12 13s-2-1-2-4.5S12 3 12 3Z"
            strokeWidth="1.6"
          />
          <path
            d="M16.5 10.5C18 12 19 14 19 16a7 7 0 1 1-14 0c0-2 1-4 2.5-5.5"
            strokeWidth="1.6"
          />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <circle cx="9" cy="8" r="3" strokeWidth="1.6" />
          <path d="M4 19a5 5 0 0 1 10 0" strokeWidth="1.6" />
          <circle cx="17" cy="9" r="2.5" strokeWidth="1.6" />
          <path d="M15 19a4 4 0 0 1 7 0" strokeWidth="1.6" />
        </svg>
      );
    case "brain":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M9 4.5A3 3 0 0 0 3 6v4a3 3 0 0 0 3 3v2a3 3 0 0 0 6 0V5.5A3 3 0 0 0 9 4.5Z"
            strokeWidth="1.6"
          />
          <path
            d="M15 4.5A3 3 0 0 1 21 6v4a3 3 0 0 1-3 3v2a3 3 0 0 1-6 0V5.5A3 3 0 0 1 15 4.5Z"
            strokeWidth="1.6"
          />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="1.6" />
          <path d="M8 3v4M16 3v4M3 10h18" strokeWidth="1.6" />
        </svg>
      );
    case "puzzle":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M8 3h3a2 2 0 0 1 2 2v1.2a2.8 2.8 0 1 1 0 5.6V13a2 2 0 0 0 2 2h1.2a2.8 2.8 0 1 1 0 5.6H15a2 2 0 0 1-2-2v-1.2a2.8 2.8 0 1 0-5.6 0V19a2 2 0 0 1-2 2H3"
            strokeWidth="1.6"
          />
        </svg>
      );
    case "arrow-left":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path d="M5 12h14" strokeWidth="1.6" />
          <path d="M10 7 5 12l5 5" strokeWidth="1.6" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path d="M9 5l6 7-6 7" strokeWidth="1.6" />
        </svg>
      );
    case "chat":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M5 19.5 5.5 16A7 7 0 0 1 5 9.5 6.5 6.5 0 0 1 11.5 3h1A7.5 7.5 0 0 1 20 10.5 7.5 7.5 0 0 1 12.5 18H11l-4 1.5Z"
            strokeWidth="1.6"
          />
        </svg>
      );
    case "play":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path d="M9 7.5v9l7-4.5-7-4.5Z" strokeWidth="1.6" />
        </svg>
      );
    case "sparkles":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M5 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Zm13 2 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Zm-6 4 1.4 3.6L17 14l-3.6 1.4L12 19l-1.4-3.6L7 14l3.6-1.4L12 9Z"
            strokeWidth="1.6"
          />
        </svg>
      );
    case "map-pin":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path
            d="M12 21s6-6.2 6-11a6 6 0 0 0-12 0c0 4.8 6 11 6 11Z"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="10" r="2.4" strokeWidth="1.6" />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none">
          <path d="M5 13.5 9.5 18 19 6" strokeWidth="1.8" />
        </svg>
      );
case "atom":
case "verse":
return (
<svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
<circle cx="12" cy="12" r="2.5" />  {/* nucleus */}
<path d="M12 2c3.87 0 7 4.48 7 10s-3.13 10-7 10-7-4.48-7-10 3.13-10 7-10z" />  {/* vertical orbit */}
<path d="M4.6 7.5c1.83-1.06 4.8-1.5 7.4-1.5s5.57.44 7.4 1.5" />  {/* top orbit arc */}
<path d="M4.6 16.5c1.83 1.06 4.8 1.5 7.4 1.5s5.57-.44 7.4-1.5" />  {/* bottom orbit arc */}
</svg>
);
case "pulse":
case "solo":
return (
<svg viewBox="0 0 24 24" className={cls} fill="none"
   stroke="currentColor" strokeWidth="1.8"
   strokeLinecap="round" strokeLinejoin="round">
<path d="M3 12h3l2 4 3-8 2 4h6" />
<rect x="2" y="4" width="20" height="16" rx="4" ry="4" />
</svg>
);

    default:
      return null;
  }
};
const LetterAvatar = ({ name, size = 44, fontSize = 17, radius = "50%" }) => {
  const letter = (name || "?")[0].toUpperCase();
  const gradients = [
    "linear-gradient(135deg,#f87171,#fb923c)",
    "linear-gradient(135deg,#818cf8,#6366f1)",
    "linear-gradient(135deg,#34d399,#10b981)",
    "linear-gradient(135deg,#fbbf24,#f59e0b)",
    "linear-gradient(135deg,#f9a8d4,#f472b6)",
  ];
  const grad = gradients[letter.charCodeAt(0) % gradients.length];
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: radius,
      background: grad,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 800,
      fontSize,
      color: "#fff",
    }}>
      {letter}
    </div>
  );
};
const Button = ({
  children,
  primary = false,
  className = "",
  icon,
  ...rest
}) => {
  const base =
    "inline-flex items-center justify-center px-3 py-2 rounded-xl text-xs font-semibold hover-pulse focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-bondAccent/60 disabled:opacity-50 disabled:cursor-not-allowed";
  const primaryClasses =
    "bg-blue-600 text-white shadow-sm hover:bg-blue-700 text-bondBg shadow-md hover:shadow-xl";
  const secondaryClasses =
    "bg-bondSurfaceSoft text-bondText border border-bondBorder hover:border-blue-400/40";
  const finalClass =
    base + " " + (primary ? primaryClasses : secondaryClasses) + " " + className;
  return (
    <button className={finalClass} {...rest}>
      {icon && <Icon name={icon} className="w-3.5 h-3.5 mr-1.5" />}
      {children}
    </button>
  );
};

const Spinner = ({ className = "" }) => (
  <div
    className={
      "w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin " +
      className
    }
  />
);

const AnswerScale = ({ onChange }) => {
  const labels = ["Not at all", "A bit", "Somewhat", "Mostly", "Very true"];
  return (
    <div className="flex flex-col space-y-2">
      <div className="flex justify-between text-[10px] text-bondMuted">
        <span>Not true</span>
        <span>Very true</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {labels.map((label, idx) => {
          const val = idx + 1;
          return (
            <button
              key={val}
              onClick={() => onChange && onChange(val)}
              className="text-[10px] py-2 rounded-xl border border-bondBorder bg-bondSurfaceSoft hover:bg-blue-500/10 hover:border-blue-400/40 transition-all card-hover"
            >
              {val}
              <div className="mt-0.5 text-[9px] opacity-70">{label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
/* -------------------------------------------------------
   ERROR BOUNDARY
-------------------------------------------------------- */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    console.error("Bond OS error boundary:", error);
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Bond OS error details:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6">
          <p className="text-sm font-semibold mb-2">
          Retry after sometime !
          </p>
          <p className="text-[11px] text-bondMuted mb-4">
            Try refreshing the page. Your progress is saved locally to this
            device.
          </p>
          <Button
            primary
            onClick={() => {
              window.location.reload();
            }}
          >
            Refresh
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* -------------------------------------------------------
RELATIONSHIP STATE HOOK (localStorage persistence)
-------------------------------------------------------- */
const useRelationshipState = (userKey) => {
const [data, setData] = useState(INITIAL_DATA);
const [loaded, setLoaded] = useState(false);

useEffect(() => {
if (!userKey) {
setData(INITIAL_DATA);
setLoaded(true);
return;
}

try {
const storageKey = STORAGE_PREFIX + userKey;
const raw = localStorage.getItem(storageKey);

if (raw) {
  const parsed = JSON.parse(raw);
  setData({ ...INITIAL_DATA, ...parsed });
} else {
  setData(INITIAL_DATA);
}
} catch (e) {
console.warn("Failed to load Bond OS state", e);
setData(INITIAL_DATA);
} finally {
setLoaded(true);
}
}, [userKey]);

const save = useCallback(
(updates) => {
setData((prev) => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  let streakDays = prev.streakDays || 0;
  const last = prev.lastActiveDate;

  if (last !== today) {
    if (last) {
      const diffDays = Math.floor(
        (now - new Date(last)) / (1000 * 60 * 60 * 24)
      );
      streakDays = diffDays === 1 ? streakDays + 1 : 1;
    } else {
      streakDays = 1;
    }
  }

  const next = {
    ...prev,
    ...updates,
    streakDays,
    lastActiveDate: today,
  };

  try {
    if (userKey) {
      const storageKey = STORAGE_PREFIX + userKey;
      localStorage.setItem(storageKey, JSON.stringify(next));
    }
  } catch (e) {
    console.warn("Failed to save Bond OS state", e);
  }

  return next;
});
},
[userKey]
);

const isNamesSet = Boolean((data.p1Name || "").trim());

return { data, save, loaded, isNamesSet };
};

/* -------------------------------------------------------
SIMPLE HELPER TO OPEN BOND COACH WITH A PROMPT
-------------------------------------------------------- */
const openCoachFromReact = (prompt) => {
try {
if (typeof toggleBondCoach === "function") {
toggleBondCoach();
}
function toggleCoachSize() {
const panel = document.getElementById("bondCoachPanel");
if (!panel) return;

isCoachMaximized = !isCoachMaximized;

panel.classList.toggle("bond-coach-max", isCoachMaximized);
}

const input = document.getElementById("coachInput");
if (input) {
input.value = prompt;
input.focus();
}
} catch (e) {
console.warn("Could not open Bond Coach from React", e);
}
};

/* -------------------------------------------------------
ONBOARDING – NAME INPUT (SOLO + PARTNER)
-------------------------------------------------------- */
// 🔹 Reusable BondOS Logo (same as login)
const BondLogo = () => {
return (
<div className="text-center">
<h1 className="text-4xl font-bold tracking-tight">
  <span className="text-bondAccent">Bond.O.S </span>
</h1>
</div>
);
};

const NameInputScreen = ({ save }) => {
const [partners, setPartners] = useState(["", ""]);
const [error, setError] = useState("");

const handleChange = (index, value) => {
setPartners((prev) => {
const next = [...prev];
next[index] = value;
return next;
});
};

const addPartner = () => {
setPartners((prev) => [...prev, ""]);
};

const validateName = (value) => {
const trimmed = (value || "").trim();
if (trimmed.length < 2) return false;
return /^[A-Za-z .'-]+$/.test(trimmed);
};

const canSave = validateName(partners[0]);
const submit = async () => {
  if (!canSave) {
    setError("Use at least 2 letters for your name.");
    return;
  }

  const cleaned = partners.map((p) => p.trim()).filter(Boolean);
  const [p1Name, maybeP2, ...extra] = cleaned;

  const username = p1Name.toLowerCase().replace(/\s+/g, "");

  const success = await saveProfileToDB({
    username,
    display_name: p1Name,
  });

  if (!success) {
    console.error("Profile save failed");
    setError("Could not save your profile. Please try again.");
    return;
  }

  saveGuestProfile(p1Name);

  save({
    p1Name,
    p2Name: maybeP2 || "",
    extraPartners: extra,
    quizState: "menu",
  });
};

<div className="mb-8 relative z-10">
  <h1 className="text-3xl font-extrabold tracking-tight">
    <span className="inline-block mx-1 text-bondAccent">Bond.O.S</span>
  </h1>
  <p className="text-xs text-bondMuted mt-2">
    Add just <span className="font-semibold">yourself</span> for solo mode,
    or add a partner too.
  </p>
</div>

<div className="flex-1 flex flex-col justify-center space-y-6 relative z-10">
  {partners.map((name, idx) => (
    <div key={idx} className="card-hover p-1 rounded-2xl">
      <label className="text-[11px] text-bondMuted block mb-1">
        {idx === 0
          ? "You"
          : idx === 1
          ? "Partner (optional)"
          : `Partner ${idx + 1} (optional)`}
      </label>
      <input
        className="w-full px-3 py-2 rounded-xl text-sm bg-bondSurface border border-bondBorder outline-none focus:ring-2 focus:ring-bondAccent/40"
        value={name}
        onChange={(e) => handleChange(idx, e.target.value)}
      />
    </div>
  ))}

  {error && <p className="text-[11px] text-bondDanger">{error}</p>}

  <div className="mt-4 flex items-center justify-between">
    <Button
      className="text-xs px-4"
      onClick={addPartner}
      icon="users"
    >
      Add partner
    </Button>

    <button
      onClick={submit}
      disabled={!canSave}
      className={
        "ml-4 flex items-center justify-center text-2xl rounded-full w-11 h-11 border border-bondBorder bg-bondSurfaceSoft transition-colors " +
        (!canSave ? "opacity-40 cursor-not-allowed" : "")
      }
    >
      ➜
    </button>
  </div>
</div>
</div>
);
};
/* -------------------------------------------------------
SOLO HEALTH CHECK – PRIVATE SELF READ
-------------------------------------------------------- */
/* -------------------------------------------------------
SOLO HEALTH CHECK – PRIVATE SELF READ
-------------------------------------------------------- */
const SoloTestHub = ({ data, save }) => {

// 🔑 USE SESSION QUESTIONS ONLY
const QUESTIONS = data.soloSessionQuestions;

if (!QUESTIONS || !QUESTIONS.length) {
return (
<div className="p-6 text-center text-bondMuted">
Start a session to begin.
</div>
);
}

const answers = data.soloAnswers || [];
const idx = answers.length;
const showResults =
data.soloState === "results" || idx >= QUESTIONS.length;

/* ---------- TRACE OPEN ---------- */
React.useEffect(() => {
if (data.soloState === "intro") {
traceAction("feature_opened", {
  feature: "solo_health",
});
}
}, [data.soloState]);

/* ---------- SCORE LOGIC ---------- */
const calculateScore = (arr) => {
if (!arr.length) return { score: 0, note: "" };

const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
const percent = Math.round(avg * 20);

let note =
percent >= 80
  ? "The internal experience of this bond feels mostly safe, supportive, and nourishing."
  : percent >= 60
  ? "Some parts feel good, some feel draining. Awareness and small shifts can help a lot."
  : percent >= 40
  ? "There’s emotional friction here. Something important inside you wants attention."
  : "Your nervous system feels strained. This deserves care, boundaries, or deeper reflection.";

return { score: percent, note };
};

/* ---------- TRACE COMPLETION ---------- */
React.useEffect(() => {
if (!showResults) return;

const { score } = calculateScore(answers);

traceAction("feature_completed", {
feature: "solo_health",
score,
});

traceAction("quiz_completed", {
quizType: "solo_health",
});
}, [showResults]);

/* ---------- INTRO ---------- */
if (data.soloState === "intro") {
return (
<div className="p-6 h-full flex flex-col justify-center text-center">
  <Icon name="user" className="w-12 h-12 text-bondAccent mx-auto mb-4" />

  <h2 className="text-xl font-bold mb-2">
    Solo Health Check
  </h2>

  <p className="text-xs text-bondMuted mb-6 max-w-xs mx-auto">
    Answer privately from your nervous system’s point of view.
    This reads how the relationship feels inside you.
  </p>
    

  <Button
    className="mt-3 text-[11px]"
    onClick={() =>
      save({
        quizState: "menu",
        soloState: "intro",
      })
    }
  >
    Back
  </Button>
</div>
);
}

/* ---------- RESULTS ---------- */
if (showResults) {
const { score, note } = calculateScore(answers);

const askAI = () => {
traceAction("ai_coach_opened", {
  context: "solo_health_results",
});

openCoachFromReact(
  `I just completed the Solo Health Check inside Bond OS.

Score: ${score}%

Internal note:
"${note}"

Help me understand what this says about my relationship patterns.
Give me 3–5 very specific next steps I can take to improve the internal vibe.`
);
};

return (
<div className="p-6 h-full flex flex-col justify-center text-center">
  <h2 className="text-[40px] font-black mb-1">
    {score}%
  </h2>

  <p className="text-[10px] uppercase tracking-[0.2em] text-bondMuted mb-4">
    Internal Check-In
  </p>

  <div className="bg-bondSurfaceSoft border border-bondBorder rounded-2xl p-5 mb-4 text-left card-hover">
    <p className="text-xs">
      {note}
    </p>
  </div>

  <div className="flex flex-col space-y-2">
    <Button primary icon="chat" onClick={askAI}>
      Ask AI Coach how to improve this
    </Button>

    <Button
      onClick={() =>
        save({
quizState: "menu",
soloState: "intro",
soloSessionId: null,
soloSessionQuestions: null,
soloAnswers: [],
})

      }
    >
      Done
    </Button>
  </div>
</div>
);
}

/* ---------- QUESTION FLOW ---------- */
const handleAnswer = (val) => {
traceAction("question_answered", {
quizType: "solo_health",
questionIndex: idx,
});

const next = [...answers, val];

save({
soloAnswers: next,
soloState:
  next.length >= QUESTIONS.length ? "results" : "quiz",
});
};

return (
<div className="p-6 h-full flex flex-col justify-center">
<div className="flex items-center justify-between mb-2">
  <button
    className="text-[11px] text-bondMuted flex items-center"
    onClick={() =>
      save({
        soloState: "intro",
        soloAnswers: [],
      })
    }
  >
    <Icon name="arrow-left" className="w-4 h-4 mr-1" />
    Back
  </button>

  <span className="text-[11px] text-bondMuted font-semibold">
    {idx + 1}/{QUESTIONS.length}
  </span>
</div>

<p className="text-[11px] text-bondMuted mb-1">
  Solo Health Check
</p>

<h2 className="text-lg font-semibold mb-5 leading-snug">
  {QUESTIONS[idx].text ?? QUESTIONS[idx]}
</h2>

<AnswerScale onChange={handleAnswer} />
</div>
);
};
const IdealMatchHub = ({ data, save }) => {

function answerIdealQuestion(questionId, value) {
save((d) => {
const updated = {
  ...d.idealAnswers,
  [questionId]: value
};

return {
  ...d,
  idealAnswers: updated,
  idealScore: calculateIdealMatchScore(updated)
};
});
}

return (
<div className="p-4 space-y-6">
<h2 className="text-xl font-semibold">Ideal Match Meter</h2>

{IDEAL_QUESTIONS.map((q) => (
  <div key={q.id} className="space-y-2">
    <p className="text-sm">{q.text}</p>

    <div className="flex gap-2">
      {[1,2,3,4,5].map(v => (
        <button
          key={v}
          onClick={() => answerIdealQuestion(q.id, v)}
          className="px-2 py-1 border rounded"
        >
          {v}
        </button>
      ))}
    </div>
  </div>
))}

{data.idealScore !== null && (
  <div className="mt-6">
    <p className="text-sm mb-1">
      Ideal Match Score: {data.idealScore}%
    </p>
    <div className="w-full h-2 bg-gray-700 rounded">
      <div
        className="h-2 bg-green-400 rounded"
        style={{ width: `${data.idealScore}%` }}
      />
    </div>
  </div>
)}
</div>
);
};


/* -------------------------------------------------------
FLAG CHECK – SAFETY / GREEN–GREY–RED PATTERNS
-------------------------------------------------------- */
const FlagCheckHub = ({ data, save }) => {

/* ---------- SESSION QUESTIONS (REQUIRED) ---------- */
const QUESTIONS = data.flagSessionQuestions;

if (!QUESTIONS || !QUESTIONS.length) {
return (
<div className="p-6 text-center text-bondMuted">
  Missing flag session questions.
</div>
);
}

const answers = data.flagAnswers || [];
const idx = answers.length;
const showResults =
data.flagState === "results" || idx >= QUESTIONS.length;

/* ---------- TRACE OPEN ---------- */
React.useEffect(() => {
if (data.flagState === "quiz") {
traceAction("feature_opened", {
  feature: "flag_check",
});
}
}, [data.flagState]);

/* ---------- SUMMARY LOGIC ---------- */
const computeSummary = (arr) => {
const avg =
arr && arr.length
  ? arr.reduce((s, v) => s + v, 0) / arr.length
  : 3;

if (avg >= 4.2)
return {
  label: "Mostly Green Flags",
  risk: "low",
  note:
    "The patterns here look healthy and safe. Stay observant, but this connection shows consistency.",
};

if (avg >= 3.4)
return {
  label: "Mixed but Manageable",
  risk: "medium",
  note:
    "Some things feel good, some need clarity. How they respond to honest conversations matters a lot here.",
};

if (avg >= 2.6)
return {
  label: "Orange Zone",
  risk: "high",
  note:
    "Multiple tension points exist. Slowing down and setting firmer boundaries is important.",
};

return {
label: "Heavy Red Flags",
risk: "very_high",
note:
  "The patterns here feel unsafe or draining. Protect yourself and consider external support.",
};
};

/* ---------- TRACE COMPLETION ---------- */
React.useEffect(() => {
if (!showResults) return;

const summary = computeSummary(answers);

traceAction("feature_completed", {
feature: "flag_check",
risk: summary.risk,
avgScore: Math.round(
  (answers.reduce((s, v) => s + v, 0) / answers.length) * 20
),
});
}, [showResults]);

/* ---------- RESULTS ---------- */
if (showResults) {
const summary = computeSummary(answers);

const askAI = () => {
traceAction("ai_coach_opened", {
  context: "flag_check_results",
});

openCoachFromReact(
  `I just completed the Flag Check inside Bond OS.

Result: ${summary.label}
Risk level: ${summary.risk}

Note:
"${summary.note}"

Help me interpret these patterns clearly.
Tell me:
• What to take seriously
• What may improve with communication
• What boundaries or next steps matter most`
);
};

return (
<div className="p-6 h-full flex flex-col justify-center text-center">
  <h2 className="text-2xl font-bold mb-2">
    {summary.label}
  </h2>

  <p className="text-xs text-bondMuted mb-6 max-w-xs mx-auto">
    {summary.note}
  </p>

  <div className="flex flex-col space-y-2">
    <Button primary icon="chat" onClick={askAI}>
      Ask AI Coach about this
    </Button>

    <Button
      onClick={() =>
        save({
          quizState: "menu",
          flagState: "intro",
          flagAnswers: [],
          flagSessionQuestions: null,
        })
      }
    >
      Done
    </Button>
  </div>
</div>
);
}

/* ---------- QUESTION FLOW ---------- */
const handleAnswer = (val) => {
traceAction("question_answered", {
quizType: "flag_check",
questionIndex: idx,
});

const next = [...answers, val];

save({
flagAnswers: next,
flagState:
  next.length >= QUESTIONS.length ? "results" : "quiz",
});
};

return (
<div className="p-6 h-full flex flex-col justify-center">
<div className="flex items-center justify-between mb-2">
  <button
    className="text-[11px] text-bondMuted flex items-center"
    onClick={() =>
      save({
        quizState: "menu",
        flagState: "intro",
        flagAnswers: [],
        flagSessionQuestions: null,
      })
    }
  >
    <Icon name="arrow-left" className="w-4 h-4 mr-1" />
    Back
  </button>

  <span className="text-[11px] text-bondMuted font-semibold">
    {idx + 1}/{QUESTIONS.length}
  </span>
</div>

<p className="text-[11px] text-bondMuted mb-1">
  Flag Check
</p>

<h2 className="text-lg font-semibold mb-5 leading-snug">
  {QUESTIONS[idx].text ?? QUESTIONS[idx]}
</h2>

<AnswerScale onChange={handleAnswer} />
</div>
);
};
function calculateIdealMatchScore(answers) {
  // Accepts either an array [1,2,5,3...] or an object { q1: 3, q2: 5 ... }
  let vals = [];
  if (Array.isArray(answers)) {
    vals = answers.filter(v => typeof v === "number" && v > 0);
  } else if (answers && typeof answers === "object") {
    vals = Object.values(answers).filter(v => typeof v === "number" && v > 0);
  }
  if (vals.length === 0) return null;
  const total = vals.reduce((s, v) => s + v, 0);
  const max = vals.length * 5;
  return Math.round((total / max) * 100);
}
function computeIdealResult(answers) {
// 🔒 HARD GUARD — prevents this crash forever
if (!Array.isArray(answers)) {
console.error("computeIdealResult received non-array:", answers);
answers = [];
}

if (answers.length === 0) {
return {
rarity: 0,
tone: "Undetermined",
};
}

const total = answers.reduce((sum, v) => sum + Number(v || 0), 0);
const max = answers.length * 5;

const rarity = Math.round((total / max) * 100);

let tone = "Flexible";
if (rarity >= 80) tone = "Highly Selective";
else if (rarity >= 60) tone = "Selective";
else if (rarity >= 40) tone = "Balanced";

return { rarity, tone };
}

const IdealMatchMeterHub = ({ data, save }) => {

/* =====================================================
LEVEL SELECT (DEFAULT ENTRY)
====================================================== */

if (!data.idealState || data.idealState === "level_select") {
return (
<AppShell
  title="Ideal Match Meter"
  onBack={() =>
    save({
      quizState: "home",
      idealState: null,
      idealLevel: null,
      idealIndex: 0,
      idealAnswers: [],
      idealQuestions: [],
      idealResult: null,
    })
  }
>
  <div className="space-y-3">
    {IDEAL_LEVELS.map((lvl, idx) => {
      const questions = IDEAL_QUESTION_LEVELS[lvl.key] || [];

      return (
        <LevelCard
          key={lvl.key}
          level={idx + 1}
          label={lvl.label}
          subtitle={lvl.description}
          time={`${questions.length} questions`}
          note={lvl.note}
          onClick={() =>
            save({
              idealState: "quiz",
              idealLevel: lvl.key,
              idealIndex: 0,
              idealAnswers: [],
              idealQuestions: questions,
            })
          }
        />
      );
    })}
  </div>
</AppShell>
);
}

/* =====================================================
ACTIVE QUIZ
====================================================== */

if (data.idealState === "quiz") {
const questions = data.idealQuestions || [];
const idx = Number(data.idealIndex) || 0;
const q = questions[idx];

/* ---------- LEVEL COMPLETE ---------- */
if (!q) {
const result = computeIdealResult(data.idealAnswers || []);

return (
  <div className="p-6 h-full flex flex-col justify-center text-center">
    <h2 className="text-xl font-semibold mb-2">Level Complete</h2>

    <p className="text-xs text-bondMuted mb-4">
      You completed{" "}
      <b>{IDEAL_LEVELS.find(l => l.key === data.idealLevel)?.label}</b>
    </p>

    <Button
      primary
      onClick={() =>
        save({
          idealState: "results",
          idealResult: result,
        })
      }
    >
      See Results
    </Button>
  </div>
);
}

/* ---------- QUESTION ---------- */
return (
<div className="p-6 h-full flex flex-col justify-center">
  <p className="text-[11px] text-bondMuted mb-1">
    {IDEAL_LEVELS.find(l => l.key === data.idealLevel)?.label}
  </p>

  <h2 className="text-lg font-semibold mb-4">{q.text}</h2>
<AnswerScale
onChange={(value) => {
const updated = [...(data.idealAnswers || []), value];

save({
idealAnswers: updated,
idealIndex: idx + 1,
idealScore: calculateIdealMatchScore(updated), // ✅ ADD THIS
});
}}
/>


</div>
);
}

/* =====================================================
RESULTS
====================================================== */

if (data.idealState === "results") {
const res = data.idealResult;

return (
<div className="p-6 h-full flex flex-col justify-center text-center">
  <h2 className="text-2xl font-bold mb-1">
    Your Ideal Match Profile
  </h2>

  <p className="text-xs text-bondMuted mb-5">
    How selective your preferences are
  </p>

  <div className="bg-bondSurface border border-bondBorder rounded-2xl p-5 mb-4">
    <p className="text-4xl font-extrabold mb-1">
      {res.rarity}%
    </p>
    <p className="text-xs text-bondMuted mb-2">
      Selectiveness score
    </p>
    <p className="text-sm">
      You are <b>{res.tone}</b>
    </p>
  </div>

  <p className="text-xs text-bondMuted mb-4 max-w-xs mx-auto">
    This reflects how narrow or broad your preferences are —
    not how “picky” you should be.
  </p>

  <div className="space-y-2">
    <Button
      primary
      onClick={() =>
        openCoachFromReact(
          `My Ideal Match Meter results:
Selectiveness: ${res.rarity}%
Tone: ${res.tone}

Based on where I live, how realistic is it to meet someone like this?
What should I optimize — expectations, environment, or behavior?`
        )
      }
    >
      Ask AI to interpret this
    </Button>

    <Button
      onClick={() =>
        save({
          idealState: "level_select",
          idealLevel: null,
          idealIndex: 0,
          idealAnswers: [],
          idealQuestions: [],
          idealScore: null,
        })
      }
    >
      Done
    </Button>
  </div>
</div>
);
}

return null;
};
const FeedHub = ({ data, save, setActiveProfile, setScreen }) => {
  const [feedProfiles, setFeedProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        setLoading(true);

        const { data, error } = await window.supabaseClient
          .from("profiles")
          .select("id, username, bio, reviews_count")
          .eq("is_public", true)
          .order("reviews_count", { ascending: false })
          .limit(20);

        if (error) throw error;

        setFeedProfiles(data || []);
      } catch (err) {
        console.error("Feed error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center mt-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <h2 className="text-xl font-semibold mb-4">People</h2>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pb-24">
        {feedProfiles.map((p) => (
          <div
            key={p.id}
            onClick={() => {
              setActiveProfile?.(p);
              setScreen?.("profile");
            }}
            className="bg-bondSurface border border-bondBorder rounded-2xl p-4 cursor-pointer hover:border-blue-400/40 transition"
          >
            <div className="flex items-center gap-3">
              <LetterAvatar
  name={p.username}
  size={40}
  fontSize={15}
  radius="50%"
/>
              <div>
                <div className="font-medium">{p.username}</div>
                <div className="text-xs opacity-60">
                  {p.reviews_count || 0} reviews
                </div>
              </div>
            </div>

            {p.bio && (
              <p className="text-sm opacity-70 mt-2">{p.bio}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
/* -------------------------------------------------------
PROFILE RADAR – SCAN & SCORE REAL PEOPLE
-------------------------------------------------------- */
const ProfileRadarHub = ({ data, save }) => {
const profiles = data.profileRadarProfiles || [];

const [name, setName] = React.useState("");
const [source, setSource] = React.useState("");
const [bio, setBio] = React.useState("");
const [error, setError] = React.useState("");

/* ---------- TRACE OPEN ---------- */
React.useEffect(() => {
traceAction("feature_opened", {
feature: "profile_radar",
});
}, []);

/* ---------- MATCH SCORE ---------- */
const computeMatchScore = (idealAnswers, text) => {
const avgIdeal =
idealAnswers && idealAnswers.length
  ? idealAnswers.reduce((s, v) => s + v, 0) / idealAnswers.length
  : 3;

const lengthBoost = Math.min(text.length / 300, 1); // 0–1
const rawScore = 50 + (avgIdeal - 3) * 10 + lengthBoost * 20;

return clamp(Math.round(rawScore), 25, 96);
};

/* ---------- ADD PROFILE ---------- */
const addProfile = () => {
if (!name.trim() || !bio.trim()) {
setError("Name and profile text are required.");
return;
}

const matchScore = computeMatchScore(
data.idealAnswers || [],
bio
);

traceAction("profile_added", {
feature: "profile_radar",
matchScore,
});

save({
profileRadarProfiles: [
  ...profiles,
  {
    id: Date.now(),
    name: name.trim(),
    source: source.trim(),
    bio: bio.trim(),
    matchScore,
  },
],
});

setName("");
setSource("");
setBio("");
setError("");
};

/* ---------- AI ANALYZE ---------- */
const askAI = (p) => {
traceAction("ai_coach_opened", {
context: "profile_radar",
});

openCoachFromReact(
`I scanned a real person using Bond OS Profile Radar.

Name: ${p.name}
Source: ${p.source || "Unknown"}
Match Score: ${p.matchScore}%

Profile text:
"${p.bio}"

Use my Ideal Match answers and all Bond OS data.
Tell me:
• Why this score makes sense
• Hidden green / red flags
• Whether I should invest time or step back`
);
};

return (
<div className="p-6 h-full flex flex-col overflow-y-auto custom-scroll">
{/* HEADER */}
<div className="mb-4">
  <h2 className="text-2xl font-bold">Profile Radar</h2>
  <p className="text-xs text-bondMuted mt-1">
    Scan real people. Reduce delusion. Trust patterns.
  </p>
</div>

{/* ADD FORM */}
<div className="bg-bondSurfaceSoft border border-bondBorder rounded-2xl p-4 mb-4 card-hover">
  <p className="text-[10px] uppercase tracking-[0.2em] text-bondMuted mb-2">
    Add Profile
  </p>

  <input
    className="w-full mb-2 px-3 py-2 rounded-xl text-sm bg-bondSurface border border-bondBorder"
    placeholder="Name (or nickname)"
    value={name}
    onChange={(e) => setName(e.target.value)}
  />

  <input
    className="w-full mb-2 px-3 py-2 rounded-xl text-sm bg-bondSurface border border-bondBorder"
    placeholder="Source (Dating app, Instagram, College, etc.)"
    value={source}
    onChange={(e) => setSource(e.target.value)}
  />

  <textarea
    className="w-full mb-2 px-3 py-2 rounded-xl text-sm bg-bondSurface border border-bondBorder h-24"
    placeholder="Paste bio, chats, prompts, or your observations"
    value={bio}
    onChange={(e) => setBio(e.target.value)}
  />

  {error && (
    <p className="text-[11px] text-bondDanger mb-2">
      {error}
    </p>
  )}

  <Button primary icon="plus" onClick={addProfile}>
    Add to Radar
  </Button>
</div>

{/* PROFILES LIST */}
{profiles.length > 0 && (
  <div className="space-y-3 mb-6">
    {profiles.map((p) => (
      <div
        key={p.id}
        className="bg-bondSurface border border-bondBorder rounded-2xl p-4 card-hover"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-sm">{p.name}</h3>
          <span className="text-xs font-bold">
            {p.matchScore}%
          </span>
        </div>

        {p.source && (
          <p className="text-[10px] text-bondMuted mb-1">
            {p.source}
          </p>
        )}

        <p className="text-xs text-bondMuted mb-3 line-clamp-3">
          {p.bio}
        </p>

        <Button
          className="text-xs"
          icon="chat"
          onClick={() => askAI(p)}
        >
          Analyze with AI
        </Button>
      </div>
    ))}
  </div>
)}

{/* FOOTER ACTION */}
<Button
  icon="arrow-left"
  onClick={() =>
    save({
      quizState: "menu",
    })
  }
>
  Back
</Button>
</div>
);
};

/* -------------------------------------------------------
COUPLE QUIZ – QUESTION DECORATION HELPERS
-------------------------------------------------------- */

const QUIZ_PREFIXES = [
"From your gut: ",
"Right now, how true is this: ",
"Without overthinking: ",
"As things have felt lately: ",
"Honestly speaking: ",
];

const QUIZ_SUFFIXES = [
" (first instinct only).",
" (no sugarcoating).",
" (think about the last 2–3 weeks).",
" (answer how it actually feels).",
" (be honest even if it’s messy).",
];

function decorateQuestionsOnce(questions, testCount = 0) {
let seed = (testCount || 0) * 997 + questions.length * 13;

const rand = () => {
seed = (seed * 9301 + 49297) % 233280;
return seed / 233280;
};

return questions.map((q) => {
const prefix =
QUIZ_PREFIXES[Math.floor(rand() * QUIZ_PREFIXES.length)];
const suffix =
QUIZ_SUFFIXES[Math.floor(rand() * QUIZ_SUFFIXES.length)];

return {
...q,
text: `${prefix}${q.text}${suffix}`,
};
});
}

/* -------------------------------------------------------
COUPLE QUIZ – QUIZ SCREEN (P1 + P2)
-------------------------------------------------------- */

const QuizScreen = ({ data, save }) => {

/* ---------- SESSION GUARD ---------- */
const session = data.quizSession;
const rawQuestions = session?.questions;

if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
return (
<div className="p-6 text-center text-bondMuted">
  Missing quiz session questions.
</div>
);
}

/* ---------- DECORATE ONCE PER ATTEMPT ---------- */
const QUESTIONS = React.useMemo(
() => decorateQuestionsOnce(rawQuestions, data.testCount),
[rawQuestions, data.testCount]
);

const isP1 = data.quizState === "p1_quiz";
const answers = isP1 ? data.p1Answers || [] : data.p2Answers || [];
const qIdx = answers.length;

const totalQuestions = Math.min(10, QUESTIONS.length);

/* ---------- AUTO-FINISH ---------- */
React.useEffect(() => {
if (data.quizState !== "loading") return;

const results = simulateResults(
data.p1Answers || [],
data.p2Answers || []
);

traceAction("quiz_completed", {
quizType: "couple_quiz",
totalQuestions,
});

save({
results,
quizState: "results",
testCount: (data.testCount || 0) + 1,
});
}, [data.quizState]);

if (qIdx >= totalQuestions) {
return (
<div className="p-6 text-center text-xs text-bondMuted">
  Loading…
</div>
);
}

const question = QUESTIONS[qIdx];

/* ---------- ANSWER HANDLER ---------- */
const recordAnswer = (val) => {
traceAction("question_answered", {
quizType: "couple_quiz",
role: isP1 ? "p1" : "p2",
questionIndex: qIdx,
});

const nextAnswers = [...answers, { id: question.id, answer: val }];

if (isP1) {
save({
  p1Answers: nextAnswers,
  quizState:
    nextAnswers.length >= totalQuestions ? "p2_quiz" : "p1_quiz",
});
} else {
save({
  p2Answers: nextAnswers,
  quizState:
    nextAnswers.length >= totalQuestions ? "loading" : "p2_quiz",
});
}
};

return (
<div className="p-6 h-full flex flex-col justify-center">
<div className="flex items-center justify-between mb-2">
  <p className="text-[11px] text-bondMuted">
    {session.name}
  </p>
  <span className="text-[11px] text-bondMuted">
    {qIdx + 1}/{totalQuestions}
  </span>
</div>

<h2 className="text-lg font-semibold mb-4 leading-snug">
  {question.text}
</h2>

<AnswerScale onChange={recordAnswer} />

<p className="mt-4 text-[11px] text-bondMuted text-center">
  Answering as{" "}
  <span className="font-semibold">
    {isP1 ? data.p1Name : data.p2Name || "Partner"}
  </span>
</p>
</div>
);
};

/* -------------------------------------------------------
RESULTS SCREEN – COUPLE QUIZ SUMMARY
-------------------------------------------------------- */
const ResultsScreen = ({ data, save }) => {
const res = data.results;

// Safety guard (very important in inline Babel)
if (!res) {
return (
<div className="p-6 text-center text-xs text-bondMuted">
  No results available.
</div>
);
}

const relType = getRelationshipTypeFromPercent(res.compatibility);

React.useEffect(() => {
traceAction("feature_completed", {
feature: "couple_quiz",
bondScore: res.bondScore,
compatibility: res.compatibility,
emotionalSafety: res.emotionalSafety,
archetype: res.archetype?.name,
});
}, []);

const askAI = () => {
traceAction("ai_coach_opened", {
context: "couple_results",
});

openCoachFromReact(
`We just completed a Couple Quiz in Bond OS.

Bond Score: ${res.bondScore}
Compatibility: ${res.compatibility}%
Emotional Safety: ${res.emotionalSafety}%
Relationship Type: ${relType.typeTitle}
Type Description: ${relType.typeDescription}
Archetype: ${res.archetype?.name}
Prediction: ${res.prediction}

Use ALL available data (Solo Health, Flag Check, Ideal Match, Verse, Plan).
Explain:
• What pattern this relationship shows
• Biggest hidden risks & strengths
• A simple 2–3 week improvement plan`
);
};

return (
<div className="p-6 h-full overflow-y-auto custom-scroll">
{/* SCORE CARD */}
<div className="bg-bondSurfaceSoft border border-bondBorder rounded-3xl p-6 text-center mb-5 card-hover">
  <h2 className="text-5xl font-black mb-1">{res.bondScore}</h2>
  <p className="text-[10px] text-bondMuted uppercase tracking-[0.2em] mb-2">
    Bond Score
  </p>
  <p className="text-xs text-bondMuted">
    Compatibility{" "}
    <span className="font-semibold">{res.compatibility}%</span> · Emotional
    Safety{" "}
    <span className="font-semibold">{res.emotionalSafety}%</span>
  </p>
</div>

{/* RELATIONSHIP TYPE */}
<div className="mb-2 text-[10px] text-bondMuted uppercase tracking-[0.2em]">
  Relationship Type
</div>

<div
  className={
    "p-5 rounded-3xl border card-hover mb-4 " +
    (res.archetype?.color || "border-bondBorder")
  }
>
  <h3 className="font-bold text-lg mb-1">
    {relType.typeTitle}
  </h3>
  <p className="text-xs opacity-90 mb-3">
    {relType.typeDescription}
  </p>
  <p className="text-[11px]">
    Archetype:{" "}
    <span className="font-semibold">
      {res.archetype?.name}
    </span>
  </p>
  <p className="text-[11px]">
    Prediction:{" "}
    <span className="font-semibold">{res.prediction}</span>
  </p>
</div>

{/* MICRO GUIDANCE */}
<div className="bg-bondSurface border border-bondBorder rounded-2xl p-4 mb-4 text-left card-hover">
  <p className="text-[10px] text-bondMuted uppercase tracking-[0.2em] mb-1">
    What To Do Next
  </p>
  <ul className="text-xs text-bondMuted list-disc list-inside space-y-1">
    <li>
      Pick <span className="font-semibold">one area</span> to improve for
      the next 14 days.
    </li>
    <li>
      Revisit 2 questions you answered differently — talk, don’t debate.
    </li>
    <li>
      Use the <span className="font-semibold">Plan</span> tab to convert
      insights into rituals.
    </li>
  </ul>
</div>

{/* ACTION BUTTONS */}
<div className="flex flex-col space-y-2">
  <Button primary icon="chat" onClick={askAI}>
    Ask AI Coach what this means
  </Button>

  <Button
    icon="arrow-left"
    onClick={() =>
      save({
        quizState: "menu",
        p1Answers: [],
        p2Answers: [],
        results: null,
      })
    }
  >
    Finish & Go Back
  </Button>
</div>
</div>
);
};
function computeGuessAccuracy(guesses = [], actuals = []) {
let correct = 0;

guesses.forEach((g) => {
const match = actuals.find(a => a.id === g.id);
if (match && match.value === g.value) correct++;
});

return {
correct,
total: guesses.length,
percent:
guesses.length > 0
  ? Math.round((correct / guesses.length) * 100)
  : 0,
};
}
function detectBlindSpots(guesses = [], actuals = []) {
const mismatches = [];

guesses.forEach((g) => {
const actual = actuals.find(a => a.id === g.id);
if (actual && g.value !== actual.value) {
mismatches.push({
  id: g.id,
  guessed: g.value,
  actual: actual.value,
});
}
});

return mismatches.slice(0, 3); // top 3 only
}

/* -------------------------------------------------------
GUESS GAME HUB – PARTNER PREDICTION GAME
-------------------------------------------------------- */
const GuessGameHub = ({ data, save }) => {
const QUESTIONS = data?.guessSessionQuestions;

const isP2 = data.guessState === "p2_quiz";

const answers = isP2
? data.guessP2Answers || []
: data.guessAnswers || [];

const idx = answers.length;

/* ---------- SAFETY GUARD ---------- */
if (!Array.isArray(QUESTIONS) || QUESTIONS.length === 0) {
return (
<div className="p-6 h-full flex items-center justify-center text-center text-bondMuted">
  Start a Guess Game session to play.
</div>
);
}

const showResults =
data.guessState === "results" || idx >= QUESTIONS.length;

const currentQ = QUESTIONS[idx];

/* ---------- TRACE OPEN ---------- */
React.useEffect(() => {
if (data.guessState === "quiz") {
traceAction("feature_opened", {
  feature: "guess_game",
  level: data.guessLevel,
});
}
}, []);

/* ---------- HANDLE ANSWER (P1 + P2) ---------- */
const handleAnswer = (choice) => {
traceAction("question_answered", {
quizType: "guess_game",
role: isP2 ? "partner" : "self",
questionIndex: idx,
});

const next = [
...answers,
{
  id: currentQ.id,
  value: choice,
},
];

if (!isP2) {
save({
  guessAnswers: next,
  guessState:
    next.length >= QUESTIONS.length ? "p2_quiz" : "quiz",
});
} else {
save({
  guessP2Answers: next,
  guessState:
    next.length >= QUESTIONS.length ? "results" : "p2_quiz",
});
}
};
/* ---------- RESULTS ---------- */
if (showResults) {
const guesses = data.guessAnswers || [];
const actuals = data.guessP2Answers || [];

let correct = 0;
const blindSpots = [];

guesses.forEach((g) => {
const match = actuals.find((a) => a.id === g.id);
if (match) {
if (match.value === g.value) {
  correct++;
} else {
  blindSpots.push({
    guessed: g.value,
    actual: match.value,
  });
}
}
});

const accuracy = {
correct,
total: guesses.length,
percent:
guesses.length > 0
  ? Math.round((correct / guesses.length) * 100)
  : 0,
};

traceAction("feature_completed", {
feature: "guess_game",
accuracy: accuracy.percent,
});

return (
<div className="p-6 h-full flex flex-col justify-center text-center">
{/* ---------- ACCURACY ---------- */}
<h2 className="text-[40px] font-black mb-1">
  {accuracy.percent}%
</h2>

<p className="text-[10px] uppercase tracking-[0.2em] text-bondMuted mb-4">
  Prediction Accuracy
</p>

<p className="text-xs text-bondMuted mb-4 max-w-xs mx-auto">
  You correctly predicted {accuracy.correct} out of {accuracy.total} answers.
</p>

{/* ---------- BLIND SPOTS ---------- */}
{blindSpots.length > 0 && (
  <div className="bg-bondSurfaceSoft border border-bondBorder rounded-2xl p-4 text-left text-xs mb-4">
    <p className="font-semibold mb-2">Blind Spots Detected</p>
    <ul className="list-disc ml-4 space-y-1">
      {blindSpots.slice(0, 3).map((b, i) => (
        <li key={i}>
          You guessed <b>{b.guessed}</b>, but they answered <b>{b.actual}</b>.
        </li>
      ))}
    </ul>
  </div>
)}

<Button
  primary
  onClick={() =>
    save({
      quizState: "menu",
      guessState: "intro",
      guessAnswers: [],
      guessP2Answers: [],
    })
  }
>
  Done
</Button>
</div>
);
}

/* ---------- QUIZ FLOW ---------- */
return (
<div className="p-6 h-full flex flex-col justify-center">
<div className="flex items-center justify-between mb-2">
  <button
    className="text-[11px] text-bondMuted flex items-center"
    onClick={() =>
      save({
        quizState: "menu",
        guessState: "intro",
        guessAnswers: [],
        guessP2Answers: [],
      })
    }
  >
    <Icon name="arrow-left" className="w-4 h-4 mr-1" />
    Exit
  </button>

  <span className="text-[11px] text-bondMuted font-semibold">
    {idx + 1}/{QUESTIONS.length}
  </span>
</div>

<p className="text-[11px] text-bondMuted mb-1">
  {isP2 ? "Partner answering" : "Your guess"}
</p>

<h2 className="text-lg font-semibold mb-5 leading-snug">
  {currentQ.text}
</h2>

{/* ---------- MCQ OPTIONS ---------- */}
<div className="space-y-2">
  {(Array.isArray(currentQ.options)
    ? currentQ.options
    : Array.isArray(currentQ.choices)
    ? currentQ.choices
    : [
        "Very likely",
        "Somewhat likely",
        "Unlikely",
        "Very unlikely",
      ]
  ).map((opt, i) => (
    <button
      key={i}
      onClick={() => handleAnswer(opt)}
      className="w-full bg-bondSurface p-3 rounded-xl border border-bondBorder text-sm hover-outline transition-all text-left"
    >
      {opt}
    </button>
  ))}
</div>
</div>
);
};
/* -------------------------------------------------------
TEST HUB – MAIN ASSESSMENT MENU (COUPLE + SOLO TOOLS)
-------------------------------------------------------- */
const TestHub = ({ data, save, setActiveProfile, setScreen }) => {

/* =====================================================
SESSION STARTERS (LEVEL-AWARE)
⚠️ DO NOT MODIFY LOGIC
====================================================== */

const startSolo = (levelKey) => {
const cfg = SOLO_LEVELS[levelKey];
const eligible = SOLO_QUESTIONS.filter(
q => (q.level ?? 1) <= Math.max(2, cfg.maxLevel)
);
const questions = shuffleArray(eligible).slice(0, cfg.count);

save({
quizState: "solo",
soloState: "quiz",
soloLevel: levelKey,
soloSessionId: crypto.randomUUID(),
soloSessionQuestions: questions,
soloAnswers: [],
});
};
const startIdeal = () => {
save({
quizState: "ideal",
idealState: "quiz",
idealSessionId: crypto.randomUUID(),
idealAnswers: {},
idealScore: null,
idealResult: null,
});
};


const startFlag = (levelKey) => {
const cfg = FLAG_LEVELS[levelKey];
const eligible = FLAG_QUESTIONS.filter(
q => (q.level ?? 1) <= Math.max(2, cfg.maxLevel)
);
const questions = shuffleArray(eligible).slice(0, cfg.count);

save({
quizState: "flag",
flagState: "quiz",
flagLevel: levelKey,
flagSessionId: crypto.randomUUID(),
flagSessionQuestions: questions,
flagAnswers: [],
flagResult: null,
});
};

/* =====================================================
ACTIVE FEATURE ROUTES
====================================================== */

if (data.quizState === "solo") {
return <SoloTestHub key={data.soloSessionId} data={data} save={save} />;
}

if (data.quizState === "flag") {
return <FlagCheckHub key={data.flagSessionId} data={data} save={save} />;
}
if (data.quizState === "ideal") {
return (
<IdealMatchMeterHub
key={data.idealSessionId || "ideal-session"}
data={data}
save={save}
/>
);
}

if (data.quizState === "radar") {
return <ProfileRadarHub data={data} save={save} />;
}
if (data.quizState === "feed") {
  return (
    <AppShell data={data} save={save}>
      <FeedHub
        data={data}
        save={save}
        setActiveProfile={setActiveProfile}
        setScreen={setScreen}
      />
    </AppShell>
  );
}
/* =====================================================
COUPLE QUIZ — RESULTS
====================================================== */

if (data.results) {
return (
<ResultsScreen
data={data}
save={save}
/>
);
}

/* =====================================================
COUPLE QUIZ — ACTIVE QUIZ FLOW
====================================================== */

if (
data.quizState === "p1_quiz" ||
data.quizState === "p2_quiz" ||
data.quizState === "loading"
) {
return (
<QuizScreen
  key={data.quizSessionId}
  data={data}
  save={save}
/>
);
}

/* =====================================================
SOLO LEVEL SELECT
====================================================== */

if (data.quizState === "solo_level_select") {
return (
<AppShell title="Solo Health Check" onBack={() => save({ quizState: "home" })}>
  <div className="space-y-3">
    <LevelCard level={1} label="Personal signal scan" time="~3 minutes" onClick={() => startSolo("level1")} />
    <LevelCard level={2} label="Pattern clarity" time="~5 minutes" note="Most people start here" onClick={() => startSolo("level2")} />
    <LevelCard level={3} label="Deep signal analysis" time="~8 minutes" onClick={() => startSolo("level3")} />
    <LevelCard level={4} label="Extended scan" time="~10–12 minutes" onClick={() => startSolo("level4")} />
  </div>
</AppShell>
);
}

/* =====================================================
FLAG LEVEL SELECT
====================================================== */

if (data.quizState === "flag_level_select") {
return (
<AppShell title="Flag Check" onBack={() => save({ quizState: "home" })}>
  <div className="space-y-3">
    <LevelCard level={1} label="Basic signal sweep" time="~3 minutes" onClick={() => startFlag("level1")} />
    <LevelCard level={2} label="Expanded signal scan" time="~5 minutes" note="Most people start here" onClick={() => startFlag("level2")} />
    <LevelCard level={3} label="Risk-focused analysis" time="~8 minutes" onClick={() => startFlag("level3")} />
    <LevelCard level={4} label="Full diagnostic sweep" time="~10–12 minutes" onClick={() => startFlag("level4")} />
  </div>
</AppShell>
);
}

/* =====================================================
COUPLE QUIZ — LEVEL SELECT (RESTORED)
====================================================== */

if (data.quizState === "level_select") {
return (
<AppShell title="Couple Quiz" onBack={() => save({ quizState: "home" })}>
  <div className="space-y-3">
    {["level1", "level2", "level3", "level4", "level5"].map((k, i) => {
      const minutes = ["~3", "~6", "~10", "~12–14", "~15+"][i];
      const label = [
        "Light scan",
        "Pattern clarity",
        "Deep signal analysis",
        "Extended scan",
        "Full diagnostic"
      ][i];

      return (
        <LevelCard
          key={k}
          level={i + 1}
          label={label}
          time={`${minutes} minutes`}
          note={i === 1 ? "Most people start here" : undefined}
          onClick={() => {
            const session = startQuizSession(k, data.testCount);
            window.traceAction("start_couple_level", { level: i + 1 });

            save({
              quizState: "p1_quiz",
              selectedLevel: k,
              quizSession: session,
              quizSessionId: session.id,
              p1Answers: [],
              p2Answers: [],
              results: null,
            });
          }}
        />
      );
    })}
  </div>
</AppShell>
);
}

/* =====================================================
HOME / DEFAULT MENU
====================================================== */

return (
<AppShell title="Assessments" headerVariant="home">
<div className="space-y-6">
  <AssessmentIntro />

  <FeatureCard
    title="Couple Quiz"
    subtitle="Both partners answer. Response patterns are compared across dimensions."
    meta="~6–8 minutes"
    cta=">>"
    onClick={() => save({ quizState: "level_select" })}
  />

  <FeatureCard
title="Solo Health Check"
subtitle="Private reflection from your perspective only."
meta="~4–5 minutes"
cta=">>"
onClick={() => save({ quizState: "solo_level_select" })}
/>

  <div className="pt-4 text-xs tracking-widest opacity-40">
    MORE FOR SINGLES & SITUATIONSHIPS
  </div>

  <FeatureCard
    title="Flag Check"
    subtitle="Identifies risk, neutral, and positive signals in a connection."
    meta="~3 minutes"
    cta="›"
    onClick={() => save({ quizState: "flag_level_select" })}
  />

  <FeatureCard
    title="Ideal Match Meter"
    subtitle="Model your ideal partner profile and assess rarity."
    cta="›"
   onClick={startIdeal}
  />

  <FeatureCard
    title="Profile Radar"
    subtitle="Analyze bios against your interaction patterns."
    cta="›"
    onClick={() => save({ quizState: "radar" })}
  />

<FeatureCard
  title="People"
  subtitle="See top profiles ranked by reviews"
  onClick={() => save({ quizState: "feed" })}
/>
</div>
</AppShell>
);
};

/* -------------------------------------------------------
PLAY HUB – GAMES ONLY (GUESS GAME WITH LEVELS)
-------------------------------------------------------- */
const PlayHub = ({ data, save }) => {

/* ===============================
ACTIVE GUESS GAME (SESSION ONLY)
=============================== */
if (
data.quizState === "guess" &&
Array.isArray(data.guessSessionQuestions) &&
data.guessSessionQuestions.length > 0
) {
return <GuessGameHub data={data} save={save} />;
}

/* ===============================
GUESS GAME — LEVEL SELECT
=============================== */
if (data.quizState === "guess_level_select") {
return (
<AppShell
  title="Guess Game"
  onBack={() =>
    save({
      quizState: null,
      guessState: null,
      guessSessionQuestions: null,
    })
  }
>
  <div className="space-y-3">
    {Object.entries(GUESS_LEVELS).map(([key, lvl], idx) => (
      <LevelCard
        key={key}
        level={idx + 1}
        label={lvl.label}
        subtitle={lvl.description}
        time={`~${lvl.count} questions`}
        note={lvl.note}
        onClick={() => {
          const questions = shuffleArray(GUESS_QUESTIONS).slice(
            0,
            lvl.count
          );

          save({
            quizState: "guess",
            guessState: "quiz",
            guessLevel: key,
            guessSessionId: crypto.randomUUID(),
            guessSessionQuestions: questions,
            guessAnswers: [],
            guessP2Answers: [],
          });
        }}
      />
    ))}
  </div>
</AppShell>
);
}

/* ===============================
SHIP IT — Sub-screen
=============================== */
if (data.playSub === "shipit") {
return <ShipItHub data={data} save={save} />;
}
/* ===============================
PLAY MENU (ENTRY POINT)
=============================== */
return (
<AppShell title="Play">
<div className="space-y-6">
  <FeatureCard
title="Guess Game"
subtitle="Predict how your partner will answer."
meta="4 levels • ~5–15 minutes"
cta="Start →"
onClick={() =>
save({
quizState: "guess_level_select",
guessState: null,
guessSessionQuestions: null,
})
}
/>
<FeatureCard
title="🚢 Ship It"
subtitle="Drop your hottest ships. Let the internet decide who sails and who sinks."
meta="Community · Matchmaker · Gen Z energy"
cta="Ship →"
onClick={() => save({ playSub: "shipit" })}
/>
</div>
</AppShell>
);
};


/* -------------------------------------------------------
JOINT (GUESS GAME) — FIXED & SAFE
-------------------------------------------------------- */
const JointHub = ({ data, save }) => {
const [input, setInput] = React.useState("");

const safeState = data.jointState || "rules";

const level =
JOINT_LEVELS[data.jointChallengeLevel] || JOINT_LEVELS.level1;
// 🔐 SAFE SESSION GUARD (NEVER CRASH)
const questions = data?.soloSessionQuestions;

if (!Array.isArray(questions) || questions.length === 0) {
return (
<div className="p-6 h-full flex items-center justify-center text-bondMuted text-center">
  Start a Solo session to use this feature.
</div>
);
}

const idx =
typeof data.jointCurrentIndex === "number"
? data.jointCurrentIndex
: 0;

const currentQ = questions[idx];


const getQuestionText = (q) => {
if (!q) return "";
if (typeof q === "string") return q;
if (Array.isArray(q)) return q.join(" ");
if (typeof q === "object")
return q.text || q.question || q.prompt || q.label || "";
return String(q);
};

/* =====================================================
✅ SAFE EFFECT — RUNS ALWAYS, ACTS CONDITIONALLY
===================================================== */
React.useEffect(() => {
if (safeState !== "results") return;

const res =
data.jointResults ||
computeJointResults(
  data.jointP1Answers || [],
  data.jointP2Guesses || []
);

traceAction("feature_completed", {
feature: "joint_guess",
score: res.score,
matched: res.correct,
total: res.total,
});

traceAction("quiz_flow_completed", {
type: "joint",
});
}, [safeState, data]);

/* ---------------- RESULTS ---------------- */
if (safeState === "results") {
const res =
data.jointResults ||
computeJointResults(
  data.jointP1Answers || [],
  data.jointP2Guesses || []
);

const askAI = () =>
openCoachFromReact(
  `We just played the Guess Game in Bond OS.
Score: ${res.score}/100.
Matched answers: ${res.correct}/${res.total}.

Help us understand what this says about how well we know each other and suggest 3–5 playful rituals or questions to deepen mutual understanding.`
);

return (
<div className="p-6 h-full text-center flex flex-col justify-center">
  <h2 className="text-2xl font-bold mb-1">Guess Game Results</h2>
  <p className="text-xs text-bondMuted mb-5">
    How well do you actually know each other?
  </p>

  <div className="bg-bondSurface p-6 rounded-2xl border border-bondBorder mb-4 card-hover">
    <p className="text-4xl font-extrabold mb-1">{res.score}/100</p>
    <p className="text-xs text-bondMuted mb-1">Accuracy score</p>
    <p className="text-xs text-bondMuted">
      You matched{" "}
      <span className="font-semibold">{res.correct}</span> of{" "}
      <span className="font-semibold">{res.total}</span> answers.
    </p>
  </div>

  <div className="flex flex-col space-y-2">
    <Button
      primary
      icon="chat"
      onClick={() => {
        traceAction("ai_coach_opened", {
          context: "joint_results",
        });
        askAI();
      }}
    >
      Ask AI Coach how to build on this
    </Button>

    <Button
      icon="repeat"
      onClick={() =>
        save({
          jointState: "rules",
          jointChallengeLevel: "level1",
          jointP1Answers: [],
          jointP2Guesses: [],
          jointResults: null,
          jointCurrentIndex: 0,
        })
      }
    >
      Play Again
    </Button>
  </div>
</div>
);
}

/* ---------------- RULES ---------------- */
if (safeState === "rules") {
return (
<div className="p-6 h-full flex flex-col justify-center text-center">
  <Icon
    name="puzzle"
    className="w-14 h-14 text-bondAccent mx-auto mb-5"
  />
  <h1 className="text-2xl font-bold mb-2">Guess Game</h1>
  <p className="text-bondMuted text-xs mb-4 max-w-xs mx-auto">
    Round 1: <b>{data.p1Name || "Partner 1"}</b> answers.<br />
    Round 2: <b>{data.p2Name || "Partner 2"}</b> guesses.
  </p>

  <Button
    primary
    onClick={() => {
      traceAction("feature_opened", { feature: "joint_guess" });
      traceAction("quiz_started", { type: "joint" });

      save({
        jointState: "level_select",
        jointChallengeLevel: "level1",
        jointP1Answers: [],
        jointP2Guesses: [],
        jointResults: null,
        jointCurrentIndex: 0,
      });
    }}
  >
    Start
  </Button>
</div>
);
}
/* ---------------- LEVEL SELECT ---------------- */
if (data.quizState === "level_select") {
return (
<AppShell
title="Joint Challenge"
onBack={() =>
  save({
    jointState: "rules",
    jointCurrentIndex: 0,
    jointP1Answers: [],
    jointP2Guesses: [],
    jointResults: null,
  })
}
>
<div className="space-y-3">
  {Object.entries(JOINT_LEVELS).map(([k, l], idx) => (
    <LevelCard
      key={k}
      level={idx + 1}
      label={l.name}
      time={l.time || "~5–7 minutes"}
      onClick={() =>
        save({
          jointState: "p1",
          jointChallengeLevel: k,
          jointP1Answers: [],
          jointP2Guesses: [],
          jointResults: null,
          jointCurrentIndex: 0,
        })
      }
    />
  ))}
</div>
</AppShell>
);
}

const submit = () => {
const text = input.trim();
if (!text) return;

traceAction("question_answered", {
quizType: "joint_guess",
role: safeState === "p1" ? "p1" : "p2",
questionIndex: idx,
});

if (safeState === "p1") {
const newAnswers = [...(data.jointP1Answers || []), text];
save({
  jointP1Answers: newAnswers,
  jointCurrentIndex:
    idx + 1 < questions.length ? idx + 1 : 0,
  jointState:
    idx + 1 < questions.length ? "p1" : "p2",
});
} else {
const newGuesses = [...(data.jointP2Guesses || []), text];
if (idx + 1 < questions.length) {
  save({
    jointP2Guesses: newGuesses,
    jointCurrentIndex: idx + 1,
  });
} else {
  save({
    jointP2Guesses: newGuesses,
    jointResults: computeJointResults(
      data.jointP1Answers || [],
      newGuesses
    ),
    jointState: "results",
    jointCurrentIndex: 0,
  });
}
}

setInput("");
};

return (
<div className="p-6 h-full flex flex-col justify-center">
<div className="flex items-center justify-between mb-3">
  <button
    className="text-[11px] text-bondMuted flex items-center"
    onClick={() => save({ jointState: "level_select" })}
  >
    <Icon name="arrow-left" className="w-4 h-4 mr-1" />
    Back
  </button>
  <span className="text-[11px] text-bondMuted">
    {idx + 1}/{questions.length}
  </span>
</div>

<p className="text-[11px] text-bondMuted mb-1">
  {safeState === "p1"
    ? `${data.p1Name || "Partner 1"} answers`
    : `${data.p2Name || "Partner 2"} guesses`}
</p>

<h2 className="text-lg font-semibold mb-2">
  {getQuestionText(currentQ)}
</h2>

<textarea
  className="w-full p-4 rounded-xl border border-bondBorder bg-bondSurface outline-none mb-5 text-sm"
  value={input}
  onChange={(e) => setInput(e.target.value)}
  placeholder={
    safeState === "p1"
      ? "Type your honest answer…"
      : "Type your best guess…"
  }
/>

<Button primary onClick={submit}>Next</Button>
</div>
);
};

/* -------------------------------------------------------
DYNAMIC ROADMAP GENERATOR — INTENT → ACTIONS
(kept here above the component so it's always in scope)
-------------------------------------------------------- */
function generateDynamicRoadmap(
shortGoal,
longGoal,
constraints,
timePerWeek,
sessionLength
) {
const items = [];
const now = new Date();

const cleanShort = (shortGoal || "").trim();
const cleanLong = (longGoal || "").trim();
const cleanConstraints = (constraints || "").trim();

const addItem = (text, step, category = "General") => {
items.push({
id: Date.now() + Math.random(),
text,
step,
category,
createdAt: now.toISOString(),
done: false,
});
};

const timelineDescriptor =
timePerWeek && sessionLength
? `You can invest about ${timePerWeek} days/week for ~${sessionLength} minutes each, so → `
: "";

/* SHORT-TERM RELATIONSHIP FOCUS */
if (cleanShort) {
addItem(
`${timelineDescriptor}turn this into one weekly ritual: ${cleanShort}`,
"Next 7–14 days",
"Closeness"
);
addItem(
`Schedule a 25–40 minute reflection: “What would help ${cleanShort} feel easier?”`,
"This week",
"Understanding"
);
addItem(
`Pick a micro-habit you both protect (e.g., 10 min night talk / daily walk / distraction-free meal).`,
"Next 10 days",
"Habits"
);
}

/* LONG-TERM FUTURE DIRECTION */
if (cleanLong) {
addItem(
`Brainstorm real-life shape of “${cleanLong}” — finances, location, lifestyle rhythms.`,
"Next 1–2 weeks",
"Future Design"
);
addItem(
`Choose one milestone toward “${cleanLong}” (budget, therapy, paperwork, exploration).`,
"30–60 days",
"Milestones"
);
addItem(
`Build a monthly check-in ritual to review long-term alignment.`,
"Next 30 days",
"Consistency"
);
}

/* REALITY + CONSTRAINTS SECTION */
if (cleanConstraints) {
addItem(
`Clarify constraints out loud: ${cleanConstraints}. Separate what is fixed vs flexible.`,
"Within 10 days",
"Reality"
);
addItem(
`Pick one boundary that protects both of you and reduces pressure.`,
"Within 14–20 days",
"Boundaries"
);
}

/* DEFAULT IF NOTHING PROVIDED */
if (!items.length) {
addItem(
`${timelineDescriptor}Start a 30-minute talk: “What do we want this relationship to feel like in 3 months?”`,
"This week",
"Clarity"
);
addItem(
`Choose one warm ritual (weekly check-in, tech-free dinner, walk). Protect it.`,
"Next 7–10 days",
"Rituals"
);
}

return items;
}

/* -------------------------------------------------------
PLAN HUB — GOALS → OVERVIEW + ROADMAP (MERGED)
-------------------------------------------------------- */
const PlanHub = ({ data = {}, save = () => {} }) => {
const [view, setView] = React.useState("overview"); // "overview" | "roadmap"

const [shortGoal, setShortGoal] = React.useState(data.goals?.[0] || "");
const [longGoal, setLongGoal] = React.useState(data.goals?.[1] || "");
const [constraints, setConstraints] = React.useState(
data.planConfig?.constraints || ""
);

const [timePerWeek, setTimePerWeek] = React.useState(
data.planConfig?.timePerWeek || "3–5"
);
const [sessionLength, setSessionLength] = React.useState(
String(data.planConfig?.sessionLength || "30")
);

// local copy so UI updates immediately (sync with parent via data)
const [localPlans, setLocalPlans] = React.useState(data.dynamicPlan || []);
const [error, setError] = React.useState("");

// keep localPlans in sync if parent passes new data
React.useEffect(() => {
setLocalPlans(data.dynamicPlan || []);
}, [data.dynamicPlan]);

const hasTracedPlanOpen = React.useRef(false);

React.useEffect(() => {
if (!hasTracedPlanOpen.current) {
if (typeof traceAction === "function") {
  traceAction("plan_opened", {
    hasExistingPlan: Boolean(localPlans.length),
  });
}
hasTracedPlanOpen.current = true;
}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const regeneratePlan = () => {
if (!shortGoal && !longGoal && !constraints) {
setError(
  "Tell Bond at least one thing — a short-term focus, long-term dream, or reality constraint."
);
return;
}

setError("");

const roadmap = generateDynamicRoadmap(
shortGoal,
longGoal,
constraints,
timePerWeek,
sessionLength
);

if (typeof traceAction === "function") {
traceAction("plan_generated", {
  hasShortGoal: Boolean(shortGoal),
  hasLongGoal: Boolean(longGoal),
  hasConstraints: Boolean(constraints),
  timePerWeek,
  sessionLength,
  stepsCount: roadmap.length,
});
}

// update UI immediately
setLocalPlans(roadmap);

// persist via parent save
save({
goals: [shortGoal, longGoal],
planConfig: { constraints, timePerWeek, sessionLength },
dynamicPlan: roadmap,
roadmap,
objective: shortGoal || longGoal || "Clarify direction & improve flow.",
});

// auto-switch to roadmap view so user sees generated steps
setView("roadmap");
};

const toggleDone = (id) => {
if (typeof traceAction === "function") {
traceAction("plan_step_toggled", { stepId: id });
}

const updated = (localPlans || []).map((p) =>
p.id === id ? { ...p, done: !p.done } : p
);

setLocalPlans(updated);
save({ dynamicPlan: updated, roadmap: updated });
};

const askAI = () =>
openCoachFromReact &&
openCoachFromReact(
`Help us improve our Plan.\nShort goal: ${shortGoal}\nLong goal: ${longGoal}\nConstraints: ${constraints}\nTime available: ${timePerWeek} days/week × ${sessionLength} mins\n\nBased on our results, suggest:\n• A 3-week roadmap\n• Fix common blockers\n• Step-by-step rituals\n• Scripts for difficult conversations.`
);

return (
<div className="p-6 h-full flex flex-col">
{/* Top Bar */}
<div className="flex items-center justify-between mb-4">
  <button
    className="text-[11px] text-bondMuted flex items-center mr-3"
    onClick={() => save({ screen: "dashboard" })}
  >
    <Icon name="arrow-left" className="w-4 h-4 mr-1" />
    Back
  </button>

  <Button icon="chat" onClick={askAI} className="text-[11px] px-3 py-1.5">
    Ask AI
  </Button>
</div>

<h2 className="text-xl font-bold mb-1">Bond Plan</h2>
<p className="text-xs text-bondMuted mb-3">Turn goals into a living roadmap.</p>

{/* VIEW TOGGLE */}
<div className="flex gap-4 mb-4">
  <button
    className={`px-4 py-2 rounded-lg text-xs ${
      view === "overview" ? "bg-bondAccent text-white" : "bg-bondSurfaceSoft border border-bondBorder"
    }`}
    onClick={() => setView("overview")}
  >
    Overview
  </button>

  <button
    className={`px-4 py-2 rounded-lg text-xs ${
      view === "roadmap" ? "bg-bondAccent text-white" : "bg-bondSurfaceSoft border border-bondBorder"
    }`}
    onClick={() => setView("roadmap")}
  >
    Roadmap
  </button>
</div>

{/* OVERVIEW */}
{view === "overview" && (
  <>
    {/* INPUT CARD */}
    <div className="bg-bondSurfaceSoft border border-bondBorder rounded-2xl p-4 mb-4 space-y-3 card-hover">
      <div>
        <p className="text-[11px] text-bondMuted mb-1">Short-term focus (next 30 days)</p>
        <input
          className="w-full p-2.5 rounded-xl border border-bondBorder bg-bondSurface text-xs outline-none"
          value={shortGoal}
          onChange={(e) => setShortGoal(e.target.value)}
          placeholder="e.g., argue less, feel closer, rebuild trust..."
        />
      </div>

      <div>
        <p className="text-[11px] text-bondMuted mb-1">Long-term direction</p>
        <input
          className="w-full p-2.5 rounded-xl border border-bondBorder bg-bondSurface text-xs outline-none"
          value={longGoal}
          onChange={(e) => setLongGoal(e.target.value)}
          placeholder="e.g., move in together 2026, healthier finances..."
        />
      </div>

      <div>
        <p className="text-[11px] text-bondMuted mb-1">Current constraints / reality</p>
        <input
          className="w-full p-2.5 rounded-xl border border-bondBorder bg-bondSurface text-xs outline-none"
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          placeholder="e.g., long-distance, opposite schedules, strict parents..."
        />
      </div>

      {/* Time availability */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] text-bondMuted mb-1">Days per week</p>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {["1–2", "3–5", "6–7"].map((opt) => (
              <button
                key={opt}
                className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                  timePerWeek === opt ? "btn-pill-active" : "btn-pill"
                }`}
                onClick={() => setTimePerWeek(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] text-bondMuted mb-1">Session length</p>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {["15", "30", "60"].map((opt) => (
              <button
                key={opt}
                className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                  sessionLength === opt ? "btn-pill-active" : "btn-pill"
                }`}
                onClick={() => setSessionLength(opt)}
              >
                {opt} mins
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-[11px] text-bondDanger mt-1">{error}</p>}

      <Button primary onClick={regeneratePlan} className="w-full mt-2">
        Regenerate Roadmap
      </Button>
    </div>

    {/* Quick tips / hint */}
    <div className="text-xs text-bondMuted mb-3">
      Tip: start small. A protected 10-minute ritual is more powerful than a long plan you never follow.
    </div>
  </>
)}

{/* ROADMAP VIEW */}
{view === "roadmap" && (
  <div className="flex-1 overflow-y-auto custom-scroll">
    {!localPlans.length ? (
      <p className="text-xs text-bondMuted text-center mt-6">
        No roadmap yet. Add at least one goal in Overview and tap{" "}
        <span className="font-semibold">Regenerate Roadmap</span>.
      </p>
    ) : (
      <div className="space-y-3 pb-4">
        {localPlans
          .slice()
          .reverse()
          .map((p) => (
            <div
              key={p.id}
              className="bg-bondSurface border border-bondBorder rounded-2xl p-4 relative overflow-hidden card-hover"
            >
              <div className="absolute -left-2 top-4 w-3 h-3 rounded-full bg-bondAccent shine-dot" />
              <h3 className="font-semibold text-sm mb-1">{p.text}</h3>
              <p className="text-[11px] text-bondMuted">
                Target: <span className="font-semibold">{p.step}</span>
              </p>

              <div className="absolute right-4 top-4">
                <button onClick={() => toggleDone(p.id)} aria-label="toggle done">
                  <Icon
                    name="check"
                    className={`w-5 h-5 ${p.done ? "text-bondMint" : "text-bondMuted"}`}
                  />
                </button>
              </div>
            </div>
          ))}
      </div>
    )}
  </div>
)}
</div>
);
};

/* -------------------------------------------------------
   VERSE QUESTION BANKS (for partner clone & ideal)
-------------------------------------------------------- */
const PARTNER_CLONE_QS = [
  "When they feel misunderstood, what do they usually do first?",
  "What are 2–3 situations that make them feel especially insecure with you?",
  "How do they show they are hurt without saying it directly?",
  "What kind of apology lands best for them — words, actions, space, or humour?",
  "What phrases or tones instantly make things worse in a fight for them?",
  "What are their top 2–3 core values in relationships?",
  "What was a childhood or teen experience that shaped how they love now?",
  "What do they fear most about losing you or this connection?",
  "How do they show love on a normal weekday?",
  "How do they act when they are secretly jealous or threatened?",
  "What makes them feel deeply chosen by you?",
  "What is their typical conflict pattern (chasing, shutting down, joking, over-explaining, etc.)?",
  "How do they talk about commitment, labels, and the future?",
  "What are 2–3 boundaries they’ve clearly asked you to respect?",
  "What are 2–3 things they are really proud of about themselves?",
  "How do they speak about their family or closest friends?",
  "What is a sentence they’ve said in a fight that stayed with you?",
  "How do they like hard conversations to end?",
];

const VERSE_IDEAL_QS = [
  "Emotionally, what kind of baseline do you want (calm, intense, playful, deep)?",
  "How should your ideal partner respond when you feel anxious or spiralling?",
  "What is your ideal partner's conflict style when there is a serious disagreement?",
  "How do they talk about their own feelings and needs?",
  "What balance of independence vs togetherness feels best for you day-to-day?",
  "What are 3 absolute non-negotiable values they must have?",
  "What does their relationship with work / ambition look like?",
  "What is their attitude to therapy, self-work, or growth?",
  "How do they treat your friends and family?",
  "What is your ideal version of physical & sexual intimacy with them?",
  "How playful vs serious do you want them to be?",
  "How do they repair after they mess up?",
  "What kind of life do you see them building with you in 5 years?",
  "What behaviours from them would make your nervous system feel deeply safe?",
  "What parts of you would this ideal partner pull out more often (creative, soft, leader, silly, etc.)?",
];

/* -------------------------------------------------------
   SMALL HELPERS FOR VERSE
-------------------------------------------------------- */
// Build partner profile text from answers
function buildPartnerProfileText(answers, partnerName) {
if (!answers || !answers.length) return "";

traceAction("partner_clone_generated", {
answersCount: answers.length,
partnerName: partnerName || "unknown",
});

return answers
.map((a, i) => {
const q = PARTNER_CLONE_QS[i] || "";
return `Q: ${q}\nA (${partnerName || "Partner"}): ${a}`;
})
.join("\n\n");
}


// Flag summary (Verse-level view)
function calculateFlagSummary(arr = []) {
  if (!Array.isArray(arr) || !arr.length) {
    return {
      avg: 0,
      label: "No data",
      risk: "unknown",
      note: "Run Flag Check to unlock this.",
    };
  }
  const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
  let label, risk, note;

  if (avg >= 4.2) {
    label = "Mostly Green Flags";
    risk = "low";
    note =
      "Your system generally trusts this connection. Maintain clarity & consistency.";
  } else if (avg >= 3.4) {
    label = "Mixed but workable";
    risk = "medium";
    note =
      "Some patterns are good, some need care and conversation.";
  } else if (avg >= 2.6) {
    label = "Orange Zone";
    risk = "high";
    note =
      "Slow down, set boundaries, observe reactions not words.";
  } else {
    label = "Heavy Red Flags";
    risk = "very-high";
    note =
      "If your body feels unsafe or exhausted, treat that data seriously.";
  }

  return { avg, label, risk, note };
}

// Ideal rarity summary (same thresholds as Ideal Match Meter)
function calculateIdealRarity(arr = []) {
  if (!Array.isArray(arr) || !arr.length) {
    return {
      avg: 0,
      label: "Not enough data",
      desc:
        "Run Ideal Match Meter or the Ideal Type flow so Bond can estimate how rare your current checklist probably is.",
    };
  }

  const numeric = arr.filter((v) => typeof v === "number");
  const baseArr = numeric.length ? numeric : Array(arr.length).fill(3);
  const avg = baseArr.reduce((s, v) => s + v, 0) / baseArr.length;

  if (avg <= 2.2) {
    return {
      avg,
      label: "Very likely in your context",
      desc:
        "Your preferences are fairly flexible. There should be many people who can roughly fit this template, especially if you look in aligned spaces.",
    };
  } else if (avg <= 3.2) {
    return {
      avg,
      label: "Quite findable",
      desc:
        "You’re reasonably clear. With intentional search (better spaces, aligned circles, not just swiping anywhere), this type is findable without being fantasy.",
    };
  } else if (avg <= 4) {
    return {
      avg,
      label: "Rare but realistic",
      desc:
        "Your checklist is specific. Expect a smaller pool and a longer search — but it’s still grounded. You may just need to say ‘no’ faster to near-misses.",
    };
  }
  return {
    avg,
    label: "Extremely rare combo",
    desc:
      "You’re hunting for a very specific mix of traits. That’s valid, but expect a longer journey and consider which 1–2 things are truly non-negotiable vs preferences.",
  };
}

// Turn free-text ideal answers into a little vibe story
function summarizeIdealPartner(textAnswers) {
  if (!Array.isArray(textAnswers) || !textAnswers.length) return null;
  const joined = textAnswers.join(" ").toLowerCase();

  const wantsDepth = /deep|vulnerab|honest|feelings|self-aware|intimate/.test(
    joined
  );
  const wantsStable = /stable|calm|secure|consistent|grounded|predictable/.test(
    joined
  );
  const wantsPlay = /fun|play|silly|joke|spontaneous|adventurous|goofy/.test(
    joined
  );
  const wantsAmbition = /career|ambitious|driven|goal|work|hustle|growth/.test(
    joined
  );

  let vibeLine = "";
  if (wantsDepth && wantsStable && wantsPlay) {
    vibeLine =
      "They’re a grounded, emotionally literate goofball – able to talk about hard things and still keep the connection light and playful.";
  } else if (wantsDepth && wantsStable) {
    vibeLine =
      "They’re calm and emotionally deep – someone who doesn’t run from big conversations and doesn’t play hot-and-cold games.";
  } else if (wantsDepth && wantsPlay) {
    vibeLine =
      "They’re intense and fun – midnight talks, therapy memes, plus stupid jokes at 2 a.m.";
  } else if (wantsPlay && wantsAmbition) {
    vibeLine =
      "They’re driven and high-energy – they want both big goals and chaotic, fun weekends.";
  } else {
    vibeLine =
      "They’re more low-key – not extreme, not dramatic, someone whose presence feels more like a soft landing than a rollercoaster.";
  }

  let everydayLine =
    "Day-to-day, they show care through consistent check-ins, small rituals, and a real curiosity about how your mind works.";
  if (wantsAmbition) {
    everydayLine +=
      " They also gently push you toward your own potential – not by pressure, but by believing out loud in what you can build.";
  }
  if (wantsStable && !wantsPlay) {
    everydayLine +=
      " The relationship feels predictable in a good way — fewer emotional swings, more steady warmth.";
  }

  return { vibeLine, everydayLine };
}

// Bridge suggestions between real-life flags and ideal strictness
function generateBridgeSuggestions(flagSummary, idealAvg) {
  const suggestions = [];

  if (flagSummary && flagSummary.avg && flagSummary.avg < 3) {
    suggestions.push(
      "Your system already reads some heavy patterns. Any ‘bridge’ plan has to start with safety — slow the pace, add clearer boundaries, and consider a neutral third space (therapy, couples coach) before trying to optimise."
    );
  }

  if (idealAvg && idealAvg > 3.6) {
    suggestions.push(
      "Your ideal is very specific. Instead of trying to change everything about them, choose 1–2 behaviours that would change the whole vibe if improved (replies, tone in fights, planning effort, repair after conflict)."
    );
  } else if (idealAvg && idealAvg >= 3) {
    suggestions.push(
      "Your ideal is demanding but realistic. Focus on micro-behaviours: weekly rituals, how you both apologise, and how you talk about needs before resentment builds."
    );
  }

  suggestions.push(
    "Don’t make them your project. Share how their behaviour lands for you, agree on 1 small experiment at a time, and notice who actually leans in vs who gets defensive or mocking."
  );

  return suggestions;
}

/* Small UI helper: animated Verse card wrapper */
const VerseCard = ({ icon, title, label, summary, detail, onAsk, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="relative bg-bondSurface rounded-2xl border border-bondBorder p-4 mb-3 cursor-pointer group transition-all duration-200 hover:border-bondAccent/60 hover:shadow-sm_25px_rgba(255,184,85,0.25)]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="p-2.5 rounded-full bg-bondSurfaceSoft text-bondAccent mr-3 group-hover:bg-gradient-to-tr group-hover:from-bondAccent group-hover:to-bondMint group-hover:text-bondBg transition-all">
            <Icon name={icon} className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-bondMuted uppercase tracking-[0.2em]">
              {label}
            </p>
            <p className="text-sm font-semibold">{title}</p>
          </div>
        </div>
        {onAsk && (
          <Button
            className="text-[10px] px-3 py-1 rounded-full bg-bondSurfaceSoft hover:bg-bondAccent/10"
            onClick={(e) => {
              e.stopPropagation();
              onAsk();
            }}
          >
            Ask AI
          </Button>
        )}
      </div>
      <p className="text-[11px] text-bondMuted mt-2 group-hover:text-bondText/80 transition-colors">
        {detail || summary}
      </p>
    </div>
  );
};
/* -------------------------------------------------------
VERSE HUB – META LAYER + PARTNER CLONE (POLISHED + STABLE)
-------------------------------------------------------- */

const LEVEL_COUNT = { 1: 15, 2: 25, 3: 40 };

const MCQ_OPTIONS = [
{ label: "Strongly disagree", score: -2 },
{ label: "Disagree", score: -1 },
{ label: "Neutral / mixed", score: 0 },
{ label: "Agree", score: 1 },
{ label: "Strongly agree", score: 2 },
];

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const VerseHub = ({ data, save }) => {
/* ---------------- STATE ---------------- */

const [tab, setTab] = React.useState("overview");
const [cloneInput, setCloneInput] = React.useState("");
const [cloneChat, setCloneChat] = React.useState([]);
const [cloneSending, setCloneSending] = React.useState(false);
const hasTracedCloneChat = React.useRef(false);

/* ---------------- DERIVED ---------------- */

const cloneState = data.partnerCloneState || "intro";
const cloneMode = data.partnerCloneMode || null;
const cloneLevel = data.partnerCloneLevel || null;
const cloneQuestions = data.partnerCloneQuestions || [];
const cloneAnswers = data.partnerCloneAnswers || [];
const p2Name = data.p2Name || "Partner";

const currentIndex = cloneAnswers.length;
const currentQuestion = cloneQuestions[currentIndex] || null;

/* ---------------- HELPERS ---------------- */

const getCloneQuestions = (mode, level) => {
const bank =
mode === "mcq"
  ? window.PARTNER_CLONE_MCQ_QUESTIONS || []
  : window.PARTNER_CLONE_SUBJECTIVE_QUESTIONS || [];

return shuffle(bank).slice(0, LEVEL_COUNT[level]);
};

/* ---------------- RESET ---------------- */

const hardResetClone = () => {
save({
partnerCloneState: "intro",
partnerCloneMode: null,
partnerCloneLevel: null,
partnerCloneQuestions: [],
partnerCloneAnswers: [],
partnerCloneProfile: null,
});
setCloneChat([]);
setCloneInput("");
};

/* ---------------- FLOW ---------------- */

const startClone = () => {
save({
partnerCloneState: "hub",
partnerCloneMode: null,
partnerCloneLevel: null,
partnerCloneQuestions: [],
partnerCloneAnswers: [],
partnerCloneProfile: null,
});
};

const chooseMode = (mode) =>
save({
partnerCloneMode: mode,
partnerCloneState: "level",
});

const chooseLevel = (level) => {
save({
partnerCloneLevel: level,
partnerCloneQuestions: getCloneQuestions(cloneMode, level),
partnerCloneAnswers: [],
partnerCloneState: "questions",
});
setCloneInput("");
setCloneChat([]);
};

const answerQuestion = (val) => {
const next = [...cloneAnswers, val];
save({
partnerCloneAnswers: next,
partnerCloneState:
  next.length >= cloneQuestions.length ? "summary" : "questions",
});
setCloneInput("");
};

/* ---------------- PROFILE BUILD ---------------- */

const finalizeClone = () => {
const profile = cloneAnswers
.map((a, i) => {
  if (!a) return null;
  const q = cloneQuestions[i];
  return q.options
    ? `Q: ${q.text}\nA (${p2Name}): ${a.label}`
    : `Q: ${q.text}\nA (${p2Name}): ${a}`;
})
.filter(Boolean)
.join("\n\n");

save({
partnerCloneProfile: profile,
partnerCloneState: "chat",
});

if (typeof traceAction === "function") {
traceAction("partner_clone_generated", {
  mode: cloneMode,
  level: cloneLevel,
  answered: cloneAnswers.filter(Boolean).length,
});
}
};

/* ---------------- CHAT ---------------- */
const sendCloneMessage = async () => {
const msg = cloneInput.trim();
if (!msg) return;

const partnerTraits = data?.partnerTraits || "";  // ✅ ADD THIS

setCloneInput("");
setCloneChat((c) => [...c, { role: "user", text: msg }]);
setCloneSending(true);

try {
const { data: aiResult, error } =
await supabase.functions.invoke("bond-coach", {
  body: {
    mode: "partner_clone",
    userMessage: msg,
    partnerTraits,
    history: cloneChat,
    stream: false,
  }
});

if (error) throw error;

setCloneChat((c) => [
...c,
{ role: "bot", text: aiResult?.text || "…" },
]);
} catch (err) {
console.error("Partner Clone error:", err);
setCloneChat((c) => [
...c,
{ role: "bot", text: "Something went wrong." },
]);
} finally {
setCloneSending(false);
}
};


/* ======================================================
VERSE OVERVIEW
====================================================== */

if (tab === "overview") {
return (
<div className="p-6 h-full max-w-md mx-auto space-y-4">
  <h2 className="text-2xl font-bold">Verse</h2>
  <p className="text-xs text-bondMuted">
    Meta layer that turns patterns into simulations.
  </p>

  {[
    {
      title: "Safety Scan",
      summary: "Understand emotional safety and flags.",
      ask: "Explain my relationship safety scan.",
    },
    {
      title: "Ideal Match Blueprint",
      summary: "Your needs, clarified.",
      ask: "Summarise my ideal partner blueprint.",
    },
  ].map((c) => (
    <div
      key={c.title}
      className="
        rounded-3xl p-4
        bg-gradient-to-br from-bondSurface to-bondSurfaceSoft
        border border-bondBorder
        transition-all duration-300
        hover:scale-[1.015]
        hover:shadow-sm_22px_rgba(255,105,180,0.12)]
      "
    >
      <h3 className="font-semibold mb-1">{c.title}</h3>
      <p className="text-xs text-bondMuted mb-3">{c.summary}</p>
      <Button onClick={() => openCoachFromReact(c.ask)}>Ask AI</Button>
    </div>
  ))}

  <div
    className="
      rounded-3xl p-4
      bg-gradient-to-br from-bondSurface to-bondSurfaceSoft
      border-2 border-bondAccent/30
      transition-all duration-300
      hover:scale-[1.02]
      hover:shadow-sm_28px_rgba(255,105,180,0.18)]
    "
  >
    <h3 className="font-semibold mb-1">Partner Clone</h3>
    <p className="text-xs text-bondMuted mb-3">
      Practice hard conversations safely.
    </p>
    <Button
      primary
      className="
        w-full bg-gradient-to-r from-text-blue-500-500 via-rose-500 to-amber-400
        transition-all duration-300
        hover:scale-[1.03]
      "
      onClick={() => setTab("clone")}
    >
      Build Partner Clone
    </Button>
  </div>
</div>
);
}

/* ======================================================
PARTNER CLONE
====================================================== */

if (tab === "clone") {
return (
<div className="p-6 h-full max-w-md mx-auto flex flex-col">
  <button
    className="text-xs text-bondMuted mb-4 hover:underline"
    onClick={() => setTab("overview")}
  >
    ← Back to Verse
  </button>

  {cloneState === "intro" && (
    <div className="flex-1 flex flex-col justify-center text-center">
      <h3 className="text-lg font-semibold mb-2">Build Partner Clone</h3>
      <p className="text-xs text-bondMuted mb-6">
        Answer questions about how {p2Name} behaves.
      </p>
      <Button
        primary
        className="bg-gradient-to-r from-text-blue-500-500 to-amber-400"
        onClick={startClone}
      >
        Start
      </Button>
    </div>
  )}

  {cloneState === "hub" && (
    <div className="flex-1 flex flex-col justify-center gap-3">
      <Button primary onClick={() => save({ partnerCloneState: "mode" })}>
        Choose Question Type
      </Button>
      {cloneQuestions.length > 0 && (
        <Button onClick={() => save({ partnerCloneState: "questions" })}>
          Resume Questions
        </Button>
      )}
      <Button onClick={hardResetClone}>Reset Clone</Button>
    </div>
  )}

  {cloneState === "mode" && (
    <>
      <p className="text-xs mb-3">Choose question type</p>
      <Button onClick={() => chooseMode("mcq")}>MCQ</Button>
      <Button className="mt-2" onClick={() => chooseMode("subjective")}>
        Subjective
      </Button>
    </>
  )}

  {cloneState === "level" && (
    <>
      <p className="text-xs mb-3">Choose depth</p>
      {[1, 2, 3].map((l) => (
        <Button key={l} onClick={() => chooseLevel(l)}>
          Level {l} ({LEVEL_COUNT[l]} questions)
        </Button>
      ))}
    </>
  )}

  {cloneState === "questions" && currentQuestion && (
    <div className="flex-1 flex flex-col justify-between">
      <div>
        <p className="text-xs text-bondMuted mb-1">
          {currentIndex + 1}/{cloneQuestions.length}
        </p>

        <h3 className="text-lg font-semibold mb-4">
          {currentQuestion.text}
        </h3>

        {cloneMode === "subjective" && (
          <textarea
            className="
              w-full p-4 rounded-2xl
              bg-[#F4F5F7]
              text-gray-900
              text-[15px] leading-relaxed
              placeholder:text-gray-400
              focus:ring-2 focus:ring-bondAccent/40
              transition-all
            "
            rows={4}
            value={cloneInput}
            onChange={(e) => setCloneInput(e.target.value)}
          />
        )}

        {cloneMode === "mcq" &&
          MCQ_OPTIONS.map((o) => (
            <Button
              key={o.label}
              className="w-full mb-2"
              onClick={() => answerQuestion(o)}
            >
              {o.label}
            </Button>
          ))}
      </div>

      <div className="flex justify-between text-xs text-bondMuted mt-4">
        <button onClick={() => save({ partnerCloneState: "hub" })}>
          Change Mode / Level
        </button>
        <button onClick={() => answerQuestion(null)}>Skip</button>
      </div>
    </div>
  )}

  {cloneState === "summary" && (
    <>
      <Button primary onClick={finalizeClone}>
        Start Practice Chat
      </Button>
      <Button className="mt-2" onClick={() => save({ partnerCloneState: "hub" })}>
        Change Mode / Level
      </Button>
      <Button className="mt-1" onClick={hardResetClone}>
        Start Fresh
      </Button>
    </>
  )}

  {cloneState === "chat" && (
    <>
      <div className="flex-1 overflow-y-auto mb-3 space-y-2">
        {cloneChat.map((m, i) => (
          <div key={i} className="text-sm">
            <strong>{m.role === "user" ? "You" : p2Name}:</strong>{" "}
            {m.text}
          </div>
        ))}
        {cloneSending && (
          <p className="text-xs text-bondMuted">Thinking…</p>
        )}
      </div>

      <input
        className="
          w-full p-3 rounded-2xl
          bg-[#F4F5F7]
          text-gray-900
          focus:ring-2 focus:ring-bondAccent/40
          mb-2
        "
        value={cloneInput}
        onChange={(e) => setCloneInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendCloneMessage()}
      />

      <Button primary onClick={sendCloneMessage}>Send</Button>

      <button
        className="text-xs text-bondMuted mt-3"
        onClick={() => save({ partnerCloneState: "hub" })}
      >
        Back to Clone Hub
      </button>
    </>
  )}
</div>
);
}

return null;
};
// ============================================================
// COMPLETE REPLACEMENT for the broken getGeneratedProfiles stub
// FIND in your file:  function getGeneratedProfiles({ page = 0, pageSize = 20, query = "",
//                     coupleTypeFilter = "all" }) {
//                       const dummy = Array.from...
// REPLACE EVERYTHING from that line until the closing }
// with ALL of this code block
// ============================================================

// ── SEEDED PRNG (deterministic — same seed = same result always) ──
function seededRng(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return function () {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296;
  };
}

// ── INSTITUTION DATABASE (searchable by name/city/state/keywords/nicknames) ──
const _INST_DB = [
  // IITs
  { id:"iitb",   n:"IIT Bombay",              c:"Mumbai",          s:"Maharashtra",     t:"Engineering", tags:["iit","iitb","powai","technical","jee"] },
  { id:"iitd",   n:"IIT Delhi",               c:"New Delhi",       s:"Delhi",           t:"Engineering", tags:["iit","iitd","hauz khas","technical","jee"] },
  { id:"iitm",   n:"IIT Madras",              c:"Chennai",         s:"Tamil Nadu",      t:"Engineering", tags:["iit","iitm","technical","jee","adyar"] },
  { id:"iitk",   n:"IIT Kanpur",              c:"Kanpur",          s:"Uttar Pradesh",   t:"Engineering", tags:["iit","iitk","technical","jee"] },
  { id:"iitr",   n:"IIT Roorkee",             c:"Roorkee",         s:"Uttarakhand",     t:"Engineering", tags:["iit","iitr","technical","jee"] },
  { id:"iitkgp", n:"IIT Kharagpur",           c:"Kharagpur",       s:"West Bengal",     t:"Engineering", tags:["iit","iitkgp","kgp","technical","jee"] },
  { id:"iitg",   n:"IIT Guwahati",            c:"Guwahati",        s:"Assam",           t:"Engineering", tags:["iit","iitg","northeast","technical"] },
  { id:"iith",   n:"IIT Hyderabad",           c:"Hyderabad",       s:"Telangana",       t:"Engineering", tags:["iit","iith","technical","jee"] },
  { id:"iitbhu", n:"IIT BHU Varanasi",        c:"Varanasi",        s:"Uttar Pradesh",   t:"Engineering", tags:["iit","bhu","varanasi","technical"] },
  { id:"iiti",   n:"IIT Indore",              c:"Indore",          s:"Madhya Pradesh",  t:"Engineering", tags:["iit","iiti","technical","jee"] },
  { id:"iitj",   n:"IIT Jodhpur",             c:"Jodhpur",         s:"Rajasthan",       t:"Engineering", tags:["iit","iitj","technical","jee"] },
  { id:"iitp",   n:"IIT Patna",               c:"Patna",           s:"Bihar",           t:"Engineering", tags:["iit","iitp","technical","jee"] },
  { id:"iitrpr", n:"IIT Ropar",               c:"Ropar",           s:"Punjab",          t:"Engineering", tags:["iit","ropar","technical"] },
  { id:"iittt",  n:"IIT Tirupati",            c:"Tirupati",        s:"Andhra Pradesh",  t:"Engineering", tags:["iit","tirupati","technical"] },
  { id:"iitpkd", n:"IIT Palakkad",            c:"Palakkad",        s:"Kerala",          t:"Engineering", tags:["iit","palakkad","kerala","technical"] },
  { id:"iitgoa", n:"IIT Goa",                 c:"Panaji",          s:"Goa",             t:"Engineering", tags:["iit","goa","technical"] },
  { id:"iitjmu", n:"IIT Jammu",               c:"Jammu",           s:"J&K",             t:"Engineering", tags:["iit","jammu","technical"] },
  { id:"ism",    n:"IIT ISM Dhanbad",         c:"Dhanbad",         s:"Jharkhand",       t:"Engineering", tags:["iit","ism","dhanbad","mining"] },
  { id:"iitmdi", n:"IIT Mandi",               c:"Mandi",           s:"Himachal Pradesh",t:"Engineering", tags:["iit","mandi","himachal","technical"] },
  { id:"iitbhl", n:"IIT Bhilai",              c:"Bhilai",          s:"Chhattisgarh",    t:"Engineering", tags:["iit","bhilai","technical"] },
  // IIMs
  { id:"iima",   n:"IIM Ahmedabad",           c:"Ahmedabad",       s:"Gujarat",         t:"Management",  tags:["iim","iima","mba","cat","management"] },
  { id:"iimb",   n:"IIM Bangalore",           c:"Bangalore",       s:"Karnataka",       t:"Management",  tags:["iim","iimb","mba","cat","management","bengaluru"] },
  { id:"iimc",   n:"IIM Calcutta",            c:"Kolkata",         s:"West Bengal",     t:"Management",  tags:["iim","iimc","mba","cat","management","calcutta"] },
  { id:"iimk",   n:"IIM Kozhikode",           c:"Kozhikode",       s:"Kerala",          t:"Management",  tags:["iim","iimk","mba","management","kerala"] },
  { id:"iiml",   n:"IIM Lucknow",             c:"Lucknow",         s:"Uttar Pradesh",   t:"Management",  tags:["iim","iiml","mba","management"] },
  { id:"iimidr", n:"IIM Indore",              c:"Indore",          s:"Madhya Pradesh",  t:"Management",  tags:["iim","indore","mba","management"] },
  { id:"iimrpr", n:"IIM Raipur",              c:"Raipur",          s:"Chhattisgarh",    t:"Management",  tags:["iim","raipur","mba"] },
  { id:"iimrnc", n:"IIM Ranchi",              c:"Ranchi",          s:"Jharkhand",       t:"Management",  tags:["iim","ranchi","mba"] },
  { id:"iimudr", n:"IIM Udaipur",             c:"Udaipur",         s:"Rajasthan",       t:"Management",  tags:["iim","udaipur","mba"] },
  { id:"iimshl", n:"IIM Shillong",            c:"Shillong",        s:"Meghalaya",       t:"Management",  tags:["iim","shillong","northeast","mba"] },
  { id:"iimngp", n:"IIM Nagpur",              c:"Nagpur",          s:"Maharashtra",     t:"Management",  tags:["iim","nagpur","mba"] },
  { id:"iimbdg", n:"IIM Bodh Gaya",           c:"Bodh Gaya",       s:"Bihar",           t:"Management",  tags:["iim","bodh gaya","mba","bihar"] },
  // NITs
  { id:"nitw",   n:"NIT Warangal",            c:"Warangal",        s:"Telangana",       t:"Engineering", tags:["nit","nitw","warangal","technical"] },
  { id:"nitt",   n:"NIT Trichy",              c:"Trichy",          s:"Tamil Nadu",      t:"Engineering", tags:["nit","nitt","trichy","tiruchirappalli","technical"] },
  { id:"nitk",   n:"NIT Surathkal",           c:"Mangalore",       s:"Karnataka",       t:"Engineering", tags:["nit","nitk","surathkal","mangalore","technical"] },
  { id:"nitr",   n:"NIT Rourkela",            c:"Rourkela",        s:"Odisha",          t:"Engineering", tags:["nit","nitr","rourkela","odisha","technical"] },
  { id:"nitc",   n:"NIT Calicut",             c:"Kozhikode",       s:"Kerala",          t:"Engineering", tags:["nit","nitc","calicut","kozhikode","kerala","technical"] },
  { id:"mnit",   n:"MNIT Jaipur",             c:"Jaipur",          s:"Rajasthan",       t:"Engineering", tags:["nit","mnit","jaipur","technical"] },
  { id:"nitdgp", n:"NIT Durgapur",            c:"Durgapur",        s:"West Bengal",     t:"Engineering", tags:["nit","durgapur","bengal","technical"] },
  { id:"nits",   n:"NIT Silchar",             c:"Silchar",         s:"Assam",           t:"Engineering", tags:["nit","silchar","assam","northeast","technical"] },
  { id:"nita",   n:"NIT Agartala",            c:"Agartala",        s:"Tripura",         t:"Engineering", tags:["nit","agartala","tripura","northeast"] },
  { id:"nitp",   n:"NIT Patna",               c:"Patna",           s:"Bihar",           t:"Engineering", tags:["nit","patna","bihar","technical"] },
  { id:"nith",   n:"NIT Hamirpur",            c:"Hamirpur",        s:"Himachal Pradesh",t:"Engineering", tags:["nit","hamirpur","himachal","technical"] },
  { id:"nitjsr", n:"NIT Jamshedpur",          c:"Jamshedpur",      s:"Jharkhand",       t:"Engineering", tags:["nit","jamshedpur","jharkhand","technical"] },
  // BITS
  { id:"bitsp",  n:"BITS Pilani",             c:"Pilani",          s:"Rajasthan",       t:"Engineering", tags:["bits","pilani","technical","jee"] },
  { id:"bitsg",  n:"BITS Pilani Goa",         c:"Goa",             s:"Goa",             t:"Engineering", tags:["bits","goa","technical"] },
  { id:"bitsh",  n:"BITS Pilani Hyderabad",   c:"Hyderabad",       s:"Telangana",       t:"Engineering", tags:["bits","hyderabad","technical"] },
  // IIITs
  { id:"iiith",  n:"IIIT Hyderabad",          c:"Hyderabad",       s:"Telangana",       t:"Engineering", tags:["iiit","hyderabad","technical","coding"] },
  // Delhi NCR
  { id:"dtu",    n:"DTU Delhi",               c:"New Delhi",       s:"Delhi",           t:"Engineering", tags:["dtu","delhi","technical","ncr"] },
  { id:"nsut",   n:"NSUT Delhi",              c:"New Delhi",       s:"Delhi",           t:"Engineering", tags:["nsut","delhi","technical","ncr"] },
  { id:"igdtuw", n:"IGDTUW Delhi",            c:"New Delhi",       s:"Delhi",           t:"Engineering", tags:["igdtuw","delhi","women","technical"] },
  { id:"hansraj",n:"Hansraj College DU",      c:"New Delhi",       s:"Delhi",           t:"Arts/Science",tags:["hansraj","du","delhi","arts","science"] },
  { id:"srcc",   n:"SRCC Delhi",              c:"New Delhi",       s:"Delhi",           t:"Commerce",    tags:["srcc","du","delhi","commerce","economics"] },
  { id:"lsr",    n:"LSR College DU",          c:"New Delhi",       s:"Delhi",           t:"Arts",        tags:["lsr","du","delhi","women","arts"] },
  { id:"miranda",n:"Miranda House DU",        c:"New Delhi",       s:"Delhi",           t:"Arts/Science",tags:["miranda","du","delhi","women","arts"] },
  { id:"hindu",  n:"Hindu College DU",        c:"New Delhi",       s:"Delhi",           t:"Arts/Science",tags:["hindu","du","delhi","arts"] },
  { id:"ststeph", n:"St. Stephen's DU",       c:"New Delhi",       s:"Delhi",           t:"Arts/Science",tags:["stephen","stephens","du","delhi","arts"] },
  { id:"jnu",    n:"JNU",                     c:"New Delhi",       s:"Delhi",           t:"University",  tags:["jnu","delhi","research","social","humanities"] },
  { id:"jamia",  n:"Jamia Millia Islamia",    c:"New Delhi",       s:"Delhi",           t:"University",  tags:["jamia","delhi","university"] },
  // Mumbai / Maharashtra
  { id:"vjti",   n:"VJTI Mumbai",             c:"Mumbai",          s:"Maharashtra",     t:"Engineering", tags:["vjti","mumbai","technical","matunga"] },
  { id:"djsce",  n:"DJ Sanghvi Mumbai",       c:"Mumbai",          s:"Maharashtra",     t:"Engineering", tags:["dj sanghvi","djsce","mumbai","technical","vile parle"] },
  { id:"spit",   n:"SPIT Mumbai",             c:"Mumbai",          s:"Maharashtra",     t:"Engineering", tags:["spit","mumbai","technical","andheri"] },
  { id:"ictm",   n:"ICT Mumbai",              c:"Mumbai",          s:"Maharashtra",     t:"Engineering", tags:["ict","mumbai","chemical","technical","matunga"] },
  { id:"rcoe",   n:"RCOE Mumbai",             c:"Mumbai",          s:"Maharashtra",     t:"Engineering", tags:["rcoe","mumbai","technical"] },
  { id:"vesit",  n:"VESIT Mumbai",            c:"Mumbai",          s:"Maharashtra",     t:"Engineering", tags:["vesit","mumbai","technical","chembur"] },
  { id:"tsec",   n:"TSEC Mumbai",             c:"Mumbai",          s:"Maharashtra",     t:"Engineering", tags:["tsec","mumbai","technical","bandra"] },
  { id:"kjsce",  n:"KJSCE Mumbai",            c:"Mumbai",          s:"Maharashtra",     t:"Engineering", tags:["kjsce","mumbai","technical","vidyavihar"] },
  { id:"rait",   n:"RAIT Navi Mumbai",        c:"Navi Mumbai",     s:"Maharashtra",     t:"Engineering", tags:["rait","navi mumbai","technical","nerul"] },
  { id:"nm",     n:"NM College Mumbai",       c:"Mumbai",          s:"Maharashtra",     t:"Arts/Science",tags:["nm college","vile parle","mumbai","science"] },
  { id:"xicm",   n:"Xavier's Mumbai",         c:"Mumbai",          s:"Maharashtra",     t:"Arts/Science",tags:["xavier","xaviers","mumbai","arts","science"] },
  { id:"jaihind",n:"Jai Hind College",        c:"Mumbai",          s:"Maharashtra",     t:"Arts/Science",tags:["jai hind","mumbai","arts","churchgate"] },
  { id:"ruia",   n:"Ramnarain Ruia College",  c:"Mumbai",          s:"Maharashtra",     t:"Arts/Science",tags:["ruia","mumbai","matunga","arts","science"] },
  { id:"coep",   n:"COEP Pune",               c:"Pune",            s:"Maharashtra",     t:"Engineering", tags:["coep","pune","technical","shivajinagar"] },
  { id:"pict",   n:"PICT Pune",               c:"Pune",            s:"Maharashtra",     t:"Engineering", tags:["pict","pune","technical"] },
  { id:"mitp",   n:"MIT Pune",                c:"Pune",            s:"Maharashtra",     t:"Engineering", tags:["mit pune","pune","technical"] },
  { id:"symbiosis",n:"Symbiosis Pune",        c:"Pune",            s:"Maharashtra",     t:"University",  tags:["symbiosis","siu","pune","business","law"] },
  { id:"fergusson",n:"Fergusson College",     c:"Pune",            s:"Maharashtra",     t:"Arts/Science",tags:["fergusson","pune","arts","science","fcp"] },
  { id:"vitp",   n:"VIT Pune",                c:"Pune",            s:"Maharashtra",     t:"Engineering", tags:["vit pune","pune","technical"] },
  { id:"vnit",   n:"VNIT Nagpur",             c:"Nagpur",          s:"Maharashtra",     t:"Engineering", tags:["vnit","nagpur","technical","nit"] },
  // Bangalore / Karnataka
  { id:"rvce",   n:"RVCE Bangalore",          c:"Bangalore",       s:"Karnataka",       t:"Engineering", tags:["rvce","bangalore","bengaluru","technical","mysore road"] },
  { id:"bmsce",  n:"BMSCE Bangalore",         c:"Bangalore",       s:"Karnataka",       t:"Engineering", tags:["bmsce","bangalore","bengaluru","technical","bull temple"] },
  { id:"pesit",  n:"PESIT Bangalore",         c:"Bangalore",       s:"Karnataka",       t:"Engineering", tags:["pesit","pes","bangalore","bengaluru","technical"] },
  { id:"pesu",   n:"PES University",          c:"Bangalore",       s:"Karnataka",       t:"Engineering", tags:["pes university","pesu","bangalore","bengaluru","technical"] },
  { id:"msrit",  n:"MSRIT Bangalore",         c:"Bangalore",       s:"Karnataka",       t:"Engineering", tags:["msrit","msr","bangalore","bengaluru","technical"] },
  { id:"dsce",   n:"DSCE Bangalore",          c:"Bangalore",       s:"Karnataka",       t:"Engineering", tags:["dsce","dayananda","bangalore","technical"] },
  { id:"bms",    n:"BMS College",             c:"Bangalore",       s:"Karnataka",       t:"Engineering", tags:["bms","bangalore","bengaluru","technical","basavanagudi"] },
  { id:"rnsit",  n:"RNSIT Bangalore",         c:"Bangalore",       s:"Karnataka",       t:"Engineering", tags:["rnsit","bangalore","technical"] },
  { id:"christb",n:"Christ University",       c:"Bangalore",       s:"Karnataka",       t:"University",  tags:["christ","bangalore","bengaluru","arts","law","liberal"] },
  { id:"iisc",   n:"IISc Bangalore",          c:"Bangalore",       s:"Karnataka",       t:"Research",    tags:["iisc","indian institute of science","bangalore","research","pg"] },
  { id:"manipal",n:"Manipal University",      c:"Manipal",         s:"Karnataka",       t:"University",  tags:["manipal","mahe","udupi","medical","engineering"] },
  { id:"nitte",  n:"NITTE Mangalore",         c:"Mangalore",       s:"Karnataka",       t:"Engineering", tags:["nitte","mangalore","deralakatte","technical"] },
  // Chennai / Tamil Nadu
  { id:"vit",    n:"VIT Vellore",             c:"Vellore",         s:"Tamil Nadu",      t:"Engineering", tags:["vit","vellore","technical","viteee"] },
  { id:"srm",    n:"SRM Chennai",             c:"Chennai",         s:"Tamil Nadu",      t:"Engineering", tags:["srm","srmist","chennai","kattankulathur","technical"] },
  { id:"sastra", n:"SASTRA University",       c:"Thanjavur",       s:"Tamil Nadu",      t:"Engineering", tags:["sastra","thanjavur","technical"] },
  { id:"psg",    n:"PSG College of Technology",c:"Coimbatore",     s:"Tamil Nadu",      t:"Engineering", tags:["psg","coimbatore","technical"] },
  { id:"kct",    n:"KCT Coimbatore",          c:"Coimbatore",      s:"Tamil Nadu",      t:"Engineering", tags:["kct","kumaraguru","coimbatore","technical"] },
  { id:"ssnce",  n:"SSNCE Chennai",           c:"Chennai",         s:"Tamil Nadu",      t:"Engineering", tags:["ssn","ssnce","kalavakkam","technical"] },
  { id:"annau",  n:"Anna University",         c:"Chennai",         s:"Tamil Nadu",      t:"University",  tags:["anna university","guindy","chennai","technical"] },
  { id:"saveetha",n:"Saveetha University",    c:"Chennai",         s:"Tamil Nadu",      t:"University",  tags:["saveetha","chennai","medical","dental","engineering"] },
  { id:"sathyabama",n:"Sathyabama University",c:"Chennai",         s:"Tamil Nadu",      t:"University",  tags:["sathyabama","chennai","technical"] },
  // Hyderabad / Telangana / AP
  { id:"cbit",   n:"CBIT Hyderabad",          c:"Hyderabad",       s:"Telangana",       t:"Engineering", tags:["cbit","hyderabad","technical","gandipet"] },
  { id:"vasavi", n:"Vasavi College Hyderabad",c:"Hyderabad",       s:"Telangana",       t:"Engineering", tags:["vasavi","vceh","hyderabad","technical","ibrahimbagh"] },
  { id:"mgit",   n:"MGIT Hyderabad",          c:"Hyderabad",       s:"Telangana",       t:"Engineering", tags:["mgit","hyderabad","technical","gandipet"] },
  { id:"mjcet",  n:"MJCET Hyderabad",         c:"Hyderabad",       s:"Telangana",       t:"Engineering", tags:["mjcet","hyderabad","technical","banjara hills"] },
  { id:"osmania",n:"Osmania University",      c:"Hyderabad",       s:"Telangana",       t:"University",  tags:["osmania","hyderabad","ou","arts","science","law"] },
  { id:"uoh",    n:"University of Hyderabad", c:"Hyderabad",       s:"Telangana",       t:"Research",    tags:["uoh","university of hyderabad","gachibowli","research"] },
  { id:"klu",    n:"KL University",           c:"Vijayawada",      s:"Andhra Pradesh",  t:"Engineering", tags:["kl university","klu","vijayawada","guntur","technical"] },
  { id:"vitap",  n:"VIT AP",                  c:"Amaravati",       s:"Andhra Pradesh",  t:"Engineering", tags:["vit ap","vitap","amaravati","technical"] },
  { id:"gitam",  n:"GITAM University",        c:"Visakhapatnam",   s:"Andhra Pradesh",  t:"University",  tags:["gitam","vizag","visakhapatnam","technical"] },
  // Kolkata / West Bengal
  { id:"ju",     n:"Jadavpur University",     c:"Kolkata",         s:"West Bengal",     t:"Engineering", tags:["jadavpur","ju","kolkata","technical","jadavpur"] },
  { id:"presidency",n:"Presidency University",c:"Kolkata",         s:"West Bengal",     t:"Arts/Science",tags:["presidency","kolkata","science","arts","college street"] },
  { id:"sxck",   n:"St. Xavier's Kolkata",    c:"Kolkata",         s:"West Bengal",     t:"Arts/Science",tags:["xavier","xaviers","kolkata","arts","science"] },
  { id:"cu",     n:"Calcutta University",     c:"Kolkata",         s:"West Bengal",     t:"University",  tags:["calcutta university","cu","kolkata","arts","science"] },
  { id:"heritage",n:"Heritage Institute",     c:"Kolkata",         s:"West Bengal",     t:"Engineering", tags:["heritage","kolkata","technical"] },
  // Kerala
  { id:"cusat",  n:"CUSAT Kochi",             c:"Kochi",           s:"Kerala",          t:"Engineering", tags:["cusat","cochin university","kochi","ernakulam","technical"] },
  { id:"rajagiri",n:"Rajagiri Kochi",         c:"Kochi",           s:"Kerala",          t:"Engineering", tags:["rajagiri","rset","kochi","kakkanad","technical"] },
  { id:"mace",   n:"MACE Kothamangalam",      c:"Ernakulam",       s:"Kerala",          t:"Engineering", tags:["mace","kothamangalam","ernakulam","technical"] },
  { id:"mu",     n:"Model Engineering College",c:"Kochi",          s:"Kerala",          t:"Engineering", tags:["mec","model engineering","kochi","technical"] },
  { id:"ku",     n:"Kerala University",       c:"Trivandrum",      s:"Kerala",          t:"University",  tags:["kerala university","trivandrum","thiruvananthapuram","arts"] },
  // Rajasthan
  { id:"lnmiit", n:"LNMIIT Jaipur",           c:"Jaipur",          s:"Rajasthan",       t:"Engineering", tags:["lnmiit","jaipur","technical","suratgarh"] },
  { id:"poornima",n:"Poornima College",       c:"Jaipur",          s:"Rajasthan",       t:"Engineering", tags:["poornima","jaipur","technical"] },
  { id:"ru",     n:"Rajasthan University",    c:"Jaipur",          s:"Rajasthan",       t:"University",  tags:["rajasthan university","jaipur","arts","science","law"] },
  // MP / Chhattisgarh
  { id:"manit",  n:"MANIT Bhopal",            c:"Bhopal",          s:"Madhya Pradesh",  t:"Engineering", tags:["manit","bhopal","technical","nit"] },
  { id:"davv",   n:"IET DAVV Indore",         c:"Indore",          s:"Madhya Pradesh",  t:"Engineering", tags:["davv","iet","indore","technical"] },
  { id:"rgpv",   n:"RGPV Bhopal",             c:"Bhopal",          s:"Madhya Pradesh",  t:"University",  tags:["rgpv","bhopal","technical","university"] },
  { id:"nitrpr", n:"NIT Raipur",              c:"Raipur",          s:"Chhattisgarh",    t:"Engineering", tags:["nit","raipur","chhattisgarh","technical"] },
  // Gujarat
  { id:"nirma",  n:"Nirma University",        c:"Ahmedabad",       s:"Gujarat",         t:"Engineering", tags:["nirma","ahmedabad","technical","law","management"] },
  { id:"pdpu",   n:"PDPU Gandhinagar",        c:"Gandhinagar",     s:"Gujarat",         t:"Engineering", tags:["pdpu","pandit deendayal","gandhinagar","petroleum","technical"] },
  { id:"charusat",n:"CHARUSAT",               c:"Anand",           s:"Gujarat",         t:"Engineering", tags:["charusat","cspit","anand","gujarat","technical"] },
  { id:"msu",    n:"MSU Baroda",              c:"Vadodara",        s:"Gujarat",         t:"University",  tags:["msu","baroda","vadodara","arts","science","technology"] },
  { id:"ldrp",   n:"LDRP-ITR Gandhinagar",   c:"Gandhinagar",     s:"Gujarat",         t:"Engineering", tags:["ldrp","gandhinagar","technical"] },
  // Punjab / Haryana
  { id:"cu_chd", n:"Chandigarh University",   c:"Chandigarh",      s:"Punjab",          t:"Engineering", tags:["chandigarh university","cu","chandigarh","technical","gharuan"] },
  { id:"lpu",    n:"LPU Jalandhar",           c:"Jalandhar",       s:"Punjab",          t:"University",  tags:["lpu","lovely professional","jalandhar","punjab","technical"] },
  { id:"thapar", n:"Thapar University",       c:"Patiala",         s:"Punjab",          t:"Engineering", tags:["thapar","patiala","technical","deemed"] },
  { id:"chitkara",n:"Chitkara University",    c:"Chandigarh",      s:"Punjab",          t:"Engineering", tags:["chitkara","chandigarh","technical"] },
  { id:"pec",    n:"PEC Chandigarh",          c:"Chandigarh",      s:"Punjab",          t:"Engineering", tags:["pec","punjab engineering","chandigarh","technical","sector 12"] },
  // Uttar Pradesh
  { id:"hbtu",   n:"HBTU Kanpur",             c:"Kanpur",          s:"Uttar Pradesh",   t:"Engineering", tags:["hbtu","harcourt butler","kanpur","technical"] },
  { id:"jiit",   n:"JIIT Noida",              c:"Noida",           s:"Uttar Pradesh",   t:"Engineering", tags:["jiit","jaypee","noida","sector 62","technical"] },
  { id:"galgotias",n:"Galgotias University",  c:"Greater Noida",   s:"Uttar Pradesh",   t:"Engineering", tags:["galgotias","greater noida","technical","ncr"] },
  { id:"bennett",n:"Bennett University",      c:"Greater Noida",   s:"Uttar Pradesh",   t:"University",  tags:["bennett","times","greater noida","technical","journalism"] },
  { id:"sharda", n:"Sharda University",       c:"Greater Noida",   s:"Uttar Pradesh",   t:"University",  tags:["sharda","greater noida","technical","ncr"] },
  { id:"gl",     n:"GL Bajaj Institute",      c:"Greater Noida",   s:"Uttar Pradesh",   t:"Engineering", tags:["gl bajaj","greater noida","technical"] },
  { id:"amity",  n:"Amity University",        c:"Noida",           s:"Uttar Pradesh",   t:"University",  tags:["amity","noida","lucknow","technical","management","ncr"] },
  // Bihar / Jharkhand / Odisha
  { id:"kiit",   n:"KIIT Bhubaneswar",        c:"Bhubaneswar",     s:"Odisha",          t:"Engineering", tags:["kiit","bhubaneswar","odisha","technical","patia"] },
  { id:"cutm",   n:"CUTM Bhubaneswar",        c:"Bhubaneswar",     s:"Odisha",          t:"University",  tags:["cutm","bhubaneswar","odisha","technical"] },
  // Northeast
  { id:"gauhati",n:"Gauhati University",      c:"Guwahati",        s:"Assam",           t:"University",  tags:["gauhati","guwahati","assam","northeast","arts","science"] },
  { id:"dibrugarh",n:"Dibrugarh University",  c:"Dibrugarh",       s:"Assam",           t:"University",  tags:["dibrugarh","assam","northeast","university"] },
  // Goa
  { id:"gce",    n:"Goa College of Engineering",c:"Panaji",        s:"Goa",             t:"Engineering", tags:["gce","goa college","panaji","farmagudi","technical"] },
  // J&K
  { id:"nitsri", n:"NIT Srinagar",            c:"Srinagar",        s:"J&K",             t:"Engineering", tags:["nit srinagar","srinagar","kashmir","technical"] },
  // School / Coaching / Exam pages
  { id:"allen",  n:"Allen Kota",              c:"Kota",            s:"Rajasthan",       t:"Coaching",    tags:["allen","kota","coaching","jee","neet","dropper"] },
  { id:"resonance",n:"Resonance Kota",        c:"Kota",            s:"Rajasthan",       t:"Coaching",    tags:["resonance","kota","coaching","jee","dropper"] },
  { id:"fiitjee",n:"FIITJEE",                 c:"New Delhi",       s:"Delhi",           t:"Coaching",    tags:["fiitjee","coaching","jee","delhi","ncr"] },
  { id:"narayana",n:"Narayana Coaching",      c:"Hyderabad",       s:"Telangana",       t:"Coaching",    tags:["narayana","sri chaitanya","coaching","neet","jee","hyderabad"] },
  { id:"dps",    n:"DPS Schools",             c:"New Delhi",       s:"Delhi",           t:"School",      tags:["dps","delhi public school","school","cbse","delhi","ncr"] },
  { id:"kv",     n:"Kendriya Vidyalaya",      c:"New Delhi",       s:"Delhi",           t:"School",      tags:["kv","kendriya vidyalaya","school","cbse"] },
  { id:"sainik", n:"Sainik School",           c:"Various",         s:"India",           t:"School",      tags:["sainik","military","school","nda","defence"] },
  // Niche content pages
  { id:"jee_asp",  n:"JEE Aspirants",         c:"Kota",            s:"Rajasthan",       t:"Community",   tags:["jee","aspirant","dropper","preparation","iit","neet"] },
  { id:"hostel",   n:"Hostel Life",           c:"Various",         s:"India",           t:"Community",   tags:["hostel","campus","college life","mess","warden","night out"] },
  { id:"placement",n:"Placement Season",      c:"Various",         s:"India",           t:"Community",   tags:["placement","internship","campus","ctc","offer letter","hr"] },
  { id:"mhcet",    n:"MHTCET Students",       c:"Mumbai",          s:"Maharashtra",     t:"Community",   tags:["mhtcet","mhcet","maharashtra","engineering","entrance"] },
  { id:"kcet",     n:"KCET Students",         c:"Bangalore",       s:"Karnataka",       t:"Community",   tags:["kcet","karnataka","engineering","entrance","cet"] },
  { id:"wbjee",    n:"WBJEE Students",        c:"Kolkata",         s:"West Bengal",     t:"Community",   tags:["wbjee","west bengal","engineering","entrance"] },
  { id:"gate",     n:"GATE Aspirants",        c:"Various",         s:"India",           t:"Community",   tags:["gate","psu","m.tech","research","pg","exam"] },
  { id:"upsc",     n:"UPSC Aspirants",        c:"New Delhi",       s:"Delhi",           t:"Community",   tags:["upsc","civil services","ias","ips","mukherjee nagar","rajinder nagar"] },
  { id:"cat_asp",  n:"CAT / MBA Aspirants",   c:"Various",         s:"India",           t:"Community",   tags:["cat","mba","xat","snap","management","b-school"] },
  { id:"situationship",n:"Situationship Era", c:"Various",         s:"India",           t:"Community",   tags:["situationship","talking stage","ghosting","gen z","dating","attachment"] },
  { id:"mentalhealth",n:"Mental Health Campus",c:"Various",        s:"India",           t:"Community",   tags:["mental health","therapy","anxiety","adhd","burnout","campus","stress"] },
  { id:"genzcampus",n:"Gen Z Campus Life",    c:"Various",         s:"India",           t:"Community",   tags:["gen z","overthinking","people pleaser","relatable","campus","college"] },
];

// ── NAMES BY REGION (500+ unique names, no repeats in top 20) ──
const _NAMES = {
  north: {
    m: ["Aryan","Rohan","Aditya","Vikram","Rahul","Karan","Ishaan","Nikhil","Shivam","Prateek",
        "Anuj","Varun","Dev","Yash","Harsh","Siddharth","Lakshay","Mohit","Ankit","Gaurav",
        "Rishabh","Akash","Ayush","Rohit","Kartik","Ashutosh","Vivek","Rajat","Manav","Parth",
        "Arnav","Sachin","Aman","Uday","Naman","Tushar","Sumit","Vishal","Deepak","Kuldeep",
        "Piyush","Shubham","Himanshu","Tanmay","Abhishek","Raghav","Shreyas","Akshat","Dhruv","Ishan"],
    f: ["Priya","Sneha","Pooja","Ankita","Riya","Simran","Neha","Divya","Kavya","Isha",
        "Anjali","Sakshi","Nidhi","Kritika","Swati","Pallavi","Tanya","Shreya","Mehak","Radhika",
        "Anamika","Ritika","Shalini","Muskan","Khushi","Kiran","Jyoti","Sonia","Nisha","Preeti",
        "Varsha","Seema","Renu","Shweta","Gunjan","Tanvi","Aparna","Chhavi","Ipshita","Disha",
        "Akansha","Pranjal","Rashmi","Deepika","Shipra","Garima","Bhavna","Meghna","Aditi","Ruchika"],
  },
  south: {
    m: ["Arjun","Karthik","Vivek","Arun","Suresh","Naveen","Deepak","Ravi","Anand","Sai",
        "Pranav","Tarun","Ashwin","Ajay","Harish","Manoj","Bharath","Ganesh","Balaji","Venkat",
        "Srikanth","Ramesh","Kishore","Lokesh","Aakash","Varun","Rahul","Sriram","Dinesh","Mahesh",
        "Akhil","Nikhil","Vijay","Charan","Jaswanth","Pavan","Rohith","Sashank","Vinay","Anirudh",
        "Krishnakanth","Siddharth","Bharadwaj","Tejasvi","Hemant","Vaibhav","Abhinav","Vikranth","Suraj","Nithish"],
    f: ["Priya","Divya","Kavya","Sindhu","Lakshmi","Swetha","Ananya","Pooja","Meghna","Nithya",
        "Srividya","Sowmya","Amrita","Deepika","Ramya","Lavanya","Bhavana","Keerthy","Varsha","Nandini",
        "Vaishnavi","Madhuri","Sruthi","Harini","Kalyani","Anusha","Pavithra","Sneha","Aishwarya","Rohini",
        "Padmavathi","Supriya","Archana","Swapna","Srujana","Revathi","Gayathri","Sirisha","Manasa","Deepthi",
        "Pratheeksha","Sahithi","Rithika","Chandana","Tejasri","Mounika","Poornima","Akshitha","Bhavya","Nirupama"],
  },
  west: {
    m: ["Yash","Mihir","Dhruv","Raj","Neel","Jay","Parth","Vivaan","Arav","Hriday",
        "Naksh","Pratik","Vatsal","Kunal","Rishi","Manav","Het","Manan","Aarav","Vrund",
        "Darshan","Jimit","Krish","Shubh","Sarvesh","Chirag","Bhavik","Dhaval","Ketan","Rushil",
        "Param","Vedant","Aadit","Yuvraj","Akshar","Nirav","Veer","Soham","Romil","Madhav",
        "Tanmay","Priyank","Hardik","Jainil","Nikunj","Smit","Ruchit","Vivek","Sahil","Arpit"],
    f: ["Riya","Nidhi","Mahi","Khushi","Jahnvi","Sejal","Drashti","Smita","Trisha","Urvi",
        "Nisha","Palak","Vinal","Hetal","Foram","Maitri","Devyani","Anika","Avni","Riddhi",
        "Siddhi","Naini","Poonam","Bijal","Tejal","Nehal","Kirti","Dimple","Aarohi","Bhumi",
        "Swara","Vidhi","Vishakha","Charmi","Mansi","Bhavini","Gopi","Prachi","Preeti","Nishtha",
        "Aarti","Rupal","Deepika","Foram","Kruti","Zalak","Dhruti","Jhanvi","Vaidehi","Sonal"],
  },
  east: {
    m: ["Arnab","Sourav","Subham","Debayan","Ritam","Ayan","Anirban","Sayan","Aritra","Niloy",
        "Shouvik","Debarun","Soumyajit","Pritam","Sumit","Barun","Tanmoy","Sudipta","Arup","Dipankar",
        "Indranil","Soumadip","Abhirup","Subhajit","Sumon","Sayantan","Prithwish","Sougata","Rishav","Abhijit",
        "Rahul","Rohan","Arko","Supriya","Biplab","Shibaji","Mainak","Subhasish","Sandipan","Dibyendu",
        "Jayanta","Samaresh","Subhankar","Aniket","Partha","Souradeep","Tapan","Kaushik","Alokananda","Debashis"],
    f: ["Shreya","Ankita","Puja","Trisha","Ananya","Arpita","Sohini","Debarati","Priyanka","Tiyasa",
        "Suparna","Ipsita","Sayantika","Subhasree","Nabanita","Koyel","Rituparna","Paromita","Ishita","Malini",
        "Sudeshna","Sharmistha","Lopamudra","Sutapa","Sanghamitra","Indrani","Baisakhi","Aditi","Riya","Sarbani",
        "Chandrima","Nibedita","Paramita","Susmita","Mandira","Tithi","Moumita","Tanusree","Arunima","Somrita",
        "Pritha","Sreeja","Urmi","Bratati","Barnali","Suchandra","Dipannita","Soumyashree","Raspriya","Laboni"],
  },
};

// ── COUPLE TYPES WITH REALISTIC WEIGHTS ──
const _CTYPES = [
  { v:"Friends to Lovers", w:26 },
  { v:"Romantic",          w:22 },
  { v:"Long Distance",     w:18 },
  { v:"Situationship",     w:16 },
  { v:"Engaged",           w:10 },
  { v:"Married",           w:8  },
];

// ── BACKSTORY TEMPLATES (keyword-aware) ──
const _STORIES = [
  (a,b,inst) => `Met at ${inst}'s annual technical fest. ${a} accidentally spilled chai on ${b}'s notes. Never really apologised properly.`,
  (a,b,inst) => `Placed in the same lab group in first year at ${inst}. Three assignments later, something shifted.`,
  (a,b,inst) => `${a} was ${b}'s senior at ${inst}. One late-night canteen conversation turned into many.`,
  (a,b,inst) => `Rivals in every placement mock at ${inst}. Started prepping together. Stopped competing.`,
  (a,b,inst) => `${b} helped ${a} survive backlog semester at ${inst}. Kept showing up even after the exams ended.`,
  (a,b,inst) => `Sat next to each other on the ${inst} orientation day bus. Talked the whole way. Still talking.`,
  (a,b,inst) => `${a} kept asking ${b} for notes in ${inst}'s library. One day ${b} just sat down and explained it all.`,
  (a,b,inst) => `Matched on Hinge. Realised they'd been in the same ${inst} classroom for two semesters already.`,
  (a,b,inst) => `${a} did ${b}'s canteen run at midnight during ${inst}'s exam week. Twice. Then it became routine.`,
  (a,b,inst) => `Both showed up solo to ${inst}'s cultural night. Left together. Been attached since.`,
  (a,b,inst) => `${b} voted for ${a} in the ${inst} student elections. Asked nothing. Got everything.`,
  (a,b,inst) => `Bonded over hating the same professor at ${inst}. Also liked the same playlist.`,
  (a,b,inst) => `${a} was training for the ${inst} marathon. ${b} joined "just to try once." Three months of 6am runs later.`,
  (a,b,inst) => `Shared a project submission panic at ${inst} at 3am. Filed at 3:58am. Coffee at 4am. Date by Friday.`,
  (a,b,inst) => `${b} kept appearing in the background of ${a}'s reels from ${inst} events until someone pointed it out.`,
  (a,b,inst) => `${a} and ${b} were the last two people every time at ${inst}'s library before closing. For a whole semester.`,
  (a,b,inst) => `They were on opposing teams at ${inst}'s inter-hostel debate. Argued for three hours after it ended.`,
  (a,b,inst) => `${b} borrowed ${a}'s charger once during a ${inst} lecture. Never really returned it. Still hasn't.`,
  (a,b,inst) => `Both complained about the same thing in the ${inst} feedback form. Admin assigned them to the same committee.`,
  (a,b,inst) => `${a} showed up to the wrong ${inst} lecture room. ${b} was the only one who didn't make it awkward.`,
  (a,b,inst) => `Their groups sat at adjacent tables at ${inst}'s freshers' party. They ended up at the same table by 10pm.`,
  (a,b,inst) => `${b} was ${a}'s emergency contact during ${inst}'s off-campus industrial visit. No emergency happened. Something else did.`,
  (a,b,inst) => `Both got placed in the same company through ${inst}'s campus drive. Now they carpool to work.`,
  (a,b,inst) => `${a} and ${b} were both waiting outside the same professor's office at ${inst} for the same reason. For an hour.`,
  (a,b,inst) => `Started as WhatsApp group chat admins for the same ${inst} batch year. Ended up managing more than the group.`,
];

// ── WEIGHTED RANDOM PICK ──
function _wpick(rng, arr) {
  const tot = arr.reduce((s, x) => s + x.w, 0);
  let r = rng() * tot;
  for (const x of arr) { r -= x.w; if (r <= 0) return x; }
  return arr[arr.length - 1];
}

// ── GET REGION FOR INSTITUTION ──
function _region(inst) {
  const map = {
    Maharashtra:"west", Gujarat:"west", Goa:"west",
    Rajasthan:"north", Delhi:"north", "Uttar Pradesh":"north",
    Punjab:"north", Haryana:"north", "Himachal Pradesh":"north",
    Uttarakhand:"north", "J&K":"north", "Madhya Pradesh":"north",
    Chhattisgarh:"north",
    Bihar:"east", Jharkhand:"east", "West Bengal":"east",
    Odisha:"east", Assam:"east", Meghalaya:"east", Tripura:"east",
    Manipur:"east", Nagaland:"east", Mizoram:"east", Sikkim:"east",
    "Tamil Nadu":"south", Kerala:"south", Karnataka:"south",
    Telangana:"south", "Andhra Pradesh":"south",
    India:"north",
  };
  return map[inst.s] || "north";
}

// ── MAIN GENERATOR ──
function _gen(instIdx, profIdx) {
  const inst = _INST_DB[instIdx];
  if (!inst) return null;
  const seed = (instIdx * 1009 + profIdx * 37 + 0x4b1d) >>> 0;
  const rng = seededRng(seed);

  const reg = _region(inst);
  const bank = _NAMES[reg];
  const ml = bank.m, fl = bank.f;

  // Pick unique names
  const g = rng();
  let n1, n2;
  if (g < 0.65) {
    n1 = ml[Math.floor(rng() * ml.length)];
    n2 = fl[Math.floor(rng() * fl.length)];
  } else if (g < 0.82) {
    n1 = fl[Math.floor(rng() * fl.length)];
    n2 = fl[Math.floor(rng() * fl.length)];
    let tries = 0;
    while (n1 === n2 && tries++ < 8) n2 = fl[Math.floor(rng() * fl.length)];
  } else {
    n1 = ml[Math.floor(rng() * ml.length)];
    n2 = ml[Math.floor(rng() * ml.length)];
    let tries = 0;
    while (n1 === n2 && tries++ < 8) n2 = ml[Math.floor(rng() * ml.length)];
  }

  const ctype = _wpick(rng, _CTYPES).v;

  const base  = Math.floor(rng() * 45) + 45;   // 45–90
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const bond              = clamp(base + Math.floor((rng()-0.5)*12), 40, 99);
  const emotional_sync    = clamp(base + Math.floor((rng()-0.5)*18), 38, 99);
  const stability         = clamp(base + Math.floor((rng()-0.5)*18), 38, 99);
  const growth            = clamp(base + Math.floor((rng()-0.5)*18), 38, 99);

  const storyFn = _STORIES[Math.floor(rng() * _STORIES.length)];
  const backstory = storyFn(n1, n2, inst.n);

  // ── REACTIONS — realistically varied (some viral, most normal) ──
  const virality = rng();
  let totalR;
  if (virality > 0.97)      totalR = Math.floor(rng() * 80000) + 60000;   // viral: 60k–140k
  else if (virality > 0.92) totalR = Math.floor(rng() * 12000) + 8000;    // popular: 8k–20k
  else if (virality > 0.80) totalR = Math.floor(rng() * 2500)  + 800;     // decent: 800–3.3k
  else if (virality > 0.60) totalR = Math.floor(rng() * 400)   + 80;      // average: 80–480
  else if (virality > 0.35) totalR = Math.floor(rng() * 60)    + 18;      // low: 18–78
  else                       totalR = Math.floor(rng() * 14)    + 4;       // fresh: 4–18

  const emojis = ["❤️","😍","🔥","💯","🥹"];
  const reactions = {};
  let rem = totalR;
  const shares = emojis.map(() => rng());
  const tot = shares.reduce((a, b) => a + b, 0);
  emojis.forEach((e, i) => {
    const alloc = i < emojis.length - 1
      ? Math.floor((shares[i] / tot) * totalR)
      : rem;
    reactions[e] = Math.max(0, alloc);
    rem -= reactions[e];
  });

  // ── COMMENTS — correlated with reactions but noisier ──
  const commentCount = Math.max(
    1,
    Math.floor(totalR * (0.04 + rng() * 0.12) + rng() * 8)
  );

  return {
    id: `__gen_${inst.id}_${profIdx}`,
    couple_name: `${n1} & ${n2}`,
    partner1_name: n1,
    partner2_name: n2,
    couple_type: ctype,
    bond_score: bond,
    emotional_sync_score: emotional_sync,
    stability_score: stability,
    growth_index: growth,
    institution: inst.n,
    locality: inst.s === "India" ? inst.c : `${inst.c}, ${inst.s}`,
    backstory,
    avatar_url: null,
    _isPlaceholder: true,
    _seed_reactions: reactions,
    _seed_comment_count: commentCount,
    _inst_id: inst.id,
    _inst_short: inst.id.toUpperCase(),
  };
}

// ── SEARCH MATCHER — rich keyword matching ──
function _matches(inst, q) {
  if (!q) return true;
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [
    inst.n, inst.c, inst.s, inst.t, inst.id,
    ...inst.tags,
  ].map(x => x.toLowerCase()).join(" ");
  // All terms must hit (AND logic so "iit bombay" is precise, "mumbai" is broad)
  return terms.every(term => haystack.includes(term));
}

// ── PUBLIC API ──
function getGeneratedProfiles({
  page = 0,
  pageSize = 20,
  query = "",
  coupleTypeFilter = "all",
} = {}) {
  const q = (query || "").trim();

  // Find matching institutions
  let matchingIdxs = _INST_DB
    .map((inst, idx) => ({ inst, idx }))
    .filter(({ inst }) => _matches(inst, q))
    .map(({ idx }) => idx);

  // If no institution matches the keyword, still guarantee 100+ profiles
  // by generating from ALL institutions but tagging them as "related"
  // This ensures every keyword search returns results
  const PROFILES_PER_INST = 150;
  const MIN_PROFILES = 100;

  if (matchingIdxs.length === 0) {
    // Soft fallback: generate from all institutions but filter backstories
    // that mention keywords loosely
    matchingIdxs = _INST_DB.map((_, i) => i);
  }

  // Build virtual flat index [instIdx, profIdx]
  const flat = [];
  for (const instIdx of matchingIdxs) {
    for (let p = 0; p < PROFILES_PER_INST; p++) {
      flat.push([instIdx, p]);
    }
  }

  // Guarantee at least MIN_PROFILES even for narrow searches
  // by cycling through more profile indices if needed
  let extraIdx = 0;
  while (flat.length < MIN_PROFILES && matchingIdxs.length > 0) {
    for (const instIdx of matchingIdxs) {
      flat.push([instIdx, PROFILES_PER_INST + extraIdx]);
    }
    extraIdx++;
    if (extraIdx > 20) break;
  }

  const start = page * pageSize;
  const slice = flat.slice(start, start + pageSize);
  let profiles = slice
    .map(([iIdx, pIdx]) => _gen(iIdx, pIdx))
    .filter(Boolean);

  if (coupleTypeFilter !== "all") {
    profiles = profiles.filter(p => p.couple_type === coupleTypeFilter);
  }

  return {
    profiles,
    total: flat.length,
    hasMore: start + pageSize < flat.length,
  };
}
/* -------------------------------------------------------
DASHBOARD (clean DP header + floating AI Coach)
-------------------------------------------------------- */

const Dashboard = ({ data, save, view, setView, onReset }) => {
const askAIHelp = () => {
try {
if (typeof toggleBondCoach === "function") {
  toggleBondCoach();
}
const input = document.getElementById("coachInput");
if (input) input.focus();
} catch (err) {
console.warn("Coach open error", err);
}
};
return (

<div className="flex flex-col h-screen bg-bondBg text-bondText overflow-hidden">
```
{/* ---------------- TOP BAR (SIMPLIFIED) ---------------- */}
<div className="px-5 py-3 border-b border-bondBorder flex justify-between items-center bg-bondSurface/70 backdrop-blur-md shadow-sm">


  {/* RIGHT: EMPTY (kept for spacing balance) */}
  <div />
</div>
{/* ---------------- MAIN ---------------- */}
<div className="flex-1 min-h-0">
  <ErrorBoundary>
    <div className="h-full overflow-y-auto custom-scroll px-1">
      {{
        test: <TestHub data={data} save={save} setActiveProfile={null} setScreen={null} />,
        play: <PlayHub data={data} save={save} />,
        plan: <PlanHub data={data} save={save} />,
        verse: <VerseHub data={data} save={save} />,
        couple: <CoupleHub data={data} save={save} />,
        moods: <MoodHub currentUser={window.currentUser} />,
      }[view] || <TestHub data={data} save={save} setActiveProfile={null} setScreen={null} />}
    </div>
  </ErrorBoundary>
</div>

{/* ---------------- FLOATING AI COACH ---------------- */}
<button
  className={`bond-ai-orb transition-all duration-300 ${
    view === "partnerClone" && cloneState === "chat"
      ? "bond-ai-orb--raised"
      : ""
  }`}
  onClick={askAIHelp}
  title="Ask Bond Coach"
>
  <Icon name="sparkles" className="w-6 h-6" />
</button>
/* -------------------------------------------------------
FIREBASE SETUP
-------------------------------------------------------- */

/* -------------------------------------------------------
SUPABASE AUTH SETUP (TOP OF FILE – OUTSIDE COMPONENT)
-------------------------------------------------------- */

/* ---------------- USER UPSERT ---------------- */
async function upsertUserFromSupabase(user) {
  let authUser = user;

  if (!authUser?.id) {
    const {
      data: { user: fetchedUser },
    } = await window.supabaseClient.auth.getUser();

    authUser = fetchedUser;
  }

  if (!authUser?.id) {
    console.error("[upsertUserFromSupabase] No authenticated user");
    return null;
  }

  const rawUsername =
    authUser.user_metadata?.preferred_username ||
    authUser.user_metadata?.user_name ||
    authUser.user_metadata?.full_name ||
    authUser.user_metadata?.name ||
    authUser.email?.split("@")[0] ||
    "user";

  const sanitised = rawUsername
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 28);

  const base = sanitised.length >= 2
    ? sanitised
    : "user_" + authUser.id.slice(0, 6);

  const { data: existing } = await window.supabaseClient
    .from("profiles")
    .select("username, id")
    .eq("username", base)
    .maybeSingle();

  const username =
    existing && existing.id !== authUser.id
      ? base + "_" + Math.random().toString(36).slice(2, 5)
      : base;

  const { error } = await window.supabaseClient
    .from("profiles")
    .upsert(
      {
        id: authUser.id,
        username,
        display_name:
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          username,
        is_public: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("[upsertUserFromSupabase] failed:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  localStorage.setItem("bond_username", username);
  window.BOND_USERNAME = username;
  window.currentUser = authUser;

  console.log("[upsertUserFromSupabase] username saved:", username);
  return username;
}
/* ============================================================
BLOCK 2 — REPLACE → const UsernameLoginScreen
============================================================ */
const UsernameLoginScreen = ({ onLogin, onGuest }) => {
const [value,  setValue]  = React.useState("");
const [error,  setError]  = React.useState("");
const [busy,   setBusy]   = React.useState(false);
const [sentTo, setSentTo] = React.useState("");

// ✅ Detect Instagram iOS
const isInstagramIOS = !!window.__IS_INSTAGRAM_IOS__;

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// ── Track login page visit ──
React.useEffect(() => {
  try {
    let sessionId = localStorage.getItem("bond_anon_id") || crypto.randomUUID();
    supabase.from("events_v2").insert({
      session_id: sessionId,
      category: "navigation",
      name: "page_view",
      screen: "login",
      user_id: null,
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn("[track] login view failed", e);
  }
}, []);

const submit = async () => {
const v = value.trim();
if (!v)               return setError("Enter your email to continue.");
if (!isValidEmail(v)) return setError("Enter a valid email address.");
try {
setBusy(true); setError("");
await supabase.auth.signInWithOtp({
  email: v,
  options: { emailRedirectTo: window.location.origin }
});
setSentTo(v);
} catch (e) {
console.error(e);
setError("Could not send link. Try again.");
} finally {
setBusy(false);
}
};

const handleGoogle = async () => {
try {
setBusy(true); setError("");
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: window.location.origin }
});
} catch (e) {
setError("Google login failed.");
setBusy(false);
}
};

const handleMeta = async () => {
try {
setBusy(true); setError("");
await supabase.auth.signInWithOAuth({
  provider: "facebook",
  options: { redirectTo: window.location.origin }
});
} catch (e) {
setError("Meta login failed.");
setBusy(false);
}
};

/* ── Sent state ── */
if (sentTo) return (
<div
className="min-h-screen flex flex-col items-center justify-center px-6"
style={{ background: "radial-gradient(ellipse at top, #0d1424 0%, #020617 100%)" }}
>
<div className="w-full max-w-sm text-center space-y-5">
  <div
    className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl"
    style={{ background: "linear-gradient(135deg, #f87171, #fb923c)" }}
  >
    ✉
  </div>
  <h2 className="text-xl font-semibold text-white">Check your inbox</h2>
  <p className="text-sm text-gray-400 leading-relaxed">
    We sent a login link to<br />
    <span className="text-white font-medium">{sentTo}</span>
  </p>
  <button
    onClick={() => setSentTo("")}
    className="text-xs text-gray-600 hover:text-gray-400 transition underline"
  >
    Use a different email
  </button>
</div>
</div>
);

/* ── Main login screen ── */
return (
<div
className="min-h-screen flex flex-col items-center justify-center px-5 py-10"
style={{ background: "radial-gradient(ellipse at top, #0d1424 0%, #020617 100%)" }}
>
<div className="w-full max-w-sm space-y-8">

  {/* Logo */}
  <div className="text-center space-y-1">
    <h1
      className="text-5xl font-black tracking-tight"
      style={{
        background: "linear-gradient(135deg, #f87171 0%, #fb923c 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
    >
      Bond.O.S
    </h1>
    <p className="text-xs text-gray-600 tracking-widest uppercase">
      Relationship Operating System
    </p>
  </div>

  {/* Card */}
  <div
    className="rounded-3xl p-6 space-y-4"
    style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(20px)",
    }}
  >
    {/* Email input */}
    <div className="space-y-2">
      <input
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(""); }}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Email or phone"
        type="email"
        autoComplete="email"
        className="w-full px-4 py-3.5 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none transition"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      />
      {error && (
        <p className="text-xs text-red-400 px-1">{error}</p>
      )}
    </div>

    {/* Continue button */}
    <button
      onClick={submit}
      disabled={busy}
      className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50"
      style={{
        background: busy
          ? "rgba(248,113,113,0.5)"
          : "linear-gradient(135deg, #f87171 0%, #fb923c 100%)",
      }}
    >
      {busy ? "Sending…" : "Continue"}
    </button>

    {/* Divider — only show if OAuth visible */}
    {!isInstagramIOS && (
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
        <span className="text-xs text-gray-600">or</span>
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
      </div>
    )}

    {/* OAuth buttons — hidden on Instagram iOS */}
    {!isInstagramIOS && (
      <div className="space-y-2.5">
        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full py-3 rounded-2xl text-sm font-medium text-white transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2.5"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <button
          onClick={handleMeta}
          disabled={busy}
          className="w-full py-3 rounded-2xl text-sm font-medium text-white transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2.5"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Continue with Meta
        </button>
      </div>
    )}

    {/* ✅ Instagram iOS note — email only */}
    {isInstagramIOS && (
      <p style={{
        fontSize: "12px",
        color: "rgba(255,255,255,0.35)",
        textAlign: "center",
        marginTop: "8px",
        lineHeight: "1.6"
      }}>
        Use email login above ↑<br/>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>
          Open in Safari for Google / Meta login
        </span>
      </p>
    )}
  </div>

  {/* Guest */}
  <div className="text-center">
    <button
      onClick={onGuest}
      className="text-sm transition"
      style={{ color: "rgba(255,255,255,0.35)" }}
    >
      Continue as Guest
    </button>
  </div>

</div>
</div>
);
};
window.UsernameLoginScreen = UsernameLoginScreen;

/* -------------------------------------------------------
APP ROOT + BOND STATE MOUNT (STABLE IDENTITY FIX)
-------------------------------------------------------- */

/* ---------- ANON CONTEXT (ONE-TIME, STABLE) ---------- */
/* ---------- ANON CONTEXT (ONE-TIME, STABLE) ---------- */
const getAnonContext = () => {
let anonId = localStorage.getItem("bond_anon_id");
let firstSeen = localStorage.getItem("bond_first_seen");

if (!anonId) {
anonId = crypto.randomUUID?.() || (
"anon_" +
Math.random().toString(36).slice(2) +
Date.now().toString(36)
);
firstSeen = Date.now().toString();
localStorage.setItem("bond_anon_id", anonId);
localStorage.setItem("bond_first_seen", firstSeen);
localStorage.setItem("bond_is_returning", "false");
}

const isReturning = localStorage.getItem("bond_is_returning") === "true";

if (!isReturning) {
localStorage.setItem("bond_is_returning", "true");
}

return { anonId, isReturning };
};

/* ======================================================
SOCIAL CONTEXT PROVIDER (Stable + robust)
- Uses supabase.auth.getUser() to avoid session flicker
- Subscribes to onAuthStateChange and cleans up properly
- Ensures a profile row exists for the user
====================================================== */
const SocialContext = React.createContext(null);

/* ============================================================
BLOCK A — REPLACE → function SocialProvider()

FIX: Added initializedRef to prevent double-init.
The INITIAL_SESSION event from onAuthStateChange fires
immediately after getSession(). Without the guard, both
trigger a full state reset causing the flicker.
============================================================ */

/* ============================================================
BLOCK 1 — REPLACE → function SocialProvider()

FIX: Removed followers/following queries — follows table
doesn't exist in your DB, causing 3 timeout errors on
every load. Also keeps INITIAL_SESSION guard to stop flicker.
============================================================ */
function SocialProvider({ children }) {
const [user,    setUser]    = React.useState(null);
const [profile, setProfile] = React.useState(null);
const [partner, setPartner] = React.useState(null);
const [loading, setLoading] = React.useState(true);

const initializedRef = React.useRef(false);

const safeQuery = async (fn, label) => {
try {
const res = await Promise.race([
  fn(),
  new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout (${label})`)), 5000)),
]);
return res?.error ? null : (res?.data ?? null);
} catch (err) {
console.warn(`[SocialProvider] ${label} failed:`, err.message);
return null;
}
};

const loadForUser = React.useCallback(async (usr) => {
if (!usr) { setProfile(null); setPartner(null); return; }
const [profileData, partnerData] = await Promise.all([
safeQuery(
  () => window.supabaseClient.from("profiles").select("*").eq("id", usr.id).maybeSingle(),
  "profiles"
),
safeQuery(
  () => window.supabaseClient.from("couples").select("*")
    .or(`creator_id.eq.${usr.id},user1_id.eq.${usr.id}`).maybeSingle(),
  "couples"
),
]);
setProfile(profileData);
setPartner(partnerData);
}, []);

React.useEffect(() => {
let mounted = true;
async function init() {
try {
  const { data } = await window.supabaseClient.auth.getSession();
  const usr = data?.session?.user ?? null;
  if (!mounted) return;
  initializedRef.current = true;
  setUser(usr);
  setLoading(true);
  await loadForUser(usr);
} catch (err) {
  console.error("SocialProvider init:", err);
} finally {
  if (mounted) setLoading(false);
}
}
init();

const { data: sub } = window.supabaseClient.auth.onAuthStateChange(
async (event, session) => {
  if (!mounted) return;
  if (event === "INITIAL_SESSION" && initializedRef.current) return;
  const usr = session?.user ?? null;
  setUser(usr);
  setLoading(true);
  try { await loadForUser(usr); }
  catch (e) { console.error("onAuthStateChange:", e); }
  finally { if (mounted) setLoading(false); }
}
);
return () => {
mounted = false;
try { sub?.subscription?.unsubscribe?.(); } catch (_) {}
};
}, [loadForUser]);

const value = React.useMemo(() => ({
user, profile,
followers: [], following: [],   // removed — table doesn't exist
partner, loading,
refreshSocial: () => user && loadForUser(user),
}), [user, profile, partner, loading]);

return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}



function useSocial() {
const ctx = React.useContext(SocialContext);
if (!ctx) throw new Error("useSocial must be used inside SocialProvider");
return ctx;
}
const feedCache = {};
const FEED_CACHE_MS = 10000;
function SocialFeed() {
const { user } = useSocial();

const [posts, setPosts] = React.useState([]);
const [page, setPage] = React.useState(0);
const [loading, setLoading] = React.useState(false);
const [hasMore, setHasMore] = React.useState(true);

const pageSize = 10;

/* ---------------- LOAD POSTS ---------------- */
const loadPosts = React.useCallback(async () => {
if (loading || !hasMore) return;

setLoading(true);

const from = page * pageSize;
const to = from + pageSize - 1;

const { data, error } = await window.supabaseClient
.from("posts")
.select("*, profiles(username, avatar_url)")
.order("created_at", { ascending: false })
.range(from, to);

if (error) {
console.error("Feed load error:", error);
setLoading(false);
return;
}

if (!data || data.length < pageSize) {
setHasMore(false);
}

setPosts(prev => {
const existingIds = new Set(prev.map(p => p.id));
const filtered = (data || []).filter(p => !existingIds.has(p.id));
return [...prev, ...filtered];
});

setLoading(false);
}, [page, loading, hasMore]);

React.useEffect(() => {
loadPosts();
}, [page]);

/* ---------------- INFINITE SCROLL ---------------- */
React.useEffect(() => {
const handleScroll = () => {
if (
  window.innerHeight + window.scrollY >=
  document.body.offsetHeight - 400
) {
  if (!loading && hasMore) {
    setPage(prev => prev + 1);
  }
}
};

const throttled = throttle(handleScroll, 300);

window.addEventListener("scroll", throttled);
return () => window.removeEventListener("scroll", throttled);
}, [loading, hasMore]);

/* ---------------- REALTIME INSERTS ---------------- */

/* ---------------- EMPTY STATE ---------------- */
if (!loading && posts.length === 0) {
return (
<div className="text-center text-bondMuted p-6">
  No posts yet.
</div>
);
}

/* ---------------- UI ---------------- */
return (
<div className="space-y-4">
{posts.map(post => (
  <div key={post.id} className="bg-white p-4 rounded-2xl shadow">
    <div className="flex items-center gap-2">
      <img
        src={post.profiles?.avatar_url || ""}
        className="w-8 h-8 rounded-full object-cover"
      />
      <span className="font-semibold">
        {post.profiles?.username || "unknown"}
      </span>
    </div>

    <p className="mt-2 text-sm">{post.content}</p>

    <div className="text-xs text-gray-400 mt-2">
      {new Date(post.created_at).toLocaleString()}
    </div>
  </div>
))}

{loading && (
  <div className="text-center py-4">
    <Spinner />
  </div>
)}

{!hasMore && posts.length > 0 && (
  <div className="text-center text-gray-400 py-4 text-sm">
    You've reached the end.
  </div>
)}
</div>
);
}

/* ---------------- SIMPLE THROTTLE UTILITY ---------------- */
function throttle(fn, wait) {
let lastTime = 0;
return function (...args) {
const now = Date.now();
if (now - lastTime >= wait) {
lastTime = now;
fn(...args);
}
};
}
function ProfilePage({ userId }) {
const { user } = useSocial();
const [profile, setProfile] = React.useState(null);

React.useEffect(() => {
let mounted = true;
async function loadProfile() {
const idToLoad = userId || user?.id;
if (!idToLoad) {
  setProfile(null);
  return;
}
const { data } = await window.supabaseClient
  .from("profiles")
  .select("*")
  .eq("id", idToLoad)
  .maybeSingle();
if (!mounted) return;
setProfile(data);
}
loadProfile();
return () => { mounted = false; };
}, [userId, user]);

if (!profile) {
return <div className="text-center text-bondMuted p-6">Profile not found.</div>;
}

return (
<div className="bg-white p-4 rounded-2xl shadow">
<img src={profile.avatar_url || ""} className="w-16 h-16 rounded-full" />
<h2 className="text-xl font-bold mt-2">{profile.username}</h2>
<p>{profile.bio || ""}</p>
</div>
);
}

function FollowButton({ targetUserId }) {
const { user, refreshSocial } = useSocial();
const [isFollowing, setIsFollowing] = React.useState(false);

React.useEffect(() => {
let mounted = true;
async function checkFollow() {
if (!user) return setIsFollowing(false);
const { data } = await window.supabaseClient
  .from("follows")
  .select("*")
  .eq("follower_id", user.id)
  .eq("following", targetUserId)
  .maybeSingle();
if (!mounted) return;
setIsFollowing(!!data);
}
checkFollow();
return () => { mounted = false; };
}, [user, targetUserId]);

async function toggleFollow() {
if (!user) return;
if (isFollowing) {
await window.supabaseClient
  .from("follows")
  .delete()
  .eq("follower_id", user.id)
  .eq("following", targetUserId);
} else {
await window.supabaseClient.from("follows").insert({
  follower_id: user.id,
  following: targetUserId
});
}
setIsFollowing(v => !v);
refreshSocial();
}

return (
<button onClick={toggleFollow} className="px-4 py-2 rounded-xl bg-black text-white">
{isFollowing ? "Unfollow" : "Follow"}
</button>
);
}

function BondChallenges() {
const [challenges, setChallenges] = React.useState([]);
React.useEffect(() => {
let mounted = true;
(async () => {
const { data } = await window.supabaseClient
  .from("challenges")
  .select("*")
  .order("created_at", { ascending: false });
if (mounted) setChallenges(data || []);
})();
return () => { mounted = false; };
}, []);
return (
<div className="bg-yellow-50 p-4 rounded-2xl shadow">
<h2 className="font-bold text-xl">Bond Challenges 🔥</h2>
{challenges.map(c => <div key={c.id} className="bg-white p-3 rounded-xl mt-2">{c.title}</div>)}
</div>
);
}

function Leaderboard() {
const [leaders, setLeaders] = React.useState([]);
React.useEffect(() => {
(async () => {
const { data } = await window.supabaseClient
  .from("profiles")
  .select("username, bond_score")
  .order("bond_score", { ascending: false })
  .limit(10);
setLeaders(data || []);
})();
}, []);
return (
<div className="bg-green-50 p-4 rounded-2xl shadow">
<h2 className="font-bold text-xl">Top Bonds 🏆</h2>
{leaders.map((u, i) => <div key={i} className="flex justify-between mt-2"><span>{u.username}</span><span>{u.bond_score}</span></div>)}
</div>
);
}

function CouplePrivateSpace() {
const { partner, user } = useSocial();
const EMOJIS = ["\u2764\uFE0F","\uD83D\uDE0D","\uD83D\uDD25","\uD83D\uDCAF","\uD83E\uDD79"];
const [posts, setPosts] = React.useState([]);
const [newPost, setNewPost] = React.useState("");
const [posting, setPosting] = React.useState(false);
const [postReactions, setPostReactions] = React.useState({});
const [myPostReactions, setMyPostReactions] = React.useState({});
const [openComments, setOpenComments] = React.useState({});

React.useEffect(() => {
if (!partner) return;
let mounted = true;
(async () => {
const [{ data: postData }, { data: rxnData }] = await Promise.all([
window.supabaseClient.from("posts").select("*").eq("couple_id", partner.id).order("created_at", { ascending: false }),
window.supabaseClient.from("reactions").select("target_id,user_id,reaction_type").eq("target_type","post")
]);
if (!mounted) return;
const pList = postData || [];
const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid");
const rMap = {}, myMap = {};
pList.forEach(p => { rMap[p.id] = {}; EMOJIS.forEach(e => { rMap[p.id][e] = 0; }); });
(rxnData || []).forEach(r => {
if (rMap[r.target_id] && EMOJIS.includes(r.reaction_type)) {
rMap[r.target_id][r.reaction_type] = (rMap[r.target_id][r.reaction_type] || 0) + 1;
if (uid && r.user_id === uid) myMap[r.target_id] = r.reaction_type;
}
});
setPosts(pList); setPostReactions(rMap); setMyPostReactions(myMap);
})();
return () => { mounted = false; };
}, [partner]);

async function createPost() {
if (!newPost.trim() || !partner || !user) return;
setPosting(true);
const { data: row } = await window.supabaseClient.from("posts").insert({
couple_id: partner.id, author_id: user.id, post_type:"couple", type:"text",
content: { text: newPost.trim() }, visibility:"private", created_at: new Date().toISOString()
}).select().single();
if (row) {
setPostReactions(p => { const r = {...p}; r[row.id] = {}; EMOJIS.forEach(e => { r[row.id][e] = 0; }); return r; });
setPosts(prev => [row, ...prev]);
}
setNewPost(""); setPosting(false);
}

async function handlePostReact(postId, emoji) {
const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid");
if (!uid) return;
const prev = myPostReactions[postId];
const isSame = prev === emoji;
setMyPostReactions(p => ({ ...p, [postId]: isSame ? null : emoji }));
setPostReactions(p => {
const r = { ...(p[postId] || {}) };
if (prev && r[prev]) r[prev] = Math.max(0, r[prev] - 1);
if (!isSame) r[emoji] = (r[emoji] || 0) + 1;
return { ...p, [postId]: r };
});
try {
if (prev) {
const { data: ex } = await window.supabaseClient.from("reactions").select("id")
.eq("user_id",uid).eq("target_type","post").eq("target_id",postId).eq("reaction_type",prev).maybeSingle();
if (ex) await window.supabaseClient.from("reactions").delete().eq("id",ex.id);
}
if (!isSame) {
await window.supabaseClient.from("reactions").insert({ user_id:uid, target_type:"post", target_id:postId, reaction_type:emoji, created_at:new Date().toISOString() });
}
} catch(e) { console.warn("[post reaction] sync failed", e); }
}

const getContent = (p) => {
if (typeof p.content === "string") return p.content;
if (typeof p.content === "object" && p.content?.text) return p.content.text;
return "";
};
const fmt = (ts) => {
const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
if (diff < 1) return "just now"; if (diff < 60) return `${diff}m ago`;
if (diff < 1440) return `${Math.floor(diff/60)}h ago`; return `${Math.floor(diff/1440)}d ago`;
};

if (!partner) return null;
return (
<div style={{ padding:"0 4px" }}>
<div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:18, padding:14, marginBottom:16 }}>
<div style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.3)", marginBottom:8, letterSpacing:"0.05em", textTransform:"uppercase" }}>💜 Just between you two</div>
<textarea value={newPost} onChange={e => setNewPost(e.target.value)} rows={2}
placeholder="Share something meaningful…"
style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:12, padding:"10px 12px", fontSize:13, color:"#fff", outline:"none", resize:"none", fontFamily:"inherit", lineHeight:1.5 }}
/>
<div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
<button onClick={createPost} disabled={posting || !newPost.trim()}
style={{ padding:"8px 20px", borderRadius:12, background: newPost.trim() ? "linear-gradient(135deg,#f87171,#fb923c)" : "rgba(255,255,255,0.06)", border:"none", color: newPost.trim() ? "#fff" : "rgba(255,255,255,0.3)", fontSize:13, fontWeight:700, cursor: newPost.trim() ? "pointer" : "default", transition:"all 0.2s", fontFamily:"inherit" }}>
{posting ? "Posting…" : "Post 💜"}
</button>
</div>
</div>
{posts.length === 0 ? (
<div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.2)", fontSize:13 }}>
<div style={{ fontSize:28, marginBottom:8 }}>💜</div>No posts yet — start the conversation
</div>
) : posts.map(post => {
const rxns = postReactions[post.id] || {};
const myRxn = myPostReactions[post.id] || null;
const totalRxns = EMOJIS.reduce((s,e) => s + (rxns[e]||0), 0);

// Fallback seed stats when post has no real reactions
const _seed = totalRxns === 0 ? seedPostStats(post.id) : null;
const displayRxns = totalRxns === 0 ? _seed.rxns : rxns;
const displayCommentCount = totalRxns === 0 ? _seed.commentCount : null;
const showCmt = openComments[post.id];
return (
<div key={post.id} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, marginBottom:12, overflow:"hidden" }}>
<div style={{ padding:"12px 14px" }}>
<div style={{ fontSize:13, color:"rgba(255,255,255,0.8)", lineHeight:1.5, marginBottom:10 }}>{getContent(post)}</div>
<div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", marginBottom:10 }}>{fmt(post.created_at)}</div>
<div style={{ display:"flex", gap:5, marginBottom:10 }}>
{EMOJIS.map(emoji => {
const count = displayRxns[emoji] || 0;
const active = myRxn === emoji;
return (
<button key={emoji} onClick={() => handlePostReact(post.id, emoji)}
style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"5px 8px", borderRadius:10, background: active ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.04)", border: active ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(255,255,255,0.07)", cursor:"pointer", transition:"all 0.15s", transform: active ? "scale(1.1)" : "scale(1)" }}>
<span style={{ fontSize:16 }}>{emoji}</span>
{count > 0 && <span style={{ fontSize:9, fontWeight:700, color: active ? "#fca5a5" : "rgba(255,255,255,0.3)" }}>{count}</span>}
</button>
);
})}
</div>
<button onClick={() => setOpenComments(p => ({ ...p, [post.id]: !p[post.id] }))}
style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:8, background: showCmt ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.04)", border: showCmt ? "1px solid rgba(248,113,113,0.2)" : "1px solid rgba(255,255,255,0.07)", cursor:"pointer", fontFamily:"inherit" }}>
<span style={{ fontSize:12 }}>💬</span>
<span style={{ fontSize:11, fontWeight:600, color: showCmt ? "#fca5a5" : "rgba(255,255,255,0.4)" }}>Comment</span>
{(displayCommentCount || totalRxns > 0) && (
  <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)", marginLeft:4 }}>
    {displayCommentCount ? `${displayCommentCount} comments` : `${totalRxns} react`}
  </span>
)}
</button>
</div>
{showCmt && <CommentDrawer targetId={post.id} targetType="post" />}
</div>
);
})}
</div>
);
}

function CoupleStreakMeter() {
const { partner } = useSocial();
const [streak, setStreak] = React.useState(0);

React.useEffect(() => {
if (!partner) return;
let mounted = true;
(async () => {
const { data } = await window.supabaseClient
  .from("couple_streaks")
  .select("days")
  .eq("couple_id", partner.id)
  .single();
if (mounted) setStreak(data?.days || 0);
})();
return () => { mounted = false; };
}, [partner]);

return (
<div className="bg-orange-50 p-4 rounded-2xl shadow text-center">
<div className="text-3xl animate-pulse">🔥</div>
<div className="text-lg font-bold">{streak} Day Streak</div>
</div>
);
}

function Achievements() {
const { user } = useSocial();
const [badges, setBadges] = React.useState([]);

React.useEffect(() => {
if (!user) return;
let mounted = true;
(async () => {
const { data } = await window.supabaseClient.from("achievements").select("*").eq("user_id", user.id);
if (mounted) setBadges(data || []);
})();
return () => { mounted = false; };
}, [user]);

return (
<div className="grid grid-cols-3 gap-3">
{badges.map(b => <div key={b.id} className="bg-yellow-100 p-3 rounded-xl text-center shadow"><div className="text-2xl">🏅</div><div className="text-xs font-semibold">{b.title}</div></div>)}
</div>
);
}

function CoupleInsights() {
const { partner } = useSocial();
const [insight, setInsight] = React.useState(null);
const [loading, setLoading] = React.useState(false);

async function generateInsight() {
if (!partner) return;
setLoading(true);
try {
const res = await window.supabaseClient.functions.invoke("generate_couple_insight", {
  body: { couple_id: partner.id }
});
setInsight(res?.data?.insight || res?.data || "No insight");
} catch (err) {
console.warn("Insight generation failed", err);
setInsight("Could not generate insight.");
} finally {
setLoading(false);
}
}

if (!partner) return null;
return (
<div className="bg-blue-50 p-4 rounded-2xl shadow">
<button onClick={generateInsight} className="px-4 py-2 bg-blue-600 text-white rounded-xl">Generate Insight</button>
{loading && <div className="mt-2"><Spinner /></div>}
{insight && <div className="mt-3 text-sm bg-white p-3 rounded-xl shadow">{insight}</div>}
</div>
);
}
/*
==========================================================
BONDOS — COUPLE SOCIAL SYSTEM  (FIXED v2)
PASTE GUIDE:
1. FIND   → function CoupleHub()          → REPLACE ENTIRELY
2. FIND   → function CoupleFeed()         → REPLACE ENTIRELY
3. PASTE after new CoupleFeed             → CoupleCard
4. PASTE after CoupleCard                 → CreateCoupleProfile
5. PASTE after CreateCoupleProfile        → MyCoupleProfile
DO NOT touch any other components.
==========================================================
*/


/* ============================================================
1. REPLACE → function CoupleHub()
============================================================ */

/* ============================================================
BLOCK C — REPLACE → function CoupleHub()

FIX: Stable, single view controller.
No nested async in render.
============================================================ */

const SHIP_VIBE_TAGS = [
{ id:"tension", label:"🔥 Undeniable tension" },
{ id:"looks", label:"👀 The looks they give each other" },
{ id:"texting", label:"💬 Never stop texting" },
{ id:"energy", label:"🎯 Same energy" },
{ id:"bff", label:"🤝 Best friend vibes" },
{ id:"trying", label:"🌹 One of them is clearly trying" },
{ id:"everyone_knows", label:"🤫 Everyone already knows" },
{ id:"chaos", label:"💀 This would be chaotic but amazing" },
];
const SHIP_PLATFORMS = [
{ id:"bond", label:"💜 Bondos", icon:"💜" },
{ id:"instagram", label:"📸 Instagram", icon:"📸" },
{ id:"x", label:"🐦 X / Twitter", icon:"🐦" },
{ id:"snapchat", label:"👻 Snapchat", icon:"👻" },
{ id:"whatsapp", label:"💚 WhatsApp", icon:"💚" },
{ id:"irl", label:"👀 Real Life", icon:"👀" },
{ id:"other", label:"🌐 Other", icon:"🌐" },
];
const CELEBRITY_SHIPS = [
  {
    id: "celeb_1",
    person_a_name: "Taylor Swift", person_b_name: "Travis Kelce",
    tagline: "Pop princess + football king = PR stunt or the real thing? 👑",
    controversy: "Hot",
    sails: 284700, sinks: 112400,
    vibe_tags: ["tension", "everyone_knows"],
    caption: "She started wearing his jersey. He started showing up to her concerts. Coincidence?",
    story: "Met at his own concert when she sent a friendship bracelet backstage. Six months later, the whole world had an opinion about their love life.",
    challenges_done: ["Matching outfits", "Public dedication", "Stadium kiss cam"],
  },
  {
    id: "celeb_2",
    person_a_name: "Ariana Grande", person_b_name: "Ethan Slater",
    tagline: "Left their partners for each other — chaos or chemistry? 🔥",
    controversy: "Controversial",
    sails: 98200, sinks: 201500,
    vibe_tags: ["chaos", "tension"],
    caption: "Two divorces. One shared Broadway stage. A lot of Twitter opinions.",
    story: "They met on the set of Wicked. Both were married. Now they're not. The internet has feelings.",
    challenges_done: ["Going public", "Ignoring the drama"],
  },
  {
    id: "celeb_3",
    person_a_name: "Selena Gomez", person_b_name: "Benny Blanco",
    tagline: "Her best friend first, her boyfriend second — and everyone's shocked? 😂",
    controversy: "Wholesome",
    sails: 317800, sinks: 54300,
    vibe_tags: ["bff", "energy"],
    caption: "She literally called him annoying for years. Now he's making her TikToks.",
    story: "A decade of collaboration before anyone suspected romance. The fans found out via a pasta photo. Classic.",
    challenges_done: ["Best friends first", "Cooking together", "Matching energy"],
  },
  {
    id: "celeb_4",
    person_a_name: "Kylie Jenner", person_b_name: "Timothée Chalamet",
    tagline: "Chaos energy. Two different universes colliding. 🌀",
    controversy: "Hot",
    sails: 176300, sinks: 143700,
    vibe_tags: ["chaos", "looks"],
    caption: "The most unexpected couple of their generation. No one predicted this.",
    story: "Started appearing at each other's events in 2023. The internet collectively short-circuited.",
    challenges_done: ["Keeping it low-key", "Spotted together in Paris"],
  },
  {
    id: "celeb_5",
    person_a_name: "Sabrina Carpenter", person_b_name: "Barry Keoghan",
    tagline: "She wrote an album about it. He showed up in the music video. Iconic. 🎬",
    controversy: "Romantic",
    sails: 241900, sinks: 67800,
    vibe_tags: ["trying", "tension"],
    caption: "'Please Please Please' is basically a relationship prayer at this point.",
    story: "An Irish actor and a pop star whose songs now soundtrack an entire generation's heartbreaks and butterflies.",
    challenges_done: ["Music video appearance", "Concert date", "Red carpet debut"],
  },
  {
    id: "celeb_6",
    person_a_name: "Kim Kardashian", person_b_name: "Pete Davidson",
    tagline: "Still the most chaotic 9 months in celebrity history. No one's over it. 💀",
    controversy: "Iconic",
    sails: 88400, sinks: 312700,
    vibe_tags: ["chaos", "everyone_knows"],
    caption: "Neck tattoos. Brand deals. SNL. Divorce. It was a lot.",
    story: "Began on a Saturday Night Live stage and ended as the most memed relationship of the decade. Respect.",
    challenges_done: ["Matching outfits", "Neck tattoo", "Going viral daily"],
  },
  {
    id: "celeb_7",
    person_a_name: "Dua Lipa", person_b_name: "Callum Turner",
    tagline: "Quietly the most aesthetic couple alive right now 🎨",
    controversy: "Wholesome",
    sails: 198500, sinks: 22100,
    vibe_tags: ["looks", "energy"],
    caption: "No drama, no chaos, just genuinely beautiful people being happy. Suspicious.",
    story: "Confirmed by a paparazzi stroll in New York in early 2024. They both look like concept art. Unfair.",
    challenges_done: ["Airport style", "Low-key date nights", "Fan approval 100%"],
  },
  {
    id: "celeb_8",
    person_a_name: "Jennifer Lopez", person_b_name: "Ben Affleck",
    tagline: "Broke up for 20 years. Got back together. Now divorced again. Dedication. 💍",
    controversy: "Controversial",
    sails: 134200, sinks: 287900,
    vibe_tags: ["tension", "trying"],
    caption: "Bennifer 1.0. Then 2.0. Now 2.0 is also over. The saga continues.",
    story: "Original 2002 romance. Reconnected 2021. Wedding 2022. Divorce filing 2024. They really committed to the bit.",
    challenges_done: ["Second chance", "Massive wedding", "Staying in tabloids forever"],
  },
];
function ShipPersonInput({ label, value, onChange }) {
const [searchMode, setSearchMode] = React.useState(value.platform || "instagram");
const [bondSearch, setBondSearch] = React.useState("");
const [bondResults, setBondResults] = React.useState([]);
const [searching, setSearching] = React.useState(false);
async function searchBond(q) {
if (!q.trim()) { setBondResults([]); return; }
setSearching(true);
const { data } = await window.supabaseClient.from("profiles")
.select("id,username,avatar_url").ilike("username",`%${q}%`).limit(6);
setBondResults(data || []); setSearching(false);
}
React.useEffect(() => {
const t = setTimeout(() => { if (searchMode === "bond") searchBond(bondSearch); }, 350);
return () => clearTimeout(t);
}, [bondSearch, searchMode]);
const baseStyle = { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"10px 12px", fontSize:13, color:"#fff", outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box" };
return (
<div style={{ marginBottom:16 }}>
<div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.5)", marginBottom:8, letterSpacing:"0.05em", textTransform:"uppercase" }}>{label}</div>
<input value={value.name||""} onChange={e => onChange({ ...value, name:e.target.value })} placeholder="Their name…" style={{ ...baseStyle, marginBottom:8 }} />
<div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
{SHIP_PLATFORMS.map(p => (
<button key={p.id} onClick={() => { setSearchMode(p.id); onChange({ ...value, platform:p.id, handle:"", bond_id:null }); }}
style={{ padding:"4px 10px", borderRadius:999, fontSize:11, fontWeight:600, cursor:"pointer", background: searchMode===p.id ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.05)", border: searchMode===p.id ? "1px solid rgba(248,113,113,0.4)" : "1px solid rgba(255,255,255,0.08)", color: searchMode===p.id ? "#fca5a5" : "rgba(255,255,255,0.4)", transition:"all 0.15s", fontFamily:"inherit" }}>
{p.icon} {p.label.split(" ").slice(1).join(" ")}
</button>
))}
</div>
{searchMode === "bond" ? (
<div>
<input value={bondSearch} onChange={e => setBondSearch(e.target.value)} placeholder="Search Bond username…" style={baseStyle} />
{bondResults.length > 0 && (
<div style={{ background:"rgba(15,23,42,0.95)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, marginTop:4, overflow:"hidden" }}>
{bondResults.map(u => (
<button key={u.id} onClick={() => { onChange({ ...value, name:value.name||u.username, handle:u.username, bond_id:u.id, platform:"bond" }); setBondSearch(u.username); setBondResults([]); }}
style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit" }}
onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
onMouseLeave={e => e.currentTarget.style.background="transparent"}>
<div style={{ width:30, height:30, borderRadius:10, background:"rgba(248,113,113,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#f87171" }}>{u.username[0].toUpperCase()}</div>
<div style={{ textAlign:"left" }}>
<div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>@{u.username}</div>
<div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>💜 on Bondos</div>
</div>
</button>
))}
</div>
)}
{value.bond_id && <div style={{ fontSize:11, color:"rgba(52,211,153,0.7)", marginTop:4 }}>✓ Linked to @{value.handle}</div>}
</div>
) : (
<input value={value.handle||""} onChange={e => onChange({ ...value, handle:e.target.value })}
placeholder={`@handle on ${SHIP_PLATFORMS.find(p=>p.id===searchMode)?.label || "platform"}…`} style={baseStyle} />
)}
</div>
);
}

function DropShipForm({ onShipDropped }) {
const [personA, setPersonA] = React.useState({ name:"", handle:"", platform:"instagram", bond_id:null });
const [personB, setPersonB] = React.useState({ name:"", handle:"", platform:"instagram", bond_id:null });
const [vibes, setVibes] = React.useState([]);
const [caption, setCaption] = React.useState("");
const [isAnon, setIsAnon] = React.useState(false);
const [step, setStep] = React.useState(1);
const [saving, setSaving] = React.useState(false);
const [done, setDone] = React.useState(null);
function toggleVibe(id) { setVibes(v => v.includes(id) ? v.filter(x=>x!==id) : [...v, id]); }
const DAILY_SHIP_LIMIT = 3; // ← change this to adjust the cap

async function dropShip() {
if (!personA.name.trim() || !personB.name.trim()) return;
setSaving(true);

try {
const session = await window.supabaseClient.auth.getSession();
const token = session?.data?.session?.access_token ?? window.SUPABASE_ANON_KEY;

const res = await fetch(
`${window.SUPABASE_URL}/functions/v1/api-drop-ship`,
{
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  },
  body: JSON.stringify({ personA, personB, vibes, caption, isAnon }),
}
);

const data = await res.json();

if (!res.ok) {
// 429 = rate limited, 400 = bad input, 500 = server error
alert(data.error || "Something went wrong. Try again.");
setSaving(false);
return;
}

setDone(data);
onShipDropped?.();

} catch (err) {
console.error("dropShip failed:", err);
alert("Connection error. Please try again.");
}

setSaving(false);
}
if (done) {
const shareText = `👀 ${done.person_a_name} & ${done.person_b_name} — someone thinks you two would be 🔥\nSee the ship on Bond OS`;
return (
<div style={{ textAlign:"center", padding:"32px 16px" }}>
<div style={{ fontSize:48, marginBottom:12 }}>🚢</div>
<div style={{ fontSize:20, fontWeight:800, color:"#fff", marginBottom:6 }}>Ship dropped!</div>
<div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:24 }}>{done.person_a_name} × {done.person_b_name} is now live</div>
{(done.person_a_bond_id || done.person_b_bond_id) && <div style={{ background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:14, padding:"10px 14px", marginBottom:16, fontSize:12, color:"rgba(52,211,153,0.8)" }}>✓ Bond notification sent to linked users</div>}
<div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:14, padding:14, marginBottom:16 }}>
<div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:8 }}>📱 Notify them off-platform — copy and paste to their DMs:</div>
<div style={{ background:"rgba(255,255,255,0.06)", borderRadius:10, padding:"10px 12px", fontSize:12, color:"rgba(255,255,255,0.7)", fontFamily:"monospace", textAlign:"left", marginBottom:8, lineHeight:1.5 }}>{shareText}</div>
<button onClick={() => navigator.clipboard?.writeText(shareText)} style={{ width:"100%", padding:"9px", borderRadius:10, background:"rgba(248,113,113,0.15)", border:"1px solid rgba(248,113,113,0.3)", color:"#fca5a5", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>📋 Copy Caption</button>
</div>
<button onClick={() => { setDone(null); setPersonA({ name:"", handle:"", platform:"instagram", bond_id:null }); setPersonB({ name:"", handle:"", platform:"instagram", bond_id:null }); setVibes([]); setCaption(""); setStep(1); onShipDropped?.(); }}
style={{ width:"100%", padding:"11px", borderRadius:14, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
🚢 Drop another ship
</button>
</div>
);
}
const canNext1 = personA.name.trim() && personB.name.trim();
return (
<div style={{ padding:"0 4px" }}>
<div style={{ display:"flex", gap:4, marginBottom:20 }}>
{[1,2,3].map(s => <div key={s} style={{ flex:1, height:3, borderRadius:999, background: step>=s ? "linear-gradient(90deg,#f87171,#fb923c)" : "rgba(255,255,255,0.1)", transition:"background 0.3s" }} />)}
</div>
{step === 1 && (
<div>
<div style={{ fontSize:16, fontWeight:800, color:"#fff", marginBottom:4 }}>Who are you shipping? 🚢</div>
<div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:20 }}>Find them on Bondos or enter their handle</div>
<ShipPersonInput label="Person A" value={personA} onChange={setPersonA} />
<div style={{ textAlign:"center", fontSize:22, color:"rgba(255,255,255,0.15)", marginBottom:16 }}>⚡</div>
<ShipPersonInput label="Person B" value={personB} onChange={setPersonB} />
<button onClick={() => setStep(2)} disabled={!canNext1}
style={{ width:"100%", padding:"13px", borderRadius:14, background: canNext1 ? "linear-gradient(135deg,#f87171,#fb923c)" : "rgba(255,255,255,0.06)", border:"none", color: canNext1 ? "#fff" : "rgba(255,255,255,0.25)", fontSize:14, fontWeight:800, cursor: canNext1 ? "pointer" : "default", transition:"all 0.2s", fontFamily:"inherit" }}>
Next — Set the vibe →
</button>
</div>
)}
{step === 2 && (
<div>
<div style={{ fontSize:16, fontWeight:800, color:"#fff", marginBottom:4 }}>Why are you shipping them? 🔥</div>
<div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:16 }}>Pick all that apply</div>
<div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
{SHIP_VIBE_TAGS.map(tag => (
<button key={tag.id} onClick={() => toggleVibe(tag.id)}
style={{ padding:"7px 12px", borderRadius:999, fontSize:12, fontWeight:600, cursor:"pointer", background: vibes.includes(tag.id) ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.05)", border: vibes.includes(tag.id) ? "1px solid rgba(248,113,113,0.4)" : "1px solid rgba(255,255,255,0.1)", color: vibes.includes(tag.id) ? "#fca5a5" : "rgba(255,255,255,0.5)", transition:"all 0.15s", fontFamily:"inherit" }}>
{tag.label}
</button>
))}
</div>
<textarea value={caption} onChange={e => setCaption(e.target.value)} rows={2}
placeholder="Hot take? Add a caption (optional)…"
style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"10px 12px", fontSize:13, color:"#fff", outline:"none", resize:"none", fontFamily:"inherit", marginBottom:14 }} />
<div style={{ display:"flex", gap:8 }}>
<button onClick={() => setStep(1)} style={{ flex:1, padding:"12px", borderRadius:14, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>← Back</button>
<button onClick={() => setStep(3)} style={{ flex:2, padding:"12px", borderRadius:14, background:"linear-gradient(135deg,#f87171,#fb923c)", border:"none", color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>Next →</button>
</div>
</div>
)}
{step === 3 && (
<div>
<div style={{ fontSize:16, fontWeight:800, color:"#fff", marginBottom:4 }}>Drop the ship 🚢</div>
<div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(248,113,113,0.15)", borderRadius:16, padding:16, marginBottom:20 }}>
<div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:12 }}>
<div style={{ textAlign:"center" }}>
<div style={{ width:44, height:44, borderRadius:14, background:"rgba(248,113,113,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800, color:"#f87171", margin:"0 auto 6px" }}>{personA.name[0]?.toUpperCase()}</div>
<div style={{ fontSize:12, fontWeight:700, color:"#fff" }}>{personA.name}</div>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>{SHIP_PLATFORMS.find(p=>p.id===personA.platform)?.icon} {personA.handle||"—"}</div>
</div>
<div style={{ fontSize:22, color:"rgba(255,255,255,0.2)" }}>⚡</div>
<div style={{ textAlign:"center" }}>
<div style={{ width:44, height:44, borderRadius:14, background:"rgba(251,146,60,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800, color:"#fb923c", margin:"0 auto 6px" }}>{personB.name[0]?.toUpperCase()}</div>
<div style={{ fontSize:12, fontWeight:700, color:"#fff" }}>{personB.name}</div>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>{SHIP_PLATFORMS.find(p=>p.id===personB.platform)?.icon} {personB.handle||"—"}</div>
</div>
</div>
{vibes.length > 0 && <div style={{ display:"flex", flexWrap:"wrap", gap:4, justifyContent:"center" }}>{vibes.map(id => <span key={id} style={{ fontSize:11, padding:"2px 8px", borderRadius:999, background:"rgba(248,113,113,0.1)", color:"#fca5a5", border:"1px solid rgba(248,113,113,0.2)" }}>{SHIP_VIBE_TAGS.find(t=>t.id===id)?.label}</span>)}</div>}
{caption && <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", textAlign:"center", fontStyle:"italic", marginTop:8 }}>"{caption}"</div>}
</div>
<button onClick={() => setIsAnon(v => !v)}
style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderRadius:14, background: isAnon ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.04)", border: isAnon ? "1px solid rgba(251,191,36,0.2)" : "1px solid rgba(255,255,255,0.09)", cursor:"pointer", marginBottom:16, fontFamily:"inherit" }}>
<div>
<div style={{ fontSize:13, fontWeight:700, color:"#fff", textAlign:"left" }}>{isAnon ? "👻 Drop anonymously" : "🙋 Drop as yourself"}</div>
<div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", textAlign:"left", marginTop:2 }}>{isAnon ? "Your identity stays hidden" : "Your username will be shown"}</div>
</div>
<div style={{ width:40, height:22, borderRadius:999, background: isAnon ? "#fbbf24" : "rgba(255,255,255,0.1)", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
<div style={{ width:18, height:18, borderRadius:999, background:"#fff", position:"absolute", top:2, left: isAnon ? 20 : 2, transition:"left 0.2s" }} />
</div>
</button>
<div style={{ display:"flex", gap:8 }}>
<button onClick={() => setStep(2)} style={{ flex:1, padding:"12px", borderRadius:14, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>← Back</button>
<button onClick={dropShip} disabled={saving}
style={{ flex:2, padding:"12px", borderRadius:14, background:"linear-gradient(135deg,#f87171,#fb923c)", border:"none", color:"#fff", fontSize:14, fontWeight:800, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, transition:"all 0.2s", fontFamily:"inherit" }}>
{saving ? "Dropping…" : "🚢 Drop the Ship"}
</button>
</div>
</div>
)}
</div>
);
}
function getPlatformUrl(platform, handle) {
if (!handle) return null;
const h = handle.replace(/^@/, "");
const map = {
instagram: `https://instagram.com/${h}`,
x:         `https://x.com/${h}`,
snapchat:  `https://snapchat.com/add/${h}`,
tiktok:    `https://tiktok.com/@${h}`,
linkedin:  `https://linkedin.com/in/${h}`,
twitter:   `https://twitter.com/${h}`,
whatsapp:  `https://wa.me/${h}`,
bond:      null,   // internal — no public URL
irl:       null,
other:     handle.startsWith("http") ? handle : `https://${handle}`,
};
return map[platform] ?? null;
}


// ============================================================
// 1. CelebShipCard — new component, paste near ShipCard
// ============================================================

function CelebShipCard({ ship, onVote, myVote }) {
  const [expanded, setExpanded] = React.useState(false);

  const noise = React.useMemo(() => ({
    sails: Math.floor(Math.random() * 800) - 400,
    sinks: Math.floor(Math.random() * 800) - 400,
  }), [ship.id]);

  const sails = ship.sails + noise.sails + (myVote === "sail" ? 1 : 0);
  const sinks = ship.sinks + noise.sinks + (myVote === "sink" ? 1 : 0);
  const total = sails + sinks;
  const sailPct = total > 0 ? Math.round((sails / total) * 100) : 50;
  const fmtVotes = n => n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);

  const CONTROVERSY_STYLES = {
    "Hot":          { bg:"rgba(239,68,68,0.15)",   color:"#f87171", icon:"🔥" },
    "Controversial":{ bg:"rgba(251,191,36,0.12)",  color:"#fbbf24", icon:"⚡" },
    "Wholesome":    { bg:"rgba(52,211,153,0.1)",   color:"#6ee7b7", icon:"💚" },
    "Romantic":     { bg:"rgba(244,114,182,0.12)", color:"#f9a8d4", icon:"💕" },
    "Iconic":       { bg:"rgba(167,139,250,0.12)", color:"#c4b5fd", icon:"👑" },
  };
  const cs = CONTROVERSY_STYLES[ship.controversy] || CONTROVERSY_STYLES["Hot"];

  return (
    <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)",
      borderRadius:18, marginBottom:14, overflow:"hidden" }}>
      <div style={{ height:2, background:"linear-gradient(90deg,#f87171,#fb923c,#fbbf24)" }} />
      <div style={{ padding:"14px 14px 12px" }}>

        {/* Names row */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
          <div style={{ flex:1, textAlign:"center" }}>
            <div style={{ width:46, height:46, borderRadius:14,
              background:"linear-gradient(135deg,rgba(248,113,113,0.25),rgba(251,146,60,0.15))",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:20, fontWeight:900, color:"#f87171", margin:"0 auto 6px",
              border:"1px solid rgba(248,113,113,0.25)" }}>
              {ship.person_a_name[0]}
            </div>
            <div style={{ fontSize:13, fontWeight:800, color:"#fff", lineHeight:1.2 }}>
              {ship.person_a_name.split(" ")[0]}
            </div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:2 }}>
              {ship.person_a_name.split(" ").slice(1).join(" ")}
            </div>
          </div>

          <div style={{ textAlign:"center", flexShrink:0 }}>
            <div style={{ fontSize:22, lineHeight:1 }}>🛳️</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.2)", letterSpacing:"0.1em", marginTop:2 }}>SHIP</div>
          </div>

          <div style={{ flex:1, textAlign:"center" }}>
            <div style={{ width:46, height:46, borderRadius:14,
              background:"linear-gradient(135deg,rgba(251,146,60,0.25),rgba(251,191,36,0.15))",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:20, fontWeight:900, color:"#fb923c", margin:"0 auto 6px",
              border:"1px solid rgba(251,146,60,0.25)" }}>
              {ship.person_b_name[0]}
            </div>
            <div style={{ fontSize:13, fontWeight:800, color:"#fff", lineHeight:1.2 }}>
              {ship.person_b_name.split(" ")[0]}
            </div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:2 }}>
              {ship.person_b_name.split(" ").slice(1).join(" ")}
            </div>
          </div>
        </div>

        {/* Controversy badge + tagline */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:10 }}>
          <span style={{ fontSize:10, padding:"3px 9px", borderRadius:999,
            background:cs.bg, color:cs.color, border:`1px solid ${cs.color}33`,
            fontWeight:700, flexShrink:0, marginTop:2 }}>
            {cs.icon} {ship.controversy}
          </span>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontStyle:"italic",
            lineHeight:1.5, flex:1 }}>
            {ship.tagline}
          </div>
        </div>

        {/* Vote bar */}
        <div style={{ marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between",
            fontSize:10, color:"rgba(255,255,255,0.3)", marginBottom:4 }}>
            <span>⛵ {fmtVotes(sails)} sailing</span>
            <span>{sailPct}% sail</span>
            <span>{fmtVotes(sinks)} sinking 🌊</span>
          </div>
          <div style={{ height:6, borderRadius:999, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${sailPct}%`,
              background:"linear-gradient(90deg,#34d399,#f87171)",
              borderRadius:999, transition:"width 0.4s ease" }} />
          </div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.2)", textAlign:"center", marginTop:4 }}>
            {fmtVotes(total)} total votes
          </div>
        </div>

        {/* Vote buttons */}
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          <button onClick={() => onVote(ship.id, "sail")}
            style={{ flex:1, padding:"10px", borderRadius:12,
              background: myVote==="sail" ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.04)",
              border: myVote==="sail" ? "1px solid rgba(52,211,153,0.4)" : "1px solid rgba(255,255,255,0.09)",
              color: myVote==="sail" ? "#6ee7b7" : "rgba(255,255,255,0.5)",
              fontSize:13, fontWeight:800, cursor:"pointer", transition:"all 0.15s", fontFamily:"inherit" }}>
            ⛵ Sail It
          </button>
          <button onClick={() => onVote(ship.id, "sink")}
            style={{ flex:1, padding:"10px", borderRadius:12,
              background: myVote==="sink" ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.04)",
              border: myVote==="sink" ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(255,255,255,0.09)",
              color: myVote==="sink" ? "#fca5a5" : "rgba(255,255,255,0.5)",
              fontSize:13, fontWeight:800, cursor:"pointer", transition:"all 0.15s", fontFamily:"inherit" }}>
            🌊 Sink It
          </button>
        </div>

        {/* Expand toggle */}
        <button onClick={() => setExpanded(v => !v)}
          style={{ width:"100%", padding:"8px", borderRadius:10,
            background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
            color:"rgba(255,255,255,0.3)", fontSize:11, fontWeight:600,
            cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s" }}>
          {expanded ? "▲ Less" : "▼ Their story + challenges"}
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div style={{ marginTop:12, background:"rgba(255,255,255,0.02)",
            border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:14 }}>
            {ship.caption && (
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)",
                fontStyle:"italic", marginBottom:12, lineHeight:1.6 }}>
                "{ship.caption}"
              </div>
            )}
            {ship.story && (
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.7)",
                lineHeight:1.7, marginBottom:12 }}>
                {ship.story}
              </div>
            )}
            {ship.challenges_done?.length > 0 && (
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.25)",
                  letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>
                  ⚡ Challenges Completed
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {ship.challenges_done.map((c, i) => (
                    <span key={i} style={{ fontSize:11, padding:"3px 10px", borderRadius:999,
                      background:"rgba(52,211,153,0.08)", color:"rgba(52,211,153,0.8)",
                      border:"1px solid rgba(52,211,153,0.15)" }}>
                      ✓ {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ShipCard({ ship, onVote, myVote }) {
const [showComments, setShowComments] = React.useState(false);
const totalVotes = (ship.sails||0) + (ship.sinks||0);
const sailPct = totalVotes > 0 ? Math.round(((ship.sails||0) / totalVotes) * 100) : 50;
const platIcon = (p) => SHIP_PLATFORMS.find(x=>x.id===p)?.icon || "🌐";
const vibeLabels = (ship.vibe_tags||[]).map(id => SHIP_VIBE_TAGS.find(t=>t.id===id)?.label).filter(Boolean);
return (
<div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:18, marginBottom:12, overflow:"hidden" }}>
<div style={{ height:2, background:"linear-gradient(90deg,#f87171,#fb923c,#fbbf24)" }} />
<div style={{ padding:"14px 14px 12px" }}>
<div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
<div style={{ flex:1, textAlign:"center" }}>
<div style={{ width:42, height:42, borderRadius:12, background:"rgba(248,113,113,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color:"#f87171", margin:"0 auto 5px" }}>{ship.person_a_name[0]?.toUpperCase()}</div>
<div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>{ship.person_a_name}</div>
{ship.person_a_handle && (() => {
const url = getPlatformUrl(ship.person_a_platform, ship.person_a_handle);
const inner = <>{platIcon(ship.person_a_platform)} @{ship.person_a_handle}</>;
return url ? (
<a href={url} target="_blank" rel="noopener noreferrer"
onClick={e => e.stopPropagation()}
style={{ fontSize:10, color:"rgba(248,113,113,0.7)", textDecoration:"none",
  display:"inline-flex", alignItems:"center", gap:2,
  padding:"2px 6px", borderRadius:999,
  background:"rgba(248,113,113,0.08)",
  border:"1px solid rgba(248,113,113,0.15)",
  marginTop:2, cursor:"pointer" }}>
{inner}
</a>
) : (
<div style={{ fontSize:10, color:"rgba(255,255,255,0.35)" }}>{inner}</div>
);
})()}
</div>
<div style={{ textAlign:"center" }}>
<div style={{ fontSize:22, color:"rgba(255,255,255,0.2)" }}>⚡</div>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.2)", marginTop:2 }}>SHIP</div>
</div>
<div style={{ flex:1, textAlign:"center" }}>
<div style={{ width:42, height:42, borderRadius:12, background:"rgba(251,146,60,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color:"#fb923c", margin:"0 auto 5px" }}>{ship.person_b_name[0]?.toUpperCase()}</div>
<div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>{ship.person_b_name}</div>
{ship.person_b_handle && (() => {
const url = getPlatformUrl(ship.person_b_platform, ship.person_b_handle);
const inner = <>{platIcon(ship.person_b_platform)} @{ship.person_b_handle}</>;
return url ? (
<a href={url} target="_blank" rel="noopener noreferrer"
onClick={e => e.stopPropagation()}
style={{ fontSize:10, color:"rgba(251,146,60,0.7)", textDecoration:"none",
  display:"inline-flex", alignItems:"center", gap:2,
  padding:"2px 6px", borderRadius:999,
  background:"rgba(251,146,60,0.08)",
  border:"1px solid rgba(251,146,60,0.15)",
  marginTop:2, cursor:"pointer" }}>
{inner}
</a>
) : (
<div style={{ fontSize:10, color:"rgba(255,255,255,0.35)" }}>{inner}</div>
);
})()}
</div>
</div>
{vibeLabels.length > 0 && <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>{vibeLabels.map((v,i) => <span key={i} style={{ fontSize:11, padding:"2px 8px", borderRadius:999, background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.5)", border:"1px solid rgba(255,255,255,0.08)" }}>{v}</span>)}</div>}
{ship.caption && <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", fontStyle:"italic", marginBottom:10 }}>"{ship.caption}"</div>}
<div style={{ marginBottom:12 }}>
<div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"rgba(255,255,255,0.3)", marginBottom:4 }}>
<span>🚢 {ship.sails||0} sailing</span>
<span>{totalVotes > 0 ? `${sailPct}% sail` : "No votes yet"}</span>
<span>💀 {ship.sinks||0} sinking</span>
</div>
<div style={{ height:6, borderRadius:999, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
<div style={{ height:"100%", width:`${sailPct}%`, background:"linear-gradient(90deg,#34d399,#f87171)", borderRadius:999, transition:"width 0.4s ease" }} />
</div>
</div>

<div style={{ display:"flex", gap:8 }}>
  <button
    onClick={() => !myVote && onVote(ship.id, "sail")}
    style={{
      flex:1, padding:"10px", borderRadius:12,
      background: myVote === "sail" ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.04)",
      border: myVote === "sail" ? "1px solid rgba(52,211,153,0.4)" : "1px solid rgba(255,255,255,0.09)",
      color: myVote === "sail" ? "#6ee7b7" : myVote === "sink" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)",
      fontSize:13, fontWeight:800, fontFamily:"inherit",
      cursor: myVote ? "not-allowed" : "pointer",
      opacity: myVote && myVote !== "sail" ? 0.35 : 1,
      transition:"all 0.15s",
    }}
  >
    {myVote === "sail" ? "🚢 Sailed ✓" : "🚢 Sail It"}
  </button>
  <button
    onClick={() => !myVote && onVote(ship.id, "sink")}
    style={{
      flex:1, padding:"10px", borderRadius:12,
      background: myVote === "sink" ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.04)",
      border: myVote === "sink" ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(255,255,255,0.09)",
      color: myVote === "sink" ? "#fca5a5" : myVote === "sail" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)",
      fontSize:13, fontWeight:800, fontFamily:"inherit",
      cursor: myVote ? "not-allowed" : "pointer",
      opacity: myVote && myVote !== "sink" ? 0.35 : 1,
      transition:"all 0.15s",
    }}
  >
    {myVote === "sink" ? "💀 Sunk ✓" : "💀 Sink It"}
  </button>
</div>

<div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10 }}>
  <div style={{ fontSize:10, color:"rgba(255,255,255,0.2)" }}>
    {myVote
      ? <span style={{ color: myVote === "sail" ? "rgba(52,211,153,0.6)" : "rgba(248,113,113,0.6)" }}>
          {myVote === "sail" ? "⚓ you sailed this" : "🌊 you sank this"}
        </span>
      : ship.is_anonymous
        ? "dropped by a ghost 👻"
        : ship.submitter_username
          ? `dropped by @${ship.submitter_username}`
          : "anonymous"
    }
  </div>
  <button
    onClick={() => setShowComments(v => !v)}
    style={{
      display:"flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:10,
      background: showComments ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.04)",
      border: showComments ? "1px solid rgba(248,113,113,0.25)" : "1px solid rgba(255,255,255,0.08)",
      cursor:"pointer", fontFamily:"inherit",
    }}
  >
    <span style={{ fontSize:13 }}>💬</span>
    <span style={{ fontSize:11, fontWeight:600, color: showComments ? "#fca5a5" : "rgba(255,255,255,0.4)" }}>
      {ship.comment_count > 0 ? ship.comment_count : "Comment"}
    </span>
  </button>
</div>
{showComments && <CommentDrawer targetId={ship.id} targetType="ship" />}
</div>
</div>
);
}

// ============================================================
// 5. ShipItHub — FULL CORRECTED VERSION
// ============================================================

function ShipItHub({ data, save }) {
const [tab, setTab] = React.useState("ships");
const [ships, setShips] = React.useState([]);
const [myVotes, setMyVotes] = React.useState({});
const [loading, setLoading] = React.useState(true);
const [refreshKey, setRefreshKey] = React.useState(0);
const [search, setSearch] = React.useState("");

// ── NEW: celeb votes (localStorage backed) ──
const [celebVotes, setCelebVotes] = React.useState(() => {
  try {
    const saved = localStorage.getItem("bond_celeb_votes");
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
});

React.useEffect(() => {
  let mounted = true;
  async function load() {
    setLoading(true);
    try {
      const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid") || "none";
      const [{ data: shipData }, { data: voteData }] = await Promise.all([
        window.supabaseClient.from("ship_it").select("*").order("created_at", { ascending:false }).limit(50),
        window.supabaseClient.from("ship_votes").select("ship_id,vote").eq("user_id", uid),
      ]);
      if (!mounted) return;
      setShips(shipData || []);
      const vMap = {};
      (voteData||[]).forEach(v => { vMap[v.ship_id] = v.vote; });
      setMyVotes(vMap);
    } catch(e) { console.warn("[ShipIt] load failed", e); }
    setLoading(false);
  }
  load();
  return () => { mounted = false; };
}, [refreshKey]);
async function handleVote(shipId, vote) {
  // ── Resolve user id (logged-in > guest uuid > create anon) ──
const uid = window.currentUser?.id || ensureGuestUUID();

  const prev = myVotes[shipId];
  const isSame = prev === vote;
  // ── If already voted the SAME way → do nothing (one-vote lock) ──
  if (isSame) return;

  // ── Optimistic UI update ──
  setMyVotes(p => ({ ...p, [shipId]: vote }));
  setShips(prev => prev.map(s => {
    if (s.id !== shipId) return s;
    const ns = { ...s };
    // Remove old vote if switching
    if (prev === "sail") ns.sails = Math.max(0, (ns.sails || 0) - 1);
    if (prev === "sink") ns.sinks = Math.max(0, (ns.sinks || 0) - 1);
    // Add new vote
    if (vote === "sail") ns.sails = (ns.sails || 0) + 1;
    else                 ns.sinks = (ns.sinks || 0) + 1;
    return ns;
  }));

  // ── Persist to Supabase (unique constraint handles duplicates) ──
  try {
    const session = await window.supabaseClient.auth.getSession();
    const token = session?.data?.session?.access_token ?? window.SUPABASE_ANON_KEY;
    const res = await fetch(`${window.SUPABASE_URL}/functions/v1/api-vote-ship`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ shipId, vote }),
    });
    // If the edge function returns 409 (unique violation), revert optimistic update
    if (res.status === 409) {
      setMyVotes(p => ({ ...p, [shipId]: prev }));
      setShips(prev => prev.map(s => {
        if (s.id !== shipId) return s;
        const ns = { ...s };
        if (vote === "sail") ns.sails = Math.max(0, (ns.sails || 0) - 1);
        if (vote === "sink") ns.sinks = Math.max(0, (ns.sinks || 0) - 1);
        if (prev === "sail") ns.sails = (ns.sails || 0) + 1;
        if (prev === "sink") ns.sinks = (ns.sinks || 0) + 1;
        return ns;
      }));
    }
  } catch(e) { console.warn("[ShipIt] vote failed", e); }
}

// ── NEW: celeb vote handler ──
function handleCelebVote(shipId, vote) {
  const prev = celebVotes[shipId];
  const isSame = prev === vote;
  const next = isSame ? null : vote;
  const updated = { ...celebVotes, [shipId]: next };
  setCelebVotes(updated);
  try { localStorage.setItem("bond_celeb_votes", JSON.stringify(updated)); } catch {}
}

const hallShips = [...ships].sort((a,b) => (b.sails||0)-(a.sails||0)).slice(0,10);

const visibleShips = React.useMemo(() => {
  const q = search.trim().toLowerCase();
  if (!q) return ships;
  return ships.filter(s => {
    const fields = [s.person_a_name, s.person_a_handle, s.person_b_name,
      s.person_b_handle, s.caption, ...(s.vibe_tags || [])].filter(Boolean);
    return fields.some(f => String(f).toLowerCase().includes(q));
  });
}, [ships, search]);

// ── UPDATED: 4 tabs now ──
const TABS = [
  { id:"ships", label:"Active Ships" },
  { id:"celeb", label:"⭐ Celeb Ships" },
  { id:"drop",  label:"⚡ Drop a Ship" },
  { id:"hall",  label:"🏆 Hall of Ships" },
    { id: "mood", label: "Mood" },
];

return (
  <AppShell title="🚢 Ship It" onBack={() => save({ playSub: null })}>

    {/* Tab bar */}
    <div style={{ display:"flex", gap:4, padding:"3px", borderRadius:14,
      background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)",
      marginBottom:16, overflowX:"auto" }}>
      {TABS.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)}
          style={{ flex:1, padding:"7px 0", borderRadius:11, fontSize:11,
            fontWeight: tab===t.id ? 700 : 500, whiteSpace:"nowrap",
            background: tab===t.id ? "rgba(248,113,113,0.18)" : "transparent",
            color: tab===t.id ? "#f87171" : "rgba(255,255,255,0.4)",
            border: tab===t.id ? "1px solid rgba(248,113,113,0.22)" : "1px solid transparent",
            cursor:"pointer", transition:"all 0.18s", fontFamily:"inherit" }}>
          {t.label}
        </button>
      ))}
    </div>
{/* ── ACTIVE SHIPS ── */}
{tab === "ships" && (
  <div>

    {/* Search */}
    <div style={{ position:"relative", marginBottom:12 }}>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, handle, vibe…"
        style={{ width:"100%", boxSizing:"border-box",
          background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.09)",
          borderRadius:14, padding:"10px 38px 10px 16px", fontSize:13, color:"#fff",
          outline:"none", fontFamily:"inherit" }}
        onFocus={e => e.target.style.borderColor="rgba(248,113,113,0.35)"}
        onBlur={e  => e.target.style.borderColor="rgba(255,255,255,0.09)"}
      />
      {search
        ? <button onClick={() => setSearch("")}
            style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
              background:"rgba(255,255,255,0.12)", border:"none", color:"rgba(255,255,255,0.7)",
              cursor:"pointer", width:20, height:20, borderRadius:999, fontSize:12,
              display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>×</button>
        : <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)",
            color:"rgba(255,255,255,0.2)", fontSize:14, pointerEvents:"none" }}>⌕</span>
      }
    </div>

    {/* Header */}
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
      <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>
        {visibleShips.length} ship{visibleShips.length !== 1 ? "s" : ""}
        {search ? " found" : " active"}
      </div>
      <button onClick={() => setRefreshKey(k=>k+1)}
        style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)",
          color:"rgba(255,255,255,0.35)", cursor:"pointer", borderRadius:8,
          padding:"5px 10px", fontSize:12, fontFamily:"inherit" }}>↻</button>
    </div>

    {loading
      ? (
        <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(248,113,113,0.35)", fontSize:13 }}>
          Loading ships…
        </div>
      )

      : ships.length === 0 ? (() => {

          const { profiles } = getGeneratedProfiles({
            query: search || "IIIT Hyderabad",
            pageSize: 20
          });

          const fakeShips = profiles.map((p, i) => ({
            id: "gen_ship_" + i,

            person_a_name: p.couple_name?.split(" ")[0] || "Aarav",
            person_b_name: p.couple_name?.split(" ").slice(-1)[0] || "Meera",

            sails: p._seed_reactions?.["❤️"] || Math.floor(Math.random()*40 + 10),
            sinks: Math.floor(Math.random() * 15),

            vibe_tags: ["they look too good together", "same vibe"],

            caption: "Lowkey something going on here 👀",

            is_anonymous: true,
            submitter_username: null,
          }));

          return fakeShips.map(ship => (
            <ShipCard
              key={ship.id}
              ship={ship}
              onVote={() => {}}
              myVote={null}
            />
          ));

        })()

      : visibleShips.length === 0 && search ? (
        <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.25)", fontSize:13 }}>
          No ships match "{search}"
        </div>
      )

      : visibleShips.map(ship => (
        <ShipCard
          key={ship.id}
          ship={ship}
          onVote={handleVote}
          myVote={myVotes[ship.id] || null}
        />
      ))
    }

  </div>
)}

    {/* ── NEW: CELEB SHIPS ── */}
    {tab === "celeb" && (
      <div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)", marginBottom:14, lineHeight:1.6 }}>
          The internet's most debated celebrity ships. Cast your vote. 🌊
        </div>
        {CELEBRITY_SHIPS.map(ship => (
          <CelebShipCard
            key={ship.id}
            ship={ship}
            myVote={celebVotes[ship.id] || null}
            onVote={handleCelebVote}
          />
        ))}
      </div>
    )}

    {/* ── DROP A SHIP ── */}
    {tab === "drop" && (
      <DropShipForm onShipDropped={() => { setRefreshKey(k=>k+1); setTab("ships"); }} />
    )}

    {/* ── HALL OF SHIPS ── */}
    {tab === "hall" && (
      <div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)", marginBottom:14 }}>
          🏆 Most sailed ships of all time
        </div>
        {loading
          ? <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(248,113,113,0.35)", fontSize:13 }}>Loading…</div>
          : hallShips.length === 0
            ? <div style={{ textAlign:"center", padding:"50px 0", color:"rgba(255,255,255,0.2)", fontSize:13 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>🏆</div>No ships yet
              </div>
            : hallShips.map((ship, i) => (
                <div key={ship.id} style={{ position:"relative" }}>
                  {i===0 && <div style={{ position:"absolute", top:-4, right:12, fontSize:18, zIndex:2 }}>👑</div>}
                  <ShipCard ship={ship} onVote={handleVote} myVote={myVotes[ship.id]||null} />
                </div>
              ))
        }
      </div>
    )}
    {/* ── MOOD ── */}                          {/* 👈 ADD THIS BLOCK HERE */}
    {tab === "mood" && <MoodHub currentUser={window.currentUser} />}
  </AppShell>
);
}
/* ============================================================
B — REPLACE → function CoupleHub()
Discover / My Profile sub-navigation
============================================================ */
function CoupleHub() {
const [view, setView] = React.useState("discover");
const [myCouple, setMyCouple] = React.useState(null);
const [loading, setLoading] = React.useState(true);

React.useEffect(() => {
let mounted = true;
async function load() {
const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid");
if (!uid) { if (mounted) setLoading(false); return; }
const { data } = await window.supabaseClient
.from("couples").select("*")
.eq("creator_id", uid).maybeSingle();
if (mounted) { setMyCouple(data || null); setLoading(false); }
}
load();
return () => { mounted = false; };
}, []);
// Inside function CoupleHub(), add this effect:
React.useEffect(() => {
  function handleGoto() { setView("create"); }
  window.addEventListener("bond_goto_create_couple", handleGoto);
  return () => window.removeEventListener("bond_goto_create_couple", handleGoto);
}, []);
if (loading) return (
<div style={{ padding:"0 16px" }}>
<SkeletonCard />
<SkeletonCard />
</div>
);
return (
<div style={{ padding:"0 16px" }}>
<div style={{ display:"flex", gap:4, marginBottom:16, marginTop:4,
padding:"3px", borderRadius:14, background:"rgba(255,255,255,0.04)",
border:"1px solid rgba(255,255,255,0.07)" }}>
<button
style={{
  flex:1, padding:"8px 0", borderRadius:11, fontSize:13, cursor:"pointer",
  fontWeight: view === "discover" ? 700 : 500,
  background: view === "discover" ? "rgba(248,113,113,0.15)" : "transparent",
  color: view === "discover" ? "#f87171" : "rgba(255,255,255,0.4)",
  border: view === "discover" ? "1px solid rgba(248,113,113,0.2)" : "1px solid transparent",
  transition:"all 0.18s",
}}
onClick={() => setView("discover")}
>
Discover
</button>
{myCouple ? (
<button
  style={{
    flex:1, padding:"8px 0", borderRadius:11, fontSize:13, cursor:"pointer",
    fontWeight: view === "mine" ? 700 : 500,
    background: view === "mine" ? "rgba(248,113,113,0.15)" : "transparent",
    color: view === "mine" ? "#f87171" : "rgba(255,255,255,0.4)",
    border: view === "mine" ? "1px solid rgba(248,113,113,0.2)" : "1px solid transparent",
    transition:"all 0.18s",
  }}
  onClick={() => setView("mine")}
 >
  My Profile
 </button>
):(
 <button
  style={{
    flex:1, padding:"8px 0", borderRadius:11, fontSize:13, cursor:"pointer",
    fontWeight: view === "create" ? 700 : 500,
    background: view === "create" ? "rgba(248,113,113,0.15)" : "transparent",
    color: view === "create" ? "#f87171" : "rgba(255,255,255,0.4)",
    border: view === "create" ? "1px solid rgba(248,113,113,0.2)" : "1px solid transparent",
    transition:"all 0.18s",
  }}
  onClick={() => setView("create")}
 >
  + Create Profile
 </button>
)}
</div>

{view === "discover" && <CoupleFeed />}
{view === "create" && !myCouple && (
<CreateCoupleProfile onCreated={c => { setMyCouple(c); setView("mine"); }} />
)}
{view === "mine" && myCouple && (
<MyCoupleProfile couple={myCouple} onUpdate={setMyCouple} />
)}
</div>
);
}
// ============================================================
// BOND OS — DETERMINISTIC PROFILE GENERATOR
// Drop this into main_code_aon.jsx replacing PLACEHOLDER_COUPLES
// FCP-safe: ~8KB, generates 75,000+ profiles on demand
// ============================================================

// ── 1. SEED DATA — institutions only, ~8KB total ──

// ── Session feed cache (survives page refresh, clears on tab close) ─
const FEED_CACHE_KEY = "bond_couple_feed_v1";
const FEED_CACHE_TTL = 60_000; // 60 seconds

function readFeedCache() {
try {
const raw = sessionStorage.getItem(FEED_CACHE_KEY);
if (!raw) return null;
const { ts, data } = JSON.parse(raw);
if (Date.now() - ts > FEED_CACHE_TTL) return null;
return data;
} catch { return null; }
}

function writeFeedCache(data) {
try {
sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
} catch {}
}

/* ============================================================
2. REPLACE → function CoupleFeed()
============================================================ */

/* ============================================================
BLOCK D — REPLACE → function CoupleFeed()

FIX:
- NO .channel() / realtime subscription (was causing feed
to blank out on every change anywhere in couples table)
- Fetches couples AND all reactions in TWO parallel queries
on mount only
- Popularity = likes - dislikes, computed client-side
- useMemo for sorted list — no re-sort on every render
- Reaction updates hit local state only — zero re-fetch
============================================================ */

/* ============================================================
C — REPLACE → function CoupleFeed()
Feed with filter + rank controls
============================================================ */

/* ============================================================
C — REPLACE → function CoupleFeed()
============================================================ */

/* ============================================================
BLOCK 2 — REPLACE function CoupleFeed()
Adds search bar (client-side, searches couple name + type)
============================================================ */

// ============================================================
// 4. CoupleFeed — FULL CORRECTED VERSION
// ============================================================

function CoupleFeed() {
const TYPES = ["all","Romantic","Engaged","Married","Long Distance","Situationship","Friends to Lovers"];
const EMOJIS = ["\u2764\uFE0F","\uD83D\uDE0D","\uD83D\uDD25","\uD83D\uDCAF","\uD83E\uDD79"];
const [filter, setFilter] = React.useState("all");
const [rankMode, setRankMode] = React.useState("bond");
const [search, setSearch] = React.useState("");
const [couples, setCouples] = React.useState([]);
const [reactions, setReactions] = React.useState({});
const [myReactions, setMyReactions] = React.useState({});
const [commentCounts, setCommentCounts] = React.useState({});
// ── NEW ──
const [photoCounts, setPhotoCounts] = React.useState({});
const [loading, setLoading] = React.useState(true);
const [realLoaded, setRealLoaded] = React.useState(false);
const [refreshKey, setRefreshKey] = React.useState(0);
const [page, setPage] = React.useState(0);
const [hasMore, setHasMore] = React.useState(true);
const PAGE_SIZE = 12;
const [selectedCouple, setSelectedCouple] = React.useState(null);
const [statusIds, setStatusIds] = React.useState(new Set());
// ── ADD these after const [statusIds, setStatusIds] = React.useState(new Set());
const [localReactions, setLocalReactions] = React.useState(() => {
  try {
    const saved = localStorage.getItem("bond_placeholder_reactions");
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
});
const [localMyReactions, setLocalMyReactions] = React.useState(() => {
  try {
    const saved = localStorage.getItem("bond_placeholder_my_reactions");
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
});
function handleLocalReact(coupleId, emoji) {
    // ensure guest uuid for placeholder couples too
    if (!localStorage.getItem("bond_guest_uuid") && !localStorage.getItem("bond_anon_id")) {
        localStorage.setItem("bond_guest_uuid", crypto.randomUUID ? crypto.randomUUID() : ("guest_" + Date.now()));
    }

  const EMOJIS = ["❤️","😍","🔥","💯","🥹"];
  const prev = localMyReactions[coupleId];
  const isSame = prev === emoji;
  const next = isSame ? null : emoji;

  const newMyR = { ...localMyReactions, [coupleId]: next };
  const prevCounts = localReactions[coupleId] || {};
  const newCounts = { ...prevCounts };
  EMOJIS.forEach(e => { if (!newCounts[e]) newCounts[e] = 0; });
  if (prev && newCounts[prev] > 0) newCounts[prev]--;
  if (!isSame) newCounts[emoji] = (newCounts[emoji] || 0) + 1;

  const newR = { ...localReactions, [coupleId]: newCounts };
  setLocalMyReactions(newMyR);
  setLocalReactions(newR);

  try {
    localStorage.setItem("bond_placeholder_reactions", JSON.stringify(newR));
    localStorage.setItem("bond_placeholder_my_reactions", JSON.stringify(newMyR));
  } catch {}
}

React.useEffect(() => {
  let mounted = true;
  let retryTimer = null;

  async function fetchAll() {
    if (page === 0) {
      const cached = readFeedCache();
      if (cached) {
        setCouples(cached.couples);
        setReactions(cached.reactions);
        setMyReactions(cached.myReactions);
        setCommentCounts(cached.commentCounts);
        setPhotoCounts(cached.photoCounts || {}); // ✅ FIX: restore photoCounts from cache
        setLoading(false);
        setRealLoaded(true);
      }
    }

    setLoading(true); // ✅ FIX: removed duplicate setLoading(true) that was here before

    if (!window.supabaseClient) {
      retryTimer = setTimeout(() => { if (mounted) fetchAll(); }, 300);
      return;
    }

    try {
      let q = window.supabaseClient.from("couples")
        .select("id,couple_name,partner_username,couple_type,bond_score,emotional_sync_score,stability_score,growth_index,avatar_url,institution,locality,declared_by,created_at,social_links,backstory")
        .order("bond_score", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (filter !== "all") q = q.eq("couple_type", filter);

      const { data: cList, error: cErr } = await q;
      if (cErr) throw cErr;

      const safeList = cList || [];
      const ids = safeList.map(c => c.id);
      let allRxns = [], allComments = [], allPhotos = [];

      if (ids.length) {
        const [rxnRes, cmtRes, photoRes] = await Promise.all([
          window.supabaseClient.from("reactions")
            .select("target_id,user_id,reaction_type")
            .eq("target_type", "couple").in("target_id", ids),
          window.supabaseClient.from("couple_comments")
            .select("couple_id")
            .eq("target_type", "couple").in("couple_id", ids),
          window.supabaseClient.from("couple_community_photos")
            .select("couple_id")
            .in("couple_id", ids),
        ]);
        allRxns     = rxnRes.data   || [];
        allComments = cmtRes.data   || [];
        allPhotos   = photoRes.data || [];
      }

      if (!mounted) return;

      const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid");
      const rMap = {}, myMap = {}, cntMap = {}, photoMap = {};

      ids.forEach(id => {
        rMap[id] = {};
        EMOJIS.forEach(e => { rMap[id][e] = 0; });
        cntMap[id] = 0;
        photoMap[id] = 0;
      });

      allRxns.forEach(r => {
        if (rMap[r.target_id] && EMOJIS.includes(r.reaction_type)) {
          rMap[r.target_id][r.reaction_type] = (rMap[r.target_id][r.reaction_type] || 0) + 1;
          if (uid && r.user_id === uid) myMap[r.target_id] = r.reaction_type;
        }
      });

      allComments.forEach(c => { if (cntMap[c.couple_id] !== undefined) cntMap[c.couple_id]++; });
      allPhotos.forEach(p => { if (photoMap[p.couple_id] !== undefined) photoMap[p.couple_id]++; });

      let statusSet = new Set();
      if (ids.length) {
        const { data: statusData } = await window.supabaseClient
          .from("couple_statuses").select("couple_id")
          .in("couple_id", ids).gt("expires_at", new Date().toISOString());
        (statusData || []).forEach(s => statusSet.add(s.couple_id));
      }

      setCouples(prev => page === 0 ? safeList : [...prev, ...safeList]);
      setHasMore(safeList.length === PAGE_SIZE);
      setReactions(rMap);
      setMyReactions(myMap);
      setCommentCounts(cntMap);
      setPhotoCounts(photoMap);
      setStatusIds(statusSet);

      if (page === 0) {
        writeFeedCache({
          couples: safeList,
          reactions: rMap,
          myReactions: myMap,
          commentCounts: cntMap,
          photoCounts: photoMap, // ✅ FIX: was missing from cache write
        });
      }
    } catch(err) {
      console.error("[CoupleFeed] fetch failed:", err);
      if (mounted) setCouples([]);
    } finally {
      if (mounted) { setLoading(false); setRealLoaded(true); }
    }
  }

  fetchAll();
  return () => { mounted = false; if (retryTimer) clearTimeout(retryTimer); };
}, [filter, rankMode, refreshKey, page]);

const totalReactions = (id) => {
  const r = reactions[id] || {};
  return EMOJIS.reduce((s, e) => s + (r[e] || 0), 0);
};
const sorted = React.useMemo(() => {
  const arr = [...couples];
  if (rankMode === "popular") {
    return arr.sort((a,b) => {
      const ra = Object.values(reactions[a.id] || {}).reduce((s,v)=>s+v,0);
      const rb = Object.values(reactions[b.id] || {}).reduce((s,v)=>s+v,0);
      return rb - ra;
    });
  }
  if (rankMode === "rising") {
    // show newest 30 days sorted by bond score  
    return arr
      .filter(c => (Date.now() - new Date(c.created_at).getTime()) < 30*24*60*60*1000)
      .sort((a,b) => (b.bond_score||0) - (a.bond_score||0));
  }
  // default: bond score
  return arr.sort((a,b) => (b.bond_score||0) - (a.bond_score||0));
}, [couples, reactions, rankMode]);

const visible = React.useMemo(() => {
  const q = search.trim().toLowerCase();
  if (!q) return sorted;
  // Split query into words — ALL words must match somewhere (fuzzy AND logic)
  // "iit mumbai" → both "iit" and "mumbai" must appear
  // "bombay" → matches "IIT Bombay" even though query isn't exact
  const qWords = q.split(/\s+/).filter(w => w.length >= 2);
  return sorted.filter(c => {
    const haystack = [
      c.couple_name, c.partner_username, c.partner1_name, c.partner2_name,
      c.couple_type, c.institution, c.locality, c.backstory,
      c.declared_by === "partner" ? "self-declared" : null,
      c.declared_by === "outsider" ? "nominated" : null,
    ].filter(Boolean).join(" ").toLowerCase();
    // Every query word must appear somewhere in the haystack
    return qWords.every(word => haystack.includes(word));
  });
}, [sorted, search]);

async function recomputeEngagementScore(coupleId) {
  try {
    const [{ data: rxns }, { data: cmts }, { data: ships }] = await Promise.all([
      window.supabaseClient.from("reactions").select("id", { count:"exact" }).eq("target_type","couple").eq("target_id", coupleId),
      window.supabaseClient.from("couple_comments").select("id", { count:"exact" }).eq("couple_id", coupleId).eq("target_type","couple"),
      window.supabaseClient.from("ship_it").select("sails").or(`person_a_bond_id.eq.${coupleId},person_b_bond_id.eq.${coupleId}`),
    ]);
    const rCount = rxns?.length || 0;
    const cCount = cmts?.length || 0;
    const sCount = (ships || []).reduce((s, x) => s + (x.sails || 0), 0);
    const newScore = Math.min(Math.round(50 + rCount * 0.5 + cCount * 1.5 + sCount * 2), 95);
    await window.supabaseClient.from("couples").update({ bond_score: newScore, last_computed_at: new Date().toISOString() }).eq("id", coupleId);
    setCouples(prev => prev.map(c => c.id === coupleId ? { ...c, bond_score: newScore } : c));
  } catch(e) { console.warn("[engagement score] update failed", e); }
}

async function handleReact(coupleId, emoji) {
const uid = window.currentUser?.id || ensureGuestUUID();
  const prev = myReactions[coupleId];
  const isSame = prev === emoji;
  const next = isSame ? null : emoji;
  setMyReactions(p => ({ ...p, [coupleId]: next }));
  setReactions(p => {
    const r = { ...p[coupleId] };
    if (prev && r[prev]) r[prev] = Math.max(0, r[prev] - 1);
    if (!isSame) r[emoji] = (r[emoji] || 0) + 1;
    return { ...p, [coupleId]: r };
  });
  try {
    const session = await window.supabaseClient.auth.getSession();
    const token = session?.data?.session?.access_token ?? window.SUPABASE_ANON_KEY;
    await fetch(`${window.SUPABASE_URL}/functions/v1/api-reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ targetId: coupleId, targetType: "couple", emoji }),
    });
  } catch(e) { console.warn("[reaction] sync failed", e); }
  const c = couples.find(x => x.id === coupleId);
  if (c?.declared_by === "outsider") recomputeEngagementScore(coupleId);
}

return (
  <div style={{ padding:"0 16px" }}>
    {/* Search */}
    <div style={{ position:"relative", marginBottom:12 }}>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search couples, type, city, college…"
        style={{ width:"100%", boxSizing:"border-box",
          background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.09)",
          borderRadius:14, padding:"11px 40px 11px 16px", fontSize:13, color:"#fff",
          outline:"none", transition:"border-color 0.2s", fontFamily:"inherit" }}
        onFocus={e => e.target.style.borderColor="rgba(248,113,113,0.35)"}
        onBlur={e  => e.target.style.borderColor="rgba(255,255,255,0.09)"}
      />
      {search
        ? <button onClick={() => setSearch("")} style={{ position:"absolute", right:14, top:"50%",
            transform:"translateY(-50%)", background:"rgba(255,255,255,0.12)", border:"none",
            color:"rgba(255,255,255,0.7)", cursor:"pointer", width:20, height:20,
            borderRadius:999, fontSize:12, display:"flex", alignItems:"center",
            justifyContent:"center", padding:0 }}>×</button>
        : <span style={{ position:"absolute", right:14, top:"50%",
            transform:"translateY(-50%)", color:"rgba(255,255,255,0.2)",
            fontSize:14, pointerEvents:"none" }}>⌕</span>
      }
    </div>

    {/* Filter + rank + refresh */}
    <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
      <div style={{ position:"relative", flex:1 }}>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ width:"100%", appearance:"none",
            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.09)",
            color:"#fff", fontSize:13, borderRadius:12, padding:"9px 30px 9px 14px",
            outline:"none", cursor:"pointer", fontFamily:"inherit" }}>
          {TYPES.map(t => <option key={t} value={t} style={{ background:"#0f172a" }}>{t === "all" ? "All Types" : t}</option>)}
        </select>
        <span style={{ position:"absolute", right:11, top:"50%", transform:"translateY(-50%)",
          color:"rgba(255,255,255,0.25)", fontSize:10, pointerEvents:"none" }}>▾</span>
      </div>
      <div style={{ display:"flex", borderRadius:12, overflow:"hidden", border:"1px solid rgba(255,255,255,0.09)", flexShrink:0 }}>
        {[{ id:"bond", label:"🏅 Bond" }, { id:"popular", label:"❤️ Hot" }, { id:"rising", label:"🌱 New" }].map(m => (
          <button key={m.id} onClick={() => { setRankMode(m.id); setPage(0); }}
            style={{ padding:"8px 12px", fontSize:11, fontWeight:600, cursor:"pointer", border:"none",
              fontFamily:"inherit",
              background: rankMode===m.id ? "linear-gradient(135deg,#f87171,#fb923c)" : "rgba(255,255,255,0.04)",
              color: rankMode===m.id ? "#fff" : "rgba(255,255,255,0.38)", transition:"all 0.15s" }}>
            {m.label}
          </button>
        ))}
      </div>
      <button onClick={() => setRefreshKey(k => k+1)}
        style={{ width:36, height:36, borderRadius:10, background:"rgba(255,255,255,0.05)",
          border:"1px solid rgba(255,255,255,0.09)", color:"rgba(255,255,255,0.35)",
          cursor:"pointer", fontSize:15, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"center" }}>↻</button>
    </div>

    {rankMode === "rising" && !loading && (
      <div style={{ fontSize:11, color:"rgba(52,211,153,0.6)", marginBottom:10, fontWeight:600 }}>
        🌱 New couples this week — sorted by BondScore
      </div>
    )}


{(() => {
  // Still fetching — show blurred shimmer placeholders
  if (!realLoaded && visible.length === 0) {
  return (
    <div style={{ textAlign:"center", padding:"60px 0", color:"rgba(248,113,113,0.4)" }}>
      Loading couples…
    </div>
  );
}

  // ── LOADED BUT DB IS EMPTY → show placeholder couples as real full cards ──

if (realLoaded && visible.length === 0 && !search.trim()) {

  const { profiles } = getGeneratedProfiles({
    page,
    pageSize: 20,
    query: search,
    coupleTypeFilter: filter
  });

  return profiles.map((c, i) => (
    <div key={c.id} className="bond-fade-up" style={{ animationDelay:`${i * 35}ms` }}>
      <CoupleCard
        couple={c}
        rank={i + 1}
        total={profiles.length}
        reactions={c._seed_reactions || {}}
        myReaction={null}
        commentCount={c._seed_comment_count || 0}
        communityPhotoCount={c._seed_photo_count || 0}
        hasStatus={false}
        onReact={(emoji) => handleLocalReact(c.id, emoji)}
        onSelect={(c) => setSelectedCouple(c)}
      />
    </div>
  ));
}
  

  // Search returned nothing
  if (realLoaded && visible.length === 0 && search.trim()) {
    return (
      <div style={{ textAlign:"center", padding:"60px 0" }}>
        <div style={{ fontSize:20, color:"rgba(255,255,255,0.08)", marginBottom:8 }}>◇</div>
        <div style={{ color:"rgba(255,255,255,0.25)", fontSize:14 }}>
          No couples match your search
        </div>
      </div>
    );
  }

  // Normal render — real DB cards
  return visible.map((couple, i) => (
    <div key={couple.id} className="bond-fade-up" style={{ animationDelay:`${i * 35}ms` }}>
      <CoupleCard
        couple={couple}
        rank={sorted.indexOf(couple) + 1}
        total={sorted.length}
        reactions={reactions[couple.id] || {}}
        myReaction={myReactions[couple.id] || null}
        commentCount={commentCounts[couple.id] || 0}
        communityPhotoCount={photoCounts[couple.id] || 0}
        hasStatus={statusIds.has(couple.id)}
        onReact={(emoji) => handleReact(couple.id, emoji)}
        onSelect={setSelectedCouple}
      />
    </div>
  ));
})()}

    {/* Load more */}
    {hasMore && !loading && (
      <button onClick={() => setPage(p => p + 1)}
        style={{ width:"100%", padding:"12px", borderRadius:14, marginTop:8,
          background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)",
          color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:600,
          cursor:"pointer", fontFamily:"inherit" }}>
        Load more ↓
      </button>
    )}

    {selectedCouple && (
      <CoupleDetailModal couple={selectedCouple} onClose={() => setSelectedCouple(null)} />
    )}
  </div>
);
}

/* ============================================================
3. PASTE after CoupleFeed → function CoupleCard()
============================================================ */

/* ============================================================
BLOCK E — REPLACE → function CoupleCard()

FIX:
- NO .channel() / realtime subscription
- NO individual DB queries
- Counts passed as props from CoupleFeed (computed once)
- Reactions are optimistic — no async in click handler
============================================================ */

/* ============================================================
BLOCK 3 — REPLACE → function CoupleCard()

CHANGES:
- Dislike button REMOVED
- Like-only with count
- Popularity still computed (likes only now)
============================================================ */

/* ============================================================
BLOCK 2 — REPLACE → function CoupleCard()

Shows couple_name (e.g. "Hrig & Priya") and declared_by badge
============================================================ */

/* ============================================================
BLOCK 3 — REPLACE → function CoupleCard()
Softer, more on-brand with BondOS coral/indigo palette
============================================================ */


/* ============================================================
D — REPLACE → function CoupleCard()
Warm, alive cards with photo support
============================================================ */
function CommentDrawer({ targetId, targetType }) {
const [comments, setComments] = React.useState([]);
const [text, setText] = React.useState("");
const [loading, setLoading] = React.useState(true);
const [posting, setPosting] = React.useState(false);
if (String(targetId).startsWith("__p")) {
    return (
      <div style={{ padding:"16px", textAlign:"center",
        fontSize:12, color:"rgba(255,255,255,0.2)", fontStyle:"italic" }}>
        Comments available on real couple profiles only.
      </div>
    );
  }
React.useEffect(() => {
let mounted = true;
async function load() {
const { data } = await window.supabaseClient.from("couple_comments")
.select("*").eq("couple_id", targetId).eq("target_type", targetType)
.order("created_at", { ascending: true });
if (mounted) { setComments(data || []); setLoading(false); }
}
load();
return () => { mounted = false; };
}, [targetId, targetType]);

async function postComment() {
if (!text.trim()) return;
setPosting(true);
const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid");
const username = window.BOND_USERNAME || (window.currentUser?.email?.split("@")[0]) || "anon";
const { data: { session } } = await window.supabaseClient.auth.getSession();
const token = session?.access_token ?? window.SUPABASE_ANON_KEY;

// Ensure guest has a UUID
if (!uid) {
  const guestId = crypto.randomUUID();
  localStorage.setItem("bond_guest_uuid", guestId);
}
const res = await fetch(`${window.SUPABASE_URL}/functions/v1/api-comments`, {
method: "POST",
headers: {
"Content-Type": "application/json",
"Authorization": `Bearer ${token}`
},
body: JSON.stringify({
coupleId: targetId,
targetType,
content: text.trim()
}),
});
const row = await res.json();
const error = res.ok ? null : row;
if (!error && row?.id) {
setComments(p => [...p, row]);
// Trigger score recompute for outsider couples
if (targetType === "couple") {
}
}
setText(""); setPosting(false);
}

const fmt = (ts) => {
const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
if (diff < 1) return "just now"; if (diff < 60) return `${diff}m`;
if (diff < 1440) return `${Math.floor(diff/60)}h`; return `${Math.floor(diff/1440)}d`;
};

return (
<div style={{ background:"rgba(255,255,255,0.03)", borderTop:"1px solid rgba(255,255,255,0.07)", padding:"12px 14px" }}>
{loading ? (
<div style={{ textAlign:"center", padding:"12px 0", color:"rgba(255,255,255,0.25)", fontSize:12 }}>Loading…</div>
) : (
<div style={{ maxHeight:200, overflowY:"auto", marginBottom:10 }}>
{comments.length === 0 && <div style={{ textAlign:"center", padding:"10px 0", color:"rgba(255,255,255,0.2)", fontSize:12 }}>No comments yet — be first ✨</div>}
{comments.map(c => (
<div key={c.id} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:10 }}>
<div style={{ width:26, height:26, borderRadius:8, background:"rgba(248,113,113,0.15)", border:"1px solid rgba(248,113,113,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#f87171", flexShrink:0 }}>
{(c.username||"?")[0].toUpperCase()}
</div>
<div style={{ flex:1 }}>
<div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
<span style={{ fontSize:12, fontWeight:700, color:"#fff" }}>{c.username||"anon"}</span>
<span style={{ fontSize:10, color:"rgba(255,255,255,0.25)" }}>{fmt(c.created_at)}</span>
</div>
<div style={{ fontSize:12, color:"rgba(255,255,255,0.7)", lineHeight:1.4, marginTop:2 }}>{c.content}</div>
</div>
</div>
))}
</div>
)}
<div style={{ display:"flex", gap:8, alignItems:"center" }}>
<input value={text} onChange={e => setText(e.target.value)}
onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); postComment(); }}}
placeholder="Add a comment…"
style={{ flex:1, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 12px", fontSize:12, color:"#fff", outline:"none", fontFamily:"inherit" }}
/>
<button onClick={postComment} disabled={posting || !text.trim()}
style={{ padding:"8px 14px", borderRadius:10, background: text.trim() ? "rgba(248,113,113,0.85)" : "rgba(255,255,255,0.06)", border:"none", color: text.trim() ? "#fff" : "rgba(255,255,255,0.3)", fontSize:12, fontWeight:700, cursor: text.trim() ? "pointer" : "default", transition:"all 0.15s", fontFamily:"inherit" }}>
{posting ? "…" : "Post"}
</button>
</div>
</div>
);
}
/* ── 24h Status / Stories ── */
function CoupleStatus({ coupleId, isOwner }) {
const [statuses, setStatuses] = React.useState([]);
const [viewing, setViewing] = React.useState(null);
const [uploading, setUploading] = React.useState(false);
const [caption, setCaption] = React.useState("");
const [imgData, setImgData] = React.useState(null);
const [showUpload, setShowUpload] = React.useState(false);
const [imgFile, setImgFile] = React.useState(null);
const [proofImg, setProofImg] = React.useState(null);
React.useEffect(() => {
let mounted = true;
async function load() {
const { data } = await window.supabaseClient
  .from("couple_statuses")
  .select("*")
  .eq("couple_id", coupleId)
  .gt("expires_at", new Date().toISOString())
  .order("created_at", { ascending: false });
if (mounted) setStatuses(data || []);
}
load();
return () => { mounted = false; };
}, [coupleId]);

const [proofFile, setProofFile] = React.useState(null); // ADD THIS STATE

function handleFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { alert("Photo must be under 2MB"); return; }
  setImgFile(file);
  const reader = new FileReader();
  reader.onload = () => setImgData(reader.result);
  reader.readAsDataURL(file);
}
async function uploadStatus() {
if (!imgFile) return;
setUploading(true);
const compressed = await compressImage(imgFile, 800, 0.8);
const url = await uploadToStorage("statuses", compressed, "status/");
if (!url) {
alert("Upload failed, please try again.");
setUploading(false);
return;
}
const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid");
const now = new Date();
const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const { data, error } = await window.supabaseClient
.from("couple_statuses")
.insert({
couple_id: coupleId,
image_url: url,          // ← now a real URL, not base64
caption: caption.trim() || null,
created_by: uid || null,
created_at: now.toISOString(),
expires_at: expires.toISOString()
}).select().single();
if (!error && data) setStatuses(prev => [data, ...prev]);
setImgFile(null); setImgData(null); setCaption("");
setShowUpload(false); setUploading(false);
}
function timeLeft(expires_at) {
const ms = new Date(expires_at).getTime() - Date.now();
if (ms <= 0) return "expired";
const h = Math.floor(ms / 3600000);
const m = Math.floor((ms % 3600000) / 60000);
return h > 0 ? `${h}h left` : `${m}m left`;
}

return (
<div style={{ marginBottom:16 }}>
{/* Status strip */}
<div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:4 }}>
  {/* Upload bubble (owner only) */}
  {isOwner && (
    <div style={{ flexShrink:0, textAlign:"center" }}>
      <button onClick={() => setShowUpload(v => !v)}
        style={{
          width:56, height:56, borderRadius:18,
          background:"rgba(255,255,255,0.05)",
          border:"2px dashed rgba(248,113,113,0.4)",
          display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"pointer", fontSize:22
        }}>
        +
      </button>
      <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", marginTop:4 }}>Add</div>
    </div>
  )}

  {/* Active statuses */}
  {statuses.map((s, i) => (
    <div key={s.id} style={{ flexShrink:0, textAlign:"center" }}>
      <button onClick={() => setViewing(s)}
        style={{
          width:56, height:56, borderRadius:18, overflow:"hidden",
          border:"2px solid rgba(248,113,113,0.5)",
          padding:0, cursor:"pointer",
          background:"rgba(255,255,255,0.06)"
        }}>
        <img src={s.image_url} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
      </button>
      <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", marginTop:4 }}>
        {timeLeft(s.expires_at)}
      </div>
    </div>
  ))}
</div>

{/* Upload panel */}
{showUpload && isOwner && (
  <div style={{ marginTop:10, background:"rgba(255,255,255,0.04)",
    border:"1px solid rgba(255,255,255,0.09)", borderRadius:14, padding:14 }}>
    <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.5)", marginBottom:10 }}>
      📸 Add a status — visible for 24 hours
    </div>
    <label style={{ display:"block", cursor:"pointer", marginBottom:8 }}>
      <div style={{ borderRadius:12, border:`2px dashed ${imgData ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.15)"}`,
        padding: imgData ? "4px" : "16px 12px", textAlign:"center",
        background:"rgba(255,255,255,0.02)", overflow:"hidden" }}>
        {imgData
          ? <img src={imgData} style={{ width:"100%", maxHeight:160, objectFit:"cover", borderRadius:10, display:"block" }} />
          : <div>
              <div style={{ fontSize:24, marginBottom:6 }}>📷</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>Tap to pick photo</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.2)", marginTop:2 }}>max 3MB · disappears in 24h</div>
            </div>
        }
      </div>
      <input type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }} />
    </label>
    {imgData && (
      <input value={caption} onChange={e => setCaption(e.target.value)}
        placeholder="Add a caption… (optional)"
        maxLength={120}
        style={{ width:"100%", boxSizing:"border-box", marginBottom:10,
          background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)",
          borderRadius:10, padding:"8px 12px", fontSize:12, color:"#fff",
          outline:"none", fontFamily:"inherit" }} />
    )}
    <div style={{ display:"flex", gap:8 }}>
      <button onClick={() => { setShowUpload(false); setImgData(null); setCaption(""); }}
        style={{ flex:1, padding:"8px", borderRadius:10,
          background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)",
          color:"rgba(255,255,255,0.4)", fontSize:12, fontWeight:600,
          cursor:"pointer", fontFamily:"inherit" }}>
        Cancel
      </button>
      <button onClick={uploadStatus} disabled={!imgData || uploading}
        style={{ flex:2, padding:"8px", borderRadius:10,
          background: imgData ? "linear-gradient(135deg,#f87171,#fb923c)" : "rgba(255,255,255,0.08)",
          border:"none", color: imgData ? "#fff" : "rgba(255,255,255,0.3)",
          fontSize:12, fontWeight:700,
          cursor: imgData ? "pointer" : "default",
          fontFamily:"inherit", opacity: uploading ? 0.7 : 1 }}>
        {uploading ? "Posting…" : "Post Status ✓"}
      </button>
    </div>
  </div>
)}

{/* Status viewer overlay */}
{viewing && (
  <div onClick={() => setViewing(null)}
    style={{ position:"fixed", inset:0, zIndex:2000,
      background:"rgba(0,0,0,0.92)", backdropFilter:"blur(12px)",
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:20 }}>
    <div onClick={e => e.stopPropagation()}
      style={{ width:"100%", maxWidth:420, borderRadius:20, overflow:"hidden",
        background:"#0e0e12", border:"1px solid rgba(255,255,255,0.08)" }}>
      <img src={viewing.image_url}
        style={{ width:"100%", maxHeight:400, objectFit:"cover", display:"block" }} />
      {viewing.caption && (
        <div style={{ padding:"12px 16px", fontSize:14,
          color:"rgba(255,255,255,0.8)", lineHeight:1.5 }}>
          {viewing.caption}
        </div>
      )}
      <div style={{ padding:"8px 16px 14px", fontSize:11,
        color:"rgba(255,255,255,0.25)" }}>
        {timeLeft(viewing.expires_at)}
      </div>
      <button onClick={() => setViewing(null)}
        style={{ width:"100%", padding:"12px", background:"rgba(255,255,255,0.05)",
          border:"none", borderTop:"1px solid rgba(255,255,255,0.07)",
          color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:600,
          cursor:"pointer", fontFamily:"inherit" }}>
        Close
      </button>
    </div>
  </div>
)}
</div>
);
}

// ============================================================
// 2. CoupleDetailModal — FULL CORRECTED VERSION
// ============================================================

function CoupleDetailModal({ couple, onClose }) {
  const scrollRef = React.useRef(null);
const touchStartY = React.useRef(null);

const handleTouchStart = (e) => {
  touchStartY.current = e.touches[0].clientY;
};

const handleTouchEnd = (e) => {
  if (touchStartY.current === null) return;
  const delta = e.changedTouches[0].clientY - touchStartY.current;
  if (delta > 80) onClose(); // swipe down > 80px = close
  touchStartY.current = null;
};
React.useEffect(() => {
  if (scrollRef.current) scrollRef.current.scrollTop = 0;
}, [couple.id]);
const STORY_QUESTIONS = [
  { key:"how_met",        q:"How did you two actually meet?" },
  { key:"first_noticed",  q:"First thing you noticed about them?" },
  { key:"said_it_first",  q:"Who said \u201cI like you\u201d first?" },
  { key:"chaotic_moment", q:"Most chaotic thing you\u2019ve done together?" },
  { key:"weird_common",   q:"Weirdest thing you have in common?" },
  { key:"knew_different", q:"The moment you knew this was different?" },
  { key:"friend_word",    q:"One word your friends use to describe you two?" },
  { key:"ignored_flag",   q:"Biggest red flag you ignored? \uD83D\uDE05" },
  { key:"argue_about",    q:"Your go-to argument topic?" },
  { key:"movie_genre",    q:"If your relationship was a movie genre?" },
  { key:"best_trip",      q:"Best trip or adventure together?" },
  { key:"annoy_each",     q:"How do you annoy each other the most?" },
];

// existing state
const [challenges, setChallenges] = React.useState([]);
const [stories, setStories] = React.useState({});
const [editKey, setEditKey] = React.useState(null);
const [editVal, setEditVal] = React.useState("");
const [saving, setSaving] = React.useState(false);
const [loadingAll, setLoadingAll] = React.useState(true);

// ── NEW: community photo state ──
const [communityPhotos, setCommunityPhotos] = React.useState([]);
const [showPhotoUpload, setShowPhotoUpload] = React.useState(false);
const [uploadStory, setUploadStory] = React.useState("");
const [uploadChallenge, setUploadChallenge] = React.useState("");
const [uploadFile, setUploadFile] = React.useState(null);
const [uploadPreview, setUploadPreview] = React.useState(null);
const [uploadSaving, setUploadSaving] = React.useState(false);

const isOwner = couple.creator_id &&
  (couple.creator_id === window.currentUser?.id ||
   couple.creator_id === localStorage.getItem("bond_guest_uuid"));

const bond = Math.round(couple.bond_score || 0);
const bondGrad = bond >= 80 ? "linear-gradient(135deg,#34d399,#10b981)"
  : bond >= 55 ? "linear-gradient(135deg,#f87171,#fb923c)"
  : "linear-gradient(135deg,#6b7280,#9ca3af)";
const TYPE_SYM = { Romantic:"\u2661", Engaged:"\u25C7", Married:"\u25CB",
  "Long Distance":"\u2197", Situationship:"\u223F", "Friends to Lovers":"\u21DD" };
const sym = TYPE_SYM[couple.couple_type] || "\u25C7";
const TYPE_COLORS = {
  "Romantic":       { bg:"rgba(244,114,182,0.12)", color:"#f9a8d4" },
  "Engaged":        { bg:"rgba(167,139,250,0.12)", color:"#c4b5fd" },
  "Married":        { bg:"rgba(251,191,36,0.12)",  color:"#fde68a" },
  "Long Distance":  { bg:"rgba(96,165,250,0.12)",  color:"#93c5fd" },
  "Situationship":  { bg:"rgba(251,146,60,0.12)",  color:"#fdba74" },
  "Friends to Lovers":{ bg:"rgba(52,211,153,0.12)", color:"#6ee7b7" },
};
const tc = TYPE_COLORS[couple.couple_type] || { bg:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.4)" };
const displayName = couple.couple_name || couple.partner_username || "Anonymous";
const locationLabel = [couple.institution, couple.locality].filter(Boolean).join(" \u00B7 ");

// ── LOAD: existing + community photos ──
React.useEffect(() => {
  let mounted = true;
  async function load() {
      if (couple._isPlaceholder) {
    setLoadingAll(false);
    return;
  }
    const [chRes, stRes, photoRes] = await Promise.all([
      window.supabaseClient.from("couple_challenges")
        .select("challenge_key,xp_awarded,proof_url,proof_note,completed_at")
        .eq("couple_id", couple.id).order("completed_at", { ascending:false }),
      window.supabaseClient.from("couple_stories")
        .select("question_key,answer").eq("couple_id", couple.id),
      window.supabaseClient.from("couple_community_photos")
        .select("*").eq("couple_id", couple.id)
        .order("created_at", { ascending:false }).limit(20),
    ]);
    if (!mounted) return;
    setChallenges(chRes.data || []);
    const stMap = {};
    (stRes.data || []).forEach(s => { stMap[s.question_key] = s.answer; });
    setStories(stMap);
    setCommunityPhotos(photoRes.data || []);
    setLoadingAll(false);
  }
  load();
  return () => { mounted = false; };
}, [couple.id]);

async function saveStory() {
  if (!editVal.trim() || !editKey) return;
  setSaving(true);
  await window.supabaseClient.from("couple_stories").upsert({
    couple_id: couple.id, question_key: editKey, answer: editVal.trim()
  }, { onConflict:"couple_id,question_key" });
  setStories(prev => ({ ...prev, [editKey]: editVal.trim() }));
  setEditKey(null); setEditVal(""); setSaving(false);
}

// ── NEW: community photo upload handler ──
async function handleCommunityPhotoUpload() {
  if (!uploadFile) return;
  setUploadSaving(true);
  try {
    const compressed = await compressImage(uploadFile, 800, 0.8);
    const url = await uploadToStorage("bond-uploads", compressed, "community/");
    if (!url) { setUploadSaving(false); return; }
    const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid");
    const username = window.BOND_USERNAME ||
      (window.currentUser?.email?.split("@")[0]) || "anon";
    await window.supabaseClient.from("couple_community_photos").insert({
      couple_id: couple.id,
      uploader_id: uid,
      uploader_username: username,
      photo_url: url,
      short_story: uploadStory.trim() || null,
      challenge_tag: uploadChallenge.trim() || null,
    });
    setCommunityPhotos(prev => [{
      id: Date.now(), couple_id: couple.id, uploader_username: username,
      photo_url: url, short_story: uploadStory.trim(),
      challenge_tag: uploadChallenge.trim(), created_at: new Date().toISOString()
    }, ...prev]);
    setShowPhotoUpload(false);
    setUploadFile(null); setUploadPreview(null);
    setUploadStory(""); setUploadChallenge("");
  } catch(e) { console.warn("[communityPhoto] upload failed", e); }
  setUploadSaving(false);
}

// dedupe challenges
const seenKeys = new Set();
const dedupedChallenges = challenges.filter(c => {
  const ch = COUPLE_CHALLENGES.find(x => x.key === c.challenge_key);
  if (!ch) return false;
  if (ch.cadence === "daily" || ch.cadence === "weekly" || ch.cadence === "monthly") return true;
  if (seenKeys.has(c.challenge_key)) return false;
  seenKeys.add(c.challenge_key); return true;
});

return (
<div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:1000,
  background:"rgba(0,0,0,0.75)", backdropFilter:"blur(8px)",
  display:"flex", alignItems:"flex-end", justifyContent:"center",
  overflow:"hidden",
  padding:"0" }}>
<div onClick={e => e.stopPropagation()}
onTouchStart={handleTouchStart}
onTouchEnd={handleTouchEnd}
  ref={scrollRef}
  style={{
    width:"100%",
    maxWidth:480,
    maxHeight:"92vh",
    overflowY:"auto",
    WebkitOverflowScrolling:"touch",
    borderRadius:"24px 24px 0 0",
    background:"#0e0e12",
    border:"1px solid rgba(255,255,255,0.08)",
    borderBottom:"none",
    animation:"bond-fade-up 0.28s ease",
    position:"relative",
  }}>
      {/* Drag handle */}
    {/* Drag handle — tap to close */}
<div style={{ padding: "0 20px 20px",
  borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
  <button onClick={onClose}
    style={{ width: "100%", padding: "13px", borderRadius: 14,
      background: "linear-gradient(135deg,rgba(248,113,113,0.12),rgba(251,146,60,0.08))",
      border: "1px solid rgba(248,113,113,0.2)",
      color: "#fca5a5", fontSize: 14, fontWeight: 700,
      cursor: "pointer", fontFamily: "inherit",
      display: "flex", alignItems: "center",
      justifyContent: "center", gap: 8 }}>
    <span>↓</span> Close
  </button>
</div>

      {/* Active statuses */}
      <CoupleStatus coupleId={couple.id} isOwner={false} />

      {/* Header */}
      <div style={{ padding:"12px 20px 0" }}>
        <div style={{ height:2, borderRadius:999, background:"linear-gradient(90deg,#f87171,#fb923c,#fbbf24)", marginBottom:16 }} />
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
          <div style={{ width:60, height:60, borderRadius:16, overflow:"hidden", flexShrink:0,
            background:tc.bg, border:`1px solid ${tc.color}33`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
            {couple.avatar_url
              ? <img src={couple.avatar_url} style={{ width:"100%", height:"100%", objectFit:"cover" }} loading="lazy" />
              : <span style={{ color:tc.color }}>{sym}</span>}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:18, fontWeight:900, color:"#fff", letterSpacing:"-0.02em",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{displayName}</div>
            <div style={{ display:"flex", gap:6, marginTop:5, flexWrap:"wrap", alignItems:"center" }}>
              <span style={{ fontSize:11, padding:"2px 10px", borderRadius:999,
                background:tc.bg, color:tc.color, fontWeight:700 }}>{sym} {couple.couple_type}</span>
              {locationLabel && <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{locationLabel}</span>}
            </div>
            {/* Social links */}
            {couple.social_links && Object.keys(couple.social_links).some(k => couple.social_links[k]) && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:10 }}>
                {[
                  { key:"instagram", label:"Instagram", icon:"📸" },
                  { key:"linkedin",  label:"LinkedIn",  icon:"💼" },
                  { key:"twitter",   label:"Twitter / X", icon:"🐦" },
                  { key:"other",     label:"Link",      icon:"🔗" },
                ].filter(s => couple.social_links[s.key]).map(s => (
                  <a key={s.key}
                    href={couple.social_links[s.key].startsWith("http")
                      ? couple.social_links[s.key]
                      : "https://" + couple.social_links[s.key]}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display:"flex", alignItems:"center", gap:5,
                      padding:"6px 14px", borderRadius:999,
                      background:"rgba(255,255,255,0.06)",
                      border:"1px solid rgba(255,255,255,0.1)",
                      textDecoration:"none", fontSize:12, fontWeight:600,
                      color:"rgba(255,255,255,0.7)", cursor:"pointer" }}>
                    <span>{s.icon}</span><span>{s.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize:30, fontWeight:900, letterSpacing:"-0.03em",
              background:bondGrad, WebkitBackgroundClip:"text",
              WebkitTextFillColor:"transparent" }}>{bond}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)" }}>bond</div>
          </div>
        </div>

        {/* Score trio */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
          {[{ sym:"\u23C1", label:"Sync",   val:couple.emotional_sync_score },
            { sym:"\u2661", label:"Stable", val:couple.stability_score },
            { sym:"\u25B3", label:"Growth", val:couple.growth_index }].map(s => (
            <div key={s.label} style={{ borderRadius:14, padding:"12px 6px", textAlign:"center",
              background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", marginBottom:4 }}>{s.sym}</div>
              <div style={{ fontSize:18, fontWeight:800, color:"#fff" }}>{Math.round(s.val||0)}</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {loadingAll ? (
        <div style={{ padding:"32px 0", textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:13 }}>Loading…</div>
      ) : (
        <div style={{ padding:"0 20px 32px" }}>

          {/* Backstory */}
          {couple.backstory && (
            <div style={{ marginBottom:24, borderRadius:16,
              background:"rgba(248,113,113,0.05)",
              border:"1px solid rgba(248,113,113,0.12)", padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.3)",
                letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>
                📖 Their story
              </div>
              <div style={{ fontSize:14, color:"rgba(255,255,255,0.8)", lineHeight:1.7, fontStyle:"italic" }}>
                "{couple.backstory}"
              </div>
            </div>
          )}

          {/* Challenges done */}
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.25)",
              letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>
              ⚡ Challenges completed · {dedupedChallenges.length}
            </div>
            {dedupedChallenges.length === 0 ? (
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.2)", fontStyle:"italic" }}>No challenges completed yet.</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {dedupedChallenges.map((c, i) => {
                  const ch = COUPLE_CHALLENGES.find(x => x.key === c.challenge_key);
                  if (!ch) return null;
                  return (
                    <div key={i} style={{ borderRadius:12, background:"rgba(52,211,153,0.05)",
                      border:"1px solid rgba(52,211,153,0.15)", overflow:"hidden" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px" }}>
                        <span style={{ fontSize:18, flexShrink:0 }}>{ch.icon}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"rgba(52,211,153,0.9)" }}>{ch.label}</div>
                          <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginTop:1 }}>
                            {ch.cadence} · +{c.xp_awarded} XP
                            {c.proof_note && <span style={{ color:"rgba(255,255,255,0.35)" }}> · {c.proof_note}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize:10, padding:"2px 8px", borderRadius:999,
                          background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.3)" }}>✓</span>
                      </div>
                      {c.proof_url && (
                        <img src={c.proof_url} style={{ width:"100%", maxHeight:180, objectFit:"cover", display:"block" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── COMMUNITY SPOTTED PHOTOS ── */}
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.25)",
                letterSpacing:"0.1em", textTransform:"uppercase" }}>
                📸 Spotted by the community · {communityPhotos.length}
              </div>
              <button onClick={() => setShowPhotoUpload(v => !v)}
                style={{ fontSize:11, padding:"4px 12px", borderRadius:999,
                  background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.25)",
                  color:"#fca5a5", cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>
                + Add Photo
              </button>
            </div>

            {/* Upload form */}
            {showPhotoUpload && (
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:16, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"rgba(255,255,255,0.6)", marginBottom:12 }}>
                  Spotted them? Share the moment 👀
                </div>
                {/* File picker */}
                <label style={{ display:"block", marginBottom:10, cursor:"pointer" }}>
                  <div style={{ border:"1px dashed rgba(248,113,113,0.3)", borderRadius:12, padding:"20px",
                    textAlign:"center",
                    background: uploadPreview ? "transparent" : "rgba(248,113,113,0.04)" }}>
                    {uploadPreview
                      ? <img src={uploadPreview} style={{ maxWidth:"100%", maxHeight:160,
                          borderRadius:10, objectFit:"cover" }} />
                      : <div style={{ color:"rgba(255,255,255,0.25)", fontSize:12 }}>Tap to upload a photo</div>}
                  </div>
                  <input type="file" accept="image/*" style={{ display:"none" }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setUploadFile(f);
                      const reader = new FileReader();
                      reader.onload = ev => setUploadPreview(ev.target.result);
                      reader.readAsDataURL(f);
                    }} />
                </label>
                {/* Story */}
                <textarea value={uploadStory} onChange={e => setUploadStory(e.target.value)}
                  placeholder="Where did you spot them? (optional)" rows={2}
                  style={{ width:"100%", boxSizing:"border-box",
                    background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
                    borderRadius:10, padding:"10px 12px", fontSize:13, color:"#fff",
                    outline:"none", resize:"none", fontFamily:"inherit", marginBottom:10 }} />
                {/* Challenge tag */}
                <input value={uploadChallenge} onChange={e => setUploadChallenge(e.target.value)}
                  placeholder="Tag a challenge (e.g. 'caught being cute') — optional"
                  style={{ width:"100%", boxSizing:"border-box",
                    background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
                    borderRadius:10, padding:"10px 12px", fontSize:13, color:"#fff",
                    outline:"none", fontFamily:"inherit", marginBottom:12 }} />
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => { setShowPhotoUpload(false); setUploadFile(null); setUploadPreview(null); setUploadStory(""); setUploadChallenge(""); }}
                    style={{ flex:1, padding:"10px", borderRadius:12,
                      background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)",
                      color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:600,
                      cursor:"pointer", fontFamily:"inherit" }}>
                    Cancel
                  </button>
                  <button onClick={handleCommunityPhotoUpload}
                    disabled={!uploadFile || uploadSaving}
                    style={{ flex:2, padding:"10px", borderRadius:12,
                      background:"linear-gradient(135deg,#f87171,#fb923c)", border:"none",
                      color:"#fff", fontSize:13, fontWeight:800,
                      cursor: (!uploadFile || uploadSaving) ? "default" : "pointer",
                      opacity: (!uploadFile || uploadSaving) ? 0.6 : 1,
                      fontFamily:"inherit" }}>
                    {uploadSaving ? "Uploading…" : "📸 Share Spotted Photo"}
                  </button>
                </div>
              </div>
            )}

            {/* Photo gallery */}
            {communityPhotos.length === 0 ? (
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.2)", fontStyle:"italic",
                textAlign:"center", padding:"16px 0" }}>
                No community photos yet — be the first to spot them! 👀
              </div>
            ) : (
              <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:8 }}>
                {communityPhotos.map(photo => (
                  <div key={photo.id} style={{ flexShrink:0, width:200,
                    background:"rgba(255,255,255,0.04)", borderRadius:14,
                    border:"1px solid rgba(255,255,255,0.08)", overflow:"hidden" }}>
                    <img src={photo.photo_url}
                      style={{ width:"100%", height:130, objectFit:"cover", display:"block" }} />
                    <div style={{ padding:"10px 12px" }}>
                      {photo.short_story && (
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)",
                          marginBottom:6, lineHeight:1.5 }}>
                          "{photo.short_story}"
                        </div>
                      )}
                      {photo.challenge_tag && (
                        <span style={{ fontSize:10, padding:"2px 8px", borderRadius:999,
                          background:"rgba(248,113,113,0.1)", color:"#fca5a5",
                          border:"1px solid rgba(248,113,113,0.2)",
                          display:"inline-block", marginBottom:6 }}>
                          🏆 {photo.challenge_tag}
                        </span>
                      )}
                      <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)" }}>
                        by @{photo.uploader_username || "anon"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Story Q&A */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.25)",
              letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>
              💬 Their story
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {STORY_QUESTIONS.map(sq => {
                const answered = stories[sq.key];
                const isEditing = editKey === sq.key;
                if (!answered && !isOwner) return null;
                return (
                  <div key={sq.key} style={{ borderRadius:12, background:"rgba(255,255,255,0.03)",
                    border:"1px solid rgba(255,255,255,0.07)", overflow:"hidden" }}>
                    <div style={{ padding:"10px 12px" }}>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", fontWeight:600, marginBottom:6 }}>{sq.q}</div>
                      {isEditing ? (
                        <div>
                          <textarea value={editVal} onChange={e => setEditVal(e.target.value)}
                            placeholder="Answer…" maxLength={200}
                            style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.05)",
                              border:"1px solid rgba(248,113,113,0.3)", borderRadius:8, padding:"8px 10px",
                              fontSize:12, color:"#fff", outline:"none", fontFamily:"inherit",
                              resize:"none", minHeight:60, lineHeight:1.5 }} />
                          <div style={{ display:"flex", gap:6, marginTop:8 }}>
                            <button onClick={() => { setEditKey(null); setEditVal(""); }}
                              style={{ flex:1, padding:"6px", borderRadius:8,
                                background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
                                color:"rgba(255,255,255,0.4)", fontSize:11, fontWeight:600,
                                cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
                            <button onClick={saveStory} disabled={saving || !editVal.trim()}
                              style={{ flex:2, padding:"6px", borderRadius:8,
                                background: editVal.trim() ? "linear-gradient(135deg,#f87171,#fb923c)" : "rgba(255,255,255,0.05)",
                                border:"none", color: editVal.trim() ? "#fff" : "rgba(255,255,255,0.2)",
                                fontSize:11, fontWeight:700,
                                cursor: editVal.trim() ? "pointer" : "default",
                                fontFamily:"inherit" }}>{saving ? "Saving…" : "Save"}</button>
                          </div>
                        </div>
                      ) : answered ? (
                        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                          <div style={{ fontSize:13, color:"#fff", lineHeight:1.5, flex:1 }}>{answered}</div>
                          {isOwner && (
                            <button onClick={() => { setEditKey(sq.key); setEditVal(answered); }}
                              style={{ flexShrink:0, fontSize:10, color:"rgba(255,255,255,0.2)",
                                background:"none", border:"none", cursor:"pointer",
                                padding:"2px 6px", fontFamily:"inherit" }}>edit</button>
                          )}
                        </div>
                      ) : isOwner ? (
                        <button onClick={() => { setEditKey(sq.key); setEditVal(""); }}
                          style={{ fontSize:12, color:"rgba(248,113,113,0.5)", background:"none",
                            border:"none", cursor:"pointer", fontFamily:"inherit",
                            padding:0, fontWeight:600 }}>
                          + Answer this
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {isOwner && (
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.15)", textAlign:"center", marginTop:8, lineHeight:1.6 }}>
                  Your answers are public — anyone can see them when they tap your card.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Close */}
      <div style={{ padding:"0 20px 16px", borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:14 }}>
        <button onClick={onClose}
          style={{ width:"100%", padding:"12px", borderRadius:14,
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
            color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:600,
            cursor:"pointer", fontFamily:"inherit" }}>
          Close
        </button>
      </div>

    </div>
  </div>
);
}


function StatusRingAvatar({ couple, size = 44, rcBorder, hasStatus = false }) {
const [showStatus, setShowStatus] = React.useState(false);

return (
<>
<div
  onClick={hasStatus ? (e) => { e.stopPropagation(); setShowStatus(true); } : undefined}
  style={{
    width:size, height:size, borderRadius:12, overflow:"hidden", flexShrink:0,
    background:"rgba(255,255,255,0.06)",
    border: hasStatus ? "2px solid rgba(248,113,113,0.7)" : `1px solid ${rcBorder}`,
    display:"flex", alignItems:"center", justifyContent:"center", fontSize:16,
    cursor: hasStatus ? "pointer" : "default",
    boxShadow: hasStatus ? "0 0 10px rgba(248,113,113,0.4)" : "none",
    transition:"all 0.2s"
  }}>
  {couple.avatar_url
    ? <img src={couple.avatar_url} style={{ width:"100%", height:"100%", objectFit:"cover" }} loading="lazy" />
    : <span style={{ fontWeight:300, color:"rgba(255,255,255,0.4)", fontSize:18 }}>◇</span>}
</div>
{showStatus && (
  <div onClick={() => setShowStatus(false)}
    style={{ position:"fixed", inset:0, zIndex:2000,
      background:"rgba(0,0,0,0.92)", backdropFilter:"blur(12px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
    <div onClick={e => e.stopPropagation()} style={{ width:"100%", maxWidth:420 }}>
      <CoupleStatus coupleId={couple.id} isOwner={false} />
      <button onClick={() => setShowStatus(false)}
        style={{ width:"100%", marginTop:10, padding:"12px", borderRadius:14,
          background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.09)",
          color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:600,
          cursor:"pointer", fontFamily:"inherit" }}>
        Close
      </button>
    </div>
  </div>
)}
</>
);
}
function SkeletonCard() {
return (
<div style={{
borderRadius:18, marginBottom:10, overflow:"hidden",
background:"rgba(255,255,255,0.04)",
border:"1px solid rgba(255,255,255,0.07)"
}}>
<div style={{ padding:"16px 16px 14px" }}>
  {/* Avatar + name row */}
  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
    <div style={{
      width:44, height:44, borderRadius:12, flexShrink:0,
      background:"rgba(255,255,255,0.08)",
      animation:"bond-skeleton-pulse 1.4s ease-in-out infinite"
    }} />
    <div style={{ flex:1 }}>
      <div style={{
        height:14, borderRadius:7, width:"55%", marginBottom:8,
        background:"rgba(255,255,255,0.08)",
        animation:"bond-skeleton-pulse 1.4s ease-in-out infinite"
      }} />
      <div style={{
        height:10, borderRadius:5, width:"35%",
        background:"rgba(255,255,255,0.05)",
        animation:"bond-skeleton-pulse 1.4s ease-in-out infinite 0.2s"
      }} />
    </div>
    <div style={{
      width:32, height:32, borderRadius:8,
      background:"rgba(255,255,255,0.06)",
      animation:"bond-skeleton-pulse 1.4s ease-in-out infinite 0.1s"
    }} />
  </div>
  {/* Progress bar */}
  <div style={{
    height:6, borderRadius:999, width:"100%", marginBottom:14,
    background:"rgba(255,255,255,0.06)",
    animation:"bond-skeleton-pulse 1.4s ease-in-out infinite"
  }} />
  {/* Score tiles */}
  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:14 }}>
    {[0,1,2].map(i => (
      <div key={i} style={{
        borderRadius:10, height:52,
        background:"rgba(255,255,255,0.05)",
        animation:`bond-skeleton-pulse 1.4s ease-in-out infinite ${i*0.15}s`
      }} />
    ))}
  </div>
  {/* Emoji row */}
  <div style={{ display:"flex", gap:6 }}>
    {[0,1,2,3,4].map(i => (
      <div key={i} style={{
        flex:1, height:40, borderRadius:12,
        background:"rgba(255,255,255,0.04)",
        animation:`bond-skeleton-pulse 1.4s ease-in-out infinite ${i*0.1}s`
      }} />
    ))}
  </div>
</div>
</div>
);
}

// ============================================================
// 3. CoupleCard — FULL CORRECTED VERSION
// ============================================================

function CoupleCard({ couple, rank, total, reactions, myReaction,
  commentCount, hasStatus, onReact, onSelect, communityPhotoCount = 0 }) {

const EMOJIS = ["\u2764\uFE0F","\uD83D\uDE0D","\uD83D\uDD25","\uD83D\uDCAF","\uD83E\uDD79"];
const bond = Math.round(couple.bond_score || 0);
const percentile = total > 1 ? Math.round(((total - rank + 1) / total) * 100) : 100;
const isTop3 = rank <= 3;
const displayName = couple.couple_name || couple.partner_username || "Anonymous";
const [showComments, setShowComments] = React.useState(false);
// ✅ ADD THIS
const isPlaceholder = couple._isPlaceholder;

// Deterministic seed for any card (real or placeholder) with 0 interactions
const _getSeed = React.useMemo(() => {
  let h = 0;
  const str = String(couple.id);
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  const rng = () => {
    h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
    h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
  };
  const virality = rng();
  let total;
  if      (virality > 0.92) total = Math.floor(rng() * 3000) + 800;
  else if (virality > 0.78) total = Math.floor(rng() * 400)  + 80;
  else if (virality > 0.50) total = Math.floor(rng() * 80)   + 18;
  else                      total = Math.floor(rng() * 20)   + 4;

  const _emojis = ["❤️","😍","🔥","💯","🥹"];
  const rxns = {};
  let rem = total;
  const shares = _emojis.map(() => rng());
  const tot = shares.reduce((a, b) => a + b, 0);
  _emojis.forEach((e, i) => {
    const alloc = i < _emojis.length - 1
      ? Math.floor((shares[i] / tot) * total)
      : rem;
    rxns[e] = Math.max(0, alloc);
    rem -= rxns[e];
  });
  const commentCount = Math.max(1, Math.floor(total * (0.05 + rng() * 0.10) + rng() * 6));
  return { rxns, commentCount };
}, [couple.id]);

const rawReactions = isPlaceholder ? (couple._seed_reactions || {}) : reactions;
const rawCommentCount = isPlaceholder ? (couple._seed_comment_count || 0) : commentCount;

const hasRealData = EMOJIS.reduce((s, e) => s + (rawReactions[e] || 0), 0) > 0;

const finalReactions    = hasRealData ? rawReactions    : _getSeed.rxns;
const finalCommentCount = (rawCommentCount > 0) ? rawCommentCount : _getSeed.commentCount;

const RANK_COLORS = {
  1: { border:"rgba(251,191,36,0.35)",  accent:"#fbbf24", crown:"\uD83D\uDC51" },
  2: { border:"rgba(192,192,192,0.25)", accent:"#9ca3af", crown:"\uD83E\uDD48" },
  3: { border:"rgba(251,146,60,0.3)",   accent:"#fb923c", crown:"\uD83E\uDD49" },
};
const rc = RANK_COLORS[rank] || { border:"rgba(255,255,255,0.07)", accent:"rgba(255,255,255,0.25)", crown:null };

const TYPE_COLORS = {
  "Romantic":       { bg:"rgba(244,114,182,0.1)", color:"#f9a8d4" },
  "Engaged":        { bg:"rgba(167,139,250,0.1)", color:"#c4b5fd" },
  "Married":        { bg:"rgba(251,191,36,0.1)",  color:"#fde68a" },
  "Long Distance":  { bg:"rgba(96,165,250,0.1)",  color:"#93c5fd" },
  "Situationship":  { bg:"rgba(251,146,60,0.1)",  color:"#fdba74" },
  "Friends to Lovers":{ bg:"rgba(52,211,153,0.1)", color:"#6ee7b7" },
};
const tc = TYPE_COLORS[couple.couple_type] || { bg:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.4)" };
const bondColor = bond >= 80 ? "#34d399" : bond >= 55 ? "#f87171" : "#6b7280";
const locationLabel = [couple.institution, couple.locality].filter(Boolean).join(" · ");
const totalRxns = EMOJIS.reduce((s, e) => s + (finalReactions[e] || 0), 0);

return (
  <div style={{ borderRadius:18, marginBottom:10, overflow:"hidden",
    background:"rgba(255,255,255,0.04)", border:`1px solid ${rc.border}`,
    backdropFilter:"blur(12px)" }}>
    {isTop3 && <div style={{ height:2, background:"linear-gradient(90deg,#f87171,#fb923c,#fbbf24)" }} />}
    <div style={{ padding:"16px 16px 14px" }}>

      {/* Name + avatar row */}
      <div onClick={() => onSelect && onSelect(couple)}
        style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, cursor:"pointer" }}>
        <StatusRingAvatar couple={couple} size={44} rcBorder={rc.border} hasStatus={hasStatus} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
            {rc.crown && <span style={{ fontSize:14 }}>{rc.crown}</span>}
            <div style={{ fontWeight:700, fontSize:15, color:"#fff", letterSpacing:"-0.02em",
              whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{displayName}</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, padding:"2px 9px", borderRadius:999,
              background:tc.bg, color:tc.color, fontWeight:600 }}>{couple.couple_type||"Unknown"}</span>
            {locationLabel && <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{locationLabel}</span>}
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:24, fontWeight:800, letterSpacing:"-0.03em", color:bondColor }}>{bond}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", fontWeight:500, marginTop:1 }}>bond</div>
        </div>
      </div>

      {/* ── NEW: Backstory teaser ── */}
      {couple.backstory && (
        <div onClick={() => onSelect && onSelect(couple)}
          style={{ fontSize:12, color:"rgba(255,255,255,0.45)", fontStyle:"italic",
            lineHeight:1.6, marginBottom:12, cursor:"pointer",
            borderLeft:"2px solid rgba(248,113,113,0.3)", paddingLeft:10 }}>
          "{couple.backstory.length > 80 ? couple.backstory.slice(0, 80) + "…" : couple.backstory}"
        </div>
      )}

      {/* Rank bar */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:rc.accent, padding:"2px 9px",
          borderRadius:999, background:"rgba(255,255,255,0.04)", border:`1px solid ${rc.border}`,
          flexShrink:0 }}>#{rank}</div>
        <div style={{ flex:1, height:2.5, borderRadius:999, background:"rgba(255,255,255,0.07)" }}>
          <div style={{ height:"100%", borderRadius:999, width:`${percentile}%`,
            background:"linear-gradient(90deg,#f87171,#fb923c)", transition:"width 0.6s ease" }} />
        </div>
        <div style={{ fontSize:10, color:"rgba(255,255,255,0.2)", fontWeight:500, flexShrink:0 }}>
          top {percentile}%
        </div>
      </div>

      {/* Score grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:14 }}>
        {[{ label:"Sync",   val:couple.emotional_sync_score },
          { label:"Stable", val:couple.stability_score },
          { label:"Growth", val:couple.growth_index }].map(s => (
          <div key={s.label} style={{ borderRadius:10, padding:"9px 6px", textAlign:"center",
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#fff" }}>{Math.round(s.val||0)}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Social links */}
      {couple.social_links && Object.keys(couple.social_links).some(k => couple.social_links[k]) && (
        <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
          {[
            { key:"instagram", label:"Instagram", icon:"📸", color:"rgba(244,114,182,0.8)" },
            { key:"linkedin",  label:"LinkedIn",  icon:"💼", color:"rgba(96,165,250,0.8)" },
            { key:"twitter",   label:"Twitter",   icon:"🐦", color:"rgba(96,165,250,0.7)" },
            { key:"other",     label:"Link",      icon:"🔗", color:"rgba(255,255,255,0.5)" },
          ].filter(s => couple.social_links[s.key]).map(s => (
            <a key={s.key}
              href={couple.social_links[s.key].startsWith("http")
                ? couple.social_links[s.key]
                : "https://" + couple.social_links[s.key]}
              target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px",
                borderRadius:999, background:"rgba(255,255,255,0.05)",
                border:"1px solid rgba(255,255,255,0.09)",
                textDecoration:"none", fontSize:11, fontWeight:600,
                color:s.color, cursor:"pointer" }}>
              <span>{s.icon}</span><span>{s.label}</span>
            </a>
          ))}
        </div>
      )}

      {/* Emoji reactions */}
      <div style={{ display:"flex", gap:6, marginBottom:12, justifyContent:"space-between" }}>
        {EMOJIS.map(emoji => {
          const count = finalReactions[emoji] || 0;
          const active = myReaction === emoji;
          return (
            <button key={emoji} onClick={() => onReact(emoji)}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                gap:3, padding:"7px 4px", borderRadius:12,
                background: active ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.04)",
                border: active ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(255,255,255,0.07)",
                cursor:"pointer", transition:"all 0.15s",
                transform: active ? "scale(1.08)" : "scale(1)" }}>
              <span style={{ fontSize:18, lineHeight:1 }}>{emoji}</span>
          <span style={{ fontSize:10, fontWeight:700,
color: active ? "#fca5a5" : "rgba(255,255,255,0.3)" }}>
{count >= 1000 ? (count/1000).toFixed(1)+"k" : count}
</span>
            </button>
          );
        })}
      </div>

      {/* Bottom row: reactions count + spotted badge + comment btn */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flex:1 }}>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", minWidth:60 }}>
  {totalRxns > 0
    ? `${totalRxns >= 1000 ? (totalRxns/1000).toFixed(1)+"k" : totalRxns} reaction${totalRxns !== 1 ? "s" : ""}`
    : "0 reactions"
  }
</div>
          {/* ── NEW: Community spotted badge ── */}
          {communityPhotoCount > 0 && (
            <span style={{ fontSize:11, padding:"3px 9px", borderRadius:999,
              background:"rgba(248,113,113,0.08)", color:"rgba(248,113,113,0.6)",
              border:"1px solid rgba(248,113,113,0.15)" }}>
              👀 {communityPhotoCount} spotted
            </span>
          )}
        </div>
        <button onClick={() => setShowComments(v => !v)}
          style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px",
            borderRadius:10,
            background: showComments ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.04)",
            border: showComments ? "1px solid rgba(248,113,113,0.25)" : "1px solid rgba(255,255,255,0.08)",
            cursor:"pointer", transition:"all 0.15s", fontFamily:"inherit" }}>
          <span style={{ fontSize:13 }}>💬</span>
          <span style={{ fontSize:12, fontWeight:600,
            color: showComments ? "#fca5a5" : "rgba(255,255,255,0.4)" }}>
          {finalCommentCount > 0 ? finalCommentCount : "Comment"}
          </span>
        </button>
      </div>

      {/* ── NEW: Tap to explore hint ── */}
      <div onClick={() => onSelect && onSelect(couple)}
        style={{ textAlign:"center", padding:"8px 0 2px",
          fontSize:10, color:"rgba(255,255,255,0.12)",
          letterSpacing:"0.06em", cursor:"pointer",
          borderTop:"1px solid rgba(255,255,255,0.04)", marginTop:8 }}>
        TAP TO EXPLORE →
      </div>

    </div>
    {showComments && <CommentDrawer targetId={couple.id} targetType="couple" />}
  </div>
);
}

/* ============================================================
4. PASTE after CoupleCard → function CreateCoupleProfile()
============================================================ */

/* ============================================================
BLOCK F — REPLACE → function CreateCoupleProfile()

FIX: Username fetched from profiles.username (not email).
Safe insert/update — no upsert constraint dependency.
============================================================ */

/* ============================================================
BLOCK 1 — REPLACE → function CreateCoupleProfile()
============================================================ */

/* ============================================================
E — REPLACE → function CreateCoupleProfile()
Alive creation flow with photo upload + engaging copy
============================================================ */

/* ============================================================
E — REPLACE → function CreateCoupleProfile()
============================================================ */
function CreateCoupleProfile({ onCreated }) {
const TYPES = [
{ id:"Romantic",           sym:"♡",  label:"Romantic",            sub:"Classic love story"          },
{ id:"Engaged",            sym:"◇",  label:"Engaged",             sub:"Ring on it"                  },
{ id:"Married",            sym:"○",  label:"Married",             sub:"For life"                    },
{ id:"Long Distance",      sym:"↗",  label:"Long Distance",       sub:"Miles apart, hearts close"   },
{ id:"Situationship",      sym:"∿",  label:"Situationship",       sub:"It's complicated"            },
{ id:"Friends to Lovers",  sym:"↝",  label:"Friends to Lovers",   sub:"Best kind of plot twist"     },
];
const DURATIONS = [
{ id:"< 1 month",   label:"< 1 mo",  bonus:0  },
{ id:"1-6 months",  label:"1–6 mo",  bonus:2  },
{ id:"6-12 months", label:"6–12 mo", bonus:4  },
{ id:"1-2 years",   label:"1–2 yr",  bonus:6  },
{ id:"2-5 years",   label:"2–5 yr",  bonus:8  },
{ id:"5+ years",    label:"5+ yr",   bonus:10 },
];
const QUESTIONS = [
{ key:"comm",      sym:"⌁", label:"Communication",  sub:"Do you actually talk, or just text?",   lo:"We should talk more",              hi:"We finish each other's sentences"    },
{ key:"emotional", sym:"♡", label:"Emotional Bond",  sub:"How deep does it go?",                 lo:"Still building that trust",        hi:"Completely vulnerable with each other"},
{ key:"stability", sym:"◈", label:"Stability",       sub:"Is your foundation solid?",            lo:"Still finding our footing",        hi:"Unshakeable, no matter what"          },
{ key:"growth",    sym:"△", label:"Growth",          sub:"Are you evolving together?",           lo:"Learning to grow together",        hi:"We bring out the best in each other"  },
];

const [step,       setStep]       = React.useState(0);
const [name1,      setName1]      = React.useState("");
const [name2,      setName2]      = React.useState("");
const [avatar,     setAvatar]     = React.useState(null);
const [declaredBy, setDeclaredBy] = React.useState("");
const [coupleType, setCoupleType] = React.useState("");
const [answers,    setAnswers]    = React.useState({ duration:"", comm:5, emotional:5, stability:5, growth:5 });
const [institution, setInstitution] = React.useState("");
const [locality, setLocality] = React.useState("");
const [socialLinks, setSocialLinks] = React.useState({});
const [backstory, setBackstory] = React.useState("");
const [saving, setSaving] = React.useState(false);
const [error,      setError]      = React.useState("");
const [avatarUploading, setAvatarUploading] = React.useState(false);
const [avatarFile, setAvatarFile] = React.useState(null); // ← ADD
const avatarUploadedUrl = React.useRef(null); // ADD THIS

const coupleName = name1.trim() && name2.trim()
? `${name1.trim()} & ${name2.trim()}`
: name1.trim() || "Your Couple";

function computeScores() {
const { comm, emotional, stability, growth, duration } = answers;
const dur  = DURATIONS.find(d => d.id === duration);
const base = ((+comm + +emotional + +stability + +growth) / 40) * 90;


return {
bond_score:           Math.min(Math.round(base + (dur?.bonus||0)), 100),
emotional_sync_score: Math.round(+emotional * 10),
stability_score:      Math.round(+stability * 10),
growth_index:         Math.round(+growth * 10),
};
}


function handlePhoto(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert("Photo must be under 5MB"); return; }
  setAvatarFile(file);
  const reader = new FileReader();
  reader.onload = () => setAvatar(reader.result); // preview only
  reader.readAsDataURL(file);
  setAvatarUploading(true);
  compressImage(file).then(compressed =>
    uploadToStorage("avatars", compressed, "couples/")
  ).then(url => {
    if (url) {
      setAvatar(url);
      avatarUploadedUrl.current = url; // store final URL in ref
    }
    setAvatarUploading(false);
  });
}
async function save() {
if (!answers.duration) { setError("Pick how long you've been together."); return; }
setSaving(true); setError("");

// Wait for avatar upload if still in progress
// Wait for background upload to finish if still running
// Wait for avatar upload using ref instead of stale state
if (!avatarUploadedUrl.current && avatarFile) {
  await new Promise(resolve => {
    const check = setInterval(() => {
      if (avatarUploadedUrl.current) { clearInterval(check); resolve(); }
    }, 200);
    setTimeout(() => { clearInterval(check); resolve(); }, 8000);
  });
}
// Use the URL that handlePhoto already uploaded
const finalAvatarUrl = avatarUploadedUrl.current || avatar;
const session = await window.supabaseClient.auth.getSession();
const token = session?.data?.session?.access_token ?? window.SUPABASE_ANON_KEY;

let guestId = localStorage.getItem("bond_guest_uuid");
if (!guestId && !session?.data?.session?.user) {
guestId = crypto.randomUUID();
localStorage.setItem("bond_guest_uuid", guestId);
}

const res = await fetch(`${window.SUPABASE_URL}/functions/v1/api-couples`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  },
  body: JSON.stringify({
    name1, name2, finalAvatarUrl, declaredBy, coupleType,
    answers, institution, locality, socialLinks, backstory,
    scores: computeScores(),
    guestId,
  }),
});

const data = await res.json();
if (!res.ok) {
setError(data.error || "Could not save. Try again.");
setSaving(false);
return;
}

onCreated({
...data,
couple_name: coupleName,
partner1_name: name1.trim(),
partner2_name: name2.trim(),
declared_by: declaredBy,
couple_type: coupleType,
social_links: socialLinks,
});
setSaving(false);

}

/* ── Step 0: Names + photo + declared-by ── */
if (step === 0) {
const canProceed = name1.trim() && declaredBy;
return (
<div className="bond-fade-up" style={{ paddingBottom:32 }}>
  <div style={{ textAlign:"center", marginBottom:24 }}>
    <div style={{ fontSize:22, color:"rgba(248,113,113,0.6)",
      marginBottom:8, fontWeight:300 }}>◇</div>
    <div style={{ fontSize:18, fontWeight:700, color:"#fff",
      letterSpacing:"-0.02em" }}>Who's this couple?</div>
    <div style={{ fontSize:13, color:"rgba(255,255,255,0.3)", marginTop:4 }}>
      This shows on the leaderboard
    </div>
  </div>

  {/* Photo upload */}
  <div style={{ display:"flex", justifyContent:"center", marginBottom:24 }}>
    <label style={{ cursor:"pointer" }}>
      <div className={avatar ? "" : "bond-avatar-ring"} style={{
        width:80, height:80, borderRadius:22, overflow:"hidden",
        background:"rgba(255,255,255,0.05)",
        border:`1px dashed ${avatar ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.15)"}`,
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", transition:"all 0.2s",
      }}>
        {avatar
          ? <img src={avatar} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          : <>
              <span style={{ fontSize:18, color:"rgba(255,255,255,0.25)",
                fontWeight:300 }}>○</span>
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)",
                marginTop:5, fontWeight:500 }}>add photo</span>
            </>
        }
      </div>
      <input type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhoto} />
      {avatarUploading && (
<div style={{ fontSize:9, color:"rgba(248,113,113,0.7)", marginTop:3 }}>
uploading…
</div>
)}
    </label>
  </div>

  {/* Name inputs */}
  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
    {[
      { val:name1, set:setName1, ph:"Partner 1" },
      { val:name2, set:setName2, ph:"Partner 2" },
    ].map((f,i) => (
      <input key={i} value={f.val} maxLength={25}
        onChange={e => f.set(e.target.value)}
        placeholder={f.ph}
        style={{
          width:"100%", boxSizing:"border-box",
          background:"rgba(255,255,255,0.07)",
          border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:14, padding:"12px 14px",
          fontSize:14, color:"#fff", outline:"none",
        }}
        onFocus={e => e.target.style.borderColor = "rgba(248,113,113,0.4)"}
        onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
      />
    ))}
  </div>

  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
<input value={institution} maxLength={60}
onChange={e => setInstitution(e.target.value)}
placeholder="College / Institution"
style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:14, padding:"12px 14px", fontSize:14, color:"#fff", outline:"none" }}
/>
<input value={locality} maxLength={60}
onChange={e => setLocality(e.target.value)}
placeholder="Area / Locality"
style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:14, padding:"12px 14px", fontSize:14, color:"#fff", outline:"none" }}
/>
</div>
{/* Social Links */}
<div style={{ marginBottom:14 }}>
<div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginBottom:8,
fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>
Social Links (optional)
</div>
<div style={{ display:"flex", flexDirection:"column", gap:8 }}>
{[
{ key:"instagram", placeholder:"Instagram URL", icon:"📸" },
{ key:"linkedin",  placeholder:"LinkedIn URL",  icon:"💼" },
{ key:"twitter",   placeholder:"Twitter / X URL", icon:"🐦" },
{ key:"other",     placeholder:"Any other link", icon:"🔗" },
].map(s => (
<div key={s.key} style={{ display:"flex", alignItems:"center", gap:8 }}>
  <span style={{ fontSize:16, flexShrink:0 }}>{s.icon}</span>
  <input
    value={socialLinks[s.key] || ""}
    maxLength={200}
    onChange={e => setSocialLinks(prev => ({ ...prev, [s.key]: e.target.value }))}
    placeholder={s.placeholder}
    style={{ flex:1, background:"rgba(255,255,255,0.07)",
      border:"1px solid rgba(255,255,255,0.1)", borderRadius:12,
      padding:"10px 12px", fontSize:13, color:"#fff", outline:"none" }}
  />
</div>
))}
</div>
</div>
{/* Backstory */}
<div style={{ marginBottom:14 }}>
<div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginBottom:8,
fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>
Your story (optional)
</div>
<textarea
value={backstory}
onChange={e => setBackstory(e.target.value)}
maxLength={500}
placeholder="How did you meet? What makes your bond special? Share your backstory…"
style={{
width:"100%", boxSizing:"border-box",
background:"rgba(255,255,255,0.07)",
border:"1px solid rgba(255,255,255,0.1)",
borderRadius:14, padding:"12px 14px",
fontSize:13, color:"#fff", outline:"none",
resize:"none", minHeight:80, lineHeight:1.6,
fontFamily:"inherit"
}}
/>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.2)", marginTop:4, textAlign:"right" }}>
{backstory.length}/500 · Shown when someone taps your card
</div>
</div>
  {name1.trim() && (
    <div style={{ textAlign:"center", marginBottom:14,
      fontSize:12, color:"rgba(255,255,255,0.3)" }}>
      Will appear as <span style={{ color:"#f87171", fontWeight:600 }}>{coupleName}</span>
    </div>
  )}

  {/* Declared by */}
  <div style={{ marginBottom:20 }}>
    <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginBottom:10,
      fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>
      Who's filling this in?
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
      {[
        { id:"partner",  sym:"○", label:"One of us",    sub:"I'm in this couple" },
        { id:"outsider", sym:"◇", label:"Someone else", sub:"Nominating them"    },
      ].map(d => (
        <button key={d.id} className="bond-type-card"
          onClick={() => setDeclaredBy(d.id)}
          style={{
            border:`1px solid ${declaredBy===d.id ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.09)"}`,
            borderRadius:16, padding:"14px 12px",
            textAlign:"left", cursor:"pointer",
            background: declaredBy===d.id ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ fontSize:18, color:"rgba(255,255,255,0.4)",
            marginBottom:6, fontWeight:300 }}>{d.sym}</div>
          <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>{d.label}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{d.sub}</div>
        </button>
      ))}
    </div>
  </div>

  {error && (
    <div style={{ color:"#f87171", fontSize:12, marginBottom:12, textAlign:"center" }}>
      {error}
    </div>
  )}

  <button className="bond-cta"
    disabled={!canProceed}
    onClick={() => {
      if (!name1.trim()) { setError("Enter at least one name"); return; }
      setError(""); setStep(1);
    }}
    style={{
      width:"100%", padding:"15px", borderRadius:16, border:"none",
      cursor: canProceed ? "pointer" : "not-allowed",
      background: canProceed
        ? "linear-gradient(135deg,#f87171,#fb923c)"
        : "rgba(255,255,255,0.07)",
      color: canProceed ? "#fff" : "rgba(255,255,255,0.25)",
      fontSize:15, fontWeight:700, letterSpacing:"-0.01em",
      boxShadow: canProceed ? "0 8px 24px rgba(248,113,113,0.3)" : "none",
    }}
  >
    Continue →
  </button>
</div>
);
}

/* ── Step 1: Relationship type ── */
if (step === 1) return (
<div className="bond-fade-up" style={{ paddingBottom:32 }}>
<button onClick={() => setStep(0)}
  style={{ background:"none", border:"none", color:"rgba(255,255,255,0.3)",
    cursor:"pointer", fontSize:13, marginBottom:16, padding:0 }}>
  ← Back
</button>
<div style={{ textAlign:"center", marginBottom:20 }}>
  <div style={{ fontSize:18, fontWeight:700, color:"#fff",
    letterSpacing:"-0.02em" }}>{coupleName}</div>
  <div style={{ fontSize:13, color:"rgba(255,255,255,0.3)", marginTop:4 }}>
    What kind of love is this?
  </div>
</div>
<div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
  {TYPES.map(t => (
    <button key={t.id} className="bond-type-card"
      onClick={() => { setCoupleType(t.id); setStep(2); }}
      style={{
        border:`1px solid ${coupleType===t.id ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.09)"}`,
        borderRadius:18, padding:"16px 14px",
        textAlign:"left", cursor:"pointer",
        background: coupleType===t.id ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ fontSize:20, color:"rgba(255,255,255,0.35)",
        marginBottom:8, fontWeight:300 }}>{t.sym}</div>
      <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>{t.label}</div>
      <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:3 }}>{t.sub}</div>
    </button>
  ))}
</div>
</div>
);

/* ── Step 2: Sliders ── */
const scores   = computeScores();
const bondGrad = scores.bond_score >= 80
? "linear-gradient(135deg,#34d399,#10b981)"
: scores.bond_score >= 55
? "linear-gradient(135deg,#f87171,#fb923c)"
: "linear-gradient(135deg,#6b7280,#9ca3af)";
const selType  = TYPES.find(t => t.id === coupleType);

return (
<div className="bond-fade-up" style={{ paddingBottom:32 }}>
<button onClick={() => setStep(1)}
  style={{ background:"none", border:"none", color:"rgba(255,255,255,0.3)",
    cursor:"pointer", fontSize:13, marginBottom:16, padding:0 }}>
  ← Back
</button>
<div style={{ textAlign:"center", marginBottom:20 }}>
  <div style={{ fontSize:22, color:"rgba(255,255,255,0.3)",
    marginBottom:4, fontWeight:300 }}>{selType?.sym}</div>
  <div style={{ fontSize:17, fontWeight:700, color:"#fff" }}>{coupleName}</div>
  <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{coupleType}</div>
</div>

{/* Duration */}
<div style={{ marginBottom:14, background:"rgba(255,255,255,0.04)",
  borderRadius:18, padding:16, border:"1px solid rgba(255,255,255,0.08)" }}>
  <div style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.5)",
    marginBottom:10, letterSpacing:"0.02em" }}>
    How long together?
  </div>
  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:7 }}>
    {DURATIONS.map(d => (
      <button key={d.id} className="bond-dur-chip"
        onClick={() => setAnswers(a => ({ ...a, duration:d.id }))}
        style={{
          padding:"9px 4px", borderRadius:12, border:"none",
          cursor:"pointer", fontSize:12, fontWeight:600,
          background: answers.duration===d.id
            ? "linear-gradient(135deg,#f87171,#fb923c)"
            : "rgba(255,255,255,0.07)",
          color: answers.duration===d.id ? "#fff" : "rgba(255,255,255,0.4)",
          boxShadow: answers.duration===d.id ? "0 4px 14px rgba(248,113,113,0.25)" : "none",
        }}
      >{d.label}</button>
    ))}
  </div>
</div>

{/* Questions */}
{QUESTIONS.map((q, qi) => {
  const pct = ((answers[q.key] - 1) / 9) * 100;
  const sliderBg = `linear-gradient(90deg, rgba(248,113,113,0.8) ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
  return (
    <div key={q.key} className="bond-fade-up"
      style={{ marginBottom:10, background:"rgba(255,255,255,0.04)",
        borderRadius:18, padding:16, border:"1px solid rgba(255,255,255,0.07)",
        animationDelay:`${qi*60}ms` }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", marginBottom:10 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <span style={{ fontSize:14, color:"rgba(255,255,255,0.3)",
              fontWeight:300 }}>{q.sym}</span>
            <span style={{ fontSize:14, fontWeight:700, color:"#fff" }}>{q.label}</span>
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:3 }}>{q.sub}</div>
        </div>
        <div style={{
          width:34, height:34, borderRadius:10,
          display:"flex", alignItems:"center", justifyContent:"center",
          background:"rgba(248,113,113,0.1)",
          border:"1px solid rgba(248,113,113,0.2)",
          fontSize:15, fontWeight:800, color:"#f87171",
        }}>
          {answers[q.key]}
        </div>
      </div>
      <input type="range" min="1" max="10"
        value={answers[q.key]}
        onChange={e => setAnswers(a => ({ ...a, [q.key]:parseInt(e.target.value) }))}
        className="bond-slider"
        style={{ width:"100%", background:sliderBg }}
      />
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)" }}>{q.lo}</span>
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)" }}>{q.hi}</span>
      </div>
    </div>
  );
})}

{/* Score preview */}
<div style={{ borderRadius:18, padding:16, marginBottom:16,
  background:"rgba(248,113,113,0.06)", border:"1px solid rgba(248,113,113,0.12)" }}>
  <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", textAlign:"center",
    marginBottom:12, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600 }}>
    Live Score Preview
  </div>
  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", textAlign:"center" }}>
    {[
      { label:"Bond",   val:scores.bond_score,           grad:true },
      { label:"Sync",   val:scores.emotional_sync_score, grad:false },
      { label:"Stable", val:scores.stability_score,      grad:false },
      { label:"Growth", val:scores.growth_index,         grad:false },
    ].map(s => (
      <div key={s.label}>
        <div style={{
          fontSize:22, fontWeight:800,
          ...(s.grad
            ? { color: scores.bond_score >= 80 ? "#34d399" : scores.bond_score >= 55 ? "#f87171" : "#6b7280" }
            : { color:"rgba(255,255,255,0.75)" })
        }}>{s.val}</div>
        <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginTop:2 }}>{s.label}</div>
      </div>
    ))}
  </div>
</div>

{error && (
  <div style={{ color:"#f87171", fontSize:12, marginBottom:12, textAlign:"center" }}>
    {error}
  </div>
)}

<button className="bond-cta" onClick={save}
  disabled={saving || !answers.duration}
  style={{
    width:"100%", padding:"16px", borderRadius:16, border:"none",
    cursor: saving||!answers.duration ? "not-allowed" : "pointer",
    background: !saving && answers.duration
      ? "linear-gradient(135deg,#f87171,#fb923c)"
      : "rgba(255,255,255,0.07)",
    color: !saving && answers.duration ? "#fff" : "rgba(255,255,255,0.25)",
    fontSize:15, fontWeight:700, letterSpacing:"-0.01em",
    boxShadow: !saving&&answers.duration ? "0 8px 28px rgba(248,113,113,0.35)" : "none",
  }}
>
  {saving ? "Saving…" : "◇ Create Bond Profile"}
</button>
</div>
);
}


/* ============================================================
5. PASTE after CreateCoupleProfile → function MyCoupleProfile()
============================================================ */

/* ============================================================
BLOCK G — REPLACE → function MyCoupleProfile()
============================================================ */

/* ============================================================
BLOCK G — REPLACE → function MyCoupleProfile()
============================================================ */

/* ============================================================
F — REPLACE → function MyCoupleProfile()
Rich profile display card
============================================================ */

/* ============================================================
F — REPLACE → function MyCoupleProfile()
============================================================ */
const COUPLE_CHALLENGES = [

/* ── UNIVERSAL (all types) ── */
{ key:"daily_checkin",      cadence:"daily",   label:"Check in",              desc:"One message that says you're thinking of them. That's it.",                         xp:2,  icon:"\uD83D\uDCAC", types:null,                    difficulty:"easy",     hint:"No paragraph needed. Even 'hey thinking of u' counts." },
{ key:"daily_compliment",   cadence:"daily",   label:"Say something real",    desc:"A specific compliment — not 'you look nice'. Something you actually noticed.",      xp:2,  icon:"\uD83C\uDF39", types:null,                    difficulty:"easy",     hint:"Specific > generic. 'The way you handled that' > 'you're great'" },
{ key:"daily_meme",         cadence:"daily",   label:"Send a meme",           desc:"The love language of 2025. Something that made you think of them.",                 xp:1,  icon:"\uD83D\uDCF2", types:null,                    difficulty:"easy",     hint:"Bonus points if it's embarrassingly accurate about your dynamic." },
{ key:"weekly_deeptalk",    cadence:"weekly",  label:"No-phone deep talk",    desc:"One real conversation this week. No distractions. Actually listen.",                xp:5,  icon:"\uD83E\uDDE0", types:null,                    difficulty:"medium",   hint:"Put the phone face-down. Seriously. Both of you." },
{ key:"weekly_new",         cadence:"weekly",  label:"Try something new",     desc:"Anything neither of you has done before — doesn't have to be big.",                 xp:4,  icon:"\u26A1",       types:null,                    difficulty:"medium",   hint:"Even a new food spot counts. The novelty is the point." },
{ key:"monthly_reflection", cadence:"monthly", label:"Monthly check-in",      desc:"10 mins. What's been good? What's felt off? No blame, just honesty.",              xp:6,  icon:"\uD83D\uDDD3\uFE0F", types:null,              difficulty:"medium",   hint:"Set a reminder. Relationships need maintenance, not just vibes." },
{ key:"once_note",          cadence:"once",    label:"Write them a note",     desc:"Written. Physical or digital — but written. Not a voice note.",                     xp:3,  icon:"\u270D\uFE0F", types:null,                    difficulty:"easy",     hint:"Cringe is fine. Earnest always lands harder than cool." },
{ key:"once_goal",          cadence:"once",    label:"Set a shared goal",     desc:"One thing you're both building toward. Name it out loud.",                          xp:4,  icon:"\uD83C\uDFAF", types:null,                    difficulty:"medium",   hint:"Doesn't have to be life-changing. Even 'finish this show together' works." },
{ key:"once_photo",         cadence:"once",    label:"The photo",             desc:"One photo that actually means something. Not just a cute one.",                     xp:3,  icon:"\uD83D\uDCF8", types:null,                    difficulty:"easy",     hint:"The blurry ones usually hit harder than the posed ones." },

/* ── ROMANTIC ── */
{ key:"rom_daily_gm",       cadence:"daily",   label:"First thought",         desc:"Good morning text. They're your first thought — show it.",                          xp:2,  icon:"\u2600\uFE0F",        types:["Romantic"],       difficulty:"easy",     hint:"Timing matters less than consistency." },
{ key:"rom_weekly_date",    cadence:"weekly",  label:"Actual date night",     desc:"Intentional time together. Not just existing in the same room.",                    xp:5,  icon:"\uD83D\uDD6F\uFE0F",  types:["Romantic"],       difficulty:"medium",   hint:"Decide beforehand what it is. Intention beats spontaneity." },
{ key:"rom_weekly_cook",    cadence:"weekly",  label:"Cook or eat together",  desc:"Not just food. An act of care. Doesn't have to be homemade.",                      xp:4,  icon:"\uD83C\uDF73",        types:["Romantic"],       difficulty:"easy",     hint:"The conversation while cooking is usually the whole point." },
{ key:"rom_monthly_letter", cadence:"monthly", label:"Monthly love letter",   desc:"Even two sentences. Tell them where you're at this month.",                         xp:5,  icon:"\uD83D\uDCDD",        types:["Romantic"],       difficulty:"medium",   hint:"Date it. You'll both want to look back on these." },
{ key:"rom_once_why",       cadence:"once",    label:"Say why you chose them","desc":"Out loud. To their face. Not in a caption.",                                      xp:5,  icon:"\uD83D\uDC8C",        types:["Romantic"],       difficulty:"hard",     hint:"Uncomfortable? Good. That's where the real stuff lives." },
{ key:"rom_once_surprise",  cadence:"once",    label:"Plan a surprise",       desc:"Something small you know they'd like. The thought is the whole point.",             xp:5,  icon:"\uD83C\uDF81",        types:["Romantic"],       difficulty:"medium",   hint:"Not about money. About paying attention to what they've mentioned." },

/* ── ENGAGED ── */
{ key:"eng_weekly_plan",    cadence:"weekly",  label:"Wedding planning block","desc":"20 mins minimum. Even one decision made counts.",                                  xp:5,  icon:"\uD83D\uDC8D",        types:["Engaged"],        difficulty:"medium",   hint:"Calendar it or it won't happen. Treat it like a meeting." },
{ key:"eng_weekly_money",   cadence:"weekly",  label:"Money talk",            desc:"Budgets, expectations, fears. The unsexy conversation that matters most.",           xp:6,  icon:"\uD83D\uDCB0",        types:["Engaged"],        difficulty:"hard",     hint:"Most divorces involve money surprises. Start talking now." },
{ key:"eng_monthly_sync",   cadence:"monthly", label:"Pre-marriage check-in", desc:"How are you both feeling about everything? Fear, excitement, doubts — all of it.",  xp:6,  icon:"\uD83E\uDD1D",        types:["Engaged"],        difficulty:"medium",   hint:"The doubts you name together stop being scary." },
{ key:"eng_once_vows",      cadence:"once",    label:"Vows first draft",      desc:"Rough is fine. What do you actually want to promise them?",                          xp:6,  icon:"\u270F\uFE0F",        types:["Engaged"],        difficulty:"hard",     hint:"Write separately, share after. The differences will be instructive." },
{ key:"eng_once_nonneg",    cadence:"once",    label:"Name your non-negotiables","desc":"Kids, location, money, lifestyle. Say it clearly before the wedding.",          xp:5,  icon:"\uD83D\uDCCB",        types:["Engaged"],        difficulty:"hard",     hint:"Now's the time, not after." },
{ key:"eng_once_fear",      cadence:"once",    label:"Biggest marriage fear", desc:"Say your real fear about getting married. Both of you.",                             xp:6,  icon:"\uD83D\uDE35",        types:["Engaged"],        difficulty:"hard",     hint:"If you can't say it to each other, that's important information." },

/* ── MARRIED ── */
{ key:"mar_daily_thanks",   cadence:"daily",   label:"Specific thank you",    desc:"Thank them for something real from today. Not 'thanks for being you'.",             xp:2,  icon:"\uD83E\uDD0D",        types:["Married"],        difficulty:"easy",     hint:"Gratitude prevents resentment. This is evidence-based." },
{ key:"mar_weekly_date",    cadence:"weekly",  label:"Phones-down date night","desc":"Protect this time actively. It won't happen unless you make it.",                  xp:6,  icon:"\uD83C\uDF19",        types:["Married"],        difficulty:"medium",   hint:"You don't need to go out. Phones off at the table counts." },
{ key:"mar_weekly_memory",  cadence:"weekly",  label:"Revisit a memory",      desc:"Go back to something that made you both laugh or feel something.",                   xp:4,  icon:"\uD83D\uDCFA",        types:["Married"],        difficulty:"easy",     hint:"'Remember when we...' is one of the best sentences in a marriage." },
{ key:"mar_monthly_state",  cadence:"monthly", label:"State of us",           desc:"How are we actually doing this month? Be real with each other.",                    xp:6,  icon:"\uD83D\uDCC8",        types:["Married"],        difficulty:"medium",   hint:"Not therapy. Just 10 honest minutes before the month ends." },
{ key:"mar_once_letter",    cadence:"once",    label:"Letter to future selves","desc":"Write it together. Seal it. Open it in 5 years.",                                xp:6,  icon:"\uD83D\uDCEE",        types:["Married"],        difficulty:"medium",   hint:"Include what's hard right now, not just the highlight reel." },
{ key:"mar_once_recreate",  cadence:"once",    label:"Recreate your first date","desc":"As close as you can get. Same place, same vibe, but more.",                     xp:5,  icon:"\u23F0",              types:["Married"],        difficulty:"medium",   hint:"You'll notice what's changed. That's the point." },

/* ── LONG DISTANCE ── */
{ key:"ld_daily_call",      cadence:"daily",   label:"Call or voice note",    desc:"Video, audio, whatever. Presence even from far.",                                    xp:3,  icon:"\uD83D\uDCF5",        types:["Long Distance"],  difficulty:"easy",     hint:"5 minutes is enough to feel close." },
{ key:"ld_daily_photo",     cadence:"daily",   label:"Photo of your day",     desc:"Let them into your world. What are you actually looking at right now?",              xp:2,  icon:"\uD83C\uDF04",        types:["Long Distance"],  difficulty:"easy",     hint:"The mundane ones are often the most intimate." },
{ key:"ld_weekly_watch",    cadence:"weekly",  label:"Watch something together","desc":"Sync a show, movie, YouTube. Same screen, different places.",                    xp:4,  icon:"\uD83C\uDF7F",        types:["Long Distance"],  difficulty:"easy",     hint:"Teleparty, Discord, or just press play at the same time." },
{ key:"ld_weekly_visit",    cadence:"weekly",  label:"Plan the next visit",   desc:"Even if it's months away — a date on the calendar changes everything.",              xp:5,  icon:"\u2708\uFE0F",        types:["Long Distance"],  difficulty:"medium",   hint:"Ambiguity is the enemy of long distance. Pin something down." },
{ key:"ld_monthly_honest",  cadence:"monthly", label:"Honest check-in",       desc:"How is the distance actually feeling? No filter. Both of you.",                     xp:6,  icon:"\uD83D\uDCAC",        types:["Long Distance"],  difficulty:"hard",     hint:"Naming hard feelings keeps them from becoming resentment." },
{ key:"ld_once_package",    cadence:"once",    label:"Send a care package",   desc:"Something they didn't ask for. Something you picked for them.",                      xp:6,  icon:"\uD83D\uDCE6",        types:["Long Distance"],  difficulty:"medium",   hint:"Handwritten note inside. Always." },
{ key:"ld_once_mail",       cadence:"once",    label:"Send actual mail",      desc:"A real letter. Stamp and everything. Analog in a digital relationship hits different.",xp:6, icon:"\uD83D\uDCEC",        types:["Long Distance"],  difficulty:"medium",   hint:"The wait is part of it. They'll keep it." },

/* ── SITUATIONSHIP ── */
{ key:"sit_weekly_define",  cadence:"weekly",  label:"Define one thing",      desc:"Not everything. Just one thing you both want from this. Out loud.",                  xp:4,  icon:"\uD83D\uDD0D",        types:["Situationship"],  difficulty:"hard",     hint:"Ambiguity feels safe but it's usually just postponed discomfort." },
{ key:"sit_weekly_honest",  cadence:"weekly",  label:"No-vague-text week",    desc:"Say what you mean this week. No 'haha' to avoid the conversation.",                 xp:5,  icon:"\uD83D\uDCAC",        types:["Situationship"],  difficulty:"hard",     hint:"How long have you been half-saying things? Try saying one fully." },
{ key:"sit_monthly_check",  cadence:"monthly", label:"Where are we at",       desc:"One honest conversation about where this is going. No pressure, just truth.",       xp:5,  icon:"\uD83E\uDD14",        types:["Situationship"],  difficulty:"hard",     hint:"Most situationships end not from conflict but from nobody asking." },
{ key:"sit_once_nameit",    cadence:"once",    label:"Name what this is",     desc:"To each other. Out loud. What do you actually call this?",                           xp:5,  icon:"\uD83C\uDFF7\uFE0F",  types:["Situationship"],  difficulty:"hard",     hint:"Not for Instagram. Just for you two." },
{ key:"sit_once_needs",     cadence:"once",    label:"Ask what they need",    desc:"And actually listen. Don't plan your answer while they're talking.",                 xp:4,  icon:"\uD83D\uDC42",        types:["Situationship"],  difficulty:"medium",   hint:"Most situationships collapse because people assume instead of ask." },

/* ── FRIENDS TO LOVERS ── */
{ key:"ftl_weekly_roots",   cadence:"weekly",  label:"Friend mode on",        desc:"Do something you used to do as friends. Don't lose the friendship in the romance.",  xp:4,  icon:"\uD83E\uDD1D",        types:["Friends to Lovers"], difficulty:"easy",  hint:"The friendship is your biggest advantage. Protect it." },
{ key:"ftl_weekly_tell",    cadence:"weekly",  label:"Tell them what changed","desc":"When did you realise? Be specific. Tell them.",                                    xp:5,  icon:"\uD83D\uDD04",        types:["Friends to Lovers"], difficulty:"hard",  hint:"The more specific the story, the harder it lands." },
{ key:"ftl_monthly_check",  cadence:"monthly", label:"Friendship temperature","desc":"Are you still best friends? Or is the friendship getting lost in the relationship?",xp:5, icon:"\uD83C\uDF21\uFE0F",  types:["Friends to Lovers"], difficulty:"medium",hint:"Check in on the friendship specifically, not just the romance." },
{ key:"ftl_once_origin",    cadence:"once",    label:"Revisit how you met",   desc:"Go back to the friendship origin. What do you both remember?",                      xp:4,  icon:"\uD83D\uDCCD",        types:["Friends to Lovers"], difficulty:"easy",  hint:"You'll probably remember different things. Great conversation starter." },
{ key:"ftl_once_tellfriend",cadence:"once",    label:"Tell a mutual friend",  desc:"Make it real to the people around you. Not a post — a conversation.",               xp:3,  icon:"\uD83D\uDDE3\uFE0F",  types:["Friends to Lovers"], difficulty:"medium",hint:"If you're still hiding it from mutual friends, ask yourself why." },

/* ── MILESTONES (auto-unlock) ── */
{ key:"ms_score_70",    cadence:"milestone", label:"BondScore 70+",         desc:"Your relationship hit a real benchmark. That's consistency, not luck.",              xp:5,  icon:"\uD83C\uDF1F", types:null,                    difficulty:"milestone", hint:"Auto-unlocked when your BondScore reaches 70." },
{ key:"ms_score_85",    cadence:"milestone", label:"BondScore 85+",         desc:"Top tier. Most couples never get here.",                                              xp:8,  icon:"\uD83D\uDC8E", types:null,                    difficulty:"milestone", hint:"Auto-unlocked when your BondScore reaches 85." },
{ key:"ms_30_checkins", cadence:"milestone", label:"30-day streak",         desc:"30 days of checking in. That's not a habit — that's a practice.",                    xp:8,  icon:"\uD83D\uDD25", types:null,                    difficulty:"milestone", hint:"Auto-unlocked after 30 daily check-ins completed." },
{ key:"ms_ld_6mo",      cadence:"milestone", label:"6 months long distance","desc":"Half a year apart. That's hard and you're doing it.",                               xp:8,  icon:"\uD83C\uDFE1", types:["Long Distance"],        difficulty:"milestone", hint:"Auto-unlocked for Long Distance couples with 6+ months duration." },
{ key:"ms_married_1yr", cadence:"milestone", label:"1 year of marriage",    desc:"Year one done. The research says this is when it gets real.",                         xp:10, icon:"\uD83D\uDC8D", types:["Married"],              difficulty:"milestone", hint:"Auto-unlocked for Married couples with 12+ months duration." },
];

const XP_CAPS = {
"Romantic":          28,
"Engaged":           24,
"Married":           30,
"Long Distance":     28,
"Situationship":     16,
"Friends to Lovers": 20,
};

const DIFF_COLORS = { easy:"rgba(52,211,153,0.7)", medium:"rgba(251,191,36,0.7)", hard:"rgba(248,113,113,0.7)", milestone:"rgba(167,139,250,0.7)" };
const DIFF_DOT = (d) => React.createElement("span", { style:{ width:6, height:6, borderRadius:999, background:DIFF_COLORS[d]||"#fff", display:"inline-block", marginRight:4, verticalAlign:"middle", flexShrink:0 }});

function MyCoupleProfile({ couple, onUpdate, defaultTab = "profile" }) {
const [editing, setEditing] = React.useState(false);
const [activeTab, setActiveTab] = React.useState(defaultTab);
const [cadenceFilter, setCadenceFilter] = React.useState("all");
const [completedChallenges, setCompletedChallenges] = React.useState([]);
const [completing, setCompleting] = React.useState(null);
const [liveScore, setLiveScore] = React.useState(couple.bond_score || 0);
const [scoreBreakdown, setScoreBreakdown] = React.useState(null);
const [justUnlocked, setJustUnlocked] = React.useState(null);
const [streak, setStreak] = React.useState(0);

const xpCap = XP_CAPS[couple.couple_type] || 20;
const isSelfDeclared = couple.declared_by === "partner";
const isNominated = couple.declared_by === "outsider";

React.useEffect(() => {
if (!couple?.id) return;
let mounted = true;
async function load() {
const { data } = await window.supabaseClient.from("couple_challenges")
.select("*").eq("couple_id", couple.id).order("completed_at", { ascending:true });
const done = data || [];
if (!mounted) return;
setCompletedChallenges(done);
if (isSelfDeclared) {
const totalXP = done.reduce((s,c) => s + (c.xp_awarded||0), 0);
const base = couple.bond_score || 0;
const bonus = Math.min(totalXP, xpCap);
setLiveScore(Math.min(Math.round(base + bonus), 100));
setScoreBreakdown({ base, bonus, totalXP, cap: xpCap });
// Streak: consecutive days of daily_checkin
const checkins = done.filter(c => c.challenge_key === "daily_checkin")
.map(c => new Date(c.completed_at).toDateString());
let s = 0;
const today = new Date();
for (let i = 0; i < 60; i++) {
const d = new Date(today); d.setDate(d.getDate() - i);
if (checkins.includes(d.toDateString())) s++; else if (i > 0) break;
}
setStreak(s);
await checkMilestones(done, base + bonus);
}
if (isNominated && mounted) {
const [{ data: rxns }, { data: cmts }] = await Promise.all([
window.supabaseClient.from("reactions").select("id").eq("target_type","couple").eq("target_id",couple.id),
window.supabaseClient.from("couple_comments").select("id").eq("couple_id",couple.id).eq("target_type","couple")
]);
const r = rxns?.length||0, c = cmts?.length||0;
const ns = Math.min(Math.round(50 + r*0.5 + c*1.5), 95);
if (mounted) { setLiveScore(ns); setScoreBreakdown({ reactions:r, comments:c }); }
}
}
load();
return () => { mounted = false; };
}, [couple?.id]);

async function checkMilestones(done, currentScore) {
const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid");
const doneKeys = new Set(done.map(c => c.challenge_key));
const toUnlock = [];
if (currentScore >= 70 && !doneKeys.has("ms_score_70")) toUnlock.push("ms_score_70");
if (currentScore >= 85 && !doneKeys.has("ms_score_85")) toUnlock.push("ms_score_85");
const checkinCount = done.filter(c => c.challenge_key === "daily_checkin").length;
if (checkinCount >= 30 && !doneKeys.has("ms_30_checkins")) toUnlock.push("ms_30_checkins");
const dur = couple.duration || "";
const months = dur.includes("5+") ? 72 : dur.includes("2-5") ? 36 : dur.includes("1-2") ? 18 : dur.includes("6-12") ? 9 : dur.includes("1-6") ? 3 : 0;
if (couple.couple_type === "Long Distance" && months >= 6 && !doneKeys.has("ms_ld_6mo")) toUnlock.push("ms_ld_6mo");
if (couple.couple_type === "Married" && months >= 12 && !doneKeys.has("ms_married_1yr")) toUnlock.push("ms_married_1yr");
for (const key of toUnlock) {
const ch = COUPLE_CHALLENGES.find(c => c.key === key);
if (!ch) continue;
const { data: row } = await window.supabaseClient.from("couple_challenges").insert({
couple_id: couple.id, challenge_key: key, completed_by: uid||null,
xp_awarded: ch.xp, completed_at: new Date().toISOString()
}).select().single();
if (row) {
setCompletedChallenges(prev => [...prev, row]);
setJustUnlocked(ch);
setTimeout(() => setJustUnlocked(null), 3500);
window.supabaseClient.from("xp_log").insert({ user_id: uid, source:`milestone:${key}`, amount:ch.xp, created_at:new Date().toISOString() });
}
}
}
async function completeChallenge(ch, proofUrl = null, proofNote = null) {
if (completing) return;
setCompleting(ch.key);
const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid");
const now = new Date();
const alreadyDone = completedChallenges.find(c => {
if (c.challenge_key !== ch.key) return false;
const d = new Date(c.completed_at);
if (ch.cadence === "once") return true;
if (ch.cadence === "daily") return d.toDateString() === now.toDateString();
if (ch.cadence === "weekly") return d > new Date(now.getTime() - 7*24*60*60*1000);
if (ch.cadence === "monthly") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
return false;
});
if (alreadyDone) { setCompleting(null); return; }
const session = await window.supabaseClient.auth.getSession();
const token = session?.data?.session?.access_token ?? window.SUPABASE_ANON_KEY;
const { data: row, error } = await window.supabaseClient
  .from("couple_challenges")
  .insert({
    couple_id: couple.id,
    challenge_key: ch.key,
    completed_by: uid || null,
    xp_awarded: ch.xp,
    proof_url: proofUrl || null,
    proof_note: proofNote || null,
    completed_at: now.toISOString(),
  })
  .select()
  .single();
if (error) { console.warn("[challenge] insert failed:", error); setCompleting(null); return; }
if (row) {
const updated = [...completedChallenges, row];
setCompletedChallenges(updated);
const totalXP = updated.reduce((s,c) => s + (c.xp_awarded||0), 0);
const bonus = Math.min(totalXP, xpCap);
const newScore = Math.min(Math.round((couple.bond_score||0) + bonus), 100);
setLiveScore(newScore);
setScoreBreakdown({ base: couple.bond_score, bonus, totalXP, cap: xpCap });
if (ch.key === "daily_checkin") {
const checkins = updated.filter(c => c.challenge_key==="daily_checkin").map(c => new Date(c.completed_at).toDateString());
let s = 0;
for (let i = 0; i < 60; i++) {
const d = new Date(); d.setDate(d.getDate()-i);
if (checkins.includes(d.toDateString())) s++; else if (i > 0) break;
}
setStreak(s);
}
await window.supabaseClient.from("couples").update({ bond_score: newScore, last_computed_at: now.toISOString() }).eq("id", couple.id);
window.supabaseClient.from("xp_log").insert({ user_id: uid, source:`challenge:${ch.key}`, amount:ch.xp, created_at:now.toISOString() });
await checkMilestones(updated, newScore);
}
setCompleting(null);
}

function isDone(ch) {
const now = new Date();
return completedChallenges.some(c => {
if (c.challenge_key !== ch.key) return false;
const d = new Date(c.completed_at);
if (ch.cadence === "once" || ch.cadence === "milestone") return true;
if (ch.cadence === "daily") return d.toDateString() === now.toDateString();
if (ch.cadence === "weekly") return d > new Date(now.getTime() - 7*24*60*60*1000);
if (ch.cadence === "monthly") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
return false;
});
}

function getChallengesForCouple() {
return COUPLE_CHALLENGES.filter(ch => !ch.types || ch.types.includes(couple.couple_type));
}

const visibleChallenges = React.useMemo(() => {
const all = getChallengesForCouple();
if (cadenceFilter === "all") return all;
return all.filter(c => c.cadence === cadenceFilter);
}, [cadenceFilter, couple.couple_type, completedChallenges]);

const allForCouple = getChallengesForCouple();
const nonMilestone = allForCouple.filter(c => c.cadence !== "milestone");
const doneCount = nonMilestone.filter(isDone).length;
const totalXPEarned = completedChallenges.reduce((s,c) => s + (c.xp_awarded||0), 0);
const progressPct = nonMilestone.length > 0 ? Math.round((doneCount / nonMilestone.length) * 100) : 0;

if (editing) return <CreateCoupleProfile onCreated={c => { onUpdate(c); setEditing(false); }} />;

const bond = Math.round(liveScore);
const bondGrad = bond >= 80 ? "linear-gradient(135deg,#34d399,#10b981)" : bond >= 55 ? "linear-gradient(135deg,#f87171,#fb923c)" : "linear-gradient(135deg,#6b7280,#9ca3af)";
const TYPE_SYM = { Romantic:"\u2661", Engaged:"\u25C7", Married:"\u25CB", "Long Distance":"\u2197", Situationship:"\u223F", "Friends to Lovers":"\u21DD" };
const sym = TYPE_SYM[couple.couple_type] || "\u00B7";
const declaredText = isSelfDeclared ? "self-declared" : isNominated ? "nominated" : null;
const DIFF_COLORS = { easy:"rgba(52,211,153,0.7)", medium:"rgba(251,191,36,0.7)", hard:"rgba(248,113,113,0.7)", milestone:"rgba(167,139,250,0.7)" };
const DIFF_DOT = (d) => <span style={{ width:6, height:6, borderRadius:999, background:DIFF_COLORS[d]||"#fff", display:"inline-block", marginRight:4, verticalAlign:"middle", flexShrink:0 }} />;
const CADENCE_FILTERS = [
{ id:"all", label:"All" },
{ id:"daily", label:"\u23F1 Daily" },
{ id:"weekly", label:"\uD83D\uDCC5 Weekly" },
{ id:"monthly", label:"\uD83D\uDDD3\uFE0F Monthly" },
{ id:"once", label:"\uD83C\uDFC5 Once" },
{ id:"milestone", label:"\uD83D\uDCA5 Milestones" },
];

return (
<div className="bond-fade-up" style={{ paddingBottom:32 }}>

{/* Milestone unlock toast */}
{justUnlocked && (
<div style={{ position:"fixed", top:24, left:"50%", transform:"translateX(-50%)", zIndex:999, background:"rgba(139,92,246,0.95)", borderRadius:16, padding:"12px 20px", display:"flex", alignItems:"center", gap:10, boxShadow:"0 8px 32px rgba(0,0,0,0.4)" }}>
<span style={{ fontSize:22 }}>{justUnlocked.icon}</span>
<div>
<div style={{ fontSize:13, fontWeight:800, color:"#fff" }}>Milestone unlocked!</div>
<div style={{ fontSize:11, color:"rgba(255,255,255,0.75)" }}>{justUnlocked.label} · +{justUnlocked.xp} XP</div>
</div>
</div>
)}

{/* Score card */}
<div style={{ borderRadius:22, overflow:"hidden", marginBottom:12, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(248,113,113,0.18)", boxShadow:"0 8px 40px rgba(248,113,113,0.08)" }}>
<div style={{ height:2, background:"linear-gradient(90deg,#f87171,#fb923c,rgba(251,191,36,0.6))" }} />
<div style={{ padding:20 }}>
<div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
<div style={{ width:56, height:56, borderRadius:18, overflow:"hidden", flexShrink:0, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(248,113,113,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, color:"rgba(255,255,255,0.3)", fontWeight:300 }}>
{couple.avatar_url ? <img src={couple.avatar_url} style={{ width:"100%", height:"100%", objectFit:"cover" }} loading="lazy" /> : sym}
</div>
<div style={{ flex:1 }}>
<div style={{ fontSize:17, fontWeight:800, color:"#fff", letterSpacing:"-0.02em" }}>{couple.couple_name || couple.partner_username}</div>
<div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:3 }}>
{sym} {couple.couple_type}
{declaredText && <span style={{ color:"rgba(255,255,255,0.2)" }}> · {declaredText}</span>}
</div>
{streak > 1 && <div style={{ fontSize:11, color:"rgba(251,191,36,0.85)", marginTop:5, fontWeight:700 }}>{"\uD83D\uDD25"} {streak}-day streak</div>}
</div>
<div style={{ textAlign:"right" }}>
<div style={{ fontSize:28, fontWeight:900, letterSpacing:"-0.03em", background:bondGrad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>{bond}</div>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", fontWeight:500 }}>bond</div>
</div>
</div>
<div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
{[{ sym:"\u23C1", label:"Sync", val:couple.emotional_sync_score }, { sym:"\u2661", label:"Stable", val:couple.stability_score }, { sym:"\u25B3", label:"Growth", val:couple.growth_index }].map(s => (
<div key={s.label} style={{ borderRadius:14, padding:"11px 8px", textAlign:"center", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
<div style={{ fontSize:12, color:"rgba(255,255,255,0.25)", marginBottom:4 }}>{s.sym}</div>
<div style={{ fontSize:17, fontWeight:800, color:"#fff" }}>{Math.round(s.val||0)}</div>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{s.label}</div>
</div>
))}
</div>
{/* Score breakdown */}
{scoreBreakdown && isSelfDeclared && (
<div style={{ background:"rgba(255,255,255,0.03)", borderRadius:12, padding:"10px 12px", border:"1px solid rgba(255,255,255,0.06)" }}>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Score breakdown</div>
<div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
<span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>Quiz: <b style={{ color:"#fff" }}>{scoreBreakdown.base}</b></span>
<span style={{ fontSize:11, color:"rgba(52,211,153,0.8)" }}>+ Challenges: <b>+{scoreBreakdown.bonus}</b></span>
{scoreBreakdown.totalXP >= scoreBreakdown.cap
? <span style={{ fontSize:10, padding:"2px 8px", borderRadius:999, background:"rgba(251,191,36,0.15)", color:"rgba(251,191,36,0.8)", fontWeight:600 }}>XP cap reached</span>
: <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)" }}>{scoreBreakdown.cap - Math.min(scoreBreakdown.totalXP, scoreBreakdown.cap)} XP left to cap</span>
}
</div>
</div>
)}
{scoreBreakdown && isNominated && (
<div style={{ background:"rgba(255,255,255,0.03)", borderRadius:12, padding:"10px 12px", border:"1px solid rgba(255,255,255,0.06)" }}>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Score breakdown</div>
<div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
<span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>Base: <b style={{ color:"#fff" }}>50</b></span>
<span style={{ fontSize:11, color:"rgba(248,113,113,0.7)" }}>{"\u2764\uFE0F"} Reactions: <b>+{Math.round(scoreBreakdown.reactions*0.5)}</b></span>
<span style={{ fontSize:11, color:"rgba(96,165,250,0.7)" }}>{"\uD83D\uDCAC"} Comments: <b>+{Math.round(scoreBreakdown.comments*1.5)}</b></span>
</div>
</div>
)}
<div style={{ fontSize:11, color:"rgba(248,113,113,0.35)", textAlign:"center", marginTop:14, fontWeight:500 }}>◇ visible in the discover feed</div>
</div>
</div>

{/* Tab bar */}
<div style={{ display:"flex", gap:4, padding:"3px", borderRadius:14, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", marginBottom:16 }}>
{[
  { id:"profile", label:"Profile" },
  { id:"moods", label:"🧠 Moods" },
  { id:"status", label:"📸 Status" },
  { id:"challenges", label:"⚡ Challenges" }
].map(t => (
<button key={t.id} onClick={() => setActiveTab(t.id)}
style={{ flex:1, padding:"8px 0", borderRadius:11, fontSize:13, fontWeight: activeTab===t.id ? 700 : 500, background: activeTab===t.id ? "rgba(248,113,113,0.18)" : "transparent", color: activeTab===t.id ? "#f87171" : "rgba(255,255,255,0.4)", border: activeTab===t.id ? "1px solid rgba(248,113,113,0.22)" : "1px solid transparent", cursor:"pointer", transition:"all 0.18s", fontFamily:"inherit" }}>
{t.label}
</button>
))}
</div>

{/* CHALLENGES TAB */}
{activeTab === "challenges" && (
<div>
{isSelfDeclared ? (
<div>
{/* Progress bar */}
<div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:"14px 16px", marginBottom:16 }}>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
<div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>{doneCount}/{nonMilestone.length} done</div>
<div style={{ display:"flex", alignItems:"center", gap:8 }}>
{streak > 0 && <span style={{ fontSize:11, color:"rgba(251,191,36,0.85)", fontWeight:700 }}>{"\uD83D\uDD25"} {streak}d</span>}
<span style={{ fontSize:12, fontWeight:700, color:"rgba(251,191,36,0.8)" }}>+{Math.min(totalXPEarned,xpCap)}/{xpCap} XP</span>
</div>
</div>
<div style={{ height:6, borderRadius:999, background:"rgba(255,255,255,0.07)" }}>
<div style={{ height:"100%", borderRadius:999, width:`${progressPct}%`, background:"linear-gradient(90deg,#f87171,#fb923c,#fbbf24)", transition:"width 0.5s ease" }} />
</div>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.2)", marginTop:6 }}>
{totalXPEarned >= xpCap ? "XP cap reached — score maxed from challenges" : `${xpCap - Math.min(totalXPEarned,xpCap)} XP left until score cap`}
</div>
</div>

{/* Cadence filter pills */}
<div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto", paddingBottom:4 }}>
{CADENCE_FILTERS.map(f => (
<button key={f.id} onClick={() => setCadenceFilter(f.id)}
style={{ flexShrink:0, padding:"5px 12px", borderRadius:999, fontSize:11, fontWeight:600, cursor:"pointer", background: cadenceFilter===f.id ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.05)", border: cadenceFilter===f.id ? "1px solid rgba(248,113,113,0.4)" : "1px solid rgba(255,255,255,0.08)", color: cadenceFilter===f.id ? "#fca5a5" : "rgba(255,255,255,0.4)", transition:"all 0.15s", fontFamily:"inherit" }}>
{f.label}
</button>
))}
</div>

{/* Universal challenges */}
{visibleChallenges.filter(c => !c.types && c.cadence !== "milestone").length > 0 && (
<div style={{ marginBottom:20 }}>
<div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.25)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>{"\uD83C\uDF0D"} For every couple</div>
{visibleChallenges.filter(c => !c.types && c.cadence !== "milestone").map(ch =>
<ChallengeCard key={ch.key} ch={ch} done={isDone(ch)} completing={completing===ch.key} onComplete={(proofUrl, proofNote) => completeChallenge(ch, proofUrl, proofNote)} />
)}
</div>
)}

{/* Type-specific challenges */}
{visibleChallenges.filter(c => c.types && c.cadence !== "milestone").length > 0 && (
<div style={{ marginBottom:20 }}>
<div style={{ fontSize:11, fontWeight:700, color:"rgba(248,113,113,0.4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>{sym} For {couple.couple_type || "your type"} couples</div>
{visibleChallenges.filter(c => c.types && c.cadence !== "milestone").map(ch =>
<ChallengeCard key={ch.key} ch={ch} done={isDone(ch)} completing={completing===ch.key} onComplete={(proofUrl, proofNote) => completeChallenge(ch, proofUrl, proofNote)} />
)}
</div>
)}

{/* Milestones */}
{(cadenceFilter === "all" || cadenceFilter === "milestone") && (
<div style={{ marginBottom:20 }}>
<div style={{ fontSize:11, fontWeight:700, color:"rgba(167,139,250,0.5)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>{"\uD83D\uDCA5"} Milestones — auto-unlock</div>
{COUPLE_CHALLENGES.filter(c => c.cadence === "milestone" && (!c.types || c.types.includes(couple.couple_type))).map(ch => {
const done = isDone(ch);
return (
<div key={ch.key} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:14, background: done ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.03)", border: done ? "1px solid rgba(139,92,246,0.25)" : "1px dashed rgba(255,255,255,0.1)", marginBottom:8, opacity: done ? 1 : 0.55 }}>
<div style={{ fontSize:22, flexShrink:0 }}>{done ? ch.icon : "\uD83D\uDD12"}</div>
<div style={{ flex:1 }}>
<div style={{ fontSize:13, fontWeight:700, color: done ? "#c4b5fd" : "rgba(255,255,255,0.5)" }}>{ch.label}</div>
<div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{done ? ch.desc : ch.hint}</div>
</div>
<div style={{ flexShrink:0, textAlign:"right" }}>
<div style={{ fontSize:11, fontWeight:700, color:"rgba(251,191,36,0.6)" }}>+{ch.xp} XP</div>
{done && <div style={{ fontSize:10, color:"rgba(139,92,246,0.8)", fontWeight:600, marginTop:2 }}>✓ done</div>}
</div>
</div>
);
})}
</div>
)}
</div>
) : (
<div style={{ background:"rgba(255,255,255,0.03)", borderRadius:16, padding:"24px 16px", textAlign:"center" }}>
<div style={{ fontSize:32, marginBottom:10 }}>👥</div>
<div style={{ fontSize:14, fontWeight:700, color:"rgba(255,255,255,0.45)", marginBottom:8 }}>No challenges for nominated couples</div>
<div style={{ fontSize:12, color:"rgba(255,255,255,0.25)", lineHeight:1.7 }}>
Your BondScore grows automatically as the community reacts, comments, and engages with your profile.<br /><br />
More engagement = higher score. Go be interesting.
</div>
</div>
)}
</div>
)}
{/* STATUS TAB */}
{activeTab === "status" && (
<div>
<div style={{ fontSize:12, color:"rgba(255,255,255,0.3)",
marginBottom:14, lineHeight:1.6 }}>
Share a moment — photos disappear after 24 hours.
Followers can tap your card avatar to view them.
</div>
<CoupleStatus coupleId={couple.id} isOwner={true} />
</div>
)}
{/* MOODS TAB */}
{activeTab === "moods" && (
  <MoodHub currentUser={window.currentUser} />
)}

{/* PROFILE TAB */}
{activeTab === "profile" && (
<button className="bond-cta" onClick={() => setEditing(true)}
style={{ width:"100%", padding:"13px", borderRadius:16, cursor:"pointer", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:600 }}>
{"\u21BB"} Update Profile
</button>
)}
</div>
);
}
function ChallengeCard({ ch, done, completing, onComplete }) {
const [showHint, setShowHint] = React.useState(false);
const [showProof, setShowProof] = React.useState(false);
const [proofImg, setProofImg] = React.useState(null);
const [proofNote, setProofNote] = React.useState("");
const [proofFile, setProofFile] = React.useState(null);
const [submitting, setSubmitting] = React.useState(false);

const needsProof = ["once_photo","rom_weekly_date","rom_weekly_cook","rom_once_surprise",
"mar_once_recreate","ld_daily_photo","ld_once_package","weekly_new",
"ftl_weekly_roots","ftl_once_origin","mar_weekly_memory"].includes(ch.key);

function handleFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { alert("Photo must be under 2MB"); return; }
  setProofFile(file);
  const reader = new FileReader();
  reader.onload = () => setProofImg(reader.result);
  reader.readAsDataURL(file);
}
async function submitWithProof() {
  setSubmitting(true);
  let uploadedUrl = null;
  
  if (proofFile) {
    try {
      const compressed = await compressImage(proofFile, 800, 0.8);
      uploadedUrl = await uploadToStorage("bond-uploads", compressed, "proofs/");
    } catch(e) {
      console.warn("[proof upload] failed", e);
    }
  }
  
  await onComplete(uploadedUrl, proofNote.trim() || null);
  setShowProof(false);
  setProofImg(null);
  setProofFile(null); // clear file ref too
  setProofNote("");
  setSubmitting(false);
}

function handleDoneClick() {
if (needsProof) { setShowProof(true); }
else { onComplete(null, null); }
}
function canSubmit() {
if (needsProof && !proofImg) return false;
return true;
}
return (
<div style={{ borderRadius:14, background: done ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.04)", border: done ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(255,255,255,0.08)", marginBottom:8, overflow:"hidden" }}>
{/* Main row */}
<div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px" }}>
<div style={{ fontSize:20, flexShrink:0 }}>{ch.icon}</div>
<div style={{ flex:1, minWidth:0 }}>
<div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
{DIFF_DOT(ch.difficulty)}
<span style={{ fontSize:13, fontWeight:700, color: done ? "rgba(52,211,153,0.9)" : "#fff" }}>{ch.label}</span>
{needsProof && !done && <span style={{ fontSize:9, padding:"1px 6px", borderRadius:999, background:"rgba(248,113,113,0.15)", color:"rgba(248,113,113,0.7)", fontWeight:600, marginLeft:2 }}>📸 proof</span>}
</div>
<div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", lineHeight:1.4 }}>{ch.desc}</div>
</div>
<div style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5 }}>
<span style={{ fontSize:11, fontWeight:700, color:"rgba(251,191,36,0.7)" }}>+{ch.xp} XP</span>
{done
? <span style={{ fontSize:12, color:"rgba(52,211,153,0.8)", fontWeight:700 }}>✓</span>
: <button onClick={handleDoneClick} disabled={completing || showProof}
style={{ padding:"5px 12px", borderRadius:8, background:"rgba(248,113,113,0.85)", border:"none", color:"#fff", fontSize:11, fontWeight:700, cursor: (completing||showProof) ? "default" : "pointer", opacity: (completing||showProof) ? 0.6 : 1, fontFamily:"inherit" }}>
{completing ? "…" : "Done"}
</button>
}
</div>
</div>

{/* Proof upload panel */}
{showProof && !done && (
<div style={{ padding:"12px 14px 14px", borderTop:"1px solid rgba(255,255,255,0.07)", background:"rgba(255,255,255,0.03)" }}>
<div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.6)", marginBottom:10 }}>📸 Photo required to complete this one <span style={{ fontSize:10, color:"rgba(248,113,113,0.6)", fontWeight:600 }}>*</span></div>
<label style={{ display:"block", cursor:"pointer" }}>
<div style={{ borderRadius:12, border:`2px dashed ${proofImg ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.15)"}`, padding: proofImg ? "4px" : "20px 12px", textAlign:"center", background: proofImg ? "transparent" : "rgba(255,255,255,0.02)", transition:"all 0.2s", overflow:"hidden" }}>
{proofImg
? <img src={proofImg} style={{ width:"100%", maxHeight:180, objectFit:"cover", borderRadius:10, display:"block" }} />
: <div>
<div style={{ fontSize:24, marginBottom:6 }}>📷</div>
<div style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>Tap to add a photo</div>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.2)", marginTop:3 }}>max 2MB</div>
</div>
}
</div>
<input type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }} />
</label>
{proofImg && (
<button onClick={() => setProofImg(null)} style={{ marginTop:6, fontSize:10, color:"rgba(255,255,255,0.3)", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>✕ remove photo</button>
)}
<input
value={proofNote} onChange={e => setProofNote(e.target.value)}
placeholder="Add a caption... (optional)"
style={{ width:"100%", boxSizing:"border-box", marginTop:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:10, padding:"8px 12px", fontSize:12, color:"#fff", outline:"none", fontFamily:"inherit" }}
/>
<div style={{ display:"flex", gap:8, marginTop:10 }}>
<button onClick={() => { setShowProof(false); setProofImg(null); setProofNote(""); }}
style={{ flex:1, padding:"8px", borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", color:"rgba(255,255,255,0.4)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
Cancel
</button>
<button onClick={submitWithProof} disabled={submitting || !canSubmit()}
style={{ flex:2, padding:"8px", borderRadius:10, background: canSubmit() ? "linear-gradient(135deg,#f87171,#fb923c)" : "rgba(255,255,255,0.08)", border:"none", color: canSubmit() ? "#fff" : "rgba(255,255,255,0.3)", fontSize:12, fontWeight:700, cursor: (submitting || !canSubmit()) ? "default" : "pointer", opacity: submitting ? 0.7 : 1, fontFamily:"inherit" }}>
{submitting ? "Saving…" : "Submit ✓"}
</button>
</div>
</div>
)}

{/* Proof already submitted - show thumbnail */}
{done && ch._proof_url && (
<div style={{ padding:"0 14px 10px" }}>
<img src={ch._proof_url} style={{ width:"100%", maxHeight:120, objectFit:"cover", borderRadius:10 }} />
</div>
)}

{/* Hint toggle */}
<button onClick={e => { e.stopPropagation(); setShowHint(v => !v); }}
style={{ width:"100%", padding:"5px 14px", background:"transparent", border:"none", borderTop:"1px solid rgba(255,255,255,0.04)", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
<span style={{ fontSize:10, color:"rgba(255,255,255,0.22)", fontWeight:600 }}>{showHint ? "\u25B2 hide tip" : "\u25BC tip"}</span>
</button>
{showHint && (
<div style={{ padding:"8px 14px 12px", fontSize:11, color:"rgba(255,255,255,0.45)", lineHeight:1.5, fontStyle:"italic" }}>
💡 {ch.hint}
</div>
)}
</div>
);
}
/* ---------------- SocialHub (tabs) ---------------- */

/* ============================================================
BLOCK B — REPLACE → function SocialHub()

FIX: Removed console.log from render (fired every render).
Kept Feed / Profile / Couple tab structure intact.
============================================================ */

/* ============================================================
BLOCK 2 — REPLACE → function SocialHub()

CHANGES:
- Profile tab REMOVED
- Feed tab now renders CoupleFeed (ranked couples)
instead of SocialFeed (posts)
- Couple tab kept for Create / My Profile
============================================================ */

/* ============================================================
A — REPLACE → function SocialHub()
Top-level Feed / Couple switcher
============================================================ */

/* ============================================================
A — REPLACE → function SocialHub()
============================================================ */
function ChallengesHub() {
const [couple, setCouple] = React.useState(null);
const [loading, setLoading] = React.useState(true);
React.useEffect(() => {
let mounted = true;
async function load() {
const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid");
if (!uid) { if (mounted) setLoading(false); return; }
const { data } = await window.supabaseClient.from("couples").select("*").eq("creator_id", uid).maybeSingle();
if (mounted) { setCouple(data || null); setLoading(false); }
}
load();
return () => { mounted = false; };
}, []);
if (loading) return <div style={{ textAlign:"center", padding:"48px 0", color:"rgba(248,113,113,0.4)", fontSize:13 }}>Loading…</div>;
if (!couple) return (
<div style={{ padding:"40px 20px", textAlign:"center" }}>
<div style={{ fontSize:36, marginBottom:12 }}>⚡</div>
<div style={{ fontSize:15, fontWeight:700, color:"rgba(255,255,255,0.5)", marginBottom:8 }}>No couple profile yet</div>
<div style={{ fontSize:12, color:"rgba(255,255,255,0.25)", lineHeight:1.6 }}>Create your couple profile first — then unlock daily, weekly, and one-time challenges to boost your BondScore.</div>
</div>
);
return <MyCoupleProfile couple={couple} onUpdate={setCouple} defaultTab="challenges" />;
}
// ── Deterministic fake stats for posts with 0 real reactions ──
function seedPostStats(postId) {
  // Hash the post ID into a stable number
  let h = 0;
  const str = String(postId);
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  const rng = () => {
    h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
    h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
  };

  const virality = rng();
  let total;
  if      (virality > 0.90) total = Math.floor(rng() * 800)  + 200;  // hot
  else if (virality > 0.70) total = Math.floor(rng() * 120)  + 30;   // decent
  else if (virality > 0.40) total = Math.floor(rng() * 40)   + 8;    // normal
  else                      total = Math.floor(rng() * 12)   + 2;    // quiet

  const emojis = ["🔥","💞","😭","👀","✨"];
  const rxns = {};
  let rem = total;
  const shares = emojis.map(() => rng());
  const tot = shares.reduce((a, b) => a + b, 0);
  emojis.forEach((e, i) => {
    const alloc = i < emojis.length - 1
      ? Math.floor((shares[i] / tot) * total)
      : rem;
    rxns[e] = Math.max(0, alloc);
    rem -= rxns[e];
  });

  const commentCount = Math.max(1, Math.floor(total * (0.05 + rng() * 0.10) + rng() * 5));
  return { rxns, commentCount };
}
function SocialHub() {
  const { user, profile, loading } = useSocial();
  const [tab, setTab] = React.useState("feed");

  if (loading) return (
    <div style={{
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      padding:"60px 0",
      color:"rgba(248,113,113,0.4)",
      fontSize:13,
      fontWeight:500
    }}>
      Loading…
    </div>
  );

  const tabs = [
    { id:"feed", label:"People" },
    { id:"couple", label:"Social" },
    { id:"mood", label:"Mood" },
    { id:"challenges", label:"⚡" },
  ];

  return (
    <div style={{ paddingBottom:8 }}>
      <div style={{ padding:"18px 20px 0", marginBottom:4 }}>
        <div style={{
          fontSize:11,
          fontWeight:600,
          letterSpacing:"0.1em",
          color:"rgba(255,255,255,0.2)",
          textTransform:"uppercase",
          marginBottom:12
        }}>
          Social
        </div>

        <div style={{
          display:"flex",
          gap:4,
          padding:"3px",
          borderRadius:14,
          background:"rgba(255,255,255,0.05)",
          border:"1px solid rgba(255,255,255,0.07)",
          overflowX:"auto",
        }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex:"0 0 auto",
                minWidth:72,
                minWidth:76,
                padding:"8px 0",
                borderRadius:11,
                fontSize:12,
                fontWeight: tab === t.id ? 700 : 500,
                background: tab === t.id ? "rgba(248,113,113,0.18)" : "transparent",
                color: tab === t.id ? "#f87171" : "rgba(255,255,255,0.4)",
                border: tab === t.id ? "1px solid rgba(248,113,113,0.22)" : "1px solid transparent",
                cursor:"pointer",
                transition:"all 0.18s ease",
                fontFamily:"inherit"
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop:16 }}>
        {tab === "feed" && <CoupleFeed />}
        {tab === "couple" && <CoupleHub />}
        {tab === "mood" && <MoodHub currentUser={user} />}
        {tab === "challenges" && <ChallengesHub />}
      </div>
    </div>
  );
}
/* ============================================================
1. REPLACE → function CoupleHub()
============================================================ */
/*
==========================================================
BONDOS — COUPLE SOCIAL SYSTEM  (FIXED v2)
PASTE GUIDE:
1. FIND   → function CoupleHub()          → REPLACE ENTIRELY
2. FIND   → function CoupleFeed()         → REPLACE ENTIRELY
3. PASTE after new CoupleFeed             → CoupleCard
4. PASTE after CoupleCard                 → CreateCoupleProfile
5. PASTE after CreateCoupleProfile        → MyCoupleProfile
DO NOT touch any other components.
==========================================================
*/



function CreateCouplePost({ coupleId }) {
const [text, setText] = React.useState("");
const [loading, setLoading] = React.useState(false);

async function createPost() {
if (!text.trim()) return;
setLoading(true);

await window.supabaseClient
.from("couple_posts")
.insert([
  {
    couple_id: coupleId,
    user_id: window.currentUser.id,
    content: text,
    visibility: "private"
  }
]);

setText("");
setLoading(false);
}

return (
<div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
<textarea
  value={text}
  onChange={(e)=>setText(e.target.value)}
  className="w-full bg-transparent border border-white/10 rounded-lg p-3 text-sm focus:outline-none"
  placeholder="Share something meaningful..."
/>
<button
  onClick={createPost}
  disabled={loading}
  className="mt-3 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition"
>
  {loading ? "Posting..." : "Post"}
</button>
</div>
);
}
function CoupleLeaderboard() {
const [couples, setCouples] = React.useState([]);
const [filter, setFilter] = React.useState("all");

React.useEffect(() => {
fetchData();
}, [filter]);

async function fetchData() {
let query = window.supabaseClient
.from("couples")
.select("*")
.order("rank_score", { ascending: false });

if (filter !== "all") {
query = query.eq("couple_type", filter);
}

const { data } = await query;
setCouples(data || []);
}

return (
<div className="space-y-4">

<select
  value={filter}
  onChange={(e)=>setFilter(e.target.value)}
  className="bg-[#0f172a] border border-white/10 rounded-xl px-4 py-2 text-sm"
>
  <option value="all">All Types</option>
  <option value="romantic">Romantic</option>
  <option value="engaged">Engaged</option>
  <option value="married">Married</option>
  <option value="long_distance">Long Distance</option>
  <option value="situationship">Situationship</option>
</select>

{couples.map((c, index) => (
  <LeaderboardRow key={c.id} couple={c} rank={index+1} />
))}

</div>
);
}
function LeaderboardRow({ couple, rank }) {
const isTop = rank <= 3;

return (
<div className={`flex justify-between items-center p-4 rounded-2xl transition
${isTop ? "bg-indigo-600/20 border border-indigo-500/40" : "bg-white/5 border border-white/10"}
`}>
<div>
  <div className="font-semibold">
    #{rank} {couple.partner_username}
  </div>
  <div className="text-xs text-gray-400">
    {couple.couple_type}
  </div>
</div>
<div className="font-bold text-indigo-400">
  {Math.round(couple.rank_score || 0)}
</div>
</div>
);
}
function PremiumTab({ active, children, ...props }) {
return (
<button
{...props}
className={`px-5 py-2 rounded-xl text-sm transition ${
  active
    ? "bg-indigo-600 text-white shadow-lg"
    : "bg-white/5 text-gray-300 hover:bg-white/10"
}`}
>
{children}
</button>
);
}
const InstaLoginPage = () => (
  <div style={{
    minHeight: "100vh",
    background: "radial-gradient(ellipse at top, #0d1424 0%, #020617 100%)",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    padding: "24px", textAlign: "center", color: "white",
    fontFamily: "sans-serif"
  }}>
    <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔗</div>
    <h1 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "12px" }}>
      Open in Safari to Continue
    </h1>
    <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)",
      marginBottom: "32px", lineHeight: "1.6" }}>
      Bond OS doesn't work inside Instagram's browser.<br/>
      Tap below to open in Safari for the full experience.
    </p>
    <button
      onClick={() => { window.location.href = "https://bondos.in"; }}
      style={{
        background: "linear-gradient(135deg, #f87171, #fb923c)",
        border: "none", borderRadius: "24px",
        padding: "14px 32px", color: "white",
        fontSize: "15px", fontWeight: "600", cursor: "pointer"
      }}
    >
      Open bondos.in in Safari →
    </button>
    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "24px" }}>
      Tap ··· then "Open in Safari" if button doesn't work
    </p>
  </div>
);
// ─────────────────────────────────────────────
// CHARACTER CHECK — constants
// ─────────────────────────────────────────────

const CC_ANIMALS = [
  { emoji: "🦁", label: "Lion" },      { emoji: "🐺", label: "Wolf" },
  { emoji: "🦊", label: "Fox" },       { emoji: "🐻", label: "Bear" },
  { emoji: "🦋", label: "Butterfly" }, { emoji: "🐬", label: "Dolphin" },
  { emoji: "🦅", label: "Eagle" },     { emoji: "🐢", label: "Turtle" },
  { emoji: "🦄", label: "Unicorn" },   { emoji: "🐙", label: "Octopus" },
  { emoji: "🦔", label: "Hedgehog" },  { emoji: "🐺", label: "Husky" },
  { emoji: "🦚", label: "Peacock" },   { emoji: "🐘", label: "Elephant" },
  { emoji: "🦝", label: "Raccoon" },   { emoji: "🐆", label: "Leopard" },
];

const CC_RATING_QUESTIONS = [
  { id: "vibe",      label: "Overall vibe",          max: 5 },
  { id: "real",      label: "Authenticity",           max: 5 },
  { id: "reliable",  label: "Reliability",            max: 7 },
  { id: "emotional", label: "Emotional availability", max: 5 },
  { id: "fun",       label: "Fun to be around",       max: 5 },
];

const CC_PILL_QUESTIONS = [
  { id: "sorted",   q: "How sorted are they day-to-day?",        options: ["Pure chaos 🌀","Pretty messy","Balanced","Very sorted","Eerily organised 📋"] },
  { id: "open",     q: "How open are they with people?",         options: ["Tells everyone everything","Pretty open","Selectively open","Guarded","Hard to read 🌫️"] },
  { id: "hype",     q: "Hype machine or truth-teller?",          options: ["Full hype 📣","Mostly encouraging","Both equally","Leans honest","Always straight 🪞"] },
  { id: "energy",   q: "Social energy when you're around them?", options: ["Drains you 🪫","Somewhat draining","Neutral","Gives energy","Endless energy ⚡"] },
  { id: "showup",   q: "When it matters most, do they show up?", options: ["Rarely 💨","Sometimes","Usually","Almost always","Every single time 📍"] },
  { id: "conflict", q: "How do they handle conflict?",           options: ["Avoids it","Gets defensive","Fixes it fast","Calm & direct","Handles it maturely 🤝"] },
  { id: "memory",   q: "Do they remember things about you?",     options: ["Forgets everything","Remembers some","Usually remembers","Remembers details","Remembers everything 🧠"] },
];

const CC_ARCHETYPES = [
  { label: "The Fixer", emoji: "🔧" },     { label: "Safe House", emoji: "🏠" },
  { label: "Chaos Agent", emoji: "🌀" },   { label: "Hype Machine", emoji: "📣" },
  { label: "The Real One", emoji: "🪞" },  { label: "Quiet Anchor", emoji: "⚓" },
  { label: "Wildcard", emoji: "🃏" },      { label: "Main Character", emoji: "🎬" },
  { label: "The Therapist", emoji: "🛋️" }, { label: "Social Glue", emoji: "🫂" },
];

const CC_GREEN_FLAGS = [
  "Remembers small things","Shows up without being asked","Low drama",
  "Keeps secrets","Checks in randomly","Defends you when you're not there",
  "Apologises first","Celebrates your wins","Respects boundaries",
];

const CC_RED_FLAGS = [
  "Goes MIA","Flaky under pressure","Makes it about them",
  "Hot and cold energy","Disappears when things get real",
  "Competitive about wrong things","Overpromises",
];

// ─────────────────────────────────────────────
// RATING ROW — dot-style
// ─────────────────────────────────────────────
function RatingInput({ max, value, onChange }) {
const isComplete = value === max;
return (
  <div style={{ display: "flex", gap: max > 5 ? 5 : 7, flexWrap: "wrap", alignItems: "center" }}>
    {Array.from({ length: max }, (_, i) => i + 1).map(n => {
      const active = n <= value;
      const bg = active
        ? isComplete ? "#10B981" : "#0A66C2"
        : "transparent";
      const border = active
        ? isComplete ? "1.5px solid #10B981" : "1.5px solid #0A66C2"
        : "1.5px solid rgba(255,255,255,0.30)";
      return (
        <button key={n} onClick={() => onChange(n === value ? 0 : n)}
          style={{
            width: max > 5 ? 30 : 34, height: max > 5 ? 30 : 34,
            borderRadius: max > 5 ? 8 : "50%",
            border,
            background: bg,
            color: active ? "#fff" : "rgba(255,255,255,0.65)",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
            transition: "all 0.14s", fontFamily: "inherit", flexShrink: 0,
            transform: active ? "scale(1.08)" : "scale(1)",
          }}>{n}</button>
      );
    })}
  </div>
);
}
function CharacterReviewForm({ targetUsername, onBack, onDone }) {
  const [ratings, setRatings]         = React.useState({});
  const [pillAnswers, setPillAnswers] = React.useState({});
  const [archetype, setArchetype]     = React.useState(null);
  const [animal, setAnimal]           = React.useState(null);
  const [greenPicks, setGreenPicks]   = React.useState([]);
  const [redPicks, setRedPicks]       = React.useState([]);
  const [quoteLine, setQuoteLine]     = React.useState("");
  const [secretLine, setSecretLine]   = React.useState("");
  const [isAnon, setIsAnon]           = React.useState(true);
  const [submitting, setSubmitting]   = React.useState(false);
  const [done, setDone]               = React.useState(false);
  const [error, setError]             = React.useState(null);

  const toggle = (arr, set, val, max) =>
    arr.includes(val)
      ? set(arr.filter(v => v !== val))
      : arr.length < max ? set([...arr, val]) : null;

  const filledRatings = CC_RATING_QUESTIONS.filter(q => (ratings[q.id] || 0) > 0).length;
  const filledPills   = CC_PILL_QUESTIONS.filter(q => pillAnswers[q.id]).length;
  const canSubmit     = filledRatings >= 3 && filledPills >= 4 && !!archetype && quoteLine.trim().length > 5;

  const progressDots = [
    filledRatings >= 3,
    filledPills   >= 4,
    !!archetype,
    !!animal,
    quoteLine.trim().length > 5,
  ];

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      // ── 1. Get session directly — works on mobile Safari ──
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      const authedUser = session?.user || window.currentUser || null;

      // ── 2. Resolve uid ──
      let uid = authedUser?.id || localStorage.getItem("bond_guest_uuid") || null;
      if (!uid) {
        uid = "guest_" + Date.now();
        localStorage.setItem("bond_guest_uuid", uid);
      }

      // ── 3. Resolve reviewer username ──
      const reviewerUsername = isAnon ? null : (
        authedUser?.user_metadata?.preferred_username ||
        authedUser?.user_metadata?.user_name ||
        localStorage.getItem("bond_username") ||
        authedUser?.email?.split("@")[0] ||
        null
      );

      // ── 4. Merge answers ──
      const answers = { ...ratings, ...pillAnswers };

      // ── 5. Build payload ──
  const payload = {
  target_username:   targetUsername,
  reviewer_id:       uid,          // ← was: isAnon ? null : (authedUser?.id || null)
  reviewer_username: isAnon ? null : reviewerUsername,
  is_anonymous:      isAnon,
  answers,
  archetype,
  animal,
  green_flags:  greenPicks,
  red_flags:    redPicks,
  quote_line:   quoteLine.trim(),
  secret_line:  secretLine.trim() || null,
  created_at:   new Date().toISOString(),
};
      // ── 6. Use session token if available, fall back to anon key ──
      const token = session?.access_token || window.SUPABASE_ANON_KEY;

      const res = await fetch(
        `${window.SUPABASE_URL}/rest/v1/character_reviews`,
        {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "apikey":        window.SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${token}`,
            "Prefer":        "return=minimal",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error("[CharacterReview] insert failed:", res.status, errText);
        throw new Error(errText);
      }

      // ── 7. Recompute metrics ──
      await updateProfileMetrics(targetUsername);

      setDone(true);

    } catch (e) {
      console.error("[CharacterReview] submit crashed:", e);
      setError("Couldn't save your review. Please try again.");
    }

    setSubmitting(false);
  };

  const card = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(10,102,194,0.35)",
    borderRadius: 20, padding: "18px 16px", marginBottom: 10,
    boxShadow: "0 0 0 1px rgba(10,102,194,0.08)",
  };

  const secTitle = (text, sub) => (
    <div style={{ marginBottom: 16 }}>
      <span style={{ fontSize: 13, fontWeight: 700,
        letterSpacing: "0.04em", color: "#ffffff" }}>{text}</span>
      {sub && (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );

  if (done) return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 24px", textAlign: "center",
      background: "radial-gradient(ellipse at top, #0d1424 0%, #020617 100%)",
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: "50%",
        background: "linear-gradient(135deg,rgba(248,113,113,0.15),rgba(251,146,60,0.1))",
        border: "2px solid rgba(248,113,113,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 42, marginBottom: 24,
        boxShadow: "0 0 40px rgba(248,113,113,0.15)",
        animation: "pulseFade 1.5s ease-out",
      }}>
        🫶
      </div>

      <div style={{ fontWeight: 900, fontSize: 24, color: "#fff",
        letterSpacing: "-0.03em", marginBottom: 8 }}>
        Sent.
      </div>

      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)",
        lineHeight: 1.8, marginBottom: 8, maxWidth: 280 }}>
        Your review of <span style={{ color: "#fca5a5", fontWeight: 700 }}>
          @{targetUsername}
        </span> is saved.
      </div>

      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16, padding: "16px 18px",
        marginBottom: 28, maxWidth: 300, width: "100%", textAlign: "left",
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>
          What they'll see from your review
        </div>
        {[
          { icon: "⭐", text: "Your ratings averaged with others" },
          { icon: "🎭", text: `Archetype: ${archetype || "—"}` },
          { icon: "🐾", text: `Animal: ${animal || "—"}` },
          { icon: greenPicks.length > 0 ? "🟢" : "🚩",
            text: `${greenPicks.length} green · ${redPicks.length} red flags` },
          { icon: "💬", text: `"${quoteLine.trim().slice(0, 40)}${quoteLine.trim().length > 40 ? "…" : ""}"` },
          { icon: isAnon ? "👻" : "👤",
            text: isAnon ? "Submitted anonymously" : `Shown as @${
              localStorage.getItem("bond_username") ||
              window.currentUser?.email?.split("@")[0] || "you"
            }` },
        ].map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{r.icon}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>
              {r.text}
            </span>
          </div>
        ))}
      </div>

      <button onClick={onDone}
        style={{
          width: "100%", maxWidth: 300, padding: "15px", borderRadius: 16, border: "none",
          background: "linear-gradient(135deg,#f87171,#fb923c)",
          color: "#fff", fontWeight: 800, fontSize: 15,
          cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 8px 24px rgba(248,113,113,0.3)", marginBottom: 12,
        }}>
        ← Back to People
      </button>

      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", lineHeight: 1.7 }}>
        Reviews are aggregated — no single review<br />is shown raw to the person.
      </div>

      <style>{`
        @keyframes pulseFade {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );

  return (
    <div style={{ padding: "16px 16px 48px" }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
        <button onClick={onBack}
          style={{ width: 34, height: 34, borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.09)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.45)", fontSize: 15,
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0, fontFamily: "inherit" }}>
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em", color: "#fff" }}>
            Character Check
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>
            reviewing @{targetUsername} · {isAnon ? "anonymous" : "as yourself"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {progressDots.map((filled, i) => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: "50%",
              background: filled ? "#f87171" : "rgba(255,255,255,0.12)",
              transition: "background 0.3s",
            }} />
          ))}
        </div>
      </div>

      {/* ── SECTION 1: RATINGS ── */}
      <div style={card}>
        {secTitle("Ratings", "tap a number — tap again to clear")}
        {CC_RATING_QUESTIONS.map(q => (
          <div key={q.id} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{q.label}</div>
              {(ratings[q.id] || 0) > 0 && (
                <span style={{ fontSize: 11, fontWeight: 800, color: "#f87171" }}>
                  {ratings[q.id]}/{q.max}
                </span>
              )}
            </div>
            <RatingInput
              max={q.max}
              value={ratings[q.id] || 0}
              onChange={v => setRatings(p => ({ ...p, [q.id]: v }))}
            />
          </div>
        ))}
      </div>

      {/* ── SECTION 2: PERSONALITY PILLS ── */}
      <div style={card}>
        {secTitle("Their personality", "pick one per question")}
        {CC_PILL_QUESTIONS.map(q => (
          <div key={q.id} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff",
              marginBottom: 9, lineHeight: 1.3 }}>
              {q.q}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {q.options.map(opt => {
                const active = pillAnswers[q.id] === opt;
                return (
                  <button key={opt}
                    onClick={() => setPillAnswers(p => ({ ...p, [q.id]: active ? undefined : opt }))}
                    style={{
                      padding: "6px 12px", borderRadius: 999, fontSize: 12,
                      fontFamily: "inherit", cursor: "pointer", transition: "all 0.14s",
                      border: active
                        ? "1px solid rgba(248,113,113,0.45)"
                        : "1px solid rgba(255,255,255,0.08)",
                      background: active ? "rgba(248,113,113,0.11)" : "rgba(255,255,255,0.025)",
                      color: active ? "#fca5a5" : "rgba(255,255,255,0.45)",
                      fontWeight: active ? 700 : 400,
                    }}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ fontSize: 10, color: filledPills >= 4
          ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.2)",
          marginTop: 4, transition: "color 0.3s" }}>
          {filledPills}/7 answered {filledPills >= 4 ? "✓" : `· need ${4 - filledPills} more`}
        </div>
      </div>

      {/* ── SECTION 3: ARCHETYPE ── */}
      <div style={card}>
        {secTitle("Pick their archetype", "the role they play in people's lives")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          {CC_ARCHETYPES.map(a => {
            const active = archetype === a.label;
            return (
              <button key={a.label}
                onClick={() => setArchetype(active ? null : a.label)}
                style={{
                  padding: "11px 10px", borderRadius: 14, textAlign: "left",
                  cursor: "pointer", transition: "all 0.14s", fontFamily: "inherit",
                  border: active
                    ? "1px solid rgba(248,113,113,0.4)"
                    : "1px solid rgba(255,255,255,0.07)",
                  background: active ? "rgba(248,113,113,0.09)" : "rgba(255,255,255,0.025)",
                }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{a.emoji}</div>
                <div style={{ fontSize: 12, lineHeight: 1.2,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#fca5a5" : "rgba(255,255,255,0.5)" }}>
                  {a.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 4: ANIMAL ── */}
      <div style={card}>
        {secTitle("Pick the animal they most resemble",
          "vibes, energy, presence — go with your gut")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 }}>
          {CC_ANIMALS.map(a => {
            const active = animal === a.label;
            return (
              <button key={a.label}
                onClick={() => setAnimal(active ? null : a.label)}
                style={{
                  padding: "10px 6px", borderRadius: 13, textAlign: "center",
                  cursor: "pointer", transition: "all 0.14s", fontFamily: "inherit",
                  border: active
                    ? "1px solid rgba(248,113,113,0.4)"
                    : "1px solid rgba(255,255,255,0.07)",
                  background: active ? "rgba(248,113,113,0.09)" : "rgba(255,255,255,0.025)",
                }}>
                <div style={{ fontSize: 22, marginBottom: 3 }}>{a.emoji}</div>
                <div style={{ fontSize: 10, lineHeight: 1.2,
                  fontWeight: active ? 700 : 400,
                  color: active ? "#fca5a5" : "rgba(255,255,255,0.35)" }}>
                  {a.label}
                </div>
              </button>
            );
          })}
        </div>
        {animal && (
          <div style={{ fontSize: 11, color: "rgba(52,211,153,0.6)",
            marginTop: 8, textAlign: "center" }}>
            ✓ {animal} selected
          </div>
        )}
      </div>

      {/* ── SECTION 5: FLAGS ── */}
      <div style={card}>
        {secTitle("Flag board")}
        <div style={{ fontSize: 11, fontWeight: 700,
          color: "rgba(52,211,153,0.5)", letterSpacing: "0.08em",
          textTransform: "uppercase", marginBottom: 8 }}>
          Green flags · pick up to 3
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          {CC_GREEN_FLAGS.map(f => {
            const active = greenPicks.includes(f);
            const atMax  = greenPicks.length >= 3 && !active;
            return (
              <button key={f}
                onClick={() => toggle(greenPicks, setGreenPicks, f, 3)}
                disabled={atMax}
                style={{
                  padding: "6px 11px", borderRadius: 999,
                  fontSize: 12, fontFamily: "inherit",
                  cursor: atMax ? "default" : "pointer",
                  transition: "all 0.14s", opacity: atMax ? 0.4 : 1,
                  border: active
                    ? "1px solid rgba(52,211,153,0.4)"
                    : "1px solid rgba(255,255,255,0.07)",
                  background: active ? "rgba(52,211,153,0.09)" : "rgba(255,255,255,0.025)",
                  color: active ? "#6ee7b7" : "rgba(255,255,255,0.4)",
                  fontWeight: active ? 700 : 400,
                }}>
                🟢 {f}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700,
          color: "rgba(248,113,113,0.4)", letterSpacing: "0.08em",
          textTransform: "uppercase", marginBottom: 8 }}>
          Red flags · optional, up to 2
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {CC_RED_FLAGS.map(f => {
            const active = redPicks.includes(f);
            const atMax  = redPicks.length >= 2 && !active;
            return (
              <button key={f}
                onClick={() => toggle(redPicks, setRedPicks, f, 2)}
                disabled={atMax}
                style={{
                  padding: "6px 11px", borderRadius: 999,
                  fontSize: 12, fontFamily: "inherit",
                  cursor: atMax ? "default" : "pointer",
                  transition: "all 0.14s", opacity: atMax ? 0.4 : 1,
                  border: active
                    ? "1px solid rgba(248,113,113,0.38)"
                    : "1px solid rgba(255,255,255,0.07)",
                  background: active ? "rgba(248,113,113,0.09)" : "rgba(255,255,255,0.025)",
                  color: active ? "#fca5a5" : "rgba(255,255,255,0.4)",
                  fontWeight: active ? 700 : 400,
                }}>
                🔴 {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 6: TEXT QUESTIONS ── */}
      <div style={card}>
        {secTitle("In your words")}

        <div style={{ fontSize: 13, fontWeight: 600,
          color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
          Describe them to a stranger in one line *
        </div>
        <textarea
          rows={2} maxLength={100} value={quoteLine}
          onChange={e => setQuoteLine(e.target.value)}
          placeholder="e.g. the person who fixes things before you even notice…"
          style={{ width: "100%", boxSizing: "border-box",
            resize: "none", outline: "none", fontFamily: "inherit",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${quoteLine.trim().length > 5
              ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 12, padding: "11px 13px",
            color: "#fff", fontSize: 13, lineHeight: 1.5,
            transition: "border-color 0.2s" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between",
          marginTop: 3, marginBottom: 18 }}>
          <span style={{ fontSize: 10,
            color: quoteLine.trim().length > 5
              ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.2)" }}>
            {quoteLine.trim().length > 5 ? "✓ good" : `need ${6 - quoteLine.trim().length} more chars`}
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>
            {quoteLine.length}/100
          </span>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600,
          color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
          Something only close people would know
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginLeft: 7 }}>
            optional
          </span>
        </div>
        <textarea
          rows={2} maxLength={150} value={secretLine}
          onChange={e => setSecretLine(e.target.value)}
          placeholder="e.g. way more sensitive than they let on…"
          style={{ width: "100%", boxSizing: "border-box",
            resize: "none", outline: "none", fontFamily: "inherit",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: "11px 13px",
            color: "#fff", fontSize: 13, lineHeight: 1.5 }}
        />
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)",
          textAlign: "right", marginTop: 3 }}>
          {secretLine.length}/150
        </div>
      </div>

      {/* ── SECTION 7: SUBMIT AS ── */}
      <div style={card}>
        {secTitle("Submit as")}
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { val: true,  icon: "👻", label: "Anonymous",
              sub: "they'll never know it's you" },
            { val: false, icon: "👤",
              label: `As @${localStorage.getItem("bond_username") || window.currentUser?.email?.split("@")[0] || "you"}`,
              sub: "shown on their profile" },
          ].map(o => (
            <button key={String(o.val)} onClick={() => setIsAnon(o.val)}
              style={{
                flex: 1, padding: "12px 10px", borderRadius: 14,
                textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.15s",
                border: isAnon === o.val
                  ? "1px solid rgba(248,113,113,0.45)"
                  : "1px solid rgba(255,255,255,0.07)",
                background: isAnon === o.val
                  ? "rgba(248,113,113,0.09)"
                  : "rgba(255,255,255,0.025)",
              }}>
              <div style={{ fontSize: 20, marginBottom: 5 }}>{o.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700,
                color: isAnon === o.val ? "#fca5a5" : "rgba(255,255,255,0.55)",
                marginBottom: 3 }}>
                {o.label}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)" }}>
                {o.sub}
              </div>
              {isAnon === o.val && (
                <div style={{ marginTop: 6, fontSize: 9, fontWeight: 700,
                  letterSpacing: "0.08em", color: "rgba(248,113,113,0.6)",
                  textTransform: "uppercase" }}>
                  ✓ selected
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div style={{ fontSize: 12, color: "#fca5a5", textAlign: "center",
          marginBottom: 12, padding: "10px", borderRadius: 10,
          background: "rgba(248,113,113,0.08)",
          border: "1px solid rgba(248,113,113,0.2)" }}>
          {error}
        </div>
      )}

      {/* ── SUBMIT ── */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        style={{
          width: "100%", padding: "15px", borderRadius: 16, border: "none",
          fontWeight: 800, fontSize: 15, fontFamily: "inherit",
          cursor: canSubmit && !submitting ? "pointer" : "default",
          transition: "all 0.2s",
          background: canSubmit
            ? "linear-gradient(135deg,#f87171,#fb923c)"
            : "rgba(255,255,255,0.06)",
          color: canSubmit ? "#fff" : "rgba(255,255,255,0.25)",
          boxShadow: canSubmit ? "0 8px 24px rgba(248,113,113,0.25)" : "none",
          opacity: submitting ? 0.7 : 1,
        }}>
        {submitting ? "Saving…" : "Submit Character Check 🫶"}
      </button>

      {/* ── WHAT'S MISSING ── */}
      {!canSubmit && (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)",
          textAlign: "center", marginTop: 10, lineHeight: 2 }}>
          {[
            filledRatings < 3 && `${3 - filledRatings} more rating${3 - filledRatings > 1 ? "s" : ""}`,
            filledPills < 4   && `${4 - filledPills} more personality answer${4 - filledPills > 1 ? "s" : ""}`,
            !archetype        && "pick an archetype",
            quoteLine.trim().length < 6 && "write the one-liner (min 6 chars)",
          ].filter(Boolean).join("  ·  ")}
        </div>
      )}

    </div>
  );
}
function ReviewerSheet({ username, onClose }) {
  const [reviews, setReviews]       = React.useState([]);
  const [loading, setLoading]       = React.useState(true);
  const [openReview, setOpenReview] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await window.supabaseClient
        .from("character_reviews")
        .select("*")
        .eq("target_username", username)
        .order("created_at", { ascending: false });
      if (mounted) { setReviews(data || []); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [username]);

  const getAnimalEmoji = (label) => {
    if (!label) return null;
    const CC_ANIMALS = [
      { emoji:"🦁",label:"Lion"},{ emoji:"🐺",label:"Wolf"},{ emoji:"🦊",label:"Fox"},
      { emoji:"🐻",label:"Bear"},{ emoji:"🦋",label:"Butterfly"},{ emoji:"🐬",label:"Dolphin"},
      { emoji:"🦅",label:"Eagle"},{ emoji:"🐢",label:"Turtle"},{ emoji:"🦄",label:"Unicorn"},
      { emoji:"🐙",label:"Octopus"},{ emoji:"🦔",label:"Hedgehog"},{ emoji:"🦚",label:"Peacock"},
      { emoji:"🐘",label:"Elephant"},{ emoji:"🦝",label:"Raccoon"},{ emoji:"🐆",label:"Leopard"},
    ];
    return CC_ANIMALS.find(a => a.label.toLowerCase() === label.toLowerCase())?.emoji || "🐾";
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1500,
        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center" }}>

      {/* sheet */}
      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, maxHeight: "80vh",
          background: "#0e0e12", borderRadius: "22px 22px 0 0",
          border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none",
          display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* handle + header */}
        <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.12)" }} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#fff" }}>
            👥 {reviews.length} review{reviews.length !== 1 ? "s" : ""} received
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
            {reviews.filter(r => !r.is_anonymous).length} named ·{" "}
            {reviews.filter(r => r.is_anonymous).length} anonymous
          </div>
        </div>

        {/* list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "32px 0",
              color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Loading…</div>
          )}
          {!loading && reviews.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🫶</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
                No reviews yet
              </div>
            </div>
          )}
          {reviews.map((r, i) => {
            const animalEmoji = getAnimalEmoji(r.animal);
            return (
              <button key={r.id || i}
                onClick={() => setOpenReview(openReview === i ? null : i)}
                style={{ width: "100%", display: "flex", alignItems: "center",
                  gap: 12, padding: "12px 18px", background: "transparent",
                  border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>

                {/* avatar */}
                <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                  background: r.is_anonymous
                    ? "rgba(255,255,255,0.07)"
                    : "linear-gradient(135deg,#f87171,#fb923c)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: r.is_anonymous ? 16 : 14, fontWeight: 800, color: "#fff" }}>
                  {r.is_anonymous ? "👤" : (r.reviewer_username?.[0]?.toUpperCase() || "?")}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700,
                    color: r.is_anonymous ? "rgba(255,255,255,0.4)" : "#fff" }}>
                    {r.is_anonymous ? "Anonymous" : `@${r.reviewer_username}`}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                    {r.archetype && (
                      <span style={{ fontSize: 10, color: "rgba(248,113,113,0.7)" }}>
                        🎭 {r.archetype}
                      </span>
                    )}
                    {animalEmoji && r.animal && (
                      <span style={{ fontSize: 11 }}>{animalEmoji} {r.animal}</span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                    {new Date(r.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(248,113,113,0.5)", marginTop: 3 }}>
                    {openReview === i ? "▲" : "▼"}
                  </div>
                </div>
              </button>
            );
          })}

          {/* expanded review */}
          {openReview !== null && reviews[openReview] && (() => {
            const r = reviews[openReview];
            const CC_RATING_QUESTIONS = [
              { id:"vibe", label:"Vibe", max:5 },
              { id:"real", label:"Authenticity", max:5 },
              { id:"reliable", label:"Reliability", max:7 },
              { id:"emotional", label:"Emotional", max:5 },
              { id:"fun", label:"Fun", max:5 },
            ];
            return (
              <div style={{ margin: "8px 18px 16px",
                background: "rgba(248,113,113,0.04)",
                border: "1px solid rgba(248,113,113,0.12)",
                borderRadius: 16, padding: "14px 16px" }}>

                {/* quote */}
                {r.quote_line && (
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)",
                    fontStyle: "italic", lineHeight: 1.6, marginBottom: 12,
                    borderLeft: "2px solid rgba(248,113,113,0.3)", paddingLeft: 10 }}>
                    "{r.quote_line}"
                  </div>
                )}

                {/* ratings */}
                {CC_RATING_QUESTIONS.some(q => (r.answers||{})[q.id] > 0) && (
                  <div style={{ marginBottom: 12 }}>
                    {CC_RATING_QUESTIONS.map(q => {
                      const val = (r.answers||{})[q.id] || 0;
                      if (!val) return null;
                      return (
                        <div key={q.id}
                          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)",
                            width: 75, flexShrink: 0 }}>{q.label}</span>
                          <div style={{ display: "flex", gap: 2 }}>
                            {Array.from({length: q.max}, (_, idx) => (
                              <div key={idx} style={{ width: 10, height: 10, borderRadius: 2,
                                background: idx < val ? "#f87171" : "rgba(255,255,255,0.08)" }} />
                            ))}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700,
                            color: "#f87171" }}>{val}/{q.max}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* flags */}
                {((r.green_flags?.length > 0) || (r.red_flags?.length > 0)) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                    {(r.green_flags||[]).map(f => (
                      <span key={f} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999,
                        background: "rgba(52,211,153,0.08)", color: "rgba(52,211,153,0.8)" }}>
                        🟢 {f}
                      </span>
                    ))}
                    {(r.red_flags||[]).map(f => (
                      <span key={f} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999,
                        background: "rgba(248,113,113,0.08)", color: "rgba(248,113,113,0.7)" }}>
                        🔴 {f}
                      </span>
                    ))}
                  </div>
                )}

                {r.secret_line && (
                  <div style={{ fontSize: 11, color: "rgba(196,181,253,0.6)",
                    fontStyle: "italic", lineHeight: 1.5,
                    background: "rgba(99,102,241,0.06)",
                    borderRadius: 10, padding: "8px 10px" }}>
                    🔮 {r.secret_line}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <button onClick={onClose}
          style={{ margin: "0 18px 24px", padding: "12px", borderRadius: 14,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit" }}>
          Close
        </button>
      </div>
    </div>
  );
}
function CreateProfileScreen({ existingProfile, onSaved, onBack }) {
  const isEdit = !!existingProfile;

  const [displayName, setDisplayName]   = React.useState(existingProfile?.display_name || "");
  const [bio, setBio]                   = React.useState(existingProfile?.bio || "");
  const [college, setCollege]           = React.useState(existingProfile?.college || "");
  const [city, setCity]                 = React.useState(existingProfile?.city || "");
  const [oneWord, setOneWord]           = React.useState(existingProfile?.one_word || "");
  const [selfArchetype, setSelfArchetype] = React.useState(existingProfile?.self_archetype || null);
  const [selfAnimal, setSelfAnimal]     = React.useState(existingProfile?.self_animal || null);
  const [selfRatings, setSelfRatings]   = React.useState(existingProfile?.self_ratings || {});
  const [visibility, setVisibility]     = React.useState(existingProfile?.review_visibility || "everyone");
  const [avatarUrl, setAvatarUrl]       = React.useState(existingProfile?.avatar_url || null);
  const [avatarPreview, setAvatarPreview] = React.useState(existingProfile?.avatar_url || null);
  const [uploading, setUploading]       = React.useState(false);
  const [saving, setSaving]             = React.useState(false);
  const [error, setError]               = React.useState(null);
  const fileRef                         = React.useRef(null);

  const uid = window.currentUser?.id;
  const username = window.currentUser?.user_metadata?.username
    || localStorage.getItem("bond_username") || "you";

  const canSave = displayName.trim().length > 0;

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      let toUpload = file;
      if (typeof compressImage === "function") {
        try { toUpload = await compressImage(file, 400, 0.80); } catch (_) {}
      }
      const url = await uploadToStorage("avatars", toUpload, "people/");
      if (url) {
        setAvatarUrl(url);
      } else {
        const reader = new FileReader();
        reader.onload = ev => setAvatarUrl(ev.target.result);
        reader.readAsDataURL(file);
      }
    } catch (err) { console.warn("[CreateProfile] upload failed", err); }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true); setError(null);
    const payload = {
      display_name:      displayName.trim(),
      bio:               bio.trim(),
      college:           college.trim(),
      city:              city.trim(),
      one_word:          oneWord.trim(),
      self_archetype:    selfArchetype,
      self_animal:       selfAnimal,
      self_ratings:      selfRatings,
      review_visibility: visibility,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    };
    try {
      if (uid) {
        const { error: dbErr } = await window.supabaseClient
          .from("profiles").update(payload).eq("id", uid);
        if (dbErr) throw dbErr;
      }
      localStorage.setItem("bond_cc_profile", JSON.stringify({ username, ...payload }));
      onSaved({ username, ...payload });
    } catch (err) {
      setError("Couldn't save — try again");
    }
    setSaving(false);
  };

  const card = {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 20, padding: "18px 16px", marginBottom: 10,
  };

const inp = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,255,255,0.09)",
  border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 12, padding: "11px 13px",
    color: "#fff", fontSize: 13, outline: "none",
    fontFamily: "inherit", lineHeight: 1.4,
  };

  const secLabel = (icon, text, sub) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>{text}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)",
        paddingLeft: 19, marginTop: 3 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: "16px 16px 48px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
        {onBack && (
          <button onClick={onBack}
            style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0,
background: "rgba(255,255,255,0.08)",
border: "1px solid rgba(255,255,255,0.13)",
              color: "rgba(255,255,255,0.45)", fontSize: 15,
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", fontFamily: "inherit" }}>←</button>
        )}
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em", color: "#fff" }}>
            {isEdit ? "Edit Profile" : "Create Your Profile"}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 2 }}>
            {isEdit
              ? "update how you appear to others"
              : "people who know you will review you based on this"}
          </div>
        </div>
      </div>

      {/* ── SECTION 1: Photo + name ── */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 16 }}>
        {/* Avatar */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div onClick={() => fileRef.current?.click()}
            style={{ width: 76, height: 76, borderRadius: "50%", cursor: "pointer",
              background: avatarPreview
                ? "transparent"
                : "linear-gradient(135deg,rgba(248,113,113,0.2),rgba(251,146,60,0.1))",
              border: avatarPreview
                ? "2.5px solid rgba(248,113,113,0.45)"
                : "2px dashed rgba(248,113,113,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
              boxShadow: avatarPreview ? "0 4px 16px rgba(248,113,113,0.25)" : "none" }}>
            {avatarPreview
              ? <img src={avatarPreview} alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 24, opacity: 0.4 }}>📷</span>
            }
          </div>
          {uploading && (
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%",
              background: "rgba(0,0,0,0.65)", display: "flex",
              alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 18, height: 18,
                border: "2px solid rgba(255,255,255,0.15)",
                borderTopColor: "#f87171", borderRadius: "50%",
                animation: "spin 0.7s linear infinite" }} />
            </div>
          )}
          <div onClick={() => fileRef.current?.click()}
            style={{ position: "absolute", bottom: 1, right: 1,
              width: 22, height: 22, borderRadius: "50%",
              background: "linear-gradient(135deg,#f87171,#fb923c)",
              border: "2px solid #0d0d0f",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 9 }}>✏️</div>
          <input ref={fileRef} type="file" accept="image/*"
            onChange={handlePhotoChange}
            style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }} />
        </div>

        {/* Name + username */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginBottom: 6 }}>
            Display name *
          </div>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            placeholder="How you want to be known" maxLength={40}
            style={{ ...inp, padding: "9px 12px", marginBottom: 8 }} />
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)",
            padding: "6px 10px", borderRadius: 8,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)" }}>
            @{username}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Bio + context ── */}
      <div style={card}>
        {secLabel("✍️", "About you")}

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 7 }}>
          One-line bio
        </div>
        <textarea rows={2} maxLength={120} value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="design student, overthinker, good at playlists…"
          style={{ ...inp, resize: "none", marginBottom: 4 }} />
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)",
          textAlign: "right", marginBottom: 14 }}>{bio.length}/120</div>

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 7 }}>
          One word that defines you
        </div>
        <input value={oneWord} onChange={e => setOneWord(e.target.value)}
          placeholder="e.g. chaotic, loyal, curious…" maxLength={20}
          style={{ ...inp, marginBottom: 14 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginBottom: 5 }}>
              College / Company
            </div>
            <input value={college} onChange={e => setCollege(e.target.value)}
              placeholder="NMIMS, Google…" maxLength={50}
              style={{ ...inp, padding: "9px 11px", fontSize: 12 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginBottom: 5 }}>
              City
            </div>
            <input value={city} onChange={e => setCity(e.target.value)}
              placeholder="Mumbai…" maxLength={30}
              style={{ ...inp, padding: "9px 11px", fontSize: 12 }} />
          </div>
        </div>
      </div>

      {/* ── SECTION 3: How you see yourself ── */}
      <div style={{ ...card, background: "rgba(99,102,241,0.04)",
        border: "1px solid rgba(99,102,241,0.1)" }}>
        {secLabel("🪞", "How you see yourself",
          "reviewers will see this vs what they say about you")}

        {/* Self archetype */}
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 9 }}>
          Which archetype do you think you are?
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 16 }}>
          {CC_ARCHETYPES.map(a => {
            const active = selfArchetype === a.label;
            return (
              <button key={a.label}
                onClick={() => setSelfArchetype(active ? null : a.label)}
                style={{ padding: "9px 6px", borderRadius: 13, textAlign: "center",
                  border: active ? "1px solid rgba(99,102,241,0.45)" : "1px solid rgba(255,255,255,0.07)",
                  background: active ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.025)",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.14s" }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{a.emoji}</div>
                <div style={{ fontSize: 10, fontWeight: active ? 700 : 400,
                  color: active ? "rgba(165,180,252,0.9)" : "rgba(255,255,255,0.4)",
                  lineHeight: 1.2 }}>{a.label}</div>
              </button>
            );
          })}
        </div>

        {/* Self animal */}
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 9 }}>
          Pick the animal that's most you
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}>
          {CC_ANIMALS.map(a => {
            const active = selfAnimal === a.label;
            return (
              <button key={a.label}
                onClick={() => setSelfAnimal(active ? null : a.label)}
                style={{ padding: "8px 4px", borderRadius: 11, textAlign: "center",
                  border: active ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.06)",
                  background: active ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.025)",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.14s" }}>
                <div style={{ fontSize: 20, marginBottom: 2 }}>{a.emoji}</div>
                <div style={{ fontSize: 9, fontWeight: active ? 700 : 400,
                  color: active ? "rgba(165,180,252,0.9)" : "rgba(255,255,255,0.3)" }}>
                  {a.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Self ratings */}
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
          Rate yourself honestly
        </div>
        {CC_RATING_QUESTIONS.map(q => (
          <div key={q.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 7 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)",
                display: "flex", alignItems: "center", gap: 5 }}>
                <span>{q.emoji}</span><span>{q.label}</span>
              </div>
              {selfRatings[q.id] > 0 && (
                <span style={{ fontSize: 11, fontWeight: 800,
                  color: "rgba(165,180,252,0.8)" }}>
                  {selfRatings[q.id]}/{q.max}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: q.max > 5 ? 5 : 7, flexWrap: "wrap" }}>
              {Array.from({ length: q.max }, (_, i) => i + 1).map(n => {
                const active = n <= (selfRatings[q.id] || 0);
                return (
                  <button key={n}
                    onClick={() => setSelfRatings(p => ({
                      ...p, [q.id]: p[q.id] === n ? 0 : n
                    }))}
                    style={{ width: q.max > 5 ? 28 : 32, height: q.max > 5 ? 28 : 32,
                      borderRadius: q.max > 5 ? 8 : "50%",
                      border: active
                        ? "1.5px solid rgba(99,102,241,0.5)"
                        : "1.5px solid rgba(255,255,255,0.09)",
                      background: active
                        ? "linear-gradient(135deg,#6366f1,#818cf8)"
                        : "rgba(255,255,255,0.03)",
                      color: active ? "#fff" : "rgba(255,255,255,0.3)",
                      fontWeight: 700, fontSize: 12,
                      cursor: "pointer", transition: "all 0.14s",
                      fontFamily: "inherit", flexShrink: 0 }}>{n}</button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── SECTION 4: Visibility ── */}
      <div style={card}>
        {secLabel("🔐", "Who can review you")}
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { val: "everyone", icon: "🌐", label: "Everyone on BondOS", sub: "open" },
            { val: "friends",  icon: "👥", label: "People you follow",  sub: "restricted" },
          ].map(o => (
            <button key={o.val} onClick={() => setVisibility(o.val)}
              style={{ flex: 1, padding: "12px 10px", borderRadius: 14, textAlign: "left",
                border: visibility === o.val
                  ? "1px solid rgba(248,113,113,0.4)"
                  : "1px solid rgba(255,255,255,0.07)",
                background: visibility === o.val
                  ? "rgba(248,113,113,0.08)"
                  : "rgba(255,255,255,0.025)",
                cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{o.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700,
                color: visibility === o.val ? "#fca5a5" : "rgba(255,255,255,0.5)" }}>
                {o.label}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 2 }}>
                {o.sub}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Info note */}
      <div style={{ background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", lineHeight: 1.8 }}>
          🔒 All reviews are anonymous by default<br />
          🌱 Profile unlocks after <strong style={{ color: "rgba(255,255,255,0.38)" }}>3 reviews</strong><br />
          🪞 Your self-ratings will show alongside what others say
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: "#fca5a5",
          textAlign: "center", marginBottom: 10 }}>{error}</div>
      )}

      <button onClick={handleSave} disabled={!canSave || saving || uploading}
        style={{ width: "100%", padding: "15px", borderRadius: 16, border: "none",
          background: canSave && !uploading
            ? "linear-gradient(135deg,#f87171,#fb923c)"
            : "rgba(255,255,255,0.06)",
          color: canSave && !uploading ? "#fff" : "rgba(255,255,255,0.25)",
          fontWeight: 800, fontSize: 15,
          cursor: canSave && !uploading ? "pointer" : "default",
          fontFamily: "inherit", transition: "all 0.2s",
          boxShadow: canSave ? "0 8px 24px rgba(248,113,113,0.22)" : "none" }}>
        {uploading ? "Uploading photo…"
          : saving   ? "Saving…"
          : isEdit   ? "Save Changes ✓"
          : "Create Profile →"}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function MyCharacterCard({ username, onOpenCreate, onOpenEdit, onViewProfile }) {
  const [showReviewers, setShowReviewers] = React.useState(false);
  const [profile, setProfile]         = React.useState(null);
  const [reviewCount, setReviewCount] = React.useState(0);
  const [avgRating, setAvgRating]     = React.useState(0);
  const [loading, setLoading]         = React.useState(true);
  const [activeFPCount, setActiveFPCount] = React.useState(0);
 
  React.useEffect(() => {
    if (!username) return;
    let mounted = true;
    (async () => {
      const { count } = await window.supabaseClient
        .from("fp_sessions")
        .select("id", { count: "exact", head: true })
        .eq("target_username", username)
        .eq("status", "active");
      if (mounted) setActiveFPCount(count || 0);
    })();
    return () => { mounted = false; };
  }, [username]);
 
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = localStorage.getItem("bond_cc_profile");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (mounted) setProfile(parsed);
        }
        const uid = window.currentUser?.id;
        if (uid) {
          const { data: p } = await window.supabaseClient
            .from("profiles")
            .select("id,username,display_name,bio,college,city,review_visibility,reviews_count,avg_rating")
            .eq("id", uid)
            .maybeSingle();
          if (mounted && p?.display_name) {
            setProfile(p);
            setReviewCount(p.reviews_count || 0);
            setAvgRating(p.avg_rating || 0);
          }
        }
        if (username && !reviewCount) {
          try {
            const { count } = await window.supabaseClient
              .from("character_reviews")
              .select("id", { count: "exact", head: true })
              .eq("target_username", username)
            if (mounted) setReviewCount(count || 0);
          } catch (_) {}
        }
      } catch (e) {
        console.warn("[MyCharacterCard]", e);
      }
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [username]);
 
  const handleShare = () => {
    const url = `${window.location.origin}/people/${username}`;
    if (navigator.share) navigator.share({ url, title: "Review me on BondOS" });
    else if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      alert("Link copied! Share it to get reviews.");
    }
  };
 
  if (loading) return (
    <div style={{ height: 72, background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16,
      marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.08)",
        borderTopColor: "#f87171", borderRadius: "50%",
        animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
 
  // No profile yet
  if (!profile?.display_name) return (
    <div style={{ background: "rgba(248,113,113,0.04)",
      border: "1px dashed rgba(248,113,113,0.2)", borderRadius: 18,
      padding: "18px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
          background: "rgba(248,113,113,0.15)", border: "1.5px dashed rgba(248,113,113,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
          👤
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 3 }}>
            You're not on the map yet
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
            Create a profile so people can review you
          </div>
        </div>
        <button onClick={onOpenCreate}
          style={{ padding: "9px 14px", borderRadius: 12, border: "none", flexShrink: 0,
            background: "linear-gradient(135deg,#f87171,#fb923c)",
            color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
            fontFamily: "inherit", whiteSpace: "nowrap" }}>
          Create →
        </button>
      </div>
    </div>
  );
 
  const letter = (profile.display_name || "?")[0].toUpperCase();
 
  return (
    <div style={{ background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18,
      overflow: "hidden", marginBottom: 14 }}>
      <div style={{ height: 2, background: "linear-gradient(90deg,#f87171,#fb923c,rgba(251,191,36,0.5))" }} />
      <div style={{ padding: "13px 15px" }}>
 
        {/* top row: avatar + name + edit */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#f87171,#fb923c)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 17, color: "#fff" }}>
            {letter}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#fff",
              letterSpacing: "-0.01em", marginBottom: 3 }}>{profile.display_name}</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>@{username}</span>
              {profile.college && (
                <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
                  color: "rgba(255,255,255,0.35)" }}>🎓 {profile.college}</span>
              )}
            </div>
            {/* avg rating inline */}
            {avgRating > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: "#fbbf24" }}>★</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(251,191,36,0.85)" }}>
                  {avgRating.toFixed(1)}
                </span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>/5</span>
              </div>
            )}
          </div>
          <button onClick={onOpenEdit}
            style={{ padding: "5px 10px", borderRadius: 9, fontSize: 11, fontWeight: 600,
              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
        </div>
 
        {profile.bio && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontStyle: "italic",
            lineHeight: 1.5, marginBottom: 10,
            borderLeft: "2px solid rgba(248,113,113,0.2)", paddingLeft: 8 }}>
            {profile.bio}
          </div>
        )}
 
        {/* bottom action row — SINGLE row, no duplicates */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowReviewers(true)}
            style={{ flex: 1, padding: "8px 10px", borderRadius: 10,
              border: "1px solid rgba(248,113,113,0.2)",
              background: "rgba(248,113,113,0.06)",
              color: "#fca5a5", fontWeight: 700, fontSize: 12,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6 }}>
            👥 <span style={{ fontWeight: 800 }}>{reviewCount}</span> review{reviewCount !== 1 ? "s" : ""} →
          </button>
          <button onClick={handleShare}
            style={{ padding: "8px 12px", borderRadius: 10,
              border: "1px solid rgba(99,102,241,0.3)",
              background: "rgba(99,102,241,0.08)", color: "rgba(165,180,252,0.9)",
              fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            🔗
          </button>
        </div>
 
        {/* active FP badge */}
        {activeFPCount > 0 && (
          <div onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("bond_open_2fp_hub")); }}
            style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8,
              padding: "8px 12px", borderRadius: 12, cursor: "pointer",
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
            <span style={{ fontSize: 14 }}>⚔️</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5", flex: 1 }}>
              {activeFPCount} case{activeFPCount > 1 ? "s" : ""} filed against you
            </span>
            <span style={{ fontSize: 11, color: "rgba(248,113,113,0.5)" }}>→</span>
          </div>
        )}
      </div>
 
      {/* reviewer bottom sheet */}
      {showReviewers && (
        <ReviewerSheet
          username={username}
          onClose={() => setShowReviewers(false)}
        />
      )}
    </div>
  );
}
// ── FPVoteBar ──
function FPVoteBar({ sessionId, compact = false }) {
  const [votes, setVotes] = React.useState({ challenger: 0, defender: 0 });
  const [myVote, setMyVote] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!sessionId) return;
    let mounted = true;
    (async () => {
      try {
        const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid") || localStorage.getItem("bond_anon_id");

        const { data: allVotes } = await window.supabaseClient
          .from("fp_votes")
          .select("voter_id, voted_for")
          .eq("session_id", sessionId);

        if (!mounted) return;

        let c = 0, d = 0;
        (allVotes || []).forEach(v => {
          if (v.voted_for === "challenger") c++;
          else if (v.voted_for === "defender") d++;
          if (uid && v.voter_id === uid) setMyVote(v.voted_for);
        });

        setVotes({ challenger: c, defender: d });
      } catch (e) {
        console.warn("[FPVoteBar] load failed:", e);
      }
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [sessionId]);

  const handleVote = async (side) => {
    if (!sessionId) return;
    if (myVote === side) return; // already voted same side

const uid = window.currentUser?.id || ensureGuestUUID();

    // optimistic UI
    const prevVote = myVote;
    setMyVote(side);
    setVotes(prev => {
      const next = { ...prev };
      if (prevVote) next[prevVote] = Math.max(0, next[prevVote] - 1);
      next[side] = (next[side] || 0) + 1;
      return next;
    });

    try {
      // remove old vote if switching
      if (prevVote) {
        await window.supabaseClient
          .from("fp_votes")
          .delete()
          .eq("session_id", sessionId)
          .eq("voter_id", uid);
      }

      await window.supabaseClient
        .from("fp_votes")
        .upsert({
          session_id: sessionId,
          voter_id: uid,
          voted_for: side,
        }, { onConflict: "session_id,voter_id" });
    } catch (e) {
      console.warn("[FPVoteBar] vote failed:", e);
      // revert
      setMyVote(prevVote);
      setVotes(prev => {
        const next = { ...prev };
        next[side] = Math.max(0, next[side] - 1);
        if (prevVote) next[prevVote] = (next[prevVote] || 0) + 1;
        return next;
      });
    }
  };

  const total = votes.challenger + votes.defender;
  const chalPct = total > 0 ? Math.round((votes.challenger / total) * 100) : 50;

  if (loading) return (
    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", padding: compact ? "4px 0" : "8px 0" }}>
      Loading votes…
    </div>
  );

  return (
    <div>
      {/* vote bar */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
        <span>⚔️ {votes.challenger}</span>
        <span>{total > 0 ? `${chalPct}% challenger` : "No votes yet"}</span>
        <span>🛡️ {votes.defender}</span>
      </div>
      <div style={{ height: compact ? 4 : 6, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: compact ? 0 : 10 }}>
        <div style={{
          height: "100%", width: `${chalPct}%`,
          background: "linear-gradient(90deg,#f87171,#818cf8)",
          borderRadius: 999, transition: "width 0.4s ease"
        }} />
      </div>

      {/* vote buttons (only if not compact) */}
      {!compact && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={() => handleVote("challenger")}
            style={{
              flex: 1, padding: "9px", borderRadius: 10,
              background: myVote === "challenger" ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.04)",
              border: myVote === "challenger" ? "1px solid rgba(248,113,113,0.4)" : "1px solid rgba(255,255,255,0.09)",
              color: myVote === "challenger" ? "#fca5a5" : "rgba(255,255,255,0.5)",
              fontSize: 12, fontWeight: 700, cursor: myVote === "challenger" ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: myVote && myVote !== "challenger" ? 0.4 : 1,
            }}>
            {myVote === "challenger" ? "⚔️ Voted ✓" : "⚔️ Challenger"}
          </button>
          <button onClick={() => handleVote("defender")}
            style={{
              flex: 1, padding: "9px", borderRadius: 10,
              background: myVote === "defender" ? "rgba(129,140,248,0.2)" : "rgba(255,255,255,0.04)",
              border: myVote === "defender" ? "1px solid rgba(129,140,248,0.4)" : "1px solid rgba(255,255,255,0.09)",
              color: myVote === "defender" ? "#c4b5fd" : "rgba(255,255,255,0.5)",
              fontSize: 12, fontWeight: 700, cursor: myVote === "defender" ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: myVote && myVote !== "defender" ? 0.4 : 1,
            }}>
            {myVote === "defender" ? "🛡️ Voted ✓" : "🛡️ Defender"}
          </button>
        </div>
      )}
    </div>
  );
}
// ── FPSessionCard ──
function FPSessionCard({ session, onOpen, onViewProfile }) {
  const timeLeft = () => {
    if (session.status === "closed") return "Closed";
    const ms = new Date(session.expires_at).getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h left` : `${m}m left`;
  };

  // strip any leading @ from stored usernames
  const chalName = (session.challenger_username || "").replace(/^@+/, "");
  const defName  = (session.target_username     || "").replace(/^@+/, "");

  const isActive  = session.status === "active";
  const defJoined = session.defender_joined;

  return (
    <div style={{ background: "rgba(255,255,255,0.04)",
      border: `1px solid ${isActive ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 18, marginBottom: 10, overflow: "hidden" }}>
      <div style={{ height: 2,
        background: isActive
          ? "linear-gradient(90deg,#f87171,#818cf8)"
          : "rgba(255,255,255,0.08)" }} />

      <div style={{ padding: "14px 14px 12px" }}>
        {/* vs row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          {/* challenger */}
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%",
              background: "linear-gradient(135deg,#f87171,#fb923c)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 15, color: "#fff", margin: "0 auto 5px" }}>
              {chalName[0]?.toUpperCase() || "?"}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f87171" }}>
              @{chalName}
            </div>
            <div style={{ fontSize: 9, color: "rgba(248,113,113,0.5)", marginTop: 2 }}>
              CHALLENGER
            </div>
          </div>

          {/* VS badge */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "-0.02em",
              background: "linear-gradient(135deg,#f87171,#818cf8)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              lineHeight: 1 }}>VS</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)",
              letterSpacing: "0.1em", marginTop: 2 }}>2FP</div>
          </div>

          {/* defender */}
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%",
              background: defJoined
                ? "linear-gradient(135deg,#818cf8,#6366f1)"
                : "rgba(255,255,255,0.08)",
              border: defJoined ? "none" : "2px dashed rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: defJoined ? 15 : 16,
              color: defJoined ? "#fff" : "rgba(255,255,255,0.25)",
              margin: "0 auto 5px" }}>
              {defJoined ? defName[0]?.toUpperCase() : "?"}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700,
              color: defJoined ? "#c4b5fd" : "rgba(255,255,255,0.35)" }}>
              @{defName}
            </div>
            <div style={{ fontSize: 9, marginTop: 2,
              color: defJoined ? "rgba(129,140,248,0.5)" : "rgba(255,255,255,0.2)" }}>
              {defJoined ? "DEFENDING" : "NOT RESPONDING"}
            </div>
          </div>
        </div>

        {/* allegation */}
        <div style={{ background: "rgba(248,113,113,0.05)",
          border: "1px solid rgba(248,113,113,0.1)",
          borderRadius: 10, padding: "9px 11px", marginBottom: 10,
          fontSize: 12, color: "rgba(255,255,255,0.65)",
          fontStyle: "italic", lineHeight: 1.5 }}>
          "{session.allegation.length > 90
            ? session.allegation.slice(0, 90) + "…"
            : session.allegation}"
        </div>

        <FPVoteBar sessionId={session.id} compact={true} />

        {/* bottom row */}
        <div style={{ display: "flex", alignItems: "center",
          justifyContent: "space-between", marginTop: 10, gap: 8 }}>
          <span style={{ fontSize: 10,
            color: isActive ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.2)",
            fontWeight: 600, flexShrink: 0 }}>
            {isActive ? "🟢 LIVE" : "⚫ CLOSED"} · {timeLeft()}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {/* profile details button */}
            {onViewProfile && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewProfile(defName); }}
                style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8,
                  background: "rgba(129,140,248,0.1)",
                  border: "1px solid rgba(129,140,248,0.25)",
                  color: "#c4b5fd", fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit" }}>
                Profile
              </button>
            )}
            <button
              onClick={() => onOpen(session)}
              style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8,
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.25)",
                color: "#fca5a5", fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit" }}>
              View case →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function StartFPSession({ prefillTarget = "", onBack, onCreated }) {
  const [targetUsername, setTargetUsername] = React.useState(prefillTarget);
  const [allegation, setAllegation]         = React.useState("");
  const [context, setContext]               = React.useState("");
  const [saving, setSaving]                 = React.useState(false);
  const [error, setError]                   = React.useState(null);
  const [searchResults, setSearchResults]   = React.useState([]);
  const [searching, setSearching]           = React.useState(false);

  React.useEffect(() => {
    if (prefillTarget || !targetUsername.trim() || targetUsername.length < 2) {
      setSearchResults([]); return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await window.supabaseClient
        .from("profiles").select("username, display_name, college")
        .ilike("username", `%${targetUsername}%`)
        .not("username", "is", null).limit(6);
      setSearchResults(data || []);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [targetUsername, prefillTarget]);

  const canSubmit = targetUsername.trim() && allegation.trim().length > 10;

  const handleStart = async () => {
    if (!canSubmit || saving) return;
    setSaving(true); setError(null);
    try {
      const challengerUsername =
        window.BOND_USERNAME || localStorage.getItem("bond_username") ||
        window.currentUser?.email?.split("@")[0] || "anonymous";
      const challengerId =
        window.currentUser?.id || localStorage.getItem("bond_guest_uuid") ||
        "guest_" + Date.now();

      const { data: session, error: sErr } = await window.supabaseClient
        .from("fp_sessions").insert({
          allegation:          allegation.trim(),
          context:             context.trim() || null,
          challenger_id:       challengerId,
          challenger_username: challengerUsername,
          target_username:     targetUsername.trim().toLowerCase().replace(/^@+/, ""),
          status:              "active",
          expires_at:          new Date(Date.now() + 72 * 3600000).toISOString(),
        }).select().single();
      if (sErr) throw sErr;

      await window.supabaseClient.from("fp_participants").insert({
        session_id: session.id, username: challengerUsername,
        user_id: challengerId, side: "challenger", role: "starter",
      });

      onCreated?.(session);
    } catch (e) {
      console.error("[2FP] start failed:", e);
      setError("Couldn't start — try again.");
    }
    setSaving(false);
  };

  const inp = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12, padding: "11px 13px", color: "#fff", fontSize: 13,
    outline: "none", fontFamily: "inherit", lineHeight: 1.5,
  };

  return (
    <div style={{ padding: "16px 16px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
        <button onClick={onBack}
          style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.5)", fontSize: 15, cursor: "pointer",
            fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
          ←
        </button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#fff", letterSpacing: "-0.02em" }}>
            ⚔️ Start a 2FP
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
            Fight for People · debate runs even if they ignore it
          </div>
        </div>
      </div>

      {/* target */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>
          Who are you challenging?
        </div>
        <div style={{ position: "relative" }}>
          <input value={targetUsername}
            onChange={e => { setTargetUsername(e.target.value); setSearchResults([]); }}
            placeholder="@username" disabled={!!prefillTarget}
            style={{ ...inp, opacity: prefillTarget ? 0.7 : 1,
              border: "1px solid rgba(248,113,113,0.3)" }} />
          {searching && (
            <div style={{ position: "absolute", right: 12, top: "50%",
              transform: "translateY(-50%)", fontSize: 11,
              color: "rgba(255,255,255,0.3)" }}>…</div>
          )}
          {searchResults.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
              background: "rgba(15,23,42,0.98)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, marginTop: 4, overflow: "hidden" }}>
              {searchResults.map(u => (
                <button key={u.username}
                  onClick={() => { setTargetUsername(u.username); setSearchResults([]); }}
                  style={{ width: "100%", display: "flex", alignItems: "center",
                    gap: 10, padding: "10px 14px", background: "transparent",
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                    borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg,#f87171,#fb923c)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#fff" }}>
                    {u.username[0].toUpperCase()}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>@{u.username}</div>
                    {u.college && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{u.college}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {prefillTarget && (
          <div style={{ fontSize: 10, color: "rgba(248,113,113,0.5)", marginTop: 5, fontWeight: 600 }}>
            ⚔️ challenging @{prefillTarget}
          </div>
        )}
      </div>

      {/* allegation */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>
          The allegation *
        </div>
        <textarea rows={3} maxLength={280} value={allegation}
          onChange={e => setAllegation(e.target.value)}
          placeholder="State your case clearly. This is the opening argument everyone sees…"
          style={{ ...inp, resize: "none",
            border: allegation.length > 10
              ? "1px solid rgba(248,113,113,0.4)" : "1px solid rgba(255,255,255,0.12)" }} />
        <div style={{ display: "flex", justifyContent: "space-between",
          fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 3 }}>
          <span style={{ color: allegation.length > 10
            ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.2)" }}>
            {allegation.length > 10 ? "✓" : `${11 - allegation.length} more chars`}
          </span>
          <span>{allegation.length}/280</span>
        </div>
      </div>

      {/* context */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>
          Context / evidence
          <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.2)",
            marginLeft: 6, textTransform: "none" }}>(optional)</span>
        </div>
        <textarea rows={2} maxLength={400} value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="Screenshots, receipts, or background…"
          style={{ ...inp, resize: "none" }} />
      </div>

      {/* rules note */}
      <div style={{ background: "rgba(248,113,113,0.04)",
        border: "1px solid rgba(248,113,113,0.12)",
        borderRadius: 14, padding: "12px 14px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.9 }}>
          ⚔️ Session opens immediately — runs for <strong style={{ color: "rgba(255,255,255,0.5)" }}>72 hours</strong><br />
          👻 @{targetUsername || "them"} can join to defend or ignore — case continues either way<br />
          🗳️ Spectators vote on who made the stronger case<br />
          📣 Both sides can invite allies
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: "#fca5a5", textAlign: "center",
          marginBottom: 12, padding: "10px", borderRadius: 10,
          background: "rgba(248,113,113,0.08)" }}>
          {error}
        </div>
      )}

      <button onClick={handleStart} disabled={!canSubmit || saving}
        style={{ width: "100%", padding: "15px", borderRadius: 16, border: "none",
          background: canSubmit
            ? "linear-gradient(135deg,#f87171,#fb923c)" : "rgba(255,255,255,0.06)",
          color: canSubmit ? "#fff" : "rgba(255,255,255,0.25)",
          fontWeight: 800, fontSize: 15, cursor: canSubmit ? "pointer" : "default",
          fontFamily: "inherit", transition: "all 0.2s",
          boxShadow: canSubmit ? "0 8px 24px rgba(248,113,113,0.3)" : "none",
          opacity: saving ? 0.7 : 1 }}>
        {saving ? "Opening session…" : "⚔️ File the Case"}
      </button>
    </div>
  );
}


function CharacterProfileView({ profile, onBack, onReview }) {
  const CC_ANIMALS = [
    { emoji:"🦁",label:"Lion"},{ emoji:"🐺",label:"Wolf"},{ emoji:"🦊",label:"Fox"},
    { emoji:"🐻",label:"Bear"},{ emoji:"🦋",label:"Butterfly"},{ emoji:"🐬",label:"Dolphin"},
    { emoji:"🦅",label:"Eagle"},{ emoji:"🐢",label:"Turtle"},{ emoji:"🦄",label:"Unicorn"},
    { emoji:"🐙",label:"Octopus"},{ emoji:"🦔",label:"Hedgehog"},{ emoji:"🦚",label:"Peacock"},
    { emoji:"🐘",label:"Elephant"},{ emoji:"🦝",label:"Raccoon"},{ emoji:"🐆",label:"Leopard"},
  ];
  const CC_ARCHETYPES = [
    { label:"The Fixer",emoji:"🔧"},{ label:"Safe House",emoji:"🏠"},
    { label:"Chaos Agent",emoji:"🌀"},{ label:"Hype Machine",emoji:"📣"},
    { label:"The Real One",emoji:"🪞"},{ label:"Quiet Anchor",emoji:"⚓"},
    { label:"Wildcard",emoji:"🃏"},{ label:"Main Character",emoji:"🎬"},
    { label:"The Therapist",emoji:"🛋️"},{ label:"Social Glue",emoji:"🫂"},
  ];
 
  const reviews = profile.reviews || [];
  const letter = (profile.display_name || profile.username || "?")[0].toUpperCase();
 
  // ── Use reviews_count from DB when reviews array hasn't loaded yet ──
  const displayReviewCount = reviews.length > 0
    ? reviews.length
    : (profile.reviews_count || 0);
 
  // ── Use avg_rating from DB as fallback ──
  const dbAvgRating = profile.avg_rating || 0;
 
  // ── Reviewer list state ──
  const [showReviewers, setShowReviewers] = React.useState(false);
  const [selectedReview, setSelectedReview] = React.useState(null);
 
  // Aggregate ratings
  const RATING_KEYS = ["vibe","real","reliable","emotional","fun"];
  const RATING_MAX  = { vibe:5, real:5, reliable:7, emotional:5, fun:5 };
  const RATING_LABEL = { vibe:"Overall Vibe", real:"Authenticity", reliable:"Reliability", emotional:"Emotional", fun:"Fun" };
  const avgRatings = {};
  RATING_KEYS.forEach(k => {
    const vals = reviews.map(r => (r.answers||{})[k]).filter(v => v > 0);
    avgRatings[k] = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
  });
 
  // Compute overall average (normalized to /5)
  const computedAvg = (() => {
    if (reviews.length === 0) return dbAvgRating;
    let totalNorm = 0, samples = 0;
    reviews.forEach(r => {
      const ans = r.answers || {};
      Object.entries(RATING_MAX).forEach(([k, max]) => {
        const val = Number(ans[k] || 0);
        if (val > 0) { totalNorm += (val / max) * 5; samples++; }
      });
    });
    return samples > 0 ? parseFloat((totalNorm / samples).toFixed(2)) : dbAvgRating;
  })();
 
  // Top archetypes
  const archetypeCounts = {};
  reviews.forEach(r => { if (r.archetype) archetypeCounts[r.archetype] = (archetypeCounts[r.archetype]||0)+1; });
  const topArchetypes = Object.entries(archetypeCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);
 
  // Top animals
  const animalCounts = {};
  reviews.forEach(r => { if (r.animal) animalCounts[r.animal] = (animalCounts[r.animal]||0)+1; });
  const topAnimals = Object.entries(animalCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);
 
  // Green / red flags
  const greenCount = {}, redCount = {};
  reviews.forEach(r => {
    (r.green_flags||[]).forEach(f => { greenCount[f] = (greenCount[f]||0)+1; });
    (r.red_flags||[]).forEach(f => { redCount[f] = (redCount[f]||0)+1; });
  });
  const topGreen = Object.entries(greenCount).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const topRed   = Object.entries(redCount).sort((a,b)=>b[1]-a[1]).slice(0,3);
 
  // Quotes
  const quotes = reviews.filter(r => r.quote_line).slice(0,3);
 
  const unlocked = true; // always show data if available
 
  // ── Helper: get animal emoji ──
  const getAnimalEmoji = (label) => {
    if (!label) return "🐾";
    return CC_ANIMALS.find(a => a.label.toLowerCase() === label.toLowerCase())?.emoji || "🐾";
  };
 
  // ── SELECTED REVIEW CARD (full screen overlay) ──
  if (selectedReview) {
    const r = selectedReview;
    return (
      <div style={{ padding: "16px 16px 48px" }}>
        <button onClick={() => setSelectedReview(null)}
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20,
            background: "none", border: "none", color: "rgba(255,255,255,0.4)",
            fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0, fontWeight: 600 }}>
          ← Back to profile
        </button>
 
        <div style={{ background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(248,113,113,0.15)", borderRadius: 20,
          overflow: "hidden" }}>
          <div style={{ height: 2, background: "linear-gradient(90deg,#f87171,#fb923c)" }} />
          <div style={{ padding: "18px 16px" }}>
 
            {/* reviewer header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
                background: r.is_anonymous
                  ? "rgba(255,255,255,0.08)"
                  : "linear-gradient(135deg,#f87171,#fb923c)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: r.is_anonymous ? 18 : 17, fontWeight: 800, color: "#fff" }}>
                {r.is_anonymous ? "👻" : (r.reviewer_username?.[0]?.toUpperCase() || "?")}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#fff" }}>
                  {r.is_anonymous ? "Anonymous reviewer" : `@${r.reviewer_username}`}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                  Reviewed @{profile.username} · {new Date(r.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
            </div>
 
            {/* quote */}
            {r.quote_line && (
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)",
                fontStyle: "italic", lineHeight: 1.7, marginBottom: 16,
                borderLeft: "3px solid rgba(248,113,113,0.4)", paddingLeft: 12,
                background: "rgba(248,113,113,0.03)", borderRadius: "0 10px 10px 0",
                padding: "10px 14px 10px 12px" }}>
                "{r.quote_line}"
              </div>
            )}
 
            {/* ratings */}
            {RATING_KEYS.some(k => (r.answers||{})[k] > 0) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)",
                  letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                  Ratings given
                </div>
                {RATING_KEYS.map(k => {
                  const val = (r.answers||{})[k] || 0;
                  if (!val) return null;
                  const pct = (val / RATING_MAX[k]) * 100;
                  return (
                    <div key={k} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between",
                        fontSize: 11, marginBottom: 3 }}>
                        <span style={{ color: "rgba(255,255,255,0.45)" }}>{RATING_LABEL[k]}</span>
                        <span style={{ fontWeight: 700, color: "#f87171" }}>{val}/{RATING_MAX[k]}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999,
                        background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`,
                          background: "linear-gradient(90deg,#f87171,#fb923c)",
                          borderRadius: 999 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
 
            {/* archetype + animal */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {r.archetype && (
                <div style={{ display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 12px", borderRadius: 999,
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.18)" }}>
                  <span style={{ fontSize: 14 }}>
                    {CC_ARCHETYPES.find(a => a.label === r.archetype)?.emoji || "🎭"}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5" }}>{r.archetype}</span>
                </div>
              )}
              {r.animal && (
                <div style={{ display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 12px", borderRadius: 999,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ fontSize: 14 }}>{getAnimalEmoji(r.animal)}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>{r.animal}</span>
                </div>
              )}
            </div>
 
            {/* personality pill answers */}
            {(() => {
              const pillKeys = ["sorted","open","hype","energy","showup","conflict","memory"];
              const pillAnswers = pillKeys.filter(k => (r.answers||{})[k]).map(k => ({
                key: k, value: (r.answers||{})[k]
              }));
              if (!pillAnswers.length) return null;
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)",
                    letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                    Personality reads
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {pillAnswers.map(p => (
                      <span key={p.key} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999,
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.5)" }}>
                        {p.value}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
 
            {/* flags */}
            {((r.green_flags?.length > 0) || (r.red_flags?.length > 0)) && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)",
                  letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  Flags marked
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {(r.green_flags||[]).map(f => (
                    <span key={f} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999,
                      background: "rgba(52,211,153,0.08)", color: "rgba(52,211,153,0.8)",
                      border: "1px solid rgba(52,211,153,0.2)" }}>
                      🟢 {f}
                    </span>
                  ))}
                  {(r.red_flags||[]).map(f => (
                    <span key={f} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999,
                      background: "rgba(248,113,113,0.08)", color: "rgba(248,113,113,0.7)",
                      border: "1px solid rgba(248,113,113,0.18)" }}>
                      🔴 {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
 
            {/* secret line */}
            {r.secret_line && (
              <div style={{ fontSize: 12, color: "rgba(196,181,253,0.6)",
                fontStyle: "italic", lineHeight: 1.5,
                background: "rgba(99,102,241,0.06)",
                borderRadius: 10, padding: "10px 12px" }}>
                🔮 {r.secret_line}
              </div>
            )}
          </div>
        </div>
 
        {/* close button */}
        <button onClick={() => setSelectedReview(null)}
          style={{ width: "100%", marginTop: 14, padding: "14px", borderRadius: 16,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit" }}>
          ← Close Review
        </button>
      </div>
    );
  }
 
  // ── MAIN PROFILE VIEW ──
  return (
    <div style={{ padding: "16px 16px 48px" }}>
 
      {/* back */}
      <button onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20,
          background: "none", border: "none", color: "rgba(255,255,255,0.4)",
          fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0, fontWeight: 600 }}>
        ← Back
      </button>
 
      {/* header card */}
      <div style={{ background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20,
        overflow: "hidden", marginBottom: 14 }}>
        <div style={{ height: 2, background: "linear-gradient(90deg,#f87171,#fb923c,rgba(251,191,36,0.5))" }} />
        <div style={{ padding: "18px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg,#f87171,#fb923c)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 24, color: "#fff" }}>
              {letter}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#fff",
                letterSpacing: "-0.02em", marginBottom: 4 }}>
                {profile.display_name || profile.username}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                @{profile.username}
                {profile.college ? ` · ${profile.college}` : ""}
                {profile.city ? ` · ${profile.city}` : ""}
              </div>
              {profile.one_word && (
                <span style={{ display: "inline-block", marginTop: 6, fontSize: 11,
                  padding: "2px 10px", borderRadius: 999,
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.2)", color: "#fca5a5" }}>
                  {profile.one_word}
                </span>
              )}
            </div>
 
            {/* RIGHT: review count + avg rating */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#f87171" }}>
                {displayReviewCount}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>reviews</div>
              {computedAvg > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 3,
                  justifyContent: "flex-end", marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: "#fbbf24" }}>★</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(251,191,36,0.9)" }}>
                    {computedAvg.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>/5</span>
                </div>
              )}
            </div>
          </div>
 
          {profile.bio && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)",
              fontStyle: "italic", lineHeight: 1.6, marginBottom: 14,
              borderLeft: "2px solid rgba(248,113,113,0.25)", paddingLeft: 10 }}>
              {profile.bio}
            </div>
          )}
 
          {/* action buttons — share + fight only (review button is at bottom) */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => {
              const url = `${window.location.origin}/people/${profile.username}`;
              if (navigator.share) navigator.share({ url });
              else if (navigator.clipboard) { navigator.clipboard.writeText(url); alert("Link copied!"); }
            }}
              style={{ padding: "11px 14px", borderRadius: 13,
                border: "1px solid rgba(99,102,241,0.3)",
                background: "rgba(99,102,241,0.08)", color: "rgba(165,180,252,0.9)",
                fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              🔗 Share
            </button>
            <button onClick={() => window.dispatchEvent(new CustomEvent("bond_start_2fp",
              { detail: { target: profile.username } }))}
              style={{ padding: "11px 14px", borderRadius: 13,
                border: "1px solid rgba(248,113,113,0.2)",
                background: "rgba(248,113,113,0.07)", color: "#fca5a5",
                fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              ⚔️ Challenge
            </button>
          </div>
        </div>
      </div>
 
      {/* ── AVERAGE RATING CARD (always visible if there's data) ── */}
      {(computedAvg > 0 || dbAvgRating > 0) && (
        <div style={{ background: "rgba(251,191,36,0.04)",
          border: "1px solid rgba(251,191,36,0.15)", borderRadius: 18,
          padding: "16px", marginBottom: 10, textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(251,191,36,0.5)",
            letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
            Overall Character Rating
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 28, color: "#fbbf24" }}>★</span>
            <span style={{ fontSize: 36, fontWeight: 900, color: "#fbbf24" }}>
              {(computedAvg || dbAvgRating).toFixed(1)}
            </span>
            <span style={{ fontSize: 16, color: "rgba(255,255,255,0.25)", alignSelf: "flex-end", marginBottom: 4 }}>/5</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            Based on {displayReviewCount} character check{displayReviewCount !== 1 ? "s" : ""}
          </div>
        </div>
      )}
 
      {/* ── DETAILED RATINGS BREAKDOWN ── */}
      {unlocked && RATING_KEYS.some(k => avgRatings[k] > 0) && (
        <div style={{ background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18,
          padding: "16px", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
            ⭐ Rating breakdown (averaged)
          </div>
          {RATING_KEYS.map(k => {
            const val = avgRatings[k];
            if (!val) return null;
            const pct = (val / RATING_MAX[k]) * 100;
            return (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: "rgba(255,255,255,0.45)" }}>{RATING_LABEL[k]}</span>
                  <span style={{ fontWeight: 700, color: "#f87171" }}>
                    {val.toFixed(1)}/{RATING_MAX[k]}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 999,
                  background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`,
                    background: "linear-gradient(90deg,#f87171,#fb923c)",
                    borderRadius: 999, transition: "width 0.4s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
 
      {/* archetypes */}
      {unlocked && topArchetypes.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18,
          padding: "16px", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            🎭 People see them as
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {topArchetypes.map(([label, count]) => {
              const arch = CC_ARCHETYPES.find(a => a.label === label);
              return (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 999,
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.18)" }}>
                  <span style={{ fontSize: 14 }}>{arch?.emoji || "🎭"}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5" }}>{label}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>×{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
 
      {/* animals */}
      {unlocked && topAnimals.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18,
          padding: "16px", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            🐾 Their energy reminds people of
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {topAnimals.map(([label, count]) => {
              const animal = CC_ANIMALS.find(a => a.label === label);
              return (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 999,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ fontSize: 16 }}>{animal?.emoji || "🐾"}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>{label}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>×{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
 
      {/* flags */}
      {unlocked && (topGreen.length > 0 || topRed.length > 0) && (
        <div style={{ background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18,
          padding: "16px", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            🚩 Flag board
          </div>
          {topGreen.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {topGreen.map(([f, c]) => (
                <span key={f} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999,
                  background: "rgba(52,211,153,0.08)", color: "rgba(52,211,153,0.8)",
                  border: "1px solid rgba(52,211,153,0.2)" }}>
                  🟢 {f} <span style={{ opacity: 0.5 }}>×{c}</span>
                </span>
              ))}
            </div>
          )}
          {topRed.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {topRed.map(([f, c]) => (
                <span key={f} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999,
                  background: "rgba(248,113,113,0.08)", color: "rgba(248,113,113,0.7)",
                  border: "1px solid rgba(248,113,113,0.18)" }}>
                  🔴 {f} <span style={{ opacity: 0.5 }}>×{c}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
 
      {/* quotes */}
      {unlocked && quotes.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18,
          padding: "16px", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            💬 What people say
          </div>
          {quotes.map((r, i) => (
            <div key={i} style={{ marginBottom: i < quotes.length-1 ? 12 : 0,
              paddingBottom: i < quotes.length-1 ? 12 : 0,
              borderBottom: i < quotes.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)",
                fontStyle: "italic", lineHeight: 1.6, marginBottom: 4 }}>
                "{r.quote_line}"
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)" }}>
                {r.is_anonymous ? "👻 anonymous" : `@${r.reviewer_username || "anon"}`}
              </div>
            </div>
          ))}
        </div>
      )}
 
      {/* self view */}
      {(profile.self_archetype || profile.self_animal) && (
        <div style={{ background: "rgba(99,102,241,0.04)",
          border: "1px solid rgba(99,102,241,0.12)", borderRadius: 18,
          padding: "16px", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(165,180,252,0.4)",
            letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            🪞 How they see themselves
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {profile.self_archetype && (
              <div style={{ fontSize: 12, padding: "5px 12px", borderRadius: 999,
                background: "rgba(99,102,241,0.1)", color: "rgba(165,180,252,0.8)",
                border: "1px solid rgba(99,102,241,0.2)", fontWeight: 600 }}>
                🎭 {profile.self_archetype}
              </div>
            )}
            {profile.self_animal && (
              <div style={{ fontSize: 12, padding: "5px 12px", borderRadius: 999,
                background: "rgba(99,102,241,0.1)", color: "rgba(165,180,252,0.8)",
                border: "1px solid rgba(99,102,241,0.2)", fontWeight: 600 }}>
                {getAnimalEmoji(profile.self_animal)} {profile.self_animal}
              </div>
            )}
          </div>
        </div>
      )}
 
      {/* ═══════════════════════════════════════════════
          REVIEWER LIST — expandable dropdown at bottom
         ═══════════════════════════════════════════════ */}
      {reviews.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18,
          overflow: "hidden", marginBottom: 14 }}>
 
          {/* toggle header */}
          <button onClick={() => setShowReviewers(v => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center",
              justifyContent: "space-between", padding: "14px 16px",
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: "inherit" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>👥</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                {reviews.length} reviewer{reviews.length !== 1 ? "s" : ""}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                ({reviews.filter(r => !r.is_anonymous).length} named · {reviews.filter(r => r.is_anonymous).length} anonymous)
              </span>
            </div>
            <span style={{ fontSize: 12, color: "rgba(248,113,113,0.5)",
              transform: showReviewers ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s", display: "inline-block" }}>
              ▼
            </span>
          </button>
 
          {/* reviewer list (expanded) */}
          {showReviewers && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)",
              maxHeight: 300, overflowY: "auto" }}>
              {reviews.map((r, i) => (
                <button key={r.id || i}
                  onClick={() => setSelectedReview(r)}
                  style={{ width: "100%", display: "flex", alignItems: "center",
                    gap: 12, padding: "11px 16px", background: "transparent",
                    border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.04)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
 
                  {/* avatar */}
                  <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                    background: r.is_anonymous
                      ? "rgba(255,255,255,0.07)"
                      : "linear-gradient(135deg,#f87171,#fb923c)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: r.is_anonymous ? 14 : 13, fontWeight: 800, color: "#fff" }}>
                    {r.is_anonymous ? "👻" : (r.reviewer_username?.[0]?.toUpperCase() || "?")}
                  </div>
 
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700,
                      color: r.is_anonymous ? "rgba(255,255,255,0.4)" : "#fff" }}>
                      {r.is_anonymous ? "Anonymous" : `@${r.reviewer_username}`}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap", alignItems: "center" }}>
                      {r.archetype && (
                        <span style={{ fontSize: 10, color: "rgba(248,113,113,0.6)" }}>
                          🎭 {r.archetype}
                        </span>
                      )}
                      {r.animal && (
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                          {getAnimalEmoji(r.animal)} {r.animal}
                        </span>
                      )}
                    </div>
                  </div>
 
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                      {new Date(r.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(248,113,113,0.5)", marginTop: 2 }}>
                      View →
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
 
      {/* ── NO REVIEWS YET message ── */}
      {displayReviewCount === 0 && reviews.length === 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18,
          padding: "28px 20px", textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🫶</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.45)",
            marginBottom: 6 }}>No character checks yet</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", lineHeight: 1.7 }}>
            Be the first to review @{profile.username}
          </div>
        </div>
      )}
 
      {/* ── SINGLE review CTA at bottom ── */}
      <button onClick={onReview}
        style={{ width: "100%", padding: "15px", borderRadius: 16, border: "none",
          background: "linear-gradient(135deg,#f87171,#fb923c)",
          color: "#fff", fontWeight: 800, fontSize: 15,
          cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 8px 24px rgba(248,113,113,0.25)", marginTop: 6 }}>
        ✍️ Write a Character Check
      </button>
    </div>
  );
}
 
 
function FightForPeopleHub({ onStartNew, onBack, currentUsername }) {
  const [sessions, setSessions]   = React.useState([]);
  const [loading, setLoading]     = React.useState(true);
  const [filter, setFilter]       = React.useState("all");
  const [activeSession, setActiveSession] = React.useState(null);
  const [refreshKey, setRefreshKey]       = React.useState(0);
  const [viewingProfile, setViewingProfile] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        let q = window.supabaseClient.from("fp_sessions").select("*")
          .order("created_at", { ascending: false }).limit(40);
        if (filter === "active")    q = q.eq("status", "active");
        if (filter === "mine")      q = q.eq("challenger_username", currentUsername);
        if (filter === "involving") q = q.or(
          `challenger_username.eq.${currentUsername},target_username.eq.${currentUsername}`
        );
        const { data } = await q;
        if (mounted) setSessions(data || []);
      } catch (e) { console.warn("[2FP]", e); }
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [filter, refreshKey, currentUsername]);

  // Auto-expire
  React.useEffect(() => {
    (async () => {
      const now = new Date().toISOString();
      const { data: expired } = await window.supabaseClient
        .from("fp_sessions").select("id")
        .eq("status", "active").lt("expires_at", now);
      if (!expired?.length) return;
      const ids = expired.map(s => s.id);
      await window.supabaseClient.from("fp_sessions")
        .update({ status: "closed", winner_side: null, closed_at: now }).in("id", ids);
      const msgs = ids.map(id => ({
        session_id: id, sender_username: "system", sender_id: "system",
        content: "Session expired after 72 hours — spectators decide the winner", side: "system",
      }));
      if (msgs.length) await window.supabaseClient.from("fp_messages").insert(msgs);
    })();
  }, []);

  // show a profile inline via CharacterProfileView
  if (viewingProfile) {
    return (
      <CharacterProfileView
        profile={viewingProfile}
        onBack={() => setViewingProfile(null)}
        onReview={() => {}} // no-op from here
      />
    );
  }

  if (activeSession) {
    return (
      <FPSessionView
        session={activeSession}
        currentUsername={currentUsername}
        onBack={() => { setActiveSession(null); setRefreshKey(k => k + 1); }}
      />
    );
  }

  const handleViewProfile = async (username) => {
    const clean = (username || "").replace(/^@+/, "");
    if (!clean) return;
    const { data: profile } = await window.supabaseClient
      .from("profiles").select("*").eq("username", clean).maybeSingle();
    if (profile) {
      const { data: reviews } = await window.supabaseClient
        .from("character_reviews").select("*")
        .eq("target_username", clean).order("created_at", { ascending: false });
      setViewingProfile({ ...profile, reviews: reviews || [] });
    }
  };

  const FILTERS = [
    { id: "all",       label: "All" },
    { id: "active",    label: "🟢 Live" },
    { id: "mine",      label: "Mine" },
    { id: "involving", label: "About me" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column",
      height: "100vh", background: "#0a0e1a", overflow: "hidden" }}>

      {/* header */}
      <div style={{ flexShrink: 0, padding: "14px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          {onBack && (
            <button onClick={onBack}
              style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)", fontSize: 14, cursor: "pointer",
                fontFamily: "inherit", display: "flex", alignItems: "center",
                justifyContent: "center" }}>
              ←
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 20,
              letterSpacing: "-0.03em", color: "#fff" }}>
              ⚔️ Fight for People
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 2 }}>
              Public cases · anyone can watch · debate runs regardless
            </div>
          </div>
          <button onClick={onStartNew}
            style={{ padding: "8px 14px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg,#f87171,#fb923c)",
              color: "#fff", fontWeight: 700, fontSize: 12,
              cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            + Start
          </button>
        </div>

        {/* filter pills */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 999,
                fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                background: filter === f.id ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.05)",
                border: filter === f.id ? "1px solid rgba(248,113,113,0.4)" : "1px solid rgba(255,255,255,0.08)",
                color: filter === f.id ? "#fca5a5" : "rgba(255,255,255,0.4)" }}>
              {f.label}
            </button>
          ))}
          <button onClick={() => setRefreshKey(k => k + 1)}
            style={{ flexShrink: 0, padding: "5px 10px", borderRadius: 999,
              fontSize: 11, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "inherit" }}>
            ↻
          </button>
        </div>
      </div>

      {/* sessions list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0",
            color: "rgba(248,113,113,0.4)", fontSize: 13 }}>Loading cases…</div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>⚔️</div>
            <div style={{ fontSize: 14, fontWeight: 700,
              color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>No active cases</div>
            <button onClick={onStartNew}
              style={{ padding: "12px 24px", borderRadius: 14, border: "none",
                background: "linear-gradient(135deg,#f87171,#fb923c)",
                color: "#fff", fontWeight: 700, fontSize: 14,
                cursor: "pointer", fontFamily: "inherit" }}>
              ⚔️ File a case
            </button>
          </div>
        ) : (
          sessions.map(s => (
            <FPSessionCard
              key={s.id}
              session={s}
              onOpen={setActiveSession}
              onViewProfile={handleViewProfile}
            />
          ))
        )}
      </div>
    </div>
  );
}
// ── FPInvitePanel ──
function FPInvitePanel({ sessionId, side, currentUsername, onClose }) {
  const [query, setQuery]       = React.useState("");
  const [results, setResults]   = React.useState([]);
  const [searching, setSearching] = React.useState(false);
  const [invited, setInvited]   = React.useState(new Set());
  const [participants, setParticipants] = React.useState([]);

  // load existing participants
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await window.supabaseClient
        .from("fp_participants")
        .select("username, side, role")
        .eq("session_id", sessionId);
      if (mounted) setParticipants(data || []);
    })();
    return () => { mounted = false; };
  }, [sessionId]);

  // search
  React.useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await window.supabaseClient
        .from("profiles")
        .select("username, display_name, college")
        .ilike("username", `%${query}%`)
        .not("username", "is", null)
        .limit(8);
      setResults(data || []);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const alreadyIn = (uname) =>
    participants.some(p => p.username === uname) || invited.has(uname);

  const handleInvite = async (uname) => {
    if (alreadyIn(uname)) return;
    setInvited(prev => new Set([...prev, uname]));

    await window.supabaseClient.from("fp_participants").insert({
      session_id: sessionId,
      username:   uname,
      side,
      role:       "invited",
    });

    // also drop an invite message into the chat
    await window.supabaseClient.from("fp_messages").insert({
      session_id:      sessionId,
      sender_username: "system",
      sender_id:       "system",
      content:         `@${currentUsername} invited @${uname} to the ${side} side`,
      side:            "system",
    });
  };

  const sideColor = side === "challenger"
    ? { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", text: "#fca5a5" }
    : { bg: "rgba(129,140,248,0.1)", border: "rgba(129,140,248,0.3)", text: "#c4b5fd" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480,
          background: "#0e0e12", borderRadius: "20px 20px 0 0",
          border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none",
          padding: "20px 16px 32px" }}>

        {/* handle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999,
            background: "rgba(255,255,255,0.15)" }} />
        </div>

        <div style={{ fontWeight: 800, fontSize: 15, color: "#fff",
          marginBottom: 4 }}>
          Invite to {side === "challenger" ? "⚔️ Challenger" : "🛡️ Defender"} side
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)",
          marginBottom: 14 }}>
          They can join and add their voice to your case
        </div>

        {/* current participants on this side */}
        {participants.filter(p => p.side === side).length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {participants.filter(p => p.side === side).map(p => (
              <div key={p.username}
                style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999,
                  background: sideColor.bg, border: `1px solid ${sideColor.border}`,
                  color: sideColor.text, fontWeight: 600 }}>
                @{p.username}
                {p.role === "starter" ? " 👑" : ""}
              </div>
            ))}
          </div>
        )}

        {/* search */}
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search username to invite…"
          style={{ width: "100%", boxSizing: "border-box",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12, padding: "11px 13px",
            color: "#fff", fontSize: 13, outline: "none",
            fontFamily: "inherit", marginBottom: 10 }}
        />

        {/* results */}
        <div style={{ maxHeight: 220, overflowY: "auto" }}>
          {searching && (
            <div style={{ textAlign: "center", padding: "12px 0",
              fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Searching…</div>
          )}
          {results.map(u => {
            const already = alreadyIn(u.username);
            const isMe    = u.username === currentUsername;
            return (
              <div key={u.username}
                style={{ display: "flex", alignItems: "center",
                  gap: 10, padding: "9px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg,#f87171,#fb923c)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 13, color: "#fff" }}>
                 {(u.username?.[0] || "?").toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                    @{u.username}
                  </div>
                  {u.college && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                      {u.college}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => !already && !isMe && handleInvite(u.username)}
                  disabled={already || isMe}
                  style={{ padding: "6px 14px", borderRadius: 10, border: "none",
                    fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                    cursor: (already || isMe) ? "default" : "pointer",
                    background: already
                      ? "rgba(52,211,153,0.1)"
                      : isMe ? "rgba(255,255,255,0.05)"
                      : sideColor.bg,
                    color: already
                      ? "rgba(52,211,153,0.7)"
                      : isMe ? "rgba(255,255,255,0.2)"
                      : sideColor.text,
                    border: `1px solid ${already
                      ? "rgba(52,211,153,0.2)"
                      : isMe ? "rgba(255,255,255,0.06)"
                      : sideColor.border}` }}>
                  {already ? "✓ Added" : isMe ? "You" : "Invite"}
                </button>
              </div>
            );
          })}
          {!searching && results.length === 0 && query.length >= 2 && (
            <div style={{ textAlign: "center", padding: "16px 0",
              fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
              No users found
            </div>
          )}
        </div>

        <button onClick={onClose}
          style={{ width: "100%", marginTop: 16, padding: "12px",
            borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit" }}>
          Done
        </button>
      </div>
    </div>
  );
}

function FPSessionView({ session, currentUsername, onBack }) {
  const [messages, setMessages]         = React.useState([]);
  const [participants, setParticipants] = React.useState([]);
  const [input, setInput]               = React.useState("");
  const [sending, setSending]           = React.useState(false);
  const [showInvite, setShowInvite]     = React.useState(null);
  const [liveSession, setLiveSession]   = React.useState(session);
  const [joining, setJoining]           = React.useState(false);
  const [joiningAs, setJoiningAs]       = React.useState(null); // "challenger" | "defender"
  const [closing, setClosing]           = React.useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = React.useState(false);
  const [showInfo, setShowInfo]         = React.useState(false);
  const [sideTab, setSideTab]           = React.useState("chat"); // "chat" | "sides"
  const [lastMsgTime, setLastMsgTime]   = React.useState(null);
  const messagesEndRef = React.useRef(null);
  const pollRef        = React.useRef(null);
  const inactivityRef  = React.useRef(null);

  const isChallenger  = currentUsername === liveSession.challenger_username;
  const isDefender    = currentUsername === liveSession.target_username;
  const myParticipant = participants.find(p => p.username === currentUsername);
  const mySide        = myParticipant?.side ||
    (isChallenger ? "challenger" : isDefender ? "defender" : null);
  const isParticipant = !!myParticipant;
  const isSpectator   = !isParticipant;
  const isClosed      = liveSession.status === "closed";

  const challengers = participants.filter(p => p.side === "challenger");
  const defenders   = participants.filter(p => p.side === "defender");
  // strip leading @ from stored usernames (DB may store with or without)
  const chalDisplay = (liveSession.challenger_username || "").replace(/^@+/, "");
  const defDisplay  = (liveSession.target_username     || "").replace(/^@+/, "");
const mountedRef = React.useRef(true);
  const load = React.useCallback(async () => {
    const [msgRes, parRes, sesRes] = await Promise.all([
      window.supabaseClient.from("fp_messages").select("*")
        .eq("session_id", session.id).order("created_at", { ascending: true }),
      window.supabaseClient.from("fp_participants").select("*").eq("session_id", session.id),
      window.supabaseClient.from("fp_sessions").select("*").eq("id", session.id).single(),
    ]);
    if (msgRes.data) {
      setMessages(msgRes.data);
      const realMsgs = msgRes.data.filter(m => m.side !== "system");
      if (realMsgs.length > 0) {
        setLastMsgTime(new Date(realMsgs[realMsgs.length - 1].created_at).getTime());
      }
    }
    if (parRes.data) setParticipants(parRes.data);
    if (sesRes.data) setLiveSession(sesRes.data);

    // ── auto-expire on load ──
    if (sesRes.data?.status === "active" && sesRes.data?.expires_at &&
        new Date(sesRes.data.expires_at) < new Date()) {
      await window.supabaseClient.from("fp_sessions")
        .update({ status: "closed", winner_side: null, closed_at: new Date().toISOString() })
        .eq("id", session.id);
      await window.supabaseClient.from("fp_messages").insert({
        session_id: session.id, sender_username: "system", sender_id: "system",
        content: "Session expired after 72 hours", side: "system",
      });
    }
  }, [session.id]);

  // ── 5-minute inactivity auto-close ──
  React.useEffect(() => {
    if (isClosed) return;
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(async () => {
      const realMsgs = messages.filter(m => m.side !== "system");
      if (realMsgs.length === 0) return; // no messages yet, don't close
      const lastTime = lastMsgTime || 0;
      const elapsed  = Date.now() - lastTime;
      if (elapsed >= 5 * 60 * 1000) {
        await window.supabaseClient.from("fp_sessions")
          .update({ status: "closed", winner_side: "draw", closed_at: new Date().toISOString() })
          .eq("id", session.id);
        await window.supabaseClient.from("fp_messages").insert({
          session_id: session.id, sender_username: "system", sender_id: "system",
          content: "Session closed — no activity for 5 minutes. Declared a draw.",
          side: "system",
        });
        await load();
      }
    }, 5 * 60 * 1000);
    return () => clearTimeout(inactivityRef.current);
  }, [lastMsgTime, isClosed, messages.length]);

 React.useEffect(() => {
  mountedRef.current = true;
  load();
  pollRef.current = setInterval(() => {
    if (mountedRef.current) load();
  }, 4000);
  return () => {
    mountedRef.current = false;
    clearInterval(pollRef.current);
  };
}, [load]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── join as named party (defender) ──
  const handleJoinSide = async (side) => {
    if (joining) return;
    setJoining(true);
    const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid") || "guest_" + Date.now();

    // check if already a participant
    const existing = participants.find(p => p.username === currentUsername);
    if (existing) {
      await window.supabaseClient.from("fp_participants")
        .update({ role: "accepted", user_id: uid, side })
        .eq("session_id", session.id).eq("username", currentUsername);
    } else {
      await window.supabaseClient.from("fp_participants").insert({
        session_id: session.id, username: currentUsername,
        user_id: uid, side, role: "starter",
      });
    }

    if (side === "defender") {
      await window.supabaseClient.from("fp_sessions")
        .update({ defender_joined: true, defender_id: uid })
        .eq("id", session.id);
    }

    await window.supabaseClient.from("fp_messages").insert({
      session_id: session.id, sender_username: "system", sender_id: "system",
      content: `@${currentUsername} joined the ${side} side`,
      side: "system",
    });

    await load();
    setJoiningAs(null);
    setJoining(false);
  };

  const handleJoinAsAlly = (side) => handleJoinSide(side);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || isClosed || isSpectator) return;
    if (myParticipant?.role === "invited") return;
    setSending(true);
    setInput("");
    const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid") || "anon";
    await window.supabaseClient.from("fp_messages").insert({
      session_id: session.id, sender_username: currentUsername,
      sender_id: uid, content: text, side: mySide,
    });
    await load();
    setSending(false);
  };

  const handleClose = async (winner) => {
    setClosing(true);
    await window.supabaseClient.from("fp_sessions")
      .update({ status: "closed", winner_side: winner, closed_at: new Date().toISOString() })
      .eq("id", session.id);
    await window.supabaseClient.from("fp_messages").insert({
      session_id: session.id, sender_username: "system", sender_id: "system",
      content: winner === "draw"
        ? "Session closed — declared a draw"
        : `Session closed — ${winner === "challenger" ? "⚔️ Challenger" : "🛡️ Defender"} declared winner`,
      side: "system",
    });
    await load();
    setClosing(false);
    setShowCloseConfirm(false);
  };

  const timeLeft = () => {
    if (isClosed) return "Closed";
    const ms = new Date(liveSession.expires_at).getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  };

  const bubbleStyle = (msg) => {
    if (msg.side === "system") return {
      background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)",
      fontSize: 11, fontStyle: "italic", textAlign: "center",
      padding: "5px 12px", borderRadius: 10, margin: "3px auto", maxWidth: "85%",
    };
    const isMe     = msg.sender_username === currentUsername;
    const isChSide = msg.side === "challenger";
    return {
      background: isChSide ? "rgba(248,113,113,0.1)" : "rgba(129,140,248,0.1)",
      border: `1px solid ${isChSide ? "rgba(248,113,113,0.18)" : "rgba(129,140,248,0.18)"}`,
      borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
      padding: "9px 12px", maxWidth: "78%",
      alignSelf: isMe ? "flex-end" : "flex-start",
    };
  };

  const invitedEntry = participants.find(p => p.username === currentUsername && p.role === "invited");

  return (
    <div style={{ display: "flex", flexDirection: "column",
      height: "100vh", background: "#0a0e1a", overflow: "hidden" }}>

      {/* ── HEADER ── */}
      <div style={{ flexShrink: 0, background: "rgba(10,14,26,0.95)",
        borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 14px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack}
            style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)", fontSize: 14, cursor: "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
            ←
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#f87171",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ⚔️ @{liveSession.challenger_username}
                {challengers.length > 1 ? ` +${challengers.length - 1}` : ""}
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>vs</span>
              <span style={{ fontSize: 12, fontWeight: 700,
                color: liveSession.defender_joined ? "#c4b5fd" : "rgba(255,255,255,0.3)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                🛡️ @{liveSession.target_username}
                {defenders.length > 1 ? ` +${defenders.length - 1}` : ""}
              </span>
            </div>
            <div style={{ fontSize: 9, fontWeight: 700,
              color: isClosed ? "rgba(255,255,255,0.2)" : "rgba(52,211,153,0.6)",
              marginTop: 2 }}>
              {isClosed ? "⚫ CLOSED" : "🟢 LIVE"} · {timeLeft()}
            </div>
          </div>

          {/* info icon */}
          <button onClick={() => setShowInfo(v => !v)}
            style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: showInfo ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center",
              justifyContent: "center", fontWeight: 700 }}>
            ℹ
          </button>

          {isChallenger && !isClosed && (
            <button onClick={() => setShowCloseConfirm(true)}
              style={{ padding: "5px 10px", borderRadius: 8, border: "none",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
              Close
            </button>
          )}
        </div>

        {/* vote bar */}
        <div style={{ marginTop: 8 }}>
          <FPVoteBar sessionId={session.id} compact={true} />
        </div>
      </div>

      {/* ── INFO PANEL ── */}
      {showInfo && (
        <div style={{ flexShrink: 0, background: "rgba(99,102,241,0.08)",
          borderBottom: "1px solid rgba(99,102,241,0.15)", padding: "12px 14px" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.9 }}>
            ⚔️ <strong style={{ color: "#fca5a5" }}>Fight for People</strong> — a public debate about someone<br />
            🟢 Session runs for <strong>72 hours</strong> regardless of whether the target responds<br />
            👻 Target can <strong>ignore</strong> — the debate still plays out<br />
            👥 Anyone can <strong>join a side</strong> as a participant and argue<br />
            🗳️ Spectators vote on who made the stronger case<br />
            ⏱️ Auto-closes after <strong>5 minutes of inactivity</strong> (declared draw)
          </div>
          <button onClick={() => setShowInfo(false)}
            style={{ marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.25)",
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 600 }}>
            Got it ✕
          </button>
        </div>
      )}

      {/* ── ALLEGATION ── */}
      <div style={{ flexShrink: 0, background: "rgba(248,113,113,0.04)",
        borderBottom: "1px solid rgba(248,113,113,0.09)", padding: "9px 14px" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)",
          lineHeight: 1.5, fontStyle: "italic" }}>
          ⚔️ "{liveSession.allegation.length > 120
            ? liveSession.allegation.slice(0, 120) + "…"
            : liveSession.allegation}"
        </div>
        {liveSession.context && (
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)",
            marginTop: 4, lineHeight: 1.5 }}>
            Context: {liveSession.context}
          </div>
        )}
      </div>

      {/* ── TABS: Chat | Sides ── */}
      <div style={{ flexShrink: 0, display: "flex", gap: 0,
        borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {[
          { id: "chat",  label: "💬 Chat" },
          { id: "sides", label: `👥 Sides (${challengers.length + defenders.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setSideTab(t.id)}
            style={{ flex: 1, padding: "9px 0", border: "none",
              borderBottom: sideTab === t.id
                ? "2px solid #f87171" : "2px solid transparent",
              background: "transparent",
              color: sideTab === t.id ? "#f87171" : "rgba(255,255,255,0.3)",
              fontSize: 12, fontWeight: sideTab === t.id ? 700 : 500,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SIDES TAB ── */}
      {sideTab === "sides" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>

          {/* spectator join options */}
          {!isClosed && isSpectator && (
            <div style={{ background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14, padding: "14px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)",
                marginBottom: 10 }}>
                Join a side to participate
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleJoinSide("challenger")} disabled={joining}
                  style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none",
                    background: "rgba(248,113,113,0.15)",
                    color: "#fca5a5", fontWeight: 700, fontSize: 12,
                    cursor: "pointer", fontFamily: "inherit", opacity: joining ? 0.6 : 1 }}>
                  ⚔️ Join Challenger
                </button>
                <button onClick={() => handleJoinSide("defender")} disabled={joining}
                  style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none",
                    background: "rgba(129,140,248,0.15)",
                    color: "#c4b5fd", fontWeight: 700, fontSize: 12,
                    cursor: "pointer", fontFamily: "inherit", opacity: joining ? 0.6 : 1 }}>
                  🛡️ Join Defender
                </button>
              </div>
            </div>
          )}

          {/* challenger side */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(248,113,113,0.5)",
              textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
              ⚔️ Challenger side · {challengers.length}
            </div>
            {challengers.length === 0
              ? <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)",
                  fontStyle: "italic" }}>No one yet</div>
              : challengers.map(p => (
                <div key={p.username}
                  style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg,#f87171,#fb923c)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 12, color: "#fff" }}>
             {(p.username?.[0] || "?").toUpperCase()}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                    @{p.username}
                    {p.role === "starter" && (
                      <span style={{ fontSize: 10, marginLeft: 5, color: "rgba(248,113,113,0.6)" }}>
                        starter 👑
                      </span>
                    )}
                  </div>
                </div>
              ))
            }
          </div>

          {/* defender side */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(129,140,248,0.5)",
              textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
              🛡️ Defender side · {defenders.length}
            </div>
            {defenders.length === 0
              ? <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)",
                  fontStyle: "italic" }}>
                  {liveSession.defender_joined
                    ? "Joined but no allies yet"
                    : "Not yet responding — debate runs anyway"}
                </div>
              : defenders.map(p => (
                <div key={p.username}
                  style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg,#818cf8,#6366f1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 12, color: "#fff" }}>
                   {(p.username?.[0] || "?").toUpperCase()}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                    @{p.username}
                    {p.role === "starter" && (
                      <span style={{ fontSize: 10, marginLeft: 5, color: "rgba(129,140,248,0.6)" }}>
                        starter 👑
                      </span>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── CHAT TAB ── */}
      {sideTab === "chat" && (
        <>
          {/* defender join prompt */}
          {isDefender && !myParticipant && !isClosed && (
            <div style={{ flexShrink: 0, background: "rgba(129,140,248,0.06)",
              borderBottom: "1px solid rgba(129,140,248,0.12)", padding: "11px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#c4b5fd", marginBottom: 4 }}>
                🛡️ A case has been filed against you
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 9, lineHeight: 1.5 }}>
                The debate runs regardless. Join to defend — or ignore it.
              </div>
              <button onClick={() => handleJoinSide("defender")} disabled={joining}
                style={{ padding: "9px 18px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg,#818cf8,#6366f1)",
                  color: "#fff", fontWeight: 700, fontSize: 12,
                  cursor: "pointer", fontFamily: "inherit", opacity: joining ? 0.7 : 1 }}>
                {joining ? "Joining…" : "🛡️ Defend yourself"}
              </button>
            </div>
          )}

          {/* invited ally prompt */}
          {invitedEntry && !isClosed && (
            <div style={{ flexShrink: 0, background: "rgba(251,191,36,0.05)",
              borderBottom: "1px solid rgba(251,191,36,0.12)", padding: "11px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", marginBottom: 4 }}>
                📣 You've been invited to the {invitedEntry.side} side
              </div>
              <button onClick={() => handleJoinAsAlly(invitedEntry.side)}
                style={{ padding: "8px 16px", borderRadius: 10, border: "none",
                  background: invitedEntry.side === "challenger"
                    ? "linear-gradient(135deg,#f87171,#fb923c)"
                    : "linear-gradient(135deg,#818cf8,#6366f1)",
                  color: "#fff", fontWeight: 700, fontSize: 12,
                  cursor: "pointer", fontFamily: "inherit" }}>
                ✓ Accept & Join
              </button>
            </div>
          )}

          {/* spectator join nudge (in chat tab) */}
          {isSpectator && !isClosed && (
            <div style={{ flexShrink: 0, padding: "8px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", flex: 1 }}>
                👀 Watching — join a side to argue
              </span>
              <button onClick={() => setSideTab("sides")}
                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8,
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.2)",
                  color: "#fca5a5", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                Join →
              </button>
            </div>
          )}

          {/* messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px",
            display: "flex", flexDirection: "column", gap: 7 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", padding: "28px 0",
                color: "rgba(255,255,255,0.18)", fontSize: 13 }}>
                {isClosed ? "Session closed." : "No arguments yet — make the first move."}
              </div>
            )}
{messages.map((msg, i) => {
              if (msg.side === "system") return (
                <div key={msg.id || i} style={bubbleStyle(msg)}>{msg.content}</div>
              );

              const isMe      = msg.sender_username === currentUsername;
              const isChSide  = msg.side === "challenger";
              const sideColor = isChSide ? "#f87171" : "#818cf8";
              const sideTag   = isChSide ? "C" : "D";
              const showLabel = !i || messages[i-1]?.sender_username !== msg.sender_username
                || messages[i-1]?.side !== msg.side;

              return (
                <div key={msg.id || i}
                  style={{ display: "flex", flexDirection: "column",
                    alignItems: isMe ? "flex-end" : "flex-start" }}>
                  {showLabel && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5,
                      marginBottom: 2,
                      flexDirection: isMe ? "row-reverse" : "row" }}>
                      {/* C / D tag */}
                      <div style={{ width: 16, height: 16, borderRadius: "50%",
                        background: isChSide
                          ? "rgba(248,113,113,0.2)" : "rgba(129,140,248,0.2)",
                        border: `1px solid ${isChSide
                          ? "rgba(248,113,113,0.4)" : "rgba(129,140,248,0.4)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 8, fontWeight: 900, color: sideColor, flexShrink: 0 }}>
                        {sideTag}
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: sideColor }}>
                        @{(msg.sender_username || "").replace(/^@+/, "")}
                      </div>
                    </div>
                  )}
                  <div style={bubbleStyle(msg)}>
                    <div style={{ fontSize: 13, color: "#fff", lineHeight: 1.5 }}>
                      {msg.content}
                    </div>
                    <div style={{ fontSize: 9, marginTop: 3, textAlign: "right",
                      color: "rgba(255,255,255,0.18)" }}>
                      {new Date(msg.created_at).toLocaleTimeString("en-IN",
                        { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
            
            
            <div ref={messagesEndRef} />
          </div>

          {/* spectator vote */}
          {isSpectator && !isClosed && (
            <div style={{ flexShrink: 0, padding: "10px 14px",
              borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)",
                marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                🗳️ Your vote
              </div>
              <FPVoteBar sessionId={session.id} />
            </div>
          )}

          {/* winner banner */}
          {isClosed && (
            <div style={{ flexShrink: 0, padding: "14px",
              background: liveSession.winner_side === "challenger"
                ? "rgba(248,113,113,0.08)"
                : liveSession.winner_side === "defender"
                ? "rgba(129,140,248,0.08)"
                : "rgba(255,255,255,0.04)",
              borderTop: "1px solid rgba(255,255,255,0.07)",
              textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>
                {liveSession.winner_side === "challenger" ? "⚔️"
                  : liveSession.winner_side === "defender" ? "🛡️" : "🤝"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                {liveSession.winner_side === "challenger" ? "Challenger won"
                  : liveSession.winner_side === "defender" ? "Defender held their ground"
                  : "Declared a draw"}
              </div>
              <FPVoteBar sessionId={session.id} />
            </div>
          )}

          {/* input row */}
          {!isClosed && isParticipant && myParticipant?.role !== "invited" && (
            <div style={{ flexShrink: 0, padding: "8px 12px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(10,14,26,0.95)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <button onClick={() => setShowInvite(mySide)}
                  style={{ fontSize: 10, padding: "3px 9px", borderRadius: 999,
                    background: mySide === "challenger"
                      ? "rgba(248,113,113,0.1)" : "rgba(129,140,248,0.1)",
                    border: mySide === "challenger"
                      ? "1px solid rgba(248,113,113,0.25)"
                      : "1px solid rgba(129,140,248,0.25)",
                    color: mySide === "challenger" ? "rgba(248,113,113,0.7)" : "rgba(129,140,248,0.7)",
                    cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                  + Invite ally
                </button>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", marginLeft: "auto" }}>
                  {mySide === "challenger" ? "⚔️ challenger" : "🛡️ defender"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <textarea rows={1} value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Make your argument…"
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${mySide === "challenger"
                      ? "rgba(248,113,113,0.2)" : "rgba(129,140,248,0.2)"}`,
                    borderRadius: 12, padding: "9px 12px", color: "#fff", fontSize: 13,
                    outline: "none", fontFamily: "inherit", resize: "none", lineHeight: 1.4 }}
                />
                <button onClick={handleSend} disabled={!input.trim() || sending}
                  style={{ width: 40, height: 40, borderRadius: 12, border: "none",
                    background: input.trim()
                      ? mySide === "challenger"
                        ? "linear-gradient(135deg,#f87171,#fb923c)"
                        : "linear-gradient(135deg,#818cf8,#6366f1)"
                      : "rgba(255,255,255,0.06)",
                    color: input.trim() ? "#fff" : "rgba(255,255,255,0.25)",
                    fontSize: 15, cursor: input.trim() ? "pointer" : "default",
                    flexShrink: 0, display: "flex", alignItems: "center",
                    justifyContent: "center" }}>
                  {sending ? "…" : "→"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── CLOSE CONFIRM ── */}
      {showCloseConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 3000,
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 340, background: "#0e0e12",
            borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", padding: "22px 18px" }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#fff", marginBottom: 6 }}>
              Close this session
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)",
              lineHeight: 1.6, marginBottom: 18 }}>
              Declare a winner or draw. Cannot be undone.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { winner: "challenger", label: "⚔️ Challenger wins",
                  bg: "rgba(248,113,113,0.15)", color: "#fca5a5" },
                { winner: "defender",   label: "🛡️ Defender wins",
                  bg: "rgba(129,140,248,0.15)", color: "#c4b5fd" },
                { winner: "draw",       label: "🤝 Draw",
                  bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" },
              ].map(o => (
                <button key={o.winner} onClick={() => handleClose(o.winner)} disabled={closing}
                  style={{ padding: "11px", borderRadius: 12, border: "none",
                    background: o.bg, color: o.color, fontWeight: 700, fontSize: 13,
                    cursor: "pointer", fontFamily: "inherit" }}>
                  {o.label}
                </button>
              ))}
              <button onClick={() => setShowCloseConfirm(false)}
                style={{ padding: "9px", borderRadius: 12, background: "transparent",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "rgba(255,255,255,0.3)", fontSize: 12,
                  cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INVITE PANEL ── */}
      {showInvite && (
        <FPInvitePanel
          sessionId={session.id}
          side={showInvite}
          currentUsername={currentUsername}
          onClose={() => setShowInvite(null)}
        />
      )}
    </div>
  );
}

function PeopleCard({ profile, onViewProfile }) {
  const reviewCount = profile.reviews_count || 0;
  const avgRating = profile.avg_rating || 0;
  const letter = (profile.display_name || profile.username || "?")[0].toUpperCase();
 
  return (
    <button
      onClick={() => onViewProfile && onViewProfile(profile)}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16,
        marginBottom: 8, cursor: "pointer", fontFamily: "inherit",
        textAlign: "left", transition: "border-color 0.15s",
      }}>
 
      {/* avatar */}
      <div style={{
        width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg,#f87171,#fb923c)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 16, color: "#fff",
      }}>
        {letter}
      </div>
 
      {/* info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#fff",
          marginBottom: 2, overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {profile.display_name || `@${profile.username}`}
        </div>
 
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          @{profile.username}
          {profile.college ? ` · ${profile.college}` : ""}
        </div>
 
        {/* avg rating inline */}
        {avgRating > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "#fbbf24" }}>★</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(251,191,36,0.8)" }}>
              {avgRating.toFixed(1)}
            </span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>/5</span>
          </div>
        )}
      </div>
 
      {/* review count badge */}
      <div style={{
        flexShrink: 0, minWidth: 36, height: 36, borderRadius: 10,
        background: reviewCount > 0 ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.04)",
        border: reviewCount > 0 ? "1px solid rgba(248,113,113,0.2)" : "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "0 6px",
      }}>
        <span style={{ fontSize: 13, fontWeight: 800,
          color: reviewCount > 0 ? "#fca5a5" : "rgba(255,255,255,0.2)" }}>
          {reviewCount}
        </span>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)",
          letterSpacing: "0.05em", lineHeight: 1 }}>
          checks
        </span>
      </div>
    </button>
  );
}
function CharacterCheckHub({ currentUser, username }) {
  // ── ALL STATE UP TOP ──
  const [screen, setScreen]               = React.useState("feed");
  const [activeProfile, setActiveProfile] = React.useState(null);
  const [search, setSearch]               = React.useState("");
  const [searchResults, setSearchResults] = React.useState([]);
  const [searching, setSearching]         = React.useState(false);
  const [feedProfiles, setFeedProfiles]   = React.useState([]);
  const [feedLoading, setFeedLoading]     = React.useState(true);
  const [fp2PrefillTarget, setFp2PrefillTarget] = React.useState("");

  // ── load profile by username helper ──
  const loadProfileByUsername = React.useCallback(async (targetUsername) => {
    try {
      const { data: profile, error: pErr } = await window.supabaseClient
        .from("profiles").select("*").eq("username", targetUsername).maybeSingle();
      if (pErr || !profile) return null;
      const { data: reviews } = await window.supabaseClient
        .from("character_reviews").select("*")
        .eq("target_username", targetUsername)
        .order("created_at", { ascending: false });
      return { ...profile, reviews: reviews || [] };
    } catch (e) { return null; }
  }, []);
const handleViewProfile = React.useCallback(async (profile) => {
  if (!profile?.username) return;

  window.history.pushState(
    { username: profile.username },
    "",
    `/people/${encodeURIComponent(profile.username)}`
  );

  // 🔥 KEY FIX:
  // show profile instantly WITH reviews_count from feed
  // and empty reviews array to avoid undefined errors
  setActiveProfile({
    ...profile,
    reviews: []
  });

  setScreen("profile");

  // fetch full data in background
  const full = await loadProfileByUsername(profile.username);
  if (full) setActiveProfile(full);

}, [loadProfileByUsername]);
  const handleBack = React.useCallback(() => {
    window.history.pushState({}, "", "/");
    setScreen("feed");
    setActiveProfile(null);
  }, []);

  // ── 2FP event listeners ──
  React.useEffect(() => {
    const handle = (e) => {
      setFp2PrefillTarget(e.detail?.target || "");
      setScreen("2fp_start");
    };
    window.addEventListener("bond_start_2fp", handle);
    return () => window.removeEventListener("bond_start_2fp", handle);
  }, []);

  React.useEffect(() => {
    const handle = () => setScreen("2fp_hub");
    window.addEventListener("bond_open_2fp_hub", handle);
    return () => window.removeEventListener("bond_open_2fp_hub", handle);
  }, []);

  // ── browser back/forward ──
  React.useEffect(() => {
    const onPop = async () => {
      const path  = window.location.pathname;
      const match = path.match(/\/people\/([^/]+)/);
      if (match) {
        const loaded = await loadProfileByUsername(decodeURIComponent(match[1]));
        if (loaded) { setActiveProfile(loaded); setScreen("profile"); }
      } else {
        setScreen("feed"); setActiveProfile(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [loadProfileByUsername]);

  // ── on mount: deep-link check ──
  React.useEffect(() => {
    const match = window.location.pathname.match(/\/people\/([^/]+)/);
    if (!match) return;
    let mounted = true;
    (async () => {
      const loaded = await loadProfileByUsername(decodeURIComponent(match[1]));
      if (!mounted) return;
      if (loaded) { setActiveProfile(loaded); setScreen("profile"); }
    })();
    return () => { mounted = false; };
  }, [loadProfileByUsername]);

  // ── feed load ──
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setFeedLoading(true);
        const { data, error } = await window.supabaseClient
          .from("profiles")
          .select("username,display_name,college,city,reviews_count,self_archetype,self_animal,one_word,bio,avg_rating")
          .not("username", "is", null)
          .not("display_name", "is", null)
          .order("reviews_count", { ascending: false })
          .limit(30);
        if (error) throw error;
        if (mounted) setFeedProfiles(data || []);
      } catch (e) { console.warn("[People feed]", e); }
      finally { if (mounted) setFeedLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  // ── search ──
  React.useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const q = search.trim();
        const { data } = await window.supabaseClient
          .from("profiles")
          .select("username,display_name,college,city,reviews_count,self_archetype,self_animal,one_word,bio,avg_rating")
          .or(`username.ilike.%${q}%,display_name.ilike.%${q}%,college.ilike.%${q}%`)
          .not("username", "is", null)
          .limit(10);
        setSearchResults(data || []);
      } catch (e) {
        const q = search.trim().toLowerCase();
        setSearchResults(feedProfiles.filter(p =>
          (p.username||"").toLowerCase().includes(q) ||
          (p.display_name||"").toLowerCase().includes(q) ||
          (p.college||"").toLowerCase().includes(q)
        ));
      }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [search, feedProfiles]);

  // ── ALL SCREEN CASES (after all hooks) ──

  if (screen === "2fp_start") return (
    <StartFPSession
      prefillTarget={fp2PrefillTarget}
      onBack={() => setScreen("feed")}
      onCreated={() => setScreen("2fp_hub")}
    />
  );

  if (screen === "2fp_hub") return (
    <FightForPeopleHub
      currentUsername={username}
      onStartNew={() => setScreen("2fp_start")}
      onBack={() => setScreen("feed")}
    />
  );
if (screen === "create") return (
  <CreateProfileScreen
    existingProfile={null}
    onBack={() => setScreen("feed")}
    onSaved={async (p) => {
      await saveProfileToDB(p);
      setActiveProfile(p);
      setScreen("profile");
    }}
  />
);

if (screen === "edit") return (
  <CreateProfileScreen
    existingProfile={activeProfile}
    onBack={() => setScreen("feed")}
    onSaved={async (p) => {
      await saveProfileToDB(p);
      setActiveProfile(p);
      setScreen("profile");
    }}
  />
);
  if (screen === "review" && activeProfile) return (
    <CharacterReviewForm
      targetUsername={activeProfile.username}
      onBack={() => setScreen("profile")}
      onDone={async () => {
        const refreshed = await loadProfileByUsername(activeProfile.username);
        if (refreshed) setActiveProfile(refreshed);
        setScreen("profile");
      }}
    />
  );

  if (screen === "profile" && activeProfile) return (
    <CharacterProfileView
      profile={activeProfile}
      onBack={handleBack}
      onReview={() => setScreen("review")}
    />
  );

  // ── FEED (default) ──
  const list = search.trim() ? searchResults : feedProfiles;

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em",
          color: "rgba(248,113,113,0.5)", textTransform: "uppercase", marginBottom: 3 }}>
          BondOS
        </div>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em", color: "#fff" }}>
          People
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginTop: 3, lineHeight: 1.5 }}>
          how people really are, built by the people who know them
        </div>
      </div>

      <MyCharacterCard
        username={username || currentUser?.email?.split("@")[0] || localStorage.getItem("bond_username") || "you"}
        onOpenCreate={() => setScreen("create")}
        onOpenEdit={() => setScreen("edit")}
        onViewProfile={handleViewProfile}
      />


      {/* ⚔️ 2FP entry point */}
      <button
        onClick={() => setScreen("2fp_hub")}
        style={{ width: "100%", marginBottom: 14, padding: "11px", borderRadius: 12,
          cursor: "pointer", fontFamily: "inherit",
          background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)",
          color: "#fca5a5", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        ⚔️ Fight for People · view all cases
      </button>

      <div style={{ position: "relative", marginBottom: 12 }}>
        <span style={{ position: "absolute", left: 12, top: "50%",
          transform: "translateY(-50%)", fontSize: 13, opacity: 0.28, pointerEvents: "none" }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search someone to review…"
          style={{ width: "100%", boxSizing: "border-box",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 13, padding: "11px 13px 11px 36px",
            color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
        {searching && (
          <span style={{ position: "absolute", right: 12, top: "50%",
            transform: "translateY(-50%)", fontSize: 11, color: "rgba(255,255,255,0.22)" }}>…</span>
        )}
      </div>

      {!search && (
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
          People on BondOS
        </div>
      )}

      {feedLoading && !search && (
        <div style={{ textAlign: "center", padding: "32px 0",
          color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Loading people…</div>
      )}

      {list.map(p => (
        <PeopleCard key={p.username} profile={p} onViewProfile={handleViewProfile} />
      ))}

      {search && list.length === 0 && !searching && (
        <div style={{ textAlign: "center", padding: "32px 0",
          fontSize: 13, color: "rgba(255,255,255,0.2)" }}>
          No one found for "{search}"
        </div>
      )}

      {!search && !feedLoading && list.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
            No profiles yet — create yours above
          </div>
        </div>
      )}
    </div>
  );
}
/* ---------- Expose / Usage: Wrap your app root with SocialProvider ---------- */
// Example:

//   <SocialProvider>
//     <App />
//   </SocialProvider>
// );
const App = () => {
/* ---------------- SOCIAL AUTH ---------------- */
const { user, loading: authLoading } = useSocial();

/* ---------------- VIEW ---------------- */
const [view, setView] = useState("social"); 

/* ---------------- LOCAL USER MODE ---------------- */
const [isGuest, setIsGuest] = useState(() => {
  const hasUsername = !!localStorage.getItem("bond_username");
  if (!hasUsername) localStorage.setItem("bond_guest", "true");
  return true; // everyone is guest by default until they log in
});
const [username, setUsername] = useState(
() => localStorage.getItem("bond_username") || ""
);

const userKey = username
? username.trim().toLowerCase()
: isGuest
? "guest"
: null;

/* 🔒 DO NOT CHANGE — REQUIRED FOR CLONE / IDEAL */
const { data, save, loaded, isNamesSet } = useRelationshipState(userKey);
  React.useEffect(() => {
    window.currentUser = user;
  }, [user]);
/* ---------------- ANALYTICS ---------------- */
useEffect(() => {
if (!window.BondTrace) return;

const map = {
  people: "people_home",
  play: "play_home",
 // verse:  "verse_home",
  ideal: "ideal_home",
  social: "social_home"
};
BondTrace.screen(map[view] || "home");
}, [view]);

/* ---------------- HANDLERS ---------------- */

const handleUsernameLogin = (u) => {
const x = u.trim();
if (!x) return;

setUsername(x);
localStorage.setItem("bond_username", x);
localStorage.removeItem("bond_guest");
setIsGuest(false);
};

const continueAsGuest = () => {
localStorage.setItem("bond_guest", "true");
setIsGuest(true);
};

const handleReset = () => {
if (!window.confirm("Reset Bond OS locally?")) return;
localStorage.removeItem("bond_username");
localStorage.removeItem("bond_guest");
window.location.reload();
};
const NavBtn = ({ v, icon, label }) => {
  const active = view === v;
  return (
    <button
      onClick={() => setView(v)}
      style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        flex: 1, padding: "7px 4px", borderRadius: 12,
        border: active
          ? "1px solid rgba(248,113,113,0.4)"
          : "1px solid rgba(255,255,255,0.08)",
        background: active ? "rgba(248,113,113,0.08)" : "transparent",
        color: active ? "#f87171" : "rgba(255,255,255,0.32)",
        cursor: "pointer", transition: "all 0.18s ease",
        minWidth: 0, gap: 4, fontFamily: "inherit",
      }}
    >
      <div style={{ width: 20, height: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} className="w-full h-full" />
      </div>
      <span style={{ fontSize: 9, fontWeight: active ? 700 : 500,
        letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </button>
  );
};
/* ---------------- 🔥 AUTH LOADING BLOCK ---------------- */


if (authLoading && userKey) {
 return (
   <div className="bond-app-shell bg-bondBg max-w-md mx-auto flex
items-center justify-center">
     <Spinner />
   </div>
 );
}
/* ---------------- PRE-DASHBOARD FLOW ---------------- */
// ✅ ADD THIS ↓
if (window.location.pathname === "/insta-login") {
  return <InstaLoginPage />;
}
if (!user && !userKey) {
return (
<div className="bond-app-shell bg-bondBg max-w-md mx-auto">
  <div className="bond-main">
    <UsernameLoginScreen
      onLogin={handleUsernameLogin}
      onGuest={continueAsGuest}
    />
  </div>
</div>
);
}

if (!loaded) {
return (
<div className="bond-app-shell bg-bondBg max-w-md mx-auto flex items-center justify-center">
  <Spinner />
</div>
);
}

if (!isNamesSet) {
return (
<div className="bond-app-shell bg-bondBg max-w-md mx-auto">
  <div className="bond-main">
    <NameInputScreen save={save} />
  </div>
</div>
);
}

/* ---------------- VIEW SWITCHER ---------------- */
const renderView = () => {
  switch (view) {
    case "ideal":
      return <IdealMatchHub data={data} save={save} />;
    case "social":
      return <SocialHub />;
    case "people":
      return <CharacterCheckHub currentUser={user} username={username} />;
    default:
      return <Dashboard data={data} save={save} view={view} setView={setView} onReset={handleReset} />;
  }
};
/* ---------------- MAIN APP ---------------- */

return (
  <div className="bond-app-shell bg-bondBg max-w-md mx-auto">
    <div className="bond-main">
      {renderView()}
    </div>

    <div className="bond-bottom-shell">
      <div
        style={{
          background: "rgba(10,14,26,0.94)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "6px 10px",
          paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          gap: 5,
        }}
      >
        <NavBtn v="people" icon="users" label="People" />
        <NavBtn v="social" icon="chat" label="Social" />
        <NavBtn v="moods" icon="pulse" label="Moods" />
        <NavBtn v="verse" icon="atom" label="Verse" />
        <NavBtn v="play" icon="puzzle" label="Play" />
      </div>
    </div>
  </div>
);
};

// ==========================================
// BOND COACH: PANEL + BACKEND CONNECTOR
// ==========================================
const COACH_ENDPOINT =
"https://nkujeixtehrkhqelqbpm.supabase.co/functions/v1/bond-coach";

const coach = {};
let coachContainer = null;
let coachMessagesEl = null;
let coachInputEl = null;
let coachIsOpen = false;

let thinkingEl = null;

function showCoachThinking() {
if (!coachMessagesEl || thinkingEl) return;

thinkingEl = document.createElement("div");
thinkingEl.className = "coach-msg coach-msg-bot coach-msg-thinking";
thinkingEl.innerText = "Thinking…";

coachMessagesEl.appendChild(thinkingEl);
coachMessagesEl.scrollTop = coachMessagesEl.scrollHeight;
}

function removeCoachThinking() {
if (thinkingEl && thinkingEl.parentNode) {
thinkingEl.parentNode.removeChild(thinkingEl);
}
thinkingEl = null;
}

/* ---------------- ENSURE COACH UI ---------------- */

function ensureCoachUI() {
if (coachContainer) return coachContainer;

console.log("[BondCoach] creating UI container");

coachContainer = document.createElement("div");
coachContainer.id = "bondCoach";
coachContainer.className = "bond-coach-root";

/* -------- HTML ONLY (NO JS HERE) -------- */
coachContainer.innerHTML = `
<div class="bond-coach-panel">
<div class="bond-coach-header">
  <span class="bond-coach-title">Bond Coach</span>

  <div class="bond-coach-actions">
    <button
      id="coachMaxBtn"
      class="bond-coach-maximize"
      title="Expand"
    >⤢</button>

    <button
      id="coachCloseBtn"
      class="bond-coach-close"
    >×</button>
  </div>
</div>

<div
  id="coachMessages"
  class="bond-coach-messages"
></div>

<div class="bond-coach-input-row">
  <textarea
    id="coachInput"
    class="bond-coach-input"
    placeholder="Ask Bond Coach anything about your results, patterns, or situation..."
  ></textarea>
  <button
    id="coachSendBtn"
    class="bond-coach-send"
  >Send</button>
</div>
</div>
`;

document.documentElement.appendChild(coachContainer);

/* -------- QUERY ELEMENTS -------- */
coachMessagesEl = coachContainer.querySelector("#coachMessages");
coachInputEl = coachContainer.querySelector("#coachInput");

const closeBtn = coachContainer.querySelector("#coachCloseBtn");
const sendBtn = coachContainer.querySelector("#coachSendBtn");
const maxBtn = coachContainer.querySelector("#coachMaxBtn");

if (!coachMessagesEl || !coachInputEl || !sendBtn) {
console.error("[BondCoach] could not wire UI elements");
return coachContainer;
}

/* -------- EVENT LISTENERS -------- */

if (maxBtn) {
maxBtn.addEventListener("click", () => {
toggleCoachMaximize("header_button");
});
}

if (closeBtn) {
closeBtn.addEventListener("click", () => {
if (isCoachMaximized) toggleCoachMaximize("close_button");
toggleBondCoach();
});
}

sendBtn.addEventListener("click", () => {
console.log("[BondCoach] send button clicked");
sendFromUI();
});

coachInputEl.addEventListener("keydown", (e) => {
if (e.key === "Enter" && !e.shiftKey) {
e.preventDefault();
console.log("[BondCoach] Enter pressed – sending");
sendFromUI();
}
});

return coachContainer;
}
/* ---------------- MESSAGE RENDER ---------------- */

function appendCoachMessage(role, text) {
  if (!coachMessagesEl) return;
  const wrapper = document.createElement("div");
  wrapper.className =
    "coach-msg " + (role === "user" ? "coach-msg-user" : "coach-msg-bot");
  wrapper.innerText = text;
  coachMessagesEl.appendChild(wrapper);
  coachMessagesEl.scrollTop = coachMessagesEl.scrollHeight;
}

// ⚡ NEW — updates the LAST bot message in place (for streaming)
function updateLastBotMessage(text) {
  if (!coachMessagesEl) return;
  const msgs = coachMessagesEl.querySelectorAll(".coach-msg-bot");
  const last = msgs[msgs.length - 1];
  if (last) {
    last.innerText = text;
    coachMessagesEl.scrollTop = coachMessagesEl.scrollHeight;
  }
}

async function sendFromUI() {
  if (!coachInputEl) return;

  const raw = coachInputEl.value;
  const question = (raw || "").trim();
  if (!question) return;

  coachInputEl.value = "";
  appendCoachMessage("user", question);

  const bondId =
    (localStorage.getItem("bond_username") || "").trim().toLowerCase() || "anon";

  const state = window.__BOND_STATE__ || {};

  // ✅ SHOW THINKING IMMEDIATELY
  showCoachThinking();

  try {
    await coach.ask({
      question,
      bondId,
      context: state,
    });
    // ⚡ streaming handles its own UI — nothing to do here
  } catch (err) {
    console.error("[BondCoach] sendFromUI error", err);
    removeCoachThinking();
    appendCoachMessage(
      "bot",
      "Something went wrong talking to Bond Coach. Try again in a bit."
    );
  }
}
async function coachAsk(input) {
  const COACH_ENDPOINT =
    "https://nkujeixtehrkhqelqbpm.supabase.co/functions/v1/bond-coach";

  let userMessage = "";
  let mode = "bond_coach";
  let partnerTraits = "";

  if (typeof input === "string") {
    userMessage = input;
  } else if (input && typeof input === "object") {
    userMessage = input.question || input.userMessage || "";
    mode = input.mode || "bond_coach";
    partnerTraits = input.partnerTraits || "";
  }

  if (!userMessage.trim()) {
    return "Please say something first.";
  }

  console.log("[BondCoach] ask()", { preview: userMessage.slice(0, 80), mode });

  try {
    const res = await fetch(COACH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        mode,
        userMessage,
        partnerTraits,
        stream: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[BondCoach] server error", res.status, text);
      removeCoachThinking();
      appendCoachMessage(
        "bot",
        res.status === 429
          ? "Coach is busy right now 🧠 — try again in a moment."
          : `Something went wrong (${res.status}). Try again.`
      );
      return;
    }

    // ✅ Handle plain JSON (greeting fast-path from edge function)
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      removeCoachThinking();
      appendCoachMessage("bot", data.text || "(no response)");
      return;
    }

    // ⚡ STREAMING — words appear as they generate
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let answer = "";
    let botMsgCreated = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder
        .decode(value, { stream: true })
        .split("\n")
        .filter((l) => l.startsWith("data: "));

      for (const line of lines) {
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;

        try {
          const { token } = JSON.parse(raw);
          if (!token) continue;

          answer += token;

          if (!botMsgCreated) {
            removeCoachThinking();
            appendCoachMessage("bot", answer);
            botMsgCreated = true;
          } else {
            updateLastBotMessage(answer);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    // Safety fallback if nothing came through
    if (!answer) {
      removeCoachThinking();
      appendCoachMessage("bot", "(no response)");
    }

  } catch (err) {
    console.error("[BondCoach] ask() crashed", err);
    removeCoachThinking();
    appendCoachMessage("bot", "Connection error. Please try again.");
  }
}

function toggleBondCoach() {
  console.log("[BondCoach] toggleBondCoach called");
  ensureCoachUI();
  coachIsOpen = !coachIsOpen;
  if (coachContainer) {
    coachContainer.style.display = coachIsOpen ? "block" : "none";
  }
  if (coachIsOpen && coachInputEl) {
    setTimeout(() => coachInputEl && coachInputEl.focus(), 30);
  }
}

coach.ask = coachAsk;
window.BOND_COACH = coach;
window.toggleBondCoach = toggleBondCoach;

window.openCoachFromReact = function (initialPrompt) {
  try {
    toggleBondCoach();
    setTimeout(function () {
      const input = document.getElementById("coachInput");
      if (!input) return;
      if (initialPrompt) input.value = initialPrompt;
      input.focus();
    }, 50);
  } catch (e) {
    console.error("[BondCoach] openCoachFromReact error", e);
  }
};
// ── END OF PASTED CODE ──
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong. We've been notified.</p>}>
      <SocialProvider>
        <App />
      </SocialProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
// Replace your code with this
window.addEventListener('load', () => {
  document.addEventListener('click', (e) => {
    const element = e.target
    
    if(typeof gtag !== 'undefined') { // make sure GA loaded
      gtag('event', 'click', {
        event_category: element.tagName,
        event_label: element.innerText?.slice(0, 50), // limit text length
        page: window.location.pathname
      })
    }
  })
})
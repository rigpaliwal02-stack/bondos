import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './lib/supabase';
import './bond-styles.css';

import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_DSN_HERE",
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.1,
  beforeSend(event) {
    // Don't send errors from localhost
    if (window.location.hostname === "localhost") return null;
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
<div className="flex-1 max-w-md mx-auto w-full px-4 py-6">
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
        text-pink-400 text-sm font-medium
        border border-pink-500/40
        shadow-[0_0_16px_rgba(236,72,153,0.55)]
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
text-sky-400
bg-sky-500/15
border border-sky-400/30

shadow-[0_0_14px_rgba(56,189,248,0.45)]
hover:shadow-[0_0_22px_rgba(56,189,248,0.75)]
hover:bg-sky-500/25

transition-all duration-300
"
>
Ask Coach
</button>


</div>

{/* SOFT GLOW UNDERLINE */}
<div className="h-[1px] bg-gradient-to-r from-transparent via-pink-500/40 to-transparent" />
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

<div className="self-end text-xs text-pink-400">
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

<div className="self-end text-xs text-pink-400">
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
    color: "bg-gradient-to-br from-emerald-500/20 to-cyan-500/10",
  },
  {
    id: "growing-bond",
    name: "Growing Bond",
    description:
      "There’s real warmth here and a lot that works. Some patterns still need deliberate attention.",
    color: "bg-gradient-to-br from-sky-500/20 to-indigo-500/10",
  },
  {
    id: "fragile-chemistry",
    name: "Fragile Chemistry",
    description:
      "The pull is strong, but so are the wobbles. Things easily tip from amazing to confusing.",
    color: "bg-gradient-to-br from-amber-500/20 to-rose-500/10",
  },
  {
    id: "situationship-loop",
    name: "Situationship Loop",
    description:
      "More ambiguity than clarity. High highs, low lows, lots of ‘what are we even doing’.",
    color: "bg-gradient-to-br from-rose-500/20 to-red-500/10",
  },
  {
    id: "unclear-data",
    name: "Unclear / Heavy Zone",
    description:
      "The data is thin or intense but lopsided. Your body might be saying ‘slow down and observe’.",
    color: "bg-gradient-to-br from-slate-500/20 to-slate-700/10",
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
    "bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400 text-bondBg shadow-md hover:shadow-xl";
  const secondaryClasses =
    "bg-bondSurfaceSoft text-bondText border border-bondBorder hover:border-bondAccent/50";
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
      "w-6 h-6 border-2 border-bondAccent/20 border-t-bondAccent rounded-full animate-spin " +
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
              className="text-[10px] py-2 rounded-xl border border-bondBorder bg-bondSurfaceSoft hover:bg-gradient-to-b hover:from-rose-500/20 hover:to-rose-500/5 hover:border-rose-400/70 transition-all card-hover"
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

const submit = () => {
if (!canSave) {
setError("Use at least 2 letters for your name.");
return;
}

const cleaned = partners.map((p) => p.trim()).filter(Boolean);
const [p1Name, maybeP2, ...extra] = cleaned;

// Optional trace (safe)
traceAction?.("onboarding_completed", {
hasPartner: Boolean(maybeP2),
extraPartners: extra.length,
});

save({
p1Name,
p2Name: maybeP2 || null,
extraPartners: extra,
});
};

return (
<div className="h-screen flex flex-col bg-bondBg text-bondText px-8 py-10 max-w-md mx-auto overflow-hidden relative">
<div className="absolute inset-0 pointer-events-none opacity-30">
  <div className="gradient-ring gradient-ring-3" />
</div>

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
const TestHub = ({ data, save }) => {

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
      className="relative bg-bondSurface rounded-2xl border border-bondBorder p-4 mb-3 cursor-pointer group transition-all duration-200 hover:border-bondAccent/60 hover:shadow-[0_0_25px_rgba(255,184,85,0.25)]"
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
    history: cloneChat
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
        hover:shadow-[0_0_22px_rgba(255,105,180,0.12)]
      "
    >
      <h3 className="font-semibold mb-1">{c.title}</h3>
      <p className="text-xs text-bondMuted mb-3">{c.summary}</p>
      <Button onClick={() => openCoachWithPrompt(c.ask)}>Ask AI</Button>
    </div>
  ))}

  <div
    className="
      rounded-3xl p-4
      bg-gradient-to-br from-bondSurface to-bondSurfaceSoft
      border-2 border-bondAccent/30
      transition-all duration-300
      hover:scale-[1.02]
      hover:shadow-[0_0_28px_rgba(255,105,180,0.18)]
    "
  >
    <h3 className="font-semibold mb-1">Partner Clone</h3>
    <p className="text-xs text-bondMuted mb-3">
      Practice hard conversations safely.
    </p>
    <Button
      primary
      className="
        w-full bg-gradient-to-r from-pink-500 via-rose-500 to-amber-400
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
        className="bg-gradient-to-r from-pink-500 to-amber-400"
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
<div className="flex flex-col h-full bg-bondBg text-bondText">
{/* ---------------- TOP BAR ---------------- */}
<div className="px-5 py-3 border-b border-bondBorder flex justify-between items-center bg-bondSurface/70 backdrop-blur-md shadow-sm">

  {/* LEFT: PARTNER DPs + NAMES */}
  <div className="flex items-center gap-3 text-[12px] text-bondMuted">

    {/* P1 DP */}
    <label className="cursor-pointer">
      {getPartnerDP("p1") ? (
        <img
          src={getPartnerDP("p1")}
          className="w-8 h-8 rounded-full object-cover border border-bondBorder"
          alt="P1"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-bondSurfaceSoft border border-bondBorder flex items-center justify-center text-sm">
          +
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => setPartnerDP("p1", reader.result);
          reader.readAsDataURL(file);
        }}
      />
    </label>

    <span>{data.p1Name || "Partner 1"}</span>

    {/* X separator */}
    <span className="mx-1 text-bondAccent font-semibold">×</span>

    {/* P2 DP */}
    <label className="cursor-pointer">
      {getPartnerDP("p2") ? (
        <img
          src={getPartnerDP("p2")}
          className="w-8 h-8 rounded-full object-cover border border-bondBorder"
          alt="P2"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-bondSurfaceSoft border border-bondBorder flex items-center justify-center text-sm">
          +
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => setPartnerDP("p2", reader.result);
          reader.readAsDataURL(file);
        }}
      />
    </label>

    <span>{data.p2Name || "Partner 2"}</span>
  </div>

  {/* RIGHT: STREAK + RESET */}
  <div className="flex items-center space-x-2">
    <div className="px-3 py-1 rounded-full bg-bondSurfaceSoft text-bondMint text-[11px] font-semibold flex items-center">
      <Icon name="flame" className="w-3 h-3 mr-1" />
      {data.streakDays || 0} days
    </div>

    <button
      className="px-2 py-1 rounded-full bg-bondSurfaceSoft text-bondMuted text-[10px] hover:text-red-300 hover:bg-bondSurface transition-colors"
      onClick={onReset}
      title="Reset this Bond universe"
    >
      Reset
    </button>
  </div>
</div>

{/* ---------------- MAIN ---------------- */}
<div className="flex-1 overflow-hidden">
  <ErrorBoundary>
    <div className="h-full overflow-y-auto custom-scroll px-1">
      {{
test: <TestHub data={data} save={save} />,
play: <PlayHub data={data} save={save} />,
plan: <PlanHub data={data} save={save} />,
verse: <VerseHub data={data} save={save} />,
couple: <CoupleHub data={data} save={save} />,  // 🔥 ADD THIS
}[view] || <TestHub data={data} save={save} />
}
    </div>
  </ErrorBoundary>

   <Button onClick={() => setView("couple")}>
💑 Couple
</Button>
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


</div>
);
};

/* -------------------------------------------------------
FIREBASE SETUP
-------------------------------------------------------- */

/* -------------------------------------------------------
SUPABASE AUTH SETUP (TOP OF FILE – OUTSIDE COMPONENT)
-------------------------------------------------------- */


/* ---------------- USER UPSERT ---------------- */
async function upsertUserFromSupabase(user) {
if (!user?.id) return;

const username =
user.user_metadata?.full_name ||
user.email?.split("@")[0] ||
"user";

const { error } = await supabase
.from("profiles")
.upsert(
{
  id: user.id,
  username,
  avatar_url: user.user_metadata?.avatar_url ?? null,
 
},
{ onConflict: "id" }
);

if (error) {
console.error("[upsertUserFromSupabase] failed:", error.message);
}
}

/* ============================================================
BLOCK 2 — REPLACE → const UsernameLoginScreen
============================================================ */
const UsernameLoginScreen = ({ onLogin, onGuest }) => {
const [value,  setValue]  = React.useState("");
const [error,  setError]  = React.useState("");
const [busy,   setBusy]   = React.useState(false);
const [sentTo, setSentTo] = React.useState("");

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const submit = async () => {
const v = value.trim();
if (!v)              return setError("Enter your email to continue.");
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

    {/* Divider */}
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
      <span className="text-xs text-gray-600">or</span>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
    </div>

    {/* OAuth buttons */}
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
        Continue with Google (soon)
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
        Continue with Meta (soon)
      </button>
    </div>
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
React.useEffect(() => {
const channel = window.supabaseClient
.channel("realtime-feed")
.on(
  "postgres_changes",
  { event: "INSERT", schema: "public", table: "posts" },
  payload => {
    setPosts(prev => {
      if (prev.some(p => p.id === payload.new.id)) return prev;
      return [payload.new, ...prev];
    });
  }
)
.subscribe();

return () => {
try {
  window.supabaseClient.removeChannel(channel);
} catch {}
};
}, []);

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

function Notifications() {
const { user } = useSocial();
const [notifications, setNotifications] = React.useState([]);

React.useEffect(() => {
if (!user) return;
let mounted = true;

async function loadNotifications() {
const { data } = await window.supabaseClient
  .from("notifications")
  .select("*")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false });
if (mounted) setNotifications(data || []);
}
loadNotifications();

const channel = window.supabaseClient
.channel("realtime-notifications")
.on("postgres_changes",
  { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
  payload => {
    if (payload.eventType === "INSERT") {
      setNotifications(prev => [payload.new, ...prev]);
    }
  })
.subscribe();

return () => {
mounted = false;
try { window.supabaseClient.removeChannel(channel); } catch (e) {}
};
}, [user]);

return (
<div className="space-y-2">
{notifications.map(n => <div key={n.id} className="bg-bondSurfaceSoft p-3 rounded-xl">{n.message}</div>)}
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
const showCmt = openComments[post.id];
return (
<div key={post.id} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, marginBottom:12, overflow:"hidden" }}>
<div style={{ padding:"12px 14px" }}>
<div style={{ fontSize:13, color:"rgba(255,255,255,0.8)", lineHeight:1.5, marginBottom:10 }}>{getContent(post)}</div>
<div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", marginBottom:10 }}>{fmt(post.created_at)}</div>
<div style={{ display:"flex", gap:5, marginBottom:10 }}>
{EMOJIS.map(emoji => {
const count = rxns[emoji] || 0;
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
{totalRxns > 0 && <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)", marginLeft:4 }}>{totalRxns} react</span>}
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
onMouseEnter={e => e.currentTarget.style.background="rgba(248,113,113,0.08)"}
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
<button onClick={() => onVote(ship.id,"sail")}
style={{ flex:1, padding:"10px", borderRadius:12, background: myVote==="sail" ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.04)", border: myVote==="sail" ? "1px solid rgba(52,211,153,0.4)" : "1px solid rgba(255,255,255,0.09)", color: myVote==="sail" ? "#6ee7b7" : "rgba(255,255,255,0.5)", fontSize:13, fontWeight:800, cursor:"pointer", transition:"all 0.15s", fontFamily:"inherit" }}>
🚢 Sail It
</button>
<button onClick={() => onVote(ship.id,"sink")}
style={{ flex:1, padding:"10px", borderRadius:12, background: myVote==="sink" ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.04)", border: myVote==="sink" ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(255,255,255,0.09)", color: myVote==="sink" ? "#fca5a5" : "rgba(255,255,255,0.5)", fontSize:13, fontWeight:800, cursor:"pointer", transition:"all 0.15s", fontFamily:"inherit" }}>
💀 Sink It
</button>
</div>
<div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
marginTop:10 }}>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.2)" }}>
{ship.is_anonymous ? "dropped by a ghost 👻" : ship.submitter_username ?
`dropped by @${ship.submitter_username}` : "anonymous"}
</div>
<button onClick={() => setShowComments(v => !v)}
style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 11px",
borderRadius:10,
background: showComments ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.04)",
border: showComments ? "1px solid rgba(248,113,113,0.25)" : "1px solid rgba(255,255,255,0.08)",
cursor:"pointer", fontFamily:"inherit" }}>
<span style={{ fontSize:13 }}>💬</span>
<span style={{ fontSize:11, fontWeight:600,
color: showComments ? "#fca5a5" : "rgba(255,255,255,0.4)" }}>
Comment
</span>
</button>
</div>
{showComments && <CommentDrawer targetId={ship.id} targetType="ship" />}
</div>
</div>
);
}

function ShipItHub({ data, save }) {
const [tab, setTab] = React.useState("ships");
const [ships, setShips] = React.useState([]);
const [myVotes, setMyVotes] = React.useState({});
const [loading, setLoading] = React.useState(true);
const [refreshKey, setRefreshKey] = React.useState(0);
const [search, setSearch] = React.useState("");
React.useEffect(() => {
let mounted = true;
async function load() {
setLoading(true);
try {
const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid") || "none";
const [{ data: shipData }, { data: voteData }] = await Promise.all([
window.supabaseClient.from("ship_it").select("*").order("created_at", { ascending:false }).limit(50),
window.supabaseClient.from("ship_votes").select("ship_id,vote").eq("user_id", uid)
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
const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid");
if (!uid) return;
const prev = myVotes[shipId];
const isSame = prev === vote;
setMyVotes(p => ({ ...p, [shipId]: isSame ? null : vote }));
setShips(prev => prev.map(s => {
if (s.id !== shipId) return s;
const ns = { ...s };
if (prev==="sail") ns.sails = Math.max(0,(ns.sails||0)-1);
if (prev==="sink") ns.sinks = Math.max(0,(ns.sinks||0)-1);
if (!isSame) { if (vote==="sail") ns.sails=(ns.sails||0)+1; else ns.sinks=(ns.sinks||0)+1; }
return ns;
}));
try {
const session = await window.supabaseClient.auth.getSession();
const token = session?.data?.session?.access_token ?? window.SUPABASE_ANON_KEY;
await fetch(`${window.SUPABASE_URL}/functions/v1/api-vote-ship`, {
method: "POST",
headers: {
"Content-Type": "application/json",
"Authorization": `Bearer ${token}`
},
body: JSON.stringify({ shipId, vote: isSame ? null : vote }),
});
} catch(e) { console.warn("[ShipIt] vote failed", e); }
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
const TABS = [{ id:"ships", label:"Active Ships" },{ id:"drop", label:" Drop a Ship" },{ id:"hall", label:" Hall of Ships" }];
return (
<AppShell title="🚢 Ship It" onBack={() => save({ playSub: null })}>
<div style={{ display:"flex", gap:4, padding:"3px", borderRadius:14, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", marginBottom:16 }}>
{TABS.map(t => (
<button key={t.id} onClick={() => setTab(t.id)}
style={{ flex:1, padding:"7px 0", borderRadius:11, fontSize:11, fontWeight: tab===t.id ? 700 : 500, background: tab===t.id ? "rgba(248,113,113,0.18)" : "transparent", color: tab===t.id ? "#f87171" : "rgba(255,255,255,0.4)", border: tab===t.id ? "1px solid rgba(248,113,113,0.22)" : "1px solid transparent", cursor:"pointer", transition:"all 0.18s", fontFamily:"inherit" }}>
{t.label}
</button>
))}
</div>
{tab === "ships" && (
<div>
{/* ── Search bar ── */}
<div style={{ position:"relative", marginBottom:12 }}>
<input
type="text" value={search} onChange={e => setSearch(e.target.value)}
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
  style={{ position:"absolute", right:12, top:"50%",
    transform:"translateY(-50%)", background:"rgba(255,255,255,0.12)",
    border:"none", color:"rgba(255,255,255,0.7)", cursor:"pointer",
    width:20, height:20, borderRadius:999, fontSize:12,
    display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>×</button>
: <span style={{ position:"absolute", right:14, top:"50%",
  transform:"translateY(-50%)", color:"rgba(255,255,255,0.2)",
  fontSize:14, pointerEvents:"none" }}>⌕</span>
}
</div>
<div style={{ display:"flex", justifyContent:"space-between",
alignItems:"center", marginBottom:12 }}>
<div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>
{visibleShips.length} ship{visibleShips.length !== 1 ? "s" : ""}
{search ? " found" : " active"}
</div>
<button onClick={() => setRefreshKey(k=>k+1)}style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", color:"rgba(255,255,255,0.35)", cursor:"pointer", borderRadius:8, padding:"5px 10px", fontSize:12, fontFamily:"inherit" }}>↻</button>
</div>
{loading ? <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(248,113,113,0.35)", fontSize:13 }}>Loading ships…</div>
: ships.length === 0 ? (
<div style={{ textAlign:"center", padding:"50px 0" }}>
<div style={{ fontSize:40, marginBottom:8 }}>🚢</div>
<div style={{ color:"rgba(255,255,255,0.25)", fontSize:13 }}>No ships yet — drop the first one!</div>
<button onClick={() => setTab("drop")} style={{ marginTop:16, padding:"10px 24px", borderRadius:14, background:"linear-gradient(135deg,#f87171,#fb923c)", border:"none", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Drop a Ship 🚢</button>
</div>
) : visibleShips.length === 0 && search ? (
<div style={{ textAlign:"center", padding:"40px 0",
color:"rgba(255,255,255,0.25)", fontSize:13 }}>
No ships match "{search}"
</div>
) : visibleShips.map(ship => <ShipCard key={ship.id} ship={ship} onVote={handleVote}
myVote={myVotes[ship.id]||null} />)}
</div>
)}
{tab === "drop" && <DropShipForm onShipDropped={() => { setRefreshKey(k=>k+1); setTab("ships"); }} />}
{tab === "hall" && (
<div>
<div style={{ fontSize:12, color:"rgba(255,255,255,0.3)", marginBottom:14 }}>🏆 Most sailed ships of all time</div>
{loading ? <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(248,113,113,0.35)", fontSize:13 }}>Loading…</div>
: hallShips.length === 0 ? <div style={{ textAlign:"center", padding:"50px 0", color:"rgba(255,255,255,0.2)", fontSize:13 }}><div style={{ fontSize:36, marginBottom:8 }}>🏆</div>No ships yet</div>
: hallShips.map((ship, i) => (
<div key={ship.id} style={{ position:"relative" }}>
{i===0 && <div style={{ position:"absolute", top:-4, right:12, fontSize:18, zIndex:2 }}>👑</div>}
<ShipCard ship={ship} onVote={handleVote} myVote={myVotes[ship.id]||null} />
</div>
))}
</div>
)}
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

const PLACEHOLDER_COUPLES = [
{
id: "__p1", couple_name: "Aria & Zain", couple_type: "Romantic",
bond_score: 91, emotional_sync_score: 88, stability_score: 85,
partner_username: "@ariazain", locality: "London",
backstory: "Met at a midnight market. Never left.",
avatar_url: null, _isPlaceholder: true
},
{
id: "__p2", couple_name: "Maya & Dev", couple_type: "Long Distance",
bond_score: 84, emotional_sync_score: 79, stability_score: 88,
partner_username: "@mayadev", locality: "Mumbai / Toronto",
backstory: "3 timezones. One bond score.",
avatar_url: null, _isPlaceholder: true
},
{
id: "__p3", couple_name: "Sofía & Luca", couple_type: "Friends to Lovers",
bond_score: 76, emotional_sync_score: 82, stability_score: 71,
partner_username: "@sofialuca", locality: "Barcelona",
backstory: "10 years of 'just friends'. Then one honest conversation.",
avatar_url: null, _isPlaceholder: true
},
];

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
const [loading, setLoading] = React.useState(true);
const [realLoaded, setRealLoaded] = React.useState(false);
const [refreshKey, setRefreshKey] = React.useState(0);
const [page, setPage] = React.useState(0);
const [hasMore, setHasMore] = React.useState(true);
const PAGE_SIZE = 12;
const [selectedCouple, setSelectedCouple] = React.useState(null);
const [statusIds, setStatusIds] = React.useState(new Set());
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
setLoading(false);
setRealLoaded(true);
// Still fetch fresh data in background
}
}
// ─────────────────────────────────────────────────────────────────

setLoading(true);
if (!window.supabaseClient) { retryTimer = setTimeout(() => { if (mounted) fetchAll(); }, 300); return; }
setLoading(true);
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
let allRxns = [], allComments = [];
if (ids.length) {
const [rxnRes, cmtRes] = await Promise.all([
window.supabaseClient.from("reactions").select("target_id,user_id,reaction_type")
.eq("target_type","couple").in("target_id", ids),
window.supabaseClient.from("couple_comments").select("couple_id")
.eq("target_type","couple").in("couple_id", ids)
]);
allRxns = rxnRes.data || [];
allComments = cmtRes.data || [];
}
if (!mounted) return;
const uid = window.currentUser?.id || localStorage.getItem("bond_guest_uuid");
const rMap = {}, myMap = {}, cntMap = {};
ids.forEach(id => { rMap[id] = {}; EMOJIS.forEach(e => { rMap[id][e] = 0; }); cntMap[id] = 0; });
allRxns.forEach(r => {
if (rMap[r.target_id] && EMOJIS.includes(r.reaction_type)) {
rMap[r.target_id][r.reaction_type] = (rMap[r.target_id][r.reaction_type] || 0) + 1;
if (uid && r.user_id === uid) myMap[r.target_id] = r.reaction_type;
}
});
allComments.forEach(c => { if (cntMap[c.couple_id] !== undefined) cntMap[c.couple_id]++; });
// Batch status check — one query instead of N queries
let statusSet = new Set();
if (ids.length) {
const { data: statusData } = await window.supabaseClient
.from("couple_statuses")
.select("couple_id")
.in("couple_id", ids)
.gt("expires_at", new Date().toISOString());
(statusData || []).forEach(s => statusSet.add(s.couple_id));
}
setCouples(prev => page === 0 ? safeList : [...prev, ...safeList]);
setHasMore(safeList.length === PAGE_SIZE); setReactions(rMap);
setMyReactions(myMap);
setCommentCounts(cntMap);
setStatusIds(statusSet);

// ── Write cache for instant next visit ──────────────────────────
if (page === 0) {
writeFeedCache({ couples: safeList, reactions: rMap, myReactions: myMap, commentCounts: cntMap });
}
// ────────────────────────────────────────────────────────────────

} catch(err) {
console.error("[CoupleFeed] fetch failed:", err);
if (mounted) setCouples([]);
} finally {
if (mounted) {
setLoading(false);
setRealLoaded(true);    // ← ADD THIS (was just setLoading(false) before)
}
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
if (rankMode === "popular") return arr.sort((a,b) => totalReactions(b.id) - totalReactions(a.id));
if (rankMode === "rising") return arr.filter(c => (Date.now() - new Date(c.created_at).getTime()) < 7*24*60*60*1000).sort((a,b) => (b.bond_score||0) - (a.bond_score||0));
return arr.sort((a,b) => (b.bond_score||0) - (a.bond_score||0));
}, [couples, reactions, rankMode]);

const visible = React.useMemo(() => {
const q = search.trim().toLowerCase();
if (!q) return sorted;
return sorted.filter(c => {
const tokens = [
c.couple_name,
c.partner_username,
c.partner1_name,
c.partner2_name,
c.couple_type,
c.institution,
c.locality,
c.declared_by === "partner" ? "self-declared" : null,
c.declared_by === "outsider" ? "nominated" : null,
].filter(Boolean).map(v => v.toLowerCase());
return tokens.some(t => t.includes(q));
});
}, [sorted, search]);
async function recomputeEngagementScore(coupleId) {
// Only runs for outsider/3rd-party declared couples
try {
const [{ data: rxns }, { data: cmts }, { data: ships }] = await Promise.all([
window.supabaseClient.from("reactions").select("id", { count:"exact" }).eq("target_type","couple").eq("target_id", coupleId),
window.supabaseClient.from("couple_comments").select("id", { count:"exact" }).eq("couple_id", coupleId).eq("target_type","couple"),
window.supabaseClient.from("ship_it").select("sails").or(`person_a_bond_id.eq.${coupleId},person_b_bond_id.eq.${coupleId}`)
]);
const rCount = rxns?.length || 0;
const cCount = cmts?.length || 0;
const sCount = (ships || []).reduce((s, x) => s + (x.sails || 0), 0);
const newScore = Math.min(Math.round(50 + rCount * 0.5 + cCount * 1.5 + sCount * 2), 95);
await window.supabaseClient.from("couples").update({ bond_score: newScore, last_computed_at: new Date().toISOString() }).eq("id", coupleId);
// Update local state instantly
setCouples(prev => prev.map(c => c.id === coupleId ? { ...c, bond_score: newScore } : c));
} catch(e) { console.warn("[engagement score] update failed", e); }
}

async function handleReact(coupleId, emoji) {
const uid = window.currentUser?.id ||
localStorage.getItem("bond_guest_uuid");
if (!uid) return;
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
headers: {
"Content-Type": "application/json",
"Authorization": `Bearer ${token}`
},
body: JSON.stringify({ targetId: coupleId, targetType: "couple", emoji }),
});
} catch(e) { console.warn("[reaction] sync failed", e); }
// Recompute score for outsider couples after reaction
const c = couples.find(x => x.id === coupleId);
if (c?.declared_by === "outsider") recomputeEngagementScore(coupleId);
}
return (
<div style={{ padding:"0 16px" }}>
<div style={{ position:"relative", marginBottom:12 }}>
<input type="text" value={search} onChange={e => setSearch(e.target.value)}
placeholder="Search couples, type, city, college…"
style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:14, padding:"11px 40px 11px 16px", fontSize:13, color:"#fff", outline:"none", transition:"border-color 0.2s", fontFamily:"inherit" }}
onFocus={e => e.target.style.borderColor="rgba(248,113,113,0.35)"}
onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.09)"}
/>
{search
? <button onClick={() => setSearch("")} style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.12)", border:"none", color:"rgba(255,255,255,0.7)", cursor:"pointer", width:20, height:20, borderRadius:999, fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>×</button>
: <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.2)", fontSize:14, pointerEvents:"none" }}>⌕</span>
}
</div>
<div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
<div style={{ position:"relative", flex:1 }}>
<select value={filter} onChange={e => setFilter(e.target.value)}
style={{ width:"100%", appearance:"none", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.09)", color:"#fff", fontSize:13, borderRadius:12, padding:"9px 30px 9px 14px", outline:"none", cursor:"pointer", fontFamily:"inherit" }}>
{TYPES.map(t => <option key={t} value={t} style={{ background:"#0f172a" }}>{t === "all" ? "All Types" : t}</option>)}
</select>
<span style={{ position:"absolute", right:11, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.25)", fontSize:10, pointerEvents:"none" }}>▾</span>
</div>
<div style={{ display:"flex", borderRadius:12, overflow:"hidden", border:"1px solid rgba(255,255,255,0.09)", flexShrink:0 }}>
{[{ id:"bond", label:"🏅 Bond" }, { id:"popular", label:"❤️ Hot" }, { id:"rising", label:"🌱 New" }].map(m => (
<button key={m.id} onClick={() => { setRankMode(m.id); setPage(0); }}
style={{ padding:"8px 12px", fontSize:11, fontWeight:600, cursor:"pointer", border:"none", fontFamily:"inherit", background: rankMode===m.id ? "linear-gradient(135deg,#f87171,#fb923c)" : "rgba(255,255,255,0.04)", color: rankMode===m.id ? "#fff" : "rgba(255,255,255,0.38)", transition:"all 0.15s" }}>
{m.label}
</button>
))}
</div>
<button onClick={() => setRefreshKey(k => k+1)} style={{ width:36, height:36, borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", color:"rgba(255,255,255,0.35)", cursor:"pointer", fontSize:15, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>↻</button>
</div>
{rankMode === "rising" && !loading && <div style={{ fontSize:11, color:"rgba(52,211,153,0.6)", marginBottom:10, fontWeight:600 }}>🌱 New couples this week — sorted by BondScore</div>}
{(() => {
// Not yet loaded from server — show blurred placeholders instantly
if (!realLoaded && visible.length === 0) {
return (
<div style={{ position: "relative" }}>
  {/* gradient overlay to signal "more below" */}
  <div style={{
    position: "absolute", inset: 0, zIndex: 1,
    background: "linear-gradient(180deg, transparent 55%, rgba(2,6,23,0.9) 100%)",
    pointerEvents: "none", borderRadius: 18
  }} />
  {PLACEHOLDER_COUPLES.map(c => (
    <div key={c.id} style={{ opacity: 0.38, filter: "blur(0.6px)", pointerEvents: "none",
      transform: "scale(0.99)", marginBottom: 10 }}>
      <CoupleCard
        couple={c}
        rank={0} total={0}
        reactions={{}} myReaction={null} commentCount={0}
        hasStatus={false}
        onReact={() => {}} onSelect={() => {}}
      />
    </div>
  ))}
  <div style={{
    position: "absolute", bottom: 16, left: 0, right: 0, zIndex: 2,
    textAlign: "center", fontSize: 11,
    color: "rgba(248,113,113,0.55)", fontWeight: 600, letterSpacing: "0.06em"
  }}>Loading live couples…</div>
</div>
);
}

// Loaded but nothing matches search/filter
if (realLoaded && visible.length === 0) {
return (
<div style={{ textAlign: "center", padding: "60px 0" }}>
  <div style={{ fontSize: 20, color: "rgba(255,255,255,0.08)", marginBottom: 8 }}>◇</div>
  <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
    {search.trim() ? "No couples match your search" : "No couples yet"}
  </div>
</div>
);
}

// Normal render — real cards
return visible.map((couple, i) => (
<div key={couple.id} className="bond-fade-up" style={{ animationDelay: `${i * 35}ms` }}>
<CoupleCard
  couple={couple}
  rank={sorted.indexOf(couple) + 1}
  total={sorted.length}
  reactions={reactions[couple.id] || {}}
  
  myReaction={myReactions[couple.id] || null}
  commentCount={commentCounts[couple.id] || 0}
  hasStatus={statusIds.has(couple.id)}
  onReact={(emoji) => handleReact(couple.id, emoji)}
  onSelect={setSelectedCouple}
/>
</div>
));
})()}

{/* Load more */}
{hasMore && !loading && (
  <button
    onClick={() => setPage(p => p + 1)}
    style={{
      width:"100%", padding:"12px", borderRadius:14, marginTop:8,
      background:"rgba(255,255,255,0.05)",
      border:"1px solid rgba(255,255,255,0.09)",
      color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:600,
      cursor:"pointer", fontFamily:"inherit"
    }}>
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
try {
const res = await fetch(
  `${window.SUPABASE_URL}/functions/v1/api-feed?filter=${filter}&page=${page}`,
  { headers: { "Authorization": `Bearer ${window.SUPABASE_ANON_KEY}` } }
);
const { data: couples } = await res.json();
if (coup?.declared_by === "outsider") {
const { data: rxns } = await window.supabaseClient.from("reactions").select("id").eq("target_type","couple").eq("target_id", targetId);
const { data: cmts } = await window.supabaseClient.from("couple_comments").select("id").eq("couple_id", targetId).eq("target_type","couple");
const newScore = Math.min(Math.round(50 + (rxns?.length||0)*0.5 + (cmts?.length||0)*1.5), 95);
await window.supabaseClient.from("couples").update({ bond_score: newScore, last_computed_at: new Date().toISOString() }).eq("id", targetId);
}
} catch(e) { console.warn("[comment score] update failed", e); }
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
function handleFile(e) {
const file = e.target.files?.[0];
if (!file) return;
if (file.size > 5 * 1024 * 1024) { alert("Photo must be under 5MB"); return; }
setImgFile(file);                         // store actual file
const reader = new FileReader();
reader.onload = () => setImgData(reader.result); // preview only
reader.readAsDataURL(file);
}
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

function handleFile(e) {
const file = e.target.files?.[0];
if (!file) return;
if (file.size > 3 * 1024 * 1024) { alert("Photo must be under 3MB"); return; }
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
function CoupleDetailModal({ couple, onClose }) {
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

const [challenges, setChallenges] = React.useState([]);
const [stories, setStories] = React.useState({});
const [editKey, setEditKey] = React.useState(null);
const [editVal, setEditVal] = React.useState("");
const [saving, setSaving] = React.useState(false);
const [loadingAll, setLoadingAll] = React.useState(true);

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
"Romantic":{ bg:"rgba(244,114,182,0.12)", color:"#f9a8d4" },
"Engaged":{ bg:"rgba(167,139,250,0.12)", color:"#c4b5fd" },
"Married":{ bg:"rgba(251,191,36,0.12)", color:"#fde68a" },
"Long Distance":{ bg:"rgba(96,165,250,0.12)", color:"#93c5fd" },
"Situationship":{ bg:"rgba(251,146,60,0.12)", color:"#fdba74" },
"Friends to Lovers":{ bg:"rgba(52,211,153,0.12)", color:"#6ee7b7" },
};
const tc = TYPE_COLORS[couple.couple_type] || { bg:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.4)" };
const displayName = couple.couple_name || couple.partner_username || "Anonymous";
const locationLabel = [couple.institution, couple.locality].filter(Boolean).join(" \u00B7 ");

React.useEffect(() => {
let mounted = true;
async function load() {
const [chRes, stRes] = await Promise.all([
window.supabaseClient.from("couple_challenges").select("challenge_key,xp_awarded,proof_url,proof_note,completed_at")
.eq("couple_id", couple.id).order("completed_at", { ascending:false }),
window.supabaseClient.from("couple_stories").select("question_key,answer")
.eq("couple_id", couple.id)
]);
if (!mounted) return;
setChallenges(chRes.data || []);
const stMap = {};
(stRes.data || []).forEach(s => { stMap[s.question_key] = s.answer; });
setStories(stMap);
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

// Dedupe challenges - only latest per key for once/milestone
const seenKeys = new Set();
const dedupedChallenges = challenges.filter(c => {
const ch = COUPLE_CHALLENGES.find(x => x.key === c.challenge_key);
if (!ch) return false;
if (ch.cadence === "daily" || ch.cadence === "weekly" || ch.cadence === "monthly") return true;
if (seenKeys.has(c.challenge_key)) return false;
seenKeys.add(c.challenge_key); return true;
});

const DIFF_COLORS = { easy:"rgba(52,211,153,0.7)", medium:"rgba(251,191,36,0.7)", hard:"rgba(248,113,113,0.7)", milestone:"rgba(167,139,250,0.7)" };

return (
<div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:1000,
background:"rgba(0,0,0,0.75)", backdropFilter:"blur(8px)",
display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0" }}>
<div onClick={e => e.stopPropagation()}
style={{ width:"100%", maxWidth:480, maxHeight:"92vh", overflowY:"auto",
borderRadius:"24px 24px 0 0", background:"#0e0e12",
border:"1px solid rgba(255,255,255,0.08)", borderBottom:"none",
animation:"bond-fade-up 0.28s ease" }}>

{/* Drag handle */}
<div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
<div style={{ width:36, height:4, borderRadius:999, background:"rgba(255,255,255,0.12)" }} />
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
<span style={{ fontSize:11, padding:"2px 10px", borderRadius:999, background:tc.bg, color:tc.color, fontWeight:700 }}>{sym} {couple.couple_type}</span>
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
  style={{
    display:"flex", alignItems:"center", gap:5,
    padding:"6px 14px", borderRadius:999,
    background:"rgba(255,255,255,0.06)",
    border:"1px solid rgba(255,255,255,0.1)",
    textDecoration:"none", fontSize:12, fontWeight:600,
    color:"rgba(255,255,255,0.7)", cursor:"pointer"
  }}>
  <span>{s.icon}</span>
  <span>{s.label}</span>
</a>
))}
</div>
)}
</div>
<div style={{ textAlign:"right", flexShrink:0 }}>
<div style={{ fontSize:30, fontWeight:900, letterSpacing:"-0.03em",
background:bondGrad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>{bond}</div>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.25)" }}>bond</div>
</div>
</div>

{/* Score trio */}
<div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
{[{ sym:"\u23C1", label:"Sync", val:couple.emotional_sync_score },
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
border:"1px solid rgba(248,113,113,0.12)",
padding:16 }}>
<div style={{ fontSize:11, fontWeight:700,
color:"rgba(255,255,255,0.3)", letterSpacing:"0.1em",
textTransform:"uppercase", marginBottom:10 }}>
📖 Their story
</div>
<div style={{ fontSize:14, color:"rgba(255,255,255,0.8)",
lineHeight:1.7, fontStyle:"italic" }}>
"{couple.backstory}"
</div>
</div>
)}
{/* Challenges done */}
<div style={{ marginBottom:24 }}>
<div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.25)",
letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>
{"\u26A1"} Challenges completed · {dedupedChallenges.length}
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

{/* Story Q&A */}
<div>
<div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.25)",
letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>
{"\uD83D\uDCAC"} Their story
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
style={{ flex:1, padding:"6px", borderRadius:8, background:"rgba(255,255,255,0.05)",
border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.4)",
fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
<button onClick={saveStory} disabled={saving || !editVal.trim()}
style={{ flex:2, padding:"6px", borderRadius:8,
background: editVal.trim() ? "linear-gradient(135deg,#f87171,#fb923c)" : "rgba(255,255,255,0.05)",
border:"none", color: editVal.trim() ? "#fff" : "rgba(255,255,255,0.2)",
fontSize:11, fontWeight:700, cursor: editVal.trim() ? "pointer" : "default",
fontFamily:"inherit" }}>{saving ? "Saving…" : "Save"}</button>
</div>
</div>
) : answered ? (
<div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
<div style={{ fontSize:13, color:"#fff", lineHeight:1.5, flex:1 }}>{answered}</div>
{isOwner && (
<button onClick={() => { setEditKey(sq.key); setEditVal(answered); }}
style={{ flexShrink:0, fontSize:10, color:"rgba(255,255,255,0.2)", background:"none",
border:"none", cursor:"pointer", padding:"2px 6px", fontFamily:"inherit" }}>edit</button>
)}
</div>
) : isOwner ? (
<button onClick={() => { setEditKey(sq.key); setEditVal(""); }}
style={{ fontSize:12, color:"rgba(248,113,113,0.5)", background:"none", border:"none",
cursor:"pointer", fontFamily:"inherit", padding:0, fontWeight:600 }}>
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
style={{ width:"100%", padding:"12px", borderRadius:14, background:"rgba(255,255,255,0.05)",
border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.4)",
fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
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
function CoupleCard({ couple, rank, total, reactions, myReaction,
commentCount, hasStatus, onReact, onSelect }) {
const EMOJIS = ["\u2764\uFE0F","\uD83D\uDE0D","\uD83D\uDD25","\uD83D\uDCAF","\uD83E\uDD79"];
const bond = Math.round(couple.bond_score || 0);
const percentile = total > 1 ? Math.round(((total - rank + 1) / total) * 100) : 100;
const isTop3 = rank <= 3;
const displayName = couple.couple_name || couple.partner_username || "Anonymous";
const [showComments, setShowComments] = React.useState(false);
const RANK_COLORS = {
1: { border:"rgba(251,191,36,0.35)", accent:"#fbbf24", crown:"\uD83D\uDC51" },
2: { border:"rgba(192,192,192,0.25)", accent:"#9ca3af", crown:"\uD83E\uDD48" },
3: { border:"rgba(251,146,60,0.3)", accent:"#fb923c", crown:"\uD83E\uDD49" },
};
const rc = RANK_COLORS[rank] || { border:"rgba(255,255,255,0.07)", accent:"rgba(255,255,255,0.25)", crown:null };
const TYPE_COLORS = {
"Romantic":{ bg:"rgba(244,114,182,0.1)", color:"#f9a8d4" },
"Engaged":{ bg:"rgba(167,139,250,0.1)", color:"#c4b5fd" },
"Married":{ bg:"rgba(251,191,36,0.1)", color:"#fde68a" },
"Long Distance":{ bg:"rgba(96,165,250,0.1)", color:"#93c5fd" },
"Situationship":{ bg:"rgba(251,146,60,0.1)", color:"#fdba74" },
"Friends to Lovers":{ bg:"rgba(52,211,153,0.1)", color:"#6ee7b7" },
};
const tc = TYPE_COLORS[couple.couple_type] || { bg:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.4)" };
const bondColor = bond >= 80 ? "#34d399" : bond >= 55 ? "#f87171" : "#6b7280";
const locationLabel = [couple.institution, couple.locality].filter(Boolean).join(" · ");
const totalRxns = EMOJIS.reduce((s, e) => s + (reactions[e] || 0), 0);
return (
<div style={{ borderRadius:18, marginBottom:10, overflow:"hidden", background:"rgba(255,255,255,0.04)", border:`1px solid ${rc.border}`, backdropFilter:"blur(12px)" }}>
{isTop3 && <div style={{ height:2, background:"linear-gradient(90deg,#f87171,#fb923c,#fbbf24)" }} />}
<div style={{ padding:"16px 16px 14px" }}>
<div onClick={() => onSelect && onSelect(couple)}
style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, cursor:"pointer" }}>
<StatusRingAvatar couple={couple} size={44} rcBorder={rc.border} hasStatus={hasStatus} />
<div style={{ flex:1, minWidth:0 }}>
<div onClick={() => onSelect && onSelect(couple)} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, cursor:"pointer" }}>
{rc.crown && <span style={{ fontSize:14 }}>{rc.crown}</span>}
<div style={{ fontWeight:700, fontSize:15, color:"#fff", letterSpacing:"-0.02em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{displayName}</div>
</div>
<div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5, flexWrap:"wrap" }}>
<span style={{ fontSize:11, padding:"2px 9px", borderRadius:999, background:tc.bg, color:tc.color, fontWeight:600 }}>{couple.couple_type||"Unknown"}</span>
{locationLabel && <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{locationLabel}</span>}
</div>
</div>
<div style={{ textAlign:"right", flexShrink:0 }}>
<div style={{ fontSize:24, fontWeight:800, letterSpacing:"-0.03em", color:bondColor }}>{bond}</div>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", fontWeight:500, marginTop:1 }}>bond</div>
</div>
</div>
<div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
<div style={{ fontSize:11, fontWeight:700, color:rc.accent, padding:"2px 9px", borderRadius:999, background:"rgba(255,255,255,0.04)", border:`1px solid ${rc.border}`, flexShrink:0 }}>#{rank}</div>
<div style={{ flex:1, height:2.5, borderRadius:999, background:"rgba(255,255,255,0.07)" }}>
<div style={{ height:"100%", borderRadius:999, width:`${percentile}%`, background:"linear-gradient(90deg,#f87171,#fb923c)", transition:"width 0.6s ease" }} />
</div>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.2)", fontWeight:500, flexShrink:0 }}>top {percentile}%</div>
</div>
<div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:14 }}>
{[{ label:"Sync", val:couple.emotional_sync_score }, { label:"Stable", val:couple.stability_score }, { label:"Growth", val:couple.growth_index }].map(s => (
<div key={s.label} style={{ borderRadius:10, padding:"9px 6px", textAlign:"center", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)" }}>
<div style={{ fontSize:14, fontWeight:700, color:"#fff" }}>{Math.round(s.val||0)}</div>
<div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{s.label}</div>
</div>
))}
</div>
{/* Social Links row */}
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
  style={{
    display:"flex", alignItems:"center", gap:4,
    padding:"4px 10px", borderRadius:999,
    background:"rgba(255,255,255,0.05)",
    border:"1px solid rgba(255,255,255,0.09)",
    textDecoration:"none", fontSize:11,
    fontWeight:600, color:s.color,
    cursor:"pointer"
  }}>
  <span>{s.icon}</span>
  <span>{s.label}</span>
</a>
))}
</div>
)}
<div style={{ display:"flex", gap:6, marginBottom:12, justifyContent:"space-between" }}>
{EMOJIS.map(emoji => {
const count = reactions[emoji] || 0;
const active = myReaction === emoji;
return (
<button key={emoji} onClick={() => onReact(emoji)}
style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"7px 4px", borderRadius:12, background: active ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.04)", border: active ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(255,255,255,0.07)", cursor:"pointer", transition:"all 0.15s", transform: active ? "scale(1.08)" : "scale(1)" }}>
<span style={{ fontSize:18, lineHeight:1 }}>{emoji}</span>
<span style={{ fontSize:10, fontWeight:700, color: active ? "#fca5a5" : "rgba(255,255,255,0.3)" }}>{count > 0 ? count : ""}</span>
</button>
);
})}
</div>
<div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
<div style={{ fontSize:11, color:"rgba(255,255,255,0.2)" }}>{totalRxns > 0 && `${totalRxns} reaction${totalRxns !== 1 ? "s" : ""}`}</div>
<button onClick={() => setShowComments(v => !v)}
style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:10, background: showComments ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.04)", border: showComments ? "1px solid rgba(248,113,113,0.25)" : "1px solid rgba(255,255,255,0.08)", cursor:"pointer", transition:"all 0.15s", fontFamily:"inherit" }}>
<span style={{ fontSize:13 }}>💬</span>
<span style={{ fontSize:12, fontWeight:600, color: showComments ? "#fca5a5" : "rgba(255,255,255,0.4)" }}>{commentCount > 0 ? commentCount : "Comment"}</span>
</button>
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
const [editAvatarFile, setEditAvatarFile] = React.useState(null);

function handlePhoto(e) {
const file = e.target.files?.[0];
if (!file) return;
if (file.size > 5 * 1024 * 1024) { alert("Photo must be under 5MB"); return; }
setAvatarFile(file); // ← store file ref for save() to use
// Show local preview immediately
const reader = new FileReader();
reader.onload = () => setAvatar(reader.result); // local base64 preview only
reader.readAsDataURL(file);
// Also kick off background upload — save() will await it properly if needed
setAvatarUploading(true);
compressImage(file).then(compressed =>
uploadToStorage("avatars", compressed, "couples/")
).then(url => {
if (url) setAvatar(url); // replace preview with real Supabase URL
setAvatarUploading(false);
});
}
async function save() {
if (!answers.duration) { setError("Pick how long you've been together."); return; }
setSaving(true); setError("");

// Wait for avatar upload if still in progress
if (avatarFile && avatarUploading) {
const compressed = await compressImage(avatarFile, 800, 0.8);
const url = await uploadToStorage("avatars", compressed, "couples/");
if (url) setAvatar(url);
setAvatarUploading(false);
}

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
    name1, name2, avatar, declaredBy, coupleType,
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
const res = await fetch(`${window.SUPABASE_URL}/functions/v1/api-statuses`, {
method: "POST",
headers: {
"Content-Type": "application/json",
"Authorization": `Bearer ${token}`
},
body: JSON.stringify({
coupleId,
imageUrl: url,
caption: caption.trim() || null,
}),
});
const data = await res.json();
const error = res.ok ? null : data;
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
const [submitting, setSubmitting] = React.useState(false);

const needsProof = ["once_photo","rom_weekly_date","rom_weekly_cook","rom_once_surprise",
"mar_once_recreate","ld_daily_photo","ld_once_package","weekly_new",
"ftl_weekly_roots","ftl_once_origin","mar_weekly_memory"].includes(ch.key);

function handleFile(e) {
const file = e.target.files?.[0];
if (!file) return;
if (file.size > 2 * 1024 * 1024) { alert("Photo must be under 2MB"); return; }
const reader = new FileReader();
reader.onload = () => setProofImg(reader.result);
reader.readAsDataURL(file);
}

async function submitWithProof() {
setSubmitting(true);
await onComplete(proofImg, proofNote.trim() || null);
setShowProof(false);
setProofImg(null);
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

function SocialHub() {
const { loading } = useSocial();
const [tab, setTab] = React.useState("feed");
if (loading) return (
<div style={{ display:"flex", alignItems:"center", justifyContent:"center",
padding:"60px 0", color:"rgba(248,113,113,0.4)", fontSize:13, fontWeight:500 }}>
Loading…
</div>
);
return (
<div style={{ paddingBottom:8 }}>
<div style={{ padding:"18px 20px 0", marginBottom:4 }}>
  <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em",
    color:"rgba(255,255,255,0.2)", textTransform:"uppercase", marginBottom:12 }}>
    Social
  </div>
  <div style={{ display:"flex", gap:4, padding:"3px", borderRadius:14,
    background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)" }}>
    {[
      { id:"feed", label:"Discover" },
      { id:"couple", label:"My Couple" },
      { id:"challenges", label:"\u26A1 Challenges" },
    ].map(t => (
      <button key={t.id} onClick={() => setTab(t.id)}
        style={{ flex:1, padding:"8px 0", borderRadius:11, fontSize:12,
          fontWeight: tab===t.id ? 700 : 500,
          background: tab===t.id ? "rgba(248,113,113,0.18)" : "transparent",
          color: tab===t.id ? "#f87171" : "rgba(255,255,255,0.4)",
          border: tab===t.id ? "1px solid rgba(248,113,113,0.22)" : "1px solid transparent",
          cursor:"pointer", transition:"all 0.18s ease", fontFamily:"inherit" }}>
        {t.label}
      </button>
    ))}
  </div>
</div>
<div style={{ marginTop:16 }}>
  {tab === "feed" && <CoupleFeed />}
  {tab === "couple" && <CoupleHub />}
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
const [view, setView] = useState("test");

/* ---------------- LOCAL USER MODE ---------------- */
const [isGuest, setIsGuest] = useState(
() => localStorage.getItem("bond_guest") === "true"
);

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

/* ---------------- ANALYTICS ---------------- */
useEffect(() => {
if (!window.BondTrace) return;

const map = {
test: "test_home",
play: "play_home",
plan: "plan_home",
verse: "verse_home",
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
const isSocial = v === "social";
if (isSocial) {
return (
  <button
   onClick={() => setView(v)}
   style={{
     display:"flex", alignItems:"center", gap:7,
     padding:"10px 20px", borderRadius:999,
     background: active ? "linear-gradient(135deg,#f87171,#fb923c)" : "rgba(248,113,113,0.1)",
     border: active ? "1px solid rgba(248,113,113,0.55)" : "1px solid rgba(248,113,113,0.22)",
     color: active ? "#fff" : "rgba(248,113,113,0.75)",
     fontWeight:700, fontSize:13, letterSpacing:"-0.01em",
     cursor:"pointer",
     boxShadow: active ? "0 6px 22px rgba(248,113,113,0.32),0 2px 8px rgba(0,0,0,0.25)" : "0 2px 10px rgba(248,113,113,0.1)",
     transform:"translateY(-7px)",
     transition:"all 0.2s ease",
     flexShrink:0,
   }}
  >
   <Icon name={icon} style={{ width:15, height:15 }} />
   <span>Social</span>
  </button>
);
}
return (
<button
 onClick={() => setView(v)}
 style={{
   display:"flex", flexDirection:"column", alignItems:"center",
   padding:"6px 8px", borderRadius:12, border:"none", cursor:"pointer",
   background:"transparent",
   color: active ? "#f87171" : "rgba(255,255,255,0.38)",
   transition:"all 0.18s ease",
 }}
>
 <Icon name={icon} className="w-5 h-5" style={{ marginBottom:2 }} />
 <span style={{ fontSize:10, fontWeight: active ? 700 : 500 }}>{label}</span>
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

default:
  return (
    <Dashboard
      data={data}
      save={save}
      view={view}
      setView={setView}
      onReset={handleReset}
    />
  );
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
background: "rgba(10,14,26,0.88)",
backdropFilter: "blur(18px)",
borderTop: "1px solid rgba(255,255,255,0.07)",
padding: "8px 12px 16px",
display: "flex",
alignItems: "flex-end",
justifyContent: "space-around",
}}
>
<NavBtn v="test" icon="heart" label="Test" />
<NavBtn v="verse" icon="atom" label="Verse" />
<NavBtn v="social" icon="users" label="Social" />
<NavBtn v="plan" icon="calendar" label="Plan" />
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
"coach-msg " +
(role === "user" ? "coach-msg-user" : "coach-msg-bot");

wrapper.innerText = text;
coachMessagesEl.appendChild(wrapper);
coachMessagesEl.scrollTop = coachMessagesEl.scrollHeight;
}
async function sendFromUI() {
if (!coachInputEl) return;

const raw = coachInputEl.value;
const question = (raw || "").trim();
if (!question) return;

coachInputEl.value = "";
appendCoachMessage("user", question);

const bondId =
(localStorage.getItem("bond_username") || "")
.trim()
.toLowerCase() || "anon";

const state = window.__BOND_STATE__ || {};

// ✅ SHOW THINKING IMMEDIATELY
showCoachThinking();

try {
const answer = await coach.ask({
question,
bondId,
context: state,
});

removeCoachThinking();
appendCoachMessage("bot", answer || "(no reply from server)");
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
// 🔑 DEFINE KEY INSIDE FUNCTION (INLINE BABEL SAFE)

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

console.log("[BondCoach] ask()", {
preview: userMessage.slice(0, 80),
mode,
});

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
}),
});

if (!res.ok) {
const text = await res.text();
console.error("[BondCoach] server error", res.status, text);
return `Server error (${res.status})`;
}

const raw = await res.text();

if (raw.trim().startsWith("<")) {
console.error("HTML RESPONSE RECEIVED:", raw.slice(0, 200));
return "Server routing error.";
}

const data = JSON.parse(raw);
return data.text || "(no response)";

} catch (err) {
console.error("[BondCoach] ask() crashed", err);
return "Connection error. Please try again.";
}
}


function toggleBondCoach() {
  console.log("[BondCoach] toggleBondCoach called");
  ensureCoachUI();
  coachIsOpen = !coachIsOpen;
  if (coachContainer) {
    coachContainer.style.display = coachIsOpen ? "block" : 
"none";
  }
  if (coachIsOpen && coachInputEl) {
    setTimeout(() => coachInputEl && coachInputEl.focus(), 
30);
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

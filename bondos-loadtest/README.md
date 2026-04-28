# BondOS Load Test — Social Tab + People Tab

> **1,000 concurrent users** hitting every action in the **People** and **Social** tabs.

---

## What's tested

### People Tab (`CharacterCheckHub`)
| Scenario | What it does |
|---|---|
| `people_feed` | Load feed (30 profiles), view one profile, search by name/college, My Character Card, paginate |
| `character_review` | Submit full Character Review Form (ratings, pill questions, archetype, animal, flags, quote) + reviewer sheet |
| `fight_for_people` | Load 2FP hub, start a session, send messages, vote, invite ally, join side, browse existing sessions |

### Social Tab (`SocialHub`)
| Scenario | What it does |
|---|---|
| `couple_feed` | Load discover feed, filter by type, rank by bond/hot/rising, search keywords, paginate |
| `couple_reactions` | Add reaction to couple card, toggle (remove), react on 2nd couple, post comment, fetch comments |
| `couple_detail` | Open detail modal, load challenges/stories/photos, save story Q&A, post 24h status, complete a challenge, create couple profile |
| `ship_it` | Load active ships, hall of ships, vote on ships, drop a new ship (30% VUs), celeb ship vote, comment on ship |

---

## Setup

### 1. Add GitHub Secrets

Go to **Settings → Secrets → Actions** and add:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | Your project URL e.g. `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Your anon/public key |

### 2. Push this folder to your repo

```
bondos-loadtest/
├── .github/workflows/full-loadtest.yml
└── k6/
    ├── main.js
    ├── config/thresholds.js
    ├── helpers/supabase.js
    └── scenarios/
        ├── people_feed.js
        ├── character_review.js
        ├── fight_for_people.js
        ├── couple_feed.js
        ├── couple_reactions.js
        ├── couple_detail.js
        └── ship_it.js
```

### 3. Run

Go to **Actions → BondOS Full Load Test → Run workflow**

| Input | Default | Options |
|---|---|---|
| `vus` | `1000` | any number |
| `duration` | `10m` | `5m`, `10m`, `20m` |
| `scenario` | `all` | `all`, `people_feed`, `character_review`, `fight_for_people`, `couple_feed`, `couple_reactions`, `couple_detail`, `ship_it` |

---

## Traffic weights (when `scenario=all`)

| Scenario | Weight | Reason |
|---|---|---|
| `couple_feed` | 28% | Heaviest — everyone scrolls the discover feed |
| `people_feed` | 20% | Second heaviest — browsing people |
| `couple_reactions` | 16% | Reactions + comments are frequent |
| `ship_it` | 12% | Ship It is a high-traffic feature |
| `character_review` | 8% | Form-heavy, less frequent |
| `couple_detail` | 8% | Modal opens, story saves, challenge completes |
| `fight_for_people` | 8% | Write-heavy, less frequent |

---

## SLA thresholds

All features must hit:
- `p(95) < 1.0–2.5s` depending on feature
- `error rate < 3%`
- `92%` of all k6 checks must pass

Full list in `k6/config/thresholds.js`.

---

## Local run

```bash
k6 run \
  --vus 50 \
  --duration 2m \
  --env SUPABASE_URL=https://your-project.supabase.co \
  --env SUPABASE_ANON_KEY=your_anon_key \
  --env SCENARIO=all \
  k6/main.js
```

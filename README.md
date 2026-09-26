# Digital Assessment Engine — WordPress Plugin

**Version:** 2.1.0 · **Requires PHP:** 8.0+ · **Requires WordPress:** 6.2+

A production-grade, SaaS-quality interactive assessment and scorecard engine with React frontend, weighted scoring engine, radar chart visualisations, lead capture, email automation, and analytics.

---

## Table of Contents

1. [Features](#features)
2. [Architecture Overview](#architecture-overview)
3. [Installation & Setup](#installation--setup)
4. [Build System](#build-system)
5. [Database Schema](#database-schema)
6. [REST API Reference](#rest-api-reference)
7. [Shortcode & Block Usage](#shortcode--block-usage)
8. [Scoring Engine](#scoring-engine)
9. [Email System](#email-system)
10. [Role-Based Access Control](#role-based-access-control)
11. [Extensibility (Hooks & Filters)](#extensibility-hooks--filters)
12. [Performance Considerations](#performance-considerations)
13. [Security](#security)
14. [Deployment Checklist](#deployment-checklist)

---

## Features

| Category        | Features |
|-----------------|----------|
| **Assessment**  | Multi-step flow, drag-drop builder, version control, bulk import (JSON/CSV), preview, duplicate |
| **Questions**   | 5 types: Single choice, Multi-choice, Scale (1–N), Text, Boolean |
| **Scoring**     | Weighted per-option + per-block scoring, normalized 0–100, dynamic level mapping |
| **Results**     | Radar chart (Recharts), score breakdown bars, personalised recommendations |
| **Lead Gate**   | Email-gated full report, GDPR consent, upsert deduplication |
| **Email**       | HTML-branded user results email + admin notification |
| **Analytics**   | Completion rate, drop-off, score distribution, level breakdown, daily trends |
| **Admin Panel** | Full React SPA — assessment list, question builder, leads table, analytics charts, settings |
| **RBAC**        | `dap_admin`, `dap_editor`, `dap_viewer` roles + WordPress capability system |
| **Security**    | Nonce verification, rate limiting (DB-backed), input sanitization, prepared SQL |
| **Performance** | WordPress object cache, indexed DB tables, lazy-loaded React chunks |

---

## Architecture Overview

```
digital-assessment-engine/
├── digital-assessment-engine.php   ← Plugin bootstrap & constants
├── block.json                      ← Gutenberg block registration
├── uninstall.php                ← Safe uninstall handler
│
├── includes/
│   ├── class-plugin.php         ← Singleton + service container
│   ├── class-installer.php      ← DB schema, activation/deactivation
│   │
│   ├── access/
│   │   └── class-role-manager.php    ← RBAC (3 roles, 11 capabilities)
│   │
│   ├── api/
│   │   ├── class-router.php          ← REST route bootstrapper
│   │   ├── class-base-controller.php ← Shared helpers, rate limiting
│   │   ├── class-assessments-controller.php
│   │   ├── class-submissions-controller.php  ← Also contains Leads + Analytics
│   │   └── class-questions-controller.php    ← Inside assessments file
│   │
│   ├── engine/
│   │   └── class-scoring-engine.php  ← Weighted scoring, level map, recommendations
│   │
│   ├── email/
│   │   └── class-mailer.php          ← HTML email system
│   │
│   ├── cache/
│   │   └── class-manager.php         ← WP object cache wrapper
│   │
│   ├── security/
│   │   └── class-rate-limiter.php    ← DB-backed sliding-window rate limiter
│   │
│   ├── analytics/
│   │   └── class-tracker.php         ← Event tracker (also contains Frontend\Loader)
│   │
│   └── admin/
│       └── class-manager.php         ← Admin menu, asset enqueueing, settings
│
├── src/                          ← React source (Vite + JSX)
│   ├── main.jsx                  ← Public-facing app mount
│   ├── admin.jsx                 ← Admin app mount
│   ├── App.jsx                   ← Root component with phase routing
│   ├── AdminApp.jsx              ← Full admin SPA
│   │
│   ├── store/
│   │   └── assessmentStore.js    ← Zustand store + API client
│   │
│   ├── components/
│   │   ├── AssessmentFlow/       ← Intro, QuestionFlow, Submitting, question types
│   │   ├── Results/              ← FullResults, ResultsGate, ScoreBreakdown, Recs
│   │   ├── Charts/               ← RadarChart, ScoreRing
│   │   ├── LeadCapture/          ← LeadCaptureForm
│   │   └── UI/                   ← Button, ProgressBar, Loading, Error
│   │
│   └── styles/
│       ├── app.css               ← Complete design system (public)
│       └── admin.css             ← Admin panel styles
│
├── assets/                       ← Compiled by Vite (git-ignored)
├── templates/
│   └── emails/                   ← PHP email templates (theme-overridable)
│
├── package.json
└── vite.config.js
```

---

## Installation & Setup

### Manual Install

```bash
# 1. Clone / upload to wp-content/plugins/
cd wp-content/plugins
git clone https://github.com/your-repo/digital-assessment-pro.git

# 2. Install Node dependencies & build
cd digital-assessment-pro
npm install
npm run build

# 3. Activate the plugin in WP Admin → Plugins
```

### Composer (optional)

```bash
composer require your-vendor/digital-assessment-pro
```

---

## Build System

```bash
npm run dev          # Vite dev server on :3000 (proxies to local WP)
npm run build        # Production build → /assets/
npm run build:watch  # Watch mode for development
```

**Output structure after build:**
```
assets/
├── manifest.json
├── js/
│   ├── app.[hash].js          ← Public assessment app
│   ├── admin.[hash].js        ← Admin SPA
│   ├── vendor-react.[hash].js
│   ├── vendor-charts.[hash].js
│   └── vendor-motion.[hash].js
└── css/
    ├── app.[hash].css
    └── admin.[hash].css
```

---

## Database Schema

### Tables Overview

| Table | Purpose |
|-------|---------|
| `dap_assessments` | Assessment definitions |
| `dap_assessment_versions` | Immutable published snapshots |
| `dap_blocks` | Sections / radar axes |
| `dap_questions` | Individual questions |
| `dap_options` | Answer options with scores |
| `dap_submissions` | Completed assessments |
| `dap_submission_answers` | Per-question answer log |
| `dap_leads` | Lead contact info |
| `dap_analytics_events` | Event stream |
| `dap_rate_limits` | Sliding-window rate limiting |

### Key Design Decisions

- **Versioned assessments:** `dap_assessment_versions.snapshot` stores the full frozen JSON of questions/options at publish time. Old submissions reference their original snapshot — editing live questions never breaks historical data.
- **Stable `question_key`:** Each question gets a `q_XXXX` key at creation. Analytics always reference this key so reports stay consistent across edits.
- **UUID public IDs:** `dap_submissions.uuid` (v4) is the public-facing reference — never expose sequential integer IDs.

---

## REST API Reference

**Base URL:** `https://your-site.com/wp-json/assessment/v1`

All authenticated endpoints require WordPress cookie auth or `X-WP-Nonce` header.

---

### GET `/assessment`

List published assessments.

**Query Parameters:**
| Param | Default | Values |
|-------|---------|--------|
| `status` | `published` | `published`, `draft`, `archived` |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "slug": "digital-maturity",
      "title": "Digital Maturity Assessment",
      "status": "published",
      "current_version": 3,
      "created_at": "2025-01-15 10:30:00"
    }
  ]
}
```

---

### GET `/assessment/{id}`

Single assessment with version info.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "digital-maturity",
    "title": "Digital Maturity Assessment",
    "description": "Measure your organisation's digital readiness.",
    "status": "published",
    "settings": { "theme_color": "#3B82F6" },
    "version": {
      "id": 3,
      "version_number": 3,
      "published_at": "2025-02-01 09:00:00"
    }
  }
}
```

---

### POST `/assessment` 🔐 `dap_manage_assessments`

Create a new assessment.

**Body:**
```json
{
  "title": "Sales Readiness Assessment",
  "description": "Evaluate your sales team's maturity.",
  "settings": { "theme_color": "#10B981" }
}
```

**Response:** `201 Created`
```json
{ "success": true, "data": { "id": 5, "slug": "sales-readiness-assessment" } }
```

---

### POST `/assessment/{id}/publish` 🔐 `dap_publish_assessments`

Publish a new version (freezes a snapshot).

**Body:**
```json
{ "changelog": "Updated scoring weights for Q3 review." }
```

---

### POST `/assessment/{id}/duplicate` 🔐 `dap_manage_assessments`

Duplicate an assessment as a new draft.

---

### GET `/questions?assessment_id={id}`

Get all blocks with nested questions and options for an assessment.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Strategy",
      "color": "#3B82F6",
      "weight": 1.5,
      "questions": [
        {
          "id": 10,
          "question_text": "How defined is your digital strategy?",
          "question_type": "single",
          "is_required": "1",
          "options": [
            { "id": 101, "option_text": "No strategy", "score_value": 0, "weight": 1 },
            { "id": 102, "option_text": "Informal", "score_value": 1, "weight": 1 },
            { "id": 103, "option_text": "Documented", "score_value": 2, "weight": 1 },
            { "id": 104, "option_text": "Fully integrated", "score_value": 3, "weight": 1 }
          ]
        }
      ]
    }
  ]
}
```

---

### POST `/questions/import` 🔐 `dap_manage_questions`

Bulk import questions from JSON.

**Body:**
```json
{
  "assessment_id": 1,
  "questions": [
    {
      "block": "Technology",
      "question": "How modern is your tech stack?",
      "type": "single",
      "options": [
        { "text": "Legacy (10+ years)", "score_value": 0 },
        { "text": "Mixed", "score_value": 1 },
        { "text": "Modern cloud-native", "score_value": 3 }
      ]
    }
  ]
}
```

---

### POST `/questions/reorder` 🔐 `dap_manage_questions`

Reorder questions (drag-and-drop).

**Body:**
```json
{
  "items": [
    { "id": 10, "order": 0, "block_id": 1 },
    { "id": 11, "order": 1, "block_id": 1 },
    { "id": 15, "order": 2, "block_id": 2 }
  ]
}
```

---

### POST `/submit`

Submit a completed assessment. **Rate limited:** 20/hour per IP.

**Body:**
```json
{
  "assessment_id": 1,
  "session_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "duration_seconds": 340,
  "utm_source": "linkedin",
  "utm_medium": "cpc",
  "utm_campaign": "q4-digital",
  "answers": {
    "10": 102,
    "11": [201, 203],
    "12": 4,
    "13": "Our main challenge is talent."
  }
}
```

**Answer formats by question type:**
| Type | Format |
|------|--------|
| `single` | `option_id` (integer) |
| `multi` | `[option_id, option_id]` (array) |
| `scale` | `scale_value` (1–N integer) |
| `boolean` | `true` or `false` |
| `text` | `"string"` |

**Response:**
```json
{
  "success": true,
  "data": {
    "uuid": "7f3d9a12-...",
    "submission_id": 42,
    "score": 68.5,
    "level": {
      "key": "proficient",
      "label": "Proficient",
      "color": "#3B82F6",
      "description": "Strong performance across most areas."
    },
    "block_scores": { "1": 72.0, "2": 55.0, "3": 88.0 },
    "recommendations": [
      {
        "block_id": 2,
        "block_title": "People & Culture",
        "score": 55.0,
        "priority": "high",
        "text": "Prioritise improving your People & Culture capabilities…"
      }
    ],
    "require_lead": true
  }
}
```

---

### GET `/result/{uuid}`

Fetch a completed result by public UUID.

---

### POST `/lead`

Capture lead and unlock full report. **Rate limited:** 5/hour per IP.

**Body:**
```json
{
  "email": "priya@example.com",
  "first_name": "Priya",
  "last_name": "Sharma",
  "company": "Acme Corp",
  "gdpr_consent": true,
  "submission_id": 42
}
```

**Response:**
```json
{ "success": true, "data": { "lead_id": 15, "unlocked": true } }
```

---

### GET `/leads` 🔐 `dap_view_leads`

Paginated lead list.

**Query:** `?page=1&per_page=25&level=proficient`

---

### GET `/leads/export` 🔐 `dap_export_leads`

Downloads leads as CSV. (Direct PHP response — not a JSON API.)

---

### GET `/analytics` 🔐 `dap_view_analytics`

Overview analytics.

**Response:**
```json
{
  "success": true,
  "data": {
    "total_submissions": 1240,
    "completed": 1050,
    "completion_rate": 84.7,
    "total_leads": 830,
    "avg_score": 61.4,
    "score_distribution": [
      { "bucket": 0, "count": 12 },
      { "bucket": 10, "count": 28 }
    ],
    "level_breakdown": [
      { "score_level": "proficient", "count": 412 }
    ],
    "submissions_by_day": [
      { "date": "2025-01-15", "count": 48 }
    ],
    "top_drop_off": [
      { "question_id": 15, "events": 32 }
    ]
  }
}
```

---

### GET `/analytics/assessment/{id}` 🔐 `dap_view_analytics`

Per-assessment stats including top answers and block averages.

---

### Error Responses

All errors follow the format:

```json
{
  "code": "dap/rate_limited",
  "message": "Too many requests. Please try again later.",
  "data": { "status": 429 }
}
```

**HTTP Status Codes used:**
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / missing params |
| 401 | Authentication required |
| 403 | Forbidden / insufficient permissions |
| 404 | Resource not found |
| 422 | Validation failed |
| 429 | Rate limited |
| 500 | Server error |

---

## Shortcode & Block Usage

### Shortcode

```php
[dap_assessment id="1"]
[dap_assessment slug="digital-maturity"]
```

### Gutenberg Block

Search for "Digital Assessment" in the block inserter. Configure assessment ID or slug in the block sidebar.

### PHP Template Tag

```php
<?php echo do_shortcode('[dap_assessment id="1"]'); ?>
```

---

## Scoring Engine

### Algorithm

```
1. Per-option:
   awarded = option.score_value × option.weight

2. Per-question (single):
   score = awarded for selected option
   max   = highest possible option score

3. Per-block:
   raw_block_score = Σ(awarded) / Σ(max_per_question) × 100
   weighted        = raw_block_score × block.weight

4. Total normalized score (0–100):
   total = Σ(block_normalized × block.weight) / Σ(block.weight)
```

### Level Mapping (configurable via Settings)

| Level | Range | Default Color | Label |
|-------|-------|---------------|-------|
| RED | 0–21 | `#c02b12` | High risk — act before you build |
| AMBER | 22–36 | `#e76424` | Moderate risk — specific gaps to close |
| GOLD | 37–50 | `#edaf18` | Low risk — optimise remaining gaps |
| GREEN | 51–57 | `#069e7b` | Benchmark readiness — sustain and scal |

Modify via **Admin → Settings → Score Levels** or the `dap/score_levels` filter.

---

## Email System

Two emails sent automatically after lead capture:

1. **User Results Email** — includes score, level, and link to full report
2. **Admin Notification** — new lead alert with score and admin link

### Customise Templates

Override any email by creating a PHP file in your theme:

```
your-theme/
└── digital-assessment-pro/
    └── emails/
        ├── user-results.php
        └── admin-notification.php
```

Available variables in templates: `$name`, `$email`, `$score`, `$score_level`, `$result_url`, `$level_color`, `$site_name`.

---

## Role-Based Access Control

| Capability | Admin | Editor | Viewer |
|-----------|-------|--------|--------|
| `dap_manage_assessments` | ✅ | ✅ | ❌ |
| `dap_publish_assessments` | ✅ | ✅ | ❌ |
| `dap_delete_assessments` | ✅ | ❌ | ❌ |
| `dap_manage_questions` | ✅ | ✅ | ❌ |
| `dap_view_submissions` | ✅ | ✅ | ✅ |
| `dap_view_leads` | ✅ | ✅ | ✅ |
| `dap_export_leads` | ✅ | ❌ | ❌ |
| `dap_delete_leads` | ✅ | ❌ | ❌ |
| `dap_view_analytics` | ✅ | ✅ | ❌ |
| `dap_manage_settings` | ✅ | ❌ | ❌ |

WordPress administrators automatically receive all `dap_admin` capabilities.

---

## Extensibility (Hooks & Filters)

### Actions

```php
// Fired after plugin initialises
do_action('dap/init', $plugin_instance);

// Fired after an assessment is created/updated/published/deleted
do_action('dap/assessment/created',   $assessment_id);
do_action('dap/assessment/updated',   $assessment_id);
do_action('dap/assessment/published', $assessment_id, $version_id);
do_action('dap/assessment/deleted',   $assessment_id);

// Fired after a submission is completed
do_action('dap/submission/completed', $submission_id, $result_array, $assessment);

// Fired after a lead is captured
do_action('dap/lead/captured', $lead_id, $submission_id, $lead_data);

// Analytics event hook
do_action('dap/analytics/event', $event_type, $assessment_id, $payload);
```

### Filters

```php
// Modify total score after calculation
add_filter('dap/score/total', function($score, $answers, $questions) {
    return $score;
}, 10, 3);

// Modify block scores
add_filter('dap/score/blocks', function($block_scores, $answers, $blocks) {
    return $block_scores;
}, 10, 3);

// Modify score level thresholds
add_filter('dap/score_levels', function($levels) {
    return $levels;
});

// Modify recommendations
add_filter('dap/recommendations', function($recs, $block_scores, $block_map) {
    return $recs;
}, 10, 3);

// Modify API response for an assessment
add_filter('dap/api/assessment', function($data) {
    return $data;
});

// Add/modify i18n strings passed to React
add_filter('dap/i18n', function($strings) {
    $strings['startBtn'] = 'Begin Your Assessment';
    return $strings;
});

// Modify email subject
add_filter('dap/email/results_subject', function($subject) {
    return $subject;
});
```

### Example: CRM Integration

```php
add_action('dap/lead/captured', function($lead_id, $submission_id, $lead_data) {
    // Push to HubSpot, Salesforce, Mailchimp, etc.
    $client = new Mycrm\Client(MY_API_KEY);
    $client->contacts->upsert([
        'email'       => $lead_data['email'],
        'first_name'  => $lead_data['first_name'],
        'score'       => $lead_data['normalized_score'],
        'score_level' => $lead_data['score_level'],
    ]);
}, 10, 3);
```

---

## Performance Considerations

### Database Indexes

All hot-path columns are indexed. Key composite indexes:
- `(assessment_id, version_id)` on questions, blocks, submissions
- `(identifier, action)` on rate_limits (UNIQUE)
- `uuid` on submissions (UNIQUE)
- `email` on leads (UNIQUE)

### Caching

Object cache is used for:
- Assessment list (`dap_assessments_published`)
- Question tree per assessment (`dap_questions_{id}`)
- Analytics overview (`dap_analytics_overview`)

Cache TTL configurable in Settings (default: 300s). Use a persistent cache backend (Redis, Memcached) for production.

### Asset Loading

Assets only enqueue when the page contains a `[dap_assessment]` shortcode or block. Admin assets only load on plugin admin pages.

Vite produces code-split chunks:
- `vendor-react` (cached separately — rarely changes)
- `vendor-charts` (loaded only in Results phase via lazy import)
- `vendor-motion` (animations)

---

## Security

| Threat | Mitigation |
|--------|-----------|
| SQL Injection | All queries use `$wpdb->prepare()` |
| CSRF | WordPress nonce on all state-mutating requests |
| Rate abuse | DB-backed sliding window (per IP hash, per action) |
| XSS | All output escaped via `esc_html()`, `esc_attr()`, `esc_url()` |
| Unauthorised access | Per-endpoint capability checks + `RoleManager::rest_permission()` |
| Data leakage | UUIDs for public IDs, IP hashing in rate limiter |
| Uninstall | Explicit `WP_UNINSTALL_PLUGIN` check, opt-in data retention |

---

## Deployment Checklist

### Pre-deployment

- [ ] Run `npm run build` — verify `/assets/manifest.json` exists
- [ ] Set `DAP_SEED_DEMO` to `false` (or leave undefined) for production
- [ ] Configure SMTP plugin (WP Mail SMTP, FluentSMTP, etc.) for reliable email
- [ ] Enable persistent object cache (Redis / Memcached) in `wp-config.php`
- [ ] Set `WP_DEBUG` to `false`

### Post-activation

- [ ] Go to **Assessments → New Assessment** → create your first assessment
- [ ] Add blocks and questions in the Builder
- [ ] Click **Publish** to create the first version
- [ ] Add `[dap_assessment id="1"]` to any page
- [ ] Test full flow: intro → questions → submit → lead capture → results email
- [ ] Configure email settings in **Settings → Plugin Settings**
- [ ] Assign `dap_editor` role to team members who manage content

### Scaling to 10k+ Users

- Use a managed MySQL 8.x instance (AWS RDS, PlanetScale)
- Enable Redis with `WP_CACHE = true` + Redis Object Cache plugin
- Serve assets from CDN (Cloudfront, Bunny.net) — update `DAP_ASSETS_URL`
- Consider read replicas for analytics queries
- Rate limit at load balancer / Cloudflare level in addition to plugin-level limiting
- Archive old `dap_analytics_events` rows monthly via WP-Cron

---

## Changelog

### 2.1.0 (2026)
- Customized first screen layout with left-aligned title/description, teal badge, and gold icons.
- Updated maturity band thresholds and colors (RED, AMBER, GOLD, GREEN) across frontend and backend.
- Disabled automatic question transition upon option select; added manual next/back navigation controls.
- Configured font-family inheritance to match active WordPress themes.

### 2.0.0 (2025)
- Complete rebuild with React 18 + Vite + Zustand
- Versioned assessment snapshots
- Weighted scoring engine
- Radar chart results
- Full admin SPA
- Rate limiting
- RBAC

---

## License

GPL v2 or later — see [LICENSE](https://www.gnu.org/licenses/gpl-2.0.html)

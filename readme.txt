=== Digital Assessment Pro ===
Contributors:      jayshah88
Tags:              assessment, quiz, scoring, radar-chart, analytics
Requires at least: 6.2
Tested up to:      6.7
Requires PHP:      8.0
Stable tag:        2.1.0
License:           GPL v2 or later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Enterprise-grade digital assessment engine with React UI, weighted scoring, radar charts, lead capture, and analytics.

== Description ==

**Digital Assessment Pro** is a production-grade, SaaS-quality assessment plugin for WordPress. It enables you to build scored multi-step assessments with beautiful radar chart results, lead capture gating, full analytics, and extensible architecture.

**Core Features:**

* 🎯 **Dynamic Assessment Engine** — Multi-step question flows with 5 question types (single, multi, scale, text, boolean)
* 📊 **Advanced Scoring Engine** — Weighted, normalized scoring with configurable level mapping
* 🕸️ **Radar Chart Visualization** — Beautiful Recharts-powered multi-axis capability radar
* 🔒 **Lead Gate** — Conditional email capture to unlock full reports
* 📧 **Professional Email System** — HTML templated user + admin emails
* 📈 **Analytics Module** — Completion rates, drop-off points, score distributions, level breakdown
* 🔄 **Versioned Assessments** — Edit without breaking historical submission data
* 👥 **Role-Based Access** — Admin / Editor / Viewer roles with WordPress capabilities
* ⚡ **React + Vite Frontend** — Code-split, lazy-loaded, mobile-first SPA
* 🛡️ **Security** — Nonces, sanitization, escaping, rate limiting

**Shortcode Usage:**

`[dap_assessment id="1"]`
`[dap_assessment slug="my-assessment"]`

**Gutenberg Block:**

Available as "Digital Assessment" block in the Interactive category.

**REST API:**

Full REST API at `/wp-json/assessment/v1/` — see API documentation.

**Extensibility:**

Rich set of WordPress actions and filters for extending scoring logic, email templates, recommendations, and score levels.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to **Assessments → Assessments** to create your first assessment
4. Build your questions using the **Builder** tab
5. Publish the version and embed with shortcode or Gutenberg block

**Build from source (developers):**

```bash
cd digital-assessment-pro
npm install
npm run build
```

== Frequently Asked Questions ==

= Can I have multiple assessments on the same site? =
Yes. Each assessment has its own slug, questions, and analytics.

= Does the scoring support weighted questions? =
Yes. Each option has a `score_value` and a `weight` multiplier. Blocks also have weights that affect the total radar chart and final score.

= How does versioning work? =
When you publish a new version, a frozen snapshot of all questions/options is stored. Historical submissions always reference their original snapshot, so editing live questions never corrupts old data.

= Is it GDPR compliant? =
The lead capture form includes a GDPR consent checkbox. Consent timestamp is stored per lead. You can delete individual leads from the admin panel.

= Can I export leads? =
Yes — go to Leads → Export CSV to download all captured leads with scores and metadata.

== Screenshots ==

1. Assessment intro screen — premium consulting-grade UI
2. Multi-step question flow with progress indicator
3. Radar chart results with score breakdown
4. Lead capture gate (email unlock)
5. Admin analytics dashboard
6. Question builder with drag-and-drop

== Changelog ==

= 2.1.0 =
* Customized first screen layout with left-aligned title/description, teal badge, and gold icons.
* Updated maturity band thresholds and colors (RED, AMBER, GOLD, GREEN) across frontend and backend.
* Disabled automatic question transition upon option select; added manual next/back navigation controls.
* Configured font-family inheritance to match active WordPress themes.

= 2.0.0 =
* Complete rewrite with React 18 + Vite build system
* Versioned assessment architecture
* Advanced scoring engine with block weights
* Radar chart results with Recharts
* Full analytics module
* Role-based access control
* Rate limiting on all public endpoints
* Framer Motion animations
* Mobile-first responsive design

= 1.0.0 =
* Initial release

== Upgrade Notice ==

= 2.0.0 =
Major version — back up your database before upgrading from 1.x. Run the plugin deactivation and reactivation after upgrade to update DB schema.

<?php
/**
 * Installer — Handles activation, deactivation, uninstall, and DB schema creation.
 *
 * @package DigitalAssessmentPro
 */

namespace DigitalAssessmentPro;

defined( 'ABSPATH' ) || exit;

class Installer {

	// ─── Activation ───────────────────────────────────────────────────────
	public static function activate(): void {
		self::create_tables();
		self::set_default_options();
		self::seed_demo_data();

		// Register custom capabilities and roles on activation.
		if ( class_exists( '\DigitalAssessmentPro\Access\RoleManager' ) ) {
			( new \DigitalAssessmentPro\Access\RoleManager() )->register();
		}

		// Upgrade dynamic options database to v2 limits and colors (run once to protect user customizations).
		if ( ! get_option( 'dap_options_v2_migrated' ) ) {
			self::upgrade_options_to_v2();
			update_option( 'dap_options_v2_migrated', true );
		}

		// Purge unused email options from database
		delete_option( 'dap_email_from_name' );
		delete_option( 'dap_email_from_address' );
		delete_option( 'dap_email_nurture' );

		update_option( 'dap_db_version', DAP_DB_VERSION );
		update_option( 'dap_activated_at', time() );

		flush_rewrite_rules();
		do_action( 'dap/activated' );
	}

	// ─── Deactivation ─────────────────────────────────────────────────────
	public static function deactivate(): void {
		flush_rewrite_rules();
		wp_clear_scheduled_hook( 'dap/analytics_flush' );
		do_action( 'dap/deactivated' );
	}

	// ─── Uninstall ────────────────────────────────────────────────────────
	public static function uninstall(): void {
		if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
			return;
		}

		$keep_data = rest_sanitize_boolean( get_option( 'dap_keep_data_on_uninstall', false ) );
		if ( $keep_data ) {
			return;
		}

		self::drop_tables();
		self::delete_options();
		if ( class_exists( '\DigitalAssessmentPro\Access\RoleManager' ) ) {
			\DigitalAssessmentPro\Access\RoleManager::remove_roles();
		}
		do_action( 'dap/uninstalled' );
	}

	// ─── Schema ───────────────────────────────────────────────────────────
	public static function create_tables(): void {
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		// ── assessments ──────────────────────────────────────────────────
		dbDelta( "
			CREATE TABLE {$wpdb->prefix}dap_assessments (
				id                  BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
				slug                VARCHAR(200)        NOT NULL,
				title               VARCHAR(500)        NOT NULL,
				description         LONGTEXT            DEFAULT NULL,
				status              ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
				current_version     BIGINT(20) UNSIGNED DEFAULT NULL,
				author_id           BIGINT(20) UNSIGNED NOT NULL,
				settings            LONGTEXT            DEFAULT NULL COMMENT 'JSON config blob',
				hubspot_enabled     TINYINT(1)          NOT NULL DEFAULT 0 COMMENT 'Use custom HubSpot config for this assessment',
				hubspot_use_global  TINYINT(1)          NOT NULL DEFAULT 1 COMMENT 'Use global HubSpot settings (1) or custom (0)',
				hubspot_portal_id   VARCHAR(50)         DEFAULT NULL,
				hubspot_form_id     VARCHAR(200)        DEFAULT NULL,
				hubspot_region      VARCHAR(20)         DEFAULT 'na1',
				created_at          DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at          DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				UNIQUE KEY   slug (slug),
				KEY          author_id (author_id),
				KEY          status (status),
				KEY          hubspot_enabled (hubspot_enabled)
			) {$charset_collate};"
		);

		// ── assessment_versions ───────────────────────────────────────────
		dbDelta( "
			CREATE TABLE {$wpdb->prefix}dap_assessment_versions (
				id              BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
				assessment_id   BIGINT(20) UNSIGNED NOT NULL,
				version_number  INT(11) UNSIGNED    NOT NULL DEFAULT 1,
				changelog       TEXT                DEFAULT NULL,
				is_published    TINYINT(1)          NOT NULL DEFAULT 0,
				published_at    DATETIME            DEFAULT NULL,
				created_by      BIGINT(20) UNSIGNED NOT NULL,
				snapshot        LONGTEXT            DEFAULT NULL COMMENT 'Full frozen JSON of questions/options at publish time',
				created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				UNIQUE KEY   version_per_assessment (assessment_id, version_number),
				KEY          assessment_id (assessment_id),
				KEY          is_published (is_published)
			) {$charset_collate};"
		);

		// ── blocks (sections / categories within an assessment) ────────────
		dbDelta( "
			CREATE TABLE {$wpdb->prefix}dap_blocks (
				id              BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
				assessment_id   BIGINT(20) UNSIGNED NOT NULL,
				version_id      BIGINT(20) UNSIGNED NOT NULL,
				title           VARCHAR(500)        NOT NULL,
				description     TEXT                DEFAULT NULL,
				icon            VARCHAR(100)        DEFAULT NULL,
				color           VARCHAR(20)         DEFAULT NULL,
				weight          DECIMAL(5,2)        NOT NULL DEFAULT 1.00 COMMENT 'Radar axis weight',
				sort_order      INT(11) UNSIGNED    NOT NULL DEFAULT 0,
				settings        LONGTEXT            DEFAULT NULL COMMENT 'JSON',
				PRIMARY KEY  (id),
				KEY          assessment_version (assessment_id, version_id),
				KEY          sort_order (sort_order)
			) {$charset_collate};"
		);

		// ── questions ─────────────────────────────────────────────────────
		dbDelta( "
			CREATE TABLE {$wpdb->prefix}dap_questions (
				id              BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
				block_id        BIGINT(20) UNSIGNED NOT NULL,
				assessment_id   BIGINT(20) UNSIGNED NOT NULL,
				version_id      BIGINT(20) UNSIGNED NOT NULL,
				question_key    VARCHAR(100)        NOT NULL COMMENT 'Stable key for analytics',
				question_text   TEXT                NOT NULL,
				helper_text     TEXT                DEFAULT NULL,
				question_type   ENUM('single','multi','scale','text','boolean') NOT NULL DEFAULT 'single',
				is_required     TINYINT(1)          NOT NULL DEFAULT 1,
				weight          DECIMAL(5,2)        NOT NULL DEFAULT 1.00,
				sort_order      INT(11) UNSIGNED    NOT NULL DEFAULT 0,
				settings        LONGTEXT            DEFAULT NULL COMMENT 'JSON: conditional logic, etc.',
				PRIMARY KEY  (id),
				KEY          block_id (block_id),
				KEY          assessment_version (assessment_id, version_id),
				KEY          question_key (question_key)
			) {$charset_collate};"
		);

		// ── options ───────────────────────────────────────────────────────
		dbDelta( "
			CREATE TABLE {$wpdb->prefix}dap_options (
				id              BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
				question_id     BIGINT(20) UNSIGNED NOT NULL,
				option_text     TEXT                NOT NULL,
				option_value    VARCHAR(200)        NOT NULL,
				score_value     DECIMAL(5,2)        NOT NULL DEFAULT 0.00,
				weight          DECIMAL(5,2)        NOT NULL DEFAULT 1.00,
				sort_order      INT(11) UNSIGNED    NOT NULL DEFAULT 0,
				PRIMARY KEY  (id),
				KEY          question_id (question_id)
			) {$charset_collate};"
		);

		// ── submissions ────────────────────────────────────────────────────
		dbDelta( "
			CREATE TABLE {$wpdb->prefix}dap_submissions (
				id              BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
				uuid            VARCHAR(36)         NOT NULL COMMENT 'Public-facing UUID',
				assessment_id   BIGINT(20) UNSIGNED NOT NULL,
				version_id      BIGINT(20) UNSIGNED NOT NULL,
				lead_id         BIGINT(20) UNSIGNED DEFAULT NULL,
				total_score     DECIMAL(6,2)        DEFAULT NULL,
				normalized_score DECIMAL(5,2)       DEFAULT NULL COMMENT '0–100',
				score_level     VARCHAR(100)        DEFAULT NULL,
				block_scores    LONGTEXT            DEFAULT NULL COMMENT 'JSON: { block_id: score }',
				status          ENUM('in_progress','completed','abandoned') NOT NULL DEFAULT 'in_progress',
				ip_address      VARCHAR(45)         DEFAULT NULL,
				user_agent      VARCHAR(500)        DEFAULT NULL,
				referrer        VARCHAR(1000)       DEFAULT NULL,
				utm_source      VARCHAR(200)        DEFAULT NULL,
				utm_medium      VARCHAR(200)        DEFAULT NULL,
				utm_campaign    VARCHAR(200)        DEFAULT NULL,
				started_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
				completed_at    DATETIME            DEFAULT NULL,
				duration_seconds INT(11) UNSIGNED   DEFAULT NULL,
				PRIMARY KEY  (id),
				UNIQUE KEY   uuid (uuid),
				KEY          assessment_id (assessment_id),
				KEY          version_id (version_id),
				KEY          lead_id (lead_id),
				KEY          status (status),
				KEY          score_level (score_level),
				KEY          started_at (started_at),
				KEY          assessment_status (assessment_id, status)
			) {$charset_collate};"
		);

		// ── submission_answers ────────────────────────────────────────────
		dbDelta( "
			CREATE TABLE {$wpdb->prefix}dap_submission_answers (
				id              BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
				submission_id   BIGINT(20) UNSIGNED NOT NULL,
				question_id     BIGINT(20) UNSIGNED NOT NULL,
				question_key    VARCHAR(100)        NOT NULL,
				option_ids      TEXT                DEFAULT NULL COMMENT 'Comma-separated option IDs',
				text_answer     TEXT                DEFAULT NULL,
				score_awarded   DECIMAL(5,2)        DEFAULT NULL,
				answered_at     DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				KEY          submission_id (submission_id),
				KEY          question_id (question_id),
				KEY          question_key (question_key)
			) {$charset_collate};"
		);

		// ── leads ─────────────────────────────────────────────────────────
		dbDelta( "
			CREATE TABLE {$wpdb->prefix}dap_leads (
				id              BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
				email           VARCHAR(320)        NOT NULL,
				first_name      VARCHAR(200)        DEFAULT NULL,
				last_name       VARCHAR(200)        DEFAULT NULL,
				company         VARCHAR(300)        DEFAULT NULL,
				phone           VARCHAR(50)         DEFAULT NULL,
				score_level     VARCHAR(100)        DEFAULT NULL COMMENT 'Latest tag',
				normalized_score DECIMAL(5,2)       DEFAULT NULL,
				source          VARCHAR(200)        DEFAULT NULL COMMENT 'assessment slug or UTM source',
				tags            TEXT                DEFAULT NULL COMMENT 'Comma-separated tags',
				metadata        LONGTEXT            DEFAULT NULL COMMENT 'JSON',
				gdpr_consent    TINYINT(1)          NOT NULL DEFAULT 0,
				consent_at      DATETIME            DEFAULT NULL,
				created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				UNIQUE KEY   email (email),
				KEY          score_level (score_level),
				KEY          created_at (created_at)
			) {$charset_collate};"
		);

		// ── analytics_events ─────────────────────────────────────────────
		dbDelta( "
			CREATE TABLE {$wpdb->prefix}dap_analytics_events (
				id              BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
				event_type      VARCHAR(100)        NOT NULL COMMENT 'view|start|question_answer|complete|lead_capture|drop',
				assessment_id   BIGINT(20) UNSIGNED NOT NULL,
				submission_id   BIGINT(20) UNSIGNED DEFAULT NULL,
				question_id     BIGINT(20) UNSIGNED DEFAULT NULL,
				option_id       BIGINT(20) UNSIGNED DEFAULT NULL,
				payload         LONGTEXT            DEFAULT NULL COMMENT 'JSON metadata',
				session_id      VARCHAR(36)         DEFAULT NULL,
				ip_address      VARCHAR(45)         DEFAULT NULL,
				created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				KEY          event_type (event_type),
				KEY          assessment_id (assessment_id),
				KEY          submission_id (submission_id),
				KEY          created_at (created_at)
			) {$charset_collate};"
		);

		// ── rate_limits ───────────────────────────────────────────────────
		dbDelta( "
			CREATE TABLE {$wpdb->prefix}dap_rate_limits (
				id              BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
				identifier      VARCHAR(200)        NOT NULL COMMENT 'IP or user hash',
				action          VARCHAR(100)        NOT NULL,
				hits            INT(11) UNSIGNED    NOT NULL DEFAULT 1,
				window_start    DATETIME            NOT NULL,
				PRIMARY KEY  (id),
				UNIQUE KEY   identifier_action (identifier, action, window_start),
				KEY          window_start (window_start)
			) {$charset_collate};"
		);
	}

	/**
	 * Safe database reference.
	 */
	private static function db(): \wpdb {
		global $wpdb;
		return $wpdb;
	}

	// ─── Drop Tables ──────────────────────────────────────────────────────
	public static function drop_tables(): void {
		$db = self::db();

		$table_suffixes = [
			'dap_rate_limits',
			'dap_analytics_events',
			'dap_submission_answers',
			'dap_submissions',
			'dap_leads',
			'dap_options',
			'dap_questions',
			'dap_blocks',
			'dap_assessment_versions',
			'dap_assessments',
		];

		foreach ( $table_suffixes as $suffix ) {
			// Ensure only valid alphanumeric and underscore table identifiers are used
			$table_name = sanitize_key( $db->prefix . $suffix );

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.SchemaChange
			$db->query(
				$db->prepare(
					'DROP TABLE IF EXISTS %i /* %s */',
					$table_name,
					$table_name
				)
			);
		}
	}

	// ─── Default Options ─────────────────────────────────────────────────
	private static function set_default_options(): void {
		$defaults = [
			'dap_keep_data_on_uninstall' => false,
			'dap_lead_gate_enabled'      => true,
			'dap_rate_limit_per_hour'    => 10,
			'dap_cache_ttl'              => 300, // 5 minutes
			'dap_cta_url_base'           => home_url( '/contact' ),

			// Dynamic content - Band Copy
			'dap_band_copy'              => wp_json_encode( \DigitalAssessmentPro\Content\ContentManager::get_default_band_copy() ),

			// Dynamic content - UI Labels
			'dap_ui_labels'              => wp_json_encode( \DigitalAssessmentPro\Content\ContentManager::get_default_ui_labels() ),

			// Dynamic content - PDF Template
			'dap_pdf_template'           => wp_json_encode( \DigitalAssessmentPro\Content\ContentManager::get_default_pdf_template() ),

			'dap_score_levels'           => wp_json_encode( [
				[
					'key'           => 'red',
					'label'         => 'High risk — act before you build',
					'band'          => 'RED',
					'min'           => 0,
					'max'           => 21,
					'color'         => '#c02b12',
					'description'   => 'Significant gaps in capability readiness. At current trajectory, schedule slippage and costly rework are likely.',
					'interpretation'=> 'The decisions being deferred now will cost significantly more to fix after execution begins.',
					'cta_label'     => 'Schedule a consultation with an expert',
					'cta_url'       => home_url( '/contact' ),
				],
				[
					'key'           => 'amber',
					'label'         => 'Moderate risk — specific gaps to close',
					'band'          => 'AMBER',
					'min'           => 22,
					'max'           => 36,
					'color'         => '#e76424',
					'description'   => 'Good foundations in some areas, but material gaps remain in high-weight dimensions.',
					'interpretation'=> 'Addressing these now is significantly cheaper than addressing them during execution.',
					'cta_label'     => 'Review recommended actions and priorities',
					'cta_url'       => home_url( '/contact' ),
				],
				[
					'key'           => 'gold',
					'label'         => 'Low risk — optimise remaining gaps',
					'band'          => 'GOLD',
					'min'           => 37,
					'max'           => 50,
					'color'         => '#edaf18',
					'description'   => 'Strong readiness across most dimensions. The remaining gaps are specific and addressable.',
					'interpretation'=> 'Use the dimension breakdown to prioritise the remaining actions before proceeding.',
					'cta_label'     => 'Explore acceleration strategies for your programme',
					'cta_url'       => home_url( '/contact' ),
				],
				[
					'key'           => 'green',
					'label'         => 'Benchmark readiness — sustain and scale',
					'band'          => 'GREEN',
					'min'           => 51,
					'max'           => 57,
					'color'         => '#069e7b',
					'description'   => 'Your programme is structured for on-time delivery. The risk now is complacency.',
					'interpretation'=> 'Maintaining this standard across scaling or new initiatives requires deliberate discipline.',
					'cta_label'     => 'Benchmark and scale your programme',
					'cta_url'       => home_url( '/contact' ),
				],
			] ),
		];

		foreach ( $defaults as $key => $value ) {
			if ( false === get_option( $key ) ) {
				add_option( $key, $value );
			}
		}
	}

	private static function delete_options(): void {
		$options = [
			'dap_keep_data_on_uninstall',
			'dap_lead_gate_enabled',
			'dap_rate_limit_per_hour',
			'dap_cache_ttl',
			'dap_cta_url_base',
			'dap_band_copy',
			'dap_ui_labels',
			'dap_pdf_template',
			'dap_score_levels',
			'dap_hubspot_config',
			'dap_global_settings',
			'dap_db_version',
			'dap_options_v2_migrated',
		];
		foreach ( $options as $opt ) {
			delete_option( $opt );
		}
	}

	// ─── Demo Seed (dev only) ─────────────────────────────────────────────
	private static function seed_demo_data(): void {
		if ( ! defined( 'DAP_SEED_DEMO' ) || ! DAP_SEED_DEMO ) {
			return;
		}
		// Seed a sample assessment for first-time users.
		// (Omitted for brevity — implement if DAP_SEED_DEMO constant is defined.)
	}

	/**
	 * Upgrade active database options to use the new colors and score ranges.
	 */
	public static function upgrade_options_to_v2(): void {
		$score_levels = [
			[
				'key'           => 'red',
				'label'         => 'High risk — act before you build',
				'band'          => 'RED',
				'min'           => 0,
				'max'           => 21,
				'color'         => '#c02b12',
				'description'   => 'Significant gaps in capability readiness. At current trajectory, schedule slippage and costly rework are likely.',
				'interpretation'=> 'The decisions being deferred now will cost significantly more to fix after execution begins.',
				'cta_label'     => 'Schedule a consultation with an expert',
				'cta_url'       => home_url( '/contact' ),
			],
			[
				'key'           => 'amber',
				'label'         => 'Moderate risk — specific gaps to close',
				'band'          => 'AMBER',
				'min'           => 22,
				'max'           => 36,
				'color'         => '#e76424',
				'description'   => 'Good foundations in some areas, but material gaps remain in high-weight dimensions.',
				'interpretation'=> 'Addressing these now is significantly cheaper than addressing them during execution.',
				'cta_label'     => 'Review recommended actions and priorities',
				'cta_url'       => home_url( '/contact' ),
			],
			[
				'key'           => 'gold',
				'label'         => 'Low risk — optimise remaining gaps',
				'band'          => 'GOLD',
				'min'           => 37,
				'max'           => 50,
				'color'         => '#edaf18',
				'description'   => 'Strong readiness across most dimensions. The remaining gaps are specific and addressable.',
				'interpretation'=> 'Use the dimension breakdown to prioritise the remaining actions before proceeding.',
				'cta_label'     => 'Explore acceleration strategies for your programme',
				'cta_url'       => home_url( '/contact' ),
			],
			[
				'key'           => 'green',
				'label'         => 'Benchmark readiness — sustain and scale',
				'band'          => 'GREEN',
				'min'           => 51,
				'max'           => 57,
				'color'         => '#069e7b',
				'description'   => 'Your programme is structured for on-time delivery. The risk now is complacency.',
				'interpretation'=> 'Maintaining this standard across scaling or new initiatives requires deliberate discipline.',
				'cta_label'     => 'Benchmark and scale your programme',
				'cta_url'       => home_url( '/contact' ),
			],
		];
		update_option( 'dap_score_levels', wp_json_encode( $score_levels ) );

		$colors = [
			'red'   => '#c02b12',
			'amber' => '#e76424',
			'gold'  => '#edaf18',
			'green' => '#069e7b',
		];
		update_option( 'dap_performance_colors', wp_json_encode( $colors ) );

		$band_copy = \DigitalAssessmentPro\Content\ContentManager::get_default_band_copy();
		update_option( 'dap_band_copy', wp_json_encode( $band_copy ) );

		$ui_labels = \DigitalAssessmentPro\Content\ContentManager::get_default_ui_labels();
		update_option( 'dap_ui_labels', wp_json_encode( $ui_labels ) );

		self::normalize_legacy_levels();
	}

	/**
	 * Normalize any legacy/synonym level strings in submissions and leads to canonical red, amber, gold, green.
	 */
	public static function normalize_legacy_levels(): void {
		$db = self::db();
		$sub_table = $db->prefix . 'dap_submissions';
		$leads_table = $db->prefix . 'dap_leads';

		$db->query(
			$db->prepare(
				'UPDATE %i SET score_level = %s WHERE score_level IN (%s, %s)',
				$sub_table,
				'green',
				'advanced',
				'expert'
			)
		);
		$db->query(
			$db->prepare(
				'UPDATE %i SET score_level = %s WHERE score_level = %s',
				$sub_table,
				'gold',
				'proficient'
			)
		);
		$db->query(
			$db->prepare(
				'UPDATE %i SET score_level = %s WHERE score_level IN (%s, %s)',
				$sub_table,
				'amber',
				'developing',
				'intermediate'
			)
		);
		$db->query(
			$db->prepare(
				'UPDATE %i SET score_level = %s WHERE score_level = %s',
				$sub_table,
				'red',
				'beginner'
			)
		);

		$db->query(
			$db->prepare(
				'UPDATE %i SET score_level = %s WHERE score_level IN (%s, %s)',
				$leads_table,
				'green',
				'advanced',
				'expert'
			)
		);
		$db->query(
			$db->prepare(
				'UPDATE %i SET score_level = %s WHERE score_level = %s',
				$leads_table,
				'gold',
				'proficient'
			)
		);
		$db->query(
			$db->prepare(
				'UPDATE %i SET score_level = %s WHERE score_level IN (%s, %s)',
				$leads_table,
				'amber',
				'developing',
				'intermediate'
			)
		);
		$db->query(
			$db->prepare(
				'UPDATE %i SET score_level = %s WHERE score_level = %s',
				$leads_table,
				'red',
				'beginner'
			)
		);
	}
}

<?php
/**
 * Content Manager — Handles all dynamic, customizable content throughout the plugin.
 *
 * This centralizes all user-editable text, email templates, band copy, and UI labels
 * into a single management system with fallback defaults.
 *
 * @package DigitalAssessmentPro\Content
 */

namespace DigitalAssessmentPro\Content;

defined( 'ABSPATH' ) || exit;

class ContentManager {

	// ─── Default Content Configurations ────────────────────────────────────


	/**
	 * Get default band-specific copy for each readiness level.
	 */
	public static function get_default_band_copy(): array {
		return [
			'red' => [
				'headline'          => 'High risk — act before you build',
				'subheadline'       => 'Significant gaps in capability readiness.',
				'description'       => 'At current trajectory, the gaps in your capability readiness will surface as schedule slippage — typically in the integration and validation phases, when they are most expensive to fix.',
				'lowest_dimensions' => 'Your lowest-scoring dimensions — {{dim1}}, {{dim2}}, {{dim3}} — are the variables most likely to determine your delivery outcome. These are not peripheral issues. They are the decisions that compound.',
				'full_text'         => 'At current trajectory, schedule slippage and costly rework are likely. The decisions being deferred now will cost significantly more to fix after execution begins.',
				'cta_text'          => 'Schedule a consultation with an expert',
				'cta_subtext'       => 'Book a discussion about your programme plan',
				'band_label'        => 'RED — High Risk',
			],
			'amber' => [
				'headline'          => 'Moderate risk — specific gaps to close',
				'subheadline'       => 'Good foundations in some areas, but material gaps remain.',
				'description'       => "You've got the right instincts — requirements are broadly defined, there's some concurrent engineering discipline, and the team has domain experience. The gaps are specific, not systemic.",
				'lowest_dimensions' => 'The dimensions to prioritise before engineering begins: {{dim1}}, {{dim2}}. Closing these gaps now is significantly cheaper than addressing them at validation.',
				'full_text'         => 'Addressing these now is significantly cheaper than addressing them during execution.',
				'cta_text'          => 'Review recommended actions and priorities',
				'cta_subtext'       => 'Explore the framework for closing each gap',
				'band_label'        => 'AMBER — Moderate Risk',
			],
			'gold' => [
				'headline'          => 'Low risk — optimise remaining gaps',
				'subheadline'       => 'Strong readiness across most dimensions.',
				'description'       => 'Your programme is well-structured. The gaps that remain — {{dim1}}, {{dim2}} — are specific and addressable before engineering begins without significant disruption to your plan.',
				'lowest_dimensions' => 'Programmes at your readiness level typically deliver on schedule when the remaining gaps are closed systematically rather than reactively.',
				'full_text'         => 'The remaining gaps are specific and addressable. Use the dimension breakdown to prioritise the remaining actions before engineering begins.',
				'cta_text'          => 'Explore acceleration strategies for your programme',
				'cta_subtext'       => 'Learn how to optimize and accelerate delivery',
				'band_label'        => 'GOLD — Low Risk',
			],
			'green' => [
				'headline'          => 'Benchmark readiness — sustain and scale',
				'subheadline'       => 'Your programme is structured for on-time delivery.',
				'description'       => 'Your programme is structured for on-time delivery. The engineering fundamentals are in place across every dimension that matters.',
				'lowest_dimensions' => "The risk at this readiness level is not the programme itself — it's what happens when you scale to a new vertical, a new geography, or a platform with more complexity. Benchmark discipline needs active maintenance.",
				'full_text'         => 'Maintaining this standard across scaling or new initiatives requires deliberate discipline.',
				'cta_text'          => 'Benchmark and scale your programme',
				'cta_subtext'       => 'Discover platform-led scaling practices',
				'band_label'        => 'GREEN — Benchmark',
			],
		];
	}

	/**
	 * Get default UI labels and text.
	 */
	public static function get_default_ui_labels(): array {
		return [
			// Assessment flow buttons
			'button_start'              => 'Start Assessment',
			'button_next'               => 'Next',
			'button_back'               => 'Back',
			'button_submit'             => 'Get My Results',
			'button_retake'             => 'Re-Scan',
			'button_download'           => 'Download Report',
			'button_close'              => 'Close',
			'button_book_call'          => 'Book a Call',
			'button_learn_more'         => 'Learn More',
			'button_cta_primary'        => 'Talk to Us',
			'button_cta_green'          => 'Continue to Next Step',
			'cta_url_base'              => function_exists( 'home_url' ) ? home_url( '/contact' ) : '#contact',
			'cta_url_green'             => function_exists( 'home_url' ) ? home_url( '/assessment' ) : '#assessment',

			// Section titles
			'section_score_breakdown'   => 'Score Breakdown',
			'section_recommendations'   => 'Recommendations',
			'section_your_results'      => 'Your Results',
			'section_lead_form'         => 'Get Your Detailed Report',
			'section_capability_analysis' => 'Capability Analysis',

			// Helper text
			'helper_lead_form'        => 'Enter your details to receive a report with actionable recommendations.',
			'helper_dimension_hover'  => 'Hover over any dimension card to see detailed insights.',
			'helper_score_scale'      => 'Scores are calculated on a 0-{{max}} point scale across {{count}} dimensions.',
			'helper_points_scale'     => '(Based on 0-{{max}} points scale)',
			'helper_radar_subtitle'   => 'Performance across all dimensions (0-100% scale)',

			// Form labels
			'label_first_name'        => 'First Name',
			'label_last_name'         => 'Last Name',
			'label_email'             => 'Email Address',
			'label_company'           => 'Company',
			'label_job_title'         => 'Job Title',
			'label_country'           => 'Country',
			'label_programme_type'    => 'Programme type',
			'label_consent'           => 'I authorize the secure transmission of my capability metrics in accordance with privacy guidelines.',
			'label_placeholder_country' => 'Select Country...',
			'label_placeholder_programme_type' => 'Select Type...',

			// Intro Screen text
			'intro_description'       => 'Make informed, data-driven decisions for your organization. This interactive scorecard helps you evaluate your capabilities across critical operational and technological dimensions. Receive an instant readiness score, identify potential risks early, and get actionable recommendations to accelerate your roadmap.',
			'intro_feature_1_title'   => 'Strategic Baseline',
			'intro_feature_1_desc'    => 'A multidimensional audit across critical capability domains.',
			'intro_feature_2_title'   => 'Efficiency Focused',
			'intro_feature_2_desc'    => 'Validated in ~5 minutes. Optimized for executive time management.',
			'intro_feature_3_title'   => 'Precision Metrics',
			'intro_feature_3_desc'    => 'High-fidelity capability mapping with actionable investment logic.',
			'intro_feature_4_title'   => 'Secure Context',
			'intro_feature_4_desc'    => 'Enterprise-grade confidentiality standards for strategic data protection.',
			'intro_cta_note'          => 'HIGH-FIDELITY DASHBOARD ACCESS → RESULTS WITHIN ~3M',

			// Question flow status / navigation
			'flow_step_counter'       => 'STEP {{current}} OF {{total}}',
			'message_select_option'   => 'Please select a baseline to proceed',

			// Submitting messages
			'message_loading'         => 'Loading your results...',
			'message_submitting'      => 'Submitting...',
			'message_generating_pdf'  => 'Generating your PDF report...',
			'message_success'         => 'Assessment completed successfully!',
			'message_error'           => 'Something went wrong. Please try again.',
			'message_submitting_step_1' => 'Analysing your responses…',
			'message_submitting_step_2' => 'Calculating dimension scores…',
			'message_submitting_step_3' => 'Generating recommendations…',
			'message_submitting_step_4' => 'Preparing your report…',

			// Lead Teaser text
			'lead_teaser_title'       => 'Baseline Extraction Complete',
			'lead_teaser_desc'        => 'We have generated your strategic capability profile.',
			'lead_teaser_score_note'  => 'Verification Score: {{score}} / {{max}} REGULATORY POINTS',
			'lead_footer_security'    => '256-BIT SSL CAPABILITY PROTECTION',

			// Validation messages
			'validation_mandatory'    => 'Mandatory Field',
			'validation_invalid_email' => 'Invalid Format',
			'validation_work_email'   => 'Work domain required',
			'validation_consent_required' => 'Authorization required',

			// Results and visuals labels
			'label_readiness_score'   => 'Your Readiness Score',
			'label_completed_dimension' => 'Completed Dimension',
			'label_of_dimensions'     => 'of {{count}} dimensions',
			'label_total_points'      => 'Total Points',
			'label_points_earned'     => 'points earned',
			'label_out_of'            => 'Out Of',
			'label_maximum_points'    => 'maximum points',
			'label_radar_view'        => 'Radar View',
			'label_stats_average'     => 'Average',
			'label_stats_benchmark'   => 'Benchmark (GREEN)',
			'label_stats_high_risk'   => 'High Risk (RED)',

			// Pinnacle / Phase 2 CTA
			'cta_badge'               => 'Phase 2: Operationalization',
			'cta_title'               => 'Accelerate Your Maturity Roadmap',
			'cta_description'         => 'Partner with our award-winning engineering group to translate these diagnostic metrics into a scalable, high-performance technology infrastructure.',
		];
	}

	/**
	 * Get default PDF template settings.
	 */
	public static function get_default_pdf_template(): array {
		$site_name = function_exists( 'get_bloginfo' ) ? get_bloginfo( 'name' ) : 'Digital Assessment Pro';
		return [
			'header_title'    => 'Readiness & Capability Assessment',
			'header_subtitle' => sprintf( 'Powered by %s', $site_name ),
			'footer_text'     => sprintf( '© {{year}} %s. All rights reserved.', $site_name ),
			'primary_color'   => '#0F172A',
			'accent_color'    => '#6366F1',
			'show_logo'       => true,
			'show_page_numbers' => true,
		];
	}

	/**
	 * Get default performance colors.
	 */
	public static function get_default_performance_colors(): array {
		return [
			'red'   => '#c02b12',
			'amber' => '#e76424',
			'gold'  => '#edaf18',
			'green' => '#069e7b',
		];
	}

	/**
	 * Get performance colors from DB or defaults.
	 */
	public static function get_performance_colors(): array {
		$colors = get_option( 'dap_performance_colors' );
		if ( ! $colors ) {
			return self::get_default_performance_colors();
		}
		$decoded = json_decode( $colors, true );
		if ( ! is_array( $decoded ) ) {
			return self::get_default_performance_colors();
		}
		// Merge with defaults to ensure all keys exist.
		return array_merge( self::get_default_performance_colors(), $decoded );
	}

	/**
	 * Update performance colors.
	 */
	public static function update_performance_colors( array $data ): bool {
		$colors = [
			'red'   => sanitize_text_field( $data['red'] ?? '#c02b12' ),
			'amber' => sanitize_text_field( $data['amber'] ?? '#e76424' ),
			'gold'  => sanitize_text_field( $data['gold'] ?? '#edaf18' ),
			'green' => sanitize_text_field( $data['green'] ?? '#069e7b' ),
		];
		update_option( 'dap_performance_colors', wp_json_encode( $colors ) );

		// Synchronize color attributes inside dap_score_levels as well
		$score_levels_raw = get_option( 'dap_score_levels' );
		if ( $score_levels_raw ) {
			$score_levels = json_decode( $score_levels_raw, true );
			if ( is_array( $score_levels ) ) {
				foreach ( $score_levels as &$lvl ) {
					$key = $lvl['key'] ?? '';
					if ( isset( $colors[ $key ] ) ) {
						$lvl['color'] = $colors[ $key ];
					}
				}
				update_option( 'dap_score_levels', wp_json_encode( $score_levels ) );
			}
		}

		self::clear_content_caches();
		return true;
	}

	/**
	 * Get default HubSpot configuration.
	 */
	public static function get_default_hubspot_config(): array {
		return [
			'enabled'  => false,
			'portalId' => '',
			'formId'   => '',
			'region'   => 'na1',
		];
	}

	/**
	 * Get HubSpot configuration from DB or defaults.
	 */
	public static function get_hubspot_config(): array {
		$config = get_option( 'dap_hubspot_config' );
		if ( ! $config ) {
			return self::get_default_hubspot_config();
		}
		$decoded = json_decode( $config, true );
		if ( ! is_array( $decoded ) ) {
			return self::get_default_hubspot_config();
		}
		// Merge with defaults to ensure all keys exist.
		return array_merge( self::get_default_hubspot_config(), $decoded );
	}

	/**
	 * Update HubSpot configuration.
	 */
	public static function update_hubspot_config( array $data ): bool {
		$config = [
			'enabled'  => ! empty( $data['enabled'] ),
			'portalId' => sanitize_text_field( $data['portalId'] ?? '' ),
			'formId'   => sanitize_text_field( $data['formId'] ?? '' ),
			'region'   => sanitize_text_field( $data['region'] ?? 'na1' ),
		];
		update_option( 'dap_hubspot_config', wp_json_encode( $config ) );
		self::clear_content_caches();
		return true;
	}

	// ─── Content Retrieval Methods ─────────────────────────────────────────


	/**
	 * Get band copy for a specific band with variable substitution.
	 */
	public static function get_band_copy( string $band = '', array $vars = [] ): array {
		$stored = get_option( 'dap_band_copy', wp_json_encode( self::get_default_band_copy() ) );
		$copy = json_decode( $stored, true ) ?: self::get_default_band_copy();

		if ( $band && isset( $copy[ $band ] ) ) {
			return self::substitute_vars( $copy[ $band ], $vars );
		}

		return $copy;
	}

	/**
	 * Get UI labels with variable substitution.
	 */
	public static function get_ui_labels( array $vars = [] ): array {
		$stored = get_option( 'dap_ui_labels', wp_json_encode( self::get_default_ui_labels() ) );
		$labels = json_decode( $stored, true ) ?: self::get_default_ui_labels();

		return self::substitute_vars( $labels, $vars );
	}

	/**
	 * Get a single UI label.
	 */
	public static function get_ui_label( string $key, array $vars = [] ): string {
		$labels = self::get_ui_labels();
		$label = $labels[ $key ] ?? $key;
		return self::substitute_vars_in_string( $label, $vars );
	}

	/**
	 * Get PDF template settings.
	 */
	public static function get_pdf_template( array $vars = [] ): array {
		$stored = get_option( 'dap_pdf_template', wp_json_encode( self::get_default_pdf_template() ) );
		$template = json_decode( $stored, true ) ?: self::get_default_pdf_template();

		return self::substitute_vars( $template, $vars );
	}

	// ─── Content Update Methods ────────────────────────────────────────────


	/**
	 * Update band copy.
	 */
	public static function update_band_copy( array $copy ): bool {
		$defaults = self::get_default_band_copy();
		$merged = array_merge( $defaults, $copy );
		update_option( 'dap_band_copy', wp_json_encode( $merged ) );
		self::clear_content_caches();
		return true;
	}

	/**
	 * Update UI labels.
	 */
	public static function update_ui_labels( array $labels ): bool {
		$defaults = self::get_default_ui_labels();
		$merged = array_merge( $defaults, $labels );
		update_option( 'dap_ui_labels', wp_json_encode( $merged ) );
		self::clear_content_caches();
		return true;
	}

	/**
	 * Update PDF template.
	 */
	public static function update_pdf_template( array $template ): bool {
		$defaults = self::get_default_pdf_template();
		$merged = array_merge( $defaults, $template );
		update_option( 'dap_pdf_template', wp_json_encode( $merged ) );
		self::clear_content_caches();
		return true;
	}

	/**
	 * Clear content and analytics caches across the system.
	 */
	public static function clear_content_caches(): void {
		if ( class_exists( '\DigitalAssessmentPro\Api\AnalyticsController' ) ) {
			\DigitalAssessmentPro\Api\AnalyticsController::invalidate_cache();
		} else {
			delete_transient( 'dap_analytics_overview' );
		}
		if ( function_exists( 'dap' ) ) {
			try {
				$cache = \dap()->get( 'cache' );
				if ( $cache ) {
					$cache->delete( 'dap_analytics_overview' );
				}
			} catch ( \Exception $e ) {}
		}
		update_option( 'dap_content_updated_at', time() );
	}

	// ─── Variable Substitution ─────────────────────────────────────────────

	/**
	 * Recursively substitute variables in array values.
	 */
	private static function substitute_vars( array $data, array $vars ): array {
		$result = [];
		foreach ( $data as $key => $value ) {
			if ( is_array( $value ) ) {
				$result[ $key ] = self::substitute_vars( $value, $vars );
			} elseif ( is_string( $value ) ) {
				$result[ $key ] = self::substitute_vars_in_string( $value, $vars );
			} else {
				$result[ $key ] = $value;
			}
		}
		return $result;
	}

	/**
	 * Substitute {{variable}} placeholders in string.
	 */
	private static function substitute_vars_in_string( string $text, array $vars ): string {
		foreach ( $vars as $key => $value ) {
			$text = str_replace( '{{' . $key . '}}', (string) $value, $text );
		}
		return $text;
	}
}


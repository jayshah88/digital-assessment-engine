<?php
/**
 * Frontend Loader — enqueues React app and handles shortcode + Gutenberg block.
 *
 * @package DigitalAssessmentPro\Frontend
 */

namespace DigitalAssessmentPro\Frontend;

defined( 'ABSPATH' ) || exit;

class Loader {

	public function enqueue(): void {
		if ( ! $this->page_has_assessment() ) {
			return;
		}
		add_filter( 'script_loader_tag', [ $this, 'add_module_type' ], 10, 3 );
		$this->enqueue_assets();
	}

	private function page_has_assessment(): bool {
		global $post;
		return is_singular()
			&& $post instanceof \WP_Post
			&& (
				has_shortcode( $post->post_content, 'digital_assessment' )
				|| has_shortcode( $post->post_content, 'dap_assessment' )
				|| has_block( 'digital-assessment-engine/assessment', $post )
				|| has_block( 'digital-assessment-pro/assessment', $post )
			);
	}

	public function enqueue_assets(): void {
		$dist = DAP_URL . 'assets/';
		$v    = DAP_VERSION;

		$manifest_path = DAP_PATH . 'assets/.vite/manifest.json';
		$entry_js      = 'js/app.js';
		$entry_css     = 'css/app.css';

		$manifest_path = realpath( DAP_PATH . 'assets/.vite/manifest.json' );
		$allowed_root  = realpath( DAP_PATH );

		if ( $manifest_path && $allowed_root && str_starts_with( $manifest_path, $allowed_root ) && 'manifest.json' === basename( $manifest_path ) && file_exists( $manifest_path ) ) {
			$manifest  = wp_json_file_decode( $manifest_path, [ 'associative' => true ] );
			$entry_js  = $manifest['src/main.jsx']['file']    ?? $entry_js;
			$entry_css = $manifest['src/main.jsx']['css'][0]  ?? $entry_css;
		}

		wp_enqueue_script( 'dap-app', $dist . $entry_js, [], $v, true );

		if ( file_exists( DAP_PATH . 'assets/' . $entry_css ) ) {
			wp_enqueue_style( 'dap-app', $dist . $entry_css, [], $v );
		}

		wp_localize_script( 'dap-app', 'dapConfig', [
			'apiUrl'               => esc_url_raw( rest_url( DAP_API_NS ) ),
			'nonce'                => wp_create_nonce( 'wp_rest' ),
			'siteUrl'              => home_url(),
			'siteName'             => get_bloginfo( 'name' ),
			'restUrl'              => esc_url_raw( rest_url() ),
			'leadGate'             => (bool) get_option( 'dap_lead_gate_enabled', true ),
			'blockPersonalEmails'  => (bool) apply_filters( 'dap/block_personal_emails', get_option( 'dap_block_personal_emails', false ), '' ),
			'requireCompanyFields' => (bool) apply_filters( 'dap/require_full_identity_fields', get_option( 'dap_require_company_fields', false ), null ),
			'i18n'                 => $this->get_i18n_strings(),
			'scoreLevels'          => json_decode( get_option( 'dap_score_levels', '[]' ), true ),
		] );
	}

	public function add_module_type( string $tag, string $handle, string $src ): string {
		if ( 'dap-app' === $handle ) {
			return str_replace( '<script ', '<script type="module" ', $tag );
		}
		return $tag;
	}

	public function render_shortcode( array $atts ): string {
		$atts = shortcode_atts( [
			'id'   => '',
			'slug' => '',
		], $atts, 'dap_assessment' );

		$this->enqueue_assets();

		$assessment_id   = absint( $atts['id'] );
		$assessment_slug = sanitize_title( $atts['slug'] );

		return sprintf(
			'<div id="dap-assessment-root" data-assessment-id="%d" data-assessment-slug="%s" class="dap-root"></div>',
			esc_attr( $assessment_id ),
			esc_attr( $assessment_slug )
		);
	}

	public function register_block(): void {
		if ( ! function_exists( 'register_block_type' ) ) {
			return;
		}
		register_block_type(
			DAP_PATH . 'block.json',
			[
				'render_callback' => function ( array $attrs ): string {
					return $this->render_shortcode( $attrs );
				},
			]
		);
	}

	private function get_i18n_strings(): array {
		return apply_filters( 'dap/i18n', [
			'startBtn'         => __( 'Start Assessment', 'digital-assessment-engine' ),
			'nextBtn'          => __( 'Next', 'digital-assessment-engine' ),
			'prevBtn'          => __( 'Back', 'digital-assessment-engine' ),
			'submitBtn'        => __( 'Submit', 'digital-assessment-engine' ),
			'loading'          => __( 'Loading…', 'digital-assessment-engine' ),
			'errorGeneric'     => __( 'Something went wrong. Please try again.', 'digital-assessment-engine' ),
			'leadGateTitle'    => __( 'Unlock Your Full Report', 'digital-assessment-engine' ),
			'leadGateSubtitle' => __( 'Enter your details to access your results.', 'digital-assessment-engine' ),
			'emailPlaceholder' => __( 'Your work email', 'digital-assessment-engine' ),
			'namePlaceholder'  => __( 'Your name', 'digital-assessment-engine' ),
			'gdprText'         => __( 'I agree to receive my results and occasional insights. Unsubscribe anytime.', 'digital-assessment-engine' ),
		] );
	}
}

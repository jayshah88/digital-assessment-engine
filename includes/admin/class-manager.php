<?php
/**
 * Admin Panel Manager
 *
 * @package DigitalAssessmentPro\Admin
 */

namespace DigitalAssessmentPro\Admin;

defined( 'ABSPATH' ) || exit;

class Manager {

	private string $slug = 'digital-assessment-pro';

	public function boot(): void {
		add_action( 'admin_menu', [ $this, 'register_menu' ] );
		add_action( 'admin_init', [ $this, 'register_settings' ] );
	}

	public function register_menu(): void {
		// Use a capability that all authorized DAP roles share.
		$main_cap = 'dap_view_submissions';

		add_menu_page(
			__( 'Assessment Pro', 'digital-assessment-pro' ),
			__( 'Assessments', 'digital-assessment-pro' ),
			$main_cap,
			$this->slug,
			[ $this, 'render_admin_app' ],
			'dashicons-chart-area',
			30
		);

		$pages = [
			[ 'assessments',    __( 'All Assessments', 'digital-assessment-pro' ),  'dap_manage_assessments' ],
			[ 'builder',        __( 'Builder',          'digital-assessment-pro' ),  'dap_manage_questions' ],
			[ 'submissions',    __( 'Submissions',       'digital-assessment-pro' ),  'dap_view_submissions' ],
			[ 'leads',          __( 'Leads',             'digital-assessment-pro' ),  'dap_view_leads' ],
			[ 'analytics',      __( 'Analytics',         'digital-assessment-pro' ),  'dap_view_analytics' ],
			[ 'settings',       __( 'Settings',          'digital-assessment-pro' ),  'dap_manage_settings' ],
		];

		foreach ( $pages as [ $sub_slug, $label, $sub_cap ] ) {
			add_submenu_page(
				$this->slug,
				$label,
				$label,
				$sub_cap,
				"{$this->slug}#{$sub_slug}",
				[ $this, 'render_admin_app' ]
			);
		}
	}

	public function render_admin_app(): void {
		$user = wp_get_current_user();
		if ( ! $user || ! $user->exists() || ( ! $user->has_cap( 'dap_view_submissions' ) && ! $user->has_cap( 'manage_options' ) ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'digital-assessment-pro' ) );
		}
		echo '<div id="dap-admin-root" class="dap-admin-wrap"></div>';
	}

	public function register_settings(): void {
		register_setting( 'dap_settings', 'dap_lead_gate_enabled',     [ 'sanitize_callback' => 'rest_sanitize_boolean' ] );
		register_setting( 'dap_settings', 'dap_rate_limit_per_hour',   [ 'sanitize_callback' => 'absint' ] );
		register_setting( 'dap_settings', 'dap_cache_ttl',             [ 'sanitize_callback' => 'absint' ] );
		register_setting( 'dap_settings', 'dap_score_levels',          [ 'sanitize_callback' => 'wp_kses_post' ] );
		register_setting( 'dap_settings', 'dap_keep_data_on_uninstall', [ 'sanitize_callback' => 'rest_sanitize_boolean' ] );
	}

	public function enqueue_assets( string $hook ): void {
		if ( ! $this->is_plugin_page( $hook ) ) {
			return;
		}

		$dist = DAP_URL . 'assets/';
		$v    = DAP_VERSION;

		$manifest_path = realpath( DAP_PATH . 'assets/.vite/manifest.json' );
		$allowed_root  = realpath( DAP_PATH );
		$entry_js      = 'js/admin.js';
		$entry_css     = 'css/admin.css';

		if ( $manifest_path && $allowed_root && str_starts_with( $manifest_path, $allowed_root ) && 'manifest.json' === basename( $manifest_path ) && file_exists( $manifest_path ) ) {
			$manifest  = wp_json_file_decode( $manifest_path, [ 'associative' => true ] );
			$entry_js  = $manifest['src/admin.jsx']['file']  ?? $entry_js;
			$entry_css = $manifest['src/admin.jsx']['css'][0] ?? $entry_css;
		}

		// Only enqueue if JS file exists (prevents 404 when assets not built).
		if ( ! file_exists( DAP_PATH . 'assets/' . $entry_js ) ) {
			// Show admin notice that assets need building.
			add_action( 'admin_notices', function () {
				echo '<div class="notice notice-warning"><p>';
				echo esc_html__( 'Digital Assessment Pro: Frontend assets not built. Run npm run build in the plugin directory.', 'digital-assessment-pro' );
				echo '</p></div>';
			} );
			return;
		}

		// Register as ES module for Vite-built assets.
		wp_register_script( 'dap-admin', $dist . $entry_js, [], $v, [ 'in_footer' => true, 'strategy' => 'defer' ] );
		add_filter( 'script_loader_tag', [ $this, 'add_module_type' ], 10, 3 );
		wp_enqueue_script( 'dap-admin' );

		if ( file_exists( DAP_PATH . 'assets/' . $entry_css ) ) {
			wp_enqueue_style( 'dap-admin', $dist . $entry_css, [ 'wp-components' ], $v );
		}

		wp_localize_script( 'dap-admin', 'dapAdmin', [
			'apiUrl'      => esc_url_raw( rest_url( DAP_API_NS ) ),
			'nonce'       => wp_create_nonce( 'wp_rest' ),
			'adminUrl'    => admin_url(),
			'pluginUrl'   => DAP_URL,
			'currentUser' => [
				'id'           => get_current_user_id(),
				'display_name' => wp_get_current_user()->display_name,
				'role'         => wp_get_current_user()->roles[0] ?? 'administrator',
				'caps'         => $this->get_current_user_caps(),
			],
			'settings'    => [
				'leadGate'          => (bool) get_option( 'dap_lead_gate_enabled', true ),
				'emailFrom'         => get_option( 'dap_email_from_address', get_option( 'admin_email' ) ),
				'scoreLevels'       => json_decode( get_option( 'dap_score_levels', '[]' ), true ),
				'performanceColors' => json_decode( get_option( 'dap_performance_colors', '{"red":"#c02b12","amber":"#e76424","gold":"#edaf18","green":"#069e7b"}' ), true ),
				'rateLimitPerHour'  => (int) get_option( 'dap_rate_limit_per_hour', 10 ),
				'cacheTtl'          => (int) get_option( 'dap_cache_ttl', 300 ),
			],
			'i18n'        => [
				'assessments' => __( 'Assessments', 'digital-assessment-pro' ),
				'builder'     => __( 'Builder', 'digital-assessment-pro' ),
				'leads'       => __( 'Leads', 'digital-assessment-pro' ),
				'analytics'   => __( 'Analytics', 'digital-assessment-pro' ),
				'settings'    => __( 'Settings', 'digital-assessment-pro' ),
				'save'        => __( 'Save', 'digital-assessment-pro' ),
				'cancel'      => __( 'Cancel', 'digital-assessment-pro' ),
				'delete'      => __( 'Delete', 'digital-assessment-pro' ),
				'publish'     => __( 'Publish', 'digital-assessment-pro' ),
			],
		] );
	}

	/**
	 * Add type="module" to Vite-built scripts.
	 *
	 * @param string $tag    The script tag HTML.
	 * @param string $handle The script handle.
	 * @param string $src    The script source URL.
	 * @return string Modified script tag.
	 */
	public function add_module_type( string $tag, string $handle, string $src ): string {
		if ( in_array( $handle, [ 'dap-admin', 'dap-app', 'dap-frontend' ], true ) ) {
			return str_replace( '<script ', '<script type="module" ', $tag );
		}
		return $tag;
	}

	private function is_plugin_page( string $hook ): bool {
		return strpos( $hook, $this->slug ) !== false
			|| strpos( $hook, 'digital-assessment' ) !== false;
	}

	private function get_current_user_caps(): array {
		$user = wp_get_current_user();
		if ( ! $user || ! $user->exists() ) {
			return [];
		}

		$is_admin = $user->has_cap( 'manage_options' );

		return [
			'dap_manage'         => $is_admin || $user->has_cap( 'dap_manage' ),
			'dap_create'         => $is_admin || $user->has_cap( 'dap_create' ),
			'dap_edit'           => $is_admin || $user->has_cap( 'dap_edit' ),
			'dap_delete'         => $is_admin || $user->has_cap( 'dap_delete' ),
			'dap_publish'        => $is_admin || $user->has_cap( 'dap_publish' ),
			'dap_export'         => $is_admin || $user->has_cap( 'dap_export' ),
			'dap_view_analytics' => $is_admin || $user->has_cap( 'dap_view_analytics' ),
		];
	}
}

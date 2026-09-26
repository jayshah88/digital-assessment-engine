<?php
/**
 * Plugin Name:       Digital Assessment Pro
 * Plugin URI:        https://wordpress.org/plugins/digital-assessment-pro/
 * Description:       Enterprise-grade digital assessment engine with React UI, radar charts, lead capture, scoring engine, and analytics. Built for SaaS-level quality.
 * Version:           2.1.0
 * Requires at least: 6.2
 * Requires PHP:      8.0
 * Tested up to:      6.7
 * Author:            Gexior Systems, Jay Shah
 * Author URI:        https://profiles.wordpress.org/jayshah88/
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       digital-assessment-pro
 * Domain Path:       /languages
 * Network:           false
 *
 * @package DigitalAssessmentPro
 */

// Prevent direct file access.
defined( 'ABSPATH' ) || exit;

// ─── Constants ──────────────────────────────────────────────────────────────
define( 'DAP_VERSION',      '2.1.0' );
define( 'DAP_MIN_PHP',      '8.0' );
define( 'DAP_MIN_WP',       '6.2' );
define( 'DAP_FILE',         __FILE__ );
define( 'DAP_PATH',         plugin_dir_path( __FILE__ ) );
define( 'DAP_URL',          plugin_dir_url( __FILE__ ) );
define( 'DAP_ASSETS_URL',   DAP_URL . 'assets/' );
define( 'DAP_INCLUDES',     DAP_PATH . 'includes/' );
define( 'DAP_TEMPLATES',    DAP_PATH . 'templates/' );
define( 'DAP_DB_VERSION',   '1.1.1' );
define( 'DAP_CACHE_GROUP',  'dap_cache' );
define( 'DAP_API_NS',       'assessment/v1' );

// ─── Dependency Check ────────────────────────────────────────────────────────
if ( ! function_exists( 'dap_requirements_met' ) ) {
	function dap_requirements_met(): bool {
		if ( version_compare( PHP_VERSION, DAP_MIN_PHP, '<' ) ) {
			add_action( 'admin_notices', fn() => printf(
				'<div class="notice notice-error"><p>%s</p></div>',
				sprintf(
					/* translators: 1: required PHP version, 2: current PHP version */
					esc_html__( 'Digital Assessment Pro requires PHP %1$s or higher. You are running PHP %2$s.', 'digital-assessment-pro' ),
					DAP_MIN_PHP,
					PHP_VERSION
				)
			) );
			return false;
		}
		if ( version_compare( get_bloginfo( 'version' ), DAP_MIN_WP, '<' ) ) {
			add_action( 'admin_notices', fn() => printf(
				'<div class="notice notice-error"><p>%s</p></div>',
				sprintf(
					/* translators: 1: required WP version, 2: current WP version */
					esc_html__( 'Digital Assessment Pro requires WordPress %1$s or higher.', 'digital-assessment-pro' ),
					DAP_MIN_WP
				)
			) );
			return false;
		}
		return true;
	}
}

if ( ! dap_requirements_met() ) {
	return;
}

// ─── Autoloader ─────────────────────────────────────────────────────────────
spl_autoload_register( function ( string $class ): void {
	$prefix   = 'DigitalAssessmentPro\\';
	$base_dir = DAP_INCLUDES;

	if ( strncmp( $prefix, $class, strlen( $prefix ) ) !== 0 ) {
		return;
	}

	$relative = substr( $class, strlen( $prefix ) );

	// Split namespace and class name.
	$parts = explode( '\\', $relative );
	$class_name = array_pop( $parts );

	// Convert CamelCase to kebab-case for filename.
	$file_name = 'class-' . strtolower( preg_replace( '/([a-z])([A-Z])/', '$1-$2', $class_name ) ) . '.php';

	// Build path with lowercase directories.
	$sub_dir = '';
	if ( ! empty( $parts ) ) {
		$sub_dir = strtolower( implode( '/', $parts ) ) . '/';
	}

	$file = $base_dir . $sub_dir . $file_name;

	if ( file_exists( $file ) ) {
		require $file;
	}
} );

// ─── Bootstrap ───────────────────────────────────────────────────────────────
function dap(): \DigitalAssessmentPro\Plugin {
	return \DigitalAssessmentPro\Plugin::instance();
}

add_action( 'plugins_loaded', 'dap', 0 );

// ─── Lifecycle Hooks ─────────────────────────────────────────────────────────
register_activation_hook(   DAP_FILE, [ \DigitalAssessmentPro\Installer::class, 'activate' ] );
register_deactivation_hook( DAP_FILE, [ \DigitalAssessmentPro\Installer::class, 'deactivate' ] );
// Note: Uninstallation is handled strictly by uninstall.php per WordPress.org guidelines.

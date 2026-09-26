<?php
/**
 * Settings Controller — GET/POST /settings
 *
 * @package DigitalAssessmentPro\Api
 */

namespace DigitalAssessmentPro\Api;

use DigitalAssessmentPro\Content\ContentManager;
use DigitalAssessmentPro\Access\RoleManager;

defined( 'ABSPATH' ) || exit;

// Ensure required classes are loaded.
if ( ! class_exists( 'DigitalAssessmentPro\Content\ContentManager' ) ) {
    require_once DAP_INCLUDES . 'content/class-content-manager.php';
}
if ( ! class_exists( 'DigitalAssessmentPro\Access\RoleManager' ) ) {
    require_once DAP_INCLUDES . 'access/class-role-manager.php';
}

class SettingsController extends BaseController {

	protected $rest_base = 'settings';

	// Whitelist of allowed settings keys.
	private array $allowed_settings = [
		'dap_lead_gate_enabled',
		'dap_rate_limit_per_hour',
		'dap_cache_ttl',
		'dap_score_levels',
		'dap_keep_data_on_uninstall',
		'dap_band_copy',
		'dap_ui_labels',
		'dap_pdf_template',
		'dap_cta_url_base',
	];

	public function register_routes(): void {
		// Get all settings.
		register_rest_route( $this->namespace, "/{$this->rest_base}", [
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_items' ],
			'permission_callback' => RoleManager::rest_permission( 'dap_manage_settings' ),
		] );

		// Update settings.
		register_rest_route( $this->namespace, "/{$this->rest_base}", [
			'methods'             => \WP_REST_Server::EDITABLE,
			'callback'            => [ $this, 'update_items' ],
			'permission_callback' => RoleManager::rest_permission( 'dap_manage_settings' ),
		] );

		// Get dynamic content (public endpoint for frontend).
		register_rest_route( $this->namespace, "/{$this->rest_base}/content", [
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_content' ],
			'permission_callback' => '__return_true',
		] );

		// Get all content for admin (auth required).
		register_rest_route( $this->namespace, "/{$this->rest_base}/content-admin", [
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_content_admin' ],
			'permission_callback' => RoleManager::rest_permission( 'dap_manage_settings' ),
		] );

		// Save content section (auth required).
		register_rest_route( $this->namespace, "/{$this->rest_base}/content-admin/(?P<section>[a-z]+)", [
			'methods'             => \WP_REST_Server::EDITABLE,
			'callback'            => [ $this, 'save_content_section' ],
			'permission_callback' => RoleManager::rest_permission( 'dap_manage_settings' ),
		] );
	}

	/**
	 * Get all settings.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function get_items( $request ): \WP_REST_Response {
		$settings = [];

		foreach ( $this->allowed_settings as $key ) {
			$value = get_option( $key );
			// Decode JSON for array/object settings.
			$json_keys = [ 'dap_score_levels', 'dap_band_copy', 'dap_ui_labels', 'dap_pdf_template' ];
			if ( in_array( $key, $json_keys, true ) && $value ) {
				$value = json_decode( $value, true );
			}
			// Cast booleans.
			if ( in_array( $key, [ 'dap_lead_gate_enabled', 'dap_keep_data_on_uninstall' ], true ) ) {
				$value = (bool) $value;
			}
			// Cast integers.
			if ( in_array( $key, [ 'dap_rate_limit_per_hour', 'dap_cache_ttl' ], true ) ) {
				$value = (int) $value;
			}
			$settings[ $key ] = $value;
		}

		return $this->success( $settings );
	}

	/**
	 * Update settings.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_items( $request ) {
		$updated = [];
		$errors  = [];

		foreach ( $this->allowed_settings as $key ) {
			$value = $request->get_param( $key );

			// Skip if not provided.
			if ( null === $value ) {
				continue;
			}

			// Validate and sanitize based on key.
			$sanitized = $this->sanitize_setting( $key, $value );

			if ( is_wp_error( $sanitized ) ) {
				$errors[ $key ] = $sanitized->get_error_message();
				continue;
			}

			// Save to database.
			update_option( $key, $sanitized );
			$updated[ $key ] = $sanitized;
		}

		if ( ! empty( $errors ) ) {
			return $this->error( 'validation_failed', __( 'Some settings could not be saved.', 'digital-assessment-engine' ), 422, [ 'errors' => $errors ] );
		}

		ContentManager::clear_content_caches();

		return $this->success( [ 'updated' => array_keys( $updated ) ] );
	}

	/**
	 * Sanitize a setting value based on its key.
	 *
	 * @param string $key   Setting key.
	 * @param mixed  $value Raw value.
	 * @return mixed|\WP_Error Sanitized value or error.
	 */
	private function sanitize_setting( string $key, $value ) {
		switch ( $key ) {
			case 'dap_lead_gate_enabled':
			case 'dap_keep_data_on_uninstall':
				return rest_sanitize_boolean( $value ) ? 1 : 0;

			case 'dap_rate_limit_per_hour':
			case 'dap_cache_ttl':
				$int = absint( $value );
				if ( $int < 1 ) {
					return new \WP_Error( 'invalid_number', __( 'Value must be at least 1.', 'digital-assessment-engine' ) );
				}
				return $int;

			case 'dap_score_levels':
			case 'dap_band_copy':
			case 'dap_ui_labels':
			case 'dap_pdf_template':
				if ( is_string( $value ) ) {
					$value = json_decode( $value, true );
				}
				if ( ! is_array( $value ) ) {
					return new \WP_Error( 'invalid_format', __( 'Setting must be a valid JSON object or array.', 'digital-assessment-engine' ) );
				}
				// For score levels, validate structure.
				if ( 'dap_score_levels' === $key ) {
					foreach ( $value as $level ) {
						if ( ! isset( $level['key'], $level['label'], $level['min'], $level['max'] ) ) {
							return new \WP_Error( 'invalid_structure', __( 'Each score level must have key, label, min, and max.', 'digital-assessment-engine' ) );
						}
					}
				}
				return wp_json_encode( $value );

			case 'dap_cta_url_base':
				return esc_url_raw( $value );

			default:
				return sanitize_text_field( $value );
		}
	}

	/**
	 * Get dynamic content for frontend (public endpoint).
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function get_content( $request ): \WP_REST_Response {
		// Only expose safe, non-sensitive content.
		$hubspot_config = ContentManager::get_hubspot_config();
		
		// Only expose if enabled (don't leak form IDs if disabled)
		$public_hubspot = [];
		if ( ! empty( $hubspot_config['enabled'] ) && ! empty( $hubspot_config['portalId'] ) && ! empty( $hubspot_config['formId'] ) ) {
			$public_hubspot = [
				'enabled'  => true,
				'portalId' => $hubspot_config['portalId'],
				'formId'   => $hubspot_config['formId'],
				'region'   => $hubspot_config['region'] ?? 'na1',
			];
		} else {
			$public_hubspot = [
				'enabled'  => false,
				'portalId' => '',
				'formId'   => '',
				'region'   => 'na1',
			];
		}
		
		$content = [
			'band_copy'          => ContentManager::get_band_copy(),
			'ui_labels'          => ContentManager::get_ui_labels(),
			'pdf_template'       => ContentManager::get_pdf_template(),
			'cta_url_base'       => get_option( 'dap_cta_url_base', home_url( '/contact' ) ),
			'performance_colors' => ContentManager::get_performance_colors(),
			'hubspot_config'     => $public_hubspot,
		];

		return $this->success( $content );
	}

	/**
	 * Get all content for admin (auth required).
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function get_content_admin( $request ): \WP_REST_Response {
		$content = [
			'band_copy'          => ContentManager::get_band_copy(),
			'ui_labels'          => ContentManager::get_ui_labels(),
			'pdf_template'       => ContentManager::get_pdf_template(),
			'cta_url_base'       => get_option( 'dap_cta_url_base', home_url( '/contact' ) ),
			'performance_colors' => ContentManager::get_performance_colors(),
			'hubspot_config'     => ContentManager::get_hubspot_config(),
		];

		return $this->success( $content );
	}

	/**
	 * Save content section (auth required).
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function save_content_section( $request ) {
		$section = $request->get_param( 'section' );
		$data    = $request->get_json_params();

		if ( ! $section || ! is_array( $data ) ) {
			return $this->error( 'invalid_params', __( 'Invalid section or data.', 'digital-assessment-engine' ), 400 );
		}

		$success = false;

		switch ( $section ) {
			case 'colors':
				$success = ContentManager::update_performance_colors( $data );
				break;
			case 'band':
				$success = ContentManager::update_band_copy( $data );
				break;
			case 'ui':
				$success = ContentManager::update_ui_labels( $data );
				break;
			case 'pdf':
				$success = ContentManager::update_pdf_template( $data );
				break;
			case 'integrations':
				$success = ContentManager::update_hubspot_config( $data );
				break;
			default:
				return $this->error( 'invalid_section', __( 'Invalid content section.', 'digital-assessment-engine' ), 400 );
		}

		if ( $success ) {
			return $this->success( [ 'message' => __( 'Content saved successfully.', 'digital-assessment-engine' ) ] );
		}

		return $this->error( 'save_failed', __( 'Failed to save content.', 'digital-assessment-engine' ), 500 );
	}
}

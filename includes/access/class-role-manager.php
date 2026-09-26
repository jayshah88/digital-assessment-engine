<?php
/**
 * Role Manager — RBAC via WordPress capabilities.
 *
 * Roles:
 *   dap_admin   → full access
 *   dap_editor  → create & edit assessments, view analytics
 *   dap_viewer  → read leads & submissions only
 *
 * @package DigitalAssessmentPro\Access
 */

namespace DigitalAssessmentPro\Access;

defined( 'ABSPATH' ) || exit;

class RoleManager {

	// Capability map.
	public const CAPS = [
		// Assessments.
		'dap_manage_assessments',   // CRUD assessments.
		'dap_publish_assessments',  // Publish / unpublish.
		'dap_delete_assessments',   // Hard delete.

		// Questions / Blocks.
		'dap_manage_questions',

		// Submissions.
		'dap_view_submissions',
		'dap_delete_submissions',

		// Leads.
		'dap_view_leads',
		'dap_export_leads',
		'dap_delete_leads',

		// Analytics.
		'dap_view_analytics',

		// Settings.
		'dap_manage_settings',
	];

	// Core Role → caps map.
	private const CORE_ROLE_CAPS = [
		'administrator' => [
			'dap_manage_assessments'  => true,
			'dap_publish_assessments' => true,
			'dap_delete_assessments'  => true,
			'dap_manage_questions'    => true,
			'dap_view_submissions'    => true,
			'dap_delete_submissions'  => true,
			'dap_view_leads'          => true,
			'dap_export_leads'        => true,
			'dap_delete_leads'        => true,
			'dap_view_analytics'      => true,
			'dap_manage_settings'     => true,
		],
		'editor' => [
			'dap_manage_assessments'  => true,
			'dap_publish_assessments' => true,
			'dap_delete_assessments'  => false,
			'dap_manage_questions'    => true,
			'dap_view_submissions'    => true,
			'dap_delete_submissions'  => false,
			'dap_view_leads'          => true,
			'dap_export_leads'        => false,
			'dap_delete_leads'        => false,
			'dap_view_analytics'      => true,
			'dap_manage_settings'     => false,
		],
	];

	// ─── Register ─────────────────────────────────────────────────────────
	public function register(): void {
		// Clean up custom roles if they exist.
		remove_role( 'dap_admin' );
		remove_role( 'dap_editor' );
		remove_role( 'dap_viewer' );

		// Sync caps on standard WordPress roles.
		foreach ( self::CORE_ROLE_CAPS as $role_name => $caps ) {
			$role = get_role( $role_name );
			if ( $role ) {
				foreach ( $caps as $cap => $grant ) {
					if ( $grant ) {
						$role->add_cap( $cap );
					} else {
						$role->remove_cap( $cap );
					}
				}
			}
		}
	}
	/**
	 * REST API permission callback factory.
	 */
	public static function rest_permission( string $cap ): \Closure {
		return function ( ?\WP_REST_Request $request = null ) use ( $cap ): bool|\WP_Error {
			$user = wp_get_current_user();
			if ( ! $user || ! $user->exists() ) {
				return new \WP_Error( 'dap_unauthorized', __( 'Authentication required.', 'digital-assessment-engine' ), [ 'status' => 401 ] );
			}
			$has_cap = match ( $cap ) {
				'dap_manage_assessments' => $user->has_cap( 'dap_manage_assessments' ),
				'dap_manage_questions'   => $user->has_cap( 'dap_manage_questions' ),
				'dap_view_submissions'   => $user->has_cap( 'dap_view_submissions' ),
				'dap_delete_submissions' => $user->has_cap( 'dap_delete_submissions' ),
				'dap_view_leads'         => $user->has_cap( 'dap_view_leads' ),
				'dap_export_leads'       => $user->has_cap( 'dap_export_leads' ),
				'dap_delete_leads'       => $user->has_cap( 'dap_delete_leads' ),
				'dap_view_analytics'     => $user->has_cap( 'dap_view_analytics' ),
				'dap_manage_settings'    => $user->has_cap( 'dap_manage_settings' ),
				default                  => $user->has_cap( 'manage_options' ),
			};
			if ( ! $has_cap && ! $user->has_cap( 'manage_options' ) ) {
				return new \WP_Error( 'dap_forbidden', __( 'Insufficient permissions.', 'digital-assessment-engine' ), [ 'status' => 403 ] );
			}
			return true;
		};
	}

	// ─── Cleanup ──────────────────────────────────────────────────────────
	public static function remove_roles(): void {
		// Clean up custom roles.
		remove_role( 'dap_admin' );
		remove_role( 'dap_editor' );
		remove_role( 'dap_viewer' );

		// Remove caps from administrator and editor.
		$roles = [ 'administrator', 'editor' ];
		foreach ( $roles as $role_name ) {
			$role = get_role( $role_name );
			if ( $role ) {
				foreach ( self::CAPS as $cap ) {
					$role->remove_cap( $cap );
				}
			}
		}
	}
}

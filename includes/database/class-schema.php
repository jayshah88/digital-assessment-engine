<?php
/**
 * Database Schema helper — thin wrapper used by the service container.
 * Actual schema SQL lives in Installer::create_tables().
 *
 * @package DigitalAssessmentPro\Database
 */

namespace DigitalAssessmentPro\Database;

defined( 'ABSPATH' ) || exit;

class Schema {

	/**
	 * Safe database reference.
	 */
	private static function db(): \wpdb {
		global $wpdb;
		return $wpdb;
	}

	/**
	 * Return a prefixed table name.
	 */
	public static function table( string $name ): string {
		return sanitize_key( self::db()->prefix . 'dap_' . $name );
	}

	/**
	 * Check whether all plugin tables exist.
	 */
	public static function tables_exist(): bool {
		$db = self::db();

		$required = [
			'dap_assessments',
			'dap_assessment_versions',
			'dap_blocks',
			'dap_questions',
			'dap_options',
			'dap_submissions',
			'dap_submission_answers',
			'dap_leads',
			'dap_analytics_events',
			'dap_rate_limits',
		];

		foreach ( $required as $suffix ) {
			$table_name = sanitize_key( $db->prefix . $suffix );

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$found = $db->get_var(
				$db->prepare(
					'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s',
					$table_name
				)
			);

			if ( $found !== $table_name ) {
				return false;
			}
		}

		return true;
	}
}


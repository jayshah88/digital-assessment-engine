<?php
/**
 * Rate Limiter — DB-backed sliding window rate limiting.
 *
 * @package DigitalAssessmentPro\Security
 */

namespace DigitalAssessmentPro\Security;

defined( 'ABSPATH' ) || exit;

class RateLimiter {

	/**
	 * Check if action is within rate limit.
	 * Returns true if allowed, false if blocked.
	 */
	public function check( string $identifier, string $action, int $max_per_hour ): bool {
		$db          = $this->db();
		$table       = $this->table( 'rate_limits' );
		$window      = gmdate( 'Y-m-d H:00:00' ); // Current hour bucket.
		$safe_id     = sanitize_text_field( $identifier );
		$safe_action = sanitize_text_field( $action );
		$max_allowed = intval( max( 1, (int) $max_per_hour ) );

		// Use atomic INSERT ... ON DUPLICATE KEY UPDATE to prevent race conditions.
		$db->query(
			$db->prepare(
				'INSERT INTO %i (identifier, action, hits, window_start) VALUES (%s, %s, 1, %s) ON DUPLICATE KEY UPDATE hits = hits + 1',
				$table,
				$safe_id,
				$safe_action,
				$window
			)
		);

		// Verified after the atomic update
		$hits = (int) $db->get_var(
			$db->prepare(
				'SELECT hits FROM %i WHERE identifier = %s AND action = %s AND window_start = %s',
				$table,
				$safe_id,
				$safe_action,
				$window
			)
		);

		return $hits <= $max_allowed;
	}

	/**
	 * Purge old window rows (run via cron or activation).
	 */
	public function purge_old(): void {
		$db = $this->db();
		$db->query(
			$db->prepare(
				'DELETE FROM %i WHERE window_start < DATE_SUB(NOW(), INTERVAL %d HOUR)',
				$this->table( 'rate_limits' ),
				24
			)
		);
	}

	/**
	 * Safe database reference.
	 */
	private function db(): \wpdb {
		global $wpdb;
		return $wpdb;
	}

	/**
	 * Get table name with prefix.
	 */
	private function table( string $name ): string {
		return $this->db()->prefix . 'dap_' . $name;
	}
}

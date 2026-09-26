<?php
/**
 * Query Cache — Intelligent caching for database queries.
 *
 * @package DigitalAssessmentPro\Cache
 */

namespace DigitalAssessmentPro\Cache;

defined( 'ABSPATH' ) || exit;

/**
 * Query cache manager for expensive operations.
 */
class QueryCache {

	/**
	 * Cache group name.
	 *
	 * @var string
	 */
	private string $group = 'dap_queries';

	/**
	 * Default TTL in seconds.
	 *
	 * @var int
	 */
	private int $default_ttl = 300; // 5 minutes.

	/**
	 * Get cached data or execute callback.
	 *
	 * @template T
	 * @param string   $key Cache key.
	 * @param callable $callback Function to generate data.
	 * @param int      $ttl Cache time in seconds.
	 * @return T Cached or fresh data.
	 */
	public function remember( string $key, callable $callback, int $ttl = 0 ) {
		$ttl  = $ttl > 0 ? $ttl : $this->default_ttl;
		$data = wp_cache_get( $key, $this->group );

		if ( false === $data ) {
			$data = $callback();
			wp_cache_set( $key, $data, $this->group, $ttl );
		}

		return $data;
	}

	/**
	 * Cache assessment with all related data.
	 *
	 * @param int $assessment_id Assessment ID.
	 * @return array|null Assessment data.
	 */
	public function get_assessment( int $assessment_id ): ?array {
		$safe_id = intval( max( 0, (int) $assessment_id ) );
		return $this->remember(
			"assessment:{$safe_id}",
			function () use ( $safe_id ) {
				$db = $this->db();
				$assessment = $db->get_row(
					$db->prepare(
						'SELECT * FROM %i WHERE id = %d',
						$this->table( 'assessments' ),
						$safe_id
					),
					ARRAY_A
				);

				if ( ! $assessment ) {
					return null;
				}

				// Get blocks.
				$assessment['blocks'] = $db->get_results(
					$db->prepare(
						'SELECT * FROM %i WHERE assessment_id = %d ORDER BY sort_order',
						$this->table( 'blocks' ),
						$safe_id
					),
					ARRAY_A
				);

				return $assessment;
			},
			600 // Cache for 10 minutes.
		);
	}

	/**
	 * Cache submissions count.
	 *
	 * @param array $filters Optional filters.
	 * @return int Count.
	 */
	public function get_submissions_count( array $filters = [] ): int {
		$key = 'submissions_count:' . hash( 'sha256', (string) wp_json_encode( $filters ) );

		return $this->remember(
			$key,
			function () use ( $filters ) {
				$db             = $this->db();
				$has_assessment = ! empty( $filters['assessment_id'] );
				$has_status     = ! empty( $filters['status'] );

				if ( $has_assessment && $has_status ) {
					return (int) $db->get_var(
						$db->prepare(
							'SELECT COUNT(*) FROM %i WHERE assessment_id = %d AND status = %s',
							$this->table( 'submissions' ),
							intval( max( 0, (int) $filters['assessment_id'] ) ),
							sanitize_text_field( (string) $filters['status'] )
						)
					);
				}

				if ( $has_assessment ) {
					return (int) $db->get_var(
						$db->prepare(
							'SELECT COUNT(*) FROM %i WHERE assessment_id = %d',
							$this->table( 'submissions' ),
							intval( max( 0, (int) $filters['assessment_id'] ) )
						)
					);
				}

				if ( $has_status ) {
					return (int) $db->get_var(
						$db->prepare(
							'SELECT COUNT(*) FROM %i WHERE status = %s',
							$this->table( 'submissions' ),
							sanitize_text_field( (string) $filters['status'] )
						)
					);
				}

				return (int) $db->get_var(
					$db->prepare(
						'SELECT COUNT(*) FROM %i WHERE 1 = %d',
						$this->table( 'submissions' ),
						1
					)
				);
			},
			60 // Cache for 1 minute.
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

	/**
	 * Invalidate cache by key pattern.
	 *
	 * @param string $pattern Pattern to match.
	 * @return void
	 */
	public function invalidate( string $pattern ): void {
		// WordPress object cache doesn't support pattern deletion,
		// so we use specific keys.
		wp_cache_delete( $pattern, $this->group );
	}

	/**
	 * Clear all cached queries.
	 *
	 * @return void
	 */
	public function clear(): void {
		wp_cache_flush_group( $this->group );
	}
}

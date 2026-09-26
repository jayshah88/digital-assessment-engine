<?php
/**
 * Analytics Controller — GET /analytics
 *
 * @package DigitalAssessmentPro\Api
 */

namespace DigitalAssessmentPro\Api;

defined( 'ABSPATH' ) || exit;

class AnalyticsController extends BaseController {

	protected $rest_base = 'analytics';

	public function register_routes(): void {
		register_rest_route( $this->namespace, "/{$this->rest_base}", [
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_items' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_view_analytics' ),
		] );

		register_rest_route( $this->namespace, "/{$this->rest_base}/assessment/(?P<id>[\\d]+)", [
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_assessment_stats' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_view_analytics' ),
		] );
	}

	/**
	 * Get items (Overview stats).
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_items( $request ) {
		try {
			$cache_key = 'dap_analytics_overview';
			$cached    = $this->cache_get( $cache_key );
			if ( false !== $cached ) {
				return $this->success( $cached );
			}

			$total_submissions = $this->get_total_submissions();
			$completed         = $this->get_completed_count();

			$submissions_delta = $this->calculate_delta_30_days( 'dap_submissions', 'started_at' );
			$completed_delta   = $this->calculate_delta_30_days( 'dap_submissions', 'completed_at', "status = 'completed'" );
			$leads_delta       = $this->calculate_delta_30_days( 'dap_leads', 'created_at' );
			$avg_score_delta   = $this->calculate_avg_score_delta_30_days();
			$completion_rate_delta = $this->calculate_completion_rate_delta_30_days();

			$avg_score         = $this->get_average_score();
			$total_max_score   = $this->get_total_max_score();
			$avg_percentage    = $total_max_score > 0 ? min( 100.0, round( ( $avg_score / $total_max_score ) * 100, 1 ) ) : 0.0;

			$data = [
				'total_submissions'   => $total_submissions,
				'completed'           => $completed,
				'total_leads'         => $this->get_total_leads(),
				'avg_score'           => $avg_score,
				'total_max_score'     => $total_max_score,
				'avg_score_percentage'=> $avg_percentage,
				'completion_rate'     => $total_submissions > 0
					? round( $completed / $total_submissions * 100, 1 )
					: 0,
				'max_daily_submissions' => $this->get_global_max_submissions_per_day(),
				
				// Real deltas
				'submissions_delta'   => $submissions_delta['delta'],
				'submissions_up'      => $submissions_delta['up'],
				'completed_delta'     => $completed_delta['delta'],
				'completed_up'        => $completed_delta['up'],
				'leads_delta'         => $leads_delta['delta'],
				'leads_up'            => $leads_delta['up'],
				'avg_score_delta'     => $avg_score_delta['delta'],
				'avg_score_up'        => $avg_score_delta['up'],
				'completion_rate_delta'=> $completion_rate_delta['delta'],
				'completion_rate_up'  => $completion_rate_delta['up'],
				
				// Chart data with enriched keys.
				'submissions_by_day'  => $this->get_submissions_by_day(),
				'level_breakdown'     => $this->get_level_breakdown(),
				'score_distribution'  => $this->get_score_distribution(),
				'recent_submissions'  => $this->get_recent_submissions(),
				'top_drop_off'        => [],
			];

			$this->cache_set( $cache_key, $data, 300 );
			return $this->success( $data );
		} catch ( \Exception $e ) {
			// Log detailed error internally — NEVER expose to client.
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				error_log( '[DAP] Analytics Error: ' . $e->getMessage() );
			}
			
			return $this->error(
				'analytics_error',
				__( 'Failed to retrieve analytics data.', 'digital-assessment-pro' ),
				500
			);
		}
	}

	/**
	 * Get total submissions count.
	 *
	 * @return int
	 */
	private function get_total_submissions(): int {
		$result = $this->db()->get_var(
			$this->db()->prepare(
				'SELECT COUNT(*) FROM %i WHERE 1 = %d',
				$this->table( 'submissions' ),
				1
			)
		);
		return (int) $result;
	}

	/**
	 * Get completed submissions count.
	 *
	 * @return int
	 */
	private function get_completed_count(): int {
		$result = $this->db()->get_var(
			$this->db()->prepare(
				'SELECT COUNT(*) FROM %i WHERE status = %s',
				$this->table( 'submissions' ),
				'completed'
			)
		);
		return (int) $result;
	}

	/**
	 * Get total leads count.
	 *
	 * @return int
	 */
	private function get_total_leads(): int {
		$result = $this->db()->get_var(
			$this->db()->prepare(
				'SELECT COUNT(*) FROM %i WHERE 1 = %d',
				$this->table( 'leads' ),
				1
			)
		);
		return (int) $result;
	}

	/**
	 * Get average normalized score.
	 *
	 * @return float
	 */
	private function get_average_score(): float {
		$result = $this->db()->get_var(
			$this->db()->prepare(
				'SELECT AVG(normalized_score) FROM %i WHERE status = %s',
				$this->table( 'submissions' ),
				'completed'
			)
		);
		return round( (float) $result, 2 );
	}

	/**
	 * Get max possible score dynamically for active assessments.
	 *
	 * @return float
	 */
	private function get_total_max_score(): float {
		$max_score = $this->db()->get_var(
			$this->db()->prepare(
				"SELECT COALESCE(SUM(max_val), 0) FROM (
					SELECT q.id, MAX(o.score_value) as max_val
					FROM %i q
					JOIN %i o ON o.question_id = q.id
					JOIN %i a ON a.id = q.assessment_id
					WHERE a.status = %s
					GROUP BY q.id
				) t",
				$this->table( 'questions' ),
				$this->table( 'question_options' ),
				$this->table( 'assessments' ),
				'published'
			)
		);
		$max = (float) $max_score;
		return $max > 0 ? $max : 100.0;
	}

	/**
	 * Get recent submissions.
	 *
	 * @return array
	 */
	private function get_recent_submissions(): array {
		$results = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT s.id, s.uuid, s.total_score, s.normalized_score, s.score_level, s.status, s.started_at, s.completed_at, a.title as assessment_title FROM %i s LEFT JOIN %i a ON s.assessment_id = a.id ORDER BY s.completed_at DESC LIMIT %d',
				$this->table( 'submissions' ),
				$this->table( 'assessments' ),
				5
			),
			ARRAY_A
		);
		return $results ?: [];
	}

	/**
	 * Get assessment stats.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_assessment_stats( $request ) {
		$id        = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'id' ) ) ) );
		$cache_key = "dap_analytics_{$id}";
		$cached    = $this->cache_get( $cache_key );
		if ( false !== $cached ) {
			return $this->success( $cached );
		}

		$total = (int) $this->db()->get_var(
			$this->db()->prepare(
				'SELECT COUNT(*) FROM %i WHERE assessment_id = %d',
				$this->table( 'submissions' ),
				$id
			)
		);
		$completed = (int) $this->db()->get_var(
			$this->db()->prepare(
				'SELECT COUNT(*) FROM %i WHERE assessment_id = %d AND status = %s',
				$this->table( 'submissions' ),
				$id,
				'completed'
			)
		);
		$avg_score = round( (float) $this->db()->get_var(
			$this->db()->prepare(
				'SELECT AVG(normalized_score) FROM %i WHERE assessment_id = %d AND status = %s',
				$this->table( 'submissions' ),
				$id,
				'completed'
			)
		), 2 );

		// Most selected answers.
		$top_answers = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT sa.question_key, o.option_text, COUNT(*) as selections FROM %i sa JOIN %i s ON sa.submission_id = s.id JOIN %i o ON FIND_IN_SET(o.id, sa.option_ids) WHERE s.assessment_id = %d GROUP BY sa.question_key, o.id ORDER BY selections DESC LIMIT %d',
				$this->table( 'submission_answers' ),
				$this->table( 'submissions' ),
				$this->table( 'options' ),
				$id,
				20
			),
			ARRAY_A
		);

		// Block average scores.
		$block_avgs = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT b.id, b.title, b.color, AVG(bs.score) as avg_score FROM %i b JOIN ( SELECT assessment_id, JSON_UNQUOTE(JSON_EXTRACT(block_scores, CONCAT(\'$.\', b2.id))) as score, b2.id as block_id FROM %i s2 JOIN %i b2 ON b2.assessment_id = s2.assessment_id WHERE s2.assessment_id = %d AND s2.status = %s ) bs ON bs.block_id = b.id WHERE b.assessment_id = %d GROUP BY b.id ORDER BY b.sort_order',
				$this->table( 'blocks' ),
				$this->table( 'submissions' ),
				$this->table( 'blocks' ),
				$id,
				'completed',
				$id
			),
			ARRAY_A
		);

		$data = compact( 'total', 'completed', 'avg_score', 'top_answers', 'block_avgs' );
		$data['completion_rate'] = $total > 0 ? round( $completed / $total * 100, 1 ) : 0;

		$this->cache_set( $cache_key, $data, 300 );
		return $this->success( $data );
	}

	private function get_score_distribution(): array {
		$results = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT FLOOR(normalized_score / 10) * 10 as bucket, COUNT(*) as count FROM %i WHERE status = %s GROUP BY FLOOR(normalized_score / 10) * 10 ORDER BY bucket',
				$this->table( 'submissions' ),
				'completed'
			),
			ARRAY_A
		);

		$raw_colors = get_option( 'dap_performance_colors' );
		$colors = json_decode( $raw_colors, true ) ?: [
			'red'   => '#c02b12',
			'amber' => '#e76424',
			'gold'  => '#edaf18',
			'green' => '#069e7b',
		];

		$bucket_meta = [
			0  => [ 'label' => '0–9%',   'band' => 'red',   'band_label' => 'High Risk (RED)' ],
			10 => [ 'label' => '10–19%', 'band' => 'red',   'band_label' => 'High Risk (RED)' ],
			20 => [ 'label' => '20–29%', 'band' => 'red',   'band_label' => 'High Risk (RED)' ],
			30 => [ 'label' => '30–39%', 'band' => 'red',   'band_label' => 'High Risk (RED)' ],
			40 => [ 'label' => '40–49%', 'band' => 'amber', 'band_label' => 'Moderate Risk (AMBER)' ],
			50 => [ 'label' => '50–59%', 'band' => 'amber', 'band_label' => 'Moderate Risk (AMBER)' ],
			60 => [ 'label' => '60–69%', 'band' => 'gold',  'band_label' => 'Low Risk (GOLD)' ],
			70 => [ 'label' => '70–79%', 'band' => 'gold',  'band_label' => 'Low Risk (GOLD)' ],
			80 => [ 'label' => '80–89%', 'band' => 'green', 'band_label' => 'Benchmark (GREEN)' ],
			90 => [ 'label' => '90–100%', 'band' => 'green', 'band_label' => 'Benchmark (GREEN)' ],
		];

		return array_map( function( $row ) use ( $bucket_meta, $colors ) {
			$b = (int) $row['bucket'];
			if ( isset( $bucket_meta[ $b ] ) ) {
				$meta = $bucket_meta[ $b ];
			} else {
				$band = $b >= 85 ? 'green' : ( $b >= 65 ? 'gold' : ( $b >= 40 ? 'amber' : 'red' ) );
				$meta = [
					'label'      => "{$b}+",
					'band'       => $band,
					'band_label' => ucfirst( $band ),
				];
			}
			$band_key = $meta['band'];
			return [
				'bucket'      => $b,
				'range_label' => $meta['label'],
				'band_key'    => $band_key,
				'band_label'  => $meta['band_label'],
				'color'       => $colors[ $band_key ] ?? '#6366F1',
				'count'       => (int) $row['count'],
			];
		}, $results ?: [] );
	}

	private function get_level_breakdown(): array {
		$results = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT score_level, COUNT(*) as count FROM %i WHERE status = %s GROUP BY score_level',
				$this->table( 'submissions' ),
				'completed'
			),
			ARRAY_A
		);

		$raw_colors = get_option( 'dap_performance_colors' );
		$colors = json_decode( $raw_colors, true ) ?: [
			'red'   => '#c02b12',
			'amber' => '#e76424',
			'gold'  => '#edaf18',
			'green' => '#069e7b',
		];

		// Map legacy or synonym level identifiers to the 4 canonical bands
		$canonical_map = [
			'green'        => 'green',
			'advanced'     => 'green',
			'expert'       => 'green',
			'gold'         => 'gold',
			'proficient'   => 'gold',
			'amber'        => 'amber',
			'developing'   => 'amber',
			'intermediate' => 'amber',
			'red'          => 'red',
			'beginner'     => 'red',
		];

		// The 4 main canonical bands
		$canonical_bands = [
			'gold'  => [
				'score_level' => 'gold',
				'label'       => 'GOLD — Low Risk',
				'color'       => $colors['gold'] ?? '#edaf18',
				'count'       => 0,
			],
			'amber' => [
				'score_level' => 'amber',
				'label'       => 'AMBER — Moderate Risk',
				'color'       => $colors['amber'] ?? '#e76424',
				'count'       => 0,
			],
			'green' => [
				'score_level' => 'green',
				'label'       => 'GREEN — Benchmark',
				'color'       => $colors['green'] ?? '#069e7b',
				'count'       => 0,
			],
			'red'   => [
				'score_level' => 'red',
				'label'       => 'RED — High Risk',
				'color'       => $colors['red'] ?? '#c02b12',
				'count'       => 0,
			],
		];

		foreach ( $results ?: [] as $row ) {
			$raw_key       = strtolower( trim( $row['score_level'] ?? '' ) );
			$canonical_key = $canonical_map[ $raw_key ] ?? 'red';
			$canonical_bands[ $canonical_key ]['count'] += (int) $row['count'];
		}

		$total = array_sum( array_column( $canonical_bands, 'count' ) );

		// Compute percentages
		foreach ( $canonical_bands as &$band ) {
			$band['percentage'] = $total > 0 ? round( ( $band['count'] / $total ) * 100, 1 ) : 0;
		}
		unset( $band );

		// Sort by count descending
		usort( $canonical_bands, function( $a, $b ) {
			return $b['count'] <=> $a['count'];
		} );

		// Filter out bands with 0 submissions if any, but keep primary bands
		$active_bands = array_filter( $canonical_bands, fn( $b ) => $b['count'] > 0 );

		return array_values( $active_bands ?: $canonical_bands );
	}

	/**
	 * Invalidate cached analytics overview.
	 */
	public static function invalidate_cache(): void {
		delete_transient( 'dap_analytics_overview' );
		if ( function_exists( 'dap' ) ) {
			try {
				$cache = \dap()->get( 'cache' );
				if ( $cache ) {
					$cache->delete( 'dap_analytics_overview' );
				}
			} catch ( \Exception $e ) {
				// Non-critical cache cleanup error
			}
		}
	}

	private function get_submissions_by_day(): array {
		$results = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT DATE(completed_at) as date, COUNT(*) as count FROM %i WHERE status = %s AND completed_at >= DATE_SUB(%s, INTERVAL %d DAY) GROUP BY DATE(completed_at) ORDER BY date',
				$this->table( 'submissions' ),
				'completed',
				current_time( 'mysql' ),
				30
			),
			ARRAY_A
		);
		return array_map( fn( $row ) => [
			'date'  => $row['date'],
			'count' => (int) $row['count'],
		], $results ?: [] );
	}

	/**
	 * Get the maximum number of submissions in a single day from the entire history.
	 */
	private function get_global_max_submissions_per_day(): int {
		$max = $this->db()->get_var(
			$this->db()->prepare(
				'SELECT COUNT(*) as daily_count FROM %i WHERE status = %s GROUP BY DATE(completed_at) ORDER BY daily_count DESC LIMIT %d',
				$this->table( 'submissions' ),
				'completed',
				1
			)
		);
		return max( (int) $max, 5 ); // Return at least 5 for a clean graph scale
	}

	/**
	 * Calculate percentage change (delta) for a query in last 30 days vs previous 30 days.
	 * Uses whitelisted table and column names to prevent SQL injection.
	 *
	 * @param string $table    Table suffix (without prefix). Must be whitelisted.
	 * @param string $date_col Date column name. Must be whitelisted.
	 * @param string $extra_condition Optional pre-validated condition key.
	 * @return array{delta: string, up: bool}
	 */
	private function calculate_delta_30_days( string $table, string $date_col, string $extra_condition = '' ): array {
		$status_param = 'completed';

		// Map to 100% static prepared templates to prevent any variable/column interpolation inside DB strings.
		if ( 'dap_submissions' === $table && 'started_at' === $date_col ) {
			$current = (int) $this->db()->get_var(
				$this->db()->prepare(
					'SELECT COUNT(*) FROM %i WHERE started_at >= DATE_SUB(%s, INTERVAL 30 DAY)',
					$this->table( 'submissions' ),
					current_time( 'mysql' )
				)
			);
			$previous = (int) $this->db()->get_var(
				$this->db()->prepare(
					'SELECT COUNT(*) FROM %i WHERE started_at >= DATE_SUB(%s, INTERVAL 60 DAY) AND started_at < DATE_SUB(%s, INTERVAL 30 DAY)',
					$this->table( 'submissions' ),
					current_time( 'mysql' ),
					current_time( 'mysql' )
				)
			);
		} elseif ( 'dap_submissions' === $table && 'completed_at' === $date_col && "status = 'completed'" === $extra_condition ) {
			$current = (int) $this->db()->get_var(
				$this->db()->prepare(
					'SELECT COUNT(*) FROM %i WHERE completed_at >= DATE_SUB(%s, INTERVAL 30 DAY) AND status = %s',
					$this->table( 'submissions' ),
					current_time( 'mysql' ),
					$status_param
				)
			);
			$previous = (int) $this->db()->get_var(
				$this->db()->prepare(
					'SELECT COUNT(*) FROM %i WHERE completed_at >= DATE_SUB(%s, INTERVAL 60 DAY) AND completed_at < DATE_SUB(%s, INTERVAL 30 DAY) AND status = %s',
					$this->table( 'submissions' ),
					current_time( 'mysql' ),
					current_time( 'mysql' ),
					$status_param
				)
			);
		} elseif ( 'dap_leads' === $table && 'created_at' === $date_col ) {
			$current = (int) $this->db()->get_var(
				$this->db()->prepare(
					'SELECT COUNT(*) FROM %i WHERE created_at >= DATE_SUB(%s, INTERVAL 30 DAY)',
					$this->table( 'leads' ),
					current_time( 'mysql' )
				)
			);
			$previous = (int) $this->db()->get_var(
				$this->db()->prepare(
					'SELECT COUNT(*) FROM %i WHERE created_at >= DATE_SUB(%s, INTERVAL 60 DAY) AND created_at < DATE_SUB(%s, INTERVAL 30 DAY)',
					$this->table( 'leads' ),
					current_time( 'mysql' ),
					current_time( 'mysql' )
				)
			);
		} else {
			return [ 'delta' => '0%', 'up' => false ];
		}

		return $this->format_delta_response( $current, $previous );
	}

	/**
	 * Calculate average score delta in last 30 days vs previous 30 days.
	 */
	private function calculate_avg_score_delta_30_days(): array {
		$current = (float) $this->db()->get_var(
			$this->db()->prepare(
				'SELECT AVG(normalized_score) FROM %i WHERE status = %s AND completed_at >= DATE_SUB(%s, INTERVAL 30 DAY)',
				$this->table( 'submissions' ),
				'completed',
				current_time( 'mysql' )
			)
		);

		$previous = (float) $this->db()->get_var(
			$this->db()->prepare(
				'SELECT AVG(normalized_score) FROM %i WHERE status = %s AND completed_at >= DATE_SUB(%s, INTERVAL 60 DAY) AND completed_at < DATE_SUB(%s, INTERVAL 30 DAY)',
				$this->table( 'submissions' ),
				'completed',
				current_time( 'mysql' ),
				current_time( 'mysql' )
			)
		);

		return $this->format_delta_response( $current, $previous );
	}

	/**
	 * Calculate completion rate delta in last 30 days vs previous 30 days.
	 */
	private function calculate_completion_rate_delta_30_days(): array {
		// Current 30 days completion rate
		$curr_total = (int) $this->db()->get_var(
			$this->db()->prepare(
				'SELECT COUNT(*) FROM %i WHERE started_at >= DATE_SUB(%s, INTERVAL 30 DAY)',
				$this->table( 'submissions' ),
				current_time( 'mysql' )
			)
		);

		$curr_comp = (int) $this->db()->get_var(
			$this->db()->prepare(
				'SELECT COUNT(*) FROM %i WHERE status = %s AND completed_at >= DATE_SUB(%s, INTERVAL 30 DAY)',
				$this->table( 'submissions' ),
				'completed',
				current_time( 'mysql' )
			)
		);

		$curr_rate = $curr_total > 0 ? ( $curr_comp / $curr_total ) * 100 : 0.0;

		// Previous 30 days completion rate
		$prev_total = (int) $this->db()->get_var(
			$this->db()->prepare(
				'SELECT COUNT(*) FROM %i WHERE started_at >= DATE_SUB(%s, INTERVAL 60 DAY) AND started_at < DATE_SUB(%s, INTERVAL 30 DAY)',
				$this->table( 'submissions' ),
				current_time( 'mysql' ),
				current_time( 'mysql' )
			)
		);

		$prev_comp = (int) $this->db()->get_var(
			$this->db()->prepare(
				'SELECT COUNT(*) FROM %i WHERE status = %s AND completed_at >= DATE_SUB(%s, INTERVAL 60 DAY) AND completed_at < DATE_SUB(%s, INTERVAL 30 DAY)',
				$this->table( 'submissions' ),
				'completed',
				current_time( 'mysql' ),
				current_time( 'mysql' )
			)
		);

		$prev_rate = $prev_total > 0 ? ( $prev_comp / $prev_total ) * 100 : 0.0;

		return $this->format_delta_response( $curr_rate, $prev_rate );
	}

	private function format_delta_response( float $current, float $previous ): array {
		if ( $previous == 0 ) {
			return [
				'delta' => $current > 0 ? '+100%' : '0%',
				'up'    => $current > 0,
			];
		}
		
		$change = ( ( $current - $previous ) / $previous ) * 100;
		$rounded = round( $change, 1 );
		
		$sign = $rounded > 0 ? '+' : '';
		
		return [
			'delta' => "{$sign}{$rounded}%",
			'up'    => $rounded >= 0,
		];
	}

	private function get_top_dropoff(): array {
		$results = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT question_id, COUNT(*) as events FROM %i WHERE event_type = %s AND question_id IS NOT NULL GROUP BY question_id ORDER BY events DESC LIMIT %d',
				$this->table( 'analytics_events' ),
				'drop',
				5
			),
			ARRAY_A
		);
		return $results ?: [];
	}
}

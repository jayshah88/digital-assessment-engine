<?php
/**
 * Submissions Controller — POST /submit, GET /submissions
 *
 * @package DigitalAssessmentPro\Api
 */

namespace DigitalAssessmentPro\Api;

defined( 'ABSPATH' ) || exit;

class SubmissionsController extends BaseController {

	protected $rest_base = 'submit';

	public function register_routes(): void {
		// Start/update a submission.
		register_rest_route( $this->namespace, "/{$this->rest_base}", [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'submit' ],
			'permission_callback' => '__return_true',
		] );

		// Save progress (partial).
		register_rest_route( $this->namespace, "/{$this->rest_base}/progress", [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'save_progress' ],
			'permission_callback' => '__return_true',
		] );

		// Get single result by UUID.
		register_rest_route( $this->namespace, "/result/(?P<uuid>[a-f0-9\\-]+)", [
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_result' ],
			'permission_callback' => '__return_true',
		] );

		// Admin: list submissions.
		register_rest_route( $this->namespace, "/submissions", [
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_items' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_view_submissions' ),
		] );

		// Admin: delete submission.
		register_rest_route( $this->namespace, "/submissions/(?P<id>[\d]+)", [
			'methods'             => \WP_REST_Server::DELETABLE,
			'callback'            => [ $this, 'delete_item' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_delete_submissions' ),
		] );

		// Admin: bulk delete submissions.
		register_rest_route( $this->namespace, "/submissions/bulk-delete", [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'bulk_delete' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_delete_submissions' ),
		] );
	}

	// ─── Submit ───────────────────────────────────────────────────────────

	/**
	 * Submit assessment.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function submit( $request ) {
		// CSRF nonce verification.
		$nonce_check = $this->verify_public_nonce( $request );
		if ( is_wp_error( $nonce_check ) ) {
			return $nonce_check;
		}

		// Rate limit.
		$rate_check = $this->check_rate_limit( $request, 'submit', 20 );
		if ( is_wp_error( $rate_check ) ) {
			return $rate_check;
		}

		$assessment_id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'assessment_id' ) ) ) );
		$answers       = $request->get_param( 'answers' ) ?? [];

		if ( ! $assessment_id || empty( $answers ) ) {
			return $this->error( 'missing_data', __( 'assessment_id and answers are required.', 'digital-assessment-pro' ) );
		}

		// Load assessment + version snapshot.
		$assessment = $this->db()->get_row(
			$this->db()->prepare(
				'SELECT a.*, av.id as version_id, av.snapshot FROM %i a LEFT JOIN %i av ON av.id = a.current_version WHERE a.id = %d AND a.status = %s',
				$this->table( 'assessments' ),
				$this->table( 'assessment_versions' ),
				$assessment_id,
				'published'
			),
			ARRAY_A
		);

		if ( ! $assessment ) {
			return $this->not_found( __( 'Assessment not found or not published.', 'digital-assessment-pro' ) );
		}

		// Load questions from snapshot or live DB.
		[ $questions, $blocks ] = $this->load_questions_and_blocks( $assessment );

		// Validate answers.
		$validation = $this->validate_answers( $answers, $questions );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		// Run scoring engine.
		$scoring = \dap()->get( 'scoring' );
		$result  = $scoring->score( $this->normalize_answers( $answers ), $questions, $blocks );

		$is_preview = rest_sanitize_boolean( $request->get_param( 'is_preview' ) ?? false );
		$uuid = null;
		$submission_id = null;

		if ( ! $is_preview ) {
			// Persist submission with transactional integrity.
			$this->db()->query( $this->db()->prepare( 'START TRANSACTION /* %d */', 1 ) );
			
			try {
				$uuid = wp_generate_uuid4();
				$inserted = $this->db()->insert(
					$this->table( 'submissions' ),
					[
						'uuid'             => $uuid,
						'assessment_id'    => $assessment_id,
						'version_id'       => $assessment['version_id'] ?? 0,
						'total_score'      => $result['total_score'],
						'normalized_score' => $result['percentage'],
						'score_level'      => $result['level']['key'] ?? '',
						'block_scores'     => wp_json_encode( $result['block_scores'] ),
						'status'           => 'completed',
						'ip_address'       => $this->anonymize_ip( $this->get_trusted_client_ip() ),
						'user_agent'       => substr( sanitize_text_field( $_SERVER['HTTP_USER_AGENT'] ?? '' ), 0, 500 ),
						'referrer'         => esc_url_raw( $_SERVER['HTTP_REFERER'] ?? '' ),
						'utm_source'       => sanitize_text_field( $request->get_param( 'utm_source' ) ?? '' ),
						'utm_medium'       => sanitize_text_field( $request->get_param( 'utm_medium' ) ?? '' ),
						'utm_campaign'     => sanitize_text_field( $request->get_param( 'utm_campaign' ) ?? '' ),
						'completed_at'     => current_time( 'mysql' ),
						'duration_seconds' => intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'duration_seconds' ) ?? 0 ) ) ),
					],
					[ '%s', '%d', '%d', '%f', '%f', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d' ]
				);

				if ( false === $inserted ) {
					throw new \Exception( 'Failed to insert submission record.' );
				}

				$submission_id = $this->db()->insert_id;

				// Persist individual answers within the same transaction.
				$this->persist_answers( $submission_id, $answers, $questions, $result['per_question'] );

				$this->db()->query( $this->db()->prepare( 'COMMIT /* %d */', 1 ) );
			} catch ( \Exception $e ) {
				$this->db()->query( $this->db()->prepare( 'ROLLBACK /* %d */', 1 ) );
				return $this->error( 'persistence_failed', __( 'Could not save assessment results.', 'digital-assessment-pro' ), 500 );
			}

			// Track completion event.
			\dap()->get( 'analytics' )->track( 'complete', $assessment_id, [
				'submission_id' => $submission_id,
				'score'         => $result['total_score'],
				'level'         => $result['level']['key'] ?? '',
			] );

			do_action( 'dap/submission/completed', $submission_id, $result, $assessment );
			$this->cache_delete( 'dap_analytics_overview' );
			delete_transient( 'dap_analytics_overview' );
		}

		return $this->success( [
			'uuid'          => $uuid,
			'submission_id' => $submission_id,
			'score'         => $result['total_score'],
			'total_score'   => $result['total_score'],
			'total_max'     => $result['total_max'] ?? 48,
			'level'         => $result['level'],
			'block_scores'  => $result['block_scores'],
			'recommendations' => $result['recommendations'],
			'require_lead'  => (bool) get_option( 'dap_lead_gate_enabled', true ),
		] );
	}

	/**
	 * Save progress.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function save_progress( $request ) {
		// CSRF nonce verification.
		$nonce_check = $this->verify_public_nonce( $request );
		if ( is_wp_error( $nonce_check ) ) {
			return $nonce_check;
		}

		// Rate limit to prevent abuse.
		$rate_check = $this->check_rate_limit( $request, 'save_progress', 60 );
		if ( is_wp_error( $rate_check ) ) {
			return $rate_check;
		}

		// Only broadcast sanitized, whitelisted params.
		$safe_params = [
			'assessment_id' => $this->sanitize_id( $request->get_param( 'assessment_id' ) ?? 0 ),
			'progress'      => absint( $request->get_param( 'progress' ) ?? 0 ),
		];
		do_action( 'dap/submission/progress', $safe_params );
		return $this->success( [ 'saved' => true ] );
	}

	/**
	 * Get result.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_result( $request ) {
		// Rate limit result lookups to prevent enumeration.
		$rate_check = $this->check_rate_limit( $request, 'result_lookup', 30 );
		if ( is_wp_error( $rate_check ) ) {
			return $rate_check;
		}

		$raw_uuid = sanitize_text_field( (string) $request->get_param( 'uuid' ) );

		// Strict UUID v4 format validation to prevent injection/enumeration.
		if ( ! preg_match( '/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/', $raw_uuid, $matches ) ) {
			return $this->error( 'invalid_uuid', __( 'Invalid result identifier.', 'digital-assessment-pro' ), 400 );
		}

		$uuid = sanitize_text_field( $matches[0] );

		$sub = $this->db()->get_row(
			$this->db()->prepare(
				'SELECT s.*, a.title as assessment_title, a.slug as assessment_slug FROM %i s JOIN %i a ON s.assessment_id = a.id WHERE s.uuid = %s',
				$this->table( 'submissions' ),
				$this->table( 'assessments' ),
				$uuid
			),
			ARRAY_A
		);

		if ( ! $sub ) {
			return $this->not_found( __( 'Result not found.', 'digital-assessment-pro' ) );
		}

		$sub['block_scores'] = json_decode( $sub['block_scores'] ?? '{}', true );

		// Calculate total_max from block_scores
		$total_max = 0.0;
		if ( is_array( $sub['block_scores'] ) ) {
			foreach ( $sub['block_scores'] as $bs ) {
				$total_max += (float) ( $bs['max'] ?? 0.0 );
			}
		}
		if ( $total_max <= 0 ) {
			$total_max = 48.0; // Fallback
		}

		$scoring = \dap()->get( 'scoring' );
		$level   = $scoring->map_level( (float) $sub['normalized_score'], $total_max );

		$assessment_id = intval( max( 0, (int) ( $sub['assessment_id'] ?? 0 ) ) );

		// Load block metadata for labels.
		$blocks = [];
		if ( $assessment_id > 0 ) {
			$blocks = $this->db()->get_results(
				$this->db()->prepare(
					'SELECT id, title, icon, color FROM %i WHERE assessment_id = %d ORDER BY sort_order',
					$this->table( 'blocks' ),
					$assessment_id
				),
				ARRAY_A
			);
		}

		return $this->success( [
			'submission'   => $sub,
			'level'        => $level,
			'blocks'       => $blocks,
			'require_lead' => (bool) get_option( 'dap_lead_gate_enabled', true ) && ! $sub['lead_id'],
		] );
	}

	/**
	 * Get items (List submissions).
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_items( $request ) {
		$assessment_id = intval( max( 0, (int) ( $request->get_param( 'assessment_id' ) ?? 0 ) ) );
		$page          = intval( max( 1, (int) ( $request->get_param( 'page' ) ?? 1 ) ) );
		$per_page      = intval( min( 100, max( 10, (int) ( $request->get_param( 'per_page' ) ?? 20 ) ) ) );
		$offset        = intval( max( 0, ( $page - 1 ) * $per_page ) );

		if ( $assessment_id > 0 ) {
			$total = (int) $this->db()->get_var(
				$this->db()->prepare(
					'SELECT COUNT(*) FROM %i WHERE assessment_id = %d',
					$this->table( 'submissions' ),
					$assessment_id
				)
			);

			$rows = $this->db()->get_results(
				$this->db()->prepare(
					'SELECT s.id, s.uuid, s.assessment_id, s.normalized_score, s.score_level, s.status, s.completed_at, l.email, l.first_name, l.last_name FROM %i s LEFT JOIN %i l ON s.lead_id = l.id WHERE s.assessment_id = %d ORDER BY s.completed_at DESC LIMIT %d OFFSET %d',
					$this->table( 'submissions' ),
					$this->table( 'leads' ),
					$assessment_id,
					$per_page,
					$offset
				),
				ARRAY_A
			);
		} else {
			$total = (int) $this->db()->get_var(
				$this->db()->prepare(
					'SELECT COUNT(*) FROM %i WHERE 1 = %d',
					$this->table( 'submissions' ),
					1
				)
			);

			$rows = $this->db()->get_results(
				$this->db()->prepare(
					'SELECT s.id, s.uuid, s.assessment_id, s.normalized_score, s.score_level, s.status, s.completed_at, l.email, l.first_name, l.last_name FROM %i s LEFT JOIN %i l ON s.lead_id = l.id ORDER BY s.completed_at DESC LIMIT %d OFFSET %d',
					$this->table( 'submissions' ),
					$this->table( 'leads' ),
					$per_page,
					$offset
				),
				ARRAY_A
			);
		}

		// Optimization: Batch fetch all related data to avoid N+1 queries
		$submission_ids = array_column( $rows, 'id' );
		
		if ( ! empty( $submission_ids ) ) {
			// Batch 1: Fetch all answers for all submissions using subqueries to avoid dynamic IN placeholder generation
			if ( $assessment_id ) {
				$all_answers = $this->db()->get_results(
					$this->db()->prepare(
						'SELECT sa.submission_id, sa.question_id, sa.question_key, sa.option_ids, sa.text_answer, sa.score_awarded, q.question_text, q.block_id FROM %i sa LEFT JOIN %i q ON sa.question_id = q.id INNER JOIN ( SELECT id FROM %i WHERE assessment_id = %d ORDER BY completed_at DESC LIMIT %d OFFSET %d ) s ON sa.submission_id = s.id',
						$this->table( 'submission_answers' ),
						$this->table( 'questions' ),
						$this->table( 'submissions' ),
						$assessment_id,
						$per_page,
						$offset
					),
					ARRAY_A
				);
			} else {
				$all_answers = $this->db()->get_results(
					$this->db()->prepare(
						'SELECT sa.submission_id, sa.question_id, sa.question_key, sa.option_ids, sa.text_answer, sa.score_awarded, q.question_text, q.block_id FROM %i sa LEFT JOIN %i q ON sa.question_id = q.id INNER JOIN ( SELECT id FROM %i ORDER BY completed_at DESC LIMIT %d OFFSET %d ) s ON sa.submission_id = s.id',
						$this->table( 'submission_answers' ),
						$this->table( 'questions' ),
						$this->table( 'submissions' ),
						$per_page,
						$offset
					),
					ARRAY_A
				);
			}

			// Group answers by submission_id for quick lookup
			$answers_by_submission = [];
			$all_block_ids = [];
			$all_question_ids = [];
			foreach ( $all_answers as $ans ) {
				$sid = (int) $ans['submission_id'];
				$answers_by_submission[ $sid ][] = $ans;
				$all_block_ids[] = $ans['block_id'];
				$all_question_ids[] = $ans['question_id'];
			}

			// Batch 2: Fetch block weights safely by assessment(s) to avoid dynamic IN arrays
			$block_weights = [];
			if ( $assessment_id > 0 ) {
				$blocks_data = $this->db()->get_results(
					$this->db()->prepare(
						'SELECT id, weight FROM %i WHERE assessment_id = %d',
						$this->table( 'blocks' ),
						$assessment_id
					),
					ARRAY_A
				);
			} else {
				$blocks_data = $this->db()->get_results(
					$this->db()->prepare(
						'SELECT id, weight FROM %i WHERE 1 = %d',
						$this->table( 'blocks' ),
						1
					),
					ARRAY_A
				);
			}
			foreach ( $blocks_data as $b ) {
				$block_weights[ (int) $b['id'] ] = (float) $b['weight'];
			}

			// Batch 3: Fetch options safely by joining options with assessment questions to avoid dynamic IN arrays
			$all_options = [];
			if ( $assessment_id > 0 ) {
				$opts = $this->db()->get_results(
					$this->db()->prepare(
						'SELECT o.id, o.question_id, o.option_text, o.score_value FROM %i o JOIN %i q ON o.question_id = q.id WHERE q.assessment_id = %d',
						$this->table( 'options' ),
						$this->table( 'questions' ),
						$assessment_id
					),
					ARRAY_A
				);
			} else {
				$opts = $this->db()->get_results(
					$this->db()->prepare(
						'SELECT o.id, o.question_id, o.option_text, o.score_value FROM %i o WHERE 1 = %d',
						$this->table( 'options' ),
						1
					),
					ARRAY_A
				);
			}
			foreach ( $opts as $opt ) {
				$all_options[ (int) $opt['question_id'] ][] = $opt;
			}
		}

		// Map data to submissions
		foreach ( $rows as &$row ) {
			$sid = (int) $row['id'];
			$answers = $answers_by_submission[ $sid ] ?? [];

			// Format answers for frontend.
			$row['answers'] = array_map( function( $ans ) use ( $all_options, $block_weights ) {
				$block_weight = $block_weights[ (int) $ans['block_id'] ] ?? 1.0;
				$q_id = (int) $ans['question_id'];
				$raw_option_ids = $ans['option_ids'];
				$selected_ids = array_filter( array_map( 'intval', explode( ',', $raw_option_ids ) ) );

				// Get all options for this question.
				$options = $all_options[ $q_id ] ?? [];
				$formatted_options = [];
				$letter = 'A';
				foreach ( $options as $opt ) {
					$opt_id = (int) $opt['id'];
					$is_selected = in_array( $opt_id, $selected_ids, true );
					// Calculate points with block weight applied.
					$opt_score = (float) ( $opt['score_value'] ?? 0 ) * $block_weight;
					$formatted_options[] = [
						'letter'       => $letter,
						'option_text'  => $opt['option_text'],
						'score_value'  => $opt['score_value'],
						'block_weight' => $block_weight,
						'points'       => $opt_score,
						'is_selected'  => $is_selected,
					];
					$letter++;
				}

				// Find selected answer text and points.
				$selected_answer = '';
				$selected_points = (float) $ans['score_awarded']; // Use the actual score awarded from DB.
				foreach ( $formatted_options as $opt ) {
					if ( $opt['is_selected'] ) {
						$selected_answer = $opt['option_text'];
						break;
					}
				}

				return [
					'question_id'      => $q_id,
					'question_text'    => $ans['question_text'] ?: $ans['question_key'],
					'answer_value'     => $selected_answer ?: $ans['text_answer'] ?: '—',
					'score_awarded'    => $selected_points,
					'points'           => $selected_points,
					'all_options'      => $formatted_options,
					'selected_letters' => array_map( function( $opt ) { return $opt['letter']; }, array_filter( $formatted_options, fn( $o ) => $o['is_selected'] ) ),
				];
			}, $answers );
		}
		unset( $row );

		return $this->success( $rows, 200, [ 'total' => $total, 'page' => $page, 'per_page' => $per_page ] );
	}

	/**
	 * Delete a submission.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_item( $request ) {
		$id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'id' ) ) ) );

		$submission = $this->db()->get_row(
			$this->db()->prepare(
				'SELECT id FROM %i WHERE id = %d',
				$this->table( 'submissions' ),
				$id
			),
			ARRAY_A
		);

		if ( ! $submission ) {
			return $this->not_found();
		}

		// Delete related answers first.
		$this->db()->delete( $this->table( 'submission_answers' ), [ 'submission_id' => $id ], [ '%d' ] );

		// Delete the submission.
		$this->db()->delete( $this->table( 'submissions' ), [ 'id' => $id ], [ '%d' ] );

		$this->cache_delete( 'dap_analytics_overview' );
		delete_transient( 'dap_analytics_overview' );

		return $this->success( [ 'deleted' => true ] );
	}

	/**
	 * Bulk delete submissions.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function bulk_delete( $request ) {
		$ids = $request->get_param( 'ids' );
		if ( ! is_array( $ids ) || empty( $ids ) ) {
			return $this->error( 'invalid_ids', __( 'Invalid or empty IDs array.', 'digital-assessment-pro' ), 400 );
		}

		// Wrap in transaction for atomicity
		$this->db()->query( $this->db()->prepare( 'START TRANSACTION /* %d */', 1 ) );
		
		try {
			$deleted = 0;
			foreach ( $ids as $id ) {
				$id = intval( max( 0, (int) $this->sanitize_id( $id ) ) );
				if ( $id > 0 ) {
					// Delete related answers first.
					$this->db()->delete( $this->table( 'submission_answers' ), [ 'submission_id' => $id ], [ '%d' ] );
					// Delete the submission.
					$this->db()->delete( $this->table( 'submissions' ), [ 'id' => $id ], [ '%d' ] );
					$deleted++;
				}
			}
			
			$this->db()->query( $this->db()->prepare( 'COMMIT /* %d */', 1 ) );
			$this->cache_delete( 'dap_analytics_overview' );
			delete_transient( 'dap_analytics_overview' );
			return $this->success( [ 'deleted' => $deleted ] );
		} catch ( \Exception $e ) {
			$this->db()->query( $this->db()->prepare( 'ROLLBACK /* %d */', 1 ) );
			return $this->error( 'bulk_delete_failed', __( 'Failed to delete submissions. Please try again.', 'digital-assessment-pro' ), 500 );
		}
	}

	// ─── Helpers ──────────────────────────────────────────────────────────

	private function load_questions_and_blocks( array $assessment ): array {
		$snapshot_valid = false;
		$questions      = [];
		$blocks         = [];
		$assessment_id  = intval( max( 0, (int) ( $assessment['id'] ?? 0 ) ) );

		if ( ! empty( $assessment['snapshot'] ) ) {
			$snap      = json_decode( $assessment['snapshot'], true );
			$questions = $snap['questions'] ?? [];
			$blocks    = $snap['blocks']    ?? [];

			// Self-Healing Guard: Verify if the first question and its options in the snapshot actually exist in the live database.
			// If not, the database was imported/migrated and IDs have shifted, making the snapshot stale.
			if ( ! empty( $questions ) ) {
				$first_q    = $questions[0];
				$first_q_id = intval( max( 0, (int) ( $first_q['id'] ?? 0 ) ) );
				$exists     = $this->db()->get_var(
					$this->db()->prepare(
						'SELECT id FROM %i WHERE id = %d AND assessment_id = %d',
						$this->table( 'questions' ),
						$first_q_id,
						$assessment_id
					)
				);
				if ( $exists ) {
					$snapshot_valid = true;
					// Check options shift/mismatch to prevent stale option ID mapping.
					if ( ! empty( $first_q['options'] ) ) {
						$first_opt_id = intval( max( 0, (int) ( $first_q['options'][0]['id'] ?? 0 ) ) );
						$opt_exists   = $this->db()->get_var(
							$this->db()->prepare(
								'SELECT id FROM %i WHERE id = %d AND question_id = %d',
								$this->table( 'options' ),
								$first_opt_id,
								$first_q_id
							)
						);
						if ( ! $opt_exists ) {
							$snapshot_valid = false;
						}
					}
				}
			}
		}

		if ( $snapshot_valid ) {
			return [ $questions, $blocks ];
		}

		// Rebuild snapshot from live tables automatically
		$blocks    = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT * FROM %i WHERE assessment_id = %d',
				$this->table( 'blocks' ),
				$assessment_id
			),
			ARRAY_A
		);
		$questions = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT * FROM %i WHERE assessment_id = %d',
				$this->table( 'questions' ),
				$assessment_id
			),
			ARRAY_A
		);
		$q_ids = array_column( $questions, 'id' );
		if ( $q_ids ) {
			$options = $this->db()->get_results(
				$this->db()->prepare(
					'SELECT o.* FROM %i o JOIN %i q ON o.question_id = q.id WHERE q.assessment_id = %d',
					$this->table( 'options' ),
					$this->table( 'questions' ),
					$assessment_id
				),
				ARRAY_A
			);
			$opts_by_q = [];
			foreach ( $options as $o ) {
				$opts_by_q[ $o['question_id'] ][] = $o;
			}
			foreach ( $questions as &$q ) {
				$q['options'] = $opts_by_q[ $q['id'] ] ?? [];
			}
			unset( $q ); // Fix reference ghosting.
		}

		// Automatically fix and re-save the snapshot in the database for future hits
		if ( ! empty( $assessment['version_id'] ) ) {
			$this->db()->update(
				$this->table( 'assessment_versions' ),
				[ 'snapshot' => wp_json_encode( compact( 'blocks', 'questions' ) ) ],
				[ 'id' => $assessment['version_id'] ],
				[ '%s' ],
				[ '%d' ]
			);
		}

		return [ $questions, $blocks ];
	}

	private function normalize_answers( array $raw ): array {
		$normalized = [];
		foreach ( $raw as $qid => $val ) {
			$normalized[ (int) $qid ] = is_array( $val ) ? array_map( 'intval', $val ) : $val;
		}
		return $normalized;
	}

	private function validate_answers( array $answers, array $questions ): bool|\WP_Error {
		$required_ids = array_column(
			array_filter( $questions, fn( $q ) => (int) $q['is_required'] === 1 && $q['question_type'] !== 'text' ),
			'id'
		);
		$answered_ids = array_map( 'intval', array_keys( $answers ) );
		$missing      = array_diff( $required_ids, $answered_ids );

		if ( ! empty( $missing ) ) {
			error_log( sprintf( '[DAP] Submission Validation Failed. Missing IDs: %s', implode( ',', $missing ) ) );
			return $this->error(
				'validation_failed',
				__( 'Required questions are missing answers.', 'digital-assessment-pro' ),
				422,
				[ 'missing_question_ids' => array_values( $missing ) ]
			);
		}
		return true;
	}

	private function persist_answers( int $submission_id, array $answers, array $questions, array $per_question ): void {
		$q_map = array_column( $questions, null, 'id' );
		foreach ( $answers as $q_id => $val ) {
			$q = $q_map[ (int) $q_id ] ?? null;
			if ( ! $q ) {
				continue;
			}

			$opt_ids  = is_array( $val ) ? implode( ',', array_map( 'intval', $val ) ) : (string) (int) $val;
			$text_ans = is_string( $val ) ? sanitize_textarea_field( $val ) : null;

			// Build human-readable answer text for multiple choice questions.
			if ( ! is_string( $val ) && ! empty( $q['options'] ) ) {
				$selected_ids = is_array( $val ) ? array_map( 'intval', $val ) : [ (int) $val ];
				$selected_texts = [];
				foreach ( $q['options'] as $opt ) {
					if ( in_array( (int) $opt['id'], $selected_ids, true ) ) {
						$selected_texts[] = $opt['option_text'];
					}
				}
				if ( ! empty( $selected_texts ) ) {
					$text_ans = implode( ', ', $selected_texts );
				}
			}

			$this->db()->insert(
				$this->table( 'submission_answers' ),
				[
					'submission_id' => $submission_id,
					'question_id'   => (int) $q_id,
					'question_key'  => $q['question_key'],
					'option_ids'    => $opt_ids,
					'text_answer'   => $text_ans,
					'score_awarded' => (float) ( $per_question[ (int) $q_id ] ?? 0 ),
				],
				[ '%d', '%d', '%s', '%s', '%s', '%f' ]
			);
		}
	}

	/**
	 * @deprecated Use get_trusted_client_ip() from BaseController instead.
	 */
	private function get_client_ip(): string {
		return $this->get_trusted_client_ip();
	}
}

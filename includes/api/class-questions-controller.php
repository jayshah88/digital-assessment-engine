<?php
/**
 * Questions Controller — GET /questions, POST/PUT/DELETE /questions/{id}
 *
 * @package DigitalAssessmentPro\Api
 */

namespace DigitalAssessmentPro\Api;

defined( 'ABSPATH' ) || exit;

class QuestionsController extends BaseController {

	protected $rest_base = 'questions';

	public function register_routes(): void {
		register_rest_route( $this->namespace, "/{$this->rest_base}", [
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_items' ],
				'permission_callback' => '__return_true',
				'args'                => [
					'assessment_id' => [ 'required' => true, 'validate_callback' => [ $this, 'is_numeric_param' ] ],
					'version_id'    => [ 'required' => false, 'validate_callback' => [ $this, 'is_numeric_param' ] ],
				],
			],
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'create_item' ],
				'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_manage_questions' ),
			],
		] );

		register_rest_route( $this->namespace, "/{$this->rest_base}/(?P<id>[\\d]+)", [
			[
				'methods'             => \WP_REST_Server::EDITABLE,
				'callback'            => [ $this, 'update_item' ],
				'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_manage_questions' ),
			],
			[
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'delete_item' ],
				'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_manage_questions' ),
			],
		] );

		// Bulk reorder.
		register_rest_route( $this->namespace, "/{$this->rest_base}/reorder", [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'reorder_items' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_manage_questions' ),
		] );

		// Bulk import.
		register_rest_route( $this->namespace, "/{$this->rest_base}/import", [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'bulk_import' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_manage_questions' ),
		] );

		// Bulk export.
		register_rest_route( $this->namespace, "/{$this->rest_base}/export", [
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => [ $this, 'bulk_export' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_manage_questions' ),
			'args'                => [
				'assessment_id' => [ 'required' => true, 'validate_callback' => [ $this, 'is_numeric_param' ] ],
			],
		] );
	}

	/**
	 * Get items.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_items( $request ) {
		$assessment_id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'assessment_id' ) ) ) );
		$can_manage    = current_user_can( 'dap_manage_questions' );
		$cache_key     = "dap_questions_{$assessment_id}_" . ( $can_manage ? 'admin' : 'public' );
		$cached        = $this->cache_get( $cache_key );

		if ( false !== $cached ) {
			return $this->success( $cached );
		}

		$blocks = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT * FROM %i WHERE assessment_id = %d ORDER BY sort_order',
				$this->table( 'blocks' ),
				$assessment_id
			),
			ARRAY_A
		);

		$questions = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT * FROM %i WHERE assessment_id = %d ORDER BY block_id ASC, sort_order ASC',
				$this->table( 'questions' ),
				$assessment_id
			),
			ARRAY_A
		);

		$options = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT o.* FROM %i o JOIN %i q ON o.question_id = q.id WHERE q.assessment_id = %d ORDER BY o.sort_order',
				$this->table( 'options' ),
				$this->table( 'questions' ),
				$assessment_id
			),
			ARRAY_A
		);

		$opts_by_q = [];
		foreach ( $options as $opt ) {
			if ( ! $can_manage ) {
				unset( $opt['score_value'] );
			}
			$opts_by_q[ $opt['question_id'] ][] = $opt;
		}

		foreach ( $questions as &$q ) {
			$q['options']  = $opts_by_q[ $q['id'] ] ?? [];
			$q['settings'] = json_decode( $q['settings'] ?? '{}', true );
		}
		unset( $q ); // Fix reference ghosting.

		$qs_by_block = [];
		foreach ( $questions as $q ) {
			$qs_by_block[ $q['block_id'] ][] = $q;
		}
		foreach ( $blocks as &$b ) {
			$b['questions'] = $qs_by_block[ $b['id'] ] ?? [];
			$b['settings']  = json_decode( $b['settings'] ?? '{}', true );
		}
		unset( $b );

		$this->cache_set( $cache_key, $blocks, 300 );
		return $this->success( $blocks );
	}

	/**
	 * Create item.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function create_item( $request ) {
		$block_id      = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'block_id' ) ) ) );
		$assessment_id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'assessment_id' ) ) ) );
		$version_id    = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'version_id' ) ?? 0 ) ) );
		$question_text = sanitize_textarea_field( $request->get_param( 'question_text' ) );

		if ( ! $block_id || ! $assessment_id || empty( $question_text ) ) {
			return $this->error( 'missing_params', __( 'block_id, assessment_id, and question_text are required.', 'digital-assessment-pro' ) );
		}

		// Validate question_type against allowed enum values.
		$valid_types = [ 'single', 'multi', 'scale', 'text', 'boolean' ];
		$question_type = sanitize_text_field( $request->get_param( 'question_type' ) ?? 'single' );
		if ( ! in_array( $question_type, $valid_types, true ) ) {
			return $this->error( 'invalid_type', __( 'Invalid question type. Allowed: single, multi, scale, text, boolean.', 'digital-assessment-pro' ), 400 );
		}

		// Validate question_text length.
		if ( mb_strlen( $question_text ) > 5000 ) {
			return $this->error( 'text_too_long', __( 'Question text must be under 5000 characters.', 'digital-assessment-pro' ), 400 );
		}

		// Next sort order in block.
		$sort_order = (int) $this->db()->get_var(
			$this->db()->prepare(
				'SELECT COALESCE(MAX(sort_order),0) + 1 FROM %i WHERE block_id = %d',
				$this->table( 'questions' ),
				$block_id
			)
		);

		$key = 'q_' . uniqid();
		$this->db()->insert(
			$this->table( 'questions' ),
			[
				'block_id'      => $block_id,
				'assessment_id' => $assessment_id,
				'version_id'    => $version_id,
				'question_key'  => $key,
				'question_text' => $question_text,
				'helper_text'   => sanitize_textarea_field( $request->get_param( 'helper_text' ) ?? '' ),
				'question_type' => $question_type,
				'is_required'   => (int) ( $request->get_param( 'is_required' ) ?? 1 ),
				'sort_order'    => $sort_order,
				'settings'      => wp_json_encode( $request->get_param( 'settings' ) ?: [] ),
				'weight'        => (float) ( $request->get_param( 'weight' ) ?? 1.0 ),
			],
			[ '%d', '%d', '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%f' ]
		);

		$question_id = $this->db()->insert_id;

		// Insert options if provided.
		$options = $request->get_param( 'options' ) ?? [];
		foreach ( $options as $i => $opt ) {
			$this->db()->insert(
				$this->table( 'options' ),
				[
					'question_id' => $question_id,
					'option_text' => sanitize_text_field( $opt['option_text'] ?? $opt['text'] ?? $opt['label'] ?? '' ),
					'option_value'=> sanitize_text_field( $opt['option_value'] ?? $opt['value'] ?? (string) $i ),
					'score_value' => (float) ( $opt['score_value'] ?? 0 ),
					'sort_order'  => $i,
					'weight'      => (float) ( $opt['weight'] ?? 1.0 ),
				],
				[ '%d', '%s', '%s', '%f', '%d', '%f' ]
			);
		}

		$this->clear_questions_cache( $assessment_id );
		return $this->success( [ 'id' => $question_id ], 201 );
	}

	/**
	 * Update item.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_item( $request ) {
		$id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'id' ) ) ) );
		$q  = $this->db()->get_row(
			$this->db()->prepare(
				'SELECT * FROM %i WHERE id = %d',
				$this->table( 'questions' ),
				$id
			),
			ARRAY_A
		);

		if ( ! $q ) {
			return $this->not_found();
		}

		$this->db()->update(
			$this->table( 'questions' ),
			[
				'question_text' => sanitize_textarea_field( $request->get_param( 'question_text' ) ?? $q['question_text'] ),
				'helper_text'   => sanitize_textarea_field( $request->get_param( 'helper_text' ) ?? $q['helper_text'] ),
				'question_type' => sanitize_text_field( $request->get_param( 'question_type' ) ?? $q['question_type'] ),
				'is_required'   => (int) ( $request->get_param( 'is_required' ) ?? $q['is_required'] ),
				'settings'      => wp_json_encode( $request->get_param( 'settings' ) ?: json_decode( $q['settings'], true ) ),
				'weight'        => (float) ( $request->get_param( 'weight' ) ?? $q['weight'] ),
			],
			[ 'id' => $id ],
			[ '%s', '%s', '%s', '%d', '%s', '%f' ],
			[ '%d' ]
		);

		// If options provided, replace them.
		if ( null !== $request->get_param( 'options' ) ) {
			$options = (array) $request->get_param( 'options' );
			$this->db()->delete( $this->table( 'options' ), [ 'question_id' => $id ], [ '%d' ] );

			foreach ( $options as $i => $opt ) {
				$this->db()->insert(
					$this->table( 'options' ),
					[
						'question_id' => $id,
						'option_text' => sanitize_text_field( $opt['option_text'] ?? $opt['text'] ?? $opt['label'] ?? '' ),
						'option_value'=> sanitize_text_field( $opt['option_value'] ?? $opt['value'] ?? (string) $i ),
						'score_value' => (float) ( $opt['score_value'] ?? 0 ),
						'sort_order'  => $i,
						'weight'      => (float) ( $opt['weight'] ?? 1.0 ),
					],
					[ '%d', '%s', '%s', '%f', '%d', '%f' ]
				);
			}
		}

		$this->clear_questions_cache( (int) $q['assessment_id'] );
		return $this->success( [ 'updated' => true ] );
	}

	/**
	 * Delete item.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_item( $request ) {
		$id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'id' ) ) ) );
		$q  = $this->db()->get_row(
			$this->db()->prepare(
				'SELECT assessment_id FROM %i WHERE id = %d',
				$this->table( 'questions' ),
				$id
			)
		);

		$this->db()->delete( $this->table( 'options' ),   [ 'question_id' => $id ], [ '%d' ] );
		$this->db()->delete( $this->table( 'questions' ), [ 'id' => $id ],          [ '%d' ] );

		if ( $q ) {
			$this->clear_questions_cache( (int) $q->assessment_id );
		}
		return $this->success( [ 'deleted' => true ] );
	}

	public function reorder_items( \WP_REST_Request $request ): \WP_REST_Response {
		$items = $request->get_param( 'items' ) ?? [];
		foreach ( $items as $item ) {
			$this->db()->update(
				$this->table( 'questions' ),
				[ 'sort_order' => (int) $item['order'], 'block_id' => (int) ( $item['block_id'] ?? 0 ) ],
				[ 'id'         => (int) $item['id'] ],
				[ '%d', '%d' ],
				[ '%d' ]
			);
		}
		if ( ! empty( $items ) ) {
			$first_id = (int) ( $items[0]['id'] ?? 0 );
			$aid = (int) $this->db()->get_var(
				$this->db()->prepare( 'SELECT assessment_id FROM %i WHERE id = %d', $this->table( 'questions' ), $first_id )
			);
			if ( $aid ) {
				$this->clear_questions_cache( $aid );
			}
		}
		return $this->success( [ 'reordered' => count( $items ) ] );
	}

	public function bulk_import( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$assessment_id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'assessment_id' ) ) ) );
		$items         = $request->get_param( 'questions' ) ?? [];
		$imported      = 0;

		foreach ( $items as $item ) {
			$block_title = trim( sanitize_text_field( $item['block'] ?? 'General' ) );

			// Get or create block.
			$block_id = $this->db()->get_var(
				$this->db()->prepare(
					'SELECT id FROM %i WHERE assessment_id = %d AND ( title = %s OR TRIM(title) = %s )',
					$this->table( 'blocks' ),
					$assessment_id,
					$block_title,
					$block_title
				)
			);

			if ( ! $block_id ) {
				$this->db()->insert(
					$this->table( 'blocks' ),
					[ 
						'assessment_id' => $assessment_id, 
						'version_id' => 0, 
						'title' => $block_title, 
						'sort_order' => 0,
						'weight' => (float) ( $item['block_weight'] ?? 1.0 ),
					],
					[ '%d', '%d', '%s', '%d', '%f' ]
				);
				$block_id = $this->db()->insert_id;
			} else if ( isset( $item['block_weight'] ) ) {
				$this->db()->update(
					$this->table( 'blocks' ),
					[ 'weight' => (float) $item['block_weight'] ],
					[ 'id' => $block_id ],
					[ '%f' ],
					[ '%d' ]
				);
			}

			$request->set_param( 'block_id', $block_id );
			$request->set_param( 'assessment_id', $assessment_id );
			$request->set_param( 'question_text', $item['question'] ?? '' );
			$request->set_param( 'question_type', $item['type'] ?? 'single' );
			$request->set_param( 'options', $item['options'] ?? [] );
			$request->set_param( 'weight', $item['weight'] ?? 1.0 );

			$result = $this->create_item( $request );
			if ( ! is_wp_error( $result ) ) {
				$imported++;
			}
		}

		$this->clear_questions_cache( $assessment_id );
		return $this->success( [ 'imported' => $imported ] );
	}

	public function bulk_export( \WP_REST_Request $request ): \WP_REST_Response {
		$assessment_id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'assessment_id' ) ) ) );

		// Fetch blocks.
		$blocks = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT * FROM %i WHERE assessment_id = %d ORDER BY sort_order',
				$this->table( 'blocks' ),
				$assessment_id
			),
			ARRAY_A
		);

		$block_titles = [];
		$block_weights = [];
		foreach ( $blocks as $b ) {
			$block_titles[ $b['id'] ] = $b['title'];
			$block_weights[ $b['id'] ] = (float) $b['weight'];
		}

		// Fetch questions.
		$questions = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT * FROM %i WHERE assessment_id = %d ORDER BY block_id ASC, sort_order ASC',
				$this->table( 'questions' ),
				$assessment_id
			),
			ARRAY_A
		);

		$options = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT o.* FROM %i o JOIN %i q ON o.question_id = q.id WHERE q.assessment_id = %d ORDER BY o.sort_order',
				$this->table( 'options' ),
				$this->table( 'questions' ),
				$assessment_id
			),
			ARRAY_A
		);

		$opts_by_q = [];
		foreach ( $options as $opt ) {
			$opts_by_q[ $opt['question_id'] ][] = [
				'text'        => $opt['option_text'],
				'value'       => $opt['option_value'],
				'score_value' => (float) $opt['score_value'],
				'weight'      => (float) $opt['weight'],
			];
		}

		$export_data = [];
		foreach ( $questions as $q ) {
			$export_data[] = [
				'block'        => $block_titles[ $q['block_id'] ] ?? 'General',
				'block_weight' => $block_weights[ $q['block_id'] ] ?? 1.0,
				'question'     => $q['question_text'],
				'weight'       => (float) $q['weight'],
				'type'         => $q['question_type'],
				'options'      => $opts_by_q[ $q['id'] ] ?? [],
			];
		}

		return $this->success( $export_data );
	}

	/**
	 * Invalidate questions cache for an assessment.
	 *
	 * @param int $assessment_id Assessment ID.
	 */
	private function clear_questions_cache( int $assessment_id ): void {
		$this->cache_delete( "dap_questions_{$assessment_id}" );
		$this->cache_delete( "dap_questions_{$assessment_id}_admin" );
		$this->cache_delete( "dap_questions_{$assessment_id}_public" );
	}
}

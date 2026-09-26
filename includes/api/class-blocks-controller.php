<?php
/**
 * Blocks Controller — POST/PUT/DELETE /blocks
 *
 * @package DigitalAssessmentPro\Api
 */

namespace DigitalAssessmentPro\Api;

defined( 'ABSPATH' ) || exit;

class BlocksController extends BaseController {

	protected $rest_base = 'blocks';

	public function register_routes(): void {
		// Create block.
		register_rest_route( $this->namespace, "/{$this->rest_base}", [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'create_item' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_manage_questions' ),
		] );

		// Update block.
		register_rest_route( $this->namespace, "/{$this->rest_base}/(?P<id>[\\d]+)", [
			'methods'             => \WP_REST_Server::EDITABLE,
			'callback'            => [ $this, 'update_item' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_manage_questions' ),
		] );

		// Delete block.
		register_rest_route( $this->namespace, "/{$this->rest_base}/(?P<id>[\\d]+)", [
			'methods'             => \WP_REST_Server::DELETABLE,
			'callback'            => [ $this, 'delete_item' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_manage_questions' ),
		] );

		// Reorder blocks.
		register_rest_route( $this->namespace, "/{$this->rest_base}/reorder", [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'reorder_items' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_manage_questions' ),
		] );
	}

	/**
	 * Create a new block.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function create_item( $request ) {
		$assessment_id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'assessment_id' ) ) ) );
		$title         = sanitize_text_field( $request->get_param( 'title' ) );
		$weight        = (float) ( $request->get_param( 'weight' ) ?? 1.0 );

		if ( ! $assessment_id || empty( $title ) ) {
			return $this->error( 'missing_params', __( 'assessment_id and title are required.', 'digital-assessment-pro' ) );
		}

		// Get next sort order.
		$sort_order = (int) $this->db()->get_var(
			$this->db()->prepare(
				'SELECT COALESCE(MAX(sort_order),0) + 1 FROM %i WHERE assessment_id = %d',
				$this->table( 'blocks' ),
				$assessment_id
			)
		);

		$this->db()->insert(
			$this->table( 'blocks' ),
			[
				'assessment_id' => $assessment_id,
				'version_id'    => 0,
				'title'         => $title,
				'description'   => sanitize_textarea_field( $request->get_param( 'description' ) ?? '' ),
				'icon'          => sanitize_text_field( $request->get_param( 'icon' ) ?? '' ),
				'color'         => sanitize_hex_color( $request->get_param( 'color' ) ?? '#6366F1' ),
				'weight'        => $weight,
				'sort_order'    => $sort_order,
				'settings'      => wp_json_encode( $request->get_param( 'settings' ) ?: [] ),
			],
			[ '%d', '%d', '%s', '%s', '%s', '%s', '%f', '%d', '%s' ]
		);

		$block_id = $this->db()->insert_id;

		$this->cache_delete( "dap_questions_{$assessment_id}" );

		return $this->success( [ 'id' => $block_id, 'sort_order' => $sort_order ], 201 );
	}

	/**
	 * Update a block.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_item( $request ) {
		$id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'id' ) ) ) );
		$block = $this->db()->get_row(
			$this->db()->prepare(
				'SELECT * FROM %i WHERE id = %d',
				$this->table( 'blocks' ),
				$id
			),
			ARRAY_A
		);

		if ( ! $block ) {
			return $this->not_found( __( 'Block not found.', 'digital-assessment-pro' ) );
		}

		$data   = [];
		$format = [];

		if ( null !== $request->get_param( 'title' ) ) {
			$data['title']  = sanitize_text_field( $request->get_param( 'title' ) );
			$format[]       = '%s';
		}
		if ( null !== $request->get_param( 'description' ) ) {
			$data['description'] = sanitize_textarea_field( $request->get_param( 'description' ) );
			$format[]            = '%s';
		}
		if ( null !== $request->get_param( 'weight' ) ) {
			$data['weight'] = (float) $request->get_param( 'weight' );
			$format[]       = '%f';
		}
		if ( null !== $request->get_param( 'color' ) ) {
			$data['color'] = sanitize_hex_color( $request->get_param( 'color' ) );
			$format[]      = '%s';
		}
		if ( null !== $request->get_param( 'icon' ) ) {
			$data['icon'] = sanitize_text_field( $request->get_param( 'icon' ) );
			$format[]     = '%s';
		}
		if ( null !== $request->get_param( 'settings' ) ) {
			$data['settings'] = wp_json_encode( $request->get_param( 'settings' ) );
			$format[]         = '%s';
		}

		if ( ! empty( $data ) ) {
			$this->db()->update( $this->table( 'blocks' ), $data, [ 'id' => $id ], $format, [ '%d' ] );
		}

		$this->cache_delete( "dap_questions_{$block['assessment_id']}" );

		return $this->success( [ 'updated' => true ] );
	}

	/**
	 * Delete a block.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_item( $request ) {
		$id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'id' ) ) ) );
		$block = $this->db()->get_row(
			$this->db()->prepare(
				'SELECT assessment_id FROM %i WHERE id = %d',
				$this->table( 'blocks' ),
				$id
			),
			ARRAY_A
		);

		if ( ! $block ) {
			return $this->not_found( __( 'Block not found.', 'digital-assessment-pro' ) );
		}

		$assessment_id = intval( $block['assessment_id'] );

		// Delete options for all questions in this block via atomic join delete.
		$this->db()->query(
			$this->db()->prepare(
				'DELETE o FROM %i o JOIN %i q ON o.question_id = q.id WHERE q.block_id = %d',
				$this->table( 'options' ),
				$this->table( 'questions' ),
				$id
			)
		);

		// Delete questions.
		$this->db()->delete( $this->table( 'questions' ), [ 'block_id' => $id ], [ '%d' ] );

		// Delete block.
		$this->db()->delete( $this->table( 'blocks' ), [ 'id' => $id ], [ '%d' ] );

		$this->cache_delete( "dap_questions_{$assessment_id}" );

		return $this->success( [ 'deleted' => true ] );
	}

	/**
	 * Reorder blocks.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function reorder_items( $request ) {
		$items         = $request->get_param( 'items' ) ?? [];
		$assessment_id = 0;

		foreach ( $items as $item ) {
			if ( ! $assessment_id && ! empty( $item['id'] ) ) {
				$assessment_id = (int) $this->db()->get_var(
					$this->db()->prepare(
						'SELECT assessment_id FROM %i WHERE id = %d',
						$this->table( 'blocks' ),
						intval( $item['id'] )
					)
				);
			}
			$this->db()->update(
				$this->table( 'blocks' ),
				[ 'sort_order' => (int) $item['order'] ],
				[ 'id'         => (int) $item['id'] ],
				[ '%d' ],
				[ '%d' ]
			);
		}

		if ( $assessment_id ) {
			$this->cache_delete( "dap_questions_{$assessment_id}" );
		}

		return $this->success( [ 'reordered' => count( $items ) ] );
	}
}

<?php
/**
 * Assessments Controller — GET /assessment, GET /assessment/{id}
 *
 * @package DigitalAssessmentPro\Api
 */

namespace DigitalAssessmentPro\Api;

defined( 'ABSPATH' ) || exit;

class AssessmentsController extends BaseController {

	protected $rest_base = 'assessment';

	public function register_routes(): void {
		register_rest_route( $this->namespace, "/{$this->rest_base}", [
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_items' ],
				'permission_callback' => '__return_true', // Public list.
				'args'                => [
					'status' => [
						'default'           => 'published',
						'enum'              => [ 'published', 'draft', 'archived' ],
						'sanitize_callback' => 'sanitize_text_field',
					],
				],
			],
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'create_item' ],
				'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_manage_assessments' ),
				'args'                => $this->create_item_schema(),
			],
		] );

		register_rest_route( $this->namespace, "/{$this->rest_base}/(?P<id>[\\d]+)", [
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_item' ],
				'permission_callback' => '__return_true',
				'args'                => [ 'id' => [ 'validate_callback' => [ $this, 'is_numeric_param' ] ] ],
			],
			[
				'methods'             => \WP_REST_Server::EDITABLE,
				'callback'            => [ $this, 'update_item' ],
				'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_manage_assessments' ),
			],
			[
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'delete_item' ],
				'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_delete_assessments' ),
			],
		] );

		// Duplicate.
		register_rest_route( $this->namespace, "/{$this->rest_base}/(?P<id>[\\d]+)/duplicate", [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'duplicate_item' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_manage_assessments' ),
		] );

		// Bulk delete.
		register_rest_route( $this->namespace, "/{$this->rest_base}/bulk-delete", [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'bulk_delete' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_delete_assessments' ),
		] );

		// Lookup by Slug.
		register_rest_route( $this->namespace, "/{$this->rest_base}/slug/(?P<slug>[a-z0-9-]+)", [
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_item_by_slug' ],
			'permission_callback' => '__return_true',
		] );

		// Publish/unpublish version.
		register_rest_route( $this->namespace, "/{$this->rest_base}/(?P<id>[\\d]+)/publish", [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'publish_version' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_publish_assessments' ),
		] );

		// HubSpot integration config (public - for frontend form rendering).
		register_rest_route( $this->namespace, "/{$this->rest_base}/(?P<id>[\\d]+)/hubspot-config", [
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_hubspot_config' ],
			'permission_callback' => '__return_true',
			'args'                => [ 'id' => [ 'validate_callback' => [ $this, 'is_numeric_param' ] ] ],
		] );

		// HubSpot integration config update (admin only).
		register_rest_route( $this->namespace, "/{$this->rest_base}/(?P<id>[\\d]+)/hubspot-config", [
			'methods'             => \WP_REST_Server::EDITABLE,
			'callback'            => [ $this, 'update_hubspot_config' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_manage_assessments' ),
			'args'                => [ 'id' => [ 'validate_callback' => [ $this, 'is_numeric_param' ] ] ],
		] );
	}

	// ─── Handlers ─────────────────────────────────────────────────────────

	/**
	 * Get a collection of assessments.
	 *
	 * @param \WP_REST_Request $request Full data about the request.
	 * @return \WP_REST_Response|\WP_Error Response object or error.
	 */
	public function get_items( $request ) {
		$raw_status = (string) ( $request->get_param( 'status' ) ?? '' );
		$cache_key  = 'dap_assessments_' . sanitize_key( $raw_status ?: 'published' );
		$cached     = $this->cache_get( $cache_key );
		if ( false !== $cached ) {
			return $this->success( $cached );
		}

		$rows = $this->fetch_assessments_by_status( $raw_status );

		$this->cache_set( $cache_key, $rows, (int) get_option( 'dap_cache_ttl', 300 ) );
		return $this->success( $rows );
	}

	/**
	 * Safe data layer helper to fetch assessments by status using literal prepared statements.
	 *
	 * @param string $status_key Raw status filter string.
	 * @return array List of assessment rows.
	 */
	private function fetch_assessments_by_status( string $status_key ): array {
		if ( 'draft,published' === $status_key || 'published,draft' === $status_key ) {
			return $this->db()->get_results(
				$this->db()->prepare(
					'SELECT id, slug, title, description, status, current_version, created_at, updated_at FROM %i WHERE status IN (%s, %s) ORDER BY created_at DESC',
					$this->table( 'assessments' ),
					'draft',
					'published'
				),
				ARRAY_A
			);
		}

		if ( 'draft' === $status_key ) {
			return $this->db()->get_results(
				$this->db()->prepare(
					'SELECT id, slug, title, description, status, current_version, created_at, updated_at FROM %i WHERE status = %s ORDER BY created_at DESC',
					$this->table( 'assessments' ),
					'draft'
				),
				ARRAY_A
			);
		}

		if ( 'archived' === $status_key ) {
			return $this->db()->get_results(
				$this->db()->prepare(
					'SELECT id, slug, title, description, status, current_version, created_at, updated_at FROM %i WHERE status = %s ORDER BY created_at DESC',
					$this->table( 'assessments' ),
					'archived'
				),
				ARRAY_A
			);
		}

		return $this->db()->get_results(
			$this->db()->prepare(
				'SELECT id, slug, title, description, status, current_version, created_at, updated_at FROM %i WHERE status = %s ORDER BY created_at DESC',
				$this->table( 'assessments' ),
				'published'
			),
			ARRAY_A
		);
	}

	/**
	 * Get a single assessment item.
	 *
	 * @param \WP_REST_Request $request Full data about the request.
	 * @return \WP_REST_Response|\WP_Error Response object or error.
	 */
	public function get_item( $request ) {
		$id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'id' ) ) ) );

		// Check cache first.
		$cache_key = "dap_assessment_{$id}";
		$cached    = $this->cache_get( $cache_key );
		if ( false !== $cached ) {
			return $this->success( $cached );
		}

		$row = $this->db()->get_row(
			$this->db()->prepare(
				'SELECT * FROM %i WHERE id = %d',
				$this->table( 'assessments' ),
				$id
			),
			ARRAY_A
		);

		if ( ! $row ) {
			return $this->not_found( __( 'Assessment not found.', 'digital-assessment-engine' ) );
		}

		// Decode settings JSON.
		$row['settings'] = json_decode( $row['settings'] ?? '{}', true );

		// Attach current version info.
		if ( ! empty( $row['current_version'] ) ) {
			$row['version'] = $this->db()->get_row(
				$this->db()->prepare(
					'SELECT id, version_number, changelog, published_at FROM %i WHERE id = %d',
					$this->table( 'assessment_versions' ),
					intval( $row['current_version'] )
				),
				ARRAY_A
			);
		}

		$row['weight_enabled'] = true; // Flag for frontend.

		$result = apply_filters( 'dap/api/assessment', $row );

		// Cache the result.
		$this->cache_set( $cache_key, $result, (int) get_option( 'dap_cache_ttl', 300 ) );

		return $this->success( $result );
	}

	/**
	 * Get by slug.
	 */
	public function get_item_by_slug( $request ) {
		$raw_slug = sanitize_title( (string) $request->get_param( 'slug' ) );
		$slug     = preg_replace( '/[^a-z0-9_\-]/', '', $raw_slug );
		$id = (int) $this->db()->get_var(
			$this->db()->prepare(
				'SELECT id FROM %i WHERE slug = %s',
				$this->table( 'assessments' ),
				$slug
			)
		);

		if ( ! $id ) {
			return $this->not_found();
		}

		$request->set_param( 'id', $id );
		return $this->get_item( $request );
	}

	/**
	 * Create a new assessment.
	 *
	 * @param \WP_REST_Request $request Full data about the request.
	 * @return \WP_REST_Response|\WP_Error Response object or error.
	 */
	public function create_item( $request ) {
		$title = sanitize_text_field( $request->get_param( 'title' ) );
		$slug  = $this->sanitize_slug( $request->get_param( 'slug' ) ?: $title );

		if ( empty( $title ) ) {
			return $this->error( 'missing_title', __( 'Title is required.', 'digital-assessment-engine' ) );
		}

		// Ensure unique slug.
		$slug = $this->unique_slug( $slug );

		$this->db()->insert(
			$this->table( 'assessments' ),
			[
				'slug'        => $slug,
				'title'       => $title,
				'description' => sanitize_textarea_field( $request->get_param( 'description' ) ?? '' ),
				'status'      => 'draft',
				'author_id'   => get_current_user_id(),
				'settings'    => wp_json_encode( $request->get_param( 'settings' ) ?: [] ),
			],
			[ '%s', '%s', '%s', '%s', '%d', '%s' ]
		);

		$assessment_id = $this->db()->insert_id;
		$this->cache_delete( 'dap_assessments_published' );
		$this->cache_delete( 'dap_assessments_draft' );

		do_action( 'dap/assessment/created', $assessment_id );

		return $this->success( [ 'id' => $assessment_id, 'slug' => $slug ], 201 );
	}

	/**
	 * Update an assessment.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_item( $request ) {
		$id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'id' ) ) ) );
		$row = $this->db()->get_row(
			$this->db()->prepare(
				'SELECT id FROM %i WHERE id = %d',
				$this->table( 'assessments' ),
				$id
			),
			ARRAY_A
		);

		if ( ! $row ) {
			return $this->not_found();
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
		if ( null !== $request->get_param( 'status' ) ) {
			$data['status'] = sanitize_text_field( $request->get_param( 'status' ) );
			$format[]       = '%s';
		}
		if ( null !== $request->get_param( 'settings' ) ) {
			$data['settings'] = wp_json_encode( $request->get_param( 'settings' ) );
			$format[]         = '%s';
		}

		if ( ! empty( $data ) ) {
			$this->db()->update( $this->table( 'assessments' ), $data, [ 'id' => $id ], $format, [ '%d' ] );
		}

		$this->bust_assessment_cache( $id );
		do_action( 'dap/assessment/updated', $id );

		return $this->success( [ 'updated' => true ] );
	}

	/**
	 * Get HubSpot config for an assessment.
	 * Returns merged config: assessment-specific or global fallback.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_hubspot_config( $request ) {
		$id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'id' ) ) ) );
		$row = $this->db()->get_row(
			$this->db()->prepare(
				'SELECT id, hubspot_enabled, hubspot_use_global, hubspot_portal_id, hubspot_form_id, hubspot_region FROM %i WHERE id = %d',
				$this->table( 'assessments' ),
				$id
			),
			ARRAY_A
		);

		if ( ! $row ) {
			return $this->not_found();
		}

		$use_global = (bool) $row['hubspot_use_global'];
		$enabled    = (bool) $row['hubspot_enabled'];

		// Prepare response config.
		$config = [
			'enabled'       => $enabled,
			'use_global'    => $use_global,
			'portal_id'     => $row['hubspot_portal_id'] ?? '',
			'form_id'       => $row['hubspot_form_id'] ?? '',
			'region'        => $row['hubspot_region'] ?? 'na1',
			'assessment_id' => $id,
		];

		// If using global, fetch and merge global config.
		if ( $use_global ) {
			$global_raw = get_option( 'dap_hubspot_config' );
			$global_config = [];
			
			if ( $global_raw ) {
				$global_config = json_decode( $global_raw, true ) ?: [];
			}

			// In global mode, the enabled status comes from global if not explicitly enabled here.
			// Actually, usually global enabled = true means all "global" assessments are enabled.
			$config['enabled'] = ! empty( $global_config['enabled'] );
			
			// Fallback to global values if individual values are empty.
			if ( empty( $config['portal_id'] ) ) {
				$config['portal_id'] = $global_config['portalId'] ?? '';
			}
			if ( empty( $config['form_id'] ) ) {
				$config['form_id'] = $global_config['formId'] ?? '';
			}
			if ( empty( $config['region'] ) || 'na1' === $config['region'] ) {
				$config['region'] = $global_config['region'] ?? 'na1';
			}
		}

		return $this->success( $config );
	}

	/**
	 * Update HubSpot config for an assessment.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_hubspot_config( $request ) {
		$id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'id' ) ) ) );
		$row = $this->db()->get_row(
			$this->db()->prepare(
				'SELECT id FROM %i WHERE id = %d',
				$this->table( 'assessments' ),
				$id
			),
			ARRAY_A
		);

		if ( ! $row ) {
			return $this->not_found( __( 'Assessment not found.', 'digital-assessment-engine' ) );
		}

		$data   = [];
		$format = [];

		if ( null !== $request->get_param( 'hubspot_enabled' ) ) {
			$data['hubspot_enabled'] = (int) $request->get_param( 'hubspot_enabled' );
			$format[] = '%d';
		}
		if ( null !== $request->get_param( 'hubspot_use_global' ) ) {
			$data['hubspot_use_global'] = (int) $request->get_param( 'hubspot_use_global' );
			$format[] = '%d';
		}
		if ( null !== $request->get_param( 'hubspot_portal_id' ) ) {
			$data['hubspot_portal_id'] = sanitize_text_field( $request->get_param( 'hubspot_portal_id' ) );
			$format[] = '%s';
		}
		if ( null !== $request->get_param( 'hubspot_form_id' ) ) {
			$data['hubspot_form_id'] = sanitize_text_field( $request->get_param( 'hubspot_form_id' ) );
			$format[] = '%s';
		}
		if ( null !== $request->get_param( 'hubspot_region' ) ) {
			$data['hubspot_region'] = sanitize_text_field( $request->get_param( 'hubspot_region' ) );
			$format[] = '%s';
		}

		if ( ! empty( $data ) ) {
			$result = $this->db()->update( $this->table( 'assessments' ), $data, [ 'id' => $id ], $format, [ '%d' ] );
			if ( false === $result ) {
				return $this->error( 'db_error', __( 'Failed to update database.', 'digital-assessment-engine' ), 500 );
			}
		}

		$this->bust_assessment_cache( $id );
		return $this->success( [ 'updated' => true, 'id' => $id ] );
	}

	/**
	 * Delete an assessment.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_item( $request ) {
		$id = $this->sanitize_id( $request->get_param( 'id' ) );
		$this->db()->update(
			$this->table( 'assessments' ),
			[ 'status' => 'archived' ],
			[ 'id'     => $id ],
			[ '%s' ],
			[ '%d' ]
		);
		$this->bust_assessment_cache( $id );
		do_action( 'dap/assessment/deleted', $id );
		return $this->success( [ 'deleted' => true ] );
	}

	/**
	 * Bulk delete assessments.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function bulk_delete( $request ) {
		$ids = $request->get_param( 'ids' );
		if ( ! is_array( $ids ) || empty( $ids ) ) {
			return $this->error( 'invalid_ids', __( 'Invalid or empty IDs array.', 'digital-assessment-engine' ), 400 );
		}

		// Wrap in transaction for atomicity
		$this->db()->query( $this->db()->prepare( 'START TRANSACTION /* %d */', 1 ) );
		
		try {
			$deleted = 0;
			foreach ( $ids as $id ) {
				$id = intval( max( 0, (int) $this->sanitize_id( $id ) ) );
				if ( $id > 0 ) {
					$this->db()->update(
						$this->table( 'assessments' ),
						[ 'status' => 'archived' ],
						[ 'id'     => $id ],
						[ '%s' ],
						[ '%d' ]
					);
					$this->bust_assessment_cache( $id );
					$deleted++;
				}
			}
			
			$this->db()->query( $this->db()->prepare( 'COMMIT /* %d */', 1 ) );
			return $this->success( [ 'deleted' => $deleted ] );
		} catch ( \Exception $e ) {
			$this->db()->query( $this->db()->prepare( 'ROLLBACK /* %d */', 1 ) );
			return $this->error( 'bulk_delete_failed', __( 'Failed to delete assessments. Please try again.', 'digital-assessment-engine' ), 500 );
		}
	}

	public function duplicate_item( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'id' ) ) ) );

		$src = $this->db()->get_row(
			$this->db()->prepare(
				'SELECT * FROM %i WHERE id = %d',
				$this->table( 'assessments' ),
				$id
			),
			ARRAY_A
		);

		if ( ! $src ) {
			return $this->not_found();
		}

		$this->db()->query( $this->db()->prepare( 'START TRANSACTION /* %d */', 1 ) );

		try {
			$new_slug = $this->unique_slug( $src['slug'] . '-copy' );
			$this->db()->insert(
				$this->table( 'assessments' ),
				[
					'slug'        => $new_slug,
					'title'       => $src['title'] . ' (Copy)',
					'description' => $src['description'],
					'status'      => 'draft',
					'author_id'   => get_current_user_id(),
					'settings'    => $src['settings'],
				],
				[ '%s', '%s', '%s', '%s', '%d', '%s' ]
			);

			$new_id = $this->db()->insert_id;

			// 1. Copy Blocks
			$blocks = $this->db()->get_results(
				$this->db()->prepare(
					'SELECT * FROM %i WHERE assessment_id = %d ORDER BY sort_order',
					$this->table( 'blocks' ),
					$id
				),
				ARRAY_A
			);
			$block_id_map = [];
			foreach ( $blocks as $block ) {
				$this->db()->insert(
					$this->table( 'blocks' ),
					[
						'assessment_id' => $new_id,
						'version_id'    => 0,
						'title'         => $block['title'],
						'description'   => $block['description'],
						'icon'          => $block['icon'],
						'color'         => $block['color'],
						'weight'        => $block['weight'],
						'sort_order'    => $block['sort_order'],
						'settings'      => $block['settings'],
					],
					[ '%d', '%d', '%s', '%s', '%s', '%s', '%f', '%d', '%s' ]
				);
				$block_id_map[ $block['id'] ] = $this->db()->insert_id;
			}

			// 2. Copy Questions & Options
			$questions = $this->db()->get_results(
				$this->db()->prepare(
					'SELECT * FROM %i WHERE assessment_id = %d ORDER BY sort_order',
					$this->table( 'questions' ),
					$id
				),
				ARRAY_A
			);
			foreach ( $questions as $q ) {
				$old_q_id     = intval( max( 0, (int) $q['id'] ) );
				$new_block_id = $block_id_map[ $q['block_id'] ] ?? 0;

				$this->db()->insert(
					$this->table( 'questions' ),
					[
						'block_id'      => $new_block_id,
						'assessment_id' => $new_id,
						'version_id'    => 0,
						'question_key'  => $q['question_key'],
						'question_text' => $q['question_text'],
						'helper_text'   => $q['helper_text'],
						'question_type' => $q['question_type'],
						'is_required'   => $q['is_required'],
						'weight'        => $q['weight'],
						'sort_order'    => $q['sort_order'],
						'settings'      => $q['settings'],
					],
					[ '%d', '%d', '%d', '%s', '%s', '%s', '%s', '%d', '%f', '%d', '%s' ]
				);
				$new_q_id = $this->db()->insert_id;

				// Copy options for this question
				$options = $this->db()->get_results(
					$this->db()->prepare(
						'SELECT * FROM %i WHERE question_id = %d ORDER BY sort_order',
						$this->table( 'options' ),
						$old_q_id
					),
					ARRAY_A
				);
				foreach ( $options as $opt ) {
					$this->db()->insert(
						$this->table( 'options' ),
						[
							'question_id' => $new_q_id,
							'option_text' => $opt['option_text'],
							'option_value'=> $opt['option_value'],
							'score_value' => $opt['score_value'],
							'weight'      => $opt['weight'],
							'sort_order'  => $opt['sort_order'],
						],
						[ '%d', '%s', '%s', '%f', '%f', '%d' ]
					);
				}
			}

			$this->db()->query( $this->db()->prepare( 'COMMIT /* %d */', 1 ) );
			do_action( 'dap/assessment/duplicated', $new_id, $id );
			return $this->success( [ 'id' => $new_id, 'slug' => $new_slug ], 201 );

		} catch ( \Exception $e ) {
			$this->db()->query( $this->db()->prepare( 'ROLLBACK /* %d */', 1 ) );
			return $this->error( 'duplication_failed', __( 'Could not duplicate assessment.', 'digital-assessment-engine' ), 500 );
		}
	}

	public function publish_version( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$id         = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'id' ) ) ) );
		$version_id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'version_id' ) ?? 0 ) ) );

		// Create new version.
		$last_ver = (int) $this->db()->get_var(
			$this->db()->prepare(
				'SELECT MAX(version_number) FROM %i WHERE assessment_id = %d',
				$this->table( 'assessment_versions' ),
				$id
			)
		);

		// Build frozen snapshot.
		$snapshot = $this->build_snapshot( $id, $version_id );

		$this->db()->insert(
			$this->table( 'assessment_versions' ),
			[
				'assessment_id'  => $id,
				'version_number' => $last_ver + 1,
				'is_published'   => 1,
				'published_at'   => current_time( 'mysql' ),
				'created_by'     => get_current_user_id(),
				'snapshot'       => wp_json_encode( $snapshot ),
				'changelog'      => sanitize_text_field( $request->get_param( 'changelog' ) ?? '' ),
			],
			[ '%d', '%d', '%d', '%s', '%d', '%s', '%s' ]
		);

		$new_version_id = $this->db()->insert_id;

		// Mark old versions as unpublished.
		$this->db()->query(
			$this->db()->prepare(
				'UPDATE %i SET is_published = 0 WHERE assessment_id = %d AND id != %d',
				$this->table( 'assessment_versions' ),
				$id,
				$new_version_id
			)
		);

		// Point assessment to latest version.
		$this->db()->update(
			$this->table( 'assessments' ),
			[ 'current_version' => $new_version_id, 'status' => 'published' ],
			[ 'id' => $id ],
			[ '%d', '%s' ],
			[ '%d' ]
		);

		$this->bust_assessment_cache( $id );
		do_action( 'dap/assessment/published', $id, $new_version_id );
		return $this->success( [ 'version_id' => $new_version_id ] );
	}

	// ─── Helpers ──────────────────────────────────────────────────────────

	private function unique_slug( string $slug ): string {
		$original = sanitize_title( $slug );
		$slug     = $original;
		$suffix   = 1;
		while ( $this->db()->get_var( $this->db()->prepare( 'SELECT id FROM %i WHERE slug = %s', $this->table( 'assessments' ), $slug ) ) ) {
			$slug = "{$original}-{$suffix}";
			$suffix++;
		}
		return $slug;
	}

	private function build_snapshot( int $assessment_id, int $version_id ): array {
		$assessment_id = intval( max( 0, (int) $assessment_id ) );

		// Collect all blocks/questions/options for this assessment.
		$blocks    = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT * FROM %i WHERE assessment_id = %d ORDER BY sort_order',
				$this->table( 'blocks' ),
				$assessment_id
			),
			ARRAY_A
		);
		$questions = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT * FROM %i WHERE assessment_id = %d ORDER BY sort_order',
				$this->table( 'questions' ),
				$assessment_id
			),
			ARRAY_A
		);
		$options   = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT o.* FROM %i o JOIN %i q ON o.question_id = q.id WHERE q.assessment_id = %d ORDER BY o.sort_order',
				$this->table( 'options' ),
				$this->table( 'questions' ),
				$assessment_id
			),
			ARRAY_A
		);

		// Attach options to questions.
		$opts_by_q = [];
		foreach ( $options as $opt ) {
			$opts_by_q[ $opt['question_id'] ][] = $opt;
		}
		foreach ( $questions as &$q ) {
			$q['options'] = $opts_by_q[ $q['id'] ] ?? [];
		}

		return compact( 'blocks', 'questions' );
	}

	private function bust_assessment_cache( int $id ): void {
		$this->cache_delete( "dap_assessments_published" );
		$this->cache_delete( "dap_assessments_draft" );
		$this->cache_delete( "dap_assessment_{$id}" );
	}

	/**
	 * Get the JSON schema for assessment items.
	 *
	 * @return array Item schema compatible with JSON Schema draft-04.
	 */
	public function get_item_schema(): array {
		return [
			'$schema'    => 'http://json-schema.org/draft-04/schema#',
			'title'      => 'assessment',
			'type'       => 'object',
			'properties' => [
				'id'              => [
					'description' => __( 'Unique identifier for the assessment.', 'digital-assessment-engine' ),
					'type'        => 'integer',
					'context'     => [ 'view', 'edit', 'embed' ],
					'readOnly'    => true,
				],
				'slug'            => [
					'description' => __( 'URL-friendly identifier for the assessment.', 'digital-assessment-engine' ),
					'type'        => 'string',
					'context'     => [ 'view', 'edit', 'embed' ],
					'required'    => true,
				],
				'title'           => [
					'description' => __( 'The title of the assessment.', 'digital-assessment-engine' ),
					'type'        => 'string',
					'context'     => [ 'view', 'edit', 'embed' ],
					'required'    => true,
				],
				'description'     => [
					'description' => __( 'Description or instructions for the assessment.', 'digital-assessment-engine' ),
					'type'        => 'string',
					'context'     => [ 'view', 'edit' ],
				],
				'status'          => [
					'description' => __( 'Current status of the assessment.', 'digital-assessment-engine' ),
					'type'        => 'string',
					'enum'        => [ 'draft', 'published', 'archived' ],
					'context'     => [ 'view', 'edit' ],
					'default'     => 'draft',
				],
				'current_version' => [
					'description' => __( 'ID of the currently published version.', 'digital-assessment-engine' ),
					'type'        => 'integer',
					'context'     => [ 'view', 'edit' ],
					'readOnly'    => true,
				],
				'author_id'       => [
					'description' => __( 'ID of the user who created the assessment.', 'digital-assessment-engine' ),
					'type'        => 'integer',
					'context'     => [ 'view', 'edit' ],
					'readOnly'    => true,
				],
				'settings'        => [
					'description' => __( 'JSON configuration object for the assessment.', 'digital-assessment-engine' ),
					'type'        => 'object',
					'context'     => [ 'view', 'edit' ],
				],
				'created_at'      => [
					'description' => __( 'Creation timestamp.', 'digital-assessment-engine' ),
					'type'        => 'string',
					'format'      => 'date-time',
					'context'     => [ 'view', 'edit' ],
					'readOnly'    => true,
				],
				'updated_at'      => [
					'description' => __( 'Last modification timestamp.', 'digital-assessment-engine' ),
					'type'        => 'string',
					'format'      => 'date-time',
					'context'     => [ 'view', 'edit' ],
					'readOnly'    => true,
				],
			],
		];
	}

	/**
	 * Get the query params for collections.
	 *
	 * @return array Collection parameters.
	 */
	public function get_collection_params(): array {
		return [
			'status' => [
				'description'       => __( 'Limit results to assessments with a specific status.', 'digital-assessment-engine' ),
				'type'              => 'string',
				'default'           => 'published',
				'enum'              => [ 'draft', 'published', 'archived' ],
				'sanitize_callback' => 'sanitize_text_field',
			],
			'page'   => [
				'description' => __( 'Current page of the collection.', 'digital-assessment-engine' ),
				'type'        => 'integer',
				'default'     => 1,
				'minimum'     => 1,
			],
			'per_page' => [
				'description' => __( 'Maximum number of items to be returned.', 'digital-assessment-engine' ),
				'type'        => 'integer',
				'default'     => 10,
				'minimum'     => 1,
				'maximum'     => 100,
			],
		];
	}

	/**
	 * Get create item args schema.
	 *
	 * @return array Args schema for creating items.
	 */
	private function create_item_schema(): array {
		return [
			'title'       => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
			'slug'        => [ 'required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_title' ],
			'description' => [ 'required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_textarea_field' ],
			'settings'    => [ 'required' => false, 'type' => 'object' ],
		];
	}
}

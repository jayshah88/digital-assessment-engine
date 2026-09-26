<?php
/**
 * Leads Controller — POST /lead, GET /leads, GET /leads/export
 *
 * @package DigitalAssessmentPro\Api
 */

namespace DigitalAssessmentPro\Api;

defined( 'ABSPATH' ) || exit;

class LeadsController extends BaseController {

	protected $rest_base = 'lead';

	public function register_routes(): void {
		register_rest_route( $this->namespace, "/{$this->rest_base}", [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'capture_lead' ],
			'permission_callback' => '__return_true',
		] );

		register_rest_route( $this->namespace, '/leads', [
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_items' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_view_leads' ),
		] );

		register_rest_route( $this->namespace, '/leads/export', [
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => [ $this, 'export_leads' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_export_leads' ),
		] );

		register_rest_route( $this->namespace, '/leads/(?P<id>[\d]+)', [
			'methods'             => \WP_REST_Server::DELETABLE,
			'callback'            => [ $this, 'delete_item' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_delete_leads' ),
		] );

		register_rest_route( $this->namespace, '/leads/bulk-delete', [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'bulk_delete' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_delete_leads' ),
		] );

		register_rest_route( $this->namespace, '/leads/(?P<id>[\d]+)/submissions', [
			'methods'             => \WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_lead_submissions' ],
			'permission_callback' => \DigitalAssessmentPro\Access\RoleManager::rest_permission( 'dap_view_leads' ),
		] );
	}

	/**
	 * Capture lead.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function capture_lead( $request ) {
		// CSRF nonce verification.
		$nonce_check = $this->verify_public_nonce( $request );
		if ( is_wp_error( $nonce_check ) ) {
			return $nonce_check;
		}

		$lead_rate_limit = (int) apply_filters( 'dap/lead_capture_rate_limit', 30, $request );
		$rate_check      = $this->check_rate_limit( $request, 'lead_capture', $lead_rate_limit );
		if ( is_wp_error( $rate_check ) ) {
			return $rate_check;
		}

		$email         = sanitize_email( $request->get_param( 'email' ) ?? '' );
		$submission_id = $this->sanitize_id( $request->get_param( 'submission_id' ) ?? 0 );

		$first_name = sanitize_text_field( $request->get_param( 'first_name' ) ?? '' );
		$last_name  = sanitize_text_field( $request->get_param( 'last_name' ) ?? '' );
		$company    = sanitize_text_field( $request->get_param( 'company' ) ?? '' );
		$job_title  = sanitize_text_field( $request->get_param( 'job_title' ) ?? '' );
		$country    = sanitize_text_field( $request->get_param( 'country' ) ?? '' );

		// Enforce Required Fields
		if ( empty( $first_name ) ) {
			return $this->error( 'missing_fields', __( 'First name is required.', 'digital-assessment-engine' ) );
		}

		$require_full_identity = (bool) get_option( 'dap_require_company_fields', false );
		$require_full_identity = (bool) apply_filters( 'dap/require_full_identity_fields', $require_full_identity, $request );

		if ( $require_full_identity && ( empty( $last_name ) || empty( $company ) || empty( $job_title ) || empty( $country ) ) ) {
			return $this->error( 'missing_fields', __( 'Please provide all required details (Name, Company, Job Title, Country).', 'digital-assessment-engine' ) );
		}

		if ( ! is_email( $email ) ) {
			return $this->error( 'invalid_email', __( 'A valid email address is required.', 'digital-assessment-engine' ) );
		}

		// Work Email Sieve (Configurable)
		$block_personal = (bool) get_option( 'dap_block_personal_emails', false );
		$block_personal = (bool) apply_filters( 'dap/block_personal_emails', $block_personal, $email );

		if ( $block_personal ) {
			$personal_domains = apply_filters( 'dap/personal_email_domains', [
				'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
				'aol.com', 'icloud.com', 'protonmail.com', 'me.com', 'msn.com',
			] );
			$domain = substr( strrchr( $email, '@' ), 1 );
			if ( in_array( strtolower( (string) $domain ), $personal_domains, true ) ) {
				return $this->error( 'personal_email', __( 'Please use your work email address.', 'digital-assessment-engine' ) );
			}
		}

		$gdpr_consent = (bool) $request->get_param( 'gdpr_consent' );
		if ( ! $gdpr_consent ) {
			return $this->error( 'consent_required', __( 'Please accept the privacy terms to continue.', 'digital-assessment-engine' ) );
		}

		// Upsert lead.
		$existing = $this->db()->get_row(
			$this->db()->prepare(
				'SELECT id FROM %i WHERE email = %s',
				$this->table( 'leads' ),
				$email
			),
			ARRAY_A
		);

		$lead_data = [
			'email'      => $email,
			'first_name' => sanitize_text_field( $request->get_param( 'first_name' ) ?? '' ),
			'last_name'  => sanitize_text_field( $request->get_param( 'last_name' ) ?? '' ),
			'company'    => sanitize_text_field( $request->get_param( 'company' ) ?? '' ),
			'phone'      => sanitize_text_field( $request->get_param( 'phone' ) ?? '' ),
			'metadata'   => wp_json_encode( [
				'job_title'      => sanitize_text_field( $request->get_param( 'job_title' ) ?? '' ),
				'country'        => sanitize_text_field( $request->get_param( 'country' ) ?? '' ),
				'programme_type' => sanitize_text_field( $request->get_param( 'programme_type' ) ?? 'Other' ),
			] ),
			'gdpr_consent' => (int) $gdpr_consent,
			'consent_at' => $gdpr_consent ? current_time( 'mysql' ) : null,
		];

		// Attach score from submission.
		if ( $submission_id > 0 ) {
			$sub = $this->db()->get_row(
				$this->db()->prepare(
					'SELECT normalized_score, score_level, assessment_id FROM %i WHERE id = %d',
					$this->table( 'submissions' ),
					$submission_id
				),
				ARRAY_A
			);
			if ( $sub ) {
				$lead_data['normalized_score'] = $sub['normalized_score'];
				$lead_data['score_level']      = $sub['score_level'];
				$lead_data['source']           = 'assessment_' . $sub['assessment_id'];
			}
		}

		$lead_format = [ '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%s' ];

		if ( $existing ) {
			$lead_id = $existing['id'];
			$this->db()->update( $this->table( 'leads' ), $lead_data, [ 'id' => $lead_id ], $lead_format, [ '%d' ] );
		} else {
			$this->db()->insert( $this->table( 'leads' ), $lead_data, $lead_format );
			$lead_id = $this->db()->insert_id;
		}

		// Link submission → lead.
		if ( $submission_id && $lead_id ) {
			$this->db()->update(
				$this->table( 'submissions' ),
				[ 'lead_id' => $lead_id ],
				[ 'id' => $submission_id ],
				[ '%d' ],
				[ '%d' ]
			);
		}

		// Invalidate analytics cache for real-time overview updates.
		delete_transient( 'dap_analytics_overview' );
		$this->cache_delete( 'dap_analytics_overview' );

		// Fire email system.
		do_action( 'dap/lead/captured', $lead_id, $submission_id, $lead_data );

		return $this->success( [ 'lead_id' => $lead_id, 'unlocked' => true ] );
	}

	/**
	 * Get items (List leads).
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_items( $request ) {
		$page      = intval( max( 1, (int) ( $request->get_param( 'page' ) ?? 1 ) ) );
		$per_page  = intval( min( 100, max( 10, (int) ( $request->get_param( 'per_page' ) ?? 25 ) ) ) );
		$offset    = intval( max( 0, ( $page - 1 ) * $per_page ) );
		$raw_level = strtolower( trim( (string) ( $request->get_param( 'level' ) ?? '' ) ) );
		$level     = match ( $raw_level ) {
			'red'          => 'red',
			'amber'        => 'amber',
			'gold'         => 'gold',
			'green'        => 'green',
			'low'          => 'low',
			'medium'       => 'medium',
			'high'         => 'high',
			'critical'     => 'critical',
			'beginner'     => 'beginner',
			'intermediate' => 'intermediate',
			'advanced'     => 'advanced',
			'expert'       => 'expert',
			default        => '',
		};
		if ( '' !== $level ) {
			$total = (int) $this->db()->get_var(
				$this->db()->prepare(
					'SELECT COUNT(*) FROM %i WHERE score_level = %s',
					$this->table( 'leads' ),
					$level
				)
			);

			$rows = $this->db()->get_results(
				$this->db()->prepare(
					'SELECT l.id, l.email, l.first_name, l.last_name, l.company, l.score_level, l.normalized_score, l.source, l.created_at, l.metadata,
					(SELECT COUNT(*) FROM %i s WHERE s.lead_id = l.id) AS submissions_count
					FROM %i l WHERE l.score_level = %s ORDER BY l.created_at DESC LIMIT %d OFFSET %d',
					$this->table( 'submissions' ),
					$this->table( 'leads' ),
					$level,
					$per_page,
					$offset
				),
				ARRAY_A
			);
		} else {
			$total = (int) $this->db()->get_var(
				$this->db()->prepare(
					'SELECT COUNT(*) FROM %i WHERE 1 = %d',
					$this->table( 'leads' ),
					1
				)
			);

			$rows = $this->db()->get_results(
				$this->db()->prepare(
					'SELECT l.id, l.email, l.first_name, l.last_name, l.company, l.score_level, l.normalized_score, l.source, l.created_at, l.metadata,
					(SELECT COUNT(*) FROM %i s WHERE s.lead_id = l.id) AS submissions_count
					FROM %i l ORDER BY l.created_at DESC LIMIT %d OFFSET %d',
					$this->table( 'submissions' ),
					$this->table( 'leads' ),
					$per_page,
					$offset
				),
				ARRAY_A
			);
		}

		return $this->success( $rows, 200, [ 'total' => $total ] );
	}

	/**
	 * Get submissions for a specific lead.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function get_lead_submissions( $request ): \WP_REST_Response {
		$id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'id' ) ) ) );
		$submissions = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT id, uuid, normalized_score, score_level, status, completed_at 
				FROM %i 
				WHERE lead_id = %d 
				ORDER BY id DESC',
				$this->table( 'submissions' ),
				$id
			),
			ARRAY_A
		);

		return $this->success( $submissions ?: [] );
	}

	/**
	 * Export leads.
	 *
	 * @param \WP_REST_Request $request Request object.
	 */
	public function export_leads( $request ) {
		// Verify nonce for security.
		$nonce = $request->get_param( '_wpnonce' ) ?: $request->get_header( 'x_wp_nonce' );
		if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new \WP_Error(
				'rest_forbidden',
				__( 'Security verification failed or expired. Please refresh the page.', 'digital-assessment-engine' ),
				[ 'status' => 403 ]
			);
		}
		
		$rows = $this->db()->get_results(
			$this->db()->prepare(
				'SELECT 
					l.email, l.first_name, l.last_name, l.company, l.phone,
					(SELECT COUNT(*) FROM %i s WHERE s.lead_id = l.id) AS total_submissions,
					l.score_level AS latest_level, l.normalized_score AS latest_score, l.source AS latest_source,
					l.gdpr_consent, l.created_at
				FROM %i l 
				ORDER BY l.created_at DESC',
				$this->table( 'submissions' ),
				$this->table( 'leads' )
			),
			ARRAY_A
		);

		// Audit log — record who exported and how many records.
		$export_count = count( $rows );
		$user_id      = get_current_user_id();
		do_action( 'dap/leads/exported', $user_id, $export_count );
		if ( function_exists( 'error_log' ) ) {
			error_log( sprintf(
				'[DAP Security] Lead export by user #%d (%s) — %d records at %s',
				$user_id,
				wp_get_current_user()->user_login,
				$export_count,
				gmdate( 'Y-m-d\TH:i:s\Z' )
			) );
		}

		header( 'Content-Type: text/csv; charset=UTF-8' );
		header( 'Content-Disposition: attachment; filename="dap-leads-' . gmdate( 'Y-m-d' ) . '.csv"' );
		header( 'Cache-Control: no-store, no-cache, must-revalidate' );
		header( 'Pragma: no-cache' );
		
		$out = fopen( 'php://output', 'w' );
		
		if ( ! empty( $rows ) ) {
			// Write Headers.
			fputcsv( $out, array_keys( $rows[0] ) );
			
			// Write Rows with Formula Injection Protection.
			foreach ( $rows as $row ) {
				$escaped_row = array_map( function( $value ) {
					if ( null === $value || '' === $value ) {
						return '';
					}
					// Escape if string starts with formula indicators (+, -, =, @, \t, \r, \n, |, %).
					if ( is_string( $value ) && '' !== $value && in_array( $value[0], [ '=', '+', '-', '@', "\t", "\r", "\n", '|', '%' ], true ) ) {
						return "'" . $value;
					}
					return $value;
				}, $row );
				
				fputcsv( $out, $escaped_row );
			}
		}
		
		fclose( $out );
		wp_die(); // Use wp_die() instead of exit to allow shutdown hooks.
	}

	/**
	 * Delete item.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_item( $request ) {
		$id = intval( max( 0, (int) $this->sanitize_id( $request->get_param( 'id' ) ) ) );

		// Maintain referential integrity by unlinking from submissions
		$this->db()->update( $this->table( 'submissions' ), [ 'lead_id' => null ], [ 'lead_id' => $id ] );

		$this->db()->delete( $this->table( 'leads' ), [ 'id' => $id ], [ '%d' ] );

		$this->cache_delete( 'dap_analytics_overview' );
		delete_transient( 'dap_analytics_overview' );

		return $this->success( [ 'deleted' => true ] );
	}

	/**
	 * Bulk delete leads.
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
					// Unlink from submissions
					$this->db()->update( $this->table( 'submissions' ), [ 'lead_id' => null ], [ 'lead_id' => $id ] );
					$this->db()->delete( $this->table( 'leads' ), [ 'id' => $id ], [ '%d' ] );
					$deleted++;
				}
			}
			
			$this->db()->query( $this->db()->prepare( 'COMMIT /* %d */', 1 ) );

			$this->cache_delete( 'dap_analytics_overview' );
			delete_transient( 'dap_analytics_overview' );

			return $this->success( [ 'deleted' => $deleted ] );
		} catch ( \Exception $e ) {
			$this->db()->query( $this->db()->prepare( 'ROLLBACK /* %d */', 1 ) );
			return $this->error( 'bulk_delete_failed', __( 'Failed to delete leads. Please try again.', 'digital-assessment-engine' ), 500 );
		}
	}
}

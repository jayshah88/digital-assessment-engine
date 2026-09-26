<?php
/**
 * Privacy & GDPR Compliance Handler
 *
 * Implements WordPress Privacy Tools API:
 * - Data Exporter (GDPR Article 15/20)
 * - Data Eraser (GDPR Article 17 "Right to be forgotten")
 * - Privacy Policy Content Suggestions
 *
 * @package DigitalAssessmentPro\Privacy
 */

namespace DigitalAssessmentPro\Privacy;

defined( 'ABSPATH' ) || exit;

class Privacy {

	/**
	 * Register hooks.
	 */
	public static function init(): void {
		add_filter( 'wp_privacy_personal_data_exporters', [ __CLASS__, 'register_exporter' ] );
		add_filter( 'wp_privacy_personal_data_erasers',   [ __CLASS__, 'register_eraser' ] );
		add_action( 'admin_init',                         [ __CLASS__, 'add_privacy_policy_content' ] );
	}

	/**
	 * Register personal data exporter.
	 *
	 * @param array $exporters Existing exporters.
	 * @return array
	 */
	public static function register_exporter( array $exporters ): array {
		$exporters['digital-assessment-engine'] = [
			'exporter_friendly_name' => __( 'Digital Assessment Pro Lead & Quiz Data', 'digital-assessment-engine' ),
			'callback'               => [ __CLASS__, 'export_personal_data' ],
		];
		return $exporters;
	}

	/**
	 * Export personal data for an email address.
	 *
	 * @param string $email_address User email.
	 * @param int    $page          Pagination page.
	 * @return array
	 */
	public static function export_personal_data( string $email_address, int $page = 1 ): array {
		global $wpdb;

		$leads_table       = $wpdb->prefix . 'dap_leads';
		$submissions_table = $wpdb->prefix . 'dap_submissions';

		$data_to_export = [];

		$lead = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$leads_table} WHERE email = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$email_address
			),
			ARRAY_A
		);

		if ( $lead ) {
			$metadata = json_decode( $lead['metadata'] ?? '{}', true ) ?: [];

			$lead_item_data = [
				[
					'name'  => __( 'Email', 'digital-assessment-engine' ),
					'value' => $lead['email'],
				],
				[
					'name'  => __( 'First Name', 'digital-assessment-engine' ),
					'value' => $lead['first_name'],
				],
				[
					'name'  => __( 'Last Name', 'digital-assessment-engine' ),
					'value' => $lead['last_name'],
				],
				[
					'name'  => __( 'Company', 'digital-assessment-engine' ),
					'value' => $lead['company'],
				],
				[
					'name'  => __( 'Phone', 'digital-assessment-engine' ),
					'value' => $lead['phone'],
				],
				[
					'name'  => __( 'Job Title', 'digital-assessment-engine' ),
					'value' => $metadata['job_title'] ?? '',
				],
				[
					'name'  => __( 'Country', 'digital-assessment-engine' ),
					'value' => $metadata['country'] ?? '',
				],
				[
					'name'  => __( 'Normalized Score', 'digital-assessment-engine' ),
					'value' => $lead['normalized_score'] . '%',
				],
				[
					'name'  => __( 'Score Level', 'digital-assessment-engine' ),
					'value' => $lead['score_level'],
				],
				[
					'name'  => __( 'GDPR Consent Given', 'digital-assessment-engine' ),
					'value' => $lead['gdpr_consent'] ? __( 'Yes', 'digital-assessment-engine' ) : __( 'No', 'digital-assessment-engine' ),
				],
				[
					'name'  => __( 'Consent Date', 'digital-assessment-engine' ),
					'value' => $lead['consent_at'] ?: $lead['created_at'],
				],
			];

			$data_to_export[] = [
				'group_id'    => 'dap_lead_data',
				'group_label' => __( 'Digital Assessment Pro — Lead Profile', 'digital-assessment-engine' ),
				'item_id'     => "dap-lead-{$lead['id']}",
				'data'        => $lead_item_data,
			];

			// Fetch linked submissions
			$submissions = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT id, uuid, total_score, normalized_score, score_level, status, started_at, completed_at FROM {$submissions_table} WHERE lead_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$lead['id']
				),
				ARRAY_A
			);

			if ( ! empty( $submissions ) ) {
				foreach ( $submissions as $sub ) {
					$data_to_export[] = [
						'group_id'    => 'dap_submissions_data',
						'group_label' => __( 'Digital Assessment Pro — Submissions', 'digital-assessment-engine' ),
						'item_id'     => "dap-submission-{$sub['id']}",
						'data'        => [
							[
								'name'  => __( 'Submission Identifier', 'digital-assessment-engine' ),
								'value' => $sub['uuid'],
							],
							[
								'name'  => __( 'Total Score', 'digital-assessment-engine' ),
								'value' => $sub['total_score'],
							],
							[
								'name'  => __( 'Normalized Score', 'digital-assessment-engine' ),
								'value' => $sub['normalized_score'] . '%',
							],
							[
								'name'  => __( 'Score Level', 'digital-assessment-engine' ),
								'value' => $sub['score_level'],
							],
							[
								'name'  => __( 'Status', 'digital-assessment-engine' ),
								'value' => $sub['status'],
							],
							[
								'name'  => __( 'Completed Date', 'digital-assessment-engine' ),
								'value' => $sub['completed_at'] ?: $sub['started_at'],
							],
						],
					];
				}
			}
		}

		return [
			'data' => $data_to_export,
			'done' => true,
		];
	}

	/**
	 * Register personal data eraser.
	 *
	 * @param array $erasers Existing erasers.
	 * @return array
	 */
	public static function register_eraser( array $erasers ): array {
		$erasers['digital-assessment-engine'] = [
			'eraser_friendly_name' => __( 'Digital Assessment Pro Lead & Quiz Data', 'digital-assessment-engine' ),
			'callback'             => [ __CLASS__, 'erase_personal_data' ],
		];
		return $erasers;
	}

	/**
	 * Erase personal data for an email address.
	 *
	 * @param string $email_address User email.
	 * @param int    $page          Pagination page.
	 * @return array
	 */
	public static function erase_personal_data( string $email_address, int $page = 1 ): array {
		global $wpdb;

		$leads_table       = $wpdb->prefix . 'dap_leads';
		$submissions_table = $wpdb->prefix . 'dap_submissions';

		$items_removed  = 0;
		$items_retained = 0;
		$messages       = [];

		$lead = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT id FROM {$leads_table} WHERE email = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$email_address
			)
		);

		if ( $lead ) {
			// Disassociate and anonymize linked submissions
			$wpdb->update(
				$submissions_table,
				[
					'lead_id'    => null,
					'ip_address' => '0.0.0.0',
					'user_agent' => 'Anonymized',
				],
				[ 'lead_id' => $lead->id ],
				[ '%s', '%s', '%s' ],
				[ '%d' ]
			);

			// Delete the lead record
			$deleted = $wpdb->delete(
				$leads_table,
				[ 'id' => $lead->id ],
				[ '%d' ]
			);

			if ( $deleted ) {
				$items_removed++;
				$messages[] = sprintf(
					/* translators: %s: email address */
					__( 'Personal assessment data for %s has been deleted and submissions anonymized.', 'digital-assessment-engine' ),
					$email_address
				);
			} else {
				$items_retained++;
				$messages[] = sprintf(
					/* translators: %s: email address */
					__( 'Failed to delete personal assessment data for %s.', 'digital-assessment-engine' ),
					$email_address
				);
			}
		}

		return [
			'items_removed'  => $items_removed,
			'items_retained' => $items_retained,
			'messages'       => $messages,
			'done'           => true,
		];
	}

	/**
	 * Add suggested privacy policy content.
	 */
	public static function add_privacy_policy_content(): void {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}

		$content = sprintf(
			'<h2>%s</h2>' .
			'<p>%s</p>' .
			'<ul>' .
			'<li>%s</li>' .
			'<li>%s</li>' .
			'<li>%s</li>' .
			'</ul>' .
			'<p>%s</p>',
			esc_html__( 'Interactive Assessments & Quizzes', 'digital-assessment-engine' ),
			esc_html__( 'When you participate in an interactive assessment on this website, we collect information you provide in the questionnaire along with any optional contact details you submit to receive your score report. Specifically, this may include:', 'digital-assessment-engine' ),
			esc_html__( 'Your quiz responses, score metrics, and completion timestamps.', 'digital-assessment-engine' ),
			esc_html__( 'Contact details such as name, email address, company, and job title when requesting a report.', 'digital-assessment-engine' ),
			esc_html__( 'Technical diagnostics such as an anonymized IP address and browser user-agent to prevent duplicate submissions.', 'digital-assessment-engine' ),
			esc_html__( 'This data is used solely to generate your diagnostic report and provide personalized recommendations. You may request an export or erasure of your personal assessment data at any time via the WordPress Privacy tools.', 'digital-assessment-engine' )
		);

		wp_add_privacy_policy_content(
			__( 'Digital Assessment Pro', 'digital-assessment-engine' ),
			wp_kses_post( wpautop( $content, false ) )
		);
	}
}

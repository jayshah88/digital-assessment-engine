<?php
/**
 * Analytics Tracker — records events to dap_analytics_events table.
 *
 * @package DigitalAssessmentPro\Analytics
 */

namespace DigitalAssessmentPro\Analytics;

defined( 'ABSPATH' ) || exit;

class Tracker {

	public function track( string $event_type, int $assessment_id, array $payload = [] ): void {
		$allowed_events = [ 'view', 'start', 'question_answer', 'complete', 'lead_capture', 'drop' ];
		if ( ! in_array( $event_type, $allowed_events, true ) ) {
			return;
		}

		// Anonymize IP for GDPR compliance (mask last octet).
		$raw_ip = sanitize_text_field( $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0' );
		$anon_ip = filter_var( $raw_ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 )
			? preg_replace( '/\.\d+$/', '.0', $raw_ip )
			: '0.0.0.0';

		$this->db()->insert(
			$this->table( 'analytics_events' ),
			[
				'event_type'    => $event_type,
				'assessment_id' => $assessment_id,
				'submission_id' => $payload['submission_id'] ?? null,
				'question_id'   => $payload['question_id']   ?? null,
				'option_id'     => $payload['option_id']     ?? null,
				'payload'       => wp_json_encode( $payload ),
				'session_id'    => sanitize_text_field( $payload['session_id'] ?? '' ),
				'ip_address'    => $anon_ip,
			],
			[ '%s', '%d', '%d', '%d', '%d', '%s', '%s', '%s' ]
		);

		do_action( 'dap/analytics/event', $event_type, $assessment_id, $payload );
	}

	private function db(): \wpdb {
		global $wpdb;
		return $wpdb;
	}

	private function table( string $name ): string {
		return $this->db()->prefix . 'dap_' . sanitize_key( $name );
	}
}

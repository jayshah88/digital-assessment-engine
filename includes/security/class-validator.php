<?php
/**
 * Input Validator — Comprehensive validation for all plugin inputs.
 *
 * @package DigitalAssessmentPro\Security
 */

namespace DigitalAssessmentPro\Security;

defined( 'ABSPATH' ) || exit;

/**
 * Input validation class.
 */
class Validator {

	/**
	 * Validation errors.
	 *
	 * @var array
	 */
	private array $errors = [];

	/**
	 * Validate assessment data.
	 *
	 * @param array $data Assessment data to validate.
	 * @return bool True if valid, false otherwise.
	 */
	public function validate_assessment( array $data ): bool {
		$this->errors = [];

		// Required fields.
		if ( empty( $data['title'] ) ) {
			$this->errors[] = __( 'Assessment title is required.', 'digital-assessment-engine' );
		}

		// Title length.
		if ( ! empty( $data['title'] ) && strlen( $data['title'] ) > 500 ) {
			$this->errors[] = __( 'Assessment title must be under 500 characters.', 'digital-assessment-engine' );
		}

		// Slug format.
		if ( ! empty( $data['slug'] ) && ! preg_match( '/^[a-z0-9-]+$/', $data['slug'] ) ) {
			$this->errors[] = __( 'Slug must contain only lowercase letters, numbers, and hyphens.', 'digital-assessment-engine' );
		}

		// Status enum.
		$valid_statuses = [ 'draft', 'published', 'archived' ];
		if ( ! empty( $data['status'] ) && ! in_array( $data['status'], $valid_statuses, true ) ) {
			$this->errors[] = __( 'Invalid assessment status.', 'digital-assessment-engine' );
		}

		return empty( $this->errors );
	}

	/**
	 * Validate question data.
	 *
	 * @param array $data Question data to validate.
	 * @return bool True if valid, false otherwise.
	 */
	public function validate_question( array $data ): bool {
		$this->errors = [];

		// Required fields.
		if ( empty( $data['question_text'] ) ) {
			$this->errors[] = __( 'Question text is required.', 'digital-assessment-engine' );
		}

		// Question type.
		$valid_types = [ 'single', 'multi', 'scale', 'text', 'boolean' ];
		if ( ! empty( $data['question_type'] ) && ! in_array( $data['question_type'], $valid_types, true ) ) {
			$this->errors[] = __( 'Invalid question type.', 'digital-assessment-engine' );
		}

		// Options for choice questions.
		if ( in_array( $data['question_type'] ?? '', [ 'single', 'multi', 'boolean' ], true ) ) {
			if ( empty( $data['options'] ) || count( $data['options'] ) < 2 ) {
				$this->errors[] = __( 'Choice questions require at least 2 options.', 'digital-assessment-engine' );
			}
		}

		return empty( $this->errors );
	}

	/**
	 * Validate submission data.
	 *
	 * @param array $data Submission data to validate.
	 * @return bool True if valid, false otherwise.
	 */
	public function validate_submission( array $data ): bool {
		$this->errors = [];

		// Assessment ID required.
		if ( empty( $data['assessment_id'] ) || ! is_numeric( $data['assessment_id'] ) ) {
			$this->errors[] = __( 'Valid assessment ID is required.', 'digital-assessment-engine' );
		}

		// Answers must be array.
		if ( ! isset( $data['answers'] ) || ! is_array( $data['answers'] ) ) {
			$this->errors[] = __( 'Answers must be provided as an array.', 'digital-assessment-engine' );
		}

		return empty( $this->errors );
	}

	/**
	 * Validate email.
	 *
	 * @param string $email Email to validate.
	 * @return bool True if valid, false otherwise.
	 */
	public function validate_email( string $email ): bool {
		if ( ! is_email( $email ) ) {
			$this->errors[] = __( 'Invalid email address.', 'digital-assessment-engine' );
			return false;
		}
		return true;
	}

	/**
	 * Sanitize HTML content.
	 *
	 * @param string $content Content to sanitize.
	 * @return string Sanitized content.
	 */
	public function sanitize_html( string $content ): string {
		$allowed_tags = [
			'p'      => [],
			'br'     => [],
			'strong' => [],
			'em'     => [],
			'ul'     => [],
			'ol'     => [],
			'li'     => [],
		];

		return wp_kses( $content, $allowed_tags );
	}

	/**
	 * Get validation errors.
	 *
	 * @return array Error messages.
	 */
	public function get_errors(): array {
		return $this->errors;
	}

	/**
	 * Get first error message.
	 *
	 * @return string|null First error or null.
	 */
	public function get_first_error(): ?string {
		return $this->errors[0] ?? null;
	}
}

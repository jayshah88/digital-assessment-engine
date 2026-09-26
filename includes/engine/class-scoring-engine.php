<?php
/**
 * Scoring Engine — Weighted, normalized, per-block scoring with level mapping.
 *
 * Algorithm:
 *  1. Per-question: awarded = option.score_value
 *  2. Per-block:    raw_score = Σ(awarded) / Σ(max_possible) * 100 * block.weight
 *  3. Total:        normalized = Σ(block_raw_score * block.weight) / Σ(block.weight)
 *  4. Level:        map normalized → configured score_levels
 *
 * @package DigitalAssessmentPro\Engine
 */

namespace DigitalAssessmentPro\Engine;

defined( 'ABSPATH' ) || exit;

class ScoringEngine {

	// ─── Public API ───────────────────────────────────────────────────────

	/**
	 * Score a submission based on readiness and capability framework.
	 * Calculation: Σ(awarded_points * block_weight).
	 *
	 * @param array $answers   [ question_id => [ option_ids[] | text_answer ] ]
	 * @param array $questions Full question+option+block data from DB.
	 * @param array $blocks    Block metadata (id, weight).
	 */
	public function score( array $answers, array $questions, array $blocks ): array {
		$block_map   = $this->index_by_id( $blocks );
		$q_by_block  = $this->group_questions_by_block( $questions );

		$block_scores    = [];
		$per_question    = [];
		$total_raw       = 0.0;
		$total_max       = 0.0;

		foreach ( $q_by_block as $block_id => $block_questions ) {
			$block        = $block_map[ $block_id ] ?? null;
			$block_weight = $block ? (float) $block['weight'] : 1.0;

			$block_raw   = 0.0;
			$block_max   = 0.0;

			foreach ( $block_questions as $q ) {
				[ $awarded, $max ] = $this->score_question( $q, $answers[ $q['id'] ] ?? null );

				$per_question[ $q['id'] ] = $awarded;
				// Apply block weight to each question's points
				$block_raw += ( $awarded * $block_weight );
				$block_max += ( $max * $block_weight );
			}

			$block_scores[ $block_id ] = [
				'raw' => round( $block_raw, 2 ),
				'max' => round( $block_max, 2 ),
				'pct' => $block_max > 0 ? round( ( $block_raw / $block_max ) * 100, 2 ) : 0,
			];

			$total_raw += $block_raw;
			$total_max += $block_max;
		}

		$total_raw  = round( $total_raw, 2 );
		$total_max  = round( $total_max, 2 );
		$percentage = $total_max > 0 ? round( ( $total_raw / $total_max ) * 100, 2 ) : 0;

		$level           = $this->map_level( $total_raw, $total_max );
		$recommendations = $this->generate_recommendations( $block_scores, $block_map );

		return [
			'sum'             => $total_raw,
			'total_score'     => $total_raw,
			'score'           => $total_raw,
			'total_max'       => $total_max,
			'percentage'      => $percentage,
			'block_scores'    => $block_scores,
			'per_question'    => $per_question,
			'level'           => $level,
			'recommendations' => $recommendations,
			'band_key'        => $level['key'] ?? '',
			'band_label'      => $level['label'] ?? '',
		];
	}

	// ─── Per-question scoring ─────────────────────────────────────────────

	private function score_question( array $question, mixed $answer ): array {
		if ( null === $answer ) {
			return [ 0.0, $this->max_for_question( $question ) ];
		}

		$type = $question['question_type'];

		return match ( $type ) {
			'single'  => $this->score_single( $question, $answer ),
			'multi'   => $this->score_multi( $question, $answer ),
			'scale'   => $this->score_scale( $question, $answer ),
			'boolean' => $this->score_boolean( $question, $answer ),
			'text'    => [ 0.0, 0.0 ], // Text questions don't contribute to score.
			default   => [ 0.0, $this->max_for_question( $question ) ],
		};
	}

	private function score_single( array $question, mixed $answer ): array {
		$selected_id = is_array( $answer ) ? ( $answer[0] ?? null ) : $answer;
		$max         = 0.0;
		$awarded     = 0.0;

		foreach ( $question['options'] as $opt ) {
			$val = (float) $opt['score_value'];
			if ( $val > $max ) {
				$max = $val;
			}
			if ( (string) $opt['id'] === (string) $selected_id ) {
				$awarded = $val;
			}
		}
		return [ $awarded, $max ];
	}

	private function score_multi( array $question, mixed $answer ): array {
		$selected = is_array( $answer ) ? array_map( 'strval', $answer ) : [];
		$max      = 0.0;
		$awarded  = 0.0;

		foreach ( $question['options'] as $opt ) {
			$val = (float) $opt['score_value'];
			$max += $val; // Sum of all options = max.
			if ( in_array( (string) $opt['id'], $selected, true ) ) {
				$awarded += $val;
			}
		}
		// Cap awarded at max.
		return [ min( $awarded, $max ), $max ];
	}

	private function score_scale( array $question, mixed $answer ): array {
		// Scale questions: answer is a numeric value (e.g. 1–5).
		// Options ordered by sort_order represent scale steps.
		$scale_value = (int) ( is_array( $answer ) ? ( $answer[0] ?? 0 ) : $answer );
		$options     = $question['options'];
		$max         = count( $options ); // e.g. 5.

		$awarded = max( 0, min( $scale_value, $max ) );
		return [ (float) $awarded, (float) $max ];
	}

	private function score_boolean( array $question, mixed $answer ): array {
		$val = (bool) ( is_array( $answer ) ? ( $answer[0] ?? false ) : $answer );
		// Assume first option = "yes" (score = 1), second = "no" (score = 0).
		$options = $question['options'];
		$max     = max( array_column( $options, 'score_value' ) ?: [ 1 ] );
		$awarded = $val ? (float) ( $options[0]['score_value'] ?? 1 ) : 0.0;
		return [ $awarded, (float) $max ];
	}

	private function max_for_question( array $question ): float {
		if ( empty( $question['options'] ) ) {
			return 0.0;
		}
		return (float) max( array_map( fn( $o ) => $o['score_value'], $question['options'] ) );
	}

	// ─── Level Mapping ────────────────────────────────────────────────────

	public function map_level( float $score, float $total_max = 48.0 ): array {
		$percentage = $total_max > 0 ? ( $score / $total_max ) * 100.0 : 0.0;
		$default_url = function_exists( 'home_url' ) ? home_url( '/contact' ) : '#contact';

		// Try to load dynamic score levels from database settings
		$db_levels_raw = get_option( 'dap_score_levels' );
		if ( $db_levels_raw ) {
			$db_levels = json_decode( $db_levels_raw, true );
			if ( is_array( $db_levels ) && ! empty( $db_levels ) ) {
				// Sort levels descending by min score so we map from top to bottom
				usort( $db_levels, function( $a, $b ) {
					return (float) ( $b['min'] ?? 0 ) <=> (float) ( $a['min'] ?? 0 );
				} );

				foreach ( $db_levels as $lvl ) {
					$min = (float) ( $lvl['min'] ?? 0 );
					$max = (float) ( $lvl['max'] ?? 100 );

					// Support matching by raw score or percentage
					$matched = false;
					if ( $score >= $min && ( empty( $max ) || $score <= $max ) ) {
						$matched = true;
					} elseif ( $percentage >= $min && ( empty( $max ) || $percentage <= $max ) ) {
						$matched = true;
					}

					if ( $matched ) {
						return [
							'key'         => sanitize_title( $lvl['key'] ?? 'unknown' ),
							'label'       => sanitize_text_field( $lvl['label'] ?? '' ),
							'color'       => sanitize_text_field( $lvl['color'] ?? '#0F172A' ),
							'headline'    => sanitize_text_field( $lvl['headline'] ?? '' ),
							'description' => sanitize_textarea_field( $lvl['description'] ?? '' ),
							'cta'         => sanitize_text_field( $lvl['cta'] ?? $lvl['cta_label'] ?? '' ),
							'cta_url'     => esc_url_raw( ! empty( $lvl['cta_url'] ) ? $lvl['cta_url'] : $default_url ),
						];
					}
				}
			}
		}

		// Fallback Thresholds based on percentage scale (or proportional to total_max)
		// GREEN: 85%+, GOLD: 65%-84%, AMBER: 40%-64%, RED: <40%
		if ( $percentage >= 85 || ( $total_max > 0 && $score >= 0.85 * $total_max ) ) {
			return [
				'key'         => 'green',
				'label'       => __( 'GREEN — Benchmark', 'digital-assessment-engine' ),
				'color'       => '#069e7b',
				'headline'    => __( 'Benchmark readiness — sustain and scale', 'digital-assessment-engine' ),
				'description' => __( 'Your capability is structured for scalable success. Maintain this standard across new milestones with continuous discipline.', 'digital-assessment-engine' ),
				'cta'         => __( 'Explore next steps and acceleration strategies', 'digital-assessment-engine' ),
				'cta_url'     => $default_url,
			];
		}
		if ( $percentage >= 65 || ( $total_max > 0 && $score >= 0.65 * $total_max ) ) {
			return [
				'key'         => 'gold',
				'label'       => __( 'GOLD — Low Risk', 'digital-assessment-engine' ),
				'color'       => '#edaf18',
				'headline'    => __( 'Low risk — optimise remaining gaps', 'digital-assessment-engine' ),
				'description' => __( 'Strong readiness across most dimensions. The remaining gaps are specific and addressable. Prioritise the remaining actions before proceeding.', 'digital-assessment-engine' ),
				'cta'         => __( 'Review recommendations and priority actions', 'digital-assessment-engine' ),
				'cta_url'     => $default_url,
			];
		}
		if ( $percentage >= 40 || ( $total_max > 0 && $score >= 0.40 * $total_max ) ) {
			return [
				'key'         => 'amber',
				'label'       => __( 'AMBER — Moderate Risk', 'digital-assessment-engine' ),
				'color'       => '#e76424',
				'headline'    => __( 'Moderate risk — specific gaps to close', 'digital-assessment-engine' ),
				'description' => __( 'Good foundations in some areas, but material gaps remain. Addressing these now is significantly more effective than remediating later.', 'digital-assessment-engine' ),
				'cta'         => __( 'Schedule a review session to close the gaps', 'digital-assessment-engine' ),
				'cta_url'     => $default_url,
			];
		}
		return [
			'key'         => 'red',
			'label'       => __( 'RED — High Risk', 'digital-assessment-engine' ),
			'color'       => '#c02b12',
			'headline'    => __( 'High risk — foundational action required', 'digital-assessment-engine' ),
			'description' => __( 'Significant gaps in capability readiness. At current trajectory, schedule slippage or rework are likely without intervention.', 'digital-assessment-engine' ),
			'cta'         => __( 'Connect with a specialist to discuss your plan', 'digital-assessment-engine' ),
			'cta_url'     => $default_url,
		];
	}

	// ─── Recommendations ──────────────────────────────────────────────────

	private function generate_recommendations( array $block_scores, array $block_map ): array {
		// Sort blocks by score ascending (lowest first = most needy).
		arsort( $block_scores ); // Reversed — highest → lowest
		$sorted = array_reverse( $block_scores, true );
		$recs   = [];

		foreach ( $sorted as $block_id => $score ) {
			$block = $block_map[ $block_id ] ?? null;
			if ( ! $block ) {
				continue;
			}
			$settings = json_decode( $block['settings'] ?? '{}', true );
			$rec_text = $settings['recommendation'] ?? null;
			if ( ! $rec_text ) {
				// Generate generic fallback.
				$rec_text = $score < 50
					? sprintf( __( 'Prioritize improving your %s capabilities — this is a critical growth area.', 'digital-assessment-engine' ), $block['title'] )
					: sprintf( __( 'Your %s performance is solid. Continue building on this strength.', 'digital-assessment-engine' ), $block['title'] );
			}
			$recs[] = [
				'block_id'    => $block_id,
				'block_title' => $block['title'],
				'block_icon'  => $block['icon'] ?? null,
				'score'       => $score,
				'priority'    => $score < 40 ? 'high' : ( $score < 70 ? 'medium' : 'low' ),
				'text'        => $rec_text,
			];
		}

		return apply_filters( 'dap/recommendations', $recs, $block_scores, $block_map );
	}

	// ─── Utilities ────────────────────────────────────────────────────────

	private function index_by_id( array $items ): array {
		return array_column( $items, null, 'id' );
	}

	private function group_questions_by_block( array $questions ): array {
		$grouped = [];
		foreach ( $questions as $q ) {
			$grouped[ $q['block_id'] ][] = $q;
		}
		return $grouped;
	}
}

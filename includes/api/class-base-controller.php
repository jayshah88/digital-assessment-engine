<?php
/**
 * Base REST Controller — shared validation, error helpers, response formatting.
 *
 * @package DigitalAssessmentPro\Api
 */

namespace DigitalAssessmentPro\Api;

defined( 'ABSPATH' ) || exit;

abstract class BaseController extends \WP_REST_Controller {

	/**
	 * Constructor - set the namespace.
	 */
	public function __construct() {
		$this->namespace = DAP_API_NS;
	}

	// ─── Response Helpers ─────────────────────────────────────────────────

	/**
	 * Return a success response.
	 *
	 * @param mixed $data Response data.
	 * @param int   $status HTTP status code.
	 * @param array $meta Optional metadata.
	 * @return \WP_REST_Response Formatted response.
	 */
	protected function success( mixed $data, int $status = 200, array $meta = [] ): \WP_REST_Response {
		$body = [
			'success' => true,
			'data'    => $data,
			'meta'    => $meta ?: null,
		];

		// Remove null meta to keep response clean.
		$body = array_filter( $body, fn( $v ) => null !== $v );

		return new \WP_REST_Response( $body, $status );
	}

	/**
	 * Return an error response.
	 *
	 * @param string $code Error code.
	 * @param string $message Human-readable message.
	 * @param int    $status HTTP status code.
	 * @param array  $extra Additional error data.
	 * @return \WP_Error Formatted error.
	 */
	protected function error( string $code, string $message, int $status = 400, array $extra = [] ): \WP_Error {
		$data = array_merge(
			[
				'status' => $status,
				'time'   => gmdate( 'Y-m-d\TH:i:s\Z' ),
			],
			$extra
		);
		return new \WP_Error( "dap/{$code}", $message, $data );
	}

	protected function not_found( string $message = '' ): \WP_Error {
		return $this->error( 'not_found', $message ?: __( 'Resource not found.', 'digital-assessment-pro' ), 404 );
	}

	// ─── Rate Limiting ────────────────────────────────────────────────────

	protected function check_rate_limit( \WP_REST_Request $request, string $action, int $max_per_hour = 0 ): bool|\WP_Error {
		$raw_ip = $this->get_trusted_client_ip();

		// Check if bypass conditions apply (local development, admins, debug mode).
		$bypass = false;
		if ( in_array( $raw_ip, [ '127.0.0.1', '::1', 'localhost' ], true ) ) {
			$bypass = true;
		} elseif ( current_user_can( 'manage_options' ) ) {
			$bypass = true;
		} elseif ( defined( 'WP_DEBUG' ) && WP_DEBUG && apply_filters( 'dap/bypass_rate_limit_in_debug', true ) ) {
			$bypass = true;
		}

		/**
		 * Filter whether to bypass rate limiting for the current request.
		 *
		 * @param bool             $bypass   Whether to bypass rate limit.
		 * @param string           $action   Action being rate-limited.
		 * @param \WP_REST_Request $request  The current REST request.
		 * @param string           $raw_ip   The client IP address.
		 */
		$bypass = (bool) apply_filters( 'dap/bypass_rate_limit', $bypass, $action, $request, $raw_ip );
		if ( $bypass ) {
			return true;
		}

		if ( 0 === $max_per_hour ) {
			$max_per_hour = (int) get_option( 'dap_rate_limit_per_hour', 30 );
		}

		/**
		 * Filter the maximum allowed requests per hour for an action.
		 *
		 * @param int              $max_per_hour Max requests per hour.
		 * @param string           $action       Action being rate-limited.
		 * @param \WP_REST_Request $request      The current REST request.
		 */
		$max_per_hour = (int) apply_filters( 'dap/rate_limit_max_per_hour', $max_per_hour, $action, $request );

		$identifier = $this->get_client_identifier( $request );
		$limiter    = \dap()->get( 'limiter' );
		$result     = $limiter->check( $identifier, $action, $max_per_hour );

		if ( ! $result ) {
			return $this->error(
				'rate_limited',
				__( 'Too many requests. Please try again later.', 'digital-assessment-pro' ),
				429
			);
		}
		return true;
	}

	protected function get_client_identifier( \WP_REST_Request $request ): string {
		$ip = $this->get_trusted_client_ip();
		// Hash to avoid storing raw IPs longer than needed.
		return hash( 'sha256', $ip );
	}

	/**
	 * Get the real client IP, only trusting proxy headers when the request
	 * originates from a known/trusted proxy (e.g. Cloudflare, load balancer).
	 *
	 * @return string Sanitized IP address.
	 */
	protected function get_trusted_client_ip(): string {
		$remote_addr = sanitize_text_field( $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0' );

		/**
		 * Filter the list of trusted reverse-proxy IPs/CIDRs.
		 * Only when REMOTE_ADDR matches one of these will forwarded headers be trusted.
		 *
		 * @param string[] $trusted_proxies Array of trusted proxy IPs or CIDR ranges.
		 */
		$trusted_proxies = apply_filters( 'dap/trusted_proxy_ips', [] );

		if ( ! empty( $trusted_proxies ) && $this->ip_in_ranges( $remote_addr, $trusted_proxies ) ) {
			// Request came from a trusted proxy — use forwarded header.
			$forwarded = $_SERVER['HTTP_CF_CONNECTING_IP']
				?? $_SERVER['HTTP_X_FORWARDED_FOR']
				?? $remote_addr;
			// X-Forwarded-For can contain multiple IPs — take the first (client) one.
			$client_ip = sanitize_text_field( trim( explode( ',', (string) $forwarded )[0] ) );
			if ( filter_var( $client_ip, FILTER_VALIDATE_IP ) ) {
				return $client_ip;
			}
		}

		// No trusted proxy or invalid forwarded IP — use REMOTE_ADDR directly.
		return filter_var( $remote_addr, FILTER_VALIDATE_IP ) ? $remote_addr : '0.0.0.0';
	}

	/**
	 * Anonymize an IP for GDPR-compliant storage.
	 * Masks the last octet of IPv4 or last 80 bits of IPv6.
	 *
	 * @param string $ip Raw IP address.
	 * @return string Anonymized IP.
	 */
	protected function anonymize_ip( string $ip ): string {
		$ip = trim( $ip );
		if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 ) ) {
			// Mask last octet: 1.2.3.4 → 1.2.3.0
			return preg_replace( '/\.\d+$/', '.0', $ip );
		}
		if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 ) ) {
			// Mask last 80 bits.
			return inet_ntop( substr( inet_pton( $ip ), 0, 6 ) . str_repeat( "\0", 10 ) );
		}
		return '0.0.0.0';
	}

	/**
	 * Check if an IP falls within any of the given CIDR ranges or exact IPs.
	 *
	 * @param string   $ip     IP to check.
	 * @param string[] $ranges Array of IPs or CIDR ranges.
	 * @return bool
	 */
	private function ip_in_ranges( string $ip, array $ranges ): bool {
		foreach ( $ranges as $range ) {
			if ( str_contains( $range, '/' ) ) {
				[ $subnet, $bits ] = explode( '/', $range, 2 );
				$subnet_bin = inet_pton( $subnet );
				$ip_bin     = inet_pton( $ip );
				if ( false === $subnet_bin || false === $ip_bin ) {
					continue;
				}
				$mask = str_repeat( 'f', (int) $bits >> 2 );
				switch ( (int) $bits % 4 ) {
					case 1: $mask .= '8'; break;
					case 2: $mask .= 'c'; break;
					case 3: $mask .= 'e'; break;
				}
				$mask = str_pad( $mask, strlen( $ip_bin ) * 2, '0' );
				$mask_bin = pack( 'H*', $mask );
				if ( ( $ip_bin & $mask_bin ) === ( $subnet_bin & $mask_bin ) ) {
					return true;
				}
			} elseif ( $ip === $range ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Verify nonce for public-facing POST endpoints.
	 * Returns true if valid, WP_Error if invalid.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return bool|\WP_Error
	 */
	protected function verify_public_nonce( \WP_REST_Request $request ): bool|\WP_Error {
		$nonce = $request->get_header( 'X-WP-Nonce' );
		if ( $nonce && wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return true;
		}
		// Also check the _wpnonce param as fallback.
		$param_nonce = $request->get_param( '_wpnonce' );
		if ( $param_nonce && wp_verify_nonce( $param_nonce, 'wp_rest' ) ) {
			return true;
		}
		return $this->error(
			'invalid_nonce',
			__( 'Security verification failed. Please refresh the page and try again.', 'digital-assessment-pro' ),
			403
		);
	}

	// ─── Validation Helpers ───────────────────────────────────────────────

	protected function require_params( \WP_REST_Request $request, array $params ): bool|\WP_Error {
		foreach ( $params as $param ) {
			if ( ! $request->has_param( $param ) || '' === $request->get_param( $param ) ) {
				return $this->error(
					'missing_param',
					sprintf( __( 'Required parameter missing: %s', 'digital-assessment-pro' ), $param )
				);
			}
		}
		return true;
	}

	/**
	 * Sanitize ID - made public for WP_REST_Controller compatibility.
	 *
	 * @param mixed $value Value to sanitize.
	 * @return int Sanitized ID.
	 */
	public function sanitize_id( mixed $value ): int {
		return intval( max( 0, (int) $value ) );
	}

	/**
	 * Sanitize slug - made public for WP_REST_Controller compatibility.
	 *
	 * @param mixed $value Value to sanitize.
	 * @return string Sanitized slug.
	 */
	public function sanitize_slug( mixed $value ): string {
		return sanitize_title( (string) $value );
	}

	/**
	 * Safe is_numeric wrapper for REST API callbacks.
	 *
	 * WordPress REST API passes 3 args: ($value, $request, $param)
	 *
	 * @param mixed $value Param value.
	 * @param mixed $request REST request object (unused).
	 * @param mixed $param Param name (unused).
	 * @return bool
	 */
	public function is_numeric_param( $value, $request = null, $param = '' ): bool {
		return is_numeric( $value );
	}

	// ─── DB Access ────────────────────────────────────────────────────────

	protected function db(): \wpdb {
		global $wpdb;
		return $wpdb;
	}

	protected function table( string $name ): string {
		return $this->db()->prefix . 'dap_' . $name;
	}

	// ─── Caching ──────────────────────────────────────────────────────────

	/**
	 * Get cached value with safety checks.
	 *
	 * @param string $key Cache key.
	 * @return mixed Cached value or false.
	 */
	protected function cache_get( string $key ): mixed {
		if ( ! function_exists( 'dap' ) ) {
			return false;
		}
		try {
			$cache = \dap()->get( 'cache' );
			return $cache ? $cache->get( $key ) : false;
		} catch ( \Exception $e ) {
			return false;
		}
	}

	/**
	 * Set cached value with safety checks.
	 *
	 * @param string $key Cache key.
	 * @param mixed  $value Value to cache.
	 * @param int    $ttl Time to live in seconds.
	 * @return void
	 */
	protected function cache_set( string $key, mixed $value, int $ttl = 0 ): void {
		if ( ! function_exists( 'dap' ) ) {
			return;
		}
		try {
			$cache = \dap()->get( 'cache' );
			if ( $cache ) {
				$cache->set( $key, $value, $ttl );
			}
		} catch ( \Exception $e ) {
			// Silently fail - cache is not critical.
		}
	}

	/**
	 * Delete cached value with safety checks.
	 *
	 * @param string $key Cache key.
	 * @return void
	 */
	protected function cache_delete( string $key ): void {
		if ( ! function_exists( 'dap' ) ) {
			return;
		}
		try {
			$cache = \dap()->get( 'cache' );
			if ( $cache ) {
				$cache->delete( $key );
			}
		} catch ( \Exception $e ) {
			// Silently fail - cache is not critical.
		}
	}
}

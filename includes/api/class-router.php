<?php
/**
 * API Router — registers all REST endpoints under /wp-json/assessment/v1/
 *
 * @package DigitalAssessmentPro\Api
 */

namespace DigitalAssessmentPro\Api;

defined( 'ABSPATH' ) || exit;

class Router {

	private array $controllers = [];

	/**
	 * Register all API routes and filters.
	 */
	public function register_routes(): void {
		$this->boot_controllers();

		foreach ( $this->controllers as $controller ) {
			$controller->register_routes();
		}

		// Add API response headers.
		add_filter( 'rest_pre_serve_request', [ $this, 'add_api_headers' ], 10, 4 );
	}

	/**
	 * Add API response headers for versioning and caching.
	 *
	 * @param bool               $served Whether the request has been served.
	 * @param \WP_HTTP_Response $result Result to send to client.
	 * @param \WP_REST_Request  $request Request object.
	 * @param \WP_REST_Server   $server  Server instance.
	 * @return bool
	 */
	public function add_api_headers( $served, $result, $request, $server ): bool {
		// Safety checks for server object.
		if ( ! is_object( $server ) || ! method_exists( $server, 'send_header' ) ) {
			return $served;
		}

		// Only process REST requests.
		if ( ! $request instanceof \WP_REST_Request ) {
			return $served;
		}

		// Get the route to check if it's our namespace.
		$route = $request->get_route();
		if ( empty( $route ) || ! is_string( $route ) ) {
			return $served;
		}

		// Only add headers for our namespace.
		if ( strpos( $route, '/assessment/v1' ) !== 0 ) {
			return $served;
		}

		// Add version headers safely.
		if ( defined( 'DAP_VERSION' ) ) {
			$server->send_header( 'X-API-Version', DAP_VERSION );
		}
		$server->send_header( 'X-API-Name', 'Digital Assessment Pro' );

		// Security headers.
		$server->send_header( 'X-Content-Type-Options', 'nosniff' );
		$server->send_header( 'X-Frame-Options', 'DENY' );
		$server->send_header( 'X-Robots-Tag', 'noindex, nofollow' );
		$server->send_header( 'Cache-Control', 'no-store, no-cache, must-revalidate, private' );
		$server->send_header( 'Pragma', 'no-cache' );

		// Add rate limit info if available.
		$rate_limit_remaining = apply_filters( 'dap/rate_limit_remaining', null, $request );
		if ( null !== $rate_limit_remaining && is_numeric( $rate_limit_remaining ) ) {
			$server->send_header( 'X-RateLimit-Remaining', (int) $rate_limit_remaining );
		}

		return $served;
	}

	private function boot_controllers(): void {
		$this->controllers = [
			new AssessmentsController(),
			new QuestionsController(),
			new BlocksController(),
			new SubmissionsController(),
			new LeadsController(),
			new AnalyticsController(),
			new SettingsController(),
		];
	}
}

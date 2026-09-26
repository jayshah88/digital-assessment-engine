<?php
/**
 * Core Plugin Singleton
 *
 * @package DigitalAssessmentPro
 */

namespace DigitalAssessmentPro;

defined( 'ABSPATH' ) || exit;

final class Plugin {

	private static ?Plugin $instance = null;

	// Service container (poor-man's DI).
	private array $services = [];

	public static function instance(): static {
		if ( null === static::$instance ) {
			static::$instance = new static();
			static::$instance->boot();
		}
		return static::$instance;
	}

	private function __construct() {}
	private function __clone() {}

	// ─── Boot ─────────────────────────────────────────────────────────────
	private function boot(): void {
		$this->load_textdomain();
		$this->register_services();
		$this->init_hooks();
	}

	private function load_textdomain(): void {
		load_plugin_textdomain(
			'digital-assessment-pro',
			false,
			dirname( plugin_basename( DAP_FILE ) ) . '/languages'
		);
	}

	private function register_services(): void {
		// Core services — registered lazily via closures.
		$this->services = [
			'db'       => fn() => new Database\Schema(),
			'roles'    => fn() => new Access\RoleManager(),
			'scoring'  => fn() => new Engine\ScoringEngine(),
			'cache'    => fn() => new Cache\Manager(),
			'limiter'  => fn() => new Security\RateLimiter(),
			'analytics'=> fn() => new Analytics\Tracker(),
			'api'      => fn() => new Api\Router(),
			'admin'    => fn() => new Admin\Manager(),
			'frontend' => fn() => new Frontend\Loader(),
		];
	}

	private function init_hooks(): void {
		add_action( 'init',             [ $this, 'initialize' ] );
		add_action( 'rest_api_init',    [ $this, 'initialize_api' ] );
		add_action( 'admin_menu',       [ $this, 'initialize_admin' ], 5 );
		add_action( 'wp_enqueue_scripts', [ $this, 'initialize_frontend' ], 999 );
		add_action( 'admin_enqueue_scripts', [ $this, 'initialize_admin_assets' ] );

		// Update check.
		add_action( 'plugins_loaded',   [ $this, 'maybe_upgrade' ] );
	}

	// ─── Initialization ────────────────────────────────────────────────────
	public function initialize(): void {
		do_action( 'dap/init', $this );
		$this->register_shortcodes();
		$this->register_blocks();
		\DigitalAssessmentPro\Privacy\Privacy::init();
	}

	public function initialize_api(): void {
		$this->get( 'api' )->register_routes();
	}

	public function initialize_admin(): void {
		$this->get( 'admin' )->boot();
	}

	public function initialize_frontend(): void {
		$this->get( 'frontend' )->enqueue();
	}

	public function initialize_admin_assets( string $hook ): void {
		$this->get( 'admin' )->enqueue_assets( $hook );
	}

	private function register_shortcodes(): void {
		add_shortcode( 'dap_assessment', [ $this->get( 'frontend' ), 'render_shortcode' ] );
	}

	private function register_blocks(): void {
		// Gutenberg block registration — delegates to Frontend\Loader.
		$this->get( 'frontend' )->register_block();
	}

	// ─── Upgrade ──────────────────────────────────────────────────────────
	public function maybe_upgrade(): void {
		$installed = get_option( 'dap_db_version', '0' );
		if ( version_compare( $installed, DAP_DB_VERSION, '<' ) ) {
			Installer::activate();
		}
	}

	// ─── Service Container ────────────────────────────────────────────────
	public function get( string $service ): mixed {
		if ( ! isset( $this->services[ $service ] ) ) {
			throw new \InvalidArgumentException( "Unknown service: {$service}" );
		}
		// Resolve lazily.
		if ( is_callable( $this->services[ $service ] ) ) {
			$this->services[ $service ] = ( $this->services[ $service ] )();
		}
		return $this->services[ $service ];
	}

	public function set( string $service, mixed $instance ): void {
		$this->services[ $service ] = $instance;
	}
}

<?php
/**
 * Cache Manager — wraps WordPress object cache.
 *
 * @package DigitalAssessmentPro\Cache
 */

namespace DigitalAssessmentPro\Cache;

defined( 'ABSPATH' ) || exit;

class Manager {

	private string $group = DAP_CACHE_GROUP;
	private int    $default_ttl;

	public function __construct() {
		$this->default_ttl = (int) get_option( 'dap_cache_ttl', 300 );
		wp_cache_add_non_persistent_groups( [ $this->group ] );
	}

	public function get( string $key ): mixed {
		return wp_cache_get( $key, $this->group );
	}

	public function set( string $key, mixed $value, int $ttl = 0 ): bool {
		return wp_cache_set( $key, $value, $this->group, $ttl ?: $this->default_ttl );
	}

	public function delete( string $key ): bool {
		return wp_cache_delete( $key, $this->group );
	}

	public function flush(): bool {
		// wp_cache_flush_group() requires WordPress 6.3+.
		if ( function_exists( 'wp_cache_flush_group' ) ) {
			return wp_cache_flush_group( $this->group );
		}
		// Fallback for older WP versions: delete keys by group marker.
		return wp_cache_set( 'dap_flush_marker', time(), $this->group );
	}
}

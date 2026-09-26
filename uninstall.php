<?php
/**
 * Uninstall script — called by WordPress when plugin is deleted.
 *
 * This file is executed directly by WordPress, not via the plugin bootstrap,
 * so we need to manually include the Installer class.
 *
 * @package DigitalAssessmentPro
 */

// Safety check — WordPress must have set this constant before calling us.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Re-define the constant so the class doesn't throw.
if ( ! defined( 'DAP_PATH' ) ) {
	define( 'DAP_PATH', plugin_dir_path( __FILE__ ) );
}

require_once DAP_PATH . 'includes/access/class-role-manager.php';
require_once DAP_PATH . 'includes/class-installer.php';

\DigitalAssessmentPro\Installer::uninstall();

<?php
/**
 * DRESSO theme bootstrap.
 *
 * Based on Clothes Boutique 0.3.1 (GPLv3 or later).
 * DRESSO-specific adaptation and maintenance by DRESSO.
 * See NOTICE.md for upstream attribution.
 *
 * @package Dresso
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

function dresso_setup() {
    load_theme_textdomain( 'dresso', get_template_directory() . '/languages' );
}
add_action( 'after_setup_theme', 'dresso_setup' );

/** Keep the original storefront assets and load order to reduce visual regressions. */
function dresso_block_assets() {
    $uri = get_template_directory_uri();
    $version = wp_get_theme()->get( 'Version' );

    wp_enqueue_style( 'dresso-fontawesome', $uri . '/assets/font-awesome/css/all.css', array(), '7.1.0' );
    wp_enqueue_style( 'dresso-animatecss', $uri . '/assets/css/animate.css', array(), $version );
    wp_enqueue_style( 'dresso-slick-style', $uri . '/assets/css/slick.css', array(), $version );
    wp_enqueue_style( 'dresso-style', $uri . '/style.css', array(), $version );
    // Former inline header CSS, loaded consistently on all theme pages.
    wp_enqueue_style( 'dresso-header', $uri . '/assets/css/dresso-header.css', array( 'dresso-style' ), $version );

    // Homepage uses its own header, navigation and footer.
    if ( is_front_page() ) {
        wp_enqueue_style(
            'dresso-home',
            $uri . '/assets/css/dresso-home.css',
            array( 'dresso-header' ),
            $version
        );
    }


    // Product styles belong to WooCommerce catalog / product views only.
    // Avoid applying these selectors globally on non-commerce pages.
    if ( function_exists( 'is_woocommerce' ) && is_woocommerce() ) {
        wp_enqueue_style( 'dresso-products', $uri . '/assets/css/dresso-products.css', array( 'dresso-style' ), $version );
    }
    wp_enqueue_script( 'dresso-wow-script', $uri . '/assets/js/wow.js', array( 'jquery' ), $version, true );
    wp_enqueue_script( 'dresso-slick-js', $uri . '/assets/js/slick.js', array( 'jquery' ), $version, true );
    wp_enqueue_script( 'dresso-script', $uri . '/assets/js/script.js', array( 'jquery' ), $version, true );
    // Update the hardcoded category menu only on first interaction.
    wp_enqueue_script( 'dresso-category-nav', $uri . '/assets/js/dresso-category-nav.js', array(), $version, true );
    // Keep primary WOMEN / MEN / KIDS dropdowns mutually exclusive.
    wp_enqueue_script( 'dresso-menu-accordion', $uri . '/assets/js/dresso-menu-accordion.js', array(), $version, true );
    wp_style_add_data( 'dresso-style', 'rtl', 'replace' );
}
add_action( 'enqueue_block_assets', 'dresso_block_assets' );

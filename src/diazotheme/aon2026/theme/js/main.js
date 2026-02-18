/******/ (function() { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/.pnpm/macaw-tabs@1.0.4/node_modules/macaw-tabs/src/js/macaw-tabs.js":
/*!******************************************************************************************!*\
  !*** ./node_modules/.pnpm/macaw-tabs@1.0.4/node_modules/macaw-tabs/src/js/macaw-tabs.js ***!
  \******************************************************************************************/
/***/ (function() {

/**
 * Macaw Tabs | Tabs jQuery Plugin
 *
 * @author    https://htmlcssfreebies.com/macaw-tabs/
 * @copyright Copyright (c) 2021  HTMLCSSFreebies.com
 * @license   MIT License, https://opensource.org/licenses/MIT
 * @version   v1.1
 */

( function( $ ) {
	'use strict';

	$.fn.macawTabs = function( options ) {
		// Default Settings
		const defaults = {
			tabPanelAutoActivation: false,
			tabPanelTransitionLogic: true,
			tabPanelTransitionClass: 'active',
			tabPanelTransitionTimeout: 0,
			tabPanelTransitionTimeoutDuration: 50,
			autoVerticalOrientation: true,
			autoVerticalOrientationMaxWidth: '575px',
			onTabActivation() {},
		};

		// Settings
		const settings = $.extend( {}, defaults, options );

		// Loop Elements
		return this.each( function() {
			// Parent Context and Settings
			const parentObj = { parentThis: $( this ), settings };

			// Init
			init( parentObj );

			// Resize Event
			resizeEvent( parentObj );
		} );
	};

	//
	// Init
	//

	const init = ( parentObj ) => {
		// Parent Object
		const { settings } = parentObj;

		// Tab Vertical Orientation ?
		if ( true === settings.autoVerticalOrientation ) {
			tabVerticalOrientation( parentObj );
		}

		// Tab Panel Transition
		tabPanelTransition( parentObj );

		//
		// Events
		//

		// Click Event
		clickEvent( parentObj );

		// Key Event
		keyEvent( parentObj );
	};

	//
	// Tab Vertical Orientation
	//

	const tabVerticalOrientation = ( parentObj ) => {
		// Parent Object
		const { parentThis, settings } = parentObj;

		// Tab List
		const $tabList = parentThis.find( '> [role=tablist]' );

		// Tab Orientation
		parentThis.removeClass( 'vertical' );
		$tabList.removeAttr( 'aria-orientation' );
		if ( window.matchMedia( `(max-width: ${ settings.autoVerticalOrientationMaxWidth })` ).matches ) {
			parentThis.addClass( 'vertical' );
			$tabList.attr( 'aria-orientation', 'vertical' );
		}
	};

	//
	// Tab Panel Transition
	//

	const tabPanelTransition = ( parentObj ) => {
		// Parent Object
		const { parentThis, settings } = parentObj;

		// Active Tab and Tab Panel
		const $tab = parentThis.find( '> [role=tablist] > [role=tab][aria-selected=true]' );
		const $tabPanel = $( `#${ $tab.attr( 'aria-controls' ) }` );

		// Tab Panel Active Class Logic
		if ( true === settings.tabPanelTransitionLogic ) {
			// Tab Panel Active Class
			settings.tabPanelTransitionTimeout = setTimeout( () => {
				$tabPanel.addClass( settings.tabPanelTransitionClass );
			}, settings.tabPanelTransitionTimeoutDuration );
		}
	};

	//
	// Deactivate All Tabs and Tabs Panel
	//

	const deactivateTabs = ( parentObj ) => {
		// Args Object
		const { parentThis, settings } = parentObj;

		// Tabs and Tab Panels
		const $tabs = parentThis.find( '> [role=tablist] > [role=tab]' );
		const $tabsPanel = parentThis.find( '> [role=tabpanel]' );

		// Tabs Deactivation Logic
		$tabs.attr( 'tabindex', '-1' );
		$tabs.attr( 'aria-selected', 'false' );

		// Tabs Panel Deactivation Logic
		if ( true === settings.tabPanelTransitionLogic ) {
			$tabsPanel.removeClass( settings.tabPanelTransitionClass );
		}
		$tabsPanel.attr( 'hidden', 'hidden' );
	};

	//
	// Activate Current Tab and Tab Panel
	//

	const activateTab = ( parentObj, tab ) => {
		// Parent Object
		const { parentThis, settings } = parentObj;

		// Make sure tab is not already activated.
		if ( 'true' !== tab.attr( 'aria-selected' ) ) {
			// Deactivate All Tabs and Tabs Panel
			deactivateTabs( parentObj );

			// Tab Activation Logic
			tab.removeAttr( 'tabindex' );
			tab.attr( 'aria-selected', 'true' );

			// Tab Panel Activation Logic
			const $tabPanel = $( `#${ tab.attr( 'aria-controls' ) }` );
			$tabPanel.removeAttr( 'hidden' );

			// Tab Panel Transition
			tabPanelTransition( parentObj );

			// Callback
			settings.onTabActivation.call( { parentThis, tab } );
		}
	};

	//
	// Focus Orientation
	//

	const focusOrientation = ( parentObj, currentTab, direction ) => {
		// Parent Object
		const { settings } = parentObj;

		// Orientation Decision
		if ( 'prev' === direction ) {
			if ( currentTab.prev().index() !== -1 ) {
				// Tab
				const tab = currentTab.prev().focus();

				// Activate Current Tab and Tab Panel
				if ( true === settings.tabPanelAutoActivation ) {
					activateTab( parentObj, $( tab ) );
				}
			} else {
				focusLastTab( parentObj );
			}
		} else if ( 'next' === direction ) {
			if ( currentTab.next().index() !== -1 ) {
				// Tab
				const tab = currentTab.next().focus();

				// Activate Current Tab and Tab Panel
				if ( true === settings.tabPanelAutoActivation ) {
					activateTab( parentObj, $( tab ) );
				}
			} else {
				focusFirstTab( parentObj );
			}
		}
	};

	//
	// Focus First Tab
	//

	const focusFirstTab = ( parentObj ) => {
		// Parent Object
		const { parentThis, settings } = parentObj;

		// Tabs
		const $tabs = parentThis.find( '> [role=tablist] > [role=tab]' );

		// First Tab
		const tab = $tabs[ 0 ];

		// Focus
		tab.focus();

		// Activate Current Tab and Tab Panel
		if ( true === settings.tabPanelAutoActivation ) {
			activateTab( parentObj, $( tab ) );
		}
	};

	//
	// Focus Last Tab
	//

	const focusLastTab = ( parentObj ) => {
		// Parent Object
		const { parentThis, settings } = parentObj;

		// Tabs
		const $tabs = parentThis.find( '> [role=tablist] > [role=tab]' );

		// Last Tab
		const tab = $tabs[ ( $tabs.length ) - 1 ];

		// Focus
		tab.focus();

		// Activate Current Tab and Tab Panel
		if ( true === settings.tabPanelAutoActivation ) {
			activateTab( parentObj, $( tab ) );
		}
	};

	//
	// Resize Event
	//

	const resizeEvent = ( parentObj ) => {
		// Parent Object
		const { settings } = parentObj;

		// Resize is Required,
		// If need vertical orientation of tabs on mobile.
		if ( true === settings.autoVerticalOrientation ) {
			$( window ).resize( function() {
				// Init
				init( parentObj );
			} );
		}
	};

	//
	// Click Event
	//

	const clickEvent = ( parentObj ) => {
		// Parent Object
		const { parentThis } = parentObj;

		// Tabs Object within Scope
		const $tabs = parentThis.find( '> [role=tablist] > [role=tab]' );

		$tabs.off( 'click' ).on( 'click', function( e ) {
			// Prevent Default
			e.preventDefault();
			e.stopPropagation();

			// Activate Current Tab and Tab Panel
			activateTab( parentObj, $( this ) );
		} );
	};

	//
	// Key Event
	//

	const keyEvent = ( parentObj ) => {
		// Parent Object
		const { parentThis } = parentObj;

		// Tabs and Tablist
		const $tabs = parentThis.find( '> [role=tablist] > [role=tab]' );
		const $tablist = parentThis.find( '> [role=tablist]' );

		// Orientation Attribute
		const orientation = $tablist.attr( 'aria-orientation' );

		// Keys
		const keys = {
			enter: 13,
			space: 32,
			end: 35,
			home: 36,
			left: 37,
			up: 38,
			right: 39,
			down: 40,
		};

		//
		// Key Down
		//

		$tabs.off( 'keydown' ).on( 'keydown', function( e ) {
			// Prevent Default
			// It is not set here due to page scroll.

			// Switch
			switch ( e.which ) {
				case keys.end:
					// Prevent Default
					e.preventDefault();
					e.stopPropagation();

					// Focus Last Tab
					focusLastTab( parentObj );
					break;

				case keys.home:
					// Prevent Default
					e.preventDefault();
					e.stopPropagation();

					// Focus First Tab
					focusFirstTab( parentObj );
					break;

					//
					// Up and down are in keydown
					// because we need to prevent page scroll >:)
					//

				case keys.up:
					if ( orientation === 'vertical' ) {
						// Prevent Default
						e.preventDefault();
						e.stopPropagation();

						// Focus Orientation
						focusOrientation( parentObj, $( this ), 'prev' );
					}
					break;

				case keys.down:
					if ( orientation === 'vertical' ) {
						// Prevent Default
						e.preventDefault();
						e.stopPropagation();

						// Focus Orientation
						focusOrientation( parentObj, $( this ), 'next' );
					}
					break;
			}
		} );

		//
		// Key Up
		//

		$tabs.off( 'keyup' ).on( 'keyup', function( e ) {
			// Prevent Default
			e.preventDefault();
			e.stopPropagation();

			// Switch
			switch ( e.which ) {
				case keys.left:
					if ( orientation !== 'vertical' ) {
						// Focus Orientation
						focusOrientation( parentObj, $( this ), 'prev' );
					}
					break;

				case keys.right:
					if ( orientation !== 'vertical' ) {
						// Focus Orientation
						focusOrientation( parentObj, $( this ), 'next' );
					}
					break;

				case keys.enter:
				case keys.space:
					// Activate Current Tab and Tab Panel
					activateTab( parentObj, $( this ) );
					break;
			}
		} );
	};
}( jQuery ) );


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	!function() {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = function(module) {
/******/ 			var getter = module && module.__esModule ?
/******/ 				function() { return module['default']; } :
/******/ 				function() { return module; };
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	}();
/******/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	!function() {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = function(exports, definition) {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	}();
/******/
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	!function() {
/******/ 		__webpack_require__.o = function(obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop); }
/******/ 	}();
/******/
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	!function() {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = function(exports) {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	}();
/******/
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
!function() {
"use strict";
/*!****************************************************!*\
  !*** ./src/diazotheme/oag2025/theme/js/oag2025.js ***!
  \****************************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var macaw_tabs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! macaw-tabs */ "./node_modules/.pnpm/macaw-tabs@1.0.4/node_modules/macaw-tabs/src/js/macaw-tabs.js");
/* harmony import */ var macaw_tabs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(macaw_tabs__WEBPACK_IMPORTED_MODULE_0__);
/*jshint esversion: 6 */
/*global jQuery*/
// import '../less/theme.local.less';

/* JavaScript for the 'ICustomTheme' Plone browser layer */

// Wait for jQuery to be available in Plone 6
(function ($) {
  // JS code which uses $

  var mediaSizeTimer;
  function mediaSize() {
    if ($('body.subsection-housing-roles-and-responsibilities')) {
      var hr = $('#housingroles');
      if (window.matchMedia('(max-width: 1079px)').matches) {
        hr.css('padding-bottom', '0');
        hr.height('2515px');
      } else {
        hr.css('padding-bottom', '118.8889%');
        hr.height('0');
      }
    }
  }
  $(document).ready(mediaSize);
  $(window).resize(function () {
    clearTimeout(mediaSizeTimer);
    mediaSizeTimer = setTimeout(mediaSize, 500);
  });

  // Mosaic Homepage banner
  if ($('.hpbanner').data('oagbanner')) {
    var hpbanner = $('.hpbanner').data('oagbanner');
    var hpbanner_url = 'url('.concat(hpbanner, ')');
    var hpbanner_url_sml = 'url('.concat(hpbanner.slice(0, -4), '-sml.png)');
    if (window.matchMedia('(max-width: 767px)').matches) {
      $('.hpbanner').css("background-image", hpbanner_url_sml);
    } else {
      $('.hpbanner').css("background-image", hpbanner_url);
    }
  }

  // P6 OAG Banner - Random image display
  $(document).ready(function () {
    const p6oagbanner = document.getElementById('p6oagbanner');
    if (p6oagbanner) {
      const whichbanner = Math.floor(Math.random() * 8) + 1;
      const randomImage = p6oagbanner.querySelector("img:nth-of-type(".concat(whichbanner, ")"));
      if (randomImage) {
        randomImage.classList.remove('d-none');
        randomImage.classList.add('d-block');
      }
    }
  });

  // Mosaic AuditNZ banner
  $('.ANZbanner').each(function () {
    if ($(this).data('oagbanner')) {
      var hpbanner = $(this).data('oagbanner');
      var hpgradient = "linear-gradient(90deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 75%)";
      var hpbanner_url = "url(".concat(hpbanner, ")");
      var hpbanner_grad_url = hpgradient.concat(", ", hpbanner_url);
      var hpbanner_url_sml = 'url('.concat(hpbanner.slice(0, -4), '-sml.png)');
      if (window.matchMedia('(max-width: 1199px)').matches) {
        $(this).css("background-image", hpbanner_url);
      } else if (window.matchMedia('(max-width: 767px)').matches) {
        $(this).css("background-image", hpbanner_url_sml);
      } else {
        $(this).css("background-image", hpbanner_grad_url);
      }
    }
  });

  // 2021 Housing graphics
  if ($('body.subsection-housing-roles-and-responsibilities')) {
    var hr = $('#housingroles');
    if (window.matchMedia('(max-width: 1079px)').matches) {
      hr.css('padding-bottom', '0');
      hr.height('2515px');
    } else {
      hr.css('padding-bottom', '118.8889%');
      hr.height('0');
    }
  }

  // Macaw tabs initialization
  $('.macaw-tabs').macawTabs();

  // AutoTOC heading enhancement
  // Adds an accessible heading to the table of contents navigation
  // Uses exponential backoff to handle slow-rendering autotoc patterns
  $(document).ready(function () {
    const INITIAL_DELAY = 100;
    const MAX_DELAY = 5000;
    const MAX_TOTAL_TIME = 15000;
    const startTime = Date.now();
    const attemptAddHeadings = function (currentDelay) {
      let needsRetry = false;
      $('.pat-autotoc').each(function () {
        const $toc = $(this);
        const $nav = $toc.find('nav').first();
        if ($nav.length) {
          // Nav exists - add heading if not already present
          if (!$nav.find('header .autotoc-heading').length) {
            const $heading = $('<h2>', {
              'class': 'autotoc-heading h4 ms-3',
              'id': 'toc-heading',
              'text': 'On this page'
            });
            const $header = $('<header>').append($heading);
            $nav.prepend($header);
          }
        } else {
          // Nav not yet rendered - need to retry
          needsRetry = true;
        }
      });

      // Check if retry needed and time hasn't expired
      const elapsed = Date.now() - startTime;
      if (needsRetry && elapsed < MAX_TOTAL_TIME) {
        const nextDelay = Math.min(currentDelay * 2, MAX_DELAY);
        setTimeout(function () {
          attemptAddHeadings(nextDelay);
        }, currentDelay);
      }
    };

    // Start the backoff sequence
    attemptAddHeadings(INITIAL_DELAY);
  });
})(jQuery);
}();
/******/ })()
;

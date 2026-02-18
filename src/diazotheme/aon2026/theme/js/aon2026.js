/*jshint esversion: 6 */
/*global jQuery*/
/* JavaScript for the aon2026 Plone browser layer */

// Wait for jQuery to be available in Plone 6
(function($) {

    // AutoTOC heading enhancement
    // Adds an accessible heading to the table of contents navigation
    // Uses exponential backoff to handle slow-rendering autotoc patterns
    $(document).ready(function() {
        const INITIAL_DELAY = 100;
        const MAX_DELAY = 5000;
        const MAX_TOTAL_TIME = 15000;
        const startTime = Date.now();

        const attemptAddHeadings = function(currentDelay) {
            let needsRetry = false;

            $('.pat-autotoc').each(function() {
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
                setTimeout(function() {
                    attemptAddHeadings(nextDelay);
                }, currentDelay);
            }
        };

        // Start the backoff sequence
        attemptAddHeadings(INITIAL_DELAY);
    });
})(jQuery);

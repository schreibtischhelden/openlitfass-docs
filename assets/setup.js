/* Runs right after markdown-pages.js, before anything is rendered: the
   theme chosen earlier (no flash of the wrong theme) and the renderer
   options. Not inline, because the Content Security Policy allows scripts
   from this site only. */
(function () {
	'use strict';
	try {
		var theme = localStorage.getItem('ol-docs-theme');
		if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
	} catch (e) {}

	if (window.MarkdownPages) {
		// The Markdown is wrapped for readable diffs; a line break is not a <br>.
		window.MarkdownPages.showdownOptions.simpleLineBreaks = false;
	}
})();

/*!
 * markdown-pages.js - simple Markdown-based static sites, without the generator
 *
 * Loads README.md (or the page selected by the query string), header.md and
 * footer.md, converts them with Showdown and sanitizes the result with
 * DOMPurify before it is inserted into <main>, <header> and <footer>.
 *
 * After each region is rendered a "mdp:rendered" event is dispatched on
 * document (detail: { region: "main" | "header" | "footer", page: "..." }).
 */
(function (global) {
	'use strict';

	var MarkdownPages = {};

	// ---------------------------------------------------------------------
	// Page resolution (pure, unit tested)
	// ---------------------------------------------------------------------

	// one path segment: letters, digits, "_", "-", "." - no leading dot,
	// so "..", ".git" etc. are rejected
	var SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;

	function isSafePath(path) {
		if (typeof path !== 'string' || path.length === 0 || path.length > 200) {
			return false;
		}
		return path.split('/').every(function (segment) {
			return SEGMENT.test(segment);
		});
	}

	/**
	 * Maps the query string to a Markdown file relative to index.html.
	 *   (none)            -> README.md
	 *   ?page=foo         -> pages/foo.md
	 *   ?foo              -> foo.md
	 *   ?docs=foo         -> docs/foo.md
	 * Returns null when the requested path is not allowed. Only relative,
	 * same-directory paths are produced: no "//host", "https:", "..", etc.
	 */
	function resolvePage(search) {
		var params = new URLSearchParams(search || '');
		var first = params.entries().next().value;
		if (!first) {
			return 'README.md';
		}
		var key = first[0];
		var value = first[1];
		if (value && value.slice(-3) === '.md') {
			value = value.slice(0, -3);
		}
		if (key.slice(-3) === '.md') {
			key = key.slice(0, -3);
		}

		var path;
		if (key && !value) {
			path = key;
		} else if (key === 'page' && value) {
			path = 'pages/' + value;
		} else if (key && value) {
			path = key + '/' + value;
		} else {
			return 'README.md';
		}
		return isSafePath(path) ? path + '.md' : null;
	}

	/**
	 * File that is fetched for a resolved page. The home page is addressed
	 * as "README.md" everywhere (events, menus); only the fetch uses
	 * MarkdownPages.homeUrl, e.g. "profile/README.md" from a git submodule.
	 * An unsafe homeUrl falls back to README.md.
	 */
	function pageSource(page, homeUrl) {
		if (page !== 'README.md' || homeUrl === undefined || homeUrl === 'README.md') {
			return page;
		}
		return isSafePath(homeUrl) && homeUrl.slice(-3) === '.md' ? homeUrl : 'README.md';
	}

	MarkdownPages.isSafePath = isSafePath;
	MarkdownPages.resolvePage = resolvePage;
	MarkdownPages.pageSource = pageSource;

	/** Markdown file of the home page, relative to index.html */
	MarkdownPages.homeUrl = 'README.md';

	// ---------------------------------------------------------------------
	// Conversion + sanitizing
	// ---------------------------------------------------------------------

	MarkdownPages.showdownOptions = {
		tables: true,
		emoji: true,
		ghCompatibleHeaderId: true,
		// "### Title {#id}" sets the id
		customizedHeaderId: true,
		simpleLineBreaks: true,
		strikethrough: true,
		tasklists: true,
		parseImgDimensions: true,
		// keep "..." as typed - Showdown would also turn it into "…" inside link URLs
		ellipsis: false,
	};

	// Showdown extensions (by name) registered by add-ons, e.g. forms
	MarkdownPages.extensions = [];

	// extra DOMPurify settings, add-ons may extend these
	MarkdownPages.sanitizeConfig = {
		ADD_ATTR: ['target'],
		FORBID_TAGS: ['style'],
	};

	var purifyConfigured = false;

	function configurePurify(DOMPurify) {
		if (purifyConfigured) {
			return;
		}
		purifyConfigured = true;
		// links opening a new window must not get access to window.opener
		DOMPurify.addHook('afterSanitizeAttributes', function (node) {
			if (node.tagName === 'A' && node.getAttribute('target')) {
				node.setAttribute('rel', 'noopener noreferrer');
			}
		});
		// DOMPurify drops ids that equal a document property (DOM clobbering
		// protection), e.g. "## Fonts" -> id="fonts". Anchor links to such
		// headings would break, so heading ids are kept when they are safe.
		DOMPurify.addHook('uponSanitizeAttribute', function (node, data) {
			if (data.attrName !== 'id') {
				return;
			}
			if (RESERVED_IDS.indexOf(String(data.attrValue).toLowerCase()) >= 0) {
				// never let content shadow the library globals (any element)
				data.keepAttr = false;
			} else if (/^H[1-6]$/.test(node.nodeName) && isSafeHeadingId(data.attrValue)) {
				data.forceKeepAttr = true;
			}
		});
	}

	// globals of markdown-pages.js and the example scripts that are checked
	// with "if (window.x)" before their script has loaded - an element with
	// such an id would be found via window named access instead
	var RESERVED_IDS = ['hljs', 'showdown', 'showdownforms', 'dompurify', 'markdownpages'];

	/**
	 * A heading id may be kept if it looks like a generated header id and is
	 * not reserved. Headings are not form/img/embed/object elements, so they
	 * cannot clobber document properties, and window named access never
	 * shadows existing window properties (e.g. "location", "name", "top").
	 */
	function isSafeHeadingId(id) {
		return typeof id === 'string'
			&& /^[a-z0-9][a-z0-9_-]{0,99}$/i.test(id)
			&& RESERVED_IDS.indexOf(id.toLowerCase()) < 0;
	}

	MarkdownPages.isSafeHeadingId = isSafeHeadingId;

	// ---------------------------------------------------------------------
	// Extended syntax (pure Showdown extensions, unit tested)
	// ---------------------------------------------------------------------
	//
	// Markdown Guide "extended syntax" that Showdown does not support itself:
	//   ==highlight==  H~2~O  x^2^
	//   footnote[^1]   [^1]: The note.
	//   Term
	//   : Definition
	// Custom heading ids ("### Title {#id}") use Showdown's customizedHeaderId.

	var FENCE = /^ {0,3}(`{3,}|~{3,})/;
	var DL_MARK = '\u0002mdpdl:';

	/** calls fn(line, index) for every line outside fenced code blocks; fn returns the new line or null to drop it */
	function mapLines(markdown, fn) {
		var fence = null;
		var out = [];
		var lines = markdown.split('\n');
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			var marker = FENCE.exec(line);
			if (fence) {
				if (marker && marker[1].charAt(0) === fence.charAt(0) && marker[1].length >= fence.length && !line.slice(marker[0].length).trim()) {
					fence = null;
				}
				out.push(line);
				continue;
			}
			if (marker) {
				fence = marker[1];
				out.push(line);
				continue;
			}
			var result = fn(line, i, lines);
			if (result !== null) {
				out.push(result);
			}
		}
		return out.join('\n');
	}

	/** replaces matches in a line, but not inside `code spans` */
	function replaceOutsideCode(line, pattern, replace) {
		return line.split(/(`+[^`]*`+)/).map(function (part, index) {
			return index % 2 ? part : part.replace(pattern, replace);
		}).join('');
	}

	/** like trimEnd(), without a /\s+$/ regex that is slow on long runs of spaces */
	function trimEnd(text) {
		var end = text.length;
		while (end > 0 && /\s/.test(text.charAt(end - 1))) {
			end--;
		}
		return text.slice(0, end);
	}

	function escapeAttribute(text) {
		return String(text).replace(/[^A-Za-z0-9_-]/g, '-');
	}

	/** footnotes: collects "[^id]: note" (with indented continuation lines), numbers the references in order of appearance */
	function footnotes(markdown) {
		var notes = {};
		var current = null;
		var DEFINITION = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]?(.*)$/;
		var text = mapLines(markdown, function (line) {
			var match = DEFINITION.exec(line);
			if (match) {
				current = match[1];
				notes[current] = [match[2]];
				return null;
			}
			if (current && (/^( {2,}|\t)/.test(line) || (!line.trim() && notes[current].length))) {
				notes[current].push(line.replace(/^( {1,4}|\t)/, ''));
				return null;
			}
			current = null;
			return line;
		});
		var order = [];
		var count = {};
		text = mapLines(text, function (line) {
			// ids cannot contain "[" or "^", so "[^[^[^…" fails fast
			return replaceOutsideCode(line, /\[\^([^\]\s[^]+)\](?!:)/g, function (all, id) {
				if (!notes.hasOwnProperty(id)) {
					return all;
				}
				if (order.indexOf(id) < 0) {
					order.push(id);
				}
				count[id] = (count[id] || 0) + 1;
				var key = escapeAttribute(id);
				var refId = 'fnref-' + key + (count[id] > 1 ? '-' + count[id] : '');
				return '<sup class="footnote-ref"><a href="#fn-' + key + '" id="' + refId + '">' + (order.indexOf(id) + 1) + '</a></sup>';
			});
		});
		if (!order.length) {
			return text;
		}
		var list = order.map(function (id, index) {
			var key = escapeAttribute(id);
			var body = trimEnd(notes[id].join('\n')).split('\n').join('\n    ');
			return (index + 1) + '. <span id="fn-' + key + '"></span>' + body + ' <a href="#fnref-' + key + '" class="footnote-backref" aria-label="Back to text">↩︎</a>';
		}).join('\n');
		return trimEnd(text) + '\n\n<section class="footnotes" markdown="1">\n\n<hr>\n\n' + list + '\n\n</section>\n';
	}

	/** definition lists: term lines followed by ": definition" lines become marked paragraphs, turned into <dl> by finishDefinitions */
	function definitions(markdown) {
		return mapLines(markdown, function (line, index, lines) {
			var definition = /^ {0,3}:[ \t]+(\S.*)$/.exec(line);
			if (definition) {
				var previous = lines[index - 1] || '';
				// only after a term or another definition
				return previous.trim() ? DL_MARK + 'dd ' + definition[1] : line;
			}
			var next = lines[index + 1] || '';
			if (line.trim() && !/^ {0,3}([#>|*+-]|\d+\.|:)/.test(line) && /^ {0,3}:[ \t]+\S/.test(next)) {
				return DL_MARK + 'dt ' + line.trim();
			}
			return line;
		});
	}

	/** turns the marked paragraphs of definitions() into <dl> */
	function finishDefinitions(html) {
		var mark = DL_MARK.replace(/[\u0002]/g, '\\u0002');
		var paragraph = new RegExp('<p>\\s*(' + mark + 'd[td] [\\s\\S]*?)</p>', 'g');
		return html.replace(paragraph, function (all, body) {
			var items = body.split(new RegExp('(?:<br\\s*/?>)?\\s*' + mark)).filter(function (item) {
				return item.trim();
			}).map(function (item) {
				item = item.replace(new RegExp('^' + mark), '');
				var tag = item.slice(0, 2);
				return '<' + tag + '>' + item.slice(3).trim() + '</' + tag + '>';
			});
			return '<dl>\n' + items.join('\n') + '\n</dl>';
		}).split(DL_MARK).join('');
	}

	/** ==highlight==, ~sub~ and ^sup^ in text, not inside code, pre or tags */
	function inlineMarks(html) {
		var depth = 0;
		return html.split(/(<[^<>]*>)/).map(function (part, index) {
			if (index % 2) {
				var tag = /^<(\/?)(code|pre|script|style|textarea)\b/i.exec(part);
				if (tag) {
					depth += tag[1] ? -1 : 1;
				}
				return part;
			}
			if (depth > 0) {
				return part;
			}
			return part
				.replace(/==(?=\S)([^=<]*?\S)==/g, '<mark>$1</mark>')
				// no spaces or "/" inside, so paths like /~user/~x stay as they are
				.replace(/(^|[^~\\/])~([^~\s<\/]+)~(?!~)/g, '$1<sub>$2</sub>')
				.replace(/(^|[^\\])\^([^\^\s<\/]+)\^/g, '$1<sup>$2</sup>');
		}).join('');
	}

	MarkdownPages.extendedSyntax = [
		{ type: 'lang', filter: function (text) { return definitions(footnotes(text)); } },
		{ type: 'output', filter: function (html) { return inlineMarks(finishDefinitions(html)); } },
	];

	function toHtml(markdown) {
		var extensions = (MarkdownPages.extendedSyntax || []).concat(MarkdownPages.extensions);
		var converter = new global.showdown.Converter({ extensions: extensions });
		Object.keys(MarkdownPages.showdownOptions).forEach(function (key) {
			converter.setOption(key, MarkdownPages.showdownOptions[key]);
		});
		var html = converter.makeHtml(markdown);
		configurePurify(global.DOMPurify);
		return global.DOMPurify.sanitize(html, MarkdownPages.sanitizeConfig);
	}

	MarkdownPages.toHtml = toHtml;

	// ---------------------------------------------------------------------
	// Forms - provided by @schreibtischhelden/showdown-forms (vendored)
	// ---------------------------------------------------------------------
	//
	// :::form action="https://example.com/submit" method="post"
	// Name* = ___
	// [[ Send ]]
	// :::
	//
	// The options keep the attributes markdown-pages.js used before:
	// data-mdp-form="local", data-mdp-name, ids "mdp-form-<n>" and the
	// "mdp:form-submit" event for forms without action.

	MarkdownPages.formsOptions = { idPrefix: 'mdp-form', dataPrefix: 'mdp' };
	MarkdownPages.formsExtension = null;

	/** registers the forms extension once showdown-forms is loaded */
	function setupForms(showdownForms) {
		if (MarkdownPages.formsExtension || !showdownForms) {
			return;
		}
		// one instance for the page, so form ids keep counting across regions
		MarkdownPages.formsExtension = showdownForms(MarkdownPages.formsOptions);
		Array.prototype.push.apply(MarkdownPages.extensions, MarkdownPages.formsExtension);
		if (typeof document !== 'undefined') {
			showdownForms.listen(document, MarkdownPages.formsOptions);
		}
	}

	function restoreFormNames(root) {
		if (global.showdownForms) {
			global.showdownForms.restoreNames(root, MarkdownPages.formsOptions);
		}
	}

	MarkdownPages.setupForms = setupForms;

	// ---------------------------------------------------------------------
	// Editor - optional, provided by @schreibtischhelden/markdown-pages-editor
	// (vendored, but only loaded when the page includes it)
	// ---------------------------------------------------------------------

	// defaults for every MarkdownPages.editor(), e.g. { toolbar: [...], labels: {...} }
	MarkdownPages.editorOptions = {};

	/**
	 * Creates a markdown-pages-editor whose preview is rendered like the site:
	 * toHtml (Showdown + DOMPurify + forms) and menu placeholders.
	 * Needs assets/vendor/markdown-pages-editor/markdown-pages-editor.js.
	 */
	function createEditor(target, options) {
		if (typeof global.markdownPagesEditor !== 'function') {
			throw new Error('markdown-pages.js: load assets/vendor/markdown-pages-editor/markdown-pages-editor.js to use MarkdownPages.editor()');
		}
		var merged = {};
		[MarkdownPages.editorOptions, options || {}].forEach(function (source) {
			Object.keys(source).forEach(function (key) {
				merged[key] = source[key];
			});
		});
		if (!merged.render) {
			merged.render = function (markdown) {
				return Promise.resolve(MarkdownPages.ready).then(function () {
					return toHtml(markdown);
				});
			};
		}
		var afterRender = merged.afterRender;
		merged.afterRender = function (element, editor) {
			restoreFormNames(element);
			return Promise.resolve(element).then(applyMenus).catch(function () {
				// a missing menu.json only leaves the placeholder empty
			}).then(function () {
				return typeof afterRender === 'function' ? afterRender(element, editor) : null;
			});
		};
		return global.markdownPagesEditor(target, merged);
	}

	MarkdownPages.editor = createEditor;

	// ---------------------------------------------------------------------
	// Menu (menu.json) - pure part, unit tested
	// ---------------------------------------------------------------------
	//
	// menu.json:
	// { "main": [
	//     { "title": "Home", "href": "." },
	//     { "title": "Docs", "id": "docs", "page": "docs", "children": [
	//         { "title": "Install", "page": "install" } ] },
	//     { "title": "GitHub", "href": "https://github.com/..." } ] }
	//
	// Placeholders (in any Markdown file, also header.md / footer.md):
	//   {{menu:main}}       top-level items of the main menu
	//   {{menu:tree}}       the whole menu with all levels (e.g. grouped docs navigation)
	//   {{menu:sub:<id>}}   children of the main menu item with that id
	//   {{menu:current}}    children of the main menu item that contains the current page
	//   {{toc}}             table of contents (h2/h3) of the current page
	//
	// Elements outside the rendered regions (e.g. a sidebar in index.html)
	// can use <nav data-mdp-menu="tree"></nav> and <nav data-mdp-toc></nav>.
	// data-mdp-menu-toc on a menu adds the sections of the current page below
	// its current item, see "Table of contents" below.

	MarkdownPages.menuUrl = 'menu.json';

	var PLACEHOLDER = /\{\{\s*(?:menu:(main|tree|current|sub:([A-Za-z0-9_-]+))|(toc))\s*\}\}/g;
	var SAFE_HREF = /^(https?:|mailto:|[^:]*$)/i; // absolute http(s)/mailto, or no scheme at all
	var MAX_DEPTH = 5;

	function slug(text) {
		var result = String(text).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
		// trim dashes without a regex (avoids polynomial backtracking on "----...")
		var start = 0;
		var end = result.length;
		while (start < end && result.charAt(start) === '-') {
			start++;
		}
		while (end > start && result.charAt(end - 1) === '-') {
			end--;
		}
		return result.slice(start, end);
	}

	/** href of a menu item, or null if it has no valid target */
	function menuItemHref(item) {
		if (typeof item.page === 'string') {
			var page = item.page.replace(/\.md$/, '');
			return isSafePath(page) ? '?page=' + page : null;
		}
		if (typeof item.href === 'string') {
			var href = item.href.trim();
			// "//host" would be protocol-relative, control characters are never valid
			if (/^\/\//.test(href) || /[\u0000-\u001f\u007f]/.test(href)) {
				return null;
			}
			return SAFE_HREF.test(href) ? href : null;
		}
		return null;
	}

	/** Markdown file a menu item points to (for "current page"), or null */
	function menuItemFile(item) {
		var href = menuItemHref(item);
		if (href === null) {
			return null;
		}
		if (href === '.' || href === './' || href === '' || href === 'index.html' || href === './index.html') {
			return 'README.md';
		}
		if (href.charAt(0) === '?') {
			return resolvePage(href);
		}
		return null;
	}

	/**
	 * Validates and normalises the parsed menu.json. Invalid entries are
	 * dropped instead of breaking the whole menu.
	 */
	function normalizeMenu(data) {
		function items(list, depth) {
			if (!Array.isArray(list) || depth > MAX_DEPTH) {
				return [];
			}
			return list.reduce(function (result, raw) {
				if (!raw || typeof raw !== 'object' || typeof raw.title !== 'string' || !raw.title.trim()) {
					return result;
				}
				var item = {
					title: raw.title.trim(),
					id: typeof raw.id === 'string' && /^[A-Za-z0-9_-]+$/.test(raw.id)
						? raw.id
						: slug(typeof raw.page === 'string' ? raw.page : raw.title),
					href: menuItemHref(raw),
					file: menuItemFile(raw),
					children: items(raw.children, depth + 1),
				};
				if (item.href !== null || item.children.length) {
					result.push(item);
				}
				return result;
			}, []);
		}
		return { main: items(data && data.main, 0) };
	}

	function containsFile(item, file) {
		return item.file === file || item.children.some(function (child) {
			return containsFile(child, file);
		});
	}

	/**
	 * Returns the list of items to show for a placeholder:
	 *   "main", "tree", "current" or "sub:<id>"
	 */
	function menuItemsFor(menu, kind, currentFile) {
		if (kind === 'main' || kind === 'tree') {
			return menu.main;
		}
		var parent = null;
		if (kind === 'current') {
			parent = menu.main.filter(function (item) {
				return containsFile(item, currentFile);
			})[0];
		} else if (kind.indexOf('sub:') === 0) {
			var id = kind.slice(4);
			parent = menu.main.filter(function (item) {
				return item.id === id;
			})[0];
		}
		return parent ? parent.children : [];
	}

	/**
	 * Parses the text of menu.json. Throws if it is not valid JSON or has no
	 * "main" array, so the caller can fall back to the hand-written navigation.
	 */
	function parseMenu(text) {
		var data = JSON.parse(text);
		if (!data || typeof data !== 'object' || !Array.isArray(data.main)) {
			throw new Error('"main" must be an array');
		}
		return normalizeMenu(data);
	}

	MarkdownPages.normalizeMenu = normalizeMenu;
	MarkdownPages.parseMenu = parseMenu;
	MarkdownPages.menuItemsFor = menuItemsFor;

	/**
	 * All items with a link in menu order (depth first) - used for
	 * previous/next navigation and search. "section" is the title of the
	 * top-level item an entry belongs to (null for top-level items).
	 */
	function flattenMenu(menu) {
		var result = [];
		(function walk(items, section) {
			items.forEach(function (item) {
				if (item.href !== null) {
					result.push({ title: item.title, href: item.href, file: item.file, section: section });
				}
				walk(item.children, section === null ? item.title : section);
			});
		})(menu && menu.main ? menu.main : [], null);
		return result;
	}

	MarkdownPages.flattenMenu = flattenMenu;

	// ---------------------------------------------------------------------
	// Menu - DOM part
	// ---------------------------------------------------------------------

	var menuPromise = null;

	function loadMenu() {
		if (!menuPromise) {
			// menu.json is optional: any failure (missing file, network error,
			// invalid JSON or structure) resolves to null -> fallback navigation
			menuPromise = Promise.resolve().then(function () {
				return fetchText(MarkdownPages.menuUrl);
			}).then(function (text) {
				if (text === null) {
					throw new Error(MarkdownPages.menuUrl + ' not found');
				}
				return parseMenu(text);
			}).catch(function (error) {
				console.info('markdown-pages.js: no menu, using fallback navigation (' + error.message + ')');
				return null;
			});
		}
		return menuPromise;
	}

	/** builds <ul> with DOM APIs only - titles are never parsed as HTML */
	function buildList(items, currentFile, nested) {
		var ul = document.createElement('ul');
		items.forEach(function (item) {
			var li = document.createElement('li');
			var label;
			if (item.href !== null) {
				label = document.createElement('a');
				label.setAttribute('href', item.href);
				if (/^https?:/i.test(item.href)) {
					label.setAttribute('rel', 'noopener noreferrer');
				}
			} else {
				label = document.createElement('span');
			}
			label.textContent = item.title;
			if (item.file !== null && item.file === currentFile) {
				label.setAttribute('aria-current', 'page');
				li.className = 'mdp-menu-item-current';
			} else if (containsFile(item, currentFile)) {
				li.className = 'mdp-menu-item-active';
			}
			li.appendChild(label);
			if (nested && item.children.length) {
				li.appendChild(buildList(item.children, currentFile, nested));
			}
			ul.appendChild(li);
		});
		return ul;
	}

	/**
	 * Replaces {{menu:...}} placeholders in text nodes (outside of code) with
	 * <nav data-mdp-menu="..."> elements, then fills all such elements.
	 */
	function applyMenus(root) {
		var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
			acceptNode: function (node) {
				return node.parentNode.closest('code, pre, script, style, textarea')
					? NodeFilter.FILTER_REJECT
					: NodeFilter.FILTER_ACCEPT;
			},
		});
		var textNodes = [];
		while (walker.nextNode()) {
			PLACEHOLDER.lastIndex = 0;
			if (PLACEHOLDER.test(walker.currentNode.nodeValue)) {
				textNodes.push(walker.currentNode);
			}
		}

		textNodes.forEach(function (node) {
			var fragment = document.createDocumentFragment();
			var text = node.nodeValue;
			var last = 0;
			text.replace(PLACEHOLDER, function (match, kind, id, toc, offset) {
				fragment.appendChild(document.createTextNode(text.slice(last, offset)));
				var nav = document.createElement('nav');
				nav.setAttribute(toc ? 'data-mdp-toc' : 'data-mdp-menu', toc ? '' : kind);
				fragment.appendChild(nav);
				last = offset + match.length;
				return match;
			});
			fragment.appendChild(document.createTextNode(text.slice(last)));
			var parent = node.parentNode;
			// a paragraph that only holds the placeholder is replaced entirely
			if (parent.tagName === 'P' && parent.childNodes.length === 1 && !text.replace(PLACEHOLDER, '').trim()) {
				parent.replaceWith(fragment);
			} else {
				parent.replaceChild(fragment, node);
			}
		});

		return fillMenus(root.querySelectorAll('[data-mdp-menu]'), root);
	}

	/** fills the given <nav data-mdp-menu> elements from menu.json */
	function fillMenus(navs, root) {
		if (!navs.length) {
			return Promise.resolve();
		}
		return loadMenu().then(function (menu) {
			if (menu === null) {
				// no usable menu.json: drop the placeholders, keep the hand-written navigation
				navs.forEach(function (nav) {
					nav.remove();
				});
				return;
			}
			// menu.json loaded: hand-written navigation marked as fallback is replaced
			root.querySelectorAll('[data-mdp-menu-fallback]').forEach(function (element) {
				element.remove();
			});
			var currentFile = resolvePage(global.location.search);
			navs.forEach(function (nav) {
				var kind = nav.getAttribute('data-mdp-menu');
				var items = menuItemsFor(menu, kind, currentFile);
				nav.className = 'mdp-menu mdp-menu-' + kind.split(':')[0];
				if (!nav.hasAttribute('aria-label')) {
					nav.setAttribute('aria-label', kind === 'main' || kind === 'tree' ? 'Main menu' : 'Submenu');
				}
				nav.textContent = '';
				if (items.length) {
					nav.appendChild(buildList(items, currentFile, kind !== 'main'));
					if (nav.hasAttribute('data-mdp-menu-toc')) {
						fillMenuToc(nav, mainTocEntries());
					}
				} else {
					nav.hidden = true;
				}
			});
			watchToc();
		});
	}

	MarkdownPages.applyMenus = applyMenus;
	MarkdownPages.loadMenu = loadMenu;

	/** menus placed directly in index.html, outside header/main/footer */
	function applyStaticMenus() {
		var navs = Array.prototype.filter.call(document.querySelectorAll('[data-mdp-menu]'), function (nav) {
			return !nav.closest('header, main, footer');
		});
		var sidebar = document.createDocumentFragment(); // no fallback elements to remove here
		return fillMenus(navs, sidebar).catch(function (error) {
			console.error('markdown-pages.js: menu', error);
		});
	}

	// ---------------------------------------------------------------------
	// Table of contents
	// ---------------------------------------------------------------------
	//
	//   <nav data-mdp-toc></nav>                        h2/h3 of <main>
	//   <nav data-mdp-toc data-mdp-toc-live></nav>      ... rebuilt when <main> changes
	//   <nav data-mdp-menu="tree" data-mdp-menu-toc>    h2/h3 below the current menu item
	//
	// Hidden headings (hidden attribute, or inside a [hidden] element) are
	// left out, so pages that show or hide sections at runtime stay in sync.

	/** whether an element or one of its ancestors up to (excluding) root is hidden */
	function isHidden(element, root) {
		for (var node = element; node && node !== root; node = node.parentNode) {
			if (node.hasAttribute && node.hasAttribute('hidden')) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Turns h2/h3 elements (in document order) into a nested list of
	 * { id, title, children }. Hidden headings and headings without id are
	 * skipped; an h3 whose h2 is skipped moves up to the top level.
	 */
	function tocEntries(headings, root) {
		var result = [];
		var current = null;
		Array.prototype.forEach.call(headings, function (heading) {
			var isH3 = heading.tagName === 'H3';
			if (!heading.id || isHidden(heading, root)) {
				if (!isH3) {
					current = null;
				}
				return;
			}
			var entry = { id: heading.id, title: heading.textContent, children: [] };
			if (isH3 && current) {
				current.children.push(entry);
			} else {
				result.push(entry);
				current = isH3 ? null : entry;
			}
		});
		return result;
	}

	MarkdownPages.isHidden = isHidden;
	MarkdownPages.tocEntries = tocEntries;

	/** builds the <ul> of a table of contents with DOM APIs only */
	function buildTocList(entries) {
		var ul = document.createElement('ul');
		entries.forEach(function (entry) {
			var li = document.createElement('li');
			var a = document.createElement('a');
			a.setAttribute('href', '#' + encodeURIComponent(entry.id));
			a.textContent = entry.title;
			li.appendChild(a);
			if (entry.children.length) {
				li.appendChild(buildTocList(entry.children));
			}
			ul.appendChild(li);
		});
		return ul;
	}

	function mainTocEntries() {
		var main = document.querySelector('main');
		return main ? tocEntries(main.querySelectorAll('h2, h3'), main) : [];
	}

	/** puts the entries below the current item of a <nav data-mdp-menu-toc> */
	function fillMenuToc(nav, entries) {
		var item = nav.querySelector('li.mdp-menu-item-current');
		var old = nav.querySelector('ul.mdp-menu-toc');
		if (old) {
			old.remove();
		}
		if (!item || !entries.length) {
			return;
		}
		var list = buildTocList(entries);
		list.className = 'mdp-menu-toc';
		// after the link, before the list of subpages (if any)
		item.insertBefore(list, item.firstChild ? item.firstChild.nextSibling : null);
	}

	/**
	 * Fills <nav data-mdp-toc> elements and the page sections of
	 * <nav data-mdp-menu-toc> menus with the visible h2/h3 headings of <main>.
	 * Built with DOM APIs only; headings without id are skipped.
	 */
	function buildToc() {
		var entries = mainTocEntries();
		lastTocKey = JSON.stringify(entries);
		document.querySelectorAll('[data-mdp-toc]').forEach(function (nav) {
			nav.textContent = '';
			nav.className = 'mdp-toc';
			if (!nav.hasAttribute('aria-label')) {
				nav.setAttribute('aria-label', 'Table of contents');
			}
			nav.hidden = !entries.length;
			nav.appendChild(buildTocList(entries));
		});
		document.querySelectorAll('[data-mdp-menu-toc]').forEach(function (nav) {
			fillMenuToc(nav, entries);
		});
	}

	MarkdownPages.buildToc = buildToc;

	// live mode: rebuild when headings are shown, hidden, added or removed

	var LIVE_SELECTOR = '[data-mdp-toc][data-mdp-toc-live], [data-mdp-menu-toc][data-mdp-toc-live]';
	var tocObserver = null;
	var lastTocKey = null;

	/** mutations of the generated navigation itself must not trigger a rebuild */
	function isOwnMutation(record) {
		var target = record.target;
		return !!(target && target.closest && target.closest('[data-mdp-toc], [data-mdp-menu]'));
	}

	/**
	 * Starts a debounced MutationObserver on <main> if a live table of
	 * contents exists. Runs once; later calls do nothing. Returns whether
	 * the observer is active.
	 */
	function watchToc() {
		if (tocObserver) {
			return true;
		}
		var main = document.querySelector('main');
		if (!main || typeof global.MutationObserver !== 'function' || !document.querySelector(LIVE_SELECTOR)) {
			return false;
		}
		var timer = null;
		tocObserver = new global.MutationObserver(function (records) {
			if (records.every(isOwnMutation)) {
				return;
			}
			global.clearTimeout(timer);
			timer = global.setTimeout(function () {
				// skip the DOM work if the visible headings did not change
				if (JSON.stringify(mainTocEntries()) !== lastTocKey) {
					buildToc();
				}
			}, MarkdownPages.tocDelay);
		});
		tocObserver.observe(main, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
		return true;
	}

	/** delay (ms) before a live table of contents is rebuilt */
	MarkdownPages.tocDelay = 50;
	MarkdownPages.watchToc = watchToc;

	// ---------------------------------------------------------------------
	// Browser runtime
	// ---------------------------------------------------------------------

	function loadScript(src) {
		return new Promise(function (resolve, reject) {
			var script = document.createElement('script');
			script.src = src;
			script.onload = resolve;
			script.onerror = function () {
				reject(new Error('could not load ' + src));
			};
			document.head.appendChild(script);
		});
	}

	function fetchText(path) {
		// resolve against the page and refuse anything that leaves the origin
		var url = new URL(path, global.location.href);
		if (url.origin !== global.location.origin) {
			return Promise.resolve(null);
		}
		return fetch(url.href, { credentials: 'same-origin' }).then(function (response) {
			return response.ok ? response.text() : null;
		});
	}

	function render(selector, markdown, page) {
		var element = document.querySelector(selector);
		if (!element) {
			return;
		}
		element.innerHTML = toHtml(markdown);
		restoreFormNames(element);
		return applyMenus(element).catch(function (error) {
			console.error('markdown-pages.js: menu', error);
		}).then(function () {
			if (selector === 'main') {
				buildToc();
			}
			watchToc();
			document.dispatchEvent(new CustomEvent('mdp:rendered', {
				detail: { region: selector, page: page },
			}));
		});
	}

	function renderMain(page) {
		var request = page ? fetchText(pageSource(page, MarkdownPages.homeUrl)) : Promise.resolve(null);
		return request.then(function (markdown) {
			if (markdown !== null) {
				return markdown;
			}
			page = '404.md';
			return fetchText('404.md').then(function (notFound) {
				return notFound !== null ? notFound : '# Page not found\n\nThe requested page does not exist.';
			});
		}).then(function (markdown) {
			var rendered = render('main', markdown, page);
			var h1 = document.querySelector('main h1');
			if (h1) {
				document.title = h1.textContent + ' | ' + document.title;
			}
			var hash = global.location.hash.substring(1);
			try {
				hash = decodeURIComponent(hash);
			} catch (e) {
				// keep the raw hash if it is not valid percent-encoding
			}
			var target = hash && document.getElementById(hash);
			if (target) {
				target.scrollIntoView();
			}
			return rendered;
		});
	}

	function renderRegion(file, selector) {
		return fetchText(file).then(function (markdown) {
			if (markdown) {
				render(selector, markdown, file);
			}
		});
	}

	function start() {
		// resolve vendored libraries relative to this file, so it also works
		// when markdown-pages.js is loaded from another directory or a CDN
		var base = new URL('.', document.currentScript.src);
		var vendor = function (path) {
			return new URL('assets/vendor/' + path, base).href;
		};
		MarkdownPages.baseUrl = base.href;

		MarkdownPages.ready = Promise.all([
			loadScript(vendor('showdown/showdown.min.js')),
			loadScript(vendor('dompurify/purify.min.js')),
			loadScript(vendor('showdown-forms/showdown-forms.js')),
		]).then(function () {
			setupForms(global.showdownForms);
			var onDom = document.readyState === 'loading'
				? new Promise(function (resolve) { document.addEventListener('DOMContentLoaded', resolve); })
				: Promise.resolve();
			return onDom;
		}).then(function () {
			return Promise.all([
				renderMain(resolvePage(global.location.search)),
				renderRegion('header.md', 'header'),
				renderRegion('footer.md', 'footer'),
				applyStaticMenus(),
			]);
		}).catch(function (error) {
			console.error('markdown-pages.js:', error);
		});
	}

	global.MarkdownPages = MarkdownPages;

	if (typeof document !== 'undefined' && document.currentScript) {
		start();
	}
})(typeof window !== 'undefined' ? window : globalThis);

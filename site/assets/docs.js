/* openLitfass docs: navigation, table of contents, search, code
   highlighting and theme switch on top of markdown-pages.js, which fills
   <header>, <main> and <footer> asynchronously and announces each region
   with the event "mdp:rendered". */
(function () {
	'use strict';

	var REPO = 'https://github.com/schreibtischhelden/openlitfass-docs';
	var THEME_KEY = 'ol-docs-theme';
	var params = new URLSearchParams(window.location.search);
	var currentPage = params.get('page') || '';

	function onRendered(region, callback) {
		var done = false;
		document.addEventListener('mdp:rendered', function (event) {
			if (done || !event.detail || event.detail.region !== region) return;
			done = true;
			callback(document.querySelector(region), event.detail.page);
		});
	}

	function vendorUrl(path) {
		var base = (window.MarkdownPages && window.MarkdownPages.baseUrl) || document.baseURI;
		return new URL('assets/vendor/' + path, base).href;
	}

	function pageOf(href) {
		if (href === '.' || href === './') return '';
		var match = /[?&]page=([^&#]+)/.exec(href || '');
		return match ? decodeURIComponent(match[1]) : null;
	}

	function sourceFile(page) {
		return page ? 'pages/' + page + '.md' : 'README.md';
	}

	function fold(text) {
		return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
	}

	function storedTheme() {
		try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
	}

	function systemTheme() {
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}

	/* sidebar */

	function enhanceSidebar(header) {
		var nav = document.createElement('nav');
		nav.setAttribute('aria-label', 'Documentation');
		Array.prototype.slice.call(header.children).forEach(function (child) {
			if (child.tagName === 'H4' || child.tagName === 'UL') nav.appendChild(child);
		});
		header.appendChild(nav);

		nav.querySelectorAll('a').forEach(function (link) {
			if (pageOf(link.getAttribute('href')) === currentPage) link.setAttribute('aria-current', 'page');
		});

		var toggle = document.createElement('button');
		toggle.type = 'button';
		toggle.className = 'theme-toggle';
		function label() {
			var theme = document.documentElement.getAttribute('data-theme') || systemTheme();
			toggle.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
		}
		toggle.addEventListener('click', function () {
			var next = (document.documentElement.getAttribute('data-theme') || systemTheme()) === 'dark' ? 'light' : 'dark';
			if (next === systemTheme()) {
				document.documentElement.removeAttribute('data-theme');
				try { localStorage.removeItem(THEME_KEY); } catch (e) {}
			} else {
				document.documentElement.setAttribute('data-theme', next);
				try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
			}
			label();
		});
		label();
		header.appendChild(toggle);

		setUpSearch(header, nav);
	}

	function setUpMenuToggle() {
		var button = document.querySelector('.menu-toggle');
		var header = document.querySelector('header');
		if (!button || !header) return;
		button.addEventListener('click', function () {
			var open = header.classList.toggle('open');
			button.setAttribute('aria-expanded', String(open));
		});
	}

	/* search: loads the pages listed in the sidebar on first use */

	function setUpSearch(header, nav) {
		var input = header.querySelector('#search-input');
		var results = header.querySelector('#search-results');
		if (!input || !results) return;
		var index = null;
		var loading = null;

		var pages = [];
		nav.querySelectorAll('a').forEach(function (link) {
			var page = pageOf(link.getAttribute('href'));
			if (page !== null) pages.push({ page: page, title: link.textContent });
		});

		function buildIndex() {
			if (loading) return loading;
			loading = Promise.all(pages.map(function (p) {
				return fetch(sourceFile(p.page)).then(function (r) { return r.ok ? r.text() : ''; }).then(function (md) {
					// the renderer's own conversion, so heading ids match the pages
					var doc = new DOMParser().parseFromString(window.MarkdownPages.toHtml(md), 'text/html');
					var sections = [];
					var section = { id: '', heading: p.title, text: '' };
					Array.prototype.forEach.call(doc.body.children, function (el) {
						if (/^H[1-3]$/.test(el.tagName)) {
							sections.push(section);
							section = { id: el.tagName === 'H1' ? '' : el.id, heading: el.textContent, text: '' };
						} else {
							section.text += ' ' + el.textContent;
						}
					});
					sections.push(section);
					return sections.filter(function (s) { return s.heading || s.text.trim(); }).map(function (s) {
						return { page: p.page, pageTitle: p.title, id: s.id, heading: s.heading,
							headingKey: fold(s.heading), textKey: fold(s.text) };
					});
				}).catch(function () { return []; });
			})).then(function (lists) {
				index = [].concat.apply([], lists);
				return index;
			});
			return loading;
		}

		function hrefOf(entry) {
			return (entry.page ? '?page=' + encodeURIComponent(entry.page) : '.') + (entry.id ? '#' + entry.id : '');
		}

		function render(query) {
			var terms = fold(query).split(/\s+/).filter(Boolean);
			results.textContent = '';
			if (!terms.length) { results.hidden = true; return; }
			var hits = index.map(function (entry) {
				var score = 0;
				for (var i = 0; i < terms.length; i++) {
					var inHeading = entry.headingKey.indexOf(terms[i]) !== -1;
					if (!inHeading && entry.textKey.indexOf(terms[i]) === -1) return null;
					score += inHeading ? 10 : 1;
				}
				var phrase = terms.join(' ');
				if (terms.length > 1 && (entry.headingKey + ' ' + entry.textKey).indexOf(phrase) !== -1) score += 20;
				return { entry: entry, score: score };
			}).filter(Boolean).sort(function (a, b) { return b.score - a.score; }).slice(0, 15);

			if (!hits.length) {
				var none = document.createElement('p');
				none.textContent = 'No results.';
				results.appendChild(none);
			}
			hits.forEach(function (hit) {
				var a = document.createElement('a');
				a.href = hrefOf(hit.entry);
				a.textContent = hit.entry.heading;
				if (hit.entry.heading !== hit.entry.pageTitle) {
					var small = document.createElement('small');
					small.textContent = hit.entry.pageTitle;
					a.appendChild(small);
				}
				results.appendChild(a);
			});
			results.hidden = false;
		}

		input.addEventListener('input', function () {
			var query = input.value;
			buildIndex().then(function () { if (input.value === query) render(query); });
		});
		input.addEventListener('focus', buildIndex, { once: true });
		input.addEventListener('keydown', function (event) {
			if (event.key === 'Escape') {
				input.value = '';
				results.hidden = true;
			} else if (event.key === 'Enter') {
				var first = results.querySelector('a');
				if (first) window.location.href = first.href;
			} else if (event.key === 'ArrowDown') {
				var link = results.querySelector('a');
				if (link) { event.preventDefault(); link.focus(); }
			}
		});
		results.addEventListener('keydown', function (event) {
			var target = event.target;
			if (event.key === 'ArrowDown' && target.nextElementSibling) {
				event.preventDefault(); target.nextElementSibling.focus();
			} else if (event.key === 'ArrowUp') {
				event.preventDefault();
				(target.previousElementSibling || input).focus();
			} else if (event.key === 'Escape') {
				input.focus();
			}
		});
	}

	/* content */

	function enhanceContent(main, notFound) {
		var headings = main.querySelectorAll('h2[id], h3[id]');
		headings.forEach(function (h) {
			var anchor = document.createElement('a');
			anchor.className = 'anchor';
			anchor.href = '#' + h.id;
			anchor.setAttribute('aria-label', 'Link to this section');
			anchor.textContent = '#';
			h.appendChild(anchor);
		});

		main.querySelectorAll('blockquote').forEach(function (quote) {
			var first = quote.querySelector('strong');
			if (first && /^(Warning|Caution)\b/.test(first.textContent)) quote.classList.add('warning');
		});

		var h2s = main.querySelectorAll('h2[id]');
		if (h2s.length >= 3) {
			var toc = document.createElement('nav');
			toc.className = 'toc';
			toc.setAttribute('aria-label', 'On this page');
			var title = document.createElement('strong');
			title.textContent = 'On this page';
			toc.appendChild(title);
			var list = document.createElement('ul');
			var sub = null;
			headings.forEach(function (h) {
				var li = document.createElement('li');
				var a = document.createElement('a');
				a.href = '#' + h.id;
				a.textContent = h.firstChild.textContent;
				li.appendChild(a);
				if (h.tagName === 'H2') {
					list.appendChild(li);
					sub = null;
				} else if (list.lastElementChild) {
					if (!sub) {
						sub = document.createElement('ul');
						list.lastElementChild.appendChild(sub);
					}
					sub.appendChild(li);
				}
			});
			toc.appendChild(list);
			main.insertBefore(toc, h2s[0]);
		}

		if (!notFound) {
			var meta = document.createElement('p');
			meta.className = 'page-meta';
			var edit = document.createElement('a');
			edit.href = REPO + '/edit/main/site/' + sourceFile(currentPage);
			edit.textContent = 'Edit this page on GitHub';
			meta.appendChild(edit);
			main.appendChild(meta);
		}

		if (window.location.hash) {
			var target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
			if (target) target.scrollIntoView();
		}
	}

	/* code highlighting: highlight.js comes with markdown-pages.js and is
	   loaded only on pages with code blocks in a known language */

	function highlightCode(main) {
		var blocks = Array.prototype.filter.call(main.querySelectorAll('pre code[class]'), function (code) {
			return /language-[\w-]+/.test(code.className);
		});
		if (!blocks.length) return;
		var script = document.createElement('script');
		script.src = vendorUrl('highlightjs/highlight.min.js');
		script.onload = function () {
			blocks.forEach(function (code) {
				var language = /language-([\w-]+)/.exec(code.className)[1];
				if (window.hljs.getLanguage(language)) window.hljs.highlightElement(code);
			});
		};
		document.head.appendChild(script);
	}

	setUpMenuToggle();
	onRendered('header', enhanceSidebar);
	onRendered('main', function (main, page) {
		enhanceContent(main, page === '404.md');
		highlightCode(main);
	});
})();

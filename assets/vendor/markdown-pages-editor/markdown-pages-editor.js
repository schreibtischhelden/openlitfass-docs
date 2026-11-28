/*!
 * markdown-pages-editor - lightweight, configurable Markdown editor with live preview
 * https://github.com/schreibtischhelden/markdown-pages-editor
 * MIT License
 *
 * A <textarea> with a toolbar and an optional preview. It has no
 * dependencies and does not convert Markdown itself: the preview uses the
 * render function you pass (e.g. Showdown + DOMPurify), so it looks exactly
 * like your site. Nothing is sent anywhere.
 */
(function (root, factory) {
	if (typeof module === 'object' && module.exports) {
		module.exports = factory();
	} else if (typeof define === 'function' && define.amd) {
		define([], factory);
	} else {
		root.markdownPagesEditor = factory();
	}
})(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	// ---------------------------------------------------------------------
	// Text commands (pure, unit tested)
	// ---------------------------------------------------------------------
	//
	// A command gets the text and the selection { value, start, end } and
	// returns one edit { from, to, text } plus the new selection
	// { start, end }. Applying a single edit keeps the browser's undo history.

	function lineStart(value, index) {
		return value.lastIndexOf('\n', index - 1) + 1;
	}

	function lineEnd(value, index) {
		var end = value.indexOf('\n', index);
		return end < 0 ? value.length : end;
	}

	/** full lines touched by the selection; a selection ending at the start of a line does not include it */
	function selectedLines(state) {
		var end = state.end > state.start && state.value.charAt(state.end - 1) === '\n' ? state.end - 1 : state.end;
		var from = lineStart(state.value, state.start);
		var to = lineEnd(state.value, end);
		return { from: from, to: to, lines: state.value.slice(from, to).split('\n') };
	}

	/** wraps the selection in before/after, or removes them if they are already there */
	function wrap(state, before, after, placeholder) {
		var value = state.value;
		var selected = value.slice(state.start, state.end);
		var outer = state.start >= before.length
			&& value.slice(state.start - before.length, state.start) === before
			&& value.slice(state.end, state.end + after.length) === after;
		if (outer) {
			return {
				from: state.start - before.length,
				to: state.end + after.length,
				text: selected,
				start: state.start - before.length,
				end: state.end - before.length,
			};
		}
		var inner = selected.length >= before.length + after.length
			&& selected.slice(0, before.length) === before
			&& selected.slice(selected.length - after.length) === after;
		if (inner) {
			var stripped = selected.slice(before.length, selected.length - after.length);
			return { from: state.start, to: state.end, text: stripped, start: state.start, end: state.start + stripped.length };
		}
		var text = selected || placeholder;
		return {
			from: state.start,
			to: state.end,
			text: before + text + after,
			start: state.start + before.length,
			end: state.start + before.length + text.length,
		};
	}

	/** replaces the selected lines with mapLines(lines) and selects them */
	function editLines(state, mapLines) {
		var range = selectedLines(state);
		var text = mapLines(range.lines).join('\n');
		var single = range.lines.length === 1 && state.start === state.end;
		var cursor = single ? range.from + text.length : range.from;
		return { from: range.from, to: range.to, text: text, start: cursor, end: range.from + text.length };
	}

	/** adds a prefix to every selected line, or removes it if all lines have it */
	function prefixLines(state, prefix) {
		return editLines(state, function (lines) {
			var all = lines.every(function (line) {
				return line.slice(0, prefix.length) === prefix;
			});
			return lines.map(function (line) {
				return all ? line.slice(prefix.length) : prefix + line;
			});
		});
	}

	var NUMBERED = /^\d+\.\s/;

	function numberedList(state) {
		return editLines(state, function (lines) {
			var all = lines.every(function (line) {
				return NUMBERED.test(line);
			});
			return lines.map(function (line, index) {
				return all ? line.replace(NUMBERED, '') : (index + 1) + '. ' + line;
			});
		});
	}

	/** cycles the heading level of the selected lines: none -> ## -> ### -> none */
	function heading(state) {
		return editLines(state, function (lines) {
			var match = /^(#{1,6}) /.exec(lines[0]);
			var level = match ? match[1].length : 0;
			var next = level === 0 ? 2 : level >= 3 ? 0 : level + 1;
			return lines.map(function (line) {
				var text = line.replace(/^#{1,6} /, '');
				return next ? new Array(next + 1).join('#') + ' ' + text : text;
			});
		});
	}

	function link(state) {
		var selected = state.value.slice(state.start, state.end);
		if (/^(https?:\/\/|mailto:|\?|\.\/)\S*$/.test(selected)) {
			// the selection is the address: ask for the text
			return {
				from: state.start,
				to: state.end,
				text: '[link text](' + selected + ')',
				start: state.start + 1,
				end: state.start + 10,
			};
		}
		var text = selected || 'link text';
		var url = 'https://';
		var urlStart = state.start + text.length + 3;
		return {
			from: state.start,
			to: state.end,
			text: '[' + text + '](' + url + ')',
			start: urlStart,
			end: urlStart + url.length,
		};
	}

	/** inline code, or a fenced block when the selection spans lines */
	function code(state) {
		var selected = state.value.slice(state.start, state.end);
		if (selected.indexOf('\n') < 0) {
			return wrap(state, '`', '`', 'code');
		}
		var from = lineStart(state.value, state.start);
		var to = selectedLines(state).to;
		var body = state.value.slice(from, to);
		var text = '```\n' + body + '\n```';
		return { from: from, to: to, text: text, start: from + 4, end: from + 4 + body.length };
	}

	/** horizontal rule after the line of the cursor */
	function rule(state) {
		var at = lineEnd(state.value, state.end);
		var text = (at > 0 ? '\n\n' : '') + '---\n';
		return { from: at, to: at, text: text, start: at + text.length, end: at + text.length };
	}

	/**
	 * Built-in commands. text: visible button text, label: accessible name
	 * (see LABELS), shortcut: key with Ctrl/Cmd.
	 */
	var COMMANDS = {
		bold: { text: 'B', shortcut: 'b', run: function (state) { return wrap(state, '**', '**', 'bold text'); } },
		italic: { text: 'I', shortcut: 'i', run: function (state) { return wrap(state, '_', '_', 'italic text'); } },
		strikethrough: { text: 'S', run: function (state) { return wrap(state, '~~', '~~', 'text'); } },
		heading: { text: 'H', run: heading },
		link: { text: 'Link', shortcut: 'k', run: link },
		code: { text: '</>', run: code },
		quote: { text: '“', run: function (state) { return prefixLines(state, '> '); } },
		list: { text: '•', run: function (state) { return prefixLines(state, '- '); } },
		numbered: { text: '1.', run: numberedList },
		tasks: { text: '☐', run: function (state) { return prefixLines(state, '- [ ] '); } },
		rule: { text: '—', run: rule },
	};

	var DEFAULT_TOOLBAR = ['bold', 'italic', 'heading', '|', 'link', 'code', '|', 'quote', 'list', 'numbered'];
	var MODES = ['write', 'split', 'preview'];

	var LABELS = {
		toolbar: 'Formatting',
		bold: 'Bold',
		italic: 'Italic',
		strikethrough: 'Strikethrough',
		heading: 'Heading',
		link: 'Link',
		code: 'Code',
		quote: 'Quote',
		list: 'Bulleted list',
		numbered: 'Numbered list',
		tasks: 'Task list',
		rule: 'Horizontal rule',
		write: 'Write',
		preview: 'Preview',
		split: 'Side by side',
		download: 'Download',
		input: 'Markdown',
		empty: 'Nothing to preview yet.',
	};

	/** applies an edit to a plain string */
	function applyEdit(value, edit) {
		return value.slice(0, edit.from) + edit.text + value.slice(edit.to);
	}

	/** file name for downloads: no folders, no characters that are invalid on common systems, ends in .md */
	function safeFileName(name) {
		var base = String(name || '').split(/[\\/]/).pop().replace(/[\u0000-\u001f<>:"|?*]+/g, '').trim();
		base = base.replace(/^\.+/, '');
		if (!base) {
			base = 'document.md';
		}
		return /\.(md|markdown)$/i.test(base) ? base : base + '.md';
	}

	/**
	 * Resolves the options to plain lists: toolbar items (command names and
	 * "|"), commands by name, modes and the start mode. Pure, unit tested.
	 */
	function resolveOptions(options) {
		options = options || {};
		var commands = {};
		Object.keys(COMMANDS).forEach(function (name) {
			commands[name] = COMMANDS[name];
		});
		Object.keys(options.commands || {}).forEach(function (name) {
			var command = options.commands[name];
			if (command && typeof command.run === 'function') {
				commands[name] = command;
			}
		});

		var toolbar = (Array.isArray(options.toolbar) ? options.toolbar : options.toolbar === false ? [] : DEFAULT_TOOLBAR)
			.filter(function (item) {
				return item === '|' || commands.hasOwnProperty(item);
			})
			// no separators at the start, the end or twice in a row
			.reduce(function (list, item) {
				if (item !== '|' || (list.length && list[list.length - 1] !== '|')) {
					list.push(item);
				}
				return list;
			}, []);
		if (toolbar[toolbar.length - 1] === '|') {
			toolbar.pop();
		}

		var preview = typeof options.render === 'function';
		var modes = (Array.isArray(options.modes) ? options.modes : MODES).filter(function (mode, index, list) {
			return MODES.indexOf(mode) >= 0 && list.indexOf(mode) === index && (preview || mode === 'write');
		});
		if (!modes.length) {
			modes = [preview ? 'split' : 'write'];
		}
		var mode = modes.indexOf(options.mode) >= 0 ? options.mode : modes.indexOf('split') >= 0 ? 'split' : modes[0];

		return {
			toolbar: toolbar,
			commands: commands,
			modes: modes,
			mode: mode,
			download: Boolean(options.fileName) && options.download !== false,
			shortcuts: options.shortcuts !== false,
		};
	}

	// ---------------------------------------------------------------------
	// Browser part
	// ---------------------------------------------------------------------

	var counter = 0;

	function element(tag, className, attributes) {
		var node = document.createElement(tag);
		if (className) {
			node.className = className;
		}
		Object.keys(attributes || {}).forEach(function (name) {
			node.setAttribute(name, attributes[name]);
		});
		return node;
	}

	function button(className, text, label) {
		var node = element('button', className, { type: 'button' });
		node.textContent = text;
		if (label && label !== text) {
			node.setAttribute('aria-label', label);
			node.title = label;
		}
		return node;
	}

	/**
	 * Gives every id below root a prefix and rewrites "for" and "#id" links
	 * to match, so preview content never clashes with ids of the page.
	 */
	function prefixIds(root, prefix) {
		root.querySelectorAll('[id]').forEach(function (node) {
			node.id = prefix + node.id;
		});
		root.querySelectorAll('[for]').forEach(function (node) {
			node.setAttribute('for', prefix + node.getAttribute('for'));
		});
		root.querySelectorAll('a[href^="#"]').forEach(function (node) {
			var target = node.getAttribute('href').slice(1);
			if (target) {
				node.setAttribute('href', '#' + prefix + target);
			}
		});
	}

	function storage() {
		try {
			return typeof localStorage !== 'undefined' ? localStorage : null;
		} catch (e) {
			return null; // blocked
		}
	}

	function readDraft(key) {
		try {
			return key && storage() ? storage().getItem(key) : null;
		} catch (e) {
			return null;
		}
	}

	function writeDraft(key, value) {
		try {
			if (key && storage()) {
				if (value === null) {
					storage().removeItem(key);
				} else {
					storage().setItem(key, value);
				}
			}
		} catch (e) {
			// storage full or blocked - the text stays in the editor
		}
	}

	/**
	 * Creates an editor.
	 *
	 * @param {Element} target a <textarea> to enhance (it keeps its name, so it
	 *   still works in forms) or a container the editor is appended to
	 * @param {object} [options] see README
	 */
	function markdownPagesEditor(target, options) {
		options = options || {};
		var config = resolveOptions(options);
		var labels = {};
		Object.keys(LABELS).forEach(function (key) {
			labels[key] = LABELS[key];
		});
		Object.keys(config.commands).forEach(function (name) {
			labels[name] = config.commands[name].label || labels[name] || name;
		});
		Object.keys(options.labels || {}).forEach(function (key) {
			labels[key] = options.labels[key];
		});
		var id = 'markdown-pages-editor-' + (++counter);

		var isTextarea = target.tagName === 'TEXTAREA';
		var root = element('div', 'markdown-pages-editor');
		var input = isTextarea ? target : element('textarea', '', { 'aria-label': labels.input });
		if (isTextarea) {
			target.parentNode.insertBefore(root, target);
		} else {
			target.appendChild(root);
		}
		input.classList.add('markdown-pages-editor-input');
		input.id = input.id || id + '-input';

		var toolbar = element('div', 'markdown-pages-editor-toolbar', { role: 'toolbar', 'aria-label': labels.toolbar, 'aria-controls': input.id });
		var format = element('div', 'markdown-pages-editor-format');
		config.toolbar.forEach(function (name) {
			if (name === '|') {
				format.appendChild(element('span', 'markdown-pages-editor-separator', { 'aria-hidden': 'true' }));
				return;
			}
			var command = config.commands[name];
			var node = button('markdown-pages-editor-button markdown-pages-editor-' + name, command.text || labels[name], labels[name]);
			node.setAttribute('data-command', name);
			format.appendChild(node);
		});
		if (config.toolbar.length) {
			toolbar.appendChild(format);
		}

		var modeButtons = {};
		if (config.modes.length > 1) {
			var switcher = element('div', 'markdown-pages-editor-modes');
			config.modes.forEach(function (name) {
				var node = button('markdown-pages-editor-mode', labels[name]);
				node.setAttribute('data-mode', name);
				modeButtons[name] = node;
				switcher.appendChild(node);
			});
			toolbar.appendChild(switcher);
		}
		var downloadButton = null;
		if (config.download) {
			downloadButton = button('markdown-pages-editor-download', labels.download);
			toolbar.appendChild(downloadButton);
		}

		var panes = element('div', 'markdown-pages-editor-panes');
		var preview = element('div', 'markdown-pages-editor-preview', { role: 'region', 'aria-label': labels.preview, 'aria-live': 'polite' });
		if (toolbar.childNodes.length) {
			root.appendChild(toolbar);
		}
		panes.appendChild(input);
		panes.appendChild(preview);
		root.appendChild(panes);

		var initial = options.value !== undefined ? String(options.value) : input.value;
		var draft = readDraft(options.storageKey);
		input.value = draft !== null ? draft : initial;
		var saved = initial;
		var timer = null;
		var mode = null;
		var renderCount = 0;
		var shortcuts = {};
		Object.keys(config.commands).forEach(function (name) {
			var key = config.commands[name].shortcut;
			if (key && (config.toolbar.indexOf(name) >= 0 || (options.commands && options.commands[name]))) {
				shortcuts[String(key).toLowerCase()] = name;
			}
		});

		var api = {
			element: root,
			textarea: input,
			preview: preview,
			getValue: function () { return input.value; },
			setValue: function (value) {
				input.value = String(value);
				changed();
			},
			/** marks the current text as saved: isDirty() is false again and the draft is removed */
			markSaved: function () {
				saved = input.value;
				writeDraft(options.storageKey, null);
			},
			isDirty: function () { return input.value !== saved; },
			setMode: setMode,
			getMode: function () { return mode; },
			render: renderPreview,
			exec: exec,
			download: download,
			focus: function () { input.focus(); },
			destroy: destroy,
		};

		function changed() {
			writeDraft(options.storageKey, input.value !== saved ? input.value : null);
			if (typeof options.onChange === 'function') {
				options.onChange(input.value, api);
			}
			schedule();
		}

		function schedule() {
			if (mode === 'write') {
				return;
			}
			clearTimeout(timer);
			timer = setTimeout(renderPreview, options.delay !== undefined ? options.delay : 200);
		}

		function renderPreview() {
			clearTimeout(timer);
			if (typeof options.render !== 'function') {
				return Promise.resolve();
			}
			var current = ++renderCount;
			var markdown = input.value;
			return Promise.resolve().then(function () {
				return markdown.trim() ? options.render(markdown, preview) : null;
			}).then(function (html) {
				if (current !== renderCount) {
					return false; // a newer render has started
				}
				if (!markdown.trim()) {
					preview.innerHTML = '';
					var hint = element('p', 'markdown-pages-editor-empty');
					hint.textContent = labels.empty;
					preview.appendChild(hint);
				} else if (typeof html === 'string') {
					// the render function is responsible for sanitizing
					preview.innerHTML = html;
				}
				return typeof options.afterRender === 'function' ? options.afterRender(preview, api) : null;
			}).then(function (result) {
				if (result === false || current !== renderCount) {
					return;
				}
				if (options.prefixIds !== false) {
					prefixIds(preview, id + '-');
				}
				preview.dispatchEvent(new CustomEvent('markdown-pages-editor:preview', { bubbles: true, detail: { editor: api } }));
			}).catch(function (error) {
				console.error('markdown-pages-editor:', error);
			});
		}

		function setMode(next) {
			if (config.modes.indexOf(next) < 0 || next === mode) {
				return;
			}
			mode = next;
			root.setAttribute('data-mode', mode);
			Object.keys(modeButtons).forEach(function (name) {
				modeButtons[name].setAttribute('aria-pressed', name === mode ? 'true' : 'false');
			});
			input.hidden = mode === 'preview';
			preview.hidden = mode === 'write';
			format.querySelectorAll('button').forEach(function (node) {
				node.disabled = mode === 'preview';
			});
			if (mode !== 'write') {
				renderPreview();
			}
		}

		function exec(name) {
			var command = config.commands[name];
			if (!command || input.disabled || input.readOnly) {
				return;
			}
			var edit = command.run({ value: input.value, start: input.selectionStart, end: input.selectionEnd });
			if (!edit) {
				return;
			}
			input.focus();
			input.setSelectionRange(edit.from, edit.to);
			// execCommand keeps the undo history; setRangeText is the fallback
			var done = false;
			try {
				done = edit.text
					? document.execCommand('insertText', false, edit.text)
					: (edit.from === edit.to || document.execCommand('delete'));
			} catch (e) {
				done = false;
			}
			if (!done || input.value.slice(edit.from, edit.from + edit.text.length) !== edit.text) {
				input.setRangeText(edit.text, edit.from, edit.to, 'end');
				changed();
			}
			input.setSelectionRange(edit.start, edit.end);
		}

		function download(name) {
			var blob = new Blob([input.value], { type: 'text/markdown;charset=utf-8' });
			var url = URL.createObjectURL(blob);
			var anchor = element('a', '', { href: url, download: safeFileName(name || options.fileName) });
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
		}

		function onToolbarClick(event) {
			var node = event.target.closest('button');
			if (!node || node.disabled) {
				return;
			}
			if (node.hasAttribute('data-command')) {
				exec(node.getAttribute('data-command'));
			} else if (node.hasAttribute('data-mode')) {
				setMode(node.getAttribute('data-mode'));
			} else if (node === downloadButton) {
				download();
			}
		}

		function onKeyDown(event) {
			if (config.shortcuts && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
				var name = shortcuts[String(event.key).toLowerCase()];
				if (name) {
					event.preventDefault();
					exec(name);
				}
			}
		}

		// the preview is only a view: links do not navigate away from unsaved
		// text, forms are not submitted and do not reach the page's handlers
		function onPreviewClick(event) {
			var anchor = event.target.closest('a[href]');
			if (anchor && anchor.getAttribute('href').charAt(0) !== '#') {
				event.preventDefault();
			}
		}

		function onPreviewSubmit(event) {
			event.preventDefault();
			event.stopPropagation();
		}

		toolbar.addEventListener('click', onToolbarClick);
		input.addEventListener('input', changed);
		input.addEventListener('keydown', onKeyDown);
		preview.addEventListener('click', onPreviewClick);
		preview.addEventListener('submit', onPreviewSubmit);

		function destroy() {
			clearTimeout(timer);
			renderCount++;
			input.removeEventListener('input', changed);
			input.removeEventListener('keydown', onKeyDown);
			if (isTextarea) {
				input.classList.remove('markdown-pages-editor-input');
				input.hidden = false;
				root.parentNode.insertBefore(input, root);
			}
			root.remove();
		}

		setMode(config.mode);
		return api;
	}

	markdownPagesEditor.commands = COMMANDS;
	markdownPagesEditor.labels = LABELS;
	markdownPagesEditor.defaultToolbar = DEFAULT_TOOLBAR;
	markdownPagesEditor.resolveOptions = resolveOptions;
	markdownPagesEditor.applyEdit = applyEdit;
	markdownPagesEditor.safeFileName = safeFileName;
	markdownPagesEditor.prefixIds = prefixIds;
	markdownPagesEditor.helpers = { wrap: wrap, prefixLines: prefixLines, editLines: editLines };
	markdownPagesEditor.default = markdownPagesEditor;

	return markdownPagesEditor;
});

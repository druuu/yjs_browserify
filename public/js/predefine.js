(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

// This is CodeMirror (http://codemirror.net), a code editor
// implemented in JavaScript on top of the browser's DOM.
//
// You can find some technical background for some of the code below
// at http://marijnhaverbeke.nl/blog/#cm-internals .

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.CodeMirror = factory());
}(this, (function () { 'use strict';

// Kludges for bugs and behavior differences that can't be feature
// detected are enabled based on userAgent etc sniffing.
var userAgent = navigator.userAgent;
var platform = navigator.platform;

var gecko = /gecko\/\d/i.test(userAgent);
var ie_upto10 = /MSIE \d/.test(userAgent);
var ie_11up = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(userAgent);
var edge = /Edge\/(\d+)/.exec(userAgent);
var ie = ie_upto10 || ie_11up || edge;
var ie_version = ie && (ie_upto10 ? document.documentMode || 6 : +(edge || ie_11up)[1]);
var webkit = !edge && /WebKit\//.test(userAgent);
var qtwebkit = webkit && /Qt\/\d+\.\d+/.test(userAgent);
var chrome = !edge && /Chrome\//.test(userAgent);
var presto = /Opera\//.test(userAgent);
var safari = /Apple Computer/.test(navigator.vendor);
var mac_geMountainLion = /Mac OS X 1\d\D([8-9]|\d\d)\D/.test(userAgent);
var phantom = /PhantomJS/.test(userAgent);

var ios = !edge && /AppleWebKit/.test(userAgent) && /Mobile\/\w+/.test(userAgent);
var android = /Android/.test(userAgent);
// This is woefully incomplete. Suggestions for alternative methods welcome.
var mobile = ios || android || /webOS|BlackBerry|Opera Mini|Opera Mobi|IEMobile/i.test(userAgent);
var mac = ios || /Mac/.test(platform);
var chromeOS = /\bCrOS\b/.test(userAgent);
var windows = /win/i.test(platform);

var presto_version = presto && userAgent.match(/Version\/(\d*\.\d*)/);
if (presto_version) { presto_version = Number(presto_version[1]); }
if (presto_version && presto_version >= 15) { presto = false; webkit = true; }
// Some browsers use the wrong event properties to signal cmd/ctrl on OS X
var flipCtrlCmd = mac && (qtwebkit || presto && (presto_version == null || presto_version < 12.11));
var captureRightClick = gecko || (ie && ie_version >= 9);

function classTest(cls) { return new RegExp("(^|\\s)" + cls + "(?:$|\\s)\\s*") }

var rmClass = function(node, cls) {
  var current = node.className;
  var match = classTest(cls).exec(current);
  if (match) {
    var after = current.slice(match.index + match[0].length);
    node.className = current.slice(0, match.index) + (after ? match[1] + after : "");
  }
};

function removeChildren(e) {
  for (var count = e.childNodes.length; count > 0; --count)
    { e.removeChild(e.firstChild); }
  return e
}

function removeChildrenAndAdd(parent, e) {
  return removeChildren(parent).appendChild(e)
}

function elt(tag, content, className, style) {
  var e = document.createElement(tag);
  if (className) { e.className = className; }
  if (style) { e.style.cssText = style; }
  if (typeof content == "string") { e.appendChild(document.createTextNode(content)); }
  else if (content) { for (var i = 0; i < content.length; ++i) { e.appendChild(content[i]); } }
  return e
}
// wrapper for elt, which removes the elt from the accessibility tree
function eltP(tag, content, className, style) {
  var e = elt(tag, content, className, style);
  e.setAttribute("role", "presentation");
  return e
}

var range;
if (document.createRange) { range = function(node, start, end, endNode) {
  var r = document.createRange();
  r.setEnd(endNode || node, end);
  r.setStart(node, start);
  return r
}; }
else { range = function(node, start, end) {
  var r = document.body.createTextRange();
  try { r.moveToElementText(node.parentNode); }
  catch(e) { return r }
  r.collapse(true);
  r.moveEnd("character", end);
  r.moveStart("character", start);
  return r
}; }

function contains(parent, child) {
  if (child.nodeType == 3) // Android browser always returns false when child is a textnode
    { child = child.parentNode; }
  if (parent.contains)
    { return parent.contains(child) }
  do {
    if (child.nodeType == 11) { child = child.host; }
    if (child == parent) { return true }
  } while (child = child.parentNode)
}

function activeElt() {
  // IE and Edge may throw an "Unspecified Error" when accessing document.activeElement.
  // IE < 10 will throw when accessed while the page is loading or in an iframe.
  // IE > 9 and Edge will throw when accessed in an iframe if document.body is unavailable.
  var activeElement;
  try {
    activeElement = document.activeElement;
  } catch(e) {
    activeElement = document.body || null;
  }
  while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement)
    { activeElement = activeElement.shadowRoot.activeElement; }
  return activeElement
}

function addClass(node, cls) {
  var current = node.className;
  if (!classTest(cls).test(current)) { node.className += (current ? " " : "") + cls; }
}
function joinClasses(a, b) {
  var as = a.split(" ");
  for (var i = 0; i < as.length; i++)
    { if (as[i] && !classTest(as[i]).test(b)) { b += " " + as[i]; } }
  return b
}

var selectInput = function(node) { node.select(); };
if (ios) // Mobile Safari apparently has a bug where select() is broken.
  { selectInput = function(node) { node.selectionStart = 0; node.selectionEnd = node.value.length; }; }
else if (ie) // Suppress mysterious IE10 errors
  { selectInput = function(node) { try { node.select(); } catch(_e) {} }; }

function bind(f) {
  var args = Array.prototype.slice.call(arguments, 1);
  return function(){return f.apply(null, args)}
}

function copyObj(obj, target, overwrite) {
  if (!target) { target = {}; }
  for (var prop in obj)
    { if (obj.hasOwnProperty(prop) && (overwrite !== false || !target.hasOwnProperty(prop)))
      { target[prop] = obj[prop]; } }
  return target
}

// Counts the column offset in a string, taking tabs into account.
// Used mostly to find indentation.
function countColumn(string, end, tabSize, startIndex, startValue) {
  if (end == null) {
    end = string.search(/[^\s\u00a0]/);
    if (end == -1) { end = string.length; }
  }
  for (var i = startIndex || 0, n = startValue || 0;;) {
    var nextTab = string.indexOf("\t", i);
    if (nextTab < 0 || nextTab >= end)
      { return n + (end - i) }
    n += nextTab - i;
    n += tabSize - (n % tabSize);
    i = nextTab + 1;
  }
}

var Delayed = function() {this.id = null;};
Delayed.prototype.set = function (ms, f) {
  clearTimeout(this.id);
  this.id = setTimeout(f, ms);
};

function indexOf(array, elt) {
  for (var i = 0; i < array.length; ++i)
    { if (array[i] == elt) { return i } }
  return -1
}

// Number of pixels added to scroller and sizer to hide scrollbar
var scrollerGap = 30;

// Returned or thrown by various protocols to signal 'I'm not
// handling this'.
var Pass = {toString: function(){return "CodeMirror.Pass"}};

// Reused option objects for setSelection & friends
var sel_dontScroll = {scroll: false};
var sel_mouse = {origin: "*mouse"};
var sel_move = {origin: "+move"};

// The inverse of countColumn -- find the offset that corresponds to
// a particular column.
function findColumn(string, goal, tabSize) {
  for (var pos = 0, col = 0;;) {
    var nextTab = string.indexOf("\t", pos);
    if (nextTab == -1) { nextTab = string.length; }
    var skipped = nextTab - pos;
    if (nextTab == string.length || col + skipped >= goal)
      { return pos + Math.min(skipped, goal - col) }
    col += nextTab - pos;
    col += tabSize - (col % tabSize);
    pos = nextTab + 1;
    if (col >= goal) { return pos }
  }
}

var spaceStrs = [""];
function spaceStr(n) {
  while (spaceStrs.length <= n)
    { spaceStrs.push(lst(spaceStrs) + " "); }
  return spaceStrs[n]
}

function lst(arr) { return arr[arr.length-1] }

function map(array, f) {
  var out = [];
  for (var i = 0; i < array.length; i++) { out[i] = f(array[i], i); }
  return out
}

function insertSorted(array, value, score) {
  var pos = 0, priority = score(value);
  while (pos < array.length && score(array[pos]) <= priority) { pos++; }
  array.splice(pos, 0, value);
}

function nothing() {}

function createObj(base, props) {
  var inst;
  if (Object.create) {
    inst = Object.create(base);
  } else {
    nothing.prototype = base;
    inst = new nothing();
  }
  if (props) { copyObj(props, inst); }
  return inst
}

var nonASCIISingleCaseWordChar = /[\u00df\u0587\u0590-\u05f4\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc\uac00-\ud7af]/;
function isWordCharBasic(ch) {
  return /\w/.test(ch) || ch > "\x80" &&
    (ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch))
}
function isWordChar(ch, helper) {
  if (!helper) { return isWordCharBasic(ch) }
  if (helper.source.indexOf("\\w") > -1 && isWordCharBasic(ch)) { return true }
  return helper.test(ch)
}

function isEmpty(obj) {
  for (var n in obj) { if (obj.hasOwnProperty(n) && obj[n]) { return false } }
  return true
}

// Extending unicode characters. A series of a non-extending char +
// any number of extending chars is treated as a single unit as far
// as editing and measuring is concerned. This is not fully correct,
// since some scripts/fonts/browsers also treat other configurations
// of code points as a group.
var extendingChars = /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065e\u0670\u06d6-\u06dc\u06de-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0900-\u0902\u093c\u0941-\u0948\u094d\u0951-\u0955\u0962\u0963\u0981\u09bc\u09be\u09c1-\u09c4\u09cd\u09d7\u09e2\u09e3\u0a01\u0a02\u0a3c\u0a41\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a70\u0a71\u0a75\u0a81\u0a82\u0abc\u0ac1-\u0ac5\u0ac7\u0ac8\u0acd\u0ae2\u0ae3\u0b01\u0b3c\u0b3e\u0b3f\u0b41-\u0b44\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b82\u0bbe\u0bc0\u0bcd\u0bd7\u0c3e-\u0c40\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0cbc\u0cbf\u0cc2\u0cc6\u0ccc\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0d3e\u0d41-\u0d44\u0d4d\u0d57\u0d62\u0d63\u0dca\u0dcf\u0dd2-\u0dd4\u0dd6\u0ddf\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0f18\u0f19\u0f35\u0f37\u0f39\u0f71-\u0f7e\u0f80-\u0f84\u0f86\u0f87\u0f90-\u0f97\u0f99-\u0fbc\u0fc6\u102d-\u1030\u1032-\u1037\u1039\u103a\u103d\u103e\u1058\u1059\u105e-\u1060\u1071-\u1074\u1082\u1085\u1086\u108d\u109d\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b7-\u17bd\u17c6\u17c9-\u17d3\u17dd\u180b-\u180d\u18a9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193b\u1a17\u1a18\u1a56\u1a58-\u1a5e\u1a60\u1a62\u1a65-\u1a6c\u1a73-\u1a7c\u1a7f\u1b00-\u1b03\u1b34\u1b36-\u1b3a\u1b3c\u1b42\u1b6b-\u1b73\u1b80\u1b81\u1ba2-\u1ba5\u1ba8\u1ba9\u1c2c-\u1c33\u1c36\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce0\u1ce2-\u1ce8\u1ced\u1dc0-\u1de6\u1dfd-\u1dff\u200c\u200d\u20d0-\u20f0\u2cef-\u2cf1\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua66f-\ua672\ua67c\ua67d\ua6f0\ua6f1\ua802\ua806\ua80b\ua825\ua826\ua8c4\ua8e0-\ua8f1\ua926-\ua92d\ua947-\ua951\ua980-\ua982\ua9b3\ua9b6-\ua9b9\ua9bc\uaa29-\uaa2e\uaa31\uaa32\uaa35\uaa36\uaa43\uaa4c\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uabe5\uabe8\uabed\udc00-\udfff\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\uff9e\uff9f]/;
function isExtendingChar(ch) { return ch.charCodeAt(0) >= 768 && extendingChars.test(ch) }

// Returns a number from the range [`0`; `str.length`] unless `pos` is outside that range.
function skipExtendingChars(str, pos, dir) {
  while ((dir < 0 ? pos > 0 : pos < str.length) && isExtendingChar(str.charAt(pos))) { pos += dir; }
  return pos
}

// Returns the value from the range [`from`; `to`] that satisfies
// `pred` and is closest to `from`. Assumes that at least `to`
// satisfies `pred`. Supports `from` being greater than `to`.
function findFirst(pred, from, to) {
  // At any point we are certain `to` satisfies `pred`, don't know
  // whether `from` does.
  var dir = from > to ? -1 : 1;
  for (;;) {
    if (from == to) { return from }
    var midF = (from + to) / 2, mid = dir < 0 ? Math.ceil(midF) : Math.floor(midF);
    if (mid == from) { return pred(mid) ? from : to }
    if (pred(mid)) { to = mid; }
    else { from = mid + dir; }
  }
}

// The display handles the DOM integration, both for input reading
// and content drawing. It holds references to DOM nodes and
// display-related state.

function Display(place, doc, input) {
  var d = this;
  this.input = input;

  // Covers bottom-right square when both scrollbars are present.
  d.scrollbarFiller = elt("div", null, "CodeMirror-scrollbar-filler");
  d.scrollbarFiller.setAttribute("cm-not-content", "true");
  // Covers bottom of gutter when coverGutterNextToScrollbar is on
  // and h scrollbar is present.
  d.gutterFiller = elt("div", null, "CodeMirror-gutter-filler");
  d.gutterFiller.setAttribute("cm-not-content", "true");
  // Will contain the actual code, positioned to cover the viewport.
  d.lineDiv = eltP("div", null, "CodeMirror-code");
  // Elements are added to these to represent selection and cursors.
  d.selectionDiv = elt("div", null, null, "position: relative; z-index: 1");
  d.cursorDiv = elt("div", null, "CodeMirror-cursors");
  // A visibility: hidden element used to find the size of things.
  d.measure = elt("div", null, "CodeMirror-measure");
  // When lines outside of the viewport are measured, they are drawn in this.
  d.lineMeasure = elt("div", null, "CodeMirror-measure");
  // Wraps everything that needs to exist inside the vertically-padded coordinate system
  d.lineSpace = eltP("div", [d.measure, d.lineMeasure, d.selectionDiv, d.cursorDiv, d.lineDiv],
                    null, "position: relative; outline: none");
  var lines = eltP("div", [d.lineSpace], "CodeMirror-lines");
  // Moved around its parent to cover visible view.
  d.mover = elt("div", [lines], null, "position: relative");
  // Set to the height of the document, allowing scrolling.
  d.sizer = elt("div", [d.mover], "CodeMirror-sizer");
  d.sizerWidth = null;
  // Behavior of elts with overflow: auto and padding is
  // inconsistent across browsers. This is used to ensure the
  // scrollable area is big enough.
  d.heightForcer = elt("div", null, null, "position: absolute; height: " + scrollerGap + "px; width: 1px;");
  // Will contain the gutters, if any.
  d.gutters = elt("div", null, "CodeMirror-gutters");
  d.lineGutter = null;
  // Actual scrollable element.
  d.scroller = elt("div", [d.sizer, d.heightForcer, d.gutters], "CodeMirror-scroll");
  d.scroller.setAttribute("tabIndex", "-1");
  // The element in which the editor lives.
  d.wrapper = elt("div", [d.scrollbarFiller, d.gutterFiller, d.scroller], "CodeMirror");

  // Work around IE7 z-index bug (not perfect, hence IE7 not really being supported)
  if (ie && ie_version < 8) { d.gutters.style.zIndex = -1; d.scroller.style.paddingRight = 0; }
  if (!webkit && !(gecko && mobile)) { d.scroller.draggable = true; }

  if (place) {
    if (place.appendChild) { place.appendChild(d.wrapper); }
    else { place(d.wrapper); }
  }

  // Current rendered range (may be bigger than the view window).
  d.viewFrom = d.viewTo = doc.first;
  d.reportedViewFrom = d.reportedViewTo = doc.first;
  // Information about the rendered lines.
  d.view = [];
  d.renderedView = null;
  // Holds info about a single rendered line when it was rendered
  // for measurement, while not in view.
  d.externalMeasured = null;
  // Empty space (in pixels) above the view
  d.viewOffset = 0;
  d.lastWrapHeight = d.lastWrapWidth = 0;
  d.updateLineNumbers = null;

  d.nativeBarWidth = d.barHeight = d.barWidth = 0;
  d.scrollbarsClipped = false;

  // Used to only resize the line number gutter when necessary (when
  // the amount of lines crosses a boundary that makes its width change)
  d.lineNumWidth = d.lineNumInnerWidth = d.lineNumChars = null;
  // Set to true when a non-horizontal-scrolling line widget is
  // added. As an optimization, line widget aligning is skipped when
  // this is false.
  d.alignWidgets = false;

  d.cachedCharWidth = d.cachedTextHeight = d.cachedPaddingH = null;

  // Tracks the maximum line length so that the horizontal scrollbar
  // can be kept static when scrolling.
  d.maxLine = null;
  d.maxLineLength = 0;
  d.maxLineChanged = false;

  // Used for measuring wheel scrolling granularity
  d.wheelDX = d.wheelDY = d.wheelStartX = d.wheelStartY = null;

  // True when shift is held down.
  d.shift = false;

  // Used to track whether anything happened since the context menu
  // was opened.
  d.selForContextMenu = null;

  d.activeTouch = null;

  input.init(d);
}

// Find the line object corresponding to the given line number.
function getLine(doc, n) {
  n -= doc.first;
  if (n < 0 || n >= doc.size) { throw new Error("There is no line " + (n + doc.first) + " in the document.") }
  var chunk = doc;
  while (!chunk.lines) {
    for (var i = 0;; ++i) {
      var child = chunk.children[i], sz = child.chunkSize();
      if (n < sz) { chunk = child; break }
      n -= sz;
    }
  }
  return chunk.lines[n]
}

// Get the part of a document between two positions, as an array of
// strings.
function getBetween(doc, start, end) {
  var out = [], n = start.line;
  doc.iter(start.line, end.line + 1, function (line) {
    var text = line.text;
    if (n == end.line) { text = text.slice(0, end.ch); }
    if (n == start.line) { text = text.slice(start.ch); }
    out.push(text);
    ++n;
  });
  return out
}
// Get the lines between from and to, as array of strings.
function getLines(doc, from, to) {
  var out = [];
  doc.iter(from, to, function (line) { out.push(line.text); }); // iter aborts when callback returns truthy value
  return out
}

// Update the height of a line, propagating the height change
// upwards to parent nodes.
function updateLineHeight(line, height) {
  var diff = height - line.height;
  if (diff) { for (var n = line; n; n = n.parent) { n.height += diff; } }
}

// Given a line object, find its line number by walking up through
// its parent links.
function lineNo(line) {
  if (line.parent == null) { return null }
  var cur = line.parent, no = indexOf(cur.lines, line);
  for (var chunk = cur.parent; chunk; cur = chunk, chunk = chunk.parent) {
    for (var i = 0;; ++i) {
      if (chunk.children[i] == cur) { break }
      no += chunk.children[i].chunkSize();
    }
  }
  return no + cur.first
}

// Find the line at the given vertical position, using the height
// information in the document tree.
function lineAtHeight(chunk, h) {
  var n = chunk.first;
  outer: do {
    for (var i$1 = 0; i$1 < chunk.children.length; ++i$1) {
      var child = chunk.children[i$1], ch = child.height;
      if (h < ch) { chunk = child; continue outer }
      h -= ch;
      n += child.chunkSize();
    }
    return n
  } while (!chunk.lines)
  var i = 0;
  for (; i < chunk.lines.length; ++i) {
    var line = chunk.lines[i], lh = line.height;
    if (h < lh) { break }
    h -= lh;
  }
  return n + i
}

function isLine(doc, l) {return l >= doc.first && l < doc.first + doc.size}

function lineNumberFor(options, i) {
  return String(options.lineNumberFormatter(i + options.firstLineNumber))
}

// A Pos instance represents a position within the text.
function Pos(line, ch, sticky) {
  if ( sticky === void 0 ) sticky = null;

  if (!(this instanceof Pos)) { return new Pos(line, ch, sticky) }
  this.line = line;
  this.ch = ch;
  this.sticky = sticky;
}

// Compare two positions, return 0 if they are the same, a negative
// number when a is less, and a positive number otherwise.
function cmp(a, b) { return a.line - b.line || a.ch - b.ch }

function equalCursorPos(a, b) { return a.sticky == b.sticky && cmp(a, b) == 0 }

function copyPos(x) {return Pos(x.line, x.ch)}
function maxPos(a, b) { return cmp(a, b) < 0 ? b : a }
function minPos(a, b) { return cmp(a, b) < 0 ? a : b }

// Most of the external API clips given positions to make sure they
// actually exist within the document.
function clipLine(doc, n) {return Math.max(doc.first, Math.min(n, doc.first + doc.size - 1))}
function clipPos(doc, pos) {
  if (pos.line < doc.first) { return Pos(doc.first, 0) }
  var last = doc.first + doc.size - 1;
  if (pos.line > last) { return Pos(last, getLine(doc, last).text.length) }
  return clipToLen(pos, getLine(doc, pos.line).text.length)
}
function clipToLen(pos, linelen) {
  var ch = pos.ch;
  if (ch == null || ch > linelen) { return Pos(pos.line, linelen) }
  else if (ch < 0) { return Pos(pos.line, 0) }
  else { return pos }
}
function clipPosArray(doc, array) {
  var out = [];
  for (var i = 0; i < array.length; i++) { out[i] = clipPos(doc, array[i]); }
  return out
}

// Optimize some code when these features are not used.
var sawReadOnlySpans = false;
var sawCollapsedSpans = false;

function seeReadOnlySpans() {
  sawReadOnlySpans = true;
}

function seeCollapsedSpans() {
  sawCollapsedSpans = true;
}

// TEXTMARKER SPANS

function MarkedSpan(marker, from, to) {
  this.marker = marker;
  this.from = from; this.to = to;
}

// Search an array of spans for a span matching the given marker.
function getMarkedSpanFor(spans, marker) {
  if (spans) { for (var i = 0; i < spans.length; ++i) {
    var span = spans[i];
    if (span.marker == marker) { return span }
  } }
}
// Remove a span from an array, returning undefined if no spans are
// left (we don't store arrays for lines without spans).
function removeMarkedSpan(spans, span) {
  var r;
  for (var i = 0; i < spans.length; ++i)
    { if (spans[i] != span) { (r || (r = [])).push(spans[i]); } }
  return r
}
// Add a span to a line.
function addMarkedSpan(line, span) {
  line.markedSpans = line.markedSpans ? line.markedSpans.concat([span]) : [span];
  span.marker.attachLine(line);
}

// Used for the algorithm that adjusts markers for a change in the
// document. These functions cut an array of spans at a given
// character position, returning an array of remaining chunks (or
// undefined if nothing remains).
function markedSpansBefore(old, startCh, isInsert) {
  var nw;
  if (old) { for (var i = 0; i < old.length; ++i) {
    var span = old[i], marker = span.marker;
    var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= startCh : span.from < startCh);
    if (startsBefore || span.from == startCh && marker.type == "bookmark" && (!isInsert || !span.marker.insertLeft)) {
      var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= startCh : span.to > startCh);(nw || (nw = [])).push(new MarkedSpan(marker, span.from, endsAfter ? null : span.to));
    }
  } }
  return nw
}
function markedSpansAfter(old, endCh, isInsert) {
  var nw;
  if (old) { for (var i = 0; i < old.length; ++i) {
    var span = old[i], marker = span.marker;
    var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= endCh : span.to > endCh);
    if (endsAfter || span.from == endCh && marker.type == "bookmark" && (!isInsert || span.marker.insertLeft)) {
      var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= endCh : span.from < endCh);(nw || (nw = [])).push(new MarkedSpan(marker, startsBefore ? null : span.from - endCh,
                                            span.to == null ? null : span.to - endCh));
    }
  } }
  return nw
}

// Given a change object, compute the new set of marker spans that
// cover the line in which the change took place. Removes spans
// entirely within the change, reconnects spans belonging to the
// same marker that appear on both sides of the change, and cuts off
// spans partially within the change. Returns an array of span
// arrays with one element for each line in (after) the change.
function stretchSpansOverChange(doc, change) {
  if (change.full) { return null }
  var oldFirst = isLine(doc, change.from.line) && getLine(doc, change.from.line).markedSpans;
  var oldLast = isLine(doc, change.to.line) && getLine(doc, change.to.line).markedSpans;
  if (!oldFirst && !oldLast) { return null }

  var startCh = change.from.ch, endCh = change.to.ch, isInsert = cmp(change.from, change.to) == 0;
  // Get the spans that 'stick out' on both sides
  var first = markedSpansBefore(oldFirst, startCh, isInsert);
  var last = markedSpansAfter(oldLast, endCh, isInsert);

  // Next, merge those two ends
  var sameLine = change.text.length == 1, offset = lst(change.text).length + (sameLine ? startCh : 0);
  if (first) {
    // Fix up .to properties of first
    for (var i = 0; i < first.length; ++i) {
      var span = first[i];
      if (span.to == null) {
        var found = getMarkedSpanFor(last, span.marker);
        if (!found) { span.to = startCh; }
        else if (sameLine) { span.to = found.to == null ? null : found.to + offset; }
      }
    }
  }
  if (last) {
    // Fix up .from in last (or move them into first in case of sameLine)
    for (var i$1 = 0; i$1 < last.length; ++i$1) {
      var span$1 = last[i$1];
      if (span$1.to != null) { span$1.to += offset; }
      if (span$1.from == null) {
        var found$1 = getMarkedSpanFor(first, span$1.marker);
        if (!found$1) {
          span$1.from = offset;
          if (sameLine) { (first || (first = [])).push(span$1); }
        }
      } else {
        span$1.from += offset;
        if (sameLine) { (first || (first = [])).push(span$1); }
      }
    }
  }
  // Make sure we didn't create any zero-length spans
  if (first) { first = clearEmptySpans(first); }
  if (last && last != first) { last = clearEmptySpans(last); }

  var newMarkers = [first];
  if (!sameLine) {
    // Fill gap with whole-line-spans
    var gap = change.text.length - 2, gapMarkers;
    if (gap > 0 && first)
      { for (var i$2 = 0; i$2 < first.length; ++i$2)
        { if (first[i$2].to == null)
          { (gapMarkers || (gapMarkers = [])).push(new MarkedSpan(first[i$2].marker, null, null)); } } }
    for (var i$3 = 0; i$3 < gap; ++i$3)
      { newMarkers.push(gapMarkers); }
    newMarkers.push(last);
  }
  return newMarkers
}

// Remove spans that are empty and don't have a clearWhenEmpty
// option of false.
function clearEmptySpans(spans) {
  for (var i = 0; i < spans.length; ++i) {
    var span = spans[i];
    if (span.from != null && span.from == span.to && span.marker.clearWhenEmpty !== false)
      { spans.splice(i--, 1); }
  }
  if (!spans.length) { return null }
  return spans
}

// Used to 'clip' out readOnly ranges when making a change.
function removeReadOnlyRanges(doc, from, to) {
  var markers = null;
  doc.iter(from.line, to.line + 1, function (line) {
    if (line.markedSpans) { for (var i = 0; i < line.markedSpans.length; ++i) {
      var mark = line.markedSpans[i].marker;
      if (mark.readOnly && (!markers || indexOf(markers, mark) == -1))
        { (markers || (markers = [])).push(mark); }
    } }
  });
  if (!markers) { return null }
  var parts = [{from: from, to: to}];
  for (var i = 0; i < markers.length; ++i) {
    var mk = markers[i], m = mk.find(0);
    for (var j = 0; j < parts.length; ++j) {
      var p = parts[j];
      if (cmp(p.to, m.from) < 0 || cmp(p.from, m.to) > 0) { continue }
      var newParts = [j, 1], dfrom = cmp(p.from, m.from), dto = cmp(p.to, m.to);
      if (dfrom < 0 || !mk.inclusiveLeft && !dfrom)
        { newParts.push({from: p.from, to: m.from}); }
      if (dto > 0 || !mk.inclusiveRight && !dto)
        { newParts.push({from: m.to, to: p.to}); }
      parts.splice.apply(parts, newParts);
      j += newParts.length - 3;
    }
  }
  return parts
}

// Connect or disconnect spans from a line.
function detachMarkedSpans(line) {
  var spans = line.markedSpans;
  if (!spans) { return }
  for (var i = 0; i < spans.length; ++i)
    { spans[i].marker.detachLine(line); }
  line.markedSpans = null;
}
function attachMarkedSpans(line, spans) {
  if (!spans) { return }
  for (var i = 0; i < spans.length; ++i)
    { spans[i].marker.attachLine(line); }
  line.markedSpans = spans;
}

// Helpers used when computing which overlapping collapsed span
// counts as the larger one.
function extraLeft(marker) { return marker.inclusiveLeft ? -1 : 0 }
function extraRight(marker) { return marker.inclusiveRight ? 1 : 0 }

// Returns a number indicating which of two overlapping collapsed
// spans is larger (and thus includes the other). Falls back to
// comparing ids when the spans cover exactly the same range.
function compareCollapsedMarkers(a, b) {
  var lenDiff = a.lines.length - b.lines.length;
  if (lenDiff != 0) { return lenDiff }
  var aPos = a.find(), bPos = b.find();
  var fromCmp = cmp(aPos.from, bPos.from) || extraLeft(a) - extraLeft(b);
  if (fromCmp) { return -fromCmp }
  var toCmp = cmp(aPos.to, bPos.to) || extraRight(a) - extraRight(b);
  if (toCmp) { return toCmp }
  return b.id - a.id
}

// Find out whether a line ends or starts in a collapsed span. If
// so, return the marker for that span.
function collapsedSpanAtSide(line, start) {
  var sps = sawCollapsedSpans && line.markedSpans, found;
  if (sps) { for (var sp = (void 0), i = 0; i < sps.length; ++i) {
    sp = sps[i];
    if (sp.marker.collapsed && (start ? sp.from : sp.to) == null &&
        (!found || compareCollapsedMarkers(found, sp.marker) < 0))
      { found = sp.marker; }
  } }
  return found
}
function collapsedSpanAtStart(line) { return collapsedSpanAtSide(line, true) }
function collapsedSpanAtEnd(line) { return collapsedSpanAtSide(line, false) }

// Test whether there exists a collapsed span that partially
// overlaps (covers the start or end, but not both) of a new span.
// Such overlap is not allowed.
function conflictingCollapsedRange(doc, lineNo$$1, from, to, marker) {
  var line = getLine(doc, lineNo$$1);
  var sps = sawCollapsedSpans && line.markedSpans;
  if (sps) { for (var i = 0; i < sps.length; ++i) {
    var sp = sps[i];
    if (!sp.marker.collapsed) { continue }
    var found = sp.marker.find(0);
    var fromCmp = cmp(found.from, from) || extraLeft(sp.marker) - extraLeft(marker);
    var toCmp = cmp(found.to, to) || extraRight(sp.marker) - extraRight(marker);
    if (fromCmp >= 0 && toCmp <= 0 || fromCmp <= 0 && toCmp >= 0) { continue }
    if (fromCmp <= 0 && (sp.marker.inclusiveRight && marker.inclusiveLeft ? cmp(found.to, from) >= 0 : cmp(found.to, from) > 0) ||
        fromCmp >= 0 && (sp.marker.inclusiveRight && marker.inclusiveLeft ? cmp(found.from, to) <= 0 : cmp(found.from, to) < 0))
      { return true }
  } }
}

// A visual line is a line as drawn on the screen. Folding, for
// example, can cause multiple logical lines to appear on the same
// visual line. This finds the start of the visual line that the
// given line is part of (usually that is the line itself).
function visualLine(line) {
  var merged;
  while (merged = collapsedSpanAtStart(line))
    { line = merged.find(-1, true).line; }
  return line
}

function visualLineEnd(line) {
  var merged;
  while (merged = collapsedSpanAtEnd(line))
    { line = merged.find(1, true).line; }
  return line
}

// Returns an array of logical lines that continue the visual line
// started by the argument, or undefined if there are no such lines.
function visualLineContinued(line) {
  var merged, lines;
  while (merged = collapsedSpanAtEnd(line)) {
    line = merged.find(1, true).line
    ;(lines || (lines = [])).push(line);
  }
  return lines
}

// Get the line number of the start of the visual line that the
// given line number is part of.
function visualLineNo(doc, lineN) {
  var line = getLine(doc, lineN), vis = visualLine(line);
  if (line == vis) { return lineN }
  return lineNo(vis)
}

// Get the line number of the start of the next visual line after
// the given line.
function visualLineEndNo(doc, lineN) {
  if (lineN > doc.lastLine()) { return lineN }
  var line = getLine(doc, lineN), merged;
  if (!lineIsHidden(doc, line)) { return lineN }
  while (merged = collapsedSpanAtEnd(line))
    { line = merged.find(1, true).line; }
  return lineNo(line) + 1
}

// Compute whether a line is hidden. Lines count as hidden when they
// are part of a visual line that starts with another line, or when
// they are entirely covered by collapsed, non-widget span.
function lineIsHidden(doc, line) {
  var sps = sawCollapsedSpans && line.markedSpans;
  if (sps) { for (var sp = (void 0), i = 0; i < sps.length; ++i) {
    sp = sps[i];
    if (!sp.marker.collapsed) { continue }
    if (sp.from == null) { return true }
    if (sp.marker.widgetNode) { continue }
    if (sp.from == 0 && sp.marker.inclusiveLeft && lineIsHiddenInner(doc, line, sp))
      { return true }
  } }
}
function lineIsHiddenInner(doc, line, span) {
  if (span.to == null) {
    var end = span.marker.find(1, true);
    return lineIsHiddenInner(doc, end.line, getMarkedSpanFor(end.line.markedSpans, span.marker))
  }
  if (span.marker.inclusiveRight && span.to == line.text.length)
    { return true }
  for (var sp = (void 0), i = 0; i < line.markedSpans.length; ++i) {
    sp = line.markedSpans[i];
    if (sp.marker.collapsed && !sp.marker.widgetNode && sp.from == span.to &&
        (sp.to == null || sp.to != span.from) &&
        (sp.marker.inclusiveLeft || span.marker.inclusiveRight) &&
        lineIsHiddenInner(doc, line, sp)) { return true }
  }
}

// Find the height above the given line.
function heightAtLine(lineObj) {
  lineObj = visualLine(lineObj);

  var h = 0, chunk = lineObj.parent;
  for (var i = 0; i < chunk.lines.length; ++i) {
    var line = chunk.lines[i];
    if (line == lineObj) { break }
    else { h += line.height; }
  }
  for (var p = chunk.parent; p; chunk = p, p = chunk.parent) {
    for (var i$1 = 0; i$1 < p.children.length; ++i$1) {
      var cur = p.children[i$1];
      if (cur == chunk) { break }
      else { h += cur.height; }
    }
  }
  return h
}

// Compute the character length of a line, taking into account
// collapsed ranges (see markText) that might hide parts, and join
// other lines onto it.
function lineLength(line) {
  if (line.height == 0) { return 0 }
  var len = line.text.length, merged, cur = line;
  while (merged = collapsedSpanAtStart(cur)) {
    var found = merged.find(0, true);
    cur = found.from.line;
    len += found.from.ch - found.to.ch;
  }
  cur = line;
  while (merged = collapsedSpanAtEnd(cur)) {
    var found$1 = merged.find(0, true);
    len -= cur.text.length - found$1.from.ch;
    cur = found$1.to.line;
    len += cur.text.length - found$1.to.ch;
  }
  return len
}

// Find the longest line in the document.
function findMaxLine(cm) {
  var d = cm.display, doc = cm.doc;
  d.maxLine = getLine(doc, doc.first);
  d.maxLineLength = lineLength(d.maxLine);
  d.maxLineChanged = true;
  doc.iter(function (line) {
    var len = lineLength(line);
    if (len > d.maxLineLength) {
      d.maxLineLength = len;
      d.maxLine = line;
    }
  });
}

// BIDI HELPERS

function iterateBidiSections(order, from, to, f) {
  if (!order) { return f(from, to, "ltr", 0) }
  var found = false;
  for (var i = 0; i < order.length; ++i) {
    var part = order[i];
    if (part.from < to && part.to > from || from == to && part.to == from) {
      f(Math.max(part.from, from), Math.min(part.to, to), part.level == 1 ? "rtl" : "ltr", i);
      found = true;
    }
  }
  if (!found) { f(from, to, "ltr"); }
}

var bidiOther = null;
function getBidiPartAt(order, ch, sticky) {
  var found;
  bidiOther = null;
  for (var i = 0; i < order.length; ++i) {
    var cur = order[i];
    if (cur.from < ch && cur.to > ch) { return i }
    if (cur.to == ch) {
      if (cur.from != cur.to && sticky == "before") { found = i; }
      else { bidiOther = i; }
    }
    if (cur.from == ch) {
      if (cur.from != cur.to && sticky != "before") { found = i; }
      else { bidiOther = i; }
    }
  }
  return found != null ? found : bidiOther
}

// Bidirectional ordering algorithm
// See http://unicode.org/reports/tr9/tr9-13.html for the algorithm
// that this (partially) implements.

// One-char codes used for character types:
// L (L):   Left-to-Right
// R (R):   Right-to-Left
// r (AL):  Right-to-Left Arabic
// 1 (EN):  European Number
// + (ES):  European Number Separator
// % (ET):  European Number Terminator
// n (AN):  Arabic Number
// , (CS):  Common Number Separator
// m (NSM): Non-Spacing Mark
// b (BN):  Boundary Neutral
// s (B):   Paragraph Separator
// t (S):   Segment Separator
// w (WS):  Whitespace
// N (ON):  Other Neutrals

// Returns null if characters are ordered as they appear
// (left-to-right), or an array of sections ({from, to, level}
// objects) in the order in which they occur visually.
var bidiOrdering = (function() {
  // Character types for codepoints 0 to 0xff
  var lowTypes = "bbbbbbbbbtstwsbbbbbbbbbbbbbbssstwNN%%%NNNNNN,N,N1111111111NNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNbbbbbbsbbbbbbbbbbbbbbbbbbbbbbbbbb,N%%%%NNNNLNNNNN%%11NLNNN1LNNNNNLLLLLLLLLLLLLLLLLLLLLLLNLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLN";
  // Character types for codepoints 0x600 to 0x6f9
  var arabicTypes = "nnnnnnNNr%%r,rNNmmmmmmmmmmmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmmmmmmmmnnnnnnnnnn%nnrrrmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmnNmmmmmmrrmmNmmmmrr1111111111";
  function charType(code) {
    if (code <= 0xf7) { return lowTypes.charAt(code) }
    else if (0x590 <= code && code <= 0x5f4) { return "R" }
    else if (0x600 <= code && code <= 0x6f9) { return arabicTypes.charAt(code - 0x600) }
    else if (0x6ee <= code && code <= 0x8ac) { return "r" }
    else if (0x2000 <= code && code <= 0x200b) { return "w" }
    else if (code == 0x200c) { return "b" }
    else { return "L" }
  }

  var bidiRE = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/;
  var isNeutral = /[stwN]/, isStrong = /[LRr]/, countsAsLeft = /[Lb1n]/, countsAsNum = /[1n]/;

  function BidiSpan(level, from, to) {
    this.level = level;
    this.from = from; this.to = to;
  }

  return function(str, direction) {
    var outerType = direction == "ltr" ? "L" : "R";

    if (str.length == 0 || direction == "ltr" && !bidiRE.test(str)) { return false }
    var len = str.length, types = [];
    for (var i = 0; i < len; ++i)
      { types.push(charType(str.charCodeAt(i))); }

    // W1. Examine each non-spacing mark (NSM) in the level run, and
    // change the type of the NSM to the type of the previous
    // character. If the NSM is at the start of the level run, it will
    // get the type of sor.
    for (var i$1 = 0, prev = outerType; i$1 < len; ++i$1) {
      var type = types[i$1];
      if (type == "m") { types[i$1] = prev; }
      else { prev = type; }
    }

    // W2. Search backwards from each instance of a European number
    // until the first strong type (R, L, AL, or sor) is found. If an
    // AL is found, change the type of the European number to Arabic
    // number.
    // W3. Change all ALs to R.
    for (var i$2 = 0, cur = outerType; i$2 < len; ++i$2) {
      var type$1 = types[i$2];
      if (type$1 == "1" && cur == "r") { types[i$2] = "n"; }
      else if (isStrong.test(type$1)) { cur = type$1; if (type$1 == "r") { types[i$2] = "R"; } }
    }

    // W4. A single European separator between two European numbers
    // changes to a European number. A single common separator between
    // two numbers of the same type changes to that type.
    for (var i$3 = 1, prev$1 = types[0]; i$3 < len - 1; ++i$3) {
      var type$2 = types[i$3];
      if (type$2 == "+" && prev$1 == "1" && types[i$3+1] == "1") { types[i$3] = "1"; }
      else if (type$2 == "," && prev$1 == types[i$3+1] &&
               (prev$1 == "1" || prev$1 == "n")) { types[i$3] = prev$1; }
      prev$1 = type$2;
    }

    // W5. A sequence of European terminators adjacent to European
    // numbers changes to all European numbers.
    // W6. Otherwise, separators and terminators change to Other
    // Neutral.
    for (var i$4 = 0; i$4 < len; ++i$4) {
      var type$3 = types[i$4];
      if (type$3 == ",") { types[i$4] = "N"; }
      else if (type$3 == "%") {
        var end = (void 0);
        for (end = i$4 + 1; end < len && types[end] == "%"; ++end) {}
        var replace = (i$4 && types[i$4-1] == "!") || (end < len && types[end] == "1") ? "1" : "N";
        for (var j = i$4; j < end; ++j) { types[j] = replace; }
        i$4 = end - 1;
      }
    }

    // W7. Search backwards from each instance of a European number
    // until the first strong type (R, L, or sor) is found. If an L is
    // found, then change the type of the European number to L.
    for (var i$5 = 0, cur$1 = outerType; i$5 < len; ++i$5) {
      var type$4 = types[i$5];
      if (cur$1 == "L" && type$4 == "1") { types[i$5] = "L"; }
      else if (isStrong.test(type$4)) { cur$1 = type$4; }
    }

    // N1. A sequence of neutrals takes the direction of the
    // surrounding strong text if the text on both sides has the same
    // direction. European and Arabic numbers act as if they were R in
    // terms of their influence on neutrals. Start-of-level-run (sor)
    // and end-of-level-run (eor) are used at level run boundaries.
    // N2. Any remaining neutrals take the embedding direction.
    for (var i$6 = 0; i$6 < len; ++i$6) {
      if (isNeutral.test(types[i$6])) {
        var end$1 = (void 0);
        for (end$1 = i$6 + 1; end$1 < len && isNeutral.test(types[end$1]); ++end$1) {}
        var before = (i$6 ? types[i$6-1] : outerType) == "L";
        var after = (end$1 < len ? types[end$1] : outerType) == "L";
        var replace$1 = before == after ? (before ? "L" : "R") : outerType;
        for (var j$1 = i$6; j$1 < end$1; ++j$1) { types[j$1] = replace$1; }
        i$6 = end$1 - 1;
      }
    }

    // Here we depart from the documented algorithm, in order to avoid
    // building up an actual levels array. Since there are only three
    // levels (0, 1, 2) in an implementation that doesn't take
    // explicit embedding into account, we can build up the order on
    // the fly, without following the level-based algorithm.
    var order = [], m;
    for (var i$7 = 0; i$7 < len;) {
      if (countsAsLeft.test(types[i$7])) {
        var start = i$7;
        for (++i$7; i$7 < len && countsAsLeft.test(types[i$7]); ++i$7) {}
        order.push(new BidiSpan(0, start, i$7));
      } else {
        var pos = i$7, at = order.length;
        for (++i$7; i$7 < len && types[i$7] != "L"; ++i$7) {}
        for (var j$2 = pos; j$2 < i$7;) {
          if (countsAsNum.test(types[j$2])) {
            if (pos < j$2) { order.splice(at, 0, new BidiSpan(1, pos, j$2)); }
            var nstart = j$2;
            for (++j$2; j$2 < i$7 && countsAsNum.test(types[j$2]); ++j$2) {}
            order.splice(at, 0, new BidiSpan(2, nstart, j$2));
            pos = j$2;
          } else { ++j$2; }
        }
        if (pos < i$7) { order.splice(at, 0, new BidiSpan(1, pos, i$7)); }
      }
    }
    if (direction == "ltr") {
      if (order[0].level == 1 && (m = str.match(/^\s+/))) {
        order[0].from = m[0].length;
        order.unshift(new BidiSpan(0, 0, m[0].length));
      }
      if (lst(order).level == 1 && (m = str.match(/\s+$/))) {
        lst(order).to -= m[0].length;
        order.push(new BidiSpan(0, len - m[0].length, len));
      }
    }

    return direction == "rtl" ? order.reverse() : order
  }
})();

// Get the bidi ordering for the given line (and cache it). Returns
// false for lines that are fully left-to-right, and an array of
// BidiSpan objects otherwise.
function getOrder(line, direction) {
  var order = line.order;
  if (order == null) { order = line.order = bidiOrdering(line.text, direction); }
  return order
}

// EVENT HANDLING

// Lightweight event framework. on/off also work on DOM nodes,
// registering native DOM handlers.

var noHandlers = [];

var on = function(emitter, type, f) {
  if (emitter.addEventListener) {
    emitter.addEventListener(type, f, false);
  } else if (emitter.attachEvent) {
    emitter.attachEvent("on" + type, f);
  } else {
    var map$$1 = emitter._handlers || (emitter._handlers = {});
    map$$1[type] = (map$$1[type] || noHandlers).concat(f);
  }
};

function getHandlers(emitter, type) {
  return emitter._handlers && emitter._handlers[type] || noHandlers
}

function off(emitter, type, f) {
  if (emitter.removeEventListener) {
    emitter.removeEventListener(type, f, false);
  } else if (emitter.detachEvent) {
    emitter.detachEvent("on" + type, f);
  } else {
    var map$$1 = emitter._handlers, arr = map$$1 && map$$1[type];
    if (arr) {
      var index = indexOf(arr, f);
      if (index > -1)
        { map$$1[type] = arr.slice(0, index).concat(arr.slice(index + 1)); }
    }
  }
}

function signal(emitter, type /*, values...*/) {
  var handlers = getHandlers(emitter, type);
  if (!handlers.length) { return }
  var args = Array.prototype.slice.call(arguments, 2);
  for (var i = 0; i < handlers.length; ++i) { handlers[i].apply(null, args); }
}

// The DOM events that CodeMirror handles can be overridden by
// registering a (non-DOM) handler on the editor for the event name,
// and preventDefault-ing the event in that handler.
function signalDOMEvent(cm, e, override) {
  if (typeof e == "string")
    { e = {type: e, preventDefault: function() { this.defaultPrevented = true; }}; }
  signal(cm, override || e.type, cm, e);
  return e_defaultPrevented(e) || e.codemirrorIgnore
}

function signalCursorActivity(cm) {
  var arr = cm._handlers && cm._handlers.cursorActivity;
  if (!arr) { return }
  var set = cm.curOp.cursorActivityHandlers || (cm.curOp.cursorActivityHandlers = []);
  for (var i = 0; i < arr.length; ++i) { if (indexOf(set, arr[i]) == -1)
    { set.push(arr[i]); } }
}

function hasHandler(emitter, type) {
  return getHandlers(emitter, type).length > 0
}

// Add on and off methods to a constructor's prototype, to make
// registering events on such objects more convenient.
function eventMixin(ctor) {
  ctor.prototype.on = function(type, f) {on(this, type, f);};
  ctor.prototype.off = function(type, f) {off(this, type, f);};
}

// Due to the fact that we still support jurassic IE versions, some
// compatibility wrappers are needed.

function e_preventDefault(e) {
  if (e.preventDefault) { e.preventDefault(); }
  else { e.returnValue = false; }
}
function e_stopPropagation(e) {
  if (e.stopPropagation) { e.stopPropagation(); }
  else { e.cancelBubble = true; }
}
function e_defaultPrevented(e) {
  return e.defaultPrevented != null ? e.defaultPrevented : e.returnValue == false
}
function e_stop(e) {e_preventDefault(e); e_stopPropagation(e);}

function e_target(e) {return e.target || e.srcElement}
function e_button(e) {
  var b = e.which;
  if (b == null) {
    if (e.button & 1) { b = 1; }
    else if (e.button & 2) { b = 3; }
    else if (e.button & 4) { b = 2; }
  }
  if (mac && e.ctrlKey && b == 1) { b = 3; }
  return b
}

// Detect drag-and-drop
var dragAndDrop = function() {
  // There is *some* kind of drag-and-drop support in IE6-8, but I
  // couldn't get it to work yet.
  if (ie && ie_version < 9) { return false }
  var div = elt('div');
  return "draggable" in div || "dragDrop" in div
}();

var zwspSupported;
function zeroWidthElement(measure) {
  if (zwspSupported == null) {
    var test = elt("span", "\u200b");
    removeChildrenAndAdd(measure, elt("span", [test, document.createTextNode("x")]));
    if (measure.firstChild.offsetHeight != 0)
      { zwspSupported = test.offsetWidth <= 1 && test.offsetHeight > 2 && !(ie && ie_version < 8); }
  }
  var node = zwspSupported ? elt("span", "\u200b") :
    elt("span", "\u00a0", null, "display: inline-block; width: 1px; margin-right: -1px");
  node.setAttribute("cm-text", "");
  return node
}

// Feature-detect IE's crummy client rect reporting for bidi text
var badBidiRects;
function hasBadBidiRects(measure) {
  if (badBidiRects != null) { return badBidiRects }
  var txt = removeChildrenAndAdd(measure, document.createTextNode("A\u062eA"));
  var r0 = range(txt, 0, 1).getBoundingClientRect();
  var r1 = range(txt, 1, 2).getBoundingClientRect();
  removeChildren(measure);
  if (!r0 || r0.left == r0.right) { return false } // Safari returns null in some cases (#2780)
  return badBidiRects = (r1.right - r0.right < 3)
}

// See if "".split is the broken IE version, if so, provide an
// alternative way to split lines.
var splitLinesAuto = "\n\nb".split(/\n/).length != 3 ? function (string) {
  var pos = 0, result = [], l = string.length;
  while (pos <= l) {
    var nl = string.indexOf("\n", pos);
    if (nl == -1) { nl = string.length; }
    var line = string.slice(pos, string.charAt(nl - 1) == "\r" ? nl - 1 : nl);
    var rt = line.indexOf("\r");
    if (rt != -1) {
      result.push(line.slice(0, rt));
      pos += rt + 1;
    } else {
      result.push(line);
      pos = nl + 1;
    }
  }
  return result
} : function (string) { return string.split(/\r\n?|\n/); };

var hasSelection = window.getSelection ? function (te) {
  try { return te.selectionStart != te.selectionEnd }
  catch(e) { return false }
} : function (te) {
  var range$$1;
  try {range$$1 = te.ownerDocument.selection.createRange();}
  catch(e) {}
  if (!range$$1 || range$$1.parentElement() != te) { return false }
  return range$$1.compareEndPoints("StartToEnd", range$$1) != 0
};

var hasCopyEvent = (function () {
  var e = elt("div");
  if ("oncopy" in e) { return true }
  e.setAttribute("oncopy", "return;");
  return typeof e.oncopy == "function"
})();

var badZoomedRects = null;
function hasBadZoomedRects(measure) {
  if (badZoomedRects != null) { return badZoomedRects }
  var node = removeChildrenAndAdd(measure, elt("span", "x"));
  var normal = node.getBoundingClientRect();
  var fromRange = range(node, 0, 1).getBoundingClientRect();
  return badZoomedRects = Math.abs(normal.left - fromRange.left) > 1
}

// Known modes, by name and by MIME
var modes = {};
var mimeModes = {};

// Extra arguments are stored as the mode's dependencies, which is
// used by (legacy) mechanisms like loadmode.js to automatically
// load a mode. (Preferred mechanism is the require/define calls.)
function defineMode(name, mode) {
  if (arguments.length > 2)
    { mode.dependencies = Array.prototype.slice.call(arguments, 2); }
  modes[name] = mode;
}

function defineMIME(mime, spec) {
  mimeModes[mime] = spec;
}

// Given a MIME type, a {name, ...options} config object, or a name
// string, return a mode config object.
function resolveMode(spec) {
  if (typeof spec == "string" && mimeModes.hasOwnProperty(spec)) {
    spec = mimeModes[spec];
  } else if (spec && typeof spec.name == "string" && mimeModes.hasOwnProperty(spec.name)) {
    var found = mimeModes[spec.name];
    if (typeof found == "string") { found = {name: found}; }
    spec = createObj(found, spec);
    spec.name = found.name;
  } else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+xml$/.test(spec)) {
    return resolveMode("application/xml")
  } else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+json$/.test(spec)) {
    return resolveMode("application/json")
  }
  if (typeof spec == "string") { return {name: spec} }
  else { return spec || {name: "null"} }
}

// Given a mode spec (anything that resolveMode accepts), find and
// initialize an actual mode object.
function getMode(options, spec) {
  spec = resolveMode(spec);
  var mfactory = modes[spec.name];
  if (!mfactory) { return getMode(options, "text/plain") }
  var modeObj = mfactory(options, spec);
  if (modeExtensions.hasOwnProperty(spec.name)) {
    var exts = modeExtensions[spec.name];
    for (var prop in exts) {
      if (!exts.hasOwnProperty(prop)) { continue }
      if (modeObj.hasOwnProperty(prop)) { modeObj["_" + prop] = modeObj[prop]; }
      modeObj[prop] = exts[prop];
    }
  }
  modeObj.name = spec.name;
  if (spec.helperType) { modeObj.helperType = spec.helperType; }
  if (spec.modeProps) { for (var prop$1 in spec.modeProps)
    { modeObj[prop$1] = spec.modeProps[prop$1]; } }

  return modeObj
}

// This can be used to attach properties to mode objects from
// outside the actual mode definition.
var modeExtensions = {};
function extendMode(mode, properties) {
  var exts = modeExtensions.hasOwnProperty(mode) ? modeExtensions[mode] : (modeExtensions[mode] = {});
  copyObj(properties, exts);
}

function copyState(mode, state) {
  if (state === true) { return state }
  if (mode.copyState) { return mode.copyState(state) }
  var nstate = {};
  for (var n in state) {
    var val = state[n];
    if (val instanceof Array) { val = val.concat([]); }
    nstate[n] = val;
  }
  return nstate
}

// Given a mode and a state (for that mode), find the inner mode and
// state at the position that the state refers to.
function innerMode(mode, state) {
  var info;
  while (mode.innerMode) {
    info = mode.innerMode(state);
    if (!info || info.mode == mode) { break }
    state = info.state;
    mode = info.mode;
  }
  return info || {mode: mode, state: state}
}

function startState(mode, a1, a2) {
  return mode.startState ? mode.startState(a1, a2) : true
}

// STRING STREAM

// Fed to the mode parsers, provides helper functions to make
// parsers more succinct.

var StringStream = function(string, tabSize, lineOracle) {
  this.pos = this.start = 0;
  this.string = string;
  this.tabSize = tabSize || 8;
  this.lastColumnPos = this.lastColumnValue = 0;
  this.lineStart = 0;
  this.lineOracle = lineOracle;
};

StringStream.prototype.eol = function () {return this.pos >= this.string.length};
StringStream.prototype.sol = function () {return this.pos == this.lineStart};
StringStream.prototype.peek = function () {return this.string.charAt(this.pos) || undefined};
StringStream.prototype.next = function () {
  if (this.pos < this.string.length)
    { return this.string.charAt(this.pos++) }
};
StringStream.prototype.eat = function (match) {
  var ch = this.string.charAt(this.pos);
  var ok;
  if (typeof match == "string") { ok = ch == match; }
  else { ok = ch && (match.test ? match.test(ch) : match(ch)); }
  if (ok) {++this.pos; return ch}
};
StringStream.prototype.eatWhile = function (match) {
  var start = this.pos;
  while (this.eat(match)){}
  return this.pos > start
};
StringStream.prototype.eatSpace = function () {
    var this$1 = this;

  var start = this.pos;
  while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) { ++this$1.pos; }
  return this.pos > start
};
StringStream.prototype.skipToEnd = function () {this.pos = this.string.length;};
StringStream.prototype.skipTo = function (ch) {
  var found = this.string.indexOf(ch, this.pos);
  if (found > -1) {this.pos = found; return true}
};
StringStream.prototype.backUp = function (n) {this.pos -= n;};
StringStream.prototype.column = function () {
  if (this.lastColumnPos < this.start) {
    this.lastColumnValue = countColumn(this.string, this.start, this.tabSize, this.lastColumnPos, this.lastColumnValue);
    this.lastColumnPos = this.start;
  }
  return this.lastColumnValue - (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
};
StringStream.prototype.indentation = function () {
  return countColumn(this.string, null, this.tabSize) -
    (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
};
StringStream.prototype.match = function (pattern, consume, caseInsensitive) {
  if (typeof pattern == "string") {
    var cased = function (str) { return caseInsensitive ? str.toLowerCase() : str; };
    var substr = this.string.substr(this.pos, pattern.length);
    if (cased(substr) == cased(pattern)) {
      if (consume !== false) { this.pos += pattern.length; }
      return true
    }
  } else {
    var match = this.string.slice(this.pos).match(pattern);
    if (match && match.index > 0) { return null }
    if (match && consume !== false) { this.pos += match[0].length; }
    return match
  }
};
StringStream.prototype.current = function (){return this.string.slice(this.start, this.pos)};
StringStream.prototype.hideFirstChars = function (n, inner) {
  this.lineStart += n;
  try { return inner() }
  finally { this.lineStart -= n; }
};
StringStream.prototype.lookAhead = function (n) {
  var oracle = this.lineOracle;
  return oracle && oracle.lookAhead(n)
};
StringStream.prototype.baseToken = function () {
  var oracle = this.lineOracle;
  return oracle && oracle.baseToken(this.pos)
};

var SavedContext = function(state, lookAhead) {
  this.state = state;
  this.lookAhead = lookAhead;
};

var Context = function(doc, state, line, lookAhead) {
  this.state = state;
  this.doc = doc;
  this.line = line;
  this.maxLookAhead = lookAhead || 0;
  this.baseTokens = null;
  this.baseTokenPos = 1;
};

Context.prototype.lookAhead = function (n) {
  var line = this.doc.getLine(this.line + n);
  if (line != null && n > this.maxLookAhead) { this.maxLookAhead = n; }
  return line
};

Context.prototype.baseToken = function (n) {
    var this$1 = this;

  if (!this.baseTokens) { return null }
  while (this.baseTokens[this.baseTokenPos] <= n)
    { this$1.baseTokenPos += 2; }
  var type = this.baseTokens[this.baseTokenPos + 1];
  return {type: type && type.replace(/( |^)overlay .*/, ""),
          size: this.baseTokens[this.baseTokenPos] - n}
};

Context.prototype.nextLine = function () {
  this.line++;
  if (this.maxLookAhead > 0) { this.maxLookAhead--; }
};

Context.fromSaved = function (doc, saved, line) {
  if (saved instanceof SavedContext)
    { return new Context(doc, copyState(doc.mode, saved.state), line, saved.lookAhead) }
  else
    { return new Context(doc, copyState(doc.mode, saved), line) }
};

Context.prototype.save = function (copy) {
  var state = copy !== false ? copyState(this.doc.mode, this.state) : this.state;
  return this.maxLookAhead > 0 ? new SavedContext(state, this.maxLookAhead) : state
};


// Compute a style array (an array starting with a mode generation
// -- for invalidation -- followed by pairs of end positions and
// style strings), which is used to highlight the tokens on the
// line.
function highlightLine(cm, line, context, forceToEnd) {
  // A styles array always starts with a number identifying the
  // mode/overlays that it is based on (for easy invalidation).
  var st = [cm.state.modeGen], lineClasses = {};
  // Compute the base array of styles
  runMode(cm, line.text, cm.doc.mode, context, function (end, style) { return st.push(end, style); },
          lineClasses, forceToEnd);
  var state = context.state;

  // Run overlays, adjust style array.
  var loop = function ( o ) {
    context.baseTokens = st;
    var overlay = cm.state.overlays[o], i = 1, at = 0;
    context.state = true;
    runMode(cm, line.text, overlay.mode, context, function (end, style) {
      var start = i;
      // Ensure there's a token end at the current position, and that i points at it
      while (at < end) {
        var i_end = st[i];
        if (i_end > end)
          { st.splice(i, 1, end, st[i+1], i_end); }
        i += 2;
        at = Math.min(end, i_end);
      }
      if (!style) { return }
      if (overlay.opaque) {
        st.splice(start, i - start, end, "overlay " + style);
        i = start + 2;
      } else {
        for (; start < i; start += 2) {
          var cur = st[start+1];
          st[start+1] = (cur ? cur + " " : "") + "overlay " + style;
        }
      }
    }, lineClasses);
    context.state = state;
    context.baseTokens = null;
    context.baseTokenPos = 1;
  };

  for (var o = 0; o < cm.state.overlays.length; ++o) loop( o );

  return {styles: st, classes: lineClasses.bgClass || lineClasses.textClass ? lineClasses : null}
}

function getLineStyles(cm, line, updateFrontier) {
  if (!line.styles || line.styles[0] != cm.state.modeGen) {
    var context = getContextBefore(cm, lineNo(line));
    var resetState = line.text.length > cm.options.maxHighlightLength && copyState(cm.doc.mode, context.state);
    var result = highlightLine(cm, line, context);
    if (resetState) { context.state = resetState; }
    line.stateAfter = context.save(!resetState);
    line.styles = result.styles;
    if (result.classes) { line.styleClasses = result.classes; }
    else if (line.styleClasses) { line.styleClasses = null; }
    if (updateFrontier === cm.doc.highlightFrontier)
      { cm.doc.modeFrontier = Math.max(cm.doc.modeFrontier, ++cm.doc.highlightFrontier); }
  }
  return line.styles
}

function getContextBefore(cm, n, precise) {
  var doc = cm.doc, display = cm.display;
  if (!doc.mode.startState) { return new Context(doc, true, n) }
  var start = findStartLine(cm, n, precise);
  var saved = start > doc.first && getLine(doc, start - 1).stateAfter;
  var context = saved ? Context.fromSaved(doc, saved, start) : new Context(doc, startState(doc.mode), start);

  doc.iter(start, n, function (line) {
    processLine(cm, line.text, context);
    var pos = context.line;
    line.stateAfter = pos == n - 1 || pos % 5 == 0 || pos >= display.viewFrom && pos < display.viewTo ? context.save() : null;
    context.nextLine();
  });
  if (precise) { doc.modeFrontier = context.line; }
  return context
}

// Lightweight form of highlight -- proceed over this line and
// update state, but don't save a style array. Used for lines that
// aren't currently visible.
function processLine(cm, text, context, startAt) {
  var mode = cm.doc.mode;
  var stream = new StringStream(text, cm.options.tabSize, context);
  stream.start = stream.pos = startAt || 0;
  if (text == "") { callBlankLine(mode, context.state); }
  while (!stream.eol()) {
    readToken(mode, stream, context.state);
    stream.start = stream.pos;
  }
}

function callBlankLine(mode, state) {
  if (mode.blankLine) { return mode.blankLine(state) }
  if (!mode.innerMode) { return }
  var inner = innerMode(mode, state);
  if (inner.mode.blankLine) { return inner.mode.blankLine(inner.state) }
}

function readToken(mode, stream, state, inner) {
  for (var i = 0; i < 10; i++) {
    if (inner) { inner[0] = innerMode(mode, state).mode; }
    var style = mode.token(stream, state);
    if (stream.pos > stream.start) { return style }
  }
  throw new Error("Mode " + mode.name + " failed to advance stream.")
}

var Token = function(stream, type, state) {
  this.start = stream.start; this.end = stream.pos;
  this.string = stream.current();
  this.type = type || null;
  this.state = state;
};

// Utility for getTokenAt and getLineTokens
function takeToken(cm, pos, precise, asArray) {
  var doc = cm.doc, mode = doc.mode, style;
  pos = clipPos(doc, pos);
  var line = getLine(doc, pos.line), context = getContextBefore(cm, pos.line, precise);
  var stream = new StringStream(line.text, cm.options.tabSize, context), tokens;
  if (asArray) { tokens = []; }
  while ((asArray || stream.pos < pos.ch) && !stream.eol()) {
    stream.start = stream.pos;
    style = readToken(mode, stream, context.state);
    if (asArray) { tokens.push(new Token(stream, style, copyState(doc.mode, context.state))); }
  }
  return asArray ? tokens : new Token(stream, style, context.state)
}

function extractLineClasses(type, output) {
  if (type) { for (;;) {
    var lineClass = type.match(/(?:^|\s+)line-(background-)?(\S+)/);
    if (!lineClass) { break }
    type = type.slice(0, lineClass.index) + type.slice(lineClass.index + lineClass[0].length);
    var prop = lineClass[1] ? "bgClass" : "textClass";
    if (output[prop] == null)
      { output[prop] = lineClass[2]; }
    else if (!(new RegExp("(?:^|\s)" + lineClass[2] + "(?:$|\s)")).test(output[prop]))
      { output[prop] += " " + lineClass[2]; }
  } }
  return type
}

// Run the given mode's parser over a line, calling f for each token.
function runMode(cm, text, mode, context, f, lineClasses, forceToEnd) {
  var flattenSpans = mode.flattenSpans;
  if (flattenSpans == null) { flattenSpans = cm.options.flattenSpans; }
  var curStart = 0, curStyle = null;
  var stream = new StringStream(text, cm.options.tabSize, context), style;
  var inner = cm.options.addModeClass && [null];
  if (text == "") { extractLineClasses(callBlankLine(mode, context.state), lineClasses); }
  while (!stream.eol()) {
    if (stream.pos > cm.options.maxHighlightLength) {
      flattenSpans = false;
      if (forceToEnd) { processLine(cm, text, context, stream.pos); }
      stream.pos = text.length;
      style = null;
    } else {
      style = extractLineClasses(readToken(mode, stream, context.state, inner), lineClasses);
    }
    if (inner) {
      var mName = inner[0].name;
      if (mName) { style = "m-" + (style ? mName + " " + style : mName); }
    }
    if (!flattenSpans || curStyle != style) {
      while (curStart < stream.start) {
        curStart = Math.min(stream.start, curStart + 5000);
        f(curStart, curStyle);
      }
      curStyle = style;
    }
    stream.start = stream.pos;
  }
  while (curStart < stream.pos) {
    // Webkit seems to refuse to render text nodes longer than 57444
    // characters, and returns inaccurate measurements in nodes
    // starting around 5000 chars.
    var pos = Math.min(stream.pos, curStart + 5000);
    f(pos, curStyle);
    curStart = pos;
  }
}

// Finds the line to start with when starting a parse. Tries to
// find a line with a stateAfter, so that it can start with a
// valid state. If that fails, it returns the line with the
// smallest indentation, which tends to need the least context to
// parse correctly.
function findStartLine(cm, n, precise) {
  var minindent, minline, doc = cm.doc;
  var lim = precise ? -1 : n - (cm.doc.mode.innerMode ? 1000 : 100);
  for (var search = n; search > lim; --search) {
    if (search <= doc.first) { return doc.first }
    var line = getLine(doc, search - 1), after = line.stateAfter;
    if (after && (!precise || search + (after instanceof SavedContext ? after.lookAhead : 0) <= doc.modeFrontier))
      { return search }
    var indented = countColumn(line.text, null, cm.options.tabSize);
    if (minline == null || minindent > indented) {
      minline = search - 1;
      minindent = indented;
    }
  }
  return minline
}

function retreatFrontier(doc, n) {
  doc.modeFrontier = Math.min(doc.modeFrontier, n);
  if (doc.highlightFrontier < n - 10) { return }
  var start = doc.first;
  for (var line = n - 1; line > start; line--) {
    var saved = getLine(doc, line).stateAfter;
    // change is on 3
    // state on line 1 looked ahead 2 -- so saw 3
    // test 1 + 2 < 3 should cover this
    if (saved && (!(saved instanceof SavedContext) || line + saved.lookAhead < n)) {
      start = line + 1;
      break
    }
  }
  doc.highlightFrontier = Math.min(doc.highlightFrontier, start);
}

// LINE DATA STRUCTURE

// Line objects. These hold state related to a line, including
// highlighting info (the styles array).
var Line = function(text, markedSpans, estimateHeight) {
  this.text = text;
  attachMarkedSpans(this, markedSpans);
  this.height = estimateHeight ? estimateHeight(this) : 1;
};

Line.prototype.lineNo = function () { return lineNo(this) };
eventMixin(Line);

// Change the content (text, markers) of a line. Automatically
// invalidates cached information and tries to re-estimate the
// line's height.
function updateLine(line, text, markedSpans, estimateHeight) {
  line.text = text;
  if (line.stateAfter) { line.stateAfter = null; }
  if (line.styles) { line.styles = null; }
  if (line.order != null) { line.order = null; }
  detachMarkedSpans(line);
  attachMarkedSpans(line, markedSpans);
  var estHeight = estimateHeight ? estimateHeight(line) : 1;
  if (estHeight != line.height) { updateLineHeight(line, estHeight); }
}

// Detach a line from the document tree and its markers.
function cleanUpLine(line) {
  line.parent = null;
  detachMarkedSpans(line);
}

// Convert a style as returned by a mode (either null, or a string
// containing one or more styles) to a CSS style. This is cached,
// and also looks for line-wide styles.
var styleToClassCache = {};
var styleToClassCacheWithMode = {};
function interpretTokenStyle(style, options) {
  if (!style || /^\s*$/.test(style)) { return null }
  var cache = options.addModeClass ? styleToClassCacheWithMode : styleToClassCache;
  return cache[style] ||
    (cache[style] = style.replace(/\S+/g, "cm-$&"))
}

// Render the DOM representation of the text of a line. Also builds
// up a 'line map', which points at the DOM nodes that represent
// specific stretches of text, and is used by the measuring code.
// The returned object contains the DOM node, this map, and
// information about line-wide styles that were set by the mode.
function buildLineContent(cm, lineView) {
  // The padding-right forces the element to have a 'border', which
  // is needed on Webkit to be able to get line-level bounding
  // rectangles for it (in measureChar).
  var content = eltP("span", null, null, webkit ? "padding-right: .1px" : null);
  var builder = {pre: eltP("pre", [content], "CodeMirror-line"), content: content,
                 col: 0, pos: 0, cm: cm,
                 trailingSpace: false,
                 splitSpaces: (ie || webkit) && cm.getOption("lineWrapping")};
  lineView.measure = {};

  // Iterate over the logical lines that make up this visual line.
  for (var i = 0; i <= (lineView.rest ? lineView.rest.length : 0); i++) {
    var line = i ? lineView.rest[i - 1] : lineView.line, order = (void 0);
    builder.pos = 0;
    builder.addToken = buildToken;
    // Optionally wire in some hacks into the token-rendering
    // algorithm, to deal with browser quirks.
    if (hasBadBidiRects(cm.display.measure) && (order = getOrder(line, cm.doc.direction)))
      { builder.addToken = buildTokenBadBidi(builder.addToken, order); }
    builder.map = [];
    var allowFrontierUpdate = lineView != cm.display.externalMeasured && lineNo(line);
    insertLineContent(line, builder, getLineStyles(cm, line, allowFrontierUpdate));
    if (line.styleClasses) {
      if (line.styleClasses.bgClass)
        { builder.bgClass = joinClasses(line.styleClasses.bgClass, builder.bgClass || ""); }
      if (line.styleClasses.textClass)
        { builder.textClass = joinClasses(line.styleClasses.textClass, builder.textClass || ""); }
    }

    // Ensure at least a single node is present, for measuring.
    if (builder.map.length == 0)
      { builder.map.push(0, 0, builder.content.appendChild(zeroWidthElement(cm.display.measure))); }

    // Store the map and a cache object for the current logical line
    if (i == 0) {
      lineView.measure.map = builder.map;
      lineView.measure.cache = {};
    } else {
      (lineView.measure.maps || (lineView.measure.maps = [])).push(builder.map)
      ;(lineView.measure.caches || (lineView.measure.caches = [])).push({});
    }
  }

  // See issue #2901
  if (webkit) {
    var last = builder.content.lastChild;
    if (/\bcm-tab\b/.test(last.className) || (last.querySelector && last.querySelector(".cm-tab")))
      { builder.content.className = "cm-tab-wrap-hack"; }
  }

  signal(cm, "renderLine", cm, lineView.line, builder.pre);
  if (builder.pre.className)
    { builder.textClass = joinClasses(builder.pre.className, builder.textClass || ""); }

  return builder
}

function defaultSpecialCharPlaceholder(ch) {
  var token = elt("span", "\u2022", "cm-invalidchar");
  token.title = "\\u" + ch.charCodeAt(0).toString(16);
  token.setAttribute("aria-label", token.title);
  return token
}

// Build up the DOM representation for a single token, and add it to
// the line map. Takes care to render special characters separately.
function buildToken(builder, text, style, startStyle, endStyle, title, css) {
  if (!text) { return }
  var displayText = builder.splitSpaces ? splitSpaces(text, builder.trailingSpace) : text;
  var special = builder.cm.state.specialChars, mustWrap = false;
  var content;
  if (!special.test(text)) {
    builder.col += text.length;
    content = document.createTextNode(displayText);
    builder.map.push(builder.pos, builder.pos + text.length, content);
    if (ie && ie_version < 9) { mustWrap = true; }
    builder.pos += text.length;
  } else {
    content = document.createDocumentFragment();
    var pos = 0;
    while (true) {
      special.lastIndex = pos;
      var m = special.exec(text);
      var skipped = m ? m.index - pos : text.length - pos;
      if (skipped) {
        var txt = document.createTextNode(displayText.slice(pos, pos + skipped));
        if (ie && ie_version < 9) { content.appendChild(elt("span", [txt])); }
        else { content.appendChild(txt); }
        builder.map.push(builder.pos, builder.pos + skipped, txt);
        builder.col += skipped;
        builder.pos += skipped;
      }
      if (!m) { break }
      pos += skipped + 1;
      var txt$1 = (void 0);
      if (m[0] == "\t") {
        var tabSize = builder.cm.options.tabSize, tabWidth = tabSize - builder.col % tabSize;
        txt$1 = content.appendChild(elt("span", spaceStr(tabWidth), "cm-tab"));
        txt$1.setAttribute("role", "presentation");
        txt$1.setAttribute("cm-text", "\t");
        builder.col += tabWidth;
      } else if (m[0] == "\r" || m[0] == "\n") {
        txt$1 = content.appendChild(elt("span", m[0] == "\r" ? "\u240d" : "\u2424", "cm-invalidchar"));
        txt$1.setAttribute("cm-text", m[0]);
        builder.col += 1;
      } else {
        txt$1 = builder.cm.options.specialCharPlaceholder(m[0]);
        txt$1.setAttribute("cm-text", m[0]);
        if (ie && ie_version < 9) { content.appendChild(elt("span", [txt$1])); }
        else { content.appendChild(txt$1); }
        builder.col += 1;
      }
      builder.map.push(builder.pos, builder.pos + 1, txt$1);
      builder.pos++;
    }
  }
  builder.trailingSpace = displayText.charCodeAt(text.length - 1) == 32;
  if (style || startStyle || endStyle || mustWrap || css) {
    var fullStyle = style || "";
    if (startStyle) { fullStyle += startStyle; }
    if (endStyle) { fullStyle += endStyle; }
    var token = elt("span", [content], fullStyle, css);
    if (title) { token.title = title; }
    return builder.content.appendChild(token)
  }
  builder.content.appendChild(content);
}

function splitSpaces(text, trailingBefore) {
  if (text.length > 1 && !/  /.test(text)) { return text }
  var spaceBefore = trailingBefore, result = "";
  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i);
    if (ch == " " && spaceBefore && (i == text.length - 1 || text.charCodeAt(i + 1) == 32))
      { ch = "\u00a0"; }
    result += ch;
    spaceBefore = ch == " ";
  }
  return result
}

// Work around nonsense dimensions being reported for stretches of
// right-to-left text.
function buildTokenBadBidi(inner, order) {
  return function (builder, text, style, startStyle, endStyle, title, css) {
    style = style ? style + " cm-force-border" : "cm-force-border";
    var start = builder.pos, end = start + text.length;
    for (;;) {
      // Find the part that overlaps with the start of this text
      var part = (void 0);
      for (var i = 0; i < order.length; i++) {
        part = order[i];
        if (part.to > start && part.from <= start) { break }
      }
      if (part.to >= end) { return inner(builder, text, style, startStyle, endStyle, title, css) }
      inner(builder, text.slice(0, part.to - start), style, startStyle, null, title, css);
      startStyle = null;
      text = text.slice(part.to - start);
      start = part.to;
    }
  }
}

function buildCollapsedSpan(builder, size, marker, ignoreWidget) {
  var widget = !ignoreWidget && marker.widgetNode;
  if (widget) { builder.map.push(builder.pos, builder.pos + size, widget); }
  if (!ignoreWidget && builder.cm.display.input.needsContentAttribute) {
    if (!widget)
      { widget = builder.content.appendChild(document.createElement("span")); }
    widget.setAttribute("cm-marker", marker.id);
  }
  if (widget) {
    builder.cm.display.input.setUneditable(widget);
    builder.content.appendChild(widget);
  }
  builder.pos += size;
  builder.trailingSpace = false;
}

// Outputs a number of spans to make up a line, taking highlighting
// and marked text into account.
function insertLineContent(line, builder, styles) {
  var spans = line.markedSpans, allText = line.text, at = 0;
  if (!spans) {
    for (var i$1 = 1; i$1 < styles.length; i$1+=2)
      { builder.addToken(builder, allText.slice(at, at = styles[i$1]), interpretTokenStyle(styles[i$1+1], builder.cm.options)); }
    return
  }

  var len = allText.length, pos = 0, i = 1, text = "", style, css;
  var nextChange = 0, spanStyle, spanEndStyle, spanStartStyle, title, collapsed;
  for (;;) {
    if (nextChange == pos) { // Update current marker set
      spanStyle = spanEndStyle = spanStartStyle = title = css = "";
      collapsed = null; nextChange = Infinity;
      var foundBookmarks = [], endStyles = (void 0);
      for (var j = 0; j < spans.length; ++j) {
        var sp = spans[j], m = sp.marker;
        if (m.type == "bookmark" && sp.from == pos && m.widgetNode) {
          foundBookmarks.push(m);
        } else if (sp.from <= pos && (sp.to == null || sp.to > pos || m.collapsed && sp.to == pos && sp.from == pos)) {
          if (sp.to != null && sp.to != pos && nextChange > sp.to) {
            nextChange = sp.to;
            spanEndStyle = "";
          }
          if (m.className) { spanStyle += " " + m.className; }
          if (m.css) { css = (css ? css + ";" : "") + m.css; }
          if (m.startStyle && sp.from == pos) { spanStartStyle += " " + m.startStyle; }
          if (m.endStyle && sp.to == nextChange) { (endStyles || (endStyles = [])).push(m.endStyle, sp.to); }
          if (m.title && !title) { title = m.title; }
          if (m.collapsed && (!collapsed || compareCollapsedMarkers(collapsed.marker, m) < 0))
            { collapsed = sp; }
        } else if (sp.from > pos && nextChange > sp.from) {
          nextChange = sp.from;
        }
      }
      if (endStyles) { for (var j$1 = 0; j$1 < endStyles.length; j$1 += 2)
        { if (endStyles[j$1 + 1] == nextChange) { spanEndStyle += " " + endStyles[j$1]; } } }

      if (!collapsed || collapsed.from == pos) { for (var j$2 = 0; j$2 < foundBookmarks.length; ++j$2)
        { buildCollapsedSpan(builder, 0, foundBookmarks[j$2]); } }
      if (collapsed && (collapsed.from || 0) == pos) {
        buildCollapsedSpan(builder, (collapsed.to == null ? len + 1 : collapsed.to) - pos,
                           collapsed.marker, collapsed.from == null);
        if (collapsed.to == null) { return }
        if (collapsed.to == pos) { collapsed = false; }
      }
    }
    if (pos >= len) { break }

    var upto = Math.min(len, nextChange);
    while (true) {
      if (text) {
        var end = pos + text.length;
        if (!collapsed) {
          var tokenText = end > upto ? text.slice(0, upto - pos) : text;
          builder.addToken(builder, tokenText, style ? style + spanStyle : spanStyle,
                           spanStartStyle, pos + tokenText.length == nextChange ? spanEndStyle : "", title, css);
        }
        if (end >= upto) {text = text.slice(upto - pos); pos = upto; break}
        pos = end;
        spanStartStyle = "";
      }
      text = allText.slice(at, at = styles[i++]);
      style = interpretTokenStyle(styles[i++], builder.cm.options);
    }
  }
}


// These objects are used to represent the visible (currently drawn)
// part of the document. A LineView may correspond to multiple
// logical lines, if those are connected by collapsed ranges.
function LineView(doc, line, lineN) {
  // The starting line
  this.line = line;
  // Continuing lines, if any
  this.rest = visualLineContinued(line);
  // Number of logical lines in this visual line
  this.size = this.rest ? lineNo(lst(this.rest)) - lineN + 1 : 1;
  this.node = this.text = null;
  this.hidden = lineIsHidden(doc, line);
}

// Create a range of LineView objects for the given lines.
function buildViewArray(cm, from, to) {
  var array = [], nextPos;
  for (var pos = from; pos < to; pos = nextPos) {
    var view = new LineView(cm.doc, getLine(cm.doc, pos), pos);
    nextPos = pos + view.size;
    array.push(view);
  }
  return array
}

var operationGroup = null;

function pushOperation(op) {
  if (operationGroup) {
    operationGroup.ops.push(op);
  } else {
    op.ownsGroup = operationGroup = {
      ops: [op],
      delayedCallbacks: []
    };
  }
}

function fireCallbacksForOps(group) {
  // Calls delayed callbacks and cursorActivity handlers until no
  // new ones appear
  var callbacks = group.delayedCallbacks, i = 0;
  do {
    for (; i < callbacks.length; i++)
      { callbacks[i].call(null); }
    for (var j = 0; j < group.ops.length; j++) {
      var op = group.ops[j];
      if (op.cursorActivityHandlers)
        { while (op.cursorActivityCalled < op.cursorActivityHandlers.length)
          { op.cursorActivityHandlers[op.cursorActivityCalled++].call(null, op.cm); } }
    }
  } while (i < callbacks.length)
}

function finishOperation(op, endCb) {
  var group = op.ownsGroup;
  if (!group) { return }

  try { fireCallbacksForOps(group); }
  finally {
    operationGroup = null;
    endCb(group);
  }
}

var orphanDelayedCallbacks = null;

// Often, we want to signal events at a point where we are in the
// middle of some work, but don't want the handler to start calling
// other methods on the editor, which might be in an inconsistent
// state or simply not expect any other events to happen.
// signalLater looks whether there are any handlers, and schedules
// them to be executed when the last operation ends, or, if no
// operation is active, when a timeout fires.
function signalLater(emitter, type /*, values...*/) {
  var arr = getHandlers(emitter, type);
  if (!arr.length) { return }
  var args = Array.prototype.slice.call(arguments, 2), list;
  if (operationGroup) {
    list = operationGroup.delayedCallbacks;
  } else if (orphanDelayedCallbacks) {
    list = orphanDelayedCallbacks;
  } else {
    list = orphanDelayedCallbacks = [];
    setTimeout(fireOrphanDelayed, 0);
  }
  var loop = function ( i ) {
    list.push(function () { return arr[i].apply(null, args); });
  };

  for (var i = 0; i < arr.length; ++i)
    loop( i );
}

function fireOrphanDelayed() {
  var delayed = orphanDelayedCallbacks;
  orphanDelayedCallbacks = null;
  for (var i = 0; i < delayed.length; ++i) { delayed[i](); }
}

// When an aspect of a line changes, a string is added to
// lineView.changes. This updates the relevant part of the line's
// DOM structure.
function updateLineForChanges(cm, lineView, lineN, dims) {
  for (var j = 0; j < lineView.changes.length; j++) {
    var type = lineView.changes[j];
    if (type == "text") { updateLineText(cm, lineView); }
    else if (type == "gutter") { updateLineGutter(cm, lineView, lineN, dims); }
    else if (type == "class") { updateLineClasses(cm, lineView); }
    else if (type == "widget") { updateLineWidgets(cm, lineView, dims); }
  }
  lineView.changes = null;
}

// Lines with gutter elements, widgets or a background class need to
// be wrapped, and have the extra elements added to the wrapper div
function ensureLineWrapped(lineView) {
  if (lineView.node == lineView.text) {
    lineView.node = elt("div", null, null, "position: relative");
    if (lineView.text.parentNode)
      { lineView.text.parentNode.replaceChild(lineView.node, lineView.text); }
    lineView.node.appendChild(lineView.text);
    if (ie && ie_version < 8) { lineView.node.style.zIndex = 2; }
  }
  return lineView.node
}

function updateLineBackground(cm, lineView) {
  var cls = lineView.bgClass ? lineView.bgClass + " " + (lineView.line.bgClass || "") : lineView.line.bgClass;
  if (cls) { cls += " CodeMirror-linebackground"; }
  if (lineView.background) {
    if (cls) { lineView.background.className = cls; }
    else { lineView.background.parentNode.removeChild(lineView.background); lineView.background = null; }
  } else if (cls) {
    var wrap = ensureLineWrapped(lineView);
    lineView.background = wrap.insertBefore(elt("div", null, cls), wrap.firstChild);
    cm.display.input.setUneditable(lineView.background);
  }
}

// Wrapper around buildLineContent which will reuse the structure
// in display.externalMeasured when possible.
function getLineContent(cm, lineView) {
  var ext = cm.display.externalMeasured;
  if (ext && ext.line == lineView.line) {
    cm.display.externalMeasured = null;
    lineView.measure = ext.measure;
    return ext.built
  }
  return buildLineContent(cm, lineView)
}

// Redraw the line's text. Interacts with the background and text
// classes because the mode may output tokens that influence these
// classes.
function updateLineText(cm, lineView) {
  var cls = lineView.text.className;
  var built = getLineContent(cm, lineView);
  if (lineView.text == lineView.node) { lineView.node = built.pre; }
  lineView.text.parentNode.replaceChild(built.pre, lineView.text);
  lineView.text = built.pre;
  if (built.bgClass != lineView.bgClass || built.textClass != lineView.textClass) {
    lineView.bgClass = built.bgClass;
    lineView.textClass = built.textClass;
    updateLineClasses(cm, lineView);
  } else if (cls) {
    lineView.text.className = cls;
  }
}

function updateLineClasses(cm, lineView) {
  updateLineBackground(cm, lineView);
  if (lineView.line.wrapClass)
    { ensureLineWrapped(lineView).className = lineView.line.wrapClass; }
  else if (lineView.node != lineView.text)
    { lineView.node.className = ""; }
  var textClass = lineView.textClass ? lineView.textClass + " " + (lineView.line.textClass || "") : lineView.line.textClass;
  lineView.text.className = textClass || "";
}

function updateLineGutter(cm, lineView, lineN, dims) {
  if (lineView.gutter) {
    lineView.node.removeChild(lineView.gutter);
    lineView.gutter = null;
  }
  if (lineView.gutterBackground) {
    lineView.node.removeChild(lineView.gutterBackground);
    lineView.gutterBackground = null;
  }
  if (lineView.line.gutterClass) {
    var wrap = ensureLineWrapped(lineView);
    lineView.gutterBackground = elt("div", null, "CodeMirror-gutter-background " + lineView.line.gutterClass,
                                    ("left: " + (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) + "px; width: " + (dims.gutterTotalWidth) + "px"));
    cm.display.input.setUneditable(lineView.gutterBackground);
    wrap.insertBefore(lineView.gutterBackground, lineView.text);
  }
  var markers = lineView.line.gutterMarkers;
  if (cm.options.lineNumbers || markers) {
    var wrap$1 = ensureLineWrapped(lineView);
    var gutterWrap = lineView.gutter = elt("div", null, "CodeMirror-gutter-wrapper", ("left: " + (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) + "px"));
    cm.display.input.setUneditable(gutterWrap);
    wrap$1.insertBefore(gutterWrap, lineView.text);
    if (lineView.line.gutterClass)
      { gutterWrap.className += " " + lineView.line.gutterClass; }
    if (cm.options.lineNumbers && (!markers || !markers["CodeMirror-linenumbers"]))
      { lineView.lineNumber = gutterWrap.appendChild(
        elt("div", lineNumberFor(cm.options, lineN),
            "CodeMirror-linenumber CodeMirror-gutter-elt",
            ("left: " + (dims.gutterLeft["CodeMirror-linenumbers"]) + "px; width: " + (cm.display.lineNumInnerWidth) + "px"))); }
    if (markers) { for (var k = 0; k < cm.options.gutters.length; ++k) {
      var id = cm.options.gutters[k], found = markers.hasOwnProperty(id) && markers[id];
      if (found)
        { gutterWrap.appendChild(elt("div", [found], "CodeMirror-gutter-elt",
                                   ("left: " + (dims.gutterLeft[id]) + "px; width: " + (dims.gutterWidth[id]) + "px"))); }
    } }
  }
}

function updateLineWidgets(cm, lineView, dims) {
  if (lineView.alignable) { lineView.alignable = null; }
  for (var node = lineView.node.firstChild, next = (void 0); node; node = next) {
    next = node.nextSibling;
    if (node.className == "CodeMirror-linewidget")
      { lineView.node.removeChild(node); }
  }
  insertLineWidgets(cm, lineView, dims);
}

// Build a line's DOM representation from scratch
function buildLineElement(cm, lineView, lineN, dims) {
  var built = getLineContent(cm, lineView);
  lineView.text = lineView.node = built.pre;
  if (built.bgClass) { lineView.bgClass = built.bgClass; }
  if (built.textClass) { lineView.textClass = built.textClass; }

  updateLineClasses(cm, lineView);
  updateLineGutter(cm, lineView, lineN, dims);
  insertLineWidgets(cm, lineView, dims);
  return lineView.node
}

// A lineView may contain multiple logical lines (when merged by
// collapsed spans). The widgets for all of them need to be drawn.
function insertLineWidgets(cm, lineView, dims) {
  insertLineWidgetsFor(cm, lineView.line, lineView, dims, true);
  if (lineView.rest) { for (var i = 0; i < lineView.rest.length; i++)
    { insertLineWidgetsFor(cm, lineView.rest[i], lineView, dims, false); } }
}

function insertLineWidgetsFor(cm, line, lineView, dims, allowAbove) {
  if (!line.widgets) { return }
  var wrap = ensureLineWrapped(lineView);
  for (var i = 0, ws = line.widgets; i < ws.length; ++i) {
    var widget = ws[i], node = elt("div", [widget.node], "CodeMirror-linewidget");
    if (!widget.handleMouseEvents) { node.setAttribute("cm-ignore-events", "true"); }
    positionLineWidget(widget, node, lineView, dims);
    cm.display.input.setUneditable(node);
    if (allowAbove && widget.above)
      { wrap.insertBefore(node, lineView.gutter || lineView.text); }
    else
      { wrap.appendChild(node); }
    signalLater(widget, "redraw");
  }
}

function positionLineWidget(widget, node, lineView, dims) {
  if (widget.noHScroll) {
    (lineView.alignable || (lineView.alignable = [])).push(node);
    var width = dims.wrapperWidth;
    node.style.left = dims.fixedPos + "px";
    if (!widget.coverGutter) {
      width -= dims.gutterTotalWidth;
      node.style.paddingLeft = dims.gutterTotalWidth + "px";
    }
    node.style.width = width + "px";
  }
  if (widget.coverGutter) {
    node.style.zIndex = 5;
    node.style.position = "relative";
    if (!widget.noHScroll) { node.style.marginLeft = -dims.gutterTotalWidth + "px"; }
  }
}

function widgetHeight(widget) {
  if (widget.height != null) { return widget.height }
  var cm = widget.doc.cm;
  if (!cm) { return 0 }
  if (!contains(document.body, widget.node)) {
    var parentStyle = "position: relative;";
    if (widget.coverGutter)
      { parentStyle += "margin-left: -" + cm.display.gutters.offsetWidth + "px;"; }
    if (widget.noHScroll)
      { parentStyle += "width: " + cm.display.wrapper.clientWidth + "px;"; }
    removeChildrenAndAdd(cm.display.measure, elt("div", [widget.node], null, parentStyle));
  }
  return widget.height = widget.node.parentNode.offsetHeight
}

// Return true when the given mouse event happened in a widget
function eventInWidget(display, e) {
  for (var n = e_target(e); n != display.wrapper; n = n.parentNode) {
    if (!n || (n.nodeType == 1 && n.getAttribute("cm-ignore-events") == "true") ||
        (n.parentNode == display.sizer && n != display.mover))
      { return true }
  }
}

// POSITION MEASUREMENT

function paddingTop(display) {return display.lineSpace.offsetTop}
function paddingVert(display) {return display.mover.offsetHeight - display.lineSpace.offsetHeight}
function paddingH(display) {
  if (display.cachedPaddingH) { return display.cachedPaddingH }
  var e = removeChildrenAndAdd(display.measure, elt("pre", "x"));
  var style = window.getComputedStyle ? window.getComputedStyle(e) : e.currentStyle;
  var data = {left: parseInt(style.paddingLeft), right: parseInt(style.paddingRight)};
  if (!isNaN(data.left) && !isNaN(data.right)) { display.cachedPaddingH = data; }
  return data
}

function scrollGap(cm) { return scrollerGap - cm.display.nativeBarWidth }
function displayWidth(cm) {
  return cm.display.scroller.clientWidth - scrollGap(cm) - cm.display.barWidth
}
function displayHeight(cm) {
  return cm.display.scroller.clientHeight - scrollGap(cm) - cm.display.barHeight
}

// Ensure the lineView.wrapping.heights array is populated. This is
// an array of bottom offsets for the lines that make up a drawn
// line. When lineWrapping is on, there might be more than one
// height.
function ensureLineHeights(cm, lineView, rect) {
  var wrapping = cm.options.lineWrapping;
  var curWidth = wrapping && displayWidth(cm);
  if (!lineView.measure.heights || wrapping && lineView.measure.width != curWidth) {
    var heights = lineView.measure.heights = [];
    if (wrapping) {
      lineView.measure.width = curWidth;
      var rects = lineView.text.firstChild.getClientRects();
      for (var i = 0; i < rects.length - 1; i++) {
        var cur = rects[i], next = rects[i + 1];
        if (Math.abs(cur.bottom - next.bottom) > 2)
          { heights.push((cur.bottom + next.top) / 2 - rect.top); }
      }
    }
    heights.push(rect.bottom - rect.top);
  }
}

// Find a line map (mapping character offsets to text nodes) and a
// measurement cache for the given line number. (A line view might
// contain multiple lines when collapsed ranges are present.)
function mapFromLineView(lineView, line, lineN) {
  if (lineView.line == line)
    { return {map: lineView.measure.map, cache: lineView.measure.cache} }
  for (var i = 0; i < lineView.rest.length; i++)
    { if (lineView.rest[i] == line)
      { return {map: lineView.measure.maps[i], cache: lineView.measure.caches[i]} } }
  for (var i$1 = 0; i$1 < lineView.rest.length; i$1++)
    { if (lineNo(lineView.rest[i$1]) > lineN)
      { return {map: lineView.measure.maps[i$1], cache: lineView.measure.caches[i$1], before: true} } }
}

// Render a line into the hidden node display.externalMeasured. Used
// when measurement is needed for a line that's not in the viewport.
function updateExternalMeasurement(cm, line) {
  line = visualLine(line);
  var lineN = lineNo(line);
  var view = cm.display.externalMeasured = new LineView(cm.doc, line, lineN);
  view.lineN = lineN;
  var built = view.built = buildLineContent(cm, view);
  view.text = built.pre;
  removeChildrenAndAdd(cm.display.lineMeasure, built.pre);
  return view
}

// Get a {top, bottom, left, right} box (in line-local coordinates)
// for a given character.
function measureChar(cm, line, ch, bias) {
  return measureCharPrepared(cm, prepareMeasureForLine(cm, line), ch, bias)
}

// Find a line view that corresponds to the given line number.
function findViewForLine(cm, lineN) {
  if (lineN >= cm.display.viewFrom && lineN < cm.display.viewTo)
    { return cm.display.view[findViewIndex(cm, lineN)] }
  var ext = cm.display.externalMeasured;
  if (ext && lineN >= ext.lineN && lineN < ext.lineN + ext.size)
    { return ext }
}

// Measurement can be split in two steps, the set-up work that
// applies to the whole line, and the measurement of the actual
// character. Functions like coordsChar, that need to do a lot of
// measurements in a row, can thus ensure that the set-up work is
// only done once.
function prepareMeasureForLine(cm, line) {
  var lineN = lineNo(line);
  var view = findViewForLine(cm, lineN);
  if (view && !view.text) {
    view = null;
  } else if (view && view.changes) {
    updateLineForChanges(cm, view, lineN, getDimensions(cm));
    cm.curOp.forceUpdate = true;
  }
  if (!view)
    { view = updateExternalMeasurement(cm, line); }

  var info = mapFromLineView(view, line, lineN);
  return {
    line: line, view: view, rect: null,
    map: info.map, cache: info.cache, before: info.before,
    hasHeights: false
  }
}

// Given a prepared measurement object, measures the position of an
// actual character (or fetches it from the cache).
function measureCharPrepared(cm, prepared, ch, bias, varHeight) {
  if (prepared.before) { ch = -1; }
  var key = ch + (bias || ""), found;
  if (prepared.cache.hasOwnProperty(key)) {
    found = prepared.cache[key];
  } else {
    if (!prepared.rect)
      { prepared.rect = prepared.view.text.getBoundingClientRect(); }
    if (!prepared.hasHeights) {
      ensureLineHeights(cm, prepared.view, prepared.rect);
      prepared.hasHeights = true;
    }
    found = measureCharInner(cm, prepared, ch, bias);
    if (!found.bogus) { prepared.cache[key] = found; }
  }
  return {left: found.left, right: found.right,
          top: varHeight ? found.rtop : found.top,
          bottom: varHeight ? found.rbottom : found.bottom}
}

var nullRect = {left: 0, right: 0, top: 0, bottom: 0};

function nodeAndOffsetInLineMap(map$$1, ch, bias) {
  var node, start, end, collapse, mStart, mEnd;
  // First, search the line map for the text node corresponding to,
  // or closest to, the target character.
  for (var i = 0; i < map$$1.length; i += 3) {
    mStart = map$$1[i];
    mEnd = map$$1[i + 1];
    if (ch < mStart) {
      start = 0; end = 1;
      collapse = "left";
    } else if (ch < mEnd) {
      start = ch - mStart;
      end = start + 1;
    } else if (i == map$$1.length - 3 || ch == mEnd && map$$1[i + 3] > ch) {
      end = mEnd - mStart;
      start = end - 1;
      if (ch >= mEnd) { collapse = "right"; }
    }
    if (start != null) {
      node = map$$1[i + 2];
      if (mStart == mEnd && bias == (node.insertLeft ? "left" : "right"))
        { collapse = bias; }
      if (bias == "left" && start == 0)
        { while (i && map$$1[i - 2] == map$$1[i - 3] && map$$1[i - 1].insertLeft) {
          node = map$$1[(i -= 3) + 2];
          collapse = "left";
        } }
      if (bias == "right" && start == mEnd - mStart)
        { while (i < map$$1.length - 3 && map$$1[i + 3] == map$$1[i + 4] && !map$$1[i + 5].insertLeft) {
          node = map$$1[(i += 3) + 2];
          collapse = "right";
        } }
      break
    }
  }
  return {node: node, start: start, end: end, collapse: collapse, coverStart: mStart, coverEnd: mEnd}
}

function getUsefulRect(rects, bias) {
  var rect = nullRect;
  if (bias == "left") { for (var i = 0; i < rects.length; i++) {
    if ((rect = rects[i]).left != rect.right) { break }
  } } else { for (var i$1 = rects.length - 1; i$1 >= 0; i$1--) {
    if ((rect = rects[i$1]).left != rect.right) { break }
  } }
  return rect
}

function measureCharInner(cm, prepared, ch, bias) {
  var place = nodeAndOffsetInLineMap(prepared.map, ch, bias);
  var node = place.node, start = place.start, end = place.end, collapse = place.collapse;

  var rect;
  if (node.nodeType == 3) { // If it is a text node, use a range to retrieve the coordinates.
    for (var i$1 = 0; i$1 < 4; i$1++) { // Retry a maximum of 4 times when nonsense rectangles are returned
      while (start && isExtendingChar(prepared.line.text.charAt(place.coverStart + start))) { --start; }
      while (place.coverStart + end < place.coverEnd && isExtendingChar(prepared.line.text.charAt(place.coverStart + end))) { ++end; }
      if (ie && ie_version < 9 && start == 0 && end == place.coverEnd - place.coverStart)
        { rect = node.parentNode.getBoundingClientRect(); }
      else
        { rect = getUsefulRect(range(node, start, end).getClientRects(), bias); }
      if (rect.left || rect.right || start == 0) { break }
      end = start;
      start = start - 1;
      collapse = "right";
    }
    if (ie && ie_version < 11) { rect = maybeUpdateRectForZooming(cm.display.measure, rect); }
  } else { // If it is a widget, simply get the box for the whole widget.
    if (start > 0) { collapse = bias = "right"; }
    var rects;
    if (cm.options.lineWrapping && (rects = node.getClientRects()).length > 1)
      { rect = rects[bias == "right" ? rects.length - 1 : 0]; }
    else
      { rect = node.getBoundingClientRect(); }
  }
  if (ie && ie_version < 9 && !start && (!rect || !rect.left && !rect.right)) {
    var rSpan = node.parentNode.getClientRects()[0];
    if (rSpan)
      { rect = {left: rSpan.left, right: rSpan.left + charWidth(cm.display), top: rSpan.top, bottom: rSpan.bottom}; }
    else
      { rect = nullRect; }
  }

  var rtop = rect.top - prepared.rect.top, rbot = rect.bottom - prepared.rect.top;
  var mid = (rtop + rbot) / 2;
  var heights = prepared.view.measure.heights;
  var i = 0;
  for (; i < heights.length - 1; i++)
    { if (mid < heights[i]) { break } }
  var top = i ? heights[i - 1] : 0, bot = heights[i];
  var result = {left: (collapse == "right" ? rect.right : rect.left) - prepared.rect.left,
                right: (collapse == "left" ? rect.left : rect.right) - prepared.rect.left,
                top: top, bottom: bot};
  if (!rect.left && !rect.right) { result.bogus = true; }
  if (!cm.options.singleCursorHeightPerLine) { result.rtop = rtop; result.rbottom = rbot; }

  return result
}

// Work around problem with bounding client rects on ranges being
// returned incorrectly when zoomed on IE10 and below.
function maybeUpdateRectForZooming(measure, rect) {
  if (!window.screen || screen.logicalXDPI == null ||
      screen.logicalXDPI == screen.deviceXDPI || !hasBadZoomedRects(measure))
    { return rect }
  var scaleX = screen.logicalXDPI / screen.deviceXDPI;
  var scaleY = screen.logicalYDPI / screen.deviceYDPI;
  return {left: rect.left * scaleX, right: rect.right * scaleX,
          top: rect.top * scaleY, bottom: rect.bottom * scaleY}
}

function clearLineMeasurementCacheFor(lineView) {
  if (lineView.measure) {
    lineView.measure.cache = {};
    lineView.measure.heights = null;
    if (lineView.rest) { for (var i = 0; i < lineView.rest.length; i++)
      { lineView.measure.caches[i] = {}; } }
  }
}

function clearLineMeasurementCache(cm) {
  cm.display.externalMeasure = null;
  removeChildren(cm.display.lineMeasure);
  for (var i = 0; i < cm.display.view.length; i++)
    { clearLineMeasurementCacheFor(cm.display.view[i]); }
}

function clearCaches(cm) {
  clearLineMeasurementCache(cm);
  cm.display.cachedCharWidth = cm.display.cachedTextHeight = cm.display.cachedPaddingH = null;
  if (!cm.options.lineWrapping) { cm.display.maxLineChanged = true; }
  cm.display.lineNumChars = null;
}

function pageScrollX() {
  // Work around https://bugs.chromium.org/p/chromium/issues/detail?id=489206
  // which causes page_Offset and bounding client rects to use
  // different reference viewports and invalidate our calculations.
  if (chrome && android) { return -(document.body.getBoundingClientRect().left - parseInt(getComputedStyle(document.body).marginLeft)) }
  return window.pageXOffset || (document.documentElement || document.body).scrollLeft
}
function pageScrollY() {
  if (chrome && android) { return -(document.body.getBoundingClientRect().top - parseInt(getComputedStyle(document.body).marginTop)) }
  return window.pageYOffset || (document.documentElement || document.body).scrollTop
}

function widgetTopHeight(lineObj) {
  var height = 0;
  if (lineObj.widgets) { for (var i = 0; i < lineObj.widgets.length; ++i) { if (lineObj.widgets[i].above)
    { height += widgetHeight(lineObj.widgets[i]); } } }
  return height
}

// Converts a {top, bottom, left, right} box from line-local
// coordinates into another coordinate system. Context may be one of
// "line", "div" (display.lineDiv), "local"./null (editor), "window",
// or "page".
function intoCoordSystem(cm, lineObj, rect, context, includeWidgets) {
  if (!includeWidgets) {
    var height = widgetTopHeight(lineObj);
    rect.top += height; rect.bottom += height;
  }
  if (context == "line") { return rect }
  if (!context) { context = "local"; }
  var yOff = heightAtLine(lineObj);
  if (context == "local") { yOff += paddingTop(cm.display); }
  else { yOff -= cm.display.viewOffset; }
  if (context == "page" || context == "window") {
    var lOff = cm.display.lineSpace.getBoundingClientRect();
    yOff += lOff.top + (context == "window" ? 0 : pageScrollY());
    var xOff = lOff.left + (context == "window" ? 0 : pageScrollX());
    rect.left += xOff; rect.right += xOff;
  }
  rect.top += yOff; rect.bottom += yOff;
  return rect
}

// Coverts a box from "div" coords to another coordinate system.
// Context may be "window", "page", "div", or "local"./null.
function fromCoordSystem(cm, coords, context) {
  if (context == "div") { return coords }
  var left = coords.left, top = coords.top;
  // First move into "page" coordinate system
  if (context == "page") {
    left -= pageScrollX();
    top -= pageScrollY();
  } else if (context == "local" || !context) {
    var localBox = cm.display.sizer.getBoundingClientRect();
    left += localBox.left;
    top += localBox.top;
  }

  var lineSpaceBox = cm.display.lineSpace.getBoundingClientRect();
  return {left: left - lineSpaceBox.left, top: top - lineSpaceBox.top}
}

function charCoords(cm, pos, context, lineObj, bias) {
  if (!lineObj) { lineObj = getLine(cm.doc, pos.line); }
  return intoCoordSystem(cm, lineObj, measureChar(cm, lineObj, pos.ch, bias), context)
}

// Returns a box for a given cursor position, which may have an
// 'other' property containing the position of the secondary cursor
// on a bidi boundary.
// A cursor Pos(line, char, "before") is on the same visual line as `char - 1`
// and after `char - 1` in writing order of `char - 1`
// A cursor Pos(line, char, "after") is on the same visual line as `char`
// and before `char` in writing order of `char`
// Examples (upper-case letters are RTL, lower-case are LTR):
//     Pos(0, 1, ...)
//     before   after
// ab     a|b     a|b
// aB     a|B     aB|
// Ab     |Ab     A|b
// AB     B|A     B|A
// Every position after the last character on a line is considered to stick
// to the last character on the line.
function cursorCoords(cm, pos, context, lineObj, preparedMeasure, varHeight) {
  lineObj = lineObj || getLine(cm.doc, pos.line);
  if (!preparedMeasure) { preparedMeasure = prepareMeasureForLine(cm, lineObj); }
  function get(ch, right) {
    var m = measureCharPrepared(cm, preparedMeasure, ch, right ? "right" : "left", varHeight);
    if (right) { m.left = m.right; } else { m.right = m.left; }
    return intoCoordSystem(cm, lineObj, m, context)
  }
  var order = getOrder(lineObj, cm.doc.direction), ch = pos.ch, sticky = pos.sticky;
  if (ch >= lineObj.text.length) {
    ch = lineObj.text.length;
    sticky = "before";
  } else if (ch <= 0) {
    ch = 0;
    sticky = "after";
  }
  if (!order) { return get(sticky == "before" ? ch - 1 : ch, sticky == "before") }

  function getBidi(ch, partPos, invert) {
    var part = order[partPos], right = part.level == 1;
    return get(invert ? ch - 1 : ch, right != invert)
  }
  var partPos = getBidiPartAt(order, ch, sticky);
  var other = bidiOther;
  var val = getBidi(ch, partPos, sticky == "before");
  if (other != null) { val.other = getBidi(ch, other, sticky != "before"); }
  return val
}

// Used to cheaply estimate the coordinates for a position. Used for
// intermediate scroll updates.
function estimateCoords(cm, pos) {
  var left = 0;
  pos = clipPos(cm.doc, pos);
  if (!cm.options.lineWrapping) { left = charWidth(cm.display) * pos.ch; }
  var lineObj = getLine(cm.doc, pos.line);
  var top = heightAtLine(lineObj) + paddingTop(cm.display);
  return {left: left, right: left, top: top, bottom: top + lineObj.height}
}

// Positions returned by coordsChar contain some extra information.
// xRel is the relative x position of the input coordinates compared
// to the found position (so xRel > 0 means the coordinates are to
// the right of the character position, for example). When outside
// is true, that means the coordinates lie outside the line's
// vertical range.
function PosWithInfo(line, ch, sticky, outside, xRel) {
  var pos = Pos(line, ch, sticky);
  pos.xRel = xRel;
  if (outside) { pos.outside = true; }
  return pos
}

// Compute the character position closest to the given coordinates.
// Input must be lineSpace-local ("div" coordinate system).
function coordsChar(cm, x, y) {
  var doc = cm.doc;
  y += cm.display.viewOffset;
  if (y < 0) { return PosWithInfo(doc.first, 0, null, true, -1) }
  var lineN = lineAtHeight(doc, y), last = doc.first + doc.size - 1;
  if (lineN > last)
    { return PosWithInfo(doc.first + doc.size - 1, getLine(doc, last).text.length, null, true, 1) }
  if (x < 0) { x = 0; }

  var lineObj = getLine(doc, lineN);
  for (;;) {
    var found = coordsCharInner(cm, lineObj, lineN, x, y);
    var merged = collapsedSpanAtEnd(lineObj);
    var mergedPos = merged && merged.find(0, true);
    if (merged && (found.ch > mergedPos.from.ch || found.ch == mergedPos.from.ch && found.xRel > 0))
      { lineN = lineNo(lineObj = mergedPos.to.line); }
    else
      { return found }
  }
}

function wrappedLineExtent(cm, lineObj, preparedMeasure, y) {
  y -= widgetTopHeight(lineObj);
  var end = lineObj.text.length;
  var begin = findFirst(function (ch) { return measureCharPrepared(cm, preparedMeasure, ch - 1).bottom <= y; }, end, 0);
  end = findFirst(function (ch) { return measureCharPrepared(cm, preparedMeasure, ch).top > y; }, begin, end);
  return {begin: begin, end: end}
}

function wrappedLineExtentChar(cm, lineObj, preparedMeasure, target) {
  if (!preparedMeasure) { preparedMeasure = prepareMeasureForLine(cm, lineObj); }
  var targetTop = intoCoordSystem(cm, lineObj, measureCharPrepared(cm, preparedMeasure, target), "line").top;
  return wrappedLineExtent(cm, lineObj, preparedMeasure, targetTop)
}

// Returns true if the given side of a box is after the given
// coordinates, in top-to-bottom, left-to-right order.
function boxIsAfter(box, x, y, left) {
  return box.bottom <= y ? false : box.top > y ? true : (left ? box.left : box.right) > x
}

function coordsCharInner(cm, lineObj, lineNo$$1, x, y) {
  // Move y into line-local coordinate space
  y -= heightAtLine(lineObj);
  var preparedMeasure = prepareMeasureForLine(cm, lineObj);
  // When directly calling `measureCharPrepared`, we have to adjust
  // for the widgets at this line.
  var widgetHeight$$1 = widgetTopHeight(lineObj);
  var begin = 0, end = lineObj.text.length, ltr = true;

  var order = getOrder(lineObj, cm.doc.direction);
  // If the line isn't plain left-to-right text, first figure out
  // which bidi section the coordinates fall into.
  if (order) {
    var part = (cm.options.lineWrapping ? coordsBidiPartWrapped : coordsBidiPart)
                 (cm, lineObj, lineNo$$1, preparedMeasure, order, x, y);
    ltr = part.level != 1;
    // The awkward -1 offsets are needed because findFirst (called
    // on these below) will treat its first bound as inclusive,
    // second as exclusive, but we want to actually address the
    // characters in the part's range
    begin = ltr ? part.from : part.to - 1;
    end = ltr ? part.to : part.from - 1;
  }

  // A binary search to find the first character whose bounding box
  // starts after the coordinates. If we run across any whose box wrap
  // the coordinates, store that.
  var chAround = null, boxAround = null;
  var ch = findFirst(function (ch) {
    var box = measureCharPrepared(cm, preparedMeasure, ch);
    box.top += widgetHeight$$1; box.bottom += widgetHeight$$1;
    if (!boxIsAfter(box, x, y, false)) { return false }
    if (box.top <= y && box.left <= x) {
      chAround = ch;
      boxAround = box;
    }
    return true
  }, begin, end);

  var baseX, sticky, outside = false;
  // If a box around the coordinates was found, use that
  if (boxAround) {
    // Distinguish coordinates nearer to the left or right side of the box
    var atLeft = x - boxAround.left < boxAround.right - x, atStart = atLeft == ltr;
    ch = chAround + (atStart ? 0 : 1);
    sticky = atStart ? "after" : "before";
    baseX = atLeft ? boxAround.left : boxAround.right;
  } else {
    // (Adjust for extended bound, if necessary.)
    if (!ltr && (ch == end || ch == begin)) { ch++; }
    // To determine which side to associate with, get the box to the
    // left of the character and compare it's vertical position to the
    // coordinates
    sticky = ch == 0 ? "after" : ch == lineObj.text.length ? "before" :
      (measureCharPrepared(cm, preparedMeasure, ch - (ltr ? 1 : 0)).bottom + widgetHeight$$1 <= y) == ltr ?
      "after" : "before";
    // Now get accurate coordinates for this place, in order to get a
    // base X position
    var coords = cursorCoords(cm, Pos(lineNo$$1, ch, sticky), "line", lineObj, preparedMeasure);
    baseX = coords.left;
    outside = y < coords.top || y >= coords.bottom;
  }

  ch = skipExtendingChars(lineObj.text, ch, 1);
  return PosWithInfo(lineNo$$1, ch, sticky, outside, x - baseX)
}

function coordsBidiPart(cm, lineObj, lineNo$$1, preparedMeasure, order, x, y) {
  // Bidi parts are sorted left-to-right, and in a non-line-wrapping
  // situation, we can take this ordering to correspond to the visual
  // ordering. This finds the first part whose end is after the given
  // coordinates.
  var index = findFirst(function (i) {
    var part = order[i], ltr = part.level != 1;
    return boxIsAfter(cursorCoords(cm, Pos(lineNo$$1, ltr ? part.to : part.from, ltr ? "before" : "after"),
                                   "line", lineObj, preparedMeasure), x, y, true)
  }, 0, order.length - 1);
  var part = order[index];
  // If this isn't the first part, the part's start is also after
  // the coordinates, and the coordinates aren't on the same line as
  // that start, move one part back.
  if (index > 0) {
    var ltr = part.level != 1;
    var start = cursorCoords(cm, Pos(lineNo$$1, ltr ? part.from : part.to, ltr ? "after" : "before"),
                             "line", lineObj, preparedMeasure);
    if (boxIsAfter(start, x, y, true) && start.top > y)
      { part = order[index - 1]; }
  }
  return part
}

function coordsBidiPartWrapped(cm, lineObj, _lineNo, preparedMeasure, order, x, y) {
  // In a wrapped line, rtl text on wrapping boundaries can do things
  // that don't correspond to the ordering in our `order` array at
  // all, so a binary search doesn't work, and we want to return a
  // part that only spans one line so that the binary search in
  // coordsCharInner is safe. As such, we first find the extent of the
  // wrapped line, and then do a flat search in which we discard any
  // spans that aren't on the line.
  var ref = wrappedLineExtent(cm, lineObj, preparedMeasure, y);
  var begin = ref.begin;
  var end = ref.end;
  if (/\s/.test(lineObj.text.charAt(end - 1))) { end--; }
  var part = null, closestDist = null;
  for (var i = 0; i < order.length; i++) {
    var p = order[i];
    if (p.from >= end || p.to <= begin) { continue }
    var ltr = p.level != 1;
    var endX = measureCharPrepared(cm, preparedMeasure, ltr ? Math.min(end, p.to) - 1 : Math.max(begin, p.from)).right;
    // Weigh against spans ending before this, so that they are only
    // picked if nothing ends after
    var dist = endX < x ? x - endX + 1e9 : endX - x;
    if (!part || closestDist > dist) {
      part = p;
      closestDist = dist;
    }
  }
  if (!part) { part = order[order.length - 1]; }
  // Clip the part to the wrapped line.
  if (part.from < begin) { part = {from: begin, to: part.to, level: part.level}; }
  if (part.to > end) { part = {from: part.from, to: end, level: part.level}; }
  return part
}

var measureText;
// Compute the default text height.
function textHeight(display) {
  if (display.cachedTextHeight != null) { return display.cachedTextHeight }
  if (measureText == null) {
    measureText = elt("pre");
    // Measure a bunch of lines, for browsers that compute
    // fractional heights.
    for (var i = 0; i < 49; ++i) {
      measureText.appendChild(document.createTextNode("x"));
      measureText.appendChild(elt("br"));
    }
    measureText.appendChild(document.createTextNode("x"));
  }
  removeChildrenAndAdd(display.measure, measureText);
  var height = measureText.offsetHeight / 50;
  if (height > 3) { display.cachedTextHeight = height; }
  removeChildren(display.measure);
  return height || 1
}

// Compute the default character width.
function charWidth(display) {
  if (display.cachedCharWidth != null) { return display.cachedCharWidth }
  var anchor = elt("span", "xxxxxxxxxx");
  var pre = elt("pre", [anchor]);
  removeChildrenAndAdd(display.measure, pre);
  var rect = anchor.getBoundingClientRect(), width = (rect.right - rect.left) / 10;
  if (width > 2) { display.cachedCharWidth = width; }
  return width || 10
}

// Do a bulk-read of the DOM positions and sizes needed to draw the
// view, so that we don't interleave reading and writing to the DOM.
function getDimensions(cm) {
  var d = cm.display, left = {}, width = {};
  var gutterLeft = d.gutters.clientLeft;
  for (var n = d.gutters.firstChild, i = 0; n; n = n.nextSibling, ++i) {
    left[cm.options.gutters[i]] = n.offsetLeft + n.clientLeft + gutterLeft;
    width[cm.options.gutters[i]] = n.clientWidth;
  }
  return {fixedPos: compensateForHScroll(d),
          gutterTotalWidth: d.gutters.offsetWidth,
          gutterLeft: left,
          gutterWidth: width,
          wrapperWidth: d.wrapper.clientWidth}
}

// Computes display.scroller.scrollLeft + display.gutters.offsetWidth,
// but using getBoundingClientRect to get a sub-pixel-accurate
// result.
function compensateForHScroll(display) {
  return display.scroller.getBoundingClientRect().left - display.sizer.getBoundingClientRect().left
}

// Returns a function that estimates the height of a line, to use as
// first approximation until the line becomes visible (and is thus
// properly measurable).
function estimateHeight(cm) {
  var th = textHeight(cm.display), wrapping = cm.options.lineWrapping;
  var perLine = wrapping && Math.max(5, cm.display.scroller.clientWidth / charWidth(cm.display) - 3);
  return function (line) {
    if (lineIsHidden(cm.doc, line)) { return 0 }

    var widgetsHeight = 0;
    if (line.widgets) { for (var i = 0; i < line.widgets.length; i++) {
      if (line.widgets[i].height) { widgetsHeight += line.widgets[i].height; }
    } }

    if (wrapping)
      { return widgetsHeight + (Math.ceil(line.text.length / perLine) || 1) * th }
    else
      { return widgetsHeight + th }
  }
}

function estimateLineHeights(cm) {
  var doc = cm.doc, est = estimateHeight(cm);
  doc.iter(function (line) {
    var estHeight = est(line);
    if (estHeight != line.height) { updateLineHeight(line, estHeight); }
  });
}

// Given a mouse event, find the corresponding position. If liberal
// is false, it checks whether a gutter or scrollbar was clicked,
// and returns null if it was. forRect is used by rectangular
// selections, and tries to estimate a character position even for
// coordinates beyond the right of the text.
function posFromMouse(cm, e, liberal, forRect) {
  var display = cm.display;
  if (!liberal && e_target(e).getAttribute("cm-not-content") == "true") { return null }

  var x, y, space = display.lineSpace.getBoundingClientRect();
  // Fails unpredictably on IE[67] when mouse is dragged around quickly.
  try { x = e.clientX - space.left; y = e.clientY - space.top; }
  catch (e) { return null }
  var coords = coordsChar(cm, x, y), line;
  if (forRect && coords.xRel == 1 && (line = getLine(cm.doc, coords.line).text).length == coords.ch) {
    var colDiff = countColumn(line, line.length, cm.options.tabSize) - line.length;
    coords = Pos(coords.line, Math.max(0, Math.round((x - paddingH(cm.display).left) / charWidth(cm.display)) - colDiff));
  }
  return coords
}

// Find the view element corresponding to a given line. Return null
// when the line isn't visible.
function findViewIndex(cm, n) {
  if (n >= cm.display.viewTo) { return null }
  n -= cm.display.viewFrom;
  if (n < 0) { return null }
  var view = cm.display.view;
  for (var i = 0; i < view.length; i++) {
    n -= view[i].size;
    if (n < 0) { return i }
  }
}

function updateSelection(cm) {
  cm.display.input.showSelection(cm.display.input.prepareSelection());
}

function prepareSelection(cm, primary) {
  if ( primary === void 0 ) primary = true;

  var doc = cm.doc, result = {};
  var curFragment = result.cursors = document.createDocumentFragment();
  var selFragment = result.selection = document.createDocumentFragment();

  for (var i = 0; i < doc.sel.ranges.length; i++) {
    if (!primary && i == doc.sel.primIndex) { continue }
    var range$$1 = doc.sel.ranges[i];
    if (range$$1.from().line >= cm.display.viewTo || range$$1.to().line < cm.display.viewFrom) { continue }
    var collapsed = range$$1.empty();
    if (collapsed || cm.options.showCursorWhenSelecting)
      { drawSelectionCursor(cm, range$$1.head, curFragment); }
    if (!collapsed)
      { drawSelectionRange(cm, range$$1, selFragment); }
  }
  return result
}

// Draws a cursor for the given range
function drawSelectionCursor(cm, head, output) {
  var pos = cursorCoords(cm, head, "div", null, null, !cm.options.singleCursorHeightPerLine);

  var cursor = output.appendChild(elt("div", "\u00a0", "CodeMirror-cursor"));
  cursor.style.left = pos.left + "px";
  cursor.style.top = pos.top + "px";
  cursor.style.height = Math.max(0, pos.bottom - pos.top) * cm.options.cursorHeight + "px";

  if (pos.other) {
    // Secondary cursor, shown when on a 'jump' in bi-directional text
    var otherCursor = output.appendChild(elt("div", "\u00a0", "CodeMirror-cursor CodeMirror-secondarycursor"));
    otherCursor.style.display = "";
    otherCursor.style.left = pos.other.left + "px";
    otherCursor.style.top = pos.other.top + "px";
    otherCursor.style.height = (pos.other.bottom - pos.other.top) * .85 + "px";
  }
}

function cmpCoords(a, b) { return a.top - b.top || a.left - b.left }

// Draws the given range as a highlighted selection
function drawSelectionRange(cm, range$$1, output) {
  var display = cm.display, doc = cm.doc;
  var fragment = document.createDocumentFragment();
  var padding = paddingH(cm.display), leftSide = padding.left;
  var rightSide = Math.max(display.sizerWidth, displayWidth(cm) - display.sizer.offsetLeft) - padding.right;
  var docLTR = doc.direction == "ltr";

  function add(left, top, width, bottom) {
    if (top < 0) { top = 0; }
    top = Math.round(top);
    bottom = Math.round(bottom);
    fragment.appendChild(elt("div", null, "CodeMirror-selected", ("position: absolute; left: " + left + "px;\n                             top: " + top + "px; width: " + (width == null ? rightSide - left : width) + "px;\n                             height: " + (bottom - top) + "px")));
  }

  function drawForLine(line, fromArg, toArg) {
    var lineObj = getLine(doc, line);
    var lineLen = lineObj.text.length;
    var start, end;
    function coords(ch, bias) {
      return charCoords(cm, Pos(line, ch), "div", lineObj, bias)
    }

    function wrapX(pos, dir, side) {
      var extent = wrappedLineExtentChar(cm, lineObj, null, pos);
      var prop = (dir == "ltr") == (side == "after") ? "left" : "right";
      var ch = side == "after" ? extent.begin : extent.end - (/\s/.test(lineObj.text.charAt(extent.end - 1)) ? 2 : 1);
      return coords(ch, prop)[prop]
    }

    var order = getOrder(lineObj, doc.direction);
    iterateBidiSections(order, fromArg || 0, toArg == null ? lineLen : toArg, function (from, to, dir, i) {
      var ltr = dir == "ltr";
      var fromPos = coords(from, ltr ? "left" : "right");
      var toPos = coords(to - 1, ltr ? "right" : "left");

      var openStart = fromArg == null && from == 0, openEnd = toArg == null && to == lineLen;
      var first = i == 0, last = !order || i == order.length - 1;
      if (toPos.top - fromPos.top <= 3) { // Single line
        var openLeft = (docLTR ? openStart : openEnd) && first;
        var openRight = (docLTR ? openEnd : openStart) && last;
        var left = openLeft ? leftSide : (ltr ? fromPos : toPos).left;
        var right = openRight ? rightSide : (ltr ? toPos : fromPos).right;
        add(left, fromPos.top, right - left, fromPos.bottom);
      } else { // Multiple lines
        var topLeft, topRight, botLeft, botRight;
        if (ltr) {
          topLeft = docLTR && openStart && first ? leftSide : fromPos.left;
          topRight = docLTR ? rightSide : wrapX(from, dir, "before");
          botLeft = docLTR ? leftSide : wrapX(to, dir, "after");
          botRight = docLTR && openEnd && last ? rightSide : toPos.right;
        } else {
          topLeft = !docLTR ? leftSide : wrapX(from, dir, "before");
          topRight = !docLTR && openStart && first ? rightSide : fromPos.right;
          botLeft = !docLTR && openEnd && last ? leftSide : toPos.left;
          botRight = !docLTR ? rightSide : wrapX(to, dir, "after");
        }
        add(topLeft, fromPos.top, topRight - topLeft, fromPos.bottom);
        if (fromPos.bottom < toPos.top) { add(leftSide, fromPos.bottom, null, toPos.top); }
        add(botLeft, toPos.top, botRight - botLeft, toPos.bottom);
      }

      if (!start || cmpCoords(fromPos, start) < 0) { start = fromPos; }
      if (cmpCoords(toPos, start) < 0) { start = toPos; }
      if (!end || cmpCoords(fromPos, end) < 0) { end = fromPos; }
      if (cmpCoords(toPos, end) < 0) { end = toPos; }
    });
    return {start: start, end: end}
  }

  var sFrom = range$$1.from(), sTo = range$$1.to();
  if (sFrom.line == sTo.line) {
    drawForLine(sFrom.line, sFrom.ch, sTo.ch);
  } else {
    var fromLine = getLine(doc, sFrom.line), toLine = getLine(doc, sTo.line);
    var singleVLine = visualLine(fromLine) == visualLine(toLine);
    var leftEnd = drawForLine(sFrom.line, sFrom.ch, singleVLine ? fromLine.text.length + 1 : null).end;
    var rightStart = drawForLine(sTo.line, singleVLine ? 0 : null, sTo.ch).start;
    if (singleVLine) {
      if (leftEnd.top < rightStart.top - 2) {
        add(leftEnd.right, leftEnd.top, null, leftEnd.bottom);
        add(leftSide, rightStart.top, rightStart.left, rightStart.bottom);
      } else {
        add(leftEnd.right, leftEnd.top, rightStart.left - leftEnd.right, leftEnd.bottom);
      }
    }
    if (leftEnd.bottom < rightStart.top)
      { add(leftSide, leftEnd.bottom, null, rightStart.top); }
  }

  output.appendChild(fragment);
}

// Cursor-blinking
function restartBlink(cm) {
  if (!cm.state.focused) { return }
  var display = cm.display;
  clearInterval(display.blinker);
  var on = true;
  display.cursorDiv.style.visibility = "";
  if (cm.options.cursorBlinkRate > 0)
    { display.blinker = setInterval(function () { return display.cursorDiv.style.visibility = (on = !on) ? "" : "hidden"; },
      cm.options.cursorBlinkRate); }
  else if (cm.options.cursorBlinkRate < 0)
    { display.cursorDiv.style.visibility = "hidden"; }
}

function ensureFocus(cm) {
  if (!cm.state.focused) { cm.display.input.focus(); onFocus(cm); }
}

function delayBlurEvent(cm) {
  cm.state.delayingBlurEvent = true;
  setTimeout(function () { if (cm.state.delayingBlurEvent) {
    cm.state.delayingBlurEvent = false;
    onBlur(cm);
  } }, 100);
}

function onFocus(cm, e) {
  if (cm.state.delayingBlurEvent) { cm.state.delayingBlurEvent = false; }

  if (cm.options.readOnly == "nocursor") { return }
  if (!cm.state.focused) {
    signal(cm, "focus", cm, e);
    cm.state.focused = true;
    addClass(cm.display.wrapper, "CodeMirror-focused");
    // This test prevents this from firing when a context
    // menu is closed (since the input reset would kill the
    // select-all detection hack)
    if (!cm.curOp && cm.display.selForContextMenu != cm.doc.sel) {
      cm.display.input.reset();
      if (webkit) { setTimeout(function () { return cm.display.input.reset(true); }, 20); } // Issue #1730
    }
    cm.display.input.receivedFocus();
  }
  restartBlink(cm);
}
function onBlur(cm, e) {
  if (cm.state.delayingBlurEvent) { return }

  if (cm.state.focused) {
    signal(cm, "blur", cm, e);
    cm.state.focused = false;
    rmClass(cm.display.wrapper, "CodeMirror-focused");
  }
  clearInterval(cm.display.blinker);
  setTimeout(function () { if (!cm.state.focused) { cm.display.shift = false; } }, 150);
}

// Read the actual heights of the rendered lines, and update their
// stored heights to match.
function updateHeightsInViewport(cm) {
  var display = cm.display;
  var prevBottom = display.lineDiv.offsetTop;
  for (var i = 0; i < display.view.length; i++) {
    var cur = display.view[i], height = (void 0);
    if (cur.hidden) { continue }
    if (ie && ie_version < 8) {
      var bot = cur.node.offsetTop + cur.node.offsetHeight;
      height = bot - prevBottom;
      prevBottom = bot;
    } else {
      var box = cur.node.getBoundingClientRect();
      height = box.bottom - box.top;
    }
    var diff = cur.line.height - height;
    if (height < 2) { height = textHeight(display); }
    if (diff > .005 || diff < -.005) {
      updateLineHeight(cur.line, height);
      updateWidgetHeight(cur.line);
      if (cur.rest) { for (var j = 0; j < cur.rest.length; j++)
        { updateWidgetHeight(cur.rest[j]); } }
    }
  }
}

// Read and store the height of line widgets associated with the
// given line.
function updateWidgetHeight(line) {
  if (line.widgets) { for (var i = 0; i < line.widgets.length; ++i) {
    var w = line.widgets[i], parent = w.node.parentNode;
    if (parent) { w.height = parent.offsetHeight; }
  } }
}

// Compute the lines that are visible in a given viewport (defaults
// the the current scroll position). viewport may contain top,
// height, and ensure (see op.scrollToPos) properties.
function visibleLines(display, doc, viewport) {
  var top = viewport && viewport.top != null ? Math.max(0, viewport.top) : display.scroller.scrollTop;
  top = Math.floor(top - paddingTop(display));
  var bottom = viewport && viewport.bottom != null ? viewport.bottom : top + display.wrapper.clientHeight;

  var from = lineAtHeight(doc, top), to = lineAtHeight(doc, bottom);
  // Ensure is a {from: {line, ch}, to: {line, ch}} object, and
  // forces those lines into the viewport (if possible).
  if (viewport && viewport.ensure) {
    var ensureFrom = viewport.ensure.from.line, ensureTo = viewport.ensure.to.line;
    if (ensureFrom < from) {
      from = ensureFrom;
      to = lineAtHeight(doc, heightAtLine(getLine(doc, ensureFrom)) + display.wrapper.clientHeight);
    } else if (Math.min(ensureTo, doc.lastLine()) >= to) {
      from = lineAtHeight(doc, heightAtLine(getLine(doc, ensureTo)) - display.wrapper.clientHeight);
      to = ensureTo;
    }
  }
  return {from: from, to: Math.max(to, from + 1)}
}

// Re-align line numbers and gutter marks to compensate for
// horizontal scrolling.
function alignHorizontally(cm) {
  var display = cm.display, view = display.view;
  if (!display.alignWidgets && (!display.gutters.firstChild || !cm.options.fixedGutter)) { return }
  var comp = compensateForHScroll(display) - display.scroller.scrollLeft + cm.doc.scrollLeft;
  var gutterW = display.gutters.offsetWidth, left = comp + "px";
  for (var i = 0; i < view.length; i++) { if (!view[i].hidden) {
    if (cm.options.fixedGutter) {
      if (view[i].gutter)
        { view[i].gutter.style.left = left; }
      if (view[i].gutterBackground)
        { view[i].gutterBackground.style.left = left; }
    }
    var align = view[i].alignable;
    if (align) { for (var j = 0; j < align.length; j++)
      { align[j].style.left = left; } }
  } }
  if (cm.options.fixedGutter)
    { display.gutters.style.left = (comp + gutterW) + "px"; }
}

// Used to ensure that the line number gutter is still the right
// size for the current document size. Returns true when an update
// is needed.
function maybeUpdateLineNumberWidth(cm) {
  if (!cm.options.lineNumbers) { return false }
  var doc = cm.doc, last = lineNumberFor(cm.options, doc.first + doc.size - 1), display = cm.display;
  if (last.length != display.lineNumChars) {
    var test = display.measure.appendChild(elt("div", [elt("div", last)],
                                               "CodeMirror-linenumber CodeMirror-gutter-elt"));
    var innerW = test.firstChild.offsetWidth, padding = test.offsetWidth - innerW;
    display.lineGutter.style.width = "";
    display.lineNumInnerWidth = Math.max(innerW, display.lineGutter.offsetWidth - padding) + 1;
    display.lineNumWidth = display.lineNumInnerWidth + padding;
    display.lineNumChars = display.lineNumInnerWidth ? last.length : -1;
    display.lineGutter.style.width = display.lineNumWidth + "px";
    updateGutterSpace(cm);
    return true
  }
  return false
}

// SCROLLING THINGS INTO VIEW

// If an editor sits on the top or bottom of the window, partially
// scrolled out of view, this ensures that the cursor is visible.
function maybeScrollWindow(cm, rect) {
  if (signalDOMEvent(cm, "scrollCursorIntoView")) { return }

  var display = cm.display, box = display.sizer.getBoundingClientRect(), doScroll = null;
  if (rect.top + box.top < 0) { doScroll = true; }
  else if (rect.bottom + box.top > (window.innerHeight || document.documentElement.clientHeight)) { doScroll = false; }
  if (doScroll != null && !phantom) {
    var scrollNode = elt("div", "\u200b", null, ("position: absolute;\n                         top: " + (rect.top - display.viewOffset - paddingTop(cm.display)) + "px;\n                         height: " + (rect.bottom - rect.top + scrollGap(cm) + display.barHeight) + "px;\n                         left: " + (rect.left) + "px; width: " + (Math.max(2, rect.right - rect.left)) + "px;"));
    cm.display.lineSpace.appendChild(scrollNode);
    scrollNode.scrollIntoView(doScroll);
    cm.display.lineSpace.removeChild(scrollNode);
  }
}

// Scroll a given position into view (immediately), verifying that
// it actually became visible (as line heights are accurately
// measured, the position of something may 'drift' during drawing).
function scrollPosIntoView(cm, pos, end, margin) {
  if (margin == null) { margin = 0; }
  var rect;
  if (!cm.options.lineWrapping && pos == end) {
    // Set pos and end to the cursor positions around the character pos sticks to
    // If pos.sticky == "before", that is around pos.ch - 1, otherwise around pos.ch
    // If pos == Pos(_, 0, "before"), pos and end are unchanged
    pos = pos.ch ? Pos(pos.line, pos.sticky == "before" ? pos.ch - 1 : pos.ch, "after") : pos;
    end = pos.sticky == "before" ? Pos(pos.line, pos.ch + 1, "before") : pos;
  }
  for (var limit = 0; limit < 5; limit++) {
    var changed = false;
    var coords = cursorCoords(cm, pos);
    var endCoords = !end || end == pos ? coords : cursorCoords(cm, end);
    rect = {left: Math.min(coords.left, endCoords.left),
            top: Math.min(coords.top, endCoords.top) - margin,
            right: Math.max(coords.left, endCoords.left),
            bottom: Math.max(coords.bottom, endCoords.bottom) + margin};
    var scrollPos = calculateScrollPos(cm, rect);
    var startTop = cm.doc.scrollTop, startLeft = cm.doc.scrollLeft;
    if (scrollPos.scrollTop != null) {
      updateScrollTop(cm, scrollPos.scrollTop);
      if (Math.abs(cm.doc.scrollTop - startTop) > 1) { changed = true; }
    }
    if (scrollPos.scrollLeft != null) {
      setScrollLeft(cm, scrollPos.scrollLeft);
      if (Math.abs(cm.doc.scrollLeft - startLeft) > 1) { changed = true; }
    }
    if (!changed) { break }
  }
  return rect
}

// Scroll a given set of coordinates into view (immediately).
function scrollIntoView(cm, rect) {
  var scrollPos = calculateScrollPos(cm, rect);
  if (scrollPos.scrollTop != null) { updateScrollTop(cm, scrollPos.scrollTop); }
  if (scrollPos.scrollLeft != null) { setScrollLeft(cm, scrollPos.scrollLeft); }
}

// Calculate a new scroll position needed to scroll the given
// rectangle into view. Returns an object with scrollTop and
// scrollLeft properties. When these are undefined, the
// vertical/horizontal position does not need to be adjusted.
function calculateScrollPos(cm, rect) {
  var display = cm.display, snapMargin = textHeight(cm.display);
  if (rect.top < 0) { rect.top = 0; }
  var screentop = cm.curOp && cm.curOp.scrollTop != null ? cm.curOp.scrollTop : display.scroller.scrollTop;
  var screen = displayHeight(cm), result = {};
  if (rect.bottom - rect.top > screen) { rect.bottom = rect.top + screen; }
  var docBottom = cm.doc.height + paddingVert(display);
  var atTop = rect.top < snapMargin, atBottom = rect.bottom > docBottom - snapMargin;
  if (rect.top < screentop) {
    result.scrollTop = atTop ? 0 : rect.top;
  } else if (rect.bottom > screentop + screen) {
    var newTop = Math.min(rect.top, (atBottom ? docBottom : rect.bottom) - screen);
    if (newTop != screentop) { result.scrollTop = newTop; }
  }

  var screenleft = cm.curOp && cm.curOp.scrollLeft != null ? cm.curOp.scrollLeft : display.scroller.scrollLeft;
  var screenw = displayWidth(cm) - (cm.options.fixedGutter ? display.gutters.offsetWidth : 0);
  var tooWide = rect.right - rect.left > screenw;
  if (tooWide) { rect.right = rect.left + screenw; }
  if (rect.left < 10)
    { result.scrollLeft = 0; }
  else if (rect.left < screenleft)
    { result.scrollLeft = Math.max(0, rect.left - (tooWide ? 0 : 10)); }
  else if (rect.right > screenw + screenleft - 3)
    { result.scrollLeft = rect.right + (tooWide ? 0 : 10) - screenw; }
  return result
}

// Store a relative adjustment to the scroll position in the current
// operation (to be applied when the operation finishes).
function addToScrollTop(cm, top) {
  if (top == null) { return }
  resolveScrollToPos(cm);
  cm.curOp.scrollTop = (cm.curOp.scrollTop == null ? cm.doc.scrollTop : cm.curOp.scrollTop) + top;
}

// Make sure that at the end of the operation the current cursor is
// shown.
function ensureCursorVisible(cm) {
  resolveScrollToPos(cm);
  var cur = cm.getCursor();
  cm.curOp.scrollToPos = {from: cur, to: cur, margin: cm.options.cursorScrollMargin};
}

function scrollToCoords(cm, x, y) {
  if (x != null || y != null) { resolveScrollToPos(cm); }
  if (x != null) { cm.curOp.scrollLeft = x; }
  if (y != null) { cm.curOp.scrollTop = y; }
}

function scrollToRange(cm, range$$1) {
  resolveScrollToPos(cm);
  cm.curOp.scrollToPos = range$$1;
}

// When an operation has its scrollToPos property set, and another
// scroll action is applied before the end of the operation, this
// 'simulates' scrolling that position into view in a cheap way, so
// that the effect of intermediate scroll commands is not ignored.
function resolveScrollToPos(cm) {
  var range$$1 = cm.curOp.scrollToPos;
  if (range$$1) {
    cm.curOp.scrollToPos = null;
    var from = estimateCoords(cm, range$$1.from), to = estimateCoords(cm, range$$1.to);
    scrollToCoordsRange(cm, from, to, range$$1.margin);
  }
}

function scrollToCoordsRange(cm, from, to, margin) {
  var sPos = calculateScrollPos(cm, {
    left: Math.min(from.left, to.left),
    top: Math.min(from.top, to.top) - margin,
    right: Math.max(from.right, to.right),
    bottom: Math.max(from.bottom, to.bottom) + margin
  });
  scrollToCoords(cm, sPos.scrollLeft, sPos.scrollTop);
}

// Sync the scrollable area and scrollbars, ensure the viewport
// covers the visible area.
function updateScrollTop(cm, val) {
  if (Math.abs(cm.doc.scrollTop - val) < 2) { return }
  if (!gecko) { updateDisplaySimple(cm, {top: val}); }
  setScrollTop(cm, val, true);
  if (gecko) { updateDisplaySimple(cm); }
  startWorker(cm, 100);
}

function setScrollTop(cm, val, forceScroll) {
  val = Math.min(cm.display.scroller.scrollHeight - cm.display.scroller.clientHeight, val);
  if (cm.display.scroller.scrollTop == val && !forceScroll) { return }
  cm.doc.scrollTop = val;
  cm.display.scrollbars.setScrollTop(val);
  if (cm.display.scroller.scrollTop != val) { cm.display.scroller.scrollTop = val; }
}

// Sync scroller and scrollbar, ensure the gutter elements are
// aligned.
function setScrollLeft(cm, val, isScroller, forceScroll) {
  val = Math.min(val, cm.display.scroller.scrollWidth - cm.display.scroller.clientWidth);
  if ((isScroller ? val == cm.doc.scrollLeft : Math.abs(cm.doc.scrollLeft - val) < 2) && !forceScroll) { return }
  cm.doc.scrollLeft = val;
  alignHorizontally(cm);
  if (cm.display.scroller.scrollLeft != val) { cm.display.scroller.scrollLeft = val; }
  cm.display.scrollbars.setScrollLeft(val);
}

// SCROLLBARS

// Prepare DOM reads needed to update the scrollbars. Done in one
// shot to minimize update/measure roundtrips.
function measureForScrollbars(cm) {
  var d = cm.display, gutterW = d.gutters.offsetWidth;
  var docH = Math.round(cm.doc.height + paddingVert(cm.display));
  return {
    clientHeight: d.scroller.clientHeight,
    viewHeight: d.wrapper.clientHeight,
    scrollWidth: d.scroller.scrollWidth, clientWidth: d.scroller.clientWidth,
    viewWidth: d.wrapper.clientWidth,
    barLeft: cm.options.fixedGutter ? gutterW : 0,
    docHeight: docH,
    scrollHeight: docH + scrollGap(cm) + d.barHeight,
    nativeBarWidth: d.nativeBarWidth,
    gutterWidth: gutterW
  }
}

var NativeScrollbars = function(place, scroll, cm) {
  this.cm = cm;
  var vert = this.vert = elt("div", [elt("div", null, null, "min-width: 1px")], "CodeMirror-vscrollbar");
  var horiz = this.horiz = elt("div", [elt("div", null, null, "height: 100%; min-height: 1px")], "CodeMirror-hscrollbar");
  place(vert); place(horiz);

  on(vert, "scroll", function () {
    if (vert.clientHeight) { scroll(vert.scrollTop, "vertical"); }
  });
  on(horiz, "scroll", function () {
    if (horiz.clientWidth) { scroll(horiz.scrollLeft, "horizontal"); }
  });

  this.checkedZeroWidth = false;
  // Need to set a minimum width to see the scrollbar on IE7 (but must not set it on IE8).
  if (ie && ie_version < 8) { this.horiz.style.minHeight = this.vert.style.minWidth = "18px"; }
};

NativeScrollbars.prototype.update = function (measure) {
  var needsH = measure.scrollWidth > measure.clientWidth + 1;
  var needsV = measure.scrollHeight > measure.clientHeight + 1;
  var sWidth = measure.nativeBarWidth;

  if (needsV) {
    this.vert.style.display = "block";
    this.vert.style.bottom = needsH ? sWidth + "px" : "0";
    var totalHeight = measure.viewHeight - (needsH ? sWidth : 0);
    // A bug in IE8 can cause this value to be negative, so guard it.
    this.vert.firstChild.style.height =
      Math.max(0, measure.scrollHeight - measure.clientHeight + totalHeight) + "px";
  } else {
    this.vert.style.display = "";
    this.vert.firstChild.style.height = "0";
  }

  if (needsH) {
    this.horiz.style.display = "block";
    this.horiz.style.right = needsV ? sWidth + "px" : "0";
    this.horiz.style.left = measure.barLeft + "px";
    var totalWidth = measure.viewWidth - measure.barLeft - (needsV ? sWidth : 0);
    this.horiz.firstChild.style.width =
      Math.max(0, measure.scrollWidth - measure.clientWidth + totalWidth) + "px";
  } else {
    this.horiz.style.display = "";
    this.horiz.firstChild.style.width = "0";
  }

  if (!this.checkedZeroWidth && measure.clientHeight > 0) {
    if (sWidth == 0) { this.zeroWidthHack(); }
    this.checkedZeroWidth = true;
  }

  return {right: needsV ? sWidth : 0, bottom: needsH ? sWidth : 0}
};

NativeScrollbars.prototype.setScrollLeft = function (pos) {
  if (this.horiz.scrollLeft != pos) { this.horiz.scrollLeft = pos; }
  if (this.disableHoriz) { this.enableZeroWidthBar(this.horiz, this.disableHoriz, "horiz"); }
};

NativeScrollbars.prototype.setScrollTop = function (pos) {
  if (this.vert.scrollTop != pos) { this.vert.scrollTop = pos; }
  if (this.disableVert) { this.enableZeroWidthBar(this.vert, this.disableVert, "vert"); }
};

NativeScrollbars.prototype.zeroWidthHack = function () {
  var w = mac && !mac_geMountainLion ? "12px" : "18px";
  this.horiz.style.height = this.vert.style.width = w;
  this.horiz.style.pointerEvents = this.vert.style.pointerEvents = "none";
  this.disableHoriz = new Delayed;
  this.disableVert = new Delayed;
};

NativeScrollbars.prototype.enableZeroWidthBar = function (bar, delay, type) {
  bar.style.pointerEvents = "auto";
  function maybeDisable() {
    // To find out whether the scrollbar is still visible, we
    // check whether the element under the pixel in the bottom
    // right corner of the scrollbar box is the scrollbar box
    // itself (when the bar is still visible) or its filler child
    // (when the bar is hidden). If it is still visible, we keep
    // it enabled, if it's hidden, we disable pointer events.
    var box = bar.getBoundingClientRect();
    var elt$$1 = type == "vert" ? document.elementFromPoint(box.right - 1, (box.top + box.bottom) / 2)
        : document.elementFromPoint((box.right + box.left) / 2, box.bottom - 1);
    if (elt$$1 != bar) { bar.style.pointerEvents = "none"; }
    else { delay.set(1000, maybeDisable); }
  }
  delay.set(1000, maybeDisable);
};

NativeScrollbars.prototype.clear = function () {
  var parent = this.horiz.parentNode;
  parent.removeChild(this.horiz);
  parent.removeChild(this.vert);
};

var NullScrollbars = function () {};

NullScrollbars.prototype.update = function () { return {bottom: 0, right: 0} };
NullScrollbars.prototype.setScrollLeft = function () {};
NullScrollbars.prototype.setScrollTop = function () {};
NullScrollbars.prototype.clear = function () {};

function updateScrollbars(cm, measure) {
  if (!measure) { measure = measureForScrollbars(cm); }
  var startWidth = cm.display.barWidth, startHeight = cm.display.barHeight;
  updateScrollbarsInner(cm, measure);
  for (var i = 0; i < 4 && startWidth != cm.display.barWidth || startHeight != cm.display.barHeight; i++) {
    if (startWidth != cm.display.barWidth && cm.options.lineWrapping)
      { updateHeightsInViewport(cm); }
    updateScrollbarsInner(cm, measureForScrollbars(cm));
    startWidth = cm.display.barWidth; startHeight = cm.display.barHeight;
  }
}

// Re-synchronize the fake scrollbars with the actual size of the
// content.
function updateScrollbarsInner(cm, measure) {
  var d = cm.display;
  var sizes = d.scrollbars.update(measure);

  d.sizer.style.paddingRight = (d.barWidth = sizes.right) + "px";
  d.sizer.style.paddingBottom = (d.barHeight = sizes.bottom) + "px";
  d.heightForcer.style.borderBottom = sizes.bottom + "px solid transparent";

  if (sizes.right && sizes.bottom) {
    d.scrollbarFiller.style.display = "block";
    d.scrollbarFiller.style.height = sizes.bottom + "px";
    d.scrollbarFiller.style.width = sizes.right + "px";
  } else { d.scrollbarFiller.style.display = ""; }
  if (sizes.bottom && cm.options.coverGutterNextToScrollbar && cm.options.fixedGutter) {
    d.gutterFiller.style.display = "block";
    d.gutterFiller.style.height = sizes.bottom + "px";
    d.gutterFiller.style.width = measure.gutterWidth + "px";
  } else { d.gutterFiller.style.display = ""; }
}

var scrollbarModel = {"native": NativeScrollbars, "null": NullScrollbars};

function initScrollbars(cm) {
  if (cm.display.scrollbars) {
    cm.display.scrollbars.clear();
    if (cm.display.scrollbars.addClass)
      { rmClass(cm.display.wrapper, cm.display.scrollbars.addClass); }
  }

  cm.display.scrollbars = new scrollbarModel[cm.options.scrollbarStyle](function (node) {
    cm.display.wrapper.insertBefore(node, cm.display.scrollbarFiller);
    // Prevent clicks in the scrollbars from killing focus
    on(node, "mousedown", function () {
      if (cm.state.focused) { setTimeout(function () { return cm.display.input.focus(); }, 0); }
    });
    node.setAttribute("cm-not-content", "true");
  }, function (pos, axis) {
    if (axis == "horizontal") { setScrollLeft(cm, pos); }
    else { updateScrollTop(cm, pos); }
  }, cm);
  if (cm.display.scrollbars.addClass)
    { addClass(cm.display.wrapper, cm.display.scrollbars.addClass); }
}

// Operations are used to wrap a series of changes to the editor
// state in such a way that each change won't have to update the
// cursor and display (which would be awkward, slow, and
// error-prone). Instead, display updates are batched and then all
// combined and executed at once.

var nextOpId = 0;
// Start a new operation.
function startOperation(cm) {
  cm.curOp = {
    cm: cm,
    viewChanged: false,      // Flag that indicates that lines might need to be redrawn
    startHeight: cm.doc.height, // Used to detect need to update scrollbar
    forceUpdate: false,      // Used to force a redraw
    updateInput: null,       // Whether to reset the input textarea
    typing: false,           // Whether this reset should be careful to leave existing text (for compositing)
    changeObjs: null,        // Accumulated changes, for firing change events
    cursorActivityHandlers: null, // Set of handlers to fire cursorActivity on
    cursorActivityCalled: 0, // Tracks which cursorActivity handlers have been called already
    selectionChanged: false, // Whether the selection needs to be redrawn
    updateMaxLine: false,    // Set when the widest line needs to be determined anew
    scrollLeft: null, scrollTop: null, // Intermediate scroll position, not pushed to DOM yet
    scrollToPos: null,       // Used to scroll to a specific position
    focus: false,
    id: ++nextOpId           // Unique ID
  };
  pushOperation(cm.curOp);
}

// Finish an operation, updating the display and signalling delayed events
function endOperation(cm) {
  var op = cm.curOp;
  finishOperation(op, function (group) {
    for (var i = 0; i < group.ops.length; i++)
      { group.ops[i].cm.curOp = null; }
    endOperations(group);
  });
}

// The DOM updates done when an operation finishes are batched so
// that the minimum number of relayouts are required.
function endOperations(group) {
  var ops = group.ops;
  for (var i = 0; i < ops.length; i++) // Read DOM
    { endOperation_R1(ops[i]); }
  for (var i$1 = 0; i$1 < ops.length; i$1++) // Write DOM (maybe)
    { endOperation_W1(ops[i$1]); }
  for (var i$2 = 0; i$2 < ops.length; i$2++) // Read DOM
    { endOperation_R2(ops[i$2]); }
  for (var i$3 = 0; i$3 < ops.length; i$3++) // Write DOM (maybe)
    { endOperation_W2(ops[i$3]); }
  for (var i$4 = 0; i$4 < ops.length; i$4++) // Read DOM
    { endOperation_finish(ops[i$4]); }
}

function endOperation_R1(op) {
  var cm = op.cm, display = cm.display;
  maybeClipScrollbars(cm);
  if (op.updateMaxLine) { findMaxLine(cm); }

  op.mustUpdate = op.viewChanged || op.forceUpdate || op.scrollTop != null ||
    op.scrollToPos && (op.scrollToPos.from.line < display.viewFrom ||
                       op.scrollToPos.to.line >= display.viewTo) ||
    display.maxLineChanged && cm.options.lineWrapping;
  op.update = op.mustUpdate &&
    new DisplayUpdate(cm, op.mustUpdate && {top: op.scrollTop, ensure: op.scrollToPos}, op.forceUpdate);
}

function endOperation_W1(op) {
  op.updatedDisplay = op.mustUpdate && updateDisplayIfNeeded(op.cm, op.update);
}

function endOperation_R2(op) {
  var cm = op.cm, display = cm.display;
  if (op.updatedDisplay) { updateHeightsInViewport(cm); }

  op.barMeasure = measureForScrollbars(cm);

  // If the max line changed since it was last measured, measure it,
  // and ensure the document's width matches it.
  // updateDisplay_W2 will use these properties to do the actual resizing
  if (display.maxLineChanged && !cm.options.lineWrapping) {
    op.adjustWidthTo = measureChar(cm, display.maxLine, display.maxLine.text.length).left + 3;
    cm.display.sizerWidth = op.adjustWidthTo;
    op.barMeasure.scrollWidth =
      Math.max(display.scroller.clientWidth, display.sizer.offsetLeft + op.adjustWidthTo + scrollGap(cm) + cm.display.barWidth);
    op.maxScrollLeft = Math.max(0, display.sizer.offsetLeft + op.adjustWidthTo - displayWidth(cm));
  }

  if (op.updatedDisplay || op.selectionChanged)
    { op.preparedSelection = display.input.prepareSelection(); }
}

function endOperation_W2(op) {
  var cm = op.cm;

  if (op.adjustWidthTo != null) {
    cm.display.sizer.style.minWidth = op.adjustWidthTo + "px";
    if (op.maxScrollLeft < cm.doc.scrollLeft)
      { setScrollLeft(cm, Math.min(cm.display.scroller.scrollLeft, op.maxScrollLeft), true); }
    cm.display.maxLineChanged = false;
  }

  var takeFocus = op.focus && op.focus == activeElt();
  if (op.preparedSelection)
    { cm.display.input.showSelection(op.preparedSelection, takeFocus); }
  if (op.updatedDisplay || op.startHeight != cm.doc.height)
    { updateScrollbars(cm, op.barMeasure); }
  if (op.updatedDisplay)
    { setDocumentHeight(cm, op.barMeasure); }

  if (op.selectionChanged) { restartBlink(cm); }

  if (cm.state.focused && op.updateInput)
    { cm.display.input.reset(op.typing); }
  if (takeFocus) { ensureFocus(op.cm); }
}

function endOperation_finish(op) {
  var cm = op.cm, display = cm.display, doc = cm.doc;

  if (op.updatedDisplay) { postUpdateDisplay(cm, op.update); }

  // Abort mouse wheel delta measurement, when scrolling explicitly
  if (display.wheelStartX != null && (op.scrollTop != null || op.scrollLeft != null || op.scrollToPos))
    { display.wheelStartX = display.wheelStartY = null; }

  // Propagate the scroll position to the actual DOM scroller
  if (op.scrollTop != null) { setScrollTop(cm, op.scrollTop, op.forceScroll); }

  if (op.scrollLeft != null) { setScrollLeft(cm, op.scrollLeft, true, true); }
  // If we need to scroll a specific position into view, do so.
  if (op.scrollToPos) {
    var rect = scrollPosIntoView(cm, clipPos(doc, op.scrollToPos.from),
                                 clipPos(doc, op.scrollToPos.to), op.scrollToPos.margin);
    maybeScrollWindow(cm, rect);
  }

  // Fire events for markers that are hidden/unidden by editing or
  // undoing
  var hidden = op.maybeHiddenMarkers, unhidden = op.maybeUnhiddenMarkers;
  if (hidden) { for (var i = 0; i < hidden.length; ++i)
    { if (!hidden[i].lines.length) { signal(hidden[i], "hide"); } } }
  if (unhidden) { for (var i$1 = 0; i$1 < unhidden.length; ++i$1)
    { if (unhidden[i$1].lines.length) { signal(unhidden[i$1], "unhide"); } } }

  if (display.wrapper.offsetHeight)
    { doc.scrollTop = cm.display.scroller.scrollTop; }

  // Fire change events, and delayed event handlers
  if (op.changeObjs)
    { signal(cm, "changes", cm, op.changeObjs); }
  if (op.update)
    { op.update.finish(); }
}

// Run the given function in an operation
function runInOp(cm, f) {
  if (cm.curOp) { return f() }
  startOperation(cm);
  try { return f() }
  finally { endOperation(cm); }
}
// Wraps a function in an operation. Returns the wrapped function.
function operation(cm, f) {
  return function() {
    if (cm.curOp) { return f.apply(cm, arguments) }
    startOperation(cm);
    try { return f.apply(cm, arguments) }
    finally { endOperation(cm); }
  }
}
// Used to add methods to editor and doc instances, wrapping them in
// operations.
function methodOp(f) {
  return function() {
    if (this.curOp) { return f.apply(this, arguments) }
    startOperation(this);
    try { return f.apply(this, arguments) }
    finally { endOperation(this); }
  }
}
function docMethodOp(f) {
  return function() {
    var cm = this.cm;
    if (!cm || cm.curOp) { return f.apply(this, arguments) }
    startOperation(cm);
    try { return f.apply(this, arguments) }
    finally { endOperation(cm); }
  }
}

// Updates the display.view data structure for a given change to the
// document. From and to are in pre-change coordinates. Lendiff is
// the amount of lines added or subtracted by the change. This is
// used for changes that span multiple lines, or change the way
// lines are divided into visual lines. regLineChange (below)
// registers single-line changes.
function regChange(cm, from, to, lendiff) {
  if (from == null) { from = cm.doc.first; }
  if (to == null) { to = cm.doc.first + cm.doc.size; }
  if (!lendiff) { lendiff = 0; }

  var display = cm.display;
  if (lendiff && to < display.viewTo &&
      (display.updateLineNumbers == null || display.updateLineNumbers > from))
    { display.updateLineNumbers = from; }

  cm.curOp.viewChanged = true;

  if (from >= display.viewTo) { // Change after
    if (sawCollapsedSpans && visualLineNo(cm.doc, from) < display.viewTo)
      { resetView(cm); }
  } else if (to <= display.viewFrom) { // Change before
    if (sawCollapsedSpans && visualLineEndNo(cm.doc, to + lendiff) > display.viewFrom) {
      resetView(cm);
    } else {
      display.viewFrom += lendiff;
      display.viewTo += lendiff;
    }
  } else if (from <= display.viewFrom && to >= display.viewTo) { // Full overlap
    resetView(cm);
  } else if (from <= display.viewFrom) { // Top overlap
    var cut = viewCuttingPoint(cm, to, to + lendiff, 1);
    if (cut) {
      display.view = display.view.slice(cut.index);
      display.viewFrom = cut.lineN;
      display.viewTo += lendiff;
    } else {
      resetView(cm);
    }
  } else if (to >= display.viewTo) { // Bottom overlap
    var cut$1 = viewCuttingPoint(cm, from, from, -1);
    if (cut$1) {
      display.view = display.view.slice(0, cut$1.index);
      display.viewTo = cut$1.lineN;
    } else {
      resetView(cm);
    }
  } else { // Gap in the middle
    var cutTop = viewCuttingPoint(cm, from, from, -1);
    var cutBot = viewCuttingPoint(cm, to, to + lendiff, 1);
    if (cutTop && cutBot) {
      display.view = display.view.slice(0, cutTop.index)
        .concat(buildViewArray(cm, cutTop.lineN, cutBot.lineN))
        .concat(display.view.slice(cutBot.index));
      display.viewTo += lendiff;
    } else {
      resetView(cm);
    }
  }

  var ext = display.externalMeasured;
  if (ext) {
    if (to < ext.lineN)
      { ext.lineN += lendiff; }
    else if (from < ext.lineN + ext.size)
      { display.externalMeasured = null; }
  }
}

// Register a change to a single line. Type must be one of "text",
// "gutter", "class", "widget"
function regLineChange(cm, line, type) {
  cm.curOp.viewChanged = true;
  var display = cm.display, ext = cm.display.externalMeasured;
  if (ext && line >= ext.lineN && line < ext.lineN + ext.size)
    { display.externalMeasured = null; }

  if (line < display.viewFrom || line >= display.viewTo) { return }
  var lineView = display.view[findViewIndex(cm, line)];
  if (lineView.node == null) { return }
  var arr = lineView.changes || (lineView.changes = []);
  if (indexOf(arr, type) == -1) { arr.push(type); }
}

// Clear the view.
function resetView(cm) {
  cm.display.viewFrom = cm.display.viewTo = cm.doc.first;
  cm.display.view = [];
  cm.display.viewOffset = 0;
}

function viewCuttingPoint(cm, oldN, newN, dir) {
  var index = findViewIndex(cm, oldN), diff, view = cm.display.view;
  if (!sawCollapsedSpans || newN == cm.doc.first + cm.doc.size)
    { return {index: index, lineN: newN} }
  var n = cm.display.viewFrom;
  for (var i = 0; i < index; i++)
    { n += view[i].size; }
  if (n != oldN) {
    if (dir > 0) {
      if (index == view.length - 1) { return null }
      diff = (n + view[index].size) - oldN;
      index++;
    } else {
      diff = n - oldN;
    }
    oldN += diff; newN += diff;
  }
  while (visualLineNo(cm.doc, newN) != newN) {
    if (index == (dir < 0 ? 0 : view.length - 1)) { return null }
    newN += dir * view[index - (dir < 0 ? 1 : 0)].size;
    index += dir;
  }
  return {index: index, lineN: newN}
}

// Force the view to cover a given range, adding empty view element
// or clipping off existing ones as needed.
function adjustView(cm, from, to) {
  var display = cm.display, view = display.view;
  if (view.length == 0 || from >= display.viewTo || to <= display.viewFrom) {
    display.view = buildViewArray(cm, from, to);
    display.viewFrom = from;
  } else {
    if (display.viewFrom > from)
      { display.view = buildViewArray(cm, from, display.viewFrom).concat(display.view); }
    else if (display.viewFrom < from)
      { display.view = display.view.slice(findViewIndex(cm, from)); }
    display.viewFrom = from;
    if (display.viewTo < to)
      { display.view = display.view.concat(buildViewArray(cm, display.viewTo, to)); }
    else if (display.viewTo > to)
      { display.view = display.view.slice(0, findViewIndex(cm, to)); }
  }
  display.viewTo = to;
}

// Count the number of lines in the view whose DOM representation is
// out of date (or nonexistent).
function countDirtyView(cm) {
  var view = cm.display.view, dirty = 0;
  for (var i = 0; i < view.length; i++) {
    var lineView = view[i];
    if (!lineView.hidden && (!lineView.node || lineView.changes)) { ++dirty; }
  }
  return dirty
}

// HIGHLIGHT WORKER

function startWorker(cm, time) {
  if (cm.doc.highlightFrontier < cm.display.viewTo)
    { cm.state.highlight.set(time, bind(highlightWorker, cm)); }
}

function highlightWorker(cm) {
  var doc = cm.doc;
  if (doc.highlightFrontier >= cm.display.viewTo) { return }
  var end = +new Date + cm.options.workTime;
  var context = getContextBefore(cm, doc.highlightFrontier);
  var changedLines = [];

  doc.iter(context.line, Math.min(doc.first + doc.size, cm.display.viewTo + 500), function (line) {
    if (context.line >= cm.display.viewFrom) { // Visible
      var oldStyles = line.styles;
      var resetState = line.text.length > cm.options.maxHighlightLength ? copyState(doc.mode, context.state) : null;
      var highlighted = highlightLine(cm, line, context, true);
      if (resetState) { context.state = resetState; }
      line.styles = highlighted.styles;
      var oldCls = line.styleClasses, newCls = highlighted.classes;
      if (newCls) { line.styleClasses = newCls; }
      else if (oldCls) { line.styleClasses = null; }
      var ischange = !oldStyles || oldStyles.length != line.styles.length ||
        oldCls != newCls && (!oldCls || !newCls || oldCls.bgClass != newCls.bgClass || oldCls.textClass != newCls.textClass);
      for (var i = 0; !ischange && i < oldStyles.length; ++i) { ischange = oldStyles[i] != line.styles[i]; }
      if (ischange) { changedLines.push(context.line); }
      line.stateAfter = context.save();
      context.nextLine();
    } else {
      if (line.text.length <= cm.options.maxHighlightLength)
        { processLine(cm, line.text, context); }
      line.stateAfter = context.line % 5 == 0 ? context.save() : null;
      context.nextLine();
    }
    if (+new Date > end) {
      startWorker(cm, cm.options.workDelay);
      return true
    }
  });
  doc.highlightFrontier = context.line;
  doc.modeFrontier = Math.max(doc.modeFrontier, context.line);
  if (changedLines.length) { runInOp(cm, function () {
    for (var i = 0; i < changedLines.length; i++)
      { regLineChange(cm, changedLines[i], "text"); }
  }); }
}

// DISPLAY DRAWING

var DisplayUpdate = function(cm, viewport, force) {
  var display = cm.display;

  this.viewport = viewport;
  // Store some values that we'll need later (but don't want to force a relayout for)
  this.visible = visibleLines(display, cm.doc, viewport);
  this.editorIsHidden = !display.wrapper.offsetWidth;
  this.wrapperHeight = display.wrapper.clientHeight;
  this.wrapperWidth = display.wrapper.clientWidth;
  this.oldDisplayWidth = displayWidth(cm);
  this.force = force;
  this.dims = getDimensions(cm);
  this.events = [];
};

DisplayUpdate.prototype.signal = function (emitter, type) {
  if (hasHandler(emitter, type))
    { this.events.push(arguments); }
};
DisplayUpdate.prototype.finish = function () {
    var this$1 = this;

  for (var i = 0; i < this.events.length; i++)
    { signal.apply(null, this$1.events[i]); }
};

function maybeClipScrollbars(cm) {
  var display = cm.display;
  if (!display.scrollbarsClipped && display.scroller.offsetWidth) {
    display.nativeBarWidth = display.scroller.offsetWidth - display.scroller.clientWidth;
    display.heightForcer.style.height = scrollGap(cm) + "px";
    display.sizer.style.marginBottom = -display.nativeBarWidth + "px";
    display.sizer.style.borderRightWidth = scrollGap(cm) + "px";
    display.scrollbarsClipped = true;
  }
}

function selectionSnapshot(cm) {
  if (cm.hasFocus()) { return null }
  var active = activeElt();
  if (!active || !contains(cm.display.lineDiv, active)) { return null }
  var result = {activeElt: active};
  if (window.getSelection) {
    var sel = window.getSelection();
    if (sel.anchorNode && sel.extend && contains(cm.display.lineDiv, sel.anchorNode)) {
      result.anchorNode = sel.anchorNode;
      result.anchorOffset = sel.anchorOffset;
      result.focusNode = sel.focusNode;
      result.focusOffset = sel.focusOffset;
    }
  }
  return result
}

function restoreSelection(snapshot) {
  if (!snapshot || !snapshot.activeElt || snapshot.activeElt == activeElt()) { return }
  snapshot.activeElt.focus();
  if (snapshot.anchorNode && contains(document.body, snapshot.anchorNode) && contains(document.body, snapshot.focusNode)) {
    var sel = window.getSelection(), range$$1 = document.createRange();
    range$$1.setEnd(snapshot.anchorNode, snapshot.anchorOffset);
    range$$1.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range$$1);
    sel.extend(snapshot.focusNode, snapshot.focusOffset);
  }
}

// Does the actual updating of the line display. Bails out
// (returning false) when there is nothing to be done and forced is
// false.
function updateDisplayIfNeeded(cm, update) {
  var display = cm.display, doc = cm.doc;

  if (update.editorIsHidden) {
    resetView(cm);
    return false
  }

  // Bail out if the visible area is already rendered and nothing changed.
  if (!update.force &&
      update.visible.from >= display.viewFrom && update.visible.to <= display.viewTo &&
      (display.updateLineNumbers == null || display.updateLineNumbers >= display.viewTo) &&
      display.renderedView == display.view && countDirtyView(cm) == 0)
    { return false }

  if (maybeUpdateLineNumberWidth(cm)) {
    resetView(cm);
    update.dims = getDimensions(cm);
  }

  // Compute a suitable new viewport (from & to)
  var end = doc.first + doc.size;
  var from = Math.max(update.visible.from - cm.options.viewportMargin, doc.first);
  var to = Math.min(end, update.visible.to + cm.options.viewportMargin);
  if (display.viewFrom < from && from - display.viewFrom < 20) { from = Math.max(doc.first, display.viewFrom); }
  if (display.viewTo > to && display.viewTo - to < 20) { to = Math.min(end, display.viewTo); }
  if (sawCollapsedSpans) {
    from = visualLineNo(cm.doc, from);
    to = visualLineEndNo(cm.doc, to);
  }

  var different = from != display.viewFrom || to != display.viewTo ||
    display.lastWrapHeight != update.wrapperHeight || display.lastWrapWidth != update.wrapperWidth;
  adjustView(cm, from, to);

  display.viewOffset = heightAtLine(getLine(cm.doc, display.viewFrom));
  // Position the mover div to align with the current scroll position
  cm.display.mover.style.top = display.viewOffset + "px";

  var toUpdate = countDirtyView(cm);
  if (!different && toUpdate == 0 && !update.force && display.renderedView == display.view &&
      (display.updateLineNumbers == null || display.updateLineNumbers >= display.viewTo))
    { return false }

  // For big changes, we hide the enclosing element during the
  // update, since that speeds up the operations on most browsers.
  var selSnapshot = selectionSnapshot(cm);
  if (toUpdate > 4) { display.lineDiv.style.display = "none"; }
  patchDisplay(cm, display.updateLineNumbers, update.dims);
  if (toUpdate > 4) { display.lineDiv.style.display = ""; }
  display.renderedView = display.view;
  // There might have been a widget with a focused element that got
  // hidden or updated, if so re-focus it.
  restoreSelection(selSnapshot);

  // Prevent selection and cursors from interfering with the scroll
  // width and height.
  removeChildren(display.cursorDiv);
  removeChildren(display.selectionDiv);
  display.gutters.style.height = display.sizer.style.minHeight = 0;

  if (different) {
    display.lastWrapHeight = update.wrapperHeight;
    display.lastWrapWidth = update.wrapperWidth;
    startWorker(cm, 400);
  }

  display.updateLineNumbers = null;

  return true
}

function postUpdateDisplay(cm, update) {
  var viewport = update.viewport;

  for (var first = true;; first = false) {
    if (!first || !cm.options.lineWrapping || update.oldDisplayWidth == displayWidth(cm)) {
      // Clip forced viewport to actual scrollable area.
      if (viewport && viewport.top != null)
        { viewport = {top: Math.min(cm.doc.height + paddingVert(cm.display) - displayHeight(cm), viewport.top)}; }
      // Updated line heights might result in the drawn area not
      // actually covering the viewport. Keep looping until it does.
      update.visible = visibleLines(cm.display, cm.doc, viewport);
      if (update.visible.from >= cm.display.viewFrom && update.visible.to <= cm.display.viewTo)
        { break }
    }
    if (!updateDisplayIfNeeded(cm, update)) { break }
    updateHeightsInViewport(cm);
    var barMeasure = measureForScrollbars(cm);
    updateSelection(cm);
    updateScrollbars(cm, barMeasure);
    setDocumentHeight(cm, barMeasure);
    update.force = false;
  }

  update.signal(cm, "update", cm);
  if (cm.display.viewFrom != cm.display.reportedViewFrom || cm.display.viewTo != cm.display.reportedViewTo) {
    update.signal(cm, "viewportChange", cm, cm.display.viewFrom, cm.display.viewTo);
    cm.display.reportedViewFrom = cm.display.viewFrom; cm.display.reportedViewTo = cm.display.viewTo;
  }
}

function updateDisplaySimple(cm, viewport) {
  var update = new DisplayUpdate(cm, viewport);
  if (updateDisplayIfNeeded(cm, update)) {
    updateHeightsInViewport(cm);
    postUpdateDisplay(cm, update);
    var barMeasure = measureForScrollbars(cm);
    updateSelection(cm);
    updateScrollbars(cm, barMeasure);
    setDocumentHeight(cm, barMeasure);
    update.finish();
  }
}

// Sync the actual display DOM structure with display.view, removing
// nodes for lines that are no longer in view, and creating the ones
// that are not there yet, and updating the ones that are out of
// date.
function patchDisplay(cm, updateNumbersFrom, dims) {
  var display = cm.display, lineNumbers = cm.options.lineNumbers;
  var container = display.lineDiv, cur = container.firstChild;

  function rm(node) {
    var next = node.nextSibling;
    // Works around a throw-scroll bug in OS X Webkit
    if (webkit && mac && cm.display.currentWheelTarget == node)
      { node.style.display = "none"; }
    else
      { node.parentNode.removeChild(node); }
    return next
  }

  var view = display.view, lineN = display.viewFrom;
  // Loop over the elements in the view, syncing cur (the DOM nodes
  // in display.lineDiv) with the view as we go.
  for (var i = 0; i < view.length; i++) {
    var lineView = view[i];
    if (lineView.hidden) {
    } else if (!lineView.node || lineView.node.parentNode != container) { // Not drawn yet
      var node = buildLineElement(cm, lineView, lineN, dims);
      container.insertBefore(node, cur);
    } else { // Already drawn
      while (cur != lineView.node) { cur = rm(cur); }
      var updateNumber = lineNumbers && updateNumbersFrom != null &&
        updateNumbersFrom <= lineN && lineView.lineNumber;
      if (lineView.changes) {
        if (indexOf(lineView.changes, "gutter") > -1) { updateNumber = false; }
        updateLineForChanges(cm, lineView, lineN, dims);
      }
      if (updateNumber) {
        removeChildren(lineView.lineNumber);
        lineView.lineNumber.appendChild(document.createTextNode(lineNumberFor(cm.options, lineN)));
      }
      cur = lineView.node.nextSibling;
    }
    lineN += lineView.size;
  }
  while (cur) { cur = rm(cur); }
}

function updateGutterSpace(cm) {
  var width = cm.display.gutters.offsetWidth;
  cm.display.sizer.style.marginLeft = width + "px";
}

function setDocumentHeight(cm, measure) {
  cm.display.sizer.style.minHeight = measure.docHeight + "px";
  cm.display.heightForcer.style.top = measure.docHeight + "px";
  cm.display.gutters.style.height = (measure.docHeight + cm.display.barHeight + scrollGap(cm)) + "px";
}

// Rebuild the gutter elements, ensure the margin to the left of the
// code matches their width.
function updateGutters(cm) {
  var gutters = cm.display.gutters, specs = cm.options.gutters;
  removeChildren(gutters);
  var i = 0;
  for (; i < specs.length; ++i) {
    var gutterClass = specs[i];
    var gElt = gutters.appendChild(elt("div", null, "CodeMirror-gutter " + gutterClass));
    if (gutterClass == "CodeMirror-linenumbers") {
      cm.display.lineGutter = gElt;
      gElt.style.width = (cm.display.lineNumWidth || 1) + "px";
    }
  }
  gutters.style.display = i ? "" : "none";
  updateGutterSpace(cm);
}

// Make sure the gutters options contains the element
// "CodeMirror-linenumbers" when the lineNumbers option is true.
function setGuttersForLineNumbers(options) {
  var found = indexOf(options.gutters, "CodeMirror-linenumbers");
  if (found == -1 && options.lineNumbers) {
    options.gutters = options.gutters.concat(["CodeMirror-linenumbers"]);
  } else if (found > -1 && !options.lineNumbers) {
    options.gutters = options.gutters.slice(0);
    options.gutters.splice(found, 1);
  }
}

// Since the delta values reported on mouse wheel events are
// unstandardized between browsers and even browser versions, and
// generally horribly unpredictable, this code starts by measuring
// the scroll effect that the first few mouse wheel events have,
// and, from that, detects the way it can convert deltas to pixel
// offsets afterwards.
//
// The reason we want to know the amount a wheel event will scroll
// is that it gives us a chance to update the display before the
// actual scrolling happens, reducing flickering.

var wheelSamples = 0;
var wheelPixelsPerUnit = null;
// Fill in a browser-detected starting value on browsers where we
// know one. These don't have to be accurate -- the result of them
// being wrong would just be a slight flicker on the first wheel
// scroll (if it is large enough).
if (ie) { wheelPixelsPerUnit = -.53; }
else if (gecko) { wheelPixelsPerUnit = 15; }
else if (chrome) { wheelPixelsPerUnit = -.7; }
else if (safari) { wheelPixelsPerUnit = -1/3; }

function wheelEventDelta(e) {
  var dx = e.wheelDeltaX, dy = e.wheelDeltaY;
  if (dx == null && e.detail && e.axis == e.HORIZONTAL_AXIS) { dx = e.detail; }
  if (dy == null && e.detail && e.axis == e.VERTICAL_AXIS) { dy = e.detail; }
  else if (dy == null) { dy = e.wheelDelta; }
  return {x: dx, y: dy}
}
function wheelEventPixels(e) {
  var delta = wheelEventDelta(e);
  delta.x *= wheelPixelsPerUnit;
  delta.y *= wheelPixelsPerUnit;
  return delta
}

function onScrollWheel(cm, e) {
  var delta = wheelEventDelta(e), dx = delta.x, dy = delta.y;

  var display = cm.display, scroll = display.scroller;
  // Quit if there's nothing to scroll here
  var canScrollX = scroll.scrollWidth > scroll.clientWidth;
  var canScrollY = scroll.scrollHeight > scroll.clientHeight;
  if (!(dx && canScrollX || dy && canScrollY)) { return }

  // Webkit browsers on OS X abort momentum scrolls when the target
  // of the scroll event is removed from the scrollable element.
  // This hack (see related code in patchDisplay) makes sure the
  // element is kept around.
  if (dy && mac && webkit) {
    outer: for (var cur = e.target, view = display.view; cur != scroll; cur = cur.parentNode) {
      for (var i = 0; i < view.length; i++) {
        if (view[i].node == cur) {
          cm.display.currentWheelTarget = cur;
          break outer
        }
      }
    }
  }

  // On some browsers, horizontal scrolling will cause redraws to
  // happen before the gutter has been realigned, causing it to
  // wriggle around in a most unseemly way. When we have an
  // estimated pixels/delta value, we just handle horizontal
  // scrolling entirely here. It'll be slightly off from native, but
  // better than glitching out.
  if (dx && !gecko && !presto && wheelPixelsPerUnit != null) {
    if (dy && canScrollY)
      { updateScrollTop(cm, Math.max(0, scroll.scrollTop + dy * wheelPixelsPerUnit)); }
    setScrollLeft(cm, Math.max(0, scroll.scrollLeft + dx * wheelPixelsPerUnit));
    // Only prevent default scrolling if vertical scrolling is
    // actually possible. Otherwise, it causes vertical scroll
    // jitter on OSX trackpads when deltaX is small and deltaY
    // is large (issue #3579)
    if (!dy || (dy && canScrollY))
      { e_preventDefault(e); }
    display.wheelStartX = null; // Abort measurement, if in progress
    return
  }

  // 'Project' the visible viewport to cover the area that is being
  // scrolled into view (if we know enough to estimate it).
  if (dy && wheelPixelsPerUnit != null) {
    var pixels = dy * wheelPixelsPerUnit;
    var top = cm.doc.scrollTop, bot = top + display.wrapper.clientHeight;
    if (pixels < 0) { top = Math.max(0, top + pixels - 50); }
    else { bot = Math.min(cm.doc.height, bot + pixels + 50); }
    updateDisplaySimple(cm, {top: top, bottom: bot});
  }

  if (wheelSamples < 20) {
    if (display.wheelStartX == null) {
      display.wheelStartX = scroll.scrollLeft; display.wheelStartY = scroll.scrollTop;
      display.wheelDX = dx; display.wheelDY = dy;
      setTimeout(function () {
        if (display.wheelStartX == null) { return }
        var movedX = scroll.scrollLeft - display.wheelStartX;
        var movedY = scroll.scrollTop - display.wheelStartY;
        var sample = (movedY && display.wheelDY && movedY / display.wheelDY) ||
          (movedX && display.wheelDX && movedX / display.wheelDX);
        display.wheelStartX = display.wheelStartY = null;
        if (!sample) { return }
        wheelPixelsPerUnit = (wheelPixelsPerUnit * wheelSamples + sample) / (wheelSamples + 1);
        ++wheelSamples;
      }, 200);
    } else {
      display.wheelDX += dx; display.wheelDY += dy;
    }
  }
}

// Selection objects are immutable. A new one is created every time
// the selection changes. A selection is one or more non-overlapping
// (and non-touching) ranges, sorted, and an integer that indicates
// which one is the primary selection (the one that's scrolled into
// view, that getCursor returns, etc).
var Selection = function(ranges, primIndex) {
  this.ranges = ranges;
  this.primIndex = primIndex;
};

Selection.prototype.primary = function () { return this.ranges[this.primIndex] };

Selection.prototype.equals = function (other) {
    var this$1 = this;

  if (other == this) { return true }
  if (other.primIndex != this.primIndex || other.ranges.length != this.ranges.length) { return false }
  for (var i = 0; i < this.ranges.length; i++) {
    var here = this$1.ranges[i], there = other.ranges[i];
    if (!equalCursorPos(here.anchor, there.anchor) || !equalCursorPos(here.head, there.head)) { return false }
  }
  return true
};

Selection.prototype.deepCopy = function () {
    var this$1 = this;

  var out = [];
  for (var i = 0; i < this.ranges.length; i++)
    { out[i] = new Range(copyPos(this$1.ranges[i].anchor), copyPos(this$1.ranges[i].head)); }
  return new Selection(out, this.primIndex)
};

Selection.prototype.somethingSelected = function () {
    var this$1 = this;

  for (var i = 0; i < this.ranges.length; i++)
    { if (!this$1.ranges[i].empty()) { return true } }
  return false
};

Selection.prototype.contains = function (pos, end) {
    var this$1 = this;

  if (!end) { end = pos; }
  for (var i = 0; i < this.ranges.length; i++) {
    var range = this$1.ranges[i];
    if (cmp(end, range.from()) >= 0 && cmp(pos, range.to()) <= 0)
      { return i }
  }
  return -1
};

var Range = function(anchor, head) {
  this.anchor = anchor; this.head = head;
};

Range.prototype.from = function () { return minPos(this.anchor, this.head) };
Range.prototype.to = function () { return maxPos(this.anchor, this.head) };
Range.prototype.empty = function () { return this.head.line == this.anchor.line && this.head.ch == this.anchor.ch };

// Take an unsorted, potentially overlapping set of ranges, and
// build a selection out of it. 'Consumes' ranges array (modifying
// it).
function normalizeSelection(ranges, primIndex) {
  var prim = ranges[primIndex];
  ranges.sort(function (a, b) { return cmp(a.from(), b.from()); });
  primIndex = indexOf(ranges, prim);
  for (var i = 1; i < ranges.length; i++) {
    var cur = ranges[i], prev = ranges[i - 1];
    if (cmp(prev.to(), cur.from()) >= 0) {
      var from = minPos(prev.from(), cur.from()), to = maxPos(prev.to(), cur.to());
      var inv = prev.empty() ? cur.from() == cur.head : prev.from() == prev.head;
      if (i <= primIndex) { --primIndex; }
      ranges.splice(--i, 2, new Range(inv ? to : from, inv ? from : to));
    }
  }
  return new Selection(ranges, primIndex)
}

function simpleSelection(anchor, head) {
  return new Selection([new Range(anchor, head || anchor)], 0)
}

// Compute the position of the end of a change (its 'to' property
// refers to the pre-change end).
function changeEnd(change) {
  if (!change.text) { return change.to }
  return Pos(change.from.line + change.text.length - 1,
             lst(change.text).length + (change.text.length == 1 ? change.from.ch : 0))
}

// Adjust a position to refer to the post-change position of the
// same text, or the end of the change if the change covers it.
function adjustForChange(pos, change) {
  if (cmp(pos, change.from) < 0) { return pos }
  if (cmp(pos, change.to) <= 0) { return changeEnd(change) }

  var line = pos.line + change.text.length - (change.to.line - change.from.line) - 1, ch = pos.ch;
  if (pos.line == change.to.line) { ch += changeEnd(change).ch - change.to.ch; }
  return Pos(line, ch)
}

function computeSelAfterChange(doc, change) {
  var out = [];
  for (var i = 0; i < doc.sel.ranges.length; i++) {
    var range = doc.sel.ranges[i];
    out.push(new Range(adjustForChange(range.anchor, change),
                       adjustForChange(range.head, change)));
  }
  return normalizeSelection(out, doc.sel.primIndex)
}

function offsetPos(pos, old, nw) {
  if (pos.line == old.line)
    { return Pos(nw.line, pos.ch - old.ch + nw.ch) }
  else
    { return Pos(nw.line + (pos.line - old.line), pos.ch) }
}

// Used by replaceSelections to allow moving the selection to the
// start or around the replaced test. Hint may be "start" or "around".
function computeReplacedSel(doc, changes, hint) {
  var out = [];
  var oldPrev = Pos(doc.first, 0), newPrev = oldPrev;
  for (var i = 0; i < changes.length; i++) {
    var change = changes[i];
    var from = offsetPos(change.from, oldPrev, newPrev);
    var to = offsetPos(changeEnd(change), oldPrev, newPrev);
    oldPrev = change.to;
    newPrev = to;
    if (hint == "around") {
      var range = doc.sel.ranges[i], inv = cmp(range.head, range.anchor) < 0;
      out[i] = new Range(inv ? to : from, inv ? from : to);
    } else {
      out[i] = new Range(from, from);
    }
  }
  return new Selection(out, doc.sel.primIndex)
}

// Used to get the editor into a consistent state again when options change.

function loadMode(cm) {
  cm.doc.mode = getMode(cm.options, cm.doc.modeOption);
  resetModeState(cm);
}

function resetModeState(cm) {
  cm.doc.iter(function (line) {
    if (line.stateAfter) { line.stateAfter = null; }
    if (line.styles) { line.styles = null; }
  });
  cm.doc.modeFrontier = cm.doc.highlightFrontier = cm.doc.first;
  startWorker(cm, 100);
  cm.state.modeGen++;
  if (cm.curOp) { regChange(cm); }
}

// DOCUMENT DATA STRUCTURE

// By default, updates that start and end at the beginning of a line
// are treated specially, in order to make the association of line
// widgets and marker elements with the text behave more intuitive.
function isWholeLineUpdate(doc, change) {
  return change.from.ch == 0 && change.to.ch == 0 && lst(change.text) == "" &&
    (!doc.cm || doc.cm.options.wholeLineUpdateBefore)
}

// Perform a change on the document data structure.
function updateDoc(doc, change, markedSpans, estimateHeight$$1) {
  function spansFor(n) {return markedSpans ? markedSpans[n] : null}
  function update(line, text, spans) {
    updateLine(line, text, spans, estimateHeight$$1);
    signalLater(line, "change", line, change);
  }
  function linesFor(start, end) {
    var result = [];
    for (var i = start; i < end; ++i)
      { result.push(new Line(text[i], spansFor(i), estimateHeight$$1)); }
    return result
  }

  var from = change.from, to = change.to, text = change.text;
  var firstLine = getLine(doc, from.line), lastLine = getLine(doc, to.line);
  var lastText = lst(text), lastSpans = spansFor(text.length - 1), nlines = to.line - from.line;

  // Adjust the line structure
  if (change.full) {
    doc.insert(0, linesFor(0, text.length));
    doc.remove(text.length, doc.size - text.length);
  } else if (isWholeLineUpdate(doc, change)) {
    // This is a whole-line replace. Treated specially to make
    // sure line objects move the way they are supposed to.
    var added = linesFor(0, text.length - 1);
    update(lastLine, lastLine.text, lastSpans);
    if (nlines) { doc.remove(from.line, nlines); }
    if (added.length) { doc.insert(from.line, added); }
  } else if (firstLine == lastLine) {
    if (text.length == 1) {
      update(firstLine, firstLine.text.slice(0, from.ch) + lastText + firstLine.text.slice(to.ch), lastSpans);
    } else {
      var added$1 = linesFor(1, text.length - 1);
      added$1.push(new Line(lastText + firstLine.text.slice(to.ch), lastSpans, estimateHeight$$1));
      update(firstLine, firstLine.text.slice(0, from.ch) + text[0], spansFor(0));
      doc.insert(from.line + 1, added$1);
    }
  } else if (text.length == 1) {
    update(firstLine, firstLine.text.slice(0, from.ch) + text[0] + lastLine.text.slice(to.ch), spansFor(0));
    doc.remove(from.line + 1, nlines);
  } else {
    update(firstLine, firstLine.text.slice(0, from.ch) + text[0], spansFor(0));
    update(lastLine, lastText + lastLine.text.slice(to.ch), lastSpans);
    var added$2 = linesFor(1, text.length - 1);
    if (nlines > 1) { doc.remove(from.line + 1, nlines - 1); }
    doc.insert(from.line + 1, added$2);
  }

  signalLater(doc, "change", doc, change);
}

// Call f for all linked documents.
function linkedDocs(doc, f, sharedHistOnly) {
  function propagate(doc, skip, sharedHist) {
    if (doc.linked) { for (var i = 0; i < doc.linked.length; ++i) {
      var rel = doc.linked[i];
      if (rel.doc == skip) { continue }
      var shared = sharedHist && rel.sharedHist;
      if (sharedHistOnly && !shared) { continue }
      f(rel.doc, shared);
      propagate(rel.doc, doc, shared);
    } }
  }
  propagate(doc, null, true);
}

// Attach a document to an editor.
function attachDoc(cm, doc) {
  if (doc.cm) { throw new Error("This document is already in use.") }
  cm.doc = doc;
  doc.cm = cm;
  estimateLineHeights(cm);
  loadMode(cm);
  setDirectionClass(cm);
  if (!cm.options.lineWrapping) { findMaxLine(cm); }
  cm.options.mode = doc.modeOption;
  regChange(cm);
}

function setDirectionClass(cm) {
  (cm.doc.direction == "rtl" ? addClass : rmClass)(cm.display.lineDiv, "CodeMirror-rtl");
}

function directionChanged(cm) {
  runInOp(cm, function () {
    setDirectionClass(cm);
    regChange(cm);
  });
}

function History(startGen) {
  // Arrays of change events and selections. Doing something adds an
  // event to done and clears undo. Undoing moves events from done
  // to undone, redoing moves them in the other direction.
  this.done = []; this.undone = [];
  this.undoDepth = Infinity;
  // Used to track when changes can be merged into a single undo
  // event
  this.lastModTime = this.lastSelTime = 0;
  this.lastOp = this.lastSelOp = null;
  this.lastOrigin = this.lastSelOrigin = null;
  // Used by the isClean() method
  this.generation = this.maxGeneration = startGen || 1;
}

// Create a history change event from an updateDoc-style change
// object.
function historyChangeFromChange(doc, change) {
  var histChange = {from: copyPos(change.from), to: changeEnd(change), text: getBetween(doc, change.from, change.to)};
  attachLocalSpans(doc, histChange, change.from.line, change.to.line + 1);
  linkedDocs(doc, function (doc) { return attachLocalSpans(doc, histChange, change.from.line, change.to.line + 1); }, true);
  return histChange
}

// Pop all selection events off the end of a history array. Stop at
// a change event.
function clearSelectionEvents(array) {
  while (array.length) {
    var last = lst(array);
    if (last.ranges) { array.pop(); }
    else { break }
  }
}

// Find the top change event in the history. Pop off selection
// events that are in the way.
function lastChangeEvent(hist, force) {
  if (force) {
    clearSelectionEvents(hist.done);
    return lst(hist.done)
  } else if (hist.done.length && !lst(hist.done).ranges) {
    return lst(hist.done)
  } else if (hist.done.length > 1 && !hist.done[hist.done.length - 2].ranges) {
    hist.done.pop();
    return lst(hist.done)
  }
}

// Register a change in the history. Merges changes that are within
// a single operation, or are close together with an origin that
// allows merging (starting with "+") into a single event.
function addChangeToHistory(doc, change, selAfter, opId) {
  var hist = doc.history;
  hist.undone.length = 0;
  var time = +new Date, cur;
  var last;

  if ((hist.lastOp == opId ||
       hist.lastOrigin == change.origin && change.origin &&
       ((change.origin.charAt(0) == "+" && doc.cm && hist.lastModTime > time - doc.cm.options.historyEventDelay) ||
        change.origin.charAt(0) == "*")) &&
      (cur = lastChangeEvent(hist, hist.lastOp == opId))) {
    // Merge this change into the last event
    last = lst(cur.changes);
    if (cmp(change.from, change.to) == 0 && cmp(change.from, last.to) == 0) {
      // Optimized case for simple insertion -- don't want to add
      // new changesets for every character typed
      last.to = changeEnd(change);
    } else {
      // Add new sub-event
      cur.changes.push(historyChangeFromChange(doc, change));
    }
  } else {
    // Can not be merged, start a new event.
    var before = lst(hist.done);
    if (!before || !before.ranges)
      { pushSelectionToHistory(doc.sel, hist.done); }
    cur = {changes: [historyChangeFromChange(doc, change)],
           generation: hist.generation};
    hist.done.push(cur);
    while (hist.done.length > hist.undoDepth) {
      hist.done.shift();
      if (!hist.done[0].ranges) { hist.done.shift(); }
    }
  }
  hist.done.push(selAfter);
  hist.generation = ++hist.maxGeneration;
  hist.lastModTime = hist.lastSelTime = time;
  hist.lastOp = hist.lastSelOp = opId;
  hist.lastOrigin = hist.lastSelOrigin = change.origin;

  if (!last) { signal(doc, "historyAdded"); }
}

function selectionEventCanBeMerged(doc, origin, prev, sel) {
  var ch = origin.charAt(0);
  return ch == "*" ||
    ch == "+" &&
    prev.ranges.length == sel.ranges.length &&
    prev.somethingSelected() == sel.somethingSelected() &&
    new Date - doc.history.lastSelTime <= (doc.cm ? doc.cm.options.historyEventDelay : 500)
}

// Called whenever the selection changes, sets the new selection as
// the pending selection in the history, and pushes the old pending
// selection into the 'done' array when it was significantly
// different (in number of selected ranges, emptiness, or time).
function addSelectionToHistory(doc, sel, opId, options) {
  var hist = doc.history, origin = options && options.origin;

  // A new event is started when the previous origin does not match
  // the current, or the origins don't allow matching. Origins
  // starting with * are always merged, those starting with + are
  // merged when similar and close together in time.
  if (opId == hist.lastSelOp ||
      (origin && hist.lastSelOrigin == origin &&
       (hist.lastModTime == hist.lastSelTime && hist.lastOrigin == origin ||
        selectionEventCanBeMerged(doc, origin, lst(hist.done), sel))))
    { hist.done[hist.done.length - 1] = sel; }
  else
    { pushSelectionToHistory(sel, hist.done); }

  hist.lastSelTime = +new Date;
  hist.lastSelOrigin = origin;
  hist.lastSelOp = opId;
  if (options && options.clearRedo !== false)
    { clearSelectionEvents(hist.undone); }
}

function pushSelectionToHistory(sel, dest) {
  var top = lst(dest);
  if (!(top && top.ranges && top.equals(sel)))
    { dest.push(sel); }
}

// Used to store marked span information in the history.
function attachLocalSpans(doc, change, from, to) {
  var existing = change["spans_" + doc.id], n = 0;
  doc.iter(Math.max(doc.first, from), Math.min(doc.first + doc.size, to), function (line) {
    if (line.markedSpans)
      { (existing || (existing = change["spans_" + doc.id] = {}))[n] = line.markedSpans; }
    ++n;
  });
}

// When un/re-doing restores text containing marked spans, those
// that have been explicitly cleared should not be restored.
function removeClearedSpans(spans) {
  if (!spans) { return null }
  var out;
  for (var i = 0; i < spans.length; ++i) {
    if (spans[i].marker.explicitlyCleared) { if (!out) { out = spans.slice(0, i); } }
    else if (out) { out.push(spans[i]); }
  }
  return !out ? spans : out.length ? out : null
}

// Retrieve and filter the old marked spans stored in a change event.
function getOldSpans(doc, change) {
  var found = change["spans_" + doc.id];
  if (!found) { return null }
  var nw = [];
  for (var i = 0; i < change.text.length; ++i)
    { nw.push(removeClearedSpans(found[i])); }
  return nw
}

// Used for un/re-doing changes from the history. Combines the
// result of computing the existing spans with the set of spans that
// existed in the history (so that deleting around a span and then
// undoing brings back the span).
function mergeOldSpans(doc, change) {
  var old = getOldSpans(doc, change);
  var stretched = stretchSpansOverChange(doc, change);
  if (!old) { return stretched }
  if (!stretched) { return old }

  for (var i = 0; i < old.length; ++i) {
    var oldCur = old[i], stretchCur = stretched[i];
    if (oldCur && stretchCur) {
      spans: for (var j = 0; j < stretchCur.length; ++j) {
        var span = stretchCur[j];
        for (var k = 0; k < oldCur.length; ++k)
          { if (oldCur[k].marker == span.marker) { continue spans } }
        oldCur.push(span);
      }
    } else if (stretchCur) {
      old[i] = stretchCur;
    }
  }
  return old
}

// Used both to provide a JSON-safe object in .getHistory, and, when
// detaching a document, to split the history in two
function copyHistoryArray(events, newGroup, instantiateSel) {
  var copy = [];
  for (var i = 0; i < events.length; ++i) {
    var event = events[i];
    if (event.ranges) {
      copy.push(instantiateSel ? Selection.prototype.deepCopy.call(event) : event);
      continue
    }
    var changes = event.changes, newChanges = [];
    copy.push({changes: newChanges});
    for (var j = 0; j < changes.length; ++j) {
      var change = changes[j], m = (void 0);
      newChanges.push({from: change.from, to: change.to, text: change.text});
      if (newGroup) { for (var prop in change) { if (m = prop.match(/^spans_(\d+)$/)) {
        if (indexOf(newGroup, Number(m[1])) > -1) {
          lst(newChanges)[prop] = change[prop];
          delete change[prop];
        }
      } } }
    }
  }
  return copy
}

// The 'scroll' parameter given to many of these indicated whether
// the new cursor position should be scrolled into view after
// modifying the selection.

// If shift is held or the extend flag is set, extends a range to
// include a given position (and optionally a second position).
// Otherwise, simply returns the range between the given positions.
// Used for cursor motion and such.
function extendRange(range, head, other, extend) {
  if (extend) {
    var anchor = range.anchor;
    if (other) {
      var posBefore = cmp(head, anchor) < 0;
      if (posBefore != (cmp(other, anchor) < 0)) {
        anchor = head;
        head = other;
      } else if (posBefore != (cmp(head, other) < 0)) {
        head = other;
      }
    }
    return new Range(anchor, head)
  } else {
    return new Range(other || head, head)
  }
}

// Extend the primary selection range, discard the rest.
function extendSelection(doc, head, other, options, extend) {
  if (extend == null) { extend = doc.cm && (doc.cm.display.shift || doc.extend); }
  setSelection(doc, new Selection([extendRange(doc.sel.primary(), head, other, extend)], 0), options);
}

// Extend all selections (pos is an array of selections with length
// equal the number of selections)
function extendSelections(doc, heads, options) {
  var out = [];
  var extend = doc.cm && (doc.cm.display.shift || doc.extend);
  for (var i = 0; i < doc.sel.ranges.length; i++)
    { out[i] = extendRange(doc.sel.ranges[i], heads[i], null, extend); }
  var newSel = normalizeSelection(out, doc.sel.primIndex);
  setSelection(doc, newSel, options);
}

// Updates a single range in the selection.
function replaceOneSelection(doc, i, range, options) {
  var ranges = doc.sel.ranges.slice(0);
  ranges[i] = range;
  setSelection(doc, normalizeSelection(ranges, doc.sel.primIndex), options);
}

// Reset the selection to a single range.
function setSimpleSelection(doc, anchor, head, options) {
  setSelection(doc, simpleSelection(anchor, head), options);
}

// Give beforeSelectionChange handlers a change to influence a
// selection update.
function filterSelectionChange(doc, sel, options) {
  var obj = {
    ranges: sel.ranges,
    update: function(ranges) {
      var this$1 = this;

      this.ranges = [];
      for (var i = 0; i < ranges.length; i++)
        { this$1.ranges[i] = new Range(clipPos(doc, ranges[i].anchor),
                                   clipPos(doc, ranges[i].head)); }
    },
    origin: options && options.origin
  };
  signal(doc, "beforeSelectionChange", doc, obj);
  if (doc.cm) { signal(doc.cm, "beforeSelectionChange", doc.cm, obj); }
  if (obj.ranges != sel.ranges) { return normalizeSelection(obj.ranges, obj.ranges.length - 1) }
  else { return sel }
}

function setSelectionReplaceHistory(doc, sel, options) {
  var done = doc.history.done, last = lst(done);
  if (last && last.ranges) {
    done[done.length - 1] = sel;
    setSelectionNoUndo(doc, sel, options);
  } else {
    setSelection(doc, sel, options);
  }
}

// Set a new selection.
function setSelection(doc, sel, options) {
  setSelectionNoUndo(doc, sel, options);
  addSelectionToHistory(doc, doc.sel, doc.cm ? doc.cm.curOp.id : NaN, options);
}

function setSelectionNoUndo(doc, sel, options) {
  if (hasHandler(doc, "beforeSelectionChange") || doc.cm && hasHandler(doc.cm, "beforeSelectionChange"))
    { sel = filterSelectionChange(doc, sel, options); }

  var bias = options && options.bias ||
    (cmp(sel.primary().head, doc.sel.primary().head) < 0 ? -1 : 1);
  setSelectionInner(doc, skipAtomicInSelection(doc, sel, bias, true));

  if (!(options && options.scroll === false) && doc.cm)
    { ensureCursorVisible(doc.cm); }
}

function setSelectionInner(doc, sel) {
  if (sel.equals(doc.sel)) { return }

  doc.sel = sel;

  if (doc.cm) {
    doc.cm.curOp.updateInput = doc.cm.curOp.selectionChanged = true;
    signalCursorActivity(doc.cm);
  }
  signalLater(doc, "cursorActivity", doc);
}

// Verify that the selection does not partially select any atomic
// marked ranges.
function reCheckSelection(doc) {
  setSelectionInner(doc, skipAtomicInSelection(doc, doc.sel, null, false));
}

// Return a selection that does not partially select any atomic
// ranges.
function skipAtomicInSelection(doc, sel, bias, mayClear) {
  var out;
  for (var i = 0; i < sel.ranges.length; i++) {
    var range = sel.ranges[i];
    var old = sel.ranges.length == doc.sel.ranges.length && doc.sel.ranges[i];
    var newAnchor = skipAtomic(doc, range.anchor, old && old.anchor, bias, mayClear);
    var newHead = skipAtomic(doc, range.head, old && old.head, bias, mayClear);
    if (out || newAnchor != range.anchor || newHead != range.head) {
      if (!out) { out = sel.ranges.slice(0, i); }
      out[i] = new Range(newAnchor, newHead);
    }
  }
  return out ? normalizeSelection(out, sel.primIndex) : sel
}

function skipAtomicInner(doc, pos, oldPos, dir, mayClear) {
  var line = getLine(doc, pos.line);
  if (line.markedSpans) { for (var i = 0; i < line.markedSpans.length; ++i) {
    var sp = line.markedSpans[i], m = sp.marker;
    if ((sp.from == null || (m.inclusiveLeft ? sp.from <= pos.ch : sp.from < pos.ch)) &&
        (sp.to == null || (m.inclusiveRight ? sp.to >= pos.ch : sp.to > pos.ch))) {
      if (mayClear) {
        signal(m, "beforeCursorEnter");
        if (m.explicitlyCleared) {
          if (!line.markedSpans) { break }
          else {--i; continue}
        }
      }
      if (!m.atomic) { continue }

      if (oldPos) {
        var near = m.find(dir < 0 ? 1 : -1), diff = (void 0);
        if (dir < 0 ? m.inclusiveRight : m.inclusiveLeft)
          { near = movePos(doc, near, -dir, near && near.line == pos.line ? line : null); }
        if (near && near.line == pos.line && (diff = cmp(near, oldPos)) && (dir < 0 ? diff < 0 : diff > 0))
          { return skipAtomicInner(doc, near, pos, dir, mayClear) }
      }

      var far = m.find(dir < 0 ? -1 : 1);
      if (dir < 0 ? m.inclusiveLeft : m.inclusiveRight)
        { far = movePos(doc, far, dir, far.line == pos.line ? line : null); }
      return far ? skipAtomicInner(doc, far, pos, dir, mayClear) : null
    }
  } }
  return pos
}

// Ensure a given position is not inside an atomic range.
function skipAtomic(doc, pos, oldPos, bias, mayClear) {
  var dir = bias || 1;
  var found = skipAtomicInner(doc, pos, oldPos, dir, mayClear) ||
      (!mayClear && skipAtomicInner(doc, pos, oldPos, dir, true)) ||
      skipAtomicInner(doc, pos, oldPos, -dir, mayClear) ||
      (!mayClear && skipAtomicInner(doc, pos, oldPos, -dir, true));
  if (!found) {
    doc.cantEdit = true;
    return Pos(doc.first, 0)
  }
  return found
}

function movePos(doc, pos, dir, line) {
  if (dir < 0 && pos.ch == 0) {
    if (pos.line > doc.first) { return clipPos(doc, Pos(pos.line - 1)) }
    else { return null }
  } else if (dir > 0 && pos.ch == (line || getLine(doc, pos.line)).text.length) {
    if (pos.line < doc.first + doc.size - 1) { return Pos(pos.line + 1, 0) }
    else { return null }
  } else {
    return new Pos(pos.line, pos.ch + dir)
  }
}

function selectAll(cm) {
  cm.setSelection(Pos(cm.firstLine(), 0), Pos(cm.lastLine()), sel_dontScroll);
}

// UPDATING

// Allow "beforeChange" event handlers to influence a change
function filterChange(doc, change, update) {
  var obj = {
    canceled: false,
    from: change.from,
    to: change.to,
    text: change.text,
    origin: change.origin,
    cancel: function () { return obj.canceled = true; }
  };
  if (update) { obj.update = function (from, to, text, origin) {
    if (from) { obj.from = clipPos(doc, from); }
    if (to) { obj.to = clipPos(doc, to); }
    if (text) { obj.text = text; }
    if (origin !== undefined) { obj.origin = origin; }
  }; }
  signal(doc, "beforeChange", doc, obj);
  if (doc.cm) { signal(doc.cm, "beforeChange", doc.cm, obj); }

  if (obj.canceled) { return null }
  return {from: obj.from, to: obj.to, text: obj.text, origin: obj.origin}
}

// Apply a change to a document, and add it to the document's
// history, and propagating it to all linked documents.
function makeChange(doc, change, ignoreReadOnly) {
  if (doc.cm) {
    if (!doc.cm.curOp) { return operation(doc.cm, makeChange)(doc, change, ignoreReadOnly) }
    if (doc.cm.state.suppressEdits) { return }
  }

  if (hasHandler(doc, "beforeChange") || doc.cm && hasHandler(doc.cm, "beforeChange")) {
    change = filterChange(doc, change, true);
    if (!change) { return }
  }

  // Possibly split or suppress the update based on the presence
  // of read-only spans in its range.
  var split = sawReadOnlySpans && !ignoreReadOnly && removeReadOnlyRanges(doc, change.from, change.to);
  if (split) {
    for (var i = split.length - 1; i >= 0; --i)
      { makeChangeInner(doc, {from: split[i].from, to: split[i].to, text: i ? [""] : change.text, origin: change.origin}); }
  } else {
    makeChangeInner(doc, change);
  }
}

function makeChangeInner(doc, change) {
  if (change.text.length == 1 && change.text[0] == "" && cmp(change.from, change.to) == 0) { return }
  var selAfter = computeSelAfterChange(doc, change);
  addChangeToHistory(doc, change, selAfter, doc.cm ? doc.cm.curOp.id : NaN);

  makeChangeSingleDoc(doc, change, selAfter, stretchSpansOverChange(doc, change));
  var rebased = [];

  linkedDocs(doc, function (doc, sharedHist) {
    if (!sharedHist && indexOf(rebased, doc.history) == -1) {
      rebaseHist(doc.history, change);
      rebased.push(doc.history);
    }
    makeChangeSingleDoc(doc, change, null, stretchSpansOverChange(doc, change));
  });
}

// Revert a change stored in a document's history.
function makeChangeFromHistory(doc, type, allowSelectionOnly) {
  var suppress = doc.cm && doc.cm.state.suppressEdits;
  if (suppress && !allowSelectionOnly) { return }

  var hist = doc.history, event, selAfter = doc.sel;
  var source = type == "undo" ? hist.done : hist.undone, dest = type == "undo" ? hist.undone : hist.done;

  // Verify that there is a useable event (so that ctrl-z won't
  // needlessly clear selection events)
  var i = 0;
  for (; i < source.length; i++) {
    event = source[i];
    if (allowSelectionOnly ? event.ranges && !event.equals(doc.sel) : !event.ranges)
      { break }
  }
  if (i == source.length) { return }
  hist.lastOrigin = hist.lastSelOrigin = null;

  for (;;) {
    event = source.pop();
    if (event.ranges) {
      pushSelectionToHistory(event, dest);
      if (allowSelectionOnly && !event.equals(doc.sel)) {
        setSelection(doc, event, {clearRedo: false});
        return
      }
      selAfter = event;
    } else if (suppress) {
      source.push(event);
      return
    } else { break }
  }

  // Build up a reverse change object to add to the opposite history
  // stack (redo when undoing, and vice versa).
  var antiChanges = [];
  pushSelectionToHistory(selAfter, dest);
  dest.push({changes: antiChanges, generation: hist.generation});
  hist.generation = event.generation || ++hist.maxGeneration;

  var filter = hasHandler(doc, "beforeChange") || doc.cm && hasHandler(doc.cm, "beforeChange");

  var loop = function ( i ) {
    var change = event.changes[i];
    change.origin = type;
    if (filter && !filterChange(doc, change, false)) {
      source.length = 0;
      return {}
    }

    antiChanges.push(historyChangeFromChange(doc, change));

    var after = i ? computeSelAfterChange(doc, change) : lst(source);
    makeChangeSingleDoc(doc, change, after, mergeOldSpans(doc, change));
    if (!i && doc.cm) { doc.cm.scrollIntoView({from: change.from, to: changeEnd(change)}); }
    var rebased = [];

    // Propagate to the linked documents
    linkedDocs(doc, function (doc, sharedHist) {
      if (!sharedHist && indexOf(rebased, doc.history) == -1) {
        rebaseHist(doc.history, change);
        rebased.push(doc.history);
      }
      makeChangeSingleDoc(doc, change, null, mergeOldSpans(doc, change));
    });
  };

  for (var i$1 = event.changes.length - 1; i$1 >= 0; --i$1) {
    var returned = loop( i$1 );

    if ( returned ) return returned.v;
  }
}

// Sub-views need their line numbers shifted when text is added
// above or below them in the parent document.
function shiftDoc(doc, distance) {
  if (distance == 0) { return }
  doc.first += distance;
  doc.sel = new Selection(map(doc.sel.ranges, function (range) { return new Range(
    Pos(range.anchor.line + distance, range.anchor.ch),
    Pos(range.head.line + distance, range.head.ch)
  ); }), doc.sel.primIndex);
  if (doc.cm) {
    regChange(doc.cm, doc.first, doc.first - distance, distance);
    for (var d = doc.cm.display, l = d.viewFrom; l < d.viewTo; l++)
      { regLineChange(doc.cm, l, "gutter"); }
  }
}

// More lower-level change function, handling only a single document
// (not linked ones).
function makeChangeSingleDoc(doc, change, selAfter, spans) {
  if (doc.cm && !doc.cm.curOp)
    { return operation(doc.cm, makeChangeSingleDoc)(doc, change, selAfter, spans) }

  if (change.to.line < doc.first) {
    shiftDoc(doc, change.text.length - 1 - (change.to.line - change.from.line));
    return
  }
  if (change.from.line > doc.lastLine()) { return }

  // Clip the change to the size of this doc
  if (change.from.line < doc.first) {
    var shift = change.text.length - 1 - (doc.first - change.from.line);
    shiftDoc(doc, shift);
    change = {from: Pos(doc.first, 0), to: Pos(change.to.line + shift, change.to.ch),
              text: [lst(change.text)], origin: change.origin};
  }
  var last = doc.lastLine();
  if (change.to.line > last) {
    change = {from: change.from, to: Pos(last, getLine(doc, last).text.length),
              text: [change.text[0]], origin: change.origin};
  }

  change.removed = getBetween(doc, change.from, change.to);

  if (!selAfter) { selAfter = computeSelAfterChange(doc, change); }
  if (doc.cm) { makeChangeSingleDocInEditor(doc.cm, change, spans); }
  else { updateDoc(doc, change, spans); }
  setSelectionNoUndo(doc, selAfter, sel_dontScroll);
}

// Handle the interaction of a change to a document with the editor
// that this document is part of.
function makeChangeSingleDocInEditor(cm, change, spans) {
  var doc = cm.doc, display = cm.display, from = change.from, to = change.to;

  var recomputeMaxLength = false, checkWidthStart = from.line;
  if (!cm.options.lineWrapping) {
    checkWidthStart = lineNo(visualLine(getLine(doc, from.line)));
    doc.iter(checkWidthStart, to.line + 1, function (line) {
      if (line == display.maxLine) {
        recomputeMaxLength = true;
        return true
      }
    });
  }

  if (doc.sel.contains(change.from, change.to) > -1)
    { signalCursorActivity(cm); }

  updateDoc(doc, change, spans, estimateHeight(cm));

  if (!cm.options.lineWrapping) {
    doc.iter(checkWidthStart, from.line + change.text.length, function (line) {
      var len = lineLength(line);
      if (len > display.maxLineLength) {
        display.maxLine = line;
        display.maxLineLength = len;
        display.maxLineChanged = true;
        recomputeMaxLength = false;
      }
    });
    if (recomputeMaxLength) { cm.curOp.updateMaxLine = true; }
  }

  retreatFrontier(doc, from.line);
  startWorker(cm, 400);

  var lendiff = change.text.length - (to.line - from.line) - 1;
  // Remember that these lines changed, for updating the display
  if (change.full)
    { regChange(cm); }
  else if (from.line == to.line && change.text.length == 1 && !isWholeLineUpdate(cm.doc, change))
    { regLineChange(cm, from.line, "text"); }
  else
    { regChange(cm, from.line, to.line + 1, lendiff); }

  var changesHandler = hasHandler(cm, "changes"), changeHandler = hasHandler(cm, "change");
  if (changeHandler || changesHandler) {
    var obj = {
      from: from, to: to,
      text: change.text,
      removed: change.removed,
      origin: change.origin
    };
    if (changeHandler) { signalLater(cm, "change", cm, obj); }
    if (changesHandler) { (cm.curOp.changeObjs || (cm.curOp.changeObjs = [])).push(obj); }
  }
  cm.display.selForContextMenu = null;
}

function replaceRange(doc, code, from, to, origin) {
  if (!to) { to = from; }
  if (cmp(to, from) < 0) { var assign;
    (assign = [to, from], from = assign[0], to = assign[1], assign); }
  if (typeof code == "string") { code = doc.splitLines(code); }
  makeChange(doc, {from: from, to: to, text: code, origin: origin});
}

// Rebasing/resetting history to deal with externally-sourced changes

function rebaseHistSelSingle(pos, from, to, diff) {
  if (to < pos.line) {
    pos.line += diff;
  } else if (from < pos.line) {
    pos.line = from;
    pos.ch = 0;
  }
}

// Tries to rebase an array of history events given a change in the
// document. If the change touches the same lines as the event, the
// event, and everything 'behind' it, is discarded. If the change is
// before the event, the event's positions are updated. Uses a
// copy-on-write scheme for the positions, to avoid having to
// reallocate them all on every rebase, but also avoid problems with
// shared position objects being unsafely updated.
function rebaseHistArray(array, from, to, diff) {
  for (var i = 0; i < array.length; ++i) {
    var sub = array[i], ok = true;
    if (sub.ranges) {
      if (!sub.copied) { sub = array[i] = sub.deepCopy(); sub.copied = true; }
      for (var j = 0; j < sub.ranges.length; j++) {
        rebaseHistSelSingle(sub.ranges[j].anchor, from, to, diff);
        rebaseHistSelSingle(sub.ranges[j].head, from, to, diff);
      }
      continue
    }
    for (var j$1 = 0; j$1 < sub.changes.length; ++j$1) {
      var cur = sub.changes[j$1];
      if (to < cur.from.line) {
        cur.from = Pos(cur.from.line + diff, cur.from.ch);
        cur.to = Pos(cur.to.line + diff, cur.to.ch);
      } else if (from <= cur.to.line) {
        ok = false;
        break
      }
    }
    if (!ok) {
      array.splice(0, i + 1);
      i = 0;
    }
  }
}

function rebaseHist(hist, change) {
  var from = change.from.line, to = change.to.line, diff = change.text.length - (to - from) - 1;
  rebaseHistArray(hist.done, from, to, diff);
  rebaseHistArray(hist.undone, from, to, diff);
}

// Utility for applying a change to a line by handle or number,
// returning the number and optionally registering the line as
// changed.
function changeLine(doc, handle, changeType, op) {
  var no = handle, line = handle;
  if (typeof handle == "number") { line = getLine(doc, clipLine(doc, handle)); }
  else { no = lineNo(handle); }
  if (no == null) { return null }
  if (op(line, no) && doc.cm) { regLineChange(doc.cm, no, changeType); }
  return line
}

// The document is represented as a BTree consisting of leaves, with
// chunk of lines in them, and branches, with up to ten leaves or
// other branch nodes below them. The top node is always a branch
// node, and is the document object itself (meaning it has
// additional methods and properties).
//
// All nodes have parent links. The tree is used both to go from
// line numbers to line objects, and to go from objects to numbers.
// It also indexes by height, and is used to convert between height
// and line object, and to find the total height of the document.
//
// See also http://marijnhaverbeke.nl/blog/codemirror-line-tree.html

function LeafChunk(lines) {
  var this$1 = this;

  this.lines = lines;
  this.parent = null;
  var height = 0;
  for (var i = 0; i < lines.length; ++i) {
    lines[i].parent = this$1;
    height += lines[i].height;
  }
  this.height = height;
}

LeafChunk.prototype = {
  chunkSize: function chunkSize() { return this.lines.length },

  // Remove the n lines at offset 'at'.
  removeInner: function removeInner(at, n) {
    var this$1 = this;

    for (var i = at, e = at + n; i < e; ++i) {
      var line = this$1.lines[i];
      this$1.height -= line.height;
      cleanUpLine(line);
      signalLater(line, "delete");
    }
    this.lines.splice(at, n);
  },

  // Helper used to collapse a small branch into a single leaf.
  collapse: function collapse(lines) {
    lines.push.apply(lines, this.lines);
  },

  // Insert the given array of lines at offset 'at', count them as
  // having the given height.
  insertInner: function insertInner(at, lines, height) {
    var this$1 = this;

    this.height += height;
    this.lines = this.lines.slice(0, at).concat(lines).concat(this.lines.slice(at));
    for (var i = 0; i < lines.length; ++i) { lines[i].parent = this$1; }
  },

  // Used to iterate over a part of the tree.
  iterN: function iterN(at, n, op) {
    var this$1 = this;

    for (var e = at + n; at < e; ++at)
      { if (op(this$1.lines[at])) { return true } }
  }
};

function BranchChunk(children) {
  var this$1 = this;

  this.children = children;
  var size = 0, height = 0;
  for (var i = 0; i < children.length; ++i) {
    var ch = children[i];
    size += ch.chunkSize(); height += ch.height;
    ch.parent = this$1;
  }
  this.size = size;
  this.height = height;
  this.parent = null;
}

BranchChunk.prototype = {
  chunkSize: function chunkSize() { return this.size },

  removeInner: function removeInner(at, n) {
    var this$1 = this;

    this.size -= n;
    for (var i = 0; i < this.children.length; ++i) {
      var child = this$1.children[i], sz = child.chunkSize();
      if (at < sz) {
        var rm = Math.min(n, sz - at), oldHeight = child.height;
        child.removeInner(at, rm);
        this$1.height -= oldHeight - child.height;
        if (sz == rm) { this$1.children.splice(i--, 1); child.parent = null; }
        if ((n -= rm) == 0) { break }
        at = 0;
      } else { at -= sz; }
    }
    // If the result is smaller than 25 lines, ensure that it is a
    // single leaf node.
    if (this.size - n < 25 &&
        (this.children.length > 1 || !(this.children[0] instanceof LeafChunk))) {
      var lines = [];
      this.collapse(lines);
      this.children = [new LeafChunk(lines)];
      this.children[0].parent = this;
    }
  },

  collapse: function collapse(lines) {
    var this$1 = this;

    for (var i = 0; i < this.children.length; ++i) { this$1.children[i].collapse(lines); }
  },

  insertInner: function insertInner(at, lines, height) {
    var this$1 = this;

    this.size += lines.length;
    this.height += height;
    for (var i = 0; i < this.children.length; ++i) {
      var child = this$1.children[i], sz = child.chunkSize();
      if (at <= sz) {
        child.insertInner(at, lines, height);
        if (child.lines && child.lines.length > 50) {
          // To avoid memory thrashing when child.lines is huge (e.g. first view of a large file), it's never spliced.
          // Instead, small slices are taken. They're taken in order because sequential memory accesses are fastest.
          var remaining = child.lines.length % 25 + 25;
          for (var pos = remaining; pos < child.lines.length;) {
            var leaf = new LeafChunk(child.lines.slice(pos, pos += 25));
            child.height -= leaf.height;
            this$1.children.splice(++i, 0, leaf);
            leaf.parent = this$1;
          }
          child.lines = child.lines.slice(0, remaining);
          this$1.maybeSpill();
        }
        break
      }
      at -= sz;
    }
  },

  // When a node has grown, check whether it should be split.
  maybeSpill: function maybeSpill() {
    if (this.children.length <= 10) { return }
    var me = this;
    do {
      var spilled = me.children.splice(me.children.length - 5, 5);
      var sibling = new BranchChunk(spilled);
      if (!me.parent) { // Become the parent node
        var copy = new BranchChunk(me.children);
        copy.parent = me;
        me.children = [copy, sibling];
        me = copy;
     } else {
        me.size -= sibling.size;
        me.height -= sibling.height;
        var myIndex = indexOf(me.parent.children, me);
        me.parent.children.splice(myIndex + 1, 0, sibling);
      }
      sibling.parent = me.parent;
    } while (me.children.length > 10)
    me.parent.maybeSpill();
  },

  iterN: function iterN(at, n, op) {
    var this$1 = this;

    for (var i = 0; i < this.children.length; ++i) {
      var child = this$1.children[i], sz = child.chunkSize();
      if (at < sz) {
        var used = Math.min(n, sz - at);
        if (child.iterN(at, used, op)) { return true }
        if ((n -= used) == 0) { break }
        at = 0;
      } else { at -= sz; }
    }
  }
};

// Line widgets are block elements displayed above or below a line.

var LineWidget = function(doc, node, options) {
  var this$1 = this;

  if (options) { for (var opt in options) { if (options.hasOwnProperty(opt))
    { this$1[opt] = options[opt]; } } }
  this.doc = doc;
  this.node = node;
};

LineWidget.prototype.clear = function () {
    var this$1 = this;

  var cm = this.doc.cm, ws = this.line.widgets, line = this.line, no = lineNo(line);
  if (no == null || !ws) { return }
  for (var i = 0; i < ws.length; ++i) { if (ws[i] == this$1) { ws.splice(i--, 1); } }
  if (!ws.length) { line.widgets = null; }
  var height = widgetHeight(this);
  updateLineHeight(line, Math.max(0, line.height - height));
  if (cm) {
    runInOp(cm, function () {
      adjustScrollWhenAboveVisible(cm, line, -height);
      regLineChange(cm, no, "widget");
    });
    signalLater(cm, "lineWidgetCleared", cm, this, no);
  }
};

LineWidget.prototype.changed = function () {
    var this$1 = this;

  var oldH = this.height, cm = this.doc.cm, line = this.line;
  this.height = null;
  var diff = widgetHeight(this) - oldH;
  if (!diff) { return }
  updateLineHeight(line, line.height + diff);
  if (cm) {
    runInOp(cm, function () {
      cm.curOp.forceUpdate = true;
      adjustScrollWhenAboveVisible(cm, line, diff);
      signalLater(cm, "lineWidgetChanged", cm, this$1, lineNo(line));
    });
  }
};
eventMixin(LineWidget);

function adjustScrollWhenAboveVisible(cm, line, diff) {
  if (heightAtLine(line) < ((cm.curOp && cm.curOp.scrollTop) || cm.doc.scrollTop))
    { addToScrollTop(cm, diff); }
}

function addLineWidget(doc, handle, node, options) {
  var widget = new LineWidget(doc, node, options);
  var cm = doc.cm;
  if (cm && widget.noHScroll) { cm.display.alignWidgets = true; }
  changeLine(doc, handle, "widget", function (line) {
    var widgets = line.widgets || (line.widgets = []);
    if (widget.insertAt == null) { widgets.push(widget); }
    else { widgets.splice(Math.min(widgets.length - 1, Math.max(0, widget.insertAt)), 0, widget); }
    widget.line = line;
    if (cm && !lineIsHidden(doc, line)) {
      var aboveVisible = heightAtLine(line) < doc.scrollTop;
      updateLineHeight(line, line.height + widgetHeight(widget));
      if (aboveVisible) { addToScrollTop(cm, widget.height); }
      cm.curOp.forceUpdate = true;
    }
    return true
  });
  if (cm) { signalLater(cm, "lineWidgetAdded", cm, widget, typeof handle == "number" ? handle : lineNo(handle)); }
  return widget
}

// TEXTMARKERS

// Created with markText and setBookmark methods. A TextMarker is a
// handle that can be used to clear or find a marked position in the
// document. Line objects hold arrays (markedSpans) containing
// {from, to, marker} object pointing to such marker objects, and
// indicating that such a marker is present on that line. Multiple
// lines may point to the same marker when it spans across lines.
// The spans will have null for their from/to properties when the
// marker continues beyond the start/end of the line. Markers have
// links back to the lines they currently touch.

// Collapsed markers have unique ids, in order to be able to order
// them, which is needed for uniquely determining an outer marker
// when they overlap (they may nest, but not partially overlap).
var nextMarkerId = 0;

var TextMarker = function(doc, type) {
  this.lines = [];
  this.type = type;
  this.doc = doc;
  this.id = ++nextMarkerId;
};

// Clear the marker.
TextMarker.prototype.clear = function () {
    var this$1 = this;

  if (this.explicitlyCleared) { return }
  var cm = this.doc.cm, withOp = cm && !cm.curOp;
  if (withOp) { startOperation(cm); }
  if (hasHandler(this, "clear")) {
    var found = this.find();
    if (found) { signalLater(this, "clear", found.from, found.to); }
  }
  var min = null, max = null;
  for (var i = 0; i < this.lines.length; ++i) {
    var line = this$1.lines[i];
    var span = getMarkedSpanFor(line.markedSpans, this$1);
    if (cm && !this$1.collapsed) { regLineChange(cm, lineNo(line), "text"); }
    else if (cm) {
      if (span.to != null) { max = lineNo(line); }
      if (span.from != null) { min = lineNo(line); }
    }
    line.markedSpans = removeMarkedSpan(line.markedSpans, span);
    if (span.from == null && this$1.collapsed && !lineIsHidden(this$1.doc, line) && cm)
      { updateLineHeight(line, textHeight(cm.display)); }
  }
  if (cm && this.collapsed && !cm.options.lineWrapping) { for (var i$1 = 0; i$1 < this.lines.length; ++i$1) {
    var visual = visualLine(this$1.lines[i$1]), len = lineLength(visual);
    if (len > cm.display.maxLineLength) {
      cm.display.maxLine = visual;
      cm.display.maxLineLength = len;
      cm.display.maxLineChanged = true;
    }
  } }

  if (min != null && cm && this.collapsed) { regChange(cm, min, max + 1); }
  this.lines.length = 0;
  this.explicitlyCleared = true;
  if (this.atomic && this.doc.cantEdit) {
    this.doc.cantEdit = false;
    if (cm) { reCheckSelection(cm.doc); }
  }
  if (cm) { signalLater(cm, "markerCleared", cm, this, min, max); }
  if (withOp) { endOperation(cm); }
  if (this.parent) { this.parent.clear(); }
};

// Find the position of the marker in the document. Returns a {from,
// to} object by default. Side can be passed to get a specific side
// -- 0 (both), -1 (left), or 1 (right). When lineObj is true, the
// Pos objects returned contain a line object, rather than a line
// number (used to prevent looking up the same line twice).
TextMarker.prototype.find = function (side, lineObj) {
    var this$1 = this;

  if (side == null && this.type == "bookmark") { side = 1; }
  var from, to;
  for (var i = 0; i < this.lines.length; ++i) {
    var line = this$1.lines[i];
    var span = getMarkedSpanFor(line.markedSpans, this$1);
    if (span.from != null) {
      from = Pos(lineObj ? line : lineNo(line), span.from);
      if (side == -1) { return from }
    }
    if (span.to != null) {
      to = Pos(lineObj ? line : lineNo(line), span.to);
      if (side == 1) { return to }
    }
  }
  return from && {from: from, to: to}
};

// Signals that the marker's widget changed, and surrounding layout
// should be recomputed.
TextMarker.prototype.changed = function () {
    var this$1 = this;

  var pos = this.find(-1, true), widget = this, cm = this.doc.cm;
  if (!pos || !cm) { return }
  runInOp(cm, function () {
    var line = pos.line, lineN = lineNo(pos.line);
    var view = findViewForLine(cm, lineN);
    if (view) {
      clearLineMeasurementCacheFor(view);
      cm.curOp.selectionChanged = cm.curOp.forceUpdate = true;
    }
    cm.curOp.updateMaxLine = true;
    if (!lineIsHidden(widget.doc, line) && widget.height != null) {
      var oldHeight = widget.height;
      widget.height = null;
      var dHeight = widgetHeight(widget) - oldHeight;
      if (dHeight)
        { updateLineHeight(line, line.height + dHeight); }
    }
    signalLater(cm, "markerChanged", cm, this$1);
  });
};

TextMarker.prototype.attachLine = function (line) {
  if (!this.lines.length && this.doc.cm) {
    var op = this.doc.cm.curOp;
    if (!op.maybeHiddenMarkers || indexOf(op.maybeHiddenMarkers, this) == -1)
      { (op.maybeUnhiddenMarkers || (op.maybeUnhiddenMarkers = [])).push(this); }
  }
  this.lines.push(line);
};

TextMarker.prototype.detachLine = function (line) {
  this.lines.splice(indexOf(this.lines, line), 1);
  if (!this.lines.length && this.doc.cm) {
    var op = this.doc.cm.curOp;(op.maybeHiddenMarkers || (op.maybeHiddenMarkers = [])).push(this);
  }
};
eventMixin(TextMarker);

// Create a marker, wire it up to the right lines, and
function markText(doc, from, to, options, type) {
  // Shared markers (across linked documents) are handled separately
  // (markTextShared will call out to this again, once per
  // document).
  if (options && options.shared) { return markTextShared(doc, from, to, options, type) }
  // Ensure we are in an operation.
  if (doc.cm && !doc.cm.curOp) { return operation(doc.cm, markText)(doc, from, to, options, type) }

  var marker = new TextMarker(doc, type), diff = cmp(from, to);
  if (options) { copyObj(options, marker, false); }
  // Don't connect empty markers unless clearWhenEmpty is false
  if (diff > 0 || diff == 0 && marker.clearWhenEmpty !== false)
    { return marker }
  if (marker.replacedWith) {
    // Showing up as a widget implies collapsed (widget replaces text)
    marker.collapsed = true;
    marker.widgetNode = eltP("span", [marker.replacedWith], "CodeMirror-widget");
    if (!options.handleMouseEvents) { marker.widgetNode.setAttribute("cm-ignore-events", "true"); }
    if (options.insertLeft) { marker.widgetNode.insertLeft = true; }
  }
  if (marker.collapsed) {
    if (conflictingCollapsedRange(doc, from.line, from, to, marker) ||
        from.line != to.line && conflictingCollapsedRange(doc, to.line, from, to, marker))
      { throw new Error("Inserting collapsed marker partially overlapping an existing one") }
    seeCollapsedSpans();
  }

  if (marker.addToHistory)
    { addChangeToHistory(doc, {from: from, to: to, origin: "markText"}, doc.sel, NaN); }

  var curLine = from.line, cm = doc.cm, updateMaxLine;
  doc.iter(curLine, to.line + 1, function (line) {
    if (cm && marker.collapsed && !cm.options.lineWrapping && visualLine(line) == cm.display.maxLine)
      { updateMaxLine = true; }
    if (marker.collapsed && curLine != from.line) { updateLineHeight(line, 0); }
    addMarkedSpan(line, new MarkedSpan(marker,
                                       curLine == from.line ? from.ch : null,
                                       curLine == to.line ? to.ch : null));
    ++curLine;
  });
  // lineIsHidden depends on the presence of the spans, so needs a second pass
  if (marker.collapsed) { doc.iter(from.line, to.line + 1, function (line) {
    if (lineIsHidden(doc, line)) { updateLineHeight(line, 0); }
  }); }

  if (marker.clearOnEnter) { on(marker, "beforeCursorEnter", function () { return marker.clear(); }); }

  if (marker.readOnly) {
    seeReadOnlySpans();
    if (doc.history.done.length || doc.history.undone.length)
      { doc.clearHistory(); }
  }
  if (marker.collapsed) {
    marker.id = ++nextMarkerId;
    marker.atomic = true;
  }
  if (cm) {
    // Sync editor state
    if (updateMaxLine) { cm.curOp.updateMaxLine = true; }
    if (marker.collapsed)
      { regChange(cm, from.line, to.line + 1); }
    else if (marker.className || marker.title || marker.startStyle || marker.endStyle || marker.css)
      { for (var i = from.line; i <= to.line; i++) { regLineChange(cm, i, "text"); } }
    if (marker.atomic) { reCheckSelection(cm.doc); }
    signalLater(cm, "markerAdded", cm, marker);
  }
  return marker
}

// SHARED TEXTMARKERS

// A shared marker spans multiple linked documents. It is
// implemented as a meta-marker-object controlling multiple normal
// markers.
var SharedTextMarker = function(markers, primary) {
  var this$1 = this;

  this.markers = markers;
  this.primary = primary;
  for (var i = 0; i < markers.length; ++i)
    { markers[i].parent = this$1; }
};

SharedTextMarker.prototype.clear = function () {
    var this$1 = this;

  if (this.explicitlyCleared) { return }
  this.explicitlyCleared = true;
  for (var i = 0; i < this.markers.length; ++i)
    { this$1.markers[i].clear(); }
  signalLater(this, "clear");
};

SharedTextMarker.prototype.find = function (side, lineObj) {
  return this.primary.find(side, lineObj)
};
eventMixin(SharedTextMarker);

function markTextShared(doc, from, to, options, type) {
  options = copyObj(options);
  options.shared = false;
  var markers = [markText(doc, from, to, options, type)], primary = markers[0];
  var widget = options.widgetNode;
  linkedDocs(doc, function (doc) {
    if (widget) { options.widgetNode = widget.cloneNode(true); }
    markers.push(markText(doc, clipPos(doc, from), clipPos(doc, to), options, type));
    for (var i = 0; i < doc.linked.length; ++i)
      { if (doc.linked[i].isParent) { return } }
    primary = lst(markers);
  });
  return new SharedTextMarker(markers, primary)
}

function findSharedMarkers(doc) {
  return doc.findMarks(Pos(doc.first, 0), doc.clipPos(Pos(doc.lastLine())), function (m) { return m.parent; })
}

function copySharedMarkers(doc, markers) {
  for (var i = 0; i < markers.length; i++) {
    var marker = markers[i], pos = marker.find();
    var mFrom = doc.clipPos(pos.from), mTo = doc.clipPos(pos.to);
    if (cmp(mFrom, mTo)) {
      var subMark = markText(doc, mFrom, mTo, marker.primary, marker.primary.type);
      marker.markers.push(subMark);
      subMark.parent = marker;
    }
  }
}

function detachSharedMarkers(markers) {
  var loop = function ( i ) {
    var marker = markers[i], linked = [marker.primary.doc];
    linkedDocs(marker.primary.doc, function (d) { return linked.push(d); });
    for (var j = 0; j < marker.markers.length; j++) {
      var subMarker = marker.markers[j];
      if (indexOf(linked, subMarker.doc) == -1) {
        subMarker.parent = null;
        marker.markers.splice(j--, 1);
      }
    }
  };

  for (var i = 0; i < markers.length; i++) loop( i );
}

var nextDocId = 0;
var Doc = function(text, mode, firstLine, lineSep, direction) {
  if (!(this instanceof Doc)) { return new Doc(text, mode, firstLine, lineSep, direction) }
  if (firstLine == null) { firstLine = 0; }

  BranchChunk.call(this, [new LeafChunk([new Line("", null)])]);
  this.first = firstLine;
  this.scrollTop = this.scrollLeft = 0;
  this.cantEdit = false;
  this.cleanGeneration = 1;
  this.modeFrontier = this.highlightFrontier = firstLine;
  var start = Pos(firstLine, 0);
  this.sel = simpleSelection(start);
  this.history = new History(null);
  this.id = ++nextDocId;
  this.modeOption = mode;
  this.lineSep = lineSep;
  this.direction = (direction == "rtl") ? "rtl" : "ltr";
  this.extend = false;

  if (typeof text == "string") { text = this.splitLines(text); }
  updateDoc(this, {from: start, to: start, text: text});
  setSelection(this, simpleSelection(start), sel_dontScroll);
};

Doc.prototype = createObj(BranchChunk.prototype, {
  constructor: Doc,
  // Iterate over the document. Supports two forms -- with only one
  // argument, it calls that for each line in the document. With
  // three, it iterates over the range given by the first two (with
  // the second being non-inclusive).
  iter: function(from, to, op) {
    if (op) { this.iterN(from - this.first, to - from, op); }
    else { this.iterN(this.first, this.first + this.size, from); }
  },

  // Non-public interface for adding and removing lines.
  insert: function(at, lines) {
    var height = 0;
    for (var i = 0; i < lines.length; ++i) { height += lines[i].height; }
    this.insertInner(at - this.first, lines, height);
  },
  remove: function(at, n) { this.removeInner(at - this.first, n); },

  // From here, the methods are part of the public interface. Most
  // are also available from CodeMirror (editor) instances.

  getValue: function(lineSep) {
    var lines = getLines(this, this.first, this.first + this.size);
    if (lineSep === false) { return lines }
    return lines.join(lineSep || this.lineSeparator())
  },
  setValue: docMethodOp(function(code) {
    var top = Pos(this.first, 0), last = this.first + this.size - 1;
    makeChange(this, {from: top, to: Pos(last, getLine(this, last).text.length),
                      text: this.splitLines(code), origin: "setValue", full: true}, true);
    if (this.cm) { scrollToCoords(this.cm, 0, 0); }
    setSelection(this, simpleSelection(top), sel_dontScroll);
  }),
  replaceRange: function(code, from, to, origin) {
    from = clipPos(this, from);
    to = to ? clipPos(this, to) : from;
    replaceRange(this, code, from, to, origin);
  },
  getRange: function(from, to, lineSep) {
    var lines = getBetween(this, clipPos(this, from), clipPos(this, to));
    if (lineSep === false) { return lines }
    return lines.join(lineSep || this.lineSeparator())
  },

  getLine: function(line) {var l = this.getLineHandle(line); return l && l.text},

  getLineHandle: function(line) {if (isLine(this, line)) { return getLine(this, line) }},
  getLineNumber: function(line) {return lineNo(line)},

  getLineHandleVisualStart: function(line) {
    if (typeof line == "number") { line = getLine(this, line); }
    return visualLine(line)
  },

  lineCount: function() {return this.size},
  firstLine: function() {return this.first},
  lastLine: function() {return this.first + this.size - 1},

  clipPos: function(pos) {return clipPos(this, pos)},

  getCursor: function(start) {
    var range$$1 = this.sel.primary(), pos;
    if (start == null || start == "head") { pos = range$$1.head; }
    else if (start == "anchor") { pos = range$$1.anchor; }
    else if (start == "end" || start == "to" || start === false) { pos = range$$1.to(); }
    else { pos = range$$1.from(); }
    return pos
  },
  listSelections: function() { return this.sel.ranges },
  somethingSelected: function() {return this.sel.somethingSelected()},

  setCursor: docMethodOp(function(line, ch, options) {
    setSimpleSelection(this, clipPos(this, typeof line == "number" ? Pos(line, ch || 0) : line), null, options);
  }),
  setSelection: docMethodOp(function(anchor, head, options) {
    setSimpleSelection(this, clipPos(this, anchor), clipPos(this, head || anchor), options);
  }),
  extendSelection: docMethodOp(function(head, other, options) {
    extendSelection(this, clipPos(this, head), other && clipPos(this, other), options);
  }),
  extendSelections: docMethodOp(function(heads, options) {
    extendSelections(this, clipPosArray(this, heads), options);
  }),
  extendSelectionsBy: docMethodOp(function(f, options) {
    var heads = map(this.sel.ranges, f);
    extendSelections(this, clipPosArray(this, heads), options);
  }),
  setSelections: docMethodOp(function(ranges, primary, options) {
    var this$1 = this;

    if (!ranges.length) { return }
    var out = [];
    for (var i = 0; i < ranges.length; i++)
      { out[i] = new Range(clipPos(this$1, ranges[i].anchor),
                         clipPos(this$1, ranges[i].head)); }
    if (primary == null) { primary = Math.min(ranges.length - 1, this.sel.primIndex); }
    setSelection(this, normalizeSelection(out, primary), options);
  }),
  addSelection: docMethodOp(function(anchor, head, options) {
    var ranges = this.sel.ranges.slice(0);
    ranges.push(new Range(clipPos(this, anchor), clipPos(this, head || anchor)));
    setSelection(this, normalizeSelection(ranges, ranges.length - 1), options);
  }),

  getSelection: function(lineSep) {
    var this$1 = this;

    var ranges = this.sel.ranges, lines;
    for (var i = 0; i < ranges.length; i++) {
      var sel = getBetween(this$1, ranges[i].from(), ranges[i].to());
      lines = lines ? lines.concat(sel) : sel;
    }
    if (lineSep === false) { return lines }
    else { return lines.join(lineSep || this.lineSeparator()) }
  },
  getSelections: function(lineSep) {
    var this$1 = this;

    var parts = [], ranges = this.sel.ranges;
    for (var i = 0; i < ranges.length; i++) {
      var sel = getBetween(this$1, ranges[i].from(), ranges[i].to());
      if (lineSep !== false) { sel = sel.join(lineSep || this$1.lineSeparator()); }
      parts[i] = sel;
    }
    return parts
  },
  replaceSelection: function(code, collapse, origin) {
    var dup = [];
    for (var i = 0; i < this.sel.ranges.length; i++)
      { dup[i] = code; }
    this.replaceSelections(dup, collapse, origin || "+input");
  },
  replaceSelections: docMethodOp(function(code, collapse, origin) {
    var this$1 = this;

    var changes = [], sel = this.sel;
    for (var i = 0; i < sel.ranges.length; i++) {
      var range$$1 = sel.ranges[i];
      changes[i] = {from: range$$1.from(), to: range$$1.to(), text: this$1.splitLines(code[i]), origin: origin};
    }
    var newSel = collapse && collapse != "end" && computeReplacedSel(this, changes, collapse);
    for (var i$1 = changes.length - 1; i$1 >= 0; i$1--)
      { makeChange(this$1, changes[i$1]); }
    if (newSel) { setSelectionReplaceHistory(this, newSel); }
    else if (this.cm) { ensureCursorVisible(this.cm); }
  }),
  undo: docMethodOp(function() {makeChangeFromHistory(this, "undo");}),
  redo: docMethodOp(function() {makeChangeFromHistory(this, "redo");}),
  undoSelection: docMethodOp(function() {makeChangeFromHistory(this, "undo", true);}),
  redoSelection: docMethodOp(function() {makeChangeFromHistory(this, "redo", true);}),

  setExtending: function(val) {this.extend = val;},
  getExtending: function() {return this.extend},

  historySize: function() {
    var hist = this.history, done = 0, undone = 0;
    for (var i = 0; i < hist.done.length; i++) { if (!hist.done[i].ranges) { ++done; } }
    for (var i$1 = 0; i$1 < hist.undone.length; i$1++) { if (!hist.undone[i$1].ranges) { ++undone; } }
    return {undo: done, redo: undone}
  },
  clearHistory: function() {this.history = new History(this.history.maxGeneration);},

  markClean: function() {
    this.cleanGeneration = this.changeGeneration(true);
  },
  changeGeneration: function(forceSplit) {
    if (forceSplit)
      { this.history.lastOp = this.history.lastSelOp = this.history.lastOrigin = null; }
    return this.history.generation
  },
  isClean: function (gen) {
    return this.history.generation == (gen || this.cleanGeneration)
  },

  getHistory: function() {
    return {done: copyHistoryArray(this.history.done),
            undone: copyHistoryArray(this.history.undone)}
  },
  setHistory: function(histData) {
    var hist = this.history = new History(this.history.maxGeneration);
    hist.done = copyHistoryArray(histData.done.slice(0), null, true);
    hist.undone = copyHistoryArray(histData.undone.slice(0), null, true);
  },

  setGutterMarker: docMethodOp(function(line, gutterID, value) {
    return changeLine(this, line, "gutter", function (line) {
      var markers = line.gutterMarkers || (line.gutterMarkers = {});
      markers[gutterID] = value;
      if (!value && isEmpty(markers)) { line.gutterMarkers = null; }
      return true
    })
  }),

  clearGutter: docMethodOp(function(gutterID) {
    var this$1 = this;

    this.iter(function (line) {
      if (line.gutterMarkers && line.gutterMarkers[gutterID]) {
        changeLine(this$1, line, "gutter", function () {
          line.gutterMarkers[gutterID] = null;
          if (isEmpty(line.gutterMarkers)) { line.gutterMarkers = null; }
          return true
        });
      }
    });
  }),

  lineInfo: function(line) {
    var n;
    if (typeof line == "number") {
      if (!isLine(this, line)) { return null }
      n = line;
      line = getLine(this, line);
      if (!line) { return null }
    } else {
      n = lineNo(line);
      if (n == null) { return null }
    }
    return {line: n, handle: line, text: line.text, gutterMarkers: line.gutterMarkers,
            textClass: line.textClass, bgClass: line.bgClass, wrapClass: line.wrapClass,
            widgets: line.widgets}
  },

  addLineClass: docMethodOp(function(handle, where, cls) {
    return changeLine(this, handle, where == "gutter" ? "gutter" : "class", function (line) {
      var prop = where == "text" ? "textClass"
               : where == "background" ? "bgClass"
               : where == "gutter" ? "gutterClass" : "wrapClass";
      if (!line[prop]) { line[prop] = cls; }
      else if (classTest(cls).test(line[prop])) { return false }
      else { line[prop] += " " + cls; }
      return true
    })
  }),
  removeLineClass: docMethodOp(function(handle, where, cls) {
    return changeLine(this, handle, where == "gutter" ? "gutter" : "class", function (line) {
      var prop = where == "text" ? "textClass"
               : where == "background" ? "bgClass"
               : where == "gutter" ? "gutterClass" : "wrapClass";
      var cur = line[prop];
      if (!cur) { return false }
      else if (cls == null) { line[prop] = null; }
      else {
        var found = cur.match(classTest(cls));
        if (!found) { return false }
        var end = found.index + found[0].length;
        line[prop] = cur.slice(0, found.index) + (!found.index || end == cur.length ? "" : " ") + cur.slice(end) || null;
      }
      return true
    })
  }),

  addLineWidget: docMethodOp(function(handle, node, options) {
    return addLineWidget(this, handle, node, options)
  }),
  removeLineWidget: function(widget) { widget.clear(); },

  markText: function(from, to, options) {
    return markText(this, clipPos(this, from), clipPos(this, to), options, options && options.type || "range")
  },
  setBookmark: function(pos, options) {
    var realOpts = {replacedWith: options && (options.nodeType == null ? options.widget : options),
                    insertLeft: options && options.insertLeft,
                    clearWhenEmpty: false, shared: options && options.shared,
                    handleMouseEvents: options && options.handleMouseEvents};
    pos = clipPos(this, pos);
    return markText(this, pos, pos, realOpts, "bookmark")
  },
  findMarksAt: function(pos) {
    pos = clipPos(this, pos);
    var markers = [], spans = getLine(this, pos.line).markedSpans;
    if (spans) { for (var i = 0; i < spans.length; ++i) {
      var span = spans[i];
      if ((span.from == null || span.from <= pos.ch) &&
          (span.to == null || span.to >= pos.ch))
        { markers.push(span.marker.parent || span.marker); }
    } }
    return markers
  },
  findMarks: function(from, to, filter) {
    from = clipPos(this, from); to = clipPos(this, to);
    var found = [], lineNo$$1 = from.line;
    this.iter(from.line, to.line + 1, function (line) {
      var spans = line.markedSpans;
      if (spans) { for (var i = 0; i < spans.length; i++) {
        var span = spans[i];
        if (!(span.to != null && lineNo$$1 == from.line && from.ch >= span.to ||
              span.from == null && lineNo$$1 != from.line ||
              span.from != null && lineNo$$1 == to.line && span.from >= to.ch) &&
            (!filter || filter(span.marker)))
          { found.push(span.marker.parent || span.marker); }
      } }
      ++lineNo$$1;
    });
    return found
  },
  getAllMarks: function() {
    var markers = [];
    this.iter(function (line) {
      var sps = line.markedSpans;
      if (sps) { for (var i = 0; i < sps.length; ++i)
        { if (sps[i].from != null) { markers.push(sps[i].marker); } } }
    });
    return markers
  },

  posFromIndex: function(off) {
    var ch, lineNo$$1 = this.first, sepSize = this.lineSeparator().length;
    this.iter(function (line) {
      var sz = line.text.length + sepSize;
      if (sz > off) { ch = off; return true }
      off -= sz;
      ++lineNo$$1;
    });
    return clipPos(this, Pos(lineNo$$1, ch))
  },
  indexFromPos: function (coords) {
    coords = clipPos(this, coords);
    var index = coords.ch;
    if (coords.line < this.first || coords.ch < 0) { return 0 }
    var sepSize = this.lineSeparator().length;
    this.iter(this.first, coords.line, function (line) { // iter aborts when callback returns a truthy value
      index += line.text.length + sepSize;
    });
    return index
  },

  copy: function(copyHistory) {
    var doc = new Doc(getLines(this, this.first, this.first + this.size),
                      this.modeOption, this.first, this.lineSep, this.direction);
    doc.scrollTop = this.scrollTop; doc.scrollLeft = this.scrollLeft;
    doc.sel = this.sel;
    doc.extend = false;
    if (copyHistory) {
      doc.history.undoDepth = this.history.undoDepth;
      doc.setHistory(this.getHistory());
    }
    return doc
  },

  linkedDoc: function(options) {
    if (!options) { options = {}; }
    var from = this.first, to = this.first + this.size;
    if (options.from != null && options.from > from) { from = options.from; }
    if (options.to != null && options.to < to) { to = options.to; }
    var copy = new Doc(getLines(this, from, to), options.mode || this.modeOption, from, this.lineSep, this.direction);
    if (options.sharedHist) { copy.history = this.history
    ; }(this.linked || (this.linked = [])).push({doc: copy, sharedHist: options.sharedHist});
    copy.linked = [{doc: this, isParent: true, sharedHist: options.sharedHist}];
    copySharedMarkers(copy, findSharedMarkers(this));
    return copy
  },
  unlinkDoc: function(other) {
    var this$1 = this;

    if (other instanceof CodeMirror$1) { other = other.doc; }
    if (this.linked) { for (var i = 0; i < this.linked.length; ++i) {
      var link = this$1.linked[i];
      if (link.doc != other) { continue }
      this$1.linked.splice(i, 1);
      other.unlinkDoc(this$1);
      detachSharedMarkers(findSharedMarkers(this$1));
      break
    } }
    // If the histories were shared, split them again
    if (other.history == this.history) {
      var splitIds = [other.id];
      linkedDocs(other, function (doc) { return splitIds.push(doc.id); }, true);
      other.history = new History(null);
      other.history.done = copyHistoryArray(this.history.done, splitIds);
      other.history.undone = copyHistoryArray(this.history.undone, splitIds);
    }
  },
  iterLinkedDocs: function(f) {linkedDocs(this, f);},

  getMode: function() {return this.mode},
  getEditor: function() {return this.cm},

  splitLines: function(str) {
    if (this.lineSep) { return str.split(this.lineSep) }
    return splitLinesAuto(str)
  },
  lineSeparator: function() { return this.lineSep || "\n" },

  setDirection: docMethodOp(function (dir) {
    if (dir != "rtl") { dir = "ltr"; }
    if (dir == this.direction) { return }
    this.direction = dir;
    this.iter(function (line) { return line.order = null; });
    if (this.cm) { directionChanged(this.cm); }
  })
});

// Public alias.
Doc.prototype.eachLine = Doc.prototype.iter;

// Kludge to work around strange IE behavior where it'll sometimes
// re-fire a series of drag-related events right after the drop (#1551)
var lastDrop = 0;

function onDrop(e) {
  var cm = this;
  clearDragCursor(cm);
  if (signalDOMEvent(cm, e) || eventInWidget(cm.display, e))
    { return }
  e_preventDefault(e);
  if (ie) { lastDrop = +new Date; }
  var pos = posFromMouse(cm, e, true), files = e.dataTransfer.files;
  if (!pos || cm.isReadOnly()) { return }
  // Might be a file drop, in which case we simply extract the text
  // and insert it.
  if (files && files.length && window.FileReader && window.File) {
    var n = files.length, text = Array(n), read = 0;
    var loadFile = function (file, i) {
      if (cm.options.allowDropFileTypes &&
          indexOf(cm.options.allowDropFileTypes, file.type) == -1)
        { return }

      var reader = new FileReader;
      reader.onload = operation(cm, function () {
        var content = reader.result;
        if (/[\x00-\x08\x0e-\x1f]{2}/.test(content)) { content = ""; }
        text[i] = content;
        if (++read == n) {
          pos = clipPos(cm.doc, pos);
          var change = {from: pos, to: pos,
                        text: cm.doc.splitLines(text.join(cm.doc.lineSeparator())),
                        origin: "paste"};
          makeChange(cm.doc, change);
          setSelectionReplaceHistory(cm.doc, simpleSelection(pos, changeEnd(change)));
        }
      });
      reader.readAsText(file);
    };
    for (var i = 0; i < n; ++i) { loadFile(files[i], i); }
  } else { // Normal drop
    // Don't do a replace if the drop happened inside of the selected text.
    if (cm.state.draggingText && cm.doc.sel.contains(pos) > -1) {
      cm.state.draggingText(e);
      // Ensure the editor is re-focused
      setTimeout(function () { return cm.display.input.focus(); }, 20);
      return
    }
    try {
      var text$1 = e.dataTransfer.getData("Text");
      if (text$1) {
        var selected;
        if (cm.state.draggingText && !cm.state.draggingText.copy)
          { selected = cm.listSelections(); }
        setSelectionNoUndo(cm.doc, simpleSelection(pos, pos));
        if (selected) { for (var i$1 = 0; i$1 < selected.length; ++i$1)
          { replaceRange(cm.doc, "", selected[i$1].anchor, selected[i$1].head, "drag"); } }
        cm.replaceSelection(text$1, "around", "paste");
        cm.display.input.focus();
      }
    }
    catch(e){}
  }
}

function onDragStart(cm, e) {
  if (ie && (!cm.state.draggingText || +new Date - lastDrop < 100)) { e_stop(e); return }
  if (signalDOMEvent(cm, e) || eventInWidget(cm.display, e)) { return }

  e.dataTransfer.setData("Text", cm.getSelection());
  e.dataTransfer.effectAllowed = "copyMove";

  // Use dummy image instead of default browsers image.
  // Recent Safari (~6.0.2) have a tendency to segfault when this happens, so we don't do it there.
  if (e.dataTransfer.setDragImage && !safari) {
    var img = elt("img", null, null, "position: fixed; left: 0; top: 0;");
    img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
    if (presto) {
      img.width = img.height = 1;
      cm.display.wrapper.appendChild(img);
      // Force a relayout, or Opera won't use our image for some obscure reason
      img._top = img.offsetTop;
    }
    e.dataTransfer.setDragImage(img, 0, 0);
    if (presto) { img.parentNode.removeChild(img); }
  }
}

function onDragOver(cm, e) {
  var pos = posFromMouse(cm, e);
  if (!pos) { return }
  var frag = document.createDocumentFragment();
  drawSelectionCursor(cm, pos, frag);
  if (!cm.display.dragCursor) {
    cm.display.dragCursor = elt("div", null, "CodeMirror-cursors CodeMirror-dragcursors");
    cm.display.lineSpace.insertBefore(cm.display.dragCursor, cm.display.cursorDiv);
  }
  removeChildrenAndAdd(cm.display.dragCursor, frag);
}

function clearDragCursor(cm) {
  if (cm.display.dragCursor) {
    cm.display.lineSpace.removeChild(cm.display.dragCursor);
    cm.display.dragCursor = null;
  }
}

// These must be handled carefully, because naively registering a
// handler for each editor will cause the editors to never be
// garbage collected.

function forEachCodeMirror(f) {
  if (!document.getElementsByClassName) { return }
  var byClass = document.getElementsByClassName("CodeMirror");
  for (var i = 0; i < byClass.length; i++) {
    var cm = byClass[i].CodeMirror;
    if (cm) { f(cm); }
  }
}

var globalsRegistered = false;
function ensureGlobalHandlers() {
  if (globalsRegistered) { return }
  registerGlobalHandlers();
  globalsRegistered = true;
}
function registerGlobalHandlers() {
  // When the window resizes, we need to refresh active editors.
  var resizeTimer;
  on(window, "resize", function () {
    if (resizeTimer == null) { resizeTimer = setTimeout(function () {
      resizeTimer = null;
      forEachCodeMirror(onResize);
    }, 100); }
  });
  // When the window loses focus, we want to show the editor as blurred
  on(window, "blur", function () { return forEachCodeMirror(onBlur); });
}
// Called when the window resizes
function onResize(cm) {
  var d = cm.display;
  if (d.lastWrapHeight == d.wrapper.clientHeight && d.lastWrapWidth == d.wrapper.clientWidth)
    { return }
  // Might be a text scaling operation, clear size caches.
  d.cachedCharWidth = d.cachedTextHeight = d.cachedPaddingH = null;
  d.scrollbarsClipped = false;
  cm.setSize();
}

var keyNames = {
  3: "Pause", 8: "Backspace", 9: "Tab", 13: "Enter", 16: "Shift", 17: "Ctrl", 18: "Alt",
  19: "Pause", 20: "CapsLock", 27: "Esc", 32: "Space", 33: "PageUp", 34: "PageDown", 35: "End",
  36: "Home", 37: "Left", 38: "Up", 39: "Right", 40: "Down", 44: "PrintScrn", 45: "Insert",
  46: "Delete", 59: ";", 61: "=", 91: "Mod", 92: "Mod", 93: "Mod",
  106: "*", 107: "=", 109: "-", 110: ".", 111: "/", 127: "Delete", 145: "ScrollLock",
  173: "-", 186: ";", 187: "=", 188: ",", 189: "-", 190: ".", 191: "/", 192: "`", 219: "[", 220: "\\",
  221: "]", 222: "'", 63232: "Up", 63233: "Down", 63234: "Left", 63235: "Right", 63272: "Delete",
  63273: "Home", 63275: "End", 63276: "PageUp", 63277: "PageDown", 63302: "Insert"
};

// Number keys
for (var i = 0; i < 10; i++) { keyNames[i + 48] = keyNames[i + 96] = String(i); }
// Alphabetic keys
for (var i$1 = 65; i$1 <= 90; i$1++) { keyNames[i$1] = String.fromCharCode(i$1); }
// Function keys
for (var i$2 = 1; i$2 <= 12; i$2++) { keyNames[i$2 + 111] = keyNames[i$2 + 63235] = "F" + i$2; }

var keyMap = {};

keyMap.basic = {
  "Left": "goCharLeft", "Right": "goCharRight", "Up": "goLineUp", "Down": "goLineDown",
  "End": "goLineEnd", "Home": "goLineStartSmart", "PageUp": "goPageUp", "PageDown": "goPageDown",
  "Delete": "delCharAfter", "Backspace": "delCharBefore", "Shift-Backspace": "delCharBefore",
  "Tab": "defaultTab", "Shift-Tab": "indentAuto",
  "Enter": "newlineAndIndent", "Insert": "toggleOverwrite",
  "Esc": "singleSelection"
};
// Note that the save and find-related commands aren't defined by
// default. User code or addons can define them. Unknown commands
// are simply ignored.
keyMap.pcDefault = {
  "Ctrl-A": "selectAll", "Ctrl-D": "deleteLine", "Ctrl-Z": "undo", "Shift-Ctrl-Z": "redo", "Ctrl-Y": "redo",
  "Ctrl-Home": "goDocStart", "Ctrl-End": "goDocEnd", "Ctrl-Up": "goLineUp", "Ctrl-Down": "goLineDown",
  "Ctrl-Left": "goGroupLeft", "Ctrl-Right": "goGroupRight", "Alt-Left": "goLineStart", "Alt-Right": "goLineEnd",
  "Ctrl-Backspace": "delGroupBefore", "Ctrl-Delete": "delGroupAfter", "Ctrl-S": "save", "Ctrl-F": "find",
  "Ctrl-G": "findNext", "Shift-Ctrl-G": "findPrev", "Shift-Ctrl-F": "replace", "Shift-Ctrl-R": "replaceAll",
  "Ctrl-[": "indentLess", "Ctrl-]": "indentMore",
  "Ctrl-U": "undoSelection", "Shift-Ctrl-U": "redoSelection", "Alt-U": "redoSelection",
  fallthrough: "basic"
};
// Very basic readline/emacs-style bindings, which are standard on Mac.
keyMap.emacsy = {
  "Ctrl-F": "goCharRight", "Ctrl-B": "goCharLeft", "Ctrl-P": "goLineUp", "Ctrl-N": "goLineDown",
  "Alt-F": "goWordRight", "Alt-B": "goWordLeft", "Ctrl-A": "goLineStart", "Ctrl-E": "goLineEnd",
  "Ctrl-V": "goPageDown", "Shift-Ctrl-V": "goPageUp", "Ctrl-D": "delCharAfter", "Ctrl-H": "delCharBefore",
  "Alt-D": "delWordAfter", "Alt-Backspace": "delWordBefore", "Ctrl-K": "killLine", "Ctrl-T": "transposeChars",
  "Ctrl-O": "openLine"
};
keyMap.macDefault = {
  "Cmd-A": "selectAll", "Cmd-D": "deleteLine", "Cmd-Z": "undo", "Shift-Cmd-Z": "redo", "Cmd-Y": "redo",
  "Cmd-Home": "goDocStart", "Cmd-Up": "goDocStart", "Cmd-End": "goDocEnd", "Cmd-Down": "goDocEnd", "Alt-Left": "goGroupLeft",
  "Alt-Right": "goGroupRight", "Cmd-Left": "goLineLeft", "Cmd-Right": "goLineRight", "Alt-Backspace": "delGroupBefore",
  "Ctrl-Alt-Backspace": "delGroupAfter", "Alt-Delete": "delGroupAfter", "Cmd-S": "save", "Cmd-F": "find",
  "Cmd-G": "findNext", "Shift-Cmd-G": "findPrev", "Cmd-Alt-F": "replace", "Shift-Cmd-Alt-F": "replaceAll",
  "Cmd-[": "indentLess", "Cmd-]": "indentMore", "Cmd-Backspace": "delWrappedLineLeft", "Cmd-Delete": "delWrappedLineRight",
  "Cmd-U": "undoSelection", "Shift-Cmd-U": "redoSelection", "Ctrl-Up": "goDocStart", "Ctrl-Down": "goDocEnd",
  fallthrough: ["basic", "emacsy"]
};
keyMap["default"] = mac ? keyMap.macDefault : keyMap.pcDefault;

// KEYMAP DISPATCH

function normalizeKeyName(name) {
  var parts = name.split(/-(?!$)/);
  name = parts[parts.length - 1];
  var alt, ctrl, shift, cmd;
  for (var i = 0; i < parts.length - 1; i++) {
    var mod = parts[i];
    if (/^(cmd|meta|m)$/i.test(mod)) { cmd = true; }
    else if (/^a(lt)?$/i.test(mod)) { alt = true; }
    else if (/^(c|ctrl|control)$/i.test(mod)) { ctrl = true; }
    else if (/^s(hift)?$/i.test(mod)) { shift = true; }
    else { throw new Error("Unrecognized modifier name: " + mod) }
  }
  if (alt) { name = "Alt-" + name; }
  if (ctrl) { name = "Ctrl-" + name; }
  if (cmd) { name = "Cmd-" + name; }
  if (shift) { name = "Shift-" + name; }
  return name
}

// This is a kludge to keep keymaps mostly working as raw objects
// (backwards compatibility) while at the same time support features
// like normalization and multi-stroke key bindings. It compiles a
// new normalized keymap, and then updates the old object to reflect
// this.
function normalizeKeyMap(keymap) {
  var copy = {};
  for (var keyname in keymap) { if (keymap.hasOwnProperty(keyname)) {
    var value = keymap[keyname];
    if (/^(name|fallthrough|(de|at)tach)$/.test(keyname)) { continue }
    if (value == "...") { delete keymap[keyname]; continue }

    var keys = map(keyname.split(" "), normalizeKeyName);
    for (var i = 0; i < keys.length; i++) {
      var val = (void 0), name = (void 0);
      if (i == keys.length - 1) {
        name = keys.join(" ");
        val = value;
      } else {
        name = keys.slice(0, i + 1).join(" ");
        val = "...";
      }
      var prev = copy[name];
      if (!prev) { copy[name] = val; }
      else if (prev != val) { throw new Error("Inconsistent bindings for " + name) }
    }
    delete keymap[keyname];
  } }
  for (var prop in copy) { keymap[prop] = copy[prop]; }
  return keymap
}

function lookupKey(key, map$$1, handle, context) {
  map$$1 = getKeyMap(map$$1);
  var found = map$$1.call ? map$$1.call(key, context) : map$$1[key];
  if (found === false) { return "nothing" }
  if (found === "...") { return "multi" }
  if (found != null && handle(found)) { return "handled" }

  if (map$$1.fallthrough) {
    if (Object.prototype.toString.call(map$$1.fallthrough) != "[object Array]")
      { return lookupKey(key, map$$1.fallthrough, handle, context) }
    for (var i = 0; i < map$$1.fallthrough.length; i++) {
      var result = lookupKey(key, map$$1.fallthrough[i], handle, context);
      if (result) { return result }
    }
  }
}

// Modifier key presses don't count as 'real' key presses for the
// purpose of keymap fallthrough.
function isModifierKey(value) {
  var name = typeof value == "string" ? value : keyNames[value.keyCode];
  return name == "Ctrl" || name == "Alt" || name == "Shift" || name == "Mod"
}

function addModifierNames(name, event, noShift) {
  var base = name;
  if (event.altKey && base != "Alt") { name = "Alt-" + name; }
  if ((flipCtrlCmd ? event.metaKey : event.ctrlKey) && base != "Ctrl") { name = "Ctrl-" + name; }
  if ((flipCtrlCmd ? event.ctrlKey : event.metaKey) && base != "Cmd") { name = "Cmd-" + name; }
  if (!noShift && event.shiftKey && base != "Shift") { name = "Shift-" + name; }
  return name
}

// Look up the name of a key as indicated by an event object.
function keyName(event, noShift) {
  if (presto && event.keyCode == 34 && event["char"]) { return false }
  var name = keyNames[event.keyCode];
  if (name == null || event.altGraphKey) { return false }
  // Ctrl-ScrollLock has keyCode 3, same as Ctrl-Pause,
  // so we'll use event.code when available (Chrome 48+, FF 38+, Safari 10.1+)
  if (event.keyCode == 3 && event.code) { name = event.code; }
  return addModifierNames(name, event, noShift)
}

function getKeyMap(val) {
  return typeof val == "string" ? keyMap[val] : val
}

// Helper for deleting text near the selection(s), used to implement
// backspace, delete, and similar functionality.
function deleteNearSelection(cm, compute) {
  var ranges = cm.doc.sel.ranges, kill = [];
  // Build up a set of ranges to kill first, merging overlapping
  // ranges.
  for (var i = 0; i < ranges.length; i++) {
    var toKill = compute(ranges[i]);
    while (kill.length && cmp(toKill.from, lst(kill).to) <= 0) {
      var replaced = kill.pop();
      if (cmp(replaced.from, toKill.from) < 0) {
        toKill.from = replaced.from;
        break
      }
    }
    kill.push(toKill);
  }
  // Next, remove those actual ranges.
  runInOp(cm, function () {
    for (var i = kill.length - 1; i >= 0; i--)
      { replaceRange(cm.doc, "", kill[i].from, kill[i].to, "+delete"); }
    ensureCursorVisible(cm);
  });
}

function moveCharLogically(line, ch, dir) {
  var target = skipExtendingChars(line.text, ch + dir, dir);
  return target < 0 || target > line.text.length ? null : target
}

function moveLogically(line, start, dir) {
  var ch = moveCharLogically(line, start.ch, dir);
  return ch == null ? null : new Pos(start.line, ch, dir < 0 ? "after" : "before")
}

function endOfLine(visually, cm, lineObj, lineNo, dir) {
  if (visually) {
    var order = getOrder(lineObj, cm.doc.direction);
    if (order) {
      var part = dir < 0 ? lst(order) : order[0];
      var moveInStorageOrder = (dir < 0) == (part.level == 1);
      var sticky = moveInStorageOrder ? "after" : "before";
      var ch;
      // With a wrapped rtl chunk (possibly spanning multiple bidi parts),
      // it could be that the last bidi part is not on the last visual line,
      // since visual lines contain content order-consecutive chunks.
      // Thus, in rtl, we are looking for the first (content-order) character
      // in the rtl chunk that is on the last line (that is, the same line
      // as the last (content-order) character).
      if (part.level > 0 || cm.doc.direction == "rtl") {
        var prep = prepareMeasureForLine(cm, lineObj);
        ch = dir < 0 ? lineObj.text.length - 1 : 0;
        var targetTop = measureCharPrepared(cm, prep, ch).top;
        ch = findFirst(function (ch) { return measureCharPrepared(cm, prep, ch).top == targetTop; }, (dir < 0) == (part.level == 1) ? part.from : part.to - 1, ch);
        if (sticky == "before") { ch = moveCharLogically(lineObj, ch, 1); }
      } else { ch = dir < 0 ? part.to : part.from; }
      return new Pos(lineNo, ch, sticky)
    }
  }
  return new Pos(lineNo, dir < 0 ? lineObj.text.length : 0, dir < 0 ? "before" : "after")
}

function moveVisually(cm, line, start, dir) {
  var bidi = getOrder(line, cm.doc.direction);
  if (!bidi) { return moveLogically(line, start, dir) }
  if (start.ch >= line.text.length) {
    start.ch = line.text.length;
    start.sticky = "before";
  } else if (start.ch <= 0) {
    start.ch = 0;
    start.sticky = "after";
  }
  var partPos = getBidiPartAt(bidi, start.ch, start.sticky), part = bidi[partPos];
  if (cm.doc.direction == "ltr" && part.level % 2 == 0 && (dir > 0 ? part.to > start.ch : part.from < start.ch)) {
    // Case 1: We move within an ltr part in an ltr editor. Even with wrapped lines,
    // nothing interesting happens.
    return moveLogically(line, start, dir)
  }

  var mv = function (pos, dir) { return moveCharLogically(line, pos instanceof Pos ? pos.ch : pos, dir); };
  var prep;
  var getWrappedLineExtent = function (ch) {
    if (!cm.options.lineWrapping) { return {begin: 0, end: line.text.length} }
    prep = prep || prepareMeasureForLine(cm, line);
    return wrappedLineExtentChar(cm, line, prep, ch)
  };
  var wrappedLineExtent = getWrappedLineExtent(start.sticky == "before" ? mv(start, -1) : start.ch);

  if (cm.doc.direction == "rtl" || part.level == 1) {
    var moveInStorageOrder = (part.level == 1) == (dir < 0);
    var ch = mv(start, moveInStorageOrder ? 1 : -1);
    if (ch != null && (!moveInStorageOrder ? ch >= part.from && ch >= wrappedLineExtent.begin : ch <= part.to && ch <= wrappedLineExtent.end)) {
      // Case 2: We move within an rtl part or in an rtl editor on the same visual line
      var sticky = moveInStorageOrder ? "before" : "after";
      return new Pos(start.line, ch, sticky)
    }
  }

  // Case 3: Could not move within this bidi part in this visual line, so leave
  // the current bidi part

  var searchInVisualLine = function (partPos, dir, wrappedLineExtent) {
    var getRes = function (ch, moveInStorageOrder) { return moveInStorageOrder
      ? new Pos(start.line, mv(ch, 1), "before")
      : new Pos(start.line, ch, "after"); };

    for (; partPos >= 0 && partPos < bidi.length; partPos += dir) {
      var part = bidi[partPos];
      var moveInStorageOrder = (dir > 0) == (part.level != 1);
      var ch = moveInStorageOrder ? wrappedLineExtent.begin : mv(wrappedLineExtent.end, -1);
      if (part.from <= ch && ch < part.to) { return getRes(ch, moveInStorageOrder) }
      ch = moveInStorageOrder ? part.from : mv(part.to, -1);
      if (wrappedLineExtent.begin <= ch && ch < wrappedLineExtent.end) { return getRes(ch, moveInStorageOrder) }
    }
  };

  // Case 3a: Look for other bidi parts on the same visual line
  var res = searchInVisualLine(partPos + dir, dir, wrappedLineExtent);
  if (res) { return res }

  // Case 3b: Look for other bidi parts on the next visual line
  var nextCh = dir > 0 ? wrappedLineExtent.end : mv(wrappedLineExtent.begin, -1);
  if (nextCh != null && !(dir > 0 && nextCh == line.text.length)) {
    res = searchInVisualLine(dir > 0 ? 0 : bidi.length - 1, dir, getWrappedLineExtent(nextCh));
    if (res) { return res }
  }

  // Case 4: Nowhere to move
  return null
}

// Commands are parameter-less actions that can be performed on an
// editor, mostly used for keybindings.
var commands = {
  selectAll: selectAll,
  singleSelection: function (cm) { return cm.setSelection(cm.getCursor("anchor"), cm.getCursor("head"), sel_dontScroll); },
  killLine: function (cm) { return deleteNearSelection(cm, function (range) {
    if (range.empty()) {
      var len = getLine(cm.doc, range.head.line).text.length;
      if (range.head.ch == len && range.head.line < cm.lastLine())
        { return {from: range.head, to: Pos(range.head.line + 1, 0)} }
      else
        { return {from: range.head, to: Pos(range.head.line, len)} }
    } else {
      return {from: range.from(), to: range.to()}
    }
  }); },
  deleteLine: function (cm) { return deleteNearSelection(cm, function (range) { return ({
    from: Pos(range.from().line, 0),
    to: clipPos(cm.doc, Pos(range.to().line + 1, 0))
  }); }); },
  delLineLeft: function (cm) { return deleteNearSelection(cm, function (range) { return ({
    from: Pos(range.from().line, 0), to: range.from()
  }); }); },
  delWrappedLineLeft: function (cm) { return deleteNearSelection(cm, function (range) {
    var top = cm.charCoords(range.head, "div").top + 5;
    var leftPos = cm.coordsChar({left: 0, top: top}, "div");
    return {from: leftPos, to: range.from()}
  }); },
  delWrappedLineRight: function (cm) { return deleteNearSelection(cm, function (range) {
    var top = cm.charCoords(range.head, "div").top + 5;
    var rightPos = cm.coordsChar({left: cm.display.lineDiv.offsetWidth + 100, top: top}, "div");
    return {from: range.from(), to: rightPos }
  }); },
  undo: function (cm) { return cm.undo(); },
  redo: function (cm) { return cm.redo(); },
  undoSelection: function (cm) { return cm.undoSelection(); },
  redoSelection: function (cm) { return cm.redoSelection(); },
  goDocStart: function (cm) { return cm.extendSelection(Pos(cm.firstLine(), 0)); },
  goDocEnd: function (cm) { return cm.extendSelection(Pos(cm.lastLine())); },
  goLineStart: function (cm) { return cm.extendSelectionsBy(function (range) { return lineStart(cm, range.head.line); },
    {origin: "+move", bias: 1}
  ); },
  goLineStartSmart: function (cm) { return cm.extendSelectionsBy(function (range) { return lineStartSmart(cm, range.head); },
    {origin: "+move", bias: 1}
  ); },
  goLineEnd: function (cm) { return cm.extendSelectionsBy(function (range) { return lineEnd(cm, range.head.line); },
    {origin: "+move", bias: -1}
  ); },
  goLineRight: function (cm) { return cm.extendSelectionsBy(function (range) {
    var top = cm.cursorCoords(range.head, "div").top + 5;
    return cm.coordsChar({left: cm.display.lineDiv.offsetWidth + 100, top: top}, "div")
  }, sel_move); },
  goLineLeft: function (cm) { return cm.extendSelectionsBy(function (range) {
    var top = cm.cursorCoords(range.head, "div").top + 5;
    return cm.coordsChar({left: 0, top: top}, "div")
  }, sel_move); },
  goLineLeftSmart: function (cm) { return cm.extendSelectionsBy(function (range) {
    var top = cm.cursorCoords(range.head, "div").top + 5;
    var pos = cm.coordsChar({left: 0, top: top}, "div");
    if (pos.ch < cm.getLine(pos.line).search(/\S/)) { return lineStartSmart(cm, range.head) }
    return pos
  }, sel_move); },
  goLineUp: function (cm) { return cm.moveV(-1, "line"); },
  goLineDown: function (cm) { return cm.moveV(1, "line"); },
  goPageUp: function (cm) { return cm.moveV(-1, "page"); },
  goPageDown: function (cm) { return cm.moveV(1, "page"); },
  goCharLeft: function (cm) { return cm.moveH(-1, "char"); },
  goCharRight: function (cm) { return cm.moveH(1, "char"); },
  goColumnLeft: function (cm) { return cm.moveH(-1, "column"); },
  goColumnRight: function (cm) { return cm.moveH(1, "column"); },
  goWordLeft: function (cm) { return cm.moveH(-1, "word"); },
  goGroupRight: function (cm) { return cm.moveH(1, "group"); },
  goGroupLeft: function (cm) { return cm.moveH(-1, "group"); },
  goWordRight: function (cm) { return cm.moveH(1, "word"); },
  delCharBefore: function (cm) { return cm.deleteH(-1, "char"); },
  delCharAfter: function (cm) { return cm.deleteH(1, "char"); },
  delWordBefore: function (cm) { return cm.deleteH(-1, "word"); },
  delWordAfter: function (cm) { return cm.deleteH(1, "word"); },
  delGroupBefore: function (cm) { return cm.deleteH(-1, "group"); },
  delGroupAfter: function (cm) { return cm.deleteH(1, "group"); },
  indentAuto: function (cm) { return cm.indentSelection("smart"); },
  indentMore: function (cm) { return cm.indentSelection("add"); },
  indentLess: function (cm) { return cm.indentSelection("subtract"); },
  insertTab: function (cm) { return cm.replaceSelection("\t"); },
  insertSoftTab: function (cm) {
    var spaces = [], ranges = cm.listSelections(), tabSize = cm.options.tabSize;
    for (var i = 0; i < ranges.length; i++) {
      var pos = ranges[i].from();
      var col = countColumn(cm.getLine(pos.line), pos.ch, tabSize);
      spaces.push(spaceStr(tabSize - col % tabSize));
    }
    cm.replaceSelections(spaces);
  },
  defaultTab: function (cm) {
    if (cm.somethingSelected()) { cm.indentSelection("add"); }
    else { cm.execCommand("insertTab"); }
  },
  // Swap the two chars left and right of each selection's head.
  // Move cursor behind the two swapped characters afterwards.
  //
  // Doesn't consider line feeds a character.
  // Doesn't scan more than one line above to find a character.
  // Doesn't do anything on an empty line.
  // Doesn't do anything with non-empty selections.
  transposeChars: function (cm) { return runInOp(cm, function () {
    var ranges = cm.listSelections(), newSel = [];
    for (var i = 0; i < ranges.length; i++) {
      if (!ranges[i].empty()) { continue }
      var cur = ranges[i].head, line = getLine(cm.doc, cur.line).text;
      if (line) {
        if (cur.ch == line.length) { cur = new Pos(cur.line, cur.ch - 1); }
        if (cur.ch > 0) {
          cur = new Pos(cur.line, cur.ch + 1);
          cm.replaceRange(line.charAt(cur.ch - 1) + line.charAt(cur.ch - 2),
                          Pos(cur.line, cur.ch - 2), cur, "+transpose");
        } else if (cur.line > cm.doc.first) {
          var prev = getLine(cm.doc, cur.line - 1).text;
          if (prev) {
            cur = new Pos(cur.line, 1);
            cm.replaceRange(line.charAt(0) + cm.doc.lineSeparator() +
                            prev.charAt(prev.length - 1),
                            Pos(cur.line - 1, prev.length - 1), cur, "+transpose");
          }
        }
      }
      newSel.push(new Range(cur, cur));
    }
    cm.setSelections(newSel);
  }); },
  newlineAndIndent: function (cm) { return runInOp(cm, function () {
    var sels = cm.listSelections();
    for (var i = sels.length - 1; i >= 0; i--)
      { cm.replaceRange(cm.doc.lineSeparator(), sels[i].anchor, sels[i].head, "+input"); }
    sels = cm.listSelections();
    for (var i$1 = 0; i$1 < sels.length; i$1++)
      { cm.indentLine(sels[i$1].from().line, null, true); }
    ensureCursorVisible(cm);
  }); },
  openLine: function (cm) { return cm.replaceSelection("\n", "start"); },
  toggleOverwrite: function (cm) { return cm.toggleOverwrite(); }
};


function lineStart(cm, lineN) {
  var line = getLine(cm.doc, lineN);
  var visual = visualLine(line);
  if (visual != line) { lineN = lineNo(visual); }
  return endOfLine(true, cm, visual, lineN, 1)
}
function lineEnd(cm, lineN) {
  var line = getLine(cm.doc, lineN);
  var visual = visualLineEnd(line);
  if (visual != line) { lineN = lineNo(visual); }
  return endOfLine(true, cm, line, lineN, -1)
}
function lineStartSmart(cm, pos) {
  var start = lineStart(cm, pos.line);
  var line = getLine(cm.doc, start.line);
  var order = getOrder(line, cm.doc.direction);
  if (!order || order[0].level == 0) {
    var firstNonWS = Math.max(0, line.text.search(/\S/));
    var inWS = pos.line == start.line && pos.ch <= firstNonWS && pos.ch;
    return Pos(start.line, inWS ? 0 : firstNonWS, start.sticky)
  }
  return start
}

// Run a handler that was bound to a key.
function doHandleBinding(cm, bound, dropShift) {
  if (typeof bound == "string") {
    bound = commands[bound];
    if (!bound) { return false }
  }
  // Ensure previous input has been read, so that the handler sees a
  // consistent view of the document
  cm.display.input.ensurePolled();
  var prevShift = cm.display.shift, done = false;
  try {
    if (cm.isReadOnly()) { cm.state.suppressEdits = true; }
    if (dropShift) { cm.display.shift = false; }
    done = bound(cm) != Pass;
  } finally {
    cm.display.shift = prevShift;
    cm.state.suppressEdits = false;
  }
  return done
}

function lookupKeyForEditor(cm, name, handle) {
  for (var i = 0; i < cm.state.keyMaps.length; i++) {
    var result = lookupKey(name, cm.state.keyMaps[i], handle, cm);
    if (result) { return result }
  }
  return (cm.options.extraKeys && lookupKey(name, cm.options.extraKeys, handle, cm))
    || lookupKey(name, cm.options.keyMap, handle, cm)
}

// Note that, despite the name, this function is also used to check
// for bound mouse clicks.

var stopSeq = new Delayed;

function dispatchKey(cm, name, e, handle) {
  var seq = cm.state.keySeq;
  if (seq) {
    if (isModifierKey(name)) { return "handled" }
    if (/\'$/.test(name))
      { cm.state.keySeq = null; }
    else
      { stopSeq.set(50, function () {
        if (cm.state.keySeq == seq) {
          cm.state.keySeq = null;
          cm.display.input.reset();
        }
      }); }
    if (dispatchKeyInner(cm, seq + " " + name, e, handle)) { return true }
  }
  return dispatchKeyInner(cm, name, e, handle)
}

function dispatchKeyInner(cm, name, e, handle) {
  var result = lookupKeyForEditor(cm, name, handle);

  if (result == "multi")
    { cm.state.keySeq = name; }
  if (result == "handled")
    { signalLater(cm, "keyHandled", cm, name, e); }

  if (result == "handled" || result == "multi") {
    e_preventDefault(e);
    restartBlink(cm);
  }

  return !!result
}

// Handle a key from the keydown event.
function handleKeyBinding(cm, e) {
  var name = keyName(e, true);
  if (!name) { return false }

  if (e.shiftKey && !cm.state.keySeq) {
    // First try to resolve full name (including 'Shift-'). Failing
    // that, see if there is a cursor-motion command (starting with
    // 'go') bound to the keyname without 'Shift-'.
    return dispatchKey(cm, "Shift-" + name, e, function (b) { return doHandleBinding(cm, b, true); })
        || dispatchKey(cm, name, e, function (b) {
             if (typeof b == "string" ? /^go[A-Z]/.test(b) : b.motion)
               { return doHandleBinding(cm, b) }
           })
  } else {
    return dispatchKey(cm, name, e, function (b) { return doHandleBinding(cm, b); })
  }
}

// Handle a key from the keypress event
function handleCharBinding(cm, e, ch) {
  return dispatchKey(cm, "'" + ch + "'", e, function (b) { return doHandleBinding(cm, b, true); })
}

var lastStoppedKey = null;
function onKeyDown(e) {
  var cm = this;
  cm.curOp.focus = activeElt();
  if (signalDOMEvent(cm, e)) { return }
  // IE does strange things with escape.
  if (ie && ie_version < 11 && e.keyCode == 27) { e.returnValue = false; }
  var code = e.keyCode;
  cm.display.shift = code == 16 || e.shiftKey;
  var handled = handleKeyBinding(cm, e);
  if (presto) {
    lastStoppedKey = handled ? code : null;
    // Opera has no cut event... we try to at least catch the key combo
    if (!handled && code == 88 && !hasCopyEvent && (mac ? e.metaKey : e.ctrlKey))
      { cm.replaceSelection("", null, "cut"); }
  }

  // Turn mouse into crosshair when Alt is held on Mac.
  if (code == 18 && !/\bCodeMirror-crosshair\b/.test(cm.display.lineDiv.className))
    { showCrossHair(cm); }
}

function showCrossHair(cm) {
  var lineDiv = cm.display.lineDiv;
  addClass(lineDiv, "CodeMirror-crosshair");

  function up(e) {
    if (e.keyCode == 18 || !e.altKey) {
      rmClass(lineDiv, "CodeMirror-crosshair");
      off(document, "keyup", up);
      off(document, "mouseover", up);
    }
  }
  on(document, "keyup", up);
  on(document, "mouseover", up);
}

function onKeyUp(e) {
  if (e.keyCode == 16) { this.doc.sel.shift = false; }
  signalDOMEvent(this, e);
}

function onKeyPress(e) {
  var cm = this;
  if (eventInWidget(cm.display, e) || signalDOMEvent(cm, e) || e.ctrlKey && !e.altKey || mac && e.metaKey) { return }
  var keyCode = e.keyCode, charCode = e.charCode;
  if (presto && keyCode == lastStoppedKey) {lastStoppedKey = null; e_preventDefault(e); return}
  if ((presto && (!e.which || e.which < 10)) && handleKeyBinding(cm, e)) { return }
  var ch = String.fromCharCode(charCode == null ? keyCode : charCode);
  // Some browsers fire keypress events for backspace
  if (ch == "\x08") { return }
  if (handleCharBinding(cm, e, ch)) { return }
  cm.display.input.onKeyPress(e);
}

var DOUBLECLICK_DELAY = 400;

var PastClick = function(time, pos, button) {
  this.time = time;
  this.pos = pos;
  this.button = button;
};

PastClick.prototype.compare = function (time, pos, button) {
  return this.time + DOUBLECLICK_DELAY > time &&
    cmp(pos, this.pos) == 0 && button == this.button
};

var lastClick;
var lastDoubleClick;
function clickRepeat(pos, button) {
  var now = +new Date;
  if (lastDoubleClick && lastDoubleClick.compare(now, pos, button)) {
    lastClick = lastDoubleClick = null;
    return "triple"
  } else if (lastClick && lastClick.compare(now, pos, button)) {
    lastDoubleClick = new PastClick(now, pos, button);
    lastClick = null;
    return "double"
  } else {
    lastClick = new PastClick(now, pos, button);
    lastDoubleClick = null;
    return "single"
  }
}

// A mouse down can be a single click, double click, triple click,
// start of selection drag, start of text drag, new cursor
// (ctrl-click), rectangle drag (alt-drag), or xwin
// middle-click-paste. Or it might be a click on something we should
// not interfere with, such as a scrollbar or widget.
function onMouseDown(e) {
  var cm = this, display = cm.display;
  if (signalDOMEvent(cm, e) || display.activeTouch && display.input.supportsTouch()) { return }
  display.input.ensurePolled();
  display.shift = e.shiftKey;

  if (eventInWidget(display, e)) {
    if (!webkit) {
      // Briefly turn off draggability, to allow widgets to do
      // normal dragging things.
      display.scroller.draggable = false;
      setTimeout(function () { return display.scroller.draggable = true; }, 100);
    }
    return
  }
  if (clickInGutter(cm, e)) { return }
  var pos = posFromMouse(cm, e), button = e_button(e), repeat = pos ? clickRepeat(pos, button) : "single";
  window.focus();

  // #3261: make sure, that we're not starting a second selection
  if (button == 1 && cm.state.selectingText)
    { cm.state.selectingText(e); }

  if (pos && handleMappedButton(cm, button, pos, repeat, e)) { return }

  if (button == 1) {
    if (pos) { leftButtonDown(cm, pos, repeat, e); }
    else if (e_target(e) == display.scroller) { e_preventDefault(e); }
  } else if (button == 2) {
    if (pos) { extendSelection(cm.doc, pos); }
    setTimeout(function () { return display.input.focus(); }, 20);
  } else if (button == 3) {
    if (captureRightClick) { onContextMenu(cm, e); }
    else { delayBlurEvent(cm); }
  }
}

function handleMappedButton(cm, button, pos, repeat, event) {
  var name = "Click";
  if (repeat == "double") { name = "Double" + name; }
  else if (repeat == "triple") { name = "Triple" + name; }
  name = (button == 1 ? "Left" : button == 2 ? "Middle" : "Right") + name;

  return dispatchKey(cm,  addModifierNames(name, event), event, function (bound) {
    if (typeof bound == "string") { bound = commands[bound]; }
    if (!bound) { return false }
    var done = false;
    try {
      if (cm.isReadOnly()) { cm.state.suppressEdits = true; }
      done = bound(cm, pos) != Pass;
    } finally {
      cm.state.suppressEdits = false;
    }
    return done
  })
}

function configureMouse(cm, repeat, event) {
  var option = cm.getOption("configureMouse");
  var value = option ? option(cm, repeat, event) : {};
  if (value.unit == null) {
    var rect = chromeOS ? event.shiftKey && event.metaKey : event.altKey;
    value.unit = rect ? "rectangle" : repeat == "single" ? "char" : repeat == "double" ? "word" : "line";
  }
  if (value.extend == null || cm.doc.extend) { value.extend = cm.doc.extend || event.shiftKey; }
  if (value.addNew == null) { value.addNew = mac ? event.metaKey : event.ctrlKey; }
  if (value.moveOnDrag == null) { value.moveOnDrag = !(mac ? event.altKey : event.ctrlKey); }
  return value
}

function leftButtonDown(cm, pos, repeat, event) {
  if (ie) { setTimeout(bind(ensureFocus, cm), 0); }
  else { cm.curOp.focus = activeElt(); }

  var behavior = configureMouse(cm, repeat, event);

  var sel = cm.doc.sel, contained;
  if (cm.options.dragDrop && dragAndDrop && !cm.isReadOnly() &&
      repeat == "single" && (contained = sel.contains(pos)) > -1 &&
      (cmp((contained = sel.ranges[contained]).from(), pos) < 0 || pos.xRel > 0) &&
      (cmp(contained.to(), pos) > 0 || pos.xRel < 0))
    { leftButtonStartDrag(cm, event, pos, behavior); }
  else
    { leftButtonSelect(cm, event, pos, behavior); }
}

// Start a text drag. When it ends, see if any dragging actually
// happen, and treat as a click if it didn't.
function leftButtonStartDrag(cm, event, pos, behavior) {
  var display = cm.display, moved = false;
  var dragEnd = operation(cm, function (e) {
    if (webkit) { display.scroller.draggable = false; }
    cm.state.draggingText = false;
    off(document, "mouseup", dragEnd);
    off(document, "mousemove", mouseMove);
    off(display.scroller, "dragstart", dragStart);
    off(display.scroller, "drop", dragEnd);
    if (!moved) {
      e_preventDefault(e);
      if (!behavior.addNew)
        { extendSelection(cm.doc, pos, null, null, behavior.extend); }
      // Work around unexplainable focus problem in IE9 (#2127) and Chrome (#3081)
      if (webkit || ie && ie_version == 9)
        { setTimeout(function () {document.body.focus(); display.input.focus();}, 20); }
      else
        { display.input.focus(); }
    }
  });
  var mouseMove = function(e2) {
    moved = moved || Math.abs(event.clientX - e2.clientX) + Math.abs(event.clientY - e2.clientY) >= 10;
  };
  var dragStart = function () { return moved = true; };
  // Let the drag handler handle this.
  if (webkit) { display.scroller.draggable = true; }
  cm.state.draggingText = dragEnd;
  dragEnd.copy = !behavior.moveOnDrag;
  // IE's approach to draggable
  if (display.scroller.dragDrop) { display.scroller.dragDrop(); }
  on(document, "mouseup", dragEnd);
  on(document, "mousemove", mouseMove);
  on(display.scroller, "dragstart", dragStart);
  on(display.scroller, "drop", dragEnd);

  delayBlurEvent(cm);
  setTimeout(function () { return display.input.focus(); }, 20);
}

function rangeForUnit(cm, pos, unit) {
  if (unit == "char") { return new Range(pos, pos) }
  if (unit == "word") { return cm.findWordAt(pos) }
  if (unit == "line") { return new Range(Pos(pos.line, 0), clipPos(cm.doc, Pos(pos.line + 1, 0))) }
  var result = unit(cm, pos);
  return new Range(result.from, result.to)
}

// Normal selection, as opposed to text dragging.
function leftButtonSelect(cm, event, start, behavior) {
  var display = cm.display, doc = cm.doc;
  e_preventDefault(event);

  var ourRange, ourIndex, startSel = doc.sel, ranges = startSel.ranges;
  if (behavior.addNew && !behavior.extend) {
    ourIndex = doc.sel.contains(start);
    if (ourIndex > -1)
      { ourRange = ranges[ourIndex]; }
    else
      { ourRange = new Range(start, start); }
  } else {
    ourRange = doc.sel.primary();
    ourIndex = doc.sel.primIndex;
  }

  if (behavior.unit == "rectangle") {
    if (!behavior.addNew) { ourRange = new Range(start, start); }
    start = posFromMouse(cm, event, true, true);
    ourIndex = -1;
  } else {
    var range$$1 = rangeForUnit(cm, start, behavior.unit);
    if (behavior.extend)
      { ourRange = extendRange(ourRange, range$$1.anchor, range$$1.head, behavior.extend); }
    else
      { ourRange = range$$1; }
  }

  if (!behavior.addNew) {
    ourIndex = 0;
    setSelection(doc, new Selection([ourRange], 0), sel_mouse);
    startSel = doc.sel;
  } else if (ourIndex == -1) {
    ourIndex = ranges.length;
    setSelection(doc, normalizeSelection(ranges.concat([ourRange]), ourIndex),
                 {scroll: false, origin: "*mouse"});
  } else if (ranges.length > 1 && ranges[ourIndex].empty() && behavior.unit == "char" && !behavior.extend) {
    setSelection(doc, normalizeSelection(ranges.slice(0, ourIndex).concat(ranges.slice(ourIndex + 1)), 0),
                 {scroll: false, origin: "*mouse"});
    startSel = doc.sel;
  } else {
    replaceOneSelection(doc, ourIndex, ourRange, sel_mouse);
  }

  var lastPos = start;
  function extendTo(pos) {
    if (cmp(lastPos, pos) == 0) { return }
    lastPos = pos;

    if (behavior.unit == "rectangle") {
      var ranges = [], tabSize = cm.options.tabSize;
      var startCol = countColumn(getLine(doc, start.line).text, start.ch, tabSize);
      var posCol = countColumn(getLine(doc, pos.line).text, pos.ch, tabSize);
      var left = Math.min(startCol, posCol), right = Math.max(startCol, posCol);
      for (var line = Math.min(start.line, pos.line), end = Math.min(cm.lastLine(), Math.max(start.line, pos.line));
           line <= end; line++) {
        var text = getLine(doc, line).text, leftPos = findColumn(text, left, tabSize);
        if (left == right)
          { ranges.push(new Range(Pos(line, leftPos), Pos(line, leftPos))); }
        else if (text.length > leftPos)
          { ranges.push(new Range(Pos(line, leftPos), Pos(line, findColumn(text, right, tabSize)))); }
      }
      if (!ranges.length) { ranges.push(new Range(start, start)); }
      setSelection(doc, normalizeSelection(startSel.ranges.slice(0, ourIndex).concat(ranges), ourIndex),
                   {origin: "*mouse", scroll: false});
      cm.scrollIntoView(pos);
    } else {
      var oldRange = ourRange;
      var range$$1 = rangeForUnit(cm, pos, behavior.unit);
      var anchor = oldRange.anchor, head;
      if (cmp(range$$1.anchor, anchor) > 0) {
        head = range$$1.head;
        anchor = minPos(oldRange.from(), range$$1.anchor);
      } else {
        head = range$$1.anchor;
        anchor = maxPos(oldRange.to(), range$$1.head);
      }
      var ranges$1 = startSel.ranges.slice(0);
      ranges$1[ourIndex] = bidiSimplify(cm, new Range(clipPos(doc, anchor), head));
      setSelection(doc, normalizeSelection(ranges$1, ourIndex), sel_mouse);
    }
  }

  var editorSize = display.wrapper.getBoundingClientRect();
  // Used to ensure timeout re-tries don't fire when another extend
  // happened in the meantime (clearTimeout isn't reliable -- at
  // least on Chrome, the timeouts still happen even when cleared,
  // if the clear happens after their scheduled firing time).
  var counter = 0;

  function extend(e) {
    var curCount = ++counter;
    var cur = posFromMouse(cm, e, true, behavior.unit == "rectangle");
    if (!cur) { return }
    if (cmp(cur, lastPos) != 0) {
      cm.curOp.focus = activeElt();
      extendTo(cur);
      var visible = visibleLines(display, doc);
      if (cur.line >= visible.to || cur.line < visible.from)
        { setTimeout(operation(cm, function () {if (counter == curCount) { extend(e); }}), 150); }
    } else {
      var outside = e.clientY < editorSize.top ? -20 : e.clientY > editorSize.bottom ? 20 : 0;
      if (outside) { setTimeout(operation(cm, function () {
        if (counter != curCount) { return }
        display.scroller.scrollTop += outside;
        extend(e);
      }), 50); }
    }
  }

  function done(e) {
    cm.state.selectingText = false;
    counter = Infinity;
    e_preventDefault(e);
    display.input.focus();
    off(document, "mousemove", move);
    off(document, "mouseup", up);
    doc.history.lastSelOrigin = null;
  }

  var move = operation(cm, function (e) {
    if (!e_button(e)) { done(e); }
    else { extend(e); }
  });
  var up = operation(cm, done);
  cm.state.selectingText = up;
  on(document, "mousemove", move);
  on(document, "mouseup", up);
}

// Used when mouse-selecting to adjust the anchor to the proper side
// of a bidi jump depending on the visual position of the head.
function bidiSimplify(cm, range$$1) {
  var anchor = range$$1.anchor;
  var head = range$$1.head;
  var anchorLine = getLine(cm.doc, anchor.line);
  if (cmp(anchor, head) == 0 && anchor.sticky == head.sticky) { return range$$1 }
  var order = getOrder(anchorLine);
  if (!order) { return range$$1 }
  var index = getBidiPartAt(order, anchor.ch, anchor.sticky), part = order[index];
  if (part.from != anchor.ch && part.to != anchor.ch) { return range$$1 }
  var boundary = index + ((part.from == anchor.ch) == (part.level != 1) ? 0 : 1);
  if (boundary == 0 || boundary == order.length) { return range$$1 }

  // Compute the relative visual position of the head compared to the
  // anchor (<0 is to the left, >0 to the right)
  var leftSide;
  if (head.line != anchor.line) {
    leftSide = (head.line - anchor.line) * (cm.doc.direction == "ltr" ? 1 : -1) > 0;
  } else {
    var headIndex = getBidiPartAt(order, head.ch, head.sticky);
    var dir = headIndex - index || (head.ch - anchor.ch) * (part.level == 1 ? -1 : 1);
    if (headIndex == boundary - 1 || headIndex == boundary)
      { leftSide = dir < 0; }
    else
      { leftSide = dir > 0; }
  }

  var usePart = order[boundary + (leftSide ? -1 : 0)];
  var from = leftSide == (usePart.level == 1);
  var ch = from ? usePart.from : usePart.to, sticky = from ? "after" : "before";
  return anchor.ch == ch && anchor.sticky == sticky ? range$$1 : new Range(new Pos(anchor.line, ch, sticky), head)
}


// Determines whether an event happened in the gutter, and fires the
// handlers for the corresponding event.
function gutterEvent(cm, e, type, prevent) {
  var mX, mY;
  if (e.touches) {
    mX = e.touches[0].clientX;
    mY = e.touches[0].clientY;
  } else {
    try { mX = e.clientX; mY = e.clientY; }
    catch(e) { return false }
  }
  if (mX >= Math.floor(cm.display.gutters.getBoundingClientRect().right)) { return false }
  if (prevent) { e_preventDefault(e); }

  var display = cm.display;
  var lineBox = display.lineDiv.getBoundingClientRect();

  if (mY > lineBox.bottom || !hasHandler(cm, type)) { return e_defaultPrevented(e) }
  mY -= lineBox.top - display.viewOffset;

  for (var i = 0; i < cm.options.gutters.length; ++i) {
    var g = display.gutters.childNodes[i];
    if (g && g.getBoundingClientRect().right >= mX) {
      var line = lineAtHeight(cm.doc, mY);
      var gutter = cm.options.gutters[i];
      signal(cm, type, cm, line, gutter, e);
      return e_defaultPrevented(e)
    }
  }
}

function clickInGutter(cm, e) {
  return gutterEvent(cm, e, "gutterClick", true)
}

// CONTEXT MENU HANDLING

// To make the context menu work, we need to briefly unhide the
// textarea (making it as unobtrusive as possible) to let the
// right-click take effect on it.
function onContextMenu(cm, e) {
  if (eventInWidget(cm.display, e) || contextMenuInGutter(cm, e)) { return }
  if (signalDOMEvent(cm, e, "contextmenu")) { return }
  cm.display.input.onContextMenu(e);
}

function contextMenuInGutter(cm, e) {
  if (!hasHandler(cm, "gutterContextMenu")) { return false }
  return gutterEvent(cm, e, "gutterContextMenu", false)
}

function themeChanged(cm) {
  cm.display.wrapper.className = cm.display.wrapper.className.replace(/\s*cm-s-\S+/g, "") +
    cm.options.theme.replace(/(^|\s)\s*/g, " cm-s-");
  clearCaches(cm);
}

var Init = {toString: function(){return "CodeMirror.Init"}};

var defaults = {};
var optionHandlers = {};

function defineOptions(CodeMirror) {
  var optionHandlers = CodeMirror.optionHandlers;

  function option(name, deflt, handle, notOnInit) {
    CodeMirror.defaults[name] = deflt;
    if (handle) { optionHandlers[name] =
      notOnInit ? function (cm, val, old) {if (old != Init) { handle(cm, val, old); }} : handle; }
  }

  CodeMirror.defineOption = option;

  // Passed to option handlers when there is no old value.
  CodeMirror.Init = Init;

  // These two are, on init, called from the constructor because they
  // have to be initialized before the editor can start at all.
  option("value", "", function (cm, val) { return cm.setValue(val); }, true);
  option("mode", null, function (cm, val) {
    cm.doc.modeOption = val;
    loadMode(cm);
  }, true);

  option("indentUnit", 2, loadMode, true);
  option("indentWithTabs", false);
  option("smartIndent", true);
  option("tabSize", 4, function (cm) {
    resetModeState(cm);
    clearCaches(cm);
    regChange(cm);
  }, true);

  option("lineSeparator", null, function (cm, val) {
    cm.doc.lineSep = val;
    if (!val) { return }
    var newBreaks = [], lineNo = cm.doc.first;
    cm.doc.iter(function (line) {
      for (var pos = 0;;) {
        var found = line.text.indexOf(val, pos);
        if (found == -1) { break }
        pos = found + val.length;
        newBreaks.push(Pos(lineNo, found));
      }
      lineNo++;
    });
    for (var i = newBreaks.length - 1; i >= 0; i--)
      { replaceRange(cm.doc, val, newBreaks[i], Pos(newBreaks[i].line, newBreaks[i].ch + val.length)); }
  });
  option("specialChars", /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u2028\u2029\ufeff]/g, function (cm, val, old) {
    cm.state.specialChars = new RegExp(val.source + (val.test("\t") ? "" : "|\t"), "g");
    if (old != Init) { cm.refresh(); }
  });
  option("specialCharPlaceholder", defaultSpecialCharPlaceholder, function (cm) { return cm.refresh(); }, true);
  option("electricChars", true);
  option("inputStyle", mobile ? "contenteditable" : "textarea", function () {
    throw new Error("inputStyle can not (yet) be changed in a running editor") // FIXME
  }, true);
  option("spellcheck", false, function (cm, val) { return cm.getInputField().spellcheck = val; }, true);
  option("rtlMoveVisually", !windows);
  option("wholeLineUpdateBefore", true);

  option("theme", "default", function (cm) {
    themeChanged(cm);
    guttersChanged(cm);
  }, true);
  option("keyMap", "default", function (cm, val, old) {
    var next = getKeyMap(val);
    var prev = old != Init && getKeyMap(old);
    if (prev && prev.detach) { prev.detach(cm, next); }
    if (next.attach) { next.attach(cm, prev || null); }
  });
  option("extraKeys", null);
  option("configureMouse", null);

  option("lineWrapping", false, wrappingChanged, true);
  option("gutters", [], function (cm) {
    setGuttersForLineNumbers(cm.options);
    guttersChanged(cm);
  }, true);
  option("fixedGutter", true, function (cm, val) {
    cm.display.gutters.style.left = val ? compensateForHScroll(cm.display) + "px" : "0";
    cm.refresh();
  }, true);
  option("coverGutterNextToScrollbar", false, function (cm) { return updateScrollbars(cm); }, true);
  option("scrollbarStyle", "native", function (cm) {
    initScrollbars(cm);
    updateScrollbars(cm);
    cm.display.scrollbars.setScrollTop(cm.doc.scrollTop);
    cm.display.scrollbars.setScrollLeft(cm.doc.scrollLeft);
  }, true);
  option("lineNumbers", false, function (cm) {
    setGuttersForLineNumbers(cm.options);
    guttersChanged(cm);
  }, true);
  option("firstLineNumber", 1, guttersChanged, true);
  option("lineNumberFormatter", function (integer) { return integer; }, guttersChanged, true);
  option("showCursorWhenSelecting", false, updateSelection, true);

  option("resetSelectionOnContextMenu", true);
  option("lineWiseCopyCut", true);
  option("pasteLinesPerSelection", true);

  option("readOnly", false, function (cm, val) {
    if (val == "nocursor") {
      onBlur(cm);
      cm.display.input.blur();
    }
    cm.display.input.readOnlyChanged(val);
  });
  option("disableInput", false, function (cm, val) {if (!val) { cm.display.input.reset(); }}, true);
  option("dragDrop", true, dragDropChanged);
  option("allowDropFileTypes", null);

  option("cursorBlinkRate", 530);
  option("cursorScrollMargin", 0);
  option("cursorHeight", 1, updateSelection, true);
  option("singleCursorHeightPerLine", true, updateSelection, true);
  option("workTime", 100);
  option("workDelay", 100);
  option("flattenSpans", true, resetModeState, true);
  option("addModeClass", false, resetModeState, true);
  option("pollInterval", 100);
  option("undoDepth", 200, function (cm, val) { return cm.doc.history.undoDepth = val; });
  option("historyEventDelay", 1250);
  option("viewportMargin", 10, function (cm) { return cm.refresh(); }, true);
  option("maxHighlightLength", 10000, resetModeState, true);
  option("moveInputWithCursor", true, function (cm, val) {
    if (!val) { cm.display.input.resetPosition(); }
  });

  option("tabindex", null, function (cm, val) { return cm.display.input.getField().tabIndex = val || ""; });
  option("autofocus", null);
  option("direction", "ltr", function (cm, val) { return cm.doc.setDirection(val); }, true);
}

function guttersChanged(cm) {
  updateGutters(cm);
  regChange(cm);
  alignHorizontally(cm);
}

function dragDropChanged(cm, value, old) {
  var wasOn = old && old != Init;
  if (!value != !wasOn) {
    var funcs = cm.display.dragFunctions;
    var toggle = value ? on : off;
    toggle(cm.display.scroller, "dragstart", funcs.start);
    toggle(cm.display.scroller, "dragenter", funcs.enter);
    toggle(cm.display.scroller, "dragover", funcs.over);
    toggle(cm.display.scroller, "dragleave", funcs.leave);
    toggle(cm.display.scroller, "drop", funcs.drop);
  }
}

function wrappingChanged(cm) {
  if (cm.options.lineWrapping) {
    addClass(cm.display.wrapper, "CodeMirror-wrap");
    cm.display.sizer.style.minWidth = "";
    cm.display.sizerWidth = null;
  } else {
    rmClass(cm.display.wrapper, "CodeMirror-wrap");
    findMaxLine(cm);
  }
  estimateLineHeights(cm);
  regChange(cm);
  clearCaches(cm);
  setTimeout(function () { return updateScrollbars(cm); }, 100);
}

// A CodeMirror instance represents an editor. This is the object
// that user code is usually dealing with.

function CodeMirror$1(place, options) {
  var this$1 = this;

  if (!(this instanceof CodeMirror$1)) { return new CodeMirror$1(place, options) }

  this.options = options = options ? copyObj(options) : {};
  // Determine effective options based on given values and defaults.
  copyObj(defaults, options, false);
  setGuttersForLineNumbers(options);

  var doc = options.value;
  if (typeof doc == "string") { doc = new Doc(doc, options.mode, null, options.lineSeparator, options.direction); }
  this.doc = doc;

  var input = new CodeMirror$1.inputStyles[options.inputStyle](this);
  var display = this.display = new Display(place, doc, input);
  display.wrapper.CodeMirror = this;
  updateGutters(this);
  themeChanged(this);
  if (options.lineWrapping)
    { this.display.wrapper.className += " CodeMirror-wrap"; }
  initScrollbars(this);

  this.state = {
    keyMaps: [],  // stores maps added by addKeyMap
    overlays: [], // highlighting overlays, as added by addOverlay
    modeGen: 0,   // bumped when mode/overlay changes, used to invalidate highlighting info
    overwrite: false,
    delayingBlurEvent: false,
    focused: false,
    suppressEdits: false, // used to disable editing during key handlers when in readOnly mode
    pasteIncoming: false, cutIncoming: false, // help recognize paste/cut edits in input.poll
    selectingText: false,
    draggingText: false,
    highlight: new Delayed(), // stores highlight worker timeout
    keySeq: null,  // Unfinished key sequence
    specialChars: null
  };

  if (options.autofocus && !mobile) { display.input.focus(); }

  // Override magic textarea content restore that IE sometimes does
  // on our hidden textarea on reload
  if (ie && ie_version < 11) { setTimeout(function () { return this$1.display.input.reset(true); }, 20); }

  registerEventHandlers(this);
  ensureGlobalHandlers();

  startOperation(this);
  this.curOp.forceUpdate = true;
  attachDoc(this, doc);

  if ((options.autofocus && !mobile) || this.hasFocus())
    { setTimeout(bind(onFocus, this), 20); }
  else
    { onBlur(this); }

  for (var opt in optionHandlers) { if (optionHandlers.hasOwnProperty(opt))
    { optionHandlers[opt](this$1, options[opt], Init); } }
  maybeUpdateLineNumberWidth(this);
  if (options.finishInit) { options.finishInit(this); }
  for (var i = 0; i < initHooks.length; ++i) { initHooks[i](this$1); }
  endOperation(this);
  // Suppress optimizelegibility in Webkit, since it breaks text
  // measuring on line wrapping boundaries.
  if (webkit && options.lineWrapping &&
      getComputedStyle(display.lineDiv).textRendering == "optimizelegibility")
    { display.lineDiv.style.textRendering = "auto"; }
}

// The default configuration options.
CodeMirror$1.defaults = defaults;
// Functions to run when options are changed.
CodeMirror$1.optionHandlers = optionHandlers;

// Attach the necessary event handlers when initializing the editor
function registerEventHandlers(cm) {
  var d = cm.display;
  on(d.scroller, "mousedown", operation(cm, onMouseDown));
  // Older IE's will not fire a second mousedown for a double click
  if (ie && ie_version < 11)
    { on(d.scroller, "dblclick", operation(cm, function (e) {
      if (signalDOMEvent(cm, e)) { return }
      var pos = posFromMouse(cm, e);
      if (!pos || clickInGutter(cm, e) || eventInWidget(cm.display, e)) { return }
      e_preventDefault(e);
      var word = cm.findWordAt(pos);
      extendSelection(cm.doc, word.anchor, word.head);
    })); }
  else
    { on(d.scroller, "dblclick", function (e) { return signalDOMEvent(cm, e) || e_preventDefault(e); }); }
  // Some browsers fire contextmenu *after* opening the menu, at
  // which point we can't mess with it anymore. Context menu is
  // handled in onMouseDown for these browsers.
  if (!captureRightClick) { on(d.scroller, "contextmenu", function (e) { return onContextMenu(cm, e); }); }

  // Used to suppress mouse event handling when a touch happens
  var touchFinished, prevTouch = {end: 0};
  function finishTouch() {
    if (d.activeTouch) {
      touchFinished = setTimeout(function () { return d.activeTouch = null; }, 1000);
      prevTouch = d.activeTouch;
      prevTouch.end = +new Date;
    }
  }
  function isMouseLikeTouchEvent(e) {
    if (e.touches.length != 1) { return false }
    var touch = e.touches[0];
    return touch.radiusX <= 1 && touch.radiusY <= 1
  }
  function farAway(touch, other) {
    if (other.left == null) { return true }
    var dx = other.left - touch.left, dy = other.top - touch.top;
    return dx * dx + dy * dy > 20 * 20
  }
  on(d.scroller, "touchstart", function (e) {
    if (!signalDOMEvent(cm, e) && !isMouseLikeTouchEvent(e) && !clickInGutter(cm, e)) {
      d.input.ensurePolled();
      clearTimeout(touchFinished);
      var now = +new Date;
      d.activeTouch = {start: now, moved: false,
                       prev: now - prevTouch.end <= 300 ? prevTouch : null};
      if (e.touches.length == 1) {
        d.activeTouch.left = e.touches[0].pageX;
        d.activeTouch.top = e.touches[0].pageY;
      }
    }
  });
  on(d.scroller, "touchmove", function () {
    if (d.activeTouch) { d.activeTouch.moved = true; }
  });
  on(d.scroller, "touchend", function (e) {
    var touch = d.activeTouch;
    if (touch && !eventInWidget(d, e) && touch.left != null &&
        !touch.moved && new Date - touch.start < 300) {
      var pos = cm.coordsChar(d.activeTouch, "page"), range;
      if (!touch.prev || farAway(touch, touch.prev)) // Single tap
        { range = new Range(pos, pos); }
      else if (!touch.prev.prev || farAway(touch, touch.prev.prev)) // Double tap
        { range = cm.findWordAt(pos); }
      else // Triple tap
        { range = new Range(Pos(pos.line, 0), clipPos(cm.doc, Pos(pos.line + 1, 0))); }
      cm.setSelection(range.anchor, range.head);
      cm.focus();
      e_preventDefault(e);
    }
    finishTouch();
  });
  on(d.scroller, "touchcancel", finishTouch);

  // Sync scrolling between fake scrollbars and real scrollable
  // area, ensure viewport is updated when scrolling.
  on(d.scroller, "scroll", function () {
    if (d.scroller.clientHeight) {
      updateScrollTop(cm, d.scroller.scrollTop);
      setScrollLeft(cm, d.scroller.scrollLeft, true);
      signal(cm, "scroll", cm);
    }
  });

  // Listen to wheel events in order to try and update the viewport on time.
  on(d.scroller, "mousewheel", function (e) { return onScrollWheel(cm, e); });
  on(d.scroller, "DOMMouseScroll", function (e) { return onScrollWheel(cm, e); });

  // Prevent wrapper from ever scrolling
  on(d.wrapper, "scroll", function () { return d.wrapper.scrollTop = d.wrapper.scrollLeft = 0; });

  d.dragFunctions = {
    enter: function (e) {if (!signalDOMEvent(cm, e)) { e_stop(e); }},
    over: function (e) {if (!signalDOMEvent(cm, e)) { onDragOver(cm, e); e_stop(e); }},
    start: function (e) { return onDragStart(cm, e); },
    drop: operation(cm, onDrop),
    leave: function (e) {if (!signalDOMEvent(cm, e)) { clearDragCursor(cm); }}
  };

  var inp = d.input.getField();
  on(inp, "keyup", function (e) { return onKeyUp.call(cm, e); });
  on(inp, "keydown", operation(cm, onKeyDown));
  on(inp, "keypress", operation(cm, onKeyPress));
  on(inp, "focus", function (e) { return onFocus(cm, e); });
  on(inp, "blur", function (e) { return onBlur(cm, e); });
}

var initHooks = [];
CodeMirror$1.defineInitHook = function (f) { return initHooks.push(f); };

// Indent the given line. The how parameter can be "smart",
// "add"/null, "subtract", or "prev". When aggressive is false
// (typically set to true for forced single-line indents), empty
// lines are not indented, and places where the mode returns Pass
// are left alone.
function indentLine(cm, n, how, aggressive) {
  var doc = cm.doc, state;
  if (how == null) { how = "add"; }
  if (how == "smart") {
    // Fall back to "prev" when the mode doesn't have an indentation
    // method.
    if (!doc.mode.indent) { how = "prev"; }
    else { state = getContextBefore(cm, n).state; }
  }

  var tabSize = cm.options.tabSize;
  var line = getLine(doc, n), curSpace = countColumn(line.text, null, tabSize);
  if (line.stateAfter) { line.stateAfter = null; }
  var curSpaceString = line.text.match(/^\s*/)[0], indentation;
  if (!aggressive && !/\S/.test(line.text)) {
    indentation = 0;
    how = "not";
  } else if (how == "smart") {
    indentation = doc.mode.indent(state, line.text.slice(curSpaceString.length), line.text);
    if (indentation == Pass || indentation > 150) {
      if (!aggressive) { return }
      how = "prev";
    }
  }
  if (how == "prev") {
    if (n > doc.first) { indentation = countColumn(getLine(doc, n-1).text, null, tabSize); }
    else { indentation = 0; }
  } else if (how == "add") {
    indentation = curSpace + cm.options.indentUnit;
  } else if (how == "subtract") {
    indentation = curSpace - cm.options.indentUnit;
  } else if (typeof how == "number") {
    indentation = curSpace + how;
  }
  indentation = Math.max(0, indentation);

  var indentString = "", pos = 0;
  if (cm.options.indentWithTabs)
    { for (var i = Math.floor(indentation / tabSize); i; --i) {pos += tabSize; indentString += "\t";} }
  if (pos < indentation) { indentString += spaceStr(indentation - pos); }

  if (indentString != curSpaceString) {
    replaceRange(doc, indentString, Pos(n, 0), Pos(n, curSpaceString.length), "+input");
    line.stateAfter = null;
    return true
  } else {
    // Ensure that, if the cursor was in the whitespace at the start
    // of the line, it is moved to the end of that space.
    for (var i$1 = 0; i$1 < doc.sel.ranges.length; i$1++) {
      var range = doc.sel.ranges[i$1];
      if (range.head.line == n && range.head.ch < curSpaceString.length) {
        var pos$1 = Pos(n, curSpaceString.length);
        replaceOneSelection(doc, i$1, new Range(pos$1, pos$1));
        break
      }
    }
  }
}

// This will be set to a {lineWise: bool, text: [string]} object, so
// that, when pasting, we know what kind of selections the copied
// text was made out of.
var lastCopied = null;

function setLastCopied(newLastCopied) {
  lastCopied = newLastCopied;
}

function applyTextInput(cm, inserted, deleted, sel, origin) {
  var doc = cm.doc;
  cm.display.shift = false;
  if (!sel) { sel = doc.sel; }

  var paste = cm.state.pasteIncoming || origin == "paste";
  var textLines = splitLinesAuto(inserted), multiPaste = null;
  // When pasting N lines into N selections, insert one line per selection
  if (paste && sel.ranges.length > 1) {
    if (lastCopied && lastCopied.text.join("\n") == inserted) {
      if (sel.ranges.length % lastCopied.text.length == 0) {
        multiPaste = [];
        for (var i = 0; i < lastCopied.text.length; i++)
          { multiPaste.push(doc.splitLines(lastCopied.text[i])); }
      }
    } else if (textLines.length == sel.ranges.length && cm.options.pasteLinesPerSelection) {
      multiPaste = map(textLines, function (l) { return [l]; });
    }
  }

  var updateInput;
  // Normal behavior is to insert the new text into every selection
  for (var i$1 = sel.ranges.length - 1; i$1 >= 0; i$1--) {
    var range$$1 = sel.ranges[i$1];
    var from = range$$1.from(), to = range$$1.to();
    if (range$$1.empty()) {
      if (deleted && deleted > 0) // Handle deletion
        { from = Pos(from.line, from.ch - deleted); }
      else if (cm.state.overwrite && !paste) // Handle overwrite
        { to = Pos(to.line, Math.min(getLine(doc, to.line).text.length, to.ch + lst(textLines).length)); }
      else if (lastCopied && lastCopied.lineWise && lastCopied.text.join("\n") == inserted)
        { from = to = Pos(from.line, 0); }
    }
    updateInput = cm.curOp.updateInput;
    var changeEvent = {from: from, to: to, text: multiPaste ? multiPaste[i$1 % multiPaste.length] : textLines,
                       origin: origin || (paste ? "paste" : cm.state.cutIncoming ? "cut" : "+input")};
    makeChange(cm.doc, changeEvent);
    signalLater(cm, "inputRead", cm, changeEvent);
  }
  if (inserted && !paste)
    { triggerElectric(cm, inserted); }

  ensureCursorVisible(cm);
  cm.curOp.updateInput = updateInput;
  cm.curOp.typing = true;
  cm.state.pasteIncoming = cm.state.cutIncoming = false;
}

function handlePaste(e, cm) {
  var pasted = e.clipboardData && e.clipboardData.getData("Text");
  if (pasted) {
    e.preventDefault();
    if (!cm.isReadOnly() && !cm.options.disableInput)
      { runInOp(cm, function () { return applyTextInput(cm, pasted, 0, null, "paste"); }); }
    return true
  }
}

function triggerElectric(cm, inserted) {
  // When an 'electric' character is inserted, immediately trigger a reindent
  if (!cm.options.electricChars || !cm.options.smartIndent) { return }
  var sel = cm.doc.sel;

  for (var i = sel.ranges.length - 1; i >= 0; i--) {
    var range$$1 = sel.ranges[i];
    if (range$$1.head.ch > 100 || (i && sel.ranges[i - 1].head.line == range$$1.head.line)) { continue }
    var mode = cm.getModeAt(range$$1.head);
    var indented = false;
    if (mode.electricChars) {
      for (var j = 0; j < mode.electricChars.length; j++)
        { if (inserted.indexOf(mode.electricChars.charAt(j)) > -1) {
          indented = indentLine(cm, range$$1.head.line, "smart");
          break
        } }
    } else if (mode.electricInput) {
      if (mode.electricInput.test(getLine(cm.doc, range$$1.head.line).text.slice(0, range$$1.head.ch)))
        { indented = indentLine(cm, range$$1.head.line, "smart"); }
    }
    if (indented) { signalLater(cm, "electricInput", cm, range$$1.head.line); }
  }
}

function copyableRanges(cm) {
  var text = [], ranges = [];
  for (var i = 0; i < cm.doc.sel.ranges.length; i++) {
    var line = cm.doc.sel.ranges[i].head.line;
    var lineRange = {anchor: Pos(line, 0), head: Pos(line + 1, 0)};
    ranges.push(lineRange);
    text.push(cm.getRange(lineRange.anchor, lineRange.head));
  }
  return {text: text, ranges: ranges}
}

function disableBrowserMagic(field, spellcheck) {
  field.setAttribute("autocorrect", "off");
  field.setAttribute("autocapitalize", "off");
  field.setAttribute("spellcheck", !!spellcheck);
}

function hiddenTextarea() {
  var te = elt("textarea", null, null, "position: absolute; bottom: -1em; padding: 0; width: 1px; height: 1em; outline: none");
  var div = elt("div", [te], null, "overflow: hidden; position: relative; width: 3px; height: 0px;");
  // The textarea is kept positioned near the cursor to prevent the
  // fact that it'll be scrolled into view on input from scrolling
  // our fake cursor out of view. On webkit, when wrap=off, paste is
  // very slow. So make the area wide instead.
  if (webkit) { te.style.width = "1000px"; }
  else { te.setAttribute("wrap", "off"); }
  // If border: 0; -- iOS fails to open keyboard (issue #1287)
  if (ios) { te.style.border = "1px solid black"; }
  disableBrowserMagic(te);
  return div
}

// The publicly visible API. Note that methodOp(f) means
// 'wrap f in an operation, performed on its `this` parameter'.

// This is not the complete set of editor methods. Most of the
// methods defined on the Doc type are also injected into
// CodeMirror.prototype, for backwards compatibility and
// convenience.

var addEditorMethods = function(CodeMirror) {
  var optionHandlers = CodeMirror.optionHandlers;

  var helpers = CodeMirror.helpers = {};

  CodeMirror.prototype = {
    constructor: CodeMirror,
    focus: function(){window.focus(); this.display.input.focus();},

    setOption: function(option, value) {
      var options = this.options, old = options[option];
      if (options[option] == value && option != "mode") { return }
      options[option] = value;
      if (optionHandlers.hasOwnProperty(option))
        { operation(this, optionHandlers[option])(this, value, old); }
      signal(this, "optionChange", this, option);
    },

    getOption: function(option) {return this.options[option]},
    getDoc: function() {return this.doc},

    addKeyMap: function(map$$1, bottom) {
      this.state.keyMaps[bottom ? "push" : "unshift"](getKeyMap(map$$1));
    },
    removeKeyMap: function(map$$1) {
      var maps = this.state.keyMaps;
      for (var i = 0; i < maps.length; ++i)
        { if (maps[i] == map$$1 || maps[i].name == map$$1) {
          maps.splice(i, 1);
          return true
        } }
    },

    addOverlay: methodOp(function(spec, options) {
      var mode = spec.token ? spec : CodeMirror.getMode(this.options, spec);
      if (mode.startState) { throw new Error("Overlays may not be stateful.") }
      insertSorted(this.state.overlays,
                   {mode: mode, modeSpec: spec, opaque: options && options.opaque,
                    priority: (options && options.priority) || 0},
                   function (overlay) { return overlay.priority; });
      this.state.modeGen++;
      regChange(this);
    }),
    removeOverlay: methodOp(function(spec) {
      var this$1 = this;

      var overlays = this.state.overlays;
      for (var i = 0; i < overlays.length; ++i) {
        var cur = overlays[i].modeSpec;
        if (cur == spec || typeof spec == "string" && cur.name == spec) {
          overlays.splice(i, 1);
          this$1.state.modeGen++;
          regChange(this$1);
          return
        }
      }
    }),

    indentLine: methodOp(function(n, dir, aggressive) {
      if (typeof dir != "string" && typeof dir != "number") {
        if (dir == null) { dir = this.options.smartIndent ? "smart" : "prev"; }
        else { dir = dir ? "add" : "subtract"; }
      }
      if (isLine(this.doc, n)) { indentLine(this, n, dir, aggressive); }
    }),
    indentSelection: methodOp(function(how) {
      var this$1 = this;

      var ranges = this.doc.sel.ranges, end = -1;
      for (var i = 0; i < ranges.length; i++) {
        var range$$1 = ranges[i];
        if (!range$$1.empty()) {
          var from = range$$1.from(), to = range$$1.to();
          var start = Math.max(end, from.line);
          end = Math.min(this$1.lastLine(), to.line - (to.ch ? 0 : 1)) + 1;
          for (var j = start; j < end; ++j)
            { indentLine(this$1, j, how); }
          var newRanges = this$1.doc.sel.ranges;
          if (from.ch == 0 && ranges.length == newRanges.length && newRanges[i].from().ch > 0)
            { replaceOneSelection(this$1.doc, i, new Range(from, newRanges[i].to()), sel_dontScroll); }
        } else if (range$$1.head.line > end) {
          indentLine(this$1, range$$1.head.line, how, true);
          end = range$$1.head.line;
          if (i == this$1.doc.sel.primIndex) { ensureCursorVisible(this$1); }
        }
      }
    }),

    // Fetch the parser token for a given character. Useful for hacks
    // that want to inspect the mode state (say, for completion).
    getTokenAt: function(pos, precise) {
      return takeToken(this, pos, precise)
    },

    getLineTokens: function(line, precise) {
      return takeToken(this, Pos(line), precise, true)
    },

    getTokenTypeAt: function(pos) {
      pos = clipPos(this.doc, pos);
      var styles = getLineStyles(this, getLine(this.doc, pos.line));
      var before = 0, after = (styles.length - 1) / 2, ch = pos.ch;
      var type;
      if (ch == 0) { type = styles[2]; }
      else { for (;;) {
        var mid = (before + after) >> 1;
        if ((mid ? styles[mid * 2 - 1] : 0) >= ch) { after = mid; }
        else if (styles[mid * 2 + 1] < ch) { before = mid + 1; }
        else { type = styles[mid * 2 + 2]; break }
      } }
      var cut = type ? type.indexOf("overlay ") : -1;
      return cut < 0 ? type : cut == 0 ? null : type.slice(0, cut - 1)
    },

    getModeAt: function(pos) {
      var mode = this.doc.mode;
      if (!mode.innerMode) { return mode }
      return CodeMirror.innerMode(mode, this.getTokenAt(pos).state).mode
    },

    getHelper: function(pos, type) {
      return this.getHelpers(pos, type)[0]
    },

    getHelpers: function(pos, type) {
      var this$1 = this;

      var found = [];
      if (!helpers.hasOwnProperty(type)) { return found }
      var help = helpers[type], mode = this.getModeAt(pos);
      if (typeof mode[type] == "string") {
        if (help[mode[type]]) { found.push(help[mode[type]]); }
      } else if (mode[type]) {
        for (var i = 0; i < mode[type].length; i++) {
          var val = help[mode[type][i]];
          if (val) { found.push(val); }
        }
      } else if (mode.helperType && help[mode.helperType]) {
        found.push(help[mode.helperType]);
      } else if (help[mode.name]) {
        found.push(help[mode.name]);
      }
      for (var i$1 = 0; i$1 < help._global.length; i$1++) {
        var cur = help._global[i$1];
        if (cur.pred(mode, this$1) && indexOf(found, cur.val) == -1)
          { found.push(cur.val); }
      }
      return found
    },

    getStateAfter: function(line, precise) {
      var doc = this.doc;
      line = clipLine(doc, line == null ? doc.first + doc.size - 1: line);
      return getContextBefore(this, line + 1, precise).state
    },

    cursorCoords: function(start, mode) {
      var pos, range$$1 = this.doc.sel.primary();
      if (start == null) { pos = range$$1.head; }
      else if (typeof start == "object") { pos = clipPos(this.doc, start); }
      else { pos = start ? range$$1.from() : range$$1.to(); }
      return cursorCoords(this, pos, mode || "page")
    },

    charCoords: function(pos, mode) {
      return charCoords(this, clipPos(this.doc, pos), mode || "page")
    },

    coordsChar: function(coords, mode) {
      coords = fromCoordSystem(this, coords, mode || "page");
      return coordsChar(this, coords.left, coords.top)
    },

    lineAtHeight: function(height, mode) {
      height = fromCoordSystem(this, {top: height, left: 0}, mode || "page").top;
      return lineAtHeight(this.doc, height + this.display.viewOffset)
    },
    heightAtLine: function(line, mode, includeWidgets) {
      var end = false, lineObj;
      if (typeof line == "number") {
        var last = this.doc.first + this.doc.size - 1;
        if (line < this.doc.first) { line = this.doc.first; }
        else if (line > last) { line = last; end = true; }
        lineObj = getLine(this.doc, line);
      } else {
        lineObj = line;
      }
      return intoCoordSystem(this, lineObj, {top: 0, left: 0}, mode || "page", includeWidgets || end).top +
        (end ? this.doc.height - heightAtLine(lineObj) : 0)
    },

    defaultTextHeight: function() { return textHeight(this.display) },
    defaultCharWidth: function() { return charWidth(this.display) },

    getViewport: function() { return {from: this.display.viewFrom, to: this.display.viewTo}},

    addWidget: function(pos, node, scroll, vert, horiz) {
      var display = this.display;
      pos = cursorCoords(this, clipPos(this.doc, pos));
      var top = pos.bottom, left = pos.left;
      node.style.position = "absolute";
      node.setAttribute("cm-ignore-events", "true");
      this.display.input.setUneditable(node);
      display.sizer.appendChild(node);
      if (vert == "over") {
        top = pos.top;
      } else if (vert == "above" || vert == "near") {
        var vspace = Math.max(display.wrapper.clientHeight, this.doc.height),
        hspace = Math.max(display.sizer.clientWidth, display.lineSpace.clientWidth);
        // Default to positioning above (if specified and possible); otherwise default to positioning below
        if ((vert == 'above' || pos.bottom + node.offsetHeight > vspace) && pos.top > node.offsetHeight)
          { top = pos.top - node.offsetHeight; }
        else if (pos.bottom + node.offsetHeight <= vspace)
          { top = pos.bottom; }
        if (left + node.offsetWidth > hspace)
          { left = hspace - node.offsetWidth; }
      }
      node.style.top = top + "px";
      node.style.left = node.style.right = "";
      if (horiz == "right") {
        left = display.sizer.clientWidth - node.offsetWidth;
        node.style.right = "0px";
      } else {
        if (horiz == "left") { left = 0; }
        else if (horiz == "middle") { left = (display.sizer.clientWidth - node.offsetWidth) / 2; }
        node.style.left = left + "px";
      }
      if (scroll)
        { scrollIntoView(this, {left: left, top: top, right: left + node.offsetWidth, bottom: top + node.offsetHeight}); }
    },

    triggerOnKeyDown: methodOp(onKeyDown),
    triggerOnKeyPress: methodOp(onKeyPress),
    triggerOnKeyUp: onKeyUp,
    triggerOnMouseDown: methodOp(onMouseDown),

    execCommand: function(cmd) {
      if (commands.hasOwnProperty(cmd))
        { return commands[cmd].call(null, this) }
    },

    triggerElectric: methodOp(function(text) { triggerElectric(this, text); }),

    findPosH: function(from, amount, unit, visually) {
      var this$1 = this;

      var dir = 1;
      if (amount < 0) { dir = -1; amount = -amount; }
      var cur = clipPos(this.doc, from);
      for (var i = 0; i < amount; ++i) {
        cur = findPosH(this$1.doc, cur, dir, unit, visually);
        if (cur.hitSide) { break }
      }
      return cur
    },

    moveH: methodOp(function(dir, unit) {
      var this$1 = this;

      this.extendSelectionsBy(function (range$$1) {
        if (this$1.display.shift || this$1.doc.extend || range$$1.empty())
          { return findPosH(this$1.doc, range$$1.head, dir, unit, this$1.options.rtlMoveVisually) }
        else
          { return dir < 0 ? range$$1.from() : range$$1.to() }
      }, sel_move);
    }),

    deleteH: methodOp(function(dir, unit) {
      var sel = this.doc.sel, doc = this.doc;
      if (sel.somethingSelected())
        { doc.replaceSelection("", null, "+delete"); }
      else
        { deleteNearSelection(this, function (range$$1) {
          var other = findPosH(doc, range$$1.head, dir, unit, false);
          return dir < 0 ? {from: other, to: range$$1.head} : {from: range$$1.head, to: other}
        }); }
    }),

    findPosV: function(from, amount, unit, goalColumn) {
      var this$1 = this;

      var dir = 1, x = goalColumn;
      if (amount < 0) { dir = -1; amount = -amount; }
      var cur = clipPos(this.doc, from);
      for (var i = 0; i < amount; ++i) {
        var coords = cursorCoords(this$1, cur, "div");
        if (x == null) { x = coords.left; }
        else { coords.left = x; }
        cur = findPosV(this$1, coords, dir, unit);
        if (cur.hitSide) { break }
      }
      return cur
    },

    moveV: methodOp(function(dir, unit) {
      var this$1 = this;

      var doc = this.doc, goals = [];
      var collapse = !this.display.shift && !doc.extend && doc.sel.somethingSelected();
      doc.extendSelectionsBy(function (range$$1) {
        if (collapse)
          { return dir < 0 ? range$$1.from() : range$$1.to() }
        var headPos = cursorCoords(this$1, range$$1.head, "div");
        if (range$$1.goalColumn != null) { headPos.left = range$$1.goalColumn; }
        goals.push(headPos.left);
        var pos = findPosV(this$1, headPos, dir, unit);
        if (unit == "page" && range$$1 == doc.sel.primary())
          { addToScrollTop(this$1, charCoords(this$1, pos, "div").top - headPos.top); }
        return pos
      }, sel_move);
      if (goals.length) { for (var i = 0; i < doc.sel.ranges.length; i++)
        { doc.sel.ranges[i].goalColumn = goals[i]; } }
    }),

    // Find the word at the given position (as returned by coordsChar).
    findWordAt: function(pos) {
      var doc = this.doc, line = getLine(doc, pos.line).text;
      var start = pos.ch, end = pos.ch;
      if (line) {
        var helper = this.getHelper(pos, "wordChars");
        if ((pos.sticky == "before" || end == line.length) && start) { --start; } else { ++end; }
        var startChar = line.charAt(start);
        var check = isWordChar(startChar, helper)
          ? function (ch) { return isWordChar(ch, helper); }
          : /\s/.test(startChar) ? function (ch) { return /\s/.test(ch); }
          : function (ch) { return (!/\s/.test(ch) && !isWordChar(ch)); };
        while (start > 0 && check(line.charAt(start - 1))) { --start; }
        while (end < line.length && check(line.charAt(end))) { ++end; }
      }
      return new Range(Pos(pos.line, start), Pos(pos.line, end))
    },

    toggleOverwrite: function(value) {
      if (value != null && value == this.state.overwrite) { return }
      if (this.state.overwrite = !this.state.overwrite)
        { addClass(this.display.cursorDiv, "CodeMirror-overwrite"); }
      else
        { rmClass(this.display.cursorDiv, "CodeMirror-overwrite"); }

      signal(this, "overwriteToggle", this, this.state.overwrite);
    },
    hasFocus: function() { return this.display.input.getField() == activeElt() },
    isReadOnly: function() { return !!(this.options.readOnly || this.doc.cantEdit) },

    scrollTo: methodOp(function (x, y) { scrollToCoords(this, x, y); }),
    getScrollInfo: function() {
      var scroller = this.display.scroller;
      return {left: scroller.scrollLeft, top: scroller.scrollTop,
              height: scroller.scrollHeight - scrollGap(this) - this.display.barHeight,
              width: scroller.scrollWidth - scrollGap(this) - this.display.barWidth,
              clientHeight: displayHeight(this), clientWidth: displayWidth(this)}
    },

    scrollIntoView: methodOp(function(range$$1, margin) {
      if (range$$1 == null) {
        range$$1 = {from: this.doc.sel.primary().head, to: null};
        if (margin == null) { margin = this.options.cursorScrollMargin; }
      } else if (typeof range$$1 == "number") {
        range$$1 = {from: Pos(range$$1, 0), to: null};
      } else if (range$$1.from == null) {
        range$$1 = {from: range$$1, to: null};
      }
      if (!range$$1.to) { range$$1.to = range$$1.from; }
      range$$1.margin = margin || 0;

      if (range$$1.from.line != null) {
        scrollToRange(this, range$$1);
      } else {
        scrollToCoordsRange(this, range$$1.from, range$$1.to, range$$1.margin);
      }
    }),

    setSize: methodOp(function(width, height) {
      var this$1 = this;

      var interpret = function (val) { return typeof val == "number" || /^\d+$/.test(String(val)) ? val + "px" : val; };
      if (width != null) { this.display.wrapper.style.width = interpret(width); }
      if (height != null) { this.display.wrapper.style.height = interpret(height); }
      if (this.options.lineWrapping) { clearLineMeasurementCache(this); }
      var lineNo$$1 = this.display.viewFrom;
      this.doc.iter(lineNo$$1, this.display.viewTo, function (line) {
        if (line.widgets) { for (var i = 0; i < line.widgets.length; i++)
          { if (line.widgets[i].noHScroll) { regLineChange(this$1, lineNo$$1, "widget"); break } } }
        ++lineNo$$1;
      });
      this.curOp.forceUpdate = true;
      signal(this, "refresh", this);
    }),

    operation: function(f){return runInOp(this, f)},
    startOperation: function(){return startOperation(this)},
    endOperation: function(){return endOperation(this)},

    refresh: methodOp(function() {
      var oldHeight = this.display.cachedTextHeight;
      regChange(this);
      this.curOp.forceUpdate = true;
      clearCaches(this);
      scrollToCoords(this, this.doc.scrollLeft, this.doc.scrollTop);
      updateGutterSpace(this);
      if (oldHeight == null || Math.abs(oldHeight - textHeight(this.display)) > .5)
        { estimateLineHeights(this); }
      signal(this, "refresh", this);
    }),

    swapDoc: methodOp(function(doc) {
      var old = this.doc;
      old.cm = null;
      attachDoc(this, doc);
      clearCaches(this);
      this.display.input.reset();
      scrollToCoords(this, doc.scrollLeft, doc.scrollTop);
      this.curOp.forceScroll = true;
      signalLater(this, "swapDoc", this, old);
      return old
    }),

    getInputField: function(){return this.display.input.getField()},
    getWrapperElement: function(){return this.display.wrapper},
    getScrollerElement: function(){return this.display.scroller},
    getGutterElement: function(){return this.display.gutters}
  };
  eventMixin(CodeMirror);

  CodeMirror.registerHelper = function(type, name, value) {
    if (!helpers.hasOwnProperty(type)) { helpers[type] = CodeMirror[type] = {_global: []}; }
    helpers[type][name] = value;
  };
  CodeMirror.registerGlobalHelper = function(type, name, predicate, value) {
    CodeMirror.registerHelper(type, name, value);
    helpers[type]._global.push({pred: predicate, val: value});
  };
};

// Used for horizontal relative motion. Dir is -1 or 1 (left or
// right), unit can be "char", "column" (like char, but doesn't
// cross line boundaries), "word" (across next word), or "group" (to
// the start of next group of word or non-word-non-whitespace
// chars). The visually param controls whether, in right-to-left
// text, direction 1 means to move towards the next index in the
// string, or towards the character to the right of the current
// position. The resulting position will have a hitSide=true
// property if it reached the end of the document.
function findPosH(doc, pos, dir, unit, visually) {
  var oldPos = pos;
  var origDir = dir;
  var lineObj = getLine(doc, pos.line);
  function findNextLine() {
    var l = pos.line + dir;
    if (l < doc.first || l >= doc.first + doc.size) { return false }
    pos = new Pos(l, pos.ch, pos.sticky);
    return lineObj = getLine(doc, l)
  }
  function moveOnce(boundToLine) {
    var next;
    if (visually) {
      next = moveVisually(doc.cm, lineObj, pos, dir);
    } else {
      next = moveLogically(lineObj, pos, dir);
    }
    if (next == null) {
      if (!boundToLine && findNextLine())
        { pos = endOfLine(visually, doc.cm, lineObj, pos.line, dir); }
      else
        { return false }
    } else {
      pos = next;
    }
    return true
  }

  if (unit == "char") {
    moveOnce();
  } else if (unit == "column") {
    moveOnce(true);
  } else if (unit == "word" || unit == "group") {
    var sawType = null, group = unit == "group";
    var helper = doc.cm && doc.cm.getHelper(pos, "wordChars");
    for (var first = true;; first = false) {
      if (dir < 0 && !moveOnce(!first)) { break }
      var cur = lineObj.text.charAt(pos.ch) || "\n";
      var type = isWordChar(cur, helper) ? "w"
        : group && cur == "\n" ? "n"
        : !group || /\s/.test(cur) ? null
        : "p";
      if (group && !first && !type) { type = "s"; }
      if (sawType && sawType != type) {
        if (dir < 0) {dir = 1; moveOnce(); pos.sticky = "after";}
        break
      }

      if (type) { sawType = type; }
      if (dir > 0 && !moveOnce(!first)) { break }
    }
  }
  var result = skipAtomic(doc, pos, oldPos, origDir, true);
  if (equalCursorPos(oldPos, result)) { result.hitSide = true; }
  return result
}

// For relative vertical movement. Dir may be -1 or 1. Unit can be
// "page" or "line". The resulting position will have a hitSide=true
// property if it reached the end of the document.
function findPosV(cm, pos, dir, unit) {
  var doc = cm.doc, x = pos.left, y;
  if (unit == "page") {
    var pageSize = Math.min(cm.display.wrapper.clientHeight, window.innerHeight || document.documentElement.clientHeight);
    var moveAmount = Math.max(pageSize - .5 * textHeight(cm.display), 3);
    y = (dir > 0 ? pos.bottom : pos.top) + dir * moveAmount;

  } else if (unit == "line") {
    y = dir > 0 ? pos.bottom + 3 : pos.top - 3;
  }
  var target;
  for (;;) {
    target = coordsChar(cm, x, y);
    if (!target.outside) { break }
    if (dir < 0 ? y <= 0 : y >= doc.height) { target.hitSide = true; break }
    y += dir * 5;
  }
  return target
}

// CONTENTEDITABLE INPUT STYLE

var ContentEditableInput = function(cm) {
  this.cm = cm;
  this.lastAnchorNode = this.lastAnchorOffset = this.lastFocusNode = this.lastFocusOffset = null;
  this.polling = new Delayed();
  this.composing = null;
  this.gracePeriod = false;
  this.readDOMTimeout = null;
};

ContentEditableInput.prototype.init = function (display) {
    var this$1 = this;

  var input = this, cm = input.cm;
  var div = input.div = display.lineDiv;
  disableBrowserMagic(div, cm.options.spellcheck);

  on(div, "paste", function (e) {
    if (signalDOMEvent(cm, e) || handlePaste(e, cm)) { return }
    // IE doesn't fire input events, so we schedule a read for the pasted content in this way
    if (ie_version <= 11) { setTimeout(operation(cm, function () { return this$1.updateFromDOM(); }), 20); }
  });

  on(div, "compositionstart", function (e) {
    this$1.composing = {data: e.data, done: false};
  });
  on(div, "compositionupdate", function (e) {
    if (!this$1.composing) { this$1.composing = {data: e.data, done: false}; }
  });
  on(div, "compositionend", function (e) {
    if (this$1.composing) {
      if (e.data != this$1.composing.data) { this$1.readFromDOMSoon(); }
      this$1.composing.done = true;
    }
  });

  on(div, "touchstart", function () { return input.forceCompositionEnd(); });

  on(div, "input", function () {
    if (!this$1.composing) { this$1.readFromDOMSoon(); }
  });

  function onCopyCut(e) {
    if (signalDOMEvent(cm, e)) { return }
    if (cm.somethingSelected()) {
      setLastCopied({lineWise: false, text: cm.getSelections()});
      if (e.type == "cut") { cm.replaceSelection("", null, "cut"); }
    } else if (!cm.options.lineWiseCopyCut) {
      return
    } else {
      var ranges = copyableRanges(cm);
      setLastCopied({lineWise: true, text: ranges.text});
      if (e.type == "cut") {
        cm.operation(function () {
          cm.setSelections(ranges.ranges, 0, sel_dontScroll);
          cm.replaceSelection("", null, "cut");
        });
      }
    }
    if (e.clipboardData) {
      e.clipboardData.clearData();
      var content = lastCopied.text.join("\n");
      // iOS exposes the clipboard API, but seems to discard content inserted into it
      e.clipboardData.setData("Text", content);
      if (e.clipboardData.getData("Text") == content) {
        e.preventDefault();
        return
      }
    }
    // Old-fashioned briefly-focus-a-textarea hack
    var kludge = hiddenTextarea(), te = kludge.firstChild;
    cm.display.lineSpace.insertBefore(kludge, cm.display.lineSpace.firstChild);
    te.value = lastCopied.text.join("\n");
    var hadFocus = document.activeElement;
    selectInput(te);
    setTimeout(function () {
      cm.display.lineSpace.removeChild(kludge);
      hadFocus.focus();
      if (hadFocus == div) { input.showPrimarySelection(); }
    }, 50);
  }
  on(div, "copy", onCopyCut);
  on(div, "cut", onCopyCut);
};

ContentEditableInput.prototype.prepareSelection = function () {
  var result = prepareSelection(this.cm, false);
  result.focus = this.cm.state.focused;
  return result
};

ContentEditableInput.prototype.showSelection = function (info, takeFocus) {
  if (!info || !this.cm.display.view.length) { return }
  if (info.focus || takeFocus) { this.showPrimarySelection(); }
  this.showMultipleSelections(info);
};

ContentEditableInput.prototype.showPrimarySelection = function () {
  var sel = window.getSelection(), cm = this.cm, prim = cm.doc.sel.primary();
  var from = prim.from(), to = prim.to();

  if (cm.display.viewTo == cm.display.viewFrom || from.line >= cm.display.viewTo || to.line < cm.display.viewFrom) {
    sel.removeAllRanges();
    return
  }

  var curAnchor = domToPos(cm, sel.anchorNode, sel.anchorOffset);
  var curFocus = domToPos(cm, sel.focusNode, sel.focusOffset);
  if (curAnchor && !curAnchor.bad && curFocus && !curFocus.bad &&
      cmp(minPos(curAnchor, curFocus), from) == 0 &&
      cmp(maxPos(curAnchor, curFocus), to) == 0)
    { return }

  var view = cm.display.view;
  var start = (from.line >= cm.display.viewFrom && posToDOM(cm, from)) ||
      {node: view[0].measure.map[2], offset: 0};
  var end = to.line < cm.display.viewTo && posToDOM(cm, to);
  if (!end) {
    var measure = view[view.length - 1].measure;
    var map$$1 = measure.maps ? measure.maps[measure.maps.length - 1] : measure.map;
    end = {node: map$$1[map$$1.length - 1], offset: map$$1[map$$1.length - 2] - map$$1[map$$1.length - 3]};
  }

  if (!start || !end) {
    sel.removeAllRanges();
    return
  }

  var old = sel.rangeCount && sel.getRangeAt(0), rng;
  try { rng = range(start.node, start.offset, end.offset, end.node); }
  catch(e) {} // Our model of the DOM might be outdated, in which case the range we try to set can be impossible
  if (rng) {
    if (!gecko && cm.state.focused) {
      sel.collapse(start.node, start.offset);
      if (!rng.collapsed) {
        sel.removeAllRanges();
        sel.addRange(rng);
      }
    } else {
      sel.removeAllRanges();
      sel.addRange(rng);
    }
    if (old && sel.anchorNode == null) { sel.addRange(old); }
    else if (gecko) { this.startGracePeriod(); }
  }
  this.rememberSelection();
};

ContentEditableInput.prototype.startGracePeriod = function () {
    var this$1 = this;

  clearTimeout(this.gracePeriod);
  this.gracePeriod = setTimeout(function () {
    this$1.gracePeriod = false;
    if (this$1.selectionChanged())
      { this$1.cm.operation(function () { return this$1.cm.curOp.selectionChanged = true; }); }
  }, 20);
};

ContentEditableInput.prototype.showMultipleSelections = function (info) {
  removeChildrenAndAdd(this.cm.display.cursorDiv, info.cursors);
  removeChildrenAndAdd(this.cm.display.selectionDiv, info.selection);
};

ContentEditableInput.prototype.rememberSelection = function () {
  var sel = window.getSelection();
  this.lastAnchorNode = sel.anchorNode; this.lastAnchorOffset = sel.anchorOffset;
  this.lastFocusNode = sel.focusNode; this.lastFocusOffset = sel.focusOffset;
};

ContentEditableInput.prototype.selectionInEditor = function () {
  var sel = window.getSelection();
  if (!sel.rangeCount) { return false }
  var node = sel.getRangeAt(0).commonAncestorContainer;
  return contains(this.div, node)
};

ContentEditableInput.prototype.focus = function () {
  if (this.cm.options.readOnly != "nocursor") {
    if (!this.selectionInEditor())
      { this.showSelection(this.prepareSelection(), true); }
    this.div.focus();
  }
};
ContentEditableInput.prototype.blur = function () { this.div.blur(); };
ContentEditableInput.prototype.getField = function () { return this.div };

ContentEditableInput.prototype.supportsTouch = function () { return true };

ContentEditableInput.prototype.receivedFocus = function () {
  var input = this;
  if (this.selectionInEditor())
    { this.pollSelection(); }
  else
    { runInOp(this.cm, function () { return input.cm.curOp.selectionChanged = true; }); }

  function poll() {
    if (input.cm.state.focused) {
      input.pollSelection();
      input.polling.set(input.cm.options.pollInterval, poll);
    }
  }
  this.polling.set(this.cm.options.pollInterval, poll);
};

ContentEditableInput.prototype.selectionChanged = function () {
  var sel = window.getSelection();
  return sel.anchorNode != this.lastAnchorNode || sel.anchorOffset != this.lastAnchorOffset ||
    sel.focusNode != this.lastFocusNode || sel.focusOffset != this.lastFocusOffset
};

ContentEditableInput.prototype.pollSelection = function () {
  if (this.readDOMTimeout != null || this.gracePeriod || !this.selectionChanged()) { return }
  var sel = window.getSelection(), cm = this.cm;
  // On Android Chrome (version 56, at least), backspacing into an
  // uneditable block element will put the cursor in that element,
  // and then, because it's not editable, hide the virtual keyboard.
  // Because Android doesn't allow us to actually detect backspace
  // presses in a sane way, this code checks for when that happens
  // and simulates a backspace press in this case.
  if (android && chrome && this.cm.options.gutters.length && isInGutter(sel.anchorNode)) {
    this.cm.triggerOnKeyDown({type: "keydown", keyCode: 8, preventDefault: Math.abs});
    this.blur();
    this.focus();
    return
  }
  if (this.composing) { return }
  this.rememberSelection();
  var anchor = domToPos(cm, sel.anchorNode, sel.anchorOffset);
  var head = domToPos(cm, sel.focusNode, sel.focusOffset);
  if (anchor && head) { runInOp(cm, function () {
    setSelection(cm.doc, simpleSelection(anchor, head), sel_dontScroll);
    if (anchor.bad || head.bad) { cm.curOp.selectionChanged = true; }
  }); }
};

ContentEditableInput.prototype.pollContent = function () {
  if (this.readDOMTimeout != null) {
    clearTimeout(this.readDOMTimeout);
    this.readDOMTimeout = null;
  }

  var cm = this.cm, display = cm.display, sel = cm.doc.sel.primary();
  var from = sel.from(), to = sel.to();
  if (from.ch == 0 && from.line > cm.firstLine())
    { from = Pos(from.line - 1, getLine(cm.doc, from.line - 1).length); }
  if (to.ch == getLine(cm.doc, to.line).text.length && to.line < cm.lastLine())
    { to = Pos(to.line + 1, 0); }
  if (from.line < display.viewFrom || to.line > display.viewTo - 1) { return false }

  var fromIndex, fromLine, fromNode;
  if (from.line == display.viewFrom || (fromIndex = findViewIndex(cm, from.line)) == 0) {
    fromLine = lineNo(display.view[0].line);
    fromNode = display.view[0].node;
  } else {
    fromLine = lineNo(display.view[fromIndex].line);
    fromNode = display.view[fromIndex - 1].node.nextSibling;
  }
  var toIndex = findViewIndex(cm, to.line);
  var toLine, toNode;
  if (toIndex == display.view.length - 1) {
    toLine = display.viewTo - 1;
    toNode = display.lineDiv.lastChild;
  } else {
    toLine = lineNo(display.view[toIndex + 1].line) - 1;
    toNode = display.view[toIndex + 1].node.previousSibling;
  }

  if (!fromNode) { return false }
  var newText = cm.doc.splitLines(domTextBetween(cm, fromNode, toNode, fromLine, toLine));
  var oldText = getBetween(cm.doc, Pos(fromLine, 0), Pos(toLine, getLine(cm.doc, toLine).text.length));
  while (newText.length > 1 && oldText.length > 1) {
    if (lst(newText) == lst(oldText)) { newText.pop(); oldText.pop(); toLine--; }
    else if (newText[0] == oldText[0]) { newText.shift(); oldText.shift(); fromLine++; }
    else { break }
  }

  var cutFront = 0, cutEnd = 0;
  var newTop = newText[0], oldTop = oldText[0], maxCutFront = Math.min(newTop.length, oldTop.length);
  while (cutFront < maxCutFront && newTop.charCodeAt(cutFront) == oldTop.charCodeAt(cutFront))
    { ++cutFront; }
  var newBot = lst(newText), oldBot = lst(oldText);
  var maxCutEnd = Math.min(newBot.length - (newText.length == 1 ? cutFront : 0),
                           oldBot.length - (oldText.length == 1 ? cutFront : 0));
  while (cutEnd < maxCutEnd &&
         newBot.charCodeAt(newBot.length - cutEnd - 1) == oldBot.charCodeAt(oldBot.length - cutEnd - 1))
    { ++cutEnd; }
  // Try to move start of change to start of selection if ambiguous
  if (newText.length == 1 && oldText.length == 1 && fromLine == from.line) {
    while (cutFront && cutFront > from.ch &&
           newBot.charCodeAt(newBot.length - cutEnd - 1) == oldBot.charCodeAt(oldBot.length - cutEnd - 1)) {
      cutFront--;
      cutEnd++;
    }
  }

  newText[newText.length - 1] = newBot.slice(0, newBot.length - cutEnd).replace(/^\u200b+/, "");
  newText[0] = newText[0].slice(cutFront).replace(/\u200b+$/, "");

  var chFrom = Pos(fromLine, cutFront);
  var chTo = Pos(toLine, oldText.length ? lst(oldText).length - cutEnd : 0);
  if (newText.length > 1 || newText[0] || cmp(chFrom, chTo)) {
    replaceRange(cm.doc, newText, chFrom, chTo, "+input");
    return true
  }
};

ContentEditableInput.prototype.ensurePolled = function () {
  this.forceCompositionEnd();
};
ContentEditableInput.prototype.reset = function () {
  this.forceCompositionEnd();
};
ContentEditableInput.prototype.forceCompositionEnd = function () {
  if (!this.composing) { return }
  clearTimeout(this.readDOMTimeout);
  this.composing = null;
  this.updateFromDOM();
  this.div.blur();
  this.div.focus();
};
ContentEditableInput.prototype.readFromDOMSoon = function () {
    var this$1 = this;

  if (this.readDOMTimeout != null) { return }
  this.readDOMTimeout = setTimeout(function () {
    this$1.readDOMTimeout = null;
    if (this$1.composing) {
      if (this$1.composing.done) { this$1.composing = null; }
      else { return }
    }
    this$1.updateFromDOM();
  }, 80);
};

ContentEditableInput.prototype.updateFromDOM = function () {
    var this$1 = this;

  if (this.cm.isReadOnly() || !this.pollContent())
    { runInOp(this.cm, function () { return regChange(this$1.cm); }); }
};

ContentEditableInput.prototype.setUneditable = function (node) {
  node.contentEditable = "false";
};

ContentEditableInput.prototype.onKeyPress = function (e) {
  if (e.charCode == 0) { return }
  e.preventDefault();
  if (!this.cm.isReadOnly())
    { operation(this.cm, applyTextInput)(this.cm, String.fromCharCode(e.charCode == null ? e.keyCode : e.charCode), 0); }
};

ContentEditableInput.prototype.readOnlyChanged = function (val) {
  this.div.contentEditable = String(val != "nocursor");
};

ContentEditableInput.prototype.onContextMenu = function () {};
ContentEditableInput.prototype.resetPosition = function () {};

ContentEditableInput.prototype.needsContentAttribute = true;

function posToDOM(cm, pos) {
  var view = findViewForLine(cm, pos.line);
  if (!view || view.hidden) { return null }
  var line = getLine(cm.doc, pos.line);
  var info = mapFromLineView(view, line, pos.line);

  var order = getOrder(line, cm.doc.direction), side = "left";
  if (order) {
    var partPos = getBidiPartAt(order, pos.ch);
    side = partPos % 2 ? "right" : "left";
  }
  var result = nodeAndOffsetInLineMap(info.map, pos.ch, side);
  result.offset = result.collapse == "right" ? result.end : result.start;
  return result
}

function isInGutter(node) {
  for (var scan = node; scan; scan = scan.parentNode)
    { if (/CodeMirror-gutter-wrapper/.test(scan.className)) { return true } }
  return false
}

function badPos(pos, bad) { if (bad) { pos.bad = true; } return pos }

function domTextBetween(cm, from, to, fromLine, toLine) {
  var text = "", closing = false, lineSep = cm.doc.lineSeparator();
  function recognizeMarker(id) { return function (marker) { return marker.id == id; } }
  function close() {
    if (closing) {
      text += lineSep;
      closing = false;
    }
  }
  function addText(str) {
    if (str) {
      close();
      text += str;
    }
  }
  function walk(node) {
    if (node.nodeType == 1) {
      var cmText = node.getAttribute("cm-text");
      if (cmText != null) {
        addText(cmText || node.textContent.replace(/\u200b/g, ""));
        return
      }
      var markerID = node.getAttribute("cm-marker"), range$$1;
      if (markerID) {
        var found = cm.findMarks(Pos(fromLine, 0), Pos(toLine + 1, 0), recognizeMarker(+markerID));
        if (found.length && (range$$1 = found[0].find(0)))
          { addText(getBetween(cm.doc, range$$1.from, range$$1.to).join(lineSep)); }
        return
      }
      if (node.getAttribute("contenteditable") == "false") { return }
      var isBlock = /^(pre|div|p)$/i.test(node.nodeName);
      if (isBlock) { close(); }
      for (var i = 0; i < node.childNodes.length; i++)
        { walk(node.childNodes[i]); }
      if (isBlock) { closing = true; }
    } else if (node.nodeType == 3) {
      addText(node.nodeValue);
    }
  }
  for (;;) {
    walk(from);
    if (from == to) { break }
    from = from.nextSibling;
  }
  return text
}

function domToPos(cm, node, offset) {
  var lineNode;
  if (node == cm.display.lineDiv) {
    lineNode = cm.display.lineDiv.childNodes[offset];
    if (!lineNode) { return badPos(cm.clipPos(Pos(cm.display.viewTo - 1)), true) }
    node = null; offset = 0;
  } else {
    for (lineNode = node;; lineNode = lineNode.parentNode) {
      if (!lineNode || lineNode == cm.display.lineDiv) { return null }
      if (lineNode.parentNode && lineNode.parentNode == cm.display.lineDiv) { break }
    }
  }
  for (var i = 0; i < cm.display.view.length; i++) {
    var lineView = cm.display.view[i];
    if (lineView.node == lineNode)
      { return locateNodeInLineView(lineView, node, offset) }
  }
}

function locateNodeInLineView(lineView, node, offset) {
  var wrapper = lineView.text.firstChild, bad = false;
  if (!node || !contains(wrapper, node)) { return badPos(Pos(lineNo(lineView.line), 0), true) }
  if (node == wrapper) {
    bad = true;
    node = wrapper.childNodes[offset];
    offset = 0;
    if (!node) {
      var line = lineView.rest ? lst(lineView.rest) : lineView.line;
      return badPos(Pos(lineNo(line), line.text.length), bad)
    }
  }

  var textNode = node.nodeType == 3 ? node : null, topNode = node;
  if (!textNode && node.childNodes.length == 1 && node.firstChild.nodeType == 3) {
    textNode = node.firstChild;
    if (offset) { offset = textNode.nodeValue.length; }
  }
  while (topNode.parentNode != wrapper) { topNode = topNode.parentNode; }
  var measure = lineView.measure, maps = measure.maps;

  function find(textNode, topNode, offset) {
    for (var i = -1; i < (maps ? maps.length : 0); i++) {
      var map$$1 = i < 0 ? measure.map : maps[i];
      for (var j = 0; j < map$$1.length; j += 3) {
        var curNode = map$$1[j + 2];
        if (curNode == textNode || curNode == topNode) {
          var line = lineNo(i < 0 ? lineView.line : lineView.rest[i]);
          var ch = map$$1[j] + offset;
          if (offset < 0 || curNode != textNode) { ch = map$$1[j + (offset ? 1 : 0)]; }
          return Pos(line, ch)
        }
      }
    }
  }
  var found = find(textNode, topNode, offset);
  if (found) { return badPos(found, bad) }

  // FIXME this is all really shaky. might handle the few cases it needs to handle, but likely to cause problems
  for (var after = topNode.nextSibling, dist = textNode ? textNode.nodeValue.length - offset : 0; after; after = after.nextSibling) {
    found = find(after, after.firstChild, 0);
    if (found)
      { return badPos(Pos(found.line, found.ch - dist), bad) }
    else
      { dist += after.textContent.length; }
  }
  for (var before = topNode.previousSibling, dist$1 = offset; before; before = before.previousSibling) {
    found = find(before, before.firstChild, -1);
    if (found)
      { return badPos(Pos(found.line, found.ch + dist$1), bad) }
    else
      { dist$1 += before.textContent.length; }
  }
}

// TEXTAREA INPUT STYLE

var TextareaInput = function(cm) {
  this.cm = cm;
  // See input.poll and input.reset
  this.prevInput = "";

  // Flag that indicates whether we expect input to appear real soon
  // now (after some event like 'keypress' or 'input') and are
  // polling intensively.
  this.pollingFast = false;
  // Self-resetting timeout for the poller
  this.polling = new Delayed();
  // Used to work around IE issue with selection being forgotten when focus moves away from textarea
  this.hasSelection = false;
  this.composing = null;
};

TextareaInput.prototype.init = function (display) {
    var this$1 = this;

  var input = this, cm = this.cm;

  // Wraps and hides input textarea
  var div = this.wrapper = hiddenTextarea();
  // The semihidden textarea that is focused when the editor is
  // focused, and receives input.
  var te = this.textarea = div.firstChild;
  display.wrapper.insertBefore(div, display.wrapper.firstChild);

  // Needed to hide big blue blinking cursor on Mobile Safari (doesn't seem to work in iOS 8 anymore)
  if (ios) { te.style.width = "0px"; }

  on(te, "input", function () {
    if (ie && ie_version >= 9 && this$1.hasSelection) { this$1.hasSelection = null; }
    input.poll();
  });

  on(te, "paste", function (e) {
    if (signalDOMEvent(cm, e) || handlePaste(e, cm)) { return }

    cm.state.pasteIncoming = true;
    input.fastPoll();
  });

  function prepareCopyCut(e) {
    if (signalDOMEvent(cm, e)) { return }
    if (cm.somethingSelected()) {
      setLastCopied({lineWise: false, text: cm.getSelections()});
    } else if (!cm.options.lineWiseCopyCut) {
      return
    } else {
      var ranges = copyableRanges(cm);
      setLastCopied({lineWise: true, text: ranges.text});
      if (e.type == "cut") {
        cm.setSelections(ranges.ranges, null, sel_dontScroll);
      } else {
        input.prevInput = "";
        te.value = ranges.text.join("\n");
        selectInput(te);
      }
    }
    if (e.type == "cut") { cm.state.cutIncoming = true; }
  }
  on(te, "cut", prepareCopyCut);
  on(te, "copy", prepareCopyCut);

  on(display.scroller, "paste", function (e) {
    if (eventInWidget(display, e) || signalDOMEvent(cm, e)) { return }
    cm.state.pasteIncoming = true;
    input.focus();
  });

  // Prevent normal selection in the editor (we handle our own)
  on(display.lineSpace, "selectstart", function (e) {
    if (!eventInWidget(display, e)) { e_preventDefault(e); }
  });

  on(te, "compositionstart", function () {
    var start = cm.getCursor("from");
    if (input.composing) { input.composing.range.clear(); }
    input.composing = {
      start: start,
      range: cm.markText(start, cm.getCursor("to"), {className: "CodeMirror-composing"})
    };
  });
  on(te, "compositionend", function () {
    if (input.composing) {
      input.poll();
      input.composing.range.clear();
      input.composing = null;
    }
  });
};

TextareaInput.prototype.prepareSelection = function () {
  // Redraw the selection and/or cursor
  var cm = this.cm, display = cm.display, doc = cm.doc;
  var result = prepareSelection(cm);

  // Move the hidden textarea near the cursor to prevent scrolling artifacts
  if (cm.options.moveInputWithCursor) {
    var headPos = cursorCoords(cm, doc.sel.primary().head, "div");
    var wrapOff = display.wrapper.getBoundingClientRect(), lineOff = display.lineDiv.getBoundingClientRect();
    result.teTop = Math.max(0, Math.min(display.wrapper.clientHeight - 10,
                                        headPos.top + lineOff.top - wrapOff.top));
    result.teLeft = Math.max(0, Math.min(display.wrapper.clientWidth - 10,
                                         headPos.left + lineOff.left - wrapOff.left));
  }

  return result
};

TextareaInput.prototype.showSelection = function (drawn) {
  var cm = this.cm, display = cm.display;
  removeChildrenAndAdd(display.cursorDiv, drawn.cursors);
  removeChildrenAndAdd(display.selectionDiv, drawn.selection);
  if (drawn.teTop != null) {
    this.wrapper.style.top = drawn.teTop + "px";
    this.wrapper.style.left = drawn.teLeft + "px";
  }
};

// Reset the input to correspond to the selection (or to be empty,
// when not typing and nothing is selected)
TextareaInput.prototype.reset = function (typing) {
  if (this.contextMenuPending || this.composing) { return }
  var cm = this.cm;
  if (cm.somethingSelected()) {
    this.prevInput = "";
    var content = cm.getSelection();
    this.textarea.value = content;
    if (cm.state.focused) { selectInput(this.textarea); }
    if (ie && ie_version >= 9) { this.hasSelection = content; }
  } else if (!typing) {
    this.prevInput = this.textarea.value = "";
    if (ie && ie_version >= 9) { this.hasSelection = null; }
  }
};

TextareaInput.prototype.getField = function () { return this.textarea };

TextareaInput.prototype.supportsTouch = function () { return false };

TextareaInput.prototype.focus = function () {
  if (this.cm.options.readOnly != "nocursor" && (!mobile || activeElt() != this.textarea)) {
    try { this.textarea.focus(); }
    catch (e) {} // IE8 will throw if the textarea is display: none or not in DOM
  }
};

TextareaInput.prototype.blur = function () { this.textarea.blur(); };

TextareaInput.prototype.resetPosition = function () {
  this.wrapper.style.top = this.wrapper.style.left = 0;
};

TextareaInput.prototype.receivedFocus = function () { this.slowPoll(); };

// Poll for input changes, using the normal rate of polling. This
// runs as long as the editor is focused.
TextareaInput.prototype.slowPoll = function () {
    var this$1 = this;

  if (this.pollingFast) { return }
  this.polling.set(this.cm.options.pollInterval, function () {
    this$1.poll();
    if (this$1.cm.state.focused) { this$1.slowPoll(); }
  });
};

// When an event has just come in that is likely to add or change
// something in the input textarea, we poll faster, to ensure that
// the change appears on the screen quickly.
TextareaInput.prototype.fastPoll = function () {
  var missed = false, input = this;
  input.pollingFast = true;
  function p() {
    var changed = input.poll();
    if (!changed && !missed) {missed = true; input.polling.set(60, p);}
    else {input.pollingFast = false; input.slowPoll();}
  }
  input.polling.set(20, p);
};

// Read input from the textarea, and update the document to match.
// When something is selected, it is present in the textarea, and
// selected (unless it is huge, in which case a placeholder is
// used). When nothing is selected, the cursor sits after previously
// seen text (can be empty), which is stored in prevInput (we must
// not reset the textarea when typing, because that breaks IME).
TextareaInput.prototype.poll = function () {
    var this$1 = this;

  var cm = this.cm, input = this.textarea, prevInput = this.prevInput;
  // Since this is called a *lot*, try to bail out as cheaply as
  // possible when it is clear that nothing happened. hasSelection
  // will be the case when there is a lot of text in the textarea,
  // in which case reading its value would be expensive.
  if (this.contextMenuPending || !cm.state.focused ||
      (hasSelection(input) && !prevInput && !this.composing) ||
      cm.isReadOnly() || cm.options.disableInput || cm.state.keySeq)
    { return false }

  var text = input.value;
  // If nothing changed, bail.
  if (text == prevInput && !cm.somethingSelected()) { return false }
  // Work around nonsensical selection resetting in IE9/10, and
  // inexplicable appearance of private area unicode characters on
  // some key combos in Mac (#2689).
  if (ie && ie_version >= 9 && this.hasSelection === text ||
      mac && /[\uf700-\uf7ff]/.test(text)) {
    cm.display.input.reset();
    return false
  }

  if (cm.doc.sel == cm.display.selForContextMenu) {
    var first = text.charCodeAt(0);
    if (first == 0x200b && !prevInput) { prevInput = "\u200b"; }
    if (first == 0x21da) { this.reset(); return this.cm.execCommand("undo") }
  }
  // Find the part of the input that is actually new
  var same = 0, l = Math.min(prevInput.length, text.length);
  while (same < l && prevInput.charCodeAt(same) == text.charCodeAt(same)) { ++same; }

  runInOp(cm, function () {
    applyTextInput(cm, text.slice(same), prevInput.length - same,
                   null, this$1.composing ? "*compose" : null);

    // Don't leave long text in the textarea, since it makes further polling slow
    if (text.length > 1000 || text.indexOf("\n") > -1) { input.value = this$1.prevInput = ""; }
    else { this$1.prevInput = text; }

    if (this$1.composing) {
      this$1.composing.range.clear();
      this$1.composing.range = cm.markText(this$1.composing.start, cm.getCursor("to"),
                                         {className: "CodeMirror-composing"});
    }
  });
  return true
};

TextareaInput.prototype.ensurePolled = function () {
  if (this.pollingFast && this.poll()) { this.pollingFast = false; }
};

TextareaInput.prototype.onKeyPress = function () {
  if (ie && ie_version >= 9) { this.hasSelection = null; }
  this.fastPoll();
};

TextareaInput.prototype.onContextMenu = function (e) {
  var input = this, cm = input.cm, display = cm.display, te = input.textarea;
  var pos = posFromMouse(cm, e), scrollPos = display.scroller.scrollTop;
  if (!pos || presto) { return } // Opera is difficult.

  // Reset the current text selection only if the click is done outside of the selection
  // and 'resetSelectionOnContextMenu' option is true.
  var reset = cm.options.resetSelectionOnContextMenu;
  if (reset && cm.doc.sel.contains(pos) == -1)
    { operation(cm, setSelection)(cm.doc, simpleSelection(pos), sel_dontScroll); }

  var oldCSS = te.style.cssText, oldWrapperCSS = input.wrapper.style.cssText;
  input.wrapper.style.cssText = "position: absolute";
  var wrapperBox = input.wrapper.getBoundingClientRect();
  te.style.cssText = "position: absolute; width: 30px; height: 30px;\n      top: " + (e.clientY - wrapperBox.top - 5) + "px; left: " + (e.clientX - wrapperBox.left - 5) + "px;\n      z-index: 1000; background: " + (ie ? "rgba(255, 255, 255, .05)" : "transparent") + ";\n      outline: none; border-width: 0; outline: none; overflow: hidden; opacity: .05; filter: alpha(opacity=5);";
  var oldScrollY;
  if (webkit) { oldScrollY = window.scrollY; } // Work around Chrome issue (#2712)
  display.input.focus();
  if (webkit) { window.scrollTo(null, oldScrollY); }
  display.input.reset();
  // Adds "Select all" to context menu in FF
  if (!cm.somethingSelected()) { te.value = input.prevInput = " "; }
  input.contextMenuPending = true;
  display.selForContextMenu = cm.doc.sel;
  clearTimeout(display.detectingSelectAll);

  // Select-all will be greyed out if there's nothing to select, so
  // this adds a zero-width space so that we can later check whether
  // it got selected.
  function prepareSelectAllHack() {
    if (te.selectionStart != null) {
      var selected = cm.somethingSelected();
      var extval = "\u200b" + (selected ? te.value : "");
      te.value = "\u21da"; // Used to catch context-menu undo
      te.value = extval;
      input.prevInput = selected ? "" : "\u200b";
      te.selectionStart = 1; te.selectionEnd = extval.length;
      // Re-set this, in case some other handler touched the
      // selection in the meantime.
      display.selForContextMenu = cm.doc.sel;
    }
  }
  function rehide() {
    input.contextMenuPending = false;
    input.wrapper.style.cssText = oldWrapperCSS;
    te.style.cssText = oldCSS;
    if (ie && ie_version < 9) { display.scrollbars.setScrollTop(display.scroller.scrollTop = scrollPos); }

    // Try to detect the user choosing select-all
    if (te.selectionStart != null) {
      if (!ie || (ie && ie_version < 9)) { prepareSelectAllHack(); }
      var i = 0, poll = function () {
        if (display.selForContextMenu == cm.doc.sel && te.selectionStart == 0 &&
            te.selectionEnd > 0 && input.prevInput == "\u200b") {
          operation(cm, selectAll)(cm);
        } else if (i++ < 10) {
          display.detectingSelectAll = setTimeout(poll, 500);
        } else {
          display.selForContextMenu = null;
          display.input.reset();
        }
      };
      display.detectingSelectAll = setTimeout(poll, 200);
    }
  }

  if (ie && ie_version >= 9) { prepareSelectAllHack(); }
  if (captureRightClick) {
    e_stop(e);
    var mouseup = function () {
      off(window, "mouseup", mouseup);
      setTimeout(rehide, 20);
    };
    on(window, "mouseup", mouseup);
  } else {
    setTimeout(rehide, 50);
  }
};

TextareaInput.prototype.readOnlyChanged = function (val) {
  if (!val) { this.reset(); }
  this.textarea.disabled = val == "nocursor";
};

TextareaInput.prototype.setUneditable = function () {};

TextareaInput.prototype.needsContentAttribute = false;

function fromTextArea(textarea, options) {
  options = options ? copyObj(options) : {};
  options.value = textarea.value;
  if (!options.tabindex && textarea.tabIndex)
    { options.tabindex = textarea.tabIndex; }
  if (!options.placeholder && textarea.placeholder)
    { options.placeholder = textarea.placeholder; }
  // Set autofocus to true if this textarea is focused, or if it has
  // autofocus and no other element is focused.
  if (options.autofocus == null) {
    var hasFocus = activeElt();
    options.autofocus = hasFocus == textarea ||
      textarea.getAttribute("autofocus") != null && hasFocus == document.body;
  }

  function save() {textarea.value = cm.getValue();}

  var realSubmit;
  if (textarea.form) {
    on(textarea.form, "submit", save);
    // Deplorable hack to make the submit method do the right thing.
    if (!options.leaveSubmitMethodAlone) {
      var form = textarea.form;
      realSubmit = form.submit;
      try {
        var wrappedSubmit = form.submit = function () {
          save();
          form.submit = realSubmit;
          form.submit();
          form.submit = wrappedSubmit;
        };
      } catch(e) {}
    }
  }

  options.finishInit = function (cm) {
    cm.save = save;
    cm.getTextArea = function () { return textarea; };
    cm.toTextArea = function () {
      cm.toTextArea = isNaN; // Prevent this from being ran twice
      save();
      textarea.parentNode.removeChild(cm.getWrapperElement());
      textarea.style.display = "";
      if (textarea.form) {
        off(textarea.form, "submit", save);
        if (typeof textarea.form.submit == "function")
          { textarea.form.submit = realSubmit; }
      }
    };
  };

  textarea.style.display = "none";
  var cm = CodeMirror$1(function (node) { return textarea.parentNode.insertBefore(node, textarea.nextSibling); },
    options);
  return cm
}

function addLegacyProps(CodeMirror) {
  CodeMirror.off = off;
  CodeMirror.on = on;
  CodeMirror.wheelEventPixels = wheelEventPixels;
  CodeMirror.Doc = Doc;
  CodeMirror.splitLines = splitLinesAuto;
  CodeMirror.countColumn = countColumn;
  CodeMirror.findColumn = findColumn;
  CodeMirror.isWordChar = isWordCharBasic;
  CodeMirror.Pass = Pass;
  CodeMirror.signal = signal;
  CodeMirror.Line = Line;
  CodeMirror.changeEnd = changeEnd;
  CodeMirror.scrollbarModel = scrollbarModel;
  CodeMirror.Pos = Pos;
  CodeMirror.cmpPos = cmp;
  CodeMirror.modes = modes;
  CodeMirror.mimeModes = mimeModes;
  CodeMirror.resolveMode = resolveMode;
  CodeMirror.getMode = getMode;
  CodeMirror.modeExtensions = modeExtensions;
  CodeMirror.extendMode = extendMode;
  CodeMirror.copyState = copyState;
  CodeMirror.startState = startState;
  CodeMirror.innerMode = innerMode;
  CodeMirror.commands = commands;
  CodeMirror.keyMap = keyMap;
  CodeMirror.keyName = keyName;
  CodeMirror.isModifierKey = isModifierKey;
  CodeMirror.lookupKey = lookupKey;
  CodeMirror.normalizeKeyMap = normalizeKeyMap;
  CodeMirror.StringStream = StringStream;
  CodeMirror.SharedTextMarker = SharedTextMarker;
  CodeMirror.TextMarker = TextMarker;
  CodeMirror.LineWidget = LineWidget;
  CodeMirror.e_preventDefault = e_preventDefault;
  CodeMirror.e_stopPropagation = e_stopPropagation;
  CodeMirror.e_stop = e_stop;
  CodeMirror.addClass = addClass;
  CodeMirror.contains = contains;
  CodeMirror.rmClass = rmClass;
  CodeMirror.keyNames = keyNames;
}

// EDITOR CONSTRUCTOR

defineOptions(CodeMirror$1);

addEditorMethods(CodeMirror$1);

// Set up methods on CodeMirror's prototype to redirect to the editor's document.
var dontDelegate = "iter insert remove copy getEditor constructor".split(" ");
for (var prop in Doc.prototype) { if (Doc.prototype.hasOwnProperty(prop) && indexOf(dontDelegate, prop) < 0)
  { CodeMirror$1.prototype[prop] = (function(method) {
    return function() {return method.apply(this.doc, arguments)}
  })(Doc.prototype[prop]); } }

eventMixin(Doc);

// INPUT HANDLING

CodeMirror$1.inputStyles = {"textarea": TextareaInput, "contenteditable": ContentEditableInput};

// MODE DEFINITION AND QUERYING

// Extra arguments are stored as the mode's dependencies, which is
// used by (legacy) mechanisms like loadmode.js to automatically
// load a mode. (Preferred mechanism is the require/define calls.)
CodeMirror$1.defineMode = function(name/*, mode, …*/) {
  if (!CodeMirror$1.defaults.mode && name != "null") { CodeMirror$1.defaults.mode = name; }
  defineMode.apply(this, arguments);
};

CodeMirror$1.defineMIME = defineMIME;

// Minimal default mode.
CodeMirror$1.defineMode("null", function () { return ({token: function (stream) { return stream.skipToEnd(); }}); });
CodeMirror$1.defineMIME("text/plain", "null");

// EXTENSIONS

CodeMirror$1.defineExtension = function (name, func) {
  CodeMirror$1.prototype[name] = func;
};
CodeMirror$1.defineDocExtension = function (name, func) {
  Doc.prototype[name] = func;
};

CodeMirror$1.fromTextArea = fromTextArea;

addLegacyProps(CodeMirror$1);

CodeMirror$1.version = "5.35.0";

return CodeMirror$1;

})));

},{}],2:[function(require,module,exports){
CodeMirror = require('./codemirror.js');
CodeMirror.defineMode("ipython", function(conf, parserConf) {
    var pythonConf = {};
    for (var prop in parserConf) {
        if (parserConf.hasOwnProperty(prop)) {
            pythonConf[prop] = parserConf[prop];
        }
    }
    pythonConf.name = 'python';
    pythonConf.singleOperators = new RegExp("^[\\+\\-\\*/%&|@\\^~<>!\\?]");
    if (pythonConf.version === 3) {
        pythonConf.identifiers = new RegExp("^[_A-Za-z\u00A1-\uFFFF][_A-Za-z0-9\u00A1-\uFFFF]*");
    } else if (pythonConf.version === 2) {
        pythonConf.identifiers = new RegExp("^[_A-Za-z][_A-Za-z0-9]*");
    }
    return CodeMirror.getMode(conf, pythonConf);
}, 'python');

CodeMirror.defineMIME("text/x-ipython", "ipython");

var url = new URL(window.location.href);
var total_cells = url.searchParams.get('total_cells') || 150;
var cm_config = {
    "indentUnit":4,
    "readOnly":false,
    "theme":"ipython",
    "extraKeys":{
        "Cmd-Right":"goLineRight",
        "End":"goLineRight",
        "Cmd-Left":"goLineLeft",
        "Tab":"indentMore",
        "Shift-Tab":"indentLess",
        "Cmd-/":"toggleComment",
        "Ctrl-/":"toggleComment",
        "Backspace":"delSpaceToPrevTabStop"
    },
    "mode":{
        "name":"ipython",
        "version":3
    },
    "matchBrackets":true,
    "autoCloseBrackets":true
};

window.shared_elements = {};
for (var i=0; i<total_cells; i++) {
    var output = document.createElement('div');
    var input_area = document.createElement('div');
    input_area.setAttribute('data-id', i);
    input_area.setAttribute('data-active', 'no');
    input_area.className = 'input_area';
    //var codemirror = CodeMirror(input_area, cm_config); 
    var codemirror = new CodeMirror(input_area, cm_config); 
    window.shared_elements[i] = {
        'output': output,
        'input_area': input_area,
        'codemirror': codemirror,
    };
}

window.shared_elements_available = true;

},{"./codemirror.js":1}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29kZW1pcnJvci5qcyIsInNyYy9wcmVkZWZpbmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4OFNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIvLyBDb2RlTWlycm9yLCBjb3B5cmlnaHQgKGMpIGJ5IE1hcmlqbiBIYXZlcmJla2UgYW5kIG90aGVyc1xuLy8gRGlzdHJpYnV0ZWQgdW5kZXIgYW4gTUlUIGxpY2Vuc2U6IGh0dHA6Ly9jb2RlbWlycm9yLm5ldC9MSUNFTlNFXG5cbi8vIFRoaXMgaXMgQ29kZU1pcnJvciAoaHR0cDovL2NvZGVtaXJyb3IubmV0KSwgYSBjb2RlIGVkaXRvclxuLy8gaW1wbGVtZW50ZWQgaW4gSmF2YVNjcmlwdCBvbiB0b3Agb2YgdGhlIGJyb3dzZXIncyBET00uXG4vL1xuLy8gWW91IGNhbiBmaW5kIHNvbWUgdGVjaG5pY2FsIGJhY2tncm91bmQgZm9yIHNvbWUgb2YgdGhlIGNvZGUgYmVsb3dcbi8vIGF0IGh0dHA6Ly9tYXJpam5oYXZlcmJla2UubmwvYmxvZy8jY20taW50ZXJuYWxzIC5cblxuKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcblx0dHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnID8gbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCkgOlxuXHR0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUoZmFjdG9yeSkgOlxuXHQoZ2xvYmFsLkNvZGVNaXJyb3IgPSBmYWN0b3J5KCkpO1xufSh0aGlzLCAoZnVuY3Rpb24gKCkgeyAndXNlIHN0cmljdCc7XG5cbi8vIEtsdWRnZXMgZm9yIGJ1Z3MgYW5kIGJlaGF2aW9yIGRpZmZlcmVuY2VzIHRoYXQgY2FuJ3QgYmUgZmVhdHVyZVxuLy8gZGV0ZWN0ZWQgYXJlIGVuYWJsZWQgYmFzZWQgb24gdXNlckFnZW50IGV0YyBzbmlmZmluZy5cbnZhciB1c2VyQWdlbnQgPSBuYXZpZ2F0b3IudXNlckFnZW50O1xudmFyIHBsYXRmb3JtID0gbmF2aWdhdG9yLnBsYXRmb3JtO1xuXG52YXIgZ2Vja28gPSAvZ2Vja29cXC9cXGQvaS50ZXN0KHVzZXJBZ2VudCk7XG52YXIgaWVfdXB0bzEwID0gL01TSUUgXFxkLy50ZXN0KHVzZXJBZ2VudCk7XG52YXIgaWVfMTF1cCA9IC9UcmlkZW50XFwvKD86WzctOV18XFxkezIsfSlcXC4uKnJ2OihcXGQrKS8uZXhlYyh1c2VyQWdlbnQpO1xudmFyIGVkZ2UgPSAvRWRnZVxcLyhcXGQrKS8uZXhlYyh1c2VyQWdlbnQpO1xudmFyIGllID0gaWVfdXB0bzEwIHx8IGllXzExdXAgfHwgZWRnZTtcbnZhciBpZV92ZXJzaW9uID0gaWUgJiYgKGllX3VwdG8xMCA/IGRvY3VtZW50LmRvY3VtZW50TW9kZSB8fCA2IDogKyhlZGdlIHx8IGllXzExdXApWzFdKTtcbnZhciB3ZWJraXQgPSAhZWRnZSAmJiAvV2ViS2l0XFwvLy50ZXN0KHVzZXJBZ2VudCk7XG52YXIgcXR3ZWJraXQgPSB3ZWJraXQgJiYgL1F0XFwvXFxkK1xcLlxcZCsvLnRlc3QodXNlckFnZW50KTtcbnZhciBjaHJvbWUgPSAhZWRnZSAmJiAvQ2hyb21lXFwvLy50ZXN0KHVzZXJBZ2VudCk7XG52YXIgcHJlc3RvID0gL09wZXJhXFwvLy50ZXN0KHVzZXJBZ2VudCk7XG52YXIgc2FmYXJpID0gL0FwcGxlIENvbXB1dGVyLy50ZXN0KG5hdmlnYXRvci52ZW5kb3IpO1xudmFyIG1hY19nZU1vdW50YWluTGlvbiA9IC9NYWMgT1MgWCAxXFxkXFxEKFs4LTldfFxcZFxcZClcXEQvLnRlc3QodXNlckFnZW50KTtcbnZhciBwaGFudG9tID0gL1BoYW50b21KUy8udGVzdCh1c2VyQWdlbnQpO1xuXG52YXIgaW9zID0gIWVkZ2UgJiYgL0FwcGxlV2ViS2l0Ly50ZXN0KHVzZXJBZ2VudCkgJiYgL01vYmlsZVxcL1xcdysvLnRlc3QodXNlckFnZW50KTtcbnZhciBhbmRyb2lkID0gL0FuZHJvaWQvLnRlc3QodXNlckFnZW50KTtcbi8vIFRoaXMgaXMgd29lZnVsbHkgaW5jb21wbGV0ZS4gU3VnZ2VzdGlvbnMgZm9yIGFsdGVybmF0aXZlIG1ldGhvZHMgd2VsY29tZS5cbnZhciBtb2JpbGUgPSBpb3MgfHwgYW5kcm9pZCB8fCAvd2ViT1N8QmxhY2tCZXJyeXxPcGVyYSBNaW5pfE9wZXJhIE1vYml8SUVNb2JpbGUvaS50ZXN0KHVzZXJBZ2VudCk7XG52YXIgbWFjID0gaW9zIHx8IC9NYWMvLnRlc3QocGxhdGZvcm0pO1xudmFyIGNocm9tZU9TID0gL1xcYkNyT1NcXGIvLnRlc3QodXNlckFnZW50KTtcbnZhciB3aW5kb3dzID0gL3dpbi9pLnRlc3QocGxhdGZvcm0pO1xuXG52YXIgcHJlc3RvX3ZlcnNpb24gPSBwcmVzdG8gJiYgdXNlckFnZW50Lm1hdGNoKC9WZXJzaW9uXFwvKFxcZCpcXC5cXGQqKS8pO1xuaWYgKHByZXN0b192ZXJzaW9uKSB7IHByZXN0b192ZXJzaW9uID0gTnVtYmVyKHByZXN0b192ZXJzaW9uWzFdKTsgfVxuaWYgKHByZXN0b192ZXJzaW9uICYmIHByZXN0b192ZXJzaW9uID49IDE1KSB7IHByZXN0byA9IGZhbHNlOyB3ZWJraXQgPSB0cnVlOyB9XG4vLyBTb21lIGJyb3dzZXJzIHVzZSB0aGUgd3JvbmcgZXZlbnQgcHJvcGVydGllcyB0byBzaWduYWwgY21kL2N0cmwgb24gT1MgWFxudmFyIGZsaXBDdHJsQ21kID0gbWFjICYmIChxdHdlYmtpdCB8fCBwcmVzdG8gJiYgKHByZXN0b192ZXJzaW9uID09IG51bGwgfHwgcHJlc3RvX3ZlcnNpb24gPCAxMi4xMSkpO1xudmFyIGNhcHR1cmVSaWdodENsaWNrID0gZ2Vja28gfHwgKGllICYmIGllX3ZlcnNpb24gPj0gOSk7XG5cbmZ1bmN0aW9uIGNsYXNzVGVzdChjbHMpIHsgcmV0dXJuIG5ldyBSZWdFeHAoXCIoXnxcXFxccylcIiArIGNscyArIFwiKD86JHxcXFxccylcXFxccypcIikgfVxuXG52YXIgcm1DbGFzcyA9IGZ1bmN0aW9uKG5vZGUsIGNscykge1xuICB2YXIgY3VycmVudCA9IG5vZGUuY2xhc3NOYW1lO1xuICB2YXIgbWF0Y2ggPSBjbGFzc1Rlc3QoY2xzKS5leGVjKGN1cnJlbnQpO1xuICBpZiAobWF0Y2gpIHtcbiAgICB2YXIgYWZ0ZXIgPSBjdXJyZW50LnNsaWNlKG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoKTtcbiAgICBub2RlLmNsYXNzTmFtZSA9IGN1cnJlbnQuc2xpY2UoMCwgbWF0Y2guaW5kZXgpICsgKGFmdGVyID8gbWF0Y2hbMV0gKyBhZnRlciA6IFwiXCIpO1xuICB9XG59O1xuXG5mdW5jdGlvbiByZW1vdmVDaGlsZHJlbihlKSB7XG4gIGZvciAodmFyIGNvdW50ID0gZS5jaGlsZE5vZGVzLmxlbmd0aDsgY291bnQgPiAwOyAtLWNvdW50KVxuICAgIHsgZS5yZW1vdmVDaGlsZChlLmZpcnN0Q2hpbGQpOyB9XG4gIHJldHVybiBlXG59XG5cbmZ1bmN0aW9uIHJlbW92ZUNoaWxkcmVuQW5kQWRkKHBhcmVudCwgZSkge1xuICByZXR1cm4gcmVtb3ZlQ2hpbGRyZW4ocGFyZW50KS5hcHBlbmRDaGlsZChlKVxufVxuXG5mdW5jdGlvbiBlbHQodGFnLCBjb250ZW50LCBjbGFzc05hbWUsIHN0eWxlKSB7XG4gIHZhciBlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpO1xuICBpZiAoY2xhc3NOYW1lKSB7IGUuY2xhc3NOYW1lID0gY2xhc3NOYW1lOyB9XG4gIGlmIChzdHlsZSkgeyBlLnN0eWxlLmNzc1RleHQgPSBzdHlsZTsgfVxuICBpZiAodHlwZW9mIGNvbnRlbnQgPT0gXCJzdHJpbmdcIikgeyBlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNvbnRlbnQpKTsgfVxuICBlbHNlIGlmIChjb250ZW50KSB7IGZvciAodmFyIGkgPSAwOyBpIDwgY29udGVudC5sZW5ndGg7ICsraSkgeyBlLmFwcGVuZENoaWxkKGNvbnRlbnRbaV0pOyB9IH1cbiAgcmV0dXJuIGVcbn1cbi8vIHdyYXBwZXIgZm9yIGVsdCwgd2hpY2ggcmVtb3ZlcyB0aGUgZWx0IGZyb20gdGhlIGFjY2Vzc2liaWxpdHkgdHJlZVxuZnVuY3Rpb24gZWx0UCh0YWcsIGNvbnRlbnQsIGNsYXNzTmFtZSwgc3R5bGUpIHtcbiAgdmFyIGUgPSBlbHQodGFnLCBjb250ZW50LCBjbGFzc05hbWUsIHN0eWxlKTtcbiAgZS5zZXRBdHRyaWJ1dGUoXCJyb2xlXCIsIFwicHJlc2VudGF0aW9uXCIpO1xuICByZXR1cm4gZVxufVxuXG52YXIgcmFuZ2U7XG5pZiAoZG9jdW1lbnQuY3JlYXRlUmFuZ2UpIHsgcmFuZ2UgPSBmdW5jdGlvbihub2RlLCBzdGFydCwgZW5kLCBlbmROb2RlKSB7XG4gIHZhciByID0gZG9jdW1lbnQuY3JlYXRlUmFuZ2UoKTtcbiAgci5zZXRFbmQoZW5kTm9kZSB8fCBub2RlLCBlbmQpO1xuICByLnNldFN0YXJ0KG5vZGUsIHN0YXJ0KTtcbiAgcmV0dXJuIHJcbn07IH1cbmVsc2UgeyByYW5nZSA9IGZ1bmN0aW9uKG5vZGUsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHIgPSBkb2N1bWVudC5ib2R5LmNyZWF0ZVRleHRSYW5nZSgpO1xuICB0cnkgeyByLm1vdmVUb0VsZW1lbnRUZXh0KG5vZGUucGFyZW50Tm9kZSk7IH1cbiAgY2F0Y2goZSkgeyByZXR1cm4gciB9XG4gIHIuY29sbGFwc2UodHJ1ZSk7XG4gIHIubW92ZUVuZChcImNoYXJhY3RlclwiLCBlbmQpO1xuICByLm1vdmVTdGFydChcImNoYXJhY3RlclwiLCBzdGFydCk7XG4gIHJldHVybiByXG59OyB9XG5cbmZ1bmN0aW9uIGNvbnRhaW5zKHBhcmVudCwgY2hpbGQpIHtcbiAgaWYgKGNoaWxkLm5vZGVUeXBlID09IDMpIC8vIEFuZHJvaWQgYnJvd3NlciBhbHdheXMgcmV0dXJucyBmYWxzZSB3aGVuIGNoaWxkIGlzIGEgdGV4dG5vZGVcbiAgICB7IGNoaWxkID0gY2hpbGQucGFyZW50Tm9kZTsgfVxuICBpZiAocGFyZW50LmNvbnRhaW5zKVxuICAgIHsgcmV0dXJuIHBhcmVudC5jb250YWlucyhjaGlsZCkgfVxuICBkbyB7XG4gICAgaWYgKGNoaWxkLm5vZGVUeXBlID09IDExKSB7IGNoaWxkID0gY2hpbGQuaG9zdDsgfVxuICAgIGlmIChjaGlsZCA9PSBwYXJlbnQpIHsgcmV0dXJuIHRydWUgfVxuICB9IHdoaWxlIChjaGlsZCA9IGNoaWxkLnBhcmVudE5vZGUpXG59XG5cbmZ1bmN0aW9uIGFjdGl2ZUVsdCgpIHtcbiAgLy8gSUUgYW5kIEVkZ2UgbWF5IHRocm93IGFuIFwiVW5zcGVjaWZpZWQgRXJyb3JcIiB3aGVuIGFjY2Vzc2luZyBkb2N1bWVudC5hY3RpdmVFbGVtZW50LlxuICAvLyBJRSA8IDEwIHdpbGwgdGhyb3cgd2hlbiBhY2Nlc3NlZCB3aGlsZSB0aGUgcGFnZSBpcyBsb2FkaW5nIG9yIGluIGFuIGlmcmFtZS5cbiAgLy8gSUUgPiA5IGFuZCBFZGdlIHdpbGwgdGhyb3cgd2hlbiBhY2Nlc3NlZCBpbiBhbiBpZnJhbWUgaWYgZG9jdW1lbnQuYm9keSBpcyB1bmF2YWlsYWJsZS5cbiAgdmFyIGFjdGl2ZUVsZW1lbnQ7XG4gIHRyeSB7XG4gICAgYWN0aXZlRWxlbWVudCA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIH0gY2F0Y2goZSkge1xuICAgIGFjdGl2ZUVsZW1lbnQgPSBkb2N1bWVudC5ib2R5IHx8IG51bGw7XG4gIH1cbiAgd2hpbGUgKGFjdGl2ZUVsZW1lbnQgJiYgYWN0aXZlRWxlbWVudC5zaGFkb3dSb290ICYmIGFjdGl2ZUVsZW1lbnQuc2hhZG93Um9vdC5hY3RpdmVFbGVtZW50KVxuICAgIHsgYWN0aXZlRWxlbWVudCA9IGFjdGl2ZUVsZW1lbnQuc2hhZG93Um9vdC5hY3RpdmVFbGVtZW50OyB9XG4gIHJldHVybiBhY3RpdmVFbGVtZW50XG59XG5cbmZ1bmN0aW9uIGFkZENsYXNzKG5vZGUsIGNscykge1xuICB2YXIgY3VycmVudCA9IG5vZGUuY2xhc3NOYW1lO1xuICBpZiAoIWNsYXNzVGVzdChjbHMpLnRlc3QoY3VycmVudCkpIHsgbm9kZS5jbGFzc05hbWUgKz0gKGN1cnJlbnQgPyBcIiBcIiA6IFwiXCIpICsgY2xzOyB9XG59XG5mdW5jdGlvbiBqb2luQ2xhc3NlcyhhLCBiKSB7XG4gIHZhciBhcyA9IGEuc3BsaXQoXCIgXCIpO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGFzLmxlbmd0aDsgaSsrKVxuICAgIHsgaWYgKGFzW2ldICYmICFjbGFzc1Rlc3QoYXNbaV0pLnRlc3QoYikpIHsgYiArPSBcIiBcIiArIGFzW2ldOyB9IH1cbiAgcmV0dXJuIGJcbn1cblxudmFyIHNlbGVjdElucHV0ID0gZnVuY3Rpb24obm9kZSkgeyBub2RlLnNlbGVjdCgpOyB9O1xuaWYgKGlvcykgLy8gTW9iaWxlIFNhZmFyaSBhcHBhcmVudGx5IGhhcyBhIGJ1ZyB3aGVyZSBzZWxlY3QoKSBpcyBicm9rZW4uXG4gIHsgc2VsZWN0SW5wdXQgPSBmdW5jdGlvbihub2RlKSB7IG5vZGUuc2VsZWN0aW9uU3RhcnQgPSAwOyBub2RlLnNlbGVjdGlvbkVuZCA9IG5vZGUudmFsdWUubGVuZ3RoOyB9OyB9XG5lbHNlIGlmIChpZSkgLy8gU3VwcHJlc3MgbXlzdGVyaW91cyBJRTEwIGVycm9yc1xuICB7IHNlbGVjdElucHV0ID0gZnVuY3Rpb24obm9kZSkgeyB0cnkgeyBub2RlLnNlbGVjdCgpOyB9IGNhdGNoKF9lKSB7fSB9OyB9XG5cbmZ1bmN0aW9uIGJpbmQoZikge1xuICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gIHJldHVybiBmdW5jdGlvbigpe3JldHVybiBmLmFwcGx5KG51bGwsIGFyZ3MpfVxufVxuXG5mdW5jdGlvbiBjb3B5T2JqKG9iaiwgdGFyZ2V0LCBvdmVyd3JpdGUpIHtcbiAgaWYgKCF0YXJnZXQpIHsgdGFyZ2V0ID0ge307IH1cbiAgZm9yICh2YXIgcHJvcCBpbiBvYmopXG4gICAgeyBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3ApICYmIChvdmVyd3JpdGUgIT09IGZhbHNlIHx8ICF0YXJnZXQuaGFzT3duUHJvcGVydHkocHJvcCkpKVxuICAgICAgeyB0YXJnZXRbcHJvcF0gPSBvYmpbcHJvcF07IH0gfVxuICByZXR1cm4gdGFyZ2V0XG59XG5cbi8vIENvdW50cyB0aGUgY29sdW1uIG9mZnNldCBpbiBhIHN0cmluZywgdGFraW5nIHRhYnMgaW50byBhY2NvdW50LlxuLy8gVXNlZCBtb3N0bHkgdG8gZmluZCBpbmRlbnRhdGlvbi5cbmZ1bmN0aW9uIGNvdW50Q29sdW1uKHN0cmluZywgZW5kLCB0YWJTaXplLCBzdGFydEluZGV4LCBzdGFydFZhbHVlKSB7XG4gIGlmIChlbmQgPT0gbnVsbCkge1xuICAgIGVuZCA9IHN0cmluZy5zZWFyY2goL1teXFxzXFx1MDBhMF0vKTtcbiAgICBpZiAoZW5kID09IC0xKSB7IGVuZCA9IHN0cmluZy5sZW5ndGg7IH1cbiAgfVxuICBmb3IgKHZhciBpID0gc3RhcnRJbmRleCB8fCAwLCBuID0gc3RhcnRWYWx1ZSB8fCAwOzspIHtcbiAgICB2YXIgbmV4dFRhYiA9IHN0cmluZy5pbmRleE9mKFwiXFx0XCIsIGkpO1xuICAgIGlmIChuZXh0VGFiIDwgMCB8fCBuZXh0VGFiID49IGVuZClcbiAgICAgIHsgcmV0dXJuIG4gKyAoZW5kIC0gaSkgfVxuICAgIG4gKz0gbmV4dFRhYiAtIGk7XG4gICAgbiArPSB0YWJTaXplIC0gKG4gJSB0YWJTaXplKTtcbiAgICBpID0gbmV4dFRhYiArIDE7XG4gIH1cbn1cblxudmFyIERlbGF5ZWQgPSBmdW5jdGlvbigpIHt0aGlzLmlkID0gbnVsbDt9O1xuRGVsYXllZC5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKG1zLCBmKSB7XG4gIGNsZWFyVGltZW91dCh0aGlzLmlkKTtcbiAgdGhpcy5pZCA9IHNldFRpbWVvdXQoZiwgbXMpO1xufTtcblxuZnVuY3Rpb24gaW5kZXhPZihhcnJheSwgZWx0KSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyArK2kpXG4gICAgeyBpZiAoYXJyYXlbaV0gPT0gZWx0KSB7IHJldHVybiBpIH0gfVxuICByZXR1cm4gLTFcbn1cblxuLy8gTnVtYmVyIG9mIHBpeGVscyBhZGRlZCB0byBzY3JvbGxlciBhbmQgc2l6ZXIgdG8gaGlkZSBzY3JvbGxiYXJcbnZhciBzY3JvbGxlckdhcCA9IDMwO1xuXG4vLyBSZXR1cm5lZCBvciB0aHJvd24gYnkgdmFyaW91cyBwcm90b2NvbHMgdG8gc2lnbmFsICdJJ20gbm90XG4vLyBoYW5kbGluZyB0aGlzJy5cbnZhciBQYXNzID0ge3RvU3RyaW5nOiBmdW5jdGlvbigpe3JldHVybiBcIkNvZGVNaXJyb3IuUGFzc1wifX07XG5cbi8vIFJldXNlZCBvcHRpb24gb2JqZWN0cyBmb3Igc2V0U2VsZWN0aW9uICYgZnJpZW5kc1xudmFyIHNlbF9kb250U2Nyb2xsID0ge3Njcm9sbDogZmFsc2V9O1xudmFyIHNlbF9tb3VzZSA9IHtvcmlnaW46IFwiKm1vdXNlXCJ9O1xudmFyIHNlbF9tb3ZlID0ge29yaWdpbjogXCIrbW92ZVwifTtcblxuLy8gVGhlIGludmVyc2Ugb2YgY291bnRDb2x1bW4gLS0gZmluZCB0aGUgb2Zmc2V0IHRoYXQgY29ycmVzcG9uZHMgdG9cbi8vIGEgcGFydGljdWxhciBjb2x1bW4uXG5mdW5jdGlvbiBmaW5kQ29sdW1uKHN0cmluZywgZ29hbCwgdGFiU2l6ZSkge1xuICBmb3IgKHZhciBwb3MgPSAwLCBjb2wgPSAwOzspIHtcbiAgICB2YXIgbmV4dFRhYiA9IHN0cmluZy5pbmRleE9mKFwiXFx0XCIsIHBvcyk7XG4gICAgaWYgKG5leHRUYWIgPT0gLTEpIHsgbmV4dFRhYiA9IHN0cmluZy5sZW5ndGg7IH1cbiAgICB2YXIgc2tpcHBlZCA9IG5leHRUYWIgLSBwb3M7XG4gICAgaWYgKG5leHRUYWIgPT0gc3RyaW5nLmxlbmd0aCB8fCBjb2wgKyBza2lwcGVkID49IGdvYWwpXG4gICAgICB7IHJldHVybiBwb3MgKyBNYXRoLm1pbihza2lwcGVkLCBnb2FsIC0gY29sKSB9XG4gICAgY29sICs9IG5leHRUYWIgLSBwb3M7XG4gICAgY29sICs9IHRhYlNpemUgLSAoY29sICUgdGFiU2l6ZSk7XG4gICAgcG9zID0gbmV4dFRhYiArIDE7XG4gICAgaWYgKGNvbCA+PSBnb2FsKSB7IHJldHVybiBwb3MgfVxuICB9XG59XG5cbnZhciBzcGFjZVN0cnMgPSBbXCJcIl07XG5mdW5jdGlvbiBzcGFjZVN0cihuKSB7XG4gIHdoaWxlIChzcGFjZVN0cnMubGVuZ3RoIDw9IG4pXG4gICAgeyBzcGFjZVN0cnMucHVzaChsc3Qoc3BhY2VTdHJzKSArIFwiIFwiKTsgfVxuICByZXR1cm4gc3BhY2VTdHJzW25dXG59XG5cbmZ1bmN0aW9uIGxzdChhcnIpIHsgcmV0dXJuIGFyclthcnIubGVuZ3RoLTFdIH1cblxuZnVuY3Rpb24gbWFwKGFycmF5LCBmKSB7XG4gIHZhciBvdXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykgeyBvdXRbaV0gPSBmKGFycmF5W2ldLCBpKTsgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIGluc2VydFNvcnRlZChhcnJheSwgdmFsdWUsIHNjb3JlKSB7XG4gIHZhciBwb3MgPSAwLCBwcmlvcml0eSA9IHNjb3JlKHZhbHVlKTtcbiAgd2hpbGUgKHBvcyA8IGFycmF5Lmxlbmd0aCAmJiBzY29yZShhcnJheVtwb3NdKSA8PSBwcmlvcml0eSkgeyBwb3MrKzsgfVxuICBhcnJheS5zcGxpY2UocG9zLCAwLCB2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIG5vdGhpbmcoKSB7fVxuXG5mdW5jdGlvbiBjcmVhdGVPYmooYmFzZSwgcHJvcHMpIHtcbiAgdmFyIGluc3Q7XG4gIGlmIChPYmplY3QuY3JlYXRlKSB7XG4gICAgaW5zdCA9IE9iamVjdC5jcmVhdGUoYmFzZSk7XG4gIH0gZWxzZSB7XG4gICAgbm90aGluZy5wcm90b3R5cGUgPSBiYXNlO1xuICAgIGluc3QgPSBuZXcgbm90aGluZygpO1xuICB9XG4gIGlmIChwcm9wcykgeyBjb3B5T2JqKHByb3BzLCBpbnN0KTsgfVxuICByZXR1cm4gaW5zdFxufVxuXG52YXIgbm9uQVNDSUlTaW5nbGVDYXNlV29yZENoYXIgPSAvW1xcdTAwZGZcXHUwNTg3XFx1MDU5MC1cXHUwNWY0XFx1MDYwMC1cXHUwNmZmXFx1MzA0MC1cXHUzMDlmXFx1MzBhMC1cXHUzMGZmXFx1MzQwMC1cXHU0ZGI1XFx1NGUwMC1cXHU5ZmNjXFx1YWMwMC1cXHVkN2FmXS87XG5mdW5jdGlvbiBpc1dvcmRDaGFyQmFzaWMoY2gpIHtcbiAgcmV0dXJuIC9cXHcvLnRlc3QoY2gpIHx8IGNoID4gXCJcXHg4MFwiICYmXG4gICAgKGNoLnRvVXBwZXJDYXNlKCkgIT0gY2gudG9Mb3dlckNhc2UoKSB8fCBub25BU0NJSVNpbmdsZUNhc2VXb3JkQ2hhci50ZXN0KGNoKSlcbn1cbmZ1bmN0aW9uIGlzV29yZENoYXIoY2gsIGhlbHBlcikge1xuICBpZiAoIWhlbHBlcikgeyByZXR1cm4gaXNXb3JkQ2hhckJhc2ljKGNoKSB9XG4gIGlmIChoZWxwZXIuc291cmNlLmluZGV4T2YoXCJcXFxcd1wiKSA+IC0xICYmIGlzV29yZENoYXJCYXNpYyhjaCkpIHsgcmV0dXJuIHRydWUgfVxuICByZXR1cm4gaGVscGVyLnRlc3QoY2gpXG59XG5cbmZ1bmN0aW9uIGlzRW1wdHkob2JqKSB7XG4gIGZvciAodmFyIG4gaW4gb2JqKSB7IGlmIChvYmouaGFzT3duUHJvcGVydHkobikgJiYgb2JqW25dKSB7IHJldHVybiBmYWxzZSB9IH1cbiAgcmV0dXJuIHRydWVcbn1cblxuLy8gRXh0ZW5kaW5nIHVuaWNvZGUgY2hhcmFjdGVycy4gQSBzZXJpZXMgb2YgYSBub24tZXh0ZW5kaW5nIGNoYXIgK1xuLy8gYW55IG51bWJlciBvZiBleHRlbmRpbmcgY2hhcnMgaXMgdHJlYXRlZCBhcyBhIHNpbmdsZSB1bml0IGFzIGZhclxuLy8gYXMgZWRpdGluZyBhbmQgbWVhc3VyaW5nIGlzIGNvbmNlcm5lZC4gVGhpcyBpcyBub3QgZnVsbHkgY29ycmVjdCxcbi8vIHNpbmNlIHNvbWUgc2NyaXB0cy9mb250cy9icm93c2VycyBhbHNvIHRyZWF0IG90aGVyIGNvbmZpZ3VyYXRpb25zXG4vLyBvZiBjb2RlIHBvaW50cyBhcyBhIGdyb3VwLlxudmFyIGV4dGVuZGluZ0NoYXJzID0gL1tcXHUwMzAwLVxcdTAzNmZcXHUwNDgzLVxcdTA0ODlcXHUwNTkxLVxcdTA1YmRcXHUwNWJmXFx1MDVjMVxcdTA1YzJcXHUwNWM0XFx1MDVjNVxcdTA1YzdcXHUwNjEwLVxcdTA2MWFcXHUwNjRiLVxcdTA2NWVcXHUwNjcwXFx1MDZkNi1cXHUwNmRjXFx1MDZkZS1cXHUwNmU0XFx1MDZlN1xcdTA2ZThcXHUwNmVhLVxcdTA2ZWRcXHUwNzExXFx1MDczMC1cXHUwNzRhXFx1MDdhNi1cXHUwN2IwXFx1MDdlYi1cXHUwN2YzXFx1MDgxNi1cXHUwODE5XFx1MDgxYi1cXHUwODIzXFx1MDgyNS1cXHUwODI3XFx1MDgyOS1cXHUwODJkXFx1MDkwMC1cXHUwOTAyXFx1MDkzY1xcdTA5NDEtXFx1MDk0OFxcdTA5NGRcXHUwOTUxLVxcdTA5NTVcXHUwOTYyXFx1MDk2M1xcdTA5ODFcXHUwOWJjXFx1MDliZVxcdTA5YzEtXFx1MDljNFxcdTA5Y2RcXHUwOWQ3XFx1MDllMlxcdTA5ZTNcXHUwYTAxXFx1MGEwMlxcdTBhM2NcXHUwYTQxXFx1MGE0MlxcdTBhNDdcXHUwYTQ4XFx1MGE0Yi1cXHUwYTRkXFx1MGE1MVxcdTBhNzBcXHUwYTcxXFx1MGE3NVxcdTBhODFcXHUwYTgyXFx1MGFiY1xcdTBhYzEtXFx1MGFjNVxcdTBhYzdcXHUwYWM4XFx1MGFjZFxcdTBhZTJcXHUwYWUzXFx1MGIwMVxcdTBiM2NcXHUwYjNlXFx1MGIzZlxcdTBiNDEtXFx1MGI0NFxcdTBiNGRcXHUwYjU2XFx1MGI1N1xcdTBiNjJcXHUwYjYzXFx1MGI4MlxcdTBiYmVcXHUwYmMwXFx1MGJjZFxcdTBiZDdcXHUwYzNlLVxcdTBjNDBcXHUwYzQ2LVxcdTBjNDhcXHUwYzRhLVxcdTBjNGRcXHUwYzU1XFx1MGM1NlxcdTBjNjJcXHUwYzYzXFx1MGNiY1xcdTBjYmZcXHUwY2MyXFx1MGNjNlxcdTBjY2NcXHUwY2NkXFx1MGNkNVxcdTBjZDZcXHUwY2UyXFx1MGNlM1xcdTBkM2VcXHUwZDQxLVxcdTBkNDRcXHUwZDRkXFx1MGQ1N1xcdTBkNjJcXHUwZDYzXFx1MGRjYVxcdTBkY2ZcXHUwZGQyLVxcdTBkZDRcXHUwZGQ2XFx1MGRkZlxcdTBlMzFcXHUwZTM0LVxcdTBlM2FcXHUwZTQ3LVxcdTBlNGVcXHUwZWIxXFx1MGViNC1cXHUwZWI5XFx1MGViYlxcdTBlYmNcXHUwZWM4LVxcdTBlY2RcXHUwZjE4XFx1MGYxOVxcdTBmMzVcXHUwZjM3XFx1MGYzOVxcdTBmNzEtXFx1MGY3ZVxcdTBmODAtXFx1MGY4NFxcdTBmODZcXHUwZjg3XFx1MGY5MC1cXHUwZjk3XFx1MGY5OS1cXHUwZmJjXFx1MGZjNlxcdTEwMmQtXFx1MTAzMFxcdTEwMzItXFx1MTAzN1xcdTEwMzlcXHUxMDNhXFx1MTAzZFxcdTEwM2VcXHUxMDU4XFx1MTA1OVxcdTEwNWUtXFx1MTA2MFxcdTEwNzEtXFx1MTA3NFxcdTEwODJcXHUxMDg1XFx1MTA4NlxcdTEwOGRcXHUxMDlkXFx1MTM1ZlxcdTE3MTItXFx1MTcxNFxcdTE3MzItXFx1MTczNFxcdTE3NTJcXHUxNzUzXFx1MTc3MlxcdTE3NzNcXHUxN2I3LVxcdTE3YmRcXHUxN2M2XFx1MTdjOS1cXHUxN2QzXFx1MTdkZFxcdTE4MGItXFx1MTgwZFxcdTE4YTlcXHUxOTIwLVxcdTE5MjJcXHUxOTI3XFx1MTkyOFxcdTE5MzJcXHUxOTM5LVxcdTE5M2JcXHUxYTE3XFx1MWExOFxcdTFhNTZcXHUxYTU4LVxcdTFhNWVcXHUxYTYwXFx1MWE2MlxcdTFhNjUtXFx1MWE2Y1xcdTFhNzMtXFx1MWE3Y1xcdTFhN2ZcXHUxYjAwLVxcdTFiMDNcXHUxYjM0XFx1MWIzNi1cXHUxYjNhXFx1MWIzY1xcdTFiNDJcXHUxYjZiLVxcdTFiNzNcXHUxYjgwXFx1MWI4MVxcdTFiYTItXFx1MWJhNVxcdTFiYThcXHUxYmE5XFx1MWMyYy1cXHUxYzMzXFx1MWMzNlxcdTFjMzdcXHUxY2QwLVxcdTFjZDJcXHUxY2Q0LVxcdTFjZTBcXHUxY2UyLVxcdTFjZThcXHUxY2VkXFx1MWRjMC1cXHUxZGU2XFx1MWRmZC1cXHUxZGZmXFx1MjAwY1xcdTIwMGRcXHUyMGQwLVxcdTIwZjBcXHUyY2VmLVxcdTJjZjFcXHUyZGUwLVxcdTJkZmZcXHUzMDJhLVxcdTMwMmZcXHUzMDk5XFx1MzA5YVxcdWE2NmYtXFx1YTY3MlxcdWE2N2NcXHVhNjdkXFx1YTZmMFxcdWE2ZjFcXHVhODAyXFx1YTgwNlxcdWE4MGJcXHVhODI1XFx1YTgyNlxcdWE4YzRcXHVhOGUwLVxcdWE4ZjFcXHVhOTI2LVxcdWE5MmRcXHVhOTQ3LVxcdWE5NTFcXHVhOTgwLVxcdWE5ODJcXHVhOWIzXFx1YTliNi1cXHVhOWI5XFx1YTliY1xcdWFhMjktXFx1YWEyZVxcdWFhMzFcXHVhYTMyXFx1YWEzNVxcdWFhMzZcXHVhYTQzXFx1YWE0Y1xcdWFhYjBcXHVhYWIyLVxcdWFhYjRcXHVhYWI3XFx1YWFiOFxcdWFhYmVcXHVhYWJmXFx1YWFjMVxcdWFiZTVcXHVhYmU4XFx1YWJlZFxcdWRjMDAtXFx1ZGZmZlxcdWZiMWVcXHVmZTAwLVxcdWZlMGZcXHVmZTIwLVxcdWZlMjZcXHVmZjllXFx1ZmY5Zl0vO1xuZnVuY3Rpb24gaXNFeHRlbmRpbmdDaGFyKGNoKSB7IHJldHVybiBjaC5jaGFyQ29kZUF0KDApID49IDc2OCAmJiBleHRlbmRpbmdDaGFycy50ZXN0KGNoKSB9XG5cbi8vIFJldHVybnMgYSBudW1iZXIgZnJvbSB0aGUgcmFuZ2UgW2AwYDsgYHN0ci5sZW5ndGhgXSB1bmxlc3MgYHBvc2AgaXMgb3V0c2lkZSB0aGF0IHJhbmdlLlxuZnVuY3Rpb24gc2tpcEV4dGVuZGluZ0NoYXJzKHN0ciwgcG9zLCBkaXIpIHtcbiAgd2hpbGUgKChkaXIgPCAwID8gcG9zID4gMCA6IHBvcyA8IHN0ci5sZW5ndGgpICYmIGlzRXh0ZW5kaW5nQ2hhcihzdHIuY2hhckF0KHBvcykpKSB7IHBvcyArPSBkaXI7IH1cbiAgcmV0dXJuIHBvc1xufVxuXG4vLyBSZXR1cm5zIHRoZSB2YWx1ZSBmcm9tIHRoZSByYW5nZSBbYGZyb21gOyBgdG9gXSB0aGF0IHNhdGlzZmllc1xuLy8gYHByZWRgIGFuZCBpcyBjbG9zZXN0IHRvIGBmcm9tYC4gQXNzdW1lcyB0aGF0IGF0IGxlYXN0IGB0b2Bcbi8vIHNhdGlzZmllcyBgcHJlZGAuIFN1cHBvcnRzIGBmcm9tYCBiZWluZyBncmVhdGVyIHRoYW4gYHRvYC5cbmZ1bmN0aW9uIGZpbmRGaXJzdChwcmVkLCBmcm9tLCB0bykge1xuICAvLyBBdCBhbnkgcG9pbnQgd2UgYXJlIGNlcnRhaW4gYHRvYCBzYXRpc2ZpZXMgYHByZWRgLCBkb24ndCBrbm93XG4gIC8vIHdoZXRoZXIgYGZyb21gIGRvZXMuXG4gIHZhciBkaXIgPSBmcm9tID4gdG8gPyAtMSA6IDE7XG4gIGZvciAoOzspIHtcbiAgICBpZiAoZnJvbSA9PSB0bykgeyByZXR1cm4gZnJvbSB9XG4gICAgdmFyIG1pZEYgPSAoZnJvbSArIHRvKSAvIDIsIG1pZCA9IGRpciA8IDAgPyBNYXRoLmNlaWwobWlkRikgOiBNYXRoLmZsb29yKG1pZEYpO1xuICAgIGlmIChtaWQgPT0gZnJvbSkgeyByZXR1cm4gcHJlZChtaWQpID8gZnJvbSA6IHRvIH1cbiAgICBpZiAocHJlZChtaWQpKSB7IHRvID0gbWlkOyB9XG4gICAgZWxzZSB7IGZyb20gPSBtaWQgKyBkaXI7IH1cbiAgfVxufVxuXG4vLyBUaGUgZGlzcGxheSBoYW5kbGVzIHRoZSBET00gaW50ZWdyYXRpb24sIGJvdGggZm9yIGlucHV0IHJlYWRpbmdcbi8vIGFuZCBjb250ZW50IGRyYXdpbmcuIEl0IGhvbGRzIHJlZmVyZW5jZXMgdG8gRE9NIG5vZGVzIGFuZFxuLy8gZGlzcGxheS1yZWxhdGVkIHN0YXRlLlxuXG5mdW5jdGlvbiBEaXNwbGF5KHBsYWNlLCBkb2MsIGlucHV0KSB7XG4gIHZhciBkID0gdGhpcztcbiAgdGhpcy5pbnB1dCA9IGlucHV0O1xuXG4gIC8vIENvdmVycyBib3R0b20tcmlnaHQgc3F1YXJlIHdoZW4gYm90aCBzY3JvbGxiYXJzIGFyZSBwcmVzZW50LlxuICBkLnNjcm9sbGJhckZpbGxlciA9IGVsdChcImRpdlwiLCBudWxsLCBcIkNvZGVNaXJyb3Itc2Nyb2xsYmFyLWZpbGxlclwiKTtcbiAgZC5zY3JvbGxiYXJGaWxsZXIuc2V0QXR0cmlidXRlKFwiY20tbm90LWNvbnRlbnRcIiwgXCJ0cnVlXCIpO1xuICAvLyBDb3ZlcnMgYm90dG9tIG9mIGd1dHRlciB3aGVuIGNvdmVyR3V0dGVyTmV4dFRvU2Nyb2xsYmFyIGlzIG9uXG4gIC8vIGFuZCBoIHNjcm9sbGJhciBpcyBwcmVzZW50LlxuICBkLmd1dHRlckZpbGxlciA9IGVsdChcImRpdlwiLCBudWxsLCBcIkNvZGVNaXJyb3ItZ3V0dGVyLWZpbGxlclwiKTtcbiAgZC5ndXR0ZXJGaWxsZXIuc2V0QXR0cmlidXRlKFwiY20tbm90LWNvbnRlbnRcIiwgXCJ0cnVlXCIpO1xuICAvLyBXaWxsIGNvbnRhaW4gdGhlIGFjdHVhbCBjb2RlLCBwb3NpdGlvbmVkIHRvIGNvdmVyIHRoZSB2aWV3cG9ydC5cbiAgZC5saW5lRGl2ID0gZWx0UChcImRpdlwiLCBudWxsLCBcIkNvZGVNaXJyb3ItY29kZVwiKTtcbiAgLy8gRWxlbWVudHMgYXJlIGFkZGVkIHRvIHRoZXNlIHRvIHJlcHJlc2VudCBzZWxlY3Rpb24gYW5kIGN1cnNvcnMuXG4gIGQuc2VsZWN0aW9uRGl2ID0gZWx0KFwiZGl2XCIsIG51bGwsIG51bGwsIFwicG9zaXRpb246IHJlbGF0aXZlOyB6LWluZGV4OiAxXCIpO1xuICBkLmN1cnNvckRpdiA9IGVsdChcImRpdlwiLCBudWxsLCBcIkNvZGVNaXJyb3ItY3Vyc29yc1wiKTtcbiAgLy8gQSB2aXNpYmlsaXR5OiBoaWRkZW4gZWxlbWVudCB1c2VkIHRvIGZpbmQgdGhlIHNpemUgb2YgdGhpbmdzLlxuICBkLm1lYXN1cmUgPSBlbHQoXCJkaXZcIiwgbnVsbCwgXCJDb2RlTWlycm9yLW1lYXN1cmVcIik7XG4gIC8vIFdoZW4gbGluZXMgb3V0c2lkZSBvZiB0aGUgdmlld3BvcnQgYXJlIG1lYXN1cmVkLCB0aGV5IGFyZSBkcmF3biBpbiB0aGlzLlxuICBkLmxpbmVNZWFzdXJlID0gZWx0KFwiZGl2XCIsIG51bGwsIFwiQ29kZU1pcnJvci1tZWFzdXJlXCIpO1xuICAvLyBXcmFwcyBldmVyeXRoaW5nIHRoYXQgbmVlZHMgdG8gZXhpc3QgaW5zaWRlIHRoZSB2ZXJ0aWNhbGx5LXBhZGRlZCBjb29yZGluYXRlIHN5c3RlbVxuICBkLmxpbmVTcGFjZSA9IGVsdFAoXCJkaXZcIiwgW2QubWVhc3VyZSwgZC5saW5lTWVhc3VyZSwgZC5zZWxlY3Rpb25EaXYsIGQuY3Vyc29yRGl2LCBkLmxpbmVEaXZdLFxuICAgICAgICAgICAgICAgICAgICBudWxsLCBcInBvc2l0aW9uOiByZWxhdGl2ZTsgb3V0bGluZTogbm9uZVwiKTtcbiAgdmFyIGxpbmVzID0gZWx0UChcImRpdlwiLCBbZC5saW5lU3BhY2VdLCBcIkNvZGVNaXJyb3ItbGluZXNcIik7XG4gIC8vIE1vdmVkIGFyb3VuZCBpdHMgcGFyZW50IHRvIGNvdmVyIHZpc2libGUgdmlldy5cbiAgZC5tb3ZlciA9IGVsdChcImRpdlwiLCBbbGluZXNdLCBudWxsLCBcInBvc2l0aW9uOiByZWxhdGl2ZVwiKTtcbiAgLy8gU2V0IHRvIHRoZSBoZWlnaHQgb2YgdGhlIGRvY3VtZW50LCBhbGxvd2luZyBzY3JvbGxpbmcuXG4gIGQuc2l6ZXIgPSBlbHQoXCJkaXZcIiwgW2QubW92ZXJdLCBcIkNvZGVNaXJyb3Itc2l6ZXJcIik7XG4gIGQuc2l6ZXJXaWR0aCA9IG51bGw7XG4gIC8vIEJlaGF2aW9yIG9mIGVsdHMgd2l0aCBvdmVyZmxvdzogYXV0byBhbmQgcGFkZGluZyBpc1xuICAvLyBpbmNvbnNpc3RlbnQgYWNyb3NzIGJyb3dzZXJzLiBUaGlzIGlzIHVzZWQgdG8gZW5zdXJlIHRoZVxuICAvLyBzY3JvbGxhYmxlIGFyZWEgaXMgYmlnIGVub3VnaC5cbiAgZC5oZWlnaHRGb3JjZXIgPSBlbHQoXCJkaXZcIiwgbnVsbCwgbnVsbCwgXCJwb3NpdGlvbjogYWJzb2x1dGU7IGhlaWdodDogXCIgKyBzY3JvbGxlckdhcCArIFwicHg7IHdpZHRoOiAxcHg7XCIpO1xuICAvLyBXaWxsIGNvbnRhaW4gdGhlIGd1dHRlcnMsIGlmIGFueS5cbiAgZC5ndXR0ZXJzID0gZWx0KFwiZGl2XCIsIG51bGwsIFwiQ29kZU1pcnJvci1ndXR0ZXJzXCIpO1xuICBkLmxpbmVHdXR0ZXIgPSBudWxsO1xuICAvLyBBY3R1YWwgc2Nyb2xsYWJsZSBlbGVtZW50LlxuICBkLnNjcm9sbGVyID0gZWx0KFwiZGl2XCIsIFtkLnNpemVyLCBkLmhlaWdodEZvcmNlciwgZC5ndXR0ZXJzXSwgXCJDb2RlTWlycm9yLXNjcm9sbFwiKTtcbiAgZC5zY3JvbGxlci5zZXRBdHRyaWJ1dGUoXCJ0YWJJbmRleFwiLCBcIi0xXCIpO1xuICAvLyBUaGUgZWxlbWVudCBpbiB3aGljaCB0aGUgZWRpdG9yIGxpdmVzLlxuICBkLndyYXBwZXIgPSBlbHQoXCJkaXZcIiwgW2Quc2Nyb2xsYmFyRmlsbGVyLCBkLmd1dHRlckZpbGxlciwgZC5zY3JvbGxlcl0sIFwiQ29kZU1pcnJvclwiKTtcblxuICAvLyBXb3JrIGFyb3VuZCBJRTcgei1pbmRleCBidWcgKG5vdCBwZXJmZWN0LCBoZW5jZSBJRTcgbm90IHJlYWxseSBiZWluZyBzdXBwb3J0ZWQpXG4gIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgOCkgeyBkLmd1dHRlcnMuc3R5bGUuekluZGV4ID0gLTE7IGQuc2Nyb2xsZXIuc3R5bGUucGFkZGluZ1JpZ2h0ID0gMDsgfVxuICBpZiAoIXdlYmtpdCAmJiAhKGdlY2tvICYmIG1vYmlsZSkpIHsgZC5zY3JvbGxlci5kcmFnZ2FibGUgPSB0cnVlOyB9XG5cbiAgaWYgKHBsYWNlKSB7XG4gICAgaWYgKHBsYWNlLmFwcGVuZENoaWxkKSB7IHBsYWNlLmFwcGVuZENoaWxkKGQud3JhcHBlcik7IH1cbiAgICBlbHNlIHsgcGxhY2UoZC53cmFwcGVyKTsgfVxuICB9XG5cbiAgLy8gQ3VycmVudCByZW5kZXJlZCByYW5nZSAobWF5IGJlIGJpZ2dlciB0aGFuIHRoZSB2aWV3IHdpbmRvdykuXG4gIGQudmlld0Zyb20gPSBkLnZpZXdUbyA9IGRvYy5maXJzdDtcbiAgZC5yZXBvcnRlZFZpZXdGcm9tID0gZC5yZXBvcnRlZFZpZXdUbyA9IGRvYy5maXJzdDtcbiAgLy8gSW5mb3JtYXRpb24gYWJvdXQgdGhlIHJlbmRlcmVkIGxpbmVzLlxuICBkLnZpZXcgPSBbXTtcbiAgZC5yZW5kZXJlZFZpZXcgPSBudWxsO1xuICAvLyBIb2xkcyBpbmZvIGFib3V0IGEgc2luZ2xlIHJlbmRlcmVkIGxpbmUgd2hlbiBpdCB3YXMgcmVuZGVyZWRcbiAgLy8gZm9yIG1lYXN1cmVtZW50LCB3aGlsZSBub3QgaW4gdmlldy5cbiAgZC5leHRlcm5hbE1lYXN1cmVkID0gbnVsbDtcbiAgLy8gRW1wdHkgc3BhY2UgKGluIHBpeGVscykgYWJvdmUgdGhlIHZpZXdcbiAgZC52aWV3T2Zmc2V0ID0gMDtcbiAgZC5sYXN0V3JhcEhlaWdodCA9IGQubGFzdFdyYXBXaWR0aCA9IDA7XG4gIGQudXBkYXRlTGluZU51bWJlcnMgPSBudWxsO1xuXG4gIGQubmF0aXZlQmFyV2lkdGggPSBkLmJhckhlaWdodCA9IGQuYmFyV2lkdGggPSAwO1xuICBkLnNjcm9sbGJhcnNDbGlwcGVkID0gZmFsc2U7XG5cbiAgLy8gVXNlZCB0byBvbmx5IHJlc2l6ZSB0aGUgbGluZSBudW1iZXIgZ3V0dGVyIHdoZW4gbmVjZXNzYXJ5ICh3aGVuXG4gIC8vIHRoZSBhbW91bnQgb2YgbGluZXMgY3Jvc3NlcyBhIGJvdW5kYXJ5IHRoYXQgbWFrZXMgaXRzIHdpZHRoIGNoYW5nZSlcbiAgZC5saW5lTnVtV2lkdGggPSBkLmxpbmVOdW1Jbm5lcldpZHRoID0gZC5saW5lTnVtQ2hhcnMgPSBudWxsO1xuICAvLyBTZXQgdG8gdHJ1ZSB3aGVuIGEgbm9uLWhvcml6b250YWwtc2Nyb2xsaW5nIGxpbmUgd2lkZ2V0IGlzXG4gIC8vIGFkZGVkLiBBcyBhbiBvcHRpbWl6YXRpb24sIGxpbmUgd2lkZ2V0IGFsaWduaW5nIGlzIHNraXBwZWQgd2hlblxuICAvLyB0aGlzIGlzIGZhbHNlLlxuICBkLmFsaWduV2lkZ2V0cyA9IGZhbHNlO1xuXG4gIGQuY2FjaGVkQ2hhcldpZHRoID0gZC5jYWNoZWRUZXh0SGVpZ2h0ID0gZC5jYWNoZWRQYWRkaW5nSCA9IG51bGw7XG5cbiAgLy8gVHJhY2tzIHRoZSBtYXhpbXVtIGxpbmUgbGVuZ3RoIHNvIHRoYXQgdGhlIGhvcml6b250YWwgc2Nyb2xsYmFyXG4gIC8vIGNhbiBiZSBrZXB0IHN0YXRpYyB3aGVuIHNjcm9sbGluZy5cbiAgZC5tYXhMaW5lID0gbnVsbDtcbiAgZC5tYXhMaW5lTGVuZ3RoID0gMDtcbiAgZC5tYXhMaW5lQ2hhbmdlZCA9IGZhbHNlO1xuXG4gIC8vIFVzZWQgZm9yIG1lYXN1cmluZyB3aGVlbCBzY3JvbGxpbmcgZ3JhbnVsYXJpdHlcbiAgZC53aGVlbERYID0gZC53aGVlbERZID0gZC53aGVlbFN0YXJ0WCA9IGQud2hlZWxTdGFydFkgPSBudWxsO1xuXG4gIC8vIFRydWUgd2hlbiBzaGlmdCBpcyBoZWxkIGRvd24uXG4gIGQuc2hpZnQgPSBmYWxzZTtcblxuICAvLyBVc2VkIHRvIHRyYWNrIHdoZXRoZXIgYW55dGhpbmcgaGFwcGVuZWQgc2luY2UgdGhlIGNvbnRleHQgbWVudVxuICAvLyB3YXMgb3BlbmVkLlxuICBkLnNlbEZvckNvbnRleHRNZW51ID0gbnVsbDtcblxuICBkLmFjdGl2ZVRvdWNoID0gbnVsbDtcblxuICBpbnB1dC5pbml0KGQpO1xufVxuXG4vLyBGaW5kIHRoZSBsaW5lIG9iamVjdCBjb3JyZXNwb25kaW5nIHRvIHRoZSBnaXZlbiBsaW5lIG51bWJlci5cbmZ1bmN0aW9uIGdldExpbmUoZG9jLCBuKSB7XG4gIG4gLT0gZG9jLmZpcnN0O1xuICBpZiAobiA8IDAgfHwgbiA+PSBkb2Muc2l6ZSkgeyB0aHJvdyBuZXcgRXJyb3IoXCJUaGVyZSBpcyBubyBsaW5lIFwiICsgKG4gKyBkb2MuZmlyc3QpICsgXCIgaW4gdGhlIGRvY3VtZW50LlwiKSB9XG4gIHZhciBjaHVuayA9IGRvYztcbiAgd2hpbGUgKCFjaHVuay5saW5lcykge1xuICAgIGZvciAodmFyIGkgPSAwOzsgKytpKSB7XG4gICAgICB2YXIgY2hpbGQgPSBjaHVuay5jaGlsZHJlbltpXSwgc3ogPSBjaGlsZC5jaHVua1NpemUoKTtcbiAgICAgIGlmIChuIDwgc3opIHsgY2h1bmsgPSBjaGlsZDsgYnJlYWsgfVxuICAgICAgbiAtPSBzejtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNodW5rLmxpbmVzW25dXG59XG5cbi8vIEdldCB0aGUgcGFydCBvZiBhIGRvY3VtZW50IGJldHdlZW4gdHdvIHBvc2l0aW9ucywgYXMgYW4gYXJyYXkgb2Zcbi8vIHN0cmluZ3MuXG5mdW5jdGlvbiBnZXRCZXR3ZWVuKGRvYywgc3RhcnQsIGVuZCkge1xuICB2YXIgb3V0ID0gW10sIG4gPSBzdGFydC5saW5lO1xuICBkb2MuaXRlcihzdGFydC5saW5lLCBlbmQubGluZSArIDEsIGZ1bmN0aW9uIChsaW5lKSB7XG4gICAgdmFyIHRleHQgPSBsaW5lLnRleHQ7XG4gICAgaWYgKG4gPT0gZW5kLmxpbmUpIHsgdGV4dCA9IHRleHQuc2xpY2UoMCwgZW5kLmNoKTsgfVxuICAgIGlmIChuID09IHN0YXJ0LmxpbmUpIHsgdGV4dCA9IHRleHQuc2xpY2Uoc3RhcnQuY2gpOyB9XG4gICAgb3V0LnB1c2godGV4dCk7XG4gICAgKytuO1xuICB9KTtcbiAgcmV0dXJuIG91dFxufVxuLy8gR2V0IHRoZSBsaW5lcyBiZXR3ZWVuIGZyb20gYW5kIHRvLCBhcyBhcnJheSBvZiBzdHJpbmdzLlxuZnVuY3Rpb24gZ2V0TGluZXMoZG9jLCBmcm9tLCB0bykge1xuICB2YXIgb3V0ID0gW107XG4gIGRvYy5pdGVyKGZyb20sIHRvLCBmdW5jdGlvbiAobGluZSkgeyBvdXQucHVzaChsaW5lLnRleHQpOyB9KTsgLy8gaXRlciBhYm9ydHMgd2hlbiBjYWxsYmFjayByZXR1cm5zIHRydXRoeSB2YWx1ZVxuICByZXR1cm4gb3V0XG59XG5cbi8vIFVwZGF0ZSB0aGUgaGVpZ2h0IG9mIGEgbGluZSwgcHJvcGFnYXRpbmcgdGhlIGhlaWdodCBjaGFuZ2Vcbi8vIHVwd2FyZHMgdG8gcGFyZW50IG5vZGVzLlxuZnVuY3Rpb24gdXBkYXRlTGluZUhlaWdodChsaW5lLCBoZWlnaHQpIHtcbiAgdmFyIGRpZmYgPSBoZWlnaHQgLSBsaW5lLmhlaWdodDtcbiAgaWYgKGRpZmYpIHsgZm9yICh2YXIgbiA9IGxpbmU7IG47IG4gPSBuLnBhcmVudCkgeyBuLmhlaWdodCArPSBkaWZmOyB9IH1cbn1cblxuLy8gR2l2ZW4gYSBsaW5lIG9iamVjdCwgZmluZCBpdHMgbGluZSBudW1iZXIgYnkgd2Fsa2luZyB1cCB0aHJvdWdoXG4vLyBpdHMgcGFyZW50IGxpbmtzLlxuZnVuY3Rpb24gbGluZU5vKGxpbmUpIHtcbiAgaWYgKGxpbmUucGFyZW50ID09IG51bGwpIHsgcmV0dXJuIG51bGwgfVxuICB2YXIgY3VyID0gbGluZS5wYXJlbnQsIG5vID0gaW5kZXhPZihjdXIubGluZXMsIGxpbmUpO1xuICBmb3IgKHZhciBjaHVuayA9IGN1ci5wYXJlbnQ7IGNodW5rOyBjdXIgPSBjaHVuaywgY2h1bmsgPSBjaHVuay5wYXJlbnQpIHtcbiAgICBmb3IgKHZhciBpID0gMDs7ICsraSkge1xuICAgICAgaWYgKGNodW5rLmNoaWxkcmVuW2ldID09IGN1cikgeyBicmVhayB9XG4gICAgICBubyArPSBjaHVuay5jaGlsZHJlbltpXS5jaHVua1NpemUoKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5vICsgY3VyLmZpcnN0XG59XG5cbi8vIEZpbmQgdGhlIGxpbmUgYXQgdGhlIGdpdmVuIHZlcnRpY2FsIHBvc2l0aW9uLCB1c2luZyB0aGUgaGVpZ2h0XG4vLyBpbmZvcm1hdGlvbiBpbiB0aGUgZG9jdW1lbnQgdHJlZS5cbmZ1bmN0aW9uIGxpbmVBdEhlaWdodChjaHVuaywgaCkge1xuICB2YXIgbiA9IGNodW5rLmZpcnN0O1xuICBvdXRlcjogZG8ge1xuICAgIGZvciAodmFyIGkkMSA9IDA7IGkkMSA8IGNodW5rLmNoaWxkcmVuLmxlbmd0aDsgKytpJDEpIHtcbiAgICAgIHZhciBjaGlsZCA9IGNodW5rLmNoaWxkcmVuW2kkMV0sIGNoID0gY2hpbGQuaGVpZ2h0O1xuICAgICAgaWYgKGggPCBjaCkgeyBjaHVuayA9IGNoaWxkOyBjb250aW51ZSBvdXRlciB9XG4gICAgICBoIC09IGNoO1xuICAgICAgbiArPSBjaGlsZC5jaHVua1NpemUoKTtcbiAgICB9XG4gICAgcmV0dXJuIG5cbiAgfSB3aGlsZSAoIWNodW5rLmxpbmVzKVxuICB2YXIgaSA9IDA7XG4gIGZvciAoOyBpIDwgY2h1bmsubGluZXMubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgbGluZSA9IGNodW5rLmxpbmVzW2ldLCBsaCA9IGxpbmUuaGVpZ2h0O1xuICAgIGlmIChoIDwgbGgpIHsgYnJlYWsgfVxuICAgIGggLT0gbGg7XG4gIH1cbiAgcmV0dXJuIG4gKyBpXG59XG5cbmZ1bmN0aW9uIGlzTGluZShkb2MsIGwpIHtyZXR1cm4gbCA+PSBkb2MuZmlyc3QgJiYgbCA8IGRvYy5maXJzdCArIGRvYy5zaXplfVxuXG5mdW5jdGlvbiBsaW5lTnVtYmVyRm9yKG9wdGlvbnMsIGkpIHtcbiAgcmV0dXJuIFN0cmluZyhvcHRpb25zLmxpbmVOdW1iZXJGb3JtYXR0ZXIoaSArIG9wdGlvbnMuZmlyc3RMaW5lTnVtYmVyKSlcbn1cblxuLy8gQSBQb3MgaW5zdGFuY2UgcmVwcmVzZW50cyBhIHBvc2l0aW9uIHdpdGhpbiB0aGUgdGV4dC5cbmZ1bmN0aW9uIFBvcyhsaW5lLCBjaCwgc3RpY2t5KSB7XG4gIGlmICggc3RpY2t5ID09PSB2b2lkIDAgKSBzdGlja3kgPSBudWxsO1xuXG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBQb3MpKSB7IHJldHVybiBuZXcgUG9zKGxpbmUsIGNoLCBzdGlja3kpIH1cbiAgdGhpcy5saW5lID0gbGluZTtcbiAgdGhpcy5jaCA9IGNoO1xuICB0aGlzLnN0aWNreSA9IHN0aWNreTtcbn1cblxuLy8gQ29tcGFyZSB0d28gcG9zaXRpb25zLCByZXR1cm4gMCBpZiB0aGV5IGFyZSB0aGUgc2FtZSwgYSBuZWdhdGl2ZVxuLy8gbnVtYmVyIHdoZW4gYSBpcyBsZXNzLCBhbmQgYSBwb3NpdGl2ZSBudW1iZXIgb3RoZXJ3aXNlLlxuZnVuY3Rpb24gY21wKGEsIGIpIHsgcmV0dXJuIGEubGluZSAtIGIubGluZSB8fCBhLmNoIC0gYi5jaCB9XG5cbmZ1bmN0aW9uIGVxdWFsQ3Vyc29yUG9zKGEsIGIpIHsgcmV0dXJuIGEuc3RpY2t5ID09IGIuc3RpY2t5ICYmIGNtcChhLCBiKSA9PSAwIH1cblxuZnVuY3Rpb24gY29weVBvcyh4KSB7cmV0dXJuIFBvcyh4LmxpbmUsIHguY2gpfVxuZnVuY3Rpb24gbWF4UG9zKGEsIGIpIHsgcmV0dXJuIGNtcChhLCBiKSA8IDAgPyBiIDogYSB9XG5mdW5jdGlvbiBtaW5Qb3MoYSwgYikgeyByZXR1cm4gY21wKGEsIGIpIDwgMCA/IGEgOiBiIH1cblxuLy8gTW9zdCBvZiB0aGUgZXh0ZXJuYWwgQVBJIGNsaXBzIGdpdmVuIHBvc2l0aW9ucyB0byBtYWtlIHN1cmUgdGhleVxuLy8gYWN0dWFsbHkgZXhpc3Qgd2l0aGluIHRoZSBkb2N1bWVudC5cbmZ1bmN0aW9uIGNsaXBMaW5lKGRvYywgbikge3JldHVybiBNYXRoLm1heChkb2MuZmlyc3QsIE1hdGgubWluKG4sIGRvYy5maXJzdCArIGRvYy5zaXplIC0gMSkpfVxuZnVuY3Rpb24gY2xpcFBvcyhkb2MsIHBvcykge1xuICBpZiAocG9zLmxpbmUgPCBkb2MuZmlyc3QpIHsgcmV0dXJuIFBvcyhkb2MuZmlyc3QsIDApIH1cbiAgdmFyIGxhc3QgPSBkb2MuZmlyc3QgKyBkb2Muc2l6ZSAtIDE7XG4gIGlmIChwb3MubGluZSA+IGxhc3QpIHsgcmV0dXJuIFBvcyhsYXN0LCBnZXRMaW5lKGRvYywgbGFzdCkudGV4dC5sZW5ndGgpIH1cbiAgcmV0dXJuIGNsaXBUb0xlbihwb3MsIGdldExpbmUoZG9jLCBwb3MubGluZSkudGV4dC5sZW5ndGgpXG59XG5mdW5jdGlvbiBjbGlwVG9MZW4ocG9zLCBsaW5lbGVuKSB7XG4gIHZhciBjaCA9IHBvcy5jaDtcbiAgaWYgKGNoID09IG51bGwgfHwgY2ggPiBsaW5lbGVuKSB7IHJldHVybiBQb3MocG9zLmxpbmUsIGxpbmVsZW4pIH1cbiAgZWxzZSBpZiAoY2ggPCAwKSB7IHJldHVybiBQb3MocG9zLmxpbmUsIDApIH1cbiAgZWxzZSB7IHJldHVybiBwb3MgfVxufVxuZnVuY3Rpb24gY2xpcFBvc0FycmF5KGRvYywgYXJyYXkpIHtcbiAgdmFyIG91dCA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7IG91dFtpXSA9IGNsaXBQb3MoZG9jLCBhcnJheVtpXSk7IH1cbiAgcmV0dXJuIG91dFxufVxuXG4vLyBPcHRpbWl6ZSBzb21lIGNvZGUgd2hlbiB0aGVzZSBmZWF0dXJlcyBhcmUgbm90IHVzZWQuXG52YXIgc2F3UmVhZE9ubHlTcGFucyA9IGZhbHNlO1xudmFyIHNhd0NvbGxhcHNlZFNwYW5zID0gZmFsc2U7XG5cbmZ1bmN0aW9uIHNlZVJlYWRPbmx5U3BhbnMoKSB7XG4gIHNhd1JlYWRPbmx5U3BhbnMgPSB0cnVlO1xufVxuXG5mdW5jdGlvbiBzZWVDb2xsYXBzZWRTcGFucygpIHtcbiAgc2F3Q29sbGFwc2VkU3BhbnMgPSB0cnVlO1xufVxuXG4vLyBURVhUTUFSS0VSIFNQQU5TXG5cbmZ1bmN0aW9uIE1hcmtlZFNwYW4obWFya2VyLCBmcm9tLCB0bykge1xuICB0aGlzLm1hcmtlciA9IG1hcmtlcjtcbiAgdGhpcy5mcm9tID0gZnJvbTsgdGhpcy50byA9IHRvO1xufVxuXG4vLyBTZWFyY2ggYW4gYXJyYXkgb2Ygc3BhbnMgZm9yIGEgc3BhbiBtYXRjaGluZyB0aGUgZ2l2ZW4gbWFya2VyLlxuZnVuY3Rpb24gZ2V0TWFya2VkU3BhbkZvcihzcGFucywgbWFya2VyKSB7XG4gIGlmIChzcGFucykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHNwYW5zLmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIHNwYW4gPSBzcGFuc1tpXTtcbiAgICBpZiAoc3Bhbi5tYXJrZXIgPT0gbWFya2VyKSB7IHJldHVybiBzcGFuIH1cbiAgfSB9XG59XG4vLyBSZW1vdmUgYSBzcGFuIGZyb20gYW4gYXJyYXksIHJldHVybmluZyB1bmRlZmluZWQgaWYgbm8gc3BhbnMgYXJlXG4vLyBsZWZ0ICh3ZSBkb24ndCBzdG9yZSBhcnJheXMgZm9yIGxpbmVzIHdpdGhvdXQgc3BhbnMpLlxuZnVuY3Rpb24gcmVtb3ZlTWFya2VkU3BhbihzcGFucywgc3Bhbikge1xuICB2YXIgcjtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGFucy5sZW5ndGg7ICsraSlcbiAgICB7IGlmIChzcGFuc1tpXSAhPSBzcGFuKSB7IChyIHx8IChyID0gW10pKS5wdXNoKHNwYW5zW2ldKTsgfSB9XG4gIHJldHVybiByXG59XG4vLyBBZGQgYSBzcGFuIHRvIGEgbGluZS5cbmZ1bmN0aW9uIGFkZE1hcmtlZFNwYW4obGluZSwgc3Bhbikge1xuICBsaW5lLm1hcmtlZFNwYW5zID0gbGluZS5tYXJrZWRTcGFucyA/IGxpbmUubWFya2VkU3BhbnMuY29uY2F0KFtzcGFuXSkgOiBbc3Bhbl07XG4gIHNwYW4ubWFya2VyLmF0dGFjaExpbmUobGluZSk7XG59XG5cbi8vIFVzZWQgZm9yIHRoZSBhbGdvcml0aG0gdGhhdCBhZGp1c3RzIG1hcmtlcnMgZm9yIGEgY2hhbmdlIGluIHRoZVxuLy8gZG9jdW1lbnQuIFRoZXNlIGZ1bmN0aW9ucyBjdXQgYW4gYXJyYXkgb2Ygc3BhbnMgYXQgYSBnaXZlblxuLy8gY2hhcmFjdGVyIHBvc2l0aW9uLCByZXR1cm5pbmcgYW4gYXJyYXkgb2YgcmVtYWluaW5nIGNodW5rcyAob3Jcbi8vIHVuZGVmaW5lZCBpZiBub3RoaW5nIHJlbWFpbnMpLlxuZnVuY3Rpb24gbWFya2VkU3BhbnNCZWZvcmUob2xkLCBzdGFydENoLCBpc0luc2VydCkge1xuICB2YXIgbnc7XG4gIGlmIChvbGQpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBvbGQubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgc3BhbiA9IG9sZFtpXSwgbWFya2VyID0gc3Bhbi5tYXJrZXI7XG4gICAgdmFyIHN0YXJ0c0JlZm9yZSA9IHNwYW4uZnJvbSA9PSBudWxsIHx8IChtYXJrZXIuaW5jbHVzaXZlTGVmdCA/IHNwYW4uZnJvbSA8PSBzdGFydENoIDogc3Bhbi5mcm9tIDwgc3RhcnRDaCk7XG4gICAgaWYgKHN0YXJ0c0JlZm9yZSB8fCBzcGFuLmZyb20gPT0gc3RhcnRDaCAmJiBtYXJrZXIudHlwZSA9PSBcImJvb2ttYXJrXCIgJiYgKCFpc0luc2VydCB8fCAhc3Bhbi5tYXJrZXIuaW5zZXJ0TGVmdCkpIHtcbiAgICAgIHZhciBlbmRzQWZ0ZXIgPSBzcGFuLnRvID09IG51bGwgfHwgKG1hcmtlci5pbmNsdXNpdmVSaWdodCA/IHNwYW4udG8gPj0gc3RhcnRDaCA6IHNwYW4udG8gPiBzdGFydENoKTsobncgfHwgKG53ID0gW10pKS5wdXNoKG5ldyBNYXJrZWRTcGFuKG1hcmtlciwgc3Bhbi5mcm9tLCBlbmRzQWZ0ZXIgPyBudWxsIDogc3Bhbi50bykpO1xuICAgIH1cbiAgfSB9XG4gIHJldHVybiBud1xufVxuZnVuY3Rpb24gbWFya2VkU3BhbnNBZnRlcihvbGQsIGVuZENoLCBpc0luc2VydCkge1xuICB2YXIgbnc7XG4gIGlmIChvbGQpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBvbGQubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgc3BhbiA9IG9sZFtpXSwgbWFya2VyID0gc3Bhbi5tYXJrZXI7XG4gICAgdmFyIGVuZHNBZnRlciA9IHNwYW4udG8gPT0gbnVsbCB8fCAobWFya2VyLmluY2x1c2l2ZVJpZ2h0ID8gc3Bhbi50byA+PSBlbmRDaCA6IHNwYW4udG8gPiBlbmRDaCk7XG4gICAgaWYgKGVuZHNBZnRlciB8fCBzcGFuLmZyb20gPT0gZW5kQ2ggJiYgbWFya2VyLnR5cGUgPT0gXCJib29rbWFya1wiICYmICghaXNJbnNlcnQgfHwgc3Bhbi5tYXJrZXIuaW5zZXJ0TGVmdCkpIHtcbiAgICAgIHZhciBzdGFydHNCZWZvcmUgPSBzcGFuLmZyb20gPT0gbnVsbCB8fCAobWFya2VyLmluY2x1c2l2ZUxlZnQgPyBzcGFuLmZyb20gPD0gZW5kQ2ggOiBzcGFuLmZyb20gPCBlbmRDaCk7KG53IHx8IChudyA9IFtdKSkucHVzaChuZXcgTWFya2VkU3BhbihtYXJrZXIsIHN0YXJ0c0JlZm9yZSA/IG51bGwgOiBzcGFuLmZyb20gLSBlbmRDaCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3Bhbi50byA9PSBudWxsID8gbnVsbCA6IHNwYW4udG8gLSBlbmRDaCkpO1xuICAgIH1cbiAgfSB9XG4gIHJldHVybiBud1xufVxuXG4vLyBHaXZlbiBhIGNoYW5nZSBvYmplY3QsIGNvbXB1dGUgdGhlIG5ldyBzZXQgb2YgbWFya2VyIHNwYW5zIHRoYXRcbi8vIGNvdmVyIHRoZSBsaW5lIGluIHdoaWNoIHRoZSBjaGFuZ2UgdG9vayBwbGFjZS4gUmVtb3ZlcyBzcGFuc1xuLy8gZW50aXJlbHkgd2l0aGluIHRoZSBjaGFuZ2UsIHJlY29ubmVjdHMgc3BhbnMgYmVsb25naW5nIHRvIHRoZVxuLy8gc2FtZSBtYXJrZXIgdGhhdCBhcHBlYXIgb24gYm90aCBzaWRlcyBvZiB0aGUgY2hhbmdlLCBhbmQgY3V0cyBvZmZcbi8vIHNwYW5zIHBhcnRpYWxseSB3aXRoaW4gdGhlIGNoYW5nZS4gUmV0dXJucyBhbiBhcnJheSBvZiBzcGFuXG4vLyBhcnJheXMgd2l0aCBvbmUgZWxlbWVudCBmb3IgZWFjaCBsaW5lIGluIChhZnRlcikgdGhlIGNoYW5nZS5cbmZ1bmN0aW9uIHN0cmV0Y2hTcGFuc092ZXJDaGFuZ2UoZG9jLCBjaGFuZ2UpIHtcbiAgaWYgKGNoYW5nZS5mdWxsKSB7IHJldHVybiBudWxsIH1cbiAgdmFyIG9sZEZpcnN0ID0gaXNMaW5lKGRvYywgY2hhbmdlLmZyb20ubGluZSkgJiYgZ2V0TGluZShkb2MsIGNoYW5nZS5mcm9tLmxpbmUpLm1hcmtlZFNwYW5zO1xuICB2YXIgb2xkTGFzdCA9IGlzTGluZShkb2MsIGNoYW5nZS50by5saW5lKSAmJiBnZXRMaW5lKGRvYywgY2hhbmdlLnRvLmxpbmUpLm1hcmtlZFNwYW5zO1xuICBpZiAoIW9sZEZpcnN0ICYmICFvbGRMYXN0KSB7IHJldHVybiBudWxsIH1cblxuICB2YXIgc3RhcnRDaCA9IGNoYW5nZS5mcm9tLmNoLCBlbmRDaCA9IGNoYW5nZS50by5jaCwgaXNJbnNlcnQgPSBjbXAoY2hhbmdlLmZyb20sIGNoYW5nZS50bykgPT0gMDtcbiAgLy8gR2V0IHRoZSBzcGFucyB0aGF0ICdzdGljayBvdXQnIG9uIGJvdGggc2lkZXNcbiAgdmFyIGZpcnN0ID0gbWFya2VkU3BhbnNCZWZvcmUob2xkRmlyc3QsIHN0YXJ0Q2gsIGlzSW5zZXJ0KTtcbiAgdmFyIGxhc3QgPSBtYXJrZWRTcGFuc0FmdGVyKG9sZExhc3QsIGVuZENoLCBpc0luc2VydCk7XG5cbiAgLy8gTmV4dCwgbWVyZ2UgdGhvc2UgdHdvIGVuZHNcbiAgdmFyIHNhbWVMaW5lID0gY2hhbmdlLnRleHQubGVuZ3RoID09IDEsIG9mZnNldCA9IGxzdChjaGFuZ2UudGV4dCkubGVuZ3RoICsgKHNhbWVMaW5lID8gc3RhcnRDaCA6IDApO1xuICBpZiAoZmlyc3QpIHtcbiAgICAvLyBGaXggdXAgLnRvIHByb3BlcnRpZXMgb2YgZmlyc3RcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpcnN0Lmxlbmd0aDsgKytpKSB7XG4gICAgICB2YXIgc3BhbiA9IGZpcnN0W2ldO1xuICAgICAgaWYgKHNwYW4udG8gPT0gbnVsbCkge1xuICAgICAgICB2YXIgZm91bmQgPSBnZXRNYXJrZWRTcGFuRm9yKGxhc3QsIHNwYW4ubWFya2VyKTtcbiAgICAgICAgaWYgKCFmb3VuZCkgeyBzcGFuLnRvID0gc3RhcnRDaDsgfVxuICAgICAgICBlbHNlIGlmIChzYW1lTGluZSkgeyBzcGFuLnRvID0gZm91bmQudG8gPT0gbnVsbCA/IG51bGwgOiBmb3VuZC50byArIG9mZnNldDsgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAobGFzdCkge1xuICAgIC8vIEZpeCB1cCAuZnJvbSBpbiBsYXN0IChvciBtb3ZlIHRoZW0gaW50byBmaXJzdCBpbiBjYXNlIG9mIHNhbWVMaW5lKVxuICAgIGZvciAodmFyIGkkMSA9IDA7IGkkMSA8IGxhc3QubGVuZ3RoOyArK2kkMSkge1xuICAgICAgdmFyIHNwYW4kMSA9IGxhc3RbaSQxXTtcbiAgICAgIGlmIChzcGFuJDEudG8gIT0gbnVsbCkgeyBzcGFuJDEudG8gKz0gb2Zmc2V0OyB9XG4gICAgICBpZiAoc3BhbiQxLmZyb20gPT0gbnVsbCkge1xuICAgICAgICB2YXIgZm91bmQkMSA9IGdldE1hcmtlZFNwYW5Gb3IoZmlyc3QsIHNwYW4kMS5tYXJrZXIpO1xuICAgICAgICBpZiAoIWZvdW5kJDEpIHtcbiAgICAgICAgICBzcGFuJDEuZnJvbSA9IG9mZnNldDtcbiAgICAgICAgICBpZiAoc2FtZUxpbmUpIHsgKGZpcnN0IHx8IChmaXJzdCA9IFtdKSkucHVzaChzcGFuJDEpOyB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNwYW4kMS5mcm9tICs9IG9mZnNldDtcbiAgICAgICAgaWYgKHNhbWVMaW5lKSB7IChmaXJzdCB8fCAoZmlyc3QgPSBbXSkpLnB1c2goc3BhbiQxKTsgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICAvLyBNYWtlIHN1cmUgd2UgZGlkbid0IGNyZWF0ZSBhbnkgemVyby1sZW5ndGggc3BhbnNcbiAgaWYgKGZpcnN0KSB7IGZpcnN0ID0gY2xlYXJFbXB0eVNwYW5zKGZpcnN0KTsgfVxuICBpZiAobGFzdCAmJiBsYXN0ICE9IGZpcnN0KSB7IGxhc3QgPSBjbGVhckVtcHR5U3BhbnMobGFzdCk7IH1cblxuICB2YXIgbmV3TWFya2VycyA9IFtmaXJzdF07XG4gIGlmICghc2FtZUxpbmUpIHtcbiAgICAvLyBGaWxsIGdhcCB3aXRoIHdob2xlLWxpbmUtc3BhbnNcbiAgICB2YXIgZ2FwID0gY2hhbmdlLnRleHQubGVuZ3RoIC0gMiwgZ2FwTWFya2VycztcbiAgICBpZiAoZ2FwID4gMCAmJiBmaXJzdClcbiAgICAgIHsgZm9yICh2YXIgaSQyID0gMDsgaSQyIDwgZmlyc3QubGVuZ3RoOyArK2kkMilcbiAgICAgICAgeyBpZiAoZmlyc3RbaSQyXS50byA9PSBudWxsKVxuICAgICAgICAgIHsgKGdhcE1hcmtlcnMgfHwgKGdhcE1hcmtlcnMgPSBbXSkpLnB1c2gobmV3IE1hcmtlZFNwYW4oZmlyc3RbaSQyXS5tYXJrZXIsIG51bGwsIG51bGwpKTsgfSB9IH1cbiAgICBmb3IgKHZhciBpJDMgPSAwOyBpJDMgPCBnYXA7ICsraSQzKVxuICAgICAgeyBuZXdNYXJrZXJzLnB1c2goZ2FwTWFya2Vycyk7IH1cbiAgICBuZXdNYXJrZXJzLnB1c2gobGFzdCk7XG4gIH1cbiAgcmV0dXJuIG5ld01hcmtlcnNcbn1cblxuLy8gUmVtb3ZlIHNwYW5zIHRoYXQgYXJlIGVtcHR5IGFuZCBkb24ndCBoYXZlIGEgY2xlYXJXaGVuRW1wdHlcbi8vIG9wdGlvbiBvZiBmYWxzZS5cbmZ1bmN0aW9uIGNsZWFyRW1wdHlTcGFucyhzcGFucykge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHNwYW5zLmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIHNwYW4gPSBzcGFuc1tpXTtcbiAgICBpZiAoc3Bhbi5mcm9tICE9IG51bGwgJiYgc3Bhbi5mcm9tID09IHNwYW4udG8gJiYgc3Bhbi5tYXJrZXIuY2xlYXJXaGVuRW1wdHkgIT09IGZhbHNlKVxuICAgICAgeyBzcGFucy5zcGxpY2UoaS0tLCAxKTsgfVxuICB9XG4gIGlmICghc3BhbnMubGVuZ3RoKSB7IHJldHVybiBudWxsIH1cbiAgcmV0dXJuIHNwYW5zXG59XG5cbi8vIFVzZWQgdG8gJ2NsaXAnIG91dCByZWFkT25seSByYW5nZXMgd2hlbiBtYWtpbmcgYSBjaGFuZ2UuXG5mdW5jdGlvbiByZW1vdmVSZWFkT25seVJhbmdlcyhkb2MsIGZyb20sIHRvKSB7XG4gIHZhciBtYXJrZXJzID0gbnVsbDtcbiAgZG9jLml0ZXIoZnJvbS5saW5lLCB0by5saW5lICsgMSwgZnVuY3Rpb24gKGxpbmUpIHtcbiAgICBpZiAobGluZS5tYXJrZWRTcGFucykgeyBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmUubWFya2VkU3BhbnMubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBtYXJrID0gbGluZS5tYXJrZWRTcGFuc1tpXS5tYXJrZXI7XG4gICAgICBpZiAobWFyay5yZWFkT25seSAmJiAoIW1hcmtlcnMgfHwgaW5kZXhPZihtYXJrZXJzLCBtYXJrKSA9PSAtMSkpXG4gICAgICAgIHsgKG1hcmtlcnMgfHwgKG1hcmtlcnMgPSBbXSkpLnB1c2gobWFyayk7IH1cbiAgICB9IH1cbiAgfSk7XG4gIGlmICghbWFya2VycykgeyByZXR1cm4gbnVsbCB9XG4gIHZhciBwYXJ0cyA9IFt7ZnJvbTogZnJvbSwgdG86IHRvfV07XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbWFya2Vycy5sZW5ndGg7ICsraSkge1xuICAgIHZhciBtayA9IG1hcmtlcnNbaV0sIG0gPSBtay5maW5kKDApO1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwgcGFydHMubGVuZ3RoOyArK2opIHtcbiAgICAgIHZhciBwID0gcGFydHNbal07XG4gICAgICBpZiAoY21wKHAudG8sIG0uZnJvbSkgPCAwIHx8IGNtcChwLmZyb20sIG0udG8pID4gMCkgeyBjb250aW51ZSB9XG4gICAgICB2YXIgbmV3UGFydHMgPSBbaiwgMV0sIGRmcm9tID0gY21wKHAuZnJvbSwgbS5mcm9tKSwgZHRvID0gY21wKHAudG8sIG0udG8pO1xuICAgICAgaWYgKGRmcm9tIDwgMCB8fCAhbWsuaW5jbHVzaXZlTGVmdCAmJiAhZGZyb20pXG4gICAgICAgIHsgbmV3UGFydHMucHVzaCh7ZnJvbTogcC5mcm9tLCB0bzogbS5mcm9tfSk7IH1cbiAgICAgIGlmIChkdG8gPiAwIHx8ICFtay5pbmNsdXNpdmVSaWdodCAmJiAhZHRvKVxuICAgICAgICB7IG5ld1BhcnRzLnB1c2goe2Zyb206IG0udG8sIHRvOiBwLnRvfSk7IH1cbiAgICAgIHBhcnRzLnNwbGljZS5hcHBseShwYXJ0cywgbmV3UGFydHMpO1xuICAgICAgaiArPSBuZXdQYXJ0cy5sZW5ndGggLSAzO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcGFydHNcbn1cblxuLy8gQ29ubmVjdCBvciBkaXNjb25uZWN0IHNwYW5zIGZyb20gYSBsaW5lLlxuZnVuY3Rpb24gZGV0YWNoTWFya2VkU3BhbnMobGluZSkge1xuICB2YXIgc3BhbnMgPSBsaW5lLm1hcmtlZFNwYW5zO1xuICBpZiAoIXNwYW5zKSB7IHJldHVybiB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3BhbnMubGVuZ3RoOyArK2kpXG4gICAgeyBzcGFuc1tpXS5tYXJrZXIuZGV0YWNoTGluZShsaW5lKTsgfVxuICBsaW5lLm1hcmtlZFNwYW5zID0gbnVsbDtcbn1cbmZ1bmN0aW9uIGF0dGFjaE1hcmtlZFNwYW5zKGxpbmUsIHNwYW5zKSB7XG4gIGlmICghc3BhbnMpIHsgcmV0dXJuIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGFucy5sZW5ndGg7ICsraSlcbiAgICB7IHNwYW5zW2ldLm1hcmtlci5hdHRhY2hMaW5lKGxpbmUpOyB9XG4gIGxpbmUubWFya2VkU3BhbnMgPSBzcGFucztcbn1cblxuLy8gSGVscGVycyB1c2VkIHdoZW4gY29tcHV0aW5nIHdoaWNoIG92ZXJsYXBwaW5nIGNvbGxhcHNlZCBzcGFuXG4vLyBjb3VudHMgYXMgdGhlIGxhcmdlciBvbmUuXG5mdW5jdGlvbiBleHRyYUxlZnQobWFya2VyKSB7IHJldHVybiBtYXJrZXIuaW5jbHVzaXZlTGVmdCA/IC0xIDogMCB9XG5mdW5jdGlvbiBleHRyYVJpZ2h0KG1hcmtlcikgeyByZXR1cm4gbWFya2VyLmluY2x1c2l2ZVJpZ2h0ID8gMSA6IDAgfVxuXG4vLyBSZXR1cm5zIGEgbnVtYmVyIGluZGljYXRpbmcgd2hpY2ggb2YgdHdvIG92ZXJsYXBwaW5nIGNvbGxhcHNlZFxuLy8gc3BhbnMgaXMgbGFyZ2VyIChhbmQgdGh1cyBpbmNsdWRlcyB0aGUgb3RoZXIpLiBGYWxscyBiYWNrIHRvXG4vLyBjb21wYXJpbmcgaWRzIHdoZW4gdGhlIHNwYW5zIGNvdmVyIGV4YWN0bHkgdGhlIHNhbWUgcmFuZ2UuXG5mdW5jdGlvbiBjb21wYXJlQ29sbGFwc2VkTWFya2VycyhhLCBiKSB7XG4gIHZhciBsZW5EaWZmID0gYS5saW5lcy5sZW5ndGggLSBiLmxpbmVzLmxlbmd0aDtcbiAgaWYgKGxlbkRpZmYgIT0gMCkgeyByZXR1cm4gbGVuRGlmZiB9XG4gIHZhciBhUG9zID0gYS5maW5kKCksIGJQb3MgPSBiLmZpbmQoKTtcbiAgdmFyIGZyb21DbXAgPSBjbXAoYVBvcy5mcm9tLCBiUG9zLmZyb20pIHx8IGV4dHJhTGVmdChhKSAtIGV4dHJhTGVmdChiKTtcbiAgaWYgKGZyb21DbXApIHsgcmV0dXJuIC1mcm9tQ21wIH1cbiAgdmFyIHRvQ21wID0gY21wKGFQb3MudG8sIGJQb3MudG8pIHx8IGV4dHJhUmlnaHQoYSkgLSBleHRyYVJpZ2h0KGIpO1xuICBpZiAodG9DbXApIHsgcmV0dXJuIHRvQ21wIH1cbiAgcmV0dXJuIGIuaWQgLSBhLmlkXG59XG5cbi8vIEZpbmQgb3V0IHdoZXRoZXIgYSBsaW5lIGVuZHMgb3Igc3RhcnRzIGluIGEgY29sbGFwc2VkIHNwYW4uIElmXG4vLyBzbywgcmV0dXJuIHRoZSBtYXJrZXIgZm9yIHRoYXQgc3Bhbi5cbmZ1bmN0aW9uIGNvbGxhcHNlZFNwYW5BdFNpZGUobGluZSwgc3RhcnQpIHtcbiAgdmFyIHNwcyA9IHNhd0NvbGxhcHNlZFNwYW5zICYmIGxpbmUubWFya2VkU3BhbnMsIGZvdW5kO1xuICBpZiAoc3BzKSB7IGZvciAodmFyIHNwID0gKHZvaWQgMCksIGkgPSAwOyBpIDwgc3BzLmxlbmd0aDsgKytpKSB7XG4gICAgc3AgPSBzcHNbaV07XG4gICAgaWYgKHNwLm1hcmtlci5jb2xsYXBzZWQgJiYgKHN0YXJ0ID8gc3AuZnJvbSA6IHNwLnRvKSA9PSBudWxsICYmXG4gICAgICAgICghZm91bmQgfHwgY29tcGFyZUNvbGxhcHNlZE1hcmtlcnMoZm91bmQsIHNwLm1hcmtlcikgPCAwKSlcbiAgICAgIHsgZm91bmQgPSBzcC5tYXJrZXI7IH1cbiAgfSB9XG4gIHJldHVybiBmb3VuZFxufVxuZnVuY3Rpb24gY29sbGFwc2VkU3BhbkF0U3RhcnQobGluZSkgeyByZXR1cm4gY29sbGFwc2VkU3BhbkF0U2lkZShsaW5lLCB0cnVlKSB9XG5mdW5jdGlvbiBjb2xsYXBzZWRTcGFuQXRFbmQobGluZSkgeyByZXR1cm4gY29sbGFwc2VkU3BhbkF0U2lkZShsaW5lLCBmYWxzZSkgfVxuXG4vLyBUZXN0IHdoZXRoZXIgdGhlcmUgZXhpc3RzIGEgY29sbGFwc2VkIHNwYW4gdGhhdCBwYXJ0aWFsbHlcbi8vIG92ZXJsYXBzIChjb3ZlcnMgdGhlIHN0YXJ0IG9yIGVuZCwgYnV0IG5vdCBib3RoKSBvZiBhIG5ldyBzcGFuLlxuLy8gU3VjaCBvdmVybGFwIGlzIG5vdCBhbGxvd2VkLlxuZnVuY3Rpb24gY29uZmxpY3RpbmdDb2xsYXBzZWRSYW5nZShkb2MsIGxpbmVObyQkMSwgZnJvbSwgdG8sIG1hcmtlcikge1xuICB2YXIgbGluZSA9IGdldExpbmUoZG9jLCBsaW5lTm8kJDEpO1xuICB2YXIgc3BzID0gc2F3Q29sbGFwc2VkU3BhbnMgJiYgbGluZS5tYXJrZWRTcGFucztcbiAgaWYgKHNwcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHNwcy5sZW5ndGg7ICsraSkge1xuICAgIHZhciBzcCA9IHNwc1tpXTtcbiAgICBpZiAoIXNwLm1hcmtlci5jb2xsYXBzZWQpIHsgY29udGludWUgfVxuICAgIHZhciBmb3VuZCA9IHNwLm1hcmtlci5maW5kKDApO1xuICAgIHZhciBmcm9tQ21wID0gY21wKGZvdW5kLmZyb20sIGZyb20pIHx8IGV4dHJhTGVmdChzcC5tYXJrZXIpIC0gZXh0cmFMZWZ0KG1hcmtlcik7XG4gICAgdmFyIHRvQ21wID0gY21wKGZvdW5kLnRvLCB0bykgfHwgZXh0cmFSaWdodChzcC5tYXJrZXIpIC0gZXh0cmFSaWdodChtYXJrZXIpO1xuICAgIGlmIChmcm9tQ21wID49IDAgJiYgdG9DbXAgPD0gMCB8fCBmcm9tQ21wIDw9IDAgJiYgdG9DbXAgPj0gMCkgeyBjb250aW51ZSB9XG4gICAgaWYgKGZyb21DbXAgPD0gMCAmJiAoc3AubWFya2VyLmluY2x1c2l2ZVJpZ2h0ICYmIG1hcmtlci5pbmNsdXNpdmVMZWZ0ID8gY21wKGZvdW5kLnRvLCBmcm9tKSA+PSAwIDogY21wKGZvdW5kLnRvLCBmcm9tKSA+IDApIHx8XG4gICAgICAgIGZyb21DbXAgPj0gMCAmJiAoc3AubWFya2VyLmluY2x1c2l2ZVJpZ2h0ICYmIG1hcmtlci5pbmNsdXNpdmVMZWZ0ID8gY21wKGZvdW5kLmZyb20sIHRvKSA8PSAwIDogY21wKGZvdW5kLmZyb20sIHRvKSA8IDApKVxuICAgICAgeyByZXR1cm4gdHJ1ZSB9XG4gIH0gfVxufVxuXG4vLyBBIHZpc3VhbCBsaW5lIGlzIGEgbGluZSBhcyBkcmF3biBvbiB0aGUgc2NyZWVuLiBGb2xkaW5nLCBmb3Jcbi8vIGV4YW1wbGUsIGNhbiBjYXVzZSBtdWx0aXBsZSBsb2dpY2FsIGxpbmVzIHRvIGFwcGVhciBvbiB0aGUgc2FtZVxuLy8gdmlzdWFsIGxpbmUuIFRoaXMgZmluZHMgdGhlIHN0YXJ0IG9mIHRoZSB2aXN1YWwgbGluZSB0aGF0IHRoZVxuLy8gZ2l2ZW4gbGluZSBpcyBwYXJ0IG9mICh1c3VhbGx5IHRoYXQgaXMgdGhlIGxpbmUgaXRzZWxmKS5cbmZ1bmN0aW9uIHZpc3VhbExpbmUobGluZSkge1xuICB2YXIgbWVyZ2VkO1xuICB3aGlsZSAobWVyZ2VkID0gY29sbGFwc2VkU3BhbkF0U3RhcnQobGluZSkpXG4gICAgeyBsaW5lID0gbWVyZ2VkLmZpbmQoLTEsIHRydWUpLmxpbmU7IH1cbiAgcmV0dXJuIGxpbmVcbn1cblxuZnVuY3Rpb24gdmlzdWFsTGluZUVuZChsaW5lKSB7XG4gIHZhciBtZXJnZWQ7XG4gIHdoaWxlIChtZXJnZWQgPSBjb2xsYXBzZWRTcGFuQXRFbmQobGluZSkpXG4gICAgeyBsaW5lID0gbWVyZ2VkLmZpbmQoMSwgdHJ1ZSkubGluZTsgfVxuICByZXR1cm4gbGluZVxufVxuXG4vLyBSZXR1cm5zIGFuIGFycmF5IG9mIGxvZ2ljYWwgbGluZXMgdGhhdCBjb250aW51ZSB0aGUgdmlzdWFsIGxpbmVcbi8vIHN0YXJ0ZWQgYnkgdGhlIGFyZ3VtZW50LCBvciB1bmRlZmluZWQgaWYgdGhlcmUgYXJlIG5vIHN1Y2ggbGluZXMuXG5mdW5jdGlvbiB2aXN1YWxMaW5lQ29udGludWVkKGxpbmUpIHtcbiAgdmFyIG1lcmdlZCwgbGluZXM7XG4gIHdoaWxlIChtZXJnZWQgPSBjb2xsYXBzZWRTcGFuQXRFbmQobGluZSkpIHtcbiAgICBsaW5lID0gbWVyZ2VkLmZpbmQoMSwgdHJ1ZSkubGluZVxuICAgIDsobGluZXMgfHwgKGxpbmVzID0gW10pKS5wdXNoKGxpbmUpO1xuICB9XG4gIHJldHVybiBsaW5lc1xufVxuXG4vLyBHZXQgdGhlIGxpbmUgbnVtYmVyIG9mIHRoZSBzdGFydCBvZiB0aGUgdmlzdWFsIGxpbmUgdGhhdCB0aGVcbi8vIGdpdmVuIGxpbmUgbnVtYmVyIGlzIHBhcnQgb2YuXG5mdW5jdGlvbiB2aXN1YWxMaW5lTm8oZG9jLCBsaW5lTikge1xuICB2YXIgbGluZSA9IGdldExpbmUoZG9jLCBsaW5lTiksIHZpcyA9IHZpc3VhbExpbmUobGluZSk7XG4gIGlmIChsaW5lID09IHZpcykgeyByZXR1cm4gbGluZU4gfVxuICByZXR1cm4gbGluZU5vKHZpcylcbn1cblxuLy8gR2V0IHRoZSBsaW5lIG51bWJlciBvZiB0aGUgc3RhcnQgb2YgdGhlIG5leHQgdmlzdWFsIGxpbmUgYWZ0ZXJcbi8vIHRoZSBnaXZlbiBsaW5lLlxuZnVuY3Rpb24gdmlzdWFsTGluZUVuZE5vKGRvYywgbGluZU4pIHtcbiAgaWYgKGxpbmVOID4gZG9jLmxhc3RMaW5lKCkpIHsgcmV0dXJuIGxpbmVOIH1cbiAgdmFyIGxpbmUgPSBnZXRMaW5lKGRvYywgbGluZU4pLCBtZXJnZWQ7XG4gIGlmICghbGluZUlzSGlkZGVuKGRvYywgbGluZSkpIHsgcmV0dXJuIGxpbmVOIH1cbiAgd2hpbGUgKG1lcmdlZCA9IGNvbGxhcHNlZFNwYW5BdEVuZChsaW5lKSlcbiAgICB7IGxpbmUgPSBtZXJnZWQuZmluZCgxLCB0cnVlKS5saW5lOyB9XG4gIHJldHVybiBsaW5lTm8obGluZSkgKyAxXG59XG5cbi8vIENvbXB1dGUgd2hldGhlciBhIGxpbmUgaXMgaGlkZGVuLiBMaW5lcyBjb3VudCBhcyBoaWRkZW4gd2hlbiB0aGV5XG4vLyBhcmUgcGFydCBvZiBhIHZpc3VhbCBsaW5lIHRoYXQgc3RhcnRzIHdpdGggYW5vdGhlciBsaW5lLCBvciB3aGVuXG4vLyB0aGV5IGFyZSBlbnRpcmVseSBjb3ZlcmVkIGJ5IGNvbGxhcHNlZCwgbm9uLXdpZGdldCBzcGFuLlxuZnVuY3Rpb24gbGluZUlzSGlkZGVuKGRvYywgbGluZSkge1xuICB2YXIgc3BzID0gc2F3Q29sbGFwc2VkU3BhbnMgJiYgbGluZS5tYXJrZWRTcGFucztcbiAgaWYgKHNwcykgeyBmb3IgKHZhciBzcCA9ICh2b2lkIDApLCBpID0gMDsgaSA8IHNwcy5sZW5ndGg7ICsraSkge1xuICAgIHNwID0gc3BzW2ldO1xuICAgIGlmICghc3AubWFya2VyLmNvbGxhcHNlZCkgeyBjb250aW51ZSB9XG4gICAgaWYgKHNwLmZyb20gPT0gbnVsbCkgeyByZXR1cm4gdHJ1ZSB9XG4gICAgaWYgKHNwLm1hcmtlci53aWRnZXROb2RlKSB7IGNvbnRpbnVlIH1cbiAgICBpZiAoc3AuZnJvbSA9PSAwICYmIHNwLm1hcmtlci5pbmNsdXNpdmVMZWZ0ICYmIGxpbmVJc0hpZGRlbklubmVyKGRvYywgbGluZSwgc3ApKVxuICAgICAgeyByZXR1cm4gdHJ1ZSB9XG4gIH0gfVxufVxuZnVuY3Rpb24gbGluZUlzSGlkZGVuSW5uZXIoZG9jLCBsaW5lLCBzcGFuKSB7XG4gIGlmIChzcGFuLnRvID09IG51bGwpIHtcbiAgICB2YXIgZW5kID0gc3Bhbi5tYXJrZXIuZmluZCgxLCB0cnVlKTtcbiAgICByZXR1cm4gbGluZUlzSGlkZGVuSW5uZXIoZG9jLCBlbmQubGluZSwgZ2V0TWFya2VkU3BhbkZvcihlbmQubGluZS5tYXJrZWRTcGFucywgc3Bhbi5tYXJrZXIpKVxuICB9XG4gIGlmIChzcGFuLm1hcmtlci5pbmNsdXNpdmVSaWdodCAmJiBzcGFuLnRvID09IGxpbmUudGV4dC5sZW5ndGgpXG4gICAgeyByZXR1cm4gdHJ1ZSB9XG4gIGZvciAodmFyIHNwID0gKHZvaWQgMCksIGkgPSAwOyBpIDwgbGluZS5tYXJrZWRTcGFucy5sZW5ndGg7ICsraSkge1xuICAgIHNwID0gbGluZS5tYXJrZWRTcGFuc1tpXTtcbiAgICBpZiAoc3AubWFya2VyLmNvbGxhcHNlZCAmJiAhc3AubWFya2VyLndpZGdldE5vZGUgJiYgc3AuZnJvbSA9PSBzcGFuLnRvICYmXG4gICAgICAgIChzcC50byA9PSBudWxsIHx8IHNwLnRvICE9IHNwYW4uZnJvbSkgJiZcbiAgICAgICAgKHNwLm1hcmtlci5pbmNsdXNpdmVMZWZ0IHx8IHNwYW4ubWFya2VyLmluY2x1c2l2ZVJpZ2h0KSAmJlxuICAgICAgICBsaW5lSXNIaWRkZW5Jbm5lcihkb2MsIGxpbmUsIHNwKSkgeyByZXR1cm4gdHJ1ZSB9XG4gIH1cbn1cblxuLy8gRmluZCB0aGUgaGVpZ2h0IGFib3ZlIHRoZSBnaXZlbiBsaW5lLlxuZnVuY3Rpb24gaGVpZ2h0QXRMaW5lKGxpbmVPYmopIHtcbiAgbGluZU9iaiA9IHZpc3VhbExpbmUobGluZU9iaik7XG5cbiAgdmFyIGggPSAwLCBjaHVuayA9IGxpbmVPYmoucGFyZW50O1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGNodW5rLmxpbmVzLmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIGxpbmUgPSBjaHVuay5saW5lc1tpXTtcbiAgICBpZiAobGluZSA9PSBsaW5lT2JqKSB7IGJyZWFrIH1cbiAgICBlbHNlIHsgaCArPSBsaW5lLmhlaWdodDsgfVxuICB9XG4gIGZvciAodmFyIHAgPSBjaHVuay5wYXJlbnQ7IHA7IGNodW5rID0gcCwgcCA9IGNodW5rLnBhcmVudCkge1xuICAgIGZvciAodmFyIGkkMSA9IDA7IGkkMSA8IHAuY2hpbGRyZW4ubGVuZ3RoOyArK2kkMSkge1xuICAgICAgdmFyIGN1ciA9IHAuY2hpbGRyZW5baSQxXTtcbiAgICAgIGlmIChjdXIgPT0gY2h1bmspIHsgYnJlYWsgfVxuICAgICAgZWxzZSB7IGggKz0gY3VyLmhlaWdodDsgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gaFxufVxuXG4vLyBDb21wdXRlIHRoZSBjaGFyYWN0ZXIgbGVuZ3RoIG9mIGEgbGluZSwgdGFraW5nIGludG8gYWNjb3VudFxuLy8gY29sbGFwc2VkIHJhbmdlcyAoc2VlIG1hcmtUZXh0KSB0aGF0IG1pZ2h0IGhpZGUgcGFydHMsIGFuZCBqb2luXG4vLyBvdGhlciBsaW5lcyBvbnRvIGl0LlxuZnVuY3Rpb24gbGluZUxlbmd0aChsaW5lKSB7XG4gIGlmIChsaW5lLmhlaWdodCA9PSAwKSB7IHJldHVybiAwIH1cbiAgdmFyIGxlbiA9IGxpbmUudGV4dC5sZW5ndGgsIG1lcmdlZCwgY3VyID0gbGluZTtcbiAgd2hpbGUgKG1lcmdlZCA9IGNvbGxhcHNlZFNwYW5BdFN0YXJ0KGN1cikpIHtcbiAgICB2YXIgZm91bmQgPSBtZXJnZWQuZmluZCgwLCB0cnVlKTtcbiAgICBjdXIgPSBmb3VuZC5mcm9tLmxpbmU7XG4gICAgbGVuICs9IGZvdW5kLmZyb20uY2ggLSBmb3VuZC50by5jaDtcbiAgfVxuICBjdXIgPSBsaW5lO1xuICB3aGlsZSAobWVyZ2VkID0gY29sbGFwc2VkU3BhbkF0RW5kKGN1cikpIHtcbiAgICB2YXIgZm91bmQkMSA9IG1lcmdlZC5maW5kKDAsIHRydWUpO1xuICAgIGxlbiAtPSBjdXIudGV4dC5sZW5ndGggLSBmb3VuZCQxLmZyb20uY2g7XG4gICAgY3VyID0gZm91bmQkMS50by5saW5lO1xuICAgIGxlbiArPSBjdXIudGV4dC5sZW5ndGggLSBmb3VuZCQxLnRvLmNoO1xuICB9XG4gIHJldHVybiBsZW5cbn1cblxuLy8gRmluZCB0aGUgbG9uZ2VzdCBsaW5lIGluIHRoZSBkb2N1bWVudC5cbmZ1bmN0aW9uIGZpbmRNYXhMaW5lKGNtKSB7XG4gIHZhciBkID0gY20uZGlzcGxheSwgZG9jID0gY20uZG9jO1xuICBkLm1heExpbmUgPSBnZXRMaW5lKGRvYywgZG9jLmZpcnN0KTtcbiAgZC5tYXhMaW5lTGVuZ3RoID0gbGluZUxlbmd0aChkLm1heExpbmUpO1xuICBkLm1heExpbmVDaGFuZ2VkID0gdHJ1ZTtcbiAgZG9jLml0ZXIoZnVuY3Rpb24gKGxpbmUpIHtcbiAgICB2YXIgbGVuID0gbGluZUxlbmd0aChsaW5lKTtcbiAgICBpZiAobGVuID4gZC5tYXhMaW5lTGVuZ3RoKSB7XG4gICAgICBkLm1heExpbmVMZW5ndGggPSBsZW47XG4gICAgICBkLm1heExpbmUgPSBsaW5lO1xuICAgIH1cbiAgfSk7XG59XG5cbi8vIEJJREkgSEVMUEVSU1xuXG5mdW5jdGlvbiBpdGVyYXRlQmlkaVNlY3Rpb25zKG9yZGVyLCBmcm9tLCB0bywgZikge1xuICBpZiAoIW9yZGVyKSB7IHJldHVybiBmKGZyb20sIHRvLCBcImx0clwiLCAwKSB9XG4gIHZhciBmb3VuZCA9IGZhbHNlO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IG9yZGVyLmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIHBhcnQgPSBvcmRlcltpXTtcbiAgICBpZiAocGFydC5mcm9tIDwgdG8gJiYgcGFydC50byA+IGZyb20gfHwgZnJvbSA9PSB0byAmJiBwYXJ0LnRvID09IGZyb20pIHtcbiAgICAgIGYoTWF0aC5tYXgocGFydC5mcm9tLCBmcm9tKSwgTWF0aC5taW4ocGFydC50bywgdG8pLCBwYXJ0LmxldmVsID09IDEgPyBcInJ0bFwiIDogXCJsdHJcIiwgaSk7XG4gICAgICBmb3VuZCA9IHRydWU7XG4gICAgfVxuICB9XG4gIGlmICghZm91bmQpIHsgZihmcm9tLCB0bywgXCJsdHJcIik7IH1cbn1cblxudmFyIGJpZGlPdGhlciA9IG51bGw7XG5mdW5jdGlvbiBnZXRCaWRpUGFydEF0KG9yZGVyLCBjaCwgc3RpY2t5KSB7XG4gIHZhciBmb3VuZDtcbiAgYmlkaU90aGVyID0gbnVsbDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcmRlci5sZW5ndGg7ICsraSkge1xuICAgIHZhciBjdXIgPSBvcmRlcltpXTtcbiAgICBpZiAoY3VyLmZyb20gPCBjaCAmJiBjdXIudG8gPiBjaCkgeyByZXR1cm4gaSB9XG4gICAgaWYgKGN1ci50byA9PSBjaCkge1xuICAgICAgaWYgKGN1ci5mcm9tICE9IGN1ci50byAmJiBzdGlja3kgPT0gXCJiZWZvcmVcIikgeyBmb3VuZCA9IGk7IH1cbiAgICAgIGVsc2UgeyBiaWRpT3RoZXIgPSBpOyB9XG4gICAgfVxuICAgIGlmIChjdXIuZnJvbSA9PSBjaCkge1xuICAgICAgaWYgKGN1ci5mcm9tICE9IGN1ci50byAmJiBzdGlja3kgIT0gXCJiZWZvcmVcIikgeyBmb3VuZCA9IGk7IH1cbiAgICAgIGVsc2UgeyBiaWRpT3RoZXIgPSBpOyB9XG4gICAgfVxuICB9XG4gIHJldHVybiBmb3VuZCAhPSBudWxsID8gZm91bmQgOiBiaWRpT3RoZXJcbn1cblxuLy8gQmlkaXJlY3Rpb25hbCBvcmRlcmluZyBhbGdvcml0aG1cbi8vIFNlZSBodHRwOi8vdW5pY29kZS5vcmcvcmVwb3J0cy90cjkvdHI5LTEzLmh0bWwgZm9yIHRoZSBhbGdvcml0aG1cbi8vIHRoYXQgdGhpcyAocGFydGlhbGx5KSBpbXBsZW1lbnRzLlxuXG4vLyBPbmUtY2hhciBjb2RlcyB1c2VkIGZvciBjaGFyYWN0ZXIgdHlwZXM6XG4vLyBMIChMKTogICBMZWZ0LXRvLVJpZ2h0XG4vLyBSIChSKTogICBSaWdodC10by1MZWZ0XG4vLyByIChBTCk6ICBSaWdodC10by1MZWZ0IEFyYWJpY1xuLy8gMSAoRU4pOiAgRXVyb3BlYW4gTnVtYmVyXG4vLyArIChFUyk6ICBFdXJvcGVhbiBOdW1iZXIgU2VwYXJhdG9yXG4vLyAlIChFVCk6ICBFdXJvcGVhbiBOdW1iZXIgVGVybWluYXRvclxuLy8gbiAoQU4pOiAgQXJhYmljIE51bWJlclxuLy8gLCAoQ1MpOiAgQ29tbW9uIE51bWJlciBTZXBhcmF0b3Jcbi8vIG0gKE5TTSk6IE5vbi1TcGFjaW5nIE1hcmtcbi8vIGIgKEJOKTogIEJvdW5kYXJ5IE5ldXRyYWxcbi8vIHMgKEIpOiAgIFBhcmFncmFwaCBTZXBhcmF0b3Jcbi8vIHQgKFMpOiAgIFNlZ21lbnQgU2VwYXJhdG9yXG4vLyB3IChXUyk6ICBXaGl0ZXNwYWNlXG4vLyBOIChPTik6ICBPdGhlciBOZXV0cmFsc1xuXG4vLyBSZXR1cm5zIG51bGwgaWYgY2hhcmFjdGVycyBhcmUgb3JkZXJlZCBhcyB0aGV5IGFwcGVhclxuLy8gKGxlZnQtdG8tcmlnaHQpLCBvciBhbiBhcnJheSBvZiBzZWN0aW9ucyAoe2Zyb20sIHRvLCBsZXZlbH1cbi8vIG9iamVjdHMpIGluIHRoZSBvcmRlciBpbiB3aGljaCB0aGV5IG9jY3VyIHZpc3VhbGx5LlxudmFyIGJpZGlPcmRlcmluZyA9IChmdW5jdGlvbigpIHtcbiAgLy8gQ2hhcmFjdGVyIHR5cGVzIGZvciBjb2RlcG9pbnRzIDAgdG8gMHhmZlxuICB2YXIgbG93VHlwZXMgPSBcImJiYmJiYmJiYnRzdHdzYmJiYmJiYmJiYmJiYmJzc3N0d05OJSUlTk5OTk5OLE4sTjExMTExMTExMTFOTk5OTk5OTExMTExMTExMTExMTExMTExMTExMTExMTExOTk5OTk5MTExMTExMTExMTExMTExMTExMTExMTExMTE5OTk5iYmJiYmJzYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmIsTiUlJSVOTk5OTE5OTk5OJSUxMU5MTk5OMUxOTk5OTkxMTExMTExMTExMTExMTExMTExMTExMTkxMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExOXCI7XG4gIC8vIENoYXJhY3RlciB0eXBlcyBmb3IgY29kZXBvaW50cyAweDYwMCB0byAweDZmOVxuICB2YXIgYXJhYmljVHlwZXMgPSBcIm5ubm5ubk5OciUlcixyTk5tbW1tbW1tbW1tbXJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycm1tbW1tbW1tbW1tbW1tbW1tbW1tbW5ubm5ubm5ubm4lbm5ycnJtcnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJtbW1tbW1tbk5tbW1tbW1ycm1tTm1tbW1ycjExMTExMTExMTFcIjtcbiAgZnVuY3Rpb24gY2hhclR5cGUoY29kZSkge1xuICAgIGlmIChjb2RlIDw9IDB4ZjcpIHsgcmV0dXJuIGxvd1R5cGVzLmNoYXJBdChjb2RlKSB9XG4gICAgZWxzZSBpZiAoMHg1OTAgPD0gY29kZSAmJiBjb2RlIDw9IDB4NWY0KSB7IHJldHVybiBcIlJcIiB9XG4gICAgZWxzZSBpZiAoMHg2MDAgPD0gY29kZSAmJiBjb2RlIDw9IDB4NmY5KSB7IHJldHVybiBhcmFiaWNUeXBlcy5jaGFyQXQoY29kZSAtIDB4NjAwKSB9XG4gICAgZWxzZSBpZiAoMHg2ZWUgPD0gY29kZSAmJiBjb2RlIDw9IDB4OGFjKSB7IHJldHVybiBcInJcIiB9XG4gICAgZWxzZSBpZiAoMHgyMDAwIDw9IGNvZGUgJiYgY29kZSA8PSAweDIwMGIpIHsgcmV0dXJuIFwid1wiIH1cbiAgICBlbHNlIGlmIChjb2RlID09IDB4MjAwYykgeyByZXR1cm4gXCJiXCIgfVxuICAgIGVsc2UgeyByZXR1cm4gXCJMXCIgfVxuICB9XG5cbiAgdmFyIGJpZGlSRSA9IC9bXFx1MDU5MC1cXHUwNWY0XFx1MDYwMC1cXHUwNmZmXFx1MDcwMC1cXHUwOGFjXS87XG4gIHZhciBpc05ldXRyYWwgPSAvW3N0d05dLywgaXNTdHJvbmcgPSAvW0xScl0vLCBjb3VudHNBc0xlZnQgPSAvW0xiMW5dLywgY291bnRzQXNOdW0gPSAvWzFuXS87XG5cbiAgZnVuY3Rpb24gQmlkaVNwYW4obGV2ZWwsIGZyb20sIHRvKSB7XG4gICAgdGhpcy5sZXZlbCA9IGxldmVsO1xuICAgIHRoaXMuZnJvbSA9IGZyb207IHRoaXMudG8gPSB0bztcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbihzdHIsIGRpcmVjdGlvbikge1xuICAgIHZhciBvdXRlclR5cGUgPSBkaXJlY3Rpb24gPT0gXCJsdHJcIiA/IFwiTFwiIDogXCJSXCI7XG5cbiAgICBpZiAoc3RyLmxlbmd0aCA9PSAwIHx8IGRpcmVjdGlvbiA9PSBcImx0clwiICYmICFiaWRpUkUudGVzdChzdHIpKSB7IHJldHVybiBmYWxzZSB9XG4gICAgdmFyIGxlbiA9IHN0ci5sZW5ndGgsIHR5cGVzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSlcbiAgICAgIHsgdHlwZXMucHVzaChjaGFyVHlwZShzdHIuY2hhckNvZGVBdChpKSkpOyB9XG5cbiAgICAvLyBXMS4gRXhhbWluZSBlYWNoIG5vbi1zcGFjaW5nIG1hcmsgKE5TTSkgaW4gdGhlIGxldmVsIHJ1biwgYW5kXG4gICAgLy8gY2hhbmdlIHRoZSB0eXBlIG9mIHRoZSBOU00gdG8gdGhlIHR5cGUgb2YgdGhlIHByZXZpb3VzXG4gICAgLy8gY2hhcmFjdGVyLiBJZiB0aGUgTlNNIGlzIGF0IHRoZSBzdGFydCBvZiB0aGUgbGV2ZWwgcnVuLCBpdCB3aWxsXG4gICAgLy8gZ2V0IHRoZSB0eXBlIG9mIHNvci5cbiAgICBmb3IgKHZhciBpJDEgPSAwLCBwcmV2ID0gb3V0ZXJUeXBlOyBpJDEgPCBsZW47ICsraSQxKSB7XG4gICAgICB2YXIgdHlwZSA9IHR5cGVzW2kkMV07XG4gICAgICBpZiAodHlwZSA9PSBcIm1cIikgeyB0eXBlc1tpJDFdID0gcHJldjsgfVxuICAgICAgZWxzZSB7IHByZXYgPSB0eXBlOyB9XG4gICAgfVxuXG4gICAgLy8gVzIuIFNlYXJjaCBiYWNrd2FyZHMgZnJvbSBlYWNoIGluc3RhbmNlIG9mIGEgRXVyb3BlYW4gbnVtYmVyXG4gICAgLy8gdW50aWwgdGhlIGZpcnN0IHN0cm9uZyB0eXBlIChSLCBMLCBBTCwgb3Igc29yKSBpcyBmb3VuZC4gSWYgYW5cbiAgICAvLyBBTCBpcyBmb3VuZCwgY2hhbmdlIHRoZSB0eXBlIG9mIHRoZSBFdXJvcGVhbiBudW1iZXIgdG8gQXJhYmljXG4gICAgLy8gbnVtYmVyLlxuICAgIC8vIFczLiBDaGFuZ2UgYWxsIEFMcyB0byBSLlxuICAgIGZvciAodmFyIGkkMiA9IDAsIGN1ciA9IG91dGVyVHlwZTsgaSQyIDwgbGVuOyArK2kkMikge1xuICAgICAgdmFyIHR5cGUkMSA9IHR5cGVzW2kkMl07XG4gICAgICBpZiAodHlwZSQxID09IFwiMVwiICYmIGN1ciA9PSBcInJcIikgeyB0eXBlc1tpJDJdID0gXCJuXCI7IH1cbiAgICAgIGVsc2UgaWYgKGlzU3Ryb25nLnRlc3QodHlwZSQxKSkgeyBjdXIgPSB0eXBlJDE7IGlmICh0eXBlJDEgPT0gXCJyXCIpIHsgdHlwZXNbaSQyXSA9IFwiUlwiOyB9IH1cbiAgICB9XG5cbiAgICAvLyBXNC4gQSBzaW5nbGUgRXVyb3BlYW4gc2VwYXJhdG9yIGJldHdlZW4gdHdvIEV1cm9wZWFuIG51bWJlcnNcbiAgICAvLyBjaGFuZ2VzIHRvIGEgRXVyb3BlYW4gbnVtYmVyLiBBIHNpbmdsZSBjb21tb24gc2VwYXJhdG9yIGJldHdlZW5cbiAgICAvLyB0d28gbnVtYmVycyBvZiB0aGUgc2FtZSB0eXBlIGNoYW5nZXMgdG8gdGhhdCB0eXBlLlxuICAgIGZvciAodmFyIGkkMyA9IDEsIHByZXYkMSA9IHR5cGVzWzBdOyBpJDMgPCBsZW4gLSAxOyArK2kkMykge1xuICAgICAgdmFyIHR5cGUkMiA9IHR5cGVzW2kkM107XG4gICAgICBpZiAodHlwZSQyID09IFwiK1wiICYmIHByZXYkMSA9PSBcIjFcIiAmJiB0eXBlc1tpJDMrMV0gPT0gXCIxXCIpIHsgdHlwZXNbaSQzXSA9IFwiMVwiOyB9XG4gICAgICBlbHNlIGlmICh0eXBlJDIgPT0gXCIsXCIgJiYgcHJldiQxID09IHR5cGVzW2kkMysxXSAmJlxuICAgICAgICAgICAgICAgKHByZXYkMSA9PSBcIjFcIiB8fCBwcmV2JDEgPT0gXCJuXCIpKSB7IHR5cGVzW2kkM10gPSBwcmV2JDE7IH1cbiAgICAgIHByZXYkMSA9IHR5cGUkMjtcbiAgICB9XG5cbiAgICAvLyBXNS4gQSBzZXF1ZW5jZSBvZiBFdXJvcGVhbiB0ZXJtaW5hdG9ycyBhZGphY2VudCB0byBFdXJvcGVhblxuICAgIC8vIG51bWJlcnMgY2hhbmdlcyB0byBhbGwgRXVyb3BlYW4gbnVtYmVycy5cbiAgICAvLyBXNi4gT3RoZXJ3aXNlLCBzZXBhcmF0b3JzIGFuZCB0ZXJtaW5hdG9ycyBjaGFuZ2UgdG8gT3RoZXJcbiAgICAvLyBOZXV0cmFsLlxuICAgIGZvciAodmFyIGkkNCA9IDA7IGkkNCA8IGxlbjsgKytpJDQpIHtcbiAgICAgIHZhciB0eXBlJDMgPSB0eXBlc1tpJDRdO1xuICAgICAgaWYgKHR5cGUkMyA9PSBcIixcIikgeyB0eXBlc1tpJDRdID0gXCJOXCI7IH1cbiAgICAgIGVsc2UgaWYgKHR5cGUkMyA9PSBcIiVcIikge1xuICAgICAgICB2YXIgZW5kID0gKHZvaWQgMCk7XG4gICAgICAgIGZvciAoZW5kID0gaSQ0ICsgMTsgZW5kIDwgbGVuICYmIHR5cGVzW2VuZF0gPT0gXCIlXCI7ICsrZW5kKSB7fVxuICAgICAgICB2YXIgcmVwbGFjZSA9IChpJDQgJiYgdHlwZXNbaSQ0LTFdID09IFwiIVwiKSB8fCAoZW5kIDwgbGVuICYmIHR5cGVzW2VuZF0gPT0gXCIxXCIpID8gXCIxXCIgOiBcIk5cIjtcbiAgICAgICAgZm9yICh2YXIgaiA9IGkkNDsgaiA8IGVuZDsgKytqKSB7IHR5cGVzW2pdID0gcmVwbGFjZTsgfVxuICAgICAgICBpJDQgPSBlbmQgLSAxO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFc3LiBTZWFyY2ggYmFja3dhcmRzIGZyb20gZWFjaCBpbnN0YW5jZSBvZiBhIEV1cm9wZWFuIG51bWJlclxuICAgIC8vIHVudGlsIHRoZSBmaXJzdCBzdHJvbmcgdHlwZSAoUiwgTCwgb3Igc29yKSBpcyBmb3VuZC4gSWYgYW4gTCBpc1xuICAgIC8vIGZvdW5kLCB0aGVuIGNoYW5nZSB0aGUgdHlwZSBvZiB0aGUgRXVyb3BlYW4gbnVtYmVyIHRvIEwuXG4gICAgZm9yICh2YXIgaSQ1ID0gMCwgY3VyJDEgPSBvdXRlclR5cGU7IGkkNSA8IGxlbjsgKytpJDUpIHtcbiAgICAgIHZhciB0eXBlJDQgPSB0eXBlc1tpJDVdO1xuICAgICAgaWYgKGN1ciQxID09IFwiTFwiICYmIHR5cGUkNCA9PSBcIjFcIikgeyB0eXBlc1tpJDVdID0gXCJMXCI7IH1cbiAgICAgIGVsc2UgaWYgKGlzU3Ryb25nLnRlc3QodHlwZSQ0KSkgeyBjdXIkMSA9IHR5cGUkNDsgfVxuICAgIH1cblxuICAgIC8vIE4xLiBBIHNlcXVlbmNlIG9mIG5ldXRyYWxzIHRha2VzIHRoZSBkaXJlY3Rpb24gb2YgdGhlXG4gICAgLy8gc3Vycm91bmRpbmcgc3Ryb25nIHRleHQgaWYgdGhlIHRleHQgb24gYm90aCBzaWRlcyBoYXMgdGhlIHNhbWVcbiAgICAvLyBkaXJlY3Rpb24uIEV1cm9wZWFuIGFuZCBBcmFiaWMgbnVtYmVycyBhY3QgYXMgaWYgdGhleSB3ZXJlIFIgaW5cbiAgICAvLyB0ZXJtcyBvZiB0aGVpciBpbmZsdWVuY2Ugb24gbmV1dHJhbHMuIFN0YXJ0LW9mLWxldmVsLXJ1biAoc29yKVxuICAgIC8vIGFuZCBlbmQtb2YtbGV2ZWwtcnVuIChlb3IpIGFyZSB1c2VkIGF0IGxldmVsIHJ1biBib3VuZGFyaWVzLlxuICAgIC8vIE4yLiBBbnkgcmVtYWluaW5nIG5ldXRyYWxzIHRha2UgdGhlIGVtYmVkZGluZyBkaXJlY3Rpb24uXG4gICAgZm9yICh2YXIgaSQ2ID0gMDsgaSQ2IDwgbGVuOyArK2kkNikge1xuICAgICAgaWYgKGlzTmV1dHJhbC50ZXN0KHR5cGVzW2kkNl0pKSB7XG4gICAgICAgIHZhciBlbmQkMSA9ICh2b2lkIDApO1xuICAgICAgICBmb3IgKGVuZCQxID0gaSQ2ICsgMTsgZW5kJDEgPCBsZW4gJiYgaXNOZXV0cmFsLnRlc3QodHlwZXNbZW5kJDFdKTsgKytlbmQkMSkge31cbiAgICAgICAgdmFyIGJlZm9yZSA9IChpJDYgPyB0eXBlc1tpJDYtMV0gOiBvdXRlclR5cGUpID09IFwiTFwiO1xuICAgICAgICB2YXIgYWZ0ZXIgPSAoZW5kJDEgPCBsZW4gPyB0eXBlc1tlbmQkMV0gOiBvdXRlclR5cGUpID09IFwiTFwiO1xuICAgICAgICB2YXIgcmVwbGFjZSQxID0gYmVmb3JlID09IGFmdGVyID8gKGJlZm9yZSA/IFwiTFwiIDogXCJSXCIpIDogb3V0ZXJUeXBlO1xuICAgICAgICBmb3IgKHZhciBqJDEgPSBpJDY7IGokMSA8IGVuZCQxOyArK2okMSkgeyB0eXBlc1tqJDFdID0gcmVwbGFjZSQxOyB9XG4gICAgICAgIGkkNiA9IGVuZCQxIC0gMTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBIZXJlIHdlIGRlcGFydCBmcm9tIHRoZSBkb2N1bWVudGVkIGFsZ29yaXRobSwgaW4gb3JkZXIgdG8gYXZvaWRcbiAgICAvLyBidWlsZGluZyB1cCBhbiBhY3R1YWwgbGV2ZWxzIGFycmF5LiBTaW5jZSB0aGVyZSBhcmUgb25seSB0aHJlZVxuICAgIC8vIGxldmVscyAoMCwgMSwgMikgaW4gYW4gaW1wbGVtZW50YXRpb24gdGhhdCBkb2Vzbid0IHRha2VcbiAgICAvLyBleHBsaWNpdCBlbWJlZGRpbmcgaW50byBhY2NvdW50LCB3ZSBjYW4gYnVpbGQgdXAgdGhlIG9yZGVyIG9uXG4gICAgLy8gdGhlIGZseSwgd2l0aG91dCBmb2xsb3dpbmcgdGhlIGxldmVsLWJhc2VkIGFsZ29yaXRobS5cbiAgICB2YXIgb3JkZXIgPSBbXSwgbTtcbiAgICBmb3IgKHZhciBpJDcgPSAwOyBpJDcgPCBsZW47KSB7XG4gICAgICBpZiAoY291bnRzQXNMZWZ0LnRlc3QodHlwZXNbaSQ3XSkpIHtcbiAgICAgICAgdmFyIHN0YXJ0ID0gaSQ3O1xuICAgICAgICBmb3IgKCsraSQ3OyBpJDcgPCBsZW4gJiYgY291bnRzQXNMZWZ0LnRlc3QodHlwZXNbaSQ3XSk7ICsraSQ3KSB7fVxuICAgICAgICBvcmRlci5wdXNoKG5ldyBCaWRpU3BhbigwLCBzdGFydCwgaSQ3KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcG9zID0gaSQ3LCBhdCA9IG9yZGVyLmxlbmd0aDtcbiAgICAgICAgZm9yICgrK2kkNzsgaSQ3IDwgbGVuICYmIHR5cGVzW2kkN10gIT0gXCJMXCI7ICsraSQ3KSB7fVxuICAgICAgICBmb3IgKHZhciBqJDIgPSBwb3M7IGokMiA8IGkkNzspIHtcbiAgICAgICAgICBpZiAoY291bnRzQXNOdW0udGVzdCh0eXBlc1tqJDJdKSkge1xuICAgICAgICAgICAgaWYgKHBvcyA8IGokMikgeyBvcmRlci5zcGxpY2UoYXQsIDAsIG5ldyBCaWRpU3BhbigxLCBwb3MsIGokMikpOyB9XG4gICAgICAgICAgICB2YXIgbnN0YXJ0ID0gaiQyO1xuICAgICAgICAgICAgZm9yICgrK2okMjsgaiQyIDwgaSQ3ICYmIGNvdW50c0FzTnVtLnRlc3QodHlwZXNbaiQyXSk7ICsraiQyKSB7fVxuICAgICAgICAgICAgb3JkZXIuc3BsaWNlKGF0LCAwLCBuZXcgQmlkaVNwYW4oMiwgbnN0YXJ0LCBqJDIpKTtcbiAgICAgICAgICAgIHBvcyA9IGokMjtcbiAgICAgICAgICB9IGVsc2UgeyArK2okMjsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChwb3MgPCBpJDcpIHsgb3JkZXIuc3BsaWNlKGF0LCAwLCBuZXcgQmlkaVNwYW4oMSwgcG9zLCBpJDcpKTsgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZGlyZWN0aW9uID09IFwibHRyXCIpIHtcbiAgICAgIGlmIChvcmRlclswXS5sZXZlbCA9PSAxICYmIChtID0gc3RyLm1hdGNoKC9eXFxzKy8pKSkge1xuICAgICAgICBvcmRlclswXS5mcm9tID0gbVswXS5sZW5ndGg7XG4gICAgICAgIG9yZGVyLnVuc2hpZnQobmV3IEJpZGlTcGFuKDAsIDAsIG1bMF0ubGVuZ3RoKSk7XG4gICAgICB9XG4gICAgICBpZiAobHN0KG9yZGVyKS5sZXZlbCA9PSAxICYmIChtID0gc3RyLm1hdGNoKC9cXHMrJC8pKSkge1xuICAgICAgICBsc3Qob3JkZXIpLnRvIC09IG1bMF0ubGVuZ3RoO1xuICAgICAgICBvcmRlci5wdXNoKG5ldyBCaWRpU3BhbigwLCBsZW4gLSBtWzBdLmxlbmd0aCwgbGVuKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGRpcmVjdGlvbiA9PSBcInJ0bFwiID8gb3JkZXIucmV2ZXJzZSgpIDogb3JkZXJcbiAgfVxufSkoKTtcblxuLy8gR2V0IHRoZSBiaWRpIG9yZGVyaW5nIGZvciB0aGUgZ2l2ZW4gbGluZSAoYW5kIGNhY2hlIGl0KS4gUmV0dXJuc1xuLy8gZmFsc2UgZm9yIGxpbmVzIHRoYXQgYXJlIGZ1bGx5IGxlZnQtdG8tcmlnaHQsIGFuZCBhbiBhcnJheSBvZlxuLy8gQmlkaVNwYW4gb2JqZWN0cyBvdGhlcndpc2UuXG5mdW5jdGlvbiBnZXRPcmRlcihsaW5lLCBkaXJlY3Rpb24pIHtcbiAgdmFyIG9yZGVyID0gbGluZS5vcmRlcjtcbiAgaWYgKG9yZGVyID09IG51bGwpIHsgb3JkZXIgPSBsaW5lLm9yZGVyID0gYmlkaU9yZGVyaW5nKGxpbmUudGV4dCwgZGlyZWN0aW9uKTsgfVxuICByZXR1cm4gb3JkZXJcbn1cblxuLy8gRVZFTlQgSEFORExJTkdcblxuLy8gTGlnaHR3ZWlnaHQgZXZlbnQgZnJhbWV3b3JrLiBvbi9vZmYgYWxzbyB3b3JrIG9uIERPTSBub2Rlcyxcbi8vIHJlZ2lzdGVyaW5nIG5hdGl2ZSBET00gaGFuZGxlcnMuXG5cbnZhciBub0hhbmRsZXJzID0gW107XG5cbnZhciBvbiA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUsIGYpIHtcbiAgaWYgKGVtaXR0ZXIuYWRkRXZlbnRMaXN0ZW5lcikge1xuICAgIGVtaXR0ZXIuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBmLCBmYWxzZSk7XG4gIH0gZWxzZSBpZiAoZW1pdHRlci5hdHRhY2hFdmVudCkge1xuICAgIGVtaXR0ZXIuYXR0YWNoRXZlbnQoXCJvblwiICsgdHlwZSwgZik7XG4gIH0gZWxzZSB7XG4gICAgdmFyIG1hcCQkMSA9IGVtaXR0ZXIuX2hhbmRsZXJzIHx8IChlbWl0dGVyLl9oYW5kbGVycyA9IHt9KTtcbiAgICBtYXAkJDFbdHlwZV0gPSAobWFwJCQxW3R5cGVdIHx8IG5vSGFuZGxlcnMpLmNvbmNhdChmKTtcbiAgfVxufTtcblxuZnVuY3Rpb24gZ2V0SGFuZGxlcnMoZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5faGFuZGxlcnMgJiYgZW1pdHRlci5faGFuZGxlcnNbdHlwZV0gfHwgbm9IYW5kbGVyc1xufVxuXG5mdW5jdGlvbiBvZmYoZW1pdHRlciwgdHlwZSwgZikge1xuICBpZiAoZW1pdHRlci5yZW1vdmVFdmVudExpc3RlbmVyKSB7XG4gICAgZW1pdHRlci5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGYsIGZhbHNlKTtcbiAgfSBlbHNlIGlmIChlbWl0dGVyLmRldGFjaEV2ZW50KSB7XG4gICAgZW1pdHRlci5kZXRhY2hFdmVudChcIm9uXCIgKyB0eXBlLCBmKTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgbWFwJCQxID0gZW1pdHRlci5faGFuZGxlcnMsIGFyciA9IG1hcCQkMSAmJiBtYXAkJDFbdHlwZV07XG4gICAgaWYgKGFycikge1xuICAgICAgdmFyIGluZGV4ID0gaW5kZXhPZihhcnIsIGYpO1xuICAgICAgaWYgKGluZGV4ID4gLTEpXG4gICAgICAgIHsgbWFwJCQxW3R5cGVdID0gYXJyLnNsaWNlKDAsIGluZGV4KS5jb25jYXQoYXJyLnNsaWNlKGluZGV4ICsgMSkpOyB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHNpZ25hbChlbWl0dGVyLCB0eXBlIC8qLCB2YWx1ZXMuLi4qLykge1xuICB2YXIgaGFuZGxlcnMgPSBnZXRIYW5kbGVycyhlbWl0dGVyLCB0eXBlKTtcbiAgaWYgKCFoYW5kbGVycy5sZW5ndGgpIHsgcmV0dXJuIH1cbiAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGhhbmRsZXJzLmxlbmd0aDsgKytpKSB7IGhhbmRsZXJzW2ldLmFwcGx5KG51bGwsIGFyZ3MpOyB9XG59XG5cbi8vIFRoZSBET00gZXZlbnRzIHRoYXQgQ29kZU1pcnJvciBoYW5kbGVzIGNhbiBiZSBvdmVycmlkZGVuIGJ5XG4vLyByZWdpc3RlcmluZyBhIChub24tRE9NKSBoYW5kbGVyIG9uIHRoZSBlZGl0b3IgZm9yIHRoZSBldmVudCBuYW1lLFxuLy8gYW5kIHByZXZlbnREZWZhdWx0LWluZyB0aGUgZXZlbnQgaW4gdGhhdCBoYW5kbGVyLlxuZnVuY3Rpb24gc2lnbmFsRE9NRXZlbnQoY20sIGUsIG92ZXJyaWRlKSB7XG4gIGlmICh0eXBlb2YgZSA9PSBcInN0cmluZ1wiKVxuICAgIHsgZSA9IHt0eXBlOiBlLCBwcmV2ZW50RGVmYXVsdDogZnVuY3Rpb24oKSB7IHRoaXMuZGVmYXVsdFByZXZlbnRlZCA9IHRydWU7IH19OyB9XG4gIHNpZ25hbChjbSwgb3ZlcnJpZGUgfHwgZS50eXBlLCBjbSwgZSk7XG4gIHJldHVybiBlX2RlZmF1bHRQcmV2ZW50ZWQoZSkgfHwgZS5jb2RlbWlycm9ySWdub3JlXG59XG5cbmZ1bmN0aW9uIHNpZ25hbEN1cnNvckFjdGl2aXR5KGNtKSB7XG4gIHZhciBhcnIgPSBjbS5faGFuZGxlcnMgJiYgY20uX2hhbmRsZXJzLmN1cnNvckFjdGl2aXR5O1xuICBpZiAoIWFycikgeyByZXR1cm4gfVxuICB2YXIgc2V0ID0gY20uY3VyT3AuY3Vyc29yQWN0aXZpdHlIYW5kbGVycyB8fCAoY20uY3VyT3AuY3Vyc29yQWN0aXZpdHlIYW5kbGVycyA9IFtdKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyArK2kpIHsgaWYgKGluZGV4T2Yoc2V0LCBhcnJbaV0pID09IC0xKVxuICAgIHsgc2V0LnB1c2goYXJyW2ldKTsgfSB9XG59XG5cbmZ1bmN0aW9uIGhhc0hhbmRsZXIoZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZ2V0SGFuZGxlcnMoZW1pdHRlciwgdHlwZSkubGVuZ3RoID4gMFxufVxuXG4vLyBBZGQgb24gYW5kIG9mZiBtZXRob2RzIHRvIGEgY29uc3RydWN0b3IncyBwcm90b3R5cGUsIHRvIG1ha2Vcbi8vIHJlZ2lzdGVyaW5nIGV2ZW50cyBvbiBzdWNoIG9iamVjdHMgbW9yZSBjb252ZW5pZW50LlxuZnVuY3Rpb24gZXZlbnRNaXhpbihjdG9yKSB7XG4gIGN0b3IucHJvdG90eXBlLm9uID0gZnVuY3Rpb24odHlwZSwgZikge29uKHRoaXMsIHR5cGUsIGYpO307XG4gIGN0b3IucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uKHR5cGUsIGYpIHtvZmYodGhpcywgdHlwZSwgZik7fTtcbn1cblxuLy8gRHVlIHRvIHRoZSBmYWN0IHRoYXQgd2Ugc3RpbGwgc3VwcG9ydCBqdXJhc3NpYyBJRSB2ZXJzaW9ucywgc29tZVxuLy8gY29tcGF0aWJpbGl0eSB3cmFwcGVycyBhcmUgbmVlZGVkLlxuXG5mdW5jdGlvbiBlX3ByZXZlbnREZWZhdWx0KGUpIHtcbiAgaWYgKGUucHJldmVudERlZmF1bHQpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB9XG4gIGVsc2UgeyBlLnJldHVyblZhbHVlID0gZmFsc2U7IH1cbn1cbmZ1bmN0aW9uIGVfc3RvcFByb3BhZ2F0aW9uKGUpIHtcbiAgaWYgKGUuc3RvcFByb3BhZ2F0aW9uKSB7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IH1cbiAgZWxzZSB7IGUuY2FuY2VsQnViYmxlID0gdHJ1ZTsgfVxufVxuZnVuY3Rpb24gZV9kZWZhdWx0UHJldmVudGVkKGUpIHtcbiAgcmV0dXJuIGUuZGVmYXVsdFByZXZlbnRlZCAhPSBudWxsID8gZS5kZWZhdWx0UHJldmVudGVkIDogZS5yZXR1cm5WYWx1ZSA9PSBmYWxzZVxufVxuZnVuY3Rpb24gZV9zdG9wKGUpIHtlX3ByZXZlbnREZWZhdWx0KGUpOyBlX3N0b3BQcm9wYWdhdGlvbihlKTt9XG5cbmZ1bmN0aW9uIGVfdGFyZ2V0KGUpIHtyZXR1cm4gZS50YXJnZXQgfHwgZS5zcmNFbGVtZW50fVxuZnVuY3Rpb24gZV9idXR0b24oZSkge1xuICB2YXIgYiA9IGUud2hpY2g7XG4gIGlmIChiID09IG51bGwpIHtcbiAgICBpZiAoZS5idXR0b24gJiAxKSB7IGIgPSAxOyB9XG4gICAgZWxzZSBpZiAoZS5idXR0b24gJiAyKSB7IGIgPSAzOyB9XG4gICAgZWxzZSBpZiAoZS5idXR0b24gJiA0KSB7IGIgPSAyOyB9XG4gIH1cbiAgaWYgKG1hYyAmJiBlLmN0cmxLZXkgJiYgYiA9PSAxKSB7IGIgPSAzOyB9XG4gIHJldHVybiBiXG59XG5cbi8vIERldGVjdCBkcmFnLWFuZC1kcm9wXG52YXIgZHJhZ0FuZERyb3AgPSBmdW5jdGlvbigpIHtcbiAgLy8gVGhlcmUgaXMgKnNvbWUqIGtpbmQgb2YgZHJhZy1hbmQtZHJvcCBzdXBwb3J0IGluIElFNi04LCBidXQgSVxuICAvLyBjb3VsZG4ndCBnZXQgaXQgdG8gd29yayB5ZXQuXG4gIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgOSkgeyByZXR1cm4gZmFsc2UgfVxuICB2YXIgZGl2ID0gZWx0KCdkaXYnKTtcbiAgcmV0dXJuIFwiZHJhZ2dhYmxlXCIgaW4gZGl2IHx8IFwiZHJhZ0Ryb3BcIiBpbiBkaXZcbn0oKTtcblxudmFyIHp3c3BTdXBwb3J0ZWQ7XG5mdW5jdGlvbiB6ZXJvV2lkdGhFbGVtZW50KG1lYXN1cmUpIHtcbiAgaWYgKHp3c3BTdXBwb3J0ZWQgPT0gbnVsbCkge1xuICAgIHZhciB0ZXN0ID0gZWx0KFwic3BhblwiLCBcIlxcdTIwMGJcIik7XG4gICAgcmVtb3ZlQ2hpbGRyZW5BbmRBZGQobWVhc3VyZSwgZWx0KFwic3BhblwiLCBbdGVzdCwgZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJ4XCIpXSkpO1xuICAgIGlmIChtZWFzdXJlLmZpcnN0Q2hpbGQub2Zmc2V0SGVpZ2h0ICE9IDApXG4gICAgICB7IHp3c3BTdXBwb3J0ZWQgPSB0ZXN0Lm9mZnNldFdpZHRoIDw9IDEgJiYgdGVzdC5vZmZzZXRIZWlnaHQgPiAyICYmICEoaWUgJiYgaWVfdmVyc2lvbiA8IDgpOyB9XG4gIH1cbiAgdmFyIG5vZGUgPSB6d3NwU3VwcG9ydGVkID8gZWx0KFwic3BhblwiLCBcIlxcdTIwMGJcIikgOlxuICAgIGVsdChcInNwYW5cIiwgXCJcXHUwMGEwXCIsIG51bGwsIFwiZGlzcGxheTogaW5saW5lLWJsb2NrOyB3aWR0aDogMXB4OyBtYXJnaW4tcmlnaHQ6IC0xcHhcIik7XG4gIG5vZGUuc2V0QXR0cmlidXRlKFwiY20tdGV4dFwiLCBcIlwiKTtcbiAgcmV0dXJuIG5vZGVcbn1cblxuLy8gRmVhdHVyZS1kZXRlY3QgSUUncyBjcnVtbXkgY2xpZW50IHJlY3QgcmVwb3J0aW5nIGZvciBiaWRpIHRleHRcbnZhciBiYWRCaWRpUmVjdHM7XG5mdW5jdGlvbiBoYXNCYWRCaWRpUmVjdHMobWVhc3VyZSkge1xuICBpZiAoYmFkQmlkaVJlY3RzICE9IG51bGwpIHsgcmV0dXJuIGJhZEJpZGlSZWN0cyB9XG4gIHZhciB0eHQgPSByZW1vdmVDaGlsZHJlbkFuZEFkZChtZWFzdXJlLCBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIkFcXHUwNjJlQVwiKSk7XG4gIHZhciByMCA9IHJhbmdlKHR4dCwgMCwgMSkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gIHZhciByMSA9IHJhbmdlKHR4dCwgMSwgMikuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gIHJlbW92ZUNoaWxkcmVuKG1lYXN1cmUpO1xuICBpZiAoIXIwIHx8IHIwLmxlZnQgPT0gcjAucmlnaHQpIHsgcmV0dXJuIGZhbHNlIH0gLy8gU2FmYXJpIHJldHVybnMgbnVsbCBpbiBzb21lIGNhc2VzICgjMjc4MClcbiAgcmV0dXJuIGJhZEJpZGlSZWN0cyA9IChyMS5yaWdodCAtIHIwLnJpZ2h0IDwgMylcbn1cblxuLy8gU2VlIGlmIFwiXCIuc3BsaXQgaXMgdGhlIGJyb2tlbiBJRSB2ZXJzaW9uLCBpZiBzbywgcHJvdmlkZSBhblxuLy8gYWx0ZXJuYXRpdmUgd2F5IHRvIHNwbGl0IGxpbmVzLlxudmFyIHNwbGl0TGluZXNBdXRvID0gXCJcXG5cXG5iXCIuc3BsaXQoL1xcbi8pLmxlbmd0aCAhPSAzID8gZnVuY3Rpb24gKHN0cmluZykge1xuICB2YXIgcG9zID0gMCwgcmVzdWx0ID0gW10sIGwgPSBzdHJpbmcubGVuZ3RoO1xuICB3aGlsZSAocG9zIDw9IGwpIHtcbiAgICB2YXIgbmwgPSBzdHJpbmcuaW5kZXhPZihcIlxcblwiLCBwb3MpO1xuICAgIGlmIChubCA9PSAtMSkgeyBubCA9IHN0cmluZy5sZW5ndGg7IH1cbiAgICB2YXIgbGluZSA9IHN0cmluZy5zbGljZShwb3MsIHN0cmluZy5jaGFyQXQobmwgLSAxKSA9PSBcIlxcclwiID8gbmwgLSAxIDogbmwpO1xuICAgIHZhciBydCA9IGxpbmUuaW5kZXhPZihcIlxcclwiKTtcbiAgICBpZiAocnQgIT0gLTEpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGxpbmUuc2xpY2UoMCwgcnQpKTtcbiAgICAgIHBvcyArPSBydCArIDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdC5wdXNoKGxpbmUpO1xuICAgICAgcG9zID0gbmwgKyAxO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0XG59IDogZnVuY3Rpb24gKHN0cmluZykgeyByZXR1cm4gc3RyaW5nLnNwbGl0KC9cXHJcXG4/fFxcbi8pOyB9O1xuXG52YXIgaGFzU2VsZWN0aW9uID0gd2luZG93LmdldFNlbGVjdGlvbiA/IGZ1bmN0aW9uICh0ZSkge1xuICB0cnkgeyByZXR1cm4gdGUuc2VsZWN0aW9uU3RhcnQgIT0gdGUuc2VsZWN0aW9uRW5kIH1cbiAgY2F0Y2goZSkgeyByZXR1cm4gZmFsc2UgfVxufSA6IGZ1bmN0aW9uICh0ZSkge1xuICB2YXIgcmFuZ2UkJDE7XG4gIHRyeSB7cmFuZ2UkJDEgPSB0ZS5vd25lckRvY3VtZW50LnNlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO31cbiAgY2F0Y2goZSkge31cbiAgaWYgKCFyYW5nZSQkMSB8fCByYW5nZSQkMS5wYXJlbnRFbGVtZW50KCkgIT0gdGUpIHsgcmV0dXJuIGZhbHNlIH1cbiAgcmV0dXJuIHJhbmdlJCQxLmNvbXBhcmVFbmRQb2ludHMoXCJTdGFydFRvRW5kXCIsIHJhbmdlJCQxKSAhPSAwXG59O1xuXG52YXIgaGFzQ29weUV2ZW50ID0gKGZ1bmN0aW9uICgpIHtcbiAgdmFyIGUgPSBlbHQoXCJkaXZcIik7XG4gIGlmIChcIm9uY29weVwiIGluIGUpIHsgcmV0dXJuIHRydWUgfVxuICBlLnNldEF0dHJpYnV0ZShcIm9uY29weVwiLCBcInJldHVybjtcIik7XG4gIHJldHVybiB0eXBlb2YgZS5vbmNvcHkgPT0gXCJmdW5jdGlvblwiXG59KSgpO1xuXG52YXIgYmFkWm9vbWVkUmVjdHMgPSBudWxsO1xuZnVuY3Rpb24gaGFzQmFkWm9vbWVkUmVjdHMobWVhc3VyZSkge1xuICBpZiAoYmFkWm9vbWVkUmVjdHMgIT0gbnVsbCkgeyByZXR1cm4gYmFkWm9vbWVkUmVjdHMgfVxuICB2YXIgbm9kZSA9IHJlbW92ZUNoaWxkcmVuQW5kQWRkKG1lYXN1cmUsIGVsdChcInNwYW5cIiwgXCJ4XCIpKTtcbiAgdmFyIG5vcm1hbCA9IG5vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gIHZhciBmcm9tUmFuZ2UgPSByYW5nZShub2RlLCAwLCAxKS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgcmV0dXJuIGJhZFpvb21lZFJlY3RzID0gTWF0aC5hYnMobm9ybWFsLmxlZnQgLSBmcm9tUmFuZ2UubGVmdCkgPiAxXG59XG5cbi8vIEtub3duIG1vZGVzLCBieSBuYW1lIGFuZCBieSBNSU1FXG52YXIgbW9kZXMgPSB7fTtcbnZhciBtaW1lTW9kZXMgPSB7fTtcblxuLy8gRXh0cmEgYXJndW1lbnRzIGFyZSBzdG9yZWQgYXMgdGhlIG1vZGUncyBkZXBlbmRlbmNpZXMsIHdoaWNoIGlzXG4vLyB1c2VkIGJ5IChsZWdhY3kpIG1lY2hhbmlzbXMgbGlrZSBsb2FkbW9kZS5qcyB0byBhdXRvbWF0aWNhbGx5XG4vLyBsb2FkIGEgbW9kZS4gKFByZWZlcnJlZCBtZWNoYW5pc20gaXMgdGhlIHJlcXVpcmUvZGVmaW5lIGNhbGxzLilcbmZ1bmN0aW9uIGRlZmluZU1vZGUobmFtZSwgbW9kZSkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDIpXG4gICAgeyBtb2RlLmRlcGVuZGVuY2llcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7IH1cbiAgbW9kZXNbbmFtZV0gPSBtb2RlO1xufVxuXG5mdW5jdGlvbiBkZWZpbmVNSU1FKG1pbWUsIHNwZWMpIHtcbiAgbWltZU1vZGVzW21pbWVdID0gc3BlYztcbn1cblxuLy8gR2l2ZW4gYSBNSU1FIHR5cGUsIGEge25hbWUsIC4uLm9wdGlvbnN9IGNvbmZpZyBvYmplY3QsIG9yIGEgbmFtZVxuLy8gc3RyaW5nLCByZXR1cm4gYSBtb2RlIGNvbmZpZyBvYmplY3QuXG5mdW5jdGlvbiByZXNvbHZlTW9kZShzcGVjKSB7XG4gIGlmICh0eXBlb2Ygc3BlYyA9PSBcInN0cmluZ1wiICYmIG1pbWVNb2Rlcy5oYXNPd25Qcm9wZXJ0eShzcGVjKSkge1xuICAgIHNwZWMgPSBtaW1lTW9kZXNbc3BlY107XG4gIH0gZWxzZSBpZiAoc3BlYyAmJiB0eXBlb2Ygc3BlYy5uYW1lID09IFwic3RyaW5nXCIgJiYgbWltZU1vZGVzLmhhc093blByb3BlcnR5KHNwZWMubmFtZSkpIHtcbiAgICB2YXIgZm91bmQgPSBtaW1lTW9kZXNbc3BlYy5uYW1lXTtcbiAgICBpZiAodHlwZW9mIGZvdW5kID09IFwic3RyaW5nXCIpIHsgZm91bmQgPSB7bmFtZTogZm91bmR9OyB9XG4gICAgc3BlYyA9IGNyZWF0ZU9iaihmb3VuZCwgc3BlYyk7XG4gICAgc3BlYy5uYW1lID0gZm91bmQubmFtZTtcbiAgfSBlbHNlIGlmICh0eXBlb2Ygc3BlYyA9PSBcInN0cmluZ1wiICYmIC9eW1xcd1xcLV0rXFwvW1xcd1xcLV0rXFwreG1sJC8udGVzdChzcGVjKSkge1xuICAgIHJldHVybiByZXNvbHZlTW9kZShcImFwcGxpY2F0aW9uL3htbFwiKVxuICB9IGVsc2UgaWYgKHR5cGVvZiBzcGVjID09IFwic3RyaW5nXCIgJiYgL15bXFx3XFwtXStcXC9bXFx3XFwtXStcXCtqc29uJC8udGVzdChzcGVjKSkge1xuICAgIHJldHVybiByZXNvbHZlTW9kZShcImFwcGxpY2F0aW9uL2pzb25cIilcbiAgfVxuICBpZiAodHlwZW9mIHNwZWMgPT0gXCJzdHJpbmdcIikgeyByZXR1cm4ge25hbWU6IHNwZWN9IH1cbiAgZWxzZSB7IHJldHVybiBzcGVjIHx8IHtuYW1lOiBcIm51bGxcIn0gfVxufVxuXG4vLyBHaXZlbiBhIG1vZGUgc3BlYyAoYW55dGhpbmcgdGhhdCByZXNvbHZlTW9kZSBhY2NlcHRzKSwgZmluZCBhbmRcbi8vIGluaXRpYWxpemUgYW4gYWN0dWFsIG1vZGUgb2JqZWN0LlxuZnVuY3Rpb24gZ2V0TW9kZShvcHRpb25zLCBzcGVjKSB7XG4gIHNwZWMgPSByZXNvbHZlTW9kZShzcGVjKTtcbiAgdmFyIG1mYWN0b3J5ID0gbW9kZXNbc3BlYy5uYW1lXTtcbiAgaWYgKCFtZmFjdG9yeSkgeyByZXR1cm4gZ2V0TW9kZShvcHRpb25zLCBcInRleHQvcGxhaW5cIikgfVxuICB2YXIgbW9kZU9iaiA9IG1mYWN0b3J5KG9wdGlvbnMsIHNwZWMpO1xuICBpZiAobW9kZUV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoc3BlYy5uYW1lKSkge1xuICAgIHZhciBleHRzID0gbW9kZUV4dGVuc2lvbnNbc3BlYy5uYW1lXTtcbiAgICBmb3IgKHZhciBwcm9wIGluIGV4dHMpIHtcbiAgICAgIGlmICghZXh0cy5oYXNPd25Qcm9wZXJ0eShwcm9wKSkgeyBjb250aW51ZSB9XG4gICAgICBpZiAobW9kZU9iai5oYXNPd25Qcm9wZXJ0eShwcm9wKSkgeyBtb2RlT2JqW1wiX1wiICsgcHJvcF0gPSBtb2RlT2JqW3Byb3BdOyB9XG4gICAgICBtb2RlT2JqW3Byb3BdID0gZXh0c1twcm9wXTtcbiAgICB9XG4gIH1cbiAgbW9kZU9iai5uYW1lID0gc3BlYy5uYW1lO1xuICBpZiAoc3BlYy5oZWxwZXJUeXBlKSB7IG1vZGVPYmouaGVscGVyVHlwZSA9IHNwZWMuaGVscGVyVHlwZTsgfVxuICBpZiAoc3BlYy5tb2RlUHJvcHMpIHsgZm9yICh2YXIgcHJvcCQxIGluIHNwZWMubW9kZVByb3BzKVxuICAgIHsgbW9kZU9ialtwcm9wJDFdID0gc3BlYy5tb2RlUHJvcHNbcHJvcCQxXTsgfSB9XG5cbiAgcmV0dXJuIG1vZGVPYmpcbn1cblxuLy8gVGhpcyBjYW4gYmUgdXNlZCB0byBhdHRhY2ggcHJvcGVydGllcyB0byBtb2RlIG9iamVjdHMgZnJvbVxuLy8gb3V0c2lkZSB0aGUgYWN0dWFsIG1vZGUgZGVmaW5pdGlvbi5cbnZhciBtb2RlRXh0ZW5zaW9ucyA9IHt9O1xuZnVuY3Rpb24gZXh0ZW5kTW9kZShtb2RlLCBwcm9wZXJ0aWVzKSB7XG4gIHZhciBleHRzID0gbW9kZUV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkobW9kZSkgPyBtb2RlRXh0ZW5zaW9uc1ttb2RlXSA6IChtb2RlRXh0ZW5zaW9uc1ttb2RlXSA9IHt9KTtcbiAgY29weU9iaihwcm9wZXJ0aWVzLCBleHRzKTtcbn1cblxuZnVuY3Rpb24gY29weVN0YXRlKG1vZGUsIHN0YXRlKSB7XG4gIGlmIChzdGF0ZSA9PT0gdHJ1ZSkgeyByZXR1cm4gc3RhdGUgfVxuICBpZiAobW9kZS5jb3B5U3RhdGUpIHsgcmV0dXJuIG1vZGUuY29weVN0YXRlKHN0YXRlKSB9XG4gIHZhciBuc3RhdGUgPSB7fTtcbiAgZm9yICh2YXIgbiBpbiBzdGF0ZSkge1xuICAgIHZhciB2YWwgPSBzdGF0ZVtuXTtcbiAgICBpZiAodmFsIGluc3RhbmNlb2YgQXJyYXkpIHsgdmFsID0gdmFsLmNvbmNhdChbXSk7IH1cbiAgICBuc3RhdGVbbl0gPSB2YWw7XG4gIH1cbiAgcmV0dXJuIG5zdGF0ZVxufVxuXG4vLyBHaXZlbiBhIG1vZGUgYW5kIGEgc3RhdGUgKGZvciB0aGF0IG1vZGUpLCBmaW5kIHRoZSBpbm5lciBtb2RlIGFuZFxuLy8gc3RhdGUgYXQgdGhlIHBvc2l0aW9uIHRoYXQgdGhlIHN0YXRlIHJlZmVycyB0by5cbmZ1bmN0aW9uIGlubmVyTW9kZShtb2RlLCBzdGF0ZSkge1xuICB2YXIgaW5mbztcbiAgd2hpbGUgKG1vZGUuaW5uZXJNb2RlKSB7XG4gICAgaW5mbyA9IG1vZGUuaW5uZXJNb2RlKHN0YXRlKTtcbiAgICBpZiAoIWluZm8gfHwgaW5mby5tb2RlID09IG1vZGUpIHsgYnJlYWsgfVxuICAgIHN0YXRlID0gaW5mby5zdGF0ZTtcbiAgICBtb2RlID0gaW5mby5tb2RlO1xuICB9XG4gIHJldHVybiBpbmZvIHx8IHttb2RlOiBtb2RlLCBzdGF0ZTogc3RhdGV9XG59XG5cbmZ1bmN0aW9uIHN0YXJ0U3RhdGUobW9kZSwgYTEsIGEyKSB7XG4gIHJldHVybiBtb2RlLnN0YXJ0U3RhdGUgPyBtb2RlLnN0YXJ0U3RhdGUoYTEsIGEyKSA6IHRydWVcbn1cblxuLy8gU1RSSU5HIFNUUkVBTVxuXG4vLyBGZWQgdG8gdGhlIG1vZGUgcGFyc2VycywgcHJvdmlkZXMgaGVscGVyIGZ1bmN0aW9ucyB0byBtYWtlXG4vLyBwYXJzZXJzIG1vcmUgc3VjY2luY3QuXG5cbnZhciBTdHJpbmdTdHJlYW0gPSBmdW5jdGlvbihzdHJpbmcsIHRhYlNpemUsIGxpbmVPcmFjbGUpIHtcbiAgdGhpcy5wb3MgPSB0aGlzLnN0YXJ0ID0gMDtcbiAgdGhpcy5zdHJpbmcgPSBzdHJpbmc7XG4gIHRoaXMudGFiU2l6ZSA9IHRhYlNpemUgfHwgODtcbiAgdGhpcy5sYXN0Q29sdW1uUG9zID0gdGhpcy5sYXN0Q29sdW1uVmFsdWUgPSAwO1xuICB0aGlzLmxpbmVTdGFydCA9IDA7XG4gIHRoaXMubGluZU9yYWNsZSA9IGxpbmVPcmFjbGU7XG59O1xuXG5TdHJpbmdTdHJlYW0ucHJvdG90eXBlLmVvbCA9IGZ1bmN0aW9uICgpIHtyZXR1cm4gdGhpcy5wb3MgPj0gdGhpcy5zdHJpbmcubGVuZ3RofTtcblN0cmluZ1N0cmVhbS5wcm90b3R5cGUuc29sID0gZnVuY3Rpb24gKCkge3JldHVybiB0aGlzLnBvcyA9PSB0aGlzLmxpbmVTdGFydH07XG5TdHJpbmdTdHJlYW0ucHJvdG90eXBlLnBlZWsgPSBmdW5jdGlvbiAoKSB7cmV0dXJuIHRoaXMuc3RyaW5nLmNoYXJBdCh0aGlzLnBvcykgfHwgdW5kZWZpbmVkfTtcblN0cmluZ1N0cmVhbS5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMucG9zIDwgdGhpcy5zdHJpbmcubGVuZ3RoKVxuICAgIHsgcmV0dXJuIHRoaXMuc3RyaW5nLmNoYXJBdCh0aGlzLnBvcysrKSB9XG59O1xuU3RyaW5nU3RyZWFtLnByb3RvdHlwZS5lYXQgPSBmdW5jdGlvbiAobWF0Y2gpIHtcbiAgdmFyIGNoID0gdGhpcy5zdHJpbmcuY2hhckF0KHRoaXMucG9zKTtcbiAgdmFyIG9rO1xuICBpZiAodHlwZW9mIG1hdGNoID09IFwic3RyaW5nXCIpIHsgb2sgPSBjaCA9PSBtYXRjaDsgfVxuICBlbHNlIHsgb2sgPSBjaCAmJiAobWF0Y2gudGVzdCA/IG1hdGNoLnRlc3QoY2gpIDogbWF0Y2goY2gpKTsgfVxuICBpZiAob2spIHsrK3RoaXMucG9zOyByZXR1cm4gY2h9XG59O1xuU3RyaW5nU3RyZWFtLnByb3RvdHlwZS5lYXRXaGlsZSA9IGZ1bmN0aW9uIChtYXRjaCkge1xuICB2YXIgc3RhcnQgPSB0aGlzLnBvcztcbiAgd2hpbGUgKHRoaXMuZWF0KG1hdGNoKSl7fVxuICByZXR1cm4gdGhpcy5wb3MgPiBzdGFydFxufTtcblN0cmluZ1N0cmVhbS5wcm90b3R5cGUuZWF0U3BhY2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgdmFyIHN0YXJ0ID0gdGhpcy5wb3M7XG4gIHdoaWxlICgvW1xcc1xcdTAwYTBdLy50ZXN0KHRoaXMuc3RyaW5nLmNoYXJBdCh0aGlzLnBvcykpKSB7ICsrdGhpcyQxLnBvczsgfVxuICByZXR1cm4gdGhpcy5wb3MgPiBzdGFydFxufTtcblN0cmluZ1N0cmVhbS5wcm90b3R5cGUuc2tpcFRvRW5kID0gZnVuY3Rpb24gKCkge3RoaXMucG9zID0gdGhpcy5zdHJpbmcubGVuZ3RoO307XG5TdHJpbmdTdHJlYW0ucHJvdG90eXBlLnNraXBUbyA9IGZ1bmN0aW9uIChjaCkge1xuICB2YXIgZm91bmQgPSB0aGlzLnN0cmluZy5pbmRleE9mKGNoLCB0aGlzLnBvcyk7XG4gIGlmIChmb3VuZCA+IC0xKSB7dGhpcy5wb3MgPSBmb3VuZDsgcmV0dXJuIHRydWV9XG59O1xuU3RyaW5nU3RyZWFtLnByb3RvdHlwZS5iYWNrVXAgPSBmdW5jdGlvbiAobikge3RoaXMucG9zIC09IG47fTtcblN0cmluZ1N0cmVhbS5wcm90b3R5cGUuY29sdW1uID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5sYXN0Q29sdW1uUG9zIDwgdGhpcy5zdGFydCkge1xuICAgIHRoaXMubGFzdENvbHVtblZhbHVlID0gY291bnRDb2x1bW4odGhpcy5zdHJpbmcsIHRoaXMuc3RhcnQsIHRoaXMudGFiU2l6ZSwgdGhpcy5sYXN0Q29sdW1uUG9zLCB0aGlzLmxhc3RDb2x1bW5WYWx1ZSk7XG4gICAgdGhpcy5sYXN0Q29sdW1uUG9zID0gdGhpcy5zdGFydDtcbiAgfVxuICByZXR1cm4gdGhpcy5sYXN0Q29sdW1uVmFsdWUgLSAodGhpcy5saW5lU3RhcnQgPyBjb3VudENvbHVtbih0aGlzLnN0cmluZywgdGhpcy5saW5lU3RhcnQsIHRoaXMudGFiU2l6ZSkgOiAwKVxufTtcblN0cmluZ1N0cmVhbS5wcm90b3R5cGUuaW5kZW50YXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBjb3VudENvbHVtbih0aGlzLnN0cmluZywgbnVsbCwgdGhpcy50YWJTaXplKSAtXG4gICAgKHRoaXMubGluZVN0YXJ0ID8gY291bnRDb2x1bW4odGhpcy5zdHJpbmcsIHRoaXMubGluZVN0YXJ0LCB0aGlzLnRhYlNpemUpIDogMClcbn07XG5TdHJpbmdTdHJlYW0ucHJvdG90eXBlLm1hdGNoID0gZnVuY3Rpb24gKHBhdHRlcm4sIGNvbnN1bWUsIGNhc2VJbnNlbnNpdGl2ZSkge1xuICBpZiAodHlwZW9mIHBhdHRlcm4gPT0gXCJzdHJpbmdcIikge1xuICAgIHZhciBjYXNlZCA9IGZ1bmN0aW9uIChzdHIpIHsgcmV0dXJuIGNhc2VJbnNlbnNpdGl2ZSA/IHN0ci50b0xvd2VyQ2FzZSgpIDogc3RyOyB9O1xuICAgIHZhciBzdWJzdHIgPSB0aGlzLnN0cmluZy5zdWJzdHIodGhpcy5wb3MsIHBhdHRlcm4ubGVuZ3RoKTtcbiAgICBpZiAoY2FzZWQoc3Vic3RyKSA9PSBjYXNlZChwYXR0ZXJuKSkge1xuICAgICAgaWYgKGNvbnN1bWUgIT09IGZhbHNlKSB7IHRoaXMucG9zICs9IHBhdHRlcm4ubGVuZ3RoOyB9XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgbWF0Y2ggPSB0aGlzLnN0cmluZy5zbGljZSh0aGlzLnBvcykubWF0Y2gocGF0dGVybik7XG4gICAgaWYgKG1hdGNoICYmIG1hdGNoLmluZGV4ID4gMCkgeyByZXR1cm4gbnVsbCB9XG4gICAgaWYgKG1hdGNoICYmIGNvbnN1bWUgIT09IGZhbHNlKSB7IHRoaXMucG9zICs9IG1hdGNoWzBdLmxlbmd0aDsgfVxuICAgIHJldHVybiBtYXRjaFxuICB9XG59O1xuU3RyaW5nU3RyZWFtLnByb3RvdHlwZS5jdXJyZW50ID0gZnVuY3Rpb24gKCl7cmV0dXJuIHRoaXMuc3RyaW5nLnNsaWNlKHRoaXMuc3RhcnQsIHRoaXMucG9zKX07XG5TdHJpbmdTdHJlYW0ucHJvdG90eXBlLmhpZGVGaXJzdENoYXJzID0gZnVuY3Rpb24gKG4sIGlubmVyKSB7XG4gIHRoaXMubGluZVN0YXJ0ICs9IG47XG4gIHRyeSB7IHJldHVybiBpbm5lcigpIH1cbiAgZmluYWxseSB7IHRoaXMubGluZVN0YXJ0IC09IG47IH1cbn07XG5TdHJpbmdTdHJlYW0ucHJvdG90eXBlLmxvb2tBaGVhZCA9IGZ1bmN0aW9uIChuKSB7XG4gIHZhciBvcmFjbGUgPSB0aGlzLmxpbmVPcmFjbGU7XG4gIHJldHVybiBvcmFjbGUgJiYgb3JhY2xlLmxvb2tBaGVhZChuKVxufTtcblN0cmluZ1N0cmVhbS5wcm90b3R5cGUuYmFzZVRva2VuID0gZnVuY3Rpb24gKCkge1xuICB2YXIgb3JhY2xlID0gdGhpcy5saW5lT3JhY2xlO1xuICByZXR1cm4gb3JhY2xlICYmIG9yYWNsZS5iYXNlVG9rZW4odGhpcy5wb3MpXG59O1xuXG52YXIgU2F2ZWRDb250ZXh0ID0gZnVuY3Rpb24oc3RhdGUsIGxvb2tBaGVhZCkge1xuICB0aGlzLnN0YXRlID0gc3RhdGU7XG4gIHRoaXMubG9va0FoZWFkID0gbG9va0FoZWFkO1xufTtcblxudmFyIENvbnRleHQgPSBmdW5jdGlvbihkb2MsIHN0YXRlLCBsaW5lLCBsb29rQWhlYWQpIHtcbiAgdGhpcy5zdGF0ZSA9IHN0YXRlO1xuICB0aGlzLmRvYyA9IGRvYztcbiAgdGhpcy5saW5lID0gbGluZTtcbiAgdGhpcy5tYXhMb29rQWhlYWQgPSBsb29rQWhlYWQgfHwgMDtcbiAgdGhpcy5iYXNlVG9rZW5zID0gbnVsbDtcbiAgdGhpcy5iYXNlVG9rZW5Qb3MgPSAxO1xufTtcblxuQ29udGV4dC5wcm90b3R5cGUubG9va0FoZWFkID0gZnVuY3Rpb24gKG4pIHtcbiAgdmFyIGxpbmUgPSB0aGlzLmRvYy5nZXRMaW5lKHRoaXMubGluZSArIG4pO1xuICBpZiAobGluZSAhPSBudWxsICYmIG4gPiB0aGlzLm1heExvb2tBaGVhZCkgeyB0aGlzLm1heExvb2tBaGVhZCA9IG47IH1cbiAgcmV0dXJuIGxpbmVcbn07XG5cbkNvbnRleHQucHJvdG90eXBlLmJhc2VUb2tlbiA9IGZ1bmN0aW9uIChuKSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgaWYgKCF0aGlzLmJhc2VUb2tlbnMpIHsgcmV0dXJuIG51bGwgfVxuICB3aGlsZSAodGhpcy5iYXNlVG9rZW5zW3RoaXMuYmFzZVRva2VuUG9zXSA8PSBuKVxuICAgIHsgdGhpcyQxLmJhc2VUb2tlblBvcyArPSAyOyB9XG4gIHZhciB0eXBlID0gdGhpcy5iYXNlVG9rZW5zW3RoaXMuYmFzZVRva2VuUG9zICsgMV07XG4gIHJldHVybiB7dHlwZTogdHlwZSAmJiB0eXBlLnJlcGxhY2UoLyggfF4pb3ZlcmxheSAuKi8sIFwiXCIpLFxuICAgICAgICAgIHNpemU6IHRoaXMuYmFzZVRva2Vuc1t0aGlzLmJhc2VUb2tlblBvc10gLSBufVxufTtcblxuQ29udGV4dC5wcm90b3R5cGUubmV4dExpbmUgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMubGluZSsrO1xuICBpZiAodGhpcy5tYXhMb29rQWhlYWQgPiAwKSB7IHRoaXMubWF4TG9va0FoZWFkLS07IH1cbn07XG5cbkNvbnRleHQuZnJvbVNhdmVkID0gZnVuY3Rpb24gKGRvYywgc2F2ZWQsIGxpbmUpIHtcbiAgaWYgKHNhdmVkIGluc3RhbmNlb2YgU2F2ZWRDb250ZXh0KVxuICAgIHsgcmV0dXJuIG5ldyBDb250ZXh0KGRvYywgY29weVN0YXRlKGRvYy5tb2RlLCBzYXZlZC5zdGF0ZSksIGxpbmUsIHNhdmVkLmxvb2tBaGVhZCkgfVxuICBlbHNlXG4gICAgeyByZXR1cm4gbmV3IENvbnRleHQoZG9jLCBjb3B5U3RhdGUoZG9jLm1vZGUsIHNhdmVkKSwgbGluZSkgfVxufTtcblxuQ29udGV4dC5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uIChjb3B5KSB7XG4gIHZhciBzdGF0ZSA9IGNvcHkgIT09IGZhbHNlID8gY29weVN0YXRlKHRoaXMuZG9jLm1vZGUsIHRoaXMuc3RhdGUpIDogdGhpcy5zdGF0ZTtcbiAgcmV0dXJuIHRoaXMubWF4TG9va0FoZWFkID4gMCA/IG5ldyBTYXZlZENvbnRleHQoc3RhdGUsIHRoaXMubWF4TG9va0FoZWFkKSA6IHN0YXRlXG59O1xuXG5cbi8vIENvbXB1dGUgYSBzdHlsZSBhcnJheSAoYW4gYXJyYXkgc3RhcnRpbmcgd2l0aCBhIG1vZGUgZ2VuZXJhdGlvblxuLy8gLS0gZm9yIGludmFsaWRhdGlvbiAtLSBmb2xsb3dlZCBieSBwYWlycyBvZiBlbmQgcG9zaXRpb25zIGFuZFxuLy8gc3R5bGUgc3RyaW5ncyksIHdoaWNoIGlzIHVzZWQgdG8gaGlnaGxpZ2h0IHRoZSB0b2tlbnMgb24gdGhlXG4vLyBsaW5lLlxuZnVuY3Rpb24gaGlnaGxpZ2h0TGluZShjbSwgbGluZSwgY29udGV4dCwgZm9yY2VUb0VuZCkge1xuICAvLyBBIHN0eWxlcyBhcnJheSBhbHdheXMgc3RhcnRzIHdpdGggYSBudW1iZXIgaWRlbnRpZnlpbmcgdGhlXG4gIC8vIG1vZGUvb3ZlcmxheXMgdGhhdCBpdCBpcyBiYXNlZCBvbiAoZm9yIGVhc3kgaW52YWxpZGF0aW9uKS5cbiAgdmFyIHN0ID0gW2NtLnN0YXRlLm1vZGVHZW5dLCBsaW5lQ2xhc3NlcyA9IHt9O1xuICAvLyBDb21wdXRlIHRoZSBiYXNlIGFycmF5IG9mIHN0eWxlc1xuICBydW5Nb2RlKGNtLCBsaW5lLnRleHQsIGNtLmRvYy5tb2RlLCBjb250ZXh0LCBmdW5jdGlvbiAoZW5kLCBzdHlsZSkgeyByZXR1cm4gc3QucHVzaChlbmQsIHN0eWxlKTsgfSxcbiAgICAgICAgICBsaW5lQ2xhc3NlcywgZm9yY2VUb0VuZCk7XG4gIHZhciBzdGF0ZSA9IGNvbnRleHQuc3RhdGU7XG5cbiAgLy8gUnVuIG92ZXJsYXlzLCBhZGp1c3Qgc3R5bGUgYXJyYXkuXG4gIHZhciBsb29wID0gZnVuY3Rpb24gKCBvICkge1xuICAgIGNvbnRleHQuYmFzZVRva2VucyA9IHN0O1xuICAgIHZhciBvdmVybGF5ID0gY20uc3RhdGUub3ZlcmxheXNbb10sIGkgPSAxLCBhdCA9IDA7XG4gICAgY29udGV4dC5zdGF0ZSA9IHRydWU7XG4gICAgcnVuTW9kZShjbSwgbGluZS50ZXh0LCBvdmVybGF5Lm1vZGUsIGNvbnRleHQsIGZ1bmN0aW9uIChlbmQsIHN0eWxlKSB7XG4gICAgICB2YXIgc3RhcnQgPSBpO1xuICAgICAgLy8gRW5zdXJlIHRoZXJlJ3MgYSB0b2tlbiBlbmQgYXQgdGhlIGN1cnJlbnQgcG9zaXRpb24sIGFuZCB0aGF0IGkgcG9pbnRzIGF0IGl0XG4gICAgICB3aGlsZSAoYXQgPCBlbmQpIHtcbiAgICAgICAgdmFyIGlfZW5kID0gc3RbaV07XG4gICAgICAgIGlmIChpX2VuZCA+IGVuZClcbiAgICAgICAgICB7IHN0LnNwbGljZShpLCAxLCBlbmQsIHN0W2krMV0sIGlfZW5kKTsgfVxuICAgICAgICBpICs9IDI7XG4gICAgICAgIGF0ID0gTWF0aC5taW4oZW5kLCBpX2VuZCk7XG4gICAgICB9XG4gICAgICBpZiAoIXN0eWxlKSB7IHJldHVybiB9XG4gICAgICBpZiAob3ZlcmxheS5vcGFxdWUpIHtcbiAgICAgICAgc3Quc3BsaWNlKHN0YXJ0LCBpIC0gc3RhcnQsIGVuZCwgXCJvdmVybGF5IFwiICsgc3R5bGUpO1xuICAgICAgICBpID0gc3RhcnQgKyAyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yICg7IHN0YXJ0IDwgaTsgc3RhcnQgKz0gMikge1xuICAgICAgICAgIHZhciBjdXIgPSBzdFtzdGFydCsxXTtcbiAgICAgICAgICBzdFtzdGFydCsxXSA9IChjdXIgPyBjdXIgKyBcIiBcIiA6IFwiXCIpICsgXCJvdmVybGF5IFwiICsgc3R5bGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LCBsaW5lQ2xhc3Nlcyk7XG4gICAgY29udGV4dC5zdGF0ZSA9IHN0YXRlO1xuICAgIGNvbnRleHQuYmFzZVRva2VucyA9IG51bGw7XG4gICAgY29udGV4dC5iYXNlVG9rZW5Qb3MgPSAxO1xuICB9O1xuXG4gIGZvciAodmFyIG8gPSAwOyBvIDwgY20uc3RhdGUub3ZlcmxheXMubGVuZ3RoOyArK28pIGxvb3AoIG8gKTtcblxuICByZXR1cm4ge3N0eWxlczogc3QsIGNsYXNzZXM6IGxpbmVDbGFzc2VzLmJnQ2xhc3MgfHwgbGluZUNsYXNzZXMudGV4dENsYXNzID8gbGluZUNsYXNzZXMgOiBudWxsfVxufVxuXG5mdW5jdGlvbiBnZXRMaW5lU3R5bGVzKGNtLCBsaW5lLCB1cGRhdGVGcm9udGllcikge1xuICBpZiAoIWxpbmUuc3R5bGVzIHx8IGxpbmUuc3R5bGVzWzBdICE9IGNtLnN0YXRlLm1vZGVHZW4pIHtcbiAgICB2YXIgY29udGV4dCA9IGdldENvbnRleHRCZWZvcmUoY20sIGxpbmVObyhsaW5lKSk7XG4gICAgdmFyIHJlc2V0U3RhdGUgPSBsaW5lLnRleHQubGVuZ3RoID4gY20ub3B0aW9ucy5tYXhIaWdobGlnaHRMZW5ndGggJiYgY29weVN0YXRlKGNtLmRvYy5tb2RlLCBjb250ZXh0LnN0YXRlKTtcbiAgICB2YXIgcmVzdWx0ID0gaGlnaGxpZ2h0TGluZShjbSwgbGluZSwgY29udGV4dCk7XG4gICAgaWYgKHJlc2V0U3RhdGUpIHsgY29udGV4dC5zdGF0ZSA9IHJlc2V0U3RhdGU7IH1cbiAgICBsaW5lLnN0YXRlQWZ0ZXIgPSBjb250ZXh0LnNhdmUoIXJlc2V0U3RhdGUpO1xuICAgIGxpbmUuc3R5bGVzID0gcmVzdWx0LnN0eWxlcztcbiAgICBpZiAocmVzdWx0LmNsYXNzZXMpIHsgbGluZS5zdHlsZUNsYXNzZXMgPSByZXN1bHQuY2xhc3NlczsgfVxuICAgIGVsc2UgaWYgKGxpbmUuc3R5bGVDbGFzc2VzKSB7IGxpbmUuc3R5bGVDbGFzc2VzID0gbnVsbDsgfVxuICAgIGlmICh1cGRhdGVGcm9udGllciA9PT0gY20uZG9jLmhpZ2hsaWdodEZyb250aWVyKVxuICAgICAgeyBjbS5kb2MubW9kZUZyb250aWVyID0gTWF0aC5tYXgoY20uZG9jLm1vZGVGcm9udGllciwgKytjbS5kb2MuaGlnaGxpZ2h0RnJvbnRpZXIpOyB9XG4gIH1cbiAgcmV0dXJuIGxpbmUuc3R5bGVzXG59XG5cbmZ1bmN0aW9uIGdldENvbnRleHRCZWZvcmUoY20sIG4sIHByZWNpc2UpIHtcbiAgdmFyIGRvYyA9IGNtLmRvYywgZGlzcGxheSA9IGNtLmRpc3BsYXk7XG4gIGlmICghZG9jLm1vZGUuc3RhcnRTdGF0ZSkgeyByZXR1cm4gbmV3IENvbnRleHQoZG9jLCB0cnVlLCBuKSB9XG4gIHZhciBzdGFydCA9IGZpbmRTdGFydExpbmUoY20sIG4sIHByZWNpc2UpO1xuICB2YXIgc2F2ZWQgPSBzdGFydCA+IGRvYy5maXJzdCAmJiBnZXRMaW5lKGRvYywgc3RhcnQgLSAxKS5zdGF0ZUFmdGVyO1xuICB2YXIgY29udGV4dCA9IHNhdmVkID8gQ29udGV4dC5mcm9tU2F2ZWQoZG9jLCBzYXZlZCwgc3RhcnQpIDogbmV3IENvbnRleHQoZG9jLCBzdGFydFN0YXRlKGRvYy5tb2RlKSwgc3RhcnQpO1xuXG4gIGRvYy5pdGVyKHN0YXJ0LCBuLCBmdW5jdGlvbiAobGluZSkge1xuICAgIHByb2Nlc3NMaW5lKGNtLCBsaW5lLnRleHQsIGNvbnRleHQpO1xuICAgIHZhciBwb3MgPSBjb250ZXh0LmxpbmU7XG4gICAgbGluZS5zdGF0ZUFmdGVyID0gcG9zID09IG4gLSAxIHx8IHBvcyAlIDUgPT0gMCB8fCBwb3MgPj0gZGlzcGxheS52aWV3RnJvbSAmJiBwb3MgPCBkaXNwbGF5LnZpZXdUbyA/IGNvbnRleHQuc2F2ZSgpIDogbnVsbDtcbiAgICBjb250ZXh0Lm5leHRMaW5lKCk7XG4gIH0pO1xuICBpZiAocHJlY2lzZSkgeyBkb2MubW9kZUZyb250aWVyID0gY29udGV4dC5saW5lOyB9XG4gIHJldHVybiBjb250ZXh0XG59XG5cbi8vIExpZ2h0d2VpZ2h0IGZvcm0gb2YgaGlnaGxpZ2h0IC0tIHByb2NlZWQgb3ZlciB0aGlzIGxpbmUgYW5kXG4vLyB1cGRhdGUgc3RhdGUsIGJ1dCBkb24ndCBzYXZlIGEgc3R5bGUgYXJyYXkuIFVzZWQgZm9yIGxpbmVzIHRoYXRcbi8vIGFyZW4ndCBjdXJyZW50bHkgdmlzaWJsZS5cbmZ1bmN0aW9uIHByb2Nlc3NMaW5lKGNtLCB0ZXh0LCBjb250ZXh0LCBzdGFydEF0KSB7XG4gIHZhciBtb2RlID0gY20uZG9jLm1vZGU7XG4gIHZhciBzdHJlYW0gPSBuZXcgU3RyaW5nU3RyZWFtKHRleHQsIGNtLm9wdGlvbnMudGFiU2l6ZSwgY29udGV4dCk7XG4gIHN0cmVhbS5zdGFydCA9IHN0cmVhbS5wb3MgPSBzdGFydEF0IHx8IDA7XG4gIGlmICh0ZXh0ID09IFwiXCIpIHsgY2FsbEJsYW5rTGluZShtb2RlLCBjb250ZXh0LnN0YXRlKTsgfVxuICB3aGlsZSAoIXN0cmVhbS5lb2woKSkge1xuICAgIHJlYWRUb2tlbihtb2RlLCBzdHJlYW0sIGNvbnRleHQuc3RhdGUpO1xuICAgIHN0cmVhbS5zdGFydCA9IHN0cmVhbS5wb3M7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2FsbEJsYW5rTGluZShtb2RlLCBzdGF0ZSkge1xuICBpZiAobW9kZS5ibGFua0xpbmUpIHsgcmV0dXJuIG1vZGUuYmxhbmtMaW5lKHN0YXRlKSB9XG4gIGlmICghbW9kZS5pbm5lck1vZGUpIHsgcmV0dXJuIH1cbiAgdmFyIGlubmVyID0gaW5uZXJNb2RlKG1vZGUsIHN0YXRlKTtcbiAgaWYgKGlubmVyLm1vZGUuYmxhbmtMaW5lKSB7IHJldHVybiBpbm5lci5tb2RlLmJsYW5rTGluZShpbm5lci5zdGF0ZSkgfVxufVxuXG5mdW5jdGlvbiByZWFkVG9rZW4obW9kZSwgc3RyZWFtLCBzdGF0ZSwgaW5uZXIpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCAxMDsgaSsrKSB7XG4gICAgaWYgKGlubmVyKSB7IGlubmVyWzBdID0gaW5uZXJNb2RlKG1vZGUsIHN0YXRlKS5tb2RlOyB9XG4gICAgdmFyIHN0eWxlID0gbW9kZS50b2tlbihzdHJlYW0sIHN0YXRlKTtcbiAgICBpZiAoc3RyZWFtLnBvcyA+IHN0cmVhbS5zdGFydCkgeyByZXR1cm4gc3R5bGUgfVxuICB9XG4gIHRocm93IG5ldyBFcnJvcihcIk1vZGUgXCIgKyBtb2RlLm5hbWUgKyBcIiBmYWlsZWQgdG8gYWR2YW5jZSBzdHJlYW0uXCIpXG59XG5cbnZhciBUb2tlbiA9IGZ1bmN0aW9uKHN0cmVhbSwgdHlwZSwgc3RhdGUpIHtcbiAgdGhpcy5zdGFydCA9IHN0cmVhbS5zdGFydDsgdGhpcy5lbmQgPSBzdHJlYW0ucG9zO1xuICB0aGlzLnN0cmluZyA9IHN0cmVhbS5jdXJyZW50KCk7XG4gIHRoaXMudHlwZSA9IHR5cGUgfHwgbnVsbDtcbiAgdGhpcy5zdGF0ZSA9IHN0YXRlO1xufTtcblxuLy8gVXRpbGl0eSBmb3IgZ2V0VG9rZW5BdCBhbmQgZ2V0TGluZVRva2Vuc1xuZnVuY3Rpb24gdGFrZVRva2VuKGNtLCBwb3MsIHByZWNpc2UsIGFzQXJyYXkpIHtcbiAgdmFyIGRvYyA9IGNtLmRvYywgbW9kZSA9IGRvYy5tb2RlLCBzdHlsZTtcbiAgcG9zID0gY2xpcFBvcyhkb2MsIHBvcyk7XG4gIHZhciBsaW5lID0gZ2V0TGluZShkb2MsIHBvcy5saW5lKSwgY29udGV4dCA9IGdldENvbnRleHRCZWZvcmUoY20sIHBvcy5saW5lLCBwcmVjaXNlKTtcbiAgdmFyIHN0cmVhbSA9IG5ldyBTdHJpbmdTdHJlYW0obGluZS50ZXh0LCBjbS5vcHRpb25zLnRhYlNpemUsIGNvbnRleHQpLCB0b2tlbnM7XG4gIGlmIChhc0FycmF5KSB7IHRva2VucyA9IFtdOyB9XG4gIHdoaWxlICgoYXNBcnJheSB8fCBzdHJlYW0ucG9zIDwgcG9zLmNoKSAmJiAhc3RyZWFtLmVvbCgpKSB7XG4gICAgc3RyZWFtLnN0YXJ0ID0gc3RyZWFtLnBvcztcbiAgICBzdHlsZSA9IHJlYWRUb2tlbihtb2RlLCBzdHJlYW0sIGNvbnRleHQuc3RhdGUpO1xuICAgIGlmIChhc0FycmF5KSB7IHRva2Vucy5wdXNoKG5ldyBUb2tlbihzdHJlYW0sIHN0eWxlLCBjb3B5U3RhdGUoZG9jLm1vZGUsIGNvbnRleHQuc3RhdGUpKSk7IH1cbiAgfVxuICByZXR1cm4gYXNBcnJheSA/IHRva2VucyA6IG5ldyBUb2tlbihzdHJlYW0sIHN0eWxlLCBjb250ZXh0LnN0YXRlKVxufVxuXG5mdW5jdGlvbiBleHRyYWN0TGluZUNsYXNzZXModHlwZSwgb3V0cHV0KSB7XG4gIGlmICh0eXBlKSB7IGZvciAoOzspIHtcbiAgICB2YXIgbGluZUNsYXNzID0gdHlwZS5tYXRjaCgvKD86XnxcXHMrKWxpbmUtKGJhY2tncm91bmQtKT8oXFxTKykvKTtcbiAgICBpZiAoIWxpbmVDbGFzcykgeyBicmVhayB9XG4gICAgdHlwZSA9IHR5cGUuc2xpY2UoMCwgbGluZUNsYXNzLmluZGV4KSArIHR5cGUuc2xpY2UobGluZUNsYXNzLmluZGV4ICsgbGluZUNsYXNzWzBdLmxlbmd0aCk7XG4gICAgdmFyIHByb3AgPSBsaW5lQ2xhc3NbMV0gPyBcImJnQ2xhc3NcIiA6IFwidGV4dENsYXNzXCI7XG4gICAgaWYgKG91dHB1dFtwcm9wXSA9PSBudWxsKVxuICAgICAgeyBvdXRwdXRbcHJvcF0gPSBsaW5lQ2xhc3NbMl07IH1cbiAgICBlbHNlIGlmICghKG5ldyBSZWdFeHAoXCIoPzpefFxccylcIiArIGxpbmVDbGFzc1syXSArIFwiKD86JHxcXHMpXCIpKS50ZXN0KG91dHB1dFtwcm9wXSkpXG4gICAgICB7IG91dHB1dFtwcm9wXSArPSBcIiBcIiArIGxpbmVDbGFzc1syXTsgfVxuICB9IH1cbiAgcmV0dXJuIHR5cGVcbn1cblxuLy8gUnVuIHRoZSBnaXZlbiBtb2RlJ3MgcGFyc2VyIG92ZXIgYSBsaW5lLCBjYWxsaW5nIGYgZm9yIGVhY2ggdG9rZW4uXG5mdW5jdGlvbiBydW5Nb2RlKGNtLCB0ZXh0LCBtb2RlLCBjb250ZXh0LCBmLCBsaW5lQ2xhc3NlcywgZm9yY2VUb0VuZCkge1xuICB2YXIgZmxhdHRlblNwYW5zID0gbW9kZS5mbGF0dGVuU3BhbnM7XG4gIGlmIChmbGF0dGVuU3BhbnMgPT0gbnVsbCkgeyBmbGF0dGVuU3BhbnMgPSBjbS5vcHRpb25zLmZsYXR0ZW5TcGFuczsgfVxuICB2YXIgY3VyU3RhcnQgPSAwLCBjdXJTdHlsZSA9IG51bGw7XG4gIHZhciBzdHJlYW0gPSBuZXcgU3RyaW5nU3RyZWFtKHRleHQsIGNtLm9wdGlvbnMudGFiU2l6ZSwgY29udGV4dCksIHN0eWxlO1xuICB2YXIgaW5uZXIgPSBjbS5vcHRpb25zLmFkZE1vZGVDbGFzcyAmJiBbbnVsbF07XG4gIGlmICh0ZXh0ID09IFwiXCIpIHsgZXh0cmFjdExpbmVDbGFzc2VzKGNhbGxCbGFua0xpbmUobW9kZSwgY29udGV4dC5zdGF0ZSksIGxpbmVDbGFzc2VzKTsgfVxuICB3aGlsZSAoIXN0cmVhbS5lb2woKSkge1xuICAgIGlmIChzdHJlYW0ucG9zID4gY20ub3B0aW9ucy5tYXhIaWdobGlnaHRMZW5ndGgpIHtcbiAgICAgIGZsYXR0ZW5TcGFucyA9IGZhbHNlO1xuICAgICAgaWYgKGZvcmNlVG9FbmQpIHsgcHJvY2Vzc0xpbmUoY20sIHRleHQsIGNvbnRleHQsIHN0cmVhbS5wb3MpOyB9XG4gICAgICBzdHJlYW0ucG9zID0gdGV4dC5sZW5ndGg7XG4gICAgICBzdHlsZSA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0eWxlID0gZXh0cmFjdExpbmVDbGFzc2VzKHJlYWRUb2tlbihtb2RlLCBzdHJlYW0sIGNvbnRleHQuc3RhdGUsIGlubmVyKSwgbGluZUNsYXNzZXMpO1xuICAgIH1cbiAgICBpZiAoaW5uZXIpIHtcbiAgICAgIHZhciBtTmFtZSA9IGlubmVyWzBdLm5hbWU7XG4gICAgICBpZiAobU5hbWUpIHsgc3R5bGUgPSBcIm0tXCIgKyAoc3R5bGUgPyBtTmFtZSArIFwiIFwiICsgc3R5bGUgOiBtTmFtZSk7IH1cbiAgICB9XG4gICAgaWYgKCFmbGF0dGVuU3BhbnMgfHwgY3VyU3R5bGUgIT0gc3R5bGUpIHtcbiAgICAgIHdoaWxlIChjdXJTdGFydCA8IHN0cmVhbS5zdGFydCkge1xuICAgICAgICBjdXJTdGFydCA9IE1hdGgubWluKHN0cmVhbS5zdGFydCwgY3VyU3RhcnQgKyA1MDAwKTtcbiAgICAgICAgZihjdXJTdGFydCwgY3VyU3R5bGUpO1xuICAgICAgfVxuICAgICAgY3VyU3R5bGUgPSBzdHlsZTtcbiAgICB9XG4gICAgc3RyZWFtLnN0YXJ0ID0gc3RyZWFtLnBvcztcbiAgfVxuICB3aGlsZSAoY3VyU3RhcnQgPCBzdHJlYW0ucG9zKSB7XG4gICAgLy8gV2Via2l0IHNlZW1zIHRvIHJlZnVzZSB0byByZW5kZXIgdGV4dCBub2RlcyBsb25nZXIgdGhhbiA1NzQ0NFxuICAgIC8vIGNoYXJhY3RlcnMsIGFuZCByZXR1cm5zIGluYWNjdXJhdGUgbWVhc3VyZW1lbnRzIGluIG5vZGVzXG4gICAgLy8gc3RhcnRpbmcgYXJvdW5kIDUwMDAgY2hhcnMuXG4gICAgdmFyIHBvcyA9IE1hdGgubWluKHN0cmVhbS5wb3MsIGN1clN0YXJ0ICsgNTAwMCk7XG4gICAgZihwb3MsIGN1clN0eWxlKTtcbiAgICBjdXJTdGFydCA9IHBvcztcbiAgfVxufVxuXG4vLyBGaW5kcyB0aGUgbGluZSB0byBzdGFydCB3aXRoIHdoZW4gc3RhcnRpbmcgYSBwYXJzZS4gVHJpZXMgdG9cbi8vIGZpbmQgYSBsaW5lIHdpdGggYSBzdGF0ZUFmdGVyLCBzbyB0aGF0IGl0IGNhbiBzdGFydCB3aXRoIGFcbi8vIHZhbGlkIHN0YXRlLiBJZiB0aGF0IGZhaWxzLCBpdCByZXR1cm5zIHRoZSBsaW5lIHdpdGggdGhlXG4vLyBzbWFsbGVzdCBpbmRlbnRhdGlvbiwgd2hpY2ggdGVuZHMgdG8gbmVlZCB0aGUgbGVhc3QgY29udGV4dCB0b1xuLy8gcGFyc2UgY29ycmVjdGx5LlxuZnVuY3Rpb24gZmluZFN0YXJ0TGluZShjbSwgbiwgcHJlY2lzZSkge1xuICB2YXIgbWluaW5kZW50LCBtaW5saW5lLCBkb2MgPSBjbS5kb2M7XG4gIHZhciBsaW0gPSBwcmVjaXNlID8gLTEgOiBuIC0gKGNtLmRvYy5tb2RlLmlubmVyTW9kZSA/IDEwMDAgOiAxMDApO1xuICBmb3IgKHZhciBzZWFyY2ggPSBuOyBzZWFyY2ggPiBsaW07IC0tc2VhcmNoKSB7XG4gICAgaWYgKHNlYXJjaCA8PSBkb2MuZmlyc3QpIHsgcmV0dXJuIGRvYy5maXJzdCB9XG4gICAgdmFyIGxpbmUgPSBnZXRMaW5lKGRvYywgc2VhcmNoIC0gMSksIGFmdGVyID0gbGluZS5zdGF0ZUFmdGVyO1xuICAgIGlmIChhZnRlciAmJiAoIXByZWNpc2UgfHwgc2VhcmNoICsgKGFmdGVyIGluc3RhbmNlb2YgU2F2ZWRDb250ZXh0ID8gYWZ0ZXIubG9va0FoZWFkIDogMCkgPD0gZG9jLm1vZGVGcm9udGllcikpXG4gICAgICB7IHJldHVybiBzZWFyY2ggfVxuICAgIHZhciBpbmRlbnRlZCA9IGNvdW50Q29sdW1uKGxpbmUudGV4dCwgbnVsbCwgY20ub3B0aW9ucy50YWJTaXplKTtcbiAgICBpZiAobWlubGluZSA9PSBudWxsIHx8IG1pbmluZGVudCA+IGluZGVudGVkKSB7XG4gICAgICBtaW5saW5lID0gc2VhcmNoIC0gMTtcbiAgICAgIG1pbmluZGVudCA9IGluZGVudGVkO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbWlubGluZVxufVxuXG5mdW5jdGlvbiByZXRyZWF0RnJvbnRpZXIoZG9jLCBuKSB7XG4gIGRvYy5tb2RlRnJvbnRpZXIgPSBNYXRoLm1pbihkb2MubW9kZUZyb250aWVyLCBuKTtcbiAgaWYgKGRvYy5oaWdobGlnaHRGcm9udGllciA8IG4gLSAxMCkgeyByZXR1cm4gfVxuICB2YXIgc3RhcnQgPSBkb2MuZmlyc3Q7XG4gIGZvciAodmFyIGxpbmUgPSBuIC0gMTsgbGluZSA+IHN0YXJ0OyBsaW5lLS0pIHtcbiAgICB2YXIgc2F2ZWQgPSBnZXRMaW5lKGRvYywgbGluZSkuc3RhdGVBZnRlcjtcbiAgICAvLyBjaGFuZ2UgaXMgb24gM1xuICAgIC8vIHN0YXRlIG9uIGxpbmUgMSBsb29rZWQgYWhlYWQgMiAtLSBzbyBzYXcgM1xuICAgIC8vIHRlc3QgMSArIDIgPCAzIHNob3VsZCBjb3ZlciB0aGlzXG4gICAgaWYgKHNhdmVkICYmICghKHNhdmVkIGluc3RhbmNlb2YgU2F2ZWRDb250ZXh0KSB8fCBsaW5lICsgc2F2ZWQubG9va0FoZWFkIDwgbikpIHtcbiAgICAgIHN0YXJ0ID0gbGluZSArIDE7XG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuICBkb2MuaGlnaGxpZ2h0RnJvbnRpZXIgPSBNYXRoLm1pbihkb2MuaGlnaGxpZ2h0RnJvbnRpZXIsIHN0YXJ0KTtcbn1cblxuLy8gTElORSBEQVRBIFNUUlVDVFVSRVxuXG4vLyBMaW5lIG9iamVjdHMuIFRoZXNlIGhvbGQgc3RhdGUgcmVsYXRlZCB0byBhIGxpbmUsIGluY2x1ZGluZ1xuLy8gaGlnaGxpZ2h0aW5nIGluZm8gKHRoZSBzdHlsZXMgYXJyYXkpLlxudmFyIExpbmUgPSBmdW5jdGlvbih0ZXh0LCBtYXJrZWRTcGFucywgZXN0aW1hdGVIZWlnaHQpIHtcbiAgdGhpcy50ZXh0ID0gdGV4dDtcbiAgYXR0YWNoTWFya2VkU3BhbnModGhpcywgbWFya2VkU3BhbnMpO1xuICB0aGlzLmhlaWdodCA9IGVzdGltYXRlSGVpZ2h0ID8gZXN0aW1hdGVIZWlnaHQodGhpcykgOiAxO1xufTtcblxuTGluZS5wcm90b3R5cGUubGluZU5vID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gbGluZU5vKHRoaXMpIH07XG5ldmVudE1peGluKExpbmUpO1xuXG4vLyBDaGFuZ2UgdGhlIGNvbnRlbnQgKHRleHQsIG1hcmtlcnMpIG9mIGEgbGluZS4gQXV0b21hdGljYWxseVxuLy8gaW52YWxpZGF0ZXMgY2FjaGVkIGluZm9ybWF0aW9uIGFuZCB0cmllcyB0byByZS1lc3RpbWF0ZSB0aGVcbi8vIGxpbmUncyBoZWlnaHQuXG5mdW5jdGlvbiB1cGRhdGVMaW5lKGxpbmUsIHRleHQsIG1hcmtlZFNwYW5zLCBlc3RpbWF0ZUhlaWdodCkge1xuICBsaW5lLnRleHQgPSB0ZXh0O1xuICBpZiAobGluZS5zdGF0ZUFmdGVyKSB7IGxpbmUuc3RhdGVBZnRlciA9IG51bGw7IH1cbiAgaWYgKGxpbmUuc3R5bGVzKSB7IGxpbmUuc3R5bGVzID0gbnVsbDsgfVxuICBpZiAobGluZS5vcmRlciAhPSBudWxsKSB7IGxpbmUub3JkZXIgPSBudWxsOyB9XG4gIGRldGFjaE1hcmtlZFNwYW5zKGxpbmUpO1xuICBhdHRhY2hNYXJrZWRTcGFucyhsaW5lLCBtYXJrZWRTcGFucyk7XG4gIHZhciBlc3RIZWlnaHQgPSBlc3RpbWF0ZUhlaWdodCA/IGVzdGltYXRlSGVpZ2h0KGxpbmUpIDogMTtcbiAgaWYgKGVzdEhlaWdodCAhPSBsaW5lLmhlaWdodCkgeyB1cGRhdGVMaW5lSGVpZ2h0KGxpbmUsIGVzdEhlaWdodCk7IH1cbn1cblxuLy8gRGV0YWNoIGEgbGluZSBmcm9tIHRoZSBkb2N1bWVudCB0cmVlIGFuZCBpdHMgbWFya2Vycy5cbmZ1bmN0aW9uIGNsZWFuVXBMaW5lKGxpbmUpIHtcbiAgbGluZS5wYXJlbnQgPSBudWxsO1xuICBkZXRhY2hNYXJrZWRTcGFucyhsaW5lKTtcbn1cblxuLy8gQ29udmVydCBhIHN0eWxlIGFzIHJldHVybmVkIGJ5IGEgbW9kZSAoZWl0aGVyIG51bGwsIG9yIGEgc3RyaW5nXG4vLyBjb250YWluaW5nIG9uZSBvciBtb3JlIHN0eWxlcykgdG8gYSBDU1Mgc3R5bGUuIFRoaXMgaXMgY2FjaGVkLFxuLy8gYW5kIGFsc28gbG9va3MgZm9yIGxpbmUtd2lkZSBzdHlsZXMuXG52YXIgc3R5bGVUb0NsYXNzQ2FjaGUgPSB7fTtcbnZhciBzdHlsZVRvQ2xhc3NDYWNoZVdpdGhNb2RlID0ge307XG5mdW5jdGlvbiBpbnRlcnByZXRUb2tlblN0eWxlKHN0eWxlLCBvcHRpb25zKSB7XG4gIGlmICghc3R5bGUgfHwgL15cXHMqJC8udGVzdChzdHlsZSkpIHsgcmV0dXJuIG51bGwgfVxuICB2YXIgY2FjaGUgPSBvcHRpb25zLmFkZE1vZGVDbGFzcyA/IHN0eWxlVG9DbGFzc0NhY2hlV2l0aE1vZGUgOiBzdHlsZVRvQ2xhc3NDYWNoZTtcbiAgcmV0dXJuIGNhY2hlW3N0eWxlXSB8fFxuICAgIChjYWNoZVtzdHlsZV0gPSBzdHlsZS5yZXBsYWNlKC9cXFMrL2csIFwiY20tJCZcIikpXG59XG5cbi8vIFJlbmRlciB0aGUgRE9NIHJlcHJlc2VudGF0aW9uIG9mIHRoZSB0ZXh0IG9mIGEgbGluZS4gQWxzbyBidWlsZHNcbi8vIHVwIGEgJ2xpbmUgbWFwJywgd2hpY2ggcG9pbnRzIGF0IHRoZSBET00gbm9kZXMgdGhhdCByZXByZXNlbnRcbi8vIHNwZWNpZmljIHN0cmV0Y2hlcyBvZiB0ZXh0LCBhbmQgaXMgdXNlZCBieSB0aGUgbWVhc3VyaW5nIGNvZGUuXG4vLyBUaGUgcmV0dXJuZWQgb2JqZWN0IGNvbnRhaW5zIHRoZSBET00gbm9kZSwgdGhpcyBtYXAsIGFuZFxuLy8gaW5mb3JtYXRpb24gYWJvdXQgbGluZS13aWRlIHN0eWxlcyB0aGF0IHdlcmUgc2V0IGJ5IHRoZSBtb2RlLlxuZnVuY3Rpb24gYnVpbGRMaW5lQ29udGVudChjbSwgbGluZVZpZXcpIHtcbiAgLy8gVGhlIHBhZGRpbmctcmlnaHQgZm9yY2VzIHRoZSBlbGVtZW50IHRvIGhhdmUgYSAnYm9yZGVyJywgd2hpY2hcbiAgLy8gaXMgbmVlZGVkIG9uIFdlYmtpdCB0byBiZSBhYmxlIHRvIGdldCBsaW5lLWxldmVsIGJvdW5kaW5nXG4gIC8vIHJlY3RhbmdsZXMgZm9yIGl0IChpbiBtZWFzdXJlQ2hhcikuXG4gIHZhciBjb250ZW50ID0gZWx0UChcInNwYW5cIiwgbnVsbCwgbnVsbCwgd2Via2l0ID8gXCJwYWRkaW5nLXJpZ2h0OiAuMXB4XCIgOiBudWxsKTtcbiAgdmFyIGJ1aWxkZXIgPSB7cHJlOiBlbHRQKFwicHJlXCIsIFtjb250ZW50XSwgXCJDb2RlTWlycm9yLWxpbmVcIiksIGNvbnRlbnQ6IGNvbnRlbnQsXG4gICAgICAgICAgICAgICAgIGNvbDogMCwgcG9zOiAwLCBjbTogY20sXG4gICAgICAgICAgICAgICAgIHRyYWlsaW5nU3BhY2U6IGZhbHNlLFxuICAgICAgICAgICAgICAgICBzcGxpdFNwYWNlczogKGllIHx8IHdlYmtpdCkgJiYgY20uZ2V0T3B0aW9uKFwibGluZVdyYXBwaW5nXCIpfTtcbiAgbGluZVZpZXcubWVhc3VyZSA9IHt9O1xuXG4gIC8vIEl0ZXJhdGUgb3ZlciB0aGUgbG9naWNhbCBsaW5lcyB0aGF0IG1ha2UgdXAgdGhpcyB2aXN1YWwgbGluZS5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPD0gKGxpbmVWaWV3LnJlc3QgPyBsaW5lVmlldy5yZXN0Lmxlbmd0aCA6IDApOyBpKyspIHtcbiAgICB2YXIgbGluZSA9IGkgPyBsaW5lVmlldy5yZXN0W2kgLSAxXSA6IGxpbmVWaWV3LmxpbmUsIG9yZGVyID0gKHZvaWQgMCk7XG4gICAgYnVpbGRlci5wb3MgPSAwO1xuICAgIGJ1aWxkZXIuYWRkVG9rZW4gPSBidWlsZFRva2VuO1xuICAgIC8vIE9wdGlvbmFsbHkgd2lyZSBpbiBzb21lIGhhY2tzIGludG8gdGhlIHRva2VuLXJlbmRlcmluZ1xuICAgIC8vIGFsZ29yaXRobSwgdG8gZGVhbCB3aXRoIGJyb3dzZXIgcXVpcmtzLlxuICAgIGlmIChoYXNCYWRCaWRpUmVjdHMoY20uZGlzcGxheS5tZWFzdXJlKSAmJiAob3JkZXIgPSBnZXRPcmRlcihsaW5lLCBjbS5kb2MuZGlyZWN0aW9uKSkpXG4gICAgICB7IGJ1aWxkZXIuYWRkVG9rZW4gPSBidWlsZFRva2VuQmFkQmlkaShidWlsZGVyLmFkZFRva2VuLCBvcmRlcik7IH1cbiAgICBidWlsZGVyLm1hcCA9IFtdO1xuICAgIHZhciBhbGxvd0Zyb250aWVyVXBkYXRlID0gbGluZVZpZXcgIT0gY20uZGlzcGxheS5leHRlcm5hbE1lYXN1cmVkICYmIGxpbmVObyhsaW5lKTtcbiAgICBpbnNlcnRMaW5lQ29udGVudChsaW5lLCBidWlsZGVyLCBnZXRMaW5lU3R5bGVzKGNtLCBsaW5lLCBhbGxvd0Zyb250aWVyVXBkYXRlKSk7XG4gICAgaWYgKGxpbmUuc3R5bGVDbGFzc2VzKSB7XG4gICAgICBpZiAobGluZS5zdHlsZUNsYXNzZXMuYmdDbGFzcylcbiAgICAgICAgeyBidWlsZGVyLmJnQ2xhc3MgPSBqb2luQ2xhc3NlcyhsaW5lLnN0eWxlQ2xhc3Nlcy5iZ0NsYXNzLCBidWlsZGVyLmJnQ2xhc3MgfHwgXCJcIik7IH1cbiAgICAgIGlmIChsaW5lLnN0eWxlQ2xhc3Nlcy50ZXh0Q2xhc3MpXG4gICAgICAgIHsgYnVpbGRlci50ZXh0Q2xhc3MgPSBqb2luQ2xhc3NlcyhsaW5lLnN0eWxlQ2xhc3Nlcy50ZXh0Q2xhc3MsIGJ1aWxkZXIudGV4dENsYXNzIHx8IFwiXCIpOyB9XG4gICAgfVxuXG4gICAgLy8gRW5zdXJlIGF0IGxlYXN0IGEgc2luZ2xlIG5vZGUgaXMgcHJlc2VudCwgZm9yIG1lYXN1cmluZy5cbiAgICBpZiAoYnVpbGRlci5tYXAubGVuZ3RoID09IDApXG4gICAgICB7IGJ1aWxkZXIubWFwLnB1c2goMCwgMCwgYnVpbGRlci5jb250ZW50LmFwcGVuZENoaWxkKHplcm9XaWR0aEVsZW1lbnQoY20uZGlzcGxheS5tZWFzdXJlKSkpOyB9XG5cbiAgICAvLyBTdG9yZSB0aGUgbWFwIGFuZCBhIGNhY2hlIG9iamVjdCBmb3IgdGhlIGN1cnJlbnQgbG9naWNhbCBsaW5lXG4gICAgaWYgKGkgPT0gMCkge1xuICAgICAgbGluZVZpZXcubWVhc3VyZS5tYXAgPSBidWlsZGVyLm1hcDtcbiAgICAgIGxpbmVWaWV3Lm1lYXN1cmUuY2FjaGUgPSB7fTtcbiAgICB9IGVsc2Uge1xuICAgICAgKGxpbmVWaWV3Lm1lYXN1cmUubWFwcyB8fCAobGluZVZpZXcubWVhc3VyZS5tYXBzID0gW10pKS5wdXNoKGJ1aWxkZXIubWFwKVxuICAgICAgOyhsaW5lVmlldy5tZWFzdXJlLmNhY2hlcyB8fCAobGluZVZpZXcubWVhc3VyZS5jYWNoZXMgPSBbXSkpLnB1c2goe30pO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNlZSBpc3N1ZSAjMjkwMVxuICBpZiAod2Via2l0KSB7XG4gICAgdmFyIGxhc3QgPSBidWlsZGVyLmNvbnRlbnQubGFzdENoaWxkO1xuICAgIGlmICgvXFxiY20tdGFiXFxiLy50ZXN0KGxhc3QuY2xhc3NOYW1lKSB8fCAobGFzdC5xdWVyeVNlbGVjdG9yICYmIGxhc3QucXVlcnlTZWxlY3RvcihcIi5jbS10YWJcIikpKVxuICAgICAgeyBidWlsZGVyLmNvbnRlbnQuY2xhc3NOYW1lID0gXCJjbS10YWItd3JhcC1oYWNrXCI7IH1cbiAgfVxuXG4gIHNpZ25hbChjbSwgXCJyZW5kZXJMaW5lXCIsIGNtLCBsaW5lVmlldy5saW5lLCBidWlsZGVyLnByZSk7XG4gIGlmIChidWlsZGVyLnByZS5jbGFzc05hbWUpXG4gICAgeyBidWlsZGVyLnRleHRDbGFzcyA9IGpvaW5DbGFzc2VzKGJ1aWxkZXIucHJlLmNsYXNzTmFtZSwgYnVpbGRlci50ZXh0Q2xhc3MgfHwgXCJcIik7IH1cblxuICByZXR1cm4gYnVpbGRlclxufVxuXG5mdW5jdGlvbiBkZWZhdWx0U3BlY2lhbENoYXJQbGFjZWhvbGRlcihjaCkge1xuICB2YXIgdG9rZW4gPSBlbHQoXCJzcGFuXCIsIFwiXFx1MjAyMlwiLCBcImNtLWludmFsaWRjaGFyXCIpO1xuICB0b2tlbi50aXRsZSA9IFwiXFxcXHVcIiArIGNoLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpO1xuICB0b2tlbi5zZXRBdHRyaWJ1dGUoXCJhcmlhLWxhYmVsXCIsIHRva2VuLnRpdGxlKTtcbiAgcmV0dXJuIHRva2VuXG59XG5cbi8vIEJ1aWxkIHVwIHRoZSBET00gcmVwcmVzZW50YXRpb24gZm9yIGEgc2luZ2xlIHRva2VuLCBhbmQgYWRkIGl0IHRvXG4vLyB0aGUgbGluZSBtYXAuIFRha2VzIGNhcmUgdG8gcmVuZGVyIHNwZWNpYWwgY2hhcmFjdGVycyBzZXBhcmF0ZWx5LlxuZnVuY3Rpb24gYnVpbGRUb2tlbihidWlsZGVyLCB0ZXh0LCBzdHlsZSwgc3RhcnRTdHlsZSwgZW5kU3R5bGUsIHRpdGxlLCBjc3MpIHtcbiAgaWYgKCF0ZXh0KSB7IHJldHVybiB9XG4gIHZhciBkaXNwbGF5VGV4dCA9IGJ1aWxkZXIuc3BsaXRTcGFjZXMgPyBzcGxpdFNwYWNlcyh0ZXh0LCBidWlsZGVyLnRyYWlsaW5nU3BhY2UpIDogdGV4dDtcbiAgdmFyIHNwZWNpYWwgPSBidWlsZGVyLmNtLnN0YXRlLnNwZWNpYWxDaGFycywgbXVzdFdyYXAgPSBmYWxzZTtcbiAgdmFyIGNvbnRlbnQ7XG4gIGlmICghc3BlY2lhbC50ZXN0KHRleHQpKSB7XG4gICAgYnVpbGRlci5jb2wgKz0gdGV4dC5sZW5ndGg7XG4gICAgY29udGVudCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGRpc3BsYXlUZXh0KTtcbiAgICBidWlsZGVyLm1hcC5wdXNoKGJ1aWxkZXIucG9zLCBidWlsZGVyLnBvcyArIHRleHQubGVuZ3RoLCBjb250ZW50KTtcbiAgICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA8IDkpIHsgbXVzdFdyYXAgPSB0cnVlOyB9XG4gICAgYnVpbGRlci5wb3MgKz0gdGV4dC5sZW5ndGg7XG4gIH0gZWxzZSB7XG4gICAgY29udGVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICB2YXIgcG9zID0gMDtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgc3BlY2lhbC5sYXN0SW5kZXggPSBwb3M7XG4gICAgICB2YXIgbSA9IHNwZWNpYWwuZXhlYyh0ZXh0KTtcbiAgICAgIHZhciBza2lwcGVkID0gbSA/IG0uaW5kZXggLSBwb3MgOiB0ZXh0Lmxlbmd0aCAtIHBvcztcbiAgICAgIGlmIChza2lwcGVkKSB7XG4gICAgICAgIHZhciB0eHQgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShkaXNwbGF5VGV4dC5zbGljZShwb3MsIHBvcyArIHNraXBwZWQpKTtcbiAgICAgICAgaWYgKGllICYmIGllX3ZlcnNpb24gPCA5KSB7IGNvbnRlbnQuYXBwZW5kQ2hpbGQoZWx0KFwic3BhblwiLCBbdHh0XSkpOyB9XG4gICAgICAgIGVsc2UgeyBjb250ZW50LmFwcGVuZENoaWxkKHR4dCk7IH1cbiAgICAgICAgYnVpbGRlci5tYXAucHVzaChidWlsZGVyLnBvcywgYnVpbGRlci5wb3MgKyBza2lwcGVkLCB0eHQpO1xuICAgICAgICBidWlsZGVyLmNvbCArPSBza2lwcGVkO1xuICAgICAgICBidWlsZGVyLnBvcyArPSBza2lwcGVkO1xuICAgICAgfVxuICAgICAgaWYgKCFtKSB7IGJyZWFrIH1cbiAgICAgIHBvcyArPSBza2lwcGVkICsgMTtcbiAgICAgIHZhciB0eHQkMSA9ICh2b2lkIDApO1xuICAgICAgaWYgKG1bMF0gPT0gXCJcXHRcIikge1xuICAgICAgICB2YXIgdGFiU2l6ZSA9IGJ1aWxkZXIuY20ub3B0aW9ucy50YWJTaXplLCB0YWJXaWR0aCA9IHRhYlNpemUgLSBidWlsZGVyLmNvbCAlIHRhYlNpemU7XG4gICAgICAgIHR4dCQxID0gY29udGVudC5hcHBlbmRDaGlsZChlbHQoXCJzcGFuXCIsIHNwYWNlU3RyKHRhYldpZHRoKSwgXCJjbS10YWJcIikpO1xuICAgICAgICB0eHQkMS5zZXRBdHRyaWJ1dGUoXCJyb2xlXCIsIFwicHJlc2VudGF0aW9uXCIpO1xuICAgICAgICB0eHQkMS5zZXRBdHRyaWJ1dGUoXCJjbS10ZXh0XCIsIFwiXFx0XCIpO1xuICAgICAgICBidWlsZGVyLmNvbCArPSB0YWJXaWR0aDtcbiAgICAgIH0gZWxzZSBpZiAobVswXSA9PSBcIlxcclwiIHx8IG1bMF0gPT0gXCJcXG5cIikge1xuICAgICAgICB0eHQkMSA9IGNvbnRlbnQuYXBwZW5kQ2hpbGQoZWx0KFwic3BhblwiLCBtWzBdID09IFwiXFxyXCIgPyBcIlxcdTI0MGRcIiA6IFwiXFx1MjQyNFwiLCBcImNtLWludmFsaWRjaGFyXCIpKTtcbiAgICAgICAgdHh0JDEuc2V0QXR0cmlidXRlKFwiY20tdGV4dFwiLCBtWzBdKTtcbiAgICAgICAgYnVpbGRlci5jb2wgKz0gMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHR4dCQxID0gYnVpbGRlci5jbS5vcHRpb25zLnNwZWNpYWxDaGFyUGxhY2Vob2xkZXIobVswXSk7XG4gICAgICAgIHR4dCQxLnNldEF0dHJpYnV0ZShcImNtLXRleHRcIiwgbVswXSk7XG4gICAgICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgOSkgeyBjb250ZW50LmFwcGVuZENoaWxkKGVsdChcInNwYW5cIiwgW3R4dCQxXSkpOyB9XG4gICAgICAgIGVsc2UgeyBjb250ZW50LmFwcGVuZENoaWxkKHR4dCQxKTsgfVxuICAgICAgICBidWlsZGVyLmNvbCArPSAxO1xuICAgICAgfVxuICAgICAgYnVpbGRlci5tYXAucHVzaChidWlsZGVyLnBvcywgYnVpbGRlci5wb3MgKyAxLCB0eHQkMSk7XG4gICAgICBidWlsZGVyLnBvcysrO1xuICAgIH1cbiAgfVxuICBidWlsZGVyLnRyYWlsaW5nU3BhY2UgPSBkaXNwbGF5VGV4dC5jaGFyQ29kZUF0KHRleHQubGVuZ3RoIC0gMSkgPT0gMzI7XG4gIGlmIChzdHlsZSB8fCBzdGFydFN0eWxlIHx8IGVuZFN0eWxlIHx8IG11c3RXcmFwIHx8IGNzcykge1xuICAgIHZhciBmdWxsU3R5bGUgPSBzdHlsZSB8fCBcIlwiO1xuICAgIGlmIChzdGFydFN0eWxlKSB7IGZ1bGxTdHlsZSArPSBzdGFydFN0eWxlOyB9XG4gICAgaWYgKGVuZFN0eWxlKSB7IGZ1bGxTdHlsZSArPSBlbmRTdHlsZTsgfVxuICAgIHZhciB0b2tlbiA9IGVsdChcInNwYW5cIiwgW2NvbnRlbnRdLCBmdWxsU3R5bGUsIGNzcyk7XG4gICAgaWYgKHRpdGxlKSB7IHRva2VuLnRpdGxlID0gdGl0bGU7IH1cbiAgICByZXR1cm4gYnVpbGRlci5jb250ZW50LmFwcGVuZENoaWxkKHRva2VuKVxuICB9XG4gIGJ1aWxkZXIuY29udGVudC5hcHBlbmRDaGlsZChjb250ZW50KTtcbn1cblxuZnVuY3Rpb24gc3BsaXRTcGFjZXModGV4dCwgdHJhaWxpbmdCZWZvcmUpIHtcbiAgaWYgKHRleHQubGVuZ3RoID4gMSAmJiAhLyAgLy50ZXN0KHRleHQpKSB7IHJldHVybiB0ZXh0IH1cbiAgdmFyIHNwYWNlQmVmb3JlID0gdHJhaWxpbmdCZWZvcmUsIHJlc3VsdCA9IFwiXCI7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGV4dC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBjaCA9IHRleHQuY2hhckF0KGkpO1xuICAgIGlmIChjaCA9PSBcIiBcIiAmJiBzcGFjZUJlZm9yZSAmJiAoaSA9PSB0ZXh0Lmxlbmd0aCAtIDEgfHwgdGV4dC5jaGFyQ29kZUF0KGkgKyAxKSA9PSAzMikpXG4gICAgICB7IGNoID0gXCJcXHUwMGEwXCI7IH1cbiAgICByZXN1bHQgKz0gY2g7XG4gICAgc3BhY2VCZWZvcmUgPSBjaCA9PSBcIiBcIjtcbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG5cbi8vIFdvcmsgYXJvdW5kIG5vbnNlbnNlIGRpbWVuc2lvbnMgYmVpbmcgcmVwb3J0ZWQgZm9yIHN0cmV0Y2hlcyBvZlxuLy8gcmlnaHQtdG8tbGVmdCB0ZXh0LlxuZnVuY3Rpb24gYnVpbGRUb2tlbkJhZEJpZGkoaW5uZXIsIG9yZGVyKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoYnVpbGRlciwgdGV4dCwgc3R5bGUsIHN0YXJ0U3R5bGUsIGVuZFN0eWxlLCB0aXRsZSwgY3NzKSB7XG4gICAgc3R5bGUgPSBzdHlsZSA/IHN0eWxlICsgXCIgY20tZm9yY2UtYm9yZGVyXCIgOiBcImNtLWZvcmNlLWJvcmRlclwiO1xuICAgIHZhciBzdGFydCA9IGJ1aWxkZXIucG9zLCBlbmQgPSBzdGFydCArIHRleHQubGVuZ3RoO1xuICAgIGZvciAoOzspIHtcbiAgICAgIC8vIEZpbmQgdGhlIHBhcnQgdGhhdCBvdmVybGFwcyB3aXRoIHRoZSBzdGFydCBvZiB0aGlzIHRleHRcbiAgICAgIHZhciBwYXJ0ID0gKHZvaWQgMCk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9yZGVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHBhcnQgPSBvcmRlcltpXTtcbiAgICAgICAgaWYgKHBhcnQudG8gPiBzdGFydCAmJiBwYXJ0LmZyb20gPD0gc3RhcnQpIHsgYnJlYWsgfVxuICAgICAgfVxuICAgICAgaWYgKHBhcnQudG8gPj0gZW5kKSB7IHJldHVybiBpbm5lcihidWlsZGVyLCB0ZXh0LCBzdHlsZSwgc3RhcnRTdHlsZSwgZW5kU3R5bGUsIHRpdGxlLCBjc3MpIH1cbiAgICAgIGlubmVyKGJ1aWxkZXIsIHRleHQuc2xpY2UoMCwgcGFydC50byAtIHN0YXJ0KSwgc3R5bGUsIHN0YXJ0U3R5bGUsIG51bGwsIHRpdGxlLCBjc3MpO1xuICAgICAgc3RhcnRTdHlsZSA9IG51bGw7XG4gICAgICB0ZXh0ID0gdGV4dC5zbGljZShwYXJ0LnRvIC0gc3RhcnQpO1xuICAgICAgc3RhcnQgPSBwYXJ0LnRvO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBidWlsZENvbGxhcHNlZFNwYW4oYnVpbGRlciwgc2l6ZSwgbWFya2VyLCBpZ25vcmVXaWRnZXQpIHtcbiAgdmFyIHdpZGdldCA9ICFpZ25vcmVXaWRnZXQgJiYgbWFya2VyLndpZGdldE5vZGU7XG4gIGlmICh3aWRnZXQpIHsgYnVpbGRlci5tYXAucHVzaChidWlsZGVyLnBvcywgYnVpbGRlci5wb3MgKyBzaXplLCB3aWRnZXQpOyB9XG4gIGlmICghaWdub3JlV2lkZ2V0ICYmIGJ1aWxkZXIuY20uZGlzcGxheS5pbnB1dC5uZWVkc0NvbnRlbnRBdHRyaWJ1dGUpIHtcbiAgICBpZiAoIXdpZGdldClcbiAgICAgIHsgd2lkZ2V0ID0gYnVpbGRlci5jb250ZW50LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpKTsgfVxuICAgIHdpZGdldC5zZXRBdHRyaWJ1dGUoXCJjbS1tYXJrZXJcIiwgbWFya2VyLmlkKTtcbiAgfVxuICBpZiAod2lkZ2V0KSB7XG4gICAgYnVpbGRlci5jbS5kaXNwbGF5LmlucHV0LnNldFVuZWRpdGFibGUod2lkZ2V0KTtcbiAgICBidWlsZGVyLmNvbnRlbnQuYXBwZW5kQ2hpbGQod2lkZ2V0KTtcbiAgfVxuICBidWlsZGVyLnBvcyArPSBzaXplO1xuICBidWlsZGVyLnRyYWlsaW5nU3BhY2UgPSBmYWxzZTtcbn1cblxuLy8gT3V0cHV0cyBhIG51bWJlciBvZiBzcGFucyB0byBtYWtlIHVwIGEgbGluZSwgdGFraW5nIGhpZ2hsaWdodGluZ1xuLy8gYW5kIG1hcmtlZCB0ZXh0IGludG8gYWNjb3VudC5cbmZ1bmN0aW9uIGluc2VydExpbmVDb250ZW50KGxpbmUsIGJ1aWxkZXIsIHN0eWxlcykge1xuICB2YXIgc3BhbnMgPSBsaW5lLm1hcmtlZFNwYW5zLCBhbGxUZXh0ID0gbGluZS50ZXh0LCBhdCA9IDA7XG4gIGlmICghc3BhbnMpIHtcbiAgICBmb3IgKHZhciBpJDEgPSAxOyBpJDEgPCBzdHlsZXMubGVuZ3RoOyBpJDErPTIpXG4gICAgICB7IGJ1aWxkZXIuYWRkVG9rZW4oYnVpbGRlciwgYWxsVGV4dC5zbGljZShhdCwgYXQgPSBzdHlsZXNbaSQxXSksIGludGVycHJldFRva2VuU3R5bGUoc3R5bGVzW2kkMSsxXSwgYnVpbGRlci5jbS5vcHRpb25zKSk7IH1cbiAgICByZXR1cm5cbiAgfVxuXG4gIHZhciBsZW4gPSBhbGxUZXh0Lmxlbmd0aCwgcG9zID0gMCwgaSA9IDEsIHRleHQgPSBcIlwiLCBzdHlsZSwgY3NzO1xuICB2YXIgbmV4dENoYW5nZSA9IDAsIHNwYW5TdHlsZSwgc3BhbkVuZFN0eWxlLCBzcGFuU3RhcnRTdHlsZSwgdGl0bGUsIGNvbGxhcHNlZDtcbiAgZm9yICg7Oykge1xuICAgIGlmIChuZXh0Q2hhbmdlID09IHBvcykgeyAvLyBVcGRhdGUgY3VycmVudCBtYXJrZXIgc2V0XG4gICAgICBzcGFuU3R5bGUgPSBzcGFuRW5kU3R5bGUgPSBzcGFuU3RhcnRTdHlsZSA9IHRpdGxlID0gY3NzID0gXCJcIjtcbiAgICAgIGNvbGxhcHNlZCA9IG51bGw7IG5leHRDaGFuZ2UgPSBJbmZpbml0eTtcbiAgICAgIHZhciBmb3VuZEJvb2ttYXJrcyA9IFtdLCBlbmRTdHlsZXMgPSAodm9pZCAwKTtcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgc3BhbnMubGVuZ3RoOyArK2opIHtcbiAgICAgICAgdmFyIHNwID0gc3BhbnNbal0sIG0gPSBzcC5tYXJrZXI7XG4gICAgICAgIGlmIChtLnR5cGUgPT0gXCJib29rbWFya1wiICYmIHNwLmZyb20gPT0gcG9zICYmIG0ud2lkZ2V0Tm9kZSkge1xuICAgICAgICAgIGZvdW5kQm9va21hcmtzLnB1c2gobSk7XG4gICAgICAgIH0gZWxzZSBpZiAoc3AuZnJvbSA8PSBwb3MgJiYgKHNwLnRvID09IG51bGwgfHwgc3AudG8gPiBwb3MgfHwgbS5jb2xsYXBzZWQgJiYgc3AudG8gPT0gcG9zICYmIHNwLmZyb20gPT0gcG9zKSkge1xuICAgICAgICAgIGlmIChzcC50byAhPSBudWxsICYmIHNwLnRvICE9IHBvcyAmJiBuZXh0Q2hhbmdlID4gc3AudG8pIHtcbiAgICAgICAgICAgIG5leHRDaGFuZ2UgPSBzcC50bztcbiAgICAgICAgICAgIHNwYW5FbmRTdHlsZSA9IFwiXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChtLmNsYXNzTmFtZSkgeyBzcGFuU3R5bGUgKz0gXCIgXCIgKyBtLmNsYXNzTmFtZTsgfVxuICAgICAgICAgIGlmIChtLmNzcykgeyBjc3MgPSAoY3NzID8gY3NzICsgXCI7XCIgOiBcIlwiKSArIG0uY3NzOyB9XG4gICAgICAgICAgaWYgKG0uc3RhcnRTdHlsZSAmJiBzcC5mcm9tID09IHBvcykgeyBzcGFuU3RhcnRTdHlsZSArPSBcIiBcIiArIG0uc3RhcnRTdHlsZTsgfVxuICAgICAgICAgIGlmIChtLmVuZFN0eWxlICYmIHNwLnRvID09IG5leHRDaGFuZ2UpIHsgKGVuZFN0eWxlcyB8fCAoZW5kU3R5bGVzID0gW10pKS5wdXNoKG0uZW5kU3R5bGUsIHNwLnRvKTsgfVxuICAgICAgICAgIGlmIChtLnRpdGxlICYmICF0aXRsZSkgeyB0aXRsZSA9IG0udGl0bGU7IH1cbiAgICAgICAgICBpZiAobS5jb2xsYXBzZWQgJiYgKCFjb2xsYXBzZWQgfHwgY29tcGFyZUNvbGxhcHNlZE1hcmtlcnMoY29sbGFwc2VkLm1hcmtlciwgbSkgPCAwKSlcbiAgICAgICAgICAgIHsgY29sbGFwc2VkID0gc3A7IH1cbiAgICAgICAgfSBlbHNlIGlmIChzcC5mcm9tID4gcG9zICYmIG5leHRDaGFuZ2UgPiBzcC5mcm9tKSB7XG4gICAgICAgICAgbmV4dENoYW5nZSA9IHNwLmZyb207XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChlbmRTdHlsZXMpIHsgZm9yICh2YXIgaiQxID0gMDsgaiQxIDwgZW5kU3R5bGVzLmxlbmd0aDsgaiQxICs9IDIpXG4gICAgICAgIHsgaWYgKGVuZFN0eWxlc1tqJDEgKyAxXSA9PSBuZXh0Q2hhbmdlKSB7IHNwYW5FbmRTdHlsZSArPSBcIiBcIiArIGVuZFN0eWxlc1tqJDFdOyB9IH0gfVxuXG4gICAgICBpZiAoIWNvbGxhcHNlZCB8fCBjb2xsYXBzZWQuZnJvbSA9PSBwb3MpIHsgZm9yICh2YXIgaiQyID0gMDsgaiQyIDwgZm91bmRCb29rbWFya3MubGVuZ3RoOyArK2okMilcbiAgICAgICAgeyBidWlsZENvbGxhcHNlZFNwYW4oYnVpbGRlciwgMCwgZm91bmRCb29rbWFya3NbaiQyXSk7IH0gfVxuICAgICAgaWYgKGNvbGxhcHNlZCAmJiAoY29sbGFwc2VkLmZyb20gfHwgMCkgPT0gcG9zKSB7XG4gICAgICAgIGJ1aWxkQ29sbGFwc2VkU3BhbihidWlsZGVyLCAoY29sbGFwc2VkLnRvID09IG51bGwgPyBsZW4gKyAxIDogY29sbGFwc2VkLnRvKSAtIHBvcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxhcHNlZC5tYXJrZXIsIGNvbGxhcHNlZC5mcm9tID09IG51bGwpO1xuICAgICAgICBpZiAoY29sbGFwc2VkLnRvID09IG51bGwpIHsgcmV0dXJuIH1cbiAgICAgICAgaWYgKGNvbGxhcHNlZC50byA9PSBwb3MpIHsgY29sbGFwc2VkID0gZmFsc2U7IH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHBvcyA+PSBsZW4pIHsgYnJlYWsgfVxuXG4gICAgdmFyIHVwdG8gPSBNYXRoLm1pbihsZW4sIG5leHRDaGFuZ2UpO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGV4dCkge1xuICAgICAgICB2YXIgZW5kID0gcG9zICsgdGV4dC5sZW5ndGg7XG4gICAgICAgIGlmICghY29sbGFwc2VkKSB7XG4gICAgICAgICAgdmFyIHRva2VuVGV4dCA9IGVuZCA+IHVwdG8gPyB0ZXh0LnNsaWNlKDAsIHVwdG8gLSBwb3MpIDogdGV4dDtcbiAgICAgICAgICBidWlsZGVyLmFkZFRva2VuKGJ1aWxkZXIsIHRva2VuVGV4dCwgc3R5bGUgPyBzdHlsZSArIHNwYW5TdHlsZSA6IHNwYW5TdHlsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwYW5TdGFydFN0eWxlLCBwb3MgKyB0b2tlblRleHQubGVuZ3RoID09IG5leHRDaGFuZ2UgPyBzcGFuRW5kU3R5bGUgOiBcIlwiLCB0aXRsZSwgY3NzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZW5kID49IHVwdG8pIHt0ZXh0ID0gdGV4dC5zbGljZSh1cHRvIC0gcG9zKTsgcG9zID0gdXB0bzsgYnJlYWt9XG4gICAgICAgIHBvcyA9IGVuZDtcbiAgICAgICAgc3BhblN0YXJ0U3R5bGUgPSBcIlwiO1xuICAgICAgfVxuICAgICAgdGV4dCA9IGFsbFRleHQuc2xpY2UoYXQsIGF0ID0gc3R5bGVzW2krK10pO1xuICAgICAgc3R5bGUgPSBpbnRlcnByZXRUb2tlblN0eWxlKHN0eWxlc1tpKytdLCBidWlsZGVyLmNtLm9wdGlvbnMpO1xuICAgIH1cbiAgfVxufVxuXG5cbi8vIFRoZXNlIG9iamVjdHMgYXJlIHVzZWQgdG8gcmVwcmVzZW50IHRoZSB2aXNpYmxlIChjdXJyZW50bHkgZHJhd24pXG4vLyBwYXJ0IG9mIHRoZSBkb2N1bWVudC4gQSBMaW5lVmlldyBtYXkgY29ycmVzcG9uZCB0byBtdWx0aXBsZVxuLy8gbG9naWNhbCBsaW5lcywgaWYgdGhvc2UgYXJlIGNvbm5lY3RlZCBieSBjb2xsYXBzZWQgcmFuZ2VzLlxuZnVuY3Rpb24gTGluZVZpZXcoZG9jLCBsaW5lLCBsaW5lTikge1xuICAvLyBUaGUgc3RhcnRpbmcgbGluZVxuICB0aGlzLmxpbmUgPSBsaW5lO1xuICAvLyBDb250aW51aW5nIGxpbmVzLCBpZiBhbnlcbiAgdGhpcy5yZXN0ID0gdmlzdWFsTGluZUNvbnRpbnVlZChsaW5lKTtcbiAgLy8gTnVtYmVyIG9mIGxvZ2ljYWwgbGluZXMgaW4gdGhpcyB2aXN1YWwgbGluZVxuICB0aGlzLnNpemUgPSB0aGlzLnJlc3QgPyBsaW5lTm8obHN0KHRoaXMucmVzdCkpIC0gbGluZU4gKyAxIDogMTtcbiAgdGhpcy5ub2RlID0gdGhpcy50ZXh0ID0gbnVsbDtcbiAgdGhpcy5oaWRkZW4gPSBsaW5lSXNIaWRkZW4oZG9jLCBsaW5lKTtcbn1cblxuLy8gQ3JlYXRlIGEgcmFuZ2Ugb2YgTGluZVZpZXcgb2JqZWN0cyBmb3IgdGhlIGdpdmVuIGxpbmVzLlxuZnVuY3Rpb24gYnVpbGRWaWV3QXJyYXkoY20sIGZyb20sIHRvKSB7XG4gIHZhciBhcnJheSA9IFtdLCBuZXh0UG9zO1xuICBmb3IgKHZhciBwb3MgPSBmcm9tOyBwb3MgPCB0bzsgcG9zID0gbmV4dFBvcykge1xuICAgIHZhciB2aWV3ID0gbmV3IExpbmVWaWV3KGNtLmRvYywgZ2V0TGluZShjbS5kb2MsIHBvcyksIHBvcyk7XG4gICAgbmV4dFBvcyA9IHBvcyArIHZpZXcuc2l6ZTtcbiAgICBhcnJheS5wdXNoKHZpZXcpO1xuICB9XG4gIHJldHVybiBhcnJheVxufVxuXG52YXIgb3BlcmF0aW9uR3JvdXAgPSBudWxsO1xuXG5mdW5jdGlvbiBwdXNoT3BlcmF0aW9uKG9wKSB7XG4gIGlmIChvcGVyYXRpb25Hcm91cCkge1xuICAgIG9wZXJhdGlvbkdyb3VwLm9wcy5wdXNoKG9wKTtcbiAgfSBlbHNlIHtcbiAgICBvcC5vd25zR3JvdXAgPSBvcGVyYXRpb25Hcm91cCA9IHtcbiAgICAgIG9wczogW29wXSxcbiAgICAgIGRlbGF5ZWRDYWxsYmFja3M6IFtdXG4gICAgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmaXJlQ2FsbGJhY2tzRm9yT3BzKGdyb3VwKSB7XG4gIC8vIENhbGxzIGRlbGF5ZWQgY2FsbGJhY2tzIGFuZCBjdXJzb3JBY3Rpdml0eSBoYW5kbGVycyB1bnRpbCBub1xuICAvLyBuZXcgb25lcyBhcHBlYXJcbiAgdmFyIGNhbGxiYWNrcyA9IGdyb3VwLmRlbGF5ZWRDYWxsYmFja3MsIGkgPSAwO1xuICBkbyB7XG4gICAgZm9yICg7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyBpKyspXG4gICAgICB7IGNhbGxiYWNrc1tpXS5jYWxsKG51bGwpOyB9XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBncm91cC5vcHMubGVuZ3RoOyBqKyspIHtcbiAgICAgIHZhciBvcCA9IGdyb3VwLm9wc1tqXTtcbiAgICAgIGlmIChvcC5jdXJzb3JBY3Rpdml0eUhhbmRsZXJzKVxuICAgICAgICB7IHdoaWxlIChvcC5jdXJzb3JBY3Rpdml0eUNhbGxlZCA8IG9wLmN1cnNvckFjdGl2aXR5SGFuZGxlcnMubGVuZ3RoKVxuICAgICAgICAgIHsgb3AuY3Vyc29yQWN0aXZpdHlIYW5kbGVyc1tvcC5jdXJzb3JBY3Rpdml0eUNhbGxlZCsrXS5jYWxsKG51bGwsIG9wLmNtKTsgfSB9XG4gICAgfVxuICB9IHdoaWxlIChpIDwgY2FsbGJhY2tzLmxlbmd0aClcbn1cblxuZnVuY3Rpb24gZmluaXNoT3BlcmF0aW9uKG9wLCBlbmRDYikge1xuICB2YXIgZ3JvdXAgPSBvcC5vd25zR3JvdXA7XG4gIGlmICghZ3JvdXApIHsgcmV0dXJuIH1cblxuICB0cnkgeyBmaXJlQ2FsbGJhY2tzRm9yT3BzKGdyb3VwKTsgfVxuICBmaW5hbGx5IHtcbiAgICBvcGVyYXRpb25Hcm91cCA9IG51bGw7XG4gICAgZW5kQ2IoZ3JvdXApO1xuICB9XG59XG5cbnZhciBvcnBoYW5EZWxheWVkQ2FsbGJhY2tzID0gbnVsbDtcblxuLy8gT2Z0ZW4sIHdlIHdhbnQgdG8gc2lnbmFsIGV2ZW50cyBhdCBhIHBvaW50IHdoZXJlIHdlIGFyZSBpbiB0aGVcbi8vIG1pZGRsZSBvZiBzb21lIHdvcmssIGJ1dCBkb24ndCB3YW50IHRoZSBoYW5kbGVyIHRvIHN0YXJ0IGNhbGxpbmdcbi8vIG90aGVyIG1ldGhvZHMgb24gdGhlIGVkaXRvciwgd2hpY2ggbWlnaHQgYmUgaW4gYW4gaW5jb25zaXN0ZW50XG4vLyBzdGF0ZSBvciBzaW1wbHkgbm90IGV4cGVjdCBhbnkgb3RoZXIgZXZlbnRzIHRvIGhhcHBlbi5cbi8vIHNpZ25hbExhdGVyIGxvb2tzIHdoZXRoZXIgdGhlcmUgYXJlIGFueSBoYW5kbGVycywgYW5kIHNjaGVkdWxlc1xuLy8gdGhlbSB0byBiZSBleGVjdXRlZCB3aGVuIHRoZSBsYXN0IG9wZXJhdGlvbiBlbmRzLCBvciwgaWYgbm9cbi8vIG9wZXJhdGlvbiBpcyBhY3RpdmUsIHdoZW4gYSB0aW1lb3V0IGZpcmVzLlxuZnVuY3Rpb24gc2lnbmFsTGF0ZXIoZW1pdHRlciwgdHlwZSAvKiwgdmFsdWVzLi4uKi8pIHtcbiAgdmFyIGFyciA9IGdldEhhbmRsZXJzKGVtaXR0ZXIsIHR5cGUpO1xuICBpZiAoIWFyci5sZW5ndGgpIHsgcmV0dXJuIH1cbiAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpLCBsaXN0O1xuICBpZiAob3BlcmF0aW9uR3JvdXApIHtcbiAgICBsaXN0ID0gb3BlcmF0aW9uR3JvdXAuZGVsYXllZENhbGxiYWNrcztcbiAgfSBlbHNlIGlmIChvcnBoYW5EZWxheWVkQ2FsbGJhY2tzKSB7XG4gICAgbGlzdCA9IG9ycGhhbkRlbGF5ZWRDYWxsYmFja3M7XG4gIH0gZWxzZSB7XG4gICAgbGlzdCA9IG9ycGhhbkRlbGF5ZWRDYWxsYmFja3MgPSBbXTtcbiAgICBzZXRUaW1lb3V0KGZpcmVPcnBoYW5EZWxheWVkLCAwKTtcbiAgfVxuICB2YXIgbG9vcCA9IGZ1bmN0aW9uICggaSApIHtcbiAgICBsaXN0LnB1c2goZnVuY3Rpb24gKCkgeyByZXR1cm4gYXJyW2ldLmFwcGx5KG51bGwsIGFyZ3MpOyB9KTtcbiAgfTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7ICsraSlcbiAgICBsb29wKCBpICk7XG59XG5cbmZ1bmN0aW9uIGZpcmVPcnBoYW5EZWxheWVkKCkge1xuICB2YXIgZGVsYXllZCA9IG9ycGhhbkRlbGF5ZWRDYWxsYmFja3M7XG4gIG9ycGhhbkRlbGF5ZWRDYWxsYmFja3MgPSBudWxsO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGRlbGF5ZWQubGVuZ3RoOyArK2kpIHsgZGVsYXllZFtpXSgpOyB9XG59XG5cbi8vIFdoZW4gYW4gYXNwZWN0IG9mIGEgbGluZSBjaGFuZ2VzLCBhIHN0cmluZyBpcyBhZGRlZCB0b1xuLy8gbGluZVZpZXcuY2hhbmdlcy4gVGhpcyB1cGRhdGVzIHRoZSByZWxldmFudCBwYXJ0IG9mIHRoZSBsaW5lJ3Ncbi8vIERPTSBzdHJ1Y3R1cmUuXG5mdW5jdGlvbiB1cGRhdGVMaW5lRm9yQ2hhbmdlcyhjbSwgbGluZVZpZXcsIGxpbmVOLCBkaW1zKSB7XG4gIGZvciAodmFyIGogPSAwOyBqIDwgbGluZVZpZXcuY2hhbmdlcy5sZW5ndGg7IGorKykge1xuICAgIHZhciB0eXBlID0gbGluZVZpZXcuY2hhbmdlc1tqXTtcbiAgICBpZiAodHlwZSA9PSBcInRleHRcIikgeyB1cGRhdGVMaW5lVGV4dChjbSwgbGluZVZpZXcpOyB9XG4gICAgZWxzZSBpZiAodHlwZSA9PSBcImd1dHRlclwiKSB7IHVwZGF0ZUxpbmVHdXR0ZXIoY20sIGxpbmVWaWV3LCBsaW5lTiwgZGltcyk7IH1cbiAgICBlbHNlIGlmICh0eXBlID09IFwiY2xhc3NcIikgeyB1cGRhdGVMaW5lQ2xhc3NlcyhjbSwgbGluZVZpZXcpOyB9XG4gICAgZWxzZSBpZiAodHlwZSA9PSBcIndpZGdldFwiKSB7IHVwZGF0ZUxpbmVXaWRnZXRzKGNtLCBsaW5lVmlldywgZGltcyk7IH1cbiAgfVxuICBsaW5lVmlldy5jaGFuZ2VzID0gbnVsbDtcbn1cblxuLy8gTGluZXMgd2l0aCBndXR0ZXIgZWxlbWVudHMsIHdpZGdldHMgb3IgYSBiYWNrZ3JvdW5kIGNsYXNzIG5lZWQgdG9cbi8vIGJlIHdyYXBwZWQsIGFuZCBoYXZlIHRoZSBleHRyYSBlbGVtZW50cyBhZGRlZCB0byB0aGUgd3JhcHBlciBkaXZcbmZ1bmN0aW9uIGVuc3VyZUxpbmVXcmFwcGVkKGxpbmVWaWV3KSB7XG4gIGlmIChsaW5lVmlldy5ub2RlID09IGxpbmVWaWV3LnRleHQpIHtcbiAgICBsaW5lVmlldy5ub2RlID0gZWx0KFwiZGl2XCIsIG51bGwsIG51bGwsIFwicG9zaXRpb246IHJlbGF0aXZlXCIpO1xuICAgIGlmIChsaW5lVmlldy50ZXh0LnBhcmVudE5vZGUpXG4gICAgICB7IGxpbmVWaWV3LnRleHQucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobGluZVZpZXcubm9kZSwgbGluZVZpZXcudGV4dCk7IH1cbiAgICBsaW5lVmlldy5ub2RlLmFwcGVuZENoaWxkKGxpbmVWaWV3LnRleHQpO1xuICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgOCkgeyBsaW5lVmlldy5ub2RlLnN0eWxlLnpJbmRleCA9IDI7IH1cbiAgfVxuICByZXR1cm4gbGluZVZpZXcubm9kZVxufVxuXG5mdW5jdGlvbiB1cGRhdGVMaW5lQmFja2dyb3VuZChjbSwgbGluZVZpZXcpIHtcbiAgdmFyIGNscyA9IGxpbmVWaWV3LmJnQ2xhc3MgPyBsaW5lVmlldy5iZ0NsYXNzICsgXCIgXCIgKyAobGluZVZpZXcubGluZS5iZ0NsYXNzIHx8IFwiXCIpIDogbGluZVZpZXcubGluZS5iZ0NsYXNzO1xuICBpZiAoY2xzKSB7IGNscyArPSBcIiBDb2RlTWlycm9yLWxpbmViYWNrZ3JvdW5kXCI7IH1cbiAgaWYgKGxpbmVWaWV3LmJhY2tncm91bmQpIHtcbiAgICBpZiAoY2xzKSB7IGxpbmVWaWV3LmJhY2tncm91bmQuY2xhc3NOYW1lID0gY2xzOyB9XG4gICAgZWxzZSB7IGxpbmVWaWV3LmJhY2tncm91bmQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChsaW5lVmlldy5iYWNrZ3JvdW5kKTsgbGluZVZpZXcuYmFja2dyb3VuZCA9IG51bGw7IH1cbiAgfSBlbHNlIGlmIChjbHMpIHtcbiAgICB2YXIgd3JhcCA9IGVuc3VyZUxpbmVXcmFwcGVkKGxpbmVWaWV3KTtcbiAgICBsaW5lVmlldy5iYWNrZ3JvdW5kID0gd3JhcC5pbnNlcnRCZWZvcmUoZWx0KFwiZGl2XCIsIG51bGwsIGNscyksIHdyYXAuZmlyc3RDaGlsZCk7XG4gICAgY20uZGlzcGxheS5pbnB1dC5zZXRVbmVkaXRhYmxlKGxpbmVWaWV3LmJhY2tncm91bmQpO1xuICB9XG59XG5cbi8vIFdyYXBwZXIgYXJvdW5kIGJ1aWxkTGluZUNvbnRlbnQgd2hpY2ggd2lsbCByZXVzZSB0aGUgc3RydWN0dXJlXG4vLyBpbiBkaXNwbGF5LmV4dGVybmFsTWVhc3VyZWQgd2hlbiBwb3NzaWJsZS5cbmZ1bmN0aW9uIGdldExpbmVDb250ZW50KGNtLCBsaW5lVmlldykge1xuICB2YXIgZXh0ID0gY20uZGlzcGxheS5leHRlcm5hbE1lYXN1cmVkO1xuICBpZiAoZXh0ICYmIGV4dC5saW5lID09IGxpbmVWaWV3LmxpbmUpIHtcbiAgICBjbS5kaXNwbGF5LmV4dGVybmFsTWVhc3VyZWQgPSBudWxsO1xuICAgIGxpbmVWaWV3Lm1lYXN1cmUgPSBleHQubWVhc3VyZTtcbiAgICByZXR1cm4gZXh0LmJ1aWx0XG4gIH1cbiAgcmV0dXJuIGJ1aWxkTGluZUNvbnRlbnQoY20sIGxpbmVWaWV3KVxufVxuXG4vLyBSZWRyYXcgdGhlIGxpbmUncyB0ZXh0LiBJbnRlcmFjdHMgd2l0aCB0aGUgYmFja2dyb3VuZCBhbmQgdGV4dFxuLy8gY2xhc3NlcyBiZWNhdXNlIHRoZSBtb2RlIG1heSBvdXRwdXQgdG9rZW5zIHRoYXQgaW5mbHVlbmNlIHRoZXNlXG4vLyBjbGFzc2VzLlxuZnVuY3Rpb24gdXBkYXRlTGluZVRleHQoY20sIGxpbmVWaWV3KSB7XG4gIHZhciBjbHMgPSBsaW5lVmlldy50ZXh0LmNsYXNzTmFtZTtcbiAgdmFyIGJ1aWx0ID0gZ2V0TGluZUNvbnRlbnQoY20sIGxpbmVWaWV3KTtcbiAgaWYgKGxpbmVWaWV3LnRleHQgPT0gbGluZVZpZXcubm9kZSkgeyBsaW5lVmlldy5ub2RlID0gYnVpbHQucHJlOyB9XG4gIGxpbmVWaWV3LnRleHQucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoYnVpbHQucHJlLCBsaW5lVmlldy50ZXh0KTtcbiAgbGluZVZpZXcudGV4dCA9IGJ1aWx0LnByZTtcbiAgaWYgKGJ1aWx0LmJnQ2xhc3MgIT0gbGluZVZpZXcuYmdDbGFzcyB8fCBidWlsdC50ZXh0Q2xhc3MgIT0gbGluZVZpZXcudGV4dENsYXNzKSB7XG4gICAgbGluZVZpZXcuYmdDbGFzcyA9IGJ1aWx0LmJnQ2xhc3M7XG4gICAgbGluZVZpZXcudGV4dENsYXNzID0gYnVpbHQudGV4dENsYXNzO1xuICAgIHVwZGF0ZUxpbmVDbGFzc2VzKGNtLCBsaW5lVmlldyk7XG4gIH0gZWxzZSBpZiAoY2xzKSB7XG4gICAgbGluZVZpZXcudGV4dC5jbGFzc05hbWUgPSBjbHM7XG4gIH1cbn1cblxuZnVuY3Rpb24gdXBkYXRlTGluZUNsYXNzZXMoY20sIGxpbmVWaWV3KSB7XG4gIHVwZGF0ZUxpbmVCYWNrZ3JvdW5kKGNtLCBsaW5lVmlldyk7XG4gIGlmIChsaW5lVmlldy5saW5lLndyYXBDbGFzcylcbiAgICB7IGVuc3VyZUxpbmVXcmFwcGVkKGxpbmVWaWV3KS5jbGFzc05hbWUgPSBsaW5lVmlldy5saW5lLndyYXBDbGFzczsgfVxuICBlbHNlIGlmIChsaW5lVmlldy5ub2RlICE9IGxpbmVWaWV3LnRleHQpXG4gICAgeyBsaW5lVmlldy5ub2RlLmNsYXNzTmFtZSA9IFwiXCI7IH1cbiAgdmFyIHRleHRDbGFzcyA9IGxpbmVWaWV3LnRleHRDbGFzcyA/IGxpbmVWaWV3LnRleHRDbGFzcyArIFwiIFwiICsgKGxpbmVWaWV3LmxpbmUudGV4dENsYXNzIHx8IFwiXCIpIDogbGluZVZpZXcubGluZS50ZXh0Q2xhc3M7XG4gIGxpbmVWaWV3LnRleHQuY2xhc3NOYW1lID0gdGV4dENsYXNzIHx8IFwiXCI7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUxpbmVHdXR0ZXIoY20sIGxpbmVWaWV3LCBsaW5lTiwgZGltcykge1xuICBpZiAobGluZVZpZXcuZ3V0dGVyKSB7XG4gICAgbGluZVZpZXcubm9kZS5yZW1vdmVDaGlsZChsaW5lVmlldy5ndXR0ZXIpO1xuICAgIGxpbmVWaWV3Lmd1dHRlciA9IG51bGw7XG4gIH1cbiAgaWYgKGxpbmVWaWV3Lmd1dHRlckJhY2tncm91bmQpIHtcbiAgICBsaW5lVmlldy5ub2RlLnJlbW92ZUNoaWxkKGxpbmVWaWV3Lmd1dHRlckJhY2tncm91bmQpO1xuICAgIGxpbmVWaWV3Lmd1dHRlckJhY2tncm91bmQgPSBudWxsO1xuICB9XG4gIGlmIChsaW5lVmlldy5saW5lLmd1dHRlckNsYXNzKSB7XG4gICAgdmFyIHdyYXAgPSBlbnN1cmVMaW5lV3JhcHBlZChsaW5lVmlldyk7XG4gICAgbGluZVZpZXcuZ3V0dGVyQmFja2dyb3VuZCA9IGVsdChcImRpdlwiLCBudWxsLCBcIkNvZGVNaXJyb3ItZ3V0dGVyLWJhY2tncm91bmQgXCIgKyBsaW5lVmlldy5saW5lLmd1dHRlckNsYXNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKFwibGVmdDogXCIgKyAoY20ub3B0aW9ucy5maXhlZEd1dHRlciA/IGRpbXMuZml4ZWRQb3MgOiAtZGltcy5ndXR0ZXJUb3RhbFdpZHRoKSArIFwicHg7IHdpZHRoOiBcIiArIChkaW1zLmd1dHRlclRvdGFsV2lkdGgpICsgXCJweFwiKSk7XG4gICAgY20uZGlzcGxheS5pbnB1dC5zZXRVbmVkaXRhYmxlKGxpbmVWaWV3Lmd1dHRlckJhY2tncm91bmQpO1xuICAgIHdyYXAuaW5zZXJ0QmVmb3JlKGxpbmVWaWV3Lmd1dHRlckJhY2tncm91bmQsIGxpbmVWaWV3LnRleHQpO1xuICB9XG4gIHZhciBtYXJrZXJzID0gbGluZVZpZXcubGluZS5ndXR0ZXJNYXJrZXJzO1xuICBpZiAoY20ub3B0aW9ucy5saW5lTnVtYmVycyB8fCBtYXJrZXJzKSB7XG4gICAgdmFyIHdyYXAkMSA9IGVuc3VyZUxpbmVXcmFwcGVkKGxpbmVWaWV3KTtcbiAgICB2YXIgZ3V0dGVyV3JhcCA9IGxpbmVWaWV3Lmd1dHRlciA9IGVsdChcImRpdlwiLCBudWxsLCBcIkNvZGVNaXJyb3ItZ3V0dGVyLXdyYXBwZXJcIiwgKFwibGVmdDogXCIgKyAoY20ub3B0aW9ucy5maXhlZEd1dHRlciA/IGRpbXMuZml4ZWRQb3MgOiAtZGltcy5ndXR0ZXJUb3RhbFdpZHRoKSArIFwicHhcIikpO1xuICAgIGNtLmRpc3BsYXkuaW5wdXQuc2V0VW5lZGl0YWJsZShndXR0ZXJXcmFwKTtcbiAgICB3cmFwJDEuaW5zZXJ0QmVmb3JlKGd1dHRlcldyYXAsIGxpbmVWaWV3LnRleHQpO1xuICAgIGlmIChsaW5lVmlldy5saW5lLmd1dHRlckNsYXNzKVxuICAgICAgeyBndXR0ZXJXcmFwLmNsYXNzTmFtZSArPSBcIiBcIiArIGxpbmVWaWV3LmxpbmUuZ3V0dGVyQ2xhc3M7IH1cbiAgICBpZiAoY20ub3B0aW9ucy5saW5lTnVtYmVycyAmJiAoIW1hcmtlcnMgfHwgIW1hcmtlcnNbXCJDb2RlTWlycm9yLWxpbmVudW1iZXJzXCJdKSlcbiAgICAgIHsgbGluZVZpZXcubGluZU51bWJlciA9IGd1dHRlcldyYXAuYXBwZW5kQ2hpbGQoXG4gICAgICAgIGVsdChcImRpdlwiLCBsaW5lTnVtYmVyRm9yKGNtLm9wdGlvbnMsIGxpbmVOKSxcbiAgICAgICAgICAgIFwiQ29kZU1pcnJvci1saW5lbnVtYmVyIENvZGVNaXJyb3ItZ3V0dGVyLWVsdFwiLFxuICAgICAgICAgICAgKFwibGVmdDogXCIgKyAoZGltcy5ndXR0ZXJMZWZ0W1wiQ29kZU1pcnJvci1saW5lbnVtYmVyc1wiXSkgKyBcInB4OyB3aWR0aDogXCIgKyAoY20uZGlzcGxheS5saW5lTnVtSW5uZXJXaWR0aCkgKyBcInB4XCIpKSk7IH1cbiAgICBpZiAobWFya2VycykgeyBmb3IgKHZhciBrID0gMDsgayA8IGNtLm9wdGlvbnMuZ3V0dGVycy5sZW5ndGg7ICsraykge1xuICAgICAgdmFyIGlkID0gY20ub3B0aW9ucy5ndXR0ZXJzW2tdLCBmb3VuZCA9IG1hcmtlcnMuaGFzT3duUHJvcGVydHkoaWQpICYmIG1hcmtlcnNbaWRdO1xuICAgICAgaWYgKGZvdW5kKVxuICAgICAgICB7IGd1dHRlcldyYXAuYXBwZW5kQ2hpbGQoZWx0KFwiZGl2XCIsIFtmb3VuZF0sIFwiQ29kZU1pcnJvci1ndXR0ZXItZWx0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcImxlZnQ6IFwiICsgKGRpbXMuZ3V0dGVyTGVmdFtpZF0pICsgXCJweDsgd2lkdGg6IFwiICsgKGRpbXMuZ3V0dGVyV2lkdGhbaWRdKSArIFwicHhcIikpKTsgfVxuICAgIH0gfVxuICB9XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUxpbmVXaWRnZXRzKGNtLCBsaW5lVmlldywgZGltcykge1xuICBpZiAobGluZVZpZXcuYWxpZ25hYmxlKSB7IGxpbmVWaWV3LmFsaWduYWJsZSA9IG51bGw7IH1cbiAgZm9yICh2YXIgbm9kZSA9IGxpbmVWaWV3Lm5vZGUuZmlyc3RDaGlsZCwgbmV4dCA9ICh2b2lkIDApOyBub2RlOyBub2RlID0gbmV4dCkge1xuICAgIG5leHQgPSBub2RlLm5leHRTaWJsaW5nO1xuICAgIGlmIChub2RlLmNsYXNzTmFtZSA9PSBcIkNvZGVNaXJyb3ItbGluZXdpZGdldFwiKVxuICAgICAgeyBsaW5lVmlldy5ub2RlLnJlbW92ZUNoaWxkKG5vZGUpOyB9XG4gIH1cbiAgaW5zZXJ0TGluZVdpZGdldHMoY20sIGxpbmVWaWV3LCBkaW1zKTtcbn1cblxuLy8gQnVpbGQgYSBsaW5lJ3MgRE9NIHJlcHJlc2VudGF0aW9uIGZyb20gc2NyYXRjaFxuZnVuY3Rpb24gYnVpbGRMaW5lRWxlbWVudChjbSwgbGluZVZpZXcsIGxpbmVOLCBkaW1zKSB7XG4gIHZhciBidWlsdCA9IGdldExpbmVDb250ZW50KGNtLCBsaW5lVmlldyk7XG4gIGxpbmVWaWV3LnRleHQgPSBsaW5lVmlldy5ub2RlID0gYnVpbHQucHJlO1xuICBpZiAoYnVpbHQuYmdDbGFzcykgeyBsaW5lVmlldy5iZ0NsYXNzID0gYnVpbHQuYmdDbGFzczsgfVxuICBpZiAoYnVpbHQudGV4dENsYXNzKSB7IGxpbmVWaWV3LnRleHRDbGFzcyA9IGJ1aWx0LnRleHRDbGFzczsgfVxuXG4gIHVwZGF0ZUxpbmVDbGFzc2VzKGNtLCBsaW5lVmlldyk7XG4gIHVwZGF0ZUxpbmVHdXR0ZXIoY20sIGxpbmVWaWV3LCBsaW5lTiwgZGltcyk7XG4gIGluc2VydExpbmVXaWRnZXRzKGNtLCBsaW5lVmlldywgZGltcyk7XG4gIHJldHVybiBsaW5lVmlldy5ub2RlXG59XG5cbi8vIEEgbGluZVZpZXcgbWF5IGNvbnRhaW4gbXVsdGlwbGUgbG9naWNhbCBsaW5lcyAod2hlbiBtZXJnZWQgYnlcbi8vIGNvbGxhcHNlZCBzcGFucykuIFRoZSB3aWRnZXRzIGZvciBhbGwgb2YgdGhlbSBuZWVkIHRvIGJlIGRyYXduLlxuZnVuY3Rpb24gaW5zZXJ0TGluZVdpZGdldHMoY20sIGxpbmVWaWV3LCBkaW1zKSB7XG4gIGluc2VydExpbmVXaWRnZXRzRm9yKGNtLCBsaW5lVmlldy5saW5lLCBsaW5lVmlldywgZGltcywgdHJ1ZSk7XG4gIGlmIChsaW5lVmlldy5yZXN0KSB7IGZvciAodmFyIGkgPSAwOyBpIDwgbGluZVZpZXcucmVzdC5sZW5ndGg7IGkrKylcbiAgICB7IGluc2VydExpbmVXaWRnZXRzRm9yKGNtLCBsaW5lVmlldy5yZXN0W2ldLCBsaW5lVmlldywgZGltcywgZmFsc2UpOyB9IH1cbn1cblxuZnVuY3Rpb24gaW5zZXJ0TGluZVdpZGdldHNGb3IoY20sIGxpbmUsIGxpbmVWaWV3LCBkaW1zLCBhbGxvd0Fib3ZlKSB7XG4gIGlmICghbGluZS53aWRnZXRzKSB7IHJldHVybiB9XG4gIHZhciB3cmFwID0gZW5zdXJlTGluZVdyYXBwZWQobGluZVZpZXcpO1xuICBmb3IgKHZhciBpID0gMCwgd3MgPSBsaW5lLndpZGdldHM7IGkgPCB3cy5sZW5ndGg7ICsraSkge1xuICAgIHZhciB3aWRnZXQgPSB3c1tpXSwgbm9kZSA9IGVsdChcImRpdlwiLCBbd2lkZ2V0Lm5vZGVdLCBcIkNvZGVNaXJyb3ItbGluZXdpZGdldFwiKTtcbiAgICBpZiAoIXdpZGdldC5oYW5kbGVNb3VzZUV2ZW50cykgeyBub2RlLnNldEF0dHJpYnV0ZShcImNtLWlnbm9yZS1ldmVudHNcIiwgXCJ0cnVlXCIpOyB9XG4gICAgcG9zaXRpb25MaW5lV2lkZ2V0KHdpZGdldCwgbm9kZSwgbGluZVZpZXcsIGRpbXMpO1xuICAgIGNtLmRpc3BsYXkuaW5wdXQuc2V0VW5lZGl0YWJsZShub2RlKTtcbiAgICBpZiAoYWxsb3dBYm92ZSAmJiB3aWRnZXQuYWJvdmUpXG4gICAgICB7IHdyYXAuaW5zZXJ0QmVmb3JlKG5vZGUsIGxpbmVWaWV3Lmd1dHRlciB8fCBsaW5lVmlldy50ZXh0KTsgfVxuICAgIGVsc2VcbiAgICAgIHsgd3JhcC5hcHBlbmRDaGlsZChub2RlKTsgfVxuICAgIHNpZ25hbExhdGVyKHdpZGdldCwgXCJyZWRyYXdcIik7XG4gIH1cbn1cblxuZnVuY3Rpb24gcG9zaXRpb25MaW5lV2lkZ2V0KHdpZGdldCwgbm9kZSwgbGluZVZpZXcsIGRpbXMpIHtcbiAgaWYgKHdpZGdldC5ub0hTY3JvbGwpIHtcbiAgICAobGluZVZpZXcuYWxpZ25hYmxlIHx8IChsaW5lVmlldy5hbGlnbmFibGUgPSBbXSkpLnB1c2gobm9kZSk7XG4gICAgdmFyIHdpZHRoID0gZGltcy53cmFwcGVyV2lkdGg7XG4gICAgbm9kZS5zdHlsZS5sZWZ0ID0gZGltcy5maXhlZFBvcyArIFwicHhcIjtcbiAgICBpZiAoIXdpZGdldC5jb3Zlckd1dHRlcikge1xuICAgICAgd2lkdGggLT0gZGltcy5ndXR0ZXJUb3RhbFdpZHRoO1xuICAgICAgbm9kZS5zdHlsZS5wYWRkaW5nTGVmdCA9IGRpbXMuZ3V0dGVyVG90YWxXaWR0aCArIFwicHhcIjtcbiAgICB9XG4gICAgbm9kZS5zdHlsZS53aWR0aCA9IHdpZHRoICsgXCJweFwiO1xuICB9XG4gIGlmICh3aWRnZXQuY292ZXJHdXR0ZXIpIHtcbiAgICBub2RlLnN0eWxlLnpJbmRleCA9IDU7XG4gICAgbm9kZS5zdHlsZS5wb3NpdGlvbiA9IFwicmVsYXRpdmVcIjtcbiAgICBpZiAoIXdpZGdldC5ub0hTY3JvbGwpIHsgbm9kZS5zdHlsZS5tYXJnaW5MZWZ0ID0gLWRpbXMuZ3V0dGVyVG90YWxXaWR0aCArIFwicHhcIjsgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHdpZGdldEhlaWdodCh3aWRnZXQpIHtcbiAgaWYgKHdpZGdldC5oZWlnaHQgIT0gbnVsbCkgeyByZXR1cm4gd2lkZ2V0LmhlaWdodCB9XG4gIHZhciBjbSA9IHdpZGdldC5kb2MuY207XG4gIGlmICghY20pIHsgcmV0dXJuIDAgfVxuICBpZiAoIWNvbnRhaW5zKGRvY3VtZW50LmJvZHksIHdpZGdldC5ub2RlKSkge1xuICAgIHZhciBwYXJlbnRTdHlsZSA9IFwicG9zaXRpb246IHJlbGF0aXZlO1wiO1xuICAgIGlmICh3aWRnZXQuY292ZXJHdXR0ZXIpXG4gICAgICB7IHBhcmVudFN0eWxlICs9IFwibWFyZ2luLWxlZnQ6IC1cIiArIGNtLmRpc3BsYXkuZ3V0dGVycy5vZmZzZXRXaWR0aCArIFwicHg7XCI7IH1cbiAgICBpZiAod2lkZ2V0Lm5vSFNjcm9sbClcbiAgICAgIHsgcGFyZW50U3R5bGUgKz0gXCJ3aWR0aDogXCIgKyBjbS5kaXNwbGF5LndyYXBwZXIuY2xpZW50V2lkdGggKyBcInB4O1wiOyB9XG4gICAgcmVtb3ZlQ2hpbGRyZW5BbmRBZGQoY20uZGlzcGxheS5tZWFzdXJlLCBlbHQoXCJkaXZcIiwgW3dpZGdldC5ub2RlXSwgbnVsbCwgcGFyZW50U3R5bGUpKTtcbiAgfVxuICByZXR1cm4gd2lkZ2V0LmhlaWdodCA9IHdpZGdldC5ub2RlLnBhcmVudE5vZGUub2Zmc2V0SGVpZ2h0XG59XG5cbi8vIFJldHVybiB0cnVlIHdoZW4gdGhlIGdpdmVuIG1vdXNlIGV2ZW50IGhhcHBlbmVkIGluIGEgd2lkZ2V0XG5mdW5jdGlvbiBldmVudEluV2lkZ2V0KGRpc3BsYXksIGUpIHtcbiAgZm9yICh2YXIgbiA9IGVfdGFyZ2V0KGUpOyBuICE9IGRpc3BsYXkud3JhcHBlcjsgbiA9IG4ucGFyZW50Tm9kZSkge1xuICAgIGlmICghbiB8fCAobi5ub2RlVHlwZSA9PSAxICYmIG4uZ2V0QXR0cmlidXRlKFwiY20taWdub3JlLWV2ZW50c1wiKSA9PSBcInRydWVcIikgfHxcbiAgICAgICAgKG4ucGFyZW50Tm9kZSA9PSBkaXNwbGF5LnNpemVyICYmIG4gIT0gZGlzcGxheS5tb3ZlcikpXG4gICAgICB7IHJldHVybiB0cnVlIH1cbiAgfVxufVxuXG4vLyBQT1NJVElPTiBNRUFTVVJFTUVOVFxuXG5mdW5jdGlvbiBwYWRkaW5nVG9wKGRpc3BsYXkpIHtyZXR1cm4gZGlzcGxheS5saW5lU3BhY2Uub2Zmc2V0VG9wfVxuZnVuY3Rpb24gcGFkZGluZ1ZlcnQoZGlzcGxheSkge3JldHVybiBkaXNwbGF5Lm1vdmVyLm9mZnNldEhlaWdodCAtIGRpc3BsYXkubGluZVNwYWNlLm9mZnNldEhlaWdodH1cbmZ1bmN0aW9uIHBhZGRpbmdIKGRpc3BsYXkpIHtcbiAgaWYgKGRpc3BsYXkuY2FjaGVkUGFkZGluZ0gpIHsgcmV0dXJuIGRpc3BsYXkuY2FjaGVkUGFkZGluZ0ggfVxuICB2YXIgZSA9IHJlbW92ZUNoaWxkcmVuQW5kQWRkKGRpc3BsYXkubWVhc3VyZSwgZWx0KFwicHJlXCIsIFwieFwiKSk7XG4gIHZhciBzdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlID8gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZSkgOiBlLmN1cnJlbnRTdHlsZTtcbiAgdmFyIGRhdGEgPSB7bGVmdDogcGFyc2VJbnQoc3R5bGUucGFkZGluZ0xlZnQpLCByaWdodDogcGFyc2VJbnQoc3R5bGUucGFkZGluZ1JpZ2h0KX07XG4gIGlmICghaXNOYU4oZGF0YS5sZWZ0KSAmJiAhaXNOYU4oZGF0YS5yaWdodCkpIHsgZGlzcGxheS5jYWNoZWRQYWRkaW5nSCA9IGRhdGE7IH1cbiAgcmV0dXJuIGRhdGFcbn1cblxuZnVuY3Rpb24gc2Nyb2xsR2FwKGNtKSB7IHJldHVybiBzY3JvbGxlckdhcCAtIGNtLmRpc3BsYXkubmF0aXZlQmFyV2lkdGggfVxuZnVuY3Rpb24gZGlzcGxheVdpZHRoKGNtKSB7XG4gIHJldHVybiBjbS5kaXNwbGF5LnNjcm9sbGVyLmNsaWVudFdpZHRoIC0gc2Nyb2xsR2FwKGNtKSAtIGNtLmRpc3BsYXkuYmFyV2lkdGhcbn1cbmZ1bmN0aW9uIGRpc3BsYXlIZWlnaHQoY20pIHtcbiAgcmV0dXJuIGNtLmRpc3BsYXkuc2Nyb2xsZXIuY2xpZW50SGVpZ2h0IC0gc2Nyb2xsR2FwKGNtKSAtIGNtLmRpc3BsYXkuYmFySGVpZ2h0XG59XG5cbi8vIEVuc3VyZSB0aGUgbGluZVZpZXcud3JhcHBpbmcuaGVpZ2h0cyBhcnJheSBpcyBwb3B1bGF0ZWQuIFRoaXMgaXNcbi8vIGFuIGFycmF5IG9mIGJvdHRvbSBvZmZzZXRzIGZvciB0aGUgbGluZXMgdGhhdCBtYWtlIHVwIGEgZHJhd25cbi8vIGxpbmUuIFdoZW4gbGluZVdyYXBwaW5nIGlzIG9uLCB0aGVyZSBtaWdodCBiZSBtb3JlIHRoYW4gb25lXG4vLyBoZWlnaHQuXG5mdW5jdGlvbiBlbnN1cmVMaW5lSGVpZ2h0cyhjbSwgbGluZVZpZXcsIHJlY3QpIHtcbiAgdmFyIHdyYXBwaW5nID0gY20ub3B0aW9ucy5saW5lV3JhcHBpbmc7XG4gIHZhciBjdXJXaWR0aCA9IHdyYXBwaW5nICYmIGRpc3BsYXlXaWR0aChjbSk7XG4gIGlmICghbGluZVZpZXcubWVhc3VyZS5oZWlnaHRzIHx8IHdyYXBwaW5nICYmIGxpbmVWaWV3Lm1lYXN1cmUud2lkdGggIT0gY3VyV2lkdGgpIHtcbiAgICB2YXIgaGVpZ2h0cyA9IGxpbmVWaWV3Lm1lYXN1cmUuaGVpZ2h0cyA9IFtdO1xuICAgIGlmICh3cmFwcGluZykge1xuICAgICAgbGluZVZpZXcubWVhc3VyZS53aWR0aCA9IGN1cldpZHRoO1xuICAgICAgdmFyIHJlY3RzID0gbGluZVZpZXcudGV4dC5maXJzdENoaWxkLmdldENsaWVudFJlY3RzKCk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlY3RzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICB2YXIgY3VyID0gcmVjdHNbaV0sIG5leHQgPSByZWN0c1tpICsgMV07XG4gICAgICAgIGlmIChNYXRoLmFicyhjdXIuYm90dG9tIC0gbmV4dC5ib3R0b20pID4gMilcbiAgICAgICAgICB7IGhlaWdodHMucHVzaCgoY3VyLmJvdHRvbSArIG5leHQudG9wKSAvIDIgLSByZWN0LnRvcCk7IH1cbiAgICAgIH1cbiAgICB9XG4gICAgaGVpZ2h0cy5wdXNoKHJlY3QuYm90dG9tIC0gcmVjdC50b3ApO1xuICB9XG59XG5cbi8vIEZpbmQgYSBsaW5lIG1hcCAobWFwcGluZyBjaGFyYWN0ZXIgb2Zmc2V0cyB0byB0ZXh0IG5vZGVzKSBhbmQgYVxuLy8gbWVhc3VyZW1lbnQgY2FjaGUgZm9yIHRoZSBnaXZlbiBsaW5lIG51bWJlci4gKEEgbGluZSB2aWV3IG1pZ2h0XG4vLyBjb250YWluIG11bHRpcGxlIGxpbmVzIHdoZW4gY29sbGFwc2VkIHJhbmdlcyBhcmUgcHJlc2VudC4pXG5mdW5jdGlvbiBtYXBGcm9tTGluZVZpZXcobGluZVZpZXcsIGxpbmUsIGxpbmVOKSB7XG4gIGlmIChsaW5lVmlldy5saW5lID09IGxpbmUpXG4gICAgeyByZXR1cm4ge21hcDogbGluZVZpZXcubWVhc3VyZS5tYXAsIGNhY2hlOiBsaW5lVmlldy5tZWFzdXJlLmNhY2hlfSB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZVZpZXcucmVzdC5sZW5ndGg7IGkrKylcbiAgICB7IGlmIChsaW5lVmlldy5yZXN0W2ldID09IGxpbmUpXG4gICAgICB7IHJldHVybiB7bWFwOiBsaW5lVmlldy5tZWFzdXJlLm1hcHNbaV0sIGNhY2hlOiBsaW5lVmlldy5tZWFzdXJlLmNhY2hlc1tpXX0gfSB9XG4gIGZvciAodmFyIGkkMSA9IDA7IGkkMSA8IGxpbmVWaWV3LnJlc3QubGVuZ3RoOyBpJDErKylcbiAgICB7IGlmIChsaW5lTm8obGluZVZpZXcucmVzdFtpJDFdKSA+IGxpbmVOKVxuICAgICAgeyByZXR1cm4ge21hcDogbGluZVZpZXcubWVhc3VyZS5tYXBzW2kkMV0sIGNhY2hlOiBsaW5lVmlldy5tZWFzdXJlLmNhY2hlc1tpJDFdLCBiZWZvcmU6IHRydWV9IH0gfVxufVxuXG4vLyBSZW5kZXIgYSBsaW5lIGludG8gdGhlIGhpZGRlbiBub2RlIGRpc3BsYXkuZXh0ZXJuYWxNZWFzdXJlZC4gVXNlZFxuLy8gd2hlbiBtZWFzdXJlbWVudCBpcyBuZWVkZWQgZm9yIGEgbGluZSB0aGF0J3Mgbm90IGluIHRoZSB2aWV3cG9ydC5cbmZ1bmN0aW9uIHVwZGF0ZUV4dGVybmFsTWVhc3VyZW1lbnQoY20sIGxpbmUpIHtcbiAgbGluZSA9IHZpc3VhbExpbmUobGluZSk7XG4gIHZhciBsaW5lTiA9IGxpbmVObyhsaW5lKTtcbiAgdmFyIHZpZXcgPSBjbS5kaXNwbGF5LmV4dGVybmFsTWVhc3VyZWQgPSBuZXcgTGluZVZpZXcoY20uZG9jLCBsaW5lLCBsaW5lTik7XG4gIHZpZXcubGluZU4gPSBsaW5lTjtcbiAgdmFyIGJ1aWx0ID0gdmlldy5idWlsdCA9IGJ1aWxkTGluZUNvbnRlbnQoY20sIHZpZXcpO1xuICB2aWV3LnRleHQgPSBidWlsdC5wcmU7XG4gIHJlbW92ZUNoaWxkcmVuQW5kQWRkKGNtLmRpc3BsYXkubGluZU1lYXN1cmUsIGJ1aWx0LnByZSk7XG4gIHJldHVybiB2aWV3XG59XG5cbi8vIEdldCBhIHt0b3AsIGJvdHRvbSwgbGVmdCwgcmlnaHR9IGJveCAoaW4gbGluZS1sb2NhbCBjb29yZGluYXRlcylcbi8vIGZvciBhIGdpdmVuIGNoYXJhY3Rlci5cbmZ1bmN0aW9uIG1lYXN1cmVDaGFyKGNtLCBsaW5lLCBjaCwgYmlhcykge1xuICByZXR1cm4gbWVhc3VyZUNoYXJQcmVwYXJlZChjbSwgcHJlcGFyZU1lYXN1cmVGb3JMaW5lKGNtLCBsaW5lKSwgY2gsIGJpYXMpXG59XG5cbi8vIEZpbmQgYSBsaW5lIHZpZXcgdGhhdCBjb3JyZXNwb25kcyB0byB0aGUgZ2l2ZW4gbGluZSBudW1iZXIuXG5mdW5jdGlvbiBmaW5kVmlld0ZvckxpbmUoY20sIGxpbmVOKSB7XG4gIGlmIChsaW5lTiA+PSBjbS5kaXNwbGF5LnZpZXdGcm9tICYmIGxpbmVOIDwgY20uZGlzcGxheS52aWV3VG8pXG4gICAgeyByZXR1cm4gY20uZGlzcGxheS52aWV3W2ZpbmRWaWV3SW5kZXgoY20sIGxpbmVOKV0gfVxuICB2YXIgZXh0ID0gY20uZGlzcGxheS5leHRlcm5hbE1lYXN1cmVkO1xuICBpZiAoZXh0ICYmIGxpbmVOID49IGV4dC5saW5lTiAmJiBsaW5lTiA8IGV4dC5saW5lTiArIGV4dC5zaXplKVxuICAgIHsgcmV0dXJuIGV4dCB9XG59XG5cbi8vIE1lYXN1cmVtZW50IGNhbiBiZSBzcGxpdCBpbiB0d28gc3RlcHMsIHRoZSBzZXQtdXAgd29yayB0aGF0XG4vLyBhcHBsaWVzIHRvIHRoZSB3aG9sZSBsaW5lLCBhbmQgdGhlIG1lYXN1cmVtZW50IG9mIHRoZSBhY3R1YWxcbi8vIGNoYXJhY3Rlci4gRnVuY3Rpb25zIGxpa2UgY29vcmRzQ2hhciwgdGhhdCBuZWVkIHRvIGRvIGEgbG90IG9mXG4vLyBtZWFzdXJlbWVudHMgaW4gYSByb3csIGNhbiB0aHVzIGVuc3VyZSB0aGF0IHRoZSBzZXQtdXAgd29yayBpc1xuLy8gb25seSBkb25lIG9uY2UuXG5mdW5jdGlvbiBwcmVwYXJlTWVhc3VyZUZvckxpbmUoY20sIGxpbmUpIHtcbiAgdmFyIGxpbmVOID0gbGluZU5vKGxpbmUpO1xuICB2YXIgdmlldyA9IGZpbmRWaWV3Rm9yTGluZShjbSwgbGluZU4pO1xuICBpZiAodmlldyAmJiAhdmlldy50ZXh0KSB7XG4gICAgdmlldyA9IG51bGw7XG4gIH0gZWxzZSBpZiAodmlldyAmJiB2aWV3LmNoYW5nZXMpIHtcbiAgICB1cGRhdGVMaW5lRm9yQ2hhbmdlcyhjbSwgdmlldywgbGluZU4sIGdldERpbWVuc2lvbnMoY20pKTtcbiAgICBjbS5jdXJPcC5mb3JjZVVwZGF0ZSA9IHRydWU7XG4gIH1cbiAgaWYgKCF2aWV3KVxuICAgIHsgdmlldyA9IHVwZGF0ZUV4dGVybmFsTWVhc3VyZW1lbnQoY20sIGxpbmUpOyB9XG5cbiAgdmFyIGluZm8gPSBtYXBGcm9tTGluZVZpZXcodmlldywgbGluZSwgbGluZU4pO1xuICByZXR1cm4ge1xuICAgIGxpbmU6IGxpbmUsIHZpZXc6IHZpZXcsIHJlY3Q6IG51bGwsXG4gICAgbWFwOiBpbmZvLm1hcCwgY2FjaGU6IGluZm8uY2FjaGUsIGJlZm9yZTogaW5mby5iZWZvcmUsXG4gICAgaGFzSGVpZ2h0czogZmFsc2VcbiAgfVxufVxuXG4vLyBHaXZlbiBhIHByZXBhcmVkIG1lYXN1cmVtZW50IG9iamVjdCwgbWVhc3VyZXMgdGhlIHBvc2l0aW9uIG9mIGFuXG4vLyBhY3R1YWwgY2hhcmFjdGVyIChvciBmZXRjaGVzIGl0IGZyb20gdGhlIGNhY2hlKS5cbmZ1bmN0aW9uIG1lYXN1cmVDaGFyUHJlcGFyZWQoY20sIHByZXBhcmVkLCBjaCwgYmlhcywgdmFySGVpZ2h0KSB7XG4gIGlmIChwcmVwYXJlZC5iZWZvcmUpIHsgY2ggPSAtMTsgfVxuICB2YXIga2V5ID0gY2ggKyAoYmlhcyB8fCBcIlwiKSwgZm91bmQ7XG4gIGlmIChwcmVwYXJlZC5jYWNoZS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgZm91bmQgPSBwcmVwYXJlZC5jYWNoZVtrZXldO1xuICB9IGVsc2Uge1xuICAgIGlmICghcHJlcGFyZWQucmVjdClcbiAgICAgIHsgcHJlcGFyZWQucmVjdCA9IHByZXBhcmVkLnZpZXcudGV4dC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTsgfVxuICAgIGlmICghcHJlcGFyZWQuaGFzSGVpZ2h0cykge1xuICAgICAgZW5zdXJlTGluZUhlaWdodHMoY20sIHByZXBhcmVkLnZpZXcsIHByZXBhcmVkLnJlY3QpO1xuICAgICAgcHJlcGFyZWQuaGFzSGVpZ2h0cyA9IHRydWU7XG4gICAgfVxuICAgIGZvdW5kID0gbWVhc3VyZUNoYXJJbm5lcihjbSwgcHJlcGFyZWQsIGNoLCBiaWFzKTtcbiAgICBpZiAoIWZvdW5kLmJvZ3VzKSB7IHByZXBhcmVkLmNhY2hlW2tleV0gPSBmb3VuZDsgfVxuICB9XG4gIHJldHVybiB7bGVmdDogZm91bmQubGVmdCwgcmlnaHQ6IGZvdW5kLnJpZ2h0LFxuICAgICAgICAgIHRvcDogdmFySGVpZ2h0ID8gZm91bmQucnRvcCA6IGZvdW5kLnRvcCxcbiAgICAgICAgICBib3R0b206IHZhckhlaWdodCA/IGZvdW5kLnJib3R0b20gOiBmb3VuZC5ib3R0b219XG59XG5cbnZhciBudWxsUmVjdCA9IHtsZWZ0OiAwLCByaWdodDogMCwgdG9wOiAwLCBib3R0b206IDB9O1xuXG5mdW5jdGlvbiBub2RlQW5kT2Zmc2V0SW5MaW5lTWFwKG1hcCQkMSwgY2gsIGJpYXMpIHtcbiAgdmFyIG5vZGUsIHN0YXJ0LCBlbmQsIGNvbGxhcHNlLCBtU3RhcnQsIG1FbmQ7XG4gIC8vIEZpcnN0LCBzZWFyY2ggdGhlIGxpbmUgbWFwIGZvciB0aGUgdGV4dCBub2RlIGNvcnJlc3BvbmRpbmcgdG8sXG4gIC8vIG9yIGNsb3Nlc3QgdG8sIHRoZSB0YXJnZXQgY2hhcmFjdGVyLlxuICBmb3IgKHZhciBpID0gMDsgaSA8IG1hcCQkMS5sZW5ndGg7IGkgKz0gMykge1xuICAgIG1TdGFydCA9IG1hcCQkMVtpXTtcbiAgICBtRW5kID0gbWFwJCQxW2kgKyAxXTtcbiAgICBpZiAoY2ggPCBtU3RhcnQpIHtcbiAgICAgIHN0YXJ0ID0gMDsgZW5kID0gMTtcbiAgICAgIGNvbGxhcHNlID0gXCJsZWZ0XCI7XG4gICAgfSBlbHNlIGlmIChjaCA8IG1FbmQpIHtcbiAgICAgIHN0YXJ0ID0gY2ggLSBtU3RhcnQ7XG4gICAgICBlbmQgPSBzdGFydCArIDE7XG4gICAgfSBlbHNlIGlmIChpID09IG1hcCQkMS5sZW5ndGggLSAzIHx8IGNoID09IG1FbmQgJiYgbWFwJCQxW2kgKyAzXSA+IGNoKSB7XG4gICAgICBlbmQgPSBtRW5kIC0gbVN0YXJ0O1xuICAgICAgc3RhcnQgPSBlbmQgLSAxO1xuICAgICAgaWYgKGNoID49IG1FbmQpIHsgY29sbGFwc2UgPSBcInJpZ2h0XCI7IH1cbiAgICB9XG4gICAgaWYgKHN0YXJ0ICE9IG51bGwpIHtcbiAgICAgIG5vZGUgPSBtYXAkJDFbaSArIDJdO1xuICAgICAgaWYgKG1TdGFydCA9PSBtRW5kICYmIGJpYXMgPT0gKG5vZGUuaW5zZXJ0TGVmdCA/IFwibGVmdFwiIDogXCJyaWdodFwiKSlcbiAgICAgICAgeyBjb2xsYXBzZSA9IGJpYXM7IH1cbiAgICAgIGlmIChiaWFzID09IFwibGVmdFwiICYmIHN0YXJ0ID09IDApXG4gICAgICAgIHsgd2hpbGUgKGkgJiYgbWFwJCQxW2kgLSAyXSA9PSBtYXAkJDFbaSAtIDNdICYmIG1hcCQkMVtpIC0gMV0uaW5zZXJ0TGVmdCkge1xuICAgICAgICAgIG5vZGUgPSBtYXAkJDFbKGkgLT0gMykgKyAyXTtcbiAgICAgICAgICBjb2xsYXBzZSA9IFwibGVmdFwiO1xuICAgICAgICB9IH1cbiAgICAgIGlmIChiaWFzID09IFwicmlnaHRcIiAmJiBzdGFydCA9PSBtRW5kIC0gbVN0YXJ0KVxuICAgICAgICB7IHdoaWxlIChpIDwgbWFwJCQxLmxlbmd0aCAtIDMgJiYgbWFwJCQxW2kgKyAzXSA9PSBtYXAkJDFbaSArIDRdICYmICFtYXAkJDFbaSArIDVdLmluc2VydExlZnQpIHtcbiAgICAgICAgICBub2RlID0gbWFwJCQxWyhpICs9IDMpICsgMl07XG4gICAgICAgICAgY29sbGFwc2UgPSBcInJpZ2h0XCI7XG4gICAgICAgIH0gfVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHtub2RlOiBub2RlLCBzdGFydDogc3RhcnQsIGVuZDogZW5kLCBjb2xsYXBzZTogY29sbGFwc2UsIGNvdmVyU3RhcnQ6IG1TdGFydCwgY292ZXJFbmQ6IG1FbmR9XG59XG5cbmZ1bmN0aW9uIGdldFVzZWZ1bFJlY3QocmVjdHMsIGJpYXMpIHtcbiAgdmFyIHJlY3QgPSBudWxsUmVjdDtcbiAgaWYgKGJpYXMgPT0gXCJsZWZ0XCIpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCByZWN0cy5sZW5ndGg7IGkrKykge1xuICAgIGlmICgocmVjdCA9IHJlY3RzW2ldKS5sZWZ0ICE9IHJlY3QucmlnaHQpIHsgYnJlYWsgfVxuICB9IH0gZWxzZSB7IGZvciAodmFyIGkkMSA9IHJlY3RzLmxlbmd0aCAtIDE7IGkkMSA+PSAwOyBpJDEtLSkge1xuICAgIGlmICgocmVjdCA9IHJlY3RzW2kkMV0pLmxlZnQgIT0gcmVjdC5yaWdodCkgeyBicmVhayB9XG4gIH0gfVxuICByZXR1cm4gcmVjdFxufVxuXG5mdW5jdGlvbiBtZWFzdXJlQ2hhcklubmVyKGNtLCBwcmVwYXJlZCwgY2gsIGJpYXMpIHtcbiAgdmFyIHBsYWNlID0gbm9kZUFuZE9mZnNldEluTGluZU1hcChwcmVwYXJlZC5tYXAsIGNoLCBiaWFzKTtcbiAgdmFyIG5vZGUgPSBwbGFjZS5ub2RlLCBzdGFydCA9IHBsYWNlLnN0YXJ0LCBlbmQgPSBwbGFjZS5lbmQsIGNvbGxhcHNlID0gcGxhY2UuY29sbGFwc2U7XG5cbiAgdmFyIHJlY3Q7XG4gIGlmIChub2RlLm5vZGVUeXBlID09IDMpIHsgLy8gSWYgaXQgaXMgYSB0ZXh0IG5vZGUsIHVzZSBhIHJhbmdlIHRvIHJldHJpZXZlIHRoZSBjb29yZGluYXRlcy5cbiAgICBmb3IgKHZhciBpJDEgPSAwOyBpJDEgPCA0OyBpJDErKykgeyAvLyBSZXRyeSBhIG1heGltdW0gb2YgNCB0aW1lcyB3aGVuIG5vbnNlbnNlIHJlY3RhbmdsZXMgYXJlIHJldHVybmVkXG4gICAgICB3aGlsZSAoc3RhcnQgJiYgaXNFeHRlbmRpbmdDaGFyKHByZXBhcmVkLmxpbmUudGV4dC5jaGFyQXQocGxhY2UuY292ZXJTdGFydCArIHN0YXJ0KSkpIHsgLS1zdGFydDsgfVxuICAgICAgd2hpbGUgKHBsYWNlLmNvdmVyU3RhcnQgKyBlbmQgPCBwbGFjZS5jb3ZlckVuZCAmJiBpc0V4dGVuZGluZ0NoYXIocHJlcGFyZWQubGluZS50ZXh0LmNoYXJBdChwbGFjZS5jb3ZlclN0YXJ0ICsgZW5kKSkpIHsgKytlbmQ7IH1cbiAgICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgOSAmJiBzdGFydCA9PSAwICYmIGVuZCA9PSBwbGFjZS5jb3ZlckVuZCAtIHBsYWNlLmNvdmVyU3RhcnQpXG4gICAgICAgIHsgcmVjdCA9IG5vZGUucGFyZW50Tm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTsgfVxuICAgICAgZWxzZVxuICAgICAgICB7IHJlY3QgPSBnZXRVc2VmdWxSZWN0KHJhbmdlKG5vZGUsIHN0YXJ0LCBlbmQpLmdldENsaWVudFJlY3RzKCksIGJpYXMpOyB9XG4gICAgICBpZiAocmVjdC5sZWZ0IHx8IHJlY3QucmlnaHQgfHwgc3RhcnQgPT0gMCkgeyBicmVhayB9XG4gICAgICBlbmQgPSBzdGFydDtcbiAgICAgIHN0YXJ0ID0gc3RhcnQgLSAxO1xuICAgICAgY29sbGFwc2UgPSBcInJpZ2h0XCI7XG4gICAgfVxuICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgMTEpIHsgcmVjdCA9IG1heWJlVXBkYXRlUmVjdEZvclpvb21pbmcoY20uZGlzcGxheS5tZWFzdXJlLCByZWN0KTsgfVxuICB9IGVsc2UgeyAvLyBJZiBpdCBpcyBhIHdpZGdldCwgc2ltcGx5IGdldCB0aGUgYm94IGZvciB0aGUgd2hvbGUgd2lkZ2V0LlxuICAgIGlmIChzdGFydCA+IDApIHsgY29sbGFwc2UgPSBiaWFzID0gXCJyaWdodFwiOyB9XG4gICAgdmFyIHJlY3RzO1xuICAgIGlmIChjbS5vcHRpb25zLmxpbmVXcmFwcGluZyAmJiAocmVjdHMgPSBub2RlLmdldENsaWVudFJlY3RzKCkpLmxlbmd0aCA+IDEpXG4gICAgICB7IHJlY3QgPSByZWN0c1tiaWFzID09IFwicmlnaHRcIiA/IHJlY3RzLmxlbmd0aCAtIDEgOiAwXTsgfVxuICAgIGVsc2VcbiAgICAgIHsgcmVjdCA9IG5vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7IH1cbiAgfVxuICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA8IDkgJiYgIXN0YXJ0ICYmICghcmVjdCB8fCAhcmVjdC5sZWZ0ICYmICFyZWN0LnJpZ2h0KSkge1xuICAgIHZhciByU3BhbiA9IG5vZGUucGFyZW50Tm9kZS5nZXRDbGllbnRSZWN0cygpWzBdO1xuICAgIGlmIChyU3BhbilcbiAgICAgIHsgcmVjdCA9IHtsZWZ0OiByU3Bhbi5sZWZ0LCByaWdodDogclNwYW4ubGVmdCArIGNoYXJXaWR0aChjbS5kaXNwbGF5KSwgdG9wOiByU3Bhbi50b3AsIGJvdHRvbTogclNwYW4uYm90dG9tfTsgfVxuICAgIGVsc2VcbiAgICAgIHsgcmVjdCA9IG51bGxSZWN0OyB9XG4gIH1cblxuICB2YXIgcnRvcCA9IHJlY3QudG9wIC0gcHJlcGFyZWQucmVjdC50b3AsIHJib3QgPSByZWN0LmJvdHRvbSAtIHByZXBhcmVkLnJlY3QudG9wO1xuICB2YXIgbWlkID0gKHJ0b3AgKyByYm90KSAvIDI7XG4gIHZhciBoZWlnaHRzID0gcHJlcGFyZWQudmlldy5tZWFzdXJlLmhlaWdodHM7XG4gIHZhciBpID0gMDtcbiAgZm9yICg7IGkgPCBoZWlnaHRzLmxlbmd0aCAtIDE7IGkrKylcbiAgICB7IGlmIChtaWQgPCBoZWlnaHRzW2ldKSB7IGJyZWFrIH0gfVxuICB2YXIgdG9wID0gaSA/IGhlaWdodHNbaSAtIDFdIDogMCwgYm90ID0gaGVpZ2h0c1tpXTtcbiAgdmFyIHJlc3VsdCA9IHtsZWZ0OiAoY29sbGFwc2UgPT0gXCJyaWdodFwiID8gcmVjdC5yaWdodCA6IHJlY3QubGVmdCkgLSBwcmVwYXJlZC5yZWN0LmxlZnQsXG4gICAgICAgICAgICAgICAgcmlnaHQ6IChjb2xsYXBzZSA9PSBcImxlZnRcIiA/IHJlY3QubGVmdCA6IHJlY3QucmlnaHQpIC0gcHJlcGFyZWQucmVjdC5sZWZ0LFxuICAgICAgICAgICAgICAgIHRvcDogdG9wLCBib3R0b206IGJvdH07XG4gIGlmICghcmVjdC5sZWZ0ICYmICFyZWN0LnJpZ2h0KSB7IHJlc3VsdC5ib2d1cyA9IHRydWU7IH1cbiAgaWYgKCFjbS5vcHRpb25zLnNpbmdsZUN1cnNvckhlaWdodFBlckxpbmUpIHsgcmVzdWx0LnJ0b3AgPSBydG9wOyByZXN1bHQucmJvdHRvbSA9IHJib3Q7IH1cblxuICByZXR1cm4gcmVzdWx0XG59XG5cbi8vIFdvcmsgYXJvdW5kIHByb2JsZW0gd2l0aCBib3VuZGluZyBjbGllbnQgcmVjdHMgb24gcmFuZ2VzIGJlaW5nXG4vLyByZXR1cm5lZCBpbmNvcnJlY3RseSB3aGVuIHpvb21lZCBvbiBJRTEwIGFuZCBiZWxvdy5cbmZ1bmN0aW9uIG1heWJlVXBkYXRlUmVjdEZvclpvb21pbmcobWVhc3VyZSwgcmVjdCkge1xuICBpZiAoIXdpbmRvdy5zY3JlZW4gfHwgc2NyZWVuLmxvZ2ljYWxYRFBJID09IG51bGwgfHxcbiAgICAgIHNjcmVlbi5sb2dpY2FsWERQSSA9PSBzY3JlZW4uZGV2aWNlWERQSSB8fCAhaGFzQmFkWm9vbWVkUmVjdHMobWVhc3VyZSkpXG4gICAgeyByZXR1cm4gcmVjdCB9XG4gIHZhciBzY2FsZVggPSBzY3JlZW4ubG9naWNhbFhEUEkgLyBzY3JlZW4uZGV2aWNlWERQSTtcbiAgdmFyIHNjYWxlWSA9IHNjcmVlbi5sb2dpY2FsWURQSSAvIHNjcmVlbi5kZXZpY2VZRFBJO1xuICByZXR1cm4ge2xlZnQ6IHJlY3QubGVmdCAqIHNjYWxlWCwgcmlnaHQ6IHJlY3QucmlnaHQgKiBzY2FsZVgsXG4gICAgICAgICAgdG9wOiByZWN0LnRvcCAqIHNjYWxlWSwgYm90dG9tOiByZWN0LmJvdHRvbSAqIHNjYWxlWX1cbn1cblxuZnVuY3Rpb24gY2xlYXJMaW5lTWVhc3VyZW1lbnRDYWNoZUZvcihsaW5lVmlldykge1xuICBpZiAobGluZVZpZXcubWVhc3VyZSkge1xuICAgIGxpbmVWaWV3Lm1lYXN1cmUuY2FjaGUgPSB7fTtcbiAgICBsaW5lVmlldy5tZWFzdXJlLmhlaWdodHMgPSBudWxsO1xuICAgIGlmIChsaW5lVmlldy5yZXN0KSB7IGZvciAodmFyIGkgPSAwOyBpIDwgbGluZVZpZXcucmVzdC5sZW5ndGg7IGkrKylcbiAgICAgIHsgbGluZVZpZXcubWVhc3VyZS5jYWNoZXNbaV0gPSB7fTsgfSB9XG4gIH1cbn1cblxuZnVuY3Rpb24gY2xlYXJMaW5lTWVhc3VyZW1lbnRDYWNoZShjbSkge1xuICBjbS5kaXNwbGF5LmV4dGVybmFsTWVhc3VyZSA9IG51bGw7XG4gIHJlbW92ZUNoaWxkcmVuKGNtLmRpc3BsYXkubGluZU1lYXN1cmUpO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGNtLmRpc3BsYXkudmlldy5sZW5ndGg7IGkrKylcbiAgICB7IGNsZWFyTGluZU1lYXN1cmVtZW50Q2FjaGVGb3IoY20uZGlzcGxheS52aWV3W2ldKTsgfVxufVxuXG5mdW5jdGlvbiBjbGVhckNhY2hlcyhjbSkge1xuICBjbGVhckxpbmVNZWFzdXJlbWVudENhY2hlKGNtKTtcbiAgY20uZGlzcGxheS5jYWNoZWRDaGFyV2lkdGggPSBjbS5kaXNwbGF5LmNhY2hlZFRleHRIZWlnaHQgPSBjbS5kaXNwbGF5LmNhY2hlZFBhZGRpbmdIID0gbnVsbDtcbiAgaWYgKCFjbS5vcHRpb25zLmxpbmVXcmFwcGluZykgeyBjbS5kaXNwbGF5Lm1heExpbmVDaGFuZ2VkID0gdHJ1ZTsgfVxuICBjbS5kaXNwbGF5LmxpbmVOdW1DaGFycyA9IG51bGw7XG59XG5cbmZ1bmN0aW9uIHBhZ2VTY3JvbGxYKCkge1xuICAvLyBXb3JrIGFyb3VuZCBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD00ODkyMDZcbiAgLy8gd2hpY2ggY2F1c2VzIHBhZ2VfT2Zmc2V0IGFuZCBib3VuZGluZyBjbGllbnQgcmVjdHMgdG8gdXNlXG4gIC8vIGRpZmZlcmVudCByZWZlcmVuY2Ugdmlld3BvcnRzIGFuZCBpbnZhbGlkYXRlIG91ciBjYWxjdWxhdGlvbnMuXG4gIGlmIChjaHJvbWUgJiYgYW5kcm9pZCkgeyByZXR1cm4gLShkb2N1bWVudC5ib2R5LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmxlZnQgLSBwYXJzZUludChnZXRDb21wdXRlZFN0eWxlKGRvY3VtZW50LmJvZHkpLm1hcmdpbkxlZnQpKSB9XG4gIHJldHVybiB3aW5kb3cucGFnZVhPZmZzZXQgfHwgKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCB8fCBkb2N1bWVudC5ib2R5KS5zY3JvbGxMZWZ0XG59XG5mdW5jdGlvbiBwYWdlU2Nyb2xsWSgpIHtcbiAgaWYgKGNocm9tZSAmJiBhbmRyb2lkKSB7IHJldHVybiAtKGRvY3VtZW50LmJvZHkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkudG9wIC0gcGFyc2VJbnQoZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5KS5tYXJnaW5Ub3ApKSB9XG4gIHJldHVybiB3aW5kb3cucGFnZVlPZmZzZXQgfHwgKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCB8fCBkb2N1bWVudC5ib2R5KS5zY3JvbGxUb3Bcbn1cblxuZnVuY3Rpb24gd2lkZ2V0VG9wSGVpZ2h0KGxpbmVPYmopIHtcbiAgdmFyIGhlaWdodCA9IDA7XG4gIGlmIChsaW5lT2JqLndpZGdldHMpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5lT2JqLndpZGdldHMubGVuZ3RoOyArK2kpIHsgaWYgKGxpbmVPYmoud2lkZ2V0c1tpXS5hYm92ZSlcbiAgICB7IGhlaWdodCArPSB3aWRnZXRIZWlnaHQobGluZU9iai53aWRnZXRzW2ldKTsgfSB9IH1cbiAgcmV0dXJuIGhlaWdodFxufVxuXG4vLyBDb252ZXJ0cyBhIHt0b3AsIGJvdHRvbSwgbGVmdCwgcmlnaHR9IGJveCBmcm9tIGxpbmUtbG9jYWxcbi8vIGNvb3JkaW5hdGVzIGludG8gYW5vdGhlciBjb29yZGluYXRlIHN5c3RlbS4gQ29udGV4dCBtYXkgYmUgb25lIG9mXG4vLyBcImxpbmVcIiwgXCJkaXZcIiAoZGlzcGxheS5saW5lRGl2KSwgXCJsb2NhbFwiLi9udWxsIChlZGl0b3IpLCBcIndpbmRvd1wiLFxuLy8gb3IgXCJwYWdlXCIuXG5mdW5jdGlvbiBpbnRvQ29vcmRTeXN0ZW0oY20sIGxpbmVPYmosIHJlY3QsIGNvbnRleHQsIGluY2x1ZGVXaWRnZXRzKSB7XG4gIGlmICghaW5jbHVkZVdpZGdldHMpIHtcbiAgICB2YXIgaGVpZ2h0ID0gd2lkZ2V0VG9wSGVpZ2h0KGxpbmVPYmopO1xuICAgIHJlY3QudG9wICs9IGhlaWdodDsgcmVjdC5ib3R0b20gKz0gaGVpZ2h0O1xuICB9XG4gIGlmIChjb250ZXh0ID09IFwibGluZVwiKSB7IHJldHVybiByZWN0IH1cbiAgaWYgKCFjb250ZXh0KSB7IGNvbnRleHQgPSBcImxvY2FsXCI7IH1cbiAgdmFyIHlPZmYgPSBoZWlnaHRBdExpbmUobGluZU9iaik7XG4gIGlmIChjb250ZXh0ID09IFwibG9jYWxcIikgeyB5T2ZmICs9IHBhZGRpbmdUb3AoY20uZGlzcGxheSk7IH1cbiAgZWxzZSB7IHlPZmYgLT0gY20uZGlzcGxheS52aWV3T2Zmc2V0OyB9XG4gIGlmIChjb250ZXh0ID09IFwicGFnZVwiIHx8IGNvbnRleHQgPT0gXCJ3aW5kb3dcIikge1xuICAgIHZhciBsT2ZmID0gY20uZGlzcGxheS5saW5lU3BhY2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgeU9mZiArPSBsT2ZmLnRvcCArIChjb250ZXh0ID09IFwid2luZG93XCIgPyAwIDogcGFnZVNjcm9sbFkoKSk7XG4gICAgdmFyIHhPZmYgPSBsT2ZmLmxlZnQgKyAoY29udGV4dCA9PSBcIndpbmRvd1wiID8gMCA6IHBhZ2VTY3JvbGxYKCkpO1xuICAgIHJlY3QubGVmdCArPSB4T2ZmOyByZWN0LnJpZ2h0ICs9IHhPZmY7XG4gIH1cbiAgcmVjdC50b3AgKz0geU9mZjsgcmVjdC5ib3R0b20gKz0geU9mZjtcbiAgcmV0dXJuIHJlY3Rcbn1cblxuLy8gQ292ZXJ0cyBhIGJveCBmcm9tIFwiZGl2XCIgY29vcmRzIHRvIGFub3RoZXIgY29vcmRpbmF0ZSBzeXN0ZW0uXG4vLyBDb250ZXh0IG1heSBiZSBcIndpbmRvd1wiLCBcInBhZ2VcIiwgXCJkaXZcIiwgb3IgXCJsb2NhbFwiLi9udWxsLlxuZnVuY3Rpb24gZnJvbUNvb3JkU3lzdGVtKGNtLCBjb29yZHMsIGNvbnRleHQpIHtcbiAgaWYgKGNvbnRleHQgPT0gXCJkaXZcIikgeyByZXR1cm4gY29vcmRzIH1cbiAgdmFyIGxlZnQgPSBjb29yZHMubGVmdCwgdG9wID0gY29vcmRzLnRvcDtcbiAgLy8gRmlyc3QgbW92ZSBpbnRvIFwicGFnZVwiIGNvb3JkaW5hdGUgc3lzdGVtXG4gIGlmIChjb250ZXh0ID09IFwicGFnZVwiKSB7XG4gICAgbGVmdCAtPSBwYWdlU2Nyb2xsWCgpO1xuICAgIHRvcCAtPSBwYWdlU2Nyb2xsWSgpO1xuICB9IGVsc2UgaWYgKGNvbnRleHQgPT0gXCJsb2NhbFwiIHx8ICFjb250ZXh0KSB7XG4gICAgdmFyIGxvY2FsQm94ID0gY20uZGlzcGxheS5zaXplci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICBsZWZ0ICs9IGxvY2FsQm94LmxlZnQ7XG4gICAgdG9wICs9IGxvY2FsQm94LnRvcDtcbiAgfVxuXG4gIHZhciBsaW5lU3BhY2VCb3ggPSBjbS5kaXNwbGF5LmxpbmVTcGFjZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgcmV0dXJuIHtsZWZ0OiBsZWZ0IC0gbGluZVNwYWNlQm94LmxlZnQsIHRvcDogdG9wIC0gbGluZVNwYWNlQm94LnRvcH1cbn1cblxuZnVuY3Rpb24gY2hhckNvb3JkcyhjbSwgcG9zLCBjb250ZXh0LCBsaW5lT2JqLCBiaWFzKSB7XG4gIGlmICghbGluZU9iaikgeyBsaW5lT2JqID0gZ2V0TGluZShjbS5kb2MsIHBvcy5saW5lKTsgfVxuICByZXR1cm4gaW50b0Nvb3JkU3lzdGVtKGNtLCBsaW5lT2JqLCBtZWFzdXJlQ2hhcihjbSwgbGluZU9iaiwgcG9zLmNoLCBiaWFzKSwgY29udGV4dClcbn1cblxuLy8gUmV0dXJucyBhIGJveCBmb3IgYSBnaXZlbiBjdXJzb3IgcG9zaXRpb24sIHdoaWNoIG1heSBoYXZlIGFuXG4vLyAnb3RoZXInIHByb3BlcnR5IGNvbnRhaW5pbmcgdGhlIHBvc2l0aW9uIG9mIHRoZSBzZWNvbmRhcnkgY3Vyc29yXG4vLyBvbiBhIGJpZGkgYm91bmRhcnkuXG4vLyBBIGN1cnNvciBQb3MobGluZSwgY2hhciwgXCJiZWZvcmVcIikgaXMgb24gdGhlIHNhbWUgdmlzdWFsIGxpbmUgYXMgYGNoYXIgLSAxYFxuLy8gYW5kIGFmdGVyIGBjaGFyIC0gMWAgaW4gd3JpdGluZyBvcmRlciBvZiBgY2hhciAtIDFgXG4vLyBBIGN1cnNvciBQb3MobGluZSwgY2hhciwgXCJhZnRlclwiKSBpcyBvbiB0aGUgc2FtZSB2aXN1YWwgbGluZSBhcyBgY2hhcmBcbi8vIGFuZCBiZWZvcmUgYGNoYXJgIGluIHdyaXRpbmcgb3JkZXIgb2YgYGNoYXJgXG4vLyBFeGFtcGxlcyAodXBwZXItY2FzZSBsZXR0ZXJzIGFyZSBSVEwsIGxvd2VyLWNhc2UgYXJlIExUUik6XG4vLyAgICAgUG9zKDAsIDEsIC4uLilcbi8vICAgICBiZWZvcmUgICBhZnRlclxuLy8gYWIgICAgIGF8YiAgICAgYXxiXG4vLyBhQiAgICAgYXxCICAgICBhQnxcbi8vIEFiICAgICB8QWIgICAgIEF8YlxuLy8gQUIgICAgIEJ8QSAgICAgQnxBXG4vLyBFdmVyeSBwb3NpdGlvbiBhZnRlciB0aGUgbGFzdCBjaGFyYWN0ZXIgb24gYSBsaW5lIGlzIGNvbnNpZGVyZWQgdG8gc3RpY2tcbi8vIHRvIHRoZSBsYXN0IGNoYXJhY3RlciBvbiB0aGUgbGluZS5cbmZ1bmN0aW9uIGN1cnNvckNvb3JkcyhjbSwgcG9zLCBjb250ZXh0LCBsaW5lT2JqLCBwcmVwYXJlZE1lYXN1cmUsIHZhckhlaWdodCkge1xuICBsaW5lT2JqID0gbGluZU9iaiB8fCBnZXRMaW5lKGNtLmRvYywgcG9zLmxpbmUpO1xuICBpZiAoIXByZXBhcmVkTWVhc3VyZSkgeyBwcmVwYXJlZE1lYXN1cmUgPSBwcmVwYXJlTWVhc3VyZUZvckxpbmUoY20sIGxpbmVPYmopOyB9XG4gIGZ1bmN0aW9uIGdldChjaCwgcmlnaHQpIHtcbiAgICB2YXIgbSA9IG1lYXN1cmVDaGFyUHJlcGFyZWQoY20sIHByZXBhcmVkTWVhc3VyZSwgY2gsIHJpZ2h0ID8gXCJyaWdodFwiIDogXCJsZWZ0XCIsIHZhckhlaWdodCk7XG4gICAgaWYgKHJpZ2h0KSB7IG0ubGVmdCA9IG0ucmlnaHQ7IH0gZWxzZSB7IG0ucmlnaHQgPSBtLmxlZnQ7IH1cbiAgICByZXR1cm4gaW50b0Nvb3JkU3lzdGVtKGNtLCBsaW5lT2JqLCBtLCBjb250ZXh0KVxuICB9XG4gIHZhciBvcmRlciA9IGdldE9yZGVyKGxpbmVPYmosIGNtLmRvYy5kaXJlY3Rpb24pLCBjaCA9IHBvcy5jaCwgc3RpY2t5ID0gcG9zLnN0aWNreTtcbiAgaWYgKGNoID49IGxpbmVPYmoudGV4dC5sZW5ndGgpIHtcbiAgICBjaCA9IGxpbmVPYmoudGV4dC5sZW5ndGg7XG4gICAgc3RpY2t5ID0gXCJiZWZvcmVcIjtcbiAgfSBlbHNlIGlmIChjaCA8PSAwKSB7XG4gICAgY2ggPSAwO1xuICAgIHN0aWNreSA9IFwiYWZ0ZXJcIjtcbiAgfVxuICBpZiAoIW9yZGVyKSB7IHJldHVybiBnZXQoc3RpY2t5ID09IFwiYmVmb3JlXCIgPyBjaCAtIDEgOiBjaCwgc3RpY2t5ID09IFwiYmVmb3JlXCIpIH1cblxuICBmdW5jdGlvbiBnZXRCaWRpKGNoLCBwYXJ0UG9zLCBpbnZlcnQpIHtcbiAgICB2YXIgcGFydCA9IG9yZGVyW3BhcnRQb3NdLCByaWdodCA9IHBhcnQubGV2ZWwgPT0gMTtcbiAgICByZXR1cm4gZ2V0KGludmVydCA/IGNoIC0gMSA6IGNoLCByaWdodCAhPSBpbnZlcnQpXG4gIH1cbiAgdmFyIHBhcnRQb3MgPSBnZXRCaWRpUGFydEF0KG9yZGVyLCBjaCwgc3RpY2t5KTtcbiAgdmFyIG90aGVyID0gYmlkaU90aGVyO1xuICB2YXIgdmFsID0gZ2V0QmlkaShjaCwgcGFydFBvcywgc3RpY2t5ID09IFwiYmVmb3JlXCIpO1xuICBpZiAob3RoZXIgIT0gbnVsbCkgeyB2YWwub3RoZXIgPSBnZXRCaWRpKGNoLCBvdGhlciwgc3RpY2t5ICE9IFwiYmVmb3JlXCIpOyB9XG4gIHJldHVybiB2YWxcbn1cblxuLy8gVXNlZCB0byBjaGVhcGx5IGVzdGltYXRlIHRoZSBjb29yZGluYXRlcyBmb3IgYSBwb3NpdGlvbi4gVXNlZCBmb3Jcbi8vIGludGVybWVkaWF0ZSBzY3JvbGwgdXBkYXRlcy5cbmZ1bmN0aW9uIGVzdGltYXRlQ29vcmRzKGNtLCBwb3MpIHtcbiAgdmFyIGxlZnQgPSAwO1xuICBwb3MgPSBjbGlwUG9zKGNtLmRvYywgcG9zKTtcbiAgaWYgKCFjbS5vcHRpb25zLmxpbmVXcmFwcGluZykgeyBsZWZ0ID0gY2hhcldpZHRoKGNtLmRpc3BsYXkpICogcG9zLmNoOyB9XG4gIHZhciBsaW5lT2JqID0gZ2V0TGluZShjbS5kb2MsIHBvcy5saW5lKTtcbiAgdmFyIHRvcCA9IGhlaWdodEF0TGluZShsaW5lT2JqKSArIHBhZGRpbmdUb3AoY20uZGlzcGxheSk7XG4gIHJldHVybiB7bGVmdDogbGVmdCwgcmlnaHQ6IGxlZnQsIHRvcDogdG9wLCBib3R0b206IHRvcCArIGxpbmVPYmouaGVpZ2h0fVxufVxuXG4vLyBQb3NpdGlvbnMgcmV0dXJuZWQgYnkgY29vcmRzQ2hhciBjb250YWluIHNvbWUgZXh0cmEgaW5mb3JtYXRpb24uXG4vLyB4UmVsIGlzIHRoZSByZWxhdGl2ZSB4IHBvc2l0aW9uIG9mIHRoZSBpbnB1dCBjb29yZGluYXRlcyBjb21wYXJlZFxuLy8gdG8gdGhlIGZvdW5kIHBvc2l0aW9uIChzbyB4UmVsID4gMCBtZWFucyB0aGUgY29vcmRpbmF0ZXMgYXJlIHRvXG4vLyB0aGUgcmlnaHQgb2YgdGhlIGNoYXJhY3RlciBwb3NpdGlvbiwgZm9yIGV4YW1wbGUpLiBXaGVuIG91dHNpZGVcbi8vIGlzIHRydWUsIHRoYXQgbWVhbnMgdGhlIGNvb3JkaW5hdGVzIGxpZSBvdXRzaWRlIHRoZSBsaW5lJ3Ncbi8vIHZlcnRpY2FsIHJhbmdlLlxuZnVuY3Rpb24gUG9zV2l0aEluZm8obGluZSwgY2gsIHN0aWNreSwgb3V0c2lkZSwgeFJlbCkge1xuICB2YXIgcG9zID0gUG9zKGxpbmUsIGNoLCBzdGlja3kpO1xuICBwb3MueFJlbCA9IHhSZWw7XG4gIGlmIChvdXRzaWRlKSB7IHBvcy5vdXRzaWRlID0gdHJ1ZTsgfVxuICByZXR1cm4gcG9zXG59XG5cbi8vIENvbXB1dGUgdGhlIGNoYXJhY3RlciBwb3NpdGlvbiBjbG9zZXN0IHRvIHRoZSBnaXZlbiBjb29yZGluYXRlcy5cbi8vIElucHV0IG11c3QgYmUgbGluZVNwYWNlLWxvY2FsIChcImRpdlwiIGNvb3JkaW5hdGUgc3lzdGVtKS5cbmZ1bmN0aW9uIGNvb3Jkc0NoYXIoY20sIHgsIHkpIHtcbiAgdmFyIGRvYyA9IGNtLmRvYztcbiAgeSArPSBjbS5kaXNwbGF5LnZpZXdPZmZzZXQ7XG4gIGlmICh5IDwgMCkgeyByZXR1cm4gUG9zV2l0aEluZm8oZG9jLmZpcnN0LCAwLCBudWxsLCB0cnVlLCAtMSkgfVxuICB2YXIgbGluZU4gPSBsaW5lQXRIZWlnaHQoZG9jLCB5KSwgbGFzdCA9IGRvYy5maXJzdCArIGRvYy5zaXplIC0gMTtcbiAgaWYgKGxpbmVOID4gbGFzdClcbiAgICB7IHJldHVybiBQb3NXaXRoSW5mbyhkb2MuZmlyc3QgKyBkb2Muc2l6ZSAtIDEsIGdldExpbmUoZG9jLCBsYXN0KS50ZXh0Lmxlbmd0aCwgbnVsbCwgdHJ1ZSwgMSkgfVxuICBpZiAoeCA8IDApIHsgeCA9IDA7IH1cblxuICB2YXIgbGluZU9iaiA9IGdldExpbmUoZG9jLCBsaW5lTik7XG4gIGZvciAoOzspIHtcbiAgICB2YXIgZm91bmQgPSBjb29yZHNDaGFySW5uZXIoY20sIGxpbmVPYmosIGxpbmVOLCB4LCB5KTtcbiAgICB2YXIgbWVyZ2VkID0gY29sbGFwc2VkU3BhbkF0RW5kKGxpbmVPYmopO1xuICAgIHZhciBtZXJnZWRQb3MgPSBtZXJnZWQgJiYgbWVyZ2VkLmZpbmQoMCwgdHJ1ZSk7XG4gICAgaWYgKG1lcmdlZCAmJiAoZm91bmQuY2ggPiBtZXJnZWRQb3MuZnJvbS5jaCB8fCBmb3VuZC5jaCA9PSBtZXJnZWRQb3MuZnJvbS5jaCAmJiBmb3VuZC54UmVsID4gMCkpXG4gICAgICB7IGxpbmVOID0gbGluZU5vKGxpbmVPYmogPSBtZXJnZWRQb3MudG8ubGluZSk7IH1cbiAgICBlbHNlXG4gICAgICB7IHJldHVybiBmb3VuZCB9XG4gIH1cbn1cblxuZnVuY3Rpb24gd3JhcHBlZExpbmVFeHRlbnQoY20sIGxpbmVPYmosIHByZXBhcmVkTWVhc3VyZSwgeSkge1xuICB5IC09IHdpZGdldFRvcEhlaWdodChsaW5lT2JqKTtcbiAgdmFyIGVuZCA9IGxpbmVPYmoudGV4dC5sZW5ndGg7XG4gIHZhciBiZWdpbiA9IGZpbmRGaXJzdChmdW5jdGlvbiAoY2gpIHsgcmV0dXJuIG1lYXN1cmVDaGFyUHJlcGFyZWQoY20sIHByZXBhcmVkTWVhc3VyZSwgY2ggLSAxKS5ib3R0b20gPD0geTsgfSwgZW5kLCAwKTtcbiAgZW5kID0gZmluZEZpcnN0KGZ1bmN0aW9uIChjaCkgeyByZXR1cm4gbWVhc3VyZUNoYXJQcmVwYXJlZChjbSwgcHJlcGFyZWRNZWFzdXJlLCBjaCkudG9wID4geTsgfSwgYmVnaW4sIGVuZCk7XG4gIHJldHVybiB7YmVnaW46IGJlZ2luLCBlbmQ6IGVuZH1cbn1cblxuZnVuY3Rpb24gd3JhcHBlZExpbmVFeHRlbnRDaGFyKGNtLCBsaW5lT2JqLCBwcmVwYXJlZE1lYXN1cmUsIHRhcmdldCkge1xuICBpZiAoIXByZXBhcmVkTWVhc3VyZSkgeyBwcmVwYXJlZE1lYXN1cmUgPSBwcmVwYXJlTWVhc3VyZUZvckxpbmUoY20sIGxpbmVPYmopOyB9XG4gIHZhciB0YXJnZXRUb3AgPSBpbnRvQ29vcmRTeXN0ZW0oY20sIGxpbmVPYmosIG1lYXN1cmVDaGFyUHJlcGFyZWQoY20sIHByZXBhcmVkTWVhc3VyZSwgdGFyZ2V0KSwgXCJsaW5lXCIpLnRvcDtcbiAgcmV0dXJuIHdyYXBwZWRMaW5lRXh0ZW50KGNtLCBsaW5lT2JqLCBwcmVwYXJlZE1lYXN1cmUsIHRhcmdldFRvcClcbn1cblxuLy8gUmV0dXJucyB0cnVlIGlmIHRoZSBnaXZlbiBzaWRlIG9mIGEgYm94IGlzIGFmdGVyIHRoZSBnaXZlblxuLy8gY29vcmRpbmF0ZXMsIGluIHRvcC10by1ib3R0b20sIGxlZnQtdG8tcmlnaHQgb3JkZXIuXG5mdW5jdGlvbiBib3hJc0FmdGVyKGJveCwgeCwgeSwgbGVmdCkge1xuICByZXR1cm4gYm94LmJvdHRvbSA8PSB5ID8gZmFsc2UgOiBib3gudG9wID4geSA/IHRydWUgOiAobGVmdCA/IGJveC5sZWZ0IDogYm94LnJpZ2h0KSA+IHhcbn1cblxuZnVuY3Rpb24gY29vcmRzQ2hhcklubmVyKGNtLCBsaW5lT2JqLCBsaW5lTm8kJDEsIHgsIHkpIHtcbiAgLy8gTW92ZSB5IGludG8gbGluZS1sb2NhbCBjb29yZGluYXRlIHNwYWNlXG4gIHkgLT0gaGVpZ2h0QXRMaW5lKGxpbmVPYmopO1xuICB2YXIgcHJlcGFyZWRNZWFzdXJlID0gcHJlcGFyZU1lYXN1cmVGb3JMaW5lKGNtLCBsaW5lT2JqKTtcbiAgLy8gV2hlbiBkaXJlY3RseSBjYWxsaW5nIGBtZWFzdXJlQ2hhclByZXBhcmVkYCwgd2UgaGF2ZSB0byBhZGp1c3RcbiAgLy8gZm9yIHRoZSB3aWRnZXRzIGF0IHRoaXMgbGluZS5cbiAgdmFyIHdpZGdldEhlaWdodCQkMSA9IHdpZGdldFRvcEhlaWdodChsaW5lT2JqKTtcbiAgdmFyIGJlZ2luID0gMCwgZW5kID0gbGluZU9iai50ZXh0Lmxlbmd0aCwgbHRyID0gdHJ1ZTtcblxuICB2YXIgb3JkZXIgPSBnZXRPcmRlcihsaW5lT2JqLCBjbS5kb2MuZGlyZWN0aW9uKTtcbiAgLy8gSWYgdGhlIGxpbmUgaXNuJ3QgcGxhaW4gbGVmdC10by1yaWdodCB0ZXh0LCBmaXJzdCBmaWd1cmUgb3V0XG4gIC8vIHdoaWNoIGJpZGkgc2VjdGlvbiB0aGUgY29vcmRpbmF0ZXMgZmFsbCBpbnRvLlxuICBpZiAob3JkZXIpIHtcbiAgICB2YXIgcGFydCA9IChjbS5vcHRpb25zLmxpbmVXcmFwcGluZyA/IGNvb3Jkc0JpZGlQYXJ0V3JhcHBlZCA6IGNvb3Jkc0JpZGlQYXJ0KVxuICAgICAgICAgICAgICAgICAoY20sIGxpbmVPYmosIGxpbmVObyQkMSwgcHJlcGFyZWRNZWFzdXJlLCBvcmRlciwgeCwgeSk7XG4gICAgbHRyID0gcGFydC5sZXZlbCAhPSAxO1xuICAgIC8vIFRoZSBhd2t3YXJkIC0xIG9mZnNldHMgYXJlIG5lZWRlZCBiZWNhdXNlIGZpbmRGaXJzdCAoY2FsbGVkXG4gICAgLy8gb24gdGhlc2UgYmVsb3cpIHdpbGwgdHJlYXQgaXRzIGZpcnN0IGJvdW5kIGFzIGluY2x1c2l2ZSxcbiAgICAvLyBzZWNvbmQgYXMgZXhjbHVzaXZlLCBidXQgd2Ugd2FudCB0byBhY3R1YWxseSBhZGRyZXNzIHRoZVxuICAgIC8vIGNoYXJhY3RlcnMgaW4gdGhlIHBhcnQncyByYW5nZVxuICAgIGJlZ2luID0gbHRyID8gcGFydC5mcm9tIDogcGFydC50byAtIDE7XG4gICAgZW5kID0gbHRyID8gcGFydC50byA6IHBhcnQuZnJvbSAtIDE7XG4gIH1cblxuICAvLyBBIGJpbmFyeSBzZWFyY2ggdG8gZmluZCB0aGUgZmlyc3QgY2hhcmFjdGVyIHdob3NlIGJvdW5kaW5nIGJveFxuICAvLyBzdGFydHMgYWZ0ZXIgdGhlIGNvb3JkaW5hdGVzLiBJZiB3ZSBydW4gYWNyb3NzIGFueSB3aG9zZSBib3ggd3JhcFxuICAvLyB0aGUgY29vcmRpbmF0ZXMsIHN0b3JlIHRoYXQuXG4gIHZhciBjaEFyb3VuZCA9IG51bGwsIGJveEFyb3VuZCA9IG51bGw7XG4gIHZhciBjaCA9IGZpbmRGaXJzdChmdW5jdGlvbiAoY2gpIHtcbiAgICB2YXIgYm94ID0gbWVhc3VyZUNoYXJQcmVwYXJlZChjbSwgcHJlcGFyZWRNZWFzdXJlLCBjaCk7XG4gICAgYm94LnRvcCArPSB3aWRnZXRIZWlnaHQkJDE7IGJveC5ib3R0b20gKz0gd2lkZ2V0SGVpZ2h0JCQxO1xuICAgIGlmICghYm94SXNBZnRlcihib3gsIHgsIHksIGZhbHNlKSkgeyByZXR1cm4gZmFsc2UgfVxuICAgIGlmIChib3gudG9wIDw9IHkgJiYgYm94LmxlZnQgPD0geCkge1xuICAgICAgY2hBcm91bmQgPSBjaDtcbiAgICAgIGJveEFyb3VuZCA9IGJveDtcbiAgICB9XG4gICAgcmV0dXJuIHRydWVcbiAgfSwgYmVnaW4sIGVuZCk7XG5cbiAgdmFyIGJhc2VYLCBzdGlja3ksIG91dHNpZGUgPSBmYWxzZTtcbiAgLy8gSWYgYSBib3ggYXJvdW5kIHRoZSBjb29yZGluYXRlcyB3YXMgZm91bmQsIHVzZSB0aGF0XG4gIGlmIChib3hBcm91bmQpIHtcbiAgICAvLyBEaXN0aW5ndWlzaCBjb29yZGluYXRlcyBuZWFyZXIgdG8gdGhlIGxlZnQgb3IgcmlnaHQgc2lkZSBvZiB0aGUgYm94XG4gICAgdmFyIGF0TGVmdCA9IHggLSBib3hBcm91bmQubGVmdCA8IGJveEFyb3VuZC5yaWdodCAtIHgsIGF0U3RhcnQgPSBhdExlZnQgPT0gbHRyO1xuICAgIGNoID0gY2hBcm91bmQgKyAoYXRTdGFydCA/IDAgOiAxKTtcbiAgICBzdGlja3kgPSBhdFN0YXJ0ID8gXCJhZnRlclwiIDogXCJiZWZvcmVcIjtcbiAgICBiYXNlWCA9IGF0TGVmdCA/IGJveEFyb3VuZC5sZWZ0IDogYm94QXJvdW5kLnJpZ2h0O1xuICB9IGVsc2Uge1xuICAgIC8vIChBZGp1c3QgZm9yIGV4dGVuZGVkIGJvdW5kLCBpZiBuZWNlc3NhcnkuKVxuICAgIGlmICghbHRyICYmIChjaCA9PSBlbmQgfHwgY2ggPT0gYmVnaW4pKSB7IGNoKys7IH1cbiAgICAvLyBUbyBkZXRlcm1pbmUgd2hpY2ggc2lkZSB0byBhc3NvY2lhdGUgd2l0aCwgZ2V0IHRoZSBib3ggdG8gdGhlXG4gICAgLy8gbGVmdCBvZiB0aGUgY2hhcmFjdGVyIGFuZCBjb21wYXJlIGl0J3MgdmVydGljYWwgcG9zaXRpb24gdG8gdGhlXG4gICAgLy8gY29vcmRpbmF0ZXNcbiAgICBzdGlja3kgPSBjaCA9PSAwID8gXCJhZnRlclwiIDogY2ggPT0gbGluZU9iai50ZXh0Lmxlbmd0aCA/IFwiYmVmb3JlXCIgOlxuICAgICAgKG1lYXN1cmVDaGFyUHJlcGFyZWQoY20sIHByZXBhcmVkTWVhc3VyZSwgY2ggLSAobHRyID8gMSA6IDApKS5ib3R0b20gKyB3aWRnZXRIZWlnaHQkJDEgPD0geSkgPT0gbHRyID9cbiAgICAgIFwiYWZ0ZXJcIiA6IFwiYmVmb3JlXCI7XG4gICAgLy8gTm93IGdldCBhY2N1cmF0ZSBjb29yZGluYXRlcyBmb3IgdGhpcyBwbGFjZSwgaW4gb3JkZXIgdG8gZ2V0IGFcbiAgICAvLyBiYXNlIFggcG9zaXRpb25cbiAgICB2YXIgY29vcmRzID0gY3Vyc29yQ29vcmRzKGNtLCBQb3MobGluZU5vJCQxLCBjaCwgc3RpY2t5KSwgXCJsaW5lXCIsIGxpbmVPYmosIHByZXBhcmVkTWVhc3VyZSk7XG4gICAgYmFzZVggPSBjb29yZHMubGVmdDtcbiAgICBvdXRzaWRlID0geSA8IGNvb3Jkcy50b3AgfHwgeSA+PSBjb29yZHMuYm90dG9tO1xuICB9XG5cbiAgY2ggPSBza2lwRXh0ZW5kaW5nQ2hhcnMobGluZU9iai50ZXh0LCBjaCwgMSk7XG4gIHJldHVybiBQb3NXaXRoSW5mbyhsaW5lTm8kJDEsIGNoLCBzdGlja3ksIG91dHNpZGUsIHggLSBiYXNlWClcbn1cblxuZnVuY3Rpb24gY29vcmRzQmlkaVBhcnQoY20sIGxpbmVPYmosIGxpbmVObyQkMSwgcHJlcGFyZWRNZWFzdXJlLCBvcmRlciwgeCwgeSkge1xuICAvLyBCaWRpIHBhcnRzIGFyZSBzb3J0ZWQgbGVmdC10by1yaWdodCwgYW5kIGluIGEgbm9uLWxpbmUtd3JhcHBpbmdcbiAgLy8gc2l0dWF0aW9uLCB3ZSBjYW4gdGFrZSB0aGlzIG9yZGVyaW5nIHRvIGNvcnJlc3BvbmQgdG8gdGhlIHZpc3VhbFxuICAvLyBvcmRlcmluZy4gVGhpcyBmaW5kcyB0aGUgZmlyc3QgcGFydCB3aG9zZSBlbmQgaXMgYWZ0ZXIgdGhlIGdpdmVuXG4gIC8vIGNvb3JkaW5hdGVzLlxuICB2YXIgaW5kZXggPSBmaW5kRmlyc3QoZnVuY3Rpb24gKGkpIHtcbiAgICB2YXIgcGFydCA9IG9yZGVyW2ldLCBsdHIgPSBwYXJ0LmxldmVsICE9IDE7XG4gICAgcmV0dXJuIGJveElzQWZ0ZXIoY3Vyc29yQ29vcmRzKGNtLCBQb3MobGluZU5vJCQxLCBsdHIgPyBwYXJ0LnRvIDogcGFydC5mcm9tLCBsdHIgPyBcImJlZm9yZVwiIDogXCJhZnRlclwiKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJsaW5lXCIsIGxpbmVPYmosIHByZXBhcmVkTWVhc3VyZSksIHgsIHksIHRydWUpXG4gIH0sIDAsIG9yZGVyLmxlbmd0aCAtIDEpO1xuICB2YXIgcGFydCA9IG9yZGVyW2luZGV4XTtcbiAgLy8gSWYgdGhpcyBpc24ndCB0aGUgZmlyc3QgcGFydCwgdGhlIHBhcnQncyBzdGFydCBpcyBhbHNvIGFmdGVyXG4gIC8vIHRoZSBjb29yZGluYXRlcywgYW5kIHRoZSBjb29yZGluYXRlcyBhcmVuJ3Qgb24gdGhlIHNhbWUgbGluZSBhc1xuICAvLyB0aGF0IHN0YXJ0LCBtb3ZlIG9uZSBwYXJ0IGJhY2suXG4gIGlmIChpbmRleCA+IDApIHtcbiAgICB2YXIgbHRyID0gcGFydC5sZXZlbCAhPSAxO1xuICAgIHZhciBzdGFydCA9IGN1cnNvckNvb3JkcyhjbSwgUG9zKGxpbmVObyQkMSwgbHRyID8gcGFydC5mcm9tIDogcGFydC50bywgbHRyID8gXCJhZnRlclwiIDogXCJiZWZvcmVcIiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibGluZVwiLCBsaW5lT2JqLCBwcmVwYXJlZE1lYXN1cmUpO1xuICAgIGlmIChib3hJc0FmdGVyKHN0YXJ0LCB4LCB5LCB0cnVlKSAmJiBzdGFydC50b3AgPiB5KVxuICAgICAgeyBwYXJ0ID0gb3JkZXJbaW5kZXggLSAxXTsgfVxuICB9XG4gIHJldHVybiBwYXJ0XG59XG5cbmZ1bmN0aW9uIGNvb3Jkc0JpZGlQYXJ0V3JhcHBlZChjbSwgbGluZU9iaiwgX2xpbmVObywgcHJlcGFyZWRNZWFzdXJlLCBvcmRlciwgeCwgeSkge1xuICAvLyBJbiBhIHdyYXBwZWQgbGluZSwgcnRsIHRleHQgb24gd3JhcHBpbmcgYm91bmRhcmllcyBjYW4gZG8gdGhpbmdzXG4gIC8vIHRoYXQgZG9uJ3QgY29ycmVzcG9uZCB0byB0aGUgb3JkZXJpbmcgaW4gb3VyIGBvcmRlcmAgYXJyYXkgYXRcbiAgLy8gYWxsLCBzbyBhIGJpbmFyeSBzZWFyY2ggZG9lc24ndCB3b3JrLCBhbmQgd2Ugd2FudCB0byByZXR1cm4gYVxuICAvLyBwYXJ0IHRoYXQgb25seSBzcGFucyBvbmUgbGluZSBzbyB0aGF0IHRoZSBiaW5hcnkgc2VhcmNoIGluXG4gIC8vIGNvb3Jkc0NoYXJJbm5lciBpcyBzYWZlLiBBcyBzdWNoLCB3ZSBmaXJzdCBmaW5kIHRoZSBleHRlbnQgb2YgdGhlXG4gIC8vIHdyYXBwZWQgbGluZSwgYW5kIHRoZW4gZG8gYSBmbGF0IHNlYXJjaCBpbiB3aGljaCB3ZSBkaXNjYXJkIGFueVxuICAvLyBzcGFucyB0aGF0IGFyZW4ndCBvbiB0aGUgbGluZS5cbiAgdmFyIHJlZiA9IHdyYXBwZWRMaW5lRXh0ZW50KGNtLCBsaW5lT2JqLCBwcmVwYXJlZE1lYXN1cmUsIHkpO1xuICB2YXIgYmVnaW4gPSByZWYuYmVnaW47XG4gIHZhciBlbmQgPSByZWYuZW5kO1xuICBpZiAoL1xccy8udGVzdChsaW5lT2JqLnRleHQuY2hhckF0KGVuZCAtIDEpKSkgeyBlbmQtLTsgfVxuICB2YXIgcGFydCA9IG51bGwsIGNsb3Nlc3REaXN0ID0gbnVsbDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcmRlci5sZW5ndGg7IGkrKykge1xuICAgIHZhciBwID0gb3JkZXJbaV07XG4gICAgaWYgKHAuZnJvbSA+PSBlbmQgfHwgcC50byA8PSBiZWdpbikgeyBjb250aW51ZSB9XG4gICAgdmFyIGx0ciA9IHAubGV2ZWwgIT0gMTtcbiAgICB2YXIgZW5kWCA9IG1lYXN1cmVDaGFyUHJlcGFyZWQoY20sIHByZXBhcmVkTWVhc3VyZSwgbHRyID8gTWF0aC5taW4oZW5kLCBwLnRvKSAtIDEgOiBNYXRoLm1heChiZWdpbiwgcC5mcm9tKSkucmlnaHQ7XG4gICAgLy8gV2VpZ2ggYWdhaW5zdCBzcGFucyBlbmRpbmcgYmVmb3JlIHRoaXMsIHNvIHRoYXQgdGhleSBhcmUgb25seVxuICAgIC8vIHBpY2tlZCBpZiBub3RoaW5nIGVuZHMgYWZ0ZXJcbiAgICB2YXIgZGlzdCA9IGVuZFggPCB4ID8geCAtIGVuZFggKyAxZTkgOiBlbmRYIC0geDtcbiAgICBpZiAoIXBhcnQgfHwgY2xvc2VzdERpc3QgPiBkaXN0KSB7XG4gICAgICBwYXJ0ID0gcDtcbiAgICAgIGNsb3Nlc3REaXN0ID0gZGlzdDtcbiAgICB9XG4gIH1cbiAgaWYgKCFwYXJ0KSB7IHBhcnQgPSBvcmRlcltvcmRlci5sZW5ndGggLSAxXTsgfVxuICAvLyBDbGlwIHRoZSBwYXJ0IHRvIHRoZSB3cmFwcGVkIGxpbmUuXG4gIGlmIChwYXJ0LmZyb20gPCBiZWdpbikgeyBwYXJ0ID0ge2Zyb206IGJlZ2luLCB0bzogcGFydC50bywgbGV2ZWw6IHBhcnQubGV2ZWx9OyB9XG4gIGlmIChwYXJ0LnRvID4gZW5kKSB7IHBhcnQgPSB7ZnJvbTogcGFydC5mcm9tLCB0bzogZW5kLCBsZXZlbDogcGFydC5sZXZlbH07IH1cbiAgcmV0dXJuIHBhcnRcbn1cblxudmFyIG1lYXN1cmVUZXh0O1xuLy8gQ29tcHV0ZSB0aGUgZGVmYXVsdCB0ZXh0IGhlaWdodC5cbmZ1bmN0aW9uIHRleHRIZWlnaHQoZGlzcGxheSkge1xuICBpZiAoZGlzcGxheS5jYWNoZWRUZXh0SGVpZ2h0ICE9IG51bGwpIHsgcmV0dXJuIGRpc3BsYXkuY2FjaGVkVGV4dEhlaWdodCB9XG4gIGlmIChtZWFzdXJlVGV4dCA9PSBudWxsKSB7XG4gICAgbWVhc3VyZVRleHQgPSBlbHQoXCJwcmVcIik7XG4gICAgLy8gTWVhc3VyZSBhIGJ1bmNoIG9mIGxpbmVzLCBmb3IgYnJvd3NlcnMgdGhhdCBjb21wdXRlXG4gICAgLy8gZnJhY3Rpb25hbCBoZWlnaHRzLlxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgNDk7ICsraSkge1xuICAgICAgbWVhc3VyZVRleHQuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJ4XCIpKTtcbiAgICAgIG1lYXN1cmVUZXh0LmFwcGVuZENoaWxkKGVsdChcImJyXCIpKTtcbiAgICB9XG4gICAgbWVhc3VyZVRleHQuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJ4XCIpKTtcbiAgfVxuICByZW1vdmVDaGlsZHJlbkFuZEFkZChkaXNwbGF5Lm1lYXN1cmUsIG1lYXN1cmVUZXh0KTtcbiAgdmFyIGhlaWdodCA9IG1lYXN1cmVUZXh0Lm9mZnNldEhlaWdodCAvIDUwO1xuICBpZiAoaGVpZ2h0ID4gMykgeyBkaXNwbGF5LmNhY2hlZFRleHRIZWlnaHQgPSBoZWlnaHQ7IH1cbiAgcmVtb3ZlQ2hpbGRyZW4oZGlzcGxheS5tZWFzdXJlKTtcbiAgcmV0dXJuIGhlaWdodCB8fCAxXG59XG5cbi8vIENvbXB1dGUgdGhlIGRlZmF1bHQgY2hhcmFjdGVyIHdpZHRoLlxuZnVuY3Rpb24gY2hhcldpZHRoKGRpc3BsYXkpIHtcbiAgaWYgKGRpc3BsYXkuY2FjaGVkQ2hhcldpZHRoICE9IG51bGwpIHsgcmV0dXJuIGRpc3BsYXkuY2FjaGVkQ2hhcldpZHRoIH1cbiAgdmFyIGFuY2hvciA9IGVsdChcInNwYW5cIiwgXCJ4eHh4eHh4eHh4XCIpO1xuICB2YXIgcHJlID0gZWx0KFwicHJlXCIsIFthbmNob3JdKTtcbiAgcmVtb3ZlQ2hpbGRyZW5BbmRBZGQoZGlzcGxheS5tZWFzdXJlLCBwcmUpO1xuICB2YXIgcmVjdCA9IGFuY2hvci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSwgd2lkdGggPSAocmVjdC5yaWdodCAtIHJlY3QubGVmdCkgLyAxMDtcbiAgaWYgKHdpZHRoID4gMikgeyBkaXNwbGF5LmNhY2hlZENoYXJXaWR0aCA9IHdpZHRoOyB9XG4gIHJldHVybiB3aWR0aCB8fCAxMFxufVxuXG4vLyBEbyBhIGJ1bGstcmVhZCBvZiB0aGUgRE9NIHBvc2l0aW9ucyBhbmQgc2l6ZXMgbmVlZGVkIHRvIGRyYXcgdGhlXG4vLyB2aWV3LCBzbyB0aGF0IHdlIGRvbid0IGludGVybGVhdmUgcmVhZGluZyBhbmQgd3JpdGluZyB0byB0aGUgRE9NLlxuZnVuY3Rpb24gZ2V0RGltZW5zaW9ucyhjbSkge1xuICB2YXIgZCA9IGNtLmRpc3BsYXksIGxlZnQgPSB7fSwgd2lkdGggPSB7fTtcbiAgdmFyIGd1dHRlckxlZnQgPSBkLmd1dHRlcnMuY2xpZW50TGVmdDtcbiAgZm9yICh2YXIgbiA9IGQuZ3V0dGVycy5maXJzdENoaWxkLCBpID0gMDsgbjsgbiA9IG4ubmV4dFNpYmxpbmcsICsraSkge1xuICAgIGxlZnRbY20ub3B0aW9ucy5ndXR0ZXJzW2ldXSA9IG4ub2Zmc2V0TGVmdCArIG4uY2xpZW50TGVmdCArIGd1dHRlckxlZnQ7XG4gICAgd2lkdGhbY20ub3B0aW9ucy5ndXR0ZXJzW2ldXSA9IG4uY2xpZW50V2lkdGg7XG4gIH1cbiAgcmV0dXJuIHtmaXhlZFBvczogY29tcGVuc2F0ZUZvckhTY3JvbGwoZCksXG4gICAgICAgICAgZ3V0dGVyVG90YWxXaWR0aDogZC5ndXR0ZXJzLm9mZnNldFdpZHRoLFxuICAgICAgICAgIGd1dHRlckxlZnQ6IGxlZnQsXG4gICAgICAgICAgZ3V0dGVyV2lkdGg6IHdpZHRoLFxuICAgICAgICAgIHdyYXBwZXJXaWR0aDogZC53cmFwcGVyLmNsaWVudFdpZHRofVxufVxuXG4vLyBDb21wdXRlcyBkaXNwbGF5LnNjcm9sbGVyLnNjcm9sbExlZnQgKyBkaXNwbGF5Lmd1dHRlcnMub2Zmc2V0V2lkdGgsXG4vLyBidXQgdXNpbmcgZ2V0Qm91bmRpbmdDbGllbnRSZWN0IHRvIGdldCBhIHN1Yi1waXhlbC1hY2N1cmF0ZVxuLy8gcmVzdWx0LlxuZnVuY3Rpb24gY29tcGVuc2F0ZUZvckhTY3JvbGwoZGlzcGxheSkge1xuICByZXR1cm4gZGlzcGxheS5zY3JvbGxlci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5sZWZ0IC0gZGlzcGxheS5zaXplci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5sZWZ0XG59XG5cbi8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IGVzdGltYXRlcyB0aGUgaGVpZ2h0IG9mIGEgbGluZSwgdG8gdXNlIGFzXG4vLyBmaXJzdCBhcHByb3hpbWF0aW9uIHVudGlsIHRoZSBsaW5lIGJlY29tZXMgdmlzaWJsZSAoYW5kIGlzIHRodXNcbi8vIHByb3Blcmx5IG1lYXN1cmFibGUpLlxuZnVuY3Rpb24gZXN0aW1hdGVIZWlnaHQoY20pIHtcbiAgdmFyIHRoID0gdGV4dEhlaWdodChjbS5kaXNwbGF5KSwgd3JhcHBpbmcgPSBjbS5vcHRpb25zLmxpbmVXcmFwcGluZztcbiAgdmFyIHBlckxpbmUgPSB3cmFwcGluZyAmJiBNYXRoLm1heCg1LCBjbS5kaXNwbGF5LnNjcm9sbGVyLmNsaWVudFdpZHRoIC8gY2hhcldpZHRoKGNtLmRpc3BsYXkpIC0gMyk7XG4gIHJldHVybiBmdW5jdGlvbiAobGluZSkge1xuICAgIGlmIChsaW5lSXNIaWRkZW4oY20uZG9jLCBsaW5lKSkgeyByZXR1cm4gMCB9XG5cbiAgICB2YXIgd2lkZ2V0c0hlaWdodCA9IDA7XG4gICAgaWYgKGxpbmUud2lkZ2V0cykgeyBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmUud2lkZ2V0cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGxpbmUud2lkZ2V0c1tpXS5oZWlnaHQpIHsgd2lkZ2V0c0hlaWdodCArPSBsaW5lLndpZGdldHNbaV0uaGVpZ2h0OyB9XG4gICAgfSB9XG5cbiAgICBpZiAod3JhcHBpbmcpXG4gICAgICB7IHJldHVybiB3aWRnZXRzSGVpZ2h0ICsgKE1hdGguY2VpbChsaW5lLnRleHQubGVuZ3RoIC8gcGVyTGluZSkgfHwgMSkgKiB0aCB9XG4gICAgZWxzZVxuICAgICAgeyByZXR1cm4gd2lkZ2V0c0hlaWdodCArIHRoIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBlc3RpbWF0ZUxpbmVIZWlnaHRzKGNtKSB7XG4gIHZhciBkb2MgPSBjbS5kb2MsIGVzdCA9IGVzdGltYXRlSGVpZ2h0KGNtKTtcbiAgZG9jLml0ZXIoZnVuY3Rpb24gKGxpbmUpIHtcbiAgICB2YXIgZXN0SGVpZ2h0ID0gZXN0KGxpbmUpO1xuICAgIGlmIChlc3RIZWlnaHQgIT0gbGluZS5oZWlnaHQpIHsgdXBkYXRlTGluZUhlaWdodChsaW5lLCBlc3RIZWlnaHQpOyB9XG4gIH0pO1xufVxuXG4vLyBHaXZlbiBhIG1vdXNlIGV2ZW50LCBmaW5kIHRoZSBjb3JyZXNwb25kaW5nIHBvc2l0aW9uLiBJZiBsaWJlcmFsXG4vLyBpcyBmYWxzZSwgaXQgY2hlY2tzIHdoZXRoZXIgYSBndXR0ZXIgb3Igc2Nyb2xsYmFyIHdhcyBjbGlja2VkLFxuLy8gYW5kIHJldHVybnMgbnVsbCBpZiBpdCB3YXMuIGZvclJlY3QgaXMgdXNlZCBieSByZWN0YW5ndWxhclxuLy8gc2VsZWN0aW9ucywgYW5kIHRyaWVzIHRvIGVzdGltYXRlIGEgY2hhcmFjdGVyIHBvc2l0aW9uIGV2ZW4gZm9yXG4vLyBjb29yZGluYXRlcyBiZXlvbmQgdGhlIHJpZ2h0IG9mIHRoZSB0ZXh0LlxuZnVuY3Rpb24gcG9zRnJvbU1vdXNlKGNtLCBlLCBsaWJlcmFsLCBmb3JSZWN0KSB7XG4gIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheTtcbiAgaWYgKCFsaWJlcmFsICYmIGVfdGFyZ2V0KGUpLmdldEF0dHJpYnV0ZShcImNtLW5vdC1jb250ZW50XCIpID09IFwidHJ1ZVwiKSB7IHJldHVybiBudWxsIH1cblxuICB2YXIgeCwgeSwgc3BhY2UgPSBkaXNwbGF5LmxpbmVTcGFjZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgLy8gRmFpbHMgdW5wcmVkaWN0YWJseSBvbiBJRVs2N10gd2hlbiBtb3VzZSBpcyBkcmFnZ2VkIGFyb3VuZCBxdWlja2x5LlxuICB0cnkgeyB4ID0gZS5jbGllbnRYIC0gc3BhY2UubGVmdDsgeSA9IGUuY2xpZW50WSAtIHNwYWNlLnRvcDsgfVxuICBjYXRjaCAoZSkgeyByZXR1cm4gbnVsbCB9XG4gIHZhciBjb29yZHMgPSBjb29yZHNDaGFyKGNtLCB4LCB5KSwgbGluZTtcbiAgaWYgKGZvclJlY3QgJiYgY29vcmRzLnhSZWwgPT0gMSAmJiAobGluZSA9IGdldExpbmUoY20uZG9jLCBjb29yZHMubGluZSkudGV4dCkubGVuZ3RoID09IGNvb3Jkcy5jaCkge1xuICAgIHZhciBjb2xEaWZmID0gY291bnRDb2x1bW4obGluZSwgbGluZS5sZW5ndGgsIGNtLm9wdGlvbnMudGFiU2l6ZSkgLSBsaW5lLmxlbmd0aDtcbiAgICBjb29yZHMgPSBQb3MoY29vcmRzLmxpbmUsIE1hdGgubWF4KDAsIE1hdGgucm91bmQoKHggLSBwYWRkaW5nSChjbS5kaXNwbGF5KS5sZWZ0KSAvIGNoYXJXaWR0aChjbS5kaXNwbGF5KSkgLSBjb2xEaWZmKSk7XG4gIH1cbiAgcmV0dXJuIGNvb3Jkc1xufVxuXG4vLyBGaW5kIHRoZSB2aWV3IGVsZW1lbnQgY29ycmVzcG9uZGluZyB0byBhIGdpdmVuIGxpbmUuIFJldHVybiBudWxsXG4vLyB3aGVuIHRoZSBsaW5lIGlzbid0IHZpc2libGUuXG5mdW5jdGlvbiBmaW5kVmlld0luZGV4KGNtLCBuKSB7XG4gIGlmIChuID49IGNtLmRpc3BsYXkudmlld1RvKSB7IHJldHVybiBudWxsIH1cbiAgbiAtPSBjbS5kaXNwbGF5LnZpZXdGcm9tO1xuICBpZiAobiA8IDApIHsgcmV0dXJuIG51bGwgfVxuICB2YXIgdmlldyA9IGNtLmRpc3BsYXkudmlldztcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB2aWV3Lmxlbmd0aDsgaSsrKSB7XG4gICAgbiAtPSB2aWV3W2ldLnNpemU7XG4gICAgaWYgKG4gPCAwKSB7IHJldHVybiBpIH1cbiAgfVxufVxuXG5mdW5jdGlvbiB1cGRhdGVTZWxlY3Rpb24oY20pIHtcbiAgY20uZGlzcGxheS5pbnB1dC5zaG93U2VsZWN0aW9uKGNtLmRpc3BsYXkuaW5wdXQucHJlcGFyZVNlbGVjdGlvbigpKTtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZVNlbGVjdGlvbihjbSwgcHJpbWFyeSkge1xuICBpZiAoIHByaW1hcnkgPT09IHZvaWQgMCApIHByaW1hcnkgPSB0cnVlO1xuXG4gIHZhciBkb2MgPSBjbS5kb2MsIHJlc3VsdCA9IHt9O1xuICB2YXIgY3VyRnJhZ21lbnQgPSByZXN1bHQuY3Vyc29ycyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgdmFyIHNlbEZyYWdtZW50ID0gcmVzdWx0LnNlbGVjdGlvbiA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGRvYy5zZWwucmFuZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKCFwcmltYXJ5ICYmIGkgPT0gZG9jLnNlbC5wcmltSW5kZXgpIHsgY29udGludWUgfVxuICAgIHZhciByYW5nZSQkMSA9IGRvYy5zZWwucmFuZ2VzW2ldO1xuICAgIGlmIChyYW5nZSQkMS5mcm9tKCkubGluZSA+PSBjbS5kaXNwbGF5LnZpZXdUbyB8fCByYW5nZSQkMS50bygpLmxpbmUgPCBjbS5kaXNwbGF5LnZpZXdGcm9tKSB7IGNvbnRpbnVlIH1cbiAgICB2YXIgY29sbGFwc2VkID0gcmFuZ2UkJDEuZW1wdHkoKTtcbiAgICBpZiAoY29sbGFwc2VkIHx8IGNtLm9wdGlvbnMuc2hvd0N1cnNvcldoZW5TZWxlY3RpbmcpXG4gICAgICB7IGRyYXdTZWxlY3Rpb25DdXJzb3IoY20sIHJhbmdlJCQxLmhlYWQsIGN1ckZyYWdtZW50KTsgfVxuICAgIGlmICghY29sbGFwc2VkKVxuICAgICAgeyBkcmF3U2VsZWN0aW9uUmFuZ2UoY20sIHJhbmdlJCQxLCBzZWxGcmFnbWVudCk7IH1cbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG5cbi8vIERyYXdzIGEgY3Vyc29yIGZvciB0aGUgZ2l2ZW4gcmFuZ2VcbmZ1bmN0aW9uIGRyYXdTZWxlY3Rpb25DdXJzb3IoY20sIGhlYWQsIG91dHB1dCkge1xuICB2YXIgcG9zID0gY3Vyc29yQ29vcmRzKGNtLCBoZWFkLCBcImRpdlwiLCBudWxsLCBudWxsLCAhY20ub3B0aW9ucy5zaW5nbGVDdXJzb3JIZWlnaHRQZXJMaW5lKTtcblxuICB2YXIgY3Vyc29yID0gb3V0cHV0LmFwcGVuZENoaWxkKGVsdChcImRpdlwiLCBcIlxcdTAwYTBcIiwgXCJDb2RlTWlycm9yLWN1cnNvclwiKSk7XG4gIGN1cnNvci5zdHlsZS5sZWZ0ID0gcG9zLmxlZnQgKyBcInB4XCI7XG4gIGN1cnNvci5zdHlsZS50b3AgPSBwb3MudG9wICsgXCJweFwiO1xuICBjdXJzb3Iuc3R5bGUuaGVpZ2h0ID0gTWF0aC5tYXgoMCwgcG9zLmJvdHRvbSAtIHBvcy50b3ApICogY20ub3B0aW9ucy5jdXJzb3JIZWlnaHQgKyBcInB4XCI7XG5cbiAgaWYgKHBvcy5vdGhlcikge1xuICAgIC8vIFNlY29uZGFyeSBjdXJzb3IsIHNob3duIHdoZW4gb24gYSAnanVtcCcgaW4gYmktZGlyZWN0aW9uYWwgdGV4dFxuICAgIHZhciBvdGhlckN1cnNvciA9IG91dHB1dC5hcHBlbmRDaGlsZChlbHQoXCJkaXZcIiwgXCJcXHUwMGEwXCIsIFwiQ29kZU1pcnJvci1jdXJzb3IgQ29kZU1pcnJvci1zZWNvbmRhcnljdXJzb3JcIikpO1xuICAgIG90aGVyQ3Vyc29yLnN0eWxlLmRpc3BsYXkgPSBcIlwiO1xuICAgIG90aGVyQ3Vyc29yLnN0eWxlLmxlZnQgPSBwb3Mub3RoZXIubGVmdCArIFwicHhcIjtcbiAgICBvdGhlckN1cnNvci5zdHlsZS50b3AgPSBwb3Mub3RoZXIudG9wICsgXCJweFwiO1xuICAgIG90aGVyQ3Vyc29yLnN0eWxlLmhlaWdodCA9IChwb3Mub3RoZXIuYm90dG9tIC0gcG9zLm90aGVyLnRvcCkgKiAuODUgKyBcInB4XCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gY21wQ29vcmRzKGEsIGIpIHsgcmV0dXJuIGEudG9wIC0gYi50b3AgfHwgYS5sZWZ0IC0gYi5sZWZ0IH1cblxuLy8gRHJhd3MgdGhlIGdpdmVuIHJhbmdlIGFzIGEgaGlnaGxpZ2h0ZWQgc2VsZWN0aW9uXG5mdW5jdGlvbiBkcmF3U2VsZWN0aW9uUmFuZ2UoY20sIHJhbmdlJCQxLCBvdXRwdXQpIHtcbiAgdmFyIGRpc3BsYXkgPSBjbS5kaXNwbGF5LCBkb2MgPSBjbS5kb2M7XG4gIHZhciBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgdmFyIHBhZGRpbmcgPSBwYWRkaW5nSChjbS5kaXNwbGF5KSwgbGVmdFNpZGUgPSBwYWRkaW5nLmxlZnQ7XG4gIHZhciByaWdodFNpZGUgPSBNYXRoLm1heChkaXNwbGF5LnNpemVyV2lkdGgsIGRpc3BsYXlXaWR0aChjbSkgLSBkaXNwbGF5LnNpemVyLm9mZnNldExlZnQpIC0gcGFkZGluZy5yaWdodDtcbiAgdmFyIGRvY0xUUiA9IGRvYy5kaXJlY3Rpb24gPT0gXCJsdHJcIjtcblxuICBmdW5jdGlvbiBhZGQobGVmdCwgdG9wLCB3aWR0aCwgYm90dG9tKSB7XG4gICAgaWYgKHRvcCA8IDApIHsgdG9wID0gMDsgfVxuICAgIHRvcCA9IE1hdGgucm91bmQodG9wKTtcbiAgICBib3R0b20gPSBNYXRoLnJvdW5kKGJvdHRvbSk7XG4gICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoZWx0KFwiZGl2XCIsIG51bGwsIFwiQ29kZU1pcnJvci1zZWxlY3RlZFwiLCAoXCJwb3NpdGlvbjogYWJzb2x1dGU7IGxlZnQ6IFwiICsgbGVmdCArIFwicHg7XFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b3A6IFwiICsgdG9wICsgXCJweDsgd2lkdGg6IFwiICsgKHdpZHRoID09IG51bGwgPyByaWdodFNpZGUgLSBsZWZ0IDogd2lkdGgpICsgXCJweDtcXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogXCIgKyAoYm90dG9tIC0gdG9wKSArIFwicHhcIikpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRyYXdGb3JMaW5lKGxpbmUsIGZyb21BcmcsIHRvQXJnKSB7XG4gICAgdmFyIGxpbmVPYmogPSBnZXRMaW5lKGRvYywgbGluZSk7XG4gICAgdmFyIGxpbmVMZW4gPSBsaW5lT2JqLnRleHQubGVuZ3RoO1xuICAgIHZhciBzdGFydCwgZW5kO1xuICAgIGZ1bmN0aW9uIGNvb3JkcyhjaCwgYmlhcykge1xuICAgICAgcmV0dXJuIGNoYXJDb29yZHMoY20sIFBvcyhsaW5lLCBjaCksIFwiZGl2XCIsIGxpbmVPYmosIGJpYXMpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gd3JhcFgocG9zLCBkaXIsIHNpZGUpIHtcbiAgICAgIHZhciBleHRlbnQgPSB3cmFwcGVkTGluZUV4dGVudENoYXIoY20sIGxpbmVPYmosIG51bGwsIHBvcyk7XG4gICAgICB2YXIgcHJvcCA9IChkaXIgPT0gXCJsdHJcIikgPT0gKHNpZGUgPT0gXCJhZnRlclwiKSA/IFwibGVmdFwiIDogXCJyaWdodFwiO1xuICAgICAgdmFyIGNoID0gc2lkZSA9PSBcImFmdGVyXCIgPyBleHRlbnQuYmVnaW4gOiBleHRlbnQuZW5kIC0gKC9cXHMvLnRlc3QobGluZU9iai50ZXh0LmNoYXJBdChleHRlbnQuZW5kIC0gMSkpID8gMiA6IDEpO1xuICAgICAgcmV0dXJuIGNvb3JkcyhjaCwgcHJvcClbcHJvcF1cbiAgICB9XG5cbiAgICB2YXIgb3JkZXIgPSBnZXRPcmRlcihsaW5lT2JqLCBkb2MuZGlyZWN0aW9uKTtcbiAgICBpdGVyYXRlQmlkaVNlY3Rpb25zKG9yZGVyLCBmcm9tQXJnIHx8IDAsIHRvQXJnID09IG51bGwgPyBsaW5lTGVuIDogdG9BcmcsIGZ1bmN0aW9uIChmcm9tLCB0bywgZGlyLCBpKSB7XG4gICAgICB2YXIgbHRyID0gZGlyID09IFwibHRyXCI7XG4gICAgICB2YXIgZnJvbVBvcyA9IGNvb3Jkcyhmcm9tLCBsdHIgPyBcImxlZnRcIiA6IFwicmlnaHRcIik7XG4gICAgICB2YXIgdG9Qb3MgPSBjb29yZHModG8gLSAxLCBsdHIgPyBcInJpZ2h0XCIgOiBcImxlZnRcIik7XG5cbiAgICAgIHZhciBvcGVuU3RhcnQgPSBmcm9tQXJnID09IG51bGwgJiYgZnJvbSA9PSAwLCBvcGVuRW5kID0gdG9BcmcgPT0gbnVsbCAmJiB0byA9PSBsaW5lTGVuO1xuICAgICAgdmFyIGZpcnN0ID0gaSA9PSAwLCBsYXN0ID0gIW9yZGVyIHx8IGkgPT0gb3JkZXIubGVuZ3RoIC0gMTtcbiAgICAgIGlmICh0b1Bvcy50b3AgLSBmcm9tUG9zLnRvcCA8PSAzKSB7IC8vIFNpbmdsZSBsaW5lXG4gICAgICAgIHZhciBvcGVuTGVmdCA9IChkb2NMVFIgPyBvcGVuU3RhcnQgOiBvcGVuRW5kKSAmJiBmaXJzdDtcbiAgICAgICAgdmFyIG9wZW5SaWdodCA9IChkb2NMVFIgPyBvcGVuRW5kIDogb3BlblN0YXJ0KSAmJiBsYXN0O1xuICAgICAgICB2YXIgbGVmdCA9IG9wZW5MZWZ0ID8gbGVmdFNpZGUgOiAobHRyID8gZnJvbVBvcyA6IHRvUG9zKS5sZWZ0O1xuICAgICAgICB2YXIgcmlnaHQgPSBvcGVuUmlnaHQgPyByaWdodFNpZGUgOiAobHRyID8gdG9Qb3MgOiBmcm9tUG9zKS5yaWdodDtcbiAgICAgICAgYWRkKGxlZnQsIGZyb21Qb3MudG9wLCByaWdodCAtIGxlZnQsIGZyb21Qb3MuYm90dG9tKTtcbiAgICAgIH0gZWxzZSB7IC8vIE11bHRpcGxlIGxpbmVzXG4gICAgICAgIHZhciB0b3BMZWZ0LCB0b3BSaWdodCwgYm90TGVmdCwgYm90UmlnaHQ7XG4gICAgICAgIGlmIChsdHIpIHtcbiAgICAgICAgICB0b3BMZWZ0ID0gZG9jTFRSICYmIG9wZW5TdGFydCAmJiBmaXJzdCA/IGxlZnRTaWRlIDogZnJvbVBvcy5sZWZ0O1xuICAgICAgICAgIHRvcFJpZ2h0ID0gZG9jTFRSID8gcmlnaHRTaWRlIDogd3JhcFgoZnJvbSwgZGlyLCBcImJlZm9yZVwiKTtcbiAgICAgICAgICBib3RMZWZ0ID0gZG9jTFRSID8gbGVmdFNpZGUgOiB3cmFwWCh0bywgZGlyLCBcImFmdGVyXCIpO1xuICAgICAgICAgIGJvdFJpZ2h0ID0gZG9jTFRSICYmIG9wZW5FbmQgJiYgbGFzdCA/IHJpZ2h0U2lkZSA6IHRvUG9zLnJpZ2h0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRvcExlZnQgPSAhZG9jTFRSID8gbGVmdFNpZGUgOiB3cmFwWChmcm9tLCBkaXIsIFwiYmVmb3JlXCIpO1xuICAgICAgICAgIHRvcFJpZ2h0ID0gIWRvY0xUUiAmJiBvcGVuU3RhcnQgJiYgZmlyc3QgPyByaWdodFNpZGUgOiBmcm9tUG9zLnJpZ2h0O1xuICAgICAgICAgIGJvdExlZnQgPSAhZG9jTFRSICYmIG9wZW5FbmQgJiYgbGFzdCA/IGxlZnRTaWRlIDogdG9Qb3MubGVmdDtcbiAgICAgICAgICBib3RSaWdodCA9ICFkb2NMVFIgPyByaWdodFNpZGUgOiB3cmFwWCh0bywgZGlyLCBcImFmdGVyXCIpO1xuICAgICAgICB9XG4gICAgICAgIGFkZCh0b3BMZWZ0LCBmcm9tUG9zLnRvcCwgdG9wUmlnaHQgLSB0b3BMZWZ0LCBmcm9tUG9zLmJvdHRvbSk7XG4gICAgICAgIGlmIChmcm9tUG9zLmJvdHRvbSA8IHRvUG9zLnRvcCkgeyBhZGQobGVmdFNpZGUsIGZyb21Qb3MuYm90dG9tLCBudWxsLCB0b1Bvcy50b3ApOyB9XG4gICAgICAgIGFkZChib3RMZWZ0LCB0b1Bvcy50b3AsIGJvdFJpZ2h0IC0gYm90TGVmdCwgdG9Qb3MuYm90dG9tKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFzdGFydCB8fCBjbXBDb29yZHMoZnJvbVBvcywgc3RhcnQpIDwgMCkgeyBzdGFydCA9IGZyb21Qb3M7IH1cbiAgICAgIGlmIChjbXBDb29yZHModG9Qb3MsIHN0YXJ0KSA8IDApIHsgc3RhcnQgPSB0b1BvczsgfVxuICAgICAgaWYgKCFlbmQgfHwgY21wQ29vcmRzKGZyb21Qb3MsIGVuZCkgPCAwKSB7IGVuZCA9IGZyb21Qb3M7IH1cbiAgICAgIGlmIChjbXBDb29yZHModG9Qb3MsIGVuZCkgPCAwKSB7IGVuZCA9IHRvUG9zOyB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHtzdGFydDogc3RhcnQsIGVuZDogZW5kfVxuICB9XG5cbiAgdmFyIHNGcm9tID0gcmFuZ2UkJDEuZnJvbSgpLCBzVG8gPSByYW5nZSQkMS50bygpO1xuICBpZiAoc0Zyb20ubGluZSA9PSBzVG8ubGluZSkge1xuICAgIGRyYXdGb3JMaW5lKHNGcm9tLmxpbmUsIHNGcm9tLmNoLCBzVG8uY2gpO1xuICB9IGVsc2Uge1xuICAgIHZhciBmcm9tTGluZSA9IGdldExpbmUoZG9jLCBzRnJvbS5saW5lKSwgdG9MaW5lID0gZ2V0TGluZShkb2MsIHNUby5saW5lKTtcbiAgICB2YXIgc2luZ2xlVkxpbmUgPSB2aXN1YWxMaW5lKGZyb21MaW5lKSA9PSB2aXN1YWxMaW5lKHRvTGluZSk7XG4gICAgdmFyIGxlZnRFbmQgPSBkcmF3Rm9yTGluZShzRnJvbS5saW5lLCBzRnJvbS5jaCwgc2luZ2xlVkxpbmUgPyBmcm9tTGluZS50ZXh0Lmxlbmd0aCArIDEgOiBudWxsKS5lbmQ7XG4gICAgdmFyIHJpZ2h0U3RhcnQgPSBkcmF3Rm9yTGluZShzVG8ubGluZSwgc2luZ2xlVkxpbmUgPyAwIDogbnVsbCwgc1RvLmNoKS5zdGFydDtcbiAgICBpZiAoc2luZ2xlVkxpbmUpIHtcbiAgICAgIGlmIChsZWZ0RW5kLnRvcCA8IHJpZ2h0U3RhcnQudG9wIC0gMikge1xuICAgICAgICBhZGQobGVmdEVuZC5yaWdodCwgbGVmdEVuZC50b3AsIG51bGwsIGxlZnRFbmQuYm90dG9tKTtcbiAgICAgICAgYWRkKGxlZnRTaWRlLCByaWdodFN0YXJ0LnRvcCwgcmlnaHRTdGFydC5sZWZ0LCByaWdodFN0YXJ0LmJvdHRvbSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGQobGVmdEVuZC5yaWdodCwgbGVmdEVuZC50b3AsIHJpZ2h0U3RhcnQubGVmdCAtIGxlZnRFbmQucmlnaHQsIGxlZnRFbmQuYm90dG9tKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGxlZnRFbmQuYm90dG9tIDwgcmlnaHRTdGFydC50b3ApXG4gICAgICB7IGFkZChsZWZ0U2lkZSwgbGVmdEVuZC5ib3R0b20sIG51bGwsIHJpZ2h0U3RhcnQudG9wKTsgfVxuICB9XG5cbiAgb3V0cHV0LmFwcGVuZENoaWxkKGZyYWdtZW50KTtcbn1cblxuLy8gQ3Vyc29yLWJsaW5raW5nXG5mdW5jdGlvbiByZXN0YXJ0QmxpbmsoY20pIHtcbiAgaWYgKCFjbS5zdGF0ZS5mb2N1c2VkKSB7IHJldHVybiB9XG4gIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheTtcbiAgY2xlYXJJbnRlcnZhbChkaXNwbGF5LmJsaW5rZXIpO1xuICB2YXIgb24gPSB0cnVlO1xuICBkaXNwbGF5LmN1cnNvckRpdi5zdHlsZS52aXNpYmlsaXR5ID0gXCJcIjtcbiAgaWYgKGNtLm9wdGlvbnMuY3Vyc29yQmxpbmtSYXRlID4gMClcbiAgICB7IGRpc3BsYXkuYmxpbmtlciA9IHNldEludGVydmFsKGZ1bmN0aW9uICgpIHsgcmV0dXJuIGRpc3BsYXkuY3Vyc29yRGl2LnN0eWxlLnZpc2liaWxpdHkgPSAob24gPSAhb24pID8gXCJcIiA6IFwiaGlkZGVuXCI7IH0sXG4gICAgICBjbS5vcHRpb25zLmN1cnNvckJsaW5rUmF0ZSk7IH1cbiAgZWxzZSBpZiAoY20ub3B0aW9ucy5jdXJzb3JCbGlua1JhdGUgPCAwKVxuICAgIHsgZGlzcGxheS5jdXJzb3JEaXYuc3R5bGUudmlzaWJpbGl0eSA9IFwiaGlkZGVuXCI7IH1cbn1cblxuZnVuY3Rpb24gZW5zdXJlRm9jdXMoY20pIHtcbiAgaWYgKCFjbS5zdGF0ZS5mb2N1c2VkKSB7IGNtLmRpc3BsYXkuaW5wdXQuZm9jdXMoKTsgb25Gb2N1cyhjbSk7IH1cbn1cblxuZnVuY3Rpb24gZGVsYXlCbHVyRXZlbnQoY20pIHtcbiAgY20uc3RhdGUuZGVsYXlpbmdCbHVyRXZlbnQgPSB0cnVlO1xuICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHsgaWYgKGNtLnN0YXRlLmRlbGF5aW5nQmx1ckV2ZW50KSB7XG4gICAgY20uc3RhdGUuZGVsYXlpbmdCbHVyRXZlbnQgPSBmYWxzZTtcbiAgICBvbkJsdXIoY20pO1xuICB9IH0sIDEwMCk7XG59XG5cbmZ1bmN0aW9uIG9uRm9jdXMoY20sIGUpIHtcbiAgaWYgKGNtLnN0YXRlLmRlbGF5aW5nQmx1ckV2ZW50KSB7IGNtLnN0YXRlLmRlbGF5aW5nQmx1ckV2ZW50ID0gZmFsc2U7IH1cblxuICBpZiAoY20ub3B0aW9ucy5yZWFkT25seSA9PSBcIm5vY3Vyc29yXCIpIHsgcmV0dXJuIH1cbiAgaWYgKCFjbS5zdGF0ZS5mb2N1c2VkKSB7XG4gICAgc2lnbmFsKGNtLCBcImZvY3VzXCIsIGNtLCBlKTtcbiAgICBjbS5zdGF0ZS5mb2N1c2VkID0gdHJ1ZTtcbiAgICBhZGRDbGFzcyhjbS5kaXNwbGF5LndyYXBwZXIsIFwiQ29kZU1pcnJvci1mb2N1c2VkXCIpO1xuICAgIC8vIFRoaXMgdGVzdCBwcmV2ZW50cyB0aGlzIGZyb20gZmlyaW5nIHdoZW4gYSBjb250ZXh0XG4gICAgLy8gbWVudSBpcyBjbG9zZWQgKHNpbmNlIHRoZSBpbnB1dCByZXNldCB3b3VsZCBraWxsIHRoZVxuICAgIC8vIHNlbGVjdC1hbGwgZGV0ZWN0aW9uIGhhY2spXG4gICAgaWYgKCFjbS5jdXJPcCAmJiBjbS5kaXNwbGF5LnNlbEZvckNvbnRleHRNZW51ICE9IGNtLmRvYy5zZWwpIHtcbiAgICAgIGNtLmRpc3BsYXkuaW5wdXQucmVzZXQoKTtcbiAgICAgIGlmICh3ZWJraXQpIHsgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7IHJldHVybiBjbS5kaXNwbGF5LmlucHV0LnJlc2V0KHRydWUpOyB9LCAyMCk7IH0gLy8gSXNzdWUgIzE3MzBcbiAgICB9XG4gICAgY20uZGlzcGxheS5pbnB1dC5yZWNlaXZlZEZvY3VzKCk7XG4gIH1cbiAgcmVzdGFydEJsaW5rKGNtKTtcbn1cbmZ1bmN0aW9uIG9uQmx1cihjbSwgZSkge1xuICBpZiAoY20uc3RhdGUuZGVsYXlpbmdCbHVyRXZlbnQpIHsgcmV0dXJuIH1cblxuICBpZiAoY20uc3RhdGUuZm9jdXNlZCkge1xuICAgIHNpZ25hbChjbSwgXCJibHVyXCIsIGNtLCBlKTtcbiAgICBjbS5zdGF0ZS5mb2N1c2VkID0gZmFsc2U7XG4gICAgcm1DbGFzcyhjbS5kaXNwbGF5LndyYXBwZXIsIFwiQ29kZU1pcnJvci1mb2N1c2VkXCIpO1xuICB9XG4gIGNsZWFySW50ZXJ2YWwoY20uZGlzcGxheS5ibGlua2VyKTtcbiAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7IGlmICghY20uc3RhdGUuZm9jdXNlZCkgeyBjbS5kaXNwbGF5LnNoaWZ0ID0gZmFsc2U7IH0gfSwgMTUwKTtcbn1cblxuLy8gUmVhZCB0aGUgYWN0dWFsIGhlaWdodHMgb2YgdGhlIHJlbmRlcmVkIGxpbmVzLCBhbmQgdXBkYXRlIHRoZWlyXG4vLyBzdG9yZWQgaGVpZ2h0cyB0byBtYXRjaC5cbmZ1bmN0aW9uIHVwZGF0ZUhlaWdodHNJblZpZXdwb3J0KGNtKSB7XG4gIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheTtcbiAgdmFyIHByZXZCb3R0b20gPSBkaXNwbGF5LmxpbmVEaXYub2Zmc2V0VG9wO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGRpc3BsYXkudmlldy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBjdXIgPSBkaXNwbGF5LnZpZXdbaV0sIGhlaWdodCA9ICh2b2lkIDApO1xuICAgIGlmIChjdXIuaGlkZGVuKSB7IGNvbnRpbnVlIH1cbiAgICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA8IDgpIHtcbiAgICAgIHZhciBib3QgPSBjdXIubm9kZS5vZmZzZXRUb3AgKyBjdXIubm9kZS5vZmZzZXRIZWlnaHQ7XG4gICAgICBoZWlnaHQgPSBib3QgLSBwcmV2Qm90dG9tO1xuICAgICAgcHJldkJvdHRvbSA9IGJvdDtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJveCA9IGN1ci5ub2RlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgaGVpZ2h0ID0gYm94LmJvdHRvbSAtIGJveC50b3A7XG4gICAgfVxuICAgIHZhciBkaWZmID0gY3VyLmxpbmUuaGVpZ2h0IC0gaGVpZ2h0O1xuICAgIGlmIChoZWlnaHQgPCAyKSB7IGhlaWdodCA9IHRleHRIZWlnaHQoZGlzcGxheSk7IH1cbiAgICBpZiAoZGlmZiA+IC4wMDUgfHwgZGlmZiA8IC0uMDA1KSB7XG4gICAgICB1cGRhdGVMaW5lSGVpZ2h0KGN1ci5saW5lLCBoZWlnaHQpO1xuICAgICAgdXBkYXRlV2lkZ2V0SGVpZ2h0KGN1ci5saW5lKTtcbiAgICAgIGlmIChjdXIucmVzdCkgeyBmb3IgKHZhciBqID0gMDsgaiA8IGN1ci5yZXN0Lmxlbmd0aDsgaisrKVxuICAgICAgICB7IHVwZGF0ZVdpZGdldEhlaWdodChjdXIucmVzdFtqXSk7IH0gfVxuICAgIH1cbiAgfVxufVxuXG4vLyBSZWFkIGFuZCBzdG9yZSB0aGUgaGVpZ2h0IG9mIGxpbmUgd2lkZ2V0cyBhc3NvY2lhdGVkIHdpdGggdGhlXG4vLyBnaXZlbiBsaW5lLlxuZnVuY3Rpb24gdXBkYXRlV2lkZ2V0SGVpZ2h0KGxpbmUpIHtcbiAgaWYgKGxpbmUud2lkZ2V0cykgeyBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmUud2lkZ2V0cy5sZW5ndGg7ICsraSkge1xuICAgIHZhciB3ID0gbGluZS53aWRnZXRzW2ldLCBwYXJlbnQgPSB3Lm5vZGUucGFyZW50Tm9kZTtcbiAgICBpZiAocGFyZW50KSB7IHcuaGVpZ2h0ID0gcGFyZW50Lm9mZnNldEhlaWdodDsgfVxuICB9IH1cbn1cblxuLy8gQ29tcHV0ZSB0aGUgbGluZXMgdGhhdCBhcmUgdmlzaWJsZSBpbiBhIGdpdmVuIHZpZXdwb3J0IChkZWZhdWx0c1xuLy8gdGhlIHRoZSBjdXJyZW50IHNjcm9sbCBwb3NpdGlvbikuIHZpZXdwb3J0IG1heSBjb250YWluIHRvcCxcbi8vIGhlaWdodCwgYW5kIGVuc3VyZSAoc2VlIG9wLnNjcm9sbFRvUG9zKSBwcm9wZXJ0aWVzLlxuZnVuY3Rpb24gdmlzaWJsZUxpbmVzKGRpc3BsYXksIGRvYywgdmlld3BvcnQpIHtcbiAgdmFyIHRvcCA9IHZpZXdwb3J0ICYmIHZpZXdwb3J0LnRvcCAhPSBudWxsID8gTWF0aC5tYXgoMCwgdmlld3BvcnQudG9wKSA6IGRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsVG9wO1xuICB0b3AgPSBNYXRoLmZsb29yKHRvcCAtIHBhZGRpbmdUb3AoZGlzcGxheSkpO1xuICB2YXIgYm90dG9tID0gdmlld3BvcnQgJiYgdmlld3BvcnQuYm90dG9tICE9IG51bGwgPyB2aWV3cG9ydC5ib3R0b20gOiB0b3AgKyBkaXNwbGF5LndyYXBwZXIuY2xpZW50SGVpZ2h0O1xuXG4gIHZhciBmcm9tID0gbGluZUF0SGVpZ2h0KGRvYywgdG9wKSwgdG8gPSBsaW5lQXRIZWlnaHQoZG9jLCBib3R0b20pO1xuICAvLyBFbnN1cmUgaXMgYSB7ZnJvbToge2xpbmUsIGNofSwgdG86IHtsaW5lLCBjaH19IG9iamVjdCwgYW5kXG4gIC8vIGZvcmNlcyB0aG9zZSBsaW5lcyBpbnRvIHRoZSB2aWV3cG9ydCAoaWYgcG9zc2libGUpLlxuICBpZiAodmlld3BvcnQgJiYgdmlld3BvcnQuZW5zdXJlKSB7XG4gICAgdmFyIGVuc3VyZUZyb20gPSB2aWV3cG9ydC5lbnN1cmUuZnJvbS5saW5lLCBlbnN1cmVUbyA9IHZpZXdwb3J0LmVuc3VyZS50by5saW5lO1xuICAgIGlmIChlbnN1cmVGcm9tIDwgZnJvbSkge1xuICAgICAgZnJvbSA9IGVuc3VyZUZyb207XG4gICAgICB0byA9IGxpbmVBdEhlaWdodChkb2MsIGhlaWdodEF0TGluZShnZXRMaW5lKGRvYywgZW5zdXJlRnJvbSkpICsgZGlzcGxheS53cmFwcGVyLmNsaWVudEhlaWdodCk7XG4gICAgfSBlbHNlIGlmIChNYXRoLm1pbihlbnN1cmVUbywgZG9jLmxhc3RMaW5lKCkpID49IHRvKSB7XG4gICAgICBmcm9tID0gbGluZUF0SGVpZ2h0KGRvYywgaGVpZ2h0QXRMaW5lKGdldExpbmUoZG9jLCBlbnN1cmVUbykpIC0gZGlzcGxheS53cmFwcGVyLmNsaWVudEhlaWdodCk7XG4gICAgICB0byA9IGVuc3VyZVRvO1xuICAgIH1cbiAgfVxuICByZXR1cm4ge2Zyb206IGZyb20sIHRvOiBNYXRoLm1heCh0bywgZnJvbSArIDEpfVxufVxuXG4vLyBSZS1hbGlnbiBsaW5lIG51bWJlcnMgYW5kIGd1dHRlciBtYXJrcyB0byBjb21wZW5zYXRlIGZvclxuLy8gaG9yaXpvbnRhbCBzY3JvbGxpbmcuXG5mdW5jdGlvbiBhbGlnbkhvcml6b250YWxseShjbSkge1xuICB2YXIgZGlzcGxheSA9IGNtLmRpc3BsYXksIHZpZXcgPSBkaXNwbGF5LnZpZXc7XG4gIGlmICghZGlzcGxheS5hbGlnbldpZGdldHMgJiYgKCFkaXNwbGF5Lmd1dHRlcnMuZmlyc3RDaGlsZCB8fCAhY20ub3B0aW9ucy5maXhlZEd1dHRlcikpIHsgcmV0dXJuIH1cbiAgdmFyIGNvbXAgPSBjb21wZW5zYXRlRm9ySFNjcm9sbChkaXNwbGF5KSAtIGRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsTGVmdCArIGNtLmRvYy5zY3JvbGxMZWZ0O1xuICB2YXIgZ3V0dGVyVyA9IGRpc3BsYXkuZ3V0dGVycy5vZmZzZXRXaWR0aCwgbGVmdCA9IGNvbXAgKyBcInB4XCI7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdmlldy5sZW5ndGg7IGkrKykgeyBpZiAoIXZpZXdbaV0uaGlkZGVuKSB7XG4gICAgaWYgKGNtLm9wdGlvbnMuZml4ZWRHdXR0ZXIpIHtcbiAgICAgIGlmICh2aWV3W2ldLmd1dHRlcilcbiAgICAgICAgeyB2aWV3W2ldLmd1dHRlci5zdHlsZS5sZWZ0ID0gbGVmdDsgfVxuICAgICAgaWYgKHZpZXdbaV0uZ3V0dGVyQmFja2dyb3VuZClcbiAgICAgICAgeyB2aWV3W2ldLmd1dHRlckJhY2tncm91bmQuc3R5bGUubGVmdCA9IGxlZnQ7IH1cbiAgICB9XG4gICAgdmFyIGFsaWduID0gdmlld1tpXS5hbGlnbmFibGU7XG4gICAgaWYgKGFsaWduKSB7IGZvciAodmFyIGogPSAwOyBqIDwgYWxpZ24ubGVuZ3RoOyBqKyspXG4gICAgICB7IGFsaWduW2pdLnN0eWxlLmxlZnQgPSBsZWZ0OyB9IH1cbiAgfSB9XG4gIGlmIChjbS5vcHRpb25zLmZpeGVkR3V0dGVyKVxuICAgIHsgZGlzcGxheS5ndXR0ZXJzLnN0eWxlLmxlZnQgPSAoY29tcCArIGd1dHRlclcpICsgXCJweFwiOyB9XG59XG5cbi8vIFVzZWQgdG8gZW5zdXJlIHRoYXQgdGhlIGxpbmUgbnVtYmVyIGd1dHRlciBpcyBzdGlsbCB0aGUgcmlnaHRcbi8vIHNpemUgZm9yIHRoZSBjdXJyZW50IGRvY3VtZW50IHNpemUuIFJldHVybnMgdHJ1ZSB3aGVuIGFuIHVwZGF0ZVxuLy8gaXMgbmVlZGVkLlxuZnVuY3Rpb24gbWF5YmVVcGRhdGVMaW5lTnVtYmVyV2lkdGgoY20pIHtcbiAgaWYgKCFjbS5vcHRpb25zLmxpbmVOdW1iZXJzKSB7IHJldHVybiBmYWxzZSB9XG4gIHZhciBkb2MgPSBjbS5kb2MsIGxhc3QgPSBsaW5lTnVtYmVyRm9yKGNtLm9wdGlvbnMsIGRvYy5maXJzdCArIGRvYy5zaXplIC0gMSksIGRpc3BsYXkgPSBjbS5kaXNwbGF5O1xuICBpZiAobGFzdC5sZW5ndGggIT0gZGlzcGxheS5saW5lTnVtQ2hhcnMpIHtcbiAgICB2YXIgdGVzdCA9IGRpc3BsYXkubWVhc3VyZS5hcHBlbmRDaGlsZChlbHQoXCJkaXZcIiwgW2VsdChcImRpdlwiLCBsYXN0KV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiQ29kZU1pcnJvci1saW5lbnVtYmVyIENvZGVNaXJyb3ItZ3V0dGVyLWVsdFwiKSk7XG4gICAgdmFyIGlubmVyVyA9IHRlc3QuZmlyc3RDaGlsZC5vZmZzZXRXaWR0aCwgcGFkZGluZyA9IHRlc3Qub2Zmc2V0V2lkdGggLSBpbm5lclc7XG4gICAgZGlzcGxheS5saW5lR3V0dGVyLnN0eWxlLndpZHRoID0gXCJcIjtcbiAgICBkaXNwbGF5LmxpbmVOdW1Jbm5lcldpZHRoID0gTWF0aC5tYXgoaW5uZXJXLCBkaXNwbGF5LmxpbmVHdXR0ZXIub2Zmc2V0V2lkdGggLSBwYWRkaW5nKSArIDE7XG4gICAgZGlzcGxheS5saW5lTnVtV2lkdGggPSBkaXNwbGF5LmxpbmVOdW1Jbm5lcldpZHRoICsgcGFkZGluZztcbiAgICBkaXNwbGF5LmxpbmVOdW1DaGFycyA9IGRpc3BsYXkubGluZU51bUlubmVyV2lkdGggPyBsYXN0Lmxlbmd0aCA6IC0xO1xuICAgIGRpc3BsYXkubGluZUd1dHRlci5zdHlsZS53aWR0aCA9IGRpc3BsYXkubGluZU51bVdpZHRoICsgXCJweFwiO1xuICAgIHVwZGF0ZUd1dHRlclNwYWNlKGNtKTtcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG4gIHJldHVybiBmYWxzZVxufVxuXG4vLyBTQ1JPTExJTkcgVEhJTkdTIElOVE8gVklFV1xuXG4vLyBJZiBhbiBlZGl0b3Igc2l0cyBvbiB0aGUgdG9wIG9yIGJvdHRvbSBvZiB0aGUgd2luZG93LCBwYXJ0aWFsbHlcbi8vIHNjcm9sbGVkIG91dCBvZiB2aWV3LCB0aGlzIGVuc3VyZXMgdGhhdCB0aGUgY3Vyc29yIGlzIHZpc2libGUuXG5mdW5jdGlvbiBtYXliZVNjcm9sbFdpbmRvdyhjbSwgcmVjdCkge1xuICBpZiAoc2lnbmFsRE9NRXZlbnQoY20sIFwic2Nyb2xsQ3Vyc29ySW50b1ZpZXdcIikpIHsgcmV0dXJuIH1cblxuICB2YXIgZGlzcGxheSA9IGNtLmRpc3BsYXksIGJveCA9IGRpc3BsYXkuc2l6ZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksIGRvU2Nyb2xsID0gbnVsbDtcbiAgaWYgKHJlY3QudG9wICsgYm94LnRvcCA8IDApIHsgZG9TY3JvbGwgPSB0cnVlOyB9XG4gIGVsc2UgaWYgKHJlY3QuYm90dG9tICsgYm94LnRvcCA+ICh3aW5kb3cuaW5uZXJIZWlnaHQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodCkpIHsgZG9TY3JvbGwgPSBmYWxzZTsgfVxuICBpZiAoZG9TY3JvbGwgIT0gbnVsbCAmJiAhcGhhbnRvbSkge1xuICAgIHZhciBzY3JvbGxOb2RlID0gZWx0KFwiZGl2XCIsIFwiXFx1MjAwYlwiLCBudWxsLCAoXCJwb3NpdGlvbjogYWJzb2x1dGU7XFxuICAgICAgICAgICAgICAgICAgICAgICAgIHRvcDogXCIgKyAocmVjdC50b3AgLSBkaXNwbGF5LnZpZXdPZmZzZXQgLSBwYWRkaW5nVG9wKGNtLmRpc3BsYXkpKSArIFwicHg7XFxuICAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogXCIgKyAocmVjdC5ib3R0b20gLSByZWN0LnRvcCArIHNjcm9sbEdhcChjbSkgKyBkaXNwbGF5LmJhckhlaWdodCkgKyBcInB4O1xcbiAgICAgICAgICAgICAgICAgICAgICAgICBsZWZ0OiBcIiArIChyZWN0LmxlZnQpICsgXCJweDsgd2lkdGg6IFwiICsgKE1hdGgubWF4KDIsIHJlY3QucmlnaHQgLSByZWN0LmxlZnQpKSArIFwicHg7XCIpKTtcbiAgICBjbS5kaXNwbGF5LmxpbmVTcGFjZS5hcHBlbmRDaGlsZChzY3JvbGxOb2RlKTtcbiAgICBzY3JvbGxOb2RlLnNjcm9sbEludG9WaWV3KGRvU2Nyb2xsKTtcbiAgICBjbS5kaXNwbGF5LmxpbmVTcGFjZS5yZW1vdmVDaGlsZChzY3JvbGxOb2RlKTtcbiAgfVxufVxuXG4vLyBTY3JvbGwgYSBnaXZlbiBwb3NpdGlvbiBpbnRvIHZpZXcgKGltbWVkaWF0ZWx5KSwgdmVyaWZ5aW5nIHRoYXRcbi8vIGl0IGFjdHVhbGx5IGJlY2FtZSB2aXNpYmxlIChhcyBsaW5lIGhlaWdodHMgYXJlIGFjY3VyYXRlbHlcbi8vIG1lYXN1cmVkLCB0aGUgcG9zaXRpb24gb2Ygc29tZXRoaW5nIG1heSAnZHJpZnQnIGR1cmluZyBkcmF3aW5nKS5cbmZ1bmN0aW9uIHNjcm9sbFBvc0ludG9WaWV3KGNtLCBwb3MsIGVuZCwgbWFyZ2luKSB7XG4gIGlmIChtYXJnaW4gPT0gbnVsbCkgeyBtYXJnaW4gPSAwOyB9XG4gIHZhciByZWN0O1xuICBpZiAoIWNtLm9wdGlvbnMubGluZVdyYXBwaW5nICYmIHBvcyA9PSBlbmQpIHtcbiAgICAvLyBTZXQgcG9zIGFuZCBlbmQgdG8gdGhlIGN1cnNvciBwb3NpdGlvbnMgYXJvdW5kIHRoZSBjaGFyYWN0ZXIgcG9zIHN0aWNrcyB0b1xuICAgIC8vIElmIHBvcy5zdGlja3kgPT0gXCJiZWZvcmVcIiwgdGhhdCBpcyBhcm91bmQgcG9zLmNoIC0gMSwgb3RoZXJ3aXNlIGFyb3VuZCBwb3MuY2hcbiAgICAvLyBJZiBwb3MgPT0gUG9zKF8sIDAsIFwiYmVmb3JlXCIpLCBwb3MgYW5kIGVuZCBhcmUgdW5jaGFuZ2VkXG4gICAgcG9zID0gcG9zLmNoID8gUG9zKHBvcy5saW5lLCBwb3Muc3RpY2t5ID09IFwiYmVmb3JlXCIgPyBwb3MuY2ggLSAxIDogcG9zLmNoLCBcImFmdGVyXCIpIDogcG9zO1xuICAgIGVuZCA9IHBvcy5zdGlja3kgPT0gXCJiZWZvcmVcIiA/IFBvcyhwb3MubGluZSwgcG9zLmNoICsgMSwgXCJiZWZvcmVcIikgOiBwb3M7XG4gIH1cbiAgZm9yICh2YXIgbGltaXQgPSAwOyBsaW1pdCA8IDU7IGxpbWl0KyspIHtcbiAgICB2YXIgY2hhbmdlZCA9IGZhbHNlO1xuICAgIHZhciBjb29yZHMgPSBjdXJzb3JDb29yZHMoY20sIHBvcyk7XG4gICAgdmFyIGVuZENvb3JkcyA9ICFlbmQgfHwgZW5kID09IHBvcyA/IGNvb3JkcyA6IGN1cnNvckNvb3JkcyhjbSwgZW5kKTtcbiAgICByZWN0ID0ge2xlZnQ6IE1hdGgubWluKGNvb3Jkcy5sZWZ0LCBlbmRDb29yZHMubGVmdCksXG4gICAgICAgICAgICB0b3A6IE1hdGgubWluKGNvb3Jkcy50b3AsIGVuZENvb3Jkcy50b3ApIC0gbWFyZ2luLFxuICAgICAgICAgICAgcmlnaHQ6IE1hdGgubWF4KGNvb3Jkcy5sZWZ0LCBlbmRDb29yZHMubGVmdCksXG4gICAgICAgICAgICBib3R0b206IE1hdGgubWF4KGNvb3Jkcy5ib3R0b20sIGVuZENvb3Jkcy5ib3R0b20pICsgbWFyZ2lufTtcbiAgICB2YXIgc2Nyb2xsUG9zID0gY2FsY3VsYXRlU2Nyb2xsUG9zKGNtLCByZWN0KTtcbiAgICB2YXIgc3RhcnRUb3AgPSBjbS5kb2Muc2Nyb2xsVG9wLCBzdGFydExlZnQgPSBjbS5kb2Muc2Nyb2xsTGVmdDtcbiAgICBpZiAoc2Nyb2xsUG9zLnNjcm9sbFRvcCAhPSBudWxsKSB7XG4gICAgICB1cGRhdGVTY3JvbGxUb3AoY20sIHNjcm9sbFBvcy5zY3JvbGxUb3ApO1xuICAgICAgaWYgKE1hdGguYWJzKGNtLmRvYy5zY3JvbGxUb3AgLSBzdGFydFRvcCkgPiAxKSB7IGNoYW5nZWQgPSB0cnVlOyB9XG4gICAgfVxuICAgIGlmIChzY3JvbGxQb3Muc2Nyb2xsTGVmdCAhPSBudWxsKSB7XG4gICAgICBzZXRTY3JvbGxMZWZ0KGNtLCBzY3JvbGxQb3Muc2Nyb2xsTGVmdCk7XG4gICAgICBpZiAoTWF0aC5hYnMoY20uZG9jLnNjcm9sbExlZnQgLSBzdGFydExlZnQpID4gMSkgeyBjaGFuZ2VkID0gdHJ1ZTsgfVxuICAgIH1cbiAgICBpZiAoIWNoYW5nZWQpIHsgYnJlYWsgfVxuICB9XG4gIHJldHVybiByZWN0XG59XG5cbi8vIFNjcm9sbCBhIGdpdmVuIHNldCBvZiBjb29yZGluYXRlcyBpbnRvIHZpZXcgKGltbWVkaWF0ZWx5KS5cbmZ1bmN0aW9uIHNjcm9sbEludG9WaWV3KGNtLCByZWN0KSB7XG4gIHZhciBzY3JvbGxQb3MgPSBjYWxjdWxhdGVTY3JvbGxQb3MoY20sIHJlY3QpO1xuICBpZiAoc2Nyb2xsUG9zLnNjcm9sbFRvcCAhPSBudWxsKSB7IHVwZGF0ZVNjcm9sbFRvcChjbSwgc2Nyb2xsUG9zLnNjcm9sbFRvcCk7IH1cbiAgaWYgKHNjcm9sbFBvcy5zY3JvbGxMZWZ0ICE9IG51bGwpIHsgc2V0U2Nyb2xsTGVmdChjbSwgc2Nyb2xsUG9zLnNjcm9sbExlZnQpOyB9XG59XG5cbi8vIENhbGN1bGF0ZSBhIG5ldyBzY3JvbGwgcG9zaXRpb24gbmVlZGVkIHRvIHNjcm9sbCB0aGUgZ2l2ZW5cbi8vIHJlY3RhbmdsZSBpbnRvIHZpZXcuIFJldHVybnMgYW4gb2JqZWN0IHdpdGggc2Nyb2xsVG9wIGFuZFxuLy8gc2Nyb2xsTGVmdCBwcm9wZXJ0aWVzLiBXaGVuIHRoZXNlIGFyZSB1bmRlZmluZWQsIHRoZVxuLy8gdmVydGljYWwvaG9yaXpvbnRhbCBwb3NpdGlvbiBkb2VzIG5vdCBuZWVkIHRvIGJlIGFkanVzdGVkLlxuZnVuY3Rpb24gY2FsY3VsYXRlU2Nyb2xsUG9zKGNtLCByZWN0KSB7XG4gIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheSwgc25hcE1hcmdpbiA9IHRleHRIZWlnaHQoY20uZGlzcGxheSk7XG4gIGlmIChyZWN0LnRvcCA8IDApIHsgcmVjdC50b3AgPSAwOyB9XG4gIHZhciBzY3JlZW50b3AgPSBjbS5jdXJPcCAmJiBjbS5jdXJPcC5zY3JvbGxUb3AgIT0gbnVsbCA/IGNtLmN1ck9wLnNjcm9sbFRvcCA6IGRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsVG9wO1xuICB2YXIgc2NyZWVuID0gZGlzcGxheUhlaWdodChjbSksIHJlc3VsdCA9IHt9O1xuICBpZiAocmVjdC5ib3R0b20gLSByZWN0LnRvcCA+IHNjcmVlbikgeyByZWN0LmJvdHRvbSA9IHJlY3QudG9wICsgc2NyZWVuOyB9XG4gIHZhciBkb2NCb3R0b20gPSBjbS5kb2MuaGVpZ2h0ICsgcGFkZGluZ1ZlcnQoZGlzcGxheSk7XG4gIHZhciBhdFRvcCA9IHJlY3QudG9wIDwgc25hcE1hcmdpbiwgYXRCb3R0b20gPSByZWN0LmJvdHRvbSA+IGRvY0JvdHRvbSAtIHNuYXBNYXJnaW47XG4gIGlmIChyZWN0LnRvcCA8IHNjcmVlbnRvcCkge1xuICAgIHJlc3VsdC5zY3JvbGxUb3AgPSBhdFRvcCA/IDAgOiByZWN0LnRvcDtcbiAgfSBlbHNlIGlmIChyZWN0LmJvdHRvbSA+IHNjcmVlbnRvcCArIHNjcmVlbikge1xuICAgIHZhciBuZXdUb3AgPSBNYXRoLm1pbihyZWN0LnRvcCwgKGF0Qm90dG9tID8gZG9jQm90dG9tIDogcmVjdC5ib3R0b20pIC0gc2NyZWVuKTtcbiAgICBpZiAobmV3VG9wICE9IHNjcmVlbnRvcCkgeyByZXN1bHQuc2Nyb2xsVG9wID0gbmV3VG9wOyB9XG4gIH1cblxuICB2YXIgc2NyZWVubGVmdCA9IGNtLmN1ck9wICYmIGNtLmN1ck9wLnNjcm9sbExlZnQgIT0gbnVsbCA/IGNtLmN1ck9wLnNjcm9sbExlZnQgOiBkaXNwbGF5LnNjcm9sbGVyLnNjcm9sbExlZnQ7XG4gIHZhciBzY3JlZW53ID0gZGlzcGxheVdpZHRoKGNtKSAtIChjbS5vcHRpb25zLmZpeGVkR3V0dGVyID8gZGlzcGxheS5ndXR0ZXJzLm9mZnNldFdpZHRoIDogMCk7XG4gIHZhciB0b29XaWRlID0gcmVjdC5yaWdodCAtIHJlY3QubGVmdCA+IHNjcmVlbnc7XG4gIGlmICh0b29XaWRlKSB7IHJlY3QucmlnaHQgPSByZWN0LmxlZnQgKyBzY3JlZW53OyB9XG4gIGlmIChyZWN0LmxlZnQgPCAxMClcbiAgICB7IHJlc3VsdC5zY3JvbGxMZWZ0ID0gMDsgfVxuICBlbHNlIGlmIChyZWN0LmxlZnQgPCBzY3JlZW5sZWZ0KVxuICAgIHsgcmVzdWx0LnNjcm9sbExlZnQgPSBNYXRoLm1heCgwLCByZWN0LmxlZnQgLSAodG9vV2lkZSA/IDAgOiAxMCkpOyB9XG4gIGVsc2UgaWYgKHJlY3QucmlnaHQgPiBzY3JlZW53ICsgc2NyZWVubGVmdCAtIDMpXG4gICAgeyByZXN1bHQuc2Nyb2xsTGVmdCA9IHJlY3QucmlnaHQgKyAodG9vV2lkZSA/IDAgOiAxMCkgLSBzY3JlZW53OyB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuLy8gU3RvcmUgYSByZWxhdGl2ZSBhZGp1c3RtZW50IHRvIHRoZSBzY3JvbGwgcG9zaXRpb24gaW4gdGhlIGN1cnJlbnRcbi8vIG9wZXJhdGlvbiAodG8gYmUgYXBwbGllZCB3aGVuIHRoZSBvcGVyYXRpb24gZmluaXNoZXMpLlxuZnVuY3Rpb24gYWRkVG9TY3JvbGxUb3AoY20sIHRvcCkge1xuICBpZiAodG9wID09IG51bGwpIHsgcmV0dXJuIH1cbiAgcmVzb2x2ZVNjcm9sbFRvUG9zKGNtKTtcbiAgY20uY3VyT3Auc2Nyb2xsVG9wID0gKGNtLmN1ck9wLnNjcm9sbFRvcCA9PSBudWxsID8gY20uZG9jLnNjcm9sbFRvcCA6IGNtLmN1ck9wLnNjcm9sbFRvcCkgKyB0b3A7XG59XG5cbi8vIE1ha2Ugc3VyZSB0aGF0IGF0IHRoZSBlbmQgb2YgdGhlIG9wZXJhdGlvbiB0aGUgY3VycmVudCBjdXJzb3IgaXNcbi8vIHNob3duLlxuZnVuY3Rpb24gZW5zdXJlQ3Vyc29yVmlzaWJsZShjbSkge1xuICByZXNvbHZlU2Nyb2xsVG9Qb3MoY20pO1xuICB2YXIgY3VyID0gY20uZ2V0Q3Vyc29yKCk7XG4gIGNtLmN1ck9wLnNjcm9sbFRvUG9zID0ge2Zyb206IGN1ciwgdG86IGN1ciwgbWFyZ2luOiBjbS5vcHRpb25zLmN1cnNvclNjcm9sbE1hcmdpbn07XG59XG5cbmZ1bmN0aW9uIHNjcm9sbFRvQ29vcmRzKGNtLCB4LCB5KSB7XG4gIGlmICh4ICE9IG51bGwgfHwgeSAhPSBudWxsKSB7IHJlc29sdmVTY3JvbGxUb1BvcyhjbSk7IH1cbiAgaWYgKHggIT0gbnVsbCkgeyBjbS5jdXJPcC5zY3JvbGxMZWZ0ID0geDsgfVxuICBpZiAoeSAhPSBudWxsKSB7IGNtLmN1ck9wLnNjcm9sbFRvcCA9IHk7IH1cbn1cblxuZnVuY3Rpb24gc2Nyb2xsVG9SYW5nZShjbSwgcmFuZ2UkJDEpIHtcbiAgcmVzb2x2ZVNjcm9sbFRvUG9zKGNtKTtcbiAgY20uY3VyT3Auc2Nyb2xsVG9Qb3MgPSByYW5nZSQkMTtcbn1cblxuLy8gV2hlbiBhbiBvcGVyYXRpb24gaGFzIGl0cyBzY3JvbGxUb1BvcyBwcm9wZXJ0eSBzZXQsIGFuZCBhbm90aGVyXG4vLyBzY3JvbGwgYWN0aW9uIGlzIGFwcGxpZWQgYmVmb3JlIHRoZSBlbmQgb2YgdGhlIG9wZXJhdGlvbiwgdGhpc1xuLy8gJ3NpbXVsYXRlcycgc2Nyb2xsaW5nIHRoYXQgcG9zaXRpb24gaW50byB2aWV3IGluIGEgY2hlYXAgd2F5LCBzb1xuLy8gdGhhdCB0aGUgZWZmZWN0IG9mIGludGVybWVkaWF0ZSBzY3JvbGwgY29tbWFuZHMgaXMgbm90IGlnbm9yZWQuXG5mdW5jdGlvbiByZXNvbHZlU2Nyb2xsVG9Qb3MoY20pIHtcbiAgdmFyIHJhbmdlJCQxID0gY20uY3VyT3Auc2Nyb2xsVG9Qb3M7XG4gIGlmIChyYW5nZSQkMSkge1xuICAgIGNtLmN1ck9wLnNjcm9sbFRvUG9zID0gbnVsbDtcbiAgICB2YXIgZnJvbSA9IGVzdGltYXRlQ29vcmRzKGNtLCByYW5nZSQkMS5mcm9tKSwgdG8gPSBlc3RpbWF0ZUNvb3JkcyhjbSwgcmFuZ2UkJDEudG8pO1xuICAgIHNjcm9sbFRvQ29vcmRzUmFuZ2UoY20sIGZyb20sIHRvLCByYW5nZSQkMS5tYXJnaW4pO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNjcm9sbFRvQ29vcmRzUmFuZ2UoY20sIGZyb20sIHRvLCBtYXJnaW4pIHtcbiAgdmFyIHNQb3MgPSBjYWxjdWxhdGVTY3JvbGxQb3MoY20sIHtcbiAgICBsZWZ0OiBNYXRoLm1pbihmcm9tLmxlZnQsIHRvLmxlZnQpLFxuICAgIHRvcDogTWF0aC5taW4oZnJvbS50b3AsIHRvLnRvcCkgLSBtYXJnaW4sXG4gICAgcmlnaHQ6IE1hdGgubWF4KGZyb20ucmlnaHQsIHRvLnJpZ2h0KSxcbiAgICBib3R0b206IE1hdGgubWF4KGZyb20uYm90dG9tLCB0by5ib3R0b20pICsgbWFyZ2luXG4gIH0pO1xuICBzY3JvbGxUb0Nvb3JkcyhjbSwgc1Bvcy5zY3JvbGxMZWZ0LCBzUG9zLnNjcm9sbFRvcCk7XG59XG5cbi8vIFN5bmMgdGhlIHNjcm9sbGFibGUgYXJlYSBhbmQgc2Nyb2xsYmFycywgZW5zdXJlIHRoZSB2aWV3cG9ydFxuLy8gY292ZXJzIHRoZSB2aXNpYmxlIGFyZWEuXG5mdW5jdGlvbiB1cGRhdGVTY3JvbGxUb3AoY20sIHZhbCkge1xuICBpZiAoTWF0aC5hYnMoY20uZG9jLnNjcm9sbFRvcCAtIHZhbCkgPCAyKSB7IHJldHVybiB9XG4gIGlmICghZ2Vja28pIHsgdXBkYXRlRGlzcGxheVNpbXBsZShjbSwge3RvcDogdmFsfSk7IH1cbiAgc2V0U2Nyb2xsVG9wKGNtLCB2YWwsIHRydWUpO1xuICBpZiAoZ2Vja28pIHsgdXBkYXRlRGlzcGxheVNpbXBsZShjbSk7IH1cbiAgc3RhcnRXb3JrZXIoY20sIDEwMCk7XG59XG5cbmZ1bmN0aW9uIHNldFNjcm9sbFRvcChjbSwgdmFsLCBmb3JjZVNjcm9sbCkge1xuICB2YWwgPSBNYXRoLm1pbihjbS5kaXNwbGF5LnNjcm9sbGVyLnNjcm9sbEhlaWdodCAtIGNtLmRpc3BsYXkuc2Nyb2xsZXIuY2xpZW50SGVpZ2h0LCB2YWwpO1xuICBpZiAoY20uZGlzcGxheS5zY3JvbGxlci5zY3JvbGxUb3AgPT0gdmFsICYmICFmb3JjZVNjcm9sbCkgeyByZXR1cm4gfVxuICBjbS5kb2Muc2Nyb2xsVG9wID0gdmFsO1xuICBjbS5kaXNwbGF5LnNjcm9sbGJhcnMuc2V0U2Nyb2xsVG9wKHZhbCk7XG4gIGlmIChjbS5kaXNwbGF5LnNjcm9sbGVyLnNjcm9sbFRvcCAhPSB2YWwpIHsgY20uZGlzcGxheS5zY3JvbGxlci5zY3JvbGxUb3AgPSB2YWw7IH1cbn1cblxuLy8gU3luYyBzY3JvbGxlciBhbmQgc2Nyb2xsYmFyLCBlbnN1cmUgdGhlIGd1dHRlciBlbGVtZW50cyBhcmVcbi8vIGFsaWduZWQuXG5mdW5jdGlvbiBzZXRTY3JvbGxMZWZ0KGNtLCB2YWwsIGlzU2Nyb2xsZXIsIGZvcmNlU2Nyb2xsKSB7XG4gIHZhbCA9IE1hdGgubWluKHZhbCwgY20uZGlzcGxheS5zY3JvbGxlci5zY3JvbGxXaWR0aCAtIGNtLmRpc3BsYXkuc2Nyb2xsZXIuY2xpZW50V2lkdGgpO1xuICBpZiAoKGlzU2Nyb2xsZXIgPyB2YWwgPT0gY20uZG9jLnNjcm9sbExlZnQgOiBNYXRoLmFicyhjbS5kb2Muc2Nyb2xsTGVmdCAtIHZhbCkgPCAyKSAmJiAhZm9yY2VTY3JvbGwpIHsgcmV0dXJuIH1cbiAgY20uZG9jLnNjcm9sbExlZnQgPSB2YWw7XG4gIGFsaWduSG9yaXpvbnRhbGx5KGNtKTtcbiAgaWYgKGNtLmRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsTGVmdCAhPSB2YWwpIHsgY20uZGlzcGxheS5zY3JvbGxlci5zY3JvbGxMZWZ0ID0gdmFsOyB9XG4gIGNtLmRpc3BsYXkuc2Nyb2xsYmFycy5zZXRTY3JvbGxMZWZ0KHZhbCk7XG59XG5cbi8vIFNDUk9MTEJBUlNcblxuLy8gUHJlcGFyZSBET00gcmVhZHMgbmVlZGVkIHRvIHVwZGF0ZSB0aGUgc2Nyb2xsYmFycy4gRG9uZSBpbiBvbmVcbi8vIHNob3QgdG8gbWluaW1pemUgdXBkYXRlL21lYXN1cmUgcm91bmR0cmlwcy5cbmZ1bmN0aW9uIG1lYXN1cmVGb3JTY3JvbGxiYXJzKGNtKSB7XG4gIHZhciBkID0gY20uZGlzcGxheSwgZ3V0dGVyVyA9IGQuZ3V0dGVycy5vZmZzZXRXaWR0aDtcbiAgdmFyIGRvY0ggPSBNYXRoLnJvdW5kKGNtLmRvYy5oZWlnaHQgKyBwYWRkaW5nVmVydChjbS5kaXNwbGF5KSk7XG4gIHJldHVybiB7XG4gICAgY2xpZW50SGVpZ2h0OiBkLnNjcm9sbGVyLmNsaWVudEhlaWdodCxcbiAgICB2aWV3SGVpZ2h0OiBkLndyYXBwZXIuY2xpZW50SGVpZ2h0LFxuICAgIHNjcm9sbFdpZHRoOiBkLnNjcm9sbGVyLnNjcm9sbFdpZHRoLCBjbGllbnRXaWR0aDogZC5zY3JvbGxlci5jbGllbnRXaWR0aCxcbiAgICB2aWV3V2lkdGg6IGQud3JhcHBlci5jbGllbnRXaWR0aCxcbiAgICBiYXJMZWZ0OiBjbS5vcHRpb25zLmZpeGVkR3V0dGVyID8gZ3V0dGVyVyA6IDAsXG4gICAgZG9jSGVpZ2h0OiBkb2NILFxuICAgIHNjcm9sbEhlaWdodDogZG9jSCArIHNjcm9sbEdhcChjbSkgKyBkLmJhckhlaWdodCxcbiAgICBuYXRpdmVCYXJXaWR0aDogZC5uYXRpdmVCYXJXaWR0aCxcbiAgICBndXR0ZXJXaWR0aDogZ3V0dGVyV1xuICB9XG59XG5cbnZhciBOYXRpdmVTY3JvbGxiYXJzID0gZnVuY3Rpb24ocGxhY2UsIHNjcm9sbCwgY20pIHtcbiAgdGhpcy5jbSA9IGNtO1xuICB2YXIgdmVydCA9IHRoaXMudmVydCA9IGVsdChcImRpdlwiLCBbZWx0KFwiZGl2XCIsIG51bGwsIG51bGwsIFwibWluLXdpZHRoOiAxcHhcIildLCBcIkNvZGVNaXJyb3ItdnNjcm9sbGJhclwiKTtcbiAgdmFyIGhvcml6ID0gdGhpcy5ob3JpeiA9IGVsdChcImRpdlwiLCBbZWx0KFwiZGl2XCIsIG51bGwsIG51bGwsIFwiaGVpZ2h0OiAxMDAlOyBtaW4taGVpZ2h0OiAxcHhcIildLCBcIkNvZGVNaXJyb3ItaHNjcm9sbGJhclwiKTtcbiAgcGxhY2UodmVydCk7IHBsYWNlKGhvcml6KTtcblxuICBvbih2ZXJ0LCBcInNjcm9sbFwiLCBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHZlcnQuY2xpZW50SGVpZ2h0KSB7IHNjcm9sbCh2ZXJ0LnNjcm9sbFRvcCwgXCJ2ZXJ0aWNhbFwiKTsgfVxuICB9KTtcbiAgb24oaG9yaXosIFwic2Nyb2xsXCIsIGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoaG9yaXouY2xpZW50V2lkdGgpIHsgc2Nyb2xsKGhvcml6LnNjcm9sbExlZnQsIFwiaG9yaXpvbnRhbFwiKTsgfVxuICB9KTtcblxuICB0aGlzLmNoZWNrZWRaZXJvV2lkdGggPSBmYWxzZTtcbiAgLy8gTmVlZCB0byBzZXQgYSBtaW5pbXVtIHdpZHRoIHRvIHNlZSB0aGUgc2Nyb2xsYmFyIG9uIElFNyAoYnV0IG11c3Qgbm90IHNldCBpdCBvbiBJRTgpLlxuICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA8IDgpIHsgdGhpcy5ob3Jpei5zdHlsZS5taW5IZWlnaHQgPSB0aGlzLnZlcnQuc3R5bGUubWluV2lkdGggPSBcIjE4cHhcIjsgfVxufTtcblxuTmF0aXZlU2Nyb2xsYmFycy5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24gKG1lYXN1cmUpIHtcbiAgdmFyIG5lZWRzSCA9IG1lYXN1cmUuc2Nyb2xsV2lkdGggPiBtZWFzdXJlLmNsaWVudFdpZHRoICsgMTtcbiAgdmFyIG5lZWRzViA9IG1lYXN1cmUuc2Nyb2xsSGVpZ2h0ID4gbWVhc3VyZS5jbGllbnRIZWlnaHQgKyAxO1xuICB2YXIgc1dpZHRoID0gbWVhc3VyZS5uYXRpdmVCYXJXaWR0aDtcblxuICBpZiAobmVlZHNWKSB7XG4gICAgdGhpcy52ZXJ0LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gICAgdGhpcy52ZXJ0LnN0eWxlLmJvdHRvbSA9IG5lZWRzSCA/IHNXaWR0aCArIFwicHhcIiA6IFwiMFwiO1xuICAgIHZhciB0b3RhbEhlaWdodCA9IG1lYXN1cmUudmlld0hlaWdodCAtIChuZWVkc0ggPyBzV2lkdGggOiAwKTtcbiAgICAvLyBBIGJ1ZyBpbiBJRTggY2FuIGNhdXNlIHRoaXMgdmFsdWUgdG8gYmUgbmVnYXRpdmUsIHNvIGd1YXJkIGl0LlxuICAgIHRoaXMudmVydC5maXJzdENoaWxkLnN0eWxlLmhlaWdodCA9XG4gICAgICBNYXRoLm1heCgwLCBtZWFzdXJlLnNjcm9sbEhlaWdodCAtIG1lYXN1cmUuY2xpZW50SGVpZ2h0ICsgdG90YWxIZWlnaHQpICsgXCJweFwiO1xuICB9IGVsc2Uge1xuICAgIHRoaXMudmVydC5zdHlsZS5kaXNwbGF5ID0gXCJcIjtcbiAgICB0aGlzLnZlcnQuZmlyc3RDaGlsZC5zdHlsZS5oZWlnaHQgPSBcIjBcIjtcbiAgfVxuXG4gIGlmIChuZWVkc0gpIHtcbiAgICB0aGlzLmhvcml6LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gICAgdGhpcy5ob3Jpei5zdHlsZS5yaWdodCA9IG5lZWRzViA/IHNXaWR0aCArIFwicHhcIiA6IFwiMFwiO1xuICAgIHRoaXMuaG9yaXouc3R5bGUubGVmdCA9IG1lYXN1cmUuYmFyTGVmdCArIFwicHhcIjtcbiAgICB2YXIgdG90YWxXaWR0aCA9IG1lYXN1cmUudmlld1dpZHRoIC0gbWVhc3VyZS5iYXJMZWZ0IC0gKG5lZWRzViA/IHNXaWR0aCA6IDApO1xuICAgIHRoaXMuaG9yaXouZmlyc3RDaGlsZC5zdHlsZS53aWR0aCA9XG4gICAgICBNYXRoLm1heCgwLCBtZWFzdXJlLnNjcm9sbFdpZHRoIC0gbWVhc3VyZS5jbGllbnRXaWR0aCArIHRvdGFsV2lkdGgpICsgXCJweFwiO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuaG9yaXouc3R5bGUuZGlzcGxheSA9IFwiXCI7XG4gICAgdGhpcy5ob3Jpei5maXJzdENoaWxkLnN0eWxlLndpZHRoID0gXCIwXCI7XG4gIH1cblxuICBpZiAoIXRoaXMuY2hlY2tlZFplcm9XaWR0aCAmJiBtZWFzdXJlLmNsaWVudEhlaWdodCA+IDApIHtcbiAgICBpZiAoc1dpZHRoID09IDApIHsgdGhpcy56ZXJvV2lkdGhIYWNrKCk7IH1cbiAgICB0aGlzLmNoZWNrZWRaZXJvV2lkdGggPSB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIHtyaWdodDogbmVlZHNWID8gc1dpZHRoIDogMCwgYm90dG9tOiBuZWVkc0ggPyBzV2lkdGggOiAwfVxufTtcblxuTmF0aXZlU2Nyb2xsYmFycy5wcm90b3R5cGUuc2V0U2Nyb2xsTGVmdCA9IGZ1bmN0aW9uIChwb3MpIHtcbiAgaWYgKHRoaXMuaG9yaXouc2Nyb2xsTGVmdCAhPSBwb3MpIHsgdGhpcy5ob3Jpei5zY3JvbGxMZWZ0ID0gcG9zOyB9XG4gIGlmICh0aGlzLmRpc2FibGVIb3JpeikgeyB0aGlzLmVuYWJsZVplcm9XaWR0aEJhcih0aGlzLmhvcml6LCB0aGlzLmRpc2FibGVIb3JpeiwgXCJob3JpelwiKTsgfVxufTtcblxuTmF0aXZlU2Nyb2xsYmFycy5wcm90b3R5cGUuc2V0U2Nyb2xsVG9wID0gZnVuY3Rpb24gKHBvcykge1xuICBpZiAodGhpcy52ZXJ0LnNjcm9sbFRvcCAhPSBwb3MpIHsgdGhpcy52ZXJ0LnNjcm9sbFRvcCA9IHBvczsgfVxuICBpZiAodGhpcy5kaXNhYmxlVmVydCkgeyB0aGlzLmVuYWJsZVplcm9XaWR0aEJhcih0aGlzLnZlcnQsIHRoaXMuZGlzYWJsZVZlcnQsIFwidmVydFwiKTsgfVxufTtcblxuTmF0aXZlU2Nyb2xsYmFycy5wcm90b3R5cGUuemVyb1dpZHRoSGFjayA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHcgPSBtYWMgJiYgIW1hY19nZU1vdW50YWluTGlvbiA/IFwiMTJweFwiIDogXCIxOHB4XCI7XG4gIHRoaXMuaG9yaXouc3R5bGUuaGVpZ2h0ID0gdGhpcy52ZXJ0LnN0eWxlLndpZHRoID0gdztcbiAgdGhpcy5ob3Jpei5zdHlsZS5wb2ludGVyRXZlbnRzID0gdGhpcy52ZXJ0LnN0eWxlLnBvaW50ZXJFdmVudHMgPSBcIm5vbmVcIjtcbiAgdGhpcy5kaXNhYmxlSG9yaXogPSBuZXcgRGVsYXllZDtcbiAgdGhpcy5kaXNhYmxlVmVydCA9IG5ldyBEZWxheWVkO1xufTtcblxuTmF0aXZlU2Nyb2xsYmFycy5wcm90b3R5cGUuZW5hYmxlWmVyb1dpZHRoQmFyID0gZnVuY3Rpb24gKGJhciwgZGVsYXksIHR5cGUpIHtcbiAgYmFyLnN0eWxlLnBvaW50ZXJFdmVudHMgPSBcImF1dG9cIjtcbiAgZnVuY3Rpb24gbWF5YmVEaXNhYmxlKCkge1xuICAgIC8vIFRvIGZpbmQgb3V0IHdoZXRoZXIgdGhlIHNjcm9sbGJhciBpcyBzdGlsbCB2aXNpYmxlLCB3ZVxuICAgIC8vIGNoZWNrIHdoZXRoZXIgdGhlIGVsZW1lbnQgdW5kZXIgdGhlIHBpeGVsIGluIHRoZSBib3R0b21cbiAgICAvLyByaWdodCBjb3JuZXIgb2YgdGhlIHNjcm9sbGJhciBib3ggaXMgdGhlIHNjcm9sbGJhciBib3hcbiAgICAvLyBpdHNlbGYgKHdoZW4gdGhlIGJhciBpcyBzdGlsbCB2aXNpYmxlKSBvciBpdHMgZmlsbGVyIGNoaWxkXG4gICAgLy8gKHdoZW4gdGhlIGJhciBpcyBoaWRkZW4pLiBJZiBpdCBpcyBzdGlsbCB2aXNpYmxlLCB3ZSBrZWVwXG4gICAgLy8gaXQgZW5hYmxlZCwgaWYgaXQncyBoaWRkZW4sIHdlIGRpc2FibGUgcG9pbnRlciBldmVudHMuXG4gICAgdmFyIGJveCA9IGJhci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB2YXIgZWx0JCQxID0gdHlwZSA9PSBcInZlcnRcIiA/IGRvY3VtZW50LmVsZW1lbnRGcm9tUG9pbnQoYm94LnJpZ2h0IC0gMSwgKGJveC50b3AgKyBib3guYm90dG9tKSAvIDIpXG4gICAgICAgIDogZG9jdW1lbnQuZWxlbWVudEZyb21Qb2ludCgoYm94LnJpZ2h0ICsgYm94LmxlZnQpIC8gMiwgYm94LmJvdHRvbSAtIDEpO1xuICAgIGlmIChlbHQkJDEgIT0gYmFyKSB7IGJhci5zdHlsZS5wb2ludGVyRXZlbnRzID0gXCJub25lXCI7IH1cbiAgICBlbHNlIHsgZGVsYXkuc2V0KDEwMDAsIG1heWJlRGlzYWJsZSk7IH1cbiAgfVxuICBkZWxheS5zZXQoMTAwMCwgbWF5YmVEaXNhYmxlKTtcbn07XG5cbk5hdGl2ZVNjcm9sbGJhcnMucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xuICB2YXIgcGFyZW50ID0gdGhpcy5ob3Jpei5wYXJlbnROb2RlO1xuICBwYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5ob3Jpeik7XG4gIHBhcmVudC5yZW1vdmVDaGlsZCh0aGlzLnZlcnQpO1xufTtcblxudmFyIE51bGxTY3JvbGxiYXJzID0gZnVuY3Rpb24gKCkge307XG5cbk51bGxTY3JvbGxiYXJzLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbiAoKSB7IHJldHVybiB7Ym90dG9tOiAwLCByaWdodDogMH0gfTtcbk51bGxTY3JvbGxiYXJzLnByb3RvdHlwZS5zZXRTY3JvbGxMZWZ0ID0gZnVuY3Rpb24gKCkge307XG5OdWxsU2Nyb2xsYmFycy5wcm90b3R5cGUuc2V0U2Nyb2xsVG9wID0gZnVuY3Rpb24gKCkge307XG5OdWxsU2Nyb2xsYmFycy5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoKSB7fTtcblxuZnVuY3Rpb24gdXBkYXRlU2Nyb2xsYmFycyhjbSwgbWVhc3VyZSkge1xuICBpZiAoIW1lYXN1cmUpIHsgbWVhc3VyZSA9IG1lYXN1cmVGb3JTY3JvbGxiYXJzKGNtKTsgfVxuICB2YXIgc3RhcnRXaWR0aCA9IGNtLmRpc3BsYXkuYmFyV2lkdGgsIHN0YXJ0SGVpZ2h0ID0gY20uZGlzcGxheS5iYXJIZWlnaHQ7XG4gIHVwZGF0ZVNjcm9sbGJhcnNJbm5lcihjbSwgbWVhc3VyZSk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgNCAmJiBzdGFydFdpZHRoICE9IGNtLmRpc3BsYXkuYmFyV2lkdGggfHwgc3RhcnRIZWlnaHQgIT0gY20uZGlzcGxheS5iYXJIZWlnaHQ7IGkrKykge1xuICAgIGlmIChzdGFydFdpZHRoICE9IGNtLmRpc3BsYXkuYmFyV2lkdGggJiYgY20ub3B0aW9ucy5saW5lV3JhcHBpbmcpXG4gICAgICB7IHVwZGF0ZUhlaWdodHNJblZpZXdwb3J0KGNtKTsgfVxuICAgIHVwZGF0ZVNjcm9sbGJhcnNJbm5lcihjbSwgbWVhc3VyZUZvclNjcm9sbGJhcnMoY20pKTtcbiAgICBzdGFydFdpZHRoID0gY20uZGlzcGxheS5iYXJXaWR0aDsgc3RhcnRIZWlnaHQgPSBjbS5kaXNwbGF5LmJhckhlaWdodDtcbiAgfVxufVxuXG4vLyBSZS1zeW5jaHJvbml6ZSB0aGUgZmFrZSBzY3JvbGxiYXJzIHdpdGggdGhlIGFjdHVhbCBzaXplIG9mIHRoZVxuLy8gY29udGVudC5cbmZ1bmN0aW9uIHVwZGF0ZVNjcm9sbGJhcnNJbm5lcihjbSwgbWVhc3VyZSkge1xuICB2YXIgZCA9IGNtLmRpc3BsYXk7XG4gIHZhciBzaXplcyA9IGQuc2Nyb2xsYmFycy51cGRhdGUobWVhc3VyZSk7XG5cbiAgZC5zaXplci5zdHlsZS5wYWRkaW5nUmlnaHQgPSAoZC5iYXJXaWR0aCA9IHNpemVzLnJpZ2h0KSArIFwicHhcIjtcbiAgZC5zaXplci5zdHlsZS5wYWRkaW5nQm90dG9tID0gKGQuYmFySGVpZ2h0ID0gc2l6ZXMuYm90dG9tKSArIFwicHhcIjtcbiAgZC5oZWlnaHRGb3JjZXIuc3R5bGUuYm9yZGVyQm90dG9tID0gc2l6ZXMuYm90dG9tICsgXCJweCBzb2xpZCB0cmFuc3BhcmVudFwiO1xuXG4gIGlmIChzaXplcy5yaWdodCAmJiBzaXplcy5ib3R0b20pIHtcbiAgICBkLnNjcm9sbGJhckZpbGxlci5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgIGQuc2Nyb2xsYmFyRmlsbGVyLnN0eWxlLmhlaWdodCA9IHNpemVzLmJvdHRvbSArIFwicHhcIjtcbiAgICBkLnNjcm9sbGJhckZpbGxlci5zdHlsZS53aWR0aCA9IHNpemVzLnJpZ2h0ICsgXCJweFwiO1xuICB9IGVsc2UgeyBkLnNjcm9sbGJhckZpbGxlci5zdHlsZS5kaXNwbGF5ID0gXCJcIjsgfVxuICBpZiAoc2l6ZXMuYm90dG9tICYmIGNtLm9wdGlvbnMuY292ZXJHdXR0ZXJOZXh0VG9TY3JvbGxiYXIgJiYgY20ub3B0aW9ucy5maXhlZEd1dHRlcikge1xuICAgIGQuZ3V0dGVyRmlsbGVyLnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gICAgZC5ndXR0ZXJGaWxsZXIuc3R5bGUuaGVpZ2h0ID0gc2l6ZXMuYm90dG9tICsgXCJweFwiO1xuICAgIGQuZ3V0dGVyRmlsbGVyLnN0eWxlLndpZHRoID0gbWVhc3VyZS5ndXR0ZXJXaWR0aCArIFwicHhcIjtcbiAgfSBlbHNlIHsgZC5ndXR0ZXJGaWxsZXIuc3R5bGUuZGlzcGxheSA9IFwiXCI7IH1cbn1cblxudmFyIHNjcm9sbGJhck1vZGVsID0ge1wibmF0aXZlXCI6IE5hdGl2ZVNjcm9sbGJhcnMsIFwibnVsbFwiOiBOdWxsU2Nyb2xsYmFyc307XG5cbmZ1bmN0aW9uIGluaXRTY3JvbGxiYXJzKGNtKSB7XG4gIGlmIChjbS5kaXNwbGF5LnNjcm9sbGJhcnMpIHtcbiAgICBjbS5kaXNwbGF5LnNjcm9sbGJhcnMuY2xlYXIoKTtcbiAgICBpZiAoY20uZGlzcGxheS5zY3JvbGxiYXJzLmFkZENsYXNzKVxuICAgICAgeyBybUNsYXNzKGNtLmRpc3BsYXkud3JhcHBlciwgY20uZGlzcGxheS5zY3JvbGxiYXJzLmFkZENsYXNzKTsgfVxuICB9XG5cbiAgY20uZGlzcGxheS5zY3JvbGxiYXJzID0gbmV3IHNjcm9sbGJhck1vZGVsW2NtLm9wdGlvbnMuc2Nyb2xsYmFyU3R5bGVdKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgY20uZGlzcGxheS53cmFwcGVyLmluc2VydEJlZm9yZShub2RlLCBjbS5kaXNwbGF5LnNjcm9sbGJhckZpbGxlcik7XG4gICAgLy8gUHJldmVudCBjbGlja3MgaW4gdGhlIHNjcm9sbGJhcnMgZnJvbSBraWxsaW5nIGZvY3VzXG4gICAgb24obm9kZSwgXCJtb3VzZWRvd25cIiwgZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKGNtLnN0YXRlLmZvY3VzZWQpIHsgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7IHJldHVybiBjbS5kaXNwbGF5LmlucHV0LmZvY3VzKCk7IH0sIDApOyB9XG4gICAgfSk7XG4gICAgbm9kZS5zZXRBdHRyaWJ1dGUoXCJjbS1ub3QtY29udGVudFwiLCBcInRydWVcIik7XG4gIH0sIGZ1bmN0aW9uIChwb3MsIGF4aXMpIHtcbiAgICBpZiAoYXhpcyA9PSBcImhvcml6b250YWxcIikgeyBzZXRTY3JvbGxMZWZ0KGNtLCBwb3MpOyB9XG4gICAgZWxzZSB7IHVwZGF0ZVNjcm9sbFRvcChjbSwgcG9zKTsgfVxuICB9LCBjbSk7XG4gIGlmIChjbS5kaXNwbGF5LnNjcm9sbGJhcnMuYWRkQ2xhc3MpXG4gICAgeyBhZGRDbGFzcyhjbS5kaXNwbGF5LndyYXBwZXIsIGNtLmRpc3BsYXkuc2Nyb2xsYmFycy5hZGRDbGFzcyk7IH1cbn1cblxuLy8gT3BlcmF0aW9ucyBhcmUgdXNlZCB0byB3cmFwIGEgc2VyaWVzIG9mIGNoYW5nZXMgdG8gdGhlIGVkaXRvclxuLy8gc3RhdGUgaW4gc3VjaCBhIHdheSB0aGF0IGVhY2ggY2hhbmdlIHdvbid0IGhhdmUgdG8gdXBkYXRlIHRoZVxuLy8gY3Vyc29yIGFuZCBkaXNwbGF5ICh3aGljaCB3b3VsZCBiZSBhd2t3YXJkLCBzbG93LCBhbmRcbi8vIGVycm9yLXByb25lKS4gSW5zdGVhZCwgZGlzcGxheSB1cGRhdGVzIGFyZSBiYXRjaGVkIGFuZCB0aGVuIGFsbFxuLy8gY29tYmluZWQgYW5kIGV4ZWN1dGVkIGF0IG9uY2UuXG5cbnZhciBuZXh0T3BJZCA9IDA7XG4vLyBTdGFydCBhIG5ldyBvcGVyYXRpb24uXG5mdW5jdGlvbiBzdGFydE9wZXJhdGlvbihjbSkge1xuICBjbS5jdXJPcCA9IHtcbiAgICBjbTogY20sXG4gICAgdmlld0NoYW5nZWQ6IGZhbHNlLCAgICAgIC8vIEZsYWcgdGhhdCBpbmRpY2F0ZXMgdGhhdCBsaW5lcyBtaWdodCBuZWVkIHRvIGJlIHJlZHJhd25cbiAgICBzdGFydEhlaWdodDogY20uZG9jLmhlaWdodCwgLy8gVXNlZCB0byBkZXRlY3QgbmVlZCB0byB1cGRhdGUgc2Nyb2xsYmFyXG4gICAgZm9yY2VVcGRhdGU6IGZhbHNlLCAgICAgIC8vIFVzZWQgdG8gZm9yY2UgYSByZWRyYXdcbiAgICB1cGRhdGVJbnB1dDogbnVsbCwgICAgICAgLy8gV2hldGhlciB0byByZXNldCB0aGUgaW5wdXQgdGV4dGFyZWFcbiAgICB0eXBpbmc6IGZhbHNlLCAgICAgICAgICAgLy8gV2hldGhlciB0aGlzIHJlc2V0IHNob3VsZCBiZSBjYXJlZnVsIHRvIGxlYXZlIGV4aXN0aW5nIHRleHQgKGZvciBjb21wb3NpdGluZylcbiAgICBjaGFuZ2VPYmpzOiBudWxsLCAgICAgICAgLy8gQWNjdW11bGF0ZWQgY2hhbmdlcywgZm9yIGZpcmluZyBjaGFuZ2UgZXZlbnRzXG4gICAgY3Vyc29yQWN0aXZpdHlIYW5kbGVyczogbnVsbCwgLy8gU2V0IG9mIGhhbmRsZXJzIHRvIGZpcmUgY3Vyc29yQWN0aXZpdHkgb25cbiAgICBjdXJzb3JBY3Rpdml0eUNhbGxlZDogMCwgLy8gVHJhY2tzIHdoaWNoIGN1cnNvckFjdGl2aXR5IGhhbmRsZXJzIGhhdmUgYmVlbiBjYWxsZWQgYWxyZWFkeVxuICAgIHNlbGVjdGlvbkNoYW5nZWQ6IGZhbHNlLCAvLyBXaGV0aGVyIHRoZSBzZWxlY3Rpb24gbmVlZHMgdG8gYmUgcmVkcmF3blxuICAgIHVwZGF0ZU1heExpbmU6IGZhbHNlLCAgICAvLyBTZXQgd2hlbiB0aGUgd2lkZXN0IGxpbmUgbmVlZHMgdG8gYmUgZGV0ZXJtaW5lZCBhbmV3XG4gICAgc2Nyb2xsTGVmdDogbnVsbCwgc2Nyb2xsVG9wOiBudWxsLCAvLyBJbnRlcm1lZGlhdGUgc2Nyb2xsIHBvc2l0aW9uLCBub3QgcHVzaGVkIHRvIERPTSB5ZXRcbiAgICBzY3JvbGxUb1BvczogbnVsbCwgICAgICAgLy8gVXNlZCB0byBzY3JvbGwgdG8gYSBzcGVjaWZpYyBwb3NpdGlvblxuICAgIGZvY3VzOiBmYWxzZSxcbiAgICBpZDogKytuZXh0T3BJZCAgICAgICAgICAgLy8gVW5pcXVlIElEXG4gIH07XG4gIHB1c2hPcGVyYXRpb24oY20uY3VyT3ApO1xufVxuXG4vLyBGaW5pc2ggYW4gb3BlcmF0aW9uLCB1cGRhdGluZyB0aGUgZGlzcGxheSBhbmQgc2lnbmFsbGluZyBkZWxheWVkIGV2ZW50c1xuZnVuY3Rpb24gZW5kT3BlcmF0aW9uKGNtKSB7XG4gIHZhciBvcCA9IGNtLmN1ck9wO1xuICBmaW5pc2hPcGVyYXRpb24ob3AsIGZ1bmN0aW9uIChncm91cCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZ3JvdXAub3BzLmxlbmd0aDsgaSsrKVxuICAgICAgeyBncm91cC5vcHNbaV0uY20uY3VyT3AgPSBudWxsOyB9XG4gICAgZW5kT3BlcmF0aW9ucyhncm91cCk7XG4gIH0pO1xufVxuXG4vLyBUaGUgRE9NIHVwZGF0ZXMgZG9uZSB3aGVuIGFuIG9wZXJhdGlvbiBmaW5pc2hlcyBhcmUgYmF0Y2hlZCBzb1xuLy8gdGhhdCB0aGUgbWluaW11bSBudW1iZXIgb2YgcmVsYXlvdXRzIGFyZSByZXF1aXJlZC5cbmZ1bmN0aW9uIGVuZE9wZXJhdGlvbnMoZ3JvdXApIHtcbiAgdmFyIG9wcyA9IGdyb3VwLm9wcztcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcHMubGVuZ3RoOyBpKyspIC8vIFJlYWQgRE9NXG4gICAgeyBlbmRPcGVyYXRpb25fUjEob3BzW2ldKTsgfVxuICBmb3IgKHZhciBpJDEgPSAwOyBpJDEgPCBvcHMubGVuZ3RoOyBpJDErKykgLy8gV3JpdGUgRE9NIChtYXliZSlcbiAgICB7IGVuZE9wZXJhdGlvbl9XMShvcHNbaSQxXSk7IH1cbiAgZm9yICh2YXIgaSQyID0gMDsgaSQyIDwgb3BzLmxlbmd0aDsgaSQyKyspIC8vIFJlYWQgRE9NXG4gICAgeyBlbmRPcGVyYXRpb25fUjIob3BzW2kkMl0pOyB9XG4gIGZvciAodmFyIGkkMyA9IDA7IGkkMyA8IG9wcy5sZW5ndGg7IGkkMysrKSAvLyBXcml0ZSBET00gKG1heWJlKVxuICAgIHsgZW5kT3BlcmF0aW9uX1cyKG9wc1tpJDNdKTsgfVxuICBmb3IgKHZhciBpJDQgPSAwOyBpJDQgPCBvcHMubGVuZ3RoOyBpJDQrKykgLy8gUmVhZCBET01cbiAgICB7IGVuZE9wZXJhdGlvbl9maW5pc2gob3BzW2kkNF0pOyB9XG59XG5cbmZ1bmN0aW9uIGVuZE9wZXJhdGlvbl9SMShvcCkge1xuICB2YXIgY20gPSBvcC5jbSwgZGlzcGxheSA9IGNtLmRpc3BsYXk7XG4gIG1heWJlQ2xpcFNjcm9sbGJhcnMoY20pO1xuICBpZiAob3AudXBkYXRlTWF4TGluZSkgeyBmaW5kTWF4TGluZShjbSk7IH1cblxuICBvcC5tdXN0VXBkYXRlID0gb3Audmlld0NoYW5nZWQgfHwgb3AuZm9yY2VVcGRhdGUgfHwgb3Auc2Nyb2xsVG9wICE9IG51bGwgfHxcbiAgICBvcC5zY3JvbGxUb1BvcyAmJiAob3Auc2Nyb2xsVG9Qb3MuZnJvbS5saW5lIDwgZGlzcGxheS52aWV3RnJvbSB8fFxuICAgICAgICAgICAgICAgICAgICAgICBvcC5zY3JvbGxUb1Bvcy50by5saW5lID49IGRpc3BsYXkudmlld1RvKSB8fFxuICAgIGRpc3BsYXkubWF4TGluZUNoYW5nZWQgJiYgY20ub3B0aW9ucy5saW5lV3JhcHBpbmc7XG4gIG9wLnVwZGF0ZSA9IG9wLm11c3RVcGRhdGUgJiZcbiAgICBuZXcgRGlzcGxheVVwZGF0ZShjbSwgb3AubXVzdFVwZGF0ZSAmJiB7dG9wOiBvcC5zY3JvbGxUb3AsIGVuc3VyZTogb3Auc2Nyb2xsVG9Qb3N9LCBvcC5mb3JjZVVwZGF0ZSk7XG59XG5cbmZ1bmN0aW9uIGVuZE9wZXJhdGlvbl9XMShvcCkge1xuICBvcC51cGRhdGVkRGlzcGxheSA9IG9wLm11c3RVcGRhdGUgJiYgdXBkYXRlRGlzcGxheUlmTmVlZGVkKG9wLmNtLCBvcC51cGRhdGUpO1xufVxuXG5mdW5jdGlvbiBlbmRPcGVyYXRpb25fUjIob3ApIHtcbiAgdmFyIGNtID0gb3AuY20sIGRpc3BsYXkgPSBjbS5kaXNwbGF5O1xuICBpZiAob3AudXBkYXRlZERpc3BsYXkpIHsgdXBkYXRlSGVpZ2h0c0luVmlld3BvcnQoY20pOyB9XG5cbiAgb3AuYmFyTWVhc3VyZSA9IG1lYXN1cmVGb3JTY3JvbGxiYXJzKGNtKTtcblxuICAvLyBJZiB0aGUgbWF4IGxpbmUgY2hhbmdlZCBzaW5jZSBpdCB3YXMgbGFzdCBtZWFzdXJlZCwgbWVhc3VyZSBpdCxcbiAgLy8gYW5kIGVuc3VyZSB0aGUgZG9jdW1lbnQncyB3aWR0aCBtYXRjaGVzIGl0LlxuICAvLyB1cGRhdGVEaXNwbGF5X1cyIHdpbGwgdXNlIHRoZXNlIHByb3BlcnRpZXMgdG8gZG8gdGhlIGFjdHVhbCByZXNpemluZ1xuICBpZiAoZGlzcGxheS5tYXhMaW5lQ2hhbmdlZCAmJiAhY20ub3B0aW9ucy5saW5lV3JhcHBpbmcpIHtcbiAgICBvcC5hZGp1c3RXaWR0aFRvID0gbWVhc3VyZUNoYXIoY20sIGRpc3BsYXkubWF4TGluZSwgZGlzcGxheS5tYXhMaW5lLnRleHQubGVuZ3RoKS5sZWZ0ICsgMztcbiAgICBjbS5kaXNwbGF5LnNpemVyV2lkdGggPSBvcC5hZGp1c3RXaWR0aFRvO1xuICAgIG9wLmJhck1lYXN1cmUuc2Nyb2xsV2lkdGggPVxuICAgICAgTWF0aC5tYXgoZGlzcGxheS5zY3JvbGxlci5jbGllbnRXaWR0aCwgZGlzcGxheS5zaXplci5vZmZzZXRMZWZ0ICsgb3AuYWRqdXN0V2lkdGhUbyArIHNjcm9sbEdhcChjbSkgKyBjbS5kaXNwbGF5LmJhcldpZHRoKTtcbiAgICBvcC5tYXhTY3JvbGxMZWZ0ID0gTWF0aC5tYXgoMCwgZGlzcGxheS5zaXplci5vZmZzZXRMZWZ0ICsgb3AuYWRqdXN0V2lkdGhUbyAtIGRpc3BsYXlXaWR0aChjbSkpO1xuICB9XG5cbiAgaWYgKG9wLnVwZGF0ZWREaXNwbGF5IHx8IG9wLnNlbGVjdGlvbkNoYW5nZWQpXG4gICAgeyBvcC5wcmVwYXJlZFNlbGVjdGlvbiA9IGRpc3BsYXkuaW5wdXQucHJlcGFyZVNlbGVjdGlvbigpOyB9XG59XG5cbmZ1bmN0aW9uIGVuZE9wZXJhdGlvbl9XMihvcCkge1xuICB2YXIgY20gPSBvcC5jbTtcblxuICBpZiAob3AuYWRqdXN0V2lkdGhUbyAhPSBudWxsKSB7XG4gICAgY20uZGlzcGxheS5zaXplci5zdHlsZS5taW5XaWR0aCA9IG9wLmFkanVzdFdpZHRoVG8gKyBcInB4XCI7XG4gICAgaWYgKG9wLm1heFNjcm9sbExlZnQgPCBjbS5kb2Muc2Nyb2xsTGVmdClcbiAgICAgIHsgc2V0U2Nyb2xsTGVmdChjbSwgTWF0aC5taW4oY20uZGlzcGxheS5zY3JvbGxlci5zY3JvbGxMZWZ0LCBvcC5tYXhTY3JvbGxMZWZ0KSwgdHJ1ZSk7IH1cbiAgICBjbS5kaXNwbGF5Lm1heExpbmVDaGFuZ2VkID0gZmFsc2U7XG4gIH1cblxuICB2YXIgdGFrZUZvY3VzID0gb3AuZm9jdXMgJiYgb3AuZm9jdXMgPT0gYWN0aXZlRWx0KCk7XG4gIGlmIChvcC5wcmVwYXJlZFNlbGVjdGlvbilcbiAgICB7IGNtLmRpc3BsYXkuaW5wdXQuc2hvd1NlbGVjdGlvbihvcC5wcmVwYXJlZFNlbGVjdGlvbiwgdGFrZUZvY3VzKTsgfVxuICBpZiAob3AudXBkYXRlZERpc3BsYXkgfHwgb3Auc3RhcnRIZWlnaHQgIT0gY20uZG9jLmhlaWdodClcbiAgICB7IHVwZGF0ZVNjcm9sbGJhcnMoY20sIG9wLmJhck1lYXN1cmUpOyB9XG4gIGlmIChvcC51cGRhdGVkRGlzcGxheSlcbiAgICB7IHNldERvY3VtZW50SGVpZ2h0KGNtLCBvcC5iYXJNZWFzdXJlKTsgfVxuXG4gIGlmIChvcC5zZWxlY3Rpb25DaGFuZ2VkKSB7IHJlc3RhcnRCbGluayhjbSk7IH1cblxuICBpZiAoY20uc3RhdGUuZm9jdXNlZCAmJiBvcC51cGRhdGVJbnB1dClcbiAgICB7IGNtLmRpc3BsYXkuaW5wdXQucmVzZXQob3AudHlwaW5nKTsgfVxuICBpZiAodGFrZUZvY3VzKSB7IGVuc3VyZUZvY3VzKG9wLmNtKTsgfVxufVxuXG5mdW5jdGlvbiBlbmRPcGVyYXRpb25fZmluaXNoKG9wKSB7XG4gIHZhciBjbSA9IG9wLmNtLCBkaXNwbGF5ID0gY20uZGlzcGxheSwgZG9jID0gY20uZG9jO1xuXG4gIGlmIChvcC51cGRhdGVkRGlzcGxheSkgeyBwb3N0VXBkYXRlRGlzcGxheShjbSwgb3AudXBkYXRlKTsgfVxuXG4gIC8vIEFib3J0IG1vdXNlIHdoZWVsIGRlbHRhIG1lYXN1cmVtZW50LCB3aGVuIHNjcm9sbGluZyBleHBsaWNpdGx5XG4gIGlmIChkaXNwbGF5LndoZWVsU3RhcnRYICE9IG51bGwgJiYgKG9wLnNjcm9sbFRvcCAhPSBudWxsIHx8IG9wLnNjcm9sbExlZnQgIT0gbnVsbCB8fCBvcC5zY3JvbGxUb1BvcykpXG4gICAgeyBkaXNwbGF5LndoZWVsU3RhcnRYID0gZGlzcGxheS53aGVlbFN0YXJ0WSA9IG51bGw7IH1cblxuICAvLyBQcm9wYWdhdGUgdGhlIHNjcm9sbCBwb3NpdGlvbiB0byB0aGUgYWN0dWFsIERPTSBzY3JvbGxlclxuICBpZiAob3Auc2Nyb2xsVG9wICE9IG51bGwpIHsgc2V0U2Nyb2xsVG9wKGNtLCBvcC5zY3JvbGxUb3AsIG9wLmZvcmNlU2Nyb2xsKTsgfVxuXG4gIGlmIChvcC5zY3JvbGxMZWZ0ICE9IG51bGwpIHsgc2V0U2Nyb2xsTGVmdChjbSwgb3Auc2Nyb2xsTGVmdCwgdHJ1ZSwgdHJ1ZSk7IH1cbiAgLy8gSWYgd2UgbmVlZCB0byBzY3JvbGwgYSBzcGVjaWZpYyBwb3NpdGlvbiBpbnRvIHZpZXcsIGRvIHNvLlxuICBpZiAob3Auc2Nyb2xsVG9Qb3MpIHtcbiAgICB2YXIgcmVjdCA9IHNjcm9sbFBvc0ludG9WaWV3KGNtLCBjbGlwUG9zKGRvYywgb3Auc2Nyb2xsVG9Qb3MuZnJvbSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGlwUG9zKGRvYywgb3Auc2Nyb2xsVG9Qb3MudG8pLCBvcC5zY3JvbGxUb1Bvcy5tYXJnaW4pO1xuICAgIG1heWJlU2Nyb2xsV2luZG93KGNtLCByZWN0KTtcbiAgfVxuXG4gIC8vIEZpcmUgZXZlbnRzIGZvciBtYXJrZXJzIHRoYXQgYXJlIGhpZGRlbi91bmlkZGVuIGJ5IGVkaXRpbmcgb3JcbiAgLy8gdW5kb2luZ1xuICB2YXIgaGlkZGVuID0gb3AubWF5YmVIaWRkZW5NYXJrZXJzLCB1bmhpZGRlbiA9IG9wLm1heWJlVW5oaWRkZW5NYXJrZXJzO1xuICBpZiAoaGlkZGVuKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgaGlkZGVuLmxlbmd0aDsgKytpKVxuICAgIHsgaWYgKCFoaWRkZW5baV0ubGluZXMubGVuZ3RoKSB7IHNpZ25hbChoaWRkZW5baV0sIFwiaGlkZVwiKTsgfSB9IH1cbiAgaWYgKHVuaGlkZGVuKSB7IGZvciAodmFyIGkkMSA9IDA7IGkkMSA8IHVuaGlkZGVuLmxlbmd0aDsgKytpJDEpXG4gICAgeyBpZiAodW5oaWRkZW5baSQxXS5saW5lcy5sZW5ndGgpIHsgc2lnbmFsKHVuaGlkZGVuW2kkMV0sIFwidW5oaWRlXCIpOyB9IH0gfVxuXG4gIGlmIChkaXNwbGF5LndyYXBwZXIub2Zmc2V0SGVpZ2h0KVxuICAgIHsgZG9jLnNjcm9sbFRvcCA9IGNtLmRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsVG9wOyB9XG5cbiAgLy8gRmlyZSBjaGFuZ2UgZXZlbnRzLCBhbmQgZGVsYXllZCBldmVudCBoYW5kbGVyc1xuICBpZiAob3AuY2hhbmdlT2JqcylcbiAgICB7IHNpZ25hbChjbSwgXCJjaGFuZ2VzXCIsIGNtLCBvcC5jaGFuZ2VPYmpzKTsgfVxuICBpZiAob3AudXBkYXRlKVxuICAgIHsgb3AudXBkYXRlLmZpbmlzaCgpOyB9XG59XG5cbi8vIFJ1biB0aGUgZ2l2ZW4gZnVuY3Rpb24gaW4gYW4gb3BlcmF0aW9uXG5mdW5jdGlvbiBydW5Jbk9wKGNtLCBmKSB7XG4gIGlmIChjbS5jdXJPcCkgeyByZXR1cm4gZigpIH1cbiAgc3RhcnRPcGVyYXRpb24oY20pO1xuICB0cnkgeyByZXR1cm4gZigpIH1cbiAgZmluYWxseSB7IGVuZE9wZXJhdGlvbihjbSk7IH1cbn1cbi8vIFdyYXBzIGEgZnVuY3Rpb24gaW4gYW4gb3BlcmF0aW9uLiBSZXR1cm5zIHRoZSB3cmFwcGVkIGZ1bmN0aW9uLlxuZnVuY3Rpb24gb3BlcmF0aW9uKGNtLCBmKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBpZiAoY20uY3VyT3ApIHsgcmV0dXJuIGYuYXBwbHkoY20sIGFyZ3VtZW50cykgfVxuICAgIHN0YXJ0T3BlcmF0aW9uKGNtKTtcbiAgICB0cnkgeyByZXR1cm4gZi5hcHBseShjbSwgYXJndW1lbnRzKSB9XG4gICAgZmluYWxseSB7IGVuZE9wZXJhdGlvbihjbSk7IH1cbiAgfVxufVxuLy8gVXNlZCB0byBhZGQgbWV0aG9kcyB0byBlZGl0b3IgYW5kIGRvYyBpbnN0YW5jZXMsIHdyYXBwaW5nIHRoZW0gaW5cbi8vIG9wZXJhdGlvbnMuXG5mdW5jdGlvbiBtZXRob2RPcChmKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5jdXJPcCkgeyByZXR1cm4gZi5hcHBseSh0aGlzLCBhcmd1bWVudHMpIH1cbiAgICBzdGFydE9wZXJhdGlvbih0aGlzKTtcbiAgICB0cnkgeyByZXR1cm4gZi5hcHBseSh0aGlzLCBhcmd1bWVudHMpIH1cbiAgICBmaW5hbGx5IHsgZW5kT3BlcmF0aW9uKHRoaXMpOyB9XG4gIH1cbn1cbmZ1bmN0aW9uIGRvY01ldGhvZE9wKGYpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHZhciBjbSA9IHRoaXMuY207XG4gICAgaWYgKCFjbSB8fCBjbS5jdXJPcCkgeyByZXR1cm4gZi5hcHBseSh0aGlzLCBhcmd1bWVudHMpIH1cbiAgICBzdGFydE9wZXJhdGlvbihjbSk7XG4gICAgdHJ5IHsgcmV0dXJuIGYuYXBwbHkodGhpcywgYXJndW1lbnRzKSB9XG4gICAgZmluYWxseSB7IGVuZE9wZXJhdGlvbihjbSk7IH1cbiAgfVxufVxuXG4vLyBVcGRhdGVzIHRoZSBkaXNwbGF5LnZpZXcgZGF0YSBzdHJ1Y3R1cmUgZm9yIGEgZ2l2ZW4gY2hhbmdlIHRvIHRoZVxuLy8gZG9jdW1lbnQuIEZyb20gYW5kIHRvIGFyZSBpbiBwcmUtY2hhbmdlIGNvb3JkaW5hdGVzLiBMZW5kaWZmIGlzXG4vLyB0aGUgYW1vdW50IG9mIGxpbmVzIGFkZGVkIG9yIHN1YnRyYWN0ZWQgYnkgdGhlIGNoYW5nZS4gVGhpcyBpc1xuLy8gdXNlZCBmb3IgY2hhbmdlcyB0aGF0IHNwYW4gbXVsdGlwbGUgbGluZXMsIG9yIGNoYW5nZSB0aGUgd2F5XG4vLyBsaW5lcyBhcmUgZGl2aWRlZCBpbnRvIHZpc3VhbCBsaW5lcy4gcmVnTGluZUNoYW5nZSAoYmVsb3cpXG4vLyByZWdpc3RlcnMgc2luZ2xlLWxpbmUgY2hhbmdlcy5cbmZ1bmN0aW9uIHJlZ0NoYW5nZShjbSwgZnJvbSwgdG8sIGxlbmRpZmYpIHtcbiAgaWYgKGZyb20gPT0gbnVsbCkgeyBmcm9tID0gY20uZG9jLmZpcnN0OyB9XG4gIGlmICh0byA9PSBudWxsKSB7IHRvID0gY20uZG9jLmZpcnN0ICsgY20uZG9jLnNpemU7IH1cbiAgaWYgKCFsZW5kaWZmKSB7IGxlbmRpZmYgPSAwOyB9XG5cbiAgdmFyIGRpc3BsYXkgPSBjbS5kaXNwbGF5O1xuICBpZiAobGVuZGlmZiAmJiB0byA8IGRpc3BsYXkudmlld1RvICYmXG4gICAgICAoZGlzcGxheS51cGRhdGVMaW5lTnVtYmVycyA9PSBudWxsIHx8IGRpc3BsYXkudXBkYXRlTGluZU51bWJlcnMgPiBmcm9tKSlcbiAgICB7IGRpc3BsYXkudXBkYXRlTGluZU51bWJlcnMgPSBmcm9tOyB9XG5cbiAgY20uY3VyT3Audmlld0NoYW5nZWQgPSB0cnVlO1xuXG4gIGlmIChmcm9tID49IGRpc3BsYXkudmlld1RvKSB7IC8vIENoYW5nZSBhZnRlclxuICAgIGlmIChzYXdDb2xsYXBzZWRTcGFucyAmJiB2aXN1YWxMaW5lTm8oY20uZG9jLCBmcm9tKSA8IGRpc3BsYXkudmlld1RvKVxuICAgICAgeyByZXNldFZpZXcoY20pOyB9XG4gIH0gZWxzZSBpZiAodG8gPD0gZGlzcGxheS52aWV3RnJvbSkgeyAvLyBDaGFuZ2UgYmVmb3JlXG4gICAgaWYgKHNhd0NvbGxhcHNlZFNwYW5zICYmIHZpc3VhbExpbmVFbmRObyhjbS5kb2MsIHRvICsgbGVuZGlmZikgPiBkaXNwbGF5LnZpZXdGcm9tKSB7XG4gICAgICByZXNldFZpZXcoY20pO1xuICAgIH0gZWxzZSB7XG4gICAgICBkaXNwbGF5LnZpZXdGcm9tICs9IGxlbmRpZmY7XG4gICAgICBkaXNwbGF5LnZpZXdUbyArPSBsZW5kaWZmO1xuICAgIH1cbiAgfSBlbHNlIGlmIChmcm9tIDw9IGRpc3BsYXkudmlld0Zyb20gJiYgdG8gPj0gZGlzcGxheS52aWV3VG8pIHsgLy8gRnVsbCBvdmVybGFwXG4gICAgcmVzZXRWaWV3KGNtKTtcbiAgfSBlbHNlIGlmIChmcm9tIDw9IGRpc3BsYXkudmlld0Zyb20pIHsgLy8gVG9wIG92ZXJsYXBcbiAgICB2YXIgY3V0ID0gdmlld0N1dHRpbmdQb2ludChjbSwgdG8sIHRvICsgbGVuZGlmZiwgMSk7XG4gICAgaWYgKGN1dCkge1xuICAgICAgZGlzcGxheS52aWV3ID0gZGlzcGxheS52aWV3LnNsaWNlKGN1dC5pbmRleCk7XG4gICAgICBkaXNwbGF5LnZpZXdGcm9tID0gY3V0LmxpbmVOO1xuICAgICAgZGlzcGxheS52aWV3VG8gKz0gbGVuZGlmZjtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzZXRWaWV3KGNtKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAodG8gPj0gZGlzcGxheS52aWV3VG8pIHsgLy8gQm90dG9tIG92ZXJsYXBcbiAgICB2YXIgY3V0JDEgPSB2aWV3Q3V0dGluZ1BvaW50KGNtLCBmcm9tLCBmcm9tLCAtMSk7XG4gICAgaWYgKGN1dCQxKSB7XG4gICAgICBkaXNwbGF5LnZpZXcgPSBkaXNwbGF5LnZpZXcuc2xpY2UoMCwgY3V0JDEuaW5kZXgpO1xuICAgICAgZGlzcGxheS52aWV3VG8gPSBjdXQkMS5saW5lTjtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzZXRWaWV3KGNtKTtcbiAgICB9XG4gIH0gZWxzZSB7IC8vIEdhcCBpbiB0aGUgbWlkZGxlXG4gICAgdmFyIGN1dFRvcCA9IHZpZXdDdXR0aW5nUG9pbnQoY20sIGZyb20sIGZyb20sIC0xKTtcbiAgICB2YXIgY3V0Qm90ID0gdmlld0N1dHRpbmdQb2ludChjbSwgdG8sIHRvICsgbGVuZGlmZiwgMSk7XG4gICAgaWYgKGN1dFRvcCAmJiBjdXRCb3QpIHtcbiAgICAgIGRpc3BsYXkudmlldyA9IGRpc3BsYXkudmlldy5zbGljZSgwLCBjdXRUb3AuaW5kZXgpXG4gICAgICAgIC5jb25jYXQoYnVpbGRWaWV3QXJyYXkoY20sIGN1dFRvcC5saW5lTiwgY3V0Qm90LmxpbmVOKSlcbiAgICAgICAgLmNvbmNhdChkaXNwbGF5LnZpZXcuc2xpY2UoY3V0Qm90LmluZGV4KSk7XG4gICAgICBkaXNwbGF5LnZpZXdUbyArPSBsZW5kaWZmO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXNldFZpZXcoY20pO1xuICAgIH1cbiAgfVxuXG4gIHZhciBleHQgPSBkaXNwbGF5LmV4dGVybmFsTWVhc3VyZWQ7XG4gIGlmIChleHQpIHtcbiAgICBpZiAodG8gPCBleHQubGluZU4pXG4gICAgICB7IGV4dC5saW5lTiArPSBsZW5kaWZmOyB9XG4gICAgZWxzZSBpZiAoZnJvbSA8IGV4dC5saW5lTiArIGV4dC5zaXplKVxuICAgICAgeyBkaXNwbGF5LmV4dGVybmFsTWVhc3VyZWQgPSBudWxsOyB9XG4gIH1cbn1cblxuLy8gUmVnaXN0ZXIgYSBjaGFuZ2UgdG8gYSBzaW5nbGUgbGluZS4gVHlwZSBtdXN0IGJlIG9uZSBvZiBcInRleHRcIixcbi8vIFwiZ3V0dGVyXCIsIFwiY2xhc3NcIiwgXCJ3aWRnZXRcIlxuZnVuY3Rpb24gcmVnTGluZUNoYW5nZShjbSwgbGluZSwgdHlwZSkge1xuICBjbS5jdXJPcC52aWV3Q2hhbmdlZCA9IHRydWU7XG4gIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheSwgZXh0ID0gY20uZGlzcGxheS5leHRlcm5hbE1lYXN1cmVkO1xuICBpZiAoZXh0ICYmIGxpbmUgPj0gZXh0LmxpbmVOICYmIGxpbmUgPCBleHQubGluZU4gKyBleHQuc2l6ZSlcbiAgICB7IGRpc3BsYXkuZXh0ZXJuYWxNZWFzdXJlZCA9IG51bGw7IH1cblxuICBpZiAobGluZSA8IGRpc3BsYXkudmlld0Zyb20gfHwgbGluZSA+PSBkaXNwbGF5LnZpZXdUbykgeyByZXR1cm4gfVxuICB2YXIgbGluZVZpZXcgPSBkaXNwbGF5LnZpZXdbZmluZFZpZXdJbmRleChjbSwgbGluZSldO1xuICBpZiAobGluZVZpZXcubm9kZSA9PSBudWxsKSB7IHJldHVybiB9XG4gIHZhciBhcnIgPSBsaW5lVmlldy5jaGFuZ2VzIHx8IChsaW5lVmlldy5jaGFuZ2VzID0gW10pO1xuICBpZiAoaW5kZXhPZihhcnIsIHR5cGUpID09IC0xKSB7IGFyci5wdXNoKHR5cGUpOyB9XG59XG5cbi8vIENsZWFyIHRoZSB2aWV3LlxuZnVuY3Rpb24gcmVzZXRWaWV3KGNtKSB7XG4gIGNtLmRpc3BsYXkudmlld0Zyb20gPSBjbS5kaXNwbGF5LnZpZXdUbyA9IGNtLmRvYy5maXJzdDtcbiAgY20uZGlzcGxheS52aWV3ID0gW107XG4gIGNtLmRpc3BsYXkudmlld09mZnNldCA9IDA7XG59XG5cbmZ1bmN0aW9uIHZpZXdDdXR0aW5nUG9pbnQoY20sIG9sZE4sIG5ld04sIGRpcikge1xuICB2YXIgaW5kZXggPSBmaW5kVmlld0luZGV4KGNtLCBvbGROKSwgZGlmZiwgdmlldyA9IGNtLmRpc3BsYXkudmlldztcbiAgaWYgKCFzYXdDb2xsYXBzZWRTcGFucyB8fCBuZXdOID09IGNtLmRvYy5maXJzdCArIGNtLmRvYy5zaXplKVxuICAgIHsgcmV0dXJuIHtpbmRleDogaW5kZXgsIGxpbmVOOiBuZXdOfSB9XG4gIHZhciBuID0gY20uZGlzcGxheS52aWV3RnJvbTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbmRleDsgaSsrKVxuICAgIHsgbiArPSB2aWV3W2ldLnNpemU7IH1cbiAgaWYgKG4gIT0gb2xkTikge1xuICAgIGlmIChkaXIgPiAwKSB7XG4gICAgICBpZiAoaW5kZXggPT0gdmlldy5sZW5ndGggLSAxKSB7IHJldHVybiBudWxsIH1cbiAgICAgIGRpZmYgPSAobiArIHZpZXdbaW5kZXhdLnNpemUpIC0gb2xkTjtcbiAgICAgIGluZGV4Kys7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRpZmYgPSBuIC0gb2xkTjtcbiAgICB9XG4gICAgb2xkTiArPSBkaWZmOyBuZXdOICs9IGRpZmY7XG4gIH1cbiAgd2hpbGUgKHZpc3VhbExpbmVObyhjbS5kb2MsIG5ld04pICE9IG5ld04pIHtcbiAgICBpZiAoaW5kZXggPT0gKGRpciA8IDAgPyAwIDogdmlldy5sZW5ndGggLSAxKSkgeyByZXR1cm4gbnVsbCB9XG4gICAgbmV3TiArPSBkaXIgKiB2aWV3W2luZGV4IC0gKGRpciA8IDAgPyAxIDogMCldLnNpemU7XG4gICAgaW5kZXggKz0gZGlyO1xuICB9XG4gIHJldHVybiB7aW5kZXg6IGluZGV4LCBsaW5lTjogbmV3Tn1cbn1cblxuLy8gRm9yY2UgdGhlIHZpZXcgdG8gY292ZXIgYSBnaXZlbiByYW5nZSwgYWRkaW5nIGVtcHR5IHZpZXcgZWxlbWVudFxuLy8gb3IgY2xpcHBpbmcgb2ZmIGV4aXN0aW5nIG9uZXMgYXMgbmVlZGVkLlxuZnVuY3Rpb24gYWRqdXN0VmlldyhjbSwgZnJvbSwgdG8pIHtcbiAgdmFyIGRpc3BsYXkgPSBjbS5kaXNwbGF5LCB2aWV3ID0gZGlzcGxheS52aWV3O1xuICBpZiAodmlldy5sZW5ndGggPT0gMCB8fCBmcm9tID49IGRpc3BsYXkudmlld1RvIHx8IHRvIDw9IGRpc3BsYXkudmlld0Zyb20pIHtcbiAgICBkaXNwbGF5LnZpZXcgPSBidWlsZFZpZXdBcnJheShjbSwgZnJvbSwgdG8pO1xuICAgIGRpc3BsYXkudmlld0Zyb20gPSBmcm9tO1xuICB9IGVsc2Uge1xuICAgIGlmIChkaXNwbGF5LnZpZXdGcm9tID4gZnJvbSlcbiAgICAgIHsgZGlzcGxheS52aWV3ID0gYnVpbGRWaWV3QXJyYXkoY20sIGZyb20sIGRpc3BsYXkudmlld0Zyb20pLmNvbmNhdChkaXNwbGF5LnZpZXcpOyB9XG4gICAgZWxzZSBpZiAoZGlzcGxheS52aWV3RnJvbSA8IGZyb20pXG4gICAgICB7IGRpc3BsYXkudmlldyA9IGRpc3BsYXkudmlldy5zbGljZShmaW5kVmlld0luZGV4KGNtLCBmcm9tKSk7IH1cbiAgICBkaXNwbGF5LnZpZXdGcm9tID0gZnJvbTtcbiAgICBpZiAoZGlzcGxheS52aWV3VG8gPCB0bylcbiAgICAgIHsgZGlzcGxheS52aWV3ID0gZGlzcGxheS52aWV3LmNvbmNhdChidWlsZFZpZXdBcnJheShjbSwgZGlzcGxheS52aWV3VG8sIHRvKSk7IH1cbiAgICBlbHNlIGlmIChkaXNwbGF5LnZpZXdUbyA+IHRvKVxuICAgICAgeyBkaXNwbGF5LnZpZXcgPSBkaXNwbGF5LnZpZXcuc2xpY2UoMCwgZmluZFZpZXdJbmRleChjbSwgdG8pKTsgfVxuICB9XG4gIGRpc3BsYXkudmlld1RvID0gdG87XG59XG5cbi8vIENvdW50IHRoZSBudW1iZXIgb2YgbGluZXMgaW4gdGhlIHZpZXcgd2hvc2UgRE9NIHJlcHJlc2VudGF0aW9uIGlzXG4vLyBvdXQgb2YgZGF0ZSAob3Igbm9uZXhpc3RlbnQpLlxuZnVuY3Rpb24gY291bnREaXJ0eVZpZXcoY20pIHtcbiAgdmFyIHZpZXcgPSBjbS5kaXNwbGF5LnZpZXcsIGRpcnR5ID0gMDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB2aWV3Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGxpbmVWaWV3ID0gdmlld1tpXTtcbiAgICBpZiAoIWxpbmVWaWV3LmhpZGRlbiAmJiAoIWxpbmVWaWV3Lm5vZGUgfHwgbGluZVZpZXcuY2hhbmdlcykpIHsgKytkaXJ0eTsgfVxuICB9XG4gIHJldHVybiBkaXJ0eVxufVxuXG4vLyBISUdITElHSFQgV09SS0VSXG5cbmZ1bmN0aW9uIHN0YXJ0V29ya2VyKGNtLCB0aW1lKSB7XG4gIGlmIChjbS5kb2MuaGlnaGxpZ2h0RnJvbnRpZXIgPCBjbS5kaXNwbGF5LnZpZXdUbylcbiAgICB7IGNtLnN0YXRlLmhpZ2hsaWdodC5zZXQodGltZSwgYmluZChoaWdobGlnaHRXb3JrZXIsIGNtKSk7IH1cbn1cblxuZnVuY3Rpb24gaGlnaGxpZ2h0V29ya2VyKGNtKSB7XG4gIHZhciBkb2MgPSBjbS5kb2M7XG4gIGlmIChkb2MuaGlnaGxpZ2h0RnJvbnRpZXIgPj0gY20uZGlzcGxheS52aWV3VG8pIHsgcmV0dXJuIH1cbiAgdmFyIGVuZCA9ICtuZXcgRGF0ZSArIGNtLm9wdGlvbnMud29ya1RpbWU7XG4gIHZhciBjb250ZXh0ID0gZ2V0Q29udGV4dEJlZm9yZShjbSwgZG9jLmhpZ2hsaWdodEZyb250aWVyKTtcbiAgdmFyIGNoYW5nZWRMaW5lcyA9IFtdO1xuXG4gIGRvYy5pdGVyKGNvbnRleHQubGluZSwgTWF0aC5taW4oZG9jLmZpcnN0ICsgZG9jLnNpemUsIGNtLmRpc3BsYXkudmlld1RvICsgNTAwKSwgZnVuY3Rpb24gKGxpbmUpIHtcbiAgICBpZiAoY29udGV4dC5saW5lID49IGNtLmRpc3BsYXkudmlld0Zyb20pIHsgLy8gVmlzaWJsZVxuICAgICAgdmFyIG9sZFN0eWxlcyA9IGxpbmUuc3R5bGVzO1xuICAgICAgdmFyIHJlc2V0U3RhdGUgPSBsaW5lLnRleHQubGVuZ3RoID4gY20ub3B0aW9ucy5tYXhIaWdobGlnaHRMZW5ndGggPyBjb3B5U3RhdGUoZG9jLm1vZGUsIGNvbnRleHQuc3RhdGUpIDogbnVsbDtcbiAgICAgIHZhciBoaWdobGlnaHRlZCA9IGhpZ2hsaWdodExpbmUoY20sIGxpbmUsIGNvbnRleHQsIHRydWUpO1xuICAgICAgaWYgKHJlc2V0U3RhdGUpIHsgY29udGV4dC5zdGF0ZSA9IHJlc2V0U3RhdGU7IH1cbiAgICAgIGxpbmUuc3R5bGVzID0gaGlnaGxpZ2h0ZWQuc3R5bGVzO1xuICAgICAgdmFyIG9sZENscyA9IGxpbmUuc3R5bGVDbGFzc2VzLCBuZXdDbHMgPSBoaWdobGlnaHRlZC5jbGFzc2VzO1xuICAgICAgaWYgKG5ld0NscykgeyBsaW5lLnN0eWxlQ2xhc3NlcyA9IG5ld0NsczsgfVxuICAgICAgZWxzZSBpZiAob2xkQ2xzKSB7IGxpbmUuc3R5bGVDbGFzc2VzID0gbnVsbDsgfVxuICAgICAgdmFyIGlzY2hhbmdlID0gIW9sZFN0eWxlcyB8fCBvbGRTdHlsZXMubGVuZ3RoICE9IGxpbmUuc3R5bGVzLmxlbmd0aCB8fFxuICAgICAgICBvbGRDbHMgIT0gbmV3Q2xzICYmICghb2xkQ2xzIHx8ICFuZXdDbHMgfHwgb2xkQ2xzLmJnQ2xhc3MgIT0gbmV3Q2xzLmJnQ2xhc3MgfHwgb2xkQ2xzLnRleHRDbGFzcyAhPSBuZXdDbHMudGV4dENsYXNzKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyAhaXNjaGFuZ2UgJiYgaSA8IG9sZFN0eWxlcy5sZW5ndGg7ICsraSkgeyBpc2NoYW5nZSA9IG9sZFN0eWxlc1tpXSAhPSBsaW5lLnN0eWxlc1tpXTsgfVxuICAgICAgaWYgKGlzY2hhbmdlKSB7IGNoYW5nZWRMaW5lcy5wdXNoKGNvbnRleHQubGluZSk7IH1cbiAgICAgIGxpbmUuc3RhdGVBZnRlciA9IGNvbnRleHQuc2F2ZSgpO1xuICAgICAgY29udGV4dC5uZXh0TGluZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAobGluZS50ZXh0Lmxlbmd0aCA8PSBjbS5vcHRpb25zLm1heEhpZ2hsaWdodExlbmd0aClcbiAgICAgICAgeyBwcm9jZXNzTGluZShjbSwgbGluZS50ZXh0LCBjb250ZXh0KTsgfVxuICAgICAgbGluZS5zdGF0ZUFmdGVyID0gY29udGV4dC5saW5lICUgNSA9PSAwID8gY29udGV4dC5zYXZlKCkgOiBudWxsO1xuICAgICAgY29udGV4dC5uZXh0TGluZSgpO1xuICAgIH1cbiAgICBpZiAoK25ldyBEYXRlID4gZW5kKSB7XG4gICAgICBzdGFydFdvcmtlcihjbSwgY20ub3B0aW9ucy53b3JrRGVsYXkpO1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH0pO1xuICBkb2MuaGlnaGxpZ2h0RnJvbnRpZXIgPSBjb250ZXh0LmxpbmU7XG4gIGRvYy5tb2RlRnJvbnRpZXIgPSBNYXRoLm1heChkb2MubW9kZUZyb250aWVyLCBjb250ZXh0LmxpbmUpO1xuICBpZiAoY2hhbmdlZExpbmVzLmxlbmd0aCkgeyBydW5Jbk9wKGNtLCBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VkTGluZXMubGVuZ3RoOyBpKyspXG4gICAgICB7IHJlZ0xpbmVDaGFuZ2UoY20sIGNoYW5nZWRMaW5lc1tpXSwgXCJ0ZXh0XCIpOyB9XG4gIH0pOyB9XG59XG5cbi8vIERJU1BMQVkgRFJBV0lOR1xuXG52YXIgRGlzcGxheVVwZGF0ZSA9IGZ1bmN0aW9uKGNtLCB2aWV3cG9ydCwgZm9yY2UpIHtcbiAgdmFyIGRpc3BsYXkgPSBjbS5kaXNwbGF5O1xuXG4gIHRoaXMudmlld3BvcnQgPSB2aWV3cG9ydDtcbiAgLy8gU3RvcmUgc29tZSB2YWx1ZXMgdGhhdCB3ZSdsbCBuZWVkIGxhdGVyIChidXQgZG9uJ3Qgd2FudCB0byBmb3JjZSBhIHJlbGF5b3V0IGZvcilcbiAgdGhpcy52aXNpYmxlID0gdmlzaWJsZUxpbmVzKGRpc3BsYXksIGNtLmRvYywgdmlld3BvcnQpO1xuICB0aGlzLmVkaXRvcklzSGlkZGVuID0gIWRpc3BsYXkud3JhcHBlci5vZmZzZXRXaWR0aDtcbiAgdGhpcy53cmFwcGVySGVpZ2h0ID0gZGlzcGxheS53cmFwcGVyLmNsaWVudEhlaWdodDtcbiAgdGhpcy53cmFwcGVyV2lkdGggPSBkaXNwbGF5LndyYXBwZXIuY2xpZW50V2lkdGg7XG4gIHRoaXMub2xkRGlzcGxheVdpZHRoID0gZGlzcGxheVdpZHRoKGNtKTtcbiAgdGhpcy5mb3JjZSA9IGZvcmNlO1xuICB0aGlzLmRpbXMgPSBnZXREaW1lbnNpb25zKGNtKTtcbiAgdGhpcy5ldmVudHMgPSBbXTtcbn07XG5cbkRpc3BsYXlVcGRhdGUucHJvdG90eXBlLnNpZ25hbCA9IGZ1bmN0aW9uIChlbWl0dGVyLCB0eXBlKSB7XG4gIGlmIChoYXNIYW5kbGVyKGVtaXR0ZXIsIHR5cGUpKVxuICAgIHsgdGhpcy5ldmVudHMucHVzaChhcmd1bWVudHMpOyB9XG59O1xuRGlzcGxheVVwZGF0ZS5wcm90b3R5cGUuZmluaXNoID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5ldmVudHMubGVuZ3RoOyBpKyspXG4gICAgeyBzaWduYWwuYXBwbHkobnVsbCwgdGhpcyQxLmV2ZW50c1tpXSk7IH1cbn07XG5cbmZ1bmN0aW9uIG1heWJlQ2xpcFNjcm9sbGJhcnMoY20pIHtcbiAgdmFyIGRpc3BsYXkgPSBjbS5kaXNwbGF5O1xuICBpZiAoIWRpc3BsYXkuc2Nyb2xsYmFyc0NsaXBwZWQgJiYgZGlzcGxheS5zY3JvbGxlci5vZmZzZXRXaWR0aCkge1xuICAgIGRpc3BsYXkubmF0aXZlQmFyV2lkdGggPSBkaXNwbGF5LnNjcm9sbGVyLm9mZnNldFdpZHRoIC0gZGlzcGxheS5zY3JvbGxlci5jbGllbnRXaWR0aDtcbiAgICBkaXNwbGF5LmhlaWdodEZvcmNlci5zdHlsZS5oZWlnaHQgPSBzY3JvbGxHYXAoY20pICsgXCJweFwiO1xuICAgIGRpc3BsYXkuc2l6ZXIuc3R5bGUubWFyZ2luQm90dG9tID0gLWRpc3BsYXkubmF0aXZlQmFyV2lkdGggKyBcInB4XCI7XG4gICAgZGlzcGxheS5zaXplci5zdHlsZS5ib3JkZXJSaWdodFdpZHRoID0gc2Nyb2xsR2FwKGNtKSArIFwicHhcIjtcbiAgICBkaXNwbGF5LnNjcm9sbGJhcnNDbGlwcGVkID0gdHJ1ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzZWxlY3Rpb25TbmFwc2hvdChjbSkge1xuICBpZiAoY20uaGFzRm9jdXMoKSkgeyByZXR1cm4gbnVsbCB9XG4gIHZhciBhY3RpdmUgPSBhY3RpdmVFbHQoKTtcbiAgaWYgKCFhY3RpdmUgfHwgIWNvbnRhaW5zKGNtLmRpc3BsYXkubGluZURpdiwgYWN0aXZlKSkgeyByZXR1cm4gbnVsbCB9XG4gIHZhciByZXN1bHQgPSB7YWN0aXZlRWx0OiBhY3RpdmV9O1xuICBpZiAod2luZG93LmdldFNlbGVjdGlvbikge1xuICAgIHZhciBzZWwgPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7XG4gICAgaWYgKHNlbC5hbmNob3JOb2RlICYmIHNlbC5leHRlbmQgJiYgY29udGFpbnMoY20uZGlzcGxheS5saW5lRGl2LCBzZWwuYW5jaG9yTm9kZSkpIHtcbiAgICAgIHJlc3VsdC5hbmNob3JOb2RlID0gc2VsLmFuY2hvck5vZGU7XG4gICAgICByZXN1bHQuYW5jaG9yT2Zmc2V0ID0gc2VsLmFuY2hvck9mZnNldDtcbiAgICAgIHJlc3VsdC5mb2N1c05vZGUgPSBzZWwuZm9jdXNOb2RlO1xuICAgICAgcmVzdWx0LmZvY3VzT2Zmc2V0ID0gc2VsLmZvY3VzT2Zmc2V0O1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG5cbmZ1bmN0aW9uIHJlc3RvcmVTZWxlY3Rpb24oc25hcHNob3QpIHtcbiAgaWYgKCFzbmFwc2hvdCB8fCAhc25hcHNob3QuYWN0aXZlRWx0IHx8IHNuYXBzaG90LmFjdGl2ZUVsdCA9PSBhY3RpdmVFbHQoKSkgeyByZXR1cm4gfVxuICBzbmFwc2hvdC5hY3RpdmVFbHQuZm9jdXMoKTtcbiAgaWYgKHNuYXBzaG90LmFuY2hvck5vZGUgJiYgY29udGFpbnMoZG9jdW1lbnQuYm9keSwgc25hcHNob3QuYW5jaG9yTm9kZSkgJiYgY29udGFpbnMoZG9jdW1lbnQuYm9keSwgc25hcHNob3QuZm9jdXNOb2RlKSkge1xuICAgIHZhciBzZWwgPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCksIHJhbmdlJCQxID0gZG9jdW1lbnQuY3JlYXRlUmFuZ2UoKTtcbiAgICByYW5nZSQkMS5zZXRFbmQoc25hcHNob3QuYW5jaG9yTm9kZSwgc25hcHNob3QuYW5jaG9yT2Zmc2V0KTtcbiAgICByYW5nZSQkMS5jb2xsYXBzZShmYWxzZSk7XG4gICAgc2VsLnJlbW92ZUFsbFJhbmdlcygpO1xuICAgIHNlbC5hZGRSYW5nZShyYW5nZSQkMSk7XG4gICAgc2VsLmV4dGVuZChzbmFwc2hvdC5mb2N1c05vZGUsIHNuYXBzaG90LmZvY3VzT2Zmc2V0KTtcbiAgfVxufVxuXG4vLyBEb2VzIHRoZSBhY3R1YWwgdXBkYXRpbmcgb2YgdGhlIGxpbmUgZGlzcGxheS4gQmFpbHMgb3V0XG4vLyAocmV0dXJuaW5nIGZhbHNlKSB3aGVuIHRoZXJlIGlzIG5vdGhpbmcgdG8gYmUgZG9uZSBhbmQgZm9yY2VkIGlzXG4vLyBmYWxzZS5cbmZ1bmN0aW9uIHVwZGF0ZURpc3BsYXlJZk5lZWRlZChjbSwgdXBkYXRlKSB7XG4gIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheSwgZG9jID0gY20uZG9jO1xuXG4gIGlmICh1cGRhdGUuZWRpdG9ySXNIaWRkZW4pIHtcbiAgICByZXNldFZpZXcoY20pO1xuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgLy8gQmFpbCBvdXQgaWYgdGhlIHZpc2libGUgYXJlYSBpcyBhbHJlYWR5IHJlbmRlcmVkIGFuZCBub3RoaW5nIGNoYW5nZWQuXG4gIGlmICghdXBkYXRlLmZvcmNlICYmXG4gICAgICB1cGRhdGUudmlzaWJsZS5mcm9tID49IGRpc3BsYXkudmlld0Zyb20gJiYgdXBkYXRlLnZpc2libGUudG8gPD0gZGlzcGxheS52aWV3VG8gJiZcbiAgICAgIChkaXNwbGF5LnVwZGF0ZUxpbmVOdW1iZXJzID09IG51bGwgfHwgZGlzcGxheS51cGRhdGVMaW5lTnVtYmVycyA+PSBkaXNwbGF5LnZpZXdUbykgJiZcbiAgICAgIGRpc3BsYXkucmVuZGVyZWRWaWV3ID09IGRpc3BsYXkudmlldyAmJiBjb3VudERpcnR5VmlldyhjbSkgPT0gMClcbiAgICB7IHJldHVybiBmYWxzZSB9XG5cbiAgaWYgKG1heWJlVXBkYXRlTGluZU51bWJlcldpZHRoKGNtKSkge1xuICAgIHJlc2V0VmlldyhjbSk7XG4gICAgdXBkYXRlLmRpbXMgPSBnZXREaW1lbnNpb25zKGNtKTtcbiAgfVxuXG4gIC8vIENvbXB1dGUgYSBzdWl0YWJsZSBuZXcgdmlld3BvcnQgKGZyb20gJiB0bylcbiAgdmFyIGVuZCA9IGRvYy5maXJzdCArIGRvYy5zaXplO1xuICB2YXIgZnJvbSA9IE1hdGgubWF4KHVwZGF0ZS52aXNpYmxlLmZyb20gLSBjbS5vcHRpb25zLnZpZXdwb3J0TWFyZ2luLCBkb2MuZmlyc3QpO1xuICB2YXIgdG8gPSBNYXRoLm1pbihlbmQsIHVwZGF0ZS52aXNpYmxlLnRvICsgY20ub3B0aW9ucy52aWV3cG9ydE1hcmdpbik7XG4gIGlmIChkaXNwbGF5LnZpZXdGcm9tIDwgZnJvbSAmJiBmcm9tIC0gZGlzcGxheS52aWV3RnJvbSA8IDIwKSB7IGZyb20gPSBNYXRoLm1heChkb2MuZmlyc3QsIGRpc3BsYXkudmlld0Zyb20pOyB9XG4gIGlmIChkaXNwbGF5LnZpZXdUbyA+IHRvICYmIGRpc3BsYXkudmlld1RvIC0gdG8gPCAyMCkgeyB0byA9IE1hdGgubWluKGVuZCwgZGlzcGxheS52aWV3VG8pOyB9XG4gIGlmIChzYXdDb2xsYXBzZWRTcGFucykge1xuICAgIGZyb20gPSB2aXN1YWxMaW5lTm8oY20uZG9jLCBmcm9tKTtcbiAgICB0byA9IHZpc3VhbExpbmVFbmRObyhjbS5kb2MsIHRvKTtcbiAgfVxuXG4gIHZhciBkaWZmZXJlbnQgPSBmcm9tICE9IGRpc3BsYXkudmlld0Zyb20gfHwgdG8gIT0gZGlzcGxheS52aWV3VG8gfHxcbiAgICBkaXNwbGF5Lmxhc3RXcmFwSGVpZ2h0ICE9IHVwZGF0ZS53cmFwcGVySGVpZ2h0IHx8IGRpc3BsYXkubGFzdFdyYXBXaWR0aCAhPSB1cGRhdGUud3JhcHBlcldpZHRoO1xuICBhZGp1c3RWaWV3KGNtLCBmcm9tLCB0byk7XG5cbiAgZGlzcGxheS52aWV3T2Zmc2V0ID0gaGVpZ2h0QXRMaW5lKGdldExpbmUoY20uZG9jLCBkaXNwbGF5LnZpZXdGcm9tKSk7XG4gIC8vIFBvc2l0aW9uIHRoZSBtb3ZlciBkaXYgdG8gYWxpZ24gd2l0aCB0aGUgY3VycmVudCBzY3JvbGwgcG9zaXRpb25cbiAgY20uZGlzcGxheS5tb3Zlci5zdHlsZS50b3AgPSBkaXNwbGF5LnZpZXdPZmZzZXQgKyBcInB4XCI7XG5cbiAgdmFyIHRvVXBkYXRlID0gY291bnREaXJ0eVZpZXcoY20pO1xuICBpZiAoIWRpZmZlcmVudCAmJiB0b1VwZGF0ZSA9PSAwICYmICF1cGRhdGUuZm9yY2UgJiYgZGlzcGxheS5yZW5kZXJlZFZpZXcgPT0gZGlzcGxheS52aWV3ICYmXG4gICAgICAoZGlzcGxheS51cGRhdGVMaW5lTnVtYmVycyA9PSBudWxsIHx8IGRpc3BsYXkudXBkYXRlTGluZU51bWJlcnMgPj0gZGlzcGxheS52aWV3VG8pKVxuICAgIHsgcmV0dXJuIGZhbHNlIH1cblxuICAvLyBGb3IgYmlnIGNoYW5nZXMsIHdlIGhpZGUgdGhlIGVuY2xvc2luZyBlbGVtZW50IGR1cmluZyB0aGVcbiAgLy8gdXBkYXRlLCBzaW5jZSB0aGF0IHNwZWVkcyB1cCB0aGUgb3BlcmF0aW9ucyBvbiBtb3N0IGJyb3dzZXJzLlxuICB2YXIgc2VsU25hcHNob3QgPSBzZWxlY3Rpb25TbmFwc2hvdChjbSk7XG4gIGlmICh0b1VwZGF0ZSA+IDQpIHsgZGlzcGxheS5saW5lRGl2LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjsgfVxuICBwYXRjaERpc3BsYXkoY20sIGRpc3BsYXkudXBkYXRlTGluZU51bWJlcnMsIHVwZGF0ZS5kaW1zKTtcbiAgaWYgKHRvVXBkYXRlID4gNCkgeyBkaXNwbGF5LmxpbmVEaXYuc3R5bGUuZGlzcGxheSA9IFwiXCI7IH1cbiAgZGlzcGxheS5yZW5kZXJlZFZpZXcgPSBkaXNwbGF5LnZpZXc7XG4gIC8vIFRoZXJlIG1pZ2h0IGhhdmUgYmVlbiBhIHdpZGdldCB3aXRoIGEgZm9jdXNlZCBlbGVtZW50IHRoYXQgZ290XG4gIC8vIGhpZGRlbiBvciB1cGRhdGVkLCBpZiBzbyByZS1mb2N1cyBpdC5cbiAgcmVzdG9yZVNlbGVjdGlvbihzZWxTbmFwc2hvdCk7XG5cbiAgLy8gUHJldmVudCBzZWxlY3Rpb24gYW5kIGN1cnNvcnMgZnJvbSBpbnRlcmZlcmluZyB3aXRoIHRoZSBzY3JvbGxcbiAgLy8gd2lkdGggYW5kIGhlaWdodC5cbiAgcmVtb3ZlQ2hpbGRyZW4oZGlzcGxheS5jdXJzb3JEaXYpO1xuICByZW1vdmVDaGlsZHJlbihkaXNwbGF5LnNlbGVjdGlvbkRpdik7XG4gIGRpc3BsYXkuZ3V0dGVycy5zdHlsZS5oZWlnaHQgPSBkaXNwbGF5LnNpemVyLnN0eWxlLm1pbkhlaWdodCA9IDA7XG5cbiAgaWYgKGRpZmZlcmVudCkge1xuICAgIGRpc3BsYXkubGFzdFdyYXBIZWlnaHQgPSB1cGRhdGUud3JhcHBlckhlaWdodDtcbiAgICBkaXNwbGF5Lmxhc3RXcmFwV2lkdGggPSB1cGRhdGUud3JhcHBlcldpZHRoO1xuICAgIHN0YXJ0V29ya2VyKGNtLCA0MDApO1xuICB9XG5cbiAgZGlzcGxheS51cGRhdGVMaW5lTnVtYmVycyA9IG51bGw7XG5cbiAgcmV0dXJuIHRydWVcbn1cblxuZnVuY3Rpb24gcG9zdFVwZGF0ZURpc3BsYXkoY20sIHVwZGF0ZSkge1xuICB2YXIgdmlld3BvcnQgPSB1cGRhdGUudmlld3BvcnQ7XG5cbiAgZm9yICh2YXIgZmlyc3QgPSB0cnVlOzsgZmlyc3QgPSBmYWxzZSkge1xuICAgIGlmICghZmlyc3QgfHwgIWNtLm9wdGlvbnMubGluZVdyYXBwaW5nIHx8IHVwZGF0ZS5vbGREaXNwbGF5V2lkdGggPT0gZGlzcGxheVdpZHRoKGNtKSkge1xuICAgICAgLy8gQ2xpcCBmb3JjZWQgdmlld3BvcnQgdG8gYWN0dWFsIHNjcm9sbGFibGUgYXJlYS5cbiAgICAgIGlmICh2aWV3cG9ydCAmJiB2aWV3cG9ydC50b3AgIT0gbnVsbClcbiAgICAgICAgeyB2aWV3cG9ydCA9IHt0b3A6IE1hdGgubWluKGNtLmRvYy5oZWlnaHQgKyBwYWRkaW5nVmVydChjbS5kaXNwbGF5KSAtIGRpc3BsYXlIZWlnaHQoY20pLCB2aWV3cG9ydC50b3ApfTsgfVxuICAgICAgLy8gVXBkYXRlZCBsaW5lIGhlaWdodHMgbWlnaHQgcmVzdWx0IGluIHRoZSBkcmF3biBhcmVhIG5vdFxuICAgICAgLy8gYWN0dWFsbHkgY292ZXJpbmcgdGhlIHZpZXdwb3J0LiBLZWVwIGxvb3BpbmcgdW50aWwgaXQgZG9lcy5cbiAgICAgIHVwZGF0ZS52aXNpYmxlID0gdmlzaWJsZUxpbmVzKGNtLmRpc3BsYXksIGNtLmRvYywgdmlld3BvcnQpO1xuICAgICAgaWYgKHVwZGF0ZS52aXNpYmxlLmZyb20gPj0gY20uZGlzcGxheS52aWV3RnJvbSAmJiB1cGRhdGUudmlzaWJsZS50byA8PSBjbS5kaXNwbGF5LnZpZXdUbylcbiAgICAgICAgeyBicmVhayB9XG4gICAgfVxuICAgIGlmICghdXBkYXRlRGlzcGxheUlmTmVlZGVkKGNtLCB1cGRhdGUpKSB7IGJyZWFrIH1cbiAgICB1cGRhdGVIZWlnaHRzSW5WaWV3cG9ydChjbSk7XG4gICAgdmFyIGJhck1lYXN1cmUgPSBtZWFzdXJlRm9yU2Nyb2xsYmFycyhjbSk7XG4gICAgdXBkYXRlU2VsZWN0aW9uKGNtKTtcbiAgICB1cGRhdGVTY3JvbGxiYXJzKGNtLCBiYXJNZWFzdXJlKTtcbiAgICBzZXREb2N1bWVudEhlaWdodChjbSwgYmFyTWVhc3VyZSk7XG4gICAgdXBkYXRlLmZvcmNlID0gZmFsc2U7XG4gIH1cblxuICB1cGRhdGUuc2lnbmFsKGNtLCBcInVwZGF0ZVwiLCBjbSk7XG4gIGlmIChjbS5kaXNwbGF5LnZpZXdGcm9tICE9IGNtLmRpc3BsYXkucmVwb3J0ZWRWaWV3RnJvbSB8fCBjbS5kaXNwbGF5LnZpZXdUbyAhPSBjbS5kaXNwbGF5LnJlcG9ydGVkVmlld1RvKSB7XG4gICAgdXBkYXRlLnNpZ25hbChjbSwgXCJ2aWV3cG9ydENoYW5nZVwiLCBjbSwgY20uZGlzcGxheS52aWV3RnJvbSwgY20uZGlzcGxheS52aWV3VG8pO1xuICAgIGNtLmRpc3BsYXkucmVwb3J0ZWRWaWV3RnJvbSA9IGNtLmRpc3BsYXkudmlld0Zyb207IGNtLmRpc3BsYXkucmVwb3J0ZWRWaWV3VG8gPSBjbS5kaXNwbGF5LnZpZXdUbztcbiAgfVxufVxuXG5mdW5jdGlvbiB1cGRhdGVEaXNwbGF5U2ltcGxlKGNtLCB2aWV3cG9ydCkge1xuICB2YXIgdXBkYXRlID0gbmV3IERpc3BsYXlVcGRhdGUoY20sIHZpZXdwb3J0KTtcbiAgaWYgKHVwZGF0ZURpc3BsYXlJZk5lZWRlZChjbSwgdXBkYXRlKSkge1xuICAgIHVwZGF0ZUhlaWdodHNJblZpZXdwb3J0KGNtKTtcbiAgICBwb3N0VXBkYXRlRGlzcGxheShjbSwgdXBkYXRlKTtcbiAgICB2YXIgYmFyTWVhc3VyZSA9IG1lYXN1cmVGb3JTY3JvbGxiYXJzKGNtKTtcbiAgICB1cGRhdGVTZWxlY3Rpb24oY20pO1xuICAgIHVwZGF0ZVNjcm9sbGJhcnMoY20sIGJhck1lYXN1cmUpO1xuICAgIHNldERvY3VtZW50SGVpZ2h0KGNtLCBiYXJNZWFzdXJlKTtcbiAgICB1cGRhdGUuZmluaXNoKCk7XG4gIH1cbn1cblxuLy8gU3luYyB0aGUgYWN0dWFsIGRpc3BsYXkgRE9NIHN0cnVjdHVyZSB3aXRoIGRpc3BsYXkudmlldywgcmVtb3Zpbmdcbi8vIG5vZGVzIGZvciBsaW5lcyB0aGF0IGFyZSBubyBsb25nZXIgaW4gdmlldywgYW5kIGNyZWF0aW5nIHRoZSBvbmVzXG4vLyB0aGF0IGFyZSBub3QgdGhlcmUgeWV0LCBhbmQgdXBkYXRpbmcgdGhlIG9uZXMgdGhhdCBhcmUgb3V0IG9mXG4vLyBkYXRlLlxuZnVuY3Rpb24gcGF0Y2hEaXNwbGF5KGNtLCB1cGRhdGVOdW1iZXJzRnJvbSwgZGltcykge1xuICB2YXIgZGlzcGxheSA9IGNtLmRpc3BsYXksIGxpbmVOdW1iZXJzID0gY20ub3B0aW9ucy5saW5lTnVtYmVycztcbiAgdmFyIGNvbnRhaW5lciA9IGRpc3BsYXkubGluZURpdiwgY3VyID0gY29udGFpbmVyLmZpcnN0Q2hpbGQ7XG5cbiAgZnVuY3Rpb24gcm0obm9kZSkge1xuICAgIHZhciBuZXh0ID0gbm9kZS5uZXh0U2libGluZztcbiAgICAvLyBXb3JrcyBhcm91bmQgYSB0aHJvdy1zY3JvbGwgYnVnIGluIE9TIFggV2Via2l0XG4gICAgaWYgKHdlYmtpdCAmJiBtYWMgJiYgY20uZGlzcGxheS5jdXJyZW50V2hlZWxUYXJnZXQgPT0gbm9kZSlcbiAgICAgIHsgbm9kZS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7IH1cbiAgICBlbHNlXG4gICAgICB7IG5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChub2RlKTsgfVxuICAgIHJldHVybiBuZXh0XG4gIH1cblxuICB2YXIgdmlldyA9IGRpc3BsYXkudmlldywgbGluZU4gPSBkaXNwbGF5LnZpZXdGcm9tO1xuICAvLyBMb29wIG92ZXIgdGhlIGVsZW1lbnRzIGluIHRoZSB2aWV3LCBzeW5jaW5nIGN1ciAodGhlIERPTSBub2Rlc1xuICAvLyBpbiBkaXNwbGF5LmxpbmVEaXYpIHdpdGggdGhlIHZpZXcgYXMgd2UgZ28uXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdmlldy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBsaW5lVmlldyA9IHZpZXdbaV07XG4gICAgaWYgKGxpbmVWaWV3LmhpZGRlbikge1xuICAgIH0gZWxzZSBpZiAoIWxpbmVWaWV3Lm5vZGUgfHwgbGluZVZpZXcubm9kZS5wYXJlbnROb2RlICE9IGNvbnRhaW5lcikgeyAvLyBOb3QgZHJhd24geWV0XG4gICAgICB2YXIgbm9kZSA9IGJ1aWxkTGluZUVsZW1lbnQoY20sIGxpbmVWaWV3LCBsaW5lTiwgZGltcyk7XG4gICAgICBjb250YWluZXIuaW5zZXJ0QmVmb3JlKG5vZGUsIGN1cik7XG4gICAgfSBlbHNlIHsgLy8gQWxyZWFkeSBkcmF3blxuICAgICAgd2hpbGUgKGN1ciAhPSBsaW5lVmlldy5ub2RlKSB7IGN1ciA9IHJtKGN1cik7IH1cbiAgICAgIHZhciB1cGRhdGVOdW1iZXIgPSBsaW5lTnVtYmVycyAmJiB1cGRhdGVOdW1iZXJzRnJvbSAhPSBudWxsICYmXG4gICAgICAgIHVwZGF0ZU51bWJlcnNGcm9tIDw9IGxpbmVOICYmIGxpbmVWaWV3LmxpbmVOdW1iZXI7XG4gICAgICBpZiAobGluZVZpZXcuY2hhbmdlcykge1xuICAgICAgICBpZiAoaW5kZXhPZihsaW5lVmlldy5jaGFuZ2VzLCBcImd1dHRlclwiKSA+IC0xKSB7IHVwZGF0ZU51bWJlciA9IGZhbHNlOyB9XG4gICAgICAgIHVwZGF0ZUxpbmVGb3JDaGFuZ2VzKGNtLCBsaW5lVmlldywgbGluZU4sIGRpbXMpO1xuICAgICAgfVxuICAgICAgaWYgKHVwZGF0ZU51bWJlcikge1xuICAgICAgICByZW1vdmVDaGlsZHJlbihsaW5lVmlldy5saW5lTnVtYmVyKTtcbiAgICAgICAgbGluZVZpZXcubGluZU51bWJlci5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShsaW5lTnVtYmVyRm9yKGNtLm9wdGlvbnMsIGxpbmVOKSkpO1xuICAgICAgfVxuICAgICAgY3VyID0gbGluZVZpZXcubm9kZS5uZXh0U2libGluZztcbiAgICB9XG4gICAgbGluZU4gKz0gbGluZVZpZXcuc2l6ZTtcbiAgfVxuICB3aGlsZSAoY3VyKSB7IGN1ciA9IHJtKGN1cik7IH1cbn1cblxuZnVuY3Rpb24gdXBkYXRlR3V0dGVyU3BhY2UoY20pIHtcbiAgdmFyIHdpZHRoID0gY20uZGlzcGxheS5ndXR0ZXJzLm9mZnNldFdpZHRoO1xuICBjbS5kaXNwbGF5LnNpemVyLnN0eWxlLm1hcmdpbkxlZnQgPSB3aWR0aCArIFwicHhcIjtcbn1cblxuZnVuY3Rpb24gc2V0RG9jdW1lbnRIZWlnaHQoY20sIG1lYXN1cmUpIHtcbiAgY20uZGlzcGxheS5zaXplci5zdHlsZS5taW5IZWlnaHQgPSBtZWFzdXJlLmRvY0hlaWdodCArIFwicHhcIjtcbiAgY20uZGlzcGxheS5oZWlnaHRGb3JjZXIuc3R5bGUudG9wID0gbWVhc3VyZS5kb2NIZWlnaHQgKyBcInB4XCI7XG4gIGNtLmRpc3BsYXkuZ3V0dGVycy5zdHlsZS5oZWlnaHQgPSAobWVhc3VyZS5kb2NIZWlnaHQgKyBjbS5kaXNwbGF5LmJhckhlaWdodCArIHNjcm9sbEdhcChjbSkpICsgXCJweFwiO1xufVxuXG4vLyBSZWJ1aWxkIHRoZSBndXR0ZXIgZWxlbWVudHMsIGVuc3VyZSB0aGUgbWFyZ2luIHRvIHRoZSBsZWZ0IG9mIHRoZVxuLy8gY29kZSBtYXRjaGVzIHRoZWlyIHdpZHRoLlxuZnVuY3Rpb24gdXBkYXRlR3V0dGVycyhjbSkge1xuICB2YXIgZ3V0dGVycyA9IGNtLmRpc3BsYXkuZ3V0dGVycywgc3BlY3MgPSBjbS5vcHRpb25zLmd1dHRlcnM7XG4gIHJlbW92ZUNoaWxkcmVuKGd1dHRlcnMpO1xuICB2YXIgaSA9IDA7XG4gIGZvciAoOyBpIDwgc3BlY3MubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgZ3V0dGVyQ2xhc3MgPSBzcGVjc1tpXTtcbiAgICB2YXIgZ0VsdCA9IGd1dHRlcnMuYXBwZW5kQ2hpbGQoZWx0KFwiZGl2XCIsIG51bGwsIFwiQ29kZU1pcnJvci1ndXR0ZXIgXCIgKyBndXR0ZXJDbGFzcykpO1xuICAgIGlmIChndXR0ZXJDbGFzcyA9PSBcIkNvZGVNaXJyb3ItbGluZW51bWJlcnNcIikge1xuICAgICAgY20uZGlzcGxheS5saW5lR3V0dGVyID0gZ0VsdDtcbiAgICAgIGdFbHQuc3R5bGUud2lkdGggPSAoY20uZGlzcGxheS5saW5lTnVtV2lkdGggfHwgMSkgKyBcInB4XCI7XG4gICAgfVxuICB9XG4gIGd1dHRlcnMuc3R5bGUuZGlzcGxheSA9IGkgPyBcIlwiIDogXCJub25lXCI7XG4gIHVwZGF0ZUd1dHRlclNwYWNlKGNtKTtcbn1cblxuLy8gTWFrZSBzdXJlIHRoZSBndXR0ZXJzIG9wdGlvbnMgY29udGFpbnMgdGhlIGVsZW1lbnRcbi8vIFwiQ29kZU1pcnJvci1saW5lbnVtYmVyc1wiIHdoZW4gdGhlIGxpbmVOdW1iZXJzIG9wdGlvbiBpcyB0cnVlLlxuZnVuY3Rpb24gc2V0R3V0dGVyc0ZvckxpbmVOdW1iZXJzKG9wdGlvbnMpIHtcbiAgdmFyIGZvdW5kID0gaW5kZXhPZihvcHRpb25zLmd1dHRlcnMsIFwiQ29kZU1pcnJvci1saW5lbnVtYmVyc1wiKTtcbiAgaWYgKGZvdW5kID09IC0xICYmIG9wdGlvbnMubGluZU51bWJlcnMpIHtcbiAgICBvcHRpb25zLmd1dHRlcnMgPSBvcHRpb25zLmd1dHRlcnMuY29uY2F0KFtcIkNvZGVNaXJyb3ItbGluZW51bWJlcnNcIl0pO1xuICB9IGVsc2UgaWYgKGZvdW5kID4gLTEgJiYgIW9wdGlvbnMubGluZU51bWJlcnMpIHtcbiAgICBvcHRpb25zLmd1dHRlcnMgPSBvcHRpb25zLmd1dHRlcnMuc2xpY2UoMCk7XG4gICAgb3B0aW9ucy5ndXR0ZXJzLnNwbGljZShmb3VuZCwgMSk7XG4gIH1cbn1cblxuLy8gU2luY2UgdGhlIGRlbHRhIHZhbHVlcyByZXBvcnRlZCBvbiBtb3VzZSB3aGVlbCBldmVudHMgYXJlXG4vLyB1bnN0YW5kYXJkaXplZCBiZXR3ZWVuIGJyb3dzZXJzIGFuZCBldmVuIGJyb3dzZXIgdmVyc2lvbnMsIGFuZFxuLy8gZ2VuZXJhbGx5IGhvcnJpYmx5IHVucHJlZGljdGFibGUsIHRoaXMgY29kZSBzdGFydHMgYnkgbWVhc3VyaW5nXG4vLyB0aGUgc2Nyb2xsIGVmZmVjdCB0aGF0IHRoZSBmaXJzdCBmZXcgbW91c2Ugd2hlZWwgZXZlbnRzIGhhdmUsXG4vLyBhbmQsIGZyb20gdGhhdCwgZGV0ZWN0cyB0aGUgd2F5IGl0IGNhbiBjb252ZXJ0IGRlbHRhcyB0byBwaXhlbFxuLy8gb2Zmc2V0cyBhZnRlcndhcmRzLlxuLy9cbi8vIFRoZSByZWFzb24gd2Ugd2FudCB0byBrbm93IHRoZSBhbW91bnQgYSB3aGVlbCBldmVudCB3aWxsIHNjcm9sbFxuLy8gaXMgdGhhdCBpdCBnaXZlcyB1cyBhIGNoYW5jZSB0byB1cGRhdGUgdGhlIGRpc3BsYXkgYmVmb3JlIHRoZVxuLy8gYWN0dWFsIHNjcm9sbGluZyBoYXBwZW5zLCByZWR1Y2luZyBmbGlja2VyaW5nLlxuXG52YXIgd2hlZWxTYW1wbGVzID0gMDtcbnZhciB3aGVlbFBpeGVsc1BlclVuaXQgPSBudWxsO1xuLy8gRmlsbCBpbiBhIGJyb3dzZXItZGV0ZWN0ZWQgc3RhcnRpbmcgdmFsdWUgb24gYnJvd3NlcnMgd2hlcmUgd2Vcbi8vIGtub3cgb25lLiBUaGVzZSBkb24ndCBoYXZlIHRvIGJlIGFjY3VyYXRlIC0tIHRoZSByZXN1bHQgb2YgdGhlbVxuLy8gYmVpbmcgd3Jvbmcgd291bGQganVzdCBiZSBhIHNsaWdodCBmbGlja2VyIG9uIHRoZSBmaXJzdCB3aGVlbFxuLy8gc2Nyb2xsIChpZiBpdCBpcyBsYXJnZSBlbm91Z2gpLlxuaWYgKGllKSB7IHdoZWVsUGl4ZWxzUGVyVW5pdCA9IC0uNTM7IH1cbmVsc2UgaWYgKGdlY2tvKSB7IHdoZWVsUGl4ZWxzUGVyVW5pdCA9IDE1OyB9XG5lbHNlIGlmIChjaHJvbWUpIHsgd2hlZWxQaXhlbHNQZXJVbml0ID0gLS43OyB9XG5lbHNlIGlmIChzYWZhcmkpIHsgd2hlZWxQaXhlbHNQZXJVbml0ID0gLTEvMzsgfVxuXG5mdW5jdGlvbiB3aGVlbEV2ZW50RGVsdGEoZSkge1xuICB2YXIgZHggPSBlLndoZWVsRGVsdGFYLCBkeSA9IGUud2hlZWxEZWx0YVk7XG4gIGlmIChkeCA9PSBudWxsICYmIGUuZGV0YWlsICYmIGUuYXhpcyA9PSBlLkhPUklaT05UQUxfQVhJUykgeyBkeCA9IGUuZGV0YWlsOyB9XG4gIGlmIChkeSA9PSBudWxsICYmIGUuZGV0YWlsICYmIGUuYXhpcyA9PSBlLlZFUlRJQ0FMX0FYSVMpIHsgZHkgPSBlLmRldGFpbDsgfVxuICBlbHNlIGlmIChkeSA9PSBudWxsKSB7IGR5ID0gZS53aGVlbERlbHRhOyB9XG4gIHJldHVybiB7eDogZHgsIHk6IGR5fVxufVxuZnVuY3Rpb24gd2hlZWxFdmVudFBpeGVscyhlKSB7XG4gIHZhciBkZWx0YSA9IHdoZWVsRXZlbnREZWx0YShlKTtcbiAgZGVsdGEueCAqPSB3aGVlbFBpeGVsc1BlclVuaXQ7XG4gIGRlbHRhLnkgKj0gd2hlZWxQaXhlbHNQZXJVbml0O1xuICByZXR1cm4gZGVsdGFcbn1cblxuZnVuY3Rpb24gb25TY3JvbGxXaGVlbChjbSwgZSkge1xuICB2YXIgZGVsdGEgPSB3aGVlbEV2ZW50RGVsdGEoZSksIGR4ID0gZGVsdGEueCwgZHkgPSBkZWx0YS55O1xuXG4gIHZhciBkaXNwbGF5ID0gY20uZGlzcGxheSwgc2Nyb2xsID0gZGlzcGxheS5zY3JvbGxlcjtcbiAgLy8gUXVpdCBpZiB0aGVyZSdzIG5vdGhpbmcgdG8gc2Nyb2xsIGhlcmVcbiAgdmFyIGNhblNjcm9sbFggPSBzY3JvbGwuc2Nyb2xsV2lkdGggPiBzY3JvbGwuY2xpZW50V2lkdGg7XG4gIHZhciBjYW5TY3JvbGxZID0gc2Nyb2xsLnNjcm9sbEhlaWdodCA+IHNjcm9sbC5jbGllbnRIZWlnaHQ7XG4gIGlmICghKGR4ICYmIGNhblNjcm9sbFggfHwgZHkgJiYgY2FuU2Nyb2xsWSkpIHsgcmV0dXJuIH1cblxuICAvLyBXZWJraXQgYnJvd3NlcnMgb24gT1MgWCBhYm9ydCBtb21lbnR1bSBzY3JvbGxzIHdoZW4gdGhlIHRhcmdldFxuICAvLyBvZiB0aGUgc2Nyb2xsIGV2ZW50IGlzIHJlbW92ZWQgZnJvbSB0aGUgc2Nyb2xsYWJsZSBlbGVtZW50LlxuICAvLyBUaGlzIGhhY2sgKHNlZSByZWxhdGVkIGNvZGUgaW4gcGF0Y2hEaXNwbGF5KSBtYWtlcyBzdXJlIHRoZVxuICAvLyBlbGVtZW50IGlzIGtlcHQgYXJvdW5kLlxuICBpZiAoZHkgJiYgbWFjICYmIHdlYmtpdCkge1xuICAgIG91dGVyOiBmb3IgKHZhciBjdXIgPSBlLnRhcmdldCwgdmlldyA9IGRpc3BsYXkudmlldzsgY3VyICE9IHNjcm9sbDsgY3VyID0gY3VyLnBhcmVudE5vZGUpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmlldy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAodmlld1tpXS5ub2RlID09IGN1cikge1xuICAgICAgICAgIGNtLmRpc3BsYXkuY3VycmVudFdoZWVsVGFyZ2V0ID0gY3VyO1xuICAgICAgICAgIGJyZWFrIG91dGVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBPbiBzb21lIGJyb3dzZXJzLCBob3Jpem9udGFsIHNjcm9sbGluZyB3aWxsIGNhdXNlIHJlZHJhd3MgdG9cbiAgLy8gaGFwcGVuIGJlZm9yZSB0aGUgZ3V0dGVyIGhhcyBiZWVuIHJlYWxpZ25lZCwgY2F1c2luZyBpdCB0b1xuICAvLyB3cmlnZ2xlIGFyb3VuZCBpbiBhIG1vc3QgdW5zZWVtbHkgd2F5LiBXaGVuIHdlIGhhdmUgYW5cbiAgLy8gZXN0aW1hdGVkIHBpeGVscy9kZWx0YSB2YWx1ZSwgd2UganVzdCBoYW5kbGUgaG9yaXpvbnRhbFxuICAvLyBzY3JvbGxpbmcgZW50aXJlbHkgaGVyZS4gSXQnbGwgYmUgc2xpZ2h0bHkgb2ZmIGZyb20gbmF0aXZlLCBidXRcbiAgLy8gYmV0dGVyIHRoYW4gZ2xpdGNoaW5nIG91dC5cbiAgaWYgKGR4ICYmICFnZWNrbyAmJiAhcHJlc3RvICYmIHdoZWVsUGl4ZWxzUGVyVW5pdCAhPSBudWxsKSB7XG4gICAgaWYgKGR5ICYmIGNhblNjcm9sbFkpXG4gICAgICB7IHVwZGF0ZVNjcm9sbFRvcChjbSwgTWF0aC5tYXgoMCwgc2Nyb2xsLnNjcm9sbFRvcCArIGR5ICogd2hlZWxQaXhlbHNQZXJVbml0KSk7IH1cbiAgICBzZXRTY3JvbGxMZWZ0KGNtLCBNYXRoLm1heCgwLCBzY3JvbGwuc2Nyb2xsTGVmdCArIGR4ICogd2hlZWxQaXhlbHNQZXJVbml0KSk7XG4gICAgLy8gT25seSBwcmV2ZW50IGRlZmF1bHQgc2Nyb2xsaW5nIGlmIHZlcnRpY2FsIHNjcm9sbGluZyBpc1xuICAgIC8vIGFjdHVhbGx5IHBvc3NpYmxlLiBPdGhlcndpc2UsIGl0IGNhdXNlcyB2ZXJ0aWNhbCBzY3JvbGxcbiAgICAvLyBqaXR0ZXIgb24gT1NYIHRyYWNrcGFkcyB3aGVuIGRlbHRhWCBpcyBzbWFsbCBhbmQgZGVsdGFZXG4gICAgLy8gaXMgbGFyZ2UgKGlzc3VlICMzNTc5KVxuICAgIGlmICghZHkgfHwgKGR5ICYmIGNhblNjcm9sbFkpKVxuICAgICAgeyBlX3ByZXZlbnREZWZhdWx0KGUpOyB9XG4gICAgZGlzcGxheS53aGVlbFN0YXJ0WCA9IG51bGw7IC8vIEFib3J0IG1lYXN1cmVtZW50LCBpZiBpbiBwcm9ncmVzc1xuICAgIHJldHVyblxuICB9XG5cbiAgLy8gJ1Byb2plY3QnIHRoZSB2aXNpYmxlIHZpZXdwb3J0IHRvIGNvdmVyIHRoZSBhcmVhIHRoYXQgaXMgYmVpbmdcbiAgLy8gc2Nyb2xsZWQgaW50byB2aWV3IChpZiB3ZSBrbm93IGVub3VnaCB0byBlc3RpbWF0ZSBpdCkuXG4gIGlmIChkeSAmJiB3aGVlbFBpeGVsc1BlclVuaXQgIT0gbnVsbCkge1xuICAgIHZhciBwaXhlbHMgPSBkeSAqIHdoZWVsUGl4ZWxzUGVyVW5pdDtcbiAgICB2YXIgdG9wID0gY20uZG9jLnNjcm9sbFRvcCwgYm90ID0gdG9wICsgZGlzcGxheS53cmFwcGVyLmNsaWVudEhlaWdodDtcbiAgICBpZiAocGl4ZWxzIDwgMCkgeyB0b3AgPSBNYXRoLm1heCgwLCB0b3AgKyBwaXhlbHMgLSA1MCk7IH1cbiAgICBlbHNlIHsgYm90ID0gTWF0aC5taW4oY20uZG9jLmhlaWdodCwgYm90ICsgcGl4ZWxzICsgNTApOyB9XG4gICAgdXBkYXRlRGlzcGxheVNpbXBsZShjbSwge3RvcDogdG9wLCBib3R0b206IGJvdH0pO1xuICB9XG5cbiAgaWYgKHdoZWVsU2FtcGxlcyA8IDIwKSB7XG4gICAgaWYgKGRpc3BsYXkud2hlZWxTdGFydFggPT0gbnVsbCkge1xuICAgICAgZGlzcGxheS53aGVlbFN0YXJ0WCA9IHNjcm9sbC5zY3JvbGxMZWZ0OyBkaXNwbGF5LndoZWVsU3RhcnRZID0gc2Nyb2xsLnNjcm9sbFRvcDtcbiAgICAgIGRpc3BsYXkud2hlZWxEWCA9IGR4OyBkaXNwbGF5LndoZWVsRFkgPSBkeTtcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoZGlzcGxheS53aGVlbFN0YXJ0WCA9PSBudWxsKSB7IHJldHVybiB9XG4gICAgICAgIHZhciBtb3ZlZFggPSBzY3JvbGwuc2Nyb2xsTGVmdCAtIGRpc3BsYXkud2hlZWxTdGFydFg7XG4gICAgICAgIHZhciBtb3ZlZFkgPSBzY3JvbGwuc2Nyb2xsVG9wIC0gZGlzcGxheS53aGVlbFN0YXJ0WTtcbiAgICAgICAgdmFyIHNhbXBsZSA9IChtb3ZlZFkgJiYgZGlzcGxheS53aGVlbERZICYmIG1vdmVkWSAvIGRpc3BsYXkud2hlZWxEWSkgfHxcbiAgICAgICAgICAobW92ZWRYICYmIGRpc3BsYXkud2hlZWxEWCAmJiBtb3ZlZFggLyBkaXNwbGF5LndoZWVsRFgpO1xuICAgICAgICBkaXNwbGF5LndoZWVsU3RhcnRYID0gZGlzcGxheS53aGVlbFN0YXJ0WSA9IG51bGw7XG4gICAgICAgIGlmICghc2FtcGxlKSB7IHJldHVybiB9XG4gICAgICAgIHdoZWVsUGl4ZWxzUGVyVW5pdCA9ICh3aGVlbFBpeGVsc1BlclVuaXQgKiB3aGVlbFNhbXBsZXMgKyBzYW1wbGUpIC8gKHdoZWVsU2FtcGxlcyArIDEpO1xuICAgICAgICArK3doZWVsU2FtcGxlcztcbiAgICAgIH0sIDIwMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRpc3BsYXkud2hlZWxEWCArPSBkeDsgZGlzcGxheS53aGVlbERZICs9IGR5O1xuICAgIH1cbiAgfVxufVxuXG4vLyBTZWxlY3Rpb24gb2JqZWN0cyBhcmUgaW1tdXRhYmxlLiBBIG5ldyBvbmUgaXMgY3JlYXRlZCBldmVyeSB0aW1lXG4vLyB0aGUgc2VsZWN0aW9uIGNoYW5nZXMuIEEgc2VsZWN0aW9uIGlzIG9uZSBvciBtb3JlIG5vbi1vdmVybGFwcGluZ1xuLy8gKGFuZCBub24tdG91Y2hpbmcpIHJhbmdlcywgc29ydGVkLCBhbmQgYW4gaW50ZWdlciB0aGF0IGluZGljYXRlc1xuLy8gd2hpY2ggb25lIGlzIHRoZSBwcmltYXJ5IHNlbGVjdGlvbiAodGhlIG9uZSB0aGF0J3Mgc2Nyb2xsZWQgaW50b1xuLy8gdmlldywgdGhhdCBnZXRDdXJzb3IgcmV0dXJucywgZXRjKS5cbnZhciBTZWxlY3Rpb24gPSBmdW5jdGlvbihyYW5nZXMsIHByaW1JbmRleCkge1xuICB0aGlzLnJhbmdlcyA9IHJhbmdlcztcbiAgdGhpcy5wcmltSW5kZXggPSBwcmltSW5kZXg7XG59O1xuXG5TZWxlY3Rpb24ucHJvdG90eXBlLnByaW1hcnkgPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzLnJhbmdlc1t0aGlzLnByaW1JbmRleF0gfTtcblxuU2VsZWN0aW9uLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiAob3RoZXIpIHtcbiAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICBpZiAob3RoZXIgPT0gdGhpcykgeyByZXR1cm4gdHJ1ZSB9XG4gIGlmIChvdGhlci5wcmltSW5kZXggIT0gdGhpcy5wcmltSW5kZXggfHwgb3RoZXIucmFuZ2VzLmxlbmd0aCAhPSB0aGlzLnJhbmdlcy5sZW5ndGgpIHsgcmV0dXJuIGZhbHNlIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnJhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBoZXJlID0gdGhpcyQxLnJhbmdlc1tpXSwgdGhlcmUgPSBvdGhlci5yYW5nZXNbaV07XG4gICAgaWYgKCFlcXVhbEN1cnNvclBvcyhoZXJlLmFuY2hvciwgdGhlcmUuYW5jaG9yKSB8fCAhZXF1YWxDdXJzb3JQb3MoaGVyZS5oZWFkLCB0aGVyZS5oZWFkKSkgeyByZXR1cm4gZmFsc2UgfVxuICB9XG4gIHJldHVybiB0cnVlXG59O1xuXG5TZWxlY3Rpb24ucHJvdG90eXBlLmRlZXBDb3B5ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gIHZhciBvdXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnJhbmdlcy5sZW5ndGg7IGkrKylcbiAgICB7IG91dFtpXSA9IG5ldyBSYW5nZShjb3B5UG9zKHRoaXMkMS5yYW5nZXNbaV0uYW5jaG9yKSwgY29weVBvcyh0aGlzJDEucmFuZ2VzW2ldLmhlYWQpKTsgfVxuICByZXR1cm4gbmV3IFNlbGVjdGlvbihvdXQsIHRoaXMucHJpbUluZGV4KVxufTtcblxuU2VsZWN0aW9uLnByb3RvdHlwZS5zb21ldGhpbmdTZWxlY3RlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucmFuZ2VzLmxlbmd0aDsgaSsrKVxuICAgIHsgaWYgKCF0aGlzJDEucmFuZ2VzW2ldLmVtcHR5KCkpIHsgcmV0dXJuIHRydWUgfSB9XG4gIHJldHVybiBmYWxzZVxufTtcblxuU2VsZWN0aW9uLnByb3RvdHlwZS5jb250YWlucyA9IGZ1bmN0aW9uIChwb3MsIGVuZCkge1xuICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gIGlmICghZW5kKSB7IGVuZCA9IHBvczsgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucmFuZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHJhbmdlID0gdGhpcyQxLnJhbmdlc1tpXTtcbiAgICBpZiAoY21wKGVuZCwgcmFuZ2UuZnJvbSgpKSA+PSAwICYmIGNtcChwb3MsIHJhbmdlLnRvKCkpIDw9IDApXG4gICAgICB7IHJldHVybiBpIH1cbiAgfVxuICByZXR1cm4gLTFcbn07XG5cbnZhciBSYW5nZSA9IGZ1bmN0aW9uKGFuY2hvciwgaGVhZCkge1xuICB0aGlzLmFuY2hvciA9IGFuY2hvcjsgdGhpcy5oZWFkID0gaGVhZDtcbn07XG5cblJhbmdlLnByb3RvdHlwZS5mcm9tID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gbWluUG9zKHRoaXMuYW5jaG9yLCB0aGlzLmhlYWQpIH07XG5SYW5nZS5wcm90b3R5cGUudG8gPSBmdW5jdGlvbiAoKSB7IHJldHVybiBtYXhQb3ModGhpcy5hbmNob3IsIHRoaXMuaGVhZCkgfTtcblJhbmdlLnByb3RvdHlwZS5lbXB0eSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXMuaGVhZC5saW5lID09IHRoaXMuYW5jaG9yLmxpbmUgJiYgdGhpcy5oZWFkLmNoID09IHRoaXMuYW5jaG9yLmNoIH07XG5cbi8vIFRha2UgYW4gdW5zb3J0ZWQsIHBvdGVudGlhbGx5IG92ZXJsYXBwaW5nIHNldCBvZiByYW5nZXMsIGFuZFxuLy8gYnVpbGQgYSBzZWxlY3Rpb24gb3V0IG9mIGl0LiAnQ29uc3VtZXMnIHJhbmdlcyBhcnJheSAobW9kaWZ5aW5nXG4vLyBpdCkuXG5mdW5jdGlvbiBub3JtYWxpemVTZWxlY3Rpb24ocmFuZ2VzLCBwcmltSW5kZXgpIHtcbiAgdmFyIHByaW0gPSByYW5nZXNbcHJpbUluZGV4XTtcbiAgcmFuZ2VzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHsgcmV0dXJuIGNtcChhLmZyb20oKSwgYi5mcm9tKCkpOyB9KTtcbiAgcHJpbUluZGV4ID0gaW5kZXhPZihyYW5nZXMsIHByaW0pO1xuICBmb3IgKHZhciBpID0gMTsgaSA8IHJhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBjdXIgPSByYW5nZXNbaV0sIHByZXYgPSByYW5nZXNbaSAtIDFdO1xuICAgIGlmIChjbXAocHJldi50bygpLCBjdXIuZnJvbSgpKSA+PSAwKSB7XG4gICAgICB2YXIgZnJvbSA9IG1pblBvcyhwcmV2LmZyb20oKSwgY3VyLmZyb20oKSksIHRvID0gbWF4UG9zKHByZXYudG8oKSwgY3VyLnRvKCkpO1xuICAgICAgdmFyIGludiA9IHByZXYuZW1wdHkoKSA/IGN1ci5mcm9tKCkgPT0gY3VyLmhlYWQgOiBwcmV2LmZyb20oKSA9PSBwcmV2LmhlYWQ7XG4gICAgICBpZiAoaSA8PSBwcmltSW5kZXgpIHsgLS1wcmltSW5kZXg7IH1cbiAgICAgIHJhbmdlcy5zcGxpY2UoLS1pLCAyLCBuZXcgUmFuZ2UoaW52ID8gdG8gOiBmcm9tLCBpbnYgPyBmcm9tIDogdG8pKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5ldyBTZWxlY3Rpb24ocmFuZ2VzLCBwcmltSW5kZXgpXG59XG5cbmZ1bmN0aW9uIHNpbXBsZVNlbGVjdGlvbihhbmNob3IsIGhlYWQpIHtcbiAgcmV0dXJuIG5ldyBTZWxlY3Rpb24oW25ldyBSYW5nZShhbmNob3IsIGhlYWQgfHwgYW5jaG9yKV0sIDApXG59XG5cbi8vIENvbXB1dGUgdGhlIHBvc2l0aW9uIG9mIHRoZSBlbmQgb2YgYSBjaGFuZ2UgKGl0cyAndG8nIHByb3BlcnR5XG4vLyByZWZlcnMgdG8gdGhlIHByZS1jaGFuZ2UgZW5kKS5cbmZ1bmN0aW9uIGNoYW5nZUVuZChjaGFuZ2UpIHtcbiAgaWYgKCFjaGFuZ2UudGV4dCkgeyByZXR1cm4gY2hhbmdlLnRvIH1cbiAgcmV0dXJuIFBvcyhjaGFuZ2UuZnJvbS5saW5lICsgY2hhbmdlLnRleHQubGVuZ3RoIC0gMSxcbiAgICAgICAgICAgICBsc3QoY2hhbmdlLnRleHQpLmxlbmd0aCArIChjaGFuZ2UudGV4dC5sZW5ndGggPT0gMSA/IGNoYW5nZS5mcm9tLmNoIDogMCkpXG59XG5cbi8vIEFkanVzdCBhIHBvc2l0aW9uIHRvIHJlZmVyIHRvIHRoZSBwb3N0LWNoYW5nZSBwb3NpdGlvbiBvZiB0aGVcbi8vIHNhbWUgdGV4dCwgb3IgdGhlIGVuZCBvZiB0aGUgY2hhbmdlIGlmIHRoZSBjaGFuZ2UgY292ZXJzIGl0LlxuZnVuY3Rpb24gYWRqdXN0Rm9yQ2hhbmdlKHBvcywgY2hhbmdlKSB7XG4gIGlmIChjbXAocG9zLCBjaGFuZ2UuZnJvbSkgPCAwKSB7IHJldHVybiBwb3MgfVxuICBpZiAoY21wKHBvcywgY2hhbmdlLnRvKSA8PSAwKSB7IHJldHVybiBjaGFuZ2VFbmQoY2hhbmdlKSB9XG5cbiAgdmFyIGxpbmUgPSBwb3MubGluZSArIGNoYW5nZS50ZXh0Lmxlbmd0aCAtIChjaGFuZ2UudG8ubGluZSAtIGNoYW5nZS5mcm9tLmxpbmUpIC0gMSwgY2ggPSBwb3MuY2g7XG4gIGlmIChwb3MubGluZSA9PSBjaGFuZ2UudG8ubGluZSkgeyBjaCArPSBjaGFuZ2VFbmQoY2hhbmdlKS5jaCAtIGNoYW5nZS50by5jaDsgfVxuICByZXR1cm4gUG9zKGxpbmUsIGNoKVxufVxuXG5mdW5jdGlvbiBjb21wdXRlU2VsQWZ0ZXJDaGFuZ2UoZG9jLCBjaGFuZ2UpIHtcbiAgdmFyIG91dCA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGRvYy5zZWwucmFuZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHJhbmdlID0gZG9jLnNlbC5yYW5nZXNbaV07XG4gICAgb3V0LnB1c2gobmV3IFJhbmdlKGFkanVzdEZvckNoYW5nZShyYW5nZS5hbmNob3IsIGNoYW5nZSksXG4gICAgICAgICAgICAgICAgICAgICAgIGFkanVzdEZvckNoYW5nZShyYW5nZS5oZWFkLCBjaGFuZ2UpKSk7XG4gIH1cbiAgcmV0dXJuIG5vcm1hbGl6ZVNlbGVjdGlvbihvdXQsIGRvYy5zZWwucHJpbUluZGV4KVxufVxuXG5mdW5jdGlvbiBvZmZzZXRQb3MocG9zLCBvbGQsIG53KSB7XG4gIGlmIChwb3MubGluZSA9PSBvbGQubGluZSlcbiAgICB7IHJldHVybiBQb3MobncubGluZSwgcG9zLmNoIC0gb2xkLmNoICsgbncuY2gpIH1cbiAgZWxzZVxuICAgIHsgcmV0dXJuIFBvcyhudy5saW5lICsgKHBvcy5saW5lIC0gb2xkLmxpbmUpLCBwb3MuY2gpIH1cbn1cblxuLy8gVXNlZCBieSByZXBsYWNlU2VsZWN0aW9ucyB0byBhbGxvdyBtb3ZpbmcgdGhlIHNlbGVjdGlvbiB0byB0aGVcbi8vIHN0YXJ0IG9yIGFyb3VuZCB0aGUgcmVwbGFjZWQgdGVzdC4gSGludCBtYXkgYmUgXCJzdGFydFwiIG9yIFwiYXJvdW5kXCIuXG5mdW5jdGlvbiBjb21wdXRlUmVwbGFjZWRTZWwoZG9jLCBjaGFuZ2VzLCBoaW50KSB7XG4gIHZhciBvdXQgPSBbXTtcbiAgdmFyIG9sZFByZXYgPSBQb3MoZG9jLmZpcnN0LCAwKSwgbmV3UHJldiA9IG9sZFByZXY7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBjaGFuZ2UgPSBjaGFuZ2VzW2ldO1xuICAgIHZhciBmcm9tID0gb2Zmc2V0UG9zKGNoYW5nZS5mcm9tLCBvbGRQcmV2LCBuZXdQcmV2KTtcbiAgICB2YXIgdG8gPSBvZmZzZXRQb3MoY2hhbmdlRW5kKGNoYW5nZSksIG9sZFByZXYsIG5ld1ByZXYpO1xuICAgIG9sZFByZXYgPSBjaGFuZ2UudG87XG4gICAgbmV3UHJldiA9IHRvO1xuICAgIGlmIChoaW50ID09IFwiYXJvdW5kXCIpIHtcbiAgICAgIHZhciByYW5nZSA9IGRvYy5zZWwucmFuZ2VzW2ldLCBpbnYgPSBjbXAocmFuZ2UuaGVhZCwgcmFuZ2UuYW5jaG9yKSA8IDA7XG4gICAgICBvdXRbaV0gPSBuZXcgUmFuZ2UoaW52ID8gdG8gOiBmcm9tLCBpbnYgPyBmcm9tIDogdG8pO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXRbaV0gPSBuZXcgUmFuZ2UoZnJvbSwgZnJvbSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBuZXcgU2VsZWN0aW9uKG91dCwgZG9jLnNlbC5wcmltSW5kZXgpXG59XG5cbi8vIFVzZWQgdG8gZ2V0IHRoZSBlZGl0b3IgaW50byBhIGNvbnNpc3RlbnQgc3RhdGUgYWdhaW4gd2hlbiBvcHRpb25zIGNoYW5nZS5cblxuZnVuY3Rpb24gbG9hZE1vZGUoY20pIHtcbiAgY20uZG9jLm1vZGUgPSBnZXRNb2RlKGNtLm9wdGlvbnMsIGNtLmRvYy5tb2RlT3B0aW9uKTtcbiAgcmVzZXRNb2RlU3RhdGUoY20pO1xufVxuXG5mdW5jdGlvbiByZXNldE1vZGVTdGF0ZShjbSkge1xuICBjbS5kb2MuaXRlcihmdW5jdGlvbiAobGluZSkge1xuICAgIGlmIChsaW5lLnN0YXRlQWZ0ZXIpIHsgbGluZS5zdGF0ZUFmdGVyID0gbnVsbDsgfVxuICAgIGlmIChsaW5lLnN0eWxlcykgeyBsaW5lLnN0eWxlcyA9IG51bGw7IH1cbiAgfSk7XG4gIGNtLmRvYy5tb2RlRnJvbnRpZXIgPSBjbS5kb2MuaGlnaGxpZ2h0RnJvbnRpZXIgPSBjbS5kb2MuZmlyc3Q7XG4gIHN0YXJ0V29ya2VyKGNtLCAxMDApO1xuICBjbS5zdGF0ZS5tb2RlR2VuKys7XG4gIGlmIChjbS5jdXJPcCkgeyByZWdDaGFuZ2UoY20pOyB9XG59XG5cbi8vIERPQ1VNRU5UIERBVEEgU1RSVUNUVVJFXG5cbi8vIEJ5IGRlZmF1bHQsIHVwZGF0ZXMgdGhhdCBzdGFydCBhbmQgZW5kIGF0IHRoZSBiZWdpbm5pbmcgb2YgYSBsaW5lXG4vLyBhcmUgdHJlYXRlZCBzcGVjaWFsbHksIGluIG9yZGVyIHRvIG1ha2UgdGhlIGFzc29jaWF0aW9uIG9mIGxpbmVcbi8vIHdpZGdldHMgYW5kIG1hcmtlciBlbGVtZW50cyB3aXRoIHRoZSB0ZXh0IGJlaGF2ZSBtb3JlIGludHVpdGl2ZS5cbmZ1bmN0aW9uIGlzV2hvbGVMaW5lVXBkYXRlKGRvYywgY2hhbmdlKSB7XG4gIHJldHVybiBjaGFuZ2UuZnJvbS5jaCA9PSAwICYmIGNoYW5nZS50by5jaCA9PSAwICYmIGxzdChjaGFuZ2UudGV4dCkgPT0gXCJcIiAmJlxuICAgICghZG9jLmNtIHx8IGRvYy5jbS5vcHRpb25zLndob2xlTGluZVVwZGF0ZUJlZm9yZSlcbn1cblxuLy8gUGVyZm9ybSBhIGNoYW5nZSBvbiB0aGUgZG9jdW1lbnQgZGF0YSBzdHJ1Y3R1cmUuXG5mdW5jdGlvbiB1cGRhdGVEb2MoZG9jLCBjaGFuZ2UsIG1hcmtlZFNwYW5zLCBlc3RpbWF0ZUhlaWdodCQkMSkge1xuICBmdW5jdGlvbiBzcGFuc0ZvcihuKSB7cmV0dXJuIG1hcmtlZFNwYW5zID8gbWFya2VkU3BhbnNbbl0gOiBudWxsfVxuICBmdW5jdGlvbiB1cGRhdGUobGluZSwgdGV4dCwgc3BhbnMpIHtcbiAgICB1cGRhdGVMaW5lKGxpbmUsIHRleHQsIHNwYW5zLCBlc3RpbWF0ZUhlaWdodCQkMSk7XG4gICAgc2lnbmFsTGF0ZXIobGluZSwgXCJjaGFuZ2VcIiwgbGluZSwgY2hhbmdlKTtcbiAgfVxuICBmdW5jdGlvbiBsaW5lc0ZvcihzdGFydCwgZW5kKSB7XG4gICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKVxuICAgICAgeyByZXN1bHQucHVzaChuZXcgTGluZSh0ZXh0W2ldLCBzcGFuc0ZvcihpKSwgZXN0aW1hdGVIZWlnaHQkJDEpKTsgfVxuICAgIHJldHVybiByZXN1bHRcbiAgfVxuXG4gIHZhciBmcm9tID0gY2hhbmdlLmZyb20sIHRvID0gY2hhbmdlLnRvLCB0ZXh0ID0gY2hhbmdlLnRleHQ7XG4gIHZhciBmaXJzdExpbmUgPSBnZXRMaW5lKGRvYywgZnJvbS5saW5lKSwgbGFzdExpbmUgPSBnZXRMaW5lKGRvYywgdG8ubGluZSk7XG4gIHZhciBsYXN0VGV4dCA9IGxzdCh0ZXh0KSwgbGFzdFNwYW5zID0gc3BhbnNGb3IodGV4dC5sZW5ndGggLSAxKSwgbmxpbmVzID0gdG8ubGluZSAtIGZyb20ubGluZTtcblxuICAvLyBBZGp1c3QgdGhlIGxpbmUgc3RydWN0dXJlXG4gIGlmIChjaGFuZ2UuZnVsbCkge1xuICAgIGRvYy5pbnNlcnQoMCwgbGluZXNGb3IoMCwgdGV4dC5sZW5ndGgpKTtcbiAgICBkb2MucmVtb3ZlKHRleHQubGVuZ3RoLCBkb2Muc2l6ZSAtIHRleHQubGVuZ3RoKTtcbiAgfSBlbHNlIGlmIChpc1dob2xlTGluZVVwZGF0ZShkb2MsIGNoYW5nZSkpIHtcbiAgICAvLyBUaGlzIGlzIGEgd2hvbGUtbGluZSByZXBsYWNlLiBUcmVhdGVkIHNwZWNpYWxseSB0byBtYWtlXG4gICAgLy8gc3VyZSBsaW5lIG9iamVjdHMgbW92ZSB0aGUgd2F5IHRoZXkgYXJlIHN1cHBvc2VkIHRvLlxuICAgIHZhciBhZGRlZCA9IGxpbmVzRm9yKDAsIHRleHQubGVuZ3RoIC0gMSk7XG4gICAgdXBkYXRlKGxhc3RMaW5lLCBsYXN0TGluZS50ZXh0LCBsYXN0U3BhbnMpO1xuICAgIGlmIChubGluZXMpIHsgZG9jLnJlbW92ZShmcm9tLmxpbmUsIG5saW5lcyk7IH1cbiAgICBpZiAoYWRkZWQubGVuZ3RoKSB7IGRvYy5pbnNlcnQoZnJvbS5saW5lLCBhZGRlZCk7IH1cbiAgfSBlbHNlIGlmIChmaXJzdExpbmUgPT0gbGFzdExpbmUpIHtcbiAgICBpZiAodGV4dC5sZW5ndGggPT0gMSkge1xuICAgICAgdXBkYXRlKGZpcnN0TGluZSwgZmlyc3RMaW5lLnRleHQuc2xpY2UoMCwgZnJvbS5jaCkgKyBsYXN0VGV4dCArIGZpcnN0TGluZS50ZXh0LnNsaWNlKHRvLmNoKSwgbGFzdFNwYW5zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGFkZGVkJDEgPSBsaW5lc0ZvcigxLCB0ZXh0Lmxlbmd0aCAtIDEpO1xuICAgICAgYWRkZWQkMS5wdXNoKG5ldyBMaW5lKGxhc3RUZXh0ICsgZmlyc3RMaW5lLnRleHQuc2xpY2UodG8uY2gpLCBsYXN0U3BhbnMsIGVzdGltYXRlSGVpZ2h0JCQxKSk7XG4gICAgICB1cGRhdGUoZmlyc3RMaW5lLCBmaXJzdExpbmUudGV4dC5zbGljZSgwLCBmcm9tLmNoKSArIHRleHRbMF0sIHNwYW5zRm9yKDApKTtcbiAgICAgIGRvYy5pbnNlcnQoZnJvbS5saW5lICsgMSwgYWRkZWQkMSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHRleHQubGVuZ3RoID09IDEpIHtcbiAgICB1cGRhdGUoZmlyc3RMaW5lLCBmaXJzdExpbmUudGV4dC5zbGljZSgwLCBmcm9tLmNoKSArIHRleHRbMF0gKyBsYXN0TGluZS50ZXh0LnNsaWNlKHRvLmNoKSwgc3BhbnNGb3IoMCkpO1xuICAgIGRvYy5yZW1vdmUoZnJvbS5saW5lICsgMSwgbmxpbmVzKTtcbiAgfSBlbHNlIHtcbiAgICB1cGRhdGUoZmlyc3RMaW5lLCBmaXJzdExpbmUudGV4dC5zbGljZSgwLCBmcm9tLmNoKSArIHRleHRbMF0sIHNwYW5zRm9yKDApKTtcbiAgICB1cGRhdGUobGFzdExpbmUsIGxhc3RUZXh0ICsgbGFzdExpbmUudGV4dC5zbGljZSh0by5jaCksIGxhc3RTcGFucyk7XG4gICAgdmFyIGFkZGVkJDIgPSBsaW5lc0ZvcigxLCB0ZXh0Lmxlbmd0aCAtIDEpO1xuICAgIGlmIChubGluZXMgPiAxKSB7IGRvYy5yZW1vdmUoZnJvbS5saW5lICsgMSwgbmxpbmVzIC0gMSk7IH1cbiAgICBkb2MuaW5zZXJ0KGZyb20ubGluZSArIDEsIGFkZGVkJDIpO1xuICB9XG5cbiAgc2lnbmFsTGF0ZXIoZG9jLCBcImNoYW5nZVwiLCBkb2MsIGNoYW5nZSk7XG59XG5cbi8vIENhbGwgZiBmb3IgYWxsIGxpbmtlZCBkb2N1bWVudHMuXG5mdW5jdGlvbiBsaW5rZWREb2NzKGRvYywgZiwgc2hhcmVkSGlzdE9ubHkpIHtcbiAgZnVuY3Rpb24gcHJvcGFnYXRlKGRvYywgc2tpcCwgc2hhcmVkSGlzdCkge1xuICAgIGlmIChkb2MubGlua2VkKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgZG9jLmxpbmtlZC5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIHJlbCA9IGRvYy5saW5rZWRbaV07XG4gICAgICBpZiAocmVsLmRvYyA9PSBza2lwKSB7IGNvbnRpbnVlIH1cbiAgICAgIHZhciBzaGFyZWQgPSBzaGFyZWRIaXN0ICYmIHJlbC5zaGFyZWRIaXN0O1xuICAgICAgaWYgKHNoYXJlZEhpc3RPbmx5ICYmICFzaGFyZWQpIHsgY29udGludWUgfVxuICAgICAgZihyZWwuZG9jLCBzaGFyZWQpO1xuICAgICAgcHJvcGFnYXRlKHJlbC5kb2MsIGRvYywgc2hhcmVkKTtcbiAgICB9IH1cbiAgfVxuICBwcm9wYWdhdGUoZG9jLCBudWxsLCB0cnVlKTtcbn1cblxuLy8gQXR0YWNoIGEgZG9jdW1lbnQgdG8gYW4gZWRpdG9yLlxuZnVuY3Rpb24gYXR0YWNoRG9jKGNtLCBkb2MpIHtcbiAgaWYgKGRvYy5jbSkgeyB0aHJvdyBuZXcgRXJyb3IoXCJUaGlzIGRvY3VtZW50IGlzIGFscmVhZHkgaW4gdXNlLlwiKSB9XG4gIGNtLmRvYyA9IGRvYztcbiAgZG9jLmNtID0gY207XG4gIGVzdGltYXRlTGluZUhlaWdodHMoY20pO1xuICBsb2FkTW9kZShjbSk7XG4gIHNldERpcmVjdGlvbkNsYXNzKGNtKTtcbiAgaWYgKCFjbS5vcHRpb25zLmxpbmVXcmFwcGluZykgeyBmaW5kTWF4TGluZShjbSk7IH1cbiAgY20ub3B0aW9ucy5tb2RlID0gZG9jLm1vZGVPcHRpb247XG4gIHJlZ0NoYW5nZShjbSk7XG59XG5cbmZ1bmN0aW9uIHNldERpcmVjdGlvbkNsYXNzKGNtKSB7XG4gIChjbS5kb2MuZGlyZWN0aW9uID09IFwicnRsXCIgPyBhZGRDbGFzcyA6IHJtQ2xhc3MpKGNtLmRpc3BsYXkubGluZURpdiwgXCJDb2RlTWlycm9yLXJ0bFwiKTtcbn1cblxuZnVuY3Rpb24gZGlyZWN0aW9uQ2hhbmdlZChjbSkge1xuICBydW5Jbk9wKGNtLCBmdW5jdGlvbiAoKSB7XG4gICAgc2V0RGlyZWN0aW9uQ2xhc3MoY20pO1xuICAgIHJlZ0NoYW5nZShjbSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBIaXN0b3J5KHN0YXJ0R2VuKSB7XG4gIC8vIEFycmF5cyBvZiBjaGFuZ2UgZXZlbnRzIGFuZCBzZWxlY3Rpb25zLiBEb2luZyBzb21ldGhpbmcgYWRkcyBhblxuICAvLyBldmVudCB0byBkb25lIGFuZCBjbGVhcnMgdW5kby4gVW5kb2luZyBtb3ZlcyBldmVudHMgZnJvbSBkb25lXG4gIC8vIHRvIHVuZG9uZSwgcmVkb2luZyBtb3ZlcyB0aGVtIGluIHRoZSBvdGhlciBkaXJlY3Rpb24uXG4gIHRoaXMuZG9uZSA9IFtdOyB0aGlzLnVuZG9uZSA9IFtdO1xuICB0aGlzLnVuZG9EZXB0aCA9IEluZmluaXR5O1xuICAvLyBVc2VkIHRvIHRyYWNrIHdoZW4gY2hhbmdlcyBjYW4gYmUgbWVyZ2VkIGludG8gYSBzaW5nbGUgdW5kb1xuICAvLyBldmVudFxuICB0aGlzLmxhc3RNb2RUaW1lID0gdGhpcy5sYXN0U2VsVGltZSA9IDA7XG4gIHRoaXMubGFzdE9wID0gdGhpcy5sYXN0U2VsT3AgPSBudWxsO1xuICB0aGlzLmxhc3RPcmlnaW4gPSB0aGlzLmxhc3RTZWxPcmlnaW4gPSBudWxsO1xuICAvLyBVc2VkIGJ5IHRoZSBpc0NsZWFuKCkgbWV0aG9kXG4gIHRoaXMuZ2VuZXJhdGlvbiA9IHRoaXMubWF4R2VuZXJhdGlvbiA9IHN0YXJ0R2VuIHx8IDE7XG59XG5cbi8vIENyZWF0ZSBhIGhpc3RvcnkgY2hhbmdlIGV2ZW50IGZyb20gYW4gdXBkYXRlRG9jLXN0eWxlIGNoYW5nZVxuLy8gb2JqZWN0LlxuZnVuY3Rpb24gaGlzdG9yeUNoYW5nZUZyb21DaGFuZ2UoZG9jLCBjaGFuZ2UpIHtcbiAgdmFyIGhpc3RDaGFuZ2UgPSB7ZnJvbTogY29weVBvcyhjaGFuZ2UuZnJvbSksIHRvOiBjaGFuZ2VFbmQoY2hhbmdlKSwgdGV4dDogZ2V0QmV0d2Vlbihkb2MsIGNoYW5nZS5mcm9tLCBjaGFuZ2UudG8pfTtcbiAgYXR0YWNoTG9jYWxTcGFucyhkb2MsIGhpc3RDaGFuZ2UsIGNoYW5nZS5mcm9tLmxpbmUsIGNoYW5nZS50by5saW5lICsgMSk7XG4gIGxpbmtlZERvY3MoZG9jLCBmdW5jdGlvbiAoZG9jKSB7IHJldHVybiBhdHRhY2hMb2NhbFNwYW5zKGRvYywgaGlzdENoYW5nZSwgY2hhbmdlLmZyb20ubGluZSwgY2hhbmdlLnRvLmxpbmUgKyAxKTsgfSwgdHJ1ZSk7XG4gIHJldHVybiBoaXN0Q2hhbmdlXG59XG5cbi8vIFBvcCBhbGwgc2VsZWN0aW9uIGV2ZW50cyBvZmYgdGhlIGVuZCBvZiBhIGhpc3RvcnkgYXJyYXkuIFN0b3AgYXRcbi8vIGEgY2hhbmdlIGV2ZW50LlxuZnVuY3Rpb24gY2xlYXJTZWxlY3Rpb25FdmVudHMoYXJyYXkpIHtcbiAgd2hpbGUgKGFycmF5Lmxlbmd0aCkge1xuICAgIHZhciBsYXN0ID0gbHN0KGFycmF5KTtcbiAgICBpZiAobGFzdC5yYW5nZXMpIHsgYXJyYXkucG9wKCk7IH1cbiAgICBlbHNlIHsgYnJlYWsgfVxuICB9XG59XG5cbi8vIEZpbmQgdGhlIHRvcCBjaGFuZ2UgZXZlbnQgaW4gdGhlIGhpc3RvcnkuIFBvcCBvZmYgc2VsZWN0aW9uXG4vLyBldmVudHMgdGhhdCBhcmUgaW4gdGhlIHdheS5cbmZ1bmN0aW9uIGxhc3RDaGFuZ2VFdmVudChoaXN0LCBmb3JjZSkge1xuICBpZiAoZm9yY2UpIHtcbiAgICBjbGVhclNlbGVjdGlvbkV2ZW50cyhoaXN0LmRvbmUpO1xuICAgIHJldHVybiBsc3QoaGlzdC5kb25lKVxuICB9IGVsc2UgaWYgKGhpc3QuZG9uZS5sZW5ndGggJiYgIWxzdChoaXN0LmRvbmUpLnJhbmdlcykge1xuICAgIHJldHVybiBsc3QoaGlzdC5kb25lKVxuICB9IGVsc2UgaWYgKGhpc3QuZG9uZS5sZW5ndGggPiAxICYmICFoaXN0LmRvbmVbaGlzdC5kb25lLmxlbmd0aCAtIDJdLnJhbmdlcykge1xuICAgIGhpc3QuZG9uZS5wb3AoKTtcbiAgICByZXR1cm4gbHN0KGhpc3QuZG9uZSlcbiAgfVxufVxuXG4vLyBSZWdpc3RlciBhIGNoYW5nZSBpbiB0aGUgaGlzdG9yeS4gTWVyZ2VzIGNoYW5nZXMgdGhhdCBhcmUgd2l0aGluXG4vLyBhIHNpbmdsZSBvcGVyYXRpb24sIG9yIGFyZSBjbG9zZSB0b2dldGhlciB3aXRoIGFuIG9yaWdpbiB0aGF0XG4vLyBhbGxvd3MgbWVyZ2luZyAoc3RhcnRpbmcgd2l0aCBcIitcIikgaW50byBhIHNpbmdsZSBldmVudC5cbmZ1bmN0aW9uIGFkZENoYW5nZVRvSGlzdG9yeShkb2MsIGNoYW5nZSwgc2VsQWZ0ZXIsIG9wSWQpIHtcbiAgdmFyIGhpc3QgPSBkb2MuaGlzdG9yeTtcbiAgaGlzdC51bmRvbmUubGVuZ3RoID0gMDtcbiAgdmFyIHRpbWUgPSArbmV3IERhdGUsIGN1cjtcbiAgdmFyIGxhc3Q7XG5cbiAgaWYgKChoaXN0Lmxhc3RPcCA9PSBvcElkIHx8XG4gICAgICAgaGlzdC5sYXN0T3JpZ2luID09IGNoYW5nZS5vcmlnaW4gJiYgY2hhbmdlLm9yaWdpbiAmJlxuICAgICAgICgoY2hhbmdlLm9yaWdpbi5jaGFyQXQoMCkgPT0gXCIrXCIgJiYgZG9jLmNtICYmIGhpc3QubGFzdE1vZFRpbWUgPiB0aW1lIC0gZG9jLmNtLm9wdGlvbnMuaGlzdG9yeUV2ZW50RGVsYXkpIHx8XG4gICAgICAgIGNoYW5nZS5vcmlnaW4uY2hhckF0KDApID09IFwiKlwiKSkgJiZcbiAgICAgIChjdXIgPSBsYXN0Q2hhbmdlRXZlbnQoaGlzdCwgaGlzdC5sYXN0T3AgPT0gb3BJZCkpKSB7XG4gICAgLy8gTWVyZ2UgdGhpcyBjaGFuZ2UgaW50byB0aGUgbGFzdCBldmVudFxuICAgIGxhc3QgPSBsc3QoY3VyLmNoYW5nZXMpO1xuICAgIGlmIChjbXAoY2hhbmdlLmZyb20sIGNoYW5nZS50bykgPT0gMCAmJiBjbXAoY2hhbmdlLmZyb20sIGxhc3QudG8pID09IDApIHtcbiAgICAgIC8vIE9wdGltaXplZCBjYXNlIGZvciBzaW1wbGUgaW5zZXJ0aW9uIC0tIGRvbid0IHdhbnQgdG8gYWRkXG4gICAgICAvLyBuZXcgY2hhbmdlc2V0cyBmb3IgZXZlcnkgY2hhcmFjdGVyIHR5cGVkXG4gICAgICBsYXN0LnRvID0gY2hhbmdlRW5kKGNoYW5nZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEFkZCBuZXcgc3ViLWV2ZW50XG4gICAgICBjdXIuY2hhbmdlcy5wdXNoKGhpc3RvcnlDaGFuZ2VGcm9tQ2hhbmdlKGRvYywgY2hhbmdlKSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIENhbiBub3QgYmUgbWVyZ2VkLCBzdGFydCBhIG5ldyBldmVudC5cbiAgICB2YXIgYmVmb3JlID0gbHN0KGhpc3QuZG9uZSk7XG4gICAgaWYgKCFiZWZvcmUgfHwgIWJlZm9yZS5yYW5nZXMpXG4gICAgICB7IHB1c2hTZWxlY3Rpb25Ub0hpc3RvcnkoZG9jLnNlbCwgaGlzdC5kb25lKTsgfVxuICAgIGN1ciA9IHtjaGFuZ2VzOiBbaGlzdG9yeUNoYW5nZUZyb21DaGFuZ2UoZG9jLCBjaGFuZ2UpXSxcbiAgICAgICAgICAgZ2VuZXJhdGlvbjogaGlzdC5nZW5lcmF0aW9ufTtcbiAgICBoaXN0LmRvbmUucHVzaChjdXIpO1xuICAgIHdoaWxlIChoaXN0LmRvbmUubGVuZ3RoID4gaGlzdC51bmRvRGVwdGgpIHtcbiAgICAgIGhpc3QuZG9uZS5zaGlmdCgpO1xuICAgICAgaWYgKCFoaXN0LmRvbmVbMF0ucmFuZ2VzKSB7IGhpc3QuZG9uZS5zaGlmdCgpOyB9XG4gICAgfVxuICB9XG4gIGhpc3QuZG9uZS5wdXNoKHNlbEFmdGVyKTtcbiAgaGlzdC5nZW5lcmF0aW9uID0gKytoaXN0Lm1heEdlbmVyYXRpb247XG4gIGhpc3QubGFzdE1vZFRpbWUgPSBoaXN0Lmxhc3RTZWxUaW1lID0gdGltZTtcbiAgaGlzdC5sYXN0T3AgPSBoaXN0Lmxhc3RTZWxPcCA9IG9wSWQ7XG4gIGhpc3QubGFzdE9yaWdpbiA9IGhpc3QubGFzdFNlbE9yaWdpbiA9IGNoYW5nZS5vcmlnaW47XG5cbiAgaWYgKCFsYXN0KSB7IHNpZ25hbChkb2MsIFwiaGlzdG9yeUFkZGVkXCIpOyB9XG59XG5cbmZ1bmN0aW9uIHNlbGVjdGlvbkV2ZW50Q2FuQmVNZXJnZWQoZG9jLCBvcmlnaW4sIHByZXYsIHNlbCkge1xuICB2YXIgY2ggPSBvcmlnaW4uY2hhckF0KDApO1xuICByZXR1cm4gY2ggPT0gXCIqXCIgfHxcbiAgICBjaCA9PSBcIitcIiAmJlxuICAgIHByZXYucmFuZ2VzLmxlbmd0aCA9PSBzZWwucmFuZ2VzLmxlbmd0aCAmJlxuICAgIHByZXYuc29tZXRoaW5nU2VsZWN0ZWQoKSA9PSBzZWwuc29tZXRoaW5nU2VsZWN0ZWQoKSAmJlxuICAgIG5ldyBEYXRlIC0gZG9jLmhpc3RvcnkubGFzdFNlbFRpbWUgPD0gKGRvYy5jbSA/IGRvYy5jbS5vcHRpb25zLmhpc3RvcnlFdmVudERlbGF5IDogNTAwKVxufVxuXG4vLyBDYWxsZWQgd2hlbmV2ZXIgdGhlIHNlbGVjdGlvbiBjaGFuZ2VzLCBzZXRzIHRoZSBuZXcgc2VsZWN0aW9uIGFzXG4vLyB0aGUgcGVuZGluZyBzZWxlY3Rpb24gaW4gdGhlIGhpc3RvcnksIGFuZCBwdXNoZXMgdGhlIG9sZCBwZW5kaW5nXG4vLyBzZWxlY3Rpb24gaW50byB0aGUgJ2RvbmUnIGFycmF5IHdoZW4gaXQgd2FzIHNpZ25pZmljYW50bHlcbi8vIGRpZmZlcmVudCAoaW4gbnVtYmVyIG9mIHNlbGVjdGVkIHJhbmdlcywgZW1wdGluZXNzLCBvciB0aW1lKS5cbmZ1bmN0aW9uIGFkZFNlbGVjdGlvblRvSGlzdG9yeShkb2MsIHNlbCwgb3BJZCwgb3B0aW9ucykge1xuICB2YXIgaGlzdCA9IGRvYy5oaXN0b3J5LCBvcmlnaW4gPSBvcHRpb25zICYmIG9wdGlvbnMub3JpZ2luO1xuXG4gIC8vIEEgbmV3IGV2ZW50IGlzIHN0YXJ0ZWQgd2hlbiB0aGUgcHJldmlvdXMgb3JpZ2luIGRvZXMgbm90IG1hdGNoXG4gIC8vIHRoZSBjdXJyZW50LCBvciB0aGUgb3JpZ2lucyBkb24ndCBhbGxvdyBtYXRjaGluZy4gT3JpZ2luc1xuICAvLyBzdGFydGluZyB3aXRoICogYXJlIGFsd2F5cyBtZXJnZWQsIHRob3NlIHN0YXJ0aW5nIHdpdGggKyBhcmVcbiAgLy8gbWVyZ2VkIHdoZW4gc2ltaWxhciBhbmQgY2xvc2UgdG9nZXRoZXIgaW4gdGltZS5cbiAgaWYgKG9wSWQgPT0gaGlzdC5sYXN0U2VsT3AgfHxcbiAgICAgIChvcmlnaW4gJiYgaGlzdC5sYXN0U2VsT3JpZ2luID09IG9yaWdpbiAmJlxuICAgICAgIChoaXN0Lmxhc3RNb2RUaW1lID09IGhpc3QubGFzdFNlbFRpbWUgJiYgaGlzdC5sYXN0T3JpZ2luID09IG9yaWdpbiB8fFxuICAgICAgICBzZWxlY3Rpb25FdmVudENhbkJlTWVyZ2VkKGRvYywgb3JpZ2luLCBsc3QoaGlzdC5kb25lKSwgc2VsKSkpKVxuICAgIHsgaGlzdC5kb25lW2hpc3QuZG9uZS5sZW5ndGggLSAxXSA9IHNlbDsgfVxuICBlbHNlXG4gICAgeyBwdXNoU2VsZWN0aW9uVG9IaXN0b3J5KHNlbCwgaGlzdC5kb25lKTsgfVxuXG4gIGhpc3QubGFzdFNlbFRpbWUgPSArbmV3IERhdGU7XG4gIGhpc3QubGFzdFNlbE9yaWdpbiA9IG9yaWdpbjtcbiAgaGlzdC5sYXN0U2VsT3AgPSBvcElkO1xuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmNsZWFyUmVkbyAhPT0gZmFsc2UpXG4gICAgeyBjbGVhclNlbGVjdGlvbkV2ZW50cyhoaXN0LnVuZG9uZSk7IH1cbn1cblxuZnVuY3Rpb24gcHVzaFNlbGVjdGlvblRvSGlzdG9yeShzZWwsIGRlc3QpIHtcbiAgdmFyIHRvcCA9IGxzdChkZXN0KTtcbiAgaWYgKCEodG9wICYmIHRvcC5yYW5nZXMgJiYgdG9wLmVxdWFscyhzZWwpKSlcbiAgICB7IGRlc3QucHVzaChzZWwpOyB9XG59XG5cbi8vIFVzZWQgdG8gc3RvcmUgbWFya2VkIHNwYW4gaW5mb3JtYXRpb24gaW4gdGhlIGhpc3RvcnkuXG5mdW5jdGlvbiBhdHRhY2hMb2NhbFNwYW5zKGRvYywgY2hhbmdlLCBmcm9tLCB0bykge1xuICB2YXIgZXhpc3RpbmcgPSBjaGFuZ2VbXCJzcGFuc19cIiArIGRvYy5pZF0sIG4gPSAwO1xuICBkb2MuaXRlcihNYXRoLm1heChkb2MuZmlyc3QsIGZyb20pLCBNYXRoLm1pbihkb2MuZmlyc3QgKyBkb2Muc2l6ZSwgdG8pLCBmdW5jdGlvbiAobGluZSkge1xuICAgIGlmIChsaW5lLm1hcmtlZFNwYW5zKVxuICAgICAgeyAoZXhpc3RpbmcgfHwgKGV4aXN0aW5nID0gY2hhbmdlW1wic3BhbnNfXCIgKyBkb2MuaWRdID0ge30pKVtuXSA9IGxpbmUubWFya2VkU3BhbnM7IH1cbiAgICArK247XG4gIH0pO1xufVxuXG4vLyBXaGVuIHVuL3JlLWRvaW5nIHJlc3RvcmVzIHRleHQgY29udGFpbmluZyBtYXJrZWQgc3BhbnMsIHRob3NlXG4vLyB0aGF0IGhhdmUgYmVlbiBleHBsaWNpdGx5IGNsZWFyZWQgc2hvdWxkIG5vdCBiZSByZXN0b3JlZC5cbmZ1bmN0aW9uIHJlbW92ZUNsZWFyZWRTcGFucyhzcGFucykge1xuICBpZiAoIXNwYW5zKSB7IHJldHVybiBudWxsIH1cbiAgdmFyIG91dDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGFucy5sZW5ndGg7ICsraSkge1xuICAgIGlmIChzcGFuc1tpXS5tYXJrZXIuZXhwbGljaXRseUNsZWFyZWQpIHsgaWYgKCFvdXQpIHsgb3V0ID0gc3BhbnMuc2xpY2UoMCwgaSk7IH0gfVxuICAgIGVsc2UgaWYgKG91dCkgeyBvdXQucHVzaChzcGFuc1tpXSk7IH1cbiAgfVxuICByZXR1cm4gIW91dCA/IHNwYW5zIDogb3V0Lmxlbmd0aCA/IG91dCA6IG51bGxcbn1cblxuLy8gUmV0cmlldmUgYW5kIGZpbHRlciB0aGUgb2xkIG1hcmtlZCBzcGFucyBzdG9yZWQgaW4gYSBjaGFuZ2UgZXZlbnQuXG5mdW5jdGlvbiBnZXRPbGRTcGFucyhkb2MsIGNoYW5nZSkge1xuICB2YXIgZm91bmQgPSBjaGFuZ2VbXCJzcGFuc19cIiArIGRvYy5pZF07XG4gIGlmICghZm91bmQpIHsgcmV0dXJuIG51bGwgfVxuICB2YXIgbncgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2UudGV4dC5sZW5ndGg7ICsraSlcbiAgICB7IG53LnB1c2gocmVtb3ZlQ2xlYXJlZFNwYW5zKGZvdW5kW2ldKSk7IH1cbiAgcmV0dXJuIG53XG59XG5cbi8vIFVzZWQgZm9yIHVuL3JlLWRvaW5nIGNoYW5nZXMgZnJvbSB0aGUgaGlzdG9yeS4gQ29tYmluZXMgdGhlXG4vLyByZXN1bHQgb2YgY29tcHV0aW5nIHRoZSBleGlzdGluZyBzcGFucyB3aXRoIHRoZSBzZXQgb2Ygc3BhbnMgdGhhdFxuLy8gZXhpc3RlZCBpbiB0aGUgaGlzdG9yeSAoc28gdGhhdCBkZWxldGluZyBhcm91bmQgYSBzcGFuIGFuZCB0aGVuXG4vLyB1bmRvaW5nIGJyaW5ncyBiYWNrIHRoZSBzcGFuKS5cbmZ1bmN0aW9uIG1lcmdlT2xkU3BhbnMoZG9jLCBjaGFuZ2UpIHtcbiAgdmFyIG9sZCA9IGdldE9sZFNwYW5zKGRvYywgY2hhbmdlKTtcbiAgdmFyIHN0cmV0Y2hlZCA9IHN0cmV0Y2hTcGFuc092ZXJDaGFuZ2UoZG9jLCBjaGFuZ2UpO1xuICBpZiAoIW9sZCkgeyByZXR1cm4gc3RyZXRjaGVkIH1cbiAgaWYgKCFzdHJldGNoZWQpIHsgcmV0dXJuIG9sZCB9XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvbGQubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgb2xkQ3VyID0gb2xkW2ldLCBzdHJldGNoQ3VyID0gc3RyZXRjaGVkW2ldO1xuICAgIGlmIChvbGRDdXIgJiYgc3RyZXRjaEN1cikge1xuICAgICAgc3BhbnM6IGZvciAodmFyIGogPSAwOyBqIDwgc3RyZXRjaEN1ci5sZW5ndGg7ICsraikge1xuICAgICAgICB2YXIgc3BhbiA9IHN0cmV0Y2hDdXJbal07XG4gICAgICAgIGZvciAodmFyIGsgPSAwOyBrIDwgb2xkQ3VyLmxlbmd0aDsgKytrKVxuICAgICAgICAgIHsgaWYgKG9sZEN1cltrXS5tYXJrZXIgPT0gc3Bhbi5tYXJrZXIpIHsgY29udGludWUgc3BhbnMgfSB9XG4gICAgICAgIG9sZEN1ci5wdXNoKHNwYW4pO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3RyZXRjaEN1cikge1xuICAgICAgb2xkW2ldID0gc3RyZXRjaEN1cjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG9sZFxufVxuXG4vLyBVc2VkIGJvdGggdG8gcHJvdmlkZSBhIEpTT04tc2FmZSBvYmplY3QgaW4gLmdldEhpc3RvcnksIGFuZCwgd2hlblxuLy8gZGV0YWNoaW5nIGEgZG9jdW1lbnQsIHRvIHNwbGl0IHRoZSBoaXN0b3J5IGluIHR3b1xuZnVuY3Rpb24gY29weUhpc3RvcnlBcnJheShldmVudHMsIG5ld0dyb3VwLCBpbnN0YW50aWF0ZVNlbCkge1xuICB2YXIgY29weSA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7ICsraSkge1xuICAgIHZhciBldmVudCA9IGV2ZW50c1tpXTtcbiAgICBpZiAoZXZlbnQucmFuZ2VzKSB7XG4gICAgICBjb3B5LnB1c2goaW5zdGFudGlhdGVTZWwgPyBTZWxlY3Rpb24ucHJvdG90eXBlLmRlZXBDb3B5LmNhbGwoZXZlbnQpIDogZXZlbnQpO1xuICAgICAgY29udGludWVcbiAgICB9XG4gICAgdmFyIGNoYW5nZXMgPSBldmVudC5jaGFuZ2VzLCBuZXdDaGFuZ2VzID0gW107XG4gICAgY29weS5wdXNoKHtjaGFuZ2VzOiBuZXdDaGFuZ2VzfSk7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBjaGFuZ2VzLmxlbmd0aDsgKytqKSB7XG4gICAgICB2YXIgY2hhbmdlID0gY2hhbmdlc1tqXSwgbSA9ICh2b2lkIDApO1xuICAgICAgbmV3Q2hhbmdlcy5wdXNoKHtmcm9tOiBjaGFuZ2UuZnJvbSwgdG86IGNoYW5nZS50bywgdGV4dDogY2hhbmdlLnRleHR9KTtcbiAgICAgIGlmIChuZXdHcm91cCkgeyBmb3IgKHZhciBwcm9wIGluIGNoYW5nZSkgeyBpZiAobSA9IHByb3AubWF0Y2goL15zcGFuc18oXFxkKykkLykpIHtcbiAgICAgICAgaWYgKGluZGV4T2YobmV3R3JvdXAsIE51bWJlcihtWzFdKSkgPiAtMSkge1xuICAgICAgICAgIGxzdChuZXdDaGFuZ2VzKVtwcm9wXSA9IGNoYW5nZVtwcm9wXTtcbiAgICAgICAgICBkZWxldGUgY2hhbmdlW3Byb3BdO1xuICAgICAgICB9XG4gICAgICB9IH0gfVxuICAgIH1cbiAgfVxuICByZXR1cm4gY29weVxufVxuXG4vLyBUaGUgJ3Njcm9sbCcgcGFyYW1ldGVyIGdpdmVuIHRvIG1hbnkgb2YgdGhlc2UgaW5kaWNhdGVkIHdoZXRoZXJcbi8vIHRoZSBuZXcgY3Vyc29yIHBvc2l0aW9uIHNob3VsZCBiZSBzY3JvbGxlZCBpbnRvIHZpZXcgYWZ0ZXJcbi8vIG1vZGlmeWluZyB0aGUgc2VsZWN0aW9uLlxuXG4vLyBJZiBzaGlmdCBpcyBoZWxkIG9yIHRoZSBleHRlbmQgZmxhZyBpcyBzZXQsIGV4dGVuZHMgYSByYW5nZSB0b1xuLy8gaW5jbHVkZSBhIGdpdmVuIHBvc2l0aW9uIChhbmQgb3B0aW9uYWxseSBhIHNlY29uZCBwb3NpdGlvbikuXG4vLyBPdGhlcndpc2UsIHNpbXBseSByZXR1cm5zIHRoZSByYW5nZSBiZXR3ZWVuIHRoZSBnaXZlbiBwb3NpdGlvbnMuXG4vLyBVc2VkIGZvciBjdXJzb3IgbW90aW9uIGFuZCBzdWNoLlxuZnVuY3Rpb24gZXh0ZW5kUmFuZ2UocmFuZ2UsIGhlYWQsIG90aGVyLCBleHRlbmQpIHtcbiAgaWYgKGV4dGVuZCkge1xuICAgIHZhciBhbmNob3IgPSByYW5nZS5hbmNob3I7XG4gICAgaWYgKG90aGVyKSB7XG4gICAgICB2YXIgcG9zQmVmb3JlID0gY21wKGhlYWQsIGFuY2hvcikgPCAwO1xuICAgICAgaWYgKHBvc0JlZm9yZSAhPSAoY21wKG90aGVyLCBhbmNob3IpIDwgMCkpIHtcbiAgICAgICAgYW5jaG9yID0gaGVhZDtcbiAgICAgICAgaGVhZCA9IG90aGVyO1xuICAgICAgfSBlbHNlIGlmIChwb3NCZWZvcmUgIT0gKGNtcChoZWFkLCBvdGhlcikgPCAwKSkge1xuICAgICAgICBoZWFkID0gb3RoZXI7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXcgUmFuZ2UoYW5jaG9yLCBoZWFkKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBuZXcgUmFuZ2Uob3RoZXIgfHwgaGVhZCwgaGVhZClcbiAgfVxufVxuXG4vLyBFeHRlbmQgdGhlIHByaW1hcnkgc2VsZWN0aW9uIHJhbmdlLCBkaXNjYXJkIHRoZSByZXN0LlxuZnVuY3Rpb24gZXh0ZW5kU2VsZWN0aW9uKGRvYywgaGVhZCwgb3RoZXIsIG9wdGlvbnMsIGV4dGVuZCkge1xuICBpZiAoZXh0ZW5kID09IG51bGwpIHsgZXh0ZW5kID0gZG9jLmNtICYmIChkb2MuY20uZGlzcGxheS5zaGlmdCB8fCBkb2MuZXh0ZW5kKTsgfVxuICBzZXRTZWxlY3Rpb24oZG9jLCBuZXcgU2VsZWN0aW9uKFtleHRlbmRSYW5nZShkb2Muc2VsLnByaW1hcnkoKSwgaGVhZCwgb3RoZXIsIGV4dGVuZCldLCAwKSwgb3B0aW9ucyk7XG59XG5cbi8vIEV4dGVuZCBhbGwgc2VsZWN0aW9ucyAocG9zIGlzIGFuIGFycmF5IG9mIHNlbGVjdGlvbnMgd2l0aCBsZW5ndGhcbi8vIGVxdWFsIHRoZSBudW1iZXIgb2Ygc2VsZWN0aW9ucylcbmZ1bmN0aW9uIGV4dGVuZFNlbGVjdGlvbnMoZG9jLCBoZWFkcywgb3B0aW9ucykge1xuICB2YXIgb3V0ID0gW107XG4gIHZhciBleHRlbmQgPSBkb2MuY20gJiYgKGRvYy5jbS5kaXNwbGF5LnNoaWZ0IHx8IGRvYy5leHRlbmQpO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGRvYy5zZWwucmFuZ2VzLmxlbmd0aDsgaSsrKVxuICAgIHsgb3V0W2ldID0gZXh0ZW5kUmFuZ2UoZG9jLnNlbC5yYW5nZXNbaV0sIGhlYWRzW2ldLCBudWxsLCBleHRlbmQpOyB9XG4gIHZhciBuZXdTZWwgPSBub3JtYWxpemVTZWxlY3Rpb24ob3V0LCBkb2Muc2VsLnByaW1JbmRleCk7XG4gIHNldFNlbGVjdGlvbihkb2MsIG5ld1NlbCwgb3B0aW9ucyk7XG59XG5cbi8vIFVwZGF0ZXMgYSBzaW5nbGUgcmFuZ2UgaW4gdGhlIHNlbGVjdGlvbi5cbmZ1bmN0aW9uIHJlcGxhY2VPbmVTZWxlY3Rpb24oZG9jLCBpLCByYW5nZSwgb3B0aW9ucykge1xuICB2YXIgcmFuZ2VzID0gZG9jLnNlbC5yYW5nZXMuc2xpY2UoMCk7XG4gIHJhbmdlc1tpXSA9IHJhbmdlO1xuICBzZXRTZWxlY3Rpb24oZG9jLCBub3JtYWxpemVTZWxlY3Rpb24ocmFuZ2VzLCBkb2Muc2VsLnByaW1JbmRleCksIG9wdGlvbnMpO1xufVxuXG4vLyBSZXNldCB0aGUgc2VsZWN0aW9uIHRvIGEgc2luZ2xlIHJhbmdlLlxuZnVuY3Rpb24gc2V0U2ltcGxlU2VsZWN0aW9uKGRvYywgYW5jaG9yLCBoZWFkLCBvcHRpb25zKSB7XG4gIHNldFNlbGVjdGlvbihkb2MsIHNpbXBsZVNlbGVjdGlvbihhbmNob3IsIGhlYWQpLCBvcHRpb25zKTtcbn1cblxuLy8gR2l2ZSBiZWZvcmVTZWxlY3Rpb25DaGFuZ2UgaGFuZGxlcnMgYSBjaGFuZ2UgdG8gaW5mbHVlbmNlIGFcbi8vIHNlbGVjdGlvbiB1cGRhdGUuXG5mdW5jdGlvbiBmaWx0ZXJTZWxlY3Rpb25DaGFuZ2UoZG9jLCBzZWwsIG9wdGlvbnMpIHtcbiAgdmFyIG9iaiA9IHtcbiAgICByYW5nZXM6IHNlbC5yYW5nZXMsXG4gICAgdXBkYXRlOiBmdW5jdGlvbihyYW5nZXMpIHtcbiAgICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gICAgICB0aGlzLnJhbmdlcyA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByYW5nZXMubGVuZ3RoOyBpKyspXG4gICAgICAgIHsgdGhpcyQxLnJhbmdlc1tpXSA9IG5ldyBSYW5nZShjbGlwUG9zKGRvYywgcmFuZ2VzW2ldLmFuY2hvciksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsaXBQb3MoZG9jLCByYW5nZXNbaV0uaGVhZCkpOyB9XG4gICAgfSxcbiAgICBvcmlnaW46IG9wdGlvbnMgJiYgb3B0aW9ucy5vcmlnaW5cbiAgfTtcbiAgc2lnbmFsKGRvYywgXCJiZWZvcmVTZWxlY3Rpb25DaGFuZ2VcIiwgZG9jLCBvYmopO1xuICBpZiAoZG9jLmNtKSB7IHNpZ25hbChkb2MuY20sIFwiYmVmb3JlU2VsZWN0aW9uQ2hhbmdlXCIsIGRvYy5jbSwgb2JqKTsgfVxuICBpZiAob2JqLnJhbmdlcyAhPSBzZWwucmFuZ2VzKSB7IHJldHVybiBub3JtYWxpemVTZWxlY3Rpb24ob2JqLnJhbmdlcywgb2JqLnJhbmdlcy5sZW5ndGggLSAxKSB9XG4gIGVsc2UgeyByZXR1cm4gc2VsIH1cbn1cblxuZnVuY3Rpb24gc2V0U2VsZWN0aW9uUmVwbGFjZUhpc3RvcnkoZG9jLCBzZWwsIG9wdGlvbnMpIHtcbiAgdmFyIGRvbmUgPSBkb2MuaGlzdG9yeS5kb25lLCBsYXN0ID0gbHN0KGRvbmUpO1xuICBpZiAobGFzdCAmJiBsYXN0LnJhbmdlcykge1xuICAgIGRvbmVbZG9uZS5sZW5ndGggLSAxXSA9IHNlbDtcbiAgICBzZXRTZWxlY3Rpb25Ob1VuZG8oZG9jLCBzZWwsIG9wdGlvbnMpO1xuICB9IGVsc2Uge1xuICAgIHNldFNlbGVjdGlvbihkb2MsIHNlbCwgb3B0aW9ucyk7XG4gIH1cbn1cblxuLy8gU2V0IGEgbmV3IHNlbGVjdGlvbi5cbmZ1bmN0aW9uIHNldFNlbGVjdGlvbihkb2MsIHNlbCwgb3B0aW9ucykge1xuICBzZXRTZWxlY3Rpb25Ob1VuZG8oZG9jLCBzZWwsIG9wdGlvbnMpO1xuICBhZGRTZWxlY3Rpb25Ub0hpc3RvcnkoZG9jLCBkb2Muc2VsLCBkb2MuY20gPyBkb2MuY20uY3VyT3AuaWQgOiBOYU4sIG9wdGlvbnMpO1xufVxuXG5mdW5jdGlvbiBzZXRTZWxlY3Rpb25Ob1VuZG8oZG9jLCBzZWwsIG9wdGlvbnMpIHtcbiAgaWYgKGhhc0hhbmRsZXIoZG9jLCBcImJlZm9yZVNlbGVjdGlvbkNoYW5nZVwiKSB8fCBkb2MuY20gJiYgaGFzSGFuZGxlcihkb2MuY20sIFwiYmVmb3JlU2VsZWN0aW9uQ2hhbmdlXCIpKVxuICAgIHsgc2VsID0gZmlsdGVyU2VsZWN0aW9uQ2hhbmdlKGRvYywgc2VsLCBvcHRpb25zKTsgfVxuXG4gIHZhciBiaWFzID0gb3B0aW9ucyAmJiBvcHRpb25zLmJpYXMgfHxcbiAgICAoY21wKHNlbC5wcmltYXJ5KCkuaGVhZCwgZG9jLnNlbC5wcmltYXJ5KCkuaGVhZCkgPCAwID8gLTEgOiAxKTtcbiAgc2V0U2VsZWN0aW9uSW5uZXIoZG9jLCBza2lwQXRvbWljSW5TZWxlY3Rpb24oZG9jLCBzZWwsIGJpYXMsIHRydWUpKTtcblxuICBpZiAoIShvcHRpb25zICYmIG9wdGlvbnMuc2Nyb2xsID09PSBmYWxzZSkgJiYgZG9jLmNtKVxuICAgIHsgZW5zdXJlQ3Vyc29yVmlzaWJsZShkb2MuY20pOyB9XG59XG5cbmZ1bmN0aW9uIHNldFNlbGVjdGlvbklubmVyKGRvYywgc2VsKSB7XG4gIGlmIChzZWwuZXF1YWxzKGRvYy5zZWwpKSB7IHJldHVybiB9XG5cbiAgZG9jLnNlbCA9IHNlbDtcblxuICBpZiAoZG9jLmNtKSB7XG4gICAgZG9jLmNtLmN1ck9wLnVwZGF0ZUlucHV0ID0gZG9jLmNtLmN1ck9wLnNlbGVjdGlvbkNoYW5nZWQgPSB0cnVlO1xuICAgIHNpZ25hbEN1cnNvckFjdGl2aXR5KGRvYy5jbSk7XG4gIH1cbiAgc2lnbmFsTGF0ZXIoZG9jLCBcImN1cnNvckFjdGl2aXR5XCIsIGRvYyk7XG59XG5cbi8vIFZlcmlmeSB0aGF0IHRoZSBzZWxlY3Rpb24gZG9lcyBub3QgcGFydGlhbGx5IHNlbGVjdCBhbnkgYXRvbWljXG4vLyBtYXJrZWQgcmFuZ2VzLlxuZnVuY3Rpb24gcmVDaGVja1NlbGVjdGlvbihkb2MpIHtcbiAgc2V0U2VsZWN0aW9uSW5uZXIoZG9jLCBza2lwQXRvbWljSW5TZWxlY3Rpb24oZG9jLCBkb2Muc2VsLCBudWxsLCBmYWxzZSkpO1xufVxuXG4vLyBSZXR1cm4gYSBzZWxlY3Rpb24gdGhhdCBkb2VzIG5vdCBwYXJ0aWFsbHkgc2VsZWN0IGFueSBhdG9taWNcbi8vIHJhbmdlcy5cbmZ1bmN0aW9uIHNraXBBdG9taWNJblNlbGVjdGlvbihkb2MsIHNlbCwgYmlhcywgbWF5Q2xlYXIpIHtcbiAgdmFyIG91dDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWwucmFuZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHJhbmdlID0gc2VsLnJhbmdlc1tpXTtcbiAgICB2YXIgb2xkID0gc2VsLnJhbmdlcy5sZW5ndGggPT0gZG9jLnNlbC5yYW5nZXMubGVuZ3RoICYmIGRvYy5zZWwucmFuZ2VzW2ldO1xuICAgIHZhciBuZXdBbmNob3IgPSBza2lwQXRvbWljKGRvYywgcmFuZ2UuYW5jaG9yLCBvbGQgJiYgb2xkLmFuY2hvciwgYmlhcywgbWF5Q2xlYXIpO1xuICAgIHZhciBuZXdIZWFkID0gc2tpcEF0b21pYyhkb2MsIHJhbmdlLmhlYWQsIG9sZCAmJiBvbGQuaGVhZCwgYmlhcywgbWF5Q2xlYXIpO1xuICAgIGlmIChvdXQgfHwgbmV3QW5jaG9yICE9IHJhbmdlLmFuY2hvciB8fCBuZXdIZWFkICE9IHJhbmdlLmhlYWQpIHtcbiAgICAgIGlmICghb3V0KSB7IG91dCA9IHNlbC5yYW5nZXMuc2xpY2UoMCwgaSk7IH1cbiAgICAgIG91dFtpXSA9IG5ldyBSYW5nZShuZXdBbmNob3IsIG5ld0hlYWQpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gb3V0ID8gbm9ybWFsaXplU2VsZWN0aW9uKG91dCwgc2VsLnByaW1JbmRleCkgOiBzZWxcbn1cblxuZnVuY3Rpb24gc2tpcEF0b21pY0lubmVyKGRvYywgcG9zLCBvbGRQb3MsIGRpciwgbWF5Q2xlYXIpIHtcbiAgdmFyIGxpbmUgPSBnZXRMaW5lKGRvYywgcG9zLmxpbmUpO1xuICBpZiAobGluZS5tYXJrZWRTcGFucykgeyBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmUubWFya2VkU3BhbnMubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgc3AgPSBsaW5lLm1hcmtlZFNwYW5zW2ldLCBtID0gc3AubWFya2VyO1xuICAgIGlmICgoc3AuZnJvbSA9PSBudWxsIHx8IChtLmluY2x1c2l2ZUxlZnQgPyBzcC5mcm9tIDw9IHBvcy5jaCA6IHNwLmZyb20gPCBwb3MuY2gpKSAmJlxuICAgICAgICAoc3AudG8gPT0gbnVsbCB8fCAobS5pbmNsdXNpdmVSaWdodCA/IHNwLnRvID49IHBvcy5jaCA6IHNwLnRvID4gcG9zLmNoKSkpIHtcbiAgICAgIGlmIChtYXlDbGVhcikge1xuICAgICAgICBzaWduYWwobSwgXCJiZWZvcmVDdXJzb3JFbnRlclwiKTtcbiAgICAgICAgaWYgKG0uZXhwbGljaXRseUNsZWFyZWQpIHtcbiAgICAgICAgICBpZiAoIWxpbmUubWFya2VkU3BhbnMpIHsgYnJlYWsgfVxuICAgICAgICAgIGVsc2Ugey0taTsgY29udGludWV9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICghbS5hdG9taWMpIHsgY29udGludWUgfVxuXG4gICAgICBpZiAob2xkUG9zKSB7XG4gICAgICAgIHZhciBuZWFyID0gbS5maW5kKGRpciA8IDAgPyAxIDogLTEpLCBkaWZmID0gKHZvaWQgMCk7XG4gICAgICAgIGlmIChkaXIgPCAwID8gbS5pbmNsdXNpdmVSaWdodCA6IG0uaW5jbHVzaXZlTGVmdClcbiAgICAgICAgICB7IG5lYXIgPSBtb3ZlUG9zKGRvYywgbmVhciwgLWRpciwgbmVhciAmJiBuZWFyLmxpbmUgPT0gcG9zLmxpbmUgPyBsaW5lIDogbnVsbCk7IH1cbiAgICAgICAgaWYgKG5lYXIgJiYgbmVhci5saW5lID09IHBvcy5saW5lICYmIChkaWZmID0gY21wKG5lYXIsIG9sZFBvcykpICYmIChkaXIgPCAwID8gZGlmZiA8IDAgOiBkaWZmID4gMCkpXG4gICAgICAgICAgeyByZXR1cm4gc2tpcEF0b21pY0lubmVyKGRvYywgbmVhciwgcG9zLCBkaXIsIG1heUNsZWFyKSB9XG4gICAgICB9XG5cbiAgICAgIHZhciBmYXIgPSBtLmZpbmQoZGlyIDwgMCA/IC0xIDogMSk7XG4gICAgICBpZiAoZGlyIDwgMCA/IG0uaW5jbHVzaXZlTGVmdCA6IG0uaW5jbHVzaXZlUmlnaHQpXG4gICAgICAgIHsgZmFyID0gbW92ZVBvcyhkb2MsIGZhciwgZGlyLCBmYXIubGluZSA9PSBwb3MubGluZSA/IGxpbmUgOiBudWxsKTsgfVxuICAgICAgcmV0dXJuIGZhciA/IHNraXBBdG9taWNJbm5lcihkb2MsIGZhciwgcG9zLCBkaXIsIG1heUNsZWFyKSA6IG51bGxcbiAgICB9XG4gIH0gfVxuICByZXR1cm4gcG9zXG59XG5cbi8vIEVuc3VyZSBhIGdpdmVuIHBvc2l0aW9uIGlzIG5vdCBpbnNpZGUgYW4gYXRvbWljIHJhbmdlLlxuZnVuY3Rpb24gc2tpcEF0b21pYyhkb2MsIHBvcywgb2xkUG9zLCBiaWFzLCBtYXlDbGVhcikge1xuICB2YXIgZGlyID0gYmlhcyB8fCAxO1xuICB2YXIgZm91bmQgPSBza2lwQXRvbWljSW5uZXIoZG9jLCBwb3MsIG9sZFBvcywgZGlyLCBtYXlDbGVhcikgfHxcbiAgICAgICghbWF5Q2xlYXIgJiYgc2tpcEF0b21pY0lubmVyKGRvYywgcG9zLCBvbGRQb3MsIGRpciwgdHJ1ZSkpIHx8XG4gICAgICBza2lwQXRvbWljSW5uZXIoZG9jLCBwb3MsIG9sZFBvcywgLWRpciwgbWF5Q2xlYXIpIHx8XG4gICAgICAoIW1heUNsZWFyICYmIHNraXBBdG9taWNJbm5lcihkb2MsIHBvcywgb2xkUG9zLCAtZGlyLCB0cnVlKSk7XG4gIGlmICghZm91bmQpIHtcbiAgICBkb2MuY2FudEVkaXQgPSB0cnVlO1xuICAgIHJldHVybiBQb3MoZG9jLmZpcnN0LCAwKVxuICB9XG4gIHJldHVybiBmb3VuZFxufVxuXG5mdW5jdGlvbiBtb3ZlUG9zKGRvYywgcG9zLCBkaXIsIGxpbmUpIHtcbiAgaWYgKGRpciA8IDAgJiYgcG9zLmNoID09IDApIHtcbiAgICBpZiAocG9zLmxpbmUgPiBkb2MuZmlyc3QpIHsgcmV0dXJuIGNsaXBQb3MoZG9jLCBQb3MocG9zLmxpbmUgLSAxKSkgfVxuICAgIGVsc2UgeyByZXR1cm4gbnVsbCB9XG4gIH0gZWxzZSBpZiAoZGlyID4gMCAmJiBwb3MuY2ggPT0gKGxpbmUgfHwgZ2V0TGluZShkb2MsIHBvcy5saW5lKSkudGV4dC5sZW5ndGgpIHtcbiAgICBpZiAocG9zLmxpbmUgPCBkb2MuZmlyc3QgKyBkb2Muc2l6ZSAtIDEpIHsgcmV0dXJuIFBvcyhwb3MubGluZSArIDEsIDApIH1cbiAgICBlbHNlIHsgcmV0dXJuIG51bGwgfVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBuZXcgUG9zKHBvcy5saW5lLCBwb3MuY2ggKyBkaXIpXG4gIH1cbn1cblxuZnVuY3Rpb24gc2VsZWN0QWxsKGNtKSB7XG4gIGNtLnNldFNlbGVjdGlvbihQb3MoY20uZmlyc3RMaW5lKCksIDApLCBQb3MoY20ubGFzdExpbmUoKSksIHNlbF9kb250U2Nyb2xsKTtcbn1cblxuLy8gVVBEQVRJTkdcblxuLy8gQWxsb3cgXCJiZWZvcmVDaGFuZ2VcIiBldmVudCBoYW5kbGVycyB0byBpbmZsdWVuY2UgYSBjaGFuZ2VcbmZ1bmN0aW9uIGZpbHRlckNoYW5nZShkb2MsIGNoYW5nZSwgdXBkYXRlKSB7XG4gIHZhciBvYmogPSB7XG4gICAgY2FuY2VsZWQ6IGZhbHNlLFxuICAgIGZyb206IGNoYW5nZS5mcm9tLFxuICAgIHRvOiBjaGFuZ2UudG8sXG4gICAgdGV4dDogY2hhbmdlLnRleHQsXG4gICAgb3JpZ2luOiBjaGFuZ2Uub3JpZ2luLFxuICAgIGNhbmNlbDogZnVuY3Rpb24gKCkgeyByZXR1cm4gb2JqLmNhbmNlbGVkID0gdHJ1ZTsgfVxuICB9O1xuICBpZiAodXBkYXRlKSB7IG9iai51cGRhdGUgPSBmdW5jdGlvbiAoZnJvbSwgdG8sIHRleHQsIG9yaWdpbikge1xuICAgIGlmIChmcm9tKSB7IG9iai5mcm9tID0gY2xpcFBvcyhkb2MsIGZyb20pOyB9XG4gICAgaWYgKHRvKSB7IG9iai50byA9IGNsaXBQb3MoZG9jLCB0byk7IH1cbiAgICBpZiAodGV4dCkgeyBvYmoudGV4dCA9IHRleHQ7IH1cbiAgICBpZiAob3JpZ2luICE9PSB1bmRlZmluZWQpIHsgb2JqLm9yaWdpbiA9IG9yaWdpbjsgfVxuICB9OyB9XG4gIHNpZ25hbChkb2MsIFwiYmVmb3JlQ2hhbmdlXCIsIGRvYywgb2JqKTtcbiAgaWYgKGRvYy5jbSkgeyBzaWduYWwoZG9jLmNtLCBcImJlZm9yZUNoYW5nZVwiLCBkb2MuY20sIG9iaik7IH1cblxuICBpZiAob2JqLmNhbmNlbGVkKSB7IHJldHVybiBudWxsIH1cbiAgcmV0dXJuIHtmcm9tOiBvYmouZnJvbSwgdG86IG9iai50bywgdGV4dDogb2JqLnRleHQsIG9yaWdpbjogb2JqLm9yaWdpbn1cbn1cblxuLy8gQXBwbHkgYSBjaGFuZ2UgdG8gYSBkb2N1bWVudCwgYW5kIGFkZCBpdCB0byB0aGUgZG9jdW1lbnQnc1xuLy8gaGlzdG9yeSwgYW5kIHByb3BhZ2F0aW5nIGl0IHRvIGFsbCBsaW5rZWQgZG9jdW1lbnRzLlxuZnVuY3Rpb24gbWFrZUNoYW5nZShkb2MsIGNoYW5nZSwgaWdub3JlUmVhZE9ubHkpIHtcbiAgaWYgKGRvYy5jbSkge1xuICAgIGlmICghZG9jLmNtLmN1ck9wKSB7IHJldHVybiBvcGVyYXRpb24oZG9jLmNtLCBtYWtlQ2hhbmdlKShkb2MsIGNoYW5nZSwgaWdub3JlUmVhZE9ubHkpIH1cbiAgICBpZiAoZG9jLmNtLnN0YXRlLnN1cHByZXNzRWRpdHMpIHsgcmV0dXJuIH1cbiAgfVxuXG4gIGlmIChoYXNIYW5kbGVyKGRvYywgXCJiZWZvcmVDaGFuZ2VcIikgfHwgZG9jLmNtICYmIGhhc0hhbmRsZXIoZG9jLmNtLCBcImJlZm9yZUNoYW5nZVwiKSkge1xuICAgIGNoYW5nZSA9IGZpbHRlckNoYW5nZShkb2MsIGNoYW5nZSwgdHJ1ZSk7XG4gICAgaWYgKCFjaGFuZ2UpIHsgcmV0dXJuIH1cbiAgfVxuXG4gIC8vIFBvc3NpYmx5IHNwbGl0IG9yIHN1cHByZXNzIHRoZSB1cGRhdGUgYmFzZWQgb24gdGhlIHByZXNlbmNlXG4gIC8vIG9mIHJlYWQtb25seSBzcGFucyBpbiBpdHMgcmFuZ2UuXG4gIHZhciBzcGxpdCA9IHNhd1JlYWRPbmx5U3BhbnMgJiYgIWlnbm9yZVJlYWRPbmx5ICYmIHJlbW92ZVJlYWRPbmx5UmFuZ2VzKGRvYywgY2hhbmdlLmZyb20sIGNoYW5nZS50byk7XG4gIGlmIChzcGxpdCkge1xuICAgIGZvciAodmFyIGkgPSBzcGxpdC5sZW5ndGggLSAxOyBpID49IDA7IC0taSlcbiAgICAgIHsgbWFrZUNoYW5nZUlubmVyKGRvYywge2Zyb206IHNwbGl0W2ldLmZyb20sIHRvOiBzcGxpdFtpXS50bywgdGV4dDogaSA/IFtcIlwiXSA6IGNoYW5nZS50ZXh0LCBvcmlnaW46IGNoYW5nZS5vcmlnaW59KTsgfVxuICB9IGVsc2Uge1xuICAgIG1ha2VDaGFuZ2VJbm5lcihkb2MsIGNoYW5nZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWFrZUNoYW5nZUlubmVyKGRvYywgY2hhbmdlKSB7XG4gIGlmIChjaGFuZ2UudGV4dC5sZW5ndGggPT0gMSAmJiBjaGFuZ2UudGV4dFswXSA9PSBcIlwiICYmIGNtcChjaGFuZ2UuZnJvbSwgY2hhbmdlLnRvKSA9PSAwKSB7IHJldHVybiB9XG4gIHZhciBzZWxBZnRlciA9IGNvbXB1dGVTZWxBZnRlckNoYW5nZShkb2MsIGNoYW5nZSk7XG4gIGFkZENoYW5nZVRvSGlzdG9yeShkb2MsIGNoYW5nZSwgc2VsQWZ0ZXIsIGRvYy5jbSA/IGRvYy5jbS5jdXJPcC5pZCA6IE5hTik7XG5cbiAgbWFrZUNoYW5nZVNpbmdsZURvYyhkb2MsIGNoYW5nZSwgc2VsQWZ0ZXIsIHN0cmV0Y2hTcGFuc092ZXJDaGFuZ2UoZG9jLCBjaGFuZ2UpKTtcbiAgdmFyIHJlYmFzZWQgPSBbXTtcblxuICBsaW5rZWREb2NzKGRvYywgZnVuY3Rpb24gKGRvYywgc2hhcmVkSGlzdCkge1xuICAgIGlmICghc2hhcmVkSGlzdCAmJiBpbmRleE9mKHJlYmFzZWQsIGRvYy5oaXN0b3J5KSA9PSAtMSkge1xuICAgICAgcmViYXNlSGlzdChkb2MuaGlzdG9yeSwgY2hhbmdlKTtcbiAgICAgIHJlYmFzZWQucHVzaChkb2MuaGlzdG9yeSk7XG4gICAgfVxuICAgIG1ha2VDaGFuZ2VTaW5nbGVEb2MoZG9jLCBjaGFuZ2UsIG51bGwsIHN0cmV0Y2hTcGFuc092ZXJDaGFuZ2UoZG9jLCBjaGFuZ2UpKTtcbiAgfSk7XG59XG5cbi8vIFJldmVydCBhIGNoYW5nZSBzdG9yZWQgaW4gYSBkb2N1bWVudCdzIGhpc3RvcnkuXG5mdW5jdGlvbiBtYWtlQ2hhbmdlRnJvbUhpc3RvcnkoZG9jLCB0eXBlLCBhbGxvd1NlbGVjdGlvbk9ubHkpIHtcbiAgdmFyIHN1cHByZXNzID0gZG9jLmNtICYmIGRvYy5jbS5zdGF0ZS5zdXBwcmVzc0VkaXRzO1xuICBpZiAoc3VwcHJlc3MgJiYgIWFsbG93U2VsZWN0aW9uT25seSkgeyByZXR1cm4gfVxuXG4gIHZhciBoaXN0ID0gZG9jLmhpc3RvcnksIGV2ZW50LCBzZWxBZnRlciA9IGRvYy5zZWw7XG4gIHZhciBzb3VyY2UgPSB0eXBlID09IFwidW5kb1wiID8gaGlzdC5kb25lIDogaGlzdC51bmRvbmUsIGRlc3QgPSB0eXBlID09IFwidW5kb1wiID8gaGlzdC51bmRvbmUgOiBoaXN0LmRvbmU7XG5cbiAgLy8gVmVyaWZ5IHRoYXQgdGhlcmUgaXMgYSB1c2VhYmxlIGV2ZW50IChzbyB0aGF0IGN0cmwteiB3b24ndFxuICAvLyBuZWVkbGVzc2x5IGNsZWFyIHNlbGVjdGlvbiBldmVudHMpXG4gIHZhciBpID0gMDtcbiAgZm9yICg7IGkgPCBzb3VyY2UubGVuZ3RoOyBpKyspIHtcbiAgICBldmVudCA9IHNvdXJjZVtpXTtcbiAgICBpZiAoYWxsb3dTZWxlY3Rpb25Pbmx5ID8gZXZlbnQucmFuZ2VzICYmICFldmVudC5lcXVhbHMoZG9jLnNlbCkgOiAhZXZlbnQucmFuZ2VzKVxuICAgICAgeyBicmVhayB9XG4gIH1cbiAgaWYgKGkgPT0gc291cmNlLmxlbmd0aCkgeyByZXR1cm4gfVxuICBoaXN0Lmxhc3RPcmlnaW4gPSBoaXN0Lmxhc3RTZWxPcmlnaW4gPSBudWxsO1xuXG4gIGZvciAoOzspIHtcbiAgICBldmVudCA9IHNvdXJjZS5wb3AoKTtcbiAgICBpZiAoZXZlbnQucmFuZ2VzKSB7XG4gICAgICBwdXNoU2VsZWN0aW9uVG9IaXN0b3J5KGV2ZW50LCBkZXN0KTtcbiAgICAgIGlmIChhbGxvd1NlbGVjdGlvbk9ubHkgJiYgIWV2ZW50LmVxdWFscyhkb2Muc2VsKSkge1xuICAgICAgICBzZXRTZWxlY3Rpb24oZG9jLCBldmVudCwge2NsZWFyUmVkbzogZmFsc2V9KTtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBzZWxBZnRlciA9IGV2ZW50O1xuICAgIH0gZWxzZSBpZiAoc3VwcHJlc3MpIHtcbiAgICAgIHNvdXJjZS5wdXNoKGV2ZW50KTtcbiAgICAgIHJldHVyblxuICAgIH0gZWxzZSB7IGJyZWFrIH1cbiAgfVxuXG4gIC8vIEJ1aWxkIHVwIGEgcmV2ZXJzZSBjaGFuZ2Ugb2JqZWN0IHRvIGFkZCB0byB0aGUgb3Bwb3NpdGUgaGlzdG9yeVxuICAvLyBzdGFjayAocmVkbyB3aGVuIHVuZG9pbmcsIGFuZCB2aWNlIHZlcnNhKS5cbiAgdmFyIGFudGlDaGFuZ2VzID0gW107XG4gIHB1c2hTZWxlY3Rpb25Ub0hpc3Rvcnkoc2VsQWZ0ZXIsIGRlc3QpO1xuICBkZXN0LnB1c2goe2NoYW5nZXM6IGFudGlDaGFuZ2VzLCBnZW5lcmF0aW9uOiBoaXN0LmdlbmVyYXRpb259KTtcbiAgaGlzdC5nZW5lcmF0aW9uID0gZXZlbnQuZ2VuZXJhdGlvbiB8fCArK2hpc3QubWF4R2VuZXJhdGlvbjtcblxuICB2YXIgZmlsdGVyID0gaGFzSGFuZGxlcihkb2MsIFwiYmVmb3JlQ2hhbmdlXCIpIHx8IGRvYy5jbSAmJiBoYXNIYW5kbGVyKGRvYy5jbSwgXCJiZWZvcmVDaGFuZ2VcIik7XG5cbiAgdmFyIGxvb3AgPSBmdW5jdGlvbiAoIGkgKSB7XG4gICAgdmFyIGNoYW5nZSA9IGV2ZW50LmNoYW5nZXNbaV07XG4gICAgY2hhbmdlLm9yaWdpbiA9IHR5cGU7XG4gICAgaWYgKGZpbHRlciAmJiAhZmlsdGVyQ2hhbmdlKGRvYywgY2hhbmdlLCBmYWxzZSkpIHtcbiAgICAgIHNvdXJjZS5sZW5ndGggPSAwO1xuICAgICAgcmV0dXJuIHt9XG4gICAgfVxuXG4gICAgYW50aUNoYW5nZXMucHVzaChoaXN0b3J5Q2hhbmdlRnJvbUNoYW5nZShkb2MsIGNoYW5nZSkpO1xuXG4gICAgdmFyIGFmdGVyID0gaSA/IGNvbXB1dGVTZWxBZnRlckNoYW5nZShkb2MsIGNoYW5nZSkgOiBsc3Qoc291cmNlKTtcbiAgICBtYWtlQ2hhbmdlU2luZ2xlRG9jKGRvYywgY2hhbmdlLCBhZnRlciwgbWVyZ2VPbGRTcGFucyhkb2MsIGNoYW5nZSkpO1xuICAgIGlmICghaSAmJiBkb2MuY20pIHsgZG9jLmNtLnNjcm9sbEludG9WaWV3KHtmcm9tOiBjaGFuZ2UuZnJvbSwgdG86IGNoYW5nZUVuZChjaGFuZ2UpfSk7IH1cbiAgICB2YXIgcmViYXNlZCA9IFtdO1xuXG4gICAgLy8gUHJvcGFnYXRlIHRvIHRoZSBsaW5rZWQgZG9jdW1lbnRzXG4gICAgbGlua2VkRG9jcyhkb2MsIGZ1bmN0aW9uIChkb2MsIHNoYXJlZEhpc3QpIHtcbiAgICAgIGlmICghc2hhcmVkSGlzdCAmJiBpbmRleE9mKHJlYmFzZWQsIGRvYy5oaXN0b3J5KSA9PSAtMSkge1xuICAgICAgICByZWJhc2VIaXN0KGRvYy5oaXN0b3J5LCBjaGFuZ2UpO1xuICAgICAgICByZWJhc2VkLnB1c2goZG9jLmhpc3RvcnkpO1xuICAgICAgfVxuICAgICAgbWFrZUNoYW5nZVNpbmdsZURvYyhkb2MsIGNoYW5nZSwgbnVsbCwgbWVyZ2VPbGRTcGFucyhkb2MsIGNoYW5nZSkpO1xuICAgIH0pO1xuICB9O1xuXG4gIGZvciAodmFyIGkkMSA9IGV2ZW50LmNoYW5nZXMubGVuZ3RoIC0gMTsgaSQxID49IDA7IC0taSQxKSB7XG4gICAgdmFyIHJldHVybmVkID0gbG9vcCggaSQxICk7XG5cbiAgICBpZiAoIHJldHVybmVkICkgcmV0dXJuIHJldHVybmVkLnY7XG4gIH1cbn1cblxuLy8gU3ViLXZpZXdzIG5lZWQgdGhlaXIgbGluZSBudW1iZXJzIHNoaWZ0ZWQgd2hlbiB0ZXh0IGlzIGFkZGVkXG4vLyBhYm92ZSBvciBiZWxvdyB0aGVtIGluIHRoZSBwYXJlbnQgZG9jdW1lbnQuXG5mdW5jdGlvbiBzaGlmdERvYyhkb2MsIGRpc3RhbmNlKSB7XG4gIGlmIChkaXN0YW5jZSA9PSAwKSB7IHJldHVybiB9XG4gIGRvYy5maXJzdCArPSBkaXN0YW5jZTtcbiAgZG9jLnNlbCA9IG5ldyBTZWxlY3Rpb24obWFwKGRvYy5zZWwucmFuZ2VzLCBmdW5jdGlvbiAocmFuZ2UpIHsgcmV0dXJuIG5ldyBSYW5nZShcbiAgICBQb3MocmFuZ2UuYW5jaG9yLmxpbmUgKyBkaXN0YW5jZSwgcmFuZ2UuYW5jaG9yLmNoKSxcbiAgICBQb3MocmFuZ2UuaGVhZC5saW5lICsgZGlzdGFuY2UsIHJhbmdlLmhlYWQuY2gpXG4gICk7IH0pLCBkb2Muc2VsLnByaW1JbmRleCk7XG4gIGlmIChkb2MuY20pIHtcbiAgICByZWdDaGFuZ2UoZG9jLmNtLCBkb2MuZmlyc3QsIGRvYy5maXJzdCAtIGRpc3RhbmNlLCBkaXN0YW5jZSk7XG4gICAgZm9yICh2YXIgZCA9IGRvYy5jbS5kaXNwbGF5LCBsID0gZC52aWV3RnJvbTsgbCA8IGQudmlld1RvOyBsKyspXG4gICAgICB7IHJlZ0xpbmVDaGFuZ2UoZG9jLmNtLCBsLCBcImd1dHRlclwiKTsgfVxuICB9XG59XG5cbi8vIE1vcmUgbG93ZXItbGV2ZWwgY2hhbmdlIGZ1bmN0aW9uLCBoYW5kbGluZyBvbmx5IGEgc2luZ2xlIGRvY3VtZW50XG4vLyAobm90IGxpbmtlZCBvbmVzKS5cbmZ1bmN0aW9uIG1ha2VDaGFuZ2VTaW5nbGVEb2MoZG9jLCBjaGFuZ2UsIHNlbEFmdGVyLCBzcGFucykge1xuICBpZiAoZG9jLmNtICYmICFkb2MuY20uY3VyT3ApXG4gICAgeyByZXR1cm4gb3BlcmF0aW9uKGRvYy5jbSwgbWFrZUNoYW5nZVNpbmdsZURvYykoZG9jLCBjaGFuZ2UsIHNlbEFmdGVyLCBzcGFucykgfVxuXG4gIGlmIChjaGFuZ2UudG8ubGluZSA8IGRvYy5maXJzdCkge1xuICAgIHNoaWZ0RG9jKGRvYywgY2hhbmdlLnRleHQubGVuZ3RoIC0gMSAtIChjaGFuZ2UudG8ubGluZSAtIGNoYW5nZS5mcm9tLmxpbmUpKTtcbiAgICByZXR1cm5cbiAgfVxuICBpZiAoY2hhbmdlLmZyb20ubGluZSA+IGRvYy5sYXN0TGluZSgpKSB7IHJldHVybiB9XG5cbiAgLy8gQ2xpcCB0aGUgY2hhbmdlIHRvIHRoZSBzaXplIG9mIHRoaXMgZG9jXG4gIGlmIChjaGFuZ2UuZnJvbS5saW5lIDwgZG9jLmZpcnN0KSB7XG4gICAgdmFyIHNoaWZ0ID0gY2hhbmdlLnRleHQubGVuZ3RoIC0gMSAtIChkb2MuZmlyc3QgLSBjaGFuZ2UuZnJvbS5saW5lKTtcbiAgICBzaGlmdERvYyhkb2MsIHNoaWZ0KTtcbiAgICBjaGFuZ2UgPSB7ZnJvbTogUG9zKGRvYy5maXJzdCwgMCksIHRvOiBQb3MoY2hhbmdlLnRvLmxpbmUgKyBzaGlmdCwgY2hhbmdlLnRvLmNoKSxcbiAgICAgICAgICAgICAgdGV4dDogW2xzdChjaGFuZ2UudGV4dCldLCBvcmlnaW46IGNoYW5nZS5vcmlnaW59O1xuICB9XG4gIHZhciBsYXN0ID0gZG9jLmxhc3RMaW5lKCk7XG4gIGlmIChjaGFuZ2UudG8ubGluZSA+IGxhc3QpIHtcbiAgICBjaGFuZ2UgPSB7ZnJvbTogY2hhbmdlLmZyb20sIHRvOiBQb3MobGFzdCwgZ2V0TGluZShkb2MsIGxhc3QpLnRleHQubGVuZ3RoKSxcbiAgICAgICAgICAgICAgdGV4dDogW2NoYW5nZS50ZXh0WzBdXSwgb3JpZ2luOiBjaGFuZ2Uub3JpZ2lufTtcbiAgfVxuXG4gIGNoYW5nZS5yZW1vdmVkID0gZ2V0QmV0d2Vlbihkb2MsIGNoYW5nZS5mcm9tLCBjaGFuZ2UudG8pO1xuXG4gIGlmICghc2VsQWZ0ZXIpIHsgc2VsQWZ0ZXIgPSBjb21wdXRlU2VsQWZ0ZXJDaGFuZ2UoZG9jLCBjaGFuZ2UpOyB9XG4gIGlmIChkb2MuY20pIHsgbWFrZUNoYW5nZVNpbmdsZURvY0luRWRpdG9yKGRvYy5jbSwgY2hhbmdlLCBzcGFucyk7IH1cbiAgZWxzZSB7IHVwZGF0ZURvYyhkb2MsIGNoYW5nZSwgc3BhbnMpOyB9XG4gIHNldFNlbGVjdGlvbk5vVW5kbyhkb2MsIHNlbEFmdGVyLCBzZWxfZG9udFNjcm9sbCk7XG59XG5cbi8vIEhhbmRsZSB0aGUgaW50ZXJhY3Rpb24gb2YgYSBjaGFuZ2UgdG8gYSBkb2N1bWVudCB3aXRoIHRoZSBlZGl0b3Jcbi8vIHRoYXQgdGhpcyBkb2N1bWVudCBpcyBwYXJ0IG9mLlxuZnVuY3Rpb24gbWFrZUNoYW5nZVNpbmdsZURvY0luRWRpdG9yKGNtLCBjaGFuZ2UsIHNwYW5zKSB7XG4gIHZhciBkb2MgPSBjbS5kb2MsIGRpc3BsYXkgPSBjbS5kaXNwbGF5LCBmcm9tID0gY2hhbmdlLmZyb20sIHRvID0gY2hhbmdlLnRvO1xuXG4gIHZhciByZWNvbXB1dGVNYXhMZW5ndGggPSBmYWxzZSwgY2hlY2tXaWR0aFN0YXJ0ID0gZnJvbS5saW5lO1xuICBpZiAoIWNtLm9wdGlvbnMubGluZVdyYXBwaW5nKSB7XG4gICAgY2hlY2tXaWR0aFN0YXJ0ID0gbGluZU5vKHZpc3VhbExpbmUoZ2V0TGluZShkb2MsIGZyb20ubGluZSkpKTtcbiAgICBkb2MuaXRlcihjaGVja1dpZHRoU3RhcnQsIHRvLmxpbmUgKyAxLCBmdW5jdGlvbiAobGluZSkge1xuICAgICAgaWYgKGxpbmUgPT0gZGlzcGxheS5tYXhMaW5lKSB7XG4gICAgICAgIHJlY29tcHV0ZU1heExlbmd0aCA9IHRydWU7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBpZiAoZG9jLnNlbC5jb250YWlucyhjaGFuZ2UuZnJvbSwgY2hhbmdlLnRvKSA+IC0xKVxuICAgIHsgc2lnbmFsQ3Vyc29yQWN0aXZpdHkoY20pOyB9XG5cbiAgdXBkYXRlRG9jKGRvYywgY2hhbmdlLCBzcGFucywgZXN0aW1hdGVIZWlnaHQoY20pKTtcblxuICBpZiAoIWNtLm9wdGlvbnMubGluZVdyYXBwaW5nKSB7XG4gICAgZG9jLml0ZXIoY2hlY2tXaWR0aFN0YXJ0LCBmcm9tLmxpbmUgKyBjaGFuZ2UudGV4dC5sZW5ndGgsIGZ1bmN0aW9uIChsaW5lKSB7XG4gICAgICB2YXIgbGVuID0gbGluZUxlbmd0aChsaW5lKTtcbiAgICAgIGlmIChsZW4gPiBkaXNwbGF5Lm1heExpbmVMZW5ndGgpIHtcbiAgICAgICAgZGlzcGxheS5tYXhMaW5lID0gbGluZTtcbiAgICAgICAgZGlzcGxheS5tYXhMaW5lTGVuZ3RoID0gbGVuO1xuICAgICAgICBkaXNwbGF5Lm1heExpbmVDaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgcmVjb21wdXRlTWF4TGVuZ3RoID0gZmFsc2U7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKHJlY29tcHV0ZU1heExlbmd0aCkgeyBjbS5jdXJPcC51cGRhdGVNYXhMaW5lID0gdHJ1ZTsgfVxuICB9XG5cbiAgcmV0cmVhdEZyb250aWVyKGRvYywgZnJvbS5saW5lKTtcbiAgc3RhcnRXb3JrZXIoY20sIDQwMCk7XG5cbiAgdmFyIGxlbmRpZmYgPSBjaGFuZ2UudGV4dC5sZW5ndGggLSAodG8ubGluZSAtIGZyb20ubGluZSkgLSAxO1xuICAvLyBSZW1lbWJlciB0aGF0IHRoZXNlIGxpbmVzIGNoYW5nZWQsIGZvciB1cGRhdGluZyB0aGUgZGlzcGxheVxuICBpZiAoY2hhbmdlLmZ1bGwpXG4gICAgeyByZWdDaGFuZ2UoY20pOyB9XG4gIGVsc2UgaWYgKGZyb20ubGluZSA9PSB0by5saW5lICYmIGNoYW5nZS50ZXh0Lmxlbmd0aCA9PSAxICYmICFpc1dob2xlTGluZVVwZGF0ZShjbS5kb2MsIGNoYW5nZSkpXG4gICAgeyByZWdMaW5lQ2hhbmdlKGNtLCBmcm9tLmxpbmUsIFwidGV4dFwiKTsgfVxuICBlbHNlXG4gICAgeyByZWdDaGFuZ2UoY20sIGZyb20ubGluZSwgdG8ubGluZSArIDEsIGxlbmRpZmYpOyB9XG5cbiAgdmFyIGNoYW5nZXNIYW5kbGVyID0gaGFzSGFuZGxlcihjbSwgXCJjaGFuZ2VzXCIpLCBjaGFuZ2VIYW5kbGVyID0gaGFzSGFuZGxlcihjbSwgXCJjaGFuZ2VcIik7XG4gIGlmIChjaGFuZ2VIYW5kbGVyIHx8IGNoYW5nZXNIYW5kbGVyKSB7XG4gICAgdmFyIG9iaiA9IHtcbiAgICAgIGZyb206IGZyb20sIHRvOiB0byxcbiAgICAgIHRleHQ6IGNoYW5nZS50ZXh0LFxuICAgICAgcmVtb3ZlZDogY2hhbmdlLnJlbW92ZWQsXG4gICAgICBvcmlnaW46IGNoYW5nZS5vcmlnaW5cbiAgICB9O1xuICAgIGlmIChjaGFuZ2VIYW5kbGVyKSB7IHNpZ25hbExhdGVyKGNtLCBcImNoYW5nZVwiLCBjbSwgb2JqKTsgfVxuICAgIGlmIChjaGFuZ2VzSGFuZGxlcikgeyAoY20uY3VyT3AuY2hhbmdlT2JqcyB8fCAoY20uY3VyT3AuY2hhbmdlT2JqcyA9IFtdKSkucHVzaChvYmopOyB9XG4gIH1cbiAgY20uZGlzcGxheS5zZWxGb3JDb250ZXh0TWVudSA9IG51bGw7XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VSYW5nZShkb2MsIGNvZGUsIGZyb20sIHRvLCBvcmlnaW4pIHtcbiAgaWYgKCF0bykgeyB0byA9IGZyb207IH1cbiAgaWYgKGNtcCh0bywgZnJvbSkgPCAwKSB7IHZhciBhc3NpZ247XG4gICAgKGFzc2lnbiA9IFt0bywgZnJvbV0sIGZyb20gPSBhc3NpZ25bMF0sIHRvID0gYXNzaWduWzFdLCBhc3NpZ24pOyB9XG4gIGlmICh0eXBlb2YgY29kZSA9PSBcInN0cmluZ1wiKSB7IGNvZGUgPSBkb2Muc3BsaXRMaW5lcyhjb2RlKTsgfVxuICBtYWtlQ2hhbmdlKGRvYywge2Zyb206IGZyb20sIHRvOiB0bywgdGV4dDogY29kZSwgb3JpZ2luOiBvcmlnaW59KTtcbn1cblxuLy8gUmViYXNpbmcvcmVzZXR0aW5nIGhpc3RvcnkgdG8gZGVhbCB3aXRoIGV4dGVybmFsbHktc291cmNlZCBjaGFuZ2VzXG5cbmZ1bmN0aW9uIHJlYmFzZUhpc3RTZWxTaW5nbGUocG9zLCBmcm9tLCB0bywgZGlmZikge1xuICBpZiAodG8gPCBwb3MubGluZSkge1xuICAgIHBvcy5saW5lICs9IGRpZmY7XG4gIH0gZWxzZSBpZiAoZnJvbSA8IHBvcy5saW5lKSB7XG4gICAgcG9zLmxpbmUgPSBmcm9tO1xuICAgIHBvcy5jaCA9IDA7XG4gIH1cbn1cblxuLy8gVHJpZXMgdG8gcmViYXNlIGFuIGFycmF5IG9mIGhpc3RvcnkgZXZlbnRzIGdpdmVuIGEgY2hhbmdlIGluIHRoZVxuLy8gZG9jdW1lbnQuIElmIHRoZSBjaGFuZ2UgdG91Y2hlcyB0aGUgc2FtZSBsaW5lcyBhcyB0aGUgZXZlbnQsIHRoZVxuLy8gZXZlbnQsIGFuZCBldmVyeXRoaW5nICdiZWhpbmQnIGl0LCBpcyBkaXNjYXJkZWQuIElmIHRoZSBjaGFuZ2UgaXNcbi8vIGJlZm9yZSB0aGUgZXZlbnQsIHRoZSBldmVudCdzIHBvc2l0aW9ucyBhcmUgdXBkYXRlZC4gVXNlcyBhXG4vLyBjb3B5LW9uLXdyaXRlIHNjaGVtZSBmb3IgdGhlIHBvc2l0aW9ucywgdG8gYXZvaWQgaGF2aW5nIHRvXG4vLyByZWFsbG9jYXRlIHRoZW0gYWxsIG9uIGV2ZXJ5IHJlYmFzZSwgYnV0IGFsc28gYXZvaWQgcHJvYmxlbXMgd2l0aFxuLy8gc2hhcmVkIHBvc2l0aW9uIG9iamVjdHMgYmVpbmcgdW5zYWZlbHkgdXBkYXRlZC5cbmZ1bmN0aW9uIHJlYmFzZUhpc3RBcnJheShhcnJheSwgZnJvbSwgdG8sIGRpZmYpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7ICsraSkge1xuICAgIHZhciBzdWIgPSBhcnJheVtpXSwgb2sgPSB0cnVlO1xuICAgIGlmIChzdWIucmFuZ2VzKSB7XG4gICAgICBpZiAoIXN1Yi5jb3BpZWQpIHsgc3ViID0gYXJyYXlbaV0gPSBzdWIuZGVlcENvcHkoKTsgc3ViLmNvcGllZCA9IHRydWU7IH1cbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgc3ViLnJhbmdlcy5sZW5ndGg7IGorKykge1xuICAgICAgICByZWJhc2VIaXN0U2VsU2luZ2xlKHN1Yi5yYW5nZXNbal0uYW5jaG9yLCBmcm9tLCB0bywgZGlmZik7XG4gICAgICAgIHJlYmFzZUhpc3RTZWxTaW5nbGUoc3ViLnJhbmdlc1tqXS5oZWFkLCBmcm9tLCB0bywgZGlmZik7XG4gICAgICB9XG4gICAgICBjb250aW51ZVxuICAgIH1cbiAgICBmb3IgKHZhciBqJDEgPSAwOyBqJDEgPCBzdWIuY2hhbmdlcy5sZW5ndGg7ICsraiQxKSB7XG4gICAgICB2YXIgY3VyID0gc3ViLmNoYW5nZXNbaiQxXTtcbiAgICAgIGlmICh0byA8IGN1ci5mcm9tLmxpbmUpIHtcbiAgICAgICAgY3VyLmZyb20gPSBQb3MoY3VyLmZyb20ubGluZSArIGRpZmYsIGN1ci5mcm9tLmNoKTtcbiAgICAgICAgY3VyLnRvID0gUG9zKGN1ci50by5saW5lICsgZGlmZiwgY3VyLnRvLmNoKTtcbiAgICAgIH0gZWxzZSBpZiAoZnJvbSA8PSBjdXIudG8ubGluZSkge1xuICAgICAgICBvayA9IGZhbHNlO1xuICAgICAgICBicmVha1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIW9rKSB7XG4gICAgICBhcnJheS5zcGxpY2UoMCwgaSArIDEpO1xuICAgICAgaSA9IDA7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlYmFzZUhpc3QoaGlzdCwgY2hhbmdlKSB7XG4gIHZhciBmcm9tID0gY2hhbmdlLmZyb20ubGluZSwgdG8gPSBjaGFuZ2UudG8ubGluZSwgZGlmZiA9IGNoYW5nZS50ZXh0Lmxlbmd0aCAtICh0byAtIGZyb20pIC0gMTtcbiAgcmViYXNlSGlzdEFycmF5KGhpc3QuZG9uZSwgZnJvbSwgdG8sIGRpZmYpO1xuICByZWJhc2VIaXN0QXJyYXkoaGlzdC51bmRvbmUsIGZyb20sIHRvLCBkaWZmKTtcbn1cblxuLy8gVXRpbGl0eSBmb3IgYXBwbHlpbmcgYSBjaGFuZ2UgdG8gYSBsaW5lIGJ5IGhhbmRsZSBvciBudW1iZXIsXG4vLyByZXR1cm5pbmcgdGhlIG51bWJlciBhbmQgb3B0aW9uYWxseSByZWdpc3RlcmluZyB0aGUgbGluZSBhc1xuLy8gY2hhbmdlZC5cbmZ1bmN0aW9uIGNoYW5nZUxpbmUoZG9jLCBoYW5kbGUsIGNoYW5nZVR5cGUsIG9wKSB7XG4gIHZhciBubyA9IGhhbmRsZSwgbGluZSA9IGhhbmRsZTtcbiAgaWYgKHR5cGVvZiBoYW5kbGUgPT0gXCJudW1iZXJcIikgeyBsaW5lID0gZ2V0TGluZShkb2MsIGNsaXBMaW5lKGRvYywgaGFuZGxlKSk7IH1cbiAgZWxzZSB7IG5vID0gbGluZU5vKGhhbmRsZSk7IH1cbiAgaWYgKG5vID09IG51bGwpIHsgcmV0dXJuIG51bGwgfVxuICBpZiAob3AobGluZSwgbm8pICYmIGRvYy5jbSkgeyByZWdMaW5lQ2hhbmdlKGRvYy5jbSwgbm8sIGNoYW5nZVR5cGUpOyB9XG4gIHJldHVybiBsaW5lXG59XG5cbi8vIFRoZSBkb2N1bWVudCBpcyByZXByZXNlbnRlZCBhcyBhIEJUcmVlIGNvbnNpc3Rpbmcgb2YgbGVhdmVzLCB3aXRoXG4vLyBjaHVuayBvZiBsaW5lcyBpbiB0aGVtLCBhbmQgYnJhbmNoZXMsIHdpdGggdXAgdG8gdGVuIGxlYXZlcyBvclxuLy8gb3RoZXIgYnJhbmNoIG5vZGVzIGJlbG93IHRoZW0uIFRoZSB0b3Agbm9kZSBpcyBhbHdheXMgYSBicmFuY2hcbi8vIG5vZGUsIGFuZCBpcyB0aGUgZG9jdW1lbnQgb2JqZWN0IGl0c2VsZiAobWVhbmluZyBpdCBoYXNcbi8vIGFkZGl0aW9uYWwgbWV0aG9kcyBhbmQgcHJvcGVydGllcykuXG4vL1xuLy8gQWxsIG5vZGVzIGhhdmUgcGFyZW50IGxpbmtzLiBUaGUgdHJlZSBpcyB1c2VkIGJvdGggdG8gZ28gZnJvbVxuLy8gbGluZSBudW1iZXJzIHRvIGxpbmUgb2JqZWN0cywgYW5kIHRvIGdvIGZyb20gb2JqZWN0cyB0byBudW1iZXJzLlxuLy8gSXQgYWxzbyBpbmRleGVzIGJ5IGhlaWdodCwgYW5kIGlzIHVzZWQgdG8gY29udmVydCBiZXR3ZWVuIGhlaWdodFxuLy8gYW5kIGxpbmUgb2JqZWN0LCBhbmQgdG8gZmluZCB0aGUgdG90YWwgaGVpZ2h0IG9mIHRoZSBkb2N1bWVudC5cbi8vXG4vLyBTZWUgYWxzbyBodHRwOi8vbWFyaWpuaGF2ZXJiZWtlLm5sL2Jsb2cvY29kZW1pcnJvci1saW5lLXRyZWUuaHRtbFxuXG5mdW5jdGlvbiBMZWFmQ2h1bmsobGluZXMpIHtcbiAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgdGhpcy5saW5lcyA9IGxpbmVzO1xuICB0aGlzLnBhcmVudCA9IG51bGw7XG4gIHZhciBoZWlnaHQgPSAwO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgKytpKSB7XG4gICAgbGluZXNbaV0ucGFyZW50ID0gdGhpcyQxO1xuICAgIGhlaWdodCArPSBsaW5lc1tpXS5oZWlnaHQ7XG4gIH1cbiAgdGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG59XG5cbkxlYWZDaHVuay5wcm90b3R5cGUgPSB7XG4gIGNodW5rU2l6ZTogZnVuY3Rpb24gY2h1bmtTaXplKCkgeyByZXR1cm4gdGhpcy5saW5lcy5sZW5ndGggfSxcblxuICAvLyBSZW1vdmUgdGhlIG4gbGluZXMgYXQgb2Zmc2V0ICdhdCcuXG4gIHJlbW92ZUlubmVyOiBmdW5jdGlvbiByZW1vdmVJbm5lcihhdCwgbikge1xuICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gICAgZm9yICh2YXIgaSA9IGF0LCBlID0gYXQgKyBuOyBpIDwgZTsgKytpKSB7XG4gICAgICB2YXIgbGluZSA9IHRoaXMkMS5saW5lc1tpXTtcbiAgICAgIHRoaXMkMS5oZWlnaHQgLT0gbGluZS5oZWlnaHQ7XG4gICAgICBjbGVhblVwTGluZShsaW5lKTtcbiAgICAgIHNpZ25hbExhdGVyKGxpbmUsIFwiZGVsZXRlXCIpO1xuICAgIH1cbiAgICB0aGlzLmxpbmVzLnNwbGljZShhdCwgbik7XG4gIH0sXG5cbiAgLy8gSGVscGVyIHVzZWQgdG8gY29sbGFwc2UgYSBzbWFsbCBicmFuY2ggaW50byBhIHNpbmdsZSBsZWFmLlxuICBjb2xsYXBzZTogZnVuY3Rpb24gY29sbGFwc2UobGluZXMpIHtcbiAgICBsaW5lcy5wdXNoLmFwcGx5KGxpbmVzLCB0aGlzLmxpbmVzKTtcbiAgfSxcblxuICAvLyBJbnNlcnQgdGhlIGdpdmVuIGFycmF5IG9mIGxpbmVzIGF0IG9mZnNldCAnYXQnLCBjb3VudCB0aGVtIGFzXG4gIC8vIGhhdmluZyB0aGUgZ2l2ZW4gaGVpZ2h0LlxuICBpbnNlcnRJbm5lcjogZnVuY3Rpb24gaW5zZXJ0SW5uZXIoYXQsIGxpbmVzLCBoZWlnaHQpIHtcbiAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICAgIHRoaXMuaGVpZ2h0ICs9IGhlaWdodDtcbiAgICB0aGlzLmxpbmVzID0gdGhpcy5saW5lcy5zbGljZSgwLCBhdCkuY29uY2F0KGxpbmVzKS5jb25jYXQodGhpcy5saW5lcy5zbGljZShhdCkpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyArK2kpIHsgbGluZXNbaV0ucGFyZW50ID0gdGhpcyQxOyB9XG4gIH0sXG5cbiAgLy8gVXNlZCB0byBpdGVyYXRlIG92ZXIgYSBwYXJ0IG9mIHRoZSB0cmVlLlxuICBpdGVyTjogZnVuY3Rpb24gaXRlck4oYXQsIG4sIG9wKSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgICBmb3IgKHZhciBlID0gYXQgKyBuOyBhdCA8IGU7ICsrYXQpXG4gICAgICB7IGlmIChvcCh0aGlzJDEubGluZXNbYXRdKSkgeyByZXR1cm4gdHJ1ZSB9IH1cbiAgfVxufTtcblxuZnVuY3Rpb24gQnJhbmNoQ2h1bmsoY2hpbGRyZW4pIHtcbiAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgdGhpcy5jaGlsZHJlbiA9IGNoaWxkcmVuO1xuICB2YXIgc2l6ZSA9IDAsIGhlaWdodCA9IDA7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgY2ggPSBjaGlsZHJlbltpXTtcbiAgICBzaXplICs9IGNoLmNodW5rU2l6ZSgpOyBoZWlnaHQgKz0gY2guaGVpZ2h0O1xuICAgIGNoLnBhcmVudCA9IHRoaXMkMTtcbiAgfVxuICB0aGlzLnNpemUgPSBzaXplO1xuICB0aGlzLmhlaWdodCA9IGhlaWdodDtcbiAgdGhpcy5wYXJlbnQgPSBudWxsO1xufVxuXG5CcmFuY2hDaHVuay5wcm90b3R5cGUgPSB7XG4gIGNodW5rU2l6ZTogZnVuY3Rpb24gY2h1bmtTaXplKCkgeyByZXR1cm4gdGhpcy5zaXplIH0sXG5cbiAgcmVtb3ZlSW5uZXI6IGZ1bmN0aW9uIHJlbW92ZUlubmVyKGF0LCBuKSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgICB0aGlzLnNpemUgLT0gbjtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBjaGlsZCA9IHRoaXMkMS5jaGlsZHJlbltpXSwgc3ogPSBjaGlsZC5jaHVua1NpemUoKTtcbiAgICAgIGlmIChhdCA8IHN6KSB7XG4gICAgICAgIHZhciBybSA9IE1hdGgubWluKG4sIHN6IC0gYXQpLCBvbGRIZWlnaHQgPSBjaGlsZC5oZWlnaHQ7XG4gICAgICAgIGNoaWxkLnJlbW92ZUlubmVyKGF0LCBybSk7XG4gICAgICAgIHRoaXMkMS5oZWlnaHQgLT0gb2xkSGVpZ2h0IC0gY2hpbGQuaGVpZ2h0O1xuICAgICAgICBpZiAoc3ogPT0gcm0pIHsgdGhpcyQxLmNoaWxkcmVuLnNwbGljZShpLS0sIDEpOyBjaGlsZC5wYXJlbnQgPSBudWxsOyB9XG4gICAgICAgIGlmICgobiAtPSBybSkgPT0gMCkgeyBicmVhayB9XG4gICAgICAgIGF0ID0gMDtcbiAgICAgIH0gZWxzZSB7IGF0IC09IHN6OyB9XG4gICAgfVxuICAgIC8vIElmIHRoZSByZXN1bHQgaXMgc21hbGxlciB0aGFuIDI1IGxpbmVzLCBlbnN1cmUgdGhhdCBpdCBpcyBhXG4gICAgLy8gc2luZ2xlIGxlYWYgbm9kZS5cbiAgICBpZiAodGhpcy5zaXplIC0gbiA8IDI1ICYmXG4gICAgICAgICh0aGlzLmNoaWxkcmVuLmxlbmd0aCA+IDEgfHwgISh0aGlzLmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgTGVhZkNodW5rKSkpIHtcbiAgICAgIHZhciBsaW5lcyA9IFtdO1xuICAgICAgdGhpcy5jb2xsYXBzZShsaW5lcyk7XG4gICAgICB0aGlzLmNoaWxkcmVuID0gW25ldyBMZWFmQ2h1bmsobGluZXMpXTtcbiAgICAgIHRoaXMuY2hpbGRyZW5bMF0ucGFyZW50ID0gdGhpcztcbiAgICB9XG4gIH0sXG5cbiAgY29sbGFwc2U6IGZ1bmN0aW9uIGNvbGxhcHNlKGxpbmVzKSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHsgdGhpcyQxLmNoaWxkcmVuW2ldLmNvbGxhcHNlKGxpbmVzKTsgfVxuICB9LFxuXG4gIGluc2VydElubmVyOiBmdW5jdGlvbiBpbnNlcnRJbm5lcihhdCwgbGluZXMsIGhlaWdodCkge1xuICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gICAgdGhpcy5zaXplICs9IGxpbmVzLmxlbmd0aDtcbiAgICB0aGlzLmhlaWdodCArPSBoZWlnaHQ7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNoaWxkcmVuLmxlbmd0aDsgKytpKSB7XG4gICAgICB2YXIgY2hpbGQgPSB0aGlzJDEuY2hpbGRyZW5baV0sIHN6ID0gY2hpbGQuY2h1bmtTaXplKCk7XG4gICAgICBpZiAoYXQgPD0gc3opIHtcbiAgICAgICAgY2hpbGQuaW5zZXJ0SW5uZXIoYXQsIGxpbmVzLCBoZWlnaHQpO1xuICAgICAgICBpZiAoY2hpbGQubGluZXMgJiYgY2hpbGQubGluZXMubGVuZ3RoID4gNTApIHtcbiAgICAgICAgICAvLyBUbyBhdm9pZCBtZW1vcnkgdGhyYXNoaW5nIHdoZW4gY2hpbGQubGluZXMgaXMgaHVnZSAoZS5nLiBmaXJzdCB2aWV3IG9mIGEgbGFyZ2UgZmlsZSksIGl0J3MgbmV2ZXIgc3BsaWNlZC5cbiAgICAgICAgICAvLyBJbnN0ZWFkLCBzbWFsbCBzbGljZXMgYXJlIHRha2VuLiBUaGV5J3JlIHRha2VuIGluIG9yZGVyIGJlY2F1c2Ugc2VxdWVudGlhbCBtZW1vcnkgYWNjZXNzZXMgYXJlIGZhc3Rlc3QuXG4gICAgICAgICAgdmFyIHJlbWFpbmluZyA9IGNoaWxkLmxpbmVzLmxlbmd0aCAlIDI1ICsgMjU7XG4gICAgICAgICAgZm9yICh2YXIgcG9zID0gcmVtYWluaW5nOyBwb3MgPCBjaGlsZC5saW5lcy5sZW5ndGg7KSB7XG4gICAgICAgICAgICB2YXIgbGVhZiA9IG5ldyBMZWFmQ2h1bmsoY2hpbGQubGluZXMuc2xpY2UocG9zLCBwb3MgKz0gMjUpKTtcbiAgICAgICAgICAgIGNoaWxkLmhlaWdodCAtPSBsZWFmLmhlaWdodDtcbiAgICAgICAgICAgIHRoaXMkMS5jaGlsZHJlbi5zcGxpY2UoKytpLCAwLCBsZWFmKTtcbiAgICAgICAgICAgIGxlYWYucGFyZW50ID0gdGhpcyQxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjaGlsZC5saW5lcyA9IGNoaWxkLmxpbmVzLnNsaWNlKDAsIHJlbWFpbmluZyk7XG4gICAgICAgICAgdGhpcyQxLm1heWJlU3BpbGwoKTtcbiAgICAgICAgfVxuICAgICAgICBicmVha1xuICAgICAgfVxuICAgICAgYXQgLT0gc3o7XG4gICAgfVxuICB9LFxuXG4gIC8vIFdoZW4gYSBub2RlIGhhcyBncm93biwgY2hlY2sgd2hldGhlciBpdCBzaG91bGQgYmUgc3BsaXQuXG4gIG1heWJlU3BpbGw6IGZ1bmN0aW9uIG1heWJlU3BpbGwoKSB7XG4gICAgaWYgKHRoaXMuY2hpbGRyZW4ubGVuZ3RoIDw9IDEwKSB7IHJldHVybiB9XG4gICAgdmFyIG1lID0gdGhpcztcbiAgICBkbyB7XG4gICAgICB2YXIgc3BpbGxlZCA9IG1lLmNoaWxkcmVuLnNwbGljZShtZS5jaGlsZHJlbi5sZW5ndGggLSA1LCA1KTtcbiAgICAgIHZhciBzaWJsaW5nID0gbmV3IEJyYW5jaENodW5rKHNwaWxsZWQpO1xuICAgICAgaWYgKCFtZS5wYXJlbnQpIHsgLy8gQmVjb21lIHRoZSBwYXJlbnQgbm9kZVxuICAgICAgICB2YXIgY29weSA9IG5ldyBCcmFuY2hDaHVuayhtZS5jaGlsZHJlbik7XG4gICAgICAgIGNvcHkucGFyZW50ID0gbWU7XG4gICAgICAgIG1lLmNoaWxkcmVuID0gW2NvcHksIHNpYmxpbmddO1xuICAgICAgICBtZSA9IGNvcHk7XG4gICAgIH0gZWxzZSB7XG4gICAgICAgIG1lLnNpemUgLT0gc2libGluZy5zaXplO1xuICAgICAgICBtZS5oZWlnaHQgLT0gc2libGluZy5oZWlnaHQ7XG4gICAgICAgIHZhciBteUluZGV4ID0gaW5kZXhPZihtZS5wYXJlbnQuY2hpbGRyZW4sIG1lKTtcbiAgICAgICAgbWUucGFyZW50LmNoaWxkcmVuLnNwbGljZShteUluZGV4ICsgMSwgMCwgc2libGluZyk7XG4gICAgICB9XG4gICAgICBzaWJsaW5nLnBhcmVudCA9IG1lLnBhcmVudDtcbiAgICB9IHdoaWxlIChtZS5jaGlsZHJlbi5sZW5ndGggPiAxMClcbiAgICBtZS5wYXJlbnQubWF5YmVTcGlsbCgpO1xuICB9LFxuXG4gIGl0ZXJOOiBmdW5jdGlvbiBpdGVyTihhdCwgbiwgb3ApIHtcbiAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIGNoaWxkID0gdGhpcyQxLmNoaWxkcmVuW2ldLCBzeiA9IGNoaWxkLmNodW5rU2l6ZSgpO1xuICAgICAgaWYgKGF0IDwgc3opIHtcbiAgICAgICAgdmFyIHVzZWQgPSBNYXRoLm1pbihuLCBzeiAtIGF0KTtcbiAgICAgICAgaWYgKGNoaWxkLml0ZXJOKGF0LCB1c2VkLCBvcCkpIHsgcmV0dXJuIHRydWUgfVxuICAgICAgICBpZiAoKG4gLT0gdXNlZCkgPT0gMCkgeyBicmVhayB9XG4gICAgICAgIGF0ID0gMDtcbiAgICAgIH0gZWxzZSB7IGF0IC09IHN6OyB9XG4gICAgfVxuICB9XG59O1xuXG4vLyBMaW5lIHdpZGdldHMgYXJlIGJsb2NrIGVsZW1lbnRzIGRpc3BsYXllZCBhYm92ZSBvciBiZWxvdyBhIGxpbmUuXG5cbnZhciBMaW5lV2lkZ2V0ID0gZnVuY3Rpb24oZG9jLCBub2RlLCBvcHRpb25zKSB7XG4gIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gIGlmIChvcHRpb25zKSB7IGZvciAodmFyIG9wdCBpbiBvcHRpb25zKSB7IGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KG9wdCkpXG4gICAgeyB0aGlzJDFbb3B0XSA9IG9wdGlvbnNbb3B0XTsgfSB9IH1cbiAgdGhpcy5kb2MgPSBkb2M7XG4gIHRoaXMubm9kZSA9IG5vZGU7XG59O1xuXG5MaW5lV2lkZ2V0LnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICB2YXIgY20gPSB0aGlzLmRvYy5jbSwgd3MgPSB0aGlzLmxpbmUud2lkZ2V0cywgbGluZSA9IHRoaXMubGluZSwgbm8gPSBsaW5lTm8obGluZSk7XG4gIGlmIChubyA9PSBudWxsIHx8ICF3cykgeyByZXR1cm4gfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHdzLmxlbmd0aDsgKytpKSB7IGlmICh3c1tpXSA9PSB0aGlzJDEpIHsgd3Muc3BsaWNlKGktLSwgMSk7IH0gfVxuICBpZiAoIXdzLmxlbmd0aCkgeyBsaW5lLndpZGdldHMgPSBudWxsOyB9XG4gIHZhciBoZWlnaHQgPSB3aWRnZXRIZWlnaHQodGhpcyk7XG4gIHVwZGF0ZUxpbmVIZWlnaHQobGluZSwgTWF0aC5tYXgoMCwgbGluZS5oZWlnaHQgLSBoZWlnaHQpKTtcbiAgaWYgKGNtKSB7XG4gICAgcnVuSW5PcChjbSwgZnVuY3Rpb24gKCkge1xuICAgICAgYWRqdXN0U2Nyb2xsV2hlbkFib3ZlVmlzaWJsZShjbSwgbGluZSwgLWhlaWdodCk7XG4gICAgICByZWdMaW5lQ2hhbmdlKGNtLCBubywgXCJ3aWRnZXRcIik7XG4gICAgfSk7XG4gICAgc2lnbmFsTGF0ZXIoY20sIFwibGluZVdpZGdldENsZWFyZWRcIiwgY20sIHRoaXMsIG5vKTtcbiAgfVxufTtcblxuTGluZVdpZGdldC5wcm90b3R5cGUuY2hhbmdlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICB2YXIgb2xkSCA9IHRoaXMuaGVpZ2h0LCBjbSA9IHRoaXMuZG9jLmNtLCBsaW5lID0gdGhpcy5saW5lO1xuICB0aGlzLmhlaWdodCA9IG51bGw7XG4gIHZhciBkaWZmID0gd2lkZ2V0SGVpZ2h0KHRoaXMpIC0gb2xkSDtcbiAgaWYgKCFkaWZmKSB7IHJldHVybiB9XG4gIHVwZGF0ZUxpbmVIZWlnaHQobGluZSwgbGluZS5oZWlnaHQgKyBkaWZmKTtcbiAgaWYgKGNtKSB7XG4gICAgcnVuSW5PcChjbSwgZnVuY3Rpb24gKCkge1xuICAgICAgY20uY3VyT3AuZm9yY2VVcGRhdGUgPSB0cnVlO1xuICAgICAgYWRqdXN0U2Nyb2xsV2hlbkFib3ZlVmlzaWJsZShjbSwgbGluZSwgZGlmZik7XG4gICAgICBzaWduYWxMYXRlcihjbSwgXCJsaW5lV2lkZ2V0Q2hhbmdlZFwiLCBjbSwgdGhpcyQxLCBsaW5lTm8obGluZSkpO1xuICAgIH0pO1xuICB9XG59O1xuZXZlbnRNaXhpbihMaW5lV2lkZ2V0KTtcblxuZnVuY3Rpb24gYWRqdXN0U2Nyb2xsV2hlbkFib3ZlVmlzaWJsZShjbSwgbGluZSwgZGlmZikge1xuICBpZiAoaGVpZ2h0QXRMaW5lKGxpbmUpIDwgKChjbS5jdXJPcCAmJiBjbS5jdXJPcC5zY3JvbGxUb3ApIHx8IGNtLmRvYy5zY3JvbGxUb3ApKVxuICAgIHsgYWRkVG9TY3JvbGxUb3AoY20sIGRpZmYpOyB9XG59XG5cbmZ1bmN0aW9uIGFkZExpbmVXaWRnZXQoZG9jLCBoYW5kbGUsIG5vZGUsIG9wdGlvbnMpIHtcbiAgdmFyIHdpZGdldCA9IG5ldyBMaW5lV2lkZ2V0KGRvYywgbm9kZSwgb3B0aW9ucyk7XG4gIHZhciBjbSA9IGRvYy5jbTtcbiAgaWYgKGNtICYmIHdpZGdldC5ub0hTY3JvbGwpIHsgY20uZGlzcGxheS5hbGlnbldpZGdldHMgPSB0cnVlOyB9XG4gIGNoYW5nZUxpbmUoZG9jLCBoYW5kbGUsIFwid2lkZ2V0XCIsIGZ1bmN0aW9uIChsaW5lKSB7XG4gICAgdmFyIHdpZGdldHMgPSBsaW5lLndpZGdldHMgfHwgKGxpbmUud2lkZ2V0cyA9IFtdKTtcbiAgICBpZiAod2lkZ2V0Lmluc2VydEF0ID09IG51bGwpIHsgd2lkZ2V0cy5wdXNoKHdpZGdldCk7IH1cbiAgICBlbHNlIHsgd2lkZ2V0cy5zcGxpY2UoTWF0aC5taW4od2lkZ2V0cy5sZW5ndGggLSAxLCBNYXRoLm1heCgwLCB3aWRnZXQuaW5zZXJ0QXQpKSwgMCwgd2lkZ2V0KTsgfVxuICAgIHdpZGdldC5saW5lID0gbGluZTtcbiAgICBpZiAoY20gJiYgIWxpbmVJc0hpZGRlbihkb2MsIGxpbmUpKSB7XG4gICAgICB2YXIgYWJvdmVWaXNpYmxlID0gaGVpZ2h0QXRMaW5lKGxpbmUpIDwgZG9jLnNjcm9sbFRvcDtcbiAgICAgIHVwZGF0ZUxpbmVIZWlnaHQobGluZSwgbGluZS5oZWlnaHQgKyB3aWRnZXRIZWlnaHQod2lkZ2V0KSk7XG4gICAgICBpZiAoYWJvdmVWaXNpYmxlKSB7IGFkZFRvU2Nyb2xsVG9wKGNtLCB3aWRnZXQuaGVpZ2h0KTsgfVxuICAgICAgY20uY3VyT3AuZm9yY2VVcGRhdGUgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZVxuICB9KTtcbiAgaWYgKGNtKSB7IHNpZ25hbExhdGVyKGNtLCBcImxpbmVXaWRnZXRBZGRlZFwiLCBjbSwgd2lkZ2V0LCB0eXBlb2YgaGFuZGxlID09IFwibnVtYmVyXCIgPyBoYW5kbGUgOiBsaW5lTm8oaGFuZGxlKSk7IH1cbiAgcmV0dXJuIHdpZGdldFxufVxuXG4vLyBURVhUTUFSS0VSU1xuXG4vLyBDcmVhdGVkIHdpdGggbWFya1RleHQgYW5kIHNldEJvb2ttYXJrIG1ldGhvZHMuIEEgVGV4dE1hcmtlciBpcyBhXG4vLyBoYW5kbGUgdGhhdCBjYW4gYmUgdXNlZCB0byBjbGVhciBvciBmaW5kIGEgbWFya2VkIHBvc2l0aW9uIGluIHRoZVxuLy8gZG9jdW1lbnQuIExpbmUgb2JqZWN0cyBob2xkIGFycmF5cyAobWFya2VkU3BhbnMpIGNvbnRhaW5pbmdcbi8vIHtmcm9tLCB0bywgbWFya2VyfSBvYmplY3QgcG9pbnRpbmcgdG8gc3VjaCBtYXJrZXIgb2JqZWN0cywgYW5kXG4vLyBpbmRpY2F0aW5nIHRoYXQgc3VjaCBhIG1hcmtlciBpcyBwcmVzZW50IG9uIHRoYXQgbGluZS4gTXVsdGlwbGVcbi8vIGxpbmVzIG1heSBwb2ludCB0byB0aGUgc2FtZSBtYXJrZXIgd2hlbiBpdCBzcGFucyBhY3Jvc3MgbGluZXMuXG4vLyBUaGUgc3BhbnMgd2lsbCBoYXZlIG51bGwgZm9yIHRoZWlyIGZyb20vdG8gcHJvcGVydGllcyB3aGVuIHRoZVxuLy8gbWFya2VyIGNvbnRpbnVlcyBiZXlvbmQgdGhlIHN0YXJ0L2VuZCBvZiB0aGUgbGluZS4gTWFya2VycyBoYXZlXG4vLyBsaW5rcyBiYWNrIHRvIHRoZSBsaW5lcyB0aGV5IGN1cnJlbnRseSB0b3VjaC5cblxuLy8gQ29sbGFwc2VkIG1hcmtlcnMgaGF2ZSB1bmlxdWUgaWRzLCBpbiBvcmRlciB0byBiZSBhYmxlIHRvIG9yZGVyXG4vLyB0aGVtLCB3aGljaCBpcyBuZWVkZWQgZm9yIHVuaXF1ZWx5IGRldGVybWluaW5nIGFuIG91dGVyIG1hcmtlclxuLy8gd2hlbiB0aGV5IG92ZXJsYXAgKHRoZXkgbWF5IG5lc3QsIGJ1dCBub3QgcGFydGlhbGx5IG92ZXJsYXApLlxudmFyIG5leHRNYXJrZXJJZCA9IDA7XG5cbnZhciBUZXh0TWFya2VyID0gZnVuY3Rpb24oZG9jLCB0eXBlKSB7XG4gIHRoaXMubGluZXMgPSBbXTtcbiAgdGhpcy50eXBlID0gdHlwZTtcbiAgdGhpcy5kb2MgPSBkb2M7XG4gIHRoaXMuaWQgPSArK25leHRNYXJrZXJJZDtcbn07XG5cbi8vIENsZWFyIHRoZSBtYXJrZXIuXG5UZXh0TWFya2VyLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICBpZiAodGhpcy5leHBsaWNpdGx5Q2xlYXJlZCkgeyByZXR1cm4gfVxuICB2YXIgY20gPSB0aGlzLmRvYy5jbSwgd2l0aE9wID0gY20gJiYgIWNtLmN1ck9wO1xuICBpZiAod2l0aE9wKSB7IHN0YXJ0T3BlcmF0aW9uKGNtKTsgfVxuICBpZiAoaGFzSGFuZGxlcih0aGlzLCBcImNsZWFyXCIpKSB7XG4gICAgdmFyIGZvdW5kID0gdGhpcy5maW5kKCk7XG4gICAgaWYgKGZvdW5kKSB7IHNpZ25hbExhdGVyKHRoaXMsIFwiY2xlYXJcIiwgZm91bmQuZnJvbSwgZm91bmQudG8pOyB9XG4gIH1cbiAgdmFyIG1pbiA9IG51bGwsIG1heCA9IG51bGw7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5saW5lcy5sZW5ndGg7ICsraSkge1xuICAgIHZhciBsaW5lID0gdGhpcyQxLmxpbmVzW2ldO1xuICAgIHZhciBzcGFuID0gZ2V0TWFya2VkU3BhbkZvcihsaW5lLm1hcmtlZFNwYW5zLCB0aGlzJDEpO1xuICAgIGlmIChjbSAmJiAhdGhpcyQxLmNvbGxhcHNlZCkgeyByZWdMaW5lQ2hhbmdlKGNtLCBsaW5lTm8obGluZSksIFwidGV4dFwiKTsgfVxuICAgIGVsc2UgaWYgKGNtKSB7XG4gICAgICBpZiAoc3Bhbi50byAhPSBudWxsKSB7IG1heCA9IGxpbmVObyhsaW5lKTsgfVxuICAgICAgaWYgKHNwYW4uZnJvbSAhPSBudWxsKSB7IG1pbiA9IGxpbmVObyhsaW5lKTsgfVxuICAgIH1cbiAgICBsaW5lLm1hcmtlZFNwYW5zID0gcmVtb3ZlTWFya2VkU3BhbihsaW5lLm1hcmtlZFNwYW5zLCBzcGFuKTtcbiAgICBpZiAoc3Bhbi5mcm9tID09IG51bGwgJiYgdGhpcyQxLmNvbGxhcHNlZCAmJiAhbGluZUlzSGlkZGVuKHRoaXMkMS5kb2MsIGxpbmUpICYmIGNtKVxuICAgICAgeyB1cGRhdGVMaW5lSGVpZ2h0KGxpbmUsIHRleHRIZWlnaHQoY20uZGlzcGxheSkpOyB9XG4gIH1cbiAgaWYgKGNtICYmIHRoaXMuY29sbGFwc2VkICYmICFjbS5vcHRpb25zLmxpbmVXcmFwcGluZykgeyBmb3IgKHZhciBpJDEgPSAwOyBpJDEgPCB0aGlzLmxpbmVzLmxlbmd0aDsgKytpJDEpIHtcbiAgICB2YXIgdmlzdWFsID0gdmlzdWFsTGluZSh0aGlzJDEubGluZXNbaSQxXSksIGxlbiA9IGxpbmVMZW5ndGgodmlzdWFsKTtcbiAgICBpZiAobGVuID4gY20uZGlzcGxheS5tYXhMaW5lTGVuZ3RoKSB7XG4gICAgICBjbS5kaXNwbGF5Lm1heExpbmUgPSB2aXN1YWw7XG4gICAgICBjbS5kaXNwbGF5Lm1heExpbmVMZW5ndGggPSBsZW47XG4gICAgICBjbS5kaXNwbGF5Lm1heExpbmVDaGFuZ2VkID0gdHJ1ZTtcbiAgICB9XG4gIH0gfVxuXG4gIGlmIChtaW4gIT0gbnVsbCAmJiBjbSAmJiB0aGlzLmNvbGxhcHNlZCkgeyByZWdDaGFuZ2UoY20sIG1pbiwgbWF4ICsgMSk7IH1cbiAgdGhpcy5saW5lcy5sZW5ndGggPSAwO1xuICB0aGlzLmV4cGxpY2l0bHlDbGVhcmVkID0gdHJ1ZTtcbiAgaWYgKHRoaXMuYXRvbWljICYmIHRoaXMuZG9jLmNhbnRFZGl0KSB7XG4gICAgdGhpcy5kb2MuY2FudEVkaXQgPSBmYWxzZTtcbiAgICBpZiAoY20pIHsgcmVDaGVja1NlbGVjdGlvbihjbS5kb2MpOyB9XG4gIH1cbiAgaWYgKGNtKSB7IHNpZ25hbExhdGVyKGNtLCBcIm1hcmtlckNsZWFyZWRcIiwgY20sIHRoaXMsIG1pbiwgbWF4KTsgfVxuICBpZiAod2l0aE9wKSB7IGVuZE9wZXJhdGlvbihjbSk7IH1cbiAgaWYgKHRoaXMucGFyZW50KSB7IHRoaXMucGFyZW50LmNsZWFyKCk7IH1cbn07XG5cbi8vIEZpbmQgdGhlIHBvc2l0aW9uIG9mIHRoZSBtYXJrZXIgaW4gdGhlIGRvY3VtZW50LiBSZXR1cm5zIGEge2Zyb20sXG4vLyB0b30gb2JqZWN0IGJ5IGRlZmF1bHQuIFNpZGUgY2FuIGJlIHBhc3NlZCB0byBnZXQgYSBzcGVjaWZpYyBzaWRlXG4vLyAtLSAwIChib3RoKSwgLTEgKGxlZnQpLCBvciAxIChyaWdodCkuIFdoZW4gbGluZU9iaiBpcyB0cnVlLCB0aGVcbi8vIFBvcyBvYmplY3RzIHJldHVybmVkIGNvbnRhaW4gYSBsaW5lIG9iamVjdCwgcmF0aGVyIHRoYW4gYSBsaW5lXG4vLyBudW1iZXIgKHVzZWQgdG8gcHJldmVudCBsb29raW5nIHVwIHRoZSBzYW1lIGxpbmUgdHdpY2UpLlxuVGV4dE1hcmtlci5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uIChzaWRlLCBsaW5lT2JqKSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgaWYgKHNpZGUgPT0gbnVsbCAmJiB0aGlzLnR5cGUgPT0gXCJib29rbWFya1wiKSB7IHNpZGUgPSAxOyB9XG4gIHZhciBmcm9tLCB0bztcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxpbmVzLmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIGxpbmUgPSB0aGlzJDEubGluZXNbaV07XG4gICAgdmFyIHNwYW4gPSBnZXRNYXJrZWRTcGFuRm9yKGxpbmUubWFya2VkU3BhbnMsIHRoaXMkMSk7XG4gICAgaWYgKHNwYW4uZnJvbSAhPSBudWxsKSB7XG4gICAgICBmcm9tID0gUG9zKGxpbmVPYmogPyBsaW5lIDogbGluZU5vKGxpbmUpLCBzcGFuLmZyb20pO1xuICAgICAgaWYgKHNpZGUgPT0gLTEpIHsgcmV0dXJuIGZyb20gfVxuICAgIH1cbiAgICBpZiAoc3Bhbi50byAhPSBudWxsKSB7XG4gICAgICB0byA9IFBvcyhsaW5lT2JqID8gbGluZSA6IGxpbmVObyhsaW5lKSwgc3Bhbi50byk7XG4gICAgICBpZiAoc2lkZSA9PSAxKSB7IHJldHVybiB0byB9XG4gICAgfVxuICB9XG4gIHJldHVybiBmcm9tICYmIHtmcm9tOiBmcm9tLCB0bzogdG99XG59O1xuXG4vLyBTaWduYWxzIHRoYXQgdGhlIG1hcmtlcidzIHdpZGdldCBjaGFuZ2VkLCBhbmQgc3Vycm91bmRpbmcgbGF5b3V0XG4vLyBzaG91bGQgYmUgcmVjb21wdXRlZC5cblRleHRNYXJrZXIucHJvdG90eXBlLmNoYW5nZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgdmFyIHBvcyA9IHRoaXMuZmluZCgtMSwgdHJ1ZSksIHdpZGdldCA9IHRoaXMsIGNtID0gdGhpcy5kb2MuY207XG4gIGlmICghcG9zIHx8ICFjbSkgeyByZXR1cm4gfVxuICBydW5Jbk9wKGNtLCBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxpbmUgPSBwb3MubGluZSwgbGluZU4gPSBsaW5lTm8ocG9zLmxpbmUpO1xuICAgIHZhciB2aWV3ID0gZmluZFZpZXdGb3JMaW5lKGNtLCBsaW5lTik7XG4gICAgaWYgKHZpZXcpIHtcbiAgICAgIGNsZWFyTGluZU1lYXN1cmVtZW50Q2FjaGVGb3Iodmlldyk7XG4gICAgICBjbS5jdXJPcC5zZWxlY3Rpb25DaGFuZ2VkID0gY20uY3VyT3AuZm9yY2VVcGRhdGUgPSB0cnVlO1xuICAgIH1cbiAgICBjbS5jdXJPcC51cGRhdGVNYXhMaW5lID0gdHJ1ZTtcbiAgICBpZiAoIWxpbmVJc0hpZGRlbih3aWRnZXQuZG9jLCBsaW5lKSAmJiB3aWRnZXQuaGVpZ2h0ICE9IG51bGwpIHtcbiAgICAgIHZhciBvbGRIZWlnaHQgPSB3aWRnZXQuaGVpZ2h0O1xuICAgICAgd2lkZ2V0LmhlaWdodCA9IG51bGw7XG4gICAgICB2YXIgZEhlaWdodCA9IHdpZGdldEhlaWdodCh3aWRnZXQpIC0gb2xkSGVpZ2h0O1xuICAgICAgaWYgKGRIZWlnaHQpXG4gICAgICAgIHsgdXBkYXRlTGluZUhlaWdodChsaW5lLCBsaW5lLmhlaWdodCArIGRIZWlnaHQpOyB9XG4gICAgfVxuICAgIHNpZ25hbExhdGVyKGNtLCBcIm1hcmtlckNoYW5nZWRcIiwgY20sIHRoaXMkMSk7XG4gIH0pO1xufTtcblxuVGV4dE1hcmtlci5wcm90b3R5cGUuYXR0YWNoTGluZSA9IGZ1bmN0aW9uIChsaW5lKSB7XG4gIGlmICghdGhpcy5saW5lcy5sZW5ndGggJiYgdGhpcy5kb2MuY20pIHtcbiAgICB2YXIgb3AgPSB0aGlzLmRvYy5jbS5jdXJPcDtcbiAgICBpZiAoIW9wLm1heWJlSGlkZGVuTWFya2VycyB8fCBpbmRleE9mKG9wLm1heWJlSGlkZGVuTWFya2VycywgdGhpcykgPT0gLTEpXG4gICAgICB7IChvcC5tYXliZVVuaGlkZGVuTWFya2VycyB8fCAob3AubWF5YmVVbmhpZGRlbk1hcmtlcnMgPSBbXSkpLnB1c2godGhpcyk7IH1cbiAgfVxuICB0aGlzLmxpbmVzLnB1c2gobGluZSk7XG59O1xuXG5UZXh0TWFya2VyLnByb3RvdHlwZS5kZXRhY2hMaW5lID0gZnVuY3Rpb24gKGxpbmUpIHtcbiAgdGhpcy5saW5lcy5zcGxpY2UoaW5kZXhPZih0aGlzLmxpbmVzLCBsaW5lKSwgMSk7XG4gIGlmICghdGhpcy5saW5lcy5sZW5ndGggJiYgdGhpcy5kb2MuY20pIHtcbiAgICB2YXIgb3AgPSB0aGlzLmRvYy5jbS5jdXJPcDsob3AubWF5YmVIaWRkZW5NYXJrZXJzIHx8IChvcC5tYXliZUhpZGRlbk1hcmtlcnMgPSBbXSkpLnB1c2godGhpcyk7XG4gIH1cbn07XG5ldmVudE1peGluKFRleHRNYXJrZXIpO1xuXG4vLyBDcmVhdGUgYSBtYXJrZXIsIHdpcmUgaXQgdXAgdG8gdGhlIHJpZ2h0IGxpbmVzLCBhbmRcbmZ1bmN0aW9uIG1hcmtUZXh0KGRvYywgZnJvbSwgdG8sIG9wdGlvbnMsIHR5cGUpIHtcbiAgLy8gU2hhcmVkIG1hcmtlcnMgKGFjcm9zcyBsaW5rZWQgZG9jdW1lbnRzKSBhcmUgaGFuZGxlZCBzZXBhcmF0ZWx5XG4gIC8vIChtYXJrVGV4dFNoYXJlZCB3aWxsIGNhbGwgb3V0IHRvIHRoaXMgYWdhaW4sIG9uY2UgcGVyXG4gIC8vIGRvY3VtZW50KS5cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5zaGFyZWQpIHsgcmV0dXJuIG1hcmtUZXh0U2hhcmVkKGRvYywgZnJvbSwgdG8sIG9wdGlvbnMsIHR5cGUpIH1cbiAgLy8gRW5zdXJlIHdlIGFyZSBpbiBhbiBvcGVyYXRpb24uXG4gIGlmIChkb2MuY20gJiYgIWRvYy5jbS5jdXJPcCkgeyByZXR1cm4gb3BlcmF0aW9uKGRvYy5jbSwgbWFya1RleHQpKGRvYywgZnJvbSwgdG8sIG9wdGlvbnMsIHR5cGUpIH1cblxuICB2YXIgbWFya2VyID0gbmV3IFRleHRNYXJrZXIoZG9jLCB0eXBlKSwgZGlmZiA9IGNtcChmcm9tLCB0byk7XG4gIGlmIChvcHRpb25zKSB7IGNvcHlPYmoob3B0aW9ucywgbWFya2VyLCBmYWxzZSk7IH1cbiAgLy8gRG9uJ3QgY29ubmVjdCBlbXB0eSBtYXJrZXJzIHVubGVzcyBjbGVhcldoZW5FbXB0eSBpcyBmYWxzZVxuICBpZiAoZGlmZiA+IDAgfHwgZGlmZiA9PSAwICYmIG1hcmtlci5jbGVhcldoZW5FbXB0eSAhPT0gZmFsc2UpXG4gICAgeyByZXR1cm4gbWFya2VyIH1cbiAgaWYgKG1hcmtlci5yZXBsYWNlZFdpdGgpIHtcbiAgICAvLyBTaG93aW5nIHVwIGFzIGEgd2lkZ2V0IGltcGxpZXMgY29sbGFwc2VkICh3aWRnZXQgcmVwbGFjZXMgdGV4dClcbiAgICBtYXJrZXIuY29sbGFwc2VkID0gdHJ1ZTtcbiAgICBtYXJrZXIud2lkZ2V0Tm9kZSA9IGVsdFAoXCJzcGFuXCIsIFttYXJrZXIucmVwbGFjZWRXaXRoXSwgXCJDb2RlTWlycm9yLXdpZGdldFwiKTtcbiAgICBpZiAoIW9wdGlvbnMuaGFuZGxlTW91c2VFdmVudHMpIHsgbWFya2VyLndpZGdldE5vZGUuc2V0QXR0cmlidXRlKFwiY20taWdub3JlLWV2ZW50c1wiLCBcInRydWVcIik7IH1cbiAgICBpZiAob3B0aW9ucy5pbnNlcnRMZWZ0KSB7IG1hcmtlci53aWRnZXROb2RlLmluc2VydExlZnQgPSB0cnVlOyB9XG4gIH1cbiAgaWYgKG1hcmtlci5jb2xsYXBzZWQpIHtcbiAgICBpZiAoY29uZmxpY3RpbmdDb2xsYXBzZWRSYW5nZShkb2MsIGZyb20ubGluZSwgZnJvbSwgdG8sIG1hcmtlcikgfHxcbiAgICAgICAgZnJvbS5saW5lICE9IHRvLmxpbmUgJiYgY29uZmxpY3RpbmdDb2xsYXBzZWRSYW5nZShkb2MsIHRvLmxpbmUsIGZyb20sIHRvLCBtYXJrZXIpKVxuICAgICAgeyB0aHJvdyBuZXcgRXJyb3IoXCJJbnNlcnRpbmcgY29sbGFwc2VkIG1hcmtlciBwYXJ0aWFsbHkgb3ZlcmxhcHBpbmcgYW4gZXhpc3Rpbmcgb25lXCIpIH1cbiAgICBzZWVDb2xsYXBzZWRTcGFucygpO1xuICB9XG5cbiAgaWYgKG1hcmtlci5hZGRUb0hpc3RvcnkpXG4gICAgeyBhZGRDaGFuZ2VUb0hpc3RvcnkoZG9jLCB7ZnJvbTogZnJvbSwgdG86IHRvLCBvcmlnaW46IFwibWFya1RleHRcIn0sIGRvYy5zZWwsIE5hTik7IH1cblxuICB2YXIgY3VyTGluZSA9IGZyb20ubGluZSwgY20gPSBkb2MuY20sIHVwZGF0ZU1heExpbmU7XG4gIGRvYy5pdGVyKGN1ckxpbmUsIHRvLmxpbmUgKyAxLCBmdW5jdGlvbiAobGluZSkge1xuICAgIGlmIChjbSAmJiBtYXJrZXIuY29sbGFwc2VkICYmICFjbS5vcHRpb25zLmxpbmVXcmFwcGluZyAmJiB2aXN1YWxMaW5lKGxpbmUpID09IGNtLmRpc3BsYXkubWF4TGluZSlcbiAgICAgIHsgdXBkYXRlTWF4TGluZSA9IHRydWU7IH1cbiAgICBpZiAobWFya2VyLmNvbGxhcHNlZCAmJiBjdXJMaW5lICE9IGZyb20ubGluZSkgeyB1cGRhdGVMaW5lSGVpZ2h0KGxpbmUsIDApOyB9XG4gICAgYWRkTWFya2VkU3BhbihsaW5lLCBuZXcgTWFya2VkU3BhbihtYXJrZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJMaW5lID09IGZyb20ubGluZSA/IGZyb20uY2ggOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VyTGluZSA9PSB0by5saW5lID8gdG8uY2ggOiBudWxsKSk7XG4gICAgKytjdXJMaW5lO1xuICB9KTtcbiAgLy8gbGluZUlzSGlkZGVuIGRlcGVuZHMgb24gdGhlIHByZXNlbmNlIG9mIHRoZSBzcGFucywgc28gbmVlZHMgYSBzZWNvbmQgcGFzc1xuICBpZiAobWFya2VyLmNvbGxhcHNlZCkgeyBkb2MuaXRlcihmcm9tLmxpbmUsIHRvLmxpbmUgKyAxLCBmdW5jdGlvbiAobGluZSkge1xuICAgIGlmIChsaW5lSXNIaWRkZW4oZG9jLCBsaW5lKSkgeyB1cGRhdGVMaW5lSGVpZ2h0KGxpbmUsIDApOyB9XG4gIH0pOyB9XG5cbiAgaWYgKG1hcmtlci5jbGVhck9uRW50ZXIpIHsgb24obWFya2VyLCBcImJlZm9yZUN1cnNvckVudGVyXCIsIGZ1bmN0aW9uICgpIHsgcmV0dXJuIG1hcmtlci5jbGVhcigpOyB9KTsgfVxuXG4gIGlmIChtYXJrZXIucmVhZE9ubHkpIHtcbiAgICBzZWVSZWFkT25seVNwYW5zKCk7XG4gICAgaWYgKGRvYy5oaXN0b3J5LmRvbmUubGVuZ3RoIHx8IGRvYy5oaXN0b3J5LnVuZG9uZS5sZW5ndGgpXG4gICAgICB7IGRvYy5jbGVhckhpc3RvcnkoKTsgfVxuICB9XG4gIGlmIChtYXJrZXIuY29sbGFwc2VkKSB7XG4gICAgbWFya2VyLmlkID0gKytuZXh0TWFya2VySWQ7XG4gICAgbWFya2VyLmF0b21pYyA9IHRydWU7XG4gIH1cbiAgaWYgKGNtKSB7XG4gICAgLy8gU3luYyBlZGl0b3Igc3RhdGVcbiAgICBpZiAodXBkYXRlTWF4TGluZSkgeyBjbS5jdXJPcC51cGRhdGVNYXhMaW5lID0gdHJ1ZTsgfVxuICAgIGlmIChtYXJrZXIuY29sbGFwc2VkKVxuICAgICAgeyByZWdDaGFuZ2UoY20sIGZyb20ubGluZSwgdG8ubGluZSArIDEpOyB9XG4gICAgZWxzZSBpZiAobWFya2VyLmNsYXNzTmFtZSB8fCBtYXJrZXIudGl0bGUgfHwgbWFya2VyLnN0YXJ0U3R5bGUgfHwgbWFya2VyLmVuZFN0eWxlIHx8IG1hcmtlci5jc3MpXG4gICAgICB7IGZvciAodmFyIGkgPSBmcm9tLmxpbmU7IGkgPD0gdG8ubGluZTsgaSsrKSB7IHJlZ0xpbmVDaGFuZ2UoY20sIGksIFwidGV4dFwiKTsgfSB9XG4gICAgaWYgKG1hcmtlci5hdG9taWMpIHsgcmVDaGVja1NlbGVjdGlvbihjbS5kb2MpOyB9XG4gICAgc2lnbmFsTGF0ZXIoY20sIFwibWFya2VyQWRkZWRcIiwgY20sIG1hcmtlcik7XG4gIH1cbiAgcmV0dXJuIG1hcmtlclxufVxuXG4vLyBTSEFSRUQgVEVYVE1BUktFUlNcblxuLy8gQSBzaGFyZWQgbWFya2VyIHNwYW5zIG11bHRpcGxlIGxpbmtlZCBkb2N1bWVudHMuIEl0IGlzXG4vLyBpbXBsZW1lbnRlZCBhcyBhIG1ldGEtbWFya2VyLW9iamVjdCBjb250cm9sbGluZyBtdWx0aXBsZSBub3JtYWxcbi8vIG1hcmtlcnMuXG52YXIgU2hhcmVkVGV4dE1hcmtlciA9IGZ1bmN0aW9uKG1hcmtlcnMsIHByaW1hcnkpIHtcbiAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgdGhpcy5tYXJrZXJzID0gbWFya2VycztcbiAgdGhpcy5wcmltYXJ5ID0gcHJpbWFyeTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBtYXJrZXJzLmxlbmd0aDsgKytpKVxuICAgIHsgbWFya2Vyc1tpXS5wYXJlbnQgPSB0aGlzJDE7IH1cbn07XG5cblNoYXJlZFRleHRNYXJrZXIucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gIGlmICh0aGlzLmV4cGxpY2l0bHlDbGVhcmVkKSB7IHJldHVybiB9XG4gIHRoaXMuZXhwbGljaXRseUNsZWFyZWQgPSB0cnVlO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubWFya2Vycy5sZW5ndGg7ICsraSlcbiAgICB7IHRoaXMkMS5tYXJrZXJzW2ldLmNsZWFyKCk7IH1cbiAgc2lnbmFsTGF0ZXIodGhpcywgXCJjbGVhclwiKTtcbn07XG5cblNoYXJlZFRleHRNYXJrZXIucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbiAoc2lkZSwgbGluZU9iaikge1xuICByZXR1cm4gdGhpcy5wcmltYXJ5LmZpbmQoc2lkZSwgbGluZU9iailcbn07XG5ldmVudE1peGluKFNoYXJlZFRleHRNYXJrZXIpO1xuXG5mdW5jdGlvbiBtYXJrVGV4dFNoYXJlZChkb2MsIGZyb20sIHRvLCBvcHRpb25zLCB0eXBlKSB7XG4gIG9wdGlvbnMgPSBjb3B5T2JqKG9wdGlvbnMpO1xuICBvcHRpb25zLnNoYXJlZCA9IGZhbHNlO1xuICB2YXIgbWFya2VycyA9IFttYXJrVGV4dChkb2MsIGZyb20sIHRvLCBvcHRpb25zLCB0eXBlKV0sIHByaW1hcnkgPSBtYXJrZXJzWzBdO1xuICB2YXIgd2lkZ2V0ID0gb3B0aW9ucy53aWRnZXROb2RlO1xuICBsaW5rZWREb2NzKGRvYywgZnVuY3Rpb24gKGRvYykge1xuICAgIGlmICh3aWRnZXQpIHsgb3B0aW9ucy53aWRnZXROb2RlID0gd2lkZ2V0LmNsb25lTm9kZSh0cnVlKTsgfVxuICAgIG1hcmtlcnMucHVzaChtYXJrVGV4dChkb2MsIGNsaXBQb3MoZG9jLCBmcm9tKSwgY2xpcFBvcyhkb2MsIHRvKSwgb3B0aW9ucywgdHlwZSkpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZG9jLmxpbmtlZC5sZW5ndGg7ICsraSlcbiAgICAgIHsgaWYgKGRvYy5saW5rZWRbaV0uaXNQYXJlbnQpIHsgcmV0dXJuIH0gfVxuICAgIHByaW1hcnkgPSBsc3QobWFya2Vycyk7XG4gIH0pO1xuICByZXR1cm4gbmV3IFNoYXJlZFRleHRNYXJrZXIobWFya2VycywgcHJpbWFyeSlcbn1cblxuZnVuY3Rpb24gZmluZFNoYXJlZE1hcmtlcnMoZG9jKSB7XG4gIHJldHVybiBkb2MuZmluZE1hcmtzKFBvcyhkb2MuZmlyc3QsIDApLCBkb2MuY2xpcFBvcyhQb3MoZG9jLmxhc3RMaW5lKCkpKSwgZnVuY3Rpb24gKG0pIHsgcmV0dXJuIG0ucGFyZW50OyB9KVxufVxuXG5mdW5jdGlvbiBjb3B5U2hhcmVkTWFya2Vycyhkb2MsIG1hcmtlcnMpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBtYXJrZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIG1hcmtlciA9IG1hcmtlcnNbaV0sIHBvcyA9IG1hcmtlci5maW5kKCk7XG4gICAgdmFyIG1Gcm9tID0gZG9jLmNsaXBQb3MocG9zLmZyb20pLCBtVG8gPSBkb2MuY2xpcFBvcyhwb3MudG8pO1xuICAgIGlmIChjbXAobUZyb20sIG1UbykpIHtcbiAgICAgIHZhciBzdWJNYXJrID0gbWFya1RleHQoZG9jLCBtRnJvbSwgbVRvLCBtYXJrZXIucHJpbWFyeSwgbWFya2VyLnByaW1hcnkudHlwZSk7XG4gICAgICBtYXJrZXIubWFya2Vycy5wdXNoKHN1Yk1hcmspO1xuICAgICAgc3ViTWFyay5wYXJlbnQgPSBtYXJrZXI7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGRldGFjaFNoYXJlZE1hcmtlcnMobWFya2Vycykge1xuICB2YXIgbG9vcCA9IGZ1bmN0aW9uICggaSApIHtcbiAgICB2YXIgbWFya2VyID0gbWFya2Vyc1tpXSwgbGlua2VkID0gW21hcmtlci5wcmltYXJ5LmRvY107XG4gICAgbGlua2VkRG9jcyhtYXJrZXIucHJpbWFyeS5kb2MsIGZ1bmN0aW9uIChkKSB7IHJldHVybiBsaW5rZWQucHVzaChkKTsgfSk7XG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBtYXJrZXIubWFya2Vycy5sZW5ndGg7IGorKykge1xuICAgICAgdmFyIHN1Yk1hcmtlciA9IG1hcmtlci5tYXJrZXJzW2pdO1xuICAgICAgaWYgKGluZGV4T2YobGlua2VkLCBzdWJNYXJrZXIuZG9jKSA9PSAtMSkge1xuICAgICAgICBzdWJNYXJrZXIucGFyZW50ID0gbnVsbDtcbiAgICAgICAgbWFya2VyLm1hcmtlcnMuc3BsaWNlKGotLSwgMSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbWFya2Vycy5sZW5ndGg7IGkrKykgbG9vcCggaSApO1xufVxuXG52YXIgbmV4dERvY0lkID0gMDtcbnZhciBEb2MgPSBmdW5jdGlvbih0ZXh0LCBtb2RlLCBmaXJzdExpbmUsIGxpbmVTZXAsIGRpcmVjdGlvbikge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRG9jKSkgeyByZXR1cm4gbmV3IERvYyh0ZXh0LCBtb2RlLCBmaXJzdExpbmUsIGxpbmVTZXAsIGRpcmVjdGlvbikgfVxuICBpZiAoZmlyc3RMaW5lID09IG51bGwpIHsgZmlyc3RMaW5lID0gMDsgfVxuXG4gIEJyYW5jaENodW5rLmNhbGwodGhpcywgW25ldyBMZWFmQ2h1bmsoW25ldyBMaW5lKFwiXCIsIG51bGwpXSldKTtcbiAgdGhpcy5maXJzdCA9IGZpcnN0TGluZTtcbiAgdGhpcy5zY3JvbGxUb3AgPSB0aGlzLnNjcm9sbExlZnQgPSAwO1xuICB0aGlzLmNhbnRFZGl0ID0gZmFsc2U7XG4gIHRoaXMuY2xlYW5HZW5lcmF0aW9uID0gMTtcbiAgdGhpcy5tb2RlRnJvbnRpZXIgPSB0aGlzLmhpZ2hsaWdodEZyb250aWVyID0gZmlyc3RMaW5lO1xuICB2YXIgc3RhcnQgPSBQb3MoZmlyc3RMaW5lLCAwKTtcbiAgdGhpcy5zZWwgPSBzaW1wbGVTZWxlY3Rpb24oc3RhcnQpO1xuICB0aGlzLmhpc3RvcnkgPSBuZXcgSGlzdG9yeShudWxsKTtcbiAgdGhpcy5pZCA9ICsrbmV4dERvY0lkO1xuICB0aGlzLm1vZGVPcHRpb24gPSBtb2RlO1xuICB0aGlzLmxpbmVTZXAgPSBsaW5lU2VwO1xuICB0aGlzLmRpcmVjdGlvbiA9IChkaXJlY3Rpb24gPT0gXCJydGxcIikgPyBcInJ0bFwiIDogXCJsdHJcIjtcbiAgdGhpcy5leHRlbmQgPSBmYWxzZTtcblxuICBpZiAodHlwZW9mIHRleHQgPT0gXCJzdHJpbmdcIikgeyB0ZXh0ID0gdGhpcy5zcGxpdExpbmVzKHRleHQpOyB9XG4gIHVwZGF0ZURvYyh0aGlzLCB7ZnJvbTogc3RhcnQsIHRvOiBzdGFydCwgdGV4dDogdGV4dH0pO1xuICBzZXRTZWxlY3Rpb24odGhpcywgc2ltcGxlU2VsZWN0aW9uKHN0YXJ0KSwgc2VsX2RvbnRTY3JvbGwpO1xufTtcblxuRG9jLnByb3RvdHlwZSA9IGNyZWF0ZU9iaihCcmFuY2hDaHVuay5wcm90b3R5cGUsIHtcbiAgY29uc3RydWN0b3I6IERvYyxcbiAgLy8gSXRlcmF0ZSBvdmVyIHRoZSBkb2N1bWVudC4gU3VwcG9ydHMgdHdvIGZvcm1zIC0tIHdpdGggb25seSBvbmVcbiAgLy8gYXJndW1lbnQsIGl0IGNhbGxzIHRoYXQgZm9yIGVhY2ggbGluZSBpbiB0aGUgZG9jdW1lbnQuIFdpdGhcbiAgLy8gdGhyZWUsIGl0IGl0ZXJhdGVzIG92ZXIgdGhlIHJhbmdlIGdpdmVuIGJ5IHRoZSBmaXJzdCB0d28gKHdpdGhcbiAgLy8gdGhlIHNlY29uZCBiZWluZyBub24taW5jbHVzaXZlKS5cbiAgaXRlcjogZnVuY3Rpb24oZnJvbSwgdG8sIG9wKSB7XG4gICAgaWYgKG9wKSB7IHRoaXMuaXRlck4oZnJvbSAtIHRoaXMuZmlyc3QsIHRvIC0gZnJvbSwgb3ApOyB9XG4gICAgZWxzZSB7IHRoaXMuaXRlck4odGhpcy5maXJzdCwgdGhpcy5maXJzdCArIHRoaXMuc2l6ZSwgZnJvbSk7IH1cbiAgfSxcblxuICAvLyBOb24tcHVibGljIGludGVyZmFjZSBmb3IgYWRkaW5nIGFuZCByZW1vdmluZyBsaW5lcy5cbiAgaW5zZXJ0OiBmdW5jdGlvbihhdCwgbGluZXMpIHtcbiAgICB2YXIgaGVpZ2h0ID0gMDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgKytpKSB7IGhlaWdodCArPSBsaW5lc1tpXS5oZWlnaHQ7IH1cbiAgICB0aGlzLmluc2VydElubmVyKGF0IC0gdGhpcy5maXJzdCwgbGluZXMsIGhlaWdodCk7XG4gIH0sXG4gIHJlbW92ZTogZnVuY3Rpb24oYXQsIG4pIHsgdGhpcy5yZW1vdmVJbm5lcihhdCAtIHRoaXMuZmlyc3QsIG4pOyB9LFxuXG4gIC8vIEZyb20gaGVyZSwgdGhlIG1ldGhvZHMgYXJlIHBhcnQgb2YgdGhlIHB1YmxpYyBpbnRlcmZhY2UuIE1vc3RcbiAgLy8gYXJlIGFsc28gYXZhaWxhYmxlIGZyb20gQ29kZU1pcnJvciAoZWRpdG9yKSBpbnN0YW5jZXMuXG5cbiAgZ2V0VmFsdWU6IGZ1bmN0aW9uKGxpbmVTZXApIHtcbiAgICB2YXIgbGluZXMgPSBnZXRMaW5lcyh0aGlzLCB0aGlzLmZpcnN0LCB0aGlzLmZpcnN0ICsgdGhpcy5zaXplKTtcbiAgICBpZiAobGluZVNlcCA9PT0gZmFsc2UpIHsgcmV0dXJuIGxpbmVzIH1cbiAgICByZXR1cm4gbGluZXMuam9pbihsaW5lU2VwIHx8IHRoaXMubGluZVNlcGFyYXRvcigpKVxuICB9LFxuICBzZXRWYWx1ZTogZG9jTWV0aG9kT3AoZnVuY3Rpb24oY29kZSkge1xuICAgIHZhciB0b3AgPSBQb3ModGhpcy5maXJzdCwgMCksIGxhc3QgPSB0aGlzLmZpcnN0ICsgdGhpcy5zaXplIC0gMTtcbiAgICBtYWtlQ2hhbmdlKHRoaXMsIHtmcm9tOiB0b3AsIHRvOiBQb3MobGFzdCwgZ2V0TGluZSh0aGlzLCBsYXN0KS50ZXh0Lmxlbmd0aCksXG4gICAgICAgICAgICAgICAgICAgICAgdGV4dDogdGhpcy5zcGxpdExpbmVzKGNvZGUpLCBvcmlnaW46IFwic2V0VmFsdWVcIiwgZnVsbDogdHJ1ZX0sIHRydWUpO1xuICAgIGlmICh0aGlzLmNtKSB7IHNjcm9sbFRvQ29vcmRzKHRoaXMuY20sIDAsIDApOyB9XG4gICAgc2V0U2VsZWN0aW9uKHRoaXMsIHNpbXBsZVNlbGVjdGlvbih0b3ApLCBzZWxfZG9udFNjcm9sbCk7XG4gIH0pLFxuICByZXBsYWNlUmFuZ2U6IGZ1bmN0aW9uKGNvZGUsIGZyb20sIHRvLCBvcmlnaW4pIHtcbiAgICBmcm9tID0gY2xpcFBvcyh0aGlzLCBmcm9tKTtcbiAgICB0byA9IHRvID8gY2xpcFBvcyh0aGlzLCB0bykgOiBmcm9tO1xuICAgIHJlcGxhY2VSYW5nZSh0aGlzLCBjb2RlLCBmcm9tLCB0bywgb3JpZ2luKTtcbiAgfSxcbiAgZ2V0UmFuZ2U6IGZ1bmN0aW9uKGZyb20sIHRvLCBsaW5lU2VwKSB7XG4gICAgdmFyIGxpbmVzID0gZ2V0QmV0d2Vlbih0aGlzLCBjbGlwUG9zKHRoaXMsIGZyb20pLCBjbGlwUG9zKHRoaXMsIHRvKSk7XG4gICAgaWYgKGxpbmVTZXAgPT09IGZhbHNlKSB7IHJldHVybiBsaW5lcyB9XG4gICAgcmV0dXJuIGxpbmVzLmpvaW4obGluZVNlcCB8fCB0aGlzLmxpbmVTZXBhcmF0b3IoKSlcbiAgfSxcblxuICBnZXRMaW5lOiBmdW5jdGlvbihsaW5lKSB7dmFyIGwgPSB0aGlzLmdldExpbmVIYW5kbGUobGluZSk7IHJldHVybiBsICYmIGwudGV4dH0sXG5cbiAgZ2V0TGluZUhhbmRsZTogZnVuY3Rpb24obGluZSkge2lmIChpc0xpbmUodGhpcywgbGluZSkpIHsgcmV0dXJuIGdldExpbmUodGhpcywgbGluZSkgfX0sXG4gIGdldExpbmVOdW1iZXI6IGZ1bmN0aW9uKGxpbmUpIHtyZXR1cm4gbGluZU5vKGxpbmUpfSxcblxuICBnZXRMaW5lSGFuZGxlVmlzdWFsU3RhcnQ6IGZ1bmN0aW9uKGxpbmUpIHtcbiAgICBpZiAodHlwZW9mIGxpbmUgPT0gXCJudW1iZXJcIikgeyBsaW5lID0gZ2V0TGluZSh0aGlzLCBsaW5lKTsgfVxuICAgIHJldHVybiB2aXN1YWxMaW5lKGxpbmUpXG4gIH0sXG5cbiAgbGluZUNvdW50OiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5zaXplfSxcbiAgZmlyc3RMaW5lOiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5maXJzdH0sXG4gIGxhc3RMaW5lOiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5maXJzdCArIHRoaXMuc2l6ZSAtIDF9LFxuXG4gIGNsaXBQb3M6IGZ1bmN0aW9uKHBvcykge3JldHVybiBjbGlwUG9zKHRoaXMsIHBvcyl9LFxuXG4gIGdldEN1cnNvcjogZnVuY3Rpb24oc3RhcnQpIHtcbiAgICB2YXIgcmFuZ2UkJDEgPSB0aGlzLnNlbC5wcmltYXJ5KCksIHBvcztcbiAgICBpZiAoc3RhcnQgPT0gbnVsbCB8fCBzdGFydCA9PSBcImhlYWRcIikgeyBwb3MgPSByYW5nZSQkMS5oZWFkOyB9XG4gICAgZWxzZSBpZiAoc3RhcnQgPT0gXCJhbmNob3JcIikgeyBwb3MgPSByYW5nZSQkMS5hbmNob3I7IH1cbiAgICBlbHNlIGlmIChzdGFydCA9PSBcImVuZFwiIHx8IHN0YXJ0ID09IFwidG9cIiB8fCBzdGFydCA9PT0gZmFsc2UpIHsgcG9zID0gcmFuZ2UkJDEudG8oKTsgfVxuICAgIGVsc2UgeyBwb3MgPSByYW5nZSQkMS5mcm9tKCk7IH1cbiAgICByZXR1cm4gcG9zXG4gIH0sXG4gIGxpc3RTZWxlY3Rpb25zOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuc2VsLnJhbmdlcyB9LFxuICBzb21ldGhpbmdTZWxlY3RlZDogZnVuY3Rpb24oKSB7cmV0dXJuIHRoaXMuc2VsLnNvbWV0aGluZ1NlbGVjdGVkKCl9LFxuXG4gIHNldEN1cnNvcjogZG9jTWV0aG9kT3AoZnVuY3Rpb24obGluZSwgY2gsIG9wdGlvbnMpIHtcbiAgICBzZXRTaW1wbGVTZWxlY3Rpb24odGhpcywgY2xpcFBvcyh0aGlzLCB0eXBlb2YgbGluZSA9PSBcIm51bWJlclwiID8gUG9zKGxpbmUsIGNoIHx8IDApIDogbGluZSksIG51bGwsIG9wdGlvbnMpO1xuICB9KSxcbiAgc2V0U2VsZWN0aW9uOiBkb2NNZXRob2RPcChmdW5jdGlvbihhbmNob3IsIGhlYWQsIG9wdGlvbnMpIHtcbiAgICBzZXRTaW1wbGVTZWxlY3Rpb24odGhpcywgY2xpcFBvcyh0aGlzLCBhbmNob3IpLCBjbGlwUG9zKHRoaXMsIGhlYWQgfHwgYW5jaG9yKSwgb3B0aW9ucyk7XG4gIH0pLFxuICBleHRlbmRTZWxlY3Rpb246IGRvY01ldGhvZE9wKGZ1bmN0aW9uKGhlYWQsIG90aGVyLCBvcHRpb25zKSB7XG4gICAgZXh0ZW5kU2VsZWN0aW9uKHRoaXMsIGNsaXBQb3ModGhpcywgaGVhZCksIG90aGVyICYmIGNsaXBQb3ModGhpcywgb3RoZXIpLCBvcHRpb25zKTtcbiAgfSksXG4gIGV4dGVuZFNlbGVjdGlvbnM6IGRvY01ldGhvZE9wKGZ1bmN0aW9uKGhlYWRzLCBvcHRpb25zKSB7XG4gICAgZXh0ZW5kU2VsZWN0aW9ucyh0aGlzLCBjbGlwUG9zQXJyYXkodGhpcywgaGVhZHMpLCBvcHRpb25zKTtcbiAgfSksXG4gIGV4dGVuZFNlbGVjdGlvbnNCeTogZG9jTWV0aG9kT3AoZnVuY3Rpb24oZiwgb3B0aW9ucykge1xuICAgIHZhciBoZWFkcyA9IG1hcCh0aGlzLnNlbC5yYW5nZXMsIGYpO1xuICAgIGV4dGVuZFNlbGVjdGlvbnModGhpcywgY2xpcFBvc0FycmF5KHRoaXMsIGhlYWRzKSwgb3B0aW9ucyk7XG4gIH0pLFxuICBzZXRTZWxlY3Rpb25zOiBkb2NNZXRob2RPcChmdW5jdGlvbihyYW5nZXMsIHByaW1hcnksIG9wdGlvbnMpIHtcbiAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICAgIGlmICghcmFuZ2VzLmxlbmd0aCkgeyByZXR1cm4gfVxuICAgIHZhciBvdXQgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJhbmdlcy5sZW5ndGg7IGkrKylcbiAgICAgIHsgb3V0W2ldID0gbmV3IFJhbmdlKGNsaXBQb3ModGhpcyQxLCByYW5nZXNbaV0uYW5jaG9yKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICBjbGlwUG9zKHRoaXMkMSwgcmFuZ2VzW2ldLmhlYWQpKTsgfVxuICAgIGlmIChwcmltYXJ5ID09IG51bGwpIHsgcHJpbWFyeSA9IE1hdGgubWluKHJhbmdlcy5sZW5ndGggLSAxLCB0aGlzLnNlbC5wcmltSW5kZXgpOyB9XG4gICAgc2V0U2VsZWN0aW9uKHRoaXMsIG5vcm1hbGl6ZVNlbGVjdGlvbihvdXQsIHByaW1hcnkpLCBvcHRpb25zKTtcbiAgfSksXG4gIGFkZFNlbGVjdGlvbjogZG9jTWV0aG9kT3AoZnVuY3Rpb24oYW5jaG9yLCBoZWFkLCBvcHRpb25zKSB7XG4gICAgdmFyIHJhbmdlcyA9IHRoaXMuc2VsLnJhbmdlcy5zbGljZSgwKTtcbiAgICByYW5nZXMucHVzaChuZXcgUmFuZ2UoY2xpcFBvcyh0aGlzLCBhbmNob3IpLCBjbGlwUG9zKHRoaXMsIGhlYWQgfHwgYW5jaG9yKSkpO1xuICAgIHNldFNlbGVjdGlvbih0aGlzLCBub3JtYWxpemVTZWxlY3Rpb24ocmFuZ2VzLCByYW5nZXMubGVuZ3RoIC0gMSksIG9wdGlvbnMpO1xuICB9KSxcblxuICBnZXRTZWxlY3Rpb246IGZ1bmN0aW9uKGxpbmVTZXApIHtcbiAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICAgIHZhciByYW5nZXMgPSB0aGlzLnNlbC5yYW5nZXMsIGxpbmVzO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmFuZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgc2VsID0gZ2V0QmV0d2Vlbih0aGlzJDEsIHJhbmdlc1tpXS5mcm9tKCksIHJhbmdlc1tpXS50bygpKTtcbiAgICAgIGxpbmVzID0gbGluZXMgPyBsaW5lcy5jb25jYXQoc2VsKSA6IHNlbDtcbiAgICB9XG4gICAgaWYgKGxpbmVTZXAgPT09IGZhbHNlKSB7IHJldHVybiBsaW5lcyB9XG4gICAgZWxzZSB7IHJldHVybiBsaW5lcy5qb2luKGxpbmVTZXAgfHwgdGhpcy5saW5lU2VwYXJhdG9yKCkpIH1cbiAgfSxcbiAgZ2V0U2VsZWN0aW9uczogZnVuY3Rpb24obGluZVNlcCkge1xuICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gICAgdmFyIHBhcnRzID0gW10sIHJhbmdlcyA9IHRoaXMuc2VsLnJhbmdlcztcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHNlbCA9IGdldEJldHdlZW4odGhpcyQxLCByYW5nZXNbaV0uZnJvbSgpLCByYW5nZXNbaV0udG8oKSk7XG4gICAgICBpZiAobGluZVNlcCAhPT0gZmFsc2UpIHsgc2VsID0gc2VsLmpvaW4obGluZVNlcCB8fCB0aGlzJDEubGluZVNlcGFyYXRvcigpKTsgfVxuICAgICAgcGFydHNbaV0gPSBzZWw7XG4gICAgfVxuICAgIHJldHVybiBwYXJ0c1xuICB9LFxuICByZXBsYWNlU2VsZWN0aW9uOiBmdW5jdGlvbihjb2RlLCBjb2xsYXBzZSwgb3JpZ2luKSB7XG4gICAgdmFyIGR1cCA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5zZWwucmFuZ2VzLmxlbmd0aDsgaSsrKVxuICAgICAgeyBkdXBbaV0gPSBjb2RlOyB9XG4gICAgdGhpcy5yZXBsYWNlU2VsZWN0aW9ucyhkdXAsIGNvbGxhcHNlLCBvcmlnaW4gfHwgXCIraW5wdXRcIik7XG4gIH0sXG4gIHJlcGxhY2VTZWxlY3Rpb25zOiBkb2NNZXRob2RPcChmdW5jdGlvbihjb2RlLCBjb2xsYXBzZSwgb3JpZ2luKSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgICB2YXIgY2hhbmdlcyA9IFtdLCBzZWwgPSB0aGlzLnNlbDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlbC5yYW5nZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciByYW5nZSQkMSA9IHNlbC5yYW5nZXNbaV07XG4gICAgICBjaGFuZ2VzW2ldID0ge2Zyb206IHJhbmdlJCQxLmZyb20oKSwgdG86IHJhbmdlJCQxLnRvKCksIHRleHQ6IHRoaXMkMS5zcGxpdExpbmVzKGNvZGVbaV0pLCBvcmlnaW46IG9yaWdpbn07XG4gICAgfVxuICAgIHZhciBuZXdTZWwgPSBjb2xsYXBzZSAmJiBjb2xsYXBzZSAhPSBcImVuZFwiICYmIGNvbXB1dGVSZXBsYWNlZFNlbCh0aGlzLCBjaGFuZ2VzLCBjb2xsYXBzZSk7XG4gICAgZm9yICh2YXIgaSQxID0gY2hhbmdlcy5sZW5ndGggLSAxOyBpJDEgPj0gMDsgaSQxLS0pXG4gICAgICB7IG1ha2VDaGFuZ2UodGhpcyQxLCBjaGFuZ2VzW2kkMV0pOyB9XG4gICAgaWYgKG5ld1NlbCkgeyBzZXRTZWxlY3Rpb25SZXBsYWNlSGlzdG9yeSh0aGlzLCBuZXdTZWwpOyB9XG4gICAgZWxzZSBpZiAodGhpcy5jbSkgeyBlbnN1cmVDdXJzb3JWaXNpYmxlKHRoaXMuY20pOyB9XG4gIH0pLFxuICB1bmRvOiBkb2NNZXRob2RPcChmdW5jdGlvbigpIHttYWtlQ2hhbmdlRnJvbUhpc3RvcnkodGhpcywgXCJ1bmRvXCIpO30pLFxuICByZWRvOiBkb2NNZXRob2RPcChmdW5jdGlvbigpIHttYWtlQ2hhbmdlRnJvbUhpc3RvcnkodGhpcywgXCJyZWRvXCIpO30pLFxuICB1bmRvU2VsZWN0aW9uOiBkb2NNZXRob2RPcChmdW5jdGlvbigpIHttYWtlQ2hhbmdlRnJvbUhpc3RvcnkodGhpcywgXCJ1bmRvXCIsIHRydWUpO30pLFxuICByZWRvU2VsZWN0aW9uOiBkb2NNZXRob2RPcChmdW5jdGlvbigpIHttYWtlQ2hhbmdlRnJvbUhpc3RvcnkodGhpcywgXCJyZWRvXCIsIHRydWUpO30pLFxuXG4gIHNldEV4dGVuZGluZzogZnVuY3Rpb24odmFsKSB7dGhpcy5leHRlbmQgPSB2YWw7fSxcbiAgZ2V0RXh0ZW5kaW5nOiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5leHRlbmR9LFxuXG4gIGhpc3RvcnlTaXplOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgaGlzdCA9IHRoaXMuaGlzdG9yeSwgZG9uZSA9IDAsIHVuZG9uZSA9IDA7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBoaXN0LmRvbmUubGVuZ3RoOyBpKyspIHsgaWYgKCFoaXN0LmRvbmVbaV0ucmFuZ2VzKSB7ICsrZG9uZTsgfSB9XG4gICAgZm9yICh2YXIgaSQxID0gMDsgaSQxIDwgaGlzdC51bmRvbmUubGVuZ3RoOyBpJDErKykgeyBpZiAoIWhpc3QudW5kb25lW2kkMV0ucmFuZ2VzKSB7ICsrdW5kb25lOyB9IH1cbiAgICByZXR1cm4ge3VuZG86IGRvbmUsIHJlZG86IHVuZG9uZX1cbiAgfSxcbiAgY2xlYXJIaXN0b3J5OiBmdW5jdGlvbigpIHt0aGlzLmhpc3RvcnkgPSBuZXcgSGlzdG9yeSh0aGlzLmhpc3RvcnkubWF4R2VuZXJhdGlvbik7fSxcblxuICBtYXJrQ2xlYW46IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY2xlYW5HZW5lcmF0aW9uID0gdGhpcy5jaGFuZ2VHZW5lcmF0aW9uKHRydWUpO1xuICB9LFxuICBjaGFuZ2VHZW5lcmF0aW9uOiBmdW5jdGlvbihmb3JjZVNwbGl0KSB7XG4gICAgaWYgKGZvcmNlU3BsaXQpXG4gICAgICB7IHRoaXMuaGlzdG9yeS5sYXN0T3AgPSB0aGlzLmhpc3RvcnkubGFzdFNlbE9wID0gdGhpcy5oaXN0b3J5Lmxhc3RPcmlnaW4gPSBudWxsOyB9XG4gICAgcmV0dXJuIHRoaXMuaGlzdG9yeS5nZW5lcmF0aW9uXG4gIH0sXG4gIGlzQ2xlYW46IGZ1bmN0aW9uIChnZW4pIHtcbiAgICByZXR1cm4gdGhpcy5oaXN0b3J5LmdlbmVyYXRpb24gPT0gKGdlbiB8fCB0aGlzLmNsZWFuR2VuZXJhdGlvbilcbiAgfSxcblxuICBnZXRIaXN0b3J5OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4ge2RvbmU6IGNvcHlIaXN0b3J5QXJyYXkodGhpcy5oaXN0b3J5LmRvbmUpLFxuICAgICAgICAgICAgdW5kb25lOiBjb3B5SGlzdG9yeUFycmF5KHRoaXMuaGlzdG9yeS51bmRvbmUpfVxuICB9LFxuICBzZXRIaXN0b3J5OiBmdW5jdGlvbihoaXN0RGF0YSkge1xuICAgIHZhciBoaXN0ID0gdGhpcy5oaXN0b3J5ID0gbmV3IEhpc3RvcnkodGhpcy5oaXN0b3J5Lm1heEdlbmVyYXRpb24pO1xuICAgIGhpc3QuZG9uZSA9IGNvcHlIaXN0b3J5QXJyYXkoaGlzdERhdGEuZG9uZS5zbGljZSgwKSwgbnVsbCwgdHJ1ZSk7XG4gICAgaGlzdC51bmRvbmUgPSBjb3B5SGlzdG9yeUFycmF5KGhpc3REYXRhLnVuZG9uZS5zbGljZSgwKSwgbnVsbCwgdHJ1ZSk7XG4gIH0sXG5cbiAgc2V0R3V0dGVyTWFya2VyOiBkb2NNZXRob2RPcChmdW5jdGlvbihsaW5lLCBndXR0ZXJJRCwgdmFsdWUpIHtcbiAgICByZXR1cm4gY2hhbmdlTGluZSh0aGlzLCBsaW5lLCBcImd1dHRlclwiLCBmdW5jdGlvbiAobGluZSkge1xuICAgICAgdmFyIG1hcmtlcnMgPSBsaW5lLmd1dHRlck1hcmtlcnMgfHwgKGxpbmUuZ3V0dGVyTWFya2VycyA9IHt9KTtcbiAgICAgIG1hcmtlcnNbZ3V0dGVySURdID0gdmFsdWU7XG4gICAgICBpZiAoIXZhbHVlICYmIGlzRW1wdHkobWFya2VycykpIHsgbGluZS5ndXR0ZXJNYXJrZXJzID0gbnVsbDsgfVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9KVxuICB9KSxcblxuICBjbGVhckd1dHRlcjogZG9jTWV0aG9kT3AoZnVuY3Rpb24oZ3V0dGVySUQpIHtcbiAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICAgIHRoaXMuaXRlcihmdW5jdGlvbiAobGluZSkge1xuICAgICAgaWYgKGxpbmUuZ3V0dGVyTWFya2VycyAmJiBsaW5lLmd1dHRlck1hcmtlcnNbZ3V0dGVySURdKSB7XG4gICAgICAgIGNoYW5nZUxpbmUodGhpcyQxLCBsaW5lLCBcImd1dHRlclwiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgbGluZS5ndXR0ZXJNYXJrZXJzW2d1dHRlcklEXSA9IG51bGw7XG4gICAgICAgICAgaWYgKGlzRW1wdHkobGluZS5ndXR0ZXJNYXJrZXJzKSkgeyBsaW5lLmd1dHRlck1hcmtlcnMgPSBudWxsOyB9XG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pLFxuXG4gIGxpbmVJbmZvOiBmdW5jdGlvbihsaW5lKSB7XG4gICAgdmFyIG47XG4gICAgaWYgKHR5cGVvZiBsaW5lID09IFwibnVtYmVyXCIpIHtcbiAgICAgIGlmICghaXNMaW5lKHRoaXMsIGxpbmUpKSB7IHJldHVybiBudWxsIH1cbiAgICAgIG4gPSBsaW5lO1xuICAgICAgbGluZSA9IGdldExpbmUodGhpcywgbGluZSk7XG4gICAgICBpZiAoIWxpbmUpIHsgcmV0dXJuIG51bGwgfVxuICAgIH0gZWxzZSB7XG4gICAgICBuID0gbGluZU5vKGxpbmUpO1xuICAgICAgaWYgKG4gPT0gbnVsbCkgeyByZXR1cm4gbnVsbCB9XG4gICAgfVxuICAgIHJldHVybiB7bGluZTogbiwgaGFuZGxlOiBsaW5lLCB0ZXh0OiBsaW5lLnRleHQsIGd1dHRlck1hcmtlcnM6IGxpbmUuZ3V0dGVyTWFya2VycyxcbiAgICAgICAgICAgIHRleHRDbGFzczogbGluZS50ZXh0Q2xhc3MsIGJnQ2xhc3M6IGxpbmUuYmdDbGFzcywgd3JhcENsYXNzOiBsaW5lLndyYXBDbGFzcyxcbiAgICAgICAgICAgIHdpZGdldHM6IGxpbmUud2lkZ2V0c31cbiAgfSxcblxuICBhZGRMaW5lQ2xhc3M6IGRvY01ldGhvZE9wKGZ1bmN0aW9uKGhhbmRsZSwgd2hlcmUsIGNscykge1xuICAgIHJldHVybiBjaGFuZ2VMaW5lKHRoaXMsIGhhbmRsZSwgd2hlcmUgPT0gXCJndXR0ZXJcIiA/IFwiZ3V0dGVyXCIgOiBcImNsYXNzXCIsIGZ1bmN0aW9uIChsaW5lKSB7XG4gICAgICB2YXIgcHJvcCA9IHdoZXJlID09IFwidGV4dFwiID8gXCJ0ZXh0Q2xhc3NcIlxuICAgICAgICAgICAgICAgOiB3aGVyZSA9PSBcImJhY2tncm91bmRcIiA/IFwiYmdDbGFzc1wiXG4gICAgICAgICAgICAgICA6IHdoZXJlID09IFwiZ3V0dGVyXCIgPyBcImd1dHRlckNsYXNzXCIgOiBcIndyYXBDbGFzc1wiO1xuICAgICAgaWYgKCFsaW5lW3Byb3BdKSB7IGxpbmVbcHJvcF0gPSBjbHM7IH1cbiAgICAgIGVsc2UgaWYgKGNsYXNzVGVzdChjbHMpLnRlc3QobGluZVtwcm9wXSkpIHsgcmV0dXJuIGZhbHNlIH1cbiAgICAgIGVsc2UgeyBsaW5lW3Byb3BdICs9IFwiIFwiICsgY2xzOyB9XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH0pXG4gIH0pLFxuICByZW1vdmVMaW5lQ2xhc3M6IGRvY01ldGhvZE9wKGZ1bmN0aW9uKGhhbmRsZSwgd2hlcmUsIGNscykge1xuICAgIHJldHVybiBjaGFuZ2VMaW5lKHRoaXMsIGhhbmRsZSwgd2hlcmUgPT0gXCJndXR0ZXJcIiA/IFwiZ3V0dGVyXCIgOiBcImNsYXNzXCIsIGZ1bmN0aW9uIChsaW5lKSB7XG4gICAgICB2YXIgcHJvcCA9IHdoZXJlID09IFwidGV4dFwiID8gXCJ0ZXh0Q2xhc3NcIlxuICAgICAgICAgICAgICAgOiB3aGVyZSA9PSBcImJhY2tncm91bmRcIiA/IFwiYmdDbGFzc1wiXG4gICAgICAgICAgICAgICA6IHdoZXJlID09IFwiZ3V0dGVyXCIgPyBcImd1dHRlckNsYXNzXCIgOiBcIndyYXBDbGFzc1wiO1xuICAgICAgdmFyIGN1ciA9IGxpbmVbcHJvcF07XG4gICAgICBpZiAoIWN1cikgeyByZXR1cm4gZmFsc2UgfVxuICAgICAgZWxzZSBpZiAoY2xzID09IG51bGwpIHsgbGluZVtwcm9wXSA9IG51bGw7IH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB2YXIgZm91bmQgPSBjdXIubWF0Y2goY2xhc3NUZXN0KGNscykpO1xuICAgICAgICBpZiAoIWZvdW5kKSB7IHJldHVybiBmYWxzZSB9XG4gICAgICAgIHZhciBlbmQgPSBmb3VuZC5pbmRleCArIGZvdW5kWzBdLmxlbmd0aDtcbiAgICAgICAgbGluZVtwcm9wXSA9IGN1ci5zbGljZSgwLCBmb3VuZC5pbmRleCkgKyAoIWZvdW5kLmluZGV4IHx8IGVuZCA9PSBjdXIubGVuZ3RoID8gXCJcIiA6IFwiIFwiKSArIGN1ci5zbGljZShlbmQpIHx8IG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH0pXG4gIH0pLFxuXG4gIGFkZExpbmVXaWRnZXQ6IGRvY01ldGhvZE9wKGZ1bmN0aW9uKGhhbmRsZSwgbm9kZSwgb3B0aW9ucykge1xuICAgIHJldHVybiBhZGRMaW5lV2lkZ2V0KHRoaXMsIGhhbmRsZSwgbm9kZSwgb3B0aW9ucylcbiAgfSksXG4gIHJlbW92ZUxpbmVXaWRnZXQ6IGZ1bmN0aW9uKHdpZGdldCkgeyB3aWRnZXQuY2xlYXIoKTsgfSxcblxuICBtYXJrVGV4dDogZnVuY3Rpb24oZnJvbSwgdG8sIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbWFya1RleHQodGhpcywgY2xpcFBvcyh0aGlzLCBmcm9tKSwgY2xpcFBvcyh0aGlzLCB0byksIG9wdGlvbnMsIG9wdGlvbnMgJiYgb3B0aW9ucy50eXBlIHx8IFwicmFuZ2VcIilcbiAgfSxcbiAgc2V0Qm9va21hcms6IGZ1bmN0aW9uKHBvcywgb3B0aW9ucykge1xuICAgIHZhciByZWFsT3B0cyA9IHtyZXBsYWNlZFdpdGg6IG9wdGlvbnMgJiYgKG9wdGlvbnMubm9kZVR5cGUgPT0gbnVsbCA/IG9wdGlvbnMud2lkZ2V0IDogb3B0aW9ucyksXG4gICAgICAgICAgICAgICAgICAgIGluc2VydExlZnQ6IG9wdGlvbnMgJiYgb3B0aW9ucy5pbnNlcnRMZWZ0LFxuICAgICAgICAgICAgICAgICAgICBjbGVhcldoZW5FbXB0eTogZmFsc2UsIHNoYXJlZDogb3B0aW9ucyAmJiBvcHRpb25zLnNoYXJlZCxcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlTW91c2VFdmVudHM6IG9wdGlvbnMgJiYgb3B0aW9ucy5oYW5kbGVNb3VzZUV2ZW50c307XG4gICAgcG9zID0gY2xpcFBvcyh0aGlzLCBwb3MpO1xuICAgIHJldHVybiBtYXJrVGV4dCh0aGlzLCBwb3MsIHBvcywgcmVhbE9wdHMsIFwiYm9va21hcmtcIilcbiAgfSxcbiAgZmluZE1hcmtzQXQ6IGZ1bmN0aW9uKHBvcykge1xuICAgIHBvcyA9IGNsaXBQb3ModGhpcywgcG9zKTtcbiAgICB2YXIgbWFya2VycyA9IFtdLCBzcGFucyA9IGdldExpbmUodGhpcywgcG9zLmxpbmUpLm1hcmtlZFNwYW5zO1xuICAgIGlmIChzcGFucykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHNwYW5zLmxlbmd0aDsgKytpKSB7XG4gICAgICB2YXIgc3BhbiA9IHNwYW5zW2ldO1xuICAgICAgaWYgKChzcGFuLmZyb20gPT0gbnVsbCB8fCBzcGFuLmZyb20gPD0gcG9zLmNoKSAmJlxuICAgICAgICAgIChzcGFuLnRvID09IG51bGwgfHwgc3Bhbi50byA+PSBwb3MuY2gpKVxuICAgICAgICB7IG1hcmtlcnMucHVzaChzcGFuLm1hcmtlci5wYXJlbnQgfHwgc3Bhbi5tYXJrZXIpOyB9XG4gICAgfSB9XG4gICAgcmV0dXJuIG1hcmtlcnNcbiAgfSxcbiAgZmluZE1hcmtzOiBmdW5jdGlvbihmcm9tLCB0bywgZmlsdGVyKSB7XG4gICAgZnJvbSA9IGNsaXBQb3ModGhpcywgZnJvbSk7IHRvID0gY2xpcFBvcyh0aGlzLCB0byk7XG4gICAgdmFyIGZvdW5kID0gW10sIGxpbmVObyQkMSA9IGZyb20ubGluZTtcbiAgICB0aGlzLml0ZXIoZnJvbS5saW5lLCB0by5saW5lICsgMSwgZnVuY3Rpb24gKGxpbmUpIHtcbiAgICAgIHZhciBzcGFucyA9IGxpbmUubWFya2VkU3BhbnM7XG4gICAgICBpZiAoc3BhbnMpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBzcGFucy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgc3BhbiA9IHNwYW5zW2ldO1xuICAgICAgICBpZiAoIShzcGFuLnRvICE9IG51bGwgJiYgbGluZU5vJCQxID09IGZyb20ubGluZSAmJiBmcm9tLmNoID49IHNwYW4udG8gfHxcbiAgICAgICAgICAgICAgc3Bhbi5mcm9tID09IG51bGwgJiYgbGluZU5vJCQxICE9IGZyb20ubGluZSB8fFxuICAgICAgICAgICAgICBzcGFuLmZyb20gIT0gbnVsbCAmJiBsaW5lTm8kJDEgPT0gdG8ubGluZSAmJiBzcGFuLmZyb20gPj0gdG8uY2gpICYmXG4gICAgICAgICAgICAoIWZpbHRlciB8fCBmaWx0ZXIoc3Bhbi5tYXJrZXIpKSlcbiAgICAgICAgICB7IGZvdW5kLnB1c2goc3Bhbi5tYXJrZXIucGFyZW50IHx8IHNwYW4ubWFya2VyKTsgfVxuICAgICAgfSB9XG4gICAgICArK2xpbmVObyQkMTtcbiAgICB9KTtcbiAgICByZXR1cm4gZm91bmRcbiAgfSxcbiAgZ2V0QWxsTWFya3M6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBtYXJrZXJzID0gW107XG4gICAgdGhpcy5pdGVyKGZ1bmN0aW9uIChsaW5lKSB7XG4gICAgICB2YXIgc3BzID0gbGluZS5tYXJrZWRTcGFucztcbiAgICAgIGlmIChzcHMpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBzcHMubGVuZ3RoOyArK2kpXG4gICAgICAgIHsgaWYgKHNwc1tpXS5mcm9tICE9IG51bGwpIHsgbWFya2Vycy5wdXNoKHNwc1tpXS5tYXJrZXIpOyB9IH0gfVxuICAgIH0pO1xuICAgIHJldHVybiBtYXJrZXJzXG4gIH0sXG5cbiAgcG9zRnJvbUluZGV4OiBmdW5jdGlvbihvZmYpIHtcbiAgICB2YXIgY2gsIGxpbmVObyQkMSA9IHRoaXMuZmlyc3QsIHNlcFNpemUgPSB0aGlzLmxpbmVTZXBhcmF0b3IoKS5sZW5ndGg7XG4gICAgdGhpcy5pdGVyKGZ1bmN0aW9uIChsaW5lKSB7XG4gICAgICB2YXIgc3ogPSBsaW5lLnRleHQubGVuZ3RoICsgc2VwU2l6ZTtcbiAgICAgIGlmIChzeiA+IG9mZikgeyBjaCA9IG9mZjsgcmV0dXJuIHRydWUgfVxuICAgICAgb2ZmIC09IHN6O1xuICAgICAgKytsaW5lTm8kJDE7XG4gICAgfSk7XG4gICAgcmV0dXJuIGNsaXBQb3ModGhpcywgUG9zKGxpbmVObyQkMSwgY2gpKVxuICB9LFxuICBpbmRleEZyb21Qb3M6IGZ1bmN0aW9uIChjb29yZHMpIHtcbiAgICBjb29yZHMgPSBjbGlwUG9zKHRoaXMsIGNvb3Jkcyk7XG4gICAgdmFyIGluZGV4ID0gY29vcmRzLmNoO1xuICAgIGlmIChjb29yZHMubGluZSA8IHRoaXMuZmlyc3QgfHwgY29vcmRzLmNoIDwgMCkgeyByZXR1cm4gMCB9XG4gICAgdmFyIHNlcFNpemUgPSB0aGlzLmxpbmVTZXBhcmF0b3IoKS5sZW5ndGg7XG4gICAgdGhpcy5pdGVyKHRoaXMuZmlyc3QsIGNvb3Jkcy5saW5lLCBmdW5jdGlvbiAobGluZSkgeyAvLyBpdGVyIGFib3J0cyB3aGVuIGNhbGxiYWNrIHJldHVybnMgYSB0cnV0aHkgdmFsdWVcbiAgICAgIGluZGV4ICs9IGxpbmUudGV4dC5sZW5ndGggKyBzZXBTaXplO1xuICAgIH0pO1xuICAgIHJldHVybiBpbmRleFxuICB9LFxuXG4gIGNvcHk6IGZ1bmN0aW9uKGNvcHlIaXN0b3J5KSB7XG4gICAgdmFyIGRvYyA9IG5ldyBEb2MoZ2V0TGluZXModGhpcywgdGhpcy5maXJzdCwgdGhpcy5maXJzdCArIHRoaXMuc2l6ZSksXG4gICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RlT3B0aW9uLCB0aGlzLmZpcnN0LCB0aGlzLmxpbmVTZXAsIHRoaXMuZGlyZWN0aW9uKTtcbiAgICBkb2Muc2Nyb2xsVG9wID0gdGhpcy5zY3JvbGxUb3A7IGRvYy5zY3JvbGxMZWZ0ID0gdGhpcy5zY3JvbGxMZWZ0O1xuICAgIGRvYy5zZWwgPSB0aGlzLnNlbDtcbiAgICBkb2MuZXh0ZW5kID0gZmFsc2U7XG4gICAgaWYgKGNvcHlIaXN0b3J5KSB7XG4gICAgICBkb2MuaGlzdG9yeS51bmRvRGVwdGggPSB0aGlzLmhpc3RvcnkudW5kb0RlcHRoO1xuICAgICAgZG9jLnNldEhpc3RvcnkodGhpcy5nZXRIaXN0b3J5KCkpO1xuICAgIH1cbiAgICByZXR1cm4gZG9jXG4gIH0sXG5cbiAgbGlua2VkRG9jOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zKSB7IG9wdGlvbnMgPSB7fTsgfVxuICAgIHZhciBmcm9tID0gdGhpcy5maXJzdCwgdG8gPSB0aGlzLmZpcnN0ICsgdGhpcy5zaXplO1xuICAgIGlmIChvcHRpb25zLmZyb20gIT0gbnVsbCAmJiBvcHRpb25zLmZyb20gPiBmcm9tKSB7IGZyb20gPSBvcHRpb25zLmZyb207IH1cbiAgICBpZiAob3B0aW9ucy50byAhPSBudWxsICYmIG9wdGlvbnMudG8gPCB0bykgeyB0byA9IG9wdGlvbnMudG87IH1cbiAgICB2YXIgY29weSA9IG5ldyBEb2MoZ2V0TGluZXModGhpcywgZnJvbSwgdG8pLCBvcHRpb25zLm1vZGUgfHwgdGhpcy5tb2RlT3B0aW9uLCBmcm9tLCB0aGlzLmxpbmVTZXAsIHRoaXMuZGlyZWN0aW9uKTtcbiAgICBpZiAob3B0aW9ucy5zaGFyZWRIaXN0KSB7IGNvcHkuaGlzdG9yeSA9IHRoaXMuaGlzdG9yeVxuICAgIDsgfSh0aGlzLmxpbmtlZCB8fCAodGhpcy5saW5rZWQgPSBbXSkpLnB1c2goe2RvYzogY29weSwgc2hhcmVkSGlzdDogb3B0aW9ucy5zaGFyZWRIaXN0fSk7XG4gICAgY29weS5saW5rZWQgPSBbe2RvYzogdGhpcywgaXNQYXJlbnQ6IHRydWUsIHNoYXJlZEhpc3Q6IG9wdGlvbnMuc2hhcmVkSGlzdH1dO1xuICAgIGNvcHlTaGFyZWRNYXJrZXJzKGNvcHksIGZpbmRTaGFyZWRNYXJrZXJzKHRoaXMpKTtcbiAgICByZXR1cm4gY29weVxuICB9LFxuICB1bmxpbmtEb2M6IGZ1bmN0aW9uKG90aGVyKSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgICBpZiAob3RoZXIgaW5zdGFuY2VvZiBDb2RlTWlycm9yJDEpIHsgb3RoZXIgPSBvdGhlci5kb2M7IH1cbiAgICBpZiAodGhpcy5saW5rZWQpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxpbmtlZC5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIGxpbmsgPSB0aGlzJDEubGlua2VkW2ldO1xuICAgICAgaWYgKGxpbmsuZG9jICE9IG90aGVyKSB7IGNvbnRpbnVlIH1cbiAgICAgIHRoaXMkMS5saW5rZWQuc3BsaWNlKGksIDEpO1xuICAgICAgb3RoZXIudW5saW5rRG9jKHRoaXMkMSk7XG4gICAgICBkZXRhY2hTaGFyZWRNYXJrZXJzKGZpbmRTaGFyZWRNYXJrZXJzKHRoaXMkMSkpO1xuICAgICAgYnJlYWtcbiAgICB9IH1cbiAgICAvLyBJZiB0aGUgaGlzdG9yaWVzIHdlcmUgc2hhcmVkLCBzcGxpdCB0aGVtIGFnYWluXG4gICAgaWYgKG90aGVyLmhpc3RvcnkgPT0gdGhpcy5oaXN0b3J5KSB7XG4gICAgICB2YXIgc3BsaXRJZHMgPSBbb3RoZXIuaWRdO1xuICAgICAgbGlua2VkRG9jcyhvdGhlciwgZnVuY3Rpb24gKGRvYykgeyByZXR1cm4gc3BsaXRJZHMucHVzaChkb2MuaWQpOyB9LCB0cnVlKTtcbiAgICAgIG90aGVyLmhpc3RvcnkgPSBuZXcgSGlzdG9yeShudWxsKTtcbiAgICAgIG90aGVyLmhpc3RvcnkuZG9uZSA9IGNvcHlIaXN0b3J5QXJyYXkodGhpcy5oaXN0b3J5LmRvbmUsIHNwbGl0SWRzKTtcbiAgICAgIG90aGVyLmhpc3RvcnkudW5kb25lID0gY29weUhpc3RvcnlBcnJheSh0aGlzLmhpc3RvcnkudW5kb25lLCBzcGxpdElkcyk7XG4gICAgfVxuICB9LFxuICBpdGVyTGlua2VkRG9jczogZnVuY3Rpb24oZikge2xpbmtlZERvY3ModGhpcywgZik7fSxcblxuICBnZXRNb2RlOiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5tb2RlfSxcbiAgZ2V0RWRpdG9yOiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5jbX0sXG5cbiAgc3BsaXRMaW5lczogZnVuY3Rpb24oc3RyKSB7XG4gICAgaWYgKHRoaXMubGluZVNlcCkgeyByZXR1cm4gc3RyLnNwbGl0KHRoaXMubGluZVNlcCkgfVxuICAgIHJldHVybiBzcGxpdExpbmVzQXV0byhzdHIpXG4gIH0sXG4gIGxpbmVTZXBhcmF0b3I6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5saW5lU2VwIHx8IFwiXFxuXCIgfSxcblxuICBzZXREaXJlY3Rpb246IGRvY01ldGhvZE9wKGZ1bmN0aW9uIChkaXIpIHtcbiAgICBpZiAoZGlyICE9IFwicnRsXCIpIHsgZGlyID0gXCJsdHJcIjsgfVxuICAgIGlmIChkaXIgPT0gdGhpcy5kaXJlY3Rpb24pIHsgcmV0dXJuIH1cbiAgICB0aGlzLmRpcmVjdGlvbiA9IGRpcjtcbiAgICB0aGlzLml0ZXIoZnVuY3Rpb24gKGxpbmUpIHsgcmV0dXJuIGxpbmUub3JkZXIgPSBudWxsOyB9KTtcbiAgICBpZiAodGhpcy5jbSkgeyBkaXJlY3Rpb25DaGFuZ2VkKHRoaXMuY20pOyB9XG4gIH0pXG59KTtcblxuLy8gUHVibGljIGFsaWFzLlxuRG9jLnByb3RvdHlwZS5lYWNoTGluZSA9IERvYy5wcm90b3R5cGUuaXRlcjtcblxuLy8gS2x1ZGdlIHRvIHdvcmsgYXJvdW5kIHN0cmFuZ2UgSUUgYmVoYXZpb3Igd2hlcmUgaXQnbGwgc29tZXRpbWVzXG4vLyByZS1maXJlIGEgc2VyaWVzIG9mIGRyYWctcmVsYXRlZCBldmVudHMgcmlnaHQgYWZ0ZXIgdGhlIGRyb3AgKCMxNTUxKVxudmFyIGxhc3REcm9wID0gMDtcblxuZnVuY3Rpb24gb25Ecm9wKGUpIHtcbiAgdmFyIGNtID0gdGhpcztcbiAgY2xlYXJEcmFnQ3Vyc29yKGNtKTtcbiAgaWYgKHNpZ25hbERPTUV2ZW50KGNtLCBlKSB8fCBldmVudEluV2lkZ2V0KGNtLmRpc3BsYXksIGUpKVxuICAgIHsgcmV0dXJuIH1cbiAgZV9wcmV2ZW50RGVmYXVsdChlKTtcbiAgaWYgKGllKSB7IGxhc3REcm9wID0gK25ldyBEYXRlOyB9XG4gIHZhciBwb3MgPSBwb3NGcm9tTW91c2UoY20sIGUsIHRydWUpLCBmaWxlcyA9IGUuZGF0YVRyYW5zZmVyLmZpbGVzO1xuICBpZiAoIXBvcyB8fCBjbS5pc1JlYWRPbmx5KCkpIHsgcmV0dXJuIH1cbiAgLy8gTWlnaHQgYmUgYSBmaWxlIGRyb3AsIGluIHdoaWNoIGNhc2Ugd2Ugc2ltcGx5IGV4dHJhY3QgdGhlIHRleHRcbiAgLy8gYW5kIGluc2VydCBpdC5cbiAgaWYgKGZpbGVzICYmIGZpbGVzLmxlbmd0aCAmJiB3aW5kb3cuRmlsZVJlYWRlciAmJiB3aW5kb3cuRmlsZSkge1xuICAgIHZhciBuID0gZmlsZXMubGVuZ3RoLCB0ZXh0ID0gQXJyYXkobiksIHJlYWQgPSAwO1xuICAgIHZhciBsb2FkRmlsZSA9IGZ1bmN0aW9uIChmaWxlLCBpKSB7XG4gICAgICBpZiAoY20ub3B0aW9ucy5hbGxvd0Ryb3BGaWxlVHlwZXMgJiZcbiAgICAgICAgICBpbmRleE9mKGNtLm9wdGlvbnMuYWxsb3dEcm9wRmlsZVR5cGVzLCBmaWxlLnR5cGUpID09IC0xKVxuICAgICAgICB7IHJldHVybiB9XG5cbiAgICAgIHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcjtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSBvcGVyYXRpb24oY20sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGNvbnRlbnQgPSByZWFkZXIucmVzdWx0O1xuICAgICAgICBpZiAoL1tcXHgwMC1cXHgwOFxceDBlLVxceDFmXXsyfS8udGVzdChjb250ZW50KSkgeyBjb250ZW50ID0gXCJcIjsgfVxuICAgICAgICB0ZXh0W2ldID0gY29udGVudDtcbiAgICAgICAgaWYgKCsrcmVhZCA9PSBuKSB7XG4gICAgICAgICAgcG9zID0gY2xpcFBvcyhjbS5kb2MsIHBvcyk7XG4gICAgICAgICAgdmFyIGNoYW5nZSA9IHtmcm9tOiBwb3MsIHRvOiBwb3MsXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiBjbS5kb2Muc3BsaXRMaW5lcyh0ZXh0LmpvaW4oY20uZG9jLmxpbmVTZXBhcmF0b3IoKSkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3JpZ2luOiBcInBhc3RlXCJ9O1xuICAgICAgICAgIG1ha2VDaGFuZ2UoY20uZG9jLCBjaGFuZ2UpO1xuICAgICAgICAgIHNldFNlbGVjdGlvblJlcGxhY2VIaXN0b3J5KGNtLmRvYywgc2ltcGxlU2VsZWN0aW9uKHBvcywgY2hhbmdlRW5kKGNoYW5nZSkpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlKTtcbiAgICB9O1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7IGxvYWRGaWxlKGZpbGVzW2ldLCBpKTsgfVxuICB9IGVsc2UgeyAvLyBOb3JtYWwgZHJvcFxuICAgIC8vIERvbid0IGRvIGEgcmVwbGFjZSBpZiB0aGUgZHJvcCBoYXBwZW5lZCBpbnNpZGUgb2YgdGhlIHNlbGVjdGVkIHRleHQuXG4gICAgaWYgKGNtLnN0YXRlLmRyYWdnaW5nVGV4dCAmJiBjbS5kb2Muc2VsLmNvbnRhaW5zKHBvcykgPiAtMSkge1xuICAgICAgY20uc3RhdGUuZHJhZ2dpbmdUZXh0KGUpO1xuICAgICAgLy8gRW5zdXJlIHRoZSBlZGl0b3IgaXMgcmUtZm9jdXNlZFxuICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7IHJldHVybiBjbS5kaXNwbGF5LmlucHV0LmZvY3VzKCk7IH0sIDIwKTtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICB0cnkge1xuICAgICAgdmFyIHRleHQkMSA9IGUuZGF0YVRyYW5zZmVyLmdldERhdGEoXCJUZXh0XCIpO1xuICAgICAgaWYgKHRleHQkMSkge1xuICAgICAgICB2YXIgc2VsZWN0ZWQ7XG4gICAgICAgIGlmIChjbS5zdGF0ZS5kcmFnZ2luZ1RleHQgJiYgIWNtLnN0YXRlLmRyYWdnaW5nVGV4dC5jb3B5KVxuICAgICAgICAgIHsgc2VsZWN0ZWQgPSBjbS5saXN0U2VsZWN0aW9ucygpOyB9XG4gICAgICAgIHNldFNlbGVjdGlvbk5vVW5kbyhjbS5kb2MsIHNpbXBsZVNlbGVjdGlvbihwb3MsIHBvcykpO1xuICAgICAgICBpZiAoc2VsZWN0ZWQpIHsgZm9yICh2YXIgaSQxID0gMDsgaSQxIDwgc2VsZWN0ZWQubGVuZ3RoOyArK2kkMSlcbiAgICAgICAgICB7IHJlcGxhY2VSYW5nZShjbS5kb2MsIFwiXCIsIHNlbGVjdGVkW2kkMV0uYW5jaG9yLCBzZWxlY3RlZFtpJDFdLmhlYWQsIFwiZHJhZ1wiKTsgfSB9XG4gICAgICAgIGNtLnJlcGxhY2VTZWxlY3Rpb24odGV4dCQxLCBcImFyb3VuZFwiLCBcInBhc3RlXCIpO1xuICAgICAgICBjbS5kaXNwbGF5LmlucHV0LmZvY3VzKCk7XG4gICAgICB9XG4gICAgfVxuICAgIGNhdGNoKGUpe31cbiAgfVxufVxuXG5mdW5jdGlvbiBvbkRyYWdTdGFydChjbSwgZSkge1xuICBpZiAoaWUgJiYgKCFjbS5zdGF0ZS5kcmFnZ2luZ1RleHQgfHwgK25ldyBEYXRlIC0gbGFzdERyb3AgPCAxMDApKSB7IGVfc3RvcChlKTsgcmV0dXJuIH1cbiAgaWYgKHNpZ25hbERPTUV2ZW50KGNtLCBlKSB8fCBldmVudEluV2lkZ2V0KGNtLmRpc3BsYXksIGUpKSB7IHJldHVybiB9XG5cbiAgZS5kYXRhVHJhbnNmZXIuc2V0RGF0YShcIlRleHRcIiwgY20uZ2V0U2VsZWN0aW9uKCkpO1xuICBlLmRhdGFUcmFuc2Zlci5lZmZlY3RBbGxvd2VkID0gXCJjb3B5TW92ZVwiO1xuXG4gIC8vIFVzZSBkdW1teSBpbWFnZSBpbnN0ZWFkIG9mIGRlZmF1bHQgYnJvd3NlcnMgaW1hZ2UuXG4gIC8vIFJlY2VudCBTYWZhcmkgKH42LjAuMikgaGF2ZSBhIHRlbmRlbmN5IHRvIHNlZ2ZhdWx0IHdoZW4gdGhpcyBoYXBwZW5zLCBzbyB3ZSBkb24ndCBkbyBpdCB0aGVyZS5cbiAgaWYgKGUuZGF0YVRyYW5zZmVyLnNldERyYWdJbWFnZSAmJiAhc2FmYXJpKSB7XG4gICAgdmFyIGltZyA9IGVsdChcImltZ1wiLCBudWxsLCBudWxsLCBcInBvc2l0aW9uOiBmaXhlZDsgbGVmdDogMDsgdG9wOiAwO1wiKTtcbiAgICBpbWcuc3JjID0gXCJkYXRhOmltYWdlL2dpZjtiYXNlNjQsUjBsR09EbGhBUUFCQUFBQUFDSDVCQUVLQUFFQUxBQUFBQUFCQUFFQUFBSUNUQUVBT3c9PVwiO1xuICAgIGlmIChwcmVzdG8pIHtcbiAgICAgIGltZy53aWR0aCA9IGltZy5oZWlnaHQgPSAxO1xuICAgICAgY20uZGlzcGxheS53cmFwcGVyLmFwcGVuZENoaWxkKGltZyk7XG4gICAgICAvLyBGb3JjZSBhIHJlbGF5b3V0LCBvciBPcGVyYSB3b24ndCB1c2Ugb3VyIGltYWdlIGZvciBzb21lIG9ic2N1cmUgcmVhc29uXG4gICAgICBpbWcuX3RvcCA9IGltZy5vZmZzZXRUb3A7XG4gICAgfVxuICAgIGUuZGF0YVRyYW5zZmVyLnNldERyYWdJbWFnZShpbWcsIDAsIDApO1xuICAgIGlmIChwcmVzdG8pIHsgaW1nLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoaW1nKTsgfVxuICB9XG59XG5cbmZ1bmN0aW9uIG9uRHJhZ092ZXIoY20sIGUpIHtcbiAgdmFyIHBvcyA9IHBvc0Zyb21Nb3VzZShjbSwgZSk7XG4gIGlmICghcG9zKSB7IHJldHVybiB9XG4gIHZhciBmcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICBkcmF3U2VsZWN0aW9uQ3Vyc29yKGNtLCBwb3MsIGZyYWcpO1xuICBpZiAoIWNtLmRpc3BsYXkuZHJhZ0N1cnNvcikge1xuICAgIGNtLmRpc3BsYXkuZHJhZ0N1cnNvciA9IGVsdChcImRpdlwiLCBudWxsLCBcIkNvZGVNaXJyb3ItY3Vyc29ycyBDb2RlTWlycm9yLWRyYWdjdXJzb3JzXCIpO1xuICAgIGNtLmRpc3BsYXkubGluZVNwYWNlLmluc2VydEJlZm9yZShjbS5kaXNwbGF5LmRyYWdDdXJzb3IsIGNtLmRpc3BsYXkuY3Vyc29yRGl2KTtcbiAgfVxuICByZW1vdmVDaGlsZHJlbkFuZEFkZChjbS5kaXNwbGF5LmRyYWdDdXJzb3IsIGZyYWcpO1xufVxuXG5mdW5jdGlvbiBjbGVhckRyYWdDdXJzb3IoY20pIHtcbiAgaWYgKGNtLmRpc3BsYXkuZHJhZ0N1cnNvcikge1xuICAgIGNtLmRpc3BsYXkubGluZVNwYWNlLnJlbW92ZUNoaWxkKGNtLmRpc3BsYXkuZHJhZ0N1cnNvcik7XG4gICAgY20uZGlzcGxheS5kcmFnQ3Vyc29yID0gbnVsbDtcbiAgfVxufVxuXG4vLyBUaGVzZSBtdXN0IGJlIGhhbmRsZWQgY2FyZWZ1bGx5LCBiZWNhdXNlIG5haXZlbHkgcmVnaXN0ZXJpbmcgYVxuLy8gaGFuZGxlciBmb3IgZWFjaCBlZGl0b3Igd2lsbCBjYXVzZSB0aGUgZWRpdG9ycyB0byBuZXZlciBiZVxuLy8gZ2FyYmFnZSBjb2xsZWN0ZWQuXG5cbmZ1bmN0aW9uIGZvckVhY2hDb2RlTWlycm9yKGYpIHtcbiAgaWYgKCFkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKSB7IHJldHVybiB9XG4gIHZhciBieUNsYXNzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcIkNvZGVNaXJyb3JcIik7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnlDbGFzcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBjbSA9IGJ5Q2xhc3NbaV0uQ29kZU1pcnJvcjtcbiAgICBpZiAoY20pIHsgZihjbSk7IH1cbiAgfVxufVxuXG52YXIgZ2xvYmFsc1JlZ2lzdGVyZWQgPSBmYWxzZTtcbmZ1bmN0aW9uIGVuc3VyZUdsb2JhbEhhbmRsZXJzKCkge1xuICBpZiAoZ2xvYmFsc1JlZ2lzdGVyZWQpIHsgcmV0dXJuIH1cbiAgcmVnaXN0ZXJHbG9iYWxIYW5kbGVycygpO1xuICBnbG9iYWxzUmVnaXN0ZXJlZCA9IHRydWU7XG59XG5mdW5jdGlvbiByZWdpc3Rlckdsb2JhbEhhbmRsZXJzKCkge1xuICAvLyBXaGVuIHRoZSB3aW5kb3cgcmVzaXplcywgd2UgbmVlZCB0byByZWZyZXNoIGFjdGl2ZSBlZGl0b3JzLlxuICB2YXIgcmVzaXplVGltZXI7XG4gIG9uKHdpbmRvdywgXCJyZXNpemVcIiwgZnVuY3Rpb24gKCkge1xuICAgIGlmIChyZXNpemVUaW1lciA9PSBudWxsKSB7IHJlc2l6ZVRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICByZXNpemVUaW1lciA9IG51bGw7XG4gICAgICBmb3JFYWNoQ29kZU1pcnJvcihvblJlc2l6ZSk7XG4gICAgfSwgMTAwKTsgfVxuICB9KTtcbiAgLy8gV2hlbiB0aGUgd2luZG93IGxvc2VzIGZvY3VzLCB3ZSB3YW50IHRvIHNob3cgdGhlIGVkaXRvciBhcyBibHVycmVkXG4gIG9uKHdpbmRvdywgXCJibHVyXCIsIGZ1bmN0aW9uICgpIHsgcmV0dXJuIGZvckVhY2hDb2RlTWlycm9yKG9uQmx1cik7IH0pO1xufVxuLy8gQ2FsbGVkIHdoZW4gdGhlIHdpbmRvdyByZXNpemVzXG5mdW5jdGlvbiBvblJlc2l6ZShjbSkge1xuICB2YXIgZCA9IGNtLmRpc3BsYXk7XG4gIGlmIChkLmxhc3RXcmFwSGVpZ2h0ID09IGQud3JhcHBlci5jbGllbnRIZWlnaHQgJiYgZC5sYXN0V3JhcFdpZHRoID09IGQud3JhcHBlci5jbGllbnRXaWR0aClcbiAgICB7IHJldHVybiB9XG4gIC8vIE1pZ2h0IGJlIGEgdGV4dCBzY2FsaW5nIG9wZXJhdGlvbiwgY2xlYXIgc2l6ZSBjYWNoZXMuXG4gIGQuY2FjaGVkQ2hhcldpZHRoID0gZC5jYWNoZWRUZXh0SGVpZ2h0ID0gZC5jYWNoZWRQYWRkaW5nSCA9IG51bGw7XG4gIGQuc2Nyb2xsYmFyc0NsaXBwZWQgPSBmYWxzZTtcbiAgY20uc2V0U2l6ZSgpO1xufVxuXG52YXIga2V5TmFtZXMgPSB7XG4gIDM6IFwiUGF1c2VcIiwgODogXCJCYWNrc3BhY2VcIiwgOTogXCJUYWJcIiwgMTM6IFwiRW50ZXJcIiwgMTY6IFwiU2hpZnRcIiwgMTc6IFwiQ3RybFwiLCAxODogXCJBbHRcIixcbiAgMTk6IFwiUGF1c2VcIiwgMjA6IFwiQ2Fwc0xvY2tcIiwgMjc6IFwiRXNjXCIsIDMyOiBcIlNwYWNlXCIsIDMzOiBcIlBhZ2VVcFwiLCAzNDogXCJQYWdlRG93blwiLCAzNTogXCJFbmRcIixcbiAgMzY6IFwiSG9tZVwiLCAzNzogXCJMZWZ0XCIsIDM4OiBcIlVwXCIsIDM5OiBcIlJpZ2h0XCIsIDQwOiBcIkRvd25cIiwgNDQ6IFwiUHJpbnRTY3JuXCIsIDQ1OiBcIkluc2VydFwiLFxuICA0NjogXCJEZWxldGVcIiwgNTk6IFwiO1wiLCA2MTogXCI9XCIsIDkxOiBcIk1vZFwiLCA5MjogXCJNb2RcIiwgOTM6IFwiTW9kXCIsXG4gIDEwNjogXCIqXCIsIDEwNzogXCI9XCIsIDEwOTogXCItXCIsIDExMDogXCIuXCIsIDExMTogXCIvXCIsIDEyNzogXCJEZWxldGVcIiwgMTQ1OiBcIlNjcm9sbExvY2tcIixcbiAgMTczOiBcIi1cIiwgMTg2OiBcIjtcIiwgMTg3OiBcIj1cIiwgMTg4OiBcIixcIiwgMTg5OiBcIi1cIiwgMTkwOiBcIi5cIiwgMTkxOiBcIi9cIiwgMTkyOiBcImBcIiwgMjE5OiBcIltcIiwgMjIwOiBcIlxcXFxcIixcbiAgMjIxOiBcIl1cIiwgMjIyOiBcIidcIiwgNjMyMzI6IFwiVXBcIiwgNjMyMzM6IFwiRG93blwiLCA2MzIzNDogXCJMZWZ0XCIsIDYzMjM1OiBcIlJpZ2h0XCIsIDYzMjcyOiBcIkRlbGV0ZVwiLFxuICA2MzI3MzogXCJIb21lXCIsIDYzMjc1OiBcIkVuZFwiLCA2MzI3NjogXCJQYWdlVXBcIiwgNjMyNzc6IFwiUGFnZURvd25cIiwgNjMzMDI6IFwiSW5zZXJ0XCJcbn07XG5cbi8vIE51bWJlciBrZXlzXG5mb3IgKHZhciBpID0gMDsgaSA8IDEwOyBpKyspIHsga2V5TmFtZXNbaSArIDQ4XSA9IGtleU5hbWVzW2kgKyA5Nl0gPSBTdHJpbmcoaSk7IH1cbi8vIEFscGhhYmV0aWMga2V5c1xuZm9yICh2YXIgaSQxID0gNjU7IGkkMSA8PSA5MDsgaSQxKyspIHsga2V5TmFtZXNbaSQxXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUoaSQxKTsgfVxuLy8gRnVuY3Rpb24ga2V5c1xuZm9yICh2YXIgaSQyID0gMTsgaSQyIDw9IDEyOyBpJDIrKykgeyBrZXlOYW1lc1tpJDIgKyAxMTFdID0ga2V5TmFtZXNbaSQyICsgNjMyMzVdID0gXCJGXCIgKyBpJDI7IH1cblxudmFyIGtleU1hcCA9IHt9O1xuXG5rZXlNYXAuYmFzaWMgPSB7XG4gIFwiTGVmdFwiOiBcImdvQ2hhckxlZnRcIiwgXCJSaWdodFwiOiBcImdvQ2hhclJpZ2h0XCIsIFwiVXBcIjogXCJnb0xpbmVVcFwiLCBcIkRvd25cIjogXCJnb0xpbmVEb3duXCIsXG4gIFwiRW5kXCI6IFwiZ29MaW5lRW5kXCIsIFwiSG9tZVwiOiBcImdvTGluZVN0YXJ0U21hcnRcIiwgXCJQYWdlVXBcIjogXCJnb1BhZ2VVcFwiLCBcIlBhZ2VEb3duXCI6IFwiZ29QYWdlRG93blwiLFxuICBcIkRlbGV0ZVwiOiBcImRlbENoYXJBZnRlclwiLCBcIkJhY2tzcGFjZVwiOiBcImRlbENoYXJCZWZvcmVcIiwgXCJTaGlmdC1CYWNrc3BhY2VcIjogXCJkZWxDaGFyQmVmb3JlXCIsXG4gIFwiVGFiXCI6IFwiZGVmYXVsdFRhYlwiLCBcIlNoaWZ0LVRhYlwiOiBcImluZGVudEF1dG9cIixcbiAgXCJFbnRlclwiOiBcIm5ld2xpbmVBbmRJbmRlbnRcIiwgXCJJbnNlcnRcIjogXCJ0b2dnbGVPdmVyd3JpdGVcIixcbiAgXCJFc2NcIjogXCJzaW5nbGVTZWxlY3Rpb25cIlxufTtcbi8vIE5vdGUgdGhhdCB0aGUgc2F2ZSBhbmQgZmluZC1yZWxhdGVkIGNvbW1hbmRzIGFyZW4ndCBkZWZpbmVkIGJ5XG4vLyBkZWZhdWx0LiBVc2VyIGNvZGUgb3IgYWRkb25zIGNhbiBkZWZpbmUgdGhlbS4gVW5rbm93biBjb21tYW5kc1xuLy8gYXJlIHNpbXBseSBpZ25vcmVkLlxua2V5TWFwLnBjRGVmYXVsdCA9IHtcbiAgXCJDdHJsLUFcIjogXCJzZWxlY3RBbGxcIiwgXCJDdHJsLURcIjogXCJkZWxldGVMaW5lXCIsIFwiQ3RybC1aXCI6IFwidW5kb1wiLCBcIlNoaWZ0LUN0cmwtWlwiOiBcInJlZG9cIiwgXCJDdHJsLVlcIjogXCJyZWRvXCIsXG4gIFwiQ3RybC1Ib21lXCI6IFwiZ29Eb2NTdGFydFwiLCBcIkN0cmwtRW5kXCI6IFwiZ29Eb2NFbmRcIiwgXCJDdHJsLVVwXCI6IFwiZ29MaW5lVXBcIiwgXCJDdHJsLURvd25cIjogXCJnb0xpbmVEb3duXCIsXG4gIFwiQ3RybC1MZWZ0XCI6IFwiZ29Hcm91cExlZnRcIiwgXCJDdHJsLVJpZ2h0XCI6IFwiZ29Hcm91cFJpZ2h0XCIsIFwiQWx0LUxlZnRcIjogXCJnb0xpbmVTdGFydFwiLCBcIkFsdC1SaWdodFwiOiBcImdvTGluZUVuZFwiLFxuICBcIkN0cmwtQmFja3NwYWNlXCI6IFwiZGVsR3JvdXBCZWZvcmVcIiwgXCJDdHJsLURlbGV0ZVwiOiBcImRlbEdyb3VwQWZ0ZXJcIiwgXCJDdHJsLVNcIjogXCJzYXZlXCIsIFwiQ3RybC1GXCI6IFwiZmluZFwiLFxuICBcIkN0cmwtR1wiOiBcImZpbmROZXh0XCIsIFwiU2hpZnQtQ3RybC1HXCI6IFwiZmluZFByZXZcIiwgXCJTaGlmdC1DdHJsLUZcIjogXCJyZXBsYWNlXCIsIFwiU2hpZnQtQ3RybC1SXCI6IFwicmVwbGFjZUFsbFwiLFxuICBcIkN0cmwtW1wiOiBcImluZGVudExlc3NcIiwgXCJDdHJsLV1cIjogXCJpbmRlbnRNb3JlXCIsXG4gIFwiQ3RybC1VXCI6IFwidW5kb1NlbGVjdGlvblwiLCBcIlNoaWZ0LUN0cmwtVVwiOiBcInJlZG9TZWxlY3Rpb25cIiwgXCJBbHQtVVwiOiBcInJlZG9TZWxlY3Rpb25cIixcbiAgZmFsbHRocm91Z2g6IFwiYmFzaWNcIlxufTtcbi8vIFZlcnkgYmFzaWMgcmVhZGxpbmUvZW1hY3Mtc3R5bGUgYmluZGluZ3MsIHdoaWNoIGFyZSBzdGFuZGFyZCBvbiBNYWMuXG5rZXlNYXAuZW1hY3N5ID0ge1xuICBcIkN0cmwtRlwiOiBcImdvQ2hhclJpZ2h0XCIsIFwiQ3RybC1CXCI6IFwiZ29DaGFyTGVmdFwiLCBcIkN0cmwtUFwiOiBcImdvTGluZVVwXCIsIFwiQ3RybC1OXCI6IFwiZ29MaW5lRG93blwiLFxuICBcIkFsdC1GXCI6IFwiZ29Xb3JkUmlnaHRcIiwgXCJBbHQtQlwiOiBcImdvV29yZExlZnRcIiwgXCJDdHJsLUFcIjogXCJnb0xpbmVTdGFydFwiLCBcIkN0cmwtRVwiOiBcImdvTGluZUVuZFwiLFxuICBcIkN0cmwtVlwiOiBcImdvUGFnZURvd25cIiwgXCJTaGlmdC1DdHJsLVZcIjogXCJnb1BhZ2VVcFwiLCBcIkN0cmwtRFwiOiBcImRlbENoYXJBZnRlclwiLCBcIkN0cmwtSFwiOiBcImRlbENoYXJCZWZvcmVcIixcbiAgXCJBbHQtRFwiOiBcImRlbFdvcmRBZnRlclwiLCBcIkFsdC1CYWNrc3BhY2VcIjogXCJkZWxXb3JkQmVmb3JlXCIsIFwiQ3RybC1LXCI6IFwia2lsbExpbmVcIiwgXCJDdHJsLVRcIjogXCJ0cmFuc3Bvc2VDaGFyc1wiLFxuICBcIkN0cmwtT1wiOiBcIm9wZW5MaW5lXCJcbn07XG5rZXlNYXAubWFjRGVmYXVsdCA9IHtcbiAgXCJDbWQtQVwiOiBcInNlbGVjdEFsbFwiLCBcIkNtZC1EXCI6IFwiZGVsZXRlTGluZVwiLCBcIkNtZC1aXCI6IFwidW5kb1wiLCBcIlNoaWZ0LUNtZC1aXCI6IFwicmVkb1wiLCBcIkNtZC1ZXCI6IFwicmVkb1wiLFxuICBcIkNtZC1Ib21lXCI6IFwiZ29Eb2NTdGFydFwiLCBcIkNtZC1VcFwiOiBcImdvRG9jU3RhcnRcIiwgXCJDbWQtRW5kXCI6IFwiZ29Eb2NFbmRcIiwgXCJDbWQtRG93blwiOiBcImdvRG9jRW5kXCIsIFwiQWx0LUxlZnRcIjogXCJnb0dyb3VwTGVmdFwiLFxuICBcIkFsdC1SaWdodFwiOiBcImdvR3JvdXBSaWdodFwiLCBcIkNtZC1MZWZ0XCI6IFwiZ29MaW5lTGVmdFwiLCBcIkNtZC1SaWdodFwiOiBcImdvTGluZVJpZ2h0XCIsIFwiQWx0LUJhY2tzcGFjZVwiOiBcImRlbEdyb3VwQmVmb3JlXCIsXG4gIFwiQ3RybC1BbHQtQmFja3NwYWNlXCI6IFwiZGVsR3JvdXBBZnRlclwiLCBcIkFsdC1EZWxldGVcIjogXCJkZWxHcm91cEFmdGVyXCIsIFwiQ21kLVNcIjogXCJzYXZlXCIsIFwiQ21kLUZcIjogXCJmaW5kXCIsXG4gIFwiQ21kLUdcIjogXCJmaW5kTmV4dFwiLCBcIlNoaWZ0LUNtZC1HXCI6IFwiZmluZFByZXZcIiwgXCJDbWQtQWx0LUZcIjogXCJyZXBsYWNlXCIsIFwiU2hpZnQtQ21kLUFsdC1GXCI6IFwicmVwbGFjZUFsbFwiLFxuICBcIkNtZC1bXCI6IFwiaW5kZW50TGVzc1wiLCBcIkNtZC1dXCI6IFwiaW5kZW50TW9yZVwiLCBcIkNtZC1CYWNrc3BhY2VcIjogXCJkZWxXcmFwcGVkTGluZUxlZnRcIiwgXCJDbWQtRGVsZXRlXCI6IFwiZGVsV3JhcHBlZExpbmVSaWdodFwiLFxuICBcIkNtZC1VXCI6IFwidW5kb1NlbGVjdGlvblwiLCBcIlNoaWZ0LUNtZC1VXCI6IFwicmVkb1NlbGVjdGlvblwiLCBcIkN0cmwtVXBcIjogXCJnb0RvY1N0YXJ0XCIsIFwiQ3RybC1Eb3duXCI6IFwiZ29Eb2NFbmRcIixcbiAgZmFsbHRocm91Z2g6IFtcImJhc2ljXCIsIFwiZW1hY3N5XCJdXG59O1xua2V5TWFwW1wiZGVmYXVsdFwiXSA9IG1hYyA/IGtleU1hcC5tYWNEZWZhdWx0IDoga2V5TWFwLnBjRGVmYXVsdDtcblxuLy8gS0VZTUFQIERJU1BBVENIXG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUtleU5hbWUobmFtZSkge1xuICB2YXIgcGFydHMgPSBuYW1lLnNwbGl0KC8tKD8hJCkvKTtcbiAgbmFtZSA9IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdO1xuICB2YXIgYWx0LCBjdHJsLCBzaGlmdCwgY21kO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgIHZhciBtb2QgPSBwYXJ0c1tpXTtcbiAgICBpZiAoL14oY21kfG1ldGF8bSkkL2kudGVzdChtb2QpKSB7IGNtZCA9IHRydWU7IH1cbiAgICBlbHNlIGlmICgvXmEobHQpPyQvaS50ZXN0KG1vZCkpIHsgYWx0ID0gdHJ1ZTsgfVxuICAgIGVsc2UgaWYgKC9eKGN8Y3RybHxjb250cm9sKSQvaS50ZXN0KG1vZCkpIHsgY3RybCA9IHRydWU7IH1cbiAgICBlbHNlIGlmICgvXnMoaGlmdCk/JC9pLnRlc3QobW9kKSkgeyBzaGlmdCA9IHRydWU7IH1cbiAgICBlbHNlIHsgdGhyb3cgbmV3IEVycm9yKFwiVW5yZWNvZ25pemVkIG1vZGlmaWVyIG5hbWU6IFwiICsgbW9kKSB9XG4gIH1cbiAgaWYgKGFsdCkgeyBuYW1lID0gXCJBbHQtXCIgKyBuYW1lOyB9XG4gIGlmIChjdHJsKSB7IG5hbWUgPSBcIkN0cmwtXCIgKyBuYW1lOyB9XG4gIGlmIChjbWQpIHsgbmFtZSA9IFwiQ21kLVwiICsgbmFtZTsgfVxuICBpZiAoc2hpZnQpIHsgbmFtZSA9IFwiU2hpZnQtXCIgKyBuYW1lOyB9XG4gIHJldHVybiBuYW1lXG59XG5cbi8vIFRoaXMgaXMgYSBrbHVkZ2UgdG8ga2VlcCBrZXltYXBzIG1vc3RseSB3b3JraW5nIGFzIHJhdyBvYmplY3RzXG4vLyAoYmFja3dhcmRzIGNvbXBhdGliaWxpdHkpIHdoaWxlIGF0IHRoZSBzYW1lIHRpbWUgc3VwcG9ydCBmZWF0dXJlc1xuLy8gbGlrZSBub3JtYWxpemF0aW9uIGFuZCBtdWx0aS1zdHJva2Uga2V5IGJpbmRpbmdzLiBJdCBjb21waWxlcyBhXG4vLyBuZXcgbm9ybWFsaXplZCBrZXltYXAsIGFuZCB0aGVuIHVwZGF0ZXMgdGhlIG9sZCBvYmplY3QgdG8gcmVmbGVjdFxuLy8gdGhpcy5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUtleU1hcChrZXltYXApIHtcbiAgdmFyIGNvcHkgPSB7fTtcbiAgZm9yICh2YXIga2V5bmFtZSBpbiBrZXltYXApIHsgaWYgKGtleW1hcC5oYXNPd25Qcm9wZXJ0eShrZXluYW1lKSkge1xuICAgIHZhciB2YWx1ZSA9IGtleW1hcFtrZXluYW1lXTtcbiAgICBpZiAoL14obmFtZXxmYWxsdGhyb3VnaHwoZGV8YXQpdGFjaCkkLy50ZXN0KGtleW5hbWUpKSB7IGNvbnRpbnVlIH1cbiAgICBpZiAodmFsdWUgPT0gXCIuLi5cIikgeyBkZWxldGUga2V5bWFwW2tleW5hbWVdOyBjb250aW51ZSB9XG5cbiAgICB2YXIga2V5cyA9IG1hcChrZXluYW1lLnNwbGl0KFwiIFwiKSwgbm9ybWFsaXplS2V5TmFtZSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgdmFsID0gKHZvaWQgMCksIG5hbWUgPSAodm9pZCAwKTtcbiAgICAgIGlmIChpID09IGtleXMubGVuZ3RoIC0gMSkge1xuICAgICAgICBuYW1lID0ga2V5cy5qb2luKFwiIFwiKTtcbiAgICAgICAgdmFsID0gdmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuYW1lID0ga2V5cy5zbGljZSgwLCBpICsgMSkuam9pbihcIiBcIik7XG4gICAgICAgIHZhbCA9IFwiLi4uXCI7XG4gICAgICB9XG4gICAgICB2YXIgcHJldiA9IGNvcHlbbmFtZV07XG4gICAgICBpZiAoIXByZXYpIHsgY29weVtuYW1lXSA9IHZhbDsgfVxuICAgICAgZWxzZSBpZiAocHJldiAhPSB2YWwpIHsgdGhyb3cgbmV3IEVycm9yKFwiSW5jb25zaXN0ZW50IGJpbmRpbmdzIGZvciBcIiArIG5hbWUpIH1cbiAgICB9XG4gICAgZGVsZXRlIGtleW1hcFtrZXluYW1lXTtcbiAgfSB9XG4gIGZvciAodmFyIHByb3AgaW4gY29weSkgeyBrZXltYXBbcHJvcF0gPSBjb3B5W3Byb3BdOyB9XG4gIHJldHVybiBrZXltYXBcbn1cblxuZnVuY3Rpb24gbG9va3VwS2V5KGtleSwgbWFwJCQxLCBoYW5kbGUsIGNvbnRleHQpIHtcbiAgbWFwJCQxID0gZ2V0S2V5TWFwKG1hcCQkMSk7XG4gIHZhciBmb3VuZCA9IG1hcCQkMS5jYWxsID8gbWFwJCQxLmNhbGwoa2V5LCBjb250ZXh0KSA6IG1hcCQkMVtrZXldO1xuICBpZiAoZm91bmQgPT09IGZhbHNlKSB7IHJldHVybiBcIm5vdGhpbmdcIiB9XG4gIGlmIChmb3VuZCA9PT0gXCIuLi5cIikgeyByZXR1cm4gXCJtdWx0aVwiIH1cbiAgaWYgKGZvdW5kICE9IG51bGwgJiYgaGFuZGxlKGZvdW5kKSkgeyByZXR1cm4gXCJoYW5kbGVkXCIgfVxuXG4gIGlmIChtYXAkJDEuZmFsbHRocm91Z2gpIHtcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG1hcCQkMS5mYWxsdGhyb3VnaCkgIT0gXCJbb2JqZWN0IEFycmF5XVwiKVxuICAgICAgeyByZXR1cm4gbG9va3VwS2V5KGtleSwgbWFwJCQxLmZhbGx0aHJvdWdoLCBoYW5kbGUsIGNvbnRleHQpIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1hcCQkMS5mYWxsdGhyb3VnaC5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHJlc3VsdCA9IGxvb2t1cEtleShrZXksIG1hcCQkMS5mYWxsdGhyb3VnaFtpXSwgaGFuZGxlLCBjb250ZXh0KTtcbiAgICAgIGlmIChyZXN1bHQpIHsgcmV0dXJuIHJlc3VsdCB9XG4gICAgfVxuICB9XG59XG5cbi8vIE1vZGlmaWVyIGtleSBwcmVzc2VzIGRvbid0IGNvdW50IGFzICdyZWFsJyBrZXkgcHJlc3NlcyBmb3IgdGhlXG4vLyBwdXJwb3NlIG9mIGtleW1hcCBmYWxsdGhyb3VnaC5cbmZ1bmN0aW9uIGlzTW9kaWZpZXJLZXkodmFsdWUpIHtcbiAgdmFyIG5hbWUgPSB0eXBlb2YgdmFsdWUgPT0gXCJzdHJpbmdcIiA/IHZhbHVlIDoga2V5TmFtZXNbdmFsdWUua2V5Q29kZV07XG4gIHJldHVybiBuYW1lID09IFwiQ3RybFwiIHx8IG5hbWUgPT0gXCJBbHRcIiB8fCBuYW1lID09IFwiU2hpZnRcIiB8fCBuYW1lID09IFwiTW9kXCJcbn1cblxuZnVuY3Rpb24gYWRkTW9kaWZpZXJOYW1lcyhuYW1lLCBldmVudCwgbm9TaGlmdCkge1xuICB2YXIgYmFzZSA9IG5hbWU7XG4gIGlmIChldmVudC5hbHRLZXkgJiYgYmFzZSAhPSBcIkFsdFwiKSB7IG5hbWUgPSBcIkFsdC1cIiArIG5hbWU7IH1cbiAgaWYgKChmbGlwQ3RybENtZCA/IGV2ZW50Lm1ldGFLZXkgOiBldmVudC5jdHJsS2V5KSAmJiBiYXNlICE9IFwiQ3RybFwiKSB7IG5hbWUgPSBcIkN0cmwtXCIgKyBuYW1lOyB9XG4gIGlmICgoZmxpcEN0cmxDbWQgPyBldmVudC5jdHJsS2V5IDogZXZlbnQubWV0YUtleSkgJiYgYmFzZSAhPSBcIkNtZFwiKSB7IG5hbWUgPSBcIkNtZC1cIiArIG5hbWU7IH1cbiAgaWYgKCFub1NoaWZ0ICYmIGV2ZW50LnNoaWZ0S2V5ICYmIGJhc2UgIT0gXCJTaGlmdFwiKSB7IG5hbWUgPSBcIlNoaWZ0LVwiICsgbmFtZTsgfVxuICByZXR1cm4gbmFtZVxufVxuXG4vLyBMb29rIHVwIHRoZSBuYW1lIG9mIGEga2V5IGFzIGluZGljYXRlZCBieSBhbiBldmVudCBvYmplY3QuXG5mdW5jdGlvbiBrZXlOYW1lKGV2ZW50LCBub1NoaWZ0KSB7XG4gIGlmIChwcmVzdG8gJiYgZXZlbnQua2V5Q29kZSA9PSAzNCAmJiBldmVudFtcImNoYXJcIl0pIHsgcmV0dXJuIGZhbHNlIH1cbiAgdmFyIG5hbWUgPSBrZXlOYW1lc1tldmVudC5rZXlDb2RlXTtcbiAgaWYgKG5hbWUgPT0gbnVsbCB8fCBldmVudC5hbHRHcmFwaEtleSkgeyByZXR1cm4gZmFsc2UgfVxuICAvLyBDdHJsLVNjcm9sbExvY2sgaGFzIGtleUNvZGUgMywgc2FtZSBhcyBDdHJsLVBhdXNlLFxuICAvLyBzbyB3ZSdsbCB1c2UgZXZlbnQuY29kZSB3aGVuIGF2YWlsYWJsZSAoQ2hyb21lIDQ4KywgRkYgMzgrLCBTYWZhcmkgMTAuMSspXG4gIGlmIChldmVudC5rZXlDb2RlID09IDMgJiYgZXZlbnQuY29kZSkgeyBuYW1lID0gZXZlbnQuY29kZTsgfVxuICByZXR1cm4gYWRkTW9kaWZpZXJOYW1lcyhuYW1lLCBldmVudCwgbm9TaGlmdClcbn1cblxuZnVuY3Rpb24gZ2V0S2V5TWFwKHZhbCkge1xuICByZXR1cm4gdHlwZW9mIHZhbCA9PSBcInN0cmluZ1wiID8ga2V5TWFwW3ZhbF0gOiB2YWxcbn1cblxuLy8gSGVscGVyIGZvciBkZWxldGluZyB0ZXh0IG5lYXIgdGhlIHNlbGVjdGlvbihzKSwgdXNlZCB0byBpbXBsZW1lbnRcbi8vIGJhY2tzcGFjZSwgZGVsZXRlLCBhbmQgc2ltaWxhciBmdW5jdGlvbmFsaXR5LlxuZnVuY3Rpb24gZGVsZXRlTmVhclNlbGVjdGlvbihjbSwgY29tcHV0ZSkge1xuICB2YXIgcmFuZ2VzID0gY20uZG9jLnNlbC5yYW5nZXMsIGtpbGwgPSBbXTtcbiAgLy8gQnVpbGQgdXAgYSBzZXQgb2YgcmFuZ2VzIHRvIGtpbGwgZmlyc3QsIG1lcmdpbmcgb3ZlcmxhcHBpbmdcbiAgLy8gcmFuZ2VzLlxuICBmb3IgKHZhciBpID0gMDsgaSA8IHJhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciB0b0tpbGwgPSBjb21wdXRlKHJhbmdlc1tpXSk7XG4gICAgd2hpbGUgKGtpbGwubGVuZ3RoICYmIGNtcCh0b0tpbGwuZnJvbSwgbHN0KGtpbGwpLnRvKSA8PSAwKSB7XG4gICAgICB2YXIgcmVwbGFjZWQgPSBraWxsLnBvcCgpO1xuICAgICAgaWYgKGNtcChyZXBsYWNlZC5mcm9tLCB0b0tpbGwuZnJvbSkgPCAwKSB7XG4gICAgICAgIHRvS2lsbC5mcm9tID0gcmVwbGFjZWQuZnJvbTtcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG4gICAga2lsbC5wdXNoKHRvS2lsbCk7XG4gIH1cbiAgLy8gTmV4dCwgcmVtb3ZlIHRob3NlIGFjdHVhbCByYW5nZXMuXG4gIHJ1bkluT3AoY20sIGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKHZhciBpID0ga2lsbC5sZW5ndGggLSAxOyBpID49IDA7IGktLSlcbiAgICAgIHsgcmVwbGFjZVJhbmdlKGNtLmRvYywgXCJcIiwga2lsbFtpXS5mcm9tLCBraWxsW2ldLnRvLCBcIitkZWxldGVcIik7IH1cbiAgICBlbnN1cmVDdXJzb3JWaXNpYmxlKGNtKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIG1vdmVDaGFyTG9naWNhbGx5KGxpbmUsIGNoLCBkaXIpIHtcbiAgdmFyIHRhcmdldCA9IHNraXBFeHRlbmRpbmdDaGFycyhsaW5lLnRleHQsIGNoICsgZGlyLCBkaXIpO1xuICByZXR1cm4gdGFyZ2V0IDwgMCB8fCB0YXJnZXQgPiBsaW5lLnRleHQubGVuZ3RoID8gbnVsbCA6IHRhcmdldFxufVxuXG5mdW5jdGlvbiBtb3ZlTG9naWNhbGx5KGxpbmUsIHN0YXJ0LCBkaXIpIHtcbiAgdmFyIGNoID0gbW92ZUNoYXJMb2dpY2FsbHkobGluZSwgc3RhcnQuY2gsIGRpcik7XG4gIHJldHVybiBjaCA9PSBudWxsID8gbnVsbCA6IG5ldyBQb3Moc3RhcnQubGluZSwgY2gsIGRpciA8IDAgPyBcImFmdGVyXCIgOiBcImJlZm9yZVwiKVxufVxuXG5mdW5jdGlvbiBlbmRPZkxpbmUodmlzdWFsbHksIGNtLCBsaW5lT2JqLCBsaW5lTm8sIGRpcikge1xuICBpZiAodmlzdWFsbHkpIHtcbiAgICB2YXIgb3JkZXIgPSBnZXRPcmRlcihsaW5lT2JqLCBjbS5kb2MuZGlyZWN0aW9uKTtcbiAgICBpZiAob3JkZXIpIHtcbiAgICAgIHZhciBwYXJ0ID0gZGlyIDwgMCA/IGxzdChvcmRlcikgOiBvcmRlclswXTtcbiAgICAgIHZhciBtb3ZlSW5TdG9yYWdlT3JkZXIgPSAoZGlyIDwgMCkgPT0gKHBhcnQubGV2ZWwgPT0gMSk7XG4gICAgICB2YXIgc3RpY2t5ID0gbW92ZUluU3RvcmFnZU9yZGVyID8gXCJhZnRlclwiIDogXCJiZWZvcmVcIjtcbiAgICAgIHZhciBjaDtcbiAgICAgIC8vIFdpdGggYSB3cmFwcGVkIHJ0bCBjaHVuayAocG9zc2libHkgc3Bhbm5pbmcgbXVsdGlwbGUgYmlkaSBwYXJ0cyksXG4gICAgICAvLyBpdCBjb3VsZCBiZSB0aGF0IHRoZSBsYXN0IGJpZGkgcGFydCBpcyBub3Qgb24gdGhlIGxhc3QgdmlzdWFsIGxpbmUsXG4gICAgICAvLyBzaW5jZSB2aXN1YWwgbGluZXMgY29udGFpbiBjb250ZW50IG9yZGVyLWNvbnNlY3V0aXZlIGNodW5rcy5cbiAgICAgIC8vIFRodXMsIGluIHJ0bCwgd2UgYXJlIGxvb2tpbmcgZm9yIHRoZSBmaXJzdCAoY29udGVudC1vcmRlcikgY2hhcmFjdGVyXG4gICAgICAvLyBpbiB0aGUgcnRsIGNodW5rIHRoYXQgaXMgb24gdGhlIGxhc3QgbGluZSAodGhhdCBpcywgdGhlIHNhbWUgbGluZVxuICAgICAgLy8gYXMgdGhlIGxhc3QgKGNvbnRlbnQtb3JkZXIpIGNoYXJhY3RlcikuXG4gICAgICBpZiAocGFydC5sZXZlbCA+IDAgfHwgY20uZG9jLmRpcmVjdGlvbiA9PSBcInJ0bFwiKSB7XG4gICAgICAgIHZhciBwcmVwID0gcHJlcGFyZU1lYXN1cmVGb3JMaW5lKGNtLCBsaW5lT2JqKTtcbiAgICAgICAgY2ggPSBkaXIgPCAwID8gbGluZU9iai50ZXh0Lmxlbmd0aCAtIDEgOiAwO1xuICAgICAgICB2YXIgdGFyZ2V0VG9wID0gbWVhc3VyZUNoYXJQcmVwYXJlZChjbSwgcHJlcCwgY2gpLnRvcDtcbiAgICAgICAgY2ggPSBmaW5kRmlyc3QoZnVuY3Rpb24gKGNoKSB7IHJldHVybiBtZWFzdXJlQ2hhclByZXBhcmVkKGNtLCBwcmVwLCBjaCkudG9wID09IHRhcmdldFRvcDsgfSwgKGRpciA8IDApID09IChwYXJ0LmxldmVsID09IDEpID8gcGFydC5mcm9tIDogcGFydC50byAtIDEsIGNoKTtcbiAgICAgICAgaWYgKHN0aWNreSA9PSBcImJlZm9yZVwiKSB7IGNoID0gbW92ZUNoYXJMb2dpY2FsbHkobGluZU9iaiwgY2gsIDEpOyB9XG4gICAgICB9IGVsc2UgeyBjaCA9IGRpciA8IDAgPyBwYXJ0LnRvIDogcGFydC5mcm9tOyB9XG4gICAgICByZXR1cm4gbmV3IFBvcyhsaW5lTm8sIGNoLCBzdGlja3kpXG4gICAgfVxuICB9XG4gIHJldHVybiBuZXcgUG9zKGxpbmVObywgZGlyIDwgMCA/IGxpbmVPYmoudGV4dC5sZW5ndGggOiAwLCBkaXIgPCAwID8gXCJiZWZvcmVcIiA6IFwiYWZ0ZXJcIilcbn1cblxuZnVuY3Rpb24gbW92ZVZpc3VhbGx5KGNtLCBsaW5lLCBzdGFydCwgZGlyKSB7XG4gIHZhciBiaWRpID0gZ2V0T3JkZXIobGluZSwgY20uZG9jLmRpcmVjdGlvbik7XG4gIGlmICghYmlkaSkgeyByZXR1cm4gbW92ZUxvZ2ljYWxseShsaW5lLCBzdGFydCwgZGlyKSB9XG4gIGlmIChzdGFydC5jaCA+PSBsaW5lLnRleHQubGVuZ3RoKSB7XG4gICAgc3RhcnQuY2ggPSBsaW5lLnRleHQubGVuZ3RoO1xuICAgIHN0YXJ0LnN0aWNreSA9IFwiYmVmb3JlXCI7XG4gIH0gZWxzZSBpZiAoc3RhcnQuY2ggPD0gMCkge1xuICAgIHN0YXJ0LmNoID0gMDtcbiAgICBzdGFydC5zdGlja3kgPSBcImFmdGVyXCI7XG4gIH1cbiAgdmFyIHBhcnRQb3MgPSBnZXRCaWRpUGFydEF0KGJpZGksIHN0YXJ0LmNoLCBzdGFydC5zdGlja3kpLCBwYXJ0ID0gYmlkaVtwYXJ0UG9zXTtcbiAgaWYgKGNtLmRvYy5kaXJlY3Rpb24gPT0gXCJsdHJcIiAmJiBwYXJ0LmxldmVsICUgMiA9PSAwICYmIChkaXIgPiAwID8gcGFydC50byA+IHN0YXJ0LmNoIDogcGFydC5mcm9tIDwgc3RhcnQuY2gpKSB7XG4gICAgLy8gQ2FzZSAxOiBXZSBtb3ZlIHdpdGhpbiBhbiBsdHIgcGFydCBpbiBhbiBsdHIgZWRpdG9yLiBFdmVuIHdpdGggd3JhcHBlZCBsaW5lcyxcbiAgICAvLyBub3RoaW5nIGludGVyZXN0aW5nIGhhcHBlbnMuXG4gICAgcmV0dXJuIG1vdmVMb2dpY2FsbHkobGluZSwgc3RhcnQsIGRpcilcbiAgfVxuXG4gIHZhciBtdiA9IGZ1bmN0aW9uIChwb3MsIGRpcikgeyByZXR1cm4gbW92ZUNoYXJMb2dpY2FsbHkobGluZSwgcG9zIGluc3RhbmNlb2YgUG9zID8gcG9zLmNoIDogcG9zLCBkaXIpOyB9O1xuICB2YXIgcHJlcDtcbiAgdmFyIGdldFdyYXBwZWRMaW5lRXh0ZW50ID0gZnVuY3Rpb24gKGNoKSB7XG4gICAgaWYgKCFjbS5vcHRpb25zLmxpbmVXcmFwcGluZykgeyByZXR1cm4ge2JlZ2luOiAwLCBlbmQ6IGxpbmUudGV4dC5sZW5ndGh9IH1cbiAgICBwcmVwID0gcHJlcCB8fCBwcmVwYXJlTWVhc3VyZUZvckxpbmUoY20sIGxpbmUpO1xuICAgIHJldHVybiB3cmFwcGVkTGluZUV4dGVudENoYXIoY20sIGxpbmUsIHByZXAsIGNoKVxuICB9O1xuICB2YXIgd3JhcHBlZExpbmVFeHRlbnQgPSBnZXRXcmFwcGVkTGluZUV4dGVudChzdGFydC5zdGlja3kgPT0gXCJiZWZvcmVcIiA/IG12KHN0YXJ0LCAtMSkgOiBzdGFydC5jaCk7XG5cbiAgaWYgKGNtLmRvYy5kaXJlY3Rpb24gPT0gXCJydGxcIiB8fCBwYXJ0LmxldmVsID09IDEpIHtcbiAgICB2YXIgbW92ZUluU3RvcmFnZU9yZGVyID0gKHBhcnQubGV2ZWwgPT0gMSkgPT0gKGRpciA8IDApO1xuICAgIHZhciBjaCA9IG12KHN0YXJ0LCBtb3ZlSW5TdG9yYWdlT3JkZXIgPyAxIDogLTEpO1xuICAgIGlmIChjaCAhPSBudWxsICYmICghbW92ZUluU3RvcmFnZU9yZGVyID8gY2ggPj0gcGFydC5mcm9tICYmIGNoID49IHdyYXBwZWRMaW5lRXh0ZW50LmJlZ2luIDogY2ggPD0gcGFydC50byAmJiBjaCA8PSB3cmFwcGVkTGluZUV4dGVudC5lbmQpKSB7XG4gICAgICAvLyBDYXNlIDI6IFdlIG1vdmUgd2l0aGluIGFuIHJ0bCBwYXJ0IG9yIGluIGFuIHJ0bCBlZGl0b3Igb24gdGhlIHNhbWUgdmlzdWFsIGxpbmVcbiAgICAgIHZhciBzdGlja3kgPSBtb3ZlSW5TdG9yYWdlT3JkZXIgPyBcImJlZm9yZVwiIDogXCJhZnRlclwiO1xuICAgICAgcmV0dXJuIG5ldyBQb3Moc3RhcnQubGluZSwgY2gsIHN0aWNreSlcbiAgICB9XG4gIH1cblxuICAvLyBDYXNlIDM6IENvdWxkIG5vdCBtb3ZlIHdpdGhpbiB0aGlzIGJpZGkgcGFydCBpbiB0aGlzIHZpc3VhbCBsaW5lLCBzbyBsZWF2ZVxuICAvLyB0aGUgY3VycmVudCBiaWRpIHBhcnRcblxuICB2YXIgc2VhcmNoSW5WaXN1YWxMaW5lID0gZnVuY3Rpb24gKHBhcnRQb3MsIGRpciwgd3JhcHBlZExpbmVFeHRlbnQpIHtcbiAgICB2YXIgZ2V0UmVzID0gZnVuY3Rpb24gKGNoLCBtb3ZlSW5TdG9yYWdlT3JkZXIpIHsgcmV0dXJuIG1vdmVJblN0b3JhZ2VPcmRlclxuICAgICAgPyBuZXcgUG9zKHN0YXJ0LmxpbmUsIG12KGNoLCAxKSwgXCJiZWZvcmVcIilcbiAgICAgIDogbmV3IFBvcyhzdGFydC5saW5lLCBjaCwgXCJhZnRlclwiKTsgfTtcblxuICAgIGZvciAoOyBwYXJ0UG9zID49IDAgJiYgcGFydFBvcyA8IGJpZGkubGVuZ3RoOyBwYXJ0UG9zICs9IGRpcikge1xuICAgICAgdmFyIHBhcnQgPSBiaWRpW3BhcnRQb3NdO1xuICAgICAgdmFyIG1vdmVJblN0b3JhZ2VPcmRlciA9IChkaXIgPiAwKSA9PSAocGFydC5sZXZlbCAhPSAxKTtcbiAgICAgIHZhciBjaCA9IG1vdmVJblN0b3JhZ2VPcmRlciA/IHdyYXBwZWRMaW5lRXh0ZW50LmJlZ2luIDogbXYod3JhcHBlZExpbmVFeHRlbnQuZW5kLCAtMSk7XG4gICAgICBpZiAocGFydC5mcm9tIDw9IGNoICYmIGNoIDwgcGFydC50bykgeyByZXR1cm4gZ2V0UmVzKGNoLCBtb3ZlSW5TdG9yYWdlT3JkZXIpIH1cbiAgICAgIGNoID0gbW92ZUluU3RvcmFnZU9yZGVyID8gcGFydC5mcm9tIDogbXYocGFydC50bywgLTEpO1xuICAgICAgaWYgKHdyYXBwZWRMaW5lRXh0ZW50LmJlZ2luIDw9IGNoICYmIGNoIDwgd3JhcHBlZExpbmVFeHRlbnQuZW5kKSB7IHJldHVybiBnZXRSZXMoY2gsIG1vdmVJblN0b3JhZ2VPcmRlcikgfVxuICAgIH1cbiAgfTtcblxuICAvLyBDYXNlIDNhOiBMb29rIGZvciBvdGhlciBiaWRpIHBhcnRzIG9uIHRoZSBzYW1lIHZpc3VhbCBsaW5lXG4gIHZhciByZXMgPSBzZWFyY2hJblZpc3VhbExpbmUocGFydFBvcyArIGRpciwgZGlyLCB3cmFwcGVkTGluZUV4dGVudCk7XG4gIGlmIChyZXMpIHsgcmV0dXJuIHJlcyB9XG5cbiAgLy8gQ2FzZSAzYjogTG9vayBmb3Igb3RoZXIgYmlkaSBwYXJ0cyBvbiB0aGUgbmV4dCB2aXN1YWwgbGluZVxuICB2YXIgbmV4dENoID0gZGlyID4gMCA/IHdyYXBwZWRMaW5lRXh0ZW50LmVuZCA6IG12KHdyYXBwZWRMaW5lRXh0ZW50LmJlZ2luLCAtMSk7XG4gIGlmIChuZXh0Q2ggIT0gbnVsbCAmJiAhKGRpciA+IDAgJiYgbmV4dENoID09IGxpbmUudGV4dC5sZW5ndGgpKSB7XG4gICAgcmVzID0gc2VhcmNoSW5WaXN1YWxMaW5lKGRpciA+IDAgPyAwIDogYmlkaS5sZW5ndGggLSAxLCBkaXIsIGdldFdyYXBwZWRMaW5lRXh0ZW50KG5leHRDaCkpO1xuICAgIGlmIChyZXMpIHsgcmV0dXJuIHJlcyB9XG4gIH1cblxuICAvLyBDYXNlIDQ6IE5vd2hlcmUgdG8gbW92ZVxuICByZXR1cm4gbnVsbFxufVxuXG4vLyBDb21tYW5kcyBhcmUgcGFyYW1ldGVyLWxlc3MgYWN0aW9ucyB0aGF0IGNhbiBiZSBwZXJmb3JtZWQgb24gYW5cbi8vIGVkaXRvciwgbW9zdGx5IHVzZWQgZm9yIGtleWJpbmRpbmdzLlxudmFyIGNvbW1hbmRzID0ge1xuICBzZWxlY3RBbGw6IHNlbGVjdEFsbCxcbiAgc2luZ2xlU2VsZWN0aW9uOiBmdW5jdGlvbiAoY20pIHsgcmV0dXJuIGNtLnNldFNlbGVjdGlvbihjbS5nZXRDdXJzb3IoXCJhbmNob3JcIiksIGNtLmdldEN1cnNvcihcImhlYWRcIiksIHNlbF9kb250U2Nyb2xsKTsgfSxcbiAga2lsbExpbmU6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gZGVsZXRlTmVhclNlbGVjdGlvbihjbSwgZnVuY3Rpb24gKHJhbmdlKSB7XG4gICAgaWYgKHJhbmdlLmVtcHR5KCkpIHtcbiAgICAgIHZhciBsZW4gPSBnZXRMaW5lKGNtLmRvYywgcmFuZ2UuaGVhZC5saW5lKS50ZXh0Lmxlbmd0aDtcbiAgICAgIGlmIChyYW5nZS5oZWFkLmNoID09IGxlbiAmJiByYW5nZS5oZWFkLmxpbmUgPCBjbS5sYXN0TGluZSgpKVxuICAgICAgICB7IHJldHVybiB7ZnJvbTogcmFuZ2UuaGVhZCwgdG86IFBvcyhyYW5nZS5oZWFkLmxpbmUgKyAxLCAwKX0gfVxuICAgICAgZWxzZVxuICAgICAgICB7IHJldHVybiB7ZnJvbTogcmFuZ2UuaGVhZCwgdG86IFBvcyhyYW5nZS5oZWFkLmxpbmUsIGxlbil9IH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtmcm9tOiByYW5nZS5mcm9tKCksIHRvOiByYW5nZS50bygpfVxuICAgIH1cbiAgfSk7IH0sXG4gIGRlbGV0ZUxpbmU6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gZGVsZXRlTmVhclNlbGVjdGlvbihjbSwgZnVuY3Rpb24gKHJhbmdlKSB7IHJldHVybiAoe1xuICAgIGZyb206IFBvcyhyYW5nZS5mcm9tKCkubGluZSwgMCksXG4gICAgdG86IGNsaXBQb3MoY20uZG9jLCBQb3MocmFuZ2UudG8oKS5saW5lICsgMSwgMCkpXG4gIH0pOyB9KTsgfSxcbiAgZGVsTGluZUxlZnQ6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gZGVsZXRlTmVhclNlbGVjdGlvbihjbSwgZnVuY3Rpb24gKHJhbmdlKSB7IHJldHVybiAoe1xuICAgIGZyb206IFBvcyhyYW5nZS5mcm9tKCkubGluZSwgMCksIHRvOiByYW5nZS5mcm9tKClcbiAgfSk7IH0pOyB9LFxuICBkZWxXcmFwcGVkTGluZUxlZnQ6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gZGVsZXRlTmVhclNlbGVjdGlvbihjbSwgZnVuY3Rpb24gKHJhbmdlKSB7XG4gICAgdmFyIHRvcCA9IGNtLmNoYXJDb29yZHMocmFuZ2UuaGVhZCwgXCJkaXZcIikudG9wICsgNTtcbiAgICB2YXIgbGVmdFBvcyA9IGNtLmNvb3Jkc0NoYXIoe2xlZnQ6IDAsIHRvcDogdG9wfSwgXCJkaXZcIik7XG4gICAgcmV0dXJuIHtmcm9tOiBsZWZ0UG9zLCB0bzogcmFuZ2UuZnJvbSgpfVxuICB9KTsgfSxcbiAgZGVsV3JhcHBlZExpbmVSaWdodDogZnVuY3Rpb24gKGNtKSB7IHJldHVybiBkZWxldGVOZWFyU2VsZWN0aW9uKGNtLCBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgICB2YXIgdG9wID0gY20uY2hhckNvb3JkcyhyYW5nZS5oZWFkLCBcImRpdlwiKS50b3AgKyA1O1xuICAgIHZhciByaWdodFBvcyA9IGNtLmNvb3Jkc0NoYXIoe2xlZnQ6IGNtLmRpc3BsYXkubGluZURpdi5vZmZzZXRXaWR0aCArIDEwMCwgdG9wOiB0b3B9LCBcImRpdlwiKTtcbiAgICByZXR1cm4ge2Zyb206IHJhbmdlLmZyb20oKSwgdG86IHJpZ2h0UG9zIH1cbiAgfSk7IH0sXG4gIHVuZG86IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20udW5kbygpOyB9LFxuICByZWRvOiBmdW5jdGlvbiAoY20pIHsgcmV0dXJuIGNtLnJlZG8oKTsgfSxcbiAgdW5kb1NlbGVjdGlvbjogZnVuY3Rpb24gKGNtKSB7IHJldHVybiBjbS51bmRvU2VsZWN0aW9uKCk7IH0sXG4gIHJlZG9TZWxlY3Rpb246IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20ucmVkb1NlbGVjdGlvbigpOyB9LFxuICBnb0RvY1N0YXJ0OiBmdW5jdGlvbiAoY20pIHsgcmV0dXJuIGNtLmV4dGVuZFNlbGVjdGlvbihQb3MoY20uZmlyc3RMaW5lKCksIDApKTsgfSxcbiAgZ29Eb2NFbmQ6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20uZXh0ZW5kU2VsZWN0aW9uKFBvcyhjbS5sYXN0TGluZSgpKSk7IH0sXG4gIGdvTGluZVN0YXJ0OiBmdW5jdGlvbiAoY20pIHsgcmV0dXJuIGNtLmV4dGVuZFNlbGVjdGlvbnNCeShmdW5jdGlvbiAocmFuZ2UpIHsgcmV0dXJuIGxpbmVTdGFydChjbSwgcmFuZ2UuaGVhZC5saW5lKTsgfSxcbiAgICB7b3JpZ2luOiBcIittb3ZlXCIsIGJpYXM6IDF9XG4gICk7IH0sXG4gIGdvTGluZVN0YXJ0U21hcnQ6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20uZXh0ZW5kU2VsZWN0aW9uc0J5KGZ1bmN0aW9uIChyYW5nZSkgeyByZXR1cm4gbGluZVN0YXJ0U21hcnQoY20sIHJhbmdlLmhlYWQpOyB9LFxuICAgIHtvcmlnaW46IFwiK21vdmVcIiwgYmlhczogMX1cbiAgKTsgfSxcbiAgZ29MaW5lRW5kOiBmdW5jdGlvbiAoY20pIHsgcmV0dXJuIGNtLmV4dGVuZFNlbGVjdGlvbnNCeShmdW5jdGlvbiAocmFuZ2UpIHsgcmV0dXJuIGxpbmVFbmQoY20sIHJhbmdlLmhlYWQubGluZSk7IH0sXG4gICAge29yaWdpbjogXCIrbW92ZVwiLCBiaWFzOiAtMX1cbiAgKTsgfSxcbiAgZ29MaW5lUmlnaHQ6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20uZXh0ZW5kU2VsZWN0aW9uc0J5KGZ1bmN0aW9uIChyYW5nZSkge1xuICAgIHZhciB0b3AgPSBjbS5jdXJzb3JDb29yZHMocmFuZ2UuaGVhZCwgXCJkaXZcIikudG9wICsgNTtcbiAgICByZXR1cm4gY20uY29vcmRzQ2hhcih7bGVmdDogY20uZGlzcGxheS5saW5lRGl2Lm9mZnNldFdpZHRoICsgMTAwLCB0b3A6IHRvcH0sIFwiZGl2XCIpXG4gIH0sIHNlbF9tb3ZlKTsgfSxcbiAgZ29MaW5lTGVmdDogZnVuY3Rpb24gKGNtKSB7IHJldHVybiBjbS5leHRlbmRTZWxlY3Rpb25zQnkoZnVuY3Rpb24gKHJhbmdlKSB7XG4gICAgdmFyIHRvcCA9IGNtLmN1cnNvckNvb3JkcyhyYW5nZS5oZWFkLCBcImRpdlwiKS50b3AgKyA1O1xuICAgIHJldHVybiBjbS5jb29yZHNDaGFyKHtsZWZ0OiAwLCB0b3A6IHRvcH0sIFwiZGl2XCIpXG4gIH0sIHNlbF9tb3ZlKTsgfSxcbiAgZ29MaW5lTGVmdFNtYXJ0OiBmdW5jdGlvbiAoY20pIHsgcmV0dXJuIGNtLmV4dGVuZFNlbGVjdGlvbnNCeShmdW5jdGlvbiAocmFuZ2UpIHtcbiAgICB2YXIgdG9wID0gY20uY3Vyc29yQ29vcmRzKHJhbmdlLmhlYWQsIFwiZGl2XCIpLnRvcCArIDU7XG4gICAgdmFyIHBvcyA9IGNtLmNvb3Jkc0NoYXIoe2xlZnQ6IDAsIHRvcDogdG9wfSwgXCJkaXZcIik7XG4gICAgaWYgKHBvcy5jaCA8IGNtLmdldExpbmUocG9zLmxpbmUpLnNlYXJjaCgvXFxTLykpIHsgcmV0dXJuIGxpbmVTdGFydFNtYXJ0KGNtLCByYW5nZS5oZWFkKSB9XG4gICAgcmV0dXJuIHBvc1xuICB9LCBzZWxfbW92ZSk7IH0sXG4gIGdvTGluZVVwOiBmdW5jdGlvbiAoY20pIHsgcmV0dXJuIGNtLm1vdmVWKC0xLCBcImxpbmVcIik7IH0sXG4gIGdvTGluZURvd246IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20ubW92ZVYoMSwgXCJsaW5lXCIpOyB9LFxuICBnb1BhZ2VVcDogZnVuY3Rpb24gKGNtKSB7IHJldHVybiBjbS5tb3ZlVigtMSwgXCJwYWdlXCIpOyB9LFxuICBnb1BhZ2VEb3duOiBmdW5jdGlvbiAoY20pIHsgcmV0dXJuIGNtLm1vdmVWKDEsIFwicGFnZVwiKTsgfSxcbiAgZ29DaGFyTGVmdDogZnVuY3Rpb24gKGNtKSB7IHJldHVybiBjbS5tb3ZlSCgtMSwgXCJjaGFyXCIpOyB9LFxuICBnb0NoYXJSaWdodDogZnVuY3Rpb24gKGNtKSB7IHJldHVybiBjbS5tb3ZlSCgxLCBcImNoYXJcIik7IH0sXG4gIGdvQ29sdW1uTGVmdDogZnVuY3Rpb24gKGNtKSB7IHJldHVybiBjbS5tb3ZlSCgtMSwgXCJjb2x1bW5cIik7IH0sXG4gIGdvQ29sdW1uUmlnaHQ6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20ubW92ZUgoMSwgXCJjb2x1bW5cIik7IH0sXG4gIGdvV29yZExlZnQ6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20ubW92ZUgoLTEsIFwid29yZFwiKTsgfSxcbiAgZ29Hcm91cFJpZ2h0OiBmdW5jdGlvbiAoY20pIHsgcmV0dXJuIGNtLm1vdmVIKDEsIFwiZ3JvdXBcIik7IH0sXG4gIGdvR3JvdXBMZWZ0OiBmdW5jdGlvbiAoY20pIHsgcmV0dXJuIGNtLm1vdmVIKC0xLCBcImdyb3VwXCIpOyB9LFxuICBnb1dvcmRSaWdodDogZnVuY3Rpb24gKGNtKSB7IHJldHVybiBjbS5tb3ZlSCgxLCBcIndvcmRcIik7IH0sXG4gIGRlbENoYXJCZWZvcmU6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20uZGVsZXRlSCgtMSwgXCJjaGFyXCIpOyB9LFxuICBkZWxDaGFyQWZ0ZXI6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20uZGVsZXRlSCgxLCBcImNoYXJcIik7IH0sXG4gIGRlbFdvcmRCZWZvcmU6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20uZGVsZXRlSCgtMSwgXCJ3b3JkXCIpOyB9LFxuICBkZWxXb3JkQWZ0ZXI6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20uZGVsZXRlSCgxLCBcIndvcmRcIik7IH0sXG4gIGRlbEdyb3VwQmVmb3JlOiBmdW5jdGlvbiAoY20pIHsgcmV0dXJuIGNtLmRlbGV0ZUgoLTEsIFwiZ3JvdXBcIik7IH0sXG4gIGRlbEdyb3VwQWZ0ZXI6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20uZGVsZXRlSCgxLCBcImdyb3VwXCIpOyB9LFxuICBpbmRlbnRBdXRvOiBmdW5jdGlvbiAoY20pIHsgcmV0dXJuIGNtLmluZGVudFNlbGVjdGlvbihcInNtYXJ0XCIpOyB9LFxuICBpbmRlbnRNb3JlOiBmdW5jdGlvbiAoY20pIHsgcmV0dXJuIGNtLmluZGVudFNlbGVjdGlvbihcImFkZFwiKTsgfSxcbiAgaW5kZW50TGVzczogZnVuY3Rpb24gKGNtKSB7IHJldHVybiBjbS5pbmRlbnRTZWxlY3Rpb24oXCJzdWJ0cmFjdFwiKTsgfSxcbiAgaW5zZXJ0VGFiOiBmdW5jdGlvbiAoY20pIHsgcmV0dXJuIGNtLnJlcGxhY2VTZWxlY3Rpb24oXCJcXHRcIik7IH0sXG4gIGluc2VydFNvZnRUYWI6IGZ1bmN0aW9uIChjbSkge1xuICAgIHZhciBzcGFjZXMgPSBbXSwgcmFuZ2VzID0gY20ubGlzdFNlbGVjdGlvbnMoKSwgdGFiU2l6ZSA9IGNtLm9wdGlvbnMudGFiU2l6ZTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHBvcyA9IHJhbmdlc1tpXS5mcm9tKCk7XG4gICAgICB2YXIgY29sID0gY291bnRDb2x1bW4oY20uZ2V0TGluZShwb3MubGluZSksIHBvcy5jaCwgdGFiU2l6ZSk7XG4gICAgICBzcGFjZXMucHVzaChzcGFjZVN0cih0YWJTaXplIC0gY29sICUgdGFiU2l6ZSkpO1xuICAgIH1cbiAgICBjbS5yZXBsYWNlU2VsZWN0aW9ucyhzcGFjZXMpO1xuICB9LFxuICBkZWZhdWx0VGFiOiBmdW5jdGlvbiAoY20pIHtcbiAgICBpZiAoY20uc29tZXRoaW5nU2VsZWN0ZWQoKSkgeyBjbS5pbmRlbnRTZWxlY3Rpb24oXCJhZGRcIik7IH1cbiAgICBlbHNlIHsgY20uZXhlY0NvbW1hbmQoXCJpbnNlcnRUYWJcIik7IH1cbiAgfSxcbiAgLy8gU3dhcCB0aGUgdHdvIGNoYXJzIGxlZnQgYW5kIHJpZ2h0IG9mIGVhY2ggc2VsZWN0aW9uJ3MgaGVhZC5cbiAgLy8gTW92ZSBjdXJzb3IgYmVoaW5kIHRoZSB0d28gc3dhcHBlZCBjaGFyYWN0ZXJzIGFmdGVyd2FyZHMuXG4gIC8vXG4gIC8vIERvZXNuJ3QgY29uc2lkZXIgbGluZSBmZWVkcyBhIGNoYXJhY3Rlci5cbiAgLy8gRG9lc24ndCBzY2FuIG1vcmUgdGhhbiBvbmUgbGluZSBhYm92ZSB0byBmaW5kIGEgY2hhcmFjdGVyLlxuICAvLyBEb2Vzbid0IGRvIGFueXRoaW5nIG9uIGFuIGVtcHR5IGxpbmUuXG4gIC8vIERvZXNuJ3QgZG8gYW55dGhpbmcgd2l0aCBub24tZW1wdHkgc2VsZWN0aW9ucy5cbiAgdHJhbnNwb3NlQ2hhcnM6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gcnVuSW5PcChjbSwgZnVuY3Rpb24gKCkge1xuICAgIHZhciByYW5nZXMgPSBjbS5saXN0U2VsZWN0aW9ucygpLCBuZXdTZWwgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFyYW5nZXNbaV0uZW1wdHkoKSkgeyBjb250aW51ZSB9XG4gICAgICB2YXIgY3VyID0gcmFuZ2VzW2ldLmhlYWQsIGxpbmUgPSBnZXRMaW5lKGNtLmRvYywgY3VyLmxpbmUpLnRleHQ7XG4gICAgICBpZiAobGluZSkge1xuICAgICAgICBpZiAoY3VyLmNoID09IGxpbmUubGVuZ3RoKSB7IGN1ciA9IG5ldyBQb3MoY3VyLmxpbmUsIGN1ci5jaCAtIDEpOyB9XG4gICAgICAgIGlmIChjdXIuY2ggPiAwKSB7XG4gICAgICAgICAgY3VyID0gbmV3IFBvcyhjdXIubGluZSwgY3VyLmNoICsgMSk7XG4gICAgICAgICAgY20ucmVwbGFjZVJhbmdlKGxpbmUuY2hhckF0KGN1ci5jaCAtIDEpICsgbGluZS5jaGFyQXQoY3VyLmNoIC0gMiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFBvcyhjdXIubGluZSwgY3VyLmNoIC0gMiksIGN1ciwgXCIrdHJhbnNwb3NlXCIpO1xuICAgICAgICB9IGVsc2UgaWYgKGN1ci5saW5lID4gY20uZG9jLmZpcnN0KSB7XG4gICAgICAgICAgdmFyIHByZXYgPSBnZXRMaW5lKGNtLmRvYywgY3VyLmxpbmUgLSAxKS50ZXh0O1xuICAgICAgICAgIGlmIChwcmV2KSB7XG4gICAgICAgICAgICBjdXIgPSBuZXcgUG9zKGN1ci5saW5lLCAxKTtcbiAgICAgICAgICAgIGNtLnJlcGxhY2VSYW5nZShsaW5lLmNoYXJBdCgwKSArIGNtLmRvYy5saW5lU2VwYXJhdG9yKCkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXYuY2hhckF0KHByZXYubGVuZ3RoIC0gMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgUG9zKGN1ci5saW5lIC0gMSwgcHJldi5sZW5ndGggLSAxKSwgY3VyLCBcIit0cmFuc3Bvc2VcIik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBuZXdTZWwucHVzaChuZXcgUmFuZ2UoY3VyLCBjdXIpKTtcbiAgICB9XG4gICAgY20uc2V0U2VsZWN0aW9ucyhuZXdTZWwpO1xuICB9KTsgfSxcbiAgbmV3bGluZUFuZEluZGVudDogZnVuY3Rpb24gKGNtKSB7IHJldHVybiBydW5Jbk9wKGNtLCBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbHMgPSBjbS5saXN0U2VsZWN0aW9ucygpO1xuICAgIGZvciAodmFyIGkgPSBzZWxzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKVxuICAgICAgeyBjbS5yZXBsYWNlUmFuZ2UoY20uZG9jLmxpbmVTZXBhcmF0b3IoKSwgc2Vsc1tpXS5hbmNob3IsIHNlbHNbaV0uaGVhZCwgXCIraW5wdXRcIik7IH1cbiAgICBzZWxzID0gY20ubGlzdFNlbGVjdGlvbnMoKTtcbiAgICBmb3IgKHZhciBpJDEgPSAwOyBpJDEgPCBzZWxzLmxlbmd0aDsgaSQxKyspXG4gICAgICB7IGNtLmluZGVudExpbmUoc2Vsc1tpJDFdLmZyb20oKS5saW5lLCBudWxsLCB0cnVlKTsgfVxuICAgIGVuc3VyZUN1cnNvclZpc2libGUoY20pO1xuICB9KTsgfSxcbiAgb3BlbkxpbmU6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20ucmVwbGFjZVNlbGVjdGlvbihcIlxcblwiLCBcInN0YXJ0XCIpOyB9LFxuICB0b2dnbGVPdmVyd3JpdGU6IGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20udG9nZ2xlT3ZlcndyaXRlKCk7IH1cbn07XG5cblxuZnVuY3Rpb24gbGluZVN0YXJ0KGNtLCBsaW5lTikge1xuICB2YXIgbGluZSA9IGdldExpbmUoY20uZG9jLCBsaW5lTik7XG4gIHZhciB2aXN1YWwgPSB2aXN1YWxMaW5lKGxpbmUpO1xuICBpZiAodmlzdWFsICE9IGxpbmUpIHsgbGluZU4gPSBsaW5lTm8odmlzdWFsKTsgfVxuICByZXR1cm4gZW5kT2ZMaW5lKHRydWUsIGNtLCB2aXN1YWwsIGxpbmVOLCAxKVxufVxuZnVuY3Rpb24gbGluZUVuZChjbSwgbGluZU4pIHtcbiAgdmFyIGxpbmUgPSBnZXRMaW5lKGNtLmRvYywgbGluZU4pO1xuICB2YXIgdmlzdWFsID0gdmlzdWFsTGluZUVuZChsaW5lKTtcbiAgaWYgKHZpc3VhbCAhPSBsaW5lKSB7IGxpbmVOID0gbGluZU5vKHZpc3VhbCk7IH1cbiAgcmV0dXJuIGVuZE9mTGluZSh0cnVlLCBjbSwgbGluZSwgbGluZU4sIC0xKVxufVxuZnVuY3Rpb24gbGluZVN0YXJ0U21hcnQoY20sIHBvcykge1xuICB2YXIgc3RhcnQgPSBsaW5lU3RhcnQoY20sIHBvcy5saW5lKTtcbiAgdmFyIGxpbmUgPSBnZXRMaW5lKGNtLmRvYywgc3RhcnQubGluZSk7XG4gIHZhciBvcmRlciA9IGdldE9yZGVyKGxpbmUsIGNtLmRvYy5kaXJlY3Rpb24pO1xuICBpZiAoIW9yZGVyIHx8IG9yZGVyWzBdLmxldmVsID09IDApIHtcbiAgICB2YXIgZmlyc3ROb25XUyA9IE1hdGgubWF4KDAsIGxpbmUudGV4dC5zZWFyY2goL1xcUy8pKTtcbiAgICB2YXIgaW5XUyA9IHBvcy5saW5lID09IHN0YXJ0LmxpbmUgJiYgcG9zLmNoIDw9IGZpcnN0Tm9uV1MgJiYgcG9zLmNoO1xuICAgIHJldHVybiBQb3Moc3RhcnQubGluZSwgaW5XUyA/IDAgOiBmaXJzdE5vbldTLCBzdGFydC5zdGlja3kpXG4gIH1cbiAgcmV0dXJuIHN0YXJ0XG59XG5cbi8vIFJ1biBhIGhhbmRsZXIgdGhhdCB3YXMgYm91bmQgdG8gYSBrZXkuXG5mdW5jdGlvbiBkb0hhbmRsZUJpbmRpbmcoY20sIGJvdW5kLCBkcm9wU2hpZnQpIHtcbiAgaWYgKHR5cGVvZiBib3VuZCA9PSBcInN0cmluZ1wiKSB7XG4gICAgYm91bmQgPSBjb21tYW5kc1tib3VuZF07XG4gICAgaWYgKCFib3VuZCkgeyByZXR1cm4gZmFsc2UgfVxuICB9XG4gIC8vIEVuc3VyZSBwcmV2aW91cyBpbnB1dCBoYXMgYmVlbiByZWFkLCBzbyB0aGF0IHRoZSBoYW5kbGVyIHNlZXMgYVxuICAvLyBjb25zaXN0ZW50IHZpZXcgb2YgdGhlIGRvY3VtZW50XG4gIGNtLmRpc3BsYXkuaW5wdXQuZW5zdXJlUG9sbGVkKCk7XG4gIHZhciBwcmV2U2hpZnQgPSBjbS5kaXNwbGF5LnNoaWZ0LCBkb25lID0gZmFsc2U7XG4gIHRyeSB7XG4gICAgaWYgKGNtLmlzUmVhZE9ubHkoKSkgeyBjbS5zdGF0ZS5zdXBwcmVzc0VkaXRzID0gdHJ1ZTsgfVxuICAgIGlmIChkcm9wU2hpZnQpIHsgY20uZGlzcGxheS5zaGlmdCA9IGZhbHNlOyB9XG4gICAgZG9uZSA9IGJvdW5kKGNtKSAhPSBQYXNzO1xuICB9IGZpbmFsbHkge1xuICAgIGNtLmRpc3BsYXkuc2hpZnQgPSBwcmV2U2hpZnQ7XG4gICAgY20uc3RhdGUuc3VwcHJlc3NFZGl0cyA9IGZhbHNlO1xuICB9XG4gIHJldHVybiBkb25lXG59XG5cbmZ1bmN0aW9uIGxvb2t1cEtleUZvckVkaXRvcihjbSwgbmFtZSwgaGFuZGxlKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgY20uc3RhdGUua2V5TWFwcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciByZXN1bHQgPSBsb29rdXBLZXkobmFtZSwgY20uc3RhdGUua2V5TWFwc1tpXSwgaGFuZGxlLCBjbSk7XG4gICAgaWYgKHJlc3VsdCkgeyByZXR1cm4gcmVzdWx0IH1cbiAgfVxuICByZXR1cm4gKGNtLm9wdGlvbnMuZXh0cmFLZXlzICYmIGxvb2t1cEtleShuYW1lLCBjbS5vcHRpb25zLmV4dHJhS2V5cywgaGFuZGxlLCBjbSkpXG4gICAgfHwgbG9va3VwS2V5KG5hbWUsIGNtLm9wdGlvbnMua2V5TWFwLCBoYW5kbGUsIGNtKVxufVxuXG4vLyBOb3RlIHRoYXQsIGRlc3BpdGUgdGhlIG5hbWUsIHRoaXMgZnVuY3Rpb24gaXMgYWxzbyB1c2VkIHRvIGNoZWNrXG4vLyBmb3IgYm91bmQgbW91c2UgY2xpY2tzLlxuXG52YXIgc3RvcFNlcSA9IG5ldyBEZWxheWVkO1xuXG5mdW5jdGlvbiBkaXNwYXRjaEtleShjbSwgbmFtZSwgZSwgaGFuZGxlKSB7XG4gIHZhciBzZXEgPSBjbS5zdGF0ZS5rZXlTZXE7XG4gIGlmIChzZXEpIHtcbiAgICBpZiAoaXNNb2RpZmllcktleShuYW1lKSkgeyByZXR1cm4gXCJoYW5kbGVkXCIgfVxuICAgIGlmICgvXFwnJC8udGVzdChuYW1lKSlcbiAgICAgIHsgY20uc3RhdGUua2V5U2VxID0gbnVsbDsgfVxuICAgIGVsc2VcbiAgICAgIHsgc3RvcFNlcS5zZXQoNTAsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKGNtLnN0YXRlLmtleVNlcSA9PSBzZXEpIHtcbiAgICAgICAgICBjbS5zdGF0ZS5rZXlTZXEgPSBudWxsO1xuICAgICAgICAgIGNtLmRpc3BsYXkuaW5wdXQucmVzZXQoKTtcbiAgICAgICAgfVxuICAgICAgfSk7IH1cbiAgICBpZiAoZGlzcGF0Y2hLZXlJbm5lcihjbSwgc2VxICsgXCIgXCIgKyBuYW1lLCBlLCBoYW5kbGUpKSB7IHJldHVybiB0cnVlIH1cbiAgfVxuICByZXR1cm4gZGlzcGF0Y2hLZXlJbm5lcihjbSwgbmFtZSwgZSwgaGFuZGxlKVxufVxuXG5mdW5jdGlvbiBkaXNwYXRjaEtleUlubmVyKGNtLCBuYW1lLCBlLCBoYW5kbGUpIHtcbiAgdmFyIHJlc3VsdCA9IGxvb2t1cEtleUZvckVkaXRvcihjbSwgbmFtZSwgaGFuZGxlKTtcblxuICBpZiAocmVzdWx0ID09IFwibXVsdGlcIilcbiAgICB7IGNtLnN0YXRlLmtleVNlcSA9IG5hbWU7IH1cbiAgaWYgKHJlc3VsdCA9PSBcImhhbmRsZWRcIilcbiAgICB7IHNpZ25hbExhdGVyKGNtLCBcImtleUhhbmRsZWRcIiwgY20sIG5hbWUsIGUpOyB9XG5cbiAgaWYgKHJlc3VsdCA9PSBcImhhbmRsZWRcIiB8fCByZXN1bHQgPT0gXCJtdWx0aVwiKSB7XG4gICAgZV9wcmV2ZW50RGVmYXVsdChlKTtcbiAgICByZXN0YXJ0QmxpbmsoY20pO1xuICB9XG5cbiAgcmV0dXJuICEhcmVzdWx0XG59XG5cbi8vIEhhbmRsZSBhIGtleSBmcm9tIHRoZSBrZXlkb3duIGV2ZW50LlxuZnVuY3Rpb24gaGFuZGxlS2V5QmluZGluZyhjbSwgZSkge1xuICB2YXIgbmFtZSA9IGtleU5hbWUoZSwgdHJ1ZSk7XG4gIGlmICghbmFtZSkgeyByZXR1cm4gZmFsc2UgfVxuXG4gIGlmIChlLnNoaWZ0S2V5ICYmICFjbS5zdGF0ZS5rZXlTZXEpIHtcbiAgICAvLyBGaXJzdCB0cnkgdG8gcmVzb2x2ZSBmdWxsIG5hbWUgKGluY2x1ZGluZyAnU2hpZnQtJykuIEZhaWxpbmdcbiAgICAvLyB0aGF0LCBzZWUgaWYgdGhlcmUgaXMgYSBjdXJzb3ItbW90aW9uIGNvbW1hbmQgKHN0YXJ0aW5nIHdpdGhcbiAgICAvLyAnZ28nKSBib3VuZCB0byB0aGUga2V5bmFtZSB3aXRob3V0ICdTaGlmdC0nLlxuICAgIHJldHVybiBkaXNwYXRjaEtleShjbSwgXCJTaGlmdC1cIiArIG5hbWUsIGUsIGZ1bmN0aW9uIChiKSB7IHJldHVybiBkb0hhbmRsZUJpbmRpbmcoY20sIGIsIHRydWUpOyB9KVxuICAgICAgICB8fCBkaXNwYXRjaEtleShjbSwgbmFtZSwgZSwgZnVuY3Rpb24gKGIpIHtcbiAgICAgICAgICAgICBpZiAodHlwZW9mIGIgPT0gXCJzdHJpbmdcIiA/IC9eZ29bQS1aXS8udGVzdChiKSA6IGIubW90aW9uKVxuICAgICAgICAgICAgICAgeyByZXR1cm4gZG9IYW5kbGVCaW5kaW5nKGNtLCBiKSB9XG4gICAgICAgICAgIH0pXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGRpc3BhdGNoS2V5KGNtLCBuYW1lLCBlLCBmdW5jdGlvbiAoYikgeyByZXR1cm4gZG9IYW5kbGVCaW5kaW5nKGNtLCBiKTsgfSlcbiAgfVxufVxuXG4vLyBIYW5kbGUgYSBrZXkgZnJvbSB0aGUga2V5cHJlc3MgZXZlbnRcbmZ1bmN0aW9uIGhhbmRsZUNoYXJCaW5kaW5nKGNtLCBlLCBjaCkge1xuICByZXR1cm4gZGlzcGF0Y2hLZXkoY20sIFwiJ1wiICsgY2ggKyBcIidcIiwgZSwgZnVuY3Rpb24gKGIpIHsgcmV0dXJuIGRvSGFuZGxlQmluZGluZyhjbSwgYiwgdHJ1ZSk7IH0pXG59XG5cbnZhciBsYXN0U3RvcHBlZEtleSA9IG51bGw7XG5mdW5jdGlvbiBvbktleURvd24oZSkge1xuICB2YXIgY20gPSB0aGlzO1xuICBjbS5jdXJPcC5mb2N1cyA9IGFjdGl2ZUVsdCgpO1xuICBpZiAoc2lnbmFsRE9NRXZlbnQoY20sIGUpKSB7IHJldHVybiB9XG4gIC8vIElFIGRvZXMgc3RyYW5nZSB0aGluZ3Mgd2l0aCBlc2NhcGUuXG4gIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgMTEgJiYgZS5rZXlDb2RlID09IDI3KSB7IGUucmV0dXJuVmFsdWUgPSBmYWxzZTsgfVxuICB2YXIgY29kZSA9IGUua2V5Q29kZTtcbiAgY20uZGlzcGxheS5zaGlmdCA9IGNvZGUgPT0gMTYgfHwgZS5zaGlmdEtleTtcbiAgdmFyIGhhbmRsZWQgPSBoYW5kbGVLZXlCaW5kaW5nKGNtLCBlKTtcbiAgaWYgKHByZXN0bykge1xuICAgIGxhc3RTdG9wcGVkS2V5ID0gaGFuZGxlZCA/IGNvZGUgOiBudWxsO1xuICAgIC8vIE9wZXJhIGhhcyBubyBjdXQgZXZlbnQuLi4gd2UgdHJ5IHRvIGF0IGxlYXN0IGNhdGNoIHRoZSBrZXkgY29tYm9cbiAgICBpZiAoIWhhbmRsZWQgJiYgY29kZSA9PSA4OCAmJiAhaGFzQ29weUV2ZW50ICYmIChtYWMgPyBlLm1ldGFLZXkgOiBlLmN0cmxLZXkpKVxuICAgICAgeyBjbS5yZXBsYWNlU2VsZWN0aW9uKFwiXCIsIG51bGwsIFwiY3V0XCIpOyB9XG4gIH1cblxuICAvLyBUdXJuIG1vdXNlIGludG8gY3Jvc3NoYWlyIHdoZW4gQWx0IGlzIGhlbGQgb24gTWFjLlxuICBpZiAoY29kZSA9PSAxOCAmJiAhL1xcYkNvZGVNaXJyb3ItY3Jvc3NoYWlyXFxiLy50ZXN0KGNtLmRpc3BsYXkubGluZURpdi5jbGFzc05hbWUpKVxuICAgIHsgc2hvd0Nyb3NzSGFpcihjbSk7IH1cbn1cblxuZnVuY3Rpb24gc2hvd0Nyb3NzSGFpcihjbSkge1xuICB2YXIgbGluZURpdiA9IGNtLmRpc3BsYXkubGluZURpdjtcbiAgYWRkQ2xhc3MobGluZURpdiwgXCJDb2RlTWlycm9yLWNyb3NzaGFpclwiKTtcblxuICBmdW5jdGlvbiB1cChlKSB7XG4gICAgaWYgKGUua2V5Q29kZSA9PSAxOCB8fCAhZS5hbHRLZXkpIHtcbiAgICAgIHJtQ2xhc3MobGluZURpdiwgXCJDb2RlTWlycm9yLWNyb3NzaGFpclwiKTtcbiAgICAgIG9mZihkb2N1bWVudCwgXCJrZXl1cFwiLCB1cCk7XG4gICAgICBvZmYoZG9jdW1lbnQsIFwibW91c2VvdmVyXCIsIHVwKTtcbiAgICB9XG4gIH1cbiAgb24oZG9jdW1lbnQsIFwia2V5dXBcIiwgdXApO1xuICBvbihkb2N1bWVudCwgXCJtb3VzZW92ZXJcIiwgdXApO1xufVxuXG5mdW5jdGlvbiBvbktleVVwKGUpIHtcbiAgaWYgKGUua2V5Q29kZSA9PSAxNikgeyB0aGlzLmRvYy5zZWwuc2hpZnQgPSBmYWxzZTsgfVxuICBzaWduYWxET01FdmVudCh0aGlzLCBlKTtcbn1cblxuZnVuY3Rpb24gb25LZXlQcmVzcyhlKSB7XG4gIHZhciBjbSA9IHRoaXM7XG4gIGlmIChldmVudEluV2lkZ2V0KGNtLmRpc3BsYXksIGUpIHx8IHNpZ25hbERPTUV2ZW50KGNtLCBlKSB8fCBlLmN0cmxLZXkgJiYgIWUuYWx0S2V5IHx8IG1hYyAmJiBlLm1ldGFLZXkpIHsgcmV0dXJuIH1cbiAgdmFyIGtleUNvZGUgPSBlLmtleUNvZGUsIGNoYXJDb2RlID0gZS5jaGFyQ29kZTtcbiAgaWYgKHByZXN0byAmJiBrZXlDb2RlID09IGxhc3RTdG9wcGVkS2V5KSB7bGFzdFN0b3BwZWRLZXkgPSBudWxsOyBlX3ByZXZlbnREZWZhdWx0KGUpOyByZXR1cm59XG4gIGlmICgocHJlc3RvICYmICghZS53aGljaCB8fCBlLndoaWNoIDwgMTApKSAmJiBoYW5kbGVLZXlCaW5kaW5nKGNtLCBlKSkgeyByZXR1cm4gfVxuICB2YXIgY2ggPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNoYXJDb2RlID09IG51bGwgPyBrZXlDb2RlIDogY2hhckNvZGUpO1xuICAvLyBTb21lIGJyb3dzZXJzIGZpcmUga2V5cHJlc3MgZXZlbnRzIGZvciBiYWNrc3BhY2VcbiAgaWYgKGNoID09IFwiXFx4MDhcIikgeyByZXR1cm4gfVxuICBpZiAoaGFuZGxlQ2hhckJpbmRpbmcoY20sIGUsIGNoKSkgeyByZXR1cm4gfVxuICBjbS5kaXNwbGF5LmlucHV0Lm9uS2V5UHJlc3MoZSk7XG59XG5cbnZhciBET1VCTEVDTElDS19ERUxBWSA9IDQwMDtcblxudmFyIFBhc3RDbGljayA9IGZ1bmN0aW9uKHRpbWUsIHBvcywgYnV0dG9uKSB7XG4gIHRoaXMudGltZSA9IHRpbWU7XG4gIHRoaXMucG9zID0gcG9zO1xuICB0aGlzLmJ1dHRvbiA9IGJ1dHRvbjtcbn07XG5cblBhc3RDbGljay5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uICh0aW1lLCBwb3MsIGJ1dHRvbikge1xuICByZXR1cm4gdGhpcy50aW1lICsgRE9VQkxFQ0xJQ0tfREVMQVkgPiB0aW1lICYmXG4gICAgY21wKHBvcywgdGhpcy5wb3MpID09IDAgJiYgYnV0dG9uID09IHRoaXMuYnV0dG9uXG59O1xuXG52YXIgbGFzdENsaWNrO1xudmFyIGxhc3REb3VibGVDbGljaztcbmZ1bmN0aW9uIGNsaWNrUmVwZWF0KHBvcywgYnV0dG9uKSB7XG4gIHZhciBub3cgPSArbmV3IERhdGU7XG4gIGlmIChsYXN0RG91YmxlQ2xpY2sgJiYgbGFzdERvdWJsZUNsaWNrLmNvbXBhcmUobm93LCBwb3MsIGJ1dHRvbikpIHtcbiAgICBsYXN0Q2xpY2sgPSBsYXN0RG91YmxlQ2xpY2sgPSBudWxsO1xuICAgIHJldHVybiBcInRyaXBsZVwiXG4gIH0gZWxzZSBpZiAobGFzdENsaWNrICYmIGxhc3RDbGljay5jb21wYXJlKG5vdywgcG9zLCBidXR0b24pKSB7XG4gICAgbGFzdERvdWJsZUNsaWNrID0gbmV3IFBhc3RDbGljayhub3csIHBvcywgYnV0dG9uKTtcbiAgICBsYXN0Q2xpY2sgPSBudWxsO1xuICAgIHJldHVybiBcImRvdWJsZVwiXG4gIH0gZWxzZSB7XG4gICAgbGFzdENsaWNrID0gbmV3IFBhc3RDbGljayhub3csIHBvcywgYnV0dG9uKTtcbiAgICBsYXN0RG91YmxlQ2xpY2sgPSBudWxsO1xuICAgIHJldHVybiBcInNpbmdsZVwiXG4gIH1cbn1cblxuLy8gQSBtb3VzZSBkb3duIGNhbiBiZSBhIHNpbmdsZSBjbGljaywgZG91YmxlIGNsaWNrLCB0cmlwbGUgY2xpY2ssXG4vLyBzdGFydCBvZiBzZWxlY3Rpb24gZHJhZywgc3RhcnQgb2YgdGV4dCBkcmFnLCBuZXcgY3Vyc29yXG4vLyAoY3RybC1jbGljayksIHJlY3RhbmdsZSBkcmFnIChhbHQtZHJhZyksIG9yIHh3aW5cbi8vIG1pZGRsZS1jbGljay1wYXN0ZS4gT3IgaXQgbWlnaHQgYmUgYSBjbGljayBvbiBzb21ldGhpbmcgd2Ugc2hvdWxkXG4vLyBub3QgaW50ZXJmZXJlIHdpdGgsIHN1Y2ggYXMgYSBzY3JvbGxiYXIgb3Igd2lkZ2V0LlxuZnVuY3Rpb24gb25Nb3VzZURvd24oZSkge1xuICB2YXIgY20gPSB0aGlzLCBkaXNwbGF5ID0gY20uZGlzcGxheTtcbiAgaWYgKHNpZ25hbERPTUV2ZW50KGNtLCBlKSB8fCBkaXNwbGF5LmFjdGl2ZVRvdWNoICYmIGRpc3BsYXkuaW5wdXQuc3VwcG9ydHNUb3VjaCgpKSB7IHJldHVybiB9XG4gIGRpc3BsYXkuaW5wdXQuZW5zdXJlUG9sbGVkKCk7XG4gIGRpc3BsYXkuc2hpZnQgPSBlLnNoaWZ0S2V5O1xuXG4gIGlmIChldmVudEluV2lkZ2V0KGRpc3BsYXksIGUpKSB7XG4gICAgaWYgKCF3ZWJraXQpIHtcbiAgICAgIC8vIEJyaWVmbHkgdHVybiBvZmYgZHJhZ2dhYmlsaXR5LCB0byBhbGxvdyB3aWRnZXRzIHRvIGRvXG4gICAgICAvLyBub3JtYWwgZHJhZ2dpbmcgdGhpbmdzLlxuICAgICAgZGlzcGxheS5zY3JvbGxlci5kcmFnZ2FibGUgPSBmYWxzZTtcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkgeyByZXR1cm4gZGlzcGxheS5zY3JvbGxlci5kcmFnZ2FibGUgPSB0cnVlOyB9LCAxMDApO1xuICAgIH1cbiAgICByZXR1cm5cbiAgfVxuICBpZiAoY2xpY2tJbkd1dHRlcihjbSwgZSkpIHsgcmV0dXJuIH1cbiAgdmFyIHBvcyA9IHBvc0Zyb21Nb3VzZShjbSwgZSksIGJ1dHRvbiA9IGVfYnV0dG9uKGUpLCByZXBlYXQgPSBwb3MgPyBjbGlja1JlcGVhdChwb3MsIGJ1dHRvbikgOiBcInNpbmdsZVwiO1xuICB3aW5kb3cuZm9jdXMoKTtcblxuICAvLyAjMzI2MTogbWFrZSBzdXJlLCB0aGF0IHdlJ3JlIG5vdCBzdGFydGluZyBhIHNlY29uZCBzZWxlY3Rpb25cbiAgaWYgKGJ1dHRvbiA9PSAxICYmIGNtLnN0YXRlLnNlbGVjdGluZ1RleHQpXG4gICAgeyBjbS5zdGF0ZS5zZWxlY3RpbmdUZXh0KGUpOyB9XG5cbiAgaWYgKHBvcyAmJiBoYW5kbGVNYXBwZWRCdXR0b24oY20sIGJ1dHRvbiwgcG9zLCByZXBlYXQsIGUpKSB7IHJldHVybiB9XG5cbiAgaWYgKGJ1dHRvbiA9PSAxKSB7XG4gICAgaWYgKHBvcykgeyBsZWZ0QnV0dG9uRG93bihjbSwgcG9zLCByZXBlYXQsIGUpOyB9XG4gICAgZWxzZSBpZiAoZV90YXJnZXQoZSkgPT0gZGlzcGxheS5zY3JvbGxlcikgeyBlX3ByZXZlbnREZWZhdWx0KGUpOyB9XG4gIH0gZWxzZSBpZiAoYnV0dG9uID09IDIpIHtcbiAgICBpZiAocG9zKSB7IGV4dGVuZFNlbGVjdGlvbihjbS5kb2MsIHBvcyk7IH1cbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHsgcmV0dXJuIGRpc3BsYXkuaW5wdXQuZm9jdXMoKTsgfSwgMjApO1xuICB9IGVsc2UgaWYgKGJ1dHRvbiA9PSAzKSB7XG4gICAgaWYgKGNhcHR1cmVSaWdodENsaWNrKSB7IG9uQ29udGV4dE1lbnUoY20sIGUpOyB9XG4gICAgZWxzZSB7IGRlbGF5Qmx1ckV2ZW50KGNtKTsgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZU1hcHBlZEJ1dHRvbihjbSwgYnV0dG9uLCBwb3MsIHJlcGVhdCwgZXZlbnQpIHtcbiAgdmFyIG5hbWUgPSBcIkNsaWNrXCI7XG4gIGlmIChyZXBlYXQgPT0gXCJkb3VibGVcIikgeyBuYW1lID0gXCJEb3VibGVcIiArIG5hbWU7IH1cbiAgZWxzZSBpZiAocmVwZWF0ID09IFwidHJpcGxlXCIpIHsgbmFtZSA9IFwiVHJpcGxlXCIgKyBuYW1lOyB9XG4gIG5hbWUgPSAoYnV0dG9uID09IDEgPyBcIkxlZnRcIiA6IGJ1dHRvbiA9PSAyID8gXCJNaWRkbGVcIiA6IFwiUmlnaHRcIikgKyBuYW1lO1xuXG4gIHJldHVybiBkaXNwYXRjaEtleShjbSwgIGFkZE1vZGlmaWVyTmFtZXMobmFtZSwgZXZlbnQpLCBldmVudCwgZnVuY3Rpb24gKGJvdW5kKSB7XG4gICAgaWYgKHR5cGVvZiBib3VuZCA9PSBcInN0cmluZ1wiKSB7IGJvdW5kID0gY29tbWFuZHNbYm91bmRdOyB9XG4gICAgaWYgKCFib3VuZCkgeyByZXR1cm4gZmFsc2UgfVxuICAgIHZhciBkb25lID0gZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgIGlmIChjbS5pc1JlYWRPbmx5KCkpIHsgY20uc3RhdGUuc3VwcHJlc3NFZGl0cyA9IHRydWU7IH1cbiAgICAgIGRvbmUgPSBib3VuZChjbSwgcG9zKSAhPSBQYXNzO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBjbS5zdGF0ZS5zdXBwcmVzc0VkaXRzID0gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiBkb25lXG4gIH0pXG59XG5cbmZ1bmN0aW9uIGNvbmZpZ3VyZU1vdXNlKGNtLCByZXBlYXQsIGV2ZW50KSB7XG4gIHZhciBvcHRpb24gPSBjbS5nZXRPcHRpb24oXCJjb25maWd1cmVNb3VzZVwiKTtcbiAgdmFyIHZhbHVlID0gb3B0aW9uID8gb3B0aW9uKGNtLCByZXBlYXQsIGV2ZW50KSA6IHt9O1xuICBpZiAodmFsdWUudW5pdCA9PSBudWxsKSB7XG4gICAgdmFyIHJlY3QgPSBjaHJvbWVPUyA/IGV2ZW50LnNoaWZ0S2V5ICYmIGV2ZW50Lm1ldGFLZXkgOiBldmVudC5hbHRLZXk7XG4gICAgdmFsdWUudW5pdCA9IHJlY3QgPyBcInJlY3RhbmdsZVwiIDogcmVwZWF0ID09IFwic2luZ2xlXCIgPyBcImNoYXJcIiA6IHJlcGVhdCA9PSBcImRvdWJsZVwiID8gXCJ3b3JkXCIgOiBcImxpbmVcIjtcbiAgfVxuICBpZiAodmFsdWUuZXh0ZW5kID09IG51bGwgfHwgY20uZG9jLmV4dGVuZCkgeyB2YWx1ZS5leHRlbmQgPSBjbS5kb2MuZXh0ZW5kIHx8IGV2ZW50LnNoaWZ0S2V5OyB9XG4gIGlmICh2YWx1ZS5hZGROZXcgPT0gbnVsbCkgeyB2YWx1ZS5hZGROZXcgPSBtYWMgPyBldmVudC5tZXRhS2V5IDogZXZlbnQuY3RybEtleTsgfVxuICBpZiAodmFsdWUubW92ZU9uRHJhZyA9PSBudWxsKSB7IHZhbHVlLm1vdmVPbkRyYWcgPSAhKG1hYyA/IGV2ZW50LmFsdEtleSA6IGV2ZW50LmN0cmxLZXkpOyB9XG4gIHJldHVybiB2YWx1ZVxufVxuXG5mdW5jdGlvbiBsZWZ0QnV0dG9uRG93bihjbSwgcG9zLCByZXBlYXQsIGV2ZW50KSB7XG4gIGlmIChpZSkgeyBzZXRUaW1lb3V0KGJpbmQoZW5zdXJlRm9jdXMsIGNtKSwgMCk7IH1cbiAgZWxzZSB7IGNtLmN1ck9wLmZvY3VzID0gYWN0aXZlRWx0KCk7IH1cblxuICB2YXIgYmVoYXZpb3IgPSBjb25maWd1cmVNb3VzZShjbSwgcmVwZWF0LCBldmVudCk7XG5cbiAgdmFyIHNlbCA9IGNtLmRvYy5zZWwsIGNvbnRhaW5lZDtcbiAgaWYgKGNtLm9wdGlvbnMuZHJhZ0Ryb3AgJiYgZHJhZ0FuZERyb3AgJiYgIWNtLmlzUmVhZE9ubHkoKSAmJlxuICAgICAgcmVwZWF0ID09IFwic2luZ2xlXCIgJiYgKGNvbnRhaW5lZCA9IHNlbC5jb250YWlucyhwb3MpKSA+IC0xICYmXG4gICAgICAoY21wKChjb250YWluZWQgPSBzZWwucmFuZ2VzW2NvbnRhaW5lZF0pLmZyb20oKSwgcG9zKSA8IDAgfHwgcG9zLnhSZWwgPiAwKSAmJlxuICAgICAgKGNtcChjb250YWluZWQudG8oKSwgcG9zKSA+IDAgfHwgcG9zLnhSZWwgPCAwKSlcbiAgICB7IGxlZnRCdXR0b25TdGFydERyYWcoY20sIGV2ZW50LCBwb3MsIGJlaGF2aW9yKTsgfVxuICBlbHNlXG4gICAgeyBsZWZ0QnV0dG9uU2VsZWN0KGNtLCBldmVudCwgcG9zLCBiZWhhdmlvcik7IH1cbn1cblxuLy8gU3RhcnQgYSB0ZXh0IGRyYWcuIFdoZW4gaXQgZW5kcywgc2VlIGlmIGFueSBkcmFnZ2luZyBhY3R1YWxseVxuLy8gaGFwcGVuLCBhbmQgdHJlYXQgYXMgYSBjbGljayBpZiBpdCBkaWRuJ3QuXG5mdW5jdGlvbiBsZWZ0QnV0dG9uU3RhcnREcmFnKGNtLCBldmVudCwgcG9zLCBiZWhhdmlvcikge1xuICB2YXIgZGlzcGxheSA9IGNtLmRpc3BsYXksIG1vdmVkID0gZmFsc2U7XG4gIHZhciBkcmFnRW5kID0gb3BlcmF0aW9uKGNtLCBmdW5jdGlvbiAoZSkge1xuICAgIGlmICh3ZWJraXQpIHsgZGlzcGxheS5zY3JvbGxlci5kcmFnZ2FibGUgPSBmYWxzZTsgfVxuICAgIGNtLnN0YXRlLmRyYWdnaW5nVGV4dCA9IGZhbHNlO1xuICAgIG9mZihkb2N1bWVudCwgXCJtb3VzZXVwXCIsIGRyYWdFbmQpO1xuICAgIG9mZihkb2N1bWVudCwgXCJtb3VzZW1vdmVcIiwgbW91c2VNb3ZlKTtcbiAgICBvZmYoZGlzcGxheS5zY3JvbGxlciwgXCJkcmFnc3RhcnRcIiwgZHJhZ1N0YXJ0KTtcbiAgICBvZmYoZGlzcGxheS5zY3JvbGxlciwgXCJkcm9wXCIsIGRyYWdFbmQpO1xuICAgIGlmICghbW92ZWQpIHtcbiAgICAgIGVfcHJldmVudERlZmF1bHQoZSk7XG4gICAgICBpZiAoIWJlaGF2aW9yLmFkZE5ldylcbiAgICAgICAgeyBleHRlbmRTZWxlY3Rpb24oY20uZG9jLCBwb3MsIG51bGwsIG51bGwsIGJlaGF2aW9yLmV4dGVuZCk7IH1cbiAgICAgIC8vIFdvcmsgYXJvdW5kIHVuZXhwbGFpbmFibGUgZm9jdXMgcHJvYmxlbSBpbiBJRTkgKCMyMTI3KSBhbmQgQ2hyb21lICgjMzA4MSlcbiAgICAgIGlmICh3ZWJraXQgfHwgaWUgJiYgaWVfdmVyc2lvbiA9PSA5KVxuICAgICAgICB7IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge2RvY3VtZW50LmJvZHkuZm9jdXMoKTsgZGlzcGxheS5pbnB1dC5mb2N1cygpO30sIDIwKTsgfVxuICAgICAgZWxzZVxuICAgICAgICB7IGRpc3BsYXkuaW5wdXQuZm9jdXMoKTsgfVxuICAgIH1cbiAgfSk7XG4gIHZhciBtb3VzZU1vdmUgPSBmdW5jdGlvbihlMikge1xuICAgIG1vdmVkID0gbW92ZWQgfHwgTWF0aC5hYnMoZXZlbnQuY2xpZW50WCAtIGUyLmNsaWVudFgpICsgTWF0aC5hYnMoZXZlbnQuY2xpZW50WSAtIGUyLmNsaWVudFkpID49IDEwO1xuICB9O1xuICB2YXIgZHJhZ1N0YXJ0ID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gbW92ZWQgPSB0cnVlOyB9O1xuICAvLyBMZXQgdGhlIGRyYWcgaGFuZGxlciBoYW5kbGUgdGhpcy5cbiAgaWYgKHdlYmtpdCkgeyBkaXNwbGF5LnNjcm9sbGVyLmRyYWdnYWJsZSA9IHRydWU7IH1cbiAgY20uc3RhdGUuZHJhZ2dpbmdUZXh0ID0gZHJhZ0VuZDtcbiAgZHJhZ0VuZC5jb3B5ID0gIWJlaGF2aW9yLm1vdmVPbkRyYWc7XG4gIC8vIElFJ3MgYXBwcm9hY2ggdG8gZHJhZ2dhYmxlXG4gIGlmIChkaXNwbGF5LnNjcm9sbGVyLmRyYWdEcm9wKSB7IGRpc3BsYXkuc2Nyb2xsZXIuZHJhZ0Ryb3AoKTsgfVxuICBvbihkb2N1bWVudCwgXCJtb3VzZXVwXCIsIGRyYWdFbmQpO1xuICBvbihkb2N1bWVudCwgXCJtb3VzZW1vdmVcIiwgbW91c2VNb3ZlKTtcbiAgb24oZGlzcGxheS5zY3JvbGxlciwgXCJkcmFnc3RhcnRcIiwgZHJhZ1N0YXJ0KTtcbiAgb24oZGlzcGxheS5zY3JvbGxlciwgXCJkcm9wXCIsIGRyYWdFbmQpO1xuXG4gIGRlbGF5Qmx1ckV2ZW50KGNtKTtcbiAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7IHJldHVybiBkaXNwbGF5LmlucHV0LmZvY3VzKCk7IH0sIDIwKTtcbn1cblxuZnVuY3Rpb24gcmFuZ2VGb3JVbml0KGNtLCBwb3MsIHVuaXQpIHtcbiAgaWYgKHVuaXQgPT0gXCJjaGFyXCIpIHsgcmV0dXJuIG5ldyBSYW5nZShwb3MsIHBvcykgfVxuICBpZiAodW5pdCA9PSBcIndvcmRcIikgeyByZXR1cm4gY20uZmluZFdvcmRBdChwb3MpIH1cbiAgaWYgKHVuaXQgPT0gXCJsaW5lXCIpIHsgcmV0dXJuIG5ldyBSYW5nZShQb3MocG9zLmxpbmUsIDApLCBjbGlwUG9zKGNtLmRvYywgUG9zKHBvcy5saW5lICsgMSwgMCkpKSB9XG4gIHZhciByZXN1bHQgPSB1bml0KGNtLCBwb3MpO1xuICByZXR1cm4gbmV3IFJhbmdlKHJlc3VsdC5mcm9tLCByZXN1bHQudG8pXG59XG5cbi8vIE5vcm1hbCBzZWxlY3Rpb24sIGFzIG9wcG9zZWQgdG8gdGV4dCBkcmFnZ2luZy5cbmZ1bmN0aW9uIGxlZnRCdXR0b25TZWxlY3QoY20sIGV2ZW50LCBzdGFydCwgYmVoYXZpb3IpIHtcbiAgdmFyIGRpc3BsYXkgPSBjbS5kaXNwbGF5LCBkb2MgPSBjbS5kb2M7XG4gIGVfcHJldmVudERlZmF1bHQoZXZlbnQpO1xuXG4gIHZhciBvdXJSYW5nZSwgb3VySW5kZXgsIHN0YXJ0U2VsID0gZG9jLnNlbCwgcmFuZ2VzID0gc3RhcnRTZWwucmFuZ2VzO1xuICBpZiAoYmVoYXZpb3IuYWRkTmV3ICYmICFiZWhhdmlvci5leHRlbmQpIHtcbiAgICBvdXJJbmRleCA9IGRvYy5zZWwuY29udGFpbnMoc3RhcnQpO1xuICAgIGlmIChvdXJJbmRleCA+IC0xKVxuICAgICAgeyBvdXJSYW5nZSA9IHJhbmdlc1tvdXJJbmRleF07IH1cbiAgICBlbHNlXG4gICAgICB7IG91clJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0LCBzdGFydCk7IH1cbiAgfSBlbHNlIHtcbiAgICBvdXJSYW5nZSA9IGRvYy5zZWwucHJpbWFyeSgpO1xuICAgIG91ckluZGV4ID0gZG9jLnNlbC5wcmltSW5kZXg7XG4gIH1cblxuICBpZiAoYmVoYXZpb3IudW5pdCA9PSBcInJlY3RhbmdsZVwiKSB7XG4gICAgaWYgKCFiZWhhdmlvci5hZGROZXcpIHsgb3VyUmFuZ2UgPSBuZXcgUmFuZ2Uoc3RhcnQsIHN0YXJ0KTsgfVxuICAgIHN0YXJ0ID0gcG9zRnJvbU1vdXNlKGNtLCBldmVudCwgdHJ1ZSwgdHJ1ZSk7XG4gICAgb3VySW5kZXggPSAtMTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgcmFuZ2UkJDEgPSByYW5nZUZvclVuaXQoY20sIHN0YXJ0LCBiZWhhdmlvci51bml0KTtcbiAgICBpZiAoYmVoYXZpb3IuZXh0ZW5kKVxuICAgICAgeyBvdXJSYW5nZSA9IGV4dGVuZFJhbmdlKG91clJhbmdlLCByYW5nZSQkMS5hbmNob3IsIHJhbmdlJCQxLmhlYWQsIGJlaGF2aW9yLmV4dGVuZCk7IH1cbiAgICBlbHNlXG4gICAgICB7IG91clJhbmdlID0gcmFuZ2UkJDE7IH1cbiAgfVxuXG4gIGlmICghYmVoYXZpb3IuYWRkTmV3KSB7XG4gICAgb3VySW5kZXggPSAwO1xuICAgIHNldFNlbGVjdGlvbihkb2MsIG5ldyBTZWxlY3Rpb24oW291clJhbmdlXSwgMCksIHNlbF9tb3VzZSk7XG4gICAgc3RhcnRTZWwgPSBkb2Muc2VsO1xuICB9IGVsc2UgaWYgKG91ckluZGV4ID09IC0xKSB7XG4gICAgb3VySW5kZXggPSByYW5nZXMubGVuZ3RoO1xuICAgIHNldFNlbGVjdGlvbihkb2MsIG5vcm1hbGl6ZVNlbGVjdGlvbihyYW5nZXMuY29uY2F0KFtvdXJSYW5nZV0pLCBvdXJJbmRleCksXG4gICAgICAgICAgICAgICAgIHtzY3JvbGw6IGZhbHNlLCBvcmlnaW46IFwiKm1vdXNlXCJ9KTtcbiAgfSBlbHNlIGlmIChyYW5nZXMubGVuZ3RoID4gMSAmJiByYW5nZXNbb3VySW5kZXhdLmVtcHR5KCkgJiYgYmVoYXZpb3IudW5pdCA9PSBcImNoYXJcIiAmJiAhYmVoYXZpb3IuZXh0ZW5kKSB7XG4gICAgc2V0U2VsZWN0aW9uKGRvYywgbm9ybWFsaXplU2VsZWN0aW9uKHJhbmdlcy5zbGljZSgwLCBvdXJJbmRleCkuY29uY2F0KHJhbmdlcy5zbGljZShvdXJJbmRleCArIDEpKSwgMCksXG4gICAgICAgICAgICAgICAgIHtzY3JvbGw6IGZhbHNlLCBvcmlnaW46IFwiKm1vdXNlXCJ9KTtcbiAgICBzdGFydFNlbCA9IGRvYy5zZWw7XG4gIH0gZWxzZSB7XG4gICAgcmVwbGFjZU9uZVNlbGVjdGlvbihkb2MsIG91ckluZGV4LCBvdXJSYW5nZSwgc2VsX21vdXNlKTtcbiAgfVxuXG4gIHZhciBsYXN0UG9zID0gc3RhcnQ7XG4gIGZ1bmN0aW9uIGV4dGVuZFRvKHBvcykge1xuICAgIGlmIChjbXAobGFzdFBvcywgcG9zKSA9PSAwKSB7IHJldHVybiB9XG4gICAgbGFzdFBvcyA9IHBvcztcblxuICAgIGlmIChiZWhhdmlvci51bml0ID09IFwicmVjdGFuZ2xlXCIpIHtcbiAgICAgIHZhciByYW5nZXMgPSBbXSwgdGFiU2l6ZSA9IGNtLm9wdGlvbnMudGFiU2l6ZTtcbiAgICAgIHZhciBzdGFydENvbCA9IGNvdW50Q29sdW1uKGdldExpbmUoZG9jLCBzdGFydC5saW5lKS50ZXh0LCBzdGFydC5jaCwgdGFiU2l6ZSk7XG4gICAgICB2YXIgcG9zQ29sID0gY291bnRDb2x1bW4oZ2V0TGluZShkb2MsIHBvcy5saW5lKS50ZXh0LCBwb3MuY2gsIHRhYlNpemUpO1xuICAgICAgdmFyIGxlZnQgPSBNYXRoLm1pbihzdGFydENvbCwgcG9zQ29sKSwgcmlnaHQgPSBNYXRoLm1heChzdGFydENvbCwgcG9zQ29sKTtcbiAgICAgIGZvciAodmFyIGxpbmUgPSBNYXRoLm1pbihzdGFydC5saW5lLCBwb3MubGluZSksIGVuZCA9IE1hdGgubWluKGNtLmxhc3RMaW5lKCksIE1hdGgubWF4KHN0YXJ0LmxpbmUsIHBvcy5saW5lKSk7XG4gICAgICAgICAgIGxpbmUgPD0gZW5kOyBsaW5lKyspIHtcbiAgICAgICAgdmFyIHRleHQgPSBnZXRMaW5lKGRvYywgbGluZSkudGV4dCwgbGVmdFBvcyA9IGZpbmRDb2x1bW4odGV4dCwgbGVmdCwgdGFiU2l6ZSk7XG4gICAgICAgIGlmIChsZWZ0ID09IHJpZ2h0KVxuICAgICAgICAgIHsgcmFuZ2VzLnB1c2gobmV3IFJhbmdlKFBvcyhsaW5lLCBsZWZ0UG9zKSwgUG9zKGxpbmUsIGxlZnRQb3MpKSk7IH1cbiAgICAgICAgZWxzZSBpZiAodGV4dC5sZW5ndGggPiBsZWZ0UG9zKVxuICAgICAgICAgIHsgcmFuZ2VzLnB1c2gobmV3IFJhbmdlKFBvcyhsaW5lLCBsZWZ0UG9zKSwgUG9zKGxpbmUsIGZpbmRDb2x1bW4odGV4dCwgcmlnaHQsIHRhYlNpemUpKSkpOyB9XG4gICAgICB9XG4gICAgICBpZiAoIXJhbmdlcy5sZW5ndGgpIHsgcmFuZ2VzLnB1c2gobmV3IFJhbmdlKHN0YXJ0LCBzdGFydCkpOyB9XG4gICAgICBzZXRTZWxlY3Rpb24oZG9jLCBub3JtYWxpemVTZWxlY3Rpb24oc3RhcnRTZWwucmFuZ2VzLnNsaWNlKDAsIG91ckluZGV4KS5jb25jYXQocmFuZ2VzKSwgb3VySW5kZXgpLFxuICAgICAgICAgICAgICAgICAgIHtvcmlnaW46IFwiKm1vdXNlXCIsIHNjcm9sbDogZmFsc2V9KTtcbiAgICAgIGNtLnNjcm9sbEludG9WaWV3KHBvcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBvbGRSYW5nZSA9IG91clJhbmdlO1xuICAgICAgdmFyIHJhbmdlJCQxID0gcmFuZ2VGb3JVbml0KGNtLCBwb3MsIGJlaGF2aW9yLnVuaXQpO1xuICAgICAgdmFyIGFuY2hvciA9IG9sZFJhbmdlLmFuY2hvciwgaGVhZDtcbiAgICAgIGlmIChjbXAocmFuZ2UkJDEuYW5jaG9yLCBhbmNob3IpID4gMCkge1xuICAgICAgICBoZWFkID0gcmFuZ2UkJDEuaGVhZDtcbiAgICAgICAgYW5jaG9yID0gbWluUG9zKG9sZFJhbmdlLmZyb20oKSwgcmFuZ2UkJDEuYW5jaG9yKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGhlYWQgPSByYW5nZSQkMS5hbmNob3I7XG4gICAgICAgIGFuY2hvciA9IG1heFBvcyhvbGRSYW5nZS50bygpLCByYW5nZSQkMS5oZWFkKTtcbiAgICAgIH1cbiAgICAgIHZhciByYW5nZXMkMSA9IHN0YXJ0U2VsLnJhbmdlcy5zbGljZSgwKTtcbiAgICAgIHJhbmdlcyQxW291ckluZGV4XSA9IGJpZGlTaW1wbGlmeShjbSwgbmV3IFJhbmdlKGNsaXBQb3MoZG9jLCBhbmNob3IpLCBoZWFkKSk7XG4gICAgICBzZXRTZWxlY3Rpb24oZG9jLCBub3JtYWxpemVTZWxlY3Rpb24ocmFuZ2VzJDEsIG91ckluZGV4KSwgc2VsX21vdXNlKTtcbiAgICB9XG4gIH1cblxuICB2YXIgZWRpdG9yU2l6ZSA9IGRpc3BsYXkud3JhcHBlci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgLy8gVXNlZCB0byBlbnN1cmUgdGltZW91dCByZS10cmllcyBkb24ndCBmaXJlIHdoZW4gYW5vdGhlciBleHRlbmRcbiAgLy8gaGFwcGVuZWQgaW4gdGhlIG1lYW50aW1lIChjbGVhclRpbWVvdXQgaXNuJ3QgcmVsaWFibGUgLS0gYXRcbiAgLy8gbGVhc3Qgb24gQ2hyb21lLCB0aGUgdGltZW91dHMgc3RpbGwgaGFwcGVuIGV2ZW4gd2hlbiBjbGVhcmVkLFxuICAvLyBpZiB0aGUgY2xlYXIgaGFwcGVucyBhZnRlciB0aGVpciBzY2hlZHVsZWQgZmlyaW5nIHRpbWUpLlxuICB2YXIgY291bnRlciA9IDA7XG5cbiAgZnVuY3Rpb24gZXh0ZW5kKGUpIHtcbiAgICB2YXIgY3VyQ291bnQgPSArK2NvdW50ZXI7XG4gICAgdmFyIGN1ciA9IHBvc0Zyb21Nb3VzZShjbSwgZSwgdHJ1ZSwgYmVoYXZpb3IudW5pdCA9PSBcInJlY3RhbmdsZVwiKTtcbiAgICBpZiAoIWN1cikgeyByZXR1cm4gfVxuICAgIGlmIChjbXAoY3VyLCBsYXN0UG9zKSAhPSAwKSB7XG4gICAgICBjbS5jdXJPcC5mb2N1cyA9IGFjdGl2ZUVsdCgpO1xuICAgICAgZXh0ZW5kVG8oY3VyKTtcbiAgICAgIHZhciB2aXNpYmxlID0gdmlzaWJsZUxpbmVzKGRpc3BsYXksIGRvYyk7XG4gICAgICBpZiAoY3VyLmxpbmUgPj0gdmlzaWJsZS50byB8fCBjdXIubGluZSA8IHZpc2libGUuZnJvbSlcbiAgICAgICAgeyBzZXRUaW1lb3V0KG9wZXJhdGlvbihjbSwgZnVuY3Rpb24gKCkge2lmIChjb3VudGVyID09IGN1ckNvdW50KSB7IGV4dGVuZChlKTsgfX0pLCAxNTApOyB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBvdXRzaWRlID0gZS5jbGllbnRZIDwgZWRpdG9yU2l6ZS50b3AgPyAtMjAgOiBlLmNsaWVudFkgPiBlZGl0b3JTaXplLmJvdHRvbSA/IDIwIDogMDtcbiAgICAgIGlmIChvdXRzaWRlKSB7IHNldFRpbWVvdXQob3BlcmF0aW9uKGNtLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChjb3VudGVyICE9IGN1ckNvdW50KSB7IHJldHVybiB9XG4gICAgICAgIGRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsVG9wICs9IG91dHNpZGU7XG4gICAgICAgIGV4dGVuZChlKTtcbiAgICAgIH0pLCA1MCk7IH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkb25lKGUpIHtcbiAgICBjbS5zdGF0ZS5zZWxlY3RpbmdUZXh0ID0gZmFsc2U7XG4gICAgY291bnRlciA9IEluZmluaXR5O1xuICAgIGVfcHJldmVudERlZmF1bHQoZSk7XG4gICAgZGlzcGxheS5pbnB1dC5mb2N1cygpO1xuICAgIG9mZihkb2N1bWVudCwgXCJtb3VzZW1vdmVcIiwgbW92ZSk7XG4gICAgb2ZmKGRvY3VtZW50LCBcIm1vdXNldXBcIiwgdXApO1xuICAgIGRvYy5oaXN0b3J5Lmxhc3RTZWxPcmlnaW4gPSBudWxsO1xuICB9XG5cbiAgdmFyIG1vdmUgPSBvcGVyYXRpb24oY20sIGZ1bmN0aW9uIChlKSB7XG4gICAgaWYgKCFlX2J1dHRvbihlKSkgeyBkb25lKGUpOyB9XG4gICAgZWxzZSB7IGV4dGVuZChlKTsgfVxuICB9KTtcbiAgdmFyIHVwID0gb3BlcmF0aW9uKGNtLCBkb25lKTtcbiAgY20uc3RhdGUuc2VsZWN0aW5nVGV4dCA9IHVwO1xuICBvbihkb2N1bWVudCwgXCJtb3VzZW1vdmVcIiwgbW92ZSk7XG4gIG9uKGRvY3VtZW50LCBcIm1vdXNldXBcIiwgdXApO1xufVxuXG4vLyBVc2VkIHdoZW4gbW91c2Utc2VsZWN0aW5nIHRvIGFkanVzdCB0aGUgYW5jaG9yIHRvIHRoZSBwcm9wZXIgc2lkZVxuLy8gb2YgYSBiaWRpIGp1bXAgZGVwZW5kaW5nIG9uIHRoZSB2aXN1YWwgcG9zaXRpb24gb2YgdGhlIGhlYWQuXG5mdW5jdGlvbiBiaWRpU2ltcGxpZnkoY20sIHJhbmdlJCQxKSB7XG4gIHZhciBhbmNob3IgPSByYW5nZSQkMS5hbmNob3I7XG4gIHZhciBoZWFkID0gcmFuZ2UkJDEuaGVhZDtcbiAgdmFyIGFuY2hvckxpbmUgPSBnZXRMaW5lKGNtLmRvYywgYW5jaG9yLmxpbmUpO1xuICBpZiAoY21wKGFuY2hvciwgaGVhZCkgPT0gMCAmJiBhbmNob3Iuc3RpY2t5ID09IGhlYWQuc3RpY2t5KSB7IHJldHVybiByYW5nZSQkMSB9XG4gIHZhciBvcmRlciA9IGdldE9yZGVyKGFuY2hvckxpbmUpO1xuICBpZiAoIW9yZGVyKSB7IHJldHVybiByYW5nZSQkMSB9XG4gIHZhciBpbmRleCA9IGdldEJpZGlQYXJ0QXQob3JkZXIsIGFuY2hvci5jaCwgYW5jaG9yLnN0aWNreSksIHBhcnQgPSBvcmRlcltpbmRleF07XG4gIGlmIChwYXJ0LmZyb20gIT0gYW5jaG9yLmNoICYmIHBhcnQudG8gIT0gYW5jaG9yLmNoKSB7IHJldHVybiByYW5nZSQkMSB9XG4gIHZhciBib3VuZGFyeSA9IGluZGV4ICsgKChwYXJ0LmZyb20gPT0gYW5jaG9yLmNoKSA9PSAocGFydC5sZXZlbCAhPSAxKSA/IDAgOiAxKTtcbiAgaWYgKGJvdW5kYXJ5ID09IDAgfHwgYm91bmRhcnkgPT0gb3JkZXIubGVuZ3RoKSB7IHJldHVybiByYW5nZSQkMSB9XG5cbiAgLy8gQ29tcHV0ZSB0aGUgcmVsYXRpdmUgdmlzdWFsIHBvc2l0aW9uIG9mIHRoZSBoZWFkIGNvbXBhcmVkIHRvIHRoZVxuICAvLyBhbmNob3IgKDwwIGlzIHRvIHRoZSBsZWZ0LCA+MCB0byB0aGUgcmlnaHQpXG4gIHZhciBsZWZ0U2lkZTtcbiAgaWYgKGhlYWQubGluZSAhPSBhbmNob3IubGluZSkge1xuICAgIGxlZnRTaWRlID0gKGhlYWQubGluZSAtIGFuY2hvci5saW5lKSAqIChjbS5kb2MuZGlyZWN0aW9uID09IFwibHRyXCIgPyAxIDogLTEpID4gMDtcbiAgfSBlbHNlIHtcbiAgICB2YXIgaGVhZEluZGV4ID0gZ2V0QmlkaVBhcnRBdChvcmRlciwgaGVhZC5jaCwgaGVhZC5zdGlja3kpO1xuICAgIHZhciBkaXIgPSBoZWFkSW5kZXggLSBpbmRleCB8fCAoaGVhZC5jaCAtIGFuY2hvci5jaCkgKiAocGFydC5sZXZlbCA9PSAxID8gLTEgOiAxKTtcbiAgICBpZiAoaGVhZEluZGV4ID09IGJvdW5kYXJ5IC0gMSB8fCBoZWFkSW5kZXggPT0gYm91bmRhcnkpXG4gICAgICB7IGxlZnRTaWRlID0gZGlyIDwgMDsgfVxuICAgIGVsc2VcbiAgICAgIHsgbGVmdFNpZGUgPSBkaXIgPiAwOyB9XG4gIH1cblxuICB2YXIgdXNlUGFydCA9IG9yZGVyW2JvdW5kYXJ5ICsgKGxlZnRTaWRlID8gLTEgOiAwKV07XG4gIHZhciBmcm9tID0gbGVmdFNpZGUgPT0gKHVzZVBhcnQubGV2ZWwgPT0gMSk7XG4gIHZhciBjaCA9IGZyb20gPyB1c2VQYXJ0LmZyb20gOiB1c2VQYXJ0LnRvLCBzdGlja3kgPSBmcm9tID8gXCJhZnRlclwiIDogXCJiZWZvcmVcIjtcbiAgcmV0dXJuIGFuY2hvci5jaCA9PSBjaCAmJiBhbmNob3Iuc3RpY2t5ID09IHN0aWNreSA/IHJhbmdlJCQxIDogbmV3IFJhbmdlKG5ldyBQb3MoYW5jaG9yLmxpbmUsIGNoLCBzdGlja3kpLCBoZWFkKVxufVxuXG5cbi8vIERldGVybWluZXMgd2hldGhlciBhbiBldmVudCBoYXBwZW5lZCBpbiB0aGUgZ3V0dGVyLCBhbmQgZmlyZXMgdGhlXG4vLyBoYW5kbGVycyBmb3IgdGhlIGNvcnJlc3BvbmRpbmcgZXZlbnQuXG5mdW5jdGlvbiBndXR0ZXJFdmVudChjbSwgZSwgdHlwZSwgcHJldmVudCkge1xuICB2YXIgbVgsIG1ZO1xuICBpZiAoZS50b3VjaGVzKSB7XG4gICAgbVggPSBlLnRvdWNoZXNbMF0uY2xpZW50WDtcbiAgICBtWSA9IGUudG91Y2hlc1swXS5jbGllbnRZO1xuICB9IGVsc2Uge1xuICAgIHRyeSB7IG1YID0gZS5jbGllbnRYOyBtWSA9IGUuY2xpZW50WTsgfVxuICAgIGNhdGNoKGUpIHsgcmV0dXJuIGZhbHNlIH1cbiAgfVxuICBpZiAobVggPj0gTWF0aC5mbG9vcihjbS5kaXNwbGF5Lmd1dHRlcnMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkucmlnaHQpKSB7IHJldHVybiBmYWxzZSB9XG4gIGlmIChwcmV2ZW50KSB7IGVfcHJldmVudERlZmF1bHQoZSk7IH1cblxuICB2YXIgZGlzcGxheSA9IGNtLmRpc3BsYXk7XG4gIHZhciBsaW5lQm94ID0gZGlzcGxheS5saW5lRGl2LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gIGlmIChtWSA+IGxpbmVCb3guYm90dG9tIHx8ICFoYXNIYW5kbGVyKGNtLCB0eXBlKSkgeyByZXR1cm4gZV9kZWZhdWx0UHJldmVudGVkKGUpIH1cbiAgbVkgLT0gbGluZUJveC50b3AgLSBkaXNwbGF5LnZpZXdPZmZzZXQ7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBjbS5vcHRpb25zLmd1dHRlcnMubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgZyA9IGRpc3BsYXkuZ3V0dGVycy5jaGlsZE5vZGVzW2ldO1xuICAgIGlmIChnICYmIGcuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkucmlnaHQgPj0gbVgpIHtcbiAgICAgIHZhciBsaW5lID0gbGluZUF0SGVpZ2h0KGNtLmRvYywgbVkpO1xuICAgICAgdmFyIGd1dHRlciA9IGNtLm9wdGlvbnMuZ3V0dGVyc1tpXTtcbiAgICAgIHNpZ25hbChjbSwgdHlwZSwgY20sIGxpbmUsIGd1dHRlciwgZSk7XG4gICAgICByZXR1cm4gZV9kZWZhdWx0UHJldmVudGVkKGUpXG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGNsaWNrSW5HdXR0ZXIoY20sIGUpIHtcbiAgcmV0dXJuIGd1dHRlckV2ZW50KGNtLCBlLCBcImd1dHRlckNsaWNrXCIsIHRydWUpXG59XG5cbi8vIENPTlRFWFQgTUVOVSBIQU5ETElOR1xuXG4vLyBUbyBtYWtlIHRoZSBjb250ZXh0IG1lbnUgd29yaywgd2UgbmVlZCB0byBicmllZmx5IHVuaGlkZSB0aGVcbi8vIHRleHRhcmVhIChtYWtpbmcgaXQgYXMgdW5vYnRydXNpdmUgYXMgcG9zc2libGUpIHRvIGxldCB0aGVcbi8vIHJpZ2h0LWNsaWNrIHRha2UgZWZmZWN0IG9uIGl0LlxuZnVuY3Rpb24gb25Db250ZXh0TWVudShjbSwgZSkge1xuICBpZiAoZXZlbnRJbldpZGdldChjbS5kaXNwbGF5LCBlKSB8fCBjb250ZXh0TWVudUluR3V0dGVyKGNtLCBlKSkgeyByZXR1cm4gfVxuICBpZiAoc2lnbmFsRE9NRXZlbnQoY20sIGUsIFwiY29udGV4dG1lbnVcIikpIHsgcmV0dXJuIH1cbiAgY20uZGlzcGxheS5pbnB1dC5vbkNvbnRleHRNZW51KGUpO1xufVxuXG5mdW5jdGlvbiBjb250ZXh0TWVudUluR3V0dGVyKGNtLCBlKSB7XG4gIGlmICghaGFzSGFuZGxlcihjbSwgXCJndXR0ZXJDb250ZXh0TWVudVwiKSkgeyByZXR1cm4gZmFsc2UgfVxuICByZXR1cm4gZ3V0dGVyRXZlbnQoY20sIGUsIFwiZ3V0dGVyQ29udGV4dE1lbnVcIiwgZmFsc2UpXG59XG5cbmZ1bmN0aW9uIHRoZW1lQ2hhbmdlZChjbSkge1xuICBjbS5kaXNwbGF5LndyYXBwZXIuY2xhc3NOYW1lID0gY20uZGlzcGxheS53cmFwcGVyLmNsYXNzTmFtZS5yZXBsYWNlKC9cXHMqY20tcy1cXFMrL2csIFwiXCIpICtcbiAgICBjbS5vcHRpb25zLnRoZW1lLnJlcGxhY2UoLyhefFxccylcXHMqL2csIFwiIGNtLXMtXCIpO1xuICBjbGVhckNhY2hlcyhjbSk7XG59XG5cbnZhciBJbml0ID0ge3RvU3RyaW5nOiBmdW5jdGlvbigpe3JldHVybiBcIkNvZGVNaXJyb3IuSW5pdFwifX07XG5cbnZhciBkZWZhdWx0cyA9IHt9O1xudmFyIG9wdGlvbkhhbmRsZXJzID0ge307XG5cbmZ1bmN0aW9uIGRlZmluZU9wdGlvbnMoQ29kZU1pcnJvcikge1xuICB2YXIgb3B0aW9uSGFuZGxlcnMgPSBDb2RlTWlycm9yLm9wdGlvbkhhbmRsZXJzO1xuXG4gIGZ1bmN0aW9uIG9wdGlvbihuYW1lLCBkZWZsdCwgaGFuZGxlLCBub3RPbkluaXQpIHtcbiAgICBDb2RlTWlycm9yLmRlZmF1bHRzW25hbWVdID0gZGVmbHQ7XG4gICAgaWYgKGhhbmRsZSkgeyBvcHRpb25IYW5kbGVyc1tuYW1lXSA9XG4gICAgICBub3RPbkluaXQgPyBmdW5jdGlvbiAoY20sIHZhbCwgb2xkKSB7aWYgKG9sZCAhPSBJbml0KSB7IGhhbmRsZShjbSwgdmFsLCBvbGQpOyB9fSA6IGhhbmRsZTsgfVxuICB9XG5cbiAgQ29kZU1pcnJvci5kZWZpbmVPcHRpb24gPSBvcHRpb247XG5cbiAgLy8gUGFzc2VkIHRvIG9wdGlvbiBoYW5kbGVycyB3aGVuIHRoZXJlIGlzIG5vIG9sZCB2YWx1ZS5cbiAgQ29kZU1pcnJvci5Jbml0ID0gSW5pdDtcblxuICAvLyBUaGVzZSB0d28gYXJlLCBvbiBpbml0LCBjYWxsZWQgZnJvbSB0aGUgY29uc3RydWN0b3IgYmVjYXVzZSB0aGV5XG4gIC8vIGhhdmUgdG8gYmUgaW5pdGlhbGl6ZWQgYmVmb3JlIHRoZSBlZGl0b3IgY2FuIHN0YXJ0IGF0IGFsbC5cbiAgb3B0aW9uKFwidmFsdWVcIiwgXCJcIiwgZnVuY3Rpb24gKGNtLCB2YWwpIHsgcmV0dXJuIGNtLnNldFZhbHVlKHZhbCk7IH0sIHRydWUpO1xuICBvcHRpb24oXCJtb2RlXCIsIG51bGwsIGZ1bmN0aW9uIChjbSwgdmFsKSB7XG4gICAgY20uZG9jLm1vZGVPcHRpb24gPSB2YWw7XG4gICAgbG9hZE1vZGUoY20pO1xuICB9LCB0cnVlKTtcblxuICBvcHRpb24oXCJpbmRlbnRVbml0XCIsIDIsIGxvYWRNb2RlLCB0cnVlKTtcbiAgb3B0aW9uKFwiaW5kZW50V2l0aFRhYnNcIiwgZmFsc2UpO1xuICBvcHRpb24oXCJzbWFydEluZGVudFwiLCB0cnVlKTtcbiAgb3B0aW9uKFwidGFiU2l6ZVwiLCA0LCBmdW5jdGlvbiAoY20pIHtcbiAgICByZXNldE1vZGVTdGF0ZShjbSk7XG4gICAgY2xlYXJDYWNoZXMoY20pO1xuICAgIHJlZ0NoYW5nZShjbSk7XG4gIH0sIHRydWUpO1xuXG4gIG9wdGlvbihcImxpbmVTZXBhcmF0b3JcIiwgbnVsbCwgZnVuY3Rpb24gKGNtLCB2YWwpIHtcbiAgICBjbS5kb2MubGluZVNlcCA9IHZhbDtcbiAgICBpZiAoIXZhbCkgeyByZXR1cm4gfVxuICAgIHZhciBuZXdCcmVha3MgPSBbXSwgbGluZU5vID0gY20uZG9jLmZpcnN0O1xuICAgIGNtLmRvYy5pdGVyKGZ1bmN0aW9uIChsaW5lKSB7XG4gICAgICBmb3IgKHZhciBwb3MgPSAwOzspIHtcbiAgICAgICAgdmFyIGZvdW5kID0gbGluZS50ZXh0LmluZGV4T2YodmFsLCBwb3MpO1xuICAgICAgICBpZiAoZm91bmQgPT0gLTEpIHsgYnJlYWsgfVxuICAgICAgICBwb3MgPSBmb3VuZCArIHZhbC5sZW5ndGg7XG4gICAgICAgIG5ld0JyZWFrcy5wdXNoKFBvcyhsaW5lTm8sIGZvdW5kKSk7XG4gICAgICB9XG4gICAgICBsaW5lTm8rKztcbiAgICB9KTtcbiAgICBmb3IgKHZhciBpID0gbmV3QnJlYWtzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKVxuICAgICAgeyByZXBsYWNlUmFuZ2UoY20uZG9jLCB2YWwsIG5ld0JyZWFrc1tpXSwgUG9zKG5ld0JyZWFrc1tpXS5saW5lLCBuZXdCcmVha3NbaV0uY2ggKyB2YWwubGVuZ3RoKSk7IH1cbiAgfSk7XG4gIG9wdGlvbihcInNwZWNpYWxDaGFyc1wiLCAvW1xcdTAwMDAtXFx1MDAxZlxcdTAwN2YtXFx1MDA5ZlxcdTAwYWRcXHUwNjFjXFx1MjAwYi1cXHUyMDBmXFx1MjAyOFxcdTIwMjlcXHVmZWZmXS9nLCBmdW5jdGlvbiAoY20sIHZhbCwgb2xkKSB7XG4gICAgY20uc3RhdGUuc3BlY2lhbENoYXJzID0gbmV3IFJlZ0V4cCh2YWwuc291cmNlICsgKHZhbC50ZXN0KFwiXFx0XCIpID8gXCJcIiA6IFwifFxcdFwiKSwgXCJnXCIpO1xuICAgIGlmIChvbGQgIT0gSW5pdCkgeyBjbS5yZWZyZXNoKCk7IH1cbiAgfSk7XG4gIG9wdGlvbihcInNwZWNpYWxDaGFyUGxhY2Vob2xkZXJcIiwgZGVmYXVsdFNwZWNpYWxDaGFyUGxhY2Vob2xkZXIsIGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20ucmVmcmVzaCgpOyB9LCB0cnVlKTtcbiAgb3B0aW9uKFwiZWxlY3RyaWNDaGFyc1wiLCB0cnVlKTtcbiAgb3B0aW9uKFwiaW5wdXRTdHlsZVwiLCBtb2JpbGUgPyBcImNvbnRlbnRlZGl0YWJsZVwiIDogXCJ0ZXh0YXJlYVwiLCBmdW5jdGlvbiAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiaW5wdXRTdHlsZSBjYW4gbm90ICh5ZXQpIGJlIGNoYW5nZWQgaW4gYSBydW5uaW5nIGVkaXRvclwiKSAvLyBGSVhNRVxuICB9LCB0cnVlKTtcbiAgb3B0aW9uKFwic3BlbGxjaGVja1wiLCBmYWxzZSwgZnVuY3Rpb24gKGNtLCB2YWwpIHsgcmV0dXJuIGNtLmdldElucHV0RmllbGQoKS5zcGVsbGNoZWNrID0gdmFsOyB9LCB0cnVlKTtcbiAgb3B0aW9uKFwicnRsTW92ZVZpc3VhbGx5XCIsICF3aW5kb3dzKTtcbiAgb3B0aW9uKFwid2hvbGVMaW5lVXBkYXRlQmVmb3JlXCIsIHRydWUpO1xuXG4gIG9wdGlvbihcInRoZW1lXCIsIFwiZGVmYXVsdFwiLCBmdW5jdGlvbiAoY20pIHtcbiAgICB0aGVtZUNoYW5nZWQoY20pO1xuICAgIGd1dHRlcnNDaGFuZ2VkKGNtKTtcbiAgfSwgdHJ1ZSk7XG4gIG9wdGlvbihcImtleU1hcFwiLCBcImRlZmF1bHRcIiwgZnVuY3Rpb24gKGNtLCB2YWwsIG9sZCkge1xuICAgIHZhciBuZXh0ID0gZ2V0S2V5TWFwKHZhbCk7XG4gICAgdmFyIHByZXYgPSBvbGQgIT0gSW5pdCAmJiBnZXRLZXlNYXAob2xkKTtcbiAgICBpZiAocHJldiAmJiBwcmV2LmRldGFjaCkgeyBwcmV2LmRldGFjaChjbSwgbmV4dCk7IH1cbiAgICBpZiAobmV4dC5hdHRhY2gpIHsgbmV4dC5hdHRhY2goY20sIHByZXYgfHwgbnVsbCk7IH1cbiAgfSk7XG4gIG9wdGlvbihcImV4dHJhS2V5c1wiLCBudWxsKTtcbiAgb3B0aW9uKFwiY29uZmlndXJlTW91c2VcIiwgbnVsbCk7XG5cbiAgb3B0aW9uKFwibGluZVdyYXBwaW5nXCIsIGZhbHNlLCB3cmFwcGluZ0NoYW5nZWQsIHRydWUpO1xuICBvcHRpb24oXCJndXR0ZXJzXCIsIFtdLCBmdW5jdGlvbiAoY20pIHtcbiAgICBzZXRHdXR0ZXJzRm9yTGluZU51bWJlcnMoY20ub3B0aW9ucyk7XG4gICAgZ3V0dGVyc0NoYW5nZWQoY20pO1xuICB9LCB0cnVlKTtcbiAgb3B0aW9uKFwiZml4ZWRHdXR0ZXJcIiwgdHJ1ZSwgZnVuY3Rpb24gKGNtLCB2YWwpIHtcbiAgICBjbS5kaXNwbGF5Lmd1dHRlcnMuc3R5bGUubGVmdCA9IHZhbCA/IGNvbXBlbnNhdGVGb3JIU2Nyb2xsKGNtLmRpc3BsYXkpICsgXCJweFwiIDogXCIwXCI7XG4gICAgY20ucmVmcmVzaCgpO1xuICB9LCB0cnVlKTtcbiAgb3B0aW9uKFwiY292ZXJHdXR0ZXJOZXh0VG9TY3JvbGxiYXJcIiwgZmFsc2UsIGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gdXBkYXRlU2Nyb2xsYmFycyhjbSk7IH0sIHRydWUpO1xuICBvcHRpb24oXCJzY3JvbGxiYXJTdHlsZVwiLCBcIm5hdGl2ZVwiLCBmdW5jdGlvbiAoY20pIHtcbiAgICBpbml0U2Nyb2xsYmFycyhjbSk7XG4gICAgdXBkYXRlU2Nyb2xsYmFycyhjbSk7XG4gICAgY20uZGlzcGxheS5zY3JvbGxiYXJzLnNldFNjcm9sbFRvcChjbS5kb2Muc2Nyb2xsVG9wKTtcbiAgICBjbS5kaXNwbGF5LnNjcm9sbGJhcnMuc2V0U2Nyb2xsTGVmdChjbS5kb2Muc2Nyb2xsTGVmdCk7XG4gIH0sIHRydWUpO1xuICBvcHRpb24oXCJsaW5lTnVtYmVyc1wiLCBmYWxzZSwgZnVuY3Rpb24gKGNtKSB7XG4gICAgc2V0R3V0dGVyc0ZvckxpbmVOdW1iZXJzKGNtLm9wdGlvbnMpO1xuICAgIGd1dHRlcnNDaGFuZ2VkKGNtKTtcbiAgfSwgdHJ1ZSk7XG4gIG9wdGlvbihcImZpcnN0TGluZU51bWJlclwiLCAxLCBndXR0ZXJzQ2hhbmdlZCwgdHJ1ZSk7XG4gIG9wdGlvbihcImxpbmVOdW1iZXJGb3JtYXR0ZXJcIiwgZnVuY3Rpb24gKGludGVnZXIpIHsgcmV0dXJuIGludGVnZXI7IH0sIGd1dHRlcnNDaGFuZ2VkLCB0cnVlKTtcbiAgb3B0aW9uKFwic2hvd0N1cnNvcldoZW5TZWxlY3RpbmdcIiwgZmFsc2UsIHVwZGF0ZVNlbGVjdGlvbiwgdHJ1ZSk7XG5cbiAgb3B0aW9uKFwicmVzZXRTZWxlY3Rpb25PbkNvbnRleHRNZW51XCIsIHRydWUpO1xuICBvcHRpb24oXCJsaW5lV2lzZUNvcHlDdXRcIiwgdHJ1ZSk7XG4gIG9wdGlvbihcInBhc3RlTGluZXNQZXJTZWxlY3Rpb25cIiwgdHJ1ZSk7XG5cbiAgb3B0aW9uKFwicmVhZE9ubHlcIiwgZmFsc2UsIGZ1bmN0aW9uIChjbSwgdmFsKSB7XG4gICAgaWYgKHZhbCA9PSBcIm5vY3Vyc29yXCIpIHtcbiAgICAgIG9uQmx1cihjbSk7XG4gICAgICBjbS5kaXNwbGF5LmlucHV0LmJsdXIoKTtcbiAgICB9XG4gICAgY20uZGlzcGxheS5pbnB1dC5yZWFkT25seUNoYW5nZWQodmFsKTtcbiAgfSk7XG4gIG9wdGlvbihcImRpc2FibGVJbnB1dFwiLCBmYWxzZSwgZnVuY3Rpb24gKGNtLCB2YWwpIHtpZiAoIXZhbCkgeyBjbS5kaXNwbGF5LmlucHV0LnJlc2V0KCk7IH19LCB0cnVlKTtcbiAgb3B0aW9uKFwiZHJhZ0Ryb3BcIiwgdHJ1ZSwgZHJhZ0Ryb3BDaGFuZ2VkKTtcbiAgb3B0aW9uKFwiYWxsb3dEcm9wRmlsZVR5cGVzXCIsIG51bGwpO1xuXG4gIG9wdGlvbihcImN1cnNvckJsaW5rUmF0ZVwiLCA1MzApO1xuICBvcHRpb24oXCJjdXJzb3JTY3JvbGxNYXJnaW5cIiwgMCk7XG4gIG9wdGlvbihcImN1cnNvckhlaWdodFwiLCAxLCB1cGRhdGVTZWxlY3Rpb24sIHRydWUpO1xuICBvcHRpb24oXCJzaW5nbGVDdXJzb3JIZWlnaHRQZXJMaW5lXCIsIHRydWUsIHVwZGF0ZVNlbGVjdGlvbiwgdHJ1ZSk7XG4gIG9wdGlvbihcIndvcmtUaW1lXCIsIDEwMCk7XG4gIG9wdGlvbihcIndvcmtEZWxheVwiLCAxMDApO1xuICBvcHRpb24oXCJmbGF0dGVuU3BhbnNcIiwgdHJ1ZSwgcmVzZXRNb2RlU3RhdGUsIHRydWUpO1xuICBvcHRpb24oXCJhZGRNb2RlQ2xhc3NcIiwgZmFsc2UsIHJlc2V0TW9kZVN0YXRlLCB0cnVlKTtcbiAgb3B0aW9uKFwicG9sbEludGVydmFsXCIsIDEwMCk7XG4gIG9wdGlvbihcInVuZG9EZXB0aFwiLCAyMDAsIGZ1bmN0aW9uIChjbSwgdmFsKSB7IHJldHVybiBjbS5kb2MuaGlzdG9yeS51bmRvRGVwdGggPSB2YWw7IH0pO1xuICBvcHRpb24oXCJoaXN0b3J5RXZlbnREZWxheVwiLCAxMjUwKTtcbiAgb3B0aW9uKFwidmlld3BvcnRNYXJnaW5cIiwgMTAsIGZ1bmN0aW9uIChjbSkgeyByZXR1cm4gY20ucmVmcmVzaCgpOyB9LCB0cnVlKTtcbiAgb3B0aW9uKFwibWF4SGlnaGxpZ2h0TGVuZ3RoXCIsIDEwMDAwLCByZXNldE1vZGVTdGF0ZSwgdHJ1ZSk7XG4gIG9wdGlvbihcIm1vdmVJbnB1dFdpdGhDdXJzb3JcIiwgdHJ1ZSwgZnVuY3Rpb24gKGNtLCB2YWwpIHtcbiAgICBpZiAoIXZhbCkgeyBjbS5kaXNwbGF5LmlucHV0LnJlc2V0UG9zaXRpb24oKTsgfVxuICB9KTtcblxuICBvcHRpb24oXCJ0YWJpbmRleFwiLCBudWxsLCBmdW5jdGlvbiAoY20sIHZhbCkgeyByZXR1cm4gY20uZGlzcGxheS5pbnB1dC5nZXRGaWVsZCgpLnRhYkluZGV4ID0gdmFsIHx8IFwiXCI7IH0pO1xuICBvcHRpb24oXCJhdXRvZm9jdXNcIiwgbnVsbCk7XG4gIG9wdGlvbihcImRpcmVjdGlvblwiLCBcImx0clwiLCBmdW5jdGlvbiAoY20sIHZhbCkgeyByZXR1cm4gY20uZG9jLnNldERpcmVjdGlvbih2YWwpOyB9LCB0cnVlKTtcbn1cblxuZnVuY3Rpb24gZ3V0dGVyc0NoYW5nZWQoY20pIHtcbiAgdXBkYXRlR3V0dGVycyhjbSk7XG4gIHJlZ0NoYW5nZShjbSk7XG4gIGFsaWduSG9yaXpvbnRhbGx5KGNtKTtcbn1cblxuZnVuY3Rpb24gZHJhZ0Ryb3BDaGFuZ2VkKGNtLCB2YWx1ZSwgb2xkKSB7XG4gIHZhciB3YXNPbiA9IG9sZCAmJiBvbGQgIT0gSW5pdDtcbiAgaWYgKCF2YWx1ZSAhPSAhd2FzT24pIHtcbiAgICB2YXIgZnVuY3MgPSBjbS5kaXNwbGF5LmRyYWdGdW5jdGlvbnM7XG4gICAgdmFyIHRvZ2dsZSA9IHZhbHVlID8gb24gOiBvZmY7XG4gICAgdG9nZ2xlKGNtLmRpc3BsYXkuc2Nyb2xsZXIsIFwiZHJhZ3N0YXJ0XCIsIGZ1bmNzLnN0YXJ0KTtcbiAgICB0b2dnbGUoY20uZGlzcGxheS5zY3JvbGxlciwgXCJkcmFnZW50ZXJcIiwgZnVuY3MuZW50ZXIpO1xuICAgIHRvZ2dsZShjbS5kaXNwbGF5LnNjcm9sbGVyLCBcImRyYWdvdmVyXCIsIGZ1bmNzLm92ZXIpO1xuICAgIHRvZ2dsZShjbS5kaXNwbGF5LnNjcm9sbGVyLCBcImRyYWdsZWF2ZVwiLCBmdW5jcy5sZWF2ZSk7XG4gICAgdG9nZ2xlKGNtLmRpc3BsYXkuc2Nyb2xsZXIsIFwiZHJvcFwiLCBmdW5jcy5kcm9wKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB3cmFwcGluZ0NoYW5nZWQoY20pIHtcbiAgaWYgKGNtLm9wdGlvbnMubGluZVdyYXBwaW5nKSB7XG4gICAgYWRkQ2xhc3MoY20uZGlzcGxheS53cmFwcGVyLCBcIkNvZGVNaXJyb3Itd3JhcFwiKTtcbiAgICBjbS5kaXNwbGF5LnNpemVyLnN0eWxlLm1pbldpZHRoID0gXCJcIjtcbiAgICBjbS5kaXNwbGF5LnNpemVyV2lkdGggPSBudWxsO1xuICB9IGVsc2Uge1xuICAgIHJtQ2xhc3MoY20uZGlzcGxheS53cmFwcGVyLCBcIkNvZGVNaXJyb3Itd3JhcFwiKTtcbiAgICBmaW5kTWF4TGluZShjbSk7XG4gIH1cbiAgZXN0aW1hdGVMaW5lSGVpZ2h0cyhjbSk7XG4gIHJlZ0NoYW5nZShjbSk7XG4gIGNsZWFyQ2FjaGVzKGNtKTtcbiAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7IHJldHVybiB1cGRhdGVTY3JvbGxiYXJzKGNtKTsgfSwgMTAwKTtcbn1cblxuLy8gQSBDb2RlTWlycm9yIGluc3RhbmNlIHJlcHJlc2VudHMgYW4gZWRpdG9yLiBUaGlzIGlzIHRoZSBvYmplY3Rcbi8vIHRoYXQgdXNlciBjb2RlIGlzIHVzdWFsbHkgZGVhbGluZyB3aXRoLlxuXG5mdW5jdGlvbiBDb2RlTWlycm9yJDEocGxhY2UsIG9wdGlvbnMpIHtcbiAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIENvZGVNaXJyb3IkMSkpIHsgcmV0dXJuIG5ldyBDb2RlTWlycm9yJDEocGxhY2UsIG9wdGlvbnMpIH1cblxuICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zID0gb3B0aW9ucyA/IGNvcHlPYmoob3B0aW9ucykgOiB7fTtcbiAgLy8gRGV0ZXJtaW5lIGVmZmVjdGl2ZSBvcHRpb25zIGJhc2VkIG9uIGdpdmVuIHZhbHVlcyBhbmQgZGVmYXVsdHMuXG4gIGNvcHlPYmooZGVmYXVsdHMsIG9wdGlvbnMsIGZhbHNlKTtcbiAgc2V0R3V0dGVyc0ZvckxpbmVOdW1iZXJzKG9wdGlvbnMpO1xuXG4gIHZhciBkb2MgPSBvcHRpb25zLnZhbHVlO1xuICBpZiAodHlwZW9mIGRvYyA9PSBcInN0cmluZ1wiKSB7IGRvYyA9IG5ldyBEb2MoZG9jLCBvcHRpb25zLm1vZGUsIG51bGwsIG9wdGlvbnMubGluZVNlcGFyYXRvciwgb3B0aW9ucy5kaXJlY3Rpb24pOyB9XG4gIHRoaXMuZG9jID0gZG9jO1xuXG4gIHZhciBpbnB1dCA9IG5ldyBDb2RlTWlycm9yJDEuaW5wdXRTdHlsZXNbb3B0aW9ucy5pbnB1dFN0eWxlXSh0aGlzKTtcbiAgdmFyIGRpc3BsYXkgPSB0aGlzLmRpc3BsYXkgPSBuZXcgRGlzcGxheShwbGFjZSwgZG9jLCBpbnB1dCk7XG4gIGRpc3BsYXkud3JhcHBlci5Db2RlTWlycm9yID0gdGhpcztcbiAgdXBkYXRlR3V0dGVycyh0aGlzKTtcbiAgdGhlbWVDaGFuZ2VkKHRoaXMpO1xuICBpZiAob3B0aW9ucy5saW5lV3JhcHBpbmcpXG4gICAgeyB0aGlzLmRpc3BsYXkud3JhcHBlci5jbGFzc05hbWUgKz0gXCIgQ29kZU1pcnJvci13cmFwXCI7IH1cbiAgaW5pdFNjcm9sbGJhcnModGhpcyk7XG5cbiAgdGhpcy5zdGF0ZSA9IHtcbiAgICBrZXlNYXBzOiBbXSwgIC8vIHN0b3JlcyBtYXBzIGFkZGVkIGJ5IGFkZEtleU1hcFxuICAgIG92ZXJsYXlzOiBbXSwgLy8gaGlnaGxpZ2h0aW5nIG92ZXJsYXlzLCBhcyBhZGRlZCBieSBhZGRPdmVybGF5XG4gICAgbW9kZUdlbjogMCwgICAvLyBidW1wZWQgd2hlbiBtb2RlL292ZXJsYXkgY2hhbmdlcywgdXNlZCB0byBpbnZhbGlkYXRlIGhpZ2hsaWdodGluZyBpbmZvXG4gICAgb3ZlcndyaXRlOiBmYWxzZSxcbiAgICBkZWxheWluZ0JsdXJFdmVudDogZmFsc2UsXG4gICAgZm9jdXNlZDogZmFsc2UsXG4gICAgc3VwcHJlc3NFZGl0czogZmFsc2UsIC8vIHVzZWQgdG8gZGlzYWJsZSBlZGl0aW5nIGR1cmluZyBrZXkgaGFuZGxlcnMgd2hlbiBpbiByZWFkT25seSBtb2RlXG4gICAgcGFzdGVJbmNvbWluZzogZmFsc2UsIGN1dEluY29taW5nOiBmYWxzZSwgLy8gaGVscCByZWNvZ25pemUgcGFzdGUvY3V0IGVkaXRzIGluIGlucHV0LnBvbGxcbiAgICBzZWxlY3RpbmdUZXh0OiBmYWxzZSxcbiAgICBkcmFnZ2luZ1RleHQ6IGZhbHNlLFxuICAgIGhpZ2hsaWdodDogbmV3IERlbGF5ZWQoKSwgLy8gc3RvcmVzIGhpZ2hsaWdodCB3b3JrZXIgdGltZW91dFxuICAgIGtleVNlcTogbnVsbCwgIC8vIFVuZmluaXNoZWQga2V5IHNlcXVlbmNlXG4gICAgc3BlY2lhbENoYXJzOiBudWxsXG4gIH07XG5cbiAgaWYgKG9wdGlvbnMuYXV0b2ZvY3VzICYmICFtb2JpbGUpIHsgZGlzcGxheS5pbnB1dC5mb2N1cygpOyB9XG5cbiAgLy8gT3ZlcnJpZGUgbWFnaWMgdGV4dGFyZWEgY29udGVudCByZXN0b3JlIHRoYXQgSUUgc29tZXRpbWVzIGRvZXNcbiAgLy8gb24gb3VyIGhpZGRlbiB0ZXh0YXJlYSBvbiByZWxvYWRcbiAgaWYgKGllICYmIGllX3ZlcnNpb24gPCAxMSkgeyBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXMkMS5kaXNwbGF5LmlucHV0LnJlc2V0KHRydWUpOyB9LCAyMCk7IH1cblxuICByZWdpc3RlckV2ZW50SGFuZGxlcnModGhpcyk7XG4gIGVuc3VyZUdsb2JhbEhhbmRsZXJzKCk7XG5cbiAgc3RhcnRPcGVyYXRpb24odGhpcyk7XG4gIHRoaXMuY3VyT3AuZm9yY2VVcGRhdGUgPSB0cnVlO1xuICBhdHRhY2hEb2ModGhpcywgZG9jKTtcblxuICBpZiAoKG9wdGlvbnMuYXV0b2ZvY3VzICYmICFtb2JpbGUpIHx8IHRoaXMuaGFzRm9jdXMoKSlcbiAgICB7IHNldFRpbWVvdXQoYmluZChvbkZvY3VzLCB0aGlzKSwgMjApOyB9XG4gIGVsc2VcbiAgICB7IG9uQmx1cih0aGlzKTsgfVxuXG4gIGZvciAodmFyIG9wdCBpbiBvcHRpb25IYW5kbGVycykgeyBpZiAob3B0aW9uSGFuZGxlcnMuaGFzT3duUHJvcGVydHkob3B0KSlcbiAgICB7IG9wdGlvbkhhbmRsZXJzW29wdF0odGhpcyQxLCBvcHRpb25zW29wdF0sIEluaXQpOyB9IH1cbiAgbWF5YmVVcGRhdGVMaW5lTnVtYmVyV2lkdGgodGhpcyk7XG4gIGlmIChvcHRpb25zLmZpbmlzaEluaXQpIHsgb3B0aW9ucy5maW5pc2hJbml0KHRoaXMpOyB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgaW5pdEhvb2tzLmxlbmd0aDsgKytpKSB7IGluaXRIb29rc1tpXSh0aGlzJDEpOyB9XG4gIGVuZE9wZXJhdGlvbih0aGlzKTtcbiAgLy8gU3VwcHJlc3Mgb3B0aW1pemVsZWdpYmlsaXR5IGluIFdlYmtpdCwgc2luY2UgaXQgYnJlYWtzIHRleHRcbiAgLy8gbWVhc3VyaW5nIG9uIGxpbmUgd3JhcHBpbmcgYm91bmRhcmllcy5cbiAgaWYgKHdlYmtpdCAmJiBvcHRpb25zLmxpbmVXcmFwcGluZyAmJlxuICAgICAgZ2V0Q29tcHV0ZWRTdHlsZShkaXNwbGF5LmxpbmVEaXYpLnRleHRSZW5kZXJpbmcgPT0gXCJvcHRpbWl6ZWxlZ2liaWxpdHlcIilcbiAgICB7IGRpc3BsYXkubGluZURpdi5zdHlsZS50ZXh0UmVuZGVyaW5nID0gXCJhdXRvXCI7IH1cbn1cblxuLy8gVGhlIGRlZmF1bHQgY29uZmlndXJhdGlvbiBvcHRpb25zLlxuQ29kZU1pcnJvciQxLmRlZmF1bHRzID0gZGVmYXVsdHM7XG4vLyBGdW5jdGlvbnMgdG8gcnVuIHdoZW4gb3B0aW9ucyBhcmUgY2hhbmdlZC5cbkNvZGVNaXJyb3IkMS5vcHRpb25IYW5kbGVycyA9IG9wdGlvbkhhbmRsZXJzO1xuXG4vLyBBdHRhY2ggdGhlIG5lY2Vzc2FyeSBldmVudCBoYW5kbGVycyB3aGVuIGluaXRpYWxpemluZyB0aGUgZWRpdG9yXG5mdW5jdGlvbiByZWdpc3RlckV2ZW50SGFuZGxlcnMoY20pIHtcbiAgdmFyIGQgPSBjbS5kaXNwbGF5O1xuICBvbihkLnNjcm9sbGVyLCBcIm1vdXNlZG93blwiLCBvcGVyYXRpb24oY20sIG9uTW91c2VEb3duKSk7XG4gIC8vIE9sZGVyIElFJ3Mgd2lsbCBub3QgZmlyZSBhIHNlY29uZCBtb3VzZWRvd24gZm9yIGEgZG91YmxlIGNsaWNrXG4gIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgMTEpXG4gICAgeyBvbihkLnNjcm9sbGVyLCBcImRibGNsaWNrXCIsIG9wZXJhdGlvbihjbSwgZnVuY3Rpb24gKGUpIHtcbiAgICAgIGlmIChzaWduYWxET01FdmVudChjbSwgZSkpIHsgcmV0dXJuIH1cbiAgICAgIHZhciBwb3MgPSBwb3NGcm9tTW91c2UoY20sIGUpO1xuICAgICAgaWYgKCFwb3MgfHwgY2xpY2tJbkd1dHRlcihjbSwgZSkgfHwgZXZlbnRJbldpZGdldChjbS5kaXNwbGF5LCBlKSkgeyByZXR1cm4gfVxuICAgICAgZV9wcmV2ZW50RGVmYXVsdChlKTtcbiAgICAgIHZhciB3b3JkID0gY20uZmluZFdvcmRBdChwb3MpO1xuICAgICAgZXh0ZW5kU2VsZWN0aW9uKGNtLmRvYywgd29yZC5hbmNob3IsIHdvcmQuaGVhZCk7XG4gICAgfSkpOyB9XG4gIGVsc2VcbiAgICB7IG9uKGQuc2Nyb2xsZXIsIFwiZGJsY2xpY2tcIiwgZnVuY3Rpb24gKGUpIHsgcmV0dXJuIHNpZ25hbERPTUV2ZW50KGNtLCBlKSB8fCBlX3ByZXZlbnREZWZhdWx0KGUpOyB9KTsgfVxuICAvLyBTb21lIGJyb3dzZXJzIGZpcmUgY29udGV4dG1lbnUgKmFmdGVyKiBvcGVuaW5nIHRoZSBtZW51LCBhdFxuICAvLyB3aGljaCBwb2ludCB3ZSBjYW4ndCBtZXNzIHdpdGggaXQgYW55bW9yZS4gQ29udGV4dCBtZW51IGlzXG4gIC8vIGhhbmRsZWQgaW4gb25Nb3VzZURvd24gZm9yIHRoZXNlIGJyb3dzZXJzLlxuICBpZiAoIWNhcHR1cmVSaWdodENsaWNrKSB7IG9uKGQuc2Nyb2xsZXIsIFwiY29udGV4dG1lbnVcIiwgZnVuY3Rpb24gKGUpIHsgcmV0dXJuIG9uQ29udGV4dE1lbnUoY20sIGUpOyB9KTsgfVxuXG4gIC8vIFVzZWQgdG8gc3VwcHJlc3MgbW91c2UgZXZlbnQgaGFuZGxpbmcgd2hlbiBhIHRvdWNoIGhhcHBlbnNcbiAgdmFyIHRvdWNoRmluaXNoZWQsIHByZXZUb3VjaCA9IHtlbmQ6IDB9O1xuICBmdW5jdGlvbiBmaW5pc2hUb3VjaCgpIHtcbiAgICBpZiAoZC5hY3RpdmVUb3VjaCkge1xuICAgICAgdG91Y2hGaW5pc2hlZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkgeyByZXR1cm4gZC5hY3RpdmVUb3VjaCA9IG51bGw7IH0sIDEwMDApO1xuICAgICAgcHJldlRvdWNoID0gZC5hY3RpdmVUb3VjaDtcbiAgICAgIHByZXZUb3VjaC5lbmQgPSArbmV3IERhdGU7XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIGlzTW91c2VMaWtlVG91Y2hFdmVudChlKSB7XG4gICAgaWYgKGUudG91Y2hlcy5sZW5ndGggIT0gMSkgeyByZXR1cm4gZmFsc2UgfVxuICAgIHZhciB0b3VjaCA9IGUudG91Y2hlc1swXTtcbiAgICByZXR1cm4gdG91Y2gucmFkaXVzWCA8PSAxICYmIHRvdWNoLnJhZGl1c1kgPD0gMVxuICB9XG4gIGZ1bmN0aW9uIGZhckF3YXkodG91Y2gsIG90aGVyKSB7XG4gICAgaWYgKG90aGVyLmxlZnQgPT0gbnVsbCkgeyByZXR1cm4gdHJ1ZSB9XG4gICAgdmFyIGR4ID0gb3RoZXIubGVmdCAtIHRvdWNoLmxlZnQsIGR5ID0gb3RoZXIudG9wIC0gdG91Y2gudG9wO1xuICAgIHJldHVybiBkeCAqIGR4ICsgZHkgKiBkeSA+IDIwICogMjBcbiAgfVxuICBvbihkLnNjcm9sbGVyLCBcInRvdWNoc3RhcnRcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICBpZiAoIXNpZ25hbERPTUV2ZW50KGNtLCBlKSAmJiAhaXNNb3VzZUxpa2VUb3VjaEV2ZW50KGUpICYmICFjbGlja0luR3V0dGVyKGNtLCBlKSkge1xuICAgICAgZC5pbnB1dC5lbnN1cmVQb2xsZWQoKTtcbiAgICAgIGNsZWFyVGltZW91dCh0b3VjaEZpbmlzaGVkKTtcbiAgICAgIHZhciBub3cgPSArbmV3IERhdGU7XG4gICAgICBkLmFjdGl2ZVRvdWNoID0ge3N0YXJ0OiBub3csIG1vdmVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgcHJldjogbm93IC0gcHJldlRvdWNoLmVuZCA8PSAzMDAgPyBwcmV2VG91Y2ggOiBudWxsfTtcbiAgICAgIGlmIChlLnRvdWNoZXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgZC5hY3RpdmVUb3VjaC5sZWZ0ID0gZS50b3VjaGVzWzBdLnBhZ2VYO1xuICAgICAgICBkLmFjdGl2ZVRvdWNoLnRvcCA9IGUudG91Y2hlc1swXS5wYWdlWTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuICBvbihkLnNjcm9sbGVyLCBcInRvdWNobW92ZVwiLCBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKGQuYWN0aXZlVG91Y2gpIHsgZC5hY3RpdmVUb3VjaC5tb3ZlZCA9IHRydWU7IH1cbiAgfSk7XG4gIG9uKGQuc2Nyb2xsZXIsIFwidG91Y2hlbmRcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICB2YXIgdG91Y2ggPSBkLmFjdGl2ZVRvdWNoO1xuICAgIGlmICh0b3VjaCAmJiAhZXZlbnRJbldpZGdldChkLCBlKSAmJiB0b3VjaC5sZWZ0ICE9IG51bGwgJiZcbiAgICAgICAgIXRvdWNoLm1vdmVkICYmIG5ldyBEYXRlIC0gdG91Y2guc3RhcnQgPCAzMDApIHtcbiAgICAgIHZhciBwb3MgPSBjbS5jb29yZHNDaGFyKGQuYWN0aXZlVG91Y2gsIFwicGFnZVwiKSwgcmFuZ2U7XG4gICAgICBpZiAoIXRvdWNoLnByZXYgfHwgZmFyQXdheSh0b3VjaCwgdG91Y2gucHJldikpIC8vIFNpbmdsZSB0YXBcbiAgICAgICAgeyByYW5nZSA9IG5ldyBSYW5nZShwb3MsIHBvcyk7IH1cbiAgICAgIGVsc2UgaWYgKCF0b3VjaC5wcmV2LnByZXYgfHwgZmFyQXdheSh0b3VjaCwgdG91Y2gucHJldi5wcmV2KSkgLy8gRG91YmxlIHRhcFxuICAgICAgICB7IHJhbmdlID0gY20uZmluZFdvcmRBdChwb3MpOyB9XG4gICAgICBlbHNlIC8vIFRyaXBsZSB0YXBcbiAgICAgICAgeyByYW5nZSA9IG5ldyBSYW5nZShQb3MocG9zLmxpbmUsIDApLCBjbGlwUG9zKGNtLmRvYywgUG9zKHBvcy5saW5lICsgMSwgMCkpKTsgfVxuICAgICAgY20uc2V0U2VsZWN0aW9uKHJhbmdlLmFuY2hvciwgcmFuZ2UuaGVhZCk7XG4gICAgICBjbS5mb2N1cygpO1xuICAgICAgZV9wcmV2ZW50RGVmYXVsdChlKTtcbiAgICB9XG4gICAgZmluaXNoVG91Y2goKTtcbiAgfSk7XG4gIG9uKGQuc2Nyb2xsZXIsIFwidG91Y2hjYW5jZWxcIiwgZmluaXNoVG91Y2gpO1xuXG4gIC8vIFN5bmMgc2Nyb2xsaW5nIGJldHdlZW4gZmFrZSBzY3JvbGxiYXJzIGFuZCByZWFsIHNjcm9sbGFibGVcbiAgLy8gYXJlYSwgZW5zdXJlIHZpZXdwb3J0IGlzIHVwZGF0ZWQgd2hlbiBzY3JvbGxpbmcuXG4gIG9uKGQuc2Nyb2xsZXIsIFwic2Nyb2xsXCIsIGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoZC5zY3JvbGxlci5jbGllbnRIZWlnaHQpIHtcbiAgICAgIHVwZGF0ZVNjcm9sbFRvcChjbSwgZC5zY3JvbGxlci5zY3JvbGxUb3ApO1xuICAgICAgc2V0U2Nyb2xsTGVmdChjbSwgZC5zY3JvbGxlci5zY3JvbGxMZWZ0LCB0cnVlKTtcbiAgICAgIHNpZ25hbChjbSwgXCJzY3JvbGxcIiwgY20pO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gTGlzdGVuIHRvIHdoZWVsIGV2ZW50cyBpbiBvcmRlciB0byB0cnkgYW5kIHVwZGF0ZSB0aGUgdmlld3BvcnQgb24gdGltZS5cbiAgb24oZC5zY3JvbGxlciwgXCJtb3VzZXdoZWVsXCIsIGZ1bmN0aW9uIChlKSB7IHJldHVybiBvblNjcm9sbFdoZWVsKGNtLCBlKTsgfSk7XG4gIG9uKGQuc2Nyb2xsZXIsIFwiRE9NTW91c2VTY3JvbGxcIiwgZnVuY3Rpb24gKGUpIHsgcmV0dXJuIG9uU2Nyb2xsV2hlZWwoY20sIGUpOyB9KTtcblxuICAvLyBQcmV2ZW50IHdyYXBwZXIgZnJvbSBldmVyIHNjcm9sbGluZ1xuICBvbihkLndyYXBwZXIsIFwic2Nyb2xsXCIsIGZ1bmN0aW9uICgpIHsgcmV0dXJuIGQud3JhcHBlci5zY3JvbGxUb3AgPSBkLndyYXBwZXIuc2Nyb2xsTGVmdCA9IDA7IH0pO1xuXG4gIGQuZHJhZ0Z1bmN0aW9ucyA9IHtcbiAgICBlbnRlcjogZnVuY3Rpb24gKGUpIHtpZiAoIXNpZ25hbERPTUV2ZW50KGNtLCBlKSkgeyBlX3N0b3AoZSk7IH19LFxuICAgIG92ZXI6IGZ1bmN0aW9uIChlKSB7aWYgKCFzaWduYWxET01FdmVudChjbSwgZSkpIHsgb25EcmFnT3ZlcihjbSwgZSk7IGVfc3RvcChlKTsgfX0sXG4gICAgc3RhcnQ6IGZ1bmN0aW9uIChlKSB7IHJldHVybiBvbkRyYWdTdGFydChjbSwgZSk7IH0sXG4gICAgZHJvcDogb3BlcmF0aW9uKGNtLCBvbkRyb3ApLFxuICAgIGxlYXZlOiBmdW5jdGlvbiAoZSkge2lmICghc2lnbmFsRE9NRXZlbnQoY20sIGUpKSB7IGNsZWFyRHJhZ0N1cnNvcihjbSk7IH19XG4gIH07XG5cbiAgdmFyIGlucCA9IGQuaW5wdXQuZ2V0RmllbGQoKTtcbiAgb24oaW5wLCBcImtleXVwXCIsIGZ1bmN0aW9uIChlKSB7IHJldHVybiBvbktleVVwLmNhbGwoY20sIGUpOyB9KTtcbiAgb24oaW5wLCBcImtleWRvd25cIiwgb3BlcmF0aW9uKGNtLCBvbktleURvd24pKTtcbiAgb24oaW5wLCBcImtleXByZXNzXCIsIG9wZXJhdGlvbihjbSwgb25LZXlQcmVzcykpO1xuICBvbihpbnAsIFwiZm9jdXNcIiwgZnVuY3Rpb24gKGUpIHsgcmV0dXJuIG9uRm9jdXMoY20sIGUpOyB9KTtcbiAgb24oaW5wLCBcImJsdXJcIiwgZnVuY3Rpb24gKGUpIHsgcmV0dXJuIG9uQmx1cihjbSwgZSk7IH0pO1xufVxuXG52YXIgaW5pdEhvb2tzID0gW107XG5Db2RlTWlycm9yJDEuZGVmaW5lSW5pdEhvb2sgPSBmdW5jdGlvbiAoZikgeyByZXR1cm4gaW5pdEhvb2tzLnB1c2goZik7IH07XG5cbi8vIEluZGVudCB0aGUgZ2l2ZW4gbGluZS4gVGhlIGhvdyBwYXJhbWV0ZXIgY2FuIGJlIFwic21hcnRcIixcbi8vIFwiYWRkXCIvbnVsbCwgXCJzdWJ0cmFjdFwiLCBvciBcInByZXZcIi4gV2hlbiBhZ2dyZXNzaXZlIGlzIGZhbHNlXG4vLyAodHlwaWNhbGx5IHNldCB0byB0cnVlIGZvciBmb3JjZWQgc2luZ2xlLWxpbmUgaW5kZW50cyksIGVtcHR5XG4vLyBsaW5lcyBhcmUgbm90IGluZGVudGVkLCBhbmQgcGxhY2VzIHdoZXJlIHRoZSBtb2RlIHJldHVybnMgUGFzc1xuLy8gYXJlIGxlZnQgYWxvbmUuXG5mdW5jdGlvbiBpbmRlbnRMaW5lKGNtLCBuLCBob3csIGFnZ3Jlc3NpdmUpIHtcbiAgdmFyIGRvYyA9IGNtLmRvYywgc3RhdGU7XG4gIGlmIChob3cgPT0gbnVsbCkgeyBob3cgPSBcImFkZFwiOyB9XG4gIGlmIChob3cgPT0gXCJzbWFydFwiKSB7XG4gICAgLy8gRmFsbCBiYWNrIHRvIFwicHJldlwiIHdoZW4gdGhlIG1vZGUgZG9lc24ndCBoYXZlIGFuIGluZGVudGF0aW9uXG4gICAgLy8gbWV0aG9kLlxuICAgIGlmICghZG9jLm1vZGUuaW5kZW50KSB7IGhvdyA9IFwicHJldlwiOyB9XG4gICAgZWxzZSB7IHN0YXRlID0gZ2V0Q29udGV4dEJlZm9yZShjbSwgbikuc3RhdGU7IH1cbiAgfVxuXG4gIHZhciB0YWJTaXplID0gY20ub3B0aW9ucy50YWJTaXplO1xuICB2YXIgbGluZSA9IGdldExpbmUoZG9jLCBuKSwgY3VyU3BhY2UgPSBjb3VudENvbHVtbihsaW5lLnRleHQsIG51bGwsIHRhYlNpemUpO1xuICBpZiAobGluZS5zdGF0ZUFmdGVyKSB7IGxpbmUuc3RhdGVBZnRlciA9IG51bGw7IH1cbiAgdmFyIGN1clNwYWNlU3RyaW5nID0gbGluZS50ZXh0Lm1hdGNoKC9eXFxzKi8pWzBdLCBpbmRlbnRhdGlvbjtcbiAgaWYgKCFhZ2dyZXNzaXZlICYmICEvXFxTLy50ZXN0KGxpbmUudGV4dCkpIHtcbiAgICBpbmRlbnRhdGlvbiA9IDA7XG4gICAgaG93ID0gXCJub3RcIjtcbiAgfSBlbHNlIGlmIChob3cgPT0gXCJzbWFydFwiKSB7XG4gICAgaW5kZW50YXRpb24gPSBkb2MubW9kZS5pbmRlbnQoc3RhdGUsIGxpbmUudGV4dC5zbGljZShjdXJTcGFjZVN0cmluZy5sZW5ndGgpLCBsaW5lLnRleHQpO1xuICAgIGlmIChpbmRlbnRhdGlvbiA9PSBQYXNzIHx8IGluZGVudGF0aW9uID4gMTUwKSB7XG4gICAgICBpZiAoIWFnZ3Jlc3NpdmUpIHsgcmV0dXJuIH1cbiAgICAgIGhvdyA9IFwicHJldlwiO1xuICAgIH1cbiAgfVxuICBpZiAoaG93ID09IFwicHJldlwiKSB7XG4gICAgaWYgKG4gPiBkb2MuZmlyc3QpIHsgaW5kZW50YXRpb24gPSBjb3VudENvbHVtbihnZXRMaW5lKGRvYywgbi0xKS50ZXh0LCBudWxsLCB0YWJTaXplKTsgfVxuICAgIGVsc2UgeyBpbmRlbnRhdGlvbiA9IDA7IH1cbiAgfSBlbHNlIGlmIChob3cgPT0gXCJhZGRcIikge1xuICAgIGluZGVudGF0aW9uID0gY3VyU3BhY2UgKyBjbS5vcHRpb25zLmluZGVudFVuaXQ7XG4gIH0gZWxzZSBpZiAoaG93ID09IFwic3VidHJhY3RcIikge1xuICAgIGluZGVudGF0aW9uID0gY3VyU3BhY2UgLSBjbS5vcHRpb25zLmluZGVudFVuaXQ7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGhvdyA9PSBcIm51bWJlclwiKSB7XG4gICAgaW5kZW50YXRpb24gPSBjdXJTcGFjZSArIGhvdztcbiAgfVxuICBpbmRlbnRhdGlvbiA9IE1hdGgubWF4KDAsIGluZGVudGF0aW9uKTtcblxuICB2YXIgaW5kZW50U3RyaW5nID0gXCJcIiwgcG9zID0gMDtcbiAgaWYgKGNtLm9wdGlvbnMuaW5kZW50V2l0aFRhYnMpXG4gICAgeyBmb3IgKHZhciBpID0gTWF0aC5mbG9vcihpbmRlbnRhdGlvbiAvIHRhYlNpemUpOyBpOyAtLWkpIHtwb3MgKz0gdGFiU2l6ZTsgaW5kZW50U3RyaW5nICs9IFwiXFx0XCI7fSB9XG4gIGlmIChwb3MgPCBpbmRlbnRhdGlvbikgeyBpbmRlbnRTdHJpbmcgKz0gc3BhY2VTdHIoaW5kZW50YXRpb24gLSBwb3MpOyB9XG5cbiAgaWYgKGluZGVudFN0cmluZyAhPSBjdXJTcGFjZVN0cmluZykge1xuICAgIHJlcGxhY2VSYW5nZShkb2MsIGluZGVudFN0cmluZywgUG9zKG4sIDApLCBQb3MobiwgY3VyU3BhY2VTdHJpbmcubGVuZ3RoKSwgXCIraW5wdXRcIik7XG4gICAgbGluZS5zdGF0ZUFmdGVyID0gbnVsbDtcbiAgICByZXR1cm4gdHJ1ZVxuICB9IGVsc2Uge1xuICAgIC8vIEVuc3VyZSB0aGF0LCBpZiB0aGUgY3Vyc29yIHdhcyBpbiB0aGUgd2hpdGVzcGFjZSBhdCB0aGUgc3RhcnRcbiAgICAvLyBvZiB0aGUgbGluZSwgaXQgaXMgbW92ZWQgdG8gdGhlIGVuZCBvZiB0aGF0IHNwYWNlLlxuICAgIGZvciAodmFyIGkkMSA9IDA7IGkkMSA8IGRvYy5zZWwucmFuZ2VzLmxlbmd0aDsgaSQxKyspIHtcbiAgICAgIHZhciByYW5nZSA9IGRvYy5zZWwucmFuZ2VzW2kkMV07XG4gICAgICBpZiAocmFuZ2UuaGVhZC5saW5lID09IG4gJiYgcmFuZ2UuaGVhZC5jaCA8IGN1clNwYWNlU3RyaW5nLmxlbmd0aCkge1xuICAgICAgICB2YXIgcG9zJDEgPSBQb3MobiwgY3VyU3BhY2VTdHJpbmcubGVuZ3RoKTtcbiAgICAgICAgcmVwbGFjZU9uZVNlbGVjdGlvbihkb2MsIGkkMSwgbmV3IFJhbmdlKHBvcyQxLCBwb3MkMSkpO1xuICAgICAgICBicmVha1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vLyBUaGlzIHdpbGwgYmUgc2V0IHRvIGEge2xpbmVXaXNlOiBib29sLCB0ZXh0OiBbc3RyaW5nXX0gb2JqZWN0LCBzb1xuLy8gdGhhdCwgd2hlbiBwYXN0aW5nLCB3ZSBrbm93IHdoYXQga2luZCBvZiBzZWxlY3Rpb25zIHRoZSBjb3BpZWRcbi8vIHRleHQgd2FzIG1hZGUgb3V0IG9mLlxudmFyIGxhc3RDb3BpZWQgPSBudWxsO1xuXG5mdW5jdGlvbiBzZXRMYXN0Q29waWVkKG5ld0xhc3RDb3BpZWQpIHtcbiAgbGFzdENvcGllZCA9IG5ld0xhc3RDb3BpZWQ7XG59XG5cbmZ1bmN0aW9uIGFwcGx5VGV4dElucHV0KGNtLCBpbnNlcnRlZCwgZGVsZXRlZCwgc2VsLCBvcmlnaW4pIHtcbiAgdmFyIGRvYyA9IGNtLmRvYztcbiAgY20uZGlzcGxheS5zaGlmdCA9IGZhbHNlO1xuICBpZiAoIXNlbCkgeyBzZWwgPSBkb2Muc2VsOyB9XG5cbiAgdmFyIHBhc3RlID0gY20uc3RhdGUucGFzdGVJbmNvbWluZyB8fCBvcmlnaW4gPT0gXCJwYXN0ZVwiO1xuICB2YXIgdGV4dExpbmVzID0gc3BsaXRMaW5lc0F1dG8oaW5zZXJ0ZWQpLCBtdWx0aVBhc3RlID0gbnVsbDtcbiAgLy8gV2hlbiBwYXN0aW5nIE4gbGluZXMgaW50byBOIHNlbGVjdGlvbnMsIGluc2VydCBvbmUgbGluZSBwZXIgc2VsZWN0aW9uXG4gIGlmIChwYXN0ZSAmJiBzZWwucmFuZ2VzLmxlbmd0aCA+IDEpIHtcbiAgICBpZiAobGFzdENvcGllZCAmJiBsYXN0Q29waWVkLnRleHQuam9pbihcIlxcblwiKSA9PSBpbnNlcnRlZCkge1xuICAgICAgaWYgKHNlbC5yYW5nZXMubGVuZ3RoICUgbGFzdENvcGllZC50ZXh0Lmxlbmd0aCA9PSAwKSB7XG4gICAgICAgIG11bHRpUGFzdGUgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsYXN0Q29waWVkLnRleHQubGVuZ3RoOyBpKyspXG4gICAgICAgICAgeyBtdWx0aVBhc3RlLnB1c2goZG9jLnNwbGl0TGluZXMobGFzdENvcGllZC50ZXh0W2ldKSk7IH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRleHRMaW5lcy5sZW5ndGggPT0gc2VsLnJhbmdlcy5sZW5ndGggJiYgY20ub3B0aW9ucy5wYXN0ZUxpbmVzUGVyU2VsZWN0aW9uKSB7XG4gICAgICBtdWx0aVBhc3RlID0gbWFwKHRleHRMaW5lcywgZnVuY3Rpb24gKGwpIHsgcmV0dXJuIFtsXTsgfSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIHVwZGF0ZUlucHV0O1xuICAvLyBOb3JtYWwgYmVoYXZpb3IgaXMgdG8gaW5zZXJ0IHRoZSBuZXcgdGV4dCBpbnRvIGV2ZXJ5IHNlbGVjdGlvblxuICBmb3IgKHZhciBpJDEgPSBzZWwucmFuZ2VzLmxlbmd0aCAtIDE7IGkkMSA+PSAwOyBpJDEtLSkge1xuICAgIHZhciByYW5nZSQkMSA9IHNlbC5yYW5nZXNbaSQxXTtcbiAgICB2YXIgZnJvbSA9IHJhbmdlJCQxLmZyb20oKSwgdG8gPSByYW5nZSQkMS50bygpO1xuICAgIGlmIChyYW5nZSQkMS5lbXB0eSgpKSB7XG4gICAgICBpZiAoZGVsZXRlZCAmJiBkZWxldGVkID4gMCkgLy8gSGFuZGxlIGRlbGV0aW9uXG4gICAgICAgIHsgZnJvbSA9IFBvcyhmcm9tLmxpbmUsIGZyb20uY2ggLSBkZWxldGVkKTsgfVxuICAgICAgZWxzZSBpZiAoY20uc3RhdGUub3ZlcndyaXRlICYmICFwYXN0ZSkgLy8gSGFuZGxlIG92ZXJ3cml0ZVxuICAgICAgICB7IHRvID0gUG9zKHRvLmxpbmUsIE1hdGgubWluKGdldExpbmUoZG9jLCB0by5saW5lKS50ZXh0Lmxlbmd0aCwgdG8uY2ggKyBsc3QodGV4dExpbmVzKS5sZW5ndGgpKTsgfVxuICAgICAgZWxzZSBpZiAobGFzdENvcGllZCAmJiBsYXN0Q29waWVkLmxpbmVXaXNlICYmIGxhc3RDb3BpZWQudGV4dC5qb2luKFwiXFxuXCIpID09IGluc2VydGVkKVxuICAgICAgICB7IGZyb20gPSB0byA9IFBvcyhmcm9tLmxpbmUsIDApOyB9XG4gICAgfVxuICAgIHVwZGF0ZUlucHV0ID0gY20uY3VyT3AudXBkYXRlSW5wdXQ7XG4gICAgdmFyIGNoYW5nZUV2ZW50ID0ge2Zyb206IGZyb20sIHRvOiB0bywgdGV4dDogbXVsdGlQYXN0ZSA/IG11bHRpUGFzdGVbaSQxICUgbXVsdGlQYXN0ZS5sZW5ndGhdIDogdGV4dExpbmVzLFxuICAgICAgICAgICAgICAgICAgICAgICBvcmlnaW46IG9yaWdpbiB8fCAocGFzdGUgPyBcInBhc3RlXCIgOiBjbS5zdGF0ZS5jdXRJbmNvbWluZyA/IFwiY3V0XCIgOiBcIitpbnB1dFwiKX07XG4gICAgbWFrZUNoYW5nZShjbS5kb2MsIGNoYW5nZUV2ZW50KTtcbiAgICBzaWduYWxMYXRlcihjbSwgXCJpbnB1dFJlYWRcIiwgY20sIGNoYW5nZUV2ZW50KTtcbiAgfVxuICBpZiAoaW5zZXJ0ZWQgJiYgIXBhc3RlKVxuICAgIHsgdHJpZ2dlckVsZWN0cmljKGNtLCBpbnNlcnRlZCk7IH1cblxuICBlbnN1cmVDdXJzb3JWaXNpYmxlKGNtKTtcbiAgY20uY3VyT3AudXBkYXRlSW5wdXQgPSB1cGRhdGVJbnB1dDtcbiAgY20uY3VyT3AudHlwaW5nID0gdHJ1ZTtcbiAgY20uc3RhdGUucGFzdGVJbmNvbWluZyA9IGNtLnN0YXRlLmN1dEluY29taW5nID0gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGhhbmRsZVBhc3RlKGUsIGNtKSB7XG4gIHZhciBwYXN0ZWQgPSBlLmNsaXBib2FyZERhdGEgJiYgZS5jbGlwYm9hcmREYXRhLmdldERhdGEoXCJUZXh0XCIpO1xuICBpZiAocGFzdGVkKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGlmICghY20uaXNSZWFkT25seSgpICYmICFjbS5vcHRpb25zLmRpc2FibGVJbnB1dClcbiAgICAgIHsgcnVuSW5PcChjbSwgZnVuY3Rpb24gKCkgeyByZXR1cm4gYXBwbHlUZXh0SW5wdXQoY20sIHBhc3RlZCwgMCwgbnVsbCwgXCJwYXN0ZVwiKTsgfSk7IH1cbiAgICByZXR1cm4gdHJ1ZVxuICB9XG59XG5cbmZ1bmN0aW9uIHRyaWdnZXJFbGVjdHJpYyhjbSwgaW5zZXJ0ZWQpIHtcbiAgLy8gV2hlbiBhbiAnZWxlY3RyaWMnIGNoYXJhY3RlciBpcyBpbnNlcnRlZCwgaW1tZWRpYXRlbHkgdHJpZ2dlciBhIHJlaW5kZW50XG4gIGlmICghY20ub3B0aW9ucy5lbGVjdHJpY0NoYXJzIHx8ICFjbS5vcHRpb25zLnNtYXJ0SW5kZW50KSB7IHJldHVybiB9XG4gIHZhciBzZWwgPSBjbS5kb2Muc2VsO1xuXG4gIGZvciAodmFyIGkgPSBzZWwucmFuZ2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgdmFyIHJhbmdlJCQxID0gc2VsLnJhbmdlc1tpXTtcbiAgICBpZiAocmFuZ2UkJDEuaGVhZC5jaCA+IDEwMCB8fCAoaSAmJiBzZWwucmFuZ2VzW2kgLSAxXS5oZWFkLmxpbmUgPT0gcmFuZ2UkJDEuaGVhZC5saW5lKSkgeyBjb250aW51ZSB9XG4gICAgdmFyIG1vZGUgPSBjbS5nZXRNb2RlQXQocmFuZ2UkJDEuaGVhZCk7XG4gICAgdmFyIGluZGVudGVkID0gZmFsc2U7XG4gICAgaWYgKG1vZGUuZWxlY3RyaWNDaGFycykge1xuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBtb2RlLmVsZWN0cmljQ2hhcnMubGVuZ3RoOyBqKyspXG4gICAgICAgIHsgaWYgKGluc2VydGVkLmluZGV4T2YobW9kZS5lbGVjdHJpY0NoYXJzLmNoYXJBdChqKSkgPiAtMSkge1xuICAgICAgICAgIGluZGVudGVkID0gaW5kZW50TGluZShjbSwgcmFuZ2UkJDEuaGVhZC5saW5lLCBcInNtYXJ0XCIpO1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH0gfVxuICAgIH0gZWxzZSBpZiAobW9kZS5lbGVjdHJpY0lucHV0KSB7XG4gICAgICBpZiAobW9kZS5lbGVjdHJpY0lucHV0LnRlc3QoZ2V0TGluZShjbS5kb2MsIHJhbmdlJCQxLmhlYWQubGluZSkudGV4dC5zbGljZSgwLCByYW5nZSQkMS5oZWFkLmNoKSkpXG4gICAgICAgIHsgaW5kZW50ZWQgPSBpbmRlbnRMaW5lKGNtLCByYW5nZSQkMS5oZWFkLmxpbmUsIFwic21hcnRcIik7IH1cbiAgICB9XG4gICAgaWYgKGluZGVudGVkKSB7IHNpZ25hbExhdGVyKGNtLCBcImVsZWN0cmljSW5wdXRcIiwgY20sIHJhbmdlJCQxLmhlYWQubGluZSk7IH1cbiAgfVxufVxuXG5mdW5jdGlvbiBjb3B5YWJsZVJhbmdlcyhjbSkge1xuICB2YXIgdGV4dCA9IFtdLCByYW5nZXMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBjbS5kb2Muc2VsLnJhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBsaW5lID0gY20uZG9jLnNlbC5yYW5nZXNbaV0uaGVhZC5saW5lO1xuICAgIHZhciBsaW5lUmFuZ2UgPSB7YW5jaG9yOiBQb3MobGluZSwgMCksIGhlYWQ6IFBvcyhsaW5lICsgMSwgMCl9O1xuICAgIHJhbmdlcy5wdXNoKGxpbmVSYW5nZSk7XG4gICAgdGV4dC5wdXNoKGNtLmdldFJhbmdlKGxpbmVSYW5nZS5hbmNob3IsIGxpbmVSYW5nZS5oZWFkKSk7XG4gIH1cbiAgcmV0dXJuIHt0ZXh0OiB0ZXh0LCByYW5nZXM6IHJhbmdlc31cbn1cblxuZnVuY3Rpb24gZGlzYWJsZUJyb3dzZXJNYWdpYyhmaWVsZCwgc3BlbGxjaGVjaykge1xuICBmaWVsZC5zZXRBdHRyaWJ1dGUoXCJhdXRvY29ycmVjdFwiLCBcIm9mZlwiKTtcbiAgZmllbGQuc2V0QXR0cmlidXRlKFwiYXV0b2NhcGl0YWxpemVcIiwgXCJvZmZcIik7XG4gIGZpZWxkLnNldEF0dHJpYnV0ZShcInNwZWxsY2hlY2tcIiwgISFzcGVsbGNoZWNrKTtcbn1cblxuZnVuY3Rpb24gaGlkZGVuVGV4dGFyZWEoKSB7XG4gIHZhciB0ZSA9IGVsdChcInRleHRhcmVhXCIsIG51bGwsIG51bGwsIFwicG9zaXRpb246IGFic29sdXRlOyBib3R0b206IC0xZW07IHBhZGRpbmc6IDA7IHdpZHRoOiAxcHg7IGhlaWdodDogMWVtOyBvdXRsaW5lOiBub25lXCIpO1xuICB2YXIgZGl2ID0gZWx0KFwiZGl2XCIsIFt0ZV0sIG51bGwsIFwib3ZlcmZsb3c6IGhpZGRlbjsgcG9zaXRpb246IHJlbGF0aXZlOyB3aWR0aDogM3B4OyBoZWlnaHQ6IDBweDtcIik7XG4gIC8vIFRoZSB0ZXh0YXJlYSBpcyBrZXB0IHBvc2l0aW9uZWQgbmVhciB0aGUgY3Vyc29yIHRvIHByZXZlbnQgdGhlXG4gIC8vIGZhY3QgdGhhdCBpdCdsbCBiZSBzY3JvbGxlZCBpbnRvIHZpZXcgb24gaW5wdXQgZnJvbSBzY3JvbGxpbmdcbiAgLy8gb3VyIGZha2UgY3Vyc29yIG91dCBvZiB2aWV3LiBPbiB3ZWJraXQsIHdoZW4gd3JhcD1vZmYsIHBhc3RlIGlzXG4gIC8vIHZlcnkgc2xvdy4gU28gbWFrZSB0aGUgYXJlYSB3aWRlIGluc3RlYWQuXG4gIGlmICh3ZWJraXQpIHsgdGUuc3R5bGUud2lkdGggPSBcIjEwMDBweFwiOyB9XG4gIGVsc2UgeyB0ZS5zZXRBdHRyaWJ1dGUoXCJ3cmFwXCIsIFwib2ZmXCIpOyB9XG4gIC8vIElmIGJvcmRlcjogMDsgLS0gaU9TIGZhaWxzIHRvIG9wZW4ga2V5Ym9hcmQgKGlzc3VlICMxMjg3KVxuICBpZiAoaW9zKSB7IHRlLnN0eWxlLmJvcmRlciA9IFwiMXB4IHNvbGlkIGJsYWNrXCI7IH1cbiAgZGlzYWJsZUJyb3dzZXJNYWdpYyh0ZSk7XG4gIHJldHVybiBkaXZcbn1cblxuLy8gVGhlIHB1YmxpY2x5IHZpc2libGUgQVBJLiBOb3RlIHRoYXQgbWV0aG9kT3AoZikgbWVhbnNcbi8vICd3cmFwIGYgaW4gYW4gb3BlcmF0aW9uLCBwZXJmb3JtZWQgb24gaXRzIGB0aGlzYCBwYXJhbWV0ZXInLlxuXG4vLyBUaGlzIGlzIG5vdCB0aGUgY29tcGxldGUgc2V0IG9mIGVkaXRvciBtZXRob2RzLiBNb3N0IG9mIHRoZVxuLy8gbWV0aG9kcyBkZWZpbmVkIG9uIHRoZSBEb2MgdHlwZSBhcmUgYWxzbyBpbmplY3RlZCBpbnRvXG4vLyBDb2RlTWlycm9yLnByb3RvdHlwZSwgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IGFuZFxuLy8gY29udmVuaWVuY2UuXG5cbnZhciBhZGRFZGl0b3JNZXRob2RzID0gZnVuY3Rpb24oQ29kZU1pcnJvcikge1xuICB2YXIgb3B0aW9uSGFuZGxlcnMgPSBDb2RlTWlycm9yLm9wdGlvbkhhbmRsZXJzO1xuXG4gIHZhciBoZWxwZXJzID0gQ29kZU1pcnJvci5oZWxwZXJzID0ge307XG5cbiAgQ29kZU1pcnJvci5wcm90b3R5cGUgPSB7XG4gICAgY29uc3RydWN0b3I6IENvZGVNaXJyb3IsXG4gICAgZm9jdXM6IGZ1bmN0aW9uKCl7d2luZG93LmZvY3VzKCk7IHRoaXMuZGlzcGxheS5pbnB1dC5mb2N1cygpO30sXG5cbiAgICBzZXRPcHRpb246IGZ1bmN0aW9uKG9wdGlvbiwgdmFsdWUpIHtcbiAgICAgIHZhciBvcHRpb25zID0gdGhpcy5vcHRpb25zLCBvbGQgPSBvcHRpb25zW29wdGlvbl07XG4gICAgICBpZiAob3B0aW9uc1tvcHRpb25dID09IHZhbHVlICYmIG9wdGlvbiAhPSBcIm1vZGVcIikgeyByZXR1cm4gfVxuICAgICAgb3B0aW9uc1tvcHRpb25dID0gdmFsdWU7XG4gICAgICBpZiAob3B0aW9uSGFuZGxlcnMuaGFzT3duUHJvcGVydHkob3B0aW9uKSlcbiAgICAgICAgeyBvcGVyYXRpb24odGhpcywgb3B0aW9uSGFuZGxlcnNbb3B0aW9uXSkodGhpcywgdmFsdWUsIG9sZCk7IH1cbiAgICAgIHNpZ25hbCh0aGlzLCBcIm9wdGlvbkNoYW5nZVwiLCB0aGlzLCBvcHRpb24pO1xuICAgIH0sXG5cbiAgICBnZXRPcHRpb246IGZ1bmN0aW9uKG9wdGlvbikge3JldHVybiB0aGlzLm9wdGlvbnNbb3B0aW9uXX0sXG4gICAgZ2V0RG9jOiBmdW5jdGlvbigpIHtyZXR1cm4gdGhpcy5kb2N9LFxuXG4gICAgYWRkS2V5TWFwOiBmdW5jdGlvbihtYXAkJDEsIGJvdHRvbSkge1xuICAgICAgdGhpcy5zdGF0ZS5rZXlNYXBzW2JvdHRvbSA/IFwicHVzaFwiIDogXCJ1bnNoaWZ0XCJdKGdldEtleU1hcChtYXAkJDEpKTtcbiAgICB9LFxuICAgIHJlbW92ZUtleU1hcDogZnVuY3Rpb24obWFwJCQxKSB7XG4gICAgICB2YXIgbWFwcyA9IHRoaXMuc3RhdGUua2V5TWFwcztcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbWFwcy5sZW5ndGg7ICsraSlcbiAgICAgICAgeyBpZiAobWFwc1tpXSA9PSBtYXAkJDEgfHwgbWFwc1tpXS5uYW1lID09IG1hcCQkMSkge1xuICAgICAgICAgIG1hcHMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH0gfVxuICAgIH0sXG5cbiAgICBhZGRPdmVybGF5OiBtZXRob2RPcChmdW5jdGlvbihzcGVjLCBvcHRpb25zKSB7XG4gICAgICB2YXIgbW9kZSA9IHNwZWMudG9rZW4gPyBzcGVjIDogQ29kZU1pcnJvci5nZXRNb2RlKHRoaXMub3B0aW9ucywgc3BlYyk7XG4gICAgICBpZiAobW9kZS5zdGFydFN0YXRlKSB7IHRocm93IG5ldyBFcnJvcihcIk92ZXJsYXlzIG1heSBub3QgYmUgc3RhdGVmdWwuXCIpIH1cbiAgICAgIGluc2VydFNvcnRlZCh0aGlzLnN0YXRlLm92ZXJsYXlzLFxuICAgICAgICAgICAgICAgICAgIHttb2RlOiBtb2RlLCBtb2RlU3BlYzogc3BlYywgb3BhcXVlOiBvcHRpb25zICYmIG9wdGlvbnMub3BhcXVlLFxuICAgICAgICAgICAgICAgICAgICBwcmlvcml0eTogKG9wdGlvbnMgJiYgb3B0aW9ucy5wcmlvcml0eSkgfHwgMH0sXG4gICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKG92ZXJsYXkpIHsgcmV0dXJuIG92ZXJsYXkucHJpb3JpdHk7IH0pO1xuICAgICAgdGhpcy5zdGF0ZS5tb2RlR2VuKys7XG4gICAgICByZWdDaGFuZ2UodGhpcyk7XG4gICAgfSksXG4gICAgcmVtb3ZlT3ZlcmxheTogbWV0aG9kT3AoZnVuY3Rpb24oc3BlYykge1xuICAgICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgICAgIHZhciBvdmVybGF5cyA9IHRoaXMuc3RhdGUub3ZlcmxheXM7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG92ZXJsYXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBjdXIgPSBvdmVybGF5c1tpXS5tb2RlU3BlYztcbiAgICAgICAgaWYgKGN1ciA9PSBzcGVjIHx8IHR5cGVvZiBzcGVjID09IFwic3RyaW5nXCIgJiYgY3VyLm5hbWUgPT0gc3BlYykge1xuICAgICAgICAgIG92ZXJsYXlzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICB0aGlzJDEuc3RhdGUubW9kZUdlbisrO1xuICAgICAgICAgIHJlZ0NoYW5nZSh0aGlzJDEpO1xuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSksXG5cbiAgICBpbmRlbnRMaW5lOiBtZXRob2RPcChmdW5jdGlvbihuLCBkaXIsIGFnZ3Jlc3NpdmUpIHtcbiAgICAgIGlmICh0eXBlb2YgZGlyICE9IFwic3RyaW5nXCIgJiYgdHlwZW9mIGRpciAhPSBcIm51bWJlclwiKSB7XG4gICAgICAgIGlmIChkaXIgPT0gbnVsbCkgeyBkaXIgPSB0aGlzLm9wdGlvbnMuc21hcnRJbmRlbnQgPyBcInNtYXJ0XCIgOiBcInByZXZcIjsgfVxuICAgICAgICBlbHNlIHsgZGlyID0gZGlyID8gXCJhZGRcIiA6IFwic3VidHJhY3RcIjsgfVxuICAgICAgfVxuICAgICAgaWYgKGlzTGluZSh0aGlzLmRvYywgbikpIHsgaW5kZW50TGluZSh0aGlzLCBuLCBkaXIsIGFnZ3Jlc3NpdmUpOyB9XG4gICAgfSksXG4gICAgaW5kZW50U2VsZWN0aW9uOiBtZXRob2RPcChmdW5jdGlvbihob3cpIHtcbiAgICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gICAgICB2YXIgcmFuZ2VzID0gdGhpcy5kb2Muc2VsLnJhbmdlcywgZW5kID0gLTE7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJhbmdlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcmFuZ2UkJDEgPSByYW5nZXNbaV07XG4gICAgICAgIGlmICghcmFuZ2UkJDEuZW1wdHkoKSkge1xuICAgICAgICAgIHZhciBmcm9tID0gcmFuZ2UkJDEuZnJvbSgpLCB0byA9IHJhbmdlJCQxLnRvKCk7XG4gICAgICAgICAgdmFyIHN0YXJ0ID0gTWF0aC5tYXgoZW5kLCBmcm9tLmxpbmUpO1xuICAgICAgICAgIGVuZCA9IE1hdGgubWluKHRoaXMkMS5sYXN0TGluZSgpLCB0by5saW5lIC0gKHRvLmNoID8gMCA6IDEpKSArIDE7XG4gICAgICAgICAgZm9yICh2YXIgaiA9IHN0YXJ0OyBqIDwgZW5kOyArK2opXG4gICAgICAgICAgICB7IGluZGVudExpbmUodGhpcyQxLCBqLCBob3cpOyB9XG4gICAgICAgICAgdmFyIG5ld1JhbmdlcyA9IHRoaXMkMS5kb2Muc2VsLnJhbmdlcztcbiAgICAgICAgICBpZiAoZnJvbS5jaCA9PSAwICYmIHJhbmdlcy5sZW5ndGggPT0gbmV3UmFuZ2VzLmxlbmd0aCAmJiBuZXdSYW5nZXNbaV0uZnJvbSgpLmNoID4gMClcbiAgICAgICAgICAgIHsgcmVwbGFjZU9uZVNlbGVjdGlvbih0aGlzJDEuZG9jLCBpLCBuZXcgUmFuZ2UoZnJvbSwgbmV3UmFuZ2VzW2ldLnRvKCkpLCBzZWxfZG9udFNjcm9sbCk7IH1cbiAgICAgICAgfSBlbHNlIGlmIChyYW5nZSQkMS5oZWFkLmxpbmUgPiBlbmQpIHtcbiAgICAgICAgICBpbmRlbnRMaW5lKHRoaXMkMSwgcmFuZ2UkJDEuaGVhZC5saW5lLCBob3csIHRydWUpO1xuICAgICAgICAgIGVuZCA9IHJhbmdlJCQxLmhlYWQubGluZTtcbiAgICAgICAgICBpZiAoaSA9PSB0aGlzJDEuZG9jLnNlbC5wcmltSW5kZXgpIHsgZW5zdXJlQ3Vyc29yVmlzaWJsZSh0aGlzJDEpOyB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSxcblxuICAgIC8vIEZldGNoIHRoZSBwYXJzZXIgdG9rZW4gZm9yIGEgZ2l2ZW4gY2hhcmFjdGVyLiBVc2VmdWwgZm9yIGhhY2tzXG4gICAgLy8gdGhhdCB3YW50IHRvIGluc3BlY3QgdGhlIG1vZGUgc3RhdGUgKHNheSwgZm9yIGNvbXBsZXRpb24pLlxuICAgIGdldFRva2VuQXQ6IGZ1bmN0aW9uKHBvcywgcHJlY2lzZSkge1xuICAgICAgcmV0dXJuIHRha2VUb2tlbih0aGlzLCBwb3MsIHByZWNpc2UpXG4gICAgfSxcblxuICAgIGdldExpbmVUb2tlbnM6IGZ1bmN0aW9uKGxpbmUsIHByZWNpc2UpIHtcbiAgICAgIHJldHVybiB0YWtlVG9rZW4odGhpcywgUG9zKGxpbmUpLCBwcmVjaXNlLCB0cnVlKVxuICAgIH0sXG5cbiAgICBnZXRUb2tlblR5cGVBdDogZnVuY3Rpb24ocG9zKSB7XG4gICAgICBwb3MgPSBjbGlwUG9zKHRoaXMuZG9jLCBwb3MpO1xuICAgICAgdmFyIHN0eWxlcyA9IGdldExpbmVTdHlsZXModGhpcywgZ2V0TGluZSh0aGlzLmRvYywgcG9zLmxpbmUpKTtcbiAgICAgIHZhciBiZWZvcmUgPSAwLCBhZnRlciA9IChzdHlsZXMubGVuZ3RoIC0gMSkgLyAyLCBjaCA9IHBvcy5jaDtcbiAgICAgIHZhciB0eXBlO1xuICAgICAgaWYgKGNoID09IDApIHsgdHlwZSA9IHN0eWxlc1syXTsgfVxuICAgICAgZWxzZSB7IGZvciAoOzspIHtcbiAgICAgICAgdmFyIG1pZCA9IChiZWZvcmUgKyBhZnRlcikgPj4gMTtcbiAgICAgICAgaWYgKChtaWQgPyBzdHlsZXNbbWlkICogMiAtIDFdIDogMCkgPj0gY2gpIHsgYWZ0ZXIgPSBtaWQ7IH1cbiAgICAgICAgZWxzZSBpZiAoc3R5bGVzW21pZCAqIDIgKyAxXSA8IGNoKSB7IGJlZm9yZSA9IG1pZCArIDE7IH1cbiAgICAgICAgZWxzZSB7IHR5cGUgPSBzdHlsZXNbbWlkICogMiArIDJdOyBicmVhayB9XG4gICAgICB9IH1cbiAgICAgIHZhciBjdXQgPSB0eXBlID8gdHlwZS5pbmRleE9mKFwib3ZlcmxheSBcIikgOiAtMTtcbiAgICAgIHJldHVybiBjdXQgPCAwID8gdHlwZSA6IGN1dCA9PSAwID8gbnVsbCA6IHR5cGUuc2xpY2UoMCwgY3V0IC0gMSlcbiAgICB9LFxuXG4gICAgZ2V0TW9kZUF0OiBmdW5jdGlvbihwb3MpIHtcbiAgICAgIHZhciBtb2RlID0gdGhpcy5kb2MubW9kZTtcbiAgICAgIGlmICghbW9kZS5pbm5lck1vZGUpIHsgcmV0dXJuIG1vZGUgfVxuICAgICAgcmV0dXJuIENvZGVNaXJyb3IuaW5uZXJNb2RlKG1vZGUsIHRoaXMuZ2V0VG9rZW5BdChwb3MpLnN0YXRlKS5tb2RlXG4gICAgfSxcblxuICAgIGdldEhlbHBlcjogZnVuY3Rpb24ocG9zLCB0eXBlKSB7XG4gICAgICByZXR1cm4gdGhpcy5nZXRIZWxwZXJzKHBvcywgdHlwZSlbMF1cbiAgICB9LFxuXG4gICAgZ2V0SGVscGVyczogZnVuY3Rpb24ocG9zLCB0eXBlKSB7XG4gICAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICAgICAgdmFyIGZvdW5kID0gW107XG4gICAgICBpZiAoIWhlbHBlcnMuaGFzT3duUHJvcGVydHkodHlwZSkpIHsgcmV0dXJuIGZvdW5kIH1cbiAgICAgIHZhciBoZWxwID0gaGVscGVyc1t0eXBlXSwgbW9kZSA9IHRoaXMuZ2V0TW9kZUF0KHBvcyk7XG4gICAgICBpZiAodHlwZW9mIG1vZGVbdHlwZV0gPT0gXCJzdHJpbmdcIikge1xuICAgICAgICBpZiAoaGVscFttb2RlW3R5cGVdXSkgeyBmb3VuZC5wdXNoKGhlbHBbbW9kZVt0eXBlXV0pOyB9XG4gICAgICB9IGVsc2UgaWYgKG1vZGVbdHlwZV0pIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtb2RlW3R5cGVdLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgdmFyIHZhbCA9IGhlbHBbbW9kZVt0eXBlXVtpXV07XG4gICAgICAgICAgaWYgKHZhbCkgeyBmb3VuZC5wdXNoKHZhbCk7IH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChtb2RlLmhlbHBlclR5cGUgJiYgaGVscFttb2RlLmhlbHBlclR5cGVdKSB7XG4gICAgICAgIGZvdW5kLnB1c2goaGVscFttb2RlLmhlbHBlclR5cGVdKTtcbiAgICAgIH0gZWxzZSBpZiAoaGVscFttb2RlLm5hbWVdKSB7XG4gICAgICAgIGZvdW5kLnB1c2goaGVscFttb2RlLm5hbWVdKTtcbiAgICAgIH1cbiAgICAgIGZvciAodmFyIGkkMSA9IDA7IGkkMSA8IGhlbHAuX2dsb2JhbC5sZW5ndGg7IGkkMSsrKSB7XG4gICAgICAgIHZhciBjdXIgPSBoZWxwLl9nbG9iYWxbaSQxXTtcbiAgICAgICAgaWYgKGN1ci5wcmVkKG1vZGUsIHRoaXMkMSkgJiYgaW5kZXhPZihmb3VuZCwgY3VyLnZhbCkgPT0gLTEpXG4gICAgICAgICAgeyBmb3VuZC5wdXNoKGN1ci52YWwpOyB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZm91bmRcbiAgICB9LFxuXG4gICAgZ2V0U3RhdGVBZnRlcjogZnVuY3Rpb24obGluZSwgcHJlY2lzZSkge1xuICAgICAgdmFyIGRvYyA9IHRoaXMuZG9jO1xuICAgICAgbGluZSA9IGNsaXBMaW5lKGRvYywgbGluZSA9PSBudWxsID8gZG9jLmZpcnN0ICsgZG9jLnNpemUgLSAxOiBsaW5lKTtcbiAgICAgIHJldHVybiBnZXRDb250ZXh0QmVmb3JlKHRoaXMsIGxpbmUgKyAxLCBwcmVjaXNlKS5zdGF0ZVxuICAgIH0sXG5cbiAgICBjdXJzb3JDb29yZHM6IGZ1bmN0aW9uKHN0YXJ0LCBtb2RlKSB7XG4gICAgICB2YXIgcG9zLCByYW5nZSQkMSA9IHRoaXMuZG9jLnNlbC5wcmltYXJ5KCk7XG4gICAgICBpZiAoc3RhcnQgPT0gbnVsbCkgeyBwb3MgPSByYW5nZSQkMS5oZWFkOyB9XG4gICAgICBlbHNlIGlmICh0eXBlb2Ygc3RhcnQgPT0gXCJvYmplY3RcIikgeyBwb3MgPSBjbGlwUG9zKHRoaXMuZG9jLCBzdGFydCk7IH1cbiAgICAgIGVsc2UgeyBwb3MgPSBzdGFydCA/IHJhbmdlJCQxLmZyb20oKSA6IHJhbmdlJCQxLnRvKCk7IH1cbiAgICAgIHJldHVybiBjdXJzb3JDb29yZHModGhpcywgcG9zLCBtb2RlIHx8IFwicGFnZVwiKVxuICAgIH0sXG5cbiAgICBjaGFyQ29vcmRzOiBmdW5jdGlvbihwb3MsIG1vZGUpIHtcbiAgICAgIHJldHVybiBjaGFyQ29vcmRzKHRoaXMsIGNsaXBQb3ModGhpcy5kb2MsIHBvcyksIG1vZGUgfHwgXCJwYWdlXCIpXG4gICAgfSxcblxuICAgIGNvb3Jkc0NoYXI6IGZ1bmN0aW9uKGNvb3JkcywgbW9kZSkge1xuICAgICAgY29vcmRzID0gZnJvbUNvb3JkU3lzdGVtKHRoaXMsIGNvb3JkcywgbW9kZSB8fCBcInBhZ2VcIik7XG4gICAgICByZXR1cm4gY29vcmRzQ2hhcih0aGlzLCBjb29yZHMubGVmdCwgY29vcmRzLnRvcClcbiAgICB9LFxuXG4gICAgbGluZUF0SGVpZ2h0OiBmdW5jdGlvbihoZWlnaHQsIG1vZGUpIHtcbiAgICAgIGhlaWdodCA9IGZyb21Db29yZFN5c3RlbSh0aGlzLCB7dG9wOiBoZWlnaHQsIGxlZnQ6IDB9LCBtb2RlIHx8IFwicGFnZVwiKS50b3A7XG4gICAgICByZXR1cm4gbGluZUF0SGVpZ2h0KHRoaXMuZG9jLCBoZWlnaHQgKyB0aGlzLmRpc3BsYXkudmlld09mZnNldClcbiAgICB9LFxuICAgIGhlaWdodEF0TGluZTogZnVuY3Rpb24obGluZSwgbW9kZSwgaW5jbHVkZVdpZGdldHMpIHtcbiAgICAgIHZhciBlbmQgPSBmYWxzZSwgbGluZU9iajtcbiAgICAgIGlmICh0eXBlb2YgbGluZSA9PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHZhciBsYXN0ID0gdGhpcy5kb2MuZmlyc3QgKyB0aGlzLmRvYy5zaXplIC0gMTtcbiAgICAgICAgaWYgKGxpbmUgPCB0aGlzLmRvYy5maXJzdCkgeyBsaW5lID0gdGhpcy5kb2MuZmlyc3Q7IH1cbiAgICAgICAgZWxzZSBpZiAobGluZSA+IGxhc3QpIHsgbGluZSA9IGxhc3Q7IGVuZCA9IHRydWU7IH1cbiAgICAgICAgbGluZU9iaiA9IGdldExpbmUodGhpcy5kb2MsIGxpbmUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGluZU9iaiA9IGxpbmU7XG4gICAgICB9XG4gICAgICByZXR1cm4gaW50b0Nvb3JkU3lzdGVtKHRoaXMsIGxpbmVPYmosIHt0b3A6IDAsIGxlZnQ6IDB9LCBtb2RlIHx8IFwicGFnZVwiLCBpbmNsdWRlV2lkZ2V0cyB8fCBlbmQpLnRvcCArXG4gICAgICAgIChlbmQgPyB0aGlzLmRvYy5oZWlnaHQgLSBoZWlnaHRBdExpbmUobGluZU9iaikgOiAwKVxuICAgIH0sXG5cbiAgICBkZWZhdWx0VGV4dEhlaWdodDogZnVuY3Rpb24oKSB7IHJldHVybiB0ZXh0SGVpZ2h0KHRoaXMuZGlzcGxheSkgfSxcbiAgICBkZWZhdWx0Q2hhcldpZHRoOiBmdW5jdGlvbigpIHsgcmV0dXJuIGNoYXJXaWR0aCh0aGlzLmRpc3BsYXkpIH0sXG5cbiAgICBnZXRWaWV3cG9ydDogZnVuY3Rpb24oKSB7IHJldHVybiB7ZnJvbTogdGhpcy5kaXNwbGF5LnZpZXdGcm9tLCB0bzogdGhpcy5kaXNwbGF5LnZpZXdUb319LFxuXG4gICAgYWRkV2lkZ2V0OiBmdW5jdGlvbihwb3MsIG5vZGUsIHNjcm9sbCwgdmVydCwgaG9yaXopIHtcbiAgICAgIHZhciBkaXNwbGF5ID0gdGhpcy5kaXNwbGF5O1xuICAgICAgcG9zID0gY3Vyc29yQ29vcmRzKHRoaXMsIGNsaXBQb3ModGhpcy5kb2MsIHBvcykpO1xuICAgICAgdmFyIHRvcCA9IHBvcy5ib3R0b20sIGxlZnQgPSBwb3MubGVmdDtcbiAgICAgIG5vZGUuc3R5bGUucG9zaXRpb24gPSBcImFic29sdXRlXCI7XG4gICAgICBub2RlLnNldEF0dHJpYnV0ZShcImNtLWlnbm9yZS1ldmVudHNcIiwgXCJ0cnVlXCIpO1xuICAgICAgdGhpcy5kaXNwbGF5LmlucHV0LnNldFVuZWRpdGFibGUobm9kZSk7XG4gICAgICBkaXNwbGF5LnNpemVyLmFwcGVuZENoaWxkKG5vZGUpO1xuICAgICAgaWYgKHZlcnQgPT0gXCJvdmVyXCIpIHtcbiAgICAgICAgdG9wID0gcG9zLnRvcDtcbiAgICAgIH0gZWxzZSBpZiAodmVydCA9PSBcImFib3ZlXCIgfHwgdmVydCA9PSBcIm5lYXJcIikge1xuICAgICAgICB2YXIgdnNwYWNlID0gTWF0aC5tYXgoZGlzcGxheS53cmFwcGVyLmNsaWVudEhlaWdodCwgdGhpcy5kb2MuaGVpZ2h0KSxcbiAgICAgICAgaHNwYWNlID0gTWF0aC5tYXgoZGlzcGxheS5zaXplci5jbGllbnRXaWR0aCwgZGlzcGxheS5saW5lU3BhY2UuY2xpZW50V2lkdGgpO1xuICAgICAgICAvLyBEZWZhdWx0IHRvIHBvc2l0aW9uaW5nIGFib3ZlIChpZiBzcGVjaWZpZWQgYW5kIHBvc3NpYmxlKTsgb3RoZXJ3aXNlIGRlZmF1bHQgdG8gcG9zaXRpb25pbmcgYmVsb3dcbiAgICAgICAgaWYgKCh2ZXJ0ID09ICdhYm92ZScgfHwgcG9zLmJvdHRvbSArIG5vZGUub2Zmc2V0SGVpZ2h0ID4gdnNwYWNlKSAmJiBwb3MudG9wID4gbm9kZS5vZmZzZXRIZWlnaHQpXG4gICAgICAgICAgeyB0b3AgPSBwb3MudG9wIC0gbm9kZS5vZmZzZXRIZWlnaHQ7IH1cbiAgICAgICAgZWxzZSBpZiAocG9zLmJvdHRvbSArIG5vZGUub2Zmc2V0SGVpZ2h0IDw9IHZzcGFjZSlcbiAgICAgICAgICB7IHRvcCA9IHBvcy5ib3R0b207IH1cbiAgICAgICAgaWYgKGxlZnQgKyBub2RlLm9mZnNldFdpZHRoID4gaHNwYWNlKVxuICAgICAgICAgIHsgbGVmdCA9IGhzcGFjZSAtIG5vZGUub2Zmc2V0V2lkdGg7IH1cbiAgICAgIH1cbiAgICAgIG5vZGUuc3R5bGUudG9wID0gdG9wICsgXCJweFwiO1xuICAgICAgbm9kZS5zdHlsZS5sZWZ0ID0gbm9kZS5zdHlsZS5yaWdodCA9IFwiXCI7XG4gICAgICBpZiAoaG9yaXogPT0gXCJyaWdodFwiKSB7XG4gICAgICAgIGxlZnQgPSBkaXNwbGF5LnNpemVyLmNsaWVudFdpZHRoIC0gbm9kZS5vZmZzZXRXaWR0aDtcbiAgICAgICAgbm9kZS5zdHlsZS5yaWdodCA9IFwiMHB4XCI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoaG9yaXogPT0gXCJsZWZ0XCIpIHsgbGVmdCA9IDA7IH1cbiAgICAgICAgZWxzZSBpZiAoaG9yaXogPT0gXCJtaWRkbGVcIikgeyBsZWZ0ID0gKGRpc3BsYXkuc2l6ZXIuY2xpZW50V2lkdGggLSBub2RlLm9mZnNldFdpZHRoKSAvIDI7IH1cbiAgICAgICAgbm9kZS5zdHlsZS5sZWZ0ID0gbGVmdCArIFwicHhcIjtcbiAgICAgIH1cbiAgICAgIGlmIChzY3JvbGwpXG4gICAgICAgIHsgc2Nyb2xsSW50b1ZpZXcodGhpcywge2xlZnQ6IGxlZnQsIHRvcDogdG9wLCByaWdodDogbGVmdCArIG5vZGUub2Zmc2V0V2lkdGgsIGJvdHRvbTogdG9wICsgbm9kZS5vZmZzZXRIZWlnaHR9KTsgfVxuICAgIH0sXG5cbiAgICB0cmlnZ2VyT25LZXlEb3duOiBtZXRob2RPcChvbktleURvd24pLFxuICAgIHRyaWdnZXJPbktleVByZXNzOiBtZXRob2RPcChvbktleVByZXNzKSxcbiAgICB0cmlnZ2VyT25LZXlVcDogb25LZXlVcCxcbiAgICB0cmlnZ2VyT25Nb3VzZURvd246IG1ldGhvZE9wKG9uTW91c2VEb3duKSxcblxuICAgIGV4ZWNDb21tYW5kOiBmdW5jdGlvbihjbWQpIHtcbiAgICAgIGlmIChjb21tYW5kcy5oYXNPd25Qcm9wZXJ0eShjbWQpKVxuICAgICAgICB7IHJldHVybiBjb21tYW5kc1tjbWRdLmNhbGwobnVsbCwgdGhpcykgfVxuICAgIH0sXG5cbiAgICB0cmlnZ2VyRWxlY3RyaWM6IG1ldGhvZE9wKGZ1bmN0aW9uKHRleHQpIHsgdHJpZ2dlckVsZWN0cmljKHRoaXMsIHRleHQpOyB9KSxcblxuICAgIGZpbmRQb3NIOiBmdW5jdGlvbihmcm9tLCBhbW91bnQsIHVuaXQsIHZpc3VhbGx5KSB7XG4gICAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICAgICAgdmFyIGRpciA9IDE7XG4gICAgICBpZiAoYW1vdW50IDwgMCkgeyBkaXIgPSAtMTsgYW1vdW50ID0gLWFtb3VudDsgfVxuICAgICAgdmFyIGN1ciA9IGNsaXBQb3ModGhpcy5kb2MsIGZyb20pO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhbW91bnQ7ICsraSkge1xuICAgICAgICBjdXIgPSBmaW5kUG9zSCh0aGlzJDEuZG9jLCBjdXIsIGRpciwgdW5pdCwgdmlzdWFsbHkpO1xuICAgICAgICBpZiAoY3VyLmhpdFNpZGUpIHsgYnJlYWsgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGN1clxuICAgIH0sXG5cbiAgICBtb3ZlSDogbWV0aG9kT3AoZnVuY3Rpb24oZGlyLCB1bml0KSB7XG4gICAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICAgICAgdGhpcy5leHRlbmRTZWxlY3Rpb25zQnkoZnVuY3Rpb24gKHJhbmdlJCQxKSB7XG4gICAgICAgIGlmICh0aGlzJDEuZGlzcGxheS5zaGlmdCB8fCB0aGlzJDEuZG9jLmV4dGVuZCB8fCByYW5nZSQkMS5lbXB0eSgpKVxuICAgICAgICAgIHsgcmV0dXJuIGZpbmRQb3NIKHRoaXMkMS5kb2MsIHJhbmdlJCQxLmhlYWQsIGRpciwgdW5pdCwgdGhpcyQxLm9wdGlvbnMucnRsTW92ZVZpc3VhbGx5KSB9XG4gICAgICAgIGVsc2VcbiAgICAgICAgICB7IHJldHVybiBkaXIgPCAwID8gcmFuZ2UkJDEuZnJvbSgpIDogcmFuZ2UkJDEudG8oKSB9XG4gICAgICB9LCBzZWxfbW92ZSk7XG4gICAgfSksXG5cbiAgICBkZWxldGVIOiBtZXRob2RPcChmdW5jdGlvbihkaXIsIHVuaXQpIHtcbiAgICAgIHZhciBzZWwgPSB0aGlzLmRvYy5zZWwsIGRvYyA9IHRoaXMuZG9jO1xuICAgICAgaWYgKHNlbC5zb21ldGhpbmdTZWxlY3RlZCgpKVxuICAgICAgICB7IGRvYy5yZXBsYWNlU2VsZWN0aW9uKFwiXCIsIG51bGwsIFwiK2RlbGV0ZVwiKTsgfVxuICAgICAgZWxzZVxuICAgICAgICB7IGRlbGV0ZU5lYXJTZWxlY3Rpb24odGhpcywgZnVuY3Rpb24gKHJhbmdlJCQxKSB7XG4gICAgICAgICAgdmFyIG90aGVyID0gZmluZFBvc0goZG9jLCByYW5nZSQkMS5oZWFkLCBkaXIsIHVuaXQsIGZhbHNlKTtcbiAgICAgICAgICByZXR1cm4gZGlyIDwgMCA/IHtmcm9tOiBvdGhlciwgdG86IHJhbmdlJCQxLmhlYWR9IDoge2Zyb206IHJhbmdlJCQxLmhlYWQsIHRvOiBvdGhlcn1cbiAgICAgICAgfSk7IH1cbiAgICB9KSxcblxuICAgIGZpbmRQb3NWOiBmdW5jdGlvbihmcm9tLCBhbW91bnQsIHVuaXQsIGdvYWxDb2x1bW4pIHtcbiAgICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gICAgICB2YXIgZGlyID0gMSwgeCA9IGdvYWxDb2x1bW47XG4gICAgICBpZiAoYW1vdW50IDwgMCkgeyBkaXIgPSAtMTsgYW1vdW50ID0gLWFtb3VudDsgfVxuICAgICAgdmFyIGN1ciA9IGNsaXBQb3ModGhpcy5kb2MsIGZyb20pO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhbW91bnQ7ICsraSkge1xuICAgICAgICB2YXIgY29vcmRzID0gY3Vyc29yQ29vcmRzKHRoaXMkMSwgY3VyLCBcImRpdlwiKTtcbiAgICAgICAgaWYgKHggPT0gbnVsbCkgeyB4ID0gY29vcmRzLmxlZnQ7IH1cbiAgICAgICAgZWxzZSB7IGNvb3Jkcy5sZWZ0ID0geDsgfVxuICAgICAgICBjdXIgPSBmaW5kUG9zVih0aGlzJDEsIGNvb3JkcywgZGlyLCB1bml0KTtcbiAgICAgICAgaWYgKGN1ci5oaXRTaWRlKSB7IGJyZWFrIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBjdXJcbiAgICB9LFxuXG4gICAgbW92ZVY6IG1ldGhvZE9wKGZ1bmN0aW9uKGRpciwgdW5pdCkge1xuICAgICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgICAgIHZhciBkb2MgPSB0aGlzLmRvYywgZ29hbHMgPSBbXTtcbiAgICAgIHZhciBjb2xsYXBzZSA9ICF0aGlzLmRpc3BsYXkuc2hpZnQgJiYgIWRvYy5leHRlbmQgJiYgZG9jLnNlbC5zb21ldGhpbmdTZWxlY3RlZCgpO1xuICAgICAgZG9jLmV4dGVuZFNlbGVjdGlvbnNCeShmdW5jdGlvbiAocmFuZ2UkJDEpIHtcbiAgICAgICAgaWYgKGNvbGxhcHNlKVxuICAgICAgICAgIHsgcmV0dXJuIGRpciA8IDAgPyByYW5nZSQkMS5mcm9tKCkgOiByYW5nZSQkMS50bygpIH1cbiAgICAgICAgdmFyIGhlYWRQb3MgPSBjdXJzb3JDb29yZHModGhpcyQxLCByYW5nZSQkMS5oZWFkLCBcImRpdlwiKTtcbiAgICAgICAgaWYgKHJhbmdlJCQxLmdvYWxDb2x1bW4gIT0gbnVsbCkgeyBoZWFkUG9zLmxlZnQgPSByYW5nZSQkMS5nb2FsQ29sdW1uOyB9XG4gICAgICAgIGdvYWxzLnB1c2goaGVhZFBvcy5sZWZ0KTtcbiAgICAgICAgdmFyIHBvcyA9IGZpbmRQb3NWKHRoaXMkMSwgaGVhZFBvcywgZGlyLCB1bml0KTtcbiAgICAgICAgaWYgKHVuaXQgPT0gXCJwYWdlXCIgJiYgcmFuZ2UkJDEgPT0gZG9jLnNlbC5wcmltYXJ5KCkpXG4gICAgICAgICAgeyBhZGRUb1Njcm9sbFRvcCh0aGlzJDEsIGNoYXJDb29yZHModGhpcyQxLCBwb3MsIFwiZGl2XCIpLnRvcCAtIGhlYWRQb3MudG9wKTsgfVxuICAgICAgICByZXR1cm4gcG9zXG4gICAgICB9LCBzZWxfbW92ZSk7XG4gICAgICBpZiAoZ29hbHMubGVuZ3RoKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgZG9jLnNlbC5yYW5nZXMubGVuZ3RoOyBpKyspXG4gICAgICAgIHsgZG9jLnNlbC5yYW5nZXNbaV0uZ29hbENvbHVtbiA9IGdvYWxzW2ldOyB9IH1cbiAgICB9KSxcblxuICAgIC8vIEZpbmQgdGhlIHdvcmQgYXQgdGhlIGdpdmVuIHBvc2l0aW9uIChhcyByZXR1cm5lZCBieSBjb29yZHNDaGFyKS5cbiAgICBmaW5kV29yZEF0OiBmdW5jdGlvbihwb3MpIHtcbiAgICAgIHZhciBkb2MgPSB0aGlzLmRvYywgbGluZSA9IGdldExpbmUoZG9jLCBwb3MubGluZSkudGV4dDtcbiAgICAgIHZhciBzdGFydCA9IHBvcy5jaCwgZW5kID0gcG9zLmNoO1xuICAgICAgaWYgKGxpbmUpIHtcbiAgICAgICAgdmFyIGhlbHBlciA9IHRoaXMuZ2V0SGVscGVyKHBvcywgXCJ3b3JkQ2hhcnNcIik7XG4gICAgICAgIGlmICgocG9zLnN0aWNreSA9PSBcImJlZm9yZVwiIHx8IGVuZCA9PSBsaW5lLmxlbmd0aCkgJiYgc3RhcnQpIHsgLS1zdGFydDsgfSBlbHNlIHsgKytlbmQ7IH1cbiAgICAgICAgdmFyIHN0YXJ0Q2hhciA9IGxpbmUuY2hhckF0KHN0YXJ0KTtcbiAgICAgICAgdmFyIGNoZWNrID0gaXNXb3JkQ2hhcihzdGFydENoYXIsIGhlbHBlcilcbiAgICAgICAgICA/IGZ1bmN0aW9uIChjaCkgeyByZXR1cm4gaXNXb3JkQ2hhcihjaCwgaGVscGVyKTsgfVxuICAgICAgICAgIDogL1xccy8udGVzdChzdGFydENoYXIpID8gZnVuY3Rpb24gKGNoKSB7IHJldHVybiAvXFxzLy50ZXN0KGNoKTsgfVxuICAgICAgICAgIDogZnVuY3Rpb24gKGNoKSB7IHJldHVybiAoIS9cXHMvLnRlc3QoY2gpICYmICFpc1dvcmRDaGFyKGNoKSk7IH07XG4gICAgICAgIHdoaWxlIChzdGFydCA+IDAgJiYgY2hlY2sobGluZS5jaGFyQXQoc3RhcnQgLSAxKSkpIHsgLS1zdGFydDsgfVxuICAgICAgICB3aGlsZSAoZW5kIDwgbGluZS5sZW5ndGggJiYgY2hlY2sobGluZS5jaGFyQXQoZW5kKSkpIHsgKytlbmQ7IH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgUmFuZ2UoUG9zKHBvcy5saW5lLCBzdGFydCksIFBvcyhwb3MubGluZSwgZW5kKSlcbiAgICB9LFxuXG4gICAgdG9nZ2xlT3ZlcndyaXRlOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgaWYgKHZhbHVlICE9IG51bGwgJiYgdmFsdWUgPT0gdGhpcy5zdGF0ZS5vdmVyd3JpdGUpIHsgcmV0dXJuIH1cbiAgICAgIGlmICh0aGlzLnN0YXRlLm92ZXJ3cml0ZSA9ICF0aGlzLnN0YXRlLm92ZXJ3cml0ZSlcbiAgICAgICAgeyBhZGRDbGFzcyh0aGlzLmRpc3BsYXkuY3Vyc29yRGl2LCBcIkNvZGVNaXJyb3Itb3ZlcndyaXRlXCIpOyB9XG4gICAgICBlbHNlXG4gICAgICAgIHsgcm1DbGFzcyh0aGlzLmRpc3BsYXkuY3Vyc29yRGl2LCBcIkNvZGVNaXJyb3Itb3ZlcndyaXRlXCIpOyB9XG5cbiAgICAgIHNpZ25hbCh0aGlzLCBcIm92ZXJ3cml0ZVRvZ2dsZVwiLCB0aGlzLCB0aGlzLnN0YXRlLm92ZXJ3cml0ZSk7XG4gICAgfSxcbiAgICBoYXNGb2N1czogZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmRpc3BsYXkuaW5wdXQuZ2V0RmllbGQoKSA9PSBhY3RpdmVFbHQoKSB9LFxuICAgIGlzUmVhZE9ubHk6IGZ1bmN0aW9uKCkgeyByZXR1cm4gISEodGhpcy5vcHRpb25zLnJlYWRPbmx5IHx8IHRoaXMuZG9jLmNhbnRFZGl0KSB9LFxuXG4gICAgc2Nyb2xsVG86IG1ldGhvZE9wKGZ1bmN0aW9uICh4LCB5KSB7IHNjcm9sbFRvQ29vcmRzKHRoaXMsIHgsIHkpOyB9KSxcbiAgICBnZXRTY3JvbGxJbmZvOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzY3JvbGxlciA9IHRoaXMuZGlzcGxheS5zY3JvbGxlcjtcbiAgICAgIHJldHVybiB7bGVmdDogc2Nyb2xsZXIuc2Nyb2xsTGVmdCwgdG9wOiBzY3JvbGxlci5zY3JvbGxUb3AsXG4gICAgICAgICAgICAgIGhlaWdodDogc2Nyb2xsZXIuc2Nyb2xsSGVpZ2h0IC0gc2Nyb2xsR2FwKHRoaXMpIC0gdGhpcy5kaXNwbGF5LmJhckhlaWdodCxcbiAgICAgICAgICAgICAgd2lkdGg6IHNjcm9sbGVyLnNjcm9sbFdpZHRoIC0gc2Nyb2xsR2FwKHRoaXMpIC0gdGhpcy5kaXNwbGF5LmJhcldpZHRoLFxuICAgICAgICAgICAgICBjbGllbnRIZWlnaHQ6IGRpc3BsYXlIZWlnaHQodGhpcyksIGNsaWVudFdpZHRoOiBkaXNwbGF5V2lkdGgodGhpcyl9XG4gICAgfSxcblxuICAgIHNjcm9sbEludG9WaWV3OiBtZXRob2RPcChmdW5jdGlvbihyYW5nZSQkMSwgbWFyZ2luKSB7XG4gICAgICBpZiAocmFuZ2UkJDEgPT0gbnVsbCkge1xuICAgICAgICByYW5nZSQkMSA9IHtmcm9tOiB0aGlzLmRvYy5zZWwucHJpbWFyeSgpLmhlYWQsIHRvOiBudWxsfTtcbiAgICAgICAgaWYgKG1hcmdpbiA9PSBudWxsKSB7IG1hcmdpbiA9IHRoaXMub3B0aW9ucy5jdXJzb3JTY3JvbGxNYXJnaW47IH1cbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHJhbmdlJCQxID09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgcmFuZ2UkJDEgPSB7ZnJvbTogUG9zKHJhbmdlJCQxLCAwKSwgdG86IG51bGx9O1xuICAgICAgfSBlbHNlIGlmIChyYW5nZSQkMS5mcm9tID09IG51bGwpIHtcbiAgICAgICAgcmFuZ2UkJDEgPSB7ZnJvbTogcmFuZ2UkJDEsIHRvOiBudWxsfTtcbiAgICAgIH1cbiAgICAgIGlmICghcmFuZ2UkJDEudG8pIHsgcmFuZ2UkJDEudG8gPSByYW5nZSQkMS5mcm9tOyB9XG4gICAgICByYW5nZSQkMS5tYXJnaW4gPSBtYXJnaW4gfHwgMDtcblxuICAgICAgaWYgKHJhbmdlJCQxLmZyb20ubGluZSAhPSBudWxsKSB7XG4gICAgICAgIHNjcm9sbFRvUmFuZ2UodGhpcywgcmFuZ2UkJDEpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2Nyb2xsVG9Db29yZHNSYW5nZSh0aGlzLCByYW5nZSQkMS5mcm9tLCByYW5nZSQkMS50bywgcmFuZ2UkJDEubWFyZ2luKTtcbiAgICAgIH1cbiAgICB9KSxcblxuICAgIHNldFNpemU6IG1ldGhvZE9wKGZ1bmN0aW9uKHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gICAgICB2YXIgaW50ZXJwcmV0ID0gZnVuY3Rpb24gKHZhbCkgeyByZXR1cm4gdHlwZW9mIHZhbCA9PSBcIm51bWJlclwiIHx8IC9eXFxkKyQvLnRlc3QoU3RyaW5nKHZhbCkpID8gdmFsICsgXCJweFwiIDogdmFsOyB9O1xuICAgICAgaWYgKHdpZHRoICE9IG51bGwpIHsgdGhpcy5kaXNwbGF5LndyYXBwZXIuc3R5bGUud2lkdGggPSBpbnRlcnByZXQod2lkdGgpOyB9XG4gICAgICBpZiAoaGVpZ2h0ICE9IG51bGwpIHsgdGhpcy5kaXNwbGF5LndyYXBwZXIuc3R5bGUuaGVpZ2h0ID0gaW50ZXJwcmV0KGhlaWdodCk7IH1cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMubGluZVdyYXBwaW5nKSB7IGNsZWFyTGluZU1lYXN1cmVtZW50Q2FjaGUodGhpcyk7IH1cbiAgICAgIHZhciBsaW5lTm8kJDEgPSB0aGlzLmRpc3BsYXkudmlld0Zyb207XG4gICAgICB0aGlzLmRvYy5pdGVyKGxpbmVObyQkMSwgdGhpcy5kaXNwbGF5LnZpZXdUbywgZnVuY3Rpb24gKGxpbmUpIHtcbiAgICAgICAgaWYgKGxpbmUud2lkZ2V0cykgeyBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmUud2lkZ2V0cy5sZW5ndGg7IGkrKylcbiAgICAgICAgICB7IGlmIChsaW5lLndpZGdldHNbaV0ubm9IU2Nyb2xsKSB7IHJlZ0xpbmVDaGFuZ2UodGhpcyQxLCBsaW5lTm8kJDEsIFwid2lkZ2V0XCIpOyBicmVhayB9IH0gfVxuICAgICAgICArK2xpbmVObyQkMTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5jdXJPcC5mb3JjZVVwZGF0ZSA9IHRydWU7XG4gICAgICBzaWduYWwodGhpcywgXCJyZWZyZXNoXCIsIHRoaXMpO1xuICAgIH0pLFxuXG4gICAgb3BlcmF0aW9uOiBmdW5jdGlvbihmKXtyZXR1cm4gcnVuSW5PcCh0aGlzLCBmKX0sXG4gICAgc3RhcnRPcGVyYXRpb246IGZ1bmN0aW9uKCl7cmV0dXJuIHN0YXJ0T3BlcmF0aW9uKHRoaXMpfSxcbiAgICBlbmRPcGVyYXRpb246IGZ1bmN0aW9uKCl7cmV0dXJuIGVuZE9wZXJhdGlvbih0aGlzKX0sXG5cbiAgICByZWZyZXNoOiBtZXRob2RPcChmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvbGRIZWlnaHQgPSB0aGlzLmRpc3BsYXkuY2FjaGVkVGV4dEhlaWdodDtcbiAgICAgIHJlZ0NoYW5nZSh0aGlzKTtcbiAgICAgIHRoaXMuY3VyT3AuZm9yY2VVcGRhdGUgPSB0cnVlO1xuICAgICAgY2xlYXJDYWNoZXModGhpcyk7XG4gICAgICBzY3JvbGxUb0Nvb3Jkcyh0aGlzLCB0aGlzLmRvYy5zY3JvbGxMZWZ0LCB0aGlzLmRvYy5zY3JvbGxUb3ApO1xuICAgICAgdXBkYXRlR3V0dGVyU3BhY2UodGhpcyk7XG4gICAgICBpZiAob2xkSGVpZ2h0ID09IG51bGwgfHwgTWF0aC5hYnMob2xkSGVpZ2h0IC0gdGV4dEhlaWdodCh0aGlzLmRpc3BsYXkpKSA+IC41KVxuICAgICAgICB7IGVzdGltYXRlTGluZUhlaWdodHModGhpcyk7IH1cbiAgICAgIHNpZ25hbCh0aGlzLCBcInJlZnJlc2hcIiwgdGhpcyk7XG4gICAgfSksXG5cbiAgICBzd2FwRG9jOiBtZXRob2RPcChmdW5jdGlvbihkb2MpIHtcbiAgICAgIHZhciBvbGQgPSB0aGlzLmRvYztcbiAgICAgIG9sZC5jbSA9IG51bGw7XG4gICAgICBhdHRhY2hEb2ModGhpcywgZG9jKTtcbiAgICAgIGNsZWFyQ2FjaGVzKHRoaXMpO1xuICAgICAgdGhpcy5kaXNwbGF5LmlucHV0LnJlc2V0KCk7XG4gICAgICBzY3JvbGxUb0Nvb3Jkcyh0aGlzLCBkb2Muc2Nyb2xsTGVmdCwgZG9jLnNjcm9sbFRvcCk7XG4gICAgICB0aGlzLmN1ck9wLmZvcmNlU2Nyb2xsID0gdHJ1ZTtcbiAgICAgIHNpZ25hbExhdGVyKHRoaXMsIFwic3dhcERvY1wiLCB0aGlzLCBvbGQpO1xuICAgICAgcmV0dXJuIG9sZFxuICAgIH0pLFxuXG4gICAgZ2V0SW5wdXRGaWVsZDogZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5kaXNwbGF5LmlucHV0LmdldEZpZWxkKCl9LFxuICAgIGdldFdyYXBwZXJFbGVtZW50OiBmdW5jdGlvbigpe3JldHVybiB0aGlzLmRpc3BsYXkud3JhcHBlcn0sXG4gICAgZ2V0U2Nyb2xsZXJFbGVtZW50OiBmdW5jdGlvbigpe3JldHVybiB0aGlzLmRpc3BsYXkuc2Nyb2xsZXJ9LFxuICAgIGdldEd1dHRlckVsZW1lbnQ6IGZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZGlzcGxheS5ndXR0ZXJzfVxuICB9O1xuICBldmVudE1peGluKENvZGVNaXJyb3IpO1xuXG4gIENvZGVNaXJyb3IucmVnaXN0ZXJIZWxwZXIgPSBmdW5jdGlvbih0eXBlLCBuYW1lLCB2YWx1ZSkge1xuICAgIGlmICghaGVscGVycy5oYXNPd25Qcm9wZXJ0eSh0eXBlKSkgeyBoZWxwZXJzW3R5cGVdID0gQ29kZU1pcnJvclt0eXBlXSA9IHtfZ2xvYmFsOiBbXX07IH1cbiAgICBoZWxwZXJzW3R5cGVdW25hbWVdID0gdmFsdWU7XG4gIH07XG4gIENvZGVNaXJyb3IucmVnaXN0ZXJHbG9iYWxIZWxwZXIgPSBmdW5jdGlvbih0eXBlLCBuYW1lLCBwcmVkaWNhdGUsIHZhbHVlKSB7XG4gICAgQ29kZU1pcnJvci5yZWdpc3RlckhlbHBlcih0eXBlLCBuYW1lLCB2YWx1ZSk7XG4gICAgaGVscGVyc1t0eXBlXS5fZ2xvYmFsLnB1c2goe3ByZWQ6IHByZWRpY2F0ZSwgdmFsOiB2YWx1ZX0pO1xuICB9O1xufTtcblxuLy8gVXNlZCBmb3IgaG9yaXpvbnRhbCByZWxhdGl2ZSBtb3Rpb24uIERpciBpcyAtMSBvciAxIChsZWZ0IG9yXG4vLyByaWdodCksIHVuaXQgY2FuIGJlIFwiY2hhclwiLCBcImNvbHVtblwiIChsaWtlIGNoYXIsIGJ1dCBkb2Vzbid0XG4vLyBjcm9zcyBsaW5lIGJvdW5kYXJpZXMpLCBcIndvcmRcIiAoYWNyb3NzIG5leHQgd29yZCksIG9yIFwiZ3JvdXBcIiAodG9cbi8vIHRoZSBzdGFydCBvZiBuZXh0IGdyb3VwIG9mIHdvcmQgb3Igbm9uLXdvcmQtbm9uLXdoaXRlc3BhY2Vcbi8vIGNoYXJzKS4gVGhlIHZpc3VhbGx5IHBhcmFtIGNvbnRyb2xzIHdoZXRoZXIsIGluIHJpZ2h0LXRvLWxlZnRcbi8vIHRleHQsIGRpcmVjdGlvbiAxIG1lYW5zIHRvIG1vdmUgdG93YXJkcyB0aGUgbmV4dCBpbmRleCBpbiB0aGVcbi8vIHN0cmluZywgb3IgdG93YXJkcyB0aGUgY2hhcmFjdGVyIHRvIHRoZSByaWdodCBvZiB0aGUgY3VycmVudFxuLy8gcG9zaXRpb24uIFRoZSByZXN1bHRpbmcgcG9zaXRpb24gd2lsbCBoYXZlIGEgaGl0U2lkZT10cnVlXG4vLyBwcm9wZXJ0eSBpZiBpdCByZWFjaGVkIHRoZSBlbmQgb2YgdGhlIGRvY3VtZW50LlxuZnVuY3Rpb24gZmluZFBvc0goZG9jLCBwb3MsIGRpciwgdW5pdCwgdmlzdWFsbHkpIHtcbiAgdmFyIG9sZFBvcyA9IHBvcztcbiAgdmFyIG9yaWdEaXIgPSBkaXI7XG4gIHZhciBsaW5lT2JqID0gZ2V0TGluZShkb2MsIHBvcy5saW5lKTtcbiAgZnVuY3Rpb24gZmluZE5leHRMaW5lKCkge1xuICAgIHZhciBsID0gcG9zLmxpbmUgKyBkaXI7XG4gICAgaWYgKGwgPCBkb2MuZmlyc3QgfHwgbCA+PSBkb2MuZmlyc3QgKyBkb2Muc2l6ZSkgeyByZXR1cm4gZmFsc2UgfVxuICAgIHBvcyA9IG5ldyBQb3MobCwgcG9zLmNoLCBwb3Muc3RpY2t5KTtcbiAgICByZXR1cm4gbGluZU9iaiA9IGdldExpbmUoZG9jLCBsKVxuICB9XG4gIGZ1bmN0aW9uIG1vdmVPbmNlKGJvdW5kVG9MaW5lKSB7XG4gICAgdmFyIG5leHQ7XG4gICAgaWYgKHZpc3VhbGx5KSB7XG4gICAgICBuZXh0ID0gbW92ZVZpc3VhbGx5KGRvYy5jbSwgbGluZU9iaiwgcG9zLCBkaXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0ID0gbW92ZUxvZ2ljYWxseShsaW5lT2JqLCBwb3MsIGRpcik7XG4gICAgfVxuICAgIGlmIChuZXh0ID09IG51bGwpIHtcbiAgICAgIGlmICghYm91bmRUb0xpbmUgJiYgZmluZE5leHRMaW5lKCkpXG4gICAgICAgIHsgcG9zID0gZW5kT2ZMaW5lKHZpc3VhbGx5LCBkb2MuY20sIGxpbmVPYmosIHBvcy5saW5lLCBkaXIpOyB9XG4gICAgICBlbHNlXG4gICAgICAgIHsgcmV0dXJuIGZhbHNlIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcG9zID0gbmV4dDtcbiAgICB9XG4gICAgcmV0dXJuIHRydWVcbiAgfVxuXG4gIGlmICh1bml0ID09IFwiY2hhclwiKSB7XG4gICAgbW92ZU9uY2UoKTtcbiAgfSBlbHNlIGlmICh1bml0ID09IFwiY29sdW1uXCIpIHtcbiAgICBtb3ZlT25jZSh0cnVlKTtcbiAgfSBlbHNlIGlmICh1bml0ID09IFwid29yZFwiIHx8IHVuaXQgPT0gXCJncm91cFwiKSB7XG4gICAgdmFyIHNhd1R5cGUgPSBudWxsLCBncm91cCA9IHVuaXQgPT0gXCJncm91cFwiO1xuICAgIHZhciBoZWxwZXIgPSBkb2MuY20gJiYgZG9jLmNtLmdldEhlbHBlcihwb3MsIFwid29yZENoYXJzXCIpO1xuICAgIGZvciAodmFyIGZpcnN0ID0gdHJ1ZTs7IGZpcnN0ID0gZmFsc2UpIHtcbiAgICAgIGlmIChkaXIgPCAwICYmICFtb3ZlT25jZSghZmlyc3QpKSB7IGJyZWFrIH1cbiAgICAgIHZhciBjdXIgPSBsaW5lT2JqLnRleHQuY2hhckF0KHBvcy5jaCkgfHwgXCJcXG5cIjtcbiAgICAgIHZhciB0eXBlID0gaXNXb3JkQ2hhcihjdXIsIGhlbHBlcikgPyBcIndcIlxuICAgICAgICA6IGdyb3VwICYmIGN1ciA9PSBcIlxcblwiID8gXCJuXCJcbiAgICAgICAgOiAhZ3JvdXAgfHwgL1xccy8udGVzdChjdXIpID8gbnVsbFxuICAgICAgICA6IFwicFwiO1xuICAgICAgaWYgKGdyb3VwICYmICFmaXJzdCAmJiAhdHlwZSkgeyB0eXBlID0gXCJzXCI7IH1cbiAgICAgIGlmIChzYXdUeXBlICYmIHNhd1R5cGUgIT0gdHlwZSkge1xuICAgICAgICBpZiAoZGlyIDwgMCkge2RpciA9IDE7IG1vdmVPbmNlKCk7IHBvcy5zdGlja3kgPSBcImFmdGVyXCI7fVxuICAgICAgICBicmVha1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZSkgeyBzYXdUeXBlID0gdHlwZTsgfVxuICAgICAgaWYgKGRpciA+IDAgJiYgIW1vdmVPbmNlKCFmaXJzdCkpIHsgYnJlYWsgfVxuICAgIH1cbiAgfVxuICB2YXIgcmVzdWx0ID0gc2tpcEF0b21pYyhkb2MsIHBvcywgb2xkUG9zLCBvcmlnRGlyLCB0cnVlKTtcbiAgaWYgKGVxdWFsQ3Vyc29yUG9zKG9sZFBvcywgcmVzdWx0KSkgeyByZXN1bHQuaGl0U2lkZSA9IHRydWU7IH1cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG4vLyBGb3IgcmVsYXRpdmUgdmVydGljYWwgbW92ZW1lbnQuIERpciBtYXkgYmUgLTEgb3IgMS4gVW5pdCBjYW4gYmVcbi8vIFwicGFnZVwiIG9yIFwibGluZVwiLiBUaGUgcmVzdWx0aW5nIHBvc2l0aW9uIHdpbGwgaGF2ZSBhIGhpdFNpZGU9dHJ1ZVxuLy8gcHJvcGVydHkgaWYgaXQgcmVhY2hlZCB0aGUgZW5kIG9mIHRoZSBkb2N1bWVudC5cbmZ1bmN0aW9uIGZpbmRQb3NWKGNtLCBwb3MsIGRpciwgdW5pdCkge1xuICB2YXIgZG9jID0gY20uZG9jLCB4ID0gcG9zLmxlZnQsIHk7XG4gIGlmICh1bml0ID09IFwicGFnZVwiKSB7XG4gICAgdmFyIHBhZ2VTaXplID0gTWF0aC5taW4oY20uZGlzcGxheS53cmFwcGVyLmNsaWVudEhlaWdodCwgd2luZG93LmlubmVySGVpZ2h0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQpO1xuICAgIHZhciBtb3ZlQW1vdW50ID0gTWF0aC5tYXgocGFnZVNpemUgLSAuNSAqIHRleHRIZWlnaHQoY20uZGlzcGxheSksIDMpO1xuICAgIHkgPSAoZGlyID4gMCA/IHBvcy5ib3R0b20gOiBwb3MudG9wKSArIGRpciAqIG1vdmVBbW91bnQ7XG5cbiAgfSBlbHNlIGlmICh1bml0ID09IFwibGluZVwiKSB7XG4gICAgeSA9IGRpciA+IDAgPyBwb3MuYm90dG9tICsgMyA6IHBvcy50b3AgLSAzO1xuICB9XG4gIHZhciB0YXJnZXQ7XG4gIGZvciAoOzspIHtcbiAgICB0YXJnZXQgPSBjb29yZHNDaGFyKGNtLCB4LCB5KTtcbiAgICBpZiAoIXRhcmdldC5vdXRzaWRlKSB7IGJyZWFrIH1cbiAgICBpZiAoZGlyIDwgMCA/IHkgPD0gMCA6IHkgPj0gZG9jLmhlaWdodCkgeyB0YXJnZXQuaGl0U2lkZSA9IHRydWU7IGJyZWFrIH1cbiAgICB5ICs9IGRpciAqIDU7XG4gIH1cbiAgcmV0dXJuIHRhcmdldFxufVxuXG4vLyBDT05URU5URURJVEFCTEUgSU5QVVQgU1RZTEVcblxudmFyIENvbnRlbnRFZGl0YWJsZUlucHV0ID0gZnVuY3Rpb24oY20pIHtcbiAgdGhpcy5jbSA9IGNtO1xuICB0aGlzLmxhc3RBbmNob3JOb2RlID0gdGhpcy5sYXN0QW5jaG9yT2Zmc2V0ID0gdGhpcy5sYXN0Rm9jdXNOb2RlID0gdGhpcy5sYXN0Rm9jdXNPZmZzZXQgPSBudWxsO1xuICB0aGlzLnBvbGxpbmcgPSBuZXcgRGVsYXllZCgpO1xuICB0aGlzLmNvbXBvc2luZyA9IG51bGw7XG4gIHRoaXMuZ3JhY2VQZXJpb2QgPSBmYWxzZTtcbiAgdGhpcy5yZWFkRE9NVGltZW91dCA9IG51bGw7XG59O1xuXG5Db250ZW50RWRpdGFibGVJbnB1dC5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uIChkaXNwbGF5KSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgdmFyIGlucHV0ID0gdGhpcywgY20gPSBpbnB1dC5jbTtcbiAgdmFyIGRpdiA9IGlucHV0LmRpdiA9IGRpc3BsYXkubGluZURpdjtcbiAgZGlzYWJsZUJyb3dzZXJNYWdpYyhkaXYsIGNtLm9wdGlvbnMuc3BlbGxjaGVjayk7XG5cbiAgb24oZGl2LCBcInBhc3RlXCIsIGZ1bmN0aW9uIChlKSB7XG4gICAgaWYgKHNpZ25hbERPTUV2ZW50KGNtLCBlKSB8fCBoYW5kbGVQYXN0ZShlLCBjbSkpIHsgcmV0dXJuIH1cbiAgICAvLyBJRSBkb2Vzbid0IGZpcmUgaW5wdXQgZXZlbnRzLCBzbyB3ZSBzY2hlZHVsZSBhIHJlYWQgZm9yIHRoZSBwYXN0ZWQgY29udGVudCBpbiB0aGlzIHdheVxuICAgIGlmIChpZV92ZXJzaW9uIDw9IDExKSB7IHNldFRpbWVvdXQob3BlcmF0aW9uKGNtLCBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzJDEudXBkYXRlRnJvbURPTSgpOyB9KSwgMjApOyB9XG4gIH0pO1xuXG4gIG9uKGRpdiwgXCJjb21wb3NpdGlvbnN0YXJ0XCIsIGZ1bmN0aW9uIChlKSB7XG4gICAgdGhpcyQxLmNvbXBvc2luZyA9IHtkYXRhOiBlLmRhdGEsIGRvbmU6IGZhbHNlfTtcbiAgfSk7XG4gIG9uKGRpdiwgXCJjb21wb3NpdGlvbnVwZGF0ZVwiLCBmdW5jdGlvbiAoZSkge1xuICAgIGlmICghdGhpcyQxLmNvbXBvc2luZykgeyB0aGlzJDEuY29tcG9zaW5nID0ge2RhdGE6IGUuZGF0YSwgZG9uZTogZmFsc2V9OyB9XG4gIH0pO1xuICBvbihkaXYsIFwiY29tcG9zaXRpb25lbmRcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICBpZiAodGhpcyQxLmNvbXBvc2luZykge1xuICAgICAgaWYgKGUuZGF0YSAhPSB0aGlzJDEuY29tcG9zaW5nLmRhdGEpIHsgdGhpcyQxLnJlYWRGcm9tRE9NU29vbigpOyB9XG4gICAgICB0aGlzJDEuY29tcG9zaW5nLmRvbmUgPSB0cnVlO1xuICAgIH1cbiAgfSk7XG5cbiAgb24oZGl2LCBcInRvdWNoc3RhcnRcIiwgZnVuY3Rpb24gKCkgeyByZXR1cm4gaW5wdXQuZm9yY2VDb21wb3NpdGlvbkVuZCgpOyB9KTtcblxuICBvbihkaXYsIFwiaW5wdXRcIiwgZnVuY3Rpb24gKCkge1xuICAgIGlmICghdGhpcyQxLmNvbXBvc2luZykgeyB0aGlzJDEucmVhZEZyb21ET01Tb29uKCk7IH1cbiAgfSk7XG5cbiAgZnVuY3Rpb24gb25Db3B5Q3V0KGUpIHtcbiAgICBpZiAoc2lnbmFsRE9NRXZlbnQoY20sIGUpKSB7IHJldHVybiB9XG4gICAgaWYgKGNtLnNvbWV0aGluZ1NlbGVjdGVkKCkpIHtcbiAgICAgIHNldExhc3RDb3BpZWQoe2xpbmVXaXNlOiBmYWxzZSwgdGV4dDogY20uZ2V0U2VsZWN0aW9ucygpfSk7XG4gICAgICBpZiAoZS50eXBlID09IFwiY3V0XCIpIHsgY20ucmVwbGFjZVNlbGVjdGlvbihcIlwiLCBudWxsLCBcImN1dFwiKTsgfVxuICAgIH0gZWxzZSBpZiAoIWNtLm9wdGlvbnMubGluZVdpc2VDb3B5Q3V0KSB7XG4gICAgICByZXR1cm5cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHJhbmdlcyA9IGNvcHlhYmxlUmFuZ2VzKGNtKTtcbiAgICAgIHNldExhc3RDb3BpZWQoe2xpbmVXaXNlOiB0cnVlLCB0ZXh0OiByYW5nZXMudGV4dH0pO1xuICAgICAgaWYgKGUudHlwZSA9PSBcImN1dFwiKSB7XG4gICAgICAgIGNtLm9wZXJhdGlvbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgY20uc2V0U2VsZWN0aW9ucyhyYW5nZXMucmFuZ2VzLCAwLCBzZWxfZG9udFNjcm9sbCk7XG4gICAgICAgICAgY20ucmVwbGFjZVNlbGVjdGlvbihcIlwiLCBudWxsLCBcImN1dFwiKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChlLmNsaXBib2FyZERhdGEpIHtcbiAgICAgIGUuY2xpcGJvYXJkRGF0YS5jbGVhckRhdGEoKTtcbiAgICAgIHZhciBjb250ZW50ID0gbGFzdENvcGllZC50ZXh0LmpvaW4oXCJcXG5cIik7XG4gICAgICAvLyBpT1MgZXhwb3NlcyB0aGUgY2xpcGJvYXJkIEFQSSwgYnV0IHNlZW1zIHRvIGRpc2NhcmQgY29udGVudCBpbnNlcnRlZCBpbnRvIGl0XG4gICAgICBlLmNsaXBib2FyZERhdGEuc2V0RGF0YShcIlRleHRcIiwgY29udGVudCk7XG4gICAgICBpZiAoZS5jbGlwYm9hcmREYXRhLmdldERhdGEoXCJUZXh0XCIpID09IGNvbnRlbnQpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gT2xkLWZhc2hpb25lZCBicmllZmx5LWZvY3VzLWEtdGV4dGFyZWEgaGFja1xuICAgIHZhciBrbHVkZ2UgPSBoaWRkZW5UZXh0YXJlYSgpLCB0ZSA9IGtsdWRnZS5maXJzdENoaWxkO1xuICAgIGNtLmRpc3BsYXkubGluZVNwYWNlLmluc2VydEJlZm9yZShrbHVkZ2UsIGNtLmRpc3BsYXkubGluZVNwYWNlLmZpcnN0Q2hpbGQpO1xuICAgIHRlLnZhbHVlID0gbGFzdENvcGllZC50ZXh0LmpvaW4oXCJcXG5cIik7XG4gICAgdmFyIGhhZEZvY3VzID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgICBzZWxlY3RJbnB1dCh0ZSk7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICBjbS5kaXNwbGF5LmxpbmVTcGFjZS5yZW1vdmVDaGlsZChrbHVkZ2UpO1xuICAgICAgaGFkRm9jdXMuZm9jdXMoKTtcbiAgICAgIGlmIChoYWRGb2N1cyA9PSBkaXYpIHsgaW5wdXQuc2hvd1ByaW1hcnlTZWxlY3Rpb24oKTsgfVxuICAgIH0sIDUwKTtcbiAgfVxuICBvbihkaXYsIFwiY29weVwiLCBvbkNvcHlDdXQpO1xuICBvbihkaXYsIFwiY3V0XCIsIG9uQ29weUN1dCk7XG59O1xuXG5Db250ZW50RWRpdGFibGVJbnB1dC5wcm90b3R5cGUucHJlcGFyZVNlbGVjdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHJlc3VsdCA9IHByZXBhcmVTZWxlY3Rpb24odGhpcy5jbSwgZmFsc2UpO1xuICByZXN1bHQuZm9jdXMgPSB0aGlzLmNtLnN0YXRlLmZvY3VzZWQ7XG4gIHJldHVybiByZXN1bHRcbn07XG5cbkNvbnRlbnRFZGl0YWJsZUlucHV0LnByb3RvdHlwZS5zaG93U2VsZWN0aW9uID0gZnVuY3Rpb24gKGluZm8sIHRha2VGb2N1cykge1xuICBpZiAoIWluZm8gfHwgIXRoaXMuY20uZGlzcGxheS52aWV3Lmxlbmd0aCkgeyByZXR1cm4gfVxuICBpZiAoaW5mby5mb2N1cyB8fCB0YWtlRm9jdXMpIHsgdGhpcy5zaG93UHJpbWFyeVNlbGVjdGlvbigpOyB9XG4gIHRoaXMuc2hvd011bHRpcGxlU2VsZWN0aW9ucyhpbmZvKTtcbn07XG5cbkNvbnRlbnRFZGl0YWJsZUlucHV0LnByb3RvdHlwZS5zaG93UHJpbWFyeVNlbGVjdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbCA9IHdpbmRvdy5nZXRTZWxlY3Rpb24oKSwgY20gPSB0aGlzLmNtLCBwcmltID0gY20uZG9jLnNlbC5wcmltYXJ5KCk7XG4gIHZhciBmcm9tID0gcHJpbS5mcm9tKCksIHRvID0gcHJpbS50bygpO1xuXG4gIGlmIChjbS5kaXNwbGF5LnZpZXdUbyA9PSBjbS5kaXNwbGF5LnZpZXdGcm9tIHx8IGZyb20ubGluZSA+PSBjbS5kaXNwbGF5LnZpZXdUbyB8fCB0by5saW5lIDwgY20uZGlzcGxheS52aWV3RnJvbSkge1xuICAgIHNlbC5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgICByZXR1cm5cbiAgfVxuXG4gIHZhciBjdXJBbmNob3IgPSBkb21Ub1BvcyhjbSwgc2VsLmFuY2hvck5vZGUsIHNlbC5hbmNob3JPZmZzZXQpO1xuICB2YXIgY3VyRm9jdXMgPSBkb21Ub1BvcyhjbSwgc2VsLmZvY3VzTm9kZSwgc2VsLmZvY3VzT2Zmc2V0KTtcbiAgaWYgKGN1ckFuY2hvciAmJiAhY3VyQW5jaG9yLmJhZCAmJiBjdXJGb2N1cyAmJiAhY3VyRm9jdXMuYmFkICYmXG4gICAgICBjbXAobWluUG9zKGN1ckFuY2hvciwgY3VyRm9jdXMpLCBmcm9tKSA9PSAwICYmXG4gICAgICBjbXAobWF4UG9zKGN1ckFuY2hvciwgY3VyRm9jdXMpLCB0bykgPT0gMClcbiAgICB7IHJldHVybiB9XG5cbiAgdmFyIHZpZXcgPSBjbS5kaXNwbGF5LnZpZXc7XG4gIHZhciBzdGFydCA9IChmcm9tLmxpbmUgPj0gY20uZGlzcGxheS52aWV3RnJvbSAmJiBwb3NUb0RPTShjbSwgZnJvbSkpIHx8XG4gICAgICB7bm9kZTogdmlld1swXS5tZWFzdXJlLm1hcFsyXSwgb2Zmc2V0OiAwfTtcbiAgdmFyIGVuZCA9IHRvLmxpbmUgPCBjbS5kaXNwbGF5LnZpZXdUbyAmJiBwb3NUb0RPTShjbSwgdG8pO1xuICBpZiAoIWVuZCkge1xuICAgIHZhciBtZWFzdXJlID0gdmlld1t2aWV3Lmxlbmd0aCAtIDFdLm1lYXN1cmU7XG4gICAgdmFyIG1hcCQkMSA9IG1lYXN1cmUubWFwcyA/IG1lYXN1cmUubWFwc1ttZWFzdXJlLm1hcHMubGVuZ3RoIC0gMV0gOiBtZWFzdXJlLm1hcDtcbiAgICBlbmQgPSB7bm9kZTogbWFwJCQxW21hcCQkMS5sZW5ndGggLSAxXSwgb2Zmc2V0OiBtYXAkJDFbbWFwJCQxLmxlbmd0aCAtIDJdIC0gbWFwJCQxW21hcCQkMS5sZW5ndGggLSAzXX07XG4gIH1cblxuICBpZiAoIXN0YXJ0IHx8ICFlbmQpIHtcbiAgICBzZWwucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gICAgcmV0dXJuXG4gIH1cblxuICB2YXIgb2xkID0gc2VsLnJhbmdlQ291bnQgJiYgc2VsLmdldFJhbmdlQXQoMCksIHJuZztcbiAgdHJ5IHsgcm5nID0gcmFuZ2Uoc3RhcnQubm9kZSwgc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0LCBlbmQubm9kZSk7IH1cbiAgY2F0Y2goZSkge30gLy8gT3VyIG1vZGVsIG9mIHRoZSBET00gbWlnaHQgYmUgb3V0ZGF0ZWQsIGluIHdoaWNoIGNhc2UgdGhlIHJhbmdlIHdlIHRyeSB0byBzZXQgY2FuIGJlIGltcG9zc2libGVcbiAgaWYgKHJuZykge1xuICAgIGlmICghZ2Vja28gJiYgY20uc3RhdGUuZm9jdXNlZCkge1xuICAgICAgc2VsLmNvbGxhcHNlKHN0YXJ0Lm5vZGUsIHN0YXJ0Lm9mZnNldCk7XG4gICAgICBpZiAoIXJuZy5jb2xsYXBzZWQpIHtcbiAgICAgICAgc2VsLnJlbW92ZUFsbFJhbmdlcygpO1xuICAgICAgICBzZWwuYWRkUmFuZ2Uocm5nKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc2VsLnJlbW92ZUFsbFJhbmdlcygpO1xuICAgICAgc2VsLmFkZFJhbmdlKHJuZyk7XG4gICAgfVxuICAgIGlmIChvbGQgJiYgc2VsLmFuY2hvck5vZGUgPT0gbnVsbCkgeyBzZWwuYWRkUmFuZ2Uob2xkKTsgfVxuICAgIGVsc2UgaWYgKGdlY2tvKSB7IHRoaXMuc3RhcnRHcmFjZVBlcmlvZCgpOyB9XG4gIH1cbiAgdGhpcy5yZW1lbWJlclNlbGVjdGlvbigpO1xufTtcblxuQ29udGVudEVkaXRhYmxlSW5wdXQucHJvdG90eXBlLnN0YXJ0R3JhY2VQZXJpb2QgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgY2xlYXJUaW1lb3V0KHRoaXMuZ3JhY2VQZXJpb2QpO1xuICB0aGlzLmdyYWNlUGVyaW9kID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgdGhpcyQxLmdyYWNlUGVyaW9kID0gZmFsc2U7XG4gICAgaWYgKHRoaXMkMS5zZWxlY3Rpb25DaGFuZ2VkKCkpXG4gICAgICB7IHRoaXMkMS5jbS5vcGVyYXRpb24oZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpcyQxLmNtLmN1ck9wLnNlbGVjdGlvbkNoYW5nZWQgPSB0cnVlOyB9KTsgfVxuICB9LCAyMCk7XG59O1xuXG5Db250ZW50RWRpdGFibGVJbnB1dC5wcm90b3R5cGUuc2hvd011bHRpcGxlU2VsZWN0aW9ucyA9IGZ1bmN0aW9uIChpbmZvKSB7XG4gIHJlbW92ZUNoaWxkcmVuQW5kQWRkKHRoaXMuY20uZGlzcGxheS5jdXJzb3JEaXYsIGluZm8uY3Vyc29ycyk7XG4gIHJlbW92ZUNoaWxkcmVuQW5kQWRkKHRoaXMuY20uZGlzcGxheS5zZWxlY3Rpb25EaXYsIGluZm8uc2VsZWN0aW9uKTtcbn07XG5cbkNvbnRlbnRFZGl0YWJsZUlucHV0LnByb3RvdHlwZS5yZW1lbWJlclNlbGVjdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbCA9IHdpbmRvdy5nZXRTZWxlY3Rpb24oKTtcbiAgdGhpcy5sYXN0QW5jaG9yTm9kZSA9IHNlbC5hbmNob3JOb2RlOyB0aGlzLmxhc3RBbmNob3JPZmZzZXQgPSBzZWwuYW5jaG9yT2Zmc2V0O1xuICB0aGlzLmxhc3RGb2N1c05vZGUgPSBzZWwuZm9jdXNOb2RlOyB0aGlzLmxhc3RGb2N1c09mZnNldCA9IHNlbC5mb2N1c09mZnNldDtcbn07XG5cbkNvbnRlbnRFZGl0YWJsZUlucHV0LnByb3RvdHlwZS5zZWxlY3Rpb25JbkVkaXRvciA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbCA9IHdpbmRvdy5nZXRTZWxlY3Rpb24oKTtcbiAgaWYgKCFzZWwucmFuZ2VDb3VudCkgeyByZXR1cm4gZmFsc2UgfVxuICB2YXIgbm9kZSA9IHNlbC5nZXRSYW5nZUF0KDApLmNvbW1vbkFuY2VzdG9yQ29udGFpbmVyO1xuICByZXR1cm4gY29udGFpbnModGhpcy5kaXYsIG5vZGUpXG59O1xuXG5Db250ZW50RWRpdGFibGVJbnB1dC5wcm90b3R5cGUuZm9jdXMgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLmNtLm9wdGlvbnMucmVhZE9ubHkgIT0gXCJub2N1cnNvclwiKSB7XG4gICAgaWYgKCF0aGlzLnNlbGVjdGlvbkluRWRpdG9yKCkpXG4gICAgICB7IHRoaXMuc2hvd1NlbGVjdGlvbih0aGlzLnByZXBhcmVTZWxlY3Rpb24oKSwgdHJ1ZSk7IH1cbiAgICB0aGlzLmRpdi5mb2N1cygpO1xuICB9XG59O1xuQ29udGVudEVkaXRhYmxlSW5wdXQucHJvdG90eXBlLmJsdXIgPSBmdW5jdGlvbiAoKSB7IHRoaXMuZGl2LmJsdXIoKTsgfTtcbkNvbnRlbnRFZGl0YWJsZUlucHV0LnByb3RvdHlwZS5nZXRGaWVsZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXMuZGl2IH07XG5cbkNvbnRlbnRFZGl0YWJsZUlucHV0LnByb3RvdHlwZS5zdXBwb3J0c1RvdWNoID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdHJ1ZSB9O1xuXG5Db250ZW50RWRpdGFibGVJbnB1dC5wcm90b3R5cGUucmVjZWl2ZWRGb2N1cyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGlucHV0ID0gdGhpcztcbiAgaWYgKHRoaXMuc2VsZWN0aW9uSW5FZGl0b3IoKSlcbiAgICB7IHRoaXMucG9sbFNlbGVjdGlvbigpOyB9XG4gIGVsc2VcbiAgICB7IHJ1bkluT3AodGhpcy5jbSwgZnVuY3Rpb24gKCkgeyByZXR1cm4gaW5wdXQuY20uY3VyT3Auc2VsZWN0aW9uQ2hhbmdlZCA9IHRydWU7IH0pOyB9XG5cbiAgZnVuY3Rpb24gcG9sbCgpIHtcbiAgICBpZiAoaW5wdXQuY20uc3RhdGUuZm9jdXNlZCkge1xuICAgICAgaW5wdXQucG9sbFNlbGVjdGlvbigpO1xuICAgICAgaW5wdXQucG9sbGluZy5zZXQoaW5wdXQuY20ub3B0aW9ucy5wb2xsSW50ZXJ2YWwsIHBvbGwpO1xuICAgIH1cbiAgfVxuICB0aGlzLnBvbGxpbmcuc2V0KHRoaXMuY20ub3B0aW9ucy5wb2xsSW50ZXJ2YWwsIHBvbGwpO1xufTtcblxuQ29udGVudEVkaXRhYmxlSW5wdXQucHJvdG90eXBlLnNlbGVjdGlvbkNoYW5nZWQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWwgPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7XG4gIHJldHVybiBzZWwuYW5jaG9yTm9kZSAhPSB0aGlzLmxhc3RBbmNob3JOb2RlIHx8IHNlbC5hbmNob3JPZmZzZXQgIT0gdGhpcy5sYXN0QW5jaG9yT2Zmc2V0IHx8XG4gICAgc2VsLmZvY3VzTm9kZSAhPSB0aGlzLmxhc3RGb2N1c05vZGUgfHwgc2VsLmZvY3VzT2Zmc2V0ICE9IHRoaXMubGFzdEZvY3VzT2Zmc2V0XG59O1xuXG5Db250ZW50RWRpdGFibGVJbnB1dC5wcm90b3R5cGUucG9sbFNlbGVjdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMucmVhZERPTVRpbWVvdXQgIT0gbnVsbCB8fCB0aGlzLmdyYWNlUGVyaW9kIHx8ICF0aGlzLnNlbGVjdGlvbkNoYW5nZWQoKSkgeyByZXR1cm4gfVxuICB2YXIgc2VsID0gd2luZG93LmdldFNlbGVjdGlvbigpLCBjbSA9IHRoaXMuY207XG4gIC8vIE9uIEFuZHJvaWQgQ2hyb21lICh2ZXJzaW9uIDU2LCBhdCBsZWFzdCksIGJhY2tzcGFjaW5nIGludG8gYW5cbiAgLy8gdW5lZGl0YWJsZSBibG9jayBlbGVtZW50IHdpbGwgcHV0IHRoZSBjdXJzb3IgaW4gdGhhdCBlbGVtZW50LFxuICAvLyBhbmQgdGhlbiwgYmVjYXVzZSBpdCdzIG5vdCBlZGl0YWJsZSwgaGlkZSB0aGUgdmlydHVhbCBrZXlib2FyZC5cbiAgLy8gQmVjYXVzZSBBbmRyb2lkIGRvZXNuJ3QgYWxsb3cgdXMgdG8gYWN0dWFsbHkgZGV0ZWN0IGJhY2tzcGFjZVxuICAvLyBwcmVzc2VzIGluIGEgc2FuZSB3YXksIHRoaXMgY29kZSBjaGVja3MgZm9yIHdoZW4gdGhhdCBoYXBwZW5zXG4gIC8vIGFuZCBzaW11bGF0ZXMgYSBiYWNrc3BhY2UgcHJlc3MgaW4gdGhpcyBjYXNlLlxuICBpZiAoYW5kcm9pZCAmJiBjaHJvbWUgJiYgdGhpcy5jbS5vcHRpb25zLmd1dHRlcnMubGVuZ3RoICYmIGlzSW5HdXR0ZXIoc2VsLmFuY2hvck5vZGUpKSB7XG4gICAgdGhpcy5jbS50cmlnZ2VyT25LZXlEb3duKHt0eXBlOiBcImtleWRvd25cIiwga2V5Q29kZTogOCwgcHJldmVudERlZmF1bHQ6IE1hdGguYWJzfSk7XG4gICAgdGhpcy5ibHVyKCk7XG4gICAgdGhpcy5mb2N1cygpO1xuICAgIHJldHVyblxuICB9XG4gIGlmICh0aGlzLmNvbXBvc2luZykgeyByZXR1cm4gfVxuICB0aGlzLnJlbWVtYmVyU2VsZWN0aW9uKCk7XG4gIHZhciBhbmNob3IgPSBkb21Ub1BvcyhjbSwgc2VsLmFuY2hvck5vZGUsIHNlbC5hbmNob3JPZmZzZXQpO1xuICB2YXIgaGVhZCA9IGRvbVRvUG9zKGNtLCBzZWwuZm9jdXNOb2RlLCBzZWwuZm9jdXNPZmZzZXQpO1xuICBpZiAoYW5jaG9yICYmIGhlYWQpIHsgcnVuSW5PcChjbSwgZnVuY3Rpb24gKCkge1xuICAgIHNldFNlbGVjdGlvbihjbS5kb2MsIHNpbXBsZVNlbGVjdGlvbihhbmNob3IsIGhlYWQpLCBzZWxfZG9udFNjcm9sbCk7XG4gICAgaWYgKGFuY2hvci5iYWQgfHwgaGVhZC5iYWQpIHsgY20uY3VyT3Auc2VsZWN0aW9uQ2hhbmdlZCA9IHRydWU7IH1cbiAgfSk7IH1cbn07XG5cbkNvbnRlbnRFZGl0YWJsZUlucHV0LnByb3RvdHlwZS5wb2xsQ29udGVudCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMucmVhZERPTVRpbWVvdXQgIT0gbnVsbCkge1xuICAgIGNsZWFyVGltZW91dCh0aGlzLnJlYWRET01UaW1lb3V0KTtcbiAgICB0aGlzLnJlYWRET01UaW1lb3V0ID0gbnVsbDtcbiAgfVxuXG4gIHZhciBjbSA9IHRoaXMuY20sIGRpc3BsYXkgPSBjbS5kaXNwbGF5LCBzZWwgPSBjbS5kb2Muc2VsLnByaW1hcnkoKTtcbiAgdmFyIGZyb20gPSBzZWwuZnJvbSgpLCB0byA9IHNlbC50bygpO1xuICBpZiAoZnJvbS5jaCA9PSAwICYmIGZyb20ubGluZSA+IGNtLmZpcnN0TGluZSgpKVxuICAgIHsgZnJvbSA9IFBvcyhmcm9tLmxpbmUgLSAxLCBnZXRMaW5lKGNtLmRvYywgZnJvbS5saW5lIC0gMSkubGVuZ3RoKTsgfVxuICBpZiAodG8uY2ggPT0gZ2V0TGluZShjbS5kb2MsIHRvLmxpbmUpLnRleHQubGVuZ3RoICYmIHRvLmxpbmUgPCBjbS5sYXN0TGluZSgpKVxuICAgIHsgdG8gPSBQb3ModG8ubGluZSArIDEsIDApOyB9XG4gIGlmIChmcm9tLmxpbmUgPCBkaXNwbGF5LnZpZXdGcm9tIHx8IHRvLmxpbmUgPiBkaXNwbGF5LnZpZXdUbyAtIDEpIHsgcmV0dXJuIGZhbHNlIH1cblxuICB2YXIgZnJvbUluZGV4LCBmcm9tTGluZSwgZnJvbU5vZGU7XG4gIGlmIChmcm9tLmxpbmUgPT0gZGlzcGxheS52aWV3RnJvbSB8fCAoZnJvbUluZGV4ID0gZmluZFZpZXdJbmRleChjbSwgZnJvbS5saW5lKSkgPT0gMCkge1xuICAgIGZyb21MaW5lID0gbGluZU5vKGRpc3BsYXkudmlld1swXS5saW5lKTtcbiAgICBmcm9tTm9kZSA9IGRpc3BsYXkudmlld1swXS5ub2RlO1xuICB9IGVsc2Uge1xuICAgIGZyb21MaW5lID0gbGluZU5vKGRpc3BsYXkudmlld1tmcm9tSW5kZXhdLmxpbmUpO1xuICAgIGZyb21Ob2RlID0gZGlzcGxheS52aWV3W2Zyb21JbmRleCAtIDFdLm5vZGUubmV4dFNpYmxpbmc7XG4gIH1cbiAgdmFyIHRvSW5kZXggPSBmaW5kVmlld0luZGV4KGNtLCB0by5saW5lKTtcbiAgdmFyIHRvTGluZSwgdG9Ob2RlO1xuICBpZiAodG9JbmRleCA9PSBkaXNwbGF5LnZpZXcubGVuZ3RoIC0gMSkge1xuICAgIHRvTGluZSA9IGRpc3BsYXkudmlld1RvIC0gMTtcbiAgICB0b05vZGUgPSBkaXNwbGF5LmxpbmVEaXYubGFzdENoaWxkO1xuICB9IGVsc2Uge1xuICAgIHRvTGluZSA9IGxpbmVObyhkaXNwbGF5LnZpZXdbdG9JbmRleCArIDFdLmxpbmUpIC0gMTtcbiAgICB0b05vZGUgPSBkaXNwbGF5LnZpZXdbdG9JbmRleCArIDFdLm5vZGUucHJldmlvdXNTaWJsaW5nO1xuICB9XG5cbiAgaWYgKCFmcm9tTm9kZSkgeyByZXR1cm4gZmFsc2UgfVxuICB2YXIgbmV3VGV4dCA9IGNtLmRvYy5zcGxpdExpbmVzKGRvbVRleHRCZXR3ZWVuKGNtLCBmcm9tTm9kZSwgdG9Ob2RlLCBmcm9tTGluZSwgdG9MaW5lKSk7XG4gIHZhciBvbGRUZXh0ID0gZ2V0QmV0d2VlbihjbS5kb2MsIFBvcyhmcm9tTGluZSwgMCksIFBvcyh0b0xpbmUsIGdldExpbmUoY20uZG9jLCB0b0xpbmUpLnRleHQubGVuZ3RoKSk7XG4gIHdoaWxlIChuZXdUZXh0Lmxlbmd0aCA+IDEgJiYgb2xkVGV4dC5sZW5ndGggPiAxKSB7XG4gICAgaWYgKGxzdChuZXdUZXh0KSA9PSBsc3Qob2xkVGV4dCkpIHsgbmV3VGV4dC5wb3AoKTsgb2xkVGV4dC5wb3AoKTsgdG9MaW5lLS07IH1cbiAgICBlbHNlIGlmIChuZXdUZXh0WzBdID09IG9sZFRleHRbMF0pIHsgbmV3VGV4dC5zaGlmdCgpOyBvbGRUZXh0LnNoaWZ0KCk7IGZyb21MaW5lKys7IH1cbiAgICBlbHNlIHsgYnJlYWsgfVxuICB9XG5cbiAgdmFyIGN1dEZyb250ID0gMCwgY3V0RW5kID0gMDtcbiAgdmFyIG5ld1RvcCA9IG5ld1RleHRbMF0sIG9sZFRvcCA9IG9sZFRleHRbMF0sIG1heEN1dEZyb250ID0gTWF0aC5taW4obmV3VG9wLmxlbmd0aCwgb2xkVG9wLmxlbmd0aCk7XG4gIHdoaWxlIChjdXRGcm9udCA8IG1heEN1dEZyb250ICYmIG5ld1RvcC5jaGFyQ29kZUF0KGN1dEZyb250KSA9PSBvbGRUb3AuY2hhckNvZGVBdChjdXRGcm9udCkpXG4gICAgeyArK2N1dEZyb250OyB9XG4gIHZhciBuZXdCb3QgPSBsc3QobmV3VGV4dCksIG9sZEJvdCA9IGxzdChvbGRUZXh0KTtcbiAgdmFyIG1heEN1dEVuZCA9IE1hdGgubWluKG5ld0JvdC5sZW5ndGggLSAobmV3VGV4dC5sZW5ndGggPT0gMSA/IGN1dEZyb250IDogMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRCb3QubGVuZ3RoIC0gKG9sZFRleHQubGVuZ3RoID09IDEgPyBjdXRGcm9udCA6IDApKTtcbiAgd2hpbGUgKGN1dEVuZCA8IG1heEN1dEVuZCAmJlxuICAgICAgICAgbmV3Qm90LmNoYXJDb2RlQXQobmV3Qm90Lmxlbmd0aCAtIGN1dEVuZCAtIDEpID09IG9sZEJvdC5jaGFyQ29kZUF0KG9sZEJvdC5sZW5ndGggLSBjdXRFbmQgLSAxKSlcbiAgICB7ICsrY3V0RW5kOyB9XG4gIC8vIFRyeSB0byBtb3ZlIHN0YXJ0IG9mIGNoYW5nZSB0byBzdGFydCBvZiBzZWxlY3Rpb24gaWYgYW1iaWd1b3VzXG4gIGlmIChuZXdUZXh0Lmxlbmd0aCA9PSAxICYmIG9sZFRleHQubGVuZ3RoID09IDEgJiYgZnJvbUxpbmUgPT0gZnJvbS5saW5lKSB7XG4gICAgd2hpbGUgKGN1dEZyb250ICYmIGN1dEZyb250ID4gZnJvbS5jaCAmJlxuICAgICAgICAgICBuZXdCb3QuY2hhckNvZGVBdChuZXdCb3QubGVuZ3RoIC0gY3V0RW5kIC0gMSkgPT0gb2xkQm90LmNoYXJDb2RlQXQob2xkQm90Lmxlbmd0aCAtIGN1dEVuZCAtIDEpKSB7XG4gICAgICBjdXRGcm9udC0tO1xuICAgICAgY3V0RW5kKys7XG4gICAgfVxuICB9XG5cbiAgbmV3VGV4dFtuZXdUZXh0Lmxlbmd0aCAtIDFdID0gbmV3Qm90LnNsaWNlKDAsIG5ld0JvdC5sZW5ndGggLSBjdXRFbmQpLnJlcGxhY2UoL15cXHUyMDBiKy8sIFwiXCIpO1xuICBuZXdUZXh0WzBdID0gbmV3VGV4dFswXS5zbGljZShjdXRGcm9udCkucmVwbGFjZSgvXFx1MjAwYiskLywgXCJcIik7XG5cbiAgdmFyIGNoRnJvbSA9IFBvcyhmcm9tTGluZSwgY3V0RnJvbnQpO1xuICB2YXIgY2hUbyA9IFBvcyh0b0xpbmUsIG9sZFRleHQubGVuZ3RoID8gbHN0KG9sZFRleHQpLmxlbmd0aCAtIGN1dEVuZCA6IDApO1xuICBpZiAobmV3VGV4dC5sZW5ndGggPiAxIHx8IG5ld1RleHRbMF0gfHwgY21wKGNoRnJvbSwgY2hUbykpIHtcbiAgICByZXBsYWNlUmFuZ2UoY20uZG9jLCBuZXdUZXh0LCBjaEZyb20sIGNoVG8sIFwiK2lucHV0XCIpO1xuICAgIHJldHVybiB0cnVlXG4gIH1cbn07XG5cbkNvbnRlbnRFZGl0YWJsZUlucHV0LnByb3RvdHlwZS5lbnN1cmVQb2xsZWQgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuZm9yY2VDb21wb3NpdGlvbkVuZCgpO1xufTtcbkNvbnRlbnRFZGl0YWJsZUlucHV0LnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5mb3JjZUNvbXBvc2l0aW9uRW5kKCk7XG59O1xuQ29udGVudEVkaXRhYmxlSW5wdXQucHJvdG90eXBlLmZvcmNlQ29tcG9zaXRpb25FbmQgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICghdGhpcy5jb21wb3NpbmcpIHsgcmV0dXJuIH1cbiAgY2xlYXJUaW1lb3V0KHRoaXMucmVhZERPTVRpbWVvdXQpO1xuICB0aGlzLmNvbXBvc2luZyA9IG51bGw7XG4gIHRoaXMudXBkYXRlRnJvbURPTSgpO1xuICB0aGlzLmRpdi5ibHVyKCk7XG4gIHRoaXMuZGl2LmZvY3VzKCk7XG59O1xuQ29udGVudEVkaXRhYmxlSW5wdXQucHJvdG90eXBlLnJlYWRGcm9tRE9NU29vbiA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICBpZiAodGhpcy5yZWFkRE9NVGltZW91dCAhPSBudWxsKSB7IHJldHVybiB9XG4gIHRoaXMucmVhZERPTVRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzJDEucmVhZERPTVRpbWVvdXQgPSBudWxsO1xuICAgIGlmICh0aGlzJDEuY29tcG9zaW5nKSB7XG4gICAgICBpZiAodGhpcyQxLmNvbXBvc2luZy5kb25lKSB7IHRoaXMkMS5jb21wb3NpbmcgPSBudWxsOyB9XG4gICAgICBlbHNlIHsgcmV0dXJuIH1cbiAgICB9XG4gICAgdGhpcyQxLnVwZGF0ZUZyb21ET00oKTtcbiAgfSwgODApO1xufTtcblxuQ29udGVudEVkaXRhYmxlSW5wdXQucHJvdG90eXBlLnVwZGF0ZUZyb21ET00gPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHRoaXMkMSA9IHRoaXM7XG5cbiAgaWYgKHRoaXMuY20uaXNSZWFkT25seSgpIHx8ICF0aGlzLnBvbGxDb250ZW50KCkpXG4gICAgeyBydW5Jbk9wKHRoaXMuY20sIGZ1bmN0aW9uICgpIHsgcmV0dXJuIHJlZ0NoYW5nZSh0aGlzJDEuY20pOyB9KTsgfVxufTtcblxuQ29udGVudEVkaXRhYmxlSW5wdXQucHJvdG90eXBlLnNldFVuZWRpdGFibGUgPSBmdW5jdGlvbiAobm9kZSkge1xuICBub2RlLmNvbnRlbnRFZGl0YWJsZSA9IFwiZmFsc2VcIjtcbn07XG5cbkNvbnRlbnRFZGl0YWJsZUlucHV0LnByb3RvdHlwZS5vbktleVByZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgaWYgKGUuY2hhckNvZGUgPT0gMCkgeyByZXR1cm4gfVxuICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIGlmICghdGhpcy5jbS5pc1JlYWRPbmx5KCkpXG4gICAgeyBvcGVyYXRpb24odGhpcy5jbSwgYXBwbHlUZXh0SW5wdXQpKHRoaXMuY20sIFN0cmluZy5mcm9tQ2hhckNvZGUoZS5jaGFyQ29kZSA9PSBudWxsID8gZS5rZXlDb2RlIDogZS5jaGFyQ29kZSksIDApOyB9XG59O1xuXG5Db250ZW50RWRpdGFibGVJbnB1dC5wcm90b3R5cGUucmVhZE9ubHlDaGFuZ2VkID0gZnVuY3Rpb24gKHZhbCkge1xuICB0aGlzLmRpdi5jb250ZW50RWRpdGFibGUgPSBTdHJpbmcodmFsICE9IFwibm9jdXJzb3JcIik7XG59O1xuXG5Db250ZW50RWRpdGFibGVJbnB1dC5wcm90b3R5cGUub25Db250ZXh0TWVudSA9IGZ1bmN0aW9uICgpIHt9O1xuQ29udGVudEVkaXRhYmxlSW5wdXQucHJvdG90eXBlLnJlc2V0UG9zaXRpb24gPSBmdW5jdGlvbiAoKSB7fTtcblxuQ29udGVudEVkaXRhYmxlSW5wdXQucHJvdG90eXBlLm5lZWRzQ29udGVudEF0dHJpYnV0ZSA9IHRydWU7XG5cbmZ1bmN0aW9uIHBvc1RvRE9NKGNtLCBwb3MpIHtcbiAgdmFyIHZpZXcgPSBmaW5kVmlld0ZvckxpbmUoY20sIHBvcy5saW5lKTtcbiAgaWYgKCF2aWV3IHx8IHZpZXcuaGlkZGVuKSB7IHJldHVybiBudWxsIH1cbiAgdmFyIGxpbmUgPSBnZXRMaW5lKGNtLmRvYywgcG9zLmxpbmUpO1xuICB2YXIgaW5mbyA9IG1hcEZyb21MaW5lVmlldyh2aWV3LCBsaW5lLCBwb3MubGluZSk7XG5cbiAgdmFyIG9yZGVyID0gZ2V0T3JkZXIobGluZSwgY20uZG9jLmRpcmVjdGlvbiksIHNpZGUgPSBcImxlZnRcIjtcbiAgaWYgKG9yZGVyKSB7XG4gICAgdmFyIHBhcnRQb3MgPSBnZXRCaWRpUGFydEF0KG9yZGVyLCBwb3MuY2gpO1xuICAgIHNpZGUgPSBwYXJ0UG9zICUgMiA/IFwicmlnaHRcIiA6IFwibGVmdFwiO1xuICB9XG4gIHZhciByZXN1bHQgPSBub2RlQW5kT2Zmc2V0SW5MaW5lTWFwKGluZm8ubWFwLCBwb3MuY2gsIHNpZGUpO1xuICByZXN1bHQub2Zmc2V0ID0gcmVzdWx0LmNvbGxhcHNlID09IFwicmlnaHRcIiA/IHJlc3VsdC5lbmQgOiByZXN1bHQuc3RhcnQ7XG4gIHJldHVybiByZXN1bHRcbn1cblxuZnVuY3Rpb24gaXNJbkd1dHRlcihub2RlKSB7XG4gIGZvciAodmFyIHNjYW4gPSBub2RlOyBzY2FuOyBzY2FuID0gc2Nhbi5wYXJlbnROb2RlKVxuICAgIHsgaWYgKC9Db2RlTWlycm9yLWd1dHRlci13cmFwcGVyLy50ZXN0KHNjYW4uY2xhc3NOYW1lKSkgeyByZXR1cm4gdHJ1ZSB9IH1cbiAgcmV0dXJuIGZhbHNlXG59XG5cbmZ1bmN0aW9uIGJhZFBvcyhwb3MsIGJhZCkgeyBpZiAoYmFkKSB7IHBvcy5iYWQgPSB0cnVlOyB9IHJldHVybiBwb3MgfVxuXG5mdW5jdGlvbiBkb21UZXh0QmV0d2VlbihjbSwgZnJvbSwgdG8sIGZyb21MaW5lLCB0b0xpbmUpIHtcbiAgdmFyIHRleHQgPSBcIlwiLCBjbG9zaW5nID0gZmFsc2UsIGxpbmVTZXAgPSBjbS5kb2MubGluZVNlcGFyYXRvcigpO1xuICBmdW5jdGlvbiByZWNvZ25pemVNYXJrZXIoaWQpIHsgcmV0dXJuIGZ1bmN0aW9uIChtYXJrZXIpIHsgcmV0dXJuIG1hcmtlci5pZCA9PSBpZDsgfSB9XG4gIGZ1bmN0aW9uIGNsb3NlKCkge1xuICAgIGlmIChjbG9zaW5nKSB7XG4gICAgICB0ZXh0ICs9IGxpbmVTZXA7XG4gICAgICBjbG9zaW5nID0gZmFsc2U7XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIGFkZFRleHQoc3RyKSB7XG4gICAgaWYgKHN0cikge1xuICAgICAgY2xvc2UoKTtcbiAgICAgIHRleHQgKz0gc3RyO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiB3YWxrKG5vZGUpIHtcbiAgICBpZiAobm9kZS5ub2RlVHlwZSA9PSAxKSB7XG4gICAgICB2YXIgY21UZXh0ID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCJjbS10ZXh0XCIpO1xuICAgICAgaWYgKGNtVGV4dCAhPSBudWxsKSB7XG4gICAgICAgIGFkZFRleHQoY21UZXh0IHx8IG5vZGUudGV4dENvbnRlbnQucmVwbGFjZSgvXFx1MjAwYi9nLCBcIlwiKSk7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgdmFyIG1hcmtlcklEID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCJjbS1tYXJrZXJcIiksIHJhbmdlJCQxO1xuICAgICAgaWYgKG1hcmtlcklEKSB7XG4gICAgICAgIHZhciBmb3VuZCA9IGNtLmZpbmRNYXJrcyhQb3MoZnJvbUxpbmUsIDApLCBQb3ModG9MaW5lICsgMSwgMCksIHJlY29nbml6ZU1hcmtlcigrbWFya2VySUQpKTtcbiAgICAgICAgaWYgKGZvdW5kLmxlbmd0aCAmJiAocmFuZ2UkJDEgPSBmb3VuZFswXS5maW5kKDApKSlcbiAgICAgICAgICB7IGFkZFRleHQoZ2V0QmV0d2VlbihjbS5kb2MsIHJhbmdlJCQxLmZyb20sIHJhbmdlJCQxLnRvKS5qb2luKGxpbmVTZXApKTsgfVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGlmIChub2RlLmdldEF0dHJpYnV0ZShcImNvbnRlbnRlZGl0YWJsZVwiKSA9PSBcImZhbHNlXCIpIHsgcmV0dXJuIH1cbiAgICAgIHZhciBpc0Jsb2NrID0gL14ocHJlfGRpdnxwKSQvaS50ZXN0KG5vZGUubm9kZU5hbWUpO1xuICAgICAgaWYgKGlzQmxvY2spIHsgY2xvc2UoKTsgfVxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2RlLmNoaWxkTm9kZXMubGVuZ3RoOyBpKyspXG4gICAgICAgIHsgd2Fsayhub2RlLmNoaWxkTm9kZXNbaV0pOyB9XG4gICAgICBpZiAoaXNCbG9jaykgeyBjbG9zaW5nID0gdHJ1ZTsgfVxuICAgIH0gZWxzZSBpZiAobm9kZS5ub2RlVHlwZSA9PSAzKSB7XG4gICAgICBhZGRUZXh0KG5vZGUubm9kZVZhbHVlKTtcbiAgICB9XG4gIH1cbiAgZm9yICg7Oykge1xuICAgIHdhbGsoZnJvbSk7XG4gICAgaWYgKGZyb20gPT0gdG8pIHsgYnJlYWsgfVxuICAgIGZyb20gPSBmcm9tLm5leHRTaWJsaW5nO1xuICB9XG4gIHJldHVybiB0ZXh0XG59XG5cbmZ1bmN0aW9uIGRvbVRvUG9zKGNtLCBub2RlLCBvZmZzZXQpIHtcbiAgdmFyIGxpbmVOb2RlO1xuICBpZiAobm9kZSA9PSBjbS5kaXNwbGF5LmxpbmVEaXYpIHtcbiAgICBsaW5lTm9kZSA9IGNtLmRpc3BsYXkubGluZURpdi5jaGlsZE5vZGVzW29mZnNldF07XG4gICAgaWYgKCFsaW5lTm9kZSkgeyByZXR1cm4gYmFkUG9zKGNtLmNsaXBQb3MoUG9zKGNtLmRpc3BsYXkudmlld1RvIC0gMSkpLCB0cnVlKSB9XG4gICAgbm9kZSA9IG51bGw7IG9mZnNldCA9IDA7XG4gIH0gZWxzZSB7XG4gICAgZm9yIChsaW5lTm9kZSA9IG5vZGU7OyBsaW5lTm9kZSA9IGxpbmVOb2RlLnBhcmVudE5vZGUpIHtcbiAgICAgIGlmICghbGluZU5vZGUgfHwgbGluZU5vZGUgPT0gY20uZGlzcGxheS5saW5lRGl2KSB7IHJldHVybiBudWxsIH1cbiAgICAgIGlmIChsaW5lTm9kZS5wYXJlbnROb2RlICYmIGxpbmVOb2RlLnBhcmVudE5vZGUgPT0gY20uZGlzcGxheS5saW5lRGl2KSB7IGJyZWFrIH1cbiAgICB9XG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBjbS5kaXNwbGF5LnZpZXcubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgbGluZVZpZXcgPSBjbS5kaXNwbGF5LnZpZXdbaV07XG4gICAgaWYgKGxpbmVWaWV3Lm5vZGUgPT0gbGluZU5vZGUpXG4gICAgICB7IHJldHVybiBsb2NhdGVOb2RlSW5MaW5lVmlldyhsaW5lVmlldywgbm9kZSwgb2Zmc2V0KSB9XG4gIH1cbn1cblxuZnVuY3Rpb24gbG9jYXRlTm9kZUluTGluZVZpZXcobGluZVZpZXcsIG5vZGUsIG9mZnNldCkge1xuICB2YXIgd3JhcHBlciA9IGxpbmVWaWV3LnRleHQuZmlyc3RDaGlsZCwgYmFkID0gZmFsc2U7XG4gIGlmICghbm9kZSB8fCAhY29udGFpbnMod3JhcHBlciwgbm9kZSkpIHsgcmV0dXJuIGJhZFBvcyhQb3MobGluZU5vKGxpbmVWaWV3LmxpbmUpLCAwKSwgdHJ1ZSkgfVxuICBpZiAobm9kZSA9PSB3cmFwcGVyKSB7XG4gICAgYmFkID0gdHJ1ZTtcbiAgICBub2RlID0gd3JhcHBlci5jaGlsZE5vZGVzW29mZnNldF07XG4gICAgb2Zmc2V0ID0gMDtcbiAgICBpZiAoIW5vZGUpIHtcbiAgICAgIHZhciBsaW5lID0gbGluZVZpZXcucmVzdCA/IGxzdChsaW5lVmlldy5yZXN0KSA6IGxpbmVWaWV3LmxpbmU7XG4gICAgICByZXR1cm4gYmFkUG9zKFBvcyhsaW5lTm8obGluZSksIGxpbmUudGV4dC5sZW5ndGgpLCBiYWQpXG4gICAgfVxuICB9XG5cbiAgdmFyIHRleHROb2RlID0gbm9kZS5ub2RlVHlwZSA9PSAzID8gbm9kZSA6IG51bGwsIHRvcE5vZGUgPSBub2RlO1xuICBpZiAoIXRleHROb2RlICYmIG5vZGUuY2hpbGROb2Rlcy5sZW5ndGggPT0gMSAmJiBub2RlLmZpcnN0Q2hpbGQubm9kZVR5cGUgPT0gMykge1xuICAgIHRleHROb2RlID0gbm9kZS5maXJzdENoaWxkO1xuICAgIGlmIChvZmZzZXQpIHsgb2Zmc2V0ID0gdGV4dE5vZGUubm9kZVZhbHVlLmxlbmd0aDsgfVxuICB9XG4gIHdoaWxlICh0b3BOb2RlLnBhcmVudE5vZGUgIT0gd3JhcHBlcikgeyB0b3BOb2RlID0gdG9wTm9kZS5wYXJlbnROb2RlOyB9XG4gIHZhciBtZWFzdXJlID0gbGluZVZpZXcubWVhc3VyZSwgbWFwcyA9IG1lYXN1cmUubWFwcztcblxuICBmdW5jdGlvbiBmaW5kKHRleHROb2RlLCB0b3BOb2RlLCBvZmZzZXQpIHtcbiAgICBmb3IgKHZhciBpID0gLTE7IGkgPCAobWFwcyA/IG1hcHMubGVuZ3RoIDogMCk7IGkrKykge1xuICAgICAgdmFyIG1hcCQkMSA9IGkgPCAwID8gbWVhc3VyZS5tYXAgOiBtYXBzW2ldO1xuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBtYXAkJDEubGVuZ3RoOyBqICs9IDMpIHtcbiAgICAgICAgdmFyIGN1ck5vZGUgPSBtYXAkJDFbaiArIDJdO1xuICAgICAgICBpZiAoY3VyTm9kZSA9PSB0ZXh0Tm9kZSB8fCBjdXJOb2RlID09IHRvcE5vZGUpIHtcbiAgICAgICAgICB2YXIgbGluZSA9IGxpbmVObyhpIDwgMCA/IGxpbmVWaWV3LmxpbmUgOiBsaW5lVmlldy5yZXN0W2ldKTtcbiAgICAgICAgICB2YXIgY2ggPSBtYXAkJDFbal0gKyBvZmZzZXQ7XG4gICAgICAgICAgaWYgKG9mZnNldCA8IDAgfHwgY3VyTm9kZSAhPSB0ZXh0Tm9kZSkgeyBjaCA9IG1hcCQkMVtqICsgKG9mZnNldCA/IDEgOiAwKV07IH1cbiAgICAgICAgICByZXR1cm4gUG9zKGxpbmUsIGNoKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHZhciBmb3VuZCA9IGZpbmQodGV4dE5vZGUsIHRvcE5vZGUsIG9mZnNldCk7XG4gIGlmIChmb3VuZCkgeyByZXR1cm4gYmFkUG9zKGZvdW5kLCBiYWQpIH1cblxuICAvLyBGSVhNRSB0aGlzIGlzIGFsbCByZWFsbHkgc2hha3kuIG1pZ2h0IGhhbmRsZSB0aGUgZmV3IGNhc2VzIGl0IG5lZWRzIHRvIGhhbmRsZSwgYnV0IGxpa2VseSB0byBjYXVzZSBwcm9ibGVtc1xuICBmb3IgKHZhciBhZnRlciA9IHRvcE5vZGUubmV4dFNpYmxpbmcsIGRpc3QgPSB0ZXh0Tm9kZSA/IHRleHROb2RlLm5vZGVWYWx1ZS5sZW5ndGggLSBvZmZzZXQgOiAwOyBhZnRlcjsgYWZ0ZXIgPSBhZnRlci5uZXh0U2libGluZykge1xuICAgIGZvdW5kID0gZmluZChhZnRlciwgYWZ0ZXIuZmlyc3RDaGlsZCwgMCk7XG4gICAgaWYgKGZvdW5kKVxuICAgICAgeyByZXR1cm4gYmFkUG9zKFBvcyhmb3VuZC5saW5lLCBmb3VuZC5jaCAtIGRpc3QpLCBiYWQpIH1cbiAgICBlbHNlXG4gICAgICB7IGRpc3QgKz0gYWZ0ZXIudGV4dENvbnRlbnQubGVuZ3RoOyB9XG4gIH1cbiAgZm9yICh2YXIgYmVmb3JlID0gdG9wTm9kZS5wcmV2aW91c1NpYmxpbmcsIGRpc3QkMSA9IG9mZnNldDsgYmVmb3JlOyBiZWZvcmUgPSBiZWZvcmUucHJldmlvdXNTaWJsaW5nKSB7XG4gICAgZm91bmQgPSBmaW5kKGJlZm9yZSwgYmVmb3JlLmZpcnN0Q2hpbGQsIC0xKTtcbiAgICBpZiAoZm91bmQpXG4gICAgICB7IHJldHVybiBiYWRQb3MoUG9zKGZvdW5kLmxpbmUsIGZvdW5kLmNoICsgZGlzdCQxKSwgYmFkKSB9XG4gICAgZWxzZVxuICAgICAgeyBkaXN0JDEgKz0gYmVmb3JlLnRleHRDb250ZW50Lmxlbmd0aDsgfVxuICB9XG59XG5cbi8vIFRFWFRBUkVBIElOUFVUIFNUWUxFXG5cbnZhciBUZXh0YXJlYUlucHV0ID0gZnVuY3Rpb24oY20pIHtcbiAgdGhpcy5jbSA9IGNtO1xuICAvLyBTZWUgaW5wdXQucG9sbCBhbmQgaW5wdXQucmVzZXRcbiAgdGhpcy5wcmV2SW5wdXQgPSBcIlwiO1xuXG4gIC8vIEZsYWcgdGhhdCBpbmRpY2F0ZXMgd2hldGhlciB3ZSBleHBlY3QgaW5wdXQgdG8gYXBwZWFyIHJlYWwgc29vblxuICAvLyBub3cgKGFmdGVyIHNvbWUgZXZlbnQgbGlrZSAna2V5cHJlc3MnIG9yICdpbnB1dCcpIGFuZCBhcmVcbiAgLy8gcG9sbGluZyBpbnRlbnNpdmVseS5cbiAgdGhpcy5wb2xsaW5nRmFzdCA9IGZhbHNlO1xuICAvLyBTZWxmLXJlc2V0dGluZyB0aW1lb3V0IGZvciB0aGUgcG9sbGVyXG4gIHRoaXMucG9sbGluZyA9IG5ldyBEZWxheWVkKCk7XG4gIC8vIFVzZWQgdG8gd29yayBhcm91bmQgSUUgaXNzdWUgd2l0aCBzZWxlY3Rpb24gYmVpbmcgZm9yZ290dGVuIHdoZW4gZm9jdXMgbW92ZXMgYXdheSBmcm9tIHRleHRhcmVhXG4gIHRoaXMuaGFzU2VsZWN0aW9uID0gZmFsc2U7XG4gIHRoaXMuY29tcG9zaW5nID0gbnVsbDtcbn07XG5cblRleHRhcmVhSW5wdXQucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiAoZGlzcGxheSkge1xuICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gIHZhciBpbnB1dCA9IHRoaXMsIGNtID0gdGhpcy5jbTtcblxuICAvLyBXcmFwcyBhbmQgaGlkZXMgaW5wdXQgdGV4dGFyZWFcbiAgdmFyIGRpdiA9IHRoaXMud3JhcHBlciA9IGhpZGRlblRleHRhcmVhKCk7XG4gIC8vIFRoZSBzZW1paGlkZGVuIHRleHRhcmVhIHRoYXQgaXMgZm9jdXNlZCB3aGVuIHRoZSBlZGl0b3IgaXNcbiAgLy8gZm9jdXNlZCwgYW5kIHJlY2VpdmVzIGlucHV0LlxuICB2YXIgdGUgPSB0aGlzLnRleHRhcmVhID0gZGl2LmZpcnN0Q2hpbGQ7XG4gIGRpc3BsYXkud3JhcHBlci5pbnNlcnRCZWZvcmUoZGl2LCBkaXNwbGF5LndyYXBwZXIuZmlyc3RDaGlsZCk7XG5cbiAgLy8gTmVlZGVkIHRvIGhpZGUgYmlnIGJsdWUgYmxpbmtpbmcgY3Vyc29yIG9uIE1vYmlsZSBTYWZhcmkgKGRvZXNuJ3Qgc2VlbSB0byB3b3JrIGluIGlPUyA4IGFueW1vcmUpXG4gIGlmIChpb3MpIHsgdGUuc3R5bGUud2lkdGggPSBcIjBweFwiOyB9XG5cbiAgb24odGUsIFwiaW5wdXRcIiwgZnVuY3Rpb24gKCkge1xuICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uID49IDkgJiYgdGhpcyQxLmhhc1NlbGVjdGlvbikgeyB0aGlzJDEuaGFzU2VsZWN0aW9uID0gbnVsbDsgfVxuICAgIGlucHV0LnBvbGwoKTtcbiAgfSk7XG5cbiAgb24odGUsIFwicGFzdGVcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICBpZiAoc2lnbmFsRE9NRXZlbnQoY20sIGUpIHx8IGhhbmRsZVBhc3RlKGUsIGNtKSkgeyByZXR1cm4gfVxuXG4gICAgY20uc3RhdGUucGFzdGVJbmNvbWluZyA9IHRydWU7XG4gICAgaW5wdXQuZmFzdFBvbGwoKTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gcHJlcGFyZUNvcHlDdXQoZSkge1xuICAgIGlmIChzaWduYWxET01FdmVudChjbSwgZSkpIHsgcmV0dXJuIH1cbiAgICBpZiAoY20uc29tZXRoaW5nU2VsZWN0ZWQoKSkge1xuICAgICAgc2V0TGFzdENvcGllZCh7bGluZVdpc2U6IGZhbHNlLCB0ZXh0OiBjbS5nZXRTZWxlY3Rpb25zKCl9KTtcbiAgICB9IGVsc2UgaWYgKCFjbS5vcHRpb25zLmxpbmVXaXNlQ29weUN1dCkge1xuICAgICAgcmV0dXJuXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciByYW5nZXMgPSBjb3B5YWJsZVJhbmdlcyhjbSk7XG4gICAgICBzZXRMYXN0Q29waWVkKHtsaW5lV2lzZTogdHJ1ZSwgdGV4dDogcmFuZ2VzLnRleHR9KTtcbiAgICAgIGlmIChlLnR5cGUgPT0gXCJjdXRcIikge1xuICAgICAgICBjbS5zZXRTZWxlY3Rpb25zKHJhbmdlcy5yYW5nZXMsIG51bGwsIHNlbF9kb250U2Nyb2xsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlucHV0LnByZXZJbnB1dCA9IFwiXCI7XG4gICAgICAgIHRlLnZhbHVlID0gcmFuZ2VzLnRleHQuam9pbihcIlxcblwiKTtcbiAgICAgICAgc2VsZWN0SW5wdXQodGUpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZS50eXBlID09IFwiY3V0XCIpIHsgY20uc3RhdGUuY3V0SW5jb21pbmcgPSB0cnVlOyB9XG4gIH1cbiAgb24odGUsIFwiY3V0XCIsIHByZXBhcmVDb3B5Q3V0KTtcbiAgb24odGUsIFwiY29weVwiLCBwcmVwYXJlQ29weUN1dCk7XG5cbiAgb24oZGlzcGxheS5zY3JvbGxlciwgXCJwYXN0ZVwiLCBmdW5jdGlvbiAoZSkge1xuICAgIGlmIChldmVudEluV2lkZ2V0KGRpc3BsYXksIGUpIHx8IHNpZ25hbERPTUV2ZW50KGNtLCBlKSkgeyByZXR1cm4gfVxuICAgIGNtLnN0YXRlLnBhc3RlSW5jb21pbmcgPSB0cnVlO1xuICAgIGlucHV0LmZvY3VzKCk7XG4gIH0pO1xuXG4gIC8vIFByZXZlbnQgbm9ybWFsIHNlbGVjdGlvbiBpbiB0aGUgZWRpdG9yICh3ZSBoYW5kbGUgb3VyIG93bilcbiAgb24oZGlzcGxheS5saW5lU3BhY2UsIFwic2VsZWN0c3RhcnRcIiwgZnVuY3Rpb24gKGUpIHtcbiAgICBpZiAoIWV2ZW50SW5XaWRnZXQoZGlzcGxheSwgZSkpIHsgZV9wcmV2ZW50RGVmYXVsdChlKTsgfVxuICB9KTtcblxuICBvbih0ZSwgXCJjb21wb3NpdGlvbnN0YXJ0XCIsIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc3RhcnQgPSBjbS5nZXRDdXJzb3IoXCJmcm9tXCIpO1xuICAgIGlmIChpbnB1dC5jb21wb3NpbmcpIHsgaW5wdXQuY29tcG9zaW5nLnJhbmdlLmNsZWFyKCk7IH1cbiAgICBpbnB1dC5jb21wb3NpbmcgPSB7XG4gICAgICBzdGFydDogc3RhcnQsXG4gICAgICByYW5nZTogY20ubWFya1RleHQoc3RhcnQsIGNtLmdldEN1cnNvcihcInRvXCIpLCB7Y2xhc3NOYW1lOiBcIkNvZGVNaXJyb3ItY29tcG9zaW5nXCJ9KVxuICAgIH07XG4gIH0pO1xuICBvbih0ZSwgXCJjb21wb3NpdGlvbmVuZFwiLCBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKGlucHV0LmNvbXBvc2luZykge1xuICAgICAgaW5wdXQucG9sbCgpO1xuICAgICAgaW5wdXQuY29tcG9zaW5nLnJhbmdlLmNsZWFyKCk7XG4gICAgICBpbnB1dC5jb21wb3NpbmcgPSBudWxsO1xuICAgIH1cbiAgfSk7XG59O1xuXG5UZXh0YXJlYUlucHV0LnByb3RvdHlwZS5wcmVwYXJlU2VsZWN0aW9uID0gZnVuY3Rpb24gKCkge1xuICAvLyBSZWRyYXcgdGhlIHNlbGVjdGlvbiBhbmQvb3IgY3Vyc29yXG4gIHZhciBjbSA9IHRoaXMuY20sIGRpc3BsYXkgPSBjbS5kaXNwbGF5LCBkb2MgPSBjbS5kb2M7XG4gIHZhciByZXN1bHQgPSBwcmVwYXJlU2VsZWN0aW9uKGNtKTtcblxuICAvLyBNb3ZlIHRoZSBoaWRkZW4gdGV4dGFyZWEgbmVhciB0aGUgY3Vyc29yIHRvIHByZXZlbnQgc2Nyb2xsaW5nIGFydGlmYWN0c1xuICBpZiAoY20ub3B0aW9ucy5tb3ZlSW5wdXRXaXRoQ3Vyc29yKSB7XG4gICAgdmFyIGhlYWRQb3MgPSBjdXJzb3JDb29yZHMoY20sIGRvYy5zZWwucHJpbWFyeSgpLmhlYWQsIFwiZGl2XCIpO1xuICAgIHZhciB3cmFwT2ZmID0gZGlzcGxheS53cmFwcGVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLCBsaW5lT2ZmID0gZGlzcGxheS5saW5lRGl2LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHJlc3VsdC50ZVRvcCA9IE1hdGgubWF4KDAsIE1hdGgubWluKGRpc3BsYXkud3JhcHBlci5jbGllbnRIZWlnaHQgLSAxMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkUG9zLnRvcCArIGxpbmVPZmYudG9wIC0gd3JhcE9mZi50b3ApKTtcbiAgICByZXN1bHQudGVMZWZ0ID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oZGlzcGxheS53cmFwcGVyLmNsaWVudFdpZHRoIC0gMTAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRQb3MubGVmdCArIGxpbmVPZmYubGVmdCAtIHdyYXBPZmYubGVmdCkpO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufTtcblxuVGV4dGFyZWFJbnB1dC5wcm90b3R5cGUuc2hvd1NlbGVjdGlvbiA9IGZ1bmN0aW9uIChkcmF3bikge1xuICB2YXIgY20gPSB0aGlzLmNtLCBkaXNwbGF5ID0gY20uZGlzcGxheTtcbiAgcmVtb3ZlQ2hpbGRyZW5BbmRBZGQoZGlzcGxheS5jdXJzb3JEaXYsIGRyYXduLmN1cnNvcnMpO1xuICByZW1vdmVDaGlsZHJlbkFuZEFkZChkaXNwbGF5LnNlbGVjdGlvbkRpdiwgZHJhd24uc2VsZWN0aW9uKTtcbiAgaWYgKGRyYXduLnRlVG9wICE9IG51bGwpIHtcbiAgICB0aGlzLndyYXBwZXIuc3R5bGUudG9wID0gZHJhd24udGVUb3AgKyBcInB4XCI7XG4gICAgdGhpcy53cmFwcGVyLnN0eWxlLmxlZnQgPSBkcmF3bi50ZUxlZnQgKyBcInB4XCI7XG4gIH1cbn07XG5cbi8vIFJlc2V0IHRoZSBpbnB1dCB0byBjb3JyZXNwb25kIHRvIHRoZSBzZWxlY3Rpb24gKG9yIHRvIGJlIGVtcHR5LFxuLy8gd2hlbiBub3QgdHlwaW5nIGFuZCBub3RoaW5nIGlzIHNlbGVjdGVkKVxuVGV4dGFyZWFJbnB1dC5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbiAodHlwaW5nKSB7XG4gIGlmICh0aGlzLmNvbnRleHRNZW51UGVuZGluZyB8fCB0aGlzLmNvbXBvc2luZykgeyByZXR1cm4gfVxuICB2YXIgY20gPSB0aGlzLmNtO1xuICBpZiAoY20uc29tZXRoaW5nU2VsZWN0ZWQoKSkge1xuICAgIHRoaXMucHJldklucHV0ID0gXCJcIjtcbiAgICB2YXIgY29udGVudCA9IGNtLmdldFNlbGVjdGlvbigpO1xuICAgIHRoaXMudGV4dGFyZWEudmFsdWUgPSBjb250ZW50O1xuICAgIGlmIChjbS5zdGF0ZS5mb2N1c2VkKSB7IHNlbGVjdElucHV0KHRoaXMudGV4dGFyZWEpOyB9XG4gICAgaWYgKGllICYmIGllX3ZlcnNpb24gPj0gOSkgeyB0aGlzLmhhc1NlbGVjdGlvbiA9IGNvbnRlbnQ7IH1cbiAgfSBlbHNlIGlmICghdHlwaW5nKSB7XG4gICAgdGhpcy5wcmV2SW5wdXQgPSB0aGlzLnRleHRhcmVhLnZhbHVlID0gXCJcIjtcbiAgICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA+PSA5KSB7IHRoaXMuaGFzU2VsZWN0aW9uID0gbnVsbDsgfVxuICB9XG59O1xuXG5UZXh0YXJlYUlucHV0LnByb3RvdHlwZS5nZXRGaWVsZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXMudGV4dGFyZWEgfTtcblxuVGV4dGFyZWFJbnB1dC5wcm90b3R5cGUuc3VwcG9ydHNUb3VjaCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIGZhbHNlIH07XG5cblRleHRhcmVhSW5wdXQucHJvdG90eXBlLmZvY3VzID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5jbS5vcHRpb25zLnJlYWRPbmx5ICE9IFwibm9jdXJzb3JcIiAmJiAoIW1vYmlsZSB8fCBhY3RpdmVFbHQoKSAhPSB0aGlzLnRleHRhcmVhKSkge1xuICAgIHRyeSB7IHRoaXMudGV4dGFyZWEuZm9jdXMoKTsgfVxuICAgIGNhdGNoIChlKSB7fSAvLyBJRTggd2lsbCB0aHJvdyBpZiB0aGUgdGV4dGFyZWEgaXMgZGlzcGxheTogbm9uZSBvciBub3QgaW4gRE9NXG4gIH1cbn07XG5cblRleHRhcmVhSW5wdXQucHJvdG90eXBlLmJsdXIgPSBmdW5jdGlvbiAoKSB7IHRoaXMudGV4dGFyZWEuYmx1cigpOyB9O1xuXG5UZXh0YXJlYUlucHV0LnByb3RvdHlwZS5yZXNldFBvc2l0aW9uID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLndyYXBwZXIuc3R5bGUudG9wID0gdGhpcy53cmFwcGVyLnN0eWxlLmxlZnQgPSAwO1xufTtcblxuVGV4dGFyZWFJbnB1dC5wcm90b3R5cGUucmVjZWl2ZWRGb2N1cyA9IGZ1bmN0aW9uICgpIHsgdGhpcy5zbG93UG9sbCgpOyB9O1xuXG4vLyBQb2xsIGZvciBpbnB1dCBjaGFuZ2VzLCB1c2luZyB0aGUgbm9ybWFsIHJhdGUgb2YgcG9sbGluZy4gVGhpc1xuLy8gcnVucyBhcyBsb25nIGFzIHRoZSBlZGl0b3IgaXMgZm9jdXNlZC5cblRleHRhcmVhSW5wdXQucHJvdG90eXBlLnNsb3dQb2xsID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciB0aGlzJDEgPSB0aGlzO1xuXG4gIGlmICh0aGlzLnBvbGxpbmdGYXN0KSB7IHJldHVybiB9XG4gIHRoaXMucG9sbGluZy5zZXQodGhpcy5jbS5vcHRpb25zLnBvbGxJbnRlcnZhbCwgZnVuY3Rpb24gKCkge1xuICAgIHRoaXMkMS5wb2xsKCk7XG4gICAgaWYgKHRoaXMkMS5jbS5zdGF0ZS5mb2N1c2VkKSB7IHRoaXMkMS5zbG93UG9sbCgpOyB9XG4gIH0pO1xufTtcblxuLy8gV2hlbiBhbiBldmVudCBoYXMganVzdCBjb21lIGluIHRoYXQgaXMgbGlrZWx5IHRvIGFkZCBvciBjaGFuZ2Vcbi8vIHNvbWV0aGluZyBpbiB0aGUgaW5wdXQgdGV4dGFyZWEsIHdlIHBvbGwgZmFzdGVyLCB0byBlbnN1cmUgdGhhdFxuLy8gdGhlIGNoYW5nZSBhcHBlYXJzIG9uIHRoZSBzY3JlZW4gcXVpY2tseS5cblRleHRhcmVhSW5wdXQucHJvdG90eXBlLmZhc3RQb2xsID0gZnVuY3Rpb24gKCkge1xuICB2YXIgbWlzc2VkID0gZmFsc2UsIGlucHV0ID0gdGhpcztcbiAgaW5wdXQucG9sbGluZ0Zhc3QgPSB0cnVlO1xuICBmdW5jdGlvbiBwKCkge1xuICAgIHZhciBjaGFuZ2VkID0gaW5wdXQucG9sbCgpO1xuICAgIGlmICghY2hhbmdlZCAmJiAhbWlzc2VkKSB7bWlzc2VkID0gdHJ1ZTsgaW5wdXQucG9sbGluZy5zZXQoNjAsIHApO31cbiAgICBlbHNlIHtpbnB1dC5wb2xsaW5nRmFzdCA9IGZhbHNlOyBpbnB1dC5zbG93UG9sbCgpO31cbiAgfVxuICBpbnB1dC5wb2xsaW5nLnNldCgyMCwgcCk7XG59O1xuXG4vLyBSZWFkIGlucHV0IGZyb20gdGhlIHRleHRhcmVhLCBhbmQgdXBkYXRlIHRoZSBkb2N1bWVudCB0byBtYXRjaC5cbi8vIFdoZW4gc29tZXRoaW5nIGlzIHNlbGVjdGVkLCBpdCBpcyBwcmVzZW50IGluIHRoZSB0ZXh0YXJlYSwgYW5kXG4vLyBzZWxlY3RlZCAodW5sZXNzIGl0IGlzIGh1Z2UsIGluIHdoaWNoIGNhc2UgYSBwbGFjZWhvbGRlciBpc1xuLy8gdXNlZCkuIFdoZW4gbm90aGluZyBpcyBzZWxlY3RlZCwgdGhlIGN1cnNvciBzaXRzIGFmdGVyIHByZXZpb3VzbHlcbi8vIHNlZW4gdGV4dCAoY2FuIGJlIGVtcHR5KSwgd2hpY2ggaXMgc3RvcmVkIGluIHByZXZJbnB1dCAod2UgbXVzdFxuLy8gbm90IHJlc2V0IHRoZSB0ZXh0YXJlYSB3aGVuIHR5cGluZywgYmVjYXVzZSB0aGF0IGJyZWFrcyBJTUUpLlxuVGV4dGFyZWFJbnB1dC5wcm90b3R5cGUucG9sbCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdGhpcyQxID0gdGhpcztcblxuICB2YXIgY20gPSB0aGlzLmNtLCBpbnB1dCA9IHRoaXMudGV4dGFyZWEsIHByZXZJbnB1dCA9IHRoaXMucHJldklucHV0O1xuICAvLyBTaW5jZSB0aGlzIGlzIGNhbGxlZCBhICpsb3QqLCB0cnkgdG8gYmFpbCBvdXQgYXMgY2hlYXBseSBhc1xuICAvLyBwb3NzaWJsZSB3aGVuIGl0IGlzIGNsZWFyIHRoYXQgbm90aGluZyBoYXBwZW5lZC4gaGFzU2VsZWN0aW9uXG4gIC8vIHdpbGwgYmUgdGhlIGNhc2Ugd2hlbiB0aGVyZSBpcyBhIGxvdCBvZiB0ZXh0IGluIHRoZSB0ZXh0YXJlYSxcbiAgLy8gaW4gd2hpY2ggY2FzZSByZWFkaW5nIGl0cyB2YWx1ZSB3b3VsZCBiZSBleHBlbnNpdmUuXG4gIGlmICh0aGlzLmNvbnRleHRNZW51UGVuZGluZyB8fCAhY20uc3RhdGUuZm9jdXNlZCB8fFxuICAgICAgKGhhc1NlbGVjdGlvbihpbnB1dCkgJiYgIXByZXZJbnB1dCAmJiAhdGhpcy5jb21wb3NpbmcpIHx8XG4gICAgICBjbS5pc1JlYWRPbmx5KCkgfHwgY20ub3B0aW9ucy5kaXNhYmxlSW5wdXQgfHwgY20uc3RhdGUua2V5U2VxKVxuICAgIHsgcmV0dXJuIGZhbHNlIH1cblxuICB2YXIgdGV4dCA9IGlucHV0LnZhbHVlO1xuICAvLyBJZiBub3RoaW5nIGNoYW5nZWQsIGJhaWwuXG4gIGlmICh0ZXh0ID09IHByZXZJbnB1dCAmJiAhY20uc29tZXRoaW5nU2VsZWN0ZWQoKSkgeyByZXR1cm4gZmFsc2UgfVxuICAvLyBXb3JrIGFyb3VuZCBub25zZW5zaWNhbCBzZWxlY3Rpb24gcmVzZXR0aW5nIGluIElFOS8xMCwgYW5kXG4gIC8vIGluZXhwbGljYWJsZSBhcHBlYXJhbmNlIG9mIHByaXZhdGUgYXJlYSB1bmljb2RlIGNoYXJhY3RlcnMgb25cbiAgLy8gc29tZSBrZXkgY29tYm9zIGluIE1hYyAoIzI2ODkpLlxuICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA+PSA5ICYmIHRoaXMuaGFzU2VsZWN0aW9uID09PSB0ZXh0IHx8XG4gICAgICBtYWMgJiYgL1tcXHVmNzAwLVxcdWY3ZmZdLy50ZXN0KHRleHQpKSB7XG4gICAgY20uZGlzcGxheS5pbnB1dC5yZXNldCgpO1xuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgaWYgKGNtLmRvYy5zZWwgPT0gY20uZGlzcGxheS5zZWxGb3JDb250ZXh0TWVudSkge1xuICAgIHZhciBmaXJzdCA9IHRleHQuY2hhckNvZGVBdCgwKTtcbiAgICBpZiAoZmlyc3QgPT0gMHgyMDBiICYmICFwcmV2SW5wdXQpIHsgcHJldklucHV0ID0gXCJcXHUyMDBiXCI7IH1cbiAgICBpZiAoZmlyc3QgPT0gMHgyMWRhKSB7IHRoaXMucmVzZXQoKTsgcmV0dXJuIHRoaXMuY20uZXhlY0NvbW1hbmQoXCJ1bmRvXCIpIH1cbiAgfVxuICAvLyBGaW5kIHRoZSBwYXJ0IG9mIHRoZSBpbnB1dCB0aGF0IGlzIGFjdHVhbGx5IG5ld1xuICB2YXIgc2FtZSA9IDAsIGwgPSBNYXRoLm1pbihwcmV2SW5wdXQubGVuZ3RoLCB0ZXh0Lmxlbmd0aCk7XG4gIHdoaWxlIChzYW1lIDwgbCAmJiBwcmV2SW5wdXQuY2hhckNvZGVBdChzYW1lKSA9PSB0ZXh0LmNoYXJDb2RlQXQoc2FtZSkpIHsgKytzYW1lOyB9XG5cbiAgcnVuSW5PcChjbSwgZnVuY3Rpb24gKCkge1xuICAgIGFwcGx5VGV4dElucHV0KGNtLCB0ZXh0LnNsaWNlKHNhbWUpLCBwcmV2SW5wdXQubGVuZ3RoIC0gc2FtZSxcbiAgICAgICAgICAgICAgICAgICBudWxsLCB0aGlzJDEuY29tcG9zaW5nID8gXCIqY29tcG9zZVwiIDogbnVsbCk7XG5cbiAgICAvLyBEb24ndCBsZWF2ZSBsb25nIHRleHQgaW4gdGhlIHRleHRhcmVhLCBzaW5jZSBpdCBtYWtlcyBmdXJ0aGVyIHBvbGxpbmcgc2xvd1xuICAgIGlmICh0ZXh0Lmxlbmd0aCA+IDEwMDAgfHwgdGV4dC5pbmRleE9mKFwiXFxuXCIpID4gLTEpIHsgaW5wdXQudmFsdWUgPSB0aGlzJDEucHJldklucHV0ID0gXCJcIjsgfVxuICAgIGVsc2UgeyB0aGlzJDEucHJldklucHV0ID0gdGV4dDsgfVxuXG4gICAgaWYgKHRoaXMkMS5jb21wb3NpbmcpIHtcbiAgICAgIHRoaXMkMS5jb21wb3NpbmcucmFuZ2UuY2xlYXIoKTtcbiAgICAgIHRoaXMkMS5jb21wb3NpbmcucmFuZ2UgPSBjbS5tYXJrVGV4dCh0aGlzJDEuY29tcG9zaW5nLnN0YXJ0LCBjbS5nZXRDdXJzb3IoXCJ0b1wiKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2NsYXNzTmFtZTogXCJDb2RlTWlycm9yLWNvbXBvc2luZ1wifSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHRydWVcbn07XG5cblRleHRhcmVhSW5wdXQucHJvdG90eXBlLmVuc3VyZVBvbGxlZCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMucG9sbGluZ0Zhc3QgJiYgdGhpcy5wb2xsKCkpIHsgdGhpcy5wb2xsaW5nRmFzdCA9IGZhbHNlOyB9XG59O1xuXG5UZXh0YXJlYUlucHV0LnByb3RvdHlwZS5vbktleVByZXNzID0gZnVuY3Rpb24gKCkge1xuICBpZiAoaWUgJiYgaWVfdmVyc2lvbiA+PSA5KSB7IHRoaXMuaGFzU2VsZWN0aW9uID0gbnVsbDsgfVxuICB0aGlzLmZhc3RQb2xsKCk7XG59O1xuXG5UZXh0YXJlYUlucHV0LnByb3RvdHlwZS5vbkNvbnRleHRNZW51ID0gZnVuY3Rpb24gKGUpIHtcbiAgdmFyIGlucHV0ID0gdGhpcywgY20gPSBpbnB1dC5jbSwgZGlzcGxheSA9IGNtLmRpc3BsYXksIHRlID0gaW5wdXQudGV4dGFyZWE7XG4gIHZhciBwb3MgPSBwb3NGcm9tTW91c2UoY20sIGUpLCBzY3JvbGxQb3MgPSBkaXNwbGF5LnNjcm9sbGVyLnNjcm9sbFRvcDtcbiAgaWYgKCFwb3MgfHwgcHJlc3RvKSB7IHJldHVybiB9IC8vIE9wZXJhIGlzIGRpZmZpY3VsdC5cblxuICAvLyBSZXNldCB0aGUgY3VycmVudCB0ZXh0IHNlbGVjdGlvbiBvbmx5IGlmIHRoZSBjbGljayBpcyBkb25lIG91dHNpZGUgb2YgdGhlIHNlbGVjdGlvblxuICAvLyBhbmQgJ3Jlc2V0U2VsZWN0aW9uT25Db250ZXh0TWVudScgb3B0aW9uIGlzIHRydWUuXG4gIHZhciByZXNldCA9IGNtLm9wdGlvbnMucmVzZXRTZWxlY3Rpb25PbkNvbnRleHRNZW51O1xuICBpZiAocmVzZXQgJiYgY20uZG9jLnNlbC5jb250YWlucyhwb3MpID09IC0xKVxuICAgIHsgb3BlcmF0aW9uKGNtLCBzZXRTZWxlY3Rpb24pKGNtLmRvYywgc2ltcGxlU2VsZWN0aW9uKHBvcyksIHNlbF9kb250U2Nyb2xsKTsgfVxuXG4gIHZhciBvbGRDU1MgPSB0ZS5zdHlsZS5jc3NUZXh0LCBvbGRXcmFwcGVyQ1NTID0gaW5wdXQud3JhcHBlci5zdHlsZS5jc3NUZXh0O1xuICBpbnB1dC53cmFwcGVyLnN0eWxlLmNzc1RleHQgPSBcInBvc2l0aW9uOiBhYnNvbHV0ZVwiO1xuICB2YXIgd3JhcHBlckJveCA9IGlucHV0LndyYXBwZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gIHRlLnN0eWxlLmNzc1RleHQgPSBcInBvc2l0aW9uOiBhYnNvbHV0ZTsgd2lkdGg6IDMwcHg7IGhlaWdodDogMzBweDtcXG4gICAgICB0b3A6IFwiICsgKGUuY2xpZW50WSAtIHdyYXBwZXJCb3gudG9wIC0gNSkgKyBcInB4OyBsZWZ0OiBcIiArIChlLmNsaWVudFggLSB3cmFwcGVyQm94LmxlZnQgLSA1KSArIFwicHg7XFxuICAgICAgei1pbmRleDogMTAwMDsgYmFja2dyb3VuZDogXCIgKyAoaWUgPyBcInJnYmEoMjU1LCAyNTUsIDI1NSwgLjA1KVwiIDogXCJ0cmFuc3BhcmVudFwiKSArIFwiO1xcbiAgICAgIG91dGxpbmU6IG5vbmU7IGJvcmRlci13aWR0aDogMDsgb3V0bGluZTogbm9uZTsgb3ZlcmZsb3c6IGhpZGRlbjsgb3BhY2l0eTogLjA1OyBmaWx0ZXI6IGFscGhhKG9wYWNpdHk9NSk7XCI7XG4gIHZhciBvbGRTY3JvbGxZO1xuICBpZiAod2Via2l0KSB7IG9sZFNjcm9sbFkgPSB3aW5kb3cuc2Nyb2xsWTsgfSAvLyBXb3JrIGFyb3VuZCBDaHJvbWUgaXNzdWUgKCMyNzEyKVxuICBkaXNwbGF5LmlucHV0LmZvY3VzKCk7XG4gIGlmICh3ZWJraXQpIHsgd2luZG93LnNjcm9sbFRvKG51bGwsIG9sZFNjcm9sbFkpOyB9XG4gIGRpc3BsYXkuaW5wdXQucmVzZXQoKTtcbiAgLy8gQWRkcyBcIlNlbGVjdCBhbGxcIiB0byBjb250ZXh0IG1lbnUgaW4gRkZcbiAgaWYgKCFjbS5zb21ldGhpbmdTZWxlY3RlZCgpKSB7IHRlLnZhbHVlID0gaW5wdXQucHJldklucHV0ID0gXCIgXCI7IH1cbiAgaW5wdXQuY29udGV4dE1lbnVQZW5kaW5nID0gdHJ1ZTtcbiAgZGlzcGxheS5zZWxGb3JDb250ZXh0TWVudSA9IGNtLmRvYy5zZWw7XG4gIGNsZWFyVGltZW91dChkaXNwbGF5LmRldGVjdGluZ1NlbGVjdEFsbCk7XG5cbiAgLy8gU2VsZWN0LWFsbCB3aWxsIGJlIGdyZXllZCBvdXQgaWYgdGhlcmUncyBub3RoaW5nIHRvIHNlbGVjdCwgc29cbiAgLy8gdGhpcyBhZGRzIGEgemVyby13aWR0aCBzcGFjZSBzbyB0aGF0IHdlIGNhbiBsYXRlciBjaGVjayB3aGV0aGVyXG4gIC8vIGl0IGdvdCBzZWxlY3RlZC5cbiAgZnVuY3Rpb24gcHJlcGFyZVNlbGVjdEFsbEhhY2soKSB7XG4gICAgaWYgKHRlLnNlbGVjdGlvblN0YXJ0ICE9IG51bGwpIHtcbiAgICAgIHZhciBzZWxlY3RlZCA9IGNtLnNvbWV0aGluZ1NlbGVjdGVkKCk7XG4gICAgICB2YXIgZXh0dmFsID0gXCJcXHUyMDBiXCIgKyAoc2VsZWN0ZWQgPyB0ZS52YWx1ZSA6IFwiXCIpO1xuICAgICAgdGUudmFsdWUgPSBcIlxcdTIxZGFcIjsgLy8gVXNlZCB0byBjYXRjaCBjb250ZXh0LW1lbnUgdW5kb1xuICAgICAgdGUudmFsdWUgPSBleHR2YWw7XG4gICAgICBpbnB1dC5wcmV2SW5wdXQgPSBzZWxlY3RlZCA/IFwiXCIgOiBcIlxcdTIwMGJcIjtcbiAgICAgIHRlLnNlbGVjdGlvblN0YXJ0ID0gMTsgdGUuc2VsZWN0aW9uRW5kID0gZXh0dmFsLmxlbmd0aDtcbiAgICAgIC8vIFJlLXNldCB0aGlzLCBpbiBjYXNlIHNvbWUgb3RoZXIgaGFuZGxlciB0b3VjaGVkIHRoZVxuICAgICAgLy8gc2VsZWN0aW9uIGluIHRoZSBtZWFudGltZS5cbiAgICAgIGRpc3BsYXkuc2VsRm9yQ29udGV4dE1lbnUgPSBjbS5kb2Muc2VsO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiByZWhpZGUoKSB7XG4gICAgaW5wdXQuY29udGV4dE1lbnVQZW5kaW5nID0gZmFsc2U7XG4gICAgaW5wdXQud3JhcHBlci5zdHlsZS5jc3NUZXh0ID0gb2xkV3JhcHBlckNTUztcbiAgICB0ZS5zdHlsZS5jc3NUZXh0ID0gb2xkQ1NTO1xuICAgIGlmIChpZSAmJiBpZV92ZXJzaW9uIDwgOSkgeyBkaXNwbGF5LnNjcm9sbGJhcnMuc2V0U2Nyb2xsVG9wKGRpc3BsYXkuc2Nyb2xsZXIuc2Nyb2xsVG9wID0gc2Nyb2xsUG9zKTsgfVxuXG4gICAgLy8gVHJ5IHRvIGRldGVjdCB0aGUgdXNlciBjaG9vc2luZyBzZWxlY3QtYWxsXG4gICAgaWYgKHRlLnNlbGVjdGlvblN0YXJ0ICE9IG51bGwpIHtcbiAgICAgIGlmICghaWUgfHwgKGllICYmIGllX3ZlcnNpb24gPCA5KSkgeyBwcmVwYXJlU2VsZWN0QWxsSGFjaygpOyB9XG4gICAgICB2YXIgaSA9IDAsIHBvbGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChkaXNwbGF5LnNlbEZvckNvbnRleHRNZW51ID09IGNtLmRvYy5zZWwgJiYgdGUuc2VsZWN0aW9uU3RhcnQgPT0gMCAmJlxuICAgICAgICAgICAgdGUuc2VsZWN0aW9uRW5kID4gMCAmJiBpbnB1dC5wcmV2SW5wdXQgPT0gXCJcXHUyMDBiXCIpIHtcbiAgICAgICAgICBvcGVyYXRpb24oY20sIHNlbGVjdEFsbCkoY20pO1xuICAgICAgICB9IGVsc2UgaWYgKGkrKyA8IDEwKSB7XG4gICAgICAgICAgZGlzcGxheS5kZXRlY3RpbmdTZWxlY3RBbGwgPSBzZXRUaW1lb3V0KHBvbGwsIDUwMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGlzcGxheS5zZWxGb3JDb250ZXh0TWVudSA9IG51bGw7XG4gICAgICAgICAgZGlzcGxheS5pbnB1dC5yZXNldCgpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgZGlzcGxheS5kZXRlY3RpbmdTZWxlY3RBbGwgPSBzZXRUaW1lb3V0KHBvbGwsIDIwMCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGllICYmIGllX3ZlcnNpb24gPj0gOSkgeyBwcmVwYXJlU2VsZWN0QWxsSGFjaygpOyB9XG4gIGlmIChjYXB0dXJlUmlnaHRDbGljaykge1xuICAgIGVfc3RvcChlKTtcbiAgICB2YXIgbW91c2V1cCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIG9mZih3aW5kb3csIFwibW91c2V1cFwiLCBtb3VzZXVwKTtcbiAgICAgIHNldFRpbWVvdXQocmVoaWRlLCAyMCk7XG4gICAgfTtcbiAgICBvbih3aW5kb3csIFwibW91c2V1cFwiLCBtb3VzZXVwKTtcbiAgfSBlbHNlIHtcbiAgICBzZXRUaW1lb3V0KHJlaGlkZSwgNTApO1xuICB9XG59O1xuXG5UZXh0YXJlYUlucHV0LnByb3RvdHlwZS5yZWFkT25seUNoYW5nZWQgPSBmdW5jdGlvbiAodmFsKSB7XG4gIGlmICghdmFsKSB7IHRoaXMucmVzZXQoKTsgfVxuICB0aGlzLnRleHRhcmVhLmRpc2FibGVkID0gdmFsID09IFwibm9jdXJzb3JcIjtcbn07XG5cblRleHRhcmVhSW5wdXQucHJvdG90eXBlLnNldFVuZWRpdGFibGUgPSBmdW5jdGlvbiAoKSB7fTtcblxuVGV4dGFyZWFJbnB1dC5wcm90b3R5cGUubmVlZHNDb250ZW50QXR0cmlidXRlID0gZmFsc2U7XG5cbmZ1bmN0aW9uIGZyb21UZXh0QXJlYSh0ZXh0YXJlYSwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyA/IGNvcHlPYmoob3B0aW9ucykgOiB7fTtcbiAgb3B0aW9ucy52YWx1ZSA9IHRleHRhcmVhLnZhbHVlO1xuICBpZiAoIW9wdGlvbnMudGFiaW5kZXggJiYgdGV4dGFyZWEudGFiSW5kZXgpXG4gICAgeyBvcHRpb25zLnRhYmluZGV4ID0gdGV4dGFyZWEudGFiSW5kZXg7IH1cbiAgaWYgKCFvcHRpb25zLnBsYWNlaG9sZGVyICYmIHRleHRhcmVhLnBsYWNlaG9sZGVyKVxuICAgIHsgb3B0aW9ucy5wbGFjZWhvbGRlciA9IHRleHRhcmVhLnBsYWNlaG9sZGVyOyB9XG4gIC8vIFNldCBhdXRvZm9jdXMgdG8gdHJ1ZSBpZiB0aGlzIHRleHRhcmVhIGlzIGZvY3VzZWQsIG9yIGlmIGl0IGhhc1xuICAvLyBhdXRvZm9jdXMgYW5kIG5vIG90aGVyIGVsZW1lbnQgaXMgZm9jdXNlZC5cbiAgaWYgKG9wdGlvbnMuYXV0b2ZvY3VzID09IG51bGwpIHtcbiAgICB2YXIgaGFzRm9jdXMgPSBhY3RpdmVFbHQoKTtcbiAgICBvcHRpb25zLmF1dG9mb2N1cyA9IGhhc0ZvY3VzID09IHRleHRhcmVhIHx8XG4gICAgICB0ZXh0YXJlYS5nZXRBdHRyaWJ1dGUoXCJhdXRvZm9jdXNcIikgIT0gbnVsbCAmJiBoYXNGb2N1cyA9PSBkb2N1bWVudC5ib2R5O1xuICB9XG5cbiAgZnVuY3Rpb24gc2F2ZSgpIHt0ZXh0YXJlYS52YWx1ZSA9IGNtLmdldFZhbHVlKCk7fVxuXG4gIHZhciByZWFsU3VibWl0O1xuICBpZiAodGV4dGFyZWEuZm9ybSkge1xuICAgIG9uKHRleHRhcmVhLmZvcm0sIFwic3VibWl0XCIsIHNhdmUpO1xuICAgIC8vIERlcGxvcmFibGUgaGFjayB0byBtYWtlIHRoZSBzdWJtaXQgbWV0aG9kIGRvIHRoZSByaWdodCB0aGluZy5cbiAgICBpZiAoIW9wdGlvbnMubGVhdmVTdWJtaXRNZXRob2RBbG9uZSkge1xuICAgICAgdmFyIGZvcm0gPSB0ZXh0YXJlYS5mb3JtO1xuICAgICAgcmVhbFN1Ym1pdCA9IGZvcm0uc3VibWl0O1xuICAgICAgdHJ5IHtcbiAgICAgICAgdmFyIHdyYXBwZWRTdWJtaXQgPSBmb3JtLnN1Ym1pdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBzYXZlKCk7XG4gICAgICAgICAgZm9ybS5zdWJtaXQgPSByZWFsU3VibWl0O1xuICAgICAgICAgIGZvcm0uc3VibWl0KCk7XG4gICAgICAgICAgZm9ybS5zdWJtaXQgPSB3cmFwcGVkU3VibWl0O1xuICAgICAgICB9O1xuICAgICAgfSBjYXRjaChlKSB7fVxuICAgIH1cbiAgfVxuXG4gIG9wdGlvbnMuZmluaXNoSW5pdCA9IGZ1bmN0aW9uIChjbSkge1xuICAgIGNtLnNhdmUgPSBzYXZlO1xuICAgIGNtLmdldFRleHRBcmVhID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGV4dGFyZWE7IH07XG4gICAgY20udG9UZXh0QXJlYSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGNtLnRvVGV4dEFyZWEgPSBpc05hTjsgLy8gUHJldmVudCB0aGlzIGZyb20gYmVpbmcgcmFuIHR3aWNlXG4gICAgICBzYXZlKCk7XG4gICAgICB0ZXh0YXJlYS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGNtLmdldFdyYXBwZXJFbGVtZW50KCkpO1xuICAgICAgdGV4dGFyZWEuc3R5bGUuZGlzcGxheSA9IFwiXCI7XG4gICAgICBpZiAodGV4dGFyZWEuZm9ybSkge1xuICAgICAgICBvZmYodGV4dGFyZWEuZm9ybSwgXCJzdWJtaXRcIiwgc2F2ZSk7XG4gICAgICAgIGlmICh0eXBlb2YgdGV4dGFyZWEuZm9ybS5zdWJtaXQgPT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgIHsgdGV4dGFyZWEuZm9ybS5zdWJtaXQgPSByZWFsU3VibWl0OyB9XG4gICAgICB9XG4gICAgfTtcbiAgfTtcblxuICB0ZXh0YXJlYS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gIHZhciBjbSA9IENvZGVNaXJyb3IkMShmdW5jdGlvbiAobm9kZSkgeyByZXR1cm4gdGV4dGFyZWEucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUobm9kZSwgdGV4dGFyZWEubmV4dFNpYmxpbmcpOyB9LFxuICAgIG9wdGlvbnMpO1xuICByZXR1cm4gY21cbn1cblxuZnVuY3Rpb24gYWRkTGVnYWN5UHJvcHMoQ29kZU1pcnJvcikge1xuICBDb2RlTWlycm9yLm9mZiA9IG9mZjtcbiAgQ29kZU1pcnJvci5vbiA9IG9uO1xuICBDb2RlTWlycm9yLndoZWVsRXZlbnRQaXhlbHMgPSB3aGVlbEV2ZW50UGl4ZWxzO1xuICBDb2RlTWlycm9yLkRvYyA9IERvYztcbiAgQ29kZU1pcnJvci5zcGxpdExpbmVzID0gc3BsaXRMaW5lc0F1dG87XG4gIENvZGVNaXJyb3IuY291bnRDb2x1bW4gPSBjb3VudENvbHVtbjtcbiAgQ29kZU1pcnJvci5maW5kQ29sdW1uID0gZmluZENvbHVtbjtcbiAgQ29kZU1pcnJvci5pc1dvcmRDaGFyID0gaXNXb3JkQ2hhckJhc2ljO1xuICBDb2RlTWlycm9yLlBhc3MgPSBQYXNzO1xuICBDb2RlTWlycm9yLnNpZ25hbCA9IHNpZ25hbDtcbiAgQ29kZU1pcnJvci5MaW5lID0gTGluZTtcbiAgQ29kZU1pcnJvci5jaGFuZ2VFbmQgPSBjaGFuZ2VFbmQ7XG4gIENvZGVNaXJyb3Iuc2Nyb2xsYmFyTW9kZWwgPSBzY3JvbGxiYXJNb2RlbDtcbiAgQ29kZU1pcnJvci5Qb3MgPSBQb3M7XG4gIENvZGVNaXJyb3IuY21wUG9zID0gY21wO1xuICBDb2RlTWlycm9yLm1vZGVzID0gbW9kZXM7XG4gIENvZGVNaXJyb3IubWltZU1vZGVzID0gbWltZU1vZGVzO1xuICBDb2RlTWlycm9yLnJlc29sdmVNb2RlID0gcmVzb2x2ZU1vZGU7XG4gIENvZGVNaXJyb3IuZ2V0TW9kZSA9IGdldE1vZGU7XG4gIENvZGVNaXJyb3IubW9kZUV4dGVuc2lvbnMgPSBtb2RlRXh0ZW5zaW9ucztcbiAgQ29kZU1pcnJvci5leHRlbmRNb2RlID0gZXh0ZW5kTW9kZTtcbiAgQ29kZU1pcnJvci5jb3B5U3RhdGUgPSBjb3B5U3RhdGU7XG4gIENvZGVNaXJyb3Iuc3RhcnRTdGF0ZSA9IHN0YXJ0U3RhdGU7XG4gIENvZGVNaXJyb3IuaW5uZXJNb2RlID0gaW5uZXJNb2RlO1xuICBDb2RlTWlycm9yLmNvbW1hbmRzID0gY29tbWFuZHM7XG4gIENvZGVNaXJyb3Iua2V5TWFwID0ga2V5TWFwO1xuICBDb2RlTWlycm9yLmtleU5hbWUgPSBrZXlOYW1lO1xuICBDb2RlTWlycm9yLmlzTW9kaWZpZXJLZXkgPSBpc01vZGlmaWVyS2V5O1xuICBDb2RlTWlycm9yLmxvb2t1cEtleSA9IGxvb2t1cEtleTtcbiAgQ29kZU1pcnJvci5ub3JtYWxpemVLZXlNYXAgPSBub3JtYWxpemVLZXlNYXA7XG4gIENvZGVNaXJyb3IuU3RyaW5nU3RyZWFtID0gU3RyaW5nU3RyZWFtO1xuICBDb2RlTWlycm9yLlNoYXJlZFRleHRNYXJrZXIgPSBTaGFyZWRUZXh0TWFya2VyO1xuICBDb2RlTWlycm9yLlRleHRNYXJrZXIgPSBUZXh0TWFya2VyO1xuICBDb2RlTWlycm9yLkxpbmVXaWRnZXQgPSBMaW5lV2lkZ2V0O1xuICBDb2RlTWlycm9yLmVfcHJldmVudERlZmF1bHQgPSBlX3ByZXZlbnREZWZhdWx0O1xuICBDb2RlTWlycm9yLmVfc3RvcFByb3BhZ2F0aW9uID0gZV9zdG9wUHJvcGFnYXRpb247XG4gIENvZGVNaXJyb3IuZV9zdG9wID0gZV9zdG9wO1xuICBDb2RlTWlycm9yLmFkZENsYXNzID0gYWRkQ2xhc3M7XG4gIENvZGVNaXJyb3IuY29udGFpbnMgPSBjb250YWlucztcbiAgQ29kZU1pcnJvci5ybUNsYXNzID0gcm1DbGFzcztcbiAgQ29kZU1pcnJvci5rZXlOYW1lcyA9IGtleU5hbWVzO1xufVxuXG4vLyBFRElUT1IgQ09OU1RSVUNUT1JcblxuZGVmaW5lT3B0aW9ucyhDb2RlTWlycm9yJDEpO1xuXG5hZGRFZGl0b3JNZXRob2RzKENvZGVNaXJyb3IkMSk7XG5cbi8vIFNldCB1cCBtZXRob2RzIG9uIENvZGVNaXJyb3IncyBwcm90b3R5cGUgdG8gcmVkaXJlY3QgdG8gdGhlIGVkaXRvcidzIGRvY3VtZW50LlxudmFyIGRvbnREZWxlZ2F0ZSA9IFwiaXRlciBpbnNlcnQgcmVtb3ZlIGNvcHkgZ2V0RWRpdG9yIGNvbnN0cnVjdG9yXCIuc3BsaXQoXCIgXCIpO1xuZm9yICh2YXIgcHJvcCBpbiBEb2MucHJvdG90eXBlKSB7IGlmIChEb2MucHJvdG90eXBlLmhhc093blByb3BlcnR5KHByb3ApICYmIGluZGV4T2YoZG9udERlbGVnYXRlLCBwcm9wKSA8IDApXG4gIHsgQ29kZU1pcnJvciQxLnByb3RvdHlwZVtwcm9wXSA9IChmdW5jdGlvbihtZXRob2QpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7cmV0dXJuIG1ldGhvZC5hcHBseSh0aGlzLmRvYywgYXJndW1lbnRzKX1cbiAgfSkoRG9jLnByb3RvdHlwZVtwcm9wXSk7IH0gfVxuXG5ldmVudE1peGluKERvYyk7XG5cbi8vIElOUFVUIEhBTkRMSU5HXG5cbkNvZGVNaXJyb3IkMS5pbnB1dFN0eWxlcyA9IHtcInRleHRhcmVhXCI6IFRleHRhcmVhSW5wdXQsIFwiY29udGVudGVkaXRhYmxlXCI6IENvbnRlbnRFZGl0YWJsZUlucHV0fTtcblxuLy8gTU9ERSBERUZJTklUSU9OIEFORCBRVUVSWUlOR1xuXG4vLyBFeHRyYSBhcmd1bWVudHMgYXJlIHN0b3JlZCBhcyB0aGUgbW9kZSdzIGRlcGVuZGVuY2llcywgd2hpY2ggaXNcbi8vIHVzZWQgYnkgKGxlZ2FjeSkgbWVjaGFuaXNtcyBsaWtlIGxvYWRtb2RlLmpzIHRvIGF1dG9tYXRpY2FsbHlcbi8vIGxvYWQgYSBtb2RlLiAoUHJlZmVycmVkIG1lY2hhbmlzbSBpcyB0aGUgcmVxdWlyZS9kZWZpbmUgY2FsbHMuKVxuQ29kZU1pcnJvciQxLmRlZmluZU1vZGUgPSBmdW5jdGlvbihuYW1lLyosIG1vZGUsIOKApiovKSB7XG4gIGlmICghQ29kZU1pcnJvciQxLmRlZmF1bHRzLm1vZGUgJiYgbmFtZSAhPSBcIm51bGxcIikgeyBDb2RlTWlycm9yJDEuZGVmYXVsdHMubW9kZSA9IG5hbWU7IH1cbiAgZGVmaW5lTW9kZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuQ29kZU1pcnJvciQxLmRlZmluZU1JTUUgPSBkZWZpbmVNSU1FO1xuXG4vLyBNaW5pbWFsIGRlZmF1bHQgbW9kZS5cbkNvZGVNaXJyb3IkMS5kZWZpbmVNb2RlKFwibnVsbFwiLCBmdW5jdGlvbiAoKSB7IHJldHVybiAoe3Rva2VuOiBmdW5jdGlvbiAoc3RyZWFtKSB7IHJldHVybiBzdHJlYW0uc2tpcFRvRW5kKCk7IH19KTsgfSk7XG5Db2RlTWlycm9yJDEuZGVmaW5lTUlNRShcInRleHQvcGxhaW5cIiwgXCJudWxsXCIpO1xuXG4vLyBFWFRFTlNJT05TXG5cbkNvZGVNaXJyb3IkMS5kZWZpbmVFeHRlbnNpb24gPSBmdW5jdGlvbiAobmFtZSwgZnVuYykge1xuICBDb2RlTWlycm9yJDEucHJvdG90eXBlW25hbWVdID0gZnVuYztcbn07XG5Db2RlTWlycm9yJDEuZGVmaW5lRG9jRXh0ZW5zaW9uID0gZnVuY3Rpb24gKG5hbWUsIGZ1bmMpIHtcbiAgRG9jLnByb3RvdHlwZVtuYW1lXSA9IGZ1bmM7XG59O1xuXG5Db2RlTWlycm9yJDEuZnJvbVRleHRBcmVhID0gZnJvbVRleHRBcmVhO1xuXG5hZGRMZWdhY3lQcm9wcyhDb2RlTWlycm9yJDEpO1xuXG5Db2RlTWlycm9yJDEudmVyc2lvbiA9IFwiNS4zNS4wXCI7XG5cbnJldHVybiBDb2RlTWlycm9yJDE7XG5cbn0pKSk7XG4iLCJDb2RlTWlycm9yID0gcmVxdWlyZSgnLi9jb2RlbWlycm9yLmpzJyk7XG5Db2RlTWlycm9yLmRlZmluZU1vZGUoXCJpcHl0aG9uXCIsIGZ1bmN0aW9uKGNvbmYsIHBhcnNlckNvbmYpIHtcbiAgICB2YXIgcHl0aG9uQ29uZiA9IHt9O1xuICAgIGZvciAodmFyIHByb3AgaW4gcGFyc2VyQ29uZikge1xuICAgICAgICBpZiAocGFyc2VyQ29uZi5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgcHl0aG9uQ29uZltwcm9wXSA9IHBhcnNlckNvbmZbcHJvcF07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcHl0aG9uQ29uZi5uYW1lID0gJ3B5dGhvbic7XG4gICAgcHl0aG9uQ29uZi5zaW5nbGVPcGVyYXRvcnMgPSBuZXcgUmVnRXhwKFwiXltcXFxcK1xcXFwtXFxcXCovJSZ8QFxcXFxefjw+IVxcXFw/XVwiKTtcbiAgICBpZiAocHl0aG9uQ29uZi52ZXJzaW9uID09PSAzKSB7XG4gICAgICAgIHB5dGhvbkNvbmYuaWRlbnRpZmllcnMgPSBuZXcgUmVnRXhwKFwiXltfQS1aYS16XFx1MDBBMS1cXHVGRkZGXVtfQS1aYS16MC05XFx1MDBBMS1cXHVGRkZGXSpcIik7XG4gICAgfSBlbHNlIGlmIChweXRob25Db25mLnZlcnNpb24gPT09IDIpIHtcbiAgICAgICAgcHl0aG9uQ29uZi5pZGVudGlmaWVycyA9IG5ldyBSZWdFeHAoXCJeW19BLVphLXpdW19BLVphLXowLTldKlwiKTtcbiAgICB9XG4gICAgcmV0dXJuIENvZGVNaXJyb3IuZ2V0TW9kZShjb25mLCBweXRob25Db25mKTtcbn0sICdweXRob24nKTtcblxuQ29kZU1pcnJvci5kZWZpbmVNSU1FKFwidGV4dC94LWlweXRob25cIiwgXCJpcHl0aG9uXCIpO1xuXG52YXIgdXJsID0gbmV3IFVSTCh3aW5kb3cubG9jYXRpb24uaHJlZik7XG52YXIgdG90YWxfY2VsbHMgPSB1cmwuc2VhcmNoUGFyYW1zLmdldCgndG90YWxfY2VsbHMnKSB8fCAxNTA7XG52YXIgY21fY29uZmlnID0ge1xuICAgIFwiaW5kZW50VW5pdFwiOjQsXG4gICAgXCJyZWFkT25seVwiOmZhbHNlLFxuICAgIFwidGhlbWVcIjpcImlweXRob25cIixcbiAgICBcImV4dHJhS2V5c1wiOntcbiAgICAgICAgXCJDbWQtUmlnaHRcIjpcImdvTGluZVJpZ2h0XCIsXG4gICAgICAgIFwiRW5kXCI6XCJnb0xpbmVSaWdodFwiLFxuICAgICAgICBcIkNtZC1MZWZ0XCI6XCJnb0xpbmVMZWZ0XCIsXG4gICAgICAgIFwiVGFiXCI6XCJpbmRlbnRNb3JlXCIsXG4gICAgICAgIFwiU2hpZnQtVGFiXCI6XCJpbmRlbnRMZXNzXCIsXG4gICAgICAgIFwiQ21kLS9cIjpcInRvZ2dsZUNvbW1lbnRcIixcbiAgICAgICAgXCJDdHJsLS9cIjpcInRvZ2dsZUNvbW1lbnRcIixcbiAgICAgICAgXCJCYWNrc3BhY2VcIjpcImRlbFNwYWNlVG9QcmV2VGFiU3RvcFwiXG4gICAgfSxcbiAgICBcIm1vZGVcIjp7XG4gICAgICAgIFwibmFtZVwiOlwiaXB5dGhvblwiLFxuICAgICAgICBcInZlcnNpb25cIjozXG4gICAgfSxcbiAgICBcIm1hdGNoQnJhY2tldHNcIjp0cnVlLFxuICAgIFwiYXV0b0Nsb3NlQnJhY2tldHNcIjp0cnVlXG59O1xuXG53aW5kb3cuc2hhcmVkX2VsZW1lbnRzID0ge307XG5mb3IgKHZhciBpPTA7IGk8dG90YWxfY2VsbHM7IGkrKykge1xuICAgIHZhciBvdXRwdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB2YXIgaW5wdXRfYXJlYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGlucHV0X2FyZWEuc2V0QXR0cmlidXRlKCdkYXRhLWlkJywgaSk7XG4gICAgaW5wdXRfYXJlYS5zZXRBdHRyaWJ1dGUoJ2RhdGEtYWN0aXZlJywgJ25vJyk7XG4gICAgaW5wdXRfYXJlYS5jbGFzc05hbWUgPSAnaW5wdXRfYXJlYSc7XG4gICAgLy92YXIgY29kZW1pcnJvciA9IENvZGVNaXJyb3IoaW5wdXRfYXJlYSwgY21fY29uZmlnKTsgXG4gICAgdmFyIGNvZGVtaXJyb3IgPSBuZXcgQ29kZU1pcnJvcihpbnB1dF9hcmVhLCBjbV9jb25maWcpOyBcbiAgICB3aW5kb3cuc2hhcmVkX2VsZW1lbnRzW2ldID0ge1xuICAgICAgICAnb3V0cHV0Jzogb3V0cHV0LFxuICAgICAgICAnaW5wdXRfYXJlYSc6IGlucHV0X2FyZWEsXG4gICAgICAgICdjb2RlbWlycm9yJzogY29kZW1pcnJvcixcbiAgICB9O1xufVxuXG53aW5kb3cuc2hhcmVkX2VsZW1lbnRzX2F2YWlsYWJsZSA9IHRydWU7XG4iXX0=
